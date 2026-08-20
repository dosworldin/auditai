import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/settings/service — Read all admin settings (public read).
 * Used by client-side code to get runtime configuration.
 */
export async function GET() {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("key, value, category");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped: Record<string, Record<string, unknown>> = {};
  for (const row of data) {
    if (!grouped[row.category]) grouped[row.category] = {};
    grouped[row.category][row.key] = row.value;
  }

  return NextResponse.json({ settings: grouped });
}
