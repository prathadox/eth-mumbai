export default function Integrations() {
    return (
      <section id="security" className="w-full relative z-10 py-32 px-6 bg-[#050505]">
        <div className="max-w-[1200px] mx-auto">
          
          {/* Section Header */}
          <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-4">
                Enterprise Infrastructure
              </h2>
              <p className="text-lg text-gray-400 max-w-xl">
                ShieldPay is built on battle-tested primitives to ensure absolute privacy and institutional-grade security.
              </p>
            </div>
            
            <div className="text-[13px] font-medium text-gray-500 uppercase tracking-widest">
              Powered by Web3 Leaders
            </div>
          </div>
  
          {/* Brutalist Grid Layout */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 border border-white/[0.08] rounded-2xl overflow-hidden">
            
            {/* Integration 1: BitGo */}
            <div className="p-8 border-b md:border-b-0 lg:border-r border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
              <div className="w-2 h-2 bg-white rounded-sm mb-8 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="text-xl font-medium text-white mb-2">BitGo SDK</h3>
              <p className="text-[14px] leading-relaxed text-gray-400">
                Company treasuries are secured by 2-of-3 multi-sig wallets. Co-signing guarantees funds are safe before batch execution.
              </p>
            </div>
  
            {/* Integration 2: Base */}
            <div className="p-8 border-b md:border-b-0 lg:border-r border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
              <div className="w-2 h-2 bg-blue-500 rounded-sm mb-8 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="text-xl font-medium text-white mb-2">Base Network</h3>
              <p className="text-[14px] leading-relaxed text-gray-400">
                Deployed entirely on Base to ensure high-throughput and sub-cent transaction fees for enterprise-scale payroll batches.
              </p>
            </div>
  
            {/* Integration 3: Privacy/Stealth */}
            <div className="p-8 border-b md:border-b-0 lg:border-r border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
              <div className="w-2 h-2 bg-purple-500 rounded-sm mb-8 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="text-xl font-medium text-white mb-2">ERC-5564 Privacy</h3>
              <p className="text-[14px] leading-relaxed text-gray-400">
                Native stealth address integration completely breaks the link between the company's treasury and the employee's identity.
              </p>
            </div>
  
            {/* Integration 4: ENS & Pimlico */}
            <div className="p-8 bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
              <div className="w-2 h-2 bg-yellow-500 rounded-sm mb-8 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="text-xl font-medium text-white mb-2">ENS & Pimlico</h3>
              <p className="text-[14px] leading-relaxed text-gray-400">
                ERC-6538 ENS registry for resolving employee stealth meta-addresses, combined with Pimlico Paymasters for zero-gas claiming.
              </p>
            </div>
  
          </div>
  
        </div>
      </section>
    );
  }