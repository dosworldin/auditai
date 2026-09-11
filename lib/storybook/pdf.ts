/**
 * Storybook PDF composer — production print-style layout.
 *
 * Uses pdfkit (fontkit shaping) so Hindi/Devanagari story text renders
 * correctly; the Noto Sans Devanagari TTF is embedded via a generated
 * base64 module (serverless-safe, no fs read at runtime).
 *
 * Cover page (first illustration + title + dedication) then one page per
 * story page: illustration on top, story text below. Illustrations are
 * passed in as buffers — downloading/mirroring happens in the pipeline.
 *
 * Runtime: pdfkit is bundled CJS via next.config serverExternalPackages.
 */

import PDFDocument from "pdfkit";
import { Buffer } from "buffer";
import { NOTO_SANS_DEVANAGARI_B64 } from "./devanagari-font";

export interface PdfPageData {
  pageNumber: number;
  text: string;
  image: Buffer | null;
}

export interface ComposeOptions {
  title: string;
  childName: string;
  dedication: string | null;
  pages: PdfPageData[];
}

function isDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function composeStorybookPdf(options: ComposeOptions): Promise<Buffer> {
  const A4LW = 595.28; // A4 width  pt
  const A4H = 841.89; // A4 height pt

  const doc = new PDFDocument({
    size: "A4",
    autoFirstPage: false,
    info: {
      Title: options.title,
      Author: "AuditAI Storybooks",
      Subject: `A personalized storybook for ${options.childName}`,
    },
  });

  const hindiFont = Buffer.from(NOTO_SANS_DEVANAGARI_B64, "base64");
  let hindiRegistered = false;

  const pickFont = (text: string): "hindi" | "Helvetica-Bold" => {
    if (isDevanagari(text)) {
      if (!hindiRegistered) {
        doc.registerFont("hindi", hindiFont);
        hindiRegistered = true;
      }
      return "hindi";
    }
    return "Helvetica-Bold";
  };

  // ---------------- Cover ----------------
  doc.addPage({ size: "A4" });
  const coverImg = options.pages[0]?.image ?? null;
  if (coverImg) {
    doc.image(coverImg, 0, 0, { cover: [A4LW, A4H * 0.62], align: "center" });
  } else {
    doc.rect(0, 0, A4LW, A4H * 0.62).fill("#fde68a");
  }
  doc.fill("#111827");

  doc
    .font(pickFont(options.title))
    .fontSize(34)
    .fillColor("#111827")
    .text(options.title, 48, A4H * 0.62 + 18, {
      width: A4LW - 96,
      align: "center",
      lineGap: 4,
    });

  doc
    .font("Helvetica")
    .fontSize(14)
    .fillColor("#6b7280")
    .text(`A story for ${options.childName}`, 48, doc.y + 10, {
      width: A4LW - 96,
      align: "center",
    });

  if (options.dedication?.trim()) {
    doc
      .font(pickFont(options.dedication))
      .fontSize(12)
      .fillColor("#374151")
      .text(options.dedication.trim(), 72, A4H - 120, {
        width: A4LW - 144,
        align: "center",
      });
  }

  // ---------------- Story pages ----------------
  for (const page of options.pages) {
    doc.addPage({ size: "A4" });

    const imgH = A4H * 0.62;
    if (page.image) {
      doc.image(page.image, 0, 0, { cover: [A4LW, imgH], align: "center" });
    } else {
      doc.rect(0, 0, A4LW, imgH).fill("#e5e7eb");
    }

    doc
      .font(pickFont(page.text))
      .fontSize(17)
      .fillColor("#1f2937")
      .text(page.text, 56, imgH + 44, {
        width: A4LW - 112,
        align: "center",
        lineGap: 6,
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#9ca3af")
      .text(String(page.pageNumber), 0, A4H - 40, { width: A4LW, align: "center" });
  }

  // ---------------- Back cover ----------------
  doc.addPage({ size: "A4" });
  doc.rect(0, 0, A4LW, A4H).fill("#111827");
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#f9fafb")
    .text("Made with love", 0, A4H / 2 - 40, { width: A4LW, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#9ca3af")
    .text("Created on AuditAI Storybooks", 0, A4H / 2 + 10, {
      width: A4LW,
      align: "center",
    });

  return docToBuffer(doc);
}
