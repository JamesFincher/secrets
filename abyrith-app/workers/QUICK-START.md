# Claude API Integration - Quick Start

Get the AI chat endpoint running in 5 minutes.

---

## 1. Install Dependencies

```bash
cd /Users/james/code/secrets/abyrith-app/workers
pnpm install
```

---

## 2. Configure Environment

Create `.dev.vars` file:

```bash
# .dev.vars
CLAUDE_API_KEY=sk-ant-api03-YOUR-KEY-HERE
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_JWT_SECRET=your-jwt-secret
ENVIRONMENT=development
```

**Get your Claude API key:**
1. Go to https://console.anthropic.com/
2. Create account or sign in
3. Go to API Keys
4. Create new key
5. Copy and paste into `.dev.vars`

---

## 3. Run Migrations

Make sure Supabase database has the required tables:

```bash
# In Supabase dashboard, run:
# - 20241102000001_initial_schema.sql
# - 20241102000002_rls_policies.sql (optional for dev)

# Or using CLI:
supabase db push
```

---

## 4. Start Dev Server

```bash
pnpm dev
```

**Expected output:**
```
⛅️ wrangler 3.x.x
-------------------
[wrangler:inf] Ready on http://localhost:8787
```

---

## 5. Test the Endpoint

**Get a test JWT token:**

Option A - Use Supabase Auth UI:
```
http://localhost:54321/auth/v1/signup
```

Option B - Generate test token in Supabase Studio:
```
SQL Editor → New Query:
SELECT * FROM auth.users;
-- Use user ID to generate JWT
```

**Send a test message:**

```bash
export JWT="your-jwt-token-here"

curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is an API key?",
    "stream": false
  }'
```

**Expected response:**
```
data: {"type":"start","conversationId":"..."}
data: {"type":"chunk","content":"An API key is..."}
data: {"type":"complete","usage":{...},"cost":0.000065}
```

---

## 6. Verify Database

**Check conversation created:**

```sql
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 1;
```

**Check message saved:**

```sql
SELECT
  role,
  content,
  metadata
FROM messages
ORDER BY created_at DESC
LIMIT 2;
```

---

## ✅ Success!

You now have:
- ✅ Claude API integration working
- ✅ Streaming responses via SSE
- ✅ Conversation persistence
- ✅ Token usage tracking
- ✅ Cost calculation

---

## Next Steps

1. **Read full documentation:**
   - `WORKSTREAM-5-SUMMARY.md` - Complete implementation details
   - `TESTING-GUIDE.md` - Comprehensive test cases

2. **Test more scenarios:**
   - Long conversations
   - Project context
   - Rate limiting
   - Error handling

3. **Frontend integration (Workstream 6):**
   - Build chat UI
   - Implement SSE client
   - Display streaming responses

---

## Common Issues

**"CLAUDE_API_KEY not configured"**
→ Add to `.dev.vars` and restart server

**"Failed to create conversation: ... organization_id"**
→ Create organization for test user in database

**401 Unauthorized**
→ Check JWT token is valid and not expired

**No streaming output**
→ Use `curl -N` flag or check browser SSE support

---

## Support

- Implementation summary: `WORKSTREAM-5-SUMMARY.md`
- Testing guide: `TESTING-GUIDE.md`
- Feature spec: `/Users/james/code/secrets/08-features/ai-assistant/`
- Overall plan: `/Users/james/code/secrets/IMPLEMENTATION-PLAN.md`
