# FireCrawl Integration - Implementation Guide

## Overview

This integration provides documentation scraping capabilities for the Abyrith AI Assistant. It allows the system to scrape API documentation in real-time, enabling up-to-date guidance for API key acquisition.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Request                          │
│  POST /api/v1/scrape { service: "stripe" }                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Scrape Handler (Rate Limited)                  │
│  - Validates auth token                                     │
│  - Checks rate limit (1 req/30s per user)                  │
│  - Routes to documentation scraper                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Documentation Scraper Service                    │
│  1. Check KV cache for existing data                       │
│  2. If cached → return immediately                         │
│  3. If not cached → proceed to scraping                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Service URL Mapper                          │
│  - Maps service name to doc URLs                           │
│  - Returns: pricing, gettingStarted, apiReference          │
│  - Falls back to URL guessing for unknown services         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  URL Validator (SSRF Protection)            │
│  - Validates all URLs before scraping                      │
│  - Blocks private IPs, localhost, cloud metadata           │
│  - Performs DNS resolution check                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  FireCrawl API Client                       │
│  - Scrapes 3 URLs in parallel                              │
│  - Converts HTML to markdown                               │
│  - Includes retry logic (exponential backoff)              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cache Layer (KV)                         │
│  - Stores results for 24 hours                             │
│  - Separate keys for pricing/guide/api                     │
│  - Provides fallback on FireCrawl failure                  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. FireCrawl Client (`services/firecrawl.ts`)

**Purpose:** Wrapper around FireCrawl API with error handling and retries.

**Key Methods:**
- `scrapeUrl(url, options)` - Scrape single URL
- `scrapeMultiple(urls, options)` - Scrape multiple URLs in parallel
- `extractWithLLM(url, prompt, schema)` - Extract structured data using LLM

**Features:**
- Automatic retries with exponential backoff
- URL validation before scraping (SSRF protection)
- Configurable timeout (default: 30s)
- Proper error handling

### 2. URL Validator (`lib/url-validator.ts`)

**Purpose:** SSRF protection - prevents scraping of internal/private resources.

**Blocked Targets:**
- Private IP ranges (10.x, 192.168.x, 172.16-31.x)
- Localhost (127.x, ::1)
- Link-local IPs (169.254.x - AWS/GCP metadata endpoints)
- Non-HTTP protocols (file://, ftp://, etc.)

**Features:**
- DNS resolution check
- Prevents DNS rebinding attacks
- Fast validation (<100ms typical)

### 3. Cache Layer (`lib/cache.ts`)

**Purpose:** Minimize FireCrawl API costs and improve response times.

**Strategy:**
- 24-hour TTL for all cached data
- Separate KV keys for pricing/guide/api sections
- Graceful fallback on cache miss
- Cache hit returns instantly

**Key Functions:**
- `getCachedScrapedData(service, kv)` - Retrieve cached service docs
- `cacheScrapedData(service, data, kv)` - Store service docs
- `invalidateServiceCache(service, kv)` - Force refresh
- `getCachedUrl(url, kv)` - Get cached single URL result

### 4. Service URL Mapper (`lib/service-urls.ts`)

**Purpose:** Map service names to documentation URLs.

**Supported Services (21 predefined):**
- OpenAI, Anthropic, Stripe, SendGrid, Resend
- AWS, Twilio, GitHub, Vercel, Cloudflare
- Supabase, Google Maps, Google Cloud
- Mailgun, Postmark, Algolia, Auth0
- MongoDB, PlanetScale, Railway

**Features:**
- Exact match lookup
- Fuzzy search capability
- Automatic URL guessing for unknown services

### 5. Documentation Scraper (`services/documentation-scraper.ts`)

**Purpose:** High-level orchestration of scraping workflow.

**Key Functions:**
- `scrapeServiceDocs(service, client, kv, options)` - Full service scrape
- `scrapeSingleUrl(url, client, kv, options)` - Ad-hoc URL scrape
- `forceRefreshService(service, client, kv)` - Bypass cache
- `extractPricingInfo(url, client)` - LLM-based pricing extraction

### 6. Scrape Handler (`handlers/scrape.ts`)

**Purpose:** HTTP endpoint handler with rate limiting.

**Endpoint:** `POST /api/v1/scrape`

**Rate Limit:** 1 request per 30 seconds per user

**Request Body:**
```typescript
{
  service?: string;      // e.g., "stripe"
  url?: string;          // e.g., "https://stripe.com/docs/api"
  forceRefresh?: boolean; // Bypass cache
}
```

**Response:**
```typescript
{
  success: boolean;
  data?: {
    markdown: string;   // Scraped documentation
    cached: boolean;    // Whether from cache
    scrapedAt: string;  // ISO timestamp
  };
  error?: string;
}
```

## Setup

### 1. Environment Variables

Create `.dev.vars` file:

```bash
FIRECRAWL_API_KEY=fc_sk_your_api_key_here
FIRECRAWL_ENDPOINT=https://api.firecrawl.dev/v0
FIRECRAWL_TIMEOUT=30000
FIRECRAWL_MAX_RETRIES=3
```

### 2. KV Namespaces

Configure in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "your_cache_kv_namespace_id"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your_rate_limit_kv_namespace_id"
```

Create namespaces:

```bash
wrangler kv:namespace create "CACHE_KV"
wrangler kv:namespace create "RATE_LIMIT_KV"
```

### 3. Install Dependencies

Already included in the workers package.json. No additional dependencies needed.

## Usage Examples

### Example 1: Scrape Service Documentation

```bash
curl -X POST https://api.abyrith.com/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "service": "stripe"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# stripe Documentation\n\n## Pricing\n...",
    "cached": false,
    "scrapedAt": "2025-11-02T10:30:00Z"
  }
}
```

### Example 2: Scrape Single URL

```bash
curl -X POST https://api.abyrith.com/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "url": "https://platform.openai.com/docs/api-reference/chat"
  }'
```

### Example 3: Force Refresh (Bypass Cache)

```bash
curl -X POST https://api.abyrith.com/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "service": "openai",
    "forceRefresh": true
  }'
```

### Example 4: Using from AI Team

The AI team can integrate this into their conversation flow:

```typescript
// In AI conversation handler
import { scrapeServiceDocs } from '../services/documentation-scraper';
import { createFireCrawlClient } from '../services/firecrawl';

async function handleUserQuestion(question: string, env: Env) {
  // Detect if user asking about API service
  const serviceName = detectServiceName(question); // e.g., "stripe"

  if (serviceName) {
    // Scrape documentation
    const client = createFireCrawlClient(env);
    const docs = await scrapeServiceDocs(serviceName, client, env.CACHE_KV);

    // Pass to Claude with context
    const response = await callClaude({
      system: "You are helping user get API keys",
      user: question,
      context: {
        pricing: docs.pricing,
        guide: docs.gettingStarted,
        apiReference: docs.apiReference
      }
    });

    return response;
  }
}
```

## Testing

### Manual Testing

1. **Start local development:**
```bash
cd /Users/james/code/secrets/abyrith-app/workers
pnpm run dev
```

2. **Test health endpoint:**
```bash
curl http://localhost:8787/health
```

3. **Test scraping (requires auth token):**
```bash
# Get a test JWT token first (from Supabase)
export TOKEN="your_test_token_here"

# Test service scrape
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"service":"stripe"}'
```

### Integration Testing

```typescript
// Example integration test
import { describe, it, expect } from 'vitest';
import { scrapeServiceDocs } from '../services/documentation-scraper';
import { createFireCrawlClient } from '../services/firecrawl';

describe('FireCrawl Integration', () => {
  it('should scrape and cache service documentation', async () => {
    const client = createFireCrawlClient({
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY!
    });

    const result = await scrapeServiceDocs('stripe', client, mockKV);

    expect(result.serviceName).toBe('stripe');
    expect(result.pricing).toBeTruthy();
    expect(result.gettingStarted).toBeTruthy();
    expect(result.apiReference).toBeTruthy();
  });

  it('should return cached data on second request', async () => {
    // First request - scrapes
    const result1 = await scrapeServiceDocs('stripe', client, mockKV);

    // Second request - should hit cache
    const result2 = await scrapeServiceDocs('stripe', client, mockKV);

    expect(result2.scrapedAt).toBe(result1.scrapedAt);
  });
});
```

## Security Considerations

### SSRF Protection

**All URLs are validated before scraping:**
- ✅ Valid: `https://stripe.com/docs/api`
- ❌ Blocked: `http://localhost:8080`
- ❌ Blocked: `http://192.168.1.1/admin`
- ❌ Blocked: `http://169.254.169.254/metadata` (AWS/GCP)
- ❌ Blocked: `file:///etc/passwd`

### Rate Limiting

**Per-user rate limits:**
- 1 scrape request per 30 seconds
- Prevents abuse and controls costs
- Returns 429 with `Retry-After` header

### Authentication

**All scrape requests require valid JWT:**
- Token validated via Supabase
- User ID extracted for rate limiting
- Unauthorized requests return 401

## Performance

### Typical Response Times

**Cache hit:** <50ms (instant KV lookup)
**Cache miss:** 2-5 seconds (FireCrawl scraping)
**Parallel scraping:** 3-4 seconds (3 URLs)

### Cost Optimization

**FireCrawl credits:**
- Per scrape: 1 credit per URL = 3 credits per service
- Cache TTL: 24 hours
- Estimated monthly cost: $19-39 for 1000 users (with caching)

**Free tier usage:**
- 500 credits/month = ~150 service scrapes
- Sufficient for MVP testing

## Caching Strategy

### Cache Keys

```
firecrawl:stripe:pricing    → Stripe pricing page
firecrawl:stripe:guide      → Stripe getting started guide
firecrawl:stripe:api        → Stripe API reference
firecrawl:url:abc123def     → Single URL (hashed)
```

### Cache TTL

**24 hours** - Balance between freshness and cost

### Cache Invalidation

```typescript
// Force refresh a service
await invalidateServiceCache('stripe', env.CACHE_KV);
```

## Error Handling

### Retriable Errors (with exponential backoff)
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- 408 Timeout

### Non-Retriable Errors (fail immediately)
- 400 Bad Request (invalid URL)
- 401 Unauthorized (invalid API key)
- 403 Forbidden (URL blocked)
- 404 Not Found

### Fallback Strategy

1. Try fresh scrape
2. If fails → return cached data (even if expired)
3. If no cache → return empty response
4. Log error for monitoring

## Integration Points

### For AI Team

**Import and use:**
```typescript
import { scrapeServiceDocs } from '../services/documentation-scraper';
import { createFireCrawlClient } from '../services/firecrawl';

// In your AI handler
const client = createFireCrawlClient(env);
const docs = await scrapeServiceDocs('stripe', client, env.CACHE_KV);

// Pass to Claude
const claudeResponse = await claude.messages.create({
  system: `You have access to these docs:\n${docs.pricing}`,
  messages: [{ role: 'user', content: userQuestion }]
});
```

### For Frontend Team

**API endpoint:**
```typescript
// In your React component
async function fetchServiceDocs(serviceName: string) {
  const response = await fetch('/api/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ service: serviceName })
  });

  const { data } = await response.json();
  return data.markdown;
}
```

## Monitoring

### Key Metrics to Track

- Scrape requests per day
- Cache hit rate (target: >70%)
- FireCrawl API errors
- Average scrape latency
- Rate limit hits per user

### Logging

```typescript
console.log('[DocumentationScraper] Cache hit for service: stripe');
console.log('[DocumentationScraper] Scraping fresh data for service: openai');
console.error('[DocumentationScraper] Error scraping service:', error);
```

## Next Steps

1. **Backend Team:** Configure KV namespaces in production
2. **AI Team:** Integrate scraping into conversation flow
3. **DevOps:** Set up monitoring for FireCrawl usage and errors
4. **Product:** Pre-populate cache for top 10 services

## Support

**Documentation:** `/Users/james/code/secrets/09-integrations/firecrawl/firecrawl-integration.md`

**Issues:** Contact Integration Team Lead

**API Docs:** https://docs.firecrawl.dev/
