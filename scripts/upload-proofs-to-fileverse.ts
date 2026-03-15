/**
 * Uploads the 6 pre-generated ZK proof binaries to Fileverse and
 * logs the resulting file IDs (save them in your DB / .env as needed).
 *
 * Usage:
 *   cd penguin-protocol/penguin-protocol
 *   npx tsx ../../scripts/upload-proofs-to-fileverse.ts
 */
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../penguin-protocol/penguin-protocol/.env.local") });

// Dynamic import after env is loaded
async function main() {
  const { uploadProof } = await import("../penguin-protocol/penguin-protocol/lib/fileverse");

  const indexPath = path.resolve(__dirname, "generated-data/proofs/proof-index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf8"));

  const results: Record<string, string> = {};

  for (const entry of index.proofs) {
    const proofBuf = readFileSync(entry.proofPath);
    const proofHex = "0x" + proofBuf.toString("hex");

    console.log(`[upload] ${entry.key} (${proofBuf.length} bytes)…`);
    const { fileId } = await uploadProof(proofHex, {
      key: entry.key,
      employee: entry.employee,
      nullifierHash: entry.publicInputs.nullifierHash,
      stealthAddress: entry.publicInputs.stealthAddress,
      merkleRoot: entry.publicInputs.merkleRoot,
      amount: Number(entry.publicInputs.amount),
    });
    results[entry.key] = fileId;
    console.log(`  ✓ fileId: ${fileId}`);
  }

  console.log("\n=== Proof File IDs ===");
  console.log(JSON.stringify(results, null, 2));
  console.log("\nAdd these to your DB zk_proofs table or .env.local");
}

main().catch((e) => { console.error(e); process.exit(1); });
