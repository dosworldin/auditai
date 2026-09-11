import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/storybook — all storybook orders for the admin panel.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const admin = await getSupabaseAdmin();
  const { data, error } = await (admin as any)
    .from("storybook_orders")
    .select(
      "id, user_id, status, child_name, theme, art_style, language, page_count, credits_spent, provider, error_message, share_slug, pdf_path, created_at, updated_at, profiles(email, display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as { email?: string; display_name?: string } | null;
    return { ...row, email: profile?.email ?? null, display_name: profile?.display_name ?? null };
  });

  return NextResponse.json({ orders: rows });
}
