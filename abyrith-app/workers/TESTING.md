# Testing Guide for Cloudflare Workers API Gateway

## Quick Start

### 1. Start Development Server

```bash
cd workers
pnpm dev
```

The worker will be available at `http://localhost:8787`

## Test Scenarios

### Test 1: Health Check (No Auth, Rate Limited)

**Expected:** Should return 200 with health status

```bash
curl http://localhost:8787/health
```

**Expected Response:**
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

**Rate Limit Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1698765432000
```

---

### Test 2: Public Status (No Auth, Rate Limited)

```bash
curl http://localhost:8787/api/v1/public/status
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "api": "Abyrith API Gateway",
    "version": "v1",
    "status": "operational"
  },
  "meta": {
    "timestamp": "2024-11-02T..."
  }
}
```

---

### Test 3: Protected Endpoint Without Auth (Should Fail)

```bash
curl http://localhost:8787/api/v1/secrets
```

**Expected Response (401):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization token",
    "statusCode": 401
  }
}
```

---

### Test 4: Protected Endpoint With Invalid Token (Should Fail)

```bash
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:8787/api/v1/secrets
```

**Expected Response (401):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid signature",
    "statusCode": 401
  }
}
```

---

### Test 5: Protected Endpoint With Valid JWT

First, get a valid JWT from Supabase Auth:

```bash
# Login to Supabase and get JWT
# Store in variable
export JWT_TOKEN="your-jwt-token-here"

# Test secrets endpoint
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8787/api/v1/secrets
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Secrets endpoint - Coming soon",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    }
  },
  "meta": {
    "timestamp": "2024-11-02T..."
  }
}
```

---

### Test 6: Rate Limiting (AI Chat Endpoint)

The AI chat endpoint has a limit of 10 requests per minute.

```bash
# Make 11 requests rapidly
for i in {1..11}; do
  echo "Request $i:"
  curl -H "Authorization: Bearer $JWT_TOKEN" \
    -X POST http://localhost:8787/api/v1/ai/chat
  echo "\n---"
done
```

**Expected:** Requests 1-10 succeed, request 11 returns 429:

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

**Headers on 429 response:**
```
Retry-After: 42
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1698765432000
```

---

### Test 7: CORS Preflight

```bash
curl -X OPTIONS http://localhost:8787/api/v1/secrets \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
```

**Expected Response (204):**
```
Status: 204 No Content
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

---

### Test 8: 404 Not Found

```bash
curl http://localhost:8787/api/v1/nonexistent
```

**Expected Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Endpoint not found",
    "statusCode": 404
  }
}
```

---

## Rate Limit Configuration

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Health Check | 1000/min | 60s |
| API Read | 100/min | 60s |
| API Write | 30/min | 60s |
| AI Chat | 10/min | 60s |
| Documentation Scrape | 5/min | 60s |

---

## Creating Test JWT Tokens

### Option 1: Use Supabase Auth (Recommended)

1. Sign up/login via your Next.js frontend
2. Get token from `supabase.auth.getSession()`
3. Use in tests

### Option 2: Create Test Token Manually (Development Only)

**WARNING:** This is for testing only. Never use in production.

You can create a test JWT using a tool like jwt.io with:

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "test-user-id",
  "email": "test@example.com",
  "role": "authenticated",
  "aud": "authenticated",
  "exp": 9999999999,
  "iat": 1698765432
}
```

**Secret:** Your `SUPABASE_JWT_SECRET` value

---

## Testing Checklist

- [ ] Health endpoint returns 200
- [ ] Health endpoint includes rate limit headers
- [ ] Public status endpoint returns 200
- [ ] Missing auth token returns 401
- [ ] Invalid auth token returns 401
- [ ] Valid auth token returns 200 with user data
- [ ] Rate limiting blocks after threshold
- [ ] Rate limiting includes Retry-After header
- [ ] CORS preflight returns 204
- [ ] CORS headers present on all responses
- [ ] 404 for non-existent endpoints
- [ ] All error responses follow consistent format

---

## Integration Testing

### Prerequisites

1. Supabase project running
2. KV namespaces created
3. Environment variables set

### Setup

```bash
# Set up KV namespaces
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
wrangler kv:namespace create "CACHE_KV" --preview

# Update wrangler.toml with namespace IDs

# Set secrets (development)
wrangler secret put SUPABASE_JWT_SECRET
wrangler secret put CLAUDE_API_KEY
wrangler secret put FIRECRAWL_API_KEY
```

### Run Integration Tests

```bash
# Start dev server
pnpm dev

# In another terminal, run test scripts
./test-integration.sh
```

---

## Debugging Tips

### Enable Verbose Logging

In `wrangler.toml`, add:

```toml
[env.development]
vars = { LOG_LEVEL = "debug" }
```

### View Worker Logs

```bash
wrangler tail
```

### Check KV Storage

```bash
# List keys
wrangler kv:key list --binding=RATE_LIMIT_KV

# Get specific key
wrangler kv:key get "ratelimit:user:123" --binding=RATE_LIMIT_KV

# Delete key (reset rate limit)
wrangler kv:key delete "ratelimit:user:123" --binding=RATE_LIMIT_KV
```

---

## Common Issues

### Issue: "KVNamespace not found"

**Solution:** Create KV namespaces and update `wrangler.toml`

```bash
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "CACHE_KV"
```

### Issue: "JWT validation fails"

**Solution:** Check `SUPABASE_JWT_SECRET` matches your Supabase project

```bash
# Get JWT secret from Supabase dashboard
# Settings > API > JWT Secret

# Set in wrangler
wrangler secret put SUPABASE_JWT_SECRET
```

### Issue: "CORS errors in browser"

**Solution:** Check `FRONTEND_URL` matches your frontend origin

```bash
wrangler secret put FRONTEND_URL
# Enter: http://localhost:3000
```

---

---

## FireCrawl Integration Testing

### Test 9: SSRF Protection - Block Localhost

```bash
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "url": "http://localhost:8080/"
  }'
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "URL validation failed: Cannot scrape localhost"
}
```

### Test 10: SSRF Protection - Block Private IP

```bash
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "url": "http://192.168.1.1/admin"
  }'
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "URL validation failed: Cannot scrape private IP addresses"
}
```

### Test 11: SSRF Protection - Block AWS Metadata

```bash
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "url": "http://169.254.169.254/latest/meta-data/"
  }'
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "URL validation failed: Cannot scrape private IP addresses"
}
```

### Test 12: Scrape Known Service (First Request - Not Cached)

```bash
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type": application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "service": "stripe"
  }'
```

**Expected Response (200):**
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

**Performance:** 2-5 seconds (scraping 3 URLs)

### Test 13: Scrape Known Service (Second Request - Cached)

```bash
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "service": "stripe"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "markdown": "# stripe Documentation\n\n## Pricing\n...",
    "cached": true,
    "scrapedAt": "2025-11-02T10:30:00Z"
  }
}
```

**Performance:** <100ms (KV cache hit)

### Test 14: Scrape Single URL

```bash
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "url": "https://stripe.com/docs/api"
  }'
```

### Test 15: Force Refresh (Bypass Cache)

```bash
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "service": "stripe",
    "forceRefresh": true
  }'
```

**Expected:** Fresh scrape even if cached, updates cache

### Test 16: Rate Limiting (Scrape Endpoint)

The scrape endpoint has a limit of 1 request per 30 seconds per user.

```bash
# First request - should succeed
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"service":"stripe"}'

# Immediate second request - should fail with 429
curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"service":"openai"}'
```

**Expected Response (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait 30 seconds between scrape requests."
}
```

**Headers:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/json
```

### FireCrawl Performance Testing

```bash
# Test cache performance
time curl -X POST http://localhost:8787/api/v1/scrape \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"service":"stripe"}' \
  -w "\nTime: %{time_total}s\n"

# First request: Time: 3.245s (scraping)
# Second request: Time: 0.045s (cached)
```

---

## FireCrawl Testing Checklist

- [ ] URL validator blocks localhost
- [ ] URL validator blocks private IPs (10.x, 192.168.x, 172.16-31.x)
- [ ] URL validator blocks link-local IPs (169.254.x)
- [ ] URL validator blocks AWS/GCP metadata endpoints
- [ ] URL validator blocks non-HTTP protocols (file://, ftp://)
- [ ] URL validator allows valid public URLs
- [ ] FireCrawl client can scrape public URL
- [ ] Cache stores scraped data correctly
- [ ] Cache retrieves data correctly
- [ ] Cache returns instantly on hit (<100ms)
- [ ] Rate limiting works (1 req/30s per user)
- [ ] Scrape endpoint returns valid response
- [ ] Service scraping works for known services
- [ ] Single URL scraping works
- [ ] Force refresh bypasses cache
- [ ] Error handling works for invalid URLs
- [ ] Error handling works for FireCrawl failures
- [ ] Fallback to cache works when FireCrawl fails

---

## Next Steps

Once all tests pass, you can:

1. Integrate with Claude API (AI Team) ✅
2. Integrate with FireCrawl (Integration Team) ✅ COMPLETED
3. Add database operations (Database Team)
4. Deploy to staging
5. Set up monitoring
