import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">🐧 Penguin Protocol</h1>
        <p className="text-gray-400 text-lg max-w-md">
          Private payroll onboarding with BitGo treasury, ENS identity, and Fileverse encrypted contracts.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/company/onboard"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors"
        >
          Company Onboarding
        </Link>
        <Link
          href="/employee/claim"
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold transition-colors"
        >
          Employee Portal
        </Link>
      </div>
    </main>
  );
}
