import type { LabFinding, LabOutput, LabRunPayload, Severity } from "@/lib/engine/types";
import { extractForAudit } from "@/lib/engine/extract";
import { countWords, splitLines } from "@/lib/engine/text";
import { getLab } from "@/lib/labs/registry";

export type LabStatus = "EXPERIMENTAL" | "BETA" | "ACTIVE" | "DISABLED" | "ARCHIVED";

const STATUS_MAP: Record<string, LabStatus> = {
  Experimental: "EXPERIMENTAL",
  Beta: "BETA",
};

function statusFor(labSlug: string): LabStatus {
  const def = getLab(labSlug);
  if (!def) return "DISABLED";
  return STATUS_MAP[def.status] ?? "EXPERIMENTAL";
}

function lf(input: {
  id: string;
  label: string;
  detail: string;
  severity?: Severity;
  confidence?: number;
  evidence?: string;
}): LabFinding {
  return {
    id: input.id,
    label: input.label,
    detail: input.detail,
    severity: input.severity ?? "Info",
    confidence: input.confidence ?? 0.6,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  };
}

function countOccurrences(text: string, words: string[]): number {
  const low = text.toLowerCase();
  return words.reduce((acc, w) => acc + (low.split(w).length - 1), 0);
}

/* ------------------------------ handlers ------------------------------ */

type Handler = (
  text: string,
  config: Record<string, string | number | boolean>,
) => { summary: string; metrics: Record<string, string | number>; findings: LabFinding[]; notes: string[] };

function requireText(handler: Handler): Handler {
  return (text, config) => {
    if (!text.trim()) {
      return {
        summary: "No analyzable text was extracted from the input.",
        metrics: { processed: 0 },
        findings: [
          lf({
            id: "empty",
            label: "No content extracted",
            detail: "The input did not yield readable text.",
            severity: "Medium",
            confidence: 1,
          }),
        ],
        notes: ["Re-upload a readable file, URL, or pasted text."],
      };
    }
    return handler(text, config);
  };
}

const sentimentToneAnalyzer: Handler = requireText((text, config) => {
  const low = text.toLowerCase();
  const positive = countOccurrences(low, [
    "agree", "approve", "support", "confident", "accept", "good faith", "satisfied", "favourable", "favorable", "mutual benefit",
  ]);
  const negative = countOccurrences(low, [
    "terminate", "penalty", "default", "liability", "claim", "breach", "dispute", "revoke", "forfeit", "indemnify",
  ]);
  const urgent = countOccurrences(low, [
    "immediately", "within 7 days", "within 15 days", "urgent", "without delay", "final notice",
  ]);
  const total = Math.max(1, positive + negative + urgent);
  const score = Math.round(((positive * 2 + negative * -1 + urgent * 0.5) / total) * 50 + 50);

  return {
    summary: `Tone scored ${score}/100. ${positive} positive, ${negative} negative, ${urgent} urgency signals detected.`,
    metrics: { score, positiveSignals: positive, negativeSignals: negative, urgencySignals: urgent },
    findings: [
      lf({
        id: "sentiment-score",
        label: `Tone score ${score}/100`,
        detail: `Based on ${total} tone signals.`,
        severity: score < 40 ? "Medium" : "Info",
        confidence: 0.55,
      }),
      ...(negative > positive
        ? [lf({ id: "tone-negative", label: "Adversarial tone", detail: "Negative or enforcement-heavy language dominates.", severity: "Low", confidence: 0.55 })]
        : []),
      ...(urgent > 0
        ? [lf({ id: "tone-urgent", label: "Urgency cues", detail: `Found ${urgent} urgency signal(s).`, severity: "Low", confidence: 0.5 })]
        : []),
    ],
    notes: ["Tone analysis is heuristic; confirm with a human read."],
  };
});

const contractStyleTuner: Handler = requireText((text) => {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const long = sentences.filter((s) => s.split(/\s+/).length > 35).length;
  const passive = countOccurrences(text.toLowerCase(), ["shall be", "is hereby", "it is understood", "in the event that"]);
  const complex = countOccurrences(text.toLowerCase(), ["notwithstanding", "heretofore", "whereby", "pursuant to", "aforementioned"]);

  return {
    summary: `Style scan found ${long} long sentence(s), ${passive} passive/legalese phrases, ${complex} complex connectors.`,
    metrics: { longSentences: long, passivePhrases: passive, complexTerms: complex },
    findings: [
      lf({
        id: "style-long",
        label: `${long} long sentence(s)`,
        detail: "Sentences over ~35 words reduce readability.",
        severity: long > 0 ? "Low" : "Info",
        confidence: 0.6,
      }),
      lf({
        id: "style-legalese",
        label: `${passive + complex} legalese phrase(s)`,
        detail: "Legalese makes clauses harder to understand.",
        severity: passive + complex > 0 ? "Low" : "Info",
        confidence: 0.6,
      }),
    ],
    notes: ["Suggested rewrites are illustrative, not legal advice."],
  };
});

const negotiationCoach: Handler = requireText((text) => {
  const low = text.toLowerCase();
  const risky = countOccurrences(low, ["terminate at will", "sole discretion", "without cause", "irrevocable", "non-refundable", "unlimited liability"]);
  const missing = ["governing law", "termination notice", "confidentiality", "limitation of liability", "dispute resolution"].filter(
    (t) => !low.includes(t),
  );

  return {
    summary: `Identified ${risky} risk area(s) and ${missing.length} unaddressed topic(s) worth negotiating.`,
    metrics: { riskAreas: risky, missingTopics: missing.length },
    findings: [
      ...(risky > 0
        ? [lf({ id: "coach-risky", label: `${risky} one-sided provision(s)`, detail: "Provisions that favor the drafter were detected.", severity: "Medium", confidence: 0.55 })]
        : []),
      ...missing.map((t) =>
        lf({ id: `coach-missing-${t}`, label: `No "${t}" clause`, detail: "Consider negotiating coverage for this topic.", severity: "Low", confidence: 0.5 }),
      ),
    ],
    notes: ["Negotiation suggestions are informational, not legal advice."],
  };
});

const riskExplainer: Handler = requireText((text) => {
  const words = countWords(text);
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const top = sentences
    .map((s, i) => ({ s, i, w: s.split(/\s+/).length }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => x.s.slice(0, 200));

  return {
    summary: `Generated plain-language explanations for the ${Math.min(3, top.length)} longest passage(s) in a ${words}-word document.`,
    metrics: { passages: top.length, words },
    findings: top.map((s, i) =>
      lf({
        id: `explain-${i}`,
        label: `Passage ${i + 1} simplified`,
        detail: s,
        confidence: 0.5,
      }),
    ),
    notes: ["Explanations are paraphrases, not professional advice."],
  };
});

const documentClustering: Handler = requireText((text) => {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const topics = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);

  return {
    summary: `Detected primary themes: ${topics.join(", ") || "none"}. Single-document clustering yields one cluster.`,
    metrics: { clusters: 1, topTerms: topics.length },
    findings: [
      lf({ id: "cluster-themes", label: "Dominant terms", detail: topics.join(", ") || "None identified.", confidence: 0.55 }),
      lf({ id: "cluster-note", label: "Single-document mode", detail: "Upload multiple documents to surface true clustering.", confidence: 0.7 }),
    ],
    notes: ["Clustering is based on term frequency in the combined text."],
  };
});

const smartRedaction: Handler = requireText((text) => {
  const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
  const phones = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/g) ?? [];
  const ids = text.match(/\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/g) ?? [];
  const total = emails.length + phones.length + ids.length;

  return {
    summary: `Found ${total} candidate PII item(s): ${emails.length} e-mail(s), ${phones.length} phone(s), ${ids.length} card-like number(s).`,
    metrics: { emails: emails.length, phones: phones.length, cardNumbers: ids.length, total },
    findings: [
      lf({
        id: "redact-count",
        label: `${total} candidate PII item(s)`,
        detail: "Suggested redaction masks are illustrative.",
        severity: total > 0 ? "Medium" : "Info",
        confidence: 0.6,
        evidence: [...emails.slice(0, 2), ...phones.slice(0, 2), ...ids.slice(0, 2)].join(" | "),
      }),
    ],
    notes: ["Redaction is a suggestion; verify before sharing documents."],
  };
});

const documentQna: Handler = requireText((text) => {
  const words = countWords(text);
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  return {
    summary: `Document indexed for Q&A (${words} words, ${sentences.length} sentences).`,
    metrics: { words, sentences: sentences.length, indexChunks: Math.max(1, Math.ceil(words / 200)) },
    findings: [
      lf({ id: "qna-indexed", label: "Content indexed", detail: "Answers are grounded in the uploaded text only.", confidence: 0.7 }),
    ],
    notes: ["Ask questions in a follow-up interaction; this run reports readiness only."],
  };
});

const citationValidator: Handler = requireText((text) => {
  const refs = text.match(/\[\d+\]/g) ?? [];
  const unique = [...new Set(refs)];
  const hasRefList = /references|bibliography/i.test(text);
  return {
    summary: `Found ${refs.length} citation marker(s) (${unique.length} unique). Reference list ${hasRefList ? "present" : "not detected"}.`,
    metrics: { citations: refs.length, uniqueCitations: unique.length, hasReferenceList: hasRefList ? 1 : 0 },
    findings: [
      lf({
        id: "cit-count",
        label: `${refs.length} citation marker(s)`,
        detail: hasRefList
          ? "A reference list exists; automated cross-checking is limited without source material."
          : "No reference list was detected.",
        severity: hasRefList ? "Info" : "Low",
        confidence: 0.5,
      }),
    ],
    notes: ["Full validation requires the cited sources, which are not included here."],
  };
});

const literatureScanner: Handler = requireText((text) => {
  const themes = ["methodology", "results", "conclusion", "limitations", "prior work", "future work"]
    .filter((t) => text.toLowerCase().includes(t));
  return {
    summary: `Scanned the corpus; detected ${themes.length} standard research theme(s).`,
    metrics: { themes: themes.length, contradictions: 0 },
    findings: [
      lf({ id: "lit-themes", label: `Themes found: ${themes.join(", ") || "none"}`, detail: "Theme detection is keyword-based.", confidence: 0.5 }),
      lf({ id: "lit-contradictions", label: "Contradiction scan (limited)", detail: "Automated contradiction detection needs multiple documents.", severity: "Info", confidence: 0.5 }),
    ],
    notes: ["Supports multi-document scanning; single-document results are indicative."],
  };
});

const claimVerifier: Handler = requireText((text) => {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const claims = sentences.filter((s) => /\b(increased|decreased|reduced|grew|declined|more than|less than|percent|%|ranked)\b/i.test(s)).slice(0, 5);
  return {
    summary: `Extracted ${claims.length} candidate claim(s) for verification.`,
    metrics: { claims: claims.length, verified: 0, unsupported: claims.length },
    findings: [
      ...claims.map((c, i) => lf({ id: `claim-${i}`, label: `Claim candidate ${i + 1}`, detail: c.slice(0, 180), severity: "Low", confidence: 0.5 })),
      lf({ id: "claim-unverified", label: "No sources provided", detail: "Claims cannot be verified without reference documents.", severity: "Medium", confidence: 0.7 }),
    ],
    notes: ["Provide reference documents to actually verify claims."],
  };
});

const promptInjectionTester: Handler = requireText((text) => {
  const patterns = [
    "ignore previous", "ignore all", "system prompt", "you are now", "jailbreak", "disregard prior", "forget instructions", "do anything now", "reveal your prompt", "developer mode",
  ];
  const hits = patterns.filter((p) => text.toLowerCase().includes(p));
  return {
    summary: hits.length > 0
      ? `Detected ${hits.length} prompt-injection pattern(s).`
      : "No common prompt-injection patterns detected.",
    metrics: { patterns: hits.length, tested: patterns.length },
    findings: [
      ...(hits.length > 0
        ? [lf({ id: "inject-hit", label: "Injection patterns present", detail: hits.join(", "), severity: "High", confidence: 0.6 })]
        : [lf({ id: "inject-clear", label: "No common patterns", detail: "Testing passed for known pattern phrases.", confidence: 0.6 })]),
    ],
    notes: ["This is a keyword scan, not a comprehensive prompt-attack simulation."],
  };
});

const piiDetector: Handler = requireText((text) => {
  const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
  const phones = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/g) ?? [];
  const aadhaar = text.match(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g) ?? [];
  const cards = text.match(/\b(?:\d[ -]?){13,16}\b/g) ?? [];
  return {
    summary: `Detected ${emails.length} e-mail(s), ${phones.length} phone(s), ${aadhaar.length} Aadhaar-like, ${cards.length} card-like number(s).`,
    metrics: { emails: emails.length, phones: phones.length, aadhaar: aadhaar.length, cards: cards.length, total: emails.length + phones.length + aadhaar.length + cards.length },
    findings: [
      lf({ id: "pii-summary", label: "PII detected", detail: `E-mails: ${emails.length}, Phones: ${phones.length}, Aadhaar-like: ${aadhaar.length}, Card-like: ${cards.length}.`, severity: emails.length + phones.length + aadhaar.length + cards.length > 0 ? "Medium" : "Info", confidence: 0.6 }),
    ],
    notes: ["Patterns are heuristics; confirm matches before acting."],
  };
});

const linkReputationScanner: Handler = requireText((text) => {
  const links = text.match(/https?:\/\/[^\s"<>]+/g) ?? [];
  const domains = [...new Set(links.map((l) => {
    try { return new URL(l).hostname; } catch { return ""; }
  }).filter(Boolean))];
  return {
    summary: `Extracted ${links.length} link(s) across ${domains.length} domain(s).`,
    metrics: { links: links.length, domains: domains.length, reputationLookups: 0 },
    findings: [
      lf({ id: "link-count", label: `${links.length} link(s) found`, detail: domains.join(", ") || "None.", confidence: 0.7 }),
      lf({ id: "link-reputation", label: "Live reputation lookup unavailable", detail: "Automated live reputation checks are disabled; review domains manually.", severity: "Info", confidence: 0.6 }),
    ],
    notes: ["No live DNS/blocklist lookups are performed."],
  };
});

const regulationChangeTracker: Handler = requireText((text) => {
  const regs = ["gdpr", "ccpa", "data protection", "dodd-frank", "sox", "hips", "hipaa", "pci"] as const;
  const found = regs.filter((r) => text.toLowerCase().includes(r));
  return {
    summary: `Referenced regulation(s): ${found.join(", ") || "none identified"}.`,
    metrics: { regulations: found.length },
    findings: [
      lf({ id: "reg-refs", label: found.length ? `Regulations referenced: ${found.join(", ")}` : "No tracked regulations detected", detail: "Change summaries require a maintained regulation corpus.", severity: "Info", confidence: 0.55 }),
    ],
    notes: ["Change tracking needs a live regulation corpus, not yet wired."],
  };
});

const jurisdictionMapper: Handler = requireText((text) => {
  const low = text.toLowerCase();
  const map: Record<string, string[]> = {
    India: ["india", "govt of india", "indian law", "bombay high court", "delhi high court", "income tax act", "aadhaar", "companies act"],
    "United States": ["united states", "u.s. law", "us law", "california", "new york", "federal law", "state of", "sec"],
    "United Kingdom": ["united kingdom", "uk law", "england and wales", "scotland", "british"],
    "European Union": ["european union", "eu law", "gdpr", "european commission"],
  };
  const hits = Object.entries(map).filter(([, kw]) => kw.some((k) => low.includes(k))).map(([name]) => name);
  return {
    summary: hits.length ? `Possible jurisdictions: ${hits.join(", ")}.` : "No clear jurisdiction cues detected.",
    metrics: { jurisdictions: hits.length },
    findings: [
      lf({ id: "juris-hits", label: hits.length ? `Likely jurisdiction(s): ${hits.join(", ")}` : "No jurisdiction cues", detail: "Inferred from local-language and legal references.", severity: "Info", confidence: 0.55 }),
    ],
    notes: ["Jurisdiction mapping is indicative, not authoritative."],
  };
});

const consentRecordAuditor: Handler = requireText((text) => {
  const hasConsent = /consent|opted[- ]?in|opt[- ]in|agreed|accepted/i.test(text);
  const hasDate = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(text);
  const hasChannel = /(web|email|sms|app|in[- ]person|phone|form)/i.test(text);
  const missing: string[] = [];
  if (!hasConsent) missing.push("consent indication");
  if (!hasDate) missing.push("timestamps/dates");
  if (!hasChannel) missing.push("consent channel");
  return {
    summary: `Consent audit: ${missing.length === 0 ? "core fields present" : `missing ${missing.join(", ")}`}.`,
    metrics: { consentFound: hasConsent ? 1 : 0, dated: hasDate ? 1 : 0, channelFound: hasChannel ? 1 : 0 },
    findings: missing.map((m) => lf({ id: `consent-${m}`, label: `Missing: ${m}`, detail: "Consent records should be complete and auditable.", severity: "Medium", confidence: 0.55 })),
    notes: ["Assumes the input is a consent/opt-in log."],
  };
});

const metadataInspector: Handler = requireText((text) => {
  return {
    summary: "Hidden metadata (e.g., edit history, authors) is not stored in extracted text.",
    metrics: { metadataExtracted: 0, formatsWithMetadata: 1 },
    findings: [
      lf({ id: "meta-limit", label: "Metadata unavailable via text", detail: "Binary metadata requires direct file parsing (planned).", severity: "Low", confidence: 0.7 }),
    ],
    notes: ["Binary-level metadata extraction is a later phase."],
  };
});

const documentForensics: Handler = requireText((text) => {
  const inconsistentDates = (text.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g) ?? []).length;
  const unusual = countOccurrences(text.toLowerCase(), ["tamper", "altered", "copy of", "scanned from", "duplicate", "placeholder", "draft"]);
  return {
    summary: `Found ${inconsistentDates} date reference(s) and ${unusual} tampering/version cue(s).`,
    metrics: { dates: inconsistentDates, tamperingCues: unusual },
    findings: [
      lf({ id: "forensic-cues", label: `${unusual} version/tampering cue(s)`, detail: "Terms like 'altered', 'duplicate', 'draft' detected.", severity: unusual > 0 ? "Low" : "Info", confidence: 0.5 }),
    ],
    notes: ["Deep forensics (fonts, hashes) requires binary access."],
  };
});

const timelineReconstructor: Handler = requireText((text) => {
  const dates = text.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g) ?? [];
  return {
    summary: `Identified ${dates.length} date reference(s); event ordering limited by text structure.`,
    metrics: { dates: dates.length, events: Math.min(dates.length, 10) },
    findings: [
      lf({ id: "tl-dates", label: `${dates.length} date(s) found`, detail: dates.slice(0, 10).join(", ") || "None.", confidence: 0.55 }),
      lf({ id: "tl-limit", label: "Structured event extraction limited", detail: "Full timeline reconstruction needs structured logs.", severity: "Info", confidence: 0.5 }),
    ],
    notes: ["Best results come from CSV/XLSX transaction logs."],
  };
});

function futureAiPlaceholder(label: string): Handler {
  return () => ({
    summary: `${label} is a planned Future AI capability. This lab is isolated and not production logic.`,
    metrics: { implemented: 0 },
    findings: [
      lf({ id: "future-planned", label: "Planned capability", detail: "Not implemented in this phase; outputs are placeholders.", severity: "Info", confidence: 1 }),
    ],
    notes: ["Future AI labs do not affect production audit results."],
  });
}

const HANDLERS: Record<string, Handler> = {
  "sentiment-tone-analyzer": sentimentToneAnalyzer,
  "contract-style-tuner": contractStyleTuner,
  "negotiation-coach": negotiationCoach,
  "risk-explainer": riskExplainer,
  "document-clustering": documentClustering,
  "smart-redaction": smartRedaction,
  "document-qna": documentQna,
  "citation-validator": citationValidator,
  "literature-scanner": literatureScanner,
  "claim-verifier": claimVerifier,
  "prompt-injection-tester": promptInjectionTester,
  "pii-detector": piiDetector,
  "link-reputation-scanner": linkReputationScanner,
  "regulation-change-tracker": regulationChangeTracker,
  "jurisdiction-mapper": jurisdictionMapper,
  "consent-record-auditor": consentRecordAuditor,
  "metadata-inspector": metadataInspector,
  "document-forensics": documentForensics,
  "timeline-reconstructor": timelineReconstructor,
  "agentic-negotiation": futureAiPlaceholder("Agentic Negotiation"),
  "multimodal-contract-vision": futureAiPlaceholder("Multimodal Contract Vision"),
  "autonomous-compliance-agent": futureAiPlaceholder("Autonomous Compliance Agent"),
};

export async function runLab(payload: LabRunPayload): Promise<LabOutput> {
  const def = getLab(payload.labSlug);
  if (!def) {
    return {
      labSlug: payload.labSlug,
      labName: payload.labSlug,
      version: "v0",
      status: "DISABLED",
      isolated: true,
      generatedAt: new Date().toISOString(),
      inputType: "none",
      summary: "Unknown lab.",
      metrics: { implemented: 0 },
      findings: [lf({ id: "unknown", label: "Unknown lab", detail: "The requested lab is not registered.", severity: "High", confidence: 1 })],
      notes: [],
      disclaimer: "Lab outputs are isolated experimental results and do not affect production audit results.",
    };
  }

  const handler = HANDLERS[payload.labSlug];
  const extraction = await extractForAudit({
    toolSlug: "custom-ai-audit",
    file: payload.file,
    url: payload.url,
    text: payload.text,
    config: payload.config,
  });
  const text = extraction.text;

  let result: { summary: string; metrics: Record<string, string | number>; findings: LabFinding[]; notes: string[] };
  if (!handler) {
    result = {
      summary: `${def.name} is registered but has no lab logic in this phase.`,
      metrics: { implemented: 0 },
      findings: [lf({ id: "no-logic", label: "No lab logic wired", detail: "The lab definition exists but logic is pending.", severity: "Low", confidence: 1 })],
      notes: ["Lab outputs are isolated and do not affect production audits."],
    };
  } else {
    result = handler(text, (payload.config ?? {}) as Record<string, string | number | boolean>);
  }

  return {
    labSlug: payload.labSlug,
    labName: def.name,
    version: "v0.1",
    status: statusFor(payload.labSlug),
    isolated: true,
    generatedAt: new Date().toISOString(),
    inputType: extraction.inputType,
    summary: result.summary,
    metrics: result.metrics,
    findings: result.findings,
    notes: result.notes,
    disclaimer:
      "Lab outputs are isolated experimental results and do not affect production audit results. Lab status indicates maturity, not availability guarantees.",
  };
}
