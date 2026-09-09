/**
 * AI Provider Abstraction Layer — admin-controlled provider chain.
 *
 * The chain is stored in admin_settings under `ai_provider_chain`:
 *   [{ id, name, type: "builtin"|"custom", baseUrl, model, apiKeyEnv, apiKey, enabled }]
 *
 * Order = priority. On any failure (error, rate limit, quota exhaustion)
 * the request automatically falls through to the next provider in the
 * chain, and finally to the built-in DeepSeek / Gemini env-based configs.
 * The built-ins are always appended as a last-resort safety net.
 *
 * Admin can add unlimited custom OpenAI-compatible providers and arrange
 * the failover order — nothing is hardcoded in the request path.
 */

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  fallbackUsed: boolean;
  error?: string;
}

export interface ChainProvider {
  id: string;
  name: string;
  type: "builtin" | "custom";
  /** For custom (OpenAI-compatible) providers */
  baseUrl?: string;
  model?: string;
  /** Optional: env var name that holds the API key (preferred) */
  apiKeyEnv?: string;
  /** Optional: API key stored directly in admin_settings (masked in UI) */
  apiKey?: string;
  enabled?: boolean;
}

interface ResolvedConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** "openai" = OpenAI-compatible /chat/completions, "gemini" = Google generateContent */
  api: "openai" | "gemini";
}

/** Default admin_settings value for ai_provider_chain */
export const DEFAULT_PROVIDER_CHAIN: ChainProvider[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    type: "builtin",
    enabled: true,
  },
];

/** Error matchers that mean "provider limit exhausted / rate limited" — skip to next */
const DEFAULT_LIMIT_MATCHERS = [
  "429",
  "rate limit",
  "ratelimit",
  "quota",
  "insufficient",
  "exceeded",
  "limit reached",
  "billing",
  "balance",
];

function getLimitMatchers(): string[] {
  // Admin can override via admin_settings (ai_limit_matchers: string or string[]).
  // Loaded lazily to keep this module server-only and dependency-light; the
  // admin chain read already touches the DB, so we piggyback a cached copy.
  if (cachedLimitMatchers) return cachedLimitMatchers;
  const raw = process.env.AI_LIMIT_ERROR_MATCHERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(String);
    } catch {
      // fall through to defaults
    }
  }
  return DEFAULT_LIMIT_MATCHERS;
}

let cachedLimitMatchers: string[] | null = null;

function isLimitError(errorText: string): boolean {
  const low = errorText.toLowerCase();
  return getLimitMatchers().some((m) => low.includes(m.toLowerCase()));
}

/** Read the admin-managed chain. In route handlers this hits admin_settings
 *  directly via the service-role client; falls back to env config when the
 *  DB is unavailable. */
async function getAdminChain(): Promise<ChainProvider[]> {
  try {
    const { getSupabaseAdmin } = await import("@/lib/db/supabase-server");
    const supabase = await getSupabaseAdmin();
    const { data } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["ai_provider_chain", "ai_limit_matchers"]);

    const rows = (data ?? []) as { key: string; value: unknown }[];

    const matchersRow = rows.find((r) => r.key === "ai_limit_matchers");
    if (matchersRow) {
      if (Array.isArray(matchersRow.value) && matchersRow.value.length > 0) {
        cachedLimitMatchers = matchersRow.value.map(String);
      } else if (typeof matchersRow.value === "string" && matchersRow.value.trim()) {
        cachedLimitMatchers = matchersRow.value.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    const chainRow = rows.find((r) => r.key === "ai_provider_chain");
    if (chainRow?.value && Array.isArray(chainRow.value) && chainRow.value.length > 0) {
      return chainRow.value as ChainProvider[];
    }
  } catch {
    // DB not reachable — fall back to env-only builtins
  }
  // Env-based fallback chain (legacy behaviour)
  const envChain: ChainProvider[] = [];
  const primary = process.env.AI_PRIMARY_PROVIDER;
  const fallback = process.env.AI_FALLBACK_PROVIDER;
  if (primary) envChain.push({ id: primary, name: primary, type: "builtin", enabled: true });
  if (fallback && fallback !== primary) {
    envChain.push({ id: fallback, name: fallback, type: "builtin", enabled: true });
  }
  return envChain;
}

function resolveApiKey(entry: ChainProvider): string | null {
  // 1. explicit env var name wins
  if (entry.apiKeyEnv) {
    const v = process.env[entry.apiKeyEnv];
    if (v) return v;
  }
  // 2. key stored in the setting itself (admin convenience)
  if (entry.apiKey) return entry.apiKey;
  // 3. builtin fallbacks
  if (entry.id === "deepseek" && process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  if (entry.id === "gemini" && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return null;
}

function resolveConfig(entry: ChainProvider): ResolvedConfig | null {
  const apiKey = resolveApiKey(entry);
  if (!apiKey) return null;

  if (entry.type === "custom") {
    if (!entry.baseUrl || !entry.model) return null;
    return {
      id: entry.id,
      name: entry.name,
      apiKey,
      baseUrl: entry.baseUrl.replace(/\/+$/, ""),
      model: entry.model,
      api: "openai",
    };
  }

  // Builtins
  if (entry.id === "deepseek") {
    return {
      id: "deepseek",
      name: "DeepSeek",
      apiKey,
      baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, ""),
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      api: "openai",
    };
  }
  if (entry.id === "gemini") {
    return {
      id: "gemini",
      name: "Gemini",
      apiKey,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      api: "gemini",
    };
  }
  // Unknown builtin id with no baseUrl — cannot be resolved
  return null;
}

/** Ordered provider list: admin chain first, then builtin safety net. */
async function buildProviderOrder(): Promise<ChainProvider[]> {
  const chain = await getAdminChain();
  const enabled = chain.filter((c) => c.enabled !== false);

  const order: ChainProvider[] = [...enabled];

  // Always append builtins as last-resort if not already present
  for (const b of ["deepseek", "gemini"] as const) {
    const already = order.some((c) => c.id === b && c.type === "builtin");
    if (!already) order.push({ id: b, name: b, type: "builtin", enabled: true });
  }

  return order;
}

async function callOpenAICompatible(
  config: ResolvedConfig,
  request: AIRequest,
): Promise<AIResponse> {
  const startTime = Date.now();
  const body = {
    model: config.model,
    messages: [
      ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
      { role: "user", content: request.prompt },
    ],
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.7,
  };

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    return {
      content: "",
      provider: config.id,
      model: config.model,
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
      fallbackUsed: false,
      error: `${config.name} API error ${res.status}: ${errorText.slice(0, 300)}`,
    };
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    provider: config.id,
    model: config.model,
    tokensUsed: data.usage?.total_tokens ?? 0,
    latencyMs: Date.now() - startTime,
    fallbackUsed: false,
  };
}

async function callGemini(
  config: ResolvedConfig,
  request: AIRequest,
): Promise<AIResponse> {
  const startTime = Date.now();
  const contents = [
    ...(request.systemPrompt ? [{ role: "user", parts: [{ text: request.systemPrompt }] }] : []),
    { role: "user", parts: [{ text: request.prompt }] },
  ];

  const res = await fetch(
    `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    return {
      content: "",
      provider: config.id,
      model: config.model,
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
      fallbackUsed: false,
      error: `${config.name} API error ${res.status}: ${errorText.slice(0, 300)}`,
    };
  }

  const data = await res.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    provider: config.id,
    model: config.model,
    tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
    latencyMs: Date.now() - startTime,
    fallbackUsed: false,
  };
}

/**
 * Send a request through the admin-configured provider chain.
 *
 * For each provider in priority order:
 *  - config missing (no API key / bad URL) → skip to next
 *  - request fails with a LIMIT-type error (429 / quota / rate limit) → skip to next
 *  - request fails with any other error → also skip to next (resilient)
 * First success wins. If every provider fails, return the last error.
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const order = await buildProviderOrder();
  let lastError = "No AI providers configured.";

  for (let i = 0; i < order.length; i++) {
    const entry = order[i];
    const config = resolveConfig(entry);
    if (!config) {
      lastError = `${entry.name}: not configured (missing API key${entry.type === "custom" ? " or baseUrl/model" : ""}).`;
      continue;
    }

    let response: AIResponse;
    try {
      response =
        config.api === "gemini"
          ? await callGemini(config, request)
          : await callOpenAICompatible(config, request);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      response = {
        content: "",
        provider: config.id,
        model: config.model,
        tokensUsed: 0,
        latencyMs: 0,
        fallbackUsed: false,
        error: `${config.name} request failed: ${msg.slice(0, 300)}`,
      };
    }

    if (!response.error) {
      response.fallbackUsed = i > 0;
      return response;
    }

    lastError = response.error;
    const kind = isLimitError(response.error) ? "limit exhausted" : "error";
    console.warn(
      `AI provider ${config.id} ${kind} — failing over${i < order.length - 1 ? " to next provider" : ""}: ${response.error.slice(0, 200)}`,
    );
  }

  return {
    content: "",
    provider: "none",
    model: "none",
    tokensUsed: 0,
    latencyMs: 0,
    fallbackUsed: false,
    error: `AI providers unavailable. ${lastError}`,
  };
}

/**
 * Simple AI text generation helper.
 */
export async function generateText(
  prompt: string,
  options?: { systemPrompt?: string; temperature?: number; maxTokens?: number },
): Promise<string> {
  const response = await callAI({
    prompt,
    systemPrompt: options?.systemPrompt,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  });

  if (response.error) {
    throw new Error(response.error);
  }

  return response.content;
}
