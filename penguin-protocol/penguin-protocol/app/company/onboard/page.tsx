"use client";

export const dynamic = "force-dynamic";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useState, useCallback, useEffect } from "react";
import { SiweMessage } from "siwe";
import { useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";

const TOKEN_KEY = "penguin_jwt";
const PUBKEY_KEY = "penguin_pubkey";

type Tab = "connect" | "authenticate" | "setup";

export default function CompanyOnboard() {
  const { isConnected, address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("connect");
  const [returningUser, setReturningUser] = useState(false);
  const [hasCompany, setHasCompany] = useState<boolean | null>(null); // null = loading

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ensName, setEnsName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: check for existing session, then check if company exists
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const pk = localStorage.getItem(PUBKEY_KEY);
    if (t && pk) {
      setToken(t);
      setPubKey(pk);
      setReturningUser(true);
      setActiveTab("setup");
      // Check if company already created for this session
      fetch("/api/companies/me", { headers: { Authorization: `Bearer ${t}` } })
        .then((res) => setHasCompany(res.ok))
        .catch(() => setHasCompany(false));
    }
  }, []);

  // Auto-advance tabs as prerequisites are met
  useEffect(() => {
    if (!returningUser) {
      if (isConnected && activeTab === "connect") setActiveTab("authenticate");
    }
  }, [isConnected, activeTab, returningUser]);

  useEffect(() => {
    if (token && pubKey && activeTab === "authenticate") setActiveTab("setup");
  }, [token, pubKey, activeTab]);

  const isSignedIn = !!token && !!pubKey;

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PUBKEY_KEY);
    setToken(null);
    setPubKey(null);
    setReturningUser(false);
    setActiveTab("connect");
  };

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${address}`, { cache: "no-store" });
      const data = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(data.error ?? "Failed to get nonce");
      const { nonce } = data;

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
    if (!name || !slug || !ensName || !token || !pubKey) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/companies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug: slug.toLowerCase(), pubKey, ensName }),
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

  const tabs: { id: Tab; label: string; num: string; unlocked: boolean }[] = [
    { id: "connect", label: "Connect", num: "01", unlocked: true },
    { id: "authenticate", label: "Authenticate", num: "02", unlocked: isConnected || isSignedIn },
    { id: "setup", label: "Setup", num: "03", unlocked: isSignedIn },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar />

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-32 pb-16">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-[480px] relative z-10">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold text-blue-500 tracking-widest uppercase mb-3">Company Setup</p>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white">
              Set up your<br />
              <span className="text-gray-400">payroll treasury.</span>
            </h1>
          </div>

          {/* Returning user banner */}
          {returningUser && (
            <div className="mb-4 border border-blue-500/20 bg-blue-500/5 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[12px] text-blue-400 uppercase tracking-widest mb-0.5">
                  {hasCompany ? "Already set up" : "Session restored"}
                </p>
                <p className="text-[13px] text-gray-400">
                  {hasCompany ? "Your company is ready." : "You're signed in — complete setup below."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {hasCompany && (
                  <button
                    onClick={() => router.push("/company/dashboard")}
                    className="px-4 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[12px] hover:bg-blue-600/30 transition-colors"
                  >
                    Dashboard →
                  </button>
                )}
                <button
                  onClick={clearSession}
                  className="text-[12px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 mb-3 border border-white/[0.06] rounded-2xl p-1 bg-white/[0.02]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.unlocked && setActiveTab(tab.id)}
                disabled={!tab.unlocked}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] transition-all ${
                  activeTab === tab.id
                    ? "bg-white/[0.08] text-white"
                    : tab.unlocked
                    ? "text-gray-500 hover:text-gray-300"
                    : "text-gray-700 cursor-not-allowed"
                }`}
              >
                <span className="text-[10px] font-mono opacity-60">{tab.num}</span>
                {tab.label}
                {tab.id === "connect" && isConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                )}
                {tab.id === "authenticate" && isSignedIn && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01]">

            {/* Connect tab */}
            {activeTab === "connect" && (
              <div className="space-y-5">
                <div>
                  <p className="text-[15px] font-medium text-white mb-1">Connect your wallet</p>
                  <p className="text-[13px] text-gray-500">Use the wallet that owns your company&apos;s ENS name.</p>
                </div>
                <ConnectButton />
                {isConnected && (
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    <p className="text-[13px] text-gray-400 font-mono">
                      {address?.slice(0, 6)}…{address?.slice(-4)} connected
                    </p>
                  </div>
                )}
                {isConnected && (
                  <button
                    onClick={() => setActiveTab("authenticate")}
                    className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
                  >
                    Continue →
                  </button>
                )}
              </div>
            )}

            {/* Authenticate tab */}
            {activeTab === "authenticate" && (
              <div className="space-y-5">
                <div>
                  <p className="text-[15px] font-medium text-white mb-1">Sign in with your wallet</p>
                  <p className="text-[13px] text-gray-500">Sign a message to prove wallet ownership. No gas required.</p>
                </div>
                {isSignedIn ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      <p className="text-[13px] text-gray-400 font-mono">
                        {address?.slice(0, 6)}…{address?.slice(-4)} authenticated
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("setup")}
                      className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                ) : !isConnected ? (
                  <p className="text-[13px] text-gray-600">Connect your wallet first.</p>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={signIn}
                      disabled={authLoading}
                      className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
                    >
                      {authLoading ? "Waiting for signature…" : "Sign message to authenticate"}
                    </button>
                    {authError && (
                      <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                        <p className="text-red-400 text-[13px]">{authError}</p>
                        <button
                          onClick={signIn}
                          className="text-[12px] text-red-400/70 hover:text-red-400 mt-1 underline"
                        >
                          Try again
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Setup tab */}
            {activeTab === "setup" && (
              <div className="space-y-5">
                <div>
                  <p className="text-[15px] font-medium text-white mb-1">Company details</p>
                  <p className="text-[13px] text-gray-500">Fill in your company info to create your payroll treasury.</p>
                </div>
                {!isSignedIn ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-gray-600">You need to authenticate first.</p>
                    <button
                      onClick={() => setActiveTab("authenticate")}
                      className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
                    >
                      ← Go to Authenticate
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-gray-500 uppercase tracking-widest">Company Name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ACME Corp"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-gray-500 uppercase tracking-widest">Internal Slug</label>
                      <input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="acme"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
                      />
                      <p className="text-[11px] text-gray-600">Lowercase alphanumeric — used as internal ID.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-gray-500 uppercase tracking-widest">Your ENS Name</label>
                      <input
                        value={ensName}
                        onChange={(e) => setEnsName(e.target.value.trim().toLowerCase())}
                        placeholder="acme.eth"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
                      />
                      <p className="text-[11px] text-gray-600">Must be owned by your connected wallet. Verified on-chain.</p>
                    </div>

                    {error && (
                      <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                        <p className="text-red-400 text-[13px]">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={handleCreate}
                      disabled={!name || !slug || !ensName || submitting}
                      className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
                    >
                      {submitting ? "Verifying ENS + creating treasury…" : "Create Company"}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
