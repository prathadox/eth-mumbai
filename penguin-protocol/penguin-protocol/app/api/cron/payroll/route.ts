import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptWithMasterKey } from "@/lib/encryption";
import { sendPayroll } from "@/lib/bitgo";

// How many milliseconds must pass before next payment is due
const INTERVAL_MS: Record<string, number> = {
  weekly:   7  * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly:  30 * 24 * 60 * 60 * 1000,
};

// USDC has 6 decimals. On BitGo testnet we send tETH (18 decimals).
// For demo: treat salary number as a small tETH amount in wei directly (1 unit = 1e9 wei = 1 gwei)
// e.g. salary=5000 → 5000 gwei → trivial testnet amount, proves the flow works
function salaryToWei(salaryUsdc: number): string {
  return BigInt(salaryUsdc) * BigInt(1e9) + ""; // gwei scale for testnet
}

function isDue(lastPaidAt: string | null, interval: string): boolean {
  if (!lastPaidAt) return true; // never paid → always due
  const ms = INTERVAL_MS[interval] ?? INTERVAL_MS.monthly;
  return Date.now() - new Date(lastPaidAt).getTime() >= ms;
}

// POST /api/cron/payroll
// Called by Vercel Cron / GitHub Actions / Upstash on a schedule
// Protected by Authorization: Bearer CRON_SECRET
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  // Pull all active contracts with employee wallet + company BitGo credentials
  const { data: contracts, error } = await db
    .from("contracts")
    .select(`
      id,
      amount_enc,
      interval,
      last_paid_at,
      employees (
        wallet_address,
        companies (
          bitgo_wallet_id,
          wallet_passphrase_enc
        )
      )
    `)
    .not("amount_enc", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contracts || contracts.length === 0) {
    return NextResponse.json({ processed: 0, skipped: 0 });
  }

  type CompanyData = { bitgo_wallet_id: string; wallet_passphrase_enc: string };
  type EmpData = { wallet_address: string; companies: CompanyData | CompanyData[] };

  const results: { contractId: number; status: string; txid?: string; error?: string }[] = [];

  for (const c of contracts) {
    const contractId = c.id as number;

    // Skip if not due yet based on interval
    if (!isDue(c.last_paid_at as string | null, c.interval as string)) {
      results.push({ contractId, status: "skipped — not due" });
      continue;
    }

    try {
      // Unwrap Supabase nested join — employees is an array from the join
      const empRaw = c.employees as unknown as EmpData | EmpData[];
      const emp: EmpData = Array.isArray(empRaw) ? empRaw[0] : empRaw;
      if (!emp) throw new Error("Employee data missing");

      const compRaw = emp.companies;
      const company: CompanyData = Array.isArray(compRaw) ? compRaw[0] : compRaw;
      if (!company?.bitgo_wallet_id) throw new Error("Company BitGo wallet missing");

      const salaryUsdc = Number(decryptWithMasterKey(c.amount_enc as string));
      const amountWei = salaryToWei(salaryUsdc);

      const txid = await sendPayroll(
        company.bitgo_wallet_id,
        company.wallet_passphrase_enc,
        emp.wallet_address,
        amountWei
      );

      // Update last_paid_at so next run knows when this was paid
      await db
        .from("contracts")
        .update({ last_paid_at: new Date().toISOString() })
        .eq("id", contractId);

      results.push({ contractId, status: "paid", txid });
    } catch (e: unknown) {
      results.push({ contractId, status: "error", error: (e as Error).message });
    }
  }

  const paid    = results.filter((r) => r.status === "paid").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped")).length;
  const failed  = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ paid, skipped, failed, results });
}
