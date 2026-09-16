import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

function guard(e: unknown): NextResponse {
  const status =
    e instanceof Error && "statusCode" in e
      ? (e as { statusCode: number }).statusCode ?? 401
      : 401;
  return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
}

/**
 * GET /api/admin/activity
 * Returns unread counts per event type (for tab badges), total, and the most
 * recent events. "Unread" = newer than the admin's last-seen timestamp,
 * tracked client-side per browser via the `since` param.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    return guard(e);
  }

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  const validSince = since && !Number.isNaN(since.getTime()) ? since.toISOString() : null;

  const supabase = await getSupabaseAdmin();

  // Recent events (last 24h window, capped at 50) for the live feed card.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from("admin_activity")
    .select("id, event_type, summary, created_at")
    .gte("created_at", since24h)
    .order("created_at", { ascending: false })
    .limit(50);

  if (recentError) return NextResponse.json({ error: recentError.message }, { status: 500 });

  // Unread counts per type, relative to `since`.
  const counts: Record<string, number> = {};
  let totalUnread = 0;
  if (validSince) {
    const { data: unread, error: unreadError } = await supabase
      .from("admin_activity")
      .select("event_type")
      .gt("created_at", validSince)
      .limit(500);
    if (!unreadError) {
      for (const row of unread ?? []) {
        counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
        totalUnread += 1;
      }
    }
  }

  return NextResponse.json({
    now: new Date().toISOString(),
    total_unread: totalUnread,
    counts,
    recent: recent ?? [],
  });
}
