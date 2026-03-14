"use client";

export const dynamic = "force-dynamic";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { decryptContractBrowser } from "@/lib/encryption.client";
import type { EncryptedContract } from "@/lib/encryption";
import Navbar from "@/components/layout/Navbar";

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

export default function EmployeeContracts() {
  const { address } = useAccount();
  const { isSignedIn, signIn, authFetch } = useSiweAuth();

  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decrypted, setDecrypted] = useState<Record<string, ContractPayload>>({});
  const [decryptKey, setDecryptKey] = useState("");
  const [decrypting, setDecrypting] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchContracts();
  }, [isSignedIn]);

  async function fetchContracts() {
    setLoading(true);
    try {
      const res = await authFetch("/api/contracts/me");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContracts(data.employee.contracts ?? []);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecrypt(contract: ContractRecord) {
    if (!decryptKey) return;
    setDecrypting(contract.fileverse_file_id);
    setDecryptError(null);
    try {
      const res = await authFetch(
        `/api/contracts/file?fileId=${encodeURIComponent(contract.fileverse_file_id)}`
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const encrypted = (await res.json()) as EncryptedContract;
      const payload = await decryptContractBrowser(encrypted, decryptKey) as ContractPayload;
      setDecrypted((prev) => ({ ...prev, [contract.fileverse_file_id]: payload }));
    } catch (e: unknown) {
      setDecryptError((e as Error).message);
    } finally {
      setDecrypting(null);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-[15px]">Sign in to view your contracts.</p>
        <button
          onClick={signIn}
          className="px-6 py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
        >
          Sign in with wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar />

      <main className="relative z-10 max-w-[900px] mx-auto px-6 pt-32 pb-20 space-y-8">
        <div className="fixed top-[20%] left-[60%] -translate-x-1/2 w-[600px] h-[600px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none z-0" />

        {/* Header */}
        <div className="flex items-start justify-between">
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

        {/* Decrypt key input */}
        <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-4">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">Local Decryption</p>
            <p className="text-[15px] font-medium text-white">Enter your private key</p>
            <p className="text-[13px] text-gray-500 mt-1">
              Decryption happens entirely in your browser. Your key never leaves this tab.
            </p>
          </div>
          <input
            type="password"
            value={decryptKey}
            onChange={(e) => setDecryptKey(e.target.value)}
            placeholder="0x..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] font-mono text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Errors */}
        {(error || decryptError) && (
          <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
            <p className="text-red-400 text-[13px]">{error ?? decryptError}</p>
          </div>
        )}

        {/* Contracts */}
        {loading ? (
          <p className="text-gray-600 text-[13px]">Loading contracts…</p>
        ) : contracts.length === 0 ? (
          <div className="border border-white/[0.08] rounded-2xl p-8 bg-white/[0.01] text-center">
            <p className="text-gray-600 text-[15px]">No contracts issued yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((c) => {
              const payload = decrypted[c.fileverse_file_id];
              return (
                <div
                  key={c.fileverse_file_id}
                  className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-mono text-gray-600">{c.fileverse_file_id.slice(0, 28)}…</p>
                    <p className="text-[11px] text-gray-600">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>

                  {payload ? (
                    <>
                      <div className="w-full h-[1px] bg-white/[0.06]" />
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        {[
                          ["ENS", payload.employeeEns],
                          ["Salary", `${payload.salary} USDC / ${payload.interval}`],
                          ["Issued", new Date(payload.issuedAt).toLocaleDateString()],
                          ["Issued By", `${payload.issuedBy.slice(0, 10)}…`],
                        ].map(([label, val]) => (
                          <div key={label}>
                            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
                            <p className="text-[14px] text-white">{val}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                        <span className="text-[11px] text-gray-500 uppercase tracking-widest">Decrypted</span>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDecrypt(c)}
                      disabled={!decryptKey || decrypting === c.fileverse_file_id}
                      className="w-full py-2.5 rounded-full border border-white/[0.08] text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
                    >
                      {decrypting === c.fileverse_file_id ? "Decrypting…" : "Decrypt Contract"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
