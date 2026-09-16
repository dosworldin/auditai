import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

interface InviteRow {
  code: string;
  type: "invite" | "open";
  created_by: string | null;
  max_uses: number | null;
  uses: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  owner_email?: string | null;
}

function guard(e: unknown): NextResponse {
  const status =
    e instanceof Error && "statusCode" in e
      ? (e as { statusCode: number }).statusCode ?? 401
      : 401;
  return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
}

/** GET /api/admin/invites — list all invite/coupon codes with usage. */
export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return guard(e);
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve owner emails (best-effort)
  const rows = (data ?? []) as InviteRow[];
  const ownerIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const emails = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);
    for (const o of owners ?? []) emails.set(o.id, o.email);
  }

  return NextResponse.json({
    invites: rows.map((r) => ({ ...r, owner_email: r.created_by ? emails.get(r.created_by) ?? null : null })),
  });
}

/** PUT /api/admin/invites — create a code. Body: { type, code?, max_uses?, note? } */
export async function PUT(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return guard(e);
  }

  const body = await request.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;
  const type = b.type === "open" ? "open" : "invite";

  // Explicit code (admin coupon) or auto-generate.
  let code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  if (code) {
    if (!/^[A-Z0-9]{3,16}$/.test(code)) {
      return NextResponse.json({ error: "Code must be 3–16 letters/numbers" }, { status: 400 });
    }
  } else {
    code = `INV${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  const maxUses =
    b.max_uses === null || b.max_uses === undefined || b.max_uses === ""
      ? null
      : Math.max(1, Math.floor(Number(b.max_uses)) || 0) || null;

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("invite_codes")
    .upsert(
      {
        code,
        type,
        created_by: admin.id,
        max_uses: maxUses,
        is_active: true,
        note: typeof b.note === "string" ? b.note.trim() || null : null,
      },
      { onConflict: "code" },
    )
    .select("code")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, code: data.code });
}

/**
 * PATCH /api/admin/invites — toggle active state.
 * Body: { code, is_active: boolean }
 */
export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    return guard(e);
  }

  const body = await request.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  if (!code || typeof b.is_active !== "boolean") {
    return NextResponse.json({ error: "code and is_active are required" }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from("invite_codes")
    .update({ is_active: b.is_active })
    .eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/invites?code=XYZ */
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    return guard(e);
  }

  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("invite_codes").delete().eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
