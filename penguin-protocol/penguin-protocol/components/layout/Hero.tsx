"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Hero() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="relative z-10 w-full min-h-screen flex items-center pt-24 pb-16">
      <div className="max-w-[1200px] w-full mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* Left: Description */}
        <div
          className="space-y-6 transition-all duration-700 ease-out"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}
        >
          <div className="space-y-3">
            <h1 className="text-[40px] md:text-[52px] lg:text-[56px] leading-[1.08] font-medium tracking-tight text-white">
              Payroll that stays between you and your team.
            </h1>
            <p className="text-[16px] md:text-[17px] text-gray-400 leading-relaxed max-w-lg">
              Companies run treasury on BitGo. Employees get paid to their wallet.
              Contracts and amounts stay encrypted.
            </p>
          </div>

          <div
            className="flex flex-wrap gap-6 pt-1 transition-all duration-700 ease-out"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(16px)",
              transitionDelay: "150ms",
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[26px] font-medium tracking-tight text-white">2-of-3</span>
              <span className="text-[11px] text-gray-500 uppercase tracking-widest">BitGo multi-sig</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[26px] font-medium tracking-tight text-white">Encrypted</span>
              <span className="text-[11px] text-gray-500 uppercase tracking-widest">contracts on IPFS</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[26px] font-medium tracking-tight text-white">ENS</span>
              <span className="text-[11px] text-gray-500 uppercase tracking-widest">identity layer</span>
            </div>
          </div>
        </div>

        {/* Right: Logo */}
        <div
          className="flex justify-center lg:justify-end transition-all duration-700 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.96)",
            transitionDelay: "100ms",
          }}
        >
          <Image
            src="/logo.png"
            alt="ShieldPay"
            width={480}
            height={480}
            className="w-[280px] h-[280px] md:w-[360px] md:h-[360px] lg:w-[420px] lg:h-[420px] object-contain"
            priority
          />
        </div>
      </div>
    </main>
  );
}
