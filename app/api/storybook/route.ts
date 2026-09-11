import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/db/supabase-server";
import { requireAuth, deductCredits } from "@/lib/auth/session";
import { getStorybookSettings } from "@/lib/storybook/settings";
import { rateLimit, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_THEMES = [
  "adventure",
  "friendship",
  "space",
  "animals",
  "underwater",
  "magic",
  "bedtime",
];
const ALLOWED_STYLES = ["watercolor", "cartoon", "pixar3d", "storybook"];
const ALLOWED_LANGUAGES = ["en", "hi", "es"];
const ALLOWED_GENDERS = ["unspecified", "boy", "girl"];
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "hero";
}

/**
 * GET /api/storybook — list the signed-in user's storybook orders.
 */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("storybook_orders")
    .select(
      "id, status, child_name, theme, art_style, language, page_count, created_at, updated_at, error_message, pdf_path, share_slug",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data ?? [] });
}

/**
 * POST /api/storybook — create a storybook order.
 * multipart/form-data: photo (required file), childName, childAge, gender,
 * theme, artStyle, language, pageCount, dedication, storyIdea, consent.
 * Charges credits immediately; generation advances via /api/storybook/[id]/advance.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const status = e instanceof Error && "statusCode" in e ? (e as { statusCode: number }).statusCode : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status });
  }

  // Abuse guard: at most 3 new orders per minute per user.
  const rl = rateLimit(`storybook-create:${user.id}`, 3, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  // Product on/off (admin).
  const settings = await getStorybookSettings();
  if (!settings.enabled) {
    return NextResponse.json(
      { error: "Storybooks are temporarily disabled by the administrator." },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const childName = String(form.get("childName") ?? "").trim();
  const consent = String(form.get("consent") ?? "") === "true";
  const childAgeRaw = String(form.get("childAge") ?? "").trim();
  const gender = String(form.get("gender") ?? "unspecified");
  const theme = String(form.get("theme") ?? "adventure");
  const artStyle = String(form.get("artStyle") ?? "watercolor");
  const language = String(form.get("language") ?? "en");
  const pageCountRaw = Number(form.get("pageCount") ?? settings.defaultPageCount);
  const dedication = String(form.get("dedication") ?? "").trim().slice(0, 200) || null;
  const storyIdea = String(form.get("storyIdea") ?? "").trim().slice(0, 500) || null;

  // --- Validation ---
  if (!childName || childName.length > 40) {
    return NextResponse.json({ error: "Child name is required (max 40 characters)." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Parental consent is required before we can use the child's photo." },
      { status: 400 },
    );
  }
  if (!ALLOWED_GENDERS.includes(gender) || !ALLOWED_THEMES.includes(theme) ||
      !ALLOWED_STYLES.includes(artStyle) || !ALLOWED_LANGUAGES.includes(language)) {
    return NextResponse.json({ error: "Invalid theme, style, language, or gender option." }, { status: 400 });
  }
  let childAge: number | null = null;
  if (childAgeRaw) {
    const n = Number(childAgeRaw);
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      return NextResponse.json({ error: "Child age must be between 1 and 12." }, { status: 400 });
    }
    childAge = n;
  }
  const pageCount = Number.isInteger(pageCountRaw)
    ? Math.min(settings.maxPageCount, Math.max(settings.minPageCount, pageCountRaw))
    : settings.defaultPageCount;

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A clear photo of the child is required." }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Photo must be under 8 MB." }, { status: 400 });
  }
  const ext = ALLOWED_PHOTO_TYPES[photo.type];
  if (!ext) {
    return NextResponse.json({ error: "Photo must be JPEG, PNG, or WebP." }, { status: 400 });
  }

  // --- Credits (charged up-front, refunded on hard failure) ---
  if (user.profile.credits < settings.pdfCredits) {
    return NextResponse.json(
      { error: `Insufficient credits. Required: ${settings.pdfCredits}, Available: ${user.profile.credits}` },
      { status: 402 },
    );
  }

  const supabase = await getSupabaseServer();

  // --- Store the photo in the private bucket (service role, RLS-free path) ---
  const buffer = Buffer.from(await photo.arrayBuffer());
  const photoPath = `${user.id}/pending/photo-${Date.now()}.${ext}`;
  const admin = await getSupabaseAdmin();
  const { error: uploadErr } = await admin.storage
    .from("storybook-assets")
    .upload(photoPath, buffer, { contentType: photo.type });
  if (uploadErr) {
    return NextResponse.json({ error: "Photo upload failed. Please try again." }, { status: 500 });
  }

  // --- Create the order ---
  const { data: order, error: insertErr } = await (supabase as any)
    .from("storybook_orders")
    .insert({
      user_id: user.id,
      status: "draft",
      child_name: childName,
      child_age: childAge,
      gender,
      theme,
      art_style: artStyle,
      language,
      page_count: pageCount,
      dedication,
      story_idea: storyIdea,
      consent: true,
      photo_path: photoPath,
    })
    .select("id")
    .single();

  if (insertErr || !order) {
    // Roll back the orphaned upload.
    await admin.storage.from("storybook-assets").remove([photoPath]);
    return NextResponse.json({ error: "Could not create the order." }, { status: 500 });
  }

  // --- Charge credits ---
  const deduction = await deductCredits(
    user.id,
    settings.pdfCredits,
    "storybook_order",
    `Storybook for ${childName} (${pageCount} pages)`,
    (order as { id: string }).id,
    "storybook_order",
  );
  if (!deduction.ok) {
    // Refund path: mark failed + delete upload so nothing dangles.
    await (supabase as any)
      .from("storybook_orders")
      .update({ status: "failed", error_message: "Credit deduction failed" })
      .eq("id", (order as { id: string }).id);
    await admin.storage.from("storybook-assets").remove([photoPath]);
    return NextResponse.json({ error: deduction.error ?? "Credit deduction failed" }, { status: 402 });
  }

  return NextResponse.json(
    {
      orderId: (order as { id: string }).id,
      creditsSpent: settings.pdfCredits,
      photoUrl: `/api/storybook/${(order as { id: string }).id}/photo?name=${slugify(childName)}`,
    },
    { status: 201 },
  );
}
