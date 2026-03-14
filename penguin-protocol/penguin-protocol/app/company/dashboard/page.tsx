"use client";

export const dynamic = "force-dynamic";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useEffect, useState } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { ethers } from "ethers";
import Navbar from "@/components/layout/Navbar";

const NAME_WRAPPER_ABI = [
  {
    name: "setSubnodeOwner",
    type: "function",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
] as const;

type ContractRecord = { id: number; fileverse_file_id: string; created_at: string };

type Employee = {
  id: number;
  wallet_address: string;
  ens_name: string;
  status: string;
  contracts?: ContractRecord[] | null;
};

type Company = {
  ens_name: string;
  bitgo_receive_address: string;
};

export default function CompanyDashboard() {
  const { isConnected, chainId } = useAccount();
  const { isSignedIn, signIn, authFetch } = useSiweAuth();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);

  const [inviteWallet, setInviteWallet] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [salary, setSalary] = useState("");
  const [payInterval, setPayInterval] = useState("monthly");
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractSuccess, setContractSuccess] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchData();
  }, [isSignedIn]);

  useEffect(() => {
    if (!isConnected) {
      setCompany(null);
      setEmployees([]);
      setSelectedEmp(null);
    } else if (isSignedIn) {
      fetchData();
    }
  }, [isConnected]);

  async function fetchData() {
    setLoadingEmps(true);
    try {
      const [empRes, compRes] = await Promise.all([
        authFetch("/api/employees"),
        authFetch("/api/companies/me"),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (compRes.ok) setCompany((await compRes.json()).company);
    } finally {
      setLoadingEmps(false);
    }
  }

  async function handleInvite() {
    if (!inviteWallet || !inviteLabel || !company) return;
    if (!isConnected) {
      setInviteError("Reconnect wallet to sign the ENS transaction");
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      if (chainId !== sepolia.id) await switchChainAsync({ chainId: sepolia.id });
      const parentNode = ethers.namehash(company.ens_name) as `0x${string}`;
      const ensName = `${inviteLabel}.${company.ens_name}`;

      const txHash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_ENS_NAME_WRAPPER_ADDRESS as `0x${string}`,
        abi: NAME_WRAPPER_ABI,
        functionName: "setSubnodeOwner",
        args: [
          parentNode,
          inviteLabel,
          inviteWallet as `0x${string}`,
          0,
          BigInt(0),
        ],
      });

      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL!);
      await provider.waitForTransaction(txHash);

      const res = await authFetch("/api/employees/invite", {
        method: "POST",
        body: JSON.stringify({ employeeWallet: inviteWallet, ensName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setInviteWallet("");
      setInviteLabel("");
      fetchData();
    } catch (e: unknown) {
      setInviteError((e as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function handleCreateContract() {
    if (!selectedEmp || !salary) return;
    setCreatingContract(true);
    setContractError(null);
    setContractSuccess(false);
    try {
      const res = await authFetch("/api/contracts/create", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmp.id,
          salary: Number(salary),
          interval: payInterval,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContractSuccess(true);
      fetchData();
    } catch (e: unknown) {
      setContractError((e as Error).message);
    } finally {
      setCreatingContract(false);
    }
  }

  const statusDot = (s: string) =>
    s === "active" ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
    : s === "claimed" ? "bg-yellow-500"
    : "bg-gray-600";

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-[15px]">Sign in to access your dashboard.</p>
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

      {isConnected && chainId !== sepolia.id && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[13px]">
          <span>Switch to Ethereum Sepolia to use ENS features</span>
          <button
            onClick={() => switchChainAsync({ chainId: sepolia.id })}
            className="text-[12px] text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
          >
            Switch
          </button>
        </div>
      )}
      {!isConnected && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[13px]">
          <span>Reconnect wallet to invite employees</span>
          <ConnectButton />
        </div>
      )}

      <main className="relative z-10 max-w-[1100px] mx-auto px-6 pt-32 pb-20 space-y-8">
        {/* Glow */}
        <div className="fixed top-[20%] left-[60%] -translate-x-1/2 w-[600px] h-[600px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none z-0" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-2">CFO Dashboard</p>
            <h1 className="text-4xl font-medium tracking-tight text-white">Treasury & Payroll</h1>
            {company && (
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 uppercase tracking-widest">ENS</span>
                  <span className="text-[13px] text-blue-400">{company.ens_name}</span>
                </div>
                {company.bitgo_receive_address && (
                  <>
                    <div className="w-[1px] h-3 bg-white/[0.08]" />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 uppercase tracking-widest">Treasury</span>
                      <span className="text-[13px] font-mono text-gray-400">
                        {company.bitgo_receive_address.slice(0, 10)}…
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <ConnectButton />
        </div>

        {/* Divider */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Invite Employee */}
        <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-5">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">01</p>
            <h2 className="text-[18px] font-medium text-white">Invite Employee</h2>
            <p className="text-[13px] text-gray-500 mt-1">
              Signs a tx from your wallet creating the ENS subdomain.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-widest">Wallet Address</label>
              <input
                value={inviteWallet}
                onChange={(e) => setInviteWallet(e.target.value)}
                placeholder="0x..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] font-mono text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-widest">ENS Label</label>
              <div className="flex items-center gap-2">
                <input
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="alice"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
                />
                {company && (
                  <span className="text-[11px] text-gray-600 whitespace-nowrap">.{company.ens_name}</span>
                )}
              </div>
            </div>
          </div>

          {inviteError && (
            <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
              <p className="text-red-400 text-[13px]">{inviteError}</p>
            </div>
          )}

          <button
            onClick={handleInvite}
            disabled={!inviteWallet || !inviteLabel || inviting || !company}
            className="py-2.5 px-6 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
          >
            {inviting ? "Signing ENS tx…" : "Invite & Create Subdomain"}
          </button>
        </div>

        {/* Employees Table */}
        <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-white/[0.01]">
          <div className="px-6 py-4 border-b border-white/[0.08]">
            <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">02</p>
            <h2 className="text-[18px] font-medium text-white">Employees</h2>
          </div>

          {loadingEmps ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 text-[13px]">Loading…</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 text-[13px]">No employees yet. Invite one above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">ENS Name</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Wallet</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Status</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Contract</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const contracts = Array.isArray(emp.contracts) ? emp.contracts : [];
                    const hasContract = contracts.length > 0;
                    const latestContract = hasContract
                      ? [...contracts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                      : null;
                    const canCreateContract = emp.status === "claimed" && !hasContract;
                    const showCreateContract = !hasContract;

                    return (
                      <tr key={emp.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(emp.status)}`} />
                            <span className="text-[14px] text-white">{emp.ens_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[13px] font-mono text-gray-400">{emp.wallet_address.slice(0, 10)}…{emp.wallet_address.slice(-6)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] text-gray-500 uppercase tracking-widest">{emp.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          {hasContract && latestContract ? (
                            <span className="text-[12px] text-gray-400">
                              {new Date(latestContract.created_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-[12px] text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {showCreateContract ? (
                            canCreateContract ? (
                              <button
                                onClick={() => {
                                  setSelectedEmp(emp);
                                  setContractSuccess(false);
                                  setContractError(null);
                                  setSalary("");
                                }}
                                className="px-3 py-1.5 rounded-full border border-white/[0.08] text-[11px] text-white hover:bg-white/[0.08] transition-colors uppercase tracking-widest"
                              >
                                Create Contract
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedEmp(emp);
                                  setContractError(null);
                                  setContractSuccess(false);
                                }}
                                className="px-3 py-1.5 rounded-full border border-amber-500/30 text-[11px] text-amber-400 hover:bg-amber-500/10 transition-colors uppercase tracking-widest"
                              >
                                Create Contract
                              </button>
                            )
                          ) : hasContract ? (
                            <span className="text-[11px] text-gray-500 uppercase tracking-widest">Active</span>
                          ) : (
                            <span className="text-[11px] text-gray-600">—</span>
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
      </main>

      {/* Contract Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="border border-white/[0.08] bg-[#0a0a0a] rounded-2xl p-8 w-full max-w-md space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">Issue Contract</p>
                <p className="text-blue-400 text-[15px]">{selectedEmp.ens_name}</p>
              </div>
              <button
                onClick={() => { setSelectedEmp(null); setContractError(null); }}
                className="text-gray-600 hover:text-white transition-colors text-[18px] leading-none"
              >
                ✕
              </button>
            </div>

            <div className="w-full h-[1px] bg-white/[0.06]" />

            {selectedEmp.status !== "claimed" ? (
              <div className="space-y-4">
                <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl px-4 py-3">
                  <p className="text-amber-400 text-[13px]">
                    This employee must claim their ENS subdomain first. Send them to{" "}
                    <a href="/employee/claim" target="_blank" rel="noopener noreferrer" className="underline">
                      /employee/claim
                    </a>
                  </p>
                </div>
              </div>
            ) : (
            <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-widest">Monthly Salary (USDC)</label>
                <input
                  type="number"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="5000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-widest">Payment Interval</label>
                <select
                  value={payInterval}
                  onChange={(e) => setPayInterval(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white outline-none focus:border-white/20 transition-colors"
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            {contractError && (
              <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                <p className="text-red-400 text-[13px]">{contractError}</p>
              </div>
            )}
            {contractSuccess && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <p className="text-[13px] text-gray-300">Contract issued and encrypted on Fileverse.</p>
              </div>
            )}

            {selectedEmp.status === "claimed" && (
              <button
                onClick={handleCreateContract}
                disabled={!salary || creatingContract}
                className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
              >
                {creatingContract ? "Encrypting & uploading…" : "Issue Encrypted Contract"}
              </button>
            )}
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
