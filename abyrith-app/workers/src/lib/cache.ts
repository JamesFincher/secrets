/**
 * Cache Layer for Scraped Documentation
 *
 * Uses Cloudflare KV to cache scraped documentation for 24 hours.
 * Reduces FireCrawl API costs and improves response times.
 */

import type { ScrapedServiceData, CachedScrapeData, ServiceUrls } from '../types/firecrawl';

const CACHE_TTL = 86400; // 24 hours in seconds
const CACHE_PREFIX = 'firecrawl';

/**
 * Generate cache key for service documentation
 */
function getCacheKey(serviceName: string, urlType: 'pricing' | 'guide' | 'api'): string {
  return `${CACHE_PREFIX}:${serviceName.toLowerCase()}:${urlType}`;
}

/**
 * Get cached scraped data for a service
 */
export async function getCachedScrapedData(
  serviceName: string,
  kv: KVNamespace
): Promise<ScrapedServiceData | null> {
  const pricingKey = getCacheKey(serviceName, 'pricing');
  const guideKey = getCacheKey(serviceName, 'guide');
  const apiKey = getCacheKey(serviceName, 'api');

  // Fetch all cached data in parallel
  const [pricingCache, guideCache, apiCache] = await Promise.all([
    kv.get<CachedScrapeData>(pricingKey, 'json'),
    kv.get<CachedScrapeData>(guideKey, 'json'),
    kv.get<CachedScrapeData>(apiKey, 'json')
  ]);

  // If any cache miss, return null (will trigger full scrape)
  if (!pricingCache || !guideCache || !apiCache) {
    return null;
  }

  return {
    serviceName,
    pricing: pricingCache.markdown,
    gettingStarted: guideCache.markdown,
    apiReference: apiCache.markdown,
    scrapedAt: pricingCache.scrapedAt,
    urls: pricingCache.urls
  };
}

/**
 * Cache scraped data for a service
 */
export async function cacheScrapedData(
  serviceName: string,
  data: ScrapedServiceData,
  kv: KVNamespace
): Promise<void> {
  const pricingKey = getCacheKey(serviceName, 'pricing');
  const guideKey = getCacheKey(serviceName, 'guide');
  const apiKey = getCacheKey(serviceName, 'api');

  // Store each piece separately for granular cache control
  await Promise.all([
    kv.put(pricingKey, JSON.stringify({
      markdown: data.pricing,
      scrapedAt: data.scrapedAt,
      urls: data.urls
    }), { expirationTtl: CACHE_TTL }),

    kv.put(guideKey, JSON.stringify({
      markdown: data.gettingStarted,
      scrapedAt: data.scrapedAt,
      urls: data.urls
    }), { expirationTtl: CACHE_TTL }),

    kv.put(apiKey, JSON.stringify({
      markdown: data.apiReference,
      scrapedAt: data.scrapedAt,
      urls: data.urls
    }), { expirationTtl: CACHE_TTL })
  ]);
}

/**
 * Invalidate cache for a service
 */
export async function invalidateServiceCache(
  serviceName: string,
  kv: KVNamespace
): Promise<void> {
  const keys = [
    getCacheKey(serviceName, 'pricing'),
    getCacheKey(serviceName, 'guide'),
    getCacheKey(serviceName, 'api')
  ];

  await Promise.all(keys.map(key => kv.delete(key)));
}

/**
 * Check if cache exists for a service (without fetching)
 */
export async function hasCachedData(
  serviceName: string,
  kv: KVNamespace
): Promise<boolean> {
  const pricingKey = getCacheKey(serviceName, 'pricing');

  // Just check if pricing key exists (if it exists, others should too)
  const metadata = await kv.getWithMetadata(pricingKey);
  return metadata.value !== null;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(
  kv: KVNamespace
): Promise<{
  totalKeys: number;
  services: string[];
}> {
  // List all keys with our prefix
  const list = await kv.list({ prefix: CACHE_PREFIX });

  // Extract unique service names
  const services = new Set<string>();
  for (const key of list.keys) {
    const parts = key.name.split(':');
    if (parts.length >= 2) {
      services.add(parts[1]); // Service name is second part
    }
  }

  return {
    totalKeys: list.keys.length,
    services: Array.from(services)
  };
}

/**
 * Cache a single URL scrape result
 * Used for ad-hoc URL scraping (not service-based)
 */
export async function cacheSingleUrl(
  url: string,
  markdown: string,
  kv: KVNamespace
): Promise<void> {
  // Hash URL to create cache key
  const urlHash = await hashString(url);
  const key = `${CACHE_PREFIX}:url:${urlHash}`;

  await kv.put(key, JSON.stringify({
    url,
    markdown,
    scrapedAt: new Date().toISOString()
  }), { expirationTtl: CACHE_TTL });
}

/**
 * Get cached single URL scrape result
 */
export async function getCachedUrl(
  url: string,
  kv: KVNamespace
): Promise<{ markdown: string; scrapedAt: string } | null> {
  const urlHash = await hashString(url);
  const key = `${CACHE_PREFIX}:url:${urlHash}`;

  const cached = await kv.get<{ url: string; markdown: string; scrapedAt: string }>(key, 'json');
  if (!cached) return null;

  return {
    markdown: cached.markdown,
    scrapedAt: cached.scrapedAt
  };
}

/**
 * Hash a string using SHA-256
 * Used for creating cache keys from URLs
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // First 16 chars for shorter keys
}
