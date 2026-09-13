import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Browser-side Supabase client (singleton).
 *
 * Uses @supabase/ssr's createBrowserClient so the session is stored in
 * COOKIES (not localStorage). This is what makes server-side auth work:
 * API routes read the same cookies via getSupabaseServer() (createServerClient),
 * so requireAuth()/requireAdmin() can identify the user. With the plain
 * supabase-js client the session never reached the server and every
 * protected route returned 401.
 *
 * Uses the anon key — RLS handles authorization.
 */
export function getSupabaseBrowser() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
