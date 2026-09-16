/**
 * Supabase-backed dream database for Dream AI Analyzer (production).
 *
 * Behavior contract:
 *  - Every COMPLETED analysis is persisted to public.dream_entries with the
 *    submitting user's id (RLS keeps private data private) plus a detached,
 *    anonymous/pseudonymous match identity (random alias + country) stored
 *    on the row for the public matching view.
 *  - Retrying the same request never duplicates rows: near-duplicate
 *    narratives are detected by token overlap AND stored content hash.
 *  - The same submitted dream always resolves to the SAME alias+country —
 *    the identity is generated once and persisted, never re-rolled.
 *  - Matching combines keyword/label bonus + token-bag Jaccard similarity
 *    (lightweight, no vector infra), with an AI semantic pass handled by the
 *    caller (lib/ai/dreamAI.ts) for meaning-level context.
 *  - 1–5 matches: individual match details. >5: aggregate count only.
 */

import { getSupabaseAdmin } from "@/lib/db/supabase-server";
import type { SimilarDreamInfo } from "@/lib/engine/types";

/* ------------------------------------------------------------------ */
/*  Normalized dream representation                                    */
/* ------------------------------------------------------------------ */

export interface NormalizedDream {
  id: string;
  narrative: string;
  symbols: string[];
  emotions: string[];
  themes: string[];
  objects: string[];
  entities: string[];
  locations: string[];
  actions: string[];
  ending: string;
  country?: string;
  tokenBag: string[];
  createdAt: string;
}

/** Detached, non-identifying representation persisted per dream entry. */
export interface DreamMatchIdentity {
  alias: string;
  country: string;
  createdAt: string;
}

/** A concrete similar-dream match with its stored anonymous identity. */
export interface DreamMatchDetail {
  narrativeExcerpt: string;
  alias: string;
  country: string;
  similarity: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Keyword banks                                                      */
/* ------------------------------------------------------------------ */

const SYMBOL_KEYWORDS: Record<string, string[]> = {
  flying: ["fly", "flying", "soaring", "airborne", "levitat", "float", "wings"],
  water: ["water", "ocean", "sea", "river", "lake", "wave", "flood", "drowning", "swim"],
  teeth: ["teeth", "tooth", "falling out", "crumbling", "loose tooth"],
  chase: ["chase", "chased", "pursuit", "running from", "fleeing", "being followed"],
  death: ["death", "dying", "dead", "funeral", "grave", "cemetery", "passed away"],
  house: ["house", "building", "room", "door", "window", "corridor", "hallway", "home"],
  animals: ["animal", "dog", "cat", "snake", "spider", "bird", "wolf", "lion", "bear", "horse"],
  falling: ["falling", "fall", "dropping", "plummet", "cliff", "edge"],
  naked: ["naked", "undressed", "exposed", "embarrass", "clothes missing", "no clothes"],
  exams: ["exam", "test", "school", "classroom", "unprepared", "late for", "forgot"],
  money: ["money", "cash", "wallet", "find", "winning", "losing money", "rich", "broke"],
  baby: ["baby", "pregnant", "birth", "child", "infant", "newborn", "pregnancy"],
  journey: ["journey", "travel", "road", "train", "flight", "airport", "map", "lost"],
  mirror: ["mirror", "reflection", "looking at myself", "mirror image"],
  fire: ["fire", "burning", "flame", "fireball", "blaze", "inferno"],
};

const EMOTION_KEYWORDS: Record<string, string[]> = {
  fear: ["afraid", "scared", "terrified", "anxious", "panic", "dread", "nightmare", "horror"],
  joy: ["happy", "joy", "delighted", "excited", "wonderful", "beautiful", "blissful", "love"],
  sadness: ["sad", "cry", "crying", "tears", "miserable", "grief", "mourning", "lonely"],
  anger: ["angry", "furious", "rage", "mad", "frustrated", "irritated", "enraged"],
  confusion: ["confused", "lost", "uncertain", "bizarre", "strange", "weird", "disoriented", "surreal"],
  surprise: ["surprised", "shocked", "unexpected", "sudden", "amazed", "astonished"],
  guilt: ["guilty", "guilt", "regret", "ashamed", "blame", "conscience", "wrong"],
  empowerment: ["powerful", "confident", "strong", "capable", "in control", "free", "liberated"],
};

const THEME_KEYWORDS: Record<string, string[]> = {
  transformation: ["transform", "change", "metamorphosis", "becoming", "morph", "shapeshift"],
  loss: ["lost", "abandoned", "alone", "left behind", "missing", "gone", "separated"],
  pursuit: ["running", "hiding", "escape", "pursued", "chase", "fleeing"],
  discovery: ["discover", "find", "reveal", "secret", "hidden", "found", "uncovered"],
  transition: ["door", "threshold", "crossing", "bridge", "path", "journey", "enter", "exit"],
  communication: ["talking", "saying", "telling", "speaking", "voice", "listen", "call"],
};

const ENTITY_KEYWORDS = [
  "man", "woman", "boy", "girl", "child", "person", "people", "friend",
  "family", "mother", "mom", "father", "dad", "sister", "brother",
  "grandmother", "grandfather", "teacher", "stranger", "monster", "angel",
  "demon", "ghost", "spirit", "god", "devil", "alien",
];

const ACTION_KEYWORDS = [
  "running", "jumping", "swimming", "climbing", "fighting", "hiding",
  "searching", "building", "destroying", "eating", "driving", "flying",
  "falling", "waking", "sleeping", "screaming", "calling", "writing",
  "reading", "opening", "closing", "breaking", "giving", "taking",
];

const LOCATION_KEYWORDS = [
  "city", "forest", "beach", "mountain", "school", "home", "office",
  "hospital", "church", "temple", "cave", "desert", "island", "sky",
  "underwater", "space", "road", "park", "garden", "room", "kitchen",
  "bathroom", "basement", "attic", "roof", "staircase", "field",
];

/* ------------------------------------------------------------------ */
/*  Normalization                                                      */
/* ------------------------------------------------------------------ */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function extractKeywords(text: string, keywordMap: Record<string, string[]>): string[] {
  const low = text.toLowerCase();
  const found: string[] = [];
  for (const [label, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((k) => low.includes(k))) {
      found.push(label);
    }
  }
  return found;
}

function extractKeywordList(text: string, keywords: string[]): string[] {
  const low = text.toLowerCase();
  return keywords.filter((k) => low.includes(k));
}

export function normalizeDream(narrative: string, country?: string): NormalizedDream {
  const symbols = extractKeywords(narrative, SYMBOL_KEYWORDS);
  const emotions = extractKeywords(narrative, EMOTION_KEYWORDS);
  const themes = extractKeywords(narrative, THEME_KEYWORDS);
  const entities = extractKeywordList(narrative, ENTITY_KEYWORDS);
  const actions = extractKeywordList(narrative, ACTION_KEYWORDS);
  const locations = extractKeywordList(narrative, LOCATION_KEYWORDS);
  const objects = [...new Set([...symbols, ...entities])];

  const sentences = narrative
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  const ending = sentences.slice(-2).join(" ");

  const narrativeTokens = tokenize(narrative);
  const labelTokens = [
    ...symbols, ...emotions, ...themes, ...entities, ...actions, ...locations,
  ].map((l) => l.toLowerCase());
  const tokenBag = [...new Set([...narrativeTokens, ...labelTokens])];

  return {
    id: "", // Will be set by DB
    narrative,
    symbols,
    emotions,
    themes,
    objects: [...new Set(objects)],
    entities: [...new Set(entities)],
    locations: [...new Set(locations)],
    actions: [...new Set(actions)],
    ending,
    country,
    tokenBag,
    createdAt: new Date().toISOString(),
  };
}

/** Stable content hash (FNV-1a) for exact/near-duplicate persistence guard. */
export function dreamContentHash(narrative: string): string {
  const normalized = narrative.toLowerCase().replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ------------------------------------------------------------------ */
/*  Anonymous match identity                                           */
/* ------------------------------------------------------------------ */

const ALIAS_ADJECTIVES = [
  "Quiet", "Restless", "Curious", "Midnight", "Silver", "Wandering",
  "Gentle", "Hidden", "Lucid", "Distant", "Amber", "Velvet", "Northern",
  "Sleeping", "Dreaming", "Silent", "Golden", "Shadow", "Cosmic", "Fading",
];

const ALIAS_NOUNS = [
  "Traveler", "Dreamer", "Wanderer", "Sleeper", "Voyager", "Drifter",
  "Seeker", "Observer", "Nomad", "Pilgrim", "Sailor", "Rider",
];

const ALIAS_COUNTRIES = [
  "India", "United States", "United Kingdom", "Canada", "Australia",
  "Germany", "Brazil", "Japan", "France", "Netherlands", "Mexico",
  "Spain", "Italy", "South Africa", "Nigeria", "Philippines",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAlias(): string {
  return `${pickRandom(ALIAS_ADJECTIVES)} ${pickRandom(ALIAS_NOUNS)} #${Math.floor(Math.random() * 9000) + 1000}`;
}

/**
 * Deterministic identity for a content hash: derives a stable
 * alias/country pair from the hash digits, then varies it with a hash-seeded
 * random tail so distinct dreams get distinct identities while the SAME
 * dream hash always maps to the SAME identity (consistency requirement).
 */
function identityForHash(hash: string): DreamMatchIdentity {
  const digits = hash.replace(/\D/g, "").padEnd(8, "7");
  const seed = parseInt(digits.slice(-6), 10) || 123456;
  const adj = ALIAS_ADJECTIVES[seed % ALIAS_ADJECTIVES.length];
  const noun = ALIAS_NOUNS[Math.floor(seed / 7) % ALIAS_NOUNS.length];
  const num = 1000 + (seed % 9000);
  const country = ALIAS_COUNTRIES[seed % ALIAS_COUNTRIES.length];
  const createdAt = new Date(2020, 0, 1 + (seed % 366)).toISOString();
  return {
    alias: `${adj} ${noun} #${num}`,
    country,
    createdAt,
  };
}

/** Random identity used only when no prior identity exists for the hash. */
export function newDreamMatchIdentity(hash: string): DreamMatchIdentity {
  return {
    alias: randomAlias(),
    country: pickRandom(ALIAS_COUNTRIES),
    createdAt: new Date().toISOString(),
  };
}

export { identityForHash };

/* ------------------------------------------------------------------ */
/*  Similarity scoring                                                 */
/* ------------------------------------------------------------------ */

function similarityScore(a: NormalizedDream, b: NormalizedDream): number {
  const setA = new Set(a.tokenBag);
  const setB = new Set(b.tokenBag);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const sharedSymbols = a.symbols.filter((s) => b.symbols.includes(s)).length;
  const sharedEmotions = a.emotions.filter((e) => b.emotions.includes(e)).length;
  const sharedThemes = a.themes.filter((t) => b.themes.includes(t)).length;
  const labelBonus = sharedSymbols * 0.08 + sharedEmotions * 0.05 + sharedThemes * 0.05;

  return Math.min(1, jaccard + labelBonus);
}

const SIMILARITY_THRESHOLD = 0.32;
/** Jaccard overlap above which two narratives are considered the same dream. */
const DUPLICATE_THRESHOLD = 0.75;

/* ------------------------------------------------------------------ */
/*  DB row shape                                                       */
/* ------------------------------------------------------------------ */

interface DreamRow {
  id: string;
  narrative: string;
  symbols: string[] | null;
  emotions: string[] | null;
  themes: string[] | null;
  objects: string[] | null;
  entities: string[] | null;
  locations: string[] | null;
  actions: string[] | null;
  ending: string | null;
  country: string | null;
  normalized_vector: Record<string, unknown> | null;
  match_alias: string | null;
  match_country: string | null;
  match_identity_generated_at: string | null;
  created_at: string;
}

function rowToNormalized(row: DreamRow): NormalizedDream {
  return {
    id: row.id,
    narrative: row.narrative,
    symbols: row.symbols ?? [],
    emotions: row.emotions ?? [],
    themes: row.themes ?? [],
    objects: row.objects ?? [],
    entities: row.entities ?? [],
    locations: row.locations ?? [],
    actions: row.actions ?? [],
    ending: row.ending ?? "",
    country: row.country ?? undefined,
    tokenBag:
      ((row.normalized_vector as Record<string, unknown> | null)?.tokenBag as string[]) ?? [],
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/*  DB operations                                                      */
/* ------------------------------------------------------------------ */

async function getExistingDreams(limit = 500): Promise<DreamRow[]> {
  try {
    const supabase = await getSupabaseAdmin();
    const { data } = await supabase
      .from("dream_entries")
      .select(
        "id, narrative, symbols, emotions, themes, objects, entities, locations, actions, ending, country, normalized_vector, match_alias, match_country, match_identity_generated_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data as DreamRow[] | null) ?? [];
  } catch {
    return [];
  }
}

async function findExistingDream(
  narrative: string,
  tokenBag: string[],
): Promise<DreamRow | null> {
  try {
    const supabase = await getSupabaseAdmin();
    const hash = dreamContentHash(narrative);

    // 1. Exact/near-exact same normalized text (covers retries).
    const { data: byHash } = await supabase
      .from("dream_entries")
      .select(
        "id, narrative, symbols, emotions, themes, objects, entities, locations, actions, ending, country, normalized_vector, match_alias, match_country, match_identity_generated_at, created_at",
      )
      .eq("normalized_vector->>contentHash", hash)
      .limit(1);

    if (byHash && byHash.length > 0) return byHash[0] as DreamRow;

    // 2. Token-bag duplicate guard (reordered/edited resubmissions).
    const bagSet = new Set(tokenBag);
    const { data: rows } = await supabase
      .from("dream_entries")
      .select(
        "id, narrative, symbols, emotions, themes, objects, entities, locations, actions, ending, country, normalized_vector, match_alias, match_country, match_identity_generated_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    for (const row of (rows as DreamRow[] | null) ?? []) {
      const otherBag = new Set(
        ((row.normalized_vector as Record<string, unknown> | null)?.tokenBag as string[]) ?? [],
      );
      const inter = [...bagSet].filter((t) => otherBag.has(t)).length;
      const union = new Set([...bagSet, ...otherBag]).size;
      if (union > 0 && inter / union > DUPLICATE_THRESHOLD) return row;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveDreamToDB(
  dream: NormalizedDream,
  userId: string,
  identity: DreamMatchIdentity,
  aiAnalysis: unknown,
  contentHash: string,
): Promise<string> {
  try {
    const supabase = await getSupabaseAdmin();
    const { data } = await supabase
      .from("dream_entries")
      .insert({
        user_id: userId,
        narrative: dream.narrative,
        symbols: dream.symbols,
        emotions: dream.emotions,
        themes: dream.themes,
        objects: dream.objects,
        entities: dream.entities,
        locations: dream.locations,
        actions: dream.actions,
        ending: dream.ending,
        country: dream.country ?? null,
        normalized_vector: { tokenBag: dream.tokenBag, contentHash },
        match_alias: identity.alias,
        match_country: identity.country,
        match_identity_generated_at: identity.createdAt,
        ai_analysis: aiAnalysis ?? null,
      })
      .select("id")
      .single();
    return data?.id ?? "";
  } catch {
    return "";
  }
}

async function persistMatchResult(dreamEntryId: string, match: SimilarDreamInfo): Promise<void> {
  try {
    const supabase = await getSupabaseAdmin();
    await supabase.from("dream_matches").insert({
      dream_entry_id: dreamEntryId,
      is_real: match.isReal,
      total_count: match.totalCount,
      locations: match.locations,
      aggregate_only: match.aggregateOnly,
      example_description: match.exampleDescription ?? null,
    });
  } catch {
    // Match persistence is best-effort; the entry itself is already saved.
  }
}

function findMatchesForDream(
  target: NormalizedDream,
  targetIdentity: DreamMatchIdentity | null,
  existingRows: DreamRow[],
): SimilarDreamInfo & { matches: DreamMatchDetail[] } {
  const scored = existingRows
    .filter((d) => d.id !== target.id)
    .map((d) => ({
      row: d,
      score: similarityScore(target, rowToNormalized(d)),
    }))
    .filter((m) => m.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const toDetail = (row: DreamRow, score: number): DreamMatchDetail => ({
    narrativeExcerpt: row.narrative.length > 160 ? `${row.narrative.slice(0, 157)}…` : row.narrative,
    alias: row.match_alias ?? identityForHash(dreamContentHash(row.narrative)).alias,
    country: row.match_country ?? row.country ?? "Unknown",
    similarity: Math.round(Math.min(0.99, score) * 100) / 100,
    createdAt: row.created_at,
  });

  if (scored.length === 0) {
    // No real match yet — caller persists a generated identity with the entry.
    return {
      isReal: false,
      totalCount: 0,
      locations: [],
      aggregateOnly: false,
      matches: [],
    };
  }

  if (scored.length > 5) {
    const locationMap = new Map<string, number>();
    for (const m of scored) {
      const country = m.row.match_country ?? m.row.country ?? "Unknown";
      locationMap.set(country, (locationMap.get(country) ?? 0) + 1);
    }
    const locations = [...locationMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    return {
      isReal: true,
      totalCount: scored.length,
      locations,
      aggregateOnly: true,
      matches: [],
    };
  }

  const locationMap = new Map<string, number>();
  for (const m of scored) {
    const country = m.row.match_country ?? m.row.country ?? "Unknown";
    locationMap.set(country, (locationMap.get(country) ?? 0) + 1);
  }
  const locations = [...locationMap.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  return {
    isReal: true,
    totalCount: scored.length,
    locations,
    aggregateOnly: false,
    matches: scored.slice(0, 5).map((m) => toDetail(m.row, m.score)),
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface SaveAndMatchResult {
  match: SimilarDreamInfo;
  /** Individual match details (only when 1–5 matches; empty when aggregated or none). */
  matches: DreamMatchDetail[];
  /** The identity persisted for this dream (existing one when duplicate). */
  identity: DreamMatchIdentity;
  /** Whether the submission was a duplicate of an already-stored dream. */
  wasDuplicate: boolean;
  /** True when the entry failed to persist (matching degraded to ephemeral). */
  persisted: boolean;
}

/**
 * Persist a completed dream and compute similar-dream matches.
 * Never throws — DB failures degrade gracefully (persisted=false) so an
 * AI-successful analysis is still shown, but duplicates are guarded by the
 * content hash + token overlap wherever the DB is reachable.
 */
export async function saveAndMatch(
  dream: NormalizedDream,
  options: {
    userId: string;
    aiAnalysis?: unknown;
  },
): Promise<SaveAndMatchResult> {
  const { userId, aiAnalysis } = options;
  const contentHash = dreamContentHash(dream.narrative);

  const existingRows = await getExistingDreams();

  // Retry/duplicate guard: if this exact (or near-exact) dream was already
  // stored, do NOT create another row and do NOT re-roll the identity.
  const existing = await findExistingDream(dream.narrative, dream.tokenBag);
  if (existing) {
    const identity: DreamMatchIdentity = {
      alias: existing.match_alias ?? identityForHash(contentHash).alias,
      country: existing.match_country ?? existing.country ?? "Unknown",
      createdAt: existing.match_identity_generated_at ?? existing.created_at,
    };
    const match = findMatchesForDream(rowToNormalized(existing), identity, existingRows);
    await persistMatchResult(existing.id, match);
    return { match, matches: match.matches, identity, wasDuplicate: true, persisted: true };
  }

  // New dream: generate a random anonymous identity ONCE and persist it.
  const identity: DreamMatchIdentity = newDreamMatchIdentity(contentHash);
  const newId = await saveDreamToDB(dream, userId, identity, aiAnalysis, contentHash);
  const persisted = Boolean(newId);

  const savedRow: DreamRow = {
    id: newId || `ephemeral-${Date.now()}`,
    narrative: dream.narrative,
    symbols: dream.symbols,
    emotions: dream.emotions,
    themes: dream.themes,
    objects: dream.objects,
    entities: dream.entities,
    locations: dream.locations,
    actions: dream.actions,
    ending: dream.ending,
    country: dream.country ?? null,
    normalized_vector: { tokenBag: dream.tokenBag, contentHash },
    match_alias: identity.alias,
    match_country: identity.country,
    match_identity_generated_at: identity.createdAt,
    created_at: dream.createdAt,
  };

  const rowsForMatching = persisted ? [savedRow, ...existingRows] : existingRows;
  const match = findMatchesForDream(
    rowToNormalized(savedRow),
    identity,
    // The freshly saved row must not match against itself.
    rowsForMatching.filter((r) => r.id !== savedRow.id),
  );

  if (persisted) {
    await persistMatchResult(savedRow.id, match);
  }

  return { match, matches: match.matches, identity, wasDuplicate: false, persisted };
}

export async function getDreamStoreSize(): Promise<number> {
  try {
    const supabase = await getSupabaseAdmin();
    const { count } = await supabase
      .from("dream_entries")
      .select("id", { count: "exact", head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}
