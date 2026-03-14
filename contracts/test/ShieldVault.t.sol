// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Test.sol";
import "../src/ShieldVault.sol";
import "../src/MockUSDC.sol";
import "../src/Verifier.sol";

// ─── Mock verifier for logic-only tests ──────────────────────────────────────

contract AlwaysValidVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}

contract AlwaysInvalidVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return false;
    }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

contract ShieldVaultTest is Test {

    MockUSDC    usdc;
    ShieldVault vault;

    // Values from circuits/Prover.toml — fixed for this proof
    bytes32 constant PROOF_MERKLE_ROOT    = 0x1aa72582ab7693c6a5bdcf66dba56a536c92fd4d8199db4e096d751a540c872a;
    bytes32 constant PROOF_NULLIFIER_HASH = 0x1396c32028ed63af7f97462b7193b33e22c57947eb4a066022edf33332919da5;
    address constant PROOF_RECIPIENT      = 0x1234567890AbcdEF1234567890aBcdef12345678;
    uint256 constant PROOF_AMOUNT         = 10000; // whole USDC units

    // commitment = h([actual_amount, employer_nonce, claim_pubkey, 0])
    bytes32 constant COMMITMENT = 0x2470043abc6987f84987373a60b134684f48b2a3e6a1331b1076188151fefc98;

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _deployWithMockVerifier(address _verifier) internal {
        usdc  = new MockUSDC();
        vault = new ShieldVault(address(usdc), _verifier);
    }

    // Force a root into knownRoots using Foundry storage cheats.
    // Mapping slot = keccak256(abi.encode(key, baseSlot)).
    // Storage layout (immutables don't occupy storage):
    //   slot 0:  nextIndex
    //   slot 1:  currentRoot
    //   slot 2-6: zeros[0..4]
    //   slot 7-11: lastSubtrees[0..4]
    //   slot 12: knownRoots
    //   slot 13: nullifierSpent
    function _forceKnownRoot(bytes32 root) internal {
        bytes32 slot = keccak256(abi.encode(root, uint256(12)));
        vm.store(address(vault), slot, bytes32(uint256(1)));
    }

    // Preload vault with USDC so it can pay out withdrawals
    function _fundVault(uint256 usdcMicro) internal {
        usdc.mint(address(vault), usdcMicro);
    }

    // ─── MiMC library unit tests ──────────────────────────────────────────────

    function testMimcRoundDeterministic() public pure {
        uint256 a = MiMC.round(0, MiMC.C0, MiMC.C1);
        uint256 b = MiMC.round(0, MiMC.C0, MiMC.C1);
        assertEq(a, b);
    }

    function testMimcHash2Deterministic() public pure {
        uint256 h1 = MiMC.hash2(1, 2);
        uint256 h2 = MiMC.hash2(1, 2);
        assertEq(h1, h2);
    }

    function testMimcHash2NotTrivial() public pure {
        // Hashing different inputs should give different outputs
        uint256 h1 = MiMC.hash2(1, 2);
        uint256 h2 = MiMC.hash2(1, 3);
        assertNotEq(h1, h2);
    }

    // Verify the commitment matches what the circuit computed
    function testCommitmentMatchesCircuit() public pure {
        // commitment = h([actual_amount, employer_nonce, claim_pubkey, 0])
        // claim_pubkey = 0x1396c32028ed63af7f97462b7193b33e22c57947eb4a066022edf33332919da5
        uint256 computed = MiMC.hash4(
            10000,
            11,
            uint256(0x1396c32028ed63af7f97462b7193b33e22c57947eb4a066022edf33332919da5),
            0
        );
        assertEq(bytes32(computed), COMMITMENT, "Commitment mismatch vs circuit");
    }

    // Verify claim_pubkey = h([claim_secret, 0, 0, 0])
    function testClaimPubkeyMatchesCircuit() public pure {
        uint256 pubkey = MiMC.hash4(7, 0, 0, 0); // claim_secret = 7
        assertEq(
            bytes32(pubkey),
            0x1396c32028ed63af7f97462b7193b33e22c57947eb4a066022edf33332919da5,
            "Claim pubkey mismatch"
        );
    }

    // ─── Constructor / tree initialisation ────────────────────────────────────

    function testConstructorSetsZeros() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));
        // zeros[0] must be 0
        assertEq(vault.zeros(0), bytes32(0));
        // zeros[1] must be MiMC.hash2(0, 0)
        assertEq(uint256(vault.zeros(1)), MiMC.hash2(0, 0));
    }

    function testInitialRootIsKnown() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));
        assertTrue(vault.isKnownRoot(vault.currentRoot()));
    }

    function testTreeCapacity() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));
        assertEq(vault.treeCapacity(), 32); // 2^5
    }

    // ─── depositBatch ─────────────────────────────────────────────────────────

    function testDepositBatchUpdatesRoot() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));

        bytes32 initialRoot = vault.currentRoot();

        usdc.mint(address(this), 10000 * 1e6);
        usdc.approve(address(vault), 10000 * 1e6);

        bytes32[] memory commitments    = new bytes32[](1);
        uint256[] memory amounts        = new uint256[](1);
        bytes[]   memory encryptedNotes = new bytes[](1);

        commitments[0]    = COMMITMENT;
        amounts[0]        = 10000;
        encryptedNotes[0] = hex"deadbeef";

        vault.depositBatch(commitments, amounts, encryptedNotes);

        bytes32 newRoot = vault.currentRoot();
        assertNotEq(newRoot, initialRoot, "Root should change after deposit");
        assertTrue(vault.isKnownRoot(newRoot), "New root should be stored");
        assertEq(vault.nextIndex(), 1, "Leaf index should be 1");
    }

    function testDepositBatchTransfersUSDC() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));

        usdc.mint(address(this), 10000 * 1e6);
        usdc.approve(address(vault), 10000 * 1e6);

        bytes32[] memory commitments    = new bytes32[](1);
        uint256[] memory amounts        = new uint256[](1);
        bytes[]   memory encryptedNotes = new bytes[](1);
        commitments[0] = COMMITMENT;
        amounts[0]     = 10000;

        vault.depositBatch(commitments, amounts, encryptedNotes);

        assertEq(usdc.balanceOf(address(vault)), 10000 * 1e6);
        assertEq(usdc.balanceOf(address(this)), 0);
    }

    function testDepositBatchLengthMismatchReverts() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));

        bytes32[] memory commitments = new bytes32[](1);
        uint256[] memory amounts     = new uint256[](2); // wrong length
        bytes[]   memory notes       = new bytes[](1);

        usdc.mint(address(this), 1e6);
        usdc.approve(address(vault), 1e6);

        vm.expectRevert("Length mismatch");
        vault.depositBatch(commitments, amounts, notes);
    }

    // ─── withdraw with mock verifier ─────────────────────────────────────────

    function testWithdrawWithAlwaysValidVerifier() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));
        _forceKnownRoot(PROOF_MERKLE_ROOT);
        _fundVault(PROOF_AMOUNT * 1e6);

        uint256 balanceBefore = usdc.balanceOf(PROOF_RECIPIENT);

        vault.withdraw(
            hex"aabbcc",            // dummy proof — verifier always returns true
            PROOF_MERKLE_ROOT,
            PROOF_NULLIFIER_HASH,
            PROOF_RECIPIENT,
            PROOF_AMOUNT
        );

        assertEq(usdc.balanceOf(PROOF_RECIPIENT), balanceBefore + PROOF_AMOUNT * 1e6);
        assertTrue(vault.isNullifierSpent(PROOF_NULLIFIER_HASH));
    }

    function testWithdrawMarkNullifierSpent() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));
        _forceKnownRoot(PROOF_MERKLE_ROOT);
        _fundVault(PROOF_AMOUNT * 1e6);

        vault.withdraw(hex"aabb", PROOF_MERKLE_ROOT, PROOF_NULLIFIER_HASH, PROOF_RECIPIENT, PROOF_AMOUNT);
        assertTrue(vault.isNullifierSpent(PROOF_NULLIFIER_HASH));
    }

    // ─── Double-spend guard ───────────────────────────────────────────────────

    function testDoubleSpendReverts() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));
        _forceKnownRoot(PROOF_MERKLE_ROOT);
        _fundVault(PROOF_AMOUNT * 2 * 1e6);

        vault.withdraw(hex"aabb", PROOF_MERKLE_ROOT, PROOF_NULLIFIER_HASH, PROOF_RECIPIENT, PROOF_AMOUNT);

        vm.expectRevert("Already claimed");
        vault.withdraw(hex"aabb", PROOF_MERKLE_ROOT, PROOF_NULLIFIER_HASH, PROOF_RECIPIENT, PROOF_AMOUNT);
    }

    // ─── Unknown root guard ───────────────────────────────────────────────────

    function testUnknownRootReverts() public {
        _deployWithMockVerifier(address(new AlwaysValidVerifier()));
        _fundVault(PROOF_AMOUNT * 1e6);

        // Don't call _forceKnownRoot — root is NOT in knownRoots
        vm.expectRevert("Unknown Merkle root");
        vault.withdraw(hex"aabb", PROOF_MERKLE_ROOT, PROOF_NULLIFIER_HASH, PROOF_RECIPIENT, PROOF_AMOUNT);
    }

    // ─── Invalid proof guard ──────────────────────────────────────────────────

    function testBadProofRevertsWithAlwaysInvalidVerifier() public {
        _deployWithMockVerifier(address(new AlwaysInvalidVerifier()));
        _forceKnownRoot(PROOF_MERKLE_ROOT);
        _fundVault(PROOF_AMOUNT * 1e6);

        vm.expectRevert("Invalid ZK proof");
        vault.withdraw(hex"aabb", PROOF_MERKLE_ROOT, PROOF_NULLIFIER_HASH, PROOF_RECIPIENT, PROOF_AMOUNT);
    }

    // ─── Real UltraHonk verifier + real proof ─────────────────────────────────
    //
    // Uses the proof generated by:
    //   nargo execute && bb prove -b ./target/circuits.json \
    //     -w ./target/circuits.gz -o ./target/alice_proof \
    //     -k ./target/vk/vk -t evm --write_vk
    //
    // The proof root differs from what _insertLeaf produces because the
    // Prover.toml uses all-zero siblings (merkle_path = ["0","0","0","0","0"]).
    // In a real deployment the backend feeds actual sibling hashes from the tree.

    function testRealProofVerifies() public {
        usdc  = new MockUSDC();
        HonkVerifier honkVerifier = new HonkVerifier();
        vault = new ShieldVault(address(usdc), address(honkVerifier));

        _forceKnownRoot(PROOF_MERKLE_ROOT);
        _fundVault(PROOF_AMOUNT * 1e6);

        bytes memory proof = _loadProof();

        bytes32[] memory pub = new bytes32[](4);
        pub[0] = PROOF_MERKLE_ROOT;
        pub[1] = PROOF_NULLIFIER_HASH;
        pub[2] = bytes32(uint256(uint160(PROOF_RECIPIENT)));
        pub[3] = bytes32(PROOF_AMOUNT);

        // Verify directly against the HonkVerifier
        assertTrue(honkVerifier.verify(proof, pub), "Real proof failed verification");
    }

    function testRealProofWithdraw() public {
        usdc  = new MockUSDC();
        HonkVerifier honkVerifier = new HonkVerifier();
        vault = new ShieldVault(address(usdc), address(honkVerifier));

        _forceKnownRoot(PROOF_MERKLE_ROOT);
        _fundVault(PROOF_AMOUNT * 1e6);

        bytes memory proof = _loadProof();

        vault.withdraw(proof, PROOF_MERKLE_ROOT, PROOF_NULLIFIER_HASH, PROOF_RECIPIENT, PROOF_AMOUNT);

        assertEq(usdc.balanceOf(PROOF_RECIPIENT), PROOF_AMOUNT * 1e6, "USDC not received");
        assertTrue(vault.isNullifierSpent(PROOF_NULLIFIER_HASH), "Nullifier not marked");
    }

    // Load proof bytes from disk (requires fs_permissions in foundry.toml)
    function _loadProof() internal view returns (bytes memory) {
        return vm.readFileBinary("../circuits/target/alice_proof/proof");
    }
}
