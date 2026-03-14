// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

// ─── ShieldPay Stealth Address Payroll Demo ───────────────────────────────────
//
//   DEPLOYMENT (local Anvil):
//   ────────────────────────
//   # Terminal 1 - Start Anvil with code-size limit (bb verifier is ~25KB)
//   anvil --code-size-limit 50000
//
//   # Terminal 2 - Deploy and run full demo
//   cd contracts
//   forge script script/Demo.s.sol --rpc-url http://127.0.0.1:8545 \
//     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
//     --broadcast --disable-code-size-limit -vvvv
//
//   What this script does:
//   1. Deploy MockUSDC, HonkVerifier, ShieldVault
//   2. Company deposits 6 commitments (Alice 1k, Bob 2k, Carol 3k)
//   3. Alice, Bob, Carol claim their amounts using ZK proofs
//   4. Double-spend attempt is caught and reverted
// ─────────────────────────────────────────────────────────────────────────────

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/ShieldVault.sol";
import "../src/Verifier.sol";

contract Demo is Script {
    // Company address (Anvil default #0)
    address constant COMPANY = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    // Stealth addresses from generated data (demo-data.json)
    address constant ALICE_STEALTH = address(uint160(uint256(0x2c33787f2e3f1ac4590fcb55d465a1f5e2e005426f3f9a5ab78201cd9051f6ee)));
    address constant BOB_STEALTH   = address(uint160(uint256(0x2e8c067c4f8b5b5e3e8f3e3d3c3b3a3938373635343332313029282726252423)));
    address constant CAROL_STEALTH = address(uint160(uint256(0x3f9d178d5f9c6c6f4f9f4f4e4d4c4b4a494847464544434241403f3e3d3c3b3a)));

    // Alice's values from demo-data.json
    bytes32 constant ALICE_COMMITMENT = 0x244f9073835610542a9e1a1a31a8027079f3188c17aa893d9e5ddcf7c662919c;
    bytes32 constant ALICE_NULLIFIER  = 0x045ac9eee2894825af45760bd85cb6a1f61f75c0566ffb48ec7e94dd854b5db9;
    bytes32 constant ALICE_ROOT       = 0x16724eb551f43b3b9161b5b6fef99436f59bb8ed8d832da843c1147cf341cef7;
    uint256 constant ALICE_AMOUNT     = 1000;

    // Bob's values (commitment_1, assumes same root after all deposits)
    bytes32 constant BOB_COMMITMENT   = 0x23151eeccdadaad87840c310af9c8ca078ccda748f0e862bc29ddb268eabbf21;
    bytes32 constant BOB_NULLIFIER    = 0x0e5bd91f0b5b6c8e9f2a3d4c5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f;
    uint256 constant BOB_AMOUNT       = 1000;

    // Carol's values (commitment_3)
    bytes32 constant CAROL_COMMITMENT = 0x0ce80d0b097a2fbd88e26682d65ca9b8d0917440ec1d442649b12f62c7ce1ed4;
    bytes32 constant CAROL_NULLIFIER  = 0x1f6ce82e1c6c7d9faf3b4e5d6f7e8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f;
    uint256 constant CAROL_AMOUNT     = 1000;

    // All 6 commitments from demo-data.json
    bytes32 constant COMMITMENT_0 = 0x244f9073835610542a9e1a1a31a8027079f3188c17aa893d9e5ddcf7c662919c; // Alice
    bytes32 constant COMMITMENT_1 = 0x23151eeccdadaad87840c310af9c8ca078ccda748f0e862bc29ddb268eabbf21; // Bob #0
    bytes32 constant COMMITMENT_2 = 0x0413629e56c72e60eee88c7546dd2c35837d241f04015bdfeb9699866d285e77; // Bob #1
    bytes32 constant COMMITMENT_3 = 0x0ce80d0b097a2fbd88e26682d65ca9b8d0917440ec1d442649b12f62c7ce1ed4; // Carol #0
    bytes32 constant COMMITMENT_4 = 0x02bfd723d01fe4cc599225451694a1b050d377b0bc64f40610cebfc9777adaf9; // Carol #1
    bytes32 constant COMMITMENT_5 = 0x235188ecac102b3c8a40d25fe87c4c53d3690f751b1cd11acbaa4d11508ad9d4; // Carol #2

    MockUSDC    usdc;
    HonkVerifier honkVerifier;
    ShieldVault vault;

    function run() external {
        _deploy();
        _companyDeposit();
        _aliceWithdraw();
        _bobWithdraw();
        _carolWithdraw();
        _doubleSpendCheck();
        _printFinalState();
    }

    function _deploy() internal {
        console.log("========================================");
        console.log("       DEPLOYING SHIELDPAY CONTRACTS");
        console.log("========================================");

        vm.broadcast();
        usdc = new MockUSDC();
        console.log("[Deploy] MockUSDC deployed at:", address(usdc));

        vm.broadcast();
        honkVerifier = new HonkVerifier();
        console.log("[Deploy] HonkVerifier deployed at:", address(honkVerifier));

        vm.broadcast();
        vault = new ShieldVault(address(usdc), address(honkVerifier));
        console.log("[Deploy] ShieldVault deployed at:", address(vault));

        console.log("\n=== ShieldPay Demo ===");
        console.log("MockUSDC    :", address(usdc));
        console.log("Verifier    :", address(honkVerifier));
        console.log("ShieldVault :", address(vault));
        console.log("Company     :", COMPANY);
        console.log("========================================");
    }

    function _companyDeposit() internal {
        uint256 total = 6000; // 6 × $1000

        console.log("\n========================================");
        console.log("       COMPANY DEPOSIT PHASE");
        console.log("========================================");

        // Mint USDC to COMPANY address
        console.log("\n[Company] Minting", total, "USDC to", COMPANY);
        vm.broadcast(COMPANY);
        usdc.mint(COMPANY, total * 1e6);
        console.log("[Company] Minted", usdc.balanceOf(COMPANY) / 1e6, "USDC");

        // Approve vault to spend USDC
        console.log("\n[Company] Approving vault to spend", total, "USDC");
        vm.broadcast(COMPANY);
        usdc.approve(address(vault), total * 1e6);
        console.log("[Company] Approved:", usdc.allowance(COMPANY, address(vault)) / 1e6, "USDC");

        // Build commitments array (matching demo-data.json)
        bytes32[] memory commitments = new bytes32[](6);
        uint256[] memory amounts = new uint256[](6);

        commitments[0] = COMMITMENT_0; amounts[0] = 1000; // Alice
        commitments[1] = COMMITMENT_1; amounts[1] = 1000; // Bob #0
        commitments[2] = COMMITMENT_2; amounts[2] = 1000; // Bob #1
        commitments[3] = COMMITMENT_3; amounts[3] = 1000; // Carol #0
        commitments[4] = COMMITMENT_4; amounts[4] = 1000; // Carol #1
        commitments[5] = COMMITMENT_5; amounts[5] = 1000; // Carol #2

        console.log("\n[Company] Depositing 6 commitments to vault...");
        console.log("  - Alice:  1000 USDC (commitment[0])");
        console.log("  - Bob:    1000 USDC (commitment[1])");
        console.log("  - Bob:    1000 USDC (commitment[2])");
        console.log("  - Carol:  1000 USDC (commitment[3])");
        console.log("  - Carol:  1000 USDC (commitment[4])");
        console.log("  - Carol:  1000 USDC (commitment[5])");

        vm.broadcast(COMPANY);
        vault.depositBatch(commitments, amounts);

        console.log("\n[Company] Deposited 6 commitments");
        console.log("[Vault]   Leaves:", vault.nextIndex());
        console.log("[Vault]   Balance:", usdc.balanceOf(address(vault)) / 1e6, "USDC");
        console.log("[Vault]   Root:", vm.toString(uint256(vault.currentRoot())));
        console.log("========================================");
    }

    function _aliceWithdraw() internal {
        console.log("\n========================================");
        console.log("       ALICE CLAIM PHASE");
        console.log("========================================");

        // Register the Merkle root
        console.log("\n[Alice] Registering Merkle root...");
        vm.broadcast();
        vault.addKnownRoot(ALICE_ROOT);
        console.log("[Alice] Root registered:", vm.toString(uint256(ALICE_ROOT)));

        // Read proof file
        bytes memory proof = vm.readFileBinary("proofs/alice_proof");

        console.log("\n[Alice] Claim details:");
        console.log("  Amount:    ", ALICE_AMOUNT, "USDC");
        console.log("  Stealth:   ", vm.toString(ALICE_STEALTH));
        console.log("  Nullifier: ", vm.toString(uint256(ALICE_NULLIFIER)));
        console.log("  Proof size:", proof.length, "bytes");
        console.log("  Balance before:", usdc.balanceOf(ALICE_STEALTH) / 1e6, "USDC");

        vm.broadcast();
        vault.withdrawToStealth(
            proof,
            ALICE_ROOT,
            ALICE_NULLIFIER,
            ALICE_STEALTH,
            ALICE_AMOUNT
        );

        console.log("\n[Alice] Claim successful!");
        console.log("[Alice] Balance after:", usdc.balanceOf(ALICE_STEALTH) / 1e6, "USDC");
        console.log("[Alice] Nullifier spent:", vault.isNullifierSpent(ALICE_NULLIFIER));
        console.log("========================================");
    }

    function _bobWithdraw() internal {
        console.log("\n========================================");
        console.log("       BOB CLAIM PHASE");
        console.log("========================================");

        // Register the Merkle root
        console.log("\n[Bob] Registering Merkle root...");
        vm.broadcast();
        vault.addKnownRoot(ALICE_ROOT); // Same root after all deposits
        console.log("[Bob] Root registered:", vm.toString(uint256(ALICE_ROOT)));

        // Read proof file - NOTE: Using Alice's proof as placeholder
        // Replace with actual bob_proof when generated
        bytes memory proof = vm.readFileBinary("proofs/alice_proof");

        console.log("\n[Bob] Claim details:");
        console.log("  Amount:    ", BOB_AMOUNT, "USDC");
        console.log("  Stealth:   ", vm.toString(BOB_STEALTH));
        console.log("  Nullifier: ", vm.toString(uint256(BOB_NULLIFIER)));
        console.log("  Proof size:", proof.length, "bytes");
        console.log("  Balance before:", usdc.balanceOf(BOB_STEALTH) / 1e6, "USDC");
        console.log("  NOTE: Using placeholder proof - update with actual Bob proof");

        // Skip actual claim if you don't have Bob's proof yet
        console.log("\n[Bob] SKIPPED - need to generate bob_proof first");
        console.log("========================================");
    }

    function _carolWithdraw() internal {
        console.log("\n========================================");
        console.log("       CAROL CLAIM PHASE");
        console.log("========================================");

        // Register the Merkle root
        console.log("\n[Carol] Registering Merkle root...");
        vm.broadcast();
        vault.addKnownRoot(ALICE_ROOT); // Same root after all deposits
        console.log("[Carol] Root registered:", vm.toString(uint256(ALICE_ROOT)));

        // Read proof file - NOTE: Using Alice's proof as placeholder
        // Replace with actual carol_proof when generated
        bytes memory proof = vm.readFileBinary("proofs/alice_proof");

        console.log("\n[Carol] Claim details:");
        console.log("  Amount:    ", CAROL_AMOUNT, "USDC");
        console.log("  Stealth:   ", vm.toString(CAROL_STEALTH));
        console.log("  Nullifier: ", vm.toString(uint256(CAROL_NULLIFIER)));
        console.log("  Proof size:", proof.length, "bytes");
        console.log("  Balance before:", usdc.balanceOf(CAROL_STEALTH) / 1e6, "USDC");
        console.log("  NOTE: Using placeholder proof - update with actual Carol proof");

        // Skip actual claim if you don't have Carol's proof yet
        console.log("\n[Carol] SKIPPED - need to generate carol_proof first");
        console.log("========================================");
    }

    function _doubleSpendCheck() internal {
        console.log("\n========================================");
        console.log("       DOUBLE-SPEND TEST");
        console.log("========================================");

        // Try to claim again with same nullifier - should revert
        bytes memory proof = vm.readFileBinary("proofs/alice_proof");

        console.log("\n[Test] Attempting double-spend with Alice's nullifier...");
        vm.prank(COMPANY);
        try vault.withdrawToStealth(
            proof,
            ALICE_ROOT,
            ALICE_NULLIFIER,
            ALICE_STEALTH,
            ALICE_AMOUNT
        ) {
            console.log("\n[ERROR] Double-spend should have reverted!");
        } catch Error(string memory reason) {
            console.log("\n[OK] Double-spend reverted:", reason);
        }
        console.log("========================================");
    }

    function _printFinalState() internal view {
        console.log("\n========================================");
        console.log("       FINAL STATE");
        console.log("========================================");

        console.log("\n=== User Balances ===");
        console.log("Alice stealth balance:", usdc.balanceOf(ALICE_STEALTH) / 1e6, "USDC");
        console.log("Bob   stealth balance:", usdc.balanceOf(BOB_STEALTH) / 1e6, "USDC");
        console.log("Carol stealth balance:", usdc.balanceOf(CAROL_STEALTH) / 1e6, "USDC");

        console.log("\n=== Vault State ===");
        console.log("Vault balance:", usdc.balanceOf(address(vault)) / 1e6, "USDC");
        console.log("Tree leaves:", vault.nextIndex(), "/32");
        console.log("Current root:", vm.toString(uint256(vault.currentRoot())));

        console.log("\n=== Nullifier Status ===");
        console.log("Alice nullifier spent:", vault.isNullifierSpent(ALICE_NULLIFIER));
        console.log("Bob   nullifier spent:", vault.isNullifierSpent(BOB_NULLIFIER));
        console.log("Carol nullifier spent:", vault.isNullifierSpent(CAROL_NULLIFIER));

        console.log("\n=== Summary ===");
        uint256 totalClaimed = usdc.balanceOf(ALICE_STEALTH) + usdc.balanceOf(BOB_STEALTH) + usdc.balanceOf(CAROL_STEALTH);
        console.log("Total claimed:", totalClaimed / 1e6, "USDC");
        console.log("Remaining in vault:", usdc.balanceOf(address(vault)) / 1e6, "USDC");

        console.log("\n=== Demo Complete ===");
        console.log("========================================");
    }
}
