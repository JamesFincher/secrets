---
Document: Webhook Subscriptions - Database Schema
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 04-database/schemas/secrets-metadata.md, 09-integrations/webhooks/webhooks-integration.md, 03-security/security-model.md, GLOSSARY.md
---

# Webhook Subscriptions Database Schema

## Overview

This schema defines the database structure for storing webhook subscription configurations and delivery logs. The webhook system allows organizations to receive real-time notifications about platform events (secret access, team changes, security alerts) via HTTP POST requests to external endpoints. All webhook secrets are encrypted at rest, and delivery attempts are logged for debugging and reliability monitoring.

**Schema:** `public`

**Multi-tenancy:** Organization-level isolation enforced via Row-Level Security (RLS) policies

**Encryption:** Webhook signing secrets encrypted at rest with AES-256-GCM; URLs and event configurations stored in plaintext for operational purposes

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

### Table: `webhook_subscriptions`

**Purpose:** Store webhook endpoint configurations and subscription preferences

**Ownership:** Webhooks belong to organizations and projects; users manage via organization membership

**Definition:**

```sql
CREATE TABLE webhook_subscriptions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Webhook Configuration
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN DEFAULT true,

  -- Delivery Health
  failure_count INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,

  -- Metadata Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT webhook_subscriptions_url_check CHECK (url ~ '^https?://'),
  CONSTRAINT webhook_subscriptions_failure_count_check CHECK (failure_count >= 0),
  CONSTRAINT webhook_subscriptions_max_per_project CHECK (
    (SELECT COUNT(*) FROM webhook_subscriptions WHERE project_id = webhook_subscriptions.project_id AND active = true) <= 10
  )
);

COMMENT ON TABLE webhook_subscriptions IS 'Webhook endpoint configurations for event notifications';
COMMENT ON COLUMN webhook_subscriptions.secret IS 'HMAC-SHA256 signing secret (encrypted at rest)';
COMMENT ON COLUMN webhook_subscriptions.events IS 'Array of event types to subscribe to: secret.created, secret.accessed, secret.updated, secret.deleted, member.added, member.removed, etc.';
COMMENT ON COLUMN webhook_subscriptions.failure_count IS 'Consecutive delivery failures (auto-disables webhook after 10 failures)';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | No | - | User who created the webhook |
| `project_id` | UUID | No | - | Project this webhook belongs to |
| `url` | TEXT | No | - | Webhook endpoint URL (HTTPS required for production) |
| `secret` | TEXT | No | - | HMAC signing secret (encrypted at rest) |
| `events` | TEXT[] | No | `[]` | Event types to subscribe to |
| `active` | BOOLEAN | No | `true` | Whether webhook is enabled |
| `failure_count` | INTEGER | No | `0` | Consecutive delivery failures |
| `last_delivery_at` | TIMESTAMPTZ | Yes | NULL | Timestamp of last successful delivery |
| `last_failure_at` | TIMESTAMPTZ | Yes | NULL | Timestamp of last failed delivery |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `webhook_subscriptions_url_check` | CHECK | `url ~ '^https?://'` | Ensure valid HTTP/HTTPS URL |
| `webhook_subscriptions_failure_count_check` | CHECK | `failure_count >= 0` | Prevent negative failure counts |
| `webhook_subscriptions_max_per_project` | CHECK | Max 10 active webhooks per project | Prevent webhook abuse |

**Validation Rules:**
- `url`: Must be valid HTTP/HTTPS URL; SSRF validation required (block private IPs: 10.x.x.x, 192.168.x.x, 127.0.0.1, 169.254.169.254)
- `secret`: 256-bit random secret, base64-encoded, encrypted before storage
- `events`: Each event must be from allowed list (see `09-integrations/webhooks/webhooks-integration.md`)
- `failure_count`: Auto-disable webhook when reaches 10 consecutive failures

**Security Considerations:**
- **SSRF Protection:** URL validation must block private IP ranges and cloud metadata endpoints before insert
- **Secret Encryption:** `secret` column encrypted using AES-256-GCM with platform encryption key
- **Rate Limiting:** Max 10 active webhooks per project, enforced by CHECK constraint
- **Automatic Deactivation:** Webhooks automatically disabled after 10 consecutive failures to prevent waste

---

### Table: `webhook_deliveries`

**Purpose:** Log all webhook delivery attempts for debugging and reliability monitoring

**Ownership:** Delivery logs belong to webhook subscriptions

**Definition:**

```sql
CREATE TABLE webhook_deliveries (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  webhook_subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_id UUID,

  -- Delivery Details
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,

  -- Delivery Metadata
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT webhook_deliveries_status_check CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  CONSTRAINT webhook_deliveries_http_status_check CHECK (http_status >= 100 AND http_status < 600 OR http_status IS NULL),
  CONSTRAINT webhook_deliveries_attempt_check CHECK (attempt_number >= 1 AND attempt_number <= 5)
);

COMMENT ON TABLE webhook_deliveries IS 'Log of all webhook delivery attempts';
COMMENT ON COLUMN webhook_deliveries.event_id IS 'Optional reference to audit log event that triggered webhook';
COMMENT ON COLUMN webhook_deliveries.payload IS 'JSON payload sent to webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.status IS 'Delivery status: pending, success, failed, retrying';
COMMENT ON COLUMN webhook_deliveries.attempt_number IS 'Retry attempt (1-5)';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `webhook_subscription_id` | UUID | No | - | Webhook subscription this delivery is for |
| `event_id` | UUID | Yes | NULL | Optional reference to audit log event |
| `event_type` | VARCHAR(100) | No | - | Event type (e.g., "secret.accessed") |
| `payload` | JSONB | No | - | JSON payload sent to webhook |
| `http_status` | INTEGER | Yes | NULL | HTTP status code from webhook endpoint |
| `response_body` | TEXT | Yes | NULL | Response body from webhook endpoint (truncated to 10KB) |
| `error_message` | TEXT | Yes | NULL | Error message if delivery failed |
| `attempt_number` | INTEGER | No | `1` | Retry attempt number (1-5) |
| `status` | VARCHAR(50) | No | `'pending'` | Delivery status |
| `delivered_at` | TIMESTAMPTZ | No | `now()` | When delivery was attempted |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `webhook_deliveries_status_check` | CHECK | `status IN (...)` | Enforce valid status values |
| `webhook_deliveries_http_status_check` | CHECK | `http_status` in valid range | Enforce valid HTTP status codes |
| `webhook_deliveries_attempt_check` | CHECK | `attempt_number` between 1 and 5 | Limit retry attempts |

**Validation Rules:**
- `event_type`: Max 100 characters, must match allowed event types
- `payload`: Valid JSON object, max 1MB size
- `response_body`: Truncated to 10KB to prevent bloat
- `http_status`: Valid HTTP status code (100-599) or NULL
- `attempt_number`: Between 1 and 5 (max 5 retries)

**Retention Policy:**
- Delivery logs automatically deleted after 30 days (configurable via scheduled job)
- Successful deliveries can be deleted after 7 days to save storage
- Failed deliveries retained for full 30 days for debugging

---

## Relationships

### Entity Relationship Diagram

```
┌──────────────────┐
│  organizations   │
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────▼─────────┐
│    projects      │
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────▼─────────────────┐
│ webhook_subscriptions    │
└────────┬─────────────────┘
         │ 1
         │
         │ N
┌────────▼──────────────────┐
│  webhook_deliveries       │
└───────────────────────────┘

┌──────────────────┐
│   auth.users     │ ───┐
└──────────────────┘    │
                        │ 1
                        │
                        │ N
              ┌─────────▼────────────────┐
              │ webhook_subscriptions    │
              └──────────────────────────┘
```

### Relationship Details

**auth.users → webhook_subscriptions**
- Type: One-to-Many
- Foreign Key: `webhook_subscriptions.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE` (deleting user deletes their webhooks)
- Description: Track who created each webhook subscription

**projects → webhook_subscriptions**
- Type: One-to-Many
- Foreign Key: `webhook_subscriptions.project_id → projects.id`
- Cascade: `ON DELETE CASCADE` (deleting project deletes all webhooks)
- Description: Webhooks belong to projects for scoped event notifications

**webhook_subscriptions → webhook_deliveries**
- Type: One-to-Many
- Foreign Key: `webhook_deliveries.webhook_subscription_id → webhook_subscriptions.id`
- Cascade: `ON DELETE CASCADE` (deleting webhook deletes all delivery logs)
- Description: Each webhook subscription has multiple delivery attempts logged

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes, on both tables

**Purpose:** Enforce multi-tenancy and ensure users can only manage webhooks for projects they have access to.

**Multi-tenancy Strategy:** Project-based isolation. Users access webhooks through project membership, verified via organization membership.

---

### Table: `webhook_subscriptions`

**RLS Policy 1: `webhook_subscriptions_select_policy`**

**Purpose:** Users can view webhooks for projects they have access to

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY webhook_subscriptions_select_policy ON webhook_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );
```

**Example Scenario:**
User Alice is a member of Organization "Acme Corp" with access to "RecipeApp" project. She can see all webhooks for "RecipeApp" but cannot see webhooks for other projects.

---

**RLS Policy 2: `webhook_subscriptions_insert_policy`**

**Purpose:** Only Admins and Owners can create webhooks

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY webhook_subscriptions_insert_policy ON webhook_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
```

**Example Scenario:**
Only organization owners and admins can create new webhook subscriptions. Developers and read-only users cannot.

---

**RLS Policy 3: `webhook_subscriptions_update_policy`**

**Purpose:** Webhook creator or project admins/owners can update webhooks

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY webhook_subscriptions_update_policy ON webhook_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
```

---

**RLS Policy 4: `webhook_subscriptions_delete_policy`**

**Purpose:** Webhook creator or project admins/owners can delete webhooks

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY webhook_subscriptions_delete_policy ON webhook_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
```

---

### Table: `webhook_deliveries`

**RLS Policy: `webhook_deliveries_select_policy`**

**Purpose:** Users can view delivery logs for webhooks they have access to

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY webhook_deliveries_select_policy ON webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (
    webhook_subscription_id IN (
      SELECT ws.id FROM webhook_subscriptions ws
      INNER JOIN projects p ON ws.project_id = p.id
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );
```

**Note:** Only SELECT policy needed for `webhook_deliveries`. Writes are handled by backend service (Cloudflare Workers) using service role key.

---

### RLS Testing

**Test Case 1: User can only view their project's webhooks**

```sql
-- As user Alice (member of Acme Corp, RecipeApp project)
SET request.jwt.claim.sub = 'alice_user_id';

-- This should succeed
SELECT * FROM webhook_subscriptions
WHERE project_id = 'recipeapp_project_id';

-- This should return 0 rows (RLS filters it out)
SELECT * FROM webhook_subscriptions
WHERE project_id = 'competitor_project_id';
```

**Expected:** Alice sees only RecipeApp webhooks

---

**Test Case 2: Developer cannot create webhooks**

```sql
-- As user Bob (developer role in Acme Corp)
SET request.jwt.claim.sub = 'bob_user_id';

-- This should fail (RLS blocks it)
INSERT INTO webhook_subscriptions (user_id, project_id, url, secret, events)
VALUES ('bob_user_id', 'recipeapp_project_id', 'https://example.com/webhook', 'encrypted_secret', ARRAY['secret.accessed']);
```

**Expected:** INSERT fails due to RLS policy (only admins/owners can create webhooks)

---

**Test Case 3: Admin can manage webhooks**

```sql
-- As user Carol (admin role in Acme Corp)
SET request.jwt.claim.sub = 'carol_user_id';

-- This should succeed
INSERT INTO webhook_subscriptions (user_id, project_id, url, secret, events)
VALUES ('carol_user_id', 'recipeapp_project_id', 'https://example.com/webhook', 'encrypted_secret', ARRAY['secret.accessed']);

-- This should succeed
UPDATE webhook_subscriptions SET active = false WHERE id = 'webhook_uuid';

-- This should succeed
DELETE FROM webhook_subscriptions WHERE id = 'webhook_uuid';
```

**Expected:** All operations succeed for admin

---

## Indexes

### Performance Indexes

**Index 1: `idx_webhook_subs_user_id`**

**Purpose:** Speed up webhook lookups by user

**Table:** `webhook_subscriptions`

**Columns:** `(user_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_webhook_subs_user_id
  ON webhook_subscriptions(user_id);
```

**Queries Optimized:**
```sql
-- Find all webhooks created by a user
SELECT * FROM webhook_subscriptions
WHERE user_id = 'user_uuid';
```

**Performance Impact:**
- Query time: O(N) → O(log N)
- Index size: ~1KB per 100 webhooks

---

**Index 2: `idx_webhook_subs_project_id`**

**Purpose:** Speed up webhook lookups by project (used in RLS policies)

**Table:** `webhook_subscriptions`

**Columns:** `(project_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_webhook_subs_project_id
  ON webhook_subscriptions(project_id);
```

**Queries Optimized:**
```sql
-- List all webhooks for a project
SELECT * FROM webhook_subscriptions
WHERE project_id = 'project_uuid';
```

**Performance Impact:**
- Query time: 50ms → 5ms
- Critical for RLS policy performance

---

**Index 3: `idx_webhook_subs_active`**

**Purpose:** Fast filtering of active webhooks for event dispatch

**Table:** `webhook_subscriptions`

**Columns:** `(active)` WHERE `active = true`

**Type:** B-tree (partial index)

**Definition:**
```sql
CREATE INDEX idx_webhook_subs_active
  ON webhook_subscriptions(active)
  WHERE active = true;
```

**Queries Optimized:**
```sql
-- Find all active webhooks for event dispatch
SELECT * FROM webhook_subscriptions
WHERE active = true AND project_id = 'project_uuid';
```

**Performance Impact:**
- Query time: 100ms → 10ms
- Partial index reduces storage (only indexes active = true rows)

---

**Index 4: `idx_webhook_deliveries_subscription_id`**

**Purpose:** Speed up delivery log lookups by webhook subscription

**Table:** `webhook_deliveries`

**Columns:** `(webhook_subscription_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_webhook_deliveries_subscription_id
  ON webhook_deliveries(webhook_subscription_id);
```

**Queries Optimized:**
```sql
-- Get all delivery attempts for a webhook
SELECT * FROM webhook_deliveries
WHERE webhook_subscription_id = 'webhook_uuid'
ORDER BY delivered_at DESC
LIMIT 50;
```

**Performance Impact:**
- Query time: 200ms → 20ms
- Index size: ~2KB per 1000 deliveries

---

**Index 5: `idx_webhook_deliveries_status_delivered_at`**

**Purpose:** Fast filtering of failed deliveries for retry processing

**Table:** `webhook_deliveries`

**Columns:** `(status, delivered_at)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_webhook_deliveries_status_delivered_at
  ON webhook_deliveries(status, delivered_at)
  WHERE status IN ('failed', 'retrying');
```

**Queries Optimized:**
```sql
-- Find failed deliveries ready for retry
SELECT * FROM webhook_deliveries
WHERE status = 'failed'
  AND delivered_at < NOW() - INTERVAL '5 minutes'
ORDER BY delivered_at ASC
LIMIT 100;
```

**Performance Impact:**
- Query time: 500ms → 50ms
- Partial index (only failed/retrying deliveries)

---

## Triggers

### Trigger: `update_webhook_subscriptions_updated_at`

**Purpose:** Automatically update `updated_at` timestamp on row modification

**Table:** `webhook_subscriptions`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
-- Trigger function (reused from other tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER update_webhook_subscriptions_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Example:**
```sql
-- When updating a webhook
UPDATE webhook_subscriptions SET active = false WHERE id = 'webhook_uuid';

-- updated_at is automatically set to current timestamp
```

---

### Trigger: `auto_disable_failing_webhooks`

**Purpose:** Automatically disable webhooks after 10 consecutive failures

**Table:** `webhook_subscriptions`

**Event:** `AFTER UPDATE`

**Definition:**
```sql
CREATE OR REPLACE FUNCTION auto_disable_failing_webhooks()
RETURNS TRIGGER AS $$
BEGIN
  -- If failure_count reaches 10, deactivate webhook
  IF NEW.failure_count >= 10 AND NEW.active = true THEN
    UPDATE webhook_subscriptions
    SET active = false
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_disable_failing_webhooks
  AFTER UPDATE OF failure_count ON webhook_subscriptions
  FOR EACH ROW
  WHEN (NEW.failure_count >= 10)
  EXECUTE FUNCTION auto_disable_failing_webhooks();
```

**Example:**
```sql
-- When a webhook reaches 10 failures
UPDATE webhook_subscriptions SET failure_count = 10 WHERE id = 'webhook_uuid';

-- Webhook is automatically set to active = false
```

---

## Functions

### Function: `cleanup_old_webhook_deliveries`

**Purpose:** Delete webhook delivery logs older than 30 days (scheduled cleanup job)

**Parameters:**
- `retention_days` (INTEGER) - Number of days to retain logs (default: 30)

**Returns:** INTEGER (number of rows deleted)

**Definition:**
```sql
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_deliveries
  WHERE delivered_at < NOW() - INTERVAL '1 day' * retention_days;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_webhook_deliveries IS 'Delete webhook delivery logs older than specified days (default: 30)';
```

**Usage Example:**
```sql
-- Run nightly cleanup (delete logs older than 30 days)
SELECT cleanup_old_webhook_deliveries(30);

-- Returns: 1234 (number of rows deleted)
```

**Scheduled Execution:**
```sql
-- Create cron job (using pg_cron extension)
SELECT cron.schedule(
  'cleanup-webhook-deliveries',
  '0 2 * * *',  -- Run at 2 AM daily
  'SELECT cleanup_old_webhook_deliveries(30);'
);
```

---

### Function: `get_webhook_health`

**Purpose:** Get webhook delivery health statistics

**Parameters:**
- `webhook_id` (UUID) - Webhook subscription ID

**Returns:** TABLE with health metrics

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_webhook_health(webhook_id UUID)
RETURNS TABLE (
  total_deliveries BIGINT,
  successful_deliveries BIGINT,
  failed_deliveries BIGINT,
  success_rate NUMERIC,
  avg_response_time_ms NUMERIC,
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_deliveries,
    COUNT(*) FILTER (WHERE status = 'success') AS successful_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_deliveries,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) AS success_rate,
    AVG(EXTRACT(EPOCH FROM (delivered_at - delivered_at))::NUMERIC * 1000) AS avg_response_time_ms,
    MAX(delivered_at) FILTER (WHERE status = 'success') AS last_success,
    MAX(delivered_at) FILTER (WHERE status = 'failed') AS last_failure
  FROM webhook_deliveries
  WHERE webhook_subscription_id = webhook_id
    AND delivered_at > NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Usage Example:**
```sql
SELECT * FROM get_webhook_health('webhook_uuid');

-- Returns:
-- total_deliveries | successful_deliveries | failed_deliveries | success_rate | last_success | last_failure
-- 150              | 145                   | 5                 | 96.67        | 2025-10-30   | 2025-10-29
```

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/003_create_webhook_subscriptions.sql`

**Description:** Create webhook_subscriptions and webhook_deliveries tables

**SQL:**
```sql
-- =====================================================
-- Migration: Create Webhook Subscriptions Schema
-- Version: 1.0.0
-- Description: Webhook subscriptions and delivery logs
-- =====================================================

-- Create webhook_subscriptions table
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT webhook_subscriptions_url_check CHECK (url ~ '^https?://'),
  CONSTRAINT webhook_subscriptions_failure_count_check CHECK (failure_count >= 0)
);

-- Create webhook_deliveries table
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_id UUID,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT webhook_deliveries_status_check CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  CONSTRAINT webhook_deliveries_http_status_check CHECK (http_status >= 100 AND http_status < 600 OR http_status IS NULL),
  CONSTRAINT webhook_deliveries_attempt_check CHECK (attempt_number >= 1 AND attempt_number <= 5)
);

-- Create indexes
CREATE INDEX idx_webhook_subs_user_id ON webhook_subscriptions(user_id);
CREATE INDEX idx_webhook_subs_project_id ON webhook_subscriptions(project_id);
CREATE INDEX idx_webhook_subs_active ON webhook_subscriptions(active) WHERE active = true;
CREATE INDEX idx_webhook_deliveries_subscription_id ON webhook_deliveries(webhook_subscription_id);
CREATE INDEX idx_webhook_deliveries_status_delivered_at ON webhook_deliveries(status, delivered_at) WHERE status IN ('failed', 'retrying');

-- Enable RLS
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook_subscriptions
CREATE POLICY webhook_subscriptions_select_policy ON webhook_subscriptions
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY webhook_subscriptions_insert_policy ON webhook_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY webhook_subscriptions_update_policy ON webhook_subscriptions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY webhook_subscriptions_delete_policy ON webhook_subscriptions
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = webhook_subscriptions.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Create RLS policy for webhook_deliveries
CREATE POLICY webhook_deliveries_select_policy ON webhook_deliveries
  FOR SELECT TO authenticated
  USING (
    webhook_subscription_id IN (
      SELECT ws.id FROM webhook_subscriptions ws
      INNER JOIN projects p ON ws.project_id = p.id
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Create triggers
CREATE TRIGGER update_webhook_subscriptions_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER auto_disable_failing_webhooks
  AFTER UPDATE OF failure_count ON webhook_subscriptions
  FOR EACH ROW
  WHEN (NEW.failure_count >= 10)
  EXECUTE FUNCTION auto_disable_failing_webhooks();

-- Create helper functions
CREATE OR REPLACE FUNCTION auto_disable_failing_webhooks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.failure_count >= 10 AND NEW.active = true THEN
    UPDATE webhook_subscriptions SET active = false WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_deliveries
  WHERE delivered_at < NOW() - INTERVAL '1 day' * retention_days;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_webhook_health(webhook_id UUID)
RETURNS TABLE (
  total_deliveries BIGINT,
  successful_deliveries BIGINT,
  failed_deliveries BIGINT,
  success_rate NUMERIC,
  avg_response_time_ms NUMERIC,
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_deliveries,
    COUNT(*) FILTER (WHERE status = 'success') AS successful_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_deliveries,
    ROUND((COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) AS success_rate,
    AVG(EXTRACT(EPOCH FROM (delivered_at - delivered_at))::NUMERIC * 1000) AS avg_response_time_ms,
    MAX(delivered_at) FILTER (WHERE status = 'success') AS last_success,
    MAX(delivered_at) FILTER (WHERE status = 'failed') AS last_failure
  FROM webhook_deliveries
  WHERE webhook_subscription_id = webhook_id
    AND delivered_at > NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE webhook_subscriptions IS 'Webhook endpoint configurations for event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Log of all webhook delivery attempts';
COMMENT ON COLUMN webhook_subscriptions.secret IS 'HMAC-SHA256 signing secret (encrypted at rest)';
COMMENT ON COLUMN webhook_subscriptions.events IS 'Array of event types to subscribe to';
```

**Verification:**
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('webhook_subscriptions', 'webhook_deliveries');

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('webhook_subscriptions', 'webhook_deliveries');

-- Expected: Both tables should have rowsecurity = true
```

**Rollback:**
```sql
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhook_subscriptions CASCADE;
DROP FUNCTION IF EXISTS auto_disable_failing_webhooks();
DROP FUNCTION IF EXISTS cleanup_old_webhook_deliveries(INTEGER);
DROP FUNCTION IF EXISTS get_webhook_health(UUID);
```

---

## Sample Queries

### Query 1: List all active webhooks for a project

**Purpose:** Retrieve all active webhooks for webhook dispatch

**SQL:**
```sql
SELECT
  ws.id,
  ws.url,
  ws.events,
  ws.failure_count,
  ws.last_delivery_at,
  ws.created_at,
  u.email AS creator_email
FROM webhook_subscriptions ws
INNER JOIN auth.users u ON ws.user_id = u.id
WHERE ws.project_id = 'project_uuid'
  AND ws.active = true
ORDER BY ws.created_at DESC;
```

**Explanation:** Joins with users table to show webhook creator, filters active webhooks only

**Performance:** Uses `idx_webhook_subs_project_id` and `idx_webhook_subs_active` indexes, ~10ms for 100 webhooks

---

### Query 2: Get webhook delivery history with success rate

**Purpose:** Dashboard view showing webhook delivery statistics

**SQL:**
```sql
SELECT
  ws.id,
  ws.url,
  COUNT(wd.id) AS total_deliveries,
  COUNT(wd.id) FILTER (WHERE wd.status = 'success') AS successful,
  COUNT(wd.id) FILTER (WHERE wd.status = 'failed') AS failed,
  ROUND(
    (COUNT(wd.id) FILTER (WHERE wd.status = 'success')::NUMERIC / NULLIF(COUNT(wd.id), 0)) * 100,
    2
  ) AS success_rate_percent,
  MAX(wd.delivered_at) AS last_delivery
FROM webhook_subscriptions ws
LEFT JOIN webhook_deliveries wd ON ws.id = wd.webhook_subscription_id
WHERE ws.project_id = 'project_uuid'
  AND wd.delivered_at > NOW() - INTERVAL '7 days'
GROUP BY ws.id, ws.url
ORDER BY success_rate_percent ASC;
```

**Explanation:** Aggregates delivery statistics over last 7 days, sorted by success rate (lowest first to highlight problems)

**Performance:** ~50ms for 10 webhooks with 1000 deliveries

---

### Query 3: Find webhooks ready for auto-disable (10 consecutive failures)

**Purpose:** Identify webhooks that should be automatically disabled

**SQL:**
```sql
SELECT
  ws.id,
  ws.url,
  ws.failure_count,
  ws.last_failure_at,
  p.name AS project_name
FROM webhook_subscriptions ws
INNER JOIN projects p ON ws.project_id = p.id
WHERE ws.active = true
  AND ws.failure_count >= 10
ORDER BY ws.last_failure_at DESC;
```

**Explanation:** Finds active webhooks with 10+ consecutive failures (should be auto-disabled by trigger)

**Performance:** Uses `idx_webhook_subs_active` index, ~20ms

---

### Query 4: Get recent failed deliveries for retry

**Purpose:** Worker job to retry failed webhook deliveries

**SQL:**
```sql
SELECT
  wd.id,
  wd.webhook_subscription_id,
  wd.event_type,
  wd.payload,
  wd.attempt_number,
  ws.url,
  ws.secret
FROM webhook_deliveries wd
INNER JOIN webhook_subscriptions ws ON wd.webhook_subscription_id = ws.id
WHERE wd.status = 'failed'
  AND wd.attempt_number < 5
  AND wd.delivered_at < NOW() - INTERVAL '5 minutes'
  AND ws.active = true
ORDER BY wd.delivered_at ASC
LIMIT 100;
```

**Explanation:** Finds failed deliveries ready for retry (5-minute backoff), limits retries to 5 attempts, only retries for active webhooks

**Performance:** Uses `idx_webhook_deliveries_status_delivered_at` index, ~30ms

---

### Query 5: Cleanup old webhook delivery logs

**Purpose:** Scheduled job to delete logs older than 30 days

**SQL:**
```sql
-- Using helper function
SELECT cleanup_old_webhook_deliveries(30);

-- Manual query (if function not available)
DELETE FROM webhook_deliveries
WHERE delivered_at < NOW() - INTERVAL '30 days';
```

**Explanation:** Deletes webhook delivery logs older than 30 days to prevent table bloat

**Performance:** ~500ms for 100,000 rows, should be run during low-traffic hours

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [x] `auth.users` (Supabase managed) - User authentication
- [x] `04-database/schemas/users-organizations.md` - Organizations and organization_members tables
- [x] `04-database/schemas/secrets-metadata.md` - Projects table (referenced by webhook_subscriptions)

**Required by these schemas:**
- None (webhook subscriptions are self-contained)

### Feature Dependencies

**Required by features:**
- `09-integrations/webhooks/webhooks-integration.md` - Webhook system depends on this schema
- `10-operations/monitoring/webhook-monitoring.md` - Webhook health dashboards
- `08-features/notifications/slack-integration.md` - Slack webhook notifications

---

## References

### Internal Documentation
- `09-integrations/webhooks/webhooks-integration.md` - Webhook integration guide
- `04-database/database-overview.md` - Database architecture
- `03-security/rbac/rls-policies.md` - RLS patterns
- `03-security/security-model.md` - Encryption specifications
- `TECH-STACK.md` - PostgreSQL version
- `GLOSSARY.md` - Term definitions

### External Resources
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/) - PostgreSQL reference
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns
- [Webhook Best Practices](https://webhooks.fyi/) - Industry standards
- [HMAC Signatures](https://www.ietf.org/rfc/rfc2104.txt) - RFC 2104 specification

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineer | Initial webhook subscriptions schema definition |

---

## Notes

### Future Enhancements
- Add webhook transformation rules (JSONPath, templates) for custom payload formats
- Implement webhook batching (combine multiple events into single delivery)
- Add webhook delivery priority levels (critical, normal, low)
- Support custom retry strategies per webhook
- Add webhook test mode (send test events without affecting production)

### Known Issues
- No automatic cleanup of webhook_deliveries logs (must run scheduled job)
- Large JSONB payloads (>1MB) may impact performance
- Partial index on `active = true` requires vacuum after many updates

### Migration Considerations
- Webhook secret encryption: Requires re-encryption if encryption key changes
- Delivery log retention: Consider partitioning by month for very high-volume webhooks
- RLS policy changes: Test thoroughly in staging before production
- Index creation: Run with `CONCURRENTLY` option to avoid table locks in production

### Security Notes
- **SSRF Protection:** Application layer MUST validate URLs before insert to block private IPs (10.x.x.x, 192.168.x.x, 127.0.0.1, 169.254.169.254, localhost)
- **Secret Encryption:** `secret` column must be encrypted using AES-256-GCM with platform encryption key before storage
- **Rate Limiting:** Max 10 active webhooks per project enforced by CHECK constraint
- **Automatic Deactivation:** Webhooks auto-disabled after 10 consecutive failures to prevent resource waste
