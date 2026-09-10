import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/public/[slug] — read-only view of a publicly-shared report.
 * No auth: works for anyone with the link. Only reports explicitly shared by
 * their owner are returned; nothing else is ever exposed.
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from("audit_reports")
    .select(
      "tool_slug, tool_name, document_name, risk_score, risk_label, summary, report_data, findings_count, critical_count, high_count, medium_count, low_count, created_at, is_publicly_shared, public_share_slug",
    )
    .eq("public_share_slug", params.slug)
    .eq("is_publicly_shared", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Strip nothing else — report_data already excludes the raw document text.
  return NextResponse.json({ report: data });
}
