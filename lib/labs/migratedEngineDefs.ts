/**
 * Engine-only lab definitions for the 19 run-able migrated tools.
 *
 * These mirror the original lab registry entries so the UNCHANGED lab engine
 * (runLab → getLab in lib/engine/labLogic.ts) still resolves them. They are
 * NOT part of the Labs UI catalog — the Labs page, sitemap and admin use
 * getVisibleLabs(). Their public home is the Audit Tools catalog
 * (lib/tools/legacy.ts), which renders these same slugs with identical
 * names, descriptions, inputs, icons and accents.
 */

import {
  Archive,
  FileClock,
  Fingerprint,
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
  ConfigField,
  InputType,
  LabCategory,
  LabDefinition,
  LabStatus,
} from "@/lib/types";

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
    { label: "Spanish", value: "es" },
  ],
  default: "en",
};

function def(
  slug: string,
  name: string,
  description: string,
  category: LabCategory,
  status: LabStatus,
  inputs: InputType[],
  icon: LabDefinition["icon"],
  accent: string,
  config: ConfigField[] = [cfgDepth, cfgOutput],
): LabDefinition {
  return { slug, name, description, category, status, inputs, icon, accent, config };
}

export const MIGRATED_ENGINE_DEFS: LabDefinition[] = [
  def("sentiment-tone-analyzer", "Sentiment & Tone Analyzer", "Measures emotional tone and persuasion cues across contracts and correspondence.", "Experimental AI", "Ready", ["text", "pdf", "docx"], MessageSquareQuote, "indigo"),
  def("contract-style-tuner", "Contract Style Tuner", "Rewrites clause language toward clearer, more balanced phrasing.", "Experimental AI", "Experimental", ["pdf", "docx", "txt"], Workflow, "violet"),
  def("negotiation-coach", "Negotiation Coach", "Suggests negotiation talking points and fallback positions for a given agreement.", "Experimental AI", "Experimental", ["pdf", "docx", "txt"], Quote, "rose"),
  def("risk-explainer", "Risk Explainer", "Generates plain-language explanations of complex legal and financial passages.", "Experimental AI", "Ready", ["pdf", "docx", "txt", "text"], Sparkles, "indigo"),
  def("document-clustering", "Document Clustering", "Groups a folder of documents by topic and structure to surface duplicates and themes.", "Document Intelligence", "Ready", ["pdf", "docx", "txt", "markdown"], LayoutGrid, "sky"),
  def("smart-redaction", "Smart Redaction", "Detects personal data and suggests redaction masks before documents are shared.", "Document Intelligence", "Experimental", ["pdf", "image", "docx", "txt"], ShieldCheck, "sky", [cfgThreshold, cfgOutput]),
  def("document-qna", "Document Q&A", "Answers questions grounded in the content of your uploaded documents.", "Document Intelligence", "Ready", ["pdf", "docx", "txt", "markdown"], MessageSquareQuote, "sky"),
  def("citation-validator", "Citation Validator", "Cross-checks citations and references against source material where available.", "Research", "Experimental", ["pdf", "txt", "markdown"], Quote, "teal"),
  def("literature-scanner", "Literature Scanner", "Scans a corpus of research material for relevant themes and contradictions.", "Research", "Experimental", ["pdf", "txt", "markdown"], ScanSearch, "teal"),
  def("claim-verifier", "Claim Verifier", "Checks factual claims against supplied reference documents.", "Research", "Ready", ["pdf", "docx", "txt", "markdown"], ListChecks, "teal", [cfgThreshold, cfgLanguage]),
  def("prompt-injection-tester", "Prompt Injection Tester", "Probes documents for prompt-injection and extraction attempts before AI processing.", "Security", "Experimental", ["pdf", "docx", "txt", "text"], TestTube2, "rose", [cfgDepth]),
  def("pii-detector", "PII Detector", "Locates personally identifiable information inside documents and files.", "Security", "Ready", ["pdf", "image", "docx", "txt", "csv"], Fingerprint, "rose", [cfgThreshold]),
  def("link-reputation-scanner", "Link Reputation Scanner", "Assesses links in a document for suspicious or known-bad destinations.", "Security", "Experimental", ["url", "html", "txt"], Globe2, "rose"),
  def("regulation-change-tracker", "Regulation Change Tracker", "Tracks selected regulations and summarizes changes relevant to your documents.", "Compliance", "Ready", ["text", "pdf"], History, "amber", [cfgThreshold, cfgLanguage]),
  def("jurisdiction-mapper", "Jurisdiction Mapper", "Maps which jurisdictions a document appears to be governed by.", "Compliance", "Experimental", ["pdf", "docx", "txt", "html"], Map, "amber"),
  def("consent-record-auditor", "Consent Record Auditor", "Reviews consent and opt-in records for completeness and auditability.", "Compliance", "Ready", ["csv", "xlsx", "json", "txt"], FileClock, "amber", [cfgOutput]),
  def("metadata-inspector", "Metadata Inspector", "Surfaces hidden metadata and edit history embedded in documents.", "Data & Forensics", "Ready", ["pdf", "docx", "image"], Archive, "slate", [cfgOutput]),
  def("document-forensics", "Document Forensics", "Analyzes documents for tampering signals, unusual fonts, and version traces.", "Data & Forensics", "Experimental", ["pdf", "docx", "image"], ScanSearch, "slate", [cfgDepth]),
  def("timeline-reconstructor", "Timeline Reconstructor", "Builds event timelines from a set of documents, emails, or transaction logs.", "Data & Forensics", "Experimental", ["pdf", "csv", "xlsx", "txt"], Network, "slate", [cfgOutput]),
];
