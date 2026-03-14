import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const companyWallet = getAuthAddress(req);
  if (!companyWallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  const { data: company } = await db
    .from("companies")
    .select("id")
    .eq("wallet_address", companyWallet)
    .single();

  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const { data: employees, error } = await db
    .from("employees")
    .select("id, wallet_address, ens_name, status, created_at, contracts(id, fileverse_file_id, created_at)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(employees ?? []);
}
