"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract } from "wagmi";
import { useEffect, useState } from "react";
import { useSiweAuth } from "@/lib/useSiweAuth";
import { ethers } from "ethers";

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

  // Invite form
  const [inviteWallet, setInviteWallet] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Contract form
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
    setInviting(true);
    setInviteError(null);

    try {
      // Company wallet calls setSubnodeOwner to create alice.acme.penguin.eth → employeeWallet
      const parentNode = ethers.namehash(company.ens_name) as `0x${string}`;
      const labelHash = ethers.keccak256(ethers.toUtf8Bytes(inviteLabel)) as `0x${string}`;
      const ensName = `${inviteLabel}.${company.ens_name}`;

      const txHash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_ENS_REGISTRY_ADDRESS as `0x${string}`,
        abi: ENS_REGISTRY_ABI,
        functionName: "setSubnodeOwner",
        args: [parentNode, labelHash, inviteWallet as `0x${string}`],
      });

      // Wait for tx to confirm
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL!);
      await provider.waitForTransaction(txHash);

      // Record in DB
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

  const statusColor = (s: string) =>
    s === "active"
      ? "text-green-400"
      : s === "claimed"
      ? "text-yellow-400"
      : "text-gray-500";

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
        <button
          onClick={signIn}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold"
        >
          Sign in to access dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 max-w-4xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Dashboard</h1>
          {company && (
            <p className="text-sm text-gray-400 mt-1">
              ENS: <span className="text-indigo-400">{company.ens_name}</span>
              {company.bitgo_receive_address && (
                <> · Treasury: <span className="font-mono text-xs">{company.bitgo_receive_address.slice(0, 10)}…</span></>
              )}
            </p>
          )}
        </div>
        <ConnectButton />
      </div>

      {/* Invite Employee */}
      <section className="bg-gray-900 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Invite Employee</h2>
        <p className="text-xs text-gray-500">
          This signs a transaction from your wallet creating the ENS subdomain, then records the employee.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-400">Employee Wallet Address</label>
            <input
              value={inviteWallet}
              onChange={(e) => setInviteWallet(e.target.value)}
              placeholder="0x..."
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-400">ENS Label</label>
            <div className="flex items-center gap-2">
              <input
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="alice"
                className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {company && <span className="text-gray-500 text-xs whitespace-nowrap">.{company.ens_name}</span>}
            </div>
          </div>
        </div>
        {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}
        <button
          onClick={handleInvite}
          disabled={!inviteWallet || !inviteLabel || inviting || !company}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold transition-colors"
        >
          {inviting ? "Signing ENS tx…" : "Invite & Create ENS Subdomain"}
        </button>
      </section>

      {/* Employee List */}
      <section className="bg-gray-900 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Employees</h2>
        {loadingEmps ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="text-gray-500 text-sm">No employees yet.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {employees.map((emp) => (
              <div key={emp.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{emp.ens_name}</p>
                  <p className="text-xs text-gray-500 font-mono">{emp.wallet_address.slice(0, 10)}…</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold uppercase ${statusColor(emp.status)}`}>
                    {emp.status}
                  </span>
                  {emp.status === "claimed" && (
                    <button
                      onClick={() => {
                        setSelectedEmp(emp);
                        setContractSuccess(false);
                        setContractError(null);
                        setSalary("");
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold"
                    >
                      Issue Contract
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Contract Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Issue Contract</h2>
              <button onClick={() => setSelectedEmp(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <p className="text-sm text-indigo-400">{selectedEmp.ens_name}</p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Monthly Salary (USDC)</label>
                <input
                  type="number"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="5000"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Payment Interval</label>
                <select
                  value={payInterval}
                  onChange={(e) => setPayInterval(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            {contractError && <p className="text-red-400 text-sm">{contractError}</p>}
            {contractSuccess && <p className="text-green-400 text-sm">✓ Contract issued successfully.</p>}

            <button
              onClick={handleCreateContract}
              disabled={!salary || creatingContract}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold transition-colors"
            >
              {creatingContract ? "Encrypting & uploading to Fileverse…" : "Issue Encrypted Contract"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
