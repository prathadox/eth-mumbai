import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy browser client — only created when first used
let _browser: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_browser) {
    _browser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _browser;
}

// Server client — uses service role key, bypasses RLS
// Only import in API routes / server components
export function supabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
