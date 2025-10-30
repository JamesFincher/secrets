---
Document: Team Collaboration and Permissions - Feature Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 03-security/rbac/permissions-model.md, 05-api/endpoints/projects-endpoints.md, GLOSSARY.md, TECH-STACK.md
---

# Team Collaboration and Permissions Feature

## Overview

The Team Collaboration and Permissions feature enables secure sharing of secrets within organizations and projects using role-based access control (RBAC). It allows teams to invite members, assign roles, manage permissions, track activity, and implement approval workflows for sensitive operations. The feature supports organizations from solo developers to enterprise teams while maintaining zero-knowledge encryption.

**Purpose:** Enable secure team collaboration on secret management with granular permissions, audit trails, and approval workflows.

**Target Users:** Development Teams, Enterprise Security Teams

**Priority:** P0 - MVP

---

## Table of Contents

1. [User Perspective](#user-perspective)
2. [Technical Architecture](#technical-architecture)
3. [User Flows](#user-flows)
4. [Technical Implementation](#technical-implementation)
5. [API Contracts](#api-contracts)
6. [Security Considerations](#security-considerations)
7. [Performance Requirements](#performance-requirements)
8. [Testing Strategy](#testing-strategy)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## User Perspective

### What Users See

Users interact with team collaboration through invitation flows, role management interfaces, activity feeds, and approval workflows. The feature seamlessly integrates into the project management interface with clear visual indicators of team member access and permissions.

**Key Capabilities:**
- Invite team members via email with automatic role assignment
- Assign and change roles (Owner, Admin, Developer, Read-Only)
- View team member list with roles and last activity
- Track who accessed which secrets and when (activity feed)
- Approve or deny requests to access production secrets
- Share secrets temporarily via one-time links
- Receive notifications when permissions change

### User Benefits

**For Learners (Beginners):**
- Simple invitation flow with clear role descriptions
- Visual indicators showing what actions they can/cannot perform
- Helpful tooltips explaining permission restrictions

**For Solo Developers:**
- Easy transition from solo to team collaboration
- Invite collaborators without complex setup
- Maintain control as project Owner

**For Development Teams:**
- Role-based access ensures developers can work without accidentally breaking production
- Activity feed provides transparency on who accessed what
- Approval workflows for production secrets prevent accidental exposure

**For Enterprise:**
- Fine-grained permission control meets compliance requirements
- Comprehensive audit trails for SOC 2 and ISO 27001
- Approval workflows for production access align with change management policies
- SSO integration (post-MVP) for centralized identity management

### Example Scenarios

**Scenario 1: Adding a New Developer to a Project**

Alice (Owner) wants to add Bob (new developer) to the "RecipeApp" project:

1. Alice navigates to RecipeApp project settings → Team tab
2. Clicks "Invite Member" button
3. Enters Bob's email: bob@example.com
4. Selects "Developer" role from dropdown (with tooltip: "Can create, read, update, and delete secrets. Cannot manage team members.")
5. Clicks "Send Invitation"
6. Bob receives email with invitation link
7. Bob clicks link, is prompted to create Abyrith account or sign in
8. Bob is automatically added to RecipeApp with Developer role
9. Bob can now see and manage secrets in all environments (development, staging, production)

**Scenario 2: Restricting Production Access with Approval Workflow**

Alice wants to ensure production secrets require approval before access:

1. Alice navigates to RecipeApp project settings → Security tab
2. Enables "Require approval for production environment access"
3. Bob (Developer) tries to view a production API key
4. System displays: "This secret requires approval. Request has been sent to project admins."
5. Alice receives notification: "Bob requested access to STRIPE_API_KEY in production"
6. Alice reviews request, clicks "Approve" (valid for 1 hour)
7. Bob receives notification: "Access to STRIPE_API_KEY approved for 1 hour"
8. Bob can now decrypt the secret
9. After 1 hour, Bob must request approval again if needed

**Scenario 3: Tracking Secret Access for Audit**

Alice needs to verify who accessed a specific API key for security audit:

1. Alice navigates to RecipeApp → Secrets → STRIPE_API_KEY
2. Clicks "Activity" tab
3. Sees chronological list:
   - "Bob decrypted this secret" - 2 hours ago
   - "Charlie viewed secret metadata" - 1 day ago
   - "Alice updated secret value" - 3 days ago
4. Alice can export activity log as CSV for compliance reporting
5. Activity includes timestamp, user, action, IP address, and user agent

**Scenario 4: Sharing a Secret Temporarily via One-Time Link**

Charlie (Admin) needs to share a database password with a contractor for 24 hours:

1. Charlie navigates to DATABASE_PASSWORD secret
2. Clicks "Share" button → "Create one-time link"
3. Sets expiration: 24 hours
4. Optionally sets access limit: 1 view
5. System generates encrypted one-time link
6. Charlie sends link to contractor via secure channel (email, Slack)
7. Contractor clicks link (no Abyrith account needed)
8. Contractor must enter a verification code (sent to their email)
9. Secret is displayed once, then link expires
10. Activity log records: "One-time link accessed by guest user (IP: 192.168.1.1)"

---

## Technical Architecture

### System Components

**Components involved:**
- **Frontend:**
  - Team management UI (invitation, role assignment)
  - Activity feed component
  - Approval workflow interface
  - One-time share link generator
  - Permission context provider (React Context)
- **Backend:**
  - Project member management API (POST, PUT, DELETE /projects/:id/members)
  - Activity logging API (GET /projects/:id/activity)
  - Approval workflow API (POST /approvals/request, PUT /approvals/:id)
  - One-time share API (POST /shares, GET /shares/:token)
  - Cloudflare Workers for permission checks
- **Database:**
  - org_members table (organization-level roles)
  - project_members table (project-level roles)
  - audit_logs table (activity tracking)
  - approval_requests table (pending approvals)
  - one_time_shares table (temporary access links)
  - RLS policies for all tables
- **External Services:**
  - Email service for invitations and notifications (via Supabase Auth)
  - Webhook service for Slack/email notifications (optional)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                       │
│  (Team Management, Activity Feed, Approvals)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS + JWT
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Workers                         │
│  • Validate JWT                                         │
│  • Check user permissions (cached in KV)                │
│  • Route to appropriate API endpoint                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Internal API
                     ▼
┌─────────────────────────────────────────────────────────┐
│                Supabase PostgreSQL                      │
│                                                         │
│  ┌────────────────────────────────────────────┐       │
│  │  RLS Policies (Permission Enforcement)      │       │
│  │  • User can only access authorized projects │       │
│  │  • Role-based access to secrets             │       │
│  │  • Audit logs track all actions             │       │
│  └────────────────────────────────────────────┘       │
│                                                         │
│  Tables:                                                │
│  • org_members (organization roles)                    │
│  • project_members (project-specific roles)            │
│  • audit_logs (activity tracking)                      │
│  • approval_requests (pending approvals)               │
│  • one_time_shares (temporary links)                   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action:** User invites team member or requests approval
2. **Frontend Processing:** React component collects data, validates input
3. **API Call:** POST to /projects/:id/members or /approvals/request
4. **Workers Processing:** Validate JWT, check permissions, forward to Supabase
5. **Database Interaction:** RLS policies enforce permissions, insert/update records
6. **Audit Logging:** Automatic trigger logs all permission-related actions
7. **Notification:** Email sent to invited user or approver
8. **Response:** Success/error returned to frontend

---

## User Flows

### Flow 1: Invite Team Member to Project

**Trigger:** Owner or Admin clicks "Invite Member" in project settings

**Steps:**
1. User navigates to project settings → Team tab
2. User clicks "Invite Member" button
3. System displays invitation modal with fields:
   - Email address (required)
   - Role selector: Owner, Admin, Developer, Read-Only (required)
   - Custom message (optional)
4. User fills in email and selects role
5. System validates email format and checks if user already exists in organization
6. User clicks "Send Invitation"
7. System creates project_members record with invited user
8. System sends invitation email with link to join project
9. System logs action in audit_logs table
10. UI displays success message: "Invitation sent to [email]"
11. Invited user receives email, clicks link, authenticates, and is added to project

**Success Criteria:** User successfully added to project with correct role, audit log created, email sent

**Error Cases:**
- **Error 1:** Email invalid format → Display: "Please enter a valid email address"
- **Error 2:** User already member of project → Display: "This user is already a member of this project"
- **Error 3:** Inviter lacks permission → Display: "You don't have permission to invite members. Contact a project Owner or Admin."
- **Error 4:** Email service unavailable → Display: "Invitation created but email failed to send. You can copy this invitation link: [link]"

### Flow 2: Change Team Member Role

**Trigger:** Owner or Admin clicks "Change Role" for an existing team member

**Steps:**
1. User views team member list in project settings
2. User clicks dropdown next to team member's current role
3. System displays role options with descriptions
4. User selects new role (e.g., Developer → Admin)
5. System displays confirmation dialog: "Change [name]'s role from Developer to Admin? This will grant additional permissions including team management."
6. User clicks "Confirm"
7. System validates user has permission to change roles
8. System updates project_members record
9. System logs role change in audit_logs
10. System sends notification email to affected user: "Your role in [project] has been changed to Admin"
11. UI updates to reflect new role

**Success Criteria:** Role successfully changed, audit log created, user notified

**Error Cases:**
- **Error 1:** Cannot change own role → Display: "You cannot change your own role. Ask another admin for help."
- **Error 2:** Cannot change owner role → Display: "Project owner role cannot be changed. Transfer project ownership instead."
- **Error 3:** Lack permission → Display: "Only Owners and Admins can change member roles"

### Flow 3: Request and Approve Production Secret Access

**Trigger:** Developer attempts to decrypt a production secret with approval workflow enabled

**Steps:**

**Part A: Request Access**
1. Developer navigates to production environment
2. Developer clicks "Decrypt" button on a secret
3. System checks if approval is required (project settings: approval_required = true for production)
4. System creates approval_request record in database
5. System displays modal: "Access to this secret requires approval. Your request has been sent to project admins."
6. System sends notification to all Admins and Owners via email and in-app notification
7. Developer sees "Pending Approval" status on secret

**Part B: Approve Access**
8. Admin receives notification: "[Developer] requested access to [SECRET_NAME] in production"
9. Admin navigates to Approvals dashboard (in project settings or dedicated page)
10. Admin sees pending request with context:
    - Requester: Developer name
    - Secret: SECRET_NAME
    - Environment: production
    - Time requested: timestamp
    - Reason: (optional field filled by requester)
11. Admin clicks "Approve" (or "Deny")
12. System displays time-limit selector: 1 hour, 4 hours, 24 hours, 7 days
13. Admin selects "1 hour" and clicks "Confirm Approval"
14. System updates approval_request with approved status and expiration time
15. System logs approval in audit_logs
16. System sends notification to Developer: "Your access to [SECRET_NAME] has been approved for 1 hour"

**Part C: Access Secret**
17. Developer refreshes page or receives real-time notification
18. "Decrypt" button is now enabled
19. Developer clicks "Decrypt" and successfully views secret
20. After 1 hour, access expires automatically
21. If Developer tries to decrypt again after expiration, Flow restarts at Step 1

**Success Criteria:** Request created, Admin notified, approval granted, time-limited access enforced, all actions logged

**Error Cases:**
- **Error 1:** No admins available → Display: "No admins available to approve. Contact project owner."
- **Error 2:** Approval expired before use → Display: "Approval expired. Please request access again."
- **Error 3:** Request already pending → Display: "You already have a pending request for this secret"

### Flow 4: Track Activity in Activity Feed

**Trigger:** User navigates to project Activity tab or secret-specific activity

**Steps:**
1. User clicks "Activity" tab in project dashboard or on specific secret
2. System queries audit_logs table filtered by project_id (or secret_id)
3. System applies RLS policies (user can only see logs for projects they have access to)
4. System returns paginated activity log entries
5. Frontend displays activity feed with:
   - User avatar and name
   - Action description (e.g., "decrypted STRIPE_API_KEY")
   - Timestamp (relative: "2 hours ago")
   - Environment badge (Development, Staging, Production)
   - IP address and user agent (expandable detail)
6. User can filter by:
   - User (dropdown of team members)
   - Action type (created, updated, deleted, accessed)
   - Environment
   - Date range
7. User can export activity log as CSV for compliance reporting
8. System generates CSV with all visible log entries

**Success Criteria:** Activity log displays correctly, filters work, export succeeds

**Error Cases:**
- **Error 1:** No activity in selected time range → Display: "No activity found for selected filters"
- **Error 2:** Export fails → Display: "Export failed. Please try again or contact support."

### Flow 5: Share Secret via One-Time Link

**Trigger:** User clicks "Share" button on a secret

**Steps:**
1. User navigates to secret detail page
2. User clicks "Share" button → "Create one-time link"
3. System displays one-time share modal with options:
   - Expiration time: 1 hour, 24 hours, 7 days, custom
   - Access limit: 1 view, 3 views, 5 views, unlimited (until expiration)
   - Require email verification: yes/no
4. User selects: 24 hours, 1 view, require email verification
5. User clicks "Generate Link"
6. System creates one_time_shares record with:
   - Encrypted secret value
   - Expiration timestamp
   - Access count limit
   - Unique token (UUID)
7. System returns one-time link: `https://abyrith.com/share/[token]`
8. System logs share creation in audit_logs
9. UI displays link with copy button and warning: "This link will expire in 24 hours or after 1 view. Share securely."
10. User copies link and sends via secure channel
11. Recipient clicks link → redirected to share page
12. System validates token (not expired, not exceeded access limit)
13. If email verification required: System prompts for recipient email
14. System sends verification code to recipient email
15. Recipient enters code
16. System displays decrypted secret
17. System increments access count in one_time_shares
18. System logs access in audit_logs (guest user, IP address)
19. If access limit reached (1 view), link is invalidated

**Success Criteria:** Link generated, access restricted by time/count limits, email verification works, all access logged

**Error Cases:**
- **Error 1:** Link expired → Display: "This share link has expired"
- **Error 2:** Access limit exceeded → Display: "This share link has reached its access limit"
- **Error 3:** Invalid token → Display: "Invalid or malicious share link"
- **Error 4:** Email verification fails → Display: "Verification code incorrect. Please try again."

---

## Technical Implementation

### Frontend Implementation

**Components:**
- `TeamManagement.tsx` - Main team management interface
- `InviteMemberModal.tsx` - Invitation modal with role selector
- `TeamMemberList.tsx` - List of team members with role indicators
- `RoleSelector.tsx` - Dropdown for selecting/changing roles
- `ActivityFeed.tsx` - Activity log display with filters
- `ActivityLogEntry.tsx` - Individual activity log item
- `ApprovalDashboard.tsx` - Pending approval requests interface
- `ApprovalRequestCard.tsx` - Individual approval request card
- `OneTimeShareModal.tsx` - One-time link generation modal
- `PermissionGate.tsx` - Component that hides children if user lacks permission

**State Management:**

**Local state:**
- Modal open/close states (invitation, share, approval)
- Form input values (email, role, expiration)
- Loading states for API calls

**Global state (Zustand):**
- Current user's permissions per project
- Team member list for active project
- Pending approval count (for badge notifications)

**Server state (React Query):**
- Team members list (`useQuery(['projectMembers', projectId])`)
- Activity logs (`useQuery(['activityLogs', projectId, filters])`)
- Pending approvals (`useQuery(['pendingApprovals', projectId])`)
- User's effective role in project (`useQuery(['userRole', projectId])`)

**Key Functions:**

```typescript
// Check if current user has specific permission
function useCanPerform(permission: Permission): boolean {
  const { effectiveRole } = usePermissions();
  return effectiveRole?.permissions.includes(permission) ?? false;
}

// Invite team member
async function inviteTeamMember(
  projectId: string,
  email: string,
  role: UserRole
): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/members`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, role })
  });

  if (!response.ok) {
    throw new Error('Failed to invite member');
  }
}

// Change team member role
async function changeTeamMemberRole(
  projectId: string,
  userId: string,
  newRole: UserRole
): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: newRole })
  });

  if (!response.ok) {
    throw new Error('Failed to change role');
  }
}

// Request approval for secret access
async function requestApproval(
  secretId: string,
  reason?: string
): Promise<ApprovalRequest> {
  const response = await fetch('/api/approvals/request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ secret_id: secretId, reason })
  });

  if (!response.ok) {
    throw new Error('Failed to request approval');
  }

  return response.json();
}

// Approve or deny access request
async function approveAccess(
  approvalId: string,
  approved: boolean,
  expiresInHours: number = 1
): Promise<void> {
  const response = await fetch(`/api/approvals/${approvalId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      approved,
      expires_in_hours: approved ? expiresInHours : undefined
    })
  });

  if (!response.ok) {
    throw new Error('Failed to approve/deny request');
  }
}

// Generate one-time share link
async function createOneTimeShare(
  secretId: string,
  expiresInHours: number,
  maxAccessCount: number,
  requireEmailVerification: boolean
): Promise<{ token: string; url: string }> {
  const response = await fetch('/api/shares', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      secret_id: secretId,
      expires_in_hours: expiresInHours,
      max_access_count: maxAccessCount,
      require_email_verification: requireEmailVerification
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create one-time share');
  }

  return response.json();
}
```

### Backend Implementation

**API Endpoints:**
- `POST /projects/:id/members` - Invite team member
- `GET /projects/:id/members` - List team members
- `PUT /projects/:id/members/:userId` - Change member role
- `DELETE /projects/:id/members/:userId` - Remove member
- `GET /projects/:id/activity` - Get activity logs
- `POST /approvals/request` - Request secret access approval
- `GET /approvals/pending` - Get pending approvals for current user
- `PUT /approvals/:id` - Approve or deny request
- `POST /shares` - Create one-time share link
- `GET /shares/:token` - Access one-time share (public endpoint)

**Cloudflare Workers:**
- `permission-checker.ts` - Validates user permissions before forwarding requests to Supabase
- `approval-notifier.ts` - Sends email/webhook notifications when approvals are requested or granted
- `share-link-handler.ts` - Validates one-time share tokens and enforces access limits

**Supabase Functions:**
- `get_user_project_role(user_id, project_id)` - Returns user's effective role (org role or project role, whichever is higher)
- `user_has_permission(user_id, project_id, permission)` - Checks if user has specific permission
- `log_activity(user_id, action, resource_type, resource_id, metadata)` - Logs action to audit_logs table

### Database Implementation

**Tables Used:**
- `org_members` - Organization-level role assignments
- `project_members` - Project-specific role assignments (overrides org role)
- `audit_logs` - All activity tracking
- `approval_requests` - Pending and completed approval requests
- `one_time_shares` - Temporary share links with access limits

**Key Queries:**

```sql
-- Get all team members for a project (combines org and project members)
SELECT
  COALESCE(pm.user_id, om.user_id) as user_id,
  u.email,
  u.name,
  CASE
    WHEN pm.role_id IS NOT NULL THEN r_project.name
    ELSE r_org.name
  END as role,
  COALESCE(pm.created_at, om.created_at) as added_at,
  COALESCE(pm.created_by, om.created_by) as added_by
FROM projects p
LEFT JOIN org_members om ON om.organization_id = p.organization_id
LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = om.user_id
LEFT JOIN auth.users u ON u.id = COALESCE(pm.user_id, om.user_id)
LEFT JOIN roles r_project ON r_project.id = pm.role_id
LEFT JOIN roles r_org ON r_org.id = om.role_id
WHERE p.id = $1;

-- Get activity log for a project
SELECT
  al.id,
  al.event_type,
  al.created_at,
  al.user_id,
  u.email as user_email,
  u.name as user_name,
  al.project_id,
  al.secret_id,
  s.name as secret_name,
  al.metadata
FROM audit_logs al
LEFT JOIN auth.users u ON u.id = al.user_id
LEFT JOIN secrets s ON s.id = al.secret_id
WHERE al.project_id = $1
ORDER BY al.created_at DESC
LIMIT $2 OFFSET $3;

-- Get pending approval requests for a user (where user is Admin/Owner)
SELECT
  ar.id,
  ar.secret_id,
  s.name as secret_name,
  ar.requester_id,
  u.email as requester_email,
  u.name as requester_name,
  ar.reason,
  ar.created_at
FROM approval_requests ar
JOIN secrets s ON s.id = ar.secret_id
JOIN auth.users u ON u.id = ar.requester_id
WHERE ar.status = 'pending'
  AND user_has_permission(auth.uid(), s.project_id, 'can_approve_requests') = TRUE
ORDER BY ar.created_at ASC;
```

**RLS Policies:**

```sql
-- Policy: Users can view project members if they have access to the project
CREATE POLICY "Users can view project members"
ON project_members
FOR SELECT
TO authenticated
USING (
  user_has_permission(auth.uid(), project_id, 'can_read_secrets') = TRUE
);

-- Policy: Only Admins and Owners can invite members
CREATE POLICY "Admins can invite project members"
ON project_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_has_permission(auth.uid(), project_id, 'can_invite_project_members') = TRUE
);

-- Policy: Only Admins and Owners can change member roles
CREATE POLICY "Admins can change member roles"
ON project_members
FOR UPDATE
TO authenticated
USING (
  user_has_permission(auth.uid(), project_id, 'can_change_project_member_roles') = TRUE
);

-- Policy: Users can view activity logs for projects they have access to
CREATE POLICY "Users can view activity for accessible projects"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  user_has_permission(auth.uid(), project_id, 'can_view_project_audit_logs') = TRUE
);
```

---

## API Contracts

### Endpoint: POST /projects/:projectId/members

**Purpose:** Invite a team member to a project

**Request:**
```typescript
interface InviteTeamMemberRequest {
  email: string;          // Required, valid email
  role: UserRole;         // Required: 'admin' | 'developer' | 'read-only'
  message?: string;       // Optional custom invitation message
}
```

**Example Request:**
```json
{
  "email": "newdev@example.com",
  "role": "developer",
  "message": "Welcome to the RecipeApp project!"
}
```

**Response (Success - 201 Created):**
```typescript
interface InviteTeamMemberResponse {
  user_id: string;
  email: string;
  name: string | null;
  role: UserRole;
  added_at: string;
  added_by: string;
}
```

**Example Response:**
```json
{
  "user_id": "user-uuid-here",
  "email": "newdev@example.com",
  "name": "Jane Developer",
  "role": "developer",
  "added_at": "2025-10-30T15:00:00Z",
  "added_by": "owner-user-uuid"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email or role
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to invite members
- `404 Not Found` - Project doesn't exist
- `409 Conflict` - User already a member of this project
- `500 Internal Server Error` - Server error

---

### Endpoint: POST /approvals/request

**Purpose:** Request approval to access a secret

**Request:**
```typescript
interface ApprovalRequestRequest {
  secret_id: string;      // Required, secret UUID
  reason?: string;        // Optional reason for access
}
```

**Example Request:**
```json
{
  "secret_id": "secret-uuid-here",
  "reason": "Debugging production issue #1234"
}
```

**Response (Success - 201 Created):**
```typescript
interface ApprovalRequestResponse {
  id: string;
  secret_id: string;
  requester_id: string;
  status: 'pending';
  reason: string | null;
  created_at: string;
}
```

**Example Response:**
```json
{
  "id": "approval-uuid-here",
  "secret_id": "secret-uuid-here",
  "requester_id": "user-uuid",
  "status": "pending",
  "reason": "Debugging production issue #1234",
  "created_at": "2025-10-30T16:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid secret_id
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this secret (even with approval)
- `404 Not Found` - Secret doesn't exist
- `409 Conflict` - User already has pending request for this secret
- `500 Internal Server Error` - Server error

---

### Endpoint: PUT /approvals/:id

**Purpose:** Approve or deny an access request

**Request:**
```typescript
interface ApproveAccessRequest {
  approved: boolean;          // Required: true or false
  expires_in_hours?: number;  // Optional, default: 1 (only if approved)
}
```

**Example Request:**
```json
{
  "approved": true,
  "expires_in_hours": 4
}
```

**Response (Success - 200 OK):**
```typescript
interface ApproveAccessResponse {
  id: string;
  status: 'approved' | 'denied';
  approved_by: string;
  expires_at: string | null;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "approval-uuid-here",
  "status": "approved",
  "approved_by": "admin-user-uuid",
  "expires_at": "2025-10-30T20:00:00Z",
  "updated_at": "2025-10-30T16:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to approve requests
- `404 Not Found` - Approval request doesn't exist
- `409 Conflict` - Request already approved or denied
- `500 Internal Server Error` - Server error

---

### Endpoint: POST /shares

**Purpose:** Create a one-time share link for a secret

**Request:**
```typescript
interface CreateOneTimeShareRequest {
  secret_id: string;                   // Required, secret UUID
  expires_in_hours: number;            // Required, 1-168 (7 days)
  max_access_count: number;            // Required, 1-10
  require_email_verification: boolean; // Required
}
```

**Example Request:**
```json
{
  "secret_id": "secret-uuid-here",
  "expires_in_hours": 24,
  "max_access_count": 1,
  "require_email_verification": true
}
```

**Response (Success - 201 Created):**
```typescript
interface CreateOneTimeShareResponse {
  token: string;       // Unique share token
  url: string;         // Full share URL
  expires_at: string;  // Expiration timestamp
}
```

**Example Response:**
```json
{
  "token": "share-token-uuid-here",
  "url": "https://abyrith.com/share/share-token-uuid-here",
  "expires_at": "2025-10-31T16:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid parameters (expires_in_hours out of range, etc.)
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to share this secret
- `404 Not Found` - Secret doesn't exist
- `500 Internal Server Error` - Server error

---

## Security Considerations

### Threat Model

**Potential Threats:**

1. **Privilege Escalation** - User manipulates requests to gain higher permissions
   - **Mitigation:** RLS policies enforce permissions at database level, cannot be bypassed via API manipulation. Role changes require Admin/Owner permission and are audited.

2. **Unauthorized Secret Access via Expired Approval** - User accesses secret after approval expires
   - **Mitigation:** Approval expiration checked on every access attempt. Expired approvals automatically invalidated. Audit log tracks all access attempts.

3. **One-Time Link Abuse** - Malicious user extracts secret from one-time link and shares it
   - **Mitigation:** Access count enforced strictly. Email verification required for sensitive shares. Audit log records IP and user agent. Link expires after time/count limit.

4. **Social Engineering for Approvals** - User tricks admin into approving malicious access request
   - **Mitigation:** Approval UI shows full context (requester, secret name, environment, reason). Audit log tracks all approvals. Approval workflow can be disabled for non-production environments.

5. **Activity Log Tampering** - User attempts to delete or modify audit logs
   - **Mitigation:** Audit logs are append-only (no UPDATE or DELETE permissions via RLS). Only database admin (not application users) can modify logs.

### Security Controls

**Authentication:**
- All endpoints require valid JWT Bearer token
- JWT contains user_id, email, org_id, role
- Tokens expire after 1 hour and must be refreshed

**Authorization:**
- RBAC model: Owner > Admin > Developer > Read-Only
- Permission inheritance: Org role grants baseline, project role can override
- Enforcement at three layers: Frontend (UX), Workers (early validation), Database (RLS - security boundary)
- Most privileged role wins: MAX(org_role_level, project_role_level)

**Data Protection:**
- Secrets encrypted client-side before storage (zero-knowledge)
- One-time share links encrypt secret value in database
- Email addresses and names not encrypted (needed for invitations and audit)
- Activity logs stored unencrypted for compliance access

**Audit Logging:**
- Every permission-related action logged:
  - User invited, role changed, member removed
  - Approval requested, approved, denied
  - Secret accessed via approval or one-time link
- Logs include: timestamp, user_id, action, resource, IP address, user agent
- Logs retained for 90 days minimum (configurable per org)

### Compliance

**GDPR:**
- Users can request export of all activity logs mentioning them
- Users can request deletion of their account (removes from all projects)
- One-time share recipients not tracked beyond IP address (anonymized after 90 days)

**SOC 2:**
- Audit logs provide evidence for Access Control (CC6.1, CC6.2, CC6.3)
- Approval workflows demonstrate Least Privilege enforcement
- Activity feed enables monitoring and review of user access

---

## Performance Requirements

### Performance Targets

- **Page Load (Team Management):** < 2s on 3G
- **Time to Interactive (Activity Feed):** < 3s
- **API Response (List Team Members):** < 200ms p95
- **API Response (Request Approval):** < 150ms p95
- **Database Query (Activity Log):** < 100ms p95

### Optimization Strategy

**Frontend:**
- Paginate activity logs (20 entries per page)
- Use React Query caching for team member list (5-minute TTL)
- Optimistic updates for role changes (instant UI feedback)
- Lazy load activity feed (infinite scroll)

**Backend:**
- Cache user's effective role in Workers KV (5-minute TTL)
- Invalidate cache on role change
- Use database indexes on frequently queried columns

**Database:**
- Index on `audit_logs(project_id, created_at DESC)` for fast activity queries
- Index on `project_members(user_id, project_id)` for permission checks
- Index on `approval_requests(status, created_at)` for pending approvals
- Materialized view for team member counts (refresh hourly)

### Load Handling

**Expected Load:**
- 100 concurrent team management operations per second
- 1,000 permission checks per second
- 500 activity log queries per second

**Scalability:**
- Cloudflare Workers scale horizontally (stateless)
- Database connection pooling via PgBouncer
- Read replicas for activity log queries (future)

---

## Testing Strategy

### Unit Tests

**Frontend:**
- Test: Permission context provides correct user permissions
- Test: InviteMemberModal validates email format
- Test: RoleSelector displays correct role descriptions
- Test: ActivityFeed filters logs by user and action type
- Coverage: 80%+

**Backend:**
- Test: Permission evaluation logic (role inheritance)
- Test: Approval expiration logic (time-based access)
- Test: One-time share access count enforcement
- Test: Audit log creation for all actions
- Coverage: 90%+ for permission logic

### Integration Tests

**Test Scenarios:**
1. Invite user → User receives email → User accepts invitation → User has correct role
2. Admin approves request → Developer receives notification → Developer can access secret for 1 hour → Access expires
3. Create one-time share → Access link 1 time → Link invalidated → Second access denied
4. Change user role → Permission cache invalidated → User sees updated permissions immediately

### End-to-End Tests (Playwright)

**E2E Flows:**
1. Complete invitation flow from Owner's perspective to new Developer's perspective
2. Request approval flow: Developer requests → Admin approves → Developer accesses → Access expires
3. Activity feed displays all actions in correct order with proper filtering
4. One-time share creation → recipient access → expiration

### Security Tests

**Security Test Cases:**
1. Attempt to invite user without permission (should fail with 403)
2. Attempt to change own role (should fail with 403)
3. Attempt to access secret after approval expires (should fail with 403)
4. Attempt to modify audit logs (should fail - no UPDATE permission)
5. Attempt to access one-time share after expiration (should fail with 410 Gone)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/rbac/permissions-model.md` - Permission definitions and role hierarchy
- [x] `05-api/endpoints/projects-endpoints.md` - Project and member management API
- [ ] `04-database/schemas/users-orgs.md` - User, org, and project member tables
- [ ] `04-database/schemas/audit-logs.md` - Audit log schema
- [x] `GLOSSARY.md` - Term definitions

**External Services:**
- Supabase Auth - Email notifications for invitations and approvals
- Cloudflare Workers KV - Permission caching
- (Optional) Slack/Webhook service - Real-time notifications

### Feature Dependencies

**Depends on these features:**
- Authentication system (JWT tokens, user sessions)
- Project management (projects and environments exist)
- Secret management (secrets to apply permissions to)

**Enables these features:**
- Compliance reporting (audit logs)
- Enterprise SSO (integrates with team management)
- Advanced approval workflows (builds on basic approval)

---

## References

### Internal Documentation
- `03-security/rbac/permissions-model.md` - Permission model architecture
- `05-api/endpoints/projects-endpoints.md` - Project management API
- `01-product/product-vision-strategy.md` - Product vision and personas
- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS documentation
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth) - Authentication patterns
- [RBAC Best Practices - NIST](https://csrc.nist.gov/projects/role-based-access-control) - RBAC standards
- [SOC 2 Access Control](https://us.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report) - Compliance requirements

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial team collaboration feature documentation |

---

## Notes

### Implementation Priority

**Phase 1 (MVP):**
- Basic team invitation and role management
- Activity feed (view-only)
- Simple permission enforcement (client + server RLS)

**Phase 2 (Post-MVP):**
- Approval workflows for production secrets
- One-time share links
- Advanced activity filtering and export

**Phase 3 (Enterprise):**
- Custom role definitions
- Time-based access grants
- Automated compliance reports
- SSO integration for team management

### Future Enhancements
- Bulk team member import (CSV upload)
- Team groups (assign roles to groups, not individuals)
- Granular permission customization (per-secret permissions)
- Scheduled access (grant access for specific time windows)
- Slack/Teams integration for approval workflows
- Mobile app for approving requests on-the-go
- Machine learning for anomaly detection in activity logs
