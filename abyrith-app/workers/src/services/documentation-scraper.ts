/**
 * Documentation Scraper Service
 *
 * High-level service for scraping API documentation.
 * Orchestrates FireCrawl client, caching, and URL mapping.
 */

import { FireCrawlClient } from './firecrawl';
import { getServiceUrls, guessServiceUrls } from '../lib/service-urls';
import { getCachedScrapedData, cacheScrapedData, getCachedUrl, cacheSingleUrl } from '../lib/cache';
import type { ScrapedServiceData } from '../types/firecrawl';

export interface ScrapeServiceOptions {
  forceRefresh?: boolean;  // Bypass cache
  useCache?: boolean;      // Use cache (default: true)
}

export interface ScrapeUrlOptions {
  useCache?: boolean;
}

/**
 * Scrape documentation for a service
 * Returns cached data if available, otherwise scrapes fresh
 */
export async function scrapeServiceDocs(
  serviceName: string,
  client: FireCrawlClient,
  kv: KVNamespace,
  options: ScrapeServiceOptions = {}
): Promise<ScrapedServiceData> {
  const { forceRefresh = false, useCache = true } = options;

  // Check cache first (unless force refresh)
  if (useCache && !forceRefresh) {
    const cached = await getCachedScrapedData(serviceName, kv);
    if (cached) {
      console.log(`[DocumentationScraper] Cache hit for service: ${serviceName}`);
      return cached;
    }
  }

  console.log(`[DocumentationScraper] Scraping fresh data for service: ${serviceName}`);

  // Get URLs for this service
  const urls = getServiceUrls(serviceName) || guessServiceUrls(serviceName);

  try {
    // Scrape all URLs in parallel
    const [pricingResult, guideResult, apiRefResult] = await client.scrapeMultiple([
      urls.pricing,
      urls.gettingStarted,
      urls.apiReference
    ]);

    const scrapedData: ScrapedServiceData = {
      serviceName,
      pricing: pricingResult.data?.markdown || '',
      gettingStarted: guideResult.data?.markdown || '',
      apiReference: apiRefResult.data?.markdown || '',
      scrapedAt: new Date().toISOString(),
      urls
    };

    // Cache the results
    if (useCache) {
      await cacheScrapedData(serviceName, scrapedData, kv);
      console.log(`[DocumentationScraper] Cached data for service: ${serviceName}`);
    }

    return scrapedData;
  } catch (error) {
    console.error(`[DocumentationScraper] Error scraping service: ${serviceName}`, error);

    // Try to return cached data as fallback (even if expired)
    const cached = await getCachedScrapedData(serviceName, kv);
    if (cached) {
      console.warn(`[DocumentationScraper] Returning stale cache as fallback for: ${serviceName}`);
      return cached;
    }

    // No cache available, return empty data
    console.error(`[DocumentationScraper] No fallback available for: ${serviceName}`);
    return {
      serviceName,
      pricing: '',
      gettingStarted: '',
      apiReference: '',
      scrapedAt: new Date().toISOString(),
      urls
    };
  }
}

/**
 * Scrape a single URL (not service-based)
 * Useful for ad-hoc documentation scraping
 */
export async function scrapeSingleUrl(
  url: string,
  client: FireCrawlClient,
  kv: KVNamespace,
  options: ScrapeUrlOptions = {}
): Promise<{ url: string; markdown: string; cached: boolean }> {
  const { useCache = true } = options;

  // Check cache first
  if (useCache) {
    const cached = await getCachedUrl(url, kv);
    if (cached) {
      console.log(`[DocumentationScraper] Cache hit for URL: ${url}`);
      return {
        url,
        markdown: cached.markdown,
        cached: true
      };
    }
  }

  console.log(`[DocumentationScraper] Scraping fresh URL: ${url}`);

  try {
    const result = await client.scrapeUrl(url);

    if (!result.success || !result.data?.markdown) {
      throw new Error('Scrape failed or returned no content');
    }

    const markdown = result.data.markdown;

    // Cache the result
    if (useCache) {
      await cacheSingleUrl(url, markdown, kv);
      console.log(`[DocumentationScraper] Cached URL: ${url}`);
    }

    return {
      url,
      markdown,
      cached: false
    };
  } catch (error) {
    console.error(`[DocumentationScraper] Error scraping URL: ${url}`, error);

    // Try to return cached data as fallback
    const cached = await getCachedUrl(url, kv);
    if (cached) {
      console.warn(`[DocumentationScraper] Returning stale cache as fallback for: ${url}`);
      return {
        url,
        markdown: cached.markdown,
        cached: true
      };
    }

    // Re-throw error if no fallback available
    throw error;
  }
}

/**
 * Force refresh service documentation (invalidate cache and scrape)
 */
export async function forceRefreshService(
  serviceName: string,
  client: FireCrawlClient,
  kv: KVNamespace
): Promise<ScrapedServiceData> {
  return scrapeServiceDocs(serviceName, client, kv, { forceRefresh: true });
}

/**
 * Extract pricing information using LLM extraction
 */
export async function extractPricingInfo(
  url: string,
  client: FireCrawlClient
): Promise<any> {
  const extractionPrompt = `
Extract pricing information from this page.

Return JSON with this structure:
{
  "free_tier": "Description of free tier (or null)",
  "paid_tiers": [
    {
      "name": "Tier name",
      "price": "Price (e.g., '$10/month' or 'Pay as you go')",
      "features": ["Feature 1", "Feature 2"]
    }
  ],
  "rate_limits": "Description of rate limits (or null)"
}

Look for sections titled "Pricing", "Plans", or "Cost".
If pricing is usage-based, extract unit costs.
  `.trim();

  const result = await client.extractWithLLM(url, extractionPrompt);
  return result.data;
}
