---
Document: Webhook Deliveries - Database Schema
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 04-database/schemas/webhook-subscriptions.md, 09-integrations/webhooks/webhooks-integration.md, 04-database/database-overview.md, 03-security/rbac/rls-policies.md
---

# Webhook Deliveries Database Schema

## Overview

This document defines the database schema for webhook delivery logs in the Abyrith platform. The `webhook_deliveries` table stores an immutable audit trail of all webhook delivery attempts, including success/failure status, HTTP response details, and retry information. This schema supports debugging failed deliveries, monitoring webhook health, and compliance auditing for webhook-based integrations with external services (Slack, Discord, email, custom endpoints).

**Schema:** `public`

**Multi-tenancy:** Organization-level isolation via webhook_subscription_id foreign key with RLS enforcement

**Encryption:** No encryption required (contains only metadata and HTTP responses, NO secret values)

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

### Table: `webhook_deliveries`

**Purpose:** Stores an immutable log of all webhook delivery attempts for debugging, monitoring, and audit trails

**Ownership:** Organization (via webhook_subscription_id)

**Definition:**

```sql
CREATE TABLE webhook_deliveries (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  webhook_subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,

  -- Event Information
  event_type TEXT NOT NULL CHECK (event_type IN (
    'secret.created',
    'secret.accessed',
    'secret.updated',
    'secret.deleted',
    'secret.rotated',
    'member.added',
    'member.removed',
    'member.role_changed',
    'project.created',
    'project.archived',
    'mcp.request_approved',
    'mcp.request_denied',
    'security.suspicious_activity'
  )),

  -- Webhook Payload (CRITICAL: MUST NOT contain unencrypted secrets)
  event_data JSONB NOT NULL,

  -- Delivery Status
  status_code INTEGER,  -- HTTP response status: 200, 404, 500, etc., 0 for timeout/network error
  response_body TEXT,   -- First 1000 chars of response body for debugging
  error_message TEXT,   -- Error message if delivery failed (network error, timeout, etc.)

  -- Retry Information
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1 AND attempt_count <= 5),

  -- Timestamps
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status_code CHECK (
    status_code IS NULL OR
    (status_code >= 0 AND status_code < 600)
  ),
  CONSTRAINT delivery_outcome CHECK (
    -- Either successful (status_code 2xx) OR error_message present
    (status_code >= 200 AND status_code < 300) OR
    (error_message IS NOT NULL)
  )
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key for webhook delivery log entry |
| `webhook_subscription_id` | UUID | No | None | Foreign key to webhook_subscriptions table |
| `event_type` | TEXT | No | None | Type of event that triggered webhook (e.g., 'secret.accessed') |
| `event_data` | JSONB | No | None | Webhook payload sent (MUST NOT contain unencrypted secret values) |
| `status_code` | INTEGER | Yes | None | HTTP status code from receiver (200, 404, 500, etc., 0 for network error) |
| `response_body` | TEXT | Yes | None | First 1000 characters of HTTP response body for debugging |
| `error_message` | TEXT | Yes | None | Error message for failed deliveries (timeout, network error, etc.) |
| `attempt_count` | INTEGER | No | 1 | Delivery attempt number (1-5, max 5 retries) |
| `delivered_at` | TIMESTAMPTZ | No | `NOW()` | Timestamp when delivery was attempted |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | Timestamp when log entry was created (same as delivered_at) |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `webhook_deliveries_pkey` | PRIMARY KEY | `(id)` | Unique identifier for each delivery log |
| `webhook_deliveries_subscription_fkey` | FOREIGN KEY | `webhook_subscription_id → webhook_subscriptions(id)` | Links to webhook subscription |
| `event_type_check` | CHECK | `event_type IN (...)` | Validates event type is supported |
| `valid_status_code` | CHECK | `status_code IS NULL OR (status_code >= 0 AND status_code < 600)` | Ensures HTTP status codes are valid (0-599) |
| `delivery_outcome` | CHECK | `(status_code >= 200 AND status_code < 300) OR (error_message IS NOT NULL)` | Ensures failed deliveries have error message |
| `attempt_count_check` | CHECK | `attempt_count >= 1 AND attempt_count <= 5` | Limits retry attempts to 5 |

**Validation Rules:**
- `event_type`: Must be one of 13 supported event types (secret.*, member.*, project.*, mcp.*, security.*)
- `event_data`: JSONB object containing webhook payload, MUST NOT contain plaintext secret values
- `status_code`: Integer 0-599 (0 = network error/timeout, 200-299 = success, 400-599 = HTTP error)
- `response_body`: Max 1000 characters (truncated for storage efficiency and security)
- `error_message`: Required if status_code indicates failure (non-2xx)
- `attempt_count`: 1-5 (max 5 retry attempts per webhook delivery)

**Security Notes:**
- ⚠️ **CRITICAL:** `event_data` MUST NOT contain unencrypted secret values (only metadata: secret name, service, environment)
- ⚠️ **PII WARNING:** `response_body` may contain sensitive data from webhook receiver - truncated to 1000 chars
- ✅ **IMMUTABLE:** Logs are append-only (no UPDATE or DELETE allowed via RLS)
- ✅ **RETENTION:** Auto-delete logs older than 90 days (configurable via scheduled job)

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────────────────┐
│  webhook_subscriptions      │
│  (webhook configurations)   │
└──────────┬──────────────────┘
           │ 1
           │
           │ N
┌──────────▼──────────────────┐
│  webhook_deliveries         │
│  (delivery audit logs)      │
└─────────────────────────────┘
```

### Relationship Details

**webhook_subscriptions → webhook_deliveries**
- Type: One-to-Many
- Foreign Key: `webhook_deliveries.webhook_subscription_id → webhook_subscriptions.id`
- Cascade: `ON DELETE CASCADE`
- Description: Each webhook subscription can have many delivery log entries. When a webhook subscription is deleted, all associated delivery logs are also deleted.

**Rationale for CASCADE:** Delivery logs are tightly coupled to webhook subscriptions. If a user deletes a webhook subscription, the delivery logs are no longer relevant and should be removed to maintain data hygiene.

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes

**Purpose:** Enforce multi-tenancy by restricting access to webhook delivery logs to users within the same organization as the webhook subscription.

**Multi-tenancy Strategy:** Organization-level isolation via `webhook_subscription_id` foreign key relationship. Users can only access delivery logs for webhook subscriptions in their organization.

---

### Table: `webhook_deliveries`

**RLS Policy 1: `webhook_deliveries_select_policy`**

**Purpose:** Allow users to view webhook delivery logs for subscriptions in their organization

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY webhook_deliveries_select_policy ON webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM webhook_subscriptions ws
      WHERE ws.id = webhook_deliveries.webhook_subscription_id
      AND ws.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );
```

**Example Scenario:**
User Jane (Developer in org_123) can view delivery logs for webhook subscriptions in org_123, but cannot view logs for org_456's webhooks.

---

**RLS Policy 2: `webhook_deliveries_insert_policy`**

**Purpose:** Allow only application service role to insert delivery logs (prevents user tampering)

**Operation:** `INSERT`

**Role:** `service_role`

**Definition:**
```sql
CREATE POLICY webhook_deliveries_insert_policy ON webhook_deliveries
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

**Example Scenario:**
Cloudflare Worker (using service role key) can insert delivery logs after attempting webhook delivery. Regular users cannot insert logs.

**Rationale:** Delivery logs are system-generated audit trails and must not be modified by users. Only the application (Cloudflare Workers webhook dispatcher) can insert logs.

---

**RLS Policy 3: `webhook_deliveries_no_update_policy`**

**Purpose:** Prevent all updates to delivery logs (immutable audit trail)

**Operation:** `UPDATE`

**Role:** None (no policy created)

**Definition:** None - no UPDATE policy means no one can update, not even service_role

**Rationale:** Delivery logs are immutable for audit integrity. Once a delivery attempt is logged, it cannot be modified.

---

**RLS Policy 4: `webhook_deliveries_no_delete_policy`**

**Purpose:** Prevent manual deletion of delivery logs (retention handled by scheduled job)

**Operation:** `DELETE`

**Role:** None (no policy created)

**Definition:** None - no DELETE policy means no one can delete manually

**Rationale:** Delivery logs are deleted only by automated retention job (delete logs older than 90 days). Manual deletion would compromise audit trails.

---

### RLS Testing

**Test Case 1: User can view delivery logs for own organization**
```sql
-- As user Jane (org_123)
SET request.jwt.claim.sub = 'user_jane_id';

-- This should succeed (Jane's organization has this webhook subscription)
SELECT * FROM webhook_deliveries
WHERE webhook_subscription_id = 'sub_in_org_123';

-- Expected: Returns delivery logs for webhook subscription in org_123
```

**Test Case 2: User cannot view delivery logs for other organization**
```sql
-- As user Jane (org_123)
SET request.jwt.claim.sub = 'user_jane_id';

-- This should return empty (webhook subscription is in org_456)
SELECT * FROM webhook_deliveries
WHERE webhook_subscription_id = 'sub_in_org_456';

-- Expected: Returns 0 rows (RLS blocks access to other org's logs)
```

**Test Case 3: Users cannot insert delivery logs**
```sql
-- As user Jane
SET request.jwt.claim.sub = 'user_jane_id';

-- This should fail (only service_role can insert)
INSERT INTO webhook_deliveries (webhook_subscription_id, event_type, event_data, status_code)
VALUES ('sub_123', 'secret.accessed', '{"test": true}'::jsonb, 200);

-- Expected: ERROR - permission denied (RLS blocks user insert)
```

**Test Case 4: Users cannot update delivery logs**
```sql
-- As user Jane
SET request.jwt.claim.sub = 'user_jane_id';

-- This should fail (no UPDATE policy)
UPDATE webhook_deliveries SET status_code = 500 WHERE id = 'log_123';

-- Expected: ERROR - permission denied (immutable logs)
```

**Test Case 5: Users cannot delete delivery logs**
```sql
-- As user Jane
SET request.jwt.claim.sub = 'user_jane_id';

-- This should fail (no DELETE policy)
DELETE FROM webhook_deliveries WHERE id = 'log_123';

-- Expected: ERROR - permission denied (retention job only)
```

---

## Indexes

### Performance Indexes

**Index 1: `idx_webhook_deliveries_subscription_id`**

**Purpose:** Optimize queries filtering delivery logs by webhook subscription (most common query pattern)

**Table:** `webhook_deliveries`

**Columns:** `(webhook_subscription_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_webhook_deliveries_subscription_id
  ON webhook_deliveries (webhook_subscription_id);
```

**Queries Optimized:**
```sql
-- Webhook delivery history for a specific subscription
SELECT * FROM webhook_deliveries
WHERE webhook_subscription_id = 'sub_123'
ORDER BY delivered_at DESC
LIMIT 100;
```

**Performance Impact:**
- Query time: ~500ms (full scan) → ~10ms (index scan)
- Index size: ~5-10 MB per 100,000 deliveries

---

**Index 2: `idx_webhook_deliveries_created_at`**

**Purpose:** Optimize retention cleanup job (delete logs older than 90 days)

**Table:** `webhook_deliveries`

**Columns:** `(created_at)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_webhook_deliveries_created_at
  ON webhook_deliveries (created_at);
```

**Queries Optimized:**
```sql
-- Retention cleanup job (runs daily)
DELETE FROM webhook_deliveries
WHERE created_at < NOW() - INTERVAL '90 days';
```

**Performance Impact:**
- Deletion time: ~30s (full scan) → ~2s (index scan)
- Critical for daily cleanup job performance

---

**Index 3: `idx_webhook_deliveries_status`**

**Purpose:** Optimize failure monitoring queries (identify failing webhooks)

**Table:** `webhook_deliveries`

**Columns:** `(status_code)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_webhook_deliveries_status
  ON webhook_deliveries (status_code);
```

**Queries Optimized:**
```sql
-- Identify failed deliveries in last 24 hours
SELECT webhook_subscription_id, COUNT(*) as failure_count
FROM webhook_deliveries
WHERE status_code >= 400
  AND delivered_at > NOW() - INTERVAL '24 hours'
GROUP BY webhook_subscription_id
HAVING COUNT(*) > 10;
```

**Performance Impact:**
- Query time: ~800ms (full scan) → ~15ms (index scan)
- Essential for webhook health monitoring

---

**Index 4: `idx_webhook_deliveries_composite`** (Optional - for complex queries)

**Purpose:** Optimize queries filtering by subscription + time range (webhook history dashboard)

**Table:** `webhook_deliveries`

**Columns:** `(webhook_subscription_id, delivered_at DESC)`

**Type:** B-tree (composite)

**Definition:**
```sql
CREATE INDEX idx_webhook_deliveries_composite
  ON webhook_deliveries (webhook_subscription_id, delivered_at DESC);
```

**Queries Optimized:**
```sql
-- Webhook delivery history with pagination
SELECT * FROM webhook_deliveries
WHERE webhook_subscription_id = 'sub_123'
  AND delivered_at > NOW() - INTERVAL '7 days'
ORDER BY delivered_at DESC
LIMIT 50 OFFSET 0;
```

**Performance Impact:**
- Query time: ~50ms (subscription index + sort) → ~5ms (composite index)
- Index size: ~8-15 MB per 100,000 deliveries
- Trade-off: Increases write overhead (~5-10%)

**Recommendation:** Create this index only if webhook history queries are slow (>100ms p95)

---

## Triggers

### Trigger: `prevent_webhook_delivery_updates`

**Purpose:** Enforce immutability by blocking all UPDATE operations on delivery logs

**Table:** `webhook_deliveries`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
CREATE OR REPLACE FUNCTION prevent_webhook_delivery_updates()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Webhook delivery logs are immutable and cannot be updated';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_webhook_delivery_updates_trigger
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_webhook_delivery_updates();
```

**Example:**
```sql
-- Attempt to update delivery log
UPDATE webhook_deliveries SET status_code = 500 WHERE id = 'log_123';

-- Result: ERROR - Webhook delivery logs are immutable and cannot be updated
```

**Rationale:** Delivery logs are audit trails and must be immutable. This trigger provides defense-in-depth protection even if RLS policies are misconfigured.

---

## Functions

### Function: `cleanup_old_webhook_deliveries`

**Purpose:** Scheduled function to delete webhook delivery logs older than retention period (90 days default)

**Parameters:**
- `retention_days` (INTEGER, default: 90) - Number of days to retain logs

**Returns:** INTEGER (number of rows deleted)

**Definition:**
```sql
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  -- Delete logs older than retention period
  DELETE FROM webhook_deliveries
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
-- Run daily cleanup (default 90 days retention)
SELECT cleanup_old_webhook_deliveries();
-- Returns: 1523 (number of rows deleted)

-- Custom retention (keep only 30 days for high-volume webhooks)
SELECT cleanup_old_webhook_deliveries(30);
-- Returns: 8234 (number of rows deleted)
```

**Security Considerations:**
- **SECURITY DEFINER:** Function runs with owner privileges to bypass RLS (allows deletion)
- **Scheduled Execution:** Should be called by Supabase Edge Function or pg_cron (once daily at 2 AM UTC)
- **Performance:** Uses `idx_webhook_deliveries_created_at` index for fast deletion
- **Logging:** Consider logging deletion count to audit_logs table for compliance

**Scheduled Job Setup (pg_cron):**
```sql
-- Install pg_cron extension (if not already installed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM UTC
SELECT cron.schedule(
  'cleanup-webhook-deliveries',  -- Job name
  '0 2 * * *',                   -- Cron schedule: 2 AM daily
  $$SELECT cleanup_old_webhook_deliveries(90);$$
);
```

---

### Function: `get_webhook_delivery_stats`

**Purpose:** Get delivery statistics for a webhook subscription (success rate, error rate, retry rate)

**Parameters:**
- `subscription_id` (UUID) - Webhook subscription ID
- `time_range_hours` (INTEGER, default: 24) - Time range for statistics

**Returns:** TABLE with stats

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_webhook_delivery_stats(
  subscription_id UUID,
  time_range_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_deliveries BIGINT,
  successful_deliveries BIGINT,
  failed_deliveries BIGINT,
  success_rate NUMERIC,
  error_rate NUMERIC,
  avg_retries NUMERIC,
  most_common_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_deliveries,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::BIGINT AS successful_deliveries,
    COUNT(*) FILTER (WHERE status_code >= 400 OR error_message IS NOT NULL)::BIGINT AS failed_deliveries,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) / NULLIF(COUNT(*), 0),
      2
    ) AS success_rate,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status_code >= 400 OR error_message IS NOT NULL) / NULLIF(COUNT(*), 0),
      2
    ) AS error_rate,
    ROUND(AVG(attempt_count), 2) AS avg_retries,
    (
      SELECT error_message
      FROM webhook_deliveries
      WHERE webhook_subscription_id = subscription_id
        AND error_message IS NOT NULL
        AND delivered_at > NOW() - (time_range_hours || ' hours')::INTERVAL
      GROUP BY error_message
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS most_common_error
  FROM webhook_deliveries
  WHERE webhook_subscription_id = subscription_id
    AND delivered_at > NOW() - (time_range_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
-- Get 24-hour stats for webhook subscription
SELECT * FROM get_webhook_delivery_stats('sub_123');

-- Result:
-- total_deliveries | successful_deliveries | failed_deliveries | success_rate | error_rate | avg_retries | most_common_error
-- 1523             | 1489                  | 34                | 97.77        | 2.23       | 1.15        | "Connection timeout"

-- Get 7-day stats
SELECT * FROM get_webhook_delivery_stats('sub_123', 168);
```

**Security Considerations:**
- **SECURITY DEFINER:** Allows querying delivery stats without exposing raw logs
- **RLS Compatible:** Uses subscription_id which is already filtered by RLS

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/001_create_webhook_deliveries.sql`

**Description:** Create webhook_deliveries table, indexes, RLS policies, triggers, and helper functions

**SQL:**
```sql
-- ============================================================================
-- Migration: Create webhook_deliveries table
-- Version: 1.0.0
-- Description: Webhook delivery audit logs for debugging and monitoring
-- Dependencies: webhook_subscriptions table must exist
-- ============================================================================

-- Create webhook_deliveries table
CREATE TABLE webhook_deliveries (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  webhook_subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,

  -- Event Information
  event_type TEXT NOT NULL CHECK (event_type IN (
    'secret.created',
    'secret.accessed',
    'secret.updated',
    'secret.deleted',
    'secret.rotated',
    'member.added',
    'member.removed',
    'member.role_changed',
    'project.created',
    'project.archived',
    'mcp.request_approved',
    'mcp.request_denied',
    'security.suspicious_activity'
  )),

  -- Webhook Payload (CRITICAL: MUST NOT contain unencrypted secrets)
  event_data JSONB NOT NULL,

  -- Delivery Status
  status_code INTEGER,
  response_body TEXT,
  error_message TEXT,

  -- Retry Information
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1 AND attempt_count <= 5),

  -- Timestamps
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status_code CHECK (
    status_code IS NULL OR
    (status_code >= 0 AND status_code < 600)
  ),
  CONSTRAINT delivery_outcome CHECK (
    (status_code >= 200 AND status_code < 300) OR
    (error_message IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX idx_webhook_deliveries_subscription_id
  ON webhook_deliveries (webhook_subscription_id);

CREATE INDEX idx_webhook_deliveries_created_at
  ON webhook_deliveries (created_at);

CREATE INDEX idx_webhook_deliveries_status
  ON webhook_deliveries (status_code);

-- Enable RLS
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view delivery logs for their organization's webhooks
CREATE POLICY webhook_deliveries_select_policy ON webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM webhook_subscriptions ws
      WHERE ws.id = webhook_deliveries.webhook_subscription_id
      AND ws.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Only service role can insert delivery logs
CREATE POLICY webhook_deliveries_insert_policy ON webhook_deliveries
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create immutability trigger
CREATE OR REPLACE FUNCTION prevent_webhook_delivery_updates()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Webhook delivery logs are immutable and cannot be updated';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_webhook_delivery_updates_trigger
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_webhook_delivery_updates();

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM webhook_deliveries
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create stats function
CREATE OR REPLACE FUNCTION get_webhook_delivery_stats(
  subscription_id UUID,
  time_range_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_deliveries BIGINT,
  successful_deliveries BIGINT,
  failed_deliveries BIGINT,
  success_rate NUMERIC,
  error_rate NUMERIC,
  avg_retries NUMERIC,
  most_common_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_deliveries,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::BIGINT AS successful_deliveries,
    COUNT(*) FILTER (WHERE status_code >= 400 OR error_message IS NOT NULL)::BIGINT AS failed_deliveries,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) / NULLIF(COUNT(*), 0),
      2
    ) AS success_rate,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status_code >= 400 OR error_message IS NOT NULL) / NULLIF(COUNT(*), 0),
      2
    ) AS error_rate,
    ROUND(AVG(attempt_count), 2) AS avg_retries,
    (
      SELECT error_message
      FROM webhook_deliveries
      WHERE webhook_subscription_id = subscription_id
        AND error_message IS NOT NULL
        AND delivered_at > NOW() - (time_range_hours || ' hours')::INTERVAL
      GROUP BY error_message
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS most_common_error
  FROM webhook_deliveries
  WHERE webhook_subscription_id = subscription_id
    AND delivered_at > NOW() - (time_range_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily cleanup job (requires pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule(
--   'cleanup-webhook-deliveries',
--   '0 2 * * *',
--   $$SELECT cleanup_old_webhook_deliveries(90);$$
-- );
```

**Verification:**
```sql
-- Verify table created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'webhook_deliveries';

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'webhook_deliveries';

-- Expected: webhook_deliveries | t (true)

-- Verify indexes created
SELECT indexname FROM pg_indexes
WHERE tablename = 'webhook_deliveries';

-- Expected:
-- idx_webhook_deliveries_subscription_id
-- idx_webhook_deliveries_created_at
-- idx_webhook_deliveries_status

-- Verify functions created
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('cleanup_old_webhook_deliveries', 'get_webhook_delivery_stats');

-- Expected: 2 functions
```

**Rollback:**
```sql
-- Drop scheduled job (if created)
-- SELECT cron.unschedule('cleanup-webhook-deliveries');

-- Drop functions
DROP FUNCTION IF EXISTS get_webhook_delivery_stats(UUID, INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_webhook_deliveries(INTEGER);

-- Drop trigger and function
DROP TRIGGER IF EXISTS prevent_webhook_delivery_updates_trigger ON webhook_deliveries;
DROP FUNCTION IF EXISTS prevent_webhook_delivery_updates();

-- Drop table (CASCADE removes indexes and RLS policies)
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
```

---

## Sample Queries

### Query 1: Recent Delivery Logs for Webhook Subscription

**Purpose:** View last 50 delivery attempts for a webhook subscription (debugging)

**SQL:**
```sql
SELECT
  id,
  event_type,
  status_code,
  CASE
    WHEN status_code >= 200 AND status_code < 300 THEN 'Success'
    WHEN status_code >= 400 AND status_code < 500 THEN 'Client Error'
    WHEN status_code >= 500 THEN 'Server Error'
    WHEN error_message IS NOT NULL THEN 'Network Error'
    ELSE 'Unknown'
  END AS status,
  attempt_count,
  delivered_at,
  error_message
FROM webhook_deliveries
WHERE webhook_subscription_id = 'sub_123'
ORDER BY delivered_at DESC
LIMIT 50;
```

**Explanation:** Retrieves recent delivery logs with human-readable status categorization

**Performance:** ~10ms with `idx_webhook_deliveries_subscription_id` index

---

### Query 2: Failed Deliveries in Last 24 Hours

**Purpose:** Identify webhook subscriptions with delivery failures requiring attention

**SQL:**
```sql
SELECT
  ws.id AS subscription_id,
  ws.url AS webhook_url,
  COUNT(*) AS failure_count,
  COUNT(*) FILTER (WHERE wd.attempt_count >= 5) AS max_retries_reached,
  ARRAY_AGG(DISTINCT wd.error_message) FILTER (WHERE wd.error_message IS NOT NULL) AS error_messages,
  MAX(wd.delivered_at) AS last_failure
FROM webhook_deliveries wd
JOIN webhook_subscriptions ws ON ws.id = wd.webhook_subscription_id
WHERE (wd.status_code >= 400 OR wd.error_message IS NOT NULL)
  AND wd.delivered_at > NOW() - INTERVAL '24 hours'
GROUP BY ws.id, ws.url
HAVING COUNT(*) >= 5  -- Alert threshold: 5+ failures in 24 hours
ORDER BY failure_count DESC;
```

**Explanation:** Aggregates failures by webhook subscription to identify unhealthy webhooks

**Performance:** ~20ms with `idx_webhook_deliveries_status` index

---

### Query 3: Webhook Delivery Success Rate by Event Type

**Purpose:** Monitor which event types have delivery issues

**SQL:**
```sql
SELECT
  event_type,
  COUNT(*) AS total_deliveries,
  COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) AS successful,
  COUNT(*) FILTER (WHERE status_code >= 400 OR error_message IS NOT NULL) AS failed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) / COUNT(*),
    2
  ) AS success_rate_percent
FROM webhook_deliveries
WHERE delivered_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY success_rate_percent ASC;
```

**Explanation:** Identifies event types with low delivery success rates

**Performance:** ~50ms (full scan of 7 days of logs)

---

### Query 4: Cleanup Old Logs (Retention Job)

**Purpose:** Delete webhook delivery logs older than 90 days

**SQL:**
```sql
-- Using helper function (recommended)
SELECT cleanup_old_webhook_deliveries(90);

-- Manual query (if function unavailable)
DELETE FROM webhook_deliveries
WHERE created_at < NOW() - INTERVAL '90 days';
```

**Explanation:** Scheduled job to maintain database size and comply with data retention policies

**Performance:** ~2s with `idx_webhook_deliveries_created_at` index (deletes ~10k-50k rows per day)

---

### Query 5: Average Retry Attempts per Webhook Subscription

**Purpose:** Identify webhook endpoints with frequent retry needs (reliability issues)

**SQL:**
```sql
SELECT
  ws.url AS webhook_url,
  AVG(wd.attempt_count) AS avg_retries,
  COUNT(*) AS total_deliveries,
  COUNT(*) FILTER (WHERE wd.attempt_count > 1) AS deliveries_with_retries,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE wd.attempt_count > 1) / COUNT(*),
    2
  ) AS retry_rate_percent
FROM webhook_deliveries wd
JOIN webhook_subscriptions ws ON ws.id = wd.webhook_subscription_id
WHERE wd.delivered_at > NOW() - INTERVAL '7 days'
GROUP BY ws.url
HAVING AVG(wd.attempt_count) > 1.2  -- Alert threshold: >20% retries
ORDER BY avg_retries DESC;
```

**Explanation:** Highlights webhook endpoints with reliability issues requiring user notification

**Performance:** ~30ms with index

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [x] `webhook_subscriptions` table (Stores webhook configuration)
- [x] `organizations` table (Multi-tenancy foundation)
- [x] `organization_members` table (RLS policy enforcement)
- [x] `auth.users` (Supabase managed) - User authentication

**Required by these schemas:**
- None (webhook_deliveries is a leaf table - audit log only)

### Feature Dependencies

**Required by features:**
- `09-integrations/webhooks/webhooks-integration.md` - Webhook system implementation
- `10-operations/monitoring/webhook-monitoring.md` - Webhook health dashboards

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture and multi-tenancy strategy
- `03-security/rbac/rls-policies.md` - RLS policy patterns and testing
- `09-integrations/webhooks/webhooks-integration.md` - Webhook system architecture
- `04-database/schemas/webhook-subscriptions.md` - Webhook subscription schema (dependency)
- `TECH-STACK.md` - PostgreSQL 15.x specifications
- `GLOSSARY.md` - Webhook, HMAC, RLS definitions

### External Resources
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/15/datatype-json.html) - JSONB data type
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - Row-Level Security
- [pg_cron Extension](https://github.com/citusdata/pg_cron) - Scheduled job management
- [Webhook Best Practices](https://webhooks.fyi/) - Webhook delivery patterns

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineer | Initial webhook_deliveries schema definition with RLS, indexes, triggers, and helper functions |

---

## Notes

### Future Enhancements
- **Partitioning:** If delivery volume exceeds 1M rows per month, consider table partitioning by `created_at` (monthly partitions)
- **Archival:** Move logs older than 90 days to separate archive table for long-term compliance storage
- **Metrics Aggregation:** Pre-aggregate hourly/daily stats to reduce query load for monitoring dashboards
- **Advanced Indexing:** Add GIN index on `event_data` for JSONB queries if needed

### Known Limitations
- Maximum `response_body` length: 1000 characters (truncated for storage efficiency)
- No automatic alert generation (alerts must be implemented in application layer)
- Retention job requires pg_cron extension or manual Supabase Edge Function scheduling
- No built-in replay mechanism (must be implemented in application logic)

### Performance Considerations
- **High Write Volume:** Expect 1-10 writes per second for active webhook systems
- **Index Maintenance:** All indexes update on every INSERT (5-10% write overhead)
- **Cleanup Performance:** Daily deletion of old logs can lock table briefly (run during low-traffic hours)
- **Query Performance:** Optimize queries to use indexes and avoid full table scans

### Data Retention Strategy

**Successful Deliveries:** Retain for 30 days
- Rationale: Short retention for successful deliveries reduces storage costs while maintaining recent audit trail

**Failed Deliveries:** Retain for 90 days
- Rationale: Failed deliveries require longer retention for debugging recurring issues and compliance investigation

**Implementation:**
```sql
-- Differential retention cleanup (run daily)
DELETE FROM webhook_deliveries
WHERE status_code >= 200 AND status_code < 300
  AND created_at < NOW() - INTERVAL '30 days';

DELETE FROM webhook_deliveries
WHERE (status_code >= 400 OR error_message IS NOT NULL)
  AND created_at < NOW() - INTERVAL '90 days';
```

### Security Warnings
- ⚠️ **CRITICAL:** Never log unencrypted secret values in `event_data` field
- ⚠️ **PII:** `response_body` may contain personally identifiable information - truncate to 1000 chars
- ⚠️ **Immutability:** Logs must remain immutable for audit integrity - enforce via RLS and triggers
- ⚠️ **Access Control:** Only organization members should access delivery logs - enforce via RLS
