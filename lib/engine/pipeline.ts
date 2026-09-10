import type { AuditReport, AuditRunPayload, ExtractionResult, Finding } from "@/lib/engine/types";
import { contextFrom, runRule } from "@/lib/engine/rules";
import { extractForAudit } from "@/lib/engine/extract";
import { getAnalyzer } from "@/lib/engine/analyzers";
import { getToolLogic, SAFETY_DISCLAIMERS } from "@/lib/engine/toolLogic";
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
import { countWords } from "@/lib/engine/text";

function toolNameFor(slug: string): string {
  const map: Record<string, string> = {
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

  const logic = getToolLogic(payload.toolSlug);
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
  const ctx = contextFrom(text);

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

  const { score, label } = riskScoreFromFindings(allFindings);
  const critical = criticalFindings(allFindings);
  const recommendations = buildRecommendations(allFindings);
  const missingInformation = buildMissingInformation(allFindings);
  const evidenceList = buildEvidenceList(allFindings);
  const docStats = buildDocStats({
    text,
    inputType: extraction.inputType,
    pages: extraction.pages,
    usedOcr: extraction.usedOcr,
    ocrRequired: extraction.ocrRequired,
    truncated: extraction.truncated,
  });
  const confidence = computeConfidence(allFindings, {
    words: countWords(text),
    ocrUsed: extraction.usedOcr,
    truncated: extraction.truncated,
  });

  const summary = summarizeReport({
    toolName: logic.slug === payload.toolSlug ? toolNameFor(payload.toolSlug) : logic.slug,
    findings: allFindings,
    riskLabel: label,
    detectedType,
  });

  const report: AuditReport = {
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
    findings: allFindings,
    evidenceList,
    recommendations,
    missingInformation,
    documentStats: docStats,
    confidence,
    disclaimer: SAFETY_DISCLAIMERS[logic.safetyDomain],
    detectedDocumentType: detectedType,
    classificationNote,
    ocrNotice: extraction.ocrNotice,
  };

  return report;
}
