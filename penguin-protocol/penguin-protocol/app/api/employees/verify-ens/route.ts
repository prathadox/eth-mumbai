import { NextRequest, NextResponse } from "next/server";
import { getENSOwner } from "@/lib/ens";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const ensName = req.nextUrl.searchParams.get("ensName");
  const address = req.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { valid: false, error: "address required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  // Address-only lookup: find employee by wallet address in DB
  if (!ensName) {
    const { data: employee, error: empErr } = await db
      .from("employees")
      .select("id, ens_name, status")
      .eq("wallet_address", address.toLowerCase())
      .single();

    if (empErr || !employee) {
      return NextResponse.json(
        { valid: false, error: "No ENS subdomain found for this wallet. Get invited by your company first." },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valid: true,
      status: employee.status,
      ensName: employee.ens_name,
    });
  }

  // ensName + address: verify ownership on-chain
  const { data: employee, error: empErr } = await db
    .from("employees")
    .select("id, wallet_address, status")
    .eq("ens_name", ensName.trim().toLowerCase())
    .single();

  if (empErr || !employee) {
    return NextResponse.json(
      { valid: false, error: "ENS subdomain not found. Get invited by your company first." },
      { status: 200 }
    );
  }

  const currentOwner = await getENSOwner(ensName.trim().toLowerCase());
  if (currentOwner.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { valid: false, error: "Your wallet does not own this ENS subdomain." },
      { status: 200 }
    );
  }

  return NextResponse.json({
    valid: true,
    status: employee.status,
    ensName: ensName.trim().toLowerCase(),
  });
}
