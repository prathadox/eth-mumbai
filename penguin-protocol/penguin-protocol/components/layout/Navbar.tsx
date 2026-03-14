import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <div className="fixed top-6 w-full flex justify-center z-50 px-4">
      {/* Main Pill Wrapper */}
      <nav className="flex items-center justify-between bg-[#0a0a0a]/90 backdrop-blur-md border border-white/[0.08] rounded-full pl-6 pr-2 py-2 text-[13px] font-medium text-gray-400 max-w-[1100px] w-full shadow-2xl shadow-black/50">
        
        {/* Left: Your PNG Logo & Text */}
        <Link href="/" className="flex items-center gap-3 pr-8 hover:opacity-80 transition-opacity">
          <Image 
            src="/logo.png" 
            alt="ShieldPay Logo" 
            width={24} 
            height={24} 
            className="w-6 h-6 object-contain" 
            priority
          />
          <span className="text-white text-[15px] tracking-wide font-semibold">ShieldPay</span>
        </Link>

        {/* Center: Clean Text Links */}
        <div className="hidden lg:flex items-center gap-8">
          <Link href="#architecture" className="hover:text-white transition-colors">Architecture</Link>
          <Link href="#security" className="hover:text-white transition-colors">Security</Link>
          <Link href="#developers" className="hover:text-white transition-colors">Developers</Link>
          <Link href="/claim" className="text-white hover:text-white/80 transition-colors">Employee Portal</Link>
        </div>

        {/* Right: Text-only Stats & Button */}
        <div className="flex items-center gap-3">
          
          <div className="hidden md:flex items-center px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] gap-3">
            <div className="flex items-center gap-2 cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span> 
              Base Sepolia
            </div>
            
            <div className="w-[1px] h-3 bg-white/[0.08]"></div>
            
            <div className="flex items-center gap-2 cursor-default text-gray-300">
              Gasless
            </div>
          </div>

          <Link 
            href="/dashboard" 
            className="text-white px-5 py-2 rounded-full border border-white/[0.08] hover:bg-white/[0.05] transition-colors font-medium"
          >
            CFO Dashboard
          </Link>
        </div>

      </nav>
    </div>
  );
}