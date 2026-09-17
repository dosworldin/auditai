/**
 * Migrated former Labs — now first-class Audit Tools.
 *
 * These 22 entries were originally registered under /labs. They keep their
 * original slugs, names, descriptions, input types, icons, accents and logic
 * (the engines in lib/engine/labLogic.ts are untouched and are wired into the
 * audit pipeline in lib/engine/pipeline.ts). Only their catalog home changed:
 * they now appear in the main Audit Tools listing and run through
 * /api/audit/run like every other tool.
 *
 * The three "Future AI" entries keep their Coming Soon status and stay gated
 * (no runs, no credit charge).
 */

import {
  Archive,
  Bot,
  BrainCircuit,
  FileClock,
  Fingerprint,
  Gauge,
  Globe2,
  History,
  LayoutGrid,
  ListChecks,
  Map,
  MessageSquareQuote,
  Network,
  Quote,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Workflow,
} from "lucide-react";
import type {
  CatalogStatus,
  ConfigField,
  InputType,
  PricingInfo,
  ReportSection,
  ToolCategory,
  ToolDefinition,
} from "@/lib/types";

/* Pricing defaults for migrated tools — admin pricing overrides win at runtime. */
function price(credits: number): PricingInfo {
  return {
    tier: credits === 0 ? "Free" : credits === 1 ? "Starter" : "Pro",
    priceUsd: 0,
    creditsPerRun: credits,
    notes: "Credits are charged per run. Platform admins can adjust tool pricing at any time.",
  };
}

const cfgDepth: ConfigField = {
  key: "depth",
  label: "Analysis depth",
  type: "select",
  options: [
    { label: "Shallow", value: "shallow" },
    { label: "Medium", value: "medium" },
    { label: "Deep", value: "deep" },
  ],
  default: "medium",
};

const cfgOutput: ConfigField = {
  key: "outputFormat",
  label: "Output format",
  type: "select",
  options: [
    { label: "Report", value: "report" },
    { label: "JSON", value: "json" },
    { label: "Spreadsheet", value: "csv" },
  ],
  default: "report",
};

const cfgThreshold: ConfigField = {
  key: "threshold",
  label: "Alert threshold",
  type: "slider",
  min: 0,
  max: 100,
  step: 5,
  default: 70,
};

const cfgLanguage: ConfigField = {
  key: "language",
  label: "Output language",
  type: "select",
  options: [
    { label: "English", value: "en" },
    { label: "Hindi", value: "hi" },
    { label: "Hinglish", value: "hinglish" },
    { label: "Spanish", value: "es" },
    { label: "Portuguese", value: "pt" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Arabic", value: "ar" },
    { label: "Russian", value: "ru" },
    { label: "Chinese", value: "zh" },
    { label: "Japanese", value: "ja" },
    { label: "Korean", value: "ko" },
    { label: "Indonesian", value: "id" },
    { label: "Bengali", value: "bn" },
    { label: "Urdu", value: "ur" },
    { label: "Tamil", value: "ta" },
    { label: "Marathi", value: "mr" },
  ],
  default: "en",
};

const cfgQuestion: ConfigField = {
  key: "question",
  label: "Your question",
  type: "textarea",
  default: "",
  help: "The document is indexed and analyzed against this question.",
  placeholder: "e.g. What are the termination rights in this agreement?",
};

const REGULAR_SECTIONS: ReportSection[] = [
  { title: "Executive Summary", kind: "overview", description: "Plain-language summary of the analysis and overall posture." },
  { title: "Score", kind: "score", description: "Aggregate 0-100 risk or confidence score with a severity breakdown." },
  { title: "Key Findings", kind: "findings", description: "Prioritized list of concerning and favorable items found." },
  { title: "Recommended Actions", kind: "actions", description: "Concrete, actionable next steps." },
  { title: "Final Verdict", kind: "verdict", description: "Overall recommendation or verdict." },
];

const COMING_SECTIONS: ReportSection[] = [
  { title: "Coming Soon", kind: "overview", description: "This capability is planned for a later phase and cannot be run yet." },
];

function migrated(
  slug: string,
  name: string,
  tagline: string,
  description: string,
  category: ToolCategory,
  inputs: InputType[],
  status: CatalogStatus,
  icon: ToolDefinition["icon"],
  accent: string,
  credits: number,
  extra?: Partial<Pick<ToolDefinition, "config" | "reportSections" | "comingSoon">>,
): ToolDefinition {
  return {
    slug,
    name,
    tagline,
    description,
    category,
    inputs,
    pricing: price(credits),
    config: extra?.config ?? [cfgDepth, cfgOutput],
    reportSections: extra?.reportSections ?? REGULAR_SECTIONS,
    icon,
    accent,
    status,
    ...(extra?.comingSoon ? { comingSoon: true } : {}),
  };
}

export const MIGRATED_TOOLS: ToolDefinition[] = [
  /* Experimental AI */
  migrated(
    "sentiment-tone-analyzer",
    "Sentiment & Tone Analyzer",
    "Measure the emotional tone of any document",
    "Measures emotional tone and persuasion cues across contracts and correspondence.",
    "Productivity",
    ["text", "pdf", "docx"],
    "Ready",
    MessageSquareQuote,
    "indigo",
    1,
  ),
  migrated(
    "contract-style-tuner",
    "Contract Style Tuner",
    "Rewrite clauses toward clearer, balanced phrasing",
    "Rewrites clause language toward clearer, more balanced phrasing.",
    "Legal",
    ["pdf", "docx", "txt"],
    "Experimental",
    Workflow,
    "violet",
    1,
  ),
  migrated(
    "negotiation-coach",
    "Negotiation Coach",
    "Talking points and fallback positions for your agreement",
    "Suggests negotiation talking points and fallback positions for a given agreement.",
    "Legal",
    ["pdf", "docx", "txt"],
    "Experimental",
    Quote,
    "rose",
    1,
  ),
  migrated(
    "risk-explainer",
    "Risk Explainer",
    "Plain-language explanations of complex passages",
    "Generates plain-language explanations of complex legal and financial passages.",
    "Productivity",
    ["pdf", "docx", "txt", "text"],
    "Ready",
    Sparkles,
    "indigo",
    1,
  ),

  /* Document Intelligence */
  migrated(
    "document-clustering",
    "Document Clustering",
    "Group documents by topic and structure",
    "Groups a folder of documents by topic and structure to surface duplicates and themes.",
    "Productivity",
    ["pdf", "docx", "txt", "markdown"],
    "Ready",
    LayoutGrid,
    "sky",
    1,
  ),
  migrated(
    "smart-redaction",
    "Smart Redaction",
    "Find and mask personal data before sharing",
    "Detects personal data and suggests redaction masks before documents are shared.",
    "Privacy & Compliance",
    ["pdf", "image", "docx", "txt"],
    "Experimental",
    ShieldCheck,
    "sky",
    1,
    { config: [cfgThreshold, cfgOutput] },
  ),
  migrated(
    "document-qna",
    "Document Q&A",
    "Ask questions, get answers grounded in your document",
    "Answers questions grounded in the content of your uploaded documents.",
    "Productivity",
    ["pdf", "docx", "txt", "markdown"],
    "Ready",
    MessageSquareQuote,
    "sky",
    1,
    { config: [cfgQuestion, cfgDepth] },
  ),

  /* Research */
  migrated(
    "citation-validator",
    "Citation Validator",
    "Cross-check citations against source material",
    "Cross-checks citations and references against source material where available.",
    "Research & IP",
    ["pdf", "txt", "markdown"],
    "Experimental",
    Quote,
    "teal",
    1,
  ),
  migrated(
    "literature-scanner",
    "Literature Scanner",
    "Scan a corpus for themes and contradictions",
    "Scans a corpus of research material for relevant themes and contradictions.",
    "Research & IP",
    ["pdf", "txt", "markdown"],
    "Experimental",
    ScanSearch,
    "teal",
    1,
  ),
  migrated(
    "claim-verifier",
    "Claim Verifier",
    "Check factual claims against references",
    "Checks factual claims against supplied reference documents.",
    "Research & IP",
    ["pdf", "docx", "txt", "markdown"],
    "Ready",
    ListChecks,
    "teal",
    1,
    { config: [cfgThreshold, cfgLanguage] },
  ),

  /* Security */
  migrated(
    "prompt-injection-tester",
    "Prompt Injection Tester",
    "Probe documents for injection attempts",
    "Probes documents for prompt-injection and extraction attempts before AI processing.",
    "Security",
    ["pdf", "docx", "txt", "text"],
    "Experimental",
    TestTube2,
    "rose",
    1,
    { config: [cfgDepth] },
  ),
  migrated(
    "pii-detector",
    "PII Detector",
    "Locate personally identifiable information",
    "Locates personally identifiable information inside documents and files.",
    "Privacy & Compliance",
    ["pdf", "image", "docx", "txt", "csv"],
    "Ready",
    Fingerprint,
    "rose",
    1,
    { config: [cfgThreshold] },
  ),
  migrated(
    "link-reputation-scanner",
    "Link Reputation Scanner",
    "Assess links for suspicious destinations",
    "Assesses links in a document for suspicious or known-bad destinations.",
    "Security",
    ["url", "html", "txt"],
    "Experimental",
    Globe2,
    "rose",
    1,
  ),

  /* Compliance */
  migrated(
    "regulation-change-tracker",
    "Regulation Change Tracker",
    "Summarize regulatory changes relevant to you",
    "Tracks selected regulations and summarizes changes relevant to your documents.",
    "Privacy & Compliance",
    ["text", "pdf"],
    "Ready",
    History,
    "amber",
    1,
    { config: [cfgThreshold, cfgLanguage] },
  ),
  migrated(
    "jurisdiction-mapper",
    "Jurisdiction Mapper",
    "Map which laws govern a document",
    "Maps which jurisdictions a document appears to be governed by.",
    "Legal",
    ["pdf", "docx", "txt", "html"],
    "Experimental",
    Map,
    "amber",
    1,
  ),
  migrated(
    "consent-record-auditor",
    "Consent Record Auditor",
    "Audit consent records for completeness",
    "Reviews consent and opt-in records for completeness and auditability.",
    "Privacy & Compliance",
    ["csv", "xlsx", "json", "txt"],
    "Ready",
    FileClock,
    "amber",
    1,
    { config: [cfgOutput] },
  ),

  /* Data & Forensics */
  migrated(
    "metadata-inspector",
    "Metadata Inspector",
    "Surface hidden metadata and edit history",
    "Surfaces hidden metadata and edit history embedded in documents.",
    "Productivity",
    ["pdf", "docx", "image"],
    "Ready",
    Archive,
    "slate",
    1,
    { config: [cfgOutput] },
  ),
  migrated(
    "document-forensics",
    "Document Forensics",
    "Detect tampering signals and version traces",
    "Analyzes documents for tampering signals, unusual fonts, and version traces.",
    "Security",
    ["pdf", "docx", "image"],
    "Experimental",
    ScanSearch,
    "slate",
    1,
    { config: [cfgDepth] },
  ),
  migrated(
    "timeline-reconstructor",
    "Timeline Reconstructor",
    "Build event timelines from documents",
    "Builds event timelines from a set of documents, emails, or transaction logs.",
    "Productivity",
    ["pdf", "csv", "xlsx", "txt"],
    "Experimental",
    Network,
    "slate",
    1,
    { config: [cfgOutput] },
  ),

  /* Future AI — stay gated */
  migrated(
    "agentic-negotiation",
    "Agentic Negotiation",
    "Autonomous negotiation agents (coming soon)",
    "Speculative autonomous negotiation agents that act on your behalf.",
    "Business",
    ["pdf", "docx", "txt"],
    "Coming Soon",
    Bot,
    "violet",
    1,
    { reportSections: COMING_SECTIONS, comingSoon: true },
  ),
  migrated(
    "multimodal-contract-vision",
    "Multimodal Contract Vision",
    "Vision models for scanned contracts (coming soon)",
    "Planned vision models that read scanned contracts and handwriting natively.",
    "Legal",
    ["image", "pdf"],
    "Coming Soon",
    Gauge,
    "violet",
    1,
    { reportSections: COMING_SECTIONS, comingSoon: true },
  ),
  migrated(
    "autonomous-compliance-agent",
    "Autonomous Compliance Agent",
    "Always-on obligation monitoring (coming soon)",
    "Planned always-on agent that monitors obligations and deadlines continuously.",
    "Privacy & Compliance",
    ["url", "pdf", "csv"],
    "Coming Soon",
    BrainCircuit,
    "violet",
    1,
    { reportSections: COMING_SECTIONS, comingSoon: true },
  ),
];
