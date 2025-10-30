---
Document: AI Secret Assistant - Feature Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: AI Team
Status: Draft
Dependencies: 05-api/endpoints/secrets-endpoints.md, 03-security/security-model.md, TECH-STACK.md, 01-product/product-vision-strategy.md
---

# AI Secret Assistant Feature

## Overview

The AI Secret Assistant is Abyrith's intelligent guide that helps users understand, acquire, and manage API keys through conversational interaction. It transforms the confusing experience of "add your API key" into a guided, educational journey that anyone can follow—from complete beginners to experienced developers.

**Purpose:** Eliminate confusion and friction in API key acquisition while educating users about secrets management, costs, and best practices.

**Target Users:** The Learner, Solo Developer, Development Team, Enterprise

**Priority:** P0 - MVP (CRITICAL feature)

---

## Table of Contents

1. [User Perspective](#user-perspective)
2. [Technical Architecture](#technical-architecture)
3. [User Flows](#user-flows)
4. [Technical Implementation](#technical-implementation)
5. [Claude API Integration](#claude-api-integration)
6. [FireCrawl Integration](#firecrawl-integration)
7. [Conversation Management](#conversation-management)
8. [Guided Acquisition Flow Generation](#guided-acquisition-flow-generation)
9. [Prompt Engineering](#prompt-engineering)
10. [Model Selection Logic](#model-selection-logic)
11. [Cost Estimation & Usage Tracking](#cost-estimation--usage-tracking)
12. [API Contracts](#api-contracts)
13. [Security Considerations](#security-considerations)
14. [Performance Requirements](#performance-requirements)
15. [Testing Strategy](#testing-strategy)
16. [Dependencies](#dependencies)
17. [References](#references)
18. [Change Log](#change-log)

---

## User Perspective

### What Users See

The AI Secret Assistant appears as a conversational chat interface within the Abyrith web app. Users can:

- Ask questions in plain English ("I need an OpenAI API key")
- Get step-by-step instructions with screenshots
- Understand pricing and costs before signing up
- Learn what each API service does
- Track their progress through acquisition flows
- Get help when stuck

**Key Capabilities:**
- **Plain English Explanations:** Converts technical jargon into beginner-friendly language
- **Real-Time Research:** Fetches latest documentation, pricing, and instructions for any API service
- **Step-by-Step Guidance:** Generates acquisition flows with progress tracking
- **Cost Transparency:** Explains pricing models before user commits
- **Context Awareness:** Understands user's project and suggests relevant keys
- **Educational Approach:** Teaches secrets management best practices as users learn

### User Benefits

**For Learners (Beginners):**
- No more confusion when tutorials say "add your API key"
- Understands what API keys are and why they're needed
- Gains confidence acquiring keys independently
- Learns security best practices from day one

**For Solo Developers:**
- Quick answers about unfamiliar APIs
- Saves time researching documentation
- Discovers cost-effective alternatives
- Keeps track of what each key is for

**For Development Teams:**
- Onboard new team members faster
- Consistent knowledge across team
- Documents why certain services were chosen
- Reduces support burden for senior developers

**For Enterprise:**
- Standardizes key acquisition processes
- Audit trail of what services were researched
- Compliance-friendly documentation of decisions
- Reduces risk of unauthorized service usage

### Example Scenarios

**Scenario 1: Complete Beginner**

```
User: "I'm following a tutorial that says I need an OpenAI API key. What is that?"

AI: "Great question! An OpenAI API key is like a password that lets your code use
OpenAI's AI models (like ChatGPT) to do things like:
- Generate text
- Answer questions
- Summarize content
- Translate languages

Think of it like a library card - it proves you have permission to use their services.

You'll get $5 in free credit to start experimenting (about 2,500 ChatGPT messages worth).
After that, you pay only for what you use - typically $0.002 per 1,000 words.

Want me to show you how to get your key? I'll walk you through it step by step."

User: "Yes please!"

AI: [Generates 5-step acquisition flow with screenshots and progress tracking]
```

**Scenario 2: Experienced Developer**

```
User: "What's the difference between Stripe and Paddle for payments?"

AI: "Both handle online payments, but they're designed for different use cases:

**Stripe:**
- More control and customization
- You're the Merchant of Record (you handle sales tax)
- 2.9% + $0.30 per transaction
- Better for: Custom checkout flows, complex pricing
- Setup time: ~30 minutes

**Paddle:**
- They're the Merchant of Record (they handle sales tax globally)
- 5% + $0.50 per transaction (higher, but includes tax handling)
- Better for: SaaS, selling globally, avoiding tax complexity
- Setup time: ~10 minutes

For your RecipeApp project, I'd suggest starting with Stripe since you're US-based
and want custom subscription flows. Want me to show you how to get test keys?"
```

**Scenario 3: Cost Concerns**

```
User: "I want to add AI features but I'm worried about costs"

AI: "Smart to think about costs upfront! Let's break down your options:

**OpenAI (GPT-4):**
- Most powerful, most expensive
- $0.03 per 1,000 input tokens (~750 words)
- $0.06 per 1,000 output tokens
- Your RecipeApp with 1,000 users generating recipes: ~$150-300/month

**Claude (Anthropic):**
- Similar quality to GPT-4
- Haiku model: $0.25 per 1M tokens (100x cheaper!)
- Better for: Bulk processing, chat
- Same usage: ~$2-5/month with Haiku

**Gemini (Google):**
- Free tier: 60 requests/minute
- Paid: $0.001 per 1,000 chars (cheapest)
- Same usage: Free tier probably enough, ~$1-2/month if you exceed

I'd suggest starting with Claude Haiku - great quality at 1/100th the cost of GPT-4.
Want me to show you how to get a Claude API key?"
```

---

## Technical Architecture

### System Components

**Components involved:**
- **Frontend:** React chat interface, message rendering, code block syntax highlighting
- **Backend:** Cloudflare Workers (API orchestration), Supabase (conversation persistence)
- **External Services:** Claude API (AI responses), FireCrawl API (documentation scraping)
- **Database:** PostgreSQL (conversation history, acquisition flow templates)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 User's Browser                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │         AI Assistant Chat Interface               │ │
│  │  - Message history display                        │ │
│  │  - User input field                               │ │
│  │  - Code block rendering                           │ │
│  │  - Progress tracking UI                           │ │
│  └────────────────┬──────────────────────────────────┘ │
│                   │                                     │
└───────────────────┼─────────────────────────────────────┘
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────────────┐
│          Cloudflare Workers (API Gateway)               │
│  ┌───────────────────────────────────────────────────┐ │
│  │  AI Conversation Orchestrator                     │ │
│  │  1. Authenticate user (JWT)                       │ │
│  │  2. Retrieve conversation context (if exists)     │ │
│  │  3. Determine appropriate Claude model            │ │
│  │  4. Call Claude API or FireCrawl (if research)    │ │
│  │  5. Stream response to client                     │ │
│  │  6. Save conversation to Supabase                 │ │
│  │  7. Track token usage and costs                   │ │
│  └────────────────┬──────────────────────────────────┘ │
└───────────────────┼─────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   Claude API     │    │  FireCrawl API   │
│  (Anthropic)     │    │  (Web Scraping)  │
│                  │    │                  │
│ - Haiku          │    │ - Scrape docs    │
│ - Sonnet         │    │ - Convert to MD  │
│ - Extended       │    │ - Extract info   │
│   Thinking       │    │                  │
└──────────────────┘    └──────────────────┘
        │
        │ Response
        ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │  conversations table                              │ │
│  │  - id, user_id, project_id, created_at            │ │
│  │                                                    │ │
│  │  conversation_messages table                      │ │
│  │  - id, conversation_id, role, content, model      │ │
│  │  - tokens_used, cost_usd, created_at              │ │
│  │                                                    │ │
│  │  acquisition_flows table                          │ │
│  │  - id, service_name, steps_json, created_by_ai    │ │
│  │  - last_validated, success_rate                   │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Input:** User types message in chat interface
2. **Frontend Processing:** React component captures input, sends to API
3. **API Call:** POST to `/api/ai/chat` with message and conversation ID
4. **Context Retrieval:** Cloudflare Worker fetches conversation history from Supabase
5. **Model Selection:** Determine which Claude model to use based on query complexity
6. **Research (if needed):** If asking about unfamiliar service, trigger FireCrawl to scrape docs
7. **Prompt Construction:** Build system prompt + conversation history + user message
8. **Claude API Call:** Stream response from Claude API
9. **Response Streaming:** Stream tokens back to frontend in real-time
10. **Persistence:** Save user message and AI response to Supabase
11. **Cost Tracking:** Log tokens used and estimated cost

---

## User Flows

### Flow 1: First-Time API Key Request

**Trigger:** User asks "I need an OpenAI API key"

**Steps:**

1. **User Types Message:**
   - User: "I need an OpenAI API key"
   - Frontend: Displays message in chat, shows "AI is thinking..." indicator

2. **System Determines Intent:**
   - Worker: Parses message, identifies intent (API key acquisition)
   - Worker: Checks if OpenAI acquisition flow exists in cache/database
   - If exists: Use cached flow
   - If not: Trigger FireCrawl to scrape latest OpenAI docs

3. **AI Explains Service:**
   ```
   AI: "OpenAI provides powerful AI models like ChatGPT that you can use in your code.

   What you can do with it:
   - Generate text and content
   - Build chatbots
   - Analyze and summarize text
   - Translate languages
   - Write code

   Pricing:
   - Free: $5 credit when you sign up (about 2,500 ChatGPT messages)
   - After that: Pay-per-use
     - GPT-4: ~$0.03 per 1,000 words input, $0.06 output
     - GPT-3.5: ~$0.002 per 1,000 words (much cheaper)

   Would you like me to show you how to get your API key? I'll guide you step by step."
   ```

4. **User Confirms:**
   - User: "Yes please!"

5. **AI Generates Acquisition Flow:**
   - AI: Creates step-by-step instructions (see Guided Acquisition Flow section)
   - Frontend: Renders flow with progress tracking UI

6. **User Follows Steps:**
   - User clicks through each step
   - Marks steps complete as they go
   - Can ask questions: "What's billing info for?" → AI explains

7. **User Adds Key to Abyrith:**
   - Final step: "Paste your key here to save it securely"
   - User pastes key
   - Client-side encryption happens (see 03-security/security-model.md)
   - Key saved to Abyrith vault

8. **Success Confirmation:**
   ```
   AI: "Perfect! I've securely saved your OpenAI API key.

   What's next:
   - Your key is encrypted - only you can decrypt it
   - You can use it in your RecipeApp project
   - I'll help you track usage and costs
   - I'll remind you when you're approaching limits

   Want me to show you how to use it in your code?"
   ```

**Success Criteria:** User successfully obtains and stores API key within 10 minutes

**Error Cases:**
- **User gets stuck on a step:** Click "Get Help" → AI provides clarification
- **Service documentation changed:** FireCrawl fetches latest, AI adapts instructions
- **User encounters unexpected screen:** User uploads screenshot → AI troubleshoots
- **Cost concerns:** User asks "This seems expensive" → AI compares alternatives

---

### Flow 2: Comparative Research Request

**Trigger:** User asks "What's the best email API for my project?"

**Steps:**

1. **User Asks for Recommendation:**
   - User: "What's the best email API for my project?"

2. **AI Requests Context:**
   ```
   AI: "I can help with that! To give you the best recommendation, tell me a bit about your needs:

   - How many emails per month? (rough estimate)
   - What type of emails? (transactional like receipts, marketing, or both?)
   - Any specific features you need? (templates, analytics, A/B testing?)
   - What's your budget? (free tier, $10/month, $50/month, no limit?)

   Or just tell me about your project and I'll figure it out!"
   ```

3. **User Provides Context:**
   - User: "It's a recipe app. I need to send password resets and weekly recipe emails. Maybe 1,000 emails/month to start. Free would be great."

4. **AI Researches Options:**
   - Worker: Identifies email services (SendGrid, Mailgun, Amazon SES, Resend)
   - Worker: Triggers FireCrawl for each service (parallel requests)
   - FireCrawl: Scrapes pricing pages, docs, feature lists
   - AI: Analyzes data, compares options

5. **AI Provides Comparison:**
   ```
   AI: "Based on your needs (1,000 emails/month, transactional + marketing, free tier),
   here are your best options:

   **1. Resend (Recommended for you)**
   - Free: 3,000 emails/month (you'll stay in free tier!)
   - Modern API, excellent documentation
   - Great for transactional emails
   - Built-in email templates
   - Setup time: 10 minutes
   - Best for: Developers who want simplicity

   **2. SendGrid**
   - Free: 100 emails/day (3,000/month)
   - Industry standard, very reliable
   - Includes marketing features you'll use later
   - Slightly more complex setup
   - Setup time: 20 minutes
   - Best for: If you'll scale to marketing emails

   **3. Amazon SES**
   - Cheapest at scale: $0.10 per 1,000 emails
   - No free tier (but 62,000 free emails first year if you use AWS Lambda)
   - Most reliable infrastructure
   - Requires AWS knowledge
   - Setup time: 30 minutes
   - Best for: If you're already using AWS

   For your use case, I'd go with **Resend** - you'll stay in the free tier, setup is
   quick, and it's perfect for a recipe app.

   Want me to show you how to get a Resend API key?"
   ```

6. **User Chooses:**
   - User: "Yeah, Resend sounds good. Show me how to get it."

7. **AI Generates Flow:**
   - AI: Creates acquisition flow for Resend
   - User: Follows steps, adds key

**Success Criteria:** User makes informed decision and acquires appropriate key

---

### Flow 3: Cost Analysis Request

**Trigger:** User asks "How much is my OpenAI key costing me?"

**Steps:**

1. **User Asks About Costs:**
   - User: "How much is my OpenAI key costing me?"

2. **AI Checks Data Availability:**
   - Worker: Checks if Abyrith has usage tracking for this key
   - If yes: Display actual usage
   - If no: Explain how to enable tracking

3. **AI Provides Analysis:**
   ```
   AI: "Looking at your OpenAI API key for RecipeApp (development):

   **This Month (October):**
   - Requests: 1,247
   - Tokens used: 156,000 (input) + 89,000 (output)
   - Estimated cost: $7.23

   **Breakdown:**
   - GPT-3.5-turbo: $5.12 (71% of costs)
   - GPT-4: $2.11 (29% of costs)

   **Compared to last month:** ⬆️ Up 45% (September: $4.98)

   The increase is from your new recipe generation feature - you're using GPT-4
   more often. Want to reduce costs? I can suggest optimizations:

   1. Use GPT-3.5-turbo for simple recipes (50% cost reduction)
   2. Implement caching for similar requests
   3. Reduce token usage with shorter prompts

   You're still well within the $5 free credit, so no charges yet!

   Want me to show you how to implement cost-saving strategies?"
   ```

4. **User Explores Further:**
   - User: "Yeah, how do I cache responses?"
   - AI: Provides code examples and best practices

**Success Criteria:** User understands their costs and knows how to optimize

---

## Technical Implementation

### Frontend Implementation

**Components:**

**`AiAssistantChat.tsx`** - Main chat interface
```typescript
interface AiAssistantChatProps {
  projectId?: string;
  conversationId?: string;
  onKeyAcquired?: (keyId: string) => void;
}

export function AiAssistantChat({ projectId, conversationId, onKeyAcquired }: AiAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load conversation history on mount
  useEffect(() => {
    if (conversationId) {
      loadConversationHistory(conversationId);
    }
  }, [conversationId]);

  const sendMessage = async (content: string) => {
    // Implementation in API Contracts section
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <MessageInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        isLoading={isLoading}
      />
    </div>
  );
}
```

**`MessageList.tsx`** - Renders conversation history
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4">
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
```

**`AcquisitionFlowRenderer.tsx`** - Displays step-by-step acquisition flows
```typescript
interface AcquisitionFlow {
  serviceName: string;
  steps: AcquisitionStep[];
  estimatedTime: string;
  totalSteps: number;
}

interface AcquisitionStep {
  stepNumber: number;
  title: string;
  instructions: string;
  screenshot?: string;
  checkpoints?: string[];
  estimatedDuration?: string;
}

export function AcquisitionFlowRenderer({ flow }: { flow: AcquisitionFlow }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const markStepComplete = (stepNumber: number) => {
    setCompletedSteps(prev => new Set([...prev, stepNumber]));
    if (stepNumber < flow.totalSteps - 1) {
      setCurrentStep(stepNumber + 1);
    }
  };

  return (
    <div className="acquisition-flow">
      <FlowHeader flow={flow} currentStep={currentStep} completedSteps={completedSteps} />
      <StepContent
        step={flow.steps[currentStep]}
        onComplete={() => markStepComplete(currentStep)}
      />
      <FlowNavigation
        currentStep={currentStep}
        totalSteps={flow.totalSteps}
        onNavigate={setCurrentStep}
      />
    </div>
  );
}
```

**State Management:**
- **Local state:** Current input, loading states, streaming indicator
- **Global state (Zustand):** Active conversation ID, user preferences (model selection)
- **Server state (React Query):** Conversation history, cached acquisition flows

**Key Functions:**
```typescript
// Stream AI response from API
async function streamAiResponse(
  message: string,
  conversationId: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getJWT()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      project_id: getCurrentProjectId()
    })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    onChunk(chunk);
  }
}

// Save message to conversation history
async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString()
    });
}
```

### Backend Implementation

**API Endpoints:**
- `POST /api/ai/chat` - Send message, get AI response (streaming)
- `GET /api/ai/conversations/:id` - Retrieve conversation history
- `POST /api/ai/research` - Trigger FireCrawl research for a service
- `GET /api/ai/flows/:serviceName` - Get cached acquisition flow

**Cloudflare Workers:**

**`ai-conversation-handler.ts`** - Main orchestration worker
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { message, conversation_id, project_id } = await request.json();

    // 1. Authenticate user
    const user = await authenticateRequest(request, env);

    // 2. Retrieve conversation context
    const conversationHistory = await getConversationHistory(conversation_id, env);

    // 3. Determine if research needed
    const needsResearch = await detectResearchIntent(message, conversationHistory);
    let researchContext = null;

    if (needsResearch) {
      const serviceName = extractServiceName(message);
      researchContext = await triggerFireCrawl(serviceName, env);
    }

    // 4. Select appropriate Claude model
    const model = selectClaudeModel(message, conversationHistory);

    // 5. Build prompt
    const prompt = buildPrompt(message, conversationHistory, researchContext, project_id);

    // 6. Call Claude API and stream response
    const stream = await callClaudeAPI(prompt, model, env);

    // 7. Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }
};

// Model selection logic
function selectClaudeModel(message: string, history: Message[]): ClaudeModel {
  // Simple query → Haiku (fast, cheap)
  if (isSimpleQuery(message)) {
    return 'claude-3-5-haiku-20241022';
  }

  // Complex reasoning, planning → Extended Thinking
  if (requiresDeepThinking(message)) {
    return 'claude-3-5-sonnet-20241022'; // with thinking enabled
  }

  // Default: Sonnet (balanced)
  return 'claude-3-5-sonnet-20241022';
}

// Detect if query needs web research
function detectResearchIntent(message: string, history: Message[]): boolean {
  const researchKeywords = [
    'how to get', 'acquire', 'api key for', 'sign up for',
    'pricing for', 'cost of', 'compare', 'difference between',
    'best api for', 'recommend'
  ];

  const lowerMessage = message.toLowerCase();
  return researchKeywords.some(keyword => lowerMessage.includes(keyword));
}
```

### Database Implementation

**Tables Used:**

**`conversations`** - Top-level conversation containers
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT, -- Auto-generated from first message
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_project_id ON conversations(project_id);
```

**`conversation_messages`** - Individual messages
```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT, -- Which Claude model was used (if assistant)
  tokens_input INTEGER, -- Tokens in prompt
  tokens_output INTEGER, -- Tokens in response
  cost_usd DECIMAL(10, 6), -- Estimated cost
  metadata JSONB, -- Additional data (research context, flow references, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON conversation_messages(conversation_id);
```

**`acquisition_flows`** - Cached acquisition flows
```sql
CREATE TABLE acquisition_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT UNIQUE NOT NULL,
  flow_json JSONB NOT NULL, -- Complete acquisition flow
  created_by_ai BOOLEAN DEFAULT true,
  last_validated TIMESTAMPTZ,
  success_rate DECIMAL(5, 2), -- % of users who complete flow
  total_attempts INTEGER DEFAULT 0,
  successful_completions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flows_service_name ON acquisition_flows(service_name);
```

**Key Queries:**
```sql
-- Retrieve conversation with last 10 messages
SELECT
  c.id,
  c.title,
  json_agg(
    json_build_object(
      'id', m.id,
      'role', m.role,
      'content', m.content,
      'created_at', m.created_at
    ) ORDER BY m.created_at DESC
  ) FILTER (WHERE m.id IS NOT NULL) as messages
FROM conversations c
LEFT JOIN LATERAL (
  SELECT * FROM conversation_messages
  WHERE conversation_id = c.id
  ORDER BY created_at DESC
  LIMIT 10
) m ON true
WHERE c.id = $1
GROUP BY c.id;

-- Get total AI costs for user this month
SELECT
  SUM(cost_usd) as total_cost,
  COUNT(*) as message_count,
  SUM(tokens_input + tokens_output) as total_tokens
FROM conversation_messages
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE user_id = $1
)
AND created_at >= date_trunc('month', CURRENT_DATE);
```

**RLS Policies:**
```sql
-- Users can only access their own conversations
CREATE POLICY "Users can access own conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only access messages in their conversations
CREATE POLICY "Users can access own messages"
  ON conversation_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );
```

---

## Claude API Integration

### API Configuration

**Models Used:**

1. **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`)
   - **Use for:** Simple queries, quick responses, FAQ-style questions
   - **Characteristics:** Fast (< 1s response), cheap ($0.25 per 1M tokens)
   - **Examples:** "What is an API key?", "How much does OpenAI cost?"

2. **Claude 3.5 Sonnet** (`claude-3-5-sonnet-20241022`)
   - **Use for:** Most conversations, acquisition flow generation, comparisons
   - **Characteristics:** Balanced speed and quality, standard pricing
   - **Examples:** "Show me how to get Stripe key", "Compare email APIs"

3. **Claude 3.5 Sonnet Extended Thinking** (Sonnet with thinking enabled)
   - **Use for:** Complex planning, multi-service comparisons, cost optimization
   - **Characteristics:** Slower but higher quality reasoning
   - **Examples:** "Build me a cost-optimized architecture", "Debug my API integration"

### Authentication

**API Key Storage:**
```typescript
// In Cloudflare Workers environment variables
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

// API call headers
const headers = {
  'x-api-key': ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json'
};
```

### Request Format

```typescript
interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
  temperature?: number;
  stream?: boolean;
}

interface ClaudeMessage {
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

// Example: Simple query (Haiku)
const simpleRequest: ClaudeRequest = {
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: 'What is an API key?'
    }
  ],
  system: SYSTEM_PROMPT,
  temperature: 0.7,
  stream: true
};

// Example: Acquisition flow generation (Sonnet)
const flowRequest: ClaudeRequest = {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  messages: conversationHistory.concat([
    {
      role: 'user',
      content: 'Show me how to get an OpenAI API key step by step'
    }
  ]),
  system: ACQUISITION_FLOW_SYSTEM_PROMPT,
  temperature: 0.5, // Lower temperature for more consistent steps
  stream: true
};
```

### Streaming Responses

```typescript
async function callClaudeAPI(
  prompt: ClaudeRequest,
  env: Env
): Promise<ReadableStream> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(prompt)
  });

  // Transform Claude's SSE stream to our format
  return response.body!
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new ClaudeStreamTransformer());
}

class ClaudeStreamTransformer extends TransformStream {
  constructor() {
    let buffer = '';

    super({
      transform(chunk, controller) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'content_block_delta') {
              controller.enqueue(data.delta.text);
            }

            if (data.type === 'message_stop') {
              // Log usage for cost tracking
              controller.enqueue(`\n\n[USAGE: ${JSON.stringify(data.usage)}]`);
            }
          }
        }
      }
    });
  }
}
```

### Error Handling

```typescript
async function callClaudeWithRetry(
  prompt: ClaudeRequest,
  env: Env,
  maxRetries: number = 3
): Promise<ReadableStream> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify(prompt)
      });

      if (response.ok) {
        return response.body!;
      }

      // Handle specific error codes
      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (response.status === 529) {
        // Overloaded - exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }

      // Non-retriable error
      throw new Error(`Claude API error: ${response.status} ${await response.text()}`);

    } catch (error) {
      if (attempt === maxRetries) throw error;
      // Exponential backoff for network errors
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## FireCrawl Integration

### Purpose

FireCrawl is used to scrape and convert API documentation websites into AI-readable markdown format. This enables real-time research for any API service, ensuring Abyrith can provide up-to-date acquisition instructions even for services it hasn't seen before.

### API Configuration

**FireCrawl API Endpoint:** `https://api.firecrawl.dev/v0`

**Authentication:**
```typescript
const FIRECRAWL_API_KEY = env.FIRECRAWL_API_KEY;

const headers = {
  'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
  'Content-Type': 'application/json'
};
```

### Use Cases

1. **Scrape API Documentation Pages:**
   - Target: Pricing pages, getting started guides, API reference docs
   - Output: Clean markdown with structured content

2. **Extract Key Information:**
   - Pricing tiers and costs
   - API key acquisition steps
   - Rate limits and quotas
   - Required credentials (credit card, phone number, etc.)

3. **Stay Up-to-Date:**
   - Services change their signup flows frequently
   - FireCrawl ensures we always have latest instructions
   - No manual documentation maintenance needed

### Request Format

```typescript
interface FireCrawlRequest {
  url: string;
  pageOptions?: {
    onlyMainContent?: boolean;
    includeHtml?: boolean;
    screenshot?: boolean;
  };
  extractorOptions?: {
    mode: 'llm-extraction';
    extractionPrompt: string;
  };
}

// Example: Scrape OpenAI pricing page
const pricingRequest: FireCrawlRequest = {
  url: 'https://openai.com/pricing',
  pageOptions: {
    onlyMainContent: true,
    includeHtml: false,
    screenshot: false
  },
  extractorOptions: {
    mode: 'llm-extraction',
    extractionPrompt: `Extract the following information about API pricing:
      - Model names and their pricing per token
      - Free tier details (if any)
      - Rate limits
      - Required payment methods
      - Any additional fees

      Format as structured JSON.`
  }
};

// Example: Scrape API key acquisition guide
const guideRequest: FireCrawlRequest = {
  url: 'https://platform.openai.com/docs/quickstart',
  pageOptions: {
    onlyMainContent: true,
    screenshot: true // Get screenshots of key steps
  }
};
```

### Implementation

```typescript
async function scrapeServiceDocs(
  serviceName: string,
  env: Env
): Promise<ScrapedServiceData> {
  // Determine which URLs to scrape based on service
  const urls = getServiceUrls(serviceName);

  // Scrape pricing page
  const pricingData = await scrapeUrl(urls.pricing, {
    extractorOptions: {
      mode: 'llm-extraction',
      extractionPrompt: PRICING_EXTRACTION_PROMPT
    }
  }, env);

  // Scrape getting started guide
  const guideData = await scrapeUrl(urls.gettingStarted, {
    pageOptions: {
      onlyMainContent: true,
      screenshot: true
    }
  }, env);

  // Scrape API reference (for understanding what the API does)
  const apiRefData = await scrapeUrl(urls.apiReference, {
    pageOptions: {
      onlyMainContent: true
    }
  }, env);

  return {
    serviceName,
    pricing: pricingData,
    gettingStarted: guideData,
    apiReference: apiRefData,
    scrapedAt: new Date().toISOString()
  };
}

async function scrapeUrl(
  url: string,
  options: FireCrawlRequest['pageOptions'] & { extractorOptions?: any },
  env: Env
): Promise<any> {
  const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      pageOptions: options.pageOptions,
      extractorOptions: options.extractorOptions
    })
  });

  if (!response.ok) {
    throw new Error(`FireCrawl error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Service URL mapping
function getServiceUrls(serviceName: string): ServiceUrls {
  const urlMap: Record<string, ServiceUrls> = {
    'openai': {
      pricing: 'https://openai.com/pricing',
      gettingStarted: 'https://platform.openai.com/docs/quickstart',
      apiReference: 'https://platform.openai.com/docs/api-reference'
    },
    'stripe': {
      pricing: 'https://stripe.com/pricing',
      gettingStarted: 'https://stripe.com/docs/development/quickstart',
      apiReference: 'https://stripe.com/docs/api'
    },
    // Add more services as needed
  };

  return urlMap[serviceName.toLowerCase()] || {
    // Fallback: attempt to find docs with Google search
    pricing: `https://www.google.com/search?q=${serviceName}+api+pricing`,
    gettingStarted: `https://www.google.com/search?q=${serviceName}+api+getting+started`,
    apiReference: `https://www.google.com/search?q=${serviceName}+api+documentation`
  };
}
```

### Caching Strategy

```typescript
// Cache scraped data for 24 hours to reduce FireCrawl API costs
async function getCachedServiceData(
  serviceName: string,
  env: Env
): Promise<ScrapedServiceData | null> {
  const cacheKey = `firecrawl:${serviceName}`;
  const cached = await env.KV.get(cacheKey, 'json');

  if (cached && cached.scrapedAt) {
    const age = Date.now() - new Date(cached.scrapedAt).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age < maxAge) {
      return cached;
    }
  }

  return null;
}

async function cacheServiceData(
  serviceName: string,
  data: ScrapedServiceData,
  env: Env
): Promise<void> {
  const cacheKey = `firecrawl:${serviceName}`;
  await env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: 24 * 60 * 60 // 24 hours
  });
}
```

### Cost Management

**FireCrawl Pricing:**
- Free tier: 500 credits/month
- Each scrape: ~1-5 credits depending on page complexity
- Screenshots: +2 credits
- LLM extraction: +5 credits

**Strategy:**
- Cache aggressively (24 hours)
- Scrape only when user explicitly requests new service
- Prioritize scraping for unknown services
- Use cached flows for popular services (OpenAI, Stripe, etc.)
- Monitor usage with alerts at 80% of monthly limit

---

## Conversation Management

### Context Retention

**How Conversations Work:**

1. **New Conversation:** User starts chat → Create conversation record
2. **Context Window:** Include last 10 messages for context
3. **Summarization:** After 20 messages, summarize early conversation
4. **Project Context:** Include project name and existing keys in system prompt

**Example Context Building:**

```typescript
async function buildConversationContext(
  conversationId: string,
  projectId: string | null,
  env: Env
): Promise<string> {
  // Get last 10 messages
  const messages = await getRecentMessages(conversationId, 10);

  // Get project context if available
  let projectContext = '';
  if (projectId) {
    const project = await getProject(projectId);
    const existingKeys = await getProjectKeys(projectId);

    projectContext = `
User's current project: ${project.name}
Existing API keys in this project:
${existingKeys.map(k => `- ${k.service_name} (${k.environment})`).join('\n')}
`;
  }

  // Build context
  const conversationHistory = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  return `
${projectContext}

Conversation history:
${conversationHistory}
`;
}
```

### Conversation Persistence

```typescript
// Save user message
async function saveUserMessage(
  conversationId: string,
  content: string,
  env: Env
): Promise<string> {
  const { data, error } = await supabaseClient(env)
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

// Save AI response with usage tracking
async function saveAssistantMessage(
  conversationId: string,
  content: string,
  model: string,
  usage: ClaudeUsage,
  env: Env
): Promise<string> {
  const cost = calculateCost(model, usage);

  const { data, error } = await supabaseClient(env)
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content,
      model,
      tokens_input: usage.input_tokens,
      tokens_output: usage.output_tokens,
      cost_usd: cost
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

// Calculate cost based on model and usage
function calculateCost(model: string, usage: ClaudeUsage): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-5-haiku-20241022': {
      input: 0.25 / 1_000_000,  // $0.25 per 1M tokens
      output: 1.25 / 1_000_000   // $1.25 per 1M tokens
    },
    'claude-3-5-sonnet-20241022': {
      input: 3.00 / 1_000_000,   // $3.00 per 1M tokens
      output: 15.00 / 1_000_000  // $15.00 per 1M tokens
    }
  };

  const modelPricing = pricing[model] || pricing['claude-3-5-sonnet-20241022'];

  return (
    (usage.input_tokens * modelPricing.input) +
    (usage.output_tokens * modelPricing.output)
  );
}
```

### Conversation Lifecycle

```typescript
// Create new conversation
async function createConversation(
  userId: string,
  projectId: string | null,
  firstMessage: string,
  env: Env
): Promise<string> {
  // Generate title from first message
  const title = await generateConversationTitle(firstMessage, env);

  const { data, error } = await supabaseClient(env)
    .from('conversations')
    .insert({
      user_id: userId,
      project_id: projectId,
      title
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

// Generate conversation title using Claude Haiku (fast + cheap)
async function generateConversationTitle(
  firstMessage: string,
  env: Env
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Generate a short (3-5 word) title for this conversation: "${firstMessage}"`
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text.trim();
}

// Delete conversation and all messages
async function deleteConversation(
  conversationId: string,
  env: Env
): Promise<void> {
  // RLS and CASCADE will handle permissions and cleanup
  await supabaseClient(env)
    .from('conversations')
    .delete()
    .eq('id', conversationId);
}
```

---

## Guided Acquisition Flow Generation

### Flow Structure

```typescript
interface AcquisitionFlow {
  serviceName: string;
  serviceDescription: string;
  estimatedTime: string; // "10 minutes", "30 minutes"
  difficulty: 'easy' | 'medium' | 'hard';
  requirements: string[]; // ["Email address", "Credit card", "Phone number"]
  pricing: {
    freeTier: string | null;
    paidTiers: PricingTier[];
  };
  steps: AcquisitionStep[];
  warnings: string[]; // ["Requires credit card even for free tier"]
  tips: string[]; // ["Use a password manager for this"]
}

interface AcquisitionStep {
  stepNumber: number;
  title: string;
  instructions: string; // Markdown formatted
  screenshot?: string; // URL or base64
  checkpoints: string[]; // Things user should verify
  estimatedDuration: string; // "2 minutes", "30 seconds"
  commonIssues: CommonIssue[];
}

interface CommonIssue {
  problem: string;
  solution: string;
}

interface PricingTier {
  name: string;
  price: string;
  features: string[];
  limits: string[];
}
```

### Flow Generation Process

```typescript
async function generateAcquisitionFlow(
  serviceName: string,
  userMessage: string,
  env: Env
): Promise<AcquisitionFlow> {
  // 1. Check if flow exists in cache
  const cached = await getCachedFlow(serviceName, env);
  if (cached && cached.last_validated > Date.now() - 7 * 24 * 60 * 60 * 1000) {
    // Use cached if validated within last 7 days
    return cached.flow_json;
  }

  // 2. Scrape latest documentation
  const scrapedData = await getCachedServiceData(serviceName, env) ||
                      await scrapeServiceDocs(serviceName, env);

  // 3. Generate flow using Claude Sonnet
  const flow = await claudeGenerateFlow(serviceName, scrapedData, env);

  // 4. Cache the generated flow
  await cacheAcquisitionFlow(serviceName, flow, env);

  return flow;
}

async function claudeGenerateFlow(
  serviceName: string,
  scrapedData: ScrapedServiceData,
  env: Env
): Promise<AcquisitionFlow> {
  const prompt = `
You are helping a user acquire an API key for ${serviceName}.

I've scraped the latest documentation from their website:

PRICING PAGE:
${scrapedData.pricing}

GETTING STARTED GUIDE:
${scrapedData.gettingStarted}

API REFERENCE:
${scrapedData.apiReference}

Generate a detailed, step-by-step acquisition flow in JSON format.
Make instructions "5-year-old simple" - assume the user has never done this before.

Requirements:
1. Break into 5-10 clear steps
2. Each step should take less than 5 minutes
3. Include checkpoints to verify progress
4. Warn about common issues (credit card required, email verification, etc.)
5. Extract accurate pricing information
6. Estimate total time realistically
7. Use markdown formatting for instructions

Format as JSON matching the AcquisitionFlow interface.
`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      temperature: 0.3, // Low temperature for consistency
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const flowJson = extractJsonFromResponse(data.content[0].text);

  return JSON.parse(flowJson);
}

// Extract JSON from Claude's response (may have explanation text)
function extractJsonFromResponse(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }
  return jsonMatch[0];
}
```

### Example Generated Flow

```json
{
  "serviceName": "OpenAI",
  "serviceDescription": "OpenAI provides AI models like ChatGPT that you can use in your applications for text generation, analysis, and conversation.",
  "estimatedTime": "10 minutes",
  "difficulty": "easy",
  "requirements": [
    "Email address",
    "Phone number (for verification)",
    "Credit card (even for free tier)"
  ],
  "pricing": {
    "freeTier": "$5 credit when you sign up (about 2,500 ChatGPT messages)",
    "paidTiers": [
      {
        "name": "Pay as you go",
        "price": "Per token",
        "features": [
          "GPT-4: $0.03 per 1K input tokens, $0.06 per 1K output tokens",
          "GPT-3.5-turbo: $0.002 per 1K tokens (much cheaper)",
          "No monthly commitment"
        ],
        "limits": ["Rate limits based on tier"]
      }
    ]
  },
  "steps": [
    {
      "stepNumber": 1,
      "title": "Create OpenAI Account",
      "instructions": "Go to [platform.openai.com/signup](https://platform.openai.com/signup)\n\nYou'll see a sign-up form. You can:\n- Sign up with Google (faster)\n- Sign up with email and password\n\nClick your preferred option and complete the form.",
      "screenshot": "https://screenshots.abyrith.com/openai-signup.png",
      "checkpoints": [
        "You received a verification email",
        "You can log in to platform.openai.com"
      ],
      "estimatedDuration": "2 minutes",
      "commonIssues": [
        {
          "problem": "Email verification isn't arriving",
          "solution": "Check spam folder. Wait 5 minutes. Try resending from the login page."
        }
      ]
    },
    {
      "stepNumber": 2,
      "title": "Verify Phone Number",
      "instructions": "OpenAI requires a phone number for security.\n\n1. You'll be prompted immediately after signing up\n2. Enter your phone number\n3. Wait for SMS code (usually arrives in 30 seconds)\n4. Enter the 6-digit code\n\n⚠️ **Important:** Use a real phone number. Virtual numbers (like Google Voice) won't work.",
      "checkpoints": [
        "You received the SMS code",
        "You successfully entered the code",
        "You're now on the OpenAI dashboard"
      ],
      "estimatedDuration": "2 minutes",
      "commonIssues": [
        {
          "problem": "Virtual phone number rejected",
          "solution": "Use your personal mobile number. Virtual numbers from Google Voice or TextNow won't work."
        },
        {
          "problem": "SMS not arriving",
          "solution": "Wait 2 minutes. Try resending. Check if your carrier is blocking short codes."
        }
      ]
    },
    {
      "stepNumber": 3,
      "title": "Add Billing Information",
      "instructions": "Even though you get $5 free credit, OpenAI requires a credit card on file.\n\n1. Click **\"Billing\"** in the left sidebar\n2. Click **\"Add payment method\"**\n3. Enter your credit card details\n4. Click **\"Add card\"**\n\n💡 **Good to know:**\n- You won't be charged until you use all $5 free credit\n- You can set spending limits to avoid surprise bills\n- You can remove the card later if you decide not to use OpenAI",
      "checkpoints": [
        "Your card is showing as added",
        "You see \"$5.00 credit available\" on the billing page"
      ],
      "estimatedDuration": "2 minutes",
      "commonIssues": [
        {
          "problem": "Don't want to add credit card",
          "solution": "Unfortunately, OpenAI requires this even for free tier. Consider using a privacy.com virtual card or Stripe test keys if just learning."
        }
      ]
    },
    {
      "stepNumber": 4,
      "title": "Create API Key",
      "instructions": "Now you're ready to create your API key!\n\n1. Click **\"API keys\"** in the left sidebar\n2. Click **\"Create new secret key\"**\n3. (Optional) Give it a name like \"RecipeApp development\"\n4. Click **\"Create secret key\"**\n5. **IMPORTANT:** Copy the key immediately - you'll only see it once!\n\n⚠️ **Don't lose this!** If you close the window without copying, you'll need to create a new key.",
      "screenshot": "https://screenshots.abyrith.com/openai-create-key.png",
      "checkpoints": [
        "You copied the API key",
        "The key starts with 'sk-'",
        "You see it in your API keys list"
      ],
      "estimatedDuration": "1 minute",
      "commonIssues": [
        {
          "problem": "Closed window without copying key",
          "solution": "Delete that key and create a new one. That's why naming keys is helpful."
        }
      ]
    },
    {
      "stepNumber": 5,
      "title": "Save Key to Abyrith",
      "instructions": "Let's save your key securely!\n\n1. Paste the key you just copied in the field below\n2. Choose which project this is for (or create a new one)\n3. Choose environment (probably \"Development\" for now)\n4. Click **\"Save securely\"**\n\nAbyrith will encrypt this key before storing it. Only you can decrypt it with your master password.\n\n✅ **You're done!** You can now use OpenAI's API in your project.",
      "checkpoints": [
        "Key is saved in Abyrith",
        "You can see it in your project's secrets list"
      ],
      "estimatedDuration": "1 minute",
      "commonIssues": []
    }
  ],
  "warnings": [
    "Credit card required even for free tier",
    "Phone verification required (no virtual numbers)",
    "API keys are shown only once when created"
  ],
  "tips": [
    "Set usage limits in billing to avoid surprise charges",
    "Start with GPT-3.5-turbo - it's much cheaper while learning",
    "Use separate keys for development and production",
    "Rotate your keys every 90 days for security"
  ]
}
```

---

## Prompt Engineering

### System Prompts

**Base System Prompt (All Models):**

```
You are the AI Secret Assistant for Abyrith, a secrets management platform. Your role is to help users understand, acquire, and manage API keys and developer secrets.

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

Remember: Users range from complete beginners to experienced developers. Adjust your communication style based on their questions and responses.
```

**Acquisition Flow System Prompt (Sonnet only):**

```
You are generating a step-by-step API key acquisition flow. This flow will guide a user who may have NEVER acquired an API key before.

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
}
```

**Cost Analysis System Prompt:**

```
You are analyzing API usage and costs for the user. Be precise, honest, and educational.

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
- Use currency symbols correctly ($, €, £)
```

### Dynamic Prompt Construction

```typescript
function buildDynamicPrompt(
  baseSystemPrompt: string,
  conversationHistory: Message[],
  currentMessage: string,
  additionalContext: {
    projectName?: string;
    existingKeys?: string[];
    researchData?: ScrapedServiceData;
  }
): ClaudeRequest {
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
  const fullSystemPrompt = baseSystemPrompt + '\n' + contextSection;

  // Build messages array
  const messages: ClaudeMessage[] = conversationHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // Add current message
  messages.push({
    role: 'user',
    content: currentMessage
  });

  return {
    model: selectModel(currentMessage, conversationHistory),
    max_tokens: 4096,
    system: fullSystemPrompt,
    messages,
    temperature: 0.7
  };
}
```

---

## Model Selection Logic

### Decision Tree

```typescript
function selectClaudeModel(
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
    return 'claude-3-5-sonnet-20241022'; // Enable extended thinking
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
- **Best for:** Simple Q&A, definitions, quick lookups
- **Speed:** ~1s response time
- **Cost:** $0.25 / 1M input tokens, $1.25 / 1M output tokens
- **Max output:** 4,096 tokens
- **Use when:** User asks straightforward question, no acquisition flow needed

**Sonnet - Balanced:**
- **Best for:** Most conversations, acquisition flows, comparisons
- **Speed:** ~3-5s response time
- **Cost:** $3.00 / 1M input tokens, $15.00 / 1M output tokens
- **Max output:** 8,192 tokens
- **Use when:** Default choice, generating flows, moderate complexity

**Sonnet Extended Thinking - Deep Reasoning:**
- **Best for:** Complex planning, architecture decisions, optimization
- **Speed:** ~10-20s response time (includes thinking time)
- **Cost:** Same as Sonnet + thinking tokens
- **Max output:** 8,192 tokens
- **Use when:** User needs detailed analysis, comparing many options, debugging complex issues

### Cost Optimization

```typescript
// Track costs per conversation
async function trackConversationCost(
  conversationId: string,
  env: Env
): Promise<ConversationCostSummary> {
  const { data } = await supabaseClient(env)
    .from('conversation_messages')
    .select('model, tokens_input, tokens_output, cost_usd')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant');

  const summary: ConversationCostSummary = {
    totalCost: 0,
    totalTokens: 0,
    messageCount: 0,
    byModel: {}
  };

  for (const message of data || []) {
    summary.totalCost += message.cost_usd;
    summary.totalTokens += message.tokens_input + message.tokens_output;
    summary.messageCount += 1;

    if (!summary.byModel[message.model]) {
      summary.byModel[message.model] = {
        count: 0,
        cost: 0,
        tokens: 0
      };
    }

    summary.byModel[message.model].count += 1;
    summary.byModel[message.model].cost += message.cost_usd;
    summary.byModel[message.model].tokens += message.tokens_input + message.tokens_output;
  }

  return summary;
}

// Suggest model downgrade if appropriate
function suggestModelOptimization(history: Message[]): string | null {
  // If last 5 messages were all simple Q&A but used Sonnet
  const recentMessages = history.slice(-5);
  const allSimple = recentMessages.every(m =>
    m.role === 'user' && m.content.length < 100
  );

  const usedExpensiveModel = recentMessages.some(m =>
    m.model === 'claude-3-5-sonnet-20241022'
  );

  if (allSimple && usedExpensiveModel) {
    return "💡 Tip: These questions could use Haiku (faster + cheaper). Want me to switch?";
  }

  return null;
}
```

---

## Cost Estimation & Usage Tracking

### Token Usage Tracking

```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  costUsd: number;
}

// Parse usage from Claude API response
function parseClaudeUsage(response: ClaudeResponse): TokenUsage {
  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    model: response.model,
    costUsd: calculateCost(response.model, response.usage)
  };
}

// Log usage to database
async function logTokenUsage(
  messageId: string,
  usage: TokenUsage,
  env: Env
): Promise<void> {
  await supabaseClient(env)
    .from('conversation_messages')
    .update({
      model: usage.model,
      tokens_input: usage.inputTokens,
      tokens_output: usage.outputTokens,
      cost_usd: usage.costUsd
    })
    .eq('id', messageId);
}
```

### Cost Dashboard

```typescript
// Get user's total AI costs
async function getUserAiCosts(
  userId: string,
  period: 'day' | 'week' | 'month' | 'all',
  env: Env
): Promise<UserAiCostSummary> {
  const startDate = getStartDate(period);

  const { data } = await supabaseClient(env)
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
    timeline: groupByDay(data)
  };
}

function getStartDate(period: string): string {
  const now = new Date();

  switch (period) {
    case 'day':
      return new Date(now.setDate(now.getDate() - 1)).toISOString();
    case 'week':
      return new Date(now.setDate(now.getDate() - 7)).toISOString();
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
    default:
      return new Date(0).toISOString();
  }
}
```

### Budget Alerts

```typescript
// Check if user is approaching budget limit
async function checkBudgetLimit(
  userId: string,
  env: Env
): Promise<BudgetAlert | null> {
  const userSettings = await getUserSettings(userId, env);
  const monthlyBudget = userSettings.ai_monthly_budget_usd;

  if (!monthlyBudget) return null;

  const costs = await getUserAiCosts(userId, 'month', env);
  const percentUsed = (costs.totalCost / monthlyBudget) * 100;

  if (percentUsed >= 90) {
    return {
      level: 'critical',
      message: `⚠️ You've used ${percentUsed.toFixed(0)}% of your monthly AI budget ($${costs.totalCost.toFixed(2)} / $${monthlyBudget})`,
      recommendation: 'Consider upgrading your budget or using Haiku for simple queries.'
    };
  }

  if (percentUsed >= 75) {
    return {
      level: 'warning',
      message: `You've used ${percentUsed.toFixed(0)}% of your monthly AI budget ($${costs.totalCost.toFixed(2)} / $${monthlyBudget})`,
      recommendation: 'You may want to monitor your usage more closely.'
    };
  }

  return null;
}

// Send budget alert to user
async function sendBudgetAlert(
  userId: string,
  alert: BudgetAlert,
  env: Env
): Promise<void> {
  // In-app notification
  await createNotification(userId, {
    type: 'budget_alert',
    level: alert.level,
    message: alert.message,
    actionUrl: '/settings/ai-budget'
  }, env);

  // Email notification if critical
  if (alert.level === 'critical') {
    await sendEmail(userId, {
      subject: 'AI Budget Alert - 90% Used',
      body: alert.message + '\n\n' + alert.recommendation
    }, env);
  }
}
```

---

## API Contracts

### POST /api/ai/chat

**Purpose:** Send a message to the AI assistant and receive streaming response

**Request:**
```typescript
interface ChatRequest {
  message: string;              // User's message
  conversation_id?: string;     // Resume existing conversation (optional)
  project_id?: string;          // Project context (optional)
  force_model?: 'haiku' | 'sonnet' | 'extended';  // Override model selection
}
```

**Example Request:**
```json
POST /api/ai/chat
{
  "message": "I need an OpenAI API key",
  "project_id": "uuid-project-123",
  "conversation_id": "uuid-conv-456"
}
```

**Success Response (200 OK - Streaming):**
```
Content-Type: text/event-stream

data: {"type":"start","conversation_id":"uuid-conv-456"}

data: {"type":"chunk","content":"I can help you get an OpenAI API key! "}

data: {"type":"chunk","content":"OpenAI provides powerful AI models"}

data: {"type":"chunk","content":" like ChatGPT that you can use in your code."}

data: {"type":"complete","usage":{"input_tokens":150,"output_tokens":45,"cost_usd":0.000675}}
```

**Error Responses:**
- `400 Bad Request` - Invalid message format
  ```json
  {
    "error": "validation_error",
    "message": "Message is required"
  }
  ```
- `401 Unauthorized` - Invalid or missing JWT
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Claude API error or server error

---

### GET /api/ai/conversations/:id

**Purpose:** Retrieve conversation history

**Path Parameters:**
- `id` (string, required) - Conversation ID (UUID)

**Success Response (200 OK):**
```typescript
interface ConversationResponse {
  id: string;
  title: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
  cost_summary: {
    total_cost_usd: number;
    total_tokens: number;
    message_count: number;
  };
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  model?: string;
  tokens?: number;
  cost_usd?: number;
}
```

**Example Response:**
```json
{
  "id": "uuid-conv-456",
  "title": "Getting OpenAI API Key",
  "project_id": "uuid-project-123",
  "created_at": "2025-10-30T10:00:00Z",
  "updated_at": "2025-10-30T10:15:00Z",
  "messages": [
    {
      "id": "uuid-msg-1",
      "role": "user",
      "content": "I need an OpenAI API key",
      "created_at": "2025-10-30T10:00:00Z"
    },
    {
      "id": "uuid-msg-2",
      "role": "assistant",
      "content": "I can help you get an OpenAI API key! [...]",
      "created_at": "2025-10-30T10:00:05Z",
      "model": "claude-3-5-sonnet-20241022",
      "tokens": 195,
      "cost_usd": 0.000675
    }
  ],
  "cost_summary": {
    "total_cost_usd": 0.000675,
    "total_tokens": 195,
    "message_count": 1
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - User doesn't own this conversation
- `404 Not Found` - Conversation doesn't exist

---

### POST /api/ai/research

**Purpose:** Trigger FireCrawl research for a specific service

**Request:**
```typescript
interface ResearchRequest {
  service_name: string;         // Service to research
  force_refresh?: boolean;      // Bypass cache (default: false)
}
```

**Example Request:**
```json
POST /api/ai/research
{
  "service_name": "stripe",
  "force_refresh": false
}
```

**Success Response (200 OK):**
```typescript
interface ResearchResponse {
  service_name: string;
  pricing: string;              // Scraped pricing info
  getting_started: string;      // Scraped guide
  api_reference: string;        // Scraped API docs
  scraped_at: string;           // When scraped
  cached: boolean;              // From cache or fresh scrape
}
```

**Error Responses:**
- `400 Bad Request` - Invalid service name
- `429 Too Many Requests` - FireCrawl rate limit exceeded
- `500 Internal Server Error` - Scraping failed

---

### GET /api/ai/flows/:serviceName

**Purpose:** Get cached acquisition flow for a service

**Path Parameters:**
- `serviceName` (string, required) - Service name (e.g., "openai", "stripe")

**Success Response (200 OK):**
```typescript
{
  "flow": AcquisitionFlow,      // Complete flow object
  "cached": true,
  "last_validated": "2025-10-25T00:00:00Z",
  "success_rate": 94.5
}
```

**Error Responses:**
- `404 Not Found` - No cached flow for this service (will trigger generation)

---

## Security Considerations

### Threat Model

**Threat 1: AI Prompt Injection**
- **Description:** Malicious user tries to manipulate AI into revealing secrets or bypassing restrictions
- **Likelihood:** Medium
- **Impact:** Low (AI can't access encrypted secrets)
- **Mitigation:**
  - System prompts clearly define AI's limitations
  - AI has no access to encrypted secret values
  - AI can only see metadata (service names, tags)
  - All AI responses logged for abuse detection

**Threat 2: Cost Abuse**
- **Description:** User spams AI with expensive queries to rack up costs
- **Likelihood:** Medium
- **Impact:** Medium (financial cost to Abyrith)
- **Mitigation:**
  - Rate limiting: 60 messages per hour per user
  - Monthly budget limits per user account
  - Automatic model downgrade for simple queries
  - Monitor and flag users with suspicious patterns
  - Require credit card for unlimited usage

**Threat 3: Sensitive Information Leakage**
- **Description:** User accidentally pastes API key in chat, AI response includes it
- **Likelihood:** Low
- **Impact:** High (key exposure)
- **Mitigation:**
  - Client-side detection of pasted keys (pattern matching)
  - Warning if user pastes something that looks like a key
  - Server-side filtering of obvious secrets in saved conversations
  - Conversations encrypted in database
  - Users can delete conversations anytime

### Security Controls

**Authentication:**
- All API requests require valid JWT token
- JWTs issued by Supabase Auth with 15-minute expiration
- Refresh tokens used for session extension

**Authorization:**
- Users can only access their own conversations
- Row-Level Security enforces conversation ownership
- Project context limited to user's accessible projects

**Data Protection:**
- Conversation messages encrypted at rest in database
- No secret values ever sent to Claude API
- Only metadata (service names, project names) sent for context
- TLS 1.3 for all network communication

**Audit Logging:**
- All AI conversations logged with user_id, timestamps
- Token usage and costs tracked per message
- Suspicious patterns flagged for review

### Compliance

**GDPR:**
- Users can export all their conversations (JSON format)
- Users can delete conversations anytime
- Conversation data included in account deletion

**SOC 2:**
- Audit trail of all AI interactions
- Cost tracking for financial controls
- Access controls via RLS

---

## Performance Requirements

### Performance Targets

**Latency:**
- **Initial response:** < 2s (time to first token)
- **Streaming:** 20-50 tokens/second
- **Simple query (Haiku):** < 1s total response time
- **Complex query (Sonnet):** < 5s total response time
- **Conversation load:** < 500ms

**Throughput:**
- **Concurrent conversations:** 100+ per Worker instance
- **Messages per second:** 50+ across all users
- **FireCrawl requests:** 10/minute (respecting rate limits)

### Optimization Strategy

**Frontend:**
- Optimistic UI updates (show user message immediately)
- Streaming response rendering (show tokens as they arrive)
- Message caching (React Query)
- Lazy load conversation history
- Code block syntax highlighting only when scrolled into view

**Backend:**
- Edge deployment (Cloudflare Workers in 275+ cities)
- Parallel FireCrawl requests when researching multiple URLs
- Cache acquisition flows for 7 days
- Cache scraped documentation for 24 hours
- Connection pooling for Supabase queries

**Database:**
- Indexes on conversation_id, user_id, created_at
- Limit conversation history queries to last 20 messages
- Archive old conversations (> 90 days) to cold storage

---

## Testing Strategy

### Unit Tests

**Frontend:**
- Message rendering (user vs. assistant)
- Code block syntax highlighting
- Markdown parsing
- Stream handling
- Error states

**Backend:**
- Model selection logic
- Cost calculation
- Prompt construction
- FireCrawl data parsing
- Flow generation

**Coverage Target:** 80%

### Integration Tests

**Test Scenarios:**
1. Complete conversation flow (user message → AI response → save)
2. Acquisition flow generation (research → generate → cache)
3. Cost tracking (message → usage tracking → budget check)
4. Error handling (Claude API failure → retry → fallback)

### End-to-End Tests (Playwright)

**E2E Flows:**
1. **New user first conversation:**
   - Open AI assistant
   - Type message
   - Receive streaming response
   - Conversation saved

2. **Acquisition flow completion:**
   - Ask for API key
   - Receive step-by-step flow
   - Mark steps complete
   - Add key to Abyrith

3. **Cost dashboard:**
   - View conversation costs
   - See token usage breakdown
   - Check budget status

### Performance Tests

- Load test: 100 concurrent conversations
- Stress test: 1000 messages/minute
- Latency test: Measure p50, p95, p99 response times
- Memory leak test: Long-running conversations

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `05-api/endpoints/secrets-endpoints.md` - Secret storage API (VERIFIED)
- [x] `03-security/security-model.md` - Zero-knowledge encryption (VERIFIED)
- [x] `TECH-STACK.md` - Claude API, FireCrawl, Cloudflare Workers specs (VERIFIED)
- [x] `GLOSSARY.md` - Terminology definitions (VERIFIED)
- [ ] `04-database/schemas/conversations-schema.md` - Conversation database schema (NEEDS CREATION)
- [ ] `06-backend/cloudflare-workers/ai-orchestrator.md` - Worker implementation (NEEDS CREATION)

**External Services:**
- **Claude API** - AI responses, must have API key
- **FireCrawl API** - Documentation scraping, must have API key
- **Supabase** - Database, must be configured

### Feature Dependencies

**Required by features:**
- MCP Server - Will use AI Assistant to explain services to Claude Code
- Onboarding Flow - Uses AI to guide new users
- Cost Dashboard - Displays AI usage costs

**Depends on features:**
- User Authentication - Must be authenticated to use AI assistant
- Project Management - Projects provide context for recommendations

---

## References

### Internal Documentation
- `01-product/product-vision-strategy.md` - Product vision, AI-native design
- `03-security/security-model.md` - Security architecture
- `05-api/endpoints/secrets-endpoints.md` - API endpoints
- `TECH-STACK.md` - Technology specifications
- `GLOSSARY.md` - Term definitions

### External Resources
- [Claude API Documentation](https://docs.anthropic.com/claude/reference) - API reference
- [FireCrawl Documentation](https://docs.firecrawl.dev/) - Web scraping
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/) - Edge functions
- [Supabase Documentation](https://supabase.com/docs) - Database and auth
- [OWASP AI Security](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - LLM security

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | AI Team | Initial AI Secret Assistant feature documentation |

---

## Notes

### Future Enhancements
- **Voice Input:** Allow users to speak questions instead of typing
- **Screenshot Analysis:** Upload screenshots of errors, AI troubleshoots
- **Video Tutorials:** AI generates video walkthroughs (future partnership)
- **Multi-language Support:** AI responds in user's preferred language
- **Personalization:** Learn from user's past questions, adjust complexity

### Known Limitations
- Cannot access actual secret values (by design - zero-knowledge)
- Dependent on FireCrawl for up-to-date docs (if service down, falls back to cached)
- Claude API rate limits (529 errors require retry/backoff)
- Cost of Extended Thinking mode (only use when necessary)

### Performance Optimization Ideas
- Pre-generate flows for top 50 APIs (OpenAI, Stripe, etc.)
- Implement semantic caching (similar questions → cached responses)
- Fine-tune model selection (track which model performs best for each query type)
- Compress conversation history (summarize after 20 messages)
