import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const walletAddress = getAuthAddress(req);
  if (!walletAddress) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: employee, error } = await db
    .from("employees")
    .select("id, ens_name, wallet_address, status, contracts(fileverse_file_id, doc_hash, created_at)")
    .ilike("wallet_address", walletAddress)
    .single();

  if (error || !employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ employee });
}
