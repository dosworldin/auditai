/** Shared text helpers used across the audit pipeline. */

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function countWords(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}

/** Find the sentence containing the given needle, for evidence extraction. */
export function findContext(
  text: string,
  needle: string,
  windowChars = 260,
): string {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - Math.floor(windowChars / 3));
  const end = Math.min(text.length, idx + needle.length + Math.floor(windowChars * 0.6));
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export interface MoneyValue {
  value: number | null;
  raw: string;
}

export const CURRENCY_SYMBOL = "₹|Rs\.?|INR|USD|\$|EUR|£|¥";

export function extractMoney(text: string): MoneyValue[] {
  const pattern = new RegExp(
    `(${CURRENCY_SYMBOL})\\s?([\\d,]+(?:\\.[\\d]{1,2})?)`,
    "gi",
  );
  const out: MoneyValue[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const raw = m[0];
    const amount = parseMoneyAmount(m[2]);
    out.push({ value: amount, raw });
  }
  return out;
}

export function parseMoneyAmount(str: string): number | null {
  const cleaned = str.replace(/[,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parsePercentage(text: string): number | null {
  const m = text.match(/([\d.]+)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function approxEqual(a: number, b: number, tolerance = 0.01): boolean {
  if (a === 0 || b === 0) return Math.abs(a - b) <= tolerance;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= tolerance;
}

export function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

export function clip(text: string, max = 800): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}
