export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info";
export type RiskLevel = "Critical" | "High" | "Medium" | "Low" | "None";
export type SafetyDomain =
  | "legal"
  | "medical"
  | "financial"
  | "fraud"
  | "security"
  | "ai-content"
  | "general";

export interface Evidence {
  text: string;
  page?: number;
  section?: string;
  available: boolean;
}

export interface Finding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  explanation: string;
  evidence: Evidence;
  risk: RiskLevel;
  recommendation: string;
  confidence: number;
  rule: string;
}

export interface DocStats {
  characters: number;
  words: number;
  lines: number;
  pages?: number;
  estimatedReadTimeSeconds: number;
  inputType: string;
  usedOcr: boolean;
  ocrRequired: boolean;
  truncated: boolean;
}

export interface MissingInfo {
  item: string;
  explanation: string;
  severity: Severity;
}

export interface Recommendation {
  text: string;
  priority: "Critical" | "High" | "Medium" | "Low" | "Info";
}

export interface ReportConfidence {
  overall: number;
  notes: string[];
}

export interface ReconciliationRow {
  date: string;
  description: string;
  amount: number;
  note: string;
  matchedWith?: string;
  diff?: number;
}

export interface ReconciliationSummary {
  bankStatementName: string;
  booksName: string;
  bankRows: number;
  bookRows: number;
  matched: number;
  amountMismatched: number;
  missingInBooks: number;
  missingInBank: number;
  duplicates: number;
  bankTotal: number;
  booksTotal: number;
  tolerance: number;
  dateWindowDays: number;
  matchRatePercent: number;
  mismatchRows: ReconciliationRow[];
  missingInBooksRows: ReconciliationRow[];
  missingInBankRows: ReconciliationRow[];
  matchedSample: ReconciliationRow[];
}

export interface AuditReport {
  toolSlug: string;
  toolName: string;
  status: "ok" | "error";
  error?: string;
  /** Bank Reconciliation Auditor only: structured match results. */
  reconciliation?: ReconciliationSummary;
  generatedAt: string;
  documentName: string;
  safetyDomain: SafetyDomain;
  phase: "logic-v1";
  summary: string;
  riskScore: number;
  riskLabel: "Low" | "Medium" | "High" | "Critical";
  criticalFindings: Finding[];
  findings: Finding[];
  evidenceList: { excerpt: string; page?: number; section?: string; findingId: string }[];
  recommendations: Recommendation[];
  missingInformation: MissingInfo[];
  documentStats: DocStats;
  confidence: ReportConfidence;
  disclaimer: string;
  detectedDocumentType?: string;
  classificationNote?: string;
  ocrNotice?: string;
  /** Optional notice from the AI semantic layer (provider + count, or skip reason). */
  aiSemanticNotice?: string;
  /** Internal: extracted input text, consumed by the AI semantic layer and
   * stripped before the report is returned/persisted. */
  __extracted?: string;
}

export interface AuditRunPayload {
  toolSlug: string;
  documentName?: string;
  file?: { name: string; kind: string; base64: string };
  /** Bank Reconciliation Auditor: the second upload (books/ledger export). */
  secondFile?: { name: string; kind: string; base64: string };
  url?: string;
  text?: string;
  config?: Record<string, string | number | boolean>;
}

export interface ExtractionResult {
  text: string;
  inputType: string;
  /** Raw fetched HTML for URL inputs — needed by SEO/accessibility/privacy
   * analyzers that inspect tags (<title>, meta, canonical, alt, ld+json) which
   * are destroyed by stripHtml(). Undefined for file/text inputs. */
  rawHtml?: string;
  pages?: number;
  usedOcr: boolean;
  ocrRequired: boolean;
  ocrAttempted: boolean;
  ocrNotice?: string;
  truncated: boolean;
  sourceDescription: string;
}

/* ----------------------------- Labs ----------------------------- */

export type LabStatus =
  | "EXPERIMENTAL"
  | "BETA"
  | "ACTIVE"
  | "DISABLED"
  | "ARCHIVED"
  | "READY"
  | "COMING_SOON";

export interface LabFinding {
  id: string;
  label: string;
  detail: string;
  evidence?: string;
  severity: Severity;
  confidence: number;
  /** Optional: text that can be copied to clipboard (e.g. generated message). */
  copiableText?: string;
}

export interface SimilarDreamInfo {
  /** Whether this is a real database match or an example/sample. */
  isReal: boolean;
  /** Total number of matching dreams. */
  totalCount: number;
  /** Aggregated location breakdown (country-level only). */
  locations: { country: string; count: number }[];
  /** True when matches > 5; individual breakdown is suppressed. */
  aggregateOnly: boolean;
  /** Short description of the example when isReal=false. */
  exampleDescription?: string;
  /** Anonymous/pseudonymous identity attached to this dream (alias + country). */
  identity?: { alias: string; country: string };
}

/** A concrete similar-dream match with its stored anonymous identity. */
export interface SimilarDreamMatchDetail {
  narrativeExcerpt: string;
  alias: string;
  country: string;
  similarity: number;
  createdAt: string;
}

export interface DreamFollowUp {
  question: string;
  /** Existing collected fields that are already filled. */
  collected: Record<string, string>;
  /** Which fields are still missing. */
  missingFields: string[];
}

export interface LabOutput {
  labSlug: string;
  labName: string;
  version: string;
  status: LabStatus;
  isolated: boolean;
  generatedAt: string;
  inputType: string;
  summary: string;
  metrics: Record<string, string | number>;
  findings: LabFinding[];
  notes: string[];
  disclaimer: string;
  /** Dream-specific: similar dreams matching info. */
  similarDreams?: SimilarDreamInfo;
  /** Dream-specific: concrete match details when 1-5 similar dreams exist. */
  similarDreamsMatchDetails?: import("@/lib/engine/types").SimilarDreamMatchDetail[];
  /** Dream-specific: follow-up questions when detail is insufficient. */
  followUp?: DreamFollowUp;
}

export interface LabRunPayload {
  labSlug: string;
  file?: { name: string; kind: string; base64: string };
  url?: string;
  text?: string;
  config?: Record<string, string | number | boolean>;
  /** Authenticated owner id — used for user-owned persistence (dream entries).
   *  Internal: never accepted from client JSON, only set by server routes. */
  userId?: string;
}
