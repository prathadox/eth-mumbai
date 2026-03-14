// components/layout/Navbar.tsx
import Link from 'next/link';
import { Shield, Zap } from 'lucide-react';

export default function Navbar() {
  return (
    <div className="fixed top-6 w-full flex justify-center z-50 px-4">
      {/* Main Pill Wrapper - Ethena Aesthetic */}
      <nav className="flex items-center justify-between bg-[#0a0a0a]/90 backdrop-blur-md border border-white/[0.08] rounded-full pl-5 pr-2 py-2 text-[13px] font-medium text-gray-400 max-w-[1100px] w-full shadow-2xl shadow-black/50">
        
        {/* Left: ShieldPay Logo */}
        <Link href="/" className="flex items-center gap-2 pr-8 hover:opacity-80 transition-opacity">
          <Shield className="w-4 h-4 text-white" />
          <span className="text-white text-[15px] tracking-wide">ShieldPay</span>
        </Link>

        {/* Center: ShieldPay Specific Routes */}
        <div className="hidden lg:flex items-center gap-8">
          <Link href="#architecture" className="hover:text-white transition-colors">Architecture</Link>
          <Link href="#security" className="hover:text-white transition-colors">Security</Link>
          <Link href="#developers" className="hover:text-white transition-colors">Developers</Link>
          <Link href="/claim" className="text-white hover:text-white/80 transition-colors">Employee Portal</Link>
        </div>

        {/* Right: Hackathon Stats & Dashboard App */}
        <div className="flex items-center gap-3">
          
          {/* Inner Stats Pill (Replaced TVL/APY with Network/Gas) */}
          <div className="hidden md:flex items-center px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] gap-3">
            <div className="flex items-center gap-1.5 cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span> 
              Base Sepolia
            </div>
            <div className="w-[1px] h-3 bg-white/[0.08]"></div>
            <div className="flex items-center gap-1.5 cursor-default">
              <Zap className="w-3.5 h-3.5 text-yellow-500" /> 
              Gasless
            </div>
          </div>

          {/* CFO Dashboard Button */}
          <Link 
            href="/dashboard" 
            className="text-white px-5 py-2 rounded-full border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
          >
            CFO Dashboard
          </Link>
        </div>

      </nav>
    </div>
  );
}