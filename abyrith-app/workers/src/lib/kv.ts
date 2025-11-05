/**
 * KV Storage Helpers
 *
 * Utilities for working with Cloudflare KV storage
 */

/**
 * Rate limit data structure stored in KV
 */
interface RateLimitData {
  count: number;
  resetAt: number;
}

/**
 * Get rate limit data for a key
 */
export async function getRateLimitData(
  kv: KVNamespace,
  key: string
): Promise<RateLimitData | null> {
  const data = await kv.get(key, 'json');
  return data as RateLimitData | null;
}

/**
 * Set rate limit data with TTL
 */
export async function setRateLimitData(
  kv: KVNamespace,
  key: string,
  data: RateLimitData,
  ttlSeconds: number
): Promise<void> {
  await kv.put(key, JSON.stringify(data), {
    expirationTtl: ttlSeconds,
  });
}

/**
 * Increment rate limit counter atomically
 *
 * Returns the new count and reset timestamp
 */
export async function incrementRateLimit(
  kv: KVNamespace,
  key: string,
  windowMs: number
): Promise<{ count: number; resetAt: number }> {
  const now = Date.now();
  const existing = await getRateLimitData(kv, key);

  // If no existing data or expired, create new window
  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs;
    const data: RateLimitData = { count: 1, resetAt };
    await setRateLimitData(kv, key, data, Math.ceil(windowMs / 1000));
    return data;
  }

  // Increment existing counter
  const data: RateLimitData = {
    count: existing.count + 1,
    resetAt: existing.resetAt,
  };

  // KV requires minimum TTL of 60 seconds
  const ttlSeconds = Math.max(60, Math.ceil((data.resetAt - now) / 1000));
  await setRateLimitData(kv, key, data, ttlSeconds);

  return data;
}

/**
 * Cache data in KV with optional TTL
 */
export async function cacheData<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  ttlSeconds?: number
): Promise<void> {
  const options: KVNamespacePutOptions = {};
  if (ttlSeconds) {
    options.expirationTtl = ttlSeconds;
  }

  await kv.put(key, JSON.stringify(data), options);
}

/**
 * Get cached data from KV
 */
export async function getCachedData<T>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  const data = await kv.get(key, 'json');
  return data as T | null;
}

/**
 * Delete cached data from KV
 */
export async function deleteCachedData(
  kv: KVNamespace,
  key: string
): Promise<void> {
  await kv.delete(key);
}

/**
 * Generate rate limit key for a user/IP
 */
export function generateRateLimitKey(
  identifier: string,
  endpoint?: string
): string {
  const prefix = 'ratelimit';
  if (endpoint) {
    return `${prefix}:${endpoint}:${identifier}`;
  }
  return `${prefix}:${identifier}`;
}

/**
 * Generate cache key
 */
export function generateCacheKey(
  namespace: string,
  ...parts: string[]
): string {
  return `cache:${namespace}:${parts.join(':')}`;
}
