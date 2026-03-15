/**
 * check-nullifiers.ts
 *
 * Read-only — checks which proofs are still claimable on-chain.
 * Does NOT submit any transactions.
 *
 * Usage:
 *   node_modules/.bin/tsx scripts/check-nullifiers.ts
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../penguin-protocol/penguin-protocol/.env.local") });

const RPC   = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!;
const VAULT = process.env.NEXT_PUBLIC_SHIELD_VAULT_ADDRESS!;
const VAULT_ABI = ["function isNullifierSpent(bytes32) external view returns (bool)"];

async function main() {
  const indexPath = path.resolve(__dirname, "generated-data/proofs/proof-index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(RPC);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, provider);

  console.log("\n\x1b[1mNullifier Status — ShieldVault @ " + VAULT + "\x1b[0m\n");

  let fresh = 0;
  for (const p of index.proofs) {
    const spent = await vault.isNullifierSpent(p.publicInputs.nullifierHash) as boolean;
    const tag = spent ? "\x1b[31m✗ SPENT\x1b[0m " : "\x1b[34m✓ FRESH\x1b[0m ";
    console.log(`  ${tag}  ${p.key.padEnd(16)}  nullifier: ${p.publicInputs.nullifierHash.slice(0, 14)}…`);
    if (!spent) fresh++;
  }

  console.log(`\n  ${fresh} of ${index.proofs.length} proofs still claimable\n`);
}

main().catch((e) => { console.error("\x1b[31m[ERROR]\x1b[0m", e.message); process.exit(1); });
