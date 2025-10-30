---
Document: FireCrawl API Integration - Integration Guide
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 08-features/ai-assistant/ai-assistant-overview.md, TECH-STACK.md, 06-backend/cloudflare-workers/workers-architecture.md
---

# FireCrawl API Integration

## Overview

FireCrawl is a web scraping service that converts websites into clean, AI-readable markdown format. Abyrith uses FireCrawl to scrape API documentation sites in real-time, enabling the AI Secret Assistant to generate up-to-date, accurate API key acquisition instructions for any service—even those Abyrith has never encountered before.

**External Service:** [FireCrawl](https://firecrawl.dev)

**Integration Type:** REST API integration

**Status:** Active (MVP feature)

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Implementation Details](#implementation-details)
7. [Error Handling](#error-handling)
8. [Caching Strategy](#caching-strategy)
9. [Parsing & Data Extraction](#parsing--data-extraction)
10. [Fallback Mechanisms](#fallback-mechanisms)
11. [Testing](#testing)
12. [Monitoring](#monitoring)
13. [Security Considerations](#security-considerations)
14. [Cost & Rate Limits](#cost--rate-limits)
15. [Troubleshooting](#troubleshooting)
16. [Dependencies](#dependencies)
17. [References](#references)
18. [Change Log](#change-log)

---

## Integration Purpose

### Business Value

**What it enables:**
- Real-time API documentation research for any service
- Always up-to-date acquisition instructions (no manual maintenance)
- Support for unfamiliar APIs on-demand
- Educational content extraction (pricing, features, limits)

**User benefits:**
- Get accurate, current instructions for any API key
- No more outdated tutorials or broken screenshots
- Learn about pricing and features before signing up
- Discover lesser-known APIs with same quality guidance

### Technical Purpose

**Responsibilities:**
- Scrape API documentation pages and convert to markdown
- Extract pricing information from service websites
- Capture getting-started guides and tutorials
- Fetch API reference documentation for service context
- Transform HTML into structured, parseable content

**Integration Points:**
- Called by AI Conversation Orchestrator when user asks about unknown service
- Triggered automatically when generating acquisition flows
- Results cached in Cloudflare Workers KV for 24 hours
- Data passed to Claude API for analysis and instruction generation

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────┐
│          Abyrith AI Assistant                        │
│  User: "I need a Stripe API key"                    │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ 1. User asks about service
                 ▼
┌──────────────────────────────────────────────────────┐
│      Cloudflare Worker                               │
│      (AI Conversation Orchestrator)                  │
│                                                       │
│  1. Detect research intent                           │
│  2. Check KV cache                                   │
│  3. If not cached → Call FireCrawl                   │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ 2. Scrape requests (HTTPS)
                 ▼
┌──────────────────────────────────────────────────────┐
│         FireCrawl API                                │
│         (https://api.firecrawl.dev/v0)               │
│                                                       │
│  - Scrapes target URL                                │
│  - Converts HTML to markdown                         │
│  - Extracts structured data                          │
│  - Returns clean content                             │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ 3. Markdown response
                 ▼
┌──────────────────────────────────────────────────────┐
│      Cloudflare Worker                               │
│      (Parse & Cache)                                 │
│                                                       │
│  1. Parse markdown response                          │
│  2. Extract key information                          │
│  3. Cache in Workers KV (24 hours)                   │
│  4. Pass to Claude API                               │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ 4. Scraped data + user question
                 ▼
┌──────────────────────────────────────────────────────┐
│         Claude API                                   │
│         (Anthropic)                                  │
│                                                       │
│  - Analyzes scraped documentation                    │
│  - Generates acquisition flow                        │
│  - Returns step-by-step instructions                 │
└──────────────────────────────────────────────────────┘
```

### Data Flow

**Outbound (Abyrith → FireCrawl):**
1. User asks about API service (e.g., "How do I get a Stripe key?")
2. Worker detects research intent (keyword matching)
3. Worker determines URLs to scrape (pricing, docs, getting started)
4. Worker checks KV cache for existing scrapes
5. If not cached, Worker calls FireCrawl API for each URL
6. Worker receives markdown responses

**Inbound (FireCrawl → Abyrith):**
1. FireCrawl scrapes target URL
2. Converts HTML to clean markdown
3. Optionally extracts structured data (via LLM extraction)
4. Returns JSON response with markdown content
5. Worker caches response in KV
6. Worker passes markdown to Claude for analysis

### Components Involved

**Frontend:**
- None (FireCrawl is backend-only)

**Backend:**
- `ai-conversation-handler.ts` - Triggers FireCrawl when research needed
- `firecrawl-client.ts` - FireCrawl API client and wrapper
- `service-url-mapper.ts` - Maps service names to documentation URLs
- `scraped-data-parser.ts` - Parses and structures FireCrawl responses
- Cloudflare Workers KV - Caches scraped data for 24 hours

**External:**
- FireCrawl API - Scraping and conversion service

---

## Authentication

### Authentication Method

**Type:** API Key (Bearer token)

**How it works:**
FireCrawl uses a simple API key authentication model. The key is passed as a Bearer token in the `Authorization` header of every request.

### Credentials Management

**Where credentials are stored:**
- **Development:** `.dev.vars` file (Wrangler local development)
- **Staging:** Cloudflare Workers secrets (via Wrangler CLI)
- **Production:** Cloudflare Workers secrets (via Wrangler CLI)

**Credential Format:**
```bash
FIRECRAWL_API_KEY=fc_sk_[random_string]
```

**Security:**
- Never commit API key to Git
- Store in `.env.example` as placeholder (not actual key)
- Use Cloudflare Workers secrets for deployed environments
- Rotate key quarterly or if compromised

### Obtaining Credentials

**Step 1: Sign up for FireCrawl**
- Go to [firecrawl.dev](https://firecrawl.dev)
- Create an account
- Verify email address

**Step 2: Generate API key**
- Navigate to API Keys section in dashboard
- Click "Create API Key"
- Copy the key (starts with `fc_sk_`)
- Store securely (key only shown once)

**Step 3: Configure in Abyrith**

**Local development:**
```bash
# .dev.vars
FIRECRAWL_API_KEY=fc_sk_your_actual_key_here
```

**Staging/Production:**
```bash
# Using Wrangler CLI
wrangler secret put FIRECRAWL_API_KEY
# Paste key when prompted
```

---

## Configuration

### Environment Variables

**Required:**
```bash
FIRECRAWL_API_KEY=                # FireCrawl API key (Bearer token)
FIRECRAWL_ENDPOINT=https://api.firecrawl.dev/v0  # API endpoint
```

**Optional:**
```bash
FIRECRAWL_TIMEOUT=30000           # Request timeout in ms (default: 30s)
FIRECRAWL_MAX_RETRIES=3           # Max retry attempts (default: 3)
FIRECRAWL_CACHE_TTL=86400         # Cache TTL in seconds (default: 24 hours)
```

### Configuration File

**Location:** `src/lib/firecrawl/config.ts`

**Structure:**
```typescript
interface FireCrawlConfig {
  apiKey: string;
  endpoint: string;
  timeout: number;
  maxRetries: number;
  cacheTTL: number;
}
```

**Example:**
```typescript
// src/lib/firecrawl/config.ts
export const fireCrawlConfig: FireCrawlConfig = {
  apiKey: env.FIRECRAWL_API_KEY,
  endpoint: env.FIRECRAWL_ENDPOINT || 'https://api.firecrawl.dev/v0',
  timeout: parseInt(env.FIRECRAWL_TIMEOUT || '30000'),
  maxRetries: parseInt(env.FIRECRAWL_MAX_RETRIES || '3'),
  cacheTTL: parseInt(env.FIRECRAWL_CACHE_TTL || '86400')
};
```

---

## API Reference

### Client Setup

**Installation:**
```bash
# No SDK needed - use native fetch API
# FireCrawl API is simple enough for direct HTTP calls
```

**Initialization:**
```typescript
// src/lib/firecrawl/client.ts
export class FireCrawlClient {
  constructor(
    private apiKey: string,
    private endpoint: string = 'https://api.firecrawl.dev/v0'
  ) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
}
```

### Available Methods

#### Method 1: `scrapeUrl()`

**Purpose:** Scrape a single URL and convert to markdown

**Signature:**
```typescript
async function scrapeUrl(
  url: string,
  options?: ScrapeOptions
): Promise<ScrapeResult>
```

**Parameters:**
- `url` (string) - The URL to scrape
- `options` (ScrapeOptions, optional) - Scraping options

**Options Interface:**
```typescript
interface ScrapeOptions {
  pageOptions?: {
    onlyMainContent?: boolean;    // Remove headers, footers, ads (default: true)
    includeHtml?: boolean;         // Include raw HTML (default: false)
    screenshot?: boolean;          // Take screenshot (default: false)
    waitFor?: number;              // Wait time in ms before scraping
  };
  extractorOptions?: {
    mode: 'llm-extraction';
    extractionPrompt: string;      // Prompt for structured extraction
    extractionSchema?: object;     // JSON schema for extraction
  };
}
```

**Returns:**
```typescript
interface ScrapeResult {
  success: boolean;
  data?: {
    markdown: string;              // Converted markdown content
    html?: string;                 // Raw HTML (if requested)
    metadata: {
      title: string;
      description: string;
      language: string;
      sourceURL: string;
      statusCode: number;
    };
    llm_extraction?: any;          // Structured data (if LLM extraction used)
    screenshot?: string;           // Screenshot URL (if requested)
  };
  error?: string;
}
```

**Example Usage:**
```typescript
const client = new FireCrawlClient(env.FIRECRAWL_API_KEY);

// Basic scrape
const result = await client.scrapeUrl('https://stripe.com/docs/api', {
  pageOptions: {
    onlyMainContent: true
  }
});

console.log(result.data.markdown);
// Output: Clean markdown of Stripe API docs
```

**Error Cases:**
- `400 Bad Request` - Invalid URL or malformed options
- `401 Unauthorized` - Invalid API key
- `403 Forbidden` - URL blocked or robots.txt disallows
- `404 Not Found` - URL doesn't exist
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - FireCrawl service error

---

#### Method 2: `extractWithLLM()`

**Purpose:** Scrape URL and extract structured data using LLM

**Signature:**
```typescript
async function extractWithLLM(
  url: string,
  extractionPrompt: string,
  schema?: object
): Promise<ExtractedData>
```

**Parameters:**
- `url` - URL to scrape
- `extractionPrompt` - Prompt describing what to extract
- `schema` - Optional JSON schema for validation

**Returns:**
```typescript
interface ExtractedData {
  success: boolean;
  data?: any;                      // Extracted structured data
  markdown: string;                // Original markdown
  error?: string;
}
```

**Example Usage:**
```typescript
// Extract pricing information
const pricingData = await client.extractWithLLM(
  'https://openai.com/pricing',
  `Extract pricing information for each model:
  - Model name
  - Price per 1K tokens (input and output)
  - Free tier details (if any)
  - Rate limits
  Format as JSON array.`
);

console.log(pricingData.data);
// Output:
// [
//   {
//     "model": "GPT-4",
//     "price_input": "$0.03",
//     "price_output": "$0.06",
//     "free_tier": "$5 credit",
//     "rate_limit": "Tier-based"
//   },
//   ...
// ]
```

**Error Cases:**
- Same as `scrapeUrl()` plus:
- `422 Unprocessable Entity` - Invalid extraction prompt or schema
- LLM extraction may return partial data if page is complex

---

#### Method 3: `scrapeMultiple()`

**Purpose:** Scrape multiple URLs in parallel

**Signature:**
```typescript
async function scrapeMultiple(
  urls: string[],
  options?: ScrapeOptions
): Promise<ScrapeResult[]>
```

**Parameters:**
- `urls` - Array of URLs to scrape
- `options` - Scraping options (applied to all URLs)

**Returns:**
Array of `ScrapeResult` objects

**Example Usage:**
```typescript
const serviceName = 'stripe';
const urls = [
  'https://stripe.com/pricing',
  'https://stripe.com/docs/development/quickstart',
  'https://stripe.com/docs/api'
];

const results = await client.scrapeMultiple(urls, {
  pageOptions: { onlyMainContent: true }
});

const [pricing, gettingStarted, apiReference] = results;
```

**Performance:**
- Requests executed in parallel (faster than sequential)
- Each request counted separately for rate limits
- Timeout applies per request

---

## Implementation Details

### Integration Code

**File:** `src/lib/firecrawl/client.ts`

**Implementation:**
```typescript
export class FireCrawlClient {
  constructor(
    private apiKey: string,
    private endpoint: string = 'https://api.firecrawl.dev/v0',
    private timeout: number = 30000
  ) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async scrapeUrl(
    url: string,
    options?: ScrapeOptions
  ): Promise<ScrapeResult> {
    try {
      const response = await fetch(`${this.endpoint}/scrape`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          url,
          ...options
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new FireCrawlError(
          `FireCrawl API error: ${response.status}`,
          response.status
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async extractWithLLM(
    url: string,
    extractionPrompt: string,
    schema?: object
  ): Promise<ExtractedData> {
    const result = await this.scrapeUrl(url, {
      pageOptions: { onlyMainContent: true },
      extractorOptions: {
        mode: 'llm-extraction',
        extractionPrompt,
        extractionSchema: schema
      }
    });

    return {
      success: result.success,
      data: result.data?.llm_extraction,
      markdown: result.data?.markdown || '',
      error: result.error
    };
  }

  async scrapeMultiple(
    urls: string[],
    options?: ScrapeOptions
  ): Promise<ScrapeResult[]> {
    // Execute scrapes in parallel
    const promises = urls.map(url => this.scrapeUrl(url, options));
    return Promise.all(promises);
  }

  private handleError(error: any): Error {
    if (error.name === 'AbortError') {
      return new FireCrawlError('Request timeout', 408);
    }
    if (error instanceof FireCrawlError) {
      return error;
    }
    return new FireCrawlError('Unknown FireCrawl error', 500, error);
  }
}

// Custom error class
export class FireCrawlError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public cause?: Error
  ) {
    super(message);
    this.name = 'FireCrawlError';
  }
}
```

### Service URL Mapping

**File:** `src/lib/firecrawl/service-urls.ts`

**Purpose:** Map service names to documentation URLs

```typescript
export interface ServiceUrls {
  pricing: string;
  gettingStarted: string;
  apiReference: string;
}

export const serviceUrlMap: Record<string, ServiceUrls> = {
  'openai': {
    pricing: 'https://openai.com/pricing',
    gettingStarted: 'https://platform.openai.com/docs/quickstart',
    apiReference: 'https://platform.openai.com/docs/api-reference'
  },
  'stripe': {
    pricing: 'https://stripe.com/pricing',
    gettingStarted: 'https://stripe.com/docs/development/quickstart',
    apiReference: 'https://stripe.com/docs/api'
  },
  'anthropic': {
    pricing: 'https://www.anthropic.com/pricing',
    gettingStarted: 'https://docs.anthropic.com/claude/docs/quickstart',
    apiReference: 'https://docs.anthropic.com/claude/reference'
  },
  'sendgrid': {
    pricing: 'https://sendgrid.com/pricing',
    gettingStarted: 'https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs',
    apiReference: 'https://docs.sendgrid.com/api-reference'
  },
  'resend': {
    pricing: 'https://resend.com/pricing',
    gettingStarted: 'https://resend.com/docs/send-with-nodejs',
    apiReference: 'https://resend.com/docs/api-reference'
  },
  'aws': {
    pricing: 'https://aws.amazon.com/pricing',
    gettingStarted: 'https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html',
    apiReference: 'https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest'
  }
  // Add more services as needed
};

export function getServiceUrls(serviceName: string): ServiceUrls | null {
  const normalized = serviceName.toLowerCase().trim();
  return serviceUrlMap[normalized] || null;
}

// Fallback: attempt to find docs with pattern matching
export function guessServiceUrls(serviceName: string): ServiceUrls {
  const normalized = serviceName.toLowerCase().replace(/\s+/g, '');
  return {
    pricing: `https://${normalized}.com/pricing`,
    gettingStarted: `https://docs.${normalized}.com/getting-started`,
    apiReference: `https://docs.${normalized}.com/api`
  };
}
```

### Data Transformation

**External Format → Internal Format:**

```typescript
// FireCrawl response
interface FireCrawlResponse {
  success: boolean;
  data: {
    markdown: string;
    metadata: {
      title: string;
      sourceURL: string;
    };
  };
}

// Internal format for AI Assistant
interface ScrapedServiceData {
  serviceName: string;
  pricing: string;              // Markdown content
  gettingStarted: string;       // Markdown content
  apiReference: string;         // Markdown content
  scrapedAt: string;            // ISO timestamp
  urls: {
    pricing: string;
    gettingStarted: string;
    apiReference: string;
  };
}

// Transformation function
async function scrapeServiceDocs(
  serviceName: string,
  client: FireCrawlClient
): Promise<ScrapedServiceData> {
  const urls = getServiceUrls(serviceName) || guessServiceUrls(serviceName);

  // Scrape all URLs in parallel
  const [pricingResult, guideResult, apiRefResult] = await client.scrapeMultiple([
    urls.pricing,
    urls.gettingStarted,
    urls.apiReference
  ]);

  return {
    serviceName,
    pricing: pricingResult.data?.markdown || '',
    gettingStarted: guideResult.data?.markdown || '',
    apiReference: apiRefResult.data?.markdown || '',
    scrapedAt: new Date().toISOString(),
    urls
  };
}
```

---

## Error Handling

### Error Types

**Error 1: Rate Limit Exceeded (429)**
- **When:** FireCrawl monthly quota exceeded or rate limit hit
- **External Code:** `429 Too Many Requests`
- **Internal Code:** `FIRECRAWL_RATE_LIMIT`
- **Recovery:** Wait and retry, use cached data, notify user

**Error 2: Invalid URL (400)**
- **When:** Malformed URL or URL not accessible
- **External Code:** `400 Bad Request`
- **Internal Code:** `FIRECRAWL_INVALID_URL`
- **Recovery:** Fallback to Google search, ask user for correct URL

**Error 3: Authentication Failed (401)**
- **When:** Invalid or expired API key
- **External Code:** `401 Unauthorized`
- **Internal Code:** `FIRECRAWL_AUTH_ERROR`
- **Recovery:** Log error, alert ops team, use cached data

**Error 4: Service Unavailable (503)**
- **When:** FireCrawl service is down
- **External Code:** `503 Service Unavailable`
- **Internal Code:** `FIRECRAWL_SERVICE_DOWN`
- **Recovery:** Retry with exponential backoff, fallback to cached data

**Error 5: Timeout (408)**
- **When:** Scrape takes longer than timeout (30s default)
- **External Code:** Client-side timeout
- **Internal Code:** `FIRECRAWL_TIMEOUT`
- **Recovery:** Retry once with longer timeout, use cached data

### Retry Strategy

**Retry Policy:**
- Attempts: 3
- Backoff: Exponential (1s, 2s, 4s)
- Max wait: 10 seconds

**Retriable Errors:**
- `429 Too Many Requests` - Wait for retry-after header
- `500 Internal Server Error` - Server-side error
- `503 Service Unavailable` - Service down
- `408 Timeout` - Network or processing delay

**Non-Retriable Errors:**
- `400 Bad Request` - Invalid input, won't succeed on retry
- `401 Unauthorized` - Auth problem, not transient
- `403 Forbidden` - Access denied, won't succeed on retry
- `404 Not Found` - URL doesn't exist

**Implementation:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retriable errors
      if (error instanceof FireCrawlError && !isRetriable(error.statusCode)) {
        throw error;
      }

      // Last attempt, throw error
      if (attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

function isRetriable(statusCode: number): boolean {
  return [429, 500, 503, 408].includes(statusCode);
}
```

---

## Caching Strategy

### Cache Implementation

**Storage:** Cloudflare Workers KV

**Cache Key Format:**
```typescript
function getCacheKey(serviceName: string, urlType: 'pricing' | 'guide' | 'api'): string {
  return `firecrawl:${serviceName.toLowerCase()}:${urlType}`;
}

// Examples:
// firecrawl:stripe:pricing
// firecrawl:openai:guide
// firecrawl:anthropic:api
```

**Cache TTL:** 24 hours (86400 seconds)

**Rationale:** API documentation doesn't change frequently. 24 hours provides fresh content without excessive scraping costs.

### Cache Operations

**Read from cache:**
```typescript
async function getCachedScrapedData(
  serviceName: string,
  env: Env
): Promise<ScrapedServiceData | null> {
  const pricingKey = getCacheKey(serviceName, 'pricing');
  const guideKey = getCacheKey(serviceName, 'guide');
  const apiKey = getCacheKey(serviceName, 'api');

  // Fetch all cached data in parallel
  const [pricingCache, guideCache, apiCache] = await Promise.all([
    env.KV.get(pricingKey, 'json'),
    env.KV.get(guideKey, 'json'),
    env.KV.get(apiKey, 'json')
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
```

**Write to cache:**
```typescript
async function cacheScrapedData(
  serviceName: string,
  data: ScrapedServiceData,
  env: Env
): Promise<void> {
  const ttl = 86400; // 24 hours

  const pricingKey = getCacheKey(serviceName, 'pricing');
  const guideKey = getCacheKey(serviceName, 'guide');
  const apiKey = getCacheKey(serviceName, 'api');

  // Store each piece separately for granular cache control
  await Promise.all([
    env.KV.put(pricingKey, JSON.stringify({
      markdown: data.pricing,
      scrapedAt: data.scrapedAt,
      urls: data.urls
    }), { expirationTtl: ttl }),

    env.KV.put(guideKey, JSON.stringify({
      markdown: data.gettingStarted,
      scrapedAt: data.scrapedAt,
      urls: data.urls
    }), { expirationTtl: ttl }),

    env.KV.put(apiKey, JSON.stringify({
      markdown: data.apiReference,
      scrapedAt: data.scrapedAt,
      urls: data.urls
    }), { expirationTtl: ttl })
  ]);
}
```

**Cache invalidation:**
```typescript
// Manual cache invalidation (admin function)
async function invalidateServiceCache(
  serviceName: string,
  env: Env
): Promise<void> {
  const keys = [
    getCacheKey(serviceName, 'pricing'),
    getCacheKey(serviceName, 'guide'),
    getCacheKey(serviceName, 'api')
  ];

  await Promise.all(keys.map(key => env.KV.delete(key)));
}

// Force refresh (bypass cache)
async function forceRefreshService(
  serviceName: string,
  client: FireCrawlClient,
  env: Env
): Promise<ScrapedServiceData> {
  // Invalidate cache
  await invalidateServiceCache(serviceName, env);

  // Scrape fresh data
  const data = await scrapeServiceDocs(serviceName, client);

  // Cache new data
  await cacheScrapedData(serviceName, data, env);

  return data;
}
```

### Cache Strategy Summary

**Benefits:**
- Reduces FireCrawl API costs (500 credits/month free tier)
- Faster response times (no scraping delay)
- Resilience (works even if FireCrawl is down)
- Reduced rate limit risk

**Trade-offs:**
- Slightly stale data (max 24 hours old)
- Storage costs (minimal with KV)
- Complexity of cache management

**Optimization:**
- Pre-populate cache for popular services (OpenAI, Stripe, AWS)
- Monitor cache hit rate
- Adjust TTL based on service update frequency

---

## Parsing & Data Extraction

### Markdown Processing

FireCrawl returns clean markdown, but additional processing improves AI analysis:

```typescript
interface ParsedDocumentation {
  headings: string[];           // All H1-H3 headings
  sections: Section[];          // Content organized by section
  codeBlocks: CodeBlock[];      // All code examples
  links: Link[];                // All external links
  pricing: PricingInfo | null;  // Extracted pricing details
}

interface Section {
  heading: string;
  level: number;                // 1, 2, or 3
  content: string;              // Markdown content
}

interface CodeBlock {
  language: string;
  code: string;
  context: string;              // Surrounding text
}

interface PricingInfo {
  freeTier: string | null;
  paidTiers: PricingTier[];
  rateLimit: string | null;
}

interface PricingTier {
  name: string;
  price: string;
  features: string[];
}
```

**Parser Implementation:**

```typescript
function parseMarkdown(markdown: string): ParsedDocumentation {
  const headings = extractHeadings(markdown);
  const sections = extractSections(markdown);
  const codeBlocks = extractCodeBlocks(markdown);
  const links = extractLinks(markdown);
  const pricing = extractPricing(markdown);

  return {
    headings,
    sections,
    codeBlocks,
    links,
    pricing
  };
}

function extractHeadings(markdown: string): string[] {
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  const matches = [...markdown.matchAll(headingRegex)];
  return matches.map(m => m[1].trim());
}

function extractSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  let currentSection: Section | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: ''
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function extractCodeBlocks(markdown: string): CodeBlock[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const matches = [...markdown.matchAll(codeBlockRegex)];

  return matches.map(m => ({
    language: m[1] || 'plaintext',
    code: m[2].trim(),
    context: getCodeContext(markdown, m.index!)
  }));
}

function getCodeContext(markdown: string, codeIndex: number): string {
  // Get 200 characters before code block as context
  const start = Math.max(0, codeIndex - 200);
  const context = markdown.slice(start, codeIndex).trim();
  return context;
}

function extractLinks(markdown: string): Link[] {
  const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g;
  const matches = [...markdown.matchAll(linkRegex)];

  return matches.map(m => ({
    text: m[1],
    url: m[2]
  }));
}

function extractPricing(markdown: string): PricingInfo | null {
  // Use regex patterns to find pricing information
  // This is heuristic-based and may need adjustment per service

  const freeTierRegex = /free tier:?\s*(.+?)(?:\n|$)/i;
  const freeTierMatch = markdown.match(freeTierRegex);

  // Extract pricing tiers (basic heuristic)
  const pricingSection = markdown.match(/##\s*Pricing(.+?)(?=##|$)/is);

  if (!pricingSection) return null;

  return {
    freeTier: freeTierMatch ? freeTierMatch[1].trim() : null,
    paidTiers: extractPricingTiers(pricingSection[1]),
    rateLimit: extractRateLimit(markdown)
  };
}
```

### LLM Extraction for Structured Data

For critical information like pricing, use FireCrawl's LLM extraction:

```typescript
async function extractPricingStructured(
  url: string,
  client: FireCrawlClient
): Promise<PricingInfo> {
  const extractionPrompt = `
Extract pricing information from this page:

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
`;

  const result = await client.extractWithLLM(url, extractionPrompt);
  return result.data as PricingInfo;
}
```

---

## Fallback Mechanisms

### When FireCrawl Fails

**Fallback Strategy (in order of preference):**

1. **Use Cached Data (even if expired)**
   ```typescript
   async function getServiceDataWithFallback(
     serviceName: string,
     client: FireCrawlClient,
     env: Env
   ): Promise<ScrapedServiceData> {
     try {
       // Try fresh scrape
       return await scrapeServiceDocs(serviceName, client);
     } catch (error) {
       console.warn('FireCrawl failed, checking cache:', error);

       // Try cache (even expired)
       const cached = await getCachedScrapedData(serviceName, env);
       if (cached) {
         console.info('Using expired cache as fallback');
         return cached;
       }

       // No cache, try manual service definitions
       const manual = getManualServiceData(serviceName);
       if (manual) {
         console.info('Using manual service data as fallback');
         return manual;
       }

       // Last resort: return empty data, let AI handle gracefully
       console.error('All fallbacks failed for service:', serviceName);
       return {
         serviceName,
         pricing: '',
         gettingStarted: '',
         apiReference: '',
         scrapedAt: new Date().toISOString(),
         urls: guessServiceUrls(serviceName)
       };
     }
   }
   ```

2. **Manual Service Definitions**

   For critical services, maintain manual documentation snippets:

   ```typescript
   // src/lib/firecrawl/manual-data.ts
   export const manualServiceData: Record<string, ScrapedServiceData> = {
     'openai': {
       serviceName: 'OpenAI',
       pricing: `
# OpenAI Pricing

**Free Tier:** $5 credit when you sign up

**GPT-4:**
- Input: $0.03 per 1K tokens
- Output: $0.06 per 1K tokens

**GPT-3.5-turbo:**
- Input: $0.002 per 1K tokens
- Output: $0.002 per 1K tokens
       `.trim(),
       gettingStarted: `
# Getting Started with OpenAI

1. Sign up at platform.openai.com
2. Verify your email
3. Add billing information
4. Create API key
5. Use in your application
       `.trim(),
       apiReference: 'https://platform.openai.com/docs/api-reference',
       scrapedAt: '2025-10-30T00:00:00Z',
       urls: serviceUrlMap['openai']
     },
     // Add more critical services
   };
   ```

3. **Google Search Fallback (future enhancement)**

   If FireCrawl fails and no cache/manual data exists, could:
   - Search Google for "{service} API pricing"
   - Parse top results
   - Lower confidence, warn user

4. **Graceful Degradation in AI Response**

   When no documentation is available, AI should:
   ```
   AI: "I couldn't fetch the latest documentation for {service}, but I can help based on my knowledge (which may be outdated).

   Based on my training data:
   - {service} typically requires...
   - Here's the general process...

   ⚠️ Note: Please verify these steps on {service}'s official website, as they may have changed."
   ```

---

## Testing

### Unit Tests

**Test File:** `src/lib/firecrawl/client.test.ts`

**Test Cases:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { FireCrawlClient } from './client';

describe('FireCrawlClient', () => {
  it('should scrape URL successfully', async () => {
    const client = new FireCrawlClient('test_key');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          markdown: '# Test Content',
          metadata: {
            title: 'Test Page',
            sourceURL: 'https://example.com'
          }
        }
      })
    });

    global.fetch = mockFetch;

    const result = await client.scrapeUrl('https://example.com');

    expect(result.success).toBe(true);
    expect(result.data?.markdown).toBe('# Test Content');
  });

  it('should handle 429 rate limit', async () => {
    const client = new FireCrawlClient('test_key');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429
    });

    global.fetch = mockFetch;

    await expect(client.scrapeUrl('https://example.com'))
      .rejects.toThrow('FireCrawl API error: 429');
  });

  it('should extract data with LLM', async () => {
    // Test LLM extraction
  });

  it('should scrape multiple URLs in parallel', async () => {
    // Test parallel scraping
  });
});
```

### Integration Tests

**Test Scenario 1: End-to-end scraping flow**
```typescript
describe('FireCrawl Integration', () => {
  it('should scrape, parse, and cache service data', async () => {
    const serviceName = 'stripe';
    const client = new FireCrawlClient(env.FIRECRAWL_API_KEY);

    // Scrape service
    const data = await scrapeServiceDocs(serviceName, client);

    expect(data.serviceName).toBe('stripe');
    expect(data.pricing).toContain('pricing');
    expect(data.gettingStarted).toContain('quickstart');

    // Cache data
    await cacheScrapedData(serviceName, data, env);

    // Verify cache
    const cached = await getCachedScrapedData(serviceName, env);
    expect(cached).toEqual(data);
  });
});
```

### Manual Testing

**Test in development:**
```bash
# Set up environment
cp .dev.vars.example .dev.vars
# Add your FireCrawl API key to .dev.vars

# Start local worker
pnpm run dev

# Test scraping via HTTP endpoint
curl -X POST http://localhost:8787/api/ai/research \
  -H "Content-Type: application/json" \
  -d '{"service_name":"stripe"}'
```

**Verify:**
- [ ] Returns scraped markdown
- [ ] Includes pricing, guide, and API reference
- [ ] Data cached in KV (check Wrangler dashboard)
- [ ] Second request uses cache (faster response)

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- FireCrawl API calls per day/week/month
- Success rate (successful scrapes / total attempts)
- Error rate by type (429, 500, timeout, etc.)
- Average latency per scrape
- Cache hit rate

**Business Metrics:**
- Unique services researched
- Most requested services (optimize cache for these)
- Cost per research (FireCrawl credits used)
- Fallback usage rate (how often manual data used)

### Logging

**Log Level:** INFO for success, WARN for fallbacks, ERROR for failures

**Logged Events:**
- Scrape initiated
- Scrape succeeded
- Scrape failed (with error details)
- Cache hit
- Cache miss
- Fallback to manual data
- Fallback to expired cache

**Log Format:**
```typescript
{
  event: 'firecrawl_scrape',
  service: 'stripe',
  urls_scraped: 3,
  duration_ms: 2341,
  cache_used: false,
  status: 'success',
  timestamp: '2025-10-30T10:00:00Z'
}
```

### Alerts

**Alert 1: High Error Rate**
- **Condition:** Error rate > 20% over 1 hour
- **Severity:** P2
- **Action:** Check FireCrawl status page, verify API key valid

**Alert 2: Rate Limit Approaching**
- **Condition:** 80% of monthly FireCrawl quota used
- **Severity:** P3
- **Action:** Review usage patterns, optimize caching, consider upgrade

**Alert 3: Service Unavailable**
- **Condition:** 5+ consecutive FireCrawl 503 errors
- **Severity:** P2
- **Action:** Check status page, increase reliance on cache

**Alert 4: Low Cache Hit Rate**
- **Condition:** Cache hit rate < 50% over 24 hours
- **Severity:** P3
- **Action:** Review cache TTL, pre-populate popular services

---

## Security Considerations

### Data Privacy

**Data sent to FireCrawl:**
- URLs to scrape (public documentation sites)
- Extraction prompts (generic, no user data)
- No PII or sensitive user information

**Data received from FireCrawl:**
- Public documentation content
- No secrets or credentials
- Stored in KV cache (not sensitive)

**Privacy compliance:**
- FireCrawl processes only public data
- No GDPR concerns (public documentation)
- Cached data can be deleted anytime

### Credential Security

**API key protection:**
- Stored in Cloudflare Workers secrets (encrypted)
- Never logged or exposed in responses
- Rotated quarterly
- Restricted to specific Workers (IAM)

**Access control:**
- Only AI orchestration Worker can call FireCrawl
- User cannot directly trigger scrapes (rate limit protection)
- Admin-only cache invalidation endpoint

### Compliance

**SOC 2:** FireCrawl API calls logged for audit trail

**GDPR:** No personal data processed or stored

---

## Cost & Rate Limits

### Pricing Model

**FireCrawl Pricing (as of 2025-10-30):**
- **Free tier:** 500 credits/month
- **Paid plans:** Starting at $19/month for 5,000 credits
- **Credit usage:**
  - Simple scrape: 1 credit
  - Scrape with screenshot: +2 credits
  - LLM extraction: +5 credits

**Abyrith Usage Pattern:**
- Typical scrape: 1 credit (no screenshots)
- LLM extraction for pricing: 5 credits
- Per service research: ~3 credits (3 URLs, no LLM extraction typically)

**Estimated monthly cost:**
- Free tier sufficient for MVP (~150 service researches/month)
- With 1,000 users: ~$19-39/month (depends on cache effectiveness)
- Enterprise scale: ~$99/month (25,000 credits)

### Rate Limits

**FireCrawl Limits:**
- Free tier: 60 requests/minute
- Paid plans: 300 requests/minute

**Abyrith Rate Limiting:**
```typescript
// User-level rate limiting
const RESEARCH_RATE_LIMIT = {
  maxRequests: 10,           // 10 research requests
  windowMs: 60 * 60 * 1000   // per hour
};

// System-level rate limiting
const FIRECRAWL_RATE_LIMIT = {
  maxRequests: 50,           // 50 scrapes
  windowMs: 60 * 1000        // per minute
};
```

**How we handle limits:**
- Aggressive caching (24 hour TTL)
- Pre-populate cache for popular services
- User rate limits prevent abuse
- Queue requests if approaching limit
- Graceful degradation to cached/manual data

### Monitoring Usage

```typescript
// Track FireCrawl usage
interface FireCrawlUsageStats {
  month: string;             // "2025-10"
  creditsUsed: number;
  creditsRemaining: number;
  totalScrapes: number;
  uniqueServices: number;
  cacheHitRate: number;
}

async function trackFireCrawlUsage(
  env: Env
): Promise<FireCrawlUsageStats> {
  const month = new Date().toISOString().slice(0, 7);
  const key = `firecrawl:usage:${month}`;

  const usage = await env.KV.get(key, 'json') || {
    creditsUsed: 0,
    totalScrapes: 0,
    uniqueServices: 0
  };

  return {
    month,
    ...usage,
    creditsRemaining: 500 - usage.creditsUsed, // Free tier
    cacheHitRate: calculateCacheHitRate(env)
  };
}
```

---

## Troubleshooting

### Issue 1: Scrape Returns Empty Markdown

**Symptoms:**
```json
{
  "success": true,
  "data": {
    "markdown": "",
    "metadata": {...}
  }
}
```

**Cause:** Website blocks scrapers or requires JavaScript rendering

**Solution:**
```typescript
// Try with waitFor option (allows JS to load)
const result = await client.scrapeUrl(url, {
  pageOptions: {
    onlyMainContent: true,
    waitFor: 5000  // Wait 5 seconds for JS
  }
});
```

If still fails, add to manual service data.

---

### Issue 2: Rate Limit Errors (429)

**Symptoms:**
```
FireCrawl API error: 429 Too Many Requests
```

**Cause:** Exceeded FireCrawl monthly quota or per-minute rate limit

**Solution:**
1. Check usage: `await trackFireCrawlUsage(env)`
2. If quota exceeded:
   - Increase cache TTL to 48 hours
   - Rely on cached data
   - Upgrade FireCrawl plan
3. If rate limit exceeded:
   - Implement request queue
   - Spread requests over time

---

### Issue 3: Extraction Returns Wrong Data

**Symptoms:**
LLM extraction returns null or incorrect structure

**Cause:** Complex page layout or extraction prompt too vague

**Solution:**
```typescript
// Improve extraction prompt with examples
const betterPrompt = `
Extract pricing information. Return JSON exactly like this example:

{
  "free_tier": "$5 credit when signing up",
  "paid_tiers": [
    {
      "name": "Pay as you go",
      "price": "$0.002 per 1K tokens",
      "features": ["No commitment", "Usage-based"]
    }
  ]
}

Look for sections titled "Pricing", "Plans", or "Cost".
`;

const result = await client.extractWithLLM(url, betterPrompt);
```

---

### Issue 4: Timeout Errors

**Symptoms:**
```
FireCrawlError: Request timeout
```

**Cause:** Page takes too long to load or network latency

**Solution:**
```typescript
// Increase timeout for specific URL
const client = new FireCrawlClient(
  env.FIRECRAWL_API_KEY,
  'https://api.firecrawl.dev/v0',
  60000  // 60 second timeout
);
```

---

### Debug Mode

**Enable debug logging:**
```typescript
// Set environment variable
DEBUG_FIRECRAWL=true

// In code
if (env.DEBUG_FIRECRAWL === 'true') {
  console.log('FireCrawl request:', {
    url,
    options,
    timestamp: new Date().toISOString()
  });
  console.log('FireCrawl response:', result);
}
```

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [x] `06-backend/cloudflare-workers/workers-architecture.md` - Worker architecture (VERIFIED)
- [x] `08-features/ai-assistant/ai-assistant-overview.md` - AI Assistant feature (VERIFIED)
- [x] `TECH-STACK.md` - Technology specifications (VERIFIED)
- [ ] Cloudflare Workers KV namespace configured (NEEDS SETUP)
- [ ] FireCrawl API account and key (NEEDS ACQUISITION)

**External Dependencies:**
- FireCrawl API account (sign up at firecrawl.dev)
- FireCrawl API key
- Cloudflare Workers environment

### Feature Dependencies

**Required by features:**
- AI Secret Assistant - Uses FireCrawl to research unfamiliar APIs
- Acquisition Flow Generation - Requires scraped docs to generate instructions
- Cost Analysis - Pricing data extracted via FireCrawl

**Depends on features:**
- Cloudflare Workers - Hosts the scraping orchestration logic
- KV Storage - Caches scraped data

---

## References

### Internal Documentation
- `08-features/ai-assistant/ai-assistant-overview.md` - AI Assistant architecture
- `06-backend/cloudflare-workers/workers-overview.md` - Worker configuration
- `TECH-STACK.md` - Technology stack
- `GLOSSARY.md` - Term definitions

### External Resources
- [FireCrawl Documentation](https://docs.firecrawl.dev/) - Official API docs
- [FireCrawl API Reference](https://docs.firecrawl.dev/api-reference) - API endpoints
- [FireCrawl Status Page](https://status.firecrawl.dev/) - Service status
- [FireCrawl Pricing](https://firecrawl.dev/pricing) - Current pricing
- [Cloudflare Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) - KV API reference

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial FireCrawl integration documentation |

---

## Notes

### Future Enhancements
- **Screenshot Analysis:** Use FireCrawl's screenshot feature to capture visual acquisition steps
- **Multi-page Crawling:** Crawl entire documentation sites (not just 3 URLs)
- **Smart URL Detection:** Use AI to find best documentation URLs automatically
- **Version Detection:** Track when documentation changes (diff detection)
- **Community Contributions:** Allow users to submit manual service data for uncommon APIs

### Known Limitations
- Cannot scrape sites behind authentication (paywalls, gated docs)
- JavaScript-heavy sites may return incomplete content
- LLM extraction success depends on page structure
- 24-hour cache may miss very recent documentation updates

### Performance Optimization Ideas
- Pre-scrape top 50 APIs during deployment
- Implement partial scraping (only scrape pricing if that's requested)
- Use FireCrawl's batch API for multiple URLs (when available)
- Implement smart cache warming based on usage patterns
