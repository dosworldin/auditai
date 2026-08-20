/**
 * AI Provider Abstraction Layer
 *
 * DeepSeek = primary reasoning provider
 * Gemini = configurable fallback
 *
 * All provider settings are controlled by Admin via admin_settings.
 * API keys are read from environment variables, never hardcoded.
 */

export type AIProvider = "deepseek" | "gemini";

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** Provider override — if not set, uses admin-configured primary with fallback */
  provider?: AIProvider;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  fallbackUsed: boolean;
  error?: string;
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
}

/**
 * Get the configured AI provider from admin settings.
 * Reads from environment variables for API keys.
 */
function getProviderConfig(provider: AIProvider): AIProviderConfig | null {
  switch (provider) {
    case "deepseek": {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) return null;
      return {
        provider: "deepseek",
        apiKey,
        baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        maxTokens: 4096,
      };
    }
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return null;
      return {
        provider: "gemini",
        apiKey,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
        maxTokens: 4096,
      };
    }
    default:
      return null;
  }
}

/**
 * Call DeepSeek API.
 */
async function callDeepSeek(
  config: AIProviderConfig,
  request: AIRequest,
): Promise<AIResponse> {
  const startTime = Date.now();

  const body = {
    model: config.model,
    messages: [
      ...(request.systemPrompt
        ? [{ role: "system" as const, content: request.systemPrompt }]
        : []),
      { role: "user" as const, content: request.prompt },
    ],
    max_tokens: request.maxTokens ?? config.maxTokens,
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
      provider: "deepseek",
      model: config.model,
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
      fallbackUsed: false,
      error: `DeepSeek API error ${res.status}: ${errorText}`,
    };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed = data.usage?.total_tokens ?? 0;

  return {
    content,
    provider: "deepseek",
    model: config.model,
    tokensUsed,
    latencyMs: Date.now() - startTime,
    fallbackUsed: false,
  };
}

/**
 * Call Gemini API.
 */
async function callGemini(
  config: AIProviderConfig,
  request: AIRequest,
): Promise<AIResponse> {
  const startTime = Date.now();

  const contents = [
    ...(request.systemPrompt
      ? [{ role: "user" as const, parts: [{ text: request.systemPrompt }] }]
      : []),
    { role: "user" as const, parts: [{ text: request.prompt }] },
  ];

  const res = await fetch(
    `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? config.maxTokens,
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
      provider: "gemini",
      model: config.model,
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
      fallbackUsed: false,
      error: `Gemini API error ${res.status}: ${errorText}`,
    };
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0;

  return {
    content,
    provider: "gemini",
    model: config.model,
    tokensUsed,
    latencyMs: Date.now() - startTime,
    fallbackUsed: false,
  };
}

/**
 * Get the primary and fallback providers from admin settings.
 * Falls back to hardcoded defaults if settings not configured.
 */
export async function getAIProviders(): Promise<{
  primary: AIProvider;
  fallback: AIProvider;
}> {
  // Default: DeepSeek primary, Gemini fallback
  // In production, read from admin_settings table
  return {
    primary: (process.env.AI_PRIMARY_PROVIDER as AIProvider) || "deepseek",
    fallback: (process.env.AI_FALLBACK_PROVIDER as AIProvider) || "gemini",
  };
}

/**
 * Send a request to the AI provider with automatic fallback.
 *
 * Flow:
 * 1. Try primary provider (DeepSeek)
 * 2. If primary fails, try fallback (Gemini)
 * 3. If both fail, return error response
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const { primary, fallback } = await getAIProviders();
  const targetProvider = request.provider ?? primary;

  // Try primary
  const primaryConfig = getProviderConfig(targetProvider);
  if (primaryConfig) {
    const response = targetProvider === "deepseek"
      ? await callDeepSeek(primaryConfig, request)
      : await callGemini(primaryConfig, request);

    if (!response.error) return response;

    // Primary failed — try fallback if different
    if (targetProvider !== fallback) {
      console.warn(`AI primary (${targetProvider}) failed: ${response.error}. Trying fallback (${fallback}).`);
    }
  } else {
    console.warn(`AI primary provider (${targetProvider}) not configured (missing API key).`);
  }

  // Try fallback
  if (fallback !== targetProvider) {
    const fallbackConfig = getProviderConfig(fallback);
    if (fallbackConfig) {
      const response = fallback === "deepseek"
        ? await callDeepSeek(fallbackConfig, request)
        : await callGemini(fallbackConfig, request);

      if (!response.error) {
        response.fallbackUsed = true;
        return response;
      }

      console.warn(`AI fallback (${fallback}) also failed: ${response.error}`);
    }
  }

  // Both failed
  return {
    content: "",
    provider: targetProvider,
    model: "none",
    tokensUsed: 0,
    latencyMs: 0,
    fallbackUsed: false,
    error: "AI providers unavailable. Please configure DEEPSEEK_API_KEY or GEMINI_API_KEY in environment variables.",
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
