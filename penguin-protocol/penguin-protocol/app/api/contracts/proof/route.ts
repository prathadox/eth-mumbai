import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

interface ProofEntry {
  key: string;
  employee: string;
  stealthIndex: number;
  proofPath: string;
  publicInputs: {
    merkleRoot: string;
    nullifierHash: string;
    stealthAddress: string;
    amount: string;
  };
}

interface ProofIndex {
  proofs: ProofEntry[];
}

// GET /api/contracts/proof?key=alice_stealth0
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  try {
    const indexPath = process.env.PROOF_INDEX_PATH!;
    const index: ProofIndex = JSON.parse(readFileSync(indexPath, "utf8"));
    const entry = index.proofs.find((p) => p.key === key);
    if (!entry) return NextResponse.json({ error: `Proof not found: ${key}` }, { status: 404 });

    const proofPath = entry.proofPath.startsWith("/")
      ? entry.proofPath
      : path.join(process.cwd(), entry.proofPath);

    const proofBuf = readFileSync(proofPath);
    const proofHex = "0x" + proofBuf.toString("hex");

    return NextResponse.json({
      proofHex,
      publicInputs: entry.publicInputs,
      employee: entry.employee,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
