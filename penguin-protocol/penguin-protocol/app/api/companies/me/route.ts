import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const address = getAuthAddress(req);
  if (!address) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  const { data: company, error } = await db
    .from("companies")
    .select("id, name, slug, ens_name, bitgo_wallet_id, bitgo_receive_address")
    .eq("wallet_address", address)
    .single();

  if (error || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({ company });
}
