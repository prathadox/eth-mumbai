import { BitGoAPI } from "@bitgo/sdk-api";
import { Eth, Hteth } from "@bitgo/sdk-coin-eth";
import { randomBytes } from "crypto";
import { encryptWithMasterKey, decryptWithMasterKey } from "./encryption";

let _bitgo: BitGoAPI | null = null;

function getBitGo(): BitGoAPI {
  if (_bitgo) return _bitgo;
  _bitgo = new BitGoAPI({
    accessToken: process.env.BITGO_ACCESS_TOKEN!,
    env: (process.env.BITGO_ENV as "test" | "prod") ?? "test",
  });
  _bitgo.register("teth", Eth.createInstance);
  _bitgo.register("hteth", Hteth.createInstance);
  _bitgo.register("eth", Eth.createInstance);
  return _bitgo;
}

export async function getTokenInfo(): Promise<{ enterprise?: string; env: string; raw?: unknown } | null> {
  try {
    const base = process.env.BITGO_ENV === "prod" ? "https://app.bitgo.com" : "https://app.bitgo-test.com";
    const res = await fetch(`${base}/api/v2/user/session`, {
      headers: { Authorization: `Bearer ${process.env.BITGO_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const enterprise =
      (data?.user as Record<string, unknown>)?.enterprise as string | { id?: string } | undefined;
    const enterpriseId = typeof enterprise === "string" ? enterprise : enterprise?.id;
    return { enterprise: enterpriseId, env: process.env.BITGO_ENV ?? "test", raw: data };
  } catch {
    return null;
  }
}

export async function createCompanyWallet(companyName: string): Promise<{
  walletId: string;
  receiveAddress: string;
  encryptedPassphrase: string;
}> {
  const bitgo = getBitGo();
  const coin = process.env.BITGO_COIN!;
  const env = process.env.BITGO_ENV ?? "test";

  // Use enterprise from session (token scope) if env one fails — token is locked to its enterprise
  let enterpriseId = process.env.BITGO_ENTERPRISE_ID;
  const info = await getTokenInfo();
  if (info?.enterprise) {
    enterpriseId = info.enterprise; // session enterprise = token's scope, use it
  }
  if (!enterpriseId) {
    throw new Error(
      "No enterprise. Set BITGO_ENTERPRISE_ID or ensure your token has enterprise scope. Create org at " +
        (env === "test" ? "https://app.bitgo-test.com" : "https://app.bitgo.com")
    );
  }

  const passphrase = randomBytes(24).toString("hex");

  try {
    const result = await bitgo.coin(coin).wallets().generateWallet({
      label: `${companyName} Treasury`,
      passphrase,
      enterprise: enterpriseId,
      walletVersion: 3,
    });

    const wallet = result.wallet;
    const addressResult = await wallet.createAddress();

    return {
      walletId: wallet.id(),
      receiveAddress: addressResult.address,
      encryptedPassphrase: encryptWithMasterKey(passphrase),
    };
  } catch (e: unknown) {
    const msg = (e as Error).message;
    if (msg.includes("invalid enterprise id")) {
      throw new Error(
        `BitGo: invalid enterprise id. With BITGO_ENV=${env}, use the enterprise ID from ` +
          (env === "test" ? "https://app.bitgo-test.com" : "https://app.bitgo.com") +
          " → Manage Organization. Test and prod enterprises are separate. Run GET /api/bitgo/debug to see your token's enterprise. Original: " +
          msg
      );
    }
    throw e;
  }
}

export async function getWallet(walletId: string) {
  const bitgo = getBitGo();
  return bitgo.coin(process.env.BITGO_COIN!).wallets().get({ id: walletId });
}

// Used by the payroll cron job
export async function sendPayroll(
  walletId: string,
  encryptedPassphrase: string,
  recipientAddress: string,
  amountInWei: string // base-unit string, e.g. "1000000000000000000" for 1 ETH
): Promise<string> {
  const bitgo = getBitGo();
  const coin = process.env.BITGO_COIN!;

  const passphrase = decryptWithMasterKey(encryptedPassphrase);
  const wallet = await bitgo.coin(coin).wallets().get({ id: walletId });

  const tx = await wallet.sendMany({
    recipients: [{ address: recipientAddress, amount: amountInWei }],
    walletPassphrase: passphrase,
  });

  return (tx as { txid?: string; hash?: string }).txid ??
    (tx as { txid?: string; hash?: string }).hash ??
    "";
}
