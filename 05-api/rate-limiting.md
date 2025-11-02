---
Document: API Rate Limiting - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 05-api/api-rest-design.md, 06-backend/cloudflare-workers/workers-architecture.md, TECH-STACK.md, GLOSSARY.md
---

# API Rate Limiting Architecture

## Overview

This document defines the comprehensive rate limiting strategy for the Abyrith API, specifying per-endpoint throttling rules, enforcement mechanisms, client handling best practices, and monitoring approaches. Rate limiting protects the platform from abuse, ensures fair resource allocation across users, and maintains consistent performance under load.

**Purpose:** Establish a robust, predictable rate limiting system that prevents API abuse while providing excellent developer experience through clear feedback, gradual escalation, and transparent limits.

**Scope:** All REST API endpoints exposed by Cloudflare Workers and PostgREST, including authenticated and unauthenticated requests. Excludes WebSocket connections (Supabase Realtime).

**Status:** Draft - Subject to refinement based on production traffic patterns

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Rate Limit Rules](#rate-limit-rules)
5. [Per-Endpoint Limits](#per-endpoint-limits)
6. [Throttling Strategy](#throttling-strategy)
7. [Implementation Details](#implementation-details)
8. [Rate Limit Headers](#rate-limit-headers)
9. [Error Responses](#error-responses)
10. [Client Handling Recommendations](#client-handling-recommendations)
11. [Monitoring & Alerting](#monitoring--alerting)
12. [Testing Strategy](#testing-strategy)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith's API requires robust rate limiting to protect against abuse, prevent resource exhaustion, and ensure equitable service for all users. Without proper rate limiting, a single malicious or misconfigured client could degrade service for all users.

**Pain points:**
- Denial-of-service vulnerabilities from unlimited request rates
- Unfair resource consumption by heavy users affecting others
- Database connection pool exhaustion from request storms
- Cloudflare Workers CPU time abuse impacting billing
- Lack of visibility into abuse patterns
- Difficulty distinguishing legitimate spikes from attacks

**Why now?**
Rate limiting must be implemented before public API access to prevent production incidents and ensure predictable platform behavior.

### Background

**Existing system:**
This is a greenfield implementation. API design document (05-api/api-rest-design.md) establishes baseline limits (1,000 req/hour authenticated, 100 req/hour unauthenticated) but lacks detailed enforcement and per-endpoint specifications.

**Previous attempts:**
N/A - Initial design.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Backend Team | Implement rate limiting, prevent abuse | Complexity, false positives blocking legitimate users |
| Security Lead | Protect against DoS attacks, brute force | Bypass attempts, distributed attacks |
| Product Lead | Fair usage, good UX for legitimate users | User frustration from hitting limits |
| AI Integration Team | MCP tool limits, token efficiency | Claude Code/Cursor workflows disrupted by limits |
| Enterprise Customers | High throughput for automation | Sufficient limits for CI/CD pipelines |
| Support Team | Handle limit complaints, debugging | Clear error messages, visibility into usage |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Abuse Prevention** - Block malicious actors from overwhelming the API (success metric: 0 production incidents from API abuse)
2. **Fair Resource Allocation** - Ensure equitable access for all users (success metric: <0.5% legitimate requests blocked)
3. **Predictable Performance** - Maintain consistent API response times under load (success metric: p95 latency <500ms even at limit)
4. **Developer Transparency** - Provide clear limit information and helpful errors (success metric: <5% support tickets related to rate limiting)

**Secondary goals:**
- Support tiered limits based on subscription plans (Free/Team/Enterprise)
- Enable dynamic limit adjustments without code changes
- Provide self-service limit monitoring dashboards
- Allow temporary limit increases for special events

### Non-Goals

**Explicitly out of scope:**
- **Per-organization custom limits** - Standard tiers only for MVP; custom limits post-MVP
- **Content-based rate limiting** - Only request count limits; payload size limits separate feature
- **Geographic rate limiting** - Global limits only; geo-specific limits not needed
- **Real-time limit negotiations** - Clients cannot request limit increases via API
- **Machine learning-based anomaly detection** - Rule-based limits only for MVP

### Success Metrics

**How we measure success:**
- **Availability**: 99.9% API uptime maintained despite attack attempts
- **Fairness**: <0.5% false positive rate (legitimate requests blocked)
- **Performance**: p95 latency stays <500ms at 80% of rate limits
- **Clarity**: <5% of rate limit errors result in support tickets

---

## Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────┐
│            API Clients                   │
│  • Frontend (React/Next.js)              │
│  • CLI Tool                              │
│  • MCP Clients (Claude Code, Cursor)    │
│  • Third-party integrations              │
└────────────────┬─────────────────────────┘
                 │
                 │ HTTPS + JWT + Headers
                 │
                 ▼
┌──────────────────────────────────────────┐
│    Cloudflare Workers (API Gateway)      │
│  ┌────────────────────────────────────┐  │
│  │    Rate Limiting Middleware        │  │
│  │  • Extract user_id from JWT        │  │
│  │  • Extract IP address              │  │
│  │  • Determine applicable limits     │  │
│  │  • Check current usage             │  │
│  │  • Increment counters              │  │
│  │  • Add rate limit headers          │  │
│  │  • Return 429 if exceeded          │  │
│  └────────────────────────────────────┘  │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│        Cloudflare Workers KV             │
│  • Per-user counters:                    │
│    ratelimit:user:{user_id}:{window}     │
│  • Per-IP counters:                      │
│    ratelimit:ip:{ip}:{window}            │
│  • Per-endpoint counters:                │
│    ratelimit:user:{user_id}:             │
│      {endpoint}:{window}                 │
│  • Sliding window buckets (1 hour TTL)  │
└──────────────────────────────────────────┘
```

### Key Components

**Component 1: Rate Limiting Middleware (Cloudflare Workers)**
- **Purpose:** Intercept all API requests, enforce rate limits, return standardized responses
- **Technology:** TypeScript on Cloudflare Workers (V8 runtime)
- **Responsibilities:**
  - Extract authentication context (JWT user_id or client IP)
  - Determine applicable limits based on endpoint and user plan tier
  - Check current usage against limits using Workers KV
  - Increment request counters atomically
  - Add X-RateLimit-* headers to all responses
  - Return 429 Too Many Requests when limits exceeded
  - Log rate limit violations for monitoring

**Component 2: Workers KV (Counter Storage)**
- **Purpose:** Store request counters with automatic expiration
- **Technology:** Cloudflare Workers KV (edge key-value store)
- **Responsibilities:**
  - Store per-user hourly request counts
  - Store per-IP hourly request counts
  - Store per-user per-endpoint minute/hour counts
  - Automatic expiration after window closes (TTL)
  - Low-latency reads/writes (<10ms)
  - Eventually consistent updates (acceptable for rate limiting)

**Component 3: Rate Limit Configuration (Environment Variables)**
- **Purpose:** Define limits per endpoint and user tier
- **Technology:** Cloudflare Workers environment variables + wrangler.toml
- **Responsibilities:**
  - Store default limits (authenticated/unauthenticated)
  - Store per-endpoint overrides
  - Store tier-based multipliers (Free: 1x, Team: 5x, Enterprise: 10x)
  - Enable runtime limit adjustments without code deploys

**Component 4: Monitoring & Analytics (Cloudflare Analytics Engine)**
- **Purpose:** Track rate limit metrics for alerting and capacity planning
- **Technology:** Cloudflare Analytics Engine
- **Responsibilities:**
  - Count rate limit violations by endpoint
  - Track top violating users and IPs
  - Measure legitimate request rejection rate
  - Alert on anomalous patterns (distributed attacks)

---

## Rate Limit Rules

### Global Limits

**Authenticated Users (Free Tier):**
- **1,000 requests per hour** (all endpoints combined)
- Tracked by JWT `sub` claim (user_id)
- Sliding window: resets every hour
- Applies to all users without paid subscription

**Unauthenticated Requests:**
- **100 requests per hour** per IP address
- Tracked by client IP (Cloudflare header: CF-Connecting-IP)
- Sliding window: resets every hour
- Applies to public endpoints only (health, API catalog)

**Tier Multipliers:**
| Tier | Multiplier | Effective Limit |
|------|------------|-----------------|
| Free | 1x | 1,000 req/hour |
| Team ($25/month) | 5x | 5,000 req/hour |
| Enterprise (custom) | 10x+ | 10,000+ req/hour |

### Rate Limit Algorithm

**Sliding Window Counter (Cloudflare Workers KV):**

```typescript
// Pseudo-code for sliding window rate limiting
async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowSeconds: number,
  env: Env
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / windowSeconds);
  const previousWindow = currentWindow - 1;

  // Keys for current and previous window
  const currentKey = `ratelimit:user:${userId}:${endpoint}:${currentWindow}`;
  const previousKey = `ratelimit:user:${userId}:${endpoint}:${previousWindow}`;

  // Get counts from both windows
  const [currentCount, previousCount] = await Promise.all([
    env.KV.get(currentKey).then(v => parseInt(v || '0')),
    env.KV.get(previousKey).then(v => parseInt(v || '0'))
  ]);

  // Calculate weighted count for smooth sliding window
  const windowProgress = (now % windowSeconds) / windowSeconds;
  const weightedCount = Math.floor(
    currentCount + previousCount * (1 - windowProgress)
  );

  if (weightedCount >= limit) {
    const resetAt = (currentWindow + 1) * windowSeconds;
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: resetAt,
      retryAfter: resetAt - now
    };
  }

  // Increment current window counter
  await env.KV.put(
    currentKey,
    String(currentCount + 1),
    { expirationTtl: windowSeconds * 2 } // Keep 2 windows for sliding calculation
  );

  return {
    allowed: true,
    limit,
    remaining: limit - weightedCount - 1,
    reset: (currentWindow + 1) * windowSeconds
  };
}
```

**Why sliding window?**
- Smoother user experience than fixed windows
- Prevents burst exploitation at window boundaries
- Minimal additional storage (2x window keys)

---

## Per-Endpoint Limits

### Endpoint Categories

**Category 1: Public Endpoints (Unauthenticated)**
| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `GET /health` | 100/hour | IP | Monitoring scripts, health checks |
| `GET /v1/api-service-info` | 100/hour | IP | Public API catalog browsing |
| `POST /auth/v1/token` | **10/hour** | IP | Brute force protection |
| `POST /auth/v1/signup` | **10/hour** | IP | Prevent mass account creation |
| `POST /auth/v1/recover` | **3/hour** | IP | Prevent password reset spam |

**Category 2: Authentication Endpoints (Authenticated)**
| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `POST /auth/v1/token` | **10/hour** | User | Login attempts |
| `POST /auth/v1/refresh` | 60/hour | User | Token refreshes (1 per minute reasonable) |
| `POST /auth/v1/logout` | 60/hour | User | Normal logout frequency |
| `PUT /auth/v1/user` | 10/hour | User | Profile updates infrequent |
| `POST /auth/v1/mfa/enroll` | 5/hour | User | MFA setup rare |
| `POST /auth/v1/mfa/verify` | 20/hour | User | MFA challenges |

**Category 3: Secrets Endpoints (Authenticated)**
| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `GET /v1/secrets` | **500/hour** | User | More sensitive than general API |
| `GET /v1/secrets/:id` | **500/hour** | User | Individual secret access |
| `POST /v1/secrets` | 100/hour | User | Secret creation reasonable |
| `PUT /v1/secrets/:id` | 100/hour | User | Secret updates |
| `DELETE /v1/secrets/:id` | 100/hour | User | Secret deletion |
| `POST /v1/secrets/:id/rotate` | 20/hour | User | Rotation infrequent |
| `GET /v1/projects/:id/secrets` | **500/hour** | User | List project secrets |

**Category 4: Project Management Endpoints**
| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `GET /v1/projects` | 1000/hour | User | Global limit (frequent access) |
| `GET /v1/projects/:id` | 1000/hour | User | Global limit |
| `POST /v1/projects` | 50/hour | User | Project creation infrequent |
| `PUT /v1/projects/:id` | 100/hour | User | Updates infrequent |
| `DELETE /v1/projects/:id` | 10/hour | User | Rare operation |
| `POST /v1/projects/:id/members` | 50/hour | User | Team invitations |

**Category 5: MCP Integration Endpoints (AI Tools)**
| Endpoint | Limit (Free) | Limit (Team) | Limit (Enterprise) | Rationale |
|----------|--------------|--------------|-------------------|-----------|
| `POST /v1/mcp/secrets/list` | **200/hour** | 1000/hour | 10,000/hour | Claude Code/Cursor queries |
| `POST /v1/mcp/secrets/get` | **200/hour** | 1000/hour | 10,000/hour | Secret retrieval with approval |
| `POST /v1/mcp/secrets/request` | **50/hour** | 200/hour | 1,000/hour | AI-assisted research (expensive) |
| `POST /v1/mcp/secrets/search` | **200/hour** | 1000/hour | 10,000/hour | Fuzzy search queries |
| `POST /v1/mcp/approvals` | 100/hour | 500/hour | 5,000/hour | Approval creation |

**Category 6: AI Assistant Endpoints**
| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `POST /v1/ai/chat` | **100/hour** | User | Claude API cost protection |
| `POST /v1/ai/research` | **10/hour** | User | FireCrawl API expensive |
| `GET /v1/ai/conversations` | 100/hour | User | Conversation history |
| `DELETE /v1/ai/conversations/:id` | 20/hour | User | Cleanup infrequent |

**Category 7: Audit & Compliance Endpoints**
| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `GET /v1/audit-logs` | 100/hour | User | Log queries reasonable |
| `POST /v1/compliance/reports` | **5/hour** | User | Report generation expensive |
| `GET /v1/compliance/exports` | 10/hour | User | Export downloads |

### Limit Hierarchy

**Priority Order (most specific wins):**
1. **Endpoint-specific user limit** (e.g., `/v1/mcp/secrets/get`: 200/hour)
2. **Category-wide user limit** (e.g., all secrets endpoints: 500/hour)
3. **Global authenticated limit** (1,000/hour base, multiplied by tier)
4. **IP-based unauthenticated limit** (100/hour for public endpoints)

**Example Resolution:**
- User on Free tier makes `GET /v1/secrets/:id` request
- Check endpoint-specific limit: 500/hour (✓ applied)
- Check global limit: 1,000/hour (✓ still within)
- Most restrictive limit (500/hour) is enforced

---

## Throttling Strategy

### Gradual Enforcement

**Soft Limits (Warning Phase):**
- At **80% of limit**: Add `X-RateLimit-Warning` header
- Response: `HTTP 200 OK` with warning header
- Client receives early signal to slow down

**Hard Limits (Enforcement Phase):**
- At **100% of limit**: Return `HTTP 429 Too Many Requests`
- Response: JSON error with retry-after guidance
- Subsequent requests blocked until window resets

### Burst Allowance

**Token Bucket Enhancement (Future):**
- Allow short bursts above sustained rate
- Example: 1,000/hour = ~17/min sustained, allow 50/min burst
- Burst bucket refills at sustained rate

**Current Implementation:**
- Sliding window only (no burst allowance yet)
- Plan to add token bucket post-MVP based on usage patterns

### Exemptions

**Service Accounts (Future):**
- Special service role keys exempt from rate limits
- Used for internal operations, migrations
- Requires explicit approval and audit logging

**Maintenance Windows:**
- Rate limits can be temporarily disabled via environment variable
- Requires Engineering Lead approval
- Automatic re-enablement after window

---

## Implementation Details

### Rate Limit Middleware

**Location:** `06-backend/cloudflare-workers/middleware/rate-limit.ts`

**Implementation:**

```typescript
import { Env } from '../types';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds until reset
}

/**
 * Rate limiting middleware for Cloudflare Workers
 * Enforces per-user, per-IP, and per-endpoint limits
 */
export async function rateLimitMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  const endpoint = url.pathname;

  // Extract user context (if authenticated)
  const userId = request.headers.get('X-User-ID'); // Set by auth middleware
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Determine applicable limits
  const limits = getApplicableLimits(endpoint, userId, env);

  // Check all applicable limits
  const results = await Promise.all(
    limits.map(limit => checkRateLimit(userId || clientIp, endpoint, limit, env))
  );

  // Find most restrictive limit that was exceeded
  const violated = results.find(r => !r.allowed);

  if (violated) {
    // Rate limit exceeded
    return new Response(
      JSON.stringify({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Please try again in ${violated.retryAfter} seconds.`,
          details: {
            limit: violated.limit,
            remaining: 0,
            reset_at: new Date(violated.reset * 1000).toISOString(),
            retry_after: violated.retryAfter
          },
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(violated.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(violated.reset),
          'Retry-After': String(violated.retryAfter)
        }
      }
    );
  }

  // Rate limit not exceeded, add headers and continue
  const mostRestrictive = results.reduce((min, curr) =>
    curr.remaining < min.remaining ? curr : min
  );

  // Attach rate limit info to request for response headers
  // @ts-ignore - Custom property
  request.rateLimitInfo = mostRestrictive;

  // Continue to next middleware
  return null;
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  rateLimitInfo: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(rateLimitInfo.limit));
  headers.set('X-RateLimit-Remaining', String(rateLimitInfo.remaining));
  headers.set('X-RateLimit-Reset', String(rateLimitInfo.reset));

  // Warning header if approaching limit
  if (rateLimitInfo.remaining < rateLimitInfo.limit * 0.2) {
    headers.set('X-RateLimit-Warning', 'Approaching rate limit');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Get applicable rate limits for endpoint and user
 */
function getApplicableLimits(
  endpoint: string,
  userId: string | null,
  env: Env
): Array<{ limit: number; window: number; scope: string }> {
  const limits: Array<{ limit: number; window: number; scope: string }> = [];

  // Get user tier multiplier
  const tierMultiplier = userId ? getUserTierMultiplier(userId, env) : 1;

  // Endpoint-specific limits (most restrictive)
  if (endpoint.startsWith('/v1/secrets')) {
    limits.push({ limit: 500 * tierMultiplier, window: 3600, scope: 'secrets' });
  } else if (endpoint.startsWith('/v1/mcp')) {
    limits.push({ limit: 200 * tierMultiplier, window: 3600, scope: 'mcp' });
  } else if (endpoint.startsWith('/v1/ai')) {
    limits.push({ limit: 100 * tierMultiplier, window: 3600, scope: 'ai' });
  } else if (endpoint === '/auth/v1/token') {
    limits.push({ limit: 10, window: 3600, scope: 'login' }); // No tier multiplier for auth
  }

  // Global authenticated limit
  if (userId) {
    limits.push({ limit: 1000 * tierMultiplier, window: 3600, scope: 'global' });
  } else {
    // Unauthenticated IP-based limit
    limits.push({ limit: 100, window: 3600, scope: 'ip' });
  }

  return limits;
}

/**
 * Get user's subscription tier multiplier
 */
async function getUserTierMultiplier(userId: string, env: Env): Promise<number> {
  // Cache tier multipliers in KV for 1 hour
  const cacheKey = `tier:${userId}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) return parseInt(cached);

  // Query Supabase for user's subscription tier
  // For now, return default (implement after subscription system)
  return 1; // Free tier
}
```

### KV Storage Keys

**Key Patterns:**
```
ratelimit:user:{user_id}:global:{window}            # Global user limit
ratelimit:user:{user_id}:secrets:{window}           # Secrets category limit
ratelimit:user:{user_id}:mcp:{window}               # MCP category limit
ratelimit:user:{user_id}:{endpoint_hash}:{window}   # Endpoint-specific limit
ratelimit:ip:{ip_address}:{window}                  # IP-based limit
```

**Window Calculation:**
```typescript
const now = Math.floor(Date.now() / 1000); // Unix timestamp
const window = Math.floor(now / 3600); // Hourly window (0, 1, 2, ...)
```

**TTL Strategy:**
- Store current window counter (TTL: 2 hours)
- Store previous window counter (TTL: 2 hours)
- Sliding window calculation uses both
- Old windows auto-expire (no manual cleanup needed)

---

## Rate Limit Headers

### Standard Headers

**Every API response includes:**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1730336400
X-RateLimit-Policy: user:global:1h
```

**Header Definitions:**

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-RateLimit-Limit` | Integer | Maximum requests allowed in window | `1000` |
| `X-RateLimit-Remaining` | Integer | Requests remaining in current window | `847` |
| `X-RateLimit-Reset` | Unix Timestamp | When limit resets (seconds since epoch) | `1730336400` |
| `X-RateLimit-Policy` | String | Identifier for applied policy | `user:secrets:1h` |

### Warning Header

**Added when remaining < 20% of limit:**
```http
X-RateLimit-Warning: Approaching rate limit
```

**Client behavior:**
- Log warning for debugging
- Consider implementing backoff
- Display notification to user (optional)

### 429 Response Headers

**When limit exceeded:**
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730336400
Retry-After: 2856
```

**Additional 429 Header:**

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `Retry-After` | Integer | Seconds until retry allowed | `2856` |

---

## Error Responses

### 429 Too Many Requests

**Standard Error Format:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 47 minutes.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2025-10-30T14:00:00.000Z",
      "retry_after": 2856,
      "policy": "user:global:1h"
    },
    "request_id": "req_7f8e9d0c1b2a3456",
    "timestamp": "2025-10-30T13:12:24.000Z"
  }
}
```

### Endpoint-Specific 429 Examples

**Secrets Endpoint:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Secret access rate limit exceeded. You've made 500 requests in the past hour. Please try again in 32 minutes.",
    "details": {
      "limit": 500,
      "remaining": 0,
      "reset_at": "2025-10-30T14:00:00.000Z",
      "retry_after": 1920,
      "policy": "user:secrets:1h",
      "suggestion": "Consider upgrading to Team plan for 5,000 requests/hour"
    },
    "request_id": "req_abc123",
    "timestamp": "2025-10-30T13:28:00.000Z"
  }
}
```

**Login Endpoint:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again in 45 minutes.",
    "details": {
      "limit": 10,
      "remaining": 0,
      "reset_at": "2025-10-30T14:00:00.000Z",
      "retry_after": 2700,
      "policy": "ip:login:1h",
      "suggestion": "If you forgot your password, use the 'Forgot Password' link"
    },
    "request_id": "req_xyz789",
    "timestamp": "2025-10-30T13:15:00.000Z"
  }
}
```

**AI Research Endpoint:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "AI research rate limit exceeded. You've used 10 research requests in the past hour. Please try again in 18 minutes.",
    "details": {
      "limit": 10,
      "remaining": 0,
      "reset_at": "2025-10-30T14:00:00.000Z",
      "retry_after": 1080,
      "policy": "user:ai-research:1h",
      "suggestion": "AI research uses FireCrawl API credits. Consider manual documentation lookup for faster answers."
    },
    "request_id": "req_def456",
    "timestamp": "2025-10-30T13:42:00.000Z"
  }
}
```

---

## Client Handling Recommendations

### Best Practices for Clients

**1. Check Rate Limit Headers Before Making Requests**
```typescript
async function makeApiRequest(url: string, options: RequestInit) {
  // Check last known remaining count from previous response
  const lastRemaining = getLastRateLimitRemaining();

  if (lastRemaining !== null && lastRemaining < 10) {
    // Approaching limit, add exponential backoff
    await sleep(1000 * Math.pow(2, 10 - lastRemaining));
  }

  const response = await fetch(url, options);

  // Store rate limit info for next request
  storeRateLimitInfo(response.headers);

  return response;
}
```

**2. Implement Exponential Backoff for 429 Errors**
```typescript
async function makeApiRequestWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    // Rate limit exceeded
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');

    if (attempt < maxRetries - 1) {
      // Wait with exponential backoff
      const waitTime = Math.min(retryAfter * 1000, 60000); // Max 60 seconds
      console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }

  throw new Error('Rate limit exceeded after max retries');
}
```

**3. Respect Retry-After Header**
```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
  const resetTime = new Date(Date.now() + retryAfter * 1000);

  console.warn(`Rate limited. Retry after ${resetTime.toLocaleTimeString()}`);

  // Option 1: Wait and retry
  await sleep(retryAfter * 1000);
  return makeApiRequest(url, options);

  // Option 2: Return error to user
  throw new RateLimitError({
    retryAfter,
    resetTime,
    message: `Too many requests. Try again at ${resetTime.toLocaleTimeString()}`
  });
}
```

**4. Display Rate Limit Info to Users**
```typescript
function displayRateLimitWarning(headers: Headers) {
  const remaining = parseInt(headers.get('X-RateLimit-Remaining') || '999');
  const limit = parseInt(headers.get('X-RateLimit-Limit') || '1000');
  const reset = parseInt(headers.get('X-RateLimit-Reset') || '0');

  if (remaining < limit * 0.1) {
    const resetTime = new Date(reset * 1000);
    const minutesUntilReset = Math.ceil((reset * 1000 - Date.now()) / 60000);

    showNotification({
      type: 'warning',
      message: `You have ${remaining} API requests remaining. Limit resets in ${minutesUntilReset} minutes.`,
      action: minutesUntilReset < 10 ? 'Upgrade Plan' : null
    });
  }
}
```

**5. Batch Requests When Possible**
```typescript
// BAD: Individual requests
for (const secretId of secretIds) {
  await fetch(`/v1/secrets/${secretId}`);
}

// GOOD: Batch request
await fetch(`/v1/secrets?ids=${secretIds.join(',')}`);
```

**6. Cache Responses Client-Side**
```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false, // Don't burn rate limit on focus
      retry: (failureCount, error) => {
        // Don't retry on 429
        if (error.status === 429) return false;
        return failureCount < 3;
      }
    }
  }
});
```

### Client Error Handling Pattern

**Complete Example:**
```typescript
class AbyrithAPIClient {
  private lastRateLimitInfo: RateLimitInfo | null = null;

  async request(endpoint: string, options: RequestInit = {}) {
    // Pre-flight rate limit check
    if (this.shouldWaitForRateLimit()) {
      await this.waitForRateLimitReset();
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Update rate limit tracking
    this.updateRateLimitInfo(response.headers);

    // Handle rate limit error
    if (response.status === 429) {
      const error = await response.json();
      throw new RateLimitError(error.error.details);
    }

    return response;
  }

  private updateRateLimitInfo(headers: Headers) {
    this.lastRateLimitInfo = {
      limit: parseInt(headers.get('X-RateLimit-Limit') || '1000'),
      remaining: parseInt(headers.get('X-RateLimit-Remaining') || '999'),
      reset: parseInt(headers.get('X-RateLimit-Reset') || '0')
    };
  }

  private shouldWaitForRateLimit(): boolean {
    if (!this.lastRateLimitInfo) return false;

    // If we have <5% requests remaining and <5 minutes until reset, wait
    const percentRemaining = this.lastRateLimitInfo.remaining / this.lastRateLimitInfo.limit;
    const secondsUntilReset = this.lastRateLimitInfo.reset - Math.floor(Date.now() / 1000);

    return percentRemaining < 0.05 && secondsUntilReset < 300;
  }

  private async waitForRateLimitReset() {
    if (!this.lastRateLimitInfo) return;

    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = this.lastRateLimitInfo.reset - now;

    if (waitSeconds > 0) {
      console.log(`Rate limit approaching. Waiting ${waitSeconds}s...`);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    }
  }
}

class RateLimitError extends Error {
  constructor(public details: RateLimitDetails) {
    super(details.message || 'Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}
```

---

## Monitoring & Alerting

### Metrics to Track

**Rate Limit Violations:**
```typescript
// Cloudflare Analytics Engine events
{
  event: 'rate_limit_exceeded',
  endpoint: '/v1/secrets/:id',
  user_id: 'uuid',
  limit: 500,
  actual_requests: 501,
  policy: 'user:secrets:1h',
  timestamp: Date.now()
}
```

**Key Metrics:**
1. **Total rate limit violations per hour** - Track overall abuse
2. **Rate limit violations by endpoint** - Identify which limits too strict/lenient
3. **Rate limit violations by user** - Identify heavy users or attackers
4. **False positive rate** - Legitimate users hitting limits
5. **Retry success rate** - Users retrying after 429
6. **Average remaining capacity** - How close users are to limits

### Dashboards

**Cloudflare Analytics Dashboard:**
- Rate limit violations over time (line chart)
- Top 10 endpoints by violations (bar chart)
- Top 10 users by violations (table)
- Average remaining capacity by endpoint (gauge)

**Custom Operations Dashboard:**
```html
<!-- Simple HTML dashboard served by Worker -->
<div class="metrics">
  <div class="metric">
    <h3>Rate Limit Violations (24h)</h3>
    <p class="value">247</p>
    <p class="change">-12% from yesterday</p>
  </div>

  <div class="metric">
    <h3>Most Violated Endpoint</h3>
    <p class="value">/v1/secrets/:id</p>
    <p class="detail">127 violations (51% of total)</p>
  </div>

  <div class="metric">
    <h3>False Positive Rate</h3>
    <p class="value">0.3%</p>
    <p class="detail">Target: <0.5%</p>
  </div>
</div>
```

### Alerts

**Alert 1: High Rate Limit Violation Rate**
- **Condition:** >100 violations in 1 hour (indicates attack or misconfigured client)
- **Severity:** P2 - Medium
- **Action:** Review top violating IPs/users, consider temporary IP blocks
- **Notification:** Slack #ops-alerts

**Alert 2: Specific User Excessive Violations**
- **Condition:** Single user >50 violations in 1 hour
- **Severity:** P3 - Low
- **Action:** Email user about approaching limits, suggest upgrade
- **Notification:** Email to user + Slack #support

**Alert 3: False Positive Rate Spike**
- **Condition:** False positive rate >1% (legitimate users blocked)
- **Severity:** P1 - High
- **Action:** Review limits for affected endpoint, consider temporary increase
- **Notification:** PagerDuty + Slack #incidents

**Alert 4: Distributed Attack Pattern**
- **Condition:** >500 violations from >50 unique IPs in 10 minutes
- **Severity:** P0 - Critical
- **Action:** Enable aggressive rate limiting, escalate to security team
- **Notification:** PagerDuty oncall + Slack #security

### Logging Examples

**Rate Limit Exceeded Log:**
```json
{
  "level": "warn",
  "event": "rate_limit_exceeded",
  "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "ip": "203.0.113.45",
  "endpoint": "/v1/secrets/:id",
  "method": "GET",
  "limit": 500,
  "actual_requests": 501,
  "window": "1h",
  "policy": "user:secrets:1h",
  "retry_after": 1847,
  "request_id": "req_abc123",
  "timestamp": "2025-10-30T13:28:15.234Z"
}
```

**Rate Limit Warning Log:**
```json
{
  "level": "info",
  "event": "rate_limit_warning",
  "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "endpoint": "/v1/mcp/secrets/get",
  "remaining": 15,
  "limit": 200,
  "percentage_remaining": 7.5,
  "request_id": "req_xyz789",
  "timestamp": "2025-10-30T13:42:08.123Z"
}
```

---

## Testing Strategy

### Unit Tests

**Test Rate Limit Logic:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('Rate Limiting', () => {
  beforeEach(async () => {
    // Clear KV test namespace
    await clearTestKV();
  });

  it('should allow requests within limit', async () => {
    const result = await checkRateLimit('user123', '/v1/secrets', 100, 3600, mockEnv);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('should block requests exceeding limit', async () => {
    // Make 100 requests
    for (let i = 0; i < 100; i++) {
      await checkRateLimit('user123', '/v1/secrets', 100, 3600, mockEnv);
    }

    // 101st request should be blocked
    const result = await checkRateLimit('user123', '/v1/secrets', 100, 3600, mockEnv);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should reset counter after window expires', async () => {
    // Make 100 requests
    for (let i = 0; i < 100; i++) {
      await checkRateLimit('user123', '/v1/secrets', 100, 3600, mockEnv);
    }

    // Simulate time passing (advance 1 hour)
    mockEnv.now = () => Date.now() + 3600 * 1000;

    // Should allow requests again
    const result = await checkRateLimit('user123', '/v1/secrets', 100, 3600, mockEnv);
    expect(result.allowed).toBe(true);
  });

  it('should handle sliding window correctly', async () => {
    // Make 80 requests in first half of window
    for (let i = 0; i < 80; i++) {
      await checkRateLimit('user123', '/v1/secrets', 100, 3600, mockEnv);
    }

    // Advance to middle of window
    mockEnv.now = () => Date.now() + 1800 * 1000; // 30 minutes

    // Should still have ~60 requests available (sliding window)
    const result = await checkRateLimit('user123', '/v1/secrets', 100, 3600, mockEnv);
    expect(result.remaining).toBeGreaterThan(50);
  });
});
```

### Integration Tests

**Test Middleware Integration:**
```typescript
import { describe, it, expect } from 'vitest';
import { handleRequest } from '../worker';

describe('Rate Limit Middleware Integration', () => {
  it('should add rate limit headers to successful responses', async () => {
    const request = new Request('https://api.abyrith.com/v1/projects', {
      headers: {
        'Authorization': 'Bearer valid_jwt_token'
      }
    });

    const response = await handleRequest(request, mockEnv, mockCtx);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('1000');
    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('should return 429 when rate limit exceeded', async () => {
    // Exhaust rate limit
    for (let i = 0; i < 500; i++) {
      await handleRequest(secretsRequest, mockEnv, mockCtx);
    }

    // Next request should be rate limited
    const response = await handleRequest(secretsRequest, mockEnv, mockCtx);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

### Load Testing

**k6 Load Test Script:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const rateLimitErrors = new Rate('rate_limit_errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'rate_limit_errors': ['rate<0.05'], // <5% rate limit errors
    'http_req_duration': ['p(95)<500'], // 95% of requests <500ms
  },
};

export default function () {
  const response = http.get('https://api.abyrith.com/v1/projects', {
    headers: {
      'Authorization': `Bearer ${__ENV.JWT_TOKEN}`,
    },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'rate limit headers present': (r) =>
      r.headers['X-RateLimit-Limit'] !== undefined,
  });

  rateLimitErrors.add(response.status === 429);

  sleep(1); // 1 request per second per user
}
```

### Manual Testing Checklist

**Pre-deployment verification:**
- [ ] Authenticated user can make 1,000 requests/hour
- [ ] Unauthenticated IP can make 100 requests/hour
- [ ] Secrets endpoints limited to 500 requests/hour
- [ ] MCP endpoints limited to 200 requests/hour
- [ ] Login attempts limited to 10/hour per IP
- [ ] 429 response includes correct headers (Retry-After, X-RateLimit-*)
- [ ] 429 response includes clear error message
- [ ] Rate limit resets correctly after window
- [ ] Sliding window prevents burst exploitation
- [ ] Team tier users get 5x multiplier
- [ ] Rate limit headers added to all responses
- [ ] Warning header added at 80% capacity

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `05-api/api-rest-design.md` - API architecture and error handling patterns
- [x] `06-backend/cloudflare-workers/workers-architecture.md` - Workers implementation details
- [x] `TECH-STACK.md` - Technology stack (Cloudflare Workers KV)
- [x] `GLOSSARY.md` - Rate limiting terminology

**External Services:**
- Cloudflare Workers (API Gateway)
- Cloudflare Workers KV (Counter storage)
- Cloudflare Analytics Engine (Metrics)

### Feature Dependencies

**Required by:**
- All API endpoints (enforced by middleware)
- Client libraries (must handle 429 responses)
- MCP server (subject to rate limits)
- AI Assistant (FireCrawl calls rate limited)

---

## References

### Internal Documentation
- `05-api/api-rest-design.md` - API design patterns and error handling
- `06-backend/cloudflare-workers/workers-architecture.md` - Workers implementation
- `05-api/endpoints/` - Specific endpoint documentation
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [IETF RFC 6585](https://tools.ietf.org/html/rfc6585) - HTTP 429 Status Code specification
- [IETF RFC 7231](https://tools.ietf.org/html/rfc7231#section-7.1.3) - Retry-After Header
- [Cloudflare Workers KV Docs](https://developers.cloudflare.com/workers/runtime-apis/kv/) - KV API reference
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket) - Rate limiting algorithm
- [Stripe Rate Limiting](https://stripe.com/docs/rate-limits) - Industry best practices
- [GitHub Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting) - Reference implementation

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial comprehensive rate limiting architecture |

---

## Notes

### Future Enhancements
- **Dynamic Limits** - Adjust limits based on real-time load and user behavior
- **Token Bucket Algorithm** - Allow burst traffic above sustained rate
- **Per-Organization Custom Limits** - Enterprise customers can request custom limits
- **Rate Limit API** - Endpoint to check current usage: `GET /v1/rate-limits/status`
- **Quota Management** - Monthly/daily quotas in addition to hourly limits
- **Priority Queuing** - Enterprise requests prioritized during high load

### Known Limitations
- Workers KV eventual consistency may allow brief limit overruns (acceptable)
- No per-method limits (GET vs POST treated equally)
- Fixed window sizes (1 hour only, no 1 minute or 1 day windows yet)
- No distributed rate limiting across multiple KV namespaces

### Deployment Notes
- Rate limits can be adjusted via environment variables without code deploy
- Monitor false positive rate closely in first 2 weeks
- Consider temporary limit increases during beta launch
- Ensure Cloudflare Workers KV has sufficient quota (100k writes/day minimum)

### Next Review Date
2025-12-01 (review after 30 days of production traffic)
