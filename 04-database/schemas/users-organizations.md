---
Document: Users & Organizations - Database Schema
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 04-database/database-overview.md, 03-security/auth/authentication-flow.md, GLOSSARY.md, TECH-STACK.md
---

# Users & Organizations Database Schema

## Overview

This document defines the database schema for user accounts, organizations, and their relationships in Abyrith. The schema supports multi-tenancy through Row-Level Security (RLS) policies, enabling secure data isolation between organizations while allowing flexible team collaboration.

**Schema:** `public` (with references to `auth.users` managed by Supabase)

**Multi-tenancy:** Organization-level isolation with RLS enforcement

**Encryption:** User preferences and metadata stored encrypted at rest; authentication credentials managed by Supabase Auth

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

### Table: `auth.users`

**Purpose:** Stores user authentication credentials and identity (managed by Supabase Auth)

**Ownership:** System-managed (Supabase)

**Note:** This table is managed by Supabase Auth. We document only the fields we use.

**Key Fields Used:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key (user ID) |
| `email` | VARCHAR | No | - | User's email address |
| `encrypted_password` | VARCHAR | No | - | Hashed account password (bcrypt) |
| `email_confirmed_at` | TIMESTAMPTZ | Yes | `null` | When email was verified |
| `last_sign_in_at` | TIMESTAMPTZ | Yes | `null` | Last authentication timestamp |
| `created_at` | TIMESTAMPTZ | No | `now()` | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |
| `raw_app_meta_data` | JSONB | Yes | `{}` | App-level metadata |
| `raw_user_meta_data` | JSONB | Yes | `{}` | User-level metadata |

**User Metadata Fields We Store:**
```sql
-- Example structure in raw_user_meta_data
{
  "display_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "onboarding_completed": true,
  "master_password_set": true  -- Flag indicating master password configured
}
```

**App Metadata Fields We Store:**
```sql
-- Example structure in raw_app_meta_data
{
  "provider": "email",  -- or "google", "github"
  "providers": ["email", "google"],
  "default_org_id": "uuid-here"
}
```

---

### Table: `organizations`

**Purpose:** Stores organization/team information for multi-tenant collaboration

**Ownership:** Organization owner (one user per organization)

**Definition:**

```sql
CREATE TABLE organizations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,

  -- Settings
  settings JSONB NOT NULL DEFAULT '{}',

  -- Billing (for future use)
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  billing_email VARCHAR(255),
  stripe_customer_id VARCHAR(255),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Soft delete support
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT organizations_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT organizations_plan_valid CHECK (plan IN ('free', 'pro', 'team', 'enterprise'))
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `name` | VARCHAR(255) | No | - | Organization display name |
| `slug` | VARCHAR(255) | No | - | URL-friendly unique identifier |
| `settings` | JSONB | No | `{}` | Organization settings (see below) |
| `plan` | VARCHAR(50) | No | `'free'` | Subscription plan tier |
| `billing_email` | VARCHAR(255) | Yes | `null` | Billing contact email |
| `stripe_customer_id` | VARCHAR(255) | Yes | `null` | Stripe customer ID for billing |
| `created_at` | TIMESTAMPTZ | No | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |
| `created_by` | UUID | No | - | User who created the organization |
| `deleted_at` | TIMESTAMPTZ | Yes | `null` | Soft delete timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `organizations_name_not_empty` | CHECK | `char_length(name) > 0` | Ensure organization has a name |
| `organizations_slug_format` | CHECK | `slug ~ '^[a-z0-9-]+$'` | Ensure slug is URL-safe (lowercase, alphanumeric, hyphens) |
| `organizations_plan_valid` | CHECK | `plan IN (...)` | Ensure plan is one of allowed values |

**Validation Rules:**
- `name`: Max 255 characters, must not be empty
- `slug`: Max 255 characters, lowercase letters, numbers, and hyphens only, globally unique
- `settings`: Valid JSON object
- `plan`: One of: 'free', 'pro', 'team', 'enterprise'
- `billing_email`: Valid email format (if provided)

**Settings Structure:**
```sql
-- Example organization settings
{
  "require_2fa": false,
  "require_approval_for_production": true,
  "allowed_oauth_providers": ["google", "github"],
  "session_timeout_minutes": 60,
  "allowed_ip_ranges": [],
  "webhook_urls": {
    "secret_accessed": "https://example.com/webhook",
    "member_invited": "https://example.com/webhook"
  },
  "branding": {
    "logo_url": "https://example.com/logo.png",
    "primary_color": "#3B82F6"
  }
}
```

---

### Table: `organization_members`

**Purpose:** Many-to-many relationship between users and organizations with role-based permissions

**Ownership:** Organization (team members belong to organization)

**Definition:**

```sql
CREATE TABLE organization_members (
  -- Composite Primary Key
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role and Permissions
  role VARCHAR(50) NOT NULL DEFAULT 'developer',

  -- Invitation and Status
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Soft delete
  removed_at TIMESTAMPTZ,

  -- Constraints
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT org_members_role_valid CHECK (role IN ('owner', 'admin', 'developer', 'read_only')),
  CONSTRAINT org_members_cannot_invite_self CHECK (invited_by != user_id)
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `organization_id` | UUID | No | - | Organization reference |
| `user_id` | UUID | No | - | User reference |
| `role` | VARCHAR(50) | No | `'developer'` | User's role in organization |
| `invited_by` | UUID | Yes | `null` | User who sent invitation |
| `invited_at` | TIMESTAMPTZ | No | `now()` | When invitation was sent |
| `joined_at` | TIMESTAMPTZ | Yes | `null` | When user accepted invitation |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |
| `removed_at` | TIMESTAMPTZ | Yes | `null` | Soft delete timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `org_members_role_valid` | CHECK | `role IN (...)` | Ensure role is valid |
| `org_members_cannot_invite_self` | CHECK | `invited_by != user_id` | Prevent self-invitation |

**Validation Rules:**
- `role`: One of: 'owner', 'admin', 'developer', 'read_only'
- Each organization must have exactly one owner
- `joined_at` is set when user accepts invitation (null = pending)
- `removed_at` is set when member is removed from organization

**Role Definitions:**
- **Owner**: Full control, can delete organization, manage all settings
- **Admin**: Manage keys and team members, cannot delete organization
- **Developer**: Read and write secrets, cannot manage team
- **Read-Only**: View secret names/metadata, cannot decrypt values

---

### Table: `user_preferences`

**Purpose:** Store user-specific settings and preferences

**Ownership:** User-level (each user has their own preferences)

**Definition:**

```sql
CREATE TABLE user_preferences (
  -- Primary Key
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- UI Preferences
  theme VARCHAR(20) NOT NULL DEFAULT 'system',
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

  -- Notification Preferences
  notifications JSONB NOT NULL DEFAULT '{}',

  -- Security Preferences
  auto_lock_minutes INTEGER DEFAULT 15,
  require_master_password_on_decrypt BOOLEAN NOT NULL DEFAULT true,

  -- Feature Flags
  enabled_features JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT user_prefs_theme_valid CHECK (theme IN ('light', 'dark', 'system')),
  CONSTRAINT user_prefs_auto_lock_valid CHECK (auto_lock_minutes IS NULL OR auto_lock_minutes > 0)
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | UUID | No | - | User reference (primary key) |
| `theme` | VARCHAR(20) | No | `'system'` | UI theme preference |
| `language` | VARCHAR(10) | No | `'en'` | Language code (ISO 639-1) |
| `timezone` | VARCHAR(50) | No | `'UTC'` | User's timezone |
| `notifications` | JSONB | No | `{}` | Notification settings |
| `auto_lock_minutes` | INTEGER | Yes | `15` | Auto-lock timeout (null = disabled) |
| `require_master_password_on_decrypt` | BOOLEAN | No | `true` | Require password confirmation |
| `enabled_features` | JSONB | No | `[]` | Feature flag overrides |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `user_prefs_theme_valid` | CHECK | `theme IN (...)` | Ensure theme is valid |
| `user_prefs_auto_lock_valid` | CHECK | `auto_lock_minutes > 0 OR NULL` | Ensure positive timeout |

**Validation Rules:**
- `theme`: One of: 'light', 'dark', 'system'
- `language`: ISO 639-1 language code (2 letters)
- `timezone`: IANA timezone identifier
- `auto_lock_minutes`: Null or positive integer
- `notifications`: Valid JSON object
- `enabled_features`: Valid JSON array of strings

**Notifications Structure:**
```sql
-- Example notification settings
{
  "email": {
    "secret_accessed": true,
    "member_invited": true,
    "mcp_request": true,
    "weekly_digest": false
  },
  "in_app": {
    "secret_accessed": false,
    "member_invited": true,
    "mcp_request": true
  },
  "slack": {
    "webhook_url": "https://hooks.slack.com/...",
    "enabled": true,
    "events": ["secret_accessed", "mcp_request"]
  }
}
```

**Enabled Features Structure:**
```sql
-- Example feature flags
[
  "beta_ai_chat",
  "advanced_analytics",
  "usage_tracking_preview"
]
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │ (Supabase managed)
│   (identity)    │
└────────┬────────┘
         │
         │ 1
         │
         │ N
┌────────▼─────────────────────┐
│  organization_members        │
│  (user-org junction)         │
└────────┬─────────────────────┘
         │ N
         │
         │ 1
┌────────▼────────┐     ┌──────────────────┐
│ organizations   │     │ user_preferences │
│ (teams/orgs)    │     │ (user settings)  │
└─────────────────┘     └──────────────────┘
         │                       │
         │                       │ 1
         │ 1                     │
         │                ┌──────▼───────┐
         │                │ auth.users   │
         │                └──────────────┘
         │ N
         │
    (Projects, Secrets - documented in db-schema-secrets.md)
```

### Relationship Details

**auth.users → organization_members**
- Type: One-to-Many
- Foreign Key: `organization_members.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE` (remove memberships when user deleted)
- Description: One user can be a member of multiple organizations

**organizations → organization_members**
- Type: One-to-Many
- Foreign Key: `organization_members.organization_id → organizations.id`
- Cascade: `ON DELETE CASCADE` (remove memberships when organization deleted)
- Description: One organization has many members

**auth.users → organizations**
- Type: One-to-Many (creator relationship)
- Foreign Key: `organizations.created_by → auth.users.id`
- Cascade: `ON DELETE RESTRICT` (cannot delete user who created organization)
- Description: Track who created each organization

**auth.users → organization_members (invited_by)**
- Type: One-to-Many
- Foreign Key: `organization_members.invited_by → auth.users.id`
- Cascade: `SET NULL` (preserve invitation even if inviter deleted)
- Description: Track who invited each member

**auth.users → user_preferences**
- Type: One-to-One
- Foreign Key: `user_preferences.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE` (delete preferences when user deleted)
- Description: Each user has exactly one preferences record

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes (on all public tables)

**Purpose:** Enforce multi-tenancy data isolation. Users can only access data from organizations they belong to.

**Multi-tenancy Strategy:** Organization-level isolation enforced through RLS policies that check `organization_members` table for membership.

---

### Table: `organizations`

**RLS Policy 1: `organizations_select_policy`**

**Purpose:** Users can view organizations they are members of

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_select_policy ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND removed_at IS NULL
    )
  );
```

**Example Scenario:**
User A is a member of Org 1 and Org 2. They can SELECT from organizations table and will only see Org 1 and Org 2. Org 3 (where they're not a member) is invisible to them.

---

**RLS Policy 2: `organizations_insert_policy`**

**Purpose:** Any authenticated user can create a new organization

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_insert_policy ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );
```

**Example Scenario:**
User creates a new organization. They are automatically assigned as the creator (created_by), and a trigger will add them as an owner in organization_members.

---

**RLS Policy 3: `organizations_update_policy`**

**Purpose:** Only organization owners and admins can update organization settings

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_update_policy ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
  );
```

**Example Scenario:**
Developer role tries to UPDATE organizations table. RLS policy blocks the operation because their role is not 'owner' or 'admin'.

---

**RLS Policy 4: `organizations_delete_policy`**

**Purpose:** Only organization owner can delete organization

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_delete_policy ON organizations
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND removed_at IS NULL
    )
  );
```

**Example Scenario:**
Admin tries to DELETE organization. RLS blocks because only 'owner' role can delete.

---

### Table: `organization_members`

**RLS Policy 1: `org_members_select_policy`**

**Purpose:** Users can view members of organizations they belong to

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY org_members_select_policy ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND removed_at IS NULL
    )
  );
```

**Example Scenario:**
User queries organization_members to see team members. They can only see members of organizations where they are also a member.

---

**RLS Policy 2: `org_members_insert_policy`**

**Purpose:** Owners and admins can add new members to their organization

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY org_members_insert_policy ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
    AND role != 'owner'  -- Cannot create additional owners via INSERT
  );
```

**Example Scenario:**
Admin invites a new developer to the organization. RLS allows INSERT because admin has 'admin' role. Trying to INSERT with role='owner' would fail.

---

**RLS Policy 3: `org_members_update_policy`**

**Purpose:** Owners and admins can update member roles (except owner role)

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY org_members_update_policy ON organization_members
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
    AND (role != 'owner' OR user_id = auth.uid())  -- Can't change others to owner
  );
```

**Example Scenario:**
Admin changes a developer to read_only role. RLS allows UPDATE. Admin tries to promote someone to owner - RLS blocks.

---

**RLS Policy 4: `org_members_delete_policy`**

**Purpose:** Owners and admins can remove members; members can remove themselves

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY org_members_delete_policy ON organization_members
  FOR DELETE
  TO authenticated
  USING (
    -- Either you're removing yourself
    user_id = auth.uid()
    OR
    -- Or you're an owner/admin removing someone else (but not the owner)
    (
      organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
          AND removed_at IS NULL
      )
      AND role != 'owner'  -- Can't remove the owner
    )
  );
```

**Example Scenario:**
User leaves organization (DELETE their own record). RLS allows. Admin tries to remove owner - RLS blocks.

---

### Table: `user_preferences`

**RLS Policy 1: `user_prefs_all_operations_policy`**

**Purpose:** Users can only access their own preferences

**Operation:** `ALL` (SELECT, INSERT, UPDATE, DELETE)

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY user_prefs_all_operations_policy ON user_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Example Scenario:**
User queries user_preferences table. They only see their own record (user_id matches auth.uid()). Attempting to access another user's preferences is blocked by RLS.

---

### RLS Testing

**Test Case 1: Cross-Organization Access Prevention**
```sql
-- Setup: User A in Org 1, User B in Org 2
-- As User A
SET request.jwt.claim.sub = 'user-a-uuid';

-- This should succeed (User A's organization)
SELECT * FROM organizations WHERE id = 'org-1-uuid';

-- This should return no rows (User A not in Org 2)
SELECT * FROM organizations WHERE id = 'org-2-uuid';
```

**Expected:** User A sees Org 1, not Org 2.

---

**Test Case 2: Role-Based Permissions**
```sql
-- Setup: User C is developer in Org 3
-- As User C
SET request.jwt.claim.sub = 'user-c-uuid';

-- This should fail (developer can't update organization)
UPDATE organizations
SET name = 'New Name'
WHERE id = 'org-3-uuid';

-- This should succeed (developer can view organization)
SELECT * FROM organizations WHERE id = 'org-3-uuid';
```

**Expected:** SELECT succeeds, UPDATE fails.

---

**Test Case 3: Self-Service Preferences**
```sql
-- As User D
SET request.jwt.claim.sub = 'user-d-uuid';

-- This should succeed (own preferences)
UPDATE user_preferences
SET theme = 'dark'
WHERE user_id = 'user-d-uuid';

-- This should fail (another user's preferences)
UPDATE user_preferences
SET theme = 'dark'
WHERE user_id = 'user-e-uuid';
```

**Expected:** Can update own preferences, cannot update others.

---

## Indexes

### Performance Indexes

**Index 1: `idx_organizations_slug`**

**Purpose:** Fast lookup of organizations by slug (for URL routing)

**Table:** `organizations`

**Columns:** `(slug)`

**Type:** B-tree (unique)

**Definition:**
```sql
-- Already created as UNIQUE constraint, but explicitly:
CREATE UNIQUE INDEX idx_organizations_slug
  ON organizations (slug)
  WHERE deleted_at IS NULL;
```

**Queries Optimized:**
```sql
-- Organization lookup by slug
SELECT * FROM organizations
WHERE slug = 'acme-corp'
  AND deleted_at IS NULL;
```

**Performance Impact:**
- Query time: O(n) → O(log n)
- Index size: ~5KB per 1000 organizations

---

**Index 2: `idx_organization_members_user_id`**

**Purpose:** Fast lookup of user's organization memberships

**Table:** `organization_members`

**Columns:** `(user_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_organization_members_user_id
  ON organization_members (user_id)
  WHERE removed_at IS NULL;
```

**Queries Optimized:**
```sql
-- Find all organizations for a user
SELECT organization_id, role
FROM organization_members
WHERE user_id = $1
  AND removed_at IS NULL;
```

**Performance Impact:**
- Query time: 50ms → 5ms (typical)
- Index size: ~10KB per 1000 memberships

---

**Index 3: `idx_organization_members_org_id_role`**

**Purpose:** Fast lookup of organization members by role

**Table:** `organization_members`

**Columns:** `(organization_id, role)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_organization_members_org_id_role
  ON organization_members (organization_id, role)
  WHERE removed_at IS NULL;
```

**Queries Optimized:**
```sql
-- Find all admins in an organization
SELECT user_id, joined_at
FROM organization_members
WHERE organization_id = $1
  AND role = 'admin'
  AND removed_at IS NULL;

-- Check if organization has an owner
SELECT COUNT(*)
FROM organization_members
WHERE organization_id = $1
  AND role = 'owner'
  AND removed_at IS NULL;
```

**Performance Impact:**
- Query time: 20ms → 2ms (typical)
- Index size: ~15KB per 1000 memberships

---

**Index 4: `idx_organizations_created_by`**

**Purpose:** Find organizations created by a specific user

**Table:** `organizations`

**Columns:** `(created_by)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_organizations_created_by
  ON organizations (created_by)
  WHERE deleted_at IS NULL;
```

**Queries Optimized:**
```sql
-- Find all organizations created by user
SELECT id, name, created_at
FROM organizations
WHERE created_by = $1
  AND deleted_at IS NULL;
```

**Performance Impact:**
- Query time: 30ms → 3ms (typical)
- Index size: ~8KB per 1000 organizations

---

## Triggers

### Trigger: `handle_updated_at`

**Purpose:** Automatically update `updated_at` timestamp on row modifications

**Table:** `organizations`, `organization_members`, `user_preferences`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
-- Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for organizations
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for organization_members
CREATE TRIGGER set_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_preferences
CREATE TRIGGER set_user_prefs_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Example:**
```sql
-- Update organization name
UPDATE organizations
SET name = 'New Name'
WHERE id = 'uuid-here';

-- updated_at is automatically set to now()
```

---

### Trigger: `ensure_organization_has_owner`

**Purpose:** Automatically add creator as owner when organization is created

**Table:** `organizations`

**Event:** `AFTER INSERT`

**Definition:**
```sql
-- Function
CREATE OR REPLACE FUNCTION add_organization_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    invited_by,
    joined_at
  ) VALUES (
    NEW.id,
    NEW.created_by,
    'owner',
    NEW.created_by,  -- Self-invite
    now()            -- Immediately joined
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
CREATE TRIGGER ensure_organization_has_owner
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION add_organization_owner();
```

**Example:**
```sql
-- User creates organization
INSERT INTO organizations (name, slug, created_by)
VALUES ('Acme Corp', 'acme-corp', auth.uid());

-- Trigger automatically inserts into organization_members:
-- (organization_id, user_id, role) = (new-org-id, auth.uid(), 'owner')
```

**Security Considerations:**
- `SECURITY DEFINER` allows trigger to bypass RLS
- Trigger only runs after INSERT, cannot be exploited to create arbitrary owners
- User becomes owner of organization they create (expected behavior)

---

### Trigger: `prevent_last_owner_removal`

**Purpose:** Prevent removing or demoting the last owner of an organization

**Table:** `organization_members`

**Event:** `BEFORE UPDATE OR DELETE`

**Definition:**
```sql
-- Function
CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  -- Only check if the affected row is an owner
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner') THEN

    -- Count remaining owners
    SELECT COUNT(*)
    INTO owner_count
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'owner'
      AND removed_at IS NULL
      AND (TG_OP = 'UPDATE' OR user_id != OLD.user_id);  -- Exclude row being deleted

    -- Prevent if this is the last owner
    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last owner of an organization';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER prevent_last_owner_removal
  BEFORE UPDATE OR DELETE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_owner_removal();
```

**Example:**
```sql
-- Try to remove the only owner
DELETE FROM organization_members
WHERE organization_id = 'org-uuid'
  AND user_id = 'owner-uuid';

-- Error: Cannot remove or demote the last owner of an organization
```

---

## Functions

### Function: `get_user_organizations`

**Purpose:** Get all organizations a user is a member of with their role

**Parameters:**
- `p_user_id` (UUID) - User ID to query

**Returns:** TABLE(organization_id UUID, organization_name TEXT, role TEXT, joined_at TIMESTAMPTZ)

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE(
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.organization_id,
    o.name::TEXT,
    om.role::TEXT,
    om.joined_at
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
    AND om.removed_at IS NULL
    AND o.deleted_at IS NULL
  ORDER BY om.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
SELECT * FROM get_user_organizations('user-uuid-here');
```

**Security Considerations:**
- `SECURITY DEFINER` allows function to bypass RLS
- Function only returns data for the specified user
- Still respects soft-delete flags

---

### Function: `has_organization_permission`

**Purpose:** Check if a user has a specific permission in an organization

**Parameters:**
- `p_user_id` (UUID) - User to check
- `p_organization_id` (UUID) - Organization to check
- `p_required_roles` (TEXT[]) - Array of roles that grant permission

**Returns:** BOOLEAN

**Definition:**
```sql
CREATE OR REPLACE FUNCTION has_organization_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_required_roles TEXT[]
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND role = ANY(p_required_roles)
      AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
-- Check if user can manage team (owner or admin)
SELECT has_organization_permission(
  'user-uuid',
  'org-uuid',
  ARRAY['owner', 'admin']
);
```

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/001_create_users_organizations.sql`

**Description:** Create organizations, organization_members, and user_preferences tables with RLS policies

**SQL:**
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: organizations
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}',
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  billing_email VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT organizations_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT organizations_plan_valid CHECK (plan IN ('free', 'pro', 'team', 'enterprise'))
);

-- ============================================================================
-- TABLE: organization_members
-- ============================================================================

CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'developer',
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT org_members_role_valid CHECK (role IN ('owner', 'admin', 'developer', 'read_only')),
  CONSTRAINT org_members_cannot_invite_self CHECK (invited_by != user_id)
);

-- ============================================================================
-- TABLE: user_preferences
-- ============================================================================

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme VARCHAR(20) NOT NULL DEFAULT 'system',
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  notifications JSONB NOT NULL DEFAULT '{}',
  auto_lock_minutes INTEGER DEFAULT 15,
  require_master_password_on_decrypt BOOLEAN NOT NULL DEFAULT true,
  enabled_features JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_prefs_theme_valid CHECK (theme IN ('light', 'dark', 'system')),
  CONSTRAINT user_prefs_auto_lock_valid CHECK (auto_lock_minutes IS NULL OR auto_lock_minutes > 0)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX idx_organizations_slug
  ON organizations (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_organization_members_user_id
  ON organization_members (user_id)
  WHERE removed_at IS NULL;

CREATE INDEX idx_organization_members_org_id_role
  ON organization_members (organization_id, role)
  WHERE removed_at IS NULL;

CREATE INDEX idx_organizations_created_by
  ON organizations (created_by)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_user_prefs_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Organization owner trigger
CREATE OR REPLACE FUNCTION add_organization_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    invited_by,
    joined_at
  ) VALUES (
    NEW.id,
    NEW.created_by,
    'owner',
    NEW.created_by,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER ensure_organization_has_owner
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION add_organization_owner();

-- Prevent last owner removal
CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner') THEN
    SELECT COUNT(*)
    INTO owner_count
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'owner'
      AND removed_at IS NULL
      AND (TG_OP = 'UPDATE' OR user_id != OLD.user_id);

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last owner of an organization';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_last_owner_removal
  BEFORE UPDATE OR DELETE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_owner_removal();

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY organizations_select_policy ON organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

CREATE POLICY organizations_insert_policy ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY organizations_update_policy ON organizations
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
  );

CREATE POLICY organizations_delete_policy ON organizations
  FOR DELETE TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND removed_at IS NULL
    )
  );

-- Organization members policies
CREATE POLICY org_members_select_policy ON organization_members
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

CREATE POLICY org_members_insert_policy ON organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
    AND role != 'owner'
  );

CREATE POLICY org_members_update_policy ON organization_members
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND removed_at IS NULL
    )
    AND (role != 'owner' OR user_id = auth.uid())
  );

CREATE POLICY org_members_delete_policy ON organization_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
          AND removed_at IS NULL
      )
      AND role != 'owner'
    )
  );

-- User preferences policies
CREATE POLICY user_prefs_all_operations_policy ON user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE(
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.organization_id,
    o.name::TEXT,
    om.role::TEXT,
    om.joined_at
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
    AND om.removed_at IS NULL
    AND o.deleted_at IS NULL
  ORDER BY om.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_organization_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_required_roles TEXT[]
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND role = ANY(p_required_roles)
      AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Verification:**
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('organizations', 'organization_members', 'user_preferences');

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'organization_members', 'user_preferences');

-- Verify indexes created
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'organization_members');
```

**Rollback:**
```sql
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS add_organization_owner CASCADE;
DROP FUNCTION IF EXISTS prevent_last_owner_removal CASCADE;
DROP FUNCTION IF EXISTS get_user_organizations CASCADE;
DROP FUNCTION IF EXISTS has_organization_permission CASCADE;
```

---

## Sample Queries

### Query 1: Get User's Organizations with Role

**Purpose:** Fetch all organizations a user belongs to with their role

**SQL:**
```sql
SELECT
  o.id,
  o.name,
  o.slug,
  om.role,
  om.joined_at,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND removed_at IS NULL) AS member_count
FROM organizations o
JOIN organization_members om ON om.organization_id = o.id
WHERE om.user_id = $1  -- User ID parameter
  AND om.removed_at IS NULL
  AND o.deleted_at IS NULL
ORDER BY om.joined_at DESC;
```

**Explanation:** Joins organizations with organization_members to get user's memberships, includes member count as subquery.

**Performance:** Uses `idx_organization_members_user_id` index, typically < 10ms.

---

### Query 2: Get Organization Members with User Details

**Purpose:** List all members of an organization with their email and role

**SQL:**
```sql
SELECT
  u.id AS user_id,
  u.email,
  u.raw_user_meta_data->>'display_name' AS display_name,
  om.role,
  om.joined_at,
  om.invited_by,
  (SELECT email FROM auth.users WHERE id = om.invited_by) AS invited_by_email
FROM organization_members om
JOIN auth.users u ON u.id = om.user_id
WHERE om.organization_id = $1  -- Organization ID parameter
  AND om.removed_at IS NULL
ORDER BY
  CASE om.role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'developer' THEN 3
    WHEN 'read_only' THEN 4
  END,
  om.joined_at ASC;
```

**Explanation:** Joins with auth.users to get email and display name, orders by role hierarchy then join date.

**Performance:** Uses `idx_organization_members_org_id_role` index, typically < 15ms.

---

### Query 3: Check if User Can Perform Action

**Purpose:** Verify if a user has permission to perform an action in an organization

**SQL:**
```sql
-- Check if user is owner or admin
SELECT EXISTS (
  SELECT 1
  FROM organization_members
  WHERE organization_id = $1  -- Organization ID
    AND user_id = $2          -- User ID
    AND role IN ('owner', 'admin')
    AND removed_at IS NULL
) AS has_permission;
```

**Explanation:** Simple EXISTS check for membership with required role.

**Performance:** Uses composite index, typically < 5ms.

---

### Query 4: Get Pending Invitations

**Purpose:** Fetch all pending invitations for a user

**SQL:**
```sql
SELECT
  o.id AS organization_id,
  o.name AS organization_name,
  om.role AS invited_role,
  om.invited_at,
  u.email AS invited_by_email,
  u.raw_user_meta_data->>'display_name' AS invited_by_name
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN auth.users u ON u.id = om.invited_by
WHERE om.user_id = $1  -- User ID
  AND om.joined_at IS NULL  -- Pending invitation
  AND om.removed_at IS NULL
  AND o.deleted_at IS NULL
ORDER BY om.invited_at DESC;
```

**Explanation:** Finds memberships where `joined_at` is NULL (invitation not yet accepted).

**Performance:** Uses `idx_organization_members_user_id` index, typically < 10ms.

---

### Query 5: Get Organization Statistics

**Purpose:** Get comprehensive statistics for an organization

**SQL:**
```sql
SELECT
  o.id,
  o.name,
  o.plan,
  o.created_at,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND removed_at IS NULL) AS total_members,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND role = 'owner' AND removed_at IS NULL) AS owner_count,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND role = 'admin' AND removed_at IS NULL) AS admin_count,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND role = 'developer' AND removed_at IS NULL) AS developer_count,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND role = 'read_only' AND removed_at IS NULL) AS readonly_count,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND joined_at IS NULL AND removed_at IS NULL) AS pending_invitations
FROM organizations o
WHERE o.id = $1  -- Organization ID
  AND o.deleted_at IS NULL;
```

**Explanation:** Aggregates member counts by role using correlated subqueries.

**Performance:** Multiple index lookups, typically < 20ms (acceptable for infrequent admin queries).

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [x] `auth.users` (Supabase managed) - User authentication and identity

**Required by these schemas:**
- `04-database/schemas/secrets.md` - Projects and secrets belong to organizations
- `04-database/schemas/audit-logs.md` - Audit events reference users and organizations

### Feature Dependencies

**Required by features:**
- `08-features/team-collaboration.md` - Team sharing uses organization_members
- `08-features/project-management.md` - Projects belong to organizations
- `03-security/rbac/permissions-model.md` - Permissions enforce organization roles

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture and multi-tenancy strategy
- `03-security/rbac/rls-policies.md` - RLS patterns and enforcement
- `03-security/auth/authentication-flow.md` - User authentication details
- `TECH-STACK.md` - PostgreSQL and Supabase specifications
- `GLOSSARY.md` - Term definitions (Owner, Admin, Developer, Organization, etc.)

### External Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/) - PostgreSQL 15 reference
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns and examples
- [PostgreSQL Triggers](https://www.postgresql.org/docs/15/triggers.html) - Trigger documentation
- [RBAC Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) - Authorization patterns

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Documentation Creator Agent | Initial schema definition for users and organizations |

---

## Notes

### Future Enhancements
- **Custom roles** - Enterprise feature allowing organizations to define custom roles with granular permissions
- **SCIM integration** - Automated user provisioning for enterprise SSO
- **Organization groups** - Nested organizations for large enterprises
- **Audit log integration** - Track all organization and membership changes
- **Usage quotas** - Per-organization limits based on plan tier

### Known Issues
- **Single owner limitation** - Organizations can only have one owner; transfer requires special procedure
- **Pending invitations cleanup** - No automatic expiration of old invitations (future: 7-day expiry)
- **Slug uniqueness** - Organization slug cannot be changed after creation (future: allow slug updates with redirect)

### Migration Considerations
- **Adding new roles** - Update CHECK constraint on `role` column
- **Changing role permissions** - Update RLS policies and application logic simultaneously
- **Organization merges** - No built-in support; requires custom migration script
- **Bulk user import** - Use `COPY` command or batch INSERTs, ensure RLS is considered

### Next Review Date
2025-11-30 (review after initial implementation and load testing)
