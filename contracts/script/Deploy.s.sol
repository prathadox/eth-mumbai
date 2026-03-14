// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

// ─── ShieldPay Deploy Script ──────────────────────────────────────────────────
//
//   Local Anvil:
//     anvil --code-size-limit 50000
//     PRIVATE_KEY=0xac0974... forge script script/Deploy.s.sol \
//       --rpc-url http://127.0.0.1:8545 --broadcast --disable-code-size-limit
//
//   Base Sepolia:
//     PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
//       --rpc-url https://sepolia.base.org --broadcast --disable-code-size-limit
//
//   NOTE: Use real USDC address on mainnet — skip MockUSDC deployment and pass
//         the real token address directly to ShieldVault constructor.
// ─────────────────────────────────────────────────────────────────────────────

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/ShieldVault.sol";
import "../src/Verifier.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDC (testnet only — use real USDC on mainnet)
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed:", address(usdc));

        // 2. Deploy the bb-generated ZK Honk verifier
        HonkVerifier honkVerifier = new HonkVerifier();
        console.log("HonkVerifier deployed:", address(honkVerifier));

        // 3. Deploy ShieldVault
        ShieldVault vault = new ShieldVault(address(usdc), address(honkVerifier));
        console.log("ShieldVault deployed:", address(vault));

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("MockUSDC:     ", address(usdc));
        console.log("HonkVerifier: ", address(honkVerifier));
        console.log("ShieldVault:  ", address(vault));
        console.log("Tree capacity:", vault.treeCapacity());
        console.log("Initial root: ", uint256(vault.currentRoot()));
    }
}
