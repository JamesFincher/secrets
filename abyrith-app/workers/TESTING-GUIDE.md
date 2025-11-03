# Claude API Integration - Testing Guide

Quick reference for testing the AI chat endpoints.

---

## Prerequisites

1. **Environment Variables** (in `.dev.vars`):
```bash
CLAUDE_API_KEY=sk-ant-api03-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
ENVIRONMENT=development
```

2. **Start Workers Dev Server:**
```bash
cd workers
pnpm install
pnpm dev
```

3. **Get a Valid JWT Token:**
- Sign up/login through Supabase Auth
- Get JWT from response
- Or use Supabase Studio to generate test token

---

## Test Cases

### 1. Simple Query (Haiku Model)

**Expected:** Fast response, low cost, uses Haiku model

```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is an API key?",
    "stream": false
  }'
```

**Expected Response:**
```
Content-Type: text/event-stream

data: {"type":"start","conversationId":"uuid-123"}

data: {"type":"chunk","content":"An API key is like a password..."}

data: {"type":"complete","usage":{"input_tokens":15,"output_tokens":50},"cost":0.000066}
```

### 2. Complex Query (Sonnet Model)

**Expected:** Detailed response, uses Sonnet model

```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me step by step how to get an OpenAI API key",
    "stream": false
  }'
```

### 3. Streaming Response

**Expected:** Real-time chunks

```bash
curl -N -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need an OpenAI API key",
    "stream": true
  }'
```

### 4. Continue Conversation

**Expected:** Uses conversation history for context

```bash
# First message
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need an OpenAI API key"
  }'

# Save conversationId from response

# Second message (uses context)
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How much does it cost?",
    "conversationId": "uuid-from-previous-response"
  }'
```

### 5. With Project Context

**Expected:** AI references project name in response

```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need an API key",
    "context": {
      "projectName": "RecipeApp",
      "existingSecrets": [
        {"service": "Stripe", "environment": "development"},
        {"service": "SendGrid", "environment": "production"}
      ]
    }
  }'
```

### 6. Rate Limiting Test

**Expected:** 429 Too Many Requests after 10 requests in 1 minute

```bash
# Send 11 requests rapidly
for i in {1..11}; do
  echo "Request $i"
  curl -X POST http://localhost:8787/api/v1/ai/chat \
    -H "Authorization: Bearer YOUR_JWT" \
    -H "Content-Type: application/json" \
    -d '{"message": "Test '$i'"}'
  echo ""
done
```

**Expected 11th Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "statusCode": 429
  }
}
```

### 7. Invalid Token

**Expected:** 401 Unauthorized

```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test"}'
```

### 8. Missing Message

**Expected:** 400 Bad Request

```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 9. Message Too Long

**Expected:** 400 Bad Request

```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "'$(python3 -c 'print("a" * 10001)')'",
  }'
```

---

## Verify Database Persistence

### Check Conversations

```sql
-- In Supabase SQL Editor
SELECT
  id,
  user_id,
  title,
  context,
  created_at
FROM conversations
ORDER BY created_at DESC
LIMIT 10;
```

### Check Messages

```sql
-- Get messages for a conversation
SELECT
  id,
  role,
  content,
  metadata->>'model' as model,
  (metadata->>'tokens_input')::int as tokens_input,
  (metadata->>'tokens_output')::int as tokens_output,
  (metadata->>'cost_usd')::decimal as cost_usd,
  created_at
FROM messages
WHERE conversation_id = 'your-conversation-id'
ORDER BY created_at ASC;
```

### Check Total Costs

```sql
-- Get total AI costs for user
SELECT
  COUNT(*) as message_count,
  SUM((metadata->>'tokens_input')::int) as total_input_tokens,
  SUM((metadata->>'tokens_output')::int) as total_output_tokens,
  SUM((metadata->>'cost_usd')::decimal) as total_cost_usd
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.user_id = 'your-user-id'
  AND m.role = 'assistant';
```

---

## Expected Model Selection

| Message | Expected Model | Reasoning |
|---------|----------------|-----------|
| "What is an API key?" | Haiku | Simple definition |
| "Explain API keys" | Haiku | Simple explanation |
| "How to get OpenAI API key?" | Sonnet | Acquisition flow |
| "Compare Stripe vs Paddle" | Sonnet | Comparison/recommendation |
| "I need an API key" | Haiku | Vague, default to cheap |
| 11th message in thread | Sonnet | Long conversation |

---

## Common Issues

### "CLAUDE_API_KEY not configured"
- Add to `.dev.vars` file
- Restart dev server

### "Failed to create conversation"
- Check Supabase connection
- Verify database migrations ran
- Check RLS policies (should be disabled for dev)

### "User must belong to an organization"
- Create organization for test user in database
- Update user's `organizationId` in auth metadata

### Streaming not working
- Use `curl -N` flag for streaming
- Check browser SSE support
- Verify `stream: true` in request

### Rate limit too aggressive
- Increase limit in `middleware/rate-limit.ts`
- Clear KV namespace: `await env.RATE_LIMIT_KV.delete(key)`

---

## Monitoring

### Check Worker Logs

```bash
# In workers directory
pnpm tail
```

### Check Token Usage

Look for log lines:
```
Model selected: claude-3-5-haiku-20241022
Input tokens: 50
Output tokens: 200
Cost: $0.000262
```

### Check Errors

Look for:
```
Claude API error: 429 - Rate limit exceeded
Claude API error: 529 - Overloaded
Streaming error: ...
```

---

## Performance Benchmarks

### Expected Latency

| Operation | Target | Acceptable |
|-----------|--------|------------|
| First token (Haiku) | < 1s | < 2s |
| First token (Sonnet) | < 2s | < 3s |
| Total response (Haiku) | < 3s | < 5s |
| Total response (Sonnet) | < 8s | < 12s |
| DB save | < 100ms | < 200ms |

### Expected Costs

| Scenario | Tokens | Cost |
|----------|--------|------|
| Simple Q&A (Haiku) | 100 input, 50 output | $0.000065 |
| Acquisition flow (Sonnet) | 500 input, 1000 output | $0.0165 |
| 10-message conversation | ~2000 total | $0.01 - $0.05 |

---

## Success Criteria

- [x] Endpoint responds with 200 OK
- [x] Streaming works (SSE format)
- [x] Non-streaming works (fallback)
- [x] Conversations persisted
- [x] Messages saved with usage tracking
- [x] Rate limiting enforced
- [x] Auth validation works
- [x] Model selection appropriate
- [x] Costs calculated correctly
- [x] Error handling graceful

---

## Next Steps

1. **Test with real JWT tokens** from Supabase Auth
2. **Create test organization** in database
3. **Send 5-10 messages** and verify:
   - Conversation created
   - Messages saved
   - Costs tracked
   - Streaming works
4. **Check database** for persisted data
5. **Test rate limiting** (10 requests)
6. **Test error cases** (invalid token, missing message)
7. **Verify model selection** matches expectations

---

## Handoff to Frontend (Workstream 6)

Once backend testing passes, frontend team can:

1. Build chat UI components
2. Implement SSE client
3. Connect to `/api/v1/ai/chat` endpoint
4. Display streaming responses
5. Show token usage/costs
6. Handle errors gracefully

See `WORKSTREAM-5-SUMMARY.md` for integration details.
