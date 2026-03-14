import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// Used by the employee claim page to recover their own public key from a signature,
// so they can set it as a text record on their ENS subdomain.
export async function POST(req: NextRequest) {
  const { message, signature } = await req.json();

  if (!message || !signature) {
    return NextResponse.json({ error: "message and signature required" }, { status: 400 });
  }

  try {
    const pubKey = ethers.SigningKey.recoverPublicKey(
      ethers.hashMessage(message),
      signature
    );
    return NextResponse.json({ pubKey });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
