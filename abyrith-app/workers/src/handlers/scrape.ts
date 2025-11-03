/**
 * Scrape Endpoint Handler
 *
 * POST /api/scrape - Scrape a URL or service documentation
 * Includes rate limiting (1 request per 30s per user)
 */

import { createFireCrawlClient } from '../services/firecrawl';
import { scrapeServiceDocs, scrapeSingleUrl } from '../services/documentation-scraper';
import type { Env } from '../types/api';

interface ScrapeRequest {
  url?: string;
  service?: string;
  forceRefresh?: boolean;
}

interface ScrapeResponse {
  success: boolean;
  data?: {
    markdown: string;
    cached: boolean;
    scrapedAt: string;
  };
  error?: string;
}

const RATE_LIMIT = {
  maxRequests: 1,
  windowMs: 30000  // 30 seconds
};

/**
 * Check rate limit for user
 */
async function checkRateLimit(userId: string, kv: KVNamespace): Promise<boolean> {
  const key = `rate_limit:scrape:${userId}`;
  const now = Date.now();

  // Get last request timestamp
  const lastRequest = await kv.get(key);
  if (lastRequest) {
    const lastRequestTime = parseInt(lastRequest);
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT.windowMs) {
      // Rate limit exceeded
      return false;
    }
  }

  // Update last request timestamp
  await kv.put(key, now.toString(), {
    expirationTtl: Math.ceil(RATE_LIMIT.windowMs / 1000)
  });

  return true;
}

/**
 * Extract user ID from JWT token
 */
function extractUserId(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // TODO: Properly validate JWT token and extract user ID
  // For now, use a placeholder
  // In production, decode JWT and extract sub claim
  const token = authHeader.substring(7);

  // Temporary: hash the token to create a user identifier
  return `user_${token.substring(0, 16)}`;
}

/**
 * Handle scrape requests
 */
export async function handleScrape(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json() as ScrapeRequest;

    // Validate request
    if (!body.url && !body.service) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Either "url" or "service" must be provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract user ID for rate limiting
    const userId = extractUserId(request);
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limit
    const allowed = await checkRateLimit(userId, env.RATE_LIMIT_KV);
    if (!allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Please wait 30 seconds between scrape requests.'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30'
        }
      });
    }

    // Create FireCrawl client
    const client = createFireCrawlClient(env);

    let response: ScrapeResponse;

    if (body.service) {
      // Scrape service documentation
      console.log(`[ScrapeHandler] Scraping service: ${body.service}`);

      const result = await scrapeServiceDocs(
        body.service,
        client,
        env.CACHE_KV,
        { forceRefresh: body.forceRefresh }
      );

      // Combine all markdown into single response
      const combinedMarkdown = `
# ${result.serviceName} Documentation

## Pricing
${result.pricing}

## Getting Started
${result.gettingStarted}

## API Reference
${result.apiReference}
      `.trim();

      response = {
        success: true,
        data: {
          markdown: combinedMarkdown,
          cached: false, // TODO: Track if from cache
          scrapedAt: result.scrapedAt
        }
      };
    } else if (body.url) {
      // Scrape single URL
      console.log(`[ScrapeHandler] Scraping URL: ${body.url}`);

      const result = await scrapeSingleUrl(
        body.url,
        client,
        env.CACHE_KV
      );

      response = {
        success: true,
        data: {
          markdown: result.markdown,
          cached: result.cached,
          scrapedAt: new Date().toISOString()
        }
      };
    } else {
      // Should never reach here due to validation
      throw new Error('Invalid request');
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[ScrapeHandler] Error:', error);

    const response: ScrapeResponse = {
      success: false,
      error: error.message || 'Failed to scrape documentation'
    };

    return new Response(JSON.stringify(response), {
      status: error.statusCode || 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
