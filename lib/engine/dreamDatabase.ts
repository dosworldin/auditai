/**
 * In-memory dream database for the Dream AI Analyzer.
 *
 * Simulates the labs_dream_entries / labs_dream_symbols / labs_dream_analysis
 * tables described in the registry.  Persistence is deferred — this module
 * keeps data for the lifetime of the process, which is fine for the blueprint
 * phase.  When real DB persistence is added later, swap the internal arrays
 * for Convex queries/mutations.
 */

import type { SimilarDreamInfo } from "@/lib/engine/types";

/* ------------------------------------------------------------------ */
/*  Normalized dream representation                                    */
/* ------------------------------------------------------------------ */

export interface NormalizedDream {
  id: string;
  /** Original narrative text provided by the user. */
  narrative: string;
  /** Detected/extracted symbol names. */
  symbols: string[];
  /** Detected emotions. */
  emotions: string[];
  /** Detected context patterns / themes. */
  themes: string[];
  /** Objects mentioned (from symbol/keyword detection). */
  objects: string[];
  /** People / entities mentioned. */
  entities: string[];
  /** Locations mentioned. */
  locations: string[];
  /** Actions / events. */
  actions: string[];
  /** How the dream ended (last ~3 sentences). */
  ending: string;
  /** User-provided country / location metadata. */
  country?: string;
  /** Semantic token bag used for similarity scoring. */
  tokenBag: string[];
  /** When the entry was created. */
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Keyword banks (re-used from labLogic, but kept minimal here)       */
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
/*  Sample seed data (clearly labelled as example data)                */
/* ------------------------------------------------------------------ */

const SEED_DREAMS: NormalizedDream[] = [
  {
    id: "seed-001",
    narrative: "I was flying over a neon city at night, feeling free and weightless.",
    symbols: ["flying", "house"],
    emotions: ["joy", "empowerment"],
    themes: ["transition"],
    objects: ["neon lights"],
    entities: [],
    locations: ["city", "sky"],
    actions: ["flying"],
    ending: "I soared higher until I woke up feeling refreshed.",
    country: "India",
    tokenBag: ["fly", "flying", "city", "night", "neon", "free", "weightless", "soar", "soared", "sky", "joy", "empowerment", "transition"],
    createdAt: "2025-12-01T10:00:00Z",
  },
  {
    id: "seed-002",
    narrative: "I was flying high above the clouds, looking down at a tiny city below.",
    symbols: ["flying"],
    emotions: ["joy", "empowerment"],
    themes: ["transition"],
    objects: ["clouds"],
    entities: [],
    locations: ["city", "sky"],
    actions: ["flying", "looking"],
    ending: "I floated down gently and landed in a garden.",
    country: "Canada",
    tokenBag: ["fly", "flying", "high", "clouds", "city", "tiny", "below", "float", "landed", "garden", "joy", "empowerment", "transition"],
    createdAt: "2025-12-15T14:30:00Z",
  },
  {
    id: "seed-003",
    narrative: "I dreamed I could fly, soaring over mountains and rivers. I felt so powerful.",
    symbols: ["flying", "water"],
    emotions: ["empowerment", "joy"],
    themes: ["transformation"],
    objects: [],
    entities: [],
    locations: ["mountain", "river", "sky"],
    actions: ["flying", "soaring"],
    ending: "I flew back home and woke up smiling.",
    country: "India",
    tokenBag: ["fly", "flying", "soar", "soaring", "mountains", "rivers", "powerful", "home", "smiling", "empowerment", "joy", "transformation"],
    createdAt: "2026-01-05T09:15:00Z",
  },
  {
    id: "seed-004",
    narrative: "I was chasing a silver key through a dark forest. The trees were whispering my name.",
    symbols: ["chase", "animals"],
    emotions: ["fear", "confusion"],
    themes: ["pursuit"],
    objects: ["key"],
    entities: [],
    locations: ["forest"],
    actions: ["chasing", "whispering"],
    ending: "I found the key but the lock had disappeared.",
    country: "United States",
    tokenBag: ["chasing", "chase", "key", "silver", "dark", "forest", "trees", "whispering", "name", "found", "lock", "disappeared", "fear", "confusion", "pursuit"],
    createdAt: "2026-01-10T20:00:00Z",
  },
  {
    id: "seed-005",
    narrative: "I was in an exam hall but I hadn't studied. The questions were in a language I couldn't read.",
    symbols: ["exams"],
    emotions: ["fear", "confusion"],
    themes: ["pursuit"],
    objects: ["exam paper"],
    entities: ["stranger"],
    locations: ["school", "classroom"],
    actions: ["sitting", "reading"],
    ending: "The bell rang and I woke up in a cold sweat.",
    country: "United Kingdom",
    tokenBag: ["exam", "examination", "hall", "studied", "questions", "language", "read", "bell", "rang", "woke", "cold", "sweat", "fear", "confusion", "pursuit"],
    createdAt: "2026-01-20T07:30:00Z",
  },
  {
    id: "seed-006",
    narrative: "I was at a crowded party and suddenly realized I was completely naked. Everyone was staring.",
    symbols: ["naked"],
    emotions: ["fear", "confusion"],
    themes: ["transformation"],
    objects: [],
    entities: ["people"],
    locations: ["room"],
    actions: ["staring"],
    ending: "I woke up embarrassed but relieved it was a dream.",
    country: "India",
    tokenBag: ["crowded", "party", "naked", "nobody", "clothes", "staring", "everyone", "embarrassed", "relieved", "fear", "confusion", "transformation"],
    createdAt: "2026-02-01T11:00:00Z",
  },
  {
    id: "seed-007",
    narrative: "My teeth started falling out one by one in front of a mirror. I tried to hold them in.",
    symbols: ["teeth", "mirror"],
    emotions: ["fear", "sadness"],
    themes: ["transformation"],
    objects: ["teeth", "mirror"],
    entities: [],
    locations: ["bathroom"],
    actions: ["falling", "holding"],
    ending: "I woke up touching my teeth to make sure they were still there.",
    country: "India",
    tokenBag: ["teeth", "tooth", "falling", "out", "mirror", "hold", "held", "bathroom", "touching", "fear", "sadness", "transformation"],
    createdAt: "2026-02-10T06:45:00Z",
  },
  {
    id: "seed-008",
    narrative: "I was being chased through narrow streets by something I couldn't see. I was running so fast.",
    symbols: ["chase"],
    emotions: ["fear"],
    themes: ["pursuit"],
    objects: [],
    entities: [],
    locations: ["road", "city"],
    actions: ["chasing", "running"],
    ending: "I turned a corner and there was a dead end. Then I woke up.",
    country: "India",
    tokenBag: ["chased", "chasing", "narrow", "streets", "something", "running", "fast", "corner", "dead", "end", "fear", "pursuit"],
    createdAt: "2026-02-15T22:10:00Z",
  },
  {
    id: "seed-009",
    narrative: "I found a chest full of gold coins buried under a tree in my grandmother's garden.",
    symbols: ["money"],
    emotions: ["joy", "surprise"],
    themes: ["discovery"],
    objects: ["chest", "gold", "coins", "tree"],
    entities: ["grandmother"],
    locations: ["garden"],
    actions: ["finding", "digging", "buried"],
    ending: "I woke up feeling rich and happy.",
    country: "Canada",
    tokenBag: ["found", "chest", "gold", "coins", "buried", "tree", "grandmother", "garden", "digging", "rich", "happy", "joy", "surprise", "discovery"],
    createdAt: "2026-03-01T08:20:00Z",
  },
  {
    id: "seed-010",
    narrative: "I was falling endlessly into a deep dark ocean. I couldn't breathe.",
    symbols: ["water", "falling"],
    emotions: ["fear"],
    themes: ["transformation"],
    objects: [],
    entities: [],
    locations: ["ocean", "underwater"],
    actions: ["falling", "drowning"],
    ending: "I hit the bottom and everything went black.",
    country: "Australia",
    tokenBag: ["falling", "endlessly", "deep", "dark", "ocean", "breathe", "water", "underwater", "hit", "bottom", "black", "fear", "transformation"],
    createdAt: "2026-03-10T03:15:00Z",
  },
  {
    id: "seed-011",
    narrative: "I was flying over a neon city with a silver key in my hand. The city glowed beneath me.",
    symbols: ["flying", "house"],
    emotions: ["joy", "empowerment"],
    themes: ["transition"],
    objects: ["key", "neon"],
    entities: [],
    locations: ["city", "sky"],
    actions: ["flying"],
    ending: "I soared higher and the city became tiny like a toy.",
    country: "India",
    tokenBag: ["fly", "flying", "neon", "city", "key", "silver", "glow", "glowed", "beneath", "soar", "soared", "tiny", "toy", "joy", "empowerment", "transition"],
    createdAt: "2026-03-15T15:00:00Z",
  },
];

/* ------------------------------------------------------------------ */
/*  In-memory store                                                    */
/* ------------------------------------------------------------------ */

let dreamStore: NormalizedDream[] = [...SEED_DREAMS];
let nextId = SEED_DREAMS.length + 1;

function generateId(): string {
  return `dream-${String(nextId++).padStart(4, "0")}`;
}

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

function extractKeywords(
  text: string,
  keywordMap: Record<string, string[]>,
): string[] {
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

function extractFromText(text: string, keywords: string[]): string[] {
  const low = text.toLowerCase();
  return keywords.filter((k) => {
    const words = k.split(/\s+/);
    return words.every((w) => low.includes(w));
  });
}

export function normalizeDream(
  narrative: string,
  country?: string,
): NormalizedDream {
  const symbols = extractKeywords(narrative, SYMBOL_KEYWORDS);
  const emotions = extractKeywords(narrative, EMOTION_KEYWORDS);
  const themes = extractKeywords(narrative, THEME_KEYWORDS);
  const entities = extractKeywordList(narrative, ENTITY_KEYWORDS);
  const actions = extractKeywordList(narrative, ACTION_KEYWORDS);
  const locations = extractKeywordList(narrative, LOCATION_KEYWORDS);

  // Objects: combine symbol matches + entity matches
  const objects = [...new Set([...symbols, ...entities])];

  // Ending: last 2-3 sentences
  const sentences = narrative
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  const ending = sentences.slice(-2).join(" ");

  // Token bag: unique tokens from the narrative + all detected labels
  const narrativeTokens = tokenize(narrative);
  const labelTokens = [
    ...symbols,
    ...emotions,
    ...themes,
    ...entities,
    ...actions,
    ...locations,
  ].map((l) => l.toLowerCase());
  const tokenBag = [...new Set([...narrativeTokens, ...labelTokens])];

  return {
    id: generateId(),
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

/**
 * Jaccard similarity between two token bags, with bonus for shared
 * symbol/emotion/theme labels.
 */
function similarityScore(a: NormalizedDream, b: NormalizedDream): number {
  const setA = new Set(a.tokenBag);
  const setB = new Set(b.tokenBag);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Bonus for shared high-level labels
  const sharedSymbols = a.symbols.filter((s) => b.symbols.includes(s)).length;
  const sharedEmotions = a.emotions.filter((e) => b.emotions.includes(e)).length;
  const sharedThemes = a.themes.filter((t) => b.themes.includes(t)).length;
  const labelBonus =
    (sharedSymbols * 0.08 + sharedEmotions * 0.05 + sharedThemes * 0.05);

  return Math.min(1, jaccard + labelBonus);
}

const SIMILARITY_THRESHOLD = 0.32;

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Save a normalized dream to the store and return matching results.
 */
export function saveAndMatch(
  dream: NormalizedDream,
): SimilarDreamInfo {
  // Check for near-duplicate narratives (same user re-submitting)
  const existingMatch = dreamStore.find((d) => {
    if (d.id === dream.id) return false;
    const a = new Set(tokenize(d.narrative));
    const b = new Set(tokenize(dream.narrative));
    const intersection = [...a].filter((t) => b.has(t)).length;
    const union = new Set([...a, ...b]).size;
    return union > 0 && intersection / union > 0.75;
  });

  if (existingMatch) {
    // This is essentially the same dream — return the existing match result
    return findMatchesForDream(existingMatch);
  }

  // Save the new dream
  dreamStore.push(dream);

  // Find matches for the newly saved dream
  return findMatchesForDream(dream);
}

/**
 * Find matching dreams in the store (excluding the dream itself).
 */
function findMatchesForDream(
  target: NormalizedDream,
): SimilarDreamInfo {
  const matches = dreamStore
    .filter((d) => d.id !== target.id)
    .map((d) => ({ dream: d, score: similarityScore(target, d) }))
    .filter((m) => m.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const totalCount = matches.length;

  if (totalCount === 0) {
    // No real matches — generate a random/example comparison
    return generateExampleComparison(target);
  }

  if (totalCount > 5) {
    // Aggregate only — do not list individual entries
    const locationMap = new Map<string, number>();
    for (const m of matches) {
      const country = m.dream.country ?? "Unknown";
      locationMap.set(country, (locationMap.get(country) ?? 0) + 1);
    }
    const locations = [...locationMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    return {
      isReal: true,
      totalCount,
      locations,
      aggregateOnly: true,
    };
  }

  // 1-5 matches — show individual anonymized entries
  const locationMap = new Map<string, number>();
  for (const m of matches) {
    const country = m.dream.country ?? "Unknown";
    locationMap.set(country, (locationMap.get(country) ?? 0) + 1);
  }
  const locations = [...locationMap.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  return {
    isReal: true,
    totalCount,
    locations,
    aggregateOnly: false,
  };
}

/**
 * Generate an example/random comparison when no real matches exist.
 * Always clearly labelled as example data.
 */
function generateExampleComparison(target: NormalizedDream): SimilarDreamInfo {
  // Generate plausible example data based on the dream's own symbols
  const exampleCountries = ["India", "Canada", "United States", "United Kingdom", "Australia"];
  const targetCountry = target.country ?? "Unknown";

  // Pick 1-3 example locations including the user's country if possible
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

/**
 * Get the current store size (for metrics/debugging).
 */
export function getDreamStoreSize(): number {
  return dreamStore.length;
}

/**
 * Search for similar dreams without saving (for re-submission detection).
 */
export function searchDreams(
  tokenBag: string[],
  threshold = SIMILARITY_THRESHOLD,
): { dream: NormalizedDream; score: number }[] {
  const query: NormalizedDream = {
    id: "",
    narrative: "",
    symbols: [],
    emotions: [],
    themes: [],
    objects: [],
    entities: [],
    locations: [],
    actions: [],
    ending: "",
    tokenBag,
    createdAt: "",
  };

  return dreamStore
    .map((d) => ({ dream: d, score: similarityScore(query, d) }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
