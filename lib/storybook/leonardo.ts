/**
 * Leonardo.Ai image generation client — Character Reference pipeline.
 *
 * Flow (server-side only):
 *  1. uploadInitImage()  → POST /init-image (presigned fields) → multipart POST to S3
 *  2. generatePage()     → POST /generations with controlnets[{preprocessorId:133}]
 *                          (Character Reference) — Leonardo Phoenix (SDXL family)
 *  3. pollGeneration()   → GET /generations/{id} until COMPLETE, returns image URLs
 *
 * Key: LEONARDO_API_KEY env var.
 */

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";

/** Phoenix (SDXL family) — supports Character Reference (preprocessorId 133). */
export const LEONARDO_MODEL_ID = "e71a1c2f-4f80-4800-934f-2c68979d8cc8";

/** Character Reference ControlNet preprocessor (SDXL column). */
const CHARACTER_REFERENCE_PREPROCESSOR = 133;

export interface UploadedInitImage {
  id: string;
}

export interface GeneratedImages {
  generationId: string;
  imageUrls: string[];
}

function getApiKey(): string {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) throw new Error("LEONARDO_API_KEY is not configured");
  return key;
}

async function leonardoFetch(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${LEONARDO_BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${getApiKey()}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(60_000),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in (data as Record<string, unknown>)
        ? JSON.stringify((data as Record<string, unknown>).error).slice(0, 300)
        : `Leonardo API error ${res.status}`;
    throw new Error(msg);
  }
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * Step 1 — upload the child's photo as an init image.
 * Returns the Leonardo init-image id to reference in generations.
 */
export async function uploadInitImage(
  fileBase64: string,
  extension: "png" | "jpeg" | "jpg" | "webp",
): Promise<UploadedInitImage> {
  const payload = {
    extension: extension === "jpg" ? "jpeg" : extension,
  };
  const data = await leonardoFetch("/init-image", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const createResp =
    (data.uploadInitImage as Record<string, unknown> | undefined) ??
    (data as Record<string, unknown>);
  const id = String(createResp.id ?? "");
  const fieldsRaw = String(createResp.fields ?? "{}");
  const url = String(createResp.url ?? "");
  if (!id || !url) {
    throw new Error("Leonardo init-image upload: missing id/url in response");
  }

  // Presigned multipart POST — expires in 2 minutes, must be binary, not base64.
  const fields = JSON.parse(fieldsRaw) as Record<string, string>;
  const buffer = Buffer.from(fileBase64, "base64");
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([new Uint8Array(buffer)]), `photo.${extension}`);

  const uploadRes = await fetch(url, { method: "POST", body: form });
  if (!uploadRes.ok) {
    throw new Error(`Leonardo S3 upload failed (${uploadRes.status})`);
  }
  return { id };
}

/**
 * Step 2 — start one illustration generation with Character Reference.
 * Returns the generation id (poll to completion).
 */
export async function startPageGeneration(options: {
  refImageId: string;
  prompt: string;
  width?: number;
  height?: number;
}): Promise<{ generationId: string }> {
  const body = {
    modelId: LEONARDO_MODEL_ID,
    prompt: options.prompt,
    width: options.width ?? 1024,
    height: options.height ?? 768,
    num_images: 1,
    alchemy: true,
    controlnets: [
      {
        initImageId: options.refImageId,
        initImageType: "UPLOADED",
        preprocessorId: CHARACTER_REFERENCE_PREPROCESSOR,
        strengthType: "High",
      },
    ],
  };
  const data = await leonardoFetch("/generations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const genResp =
    (data.sdGenerationJob as Record<string, unknown> | undefined) ??
    (data as Record<string, unknown>);
  const generationId = String(genResp.generationId ?? "");
  if (!generationId) {
    throw new Error("Leonardo generation: missing generationId in response");
  }
  return { generationId };
}

/** Non-blocking status check for one generation. */
export async function getGenerationStatus(
  generationId: string,
): Promise<{ status: "PENDING" | "COMPLETE" | "FAILED"; imageUrls: string[] }> {
  const data = await leonardoFetch(
    `/generations/${encodeURIComponent(generationId)}`,
    { method: "GET" },
  );
  const gen =
    (data.generations_by_pk as Record<string, unknown> | undefined) ??
    (data as Record<string, unknown>);
  const status = String(gen.status ?? "PENDING").toUpperCase();
  let imageUrls: string[] = [];
  const generated = gen.generated_images;
  if (Array.isArray(generated)) {
    for (const g of generated) {
      const u =
        g && typeof g === "object" && "url" in (g as Record<string, unknown>)
          ? (g as Record<string, unknown>).url
          : null;
      if (typeof u === "string" && u) imageUrls.push(u);
    }
  }
  return {
    status: status === "COMPLETE" ? "COMPLETE" : status === "FAILED" ? "FAILED" : "PENDING",
    imageUrls,
  };
}

/**
 * Step 3 — poll until COMPLETE/FAILED. Vercel serverless friendly: total
 * budget ~100s, check every 3s. The caller advances the order state machine
 * across multiple requests, so per-request budgets stay short.
 */
export async function pollGeneration(
  generationId: string,
  budgetMs = 90_000,
): Promise<{ status: "PENDING" | "COMPLETE" | "FAILED"; imageUrls: string[] }> {
  const deadline = Date.now() + budgetMs;
  let last = await getGenerationStatus(generationId);
  while (last.status === "PENDING" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3_000));
    last = await getGenerationStatus(generationId);
  }
  return last;
}
