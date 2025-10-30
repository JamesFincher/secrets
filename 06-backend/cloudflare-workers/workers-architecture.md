---
Document: Cloudflare Workers Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 05-api/api-rest-design.md, 02-architecture/system-overview.md, TECH-STACK.md
---

# Cloudflare Workers Architecture

## Overview

Cloudflare Workers serve as the API gateway and edge computing layer for Abyrith, providing zero-cold-start serverless functions running on Cloudflare's global network. Workers handle API routing, rate limiting, request validation, and orchestrate communication between the client and Supabase backend while maintaining security and performance at the edge.

**Purpose:** Define how Cloudflare Workers operate as the API gateway, implementing rate limiting, request routing, caching, environment variable management, and secrets storage for the Abyrith platform.

**Scope:** This document covers Worker architecture, routing logic, security controls, KV storage usage, and integration with other system components.

**Status:** Draft - Pending implementation

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [API Contracts](#api-contracts)
7. [Security Architecture](#security-architecture)
8. [Performance Characteristics](#performance-characteristics)
9. [Scalability](#scalability)
10. [Failure Modes](#failure-modes)
11. [Alternatives Considered](#alternatives-considered)
12. [Decision Log](#decision-log)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
The Abyrith platform requires a robust API gateway that can handle authentication, rate limiting, request routing, and edge caching while maintaining zero-knowledge encryption principles. Traditional server-based architectures introduce latency and cold starts, degrading user experience.

**Pain points:**
- API requests need global distribution with minimal latency
- Rate limiting must prevent abuse while allowing legitimate usage
- Zero-knowledge architecture requires master encryption keys to be accessible but secure
- Caching needs to be intelligent and respect user permissions
- Request routing must be flexible to support multiple backend services (Supabase, Claude API, FireCrawl)

**Why now?**
Phase 3 of the documentation roadmap establishes core infrastructure. Workers are essential for implementing the API gateway pattern that enables secure, performant access to Abyrith's backend services.

### Background

**Existing system:**
Currently in planning phase. The system overview document establishes Cloudflare Workers as the edge layer between clients and backend services.

**Previous attempts:**
N/A - This is the initial architecture design.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Frontend Team | Fast API responses, clear error messages | Worker complexity shouldn't leak into frontend |
| Backend Team | Secure backend access, scalable architecture | Workers must properly enforce RLS and auth |
| Security Team | Zero-knowledge encryption, audit logging | Master encryption keys must be stored securely |
| DevOps Team | Easy deployment, monitoring, debugging | Worker deployment and rollback procedures |
| Users | Fast page loads, reliable service | Minimal latency regardless of location |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Sub-200ms API response time (p95)** - Leverage edge computing for fast responses globally
2. **Comprehensive rate limiting** - Prevent abuse with per-IP and per-user limits
3. **Secure secrets storage** - Store master encryption key safely in Worker environment
4. **Intelligent caching** - Cache public data while respecting user permissions
5. **Zero cold starts** - Maintain V8 isolate architecture for instant execution

**Secondary goals:**
- Request/response logging for debugging and audit
- Feature flag support via KV storage
- Graceful degradation when backend services are unavailable
- Easy deployment and rollback via Wrangler CLI

### Non-Goals

**Explicitly out of scope:**
- **Database operations** - Workers route to Supabase, they don't query directly
- **Complex business logic** - Keep Workers focused on gateway concerns
- **Long-running computations** - Workers have CPU time limits, use Edge Functions for heavy operations
- **Session storage** - Use JWT tokens, not Worker-based sessions

### Success Metrics

**How we measure success:**
- **API latency**: p95 < 200ms, p99 < 500ms globally
- **Rate limit effectiveness**: Block 99%+ of abusive traffic while allowing 99.99%+ of legitimate requests
- **Cache hit rate**: 60%+ for public endpoints
- **Worker CPU usage**: < 10ms per request on average
- **Error rate**: < 0.1% excluding user errors (4xx)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Clients                              │
│   Web App │ Mobile │ CLI │ MCP │ Browser Extension      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS Requests
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Global Network                   │
│                (200+ Edge Locations)                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │           DDoS Protection & WAF                     │ │
│  │    Automatic Layer 3/4/7 Attack Mitigation         │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Workers                          │
│                (V8 Isolate Runtime)                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │             API Gateway Worker                      │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  1. Request Validation                       │  │ │
│  │  │  2. JWT Authentication                       │  │ │
│  │  │  3. Rate Limiting (KV)                       │  │ │
│  │  │  4. Route Determination                      │  │ │
│  │  │  5. Request Transformation                   │  │ │
│  │  │  6. Response Caching (KV)                    │  │ │
│  │  │  7. Error Handling                           │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Cloudflare Workers KV Storage              │ │
│  │  • Rate limit counters (per IP, per user)         │ │
│  │  • Cache for public API responses                 │ │
│  │  • Feature flags                                  │ │
│  │  • Temporary session data                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Worker Environment Variables                │ │
│  │  • SUPABASE_URL (backend endpoint)                 │ │
│  │  • SUPABASE_ANON_KEY (public key)                  │ │
│  │  • MASTER_ENCRYPTION_KEY (zero-knowledge key)      │ │
│  │  • CLAUDE_API_KEY (AI integration)                 │ │
│  │  • FIRECRAWL_API_KEY (doc scraping)               │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
           ┌─────────┼──────────┐
           │         │          │
           ▼         ▼          ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Supabase │ │ Claude   │ │FireCrawl │
   │ Backend  │ │   API    │ │   API    │
   └──────────┘ └──────────┘ └──────────┘
```

### Key Components

**Component 1: API Gateway Worker**
- **Purpose:** Central routing and orchestration point for all API requests
- **Technology:** TypeScript compiled to JavaScript, V8 isolate runtime
- **Responsibilities:**
  - JWT token validation and user authentication
  - Per-IP and per-user rate limiting
  - Request routing to appropriate backend services
  - Response caching for public endpoints
  - Error normalization and logging
  - CORS policy enforcement

**Component 2: Workers KV Storage**
- **Purpose:** Low-latency key-value store for edge data
- **Technology:** Cloudflare KV (eventually consistent global storage)
- **Responsibilities:**
  - Storing rate limit counters with TTL
  - Caching API responses (respecting permissions)
  - Feature flag configuration
  - Temporary data storage

**Component 3: Environment Secrets**
- **Purpose:** Secure storage for sensitive configuration
- **Technology:** Cloudflare Workers Secrets (encrypted at rest)
- **Responsibilities:**
  - Master encryption key for zero-knowledge system
  - API keys for backend integrations
  - Service URLs and configuration

**Component 4: Request Router**
- **Purpose:** Intelligent routing based on request path and method
- **Technology:** TypeScript routing logic
- **Responsibilities:**
  - Path pattern matching
  - Method validation (GET, POST, PUT, DELETE)
  - Backend service selection
  - Request transformation

### Component Interactions

**Client ↔ Workers:**
- Protocol: HTTPS
- Data format: JSON
- Authentication: JWT Bearer tokens in Authorization header
- Error format: Standardized JSON error responses

**Workers ↔ Supabase:**
- Protocol: HTTPS (PostgREST API)
- Data format: JSON
- Authentication: JWT passed through, RLS enforced
- Connection: Direct HTTP requests (no persistent connections)

**Workers ↔ Claude API:**
- Protocol: HTTPS
- Data format: JSON
- Authentication: API key from Worker environment
- Rate limiting: Enforced by Claude API

**Workers ↔ KV Storage:**
- Protocol: Workers runtime API
- Data format: String/ArrayBuffer
- Consistency: Eventually consistent (global replication)
- Latency: Sub-millisecond (local edge)

---

## Component Details

### Component: API Gateway Worker

**Purpose:**
The main Worker that receives all incoming API requests, performs authentication and validation, enforces rate limits, routes to backend services, and returns responses to clients.

**Responsibilities:**
1. Receive and parse incoming HTTP requests
2. Validate request format and required headers
3. Extract and verify JWT tokens
4. Check rate limits using KV storage
5. Route requests to appropriate backend service
6. Transform requests/responses as needed
7. Cache responses when appropriate
8. Log requests for audit and debugging
9. Handle errors gracefully with standardized responses

**Technology Stack:**
- TypeScript (transpiled to JavaScript)
- V8 isolate runtime (not Node.js)
- Web Crypto API for encryption operations
- Cloudflare Workers runtime APIs

**Internal Architecture:**

```
┌─────────────────────────────────────────┐
│       API Gateway Worker                │
│                                         │
│  ┌────────────────────────────────┐    │
│  │   Middleware Pipeline           │    │
│  │                                 │    │
│  │   1. CORS Handler               │    │
│  │   2. Request Logger             │    │
│  │   3. JWT Authenticator          │    │
│  │   4. Rate Limiter               │    │
│  │   5. Cache Checker              │    │
│  │   6. Router                     │    │
│  │   7. Backend Proxy              │    │
│  │   8. Response Transformer       │    │
│  │   9. Cache Writer               │    │
│  │  10. Error Handler              │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Key Modules:**
- `auth.ts` - JWT validation and user extraction
- `rateLimiter.ts` - Rate limiting logic using KV
- `router.ts` - Request routing and path matching
- `cache.ts` - Response caching strategies
- `proxy.ts` - Backend request forwarding
- `errorHandler.ts` - Error normalization
- `logger.ts` - Structured logging

**Configuration:**

```typescript
interface WorkerConfig {
  // Backend service URLs
  supabaseUrl: string;
  claudeApiUrl: string;
  firecrawlApiUrl: string;

  // Rate limiting
  rateLimitPerMinute: number;      // Requests per minute per user
  rateLimitPerHour: number;        // Requests per hour per user
  ipRateLimitPerMinute: number;    // Requests per minute per IP (unauthenticated)

  // Caching
  cachePublicResponses: boolean;
  cacheTtlSeconds: number;

  // Security
  allowedOrigins: string[];        // CORS origins
  requireAuth: boolean;            // Global auth requirement

  // Features
  enableLogging: boolean;
  enableMetrics: boolean;
}
```

**Example:**

```typescript
// Worker entry point
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // 1. CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS(request);
      }

      // 2. Log request
      logRequest(request);

      // 3. Authenticate
      const user = await authenticateRequest(request, env);

      // 4. Rate limit
      await checkRateLimit(user?.id || getClientIP(request), env);

      // 5. Check cache
      const cached = await getCachedResponse(request, env);
      if (cached) return cached;

      // 6. Route request
      const route = matchRoute(request);

      // 7. Proxy to backend
      const response = await proxyRequest(request, route, user, env);

      // 8. Cache response
      await cacheResponse(request, response, env);

      // 9. Return
      return response;

    } catch (error) {
      return handleError(error);
    }
  }
};
```

---

### Component: Rate Limiter

**Purpose:**
Prevent API abuse by limiting the number of requests from a single user or IP address within a time window.

**Responsibilities:**
- Track request counts per user ID
- Track request counts per IP address
- Enforce per-minute and per-hour limits
- Store counters in KV with automatic expiration
- Return appropriate 429 status codes when limits exceeded
- Include rate limit headers in responses

**Technology Stack:**
- Cloudflare Workers KV for counter storage
- TTL-based automatic cleanup
- Atomic increment operations

**Internal Architecture:**

```typescript
interface RateLimitConfig {
  authenticated: {
    perMinute: number;    // 100 requests/minute
    perHour: number;      // 2000 requests/hour
  };
  unauthenticated: {
    perMinute: number;    // 20 requests/minute per IP
    perHour: number;      // 200 requests/hour per IP
  };
}

interface RateLimitCounter {
  count: number;
  resetAt: number;      // Unix timestamp
}
```

**Key Functions:**

```typescript
/**
 * Check if request should be rate limited
 * @param identifier - User ID or IP address
 * @param window - Time window ('minute' or 'hour')
 * @param limit - Maximum requests in window
 * @param env - Worker environment with KV binding
 * @returns true if rate limited, false if allowed
 */
async function checkRateLimit(
  identifier: string,
  window: 'minute' | 'hour',
  limit: number,
  env: Env
): Promise<boolean> {
  const key = `ratelimit:${identifier}:${window}`;
  const now = Date.now();

  // Get current counter
  const counterData = await env.KV.get(key);
  const counter: RateLimitCounter = counterData
    ? JSON.parse(counterData)
    : { count: 0, resetAt: now + getWindowMs(window) };

  // Check if window expired
  if (now >= counter.resetAt) {
    counter.count = 0;
    counter.resetAt = now + getWindowMs(window);
  }

  // Check limit
  if (counter.count >= limit) {
    return true; // Rate limited
  }

  // Increment counter
  counter.count++;

  // Store with TTL
  await env.KV.put(
    key,
    JSON.stringify(counter),
    { expirationTtl: getWindowSeconds(window) }
  );

  return false; // Allowed
}

/**
 * Get rate limit headers for response
 */
function getRateLimitHeaders(
  identifier: string,
  limit: number,
  remaining: number,
  resetAt: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetAt.toString(),
  };
}
```

**Error Response Format:**

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again in 30 seconds.",
  "retry_after": 30,
  "limit": 100,
  "window": "minute"
}
```

---

### Component: Request Router

**Purpose:**
Map incoming requests to appropriate backend services based on path, method, and context.

**Responsibilities:**
- Parse request URL and extract path/query parameters
- Match path against route patterns
- Validate HTTP method for route
- Determine target backend service
- Extract route parameters
- Return 404 for unmatched routes

**Route Definitions:**

```typescript
interface Route {
  pattern: string;           // URL pattern with params, e.g. "/secrets/:id"
  methods: HttpMethod[];     // Allowed HTTP methods
  backend: BackendService;   // Target backend
  requireAuth: boolean;      // Auth required?
  cacheable: boolean;        // Can response be cached?
  rateLimit?: RateLimitOverride; // Custom rate limit
}

enum BackendService {
  SUPABASE = 'supabase',
  CLAUDE = 'claude',
  FIRECRAWL = 'firecrawl',
  MCP = 'mcp',
}

const ROUTES: Route[] = [
  // Secrets API
  {
    pattern: '/api/v1/secrets',
    methods: ['GET', 'POST'],
    backend: BackendService.SUPABASE,
    requireAuth: true,
    cacheable: false,
  },
  {
    pattern: '/api/v1/secrets/:id',
    methods: ['GET', 'PUT', 'DELETE'],
    backend: BackendService.SUPABASE,
    requireAuth: true,
    cacheable: false,
  },

  // Projects API
  {
    pattern: '/api/v1/projects',
    methods: ['GET', 'POST'],
    backend: BackendService.SUPABASE,
    requireAuth: true,
    cacheable: false,
  },
  {
    pattern: '/api/v1/projects/:id',
    methods: ['GET', 'PUT', 'DELETE'],
    backend: BackendService.SUPABASE,
    requireAuth: true,
    cacheable: false,
  },

  // AI Assistant API
  {
    pattern: '/api/v1/ai/chat',
    methods: ['POST'],
    backend: BackendService.CLAUDE,
    requireAuth: true,
    cacheable: false,
    rateLimit: { perMinute: 20, perHour: 200 }, // Lower limit for AI
  },

  // Documentation scraping
  {
    pattern: '/api/v1/docs/scrape',
    methods: ['POST'],
    backend: BackendService.FIRECRAWL,
    requireAuth: true,
    cacheable: true,
  },

  // MCP endpoints
  {
    pattern: '/mcp/secrets/list',
    methods: ['POST'],
    backend: BackendService.MCP,
    requireAuth: true,
    cacheable: false,
  },

  // Health check (public)
  {
    pattern: '/health',
    methods: ['GET'],
    backend: BackendService.SUPABASE,
    requireAuth: false,
    cacheable: true,
  },
];
```

**Route Matching Logic:**

```typescript
/**
 * Match incoming request to route
 */
function matchRoute(request: Request): MatchedRoute | null {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method as HttpMethod;

  for (const route of ROUTES) {
    const match = matchPattern(path, route.pattern);
    if (match && route.methods.includes(method)) {
      return {
        route,
        params: match.params,
        query: Object.fromEntries(url.searchParams),
      };
    }
  }

  return null; // No match found
}

/**
 * Match path against pattern with parameters
 */
function matchPattern(path: string, pattern: string): { params: Record<string, string> } | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      // Path parameter
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      // Literal mismatch
      return null;
    }
  }

  return { params };
}
```

---

### Component: Cache Manager

**Purpose:**
Cache API responses at the edge to reduce backend load and improve response times for frequently accessed data.

**Responsibilities:**
- Determine if response should be cached based on route configuration
- Generate cache keys considering user permissions
- Store responses in KV with appropriate TTL
- Retrieve cached responses when available
- Invalidate cache on mutations
- Respect cache control headers

**Caching Strategy:**

```typescript
interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  respectCacheControl: boolean;  // Honor Cache-Control headers
  varyByUser: boolean;            // Different cache per user?
  varyByQuery: boolean;           // Different cache per query params?
}

// Cache key generation
function getCacheKey(request: Request, user: User | null): string {
  const url = new URL(request.url);
  const path = url.pathname;

  // Base key
  let key = `cache:${path}`;

  // Add query params if configured
  if (config.varyByQuery && url.search) {
    key += `:${url.search}`;
  }

  // Add user ID if authenticated endpoint
  if (config.varyByUser && user) {
    key += `:user:${user.id}`;
  }

  return key;
}

// Get cached response
async function getCachedResponse(
  request: Request,
  user: User | null,
  env: Env
): Promise<Response | null> {
  const route = matchRoute(request);
  if (!route?.route.cacheable) {
    return null;
  }

  const key = getCacheKey(request, user);
  const cached = await env.KV.get(key, 'arrayBuffer');

  if (!cached) {
    return null;
  }

  // Parse cached response
  const cachedData = JSON.parse(new TextDecoder().decode(cached));
  return new Response(cachedData.body, {
    status: cachedData.status,
    headers: {
      ...cachedData.headers,
      'X-Cache': 'HIT',
      'Age': calculateAge(cachedData.timestamp).toString(),
    },
  });
}

// Cache response
async function cacheResponse(
  request: Request,
  response: Response,
  user: User | null,
  env: Env
): Promise<void> {
  const route = matchRoute(request);
  if (!route?.route.cacheable || response.status !== 200) {
    return;
  }

  // Check cache-control header
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl?.includes('no-cache') || cacheControl?.includes('private')) {
    return;
  }

  const key = getCacheKey(request, user);
  const body = await response.text();

  const cachedData = {
    body,
    status: response.status,
    headers: Object.fromEntries(response.headers),
    timestamp: Date.now(),
  };

  await env.KV.put(
    key,
    JSON.stringify(cachedData),
    { expirationTtl: config.ttlSeconds }
  );
}

// Cache invalidation
async function invalidateCache(
  pattern: string,
  env: Env
): Promise<void> {
  // KV doesn't support pattern deletion, so we use a cache version approach
  // Increment cache version for affected patterns
  const versionKey = `cache:version:${pattern}`;
  const currentVersion = await env.KV.get(versionKey) || '0';
  const newVersion = (parseInt(currentVersion) + 1).toString();
  await env.KV.put(versionKey, newVersion);
}
```

---

### Component: Environment Variable Manager

**Purpose:**
Securely manage configuration and secrets needed by Workers to communicate with backend services.

**Stored Secrets:**

```typescript
interface WorkerSecrets {
  // Backend service endpoints
  SUPABASE_URL: string;               // e.g., https://xyz.supabase.co
  SUPABASE_ANON_KEY: string;          // Public anon key
  SUPABASE_SERVICE_ROLE_KEY: string;  // Admin key (use sparingly)

  // AI integrations
  CLAUDE_API_KEY: string;             // Anthropic API key
  FIRECRAWL_API_KEY: string;          // FireCrawl API key

  // Zero-knowledge encryption
  MASTER_ENCRYPTION_KEY: string;      // Master key for envelope encryption

  // Monitoring & logging
  SENTRY_DSN?: string;                // Error tracking

  // Feature flags
  ENABLE_AI_FEATURES: string;         // 'true' or 'false'
  ENABLE_MCP_SERVER: string;          // 'true' or 'false'
}
```

**Access Pattern:**

```typescript
// Worker code accesses secrets via env parameter
export default {
  async fetch(request: Request, env: WorkerSecrets, ctx: ExecutionContext) {
    // Access Supabase
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Access encryption key for zero-knowledge operations
    const masterKey = env.MASTER_ENCRYPTION_KEY;

    // Use secrets...
  }
};
```

**Security Considerations:**

1. **Never log secrets** - Redact from logs
2. **Use service role key sparingly** - Bypass RLS only when absolutely necessary
3. **Rotate keys regularly** - Implement rotation procedures
4. **Master encryption key protection** - Critical for zero-knowledge architecture
5. **Environment separation** - Different keys for dev/staging/production

**Deployment:**

```bash
# Set secrets via Wrangler CLI
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put MASTER_ENCRYPTION_KEY
wrangler secret put CLAUDE_API_KEY
wrangler secret put FIRECRAWL_API_KEY

# List secrets (values are hidden)
wrangler secret list

# Delete secret
wrangler secret delete OLD_SECRET_NAME
```

---

## Data Flow

### Flow 1: Authenticated API Request

**Trigger:** User makes authenticated request to fetch secrets

**Steps:**

1. **Client:** User's web app sends request
   ```typescript
   fetch('https://api.abyrith.com/v1/secrets', {
     method: 'GET',
     headers: {
       'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...',
       'Content-Type': 'application/json',
     }
   });
   ```

2. **Cloudflare Edge:** Request hits nearest edge location
   - DDoS protection automatically applied
   - WAF rules checked
   - Request routed to Worker

3. **Worker - Authentication:** Extract and validate JWT
   ```typescript
   const token = extractToken(request.headers.get('Authorization'));
   const user = await validateJWT(token, env.SUPABASE_URL);
   // Verify token signature, expiration, claims
   ```

4. **Worker - Rate Limiting:** Check user's rate limit
   ```typescript
   const rateLimited = await checkRateLimit(user.id, 'minute', 100, env);
   if (rateLimited) {
     return new Response(JSON.stringify({
       error: 'rate_limit_exceeded',
       message: 'Too many requests',
       retry_after: 30
     }), { status: 429 });
   }
   ```

5. **Worker - Cache Check:** Look for cached response
   ```typescript
   const cached = await getCachedResponse(request, user, env);
   if (cached) {
     return cached; // Return immediately
   }
   ```

6. **Worker - Route Matching:** Determine backend service
   ```typescript
   const route = matchRoute(request);
   // Match: GET /api/v1/secrets -> Supabase backend
   ```

7. **Worker - Backend Proxy:** Forward request to Supabase
   ```typescript
   const supabaseResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/secrets`, {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${token}`, // Pass user's JWT
       'apikey': env.SUPABASE_ANON_KEY,
       'Content-Type': 'application/json',
     }
   });
   ```

8. **Supabase:**
   - Validates JWT
   - Enforces RLS policies
   - Queries database
   - Returns encrypted secrets (client-side decryption needed)

9. **Worker - Response Processing:**
   ```typescript
   // Add rate limit headers
   const headers = {
     ...supabaseResponse.headers,
     'X-RateLimit-Limit': '100',
     'X-RateLimit-Remaining': '95',
     'X-Cache': 'MISS',
   };

   return new Response(supabaseResponse.body, {
     status: supabaseResponse.status,
     headers,
   });
   ```

10. **Client:** Receives response, decrypts secrets client-side using master key

**Sequence Diagram:**

```
Client          Worker          KV          Supabase
  |               |             |              |
  |--request----->|             |              |
  |               |             |              |
  |               |--check----->|              |
  |               |   rate      |              |
  |               |<--limit-----|              |
  |               |             |              |
  |               |--query------+------------->|
  |               |             |    (RLS)     |
  |               |<--result----+--------------|
  |               |             |              |
  |<--response----|             |              |
  |               |             |              |
```

---

### Flow 2: Unauthenticated Request (Rate Limited)

**Trigger:** Anonymous user or attacker attempts excessive requests

**Steps:**

1. **Client:** Sends request without authentication
   ```typescript
   fetch('https://api.abyrith.com/v1/health');
   ```

2. **Worker - IP Extraction:** Get client IP from Cloudflare headers
   ```typescript
   const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
   ```

3. **Worker - Rate Limiting:** Check IP-based rate limit
   ```typescript
   const rateLimited = await checkRateLimit(
     `ip:${clientIP}`,
     'minute',
     20, // Lower limit for unauthenticated
     env
   );

   if (rateLimited) {
     return new Response(JSON.stringify({
       error: 'rate_limit_exceeded',
       message: 'Too many requests from your IP address',
       retry_after: 60
     }), {
       status: 429,
       headers: {
         'Retry-After': '60',
         'X-RateLimit-Limit': '20',
         'X-RateLimit-Remaining': '0',
       }
     });
   }
   ```

4. **Worker - Route Public Endpoints Only:** Allow only public routes
   ```typescript
   const route = matchRoute(request);
   if (route.requireAuth) {
     return new Response(JSON.stringify({
       error: 'unauthorized',
       message: 'Authentication required'
     }), { status: 401 });
   }
   ```

---

### Flow 3: AI Assistant Request

**Trigger:** User asks AI assistant for help acquiring an API key

**Steps:**

1. **Client:** Sends AI chat request
   ```typescript
   fetch('https://api.abyrith.com/v1/ai/chat', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer <jwt>',
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       message: 'How do I get a Google Gemini API key?',
       context: { project_id: 'uuid' }
     })
   });
   ```

2. **Worker - Authentication & Rate Limiting:**
   - Validate JWT
   - Check rate limit (lower limit for AI: 20/min)
   - Extract user context

3. **Worker - Claude API Proxy:** Forward to Claude API
   ```typescript
   const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
     method: 'POST',
     headers: {
       'x-api-key': env.CLAUDE_API_KEY,
       'anthropic-version': '2023-06-01',
       'content-type': 'application/json',
     },
     body: JSON.stringify({
       model: 'claude-3.5-sonnet',
       max_tokens: 4096,
       messages: [{
         role: 'user',
         content: buildPrompt(requestBody, userContext)
       }]
     })
   });
   ```

4. **Worker - Response Streaming:** Stream Claude's response back to client
   ```typescript
   // Stream response to client for real-time feel
   return new Response(claudeResponse.body, {
     headers: {
       'Content-Type': 'text/event-stream',
       'Cache-Control': 'no-cache',
       'Connection': 'keep-alive',
     }
   });
   ```

---

## API Contracts

### Internal APIs

**API: Authentication Middleware**

**Endpoint:** Internal middleware function

**Purpose:** Extract and validate JWT tokens from requests

**Request:**
```typescript
interface AuthenticateRequest {
  authHeader: string; // "Bearer <jwt>"
  supabaseUrl: string;
}
```

**Response (Success):**
```typescript
interface AuthenticatedUser {
  id: string;           // User UUID
  email: string;
  role: string;         // 'authenticated'
  aud: string;          // 'authenticated'
  exp: number;          // Expiration timestamp
  sub: string;          // Subject (user ID)
}
```

**Response (Error):**
```typescript
interface AuthError {
  error: 'invalid_token' | 'expired_token' | 'missing_token';
  message: string;
}
```

**Error Handling:**
- `401 Unauthorized` - Missing or invalid token
- `401 Unauthorized` - Expired token
- `403 Forbidden` - Valid token but insufficient permissions

---

**API: Rate Limit Check**

**Endpoint:** Internal function

**Purpose:** Check if request should be rate limited

**Request:**
```typescript
interface RateLimitCheck {
  identifier: string;   // User ID or IP address
  window: 'minute' | 'hour';
  limit: number;
}
```

**Response:**
```typescript
interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: number;      // Unix timestamp
  limit: number;
}
```

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Internet ↔ Cloudflare Edge**
- **Threats:** DDoS attacks, bot traffic, malicious requests, SQL injection attempts
- **Controls:**
  - Automatic DDoS mitigation (unlimited)
  - Web Application Firewall (WAF) rules
  - Bot management and CAPTCHA challenges
  - Rate limiting at edge before Worker execution
  - TLS 1.3 encryption for all traffic

**Boundary 2: Cloudflare Workers ↔ Supabase**
- **Threats:** Unauthorized data access, JWT forgery, RLS bypass attempts
- **Controls:**
  - JWT validation on every request
  - Pass-through authentication (user's JWT forwarded)
  - Row-Level Security enforced by Supabase
  - Service role key only used for specific admin operations
  - HTTPS-only communication

**Boundary 3: Cloudflare Workers ↔ External APIs (Claude, FireCrawl)**
- **Threats:** API key leakage, rate limit abuse, excessive costs
- **Controls:**
  - API keys stored in Worker secrets (encrypted at rest)
  - Never expose API keys to clients
  - Rate limiting on AI endpoints to control costs
  - Request/response logging for audit
  - Timeout limits to prevent hanging requests

### Authentication & Authorization

**Authentication:**
- Method: JWT Bearer tokens issued by Supabase Auth
- Token format: Standard JWT with header, payload, signature
- Token lifecycle:
  - Issued on login (15-60 minute expiration)
  - Refresh token used to obtain new access tokens
  - Stored in httpOnly cookies (web) or secure storage (mobile/CLI)

**Authorization:**
- Model: Role-Based Access Control (RBAC) enforced by Supabase RLS
- Enforcement points:
  1. Worker validates JWT signature and expiration
  2. Worker checks route requires authentication
  3. Supabase enforces RLS policies based on JWT claims
- Permission evaluation:
  - JWT contains user ID and role claims
  - RLS policies check `auth.uid()` against resource ownership
  - Workers don't make authorization decisions (delegated to Supabase RLS)

**JWT Validation Process:**

```typescript
async function validateJWT(token: string, supabaseUrl: string): Promise<User | null> {
  try {
    // Fetch Supabase public key (JWKS endpoint)
    const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
    const jwksResponse = await fetch(jwksUrl);
    const jwks = await jwksResponse.json();

    // Verify JWT signature using Web Crypto API
    const verified = await verifyJWTSignature(token, jwks);
    if (!verified) {
      return null;
    }

    // Parse payload
    const payload = JSON.parse(atob(token.split('.')[1]));

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      return null; // Expired
    }

    // Extract user info
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
    };

  } catch (error) {
    console.error('JWT validation failed:', error);
    return null;
  }
}
```

### Data Security

**Data at Rest:**
- **Worker Environment Variables:** Encrypted by Cloudflare at rest
- **KV Storage:** Encrypted at rest with Cloudflare-managed keys
- **Master Encryption Key:** Stored in Worker secrets, used for zero-knowledge envelope encryption

**Data in Transit:**
- **Client ↔ Workers:** TLS 1.3 with modern cipher suites
- **Workers ↔ Supabase:** HTTPS with mutual TLS possible
- **Workers ↔ External APIs:** HTTPS required

**Data in Use:**
- **Worker Memory:** Secrets loaded into Worker runtime memory
- **Request/Response Processing:** Encrypted data passes through but never decrypted (zero-knowledge)
- **Logging:** Secrets redacted from logs using sanitization

**Master Encryption Key Handling:**

```typescript
// Master key is stored in Worker secrets
// Used for envelope encryption of secrets in Supabase

// IMPORTANT: This key must be rotated if:
// 1. Employee with access leaves company
// 2. Suspected compromise
// 3. Regular rotation schedule (quarterly)

async function rotatemasterKey(oldKey: string, newKey: string, env: Env) {
  // 1. Fetch all encrypted secrets from Supabase
  const { data: secrets } = await supabase
    .from('secrets')
    .select('*');

  // 2. Re-encrypt each secret with new key
  for (const secret of secrets) {
    // Decrypt with old key
    const decrypted = await decrypt(secret.encrypted_value, oldKey);

    // Encrypt with new key
    const reencrypted = await encrypt(decrypted, newKey);

    // Update in database
    await supabase
      .from('secrets')
      .update({ encrypted_value: reencrypted })
      .eq('id', secret.id);
  }

  // 3. Update Worker secret
  // wrangler secret put MASTER_ENCRYPTION_KEY

  // 4. Audit log rotation
  await logAuditEvent({
    action: 'master_key_rotated',
    timestamp: new Date().toISOString(),
  });
}
```

### Threat Model

**Threat 1: API Key Extraction from Worker**
- **Description:** Attacker attempts to extract API keys stored in Worker environment
- **Likelihood:** Low
- **Impact:** Critical (full backend access)
- **Mitigation:**
  - API keys encrypted at rest in Cloudflare infrastructure
  - Worker code sandboxed in V8 isolates
  - No user-provided code execution in Workers
  - Regular security audits
  - Principle of least privilege (use anon key when possible)

**Threat 2: JWT Token Theft**
- **Description:** Attacker steals user's JWT token to impersonate them
- **Likelihood:** Medium
- **Impact:** High (access to user's secrets)
- **Mitigation:**
  - Short token expiration (15-60 minutes)
  - HttpOnly cookies for web (not accessible to JavaScript)
  - Refresh token rotation
  - Token revocation on logout
  - Monitor for suspicious activity patterns

**Threat 3: Rate Limit Bypass**
- **Description:** Attacker uses distributed IPs to bypass rate limits
- **Likelihood:** Medium
- **Impact:** Medium (increased costs, service degradation)
- **Mitigation:**
  - Multiple rate limiting layers (IP, user, endpoint)
  - Cloudflare Bot Management
  - CAPTCHA challenges for suspicious patterns
  - Cost alerts for unusual API usage
  - IP reputation scoring

**Threat 4: DDoS Attack**
- **Description:** Massive traffic volume overwhelms the service
- **Likelihood:** High (common attack)
- **Impact:** High (service unavailability)
- **Mitigation:**
  - Cloudflare automatic DDoS protection (unlimited)
  - Unmetered mitigation for all attack types
  - Global anycast network distributes load
  - Workers scale automatically
  - No single point of failure

**Threat 5: Supply Chain Attack (Compromised npm package)**
- **Description:** Malicious code in dependencies attempts to exfiltrate secrets
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:**
  - Minimal dependencies in Worker code
  - Dependabot security scanning
  - Lock file verification
  - Code review for dependency updates
  - Secrets never logged or transmitted outside Cloudflare network

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- API request (authenticated): < 200ms (p95), < 500ms (p99)
- API request (cached): < 50ms (p95), < 100ms (p99)
- Health check: < 20ms (p95), < 50ms (p99)
- AI request (streaming): First token < 2s, subsequent tokens < 100ms

**Throughput:**
- Sustained: 10,000 requests/second per region
- Burst: 100,000 requests/second globally
- AI requests: 100 requests/second

**Resource Usage:**
- Worker CPU time: < 10ms per request average
- Worker memory: < 128MB per isolate
- KV read latency: < 1ms
- KV write latency: < 10ms

### Optimization Strategy

**Frontend:**
- N/A (Worker handles backend only)

**Worker Optimizations:**
- **Minimize dependencies:** Use Web APIs instead of npm packages where possible
- **Lazy loading:** Load heavy modules only when needed
- **Streaming responses:** Stream large responses instead of buffering
- **Early returns:** Return cached responses before expensive operations
- **Parallel requests:** Use `Promise.all()` for independent operations

```typescript
// Example: Parallel validation
const [jwtValid, rateLimitOk] = await Promise.all([
  validateJWT(token, env),
  checkRateLimit(userId, 'minute', 100, env)
]);
```

**KV Optimizations:**
- Use batching for multiple KV operations
- Set appropriate TTLs to avoid stale data
- Use list operations sparingly (expensive)
- Cache frequently accessed data in Worker memory (careful with memory limits)

```typescript
// Example: In-memory cache for feature flags (read from KV once)
let featureFlags: FeatureFlags | null = null;

async function getFeatureFlags(env: Env): Promise<FeatureFlags> {
  if (featureFlags) {
    return featureFlags;
  }

  const flags = await env.KV.get('feature_flags');
  featureFlags = JSON.parse(flags || '{}');
  return featureFlags;
}
```

**Database:**
- Workers don't query database directly (delegated to Supabase)
- Use Supabase connection pooling
- Optimize Supabase RLS policies for performance

### Load Handling

**Expected Load:**
- MVP: 100 concurrent users, ~10 requests/second
- Year 1: 10,000 concurrent users, ~1,000 requests/second
- Year 2: 100,000 concurrent users, ~10,000 requests/second

**Scalability:**
- Workers scale automatically (no configuration)
- No cold starts (V8 isolates, not containers)
- Global distribution (200+ edge locations)
- Bottleneck: Supabase database (vertical/horizontal scaling available)

---

## Scalability

### Horizontal Scaling

**Workers:**
- Automatic horizontal scaling by Cloudflare
- Each edge location runs independent Worker instances
- No shared state between Workers (use KV for coordination)
- Can handle millions of requests per second globally

**KV Storage:**
- Eventually consistent global replication
- Reads are local to edge (low latency)
- Writes propagate globally (< 60 seconds)
- Suitable for: rate limits, feature flags, cache
- Not suitable for: strong consistency requirements

### Vertical Scaling

**Workers:**
- CPU: 50ms execution limit per request (can't scale vertically)
- Memory: 128MB per isolate (fixed)
- If hit limits: offload work to Supabase Edge Functions or Durable Objects

**KV Storage:**
- Storage: Unlimited
- Throughput: Scales with number of keys/reads
- No single key bottleneck (reads are distributed)

### Bottlenecks

**Current bottlenecks:**
- **Supabase Database:** Primary bottleneck for write-heavy workloads
  - Mitigation: Read replicas, connection pooling, query optimization
- **Claude API Rate Limits:** External API constraints
  - Mitigation: Request queuing, user-facing rate limits, model selection
- **Worker CPU Time:** 50ms limit for complex operations
  - Mitigation: Offload to Edge Functions, optimize code, use streaming

### Capacity Planning

**Current capacity (estimated):**
- Workers: Effectively unlimited with Cloudflare
- KV Storage: 1GB (free tier), 1TB+ (paid)
- Supabase: 8GB database (free), unlimited (paid)

**Growth projections:**
- Year 1: 10K users, 1M secrets, 100M API requests/month
- Year 2: 100K users, 10M secrets, 1B API requests/month
- Year 3: 500K users, 50M secrets, 5B API requests/month

**Scaling plan:**
- Month 1-6: Free tier sufficient
- Month 6-12: Upgrade Supabase to Pro ($25/month)
- Year 2: Supabase read replicas, Cloudflare Workers Paid ($5/month)
- Year 3: Dedicated Supabase instance, multi-region deployment

---

## Failure Modes

### Failure Mode 1: Supabase Database Unavailable

**Scenario:** Supabase experiences outage or database is unreachable

**Impact:** API requests fail, users cannot access secrets

**Detection:**
- Worker receives 5xx errors from Supabase
- Health check endpoint fails
- Sentry alerts triggered

**Recovery:**
1. Worker detects Supabase errors
2. Return cached responses if available (GET requests)
3. Queue writes to KV for later replay (POST/PUT requests)
4. Display user-friendly error message
5. Wait for Supabase to recover
6. Replay queued operations

**Prevention:**
- Use Supabase health check endpoint before requests
- Implement circuit breaker pattern (stop requests if failure rate > 50%)
- Set up monitoring and alerts

```typescript
// Circuit breaker implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      // Check if we should try again (half-open state)
      if (Date.now() - this.lastFailureTime > 30000) {
        this.isOpen = false;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.failures = 0; // Reset on success
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= 5) {
        this.isOpen = true; // Open circuit after 5 failures
      }

      throw error;
    }
  }
}
```

---

### Failure Mode 2: Worker CPU Time Exceeded

**Scenario:** Worker exceeds 50ms CPU time limit on a request

**Impact:** Request fails with 500 error, user sees error message

**Detection:**
- Cloudflare logs show "CPU time limit exceeded"
- Increased 500 error rate
- Monitoring alerts triggered

**Recovery:**
1. Worker returns 500 error with retry guidance
2. User retries request
3. Investigate which operation caused timeout
4. Optimize slow code path or offload to Edge Function

**Prevention:**
- Profile Worker code to identify slow paths
- Use streaming for large responses
- Offload heavy operations to Supabase Edge Functions
- Set timeout limits on external API calls

```typescript
// Timeout wrapper for fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
```

---

### Failure Mode 3: KV Storage Unavailable

**Scenario:** Cloudflare KV is down or slow

**Impact:** Rate limiting and caching unavailable, increased backend load

**Detection:**
- KV operations timeout or fail
- Increased latency
- Fallback to non-cached responses

**Recovery:**
1. Worker detects KV failures
2. Disable rate limiting temporarily (allow all requests)
3. Skip cache checks (fetch from backend directly)
4. Log KV failures for investigation
5. Wait for KV to recover

**Prevention:**
- Set short timeouts on KV operations (1 second)
- Always have fallback behavior when KV unavailable
- Don't block requests on KV failures

```typescript
async function getRateLimitWithFallback(userId: string, env: Env): Promise<boolean> {
  try {
    const limited = await checkRateLimit(userId, 'minute', 100, env);
    return limited;
  } catch (error) {
    console.error('Rate limit check failed, allowing request:', error);
    return false; // Allow request if rate limit check fails
  }
}
```

---

### Failure Mode 4: Claude API Rate Limit Exceeded

**Scenario:** Worker exceeds Claude API rate limits

**Impact:** AI assistant requests fail, degraded user experience

**Detection:**
- Claude API returns 429 status code
- Increased AI request failures
- User-facing error messages

**Recovery:**
1. Worker detects 429 response
2. Queue AI requests with exponential backoff
3. Display user-friendly message with retry time
4. Implement request prioritization (paid users first)

**Prevention:**
- Track Claude API usage in KV
- Implement request queue with rate limiting
- Use lower rate limits than Claude allows (buffer)
- Upgrade Claude API plan if consistently hitting limits

---

### Disaster Recovery

**Recovery Time Objective (RTO):** 1 hour

**Recovery Point Objective (RPO):** 5 minutes

**Backup Strategy:**
- Workers: Code in GitHub, deployed via Wrangler
- KV Storage: Not backed up (ephemeral cache data)
- Secrets: Stored in 1Password + Wrangler secrets
- Database: Supabase automatic backups (handled by dependency)

**Recovery Procedure:**
1. Verify Cloudflare Workers status page
2. If Worker deployment issue: redeploy from GitHub (`wrangler publish`)
3. If KV issue: wait for Cloudflare to restore service
4. If secret loss: restore from 1Password + re-run `wrangler secret put`
5. If complete failure: provision new Cloudflare account, redeploy Workers
6. Update DNS if switching Cloudflare accounts
7. Test all endpoints after recovery

---

## Alternatives Considered

### Alternative 1: AWS Lambda for API Gateway

**Description:** Use AWS Lambda functions behind API Gateway instead of Cloudflare Workers

**Pros:**
- More mature ecosystem and tooling
- Longer CPU time limits (15 minutes vs 50ms)
- Larger package size limits (250MB vs 1MB)
- Native AWS service integration

**Cons:**
- Cold starts (100-1000ms latency spikes)
- More complex configuration (VPC, IAM, API Gateway)
- Higher costs at scale
- Not at global edge (higher latency)
- Requires separate CDN (CloudFront)

**Why not chosen:**
Cold starts are unacceptable for API gateway use case. Cloudflare Workers provide zero cold starts and global edge distribution out of the box.

---

### Alternative 2: Vercel Edge Functions

**Description:** Use Vercel Edge Functions for API routing

**Pros:**
- Similar to Workers (edge-deployed)
- Excellent Next.js integration
- Simple deployment workflow
- Good developer experience

**Cons:**
- Locked into Vercel ecosystem
- Less control over edge infrastructure
- Higher costs than Cloudflare Workers
- No equivalent to Workers KV (must use external service)
- Cloudflare provides more comprehensive security features

**Why not chosen:**
Cloudflare provides better price/performance ratio and more control over infrastructure. Also, Cloudflare's security features (DDoS protection, WAF) are best-in-class.

---

### Alternative 3: Traditional Server (Express.js on VPS)

**Description:** Run Node.js Express server on virtual private server

**Pros:**
- Complete control over environment
- No execution time limits
- Familiar Node.js ecosystem
- Easy local development

**Cons:**
- Must manage server infrastructure
- No automatic scaling
- Single region deployment (higher latency)
- Cold starts if using autoscaling
- Higher operational overhead
- Manual DDoS protection and security

**Why not chosen:**
Serverless edge architecture provides better scalability, lower latency globally, and less operational burden. Abyrith needs to focus on product features, not infrastructure management.

---

### Alternative 4: Direct Client-to-Supabase (No API Gateway)

**Description:** Have frontend call Supabase directly, bypass Workers entirely

**Pros:**
- Simpler architecture (one less layer)
- Lower latency (fewer hops)
- Reduced costs (no Worker execution)
- Easier debugging

**Cons:**
- No central rate limiting (must implement in database)
- No request transformation or validation layer
- Difficult to integrate multiple backends (Claude API, FireCrawl)
- No edge caching
- Cannot hide API keys (must be client-side or in Supabase functions)
- Less control over security policies

**Why not chosen:**
API gateway pattern provides critical benefits: rate limiting, request validation, multi-backend orchestration, and security policy enforcement. The latency cost (< 10ms) is acceptable for these benefits.

---

## Decision Log

### Decision 1: Use Workers KV for Rate Limiting

**Date:** 2025-10-30

**Context:**
Need to implement rate limiting to prevent API abuse. Options include in-memory counters, KV storage, or external Redis.

**Options:**
1. **In-memory counters** - Fast but lost on Worker restart, inconsistent across edge locations
2. **Workers KV** - Eventually consistent, global, managed by Cloudflare
3. **External Redis** - Strong consistency, more features, requires separate service

**Decision:** Use Workers KV for rate limiting

**Rationale:**
- KV provides global coordination across edge locations
- Eventually consistent is acceptable for rate limiting (1-minute resolution)
- No additional infrastructure to manage
- Sub-millisecond latency for reads
- Built-in TTL for automatic cleanup

**Consequences:**
- Rate limits may be slightly delayed across regions (< 60s)
- Cannot do complex rate limiting algorithms (token bucket)
- Must handle KV unavailability gracefully

---

### Decision 2: Store Master Encryption Key in Worker Secrets

**Date:** 2025-10-30

**Context:**
Zero-knowledge architecture requires master encryption key to be accessible to Workers for envelope encryption. Options include Worker secrets, external key management service (KMS), or Supabase.

**Options:**
1. **Worker Secrets** - Encrypted at rest, accessed via env variable
2. **External KMS (AWS KMS, Vault)** - Centralized key management, audit logging
3. **Supabase** - Store encrypted in database

**Decision:** Store master encryption key in Worker Secrets

**Rationale:**
- Worker secrets are encrypted at rest by Cloudflare
- No external service dependency (lower latency)
- Simple to rotate via Wrangler CLI
- Reduces attack surface (fewer systems with key access)
- Acceptable security posture for MVP

**Consequences:**
- Key rotation requires manual process (re-encrypt all secrets)
- Limited audit logging (must implement custom logging)
- Must trust Cloudflare security (acceptable trade-off)
- Future: may migrate to external KMS for enterprise compliance

---

### Decision 3: Implement Circuit Breaker for Supabase

**Date:** 2025-10-30

**Context:**
When Supabase is experiencing issues, continued requests can worsen the situation. Need pattern to detect failures and stop sending requests temporarily.

**Options:**
1. **No circuit breaker** - Retry every request, hope Supabase recovers
2. **Simple circuit breaker** - Stop after N failures, retry after timeout
3. **Hystrix-style circuit breaker** - Complex state machine with metrics

**Decision:** Implement simple circuit breaker with half-open state

**Rationale:**
- Prevents overwhelming Supabase during outages
- Simple implementation (< 50 lines of code)
- Allows automatic recovery (half-open state tests health)
- Improves error messages to users (fail fast when circuit open)

**Consequences:**
- Adds complexity to Worker code
- Must tune thresholds (failure count, timeout duration)
- Risk of false positives (temporarily block healthy service)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `05-api/api-rest-design.md` - REST API design patterns and conventions (⚠️ **Missing but referenced**)
- [x] `02-architecture/system-overview.md` - Overall system architecture context
- [x] `TECH-STACK.md` - Technology decisions and versions

**External Services:**
- Cloudflare Workers - Serverless execution environment (SLA: 99.99%)
- Cloudflare Workers KV - Key-value storage (SLA: 99.9%)
- Supabase - Backend database and API (SLA: 99.9%)
- Claude API - AI assistant functionality (SLA: 99.9%)
- FireCrawl - Documentation scraping (No SLA published)

### Architecture Dependencies

**Depends on these components:**
- `Supabase Backend` - Primary data source for API requests
- `Supabase Auth` - JWT token generation and validation
- `Client-side Encryption` - Master key stored in Workers used for envelope encryption

**Required by these components:**
- `Frontend Application` - Depends on Workers API gateway for all backend communication
- `CLI Tool` - Depends on Workers API for secret management
- `MCP Server` - Depends on Workers for MCP endpoint routing
- `Browser Extension` - Depends on Workers API for autofill

---

## References

### Internal Documentation
- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions
- `03-security/security-model.md` - Zero-knowledge encryption details (when created)
- `04-database/database-overview.md` - Database schema (when created)

### External Resources
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/) - Official Workers guide
- [Workers KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/) - KV storage API
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) - CPU time, memory, size limits
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) - Deployment tool
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Encryption in Workers
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html) - Failure handling pattern

### Design Patterns Used
- API Gateway Pattern - Central request routing and orchestration
- Circuit Breaker Pattern - Failure detection and recovery
- Rate Limiting Pattern - Abuse prevention
- Cache-Aside Pattern - Edge caching strategy

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial Cloudflare Workers architecture document |

---

## Notes

### Future Enhancements
- Implement request queuing for AI endpoints when rate limited
- Add support for WebSocket connections via Durable Objects
- Implement distributed tracing for request flows
- Add more sophisticated caching strategies (surrogate keys, cache tags)
- Migrate to external KMS for enterprise key management
- Add request replay functionality for failed operations

### Known Issues
- Rate limiting is eventually consistent across regions (< 60s delay)
- Circuit breaker thresholds need tuning based on production traffic
- Master encryption key rotation requires manual re-encryption process
- KV storage is not suitable for strong consistency requirements

### Next Review Date
2025-11-30 - Review after initial Worker implementation and testing
