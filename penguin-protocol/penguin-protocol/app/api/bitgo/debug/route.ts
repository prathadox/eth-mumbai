import { NextResponse } from "next/server";
import { getTokenInfo } from "@/lib/bitgo";

export async function GET() {
  try {
    const info = await getTokenInfo();
    const env = process.env.BITGO_ENV ?? "test";
    const enterpriseId = process.env.BITGO_ENTERPRISE_ID ?? "(not set)";

    return NextResponse.json({
      env,
      BITGO_ENTERPRISE_ID: enterpriseId,
      tokenEnterprise: info?.enterprise ?? "(could not fetch - check session response)",
      hint:
        info?.enterprise && enterpriseId !== info.enterprise
          ? `Use BITGO_ENTERPRISE_ID=${info.enterprise} (from your token's session)`
          : env === "test"
          ? "Enterprise must be from https://app.bitgo-test.com → Manage Organization. Test ≠ prod."
          : "Enterprise must be from https://app.bitgo.com",
      session: info?.raw,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
