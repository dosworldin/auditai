/**
 * Storybook illustration provider — DIRECT providers only, no mediators.
 *
 * Primary: Google Gemini image generation ("nano banana", gemini-2.5-flash-image)
 * via the same GEMINI_API_KEY you already use for text — no extra account.
 * Fallback: Leonardo Character Reference (kept for likeness strength).
 *
 * The admin setting storybook_image_provider picks the order:
 *   "gemini" (default) → Gemini first, Leonardo as backup
 *   "leonardo"         → Leonardo first, Gemini as backup
 *
 * Character likeness: Gemini receives the child photo inline (base64) plus a
 * strict "same child in every scene" instruction — a direct, single-provider
 * character-reference flow. Leonardo keeps using its Character Reference
 * ControlNet (init image upload + preprocessor 133).
 */

import { uploadInitImage, startPageGeneration, pollGeneration } from "./leonardo";

export interface IllustrateRequest {
  prompt: string;
  /** Base64-encoded child photo (no data: prefix), optional. */
  photoBase64?: string | null;
  photoMime?: string | null;
  width?: number;
  height?: number;
}

export interface IllustrateResult {
  /** Final image bytes (PNG/JPEG from the provider). */
  buffer: Buffer;
  provider: "gemini" | "leonardo";
}

const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

/** Call Gemini image generation directly. Returns PNG/JPEG bytes or null. */
async function geminiImage(req: IllustrateRequest): Promise<Buffer | null> {
  const key = geminiKey();
  if (!key) return null;

  const parts: Record<string, unknown>[] = [{ text: req.prompt }];
  if (req.photoBase64) {
    parts.push({
      inline_data: {
        mime_type: req.photoMime || "image/jpeg",
        data: req.photoBase64,
      },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
      signal: AbortSignal.timeout(110_000),
    },
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini image API ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const partsOut = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of partsOut) {
    const b64 = p.inlineData?.data;
    if (b64) return Buffer.from(b64, "base64");
  }
  return null;
}

/** Leonardo Character Reference path. Returns image bytes or null. */
async function leonardoImage(req: IllustrateRequest): Promise<Buffer | null> {
  if (!req.photoBase64) return null; // likeness requires the reference photo
  const ext = req.photoMime?.includes("png") ? "png" : req.photoMime?.includes("webp") ? "webp" : "jpeg";
  const { id: refImageId } = await uploadInitImage(req.photoBase64, ext as "png" | "jpeg" | "webp");
  const { generationId } = await startPageGeneration({
    refImageId,
    prompt: req.prompt,
    width: req.width ?? 1024,
    height: req.height ?? 768,
  });
  const done = await pollGeneration(generationId, 100_000);
  if (done.status !== "COMPLETE" || !done.imageUrls[0]) return null;
  const res = await fetch(done.imageUrls[0], { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  return Buffer.from(new Uint8Array(await res.arrayBuffer()));
}

/**
 * Generate one illustration through the admin-selected provider order.
 * Throws only when every configured provider fails.
 */
export async function generateIllustration(
  req: IllustrateRequest,
  providerOrder: "gemini" | "leonardo" = "gemini",
): Promise<IllustrateResult> {
  const order = providerOrder === "leonardo" ? ["leonardo", "gemini"] : ["gemini", "leonardo"];
  const errors: string[] = [];

  for (const p of order) {
    try {
      const buffer = p === "gemini" ? await geminiImage(req) : await leonardoImage(req);
      if (buffer) return { buffer, provider: p as "gemini" | "leonardo" };
      errors.push(`${p}: no image in response / missing photo`);
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200));
    }
  }

  throw new Error(`Illustration failed (${errors.join(" | ")})`);
}

export { GEMINI_IMAGE_MODEL };
