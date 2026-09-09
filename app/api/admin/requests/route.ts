import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/requests — recent audit + lab requests across all users
 * (admin only). Used by the Admin "Requests" tab.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);

  const supabase = await getSupabaseServer();

  const [auditRes, labRes] = await Promise.all([
    supabase
      .from("audit_requests")
      .select("id, user_id, tool_slug, tool_name, document_name, status, used_credits, error_message, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("lab_requests")
      .select("id, user_id, lab_slug, status, used_credits, error_message, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  return NextResponse.json({
    auditRequests: auditRes.data ?? [],
    labRequests: labRes.data ?? [],
    errors: [auditRes.error?.message, labRes.error?.message].filter(Boolean),
  });
}
