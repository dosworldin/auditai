/**
 * Migrated-labs → audit-report adapter.
 *
 * The 22 former labs run through their EXISTING handlers in
 * lib/engine/labLogic.ts (untouched). This adapter:
 *   1. extracts the input ONCE (extractForAudit — same OCR/SSRF rules),
 *   2. feeds the extracted text into runLab as a text payload (runLab's
 *      internal extractForAudit call then passes the text straight through,
 *      so files/URLs are never extracted twice),
 *   3. maps the lab output into the standard AuditReport structure so
 *      persistence, history and rendering all work unchanged.
 */

import type { AuditReport, AuditRunPayload, ExtractionResult, Finding, RiskLevel, Severity } from "@/lib/engine/types";
import { runLab } from "@/lib/engine/labLogic";
import { extractForAudit } from "@/lib/engine/extract";
import { countWords, splitLines } from "@/lib/engine/text";
import type { LabOutput } from "@/lib/engine/types";

const SEV_ORDER: Severity[] = ["Critical", "High", "Medium", "Low", "Info"];
const RISK_FOR: Record<Severity, RiskLevel> = {
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
  Info: "None",
};

function labFindingsToFindings(output: LabOutput): Finding[] {
  return output.findings.map((f, i) => {
    const severity: Severity = SEV_ORDER.includes(f.severity) ? f.severity : "Info";
    return {
      id: `${output.labSlug}-f${i + 1}`,
      severity,
      category: "Analysis",
      title: f.label,
      explanation: f.detail,
      evidence: {
        text: f.evidence ?? f.copiableText ?? f.detail,
        available: Boolean(f.evidence || f.copiableText),
      },
      risk: RISK_FOR[severity],
      recommendation: f.copiableText
        ? "Copy the suggested text above and adapt it to your situation."
        : "Review this item in the context of your document.",
      confidence: f.confidence,
      rule: `${output.labSlug}:handler`,
    } satisfies Finding;
  });
}

function riskFromLab(findings: Finding[]): { score: number; label: AuditReport["riskLabel"] } {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "High") score -= 18;
    else if (f.severity === "Medium") score -= 10;
    else if (f.severity === "Low") score -= 5;
  }
  score = Math.max(0, Math.min(100, score));
  const label: AuditReport["riskLabel"] =
    score >= 80 ? "Low" : score >= 55 ? "Medium" : score >= 30 ? "High" : "Critical";
  return { score, label };
}

export async function runLabAdapter(payload: AuditRunPayload): Promise<AuditReport> {
  // 1. Single extraction pass (files OCR only when actually required;
  //    URLs keep the existing SSRF-protected fetcher).
  const extraction: ExtractionResult = await extractForAudit({
    toolSlug: payload.toolSlug,
    file: payload.file,
    url: payload.url,
    text: payload.text,
    config: payload.config,
  });

  // 2. Existing lab engine runs on the extracted text (verbatim reuse).
  const labOutput = await runLab({
    labSlug: payload.toolSlug,
    text: extraction.text,
    config: payload.config,
  });

  const findings = labFindingsToFindings(labOutput);
  const { score, label } = riskFromLab(findings);
  const words = countWords(extraction.text);

  const isComingSoon = labOutput.status === "COMING_SOON";

  return {
    toolSlug: payload.toolSlug,
    toolName: labOutput.labName,
    status: isComingSoon ? "error" : "ok",
    error: isComingSoon ? `${labOutput.labName} is coming soon and cannot be run yet.` : undefined,
    generatedAt: labOutput.generatedAt,
    documentName: payload.documentName ?? extraction.sourceDescription,
    safetyDomain: "general",
    phase: "logic-v1",
    summary: labOutput.summary,
    riskScore: score,
    riskLabel: label,
    criticalFindings: findings.filter((f) => f.severity === "High"),
    findings,
    evidenceList: findings.map((f) => ({
      excerpt: f.evidence.text.slice(0, 200),
      findingId: f.id,
    })),
    recommendations: findings
      .filter((f) => f.recommendation)
      .slice(0, 6)
      .map((f) => ({
        text: f.recommendation,
        priority: f.severity === "Info" ? ("Low" as const) : f.severity === "High" ? ("High" as const) : ("Medium" as const),
      })),
    missingInformation: [],
    documentStats: {
      characters: extraction.text.length,
      words,
      lines: splitLines(extraction.text).length,
      estimatedReadTimeSeconds: Math.max(1, Math.round((words * 60) / 220)),
      inputType: extraction.inputType,
      usedOcr: extraction.usedOcr,
      ocrRequired: extraction.ocrRequired,
      truncated: extraction.truncated,
    },
    confidence: {
      overall: Math.round(
        (findings.reduce((a, f) => a + f.confidence, 0) / Math.max(1, findings.length)) * 100,
      ),
      notes: [
        `Analysis engine: ${labOutput.labName} (migrated lab engine, unchanged).`,
        labOutput.disclaimer,
      ],
    },
    disclaimer:
      "This analysis is informational. It is not professional advice and should be reviewed with a qualified professional before relying on it.",
    ocrNotice: extraction.ocrNotice,
    __extracted: extraction.text,
  };
}
