import { Hand, MessageCircleWarning, Moon, Send } from "lucide-react";
import type {
  ConfigField,
  InputType,
  LabCategory,
  LabDefinition,
  LabStatus,
} from "@/lib/types";
import { MIGRATED_ENGINE_DEFS } from "@/lib/labs/migratedEngineDefs";

/**
 * Labs catalog — the four true experimental experiences.
 *
 * The former document-intelligence / research / security / compliance /
 * forensics labs have been migrated to the main Audit Tools catalog
 * (lib/tools/legacy.ts) with their engines, slugs and pages unchanged.
 * The three Future AI entries also moved (still gated as Coming Soon).
 */

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

const cfgDreamTraditionalAstrology: ConfigField = {
  key: "includeTraditionalAstrology",
  label: "Include Traditional / Astrological Meaning",
  type: "toggle",
  default: false,
  help: "Adds traditional/cultural symbol meanings (snake, water, moon, etc.) from the same analysis — no extra cost. Not scientific fact; nothing is predicted.",
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

function lab(
  slug: string,
  name: string,
  description: string,
  category: LabCategory,
  status: LabStatus,
  inputs: InputType[],
  icon: LabDefinition["icon"],
  accent: string,
  config: ConfigField[] = [],
  extra?: { tables?: string[]; comingSoon?: boolean },
): LabDefinition {
  return { slug, name, description, category, status, inputs, icon, accent, config, ...extra };
}

export const LAB_REGISTRY: LabDefinition[] = [
  /*
   * ENGINE-ONLY defs: the 19 run-able migrated tools keep resolving through
   * the UNCHANGED lab engine (runLab → getLab). They do NOT appear in the
   * Labs UI (filtered out below) and live in the Audit Tools catalog.
   */
  ...MIGRATED_ENGINE_DEFS,

  lab(
    "dream-ai-analyzer",
    "Dream AI Analyzer",
    "Decode the symbols and emotional logic of your subconscious mind.",
    "Experimental AI",
    "Ready",
    ["text"],
    Moon,
    "violet",
    [cfgDreamRecall, cfgDreamCountry, cfgDreamTraditionalAstrology, cfgLanguage],
    {
      tables: ["dream_entries", "dream_matches"],
    },
  ),

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

/** Slugs that exist only for engine compatibility (rendered as Tools, not Labs). */
export const MIGRATED_ENGINE_SLUGS: ReadonlySet<string> = new Set(MIGRATED_ENGINE_DEFS.map((l) => l.slug));

export const LAB_COUNT = LAB_REGISTRY.filter((l) => !MIGRATED_ENGINE_SLUGS.has(l.slug)).length;

/** True Labs catalog (UI + sitemap + admin) — exactly the 4 experiences. */
export function getVisibleLabs(): LabDefinition[] {
  return LAB_REGISTRY.filter((l) => !MIGRATED_ENGINE_SLUGS.has(l.slug));
}

export const labCategoryIcon: Record<LabCategory, LabDefinition["icon"]> = {
  "Experimental AI": Hand,
  "Document Intelligence": MessageCircleWarning,
  Research: Moon,
  Security: MessageCircleWarning,
  Compliance: Moon,
  "Data & Forensics": Send,
  "Future AI": Moon,
};
