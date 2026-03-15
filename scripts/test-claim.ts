/**
 * test-claim.ts
 *
 * Tests a ONE-TIME ZK salary claim using alice_stealth0 proof.
 * ⚠  This burns the alice_stealth0 nullifier — use bob/carol proofs for demo.
 *
 * Usage:
 *   node_modules/.bin/tsx scripts/test-claim.ts
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../penguin-protocol/penguin-protocol/.env.local") });

const RPC   = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!;
const PK    = process.env.SIGNER_PRIVATE_KEY!;
const VAULT = process.env.NEXT_PUBLIC_SHIELD_VAULT_ADDRESS!;
const USDC  = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS!;

const VAULT_ABI = [
  "function withdrawToStealth(bytes calldata proof, bytes32 merkleRoot, bytes32 nullifierHash, bytes32 stealthFieldElement, uint256 amount) external",
  "function isNullifierSpent(bytes32 nullifier) external view returns (bool)",
];
const USDC_ABI = [
  "function balanceOf(address) external view returns (uint256)",
];

// alice_stealth0 public inputs
const PUBLIC_INPUTS = {
  merkleRoot:    "0x16724eb551f43b3b9161b5b6fef99436f59bb8ed8d832da843c1147cf341cef7",
  nullifierHash: "0x045ac9eee2894825af45760bd85cb6a1f61f75c0566ffb48ec7e94dd854b5db9",
  stealthAddr:   "0x2c33787f2e3f1ac4590fcb55d465a1f5e2e005426f3f9a5ab78201cd9051f6ee",
  amount:        1000n,
};

function log(msg: string) {
  const tag = msg.startsWith("✓") ? "\x1b[34m" : msg.startsWith("✗") ? "\x1b[31m" : "\x1b[90m";
  console.log(`${tag}${msg}\x1b[0m`);
}

async function main() {
  console.log("\x1b[1m" + "=".repeat(60) + "\x1b[0m");
  console.log("\x1b[1m  ZK Claim Test — alice_stealth0\x1b[0m");
  console.log("\x1b[33m  ⚠  This burns alice_stealth0 nullifier (one-time use)\x1b[0m");
  console.log("\x1b[33m  ⚠  Use bob/carol proofs for the demo\x1b[0m");
  console.log("\x1b[1m" + "=".repeat(60) + "\x1b[0m\n");

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(PK, provider);
  const vault    = new ethers.Contract(VAULT, VAULT_ABI, signer);
  const usdc     = new ethers.Contract(USDC, USDC_ABI, signer);

  log(`[1/4] Checking nullifier status…`);
  const spent = await vault.isNullifierSpent(PUBLIC_INPUTS.nullifierHash) as boolean;
  if (spent) {
    log(`✗ Nullifier already spent — alice_stealth0 was already claimed`);
    log(`  Use bob_stealth0 or carol_stealth0 for the next claim`);
    return;
  }
  log(`✓ Nullifier fresh — not yet claimed`);

  log(`\n[2/4] Loading proof binary from circuits/target/alice_stealth0/proof…`);
  const proofPath = path.resolve(__dirname, "../circuits/target/alice_stealth0/proof");
  const proofBuf  = readFileSync(proofPath);
  const proofHex  = "0x" + proofBuf.toString("hex");
  log(`✓ Proof loaded: ${proofBuf.length} bytes (UltraHonk / Barretenberg)`);
  log(`  Merkle root:    ${PUBLIC_INPUTS.merkleRoot}`);
  log(`  Nullifier hash: ${PUBLIC_INPUTS.nullifierHash}`);
  log(`  Stealth addr:   ${PUBLIC_INPUTS.stealthAddr}`);
  log(`  Amount:         ${PUBLIC_INPUTS.amount.toLocaleString()} USDC`);

  const stealthEthAddr = "0x" + PUBLIC_INPUTS.stealthAddr.slice(-40);
  const vaultBalBefore = await usdc.balanceOf(VAULT) as bigint;
  log(`\n[3/4] Vault USDC before: ${Number(vaultBalBefore) / 1e6} USDC`);

  log(`\n[4/4] Calling withdrawToStealth() on ShieldVault…`);
  log(`  ShieldVault: ${VAULT}`);

  const tx = await vault.withdrawToStealth(
    proofHex,
    PUBLIC_INPUTS.merkleRoot,
    PUBLIC_INPUTS.nullifierHash,
    PUBLIC_INPUTS.stealthAddr,
    PUBLIC_INPUTS.amount,
    { gasLimit: 5_000_000 }
  );
  log(`  tx: ${tx.hash}`);
  await tx.wait(1);

  const vaultBalAfter  = await usdc.balanceOf(VAULT) as bigint;
  const stealthBal     = await usdc.balanceOf(stealthEthAddr) as bigint;
  const nullifierSpent = await vault.isNullifierSpent(PUBLIC_INPUTS.nullifierHash) as boolean;

  console.log("\n\x1b[1m" + "=".repeat(60) + "\x1b[0m");
  log(`✓ Claim successful!`);
  log(`  Vault USDC after:    ${Number(vaultBalAfter) / 1e6} USDC  (was ${Number(vaultBalBefore) / 1e6})`);
  log(`  Stealth addr USDC:   ${Number(stealthBal) / 1e6} USDC → ${stealthEthAddr}`);
  log(`  Nullifier spent:     ${nullifierSpent} (double-claim blocked)`);
  log(`\n  Remaining proofs for demo:`);
  log(`    bob_stealth0   — 1,000 USDC`);
  log(`    bob_stealth1   — 1,000 USDC`);
  log(`    carol_stealth0 — 1,000 USDC`);
  log(`    carol_stealth1 — 1,000 USDC`);
  log(`    carol_stealth2 — 1,000 USDC`);
  console.log("\x1b[1m" + "=".repeat(60) + "\x1b[0m\n");
}

main().catch((e) => { console.error("\x1b[31m[ERROR]\x1b[0m", e.message); process.exit(1); });
