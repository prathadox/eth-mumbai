import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar />
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-32 pb-16">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="text-center space-y-6 relative z-10">
          <p className="text-[11px] text-gray-500 uppercase tracking-widest">404</p>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white">
            Page not found.
          </h1>
          <p className="text-[15px] text-gray-500 max-w-sm mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-flex px-6 py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/[0.08] transition-colors"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
