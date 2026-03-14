import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { encryptContract, encryptWithMasterKey } from "@/lib/encryption";
import { uploadEncryptedContract } from "@/lib/fileverse";
import { setTextRecord } from "@/lib/ens";
import { supabaseAdmin } from "@/lib/supabase";
import { ethers } from "ethers";

export async function POST(req: NextRequest) {
  const companyWallet = getAuthAddress(req);
  if (!companyWallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employeeId, salary, interval } = await req.json();

  if (!employeeId || !salary || !interval) {
    return NextResponse.json({ error: "employeeId, salary, and interval required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: employee, error: empErr } = await db
    .from("employees")
    .select("id, ens_name, status, company_id, public_key")
    .eq("id", employeeId)
    .single();

  if (empErr || !employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Gate: employee must have claimed ENS and set their public key
  if (employee.status !== "claimed") {
    return NextResponse.json(
      { error: "Contract can only be issued after employee claims their ENS subdomain" },
      { status: 400 }
    );
  }
  if (!employee.public_key) {
    return NextResponse.json(
      { error: "Employee public key not found — they must set penguin.pubkey on ENS" },
      { status: 400 }
    );
  }

  // Verify the caller owns this company
  const { data: company } = await db
    .from("companies")
    .select("id, wallet_address, public_key, wallet_passphrase_enc")
    .eq("id", employee.company_id)
    .single();

  if (!company || (company.wallet_address as string).toLowerCase() !== companyWallet.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!company.public_key) {
    return NextResponse.json({ error: "Company public key not found" }, { status: 400 });
  }

  const contractPayload = {
    employeeEns: employee.ens_name,
    salary,
    interval,
    issuedAt: new Date().toISOString(),
    issuedBy: companyWallet,
  };

  // Encrypt contract with both company and employee public keys
  // Neither party needs to trust the server — only they can decrypt
  const encrypted = await encryptContract(
    contractPayload,
    company.public_key as string,
    employee.public_key as string
  );

  // Upload encrypted contract to Fileverse (IPFS via Pinata)
  const { fileId } = await uploadEncryptedContract(encrypted, {
    employeeEns: employee.ens_name as string,
    createdAt: contractPayload.issuedAt,
  });

  // Anchor: store keccak256(fileId) as text record in ENS — CID never exposed publicly
  const docHash = ethers.keccak256(ethers.toUtf8Bytes(fileId));
  await setTextRecord(employee.ens_name as string, "penguin.docHash", docHash);

  // Encrypt salary separately for cron job (server can decrypt, never goes to Fileverse)
  const amount_enc = encryptWithMasterKey(String(salary));

  const { data: contract, error } = await db
    .from("contracts")
    .insert({
      employee_id: employee.id,
      fileverse_file_id: fileId,
      doc_hash: docHash,
      amount_enc,
      interval,
      created_by_wallet: companyWallet,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Activate employee
  await db.from("employees").update({ status: "active" }).eq("id", employee.id);

  return NextResponse.json({ contract }, { status: 201 });
}
