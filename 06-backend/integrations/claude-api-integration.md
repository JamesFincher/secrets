---
Document: Claude API Integration Guide
Version: 1.0.0
Last Updated: 2025-10-30
Owner: AI Team
Status: Draft
Dependencies: TECH-STACK.md, 08-features/ai-assistant/ai-assistant-overview.md, 06-backend/cloudflare-workers/workers-architecture.md, GLOSSARY.md
---

# Claude API Integration

## Overview

The Claude API integration powers Abyrith's AI Secret Assistant by providing conversational AI capabilities through Anthropic's Claude models. This integration handles natural language understanding, guided API key acquisition flow generation, cost estimation, and real-time documentation research to help users understand and obtain developer secrets.

**External Service:** Anthropic Claude API (https://www.anthropic.com)

**Integration Type:** REST API integration with streaming support

**Status:** Active - Critical MVP requirement

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Implementation Details](#implementation-details)
7. [Model Selection Logic](#model-selection-logic)
8. [Prompt Engineering](#prompt-engineering)
9. [Streaming Responses](#streaming-responses)
10. [Error Handling](#error-handling)
11. [Rate Limiting and Cost Management](#rate-limiting-and-cost-management)
12. [Token Usage Tracking](#token-usage-tracking)
13. [Testing](#testing)
14. [Monitoring](#monitoring)
15. [Security Considerations](#security-considerations)
16. [Cost & Rate Limits](#cost--rate-limits)
17. [Troubleshooting](#troubleshooting)
18. [Dependencies](#dependencies)
19. [References](#references)
20. [Change Log](#change-log)

---

## Integration Purpose

### Business Value

**What it enables:**
- AI-powered conversational interface for secrets management
- Automatic generation of step-by-step API key acquisition flows
- Real-time cost estimation and optimization suggestions
- Natural language understanding of user intent
- Comparative analysis of API services with pricing transparency
- Beginner-friendly educational guidance for developers

**User benefits:**
- **The Learner:** "5-year-old simple" explanations of API keys and services
- **Solo Developer:** Quick answers about unfamiliar APIs without leaving workflow
- **Development Team:** Consistent knowledge base for onboarding new members
- **Enterprise:** Standardized acquisition processes with audit trails

### Technical Purpose

**Responsibilities:**
- Process natural language queries about API keys and developer services
- Generate structured acquisition flows from scraped documentation
- Provide cost estimates and service comparisons
- Stream responses for real-time user interaction
- Track token usage for billing and optimization
- Select appropriate model based on query complexity

**Integration Points:**
- Cloudflare Workers (API orchestration and request proxying)
- Supabase (conversation history storage)
- FireCrawl (documentation research context)
- Frontend chat interface (streaming response display)

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────┐
│              User's Browser                           │
│  ┌────────────────────────────────────────────────┐  │
│  │         AI Chat Interface (React)              │  │
│  │  - Message input                               │  │
│  │  - Streaming response display                  │  │
│  │  - Code block rendering                        │  │
│  │  - Loading indicators                          │  │
│  └────────────────┬───────────────────────────────┘  │
└───────────────────┼──────────────────────────────────┘
                    │
                    │ HTTPS POST /api/v1/ai/chat
                    │ (JWT auth, message payload)
                    ▼
┌──────────────────────────────────────────────────────┐
│         Cloudflare Workers (API Gateway)             │
│  ┌────────────────────────────────────────────────┐  │
│  │  AI Conversation Handler                       │  │
│  │  1. Authenticate user (JWT validation)        │  │
│  │  2. Rate limit check (20/min for AI)          │  │
│  │  3. Retrieve conversation history (Supabase)  │  │
│  │  4. Detect research intent                    │  │
│  │  5. Trigger FireCrawl if needed               │  │
│  │  6. Select appropriate Claude model           │  │
│  │  7. Build context-aware prompt                │  │
│  │  8. Call Claude API (streaming)               │  │
│  │  9. Transform SSE stream                      │  │
│  │  10. Log usage and costs                      │  │
│  └────────────────┬───────────────────────────────┘  │
└───────────────────┼──────────────────────────────────┘
                    │
                    │ HTTPS POST
                    │ x-api-key: <CLAUDE_API_KEY>
                    ▼
┌──────────────────────────────────────────────────────┐
│         Anthropic Claude API                         │
│  ┌────────────────────────────────────────────────┐  │
│  │  Claude 3.5 Haiku                              │  │
│  │  - Fast responses (< 1s)                       │  │
│  │  - $0.25 per 1M input tokens                   │  │
│  │  - $1.25 per 1M output tokens                  │  │
│  │  - Use for: Simple Q&A, definitions            │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Claude 3.5 Sonnet                             │  │
│  │  - Balanced performance (~3-5s)                │  │
│  │  - $3.00 per 1M input tokens                   │  │
│  │  - $15.00 per 1M output tokens                 │  │
│  │  - Use for: Acquisition flows, comparisons     │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Claude 3.5 Sonnet (Extended Thinking)        │  │
│  │  - Deep reasoning (~10-20s)                    │  │
│  │  - Same pricing + thinking tokens              │  │
│  │  - Use for: Complex planning, optimization     │  │
│  └────────────────┬───────────────────────────────┘  │
└───────────────────┼──────────────────────────────────┘
                    │
                    │ Streaming response (SSE)
                    │ Content blocks + usage data
                    ▼
┌──────────────────────────────────────────────────────┐
│          Supabase PostgreSQL                         │
│  ┌────────────────────────────────────────────────┐  │
│  │  conversations table                           │  │
│  │  - id, user_id, project_id, title              │  │
│  │                                                 │  │
│  │  conversation_messages table                   │  │
│  │  - conversation_id, role, content              │  │
│  │  - model, tokens_input, tokens_output          │  │
│  │  - cost_usd, created_at                        │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Data Flow

**Outbound (Abyrith → Claude API):**
1. User sends message through chat interface
2. Frontend makes authenticated POST to `/api/v1/ai/chat`
3. Worker authenticates user and checks rate limits
4. Worker retrieves conversation history from Supabase
5. Worker determines if research needed (scrape docs via FireCrawl)
6. Worker selects appropriate Claude model based on query complexity
7. Worker builds prompt with system instructions + context + user message
8. Worker calls Claude API with streaming enabled
9. Claude processes request and streams response tokens

**Inbound (Claude API → Abyrith):**
1. Claude API streams Server-Sent Events (SSE) with content blocks
2. Worker transforms SSE format to frontend-compatible format
3. Worker forwards stream to client in real-time
4. On completion, Claude sends usage statistics
5. Worker logs token usage and calculated cost to Supabase
6. Worker saves complete message to conversation history

### Components Involved

**Frontend:**
- `AiAssistantChat.tsx` - Main chat component with streaming support
- `MessageList.tsx` - Renders conversation history
- `StreamingMessage.tsx` - Displays tokens as they arrive

**Backend:**
- `ai-conversation-handler.ts` - Worker that orchestrates Claude API calls
- `claude-client.ts` - Claude API client with TypeScript types
- `model-selector.ts` - Logic for selecting appropriate Claude model
- `prompt-builder.ts` - Constructs context-aware prompts
- `stream-transformer.ts` - Transforms Claude SSE to frontend format

**External:**
- Claude API (`https://api.anthropic.com/v1/messages`)
- FireCrawl API (for documentation research)

---

## Authentication

### Authentication Method

**Type:** API Key authentication with HTTP headers

**How it works:**
- Abyrith stores Anthropic API key in Cloudflare Workers secrets
- Each request to Claude API includes `x-api-key` header
- API key identifies Abyrith's account for billing and rate limiting
- User's JWT is NOT sent to Claude (privacy preservation)

### Credentials Management

**Where credentials are stored:**
- **Development:** `.dev.vars` file (local development only, gitignored)
- **Staging:** Cloudflare Workers secrets (staging environment)
- **Production:** Cloudflare Workers secrets (production environment)

**Credential Format:**
```bash
CLAUDE_API_KEY=sk-ant-api03-...   # Anthropic API key
```

### Obtaining Credentials

**Step 1: Create Anthropic Account**
1. Go to https://console.anthropic.com
2. Sign up with email or OAuth
3. Verify email address

**Step 2: Generate API Key**
1. Navigate to Settings → API Keys
2. Click "Create Key"
3. Name it (e.g., "Abyrith Production")
4. Copy key immediately (shown only once)

**Step 3: Store in Workers**
```bash
# Set secret via Wrangler CLI (production)
wrangler secret put CLAUDE_API_KEY

# Paste your API key when prompted

# Verify secret is set
wrangler secret list
# Output: CLAUDE_API_KEY (set)
```

**Step 4: Verify Access**
```bash
# Test API key with curl
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-5-haiku-20241022",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

---

## Configuration

### Environment Variables

**Required:**
```bash
CLAUDE_API_KEY=sk-ant-api03-...          # Anthropic API key (required)
ANTHROPIC_VERSION=2023-06-01             # API version (optional, default: 2023-06-01)
```

**Optional:**
```bash
CLAUDE_TIMEOUT_MS=30000                  # Request timeout (default: 30s)
CLAUDE_RETRY_ATTEMPTS=3                  # Max retry attempts (default: 3)
CLAUDE_DEFAULT_MODEL=claude-3-5-sonnet-20241022  # Default model
CLAUDE_MAX_TOKENS=4096                   # Max output tokens (default: 4096)
CLAUDE_TEMPERATURE=0.7                   # Default temperature (default: 0.7)
```

### Configuration File

**Location:** `src/lib/claude/config.ts`

**Structure:**
```typescript
interface ClaudeConfig {
  apiKey: string;              // API key from environment
  version: string;             // Anthropic API version
  endpoint: string;            // API endpoint URL
  timeout: number;             // Request timeout in ms
  retryAttempts: number;       // Max retries for failed requests
  defaultModel: string;        // Default model if not specified
  maxTokens: number;           // Max output tokens
  temperature: number;         // Default temperature for responses
  enableThinking?: boolean;    // Enable extended thinking mode
}
```

**Example:**
```typescript
// src/lib/claude/config.ts
export const claudeConfig: ClaudeConfig = {
  apiKey: process.env.CLAUDE_API_KEY!,
  version: process.env.ANTHROPIC_VERSION || '2023-06-01',
  endpoint: 'https://api.anthropic.com/v1/messages',
  timeout: parseInt(process.env.CLAUDE_TIMEOUT_MS || '30000'),
  retryAttempts: parseInt(process.env.CLAUDE_RETRY_ATTEMPTS || '3'),
  defaultModel: process.env.CLAUDE_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
  maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
  temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7'),
  enableThinking: process.env.CLAUDE_ENABLE_THINKING === 'true',
};

// Validate configuration on startup
export function validateClaudeConfig(): void {
  if (!claudeConfig.apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable is required');
  }

  if (!claudeConfig.apiKey.startsWith('sk-ant-')) {
    throw new Error('CLAUDE_API_KEY must start with "sk-ant-"');
  }

  if (claudeConfig.maxTokens < 1 || claudeConfig.maxTokens > 8192) {
    throw new Error('CLAUDE_MAX_TOKENS must be between 1 and 8192');
  }

  if (claudeConfig.temperature < 0 || claudeConfig.temperature > 1) {
    throw new Error('CLAUDE_TEMPERATURE must be between 0 and 1');
  }
}
```

---

## API Reference

### Client Setup

**Installation:**
```bash
# Claude API client is HTTP-based, no SDK needed
# We'll use native fetch() API in Cloudflare Workers
```

**Initialization:**
```typescript
// src/lib/claude/client.ts
import { claudeConfig, validateClaudeConfig } from './config';

// Validate config on module load
validateClaudeConfig();

/**
 * Claude API client for Cloudflare Workers
 */
export class ClaudeClient {
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig = claudeConfig) {
    this.config = config;
  }

  /**
   * Create a completion with Claude
   */
  async createMessage(params: CreateMessageParams): Promise<ClaudeMessage> {
    const response = await this.makeRequest(params);
    return response;
  }

  /**
   * Create a streaming completion
   */
  async createMessageStream(params: CreateMessageParams): Promise<ReadableStream> {
    const response = await this.makeRequest({ ...params, stream: true });
    return response.body!;
  }

  private async makeRequest(params: any): Promise<Response> {
    return await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.version,
        'content-type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  }
}
```

### Available Methods

#### Method 1: `createMessage`

**Purpose:** Generate a single non-streaming response from Claude

**Signature:**
```typescript
async function createMessage(
  params: CreateMessageParams
): Promise<ClaudeMessage>
```

**Parameters:**
```typescript
interface CreateMessageParams {
  model: string;                     // Model identifier
  max_tokens: number;                // Maximum output tokens
  messages: ClaudeMessageInput[];    // Conversation messages
  system?: string;                   // System prompt
  temperature?: number;              // 0-1, controls randomness
  top_p?: number;                    // 0-1, nucleus sampling
  top_k?: number;                    // Top-k sampling
  stop_sequences?: string[];         // Stop generation at these sequences
  metadata?: {                       // Optional metadata
    user_id?: string;
  };
}

interface ClaudeMessageInput {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}
```

**Returns:**
```typescript
interface ClaudeMessage {
  id: string;                        // Message ID
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];           // Response content blocks
  model: string;                     // Model used
  stop_reason: string;               // Why generation stopped
  stop_sequence: string | null;      // Stop sequence hit (if any)
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

**Example Usage:**
```typescript
const client = new ClaudeClient();

const response = await client.createMessage({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: 'What is an API key?'
  }],
  system: 'You are a helpful assistant that explains technical concepts simply.',
  temperature: 0.7,
});

console.log(response.content[0].text);
// Output: "An API key is like a password that allows your application..."

console.log('Tokens used:', response.usage.input_tokens + response.usage.output_tokens);
// Output: Tokens used: 195
```

**Error Cases:**
- `400 Bad Request` - Invalid parameters or malformed request
- `401 Unauthorized` - Invalid or missing API key
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Claude API error
- `529 Overloaded` - Claude API temporarily overloaded

---

#### Method 2: `createMessageStream`

**Purpose:** Generate a streaming response from Claude for real-time display

**Signature:**
```typescript
async function createMessageStream(
  params: CreateMessageParams
): Promise<ReadableStream>
```

**Parameters:**
Same as `createMessage`, but with `stream: true` added automatically

**Returns:**
```typescript
ReadableStream<Uint8Array>  // Server-Sent Events (SSE) stream
```

**SSE Event Types:**
```typescript
// Event: message_start
{
  "type": "message_start",
  "message": {
    "id": "msg_123",
    "type": "message",
    "role": "assistant",
    "content": [],
    "model": "claude-3-5-sonnet-20241022",
    "usage": { "input_tokens": 150 }
  }
}

// Event: content_block_start
{
  "type": "content_block_start",
  "index": 0,
  "content_block": {
    "type": "text",
    "text": ""
  }
}

// Event: content_block_delta (many of these)
{
  "type": "content_block_delta",
  "index": 0,
  "delta": {
    "type": "text_delta",
    "text": "An API key "
  }
}

// Event: content_block_stop
{
  "type": "content_block_stop",
  "index": 0
}

// Event: message_delta
{
  "type": "message_delta",
  "delta": {
    "stop_reason": "end_turn",
    "stop_sequence": null
  },
  "usage": { "output_tokens": 45 }
}

// Event: message_stop
{
  "type": "message_stop"
}
```

**Example Usage:**
```typescript
const client = new ClaudeClient();

const stream = await client.createMessageStream({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: 'Show me how to get an OpenAI API key step by step'
  }],
  system: ACQUISITION_FLOW_SYSTEM_PROMPT,
  temperature: 0.5,
});

// Process stream
const reader = stream.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));

      if (data.type === 'content_block_delta') {
        // Send token to client immediately
        process.stdout.write(data.delta.text);
      }

      if (data.type === 'message_delta') {
        // Log usage statistics
        console.log('Usage:', data.usage);
      }
    }
  }
}
```

**Error Cases:**
Same as `createMessage`, but errors may occur mid-stream

---

## Implementation Details

### Integration Code

**File:** `src/lib/claude/client.ts`

**Full Implementation:**
```typescript
import { claudeConfig } from './config';

export interface CreateMessageParams {
  model: string;
  max_tokens: number;
  messages: ClaudeMessageInput[];
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  metadata?: {
    user_id?: string;
  };
}

export interface ClaudeMessageInput {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ClaudeMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Claude API client for Cloudflare Workers
 */
export class ClaudeClient {
  private config: typeof claudeConfig;

  constructor(config = claudeConfig) {
    this.config = config;
  }

  /**
   * Create a message with Claude (non-streaming)
   */
  async createMessage(params: CreateMessageParams): Promise<ClaudeMessage> {
    const response = await this.makeRequest({
      ...params,
      stream: false,
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    return await response.json();
  }

  /**
   * Create a streaming message with Claude
   */
  async createMessageStream(params: CreateMessageParams): Promise<ReadableStream> {
    const response = await this.makeRequest({
      ...params,
      stream: true,
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    return response.body!;
  }

  /**
   * Make HTTP request to Claude API
   */
  private async makeRequest(params: CreateMessageParams): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': this.config.version,
          'content-type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Handle API errors
   */
  private async handleError(response: Response): Promise<Error> {
    const body = await response.text();

    let errorData: any;
    try {
      errorData = JSON.parse(body);
    } catch {
      errorData = { error: { message: body } };
    }

    const error = new ClaudeAPIError(
      errorData.error?.message || 'Unknown error',
      response.status,
      errorData.error?.type || 'unknown'
    );

    return error;
  }
}

/**
 * Custom error class for Claude API errors
 */
export class ClaudeAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType: string
  ) {
    super(message);
    this.name = 'ClaudeAPIError';
  }
}
```

### Data Transformation

**Claude API Response → Internal Format:**

```typescript
// Claude API streaming event
interface ClaudeStreamEvent {
  type: 'content_block_delta' | 'message_delta' | 'message_stop';
  delta?: {
    type: 'text_delta';
    text: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

// Internal format for frontend
interface FrontendStreamEvent {
  type: 'chunk' | 'complete' | 'error';
  content?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  error?: string;
}

/**
 * Transform Claude SSE stream to frontend format
 */
export class StreamTransformer extends TransformStream<Uint8Array, Uint8Array> {
  constructor(model: string) {
    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    super({
      transform(chunk, controller) {
        const decoder = new TextDecoder();
        buffer += decoder.decode(chunk, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: ClaudeStreamEvent = JSON.parse(line.slice(6));

              // Transform content deltas
              if (data.type === 'content_block_delta' && data.delta?.text) {
                const event: FrontendStreamEvent = {
                  type: 'chunk',
                  content: data.delta.text,
                };
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
                );
              }

              // Accumulate usage stats
              if (data.usage?.input_tokens) {
                totalInputTokens = data.usage.input_tokens;
              }
              if (data.usage?.output_tokens) {
                totalOutputTokens += data.usage.output_tokens;
              }

              // Send completion event with usage
              if (data.type === 'message_stop') {
                const cost = calculateCost(model, {
                  input_tokens: totalInputTokens,
                  output_tokens: totalOutputTokens,
                });

                const event: FrontendStreamEvent = {
                  type: 'complete',
                  usage: {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    costUsd: cost,
                  },
                };
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
                );
              }
            } catch (error) {
              console.error('Failed to parse SSE event:', error);
            }
          }
        }
      },
    });
  }
}

/**
 * Calculate cost based on model and token usage
 */
function calculateCost(model: string, usage: { input_tokens: number; output_tokens: number }): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-5-haiku-20241022': {
      input: 0.25 / 1_000_000,
      output: 1.25 / 1_000_000,
    },
    'claude-3-5-sonnet-20241022': {
      input: 3.00 / 1_000_000,
      output: 15.00 / 1_000_000,
    },
  };

  const modelPricing = pricing[model] || pricing['claude-3-5-sonnet-20241022'];

  return (
    usage.input_tokens * modelPricing.input +
    usage.output_tokens * modelPricing.output
  );
}
```

---

## Model Selection Logic

### Decision Tree

```typescript
/**
 * Select appropriate Claude model based on query characteristics
 */
export function selectClaudeModel(
  userMessage: string,
  conversationHistory: Message[]
): string {
  const message = userMessage.toLowerCase();

  // 1. Simple FAQ → Haiku (fast + cheap)
  const faqKeywords = [
    'what is', 'what are', 'how does', 'explain',
    'define', 'meaning of', 'difference between'
  ];

  if (faqKeywords.some(kw => message.includes(kw)) && message.length < 100) {
    return 'claude-3-5-haiku-20241022';
  }

  // 2. Complex reasoning → Extended Thinking
  const complexKeywords = [
    'design', 'architecture', 'optimize', 'compare multiple',
    'best approach', 'tradeoffs', 'plan', 'strategy'
  ];

  if (complexKeywords.some(kw => message.includes(kw))) {
    // Extended thinking is same model, enabled via parameter
    return 'claude-3-5-sonnet-20241022';
  }

  // 3. Acquisition flow generation → Sonnet
  const acquisitionKeywords = [
    'how to get', 'show me how', 'step by step',
    'acquire', 'sign up for', 'create account'
  ];

  if (acquisitionKeywords.some(kw => message.includes(kw))) {
    return 'claude-3-5-sonnet-20241022';
  }

  // 4. Long conversation (>10 messages) → Sonnet for consistency
  if (conversationHistory.length > 10) {
    return 'claude-3-5-sonnet-20241022';
  }

  // 5. Default → Sonnet (balanced)
  return 'claude-3-5-sonnet-20241022';
}
```

### Model Characteristics

**Haiku - Fast and Cheap:**
- **Model ID:** `claude-3-5-haiku-20241022`
- **Best for:** Simple Q&A, definitions, quick lookups
- **Speed:** ~1s response time
- **Cost:** $0.25 / 1M input tokens, $1.25 / 1M output tokens
- **Max output:** 4,096 tokens
- **Use when:** User asks straightforward question, no acquisition flow needed

**Sonnet - Balanced:**
- **Model ID:** `claude-3-5-sonnet-20241022`
- **Best for:** Most conversations, acquisition flows, comparisons
- **Speed:** ~3-5s response time
- **Cost:** $3.00 / 1M input tokens, $15.00 / 1M output tokens
- **Max output:** 8,192 tokens
- **Use when:** Default choice, generating flows, moderate complexity

**Sonnet Extended Thinking - Deep Reasoning:**
- **Model ID:** `claude-3-5-sonnet-20241022` (with thinking enabled)
- **Best for:** Complex planning, architecture decisions, optimization
- **Speed:** ~10-20s response time (includes thinking time)
- **Cost:** Same as Sonnet + thinking tokens
- **Max output:** 8,192 tokens
- **Use when:** User needs detailed analysis, comparing many options, debugging complex issues

---

## Prompt Engineering

### System Prompts

**Base System Prompt (All Models):**

```typescript
const BASE_SYSTEM_PROMPT = `You are the AI Secret Assistant for Abyrith, a secrets management platform. Your role is to help users understand, acquire, and manage API keys and developer secrets.

Core Principles:
1. SIMPLICITY: Explain everything like you're talking to a 5-year-old, then add technical details
2. EDUCATION: Don't just give answers - teach users WHY and HOW
3. HONESTY: If you don't know something, say so and offer to research it
4. SECURITY: Always promote security best practices
5. COST AWARENESS: Always mention pricing and costs upfront

Your personality:
- Friendly and encouraging, never condescending
- Patient with beginners
- Technical when appropriate for experienced users
- Proactive in suggesting better approaches

What you can do:
- Explain what API keys are and how they work
- Generate step-by-step instructions to acquire any API key
- Research pricing, limits, and features of API services
- Compare different services and recommend best fit
- Help troubleshoot issues during acquisition
- Teach security best practices

What you CANNOT do:
- Access or decrypt the user's actual secret values
- Sign up for services on behalf of users
- Make API calls to external services (except for research)
- Make financial decisions for users

Format your responses:
- Use markdown for structure (headings, lists, code blocks)
- Break complex topics into digestible chunks
- Use examples and analogies
- Include checkpoints and verification steps
- Highlight warnings and important notes with ⚠️
- Use emojis sparingly for emphasis (✅ ❌ 💡 ⚠️)

Remember: Users range from complete beginners to experienced developers. Adjust your communication style based on their questions and responses.`;
```

**Acquisition Flow System Prompt (Sonnet only):**

```typescript
const ACQUISITION_FLOW_SYSTEM_PROMPT = `You are generating a step-by-step API key acquisition flow. This flow will guide a user who may have NEVER acquired an API key before.

Requirements:
1. Break the process into 5-10 clear, actionable steps
2. Each step should take less than 5 minutes
3. Include specific URLs and exact button names
4. Warn about requirements upfront (credit card, phone, etc.)
5. Include checkpoints to verify progress
6. Anticipate common issues and provide solutions
7. Extract accurate pricing information
8. Be encouraging and patient in tone

Format:
- Return ONLY valid JSON matching the AcquisitionFlow interface
- Use markdown in instruction fields for formatting
- Keep instructions concrete and specific
- Include estimated time for each step
- List common issues and solutions

Example step format:
{
  "stepNumber": 1,
  "title": "Create Account",
  "instructions": "Go to [service.com/signup](https://service.com/signup)\\n\\n1. Click 'Sign up'\\n2. Enter your email\\n3. Create a strong password",
  "checkpoints": ["You received a verification email"],
  "estimatedDuration": "2 minutes",
  "commonIssues": [
    {
      "problem": "Email not arriving",
      "solution": "Check spam folder. Wait 5 minutes."
    }
  ]
}`;
```

**Cost Analysis System Prompt:**

```typescript
const COST_ANALYSIS_SYSTEM_PROMPT = `You are analyzing API usage and costs for the user. Be precise, honest, and educational.

When presenting costs:
1. Show actual numbers from their usage data
2. Break down costs by service/model/feature
3. Compare to previous periods
4. Identify cost spikes and explain why
5. Suggest concrete optimizations

When costs are high:
- Don't panic the user
- Explain what's normal for their usage
- Offer specific ways to reduce costs
- Suggest alternatives if appropriate

When suggesting optimizations:
- Provide concrete code examples
- Explain the trade-offs
- Estimate potential savings
- Prioritize by impact vs. effort

Format:
- Use tables for comparisons
- Show percentages for changes
- Highlight unusual patterns
- Use currency symbols correctly ($, €, £)`;
```

### Dynamic Prompt Construction

```typescript
/**
 * Build context-aware prompt for Claude
 */
export function buildPrompt(
  userMessage: string,
  conversationHistory: Message[],
  additionalContext: {
    projectName?: string;
    existingKeys?: string[];
    researchData?: ScrapedServiceData;
  }
): CreateMessageParams {
  // Build context section
  let contextSection = '';

  if (additionalContext.projectName) {
    contextSection += `\nUser's current project: ${additionalContext.projectName}\n`;
  }

  if (additionalContext.existingKeys && additionalContext.existingKeys.length > 0) {
    contextSection += `\nExisting API keys in project:\n`;
    contextSection += additionalContext.existingKeys.map(k => `- ${k}`).join('\n');
    contextSection += '\n';
  }

  if (additionalContext.researchData) {
    contextSection += `\nI've researched the latest documentation:\n\n`;
    contextSection += `PRICING:\n${additionalContext.researchData.pricing}\n\n`;
    contextSection += `GETTING STARTED:\n${additionalContext.researchData.gettingStarted}\n`;
  }

  // Build full system prompt
  const systemPrompt = BASE_SYSTEM_PROMPT + '\n' + contextSection;

  // Build messages array from history
  const messages: ClaudeMessageInput[] = conversationHistory.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  // Add current message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  // Select model
  const model = selectClaudeModel(userMessage, conversationHistory);

  return {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    temperature: 0.7,
  };
}
```

---

## Streaming Responses

### Stream Implementation

**Worker Handler:**
```typescript
// src/workers/ai-conversation-handler.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // 1. Authenticate
      const user = await authenticateRequest(request, env);

      // 2. Parse request
      const { message, conversation_id, project_id } = await request.json();

      // 3. Retrieve conversation history
      const history = await getConversationHistory(conversation_id, env);

      // 4. Detect if research needed
      const needsResearch = detectResearchIntent(message);
      let researchData = null;

      if (needsResearch) {
        const serviceName = extractServiceName(message);
        researchData = await scrapeServiceDocs(serviceName, env);
      }

      // 5. Build prompt
      const params = buildPrompt(message, history, {
        projectName: project_id ? await getProjectName(project_id) : undefined,
        existingKeys: project_id ? await getProjectKeys(project_id) : undefined,
        researchData,
      });

      // 6. Create Claude client
      const claude = new ClaudeClient();

      // 7. Start streaming
      const claudeStream = await claude.createMessageStream(params);

      // 8. Transform stream for frontend
      const transformedStream = claudeStream
        .pipeThrough(new StreamTransformer(params.model));

      // 9. Return streaming response
      return new Response(transformedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
      });

    } catch (error) {
      return handleError(error);
    }
  }
};
```

**Frontend Consumption:**
```typescript
// src/hooks/useAiChat.ts
export function useAiChat(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  async function sendMessage(content: string) {
    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content,
      timestamp: new Date(),
    }]);

    // Start streaming
    setIsStreaming(true);

    const response = await fetch('/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        conversation_id: conversationId,
      }),
    });

    // Process stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let assistantMessage = '';

    // Add empty assistant message
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'chunk') {
              // Append to assistant message
              assistantMessage += event.content;

              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = assistantMessage;
                return newMessages;
              });
            }

            if (event.type === 'complete') {
              // Mark as complete
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].isStreaming = false;
                newMessages[newMessages.length - 1].usage = event.usage;
                return newMessages;
              });

              setIsStreaming(false);
            }
          } catch (error) {
            console.error('Failed to parse SSE event:', error);
          }
        }
      }
    }
  }

  return { messages, isStreaming, sendMessage };
}
```

---

## Error Handling

### Error Types

**Error 1: Invalid API Key**
- **When:** API key is missing, malformed, or revoked
- **Claude Code:** `401 Unauthorized`
- **Internal Code:** `claude_auth_error`
- **Recovery:** Check `CLAUDE_API_KEY` environment variable, regenerate if needed

**Error 2: Rate Limit Exceeded**
- **When:** Too many requests to Claude API
- **Claude Code:** `429 Too Many Requests`
- **Internal Code:** `claude_rate_limit`
- **Recovery:** Wait for retry-after period, queue requests, implement backoff

**Error 3: Overloaded**
- **When:** Claude API is experiencing high load
- **Claude Code:** `529 Overloaded`
- **Internal Code:** `claude_overloaded`
- **Recovery:** Exponential backoff, retry after delay

**Error 4: Invalid Request**
- **When:** Malformed request body or invalid parameters
- **Claude Code:** `400 Bad Request`
- **Internal Code:** `claude_invalid_request`
- **Recovery:** Validate request parameters, fix malformed input

**Error 5: Context Length Exceeded**
- **When:** Total tokens (input + output) exceeds model limit
- **Claude Code:** `400 Bad Request` with specific error
- **Internal Code:** `claude_context_length_exceeded`
- **Recovery:** Truncate conversation history, reduce max_tokens

### Retry Strategy

**Retry Policy:**
- Attempts: 3 (configurable)
- Backoff: Exponential (1s, 2s, 4s)
- Max wait: 10 seconds

**Retriable Errors:**
- `429 Too Many Requests` - Always retry with backoff
- `529 Overloaded` - Always retry with backoff
- `500 Internal Server Error` - Retry once
- Network errors - Retry with backoff

**Non-Retriable Errors:**
- `400 Bad Request` - Fix request, don't retry
- `401 Unauthorized` - Fix API key, don't retry
- `403 Forbidden` - Check permissions, don't retry

**Implementation:**
```typescript
/**
 * Call Claude API with exponential backoff retry
 */
export async function callClaudeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retriable
      if (error instanceof ClaudeAPIError) {
        if (error.statusCode === 429) {
          // Rate limited - use Retry-After header if present
          const retryAfter = error.retryAfter || Math.pow(2, attempt);
          await sleep(retryAfter * 1000);
          continue;
        }

        if (error.statusCode === 529) {
          // Overloaded - exponential backoff
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }

        if (error.statusCode === 500 && attempt === 0) {
          // Retry server errors once
          await sleep(1000);
          continue;
        }

        // Non-retriable error
        throw error;
      }

      // Network error - retry with backoff
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Rate Limiting and Cost Management

### Anthropic Rate Limits

**Tier 1 (Free Trial):**
- 50 requests per minute
- 40,000 tokens per minute (input)
- 4,000 tokens per minute (output)
- $10 credit

**Tier 2 (Build):**
- 1,000 requests per minute
- 100,000 tokens per minute (input)
- 10,000 tokens per minute (output)
- Pay as you go

**Tier 3 (Scale):**
- 2,000 requests per minute
- 200,000 tokens per minute (input)
- 20,000 tokens per minute (output)
- Volume discounts available

### Abyrith Rate Limiting

**User-facing limits (enforced in Worker):**
- 20 AI requests per minute per user
- 200 AI requests per hour per user
- Prevents accidental cost spikes

**Implementation:**
```typescript
// Check rate limit before Claude API call
const rateLimited = await checkRateLimit(
  user.id,
  'minute',
  20,  // AI rate limit (lower than general API)
  env
);

if (rateLimited) {
  return new Response(JSON.stringify({
    error: 'ai_rate_limit_exceeded',
    message: 'You have exceeded the AI request limit. Please wait before trying again.',
    retry_after: 60,
    limit: 20,
    window: 'minute',
  }), { status: 429 });
}
```

### Cost Management

**Budget Tracking:**
```typescript
// Track user's monthly AI spending
async function trackAiCost(
  userId: string,
  cost: number,
  env: Env
): Promise<void> {
  // Get current month's spending
  const key = `ai_cost:${userId}:${getCurrentMonth()}`;
  const currentSpend = parseFloat(await env.KV.get(key) || '0');

  // Add new cost
  const newSpend = currentSpend + cost;
  await env.KV.put(key, newSpend.toString(), {
    expirationTtl: 60 * 60 * 24 * 32, // Expire after 32 days
  });

  // Check budget limit
  const userBudget = await getUserAiBudget(userId, env);
  if (userBudget && newSpend >= userBudget) {
    await sendBudgetAlert(userId, newSpend, userBudget, env);
  }
}

// Alert user when approaching budget
async function sendBudgetAlert(
  userId: string,
  currentSpend: number,
  budget: number,
  env: Env
): Promise<void> {
  const percentUsed = (currentSpend / budget) * 100;

  if (percentUsed >= 90) {
    await createNotification(userId, {
      type: 'ai_budget_alert',
      level: 'critical',
      message: `You've used ${percentUsed.toFixed(0)}% of your monthly AI budget ($${currentSpend.toFixed(2)} / $${budget.toFixed(2)})`,
      actionUrl: '/settings/ai-budget',
    }, env);
  }
}
```

**Cost Optimization Suggestions:**
```typescript
/**
 * Suggest model downgrade if appropriate
 */
function suggestOptimization(
  conversationHistory: Message[]
): string | null {
  // If last 5 messages were simple Q&A but used Sonnet
  const recentMessages = conversationHistory.slice(-5);
  const allSimple = recentMessages.every(m =>
    m.role === 'user' && m.content.length < 100
  );

  const usedExpensiveModel = recentMessages.some(m =>
    m.model === 'claude-3-5-sonnet-20241022'
  );

  if (allSimple && usedExpensiveModel) {
    return "💡 Tip: These questions could use Haiku (faster + 12x cheaper). Want me to switch?";
  }

  return null;
}
```

---

## Token Usage Tracking

### Usage Logging

**Log to Supabase:**
```typescript
/**
 * Save message with usage tracking
 */
async function saveAssistantMessage(
  conversationId: string,
  content: string,
  model: string,
  usage: { input_tokens: number; output_tokens: number },
  env: Env
): Promise<void> {
  const cost = calculateCost(model, usage);

  await supabase.from('conversation_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content,
    model,
    tokens_input: usage.input_tokens,
    tokens_output: usage.output_tokens,
    cost_usd: cost,
    created_at: new Date().toISOString(),
  });

  // Track in cost management system
  await trackAiCost(conversationId, cost, env);
}
```

### Usage Analytics

**Get user's AI costs:**
```typescript
/**
 * Get user's total AI costs for a period
 */
async function getUserAiCosts(
  userId: string,
  period: 'day' | 'week' | 'month' | 'all',
  env: Env
): Promise<AiCostSummary> {
  const startDate = getStartDate(period);

  const { data } = await supabase
    .from('conversation_messages')
    .select('cost_usd, tokens_input, tokens_output, model, created_at')
    .gte('created_at', startDate)
    .eq('role', 'assistant')
    .in('conversation_id',
      supabase.from('conversations').select('id').eq('user_id', userId)
    );

  return {
    totalCost: data.reduce((sum, m) => sum + m.cost_usd, 0),
    totalTokens: data.reduce((sum, m) => sum + m.tokens_input + m.tokens_output, 0),
    messageCount: data.length,
    averageCostPerMessage: data.reduce((sum, m) => sum + m.cost_usd, 0) / data.length,
    byModel: groupByModel(data),
    timeline: groupByDay(data),
  };
}
```

---

## Testing

### Unit Tests

**Test File:** `src/lib/claude/client.test.ts`

**Mock Setup:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeClient, ClaudeAPIError } from './client';

describe('ClaudeClient', () => {
  let client: ClaudeClient;

  beforeEach(() => {
    client = new ClaudeClient({
      apiKey: 'sk-ant-test-key',
      version: '2023-06-01',
      endpoint: 'https://api.anthropic.com/v1/messages',
      timeout: 5000,
      retryAttempts: 3,
      defaultModel: 'claude-3-5-haiku-20241022',
      maxTokens: 1024,
      temperature: 0.7,
    });
  });

  it('should create a non-streaming message', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Test response' }],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    const response = await client.createMessage({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Test' }],
    });

    expect(response.content[0].text).toBe('Test response');
    expect(response.usage.input_tokens).toBe(10);
    expect(response.usage.output_tokens).toBe(5);
  });

  it('should handle 429 rate limit error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({
        error: {
          type: 'rate_limit_error',
          message: 'Rate limit exceeded',
        },
      }),
    });

    await expect(client.createMessage({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Test' }],
    })).rejects.toThrow(ClaudeAPIError);
  });

  it('should handle streaming response', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"type":"message_stop"}\n\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    });

    const stream = await client.createMessageStream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Test' }],
    });

    expect(stream).toBeInstanceOf(ReadableStream);
  });
});
```

### Integration Tests

**Test Scenario 1: Complete conversation flow**
```typescript
describe('AI Conversation Flow', () => {
  it('should handle complete conversation with streaming', async () => {
    // 1. Create conversation
    const conversation = await createConversation(userId, projectId);

    // 2. Send user message
    const response = await fetch('/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'What is an API key?',
        conversation_id: conversation.id,
      }),
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    // 3. Read stream
    const reader = response.body!.getReader();
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      content += new TextDecoder().decode(value);
    }

    // 4. Verify response contains expected content
    expect(content).toContain('API key');
    expect(content).toContain('"type":"complete"');

    // 5. Verify message saved to database
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversation.id);

    expect(messages).toHaveLength(2); // User + assistant
    expect(messages[1].model).toBe('claude-3-5-haiku-20241022');
    expect(messages[1].cost_usd).toBeGreaterThan(0);
  });
});
```

### Manual Testing

**Test in development:**
```bash
# 1. Start local dev server
wrangler dev

# 2. Test non-streaming request
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer <test-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is an API key?",
    "conversation_id": "test-conv-1"
  }'

# 3. Test streaming request
curl -X POST http://localhost:8787/api/v1/ai/chat \
  -H "Authorization: Bearer <test-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me how to get an OpenAI API key",
    "conversation_id": "test-conv-1"
  }'
```

**Verify:**
- [ ] Response streams in real-time
- [ ] Usage statistics logged correctly
- [ ] Cost calculated accurately
- [ ] Model selection appropriate for query
- [ ] Error handling works for invalid requests
- [ ] Rate limiting enforced correctly

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- Request count (total AI requests)
- Success rate (% of successful requests)
- Error rate (% of failed requests)
- Latency (p50, p95, p99 response times)
- Time to first token (TTFT)

**Model Usage:**
- Requests per model (Haiku vs Sonnet)
- Average tokens per request (input + output)
- Token usage trend over time
- Model selection accuracy

**Cost Metrics:**
- Daily AI spending ($)
- Cost per user ($)
- Cost per conversation ($)
- Budget utilization (% of monthly budget)

**Business Metrics:**
- Active AI users (daily/monthly)
- Conversations started
- Acquisition flows generated
- User satisfaction (thumbs up/down)

### Logging

**Log Level:** INFO | WARN | ERROR

**Logged Events:**
- AI request initiated (user_id, message_preview)
- Model selected (model, reason)
- Research triggered (service_name)
- Request succeeded (tokens_used, cost, duration_ms)
- Request failed (error_type, status_code, retry_count)
- Rate limit hit (user_id, limit_type)
- Budget alert triggered (user_id, amount, budget)

**Log Format:**
```typescript
{
  event: 'ai_request_succeeded',
  user_id: 'uuid-user-123',
  conversation_id: 'uuid-conv-456',
  model: 'claude-3-5-sonnet-20241022',
  tokens_input: 150,
  tokens_output: 450,
  cost_usd: 0.00825,
  duration_ms: 3450,
  ttft_ms: 1200,
  timestamp: '2025-10-30T12:34:56Z'
}
```

### Alerts

**Alert 1: High Error Rate**
- **Condition:** AI error rate > 5% over 15 minutes
- **Severity:** P2
- **Action:** Check Claude API status, investigate Worker logs, verify API key

**Alert 2: Rate Limit Approaching**
- **Condition:** Anthropic rate limit usage > 80% for 5 minutes
- **Severity:** P3
- **Action:** Consider upgrading tier, implement request queueing, notify users

**Alert 3: Cost Spike**
- **Condition:** Daily AI costs > 2x average of last 7 days
- **Severity:** P2
- **Action:** Investigate usage patterns, check for abuse, review model selection

**Alert 4: API Key Invalid**
- **Condition:** 401 errors from Claude API
- **Severity:** P1 (Critical)
- **Action:** Verify `CLAUDE_API_KEY`, check Anthropic console, regenerate if needed

**Alert 5: Latency Degradation**
- **Condition:** p95 latency > 10s for 10 minutes
- **Severity:** P2
- **Action:** Check Claude API status, verify network connectivity, review Worker performance

---

## Security Considerations

### Data Privacy

**Data sent to Claude API:**
- User's message content (conversation text only)
- Conversation history (last 10 messages for context)
- Scraped documentation (from FireCrawl)
- **NOT SENT:** User's actual secret values, encrypted secrets, API keys stored in Abyrith

**Data received from Claude API:**
- AI-generated responses
- Token usage statistics
- Model information
- **NOT RECEIVED:** Any user data not explicitly sent in request

**Privacy Controls:**
- User conversation data never used for Claude model training (per Anthropic policy)
- No PII sent except what user explicitly includes in conversation
- Conversation history stored in Supabase (user-controlled, can be deleted)
- User can delete conversations anytime
- GDPR compliant: data export and deletion available

### Credential Security

**How API key is protected:**
- Stored in Cloudflare Workers secrets (encrypted at rest)
- Never exposed to frontend or users
- Accessed only by Workers via environment variable
- Rotated quarterly (manual process)

**API Key Rotation Procedure:**
1. Generate new API key in Anthropic console
2. Test new key in staging environment
3. Update production Worker secret: `wrangler secret put CLAUDE_API_KEY`
4. Verify requests succeed with new key
5. Revoke old key in Anthropic console
6. Document rotation in change log

### Compliance

**GDPR:**
- User can export all AI conversations (JSON format)
- User can delete all conversations (cascade delete messages)
- Conversation data included in account deletion
- No data shared with third parties beyond Anthropic (per service agreement)

**SOC 2:**
- Audit trail of all AI requests (logged with user_id, timestamp)
- Cost tracking for financial controls
- Access controls via RLS (users can only access own conversations)
- Error logging and monitoring for availability

---

## Cost & Rate Limits

### Pricing Model

**Claude API Pricing (as of 2025-10-30):**

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|----------------------|
| Claude 3.5 Haiku | $0.25 | $1.25 |
| Claude 3.5 Sonnet | $3.00 | $15.00 |

**Example Costs:**

**Simple Q&A (Haiku):**
- Input: 50 tokens (~35 words prompt)
- Output: 200 tokens (~150 words response)
- Cost: (50 × $0.00000025) + (200 × $0.00000125) = **$0.000262**

**Acquisition Flow (Sonnet):**
- Input: 1,500 tokens (conversation history + prompt + scraped docs)
- Output: 3,000 tokens (detailed step-by-step instructions)
- Cost: (1,500 × $0.000003) + (3,000 × $0.000015) = **$0.0495**

**Estimated monthly cost for typical user:**
- 20 AI requests/month (mix of Haiku and Sonnet)
- Average cost per request: $0.01
- **Monthly cost: $0.20 per user**

**Abyrith's estimated costs (1,000 users):**
- 20,000 AI requests/month
- Average $0.01 per request
- **Total: $200/month**

### Rate Limits

**Anthropic Limits (Tier 2 - Build):**
- 1,000 requests per minute
- 100,000 input tokens per minute
- 10,000 output tokens per minute

**Abyrith User Limits:**
- 20 requests per minute (per user)
- 200 requests per hour (per user)

**How we handle limits:**
- Worker enforces user-level rate limiting (prevents individual abuse)
- If Anthropic rate limit hit: queue requests with exponential backoff
- Display user-friendly message: "AI is experiencing high demand. Retrying in 30 seconds..."
- Priority queue: paid users get priority over free users (future)

**Monitoring usage:**
```typescript
// Track Anthropic API usage
async function trackAnthropicUsage(
  tokensUsed: number,
  env: Env
): Promise<void> {
  const key = 'anthropic:usage:tokens:minute';
  const current = parseInt(await env.KV.get(key) || '0');
  const newTotal = current + tokensUsed;

  await env.KV.put(key, newTotal.toString(), {
    expirationTtl: 60, // Reset every minute
  });

  // Alert if approaching limit
  if (newTotal > 80000) { // 80% of 100k limit
    await sendAlert({
      type: 'anthropic_rate_limit_warning',
      current: newTotal,
      limit: 100000,
      percentage: (newTotal / 100000) * 100,
    });
  }
}
```

---

## Troubleshooting

### Issue 1: "Authentication Error" (401)

**Symptoms:**
```
ClaudeAPIError: Invalid API key
Status: 401
```

**Cause:** API key is missing, invalid, or revoked

**Solution:**
```bash
# 1. Verify API key in Cloudflare
wrangler secret list
# Should show: CLAUDE_API_KEY (set)

# 2. Test API key directly
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-haiku-20241022","max_tokens":100,"messages":[{"role":"user","content":"test"}]}'

# 3. If invalid, regenerate in Anthropic console
# https://console.anthropic.com/settings/keys

# 4. Update Worker secret
wrangler secret put CLAUDE_API_KEY

# 5. Deploy and test
wrangler publish
```

---

### Issue 2: "Rate Limit Exceeded" (429)

**Symptoms:**
```
ClaudeAPIError: Rate limit exceeded
Status: 429
Retry-After: 60
```

**Cause:** Too many requests to Claude API in short time window

**Solution:**
```typescript
// 1. Check current tier limits in Anthropic console
// https://console.anthropic.com/settings/limits

// 2. Implement request queueing
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
      await sleep(100); // 100ms between requests
    }

    this.processing = false;
  }
}

// 3. Consider upgrading Anthropic tier if consistently hitting limits
// https://console.anthropic.com/settings/plans
```

---

### Issue 3: Slow Response Times

**Symptoms:**
- TTFT (time to first token) > 5 seconds
- Total response time > 30 seconds
- User sees long "thinking" spinner

**Cause:** Large context, complex query, or Claude API slowdown

**Solution:**
```typescript
// 1. Optimize context size
function truncateConversationHistory(
  messages: Message[],
  maxTokens: number = 10000
): Message[] {
  let tokenCount = 0;
  const truncated: Message[] = [];

  // Keep most recent messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content);

    if (tokenCount + msgTokens > maxTokens) break;

    truncated.unshift(msg);
    tokenCount += msgTokens;
  }

  return truncated;
}

// 2. Use faster model for simple queries
if (isSimpleQuery(message)) {
  model = 'claude-3-5-haiku-20241022'; // Much faster
}

// 3. Implement timeout warning
setTimeout(() => {
  if (!responseStarted) {
    showWarning('Claude is thinking hard on this one. This may take a moment...');
  }
}, 5000);

// 4. Check Claude API status
// https://status.anthropic.com
```

---

### Issue 4: Unexpected Model Selection

**Symptoms:**
- Using Sonnet when Haiku would suffice (wasting money)
- Using Haiku for complex queries (poor quality)

**Cause:** Model selection logic not tuned correctly

**Solution:**
```typescript
// 1. Review model selection logs
const logs = await supabase
  .from('conversation_messages')
  .select('model, tokens_input, tokens_output, cost_usd')
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(100);

// 2. Analyze patterns
const haikuCosts = logs.filter(l => l.model.includes('haiku'));
const sonnetCosts = logs.filter(l => l.model.includes('sonnet'));

console.log('Haiku avg cost:', average(haikuCosts.map(l => l.cost_usd)));
console.log('Sonnet avg cost:', average(sonnetCosts.map(l => l.cost_usd)));

// 3. Tune selection keywords
const FAQ_KEYWORDS = [
  'what is', 'what are', 'how does', 'explain', 'define',
  'difference between', 'meaning of', 'tell me about'
];

// 4. Add user override
function selectModel(message: string, userPreference?: string): string {
  if (userPreference === 'fast') return 'claude-3-5-haiku-20241022';
  if (userPreference === 'quality') return 'claude-3-5-sonnet-20241022';

  // Auto-select based on query
  return selectClaudeModel(message, conversationHistory);
}
```

---

### Debug Mode

**Enable debug logging:**
```bash
# Set environment variable
CLAUDE_DEBUG=true

# Or in code
export const DEBUG = process.env.CLAUDE_DEBUG === 'true';

if (DEBUG) {
  console.log('[Claude] Request:', {
    model,
    max_tokens,
    messages: messages.map(m => ({ role: m.role, length: m.content.length })),
  });
}
```

**What gets logged:**
- Request parameters (model, tokens, message lengths)
- Response metadata (tokens used, cost, duration)
- Model selection rationale
- Rate limit status
- Error details (full stack trace)

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [x] `TECH-STACK.md` - Claude API specified as AI provider
- [x] `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant feature spec
- [x] `06-backend/cloudflare-workers/workers-architecture.md` - Worker implementation
- [x] `GLOSSARY.md` - Term definitions

**External Dependencies:**
- Anthropic Claude API account with API key
- Cloudflare Workers (for hosting integration code)
- Supabase (for storing conversation history and usage data)

### Feature Dependencies

**Required by features:**
- `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant depends on this integration
- `08-features/ai-assistant/guided-acquisition.md` - Acquisition flow generation
- `08-features/usage-tracking/usage-tracking-overview.md` - Cost tracking depends on token logging

**Depends on features:**
- User Authentication - Must be authenticated to use AI assistant
- Conversation Management - Requires conversation history storage
- FireCrawl Integration - Provides documentation context for research

---

## References

### Internal Documentation
- `TECH-STACK.md` - Technology stack decisions
- `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant feature
- `06-backend/cloudflare-workers/workers-architecture.md` - Worker architecture
- `GLOSSARY.md` - Term definitions (API Gateway, Rate Limiting, etc.)

### External Resources
- [Anthropic Claude API Documentation](https://docs.anthropic.com/claude/reference) - Official API reference
- [Claude API Pricing](https://www.anthropic.com/pricing) - Current pricing
- [Claude API Rate Limits](https://docs.anthropic.com/claude/reference/rate-limits) - Rate limit tiers
- [Claude API Best Practices](https://docs.anthropic.com/claude/docs/intro-to-claude) - Usage guidelines
- [Anthropic Status Page](https://status.anthropic.com/) - Service status
- [Streaming with SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) - Server-sent events

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | AI Team | Initial Claude API integration documentation with streaming support, model selection, cost tracking, and error handling |

---

## Notes

### Future Improvements
- Implement semantic caching (cache similar questions to reduce API calls)
- Fine-tune model selection based on production usage patterns
- Add support for Claude's Computer Use API (when available)
- Implement request prioritization (paid users get faster responses)
- Add A/B testing for different system prompts
- Create Claude API usage dashboard for admins

### Known Limitations
- Cannot access actual secret values (by design - zero-knowledge architecture)
- Rate limits enforced by Anthropic (must stay within tier limits)
- Extended thinking mode increases cost significantly (use sparingly)
- Streaming adds complexity to error handling (errors can occur mid-stream)
- Model selection is heuristic-based (may not always be optimal)

### Performance Optimization Ideas
- Pre-generate acquisition flows for top 50 APIs (reduce latency)
- Implement request batching for multiple questions (reduce round trips)
- Use Workers KV to cache frequently asked questions (reduce API calls)
- Compress conversation history more aggressively (reduce input tokens)
- Experiment with lower temperature for more deterministic responses

