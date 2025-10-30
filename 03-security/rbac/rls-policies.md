---
Document: Row-Level Security (RLS) Policies - Database Security
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/rbac/permissions-model.md, 03-security/security-model.md, GLOSSARY.md, TECH-STACK.md
---

# Row-Level Security (RLS) Policies

## Overview

This document specifies PostgreSQL Row-Level Security (RLS) policies that enforce multi-tenancy and access control at the database layer. RLS is the final enforcement layer ensuring that even if application logic is bypassed, users can only access data they're authorized to see. This is critical for zero-knowledge architecture, team collaboration, and regulatory compliance.

**Purpose:** Define comprehensive RLS policies that prevent cross-tenant data access, enforce role-based permissions, and serve as the last line of defense against unauthorized data access.

**Schema:** public (application tables)

**Multi-tenancy:** Organization-level and project-level isolation with team-based access

**Encryption:** RLS protects encrypted secret metadata; secret values are encrypted client-side (see `03-security/security-model.md`)

---

## Table of Contents

1. [RLS Overview](#rls-overview)
2. [Multi-Tenancy Strategy](#multi-tenancy-strategy)
3. [Policy Definitions by Table](#policy-definitions-by-table)
4. [Performance Considerations](#performance-considerations)
5. [Testing RLS Policies](#testing-rls-policies)
6. [Common Pitfalls](#common-pitfalls)
7. [Debugging RLS Issues](#debugging-rls-issues)
8. [Migration Scripts](#migration-scripts)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## RLS Overview

### What is Row-Level Security?

**Row-Level Security (RLS)** is a PostgreSQL feature that restricts which rows users can access in a table based on security policies. Policies are evaluated **before** any query returns results, making it impossible for users to access unauthorized data even if application code has bugs.

**Key Concepts:**
- **Policy:** A rule defining which rows a user can access for specific operations (SELECT, INSERT, UPDATE, DELETE)
- **USING clause:** Condition that must be true for a row to be visible (read operations)
- **WITH CHECK clause:** Condition that must be true for a row to be inserted/updated (write operations)
- **Roles:** PostgreSQL roles (authenticated, anon, service_role) that policies apply to

### Why RLS is Critical for Abyrith

**Security Benefits:**
1. **Defense in Depth:** Even if API gateway is bypassed, RLS prevents unauthorized access
2. **Multi-Tenancy Enforcement:** Users can only see data from their organizations/projects
3. **Zero-Trust Architecture:** Database doesn't trust application layer
4. **Audit Trail Protection:** Users cannot modify audit logs
5. **Compliance:** Required for SOC 2, ISO 27001, GDPR

**Attack Scenarios Prevented:**
- ❌ SQL injection bypassing application logic
- ❌ Compromised API token accessing other users' data
- ❌ Insider threat (employee with database access)
- ❌ Application bug exposing cross-tenant data
- ❌ Malicious team member accessing secrets from other projects

### RLS vs. Application-Level Security

**Why both are needed:**

| Layer | Purpose | Failure Mode |
|-------|---------|--------------|
| **Application (API Gateway)** | First line of defense, provides user experience, caching | Bug exposes data if RLS missing |
| **Database (RLS)** | Final enforcement, cannot be bypassed | Poor performance if not indexed properly |

**Best Practice:** Always implement both layers. Application layer provides UX and performance; RLS provides security guarantee.

---

## Multi-Tenancy Strategy

### Isolation Levels

**Abyrith uses three levels of data isolation:**

1. **User-Level Isolation:**
   - Individual users can only access their own personal data (profile, preferences, encryption keys)
   - Used for: `user_profiles`, `user_encryption_keys`, `user_preferences`

2. **Organization-Level Isolation:**
   - Users can only access organizations they're members of
   - Used for: `organizations`, `organization_members`, `billing_info`

3. **Project-Level Isolation:**
   - Users can only access projects they have explicit access to (via organization membership or project-specific roles)
   - Used for: `projects`, `environments`, `secrets`, `audit_logs`

### Data Access Pattern

```
User Authentication (Supabase Auth)
    ↓
    auth.uid() → Current user's UUID
    ↓
┌───────────────────────────────────────────┐
│  Is user a member of organization?        │
│  (check organization_members table)       │
└───────────────┬───────────────────────────┘
                ↓ YES
┌───────────────────────────────────────────┐
│  Does user have role in project?          │
│  (check project_members table)            │
└───────────────┬───────────────────────────┘
                ↓ YES (with role: Owner/Admin/Developer/Read-Only)
┌───────────────────────────────────────────┐
│  Grant access based on role permissions   │
│  (see 03-security/rbac/permissions-model) │
└───────────────────────────────────────────┘
```

### Supabase Auth Context

**How RLS accesses current user:**

Supabase Auth automatically sets PostgreSQL session variables:
```sql
-- Current user's UUID
auth.uid() → '550e8400-e29b-41d4-a716-446655440000'

-- Current user's JWT claims
auth.jwt() → JSON object with email, role, metadata
```

**Example:**
```sql
-- Check if current user is a member of an organization
SELECT 1 FROM organization_members
WHERE user_id = auth.uid()  -- This is the logged-in user
  AND organization_id = 'some-org-uuid';
```

---

## Policy Definitions by Table

### Table: `organizations`

**Purpose:** Organizations are the top-level tenant boundary. Users can belong to multiple organizations.

**Ownership:** Organization Owners (users who created the organization)

---

#### RLS Policy 1: `organizations_select_policy`

**Purpose:** Users can only view organizations they're members of

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_select_policy ON organizations
  FOR SELECT
  TO authenticated
  USING (
    -- User is a member of this organization
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
    )
  );
```

**Example Scenario:**
- User A is a member of "Acme Corp" (org_1)
- User A is NOT a member of "Beta Inc" (org_2)
- User A runs: `SELECT * FROM organizations;`
- Result: Only "Acme Corp" is returned

---

#### RLS Policy 2: `organizations_insert_policy`

**Purpose:** Any authenticated user can create a new organization (they become the owner)

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_insert_policy ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Organization is being created by the current user
    created_by = auth.uid()
  );
```

**Example Scenario:**
- User B creates a new organization
- INSERT statement must have `created_by = User B's UUID`
- Application automatically sets this field
- User B cannot create an organization claiming to be User C

---

#### RLS Policy 3: `organizations_update_policy`

**Purpose:** Only organization Owners can update organization details

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_update_policy ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be an Owner of the organization
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  )
  WITH CHECK (
    -- After update, user must still be an Owner
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  );
```

**Example Scenario:**
- User A is Owner of "Acme Corp"
- User B is Admin of "Acme Corp"
- User A can update organization name (Owner)
- User B cannot update organization name (Admin not sufficient)

---

#### RLS Policy 4: `organizations_delete_policy`

**Purpose:** Only organization Owners can delete the organization (soft delete recommended)

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organizations_delete_policy ON organizations
  FOR DELETE
  TO authenticated
  USING (
    -- User must be an Owner of the organization
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  );
```

---

### Table: `organization_members`

**Purpose:** Tracks which users belong to which organizations and their roles

**Ownership:** Organization Owners manage membership

---

#### RLS Policy 1: `organization_members_select_policy`

**Purpose:** Users can see members of organizations they belong to

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organization_members_select_policy ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    -- User is a member of the same organization
    EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
    )
  );
```

**Example Scenario:**
- User A is in "Acme Corp"
- User A runs: `SELECT * FROM organization_members WHERE organization_id = 'acme-uuid';`
- Result: All members of "Acme Corp" are visible
- User A runs: `SELECT * FROM organization_members WHERE organization_id = 'other-uuid';`
- Result: Empty (User A is not in that org)

---

#### RLS Policy 2: `organization_members_insert_policy`

**Purpose:** Only Owners and Admins can invite new members

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organization_members_insert_policy ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Current user must be Owner or Admin of the organization
    EXISTS (
      SELECT 1 FROM organization_members AS inviter
      WHERE inviter.organization_id = organization_members.organization_id
        AND inviter.user_id = auth.uid()
        AND inviter.role IN ('owner', 'admin')
    )
  );
```

**Example Scenario:**
- User A (Owner) invites User D to "Acme Corp"
- INSERT succeeds
- User C (Developer) tries to invite User E to "Acme Corp"
- INSERT fails (Developers cannot invite members)

---

#### RLS Policy 3: `organization_members_update_policy`

**Purpose:** Only Owners can change member roles

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organization_members_update_policy ON organization_members
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be an Owner of the organization
    EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role = 'owner'
    )
  )
  WITH CHECK (
    -- After update, user must still be an Owner
    EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role = 'owner'
    )
    -- Prevent downgrading the last Owner
    AND (
      organization_members.role = 'owner'
      OR EXISTS (
        SELECT 1 FROM organization_members AS other_owners
        WHERE other_owners.organization_id = organization_members.organization_id
          AND other_owners.role = 'owner'
          AND other_owners.id != organization_members.id
      )
    )
  );
```

**Example Scenario:**
- User A (Owner) changes User B from Admin to Developer
- UPDATE succeeds
- User A tries to downgrade themselves from Owner (last Owner remaining)
- UPDATE fails (prevents organization lockout)

---

#### RLS Policy 4: `organization_members_delete_policy`

**Purpose:** Owners and Admins can remove members; users can remove themselves

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY organization_members_delete_policy ON organization_members
  FOR DELETE
  TO authenticated
  USING (
    -- User is removing themselves
    organization_members.user_id = auth.uid()
    -- OR user is Owner/Admin removing someone else
    OR EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role IN ('owner', 'admin')
    )
  );
```

**Example Scenario:**
- User C (Developer) wants to leave "Acme Corp"
- DELETE succeeds (removing themselves)
- User A (Owner) removes User D from "Acme Corp"
- DELETE succeeds (Owner can remove others)

---

### Table: `projects`

**Purpose:** Projects group secrets and environments. Users access projects via organization membership or direct project-level roles.

**Ownership:** Project Owners (can be multiple users)

---

#### RLS Policy 1: `projects_select_policy`

**Purpose:** Users can view projects if they're members of the project's organization or have direct project access

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  TO authenticated
  USING (
    -- User is a member of the organization that owns the project
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
        AND organization_members.user_id = auth.uid()
    )
    -- OR user has direct access via project_members (future feature)
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
    )
  );
```

**Example Scenario:**
- User A is in "Acme Corp" organization
- "RecipeApp" project belongs to "Acme Corp"
- User A can see "RecipeApp" project
- User B (not in "Acme Corp") cannot see "RecipeApp"

---

#### RLS Policy 2: `projects_insert_policy`

**Purpose:** Organization members can create projects within their organization

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a member of the organization
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
        AND organization_members.user_id = auth.uid()
    )
    -- User creating the project is set as the creator
    AND projects.created_by = auth.uid()
  );
```

**Example Scenario:**
- User A (in "Acme Corp") creates "NewProject" under "Acme Corp"
- INSERT succeeds
- User B (not in "Acme Corp") tries to create a project under "Acme Corp"
- INSERT fails (not a member)

---

#### RLS Policy 3: `projects_update_policy`

**Purpose:** Organization Admins and Owners can update project details

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  TO authenticated
  USING (
    -- User is Owner or Admin of the organization
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    -- After update, user must still be Owner/Admin
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );
```

---

#### RLS Policy 4: `projects_delete_policy`

**Purpose:** Only organization Owners can delete projects

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  TO authenticated
  USING (
    -- User must be an Owner of the organization
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  );
```

---

### Table: `environments`

**Purpose:** Environments (development, staging, production) within projects

**Ownership:** Inherited from project ownership

---

#### RLS Policy 1: `environments_select_policy`

**Purpose:** Users can view environments if they have access to the parent project

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY environments_select_policy ON environments
  FOR SELECT
  TO authenticated
  USING (
    -- User has access to the parent project
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = environments.project_id
        AND (
          -- Via organization membership
          EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = projects.organization_id
              AND organization_members.user_id = auth.uid()
          )
          -- OR via direct project access (future)
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
              AND project_members.user_id = auth.uid()
          )
        )
    )
  );
```

---

#### RLS Policy 2: `environments_insert_policy`

**Purpose:** Organization Admins/Owners and project contributors can create environments

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY environments_insert_policy ON environments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User has admin/owner access to the project's organization
    EXISTS (
      SELECT 1 FROM projects
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE projects.id = environments.project_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
  );
```

---

#### RLS Policy 3: `environments_update_delete_policy`

**Purpose:** Only Admins and Owners can update/delete environments

**Operation:** `UPDATE`, `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY environments_update_delete_policy ON environments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE projects.id = environments.project_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );
```

---

### Table: `secrets`

**Purpose:** Encrypted secrets stored within environments. This is the most critical table for security.

**Ownership:** Project-level access with environment-specific permissions

**CRITICAL:** Secrets are encrypted client-side; RLS protects metadata and ensures only authorized users can access encrypted blobs.

---

#### RLS Policy 1: `secrets_select_policy`

**Purpose:** Users can view secrets if they have read access to the environment

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_select_policy ON secrets
  FOR SELECT
  TO authenticated
  USING (
    -- User has access to the environment's project
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      WHERE environments.id = secrets.environment_id
        AND (
          -- Via organization membership (all roles can read)
          EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = projects.organization_id
              AND organization_members.user_id = auth.uid()
              -- Note: Even read-only users can SELECT secrets
              -- They cannot decrypt without master password
          )
          -- OR via direct project membership (future)
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
              AND project_members.user_id = auth.uid()
          )
        )
    )
  );
```

**Example Scenario:**
- User A (Developer in "Acme Corp") accesses "RecipeApp" project, "production" environment
- User A can SELECT secrets from production
- Secrets are encrypted; User A needs master password to decrypt
- User B (not in "Acme Corp") cannot SELECT secrets (RLS blocks at database level)

---

#### RLS Policy 2: `secrets_insert_policy`

**Purpose:** Developers, Admins, and Owners can create secrets

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_insert_policy ON secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be Developer, Admin, or Owner
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
    -- Secret must be created by the current user
    AND secrets.created_by = auth.uid()
  );
```

**Example Scenario:**
- User A (Developer) creates a new secret in "development" environment
- INSERT succeeds
- User B (Read-Only) tries to create a secret
- INSERT fails (read-only users cannot write)

---

#### RLS Policy 3: `secrets_update_policy`

**Purpose:** Developers, Admins, and Owners can update secrets

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_update_policy ON secrets
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be Developer, Admin, or Owner
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
  )
  WITH CHECK (
    -- After update, user must still have write access
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
  );
```

---

#### RLS Policy 4: `secrets_delete_policy`

**Purpose:** Developers, Admins, and Owners can delete secrets

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_delete_policy ON secrets
  FOR DELETE
  TO authenticated
  USING (
    -- User must be Developer, Admin, or Owner
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
  );
```

---

### Table: `audit_logs`

**Purpose:** Immutable audit trail of all actions. Users can read their own actions; only admins can read organization-wide logs.

**Ownership:** System-managed (append-only)

---

#### RLS Policy 1: `audit_logs_select_policy`

**Purpose:** Users can view audit logs for their own actions; Admins/Owners can view organization-wide logs

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

#### RLS Policy 2: `audit_logs_insert_policy`

**Purpose:** Only the system can insert audit logs (via database triggers)

**Operation:** `INSERT`

**Role:** `service_role` (Supabase service account)

**Definition:**
```sql
-- Disable INSERT for regular users
CREATE POLICY audit_logs_no_user_insert ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- No user can INSERT directly

-- Allow service role to INSERT (for triggers)
CREATE POLICY audit_logs_service_insert ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

**Example Scenario:**
- Application code (via Supabase service role) inserts audit log entry
- INSERT succeeds
- User A tries to INSERT an audit log entry
- INSERT fails (users cannot forge audit logs)

---

#### RLS Policy 3: `audit_logs_no_update_delete`

**Purpose:** Audit logs are immutable (cannot be updated or deleted)

**Operation:** `UPDATE`, `DELETE`

**Role:** All roles

**Definition:**
```sql
-- No updates allowed
CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

-- No deletes allowed (except service_role for maintenance)
CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- Service role can delete for data retention policy
CREATE POLICY audit_logs_service_delete ON audit_logs
  FOR DELETE
  TO service_role
  USING (
    -- Only delete logs older than retention period (e.g., 2 years)
    audit_logs.created_at < NOW() - INTERVAL '2 years'
  );
```

---

### Table: `user_encryption_keys`

**Purpose:** Stores PBKDF2 salts for master password derivation (per-user, sensitive)

**Ownership:** Individual users (strictly personal)

---

#### RLS Policy 1: `user_encryption_keys_select_policy`

**Purpose:** Users can only access their own encryption keys

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY user_encryption_keys_select_policy ON user_encryption_keys
  FOR SELECT
  TO authenticated
  USING (
    user_encryption_keys.user_id = auth.uid()
  );
```

---

#### RLS Policy 2: `user_encryption_keys_insert_policy`

**Purpose:** Users can create their own encryption key record (once)

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY user_encryption_keys_insert_policy ON user_encryption_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_encryption_keys.user_id = auth.uid()
  );
```

---

#### RLS Policy 3: `user_encryption_keys_update_policy`

**Purpose:** Users can update their own encryption keys (master password change)

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY user_encryption_keys_update_policy ON user_encryption_keys
  FOR UPDATE
  TO authenticated
  USING (
    user_encryption_keys.user_id = auth.uid()
  )
  WITH CHECK (
    user_encryption_keys.user_id = auth.uid()
  );
```

---

#### RLS Policy 4: `user_encryption_keys_no_delete`

**Purpose:** Encryption keys cannot be deleted (account deletion handles this separately)

**Operation:** `DELETE`

**Role:** All roles

**Definition:**
```sql
CREATE POLICY user_encryption_keys_no_delete ON user_encryption_keys
  FOR DELETE
  TO authenticated
  USING (false);  -- Prevent deletion via RLS
```

---

## Performance Considerations

### Why RLS Can Be Slow

**RLS policies are evaluated on EVERY query.** If policies are not optimized:
- Complex subqueries executed millions of times
- Missing indexes on foreign keys cause full table scans
- Nested EXISTS clauses can be expensive

**Example of a slow policy:**
```sql
-- BAD: No index on organization_members.user_id
CREATE POLICY slow_policy ON secrets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members  -- Full table scan!
      WHERE organization_members.user_id = auth.uid()
    )
  );
```

### Required Indexes for RLS Performance

**CRITICAL: These indexes must exist before enabling RLS policies:**

```sql
-- Organization membership lookups
CREATE INDEX idx_organization_members_user_id
  ON organization_members(user_id);
CREATE INDEX idx_organization_members_org_id
  ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_org
  ON organization_members(user_id, organization_id);

-- Project membership lookups
CREATE INDEX idx_project_members_user_id
  ON project_members(user_id);
CREATE INDEX idx_project_members_project_id
  ON project_members(project_id);
CREATE INDEX idx_project_members_user_project
  ON project_members(user_id, project_id);

-- Project-organization relationship
CREATE INDEX idx_projects_organization_id
  ON projects(organization_id);

-- Environment-project relationship
CREATE INDEX idx_environments_project_id
  ON environments(project_id);

-- Secrets lookups
CREATE INDEX idx_secrets_environment_id
  ON secrets(environment_id);
CREATE INDEX idx_secrets_created_by
  ON secrets(created_by);
CREATE INDEX idx_secrets_user_project
  ON secrets(environment_id, created_by);

-- Audit logs (for admin queries)
CREATE INDEX idx_audit_logs_organization_id
  ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id
  ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp
  ON audit_logs(created_at DESC);
```

### Query Plan Analysis

**Always check query plans when RLS is slow:**

```sql
-- Enable query plan output
EXPLAIN ANALYZE
SELECT * FROM secrets
WHERE environment_id = 'some-uuid';

-- Look for:
-- ✅ "Index Scan" (good)
-- ❌ "Seq Scan" (bad - missing index)
-- ✅ "Nested Loop" with fast lookups (good)
-- ❌ "Hash Join" on large tables (potentially slow)
```

### Optimization Strategies

**1. Denormalize for RLS (if necessary):**
```sql
-- Add organization_id directly to secrets table
-- Avoids JOIN in RLS policy
ALTER TABLE secrets ADD COLUMN organization_id UUID;

-- Update policy to use direct column
CREATE POLICY secrets_select_optimized ON secrets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = secrets.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );
```

**2. Use SECURITY DEFINER functions for complex logic:**
```sql
-- Create function that checks membership (optimized once)
CREATE OR REPLACE FUNCTION user_has_project_access(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members om
    JOIN projects p ON p.organization_id = om.organization_id
    WHERE p.id = project_uuid
      AND om.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use in policy
CREATE POLICY secrets_select_function ON secrets
  FOR SELECT
  USING (
    user_has_project_access(secrets.project_id)
  );
```

**3. Cache membership checks (application layer):**
- Application checks user's organization membership once
- Caches result for request lifetime
- Still rely on RLS as final enforcement

---

## Testing RLS Policies

### Manual Testing Process

**Step 1: Create test users**
```sql
-- As superuser or via Supabase Auth
INSERT INTO auth.users (id, email, encrypted_password)
VALUES
  ('user-a-uuid', 'usera@test.com', 'hashed_password'),
  ('user-b-uuid', 'userb@test.com', 'hashed_password');
```

**Step 2: Set session user**
```sql
-- Simulate User A's session
SET request.jwt.claim.sub = 'user-a-uuid';
-- OR use Supabase function
SELECT set_config('request.jwt.claim.sub', 'user-a-uuid', false);
```

**Step 3: Run queries as that user**
```sql
-- This query runs with RLS enforced for User A
SELECT * FROM secrets;
-- Should only return secrets User A can access
```

**Step 4: Verify isolation**
```sql
-- Switch to User B
SET request.jwt.claim.sub = 'user-b-uuid';

-- User B should NOT see User A's data
SELECT * FROM secrets WHERE created_by = 'user-a-uuid';
-- Expected result: 0 rows (if User B has no access)
```

### Automated Test Cases

**Test Suite for RLS Policies (Pseudocode):**

```typescript
describe('RLS Policies - Organizations', () => {
  it('should allow users to see only their organizations', async () => {
    // Setup
    const userA = await createUser('usera@test.com');
    const userB = await createUser('userb@test.com');
    const orgA = await createOrg('Acme Corp', userA);
    const orgB = await createOrg('Beta Inc', userB);

    // Test
    const userAOrgs = await queryAsUser(userA, 'SELECT * FROM organizations');
    const userBOrgs = await queryAsUser(userB, 'SELECT * FROM organizations');

    // Assert
    expect(userAOrgs).toHaveLength(1);
    expect(userAOrgs[0].id).toBe(orgA.id);
    expect(userBOrgs).toHaveLength(1);
    expect(userBOrgs[0].id).toBe(orgB.id);
  });

  it('should prevent cross-tenant access', async () => {
    const userA = await createUser('usera@test.com');
    const userB = await createUser('userb@test.com');
    const orgA = await createOrg('Acme Corp', userA);

    // User B tries to query User A's organization
    const result = await queryAsUser(userB, `SELECT * FROM organizations WHERE id = '${orgA.id}'`);

    expect(result).toHaveLength(0);  // Should be blocked by RLS
  });
});

describe('RLS Policies - Secrets', () => {
  it('should allow project members to read secrets', async () => {
    const user = await createUser('user@test.com');
    const org = await createOrg('Acme Corp', user);
    const project = await createProject('RecipeApp', org, user);
    const env = await createEnvironment('production', project);
    const secret = await createSecret('OPENAI_KEY', env, user);

    const result = await queryAsUser(user, `SELECT * FROM secrets WHERE id = '${secret.id}'`);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(secret.id);
  });

  it('should prevent non-members from reading secrets', async () => {
    const userA = await createUser('usera@test.com');
    const userB = await createUser('userb@test.com');
    const orgA = await createOrg('Acme Corp', userA);
    const project = await createProject('RecipeApp', orgA, userA);
    const env = await createEnvironment('production', project);
    const secret = await createSecret('OPENAI_KEY', env, userA);

    // User B (not in Acme Corp) tries to access the secret
    const result = await queryAsUser(userB, `SELECT * FROM secrets WHERE id = '${secret.id}'`);

    expect(result).toHaveLength(0);  // Blocked by RLS
  });

  it('should prevent read-only users from inserting secrets', async () => {
    const owner = await createUser('owner@test.com');
    const readOnly = await createUser('readonly@test.com');
    const org = await createOrg('Acme Corp', owner);
    await addOrgMember(org, readOnly, 'read-only');
    const project = await createProject('RecipeApp', org, owner);
    const env = await createEnvironment('production', project);

    // Read-only user tries to insert a secret
    const insertResult = await queryAsUser(
      readOnly,
      `INSERT INTO secrets (environment_id, key_name, encrypted_value, created_by)
       VALUES ('${env.id}', 'NEW_KEY', 'encrypted', '${readOnly.id}')`
    );

    expect(insertResult.error).toBeDefined();  // Should fail RLS check
  });
});
```

### Testing Checklist

**For each table:**
- [ ] User can SELECT only authorized rows
- [ ] User cannot SELECT unauthorized rows (cross-tenant)
- [ ] User can INSERT only with proper permissions
- [ ] User cannot INSERT into other tenants' data
- [ ] User can UPDATE only authorized rows
- [ ] User cannot UPDATE unauthorized rows
- [ ] User can DELETE only authorized rows
- [ ] User cannot DELETE unauthorized rows
- [ ] Policies enforce role-based permissions correctly
- [ ] Performance is acceptable (< 100ms for typical queries)

---

## Common Pitfalls

### Pitfall 1: Forgetting to Enable RLS

**Problem:**
```sql
-- RLS policies defined but not enabled!
CREATE TABLE secrets (...);
CREATE POLICY secrets_select_policy ON secrets ...;
-- Missing: ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
```

**Result:** Policies are ignored; users can access all rows.

**Fix:**
```sql
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
```

---

### Pitfall 2: Missing Indexes on Policy Columns

**Problem:**
```sql
-- Policy references organization_members.user_id
-- But no index exists!
CREATE POLICY my_policy ON secrets
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()  -- Full table scan!
    )
  );
```

**Result:** Slow queries (10x - 100x slower).

**Fix:**
```sql
CREATE INDEX idx_organization_members_user_id
  ON organization_members(user_id);
```

---

### Pitfall 3: Circular Policy Dependencies

**Problem:**
```sql
-- Policy A depends on table B
CREATE POLICY policy_a ON table_a
  USING (EXISTS (SELECT 1 FROM table_b WHERE ...));

-- Policy B depends on table A (circular!)
CREATE POLICY policy_b ON table_b
  USING (EXISTS (SELECT 1 FROM table_a WHERE ...));
```

**Result:** Infinite recursion, queries hang or fail.

**Fix:** Redesign policies to avoid circular dependencies. Use helper functions or denormalized columns.

---

### Pitfall 4: Using SELECT * in Policies

**Problem:**
```sql
CREATE POLICY bad_policy ON secrets
  USING (
    EXISTS (
      SELECT * FROM organization_members  -- Fetches all columns!
      WHERE user_id = auth.uid()
    )
  );
```

**Result:** Slower queries, unnecessary data transfer.

**Fix:**
```sql
CREATE POLICY good_policy ON secrets
  USING (
    EXISTS (
      SELECT 1 FROM organization_members  -- Only existence check
      WHERE user_id = auth.uid()
    )
  );
```

---

### Pitfall 5: Forgetting WITH CHECK Clause

**Problem:**
```sql
CREATE POLICY update_policy ON secrets
  FOR UPDATE
  USING (user_id = auth.uid());
  -- Missing: WITH CHECK (user_id = auth.uid())
```

**Result:** User can update a row they own to point to another user (privilege escalation).

**Fix:**
```sql
CREATE POLICY update_policy ON secrets
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());  -- Ensures updated row still matches
```

---

### Pitfall 6: Not Testing as Different Users

**Problem:** Only testing as superuser or service_role (RLS is bypassed for these roles).

**Result:** Policies seem to work but fail for real users.

**Fix:** Always test as `authenticated` role users with `SET request.jwt.claim.sub`.

---

### Pitfall 7: Allowing service_role Bypass in Production

**Problem:** Application uses `service_role` key for all database operations (bypasses RLS).

**Result:** No RLS enforcement; bugs expose cross-tenant data.

**Fix:** Use `anon` or `authenticated` roles in application code. Reserve `service_role` for admin operations only.

---

## Debugging RLS Issues

### Symptom: "Permission denied for relation [table]"

**Cause:** RLS is enabled but no policy grants access.

**Debug Steps:**
1. Check if RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table';
   ```
2. List policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'your_table';
   ```
3. Verify user's role:
   ```sql
   SELECT current_user, auth.uid();
   ```
4. Manually test policy condition:
   ```sql
   -- Test the USING clause directly
   SELECT EXISTS (
     SELECT 1 FROM organization_members
     WHERE user_id = auth.uid()
   );
   ```

---

### Symptom: Queries Return Empty Results

**Cause:** Policy is too restrictive or uses wrong logic.

**Debug Steps:**
1. Disable RLS temporarily:
   ```sql
   ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
   SELECT * FROM your_table;  -- Should return rows
   ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
   ```
2. Simplify policy condition:
   ```sql
   -- Replace complex policy with simple test
   CREATE POLICY test_policy ON your_table
     FOR SELECT
     USING (true);  -- Allow all rows
   ```
3. Incrementally add conditions until it breaks.

---

### Symptom: Extremely Slow Queries

**Cause:** Missing indexes on policy columns.

**Debug Steps:**
1. Check query plan:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM secrets WHERE environment_id = 'uuid';
   ```
2. Look for "Seq Scan" (bad) vs. "Index Scan" (good).
3. Add indexes:
   ```sql
   CREATE INDEX idx_secrets_environment_id ON secrets(environment_id);
   ```

---

### Symptom: User Can Access Data They Shouldn't

**Cause:** Policy logic error (overly permissive).

**Debug Steps:**
1. Review policy definition:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'your_table';
   ```
2. Test as different users:
   ```sql
   SET request.jwt.claim.sub = 'user-a-uuid';
   SELECT * FROM your_table;

   SET request.jwt.claim.sub = 'user-b-uuid';
   SELECT * FROM your_table;
   ```
3. Check for missing AND/OR conditions.

---

## Migration Scripts

### Initial Migration: Enable RLS and Create Policies

**File:** `migrations/003_enable_rls_policies.sql`

**Description:** Enables RLS and creates all policies for multi-tenancy enforcement

**SQL:**
```sql
-- ============================================
-- ENABLE ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE REQUIRED INDEXES FOR PERFORMANCE
-- ============================================

-- Organization membership lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id
  ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_org
  ON organization_members(user_id, organization_id);

-- Project-organization relationship
CREATE INDEX IF NOT EXISTS idx_projects_organization_id
  ON projects(organization_id);

-- Environment-project relationship
CREATE INDEX IF NOT EXISTS idx_environments_project_id
  ON environments(project_id);

-- Secrets lookups
CREATE INDEX IF NOT EXISTS idx_secrets_environment_id
  ON secrets(environment_id);
CREATE INDEX IF NOT EXISTS idx_secrets_created_by
  ON secrets(created_by);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id
  ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
  ON audit_logs(created_at DESC);

-- ============================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================

CREATE POLICY organizations_select_policy ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY organizations_insert_policy ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY organizations_update_policy ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  );

CREATE POLICY organizations_delete_policy ON organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  );

-- ============================================
-- ORGANIZATION_MEMBERS TABLE POLICIES
-- ============================================

CREATE POLICY organization_members_select_policy ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
    )
  );

CREATE POLICY organization_members_insert_policy ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members AS inviter
      WHERE inviter.organization_id = organization_members.organization_id
        AND inviter.user_id = auth.uid()
        AND inviter.role IN ('owner', 'admin')
    )
  );

CREATE POLICY organization_members_update_policy ON organization_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role = 'owner'
    )
    AND (
      organization_members.role = 'owner'
      OR EXISTS (
        SELECT 1 FROM organization_members AS other_owners
        WHERE other_owners.organization_id = organization_members.organization_id
          AND other_owners.role = 'owner'
          AND other_owners.id != organization_members.id
      )
    )
  );

CREATE POLICY organization_members_delete_policy ON organization_members
  FOR DELETE
  TO authenticated
  USING (
    organization_members.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members AS my_membership
      WHERE my_membership.organization_id = organization_members.organization_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- SECRETS TABLE POLICIES (MOST CRITICAL)
-- ============================================

CREATE POLICY secrets_select_policy ON secrets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      WHERE environments.id = secrets.environment_id
        AND EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = projects.organization_id
            AND organization_members.user_id = auth.uid()
        )
    )
  );

CREATE POLICY secrets_insert_policy ON secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
    AND secrets.created_by = auth.uid()
  );

CREATE POLICY secrets_update_policy ON secrets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
  );

CREATE POLICY secrets_delete_policy ON secrets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM environments
      JOIN projects ON projects.id = environments.project_id
      JOIN organization_members ON organization_members.organization_id = projects.organization_id
      WHERE environments.id = secrets.environment_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'developer')
    )
  );

-- ============================================
-- AUDIT_LOGS TABLE POLICIES (IMMUTABLE)
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
-- USER_ENCRYPTION_KEYS TABLE POLICIES
-- ============================================

CREATE POLICY user_encryption_keys_select_policy ON user_encryption_keys
  FOR SELECT
  TO authenticated
  USING (user_encryption_keys.user_id = auth.uid());

CREATE POLICY user_encryption_keys_insert_policy ON user_encryption_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (user_encryption_keys.user_id = auth.uid());

CREATE POLICY user_encryption_keys_update_policy ON user_encryption_keys
  FOR UPDATE
  TO authenticated
  USING (user_encryption_keys.user_id = auth.uid())
  WITH CHECK (user_encryption_keys.user_id = auth.uid());

CREATE POLICY user_encryption_keys_no_delete ON user_encryption_keys
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'organization_members',
    'projects',
    'environments',
    'secrets',
    'audit_logs',
    'user_encryption_keys'
  );

-- Verify policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify indexes exist
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

**Verification:**
```sql
-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('organizations', 'secrets', 'audit_logs');

-- Verify policies created
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'secrets';

-- Verify indexes created
SELECT tablename, indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%';
```

**Rollback:**
```sql
-- Disable RLS (emergency only!)
ALTER TABLE secrets DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
-- ... (repeat for all tables)

-- Drop policies
DROP POLICY IF EXISTS secrets_select_policy ON secrets;
-- ... (repeat for all policies)

-- Drop indexes
DROP INDEX IF EXISTS idx_organization_members_user_id;
-- ... (repeat for all indexes)
```

---

## Dependencies

### Schema Dependencies

**Must exist before this RLS configuration:**
- [ ] `auth.users` (Supabase managed) - User authentication
- [ ] `organizations` table - Organization data
- [ ] `organization_members` table - Organization membership
- [ ] `projects` table - Project data
- [ ] `environments` table - Environment data
- [ ] `secrets` table - Encrypted secrets
- [ ] `audit_logs` table - Audit trail
- [ ] `user_encryption_keys` table - Master password salts

**Required by these features:**
- All API endpoints (RLS enforces security at database level)
- Frontend application (RLS prevents unauthorized data exposure)
- MCP integration (RLS ensures AI tools cannot access unauthorized secrets)

### Feature Dependencies

**Required by features:**
- `05-api/endpoints/secrets-endpoints.md` - API depends on RLS
- `08-features/team-collaboration.md` - Team features require RLS
- `08-features/audit-logs.md` - Audit logging protected by RLS
- `09-integrations/mcp/secrets-server-spec.md` - MCP server relies on RLS

---

## References

### Internal Documentation
- `03-security/rbac/permissions-model.md` - Role definitions and permissions
- `03-security/security-model.md` - Zero-knowledge architecture
- `04-database/database-overview.md` - Database architecture
- `TECH-STACK.md` - PostgreSQL and Supabase specifications
- `GLOSSARY.md` - Term definitions (RLS, multi-tenancy, RBAC)

### External Resources
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - Official PostgreSQL docs
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - Supabase-specific RLS patterns
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization) - Index optimization
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) - Security best practices

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Backend Engineer | Initial RLS policies documentation |

---

## Notes

### Future Enhancements
- **Project-level roles** (separate from organization membership) - Phase 3
- **Conditional RLS for production environments** (require approval for production secret access) - Phase 3
- **RLS policy monitoring** (alert on failed RLS checks) - Phase 4
- **Dynamic policy generation** for custom roles (enterprise feature) - Phase 4+

### Known Limitations
- RLS policies can impact query performance if not indexed properly
- Complex policies with many JOINs may need optimization
- Service role bypasses RLS (must be used carefully in application code)

### Next Review Date
**2026-01-29** - Review RLS performance, optimize policies based on production metrics
