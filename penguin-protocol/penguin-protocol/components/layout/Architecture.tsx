export default function Architecture() {
    return (
      <section id="architecture" className="w-full relative z-10 py-32 px-6 bg-[#050505] border-t border-white/[0.05]">
        <div className="max-w-[1200px] mx-auto">
          
          {/* Section Header */}
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-4">
              How ShieldPay Works
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl">
              A privacy-first pipeline from the company treasury to the employee's wallet.
            </p>
          </div>
  
          {/* 3-Step Grid */}
          <div className="grid md:grid-cols-3 gap-6 md:gap-12">
            
            {/* Step 01 */}
            <div className="flex flex-col relative">
              {/* Top Border Line (connecting logic) */}
              <div className="hidden md:block absolute top-0 left-0 w-full h-[1px] bg-white/[0.08]"></div>
              
              <div className="pt-6">
                <span className="text-sm font-semibold text-blue-500 tracking-widest mb-4 block">01</span>
                <h3 className="text-2xl font-medium text-white mb-3">Treasury Multi-Sig</h3>
                <p className="text-[15px] leading-relaxed text-gray-400">
                  The CFO initiates payroll via a BitGo 2-of-3 multi-sig wallet. Institutional-grade custody ensures company funds are secure before distribution.
                </p>
              </div>
            </div>
  
            {/* Step 02 */}
            <div className="flex flex-col relative">
              <div className="hidden md:block absolute top-0 left-0 w-full h-[1px] bg-white/[0.08]"></div>
              
              <div className="pt-6">
                <span className="text-sm font-semibold text-white tracking-widest mb-4 block">02</span>
                <h3 className="text-2xl font-medium text-white mb-3">Multi-Stealth Split</h3>
                <p className="text-[15px] leading-relaxed text-gray-400">
                  Smart contracts use ERC-5564 to generate 2-4 randomized ephemeral addresses per employee. Salary is split, destroying amount clustering and hierarchy leaks.
                </p>
              </div>
            </div>
  
            {/* Step 03 */}
            <div className="flex flex-col relative">
              <div className="hidden md:block absolute top-0 left-0 w-full h-[1px] bg-white/[0.08]"></div>
              
              <div className="pt-6">
                <span className="text-sm font-semibold text-white tracking-widest mb-4 block">03</span>
                <h3 className="text-2xl font-medium text-white mb-3">Gasless Claiming</h3>
                <p className="text-[15px] leading-relaxed text-gray-400">
                  Employees visit the portal, their wallet scans the registry, and sweeps all stealth addresses into their main wallet. Zero gas fees, sponsored via Pimlico.
                </p>
              </div>
            </div>
  
          </div>
        </div>
      </section>
    );
  }