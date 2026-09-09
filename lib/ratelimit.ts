/**
 * Lightweight in-memory rate limiter (sliding window).
 *
 * Scope note: on serverless (Vercel) each lambda instance keeps its own
 * counters, so limits are approximate across instances. This is intentional —
 * it is a synchronous, zero-dependency abuse guard for heavy endpoints
 * (AI runs, uploads, ticket creation) and does not require Redis/BullMQ.
 * If stricter global limits are ever needed, swap the store for Upstash
 * Redis behind the same interface.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Prune old buckets periodically to avoid unbounded memory growth.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 60 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Check and record a hit for `key`. Allows at most `limit` hits per
 * `windowMs`. Call before doing expensive work.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  const windowStart = now - windowMs;

  // Drop hits outside the window
  while (bucket.hits.length > 0 && bucket.hits[0] < windowStart) {
    bucket.hits.shift();
  }

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    ok: true,
    remaining: limit - bucket.hits.length,
    retryAfterSec: 0,
  };
}

/** Standard 429 response for rate-limited requests. */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: `Too many requests. Please try again in ${result.retryAfterSec}s.`,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(result.retryAfterSec),
      },
    },
  );
}
