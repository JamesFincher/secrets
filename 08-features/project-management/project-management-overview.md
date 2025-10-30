---
Document: Project Management - Feature Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 05-api/endpoints/projects-endpoints.md, 04-database/schemas/secrets-metadata.md, 02-architecture/system-overview.md, GLOSSARY.md
---

# Project Management Feature

## Overview

Project Management is a **critical MVP feature** that provides the organizational foundation for all secrets in Abyrith. It enables users to group secrets logically by application (e.g., "RecipeApp", "ClientWebsite") and isolate them by deployment environment (development, staging, production), preventing accidental use of production credentials in testing environments.

**Purpose:** Provide structured organization for secrets that scales from a single developer with one project to enterprises managing hundreds of projects across multiple teams.

**Target Users:** All user personas—from The Learner managing their first tutorial project to Enterprise teams coordinating across dozens of applications.

**Priority:** P0 - MVP (This is foundational; secrets cannot exist without projects)

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

**For Beginners (The Learner):**
When following a tutorial that says "add your API key," beginners first create a project (e.g., "My First App") and then add their secret to it. The project acts as a container that gives context to where the secret is used.

**For Solo Developers:**
Solo developers organize secrets by application. For example:
- Project: "RecipeApp" → OpenAI key, Supabase URL, Stripe test key
- Project: "ClientWebsite" → Google Maps key, Cloudinary key

**For Development Teams:**
Teams use projects as collaboration units. Each project has its own team members with specific roles, and secrets are organized by environment (dev/staging/prod) to prevent production credential leaks.

**For Enterprises:**
Enterprises manage dozens or hundreds of projects, each representing a different application or microservice, with complex permission structures and approval workflows for production access.

### Key Capabilities

**Project Organization:**
- Create unlimited projects
- Name projects descriptively ("RecipeApp", "ClientWebsite", "PaymentService")
- Add optional descriptions explaining the project's purpose
- Archive projects when no longer active (soft delete)

**Environment Management:**
- Each project has multiple environments (dev, staging, production)
- Custom environments supported (e.g., "qa", "demo", "client-preview")
- Environment-specific secrets (different API keys per environment)
- Visual color coding for quick environment identification

**Project Settings:**
- Default environment selection
- Approval workflow configuration (require approval for production access)
- Team member permissions
- Project metadata (tags, notes, documentation links)

**Secret Organization Within Projects:**
- Secrets automatically organized by project and environment
- View all secrets for a project across environments
- Compare secrets between environments (e.g., which keys exist in dev but not prod)
- Bulk operations (archive all dev keys, rotate all production keys)

### User Benefits

**For Learners (Beginners):**
- **Clarity:** Projects give context to secrets ("This OpenAI key is for my Recipe App")
- **Safety:** Development keys separated from production (prevents costly mistakes)
- **Organization:** Even with one project, they learn good organizational habits
- **Confidence:** Clear structure makes secrets less intimidating

**For Solo Developers:**
- **Fast Access:** Quickly switch between projects to find the right secret
- **Clean Separation:** Work on multiple projects without key confusion
- **Environment Safety:** Test with dev keys, deploy with prod keys (never mix)
- **Scalability:** Structure supports growth from 1 to 100 projects

**For Development Teams:**
- **Collaboration:** Share entire projects with teammates (not individual secrets)
- **Role-Based Access:** Different team members have different permissions per project
- **Audit Trail:** See all changes to a project (who added/modified secrets)
- **Onboarding:** New team members invited to specific projects, get immediate access

**For Enterprise:**
- **Multi-Team Management:** Different teams manage different projects independently
- **Compliance:** Project-level audit logs for SOC 2, ISO 27001
- **Approval Workflows:** Require approval for production secret access
- **Governance:** Enforce naming conventions, tagging, and metadata standards

### Example Scenarios

**Scenario 1: Beginner's First Project**

```
Sarah is learning to code and following an OpenAI tutorial.

Step 1: Create Account in Abyrith
→ She signs up and is prompted: "Create your first project"

Step 2: Create Project
→ Name: "ChatGPT Tutorial"
→ Description: "Learning how to use OpenAI API"
→ Environment: "Development" (auto-created)

Step 3: Add First Secret
→ AI Assistant: "I see you're working on ChatGPT Tutorial. Let me help you get an OpenAI API key."
→ Sarah follows guided steps, gets key
→ Secret stored in "ChatGPT Tutorial" → Development

Step 4: Tutorial Works!
→ She can see exactly where her key is used
→ If she starts another tutorial, she creates a new project
```

**Scenario 2: Solo Developer with Multiple Apps**

```
Alex is a freelance developer juggling client projects.

Current Projects:
📁 RecipeApp
  └─ 🌍 Development (10 secrets)
  └─ 🚀 Production (8 secrets)

📁 ClientWebsite
  └─ 🌍 Development (5 secrets)
  └─ 🚀 Production (5 secrets)

📁 PersonalBlog
  └─ 🌍 Development (3 secrets)

Workflow:
→ Working on RecipeApp → Switches to that project
→ Sees only RecipeApp secrets (no clutter)
→ Deploys → Uses production keys automatically
→ Switches to ClientWebsite → Different set of secrets
```

**Scenario 3: Team Collaboration**

```
DevTeam is building a SaaS product with 12 developers.

Project: "CustomerPortal"
Team Members:
→ Sarah (Owner) - Full control
→ John (Admin) - Manage secrets and team
→ 8 Developers - Read/write secrets
→ 2 Designers (Read-Only) - See secret names but can't decrypt

Environments:
→ Development (25 secrets) - All developers access
→ Staging (20 secrets) - Developers access
→ Production (18 secrets) - Requires approval from Owner/Admin

Workflow:
→ New developer joins → Invited to "CustomerPortal" project
→ Automatically gets dev/staging access
→ When needs production key → Requests approval
→ Sarah approves → Developer gets 24-hour access
→ Audit log records everything
```

**Scenario 4: Enterprise with Many Projects**

```
TechCorp has 150 projects across 20 teams.

Organization: "TechCorp"
Projects:
→ PaymentService (FinanceTeam) - 45 secrets
→ AuthService (SecurityTeam) - 30 secrets
→ AnalyticsDashboard (DataTeam) - 60 secrets
→ MobileApp-iOS (MobileTeam) - 40 secrets
→ MobileApp-Android (MobileTeam) - 40 secrets
→ ... 145 more

Features Used:
→ SSO (Google Workspace) for all employees
→ Project templates for consistent structure
→ Approval workflows enforced for all production access
→ Compliance reports generated per project
→ Automated key rotation policies per project
```

---

## Technical Architecture

### System Components

**Components involved:**
- **Frontend:** React components for project management UI, Zustand for state, React Query for server state
- **Backend:** Cloudflare Workers for API gateway and rate limiting
- **Database:** PostgreSQL (Supabase) with `projects`, `environments`, `secrets` tables
- **External Services:** None (core feature, no external dependencies)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ProjectList  │  │ ProjectCard  │  │ CreateProject│      │
│  │  Component   │  │  Component   │  │    Modal     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ EnvSelector  │  │ ProjectSettings│ │ ArchiveProject│     │
│  │  Component   │  │    Panel     │  │    Dialog    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────┬───────────────────────────────────────────────┘
              │ API Calls (React Query)
              ▼
┌─────────────────────────────────────────────────────────────┐
│                  State Management Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Zustand Store (Client State)                        │   │
│  │  • Selected project ID                               │   │
│  │  • Selected environment ID                           │   │
│  │  • Project list filter/sort preferences              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React Query Cache (Server State)                    │   │
│  │  • Projects list (cached, auto-refetch)              │   │
│  │  • Project details (cached per project)              │   │
│  │  • Environments list (cached per project)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────┬───────────────────────────────────────────────┘
              │ HTTPS/REST
              ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (API Gateway)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/projects                                       │   │
│  │  • GET    → List projects (filtered by org)         │   │
│  │  • POST   → Create project                          │   │
│  │                                                      │   │
│  │  /api/projects/:id                                  │   │
│  │  • GET    → Get project details                     │   │
│  │  • PUT    → Update project                          │   │
│  │  • DELETE → Archive project                         │   │
│  │                                                      │   │
│  │  /api/projects/:id/environments                     │   │
│  │  • GET    → List environments                       │   │
│  │  • POST   → Create environment                      │   │
│  │  • PUT    → Update environment                      │   │
│  │  • DELETE → Delete environment                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware                                          │   │
│  │  • JWT validation (auth.uid() extraction)           │   │
│  │  • Rate limiting (per user, per org)                │   │
│  │  • Request validation (Zod schemas)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────┬───────────────────────────────────────────────┘
              │ PostgreSQL Wire Protocol
              ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase (Database + RLS)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Projects Table                                      │   │
│  │  • id, organization_id, name, description            │   │
│  │  • settings (JSONB), archived, timestamps            │   │
│  │  • RLS: Users see only their org's projects         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Environments Table                                  │   │
│  │  • id, project_id, name, type, description           │   │
│  │  • color, sort_order, timestamps                     │   │
│  │  • RLS: Users see only accessible projects' envs    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Secrets Table (linked to projects/environments)    │   │
│  │  • project_id, environment_id, encrypted_value       │   │
│  │  • RLS enforces project-level access                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Interactions

**Frontend ↔ API Layer:**
- Protocol: HTTPS/REST
- Data format: JSON
- Authentication: JWT Bearer token in Authorization header
- Caching: React Query handles caching, stale-while-revalidate pattern

**API Layer ↔ Database:**
- Protocol: PostgreSQL wire protocol (via Supabase client)
- Data format: SQL queries with JSON responses
- Authentication: Service role key (API layer has elevated permissions, RLS still enforced based on JWT user ID)

### Data Flow

1. **User Action:** User clicks "Create Project"
2. **Frontend Processing:** Modal opens, form validation with Zod schema
3. **API Call:** POST /api/projects with project data
4. **Backend Processing:**
   - Cloudflare Worker validates JWT
   - Checks rate limits
   - Validates request body
   - Calls Supabase client
5. **Database Interaction:**
   - INSERT into projects table
   - RLS policy checks organization membership
   - Auto-creates default "Development" environment
6. **Response:** Returns created project with environment details
7. **Frontend Update:** React Query updates cache, UI reflects new project

---

## User Flows

### Flow 1: Create New Project

**Trigger:** User clicks "New Project" button

**Steps:**
1. User clicks "New Project"
2. System shows create project modal
3. User enters:
   - Project name (required, max 255 chars)
   - Description (optional)
   - Initial environment type (default: "development")
4. User clicks "Create"
5. System validates input:
   - Name not empty
   - Name unique within organization
   - Description < 1000 chars
6. System creates project:
   - Inserts project record
   - Auto-creates default environment
   - Sets created_by to current user
7. System returns success
8. UI shows new project in list
9. User automatically switched to new project

**Success Criteria:** Project appears in list, user can immediately add secrets to it

**Error Cases:**
- **Duplicate name:** "A project named 'RecipeApp' already exists. Choose a different name."
- **Network error:** "Failed to create project. Check your connection and try again."
- **Permission error:** "You don't have permission to create projects. Contact your organization owner."

---

### Flow 2: Add Environment to Project

**Trigger:** User clicks "Add Environment" in project settings

**Steps:**
1. User navigates to project
2. User clicks "Settings" → "Environments" tab
3. User clicks "Add Environment"
4. System shows environment modal
5. User enters:
   - Environment name (required, e.g., "QA", "Client-Preview")
   - Environment type (development/staging/production/custom)
   - Description (optional)
   - Color (optional, hex code for UI)
   - Sort order (optional, default: last)
6. User clicks "Create Environment"
7. System validates:
   - Name unique within project
   - Type is valid enum value
   - Color is valid hex code (if provided)
8. System creates environment
9. UI adds environment to selector
10. User can now add secrets to this environment

**Success Criteria:** New environment appears in environment selector

**Error Cases:**
- **Duplicate name:** "Environment 'QA' already exists in this project."
- **Invalid color:** "Color must be a valid hex code (e.g., #FF5733)."
- **Max environments reached (if limit exists):** "Maximum 10 environments per project. Archive unused environments."

---

### Flow 3: Archive Project

**Trigger:** User clicks "Archive" in project settings

**Steps:**
1. User navigates to project settings
2. User clicks "Archive Project"
3. System shows confirmation dialog:
   - "Archive 'RecipeApp'?"
   - "Secrets will be hidden but not deleted."
   - "You can restore this project later."
4. User confirms
5. System validates:
   - User has Owner or Admin role
   - Project is not already archived
6. System updates project:
   - Sets archived = true
   - Updates updated_at timestamp
   - Logs audit event
7. System returns success
8. UI removes project from active list
9. UI shows success message: "Project archived. View archived projects in settings."

**Success Criteria:** Project no longer visible in main list, can be restored from archive

**Error Cases:**
- **Permission denied:** "Only Owners and Admins can archive projects."
- **Already archived:** "This project is already archived."
- **Has active secrets with approval workflows:** "Cannot archive project with pending approvals. Resolve all approvals first."

---

### Flow 4: Switch Between Projects

**Trigger:** User selects different project from dropdown

**Steps:**
1. User clicks project selector dropdown
2. System shows list of accessible projects (sorted alphabetically)
3. User clicks desired project
4. System updates selected project in Zustand store
5. System triggers refetch of secrets for new project
6. UI updates:
   - Project name in header
   - Environment selector shows new project's environments
   - Secrets list shows new project's secrets
   - Breadcrumb updates
7. URL updates: /projects/:project-id

**Success Criteria:** User sees correct project's secrets and environments

**Error Cases:**
- **Project access revoked:** "You no longer have access to this project."
- **Network error:** "Failed to load project. Retrying..."

---

### Flow 5: Update Project Settings

**Trigger:** User clicks "Settings" in project view

**Steps:**
1. User navigates to project settings
2. System displays settings panel:
   - **General:** Name, description
   - **Environments:** List of environments (add/edit/delete)
   - **Team:** Team members and roles (if team feature enabled)
   - **Advanced:** Default environment, approval workflows, archive
3. User modifies settings
4. User clicks "Save Changes"
5. System validates changes:
   - Name unique (if changed)
   - Settings JSON valid
6. System updates project
7. System logs audit event
8. UI shows success: "Project settings updated"

**Success Criteria:** Settings persist, visible to all team members

**Error Cases:**
- **Validation error:** "Project name cannot be empty."
- **Permission error:** "Only Admins and Owners can change project settings."
- **Concurrent edit:** "Project was modified by another user. Refresh and try again."

---

## Technical Implementation

### Frontend Implementation

**Components:**

**1. `ProjectSelector.tsx`** - Dropdown for switching projects
```typescript
interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}

// Features:
// - Shows list of user's projects
// - Highlights currently selected project
// - Search/filter for many projects
// - Keyboard navigation (arrow keys, Enter)
// - Shows project icon/color
```

**2. `ProjectCard.tsx`** - Visual card showing project overview
```typescript
interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
  onArchive: () => void;
}

// Displays:
// - Project name and description
// - Number of secrets per environment
// - Last modified timestamp
// - Quick actions (edit, archive)
// - Team member avatars (if team feature)
```

**3. `CreateProjectModal.tsx`** - Modal for creating new projects
```typescript
interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

// Features:
// - Form with name, description fields
// - Real-time validation
// - Loading state during creation
// - Error display
// - Auto-focus on name field
```

**4. `ProjectSettingsPanel.tsx`** - Settings panel for project configuration
```typescript
interface ProjectSettingsPanelProps {
  projectId: string;
}

// Tabs:
// - General (name, description)
// - Environments (add/edit/delete)
// - Team (members, roles) - future
// - Advanced (archive, danger zone)
```

**5. `EnvironmentSelector.tsx`** - Dropdown for switching environments
```typescript
interface EnvironmentSelectorProps {
  projectId: string;
  selectedEnvironmentId: string | null;
  onSelectEnvironment: (envId: string) => void;
}

// Features:
// - Color-coded environment badges
// - Environment type icons
// - Keyboard navigation
```

**6. `EnvironmentManager.tsx`** - Manage project environments
```typescript
interface EnvironmentManagerProps {
  projectId: string;
}

// Features:
// - List all environments
// - Add new environment
// - Edit environment (name, color, order)
// - Delete environment (with confirmation)
// - Drag-to-reorder environments
```

---

**State Management:**

**Local State (React useState):**
- Form input values (name, description)
- Modal open/close state
- Loading indicators
- Validation errors

**Global State (Zustand):**
```typescript
interface ProjectStore {
  // Selected project/environment
  selectedProjectId: string | null;
  selectedEnvironmentId: string | null;

  // UI preferences
  projectListView: 'grid' | 'list';
  projectSortBy: 'name' | 'updated' | 'created';

  // Actions
  setSelectedProject: (id: string) => void;
  setSelectedEnvironment: (id: string) => void;
  setProjectListView: (view: 'grid' | 'list') => void;
}
```

**Server State (React Query):**
```typescript
// Query keys
const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (orgId: string) => [...projectKeys.lists(), orgId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  environments: (projectId: string) => [...projectKeys.all, projectId, 'environments'] as const,
}

// Queries
const useProjects = (orgId: string) => {
  return useQuery({
    queryKey: projectKeys.list(orgId),
    queryFn: () => fetchProjects(orgId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

const useProject = (projectId: string) => {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: !!projectId,
  })
}

const useEnvironments = (projectId: string) => {
  return useQuery({
    queryKey: projectKeys.environments(projectId),
    queryFn: () => fetchEnvironments(projectId),
    enabled: !!projectId,
  })
}

// Mutations
const useCreateProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProjectInput) => createProject(data),
    onSuccess: (newProject) => {
      // Optimistic update
      queryClient.setQueryData(
        projectKeys.list(newProject.organization_id),
        (old: Project[]) => [...old, newProject]
      )
    },
  })
}
```

---

**Key Functions:**

```typescript
// Fetch projects for organization
async function fetchProjects(orgId: string): Promise<Project[]> {
  const response = await fetch(`/api/projects?org_id=${orgId}`, {
    headers: {
      'Authorization': `Bearer ${getJWT()}`,
    },
  })

  if (!response.ok) throw new Error('Failed to fetch projects')

  return response.json()
}

// Create new project
async function createProject(data: CreateProjectInput): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getJWT()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }

  return response.json()
}

// Update project
async function updateProject(id: string, data: UpdateProjectInput): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getJWT()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) throw new Error('Failed to update project')

  return response.json()
}

// Archive project (soft delete)
async function archiveProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getJWT()}`,
    },
  })

  if (!response.ok) throw new Error('Failed to archive project')
}
```

---

### Backend Implementation

**API Endpoints:**

All endpoints are implemented as Cloudflare Workers.

**`GET /api/projects`** - List projects
- **Purpose:** Get all projects user has access to
- **Query Params:** `org_id` (optional, defaults to user's current org)
- **Response:** Array of Project objects
- **RLS:** Returns only projects user's org

**`POST /api/projects`** - Create project
- **Purpose:** Create new project
- **Body:** `{ name, description?, settings? }`
- **Response:** Created Project object
- **Side Effects:** Auto-creates "Development" environment

**`GET /api/projects/:id`** - Get project details
- **Purpose:** Get single project with all metadata
- **Response:** Project object with environments array
- **RLS:** Only if user belongs to project's org

**`PUT /api/projects/:id`** - Update project
- **Purpose:** Update project name, description, settings
- **Body:** `{ name?, description?, settings? }`
- **Response:** Updated Project object
- **Permissions:** Requires Owner or Admin role

**`DELETE /api/projects/:id`** - Archive project
- **Purpose:** Soft delete (set archived = true)
- **Response:** 204 No Content
- **Permissions:** Requires Owner role
- **Side Effects:** Secrets remain but hidden from main view

**`GET /api/projects/:id/environments`** - List environments
- **Purpose:** Get all environments for a project
- **Response:** Array of Environment objects
- **RLS:** Only if user has access to project

**`POST /api/projects/:id/environments`** - Create environment
- **Purpose:** Add new environment to project
- **Body:** `{ name, type, description?, color?, sort_order? }`
- **Response:** Created Environment object
- **Permissions:** Requires Owner or Admin role

**`PUT /api/environments/:id`** - Update environment
- **Purpose:** Update environment details
- **Body:** `{ name?, type?, description?, color?, sort_order? }`
- **Response:** Updated Environment object

**`DELETE /api/environments/:id`** - Delete environment
- **Purpose:** Delete environment (hard delete)
- **Response:** 204 No Content
- **Validation:** Cannot delete if secrets exist in this environment

---

**Cloudflare Worker Implementation:**

```typescript
// /api/projects endpoint handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // Extract JWT from Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const jwt = authHeader.substring(7)
    const userId = await validateJWT(jwt, env.SUPABASE_JWT_SECRET)

    if (!userId) {
      return new Response('Invalid token', { status: 401 })
    }

    // Rate limiting
    const rateLimitKey = `ratelimit:${userId}`
    const count = await env.KV.get(rateLimitKey)
    if (count && parseInt(count) > 100) {
      return new Response('Rate limit exceeded', { status: 429 })
    }
    await env.KV.put(rateLimitKey, (parseInt(count || '0') + 1).toString(), {
      expirationTtl: 60, // 1 minute
    })

    // Route to handlers
    if (path === '/api/projects' && method === 'GET') {
      return handleListProjects(request, userId, env)
    }

    if (path === '/api/projects' && method === 'POST') {
      return handleCreateProject(request, userId, env)
    }

    if (path.match(/^\/api\/projects\/[^/]+$/) && method === 'GET') {
      const projectId = path.split('/').pop()!
      return handleGetProject(projectId, userId, env)
    }

    if (path.match(/^\/api\/projects\/[^/]+$/) && method === 'PUT') {
      const projectId = path.split('/').pop()!
      return handleUpdateProject(projectId, request, userId, env)
    }

    if (path.match(/^\/api\/projects\/[^/]+$/) && method === 'DELETE') {
      const projectId = path.split('/').pop()!
      return handleArchiveProject(projectId, userId, env)
    }

    return new Response('Not found', { status: 404 })
  }
}

// Handler: List projects
async function handleListProjects(
  request: Request,
  userId: string,
  env: Env
): Promise<Response> {
  const url = new URL(request.url)
  const orgId = url.searchParams.get('org_id')

  if (!orgId) {
    return new Response('org_id required', { status: 400 })
  }

  // Query Supabase (RLS automatically filters)
  const { data, error } = await env.SUPABASE
    .from('projects')
    .select('*')
    .eq('organization_id', orgId)
    .eq('archived', false)
    .order('name', { ascending: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Handler: Create project
async function handleCreateProject(
  request: Request,
  userId: string,
  env: Env
): Promise<Response> {
  const body = await request.json()

  // Validate with Zod
  const CreateProjectSchema = z.object({
    organization_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    settings: z.record(z.any()).optional(),
  })

  const validated = CreateProjectSchema.safeParse(body)
  if (!validated.success) {
    return new Response(JSON.stringify({ error: validated.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check user has permission (Owner or Admin in org)
  const { data: membership } = await env.SUPABASE
    .from('organization_members')
    .select('role')
    .eq('organization_id', validated.data.organization_id)
    .eq('user_id', userId)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return new Response('Insufficient permissions', { status: 403 })
  }

  // Create project
  const { data: project, error: projectError } = await env.SUPABASE
    .from('projects')
    .insert({
      ...validated.data,
      created_by: userId,
    })
    .select()
    .single()

  if (projectError) {
    return new Response(JSON.stringify({ error: projectError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Auto-create "Development" environment
  const { error: envError } = await env.SUPABASE
    .from('environments')
    .insert({
      project_id: project.id,
      name: 'Development',
      type: 'development',
      sort_order: 0,
    })

  if (envError) {
    // Rollback project creation
    await env.SUPABASE.from('projects').delete().eq('id', project.id)

    return new Response(JSON.stringify({ error: 'Failed to create environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(project), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

---

### Database Implementation

**Tables Used:**

- **`projects`** - Stores project metadata
  - Primary key: `id` (UUID)
  - Foreign key: `organization_id` → organizations.id
  - Columns: name, description, settings (JSONB), archived, timestamps
  - Unique constraint: (organization_id, name)

- **`environments`** - Stores environment definitions per project
  - Primary key: `id` (UUID)
  - Foreign key: `project_id` → projects.id
  - Columns: name, type (enum), description, color, sort_order, timestamps
  - Unique constraint: (project_id, name)

- **`secrets`** - Secrets are linked to both project and environment
  - Foreign keys: `project_id`, `environment_id`
  - RLS enforces project-level access

**Key Queries:**

```sql
-- Get all projects for organization (RLS auto-filters)
SELECT * FROM projects
WHERE organization_id = $1
  AND archived = false
ORDER BY name ASC;

-- Get project with environments
SELECT
  p.*,
  json_agg(
    json_build_object(
      'id', e.id,
      'name', e.name,
      'type', e.type,
      'color', e.color,
      'sort_order', e.sort_order
    ) ORDER BY e.sort_order
  ) AS environments
FROM projects p
LEFT JOIN environments e ON e.project_id = p.id
WHERE p.id = $1
GROUP BY p.id;

-- Get secret count per environment for a project
SELECT
  e.id,
  e.name,
  e.type,
  COUNT(s.id) AS secret_count
FROM environments e
LEFT JOIN secrets s ON s.environment_id = e.id
WHERE e.project_id = $1
GROUP BY e.id, e.name, e.type
ORDER BY e.sort_order;
```

**RLS Policies:**

See `/Users/james/code/secrets/04-database/schemas/secrets-metadata.md` for complete RLS policy definitions.

Key policies:
- `projects_select_policy` - Users can view projects in their organization
- `projects_insert_policy` - Owners and Admins can create projects
- `projects_update_policy` - Owners and Admins can update projects
- `projects_delete_policy` - Only Owners can archive projects
- `environments_select_policy` - Users can view environments for accessible projects
- `environments_modify_policy` - Owners and Admins can manage environments

---

## API Contracts

### Endpoint: POST /api/projects

**Purpose:** Create a new project

**Request:**
```typescript
interface CreateProjectRequest {
  organization_id: string;  // UUID of organization
  name: string;             // 1-255 characters, unique per org
  description?: string;     // Optional, max 1000 characters
  settings?: Record<string, any>; // Optional JSONB
}
```

**Example Request:**
```json
POST /api/projects
{
  "organization_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "RecipeApp",
  "description": "Recipe sharing application for food enthusiasts",
  "settings": {
    "default_environment": "development",
    "require_approval_for_production": false
  }
}
```

**Success Response (201 Created):**
```typescript
interface CreateProjectResponse {
  id: string;                 // UUID
  organization_id: string;
  name: string;
  description: string | null;
  settings: Record<string, any>;
  archived: boolean;
  created_at: string;         // ISO 8601 timestamp
  updated_at: string;
  created_by: string;         // User UUID
}
```

**Example Response:**
```json
{
  "id": "789e4567-e89b-12d3-a456-426614174999",
  "organization_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "RecipeApp",
  "description": "Recipe sharing application for food enthusiasts",
  "settings": {
    "default_environment": "development",
    "require_approval_for_production": false
  },
  "archived": false,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z",
  "created_by": "456e4567-e89b-12d3-a456-426614174111"
}
```

**Error Responses:**

- **400 Bad Request** - Invalid input data
  ```json
  {
    "error": "validation_error",
    "message": "Name is required and must be 1-255 characters",
    "details": { "name": ["String must contain at least 1 character(s)"] }
  }
  ```

- **401 Unauthorized** - Missing or invalid JWT token
- **403 Forbidden** - User lacks permission to create projects (not Owner or Admin)
  ```json
  {
    "error": "forbidden",
    "message": "Only Owners and Admins can create projects"
  }
  ```

- **409 Conflict** - Project with same name already exists
  ```json
  {
    "error": "conflict",
    "message": "A project named 'RecipeApp' already exists in this organization"
  }
  ```

- **500 Internal Server Error** - Server error

**Validation Rules:**
- `organization_id`: Required, must be valid UUID, user must be member
- `name`: Required, 1-255 characters, unique per organization
- `description`: Optional, max 1000 characters
- `settings`: Optional, valid JSON object

---

### Endpoint: GET /api/projects

**Purpose:** List all projects user has access to

**Query Parameters:**
```typescript
interface ListProjectsParams {
  org_id: string;           // Required, organization UUID
  archived?: boolean;       // Optional, include archived (default: false)
}
```

**Example Request:**
```
GET /api/projects?org_id=123e4567-e89b-12d3-a456-426614174000
```

**Success Response (200 OK):**
```typescript
interface ListProjectsResponse {
  data: Project[];
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "789e4567-e89b-12d3-a456-426614174999",
      "organization_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "RecipeApp",
      "description": "Recipe sharing application",
      "settings": {},
      "archived": false,
      "created_at": "2025-10-30T12:00:00Z",
      "updated_at": "2025-10-30T12:00:00Z",
      "created_by": "456e4567-e89b-12d3-a456-426614174111"
    },
    {
      "id": "999e4567-e89b-12d3-a456-426614174888",
      "organization_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "ClientWebsite",
      "description": null,
      "settings": {},
      "archived": false,
      "created_at": "2025-10-29T10:00:00Z",
      "updated_at": "2025-10-29T10:00:00Z",
      "created_by": "456e4567-e89b-12d3-a456-426614174111"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Missing org_id parameter
- `401 Unauthorized` - Invalid JWT
- `500 Internal Server Error` - Server error

---

### Endpoint: PUT /api/projects/:id

**Purpose:** Update project metadata

**Request:**
```typescript
interface UpdateProjectRequest {
  name?: string;
  description?: string;
  settings?: Record<string, any>;
}
```

**Example Request:**
```json
PUT /api/projects/789e4567-e89b-12d3-a456-426614174999
{
  "name": "RecipeApp Pro",
  "settings": {
    "require_approval_for_production": true
  }
}
```

**Success Response (200 OK):**
Returns updated Project object (same structure as create response)

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid JWT
- `403 Forbidden` - User lacks permission (not Owner or Admin)
- `404 Not Found` - Project doesn't exist
- `409 Conflict` - Name conflict with another project
- `500 Internal Server Error` - Server error

---

### Endpoint: DELETE /api/projects/:id

**Purpose:** Archive project (soft delete)

**Path Parameters:**
- `id` (string, required) - Project UUID

**Success Response (204 No Content):**
Empty response body

**Error Responses:**
- `401 Unauthorized` - Invalid JWT
- `403 Forbidden` - User lacks permission (not Owner)
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Server error

---

## Security Considerations

### Threat Model

**Potential Threats:**

1. **Unauthorized Project Access**
   - **Description:** User tries to access projects they don't belong to
   - **Mitigation:** Row-Level Security (RLS) policies on `projects` table enforce organization membership. Every query automatically filtered by user's organization membership via `auth.uid()`.

2. **Project Name Enumeration**
   - **Description:** Attacker tries to guess project names to discover what companies use
   - **Mitigation:** UUIDs for project IDs (not sequential integers). API returns 404 for non-existent projects (same as unauthorized), preventing enumeration.

3. **Privilege Escalation (Create/Delete)**
   - **Description:** Regular user tries to create or delete projects
   - **Mitigation:** Backend validates user role before allowing create (Owner/Admin) or delete (Owner only). RLS enforces at database level as secondary defense.

4. **Mass Project Creation (DoS)**
   - **Description:** Attacker creates thousands of projects to exhaust resources
   - **Mitigation:** Rate limiting at Cloudflare Workers level (100 requests/minute per user). Consider per-org project limit (e.g., 100 projects per org on free tier).

5. **SQL Injection**
   - **Description:** Malicious input in project name/description attempts SQL injection
   - **Mitigation:** Supabase client uses parameterized queries (no string concatenation). Zod validation sanitizes input before database insertion.

### Security Controls

**Authentication:**
- All endpoints require valid JWT in `Authorization: Bearer <token>` header
- JWT validated using Supabase JWT secret
- JWT contains user ID (`sub` claim) used for RLS filtering

**Authorization:**
- **Project Creation:** Requires `owner` or `admin` role in organization
- **Project Update:** Requires `owner` or `admin` role in organization
- **Project Archive:** Requires `owner` role only (destructive operation)
- **Project Read:** Any organization member can view projects
- Role checked at API layer and enforced via RLS policies

**Data Protection:**
- Project metadata (name, description, settings) stored in plaintext (not sensitive)
- Secrets within projects are encrypted client-side (see zero-knowledge encryption feature)
- HTTPS/TLS 1.3 for all API communication
- No sensitive data in project settings JSONB (validated to prevent accidental key storage)

**Audit Logging:**
- All project creation, updates, and archive operations logged
- Audit log includes: user_id, action, project_id, timestamp, IP address (via Cloudflare headers)
- Audit logs immutable (insert-only table)
- Retention: 90 days for free tier, 1 year for paid tier

### Compliance

**GDPR:**
- Project data belongs to organization (not individual user)
- User deletion: Remove from organization_members, RLS prevents access to projects
- Data export: Include all projects user created or has access to
- Right to be forgotten: Remove user's created_by attribution (not required for projects as they belong to org)

**SOC 2:**
- Audit logs provide evidence of access control enforcement
- RLS policies demonstrate data isolation between organizations
- Rate limiting prevents abuse
- All operations traceable to specific user

---

## Performance Requirements

### Performance Targets

**Latency:**
- **List projects:** < 200ms p95 (typically 50-100ms with RLS + index)
- **Get project detail:** < 150ms p95 (single row lookup)
- **Create project:** < 300ms p95 (insert + create default environment)
- **Update project:** < 200ms p95 (single row update)
- **Archive project:** < 200ms p95 (single row update)

**Throughput:**
- **List projects:** 1000 requests/second (cached at edge)
- **Create project:** 100 requests/second (rate limited per user)

**Resource Usage:**
- **Database connections:** Reuse via Supabase connection pooling
- **Memory:** < 10MB per Worker instance
- **Storage:** ~1KB per project record (including JSONB settings)

### Optimization Strategy

**Frontend:**
- React Query caching with 5-minute stale time for project lists
- Optimistic updates for create/update (instant UI feedback)
- Lazy load project details (only fetch when user navigates to project)
- Debounce project search input (300ms delay)

**Backend:**
- Index on `projects.organization_id` for fast filtering (see database schema)
- RLS policies use indexed columns (organization_id) for performance
- Cloudflare Workers KV for caching frequently accessed projects (cache TTL: 5 minutes)
- Edge caching for GET requests (Cloudflare CDN caches responses)

**Database:**
- **Index 1:** `idx_projects_organization_id` on projects(organization_id) - O(log N) lookup
- **Index 2:** Automatic index on `projects.id` (primary key) - O(1) lookup
- **Index 3:** `idx_environments_project_id` on environments(project_id) - Fast environment lookup
- Connection pooling via PgBouncer (Supabase managed) - Reuse connections
- No N+1 queries - Use joins or batch queries when fetching projects with environments

### Load Handling

**Expected Load:**
- **Solo developers:** 1-10 projects, <1 request/minute
- **Small teams:** 10-50 projects, 10 requests/minute (team members switching projects)
- **Enterprises:** 100-500 projects, 100 requests/minute (many team members)

**Scalability:**
- Cloudflare Workers: Auto-scale to millions of requests (no configuration needed)
- Supabase database: Connection pooling handles up to 3000 concurrent connections (default tier)
- Vertical scaling: Upgrade Supabase tier for more connections/CPU if needed
- Horizontal scaling: Read replicas (future) for read-heavy workloads

**Bottlenecks:**
- **Database writes (project creation):** Limited by Supabase write throughput (~1000 writes/sec on default tier)
  - Mitigation: Rate limiting prevents single user from overwhelming system
- **RLS policy evaluation:** Complex policies can slow queries
  - Mitigation: Keep RLS policies simple (single JOIN on organization_members), use indexed columns

---

## Testing Strategy

### Unit Tests

**Frontend:**

**Test: ProjectSelector component**
```typescript
describe('ProjectSelector', () => {
  it('should display list of projects', () => {
    const projects = [
      { id: '1', name: 'RecipeApp' },
      { id: '2', name: 'ClientWebsite' },
    ]
    render(<ProjectSelector projects={projects} selectedProjectId="1" />)

    expect(screen.getByText('RecipeApp')).toBeInTheDocument()
    expect(screen.getByText('ClientWebsite')).toBeInTheDocument()
  })

  it('should call onSelectProject when project clicked', () => {
    const onSelect = jest.fn()
    const projects = [{ id: '1', name: 'RecipeApp' }]
    render(<ProjectSelector projects={projects} onSelectProject={onSelect} />)

    fireEvent.click(screen.getByText('RecipeApp'))
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('should highlight selected project', () => {
    const projects = [
      { id: '1', name: 'RecipeApp' },
      { id: '2', name: 'ClientWebsite' },
    ]
    render(<ProjectSelector projects={projects} selectedProjectId="1" />)

    const selected = screen.getByText('RecipeApp').closest('button')
    expect(selected).toHaveClass('selected')
  })
})
```

**Backend:**

**Test: Create project handler**
```typescript
describe('handleCreateProject', () => {
  it('should create project and default environment', async () => {
    const mockRequest = new Request('https://api.abyrith.com/projects', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: 'org-123',
        name: 'TestProject',
      }),
    })

    const response = await handleCreateProject(mockRequest, 'user-456', mockEnv)

    expect(response.status).toBe(201)
    const project = await response.json()
    expect(project.name).toBe('TestProject')
    expect(project.created_by).toBe('user-456')

    // Verify default environment created
    const { data: environments } = await mockEnv.SUPABASE
      .from('environments')
      .select('*')
      .eq('project_id', project.id)

    expect(environments).toHaveLength(1)
    expect(environments[0].name).toBe('Development')
  })

  it('should return 403 if user lacks permission', async () => {
    // Mock user is not owner/admin
    const response = await handleCreateProject(mockRequest, 'user-789', mockEnv)
    expect(response.status).toBe(403)
  })

  it('should return 409 if duplicate name', async () => {
    // Create first project
    await createTestProject({ name: 'DuplicateTest' })

    // Try to create second with same name
    const response = await handleCreateProject(
      mockRequestWithBody({ name: 'DuplicateTest' }),
      'user-456',
      mockEnv
    )

    expect(response.status).toBe(409)
  })
})
```

**Coverage:** Target 80%+ coverage for components, 90%+ for API handlers

---

### Integration Tests

**Test Scenario 1: Complete project creation flow**
```typescript
describe('Project creation integration', () => {
  it('should create project, environment, and allow adding secrets', async () => {
    // 1. User creates project
    const { project } = await createProject({
      name: 'IntegrationTest',
      organization_id: testOrg.id,
    })

    expect(project.id).toBeDefined()

    // 2. Verify default environment exists
    const environments = await fetchEnvironments(project.id)
    expect(environments).toHaveLength(1)
    expect(environments[0].name).toBe('Development')

    // 3. Add secret to project
    const secret = await createSecret({
      project_id: project.id,
      environment_id: environments[0].id,
      key_name: 'TEST_KEY',
      encrypted_value: 'encrypted_data',
    })

    expect(secret.project_id).toBe(project.id)

    // 4. Fetch project with secrets
    const projectWithSecrets = await fetchProject(project.id)
    expect(projectWithSecrets.secret_count).toBe(1)
  })
})
```

**Test Scenario 2: RLS policy enforcement**
```typescript
describe('Project access control', () => {
  it('should prevent access to other orgs projects', async () => {
    // User A in Org 1
    const userA = await createTestUser({ org: 'org-1' })
    const projectA = await createProject({ org_id: 'org-1', name: 'ProjectA' })

    // User B in Org 2
    const userB = await createTestUser({ org: 'org-2' })

    // User B tries to access User A's project
    const result = await fetchProjectAsUser(projectA.id, userB.id)

    // Should return empty (RLS filters it out)
    expect(result).toBeNull()
  })
})
```

---

### End-to-End Tests

**E2E Flow 1: Create project and add secret**
```typescript
test('User can create project and add secret', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  // Create project
  await page.click('button:has-text("New Project")')
  await page.fill('[name="name"]', 'E2E Test Project')
  await page.fill('[name="description"]', 'Created by E2E test')
  await page.click('button:has-text("Create Project")')

  // Verify project appears
  await expect(page.locator('text=E2E Test Project')).toBeVisible()

  // Add secret
  await page.click('button:has-text("Add Secret")')
  await page.fill('[name="key_name"]', 'TEST_SECRET')
  await page.fill('[name="value"]', 'secret_value_123')
  await page.click('button:has-text("Save Secret")')

  // Verify secret added
  await expect(page.locator('text=TEST_SECRET')).toBeVisible()
})
```

**E2E Flow 2: Switch between projects**
```typescript
test('User can switch between projects', async ({ page }) => {
  await loginAsTestUser(page)

  // Create two projects
  await createTestProject(page, 'Project Alpha')
  await createTestProject(page, 'Project Beta')

  // Switch to Project Alpha
  await page.click('[data-testid="project-selector"]')
  await page.click('text=Project Alpha')

  // Verify Project Alpha is selected
  await expect(page.locator('[data-testid="current-project"]')).toHaveText('Project Alpha')

  // Switch to Project Beta
  await page.click('[data-testid="project-selector"]')
  await page.click('text=Project Beta')

  // Verify Project Beta is selected
  await expect(page.locator('[data-testid="current-project"]')).toHaveText('Project Beta')
})
```

---

### Security Tests

**Security Test Case 1: Verify RLS prevents unauthorized access**
```typescript
test('RLS prevents cross-org project access', async () => {
  const org1 = await createTestOrg('Org1')
  const org2 = await createTestOrg('Org2')

  const user1 = await createTestUser({ org: org1.id })
  const user2 = await createTestUser({ org: org2.id })

  const project1 = await createProject({ org_id: org1.id, name: 'Private' }, user1.token)

  // User 2 tries to access User 1's project
  const response = await fetch(`/api/projects/${project1.id}`, {
    headers: { Authorization: `Bearer ${user2.token}` },
  })

  // Should return 404 (not 403, to prevent enumeration)
  expect(response.status).toBe(404)
})
```

**Security Test Case 2: Verify SQL injection protection**
```typescript
test('SQL injection in project name is sanitized', async () => {
  const maliciousName = "'; DROP TABLE projects; --"

  const response = await createProject({
    name: maliciousName,
    organization_id: testOrg.id,
  })

  // Should succeed (stored as literal string)
  expect(response.status).toBe(201)

  // Verify projects table still exists
  const projects = await fetchProjects()
  expect(projects).toBeDefined()
})
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/secrets-metadata.md` - Projects, environments, and secrets tables defined
- [ ] `05-api/endpoints/projects-endpoints.md` - API endpoint specifications (to be created)
- [x] `03-security/rbac/rls-policies.md` - Row-Level Security policies for multi-tenancy (referenced in db schema)
- [x] `02-architecture/system-overview.md` - Overall architecture context
- [x] `GLOSSARY.md` - Standard terminology definitions

**External Services:**
- Supabase (PostgreSQL, Auth, RLS)
- Cloudflare Workers (API gateway)
- Cloudflare Workers KV (optional caching)

### Feature Dependencies

**Depends on these features:**
- Authentication & Authorization (must be logged in to manage projects)
- Organization management (projects belong to organizations)

**Enables these features:**
- **Secrets management** - Secrets cannot exist without projects (foreign key dependency)
- **Team collaboration** - Projects are units of collaboration (team members invited to projects)
- **Environment isolation** - Environments prevent dev/staging/prod key mixing
- **Audit logs** - Project-level audit trails for compliance
- **MCP integration** - Claude Code requests secrets from specific projects

---

## References

### Internal Documentation

**Core Architecture:**
- `02-architecture/system-overview.md` - Overall system architecture
- `TECH-STACK.md` - Technology stack specifications

**Database & API:**
- `04-database/schemas/secrets-metadata.md` - Database schema with projects, environments, secrets tables
- `04-database/database-overview.md` - Database architecture (to be created)
- `05-api/endpoints/projects-endpoints.md` - API endpoint specifications (to be created)
- `05-api/rest-api-design.md` - REST API patterns (to be created)

**Security:**
- `03-security/security-model.md` - Zero-knowledge encryption architecture
- `03-security/rbac/permissions-model.md` - Role-based access control (to be created)
- `03-security/rbac/rls-policies.md` - Row-Level Security policies (referenced in db schema)

**Frontend:**
- `07-frontend/architecture.md` - Frontend architecture (to be created)
- `07-frontend/state-management.md` - Zustand and React Query setup (to be created)
- `07-frontend/components/component-library.md` - Component library (to be created)

**Product:**
- `01-product/product-vision-strategy.md` - Product vision and target users
- `GLOSSARY.md` - Standard terminology

### External Resources

**Technologies:**
- [Next.js Documentation](https://nextjs.org/docs) - Frontend framework
- [React Query Documentation](https://tanstack.com/query/latest) - Server state management
- [Zustand Documentation](https://zustand-demo.pmnd.rs/) - Client state management
- [Supabase Documentation](https://supabase.com/docs) - Backend platform
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) - RLS reference
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/) - Serverless functions

**Design Patterns:**
- [Optimistic Updates Pattern](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) - React Query optimistic updates
- [Multi-Tenancy Patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/database-design-patterns.html) - Database multi-tenancy

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial comprehensive feature documentation covering all aspects of project management |

---

## Notes

### Future Enhancements

**Phase 2 (Post-MVP):**
- **Project templates** - Create new projects from templates (e.g., "Next.js App", "Python API")
- **Project tags** - Categorize projects (client projects, internal tools, experiments)
- **Project archiving timeline** - Auto-archive projects inactive for 90 days (with warning)
- **Bulk operations** - Archive multiple projects, export all project secrets
- **Project transfer** - Transfer project ownership to another organization member

**Phase 3 (Enterprise):**
- **Project budgets** - Set spending limits per project (for API usage tracking)
- **Custom approval workflows** - Define multi-step approval for production access
- **Project compliance settings** - SOC 2, ISO 27001 metadata per project
- **Project dependencies** - Link projects that depend on each other (microservices)
- **Project analytics** - Usage patterns, most accessed secrets, team activity

### Known Issues

None currently identified. This is a greenfield implementation.

### Implementation Priority

1. **Highest Priority (MVP must-have):**
   - Create project
   - List projects
   - Switch between projects
   - Default environment auto-creation
   - Basic project settings (name, description)

2. **High Priority (MVP nice-to-have):**
   - Archive project
   - Custom environments
   - Environment color coding
   - Project search/filter

3. **Medium Priority (Post-MVP):**
   - Project templates
   - Bulk operations
   - Project tags

4. **Low Priority (Future):**
   - Project transfer
   - Advanced compliance features
   - Project analytics

### Success Metrics

**Adoption:**
- 95%+ of users create a project within first session
- Average 2-5 projects per user (solo developers)
- Average 10-50 projects per organization (teams)

**Usability:**
- < 30 seconds to create first project
- < 5 seconds to switch between projects
- < 10 seconds to add new environment

**Performance:**
- < 200ms p95 for project list loading
- < 300ms p95 for project creation

**Quality:**
- Zero RLS policy bypass vulnerabilities
- < 1% error rate on project operations
- 99.9% uptime for project management API
