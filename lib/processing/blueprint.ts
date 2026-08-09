/**
 * Processing Architecture Blueprint (Phase 1 - documentation only)
 *
 * Design decisions for how uploaded/input documents are handled. This phase
 * intentionally implements NO extraction engine - the decision matrix below
 * is the contract that later phases must follow.
 *
 * Core rules
 * ----------
 * 1. No background worker / queue (BullMQ) is used in this blueprint.
 *    Asynchronous processing is ONLY added in a later phase for operations
 *    that genuinely require it, such as:
 *      - long-running multi-page OCR batches
 *      - bulk document comparison jobs
 *      - StoryVerse AI continuity checks across large chapters
 *    For everything else, a request-scoped synchronous pipeline is preferred.
 *
 * 2. OCR is NEVER run unconditionally. OCR runs ONLY when the uploaded
 *    document actually requires it, i.e. it is a scanned/image-based file
 *    with no text layer.
 *
 * 3. Text extraction path per input type:
 *    - Selectable-text PDF  -> direct text-layer extraction (no OCR)
 *    - TXT / Markdown        -> read as text directly (no OCR)
 *    - DOCX / DOC / PPTX     -> direct OOXML/legacy text extraction (no OCR)
 *    - HTML / URL            -> HTML parsing + text normalization (no OCR)
 *    - Image / scanned PDF   -> OCR ONLY (Tesseract or equivalent service)
 */

export interface ProcessingDecision {
  inputType: string;
  pipeline: string;
  requiresOcr: boolean;
  asyncRequired: boolean;
}

export const PROCESSING_DECISIONS: ProcessingDecision[] = [
  { inputType: "pdf (text layer)", pipeline: "Direct PDF text extraction", requiresOcr: false, asyncRequired: false },
  { inputType: "pdf (scanned / image-only)", pipeline: "OCR (page rasterization -> OCR engine)", requiresOcr: true, asyncRequired: true },
  { inputType: "docx / doc / pptx", pipeline: "Direct OOXML / legacy binary text extraction", requiresOcr: false, asyncRequired: false },
  { inputType: "txt / markdown", pipeline: "Direct text read", requiresOcr: false, asyncRequired: false },
  { inputType: "html / url", pipeline: "HTML parse + text normalization", requiresOcr: false, asyncRequired: false },
  { inputType: "csv / xlsx / json", pipeline: "Structured data parsing", requiresOcr: false, asyncRequired: false },
  { inputType: "image", pipeline: "OCR (image -> OCR engine)", requiresOcr: true, asyncRequired: true },
];

export function classifyOcrNeed(kind: string): boolean {
  const imageLike = ["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif"];
  if (imageLike.includes(kind.toLowerCase())) return true;
  return false;
}
