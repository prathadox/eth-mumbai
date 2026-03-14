import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/layout/Hero";
import Architecture from "@/components/layout/Architecture";
import Integrations from "@/components/layout/Integrations";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative flex flex-col">
      {/* Subtle Background Glow */}
      <div className="absolute top-[20%] left-[60%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

      <Navbar />
      <Hero />
      <Architecture />
      <Integrations />
      
      {/* Minimal Footer */}
      <footer className="w-full border-t border-white/[0.08] py-8 mt-auto z-10">
        <div className="max-w-[1200px] mx-auto px-6 flex justify-between items-center text-[13px] text-gray-500">
          <span>© 2026 ShieldPay</span>
          <span>Built at ETHMumbai</span>
        </div>
      </footer>
    </div>
  );
}