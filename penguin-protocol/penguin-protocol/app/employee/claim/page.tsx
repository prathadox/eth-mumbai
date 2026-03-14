"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useSignMessage } from "wagmi";
import { useState } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { ethers } from "ethers";
import Link from "next/link";

const ENS_REGISTRY_ABI = [
  {
    name: "setSubnodeOwner",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "label", type: "bytes32" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

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

type Step = "idle" | "claiming" | "pubkey-signing" | "pubkey-setting" | "verifying" | "done";

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
    setStep("claiming");
    setError(null);

    try {
      // The company already transferred ENS ownership to the employee on invite.
      // No setSubnodeOwner needed — skip straight to pubkey registration.

      // Step 1: Recover public key from a signed message
      setStep("pubkey-signing");
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

      // Step 3: Set public key as ENS text record on the subdomain
      setStep("pubkey-setting");
      const subnode = ethers.namehash(ensName) as `0x${string}`;

      const setKeyTx = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_ENS_PUBLIC_RESOLVER_ADDRESS as `0x${string}`,
        abi: RESOLVER_ABI,
        functionName: "setText",
        args: [subnode, "penguin.pubkey", pubKey],
      });
      await waitForTx(setKeyTx);

      // Step 4: Notify backend — verifies on-chain and sets status = claimed
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

  const stepLabel: Record<Step, string> = {
    idle: "Register & Claim",
    claiming: "Starting…",
    "pubkey-signing": "Sign to derive your public key…",
    "pubkey-setting": "Setting public key on your ENS…",
    verifying: "Verifying on backend…",
    done: "Done",
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <ConnectButton />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Claim Your ENS Identity</h1>
          <p className="text-gray-400 text-sm mt-1">
            Take ownership of your company-issued ENS subdomain and register your public key.
          </p>
        </div>

        {!isSignedIn ? (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
            <p className="text-sm text-gray-400">Sign in first.</p>
            <button
              onClick={signIn}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{address?.slice(0, 6)}…{address?.slice(-4)}</p>
              <ConnectButton />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-300">Your ENS Subdomain</label>
              <input
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                placeholder="alice.acme.penguin.eth"
                disabled={step !== "idle"}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* Step indicators */}
            {step !== "idle" && step !== "done" && (
              <div className="space-y-2">
                {(["claiming", "pubkey-signing", "pubkey-setting", "verifying"] as Step[]).map((s) => {
                  const steps: Step[] = ["claiming", "pubkey-signing", "pubkey-setting", "verifying"];
                  const currentIdx = steps.indexOf(step);
                  const thisIdx = steps.indexOf(s);
                  const done = thisIdx < currentIdx;
                  const active = thisIdx === currentIdx;
                  return (
                    <div key={s} className={`text-xs flex items-center gap-2 ${active ? "text-white" : done ? "text-green-400" : "text-gray-600"}`}>
                      <span>{done ? "✓" : active ? "⟳" : "○"}</span>
                      <span>{stepLabel[s]}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {success ? (
              <div className="space-y-2">
                <p className="text-green-400 text-sm">✓ ENS claimed and public key registered!</p>
                <Link href="/employee/contracts" className="text-indigo-400 text-sm underline">
                  View your contracts →
                </Link>
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={!ensName || step !== "idle"}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold transition-colors"
              >
                {step === "idle" ? "Claim ENS Subdomain" : stepLabel[step]}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
