import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  try {
    const nonce = await generateNonce(address);
    return NextResponse.json({ nonce });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
