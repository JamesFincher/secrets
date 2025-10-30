---
Document: Permissions Model - Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/auth/authentication-flow.md, GLOSSARY.md, TECH-STACK.md
---

# Permissions Model Architecture

## Overview

This document defines the complete role-based access control (RBAC) permissions model for Abyrith, specifying how users are granted access to resources (projects, environments, secrets) and how these permissions are evaluated and enforced at multiple layers. The model supports a hierarchy from organizations down to individual secrets, with permissions inherited and evaluated at each level.

**Purpose:** Establish a clear, secure, and scalable permissions model that prevents unauthorized access while remaining simple enough for individual users and flexible enough for enterprise teams.

**Scope:** Permission definitions, role-based access, resource-level access control, inheritance model, enforcement at API and database layers, and permission evaluation logic.

**Status:** Draft - Implementation pending

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [API Contracts](#api-contracts)
7. [Security Architecture](#security-architecture)
8. [Performance Characteristics](#performance-characteristics)
9. [Scalability](#scalability)
10. [Failure Modes](#failure-modes)
11. [Alternatives Considered](#alternatives-considered)
12. [Decision Log](#decision-log)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith stores sensitive secrets for users and teams. We must control who can access, modify, and delete resources at multiple levels (organizations, projects, environments, individual secrets) while maintaining a zero-knowledge architecture where the server cannot decrypt secret values.

**Pain points:**
- Need to support solo users (simple) and enterprises (complex) with the same model
- Must prevent unauthorized access to secrets while allowing legitimate team collaboration
- Row-Level Security (RLS) in PostgreSQL is powerful but can be complex to maintain
- Permission checks must be fast (every API call validates permissions)
- Zero-knowledge encryption means we can't use secret values for permission decisions

**Why now?**
The permissions model is foundational. Every feature that involves multi-user access depends on this being correct and secure.

### Background

**Existing system:**
This is a greenfield implementation. No existing permissions system.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Security Lead | Prevent unauthorized access | RLS policies correct, no privilege escalation, audit trail |
| Backend Engineer | Implement and maintain | Performance, RLS complexity, debugging access issues |
| Frontend Engineer | Display correct UI | Know what user can/can't do, hide unavailable actions |
| Solo Users | Simple setup | Don't want to think about permissions, just want it to work |
| Team Admins | Manage access | Easy to invite, assign roles, see who has what access |
| Enterprise Security | Compliance | Audit trail, least privilege, approval workflows |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Secure resource access** - Users can only access resources they're authorized for (success metric: 0 unauthorized access incidents)
2. **Simple for individuals** - Solo users don't need to manage permissions (success metric: no permissions setup required for single-user projects)
3. **Scalable for teams** - Support organizations with hundreds of members and projects (success metric: <100ms permission evaluation at p95)
4. **Least privilege** - Default to minimum necessary permissions (success metric: 0 over-permissioned users in security audit)

**Secondary goals:**
- Support permission delegation (Owners can assign Admins)
- Enable temporary access grants (for contractors, support)
- Provide clear permission denial reasons for debugging

### Non-Goals

**Explicitly out of scope:**
- **Custom role definitions** - MVP has 4 fixed roles, custom roles are post-MVP
- **Attribute-based access control (ABAC)** - Too complex for MVP, RBAC is sufficient
- **Time-based access expiration** - Post-MVP feature (temporary access grants)
- **IP-based restrictions** - Enterprise feature, not MVP

### Success Metrics

**How we measure success:**
- **Security**: 0 unauthorized access incidents
- **Performance**: Permission evaluation <50ms p95
- **Usability**: Solo users rate permissions as "invisible" (don't think about it)
- **Audit Compliance**: Can answer "who can access X?" in <5 seconds

---

## Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────┐
│               User Request                      │
│   "Can user X access secret Y?"                │
└──────────────────┬─────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│         Cloudflare Workers                       │
│   • Extract user_id from JWT                    │
│   • Basic role check (if needed)                │
│   • Forward to Supabase with JWT               │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│         Supabase (PostgreSQL)                    │
│                                                  │
│   ┌────────────────────────────────────────┐   │
│   │    RLS Policies (Primary Enforcement)  │   │
│   │  • Check user_id in JWT                │   │
│   │  • Query org_members table             │   │
│   │  • Query project_members table         │   │
│   │  • Evaluate role permissions           │   │
│   │  • Return only authorized rows         │   │
│   └────────────────────────────────────────┘   │
│                                                  │
│   ┌────────────────────────────────────────┐   │
│   │    Permission Helper Functions         │   │
│   │  • has_org_role(user, org, role)       │   │
│   │  • has_project_role(user, proj, role)  │   │
│   │  • can_access_secret(user, secret)     │   │
│   └────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Permission Definitions**
- **Purpose:** Define what each permission allows
- **Technology:** TypeScript enums + PostgreSQL CHECK constraints
- **Responsibilities:**
  - Define granular permissions (read_secrets, write_secrets, etc.)
  - Map permissions to roles (Owner, Admin, Developer, Read-Only)
  - Provide TypeScript types for frontend and backend

**Component 2: Role Definitions**
- **Purpose:** Define roles and their permission bundles
- **Technology:** PostgreSQL table + TypeScript constants
- **Responsibilities:**
  - Store role → permissions mapping
  - Support role hierarchy (Owner > Admin > Developer > Read-Only)
  - Allow role assignment at organization and project levels

**Component 3: Row-Level Security (RLS) Policies**
- **Purpose:** Enforce permissions at database level
- **Technology:** PostgreSQL RLS
- **Responsibilities:**
  - Prevent unauthorized data access
  - Evaluate user's role and permissions for each query
  - Enforce multi-tenancy (users can't see other orgs' data)
  - Audit all access attempts

**Component 4: API Middleware (Workers)**
- **Purpose:** Pre-filter requests and provide early permission feedback
- **Technology:** Cloudflare Workers (TypeScript)
- **Responsibilities:**
  - Validate JWT token contains user_id
  - Provide helpful error messages before database query
  - Rate limiting based on user role
  - Log permission denied events

**Component 5: Frontend Permission Context**
- **Purpose:** Hide UI elements user doesn't have permission for
- **Technology:** React Context + hooks
- **Responsibilities:**
  - Determine what UI to show based on user's roles
  - Disable buttons/forms for actions user can't perform
  - Provide helpful tooltips ("You need Admin role to do this")

---

## Component Details

### Component: Permission Definitions

**Purpose:** Define all possible permissions in the system.

**Responsibilities:**
- Enumerate every action that can be permission-controlled
- Group permissions by resource type
- Provide clear naming convention

**Granular Permissions:**

**Organization-Level Permissions:**
```typescript
enum OrgPermission {
  // Membership management
  CAN_INVITE_MEMBERS = 'can_invite_members',
  CAN_REMOVE_MEMBERS = 'can_remove_members',
  CAN_CHANGE_MEMBER_ROLES = 'can_change_member_roles',

  // Project management
  CAN_CREATE_PROJECTS = 'can_create_projects',
  CAN_DELETE_PROJECTS = 'can_delete_projects',

  // Organization management
  CAN_UPDATE_ORG_SETTINGS = 'can_update_org_settings',
  CAN_VIEW_ORG_AUDIT_LOGS = 'can_view_org_audit_logs',
  CAN_DELETE_ORGANIZATION = 'can_delete_organization',

  // Billing (future)
  CAN_MANAGE_BILLING = 'can_manage_billing',
  CAN_VIEW_BILLING = 'can_view_billing'
}
```

**Project-Level Permissions:**
```typescript
enum ProjectPermission {
  // Secret management
  CAN_READ_SECRETS = 'can_read_secrets',         // View secret metadata
  CAN_DECRYPT_SECRETS = 'can_decrypt_secrets',   // Actually decrypt values
  CAN_CREATE_SECRETS = 'can_create_secrets',
  CAN_UPDATE_SECRETS = 'can_update_secrets',
  CAN_DELETE_SECRETS = 'can_delete_secrets',

  // Environment management
  CAN_CREATE_ENVIRONMENTS = 'can_create_environments',
  CAN_UPDATE_ENVIRONMENTS = 'can_update_environments',
  CAN_DELETE_ENVIRONMENTS = 'can_delete_environments',

  // Project team management
  CAN_INVITE_PROJECT_MEMBERS = 'can_invite_project_members',
  CAN_REMOVE_PROJECT_MEMBERS = 'can_remove_project_members',
  CAN_CHANGE_PROJECT_MEMBER_ROLES = 'can_change_project_member_roles',

  // Project settings
  CAN_UPDATE_PROJECT_SETTINGS = 'can_update_project_settings',
  CAN_VIEW_PROJECT_AUDIT_LOGS = 'can_view_project_audit_logs',
  CAN_DELETE_PROJECT = 'can_delete_project'
}
```

**Secret-Level Permissions:**
```typescript
enum SecretPermission {
  CAN_VIEW_SECRET_METADATA = 'can_view_secret_metadata', // Name, tags, last modified
  CAN_DECRYPT_SECRET_VALUE = 'can_decrypt_secret_value', // Actual secret value
  CAN_UPDATE_SECRET = 'can_update_secret',
  CAN_DELETE_SECRET = 'can_delete_secret',
  CAN_VIEW_SECRET_HISTORY = 'can_view_secret_history',
  CAN_SHARE_SECRET = 'can_share_secret'                  // One-time share links
}
```

**Database Schema:**
```sql
-- Permission definitions table (reference data)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- 'organization' | 'project' | 'secret'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Example data
INSERT INTO permissions (name, resource_type, description) VALUES
  ('can_read_secrets', 'project', 'View secret names and metadata'),
  ('can_decrypt_secrets', 'project', 'Decrypt and view secret values'),
  ('can_create_secrets', 'project', 'Create new secrets'),
  ('can_update_secrets', 'project', 'Update existing secrets'),
  ('can_delete_secrets', 'project', 'Delete secrets');
```

---

### Component: Role Definitions

**Purpose:** Define roles and their permission bundles.

**Responsibilities:**
- Map roles to collections of permissions
- Establish role hierarchy
- Support both organization-level and project-level roles

**Role Hierarchy:**
```
Owner (highest privilege)
  ├─ All Admin permissions
  └─ + can_delete_organization, can_delete_project

Admin
  ├─ All Developer permissions
  └─ + can_invite_members, can_remove_members, can_change_member_roles

Developer
  ├─ All Read-Only permissions
  └─ + can_create_secrets, can_update_secrets, can_delete_secrets

Read-Only (lowest privilege)
  └─ can_read_secrets, can_view_project_audit_logs
```

**Role Definitions:**

```typescript
interface RoleDefinition {
  name: string;
  level: number;              // For hierarchy comparison
  permissions: Permission[];  // Permissions granted
  description: string;
}

const ROLES: Record<string, RoleDefinition> = {
  OWNER: {
    name: 'Owner',
    level: 4,
    permissions: [
      // All organization permissions
      'can_invite_members',
      'can_remove_members',
      'can_change_member_roles',
      'can_create_projects',
      'can_delete_projects',
      'can_update_org_settings',
      'can_view_org_audit_logs',
      'can_delete_organization',

      // All project permissions
      'can_read_secrets',
      'can_decrypt_secrets',
      'can_create_secrets',
      'can_update_secrets',
      'can_delete_secrets',
      'can_create_environments',
      'can_update_environments',
      'can_delete_environments',
      'can_invite_project_members',
      'can_remove_project_members',
      'can_change_project_member_roles',
      'can_update_project_settings',
      'can_view_project_audit_logs',
      'can_delete_project'
    ],
    description: 'Full control over organization and all projects'
  },

  ADMIN: {
    name: 'Admin',
    level: 3,
    permissions: [
      // Organization permissions
      'can_invite_members',
      'can_remove_members',
      'can_change_member_roles',
      'can_create_projects',
      'can_update_org_settings',
      'can_view_org_audit_logs',
      // Note: Cannot delete organization

      // Project permissions (all except delete project)
      'can_read_secrets',
      'can_decrypt_secrets',
      'can_create_secrets',
      'can_update_secrets',
      'can_delete_secrets',
      'can_create_environments',
      'can_update_environments',
      'can_delete_environments',
      'can_invite_project_members',
      'can_remove_project_members',
      'can_change_project_member_roles',
      'can_update_project_settings',
      'can_view_project_audit_logs'
      // Note: Cannot delete projects
    ],
    description: 'Manage team and secrets, cannot delete organization or projects'
  },

  DEVELOPER: {
    name: 'Developer',
    level: 2,
    permissions: [
      // Project permissions only
      'can_read_secrets',
      'can_decrypt_secrets',
      'can_create_secrets',
      'can_update_secrets',
      'can_delete_secrets',
      'can_create_environments',
      'can_update_environments',
      'can_delete_environments',
      'can_view_project_audit_logs'
      // Note: Cannot manage team members or delete projects
    ],
    description: 'Full access to secrets and environments, cannot manage team'
  },

  READ_ONLY: {
    name: 'Read-Only',
    level: 1,
    permissions: [
      'can_read_secrets',
      'can_view_project_audit_logs'
      // Note: Cannot decrypt secrets, cannot modify anything
    ],
    description: 'View secret names and metadata only, cannot decrypt or modify'
  }
};
```

**Database Schema:**
```sql
-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL, -- 'Owner' | 'Admin' | 'Developer' | 'Read-Only'
  level INTEGER NOT NULL,            -- For hierarchy comparison
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_role_name CHECK (name IN ('Owner', 'Admin', 'Developer', 'Read-Only'))
);

-- Role permissions mapping
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(role_id, permission_id)
);

-- Seed data
INSERT INTO roles (name, level, description) VALUES
  ('Owner', 4, 'Full control over organization and all projects'),
  ('Admin', 3, 'Manage team and secrets, cannot delete organization or projects'),
  ('Developer', 2, 'Full access to secrets and environments, cannot manage team'),
  ('Read-Only', 1, 'View secret names and metadata only, cannot decrypt or modify');
```

---

### Component: Inheritance Model

**Purpose:** Define how permissions flow from organization → project → environment → secret.

**Inheritance Rules:**

**Rule 1: Organization role grants baseline access to all projects**
- User with `Owner` role in organization has `Owner` role in all projects
- User with `Admin` role in organization has `Admin` role in all projects
- Exception: Project-specific roles can override (user is Admin in org but Developer in specific project)

**Rule 2: Project role grants access to all environments in that project**
- User with `Developer` role in project can access secrets in dev, staging, production environments
- Exception: Production environment can require additional approval (enterprise feature)

**Rule 3: Role hierarchy is enforced**
- Higher roles inherit all lower role permissions
- Owner ⊃ Admin ⊃ Developer ⊃ Read-Only

**Rule 4: Most privileged role wins**
- If user is `Admin` in org and `Developer` in specific project → Admin (org role higher)
- If user is `Developer` in org and `Admin` in specific project → Admin (project role higher)
- Evaluation: `MAX(org_role_level, project_role_level)`

**Evaluation Logic:**
```typescript
function getUserEffectiveRole(
  userId: string,
  projectId: string
): Role {
  // 1. Get user's organization role (if organization exists)
  const orgRole = getUserOrgRole(userId, getOrgForProject(projectId));

  // 2. Get user's project-specific role (if assigned)
  const projectRole = getUserProjectRole(userId, projectId);

  // 3. Return the higher of the two
  if (!orgRole) return projectRole;
  if (!projectRole) return orgRole;

  return orgRole.level > projectRole.level ? orgRole : projectRole;
}

function userHasPermission(
  userId: string,
  projectId: string,
  permission: Permission
): boolean {
  const effectiveRole = getUserEffectiveRole(userId, projectId);
  return effectiveRole.permissions.includes(permission);
}
```

**Database Implementation:**
```sql
-- Organization members (baseline permissions)
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(organization_id, user_id)
);

-- Project members (override organization permissions)
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(project_id, user_id)
);

-- Helper function: Get user's effective role for a project
CREATE OR REPLACE FUNCTION get_user_project_role(
  p_user_id UUID,
  p_project_id UUID
) RETURNS UUID AS $$
DECLARE
  v_org_role_level INTEGER;
  v_project_role_level INTEGER;
  v_effective_role_id UUID;
BEGIN
  -- Get organization role level (if user is org member)
  SELECT r.level, r.id INTO v_org_role_level, v_effective_role_id
  FROM org_members om
  JOIN projects p ON p.organization_id = om.organization_id
  JOIN roles r ON r.id = om.role_id
  WHERE om.user_id = p_user_id
    AND p.id = p_project_id;

  -- Get project-specific role level (if assigned)
  SELECT r.level, r.id INTO v_project_role_level, v_effective_role_id
  FROM project_members pm
  JOIN roles r ON r.id = pm.role_id
  WHERE pm.user_id = p_user_id
    AND pm.project_id = p_project_id;

  -- Return highest role level
  IF v_org_role_level IS NULL AND v_project_role_level IS NULL THEN
    RETURN NULL; -- User has no access
  ELSIF v_org_role_level IS NULL THEN
    RETURN v_effective_role_id; -- Project role only
  ELSIF v_project_role_level IS NULL THEN
    RETURN v_effective_role_id; -- Org role only
  ELSIF v_org_role_level >= v_project_role_level THEN
    RETURN v_effective_role_id; -- Org role higher
  ELSE
    RETURN v_effective_role_id; -- Project role higher
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Component: Permission Evaluation

**Purpose:** Determine if a user can perform a specific action.

**Evaluation Flow:**
```
1. Extract user_id from JWT token
2. Identify resource (project_id, secret_id, etc.)
3. Determine required permission (e.g., "can_decrypt_secrets")
4. Get user's effective role for that resource
5. Check if role has required permission
6. Return true/false (or throw error)
```

**PostgreSQL Helper Functions:**

```sql
-- Check if user has specific permission in project
CREATE OR REPLACE FUNCTION user_has_project_permission(
  p_user_id UUID,
  p_project_id UUID,
  p_permission_name VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Get user's effective role and check if it has the permission
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE rp.role_id = get_user_project_role(p_user_id, p_project_id)
      AND perm.name = p_permission_name
  ) INTO v_has_permission;

  RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can access secret (combines project + secret-level checks)
CREATE OR REPLACE FUNCTION user_can_decrypt_secret(
  p_user_id UUID,
  p_secret_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Get project for this secret
  SELECT project_id INTO v_project_id
  FROM secrets
  WHERE id = p_secret_id;

  -- Check project-level permission
  RETURN user_has_project_permission(
    p_user_id,
    v_project_id,
    'can_decrypt_secrets'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**TypeScript Client Helpers:**

```typescript
// Client-side permission checking (for UI only, not security)
interface PermissionContext {
  userId: string;
  projectId: string;
  effectiveRole: Role;
}

function usePermissions(projectId: string): PermissionContext {
  const { user } = useAuth();
  const { data: effectiveRole } = useQuery(
    ['userRole', projectId],
    () => fetchUserRole(user.id, projectId)
  );

  return {
    userId: user.id,
    projectId,
    effectiveRole
  };
}

function useCanPerform(permission: Permission): boolean {
  const { effectiveRole } = usePermissions();
  return effectiveRole?.permissions.includes(permission) ?? false;
}

// Example usage in component
function SecretCard({ secret }) {
  const canDecrypt = useCanPerform('can_decrypt_secrets');
  const canUpdate = useCanPerform('can_update_secrets');
  const canDelete = useCanPerform('can_delete_secrets');

  return (
    <div>
      <h3>{secret.name}</h3>
      {canDecrypt && <button onClick={decrypt}>Decrypt</button>}
      {canUpdate && <button onClick={edit}>Edit</button>}
      {canDelete && <button onClick={remove}>Delete</button>}
    </div>
  );
}
```

---

## Data Flow

### Flow 1: User Requests to Read Secret

**Trigger:** User clicks "View Secret" in UI

**Steps:**

1. **Frontend: Check UI Permission**
   ```typescript
   const canDecrypt = useCanPerform('can_decrypt_secrets');
   if (!canDecrypt) {
     return <div>You don't have permission to view this secret</div>;
   }

   // User can see decrypt button
   ```

2. **Frontend: Make API Request**
   ```typescript
   const response = await fetch('/api/secrets/secret-id', {
     headers: {
       'Authorization': `Bearer ${jwtToken}`
     }
   });
   ```

3. **Cloudflare Workers: Extract User ID**
   ```typescript
   const token = request.headers.get('Authorization')?.replace('Bearer ', '');
   const { sub: userId } = await verifyJWT(token);

   // Forward to Supabase with JWT
   ```

4. **Supabase RLS: Enforce Permission**
   ```sql
   -- RLS policy on secrets table (SELECT)
   CREATE POLICY "Users can read secrets they have permission for"
   ON secrets
   FOR SELECT
   TO authenticated
   USING (
     user_can_decrypt_secret(
       auth.uid(),  -- User from JWT
       id           -- Secret ID
     ) = TRUE
   );
   ```

5. **PostgreSQL: Execute Query**
   ```sql
   -- Query executes with RLS policy applied
   SELECT id, project_id, environment_id, name, encrypted_value
   FROM secrets
   WHERE id = 'secret-id';

   -- If user doesn't have permission, query returns 0 rows
   ```

6. **API: Return Result**
   - If authorized: Return encrypted secret (user decrypts client-side)
   - If not authorized: Return 403 Forbidden or empty result

7. **Frontend: Decrypt Secret**
   ```typescript
   if (response.ok) {
     const { encrypted_value } = await response.json();
     const decrypted = await decryptSecret(encrypted_value, masterKey);
     showSecret(decrypted);
   }
   ```

**Sequence Diagram:**
```
User     Frontend   Workers   Supabase    PostgreSQL
 |          |          |          |            |
 |--click-->|          |          |            |
 | "View"   |          |          |            |
 |          |          |          |            |
 |          |--check-->|          |            |
 |          | role     |   (local check)       |
 |          |<--can----|          |            |
 |          | decrypt  |          |            |
 |          |          |          |            |
 |          |--GET---->|          |            |
 |          | /secrets |          |            |
 |          | +JWT     |          |            |
 |          |          |          |            |
 |          |          |--verify->|            |
 |          |          | JWT      |            |
 |          |          |<-userId--|            |
 |          |          |          |            |
 |          |          |-------SELECT-------->|
 |          |          |       with RLS       |
 |          |          |          |--check--->|
 |          |          |          |  perms    |
 |          |          |          |<--allow---|
 |          |          |<------result---------|
 |          |          |          |            |
 |          |<--200----|          |            |
 |          | encrypted|          |            |
 |          |          |          |            |
 |          |--decrypt-|          |            |
 |          | (client) |  (local decryption)  |
 |<-display-|          |          |            |
 | secret   |          |          |            |
```

---

### Flow 2: Admin Invites User to Project

**Trigger:** Admin clicks "Invite Member" and assigns role

**Steps:**

1. **Frontend: Check Permission**
   ```typescript
   const canInvite = useCanPerform('can_invite_project_members');
   if (!canInvite) {
     showError("You don't have permission to invite members");
     return;
   }
   ```

2. **Frontend: Submit Invitation**
   ```typescript
   await fetch('/api/projects/project-id/members', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwtToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       email: 'newuser@example.com',
       role: 'Developer'
     })
   });
   ```

3. **Workers: Verify JWT**
   - Extract user_id from JWT
   - Forward to Supabase

4. **Supabase RLS: Check Inviter Permission**
   ```sql
   -- RLS policy on project_members table (INSERT)
   CREATE POLICY "Admins can invite project members"
   ON project_members
   FOR INSERT
   TO authenticated
   WITH CHECK (
     user_has_project_permission(
       auth.uid(),
       project_id,
       'can_invite_project_members'
     ) = TRUE
   );
   ```

5. **PostgreSQL: Insert Record**
   ```sql
   -- If RLS passes, insert succeeds
   INSERT INTO project_members (project_id, user_id, role_id, created_by)
   VALUES ('project-id', 'new-user-id', 'developer-role-id', auth.uid());

   -- If RLS fails, insert raises permission error
   ```

6. **Audit Log: Record Event**
   ```sql
   INSERT INTO audit_logs (
     event_type,
     user_id,
     project_id,
     target_user_id,
     metadata
   ) VALUES (
     'member_invited',
     auth.uid(),
     'project-id',
     'new-user-id',
     jsonb_build_object('role', 'Developer')
   );
   ```

7. **Notification: Send Email**
   - Trigger email to new user
   - Include project invitation link

---

### Flow 3: Permission Denial (User Lacks Access)

**Trigger:** Developer tries to delete a secret (requires Admin)

**Steps:**

1. **Frontend: Submit Delete Request**
   ```typescript
   // UI should hide delete button, but user might manipulate request
   await fetch('/api/secrets/secret-id', {
     method: 'DELETE',
     headers: { 'Authorization': `Bearer ${jwtToken}` }
   });
   ```

2. **Supabase RLS: Evaluate Permission**
   ```sql
   CREATE POLICY "Only Admins can delete secrets"
   ON secrets
   FOR DELETE
   TO authenticated
   USING (
     user_has_project_permission(
       auth.uid(),
       project_id,
       'can_delete_secrets'
     ) = TRUE
   );

   -- User has "Developer" role, which doesn't include can_delete_secrets
   -- RLS policy fails
   ```

3. **PostgreSQL: Reject Query**
   - Query attempts to delete
   - RLS policy returns false
   - No rows affected (or explicit permission error)

4. **API: Return Error**
   ```json
   {
     "error": "permission_denied",
     "message": "You don't have permission to delete secrets",
     "required_permission": "can_delete_secrets",
     "your_role": "Developer"
   }
   ```

5. **Audit Log: Record Attempt**
   ```sql
   INSERT INTO audit_logs (
     event_type,
     user_id,
     project_id,
     secret_id,
     metadata
   ) VALUES (
     'permission_denied',
     auth.uid(),
     'project-id',
     'secret-id',
     jsonb_build_object(
       'attempted_action', 'delete_secret',
       'required_permission', 'can_delete_secrets'
     )
   );
   ```

6. **Frontend: Show Error**
   ```typescript
   if (response.status === 403) {
     showError("You need Admin role to delete secrets");
   }
   ```

---

## API Contracts

### Internal APIs

**API: Check User Permission**

**Purpose:** Determine if user has specific permission in project

**Endpoint:** `GET /api/projects/:projectId/permissions/check`

**Request:**
```typescript
interface PermissionCheckRequest {
  permission: Permission; // e.g., "can_decrypt_secrets"
}
```

**Response:**
```typescript
interface PermissionCheckResponse {
  has_permission: boolean;
  effective_role: string;     // "Admin", "Developer", etc.
  role_source: string;        // "organization" | "project" | "none"
}
```

**Example:**
```bash
GET /api/projects/proj-123/permissions/check?permission=can_delete_secrets

Response:
{
  "has_permission": false,
  "effective_role": "Developer",
  "role_source": "project"
}
```

**Error Handling:**
- `401 Unauthorized` - No valid JWT token
- `404 Not Found` - Project doesn't exist
- `400 Bad Request` - Invalid permission name

---

**API: Get User's Effective Role**

**Purpose:** Get user's role in a specific project (for UI rendering)

**Endpoint:** `GET /api/projects/:projectId/my-role`

**Response:**
```typescript
interface UserRoleResponse {
  role: string;              // "Owner" | "Admin" | "Developer" | "Read-Only"
  permissions: Permission[]; // List of all permissions
  level: number;             // 4 = Owner, 3 = Admin, 2 = Developer, 1 = Read-Only
  source: string;            // "organization" | "project"
}
```

**Example:**
```bash
GET /api/projects/proj-123/my-role

Response:
{
  "role": "Developer",
  "permissions": [
    "can_read_secrets",
    "can_decrypt_secrets",
    "can_create_secrets",
    "can_update_secrets",
    "can_delete_secrets"
  ],
  "level": 2,
  "source": "project"
}
```

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Client ↔ API Gateway (Workers)**
- **Threats:** Manipulated requests, missing JWT, expired tokens
- **Controls:**
  - JWT signature verification
  - Token expiration check
  - Rate limiting per user
  - HTTPS only (TLS 1.3)

**Boundary 2: API Gateway ↔ Database**
- **Threats:** SQL injection, unauthorized queries, privilege escalation
- **Controls:**
  - Parameterized queries (Supabase client)
  - Row-Level Security (RLS) policies
  - Service role key (server-only)
  - Audit logging

**Boundary 3: Frontend UI ↔ User**
- **Threats:** Social engineering, confused deputy, privilege escalation via UI manipulation
- **Controls:**
  - Hide unavailable actions (not security boundary)
  - Clear permission error messages
  - Audit log of all attempts

### Authentication & Authorization

**Authentication:**
- Method: JWT tokens (from Supabase Auth)
- Token contains: user_id, email, org_id, role (organization-level role)
- Validated by: Cloudflare Workers + Supabase RLS

**Authorization:**
- Model: RBAC (Role-Based Access Control)
- Enforcement points:
  1. **Frontend (UX only):** Hide buttons user can't use
  2. **API Gateway (Workers):** Early validation and error messages
  3. **Database (RLS):** Primary security boundary
- Permission evaluation: PostgreSQL functions called by RLS policies

### Data Security

**Data at Rest:**
- Secrets: Encrypted with AES-256-GCM (client-side)
- Permission data: Not encrypted (not sensitive)
- Audit logs: Not encrypted (needed for compliance)

**Data in Transit:**
- TLS 1.3 for all HTTP traffic
- JWT tokens in Authorization header

**Audit Logging:**
- All permission checks logged
- All access attempts logged (success and failure)
- Logs retained for 90 days (configurable)

### Threat Model

**Threat 1: Privilege Escalation**
- **Description:** User manipulates request to gain higher privileges
- **Likelihood:** Medium (users might try to bypass UI)
- **Impact:** High (unauthorized access to secrets)
- **Mitigation:**
  - RLS policies enforce permissions at database level
  - Cannot be bypassed by manipulated API requests
  - Audit logs detect unusual access patterns

**Threat 2: Confused Deputy**
- **Description:** Admin unintentionally gives wrong permissions
- **Likelihood:** Medium (human error)
- **Impact:** Medium (secrets exposed to wrong person)
- **Mitigation:**
  - Confirmation prompts for sensitive actions
  - Audit logs track who granted what permissions
  - UI shows clear role descriptions
  - "Review access" feature to audit permissions

**Threat 3: Compromised Admin Account**
- **Description:** Attacker gains access to Admin account
- **Likelihood:** Low (MFA, strong passwords)
- **Impact:** High (can access most secrets)
- **Mitigation:**
  - Enforce MFA for Admin and Owner roles
  - Audit logs detect unusual activity
  - IP-based anomaly detection (future)
  - Time-limited access grants for sensitive operations

**Threat 4: SQL Injection in RLS Policies**
- **Description:** Malicious input exploits SQL vulnerability in RLS policy
- **Likelihood:** Low (parameterized queries, static RLS policies)
- **Impact:** Critical (database compromise)
- **Mitigation:**
  - RLS policies use parameterized functions
  - No dynamic SQL in policies
  - Regular security audits
  - Prepared statements in all queries

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Permission check (database function): < 20ms p95
- RLS policy evaluation: < 30ms p95
- Role lookup (cached): < 5ms p95
- Complete API request with permission check: < 100ms p95

**Throughput:**
- Permission checks: 10,000 requests/second (per project)
- Concurrent users checking permissions: 1,000+

**Resource Usage:**
- Memory: < 10MB for permission evaluation logic
- Database queries: 1-3 queries per permission check (with caching)
- CPU: Minimal (simple role comparison)

### Performance Optimization

**Optimizations implemented:**
- **Role caching:** Cache user's effective role in Workers KV (5-minute TTL)
- **Permission materialization:** Store flattened permission list with role (avoid joins)
- **Index optimization:** Indexes on `org_members(user_id, org_id)` and `project_members(user_id, project_id)`
- **RLS function optimization:** Use SECURITY DEFINER to run as privileged user (avoid nested permission checks)

**Caching Strategy:**
- **What is cached:**
  - User's effective role per project: Workers KV, 5-minute TTL
  - Role → permissions mapping: In-memory (static data)
- **Cache invalidation:**
  - Role change: Invalidate user's cached role immediately
  - Permission change: Invalidate all cached roles (rare event)

**Database Optimization:**
- **Indexes:**
  ```sql
  CREATE INDEX idx_org_members_user_org ON org_members(user_id, organization_id);
  CREATE INDEX idx_project_members_user_proj ON project_members(user_id, project_id);
  CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
  ```
- **Query optimization:**
  - Use helper functions (`get_user_project_role`) to avoid repeated logic
  - Materialize role permissions in application layer

---

## Scalability

### Horizontal Scaling

**Components that scale horizontally:**
- Cloudflare Workers: Automatically scale (stateless)
- Supabase PostgreSQL: Connection pooling via PgBouncer
- Frontend: Static site on CDN

**Load balancing:**
- Cloudflare automatically routes to nearest edge location
- Database connections pooled by Supabase

### Vertical Scaling

**Components that scale vertically:**
- PostgreSQL: Increase instance size if needed (not expected for MVP)

### Bottlenecks

**Current bottlenecks:**
- **Database connections:** Limited by Supabase plan (mitigated by PgBouncer)
- **RLS policy complexity:** Each query evaluates permissions (optimized with helper functions)

**Mitigation strategies:**
- Cache role lookups in Workers KV
- Use database functions to minimize round trips
- Connection pooling handles concurrent users

### Capacity Planning

**Current capacity:**
- Free tier: 500 concurrent connections
- Pro tier: 1,500 concurrent connections

**Growth projections:**
- MVP: < 100 concurrent users (well within limits)
- Year 1: < 1,000 concurrent users

---

## Failure Modes

### Failure Mode 1: RLS Policy Bug (User Gets Unauthorized Access)

**Scenario:** RLS policy has logic error, allows unauthorized access

**Impact:** Critical - users can access secrets they shouldn't

**Detection:** Automated tests for every RLS policy, audit log anomaly detection

**Recovery:**
1. Immediately patch RLS policy
2. Deploy fix (no downtime, policy update is instant)
3. Review audit logs to identify unauthorized access
4. Notify affected users

**Prevention:**
- Comprehensive RLS policy tests
- Security audits before launch
- Penetration testing
- Automated policy verification in CI/CD

---

### Failure Mode 2: Permission Check Fails (User Denied Valid Access)

**Scenario:** Permission check incorrectly denies access (false negative)

**Impact:** Medium - user frustrated, cannot perform legitimate action

**Detection:** User reports issue, higher-than-normal permission denied rate

**Recovery:**
1. Debug permission evaluation logic
2. Check if user's role assignment is correct
3. Verify RLS policy logic
4. Fix if bug found, or correct user's role

**Prevention:**
- Clear error messages with debugging info
- Admin dashboard shows user's effective permissions
- Logs track all permission denials for analysis

---

### Failure Mode 3: Role Assignment Error (Wrong Role Given)

**Scenario:** Admin assigns wrong role (e.g., gives Developer role to contractor who should be Read-Only)

**Impact:** Low to Medium - user has too much access, but audit logs track actions

**Detection:** Audit log review, periodic access review

**Recovery:**
1. Change user's role to correct value
2. Review audit logs for actions taken with incorrect permissions
3. Notify security team if sensitive data accessed

**Prevention:**
- Confirmation prompt before assigning roles
- "Review access" dashboard for admins
- Audit logs track who assigned what roles
- Automated alerts for unusual role changes

---

### Failure Mode 4: Database Unavailable (Cannot Check Permissions)

**Scenario:** Supabase database is down

**Impact:** High - all API requests fail (cannot validate permissions)

**Detection:** Health checks fail, 5xx errors

**Recovery:**
1. Wait for Supabase to recover (99.9% uptime SLA)
2. Display "Service temporarily unavailable" message
3. Cached permissions in Workers KV allow read-only access (if cache is fresh)

**Prevention:**
- Cache permissions in Workers KV (5-minute TTL)
- Fail closed (deny access if cannot verify permissions)
- Monitor Supabase status page

---

## Alternatives Considered

### Alternative 1: Attribute-Based Access Control (ABAC)

**Description:** Instead of roles, use attributes (user attributes, resource attributes, context attributes) to determine access.

**Pros:**
- More flexible than RBAC
- Can express complex rules (e.g., "allow access if user's department matches resource's department")
- Better for very large organizations

**Cons:**
- Much more complex to implement
- Harder for users to understand ("Why can't I access this?")
- Overkill for MVP
- Performance overhead (evaluate attributes on every request)

**Why not chosen:** RBAC is simpler, more understandable, and sufficient for our use cases. ABAC is enterprise-only complexity.

---

### Alternative 2: Access Control Lists (ACLs)

**Description:** Instead of roles, assign permissions directly to users for each resource.

**Pros:**
- Very granular (each user can have different permissions on each secret)
- No need for role abstraction

**Cons:**
- Hard to manage at scale (admin must assign permissions to each user for each secret)
- No role abstraction (can't say "all Developers can do X")
- Complex to audit ("who has access to this secret?")

**Why not chosen:** Doesn't scale for teams. Roles provide a much better abstraction for team management.

---

### Alternative 3: No Permissions (All Authenticated Users Have Access)

**Description:** Trust all authenticated users, no permission checks.

**Pros:**
- Simplest possible implementation
- No performance overhead
- No user confusion

**Cons:**
- Completely insecure for teams
- Cannot share projects with restricted access
- Any team member can delete everything

**Why not chosen:** Security requirement. Teams need role-based access control.

---

## Decision Log

### Decision 1: RBAC with 4 Fixed Roles (Owner, Admin, Developer, Read-Only)

**Date:** 2025-10-29

**Context:** Need permission model that scales from solo users to enterprise teams.

**Options:**
1. RBAC with fixed roles (chosen)
2. ABAC (attribute-based)
3. Custom role definitions (per-organization)

**Decision:** RBAC with 4 fixed roles for MVP

**Rationale:**
- Simple enough for solo users and small teams
- Powerful enough for most organizations
- Easy to understand ("I'm a Developer, I can create secrets")
- Good performance (role lookup is fast)
- Can add custom roles post-MVP if needed

**Consequences:**
- Cannot define custom roles in MVP
- Some organizations might want "Junior Developer" or "Contractor" roles
- Can work around with project-specific role assignments
- Post-MVP: Add custom role builder

---

### Decision 2: Permission Inheritance (Org Role → Project Role)

**Date:** 2025-10-29

**Context:** Should organization-level roles grant access to all projects, or require explicit project assignment?

**Options:**
1. Inheritance (org role grants baseline, project role overrides) - chosen
2. Explicit only (must assign users to each project)
3. No organization concept (project-only permissions)

**Decision:** Org role grants baseline, project role can override

**Rationale:**
- Simplifies onboarding (add user to org once, they get baseline access to all projects)
- Admins can restrict specific projects (override with lower project role)
- Matches mental model ("I'm an Admin in this company, so I can access all projects unless restricted")
- Reduces permission management overhead

**Consequences:**
- Need evaluation logic: `MAX(org_role_level, project_role_level)`
- Project role can grant more access than org role (intentional for flexibility)
- Must document clearly to avoid confusion

---

### Decision 3: RLS as Primary Security Boundary

**Date:** 2025-10-29

**Context:** Where should permissions be enforced? Frontend? API Gateway? Database?

**Options:**
1. Frontend only (trusts user, just UX)
2. API Gateway only (Workers validate before database)
3. Database RLS only (database enforces all permissions)
4. Layered approach (all three) - chosen

**Decision:** Layered enforcement with RLS as security boundary

**Rationale:**
- **Frontend:** Hide UI elements (UX, not security)
- **Workers:** Early validation, helpful error messages
- **Database RLS:** Primary security boundary (cannot be bypassed)
- Defense in depth: multiple layers

**Consequences:**
- More complex implementation (3 layers)
- Best security posture
- RLS policies must be comprehensive (cannot miss edge cases)

---

### Decision 4: Granular Permissions (can_read_secrets vs. can_decrypt_secrets)

**Date:** 2025-10-29

**Context:** Should "read" permission allow decryption, or separate permissions?

**Options:**
1. Single "read" permission (grants both viewing and decryption)
2. Separate "read" and "decrypt" permissions (chosen)
3. Read + decrypt + view_metadata (3 levels)

**Decision:** Separate `can_read_secrets` and `can_decrypt_secrets`

**Rationale:**
- Read-Only role can see secret names/metadata but not decrypt values
- Useful for auditors, finance team (see what exists, not actual keys)
- Aligns with zero-knowledge model (server sees metadata, not values)
- Future-proof for approval workflows (approve before decrypt)

**Consequences:**
- Slightly more complex permission model
- Need to explain difference to users
- UI must handle "you can see this exists but not the value"

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `03-security/auth/authentication-flow.md` - User authentication and JWT tokens
- [ ] `04-database/schemas/users-orgs.md` - User, org, project tables
- [ ] `GLOSSARY.md` - Permission and role terminology
- [ ] `TECH-STACK.md` - PostgreSQL RLS, Supabase, Cloudflare Workers

**External Services:**
- Supabase PostgreSQL - RLS policy enforcement
- Cloudflare Workers - JWT verification, permission caching

### Architecture Dependencies

**Depends on:**
- Authentication flow (JWT tokens)
- Database schema (users, orgs, projects, secrets)

**Required by:**
- All API endpoints (every endpoint checks permissions)
- Frontend UI (show/hide based on permissions)
- Audit logging (track permission checks)

---

## References

### Internal Documentation
- `03-security/auth/authentication-flow.md` - Authentication and JWT
- `03-security/rbac/role-definitions.md` - Role details and assignment (to be created)
- `03-security/rbac/rls-policies.md` - RLS policy implementations (to be created)
- `04-database/schemas/users-orgs.md` - Database schema (to be created)
- `TECH-STACK.md` - Technology stack
- `GLOSSARY.md` - Terminology

### External Resources
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS documentation
- [Supabase Auth & RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns
- [NIST RBAC Standard](https://csrc.nist.gov/projects/role-based-access-control) - RBAC best practices
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) - Security guidelines

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Documentation Agent | Initial permissions model architecture |

---

## Notes

### Future Enhancements
- **Custom role definitions** - Organizations define their own roles (e.g., "Contractor", "Junior Dev")
- **Temporary access grants** - Time-limited permissions (e.g., "access for 24 hours")
- **Approval workflows** - Require approval before accessing production secrets
- **Permission templates** - Pre-configured permission sets for common scenarios
- **Delegation** - Allow Admins to delegate specific permissions without full role change
- **Group-based permissions** - Assign permissions to groups, not just individuals

### Known Issues
- **Role hierarchy inflexibility** - Cannot have "sideways" roles (different permissions at same level)
- **Project-specific overrides can be confusing** - Need clear UI to show effective role
- **RLS policy debugging is hard** - Need better tooling to test and debug policies

### Next Review Date
2025-11-29 (review after implementation and security testing)
