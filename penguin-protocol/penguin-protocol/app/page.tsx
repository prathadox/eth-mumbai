import Navbar from "@/components/layout/Navbar";

export default function LandingPage() {
  return (
    // Extremely dark background, almost black to match the screenshot
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar />
      
      {/* Rest of the page goes here later */}
      <main className="pt-40 px-6 max-w-7xl mx-auto flex flex-col items-center">
         {/* Placeholder for the hero */}
      </main>
    </div>
  );
}