---
Document: API REST Design - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 04-database/schemas/users-organizations.md, 04-database/schemas/secrets-metadata.md, 03-security/auth/authentication-flow.md, TECH-STACK.md, GLOSSARY.md
---

# API REST Design Architecture

## Overview

This document defines the REST API architecture for Abyrith, establishing comprehensive standards for API design, authentication, request/response formats, error handling, rate limiting, and pagination. All API endpoints must adhere to these specifications to ensure consistency, security, and maintainability across the platform.

**Purpose:** Provide a unified API design standard that enables secure, performant, and developer-friendly interactions between frontend clients, AI tools (via MCP), and the Abyrith backend services.

**Scope:** All REST API endpoints exposed by Cloudflare Workers and PostgREST (via Supabase), excluding real-time WebSocket connections.

**Status:** Draft - Subject to refinement during implementation

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [API Conventions](#api-conventions)
6. [Authentication & Authorization](#authentication--authorization)
7. [Request/Response Formats](#requestresponse-formats)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Pagination & Filtering](#pagination--filtering)
11. [Versioning Strategy](#versioning-strategy)
12. [Performance Characteristics](#performance-characteristics)
13. [Security Architecture](#security-architecture)
14. [Testing Strategy](#testing-strategy)
15. [Dependencies](#dependencies)
16. [References](#references)
17. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith needs a well-defined REST API that supports multiple client types (web frontend, CLI, AI tools) while maintaining zero-knowledge encryption, enforcing security policies, and providing excellent developer experience.

**Pain points:**
- Inconsistent API design leads to confusion and errors
- Poor error messages make debugging difficult
- Unclear rate limiting causes service disruptions
- Inconsistent authentication patterns create security vulnerabilities
- Lack of API versioning makes breaking changes risky

**Why now?**
The API is the contract between frontend, backend, and external integrations. Defining it clearly before implementation prevents costly refactoring and ensures all clients have a consistent experience.

### Background

**Existing system:**
This is a greenfield implementation. No existing API to migrate from.

**Previous attempts:**
N/A - Initial design.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Backend Team | Clear API specifications, maintainability | Avoid over-engineering, ensure scalability |
| Frontend Team | Consistent API patterns, good error messages | Performance, type safety |
| Security Lead | Authentication, authorization, data protection | Zero-knowledge compliance, audit logging |
| AI Integration Team | MCP-compatible endpoints, rate limits | Token efficiency, clear documentation |
| End Users | Fast, reliable API | Downtime, data loss |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Consistency** - All endpoints follow identical patterns for naming, authentication, errors, and responses (success metric: 100% adherence in code review)
2. **Security** - JWT-based authentication, RBAC enforcement, zero-knowledge architecture preserved (success metric: 0 security vulnerabilities in penetration test)
3. **Developer Experience** - Clear error messages, predictable behavior, comprehensive documentation (success metric: <5min to integrate new endpoint)
4. **Performance** - <200ms p95 response time for edge-cached queries, <500ms for database queries (success metric: Cloudflare Analytics confirmation)

**Secondary goals:**
- Support API versioning for future breaking changes
- Enable efficient pagination for large datasets
- Provide detailed rate limit feedback
- Support partial updates (PATCH) where appropriate

### Non-Goals

**Explicitly out of scope:**
- **GraphQL API** - REST only for MVP; GraphQL may be considered post-MVP
- **gRPC endpoints** - REST is sufficient for current use cases
- **XML support** - JSON only for simplicity
- **SOAP compatibility** - Modern REST patterns only
- **Custom binary protocols** - HTTP/JSON standard

### Success Metrics

**How we measure success:**
- **Response Time**: p95 < 200ms (edge), p95 < 500ms (database queries)
- **Error Rate**: < 0.1% server errors (5xx)
- **API Consistency**: 100% of endpoints follow design standards
- **Rate Limit Fairness**: < 0.5% legitimate requests rejected due to rate limits

---

## Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────┐
│              Clients                         │
│  • Web Frontend (React/Next.js)              │
│  • CLI Tool (Node.js)                        │
│  • MCP Clients (Claude Code, Cursor)         │
│  • Mobile Apps (Future)                      │
└────────────────┬─────────────────────────────┘
                 │
                 │ HTTPS + JSON + JWT
                 │
                 ▼
┌──────────────────────────────────────────────┐
│      Cloudflare Workers (API Gateway)        │
│  • JWT Verification                          │
│  • Rate Limiting (per user, per IP)          │
│  • Request Validation                        │
│  • CORS Configuration                        │
│  • Response Caching (KV)                     │
└────────────────┬─────────────────────────────┘
                 │
                 │ Internal Routing
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────────────┐
│  PostgREST   │  │ Custom Workers       │
│  (Supabase)  │  │ • Complex logic      │
│  • CRUD ops  │  │ • AI integration     │
│  • RLS       │  │ • Encryption         │
│  • Filters   │  │ • MCP endpoints      │
└──────┬───────┘  └──────┬───────────────┘
       │                 │
       └────────┬────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│         Supabase PostgreSQL 15.x             │
│  • Row-Level Security (RLS) enforcement      │
│  • Multi-tenancy isolation                   │
│  • ACID transactions                         │
│  • Audit logging                             │
└──────────────────────────────────────────────┘
```

### Key Components

**Component 1: API Gateway (Cloudflare Workers)**
- **Purpose:** Single entry point for all API requests, handling cross-cutting concerns
- **Technology:** TypeScript on Cloudflare Workers (V8 runtime)
- **Responsibilities:**
  - JWT token verification and user context extraction
  - Rate limiting enforcement (per user, per IP)
  - Request validation (headers, content-type)
  - CORS policy enforcement
  - Response caching in Workers KV
  - Request routing to PostgREST or custom Workers
  - Security headers injection (CSP, X-Frame-Options)

**Component 2: PostgREST (Supabase)**
- **Purpose:** Auto-generated REST API from PostgreSQL schema
- **Technology:** PostgREST (built into Supabase)
- **Responsibilities:**
  - CRUD operations on database tables
  - RLS policy enforcement
  - Query filtering, sorting, pagination
  - Relationship traversal (joins)
  - Efficient SQL query generation
  - Transaction management

**Component 3: Custom Workers (Cloudflare)**
- **Purpose:** Business logic not suitable for PostgREST
- **Technology:** TypeScript on Cloudflare Workers
- **Responsibilities:**
  - Complex multi-step operations
  - AI integration (Claude API)
  - Secret encryption orchestration
  - MCP endpoint implementation
  - Webhook handling
  - Background job scheduling

**Component 4: Workers KV (Edge Cache)**
- **Purpose:** Low-latency caching at the edge
- **Technology:** Cloudflare Workers KV
- **Responsibilities:**
  - JWT verification cache (5-minute TTL)
  - Rate limit counters (1-hour sliding window)
  - API response cache for immutable data
  - Feature flags

### Component Interactions

**Client ↔ API Gateway:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON
- Authentication: JWT Bearer token in Authorization header
- Content negotiation: JSON only (no XML)

**API Gateway ↔ PostgREST:**
- Protocol: HTTPS (internal)
- Data format: JSON
- Authentication: Service role key (server-side only)
- RLS: Enforced via JWT claims passed to PostgREST

**API Gateway ↔ Custom Workers:**
- Protocol: Internal (same edge network)
- Data format: JSON
- Authentication: Shared secrets (not exposed externally)

**Custom Workers ↔ PostgreSQL:**
- Protocol: PostgreSQL wire protocol
- Connection: Supabase connection pooler (PgBouncer)
- Authentication: Service role credentials

---

## Component Details

### Component: API Gateway (Cloudflare Workers)

**Purpose:** Centralized request handling, authentication, and routing

**Responsibilities:**
- Verify JWT tokens on every request
- Extract user context (user_id, org_id, role)
- Enforce rate limits before forwarding requests
- Validate request structure and content-type
- Route requests to appropriate backend (PostgREST or custom Workers)
- Add security headers to all responses
- Cache responses in Workers KV where appropriate

**Technology Stack:**
- Cloudflare Workers (TypeScript, V8 runtime)
- Workers KV (caching and rate limit storage)
- Supabase Auth Helpers (JWT verification)

**Internal Architecture:**
```
┌───────────────────────────────────────┐
│        Request Handler                │
│  • Extract JWT from Authorization     │
│  • Validate request headers           │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│     Authentication Middleware         │
│  • Verify JWT signature               │
│  • Check token expiration             │
│  • Extract user context               │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│      Rate Limiting Middleware         │
│  • Check user rate limits             │
│  • Check IP rate limits               │
│  • Increment counters in KV           │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│           Router                      │
│  • Match path to handler              │
│  • Route to PostgREST or custom       │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│      Response Handler                 │
│  • Add security headers               │
│  • Format error responses             │
│  • Cache responses (if applicable)    │
└───────────────────────────────────────┘
```

**Key Functions:**

```typescript
// JWT verification with caching
async function verifyJWT(token: string, env: Env): Promise<JWTPayload | null> {
  // Check KV cache first (5-minute TTL)
  const cacheKey = `jwt:${token.substring(0, 32)}`;
  const cached = await env.KV.get(cacheKey, { type: 'json' });
  if (cached) return cached as JWTPayload;

  // Verify with Supabase
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    org_id: user.user_metadata.org_id,
    role: user.role,
    exp: user.exp
  };

  // Cache for 5 minutes
  await env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 300 });

  return payload;
}

// Rate limiting check
async function checkRateLimit(
  userId: string,
  ip: string,
  env: Env
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowSize = 3600; // 1 hour

  // User-based rate limit: 1000 requests per hour
  const userKey = `ratelimit:user:${userId}:${Math.floor(now / windowSize)}`;
  const userCount = await env.KV.get(userKey);
  const currentUserCount = parseInt(userCount || '0');

  if (currentUserCount >= 1000) {
    return { allowed: false, retryAfter: windowSize - (now % windowSize) };
  }

  // IP-based rate limit: 100 requests per hour (for unauthenticated)
  const ipKey = `ratelimit:ip:${ip}:${Math.floor(now / windowSize)}`;
  const ipCount = await env.KV.get(ipKey);
  const currentIpCount = parseInt(ipCount || '0');

  if (!userId && currentIpCount >= 100) {
    return { allowed: false, retryAfter: windowSize - (now % windowSize) };
  }

  // Increment counters
  await env.KV.put(userKey, String(currentUserCount + 1), { expirationTtl: windowSize });
  await env.KV.put(ipKey, String(currentIpCount + 1), { expirationTtl: windowSize });

  return { allowed: true };
}
```

**Configuration:**
```typescript
interface WorkerConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  postgrestUrl: string;
  allowedOrigins: string[];
  rateLimits: {
    authenticatedPerHour: number;
    unauthenticatedPerHour: number;
  };
}
```

---

## API Conventions

### URL Structure

**Base URL:**
```
Production:  https://api.abyrith.com/v1
Staging:     https://api-staging.abyrith.com/v1
Development: http://localhost:54321/rest/v1 (Supabase local)
```

**Path Structure:**
```
/{version}/{resource}/{id?}/{sub-resource?}
```

**Examples:**
```
GET    /v1/projects                        # List projects
GET    /v1/projects/:id                    # Get project by ID
GET    /v1/projects/:id/secrets            # List secrets in project
POST   /v1/projects                        # Create project
PUT    /v1/projects/:id                    # Update project
DELETE /v1/projects/:id                    # Delete project
GET    /v1/organizations/:id/members       # List organization members
POST   /v1/secrets/:id/rotate              # Custom action (rotate secret)
```

### Naming Conventions

**Resource Names:**
- Plural nouns (`/projects`, `/secrets`, `/organizations`)
- Lowercase with hyphens for multi-word resources (`/api-keys`, `/audit-logs`)
- Never use verbs in resource paths (use HTTP methods instead)

**Query Parameters:**
- Snake case (`?sort_by=created_at`, `?per_page=20`)
- Consistent across all endpoints
- Boolean values: `true` or `false` (not `1`/`0` or `yes`/`no`)

**JSON Field Names:**
- Snake case (`user_id`, `created_at`, `organization_name`)
- Consistent with database column names
- ISO 8601 for timestamps (`2025-10-30T12:00:00Z`)
- UUIDs as strings

### HTTP Methods

**Standard CRUD operations:**

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create resource | No | No |
| PUT | Replace entire resource | Yes | No |
| PATCH | Update partial resource | No | No |
| DELETE | Remove resource | Yes | No |

**Method Usage Guidelines:**
- **GET**: Must never modify server state, safe to cache
- **POST**: Create new resource, return 201 with Location header
- **PUT**: Replace entire resource, requires all fields
- **PATCH**: Update specific fields, partial payload allowed
- **DELETE**: Return 204 No Content on success

**Non-standard actions:**
Use POST with action in path:
```
POST /v1/secrets/:id/rotate     # Rotate secret
POST /v1/projects/:id/archive   # Archive project
POST /v1/invitations/:id/accept # Accept invitation
```

### Content Negotiation

**Request:**
- **Required header:** `Content-Type: application/json`
- **Charset:** UTF-8 (default)
- **Accept header:** `application/json` (optional, implied)

**Response:**
- **Content-Type:** `application/json; charset=utf-8`
- **No support for:** XML, YAML, or other formats

---

## Authentication & Authorization

### Authentication Flow

**1. Client obtains JWT token:**
```typescript
// Login with email/password
POST /auth/v1/token
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "account_password_here"
}

// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": { ... }
}
```

**2. Client includes JWT in all API requests:**
```http
GET /v1/projects
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**3. API Gateway verifies JWT:**
- Validates signature using Supabase public key
- Checks expiration (`exp` claim)
- Extracts user context (`sub`, `email`, `org_id`, `role`)
- Caches result in Workers KV (5-minute TTL)

**4. Backend enforces authorization:**
- PostgreSQL RLS policies check user_id and org_id
- Application logic checks role-based permissions
- Audit logs record access attempts

### JWT Structure

**Token Format:**
```typescript
interface JWTPayload {
  // Standard JWT claims
  aud: 'authenticated';
  exp: number;                // Unix timestamp
  iat: number;                // Unix timestamp
  iss: string;                // Supabase project URL
  sub: string;                // User ID (UUID)

  // User identity
  email: string;
  phone?: string;
  role: 'authenticated';

  // Custom claims (Abyrith-specific)
  app_metadata: {
    provider: string;         // 'email' | 'google' | 'github'
    providers: string[];
  };

  user_metadata: {
    org_id?: string;          // Primary organization ID
    display_name?: string;
    avatar_url?: string;
  };
}
```

**Example Decoded JWT:**
```json
{
  "aud": "authenticated",
  "exp": 1730302800,
  "iat": 1730299200,
  "iss": "https://example.supabase.co/auth/v1",
  "sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "user@example.com",
  "role": "authenticated",
  "user_metadata": {
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "display_name": "Jane Doe"
  }
}
```

### Authorization Headers

**Required Headers:**
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Optional Headers:**
```http
X-Organization-ID: {org_uuid}    # Override primary org (if user is member)
X-Request-ID: {uuid}             # Client-provided request tracking
```

### Authorization Enforcement

**Level 1: API Gateway (Cloudflare Workers)**
- Verify JWT signature and expiration
- Reject invalid or expired tokens (401)
- Extract user context for downstream services

**Level 2: PostgreSQL RLS (Supabase)**
- Row-level security policies filter data by organization
- Users can only access data from organizations they belong to
- Automatic enforcement at database level

**Level 3: Application Logic (Custom Workers)**
- Role-based permission checks for operations
- Complex authorization rules (e.g., approval workflows)
- Custom business logic enforcement

**Permission Hierarchy:**
```
Owner > Admin > Developer > Read-Only

Owner:      All permissions, can delete organization
Admin:      Manage keys and team, cannot delete org
Developer:  Read/write secrets, cannot manage team
Read-Only:  View secret metadata only (no decryption)
```

### Unauthenticated Endpoints

**Public endpoints (no JWT required):**
- `POST /auth/v1/token` - Login
- `POST /auth/v1/signup` - Registration
- `POST /auth/v1/recover` - Password reset request
- `GET /health` - Health check
- `GET /v1/api-service-info` - Public API service catalog (read-only)

**Rate limiting applies** to unauthenticated endpoints (stricter limits).

---

## Request/Response Formats

### Request Format

**Standard Request Structure:**
```http
POST /v1/projects
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "RecipeApp",
  "description": "API keys for recipe application",
  "settings": {
    "default_environment": "development",
    "require_approval_for_production": true
  }
}
```

**Request Body Requirements:**
- JSON format (UTF-8 encoded)
- Snake case field names
- ISO 8601 timestamps
- UUIDs as strings
- Booleans as `true`/`false`
- Null values for optional missing fields

### Response Format

**Standard Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "RecipeApp",
  "description": "API keys for recipe application",
  "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "settings": {
    "default_environment": "development",
    "require_approval_for_production": true
  },
  "archived": false,
  "created_at": "2025-10-30T12:00:00.000Z",
  "updated_at": "2025-10-30T12:00:00.000Z",
  "created_by": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Created Resource Response (201 Created):**
```http
HTTP/1.1 201 Created
Location: /v1/projects/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "RecipeApp",
  ...
}
```

**No Content Response (204 No Content):**
```http
HTTP/1.1 204 No Content
```
(Used for DELETE operations and updates with no response body)

**List Response with Pagination:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "RecipeApp",
      ...
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "BlogAPI",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

### Common Response Headers

**Every response includes:**
```http
Content-Type: application/json; charset=utf-8
X-Request-ID: {uuid}
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1730305600
Cache-Control: no-cache, no-store, must-revalidate
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'none'
```

---

## Error Handling

### Error Response Format

**Standard Error Response:**
```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code (UPPER_SNAKE_CASE)
    message: string;        // Human-readable error message
    details?: object;       // Additional error context (optional)
    request_id: string;     // Request ID for debugging
    timestamp: string;      // ISO 8601 timestamp
  };
}
```

**Example Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": {
      "field": "name",
      "issue": "Name must be between 1 and 255 characters"
    },
    "request_id": "req_7f8e9d0c1b2a3456",
    "timestamp": "2025-10-30T12:00:00.000Z"
  }
}
```

### HTTP Status Codes

| Status Code | Error Type | Description | When to Use |
|-------------|------------|-------------|-------------|
| 400 | Bad Request | Invalid request payload or parameters | Validation errors, malformed JSON |
| 401 | Unauthorized | Missing, invalid, or expired JWT token | Authentication failure |
| 403 | Forbidden | Valid token but insufficient permissions | Authorization failure |
| 404 | Not Found | Resource doesn't exist or user lacks access | Missing resource (with RLS consideration) |
| 409 | Conflict | Operation conflicts with existing state | Duplicate resource, concurrent modification |
| 422 | Unprocessable Entity | Semantically invalid request | Business logic validation failure |
| 429 | Too Many Requests | Rate limit exceeded | Client exceeded rate limits |
| 500 | Internal Server Error | Unexpected server error | Unhandled exceptions |
| 502 | Bad Gateway | Upstream service unavailable | Supabase/database unavailable |
| 503 | Service Unavailable | Service temporarily unavailable | Maintenance mode, overload |

### Common Error Codes

**Authentication Errors:**
```typescript
'INVALID_TOKEN'           // JWT signature invalid or malformed
'TOKEN_EXPIRED'           // JWT expiration time passed
'MISSING_AUTHORIZATION'   // Authorization header not provided
'INVALID_CREDENTIALS'     // Email/password authentication failed
```

**Authorization Errors:**
```typescript
'INSUFFICIENT_PERMISSIONS' // User role lacks required permission
'RESOURCE_ACCESS_DENIED'   // User cannot access this specific resource
'ORGANIZATION_MISMATCH'    // Resource belongs to different organization
```

**Validation Errors:**
```typescript
'VALIDATION_ERROR'         // Generic validation failure
'MISSING_REQUIRED_FIELD'   // Required field not provided
'INVALID_FIELD_FORMAT'     // Field format incorrect (e.g., email, UUID)
'FIELD_OUT_OF_RANGE'       // Numeric/string field exceeds limits
```

**Resource Errors:**
```typescript
'RESOURCE_NOT_FOUND'       // Resource doesn't exist
'RESOURCE_ALREADY_EXISTS'  // Duplicate resource (e.g., unique constraint)
'RESOURCE_DELETED'         // Resource was soft-deleted
'RESOURCE_ARCHIVED'        // Resource is archived (read-only)
```

**Rate Limiting Errors:**
```typescript
'RATE_LIMIT_EXCEEDED'      // Too many requests
'QUOTA_EXCEEDED'           // Monthly/daily quota exceeded
```

**Server Errors:**
```typescript
'INTERNAL_ERROR'           // Unexpected server error
'DATABASE_ERROR'           // Database connection/query failure
'EXTERNAL_SERVICE_ERROR'   // Third-party service (Claude API, FireCrawl) failed
```

### Error Response Examples

**400 Bad Request - Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": {
      "name": ["Name is required"],
      "organization_id": ["Must be a valid UUID"]
    },
    "request_id": "req_7f8e9d0c1b2a3456",
    "timestamp": "2025-10-30T12:00:00.000Z"
  }
}
```

**401 Unauthorized - Token Expired:**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired. Please log in again.",
    "details": {
      "expired_at": "2025-10-30T11:00:00.000Z"
    },
    "request_id": "req_8a9b0c1d2e3f4567",
    "timestamp": "2025-10-30T12:00:00.000Z"
  }
}
```

**403 Forbidden - Insufficient Permissions:**
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to perform this action",
    "details": {
      "required_role": ["owner", "admin"],
      "current_role": "developer"
    },
    "request_id": "req_9b0c1d2e3f4g5678",
    "timestamp": "2025-10-30T12:00:00.000Z"
  }
}
```

**429 Too Many Requests - Rate Limit:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2025-10-30T13:00:00.000Z"
    },
    "request_id": "req_0c1d2e3f4g5h6789",
    "timestamp": "2025-10-30T12:00:00.000Z"
  }
}
```

### Error Handling Best Practices

**Backend (API) Responsibilities:**
- Return appropriate HTTP status codes
- Provide machine-readable error codes
- Include actionable error messages
- Log full error details server-side
- Never expose sensitive information in errors
- Generate unique request IDs for tracing

**Frontend (Client) Responsibilities:**
- Check HTTP status code first
- Parse `error.code` for programmatic handling
- Display `error.message` to users
- Log `error.details` and `request_id` for debugging
- Implement exponential backoff for 429 errors
- Handle network errors gracefully

---

## Rate Limiting

### Rate Limit Rules

**Authenticated Users:**
- **1,000 requests per hour** per user (all endpoints combined)
- Limit tracked by JWT `sub` claim (user ID)
- Resets hourly (sliding window)

**Unauthenticated Users:**
- **100 requests per hour** per IP address
- Limit tracked by client IP
- Resets hourly (sliding window)

**Per-Endpoint Overrides:**
- `/v1/secrets/*` - 500 requests/hour (more sensitive operations)
- `/v1/mcp/*` - 200 requests/hour (AI tool integrations, token-limited)
- `/auth/v1/token` - 10 requests/hour (login attempts, brute-force protection)

### Rate Limit Headers

**Every response includes rate limit information:**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1730305600
X-RateLimit-Policy: user;w=3600
```

**Header Definitions:**
- `X-RateLimit-Limit` - Maximum requests allowed in the current window
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Unix timestamp when limit resets
- `X-RateLimit-Policy` - Rate limit policy identifier (for debugging)

### Rate Limit Exceeded Response

**HTTP 429 Too Many Requests:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 45 minutes.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2025-10-30T13:00:00.000Z",
      "retry_after": 2700
    },
    "request_id": "req_...",
    "timestamp": "2025-10-30T12:15:00.000Z"
  }
}
```

**Additional Response Headers:**
```http
Retry-After: 2700
```

### Rate Limiting Implementation

**Storage:** Cloudflare Workers KV (per-hour buckets)

**Algorithm:** Sliding window counter
```typescript
async function checkRateLimit(
  userId: string,
  ip: string,
  limit: number,
  windowSeconds: number,
  env: Env
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSeconds);
  const key = userId
    ? `ratelimit:user:${userId}:${windowKey}`
    : `ratelimit:ip:${ip}:${windowKey}`;

  // Get current count
  const currentCount = parseInt(await env.KV.get(key) || '0');

  if (currentCount >= limit) {
    const resetAt = (windowKey + 1) * windowSeconds;
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: resetAt,
      retryAfter: resetAt - now
    };
  }

  // Increment counter
  await env.KV.put(
    key,
    String(currentCount + 1),
    { expirationTtl: windowSeconds }
  );

  return {
    allowed: true,
    limit,
    remaining: limit - currentCount - 1,
    reset: (windowKey + 1) * windowSeconds
  };
}
```

### Client-Side Rate Limit Handling

**Best Practices:**
1. Check `X-RateLimit-Remaining` before making requests
2. Implement exponential backoff when receiving 429
3. Respect `Retry-After` header
4. Batch requests when possible
5. Cache responses client-side to reduce requests

**Example Client Logic:**
```typescript
async function makeApiRequest(url: string, options: RequestInit) {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await sleep(retryAfter * 1000);
      retries++;
      continue;
    }

    return response;
  }

  throw new Error('Rate limit exceeded after max retries');
}
```

---

## Pagination & Filtering

### Pagination

**Query Parameters:**
```typescript
interface PaginationParams {
  page?: number;      // Page number (default: 1, min: 1)
  per_page?: number;  // Items per page (default: 20, min: 1, max: 100)
}
```

**Example Request:**
```http
GET /v1/projects?page=2&per_page=50
```

**Paginated Response:**
```json
{
  "data": [
    { "id": "...", "name": "Project 1" },
    { "id": "...", "name": "Project 2" }
  ],
  "pagination": {
    "page": 2,
    "per_page": 50,
    "total": 142,
    "total_pages": 3
  }
}
```

**Response Headers:**
```http
Link: </v1/projects?page=1&per_page=50>; rel="first",
      </v1/projects?page=1&per_page=50>; rel="prev",
      </v1/projects?page=3&per_page=50>; rel="next",
      </v1/projects?page=3&per_page=50>; rel="last"
```

### Sorting

**Query Parameter:**
```
sort={field}:{direction}
```

**Direction:**
- `asc` - Ascending order
- `desc` - Descending order (default)

**Examples:**
```http
GET /v1/projects?sort=name:asc
GET /v1/secrets?sort=updated_at:desc
GET /v1/projects?sort=created_at:desc&page=1&per_page=20
```

**Multiple Sort Fields:**
```http
GET /v1/secrets?sort=service_name:asc,created_at:desc
```

**Sortable Fields:**
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `name` - Alphabetical order
- Resource-specific fields (documented per endpoint)

### Filtering

**Query Parameter Format:**
```
{field}={value}
{field}={operator}:{value}
```

**Operators:**
- `eq` - Equals (default if no operator)
- `neq` - Not equals
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `like` - Pattern match (case-insensitive)
- `in` - In list

**Examples:**
```http
# Exact match (implicit eq)
GET /v1/projects?archived=false

# Greater than
GET /v1/secrets?updated_at=gt:2025-10-01T00:00:00Z

# Pattern match
GET /v1/secrets?key_name=like:%API_KEY%

# In list
GET /v1/projects?organization_id=in:uuid1,uuid2,uuid3

# Multiple filters (AND)
GET /v1/secrets?service_name=openai&environment_id=eq:prod-uuid
```

**Filterable Fields:**
- Depend on resource type
- Documented in endpoint-specific docs
- Always include: `created_at`, `updated_at`

### Combining Pagination, Sorting, and Filtering

**Complex Query Example:**
```http
GET /v1/secrets?
  service_name=like:%openai%&
  environment_id=eq:prod-uuid&
  updated_at=gt:2025-10-01T00:00:00Z&
  sort=updated_at:desc&
  page=1&
  per_page=50
```

**Response:**
```json
{
  "data": [
    {
      "id": "...",
      "key_name": "OPENAI_API_KEY",
      "service_name": "openai",
      "environment_id": "prod-uuid",
      "updated_at": "2025-10-15T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 3,
    "total_pages": 1
  }
}
```

---

## Versioning Strategy

### API Versioning Approach

**Method:** URL path versioning
- Current: `/v1/...`
- Future: `/v2/...` (when breaking changes needed)

**Versioning Philosophy:**
- Major version in URL path (`/v1`, `/v2`)
- Backward-compatible changes don't require version bump
- Breaking changes require new major version
- Support 2 major versions simultaneously (current + previous)
- Deprecate old versions with 6-month notice

**Backward-Compatible Changes (No Version Bump):**
- Adding new endpoints
- Adding optional request fields
- Adding response fields
- Adding new error codes
- Relaxing validation rules

**Breaking Changes (Require Version Bump):**
- Removing endpoints
- Removing request/response fields
- Changing field types
- Changing authentication methods
- Changing URL structure
- Stricter validation rules

### Version Negotiation

**Default Version:**
If no version specified in path, default to latest stable (`/v1`).

**Version Header (Optional):**
```http
X-API-Version: v1
```

**Version in Response:**
```http
X-API-Version: v1
```

### Deprecation Process

**Step 1: Announce Deprecation**
- Add `Deprecation` header to responses
- Update documentation with deprecation notice
- Notify users via email and dashboard

**Example Response:**
```http
Deprecation: date="2026-04-30T00:00:00Z"
Link: </docs/migrations/v1-to-v2>; rel="deprecation"
```

**Step 2: Transition Period (6 months)**
- Both versions available
- Encourage migration to new version
- Provide migration guide

**Step 3: Sunset**
- Remove old version
- Return 410 Gone for requests to old version

**Sunset Response:**
```json
{
  "error": {
    "code": "API_VERSION_SUNSET",
    "message": "API version v1 is no longer supported. Please upgrade to v2.",
    "details": {
      "sunset_date": "2026-04-30T00:00:00Z",
      "migration_guide": "https://docs.abyrith.com/api/migrations/v1-to-v2"
    },
    "request_id": "req_...",
    "timestamp": "2026-05-01T00:00:00Z"
  }
}
```

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Edge-cached requests: < 50ms p50, < 100ms p95
- Database read queries: < 200ms p50, < 500ms p95
- Database write queries: < 300ms p50, < 700ms p95
- Complex multi-table queries: < 500ms p50, < 1000ms p95

**Throughput:**
- API Gateway: 10,000+ requests/second (auto-scales with Cloudflare)
- Database: 1,000 queries/second (Supabase free tier, upgradeable)

**Resource Usage:**
- Workers: 128MB memory limit per request
- Database connections: Pooled via PgBouncer (max 100 connections)

### Performance Optimization

**Caching Strategy:**
1. **Edge Caching (Workers KV):**
   - JWT verification results (5-minute TTL)
   - Immutable resources (organizations, projects metadata)
   - API service info (24-hour TTL)
   - Cache keys include user_id for multi-tenancy

2. **Client-Side Caching:**
   - Browser cache: `Cache-Control: private, max-age=300` (5 minutes)
   - React Query: 5-minute stale time for non-critical data

3. **Cache Invalidation:**
   - Write operations invalidate related cached data
   - Broadcast invalidation via Supabase Realtime

**Database Optimization:**
- Indexes on all foreign keys
- Composite indexes for common query patterns
- RLS policies optimized to use indexes
- Connection pooling via PgBouncer
- Query plan analysis in development

**API Gateway Optimization:**
- Keep Workers code under 1MB (fast deployment)
- Minimize KV reads (batch when possible)
- Use V8 isolates (no cold starts)
- Parallel requests to PostgREST when possible

---

## Security Architecture

### Security Layers

**Layer 1: Network Security (Cloudflare)**
- DDoS protection (automatic)
- TLS 1.3 encryption
- WAF (Web Application Firewall)
- Rate limiting (application layer)

**Layer 2: Authentication (JWT)**
- JWT signature verification
- Token expiration enforcement
- Secure token storage (httpOnly cookies for web)
- Token refresh flow

**Layer 3: Authorization (RLS + RBAC)**
- PostgreSQL Row-Level Security
- Role-based access control
- Organization-level data isolation
- Principle of least privilege

**Layer 4: Data Protection**
- Zero-knowledge encryption (secrets encrypted client-side)
- Encrypted secrets stored as BYTEA
- Master password never transmitted
- TLS for all data in transit

**Layer 5: Audit Logging**
- Every API request logged
- User actions tracked
- Security events flagged
- Immutable audit trail

### Security Headers

**Every response includes:**
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### CORS Configuration

**Allowed Origins:**
```
Production:  https://app.abyrith.com
Staging:     https://app-staging.abyrith.com
Development: http://localhost:3000, http://127.0.0.1:3000
```

**CORS Headers:**
```http
Access-Control-Allow-Origin: https://app.abyrith.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-ID
Access-Control-Expose-Headers: X-RateLimit-*, X-Request-ID
Access-Control-Max-Age: 86400
```

**Preflight Requests:**
```http
OPTIONS /v1/projects
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization

Response:
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.abyrith.com
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Input Validation

**All inputs validated:**
- JSON schema validation (Zod)
- SQL injection prevention (parameterized queries)
- XSS prevention (no HTML in API responses)
- Path traversal prevention (UUID validation)
- File upload validation (if applicable)

**Example Validation (Zod Schema):**
```typescript
const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  organization_id: z.string().uuid(),
  settings: z.object({
    default_environment: z.enum(['development', 'staging', 'production']),
    require_approval_for_production: z.boolean()
  }).optional()
});
```

---

## Testing Strategy

### API Testing Levels

**1. Unit Tests (Vitest)**
- Test individual handler functions
- Mock database and external services
- Validate request/response transformations
- Test error handling logic

**2. Integration Tests (Vitest + MSW)**
- Test API gateway + PostgREST integration
- Mock external services (Claude API, FireCrawl)
- Validate JWT verification
- Test rate limiting logic

**3. End-to-End Tests (Playwright)**
- Full request/response cycle
- Test against staging environment
- Validate authentication flows
- Test pagination and filtering

**4. Load Tests (k6 or Artillery)**
- Simulate 1000+ concurrent users
- Measure p50, p95, p99 latency
- Test rate limiting under load
- Identify bottlenecks

### Test Coverage Requirements

**Critical Paths (100% coverage):**
- Authentication and JWT verification
- Authorization and RLS enforcement
- Error handling and formatting
- Rate limiting logic

**Standard Paths (80% coverage):**
- CRUD operations
- Pagination and filtering
- Input validation

**Lower Priority (50% coverage):**
- Edge cases
- Uncommon error scenarios

### Test Examples

**Unit Test Example:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { verifyJWT } from './auth';

describe('JWT Verification', () => {
  it('should verify valid JWT and return payload', async () => {
    const token = 'valid_jwt_token_here';
    const mockEnv = { SUPABASE_URL: '...', SUPABASE_ANON_KEY: '...' };

    const payload = await verifyJWT(token, mockEnv);

    expect(payload).toMatchObject({
      sub: expect.any(String),
      email: expect.any(String)
    });
  });

  it('should return null for expired JWT', async () => {
    const expiredToken = 'expired_jwt_token_here';
    const mockEnv = { SUPABASE_URL: '...', SUPABASE_ANON_KEY: '...' };

    const payload = await verifyJWT(expiredToken, mockEnv);

    expect(payload).toBeNull();
  });
});
```

**E2E Test Example:**
```typescript
import { test, expect } from '@playwright/test';

test('Create project via API', async ({ request }) => {
  // Login and get JWT
  const loginResponse = await request.post('/auth/v1/token', {
    data: {
      email: 'test@example.com',
      password: 'test_password'
    }
  });
  const { access_token } = await loginResponse.json();

  // Create project
  const response = await request.post('/v1/projects', {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    data: {
      name: 'Test Project',
      organization_id: 'test_org_uuid'
    }
  });

  expect(response.status()).toBe(201);
  const project = await response.json();
  expect(project.name).toBe('Test Project');
  expect(project.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/users-organizations.md` - Database schema for organizations and users
- [x] `04-database/schemas/secrets-metadata.md` - Database schema for secrets and projects
- [x] `03-security/auth/authentication-flow.md` - JWT authentication flow
- [x] `TECH-STACK.md` - Technology stack specifications
- [x] `GLOSSARY.md` - Standard terminology

**External Services:**
- Supabase (PostgreSQL + PostgREST + Auth)
- Cloudflare Workers (API Gateway)
- Cloudflare Workers KV (Caching and rate limits)

### Feature Dependencies

**Required by these features:**
- All frontend features (consumes this API)
- CLI tool (uses these endpoints)
- MCP integration (API-compatible)
- Mobile apps (future)

---

## References

### Internal Documentation
- `05-api/endpoints/` - Specific endpoint documentation (to be created)
- `03-security/rbac/permissions-model.md` - Permission model (to be created)
- `04-database/database-overview.md` - Database architecture (to be created)
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [REST API Best Practices](https://restfulapi.net/) - REST API design patterns
- [HTTP Status Codes](https://httpstatuses.com/) - Complete HTTP status code reference
- [JWT.io](https://jwt.io/) - JWT documentation and tools
- [OpenAPI Specification](https://swagger.io/specification/) - API specification standard
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/) - Workers documentation
- [Supabase API Docs](https://supabase.com/docs/guides/api) - PostgREST and Supabase Auth

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial API REST design specification |

---

## Notes

### Future Enhancements
- **GraphQL API** - Consider GraphQL for complex queries post-MVP
- **Batch Endpoints** - Batch operations for efficiency (e.g., `/v1/secrets/batch`)
- **WebSocket API** - Real-time updates for secrets and audit logs
- **API Analytics** - Per-endpoint usage tracking for optimization
- **API Playground** - Interactive API explorer (Swagger UI)
- **SDK Generation** - Auto-generate TypeScript and Python SDKs from OpenAPI spec

### Known Issues
- Rate limiting uses hourly buckets (consider sliding window for smoother experience)
- Pagination doesn't support cursor-based pagination (may be needed for very large datasets)
- No support for PATCH operations yet (all updates use PUT)

### Migration Considerations
- When adding v2, ensure v1 endpoints continue to work for 6 months
- Use feature flags to gradually roll out new API versions
- Monitor v1 usage metrics to determine sunset timeline
- Provide migration tooling (automated request transformation)

### Next Review Date
2025-12-01 (review after initial implementation and security audit)
