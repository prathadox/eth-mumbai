"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { decryptContractBrowser } from "@/lib/encryption.client";
import type { EncryptedContract } from "@/lib/encryption";

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
  const { isConnected, address } = useAccount();
  const { isSignedIn, signIn, authFetch } = useSiweAuth();

  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decrypted, setDecrypted] = useState<Record<string, ContractPayload>>({});
  const [decryptKey, setDecryptKey] = useState("");
  const [decrypting, setDecrypting] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !address) return;
    fetchContracts();
  }, [isSignedIn, address]);

  async function fetchContracts() {
    setLoading(true);
    try {
      const res = await authFetch(`/api/contracts/${address}`);
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
      // Fetch encrypted payload from backend (verified server-side)
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

  if (!isConnected) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <ConnectButton />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <button onClick={signIn} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold">
          Sign In
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Contracts</h1>
        <ConnectButton />
      </div>

      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 space-y-2">
        <p className="text-yellow-400 text-sm font-semibold">🔑 Local Decryption</p>
        <p className="text-xs text-gray-400">
          Enter your private key to decrypt contracts locally. It never leaves your browser.
        </p>
        <input
          type="password"
          value={decryptKey}
          onChange={(e) => setDecryptKey(e.target.value)}
          placeholder="0x..."
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-500 font-mono"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {decryptError && <p className="text-red-400 text-sm">{decryptError}</p>}

      {loading ? (
        <p className="text-gray-500">Loading contracts…</p>
      ) : contracts.length === 0 ? (
        <p className="text-gray-500">No contracts yet.</p>
      ) : (
        <div className="space-y-4">
          {contracts.map((c) => {
            const payload = decrypted[c.fileverse_file_id];
            return (
              <div key={c.fileverse_file_id} className="bg-gray-900 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-mono">{c.fileverse_file_id.slice(0, 24)}…</p>
                  <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>

                {payload ? (
                  <div className="space-y-2 bg-gray-800 rounded-xl p-4">
                    <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Decrypted</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-400">ENS</span>
                      <span>{payload.employeeEns}</span>
                      <span className="text-gray-400">Salary</span>
                      <span>{payload.salary} USDC / {payload.interval}</span>
                      <span className="text-gray-400">Issued</span>
                      <span>{new Date(payload.issuedAt).toLocaleDateString()}</span>
                      <span className="text-gray-400">Issued By</span>
                      <span className="font-mono text-xs">{payload.issuedBy.slice(0, 10)}…</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDecrypt(c)}
                    disabled={!decryptKey || decrypting === c.fileverse_file_id}
                    className="w-full py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors"
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
  );
}
