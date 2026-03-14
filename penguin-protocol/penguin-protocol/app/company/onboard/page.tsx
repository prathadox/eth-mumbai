"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useState, useCallback } from "react";
import { SiweMessage } from "siwe";
import { useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "penguin_jwt";
const PUBKEY_KEY = "penguin_pubkey";

export default function CompanyOnboard() {
  const { isConnected, address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
  );
  const [pubKey, setPubKey] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(PUBKEY_KEY) : null
  );

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;
    setAuthLoading(true);
    setAuthError(null);

    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${address}`);
      const { nonce } = await nonceRes.json();

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Penguin Protocol",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      const prepared = message.prepareMessage();
      const signature = await signMessageAsync({ message: prepared });

      const authRes = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prepared, signature }),
      });

      const { token: jwt, pubKey: recoveredPubKey, error: authErr } = await authRes.json();
      if (authErr) throw new Error(authErr);

      localStorage.setItem(TOKEN_KEY, jwt);
      localStorage.setItem(PUBKEY_KEY, recoveredPubKey);
      setToken(jwt);
      setPubKey(recoveredPubKey);
    } catch (e: unknown) {
      setAuthError((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  async function handleCreate() {
    if (!name || !slug || !token || !pubKey) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/companies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug: slug.toLowerCase(), pubKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/company/dashboard");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const isSignedIn = !!token && !!pubKey;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Company Onboarding</h1>
          <p className="text-gray-400 text-sm mt-1">
            Connect wallet → sign in → set up your treasury and ENS identity.
          </p>
        </div>

        {/* Step 1 */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 1 — Connect Wallet</p>
          <ConnectButton />
        </div>

        {/* Step 2 */}
        {isConnected && (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 2 — Sign In</p>
            {isSignedIn ? (
              <p className="text-green-400 text-sm">✓ Signed in — {address?.slice(0, 6)}…{address?.slice(-4)}</p>
            ) : (
              <button
                onClick={signIn}
                disabled={authLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold transition-colors"
              >
                {authLoading ? "Signing…" : "Sign message to authenticate"}
              </button>
            )}
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
          </div>
        )}

        {/* Step 3 */}
        {isSignedIn && (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 3 — Set Up Company</p>

            <div className="space-y-1">
              <label className="text-sm text-gray-300">Company Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ACME Corp"
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-300">ENS Slug *</label>
              <div className="flex items-center gap-2">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="acme"
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-500 text-sm whitespace-nowrap">
                  .{process.env.NEXT_PUBLIC_ENS_ROOT_DOMAIN ?? "penguin.eth"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Your company ENS: {slug || "yourslug"}.{process.env.NEXT_PUBLIC_ENS_ROOT_DOMAIN ?? "penguin.eth"}
              </p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={!name || !slug || submitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold transition-colors"
            >
              {submitting ? "Creating ENS + BitGo treasury…" : "Create Company"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
