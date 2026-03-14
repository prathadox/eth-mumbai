import Link from "next/link";

export default function Hero() {
  return (
    <main className="relative z-10 w-full min-h-screen flex flex-col justify-between pt-[220px] pb-12">
      
      {/* Main Header Area */}
      <div className="max-w-[1200px] w-full mx-auto px-6">
        <h1 className="text-[56px] md:text-[76px] leading-[1.05] font-medium tracking-tight text-white mb-8">
          Private Payroll for the <br />
          <span className="text-gray-400">Internet Economy</span>
        </h1>

        <Link 
          href="/dashboard"
          className="inline-flex px-6 py-2.5 rounded-full border border-white/20 text-white text-[15px] hover:bg-white/[0.08] transition-colors"
        >
          Launch Dashboard
        </Link>
      </div>

      {/* Bottom Stats Bar - Text Only, No SVGs */}
      <div className="w-full px-6 mt-24">
        <div className="max-w-[1200px] mx-auto">
          {/* Fading divider line */}
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8"></div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-start">
            
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[28px] md:text-[32px] font-medium tracking-tight">2-of-3</h3>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                BITGO MULTI-SIG
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-[28px] md:text-[32px] font-medium tracking-tight">100%</h3>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                AMOUNT PRIVACY
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-[28px] md:text-[32px] font-medium tracking-tight">$0.00</h3>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                GAS FEES
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-[28px] md:text-[32px] font-medium tracking-tight">ERC-5564</h3>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                STEALTH ADDR
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-[28px] md:text-[32px] font-medium tracking-tight">Base</h3>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                L2 NETWORK
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}