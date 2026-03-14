// Prevent static prerendering — providers require a real WalletConnect projectId at runtime
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="text-gray-400">Page not found.</p>
        <a href="/" className="text-indigo-400 underline text-sm">Go home</a>
      </div>
    </main>
  );
}
