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
    // Derive a deterministic key pair from the signature's r value.
    // r is a valid secp256k1 scalar — use it as the private key for ECIES.
    // This way the user never exposes their actual wallet private key.
    const sig = ethers.Signature.from(signature);
    const derivedPrivKey = sig.r; // 0x + 64 hex chars (32 bytes)
    const pubKey = new ethers.SigningKey(derivedPrivKey).publicKey;
    return NextResponse.json({ pubKey, derivedPrivKey });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
