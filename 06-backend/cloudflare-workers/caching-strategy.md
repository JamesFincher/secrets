---
Document: Caching Strategy - Cloudflare Workers
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 06-backend/cloudflare-workers/workers-architecture.md, 02-architecture/system-overview.md, TECH-STACK.md
---

# Caching Strategy for Cloudflare Workers

## Overview

This document defines the comprehensive caching strategy for Abyrith's Cloudflare Workers implementation, covering KV storage usage, cache invalidation patterns, TTL (Time-To-Live) policies, and performance optimization techniques. The caching layer is critical for reducing backend load, improving API response times, and providing a better user experience globally.

**Purpose:** Define how Cloudflare Workers KV is used for edge caching, establish cache invalidation strategies, set appropriate TTL policies for different data types, and ensure cache coherency across Abyrith's global edge network.

**Scope:** This document covers Workers KV caching, browser caching, CDN caching, and cache invalidation strategies. It does not cover database-level caching (see `04-database/schemas/` for database optimization).

**Status:** Draft - Pending implementation

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Cache Key Design](#cache-key-design)
7. [TTL Policies](#ttl-policies)
8. [Cache Invalidation Strategies](#cache-invalidation-strategies)
9. [Performance Characteristics](#performance-characteristics)
10. [Scalability](#scalability)
11. [Failure Modes](#failure-modes)
12. [Alternatives Considered](#alternatives-considered)
13. [Decision Log](#decision-log)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith's API gateway handles thousands of requests per second globally, with many requests fetching the same data repeatedly (metadata, public configurations, rate limit counters). Without caching, every request hits the backend database, causing:
- Increased latency (round-trip to database)
- Higher database load and costs
- Slower user experience
- Reduced scalability

**Pain points:**
- API response times vary based on user location relative to database
- Rate limiting requires coordinated state across global edge locations
- Backend database becomes bottleneck under high load
- No easy way to serve stale data during backend outages
- Cache invalidation complexity when data changes

**Why now?**
Phase 3 of the documentation roadmap establishes core infrastructure. Caching is essential for:
- Meeting performance targets (p95 < 200ms API response)
- Scaling to thousands of concurrent users
- Reducing infrastructure costs
- Providing graceful degradation during outages

### Background

**Existing system:**
Currently in planning phase. The Workers architecture document establishes Workers KV as the primary caching layer at the edge.

**Previous attempts:**
N/A - This is the initial caching strategy design.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Frontend Team | Fast API responses, consistent behavior | Cache staleness shouldn't cause bugs |
| Backend Team | Reduced database load, predictable costs | Cache invalidation must be reliable |
| Security Team | Cached data must respect permissions | No data leakage via cache |
| DevOps Team | Simple monitoring and debugging | Clear cache metrics and invalidation triggers |
| Users | Fast page loads globally | Fresh data when needed |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Sub-50ms cache hit latency (p95)** - Serve cached responses faster than backend round-trip
2. **60%+ cache hit rate** - Reduce backend load by caching frequently accessed data
3. **Zero data leakage** - Cache keys must include user/org context to prevent unauthorized access
4. **Eventual consistency** - Tolerate slight staleness with reasonable TTLs
5. **Graceful degradation** - Serve stale data if backend unavailable

**Secondary goals:**
- Automatic cache warming for critical data
- Cache analytics and monitoring
- Cost optimization (KV storage is cheap)
- Easy debugging of cache issues

### Non-Goals

**Explicitly out of scope:**
- **Strong consistency** - KV is eventually consistent (< 60s propagation)
- **Complex cache hierarchies** - Single KV layer, no multi-level caching
- **Client-side caching logic** - Workers handle all caching decisions
- **Database query result caching** - Supabase handles database-level caching

### Success Metrics

**How we measure success:**
- **Cache hit rate**: 60%+ for public endpoints, 40%+ for authenticated
- **Cache hit latency**: p95 < 50ms, p99 < 100ms
- **Backend load reduction**: 50%+ fewer database queries
- **Cost savings**: 40%+ reduction in database query costs
- **Invalidation accuracy**: < 0.1% stale data served after invalidation

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Request                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Workers                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Request Processing Pipeline               │ │
│  │  1. Extract cache key components                   │ │
│  │  2. Check cache (KV lookup)                        │ │
│  │  3. If HIT → Return cached response                │ │
│  │  4. If MISS → Proxy to backend                     │ │
│  │  5. Store response in cache (if cacheable)         │ │
│  │  6. Return response                                │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
           ┌─────────┴──────────┐
           │                    │
           ▼                    ▼
┌──────────────────┐   ┌──────────────────┐
│  Cache Hit Path  │   │ Cache Miss Path  │
│                  │   │                  │
│  1. KV GET       │   │  1. Backend API  │
│  2. Deserialize  │   │  2. Process resp │
│  3. Add headers  │   │  3. KV PUT       │
│  4. Return       │   │  4. Return       │
└──────────────────┘   └──────────────────┘

┌─────────────────────────────────────────────────────────┐
│           Cloudflare Workers KV Storage                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Cache Types:                                      │ │
│  │                                                    │ │
│  │  1. API Response Cache                            │ │
│  │     - Public endpoints (metadata, docs)           │ │
│  │     - User-scoped responses (secrets list)        │ │
│  │     - Org-scoped data (team settings)             │ │
│  │                                                    │ │
│  │  2. Rate Limit Counters                           │ │
│  │     - Per-user request counts                     │ │
│  │     - Per-IP request counts                       │ │
│  │     - Per-endpoint limits                         │ │
│  │                                                    │ │
│  │  3. Feature Flags                                 │ │
│  │     - Global feature toggles                      │ │
│  │     - A/B test configurations                     │ │
│  │     - Rollout percentages                         │ │
│  │                                                    │ │
│  │  4. Configuration Data                            │ │
│  │     - API service metadata                        │ │
│  │     - System configuration                        │ │
│  │     - Pricing tiers                               │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Cache Manager**
- **Purpose:** Central service for all cache operations (get, set, delete, invalidate)
- **Technology:** TypeScript module in Workers
- **Responsibilities:**
  - Generate consistent cache keys
  - Serialize/deserialize cached data
  - Handle cache hits and misses
  - Apply TTL policies
  - Track cache metrics

**Component 2: KV Storage Layer**
- **Purpose:** Global key-value store for cached data
- **Technology:** Cloudflare Workers KV
- **Responsibilities:**
  - Store cached responses with TTL
  - Replicate data globally (< 60s)
  - Expire keys automatically
  - Provide low-latency reads

**Component 3: Cache Key Generator**
- **Purpose:** Create deterministic cache keys based on request context
- **Technology:** TypeScript function
- **Responsibilities:**
  - Include necessary context (user, org, query params)
  - Prevent cache poisoning attacks
  - Support cache invalidation patterns
  - Maintain key length limits (512 bytes)

**Component 4: Invalidation Manager**
- **Purpose:** Coordinate cache invalidation when data changes
- **Technology:** TypeScript module + KV
- **Responsibilities:**
  - Track cache versions
  - Invalidate stale entries
  - Handle pattern-based invalidation
  - Support manual purge operations

### Component Interactions

**Workers ↔ KV Storage:**
- Protocol: Workers runtime API (`env.KV.get()`, `env.KV.put()`)
- Data format: String or ArrayBuffer
- Consistency: Eventually consistent (global replication)
- Latency: Sub-millisecond (local edge read)

**Cache Manager ↔ Backend:**
- Protocol: HTTPS
- Flow: Only on cache miss
- Fallback: Serve stale data if backend unavailable

---

## Component Details

### Component: Cache Manager

**Purpose:**
Centralized cache operations handler that determines what to cache, when to cache it, and when to invalidate.

**Responsibilities:**
1. Check if request is cacheable (method, route, auth state)
2. Generate cache keys with appropriate scoping
3. Fetch from cache (KV GET)
4. Store responses in cache (KV PUT with TTL)
5. Add cache-related headers (X-Cache: HIT/MISS, Age)
6. Handle cache invalidation events
7. Implement cache warming strategies
8. Track cache metrics

**Internal Architecture:**

```typescript
interface CacheManager {
  // Check if request should use cache
  isCacheable(request: Request, route: Route): boolean;

  // Get cached response
  get(request: Request, user: User | null): Promise<Response | null>;

  // Store response in cache
  set(request: Request, response: Response, user: User | null): Promise<void>;

  // Invalidate cache entries
  invalidate(pattern: string, scope?: Scope): Promise<void>;

  // Warm cache with critical data
  warm(keys: string[]): Promise<void>;

  // Get cache statistics
  getStats(): CacheStats;
}
```

**Configuration:**

```typescript
interface CacheConfig {
  // Global cache settings
  enabled: boolean;                    // Master switch for caching
  defaultTtl: number;                  // Default TTL in seconds (300)
  maxTtl: number;                      // Maximum TTL in seconds (3600)

  // Cache behavior
  serveStaleOnError: boolean;          // Serve stale if backend fails
  staleWhileRevalidate: boolean;       // Background refresh
  respectCacheControl: boolean;        // Honor Cache-Control headers

  // Scoping
  varyByUser: boolean;                 // Different cache per user?
  varyByOrg: boolean;                  // Different cache per org?
  varyByQuery: boolean;                // Different cache per query params?

  // Performance
  maxCacheSize: number;                // Max value size (25MB limit)
  compressionEnabled: boolean;         // Compress before storing

  // Invalidation
  invalidationMode: 'version' | 'purge'; // How to invalidate
  versionTtl: number;                    // Cache version TTL
}
```

**Example Implementation:**

```typescript
class CacheManagerImpl implements CacheManager {
  constructor(
    private kv: KVNamespace,
    private config: CacheConfig
  ) {}

  async get(request: Request, user: User | null): Promise<Response | null> {
    if (!this.config.enabled) return null;

    // Generate cache key
    const key = this.generateKey(request, user);

    // Check cache version (for invalidation)
    const version = await this.getCacheVersion(key);
    const versionedKey = `${key}:v${version}`;

    // Fetch from KV
    const cached = await this.kv.get(versionedKey, 'arrayBuffer');
    if (!cached) return null;

    // Deserialize
    const { body, headers, status, timestamp } = this.deserialize(cached);

    // Check staleness
    const age = Date.now() - timestamp;
    const ttl = this.getTtl(request);

    if (age > ttl * 1000) {
      // Stale - serve only if backend unavailable
      if (this.config.serveStaleOnError) {
        return this.createResponse(body, headers, status, {
          'X-Cache': 'STALE',
          'Age': Math.floor(age / 1000).toString(),
          'Warning': '110 - "Response is Stale"'
        });
      }
      return null;
    }

    // Fresh cache hit
    return this.createResponse(body, headers, status, {
      'X-Cache': 'HIT',
      'Age': Math.floor(age / 1000).toString()
    });
  }

  async set(
    request: Request,
    response: Response,
    user: User | null
  ): Promise<void> {
    if (!this.isCacheable(request, response)) return;

    // Generate cache key
    const key = this.generateKey(request, user);
    const version = await this.getCacheVersion(key);
    const versionedKey = `${key}:v${version}`;

    // Serialize response
    const body = await response.text();
    const headers = Object.fromEntries(response.headers);
    const cached = this.serialize({
      body,
      headers,
      status: response.status,
      timestamp: Date.now()
    });

    // Store in KV with TTL
    const ttl = this.getTtl(request);
    await this.kv.put(versionedKey, cached, {
      expirationTtl: ttl
    });
  }

  async invalidate(pattern: string, scope?: Scope): Promise<void> {
    if (this.config.invalidationMode === 'version') {
      // Increment version to invalidate all matching keys
      const versionKey = `cache:version:${pattern}`;
      const currentVersion = await this.kv.get(versionKey) || '0';
      const newVersion = (parseInt(currentVersion) + 1).toString();
      await this.kv.put(versionKey, newVersion);
    } else {
      // Direct purge (expensive, use sparingly)
      // KV doesn't support pattern deletion, so this is limited
      console.warn('Direct purge not fully supported by KV');
    }
  }

  private generateKey(request: Request, user: User | null): string {
    const url = new URL(request.url);
    let key = `cache:${url.pathname}`;

    // Add query params if configured
    if (this.config.varyByQuery && url.search) {
      const sortedParams = new URLSearchParams(
        [...url.searchParams].sort()
      ).toString();
      key += `:q:${sortedParams}`;
    }

    // Add user scope if authenticated endpoint
    if (this.config.varyByUser && user) {
      key += `:u:${user.id}`;
    }

    // Add org scope if applicable
    if (this.config.varyByOrg && user?.org_id) {
      key += `:org:${user.org_id}`;
    }

    return key;
  }

  isCacheable(request: Request, response?: Response): boolean {
    // Only cache GET requests
    if (request.method !== 'GET') return false;

    // Check response status if provided
    if (response && response.status !== 200) return false;

    // Check Cache-Control header
    if (response && this.config.respectCacheControl) {
      const cacheControl = response.headers.get('Cache-Control');
      if (cacheControl?.includes('no-cache') ||
          cacheControl?.includes('private')) {
        return false;
      }
    }

    return true;
  }

  private getTtl(request: Request): number {
    // Default TTL from config
    let ttl = this.config.defaultTtl;

    // Override based on route
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/v1/health')) {
      ttl = 30; // Health checks expire quickly
    } else if (url.pathname.startsWith('/api/v1/config')) {
      ttl = 600; // Config data cached longer
    }

    // Cap at max TTL
    return Math.min(ttl, this.config.maxTtl);
  }

  private serialize(data: any): string {
    return JSON.stringify(data);
  }

  private deserialize(data: ArrayBuffer): any {
    return JSON.parse(new TextDecoder().decode(data));
  }

  private createResponse(
    body: string,
    headers: Record<string, string>,
    status: number,
    additionalHeaders: Record<string, string>
  ): Response {
    return new Response(body, {
      status,
      headers: {
        ...headers,
        ...additionalHeaders
      }
    });
  }

  private async getCacheVersion(key: string): Promise<string> {
    const versionKey = `cache:version:${key}`;
    return await this.kv.get(versionKey) || '0';
  }
}
```

---

### Component: Rate Limit Cache

**Purpose:**
Store per-user and per-IP rate limit counters with automatic expiration.

**Cache Key Format:**
```
ratelimit:{identifier}:{window}:{endpoint?}
```

**Example Keys:**
```
ratelimit:user:550e8400-e29b-41d4-a716-446655440000:minute
ratelimit:ip:192.168.1.1:hour
ratelimit:user:550e8400-e29b-41d4-a716-446655440000:minute:/api/v1/ai/chat
```

**Data Structure:**
```typescript
interface RateLimitCounter {
  count: number;        // Current request count
  resetAt: number;      // Unix timestamp when counter resets
  blocked?: boolean;    // Is this identifier currently blocked?
}
```

**TTL Policy:**
- **Minute window**: 60 seconds
- **Hour window**: 3600 seconds
- **Day window**: 86400 seconds

**Invalidation:**
- Automatic expiration via TTL
- Manual unblock: Delete specific key
- Reset all: Increment rate limit version

---

### Component: Feature Flags Cache

**Purpose:**
Store feature flag configurations for fast access without database queries.

**Cache Key Format:**
```
feature:flag:{flag_name}
feature:flags:all
```

**Example Keys:**
```
feature:flag:enable_ai_assistant
feature:flag:enable_mcp_server
feature:flags:all
```

**Data Structure:**
```typescript
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rollout?: {
    percentage: number;      // 0-100
    userIds?: string[];      // Specific users
    orgIds?: string[];       // Specific orgs
  };
  expiresAt?: number;        // Optional expiration
}

interface FeatureFlagsCollection {
  flags: Record<string, FeatureFlag>;
  updatedAt: number;
}
```

**TTL Policy:**
- **Individual flags**: 300 seconds (5 minutes)
- **All flags collection**: 300 seconds
- **Critical flags**: 60 seconds (faster updates)

**Invalidation:**
- On flag update: Delete specific key
- On bulk update: Delete `feature:flags:all`
- Emergency disable: Set flag to disabled with 10s TTL

---

### Component: Configuration Cache

**Purpose:**
Cache system configuration and API service metadata that changes infrequently.

**Cache Key Format:**
```
config:{type}:{identifier?}
```

**Example Keys:**
```
config:system:global
config:api_service:openai
config:pricing:free_tier
```

**Data Structure:**
```typescript
interface SystemConfig {
  environment: string;         // development, staging, production
  version: string;             // API version
  maintenance: boolean;        // Is system in maintenance?
  features: string[];          // Enabled features
}

interface APIServiceInfo {
  name: string;
  apiKeyFormat: string;
  documentationUrl: string;
  pricingTiers: Record<string, number>;
  rateLimits: {
    requestsPerDay: number;
    requestsPerSecond: number;
  };
}
```

**TTL Policy:**
- **System config**: 600 seconds (10 minutes)
- **API service info**: 3600 seconds (1 hour)
- **Pricing data**: 3600 seconds

**Invalidation:**
- On config update: Delete specific key
- Manual cache clear: Delete all `config:*` keys

---

## Data Flow

### Flow 1: Cached Response (Cache Hit)

**Trigger:** User requests frequently accessed data (e.g., project list)

**Steps:**

1. **Client:** Sends GET request
   ```typescript
   fetch('https://api.abyrith.com/v1/projects', {
     headers: {
       'Authorization': 'Bearer <jwt>'
     }
   });
   ```

2. **Worker - Extract Cache Context:**
   ```typescript
   const user = await authenticateRequest(request, env);
   const cacheKey = generateCacheKey(request, user);
   // Result: "cache:/api/v1/projects:u:550e8400-..."
   ```

3. **Worker - Check Cache Version:**
   ```typescript
   const version = await getCacheVersion(cacheKey);
   const versionedKey = `${cacheKey}:v${version}`;
   ```

4. **Worker - KV Lookup:**
   ```typescript
   const cached = await env.KV.get(versionedKey, 'arrayBuffer');
   if (cached) {
     // Cache HIT!
     const response = deserializeResponse(cached);
     return addCacheHeaders(response, 'HIT');
   }
   ```

5. **Response to Client:**
   ```
   Status: 200 OK
   X-Cache: HIT
   Age: 45
   Cache-Control: public, max-age=300

   {
     "data": [...]
   }
   ```

**Total Latency:** ~20-50ms (mostly Worker CPU time)

---

### Flow 2: Uncached Response (Cache Miss)

**Trigger:** First request for data or cache expired

**Steps:**

1. **Client:** Sends GET request

2. **Worker - Cache Check:**
   ```typescript
   const cached = await env.KV.get(versionedKey);
   if (!cached) {
     // Cache MISS - fetch from backend
   }
   ```

3. **Worker - Proxy to Backend:**
   ```typescript
   const backendResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/projects`, {
     headers: {
       'Authorization': `Bearer ${userJWT}`,
       'apikey': env.SUPABASE_ANON_KEY
     }
   });
   ```

4. **Worker - Store in Cache:**
   ```typescript
   if (backendResponse.status === 200) {
     await cacheResponse(request, backendResponse, user, env);
   }
   ```

5. **Response to Client:**
   ```
   Status: 200 OK
   X-Cache: MISS
   Age: 0

   {
     "data": [...]
   }
   ```

**Total Latency:** ~150-300ms (includes backend round-trip)

---

### Flow 3: Cache Invalidation on Mutation

**Trigger:** User creates/updates/deletes a project

**Steps:**

1. **Client:** Sends POST/PUT/DELETE request
   ```typescript
   fetch('https://api.abyrith.com/v1/projects', {
     method: 'POST',
     body: JSON.stringify({ name: 'New Project' })
   });
   ```

2. **Worker - Process Mutation:**
   ```typescript
   const response = await supabase.from('projects').insert(data);
   ```

3. **Worker - Invalidate Related Cache:**
   ```typescript
   // Increment cache version for this user's project list
   await invalidateCache('/api/v1/projects', {
     userId: user.id
   });

   // Also invalidate organization-level caches if applicable
   if (user.org_id) {
     await invalidateCache('/api/v1/projects', {
       orgId: user.org_id
     });
   }
   ```

4. **Cache Version Update:**
   ```typescript
   const versionKey = `cache:version:/api/v1/projects:u:${user.id}`;
   const currentVersion = await env.KV.get(versionKey) || '0';
   const newVersion = (parseInt(currentVersion) + 1).toString();
   await env.KV.put(versionKey, newVersion);
   ```

5. **Response to Client:**
   ```
   Status: 201 Created

   {
     "id": "new-project-uuid",
     "name": "New Project"
   }
   ```

6. **Next GET Request:**
   - Cache key includes new version number
   - Old cached data is effectively invalidated
   - Fresh data fetched from backend

---

## Cache Key Design

### Cache Key Structure

**Format:**
```
{namespace}:{resource}:{scope}:{identifier}:{version}
```

**Components:**
- **Namespace:** Prefix to avoid collisions (`cache`, `ratelimit`, `feature`, `config`)
- **Resource:** API endpoint or data type
- **Scope:** User/org/global context
- **Identifier:** Specific user/org ID if scoped
- **Version:** Cache version for invalidation

### Cache Key Examples

**Public Endpoint (No Auth):**
```
cache:/api/v1/health:v0
```

**User-Scoped Endpoint:**
```
cache:/api/v1/projects:u:550e8400-e29b-41d4-a716-446655440000:v2
```

**Org-Scoped Endpoint:**
```
cache:/api/v1/teams:org:7c9e6679-7425-40de-944b-e07fc1f90ae7:v1
```

**Query-Parameterized Endpoint:**
```
cache:/api/v1/secrets:q:environment=production&sort=created_at:u:550e8400...:v0
```

**Rate Limit Counter:**
```
ratelimit:user:550e8400-e29b-41d4-a716-446655440000:minute
```

**Feature Flag:**
```
feature:flag:enable_ai_assistant
```

### Cache Key Best Practices

1. **Keep keys under 512 bytes** - KV has key size limits
2. **Include version in key** - Enables instant invalidation
3. **Sort query parameters** - Consistent key generation
4. **Use user/org IDs, not emails** - IDs don't change
5. **Namespace everything** - Prevent collisions
6. **Don't include timestamps** - Makes keys non-cacheable

### Security Considerations

**Preventing Cache Poisoning:**
- Always validate user context from JWT
- Never trust client-provided cache keys
- Sanitize query parameters before including in key
- Verify user has access to requested resource

**Preventing Data Leakage:**
- Include user/org ID in keys for authenticated endpoints
- Never cache responses for one user accessible by another
- Clear separation between public and private caches
- Audit cache keys for sensitive data

---

## TTL Policies

### TTL Strategy by Data Type

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| **Public Metadata** | 600s (10 min) | Changes infrequently, safe to cache longer |
| **User Projects List** | 300s (5 min) | Changes when user creates/deletes projects |
| **User Secrets List** | 180s (3 min) | More sensitive, shorter TTL |
| **Team Members** | 300s (5 min) | Changes when members invited/removed |
| **API Service Info** | 3600s (1 hour) | External data, changes rarely |
| **System Config** | 600s (10 min) | Admin changes, need reasonable freshness |
| **Feature Flags** | 300s (5 min) | Need to respond to flag changes quickly |
| **Rate Limit Counters** | 60-3600s | Match time window (minute/hour) |
| **Health Check** | 30s | Must be fresh for monitoring |

### Dynamic TTL Calculation

```typescript
function calculateTtl(request: Request, response: Response): number {
  // Check response headers for Cache-Control
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl) {
    const maxAge = cacheControl.match(/max-age=(\d+)/);
    if (maxAge) {
      return Math.min(parseInt(maxAge[1]), 3600); // Cap at 1 hour
    }
  }

  // Default based on endpoint
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith('/api/v1/health')) return 30;
  if (path.startsWith('/api/v1/config')) return 600;
  if (path.startsWith('/api/v1/services')) return 3600;
  if (path.startsWith('/api/v1/secrets')) return 180;
  if (path.startsWith('/api/v1/projects')) return 300;
  if (path.startsWith('/api/v1/teams')) return 300;

  // Default TTL
  return 300;
}
```

### TTL Overrides

**Emergency cache clear:**
```typescript
// Set TTL to 10 seconds to expire quickly
await env.KV.put(key, value, { expirationTtl: 10 });
```

**Cache warming (pre-populate):**
```typescript
// Cache critical data with normal TTL
await env.KV.put(key, value, { expirationTtl: 300 });
```

**Infinite cache (feature flags):**
```typescript
// No TTL - manual invalidation only (use sparingly!)
await env.KV.put(key, value); // Never expires automatically
```

---

## Cache Invalidation Strategies

### Strategy 1: Version-Based Invalidation (Primary)

**How it works:**
- Each cache key includes a version number
- To invalidate, increment the version
- Old cached entries become unreachable (garbage collected by TTL)

**Advantages:**
- Instant invalidation (no need to find/delete keys)
- Works with eventually consistent KV
- Scales to millions of keys

**Disadvantages:**
- Old data remains in KV until TTL expires
- Requires version tracking for each cache pattern

**Implementation:**

```typescript
async function incrementCacheVersion(pattern: string, env: Env): Promise<void> {
  const versionKey = `cache:version:${pattern}`;
  const currentVersion = await env.KV.get(versionKey) || '0';
  const newVersion = (parseInt(currentVersion) + 1).toString();
  await env.KV.put(versionKey, newVersion, {
    expirationTtl: 86400 // Version expires after 24 hours
  });
}

async function getCacheVersion(pattern: string, env: Env): Promise<string> {
  const versionKey = `cache:version:${pattern}`;
  return await env.KV.get(versionKey) || '0';
}
```

**Usage:**

```typescript
// On project creation
await incrementCacheVersion(`/api/v1/projects:u:${userId}`, env);

// On project update
await incrementCacheVersion(`/api/v1/projects:u:${userId}`, env);
await incrementCacheVersion(`/api/v1/projects/${projectId}`, env);

// On team member added
await incrementCacheVersion(`/api/v1/teams:org:${orgId}`, env);
```

---

### Strategy 2: Tag-Based Invalidation (Future)

**How it works:**
- Cache entries tagged with resource identifiers
- Maintain tag-to-keys mapping in KV
- To invalidate, lookup tags and delete matching keys

**Advantages:**
- Precise invalidation (only affected keys)
- Immediate removal from cache
- Better for large values (save storage costs)

**Disadvantages:**
- Requires maintaining tag index
- KV list operations are expensive
- More complex implementation

**Implementation (Future):**

```typescript
// Not implemented in MVP - KV doesn't support efficient pattern deletion
// Consider if invalidation latency becomes an issue
```

---

### Strategy 3: Time-Based Expiration (Supplementary)

**How it works:**
- Every cache entry has a TTL
- KV automatically expires keys
- No manual invalidation needed

**Advantages:**
- Simple implementation
- Automatic cleanup
- Works for all data types

**Disadvantages:**
- May serve stale data for TTL duration
- Can't force immediate invalidation
- Not suitable for critical data

**Implementation:**

```typescript
// Set TTL when caching
await env.KV.put(key, value, {
  expirationTtl: 300 // 5 minutes
});

// KV handles expiration automatically
```

---

### Invalidation Triggers

**Database Mutations:**
```typescript
// After any CREATE/UPDATE/DELETE operation
await invalidateCacheForResource(resourceType, resourceId, userId);
```

**Manual Admin Operations:**
```typescript
// Admin panel action to clear cache
await invalidateAll('/api/v1/projects'); // Clear all project caches
```

**Feature Flag Changes:**
```typescript
// When feature flag updated
await invalidateFeatureFlag(flagName);
```

**Emergency Cache Clear:**
```typescript
// Increment global cache version (nuclear option)
await incrementCacheVersion('global', env);
```

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Cache hit: < 50ms (p95), < 100ms (p99)
- Cache miss: < 300ms (p95), < 500ms (p99)
- Cache write: < 20ms (async, non-blocking)
- Invalidation: < 10ms (version increment)

**Throughput:**
- KV reads: 10,000+ requests/second per region
- KV writes: 1,000 requests/second (rate limited by KV)
- Cache hit rate: 60%+ target

**Storage:**
- Max key size: 512 bytes
- Max value size: 25 MB (typical: < 100 KB)
- Total storage: 1 GB (free tier), unlimited (paid)

### Optimization Strategy

**Read Optimization:**
- Keep values small (< 100 KB)
- Compress large responses
- Use appropriate TTLs (balance freshness vs. hits)
- Cache at edge (lowest latency)

**Write Optimization:**
- Async cache writes (don't block response)
- Batch invalidations when possible
- Use version-based invalidation (faster than deletion)

**Memory Optimization:**
- Serialize to JSON (compact)
- Remove unnecessary headers before caching
- Don't cache error responses (unless specific use case)

---

## Scalability

### Horizontal Scaling

**Workers:**
- Cache code runs in every Worker instance
- No shared state (each Worker reads from KV independently)
- Scales automatically with traffic

**KV Storage:**
- Eventually consistent global replication
- Reads are local to edge location (low latency)
- Writes propagate globally (< 60 seconds)
- No single point of failure

### Vertical Scaling

**KV Capacity:**
- Storage: Unlimited on paid plan
- Keys: Unlimited
- Values: 25 MB max per key
- Operations: 1000 writes/second, unlimited reads

**Worker Limits:**
- CPU time: 50ms per request (cache operations < 1ms)
- Memory: 128 MB (cache serialization < 1 MB typically)

### Bottlenecks

**Potential bottlenecks:**
1. **KV write rate limit** (1000 writes/second)
   - Mitigation: Batch invalidations, use version-based invalidation
2. **Large cached values** (> 1 MB)
   - Mitigation: Compress, paginate, cache references not full data
3. **Cache stampede** (many requests after invalidation)
   - Mitigation: Stale-while-revalidate pattern

### Capacity Planning

**Current capacity (estimated):**
- Workers: Unlimited with Cloudflare
- KV storage: 1 GB (free), unlimited (paid)
- Cache hit rate: 60%+ expected

**Growth projections:**
- Year 1: 100 MB cached data, 1M reads/day
- Year 2: 1 GB cached data, 10M reads/day
- Year 3: 10 GB cached data, 100M reads/day

---

## Failure Modes

### Failure Mode 1: KV Storage Unavailable

**Scenario:** Cloudflare KV is down or slow

**Impact:** Cache misses for all requests, increased backend load

**Detection:**
- KV operations timeout (> 1s)
- Increased cache miss rate
- Backend load spike

**Recovery:**
1. Worker detects KV unavailability
2. Bypass cache, proxy directly to backend
3. Set circuit breaker to skip cache for 5 minutes
4. Resume normal caching when KV recovers

**Prevention:**
- Set short timeouts on KV operations (1 second)
- Always have fallback to backend
- Don't block requests on KV failures

```typescript
async function getCachedWithFallback(
  key: string,
  env: Env,
  fallback: () => Promise<Response>
): Promise<Response> {
  try {
    const cached = await Promise.race([
      env.KV.get(key),
      sleep(1000).then(() => null) // Timeout after 1s
    ]);

    if (cached) return deserializeResponse(cached);
  } catch (error) {
    console.error('Cache unavailable:', error);
  }

  // Fallback to backend
  return await fallback();
}
```

---

### Failure Mode 2: Cache Stampede

**Scenario:** Popular cache entry expires, many requests try to refresh simultaneously

**Impact:** Sudden spike in backend load, potential backend overload

**Detection:**
- Many cache misses for same key at once
- Backend latency spike
- Increased error rate

**Recovery:**
1. Implement cache locking (first request fetches, others wait)
2. Serve stale data while refreshing in background
3. Rate limit backend requests

**Prevention:**
- Stale-while-revalidate pattern
- Cache locking/deduplication
- Gradual TTL expiration (add jitter)

```typescript
// Stale-while-revalidate implementation
async function getWithRevalidate(
  key: string,
  env: Env,
  fetchFn: () => Promise<Response>
): Promise<Response> {
  const cached = await env.KV.get(key);

  if (cached) {
    const { timestamp, ttl } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age > ttl * 1000) {
      // Stale - trigger background refresh
      ctx.waitUntil(
        fetchFn().then(response => env.KV.put(key, serialize(response)))
      );
    }

    // Return stale data immediately
    return deserializeResponse(cached);
  }

  // No cache - fetch and cache
  const response = await fetchFn();
  await env.KV.put(key, serialize(response));
  return response;
}
```

---

### Failure Mode 3: Stale Data Served

**Scenario:** Cache invalidation doesn't propagate quickly, users see outdated data

**Impact:** User confusion, potential data inconsistency

**Detection:**
- User reports seeing old data
- Cache age > expected TTL
- Version mismatch in logs

**Recovery:**
1. Manual cache purge for affected keys
2. Reduce TTL temporarily
3. Force cache refresh via admin panel

**Prevention:**
- Use version-based invalidation (instant)
- Set appropriate TTLs (shorter for critical data)
- Monitor cache hit/miss ratios
- Log cache ages and versions

---

## Alternatives Considered

### Alternative 1: Redis for Caching

**Description:** Use external Redis instance instead of Workers KV

**Pros:**
- Strong consistency
- More cache operations (pattern deletion, TTL updates)
- Familiar caching patterns
- Better observability

**Cons:**
- Additional infrastructure to manage
- Latency to Redis (not at edge)
- Increased costs
- Single point of failure

**Why not chosen:**
Workers KV provides sufficient functionality for our use case with lower operational overhead and better edge performance.

---

### Alternative 2: HTTP Caching Only

**Description:** Rely solely on HTTP cache headers and CDN caching, no KV

**Pros:**
- Standard HTTP caching semantics
- Less custom code to maintain
- Browser caching automatically handled

**Cons:**
- Can't cache authenticated responses easily
- No control over cache invalidation
- Can't implement custom cache keys
- No rate limiting support

**Why not chosen:**
HTTP caching alone is insufficient for authenticated API responses and doesn't support rate limiting counters.

---

### Alternative 3: In-Memory Caching (Worker Global State)

**Description:** Cache data in Worker global scope between requests

**Pros:**
- Fastest possible reads (no KV latency)
- No KV costs
- Simple implementation

**Cons:**
- Not shared across Workers/regions
- Lost on Worker restart
- Limited memory (128 MB per isolate)
- Inconsistent across edge locations

**Why not chosen:**
Workers are stateless and ephemeral. Global state is unreliable for caching.

---

## Decision Log

### Decision 1: Use Version-Based Invalidation

**Date:** 2025-10-30

**Context:**
Need to invalidate cache entries when data changes. KV doesn't support pattern-based deletion.

**Options:**
1. **Version-based invalidation** - Increment version, old keys unreachable
2. **Tag-based invalidation** - Maintain key index, delete matching keys
3. **TTL-only** - Rely on automatic expiration

**Decision:** Use version-based invalidation as primary strategy

**Rationale:**
- Works with eventually consistent KV
- Instant invalidation (no need to find keys)
- Scales to millions of cache entries
- Simpler than maintaining tag index

**Consequences:**
- Old cached data remains in KV until TTL expires (storage cost)
- Must track cache versions for each pattern
- Requires discipline in cache key generation

---

### Decision 2: Default TTL of 300 Seconds

**Date:** 2025-10-30

**Context:**
Need to balance data freshness with cache hit rate and backend load.

**Options:**
1. **60 seconds** - Very fresh, but many cache misses
2. **300 seconds (5 minutes)** - Balance of freshness and hits
3. **3600 seconds (1 hour)** - High hit rate, but stale data

**Decision:** Default TTL of 300 seconds with overrides per endpoint

**Rationale:**
- 5 minutes is acceptable staleness for most data
- Can override for critical endpoints (shorter TTL)
- Can override for static data (longer TTL)
- Strikes balance between UX and performance

**Consequences:**
- Users may see slightly stale data (up to 5 minutes)
- Must use cache invalidation for immediate updates
- Need monitoring to ensure TTLs are appropriate

---

### Decision 3: Compress Large Cached Values

**Date:** 2025-10-30

**Context:**
Some API responses are large (> 100 KB), consuming KV storage and slowing serialization.

**Options:**
1. **No compression** - Simple but wasteful
2. **Gzip compression** - Standard, good ratio
3. **Brotli compression** - Better ratio but slower

**Decision:** Use gzip compression for values > 50 KB

**Rationale:**
- Gzip provides 60-80% size reduction for JSON
- Fast compression/decompression in Workers
- Reduces KV storage costs
- Reduces network transfer to KV

**Consequences:**
- Small CPU overhead for compression
- Must decompress on cache hit
- Adds complexity to cache manager

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `06-backend/cloudflare-workers/workers-architecture.md` - Workers architecture and routing
- [x] `02-architecture/system-overview.md` - Overall system architecture
- [x] `TECH-STACK.md` - Technology decisions

**External Services:**
- Cloudflare Workers KV - Key-value storage (SLA: 99.9%)
- Cloudflare Workers - Serverless runtime (SLA: 99.99%)

### Architecture Dependencies

**Depends on these components:**
- Workers API Gateway - Cache manager runs in gateway
- Authentication Module - User context for cache keys
- Request Router - Determine cacheability

**Required by these components:**
- Rate Limiter - Depends on KV for counter storage
- Feature Flag System - Depends on KV for flag storage

---

## References

### Internal Documentation
- `06-backend/cloudflare-workers/workers-architecture.md` - Workers architecture
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [Cloudflare Workers KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/) - KV API reference
- [KV Best Practices](https://developers.cloudflare.com/workers/learning/how-kv-works/) - How KV works
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside) - Caching pattern
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching) - HTTP cache headers

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial caching strategy document |

---

## Notes

### Future Enhancements
- Implement cache warming for critical data on deployment
- Add cache analytics dashboard (hit rates, sizes, latencies)
- Implement stale-while-revalidate for better UX
- Add cache compression for large responses
- Implement tag-based invalidation if KV adds pattern deletion

### Known Issues
- KV eventual consistency may cause brief inconsistencies (< 60s)
- Large cached values (> 1 MB) impact serialization performance
- Cache stampede possible on popular expired entries
- Version-based invalidation leaves old data in KV until TTL expires

### Next Review Date
2025-11-30 - Review after initial caching implementation and performance testing
