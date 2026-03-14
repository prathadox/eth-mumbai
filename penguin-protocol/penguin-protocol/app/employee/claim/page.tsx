"use client";

export const dynamic = "force-dynamic";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useSignMessage } from "wagmi";
import { useState } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { ethers } from "ethers";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

const RESOLVER_ABI = [
  {
    name: "setText",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
] as const;

type Step = "idle" | "pubkey-signing" | "pubkey-setting" | "verifying" | "done";

const STEP_LABELS: Record<Step, string> = {
  idle: "Register & Claim",
  "pubkey-signing": "Sign to derive your public key",
  "pubkey-setting": "Setting public key on your ENS",
  verifying: "Verifying on backend",
  done: "Done",
};

const STEPS: Step[] = ["pubkey-signing", "pubkey-setting", "verifying"];

export default function EmployeeClaim() {
  const { isConnected, address } = useAccount();
  const { isSignedIn, signIn, authFetch } = useSiweAuth();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const [ensName, setEnsName] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function waitForTx(hash: `0x${string}`) {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL!);
    await provider.waitForTransaction(hash);
  }

  async function handleClaim() {
    if (!ensName || !address) return;
    setStep("pubkey-signing");
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

      setStep("pubkey-setting");
      const subnode = ethers.namehash(ensName) as `0x${string}`;
      const setKeyTx = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_ENS_PUBLIC_RESOLVER_ADDRESS as `0x${string}`,
        abi: RESOLVER_ABI,
        functionName: "setText",
        args: [subnode, "penguin.pubkey", pubKey],
      });
      await waitForTx(setKeyTx);

      setStep("verifying");
      const res = await authFetch("/api/employees/claim", {
        method: "POST",
        body: JSON.stringify({ ensName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("done");
      setSuccess(true);
    } catch (e: unknown) {
      setError((e as Error).message);
      setStep("idle");
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <ConnectButton />
      </div>
    );
  }

  const currentStepIdx = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar />

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-32 pb-16">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-[480px] space-y-2 relative z-10">

          {/* Header */}
          <div className="mb-10">
            <p className="text-[11px] font-semibold text-blue-500 tracking-widest uppercase mb-3">Employee Portal</p>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white">
              Claim your<br />
              <span className="text-gray-400">ENS identity.</span>
            </h1>
            <p className="text-[15px] text-gray-500 mt-4 leading-relaxed">
              Register your public key on your company-issued subdomain to unlock encrypted contracts.
            </p>
          </div>

          {/* Connect */}
          <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">01</p>
                <p className="text-[15px] font-medium text-white">Connect Wallet</p>
              </div>
              <ConnectButton />
            </div>
          </div>

          {/* Auth */}
          <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-4">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">02</p>
              <p className="text-[15px] font-medium text-white">Authenticate</p>
            </div>
            {isSignedIn ? (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <p className="text-[13px] font-mono text-gray-400">{address?.slice(0, 6)}…{address?.slice(-4)}</p>
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

          {/* Claim */}
          {isSignedIn && !success && (
            <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-5">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">03</p>
                <p className="text-[15px] font-medium text-white">Register Public Key</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-widest">Your ENS Subdomain</label>
                <input
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  placeholder="alice.acme.eth"
                  disabled={step !== "idle"}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors disabled:opacity-40"
                />
              </div>

              {/* Step progress */}
              {step !== "idle" && (
                <div className="space-y-2 py-1">
                  {STEPS.map((s, i) => {
                    const done = i < currentStepIdx;
                    const active = i === currentStepIdx;
                    return (
                      <div
                        key={s}
                        className={`flex items-center gap-3 text-[13px] transition-colors ${
                          active ? "text-white" : done ? "text-gray-500" : "text-gray-700"
                        }`}
                      >
                        <span className="w-4 text-center">
                          {done ? "✓" : active ? "◌" : "·"}
                        </span>
                        <span>{STEP_LABELS[s]}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {error && (
                <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-[13px]">{error}</p>
                </div>
              )}

              <button
                onClick={handleClaim}
                disabled={!ensName || step !== "idle"}
                className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
              >
                {step === "idle" ? "Claim ENS Subdomain" : STEP_LABELS[step]}
              </button>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <p className="text-[14px] text-white">ENS claimed. Public key registered on-chain.</p>
              </div>
              <Link
                href="/employee/contracts"
                className="inline-flex items-center gap-2 text-[13px] text-gray-400 hover:text-white transition-colors"
              >
                View your contracts →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
