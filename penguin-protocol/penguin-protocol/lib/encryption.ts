import EthCrypto from "eth-crypto";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ethers } from "ethers";

export interface EncryptedContract {
  encryptedDoc: string;         // hex: iv(12) + authTag(16) + ciphertext
  encryptedKeyCompany: string;  // ECIES encrypted doc key for company
  encryptedKeyEmployee: string; // ECIES encrypted doc key for employee
}

// ─── AES-256-GCM doc encryption ───────────────────────────────────────────────

export function encryptDoc(plaintext: string): { ciphertext: string; key: string } {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, authTag, encrypted]).toString("hex");
  return { ciphertext: packed, key: key.toString("hex") };
}

export function decryptDoc(packed: string, keyHex: string): string {
  const buf = Buffer.from(packed, "hex");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ─── ECIES key wrapping (per-recipient) ───────────────────────────────────────

export async function encryptKeyForRecipient(
  docKeyHex: string,
  recipientPublicKey: string // 0x04... uncompressed secp256k1
): Promise<string> {
  const pub = recipientPublicKey.startsWith("0x")
    ? recipientPublicKey.slice(2)
    : recipientPublicKey;
  const encrypted = await EthCrypto.encryptWithPublicKey(pub, docKeyHex);
  return EthCrypto.cipher.stringify(encrypted);
}

export async function decryptKeyWithPrivateKey(
  encryptedKey: string,
  privateKeyHex: string
): Promise<string> {
  const key = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const parsed = EthCrypto.cipher.parse(encryptedKey);
  return EthCrypto.decryptWithPrivateKey(key, parsed);
}

// ─── Full contract encryption ─────────────────────────────────────────────────

export async function encryptContract(
  payload: object,
  companyPublicKey: string,
  employeePublicKey: string
): Promise<EncryptedContract> {
  const plaintext = JSON.stringify(payload);
  const { ciphertext, key } = encryptDoc(plaintext);
  const [encryptedKeyCompany, encryptedKeyEmployee] = await Promise.all([
    encryptKeyForRecipient(key, companyPublicKey),
    encryptKeyForRecipient(key, employeePublicKey),
  ]);
  return { encryptedDoc: ciphertext, encryptedKeyCompany, encryptedKeyEmployee };
}

export function publicKeyFromPrivate(privateKeyHex: string): string {
  const wallet = new ethers.Wallet(privateKeyHex);
  return wallet.signingKey.publicKey; // 0x04...
}

// ─── Master key encryption (server-side, for DB secrets) ──────────────────────
// Format: base64(iv(12) + authTag(16) + ciphertext)

export function encryptWithMasterKey(plaintext: string): string {
  const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptWithMasterKey(b64: string): string {
  const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, "hex");
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
