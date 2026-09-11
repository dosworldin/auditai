import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "storybook";
}

/**
 * GET /api/storybook/[id]/pdf — signed download of the composed book.
 * Owner-only. Streams the PDF with a friendly filename.
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

  const admin = await getSupabaseAdmin();
  const { data: order } = await (admin as any)
    .from("storybook_orders")
    .select("id, user_id, pdf_path, child_name")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const row = order as { id: string; pdf_path: string | null; child_name: string };
  if (!row.pdf_path) {
    return NextResponse.json({ error: "The PDF is not ready yet." }, { status: 409 });
  }

  const { data, error } = await admin.storage
    .from("storybook-assets")
    .download(row.pdf_path);
  if (error || !data) {
    return NextResponse.json({ error: "Could not read the PDF." }, { status: 500 });
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  const filename = `${slugify(row.child_name)}-storybook.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
