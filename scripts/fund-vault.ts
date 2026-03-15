/**
 * fund-vault.ts
 *
 * End-to-end script that bridges from company BitGo treasury → ShieldVault on Base Sepolia.
 *
 * What it does:
 *  1. Fetches company data from Supabase (ENS, BitGo wallet address)
 *  2. Reads MockUSDC + ShieldVault balances
 *  3. Mints 6,000 MockUSDC to the signer wallet (demo only — replace with real USDC in prod)
 *  4. Approves ShieldVault to spend 6,000 USDC
 *  5. Calls depositBatch with all 6 pre-computed commitments
 *  6. Prints the final vault balance + Merkle root
 *
 * Usage (from repo root):
 *   cd penguin-protocol/penguin-protocol
 *   npx tsx ../../scripts/fund-vault.ts
 *
 * Env required (in penguin-protocol/.env.local):
 *   SIGNER_PRIVATE_KEY, NEXT_PUBLIC_MOCK_USDC_ADDRESS, NEXT_PUBLIC_SHIELD_VAULT_ADDRESS,
 *   NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../penguin-protocol/penguin-protocol/.env.local") });

// ──────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────
const RPC      = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL!;
const PK       = process.env.SIGNER_PRIVATE_KEY!;
const USDC     = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS!;
const VAULT    = process.env.NEXT_PUBLIC_SHIELD_VAULT_ADDRESS!;

const MOCK_USDC_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const SHIELD_VAULT_ABI = [
  "function depositBatch(bytes32[] calldata commitments, uint256[] calldata amounts) external",
  "function currentRoot() external view returns (bytes32)",
  "function isKnownRoot(bytes32 root) external view returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
  "function getNextIndex() external view returns (uint256)",
];

// All 6 commitments — same order as circuits/target proof generation
const COMMITMENTS: string[] = [
  "0x244f9073835610542a9e1a1a31a8027079f3188c17aa893d9e5ddcf7c662919c", // Alice stealth0
  "0x23151eeccdadaad87840c310af9c8ca078ccda748f0e862bc29ddb268eabbf21", // Bob   stealth0
  "0x0413629e56c72e60eee88c7546dd2c35837d241f04015bdfeb9699866d285e77", // Bob   stealth1
  "0x0ce80d0b097a2fbd88e26682d65ca9b8d0917440ec1d442649b12f62c7ce1ed4", // Carol stealth0
  "0x02bfd723d01fe4cc599225451694a1b050d377b0bc64f40610cebfc9777adaf9", // Carol stealth1
  "0x235188ecac102b3c8a40d25fe87c4c53d3690f751b1cd11acbaa4d11508ad9d4", // Carol stealth2
];
const AMOUNTS = [1000n, 1000n, 1000n, 1000n, 1000n, 1000n]; // USDC (pre-decimal)
const TOTAL   = 6000n;
const EXPECTED_ROOT = "0x16724eb551f43b3b9161b5b6fef99436f59bb8ed8d832da843c1147cf341cef7";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function fmt(raw: bigint, decimals = 6): string {
  return (Number(raw) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

async function getCompanyInfo() {
  // Read company from Supabase
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${url}/rest/v1/companies?select=ens_name,wallet_address,bitgo_wallet_id,bitgo_receive_address&limit=3`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
  });
  if (!res.ok) {
    console.warn("  Could not fetch companies from Supabase:", await res.text());
    return [];
  }
  return (await res.json()) as { ens_name: string; wallet_address: string; bitgo_wallet_id: string; bitgo_receive_address: string }[];
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  ShieldPay — Fund Vault Script");
  console.log("=".repeat(60));

  // ── 1. Company data
  console.log("\n[1/5] Reading company data from Supabase…");
  const companies = await getCompanyInfo();
  if (companies.length === 0) {
    console.log("  No companies in DB (continuing with signer wallet)");
  } else {
    for (const c of companies) {
      console.log(`  ENS: ${c.ens_name}`);
      console.log(`  Wallet: ${c.wallet_address}`);
      console.log(`  BitGo Wallet ID: ${c.bitgo_wallet_id ?? "—"}`);
      console.log(`  BitGo Receive:   ${c.bitgo_receive_address ?? "—"}`);
    }
  }

  // ── 2. Setup provider + signer
  console.log(`\n[2/5] Connecting to Base Sepolia (${RPC})…`);
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(PK, provider);
  const network  = await provider.getNetwork();
  const balance  = await provider.getBalance(signer.address);
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`  ETH bal: ${ethers.formatEther(balance)} ETH`);

  const usdc  = new ethers.Contract(USDC, MOCK_USDC_ABI, signer);
  const vault = new ethers.Contract(VAULT, SHIELD_VAULT_ABI, signer);

  const usdcBal     = await usdc.balanceOf(signer.address) as bigint;
  const vaultBal    = await usdc.balanceOf(VAULT) as bigint;
  const nextIndex   = await vault.getNextIndex() as bigint;
  const currentRoot = await vault.currentRoot() as string;

  console.log(`\n  MockUSDC contract: ${USDC}`);
  console.log(`  ShieldVault:       ${VAULT}`);
  console.log(`  Signer USDC:   ${fmt(usdcBal)} USDC`);
  console.log(`  Vault USDC:    ${fmt(vaultBal)} USDC`);
  console.log(`  Tree nextIndex: ${nextIndex}`);
  console.log(`  Current root:  ${currentRoot}`);

  if (nextIndex >= 6n) {
    console.log("\n⚠  Vault already has ≥6 leaves. Commitments were already deposited.");
    console.log("   Expected root:", EXPECTED_ROOT);
    console.log("   Current root: ", currentRoot);
    const match = currentRoot.toLowerCase() === EXPECTED_ROOT.toLowerCase();
    console.log(`   Root matches proofs: ${match ? "✓ YES" : "✗ NO — proofs will fail"}`);
    return;
  }

  // Use explicit nonces to avoid caching issues
  let nonce = await provider.getTransactionCount(signer.address, "pending");

  // ── 3. Mint MockUSDC (demo only)
  console.log(`\n[3/5] Minting ${TOTAL.toLocaleString()} MockUSDC to signer… (nonce=${nonce})`);
  const mintTx = await usdc.mint(signer.address, TOTAL * BigInt(1e6), { nonce: nonce++ });
  await mintTx.wait();
  console.log(`  ✓ tx: ${mintTx.hash}`);
  const newBal = await usdc.balanceOf(signer.address) as bigint;
  console.log(`  Signer USDC after mint: ${fmt(newBal)} USDC`);

  // ── 4. Approve ShieldVault
  const neededAllowance = TOTAL * BigInt(1e6);
  const existingAllowance = await usdc.allowance(signer.address, VAULT) as bigint;
  console.log(`\n[4/5] Checking allowance… existing: ${fmt(existingAllowance)} USDC`);

  if (existingAllowance < neededAllowance) {
    console.log(`  Approving ShieldVault to spend ${TOTAL.toLocaleString()} USDC… (nonce=${nonce})`);
    const approveTx = await usdc.approve(VAULT, neededAllowance, { nonce: nonce++ });
    await approveTx.wait();
    console.log(`  ✓ tx: ${approveTx.hash}`);
    // Wait for RPC to propagate
    await new Promise((r) => setTimeout(r, 4000));
    const confirmedAllowance = await usdc.allowance(signer.address, VAULT) as bigint;
    console.log(`  Confirmed allowance: ${fmt(confirmedAllowance)} USDC`);
    if (confirmedAllowance < neededAllowance) {
      throw new Error(`Allowance not confirmed after approve tx. Got: ${confirmedAllowance}`);
    }
  } else {
    console.log(`  Already approved (${fmt(existingAllowance)} USDC) — skipping`);
  }

  // ── 5. depositBatch
  console.log(`\n[5/5] Calling depositBatch with 6 commitments… (nonce=${nonce})`);
  console.log("  Commitments:");
  COMMITMENTS.forEach((c, i) => {
    const labels = ["Alice stealth0","Bob stealth0","Bob stealth1","Carol stealth0","Carol stealth1","Carol stealth2"];
    console.log(`    [${i}] ${labels[i]}: ${c.slice(0, 14)}…`);
  });

  const depositTx = await vault.depositBatch(COMMITMENTS, AMOUNTS, { nonce: nonce++ });
  await depositTx.wait(2); // wait 2 confirmations
  console.log(`  ✓ tx: ${depositTx.hash}`);
  console.log("  Waiting 6s for RPC state propagation…");
  await new Promise((r) => setTimeout(r, 6000));

  // ── Final state
  const finalVaultBal = await usdc.balanceOf(VAULT) as bigint;
  const finalRoot     = await vault.currentRoot() as string;
  const rootKnown     = await vault.isKnownRoot(EXPECTED_ROOT) as boolean;

  console.log("\n" + "=".repeat(60));
  console.log("  Done!");
  console.log("=".repeat(60));
  console.log(`  Vault balance:     ${fmt(finalVaultBal)} USDC`);
  console.log(`  Final Merkle root: ${finalRoot}`);
  console.log(`  Expected root:     ${EXPECTED_ROOT}`);
  console.log(`  Root matches ZK proofs: ${rootKnown ? "✓ YES — employees can claim" : "✗ NO"}`);
  console.log("\n  Employees can now claim on /employee/contracts → ShieldPay Vault section");
}

main().catch((e) => {
  console.error("\n[ERROR]", e.message ?? e);
  process.exit(1);
});
