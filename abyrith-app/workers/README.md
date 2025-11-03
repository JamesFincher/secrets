# Abyrith Cloudflare Workers API Gateway

Complete API gateway infrastructure for the Abyrith platform, built with Hono and Cloudflare Workers.

## Architecture

```
┌─────────────────┐
│  Next.js App    │
│  (Frontend)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   Cloudflare Workers API Gateway        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Middleware Chain               │   │
│  │  1. CORS                        │   │
│  │  2. Rate Limiting (KV)          │   │
│  │  3. JWT Authentication          │   │
│  │  4. Error Handling              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Routes                         │   │
│  │  - /health                      │   │
│  │  - /api/v1/secrets              │   │
│  │  - /api/v1/projects             │   │
│  │  - /api/v1/ai/chat              │   │
│  │  - /api/v1/scrape/documentation │   │
│  │  - /api/v1/audit-logs           │   │
│  └─────────────────────────────────┘   │
└────┬────────────────┬────────────┬─────┘
     │                │            │
     ▼                ▼            ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Supabase │   │  Claude  │   │FireCrawl │
│  (DB)    │   │   API    │   │   API    │
└──────────┘   └──────────┘   └──────────┘
```

## Features

### ✅ Implemented

1. **Hono Framework Setup**
   - Fast, lightweight web framework for Cloudflare Workers
   - TypeScript support with full type safety
   - Efficient routing and middleware system

2. **Authentication Middleware**
   - JWT validation using Supabase JWT secret
   - HMAC SHA-256 signature verification
   - Token expiration checking
   - User context extraction and attachment
   - Optional auth for public endpoints

3. **Rate Limiting Middleware**
   - KV-based rate limiting (persistent across workers)
   - Different limits per endpoint type:
     - AI Chat: 10 requests/minute
     - Documentation Scrape: 5 requests/minute
     - API Write: 30 requests/minute
     - API Read: 100 requests/minute
     - Health Check: 1000 requests/minute
   - Rate limit headers in responses
   - Retry-After header on 429 responses

4. **CORS Middleware**
   - Environment-aware origin handling
   - Credentials support
   - Proper preflight (OPTIONS) handling
   - Exposed headers for rate limit info

5. **Error Handler Middleware**
   - Unified error response format
   - Custom ApiError class
   - Zod validation error handling
   - Status code mapping
   - Error logging

6. **TypeScript Types**
   - Complete type definitions for all API contracts
   - Environment bindings
   - Request/response types
   - JWT payload types
   - Error codes and HTTP status constants

7. **Utility Libraries**
   - JWT validation and parsing
   - KV storage helpers
   - Rate limit key generation
   - Cache management

## Project Structure

```
workers/
├── src/
│   ├── index.ts                 # Main Hono app and router
│   ├── types/
│   │   └── api.ts              # TypeScript types and interfaces
│   ├── middleware/
│   │   ├── auth.ts             # JWT authentication
│   │   ├── rate-limit.ts       # KV-based rate limiting
│   │   ├── cors.ts             # CORS headers
│   │   └── error-handler.ts    # Error handling
│   ├── lib/
│   │   ├── jwt.ts              # JWT utilities
│   │   └── kv.ts               # KV storage helpers
│   ├── handlers/               # Route handlers (future)
│   ├── services/               # External service integrations (future)
│   └── mcp/                    # MCP server integration (future)
├── package.json
├── wrangler.toml               # Cloudflare Workers config
└── tsconfig.json
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account
- Wrangler CLI

### Installation

```bash
cd workers
pnpm install
```

### Environment Variables

Set the following secrets using `wrangler secret put`:

```bash
# Supabase configuration
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_JWT_SECRET

# API keys
wrangler secret put CLAUDE_API_KEY
wrangler secret put FIRECRAWL_API_KEY

# Frontend URL (for CORS)
wrangler secret put FRONTEND_URL
```

### KV Namespaces

Create KV namespaces for rate limiting and caching:

```bash
# Create production KV namespaces
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "CACHE_KV"

# Create preview KV namespaces
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
wrangler kv:namespace create "CACHE_KV" --preview
```

Update `wrangler.toml` with the namespace IDs returned by the above commands.

## Development

### Local Development

```bash
pnpm dev
```

This starts the worker at `http://localhost:8787`

### Testing Endpoints

#### Health Check (No Auth)
```bash
curl http://localhost:8787/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "environment": "development",
    "timestamp": "2024-11-02T...",
    "version": "1.0.0"
  },
  "meta": {
    "timestamp": "2024-11-02T..."
  }
}
```

#### Public Status (No Auth, Rate Limited)
```bash
curl http://localhost:8787/api/v1/public/status
```

#### Protected Endpoints (Requires JWT)

First, get a JWT from Supabase Auth. Then:

```bash
# Get secrets (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8787/api/v1/secrets
```

Response:
```json
{
  "success": true,
  "data": {
    "message": "Secrets endpoint - Coming soon",
    "user": {
      "id": "user-id",
      "email": "user@example.com"
    }
  },
  "meta": {
    "timestamp": "2024-11-02T..."
  }
}
```

#### Rate Limiting Test

Make 11 requests to the AI chat endpoint within a minute:

```bash
for i in {1..11}; do
  curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -X POST http://localhost:8787/api/v1/ai/chat
  echo "\n---"
done
```

The 11th request will return:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "statusCode": 429,
    "details": {
      "limit": 10,
      "windowMs": 60000,
      "retryAfter": 42
    }
  }
}
```

## API Endpoints

### Public Endpoints

| Method | Path | Rate Limit | Description |
|--------|------|------------|-------------|
| GET | `/health` | 1000/min | Health check |
| GET | `/api/v1/public/status` | 100/min | API status |

### Protected Endpoints (Require Authentication)

| Method | Path | Rate Limit | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/secrets` | 100/min | List secrets |
| POST | `/api/v1/secrets` | 30/min | Create secret |
| GET | `/api/v1/projects` | 100/min | List projects |
| POST | `/api/v1/projects` | 30/min | Create project |
| POST | `/api/v1/ai/chat` | 10/min | AI chat (Claude) |
| POST | `/api/v1/scrape/documentation` | 5/min | Scrape docs (FireCrawl) |
| GET | `/api/v1/audit-logs` | 100/min | List audit logs |

## Middleware Chain

Every request goes through:

1. **CORS Middleware** - Handles CORS headers and preflight requests
2. **Rate Limiting** - Checks KV for rate limit status
3. **Authentication** (protected routes) - Validates JWT and attaches user
4. **Route Handler** - Executes endpoint logic
5. **Error Handler** - Catches errors and formats responses

## Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1698765432000
```

When rate limit is exceeded, the response includes:

```
Retry-After: 42
```

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "statusCode": 400,
    "details": {
      "field": "additional info"
    }
  },
  "meta": {
    "timestamp": "2024-11-02T..."
  }
}
```

### Error Codes

- `UNAUTHORIZED` - Missing or invalid auth
- `INVALID_TOKEN` - JWT validation failed
- `TOKEN_EXPIRED` - JWT expired
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `VALIDATION_ERROR` - Input validation failed
- `INVALID_INPUT` - Malformed input
- `NOT_FOUND` - Resource not found
- `FORBIDDEN` - Insufficient permissions
- `INTERNAL_ERROR` - Server error
- `SERVICE_UNAVAILABLE` - Service down

## Deployment

### Deploy to Production

```bash
pnpm deploy
```

This will:
1. Build the worker
2. Upload to Cloudflare
3. Deploy to production

### Deploy to Staging

```bash
wrangler deploy --env staging
```

## Integration Points for Other Teams

### Frontend Team

**Base URL:** `https://api.abyrith.com` (production) or `http://localhost:8787` (dev)

**Authentication:**
```typescript
const token = await supabase.auth.getSession().session?.access_token;

const response = await fetch('http://localhost:8787/api/v1/secrets', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

**Rate Limit Handling:**
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  // Wait retryAfter seconds before retrying
}
```

### AI Integration Team

To add Claude API integration:

1. Create `workers/src/services/claude.ts` with Claude API client
2. Create `workers/src/handlers/ai-chat.ts` with chat logic
3. Update the `/api/v1/ai/chat` route in `index.ts` to use your handler

Example:
```typescript
import { handleAiChat } from './handlers/ai-chat';

api.post('/ai/chat', authMiddleware, aiChatRateLimiter, handleAiChat);
```

### FireCrawl Integration Team

To add FireCrawl integration:

1. Create `workers/src/services/firecrawl.ts` with FireCrawl client
2. Create `workers/src/handlers/scrape.ts` with scraping logic
3. Update the `/api/v1/scrape/documentation` route in `index.ts`

Example:
```typescript
import { handleDocumentationScrape } from './handlers/scrape';

api.post('/scrape/documentation', authMiddleware, scrapeRateLimiter, handleDocumentationScrape);
```

## Testing

### Manual Testing Checklist

- [ ] Health endpoint returns 200
- [ ] Rate limiting blocks after threshold
- [ ] JWT validation accepts valid tokens
- [ ] JWT validation rejects invalid tokens
- [ ] JWT validation rejects expired tokens
- [ ] CORS headers present on all responses
- [ ] Error responses follow consistent format
- [ ] Rate limit headers present on all responses

### Automated Testing (Future)

```bash
# Unit tests (future)
pnpm test

# Integration tests (future)
pnpm test:integration
```

## Troubleshooting

### JWT Validation Fails

1. Check that `SUPABASE_JWT_SECRET` is set correctly
2. Verify the token is from Supabase Auth
3. Check token hasn't expired (`exp` claim)
4. Ensure `Authorization: Bearer TOKEN` format

### Rate Limiting Not Working

1. Check KV namespaces are created and bound correctly
2. Verify KV namespace IDs in `wrangler.toml`
3. Check `RATE_LIMIT_KV` is accessible in environment

### CORS Errors

1. Check `FRONTEND_URL` environment variable
2. Verify origin is allowed in CORS config
3. Check preflight (OPTIONS) requests return 204

## Next Steps

1. **Claude API Integration** - Implement AI chat handler
2. **FireCrawl Integration** - Implement documentation scraping
3. **Supabase Integration** - Connect to database for CRUD operations
4. **Streaming Responses** - Add SSE for AI chat streaming
5. **Caching Layer** - Implement KV caching for expensive operations
6. **Monitoring** - Add error tracking and performance monitoring

## Resources

- [Hono Documentation](https://hono.dev/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
