# Workstream 5: Claude API Integration - Implementation Summary

**Team:** AI Integration Team Lead
**Status:** ✅ COMPLETE
**Date:** 2025-11-02

---

## Overview

Successfully implemented a complete Claude API integration for the Abyrith AI Secret Assistant, including conversation management, streaming responses, token tracking, and cost calculation.

---

## Deliverables

### 1. Services Created

#### **`workers/src/services/claude.ts`** - Claude API Client
- ✅ Anthropic API client with authentication
- ✅ Support for Claude 3.5 Sonnet and Haiku models
- ✅ Automatic model selection based on query complexity
- ✅ Error handling with exponential backoff retries
- ✅ Support for streaming and non-streaming responses
- ✅ Rate limit handling (429) and overload handling (529)

**Key Functions:**
- `selectClaudeModel()` - Intelligent model selection
- `callClaude()` - Non-streaming API calls with retry logic
- `callClaudeStream()` - Streaming API calls
- `buildClaudeRequest()` - Request builder
- `extractTextContent()` - Parse response content

#### **`workers/src/services/prompts.ts`** - Prompt Engineering
- ✅ Base system prompt for AI Secret Assistant persona
- ✅ Context-aware prompt building (project, organization, secrets)
- ✅ Query classification (simple, complex, research-needed)
- ✅ Service name extraction from user messages

**Key Features:**
- Security-focused instructions (zero-knowledge architecture)
- Educational and beginner-friendly tone
- Cost-awareness prompts
- Context injection from conversation metadata

#### **`workers/src/services/conversation.ts`** - Conversation Management
- ✅ Create and retrieve conversations
- ✅ Message persistence to Supabase
- ✅ Conversation history retrieval (last 10 messages)
- ✅ Automatic title generation from first message
- ✅ Context building from database records
- ✅ Message format conversion (DB ↔ Claude API)

**Database Operations:**
- `createConversation()` - New conversation with context
- `getConversation()` - Retrieve conversation by ID
- `getRecentMessages()` - Get last N messages
- `saveUserMessage()` - Persist user message
- `saveAssistantMessage()` - Persist AI response with usage tracking
- `updateConversationTitle()` - Update conversation title

### 2. Utilities Created

#### **`workers/src/lib/token-tracker.ts`** - Token Usage Tracking
- ✅ Cost calculation based on Claude pricing
- ✅ Token counting (input + output)
- ✅ Cost formatting ($0.000675 → "$0.000675")
- ✅ Token estimation for text
- ✅ Budget threshold checking

**Pricing (per 1M tokens):**
- Haiku: $0.25 input, $1.25 output
- Sonnet: $3.00 input, $15.00 output

#### **`workers/src/lib/streaming.ts`** - SSE Streaming Handler
- ✅ Server-Sent Events (SSE) implementation
- ✅ Transform Claude streaming to SSE format
- ✅ Message types: start, chunk, complete, error
- ✅ Graceful error handling
- ✅ Fallback to non-streaming on failure

**SSE Message Format:**
```json
data: {"type":"start","conversationId":"uuid-123"}
data: {"type":"chunk","content":"Hello "}
data: {"type":"chunk","content":"world!"}
data: {"type":"complete","usage":{"input_tokens":10,"output_tokens":5},"cost":0.000025}
```

### 3. Handlers Created

#### **`workers/src/handlers/ai-chat.ts`** - Chat Endpoint
- ✅ POST `/api/v1/ai/chat` endpoint
- ✅ Request validation (message length, format)
- ✅ Conversation creation or retrieval
- ✅ Message persistence
- ✅ Streaming and non-streaming support
- ✅ Automatic title generation
- ✅ Context injection
- ✅ Error handling with SSE

**Request Format:**
```typescript
POST /api/v1/ai/chat
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "message": "I need an OpenAI API key",
  "conversationId": "uuid-456",  // Optional
  "context": {                   // Optional
    "projectName": "RecipeApp",
    "existingSecrets": [...]
  },
  "stream": true                 // Default: true
}
```

**Response Format (SSE):**
```
Content-Type: text/event-stream

data: {"type":"start","conversationId":"uuid-456"}

data: {"type":"chunk","content":"I can help..."}

data: {"type":"complete","usage":{...},"cost":0.001}
```

### 4. Type Definitions

#### **`workers/src/types/claude.ts`** - Claude API Types
- ✅ `ClaudeModel` - Model type aliases
- ✅ `ClaudeMessage` - Message format
- ✅ `ClaudeRequest` - API request
- ✅ `ClaudeResponse` - API response
- ✅ `ClaudeUsage` - Token usage
- ✅ `StreamEvent` - Streaming event types
- ✅ `MODEL_PRICING` - Pricing table

---

## Integration Points

### Router Integration
**File:** `workers/src/index.ts`

```typescript
import { handleAiChat } from './handlers/ai-chat';

// AI Chat endpoints (10 req/min rate limit)
api.post('/api/v1/ai/chat', authMiddleware, aiChatRateLimiter, handleAiChat);
```

### Database Integration
**Tables Used:**
- `conversations` - Top-level conversation records
- `messages` - Individual messages with token/cost tracking

**Schema:**
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  title TEXT,
  context JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role message_role ('user' | 'assistant' | 'system'),
  content TEXT,
  metadata JSONB, -- {model, tokens_input, tokens_output, cost_usd}
  created_at TIMESTAMPTZ
);
```

### Middleware Integration
- **Auth:** `authMiddleware` - JWT validation, user context
- **Rate Limiting:** `aiChatRateLimiter` - 10 requests/min per user
- **Error Handling:** `errorHandler` - Unified error responses

---

## Model Selection Strategy

### Automatic Selection Logic

```typescript
function selectClaudeModel(message: string, conversationLength: number) {
  // Simple FAQ (< 100 chars, basic questions) → Haiku
  if (isSimpleQuery(message)) {
    return 'claude-3-5-haiku-20241022'; // Fast, cheap
  }

  // Acquisition flows, comparisons → Sonnet
  if (needsComplexReasoning(message)) {
    return 'claude-3-5-sonnet-20241022'; // Balanced
  }

  // Long conversations (> 10 messages) → Sonnet
  if (conversationLength > 10) {
    return 'claude-3-5-sonnet-20241022'; // Consistency
  }

  // Default → Haiku (cost optimization)
  return 'claude-3-5-haiku-20241022';
}
```

### Model Characteristics

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| **Haiku** | ~1s | $0.25/$1.25 per 1M tokens | Simple Q&A, definitions |
| **Sonnet** | ~3-5s | $3.00/$15.00 per 1M tokens | Acquisition flows, comparisons |

---

## Streaming Strategy

### SSE (Server-Sent Events)

**Why SSE over WebSockets:**
- ✅ Simpler implementation (HTTP-based)
- ✅ Automatic reconnection
- ✅ Works with existing auth (JWT in headers)
- ✅ Better for one-way streaming
- ✅ Cloudflare Workers native support

**Flow:**
1. Client sends POST request with message
2. Server creates conversation/message
3. Server calls Claude API with streaming enabled
4. Server transforms Claude stream to SSE format
5. Client receives chunks in real-time
6. Server sends completion message with usage/cost
7. Server saves assistant message to database

**Fallback:**
- If streaming fails → automatic fallback to non-streaming
- Client receives complete response as single SSE chunk
- Transparent to user experience

---

## Token Tracking & Cost Management

### Per-Message Tracking

Every assistant message stores:
- `tokens_input` - Input tokens (user message + context)
- `tokens_output` - Output tokens (AI response)
- `cost_usd` - Calculated cost
- `model` - Which Claude model was used

### Cost Calculation

```typescript
function calculateCost(model: ClaudeModel, usage: ClaudeUsage): number {
  const pricing = MODEL_PRICING[model];

  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
```

### Example Costs

**Haiku:**
- 1,000 input + 500 output tokens = $0.000875
- Typical conversation (10 messages) = $0.005 - $0.01

**Sonnet:**
- 1,000 input + 500 output tokens = $0.0105
- Typical conversation (10 messages) = $0.05 - $0.10

---

## Error Handling

### Retry Strategy

**429 Rate Limit:**
- Read `Retry-After` header
- Wait specified seconds
- Retry up to 3 times

**529 Overloaded:**
- Exponential backoff: 2^attempt seconds
- Retry up to 3 times

**Network Errors:**
- Exponential backoff: 2^attempt seconds
- Retry up to 3 times

**Non-Retriable Errors:**
- 400, 401, 403 → Immediate failure
- Return error to user

### Error Responses

**Streaming (SSE):**
```json
data: {"type":"error","error":"Claude API unavailable. Please try again."}
```

**Non-Streaming (JSON):**
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Claude API unavailable. Please try again.",
    "statusCode": 503
  }
}
```

---

## Testing Endpoints

### 1. Health Check
```bash
curl http://localhost:8787/health
```

### 2. Create Conversation (First Message)
```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is an API key?",
    "stream": false
  }'
```

### 3. Continue Conversation
```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I get an OpenAI API key?",
    "conversationId": "uuid-from-previous-response",
    "stream": true
  }'
```

### 4. With Project Context
```bash
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need an API key",
    "context": {
      "projectName": "RecipeApp",
      "projectId": "uuid-123"
    }
  }'
```

---

## Environment Variables

Required in `.dev.vars` or Cloudflare Workers secrets:

```bash
CLAUDE_API_KEY=sk-ant-api03-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
```

---

## Frontend Integration (for Workstream 6)

### Client-Side Code

```typescript
// Send message with streaming
const eventSource = new EventSource('/api/v1/ai/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "I need an OpenAI API key",
    conversationId: currentConversationId
  })
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'start':
      setConversationId(data.conversationId);
      break;

    case 'chunk':
      appendToResponse(data.content);
      break;

    case 'complete':
      console.log('Usage:', data.usage);
      console.log('Cost:', data.cost);
      eventSource.close();
      break;

    case 'error':
      showError(data.error);
      eventSource.close();
      break;
  }
};
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

export function useAiChat(conversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (content: string) => {
    setIsStreaming(true);

    // Add user message to UI
    const userMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);

    // Start streaming assistant response
    let assistantContent = '';

    const response = await fetch('/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getJWT()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: content,
        conversationId
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'chunk') {
            assistantContent += data.content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { role: 'assistant', content: assistantContent }];
              }
              return [...prev, { role: 'assistant', content: assistantContent }];
            });
          }
        }
      }
    }

    setIsStreaming(false);
  };

  return { messages, sendMessage, isStreaming };
}
```

---

## Success Criteria

- [x] Can send message to Claude API and get response
- [x] Conversations persist in database
- [x] Message history retrieved correctly
- [x] Token usage tracked per conversation
- [x] Streaming responses work with SSE
- [x] Error handling with retries (429, 500, 503)
- [x] Rate limiting enforced (10/min)
- [x] Costs calculated correctly

---

## Next Steps for Workstream 6 (Frontend Team)

### What You Need to Build:

1. **Chat UI Components:**
   - ChatInterface.tsx
   - ChatMessage.tsx
   - ChatInput.tsx
   - TypingIndicator.tsx

2. **SSE Client:**
   - Parse Server-Sent Events
   - Handle streaming chunks
   - Reconnection logic

3. **State Management:**
   - Zustand store for active conversation
   - React Query for conversation history
   - Message optimistic updates

4. **API Client:**
   - Wrapper for `/api/v1/ai/chat`
   - Authentication header injection
   - Error handling

### Integration Points:

- **Endpoint:** `POST /api/v1/ai/chat`
- **Auth:** Include JWT in `Authorization: Bearer <token>` header
- **Request:** Send `{message, conversationId?, context?}`
- **Response:** Parse SSE stream (`data: {...}`)

---

## Files Created

```
workers/src/
├── types/
│   └── claude.ts                    # Claude API type definitions
├── services/
│   ├── claude.ts                    # Claude API client
│   ├── prompts.ts                   # Prompt engineering
│   └── conversation.ts              # Conversation management
├── lib/
│   ├── token-tracker.ts             # Token usage & cost tracking
│   └── streaming.ts                 # SSE streaming handler
├── handlers/
│   └── ai-chat.ts                   # Chat endpoint handler
└── index.ts                         # Router (updated)
```

---

## Documentation References

- **Feature Spec:** `/Users/james/code/secrets/08-features/ai-assistant/ai-assistant-overview.md`
- **Implementation Plan:** `/Users/james/code/secrets/IMPLEMENTATION-PLAN.md`
- **Anthropic Docs:** https://docs.anthropic.com/claude/reference/messages_post
- **Database Schema:** `supabase/migrations/20241102000001_initial_schema.sql`

---

## Cost Estimates

**Development/Testing (100 messages/day):**
- Haiku: $0.10 - $0.25/day
- Sonnet: $1.00 - $2.00/day

**Production (1,000 users, 10 messages/user/month):**
- 10,000 messages/month
- 80% Haiku, 20% Sonnet
- Estimated: $50 - $100/month

**Optimization Strategies:**
- Use Haiku for simple queries (80%+ of traffic)
- Cache common responses
- Implement rate limiting
- Monitor usage patterns

---

## Contact & Support

**Team Lead:** AI Integration Team
**Workstream:** 5 - Claude API Integration
**Status:** ✅ COMPLETE
**Handoff To:** Workstream 6 (Frontend Team)

**Questions?** Review this document and the feature spec at `/Users/james/code/secrets/08-features/ai-assistant/ai-assistant-overview.md`
