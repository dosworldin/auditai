import type { AuditReport, AuditRunPayload, ExtractionResult, Finding } from "@/lib/engine/types";
import { contextFrom, runRule } from "@/lib/engine/rules";
import { extractForAudit } from "@/lib/engine/extract";
import { getAnalyzer } from "@/lib/engine/analyzers";
import { SAFETY_DISCLAIMERS } from "@/lib/engine/toolLogic";
import { getTool } from "@/lib/tools/registry";
import { getEffectiveToolLogic, isAiEnabledFor, aiMaxFindingsFor, aiContextFor, semanticLayerEnabled, TOOL_LOGIC_MIGRATED } from "@/lib/engine/migratedLogic";
import { runLabAdapter } from "@/lib/engine/migratedAdapter";
import { runSemanticAnalysis } from "@/lib/ai/semantic";
import { callAI } from "@/lib/ai/provider";
import { isEnglish, languageInstruction } from "@/lib/ai/language";
import { extractSplitDocuments } from "@/lib/engine/comparison";
import {
  buildDocStats,
  buildEvidenceList,
  buildMissingInformation,
  buildRecommendations,
  computeConfidence,
  criticalFindings,
  dedupeFindings,
  riskScoreFromFindings,
  sortFindings,
  summarizeReport,
} from "@/lib/engine/report";
import { countWords, splitLines } from "@/lib/engine/text";

const LOCALIZE_REPORT_SYSTEM = `You localize audit reports for a multilingual document-analysis product.

Input: JSON with the original English report (and an input document excerpt for context).
Task: return ONLY a JSON object with the SAME shape and keys, with every user-facing string (summary, finding title/explanation/recommendation, recommendation texts) rewritten in the requested language. Preserve meaning, urgency and tone exactly — a Critical finding must still read like one. Do NOT add, remove, merge or reorder findings; do NOT change severities, scores, numbers, dates or amounts. Keep proper nouns, product names, technical identifiers and code as-is. Never answer with anything except the JSON object.`;

function toolNameFor(slug: string): string {
  const map: Record<string, string> = {
    "sentiment-tone-analyzer": "Sentiment & Tone Analyzer",
    "contract-style-tuner": "Contract Style Tuner",
    "negotiation-coach": "Negotiation Coach",
    "risk-explainer": "Risk Explainer",
    "document-clustering": "Document Clustering",
    "smart-redaction": "Smart Redaction",
    "document-qna": "Document Q&A",
    "citation-validator": "Citation Validator",
    "literature-scanner": "Literature Scanner",
    "claim-verifier": "Claim Verifier",
    "prompt-injection-tester": "Prompt Injection Tester",
    "pii-detector": "PII Detector",
    "link-reputation-scanner": "Link Reputation Scanner",
    "regulation-change-tracker": "Regulation Change Tracker",
    "jurisdiction-mapper": "Jurisdiction Mapper",
    "consent-record-auditor": "Consent Record Auditor",
    "metadata-inspector": "Metadata Inspector",
    "document-forensics": "Document Forensics",
    "timeline-reconstructor": "Timeline Reconstructor",
    "agentic-negotiation": "Agentic Negotiation",
    "multimodal-contract-vision": "Multimodal Contract Vision",
    "autonomous-compliance-agent": "Autonomous Compliance Agent",
    "contract-watchdog": "Contract Watchdog",
    "insurance-trap-detector": "Insurance Trap Detector",
    "privacy-policy-auditor": "Privacy Policy Auditor",
    "terms-conditions-analyzer": "Terms & Conditions Analyzer",
    "rental-agreement-analyzer": "Rental Agreement Analyzer",
    "employment-contract-analyzer": "Employment Contract Analyzer",
    "salary-slip-analyzer": "Salary Slip Analyzer",
    "resume-auditor": "Resume Auditor",
    "offer-letter-analyzer": "Offer Letter Analyzer",
    "invoice-auditor": "Invoice Auditor",
    "gst-invoice-checker": "GST Invoice Checker",
    "tax-notice-analyzer": "Tax Notice Analyzer",
    "legal-notice-analyzer": "Legal Notice Analyzer",
    "loan-agreement-analyzer": "Loan Agreement Analyzer",
    "bank-statement-analyzer": "Bank Statement Analyzer",
    "medical-report-analyzer": "Medical Report Analyzer",
    "prescription-checker": "Prescription Checker",
    "research-paper-reviewer": "Research Paper Reviewer",
    "patent-risk-analyzer": "Patent Risk Analyzer",
    "trademark-checker": "Trademark Checker",
    "copyright-risk-analyzer": "Copyright Risk Analyzer",
    "website-privacy-audit": "Website Privacy Audit",
    "cookie-compliance-checker": "Cookie Compliance Checker",
    "seo-audit": "SEO Audit",
    "accessibility-audit": "Accessibility Audit",
    "cyber-security-checklist": "Cyber Security Checklist",
    "ai-content-detector": "AI Generated Content Detector",
    "scam-detector": "Scam Detector",
    "fraud-risk-analyzer": "Fraud Risk Analyzer",
    "financial-risk-analyzer": "Financial Risk Analyzer",
    "business-proposal-reviewer": "Business Proposal Reviewer",
    "nda-analyzer": "NDA Analyzer",
    "vendor-agreement-auditor": "Vendor Agreement Auditor",
    "partnership-agreement-auditor": "Partnership Agreement Auditor",
    "due-diligence-analyzer": "Due Diligence Analyzer",
    "compliance-checker": "Compliance Checker",
    "corporate-governance-audit": "Corporate Governance Audit",
    "document-comparison": "Document Comparison",
    "clause-risk-detection": "Clause Risk Detection",
    "custom-ai-audit": "Custom AI Audit",
  };
  return map[slug] ?? slug;
}

export async function runAudit(payload: AuditRunPayload): Promise<AuditReport> {
  // The Bank Reconciliation Auditor has a bespoke two-file engine that bypasses
  // the standard single-document pipeline (it needs both uploads at once).
  if (payload.toolSlug === "bank-reconciliation-auditor") {
    const { runReconciliationAudit } = await import("@/lib/engine/reconciliation");
    return runReconciliationAudit(payload);
  }

  // Coming Soon gate (defense-in-depth: the API route also blocks these, but
  // runAudit itself must never emit a bogus "ok" report for a gated tool).
  const toolDef = getTool(payload.toolSlug);
  if (toolDef?.comingSoon) {
    return {
      toolSlug: payload.toolSlug,
      toolName: toolNameFor(payload.toolSlug),
      status: "error",
      error: `${toolDef.name} is coming soon and cannot be run yet.`,
      generatedAt: new Date().toISOString(),
      documentName: payload.documentName ?? "Unknown document",
      safetyDomain: "general",
      phase: "logic-v1",
      summary: `${toolDef.name} is coming soon and cannot be run yet.`,
      riskScore: 0,
      riskLabel: "Low",
      criticalFindings: [],
      findings: [],
      evidenceList: [],
      recommendations: [],
      missingInformation: [],
      documentStats: {
        characters: 0,
        words: 0,
        lines: 0,
        estimatedReadTimeSeconds: 0,
        inputType: "none",
        usedOcr: false,
        ocrRequired: false,
        truncated: false,
      },
      confidence: { overall: 0, notes: ["Tool gated as Coming Soon."] },
      disclaimer: SAFETY_DISCLAIMERS.general,
    };
  }

  // Migrated former labs reuse their existing handlers verbatim — the classic
  // pipeline below expects rule/analyzer metadata they do not have. The AI
  // semantic layer still enhances them (shared with the classic path below).
  if (payload.toolSlug in TOOL_LOGIC_MIGRATED) {
    const adapted = await runLabAdapter(payload);
    const enhanced = await enhanceWithSemantic(adapted, payload, adapted.__extracted ?? "");
    return maybeLocalizeReport(enhanced, payload);
  }

  const logic = getEffectiveToolLogic(payload.toolSlug);
  if (!logic) {
    return {
      toolSlug: payload.toolSlug,
      toolName: toolNameFor(payload.toolSlug),
      status: "error",
      error: "Unknown tool slug",
      generatedAt: new Date().toISOString(),
      documentName: payload.documentName ?? "Unknown document",
      safetyDomain: "general",
      phase: "logic-v1",
      summary: "The requested tool is not implemented.",
      riskScore: 0,
      riskLabel: "Low",
      criticalFindings: [],
      findings: [],
      evidenceList: [],
      recommendations: [],
      missingInformation: [],
      documentStats: {
        characters: 0,
        words: 0,
        lines: 0,
        estimatedReadTimeSeconds: 0,
        inputType: "none",
        usedOcr: false,
        ocrRequired: false,
        truncated: false,
      },
      confidence: { overall: 0, notes: ["Tool not implemented."] },
      disclaimer: SAFETY_DISCLAIMERS.general,
    };
  }

  const extraction: ExtractionResult = await extractForAudit(payload);
  const text = extraction.text;

  // HARD GUARD: if extraction produced no usable text, do NOT run rules —
  // absence rules on an empty document generate bogus findings ("No contact
  // details", "Resume is very short") that destroy user trust. This happened
  // when a PDF's text layer failed to parse and the catch branch returned
  // empty text. Instead, fail loudly with an actionable message.
  if (countWords(text) < 10) {
    const why = extraction.ocrNotice
      ? extraction.ocrNotice
      : extraction.sourceDescription.includes("could not") ||
          extraction.sourceDescription.includes("failed")
        ? `${extraction.sourceDescription}. Re-export the file (e.g. "Save as PDF" from Word/Docs) or paste the text directly.`
        : "The uploaded file contained no readable text. Re-export it as a text-based file or paste the content directly.";
    return {
      toolSlug: payload.toolSlug,
      toolName: toolNameFor(payload.toolSlug),
      status: "error",
      error: why,
      generatedAt: new Date().toISOString(),
      documentName: payload.documentName ?? extraction.sourceDescription,
      safetyDomain: logic.safetyDomain,
      phase: "logic-v1",
      summary: `No readable text could be extracted from the document, so no analysis was performed. ${why}`,
      riskScore: 0,
      riskLabel: "Low",
      criticalFindings: [],
      findings: [],
      evidenceList: [],
      recommendations: [],
      missingInformation: [],
      documentStats: {
        characters: text.length,
        words: countWords(text),
        lines: splitLines(text).length,
        estimatedReadTimeSeconds: 0,
        inputType: extraction.inputType,
        usedOcr: extraction.usedOcr,
        ocrRequired: extraction.ocrRequired,
        truncated: extraction.truncated,
      },
      confidence: { overall: 0, notes: ["Extraction failed — no analysis performed."] },
      disclaimer: SAFETY_DISCLAIMERS[logic.safetyDomain],
      ocrNotice: extraction.ocrNotice,
    };
  }

  const ctx = contextFrom(text);
  // Pass raw HTML through for tag-level analyzers (SEO, accessibility, privacy).
  // stripHtml() destroys <title>/meta/canonical/alt info, so without this those
  // checks always reported "missing" even on well-formed pages.
  if (extraction.rawHtml) ctx.rawHtml = extraction.rawHtml;

  const ruleFindings: Finding[] = [];
  for (const rule of logic.checks) {
    try {
      ruleFindings.push(...runRule(rule, ctx));
    } catch {
      // a single broken rule must not fail the whole audit
    }
  }
  let analyzerFindings: Finding[] = [];
  let detectedType: string | undefined;
  let classificationNote: string | undefined;
  if (logic.analyzer) {
    const analyzer = getAnalyzer(logic.analyzer);
    if (analyzer) {
      try {
        const result = analyzer(ctx, payload.config);
        analyzerFindings = result.findings;
        detectedType = result.detectedType;
        classificationNote = result.classificationNote;
      } catch {
        // analyzer failure should not crash the run
      }
    }
  }

  const allFindings = sortFindings(dedupeFindings([...ruleFindings, ...analyzerFindings]));

  /* ---- AI semantic layer (PART 2) --------------------------------
   * Runs AFTER deterministic analysis, BEFORE scoring/report. Fail-soft:
   * any provider/JSON error keeps the deterministic-only report. Findings
   * are grounded (verbatim quote required), deduped against the
   * deterministic set, and capped per tool. */
  const report = buildBaseReport({
    payload,
    logic,
    extraction,
    text,
    findings: allFindings,
    detectedType,
    classificationNote,
  });
  const enhanced = await enhanceWithSemantic(report, payload, text, ctx);
  return maybeLocalizeReport(enhanced, payload);
}

/** When the user explicitly selected a non-English report language, rewrite
 * the deterministic English report skeleton into that language (semantic AI
 * findings are already generated in the target language). */
async function maybeLocalizeReport(report: AuditReport, payload: AuditRunPayload): Promise<AuditReport> {
  const selected =
    typeof payload.config?.language === "string" ? payload.config.language.toLowerCase() : "";
  if (!selected || isEnglish(selected)) return report;
  return localizeReport(report, selected);
}

/**
 * Localize an AuditReport into the requested output language (ONE AI call).
 * The deterministic engine's English strings (summary, findings,
 * recommendations, missing-info) are rewritten; severities, scores, metrics
 * and evidence quotes stay authoritative and untouched. Fail-soft: on any AI
 * failure the English report is returned so an audit never breaks.
 */
async function localizeReport(report: AuditReport, language: string): Promise<AuditReport> {
  const instruction = languageInstruction(language);
  if (!instruction) return report;
  try {
    const response = await callAI({
      systemPrompt: `${LOCALIZE_REPORT_SYSTEM}\n\nLANGUAGE: ${instruction}`,
      prompt: `Localize this audit report (input document excerpt is reference only — do not include it in the response):
INPUT DOCUMENT EXCERPT:
"""
${report.documentName ?? ""}
"""
REPORT:
${JSON.stringify(
  {
    summary: report.summary,
    findings: report.findings.map((f) => ({
      title: f.title,
      explanation: f.explanation,
      recommendation: f.recommendation,
    })),
    recommendations: report.recommendations.map((r) => ({ text: r.text })),
    missingInformation: report.missingInformation.map((m) => ({
      item: m.item,
      explanation: m.explanation,
    })),
  },
  null,
  0,
)}

Return the localized JSON object with keys "summary", "findings" (same array order, same fields) and "recommendations". Return ONLY the JSON object.`,
      temperature: 0.2,
      maxTokens: 2400,
    });
    if (response.error || !response.content.trim()) return report;

    const fenced = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = (fenced ? fenced[1] : response.content).trim();
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) return report;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return report;
    }

    const pick = (v: unknown, fallback: string) =>
      typeof v === "string" && v.trim() ? v.trim() : fallback;
    const localizedFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
    const localizedRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    const findings = report.findings.map((f, i) => {
      const l =
        typeof localizedFindings[i] === "object" && localizedFindings[i] !== null
          ? (localizedFindings[i] as Record<string, unknown>)
          : null;
      if (!l) return f;
      return {
        ...f,
        title: pick(l.title, f.title),
        explanation: pick(l.explanation, f.explanation),
        recommendation: pick(l.recommendation, f.recommendation),
      };
    });
    const recommendations = report.recommendations.map((r, i) => {
      const l =
        typeof localizedRecs[i] === "object" && localizedRecs[i] !== null
          ? (localizedRecs[i] as Record<string, unknown>)
          : null;
      return l ? { ...r, text: pick(l.text, r.text) } : r;
    });

    return {
      ...report,
      summary: pick(parsed.summary, report.summary),
      findings,
      recommendations,
    };
  } catch {
    return report;
  }
}

/**
 * Shared AI semantic enhancement — used by BOTH the classic pipeline and the
 * migrated-lab adapter. Fail-soft; strips the internal __extracted field
 * before returning so it never reaches persistence or the client.
 */
async function enhanceWithSemantic(
  report: AuditReport,
  payload: AuditRunPayload,
  text: string,
  ctx?: ReturnType<typeof contextFrom>,
): Promise<AuditReport> {
  const { __extracted: _stripped, ...clean } = report;
  if (!isAiEnabledFor(payload.toolSlug) || !(await semanticLayerEnabled())) {
    return clean as AuditReport;
  }
  try {
    const semantic = await runSemanticAnalysis({
      toolSlug: payload.toolSlug,
      toolName: report.toolName,
      text,
      secondText: comparisonSecondText(ctx, payload),
      toolContext: aiContextFor(payload.toolSlug, payload.config),
      existingFindings: report.findings.map((f) => ({ title: f.title, explanation: f.explanation })),
      safetyDomain: report.safetyDomain,
      maxFindings: aiMaxFindingsFor(payload.toolSlug),
      language: typeof payload.config?.language === "string" ? payload.config.language : undefined,
      inputPreview: text.slice(0, 2000),
    });
    if (semantic && semantic.findings.length > 0) {
      const merged = [...clean.findings, ...semantic.findings].sort((a, b) => {
        const order = ["Critical", "High", "Medium", "Low", "Info"];
        const d = order.indexOf(a.severity) - order.indexOf(b.severity);
        return d !== 0 ? d : b.confidence - a.confidence;
      });
      const { score, label } = riskScoreFromFindings(merged);
      return {
        ...clean,
        findings: merged,
        criticalFindings: criticalFindings(merged),
        riskScore: score,
        riskLabel: label,
        aiSemanticNotice: `Semantic analysis by ${semantic.provider} (${semantic.model}) added ${semantic.findings.length} finding${semantic.findings.length === 1 ? "" : "s"}.`,
      };
    }
    if (semantic?.skippedReason) {
      return { ...clean, aiSemanticNotice: semantic.skippedReason };
    }
    return clean as AuditReport;
  } catch {
    // Never let the AI layer break an audit.
    return clean as AuditReport;
  }
}

/** Assemble the deterministic report (pre-AI). Extracted from the former
 * inline construction so the migrated path and classic path share it. */
function buildBaseReport(input: {
  payload: AuditRunPayload;
  logic: NonNullable<ReturnType<typeof getEffectiveToolLogic>>;
  extraction: ExtractionResult;
  text: string;
  findings: Finding[];
  detectedType?: string;
  classificationNote?: string;
}): AuditReport {
  const { payload, logic, extraction, text, findings } = input;
  const { score, label } = riskScoreFromFindings(findings);
  const critical = criticalFindings(findings);
  const recommendations = buildRecommendations(findings);
  const missingInformation = buildMissingInformation(findings);
  const evidenceList = buildEvidenceList(findings);
  const docStats = buildDocStats({
    text,
    inputType: extraction.inputType,
    pages: extraction.pages,
    usedOcr: extraction.usedOcr,
    ocrRequired: extraction.ocrRequired,
    truncated: extraction.truncated,
  });
  const confidence = computeConfidence(findings, {
    words: countWords(text),
    ocrUsed: extraction.usedOcr,
    truncated: extraction.truncated,
  });

  const summary = summarizeReport({
    toolName: logic.slug === payload.toolSlug ? toolNameFor(payload.toolSlug) : logic.slug,
    findings,
    riskLabel: label,
    detectedType: input.detectedType,
  });

  return {
    toolSlug: payload.toolSlug,
    toolName: toolNameFor(payload.toolSlug),
    status: "ok",
    generatedAt: new Date().toISOString(),
    documentName: payload.documentName ?? extraction.sourceDescription,
    safetyDomain: logic.safetyDomain,
    phase: "logic-v1",
    summary,
    riskScore: score,
    riskLabel: label,
    criticalFindings: critical,
    findings,
    evidenceList,
    recommendations,
    missingInformation,
    documentStats: docStats,
    confidence,
    disclaimer: SAFETY_DISCLAIMERS[logic.safetyDomain],
    detectedDocumentType: input.detectedType,
    classificationNote: input.classificationNote,
    ocrNotice: extraction.ocrNotice,
  };
}

/** Document Comparison: extract the second document for the AI layer. */
function comparisonSecondText(
  ctx: ReturnType<typeof contextFrom> | undefined,
  payload: AuditRunPayload,
): string | undefined {
  if (payload.toolSlug !== "document-comparison") return undefined;
  const fromConfig = payload.config?.compareText;
  if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig;
  if (!ctx) return undefined;
  const split = extractSplitDocuments(ctx.text);
  return split ? split.b : undefined;
}
