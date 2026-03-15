"use client";

export const dynamic = "force-dynamic";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage, useWriteContract, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { useRouter } from "next/navigation";
import { decryptContractBrowser } from "@/lib/encryption.client";
import type { EncryptedContract } from "@/lib/encryption";
import Navbar from "@/components/layout/Navbar";
import { SHIELD_VAULT_ABI } from "@/lib/shieldVault";

type ContractRecord = {
  fileverse_file_id: string;
  doc_hash: string;
  created_at: string;
};

type ContractPayload = {
  employeeEns: string;
  salary: number;
  interval: string;
  issuedAt: string;
  issuedBy: string;
};

// Proof entries for the demo vault
// alice_stealth0 was used for testing — demo uses bob/carol proofs
const VAULT_PROOFS = [
  { key: "alice_stealth0", employee: "Alice", amount: 1000 },
  { key: "bob_stealth0",   employee: "Bob",   amount: 1000 },
  { key: "bob_stealth1",   employee: "Bob",   amount: 1000 },
  { key: "carol_stealth0", employee: "Carol", amount: 1000 },
  { key: "carol_stealth1", employee: "Carol", amount: 1000 },
  { key: "carol_stealth2", employee: "Carol", amount: 1000 },
];

export default function EmployeeContracts() {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const { isSignedIn, signIn, authFetch } = useSiweAuth();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decrypted, setDecrypted] = useState<Record<string, ContractPayload>>({});
  const [decryptPrivKey, setDecryptPrivKey] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [decrypting, setDecrypting] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Claim salary state
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<Record<string, string>>({});
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimLogs, setClaimLogs] = useState<string[]>([]);
  const addClaimLog = (msg: string) => setClaimLogs((p) => [...p, msg]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchContracts();
  }, [isSignedIn]);

  async function fetchContracts() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/contracts/me");
      const data = await res.json();
      if (res.status === 401) {
        router.push("/employee/claim");
        return;
      }
      if (!res.ok && res.status !== 404) throw new Error(data.error);
      if (res.status === 404) {
        // Not an employee at all — send to claim
        router.push("/employee/claim");
        return;
      }
      setContracts(data.employee?.contracts ?? []);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function unlockWithWallet() {
    setUnlocking(true);
    setDecryptError(null);
    try {
      // Same deterministic message used during registration — same r every time
      const sig = await signMessageAsync({ message: "Penguin Protocol: decrypt key v1" });
      const { r } = ethers.Signature.from(sig);
      setDecryptPrivKey(r);
    } catch (e: unknown) {
      setDecryptError((e as Error).message);
    } finally {
      setUnlocking(false);
    }
  }

  async function handleDecrypt(contract: ContractRecord) {
    if (!decryptPrivKey) return;
    setDecrypting(contract.fileverse_file_id);
    setDecryptError(null);
    try {
      const res = await authFetch(
        `/api/contracts/file?fileId=${encodeURIComponent(contract.fileverse_file_id)}`
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const encrypted = (await res.json()) as EncryptedContract;
      const payload = await decryptContractBrowser(encrypted, decryptPrivKey!) as ContractPayload;
      setDecrypted((prev) => ({ ...prev, [contract.fileverse_file_id]: payload }));
    } catch (e: unknown) {
      setDecryptError((e as Error).message);
    } finally {
      setDecrypting(null);
    }
  }

  async function handleClaim(proofKey: string) {
    setClaiming(proofKey);
    setClaimError(null);
    setClaimLogs([]);
    try {
      addClaimLog(`→ Switching to Base Sepolia (chainId 84532)…`);
      if (chainId !== baseSepolia.id) await switchChainAsync({ chainId: baseSepolia.id });
      addClaimLog(`✓ Connected to Base Sepolia`);

      addClaimLog(`→ Loading pre-generated ZK proof: ${proofKey}`);
      const res = await fetch(`/api/contracts/proof?key=${encodeURIComponent(proofKey)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const { proofHex, publicInputs } = await res.json();

      const proofBytes = (proofHex.length - 2) / 2;
      addClaimLog(`✓ Proof loaded (${proofBytes} bytes) — UltraHonk / Barretenberg`);
      addClaimLog(`  Merkle root:    ${publicInputs.merkleRoot}`);
      addClaimLog(`  Nullifier hash: ${publicInputs.nullifierHash}`);
      addClaimLog(`  Amount:         ${Number(publicInputs.amount).toLocaleString()} USDC`);

      const VAULT = process.env.NEXT_PUBLIC_SHIELD_VAULT_ADDRESS as `0x${string}`;
      addClaimLog(`→ Calling withdrawToStealth() on ShieldVault`);
      addClaimLog(`  ShieldVault: ${VAULT}`);

      const tx = await writeContractAsync({
        address: VAULT,
        abi: SHIELD_VAULT_ABI,
        functionName: "withdrawToStealth",
        args: [
          proofHex as `0x${string}`,
          publicInputs.merkleRoot as `0x${string}`,
          publicInputs.nullifierHash as `0x${string}`,
          publicInputs.stealthAddress as `0x${string}`,
          BigInt(publicInputs.amount),
        ],
        chainId: baseSepolia.id,
      });
      addClaimLog(`  withdrawToStealth() tx: ${tx}`);
      addClaimLog(`✓ ${Number(publicInputs.amount).toLocaleString()} USDC → stealth address`);
      addClaimLog(`✓ Nullifier recorded — cannot double-claim`);
      setClaimResult((prev) => ({ ...prev, [proofKey]: tx }));
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setClaimError(msg);
      addClaimLog(`✗ Error: ${msg}`);
    } finally {
      setClaiming(null);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans">
        <Navbar />
        <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16">
          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="w-full max-w-[480px] relative z-10 space-y-6">
            <div>
              <p className="text-[11px] font-semibold text-blue-500 tracking-widest uppercase mb-3">Employee Portal</p>
              <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white">
                Sign in to view<br />
                <span className="text-gray-400">your contracts.</span>
              </h1>
              <p className="text-[15px] text-gray-500 mt-4 leading-relaxed">
                Sign the message with your wallet to access encrypted payroll.
              </p>
            </div>
            <div className="border border-white/[0.08] rounded-2xl p-8 bg-white/[0.01] space-y-6">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">Authenticate</p>
                <p className="text-[15px] font-medium text-white">Sign in with wallet</p>
                <p className="text-[13px] text-gray-500 mt-1">Prove ownership without sharing your private key.</p>
              </div>
              <button
                onClick={signIn}
                className="w-full py-3 rounded-xl border border-white/20 text-white text-[14px] font-medium hover:bg-white/[0.08] transition-colors"
              >
                Sign in with wallet
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar />

      <main className="relative z-10 max-w-[900px] mx-auto px-6 pt-32 pb-20 space-y-8">
        <div className="fixed top-[20%] left-[60%] -translate-x-1/2 w-[600px] h-[600px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none z-0" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-2">Employee Portal</p>
            <h1 className="text-4xl font-medium tracking-tight text-white">My Contracts</h1>
            <p className="text-[13px] text-gray-500 mt-2 font-mono">
              {address ? `${address.slice(0, 10)}…${address.slice(-6)}` : "Signed in"}
            </p>
          </div>
          <ConnectButton />
        </div>

        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-4">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">01</p>
            <p className="text-[15px] font-medium text-white">Unlock Decryption</p>
            <p className="text-[13px] text-gray-500 mt-1">
              Sign a message with your wallet to unlock contract decryption. No private key needed.
            </p>
          </div>
          {decryptPrivKey ? (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
              <p className="text-[13px] text-gray-400">Decryption unlocked — click Decrypt on any contract</p>
            </div>
          ) : (
            <button
              onClick={unlockWithWallet}
              disabled={unlocking}
              className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
            >
              {unlocking ? "Sign in wallet…" : "Unlock with wallet"}
            </button>
          )}
        </div>

        {(error || decryptError || claimError) && (
          <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
            <p className="text-red-400 text-[13px] break-all">{error ?? decryptError ?? claimError}</p>
          </div>
        )}

        <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-white/[0.01]">
          <div className="px-6 py-4 border-b border-white/[0.08]">
            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">02</p>
            <h2 className="text-[18px] font-medium text-white">Contracts</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-[13px]">Loading…</p>
            </div>
          ) : contracts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-[15px]">No contracts issued yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-4 px-6 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Contract ID</th>
                  <th className="text-left py-4 px-6 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Issued</th>
                  <th className="text-left py-4 px-6 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Salary</th>
                  <th className="text-left py-4 px-6 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Interval</th>
                  <th className="text-left py-4 px-6 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Decrypt</th>
                  <th className="text-left py-4 px-6 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Claim Salary</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, idx) => {
                  const payload = decrypted[c.fileverse_file_id];
                  const proofKey = VAULT_PROOFS[idx % VAULT_PROOFS.length].key;
                  const txHash = claimResult[proofKey];
                  return (
                    <tr key={c.fileverse_file_id} className="border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6 text-[13px] font-mono text-gray-400">
                        {c.fileverse_file_id.slice(0, 20)}…
                      </td>
                      <td className="py-4 px-6 text-[13px] text-gray-400">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-[13px] text-white">
                        {payload ? `${payload.salary} USDC` : "—"}
                      </td>
                      <td className="py-4 px-6 text-[13px] text-white">
                        {payload ? payload.interval : "—"}
                      </td>
                      <td className="py-4 px-6">
                        {payload ? (
                          <span className="text-[11px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Decrypted
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDecrypt(c)}
                            disabled={!decryptPrivKey || decrypting === c.fileverse_file_id}
                            className="py-1.5 px-3 rounded-lg border border-white/[0.08] text-[12px] text-white hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
                          >
                            {decrypting === c.fileverse_file_id ? "…" : "Decrypt"}
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {txHash ? (
                          <span className="text-[11px] text-blue-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                            Claimed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleClaim(proofKey)}
                            disabled={claiming === proofKey}
                            className="py-1.5 px-3 rounded-lg border border-blue-500/30 text-[12px] text-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-colors"
                          >
                            {claiming === proofKey ? "…" : "Claim"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {claimLogs.length > 0 && (
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-white/[0.01]">
            <div className="px-6 py-3 border-b border-white/[0.06]">
              <p className="text-[11px] text-gray-500 uppercase tracking-widest">ZK Claim Log</p>
            </div>
            <div className="p-4 font-mono text-[11px] space-y-1 max-h-60 overflow-y-auto">
              {claimLogs.map((l, i) => (
                <p key={i} className={l.startsWith("✓") ? "text-blue-400" : l.startsWith("✗") ? "text-red-400" : "text-gray-500"}>{l}</p>
              ))}
              {claiming && <p className="text-gray-600 animate-pulse">…</p>}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
