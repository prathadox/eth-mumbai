// Browser-side decryption using Web Crypto API + eth-crypto (ECIES)
// Never imports Node.js crypto

import EthCrypto from "eth-crypto";
import type { EncryptedContract } from "./encryption";

// AES-256-GCM decrypt using Web Crypto (works in browser)
export async function decryptDocBrowser(packed: string, keyHex: string): Promise<string> {
  const buf = hexToBytes(packed);
  const iv = buf.slice(0, 12);
  const authTag = buf.slice(12, 28);
  const ciphertext = buf.slice(28);

  // Web Crypto combines ciphertext + authTag
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const keyBytes = hexToBytes(keyHex);
  const keyBuf = new Uint8Array(keyBytes).buffer as ArrayBuffer;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const ivBuf = new Uint8Array(iv).buffer as ArrayBuffer;
  const dataBuf = new Uint8Array(combined).buffer as ArrayBuffer;

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuf, tagLength: 128 },
    cryptoKey,
    dataBuf
  );

  return new TextDecoder().decode(plaintext);
}

// ECIES decrypt using eth-crypto — works in browser via bundled eccrypto
export async function decryptKeyBrowser(
  encryptedKey: string,
  privateKeyHex: string
): Promise<string> {
  const key = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const parsed = EthCrypto.cipher.parse(encryptedKey);
  return EthCrypto.decryptWithPrivateKey(key, parsed);
}

export async function decryptContractBrowser(
  encrypted: EncryptedContract,
  privateKeyHex: string
): Promise<Record<string, unknown>> {
  const docKey = await decryptKeyBrowser(encrypted.encryptedKeyEmployee, privateKeyHex);
  const plaintext = await decryptDocBrowser(encrypted.encryptedDoc, docKey);
  return JSON.parse(plaintext);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
