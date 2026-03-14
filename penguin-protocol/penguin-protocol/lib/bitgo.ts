import { BitGoAPI } from "@bitgo/sdk-api";
import { Eth } from "@bitgo/sdk-coin-eth";
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
  _bitgo.register("eth", Eth.createInstance);
  return _bitgo;
}

export async function createCompanyWallet(companyName: string): Promise<{
  walletId: string;
  receiveAddress: string;
  encryptedPassphrase: string;
}> {
  const bitgo = getBitGo();
  const coin = process.env.BITGO_COIN!;

  // Generate a unique passphrase per company — stored encrypted in DB
  const passphrase = randomBytes(24).toString("hex");

  const result = await bitgo.coin(coin).wallets().generateWallet({
    label: `${companyName} Treasury`,
    passphrase,
    enterprise: process.env.BITGO_ENTERPRISE_ID!,
  });

  const wallet = result.wallet;
  const addressResult = await wallet.createAddress();

  return {
    walletId: wallet.id(),
    receiveAddress: addressResult.address,
    encryptedPassphrase: encryptWithMasterKey(passphrase),
  };
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
