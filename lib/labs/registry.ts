import {
  Archive,
  Bot,
  BrainCircuit,
  FileClock,
  Fingerprint,
  Gauge,
  Globe2,
  Hand,
  History,
  LayoutGrid,
  ListChecks,
  Map,
  MessageCircleWarning,
  MessageSquareQuote,
  Moon,
  Network,
  Quote,
  Rocket,
  ScanSearch,
  Send,
  Shield,
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

export const labCategories: { id: LabCategory; description: string }[] = [
  {
    id: "Experimental AI",
    description:
      "Early experiments in generative and adaptive AI. Expect rough edges and rapidly changing behavior.",
  },
  {
    id: "Document Intelligence",
    description:
      "New ways to understand, structure, and extract meaning from documents.",
  },
  {
    id: "Research",
    description:
      "Tools for verifying, scanning, and reasoning over research material.",
  },
  {
    id: "Security",
    description:
      "Experimental detectors and hardening checks for emerging threats.",
  },
  {
    id: "Compliance",
    description:
      "Next-generation compliance tracking and evidence tooling.",
  },
  {
    id: "Data & Forensics",
    description:
      "Forensic inspection of files, metadata, and document provenance.",
  },
  {
    id: "Future AI",
    description:
      "Speculative capabilities planned for later phases. Not production ready.",
  },
];

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

/* --- Dream-specific config --- */
const cfgDreamRecall: ConfigField = {
  key: "recallLevel",
  label: "Recall detail level",
  type: "select",
  options: [
    { label: "Vague fragments", value: "vague" },
    { label: "Moderate detail", value: "moderate" },
    { label: "Vivid and detailed", value: "vivid" },
  ],
  default: "moderate",
  help: "How well you remember the dream affects the depth of analysis.",
};

const cfgDreamCountry: ConfigField = {
  key: "country",
  label: "Your country (optional)",
  type: "select",
  options: [
    { label: "Prefer not to say", value: "" },
    { label: "India", value: "India" },
    { label: "United States", value: "United States" },
    { label: "Canada", value: "Canada" },
    { label: "United Kingdom", value: "United Kingdom" },
    { label: "Australia", value: "Australia" },
    { label: "Other", value: "Other" },
  ],
  default: "",
  help: "Used only for aggregated Similar Dreams statistics. Never shared as personal data.",
};

/* --- Kalesh-specific config --- */
const cfgKaleshMode: ConfigField = {
  key: "analysisMode",
  label: "Analysis mode",
  type: "select",
  options: [
    { label: "Neutral Ground", value: "neutral" },
    { label: "Gaslight Detector", value: "gaslight" },
    { label: "The Exit Script", value: "exit" },
  ],
  default: "neutral",
  help: "Choose how the conversation should be analyzed.",
};

/* --- Passive Aggressive-specific config --- */
const cfgPAMode: ConfigField = {
  key: "generationMode",
  label: "Tone",
  type: "select",
  options: [
    { label: "Corporate", value: "corporate" },
    { label: "Roast", value: "roast" },
    { label: "Polite", value: "polite" },
  ],
  default: "corporate",
  help: "Choose the tone for your rewritten message.",
};

function lab(
  slug: string,
  name: string,
  description: string,
  category: LabCategory,
  status: LabStatus,
  inputs: InputType[],
  icon: LabDefinition["icon"],
  accent: string,
  config: ConfigField[] = [cfgDepth, cfgOutput],
  extra?: { tables?: string[]; comingSoon?: boolean },
): LabDefinition {
  return { slug, name, description, category, status, inputs, icon, accent, config, ...extra };
}

export const LAB_REGISTRY: LabDefinition[] = [
  /* === NEW: Dream AI Analyzer === */
  lab(
    "dream-ai-analyzer",
    "Dream AI Analyzer",
    "Decode the symbols and emotional logic of your subconscious mind.",
    "Experimental AI",
    "Experimental",
    ["text"],
    Moon,
    "violet",
    [cfgDreamRecall, cfgDreamCountry, cfgLanguage],
    {
      tables: ["labs_dream_entries", "labs_dream_symbols", "labs_dream_analysis"],
    },
  ),

  /* === NEW: Kalesh Analyzer === */
  lab(
    "kalesh-analyzer",
    "Kalesh Analyzer",
    "Upload screenshots of arguments and get a humorous, neutral breakdown of who's right (spoiler: nobody).",
    "Document Intelligence",
    "Ready",
    ["image"],
    MessageCircleWarning,
    "rose",
    [cfgKaleshMode, cfgLanguage],
    {
      tables: ["labs_kalesh_sessions", "labs_kalesh_outputs"],
    },
  ),

  /* === NEW: Social Escape Assistant === */
  lab(
    "social-escape-assistant",
    "Social Escape Assistant",
    "Generate a believable exit script for awkward social situations. Location-aware, context-sensitive, zero guilt.",
    "Experimental AI",
    "Experimental",
    ["text"],
    Hand,
    "amber",
    [cfgLanguage],
    {
      tables: ["labs_social_escape_requests", "labs_social_escape_outputs"],
    },
  ),

  /* === NEW: Passive Aggressive Generator === */
  lab(
    "passive-aggressive-generator",
    "Passive Aggressive Generator",
    'The perfect tool for when "per my last email" just isn\'t enough.',
    "Experimental AI",
    "Ready",
    ["text"],
    Send,
    "indigo",
    [cfgPAMode, cfgLanguage],
    {
      tables: ["labs_passive_aggressive_requests", "labs_passive_aggressive_outputs"],
    },
  ),

  /* Existing labs below */

  /* Experimental AI */
  lab(
    "sentiment-tone-analyzer",
    "Sentiment & Tone Analyzer",
    "Measures emotional tone and persuasion cues across contracts and correspondence.",
    "Experimental AI",
    "Ready",
    ["text", "pdf", "docx"],
    MessageSquareQuote,
    "indigo",
  ),
  lab(
    "contract-style-tuner",
    "Contract Style Tuner",
    "Rewrites clause language toward clearer, more balanced phrasing.",
    "Experimental AI",
    "Experimental",
    ["pdf", "docx", "txt"],
    Workflow,
    "violet",
  ),
  lab(
    "negotiation-coach",
    "Negotiation Coach",
    "Suggests negotiation talking points and fallback positions for a given agreement.",
    "Experimental AI",
    "Experimental",
    ["pdf", "docx", "txt"],
    Quote,
    "rose",
  ),
  lab(
    "risk-explainer",
    "Risk Explainer",
    "Generates plain-language explanations of complex legal and financial passages.",
    "Experimental AI",
    "Ready",
    ["pdf", "docx", "txt", "text"],
    Sparkles,
    "indigo",
  ),

  /* Document Intelligence */
  lab(
    "document-clustering",
    "Document Clustering",
    "Groups a folder of documents by topic and structure to surface duplicates and themes.",
    "Document Intelligence",
    "Ready",
    ["pdf", "docx", "txt", "markdown"],
    LayoutGrid,
    "sky",
  ),
  lab(
    "smart-redaction",
    "Smart Redaction",
    "Detects personal data and suggests redaction masks before documents are shared.",
    "Document Intelligence",
    "Experimental",
    ["pdf", "image", "docx", "txt"],
    ShieldCheck,
    "sky",
    [cfgThreshold, cfgOutput],
  ),
  lab(
    "document-qna",
    "Document Q&A",
    "Answers questions grounded in the content of your uploaded documents.",
    "Document Intelligence",
    "Ready",
    ["pdf", "docx", "txt", "markdown"],
    MessageSquareQuote,
    "sky",
  ),

  /* Research */
  lab(
    "citation-validator",
    "Citation Validator",
    "Cross-checks citations and references against source material where available.",
    "Research",
    "Experimental",
    ["pdf", "txt", "markdown"],
    Quote,
    "teal",
  ),
  lab(
    "literature-scanner",
    "Literature Scanner",
    "Scans a corpus of research material for relevant themes and contradictions.",
    "Research",
    "Experimental",
    ["pdf", "txt", "markdown"],
    ScanSearch,
    "teal",
  ),
  lab(
    "claim-verifier",
    "Claim Verifier",
    "Checks factual claims against supplied reference documents.",
    "Research",
    "Ready",
    ["pdf", "docx", "txt", "markdown"],
    ListChecks,
    "teal",
    [cfgThreshold, cfgLanguage],
  ),

  /* Security */
  lab(
    "prompt-injection-tester",
    "Prompt Injection Tester",
    "Probes documents for prompt-injection and extraction attempts before AI processing.",
    "Security",
    "Experimental",
    ["pdf", "docx", "txt", "text"],
    TestTube2,
    "rose",
    [cfgDepth],
  ),
  lab(
    "pii-detector",
    "PII Detector",
    "Locates personally identifiable information inside documents and files.",
    "Security",
    "Ready",
    ["pdf", "image", "docx", "txt", "csv"],
    Fingerprint,
    "rose",
    [cfgThreshold],
  ),
  lab(
    "link-reputation-scanner",
    "Link Reputation Scanner",
    "Assesses links in a document for suspicious or known-bad destinations.",
    "Security",
    "Experimental",
    ["url", "html", "txt"],
    Globe2,
    "rose",
  ),

  /* Compliance */
  lab(
    "regulation-change-tracker",
    "Regulation Change Tracker",
    "Tracks selected regulations and summarizes changes relevant to your documents.",
    "Compliance",
    "Ready",
    ["text", "pdf"],
    History,
    "amber",
    [cfgThreshold, cfgLanguage],
  ),
  lab(
    "jurisdiction-mapper",
    "Jurisdiction Mapper",
    "Maps which jurisdictions a document appears to be governed by.",
    "Compliance",
    "Experimental",
    ["pdf", "docx", "txt", "html"],
    Map,
    "amber",
  ),
  lab(
    "consent-record-auditor",
    "Consent Record Auditor",
    "Reviews consent and opt-in records for completeness and auditability.",
    "Compliance",
    "Ready",
    ["csv", "xlsx", "json", "txt"],
    FileClock,
    "amber",
    [cfgOutput],
  ),

  /* Data & Forensics */
  lab(
    "metadata-inspector",
    "Metadata Inspector",
    "Surfaces hidden metadata and edit history embedded in documents.",
    "Data & Forensics",
    "Ready",
    ["pdf", "docx", "image"],
    Archive,
    "slate",
    [cfgOutput],
  ),
  lab(
    "document-forensics",
    "Document Forensics",
    "Analyzes documents for tampering signals, unusual fonts, and version traces.",
    "Data & Forensics",
    "Experimental",
    ["pdf", "docx", "image"],
    ScanSearch,
    "slate",
    [cfgDepth],
  ),
  lab(
    "timeline-reconstructor",
    "Timeline Reconstructor",
    "Builds event timelines from a set of documents, emails, or transaction logs.",
    "Data & Forensics",
    "Experimental",
    ["pdf", "csv", "xlsx", "txt"],
    Network,
    "slate",
    [cfgOutput],
  ),

  /* Future AI */
  lab(
    "agentic-negotiation",
    "Agentic Negotiation",
    "Speculative autonomous negotiation agents that act on your behalf.",
    "Future AI",
    "Experimental",
    ["pdf", "docx", "txt"],
    Bot,
    "violet",
  ),
  lab(
    "multimodal-contract-vision",
    "Multimodal Contract Vision",
    "Planned vision models that read scanned contracts and handwriting natively.",
    "Future AI",
    "Experimental",
    ["image", "pdf"],
    Gauge,
    "violet",
  ),
  lab(
    "autonomous-compliance-agent",
    "Autonomous Compliance Agent",
    "Planned always-on agent that monitors obligations and deadlines continuously.",
    "Future AI",
    "Experimental",
    ["url", "pdf", "csv"],
    BrainCircuit,
    "violet",
  ),
];

export function getLab(slug: string): LabDefinition | undefined {
  return LAB_REGISTRY.find((l) => l.slug === slug);
}

export function getLabsByCategory(): Record<LabCategory, LabDefinition[]> {
  const grouped = {} as Record<LabCategory, LabDefinition[]>;
  for (const cat of labCategories) {
    grouped[cat.id] = LAB_REGISTRY.filter((l) => l.category === cat.id);
  }
  return grouped;
}

export const LAB_COUNT = LAB_REGISTRY.length;

export const labCategoryIcon: Record<LabCategory, typeof Rocket> = {
  "Experimental AI": Rocket,
  "Document Intelligence": LayoutGrid,
  Research: Quote,
  Security: Shield,
  Compliance: ListChecks,
  "Data & Forensics": Archive,
  "Future AI": BrainCircuit,
};
