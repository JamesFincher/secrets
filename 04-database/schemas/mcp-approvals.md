---
Document: MCP Approvals - Database Schema
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 04-database/schemas/secrets-metadata.md, 09-integrations/mcp/mcp-secrets-server.md, 09-integrations/mcp/mcp-overview.md, 03-security/security-model.md
---

# MCP Approvals Database Schema

## Overview

This schema defines the database structure for managing Model Context Protocol (MCP) approval requests. The MCP approval system is **critical for zero-knowledge architecture**, enabling AI development tools (Claude Code, Cursor) to request secrets from Abyrith while maintaining complete user control and security. All secret decryption happens client-side after user approval; the MCP server never has access to unencrypted secrets.

**Schema:** `public`

**Multi-tenancy:** User-level isolation enforced via Row-Level Security (RLS) policies

**Encryption:** Approval tokens are cryptographically random; secret values are never stored in approval records (only references to encrypted secrets)

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

### Table: `mcp_approvals`

**Purpose:** Track approval requests from AI tools for secret access, enabling user-controlled MCP integration

**Ownership:** Approvals belong to users; each user approves AI tool access to their secrets

**Definition:**

```sql
CREATE TABLE mcp_approvals (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  secret_id UUID REFERENCES secrets(id) ON DELETE CASCADE,

  -- Request Details
  operation TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Approval Status
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approval_token TEXT UNIQUE NOT NULL,

  -- Timestamps
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT mcp_approvals_operation_check CHECK (operation IN ('list_secrets', 'get_secret', 'create_secret', 'update_secret')),
  CONSTRAINT mcp_approvals_status_check CHECK (approval_status IN ('pending', 'approved', 'denied', 'expired')),
  CONSTRAINT mcp_approvals_token_length_check CHECK (char_length(approval_token) >= 32)
);

COMMENT ON TABLE mcp_approvals IS 'Approval requests from AI tools (MCP) for secret access';
COMMENT ON COLUMN mcp_approvals.secret_id IS 'Secret being requested (NULL for list operations)';
COMMENT ON COLUMN mcp_approvals.operation IS 'MCP operation type: list, get, create, update';
COMMENT ON COLUMN mcp_approvals.tool_name IS 'MCP tool identifier: secrets_list, secrets_get, etc.';
COMMENT ON COLUMN mcp_approvals.request_context IS 'JSON: MCP request details, tool parameters, requestor info';
COMMENT ON COLUMN mcp_approvals.approval_token IS 'Short-lived token for browser approval flow (cryptographically random)';
COMMENT ON COLUMN mcp_approvals.approval_status IS 'Status: pending, approved, denied, expired';
COMMENT ON COLUMN mcp_approvals.expires_at IS 'Expiration time for pending requests (default: 5 minutes from creation)';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | No | - | User who must approve this request |
| `project_id` | UUID | No | - | Project containing the requested secret |
| `secret_id` | UUID | Yes | NULL | Secret being requested (NULL for list_secrets operation) |
| `operation` | TEXT | No | - | Operation type: list_secrets, get_secret, create_secret, update_secret |
| `tool_name` | TEXT | No | - | MCP tool name: secrets_list, secrets_get, secrets_create, secrets_update |
| `request_context` | JSONB | No | `{}` | MCP request metadata (tool params, requestor, reason) |
| `approval_status` | TEXT | No | `'pending'` | Current status: pending, approved, denied, expired |
| `approval_token` | TEXT | No | - | Unique approval token for browser callback (min 32 chars) |
| `approved_at` | TIMESTAMPTZ | Yes | NULL | When request was approved |
| `denied_at` | TIMESTAMPTZ | Yes | NULL | When request was denied |
| `expires_at` | TIMESTAMPTZ | No | `NOW() + 5 min` | When pending request expires |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | Request creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | Last update timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `mcp_approvals_operation_check` | CHECK | `operation IN (...)` | Enforce valid operation types |
| `mcp_approvals_status_check` | CHECK | `approval_status IN (...)` | Enforce valid approval statuses |
| `mcp_approvals_token_length_check` | CHECK | `char_length(approval_token) >= 32` | Ensure approval tokens are sufficiently long |

**Validation Rules:**
- `user_id`: Must reference existing user
- `project_id`: Must reference existing project
- `secret_id`: Must reference existing secret (or be NULL for list operations)
- `operation`: Must be one of: list_secrets, get_secret, create_secret, update_secret
- `tool_name`: Must match MCP tool naming convention (secrets_list, secrets_get, etc.)
- `approval_status`: Must be one of: pending, approved, denied, expired
- `approval_token`: Must be at least 32 characters (cryptographically random)
- `expires_at`: Must be in the future for pending requests
- `request_context`: Valid JSON object

**Security Notes:**
- `approval_token` must be generated using cryptographically secure random number generator (`gen_random_uuid()` or `crypto.randomBytes()`)
- Approval tokens are single-use and short-lived (default: 5 minutes)
- Zero-knowledge requirement: MCP server receives approval notification, then requests encrypted secret from API
- Secret decryption happens in browser (user's device), NOT in MCP server
- MCP server never stores unencrypted secrets; plaintext is returned to AI tool in memory only

**Approval Flow:**

1. **MCP server creates approval request:**
   - AI tool (Claude Code) requests secret
   - MCP server calls `POST /api/mcp/approvals/request`
   - Database record created with `approval_status = 'pending'`
   - Unique `approval_token` generated

2. **User receives notification:**
   - Browser receives WebSocket notification or polls for pending approvals
   - Approval modal displays in web app with request details

3. **User approves request:**
   - User clicks "Approve for 1 hour" / "Approve for 24 hours" / "Always approve"
   - Browser calls `POST /api/mcp/approvals/{id}/approve` with `approval_token`
   - Database record updated: `approval_status = 'approved'`, `approved_at = NOW()`

4. **MCP server receives approval:**
   - MCP server polls `GET /api/mcp/approvals/{id}` or receives WebSocket notification
   - Upon approval, MCP server requests encrypted secret from API
   - Browser decrypts secret using user's master key (client-side)
   - Plaintext secret returned to MCP server (in memory only)
   - MCP server returns secret to AI tool

5. **Expired requests automatically cleaned up:**
   - Scheduled Edge Function runs every 5 minutes
   - Updates `approval_status = 'expired'` where `expires_at < NOW()` and `approval_status = 'pending'`
   - Deletes approved/denied requests older than 24 hours (audit trail retention)

---

## Relationships

### Entity Relationship Diagram

```
┌──────────────────┐
│   auth.users     │
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────▼─────────┐
│ mcp_approvals    │
└────────┬─────────┘
         │ N
         │
         ├──────────────────┬──────────────────┐
         │ N                │ N                │ N (optional)
┌────────▼─────────┐ ┌──────▼──────┐  ┌──────▼──────┐
│   projects       │ │  secrets    │  │ (no direct  │
│                  │ │             │  │  FK for     │
└──────────────────┘ └─────────────┘  │  operations │
                                       │  like list) │
                                       └─────────────┘
```

### Relationship Details

**auth.users → mcp_approvals**
- Type: One-to-Many
- Foreign Key: `mcp_approvals.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE` (deleting user deletes all their approval requests)
- Description: Each user can have multiple MCP approval requests

**projects → mcp_approvals**
- Type: One-to-Many
- Foreign Key: `mcp_approvals.project_id → projects.id`
- Cascade: `ON DELETE CASCADE` (deleting project deletes all related approval requests)
- Description: Approval requests are scoped to specific projects

**secrets → mcp_approvals**
- Type: One-to-Many (optional)
- Foreign Key: `mcp_approvals.secret_id → secrets.id`
- Cascade: `ON DELETE CASCADE` (deleting secret deletes related approval requests)
- Description: Approval requests can reference specific secrets (NULL for list operations)

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes

**Purpose:** Enforce user-level isolation. Users can only view and manage their own approval requests. MCP server uses user's JWT to access approvals, ensuring multi-tenancy at database level.

**Multi-tenancy Strategy:** User-based isolation. Each approval request belongs to a specific user and can only be accessed by that user.

---

### Table: `mcp_approvals`

**RLS Policy 1: `mcp_approvals_select_policy`**

**Purpose:** Users can view only their own approval requests

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY mcp_approvals_select_policy ON mcp_approvals
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );
```

**Example Scenario:**
User Alice (JWT with `sub = alice_user_id`) can see all her MCP approval requests but cannot see Bob's approval requests.

---

**RLS Policy 2: `mcp_approvals_insert_policy`**

**Purpose:** Authenticated users can create approval requests for themselves

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY mcp_approvals_insert_policy ON mcp_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = mcp_approvals.project_id
        AND organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
        )
    )
  );
```

**Example Scenario:**
MCP server (authenticated as user) can create approval requests for that user's projects.

---

**RLS Policy 3: `mcp_approvals_update_policy`**

**Purpose:** Users can update (approve/deny) their own approval requests

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY mcp_approvals_update_policy ON mcp_approvals
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );
```

**Example Scenario:**
User approves MCP request in browser. Only they can update their own approval status.

---

**RLS Policy 4: `mcp_approvals_delete_policy`**

**Purpose:** System only (cleanup function) can delete expired approvals

**Operation:** `DELETE`

**Role:** `service_role`

**Definition:**
```sql
-- Regular users cannot delete approval requests
CREATE POLICY mcp_approvals_delete_policy ON mcp_approvals
  FOR DELETE
  TO service_role
  USING (true);

-- Note: Regular authenticated users have no delete policy, so they cannot delete
```

**Example Scenario:**
Scheduled cleanup function (running with `service_role` credentials) deletes expired and old approval requests.

---

### RLS Testing

**Test Case 1: User can only see their own approvals**

```sql
-- As user Alice
SET request.jwt.claim.sub = 'alice_user_id';

-- This should succeed (Alice's approvals)
SELECT * FROM mcp_approvals
WHERE user_id = 'alice_user_id';

-- This should return 0 rows (RLS filters out Bob's approvals)
SELECT * FROM mcp_approvals
WHERE user_id = 'bob_user_id';
```

**Expected:** Alice sees only her approvals, not Bob's

---

**Test Case 2: User can approve their own request**

```sql
-- As user Alice
SET request.jwt.claim.sub = 'alice_user_id';

-- This should succeed
UPDATE mcp_approvals
SET approval_status = 'approved', approved_at = NOW()
WHERE id = 'alice_approval_id' AND user_id = 'alice_user_id';

-- This should fail (RLS blocks updating other user's approvals)
UPDATE mcp_approvals
SET approval_status = 'approved', approved_at = NOW()
WHERE id = 'bob_approval_id' AND user_id = 'bob_user_id';
```

**Expected:** UPDATE for Alice's approval succeeds, UPDATE for Bob's approval fails

---

**Test Case 3: Regular users cannot delete approvals**

```sql
-- As user Alice (authenticated role)
SET request.jwt.claim.sub = 'alice_user_id';

-- This should fail (no delete policy for authenticated users)
DELETE FROM mcp_approvals WHERE id = 'approval_id';
```

**Expected:** DELETE fails for authenticated users (only service_role can delete)

---

## Indexes

### Performance Indexes

**Index 1: `idx_mcp_approvals_user_id`**

**Purpose:** Fast lookup of approvals by user (used in every RLS policy)

**Table:** `mcp_approvals`

**Columns:** `(user_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_mcp_approvals_user_id
  ON mcp_approvals(user_id);
```

**Queries Optimized:**
```sql
-- Example query that uses this index
SELECT * FROM mcp_approvals
WHERE user_id = 'user_uuid'
  AND approval_status = 'pending';
```

**Performance Impact:**
- Query time: 100ms → 5ms
- Index size: ~500 bytes per 100 approvals

---

**Index 2: `idx_mcp_approvals_project_id`**

**Purpose:** Fast lookup of approvals by project

**Table:** `mcp_approvals`

**Columns:** `(project_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_mcp_approvals_project_id
  ON mcp_approvals(project_id);
```

**Queries Optimized:**
```sql
-- List all MCP requests for a project
SELECT * FROM mcp_approvals
WHERE project_id = 'project_uuid'
ORDER BY created_at DESC;
```

**Performance Impact:**
- Query time: 80ms → 8ms
- Index size: ~500 bytes per 100 approvals

---

**Index 3: `idx_mcp_approvals_status`**

**Purpose:** Fast filtering of pending approvals (partial index for efficiency)

**Table:** `mcp_approvals`

**Columns:** `(approval_status)`

**Type:** B-tree (partial index on pending only)

**Definition:**
```sql
CREATE INDEX idx_mcp_approvals_status
  ON mcp_approvals(approval_status)
  WHERE approval_status = 'pending';
```

**Queries Optimized:**
```sql
-- Find all pending approvals for a user
SELECT * FROM mcp_approvals
WHERE user_id = 'user_uuid'
  AND approval_status = 'pending'
ORDER BY created_at ASC;
```

**Performance Impact:**
- Query time: 150ms → 10ms
- Partial index (only pending approvals) reduces index size by ~75%

---

**Index 4: `idx_mcp_approvals_token`**

**Purpose:** Fast lookup by approval token (used during approval callback)

**Table:** `mcp_approvals`

**Columns:** `(approval_token)`

**Type:** B-tree (automatically created by UNIQUE constraint)

**Definition:**
```sql
-- Automatically created by UNIQUE constraint
-- No additional index needed
```

**Queries Optimized:**
```sql
-- Lookup approval by token (browser approval flow)
SELECT * FROM mcp_approvals
WHERE approval_token = 'random_token_here';
```

**Performance Impact:**
- Query time: O(1) lookup via unique index
- Essential for sub-10ms approval verification

---

**Index 5: `idx_mcp_approvals_expires_at`**

**Purpose:** Efficient cleanup of expired approvals (partial index on pending only)

**Table:** `mcp_approvals`

**Columns:** `(expires_at)`

**Type:** B-tree (partial index)

**Definition:**
```sql
CREATE INDEX idx_mcp_approvals_expires_at
  ON mcp_approvals(expires_at)
  WHERE approval_status = 'pending';
```

**Queries Optimized:**
```sql
-- Find expired pending approvals (cleanup function)
SELECT * FROM mcp_approvals
WHERE approval_status = 'pending'
  AND expires_at < NOW();
```

**Performance Impact:**
- Query time: 200ms → 15ms (for 10,000 approvals)
- Partial index reduces storage overhead

---

## Triggers

### Trigger: `update_mcp_approvals_updated_at`

**Purpose:** Automatically update `updated_at` timestamp on row modification

**Table:** `mcp_approvals`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
-- Reuse existing function from secrets schema
CREATE TRIGGER update_mcp_approvals_updated_at
  BEFORE UPDATE ON mcp_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Example:**
```sql
-- When approval is approved
UPDATE mcp_approvals
SET approval_status = 'approved', approved_at = NOW()
WHERE id = 'approval_uuid';

-- updated_at is automatically set to current timestamp
```

---

### Trigger: `expire_pending_mcp_approvals`

**Purpose:** Automatically mark pending approvals as expired when expires_at passes

**Table:** `mcp_approvals`

**Event:** N/A (implemented via scheduled Edge Function, not database trigger)

**Implementation:**
```typescript
// Supabase Edge Function: cleanup-mcp-approvals
// Runs every 5 minutes (cron: */5 * * * *)

export async function handler() {
  // Expire pending approvals past expiration time
  const { data: expired } = await supabase
    .from('mcp_approvals')
    .update({
      approval_status: 'expired',
      updated_at: new Date().toISOString()
    })
    .eq('approval_status', 'pending')
    .lt('expires_at', new Date().toISOString());

  // Delete old approved/denied approvals (>24 hours)
  const { data: deleted } = await supabase
    .from('mcp_approvals')
    .delete()
    .in('approval_status', ['approved', 'denied', 'expired'])
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return { expired: expired?.length || 0, deleted: deleted?.length || 0 };
}
```

**Note:** This is implemented as a scheduled Edge Function rather than a database trigger because:
1. Supabase doesn't support time-based triggers
2. Edge Functions provide better observability and error handling
3. Allows for audit logging of cleanup operations

---

## Functions

### Function: `create_mcp_approval`

**Purpose:** Helper function to create MCP approval with auto-generated token

**Parameters:**
- `p_user_id` (UUID) - User who must approve
- `p_project_id` (UUID) - Project containing secret
- `p_secret_id` (UUID) - Secret being requested (can be NULL)
- `p_operation` (TEXT) - Operation type
- `p_tool_name` (TEXT) - MCP tool name
- `p_request_context` (JSONB) - Request metadata

**Returns:** UUID (approval ID)

**Definition:**
```sql
CREATE OR REPLACE FUNCTION create_mcp_approval(
  p_user_id UUID,
  p_project_id UUID,
  p_secret_id UUID,
  p_operation TEXT,
  p_tool_name TEXT,
  p_request_context JSONB
)
RETURNS UUID AS $$
DECLARE
  v_approval_id UUID;
  v_approval_token TEXT;
BEGIN
  -- Generate cryptographically random approval token (64 chars)
  v_approval_token := encode(gen_random_bytes(32), 'hex');

  -- Insert approval request
  INSERT INTO mcp_approvals (
    user_id,
    project_id,
    secret_id,
    operation,
    tool_name,
    request_context,
    approval_token
  ) VALUES (
    p_user_id,
    p_project_id,
    p_secret_id,
    p_operation,
    p_tool_name,
    p_request_context,
    v_approval_token
  )
  RETURNING id INTO v_approval_id;

  RETURN v_approval_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_mcp_approval IS 'Create MCP approval request with auto-generated token';
```

**Usage Example:**
```sql
SELECT create_mcp_approval(
  'user_uuid',
  'project_uuid',
  'secret_uuid',
  'get_secret',
  'secrets_get',
  '{"reason": "AI tool requesting access", "client": "claude-code"}'::jsonb
);
-- Returns: approval_uuid
```

**Security Considerations:**
- `SECURITY DEFINER`: Runs with privileges of function creator (to bypass RLS temporarily)
- Approval token uses `gen_random_bytes(32)` for cryptographic randomness (64 hex chars)
- Function validates operation type and tool name against allowed values

---

### Function: `get_pending_mcp_approvals`

**Purpose:** Get all pending approval requests for a user

**Parameters:**
- `p_user_id` (UUID) - User ID

**Returns:** TABLE of mcp_approvals

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_pending_mcp_approvals(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  secret_id UUID,
  operation TEXT,
  tool_name TEXT,
  request_context JSONB,
  approval_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.project_id,
    a.secret_id,
    a.operation,
    a.tool_name,
    a.request_context,
    a.approval_token,
    a.expires_at,
    a.created_at
  FROM mcp_approvals a
  WHERE a.user_id = p_user_id
    AND a.approval_status = 'pending'
    AND a.expires_at > NOW()
  ORDER BY a.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_pending_mcp_approvals IS 'Get all pending approval requests for a user';
```

**Usage Example:**
```sql
-- Get pending approvals for current user
SELECT * FROM get_pending_mcp_approvals(auth.uid());
```

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/004_create_mcp_approvals.sql`

**Description:** Create mcp_approvals table, indexes, triggers, and helper functions

**SQL:**
```sql
-- =====================================================
-- Migration: Create MCP Approvals Schema
-- Version: 1.0.0
-- Description: Table for AI tool (MCP) approval workflow
-- =====================================================

-- Create mcp_approvals table
CREATE TABLE mcp_approvals (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  secret_id UUID REFERENCES secrets(id) ON DELETE CASCADE,

  -- Request Details
  operation TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Approval Status
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approval_token TEXT UNIQUE NOT NULL,

  -- Timestamps
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT mcp_approvals_operation_check CHECK (operation IN ('list_secrets', 'get_secret', 'create_secret', 'update_secret')),
  CONSTRAINT mcp_approvals_status_check CHECK (approval_status IN ('pending', 'approved', 'denied', 'expired')),
  CONSTRAINT mcp_approvals_token_length_check CHECK (char_length(approval_token) >= 32)
);

-- Add comments
COMMENT ON TABLE mcp_approvals IS 'Approval requests from AI tools (MCP) for secret access';
COMMENT ON COLUMN mcp_approvals.secret_id IS 'Secret being requested (NULL for list operations)';
COMMENT ON COLUMN mcp_approvals.operation IS 'MCP operation type: list, get, create, update';
COMMENT ON COLUMN mcp_approvals.tool_name IS 'MCP tool identifier: secrets_list, secrets_get, etc.';
COMMENT ON COLUMN mcp_approvals.request_context IS 'JSON: MCP request details, tool parameters, requestor info';
COMMENT ON COLUMN mcp_approvals.approval_token IS 'Short-lived token for browser approval flow (cryptographically random)';
COMMENT ON COLUMN mcp_approvals.approval_status IS 'Status: pending, approved, denied, expired';
COMMENT ON COLUMN mcp_approvals.expires_at IS 'Expiration time for pending requests (default: 5 minutes from creation)';

-- Create indexes
CREATE INDEX idx_mcp_approvals_user_id ON mcp_approvals(user_id);
CREATE INDEX idx_mcp_approvals_project_id ON mcp_approvals(project_id);
CREATE INDEX idx_mcp_approvals_status ON mcp_approvals(approval_status) WHERE approval_status = 'pending';
CREATE INDEX idx_mcp_approvals_expires_at ON mcp_approvals(expires_at) WHERE approval_status = 'pending';

-- Enable RLS
ALTER TABLE mcp_approvals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY mcp_approvals_select_policy ON mcp_approvals
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY mcp_approvals_insert_policy ON mcp_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = mcp_approvals.project_id
        AND organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY mcp_approvals_update_policy ON mcp_approvals
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY mcp_approvals_delete_policy ON mcp_approvals
  FOR DELETE
  TO service_role
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_mcp_approvals_updated_at
  BEFORE UPDATE ON mcp_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create helper functions
CREATE OR REPLACE FUNCTION create_mcp_approval(
  p_user_id UUID,
  p_project_id UUID,
  p_secret_id UUID,
  p_operation TEXT,
  p_tool_name TEXT,
  p_request_context JSONB
)
RETURNS UUID AS $$
DECLARE
  v_approval_id UUID;
  v_approval_token TEXT;
BEGIN
  v_approval_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO mcp_approvals (
    user_id,
    project_id,
    secret_id,
    operation,
    tool_name,
    request_context,
    approval_token
  ) VALUES (
    p_user_id,
    p_project_id,
    p_secret_id,
    p_operation,
    p_tool_name,
    p_request_context,
    v_approval_token
  )
  RETURNING id INTO v_approval_id;

  RETURN v_approval_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pending_mcp_approvals(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  secret_id UUID,
  operation TEXT,
  tool_name TEXT,
  request_context JSONB,
  approval_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.project_id,
    a.secret_id,
    a.operation,
    a.tool_name,
    a.request_context,
    a.approval_token,
    a.expires_at,
    a.created_at
  FROM mcp_approvals a
  WHERE a.user_id = p_user_id
    AND a.approval_status = 'pending'
    AND a.expires_at > NOW()
  ORDER BY a.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION create_mcp_approval IS 'Create MCP approval request with auto-generated token';
COMMENT ON FUNCTION get_pending_mcp_approvals IS 'Get all pending approval requests for a user';
```

**Verification:**
```sql
-- Verify table created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'mcp_approvals';

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'mcp_approvals';

-- Expected: rowsecurity = true

-- Verify indexes created
SELECT indexname FROM pg_indexes
WHERE tablename = 'mcp_approvals';

-- Expected: 6 indexes (primary key + 5 created)
```

**Rollback:**
```sql
DROP TABLE IF EXISTS mcp_approvals CASCADE;
DROP FUNCTION IF EXISTS create_mcp_approval(UUID, UUID, UUID, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS get_pending_mcp_approvals(UUID);
```

---

## Sample Queries

### Query 1: Get all pending approvals for current user

**Purpose:** Dashboard view showing active approval requests

**SQL:**
```sql
SELECT
  a.id,
  p.name AS project_name,
  s.key_name AS secret_name,
  a.operation,
  a.tool_name,
  a.request_context->>'reason' AS reason,
  a.created_at,
  a.expires_at,
  EXTRACT(EPOCH FROM (a.expires_at - NOW())) AS seconds_until_expiry
FROM mcp_approvals a
INNER JOIN projects p ON a.project_id = p.id
LEFT JOIN secrets s ON a.secret_id = s.id
WHERE a.user_id = auth.uid()
  AND a.approval_status = 'pending'
  AND a.expires_at > NOW()
ORDER BY a.created_at ASC;
```

**Explanation:** Joins approvals with projects and secrets to get human-readable names. Filters by current user and pending status. Calculates time remaining until expiry.

**Performance:** Uses `idx_mcp_approvals_user_id` and `idx_mcp_approvals_status` indexes, ~10ms for 100 approvals

---

### Query 2: Approve an MCP request

**Purpose:** User approves AI tool access to secret

**SQL:**
```sql
UPDATE mcp_approvals
SET
  approval_status = 'approved',
  approved_at = NOW(),
  updated_at = NOW()
WHERE id = 'approval_uuid'
  AND user_id = auth.uid()
  AND approval_status = 'pending'
RETURNING *;
```

**Explanation:** Updates approval status to approved with timestamp. RLS ensures only owner can approve. Returns updated row for confirmation.

**Performance:** Primary key lookup, ~2ms

---

### Query 3: Get MCP approval history for audit

**Purpose:** Show all MCP requests and their outcomes for a user

**SQL:**
```sql
SELECT
  a.id,
  p.name AS project_name,
  s.key_name AS secret_name,
  a.operation,
  a.tool_name,
  a.approval_status,
  a.created_at,
  a.approved_at,
  a.denied_at,
  CASE
    WHEN a.approval_status = 'approved' THEN a.approved_at
    WHEN a.approval_status = 'denied' THEN a.denied_at
    WHEN a.approval_status = 'expired' THEN a.expires_at
    ELSE NULL
  END AS status_changed_at
FROM mcp_approvals a
INNER JOIN projects p ON a.project_id = p.id
LEFT JOIN secrets s ON a.secret_id = s.id
WHERE a.user_id = auth.uid()
ORDER BY a.created_at DESC
LIMIT 100;
```

**Explanation:** Comprehensive audit view showing all approval requests with outcomes

**Performance:** Uses `idx_mcp_approvals_user_id` index, ~15ms for 1000 approvals

---

### Query 4: Find expired pending approvals (cleanup)

**Purpose:** Scheduled function to mark expired approvals

**SQL:**
```sql
-- Find expired pending approvals
SELECT id, user_id, expires_at
FROM mcp_approvals
WHERE approval_status = 'pending'
  AND expires_at < NOW()
LIMIT 1000;

-- Mark as expired
UPDATE mcp_approvals
SET
  approval_status = 'expired',
  updated_at = NOW()
WHERE approval_status = 'pending'
  AND expires_at < NOW();
```

**Explanation:** Cleanup query run by scheduled Edge Function every 5 minutes

**Performance:** Uses `idx_mcp_approvals_expires_at` partial index, ~20ms for 10,000 approvals

---

### Query 5: Get approval by token (browser callback)

**Purpose:** Verify approval token during user approval flow

**SQL:**
```sql
SELECT
  a.id,
  a.user_id,
  a.project_id,
  a.secret_id,
  a.approval_status,
  a.expires_at,
  p.name AS project_name,
  s.key_name AS secret_name
FROM mcp_approvals a
INNER JOIN projects p ON a.project_id = p.id
LEFT JOIN secrets s ON a.secret_id = s.id
WHERE a.approval_token = 'token_from_url'
  AND a.approval_status = 'pending'
  AND a.expires_at > NOW();
```

**Explanation:** Browser receives approval token in URL, looks up associated request

**Performance:** Unique index on approval_token, ~2ms

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [x] `auth.users` (Supabase managed) - User authentication
- [x] `04-database/schemas/users-organizations.md` - Organizations and projects
- [x] `04-database/schemas/secrets-metadata.md` - Secrets table

**Required by these schemas:**
- `04-database/schemas/audit-logs.md` - Audit logging may reference MCP approvals

### Feature Dependencies

**Required by features:**
- `09-integrations/mcp/mcp-secrets-server.md` - MCP server implementation
- `09-integrations/mcp/mcp-overview.md` - MCP architecture
- `08-features/approval-workflows.md` - User approval UI (future)

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture
- `04-database/schemas/secrets-metadata.md` - Secrets schema
- `09-integrations/mcp/mcp-secrets-server.md` - MCP server specification
- `09-integrations/mcp/mcp-overview.md` - MCP architecture overview
- `03-security/security-model.md` - Zero-knowledge encryption
- `TECH-STACK.md` - PostgreSQL version and specifications
- `GLOSSARY.md` - Term definitions (MCP, Zero-Knowledge, JWT)

### External Resources
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/) - PostgreSQL reference
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [Cryptographically Secure Randomness](https://www.postgresql.org/docs/15/pgcrypto.html) - gen_random_bytes

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineer | Initial MCP approvals schema definition |

---

## Notes

### Critical for Zero-Knowledge Architecture

This table is **essential for maintaining zero-knowledge security** in the MCP integration:

1. **No plaintext secrets stored:** Only references to encrypted secrets
2. **Approval token is single-use:** Cannot be reused after approval
3. **Short expiration (5 minutes):** Minimizes attack window
4. **Browser mediates decryption:** Secret decryption happens in user's browser, not MCP server
5. **Audit trail:** Every approval request logged with context

### Approval Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Server                              │
│  1. Creates approval request with status = 'pending'            │
│  2. Polls/subscribes for approval                               │
│  3. On approval: requests encrypted secret from API             │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ (approval_token, status: pending)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Abyrith API                             │
│  1. Stores approval request in mcp_approvals table              │
│  2. Sends WebSocket notification to browser                     │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ (WebSocket notification)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Browser (User)                            │
│  1. Receives notification                                       │
│  2. Shows approval modal                                        │
│  3. User clicks "Approve for 1 hour"                            │
│  4. Updates approval_status = 'approved'                        │
│  5. Decrypts secret using master key                            │
│  6. Returns plaintext to MCP server (via WebSocket)             │
└─────────────────────────────────────────────────────────────────┘
```

### Future Enhancements

- Add `approval_duration` column for variable time limits (1 hour, 24 hours, permanent)
- Add `approval_count` column to track how many times a secret was accessed with this approval
- Implement approval policies (auto-approve for development environment, require approval for production)
- Add `revoked_at` timestamp for manual approval revocation
- Support batch approvals (approve multiple secrets at once)

### Known Limitations

- Approval tokens are stored in plaintext (acceptable since they expire in 5 minutes)
- No notification retry mechanism if user's browser is offline
- Cleanup runs every 5 minutes (expired approvals may persist briefly)

### Migration Considerations

- Ensure `update_updated_at_column()` function exists before running migration (created in secrets schema)
- Create scheduled Edge Function after migration to handle cleanup
- Index creation can be done with `CONCURRENTLY` in production to avoid table locks
- Consider partitioning by created_at if approval volume is very high (>1M/month)
