import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import path from "path";

const VAULT_ABI = [
  "function withdrawToStealth(bytes calldata proof, bytes32 merkleRoot, bytes32 nullifierHash, bytes32 stealthFieldElement, uint256 amount) external",
  "function isNullifierSpent(bytes32 nullifier) external view returns (bool)",
];

// POST /api/contracts/claim  { key: "bob_stealth0" }
export async function POST(req: NextRequest) {
  const { key } = await req.json();
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  try {
    const indexPath = process.env.PROOF_INDEX_PATH!;
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    const entry = index.proofs.find((p: { key: string }) => p.key === key);
    if (!entry) return NextResponse.json({ error: `Proof not found: ${key}` }, { status: 404 });

    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY!, provider);
    const vault = new ethers.Contract(process.env.NEXT_PUBLIC_SHIELD_VAULT_ADDRESS!, VAULT_ABI, signer);

    const spent = await vault.isNullifierSpent(entry.publicInputs.nullifierHash) as boolean;
    if (spent) return NextResponse.json({ error: "Nullifier already spent — already claimed" }, { status: 409 });

    const proofPath = entry.proofPath.startsWith("/")
      ? entry.proofPath
      : path.join(process.cwd(), entry.proofPath);
    const proofHex = "0x" + readFileSync(proofPath).toString("hex");

    const tx = await vault.withdrawToStealth(
      proofHex,
      entry.publicInputs.merkleRoot,
      entry.publicInputs.nullifierHash,
      entry.publicInputs.stealthAddress,
      BigInt(entry.publicInputs.amount),
      { gasLimit: 5_000_000 }
    );

    const receipt = await tx.wait(1);
    if (receipt.status !== 1) {
      return NextResponse.json({ error: `Transaction reverted in block ${receipt.blockNumber}` }, { status: 500 });
    }

    return NextResponse.json({
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      nullifierHash: entry.publicInputs.nullifierHash,
      amount: entry.publicInputs.amount,
    });
  } catch (e: unknown) {
    console.error("[claim]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
