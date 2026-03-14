import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { getEncryptedContract } from "@/lib/fileverse";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const walletAddress = getAuthAddress(req);
  if (!walletAddress) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

  const db = supabaseAdmin();

  // Verify the requester owns the contract
  const { data: contract } = await db
    .from("contracts")
    .select("id, employee_id")
    .eq("fileverse_file_id", fileId)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const { data: emp } = await db
    .from("employees")
    .select("wallet_address")
    .eq("id", contract.employee_id)
    .single();

  if (!emp || emp.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const encrypted = await getEncryptedContract(fileId);
  return NextResponse.json(encrypted);
}
