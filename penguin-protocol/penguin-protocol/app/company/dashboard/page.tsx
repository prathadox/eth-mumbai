"use client";

export const dynamic = "force-dynamic";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract } from "wagmi";
import { useEffect, useState } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { ethers } from "ethers";
import Navbar from "@/components/layout/Navbar";

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

type Employee = {
  id: number;
  wallet_address: string;
  ens_name: string;
  status: string;
};

type Company = {
  ens_name: string;
  bitgo_receive_address: string;
};

export default function CompanyDashboard() {
  const { isConnected } = useAccount();
  const { isSignedIn, signIn, authFetch } = useSiweAuth();
  const { writeContractAsync } = useWriteContract();

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
      const parentNode = ethers.namehash(company.ens_name) as `0x${string}`;
      const labelHash = ethers.keccak256(ethers.toUtf8Bytes(inviteLabel)) as `0x${string}`;
      const ensName = `${inviteLabel}.${company.ens_name}`;

      const txHash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_ENS_REGISTRY_ADDRESS as `0x${string}`,
        abi: ENS_REGISTRY_ABI,
        functionName: "setSubnodeOwner",
        args: [parentNode, labelHash, inviteWallet as `0x${string}`],
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

        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Invite Employee */}
          <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-5">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">01</p>
              <h2 className="text-[18px] font-medium text-white">Invite Employee</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                Signs a tx from your wallet creating the ENS subdomain.
              </p>
            </div>

            <div className="space-y-3">
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
              className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
            >
              {inviting ? "Signing ENS tx…" : "Invite & Create Subdomain"}
            </button>
          </div>

          {/* Employee List */}
          <div className="border border-white/[0.08] rounded-2xl p-6 bg-white/[0.01] space-y-5">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">02</p>
              <h2 className="text-[18px] font-medium text-white">Employees</h2>
            </div>

            {loadingEmps ? (
              <p className="text-gray-600 text-[13px]">Loading…</p>
            ) : employees.length === 0 ? (
              <p className="text-gray-600 text-[13px]">No employees yet.</p>
            ) : (
              <div className="space-y-1">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(emp.status)}`} />
                        <p className="text-[14px] text-white">{emp.ens_name}</p>
                      </div>
                      <p className="text-[11px] font-mono text-gray-600 pl-3.5">
                        {emp.wallet_address.slice(0, 10)}…
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-500 uppercase tracking-widest">{emp.status}</span>
                      {emp.status === "claimed" && (
                        <button
                          onClick={() => {
                            setSelectedEmp(emp);
                            setContractSuccess(false);
                            setContractError(null);
                            setSalary("");
                          }}
                          className="px-3 py-1 rounded-full border border-white/[0.08] text-[11px] text-white hover:bg-white/[0.08] transition-colors uppercase tracking-widest"
                        >
                          Issue Contract
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                onClick={() => setSelectedEmp(null)}
                className="text-gray-600 hover:text-white transition-colors text-[18px] leading-none"
              >
                ✕
              </button>
            </div>

            <div className="w-full h-[1px] bg-white/[0.06]" />

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

            <button
              onClick={handleCreateContract}
              disabled={!salary || creatingContract}
              className="w-full py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
            >
              {creatingContract ? "Encrypting & uploading…" : "Issue Encrypted Contract"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
