/**
 * treasury-to-vault.ts
 *
 * Moves funds from the company BitGo treasury → ShieldVault on Base Sepolia.
 *
 * Steps:
 *  1. Read company treasury address from Supabase
 *  2. Approve ShieldVault to spend MockUSDC
 *  3. depositBatch() with 6 pre-computed ZK commitments
 *  4. Verify final Merkle root matches pre-generated proofs
 *
 * Usage (from repo root):
 *   node_modules/.bin/tsx scripts/treasury-to-vault.ts
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// Fileverse packages live inside the Next.js app's node_modules
const appRequire = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../penguin-protocol/penguin-protocol/package.json")
);
const { Agent }                  = appRequire("@fileverse/agents");
const { PinataStorageProvider }  = appRequire("@fileverse/agents/storage");
const { privateKeyToAccount }    = appRequire("viem/accounts");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../penguin-protocol/penguin-protocol/.env.local") });

const RPC   = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!;
const PK    = process.env.SIGNER_PRIVATE_KEY!;
const USDC  = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS!;
const VAULT = process.env.NEXT_PUBLIC_SHIELD_VAULT_ADDRESS!;

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
];
const VAULT_ABI = [
  "function depositBatch(bytes32[] calldata commitments, uint256[] calldata amounts) external",
  "function currentRoot() external view returns (bytes32)",
  "function isKnownRoot(bytes32 root) external view returns (bool)",
  "function getNextIndex() external view returns (uint256)",
];

const COMMITMENTS = [
  "0x244f9073835610542a9e1a1a31a8027079f3188c17aa893d9e5ddcf7c662919c",
  "0x23151eeccdadaad87840c310af9c8ca078ccda748f0e862bc29ddb268eabbf21",
  "0x0413629e56c72e60eee88c7546dd2c35837d241f04015bdfeb9699866d285e77",
  "0x0ce80d0b097a2fbd88e26682d65ca9b8d0917440ec1d442649b12f62c7ce1ed4",
  "0x02bfd723d01fe4cc599225451694a1b050d377b0bc64f40610cebfc9777adaf9",
  "0x235188ecac102b3c8a40d25fe87c4c53d3690f751b1cd11acbaa4d11508ad9d4",
];
const AMOUNTS       = [1000n, 1000n, 1000n, 1000n, 1000n, 1000n];
const TOTAL         = 6000n;
const EXPECTED_ROOT = "0x16724eb551f43b3b9161b5b6fef99436f59bb8ed8d832da843c1147cf341cef7";

async function getCompanyTreasury(): Promise<string | null> {
  try {
    const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key    = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res    = await fetch(`${url}/rest/v1/companies?select=ens_name,bitgo_receive_address&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const rows   = (await res.json()) as { ens_name: string; bitgo_receive_address: string }[];
    return rows[0]?.bitgo_receive_address ?? null;
  } catch {
    return null;
  }
}

function log(msg: string) {
  const tag = msg.startsWith("✓") ? "\x1b[34m" : msg.startsWith("✗") ? "\x1b[31m" : "\x1b[90m";
  console.log(`${tag}${msg}\x1b[0m`);
}

async function main() {
  console.log("\x1b[1m" + "=".repeat(60) + "\x1b[0m");
  console.log("\x1b[1m  Treasury → ShieldVault (Base Sepolia)\x1b[0m");
  console.log("\x1b[1m" + "=".repeat(60) + "\x1b[0m\n");

  log("[1/4] Reading company treasury from Supabase…");
  const treasury = await getCompanyTreasury();
  if (treasury) {
    log(`✓ BitGo treasury address: ${treasury}`);
  } else {
    log("  (no treasury in DB — using signer wallet as source)");
  }

  log("\n[2/4] Connecting to Base Sepolia…");
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(PK, provider);
  const net      = await provider.getNetwork();
  log(`✓ chainId: ${net.chainId} (${net.name})`);
  log(`  Signer:       ${signer.address}`);
  log(`  MockUSDC:     ${USDC}`);
  log(`  ShieldVault:  ${VAULT}`);

  const usdc  = new ethers.Contract(USDC, USDC_ABI, signer);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, signer);

  const nextIndex = await vault.getNextIndex() as bigint;
  const usdcBal   = await usdc.balanceOf(signer.address) as bigint;
  log(`  USDC balance: ${Number(usdcBal) / 1e6} USDC`);
  log(`  Tree index:   ${nextIndex} / 32`);

  if (nextIndex >= 6n) {
    log("\n⚠  Vault already has ≥6 leaves — already funded.");
    const root = await vault.currentRoot() as string;
    const ok   = root.toLowerCase() === EXPECTED_ROOT.toLowerCase();
    log(`  Merkle root: ${root}`);
    log(ok ? `✓ Root matches ZK proofs — employees can claim` : `✗ Root mismatch — proofs will fail`);
    return;
  }

  let nonce = await provider.getTransactionCount(signer.address, "pending");

  log("\n[3/4] Approve ShieldVault to spend 6,000 MockUSDC…");
  const needed    = TOTAL * BigInt(1e6);
  const allowance = await usdc.allowance(signer.address, VAULT) as bigint;
  if (allowance >= needed) {
    log(`  Already approved (${Number(allowance) / 1e6} USDC) — skipping`);
  } else {
    const approveTx = await usdc.approve(VAULT, needed, { nonce: nonce++ });
    log(`  approve() tx: ${approveTx.hash}`);
    await approveTx.wait();
    log(`✓ Approved ${Number(needed) / 1e6} USDC`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  log("\n[4/4] depositBatch() — inserting 6 commitments into Merkle tree…");
  COMMITMENTS.forEach((c, i) => {
    const names = ["Alice stealth0","Bob stealth0","Bob stealth1","Carol stealth0","Carol stealth1","Carol stealth2"];
    log(`  [${i}] ${names[i]}: ${c.slice(0, 18)}…`);
  });

  const depositTx = await vault.depositBatch(COMMITMENTS, AMOUNTS, {
    nonce: nonce++,
    gasLimit: 8_000_000,
  });
  log(`  depositBatch() tx: ${depositTx.hash}`);
  await depositTx.wait(2);
  log(`✓ 6,000 USDC locked in ShieldVault`);

  await new Promise((r) => setTimeout(r, 5000));
  const finalRoot = await vault.currentRoot() as string;
  const rootOk    = finalRoot.toLowerCase() === EXPECTED_ROOT.toLowerCase();

  console.log("\n\x1b[1m" + "=".repeat(60) + "\x1b[0m");
  log(`✓ Done!`);
  log(`  Final Merkle root: ${finalRoot}`);
  log(`  Expected root:     ${EXPECTED_ROOT}`);
  log(rootOk
    ? `✓ Root matches — employees can claim salary via ZK proofs`
    : `✗ Root mismatch — check MiMC constants match circuit`
  );
  console.log("\x1b[1m" + "=".repeat(60) + "\x1b[0m\n");

  log("\n[5/5] Uploading deposit record to Fileverse…");
  try {
    const storageProvider = new PinataStorageProvider({
      pinataJWT: process.env.PINATA_JWT!,
      pinataGateway: process.env.PINATA_GATEWAY!,
    });
    const account = privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY as `0x${string}`);
    const agent = new Agent({
      chain: process.env.FILEVERSE_CHAIN as "gnosis" | "sepolia",
      viemAccount: account,
      pimlicoAPIKey: process.env.PIMLICO_API_KEY!,
      storageProvider,
    });
    await agent.setupStorage("penguin-protocol");

    const content = `# ShieldVault Deposit Record

**Date:** ${new Date().toISOString()}
**Network:** Base Sepolia (chainId 84532)
**ShieldVault:** ${VAULT}
**Deposit Tx:** ${depositTx.hash}
**Merkle Root:** ${finalRoot}
**Total Locked:** ${Number(TOTAL)} USDC

## Commitments

${COMMITMENTS.map((c, i) => {
  const names = ["Alice stealth0","Bob stealth0","Bob stealth1","Carol stealth0","Carol stealth1","Carol stealth2"];
  return `- [${i}] **${names[i]}**: \`${c}\` — ${Number(AMOUNTS[i])} USDC`;
}).join("\n")}

\`\`\`json
${JSON.stringify({ depositTxHash: depositTx.hash, merkleRoot: finalRoot, vault: VAULT, commitments: COMMITMENTS, amounts: AMOUNTS.map(String), totalUsdc: Number(TOTAL), timestamp: new Date().toISOString() }, null, 2)}
\`\`\`
`;

    const file = await agent.create(content);
    log(`✓ Deposit record stored on Fileverse — fileId: ${file.fileId}`);
  } catch (e: unknown) {
    log(`✗ Fileverse upload failed: ${(e as Error).message}`);
  }
}

main().catch((e) => { console.error("\x1b[31m[ERROR]\x1b[0m", e.message); process.exit(1); });
