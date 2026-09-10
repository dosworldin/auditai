/**
 * Bank Reconciliation Auditor — matches a bank statement export against a
 * books/ledger export (xlsx / csv / txt / pdf-with-text-layer) and reports:
 *   - matched transactions (amount + date within tolerance)
 *   - amount mismatches (same period, similar description, different amount)
 *   - bank transactions missing from the books
 *   - book entries never found in the bank statement
 *   - duplicate transactions (same date + amount + description)
 *
 * Parsing is structural: rows are extracted from the CSV-like text produced by
 * lib/engine/extract.ts for spreadsheets, the header row is detected, and the
 * date/description/amount columns are mapped. Sign handling supports debit and
 * credit columns as well as signed single-amount columns. Pure deterministic
 * matching — no AI calls, no network.
 */

import type {
  AuditReport,
  AuditRunPayload,
  Finding,
  ReconciliationRow,
  ReconciliationSummary,
} from "@/lib/engine/types";
import { extractFileText } from "@/lib/engine/extract";
import { makeFinding } from "@/lib/engine/rules";
import { SAFETY_DISCLAIMERS } from "@/lib/engine/toolLogic";
import {
  buildDocStats,
  buildEvidenceList,
  buildMissingInformation,
  buildRecommendations,
  computeConfidence,
  criticalFindings,
  riskScoreFromFindings,
  sortFindings,
} from "@/lib/engine/report";
import { countWords, splitLines, clip } from "@/lib/engine/text";

/* ----------------------------- date parsing ----------------------------- */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function buildDate(day: number, month: number, year: number): Date | null {
  let d = day;
  let m = month;
  if (m > 12 && d <= 12) {
    const t = d;
    d = m;
    m = t;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || year < 1990 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, m - 1, d));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) return null;
  return dt;
}

/** Excel serial date (days since 1899-12-30) to UTC date. */
function excelSerialToDate(n: number): Date | null {
  if (!Number.isFinite(n) || n < 20_000 || n > 60_000) return null;
  const ms = Math.round((n - 25_569) * 86_400_000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface DateMatch {
  date: Date;
  raw: string;
}

function parseDateCell(cell: string): DateMatch | null {
  const s = cell.trim();
  if (!s) return null;
  // Excel serial (raw number when xlsx cells are numeric dates)
  if (/^\d{5}$/.test(s)) {
    const d = excelSerialToDate(Number(s));
    if (d) return { date: d, raw: s };
  }
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const date = buildDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (date) return { date, raw: m[0] };
  }
  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const date = buildDate(Number(m[3]), Number(m[2]), Number(m[1]));
    if (date) return { date, raw: m[0] };
  }
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo !== undefined) {
      const date = buildDate(Number(m[1]), mo + 1, Number(m[3]));
      if (date) return { date, raw: m[0] };
    }
  }
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo !== undefined) {
      const date = buildDate(Number(m[2]), mo + 1, Number(m[3]));
      if (date) return { date, raw: m[0] };
    }
  }
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (m) {
    const yy = Number(m[3]);
    const date = buildDate(Number(m[1]), Number(m[2]), yy < 70 ? 2000 + yy : 1900 + yy);
    if (date) return { date, raw: m[0] };
  }
  return null;
}

/* ---------------------------- amount parsing ---------------------------- */

function parseAmountCell(cell: string): number | null {
  let s = cell.trim();
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) sign = -1;
  if (/(cr|credit)$/i.test(s) && !/dr$/i.test(s)) {
    // trailing Cr marker, keep positive sign
  } else if (/dr$/i.test(s)) {
    sign = -1;
  }
  s = s.replace(/[^\d.]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) return null;
  return sign * n;
}

function isHeaderish(cell: string): boolean {
  const s = cell.trim().toLowerCase();
  if (!s) return false;
  if (/^(date|txn date|transaction date|value date|posting date|post date)$/.test(s)) return true;
  if (/^(description|narration|particulars|details|remark|remarks|payee|memo|transaction details|description 1)$/.test(s)) return true;
  if (/^(debit|withdrawal|withdrawals|dr|paid out|money out|debits)$/.test(s)) return true;
  if (/^(credit|deposit|deposits|cr|received|money in|credits)$/.test(s)) return true;
  if (/^(amount|amt|value|transaction amount|txn amount)$/.test(s)) return true;
  if (/^(balance|closing balance|bal|running balance|available balance)$/.test(s)) return true;
  if (/^(type|txn type|dr\/cr|debit\/credit)$/.test(s)) return true;
  if (/^(cheque|cheque no|chq no|ref|reference|utr|sr|sr no|s no|sl no|sn|no|#)$/.test(s)) return true;
  return false;
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const hits = cells.filter(isHeaderish).length;
  return hits >= 2 && hits >= Math.ceil(cells.filter((c) => c.trim()).length / 2);
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/* ------------------------------ row parsing ----------------------------- */

export interface TxRow {
  date: Date | null;
  dateRaw: string;
  description: string;
  amount: number;
  raw: string;
}

interface ParsedTable {
  rows: TxRow[];
  rowCount: number;
}

/**
 * Split a CSV-ish line into cells, honoring double quotes. The xlsx extractor
 * produces standard CSV via XLSX.utils.sheet_to_csv; text/pdf inputs are
 * treated as one-cell-per-line fallbacks.
 */
function splitCsvLike(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function classifyColumns(header: string[]): {
  dateIdx: number;
  descIdx: number;
  debitIdx: number;
  creditIdx: number;
  amountIdx: number;
  signIdx: number;
} {
  const norm = (s: string) => s.trim().toLowerCase();
  let dateIdx = -1;
  let descIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;
  let amountIdx = -1;
  let signIdx = -1;
  header.forEach((h, i) => {
    const s = norm(h);
    if (dateIdx === -1 && /(date)/.test(s)) dateIdx = i;
    else if (descIdx === -1 && /(description|narration|particular|detail|remark|payee|memo)/.test(s)) descIdx = i;
    else if (debitIdx === -1 && /(debit|withdrawal|paid out|money out|dr$|^dr)/.test(s)) debitIdx = i;
    else if (creditIdx === -1 && /(credit|deposit|received|money in|cr$|^cr)/.test(s)) creditIdx = i;
    else if (amountIdx === -1 && /^(amount|amt|value|transaction amount|txn amount)$/.test(s)) amountIdx = i;
    else if (signIdx === -1 && /^(type|txn type|dr\/cr|debit\/credit)$/.test(s)) signIdx = i;
  });
  return { dateIdx, descIdx, debitIdx, creditIdx, amountIdx, signIdx };
}

function parseTable(text: string): ParsedTable {
  const lines = splitLines(text).filter((l) => l.trim().length > 0);
  const rows: TxRow[] = [];
  let dateIdx = -1;
  let descIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;
  let amountIdx = -1;
  let signIdx = -1;

  for (const line of lines) {
    if (/^\[Sheet:/i.test(line)) continue;
    const cells = splitCsvLike(line);

    // Header detection — (re)initialize column mapping.
    if (looksLikeHeaderRow(cells)) {
      const map = classifyColumns(cells);
      if (map.dateIdx !== -1 && (map.debitIdx !== -1 || map.creditIdx !== -1 || map.amountIdx !== -1)) {
        dateIdx = map.dateIdx;
        descIdx = map.descIdx;
        debitIdx = map.debitIdx;
        creditIdx = map.creditIdx;
        amountIdx = map.amountIdx;
        signIdx = map.signIdx;
        continue;
      }
      // A header-looking row without usable mapping is skipped as noise.
      continue;
    }

    if (dateIdx === -1) {
      // Auto-detect mode (no header seen yet): find a date cell and a numeric cell.
      const di = cells.findIndex((c) => parseDateCell(c) !== null);
      if (di === -1) continue;
      const dateM = parseDateCell(cells[di])!;
      const numericCells = cells
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => i !== di && parseAmountCell(c) !== null);
      if (numericCells.length === 0) continue;
      // Choose the last numeric cell that is NOT plausibly a huge balance —
      // prefer cells with decimals or mid-range magnitudes.
      const scored = numericCells
        .map(({ c, i }) => ({ i, v: Math.abs(parseAmountCell(c)!), dec: /\.\d{1,2}$/.test(c) }))
        .sort((a, b) => Number(b.dec) - Number(a.dec) || Math.log10(Math.max(1, a.v)) - Math.log10(Math.max(1, b.v)));
      const pick = scored[0];
      const desc = cells.filter((c, i) => i !== di && parseAmountCell(c) === null && c.trim().length > 2).join(" ");
      rows.push({
        date: dateM.date,
        dateRaw: dateM.raw,
        description: clip(desc, 90),
        amount: pick.v,
        raw: clip(line, 160),
      });
      continue;
    }

    // Column-mapped mode.
    const dateCell = cells[dateIdx];
    if (dateCell === undefined) continue;
    const dateM = parseDateCell(dateCell);
    if (!dateM) continue;
    let amount: number | null = null;
    let explicitSign = 1;
    if (signIdx !== -1 && cells[signIdx]) {
      const s = cells[signIdx].toLowerCase();
      if (/^(dr|debit|out|withdrawal)/.test(s)) explicitSign = -1;
    }
    const debitVal = debitIdx !== -1 && cells[debitIdx] ? parseAmountCell(cells[debitIdx]) : null;
    const creditVal = creditIdx !== -1 && cells[creditIdx] ? parseAmountCell(cells[creditIdx]) : null;
    const amountVal = amountIdx !== -1 && cells[amountIdx] ? parseAmountCell(cells[amountIdx]) : null;
    // A 0 in a debit/credit column means "no value" — fall through to the next
    // candidate column instead of dropping the row.
    if (debitVal !== null && debitVal !== 0) {
      amount = -Math.abs(debitVal);
    } else if (creditVal !== null && creditVal !== 0) {
      amount = Math.abs(creditVal);
    } else if (amountVal !== null && amountVal !== 0) {
      amount = amountVal * explicitSign;
    }
    if (amount === null || amount === 0) continue;
    const desc =
      descIdx !== -1 && cells[descIdx]
        ? cells[descIdx]
        : cells.filter((c, i) => i !== dateIdx && parseAmountCell(c) === null).join(" ");
    rows.push({
      date: dateM.date,
      dateRaw: dateM.raw,
      description: clip(desc.trim(), 90),
      amount,
      raw: clip(line, 160),
    });
  }

  return { rows, rowCount: rows.length };
}

/* ------------------------------- matching ------------------------------- */

function normalizeDesc(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w));
}

function descriptionOverlap(a: string, b: string): number {
  const sa = new Set(normalizeDesc(a));
  const sb = new Set(normalizeDesc(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.min(sa.size, sb.size);
}

interface Pair {
  bank: TxRow;
  book: TxRow;
  amountDiff: number;
  dateDiffDays: number;
}

function effectiveTolerance(a: number, b: number, tolerance: number): number {
  return Math.max(tolerance, Math.max(Math.abs(a), Math.abs(b)) * 0.005);
}

function matchAll(
  bank: TxRow[],
  books: TxRow[],
  tolerance: number,
  windowDays: number,
): { matched: Pair[]; mismatches: Pair[]; bankOnly: TxRow[]; bookOnly: TxRow[] } {
  const usedBook = new Set<number>();
  const matched: Pair[] = [];

  // Sign conventions differ between sources (bank debit = -X, books expense = +X),
  // so all amount comparisons use absolute values; matching signs score higher.

  // Pass 1 — exact: |amountDiff| within tolerance AND |dateDiff| within window.
  for (const b of bank) {
    let best: { j: number; pair: Pair; score: number } | null = null;
    for (let j = 0; j < books.length; j++) {
      if (usedBook.has(j)) continue;
      const k = books[j];
      const dateDiffDays = b.date && k.date ? Math.abs(b.date.getTime() - k.date.getTime()) / 86_400_000 : 0;
      if (b.date && k.date && dateDiffDays > windowDays) continue;
      const amountDiff = Math.abs(Math.abs(b.amount) - Math.abs(k.amount));
      if (amountDiff > effectiveTolerance(Math.abs(b.amount), Math.abs(k.amount), tolerance)) continue;
      const score =
        (amountDiff <= 0.005 ? 2 : 1) +
        (dateDiffDays <= 1 ? 1 : 0) +
        (Math.sign(b.amount) === Math.sign(k.amount) ? 1 : 0) +
        descriptionOverlap(b.description, k.description);
      if (!best || score > best.score) {
        best = { j, score, pair: { bank: b, book: k, amountDiff, dateDiffDays: Math.round(dateDiffDays) } };
      }
    }
    if (best) {
      usedBook.add(best.j);
      matched.push(best.pair);
    }
  }

  // Pass 2 — mismatches: same period + overlapping description, different amount.
  const mismatches: Pair[] = [];
  const usedBook2 = new Set<number>();
  for (const b of bank) {
    if (matched.some((p) => p.bank === b)) continue;
    let best: { j: number; pair: Pair; score: number } | null = null;
    for (let j = 0; j < books.length; j++) {
      if (usedBook.has(j) || usedBook2.has(j)) continue;
      const k = books[j];
      const dateDiffDays = b.date && k.date ? Math.abs(b.date.getTime() - k.date.getTime()) / 86_400_000 : 0;
      if (b.date && k.date && dateDiffDays > windowDays) continue;
      const amountDiff = Math.abs(Math.abs(b.amount) - Math.abs(k.amount));
      const base = Math.max(Math.abs(b.amount), Math.abs(k.amount), 1);
      const relDiff = amountDiff / base;
      if (relDiff > 0.5) continue;
      const overlap = descriptionOverlap(b.description, k.description);
      if (overlap <= 0) continue;
      const score = overlap - relDiff;
      if (!best || score > best.score) {
        best = { j, score, pair: { bank: b, book: k, amountDiff, dateDiffDays: Math.round(dateDiffDays) } };
      }
    }
    if (best) {
      usedBook2.add(best.j);
      mismatches.push(best.pair);
    }
  }

  const matchedBanks = new Set(matched.map((p) => p.bank));
  const mismatchedBanks = new Set(mismatches.map((p) => p.bank));
  const bankOnly = bank.filter((r) => !matchedBanks.has(r) && !mismatchedBanks.has(r));
  const bookOnly = books.filter((_, j) => !usedBook.has(j) && !usedBook2.has(j));
  return { matched, mismatches, bankOnly, bookOnly };
}

function countDuplicates(rows: TxRow[]): number {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.dateRaw}|${Math.abs(r.amount)}|${r.description.slice(0, 40).toLowerCase()}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let dups = 0;
  for (const c of seen.values()) if (c > 1) dups += c - 1;
  return dups;
}

/* ------------------------------- findings ------------------------------- */

function toReconRow(r: TxRow, note: string, matchedWith?: string, diff?: number): ReconciliationRow {
  return {
    date: r.date ? r.date.toISOString().slice(0, 10) : r.dateRaw,
    description: r.description,
    amount: Math.abs(r.amount),
    note,
    matchedWith,
    diff,
  };
}

function amountMismatchFindings(pairs: Pair[], cap: number): Finding[] {
  return [...pairs]
    .sort((a, b) => b.amountDiff - a.amountDiff)
    .slice(0, cap)
    .map((p, i) =>
      makeFinding({
        id: `recon-mismatch-${i}`,
        category: "Amount Mismatch",
        severity: "High",
        risk: "High",
        title: `Amount mismatch: bank ${formatAmount(Math.abs(p.bank.amount))} vs books ${formatAmount(Math.abs(p.book.amount))} (${p.bank.dateRaw})`,
        explanation: `The bank statement shows ${formatAmount(Math.abs(p.bank.amount))} while the books record ${formatAmount(Math.abs(p.book.amount))} for a similar entry about ${p.dateDiffDays} day${p.dateDiffDays === 1 ? "" : "s"} apart — a difference of ${formatAmount(p.amountDiff)}.`,
        recommendation: `Correct the book entry or investigate the ${formatAmount(p.amountDiff)} difference (partial payment, fee, tax, or posting error).`,
        confidence: 0.7,
        evidenceText: `Bank: ${p.bank.raw}  |  Books: ${p.book.raw}`,
        rule: "recon-amount-mismatch",
      }),
    );
}

function bankOnlyFindings(rows: TxRow[], cap: number): Finding[] {
  return [...rows]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, cap)
    .map((r, i) =>
      makeFinding({
        id: `recon-bank-only-${i}`,
        category: "Missing in Books",
        severity: "High",
        risk: "High",
        title: `Bank transaction not recorded in books: ${formatAmount(Math.abs(r.amount))} on ${r.dateRaw}`,
        explanation: `This bank statement transaction ("${r.description}") has no matching entry in the uploaded books within the date window.`,
        recommendation: "Record the transaction in the books or confirm it belongs to a different accounting period.",
        confidence: 0.65,
        evidenceText: r.raw,
        rule: "recon-missing-in-books",
      }),
    );
}

function bookOnlyFindings(rows: TxRow[], cap: number): Finding[] {
  return [...rows]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, cap)
    .map((r, i) =>
      makeFinding({
        id: `recon-book-only-${i}`,
        category: "Missing in Bank",
        severity: "Medium",
        risk: "Medium",
        title: `Book entry not found in bank statement: ${formatAmount(Math.abs(r.amount))} on ${r.dateRaw}`,
        explanation: `The books record "${r.description}" (${formatAmount(Math.abs(r.amount))}) but no matching bank transaction was found in the statement period.`,
        recommendation: "Check for timing differences (uncleared cheques, accruals) or confirm the payment actually went through the bank.",
        confidence: 0.6,
        evidenceText: r.raw,
        rule: "recon-missing-in-bank",
      }),
    );
}

/* ------------------------------ main entry ------------------------------ */

export async function runReconciliationAudit(payload: AuditRunPayload): Promise<AuditReport> {
  const toolName = "Bank Reconciliation Auditor";
  const base = {
    toolSlug: payload.toolSlug,
    toolName,
    generatedAt: new Date().toISOString(),
    safetyDomain: "financial" as const,
    phase: "logic-v1" as const,
  };

  if (!payload.file || !payload.secondFile) {
    return {
      ...base,
      status: "error",
      error:
        "This tool requires TWO uploads: (1) the bank statement export and (2) the books/ledger export. Please upload both files and run again.",
      documentName: payload.documentName ?? "Bank reconciliation",
      summary: "Both a bank statement and a books/ledger export are required.",
      riskScore: 0,
      riskLabel: "Low",
      criticalFindings: [],
      findings: [],
      evidenceList: [],
      recommendations: [],
      missingInformation: [],
      documentStats: buildDocStats({
        text: "",
        inputType: "none",
        usedOcr: false,
        ocrRequired: false,
        truncated: false,
      }),
      confidence: { overall: 0, notes: ["Run aborted: missing one of the two required files."] },
      disclaimer: SAFETY_DISCLAIMERS.financial,
    };
  }

  const tolerance = Math.max(0, Number(payload.config?.amountTolerance ?? 1)) || 1;
  const windowDays = Math.min(90, Math.max(0, Number(payload.config?.dateWindowDays ?? 7)));
  const showMatched = payload.config?.showMatched !== false;

  const [bankEx, booksEx] = await Promise.all([
    extractFileText(payload.file.kind, payload.file.base64, { allowOcr: true }),
    extractFileText(payload.secondFile.kind, payload.secondFile.base64, { allowOcr: true }),
  ]);

  const bankParsed = parseTable(bankEx.text);
  const bookParsed = parseTable(booksEx.text);
  const bankRows = bankParsed.rows;
  const bookRows = bookParsed.rows;

  if (bankRows.length === 0 || bookRows.length === 0) {
    const which = bankRows.length === 0 ? "bank statement" : "books/ledger";
    return {
      ...base,
      status: "error",
      error: `No dated transaction rows could be detected in the ${which} upload. Export the statement/ledger as XLSX or CSV (not a scan or photo) and make sure rows contain a date and an amount.`,
      documentName: `${payload.file.name} + ${payload.secondFile.name}`,
      summary: `Reconciliation could not start: no transaction rows detected in the ${which}.`,
      riskScore: 0,
      riskLabel: "Low",
      criticalFindings: [],
      findings: [],
      evidenceList: [],
      recommendations: [],
      missingInformation: [],
      documentStats: buildDocStats({
        text: `${bankEx.text}\n${booksEx.text}`,
        inputType: "dual-file",
        usedOcr: bankEx.usedOcr || booksEx.usedOcr,
        ocrRequired: bankEx.ocrRequired || booksEx.ocrRequired,
        truncated: bankEx.truncated || booksEx.truncated,
      }),
      confidence: { overall: 0, notes: ["Zero transaction rows parsed — the upload is likely a scan or an unsupported format."] },
      disclaimer: SAFETY_DISCLAIMERS.financial,
    } as AuditReport;
  }

  const { matched, mismatches, bankOnly, bookOnly } = matchAll(bankRows, bookRows, tolerance, windowDays);
  const duplicates = countDuplicates(bankRows);

  const bankTotal = bankRows.reduce((a, r) => a + r.amount, 0);
  const booksTotal = bookRows.reduce((a, r) => a + r.amount, 0);

  const findings: Finding[] = [];

  findings.push(
    makeFinding({
      id: "recon-summary",
      category: "Reconciliation",
      severity: matched.length === bankRows.length && bookOnly.length === 0 ? "Info" : "Low",
      risk: "None",
      title: `${matched.length} of ${bankRows.length} bank transactions matched to the books`,
      explanation: `Bank statement: ${bankRows.length} transactions (net ${formatAmount(bankTotal)}). Books: ${bookRows.length} entries (net ${formatAmount(booksTotal)}). Matched: ${matched.length}. Amount mismatches: ${mismatches.length}. Missing in books: ${bankOnly.length}. Missing in bank: ${bookOnly.length}. Tolerance ±${formatAmount(tolerance)}, date window ±${windowDays} day${windowDays === 1 ? "" : "s"}.`,
      recommendation:
        bankOnly.length === 0 && mismatches.length === 0
          ? "Bank and books agree for this period. Export this report for your records."
          : "Clear the mismatches and unrecorded items below, then re-run to confirm a clean reconciliation.",
      confidence: 0.7,
      evidenceText: matched.slice(0, 3).map((p) => p.bank.raw).join(" | ") || undefined,
      rule: "recon-summary",
    }),
  );

  if (mismatches.length > 0) findings.push(...amountMismatchFindings(mismatches, 12));
  if (bankOnly.length > 0) findings.push(...bankOnlyFindings(bankOnly, 12));
  if (bookOnly.length > 0) findings.push(...bookOnlyFindings(bookOnly, 12));

  if (duplicates > 0) {
    findings.push(
      makeFinding({
        id: "recon-duplicates",
        category: "Duplicates",
        severity: "Medium",
        risk: "Medium",
        title: `${duplicates} duplicate transaction${duplicates === 1 ? "" : "s"} detected in the bank statement`,
        explanation: "The same date, amount, and description appear more than once — this can indicate double posting or a genuine repeat transaction.",
        recommendation: "Verify each duplicate pair; remove double-posted entries from the books.",
        confidence: 0.55,
        rule: "recon-duplicates",
      }),
    );
  }

  const allFindings = sortFindings(findings);
  const { score, label } = riskScoreFromFindings(allFindings);

  const matchRate = Math.round((matched.length / bankRows.length) * 100);
  const confidenceNotes: string[] = [];
  if (matchRate < 50) confidenceNotes.push(`Only ${matchRate}% of bank transactions matched — verify the two files cover the same period.`);
  if (bankEx.usedOcr || booksEx.usedOcr) confidenceNotes.push("OCR was applied to at least one upload; amounts may contain character errors.");
  if (bankRows.length + bookRows.length > 4000) confidenceNotes.push("Very large dataset — matching used greedy first-best pairing.");

  const summaryBits: string[] = [
    `Reconciled ${bankRows.length} bank transactions against ${bookRows.length} book entries.`,
    `${matched.length} matched, ${mismatches.length} amount mismatch${mismatches.length === 1 ? "" : "es"}, ${bankOnly.length} missing in books, ${bookOnly.length} missing in bank.`,
    `Overall reconciliation risk is rated ${label}.`,
  ];

  const reconciliation: ReconciliationSummary = {
    bankStatementName: payload.file.name,
    booksName: payload.secondFile.name,
    bankRows: bankRows.length,
    bookRows: bookRows.length,
    matched: matched.length,
    amountMismatched: mismatches.length,
    missingInBooks: bankOnly.length,
    missingInBank: bookOnly.length,
    duplicates,
    bankTotal,
    booksTotal,
    tolerance,
    dateWindowDays: windowDays,
    matchRatePercent: matchRate,
    mismatchRows: mismatches.slice(0, 25).map((p) => ({
      date: p.bank.date ? p.bank.date.toISOString().slice(0, 10) : p.bank.dateRaw,
      description: p.bank.description || p.book.description,
      amount: Math.abs(p.bank.amount),
      note: `Books show ${formatAmount(Math.abs(p.book.amount))}`,
      matchedWith: p.book.description,
      diff: p.amountDiff,
    })),
    missingInBooksRows: bankOnly.slice(0, 25).map((r) => toReconRow(r, "In bank, not in books")),
    missingInBankRows: bookOnly.slice(0, 25).map((r) => toReconRow(r, "In books, not in bank")),
    matchedSample: showMatched
      ? matched.slice(0, 10).map((p) =>
          toReconRow(p.bank, `Matches book entry (${formatAmount(Math.abs(p.book.amount))}, ${p.dateDiffDays}d apart)`, p.book.description),
        )
      : [],
  };

  return {
    ...base,
    status: "ok",
    documentName: `${payload.file.name} + ${payload.secondFile.name}`,
    summary: summaryBits.join(" "),
    riskScore: score,
    riskLabel: label,
    criticalFindings: criticalFindings(allFindings),
    findings: allFindings,
    evidenceList: buildEvidenceList(allFindings),
    recommendations: buildRecommendations(allFindings),
    missingInformation: buildMissingInformation(allFindings),
    documentStats: buildDocStats({
      text: `${bankEx.text}\n${booksEx.text}`,
      inputType: "dual-file",
      usedOcr: bankEx.usedOcr || booksEx.usedOcr,
      ocrRequired: bankEx.ocrRequired || booksEx.ocrRequired,
      truncated: bankEx.truncated || booksEx.truncated,
    }),
    confidence: computeConfidence(allFindings, {
      words: countWords(`${bankEx.text}\n${booksEx.text}`),
      ocrUsed: bankEx.usedOcr || booksEx.usedOcr,
      truncated: bankEx.truncated || booksEx.truncated,
    }),
    disclaimer: SAFETY_DISCLAIMERS.financial,
    detectedDocumentType: `Bank vs Books (${bankEx.sourceDescription} / ${booksEx.sourceDescription})`,
    reconciliation,
  };
}
