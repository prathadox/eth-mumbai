"use client";

import Link from "next/link";
import Image from "next/image";
import { useAccount, useDisconnect } from "wagmi";
import { useSiweAuth } from "@/lib/useSiweAuth";

export default function Navbar() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { isSignedIn, signOut } = useSiweAuth();

  function handleDisconnect() {
    signOut();
    disconnect();
  }

  return (
    <div className="fixed top-6 w-full flex justify-center z-50 px-4">
      <nav className="flex items-center justify-between bg-[#0a0a0a]/90 backdrop-blur-md border border-white/[0.08] rounded-full pl-6 pr-2 py-2 text-[13px] font-medium text-gray-400 max-w-[1100px] w-full shadow-2xl shadow-black/50">

        <Link href="/" className="flex items-center gap-3 pr-8 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="ShieldPay Logo" width={24} height={24} className="w-6 h-6 object-contain" priority />
          <span className="text-white text-[15px] tracking-wide font-semibold">Penguin pay</span>
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          <Link href="#architecture" className="hover:text-white transition-colors">Architecture</Link>
          <Link href="#security" className="hover:text-white transition-colors">Security</Link>
          <Link href="#developers" className="hover:text-white transition-colors">Developers</Link>
          <Link href="/employee/claim" className="text-white hover:text-white/80 transition-colors">Employee Portal</Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] gap-3">
            <div className="flex items-center gap-2 cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
              Ethereum Sepolia
            </div>
            <div className="w-[1px] h-3 bg-white/[0.08]" />
            <span className="text-gray-300 cursor-default">Gasless</span>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02]">
                {isSignedIn && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
                <span className="text-[13px] font-mono text-gray-400">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-gray-500 hover:text-red-400 text-[12px] px-3 py-2 rounded-full border border-white/[0.06] hover:border-red-500/20 hover:bg-red-500/5 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <Link
              href="/company/onboard"
              className="text-white px-5 py-2 rounded-full border border-white/[0.08] hover:bg-white/[0.05] transition-colors font-medium"
            >
              CFO Dashboard
            </Link>
          )}
        </div>

      </nav>
    </div>
  );
}
