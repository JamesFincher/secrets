---
Document: Conversations - Database Schema
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Database Architect / AI Team
Status: Draft
Dependencies: 03-security/security-model.md, 04-database/database-overview.md, 08-features/ai-assistant/ai-assistant-overview.md
---

# Conversations Database Schema

## Overview

This schema defines the database structure for storing AI assistant conversations in Abyrith. The conversations system supports persistent chat history, token usage tracking, cost estimation, and cached API key acquisition flows. All conversation data is stored with Row-Level Security (RLS) to ensure users can only access their own conversations, while encrypted secret values remain inaccessible to the AI.

**Schema:** public

**Multi-tenancy:** User-level isolation via RLS policies

**Encryption:** Conversation messages stored as plaintext (no secret values), encrypted at rest by Supabase

---

## Table of Contents

1. [Tables](#tables)
2. [Relationships](#relationships)
3. [Row-Level Security (RLS)](#row-level-security-rls)
4. [Indexes](#indexes)
5. [Triggers](#triggers)
6. [Functions](#functions)
7. [Migration Scripts](#migration-scripts)
8. [Sample Queries](#sample-queries)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## Tables

### Table: `conversations`

**Purpose:** Top-level conversation containers linking users to chat sessions with the AI assistant

**Ownership:** User-owned (each conversation belongs to one user)

**Definition:**

```sql
CREATE TABLE conversations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Data Fields
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | No | - | User who owns this conversation |
| `project_id` | UUID | Yes | NULL | Optional project context (if conversation is project-specific) |
| `title` | TEXT | No | - | Auto-generated conversation title (from first message) |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `conversations_pkey` | PRIMARY KEY | `(id)` | Unique identifier |
| `conversations_user_id_fkey` | FOREIGN KEY | `REFERENCES auth.users(id) ON DELETE CASCADE` | Cascade delete when user deleted |
| `conversations_project_id_fkey` | FOREIGN KEY | `REFERENCES projects(id) ON DELETE SET NULL` | Nullify when project deleted |
| `conversations_title_check` | CHECK | `length(title) > 0 AND length(title) <= 255` | Ensure title is not empty and reasonable length |

**Validation Rules:**
- `title`: Max 255 characters, non-empty
- `user_id`: Must reference existing user
- `project_id`: Must reference existing project or be NULL

---

### Table: `conversation_messages`

**Purpose:** Individual messages within conversations, including both user messages and AI responses

**Ownership:** Inherited from parent conversation (user-owned)

**Definition:**

```sql
CREATE TABLE conversation_messages (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Data Fields
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- AI Model Information (for assistant messages)
  model TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10, 6),

  -- Additional Context
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `conversation_id` | UUID | No | - | Parent conversation ID |
| `role` | TEXT | No | - | Message sender: 'user', 'assistant', or 'system' |
| `content` | TEXT | No | - | Message text content (markdown-formatted for assistant) |
| `model` | TEXT | Yes | NULL | Claude model used (e.g., 'claude-3-5-haiku-20241022'), NULL for user messages |
| `tokens_input` | INTEGER | Yes | NULL | Input tokens used (for cost tracking), NULL for user messages |
| `tokens_output` | INTEGER | Yes | NULL | Output tokens used (for cost tracking), NULL for user messages |
| `cost_usd` | DECIMAL(10,6) | Yes | NULL | Estimated cost in USD, NULL for user messages |
| `metadata` | JSONB | No | `'{}'` | Additional context (research data, flow references, etc.) |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `conversation_messages_pkey` | PRIMARY KEY | `(id)` | Unique identifier |
| `conversation_messages_conversation_id_fkey` | FOREIGN KEY | `REFERENCES conversations(id) ON DELETE CASCADE` | Cascade delete when conversation deleted |
| `conversation_messages_role_check` | CHECK | `role IN ('user', 'assistant', 'system')` | Ensure role is valid |
| `conversation_messages_content_check` | CHECK | `length(content) > 0` | Ensure content is not empty |
| `conversation_messages_tokens_check` | CHECK | `tokens_input >= 0 AND tokens_output >= 0` | Ensure token counts are non-negative |
| `conversation_messages_cost_check` | CHECK | `cost_usd >= 0` | Ensure cost is non-negative |

**Validation Rules:**
- `role`: Must be 'user', 'assistant', or 'system'
- `content`: Non-empty text, max ~1MB (PostgreSQL TEXT limit)
- `model`: Should match Claude model naming convention (e.g., 'claude-3-5-sonnet-20241022')
- `tokens_input`, `tokens_output`: Non-negative integers if present
- `cost_usd`: Non-negative decimal with up to 6 decimal places (sub-cent precision)
- `metadata`: Valid JSONB format

---

### Table: `acquisition_flows`

**Purpose:** Cached API key acquisition flows generated by AI, reusable across users

**Ownership:** System-owned (available to all authenticated users)

**Definition:**

```sql
CREATE TABLE acquisition_flows (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Data Fields
  service_name TEXT UNIQUE NOT NULL,
  flow_json JSONB NOT NULL,

  -- Metadata
  created_by_ai BOOLEAN NOT NULL DEFAULT true,
  last_validated TIMESTAMPTZ,
  success_rate DECIMAL(5, 2),
  total_attempts INTEGER DEFAULT 0,
  successful_completions INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `service_name` | TEXT | No | - | API service name (e.g., 'openai', 'stripe'), lowercase, unique |
| `flow_json` | JSONB | No | - | Complete acquisition flow structure (AcquisitionFlow interface) |
| `created_by_ai` | BOOLEAN | No | `true` | Whether flow was AI-generated (vs. manually created) |
| `last_validated` | TIMESTAMPTZ | Yes | NULL | Last time flow was verified to work |
| `success_rate` | DECIMAL(5,2) | Yes | NULL | Percentage of users who successfully complete (0-100) |
| `total_attempts` | INTEGER | No | `0` | Total number of times flow was started |
| `successful_completions` | INTEGER | No | `0` | Number of successful completions |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `acquisition_flows_pkey` | PRIMARY KEY | `(id)` | Unique identifier |
| `acquisition_flows_service_name_key` | UNIQUE | `(service_name)` | One flow per service |
| `acquisition_flows_service_name_check` | CHECK | `service_name = lower(service_name) AND length(service_name) > 0` | Enforce lowercase, non-empty |
| `acquisition_flows_success_rate_check` | CHECK | `success_rate >= 0 AND success_rate <= 100` | Success rate between 0-100% |
| `acquisition_flows_attempts_check` | CHECK | `total_attempts >= 0 AND successful_completions >= 0 AND successful_completions <= total_attempts` | Valid attempt counts |

**Validation Rules:**
- `service_name`: Lowercase, alphanumeric with hyphens allowed (e.g., 'openai', 'aws-ses')
- `flow_json`: Must match AcquisitionFlow interface structure
- `success_rate`: 0-100 with up to 2 decimal places
- `total_attempts`: Non-negative integer
- `successful_completions`: Non-negative integer, cannot exceed total_attempts

**Example flow_json structure:**
```json
{
  "serviceName": "openai",
  "serviceDescription": "OpenAI provides AI models like ChatGPT...",
  "estimatedTime": "10 minutes",
  "difficulty": "easy",
  "requirements": ["Email address", "Phone number", "Credit card"],
  "pricing": {
    "freeTier": "$5 credit when you sign up",
    "paidTiers": [...]
  },
  "steps": [
    {
      "stepNumber": 1,
      "title": "Create OpenAI Account",
      "instructions": "Go to...",
      "checkpoints": ["You received a verification email"],
      "estimatedDuration": "2 minutes",
      "commonIssues": [...]
    }
  ],
  "warnings": ["Credit card required even for free tier"],
  "tips": ["Set usage limits in billing to avoid surprise charges"]
}
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │
│ (Supabase Auth) │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐       ┌──────────────────┐
│ conversations   │       │   projects       │
│                 │       │                   │
│ - id            │◄──────┤ (optional context)│
│ - user_id       │ N   1 │                   │
│ - project_id    │       └──────────────────┘
│ - title         │
│ - created_at    │
│ - updated_at    │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼─────────────────┐
│ conversation_messages    │
│                          │
│ - id                     │
│ - conversation_id        │
│ - role                   │
│ - content                │
│ - model                  │
│ - tokens_input           │
│ - tokens_output          │
│ - cost_usd               │
│ - metadata               │
│ - created_at             │
└──────────────────────────┘


┌──────────────────────────┐
│  acquisition_flows       │
│  (system-wide cache)     │
│                          │
│ - id                     │
│ - service_name (unique)  │
│ - flow_json              │
│ - success_rate           │
│ - total_attempts         │
│ - ...                    │
└──────────────────────────┘
```

### Relationship Details

**conversations → auth.users**
- Type: Many-to-One
- Foreign Key: `conversations.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE`
- Description: Each conversation belongs to one user. When user is deleted, all their conversations are deleted.

**conversations → projects**
- Type: Many-to-One
- Foreign Key: `conversations.project_id → projects.id`
- Cascade: `ON DELETE SET NULL`
- Description: Conversations can optionally be associated with a project for context. When project is deleted, conversation remains but project_id becomes NULL.

**conversation_messages → conversations**
- Type: Many-to-One
- Foreign Key: `conversation_messages.conversation_id → conversations.id`
- Cascade: `ON DELETE CASCADE`
- Description: Each message belongs to one conversation. When conversation is deleted, all its messages are deleted.

**acquisition_flows (standalone)**
- Type: N/A (system-wide resource)
- Description: Acquisition flows are shared across all users, no direct foreign key relationships. Referenced by conversation messages via metadata JSONB field.

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes (on all tables)

**Purpose:** Ensure users can only access their own conversations and messages. Acquisition flows are readable by all authenticated users.

**Multi-tenancy Strategy:** User-level isolation for conversations, system-wide read access for acquisition flows

---

### Table: `conversations`

**RLS Policy 1: `users_see_own_conversations`**

**Purpose:** Users can only access conversations they created

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_see_own_conversations ON conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

**Example Scenario:**
User A (UUID: `aaa-111`) queries conversations table. RLS automatically filters to only show conversations where `user_id = 'aaa-111'`. User A cannot see User B's conversations.

---

**RLS Policy 2: `users_insert_own_conversations`**

**Purpose:** Users can only create conversations for themselves

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_insert_own_conversations ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

**Example Scenario:**
When creating a conversation, the application sets `user_id` to the current authenticated user. RLS verifies this matches `auth.uid()` before allowing insert.

---

**RLS Policy 3: `users_update_own_conversations`**

**Purpose:** Users can only update their own conversations (e.g., title changes)

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_update_own_conversations ON conversations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Example Scenario:**
User updates conversation title. RLS checks that the conversation belongs to them (USING) and that they're not trying to change user_id to someone else (WITH CHECK).

---

**RLS Policy 4: `users_delete_own_conversations`**

**Purpose:** Users can delete their own conversations

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_delete_own_conversations ON conversations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

**Example Scenario:**
User deletes a conversation. RLS ensures they can only delete conversations where they are the owner.

---

### Table: `conversation_messages`

**RLS Policy 1: `users_see_own_messages`**

**Purpose:** Users can only see messages in conversations they own

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_see_own_messages ON conversation_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );
```

**Example Scenario:**
When querying messages, RLS checks that the parent conversation belongs to the current user. This prevents users from accessing messages in other users' conversations even if they somehow know the conversation_id.

---

**RLS Policy 2: `users_insert_own_messages`**

**Purpose:** Users can only insert messages into their own conversations

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_insert_own_messages ON conversation_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );
```

**Example Scenario:**
When AI assistant responds, the application inserts a new message. RLS verifies the conversation belongs to the current user before allowing the insert.

---

**RLS Policy 3: `users_update_own_messages`**

**Purpose:** Users can update messages in their own conversations (rare, mainly for corrections)

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_update_own_messages ON conversation_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );
```

---

**RLS Policy 4: `users_delete_own_messages`**

**Purpose:** Users can delete messages from their own conversations

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY users_delete_own_messages ON conversation_messages
  FOR DELETE
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

### Table: `acquisition_flows`

**RLS Policy 1: `authenticated_users_read_flows`**

**Purpose:** All authenticated users can read acquisition flows (system-wide cache)

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY authenticated_users_read_flows ON acquisition_flows
  FOR SELECT
  TO authenticated
  USING (true);
```

**Example Scenario:**
Any authenticated user can query acquisition flows. These are system-wide resources generated by AI, not user-specific.

---

**RLS Policy 2: `service_role_manage_flows`**

**Purpose:** Only service role (backend) can insert/update/delete flows

**Operation:** `ALL`

**Role:** `service_role`

**Definition:**
```sql
CREATE POLICY service_role_manage_flows ON acquisition_flows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Example Scenario:**
AI assistant (via Cloudflare Worker with service_role key) generates a new acquisition flow and inserts it. Regular users cannot modify flows, only read them.

---

### RLS Testing

**Test Case 1: User A cannot see User B's conversations**
```sql
-- As User A
SET request.jwt.claim.sub = 'user-a-uuid';

-- This should succeed (User A's conversations)
SELECT * FROM conversations WHERE user_id = 'user-a-uuid';

-- This should return 0 rows (User B's conversations filtered by RLS)
SELECT * FROM conversations WHERE user_id = 'user-b-uuid';
```

**Expected:** User A sees only their own conversations, User B's conversations are filtered out by RLS.

---

**Test Case 2: User cannot insert message into another user's conversation**
```sql
-- As User A
SET request.jwt.claim.sub = 'user-a-uuid';

-- This should fail (conversation belongs to User B)
INSERT INTO conversation_messages (conversation_id, role, content)
VALUES ('user-b-conversation-uuid', 'user', 'Hello');
-- Error: new row violates row-level security policy
```

**Expected:** RLS blocks the insert because User A doesn't own the conversation.

---

**Test Case 3: All users can read acquisition flows**
```sql
-- As User A
SELECT * FROM acquisition_flows WHERE service_name = 'openai';
-- Should succeed

-- As User B
SELECT * FROM acquisition_flows WHERE service_name = 'openai';
-- Should also succeed (same flow, system-wide resource)
```

**Expected:** Both users can read the same acquisition flow.

---

## Indexes

### Performance Indexes

**Index 1: `idx_conversations_user_id`**

**Purpose:** Fast lookup of conversations by user (most common query)

**Table:** `conversations`

**Columns:** `(user_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_conversations_user_id
  ON conversations(user_id);
```

**Queries Optimized:**
```sql
-- List all conversations for a user
SELECT * FROM conversations
WHERE user_id = $1
ORDER BY updated_at DESC;
```

**Performance Impact:**
- Query time: ~50ms → ~5ms
- Index size: ~100KB per 1,000 conversations

---

**Index 2: `idx_conversations_project_id`**

**Purpose:** Fast lookup of conversations by project (for project-specific context)

**Table:** `conversations`

**Columns:** `(project_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_conversations_project_id
  ON conversations(project_id)
  WHERE project_id IS NOT NULL;
```

**Queries Optimized:**
```sql
-- Get conversations related to a specific project
SELECT * FROM conversations
WHERE project_id = $1
ORDER BY updated_at DESC;
```

**Performance Impact:**
- Query time: ~60ms → ~10ms
- Partial index (only where project_id IS NOT NULL) saves space

---

**Index 3: `idx_conversations_updated_at`**

**Purpose:** Fast sorting by last updated (for conversation lists)

**Table:** `conversations`

**Columns:** `(updated_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_conversations_updated_at
  ON conversations(updated_at DESC);
```

**Queries Optimized:**
```sql
-- Get most recent conversations
SELECT * FROM conversations
WHERE user_id = $1
ORDER BY updated_at DESC
LIMIT 20;
```

**Performance Impact:**
- Query time: ~40ms → ~8ms for sorted results

---

**Index 4: `idx_conversation_messages_conversation_id`**

**Purpose:** Fast retrieval of all messages in a conversation

**Table:** `conversation_messages`

**Columns:** `(conversation_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_conversation_messages_conversation_id
  ON conversation_messages(conversation_id);
```

**Queries Optimized:**
```sql
-- Get all messages in a conversation
SELECT * FROM conversation_messages
WHERE conversation_id = $1
ORDER BY created_at ASC;
```

**Performance Impact:**
- Query time: ~100ms → ~10ms for 50-message conversations
- Index size: ~200KB per 10,000 messages

---

**Index 5: `idx_conversation_messages_created_at`**

**Purpose:** Fast sorting of messages by timestamp

**Table:** `conversation_messages`

**Columns:** `(created_at ASC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_conversation_messages_created_at
  ON conversation_messages(created_at ASC);
```

**Queries Optimized:**
```sql
-- Get recent messages across all conversations (for analytics)
SELECT * FROM conversation_messages
ORDER BY created_at DESC
LIMIT 100;
```

---

**Index 6: `idx_conversation_messages_cost_tracking`**

**Purpose:** Aggregate cost calculations for user budgets

**Table:** `conversation_messages`

**Columns:** `(role, created_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_conversation_messages_cost_tracking
  ON conversation_messages(role, created_at DESC)
  WHERE role = 'assistant' AND cost_usd IS NOT NULL;
```

**Queries Optimized:**
```sql
-- Calculate total AI costs for user this month
SELECT SUM(cost_usd) as total_cost
FROM conversation_messages cm
JOIN conversations c ON c.id = cm.conversation_id
WHERE c.user_id = $1
  AND cm.role = 'assistant'
  AND cm.created_at >= date_trunc('month', CURRENT_DATE);
```

**Performance Impact:**
- Query time: ~200ms → ~15ms for monthly cost calculations
- Partial index saves space (only indexes assistant messages with cost)

---

**Index 7: `idx_acquisition_flows_service_name`**

**Purpose:** Fast lookup of flows by service name

**Table:** `acquisition_flows`

**Columns:** `(service_name)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_acquisition_flows_service_name
  ON acquisition_flows(service_name);
```

**Queries Optimized:**
```sql
-- Get acquisition flow for specific service
SELECT * FROM acquisition_flows
WHERE service_name = $1;
```

**Performance Impact:**
- Query time: ~30ms → ~2ms
- Note: service_name has UNIQUE constraint, so index already exists implicitly, but explicit index ensures optimal query plans

---

**Index 8: `idx_acquisition_flows_last_validated`**

**Purpose:** Find flows that need revalidation (older than 7 days)

**Table:** `acquisition_flows`

**Columns:** `(last_validated)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_acquisition_flows_last_validated
  ON acquisition_flows(last_validated)
  WHERE last_validated IS NOT NULL;
```

**Queries Optimized:**
```sql
-- Find flows needing revalidation
SELECT service_name, last_validated
FROM acquisition_flows
WHERE last_validated < now() - interval '7 days'
ORDER BY last_validated ASC;
```

---

## Triggers

### Trigger: `update_conversations_updated_at`

**Purpose:** Automatically update `updated_at` timestamp when conversation is modified

**Table:** `conversations`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Function:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Example:**
```sql
-- Update conversation title
UPDATE conversations
SET title = 'New Title'
WHERE id = 'conv-uuid';
-- updated_at is automatically set to now()
```

---

### Trigger: `update_acquisition_flows_updated_at`

**Purpose:** Automatically update `updated_at` timestamp when flow is modified

**Table:** `acquisition_flows`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
CREATE TRIGGER update_acquisition_flows_updated_at
  BEFORE UPDATE ON acquisition_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Example:**
```sql
-- Update flow success rate
UPDATE acquisition_flows
SET success_rate = 95.5
WHERE service_name = 'openai';
-- updated_at is automatically set to now()
```

---

### Trigger: `update_conversation_parent_on_message_insert`

**Purpose:** Update parent conversation's `updated_at` when new message is added

**Table:** `conversation_messages`

**Event:** `AFTER INSERT`

**Definition:**
```sql
CREATE TRIGGER update_conversation_parent_on_message_insert
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_conversation_timestamp();
```

**Function:**
```sql
CREATE OR REPLACE FUNCTION update_parent_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Example:**
When AI assistant responds with a message:
```sql
INSERT INTO conversation_messages (conversation_id, role, content, model, cost_usd)
VALUES ('conv-uuid', 'assistant', 'Here is your answer...', 'claude-3-5-sonnet-20241022', 0.000675);
-- Trigger automatically updates conversations.updated_at for 'conv-uuid'
```

---

## Functions

### Function: `get_conversation_with_messages`

**Purpose:** Retrieve conversation with its last N messages in one query (optimized)

**Parameters:**
- `p_conversation_id` (UUID) - Conversation ID
- `p_message_limit` (INTEGER) - Number of recent messages to fetch (default 20)

**Returns:** JSONB containing conversation and messages array

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_conversation_with_messages(
  p_conversation_id UUID,
  p_message_limit INTEGER DEFAULT 20
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'project_id', c.project_id,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'messages', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'role', m.role,
            'content', m.content,
            'model', m.model,
            'tokens_input', m.tokens_input,
            'tokens_output', m.tokens_output,
            'cost_usd', m.cost_usd,
            'created_at', m.created_at
          ) ORDER BY m.created_at DESC
        )
        FROM (
          SELECT * FROM conversation_messages
          WHERE conversation_id = p_conversation_id
          ORDER BY created_at DESC
          LIMIT p_message_limit
        ) m
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM conversations c
  WHERE c.id = p_conversation_id
    AND c.user_id = auth.uid(); -- RLS enforcement

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
-- Get conversation with last 10 messages
SELECT get_conversation_with_messages('conv-uuid', 10);
```

**Security Considerations:**
- Uses `SECURITY DEFINER` to bypass RLS temporarily
- Manually checks `user_id = auth.uid()` to enforce ownership
- Returns NULL if user doesn't own conversation

---

### Function: `get_user_ai_costs`

**Purpose:** Calculate total AI costs for a user in a given time period

**Parameters:**
- `p_user_id` (UUID) - User ID
- `p_period` (TEXT) - Period: 'day', 'week', 'month', 'all' (default 'month')

**Returns:** TABLE with cost summary

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_user_ai_costs(
  p_user_id UUID,
  p_period TEXT DEFAULT 'month'
)
RETURNS TABLE(
  total_cost_usd DECIMAL(10, 6),
  total_tokens BIGINT,
  message_count BIGINT,
  avg_cost_per_message DECIMAL(10, 6),
  by_model JSONB
) AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
BEGIN
  -- Determine start date based on period
  v_start_date := CASE p_period
    WHEN 'day' THEN now() - interval '1 day'
    WHEN 'week' THEN now() - interval '7 days'
    WHEN 'month' THEN date_trunc('month', now())
    ELSE '1970-01-01'::TIMESTAMPTZ -- 'all'
  END;

  RETURN QUERY
  SELECT
    COALESCE(SUM(cm.cost_usd), 0)::DECIMAL(10, 6) as total_cost_usd,
    COALESCE(SUM(cm.tokens_input + cm.tokens_output), 0)::BIGINT as total_tokens,
    COUNT(*)::BIGINT as message_count,
    CASE
      WHEN COUNT(*) > 0 THEN (COALESCE(SUM(cm.cost_usd), 0) / COUNT(*))::DECIMAL(10, 6)
      ELSE 0::DECIMAL(10, 6)
    END as avg_cost_per_message,
    COALESCE(
      jsonb_object_agg(
        cm.model,
        jsonb_build_object(
          'count', COUNT(*),
          'cost', SUM(cm.cost_usd),
          'tokens', SUM(cm.tokens_input + cm.tokens_output)
        )
      ) FILTER (WHERE cm.model IS NOT NULL),
      '{}'::jsonb
    ) as by_model
  FROM conversation_messages cm
  JOIN conversations c ON c.id = cm.conversation_id
  WHERE c.user_id = p_user_id
    AND cm.role = 'assistant'
    AND cm.cost_usd IS NOT NULL
    AND cm.created_at >= v_start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
-- Get monthly AI costs for user
SELECT * FROM get_user_ai_costs('user-uuid', 'month');

-- Example output:
-- total_cost_usd | total_tokens | message_count | avg_cost_per_message | by_model
-- 0.045123       | 6745         | 23            | 0.001962             | {"claude-3-5-haiku-20241022": {...}, "claude-3-5-sonnet-20241022": {...}}
```

---

### Function: `calculate_acquisition_flow_success_rate`

**Purpose:** Update success rate for an acquisition flow based on attempts/completions

**Parameters:**
- `p_service_name` (TEXT) - Service name
- `p_completed` (BOOLEAN) - Whether this attempt was successful

**Returns:** VOID (updates row)

**Definition:**
```sql
CREATE OR REPLACE FUNCTION calculate_acquisition_flow_success_rate(
  p_service_name TEXT,
  p_completed BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE acquisition_flows
  SET
    total_attempts = total_attempts + 1,
    successful_completions = successful_completions + CASE WHEN p_completed THEN 1 ELSE 0 END,
    success_rate = CASE
      WHEN total_attempts + 1 > 0
      THEN ((successful_completions + CASE WHEN p_completed THEN 1 ELSE 0 END)::DECIMAL / (total_attempts + 1) * 100)
      ELSE 0
    END
  WHERE service_name = p_service_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
-- User started OpenAI flow
SELECT calculate_acquisition_flow_success_rate('openai', false);

-- User completed OpenAI flow successfully
SELECT calculate_acquisition_flow_success_rate('openai', true);
```

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/001_create_conversations_schema.sql`

**Description:** Create conversations, conversation_messages, and acquisition_flows tables with RLS policies and indexes

**SQL:**
```sql
-- ============================================================
-- Migration: 001_create_conversations_schema.sql
-- Description: Create conversations schema for AI assistant
-- Version: 1.0.0
-- ============================================================

-- ============================================================
-- 1. Create Tables
-- ============================================================

-- conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT conversations_title_check CHECK (length(title) > 0 AND length(title) <= 255)
);

-- conversation_messages table
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10, 6),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT conversation_messages_content_check CHECK (length(content) > 0),
  CONSTRAINT conversation_messages_tokens_check CHECK (
    (tokens_input IS NULL OR tokens_input >= 0) AND
    (tokens_output IS NULL OR tokens_output >= 0)
  ),
  CONSTRAINT conversation_messages_cost_check CHECK (cost_usd IS NULL OR cost_usd >= 0)
);

-- acquisition_flows table
CREATE TABLE acquisition_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT UNIQUE NOT NULL,
  flow_json JSONB NOT NULL,
  created_by_ai BOOLEAN NOT NULL DEFAULT true,
  last_validated TIMESTAMPTZ,
  success_rate DECIMAL(5, 2),
  total_attempts INTEGER DEFAULT 0,
  successful_completions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT acquisition_flows_service_name_check CHECK (
    service_name = lower(service_name) AND length(service_name) > 0
  ),
  CONSTRAINT acquisition_flows_success_rate_check CHECK (
    success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 100)
  ),
  CONSTRAINT acquisition_flows_attempts_check CHECK (
    total_attempts >= 0 AND
    successful_completions >= 0 AND
    successful_completions <= total_attempts
  )
);

-- ============================================================
-- 2. Create Indexes
-- ============================================================

-- conversations indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_project_id ON conversations(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- conversation_messages indexes
CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON conversation_messages(created_at ASC);
CREATE INDEX idx_conversation_messages_cost_tracking
  ON conversation_messages(role, created_at DESC)
  WHERE role = 'assistant' AND cost_usd IS NOT NULL;

-- acquisition_flows indexes
CREATE INDEX idx_acquisition_flows_service_name ON acquisition_flows(service_name);
CREATE INDEX idx_acquisition_flows_last_validated
  ON acquisition_flows(last_validated)
  WHERE last_validated IS NOT NULL;

-- ============================================================
-- 3. Enable Row-Level Security
-- ============================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_flows ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Create RLS Policies - conversations
-- ============================================================

CREATE POLICY users_see_own_conversations ON conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY users_insert_own_conversations ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY users_update_own_conversations ON conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY users_delete_own_conversations ON conversations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 5. Create RLS Policies - conversation_messages
-- ============================================================

CREATE POLICY users_see_own_messages ON conversation_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY users_insert_own_messages ON conversation_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY users_update_own_messages ON conversation_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY users_delete_own_messages ON conversation_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Create RLS Policies - acquisition_flows
-- ============================================================

CREATE POLICY authenticated_users_read_flows ON acquisition_flows
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY service_role_manage_flows ON acquisition_flows
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. Create Functions
-- ============================================================

-- Function: update_updated_at_column (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_parent_conversation_timestamp
CREATE OR REPLACE FUNCTION update_parent_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. Create Triggers
-- ============================================================

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acquisition_flows_updated_at
  BEFORE UPDATE ON acquisition_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_parent_on_message_insert
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_conversation_timestamp();

-- ============================================================
-- Migration Complete
-- ============================================================
```

**Verification:**
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('conversations', 'conversation_messages', 'acquisition_flows');

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('conversations', 'conversation_messages', 'acquisition_flows');

-- Verify indexes created
SELECT indexname FROM pg_indexes
WHERE tablename IN ('conversations', 'conversation_messages', 'acquisition_flows')
ORDER BY indexname;
```

**Rollback:**
```sql
-- Drop tables (cascades will handle messages and flows)
DROP TABLE IF EXISTS acquisition_flows CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_parent_conversation_timestamp() CASCADE;
```

---

## Sample Queries

### Query 1: Get User's Recent Conversations

**Purpose:** Retrieve user's 20 most recent conversations with basic info

**SQL:**
```sql
SELECT
  id,
  title,
  project_id,
  created_at,
  updated_at
FROM conversations
WHERE user_id = $1
ORDER BY updated_at DESC
LIMIT 20;
```

**Explanation:** Fetches conversations ordered by last activity. RLS automatically filters to current user. Uses `idx_conversations_user_id` and `idx_conversations_updated_at` indexes.

**Performance:** 5-10ms for typical user with 50 conversations

---

### Query 2: Get Conversation with All Messages

**Purpose:** Load complete conversation history for display in UI

**SQL:**
```sql
-- Get conversation metadata
SELECT
  id,
  title,
  project_id,
  created_at,
  updated_at
FROM conversations
WHERE id = $1;

-- Get all messages (separate query for better pagination)
SELECT
  id,
  role,
  content,
  model,
  tokens_input,
  tokens_output,
  cost_usd,
  created_at
FROM conversation_messages
WHERE conversation_id = $1
ORDER BY created_at ASC;
```

**Explanation:** Two-query approach allows efficient pagination of messages. RLS verifies user owns conversation. Uses `idx_conversation_messages_conversation_id` index.

**Performance:** 10-15ms for conversation with 50 messages

---

### Query 3: Calculate Monthly AI Costs for User

**Purpose:** Display user's AI spending for current month in dashboard

**SQL:**
```sql
SELECT
  COUNT(*) as message_count,
  SUM(cm.tokens_input) as total_input_tokens,
  SUM(cm.tokens_output) as total_output_tokens,
  SUM(cm.cost_usd) as total_cost_usd,
  cm.model,
  SUM(cm.cost_usd) as cost_by_model
FROM conversation_messages cm
JOIN conversations c ON c.id = cm.conversation_id
WHERE c.user_id = $1
  AND cm.role = 'assistant'
  AND cm.created_at >= date_trunc('month', CURRENT_DATE)
GROUP BY cm.model;
```

**Explanation:** Aggregates costs grouped by model for current month. Uses `idx_conversation_messages_cost_tracking` partial index.

**Performance:** 15-25ms for user with 100 messages this month

---

### Query 4: Get Acquisition Flow by Service Name

**Purpose:** Retrieve cached acquisition flow for a specific API service

**SQL:**
```sql
SELECT
  id,
  service_name,
  flow_json,
  last_validated,
  success_rate,
  total_attempts,
  successful_completions
FROM acquisition_flows
WHERE service_name = $1;
```

**Explanation:** Simple lookup by unique service_name. Uses `idx_acquisition_flows_service_name` index (implicit from UNIQUE constraint).

**Performance:** 2-5ms

---

### Query 5: Find Outdated Acquisition Flows

**Purpose:** Identify flows that need revalidation (older than 7 days)

**SQL:**
```sql
SELECT
  service_name,
  last_validated,
  age(now(), last_validated) as age,
  success_rate,
  total_attempts
FROM acquisition_flows
WHERE last_validated < now() - interval '7 days'
  OR last_validated IS NULL
ORDER BY last_validated ASC NULLS FIRST;
```

**Explanation:** Finds flows that haven't been validated recently. Uses `idx_acquisition_flows_last_validated` partial index.

**Performance:** 5-10ms for 100 flows in database

---

### Query 6: Search Conversations by Title

**Purpose:** Allow users to search their conversation history

**SQL:**
```sql
SELECT
  id,
  title,
  project_id,
  updated_at
FROM conversations
WHERE user_id = $1
  AND title ILIKE '%' || $2 || '%'
ORDER BY updated_at DESC
LIMIT 20;
```

**Explanation:** Case-insensitive search in conversation titles. RLS ensures only user's conversations searched. May benefit from GIN index on title for larger datasets (future optimization).

**Performance:** 20-50ms for user with 200 conversations

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [x] `auth.users` (Supabase managed) - User authentication
- [x] `projects` table - Project context for conversations (optional foreign key)

**Required by these schemas:**
- N/A - This schema is self-contained

### Feature Dependencies

**Required by features:**
- `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant feature uses this schema for conversation persistence

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture and RLS patterns
- `03-security/security-model.md` - Zero-knowledge architecture (conversations don't contain secret values)
- `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant feature specification
- `TECH-STACK.md` - Technology stack (PostgreSQL 15.x, Supabase)
- `GLOSSARY.md` - Term definitions (RLS, JSONB, UUID, etc.)

### External Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/) - PostgreSQL reference
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns
- [JSONB Data Type](https://www.postgresql.org/docs/15/datatype-json.html) - JSONB usage

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Database Architect / AI Team | Initial conversations schema definition for AI assistant feature |

---

## Notes

### Future Enhancements
- **Full-text search on messages:** Add GIN index with tsvector for searching message content
- **Conversation archiving:** Add `archived_at` column and partial indexes for active conversations
- **Message reactions:** Add `reactions` JSONB column for emoji reactions (collaborative feature)
- **Conversation sharing:** Add `shared_with` JSONB array for sharing conversations with team members
- **Conversation templates:** Add `is_template` boolean for saving conversation flows as reusable templates

### Known Limitations
- Messages cannot exceed PostgreSQL TEXT limit (~1GB, effectively ~1MB for practical purposes)
- No built-in pagination in `get_conversation_with_messages` function (returns last N messages)
- `acquisition_flows` table has no versioning (updates overwrite previous flow)

### Performance Optimization Ideas
- Implement message pagination at application level (OFFSET/LIMIT queries)
- Add `message_count` column to conversations table (denormalized for faster queries)
- Partition `conversation_messages` table by `created_at` if table grows very large (>10M messages)
- Add GIN index on `metadata` JSONB column if complex queries on metadata are needed
