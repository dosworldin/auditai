import type { Evidence, Finding, RiskLevel, Severity } from "@/lib/engine/types";
import { findContext, splitSentences } from "@/lib/engine/text";

export interface RuleContext {
  text: string;
  lines: string[];
  sentences: string[];
  pages?: number;
}

export interface KeywordRule {
  kind: "keyword";
  id: string;
  category: string;
  severity: Severity;
  risk: RiskLevel;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  keywords: string[];
  mode?: "any" | "all";
  /** Report one finding per matched keyword (default false). */
  perKeyword?: boolean;
  /** Word boundary matching (default true). */
  wordBoundary?: boolean;
}

export interface AbsenceRule {
  kind: "absence";
  id: string;
  category: string;
  severity: Severity;
  risk: RiskLevel;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  terms: string[];
  /** If any of these appear, the section is considered present. */
  mustAppear?: boolean;
}

export interface RegexRule {
  kind: "regex";
  id: string;
  category: string;
  severity: Severity;
  risk: RiskLevel;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  pattern: RegExp;
  perMatch?: boolean;
  /** Keep only matches whose full text passes this predicate (e.g. length checks). */
  filter?: (match: string) => boolean;
  /** Human label of the item matched, e.g. "e-mail address". */
  itemLabel?: string;
}

export type Rule = KeywordRule | AbsenceRule | RegexRule;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function keywordMatches(
  text: string,
  keyword: string,
  wordBoundary = true,
): boolean {
  if (wordBoundary) {
    const re = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
    return re.test(text);
  }
  return text.toLowerCase().includes(keyword.toLowerCase());
}

export function runRule(rule: Rule, ctx: RuleContext): Finding[] {
  switch (rule.kind) {
    case "keyword":
      return runKeywordRule(rule, ctx);
    case "absence":
      return runAbsenceRule(rule, ctx);
    case "regex":
      return runRegexRule(rule, ctx);
  }
}

function makeEvidence(
  ctx: RuleContext,
  snippet: string,
): Evidence {
  if (!snippet || snippet.trim().length === 0) {
    return { text: "", available: false };
  }
  return { text: snippet, available: true };
}

function runKeywordRule(rule: KeywordRule, ctx: RuleContext): Finding[] {
  const matched = rule.keywords.filter((k) =>
    keywordMatches(ctx.text, k, rule.wordBoundary ?? true),
  );
  if (rule.mode === "all" && matched.length < rule.keywords.length) {
    return [];
  }
  if (matched.length === 0) return [];

  const findingFor = (keyword: string): Finding => ({
    id: rule.id,
    severity: rule.severity,
    category: rule.category,
    title: rule.title,
    explanation: rule.explanation,
    evidence: makeEvidence(ctx, findContext(ctx.text, keyword)),
    risk: rule.risk,
    recommendation: rule.recommendation,
    confidence: rule.confidence,
    rule: rule.id,
  });

  if (rule.perKeyword) {
    return matched.map(findingFor);
  }
  return [findingFor(matched[0])];
}

function runAbsenceRule(rule: AbsenceRule, ctx: RuleContext): Finding[] {
  const present = rule.terms.some((t) => keywordMatches(ctx.text, t, false));
  if (rule.mustAppear !== true && present) return [];
  if (rule.mustAppear === true && !present) return [];
  return [
    {
      id: rule.id,
      severity: rule.severity,
      category: rule.category,
      title: rule.title,
      explanation: rule.explanation,
      evidence: { text: "", available: false },
      risk: rule.risk,
      recommendation: rule.recommendation,
      confidence: rule.confidence,
      rule: rule.id,
    },
  ];
}

function runRegexRule(rule: RegexRule, ctx: RuleContext): Finding[] {
  const matches: string[] = [];
  rule.pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = rule.pattern.exec(ctx.text)) !== null) {
    const match = m[0].trim();
    if (match && !seen.has(match)) {
      seen.add(match);
      if (rule.filter && !rule.filter(match)) continue;
      matches.push(match);
    }
    if (rule.pattern.global === false) break;
    if (rule.pattern.lastIndex === m.index) rule.pattern.lastIndex++;
  }
  if (matches.length === 0) return [];

  const base: Omit<Finding, "evidence"> = {
    id: rule.id,
    severity: rule.severity,
    category: rule.category,
    title: rule.title,
    explanation: rule.explanation,
    risk: rule.risk,
    recommendation: rule.recommendation,
    confidence: rule.confidence,
    rule: rule.id,
  };

  if (rule.perMatch) {
    return matches.map((match) => ({
      ...base,
      evidence: makeEvidence(ctx, findContext(ctx.text, match)),
    }));
  }
  const item = rule.itemLabel ?? "items";
  return [
    {
      ...base,
      title: rule.title.replace("{count}", String(matches.length)).replace("{item}", item),
      explanation: rule.explanation
        .replace("{count}", String(matches.length))
        .replace("{item}", item),
      evidence: makeEvidence(ctx, matches.slice(0, 2).join(" | ")),
    },
  ];
}

/** Build a finding directly (used by custom analyzers). */
export function makeFinding(input: {
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
  const evidence: Evidence = input.evidenceText
    ? { text: input.evidenceText, available: true }
    : { text: "", available: false };
  return {
    id: input.id,
    category: input.category,
    severity: input.severity,
    risk: input.risk,
    title: input.title,
    explanation: input.explanation,
    recommendation: input.recommendation,
    confidence: input.confidence,
    evidence,
    rule: input.rule,
  };
}

export function contextFrom(text: string): RuleContext {
  return {
    text,
    lines: text.split(/\r?\n/).filter((l) => l.trim().length > 0),
    sentences: splitSentences(text),
    pages: undefined,
  };
}

/** Build a section-relevant keyword rule for "missing clause" checks. */
export function missingClauseRule(input: {
  id: string;
  category: string;
  severity: Severity;
  risk: RiskLevel;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  terms: string[];
}): AbsenceRule {
  return { kind: "absence", ...input };
}
