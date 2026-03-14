import { NextRequest, NextResponse } from "next/server";
import { verifySiweAndIssueJWT } from "@/lib/auth";
import { ethers } from "ethers";

export async function POST(req: NextRequest) {
  const { message, signature } = await req.json();

  if (!message || !signature) {
    return NextResponse.json({ error: "message and signature required" }, { status: 400 });
  }

  try {
    const token = await verifySiweAndIssueJWT(message, signature);

    // Recover secp256k1 public key from the SIWE signature
    // This is the uncompressed public key (0x04...) used for ECIES encryption
    const pubKey = ethers.SigningKey.recoverPublicKey(
      ethers.hashMessage(message),
      signature
    );

    return NextResponse.json({ token, pubKey });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
