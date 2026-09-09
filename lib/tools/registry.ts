import {
  Accessibility,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CheckSquare,
  Cookie,
  Copyright,
  EyeOff,
  FileBarChart,
  FileLock,
  FileSearch,
  FileText,
  FileWarning,
  Files,
  Fingerprint,
  Globe,
  HandCoins,
  Handshake,
  Home,
  Landmark,
  Lightbulb,
  Lock,
  MailCheck,
  Microscope,
  Percent,
  Pill,
  Receipt,
  Scale,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Truck,
  UserCheck,
  Wallet,
} from "lucide-react";
import type {
  ConfigField,
  PricingInfo,
  ReportSection,
  ToolDefinition,
  ToolCategory,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Pricing defaults (admin can override per-tool via admin panel)      */
/* ------------------------------------------------------------------ */

export const PRICING_NOTE =
  "Credits are charged per run. Platform admins can adjust tool pricing at any time.";

function price(tier: PricingInfo["tier"], usd: number, credits: number): PricingInfo {
  return { tier, priceUsd: usd, creditsPerRun: credits, notes: PRICING_NOTE };
}

const cfgReviewDepth: ConfigField = {
  key: "reviewDepth",
  label: "Review depth",
  type: "select",
  options: [
    { label: "Quick scan", value: "quick" },
    { label: "Balanced", value: "balanced" },
    { label: "Deep review", value: "deep" },
  ],
  default: "balanced",
  help: "Controls how thoroughly sections are analyzed. Deep review costs more credits.",
};

const cfgLanguage: ConfigField = {
  key: "language",
  label: "Report language",
  type: "select",
  options: [
    { label: "English", value: "en" },
    { label: "Hindi", value: "hi" },
    { label: "Spanish", value: "es" },
    { label: "German", value: "de" },
    { label: "French", value: "fr" },
  ],
  default: "en",
};

const cfgSensitivity: ConfigField = {
  key: "sensitivity",
  label: "Risk sensitivity",
  type: "slider",
  min: 1,
  max: 5,
  step: 1,
  default: 3,
  help: "Higher sensitivity flags more items as risky.",
};

const cfgSourceLanguage: ConfigField = {
  key: "sourceLanguage",
  label: "Document language",
  type: "select",
  options: [
    { label: "Auto-detect", value: "auto" },
    { label: "English", value: "en" },
    { label: "Hindi", value: "hi" },
    { label: "Other", value: "other" },
  ],
  default: "auto",
};

const cfgIncludeSummary: ConfigField = {
  key: "includeSummary",
  label: "Include executive summary",
  type: "toggle",
  default: true,
};

const cfgEmailCopy: ConfigField = {
  key: "emailCopy",
  label: "Include email copy for the other party",
  type: "toggle",
  default: false,
};

const cfgMaxPages: ConfigField = {
  key: "maxPages",
  label: "Maximum pages to analyze",
  type: "number",
  min: 1,
  max: 200,
  default: 50,
};

const cfgJurisdiction: ConfigField = {
  key: "jurisdiction",
  label: "Jurisdiction",
  type: "select",
  options: [
    { label: "India", value: "in" },
    { label: "United States", value: "us" },
    { label: "United Kingdom", value: "uk" },
    { label: "European Union", value: "eu" },
    { label: "Other", value: "other" },
  ],
  default: "in",
};

const cfgAudience: ConfigField = {
  key: "audience",
  label: "Who is the document for?",
  type: "select",
  options: [
    { label: "Myself (individual)", value: "individual" },
    { label: "My business", value: "business" },
  ],
  default: "individual",
};

/* Shared report section presets ---------------------------------------- */

const R = {
  overview: "Plain-language summary of the document and overall posture.",
  score: "Aggregate 0-100 risk or confidence score with a severity breakdown.",
  findings: "Prioritized list of concerning and favorable items found.",
  clauses: "Section-by-section review with original text snippets and plain-English explanations.",
  details: "Itemized review of individual records, entries or transactions.",
  chart: "Visual trend and distribution charts derived from the input data.",
  actions: "Concrete, actionable next steps and suggested wording changes.",
  verdict: "Overall recommendation or verdict.",
} as const;

function sections(
  kinds: ReportSection["kind"][],
  titles: string[],
): ReportSection[] {
  return kinds.map((kind, i) => ({
    title: titles[i] ?? kind,
    kind,
    description: R[kind] ?? R.overview,
  }));
}

const LEGAL_SECTIONS = sections(
  ["overview", "score", "findings", "clauses", "actions", "verdict"],
  ["Executive Summary", "Risk Score", "Key Findings", "Clause-by-Clause Review", "Recommended Actions", "Final Verdict"],
);

const FINANCE_SECTIONS = sections(
  ["overview", "score", "findings", "details", "chart", "actions", "verdict"],
  ["Executive Summary", "Risk & Anomaly Score", "Key Findings", "Itemized Review", "Trend Analysis", "Recommended Actions", "Final Verdict"],
);

const TECHNICAL_SECTIONS = sections(
  ["overview", "score", "findings", "details", "actions", "verdict"],
  ["Executive Summary", "Compliance Score", "Key Findings", "Itemized Checklist", "Recommended Actions", "Final Verdict"],
);

const CONTENT_SECTIONS = sections(
  ["overview", "score", "findings", "details", "actions", "verdict"],
  ["Executive Summary", "Confidence Score", "Key Findings", "Evidence Breakdown", "Recommended Actions", "Final Verdict"],
);

const RESEARCH_SECTIONS = sections(
  ["overview", "score", "findings", "clauses", "chart", "actions", "verdict"],
  ["Executive Summary", "Risk & Novelty Score", "Key Findings", "Section-by-Section Review", "Comparison Charts", "Recommended Actions", "Final Verdict"],
);

const WEBSITE_SECTIONS = sections(
  ["overview", "score", "findings", "details", "chart", "actions", "verdict"],
  ["Executive Summary", "Website Score", "Key Findings", "Checklist Results", "Score Breakdown", "Recommended Actions", "Final Verdict"],
);

/* Category accents ------------------------------------------------------ */

export const categoryLabels: ToolCategory[] = [
  "Legal",
  "Finance",
  "Tax",
  "Privacy & Compliance",
  "Security",
  "Employment & Career",
  "Health & Medical",
  "Research & IP",
  "Marketing & SEO",
  "Business",
  "Productivity",
];

/* ------------------------------------------------------------------ */
/* The 40-tool registry                                                */
/* ------------------------------------------------------------------ */

export const TOOL_REGISTRY: ToolDefinition[] = [
  /* Legal (12) */
  {
    slug: "contract-watchdog",
    name: "Contract Watchdog",
    tagline: "Keep an eye on every contract you sign",
    description:
      "Analyzes contracts for unfavorable terms, hidden obligations, auto-renewal traps, and one-sided clauses, and translates them into plain English.",
    category: "Legal",
    inputs: ["pdf", "docx", "doc", "txt", "image"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction, cfgIncludeSummary],
    reportSections: LEGAL_SECTIONS,
    icon: FileSearch,
    accent: "indigo",
  },
  {
    slug: "insurance-trap-detector",
    name: "Insurance Trap Detector",
    tagline: "Spot exclusions and coverage gaps before you claim",
    description:
      "Reviews insurance policies and proposals for exclusions, waiting periods, claim-rejection traps, and hidden conditions that can void your cover.",
    category: "Legal",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgIncludeSummary],
    reportSections: LEGAL_SECTIONS,
    icon: ShieldAlert,
    accent: "rose",
  },
  {
    slug: "privacy-policy-auditor",
    name: "Privacy Policy Auditor",
    tagline: "Understand what apps and sites do with your data",
    description:
      "Evaluates privacy policies for data collection practices, third-party sharing, retention periods, and user rights, benchmarked against common regulations.",
    category: "Privacy & Compliance",
    inputs: ["url", "pdf", "docx", "txt", "html"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction, cfgAudience],
    reportSections: LEGAL_SECTIONS,
    icon: EyeOff,
    accent: "sky",
  },
  {
    slug: "terms-conditions-analyzer",
    name: "Terms & Conditions Analyzer",
    tagline: "Decode the fine print you never read",
    description:
      "Breaks down Terms and Conditions into plain-English summaries, highlighting arbitration clauses, liability caps, account suspension rights, and auto-renewals.",
    category: "Privacy & Compliance",
    inputs: ["url", "pdf", "docx", "txt", "html"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction, cfgAudience],
    reportSections: LEGAL_SECTIONS,
    icon: FileText,
    accent: "sky",
  },
  {
    slug: "rental-agreement-analyzer",
    name: "Rental Agreement Analyzer",
    tagline: "Know your rights before you rent",
    description:
      "Analyzes residential rental and lease agreements for unfair deposit terms, eviction clauses, maintenance obligations, and hidden fees.",
    category: "Legal",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: Home,
    accent: "amber",
  },
  {
    slug: "employment-contract-analyzer",
    name: "Employment Contract Analyzer",
    tagline: "Check your offer before you sign on the dotted line",
    description:
      "Reviews employment agreements for restrictive covenants, notice periods, salary structures, probation terms, and IP assignment clauses.",
    category: "Employment & Career",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: Briefcase,
    accent: "teal",
  },
  {
    slug: "salary-slip-analyzer",
    name: "Salary Slip Analyzer",
    tagline: "Verify your payslip line by line",
    description:
      "Checks payslips for correct earnings, deductions, tax withholding, provident fund contributions, and consistency with your offer and local rules.",
    category: "Finance",
    inputs: ["pdf", "image", "xlsx", "csv", "txt"],
    pricing: price("Free", 0, 1),
    config: [cfgSourceLanguage, cfgLanguage, cfgIncludeSummary],
    reportSections: FINANCE_SECTIONS,
    icon: Banknote,
    accent: "emerald",
  },
  {
    slug: "resume-auditor",
    name: "Resume Auditor",
    tagline: "Make your resume ATS-proof and interviewer-ready",
    description:
      "Reviews resumes for structure, keyword coverage, formatting issues, quantified impact, and ATS compatibility with actionable suggestions.",
    category: "Employment & Career",
    inputs: ["pdf", "docx", "txt", "markdown"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgLanguage, cfgIncludeSummary],
    reportSections: CONTENT_SECTIONS,
    icon: UserCheck,
    accent: "teal",
  },
  {
    slug: "offer-letter-analyzer",
    name: "Offer Letter Analyzer",
    tagline: "Read the fine print in your job offer",
    description:
      "Analyzes offer letters for compensation accuracy, bonus terms, probation conditions, joining formalities, and clauses that differ from what was promised.",
    category: "Employment & Career",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: MailCheck,
    accent: "teal",
  },
  {
    slug: "invoice-auditor",
    name: "Invoice Auditor",
    tagline: "Never overpay on a vendor invoice again",
    description:
      "Verifies invoices against expected amounts, taxes, payment terms, duplicate entries, and billing errors, and flags suspicious patterns.",
    category: "Finance",
    inputs: ["pdf", "image", "xlsx", "csv", "txt"],
    pricing: price("Starter", 4.99, 2),
    config: [cfgReviewDepth, cfgLanguage, cfgIncludeSummary, cfgEmailCopy],
    reportSections: FINANCE_SECTIONS,
    icon: Receipt,
    accent: "emerald",
  },
  {
    slug: "gst-invoice-checker",
    name: "GST Invoice Checker",
    tagline: "Validate GST invoices for input credit eligibility",
    description:
      "Checks GST invoices for correct GSTIN, tax rates, HSN codes, place of supply, and mandatory fields required for input tax credit.",
    category: "Tax",
    inputs: ["pdf", "image", "xlsx", "csv", "txt"],
    pricing: price("Starter", 4.99, 2),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: FINANCE_SECTIONS,
    icon: Percent,
    accent: "violet",
  },
  {
    slug: "tax-notice-analyzer",
    name: "Tax Notice Analyzer",
    tagline: "Understand what the tax department wants from you",
    description:
      "Decodes tax notices into plain English: what triggered the notice, the deadline, documents needed, and suggested next steps.",
    category: "Tax",
    inputs: ["pdf", "image", "txt"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgSourceLanguage, cfgLanguage, cfgJurisdiction, cfgMaxPages],
    reportSections: LEGAL_SECTIONS,
    icon: Landmark,
    accent: "violet",
  },
  {
    slug: "legal-notice-analyzer",
    name: "Legal Notice Analyzer",
    tagline: "Don't panic - understand the notice first",
    description:
      "Analyzes legal demand and notice letters for the claim, basis, deadlines, escalation risk, and recommended response strategy.",
    category: "Legal",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: Scale,
    accent: "indigo",
  },
  {
    slug: "loan-agreement-analyzer",
    name: "Loan Agreement Analyzer",
    tagline: "Understand what your loan really costs",
    description:
      "Reviews loan agreements for interest computation, prepayment penalties, default clauses, hidden charges, and repayment obligations.",
    category: "Finance",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction],
    reportSections: FINANCE_SECTIONS,
    icon: HandCoins,
    accent: "emerald",
  },
  {
    slug: "bank-statement-analyzer",
    name: "Bank Statement Analyzer",
    tagline: "Spot hidden charges and unusual activity",
    description:
      "Reviews bank statements for hidden fees, unauthorized debits, interest accuracy, unusual patterns, and overall cash-flow health.",
    category: "Finance",
    inputs: ["pdf", "xlsx", "csv", "image"],
    pricing: price("Starter", 4.99, 2),
    config: [cfgReviewDepth, cfgLanguage, cfgIncludeSummary],
    reportSections: FINANCE_SECTIONS,
    icon: Wallet,
    accent: "emerald",
  },
  {
    slug: "medical-report-analyzer",
    name: "Medical Report Analyzer",
    tagline: "Understand your lab results in plain language",
    description:
      "Explains medical and lab reports in accessible language, highlighting out-of-range values and flagging when to consult a doctor.",
    category: "Health & Medical",
    inputs: ["pdf", "image", "txt"],
    pricing: price("Free", 0, 1),
    config: [cfgSourceLanguage, cfgLanguage, cfgIncludeSummary],
    reportSections: CONTENT_SECTIONS,
    icon: Stethoscope,
    accent: "rose",
  },
  {
    slug: "prescription-checker",
    name: "Prescription Checker",
    tagline: "Check dosage, interactions and duplicates",
    description:
      "Reviews prescriptions for readability, dosage plausibility, duplicate medicines, and potential interactions. For informational purposes only.",
    category: "Health & Medical",
    inputs: ["pdf", "image", "txt"],
    pricing: price("Free", 0, 1),
    config: [cfgSourceLanguage, cfgLanguage, cfgIncludeSummary],
    reportSections: CONTENT_SECTIONS,
    icon: Pill,
    accent: "rose",
  },
  {
    slug: "research-paper-reviewer",
    name: "Research Paper Reviewer",
    tagline: "A critical read of any academic paper",
    description:
      "Reviews research papers for methodology soundness, claims vs. evidence, statistical validity, structure, and clarity, with a peer-review-style report.",
    category: "Research & IP",
    inputs: ["pdf", "docx", "txt", "markdown"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgLanguage, cfgIncludeSummary],
    reportSections: RESEARCH_SECTIONS,
    icon: Microscope,
    accent: "sky",
  },
  {
    slug: "patent-risk-analyzer",
    name: "Patent Risk Analyzer",
    tagline: "Evaluate infringement risk before you launch",
    description:
      "Screens inventions, products, or technology descriptions for potential conflict with published patent claims and outlines risk levels.",
    category: "Research & IP",
    inputs: ["pdf", "docx", "txt", "markdown"],
    pricing: price("Business", 19.99, 5),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: RESEARCH_SECTIONS,
    icon: Lightbulb,
    accent: "sky",
  },
  {
    slug: "trademark-checker",
    name: "Trademark Checker",
    tagline: "Check brand names before you commit",
    description:
      "Checks proposed brand names, logos, and taglines for obvious conflicts with existing marks and suggests safer alternatives.",
    category: "Research & IP",
    inputs: ["text", "image", "pdf"],
    pricing: price("Starter", 4.99, 2),
    config: [cfgLanguage, cfgJurisdiction],
    reportSections: RESEARCH_SECTIONS,
    icon: BadgeCheck,
    accent: "sky",
  },
  {
    slug: "copyright-risk-analyzer",
    name: "Copyright Risk Analyzer",
    tagline: "Check your content before you publish",
    description:
      "Assesses drafts and creative work for the risk of copyright infringement, including copied passages and unlicensed third-party material.",
    category: "Research & IP",
    inputs: ["pdf", "docx", "txt", "markdown", "url"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgLanguage, cfgIncludeSummary],
    reportSections: CONTENT_SECTIONS,
    icon: Copyright,
    accent: "sky",
  },
  {
    slug: "website-privacy-audit",
    name: "Website Privacy Audit",
    tagline: "Audit your website's privacy posture",
    description:
      "Scans a public website for trackers, data collection, cookie banners, and policy disclosures, producing a compliance-oriented privacy audit.",
    category: "Privacy & Compliance",
    inputs: ["url"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: WEBSITE_SECTIONS,
    icon: Globe,
    accent: "sky",
  },
  {
    slug: "cookie-compliance-checker",
    name: "Cookie Compliance Checker",
    tagline: "Check your cookie banner against the rules",
    description:
      "Reviews cookie banners and consent flows for opt-in clarity, category breakdown, rejection ease, and record-keeping compliance.",
    category: "Privacy & Compliance",
    inputs: ["url", "html"],
    pricing: price("Starter", 4.99, 2),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: WEBSITE_SECTIONS,
    icon: Cookie,
    accent: "amber",
  },
  {
    slug: "seo-audit",
    name: "SEO Audit",
    tagline: "Find the gaps holding your site back",
    description:
      "Analyzes a website or page for technical SEO, on-page optimization, metadata, content quality, and core web vitals readiness.",
    category: "Marketing & SEO",
    inputs: ["url", "html", "text"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgLanguage],
    reportSections: WEBSITE_SECTIONS,
    icon: TrendingUp,
    accent: "emerald",
  },
  {
    slug: "accessibility-audit",
    name: "Accessibility Audit",
    tagline: "Make your product usable by everyone",
    description:
      "Reviews websites, documents, and UI descriptions for WCAG-related accessibility issues including contrast, semantics, and keyboard navigation.",
    category: "Privacy & Compliance",
    inputs: ["url", "html", "pdf", "docx"],
    pricing: price("Starter", 4.99, 2),
    config: [cfgReviewDepth, cfgLanguage],
    reportSections: TECHNICAL_SECTIONS,
    icon: Accessibility,
    accent: "teal",
  },
  {
    slug: "cyber-security-checklist",
    name: "Cyber Security Checklist",
    tagline: "A practical security health check",
    description:
      "Walks through a structured security checklist covering accounts, devices, email, passwords, backups, and common attack surfaces.",
    category: "Security",
    inputs: ["url", "text", "html"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgLanguage],
    reportSections: TECHNICAL_SECTIONS,
    icon: Lock,
    accent: "rose",
  },
  {
    slug: "ai-content-detector",
    name: "AI Generated Content Detector",
    tagline: "Assess whether text looks AI-written",
    description:
      "Estimates the likelihood that a piece of text was machine-generated, with per-paragraph evidence and caveats about accuracy.",
    category: "Security",
    inputs: ["text", "markdown", "txt", "pdf"],
    pricing: price("Free", 0, 1),
    config: [cfgLanguage, cfgIncludeSummary],
    reportSections: CONTENT_SECTIONS,
    icon: Bot,
    accent: "violet",
  },
  {
    slug: "scam-detector",
    name: "Scam Detector",
    tagline: "Is that email, message or listing a scam?",
    description:
      "Analyzes emails, messages, listings, and offers for common scam patterns, urgency pressure, impersonation, and payout requests.",
    category: "Security",
    inputs: ["text", "pdf", "image", "url"],
    pricing: price("Free", 0, 1),
    config: [cfgLanguage, cfgIncludeSummary],
    reportSections: CONTENT_SECTIONS,
    icon: AlertTriangle,
    accent: "rose",
  },
  {
    slug: "fraud-risk-analyzer",
    name: "Fraud Risk Analyzer",
    tagline: "Spot red flags in documents and interactions",
    description:
      "Reviews documents, transactions, and communications for indicators of fraud such as inconsistencies, forged details, and unusual patterns.",
    category: "Security",
    inputs: ["pdf", "docx", "txt", "image", "csv"],
    pricing: price("Business", 19.99, 5),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage],
    reportSections: CONTENT_SECTIONS,
    icon: Fingerprint,
    accent: "rose",
  },
  {
    slug: "financial-risk-analyzer",
    name: "Financial Risk Analyzer",
    tagline: "Assess financial exposure in plain terms",
    description:
      "Analyzes financial documents, agreements, and portfolios for concentration, liquidity, leverage, and counterparty risk indicators.",
    category: "Finance",
    inputs: ["pdf", "xlsx", "csv", "txt", "docx"],
    pricing: price("Business", 19.99, 5),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage],
    reportSections: FINANCE_SECTIONS,
    icon: BarChart3,
    accent: "emerald",
  },
  {
    slug: "business-proposal-reviewer",
    name: "Business Proposal Reviewer",
    tagline: "A sharp review before you pitch",
    description:
      "Reviews business proposals and pitch decks for clarity, feasibility, financial realism, gaps, and persuasiveness with structured feedback.",
    category: "Business",
    inputs: ["pdf", "docx", "pptx", "txt", "markdown"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgLanguage, cfgAudience],
    reportSections: CONTENT_SECTIONS,
    icon: FileBarChart,
    accent: "indigo",
  },
  {
    slug: "nda-analyzer",
    name: "NDA Analyzer",
    tagline: "Understand the secrecy terms you are signing",
    description:
      "Reviews non-disclosure agreements for scope of confidential information, exclusions, duration, return obligations, and liability gaps.",
    category: "Legal",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Free", 0, 1),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: FileLock,
    accent: "indigo",
  },
  {
    slug: "vendor-agreement-auditor",
    name: "Vendor Agreement Auditor",
    tagline: "Audit supplier terms before you engage",
    description:
      "Reviews vendor and service agreements for pricing, SLA commitments, termination rights, liability caps, and renewal terms.",
    category: "Business",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Business", 19.99, 5),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: Truck,
    accent: "amber",
  },
  {
    slug: "partnership-agreement-auditor",
    name: "Partnership Agreement Auditor",
    tagline: "Get the partnership terms right from day one",
    description:
      "Reviews partnership and joint-venture agreements for profit sharing, decision rights, exit mechanisms, and dispute resolution terms.",
    category: "Business",
    inputs: ["pdf", "docx", "txt", "image"],
    pricing: price("Pro", 9.99, 3),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: Handshake,
    accent: "indigo",
  },
  {
    slug: "due-diligence-analyzer",
    name: "Due Diligence Analyzer",
    tagline: "Systematic due diligence on any entity",
    description:
      "Runs a structured due-diligence review across provided documents and data, flagging risks and information gaps for further investigation.",
    category: "Business",
    inputs: ["pdf", "docx", "xlsx", "csv", "txt", "url"],
    pricing: price("Enterprise", 49.99, 10),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction, cfgAudience],
    reportSections: TECHNICAL_SECTIONS,
    icon: SearchCheck,
    accent: "violet",
  },
  {
    slug: "compliance-checker",
    name: "Compliance Checker",
    tagline: "Check documents against your obligations",
    description:
      "Reviews documents and policies against a selected regulatory framework and reports gaps, non-conformities, and evidence requirements.",
    category: "Privacy & Compliance",
    inputs: ["pdf", "docx", "txt", "html", "url"],
    pricing: price("Business", 19.99, 5),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: TECHNICAL_SECTIONS,
    icon: CheckSquare,
    accent: "teal",
  },
  {
    slug: "corporate-governance-audit",
    name: "Corporate Governance Audit",
    tagline: "A governance health check for your company",
    description:
      "Reviews corporate documents, board materials, and policies for governance structure, conflicts of interest, and best-practice gaps.",
    category: "Business",
    inputs: ["pdf", "docx", "xlsx", "txt", "image"],
    pricing: price("Enterprise", 49.99, 10),
    config: [cfgReviewDepth, cfgLanguage, cfgJurisdiction],
    reportSections: TECHNICAL_SECTIONS,
    icon: Building2,
    accent: "indigo",
  },
  {
    slug: "document-comparison",
    name: "Document Comparison",
    tagline: "Spot every difference between two documents",
    description:
      "Compares two versions of a document or agreement and highlights additions, removals, and changed terms in a side-by-side diff view.",
    category: "Productivity",
    inputs: ["pdf", "docx", "txt", "markdown", "html"],
    pricing: price("Free", 0, 1),
    config: [cfgLanguage, cfgIncludeSummary],
    reportSections: [
      { title: "Comparison Summary", kind: "overview", description: "Overview of how the two documents differ." },
      { title: "Changes Detected", kind: "findings", description: "List of additions, removals, and modifications." },
      { title: "Side-by-Side Diff", kind: "details", description: "Inline diff view of the two documents." },
      { title: "Recommended Review", kind: "actions", description: "Terms worth re-reviewing before signing." },
    ],
    icon: Files,
    accent: "slate",
  },
  {
    slug: "clause-risk-detection",
    name: "Clause Risk Detection",
    tagline: "High-risk clause radar for any agreement",
    description:
      "Scans any agreement for a library of known high-risk clauses, from hidden fees and auto-renewals to draconian termination terms.",
    category: "Legal",
    inputs: ["pdf", "docx", "txt", "image", "html"],
    pricing: price("Starter", 4.99, 2),
    config: [cfgReviewDepth, cfgSensitivity, cfgLanguage, cfgJurisdiction],
    reportSections: LEGAL_SECTIONS,
    icon: FileWarning,
    accent: "indigo",
  },
  {
    slug: "custom-ai-audit",
    name: "Custom AI Audit",
    tagline: "Your own audit, your own rules",
    description:
      "Configures a bespoke audit on any document or text using your own focus areas, questions, and priorities. Scoring rules come in a later phase.",
    category: "Productivity",
    inputs: ["pdf", "docx", "txt", "markdown", "image", "url", "html"],
    pricing: price("Pro", 9.99, 3),
    config: [
      cfgReviewDepth,
      cfgLanguage,
      {
        key: "focusAreas",
        label: "Focus areas (comma separated)",
        type: "textarea",
        default: "hidden fees, renewal terms, liability, data rights",
        help: "List the specific concerns you want the audit to prioritize.",
        placeholder: "e.g. penalties, termination rights, exclusivity",
      },
    ],
    reportSections: CONTENT_SECTIONS,
    icon: Sparkles,
    accent: "violet",
  },
];

export function getTool(slug: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.slug === slug);
}

export function getToolsByCategory(): Record<ToolCategory, ToolDefinition[]> {
  const grouped = {} as Record<ToolCategory, ToolDefinition[]>;
  for (const category of categoryLabels) {
    grouped[category] = TOOL_REGISTRY.filter((t) => t.category === category);
  }
  return grouped;
}

export const TOOL_COUNT = TOOL_REGISTRY.length;
