import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { requireAuth } from "@/lib/auth/session";
import { podGetJob } from "@/lib/storybook/pod";

export const dynamic = "force-dynamic";

/**
 * GET /api/storybook/[id]/pod/status — live print-job status + tracking.
 * Refreshes the cached pod_status on the order so the library shows the
 * latest state without extra client logic.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseServer();
  const { data: order } = await (supabase as any)
    .from("storybook_orders")
    .select("id, user_id, pod_job_id, pod_status")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const row = order as { id: string; user_id: string; pod_job_id: string | null; pod_status: string | null };

  if (!row.pod_job_id) {
    return NextResponse.json({ status: null, trackingUrls: [] });
  }

  const job = await podGetJob(row.pod_job_id).catch(() => null);
  if (job) {
    await (supabase as any)
      .from("storybook_orders")
      .update({ pod_status: job.status, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return NextResponse.json({ status: job.status, trackingUrls: job.trackingUrls ?? [] });
  }

  return NextResponse.json({ status: row.pod_status, trackingUrls: [] });
}
