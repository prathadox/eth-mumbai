import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// The company calls this AFTER they have already called setSubnodeOwner from
// their own wallet on the frontend, creating alice.acme.penguin.eth → employeeWallet.
// This route just records the employee in the DB.
export async function POST(req: NextRequest) {
  const companyWallet = getAuthAddress(req);
  if (!companyWallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employeeWallet, ensName } = await req.json();
  if (!employeeWallet || !ensName) {
    return NextResponse.json({ error: "employeeWallet and ensName required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: company, error: companyErr } = await db
    .from("companies")
    .select("id, ens_name")
    .eq("wallet_address", companyWallet)
    .single();

  if (companyErr || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Ensure the ensName is actually under this company's domain
  if (!ensName.endsWith(`.${company.ens_name}`)) {
    return NextResponse.json(
      { error: `ensName must be a subdomain of ${company.ens_name}` },
      { status: 400 }
    );
  }

  const { data: employee, error } = await db
    .from("employees")
    .insert({
      company_id: company.id,
      wallet_address: employeeWallet,
      ens_name: ensName,
      status: "invited",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ employee }, { status: 201 });
}
