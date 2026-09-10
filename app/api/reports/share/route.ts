import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/** POST /api/reports/share — create or revoke a public share link for OWN report. */
export async function POST(request: Request) {
  const supabase: any = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const reportId = typeof body.reportId === "string" ? body.reportId : "";
  const action = body.action === "revoke" ? "revoke" : "create";
  if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 });

  // Growth setting gate
  const { data: setting } = await (supabase as any)
    .from("admin_settings")
    .select("value")
    .eq("key", "share_reports_enabled")
    .single();
  if (setting && setting.value === false) {
    return NextResponse.json({ error: "Report sharing is currently disabled" }, { status: 403 });
  }

  if (action === "revoke") {
    const { error } = await (supabase as any)
      .from("audit_reports")
      .update({ is_publicly_shared: false, public_share_slug: null })
      .eq("id", reportId)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, shared: false });
  }

  const slug = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const { data, error } = await (supabase as any)
    .from("audit_reports")
    .update({ is_publicly_shared: true, public_share_slug: slug })
    .eq("id", reportId)
    .eq("user_id", user.id)
    .select("public_share_slug")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, shared: true, slug: data?.public_share_slug });
}
