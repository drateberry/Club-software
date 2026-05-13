/**
 * In-memory token bucket per bearer token. Single-process per club today;
 * if/when multi-instance lands, swap the Map for Postgres LISTEN/NOTIFY-
 * synced counters. The Map is module-scoped so it survives across requests
 * within one Next.js process.
 *
 * Buckets:
 *   read   — 120 req/min  (most listing + detail endpoints)
 *   write  — 30 req/min   (mutation endpoints)
 *   strict — 6 req/min    (charge_on_file, bulk_send, run_statements,
 *                          message.send when not already bulk)
 *
 * If a token has no scope matching a bucket, the strictest applicable
 * bucket wins.
 */

export type Bucket = "read" | "write" | "strict";

type State = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, State>();

const CONFIG: Record<Bucket, { capacity: number; refillPerSec: number }> = {
  read: { capacity: 120, refillPerSec: 120 / 60 },
  write: { capacity: 30, refillPerSec: 30 / 60 },
  strict: { capacity: 6, refillPerSec: 6 / 60 },
};

export type RateLimitOutcome =
  | { allowed: true; remaining: number; bucket: Bucket }
  | { allowed: false; retryAfter: number; bucket: Bucket };

export function consume(
  key: string,
  bucket: Bucket,
  cost = 1
): RateLimitOutcome {
  const { capacity, refillPerSec } = CONFIG[bucket];
  const now = Date.now();
  const bucketKey = `${bucket}:${key}`;
  const state = buckets.get(bucketKey) ?? { tokens: capacity, lastRefillMs: now };

  const elapsedSec = Math.max(0, (now - state.lastRefillMs) / 1000);
  state.tokens = Math.min(capacity, state.tokens + elapsedSec * refillPerSec);
  state.lastRefillMs = now;

  if (state.tokens < cost) {
    const deficit = cost - state.tokens;
    const retryAfter = Math.ceil(deficit / refillPerSec);
    buckets.set(bucketKey, state);
    return { allowed: false, retryAfter, bucket };
  }

  state.tokens -= cost;
  buckets.set(bucketKey, state);
  return { allowed: true, remaining: Math.floor(state.tokens), bucket };
}

/**
 * Choose the bucket to use for a request based on HTTP method and the
 * specific path. Defaults: GET → read, POST/PATCH/DELETE → write.
 * Specific high-cost paths drop to `strict`.
 */
export function bucketFor(method: string, path: string): Bucket {
  if (
    path.endsWith("/charge") ||
    path.endsWith("/refund") ||
    path.includes("/bulk") ||
    path.includes("/run-statements") ||
    path.endsWith("/exports")
  ) {
    return "strict";
  }
  if (method === "GET" || method === "HEAD") return "read";
  return "write";
}

export function rateLimitHeaders(outcome: RateLimitOutcome): Record<string, string> {
  const { capacity } = CONFIG[outcome.bucket];
  if (outcome.allowed) {
    return {
      "X-RateLimit-Limit": String(capacity),
      "X-RateLimit-Remaining": String(outcome.remaining),
      "X-RateLimit-Bucket": outcome.bucket,
    };
  }
  return {
    "X-RateLimit-Limit": String(capacity),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Bucket": outcome.bucket,
    "Retry-After": String(outcome.retryAfter),
  };
}

/** For tests. */
export function _resetBuckets() {
  buckets.clear();
}
