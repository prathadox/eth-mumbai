import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { createCompanyWallet } from "@/lib/bitgo";
import { issueCompanyENS } from "@/lib/ens";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const address = getAuthAddress(req);
  if (!address) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, pubKey } = await req.json();
  if (!name || !slug || !pubKey) {
    return NextResponse.json({ error: "name, slug, and pubKey required" }, { status: 400 });
  }

  // slug must be lowercase alphanumeric
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens only" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Idempotent — return existing company if already set up
  const { data: existing } = await db
    .from("companies")
    .select("*")
    .eq("wallet_address", address)
    .single();

  if (existing) return NextResponse.json({ company: existing });

  // Issue ENS subdomain: {slug}.{ENS_ROOT_DOMAIN}
  // Our backend signer owns the root and retains ownership of company subdomain
  // (company wallet identity is tied to their Ethereum wallet, not ENS ownership)
  const ensName = await issueCompanyENS(slug, address);

  // Create BitGo treasury wallet for this company
  const { walletId, receiveAddress, encryptedPassphrase } =
    await createCompanyWallet(name);

  const { data: company, error } = await db
    .from("companies")
    .insert({
      name,
      slug,
      wallet_address: address,
      public_key: pubKey,
      ens_name: ensName,
      bitgo_wallet_id: walletId,
      bitgo_receive_address: receiveAddress,
      wallet_passphrase_enc: encryptedPassphrase,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ company }, { status: 201 });
}
