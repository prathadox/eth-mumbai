// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Verifier.sol"; // pulls in IVerifier declared by the bb-generated file

// ─── MiMC hash library ───────────────────────────────────────────────────────
//
// Mirrors the circuit's h() function in main.nr exactly.
// Constants and prime must be byte-for-byte identical to the Noir globals.

library MiMC {
    // BN254 scalar field prime (named BN254_P to avoid shadowing Verifier.sol's P)
    uint256 constant BN254_P =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Same constants as circuits/src/main.nr
    uint256 constant C0 = 0x2b6f040c9184c11da84fb1f65f84ba3a;
    uint256 constant C1 = 0x1cfc66f4c1e6d4a0e0c2a9dfe7b1c3f2;
    uint256 constant C2 = 0x2a9dfe7b1c3f21cfc66f4c1e6d4a0e0c;

    function round(uint256 x, uint256 k, uint256 c) internal pure returns (uint256) {
        uint256 t  = addmod(addmod(x, k, BN254_P), c, BN254_P);
        uint256 t2 = mulmod(t, t, BN254_P);
        return mulmod(t2, t, BN254_P);
    }

    // hash(inputs[4]) — mirrors h([a,b,c,d]) in Noir
    function hash4(uint256 a, uint256 b, uint256 c, uint256 d) internal pure returns (uint256) {
        uint256[4] memory ins = [a, b, c, d];
        uint256 state = 0;
        for (uint256 i = 0; i < 4; i++) {
            uint256 t = addmod(state, ins[i], BN254_P);
            state = round(t, C0, C1);
            state = round(state, C1, C2);
            state = round(state, C2, C0);
        }
        return state;
    }

    // Convenience: mirrors h([a, b, 0, 0])
    function hash2(uint256 a, uint256 b) internal pure returns (uint256) {
        return hash4(a, b, 0, 0);
    }
}

// ─── ShieldVault ─────────────────────────────────────────────────────────────

contract ShieldVault {
    using MiMC for uint256;

    IERC20    public immutable usdc;
    IVerifier public immutable verifier;
    address   public immutable owner;

    uint256 public constant TREE_DEPTH = 5; // supports 2^5 = 32 notes

    uint256 public nextIndex;
    bytes32 public currentRoot;

    // Pre-computed zero subtree roots at each level (using MiMC, not keccak)
    bytes32[TREE_DEPTH] public zeros;
    // Last left-subtree root seen at each level (for incremental Merkle insert)
    bytes32[TREE_DEPTH] public lastSubtrees;

    // All Merkle roots ever produced are valid (allows claiming after more deposits)
    mapping(bytes32 => bool) public knownRoots;
    // Spent nullifiers — prevents double-claiming
    mapping(bytes32 => bool) public nullifierSpent;

    event NoteCreated(
        bytes32 indexed commitment,
        uint256 leafIndex,
        bytes32 newRoot,
        bytes encryptedNote
    );
    event Withdrawal(
        bytes32 indexed nullifierHash,
        address indexed recipient,
        uint256 amount
    );

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _usdc, address _verifier) {
        usdc     = IERC20(_usdc);
        verifier = IVerifier(_verifier);
        owner    = msg.sender;

        // Build zero-subtree values bottom-up using MiMC so they match the
        // circuit's merkle_root_of() which also uses h([left, right, 0, 0]).
        zeros[0] = bytes32(0); // empty leaf
        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            uint256 z = uint256(zeros[i - 1]);
            zeros[i] = bytes32(MiMC.hash2(z, z));
        }

        currentRoot = zeros[TREE_DEPTH - 1];
        knownRoots[currentRoot] = true;
    }

    // ─── Owner helpers ────────────────────────────────────────────────────────

    // Manually mark a root as known — used for demo/migration when proofs are
    // generated against an off-chain-computed root before the corresponding
    // depositBatch has been mined (e.g. Prover.toml all-zero siblings).
    function addKnownRoot(bytes32 root) external {
        require(msg.sender == owner, "Not owner");
        knownRoots[root] = true;
    }

    // ─── Employer deposit ─────────────────────────────────────────────────────
    //
    // Called once per payroll run by the company wallet (via BitGo multi-sig).
    // commitments[i] = MiMC(amount, nonce, claim_pubkey) — computed off-chain.
    // amounts[i]     = whole USDC units (1 USDC = 1e6 micro-USDC).
    // encryptedNotes[i] = ECDH-encrypted {amount, nonce} blob for the employee.

    function depositBatch(
        bytes32[] calldata commitments,
        uint256[] calldata amounts,
        bytes[]   calldata encryptedNotes
    ) external {
        require(
            commitments.length == amounts.length &&
            amounts.length == encryptedNotes.length,
            "Length mismatch"
        );
        require(nextIndex + commitments.length <= 2 ** TREE_DEPTH, "Tree full");

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) total += amounts[i];

        require(
            usdc.transferFrom(msg.sender, address(this), total * 1e6),
            "USDC transfer failed"
        );

        for (uint256 i = 0; i < commitments.length; i++) {
            (uint256 idx, bytes32 newRoot) = _insertLeaf(commitments[i]);
            knownRoots[newRoot] = true;
            emit NoteCreated(commitments[i], idx, newRoot, encryptedNotes[i]);
        }
    }

    // ─── Employee claim ───────────────────────────────────────────────────────
    //
    // Called by Alice from her browser (or via ERC-4337 relayer).
    // proof         = bb UltraHonk proof bytes.
    // merkleRoot    = root Alice's proof was generated against.
    // nullifierHash = MiMC(claim_secret, leaf_index) — one-time spend token.
    // recipient     = address to receive USDC.
    // amount        = whole USDC units (must match what's in the ZK proof).

    function withdraw(
        bytes   calldata proof,
        bytes32          merkleRoot,
        bytes32          nullifierHash,
        address          recipient,
        uint256          amount
    ) external {
        require(knownRoots[merkleRoot],         "Unknown Merkle root");
        require(!nullifierSpent[nullifierHash],  "Already claimed");
        require(recipient != address(0),         "Zero recipient");

        // Public inputs must match the order in circuits/src/main.nr:
        //   merkle_root, nullifier_hash, recipient, amount
        bytes32[] memory pub = new bytes32[](4);
        pub[0] = merkleRoot;
        pub[1] = nullifierHash;
        pub[2] = bytes32(uint256(uint160(recipient)));
        pub[3] = bytes32(amount);

        require(verifier.verify(proof, pub), "Invalid ZK proof");

        nullifierSpent[nullifierHash] = true;
        require(usdc.transfer(recipient, amount * 1e6), "USDC transfer failed");

        emit Withdrawal(nullifierHash, recipient, amount);
    }

    // ─── Incremental Merkle insert ────────────────────────────────────────────
    //
    // Standard incremental Merkle tree using MiMC instead of keccak256 so the
    // computed root matches what the ZK circuit reconstructs from the proof path.

    function _insertLeaf(bytes32 leaf)
        internal
        returns (uint256 idx, bytes32 newRoot)
    {
        idx = nextIndex++;
        uint256 current = uint256(leaf);
        uint256 pos     = idx;

        for (uint256 level = 0; level < TREE_DEPTH; level++) {
            if (pos % 2 == 0) {
                // current is a left child — save it, pair with zero on the right
                lastSubtrees[level] = bytes32(current);
                current = MiMC.hash2(current, uint256(zeros[level]));
            } else {
                // current is a right child — pair with the saved left sibling
                current = MiMC.hash2(uint256(lastSubtrees[level]), current);
            }
            pos >>= 1;
        }

        currentRoot = bytes32(current);
        newRoot     = bytes32(current);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function isKnownRoot(bytes32 root) external view returns (bool) {
        return knownRoots[root];
    }

    function isNullifierSpent(bytes32 nullifier) external view returns (bool) {
        return nullifierSpent[nullifier];
    }

    function treeCapacity() external pure returns (uint256) {
        return 2 ** TREE_DEPTH;
    }
}
