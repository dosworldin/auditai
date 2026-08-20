import type { LabFinding, LabOutput, LabRunPayload, Severity, DreamFollowUp } from "@/lib/engine/types";
import { extractForAudit } from "@/lib/engine/extract";
import { countWords, splitLines } from "@/lib/engine/text";
import { getLab } from "@/lib/labs/registry";
import { normalizeDream, saveAndMatch, getDreamStoreSize } from "@/lib/engine/dreamDatabase";

export type LabStatus = "EXPERIMENTAL" | "BETA" | "ACTIVE" | "DISABLED" | "ARCHIVED" | "READY" | "COMING_SOON";

const STATUS_MAP: Record<string, LabStatus> = {
  Experimental: "EXPERIMENTAL",
  Beta: "BETA",
  Ready: "READY",
  "Coming Soon": "COMING_SOON",
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
  copiableText?: string;
}): LabFinding {
  return {
    id: input.id,
    label: input.label,
    detail: input.detail,
    severity: input.severity ?? "Info",
    confidence: input.confidence ?? 0.6,
    ...(input.evidence ? { evidence: input.evidence } : {}),
    ...(input.copiableText ? { copiableText: input.copiableText } : {}),
  };
}

function countOccurrences(text: string, words: string[]): number {
  const low = text.toLowerCase();
  return words.reduce((acc, w) => acc + (low.split(w).length - 1), 0);
}

/* ------------------------------ handlers ------------------------------ */

type HandlerResult = {
  summary: string;
  metrics: Record<string, string | number>;
  findings: LabFinding[];
  notes: string[];
  similarDreams?: import("@/lib/engine/types").SimilarDreamInfo;
  followUp?: DreamFollowUp;
};

type Handler = (
  text: string,
  config: Record<string, string | number | boolean>,
) => HandlerResult | Promise<HandlerResult>;

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

/* =====================================================================
   DREAM AI ANALYZER
   ===================================================================== */

/* ------------------------------------------------------------------
   DREAM AI ANALYZER — Symbol / Emotion banks
   ------------------------------------------------------------------ */

const DREAM_SYMBOLS: Record<string, string[]> = {
  "Flying": ["fly", "flying", "soaring", "airborne", "levitat", "float", "wings"],
  "Water": ["water", "ocean", "sea", "river", "lake", "wave", "flood", "drowning", "swim"],
  "Teeth falling out": ["teeth", "tooth", "falling out", "crumbling", "loose tooth"],
  "Being chased": ["chase", "chased", "pursuit", "running from", "fleeing", "being followed"],
  "Death": ["death", "dying", "dead", "funeral", "grave", "cemetery", "passed away"],
  "House/Building": ["house", "building", "room", "door", "window", "corridor", "hallway", "home"],
  "Animals": ["animal", "dog", "cat", "snake", "spider", "bird", "wolf", "lion", "bear", "horse"],
  "Falling": ["falling", "fall", "dropping", "plummet", "cliff", "edge"],
  "Naked in public": ["naked", "undressed", "exposed", "embarrass", "clothes missing", "no clothes"],
  "Exams/Tests": ["exam", "test", "school", "classroom", "unprepared", "late for", "forgot"],
  "Money": ["money", "cash", "wallet", "find", "winning", "losing money", "rich", "broke"],
  "Baby/Pregnancy": ["baby", "pregnant", "birth", "child", "infant", "newborn", "pregnancy"],
  "Journey/Travel": ["journey", "travel", "road", "train", "flight", "airport", "map", "lost"],
  "Mirror": ["mirror", "reflection", "looking at myself", "mirror image"],
  "Fire": ["fire", "burning", "flame", "fireball", "blaze", "inferno"],
};

const DREAM_EMOTIONS: Record<string, string[]> = {
  "Fear/Anxiety": ["afraid", "scared", "terrified", "anxious", "panic", "dread", "nightmare", "horror"],
  "Joy/Happiness": ["happy", "joy", "delighted", "excited", "wonderful", "beautiful", "blissful", "love"],
  "Sadness": ["sad", "cry", "crying", "tears", "miserable", "grief", "mourning", "lonely"],
  "Anger": ["angry", "furious", "rage", "mad", "frustrated", "irritated", "enraged"],
  "Confusion": ["confused", "lost", "uncertain", "bizarre", "strange", "weird", "disoriented", "surreal"],
  "Surprise": ["surprised", "shocked", "unexpected", "sudden", "amazed", "astonished"],
  "Guilt": ["guilty", "guilt", "regret", "ashamed", "blame", "conscience", "wrong"],
  "Empowerment": ["powerful", "confident", "strong", "capable", "in control", "free", "liberated"],
};

const DREAM_CONTEXTS: Record<string, string[]> = {
  "Transformation": ["transform", "change", "metamorphosis", "becoming", "morph", "shapeshift"],
  "Loss/Abandonment": ["lost", "abandoned", "alone", "left behind", "missing", "gone", "separated"],
  "Pursuit/Evasion": ["running", "hiding", "escape", "pursued", "chase", "fleeing"],
  "Discovery/Revelation": ["discover", "find", "reveal", "secret", "hidden", "found", "uncovered"],
  "Transition": ["door", "threshold", "crossing", "bridge", "path", "journey", "enter", "exit"],
  "Communication": ["talking", "saying", "telling", "speaking", "voice", "listen", "call"],
};

/* ------------------------------------------------------------------
   DREAM DETAIL CHECKING & FOLLOW-UP QUESTIONS
   ------------------------------------------------------------------ */

interface DreamDetailCheck {
  sufficient: boolean;
  missingFields: string[];
}

const DREAM_DETAIL_FIELDS = [
  { key: "narrative", label: "dream narrative", minWords: 15 },
  { key: "setting", label: "setting / location", keywords: ["in", "at", "on", "inside", "outside", "near", "by", "over", "under"] },
  { key: "emotions", label: "emotions felt", keywords: ["felt", "feeling", "was scared", "was happy", "was sad", "was angry", "was anxious", "was excited", "was confused", "afraid", "happy", "sad", "angry", "anxious", "excited", "confused", "terrified", "joyful", "peaceful", "nervous"] },
  { key: "ending", label: "how the dream ended", keywords: ["then", "after", "finally", "woke up", "suddenly", "ended", "woke", "disappeared", "faded"] },
];

function checkDreamDetail(text: string): DreamDetailCheck {
  const low = text.toLowerCase();
  const words = countWords(text);
  const missingFields: string[] = [];

  // Check narrative length
  const minWords = DREAM_DETAIL_FIELDS[0].minWords ?? 15;
  if (words < minWords) {
    missingFields.push("narrative");
  }

  // Check setting
  const hasSetting = DREAM_DETAIL_FIELDS[1].keywords?.some((k) => low.includes(k)) ?? false;
  if (!hasSetting) {
    missingFields.push("setting");
  }

  // Check emotions
  const hasEmotions = DREAM_DETAIL_FIELDS[2].keywords?.some((k) => low.includes(k)) ?? false;
  if (!hasEmotions) {
    missingFields.push("emotions");
  }

  // Check ending
  const hasEnding = DREAM_DETAIL_FIELDS[3].keywords?.some((k) => low.includes(k)) ?? false;
  if (!hasEnding) {
    missingFields.push("ending");
  }

  return {
    sufficient: missingFields.length <= 1, // Allow missing one field
    missingFields,
  };
}

const FOLLOW_UP_QUESTIONS: Record<string, string[]> = {
  narrative: [
    "What happened next in the dream?",
    "Can you describe more of what you saw?",
    "Were there other events or details you remember?",
  ],
  setting: [
    "Where were you in the dream? (e.g., in a city, at home, in a forest)",
    "What did the environment look like?",
    "Were you indoors or outdoors?",
  ],
  emotions: [
    "What emotions did you feel during the dream?",
    "How did the dream make you feel — scared, happy, anxious, excited?",
    "Did your feelings change during the dream?",
  ],
  ending: [
    "How did the dream end?",
    "Did you wake up, or did the dream fade?",
    "What was the last thing you remember before waking?",
  ],
};

function pickFollowUpQuestion(field: string): string {
  const questions = FOLLOW_UP_QUESTIONS[field] ?? ["Can you tell me more about this part of your dream?"];
  return questions[Math.floor(Math.random() * questions.length)];
}

function generateFollowUp(check: DreamDetailCheck, collected: Record<string, string>): DreamFollowUp {
  // Pick the most important missing field
  const priority = ["narrative", "setting", "emotions", "ending"];
  const nextField = priority.find((f) => check.missingFields.includes(f)) ?? check.missingFields[0];

  return {
    question: pickFollowUpQuestion(nextField),
    collected,
    missingFields: check.missingFields,
  };
}

const dreamAnalyzer: Handler = async (text, config) => {
  const low = text.toLowerCase();
  const words = countWords(text);

  /* --- Step 1: Check if dream detail is sufficient --- */
  const detailCheck = checkDreamDetail(text);
  const collected: Record<string, string> = { narrative: text };

  /* Detect symbols */
  const foundSymbols: { name: string; matches: string[] }[] = [];
  for (const [symbol, keywords] of Object.entries(DREAM_SYMBOLS)) {
    const matches = keywords.filter((k) => low.includes(k));
    if (matches.length > 0) foundSymbols.push({ name: symbol, matches });
  }

  /* Detect emotions */
  const foundEmotions: { name: string; matches: string[] }[] = [];
  for (const [emotion, keywords] of Object.entries(DREAM_EMOTIONS)) {
    const matches = keywords.filter((k) => low.includes(k));
    if (matches.length > 0) foundEmotions.push({ name: emotion, matches });
  }

  /* Detect context patterns */
  const foundContexts: { name: string; matches: string[] }[] = [];
  for (const [context, keywords] of Object.entries(DREAM_CONTEXTS)) {
    const matches = keywords.filter((k) => low.includes(k));
    if (matches.length > 0) foundContexts.push({ name: context, matches });
  }

  /* Detect setting/environment */
  const settingKeywords = ["city", "forest", "beach", "mountain", "school", "home", "office", "hospital", "night", "day", "dark", "bright", "sky", "ground"];
  const settingMatches = settingKeywords.filter((k) => low.includes(k));

  const recallLevel = (config.recallLevel as string) ?? "moderate";

  const summaryParts: string[] = [];
  summaryParts.push(`Dream analyzed (${words} words, ${recallLevel} recall detail).`);
  if (foundSymbols.length > 0) {
    summaryParts.push(`Identified ${foundSymbols.length} symbol(s): ${foundSymbols.map((s) => s.name).join(", ")}.`);
  }
  if (foundEmotions.length > 0) {
    summaryParts.push(`Emotional tone: ${foundEmotions.map((e) => e.name).join(", ")}.`);
  }

  const findings: LabFinding[] = [];

  /* Symbol findings */
  for (const sym of foundSymbols) {
    findings.push(
      lf({
        id: `sym-${sym.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        label: `Symbol: ${sym.name}`,
        detail: `The symbol "${sym.name}" appears in your dream narrative. Common dream analysis associates this with themes of ${sym.name.toLowerCase() === "flying" ? "freedom, ambition, and desire to escape" : sym.name.toLowerCase() === "water" ? "emotions, the subconscious, and flow of life" : sym.name.toLowerCase() === "teeth falling out" ? "anxiety about appearance, powerlessness, or change" : sym.name.toLowerCase() === "being chased" ? "avoidance of a problem or running from responsibility" : sym.name.toLowerCase() === "death" ? "endings, transformation, and new beginnings" : sym.name.toLowerCase() === "falling" ? "insecurity, loss of control, or letting go" : "deep personal significance"}.`,
        severity: "Info",
        confidence: 0.55,
        evidence: sym.matches.join(", "),
      }),
    );
  }

  /* Emotion findings */
  for (const emo of foundEmotions) {
    findings.push(
      lf({
        id: `emo-${emo.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        label: `Emotion: ${emo.name}`,
        detail: `Strong ${emo.name.toLowerCase()} undertones detected in the dream narrative. This emotional pattern may reflect ${emo.name.toLowerCase().includes("fear") || emo.name.toLowerCase().includes("anxiety") ? "waking-life stress or unresolved concerns" : emo.name.toLowerCase().includes("joy") || emo.name.toLowerCase().includes("happiness") ? "positive associations or fulfillment" : emo.name.toLowerCase().includes("sadness") ? "processing grief, loss, or longing" : emo.name.toLowerCase().includes("anger") ? "frustration or unresolved conflict" : "your current emotional state"}.`,
        severity: "Info",
        confidence: 0.5,
        evidence: emo.matches.join(", "),
      }),
    );
  }

  /* Context pattern findings */
  for (const ctx of foundContexts) {
    findings.push(
      lf({
        id: `ctx-${ctx.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        label: `Pattern: ${ctx.name}`,
        detail: `A "${ctx.name}" pattern is present. This recurring motif in dream analysis suggests ${ctx.name.toLowerCase() === "transformation" ? "you may be processing a significant life change" : ctx.name.toLowerCase() === "loss/abandonment" ? "feelings of insecurity or fear of loss" : ctx.name.toLowerCase() === "discovery/revelation" ? "your mind is working through hidden truths or new awareness" : ctx.name.toLowerCase() === "transition" ? "you stand at a crossroads or are moving between life phases" : "an active processing of life events"}.`,
        severity: "Info",
        confidence: 0.45,
      }),
    );
  }

  /* Setting */
  if (settingMatches.length > 0) {
    findings.push(
      lf({
        id: "dream-setting",
        label: "Dream Environment",
        detail: `Setting elements detected: ${settingMatches.join(", ")}. The environment in dreams often represents the dreamer's emotional landscape or current life context.`,
        severity: "Info",
        confidence: 0.4,
      }),
    );
  }

  /* Overall */
  const totalSymbols = foundSymbols.length + foundEmotions.length;
  if (totalSymbols === 0) {
    findings.push(
      lf({
        id: "dream-no-patterns",
        label: "Limited pattern detection",
        detail: "No common dream symbols or emotions were detected. The dream may be highly personal or the description may be too brief.",
        severity: "Info",
        confidence: 0.4,
      }),
    );
  }

  const metrics: Record<string, string | number> = {
    symbolsFound: foundSymbols.length,
    emotionsDetected: foundEmotions.length,
    contextPatterns: foundContexts.length,
    wordCount: words,
    recallLevel,
  };

  const notes = [
    "Dream analysis does not replace professional therapy or psychiatric evaluation.",
    "This is an experimental entertainment/pattern-matching experience, not a medical diagnosis.",
    "Symbol interpretations are based on common cultural associations and are not definitive.",
    "For recurring distressing dreams, consider consulting a mental health professional.",
  ];

  /* --- Step 2: Normalize and save to dream database --- */
  const userCountry = (config.country as string) || undefined;
  const normalizedDream = normalizeDream(text, userCountry);
  const matchResult = await saveAndMatch(normalizedDream);

  /* --- Step 3: Build similar dreams finding --- */
  if (matchResult.isReal) {
    const locationStr = matchResult.locations
      .map((l) => `${l.country} (${l.count})`)
      .join(", ");
    findings.push(
      lf({
        id: "dream-similar-real",
        label: "Similar Dreams Found",
        detail: matchResult.aggregateOnly
          ? `${matchResult.totalCount} people have reported a similar dream.`
          : `${matchResult.totalCount} similar dream(s) found: ${locationStr}.`,
        severity: "Info",
        confidence: 0.6,
      }),
    );
  } else {
    findings.push(
      lf({
        id: "dream-similar-example",
        label: "Similar Dream Reports (Example)",
        detail: `${matchResult.totalCount} example report(s) based on similar dream patterns: ${matchResult.locations.map((l) => `${l.country} (${l.count})`).join(", ")}.`,
        severity: "Info",
        confidence: 0.3,
        evidence: matchResult.exampleDescription ?? "Random example based on available dataset",
      }),
    );
  }

  const similarDreamsInfo = matchResult;

  const totalEntries = await getDreamStoreSize();
  metrics.dreamDatabaseSize = totalEntries;
  metrics.similarDreamsFound = matchResult.totalCount;
  metrics.similarDreamsIsReal = matchResult.isReal ? 1 : 0;

  return {
    summary: summaryParts.join(" "),
    metrics,
    findings,
    notes,
    similarDreams: similarDreamsInfo,
  };
};

/* =====================================================================
   KALESH ANALYZER
   ===================================================================== */

const kaleshAnalyzer: Handler = (text, config) => {
  const mode = (config.analysisMode as string) ?? "neutral";
  const low = text.toLowerCase();
  const words = countWords(text);

  /* Detect speakers (Name: or Name said:) */
  const speakerPattern = /^([A-Za-z][A-Za-z\s.]{1,30}?)[:]/gm;
  const speakerMatches = text.match(speakerPattern) ?? [];
  const speakers = [...new Set(speakerMatches.map((s) => s.replace(":", "").trim()))].slice(0, 6);

  /* Detect conflict indicators */
  const conflictKeywords = [
    "stupid", "idiot", "shut up", "hate", "never", "always", "you always", "you never",
    "fine", "whatever", "i don't care", "not my problem", "you started it",
    "unbelievable", "ridiculous", "seriously", "are you kidding",
  ];
  const conflictHits = conflictKeywords.filter((k) => low.includes(k));

  /* Detect gaslighting patterns */
  const gaslightKeywords = [
    "that never happened", "you're imagining", "you're overreacting", "you're too sensitive",
    "i never said that", "you remembered wrong", "that's not what happened",
    "you're crazy", "you're making this up", "nobody else thinks that",
    "you're just", "calm down", "you're being dramatic",
  ];
  const gaslightHits = gaslightKeywords.filter((k) => low.includes(k));

  /* Detect escalation markers */
  const escalationKeywords = [
    "!!!", "caps", "ALL CAPS", "?!?!", "WHY",
  ];
  const escalationHits = escalationKeywords.filter((k) => {
    if (k === "caps") return /[A-Z]{5,}/.test(text);
    if (k === "ALL CAPS") return text === text.toUpperCase() && words > 5;
    return text.includes(k);
  });

  /* Detect passive aggression */
  const passiveAggKeywords = [
    "sure", "fine", "if you say so", "whatever", "i guess", "no worries",
    "it's fine", "i'm fine", "cool", "do what you want",
  ];
  const passiveHits = passiveAggKeywords.filter((k) => low.includes(k));

  /* Detect timestamps for conversation flow */
  const timePattern = /\b\d{1,2}:\d{2}\b/g;
  const timestamps = text.match(timePattern) ?? [];

  const findings: LabFinding[] = [];
  const copiableOutputs: string[] = [];

  if (mode === "neutral") {
    findings.push(
      lf({
        id: "k-neutral-overview",
        label: "Neutral Ground Analysis",
        detail: `Conversation with ${speakers.length > 0 ? speakers.join(" vs ") : "unidentified participants"} analyzed. ${conflictHits.length} conflict indicator(s) and ${passiveHits.length} passive aggression marker(s) detected.`,
        severity: conflictHits.length > 3 ? "Medium" : "Info",
        confidence: 0.55,
        evidence: conflictHits.slice(0, 3).join(", ") || "No overt conflict keywords found.",
      }),
    );

    if (speakers.length >= 2) {
      const perSpeaker: Record<string, number> = {};
      for (const s of speakers) {
        const sLow = s.toLowerCase();
        const lines = text.split("\n").filter((l) => l.toLowerCase().startsWith(sLow));
        perSpeaker[s] = lines.length;
      }
      const [mostActive] = Object.entries(perSpeaker).sort((a, b) => b[1] - a[1]);
      if (mostActive) {
        findings.push(
          lf({
            id: "k-neutral-activity",
            label: "Message Volume",
            detail: `${mostActive[0]} sent the most messages (${mostActive[1]} lines). In a heated argument, the person who types more is usually not the one winning.`,
            severity: "Info",
            confidence: 0.5,
          }),
        );
      }
    }

    findings.push(
      lf({
        id: "k-neutral-verdict",
        label: "Verdict",
        detail: conflictHits.length === 0
          ? "This looks more like a mild disagreement than a full-blown kalesh. Both parties seem reasonably calm."
          : conflictHits.length <= 3
            ? "There's some heat here, but it hasn't fully escalated. A cooling-off period might help."
            : "This is a proper kalesh. Both sides have said things they might regret. Nobody's winning this one.",
        severity: "Info",
        confidence: 0.5,
      }),
    );
  } else if (mode === "gaslight") {
    findings.push(
      lf({
        id: "k-gaslight-overview",
        label: "Gaslight Detector",
        detail: gaslightHits.length > 0
          ? `Detected ${gaslightHits.length} potential gaslighting pattern(s): ${gaslightHits.slice(0, 3).join(", ")}. These phrases are commonly used to undermine someone's perception of reality.`
          : "No common gaslighting phrases detected. This doesn't mean manipulation isn't present — subtle tactics don't always use textbook phrases.",
        severity: gaslightHits.length > 0 ? "Medium" : "Info",
        confidence: 0.5,
        evidence: gaslightHits.slice(0, 3).join(", ") || "No gaslight patterns found.",
      }),
    );

    if (gaslightHits.length > 0) {
      findings.push(
        lf({
          id: "k-gaslight-education",
          label: "What is gaslighting?",
          detail: "Gaslighting is a pattern of manipulation where one person makes another question their own memory, perception, or sanity. Common phrases include 'that never happened', 'you're overreacting', and 'you remembered wrong'.",
          severity: "Info",
          confidence: 0.7,
        }),
      );
    }
  } else if (mode === "exit") {
    const exitScript = speakers.length >= 2
      ? `Hey ${speakers[1]}, I appreciate you sharing your perspective. I think we both need a little space to cool off. Let's revisit this when we're both feeling less heated. I value our relationship more than winning this argument. Talk soon.`
      : `Hey, I think we're both getting a bit heated here. Let's take a step back and revisit this when we've had some time to think. I'd rather find a solution than keep going back and forth. Catch you later.`;

    findings.push(
      lf({
        id: "k-exit-script",
        label: "The Exit Script",
        detail: "Here's your calm, dignified exit strategy. The goal is to de-escalate without admitting defeat or escalating further.",
        severity: "Info",
        confidence: 0.6,
        copiableText: exitScript,
      }),
    );

    copiableOutputs.push(exitScript);
  }

  const metrics: Record<string, string | number> = {
    speakersDetected: speakers.length,
    conflictIndicators: conflictHits.length,
    gaslightPatterns: gaslightHits.length,
    escalationMarkers: escalationHits.length,
    passiveAggression: passiveHits.length,
    wordCount: words,
    analysisMode: mode,
  };

  const notes = [
    "PII redaction should be applied before sharing screenshots externally.",
    "This analysis is based on text patterns and does not constitute psychological assessment.",
    "Results are humorous and should not be taken as professional relationship advice.",
    "For serious concerns about manipulation or abuse, please contact a professional.",
  ];

  return {
    summary: `Kalesh analyzed in "${mode === "neutral" ? "Neutral Ground" : mode === "gaslight" ? "Gaslight Detector" : "The Exit Script"}" mode. ${speakers.length} speaker(s), ${conflictHits.length} conflict indicators, ${gaslightHits.length} gaslight pattern(s) detected.`,
    metrics,
    findings,
    notes,
  };
};

/* =====================================================================
   PASSIVE AGGRESSIVE GENERATOR
   ===================================================================== */

const PA_TEMPLATES: Record<string, { prefix: string; suffix: string; style: string }> = {
  corporate: {
    prefix: "Per my last communication,",
    suffix: "Going forward, I would appreciate it if we could align on this matter at your earliest convenience. Please don't hesitate to reach out if you need further clarification.",
    style: "Corporate",
  },
  roast: {
    prefix: "Oh, you sweet summer child,",
    suffix: "But hey, at least you're consistent. That's... something. Let me know when you're ready to actually address this.",
    style: "Roast",
  },
  polite: {
    prefix: "I hope this message finds you well!",
    suffix: "Thank you so much for your understanding on this. I really appreciate your time and attention to this matter. Wishing you a wonderful day!",
    style: "Polite",
  },
};

const passiveAggressiveAnalyzer: Handler = (text, config) => {
  const mode = (config.generationMode as string) ?? "corporate";
  const template = PA_TEMPLATES[mode] ?? PA_TEMPLATES.corporate;

  /* Analyze the input message for intensity */
  const low = text.toLowerCase();
  const intensityKeywords = ["always", "never", "stupid", "hate", "worst", "terrible", "annoying", "useless", "pathetic", "seriously"];
  const intensityHits = intensityKeywords.filter((k) => low.includes(k));
  const intensity = Math.min(5, 1 + intensityHits.length);

  /* Detect the core complaint */
  const complaintPatterns = [
    /(?:stop|please stop|why do you)\s+(.+)/i,
    /(?:you|y'all|everyone)\s+(?:always|never)\s+(.+)/i,
    /(?:i (?:wish|need|want))\s+(?:you|y'all)\s+(?:would|to)\s+(.+)/i,
    /(?:it(?:'s| is) (?:so |really |extremely ))?(?:annoying|frustrating|terrible|stupid|ridiculous)\s+(?:when|that)\s+(.+)/i,
  ];

  let coreComplaint = "the situation at hand";
  for (const pattern of complaintPatterns) {
    const match = text.match(pattern);
    if (match) {
      coreComplaint = match[0].trim();
      break;
    }
  }

  /* Generate output based on mode */
  let generated: string;
  if (mode === "corporate") {
    generated = `${template.prefix}\n\nI wanted to gently circle back on ${coreComplaint}. While I understand that perspectives may differ on this matter, I believe a more aligned approach would benefit all stakeholders going forward.\n\nI would kindly request that we schedule a brief alignment session to ensure we are operating from the same page.\n\n${template.suffix}`;
  } else if (mode === "roast") {
    generated = `${template.prefix}\n\nSo about ${coreComplaint}... I just have to say — that's truly one of the decisions of all time. Really groundbreaking stuff there. I'm sure nobody saw this coming except literally everyone.\n\nBut please, do go on. I'm absolutely fascinated by this approach.\n\n${template.suffix}`;
  } else {
    generated = `${template.prefix}\n\nI just wanted to share a tiny little thought about ${coreComplaint}! No pressure at all, but if we could maybe, possibly, think about doing things differently, that would be absolutely amazing! 🙏\n\nI totally get it though — we're all doing our best and that's what matters most! 💕\n\n${template.suffix}`;
  }

  const findings: LabFinding[] = [
    lf({
      id: "pa-generated",
      label: `Generated (${template.style} mode)`,
      detail: `Your passive-aggressive message has been crafted with ${intensity}/5 intensity. The original message contained ${intensityHits.length} intensity keyword(s).`,
      severity: "Info",
      confidence: 0.6,
      evidence: `Core complaint: ${coreComplaint}`,
      copiableText: generated,
    }),
    lf({
      id: "pa-analysis",
      label: "Message Analysis",
      detail: `Detected ${intensityHits.length} intensity keyword(s). ${intensity >= 3 ? "This is a high-frustration message — the passive-aggressive output matches that energy." : "This is a moderate complaint — the output keeps it breezy."}`,
      severity: "Info",
      confidence: 0.5,
      evidence: intensityHits.slice(0, 3).join(", ") || "No high-intensity keywords detected.",
    }),
  ];

  const metrics: Record<string, string | number> = {
    mode,
    intensity,
    wordCount: countWords(text),
    intensityKeywords: intensityHits.length,
  };

  const notes = [
    "The perfect tool for when 'per my last email' just isn't enough.",
    "Generated messages are for entertainment purposes. Use your own judgment before sending.",
    "No real emails, texts, or messages are stored or transmitted.",
  ];

  return {
    summary: `Generated a ${template.style.toLowerCase()}-style passive-aggressive message (${intensity}/5 intensity).`,
    metrics,
    findings,
    notes,
  };
};

/* =====================================================================
   EXISTING HANDLERS (unchanged)
   ===================================================================== */

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

const metadataInspector: Handler = requireText(() => {
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

/* =====================================================================
   HANDLERS MAP
   ===================================================================== */

const HANDLERS: Record<string, Handler> = {
  /* New: Labs-1 phase */
  "dream-ai-analyzer": dreamAnalyzer,
  "kalesh-analyzer": kaleshAnalyzer,
  "passive-aggressive-generator": passiveAggressiveAnalyzer,
  /* social-escape-assistant: Coming Soon — no handler needed */

  /* Existing labs */
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

  /* Coming Soon labs should not be processed */
  if (def.comingSoon) {
    return {
      labSlug: payload.labSlug,
      labName: def.name,
      version: "v0",
      status: "COMING_SOON",
      isolated: true,
      generatedAt: new Date().toISOString(),
      inputType: "none",
      summary: `${def.name} is coming soon. Join the waitlist to be notified when it launches.`,
      metrics: { implemented: 0 },
      findings: [
        lf({
          id: "coming-soon",
          label: "Coming Soon",
          detail: "This lab is under development and not yet available for use.",
          severity: "Info",
          confidence: 1,
        }),
      ],
      notes: ["This lab will be available in a future phase."],
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

  let result: {
    summary: string;
    metrics: Record<string, string | number>;
    findings: LabFinding[];
    notes: string[];
    similarDreams?: import("@/lib/engine/types").SimilarDreamInfo;
    followUp?: DreamFollowUp;
  };
  if (!handler) {
    result = {
      summary: `${def.name} is registered but has no lab logic in this phase.`,
      metrics: { implemented: 0 },
      findings: [lf({ id: "no-logic", label: "No lab logic wired", detail: "The lab definition exists but logic is pending.", severity: "Low", confidence: 1 })],
      notes: ["Lab outputs are isolated and do not affect production audits."],
    };
  } else {
    result = await handler(text, (payload.config ?? {}) as Record<string, string | number | boolean>);
  }

  const output: LabOutput = {
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

  /* Pass through dream-specific fields if present */
  if (result.similarDreams) {
    output.similarDreams = result.similarDreams;
  }
  if (result.followUp) {
    output.followUp = result.followUp;
  }

  return output;
}
