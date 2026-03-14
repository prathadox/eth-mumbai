// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/ShieldVault.sol";

// Verifier is already deployed at contracts/src/Verifier.sol by bb.
// We import the generated artifact directly.
import "../src/Verifier.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDC (local / testnet only — use real USDC on mainnet)
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed:", address(usdc));

        // 2. Deploy the bb-generated UltraHonk verifier
        HonkVerifier honkVerifier = new HonkVerifier();
        console.log("HonkVerifier deployed:", address(honkVerifier));

        // 3. Deploy ShieldVault
        ShieldVault vault = new ShieldVault(address(usdc), address(honkVerifier));
        console.log("ShieldVault deployed:", address(vault));

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== Deployment Summary ===");
        console.log("MockUSDC:     ", address(usdc));
        console.log("HonkVerifier: ", address(honkVerifier));
        console.log("ShieldVault:  ", address(vault));
        console.log("Tree capacity:", vault.treeCapacity());
        console.log("Initial root: ", uint256(vault.currentRoot()));
    }
}
