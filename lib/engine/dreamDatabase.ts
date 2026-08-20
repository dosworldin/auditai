/**
 * Supabase-backed dream database for Dream AI Analyzer.
 * Replaces the in-memory dreamDatabase.ts store with real DB queries.
 * Preserves all existing matching logic and similarity scoring.
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

/* ------------------------------------------------------------------ */
/*  DB operations                                                      */
/* ------------------------------------------------------------------ */

async function getExistingDreams(): Promise<NormalizedDream[]> {
  try {
    const supabase = await getSupabaseAdmin();
    const { data } = await supabase
      .from("dream_entries")
      .select("id, narrative, symbols, emotions, themes, objects, entities, locations, actions, ending, country, normalized_vector, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      narrative: row.narrative,
      symbols: (row.symbols as string[]) ?? [],
      emotions: (row.emotions as string[]) ?? [],
      themes: (row.themes as string[]) ?? [],
      objects: (row.objects as string[]) ?? [],
      entities: (row.entities as string[]) ?? [],
      locations: (row.locations as string[]) ?? [],
      actions: (row.actions as string[]) ?? [],
      ending: row.ending ?? "",
      country: row.country ?? undefined,
      tokenBag: ((row.normalized_vector as Record<string, unknown>)?.tokenBag as string[]) ?? [],
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

async function saveDreamToDB(dream: NormalizedDream): Promise<string> {
  try {
    const supabase = await getSupabaseAdmin();
    const { data } = await supabase
      .from("dream_entries")
      .insert({
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
        normalized_vector: { tokenBag: dream.tokenBag },
      })
      .select("id")
      .single();
    return data?.id ?? "";
  } catch {
    return "";
  }
}

function findMatchesForDream(
  target: NormalizedDream,
  existingDreams: NormalizedDream[],
): SimilarDreamInfo {
  const matches = existingDreams
    .filter((d) => d.id !== target.id)
    .map((d) => ({ dream: d, score: similarityScore(target, d) }))
    .filter((m) => m.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const totalCount = matches.length;

  if (totalCount === 0) {
    return generateExampleComparison(target);
  }

  if (totalCount > 5) {
    const locationMap = new Map<string, number>();
    for (const m of matches) {
      const country = m.dream.country ?? "Unknown";
      locationMap.set(country, (locationMap.get(country) ?? 0) + 1);
    }
    const locations = [...locationMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    return { isReal: true, totalCount, locations, aggregateOnly: true };
  }

  const locationMap = new Map<string, number>();
  for (const m of matches) {
    const country = m.dream.country ?? "Unknown";
    locationMap.set(country, (locationMap.get(country) ?? 0) + 1);
  }
  const locations = [...locationMap.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  return { isReal: true, totalCount, locations, aggregateOnly: false };
}

function generateExampleComparison(target: NormalizedDream): SimilarDreamInfo {
  const exampleCountries = ["India", "Canada", "United States", "United Kingdom", "Australia"];
  const targetCountry = target.country ?? "Unknown";
  const otherCountries = exampleCountries.filter((c) => c !== targetCountry);
  const picked = otherCountries
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 3) + 1);

  if (targetCountry !== "Unknown" && Math.random() > 0.4) {
    picked.push(targetCountry);
  }

  const locations = picked
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((country) => ({ country, count: Math.floor(Math.random() * 4) + 1 }));

  const totalExample = locations.reduce((sum, l) => sum + l.count, 0);
  const symbolList = target.symbols.length > 0 ? target.symbols.join(", ") : "similar themes";

  return {
    isReal: false,
    totalCount: totalExample,
    locations,
    aggregateOnly: false,
    exampleDescription: `Example based on dreams with ${symbolList}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function saveAndMatch(dream: NormalizedDream): Promise<SimilarDreamInfo> {
  const existingDreams = await getExistingDreams();

  // Check for near-duplicate narratives
  const existingMatch = existingDreams.find((d) => {
    if (d.id === dream.id) return false;
    const a = new Set(tokenize(d.narrative));
    const b = new Set(tokenize(dream.narrative));
    const intersection = [...a].filter((t) => b.has(t)).length;
    const union = new Set([...a, ...b]).size;
    return union > 0 && intersection / union > 0.75;
  });

  if (existingMatch) {
    return findMatchesForDream(existingMatch, existingDreams);
  }

  // Save the new dream
  const newId = await saveDreamToDB(dream);
  dream.id = newId;
  existingDreams.push(dream);

  return findMatchesForDream(dream, existingDreams);
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
