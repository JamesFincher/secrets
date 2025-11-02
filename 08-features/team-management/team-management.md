---
Document: Team Management - Feature Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Product/Engineering
Status: Draft
Dependencies: 03-security/rbac/permissions-model.md, 04-database/schemas/users-organizations.md, 05-api/endpoints/projects-endpoints.md, 07-frontend/frontend-architecture.md, GLOSSARY.md
---

# Team Management Feature

## Overview

Team Management in Abyrith enables organizations to invite members, assign roles, manage access to projects and secrets, and collaborate securely. The feature provides a hierarchical permission system (Owner → Admin → Developer → Read-Only) with organization-wide and project-specific role assignments, ensuring secure multi-tenant access while maintaining zero-knowledge encryption.

**Purpose:** Enable secure team collaboration on secrets management with role-based access control, making it simple for small teams and scalable for enterprises.

**Target Users:** The Development Team, Enterprise Security/DevOps Team

**Priority:** P0 - MVP (Core feature for team collaboration)

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

Team Management provides intuitive interfaces for inviting members, assigning roles, viewing team lists, and managing access across organizations and projects. Users experience different capabilities based on their role (Owner, Admin, Developer, Read-Only).

**Key Capabilities:**
- **Organization Management:** Create organizations, invite team members, set organization-wide roles
- **Project Team Management:** Add members to specific projects, assign project-level roles that override organization defaults
- **Role Assignment:** Assign hierarchical roles (Owner, Admin, Developer, Read-Only) with clear permission descriptions
- **Member Visibility:** View all team members, their roles, last activity, and access levels
- **Access Reviews:** Audit who has access to what resources
- **Team Settings:** Configure team-wide settings like approval workflows, access policies, and notifications

### User Benefits

**For Learners (Beginners):**
- Start solo, invite teammates when ready (no forced team setup)
- Clear role descriptions ("Admin can manage team, Developer can manage secrets")
- Invitation flow guides through role selection with explanations

**For Solo Developers:**
- Seamless transition from solo to team (no migration needed)
- Quick invitations via email with automatic onboarding
- See exactly what access each team member has

**For Development Teams:**
- Project-based access control (contractors only get specific project access)
- Environment separation (limit production access to senior developers)
- Audit trail shows who accessed what secrets
- Role-based permissions simplify access management

**For Enterprise:**
- SSO integration for centralized authentication (post-MVP)
- Detailed audit logs for compliance (SOC 2, ISO 27001)
- Bulk user management and provisioning (SCIM, post-MVP)
- Custom role definitions (post-MVP)
- Approval workflows for sensitive operations (post-MVP)

### Example Scenarios

**Scenario 1: Creating First Team**

Solo developer wants to add a team member:

```
1. User creates project "MyApp" (automatically becomes Owner)
2. Clicks "Invite Team Member"
3. Enters colleague's email: "jane@example.com"
4. Selects role: "Developer" (with tooltip: "Can create and manage secrets, cannot manage team")
5. Clicks "Send Invitation"
6. Jane receives email with invitation link
7. Jane signs up and automatically joins project with Developer role
8. Jane can now access MyApp secrets (encrypted with her master password)
```

**Scenario 2: Organization with Multiple Projects**

Team lead managing multiple projects:

```
1. User creates organization "AcmeCorp"
2. Invites 5 developers as "Developer" role (org-wide)
3. Creates 3 projects: "WebApp", "MobileApp", "API"
4. By default, all 5 developers can access all 3 projects
5. For sensitive "API" project, user overrides 2 developers to "Read-Only"
6. Invites contractor as "Developer" but only for "MobileApp" project
7. Result:
   - 3 devs: Full access to all projects
   - 2 devs: Full access to WebApp/MobileApp, Read-Only for API
   - 1 contractor: Access only to MobileApp
```

**Scenario 3: Role Change**

Admin promotes junior developer:

```
1. Admin goes to "Team" page
2. Finds junior developer (currently "Read-Only")
3. Clicks "Change Role" → Selects "Developer"
4. Confirmation prompt: "This will grant access to create/modify/delete secrets. Continue?"
5. Clicks "Confirm"
6. Junior developer immediately gains Developer permissions
7. Audit log records: "Admin promoted junior-dev from Read-Only to Developer"
8. Junior developer sees new permissions reflected in UI
```

---

## Technical Architecture

### System Components

**Components involved:**
- **Frontend:** React components for team management UI (TeamList, InviteMemberForm, RoleSelector, AccessReviewTable)
- **Backend:** API endpoints for member management (Cloudflare Workers + Supabase)
- **Database:** PostgreSQL tables with RLS policies (organizations, org_members, project_members, roles)
- **External Services:** Email service for invitations (Supabase Auth), SSO providers (post-MVP)

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│               Frontend (React)                   │
│  • Team List Component                          │
│  • Invite Member Form                           │
│  • Role Selector                                │
│  • Access Review Dashboard                      │
└──────────────────┬──────────────────────────────┘
                   │
                   │ HTTPS (JWT Bearer Token)
                   ▼
┌─────────────────────────────────────────────────┐
│         Cloudflare Workers (API Gateway)        │
│  • Validate JWT                                 │
│  • Check permissions (can_invite_members, etc.) │
│  • Rate limiting                                │
│  • Forward to Supabase                          │
└──────────────────┬──────────────────────────────┘
                   │
                   │ PostgreSQL Protocol
                   ▼
┌─────────────────────────────────────────────────┐
│           Supabase (PostgreSQL 15.x)            │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │    Tables                                 │ │
│  │  • organizations                          │ │
│  │  • org_members (user-org-role mapping)    │ │
│  │  │  project_members (user-project-role)   │ │
│  │  • roles (Owner, Admin, Developer, RO)    │ │
│  │  • role_permissions                       │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │    RLS Policies (Security Boundary)       │ │
│  │  • Enforce role-based access              │ │
│  │  • Multi-tenancy isolation                │ │
│  │  • Permission evaluation                  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │    Helper Functions                       │ │
│  │  • get_user_project_role()                │ │
│  │  • user_has_project_permission()          │ │
│  │  • user_can_invite_members()              │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                   │
                   │ Email/Webhook
                   ▼
┌─────────────────────────────────────────────────┐
│        Supabase Auth (Email Service)            │
│  • Send invitation emails                       │
│  • Handle OAuth flows                           │
│  • Manage user registration                     │
└─────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action:** Owner/Admin clicks "Invite Member" in frontend
2. **Frontend Processing:** Form validation, role selection, email input
3. **API Call:** POST `/api/organizations/:orgId/members` with JWT token
4. **API Gateway (Workers):** Verify JWT, check `can_invite_members` permission
5. **Backend Processing:** Supabase validates request, RLS policy checks inviter's permission
6. **Database Interaction:** Insert into `org_members` or `project_members` table
7. **Audit Logging:** Record invitation event in `audit_logs` table
8. **Email Notification:** Supabase Auth sends invitation email to new member
9. **Response:** Return success to frontend with new member details

---

## User Flows

### Flow 1: Invite Member to Organization

**Trigger:** Owner/Admin clicks "Invite Team Member" button in organization settings

**Steps:**
1. User navigates to "Team" page in organization settings
2. Clicks "Invite Member" button
3. System displays invitation modal with fields:
   - Email address (required)
   - Role selector (Owner, Admin, Developer, Read-Only)
   - Role description (tooltip explaining each role's permissions)
4. User enters email and selects role (e.g., "Developer")
5. User clicks "Send Invitation"
6. System validates:
   - Email format is valid
   - User has `can_invite_members` permission
   - Email is not already a member
   - Organization has available seats (based on plan)
7. System creates invitation record
8. System sends email to invitee with:
   - Inviter's name
   - Organization name
   - Role they'll have
   - "Accept Invitation" link
9. Invitee clicks link, signs up (or signs in if existing user)
10. System adds user to `org_members` table with specified role
11. User automatically sees organization and its projects in dashboard

**Success Criteria:** Invitee receives email, can accept invitation, and immediately has access to organization resources based on assigned role

**Error Cases:**
- **Email already exists:** Display "This user is already a member" → Offer to change their role instead
- **Insufficient permissions:** Display "You don't have permission to invite members. Contact an Admin."
- **Plan limit reached:** Display "Your plan allows X members. Upgrade to add more."
- **Invalid email:** Display "Please enter a valid email address"

---

### Flow 2: Invite Member to Specific Project

**Trigger:** Project Owner/Admin clicks "Add Member" in project settings

**Steps:**
1. User navigates to specific project's "Team" tab
2. Clicks "Add Member to Project" button
3. System displays modal with:
   - Member selector (shows organization members not yet in project)
   - Email input (for users not in organization)
   - Role selector (specific to this project)
   - Option to override organization role
4. User selects existing org member "Jane" and role "Developer"
5. User clicks "Add to Project"
6. System validates:
   - User has `can_invite_project_members` permission
   - Selected member has organization access or email is valid
7. System creates entry in `project_members` table
8. If user not in org: Send invitation email (org invite + project assignment)
9. If user already in org: Send notification email about project access
10. Jane immediately sees project in her dashboard

**Success Criteria:** Member is added to project and can access project secrets based on role

**Error Cases:**
- **Member already in project:** Display "Jane is already a member of this project" → Offer to change role
- **Insufficient permissions:** Display "You don't have permission to add project members"
- **Lower role than org:** Display warning "Jane has Admin role in organization, assigning Developer will restrict access to this project. Continue?"

---

### Flow 3: Change Member's Role

**Trigger:** Admin clicks "Change Role" next to a team member's name

**Steps:**
1. Admin navigates to "Team" page
2. Finds member to update (e.g., "Bob - Developer")
3. Clicks "..." menu → "Change Role"
4. System displays role selector with:
   - Current role highlighted
   - Available roles (Owner, Admin, Developer, Read-Only)
   - Permission comparison (what they gain/lose)
5. Admin selects new role (e.g., "Admin")
6. System displays confirmation prompt:
   - "Change Bob's role from Developer to Admin?"
   - Permission changes summary
   - Warning if granting destructive permissions
7. Admin clicks "Confirm"
8. System validates:
   - Admin has `can_change_member_roles` permission
   - Not downgrading the last Owner
9. System updates role in database
10. System logs event in audit log
11. System sends notification email to Bob: "Your role changed to Admin"
12. UI updates immediately to reflect new role

**Success Criteria:** Member's role is updated, permissions change immediately, audit log records change

**Error Cases:**
- **Last Owner:** Display "Cannot change the last Owner's role. Assign another Owner first."
- **Self-demotion:** Display "You cannot change your own role. Ask another Admin."
- **Insufficient permissions:** Display "You don't have permission to change roles"

---

### Flow 4: Remove Member from Team

**Trigger:** Admin clicks "Remove" next to team member

**Steps:**
1. Admin navigates to team member list
2. Clicks "..." menu → "Remove from Team" for member "Charlie"
3. System displays confirmation modal:
   - "Remove Charlie from [Organization/Project]?"
   - Warning: "They will lose access to all secrets immediately"
   - Checkbox: "Also remove from all projects" (if org removal)
4. Admin clicks "Remove"
5. System validates:
   - Admin has `can_remove_members` permission
   - Not removing the last Owner
   - Not removing themselves
6. System removes records from `org_members` or `project_members`
7. System revokes all active sessions for that user in this org/project
8. System logs removal in audit log
9. System sends email to Charlie: "You were removed from [Organization]"
10. Charlie no longer sees organization/project in dashboard

**Success Criteria:** Member loses access immediately, cannot view or access any resources

**Error Cases:**
- **Last Owner:** Display "Cannot remove the last Owner. Assign another Owner first."
- **Self-removal:** Display "You cannot remove yourself. Ask another Admin."
- **Insufficient permissions:** Display "You don't have permission to remove members"

---

### Flow 5: View Team Access Overview

**Trigger:** Owner/Admin clicks "Access Review" or "Audit Access" button

**Steps:**
1. User navigates to "Team" → "Access Review"
2. System displays table with columns:
   - Member name/email
   - Organization role
   - Projects (with individual project roles if overridden)
   - Last activity
   - Secrets accessed count
3. User can filter by:
   - Role
   - Project
   - Last active date
4. User can sort by any column
5. User can click member to see detailed access:
   - All projects they can access
   - Effective role in each project
   - Recent activity log
   - Secrets they've accessed
6. User can export access report as CSV/PDF

**Success Criteria:** User can quickly audit who has access to what, identify over-privileged accounts

**Error Cases:**
- **Insufficient permissions:** Display "You don't have permission to view access reports"

---

### Flow 6: Accept Team Invitation

**Trigger:** User clicks invitation link in email

**Steps:**
1. User receives invitation email with link
2. Clicks "Accept Invitation" link
3. System directs to:
   - Sign-up page (if new user)
   - Sign-in page (if existing user)
4. User completes authentication
5. System validates invitation token:
   - Token is valid and not expired
   - Invitation hasn't been revoked
6. System automatically:
   - Adds user to organization/project with specified role
   - Marks invitation as "accepted"
   - Logs event in audit log
7. User redirected to organization/project dashboard
8. Welcome modal displays:
   - Organization name
   - Your role and permissions
   - Next steps (set up master password, view projects, etc.)

**Success Criteria:** User successfully joins team and can immediately access resources based on role

**Error Cases:**
- **Expired invitation:** Display "This invitation has expired. Contact [inviter] for a new invitation."
- **Invalid token:** Display "This invitation is invalid. Please request a new one."
- **Already accepted:** Display "You've already accepted this invitation" → Redirect to dashboard

---

## Technical Implementation

### Frontend Implementation

**Components:**

**1. `TeamList.tsx` - Main team management interface**
```typescript
interface TeamListProps {
  organizationId?: string;
  projectId?: string;
}

export function TeamList({ organizationId, projectId }: TeamListProps) {
  const { data: members, isLoading } = useQuery(
    ['teamMembers', organizationId, projectId],
    () => fetchTeamMembers({ organizationId, projectId })
  );

  const canInvite = useCanPerform('can_invite_members');
  const canChangeRoles = useCanPerform('can_change_member_roles');
  const canRemove = useCanPerform('can_remove_members');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2>Team Members</h2>
        {canInvite && (
          <Button onClick={() => openInviteModal()}>
            Invite Member
          </Button>
        )}
      </div>

      <Table>
        {members?.map(member => (
          <TableRow key={member.id}>
            <TableCell>{member.email}</TableCell>
            <TableCell>
              <RoleBadge role={member.role} />
            </TableCell>
            <TableCell>{formatDate(member.last_active_at)}</TableCell>
            <TableCell>
              <DropdownMenu>
                {canChangeRoles && (
                  <DropdownItem onClick={() => changeRole(member)}>
                    Change Role
                  </DropdownItem>
                )}
                {canRemove && (
                  <DropdownItem onClick={() => removeMember(member)}>
                    Remove
                  </DropdownItem>
                )}
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
```

**2. `InviteMemberModal.tsx` - Invitation form**
```typescript
interface InviteMemberModalProps {
  organizationId?: string;
  projectId?: string;
  onClose: () => void;
}

export function InviteMemberModal({
  organizationId,
  projectId,
  onClose
}: InviteMemberModalProps) {
  const form = useForm({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'Developer'
    }
  });

  const inviteMutation = useMutation(
    (data: InviteMemberRequest) => inviteMember({ organizationId, projectId, ...data }),
    {
      onSuccess: () => {
        toast.success('Invitation sent!');
        onClose();
      },
      onError: (error) => {
        toast.error(error.message);
      }
    }
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <FormField
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input placeholder="colleague@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">
                      <div>
                        <div className="font-medium">Owner</div>
                        <div className="text-sm text-muted-foreground">
                          Full control over organization and all projects
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="Admin">
                      <div>
                        <div className="font-medium">Admin</div>
                        <div className="text-sm text-muted-foreground">
                          Manage team and secrets, cannot delete organization
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="Developer">
                      <div>
                        <div className="font-medium">Developer</div>
                        <div className="text-sm text-muted-foreground">
                          Create and manage secrets, cannot manage team
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="Read-Only">
                      <div>
                        <div className="font-medium">Read-Only</div>
                        <div className="text-sm text-muted-foreground">
                          View secret names only, cannot decrypt or modify
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={form.handleSubmit((data) => inviteMutation.mutate(data))}>
              Send Invitation
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**3. `RoleSelector.tsx` - Role selection component**
```typescript
interface RoleSelectorProps {
  currentRole: string;
  onChange: (role: string) => void;
  showDescriptions?: boolean;
}

export function RoleSelector({
  currentRole,
  onChange,
  showDescriptions = true
}: RoleSelectorProps) {
  const roles = [
    {
      value: 'Owner',
      label: 'Owner',
      description: 'Full control over organization and all projects',
      level: 4
    },
    {
      value: 'Admin',
      label: 'Admin',
      description: 'Manage team and secrets, cannot delete organization',
      level: 3
    },
    {
      value: 'Developer',
      label: 'Developer',
      description: 'Create and manage secrets, cannot manage team',
      level: 2
    },
    {
      value: 'Read-Only',
      label: 'Read-Only',
      description: 'View secret names only, cannot decrypt or modify',
      level: 1
    }
  ];

  return (
    <RadioGroup value={currentRole} onValueChange={onChange}>
      {roles.map((role) => (
        <div key={role.value} className="flex items-start space-x-3">
          <RadioGroupItem value={role.value} id={role.value} />
          <Label htmlFor={role.value} className="flex-1 cursor-pointer">
            <div className="font-medium">{role.label}</div>
            {showDescriptions && (
              <div className="text-sm text-muted-foreground">
                {role.description}
              </div>
            )}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
```

**State Management:**
- **Local state:** Form inputs, modal visibility, selected member
- **Global state (Zustand):** Current user's role, organization context
- **Server state (React Query):** Team members list, role definitions, audit logs

**Key Functions:**
```typescript
// Fetch team members
async function fetchTeamMembers({
  organizationId,
  projectId
}: {
  organizationId?: string;
  projectId?: string;
}): Promise<TeamMember[]> {
  const endpoint = projectId
    ? `/api/projects/${projectId}/members`
    : `/api/organizations/${organizationId}/members`;

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });

  if (!response.ok) throw new Error('Failed to fetch team members');
  return response.json();
}

// Invite member
async function inviteMember({
  organizationId,
  projectId,
  email,
  role
}: InviteMemberRequest): Promise<InvitationResponse> {
  const endpoint = projectId
    ? `/api/projects/${projectId}/members`
    : `/api/organizations/${organizationId}/members`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ email, role })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to invite member');
  }

  return response.json();
}

// Change member role
async function changeMemberRole({
  memberId,
  newRole
}: {
  memberId: string;
  newRole: string;
}): Promise<void> {
  const response = await fetch(`/api/members/${memberId}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ role: newRole })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to change role');
  }
}

// Remove member
async function removeMember(memberId: string): Promise<void> {
  const response = await fetch(`/api/members/${memberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove member');
  }
}
```

### Backend Implementation

**API Endpoints:**
- `POST /api/organizations/:orgId/members` - Invite member to organization
- `POST /api/projects/:projectId/members` - Add member to project
- `GET /api/organizations/:orgId/members` - List organization members
- `GET /api/projects/:projectId/members` - List project members
- `PUT /api/members/:memberId/role` - Change member's role
- `DELETE /api/members/:memberId` - Remove member from team
- `GET /api/invitations/:token` - Validate invitation token
- `POST /api/invitations/:token/accept` - Accept invitation

**Cloudflare Workers:**
- `team-management-worker.ts` - Handles all team management requests

```typescript
// team-management-worker.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { sub: userId } = await verifyJWT(token, env.JWT_SECRET);

    // Route to appropriate handler
    if (url.pathname.includes('/members') && request.method === 'POST') {
      return handleInviteMember(request, userId, env);
    }

    if (url.pathname.includes('/members') && request.method === 'GET') {
      return handleListMembers(request, userId, env);
    }

    if (url.pathname.includes('/role') && request.method === 'PUT') {
      return handleChangeRole(request, userId, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleInviteMember(
  request: Request,
  inviterId: string,
  env: Env
): Promise<Response> {
  const { email, role, organizationId, projectId } = await request.json();

  // Forward to Supabase (RLS policies will validate permissions)
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/org_members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
      'X-User-ID': inviterId
    },
    body: JSON.stringify({
      organization_id: organizationId,
      user_email: email,
      role_name: role,
      invited_by: inviterId
    })
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to invite member' }),
      { status: response.status }
    );
  }

  // Send invitation email via Supabase Auth
  // (Handled by database trigger or separate function)

  return response;
}
```

**Supabase Functions:**
- Database triggers handle invitation email sending
- RLS policies enforce permission checks

### Database Implementation

**Tables Used:**
- `organizations` - Organization definitions
- `org_members` - User-organization-role mapping
- `project_members` - User-project-role mapping (overrides org role)
- `roles` - Role definitions (Owner, Admin, Developer, Read-Only)
- `role_permissions` - Role-to-permission mapping
- `invitations` - Pending invitation records

**Key Queries:**
```sql
-- List organization members with roles
SELECT
  u.id AS user_id,
  u.email,
  u.raw_user_meta_data->>'display_name' AS name,
  r.name AS role,
  om.created_at AS joined_at,
  om.last_active_at
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
JOIN roles r ON r.id = om.role_id
WHERE om.organization_id = $1
  AND om.deleted_at IS NULL
ORDER BY r.level DESC, u.email;

-- Get user's effective role in project
SELECT get_user_project_role($1::uuid, $2::uuid) AS role_id;

-- List project members with effective roles
SELECT
  u.id AS user_id,
  u.email,
  COALESCE(
    pr.name,
    orgr.name
  ) AS effective_role,
  COALESCE(
    pr.level,
    orgr.level
  ) AS role_level,
  CASE
    WHEN pm.project_id IS NOT NULL THEN 'project'
    ELSE 'organization'
  END AS role_source
FROM auth.users u
LEFT JOIN org_members om ON om.user_id = u.id AND om.organization_id = (
  SELECT organization_id FROM projects WHERE id = $1
)
LEFT JOIN roles orgr ON orgr.id = om.role_id
LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = $1
LEFT JOIN roles pr ON pr.id = pm.role_id
WHERE (om.organization_id IS NOT NULL OR pm.project_id IS NOT NULL)
  AND u.deleted_at IS NULL
ORDER BY COALESCE(pr.level, orgr.level) DESC, u.email;
```

**RLS Policies:**
```sql
-- Only admins can invite members
CREATE POLICY "Admins can invite organization members"
ON org_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_has_org_permission(
    auth.uid(),
    organization_id,
    'can_invite_members'
  ) = TRUE
);

-- Only admins can change roles
CREATE POLICY "Admins can update member roles"
ON org_members
FOR UPDATE
TO authenticated
USING (
  user_has_org_permission(
    auth.uid(),
    organization_id,
    'can_change_member_roles'
  ) = TRUE
)
WITH CHECK (
  user_has_org_permission(
    auth.uid(),
    organization_id,
    'can_change_member_roles'
  ) = TRUE
);

-- Only admins can remove members
CREATE POLICY "Admins can remove members"
ON org_members
FOR DELETE
TO authenticated
USING (
  user_has_org_permission(
    auth.uid(),
    organization_id,
    'can_remove_members'
  ) = TRUE
);

-- Users can view members of organizations they belong to
CREATE POLICY "Users can view organization members"
ON org_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members om2
    WHERE om2.organization_id = org_members.organization_id
      AND om2.user_id = auth.uid()
  )
);
```

---

## API Contracts

### Endpoint: POST /api/organizations/:orgId/members

**Purpose:** Invite a member to an organization

**Permissions Required:** `can_invite_members`

**Request:**
```typescript
interface InviteMemberRequest {
  email: string;           // Email address to invite
  role: 'Owner' | 'Admin' | 'Developer' | 'Read-Only';
}
```

**Example Request:**
```json
POST /api/organizations/org-123/members
{
  "email": "jane@example.com",
  "role": "Developer"
}
```

**Success Response (201 Created):**
```typescript
interface InviteMemberResponse {
  invitation_id: string;
  email: string;
  role: string;
  organization_id: string;
  invited_by: string;
  invitation_sent_at: string;
  expires_at: string;
  invitation_link: string;
}
```

**Example Response:**
```json
{
  "invitation_id": "inv-456",
  "email": "jane@example.com",
  "role": "Developer",
  "organization_id": "org-123",
  "invited_by": "user-789",
  "invitation_sent_at": "2025-10-30T12:00:00Z",
  "expires_at": "2025-11-06T12:00:00Z",
  "invitation_link": "https://app.abyrith.com/invitations/token-abc"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email or role
  ```json
  {
    "error": "validation_error",
    "message": "Invalid email address",
    "details": { "email": ["must be valid email"] }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have `can_invite_members` permission
  ```json
  {
    "error": "permission_denied",
    "message": "You don't have permission to invite members",
    "required_permission": "can_invite_members",
    "your_role": "Developer"
  }
  ```
- `409 Conflict` - User already a member
  ```json
  {
    "error": "already_exists",
    "message": "jane@example.com is already a member of this organization"
  }
  ```
- `422 Unprocessable Entity` - Plan limit reached
  ```json
  {
    "error": "plan_limit_reached",
    "message": "Your plan allows 5 members. Upgrade to add more.",
    "current_count": 5,
    "plan_limit": 5
  }
  ```

**Validation Rules:**
- `email`: Required, valid email format
- `role`: Required, one of ['Owner', 'Admin', 'Developer', 'Read-Only']

---

### Endpoint: GET /api/organizations/:orgId/members

**Purpose:** List all members of an organization

**Permissions Required:** Membership in organization (any role)

**Query Parameters:**
```typescript
interface ListMembersParams {
  role?: string;            // Filter by role
  page?: number;            // Page number (default: 1)
  per_page?: number;        // Items per page (default: 20, max: 100)
  sort?: 'name' | 'role' | 'joined_at';
  order?: 'asc' | 'desc';
}
```

**Success Response (200 OK):**
```typescript
interface ListMembersResponse {
  members: OrganizationMember[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface OrganizationMember {
  user_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: string;
  role_level: number;
  joined_at: string;
  last_active_at?: string;
  invited_by?: string;
}
```

**Example Response:**
```json
{
  "members": [
    {
      "user_id": "user-123",
      "email": "owner@example.com",
      "name": "Alice Smith",
      "avatar_url": "https://example.com/avatar.jpg",
      "role": "Owner",
      "role_level": 4,
      "joined_at": "2025-01-01T00:00:00Z",
      "last_active_at": "2025-10-30T11:00:00Z"
    },
    {
      "user_id": "user-456",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "Developer",
      "role_level": 2,
      "joined_at": "2025-10-15T00:00:00Z",
      "last_active_at": "2025-10-29T15:30:00Z",
      "invited_by": "user-123"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User not a member of organization
- `404 Not Found` - Organization doesn't exist

---

### Endpoint: PUT /api/members/:memberId/role

**Purpose:** Change a member's role

**Permissions Required:** `can_change_member_roles`

**Request:**
```typescript
interface ChangeRoleRequest {
  role: 'Owner' | 'Admin' | 'Developer' | 'Read-Only';
}
```

**Example Request:**
```json
PUT /api/members/user-456/role
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
  updated_at: string;
  updated_by: string;
}
```

**Example Response:**
```json
{
  "user_id": "user-456",
  "old_role": "Developer",
  "new_role": "Admin",
  "updated_at": "2025-10-30T12:00:00Z",
  "updated_by": "user-123"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid role
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have `can_change_member_roles` permission
- `404 Not Found` - Member doesn't exist
- `409 Conflict` - Cannot change last Owner's role
  ```json
  {
    "error": "cannot_modify_last_owner",
    "message": "Cannot change the last Owner's role. Assign another Owner first."
  }
  ```

---

### Endpoint: DELETE /api/members/:memberId

**Purpose:** Remove a member from organization or project

**Permissions Required:** `can_remove_members`

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have `can_remove_members` permission
- `404 Not Found` - Member doesn't exist
- `409 Conflict` - Cannot remove last Owner
  ```json
  {
    "error": "cannot_remove_last_owner",
    "message": "Cannot remove the last Owner. Assign another Owner first."
  }
  ```

---

## Security Considerations

### Threat Model

**Potential Threats:**

**1. Privilege Escalation via Role Manipulation**
- **Description:** Attacker tries to elevate their role by manipulating API requests
- **Mitigation:**
  - RLS policies enforce permission checks at database level
  - Cannot bypass by manipulating request body or headers
  - Audit logs track all role change attempts
  - Frontend permission checks prevent UI access, but backend enforces security

**2. Unauthorized Member Addition**
- **Description:** User without invite permission tries to add members
- **Mitigation:**
  - `can_invite_members` permission required (checked by RLS)
  - JWT token validated on every request
  - Rate limiting prevents brute force attempts
  - Audit logs track invitation attempts

**3. Social Engineering via Fake Invitations**
- **Description:** Attacker sends fake invitation emails pretending to be from Abyrith
- **Mitigation:**
  - Invitation emails come from verified Supabase Auth domain
  - Invitation links contain cryptographically secure tokens
  - UI displays inviter's name and organization clearly
  - Email templates include security warnings about phishing

**4. Last Owner Lock-Out**
- **Description:** Malicious admin removes or demotes the last Owner, locking them out
- **Mitigation:**
  - Business logic prevents removing or demoting the last Owner
  - Database constraint ensures at least one Owner exists
  - Audit logs track Owner changes
  - Support team can restore Owner access if needed

**5. Mass Member Removal (Sabotage)**
- **Description:** Compromised admin account removes all team members
- **Mitigation:**
  - MFA enforced for Admin and Owner roles
  - Rate limiting on removal operations
  - Audit logs track all removals
  - "Undo" functionality for recent removals (soft delete with grace period)
  - Anomaly detection alerts for unusual bulk operations

### Security Controls

**Authentication:**
- JWT tokens from Supabase Auth (validated on every request)
- Token expiration: 1 hour (with refresh token)
- Session invalidation on role change (if permissions reduced)
- MFA required for Admin and Owner roles (post-MVP)

**Authorization:**
- RBAC model with 4 fixed roles
- Permissions evaluated at 3 layers:
  1. Frontend (UX only, hide unavailable actions)
  2. API Gateway (Workers - early validation, helpful errors)
  3. Database RLS (security boundary - cannot bypass)
- Permission checks take <50ms p95

**Data Protection:**
- Team member data not encrypted (metadata only, no sensitive data)
- Invitation tokens are cryptographically random (32 bytes)
- Invitation tokens expire after 7 days
- Email addresses visible only to organization members

**Audit Logging:**
- All team management actions logged:
  - Member invited (by whom, role assigned)
  - Member joined (accepted invitation)
  - Role changed (old role → new role, by whom)
  - Member removed (by whom, reason if provided)
  - Permission denied attempts
- Logs retained for 90 days (configurable for compliance)
- Logs immutable (append-only)

### Compliance

**GDPR:**
- Users can export their team membership data
- Users can request deletion of their account (removes from all teams)
- Invitation emails include privacy policy link
- Audit logs track data access for GDPR requests

**SOC 2:**
- Comprehensive audit trail of all access changes
- Role-based access control enforced
- Least privilege principle applied
- Access reviews supported via "Team Access" dashboard

---

## Performance Requirements

### Performance Targets

- **List Team Members:** < 200ms p95 (up to 100 members)
- **Invite Member:** < 500ms p95 (including email send)
- **Change Role:** < 300ms p95 (includes audit log)
- **Remove Member:** < 300ms p95
- **Permission Check:** < 50ms p95 (cached)

### Optimization Strategy

**Frontend:**
- React Query caching for member lists (5-minute TTL)
- Optimistic updates for role changes (instant UI feedback)
- Pagination for large teams (20 members per page)
- Virtual scrolling for very large teams (1000+ members)

**Backend:**
- Role lookups cached in Workers KV (5-minute TTL)
- Database indexes on `org_members(user_id, organization_id)`
- Connection pooling via Supabase PgBouncer
- Batch invitation API for bulk invites (post-MVP)

**Database:**
- Indexes on foreign keys and query filters
- Materialized view for team access reports (refreshed hourly)
- Partitioning for audit logs (by month)

### Load Handling

**Expected Load:**
- Small teams (1-10 members): 90% of organizations
- Medium teams (11-50 members): 8% of organizations
- Large teams (51-200 members): 2% of organizations
- Enterprise (200+ members): <1% of organizations

**Scalability:**
- Supabase handles up to 1,500 concurrent connections
- Cloudflare Workers auto-scale horizontally
- No bottlenecks expected for MVP scale

---

## Testing Strategy

### Unit Tests

**Frontend:**
- `TeamList` component renders members correctly
- `InviteMemberModal` validates email and role
- `RoleSelector` displays role descriptions
- Permission hooks (`useCanPerform`) return correct values
- Coverage: 80%+

**Backend:**
- Invitation email generation
- Permission evaluation logic
- Role validation
- Audit log creation
- Coverage: 90%+

### Integration Tests

**Test Scenarios:**
1. **Invite member flow:**
   - Owner invites Developer
   - Invitation email sent
   - Invitee accepts and joins
   - Verify invitee has correct permissions

2. **Role change flow:**
   - Admin changes Developer to Read-Only
   - Permissions update immediately
   - Audit log records change
   - Invitee receives notification email

3. **Remove member flow:**
   - Admin removes member
   - Member loses access immediately
   - Member cannot view organization in dashboard
   - Audit log records removal

4. **Permission inheritance:**
   - User has Admin role in org
   - User accesses project (should have Admin permissions)
   - User's role overridden to Developer in specific project
   - Verify project-specific role takes effect

### End-to-End Tests

**E2E Flows (Playwright):**
1. Complete invitation acceptance flow (email → sign-up → join team)
2. Owner invites member, member accepts, member accesses secrets
3. Admin changes roles, verify UI updates and permissions change
4. Remove member, verify they cannot access resources
5. Last Owner protection (cannot remove/demote last Owner)

### Security Tests

**Security Test Cases:**
1. **Privilege escalation:** Developer cannot invite members
2. **Unauthorized access:** Non-member cannot view team list
3. **Token validation:** Expired invitation tokens rejected
4. **Role manipulation:** Cannot elevate role via API manipulation
5. **Last Owner protection:** Database constraint prevents removing last Owner
6. **Audit logging:** All actions properly logged

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/rbac/permissions-model.md` - Permission and role definitions
- [x] `04-database/schemas/users-organizations.md` - Database schema for users and orgs
- [x] `05-api/endpoints/projects-endpoints.md` - Project API structure
- [x] `03-security/auth/authentication-flow.md` - JWT authentication
- [x] `GLOSSARY.md` - Role and permission terminology

**External Services:**
- Supabase Auth - Invitation emails, user authentication
- Supabase PostgreSQL - Data storage, RLS enforcement
- Cloudflare Workers - API gateway, rate limiting

### Feature Dependencies

**Depends on these features:**
- User authentication (login, JWT tokens)
- Organization creation (must have org before inviting members)
- Project management (for project-level member assignment)

**Enables these features:**
- Team collaboration on secrets
- Audit logs (tracks team actions)
- Approval workflows (requires Admin approval, post-MVP)
- Usage tracking by team member (post-MVP)

---

## References

### Internal Documentation
- `03-security/rbac/permissions-model.md` - Complete RBAC architecture
- `03-security/rbac/role-definitions.md` - Detailed role descriptions
- `03-security/rbac/rls-policies.md` - Database RLS policy implementations
- `04-database/schemas/users-organizations.md` - Users and organizations schema
- `05-api/endpoints/projects-endpoints.md` - Project API endpoints
- `07-frontend/frontend-architecture.md` - Frontend structure and patterns
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Terminology definitions

### External Resources
- [Supabase Auth - Inviting Users](https://supabase.com/docs/guides/auth/managing-user-data) - Invitation patterns
- [PostgreSQL RLS](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - Row-Level Security
- [OWASP RBAC](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) - Authorization best practices
- [NIST RBAC Standard](https://csrc.nist.gov/projects/role-based-access-control) - RBAC specifications

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Documentation Agent | Initial team management feature documentation |

---

## Notes

### Future Enhancements
- **Bulk invitations:** Upload CSV of emails to invite many members at once
- **Custom roles:** Organizations define their own roles with specific permissions
- **Team groups:** Create groups (e.g., "Backend Team") and assign permissions to groups
- **Temporary access:** Grant time-limited access (e.g., "contractor access for 3 months")
- **Approval workflows:** Require approval before sensitive role changes (e.g., promoting to Owner)
- **SSO integration:** SAML/OAuth for enterprise authentication
- **SCIM provisioning:** Automatic user sync from identity providers
- **Advanced audit:** Filter audit logs by member, action type, date range
- **Access reviews:** Scheduled reminders to review team access
- **Onboarding workflows:** Custom onboarding checklists for new members

### Known Issues
- No bulk operations in MVP (must invite/remove one at a time)
- No "pending invitations" view for invitees (must check email)
- Cannot revoke invitation after sending (must wait for expiration)
- No notification when role is changed (email notification post-MVP)
- Project-specific role overrides may confuse users (need clear UI indication)
