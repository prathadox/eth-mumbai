"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export default function HeroConnect() {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <p className="text-[13px] text-gray-500 uppercase tracking-widest">Get started</p>
      <ConnectButton />
      <p className="text-[12px] text-gray-600 max-w-[220px] text-center">
        Connect your wallet to onboard your company or claim your employee identity.
      </p>
      <div className="flex items-center gap-4 pt-2">
        <Link
          href="/company/onboard"
          className="text-[13px] text-gray-400 hover:text-white transition-colors"
        >
          CFO Dashboard →
        </Link>
        <span className="text-white/[0.2]">·</span>
        <Link
          href="/employee/claim"
          className="text-[13px] text-gray-400 hover:text-white transition-colors"
        >
          Employee Portal →
        </Link>
      </div>
    </div>
  );
}
