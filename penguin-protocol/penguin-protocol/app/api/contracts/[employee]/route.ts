import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employee: string }> }
) {
  const walletAddress = getAuthAddress(req);
  if (!walletAddress) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employee: employeeParam } = await params;
  const db = supabaseAdmin();

  // employeeParam can be a wallet address or ENS name
  const isENS = employeeParam.includes(".");
  const query = db
    .from("employees")
    .select("id, ens_name, wallet_address, status, contracts(fileverse_file_id, doc_hash, created_at)")
    .single();

  const { data: employee, error } = isENS
    ? await db
        .from("employees")
        .select("id, ens_name, wallet_address, status, contracts(fileverse_file_id, doc_hash, created_at)")
        .eq("ens_name", employeeParam)
        .single()
    : await db
        .from("employees")
        .select("id, ens_name, wallet_address, status, contracts(fileverse_file_id, doc_hash, created_at)")
        .eq("wallet_address", employeeParam)
        .single();

  if (error || !employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the employee themselves or a company admin can read contracts
  if (employee.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ employee });
}
