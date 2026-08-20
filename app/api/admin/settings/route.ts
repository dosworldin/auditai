import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db/supabase-server";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/settings — Read all admin settings (admin only).
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const supabase: any = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("admin_settings")
    .select("*")
    .order("category");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by category
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const row of data) {
    if (!grouped[row.category]) grouped[row.category] = {};
    grouped[row.category][row.key] = row.value;
  }

  return NextResponse.json({ settings: grouped, raw: data });
}

/**
 * PUT /api/admin/settings — Update admin settings (admin only).
 */
export async function PUT(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { key, value } = body;

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const supabase: any = await getSupabaseServer();
  const { error } = await supabase
    .from("admin_settings")
    .upsert({
      key,
      value,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, key, value });
}

/**
 * PATCH /api/admin/settings — Batch update multiple settings.
 */
export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const body = await request.json();
  const { settings } = body;

  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "settings object required" }, { status: 400 });
  }

  const supabase: any = await getSupabaseServer();
  const updates = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_by: admin.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("admin_settings")
    .upsert(updates, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(settings).length });
}
