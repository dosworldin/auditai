import type { Finding, RiskLevel, Severity } from "@/lib/engine/types";
import type { RuleContext } from "@/lib/engine/rules";
import { makeFinding } from "@/lib/engine/rules";
import {
  approxEqual,
  clip,
  countWords,
  extractMoney,
  findContext,
  parseMoneyAmount,
  parsePercentage,
  splitLines,
} from "@/lib/engine/text";

export interface AnalyzerResult {
  findings: Finding[];
  detectedType?: string;
  classificationNote?: string;
}

export type Analyzer = (
  ctx: RuleContext,
  config?: Record<string, string | number | boolean>,
) => AnalyzerResult;

/* ------------------------------ helpers ------------------------------ */

function lineContaining(ctx: RuleContext, needles: string[]): string | undefined {
  return ctx.lines.find((l) => {
    const low = l.toLowerCase();
    return needles.some((n) => low.includes(n));
  });
}

function countMatches(text: string, keywords: string[]): number {
  const low = text.toLowerCase();
  return keywords.filter((k) => low.includes(k)).length;
}

function moneyNear(text: string, keywords: string[]): number | null {
  const low = text.toLowerCase();
  let idx = -1;
  for (const k of keywords) {
    const i = low.indexOf(k);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return null;
  // Prefer amounts that appear right at/after the keyword (e.g. "PF: Rs 6,000"),
  // then fall back to the nearest amount in a small window around it.
  const after = text.slice(idx, idx + 60);
  const afterMatch = extractMoney(after)[0];
  if (afterMatch) return afterMatch.value;
  const window = text.slice(Math.max(0, idx - 30), idx + 40);
  const m = extractMoney(window)[0];
  return m ? m.value : null;
}

function firstMatch(ctx: RuleContext, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = ctx.text.match(p);
    if (m) return m[0];
  }
  return undefined;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/g;
const GSTIN_RE = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}\b/;
const DATE_RE = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g;
const PERCENT_RE = /\d+(?:\.\d+)?\s*%/g;

function f(input: {
  id: string;
  category: string;
  severity: Severity;
  risk: RiskLevel;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  evidenceText?: string;
  rule: string;
}): Finding {
  return makeFinding(input);
}

function infoFinding(id: string, rule: string, category: string, title: string, explanation: string, recommendation: string, evidenceText?: string, confidence = 0.6): Finding {
  return f({ id, category, severity: "Info", risk: "None", title, explanation, recommendation, confidence, evidenceText, rule });
}

function warnFinding(id: string, rule: string, category: string, title: string, explanation: string, recommendation: string, severity: Severity = "Medium", risk: RiskLevel = "Medium", evidenceText?: string, confidence = 0.55): Finding {
  return f({ id, category, severity, risk, title, explanation, recommendation, confidence, evidenceText, rule });
}

/* --------------------------- individual tools --------------------------- */

const salaryAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasGross = /gross|total earnings/.test(low);
  const hasNet = /net pay|net salary|net amount/.test(low);
  const hasDeductions = /deductions|deducted|pf|provident fund|esi|professional tax/.test(low);

  const gross = moneyNear(ctx.text, ["gross", "total earnings"]);
  const net = moneyNear(ctx.text, ["net pay", "net salary", "net amount", "net"]);
  const pf = moneyNear(ctx.text, ["pf", "provident fund"]);

  if (gross !== null && net !== null && gross > 0) {
    const deductions = gross - net;
    if (deductions > 0 && deductions <= gross * 0.5) {
      findings.push(
        infoFinding(
          "salary-gross-net",
          "salary",
          "Compensation",
          `Net pay is ${net} vs gross ${gross}`,
          `Gross pay (${gross}) less deductions gives net pay (${net}).`,
          "Verify the deduction breakdown (tax, PF, insurance) matches your payslip history.",
          `Gross ${gross} / Net ${net}`,
          0.55,
        ),
      );
    }
  } else if (hasGross && hasNet) {
    findings.push(
      infoFinding(
        "salary-gross-net",
        "salary",
        "Compensation",
        "Gross and net pay identified",
        "Both gross and net earnings were found, but exact amounts could not be parsed reliably.",
        "Compare the values against your offer letter.",
        lineContaining(ctx, ["gross"]) ?? undefined,
        0.5,
      ),
    );
  } else {
    findings.push(
      warnFinding(
        "salary-no-gross-net",
        "salary",
        "Compensation",
        "Gross or net pay not clearly stated",
        "The payslip does not clearly show gross and/or net earnings.",
        "Confirm total earnings and take-home pay with your payroll team.",
        "Medium",
        "Medium",
        undefined,
        0.45,
      ),
    );
  }

  if (pf !== null) {
    findings.push(
      infoFinding(
        "salary-pf",
        "salary",
        "Provident Fund",
        `Provident fund contribution found: ${pf}`,
        "An employee provident fund deduction was found.",
        "Confirm PF contribution is being remitted as per local rules (typically a percentage of basic pay).",
        `PF: ${pf}`,
        0.6,
      ),
    );
  } else if (hasDeductions) {
    findings.push(
      infoFinding(
        "salary-pf-other",
        "salary",
        "Deductions",
        "Deductions present but PF not parsed",
        "Deductions exist but a provident fund amount could not be identified.",
        "Check whether PF is part of the deduction line.",
        lineContaining(ctx, ["deduct"]) ?? undefined,
        0.5,
      ),
    );
  }

  const absent: string[] = [];
  if (!hasGross) absent.push("gross earnings");
  if (!hasNet) absent.push("net pay");
  if (!hasDeductions) absent.push("deductions");
  if (absent.length === 2) {
    findings.push(
      warnFinding(
        "salary-minimal",
        "salary",
        "Completeness",
        "Payslip appears incomplete",
        `The document does not clearly contain: ${absent.join(", ")}.`,
        "A standard payslip should state earnings, deductions, and net pay.",
        "High",
        "High",
        undefined,
        0.4,
      ),
    );
  }

  return { findings, detectedType: "Salary Slip" };
};

const resumeAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const words = countWords(ctx.text);
  const emails = ctx.text.match(EMAIL_RE) ?? [];
  const phones = ctx.text.match(PHONE_RE) ?? [];

  if (emails.length === 0 && phones.length === 0) {
    findings.push(
      warnFinding(
        "resume-contact",
        "resume",
        "Contact",
        "No contact details detected",
        "No e-mail address or phone number was found.",
        "Add a professional e-mail and phone number so recruiters can reach you.",
        "High",
        "High",
        undefined,
        0.6,
      ),
    );
  } else {
    findings.push(
      infoFinding(
        "resume-contact-ok",
        "resume",
        "Contact",
        "Contact details present",
        `Found ${emails.length} e-mail${emails.length === 1 ? "" : "s"} and ${phones.length} phone number${phones.length === 1 ? "" : "s"}.`,
        "Ensure the contact details are current and professional.",
        [emails[0], phones[0]].filter(Boolean).join(" | "),
        0.7,
      ),
    );
  }

  const sections = ["experience", "education", "skills", "summary", "objective", "projects"];
  const foundSections = sections.filter((s) => ctx.text.toLowerCase().includes(s));
  if (foundSections.length === 0) {
    findings.push(
      warnFinding(
        "resume-structure",
        "resume",
        "Structure",
        "No standard resume sections detected",
        "None of the usual sections (Experience, Education, Skills) were identified.",
        "Structure the resume with clear section headings.",
        "High",
        "High",
        undefined,
        0.55,
      ),
    );
  } else if (foundSections.length < 2) {
    findings.push(
      warnFinding(
        "resume-structure",
        "resume",
        "Structure",
        `Only limited sections detected: ${foundSections.join(", ")}`,
        "Fewer than two standard sections were detected.",
        "Add Experience, Education, and Skills sections.",
        "Medium",
        "Medium",
        undefined,
        0.55,
      ),
    );
  }

  if (words < 200) {
    findings.push(
      warnFinding(
        "resume-length",
        "resume",
        "Length",
        "Resume is very short",
        `Only about ${words} words were detected.`,
        "Aim for a complete one-page (or two-page) resume with concrete detail.",
        "Medium",
        "Medium",
        undefined,
        0.5,
      ),
    );
  } else if (words > 1200) {
    findings.push(
      warnFinding(
        "resume-length",
        "resume",
        "Length",
        "Resume is long",
        `About ${words} words were detected.`,
        "Trim to the most relevant experience; recruiters often skim.",
        "Low",
        "Low",
        undefined,
        0.5,
      ),
    );
  }

  const impact = ctx.text.match(/\b(increased|reduced|improved|grew|managed|led|delivered|launched|cut|raised|boosted)\b/gi) ?? [];
  const numbers = ctx.text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  if (impact.length === 0 && numbers.length < 10) {
    findings.push(
      warnFinding(
        "resume-quantified",
        "resume",
        "Impact",
        "Few quantified achievements",
        "Limited action verbs or measurable outcomes were found.",
        "Quantify achievements (e.g., 'increased sales by 20%').",
        "Medium",
        "Medium",
        undefined,
        0.55,
      ),
    );
  } else {
    findings.push(
      infoFinding(
        "resume-quantified-ok",
        "resume",
        "Impact",
        "Quantified achievements present",
        `Detected ${impact.length} impact verb${impact.length === 1 ? "" : "s"} and ${numbers.length} number${numbers.length === 1 ? "" : "s"}.`,
        "Keep metrics specific and honest.",
        impact.slice(0, 2).join(" | "),
        0.6,
      ),
    );
  }

  return { findings, detectedType: "Resume / CV" };
};

const invoiceAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasInvoiceNo = /invoice\s*(?:no\.?|number|#)?\s*[:#]?\s*[A-Z0-9-/]+/i.test(ctx.text);
  const hasDate = DATE_RE.test(ctx.text);
  const hasSeller = /(from|seller|supplier|vendor|billed by|issued by)/i.test(ctx.text);
  const hasBuyer = /(to|buyer|customer|billed to|bill to|consignee)/i.test(ctx.text);
  const hasTotal = /(total|amount payable|grand total|balance due|net payable)/i.test(ctx.text);
  const hasGstin = GSTIN_RE.test(ctx.text);

  if (!hasInvoiceNo) {
    findings.push(
      warnFinding("inv-no", "invoice", "Identifiers", "No invoice number detected", "An invoice number could not be found.", "Invoices should carry a unique number for tracking and records.", "Medium", "Medium", undefined, 0.55),
    );
  } else {
    findings.push(infoFinding("inv-no-ok", "invoice", "Identifiers", "Invoice number found", "An invoice number was detected.", "Keep the number for your records.", firstMatch(ctx, [/invoice\s*(?:no\.?|number|#)?\s*[:#]?\s*[A-Z0-9-/]+/i]) ?? undefined, 0.7));
  }

  if (!hasDate) {
    findings.push(
      warnFinding("inv-date", "invoice", "Identifiers", "No invoice date detected", "A date was not found.", "Confirm the invoice date and due date.", "Medium", "Medium", undefined, 0.55),
    );
  }

  if (!hasTotal) {
    findings.push(
      warnFinding("inv-total", "invoice", "Amounts", "No total amount detected", "The total or amount payable could not be identified.", "Confirm the total due before paying.", "High", "High", undefined, 0.5),
    );
  } else {
    const totalLine = lineContaining(ctx, ["total", "amount payable", "grand total"]);
    if (totalLine) {
      findings.push(
        infoFinding("inv-total-ok", "invoice", "Amounts", "Total amount identified", "A total line was found.", "Verify the total against the line items.", totalLine, 0.65),
      );
    }
  }

  if (!hasSeller || !hasBuyer) {
    findings.push(
      warnFinding("inv-parties", "invoice", "Parties", "Seller or buyer details incomplete", "The seller or buyer information could not be clearly identified.", "Confirm both parties are correctly listed.", "Medium", "Medium", undefined, 0.5),
    );
  }

  if (!hasGstin) {
    findings.push(
      warnFinding("inv-gstin", "invoice", "Tax", "No GSTIN found", "A GSTIN could not be detected on the invoice.", "For GST invoices, a valid GSTIN is mandatory.", "Low", "Low", undefined, 0.45),
    );
  } else {
    findings.push(
      infoFinding("inv-gstin-ok", "invoice", "Tax", "GSTIN detected", "A GSTIN was found on the invoice.", "Cross-check the GSTIN on the GST portal.", firstMatch(ctx, [GSTIN_RE]) ?? undefined, 0.7),
    );
  }

  return { findings, detectedType: "Invoice" };
};

const gstAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const gstin = firstMatch(ctx, [GSTIN_RE]);

  if (!gstin) {
    findings.push(
      warnFinding("gst-gstin", "gst", "Identifiers", "No GSTIN detected", "A valid GSTIN could not be found.", "Every GST tax invoice must show the supplier's GSTIN.", "High", "High", undefined, 0.6),
    );
  } else {
    const stateCode = gstin.slice(0, 2);
    findings.push(
      infoFinding("gst-gstin-ok", "gst", "Identifiers", `GSTIN detected (state code ${stateCode})`, `The GSTIN format appears valid with state code ${stateCode}.`, "Cross-verify the GSTIN on the official GST portal.", gstin, 0.72),
    );
    if (!/0[1-9]|[1-3][0-9]|4[0-2]/.test(stateCode)) {
      findings.push(
        warnFinding("gst-statecode", "gst", "Identifiers", "Unusual state code in GSTIN", `The leading state code ${stateCode} does not match the standard 01-42 range.`, "A GSTIN with an out-of-range state code is suspicious.", "Medium", "Medium", gstin, 0.55),
      );
    }
  }

  const hasHsn = /\b\d{6,8}\b/.test(ctx.text);
  if (!hasHsn) {
    findings.push(
      warnFinding("gst-hsn", "gst", "Tax", "No HSN / SAC code detected", "An HSN or SAC code was not found.", "Tax invoices should carry HSN/SAC codes for the items supplied.", "Medium", "Medium", undefined, 0.5),
    );
  }

  const hasRate = /\b\d{1,2}(?:\.\d+)?\s*%\b/.test(ctx.text);
  if (!hasRate) {
    findings.push(
      warnFinding("gst-rate", "gst", "Tax", "No GST rate detected", "A GST percentage was not found.", "Confirm the applicable GST rate for each line item.", "Medium", "Medium", undefined, 0.5),
    );
  }

  const hasCgst = /cgst|sgst|igst|utgst/i.test(ctx.text);
  const hasTaxBreakdown = hasCgst || /tax\s*(?:amount|breakdown)/i.test(ctx.text);
  if (!hasTaxBreakdown) {
    findings.push(
      warnFinding("gst-breakdown", "gst", "Tax", "No CGST/SGST/IGST breakdown found", "A tax component breakdown was not detected.", "GST invoices should split tax into CGST/SGST (intra-state) or IGST (inter-state).", "Low", "Low", undefined, 0.45),
    );
  }

  const hasReverseCharge = /reverse charge|rcm/i.test(ctx.text);
  if (hasReverseCharge) {
    findings.push(
      warnFinding("gst-rcm", "gst", "Tax", "Reverse charge referenced", "Reverse-charge provisions are referenced.", "Under reverse charge the buyer is liable to pay GST; confirm who is liable here.", "Medium", "Medium", lineContaining(ctx, ["reverse charge", "rcm"]) ?? undefined, 0.55),
    );
  }

  return { findings, detectedType: "GST Invoice" };
};

const taxNoticeAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasSection = /section\s+\d+[a-z]?|\b143\(1\)|\b143\(2\)|\b139\b|\b148\b|\b147\b|\b154\b|\b156\b|\b263\b|\b264\b/i.test(ctx.text);
  const hasAssessmentYear = /assessment\s*year|a\.?y\.?|asst\.?\s*year/i.test(ctx.text);
  const hasRespondBy = /(respond|reply|deadline|due\s*date|within\s+\d+\s*days|on or before)/i.test(ctx.text);
  const hasOfficer = /assessing\s*officer|jurisdictional\s*officer|income\s*tax\s*officer/i.test(ctx.text);

  if (hasSection) {
    const sec = firstMatch(ctx, [/section\s+\d+[a-z]?/i]) ?? undefined;
    findings.push(infoFinding("tax-section", "tax-notice", "Notice", "Tax section identified", "A tax act section was found in the notice.", "Understand what the section requires you to do.", sec, 0.62));
  } else {
    findings.push(
      warnFinding("tax-no-section", "tax-notice", "Notice", "No tax section identified", "A specific section of the tax act was not found.", "Sections determine the nature of the notice (return, scrutiny, demand).", "Medium", "Medium", undefined, 0.45),
    );
  }

  if (!hasAssessmentYear) {
    findings.push(
      warnFinding("tax-ay", "tax-notice", "Notice", "Assessment year not clear", "The assessment year was not clearly stated.", "Confirm which assessment year the notice refers to.", "Medium", "Medium", undefined, 0.5),
    );
  }

  if (!hasRespondBy) {
    findings.push(
      warnFinding("tax-deadline", "tax-notice", "Response", "No response deadline detected", "A deadline or 'respond within' date was not found.", "Missing a deadline can lead to adverse action; find the due date.", "High", "High", undefined, 0.5),
    );
  } else {
    findings.push(infoFinding("tax-deadline-ok", "tax-notice", "Response", "Response deadline referenced", "The notice references a response deadline.", "Respond before the deadline and keep proof of submission.", lineContaining(ctx, ["respond", "deadline", "due date", "within"]) ?? undefined, 0.6));
  }

  if (!hasOfficer) {
    findings.push(
      warnFinding("tax-officer", "tax-notice", "Authority", "Issuing authority not identified", "The assessing officer or authority was not found.", "Verify the notice is from the correct tax authority.", "Medium", "Medium", undefined, 0.45),
    );
  }

  findings.push(infoFinding("tax-caution", "tax-notice", "Verification", "Verify the notice on the official portal", "The extracted text was analyzed as-is; notices can be forged.", "Log in to the official tax portal and confirm the notice exists before acting or paying.", undefined, 0.6));

  return { findings, detectedType: "Tax Notice" };
};

const legalNoticeAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasSender = /(advocate|attorney|counsel|on behalf of|from|issued by)/i.test(ctx.text);
  const hasRecipient = /(to|addressed to|against|recipient|you are)/i.test(ctx.text);
  const hasDemand = /(demand|require you|claim|damages|relief|repay|compensation|pay)/i.test(ctx.text);
  const hasDeadline = /(within\s+\d+\s*days|deadline|on or before|time limit|7 days|15 days|30 days)/i.test(ctx.text);

  if (!hasSender) {
    findings.push(
      warnFinding("ln-sender", "legal-notice", "Parties", "Sender / advocate not identified", "The issuing party or advocate was not found.", "Confirm who sent the notice.", "Medium", "Medium", undefined, 0.45),
    );
  }
  if (!hasRecipient) {
    findings.push(
      warnFinding("ln-recipient", "legal-notice", "Parties", "Recipient not clearly identified", "The person/entity the notice is addressed to was not found.", "Confirm the notice is actually addressed to you.", "Medium", "Medium", undefined, 0.45),
    );
  }
  if (!hasDemand) {
    findings.push(
      warnFinding("ln-demand", "legal-notice", "Relief", "No demand or relief stated", "What is being demanded or sought could not be identified.", "Clarify the exact relief or action requested.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasDeadline) {
    findings.push(
      warnFinding("ln-deadline", "legal-notice", "Response", "No response time limit found", "A deadline for reply was not found.", "Even without a stated deadline, respond promptly.", "High", "High", undefined, 0.5),
    );
  } else {
    findings.push(infoFinding("ln-deadline-ok", "legal-notice", "Response", "Response time limit referenced", "The notice sets a time limit for a reply.", "Do not miss the deadline; reply in writing and keep copies.", lineContaining(ctx, ["within", "deadline", "days"]) ?? undefined, 0.6));
  }

  findings.push(infoFinding("ln-caution", "legal-notice", "Advice", "Seek professional legal advice", "This is analysis of the document text, not legal advice.", "Consult a qualified lawyer before responding.", undefined, 0.7));

  return { findings, detectedType: "Legal Notice" };
};

const loanAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const principal = moneyNear(ctx.text, ["loan amount", "principal", "sanctioned amount", "disbursed amount", "amount of"]);
  const rate = parsePercentage(ctx.text) ?? moneyNear(ctx.text, ["interest rate", "rate of interest", "roi", "interest"]);

  if (principal !== null && rate !== null) {
    findings.push(
      infoFinding(
        "loan-quantity",
        "loan",
        "Terms",
        `Principal ${principal} at ~${rate}%`,
        "A loan principal and an interest rate were both detected.",
        "Confirm whether the rate is fixed or floating and compute total cost of credit.",
        `Principal ${principal} / ~${rate}%`,
        0.6,
      ),
    );
  }

  const hasPrepayment = /prepayment|pre-payment|foreclosure|early repayment/i.test(ctx.text);
  const hasProcessingFee = /processing\s*(fee|charges?)/i.test(ctx.text);
  const hasPenalty = /penalty|default\s*interest|late\s*payment/i.test(ctx.text);
  const hasCollateral = /collateral|hypothecation|pledge|guarantee|security/i.test(ctx.text);

  if (hasPrepayment) {
    findings.push(
      warnFinding("loan-prepayment", "loan", "Prepayment", "Prepayment terms present", "Prepayment or foreclosure terms were found.", "Check whether a prepayment penalty applies before planning early repayment.", "Medium", "Medium", lineContaining(ctx, ["prepayment", "foreclosure", "early repayment"]) ?? undefined, 0.58),
    );
  }
  if (hasProcessingFee) {
    findings.push(
      warnFinding("loan-fee", "loan", "Fees", "Processing fee present", "A processing fee or charges were found.", "Include all fees in the effective cost of the loan.", "Medium", "Medium", lineContaining(ctx, ["processing"]) ?? undefined, 0.58),
    );
  }
  if (hasPenalty) {
    findings.push(
      warnFinding("loan-penalty", "loan", "Penalties", "Late-payment penalty present", "Penalty or default interest was found.", "Understand the penalty rate and how it compounds.", "Medium", "Medium", lineContaining(ctx, ["penalty", "default interest", "late payment"]) ?? undefined, 0.6),
    );
  }
  if (hasCollateral) {
    findings.push(
      warnFinding("loan-collateral", "loan", "Security", "Collateral / guarantee referenced", "Collateral, hypothecation, or guarantees were found.", "Know exactly what is pledged and the recourse on default.", "Medium", "Medium", lineContaining(ctx, ["collateral", "hypothecation", "pledge", "guarantee"]) ?? undefined, 0.58),
    );
  }

  return { findings, detectedType: "Loan Agreement" };
};

const bankAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const lines = ctx.lines;
  const txnLines = lines.filter((l) => {
    const hasAmount = extractMoney(l).length > 0 || /[\d,]+\.\d{2}/.test(l);
    const hasDate = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(l) || /\b\d{1,2}\s+[A-Za-z]{3}\b/.test(l);
    return hasAmount && hasDate;
  });

  if (txnLines.length === 0) {
    findings.push(
      warnFinding("bank-txn", "bank", "Transactions", "No transaction lines detected", "Could not identify dated transaction lines with amounts.", "A bank statement should list dated credits and debits.", "High", "High", undefined, 0.5),
    );
  } else {
    findings.push(
      infoFinding("bank-txn-ok", "bank", "Transactions", `Detected ${txnLines.length} transaction line${txnLines.length === 1 ? "" : "s"}`, "Dated transaction entries with amounts were found.", "Review each transaction for unfamiliar activity.", txnLines.slice(0, 3).join(" | "), 0.65),
    );
  }

  const opening = moneyNear(ctx.text, ["opening balance"]);
  const closing = moneyNear(ctx.text, ["closing balance", "closing available balance"]);
  if (opening !== null && closing !== null) {
    findings.push(
      infoFinding("bank-balance", "bank", "Balances", `Opening ${opening} -> Closing ${closing}`, "Both opening and closing balances were found.", "Ensure the statement period matches and balances reconcile.", `Opening ${opening} / Closing ${closing}`, 0.6),
    );
  } else {
    findings.push(
      warnFinding("bank-no-balance", "bank", "Balances", "Opening/closing balances not both found", "At least one of opening or closing balance could not be identified.", "Confirm the statement covers the full period with correct balances.", "Medium", "Medium", undefined, 0.45),
    );
  }

  const largeTxn = extractMoney(ctx.text)
    .filter((m) => m.value !== null && m.value >= 100000)
    .slice(0, 3);
  if (largeTxn.length > 0) {
    findings.push(
      warnFinding("bank-large", "bank", "Transactions", "Large transactions detected", "Transactions at or above 100,000 were found.", "Verify large transactions are legitimate and expected.", "Low", "Low", largeTxn.map((m) => m.raw).join(" | "), 0.55),
    );
  }

  const hasFees = /service\s*charge|bank\s*charges|commission|penalty/i.test(ctx.text);
  if (hasFees) {
    findings.push(
      warnFinding("bank-fees", "bank", "Charges", "Bank charges present", "Service charges or fees were found.", "Check whether the charges are expected for your account type.", "Info", "None", lineContaining(ctx, ["charge", "commission", "penalty"]) ?? undefined, 0.6),
    );
  }

  return { findings, detectedType: "Bank Statement" };
};

const medicalAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const hasPatient = /(patient|name|age|sex|dob|date of birth)/i.test(ctx.text);
  const hasTest = /(test|result|report|panel|hemoglobin|sugar|cholesterol|creatinine|bilirubin|hb|wbc|rbc|platelet|glucose|urea|tsh|vitamin)/i.test(ctx.text);
  const hasReference = /(reference\s*range|normal\s*range|ref\.?\s*range|unit)/i.test(ctx.text);

  if (!hasPatient) {
    findings.push(
      warnFinding("med-patient", "medical", "Patient", "Patient identifiers not found", "Patient name or demographics were not found.", "Verify the report belongs to the correct patient before acting on it.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasTest) {
    findings.push(
      warnFinding("med-test", "medical", "Tests", "No test parameters detected", "No test names or parameters were found.", "A medical report should list the tests performed.", "High", "High", undefined, 0.5),
    );
  } else {
    findings.push(infoFinding("med-test-ok", "medical", "Tests", "Test parameters detected", "Test names or result parameters were found.", "Compare each value to the reference range shown.", lineContaining(ctx, ["test", "result", "panel"]) ?? undefined, 0.6));
  }
  if (!hasReference) {
    findings.push(
      warnFinding("med-ref", "medical", "Tests", "No reference ranges found", "Reference or normal ranges were not detected.", "Without reference ranges, out-of-range values cannot be interpreted.", "Medium", "Medium", undefined, 0.5),
    );
  }

  const outOfRange = (ctx.text.match(/\b(high|low|abnormal|elevated|decreased|increased)\b/gi) ?? []).length;
  if (outOfRange > 0) {
    findings.push(
      warnFinding("med-abnormal", "medical", "Tests", `${outOfRange} marker${outOfRange === 1 ? "" : "s"} suggest out-of-range values`, "Markers like High/Low/Abnormal were found alongside results.", "Flag out-of-range values and discuss them with your doctor.", "Medium", "Medium", undefined, 0.55),
    );
  }

  findings.push(infoFinding("med-caution", "medical", "Advice", "Not a diagnosis", "This tool summarizes information in your report; it does not diagnose.", "Always interpret results with a qualified healthcare professional.", undefined, 0.7));

  return { findings, detectedType: "Medical Report" };
};

const prescriptionAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const meds = ctx.text.match(/\b\d+(?:\.\d+)?\s*(mg|mcg|g|ml|tablet|capsule|caps|tab|syrup|injection|ointment|drops)\b/gi) ?? [];
  const hasDoctor = /(dr\.?|doctor|prescribed by|physician|registered medical practitioner)/i.test(ctx.text);
  const hasFrequency = /(once|twice|thrice|daily|per\s*day|every|morning|night|after\s*meals|before\s*meals|stat|sos)/i.test(ctx.text);
  const hasDuration = /(\d+\s*(day|week|month|year)s?|for\s+\d+|course)/i.test(ctx.text);

  if (meds.length === 0) {
    findings.push(
      warnFinding("px-med", "prescription", "Medication", "No medication entries detected", "Drug names with dosages were not found.", "A prescription should list medicines with dosages.", "High", "High", undefined, 0.5),
    );
  } else {
    findings.push(infoFinding("px-med-ok", "prescription", "Medication", `${meds.length} medication entr${meds.length === 1 ? "y" : "ies"} detected`, "Drug entries with dosage units were found.", "Confirm each medicine, dosage, and timing with your pharmacist.", meds.slice(0, 3).join(" | "), 0.65));
  }

  if (!hasFrequency) {
    findings.push(
      warnFinding("px-frequency", "prescription", "Medication", "Dosage frequency unclear", "How often to take the medicine was not clearly stated.", "Ask for clear frequency/dose instructions.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasDuration) {
    findings.push(
      warnFinding("px-duration", "prescription", "Medication", "Duration not clearly stated", "How long to take the medicine was not found.", "Confirm the course length; do not stop early.", "Low", "Low", undefined, 0.5),
    );
  }
  if (!hasDoctor) {
    findings.push(
      warnFinding("px-doctor", "prescription", "Validity", "Prescriber details not found", "The prescribing doctor's details were not found.", "Verify the prescription is from a registered practitioner.", "Medium", "Medium", undefined, 0.5),
    );
  }

  findings.push(infoFinding("px-caution", "prescription", "Advice", "Not medical advice", "This tool reads the prescription text; it does not prescribe or dose.", "Confirm every medicine with your doctor or pharmacist before use.", undefined, 0.7));

  return { findings, detectedType: "Prescription" };
};

const researchAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const sections: Record<string, RegExp> = {
    Abstract: /abstract|summary/i,
    Introduction: /introduction|background/i,
    Methodology: /method(?:ology)?|materials and methods|study design|participants/i,
    Results: /results|findings|outcome/i,
    Discussion: /discussion|interpretation/i,
    Conclusion: /conclusion|limitations/i,
    References: /references?|bibliography|citations?/i,
  };
  const found = Object.entries(sections).filter(([, re]) => re.test(low)).map(([name]) => name);
  if (found.length < 4) {
    findings.push(
      warnFinding("rs-sections", "research", "Structure", `Only ${found.length} of 7 standard sections detected`, `Found: ${found.join(", ") || "none"}.`, "Standard papers include Abstract, Introduction, Methods, Results, Discussion, Conclusion, References.", "Medium", "Medium", undefined, 0.55),
    );
  } else {
    findings.push(infoFinding("rs-sections-ok", "research", "Structure", `${found.length} standard sections detected`, "The paper covers most standard sections.", "Check each section for depth and clarity.", found.join(", "), 0.6));
  }

  const sample = ctx.text.match(/(?:n\s*[=:]?\s*\d+|sample\s*(?:size)?\s*[=:]?\s*\d+|participants?\s*[=:]?\s*\d+|patients?\s*[=:]?\s*\d+)/i);
  if (sample) {
    findings.push(infoFinding("rs-sample", "research", "Methodology", "Sample size mentioned", "A sample size or participant count was found.", "Consider whether the sample size supports the conclusions.", sample[0], 0.6));
  } else {
    findings.push(
      warnFinding("rs-no-sample", "research", "Methodology", "No sample size mentioned", "A sample size was not detected.", "Small or unreported samples weaken generalizability.", "Low", "Low", undefined, 0.5),
    );
  }

  const stats = ctx.text.match(/\b(p\s*[<=]|p\s*=\s*0|confidence interval|ci\s*\d|statistically significant|standard deviation|sd\s*[=:])/i);
  if (stats) {
    findings.push(infoFinding("rs-stats", "research", "Analysis", "Statistical terms detected", "Statistical reporting terms were found.", "Verify p-values and confidence intervals are reported correctly.", stats[0], 0.6));
  } else {
    findings.push(
      warnFinding("rs-no-stats", "research", "Analysis", "No statistical significance reported", "Statistical terms were not detected.", "Reports without significance testing should be read cautiously.", "Low", "Low", undefined, 0.5),
    );
  }

  const refs = ctx.text.match(/\[\d+\]/g) ?? [];
  if (refs.length === 0) {
    findings.push(
      warnFinding("rs-refs", "research", "References", "No numbered references found", "Inline citation markers like [1] were not detected.", "Citations support the claims; check their quality.", "Medium", "Medium", undefined, 0.5),
    );
  } else {
    findings.push(infoFinding("rs-refs-ok", "research", "References", `${refs.length} citation marker${refs.length === 1 ? "" : "s"} detected`, "Numbered citations were found.", "Verify the reference list matches the citations.", refs.slice(0, 3).join(" "), 0.6));
  }

  return { findings, detectedType: "Research Paper" };
};

const trademarkAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const hasApplicationNo = /\b(appl(?:ication)?\s*(?:no\.?|number)?\s*[:#]?\s*\d+|trademark\s*no\.?|tm\s*[:#]?\s*\d+)/i.test(ctx.text);
  const hasClass = /\bclass(?:es)?\s+\d+/i.test(ctx.text);
  const hasOwner = /(applicant|owner|proprietor|assignee|registered\s*by)/i.test(ctx.text);
  const hasGoods = /(goods|services|specification|description of)/i.test(ctx.text);

  if (!hasApplicationNo) {
    findings.push(
      warnFinding("tm-appno", "trademark", "Identifiers", "No application number found", "A trademark application number was not detected.", "Application numbers are needed to check status.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasClass) {
    findings.push(
      warnFinding("tm-class", "trademark", "Scope", "No trademark class detected", "A trademark class (e.g., Class 25) was not found.", "The class determines the scope of protection.", "Medium", "Medium", undefined, 0.5),
    );
  } else {
    findings.push(infoFinding("tm-class-ok", "trademark", "Scope", "Trademark class detected", "A class number was found.", "Confirm the class covers your goods/services.", firstMatch(ctx, [/\bclass(?:es)?\s+\d+/i]) ?? undefined, 0.62));
  }
  if (!hasOwner) {
    findings.push(
      warnFinding("tm-owner", "trademark", "Identifiers", "Applicant/owner not identified", "The applicant or owner was not found.", "Confirm the ownership details.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasGoods) {
    findings.push(
      warnFinding("tm-goods", "trademark", "Scope", "No goods/services specification found", "The description of goods or services was not found.", "The specification defines what the mark covers.", "Low", "Low", undefined, 0.5),
    );
  }

  findings.push(infoFinding("tm-caution", "trademark", "Advice", "Not a trademark clearance search", "This tool analyzes the document text; it does not run a registry search.", "Conduct a proper clearance search before filing.", undefined, 0.6));

  return { findings, detectedType: "Trademark Document" };
};

const websitePrivacyAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasCollect = /(collect|gather|process)\s+.*\b(data|information)/i.test(ctx.text);
  const hasThirdParty = /(third[- ]?party|share|transfer|disclose|sale of)/i.test(ctx.text);
  const hasCookies = /cookie/i.test(ctx.text);
  const hasRetention = /retention|keep.*\d+\s*(days|months|years)|delete.*(data|info)/i.test(ctx.text);
  const hasRights = /(right to|access|rectification|erasure|deletion|portability|opt[- ]out|withdraw)/i.test(ctx.text);
  const hasContact = /(contact|reach us|privacy.officer|dpo|data protection officer|email)/i.test(ctx.text);

  if (!hasCollect) {
    findings.push(
      warnFinding("pp-collect", "website-privacy", "Data Collection", "What data is collected is unclear", "The policy does not clearly describe what data is collected.", "Disclose categories of personal data collected.", "High", "High", undefined, 0.55),
    );
  }
  if (!hasThirdParty) {
    findings.push(
      warnFinding("pp-share", "website-privacy", "Sharing", "Third-party sharing not described", "How data is shared with third parties was not found.", "Disclose any third-party recipients or processors.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasCookies) {
    findings.push(
      warnFinding("pp-cookie", "website-privacy", "Cookies", "Cookies not mentioned", "The policy does not mention cookies.", "Describe cookie usage and how users can control them.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasRetention) {
    findings.push(
      warnFinding("pp-retention", "website-privacy", "Retention", "Retention period not stated", "How long data is kept was not found.", "State retention periods or a deletion policy.", "Low", "Low", undefined, 0.5),
    );
  }
  if (!hasRights) {
    findings.push(
      warnFinding("pp-rights", "website-privacy", "User Rights", "User rights not described", "User rights (access, deletion, opt-out) were not found.", "Describe how users can exercise their rights.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasContact) {
    findings.push(
      warnFinding("pp-contact", "website-privacy", "Contact", "No privacy contact found", "A contact for privacy matters was not found.", "Provide a contact channel for privacy questions.", "Low", "Low", undefined, 0.5),
    );
  }

  return { findings, detectedType: "Privacy Policy" };
};

const cookieAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasConsent = /consent|permission|opt[- ]in|allow|agree/i.test(ctx.text);
  const hasOptOut = /opt[- ]out|reject|decline|withdraw|settings|preferences/i.test(ctx.text);
  const hasPurpose = /purpose|necessary|essential|analytics|advertis|functional|preference/i.test(ctx.text);
  const hasCategories = /categories|strictly necessary|performance|marketing|targeting/i.test(ctx.text);
  const hasBanner = /banner|pop[- ]up|first visit|notice|message/i.test(ctx.text);
  const hasCookie = /cookie/i.test(ctx.text);

  if (!hasCookie) {
    findings.push(
      warnFinding("ck-cookie", "cookie", "Coverage", "Cookies not mentioned", "The document does not mention cookies.", "Disclose cookie usage on the site.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasConsent) {
    findings.push(
      warnFinding("ck-consent", "cookie", "Consent", "Consent mechanism not described", "How users give consent was not found.", "Obtain clear consent before non-essential cookies.", "High", "High", undefined, 0.55),
    );
  }
  if (!hasOptOut) {
    findings.push(
      warnFinding("ck-optout", "cookie", "Consent", "Opt-out path not described", "How users can withdraw or reject consent was not found.", "Provide a way to reject or withdraw consent.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasCategories) {
    findings.push(
      warnFinding("ck-categories", "cookie", "Transparency", "Cookie categories not described", "Categories of cookies were not found.", "Describe categories such as strictly necessary, analytics, marketing.", "Low", "Low", undefined, 0.5),
    );
  }

  return { findings, detectedType: "Cookie / Consent Document" };
};

const seoAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasTitle = /<title>|title\s*[:=]|page\s*title/i.test(ctx.text) || /^#{1}\s+.+$/m.test(ctx.text);
  const hasMeta = /meta\s*description|description\s*[:=]|meta\s*name/i.test(ctx.text);
  const hasHeading = /(?:^|\n)#{2,3}\s+|<h[1-3]|heading/i.test(ctx.text);
  const hasCanonical = /canonical|rel\s*=\s*"canonical"/i.test(ctx.text);
  const hasAlt = /alt\s*=|alt\s*attribute|image\s*alt/i.test(ctx.text);

  if (!hasTitle) {
    findings.push(
      warnFinding("seo-title", "seo", "On-page", "No page title detected", "A title tag or H1 heading was not found.", "Each page should have a unique, descriptive title.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasMeta) {
    findings.push(
      warnFinding("seo-meta", "seo", "On-page", "No meta description detected", "A meta description was not found.", "Write a concise meta description for each page.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasHeading) {
    findings.push(
      warnFinding("seo-heading", "seo", "Structure", "No heading hierarchy detected", "H1-H3 headings were not detected.", "Use a clear heading hierarchy for content structure.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasCanonical) {
    findings.push(
      warnFinding("seo-canonical", "seo", "Technical", "No canonical tag detected", "A canonical URL was not found.", "Add canonical tags to avoid duplicate content issues.", "Low", "Low", undefined, 0.5),
    );
  }
  if (!hasAlt) {
    findings.push(
      warnFinding("seo-alt", "seo", "On-page", "No image alt attributes found", "Image alt text was not detected.", "Add descriptive alt text to images.", "Low", "Low", undefined, 0.5),
    );
  }

  const words = countWords(ctx.text);
  if (words < 300) {
    findings.push(
      warnFinding("seo-length", "seo", "Content", "Content is short", `Only about ${words} words were detected.`, "Aim for substantive content (typically 500+ words) for competitive topics.", "Low", "Low", undefined, 0.5),
    );
  }

  return { findings, detectedType: "Website Content / SEO" };
};

const accessibilityAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasAlt = /alt\s*=|alt\s*attribute|image\s*alt/i.test(ctx.text);
  const hasHeading = /(?:^|\n)#{1,3}\s+|<h[1-6]|heading/i.test(ctx.text);
  const hasLang = /lang\s*=|language\s*(?:attribute|declaration)/i.test(ctx.text);
  const hasAria = /aria[- ]|role\s*=|screen\s*reader/i.test(ctx.text);
  const hasContrast = /contrast|colour\s*contrast|color\s*contrast/i.test(ctx.text);
  const hasLabels = /label|placeholder|for\s*=|form\s*control/i.test(ctx.text);
  const hasWcag = /wcag|a11y|accessibility/i.test(ctx.text);

  if (!hasAlt) {
    findings.push(
      warnFinding("a11y-alt", "accessibility", "Images", "No image alt text found", "Alternative text for images was not detected.", "Add descriptive alt text to all meaningful images.", "High", "High", undefined, 0.55),
    );
  }
  if (!hasHeading) {
    findings.push(
      warnFinding("a11y-heading", "accessibility", "Structure", "No heading structure detected", "Headings were not detected.", "Use semantic headings in a logical order.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasLang) {
    findings.push(
      warnFinding("a11y-lang", "accessibility", "Structure", "No language declaration found", "A document language declaration was not detected.", "Declare the page language for screen readers.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasLabels) {
    findings.push(
      warnFinding("a11y-labels", "accessibility", "Forms", "Form labels not found", "Input labels or form controls were not detected.", "Associate labels with form controls.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasContrast) {
    findings.push(
      warnFinding("a11y-contrast", "accessibility", "Visual", "Contrast not addressed", "Colour contrast is not addressed.", "Ensure text meets WCAG contrast ratios.", "Low", "Low", undefined, 0.5),
    );
  }
  if (!hasWcag) {
    findings.push(
      warnFinding("a11y-wcag", "accessibility", "Compliance", "No WCAG reference found", "The document does not reference WCAG or accessibility standards.", "Align with WCAG 2.1 AA where applicable.", "Low", "Low", undefined, 0.5),
    );
  }

  return { findings, detectedType: "Website Accessibility" };
};

const cyberSecurityAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasHttps = /\bhttps:\/\//i.test(ctx.text) || /ssl|tls/i.test(ctx.text);
  const hasHeaders = /(content-security-policy|csp|hsts|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy)/i.test(ctx.text);
  const hasPassword = /(password\s*policy|password\s*complexity|multi[- ]factor|2fa|two[- ]factor|mfa)/i.test(ctx.text);
  const hasEncryption = /(encrypt|encryption|at rest|in transit)/i.test(ctx.text);
  const hasAccess = /(least\s*privilege|access\s*control|rbac|authoriz|role[- ]based)/i.test(ctx.text);
  const hasBackup = /(backup|disaster\s*recovery|restore|immutable)/i.test(ctx.text);

  if (!hasHttps) {
    findings.push(
      warnFinding("sec-https", "cyber-security", "Transport", "No HTTPS/TLS references found", "Encrypted transport was not referenced.", "Serve the site over HTTPS with valid TLS.", "High", "High", undefined, 0.55),
    );
  }
  if (!hasHeaders) {
    findings.push(
      warnFinding("sec-headers", "cyber-security", "Hardening", "Security headers not addressed", "Security headers (CSP, HSTS, X-Frame-Options) were not found.", "Set appropriate security headers.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasPassword) {
    findings.push(
      warnFinding("sec-auth", "cyber-security", "Authentication", "Authentication controls not described", "Password policy or MFA were not found.", "Enforce strong passwords and multi-factor authentication.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasEncryption) {
    findings.push(
      warnFinding("sec-encrypt", "cyber-security", "Data", "Encryption not addressed", "Encryption of data was not mentioned.", "Encrypt data in transit and at rest.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasAccess) {
    findings.push(
      warnFinding("sec-access", "cyber-security", "Access", "Access control not described", "Access control or least privilege was not found.", "Restrict access based on roles and least privilege.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasBackup) {
    findings.push(
      warnFinding("sec-backup", "cyber-security", "Resilience", "Backups not mentioned", "Backup or recovery plans were not found.", "Implement tested backups and recovery.", "Medium", "Medium", undefined, 0.5),
    );
  }

  findings.push(infoFinding("sec-caution", "cyber-security", "Scope", "Authorized testing only", "These checks use only public information and do not scan or attack any system.", "Only perform security assessments you are authorized to conduct.", undefined, 0.7));

  return { findings, detectedType: "Security / Compliance Document" };
};

const aiContentAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const words = countWords(ctx.text);
  const sentences = ctx.text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  let heuristicScore = 0;
  const signals: string[] = [];

  const aiPhrases = [
    "delve",
    "furthermore",
    "moreover",
    "in conclusion",
    "it is important to note",
    "comprehensive overview",
    "game-changer",
    "in today's fast-paced",
    "landscape",
    "navigate the",
    "testament to",
    "underscores",
    "in summary",
    "it's worth noting",
    "plays a crucial role",
  ];
  const phraseHits = aiPhrases.filter((p) => ctx.text.toLowerCase().includes(p));
  if (phraseHits.length >= 3) {
    heuristicScore += 30;
    signals.push(`AI-style phrases found: ${phraseHits.slice(0, 3).join(", ")}`);
  }

  if (sentences.length >= 3) {
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - avg) * (b - avg), 0) / lengths.length;
    const stddev = Math.sqrt(variance);
    if (avg >= 18 && stddev <= 6) {
      heuristicScore += 20;
      signals.push("Uniform sentence lengths (low variance)");
    }
  }

  if (words >= 300) {
    const unique = new Set(ctx.text.toLowerCase().split(/\W+/).filter(Boolean)).size;
    const ratio = unique / words;
    if (ratio < 0.35) {
      heuristicScore += 20;
      signals.push("Low lexical diversity (repetitive vocabulary)");
    }
  }

  const repeated = (ctx.text.match(/(\b\w{4,}\b)\s+\1\b/gi) ?? []).length;
  if (repeated >= 5) {
    heuristicScore += 10;
    signals.push("Frequent repeated words");
  }

  const hedging = (ctx.text.match(/\b(very|extremely|highly|significantly|remarkably|notably|undoubtedly|seamlessly)\b/gi) ?? []).length;
  if (hedging >= 6) {
    heuristicScore += 10;
    signals.push("Heavy use of intensifiers/hedging");
  }

  if (words < 100) {
    signals.push("Text too short for reliable detection");
    heuristicScore = Math.min(heuristicScore, 15);
  }

  const probability = Math.min(95, Math.max(5, heuristicScore));
  const label =
    probability >= 70
      ? "suggests AI-generated content"
      : probability >= 40
        ? "has moderate indicators of AI generation"
        : "shows limited indicators of AI generation";

  findings.push(
    f({
      id: "ai-content-score",
      category: "Content",
      severity: probability >= 70 ? "Medium" : "Info",
      risk: probability >= 70 ? "Medium" : "None",
      title: `AI-content likelihood ~${probability}%`,
      explanation: `Heuristic analysis based on writing patterns. ${signals.join(". ") || "No strong automated signals found."}`,
      recommendation:
        "AI detection is probabilistic and not proof of authorship. Use this as a signal, not a verdict.",
      confidence: 0.5,
      evidenceText: signals.slice(0, 2).join(" | ") || undefined,
      rule: "ai-content",
    }),
  );

  findings.push(infoFinding("ai-content-caveat", "ai-content", "Content", "Detection is probabilistic", "AI-content detection cannot be conclusive.", "Do not use this alone to accuse or judge authorship.", undefined, 0.6));

  return { findings, detectedType: "Text Content" };
};

const scamAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const signals: { id: string; category: string; label: string; words: string[] }[] = [
    { id: "scam-urgency", category: "Urgency", label: "Urgency/pressure tactics", words: ["urgent", "immediately", "act now", "right away", "asap", "today only", "limited time", "don't miss"] },
    { id: "scam-prize", category: "Prize", label: "Unexpected prize or winnings", words: ["lottery", "you've won", "you have won", "prize", "jackpot", "lucky winner", "congratulations"] },
    { id: "scam-money", category: "Money", label: "Requests for money or fees", words: ["wire", "transfer", "send money", "bank details", "advance fee", "processing fee", "payment required", "western union"] },
    { id: "scam-personal", category: "Personal Info", label: "Requests personal information", words: ["otp", "password", "aadhaar", "ssn", "social security", "credit card number", "verify your account", "confirm your identity"] },
    { id: "scam-sender", category: "Sender", label: "Unknown or spoofed sender cues", words: ["unknown", "unrecognized", "new number", "official government", "tax department", "bank official", "customs"] },
    { id: "scam-link", category: "Links", label: "Suspicious links or attachments", words: ["click here", "download attached", "open the attachment", "verify link", "bit.ly", "login page"] },
  ];

  const hitCount: Record<string, number> = {};
  const hits: { id: string; category: string; words: string[] }[] = [];
  for (const s of signals) {
    const found = s.words.filter((w) => low.includes(w));
    if (found.length > 0) {
      hitCount[s.id] = found.length;
      hits.push({ id: s.id, category: s.category, words: found });
    }
  }

  if (hits.length === 0) {
    findings.push(infoFinding("scam-none", "scam", "Assessment", "No strong scam indicators found", "None of the common scam patterns were detected.", "Remain cautious; absence of indicators is not proof of legitimacy.", undefined, 0.55));
  } else {
    const totalHits = hits.reduce((a, h) => a + hitCount[h.id], 0);
    const risk = totalHits >= 5 ? "High" : totalHits >= 3 ? "Medium" : "Low";
    const sev = totalHits >= 5 ? "High" : totalHits >= 3 ? "Medium" : "Info";

    findings.push(
      warnFinding(
        "scam-indicators",
        "scam",
        "Assessment",
        `${hits.length} scam indicator categor${hits.length === 1 ? "y" : "ies"} present (${totalHits} signals)`,
        `Detected signals: ${hits.map((h) => h.category).join(", ")}.`,
        "Treat unsolicited messages requesting money or personal data with extreme caution; verify through official channels.",
        sev as Severity,
        risk as RiskLevel,
        hits.slice(0, 3).map((h) => h.words.slice(0, 2).join(", ")).join(" | "),
        0.6,
      ),
    );
  }

  findings.push(infoFinding("scam-caution", "scam", "Advice", "Indicators, not accusations", "These are indicators of possible fraud, not proof that any specific message is a scam.", "Always verify through official, trusted channels before acting.", undefined, 0.6));

  return { findings, detectedType: "Message / Communication" };
};

const fraudAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();

  const duplicateLike = (ctx.text.match(/\b(delivery|invoice|claim|bill|order)\s*(?:no\.?|number|id|ref)?\s*[:#]?\s*[A-Z0-9-]{4,}/gi) ?? []).length;
  if (duplicateLike > 3) {
    findings.push(
      warnFinding("fraud-dup", "fraud", "Patterns", "Possible duplicate identifiers", `Found ${duplicateLike} identifier-like tokens; repeated identifiers can indicate duplicate claims.`, "Cross-check identifiers against an official register.", "Medium", "Medium", undefined, 0.5),
    );
  }

  const inconsistencies = (ctx.text.match(/\b(inconsistent|discrepanc|mismatch|contradict|unusual|irregular|forged|tampered|altered)\b/gi) ?? []).length;
  if (inconsistencies > 0) {
    findings.push(
      warnFinding("fraud-inconsist", "fraud", "Inconsistencies", `${inconsistencies} inconsistency indicator${inconsistencies === 1 ? "" : "s"}`, "Terms suggesting discrepancies or alteration were found.", "Verify the document against original records.", "Medium", "Medium", undefined, 0.55),
    );
  }

  const highRisk = (ctx.text.match(/\b(cash only|no receipt|off the record|under the table|avoid tax|falsif|counterfeit|fake)\b/gi) ?? []).length;
  if (highRisk > 0) {
    findings.push(
      warnFinding("fraud-highrisk", "fraud", "Indicators", "High-risk language present", "Phrases that suggest concealment or falsification were found.", "Do not rely on the document without verification.", "High", "High", undefined, 0.55),
    );
  }

  const totals = extractMoney(ctx.text);
  if (totals.length >= 3) {
    const values = totals.map((t) => t.value).filter((v): v is number => v !== null);
    if (values.length >= 3 && new Set(values.map((v) => v.toFixed(2))).size === 1) {
      findings.push(
        warnFinding("fraud-repeated-amount", "fraud", "Patterns", "Repeated identical amounts", "Multiple identical amounts were detected, which can indicate template-based fraud.", "Verify each transaction against supporting records.", "Low", "Low", totals.slice(0, 3).map((t) => t.raw).join(" | "), 0.5),
      );
    }
  }

  if (findings.length === 0) {
    findings.push(infoFinding("fraud-none", "fraud", "Assessment", "No clear fraud indicators found", "No strong indicators of inconsistency or fraud were detected.", "This is not a clean bill of health; corroborate with official records.", undefined, 0.55));
  }

  findings.push(infoFinding("fraud-caution", "fraud", "Advice", "Indicators, not accusations", "These are indicators of possible fraud, not accusations against any person or organization.", "Verify through official channels before any action.", undefined, 0.65));

  return { findings, detectedType: "Financial / Claims Document" };
};

const businessProposalAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasExecSummary = /executive\s*summary|overview|summary/i.test(ctx.text);
  const hasMarket = /market|industry|target\s*(audience|customer)|tam|sam|som/i.test(ctx.text);
  const hasRevenue = /revenue|projection|forecast|sales\s*plan|pricing/i.test(ctx.text);
  const hasCosts = /cost|expense|burn\s*rate|margin|budget|capex|opex/i.test(ctx.text);
  const hasCompetition = /competit|differentiat|moat|rival|market\s*share/i.test(ctx.text);
  const hasTeam = /team|founder|management|leadership|key\s*people/i.test(ctx.text);
  const hasRisks = /risk|challenge|assumption|mitigation/i.test(ctx.text);

  if (!hasExecSummary) {
    findings.push(
      warnFinding("bp-summary", "business-proposal", "Structure", "No executive summary found", "An executive summary was not detected.", "Lead with a crisp executive summary.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasMarket) {
    findings.push(
      warnFinding("bp-market", "business-proposal", "Market", "Market analysis missing", "Market size or target customer analysis was not found.", "Include market sizing and target segments.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasRevenue) {
    findings.push(
      warnFinding("bp-revenue", "business-proposal", "Financials", "Revenue projections missing", "Revenue or sales projections were not found.", "Provide revenue projections with clear assumptions.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasCosts) {
    findings.push(
      warnFinding("bp-costs", "business-proposal", "Financials", "Cost structure missing", "Costs, margins, or budget were not found.", "Show cost structure and margin assumptions.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasCompetition) {
    findings.push(
      warnFinding("bp-competition", "business-proposal", "Market", "Competition not addressed", "A competitive analysis was not found.", "Address competition and your differentiation.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasRisks) {
    findings.push(
      warnFinding("bp-risks", "business-proposal", "Risks", "Risks not addressed", "Risks and assumptions were not found.", "Acknowledge key risks and mitigations.", "Low", "Low", undefined, 0.5),
    );
  }

  return { findings, detectedType: "Business Proposal" };
};

const ndaAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasParties = /(between|party|company|disclosing|receiving)\s+/i.test(ctx.text) && /\b(disclosing\s+party|receiving\s+party|the\s+company|both\s+parties)\b/i.test(ctx.text);
  const hasDef = /confidential\s*information|confidentiality\s*obligations|confidential\s+data/i.test(ctx.text);
  const hasTerm = /(term|duration|period|effective\s*date|survive|expires)/i.test(ctx.text);
  const hasExclusions = /(exclu|not\s*confidential|public\s*domain|independently\s*developed|already\s*known)/i.test(ctx.text);
  const hasGoverningLaw = /governing\s*law|jurisdiction|venue|courts\s+of/i.test(ctx.text);
  const hasMutual = /mutual|both\s+parties/i.test(ctx.text);
  const hasOneWay = /one[- ]way|only\s+the\s+disclosing|the\s+disclosing\s+party\s+only/i.test(ctx.text);

  if (!hasParties) {
    findings.push(
      warnFinding("nda-parties", "nda", "Parties", "Parties not clearly identified", "The contracting parties were not clearly identified.", "Confirm who is bound by the agreement.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasDef) {
    findings.push(
      warnFinding("nda-def", "nda", "Scope", "Confidential information not defined", "A definition of confidential information was not found.", "Ensure the definition of confidential information is clear and workable.", "High", "High", undefined, 0.55),
    );
  }
  if (!hasTerm) {
    findings.push(
      warnFinding("nda-term", "nda", "Duration", "No term or duration found", "The agreement's term was not found.", "Confirm the term and any survival period.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasExclusions) {
    findings.push(
      warnFinding("nda-exclusions", "nda", "Scope", "No exclusions from confidentiality", "Exclusions (public info, independent development) were not found.", "Standard NDAs list what is not confidential.", "Low", "Low", undefined, 0.5),
    );
  }
  if (!hasGoverningLaw) {
    findings.push(
      warnFinding("nda-law", "nda", "Governing Law", "No governing law clause found", "The governing law or jurisdiction was not found.", "Confirm governing law and dispute venue.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (hasOneWay && !hasMutual) {
    findings.push(
      warnFinding("nda-oneway", "nda", "Direction", "Appears to be one-way", "Language suggests only one party's disclosures are protected.", "Consider whether a mutual NDA is more appropriate.", "Medium", "Medium", lineContaining(ctx, ["disclosing", "one-way"]) ?? undefined, 0.55),
    );
  } else if (hasMutual) {
    findings.push(infoFinding("nda-mutual", "nda", "Direction", "Appears to be mutual", "Both parties' disclosures appear to be covered.", "Confirm both sides share equal obligations.", lineContaining(ctx, ["mutual", "both parties"]) ?? undefined, 0.6));
  }

  return { findings, detectedType: "Non-Disclosure Agreement" };
};

const dueDiligenceAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasCompany = /(company|target|entity|legal\s*name|registered\s*address|cin|registration\s*number)/i.test(ctx.text);
  const hasStructure = /(shareholder|ownership|capital\s*structure|subsidiar|holding|equity|shares)/i.test(ctx.text);
  const hasFinancials = /(revenue|profit|balance\s*sheet|liabilit|asset|turnover|financial\s*statement)/i.test(ctx.text);
  const hasLegal = /(litigation|lawsuit|dispute|claim|penal|proceeding|notice)/i.test(ctx.text);
  const hasCompliance = /(compliance|license|permit|regulatory|registration|tax\s*filing)/i.test(ctx.text);

  if (!hasCompany) {
    findings.push(
      warnFinding("dd-company", "due-diligence", "Company", "Company identifiers missing", "The target company's identifiers were not found.", "Confirm legal name, registration details, and address.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasStructure) {
    findings.push(
      warnFinding("dd-structure", "due-diligence", "Structure", "Ownership structure missing", "Ownership or capital structure was not found.", "Map the ownership and corporate structure.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasFinancials) {
    findings.push(
      warnFinding("dd-financials", "due-diligence", "Financial", "Financial information missing", "Revenue, assets, or liabilities were not found.", "Obtain audited financial statements.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasLegal) {
    findings.push(
      warnFinding("dd-legal", "due-diligence", "Legal", "Legal exposures not covered", "Litigation or disputes were not addressed.", "Search for pending litigation and disputes.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasCompliance) {
    findings.push(
      warnFinding("dd-compliance", "due-diligence", "Compliance", "Regulatory compliance not addressed", "Licenses, permits, or regulatory matters were not found.", "Verify all required licenses and regulatory standing.", "Medium", "Medium", undefined, 0.5),
    );
  }

  findings.push(infoFinding("dd-caution", "due-diligence", "Advice", "Not a full due-diligence opinion", "This tool flags what is present or missing in the text; it is not a legal or financial opinion.", "Engage advisers for a complete due-diligence review.", undefined, 0.6));

  return { findings, detectedType: "Due Diligence Document" };
};

const complianceAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const hasPolicy = /(policy|procedure|manual|guideline|framework)/i.test(ctx.text);
  const hasOwner = /(responsible|owner|compliance\s*officer|designated|champion|committee)/i.test(ctx.text);
  const hasRegs = /(regulation|statute|act\s+\d|directive|standard|law|legal\s*requirement)/i.test(ctx.text);
  const hasReview = /(review|annual|update|schedule|renew|refresh)/i.test(ctx.text);
  const hasTraining = /(training|awareness|communication|onboarding|education)/i.test(ctx.text);
  const hasMonitoring = /(monitor|audit|track|measure|reporting|kpi|metric)/i.test(ctx.text);

  if (!hasPolicy) {
    findings.push(
      warnFinding("cmp-policy", "compliance", "Policies", "No policy document detected", "A policy or procedure was not found.", "Document policies and procedures in writing.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasRegs) {
    findings.push(
      warnFinding("cmp-regs", "compliance", "Standards", "Applicable regulations not cited", "Relevant laws or standards were not referenced.", "Identify and cite the regulations that apply.", "High", "High", undefined, 0.5),
    );
  }
  if (!hasOwner) {
    findings.push(
      warnFinding("cmp-owner", "compliance", "Governance", "No compliance owner identified", "Who is responsible for compliance was not found.", "Assign a responsible owner for each requirement.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasMonitoring) {
    findings.push(
      warnFinding("cmp-monitoring", "compliance", "Monitoring", "No monitoring or audit process", "How compliance is monitored was not found.", "Define monitoring, measurement, and reporting.", "Medium", "Medium", undefined, 0.5),
    );
  }
  if (!hasTraining) {
    findings.push(
      warnFinding("cmp-training", "compliance", "Awareness", "No training or awareness plan", "Awareness/training activities were not found.", "Schedule training and awareness for employees.", "Low", "Low", undefined, 0.5),
    );
  }
  if (!hasReview) {
    findings.push(
      warnFinding("cmp-review", "compliance", "Maintenance", "No review cycle found", "Periodic review or update plans were not found.", "Schedule periodic reviews and updates.", "Low", "Low", undefined, 0.5),
    );
  }

  return { findings, detectedType: "Compliance / Policy Document" };
};

const clauseRiskAnalyzer: Analyzer = (ctx) => {
  const findings: Finding[] = [];
  const low = ctx.text.toLowerCase();
  const risks: { id: string; category: string; label: string; terms: string[] }[] = [
    { id: "cr-indemnity", category: "Indemnity", label: "Broad indemnity obligations", terms: ["indemnify", "hold harmless", "defend", "reimburse"] },
    { id: "cr-liability", category: "Liability", label: "Liability cap / limitation", terms: ["limitation of liability", "aggregate liability", "cap of", "liability cap"] },
    { id: "cr-termination", category: "Termination", label: "Unilateral termination", terms: ["terminate at will", "terminate this agreement", "without cause"] },
    { id: "cr-auto-renew", category: "Renewal", label: "Auto-renewal clause", terms: ["automatically renew", "auto-renew", "shall renew", "unless either party"] },
    { id: "cr-confidentiality", category: "Confidentiality", label: "One-sided confidentiality", terms: ["confidentiality", "non-disclosure", "trade secrets"] },
    { id: "cr-exclusivity", category: "Exclusivity", label: "Exclusivity obligations", terms: ["exclusive", "sole provider", "sole source", "non-compete"] },
    { id: "cr-noncompete", category: "Restraint", label: "Non-compete language", terms: ["non-compete", "restrictive covenant", "shall not compete"] },
    { id: "cr-penalty", category: "Penalties", label: "Penalty / liquidated damages", terms: ["liquidated damages", "penalty", "damages of"] },
  ];

  const found = risks.filter((r) => r.terms.some((t) => low.includes(t)));
  if (found.length === 0) {
    findings.push(infoFinding("cr-none", "clause-risk", "Assessment", "No common high-risk clauses detected", "None of the common high-risk clause patterns were found.", "This does not mean the agreement is risk-free; review it in full.", undefined, 0.5));
  } else {
    for (const r of found) {
      const evidence = lineContaining(ctx, r.terms);
      findings.push(
        warnFinding(
          r.id,
          "clause-risk",
          r.category,
          r.label,
          `Clause language in the "${r.category}" area was detected.`,
          "Read the full clause in context and negotiate if the obligation is one-sided.",
          "Medium",
          "Medium",
          evidence,
          0.58,
        ),
      );
    }
  }

  return { findings, detectedType: "Agreement / Contract" };
};

const customAuditAnalyzer: Analyzer = (ctx, config) => {
  const findings: Finding[] = [];
  const focus = (config?.focus as string | undefined) ?? "";
  const focusKeywords = (config?.keywords as string | undefined) ?? "";

  const checks = config?.rules as unknown;
  const rules = Array.isArray(checks) ? checks : [];
  for (const r of rules) {
    if (typeof r !== "object" || r === null) continue;
    const obj = r as Record<string, unknown>;
    const id = String(obj.id ?? "custom-rule");
    const category = String(obj.category ?? "Custom");
    const label = String(obj.title ?? obj.name ?? "Custom check");
    const terms = (Array.isArray(obj.terms) ? obj.terms : []).map(String);
    const isAbsence = obj.mode === "absence";
    if (terms.length === 0) continue;
    const present = terms.some((t) => ctx.text.toLowerCase().includes(t.toLowerCase()));
    // Required (present) mode: flag when the term is MISSING.
    // Absence mode: flag when the term IS present (prohibited content found).
    if (isAbsence ? !present : present) continue;
    const evidenceLine = isAbsence ? undefined : lineContaining(ctx, terms);
    findings.push(
      warnFinding(
        `custom-${id}`,
        "custom-audit",
        category,
        isAbsence ? `${label} present` : `"${label}" not found`,
        isAbsence
          ? `A term you asked to flag was found: ${terms.join(", ")}.`
          : `None of the required terms were found: ${terms.join(", ")}.`,
        "Review this custom check in context.",
        isAbsence ? "Medium" : "Medium",
        isAbsence ? "Medium" : "Medium",
        evidenceLine,
        0.6,
      ),
    );
  }

  if (rules.length === 0 && focusKeywords) {
    const keywords = focusKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    const hits = keywords.filter((k) => ctx.text.toLowerCase().includes(k.toLowerCase()));
    if (hits.length > 0) {
      findings.push(
        warnFinding("custom-keywords", "custom-audit", "Custom Focus", `${hits.length} custom keyword${hits.length === 1 ? "" : "s"} found`, `Matched: ${hits.join(", ")}.`, "Review each match in context.", "Info", "None", lineContaining(ctx, hits) ?? undefined, 0.6),
      );
    } else {
      findings.push(infoFinding("custom-keywords-none", "custom-audit", "Custom Focus", "No custom keywords found", "None of your focus keywords appeared in the document.", "The document may not cover the topics you wanted.", undefined, 0.55));
    }
  }

  if (findings.length === 0) {
    findings.push(infoFinding("custom-structure", "custom-audit", "Document", "Document analyzed", "The document was analyzed using the default structural checks.", "Use custom rules or focus keywords for more specific analysis.", undefined, 0.5));
  }

  return { findings, detectedType: "Custom Audit" };
};

const documentComparisonAnalyzer: Analyzer = (ctx, config) => {
  const findings: Finding[] = [];

  const secondText = (config?.compareText as string | undefined) ?? "";

  if (secondText) {
    const aWords = new Set(ctx.text.toLowerCase().split(/\W+/).filter(Boolean));
    const bWords = new Set(secondText.toLowerCase().split(/\W+/).filter(Boolean));
    const common = [...aWords].filter((w) => bWords.has(w)).length;
    const total = new Set([...aWords, ...bWords]).size;
    const similarity = total === 0 ? 0 : Math.round((common / total) * 100);
    const diffWords = [...aWords].filter((w) => !bWords.has(w));
    const addedWords = [...bWords].filter((w) => !aWords.has(w));

    findings.push(
      infoFinding(
        "cmp-similarity",
        "document-comparison",
        "Comparison",
        `Word-overlap similarity ~${similarity}%`,
        `Compared the provided texts by unique-word overlap.`,
        "Use a proper diff tool for exact line-level changes.",
        `Similarity ~${similarity}%`,
        0.6,
      ),
    );
    if (diffWords.length > 0) {
      findings.push(
        warnFinding("cmp-removed", "document-comparison", "Changes", `${diffWords.length} word${diffWords.length === 1 ? "" : "s"} unique to document A`, "Terms that appear only in the first document were found.", "Review removals carefully.", "Medium", "Medium", diffWords.slice(0, 10).join(", "), 0.55),
      );
    }
    if (addedWords.length > 0) {
      findings.push(
        warnFinding("cmp-added", "document-comparison", "Changes", `${addedWords.length} word${addedWords.length === 1 ? "" : "s"} unique to document B`, "Terms that appear only in the second document were found.", "Review additions carefully.", "Medium", "Medium", addedWords.slice(0, 10).join(", "), 0.55),
      );
    }
    return { findings, detectedType: "Document Comparison (2 docs)" };
  }

  const sep = ctx.text.split(/\n\s*(-{5,}|={5,}|\*{5,}|VERSION\s*[AB]|DOCUMENT\s*[12])\s*\n/i);
  if (sep.length >= 3) {
    const a = sep[0] ?? "";
    const b = sep[2] ?? "";
    if (a.trim().length > 40 && b.trim().length > 40) {
      const aWords = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
      const bWords = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
      const common = [...aWords].filter((w) => bWords.has(w)).length;
      const total = new Set([...aWords, ...bWords]).size;
      const similarity = total === 0 ? 0 : Math.round((common / total) * 100);
      findings.push(
        infoFinding("cmp-split", "document-comparison", "Comparison", `Found two documents in one input (similarity ~${similarity}%)`, "The input appears to contain two documents separated by a divider.", "Split the documents in the client for a cleaner comparison.", `Similarity ~${similarity}%`, 0.6),
      );
      return { findings, detectedType: "Document Comparison (split input)" };
    }
  }

  const hasVersionWords = /(version|revised|amended|v\d|draft|final)/i.test(ctx.text);
  findings.push(
    warnFinding(
      "cmp-need-two",
      "document-comparison",
      "Comparison",
      "Only one document provided",
      "Document comparison needs two versions (or a second text via configuration).",
      "Upload both versions, or pass the second text to compare.",
      "Medium",
      "Medium",
      hasVersionWords ? lineContaining(ctx, ["version", "revised", "amended"]) ?? undefined : undefined,
      0.6,
    ),
  );

  return { findings, detectedType: "Document Comparison" };
};

/* ------------------------------ registry ------------------------------ */

export const ANALYZERS: Record<string, Analyzer> = {
  salary: salaryAnalyzer,
  resume: resumeAnalyzer,
  invoice: invoiceAnalyzer,
  gst: gstAnalyzer,
  "tax-notice": taxNoticeAnalyzer,
  "legal-notice": legalNoticeAnalyzer,
  loan: loanAnalyzer,
  bank: bankAnalyzer,
  medical: medicalAnalyzer,
  prescription: prescriptionAnalyzer,
  research: researchAnalyzer,
  trademark: trademarkAnalyzer,
  "website-privacy": websitePrivacyAnalyzer,
  cookie: cookieAnalyzer,
  seo: seoAnalyzer,
  accessibility: accessibilityAnalyzer,
  "cyber-security": cyberSecurityAnalyzer,
  "ai-content": aiContentAnalyzer,
  scam: scamAnalyzer,
  fraud: fraudAnalyzer,
  "business-proposal": businessProposalAnalyzer,
  nda: ndaAnalyzer,
  "due-diligence": dueDiligenceAnalyzer,
  compliance: complianceAnalyzer,
  "clause-risk": clauseRiskAnalyzer,
  "custom-audit": customAuditAnalyzer,
  "document-comparison": documentComparisonAnalyzer,
};

export function getAnalyzer(name: string | undefined): Analyzer | undefined {
  return name ? ANALYZERS[name] : undefined;
}

export { splitLines, clip, countWords };
