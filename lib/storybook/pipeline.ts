/**
 * Storybook orchestration — the state machine across API requests.
 *
 * draft → story_ready → illustrating → composing_pdf → ready
 *                                       ↘ failed (retryable from any state)
 *
 * Illustrations go through DIRECT providers only (lib/storybook/illustrate.ts):
 * Google Gemini image ("nano banana") first, Leonardo Character Reference as
 * automatic fallback — order set by admin setting storybook_image_provider.
 * Every completed illustration is mirrored into the private bucket, so share
 * links, previews and PDFs never depend on expiring provider CDN URLs.
 *
 * Runs inside API routes via `advanceOrder()`. Vercel serverless budget per
 * request: story ~25s, illustrations ~100s, PDF ~40s. The state machine
 * advances on every client poll until `ready`.
 */

import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import { generateStory, artStylePrompt, type StoryPageInput } from "./story";
import { generateIllustration } from "./illustrate";
import { composeStorybookPdf } from "./pdf";
import { getStorybookSettings } from "./settings";
import { sendStorybookReadyEmail } from "@/lib/email/resend";

export type OrderStatus =
  | "draft"
  | "story_ready"
  | "illustrating"
  | "composing_pdf"
  | "ready"
  | "failed";

export interface StorybookOrderRow {
  id: string;
  user_id: string;
  status: OrderStatus;
  child_name: string;
  child_age: number | null;
  gender: string;
  theme: string;
  art_style: string;
  language: string;
  page_count: number;
  dedication: string | null;
  story_idea: string | null;
  consent: boolean;
  photo_path: string | null;
  story_json: { title?: string; pages?: StoryPageInput[] } | null;
  leonardo_ref_image_id: string | null;
  pages: Record<string, unknown>[];
  pdf_path: string | null;
  share_slug: string | null;
  provider: string | null;
  error_message: string | null;
  credits_spent: number;
  voice_requested: boolean;
  voice_status: string | null;
  narration: Record<string, unknown> | null;
  updated_at: string;
}

// Type alias (not interface) so it is assignable to Record<string, unknown>
// and Array.filter narrowing with the type predicate works.
type StorybookPageState = {
  pageNumber: number;
  text: string;
  illustrationPrompt: string;
  imageUrl: string | null;
  generationId: string | null;
  storagePath?: string | null;
  provider?: string | null;
}

function isStorybookPageState(p: unknown): p is StorybookPageState {
  return (
    typeof p === "object" && p !== null &&
    typeof (p as StorybookPageState).pageNumber === "number" &&
    typeof (p as StorybookPageState).text === "string" &&
    typeof (p as StorybookPageState).illustrationPrompt === "string"
  );
}

async function loadOrder(orderId: string): Promise<StorybookOrderRow | null> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("storybook_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !data) return null;
  return data as unknown as StorybookOrderRow;
}

async function updateOrder(
  orderId: string,
  patch: Partial<StorybookOrderRow>,
): Promise<void> {
  const supabase = await getSupabaseAdmin();
  await supabase
    .from("storybook_orders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", orderId);
}

async function failOrder(orderId: string, message: string): Promise<void> {
  await updateOrder(orderId, { status: "failed", error_message: message.slice(0, 500) });
}

/** Serve-role email helper: fetch the user's email for delivery notification. */
async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = await getSupabaseAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
  return (data as { email?: string } | null)?.email ?? null;
}

/** Private storage read → buffer (service role bypasses RLS). */
async function downloadFromStorage(path: string): Promise<Buffer | null> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from("storybook-assets")
    .download(path);
  if (error || !data) return null;
  const arr = new Uint8Array(await data.arrayBuffer());
  return Buffer.from(arr);
}

function extFromPath(path: string): "png" | "jpeg" | "webp" {
  const ext = (path.split(".").pop() ?? "jpeg").toLowerCase();
  return ext === "png" ? "png" : ext === "webp" ? "webp" : "jpeg";
}

function mimeFromExt(ext: "png" | "jpeg" | "webp"): string {
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

/**
 * Advance an order one production stage per invocation.
 * Returns the current row so API routes can immediately re-poll.
 */
export async function advanceOrder(orderId: string): Promise<StorybookOrderRow | null> {
  const order = await loadOrder(orderId);
  if (!order) return null;

  try {
    switch (order.status) {
      case "draft":
        return await stageStory(order);
      case "story_ready":
        return await stageIllustrations(order);
      case "illustrating":
        // A previous illustration pass was interrupted — resume it.
        return await stageIllustrations(order);
      case "composing_pdf":
        return await stagePdf(order);
      case "ready":
      case "failed":
      default:
        return order;
    }
  } catch (err) {
    await failOrder(orderId, err instanceof Error ? err.message : "Pipeline error");
    return loadOrder(orderId);
  }
}

/* ------------------------------------------------------------------ */
/* Stage 1 — story generation                                         */
/* ------------------------------------------------------------------ */

async function stageStory(order: StorybookOrderRow): Promise<StorybookOrderRow | null> {
  if (!order.consent) {
    await failOrder(order.id, "Parental consent missing — storybook generation blocked.");
    return loadOrder(order.id);
  }
  if (!order.photo_path) {
    await failOrder(order.id, "Child photo missing.");
    return loadOrder(order.id);
  }

  // Story text via the admin AI chain.
  const story = await generateStory({
    childName: order.child_name,
    age: order.child_age,
    gender: order.gender,
    theme: order.theme,
    language: order.language,
    pageCount: order.page_count,
    storyIdea: order.story_idea,
  });

  // Persist per-page state.
  const pageState: StorybookPageState[] = story.pages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text,
    illustrationPrompt: p.illustrationPrompt,
    imageUrl: null,
    generationId: null,
  }));

  await updateOrder(order.id, {
    status: "story_ready",
    story_json: { title: story.title, pages: story.pages },
    pages: pageState as unknown as Record<string, unknown>[],
    error_message: null,
  });

  return loadOrder(order.id);
}

/* ------------------------------------------------------------------ */
/* Stage 2 — illustrations (direct providers, durable storage)        */
/* ------------------------------------------------------------------ */

const ILLUS_BUDGET_MS = 95_000; // stay under Vercel's 120s maxDuration

async function stageIllustrations(order: StorybookOrderRow): Promise<StorybookOrderRow | null> {
  if (!order.story_json?.pages) {
    await failOrder(order.id, "Illustration stage reached without story.");
    return loadOrder(order.id);
  }

  const pages = (order.pages ?? []).filter(isStorybookPageState);
  if (pages.length === 0) {
    await failOrder(order.id, "No page state to illustrate.");
    return loadOrder(order.id);
  }
  if (!order.photo_path) {
    await failOrder(order.id, "Child photo missing — cannot illustrate with character likeness.");
    return loadOrder(order.id);
  }

  const settings = await getStorybookSettings();
  const style = artStylePrompt(order.art_style);

  await updateOrder(order.id, { status: "illustrating" });

  const deadline = Date.now() + ILLUS_BUDGET_MS;
  const supabase = await getSupabaseAdmin();

  // Child photo, loaded once per request.
  const photoBuffer = await downloadFromStorage(order.photo_path);
  if (!photoBuffer) {
    await failOrder(order.id, "Could not read the uploaded photo from storage.");
    return loadOrder(order.id);
  }
  const photoExt = extFromPath(order.photo_path);
  const photoB64 = photoBuffer.toString("base64");
  const photoMime = mimeFromExt(photoExt);

  let usedProvider: string | null = null;

  for (const page of pages) {
    if (page.storagePath) continue; // already illustrated + stored
    if (Date.now() > deadline) break;

    const prompt = `Children's storybook illustration. ${page.illustrationPrompt}. Main subject: a young child hero — ALWAYS the exact same child as in the provided reference photo (same face, same hairstyle, same overall likeness) in every scene. Style: ${style}. No text, no words, no watermarks in the image.`;

    const result = await generateIllustration(
      {
        prompt,
        photoBase64: photoB64,
        photoMime,
        width: 1024,
        height: 768,
      },
      settings.imageProvider,
    );
    usedProvider = result.provider;

    // Mirror into the private bucket immediately — provider CDN URLs expire,
    // bucket copies power share links, previews, PDFs and the library.
    const storagePath = `${order.user_id}/${order.id}/pages/p${page.pageNumber}.png`;
    const { error: upErr } = await supabase.storage
      .from("storybook-assets")
      .upload(storagePath, result.buffer, { contentType: "image/png", upsert: true });
    if (upErr) {
      // Fail-soft: keep the provider URL so the PDF stage can still fetch it.
      page.imageUrl = `data:image/png;base64,${result.buffer.toString("base64")}`;
    } else {
      page.storagePath = storagePath;
      page.imageUrl = null;
    }
    page.provider = result.provider;

    // Persist after every page so interruptions never lose work.
    await updateOrder(order.id, {
      pages: pages as unknown as Record<string, unknown>[],
      provider: usedProvider,
    });
  }

  const allDone = pages.every((p) => p.storagePath || p.imageUrl);
  if (allDone) {
    await updateOrder(order.id, { status: "composing_pdf", pages: pages as unknown as Record<string, unknown>[] });
    return loadOrder(order.id);
  }

  await updateOrder(order.id, { status: "illustrating", pages: pages as unknown as Record<string, unknown>[] });
  return loadOrder(order.id);
}

/* ------------------------------------------------------------------ */
/* Stage 3 — PDF composition + storage + retention + email            */
/* ------------------------------------------------------------------ */

async function stagePdf(order: StorybookOrderRow): Promise<StorybookOrderRow | null> {
  const pages = (order.pages ?? []).filter(isStorybookPageState);
  const title = order.story_json?.title ?? `The Adventures of ${order.child_name}`;
  const supabase = await getSupabaseAdmin();

  // Resolve every illustration: prefer the durable private-bucket copy,
  // fall back to the provider URL when the mirror failed.
  const pdfPages: { pageNumber: number; text: string; image: Buffer | null }[] = [];
  const mirrored: Record<string, unknown>[] = [];
  for (const p of pages) {
    let image: Buffer | null = null;
    let storagePath = p.storagePath ?? null;

    if (storagePath) {
      image = await downloadFromStorage(storagePath);
    }
    if (!image && p.imageUrl && !p.imageUrl.startsWith("data:")) {
      try {
        const res = await fetch(p.imageUrl, { signal: AbortSignal.timeout(30_000) });
        if (res.ok) {
          image = Buffer.from(new Uint8Array(await res.arrayBuffer()));
          if (!storagePath) {
            storagePath = `${order.user_id}/${order.id}/pages/p${p.pageNumber}.png`;
            const { error: mirrorErr } = await supabase.storage
              .from("storybook-assets")
              .upload(storagePath, image, { contentType: "image/png", upsert: true });
            if (mirrorErr) storagePath = null; // fail-soft
          }
        }
      } catch {
        // fail-soft: text-only page
      }
    }
    if (!image && p.imageUrl?.startsWith("data:image/png;base64,")) {
      image = Buffer.from(p.imageUrl.slice("data:image/png;base64,".length), "base64");
    }
    pdfPages.push({ pageNumber: p.pageNumber, text: p.text, image });
    mirrored.push({ ...p, storagePath, imageUrl: null });
  }

  const pdfBuffer = await composeStorybookPdf({
    title,
    childName: order.child_name,
    dedication: order.dedication,
    pages: pdfPages,
  });

  const pdfPath = `${order.user_id}/${order.id}/book.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("storybook-assets")
    .upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    throw new Error(`PDF upload failed: ${uploadErr.message}`);
  }

  // Photo retention: delete the raw child photo per admin policy.
  const settings = await getStorybookSettings();
  if (settings.photoRetentionDays === 0 && order.photo_path) {
    await supabase.storage.from("storybook-assets").remove([order.photo_path]);
    await updateOrder(order.id, { photo_path: null });
  }

  await updateOrder(order.id, {
    status: "ready",
    pdf_path: pdfPath,
    pages: mirrored as unknown as Record<string, unknown>[],
    error_message: null,
    share_slug: order.share_slug ?? null,
  });

  // Fire-and-forget delivery email.
  const email = await getUserEmail(order.user_id);
  if (email) {
    void sendStorybookReadyEmail({
      to: email,
      childName: order.child_name,
      storyTitle: title,
    }).catch(() => undefined);
  }

  return loadOrder(order.id);
}
