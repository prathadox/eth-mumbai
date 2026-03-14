"use client";

export const dynamic = "force-dynamic";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useState, useEffect } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

type ClaimStep = "idle" | "signing" | "registering" | "done";
type Tab = "connect" | "verify" | "authenticate";

export default function EmployeeClaim() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectMessage = searchParams.get("message");

  const { isConnected, address, chainId } = useAccount();
  const { isSignedIn, signIn, authFetch } = useSiweAuth();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();

  const isWrongChain = isConnected && chainId !== sepolia.id;

  const [activeTab, setActiveTab] = useState<Tab>("connect");

  const [ensName, setEnsName] = useState("");
  const [ensVerified, setEnsVerified] = useState<{ valid: boolean; status?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [claimStep, setClaimStep] = useState<ClaimStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // If signed in and already claimed/active, redirect to contracts
  useEffect(() => {
    if (!isSignedIn || !address) return;
    fetch(`/api/employees/verify-ens?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid && (data.status === "claimed" || data.status === "active")) {
          router.push("/employee/contracts");
        }
      });
  }, [isSignedIn, address, router]);

  // Auto-advance tabs
  useEffect(() => {
    if (isConnected && address && activeTab === "connect") {
      setActiveTab("verify");
      autoDetectEns(address);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (ensVerified?.valid && ensVerified.status === "invited" && activeTab === "verify") {
      setActiveTab("authenticate");
    }
  }, [ensVerified]);

  // After sign-in OR when landing on authenticate tab while already signed in, auto-run key registration
  useEffect(() => {
    if (isSignedIn && activeTab === "authenticate" && ensName && claimStep === "idle" && !success) {
      handleRegister();
    }
  }, [isSignedIn, activeTab]);

  async function autoDetectEns(addr: string) {
    setVerifying(true);
    setError(null);
    setEnsVerified(null);
    try {
      const res = await fetch(`/api/employees/verify-ens?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (data.valid) {
        setEnsName(data.ensName);
        setEnsVerified({ valid: true, status: data.status });
        if (data.status === "claimed" || data.status === "active") {
          router.push("/employee/contracts");
        }
      } else {
        setError(data.error ?? "Wallet not found. Ask your company to invite you first.");
      }
    } catch {
      setError("Failed to detect ENS");
    } finally {
      setVerifying(false);
    }
  }

  async function handleRegister() {
    if (!ensName || !address) return;
    setClaimStep("signing");
    setError(null);

    try {
      const nonce = Math.floor(Math.random() * 1e9).toString();
      const sigMsg = `Penguin Protocol: register public key ${nonce}`;
      const signature = await signMessageAsync({ message: sigMsg });

      const pubRes = await fetch("/api/auth/pubkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: sigMsg, signature }),
      });
      const { pubKey, error: pubError } = await pubRes.json();
      if (pubError) throw new Error(pubError);

      setClaimStep("registering");
      const res = await authFetch("/api/employees/claim", {
        method: "POST",
        body: JSON.stringify({ ensName: ensName.trim().toLowerCase(), pubKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setClaimStep("done");
      setSuccess(true);
      setTimeout(() => router.push("/employee/contracts"), 1500);
    } catch (e: unknown) {
      setError((e as Error).message);
      setClaimStep("idle");
    }
  }

  const tabs: { id: Tab; label: string; num: string; unlocked: boolean }[] = [
    { id: "connect",      label: "Connect",      num: "01", unlocked: true },
    { id: "verify",       label: "Verify ENS",   num: "02", unlocked: isConnected },
    { id: "authenticate", label: "Sign In",       num: "03", unlocked: isConnected && !!ensVerified?.valid },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar />

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-32 pb-16">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-[480px] relative z-10">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold text-blue-500 tracking-widest uppercase mb-3">Employee Portal</p>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white">
              Set up your<br />
              <span className="text-gray-400">encryption key.</span>
            </h1>
            <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">
              Only company-issued ENS subdomains can access this portal.
            </p>
            {redirectMessage && (
              <div className="mt-4 border border-amber-500/20 bg-amber-500/5 rounded-xl px-4 py-3">
                <p className="text-amber-400 text-[13px]">{decodeURIComponent(redirectMessage.replace(/\+/g, " "))}</p>
              </div>
            )}
          </div>

          {/* Wrong chain warning */}
          {isWrongChain && (
            <div className="mb-4 border border-amber-500/20 bg-amber-500/5 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-amber-400 text-[13px]">Switch to Ethereum Sepolia to continue.</p>
              <button
                onClick={() => switchChainAsync({ chainId: sepolia.id })}
                className="text-[12px] text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
              >
                Switch
              </button>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 mb-3 border border-white/[0.06] rounded-2xl p-1 bg-white/[0.02]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.unlocked && setActiveTab(tab.id)}
                disabled={!tab.unlocked}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] transition-all ${
                  activeTab === tab.id
                    ? "bg-white/[0.08] text-white"
                    : tab.unlocked
                    ? "text-gray-500 hover:text-gray-300"
                    : "text-gray-700 cursor-not-allowed"
                }`}
              >
                <span className="text-[10px] font-mono opacity-50">{tab.num}</span>
                {tab.label}
                {tab.id === "connect" && isConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                )}
                {tab.id === "verify" && ensVerified?.valid && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                )}
                {tab.id === "authenticate" && (isSignedIn || success) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01]">

            {/* Connect */}
            {activeTab === "connect" && (
              <div className="space-y-5">
                <div>
                  <p className="text-[15px] font-medium text-white mb-1">Connect your wallet</p>
                  <p className="text-[13px] text-gray-500">Use the wallet your company assigned to your ENS subdomain.</p>
                </div>
                <ConnectButton />
                {isConnected && (
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    <p className="text-[13px] text-gray-400 font-mono">{address?.slice(0, 6)}…{address?.slice(-4)} connected</p>
                  </div>
                )}
                {isConnected && (
                  <button
                    onClick={() => setActiveTab("verify")}
                    className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
                  >
                    Continue →
                  </button>
                )}
              </div>
            )}

            {/* Verify ENS */}
            {activeTab === "verify" && (
              <div className="space-y-5">
                <div>
                  <p className="text-[15px] font-medium text-white mb-1">Verifying your ENS</p>
                  <p className="text-[13px] text-gray-500">Auto-detecting your company-issued subdomain.</p>
                </div>

                {verifying && (
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                    <p className="text-[13px] text-gray-500">Looking up your wallet…</p>
                  </div>
                )}

                {ensVerified?.valid && ensName && (
                  <div className="border border-white/[0.08] rounded-xl px-4 py-3 bg-white/[0.02]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">Detected</p>
                    <p className="text-[15px] text-blue-400 font-mono">{ensName}</p>
                    <p className="text-[12px] text-gray-500 mt-1">Status: {ensVerified.status}</p>
                  </div>
                )}

                {error && (
                  <div className="space-y-3">
                    <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                      <p className="text-red-400 text-[13px]">{error}</p>
                      <p className="text-[12px] text-gray-500 mt-1">Ask your company to invite your wallet first.</p>
                    </div>
                    <button
                      onClick={() => address && autoDetectEns(address)}
                      disabled={verifying}
                      className="w-full py-2 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
                    >
                      {verifying ? "Retrying…" : "Retry"}
                    </button>
                  </div>
                )}

                {ensVerified?.valid && (
                  <button
                    onClick={() => setActiveTab("authenticate")}
                    className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
                  >
                    Continue →
                  </button>
                )}
              </div>
            )}

            {/* Authenticate + Auto-register */}
            {activeTab === "authenticate" && (
              <div className="space-y-5">
                <div>
                  <p className="text-[15px] font-medium text-white mb-1">Sign in with your wallet</p>
                  <p className="text-[13px] text-gray-500">One signature proves ownership and registers your key. No gas.</p>
                </div>

                {success ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      <p className="text-[14px] text-white">You&apos;re in. Ready to view contracts.</p>
                    </div>
                    <Link
                      href="/employee/contracts"
                      className="flex items-center justify-center w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
                    >
                      View your contracts →
                    </Link>
                  </div>
                ) : claimStep !== "idle" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                      <p className="text-[13px] text-gray-400">
                        {claimStep === "signing" ? "Sign the key message in your wallet…" : "Registering your key…"}
                      </p>
                    </div>
                    {error && (
                      <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                        <p className="text-red-400 text-[13px]">{error}</p>
                        <button
                          onClick={handleRegister}
                          className="mt-2 text-[12px] text-gray-400 underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                ) : isSignedIn ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      <p className="text-[13px] text-gray-400 font-mono">{address?.slice(0, 6)}…{address?.slice(-4)} authenticated</p>
                    </div>
                    {error && (
                      <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                        <p className="text-red-400 text-[13px]">{error}</p>
                        <button onClick={handleRegister} className="mt-2 text-[12px] text-gray-400 underline">
                          Retry key registration
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={signIn}
                    className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
                  >
                    Sign in with wallet
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
