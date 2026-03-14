import { NextRequest, NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth";
import { createCompanyWallet } from "@/lib/bitgo";
import { verifyENSOwnership } from "@/lib/ens";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const address = getAuthAddress(req);
  if (!address) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, pubKey, ensName } = await req.json();
  if (!name || !slug || !pubKey || !ensName) {
    return NextResponse.json(
      { error: "name, slug, pubKey, and ensName required" },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be lowercase alphanumeric with hyphens only" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  // Idempotent — return existing if already set up
  const { data: existing } = await db
    .from("companies")
    .select("*")
    .eq("wallet_address", address)
    .single();
  if (existing) return NextResponse.json({ company: existing });

  // Verify company actually owns the ENS name they claim on-chain
  const owns = await verifyENSOwnership(ensName, address);
  if (!owns) {
    return NextResponse.json(
      { error: `Wallet ${address} does not own ENS name ${ensName}` },
      { status: 403 }
    );
  }

  // Create BitGo treasury wallet
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
