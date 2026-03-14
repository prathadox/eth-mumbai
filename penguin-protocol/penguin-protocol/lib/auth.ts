import { SiweMessage } from "siwe";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "./supabase";

const JWT_SECRET = process.env.JWT_SECRET!;

export function signJWT(address: string): string {
  return jwt.sign({ address: address.toLowerCase() }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyJWT(token: string): { address: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { address: string };
  } catch {
    return null;
  }
}

export function getAuthAddress(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyJWT(auth.slice(7));
  return payload?.address ?? null;
}

export async function generateNonce(address: string): Promise<string> {
  const db = supabaseAdmin();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  await db.from("auth_nonces").upsert({ address: address.toLowerCase(), nonce, expires_at: expiresAt });
  return nonce;
}

export async function verifySiweAndIssueJWT(
  message: string,
  signature: string
): Promise<string> {
  const db = supabaseAdmin();
  const siwe = new SiweMessage(message);
  const { data: fields } = await siwe.verify({ signature });

  const address = fields.address.toLowerCase();

  const { data: record } = await db
    .from("auth_nonces")
    .select("nonce, expires_at")
    .eq("address", address)
    .single();

  if (!record) throw new Error("No nonce found — request a new one");
  if (new Date(record.expires_at) < new Date()) throw new Error("Nonce expired");
  if (record.nonce !== fields.nonce) throw new Error("Nonce mismatch");

  // Consume nonce
  await db.from("auth_nonces").delete().eq("address", address);

  return signJWT(address);
}
