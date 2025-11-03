# Quick Integration Guide for Teams

**For:** AI Integration Team, Database Team, Frontend Team
**Status:** Infrastructure Ready - Start Integrating Now

---

## Quick Start

### For AI Integration Team (Claude API)

**Goal:** Implement AI chat endpoint

**What's Ready:**
- Authentication middleware (user context available)
- Rate limiting (10 requests/min for AI chat)
- Error handling framework
- CORS headers

**Your Task:**

1. Create `/src/services/claude.ts`:
```typescript
import { Env } from '../types/api';

export function createClaudeClient(apiKey: string) {
  return {
    async chat(messages: any[], options?: any) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      return await response.json();
    },
  };
}
```

2. Create `/src/handlers/ai-chat.ts`:
```typescript
import { AppContext } from '../types/api';
import { createSuccessResponse, ApiError, ErrorCode } from '../middleware/error-handler';
import { createClaudeClient } from '../services/claude';

export async function handleAiChat(c: AppContext) {
  const user = c.get('user');
  const { messages, stream = false } = await c.req.json();

  const client = createClaudeClient(c.env.CLAUDE_API_KEY);

  try {
    const response = await client.chat(messages, {
      max_tokens: 1024,
      stream,
    });

    return c.json(createSuccessResponse({
      response: response.content[0].text,
      usage: response.usage,
    }));
  } catch (error) {
    throw new ApiError(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Failed to communicate with AI service'
    );
  }
}
```

3. Update route in `/src/index.ts`:
```typescript
import { handleAiChat } from './handlers/ai-chat';

// Replace this line:
api.post('/ai/chat', authMiddleware, aiChatRateLimiter, async (c) => {
  // ... placeholder
});

// With this:
api.post('/ai/chat', authMiddleware, aiChatRateLimiter, handleAiChat);
```

**Test:**
```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

---

## For Database Team (Supabase Integration)

**Goal:** Implement CRUD operations for secrets, projects, environments

**What's Ready:**
- User context from JWT (id, email, organizationId)
- Rate limiting for read/write operations
- Error handling framework

**Your Task:**

1. Create `/src/services/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import { Env } from '../types/api';

export function createSupabaseClient(env: Env, userToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });
}
```

2. Update placeholder routes:
```typescript
import { createSupabaseClient } from './services/supabase';
import { ApiError, ErrorCode } from './middleware/error-handler';

// Get secrets
api.get('/secrets', authMiddleware, readRateLimiter, async (c) => {
  const user = c.get('user');
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  const supabase = createSupabaseClient(c.env, token!);

  const { data, error } = await supabase
    .from('secrets_metadata')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, error.message);
  }

  return c.json(createSuccessResponse(data));
});

// Create secret
api.post('/secrets', authMiddleware, writeRateLimiter, async (c) => {
  const user = c.get('user');
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const body = await c.req.json();

  const supabase = createSupabaseClient(c.env, token!);

  const { data, error } = await supabase
    .from('secrets_metadata')
    .insert({
      ...body,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, error.message);
  }

  return c.json(createSuccessResponse(data), 201 as any);
});
```

**Install Supabase client:**
```bash
cd workers
pnpm add @supabase/supabase-js
```

**Test:**
```bash
# List secrets
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8787/api/v1/secrets

# Create secret
curl -X POST http://localhost:8787/api/v1/secrets \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DATABASE_URL",
    "project_id": "...",
    "environment_id": "..."
  }'
```

---

## For Frontend Team (Next.js Integration)

**Goal:** Connect frontend to Workers API

**What's Ready:**
- All CORS headers configured
- Rate limit headers in responses
- Consistent error format

**Your Task:**

1. Create `/lib/api/client.ts`:
```typescript
export class ApiClient {
  constructor(private baseUrl: string) {}

  async fetch(path: string, options: RequestInit = {}) {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limited. Retry after ${retryAfter}s`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error.message);
    }

    return data.data;
  }

  private async getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  // Convenience methods
  async get(path: string) {
    return this.fetch(path, { method: 'GET' });
  }

  async post(path: string, body: any) {
    return this.fetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put(path: string, body: any) {
    return this.fetch(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete(path: string) {
    return this.fetch(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
);
```

2. Create API hooks:
```typescript
// lib/hooks/use-secrets.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export function useSecrets() {
  return useQuery({
    queryKey: ['secrets'],
    queryFn: () => apiClient.get('/api/v1/secrets'),
  });
}

export function useCreateSecret() {
  return useMutation({
    mutationFn: (data: any) => apiClient.post('/api/v1/secrets', data),
  });
}
```

3. Use in components:
```typescript
'use client';

import { useSecrets, useCreateSecret } from '@/lib/hooks/use-secrets';

export function SecretsList() {
  const { data: secrets, isLoading, error } = useSecrets();
  const createSecret = useCreateSecret();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {secrets.map((secret) => (
        <div key={secret.id}>{secret.name}</div>
      ))}
    </div>
  );
}
```

**Environment Variables:**
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8787
```

---

## Error Handling Reference

All API responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-11-02T..."
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "statusCode": 400,
    "details": { }
  },
  "meta": {
    "timestamp": "2024-11-02T..."
  }
}
```

**Error Codes:**
- `UNAUTHORIZED` (401) - Missing or invalid auth token
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `VALIDATION_ERROR` (400) - Invalid input
- `NOT_FOUND` (404) - Resource not found
- `INTERNAL_ERROR` (500) - Server error

---

## Rate Limiting Reference

| Endpoint | Limit | Window |
|----------|-------|--------|
| AI Chat | 10/min | 60s |
| Documentation Scrape | 5/min | 60s |
| Write Operations | 30/min | 60s |
| Read Operations | 100/min | 60s |

**Headers in Every Response:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1698765432000
```

**On Rate Limit Exceeded (429):**
```
Retry-After: 42
```

**Handle in Frontend:**
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  // Show UI: "Please wait {retryAfter} seconds"
}
```

---

## Available Context in Handlers

**User Context (from auth middleware):**
```typescript
const user = c.get('user');
// {
//   id: "user-uuid",
//   email: "user@example.com",
//   role: "authenticated",
//   organizationId: "org-uuid"
// }
```

**Environment Variables:**
```typescript
c.env.SUPABASE_URL
c.env.SUPABASE_ANON_KEY
c.env.SUPABASE_JWT_SECRET
c.env.CLAUDE_API_KEY
c.env.FIRECRAWL_API_KEY
c.env.FRONTEND_URL
```

**KV Storage:**
```typescript
c.env.RATE_LIMIT_KV  // For rate limiting
c.env.CACHE_KV       // For caching
```

---

## Testing Your Integration

### 1. Test Locally

```bash
# Start workers dev server
cd workers
pnpm dev

# In another terminal, test your endpoint
curl -X POST http://localhost:8787/api/v1/your-endpoint \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 2. Check Logs

```bash
# View real-time logs
wrangler tail
```

### 3. Verify Rate Limiting

```bash
# Make multiple requests
for i in {1..15}; do
  curl http://localhost:8787/api/v1/your-endpoint
done
```

### 4. Test Error Handling

```bash
# Test without auth (should get 401)
curl http://localhost:8787/api/v1/your-endpoint

# Test with invalid token (should get 401)
curl -H "Authorization: Bearer invalid" \
  http://localhost:8787/api/v1/your-endpoint
```

---

## Common Issues & Solutions

### Issue: "KVNamespace not found"

**Solution:**
```bash
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "CACHE_KV"
# Update wrangler.toml with IDs
```

### Issue: "CORS error in browser"

**Solution:** Check `FRONTEND_URL` matches your frontend origin

```bash
wrangler secret put FRONTEND_URL
# Enter: http://localhost:3000
```

### Issue: "JWT validation fails"

**Solution:** Get JWT secret from Supabase dashboard

```bash
# Supabase Dashboard > Settings > API > JWT Secret
wrangler secret put SUPABASE_JWT_SECRET
```

### Issue: "Rate limiting not working"

**Solution:** Verify KV namespace binding

```typescript
// In handler:
console.log('KV available?', !!c.env.RATE_LIMIT_KV);
```

---

## Help & Support

**Documentation:**
- `/workers/README.md` - Complete API documentation
- `/workers/TESTING.md` - Testing guide
- `/workers/IMPLEMENTATION-SUMMARY.md` - Technical details

**Files to Reference:**
- `/workers/src/types/api.ts` - All TypeScript types
- `/workers/src/middleware/` - Middleware examples
- `/workers/src/lib/` - Utility functions

**Need Help?**
- Check existing handlers in `/workers/src/handlers/`
- Review middleware in `/workers/src/middleware/`
- See FireCrawl integration for real-world example

---

**You're ready to start integrating! The infrastructure is solid and waiting for your code.**
