import type { AuditRunPayload, ExtractionResult } from "@/lib/engine/types";
import { clip } from "@/lib/engine/text";

const MAX_TEXT_CHARS = 500_000;
const MAX_FILE_BYTES = 5_000_000;

const IMAGE_KINDS = new Set(["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif"]);

function bytesFromBase64(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function decodeBase64(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

function normalizeText(raw: string): string {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
  return clip(text, MAX_TEXT_CHARS);
}

export function classifyKind(kind: string): string {
  return kind.replace(/^\./, "").toLowerCase();
}

export function isImageKind(kind: string): boolean {
  return IMAGE_KINDS.has(classifyKind(kind));
}

/**
 * Extract text from a file buffer for a given kind.
 * Returns { text, usedOcr, pages, ... }. Never throws on OCR failure;
 * OCR problems are reported as a notice instead.
 */
export async function extractFileText(
  kindRaw: string,
  base64: string,
  opts: { allowOcr?: boolean; ocrLanguages?: string } = {},
): Promise<ExtractionResult> {
  const kind = classifyKind(kindRaw);
  const size = bytesFromBase64(base64);
  if (size > MAX_FILE_BYTES) {
    return {
      text: "",
      inputType: kind,
      usedOcr: false,
      ocrRequired: false,
      ocrAttempted: false,
      truncated: false,
      sourceDescription: "File too large - skipped",
    };
  }
  const buffer = decodeBase64(base64);

  if (kind === "txt" || kind === "md" || kind === "markdown" || kind === "text") {
    return {
      text: normalizeText(buffer.toString("utf8")),
      inputType: kind,
      usedOcr: false,
      ocrRequired: false,
      ocrAttempted: false,
      truncated: false,
      sourceDescription: `${kind.toUpperCase()} file (direct text read)`,
    };
  }

  if (kind === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: normalizeText(result.value),
        inputType: "docx",
        usedOcr: false,
        ocrRequired: false,
        ocrAttempted: false,
        truncated: false,
        sourceDescription: "DOCX file (direct text extraction)",
      };
    } catch {
      return {
        text: "",
        inputType: "docx",
        usedOcr: false,
        ocrRequired: false,
        ocrAttempted: false,
        truncated: false,
        sourceDescription: "DOCX extraction failed",
      };
    }
  }

  if (kind === "pdf") {
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const data = new Uint8Array(buffer);
      const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
      let text = "";
      let textItems = 0;
      const numPages = doc.numPages;
      for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        textItems += content.items.length;
        const pageText = content.items
          .map((item) => {
            const str = (item as { str?: string }).str ?? "";
            return str;
          })
          .join(" ");
        text += `\n${pageText}`;
      }
      await (doc as { destroy?: () => Promise<void> }).destroy?.();
      const normalized = normalizeText(text);
      const hasTextLayer = textItems > 0 && normalized.length > 0;
      if (hasTextLayer) {
        return {
          text: normalized,
          inputType: "pdf",
          pages: numPages,
          usedOcr: false,
          ocrRequired: false,
          ocrAttempted: false,
          truncated: false,
          sourceDescription: `PDF (direct text layer extraction, ${numPages} page${numPages === 1 ? "" : "s"})`,
        };
      }
      // No text layer -> scanned PDF. OCR only when required.
      if (opts.allowOcr !== false) {
        const ocr = await runOcrOnBuffer(buffer, "pdf", opts.ocrLanguages);
        if (ocr && ocr.text.length > 0) {
          return {
            text: normalizeText(ocr.text),
            inputType: "pdf",
            pages: numPages,
            usedOcr: true,
            ocrRequired: true,
            ocrAttempted: true,
            truncated: false,
            sourceDescription: "Scanned PDF (OCR applied)",
          };
        }
      }
      return {
        text: "",
        inputType: "pdf",
        pages: numPages,
        usedOcr: false,
        ocrRequired: true,
        ocrAttempted: false,
        truncated: false,
        ocrNotice:
          "This PDF has no text layer (scanned document). OCR was not available or returned no text.",
        sourceDescription: "Scanned PDF - OCR required",
      };
    } catch {
      return {
        text: "",
        inputType: "pdf",
        usedOcr: false,
        ocrRequired: false,
        ocrAttempted: false,
        truncated: false,
        sourceDescription: "PDF could not be parsed",
      };
    }
  }

  if (kind === "csv" || kind === "xlsx") {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const sheets = wb.SheetNames;
      let text = "";
      for (const name of sheets) {
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws);
        text += `\n[Sheet: ${name}]\n${csv}`;
      }
      return {
        text: normalizeText(text),
        inputType: kind,
        usedOcr: false,
        ocrRequired: false,
        ocrAttempted: false,
        truncated: false,
        sourceDescription: `${kind.toUpperCase()} spreadsheet (direct parse)`,
      };
    } catch {
      return {
        text: "",
        inputType: kind,
        usedOcr: false,
        ocrRequired: false,
        ocrAttempted: false,
        truncated: false,
        sourceDescription: `${kind.toUpperCase()} parsing failed`,
      };
    }
  }

  if (kind === "html" || kind === "htm") {
    return {
      text: normalizeText(stripHtml(buffer.toString("utf8"))),
      inputType: "html",
      usedOcr: false,
      ocrRequired: false,
      ocrAttempted: false,
      truncated: false,
      sourceDescription: "HTML file (direct parse)",
    };
  }

  if (isImageKind(kind)) {
    if (opts.allowOcr !== false) {
      const ocr = await runOcrOnBuffer(buffer, kind, opts.ocrLanguages);
      if (ocr && ocr.text.length > 0) {
        return {
          text: normalizeText(ocr.text),
          inputType: kind,
          usedOcr: true,
          ocrRequired: true,
          ocrAttempted: true,
          truncated: false,
          sourceDescription: `${kind.toUpperCase()} image (OCR applied)`,
        };
      }
    }
    return {
      text: "",
      inputType: kind,
      usedOcr: false,
      ocrRequired: true,
      ocrAttempted: false,
      truncated: false,
      ocrNotice:
        "Image input requires OCR, which was not available or returned no text.",
      sourceDescription: "Image - OCR required",
    };
  }

  return {
    text: "",
    inputType: kind,
    usedOcr: false,
    ocrRequired: false,
    ocrAttempted: false,
    truncated: false,
    sourceDescription: `Unsupported file type: .${kind}`,
  };
}

let ocrUnavailable: string | null = null;

/**
 * Default OCR languages, ordered by priority. `eng` is always included as a
 * final fallback. Language packs are downloaded on demand by tesseract.js and
 * cached in-process. Admin can override the list via the `ocr_languages`
 * admin setting (comma-separated, e.g. "eng,hin,spa").
 */
export const DEFAULT_OCR_LANGUAGES = "eng";

function sanitizeOcrLanguages(raw: string | undefined): string {
  const valid = /^[a-z]{3}(-[a-zA-Z]+)?$/;
  const langs = (raw ?? "")
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0 && valid.test(l));
  if (!langs.includes("eng")) langs.push("eng");
  return langs.slice(0, 5).join("+");
}

async function runOcrOnBuffer(
  buffer: Buffer,
  kind: string,
  languages: string = DEFAULT_OCR_LANGUAGES,
): Promise<{ text: string } | null> {
  if (ocrUnavailable) return null;
  try {
    const tesseract = await import("tesseract.js");
    const result = await tesseract.recognize(
      buffer,
      sanitizeOcrLanguages(languages),
      { logger: () => undefined },
    );
    return { text: result.data?.text ?? "" };
  } catch (err) {
    ocrUnavailable = err instanceof Error ? err.message : "OCR unavailable";
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------- URL fetching ------------------------- */

export async function fetchUrlText(
  url: string,
  maxBytes = 1_500_000,
): Promise<{ text: string; contentType: string; ok: boolean }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { text: "", contentType: "", ok: false };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { text: "", contentType: "", ok: false };
  }
  const hostname = parsed.hostname.toLowerCase();
  const isPrivate =
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === "::1";

  if (isPrivate) {
    return { text: "", contentType: "", ok: false };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "AuditAI/1.0 (+authorized website audit)",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return { text: "", contentType: "", ok: false };
    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.arrayBuffer();
    if (raw.byteLength > maxBytes) {
      return { text: "", contentType, ok: false };
    }
    const isHtml = /html|xml/.test(contentType);
    const decoded = Buffer.from(raw).toString("utf8");
    const text = isHtml ? stripHtml(decoded) : decoded;
    return { text: normalizeText(text), contentType, ok: true };
  } catch {
    return { text: "", contentType: "", ok: false };
  }
}

/**
 * Top-level extraction for a tool run. Dispatches on the payload.
 * Returns an ExtractionResult; extraction problems are encoded in the
 * result (empty text + notice) rather than thrown.
 */
export async function extractForAudit(
  payload: AuditRunPayload,
): Promise<ExtractionResult> {
  const { file, url, text } = payload;

  if (file && file.base64 && file.kind) {
    // Resolve admin-configured OCR languages (server-side only).
    let ocrLanguages: string | undefined;
    try {
      const { getSupabaseServer } = await import("@/lib/db/supabase-server");
      const supabase = await getSupabaseServer();
      const { data: setting } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "ocr_languages")
        .single();
      const v = setting?.value;
      if (typeof v === "string" && v.trim()) ocrLanguages = v;
    } catch {
      // Fall back to default languages
    }

    const result = await extractFileText(file.kind, file.base64, {
      allowOcr: true,
      ocrLanguages,
    });
    return { ...result, sourceDescription: result.sourceDescription };
  }

  if (url && url.trim()) {
    const fetched = await fetchUrlText(url.trim());
    if (!fetched.ok) {
      return {
        text: "",
        inputType: "url",
        usedOcr: false,
        ocrRequired: false,
        ocrAttempted: false,
        truncated: false,
        sourceDescription: "URL could not be fetched",
        ocrNotice:
          "The URL could not be fetched (unreachable, private address, blocked, or too large). No content was analyzed.",
      };
    }
    return {
      text: fetched.text,
      inputType: "url",
      usedOcr: false,
      ocrRequired: false,
      ocrAttempted: false,
      truncated: false,
      sourceDescription: `URL content (${fetched.contentType || "text"})`,
    };
  }

  if (text && text.trim()) {
    return {
      text: normalizeText(text),
      inputType: "text",
      usedOcr: false,
      ocrRequired: false,
      ocrAttempted: false,
      truncated: false,
      sourceDescription: "Pasted text (direct)",
    };
  }

  return {
    text: "",
    inputType: "none",
    usedOcr: false,
    ocrRequired: false,
    ocrAttempted: false,
    truncated: false,
    sourceDescription: "No input provided",
  };
}
