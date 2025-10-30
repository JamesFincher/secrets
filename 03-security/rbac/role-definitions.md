---
Document: Role Definitions - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/rbac/permissions-model.md, GLOSSARY.md, TECH-STACK.md
---

# Role Definitions Architecture

## Overview

This document defines the four user roles in Abyrith's role-based access control (RBAC) system: Owner, Admin, Developer, and Read-Only. Each role represents a collection of permissions that determine what users can do within organizations and projects. Roles are designed to follow the principle of least privilege while remaining intuitive enough for beginners to understand.

**Purpose:** Clearly define what each role can and cannot do, establish role hierarchy, document role assignment rules, and specify how roles map to granular permissions defined in the permissions model.

**Scope:** Role definitions, permission mappings, role hierarchy, assignment rules, role changes, default roles for new members, and future custom role architecture for enterprise.

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
Abyrith needs a permission system that works for both individual users (who don't want to think about permissions) and enterprise teams (who need granular control). The system must be simple enough for beginners to understand ("What does 'Admin' mean?") yet powerful enough for compliance requirements.

**Pain points:**
- Users don't understand complex permission matrices
- Too many roles create confusion and management overhead
- Too few roles lack flexibility for different team structures
- Role names must be self-explanatory (not "L3 Access" or "Contributor")
- Must support both organization-level and project-level role assignments

**Why now?**
Role definitions are foundational. Every team collaboration feature depends on clear role boundaries. We must define these before implementing team features.

### Background

**Existing system:**
This is a greenfield implementation. No existing role system.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Product Lead | User comprehension | Roles must be immediately understandable, not require documentation |
| Backend Engineer | Implementation simplicity | Clear mapping to permissions, easy to enforce in code |
| Security Lead | Least privilege | No over-permissioned roles, clear audit trail |
| Solo Users | Invisible complexity | Don't want to assign roles, just want it to work |
| Team Admins | Flexibility | Need right role for each team member (not too many, not too few) |
| Enterprise Security | Compliance | Roles must support audit requirements and approval workflows |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Intuitive role names** - Anyone can understand what "Owner", "Admin", "Developer", "Read-Only" mean (success metric: 95% of users correctly predict what each role can do)
2. **Four roles cover 95% of use cases** - Minimize need for custom roles in MVP (success metric: <5% of teams request custom roles)
3. **Clear role hierarchy** - Owner > Admin > Developer > Read-Only is obvious (success metric: Zero confusion about "which role is higher")
4. **Principle of least privilege** - Each role has minimum necessary permissions (success metric: Pass security audit without over-permissioned roles)

**Secondary goals:**
- Support role assignment at both organization and project levels
- Enable role changes without data loss or security issues
- Document exactly what each role can and cannot do

### Non-Goals

**Explicitly out of scope:**
- **Custom role definitions** - MVP has 4 fixed roles, custom roles are post-MVP
- **Attribute-based permissions** - No context-specific permissions (e.g., "only on weekdays")
- **Time-based role changes** - No automatic role expiration in MVP
- **Per-environment roles** - Roles apply to entire project, not just production/dev

### Success Metrics

**How we measure success:**
- **Comprehension**: 95% of users correctly predict role capabilities without reading docs
- **Sufficiency**: <5% of teams request custom roles in first 6 months
- **Security**: Zero privilege escalation bugs
- **Usability**: <1 support ticket per 100 role assignments

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│             Role Definitions                    │
│  (TypeScript + Database + RLS Enforcement)      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │   4 Standard Roles  │
         │                     │
         │  ┌──────────────┐  │
         │  │   Owner      │  │ Level 4: All permissions
         │  └──────┬───────┘  │
         │         │           │
         │  ┌──────▼───────┐  │
         │  │   Admin      │  │ Level 3: All except delete org/project
         │  └──────┬───────┘  │
         │         │           │
         │  ┌──────▼───────┐  │
         │  │  Developer   │  │ Level 2: Read/write secrets, no team mgmt
         │  └──────┬───────┘  │
         │         │           │
         │  ┌──────▼───────┐  │
         │  │  Read-Only   │  │ Level 1: View metadata only
         │  └──────────────┘  │
         └─────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │      Permission Mappings             │
    │  (Each role → set of permissions)    │
    └──────────────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │    Role Assignment (2 Levels)        │
    │                                      │
    │  Organization Level                  │
    │  ├─ org_members table               │
    │  └─ Grants baseline access          │
    │                                      │
    │  Project Level                       │
    │  ├─ project_members table           │
    │  └─ Can override org role           │
    └──────────────────────────────────────┘
```

### Key Components

**Component 1: Role Definitions**
- **Purpose:** Define the 4 standard roles
- **Technology:** TypeScript enums + PostgreSQL roles table
- **Responsibilities:**
  - Store role metadata (name, level, description)
  - Provide TypeScript types for frontend and backend
  - Validate role names in database constraints

**Component 2: Role-Permission Mappings**
- **Purpose:** Map each role to its permission set
- **Technology:** PostgreSQL role_permissions table
- **Responsibilities:**
  - Store which permissions each role grants
  - Support efficient permission lookups
  - Enable role hierarchy queries

**Component 3: Role Assignment Logic**
- **Purpose:** Assign roles to users at org and project levels
- **Technology:** PostgreSQL functions + Supabase RLS
- **Responsibilities:**
  - Store user role assignments in org_members and project_members
  - Evaluate effective role (max of org and project role)
  - Enforce who can assign roles (Admins can assign, Developers cannot)

**Component 4: Role Change Workflow**
- **Purpose:** Handle role changes safely
- **Technology:** PostgreSQL triggers + audit logging
- **Responsibilities:**
  - Validate role changes (can't demote yourself if you're the last Owner)
  - Log all role changes for audit trail
  - Notify users when their role changes

---

## Component Details

### Component: Role Definitions

**Purpose:** Define the 4 standard roles with their capabilities.

**Role 1: Owner**

**Level:** 4 (highest)

**Description:** Full control over the organization or project. Can do everything, including deleting the organization/project and managing billing. Typically the person who created the organization or project.

**Capabilities:**
- ✅ All Admin permissions (see below)
- ✅ Delete organization
- ✅ Delete projects
- ✅ Transfer ownership to another user
- ✅ Manage billing and subscription (organization-level)
- ✅ View all audit logs (including sensitive events)
- ✅ Configure organization-wide settings (MFA enforcement, session timeouts)

**Restrictions:**
- ❌ Cannot demote self if last Owner (safety mechanism)

**Use Case:**
- Founder/CEO of startup
- Lead engineer who sets up the platform
- Individual user managing their own projects

**Typical Count:** 1-2 per organization, 1-2 per project

---

**Role 2: Admin**

**Level:** 3

**Description:** Can manage team members and all secrets, but cannot delete the organization or projects. Ideal for trusted team leads who need full operational control without the ability to cause catastrophic damage.

**Capabilities:**
- ✅ All Developer permissions (see below)
- ✅ Invite and remove team members (org or project)
- ✅ Change member roles (except: cannot make someone Owner, cannot demote Owners)
- ✅ Create and delete projects (at organization level)
- ✅ Update organization/project settings
- ✅ View all audit logs
- ✅ Create and delete environments

**Restrictions:**
- ❌ Cannot delete organization
- ❌ Cannot delete projects
- ❌ Cannot assign Owner role
- ❌ Cannot demote or remove Owners
- ❌ Cannot manage billing (organization-level)

**Use Case:**
- Team leads who manage developers
- Senior engineers trusted with team management
- Operations team managing infrastructure secrets

**Typical Count:** 2-5 per organization, 1-3 per project

---

**Role 3: Developer**

**Level:** 2

**Description:** Full access to secrets (read, write, delete) but cannot manage team members or settings. This is the default role for most engineering team members.

**Capabilities:**
- ✅ All Read-Only permissions (see below)
- ✅ Decrypt secret values (actually read the API keys)
- ✅ Create new secrets
- ✅ Update existing secrets
- ✅ Delete secrets (in projects where assigned)
- ✅ Create environments
- ✅ Update environments
- ✅ Delete environments
- ✅ View audit logs for their own actions

**Restrictions:**
- ❌ Cannot invite or remove team members
- ❌ Cannot change member roles
- ❌ Cannot update project/organization settings
- ❌ Cannot delete projects
- ❌ Cannot view other users' audit logs
- ❌ Cannot assign roles

**Use Case:**
- Software engineers building features
- DevOps engineers managing deployments
- Contractors working on specific projects

**Typical Count:** 3-50 per project (most team members)

---

**Role 4: Read-Only**

**Level:** 1 (lowest)

**Description:** Can view secret names and metadata but cannot decrypt secret values or modify anything. Ideal for auditors, finance team, or stakeholders who need visibility without access to sensitive values.

**Capabilities:**
- ✅ View list of secrets (names, tags, last modified date)
- ✅ View secret metadata (when created, who created it, environment)
- ✅ View list of projects and environments
- ✅ View team members and their roles
- ✅ View audit logs (read-only)

**Restrictions:**
- ❌ Cannot decrypt secret values (cannot see actual API keys)
- ❌ Cannot create, update, or delete secrets
- ❌ Cannot create, update, or delete environments
- ❌ Cannot invite or manage team members
- ❌ Cannot change settings
- ❌ Cannot perform any write operations

**Use Case:**
- Finance team tracking API costs
- Security auditors reviewing access
- Stakeholders who need visibility into what exists
- Junior team members in onboarding period

**Typical Count:** 1-5 per project (special cases)

---

### Role Hierarchy

```
Owner (Level 4)
  │
  ├─ Can do everything
  ├─ Inherits all lower role permissions
  └─ + delete org/project, manage billing

Admin (Level 3)
  │
  ├─ Can do everything except delete org/project
  ├─ Inherits all Developer permissions
  └─ + manage team members, create/delete projects

Developer (Level 2)
  │
  ├─ Can do all secret operations
  ├─ Inherits all Read-Only permissions
  └─ + decrypt secrets, create/update/delete secrets

Read-Only (Level 1)
  │
  └─ View metadata only, cannot decrypt or modify
```

**Hierarchy Rules:**
- Higher roles inherit all permissions of lower roles
- Role level is used for comparison (Owner = 4 > Admin = 3)
- When evaluating effective role, take MAX(org_role_level, project_role_level)

---

### Permission Mappings

**Owner Permissions (All permissions available in system):**

**Organization-Level:**
```typescript
[
  'can_invite_members',
  'can_remove_members',
  'can_change_member_roles',
  'can_create_projects',
  'can_delete_projects',
  'can_update_org_settings',
  'can_view_org_audit_logs',
  'can_delete_organization',     // Only Owner
  'can_manage_billing',           // Only Owner
  'can_view_billing'              // Only Owner
]
```

**Project-Level:**
```typescript
[
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
  'can_delete_project'            // Only Owner
]
```

---

**Admin Permissions (All except delete and billing):**

**Organization-Level:**
```typescript
[
  'can_invite_members',
  'can_remove_members',
  'can_change_member_roles',       // Except: Cannot assign Owner role
  'can_create_projects',
  'can_update_org_settings',
  'can_view_org_audit_logs'
  // Excluded: can_delete_organization, can_delete_projects, can_manage_billing
]
```

**Project-Level:**
```typescript
[
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
  'can_change_project_member_roles',  // Except: Cannot assign Owner role
  'can_update_project_settings',
  'can_view_project_audit_logs'
  // Excluded: can_delete_project
]
```

---

**Developer Permissions (Full secret access, no team management):**

**Organization-Level:**
```typescript
[
  // Developers do not have organization-level permissions by default
  // They must be assigned to specific projects
]
```

**Project-Level:**
```typescript
[
  'can_read_secrets',
  'can_decrypt_secrets',
  'can_create_secrets',
  'can_update_secrets',
  'can_delete_secrets',
  'can_create_environments',
  'can_update_environments',
  'can_delete_environments',
  'can_view_project_audit_logs'    // Only their own actions
  // Excluded: All team management permissions
]
```

---

**Read-Only Permissions (View metadata only):**

**Organization-Level:**
```typescript
[
  'can_view_org_audit_logs'        // Read-only view
]
```

**Project-Level:**
```typescript
[
  'can_read_secrets',              // View names and metadata only
  'can_view_project_audit_logs'    // Read-only view
  // Excluded: can_decrypt_secrets and all write permissions
]
```

**Important Distinction for Read-Only:**
- `can_read_secrets` = View secret exists, see name, tags, metadata
- `can_decrypt_secrets` = Actually decrypt and view secret value
- Read-Only has the first, NOT the second

---

### Database Schema

**Roles Table:**
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  level INTEGER NOT NULL,
  description TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure only valid standard roles
  CONSTRAINT valid_standard_role CHECK (
    (is_custom = FALSE AND name IN ('Owner', 'Admin', 'Developer', 'Read-Only'))
    OR is_custom = TRUE
  ),

  -- Level must match role (for standard roles)
  CONSTRAINT valid_role_level CHECK (
    (name = 'Owner' AND level = 4) OR
    (name = 'Admin' AND level = 3) OR
    (name = 'Developer' AND level = 2) OR
    (name = 'Read-Only' AND level = 1) OR
    is_custom = TRUE
  )
);

-- Seed standard roles
INSERT INTO roles (name, level, description, is_custom) VALUES
  ('Owner', 4, 'Full control over organization and all projects, including ability to delete and manage billing', FALSE),
  ('Admin', 3, 'Manage team members and all secrets, but cannot delete organization or projects', FALSE),
  ('Developer', 2, 'Full access to secrets and environments, cannot manage team members', FALSE),
  ('Read-Only', 1, 'View secret names and metadata only, cannot decrypt values or modify anything', FALSE);
```

**Role-Permission Mappings Table:**
```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
```

**Organization Members Table (Role Assignments):**
```sql
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON org_members(organization_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_role ON org_members(role_id);
```

**Project Members Table (Project-Specific Role Overrides):**
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role_id);
```

---

## Data Flow

### Flow 1: User Gets Assigned a Role

**Trigger:** Admin invites user to organization with "Developer" role

**Steps:**

1. **Frontend: Admin Submits Invitation**
   ```typescript
   // Admin clicks "Invite Member" button
   const inviteForm = {
     email: 'newuser@example.com',
     role: 'Developer'  // Selected from dropdown
   };

   await inviteOrgMember(organizationId, inviteForm);
   ```

2. **API: Validate Inviter Permission**
   ```typescript
   // Cloudflare Worker or Supabase function
   const inviter = getUserFromJWT(request);
   const canInvite = await userHasPermission(
     inviter.id,
     organizationId,
     'can_invite_members'
   );

   if (!canInvite) {
     return error(403, 'You cannot invite members');
   }
   ```

3. **Database: Lookup Role ID**
   ```sql
   SELECT id FROM roles WHERE name = 'Developer' AND is_custom = FALSE;
   -- Returns: role_id for Developer role
   ```

4. **Database: Insert Organization Member**
   ```sql
   INSERT INTO org_members (
     organization_id,
     user_id,
     role_id,
     invited_by
   ) VALUES (
     'org-uuid',
     'new-user-uuid',
     'developer-role-uuid',
     'inviter-uuid'
   );
   ```

5. **Audit Log: Record Event**
   ```sql
   INSERT INTO audit_logs (
     event_type,
     user_id,
     organization_id,
     target_user_id,
     metadata
   ) VALUES (
     'member_invited',
     'inviter-uuid',
     'org-uuid',
     'new-user-uuid',
     jsonb_build_object(
       'role', 'Developer',
       'email', 'newuser@example.com'
     )
   );
   ```

6. **Notification: Email User**
   - Send invitation email
   - Include link to accept invitation
   - Explain what "Developer" role means

7. **User Accepts Invitation**
   - User clicks link, logs in/signs up
   - `accepted_at` timestamp set
   - User now has Developer permissions in organization

**Sequence Diagram:**
```
Admin    Frontend   API      Database   Email
  |         |         |          |         |
  |--click->|         |          |         |
  | "Invite"|         |          |         |
  |         |         |          |         |
  |         |--POST-->|          |         |
  |         | invite  |          |         |
  |         |         |--check-->|         |
  |         |         | perms    |         |
  |         |         |<--allow--|         |
  |         |         |          |         |
  |         |         |--INSERT->|         |
  |         |         | member   |         |
  |         |         |<--ok-----|         |
  |         |         |          |         |
  |         |         |--log---->|         |
  |         |         | audit    |         |
  |         |         |          |         |
  |         |         |----------send----->|
  |         |         | invitation         |
  |         |<--200---|          |         |
  |<-success|         |          |         |
```

---

### Flow 2: User's Effective Role is Evaluated

**Trigger:** User attempts to decrypt a secret

**Steps:**

1. **Frontend: User Clicks "Decrypt"**
   ```typescript
   const canDecrypt = useCanPerform('can_decrypt_secrets');

   if (!canDecrypt) {
     showError("You don't have permission to decrypt secrets");
     return;
   }

   // Make API request
   await fetchSecret(secretId);
   ```

2. **API: Extract User ID from JWT**
   ```typescript
   const userId = extractUserIdFromJWT(request);
   const secretId = request.params.secretId;
   ```

3. **Database: Get Secret's Project**
   ```sql
   SELECT project_id
   FROM secrets
   WHERE id = 'secret-uuid';
   ```

4. **Database: Get User's Effective Role**
   ```sql
   -- Helper function: get_user_project_role
   SELECT get_user_project_role('user-uuid', 'project-uuid');

   -- This function:
   -- 1. Gets user's org role (if org member)
   -- 2. Gets user's project role (if project member)
   -- 3. Returns MAX(org_role_level, project_role_level)
   ```

5. **Database: Check Permission**
   ```sql
   -- Check if effective role has can_decrypt_secrets permission
   SELECT EXISTS (
     SELECT 1
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = get_user_project_role('user-uuid', 'project-uuid')
       AND p.name = 'can_decrypt_secrets'
   );
   ```

6. **RLS Policy Evaluation**
   ```sql
   -- RLS policy on secrets table
   CREATE POLICY "Users can decrypt secrets they have permission for"
   ON secrets
   FOR SELECT
   TO authenticated
   USING (
     user_has_project_permission(
       auth.uid(),
       project_id,
       'can_decrypt_secrets'
     ) = TRUE
   );

   -- If this returns FALSE, query returns 0 rows
   ```

7. **Response**
   - **If authorized:** Return encrypted secret (user decrypts client-side)
   - **If not authorized:** Return 403 Forbidden

**Example Scenarios:**

**Scenario A: User is Admin at Org Level**
```
User: Admin in organization
Project: Belongs to that organization
User has NO project-specific role assignment
Effective Role: Admin (from org)
Can decrypt: YES (Admin has can_decrypt_secrets)
```

**Scenario B: User is Developer at Org Level, Read-Only at Project Level**
```
User: Developer in organization (level 2)
Project: Belongs to that organization
User: Assigned Read-Only in this specific project (level 1)
Effective Role: Developer (MAX(2, 1) = 2, org role wins)
Can decrypt: YES (Developer has can_decrypt_secrets)
```

**Scenario C: User is Developer at Org Level, Admin at Project Level**
```
User: Developer in organization (level 2)
Project: Belongs to that organization
User: Assigned Admin in this specific project (level 3)
Effective Role: Admin (MAX(2, 3) = 3, project role wins)
Can decrypt: YES (Admin has can_decrypt_secrets)
```

**Scenario D: User is Read-Only at Project Level Only**
```
User: NOT a member of organization
Project: Invited directly to project with Read-Only role
Effective Role: Read-Only (level 1)
Can decrypt: NO (Read-Only does NOT have can_decrypt_secrets)
```

---

### Flow 3: Admin Changes User's Role

**Trigger:** Admin changes user from Developer to Read-Only

**Steps:**

1. **Frontend: Admin Selects New Role**
   ```typescript
   // In team members list, Admin clicks role dropdown
   await changeMemberRole(userId, projectId, 'Read-Only');
   ```

2. **API: Validate Permission**
   ```typescript
   const adminUserId = getUserFromJWT(request);
   const canChangeRoles = await userHasPermission(
     adminUserId,
     projectId,
     'can_change_project_member_roles'
   );

   if (!canChangeRoles) {
     return error(403, 'You cannot change member roles');
   }
   ```

3. **Validation: Check Safety Rules**
   ```typescript
   // Rule 1: Cannot demote yourself if you're the last Owner
   if (targetUserId === adminUserId) {
     const ownerCount = await countOwnersInProject(projectId);
     if (ownerCount === 1 && currentRole === 'Owner') {
       return error(400, 'Cannot demote yourself as the last Owner');
     }
   }

   // Rule 2: Admin cannot assign Owner role (only Owner can)
   if (newRole === 'Owner' && adminRole !== 'Owner') {
     return error(403, 'Only Owners can assign the Owner role');
   }
   ```

4. **Database: Update Role**
   ```sql
   UPDATE project_members
   SET role_id = (SELECT id FROM roles WHERE name = 'Read-Only')
   WHERE project_id = 'project-uuid'
     AND user_id = 'target-user-uuid';
   ```

5. **Audit Log: Record Change**
   ```sql
   INSERT INTO audit_logs (
     event_type,
     user_id,
     project_id,
     target_user_id,
     metadata
   ) VALUES (
     'role_changed',
     'admin-user-uuid',
     'project-uuid',
     'target-user-uuid',
     jsonb_build_object(
       'old_role', 'Developer',
       'new_role', 'Read-Only'
     )
   );
   ```

6. **Cache Invalidation**
   ```typescript
   // Invalidate cached role in Cloudflare Workers KV
   await kv.delete(`user:${targetUserId}:project:${projectId}:role`);
   ```

7. **Notification: Inform User**
   - Email user: "Your role in ProjectName changed from Developer to Read-Only"
   - In-app notification (if user is online)

8. **Active Session Handling**
   - User's existing JWT is still valid
   - On next API request, new role is evaluated
   - Frontend refetches user's role and updates UI

---

## API Contracts

### Internal APIs

**API: Get User's Role in Project**

**Purpose:** Retrieve user's effective role for a specific project

**Endpoint:** `GET /api/projects/:projectId/members/:userId/role`

**Request:** None (userId and projectId from URL)

**Response:**
```typescript
interface UserRoleResponse {
  user_id: string;
  project_id: string;
  effective_role: {
    name: 'Owner' | 'Admin' | 'Developer' | 'Read-Only';
    level: number;
    source: 'organization' | 'project' | 'both';
  };
  org_role?: {
    name: string;
    level: number;
  };
  project_role?: {
    name: string;
    level: number;
  };
}
```

**Example:**
```json
{
  "user_id": "user-123",
  "project_id": "proj-456",
  "effective_role": {
    "name": "Admin",
    "level": 3,
    "source": "project"
  },
  "org_role": {
    "name": "Developer",
    "level": 2
  },
  "project_role": {
    "name": "Admin",
    "level": 3
  }
}
```

---

**API: Assign Role to User**

**Purpose:** Assign a role to a user in an organization or project

**Endpoint:** `POST /api/projects/:projectId/members`

**Request:**
```typescript
interface AssignRoleRequest {
  user_id: string;         // Or email if inviting new user
  role: 'Owner' | 'Admin' | 'Developer' | 'Read-Only';
}
```

**Example Request:**
```json
{
  "user_id": "user-789",
  "role": "Developer"
}
```

**Success Response (201 Created):**
```typescript
interface AssignRoleResponse {
  member: {
    id: string;
    user_id: string;
    project_id: string;
    role: string;
    invited_by: string;
    invited_at: string;
  };
}
```

**Error Responses:**
- `400 Bad Request` - Invalid role name
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - User doesn't have permission to assign roles
- `409 Conflict` - User is already a member

---

**API: Change User's Role**

**Purpose:** Change an existing member's role

**Endpoint:** `PATCH /api/projects/:projectId/members/:userId`

**Request:**
```typescript
interface ChangeRoleRequest {
  role: 'Owner' | 'Admin' | 'Developer' | 'Read-Only';
}
```

**Example Request:**
```json
{
  "role": "Admin"
}
```

**Success Response (200 OK):**
```typescript
interface ChangeRoleResponse {
  user_id: string;
  old_role: string;
  new_role: string;
  changed_at: string;
  changed_by: string;
}
```

**Error Responses:**
- `400 Bad Request` - Invalid role or safety rule violation
- `403 Forbidden` - User doesn't have permission to change roles
- `404 Not Found` - User is not a member

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Role Assignment**
- **Threats:** Privilege escalation (user assigns self Owner role)
- **Controls:**
  - RLS policies enforce who can assign roles
  - Database constraints prevent invalid role assignments
  - Audit logs track all role changes
  - Cannot demote yourself if last Owner (safety check)

**Boundary 2: Permission Evaluation**
- **Threats:** Bypass permission checks
- **Controls:**
  - RLS policies enforce permissions at database level
  - Cannot be bypassed via API manipulation
  - Helper functions use SECURITY DEFINER for consistent evaluation
  - Cached roles in Workers KV have short TTL (5 minutes)

**Boundary 3: Role Changes**
- **Threats:** Unauthorized role elevation, removing last Owner
- **Controls:**
  - Validation logic prevents unsafe role changes
  - Audit logs track who changed what
  - Notifications alert users to role changes
  - Cache invalidation ensures immediate effect

### Authentication & Authorization

**Authentication:**
- JWT tokens contain user_id
- Supabase Auth validates tokens
- RLS policies use auth.uid() to get user

**Authorization:**
- Roles map to permissions
- Permissions evaluated via database functions
- RLS policies enforce permissions on every query
- Frontend uses role to show/hide UI elements (UX only)

### Data Security

**Role Assignment Data:**
- Stored in `org_members` and `project_members` tables
- Protected by RLS policies
- Not encrypted (not sensitive data)
- Audit logged for compliance

**Threat Model:**

**Threat 1: Privilege Escalation via Role Assignment**
- **Description:** Developer tries to assign self Admin or Owner role
- **Likelihood:** Medium (users might try)
- **Impact:** High (unauthorized access to all secrets)
- **Mitigation:**
  - RLS policy: Only Admins/Owners can assign roles
  - Database-level enforcement (cannot bypass via API)
  - Audit log detects unusual role changes

**Threat 2: Last Owner Removes Self**
- **Description:** Last Owner demotes or removes self, no one can manage org
- **Likelihood:** Low (usually accidental)
- **Impact:** High (org becomes unmanageable)
- **Mitigation:**
  - Validation logic prevents demoting last Owner
  - Warning UI: "You are the last Owner, transfer ownership first"
  - Database constraint prevents deletion of last Owner

**Threat 3: Admin Assigns Owner Role**
- **Description:** Admin tries to escalate to Owner
- **Likelihood:** Low (requires intentional API manipulation)
- **Impact:** High (Admin becomes Owner)
- **Mitigation:**
  - Validation: Only Owners can assign Owner role
  - RLS policy enforces this at database level
  - Audit log tracks attempts

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Role lookup (cached): < 5ms p95
- Role lookup (database): < 20ms p95
- Permission evaluation: < 30ms p95
- Role assignment: < 100ms p95

**Throughput:**
- Role lookups: 10,000/second (with caching)
- Role assignments: 100/second

**Resource Usage:**
- Memory: < 5MB for role definitions in memory
- Database: 1-2 queries per permission check (with caching)

### Performance Optimization

**Caching:**
- Role definitions cached in-memory (static data, rarely changes)
- User's effective role cached in Workers KV (5-minute TTL)
- Permission mappings cached (static for MVP)

**Database Optimization:**
- Indexes on `org_members(user_id, organization_id)`
- Indexes on `project_members(user_id, project_id)`
- Indexes on `role_permissions(role_id)`
- Helper functions use SECURITY DEFINER (run as privileged user, avoid nested checks)

---

## Scalability

### Horizontal Scaling

**Components that scale:**
- Cloudflare Workers: Automatic scaling
- Supabase PostgreSQL: Connection pooling via PgBouncer

**Load balancing:**
- Cloudflare routes to nearest edge location
- Database connections pooled

### Bottlenecks

**Current bottlenecks:**
- Database queries for role evaluation (mitigated by caching)
- Role changes invalidate caches (acceptable tradeoff)

**Mitigation:**
- Cache roles in Workers KV
- Use database functions to minimize round trips
- Connection pooling

---

## Failure Modes

### Failure Mode 1: Last Owner Demotes Self (Prevented)

**Scenario:** Last Owner tries to change own role to Admin

**Impact:** High - No one can manage organization

**Detection:** Validation logic catches this before database write

**Recovery:** Not possible, because it's prevented

**Prevention:**
- Validation check: Count Owners before allowing demotion
- UI warning: "You are the last Owner"
- Require transferring ownership to someone else first

---

### Failure Mode 2: Role Change Doesn't Take Effect Immediately

**Scenario:** Admin changes user's role, but user still has old role for 5 minutes (cached)

**Impact:** Low - User has old permissions for up to 5 minutes

**Detection:** User reports "I should have access now but I don't"

**Recovery:**
- Wait for cache TTL (5 minutes)
- Or: Clear cache manually via admin dashboard

**Prevention:**
- Clear cache immediately on role change
- Set TTL short enough (5 minutes is acceptable for MVP)

---

### Failure Mode 3: Admin Assigns Invalid Role

**Scenario:** API bug allows Admin to assign "SuperAdmin" role (doesn't exist)

**Impact:** Medium - Database constraint prevents insertion, but error message unclear

**Detection:** Database constraint violation error

**Recovery:**
- Fix API bug
- Frontend validation should prevent this

**Prevention:**
- Database constraint: Only allow valid role names
- TypeScript types: Only allow valid role names
- Frontend dropdown: Only show valid roles

---

## Alternatives Considered

### Alternative 1: More Granular Roles (6-8 roles)

**Description:** Add roles like "Junior Developer", "Auditor", "Contractor", "Billing Manager"

**Pros:**
- More flexibility for specific use cases
- Closer match to real-world team structures

**Cons:**
- Confusing for users (too many choices)
- Harder to explain and document
- 95% of teams don't need this granularity

**Why not chosen:** Four roles cover 95% of use cases. Can add custom roles post-MVP for enterprises that need more.

---

### Alternative 2: Fewer Roles (3 roles: Owner, Member, Viewer)

**Description:** Simplify to just 3 roles, combine Admin and Developer

**Pros:**
- Even simpler for small teams
- Easier to implement and maintain

**Cons:**
- Doesn't distinguish between "can manage team" (Admin) and "cannot" (Developer)
- Many teams need someone to manage secrets but not invite/remove members
- Doesn't follow industry patterns (most tools have 4-5 roles)

**Why not chosen:** The distinction between Admin (team management) and Developer (secret access only) is valuable for most teams.

---

### Alternative 3: Fully Custom Roles (No Standard Roles)

**Description:** Every organization defines their own roles from scratch

**Pros:**
- Maximum flexibility
- Works for any team structure

**Cons:**
- Overwhelming for beginners and small teams
- Everyone reinvents the wheel (most end up with Owner/Admin/Developer/Read-Only anyway)
- Complex UI for role creation

**Why not chosen:** Too complex for MVP. Standard roles serve 95% of users. Can add custom roles post-MVP for enterprise.

---

## Decision Log

### Decision 1: Four Standard Roles (Owner, Admin, Developer, Read-Only)

**Date:** 2025-10-30

**Context:** Need roles that are intuitive, cover most use cases, and follow industry patterns.

**Options:**
1. 4 standard roles (chosen)
2. 6-8 granular roles
3. 3 simplified roles

**Decision:** 4 standard roles

**Rationale:**
- Industry standard (GitHub, GitLab, many SaaS tools use similar)
- Clear role hierarchy (Owner > Admin > Developer > Read-Only)
- Covers 95% of use cases without overwhelming users
- Names are self-explanatory (don't need docs to understand)
- Can add custom roles post-MVP if needed

**Consequences:**
- Some teams might want "Contractor" or "Junior Developer" role
- Can work around with project-specific assignments
- Custom role builder is on post-MVP roadmap

---

### Decision 2: Role Assignment at Both Org and Project Levels

**Date:** 2025-10-30

**Context:** Should roles be assigned at organization level, project level, or both?

**Options:**
1. Both org and project (chosen)
2. Organization only (inherited by all projects)
3. Project only (no organization concept)

**Decision:** Both org and project, with project override

**Rationale:**
- Flexibility: Admin at org level, but Developer in specific high-security project
- Simplicity: Assign user to org once, they get baseline access to all projects
- Matches mental model: "I'm an Admin in this company, but restricted in ClientX project"
- Reduces permission management overhead for most teams

**Consequences:**
- Need evaluation logic: MAX(org_role_level, project_role_level)
- Must document clearly to avoid confusion
- UI must show both org role and project role

---

### Decision 3: Read-Only Cannot Decrypt Secrets

**Date:** 2025-10-30

**Context:** Should "Read-Only" be able to see secret values, or just metadata?

**Options:**
1. Read-Only sees names/metadata only (chosen)
2. Read-Only can decrypt secrets
3. Separate "Auditor" role for metadata-only

**Decision:** Read-Only sees metadata only, cannot decrypt

**Rationale:**
- Use case: Finance team needs to see what secrets exist, not the actual values
- Use case: Security auditors reviewing access without needing keys
- Zero-knowledge alignment: Decrypt is a privileged operation
- Useful for onboarding: New team member can see what exists before getting full access

**Consequences:**
- Need clear UI distinction: "You can see this secret exists but not decrypt it"
- Must explain difference between `can_read_secrets` and `can_decrypt_secrets`
- Some users might expect "Read-Only" means "can read everything"

---

### Decision 4: Admin Cannot Assign Owner Role

**Date:** 2025-10-30

**Context:** Should Admins be able to assign the Owner role?

**Options:**
1. Only Owners can assign Owner role (chosen)
2. Admins can assign any role including Owner
3. Owner assignment requires 2FA or confirmation

**Decision:** Only Owners can assign Owner role

**Rationale:**
- Security: Prevents Admin from escalating to Owner
- Clear hierarchy: Owner is special, only Owner can create more Owners
- Matches mental model: "Owner is the highest, you need Owner permission to grant it"
- Prevents accidental privilege escalation

**Consequences:**
- If only 1 Owner exists and they're unavailable, cannot add more Owners
- Solution: Encourage orgs to have 2-3 Owners
- UI: Disable Owner option in role dropdown for Admins

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `03-security/rbac/permissions-model.md` - Permission definitions
- [ ] `03-security/auth/authentication-flow.md` - JWT tokens
- [ ] `04-database/schemas/users-orgs.md` - User, org, project tables (to be created)
- [ ] `GLOSSARY.md` - Role terminology

**External Services:**
- Supabase PostgreSQL - Store role definitions and assignments
- Cloudflare Workers KV - Cache user roles

### Architecture Dependencies

**Depends on:**
- Authentication flow (JWT tokens)
- Database schema (users, orgs, projects)
- Permissions model (granular permissions)

**Required by:**
- All team features (invitations, member management)
- All API endpoints (enforce permissions based on roles)
- Frontend UI (show/hide based on roles)

---

## References

### Internal Documentation
- `03-security/rbac/permissions-model.md` - Permission definitions and evaluation
- `03-security/rbac/rls-policies.md` - RLS policy implementations (to be created)
- `04-database/schemas/users-orgs.md` - Database schema (to be created)
- `GLOSSARY.md` - Role and permission terminology
- `TECH-STACK.md` - Technology stack
- `01-product/product-vision-strategy.md` - Product context

### External Resources
- [NIST RBAC Standard](https://csrc.nist.gov/projects/role-based-access-control) - RBAC best practices
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) - Security guidelines
- [AWS IAM Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) - Industry example
- [GitHub Permissions](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/repository-roles-for-an-organization) - Industry example

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Documentation Agent | Initial role definitions document |

---

## Notes

### Future Enhancements
- **Custom role definitions** - Organizations define their own roles (e.g., "Contractor", "Junior Dev")
- **Temporary role elevation** - Grant Admin for 24 hours for specific task
- **Role templates** - Pre-configured custom roles for common scenarios
- **Group-based roles** - Assign roles to groups, not just individuals
- **Department-based roles** - Auto-assign roles based on department in SSO

### Known Issues
- **Four roles might not fit all teams** - Some want "Contractor" or "Auditor" roles
  - Workaround: Use project-specific assignments
  - Solution: Add custom role builder post-MVP
- **Read-Only name might be confusing** - Users might think it means "read everything"
  - Mitigation: Clear description in UI
  - Mitigation: Rename to "Viewer" if confusion persists
- **Role hierarchy is linear** - Cannot have "sideways" roles at same level
  - This is intentional for simplicity
  - Custom roles can break linearity post-MVP

### Next Review Date
2025-11-30 (review after implementation and user testing)
