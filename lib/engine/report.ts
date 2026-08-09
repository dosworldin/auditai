import type {
  AuditReport,
  DocStats,
  Finding,
  MissingInfo,
  Recommendation,
  ReportConfidence,
  RiskLevel,
  Severity,
} from "@/lib/engine/types";
import { countWords, dedupe, splitLines } from "@/lib/engine/text";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  Critical: 10,
  High: 6,
  Medium: 3,
  Low: 1,
  Info: 0,
};

const RISK_WEIGHT: Record<RiskLevel, number> = {
  Critical: 10,
  High: 6,
  Medium: 3,
  Low: 1,
  None: 0,
};

export function riskScoreFromFindings(findings: Finding[]): {
  score: number;
  label: "Low" | "Medium" | "High" | "Critical";
} {
  if (findings.length === 0) return { score: 0, label: "Low" };
  let total = 0;
  for (const f of findings) {
    const sev = SEVERITY_WEIGHT[f.severity] ?? 0;
    const risk = RISK_WEIGHT[f.risk] ?? 0;
    total += Math.max(sev, risk);
  }
  const score = Math.min(100, Math.round((total / (findings.length * 10)) * 100));
  const label: "Low" | "Medium" | "High" | "Critical" =
    score >= 70 ? "Critical" : score >= 45 ? "High" : score >= 20 ? "Medium" : "Low";
  return { score, label };
}

export function criticalFindings(findings: Finding[]): Finding[] {
  return findings.filter(
    (f) => f.severity === "Critical" || f.severity === "High" || f.risk === "Critical" || f.risk === "High",
  );
}

export function buildRecommendations(findings: Finding[]): Recommendation[] {
  const seen = new Set<string>();
  const out: Recommendation[] = [];
  for (const f of findings) {
    const rec = f.recommendation.trim();
    if (!rec || seen.has(rec)) continue;
    seen.add(rec);
    out.push({ text: rec, priority: f.severity });
  }
  return out.slice(0, 12);
}

export function buildMissingInformation(findings: Finding[]): MissingInfo[] {
  const seen = new Set<string>();
  const out: MissingInfo[] = [];
  for (const f of findings) {
    if (f.evidence.available) continue;
    if (!f.title || seen.has(f.title)) continue;
    seen.add(f.title);
    out.push({
      item: f.title,
      explanation: f.explanation,
      severity: f.severity,
    });
  }
  return out.slice(0, 10);
}

export function buildEvidenceList(findings: Finding[]): AuditReport["evidenceList"] {
  const out: AuditReport["evidenceList"] = [];
  for (const f of findings) {
    if (!f.evidence.available || !f.evidence.text) continue;
    out.push({
      excerpt: f.evidence.text.slice(0, 300),
      page: f.evidence.page,
      section: f.evidence.section,
      findingId: f.id,
    });
  }
  return out.slice(0, 15);
}

export function computeConfidence(
  findings: Finding[],
  opts: { words: number; ocrUsed: boolean; truncated: boolean },
): ReportConfidence {
  const notes: string[] = [];
  if (findings.length === 0) {
    notes.push("No findings were produced; confidence is limited.");
  }
  if (opts.words < 50) {
    notes.push("The extracted text is short; findings may be incomplete.");
  }
  if (opts.ocrUsed) {
    notes.push("OCR was applied; character errors are possible.");
  }
  if (opts.truncated) {
    notes.push("The input was truncated; analysis covers only part of the document.");
  }
  const avgConf =
    findings.length === 0
      ? 0.4
      : findings.reduce((a, f) => a + f.confidence, 0) / findings.length;
  let overall = Math.round(avgConf * 100);
  if (opts.words < 50) overall = Math.min(overall, 45);
  if (opts.ocrUsed) overall = Math.min(overall, 70);
  if (opts.truncated) overall = Math.min(overall, 65);
  return { overall, notes };
}

export function buildDocStats(input: {
  text: string;
  inputType: string;
  pages?: number;
  usedOcr: boolean;
  ocrRequired: boolean;
  truncated: boolean;
}): DocStats {
  const words = countWords(input.text);
  return {
    characters: input.text.length,
    words,
    lines: splitLines(input.text).length,
    pages: input.pages,
    estimatedReadTimeSeconds: Math.round((words / 220) * 60),
    inputType: input.inputType,
    usedOcr: input.usedOcr,
    ocrRequired: input.ocrRequired,
    truncated: input.truncated,
  };
}

export function dedupeFindings(findings: Finding[]): Finding[] {
  return dedupe(findings, (f) => `${f.rule}:${f.title}:${f.evidence.text.slice(0, 60)}`);
}

export function sortFindings(findings: Finding[]): Finding[] {
  const order: Severity[] = ["Critical", "High", "Medium", "Low", "Info"];
  return [...findings].sort((a, b) => {
    const d = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (d !== 0) return d;
    return b.confidence - a.confidence;
  });
}

export function summarizeReport(input: {
  toolName: string;
  findings: Finding[];
  riskLabel: "Low" | "Medium" | "High" | "Critical";
  detectedType?: string;
}): string {
  const n = input.findings.length;
  const crit = criticalFindings(input.findings).length;
  const parts: string[] = [];
  if (input.detectedType) {
    parts.push(`Detected document type: ${input.detectedType}.`);
  }
  if (n === 0) {
    parts.push(`No significant issues were flagged for ${input.toolName}.`);
  } else {
    parts.push(`${input.toolName} produced ${n} finding${n === 1 ? "" : "s"}.`);
    if (crit > 0) {
      parts.push(`${crit} high-priority item${crit === 1 ? "" : "s"} need${crit === 1 ? "s" : ""} attention.`);
    }
    parts.push(`Overall risk is rated ${input.riskLabel}.`);
  }
  return parts.join(" ");
}
