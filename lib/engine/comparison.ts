/**
 * Document Comparison — split helper.
 *
 * Mirrors the separator logic already used by the document-comparison
 * analyzer (divider lines, VERSION A/B, DOCUMENT 1/2 headers) so the AI
 * semantic layer receives the same two halves the analyzer sees.
 */

const SPLIT_RE = /\n\s*(-{5,}|={5,}|\*{5,}|VERSION\s*[AB]|DOCUMENT\s*[12])\s*\n/i;

export function extractSplitDocuments(text: string): { a: string; b: string } | null {
  const parts = text.split(SPLIT_RE);
  if (parts.length < 3) return null;
  const a = (parts[0] ?? "").trim();
  const b = (parts[2] ?? "").trim();
  if (a.length < 40 || b.length < 40) return null;
  return { a, b };
}
