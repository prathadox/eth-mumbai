import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { getENSOwner } from "@/lib/ens";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const walletAddress = getAuthAddress(req);
  if (!walletAddress) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ensName, pubKey } = await req.json();
  if (!ensName) return NextResponse.json({ error: "ensName required" }, { status: 400 });
  if (!pubKey) return NextResponse.json({ error: "pubKey required" }, { status: 400 });

  const db = supabaseAdmin();

  const { data: employee, error: empErr } = await db
    .from("employees")
    .select("id, wallet_address, status")
    .eq("ens_name", ensName)
    .single();

  if (empErr || !employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if ((employee.wallet_address as string).toLowerCase() !== walletAddress.toLowerCase()) {
    return NextResponse.json({ error: "ENS name not assigned to this wallet" }, { status: 403 });
  }
  if (employee.status === "active") {
    return NextResponse.json({ error: "Already active" }, { status: 400 });
  }

  // Verify the employee now owns their ENS subdomain on-chain
  const currentOwner = await getENSOwner(ensName);
  if (currentOwner.toLowerCase() !== walletAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "You must claim ENS ownership on-chain first (setSubnodeOwner)" },
      { status: 400 }
    );
  }

  const { data: updated, error } = await db
    .from("employees")
    .update({ status: "claimed", public_key: pubKey })
    .eq("id", employee.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ employee: updated });
}
