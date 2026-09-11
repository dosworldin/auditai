import type { LucideIcon } from "lucide-react";

export type ToolCategory =
  | "Legal"
  | "Finance"
  | "Tax"
  | "Privacy & Compliance"
  | "Security"
  | "Employment & Career"
  | "Health & Medical"
  | "Research & IP"
  | "Marketing & SEO"
  | "Business"
  | "Productivity";

export type InputType =
  | "pdf"
  | "docx"
  | "doc"
  | "pptx"
  | "txt"
  | "markdown"
  | "image"
  | "url"
  | "html"
  | "csv"
  | "xlsx"
  | "json"
  | "text";

export type PricingTier =
  | "Free"
  | "Starter"
  | "Pro"
  | "Business"
  | "Enterprise";

export type ConfigFieldType =
  | "toggle"
  | "select"
  | "number"
  | "text"
  | "slider"
  | "textarea";

export interface ConfigOption {
  label: string;
  value: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  options?: ConfigOption[];
  min?: number;
  max?: number;
  step?: number;
  default: string | number | boolean;
  help?: string;
  placeholder?: string;
}

export type ReportSectionKind =
  | "overview"
  | "score"
  | "findings"
  | "clauses"
  | "details"
  | "chart"
  | "actions"
  | "verdict";

export interface ReportSection {
  title: string;
  kind: ReportSectionKind;
  description: string;
}

export interface PricingInfo {
  tier: PricingTier;
  priceUsd: number;
  creditsPerRun: number;
  notes?: string;
}

export interface ToolDefinition {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  inputs: InputType[];
  pricing: PricingInfo;
  config: ConfigField[];
  reportSections: ReportSection[];
  icon: LucideIcon;
  accent: string;
  /** When true the tool requires TWO simultaneous file uploads (e.g. bank reconciliation). */
  dualFile?: boolean;
  /** Labels for the two uploads when dualFile is true. */
  dualFileLabels?: [string, string];
}

export type LabStatus = "Experimental" | "Beta" | "Ready" | "Coming Soon";

export type LabCategory =
  | "Experimental AI"
  | "Document Intelligence"
  | "Research"
  | "Security"
  | "Compliance"
  | "Data & Forensics"
  | "Future AI";

export interface LabDefinition {
  slug: string;
  name: string;
  description: string;
  category: LabCategory;
  status: LabStatus;
  inputs: InputType[];
  config: ConfigField[];
  icon: LucideIcon;
  accent: string;
  /** Optional: reference to database tables this lab uses (documented, not enforced). */
  tables?: string[];
  /** When true, the lab is not yet active and shows a Coming Soon state. */
  comingSoon?: boolean;
}

export type NavSection =
  | "platform"
  | "tools"
  | "labs"
  | "storyverse"
  | "storybook"
  | "account";

export interface NavItem {
  label: string;
  href: string;
  section: NavSection;
}

export type AuditStatus =
  | "Completed"
  | "In Progress"
  | "Failed"
  | "Queued";

export interface AuditRecord {
  id: string;
  toolSlug: string;
  toolName: string;
  document: string;
  status: AuditStatus;
  risk: "Low" | "Medium" | "High" | "None";
  createdAt: string;
  duration: string;
}

export interface StoryWork {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  author: string;
  contributors: number;
  rounds: number;
  status: "In Progress" | "In Review" | "Published" | "Draft";
  coverColor: string;
  chapters: number;
  progress: number;
}

export interface StorySnippet {
  id: string;
  author: string;
  text: string;
  votes: number;
  aiStatus: "Passed" | "Flagged" | "Pending";
}
