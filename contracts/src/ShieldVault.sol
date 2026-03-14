// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Verifier.sol";

// ============================================================================
// MiMC Hash Library
// Mirrors the circuit's h() function in main.nr exactly.
// Constants and prime must be byte-for-byte identical to the Noir globals.
// ============================================================================

library MiMC {
    // BN254 scalar field prime
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

    // hash(inputs[4]) - mirrors h([a,b,c,d]) in Noir
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

// ============================================================================
// ShieldVault - Stealth Address Payroll Contract
// ============================================================================

contract ShieldVault {
    using MiMC for uint256;

    IERC20    public immutable usdc;
    IVerifier public immutable verifier;
    address   public immutable owner;

    uint256 public constant TREE_DEPTH = 5; // supports 2^5 = 32 notes

    uint256 public nextIndex;
    bytes32 public currentRoot;

    // Pre-computed zero subtree roots at each level
    bytes32[TREE_DEPTH] public zeros;
    // Last left-subtree root seen at each level
    bytes32[TREE_DEPTH] public lastSubtrees;

    // All Merkle roots ever produced are valid
    mapping(bytes32 => bool) public knownRoots;
    // Spent nullifiers - prevents double-claiming
    mapping(bytes32 => bool) public nullifierSpent;
    // Track commitments for debugging
    mapping(bytes32 => bool) public commitmentExists;

    event NoteCreated(
        bytes32 indexed commitment,
        uint256 leafIndex,
        bytes32 newRoot
    );

    event WithdrawalToStealth(
        bytes32 indexed nullifierHash,
        address indexed stealthAddress,
        uint256 amount
    );

    // ========================================================================
    // Constructor
    // ========================================================================

    constructor(address _usdc, address _verifier) {
        usdc     = IERC20(_usdc);
        verifier = IVerifier(_verifier);
        owner    = msg.sender;

        // Build zero-subtree values bottom-up using MiMC
        zeros[0] = bytes32(0);
        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            uint256 z = uint256(zeros[i - 1]);
            zeros[i] = bytes32(MiMC.hash2(z, z));
        }

        currentRoot = zeros[TREE_DEPTH - 1];
        knownRoots[currentRoot] = true;
    }

    // ========================================================================
    // Owner helpers
    // ========================================================================

    function addKnownRoot(bytes32 root) external {
        require(msg.sender == owner, "Not owner");
        knownRoots[root] = true;
    }

    // ========================================================================
    // Employer deposit - creates commitments in Merkle tree
    // ========================================================================

    function depositBatch(
        bytes32[] calldata commitments,
        uint256[] calldata amounts
    ) external {
        require(commitments.length == amounts.length, "Length mismatch");
        require(nextIndex + commitments.length <= 2 ** TREE_DEPTH, "Tree full");

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        require(
            usdc.transferFrom(msg.sender, address(this), total * 1e6),
            "USDC transfer failed"
        );

        for (uint256 i = 0; i < commitments.length; i++) {
            (uint256 idx, bytes32 newRoot) = _insertLeaf(commitments[i]);
            knownRoots[newRoot] = true;
            commitmentExists[commitments[i]] = true;
            emit NoteCreated(commitments[i], idx, newRoot);
        }
    }

    // ========================================================================
    // Employee claim - withdraw to stealth address with ZK proof
    // ========================================================================
    // Public inputs order (must match circuit):
    //   [0] merkle_root
    //   [1] nullifier_hash
    //   [2] stealth_address
    //   [3] amount

    function withdrawToStealth(
        bytes   calldata proof,
        bytes32          merkleRoot,
        bytes32          nullifierHash,
        bytes32          stealthFieldElement,
        uint256          amount
    ) external {
        require(knownRoots[merkleRoot], "Unknown Merkle root");
        require(!nullifierSpent[nullifierHash], "Already claimed");
        require(stealthFieldElement != 0, "Zero stealth");

        // Public inputs order must match circuit: [merkle_root, nullifier_hash, stealth_address, amount]
        bytes32[] memory pub = new bytes32[](4);
        pub[0] = merkleRoot;
        pub[1] = nullifierHash;
        pub[2] = stealthFieldElement;
        pub[3] = bytes32(amount);

        require(verifier.verify(proof, pub), "Invalid ZK proof");

        nullifierSpent[nullifierHash] = true;

        // Truncate field element to 20-byte Ethereum address for transfer
        address stealthAddr = address(uint160(uint256(stealthFieldElement)));
        require(usdc.transfer(stealthAddr, amount * 1e6), "USDC transfer failed");

        emit WithdrawalToStealth(nullifierHash, stealthAddr, amount);
    }

    // ========================================================================
    // Consolidate - sweep funds from stealth addresses to main wallet
    // ========================================================================

    function consolidateFromStealth(
        address[] calldata stealthAddresses,
        address         recipient
    ) external {
        require(recipient != address(0), "Zero recipient");

        for (uint256 i = 0; i < stealthAddresses.length; i++) {
            address stealth = stealthAddresses[i];
            uint256 balance = usdc.balanceOf(stealth);
            if (balance > 0) {
                // Transfer from stealth to recipient
                // Caller must have approval from stealth addresses
                usdc.transferFrom(stealth, recipient, balance);
            }
        }
    }

    // ========================================================================
    // Internal: Incremental Merkle insert
    // ========================================================================

    function _insertLeaf(bytes32 leaf)
        internal
        returns (uint256 idx, bytes32 newRoot)
    {
        idx = nextIndex++;
        uint256 current = uint256(leaf);
        uint256 pos     = idx;

        for (uint256 level = 0; level < TREE_DEPTH; level++) {
            if (pos % 2 == 0) {
                // current is a left child - save it, pair with zero on the right
                lastSubtrees[level] = bytes32(current);
                current = MiMC.hash2(current, uint256(zeros[level]));
            } else {
                // current is a right child - pair with the saved left sibling
                current = MiMC.hash2(uint256(lastSubtrees[level]), current);
            }
            pos >>= 1;
        }

        currentRoot = bytes32(current);
        newRoot     = bytes32(current);
    }

    // ========================================================================
    // Views
    // ========================================================================

    function isKnownRoot(bytes32 root) external view returns (bool) {
        return knownRoots[root];
    }

    function isNullifierSpent(bytes32 nullifier) external view returns (bool) {
        return nullifierSpent[nullifier];
    }

    function treeCapacity() external pure returns (uint256) {
        return 2 ** TREE_DEPTH;
    }

    function getNextIndex() external view returns (uint256) {
        return nextIndex;
    }
}
