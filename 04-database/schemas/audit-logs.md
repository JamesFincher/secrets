---
Document: Audit Logs - Database Schema
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 04-database/schemas/secrets-metadata.md, 03-security/rbac/rls-policies.md, GLOSSARY.md, TECH-STACK.md
---

# Audit Logs Database Schema

## Overview

This schema defines the audit and activity tracking system for Abyrith, ensuring comprehensive, tamper-proof logging of all actions within the platform. Audit logs are critical for security monitoring, compliance (SOC 2, GDPR, ISO 27001), forensic investigation, and user transparency. All logs are immutable (INSERT-only) to ensure they cannot be tampered with after creation.

**Schema:** public

**Multi-tenancy:** Organization-level isolation with user-level access for personal audit logs

**Encryption:** Audit logs contain metadata only (no secret values). Events are logged in plaintext for compliance export and searchability. Secret values are never logged.

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

### Table: `audit_logs`

**Purpose:** Comprehensive immutable audit trail of all user actions in the system

**Ownership:** System-managed (users cannot modify their own audit logs)

**Definition:**

```sql
CREATE TABLE audit_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,

  -- Event Data
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  session_id TEXT,

  -- Additional Metadata (flexible JSONB for event-specific data)
  metadata JSONB DEFAULT '{}',

  -- Result
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'secret.created',
    'secret.read',
    'secret.updated',
    'secret.deleted',
    'project.created',
    'project.updated',
    'project.deleted',
    'organization.created',
    'organization.updated',
    'organization.deleted',
    'member.invited',
    'member.removed',
    'member.role_changed',
    'auth.login',
    'auth.logout',
    'auth.password_changed',
    'auth.mfa_enabled',
    'auth.mfa_disabled',
    'mcp.request',
    'mcp.approved',
    'mcp.denied'
  )),
  CONSTRAINT valid_event_category CHECK (event_category IN (
    'secret',
    'project',
    'organization',
    'member',
    'auth',
    'mcp'
  )),
  CONSTRAINT valid_resource_type CHECK (resource_type IN (
    'secret',
    'project',
    'organization',
    'member',
    'user',
    'mcp_request'
  ))
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key, unique audit log entry ID |
| `user_id` | UUID | No | - | User who performed the action |
| `organization_id` | UUID | Yes | - | Organization context (null for personal actions) |
| `project_id` | UUID | Yes | - | Project context (null if not project-specific) |
| `secret_id` | UUID | Yes | - | Secret context (null if not secret-specific) |
| `event_type` | TEXT | No | - | Specific event (e.g., 'secret.read', 'member.invited') |
| `event_category` | TEXT | No | - | Event category for filtering (secret, project, auth, etc.) |
| `action` | TEXT | No | - | Human-readable action description |
| `resource_type` | TEXT | No | - | Type of resource affected |
| `resource_id` | UUID | Yes | - | ID of the resource affected (flexible, may not map to FK) |
| `ip_address` | INET | Yes | - | IP address of the request |
| `user_agent` | TEXT | Yes | - | Browser/client user agent |
| `request_id` | TEXT | Yes | - | Request ID for tracing across services |
| `session_id` | TEXT | Yes | - | Session identifier |
| `metadata` | JSONB | No | `'{}'` | Event-specific additional data (e.g., secret_name, old_role, new_role) |
| `success` | BOOLEAN | No | `true` | Whether the action succeeded |
| `error_message` | TEXT | Yes | - | Error message if action failed |
| `created_at` | TIMESTAMPTZ | No | `now()` | Timestamp of the event (immutable) |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `valid_event_type` | CHECK | `event_type IN (...)` | Ensures only known event types are logged |
| `valid_event_category` | CHECK | `event_category IN (...)` | Ensures consistent categorization |
| `valid_resource_type` | CHECK | `resource_type IN (...)` | Ensures consistent resource types |

**Validation Rules:**
- `event_type`: Must match one of the predefined event types
- `event_category`: Must match the category of the event_type
- `action`: Human-readable description, max 500 characters
- `ip_address`: Valid IPv4 or IPv6 address (validated by INET type)
- `metadata`: Valid JSON object (validated by JSONB type)

---

### Table: `access_events`

**Purpose:** High-frequency secret access tracking (optimized for write performance, separate from audit_logs for compliance queries)

**Ownership:** System-managed

**Definition:**

```sql
CREATE TABLE access_events (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Access Details
  access_type TEXT NOT NULL,
  access_method TEXT NOT NULL,

  -- Context
  ip_address INET,
  user_agent TEXT,
  mcp_request_id UUID REFERENCES mcp_requests(id) ON DELETE SET NULL,

  -- Timestamps
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_access_type CHECK (access_type IN (
    'read',
    'copy',
    'download',
    'mcp_access'
  )),
  CONSTRAINT valid_access_method CHECK (access_method IN (
    'web_ui',
    'api',
    'mcp',
    'cli',
    'browser_extension'
  ))
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `secret_id` | UUID | No | - | Secret that was accessed |
| `user_id` | UUID | No | - | User who accessed the secret |
| `organization_id` | UUID | No | - | Organization context |
| `project_id` | UUID | No | - | Project context |
| `access_type` | TEXT | No | - | Type of access (read, copy, download, mcp_access) |
| `access_method` | TEXT | No | - | How the secret was accessed (web_ui, api, mcp, cli) |
| `ip_address` | INET | Yes | - | IP address of the request |
| `user_agent` | TEXT | Yes | - | Browser/client user agent |
| `mcp_request_id` | UUID | Yes | - | Reference to MCP request if accessed via MCP |
| `accessed_at` | TIMESTAMPTZ | No | `now()` | Timestamp of access |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `valid_access_type` | CHECK | `access_type IN (...)` | Ensures only known access types |
| `valid_access_method` | CHECK | `access_method IN (...)` | Ensures consistent access method tracking |

---

### Table: `mcp_requests`

**Purpose:** Track all MCP (Model Context Protocol) requests from AI tools like Claude Code and Cursor. Critical for compliance and security auditing of AI tool access.

**Ownership:** System-managed

**Definition:**

```sql
CREATE TABLE mcp_requests (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,

  -- MCP Details
  mcp_tool_name TEXT NOT NULL,
  mcp_client_name TEXT NOT NULL,
  mcp_client_version TEXT,

  -- Request Data
  request_type TEXT NOT NULL,
  requested_resource TEXT,
  request_params JSONB DEFAULT '{}',

  -- Approval Workflow
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  denied_reason TEXT,
  expires_at TIMESTAMPTZ,

  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,

  -- Result
  access_granted BOOLEAN DEFAULT false,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_request_type CHECK (request_type IN (
    'secret_list',
    'secret_get',
    'secret_search',
    'secret_request',
    'project_list'
  )),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'pending',
    'approved',
    'denied',
    'expired'
  )),
  CONSTRAINT approval_logic CHECK (
    (approval_status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (approval_status != 'approved')
  )
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | No | - | User whose account the MCP tool is acting on behalf of |
| `organization_id` | UUID | No | - | Organization context |
| `project_id` | UUID | Yes | - | Project context (if specific project requested) |
| `secret_id` | UUID | Yes | - | Secret requested (if specific secret) |
| `mcp_tool_name` | TEXT | No | - | MCP tool identifier (e.g., 'abyrith_secrets') |
| `mcp_client_name` | TEXT | No | - | Client making request (e.g., 'claude-code', 'cursor') |
| `mcp_client_version` | TEXT | Yes | - | Version of the MCP client |
| `request_type` | TEXT | No | - | Type of request (secret_list, secret_get, etc.) |
| `requested_resource` | TEXT | Yes | - | Human-readable description of what was requested |
| `request_params` | JSONB | No | `'{}'` | Request parameters (search query, filters, etc.) |
| `approval_status` | TEXT | No | `'pending'` | Current approval status |
| `approved_by` | UUID | Yes | - | User who approved the request (if approved) |
| `approved_at` | TIMESTAMPTZ | Yes | - | When the request was approved |
| `denied_reason` | TEXT | Yes | - | Reason for denial (if denied) |
| `expires_at` | TIMESTAMPTZ | Yes | - | When the approval expires (time-limited access) |
| `access_granted` | BOOLEAN | No | `false` | Whether access was ultimately granted |
| `error_message` | TEXT | Yes | - | Error message if request failed |
| `ip_address` | INET | Yes | - | IP address of the MCP client |
| `user_agent` | TEXT | Yes | - | User agent of the MCP client |
| `session_id` | TEXT | Yes | - | Session identifier |
| `created_at` | TIMESTAMPTZ | No | `now()` | When the request was created |
| `updated_at` | TIMESTAMPTZ | No | `now()` | When the request was last updated |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `valid_request_type` | CHECK | `request_type IN (...)` | Ensures only known request types |
| `valid_approval_status` | CHECK | `approval_status IN (...)` | Ensures consistent approval states |
| `approval_logic` | CHECK | Approved requests must have approver and timestamp | Ensures data integrity for approval workflow |

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│  auth.users     │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐     ┌──────────────────┐
│  audit_logs     │     │  organizations   │
└─────────────────┘     └────────┬─────────┘
         │ N                     │ 1
         │                       │
         │ 1                     │ N
         │              ┌────────▼────────┐
         │              │   projects      │
         │              └────────┬────────┘
         │                       │ 1
         │                       │
         │                       │ N
         │              ┌────────▼────────┐
         │              │   secrets       │
         │              └─────────────────┘
         │
         │ 1
┌────────▼────────┐     ┌──────────────────┐
│ access_events   │ N ─▶│  mcp_requests    │
└─────────────────┘ 1   └──────────────────┘
```

### Relationship Details

**audit_logs → auth.users**
- Type: Many-to-One
- Foreign Key: `audit_logs.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE`
- Description: Each audit log entry belongs to one user who performed the action

**audit_logs → organizations**
- Type: Many-to-One
- Foreign Key: `audit_logs.organization_id → organizations.id`
- Cascade: `ON DELETE CASCADE`
- Description: Audit logs are scoped to organizations (null for personal actions)

**audit_logs → projects**
- Type: Many-to-One
- Foreign Key: `audit_logs.project_id → projects.id`
- Cascade: `ON DELETE SET NULL`
- Description: Audit logs may reference a specific project (null if not project-specific)

**audit_logs → secrets**
- Type: Many-to-One
- Foreign Key: `audit_logs.secret_id → secrets.id`
- Cascade: `ON DELETE SET NULL`
- Description: Audit logs may reference a specific secret (null if not secret-specific)

**access_events → secrets**
- Type: Many-to-One
- Foreign Key: `access_events.secret_id → secrets.id`
- Cascade: `ON DELETE CASCADE`
- Description: Each access event tracks access to one secret

**access_events → auth.users**
- Type: Many-to-One
- Foreign Key: `access_events.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE`
- Description: Each access event belongs to one user

**access_events → mcp_requests**
- Type: Many-to-One
- Foreign Key: `access_events.mcp_request_id → mcp_requests.id`
- Cascade: `ON DELETE SET NULL`
- Description: Access events may be linked to an MCP request (if accessed via MCP)

**mcp_requests → auth.users (user_id)**
- Type: Many-to-One
- Foreign Key: `mcp_requests.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE`
- Description: Each MCP request is made on behalf of a user

**mcp_requests → auth.users (approved_by)**
- Type: Many-to-One
- Foreign Key: `mcp_requests.approved_by → auth.users.id`
- Cascade: `ON DELETE SET NULL`
- Description: MCP requests may be approved by a different user (e.g., admin approves developer's request)

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes (all audit tables)

**Purpose:** Ensure users can only view their own audit logs unless they are Admins/Owners. Prevent any user from modifying or deleting audit logs (immutability).

**Multi-tenancy Strategy:** Organization-level isolation with user-level visibility for personal actions

---

### Table: `audit_logs`

**RLS Policy 1: `audit_logs_select_policy`**

**Purpose:** Users can view their own audit logs; Admins/Owners can view organization-wide logs

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own audit logs
    audit_logs.user_id = auth.uid()
    -- OR user is Admin/Owner of the organization
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = audit_logs.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );
```

**Example Scenario:**
- User A (Developer) can see their own audit logs (secrets they accessed)
- User A cannot see User B's audit logs
- User C (Admin) can see all audit logs for their organization

---

**RLS Policy 2: `audit_logs_no_user_insert`**

**Purpose:** Regular users cannot insert audit logs directly (only via triggers or service_role)

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY audit_logs_no_user_insert ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- No user can INSERT directly
```

**Example Scenario:**
- Application code (via Supabase service role) inserts audit log entry → succeeds
- User A tries to INSERT an audit log entry → fails (cannot forge audit logs)

---

**RLS Policy 3: `audit_logs_service_insert`**

**Purpose:** Allow service role to insert audit logs (for triggers and application code)

**Operation:** `INSERT`

**Role:** `service_role`

**Definition:**
```sql
CREATE POLICY audit_logs_service_insert ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

---

**RLS Policy 4: `audit_logs_no_update`**

**Purpose:** Audit logs are immutable (cannot be updated)

**Operation:** `UPDATE`

**Role:** All roles

**Definition:**
```sql
CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY audit_logs_no_update_service ON audit_logs
  FOR UPDATE
  TO service_role
  USING (false);
```

---

**RLS Policy 5: `audit_logs_no_delete`**

**Purpose:** Audit logs cannot be deleted by users (only by service role for retention policy)

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE
  TO authenticated
  USING (false);
```

---

**RLS Policy 6: `audit_logs_service_delete`**

**Purpose:** Service role can delete logs for data retention policy (e.g., after 2 years)

**Operation:** `DELETE`

**Role:** `service_role`

**Definition:**
```sql
CREATE POLICY audit_logs_service_delete ON audit_logs
  FOR DELETE
  TO service_role
  USING (
    -- Only delete logs older than retention period (e.g., 2 years)
    audit_logs.created_at < NOW() - INTERVAL '2 years'
  );
```

---

### Table: `access_events`

**RLS Policy 1: `access_events_select_policy`**

**Purpose:** Users can view access events for secrets they can access; Admins/Owners can view all

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY access_events_select_policy ON access_events
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own access events
    access_events.user_id = auth.uid()
    -- OR user is Admin/Owner of the organization
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = access_events.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );
```

---

**RLS Policy 2: `access_events_no_user_insert`**

**Purpose:** Regular users cannot insert access events directly

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY access_events_no_user_insert ON access_events
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
```

---

**RLS Policy 3: `access_events_service_insert`**

**Purpose:** Allow service role to insert access events

**Operation:** `INSERT`

**Role:** `service_role`

**Definition:**
```sql
CREATE POLICY access_events_service_insert ON access_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

---

**RLS Policy 4: `access_events_no_update_delete`**

**Purpose:** Access events are immutable

**Operation:** `UPDATE`, `DELETE`

**Role:** All roles

**Definition:**
```sql
CREATE POLICY access_events_no_update ON access_events
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY access_events_no_delete ON access_events
  FOR DELETE
  TO authenticated
  USING (false);

-- Service role can delete for retention
CREATE POLICY access_events_service_delete ON access_events
  FOR DELETE
  TO service_role
  USING (
    access_events.accessed_at < NOW() - INTERVAL '2 years'
  );
```

---

### Table: `mcp_requests`

**RLS Policy 1: `mcp_requests_select_policy`**

**Purpose:** Users can view their own MCP requests; Admins/Owners can view all

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY mcp_requests_select_policy ON mcp_requests
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own MCP requests
    mcp_requests.user_id = auth.uid()
    -- OR user is Admin/Owner of the organization
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mcp_requests.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );
```

---

**RLS Policy 2: `mcp_requests_insert_policy`**

**Purpose:** Service role can insert MCP requests (created by MCP server on behalf of users)

**Operation:** `INSERT`

**Role:** `service_role`

**Definition:**
```sql
CREATE POLICY mcp_requests_insert_service ON mcp_requests
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

---

**RLS Policy 3: `mcp_requests_update_policy`**

**Purpose:** Admins/Owners can update MCP requests (for approval workflow)

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY mcp_requests_update_policy ON mcp_requests
  FOR UPDATE
  TO authenticated
  USING (
    -- User is Admin/Owner of the organization
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mcp_requests.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    -- After update, user must still be Admin/Owner
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mcp_requests.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );
```

---

**RLS Policy 4: `mcp_requests_no_delete`**

**Purpose:** MCP requests cannot be deleted (immutable audit trail)

**Operation:** `DELETE`

**Role:** All roles

**Definition:**
```sql
CREATE POLICY mcp_requests_no_delete ON mcp_requests
  FOR DELETE
  TO authenticated
  USING (false);

-- Service role can delete for retention
CREATE POLICY mcp_requests_service_delete ON mcp_requests
  FOR DELETE
  TO service_role
  USING (
    mcp_requests.created_at < NOW() - INTERVAL '2 years'
  );
```

---

## Indexes

### Performance Indexes

**Index 1: `idx_audit_logs_user_id`**

**Purpose:** Fast lookup of user's own audit logs

**Table:** `audit_logs`

**Columns:** `(user_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_audit_logs_user_id
  ON audit_logs(user_id);
```

**Queries Optimized:**
```sql
-- User viewing their own audit logs
SELECT * FROM audit_logs
WHERE user_id = 'current_user_uuid'
ORDER BY created_at DESC
LIMIT 50;
```

**Performance Impact:**
- Query time: 500ms → 5ms (100x improvement)
- Index size: ~10MB per 1M rows

---

**Index 2: `idx_audit_logs_organization_id`**

**Purpose:** Fast lookup of organization-wide audit logs for Admins

**Table:** `audit_logs`

**Columns:** `(organization_id, created_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_audit_logs_organization_id
  ON audit_logs(organization_id, created_at DESC);
```

**Queries Optimized:**
```sql
-- Admin viewing organization audit logs (most recent first)
SELECT * FROM audit_logs
WHERE organization_id = 'org_uuid'
ORDER BY created_at DESC
LIMIT 100;
```

---

**Index 3: `idx_audit_logs_event_type`**

**Purpose:** Filtering by event type (e.g., show only "secret.read" events)

**Table:** `audit_logs`

**Columns:** `(event_type, created_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_audit_logs_event_type
  ON audit_logs(event_type, created_at DESC);
```

**Queries Optimized:**
```sql
-- Find all secret access events in the last 30 days
SELECT * FROM audit_logs
WHERE event_type = 'secret.read'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

---

**Index 4: `idx_audit_logs_resource`**

**Purpose:** Fast lookup of all events for a specific resource (e.g., all events for a secret)

**Table:** `audit_logs`

**Columns:** `(resource_type, resource_id, created_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id, created_at DESC);
```

**Queries Optimized:**
```sql
-- View audit history for a specific secret
SELECT * FROM audit_logs
WHERE resource_type = 'secret'
  AND resource_id = 'secret_uuid'
ORDER BY created_at DESC;
```

---

**Index 5: `idx_audit_logs_timestamp`**

**Purpose:** Time-range queries for compliance reports

**Table:** `audit_logs`

**Columns:** `(created_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_audit_logs_timestamp
  ON audit_logs(created_at DESC);
```

**Queries Optimized:**
```sql
-- Compliance report: all events in Q1 2025
SELECT * FROM audit_logs
WHERE created_at >= '2025-01-01'
  AND created_at < '2025-04-01'
ORDER BY created_at DESC;
```

---

**Index 6: `idx_access_events_secret_id`**

**Purpose:** Fast lookup of all access events for a secret

**Table:** `access_events`

**Columns:** `(secret_id, accessed_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_access_events_secret_id
  ON access_events(secret_id, accessed_at DESC);
```

**Queries Optimized:**
```sql
-- Show who accessed this secret in the last 7 days
SELECT * FROM access_events
WHERE secret_id = 'secret_uuid'
  AND accessed_at > NOW() - INTERVAL '7 days'
ORDER BY accessed_at DESC;
```

---

**Index 7: `idx_access_events_user_id`**

**Purpose:** Fast lookup of user's access history

**Table:** `access_events`

**Columns:** `(user_id, accessed_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_access_events_user_id
  ON access_events(user_id, accessed_at DESC);
```

---

**Index 8: `idx_mcp_requests_user_id`**

**Purpose:** Fast lookup of user's MCP requests

**Table:** `mcp_requests`

**Columns:** `(user_id, created_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_mcp_requests_user_id
  ON mcp_requests(user_id, created_at DESC);
```

---

**Index 9: `idx_mcp_requests_approval_status`**

**Purpose:** Fast lookup of pending MCP requests for approval UI

**Table:** `mcp_requests`

**Columns:** `(organization_id, approval_status, created_at DESC)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_mcp_requests_approval_status
  ON mcp_requests(organization_id, approval_status, created_at DESC);
```

**Queries Optimized:**
```sql
-- Show all pending MCP requests for admin approval
SELECT * FROM mcp_requests
WHERE organization_id = 'org_uuid'
  AND approval_status = 'pending'
ORDER BY created_at ASC;
```

---

**Index 10: `idx_mcp_requests_expiry`**

**Purpose:** Fast cleanup of expired MCP approvals

**Table:** `mcp_requests`

**Columns:** `(expires_at)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_mcp_requests_expiry
  ON mcp_requests(expires_at)
  WHERE expires_at IS NOT NULL;
```

**Queries Optimized:**
```sql
-- Find and expire all MCP requests that have timed out
UPDATE mcp_requests
SET approval_status = 'expired'
WHERE expires_at < NOW()
  AND approval_status = 'approved';
```

---

## Triggers

### Trigger: `update_audit_logs_updated_at` (N/A)

**Note:** `audit_logs` table does NOT have an `updated_at` column because logs are immutable (INSERT-only). No update trigger needed.

---

### Trigger: `update_mcp_requests_updated_at`

**Purpose:** Automatically update `updated_at` timestamp when MCP request is modified

**Table:** `mcp_requests`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
CREATE OR REPLACE FUNCTION update_mcp_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mcp_requests_updated_at
  BEFORE UPDATE ON mcp_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_mcp_requests_updated_at();
```

**Example:**
```sql
-- Admin approves an MCP request
UPDATE mcp_requests
SET approval_status = 'approved',
    approved_by = 'admin_uuid',
    approved_at = NOW()
WHERE id = 'request_uuid';

-- updated_at is automatically set to NOW()
```

---

### Trigger: `log_secret_access`

**Purpose:** Automatically create an audit_log entry when a secret is accessed

**Table:** `secrets` (trigger on SELECT via application logic, not direct DB trigger)

**Event:** After secret decryption request (application-level)

**Implementation Note:** This is implemented in application code (API/Workers), not as a database trigger, because:
1. Database triggers on SELECT are not supported in PostgreSQL
2. We need context like IP address, user agent, and request ID
3. We only log when secret value is actually decrypted, not metadata queries

**Pseudocode:**
```typescript
// In API/Workers code
async function getSecret(secretId: string, userId: string) {
  // 1. Fetch secret (RLS enforces access)
  const secret = await supabase
    .from('secrets')
    .select('*')
    .eq('id', secretId)
    .single();

  // 2. Log the access event
  await supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      organization_id: secret.organization_id,
      project_id: secret.project_id,
      secret_id: secretId,
      event_type: 'secret.read',
      event_category: 'secret',
      action: `Accessed secret: ${secret.key_name}`,
      resource_type: 'secret',
      resource_id: secretId,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'],
      metadata: { secret_name: secret.key_name }
    });

  // 3. Also log in access_events for high-frequency tracking
  await supabase
    .from('access_events')
    .insert({
      secret_id: secretId,
      user_id: userId,
      organization_id: secret.organization_id,
      project_id: secret.project_id,
      access_type: 'read',
      access_method: 'api',
      ip_address: request.ip,
      user_agent: request.headers['user-agent']
    });

  // 4. Return secret
  return secret;
}
```

---

## Functions

### Function: `create_audit_log`

**Purpose:** Helper function to create audit log entries from application code

**Parameters:**
- `p_user_id` (UUID) - User performing the action
- `p_organization_id` (UUID) - Organization context (nullable)
- `p_event_type` (TEXT) - Event type (e.g., 'secret.read')
- `p_action` (TEXT) - Human-readable action description
- `p_resource_type` (TEXT) - Resource type
- `p_resource_id` (UUID) - Resource ID (nullable)
- `p_metadata` (JSONB) - Additional event metadata (nullable)
- `p_ip_address` (INET) - IP address (nullable)
- `p_user_agent` (TEXT) - User agent (nullable)

**Returns:** UUID (audit log entry ID)

**Definition:**
```sql
CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_organization_id UUID,
  p_event_type TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_log_id UUID;
  v_event_category TEXT;
BEGIN
  -- Derive event_category from event_type
  v_event_category := split_part(p_event_type, '.', 1);

  -- Insert audit log entry
  INSERT INTO audit_logs (
    user_id,
    organization_id,
    event_type,
    event_category,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_event_type,
    v_event_category,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_audit_log_id;

  RETURN v_audit_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
SELECT create_audit_log(
  p_user_id := 'user_uuid',
  p_organization_id := 'org_uuid',
  p_event_type := 'secret.read',
  p_action := 'Accessed secret: OPENAI_API_KEY',
  p_resource_type := 'secret',
  p_resource_id := 'secret_uuid',
  p_metadata := '{"secret_name": "OPENAI_API_KEY", "environment": "production"}'::JSONB,
  p_ip_address := '192.168.1.1'::INET,
  p_user_agent := 'Mozilla/5.0 ...'
);
```

**Security Considerations:**
- `SECURITY DEFINER` allows function to bypass RLS for INSERT (necessary since users can't insert directly)
- Function validates event_type against CHECK constraint
- Only service_role or authorized application code should call this function

---

### Function: `get_user_audit_summary`

**Purpose:** Get summary statistics of a user's activity for dashboard

**Parameters:**
- `p_user_id` (UUID) - User ID
- `p_days` (INTEGER) - Number of days to look back (default 30)

**Returns:** TABLE with statistics

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_user_audit_summary(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_events BIGINT,
  secrets_accessed BIGINT,
  secrets_created BIGINT,
  secrets_modified BIGINT,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_events,
    COUNT(*) FILTER (WHERE event_type = 'secret.read')::BIGINT AS secrets_accessed,
    COUNT(*) FILTER (WHERE event_type = 'secret.created')::BIGINT AS secrets_created,
    COUNT(*) FILTER (WHERE event_type IN ('secret.updated', 'secret.deleted'))::BIGINT AS secrets_modified,
    MAX(created_at) AS last_activity
  FROM audit_logs
  WHERE user_id = p_user_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
SELECT * FROM get_user_audit_summary('user_uuid', 7);
```

---

### Function: `compliance_export`

**Purpose:** Export audit logs for compliance reporting (SOC 2, GDPR)

**Parameters:**
- `p_organization_id` (UUID) - Organization ID
- `p_start_date` (TIMESTAMPTZ) - Start date
- `p_end_date` (TIMESTAMPTZ) - End date

**Returns:** TABLE with formatted audit log entries

**Definition:**
```sql
CREATE OR REPLACE FUNCTION compliance_export(
  p_organization_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  audit_id UUID,
  timestamp TIMESTAMPTZ,
  user_email TEXT,
  event_type TEXT,
  action TEXT,
  resource_type TEXT,
  ip_address INET,
  success BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id AS audit_id,
    al.created_at AS timestamp,
    u.email AS user_email,
    al.event_type,
    al.action,
    al.resource_type,
    al.ip_address,
    al.success
  FROM audit_logs al
  JOIN auth.users u ON u.id = al.user_id
  WHERE al.organization_id = p_organization_id
    AND al.created_at >= p_start_date
    AND al.created_at < p_end_date
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
-- Export Q1 2025 compliance report
SELECT * FROM compliance_export(
  'org_uuid',
  '2025-01-01'::TIMESTAMPTZ,
  '2025-04-01'::TIMESTAMPTZ
);
```

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/005_create_audit_logs_schema.sql`

**Description:** Create audit_logs, access_events, and mcp_requests tables with RLS policies

**SQL:**
```sql
-- ============================================
-- CREATE TABLES
-- ============================================

-- Table: audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'secret.created', 'secret.read', 'secret.updated', 'secret.deleted',
    'project.created', 'project.updated', 'project.deleted',
    'organization.created', 'organization.updated', 'organization.deleted',
    'member.invited', 'member.removed', 'member.role_changed',
    'auth.login', 'auth.logout', 'auth.password_changed',
    'auth.mfa_enabled', 'auth.mfa_disabled',
    'mcp.request', 'mcp.approved', 'mcp.denied'
  )),
  CONSTRAINT valid_event_category CHECK (event_category IN (
    'secret', 'project', 'organization', 'member', 'auth', 'mcp'
  )),
  CONSTRAINT valid_resource_type CHECK (resource_type IN (
    'secret', 'project', 'organization', 'member', 'user', 'mcp_request'
  ))
);

-- Table: access_events
CREATE TABLE access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL,
  access_method TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  mcp_request_id UUID,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_access_type CHECK (access_type IN (
    'read', 'copy', 'download', 'mcp_access'
  )),
  CONSTRAINT valid_access_method CHECK (access_method IN (
    'web_ui', 'api', 'mcp', 'cli', 'browser_extension'
  ))
);

-- Table: mcp_requests
CREATE TABLE mcp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,
  mcp_tool_name TEXT NOT NULL,
  mcp_client_name TEXT NOT NULL,
  mcp_client_version TEXT,
  request_type TEXT NOT NULL,
  requested_resource TEXT,
  request_params JSONB DEFAULT '{}',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  denied_reason TEXT,
  expires_at TIMESTAMPTZ,
  access_granted BOOLEAN DEFAULT false,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_request_type CHECK (request_type IN (
    'secret_list', 'secret_get', 'secret_search', 'secret_request', 'project_list'
  )),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'pending', 'approved', 'denied', 'expired'
  )),
  CONSTRAINT approval_logic CHECK (
    (approval_status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (approval_status != 'approved')
  )
);

-- Add FK for access_events -> mcp_requests (after mcp_requests is created)
ALTER TABLE access_events
  ADD CONSTRAINT fk_access_events_mcp_request
  FOREIGN KEY (mcp_request_id) REFERENCES mcp_requests(id) ON DELETE SET NULL;

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at DESC);

-- Access events indexes
CREATE INDEX idx_access_events_secret_id ON access_events(secret_id, accessed_at DESC);
CREATE INDEX idx_access_events_user_id ON access_events(user_id, accessed_at DESC);

-- MCP requests indexes
CREATE INDEX idx_mcp_requests_user_id ON mcp_requests(user_id, created_at DESC);
CREATE INDEX idx_mcp_requests_approval_status ON mcp_requests(organization_id, approval_status, created_at DESC);
CREATE INDEX idx_mcp_requests_expiry ON mcp_requests(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- ENABLE ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE RLS POLICIES - audit_logs
-- ============================================

CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    audit_logs.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = audit_logs.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY audit_logs_no_user_insert ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY audit_logs_service_insert ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY audit_logs_no_update_service ON audit_logs
  FOR UPDATE
  TO service_role
  USING (false);

CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY audit_logs_service_delete ON audit_logs
  FOR DELETE
  TO service_role
  USING (
    audit_logs.created_at < NOW() - INTERVAL '2 years'
  );

-- ============================================
-- CREATE RLS POLICIES - access_events
-- ============================================

CREATE POLICY access_events_select_policy ON access_events
  FOR SELECT
  TO authenticated
  USING (
    access_events.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = access_events.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY access_events_no_user_insert ON access_events
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY access_events_service_insert ON access_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY access_events_no_update ON access_events
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY access_events_no_delete ON access_events
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY access_events_service_delete ON access_events
  FOR DELETE
  TO service_role
  USING (
    access_events.accessed_at < NOW() - INTERVAL '2 years'
  );

-- ============================================
-- CREATE RLS POLICIES - mcp_requests
-- ============================================

CREATE POLICY mcp_requests_select_policy ON mcp_requests
  FOR SELECT
  TO authenticated
  USING (
    mcp_requests.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mcp_requests.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY mcp_requests_insert_service ON mcp_requests
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY mcp_requests_update_policy ON mcp_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mcp_requests.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mcp_requests.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY mcp_requests_no_delete ON mcp_requests
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY mcp_requests_service_delete ON mcp_requests
  FOR DELETE
  TO service_role
  USING (
    mcp_requests.created_at < NOW() - INTERVAL '2 years'
  );

-- ============================================
-- CREATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_mcp_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mcp_requests_updated_at
  BEFORE UPDATE ON mcp_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_mcp_requests_updated_at();

-- ============================================
-- CREATE HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_organization_id UUID,
  p_event_type TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_log_id UUID;
  v_event_category TEXT;
BEGIN
  v_event_category := split_part(p_event_type, '.', 1);

  INSERT INTO audit_logs (
    user_id,
    organization_id,
    event_type,
    event_category,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_event_type,
    v_event_category,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_audit_log_id;

  RETURN v_audit_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_audit_summary(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_events BIGINT,
  secrets_accessed BIGINT,
  secrets_created BIGINT,
  secrets_modified BIGINT,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_events,
    COUNT(*) FILTER (WHERE event_type = 'secret.read')::BIGINT AS secrets_accessed,
    COUNT(*) FILTER (WHERE event_type = 'secret.created')::BIGINT AS secrets_created,
    COUNT(*) FILTER (WHERE event_type IN ('secret.updated', 'secret.deleted'))::BIGINT AS secrets_modified,
    MAX(created_at) AS last_activity
  FROM audit_logs
  WHERE user_id = p_user_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION compliance_export(
  p_organization_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  audit_id UUID,
  timestamp TIMESTAMPTZ,
  user_email TEXT,
  event_type TEXT,
  action TEXT,
  resource_type TEXT,
  ip_address INET,
  success BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id AS audit_id,
    al.created_at AS timestamp,
    u.email AS user_email,
    al.event_type,
    al.action,
    al.resource_type,
    al.ip_address,
    al.success
  FROM audit_logs al
  JOIN auth.users u ON u.id = al.user_id
  WHERE al.organization_id = p_organization_id
    AND al.created_at >= p_start_date
    AND al.created_at < p_end_date
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Verification:**
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('audit_logs', 'access_events', 'mcp_requests');

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('audit_logs', 'access_events', 'mcp_requests');

-- Verify indexes created
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('audit_logs', 'access_events', 'mcp_requests')
ORDER BY tablename, indexname;

-- Verify functions created
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('create_audit_log', 'get_user_audit_summary', 'compliance_export');
```

**Rollback:**
```sql
-- Drop functions
DROP FUNCTION IF EXISTS create_audit_log CASCADE;
DROP FUNCTION IF EXISTS get_user_audit_summary CASCADE;
DROP FUNCTION IF EXISTS compliance_export CASCADE;
DROP FUNCTION IF EXISTS update_mcp_requests_updated_at CASCADE;

-- Drop tables (CASCADE will drop FK constraints)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS access_events CASCADE;
DROP TABLE IF EXISTS mcp_requests CASCADE;
```

---

## Sample Queries

### Query 1: User's Recent Activity

**Purpose:** Show a user their recent activity for dashboard

**SQL:**
```sql
SELECT
  event_type,
  action,
  resource_type,
  created_at,
  success,
  metadata
FROM audit_logs
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 50;
```

**Explanation:** Uses `idx_audit_logs_user_id` index for fast lookup. RLS automatically filters to user's own logs or organization logs if admin.

**Performance:** ~5ms for 50 most recent events

---

### Query 2: Organization Audit Report (Admin View)

**Purpose:** Admins can view all organization activity for the past 30 days

**SQL:**
```sql
SELECT
  al.created_at,
  u.email AS user_email,
  al.event_type,
  al.action,
  al.resource_type,
  al.ip_address,
  al.success
FROM audit_logs al
JOIN auth.users u ON u.id = al.user_id
WHERE al.organization_id = 'org_uuid'
  AND al.created_at > NOW() - INTERVAL '30 days'
ORDER BY al.created_at DESC;
```

**Explanation:** Uses `idx_audit_logs_organization_id` composite index for fast time-range queries. Joins with auth.users to get email addresses.

**Performance:** ~50ms for 10,000 events in 30 days

---

### Query 3: Secret Access History

**Purpose:** Show who accessed a specific secret and when

**SQL:**
```sql
SELECT
  ae.accessed_at,
  u.email AS user_email,
  ae.access_type,
  ae.access_method,
  ae.ip_address,
  mr.mcp_client_name
FROM access_events ae
JOIN auth.users u ON u.id = ae.user_id
LEFT JOIN mcp_requests mr ON mr.id = ae.mcp_request_id
WHERE ae.secret_id = 'secret_uuid'
ORDER BY ae.accessed_at DESC
LIMIT 100;
```

**Explanation:** Uses `idx_access_events_secret_id` index. Left join with mcp_requests to show if accessed via AI tool.

**Performance:** ~10ms for 100 most recent accesses

---

### Query 4: Pending MCP Approvals (Admin Dashboard)

**Purpose:** Show all pending MCP requests waiting for admin approval

**SQL:**
```sql
SELECT
  mr.id,
  mr.created_at,
  u.email AS requesting_user,
  mr.mcp_client_name,
  mr.request_type,
  mr.requested_resource,
  p.name AS project_name
FROM mcp_requests mr
JOIN auth.users u ON u.id = mr.user_id
LEFT JOIN projects p ON p.id = mr.project_id
WHERE mr.organization_id = 'org_uuid'
  AND mr.approval_status = 'pending'
ORDER BY mr.created_at ASC;
```

**Explanation:** Uses `idx_mcp_requests_approval_status` index to find pending requests. Orders by oldest first (FIFO).

**Performance:** ~5ms for typical query (few pending requests)

---

### Query 5: Compliance Export (SOC 2)

**Purpose:** Export all audit logs for a specific time period for compliance auditors

**SQL:**
```sql
SELECT * FROM compliance_export(
  p_organization_id := 'org_uuid',
  p_start_date := '2025-01-01'::TIMESTAMPTZ,
  p_end_date := '2025-04-01'::TIMESTAMPTZ
);
```

**Explanation:** Uses helper function to format data for compliance reports. Includes user emails and all relevant audit fields.

**Performance:** ~1-2 seconds for 100,000 events in Q1

---

### Query 6: Suspicious Activity Detection

**Purpose:** Find unusual patterns (e.g., user accessing 50+ secrets in 5 minutes)

**SQL:**
```sql
-- Find users with abnormally high access rates
SELECT
  user_id,
  u.email,
  COUNT(*) AS access_count,
  MIN(accessed_at) AS first_access,
  MAX(accessed_at) AS last_access
FROM access_events ae
JOIN auth.users u ON u.id = ae.user_id
WHERE accessed_at > NOW() - INTERVAL '5 minutes'
GROUP BY user_id, u.email
HAVING COUNT(*) > 50
ORDER BY access_count DESC;
```

**Explanation:** Identifies potential data exfiltration or compromised accounts by detecting high-frequency access.

**Performance:** ~100ms scan of recent access_events

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [ ] `auth.users` (Supabase managed) - User authentication
- [ ] `organizations` table - Organization data
- [ ] `projects` table - Project data
- [ ] `secrets` table - Secrets being audited
- [ ] `organization_members` table - For RLS policies

**Required by these schemas:**
- None (audit logs are the final layer, nothing depends on them)

### Feature Dependencies

**Required by features:**
- `08-features/audit-logs.md` - Audit log UI and export features
- `08-features/team-collaboration.md` - Activity feed and notifications
- `09-integrations/mcp/secrets-server-spec.md` - MCP request approval workflow
- `10-operations/monitoring/security-monitoring.md` - Security incident detection

---

## References

### Internal Documentation
- `03-security/rbac/rls-policies.md` - RLS policy patterns
- `04-database/database-overview.md` - Database architecture
- `TECH-STACK.md` - PostgreSQL specifications
- `GLOSSARY.md` - Term definitions (audit log, MCP, RLS)

### External Resources
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS reference
- [PostgreSQL JSONB](https://www.postgresql.org/docs/15/datatype-json.html) - JSONB data type
- [SOC 2 Audit Log Requirements](https://www.vanta.com/resources/soc-2-audit-logs) - Compliance guidelines
- [GDPR Data Retention](https://gdpr-info.eu/art-5-gdpr/) - GDPR Article 5

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineer | Initial audit logs schema definition |

---

## Notes

### Retention Policies

**Default Retention:** 2 years

**Rationale:**
- **SOC 2:** Requires audit logs for annual audits (minimum 1 year)
- **GDPR:** Allows reasonable retention for security purposes
- **Best Practice:** 2 years provides sufficient history for forensic investigation

**Cleanup Process:**
- Automated: Service role runs monthly cleanup job to delete logs older than 2 years
- Manual override: Admins can export logs before deletion
- Partitioning (future): Consider partitioning audit_logs by month for efficient archival

### Performance Considerations

**High Write Volume:**
- `audit_logs`: ~100-1000 writes/second at scale
- `access_events`: ~500-5000 writes/second (every secret access)
- `mcp_requests`: ~10-100 writes/second (AI tool usage)

**Optimization Strategies:**
1. Separate `access_events` from `audit_logs` to avoid index contention
2. Batch INSERT operations where possible (e.g., queue 10 events, insert together)
3. Use connection pooling to avoid connection overhead
4. Consider partitioning by month for tables exceeding 10M rows
5. Archive old data to cold storage (S3) after retention period

### Immutability Enforcement

**Why Immutability Matters:**
- **Compliance:** SOC 2 and ISO 27001 require tamper-proof audit logs
- **Forensics:** Investigation requires confidence that logs haven't been altered
- **Legal:** Audit logs may be used as evidence in legal proceedings

**How We Enforce Immutability:**
1. **RLS Policies:** Users cannot UPDATE or DELETE audit logs
2. **No `updated_at` column:** `audit_logs` only has `created_at` (no update tracking)
3. **Application Logic:** API layer refuses UPDATE/DELETE requests
4. **Service Role Only:** Only `service_role` can delete for retention policy
5. **Monitoring:** Alert on any DELETE operations on audit tables

### Compliance Mapping

**SOC 2 Type II:**
- CC6.1: Audit logs demonstrate monitoring of access controls
- CC6.2: MCP requests show approval workflows for AI tool access
- CC6.3: Access events demonstrate principle of least privilege

**GDPR:**
- Article 30: Audit logs serve as "record of processing activities"
- Article 33: Audit logs enable breach detection and notification
- Article 32: Audit logs demonstrate "ability to test security measures"

**ISO 27001:**
- A.12.4.1: Event logging (audit_logs covers all events)
- A.12.4.3: Administrator and operator logs (access_events)
- A.12.4.4: Clock synchronization (all timestamps in TIMESTAMPTZ)

### Future Enhancements

- **Partitioning:** Partition audit_logs by month when exceeding 10M rows
- **Real-time Alerting:** Trigger alerts on suspicious patterns (e.g., 50+ secret accesses in 1 minute)
- **ML Anomaly Detection:** Use ML to detect unusual access patterns
- **Audit Log Search:** Full-text search on audit logs (using PostgreSQL FTS)
- **Tamper Detection:** Add cryptographic signatures to audit log entries
- **Blockchain Anchoring:** Anchor audit log hashes to blockchain for immutability proof (enterprise feature)

### Known Limitations

- No UPDATE operations supported on audit tables (by design)
- Audit logs can grow large (requires retention policy and archival)
- High write volume may require optimization (batching, partitioning)
- Service role can delete logs (necessary for retention, but requires careful access control)

### Next Review Date

**2026-01-30** - Review retention policy, performance metrics, and compliance requirements
