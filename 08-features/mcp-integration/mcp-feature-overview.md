---
Document: MCP Integration - Feature Overview
Version: 1.0.0
Last Updated: 2025-11-02
Owner: Product Lead / Engineering Lead
Status: Draft
Dependencies: 09-integrations/mcp/mcp-secrets-server.md, 09-integrations/mcp/mcp-overview.md, 05-api/endpoints/mcp-endpoints.md, 08-features/zero-knowledge-vault/encryption-ux-flow.md, 03-security/security-model.md, ROADMAP.md, GLOSSARY.md
---

# MCP Integration - Feature Overview

## Overview

MCP (Model Context Protocol) integration is a **critical MVP-blocking feature** that enables AI development tools like Claude Code and Cursor to securely access secrets stored in Abyrith. This feature transforms Abyrith from a passive vault into an active participant in AI-powered development workflows, providing secrets on-demand with user approval while maintaining zero-knowledge encryption guarantees.

**Purpose:** Enable seamless, secure secrets access for AI tools through an approval-based workflow that balances convenience with security.

**Target Users:** All 4 personas, but especially Solo Developers and Development Teams using AI-powered IDEs.

**Status:** MVP Critical (Phase 1 - listed in ROADMAP.md as MVP requirement)

---

## Table of Contents

1. [Context & Motivation](#context--motivation)
2. [User Perspectives by Persona](#user-perspectives-by-persona)
3. [Technical Architecture](#technical-architecture)
4. [User Flows](#user-flows)
5. [MCP Tools Specifications](#mcp-tools-specifications)
6. [Approval Workflow State Machine](#approval-workflow-state-machine)
7. [Security Considerations](#security-considerations)
8. [Performance Requirements](#performance-requirements)
9. [Testing Strategy](#testing-strategy)
10. [Implementation Plan](#implementation-plan)
11. [Success Metrics](#success-metrics)
12. [Dependencies](#dependencies)
13. [References](#references)
14. [Change Log](#change-log)

---

## Context & Motivation

### The Problem: Secrets Access Friction in AI Development

**Current pain points:**

1. **Manual context switching:** Developers using Claude Code or Cursor must:
   - Stop coding
   - Switch to browser
   - Find the secret in Abyrith
   - Copy it
   - Return to IDE
   - Paste it into code or environment

2. **AI tools lack context:** AI assistants cannot:
   - Know which secrets exist for a project
   - Access secrets when needed for code generation
   - Validate that required API keys are available
   - Help debug authentication issues

3. **Security vs. convenience trade-off:** Developers choose between:
   - Keeping secrets in plaintext `.env` files (convenient but insecure)
   - Storing secrets in Abyrith (secure but friction-filled)

### The Solution: MCP-Native Secrets Management

**What MCP integration provides:**

- **Conversational access:** AI tools ask for secrets in natural language
  - Claude Code: "I need the OpenAI API key for this project"
  - Abyrith responds via MCP protocol with approval workflow

- **Context-aware discovery:** AI tools can:
  - List available secrets for current project
  - Search for secrets by service name or tag
  - Request missing secrets (triggering guided acquisition flow)

- **Security without friction:**
  - Approval notifications in web app (real-time)
  - Time-limited access grants (1 hour default, configurable)
  - Full audit trail of AI tool access
  - Zero-knowledge encryption maintained (secrets decrypted client-side)

### Why This is MVP Critical

From `ROADMAP.md`:

> **MCP Server Foundation** - Model Context Protocol server implementation
> - **Description:** MCP server for Claude Code and Cursor integration, authentication and authorization
> - **Target Persona:** AI-powered developers using Claude Code/Cursor
> - **Dependencies:** API endpoints, authentication
> - **Status:** Planned

**Strategic importance:**

1. **Differentiation:** First secrets manager built specifically for AI development workflows
2. **Product vision alignment:** "AI-native secrets management" requires native AI tool integration
3. **User demand:** Claude Code and Cursor adoption is exploding (millions of users)
4. **Competitive moat:** Deep integration with AI tools creates switching costs

### User Needs by Persona

**Learner:**
- "I'm using Claude Code to build my first app. How do I give it my API keys safely?"
- Need: Simple approval flow, clear explanations, visual feedback

**Solo Developer:**
- "I don't want to keep API keys in .env files anymore, but I need fast access during coding"
- Need: Fast approval, low friction, works seamlessly with AI pair programming

**Development Team:**
- "Our team uses Cursor. How do we control which secrets AI tools can access?"
- Need: Granular permissions, approval workflows, audit trails

**Enterprise:**
- "We need to audit all AI tool access to production secrets"
- Need: Comprehensive logging, compliance reporting, time-limited access

---

## User Perspectives by Persona

### Persona 1: The Learner

**Profile:** Sarah, 16 years old, learning to code with Claude Code

**Use Case:** Building first web app with OpenAI API

**Experience with MCP integration:**

1. **First encounter:**
   - Sarah asks Claude Code: "Add a feature that summarizes text using OpenAI"
   - Claude Code responds: "I need your OpenAI API key to implement this. I'll request it from Abyrith."
   - Claude Code uses `mcp_secrets_request` tool
   - Sarah sees notification in Abyrith web app: "Claude Code is requesting: OPENAI_API_KEY"

2. **Approval flow:**
   - Notification shows:
     - What tool is requesting (Claude Code)
     - What secret (OPENAI_API_KEY for project "TextSummarizerApp")
     - Why (shown in request message)
     - Duration options (1 hour, 8 hours, 24 hours)
   - Sarah clicks "Approve for 1 hour"
   - Claude Code immediately receives the secret (decrypted client-side in her browser)
   - Claude Code uses key to implement the feature

3. **Learning moment:**
   - Sarah understands the approval flow
   - Learns that AI tools don't automatically have access
   - Sees audit log showing when Claude Code accessed the key
   - Feels secure knowing she controls access

**Key Requirements:**
- ✅ Clear, visual approval interface (not command-line)
- ✅ Plain-English explanations ("What is requesting access and why")
- ✅ Safe defaults (1 hour access, auto-expire)
- ✅ Learning resources embedded in approval flow

**Success Metric:** 95% of learners successfully approve first MCP request without help

---

### Persona 2: The Solo Developer

**Profile:** Marcus, indie hacker building SaaS products with Cursor

**Use Case:** Rapid prototyping with multiple API integrations

**Experience with MCP integration:**

1. **Daily workflow:**
   - Marcus starts Cursor in project directory
   - Cursor MCP server auto-connects to Abyrith (authenticated via device)
   - Marcus asks Cursor: "Add Stripe payment processing"
   - Cursor checks available secrets: `mcp_secrets_list` → sees "STRIPE_SECRET_KEY" exists
   - Cursor: "I found your Stripe key. Request access to implement?"
   - Marcus: "yes" (in chat)
   - Approval notification appears (Marcus approves via web app or mobile)
   - Cursor implements payment flow with actual keys

2. **Missing secret scenario:**
   - Marcus asks Cursor: "Add Resend email integration"
   - Cursor checks: `mcp_secrets_list` → no Resend key found
   - Cursor uses `mcp_secrets_request` with `missing=true`
   - Abyrith web app opens Resend guided acquisition flow
   - Marcus follows AI-generated steps to get Resend API key
   - Adds key to Abyrith
   - Cursor notified, continues implementation

3. **Multi-project workflow:**
   - Marcus works on 3 projects simultaneously
   - Each project has separate Abyrith project configuration
   - Cursor MCP automatically scopes requests to current project
   - Marcus never copies/pastes keys between projects
   - All access logged separately per project

**Key Requirements:**
- ✅ Fast approval (< 5 seconds from request to access)
- ✅ Automatic project detection (Cursor knows which Abyrith project)
- ✅ Persistent approval for session (approve once, access for hours)
- ✅ Mobile approval (approve on phone while at laptop)

**Success Metric:** 80% of solo developers enable MCP within first week, 70% use it daily

---

### Persona 3: The Development Team

**Profile:** Engineering team at startup (15 developers using Claude Code and Cursor)

**Use Case:** Team development with controlled AI tool access

**Experience with MCP integration:**

1. **Team setup:**
   - Admin creates Abyrith organization
   - Adds team members with appropriate roles:
     - Developers: can approve own MCP requests for development environment
     - Admins: can approve MCP requests for staging environment
     - Owners: can approve MCP requests for production environment
   - RBAC policies automatically apply to MCP requests

2. **Development workflow:**
   - Developer uses Claude Code to implement feature
   - Claude Code requests development environment secret
   - Developer approves (has permission for dev secrets)
   - Claude Code accesses secret, implements feature

3. **Production safeguard:**
   - Developer accidentally asks Claude Code to test against production
   - Claude Code requests production environment secret
   - Request appears in web app: "Claude Code requesting PRODUCTION secret"
   - Developer cannot approve (lacks permission)
   - Admin receives notification (approval required)
   - Admin reviews context, denies request (testing should use staging)
   - Developer notified of denial with explanation

4. **Audit trail:**
   - Weekly security review meeting
   - Team reviews MCP access logs:
     - Who requested what secrets
     - Which approvals were granted/denied
     - Which secrets were accessed by AI tools
     - Time-limited access expirations
   - Export audit log for compliance

**Key Requirements:**
- ✅ RBAC enforcement for MCP requests (same permissions as web app)
- ✅ Environment-based access control (dev vs. staging vs. production)
- ✅ Approval delegation (admins can approve on behalf of developers)
- ✅ Comprehensive audit logging
- ✅ Slack/Teams notifications for sensitive requests

**Success Metric:** 100% of teams use environment-based RBAC, 90% review audit logs monthly

---

### Persona 4: The Enterprise

**Profile:** Fortune 500 company with 200+ developers, SOC 2 compliance requirements

**Use Case:** Enterprise-grade AI development with full auditability

**Experience with MCP integration:**

1. **Compliance setup:**
   - Security team enables MCP access with strict policies:
     - Production secrets: require approval from 2 admins (dual authorization)
     - Access duration: maximum 1 hour (configurable)
     - MFA required for approval of production secrets
     - All MCP access logged to immutable audit trail

2. **Approval workflow:**
   - Senior developer requests production secret via Cursor
   - Request triggers approval workflow:
     - Notification to 2 designated approvers
     - MFA challenge for both approvers
     - Context provided: which secret, why needed, risk level
     - First approver approves, second approver approves
     - Time-limited access granted (1 hour)
     - Auto-revocation after 1 hour
   - Developer's Cursor receives secret, completes emergency fix
   - Access automatically revoked after 1 hour

3. **SOC 2 audit:**
   - Auditor requests: "Show all AI tool access to production secrets in Q3 2026"
   - Compliance dashboard query:
     - Filter: MCP requests, production environment, Q3 2026
     - Export: CSV with timestamp, user, tool, secret, approver, duration
   - Report generated in < 5 seconds
   - Auditor verifies dual authorization for all production access

4. **Incident response:**
   - Security team detects suspicious MCP activity
   - Immediately revokes all active MCP access grants
   - Forces re-approval for all subsequent requests
   - Reviews audit logs for unauthorized access attempts

**Key Requirements:**
- ✅ Dual authorization for sensitive secrets
- ✅ MFA for approval actions
- ✅ Configurable access duration limits
- ✅ Immutable audit trails (append-only)
- ✅ Real-time monitoring and alerting
- ✅ Emergency revocation capabilities
- ✅ Compliance reporting (SOC 2, ISO 27001, GDPR)

**Success Metric:** Pass SOC 2 Type II audit with zero findings related to AI tool access

---

## Technical Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI Development Tool                               │
│                 (Claude Code / Cursor)                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  MCP Client                                                    │  │
│  │  - Discovers Abyrith MCP server                               │  │
│  │  - Authenticates user                                         │  │
│  │  - Invokes MCP tools (list, get, request, search)            │  │
│  └────────────────────────┬──────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ MCP Protocol (stdio/SSE)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Abyrith MCP Server                                  │
│                  (Node.js / TypeScript)                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  MCP Protocol Handler                                         │  │
│  │  - Tool registration (4 tools)                                │  │
│  │  - Request validation                                         │  │
│  │  - Authentication (JWT from Abyrith platform)                │  │
│  │  - Authorization (RBAC enforcement)                           │  │
│  └────────────────────────┬──────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴──────────────────────────────────────┐  │
│  │  Tool Implementations                                         │  │
│  │  - mcp_secrets_list      (list available secrets)            │  │
│  │  - mcp_secrets_get       (get specific secret, requires     │  │
│  │                            approval)                          │  │
│  │  - mcp_secrets_request   (request missing secret)            │  │
│  │  - mcp_secrets_search    (search by name/tag)                │  │
│  └────────────────────────┬──────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴──────────────────────────────────────┐  │
│  │  Approval Manager                                             │  │
│  │  - Create approval requests                                   │  │
│  │  - Poll for approval status                                   │  │
│  │  - Handle time-limited grants                                 │  │
│  │  - Emit notifications (Supabase Realtime)                    │  │
│  └────────────────────────┬──────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ HTTPS (REST + Realtime)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Abyrith Platform API                                │
│             (Cloudflare Workers + Supabase)                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  MCP Endpoints                                                 │  │
│  │  POST   /api/mcp/requests          (create approval request)  │  │
│  │  GET    /api/mcp/requests/:id      (check request status)     │  │
│  │  POST   /api/mcp/requests/:id/approve  (approve request)      │  │
│  │  POST   /api/mcp/requests/:id/deny     (deny request)         │  │
│  │  GET    /api/secrets                   (list secrets)         │  │
│  │  GET    /api/secrets/:id               (get secret metadata)  │  │
│  └────────────────────────┬──────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴──────────────────────────────────────┐  │
│  │  Database (Supabase PostgreSQL)                               │  │
│  │  - secrets table (encrypted secrets)                          │  │
│  │  - mcp_requests table (approval requests)                     │  │
│  │  - mcp_grants table (time-limited access grants)              │  │
│  │  - audit_logs table (all MCP activity)                        │  │
│  │  - RLS policies (enforce RBAC)                                │  │
│  └────────────────────────┬──────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ Supabase Realtime (WebSocket)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Abyrith Web Application                             │
│                  (Next.js / React)                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Approval Notification UI                                     │  │
│  │  - Real-time notification toast                               │  │
│  │  - Approval modal (approve/deny/configure duration)           │  │
│  │  - Client-side decryption (Web Crypto API)                    │  │
│  │  - Send decrypted secret back to MCP server                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  MCP Activity Dashboard                                       │  │
│  │  - Active grants visualization                                │  │
│  │  - Recent MCP requests history                                │  │
│  │  - Pending approvals inbox                                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Abyrith MCP Server

**Location:** Runs locally on developer's machine (same as Claude Code / Cursor)

**Technology:**
- Node.js 18+ with TypeScript
- MCP SDK (@anthropic/mcp-sdk)
- Supabase JS client for API communication

**Responsibilities:**
1. Register 4 MCP tools with Claude Code / Cursor
2. Handle tool invocations from AI tools
3. Authenticate user (JWT token from Abyrith platform)
4. Enforce RBAC permissions (check user role and environment)
5. Create approval requests (for `mcp_secrets_get`)
6. Poll for approval status (via platform API)
7. Return secrets to AI tools (when approved)
8. Log all activity to audit trail

**Configuration:**
```json
{
  "name": "abyrith-secrets",
  "version": "1.0.0",
  "description": "Abyrith Secrets Manager MCP Server",
  "tools": [
    "mcp_secrets_list",
    "mcp_secrets_get",
    "mcp_secrets_request",
    "mcp_secrets_search"
  ],
  "authentication": {
    "type": "oauth2",
    "authUrl": "https://app.abyrith.com/auth/mcp",
    "tokenUrl": "https://api.abyrith.com/auth/token"
  },
  "apiEndpoint": "https://api.abyrith.com"
}
```

**Setup Instructions (for users):**

**Claude Code:**
```bash
# Install Abyrith MCP server via npm
npm install -g @abyrith/mcp-server

# Authenticate with Abyrith
abyrith-mcp auth login

# Configure Claude Code to use Abyrith MCP server
# Add to ~/.config/claude-code/mcp-servers.json:
{
  "abyrith": {
    "command": "abyrith-mcp",
    "args": ["serve"],
    "env": {
      "ABYRITH_PROJECT": "${workspaceFolder}/.abyrith"
    }
  }
}
```

**Cursor:**
```bash
# Install Abyrith MCP server
npm install -g @abyrith/mcp-server

# Authenticate
abyrith-mcp auth login

# Configure Cursor (add to Cursor settings)
{
  "mcp.servers": {
    "abyrith": {
      "command": "abyrith-mcp serve"
    }
  }
}
```

---

#### 2. MCP Request Database Schema

**Table: `mcp_requests`**

Stores approval requests created when AI tools request secrets.

```sql
CREATE TABLE mcp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,

  -- Request metadata
  tool_name TEXT NOT NULL,              -- 'claude-code' or 'cursor'
  tool_version TEXT,                     -- Tool version
  request_reason TEXT,                   -- Why tool needs secret (from AI)

  -- Request status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied' | 'expired'

  -- Approval details
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  denied_by UUID REFERENCES auth.users(id),
  denied_at TIMESTAMP WITH TIME ZONE,
  denial_reason TEXT,

  -- Time-limited access
  access_duration_minutes INTEGER DEFAULT 60,  -- Default 1 hour
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Audit trail
  requester_ip INET,
  requester_user_agent TEXT
);

-- Indexes
CREATE INDEX idx_mcp_requests_user_status ON mcp_requests(user_id, status);
CREATE INDEX idx_mcp_requests_project ON mcp_requests(project_id);
CREATE INDEX idx_mcp_requests_status_expires ON mcp_requests(status, expires_at);

-- RLS Policies
ALTER TABLE mcp_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can view own MCP requests"
  ON mcp_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users with project access can view project requests
CREATE POLICY "Project members can view project MCP requests"
  ON mcp_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = mcp_requests.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- Only admins/owners can approve requests
CREATE POLICY "Admins can approve MCP requests"
  ON mcp_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = mcp_requests.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('owner', 'admin')
    )
  );
```

**Table: `mcp_grants`**

Tracks active time-limited access grants (post-approval).

```sql
CREATE TABLE mcp_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mcp_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,

  -- Grant details
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,

  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,

  -- Status
  is_active BOOLEAN GENERATED ALWAYS AS (
    revoked_at IS NULL AND expires_at > NOW()
  ) STORED
);

-- Indexes
CREATE INDEX idx_mcp_grants_active ON mcp_grants(is_active, expires_at);
CREATE INDEX idx_mcp_grants_user ON mcp_grants(user_id);
CREATE INDEX idx_mcp_grants_secret ON mcp_grants(secret_id);

-- RLS Policies
ALTER TABLE mcp_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own MCP grants"
  ON mcp_grants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

---

#### 3. Approval Workflow State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Request Lifecycle                        │
└─────────────────────────────────────────────────────────────────┘

    AI Tool Requests Secret
            │
            ▼
    ┌───────────────┐
    │   PENDING     │  ← Initial state when request created
    │               │    - Notification sent to user (web app)
    │               │    - MCP server polls for status
    └───────┬───────┘
            │
      User Action?
            │
    ┌───────┴────────┐
    ▼                ▼
┌─────────┐      ┌─────────┐
│APPROVED │      │ DENIED  │
│         │      │         │
│Creates  │      │Immediate│
│Grant    │      │Response │
└────┬────┘      └────┬────┘
     │                │
     │                └──────────► Return error to AI tool
     │                              (with denial reason)
     │
     ▼
┌──────────────┐
│ GRANT_ACTIVE │  ← Time-limited access active
│              │    - Secret available to AI tool
│              │    - Access logged on each use
│              │    - Auto-expires after duration
└─────┬────────┘
      │
  Timer Expires
      │
      ▼
┌──────────────┐
│   EXPIRED    │  ← Access no longer valid
│              │    - AI tool must re-request
│              │    - User can re-approve if needed
└──────────────┘

Special Transitions:
- PENDING → EXPIRED (if no response within 15 minutes)
- GRANT_ACTIVE → REVOKED (if admin manually revokes)
```

**State Transitions:**

| From State | Event | To State | Actions |
|------------|-------|----------|---------|
| (none) | AI tool requests secret | PENDING | Create request record, send notification |
| PENDING | User approves | APPROVED | Create grant record, return secret to AI tool |
| PENDING | User denies | DENIED | Record denial reason, return error to AI tool |
| PENDING | 15 min timeout | EXPIRED | Return timeout error to AI tool |
| APPROVED | Access duration expires | EXPIRED | Revoke grant, log expiration |
| GRANT_ACTIVE | Admin revokes | REVOKED | Immediately invalidate grant, log revocation |

---

## User Flows

### Flow 1: AI Tool Requests Secret (Approved Path)

**Scenario:** Developer using Claude Code to implement feature that needs OpenAI API key

**Preconditions:**
- User authenticated in Abyrith web app (session active)
- User authenticated in Claude Code with Abyrith MCP server
- OpenAI API key exists in project vault
- User has permission to access development environment secrets

**Steps:**

1. **AI tool detects need for secret**
   ```
   Developer: "Add a function that uses OpenAI to summarize text"

   Claude Code thinks:
   - This requires OpenAI API key
   - Check if key exists: mcp_secrets_list → OPENAI_API_KEY found
   - Need to request access: mcp_secrets_get
   ```

2. **MCP server creates approval request**
   ```typescript
   // Claude Code invokes MCP tool
   await mcp.useTool('mcp_secrets_get', {
     secret_id: 'uuid-of-openai-key',
     project_id: 'current-project-uuid',
     reason: 'Implementing text summarization feature using OpenAI API'
   });

   // Abyrith MCP server handles request
   const request = await createApprovalRequest({
     user_id: currentUser.id,
     project_id: currentProject.id,
     secret_id: secretId,
     tool_name: 'claude-code',
     tool_version: '1.2.3',
     request_reason: reason,
     access_duration_minutes: 60  // Default 1 hour
   });

   // MCP server begins polling for approval
   const approval = await pollForApproval(request.id, {
     timeout: 15 * 60 * 1000,  // 15 minutes
     interval: 2000             // Check every 2 seconds
   });
   ```

3. **User receives notification in web app**
   ```typescript
   // Supabase Realtime subscription in web app
   supabase
     .channel('mcp-requests')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'mcp_requests',
       filter: `user_id=eq.${currentUser.id}`
     }, (payload) => {
       // Show notification toast
       showNotification({
         title: 'Claude Code needs access',
         message: `Requesting: ${payload.new.secret_name}`,
         actions: ['Approve', 'Deny', 'Details']
       });
     })
     .subscribe();
   ```

4. **User approves request**
   ```typescript
   // User clicks "Approve" button
   async function approveRequest(requestId: string, duration: number) {
     // 1. Fetch encrypted secret from database
     const { data: secret } = await supabase
       .from('secrets')
       .select('*')
       .eq('id', secretId)
       .single();

     // 2. Decrypt secret client-side
     const decryptedValue = await decryptSecret(
       secret.encrypted_value,
       secret.encrypted_dek,
       userMasterKey  // Already in memory from session
     );

     // 3. Create approval record
     const { data: approval } = await supabase
       .from('mcp_requests')
       .update({
         status: 'approved',
         approved_by: currentUser.id,
         approved_at: new Date().toISOString(),
         access_duration_minutes: duration,
         expires_at: new Date(Date.now() + duration * 60000).toISOString()
       })
       .eq('id', requestId)
       .select()
       .single();

     // 4. Create time-limited grant
     const { data: grant } = await supabase
       .from('mcp_grants')
       .insert({
         request_id: requestId,
         user_id: currentUser.id,
         secret_id: secretId,
         expires_at: approval.expires_at
       })
       .select()
       .single();

     // 5. Return decrypted secret to MCP server (via secure channel)
     await sendSecretToMCPServer(requestId, decryptedValue);

     // 6. Log approval in audit trail
     await logAuditEvent({
       action: 'mcp.request.approved',
       user_id: currentUser.id,
       resource_type: 'secret',
       resource_id: secretId,
       metadata: {
         request_id: requestId,
         tool_name: 'claude-code',
         duration_minutes: duration
       }
     });
   }
   ```

5. **MCP server receives approval and returns secret**
   ```typescript
   // Polling detects approval
   const approval = await pollForApproval(request.id);

   if (approval.status === 'approved') {
     // Fetch decrypted secret from secure channel
     const decryptedSecret = await fetchDecryptedSecret(approval.id);

     // Return to Claude Code
     return {
       success: true,
       secret: {
         id: secretId,
         name: 'OPENAI_API_KEY',
         value: decryptedSecret,
         expires_at: approval.expires_at
       }
     };
   }
   ```

6. **Claude Code uses secret**
   ```typescript
   // Claude Code receives secret
   const openaiKey = result.secret.value;

   // Uses it to implement feature
   const code = `
   import OpenAI from 'openai';

   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY  // Will be injected
   });

   async function summarizeText(text: string) {
     const response = await openai.chat.completions.create({
       model: 'gpt-4',
       messages: [{ role: 'user', content: \`Summarize: \${text}\` }]
     });
     return response.choices[0].message.content;
   }
   `;

   // Shows code to user
   // Injects key into environment temporarily (in-memory only)
   ```

7. **Access expires after duration**
   ```sql
   -- Background job runs every minute
   UPDATE mcp_grants
   SET is_active = false
   WHERE expires_at < NOW()
     AND revoked_at IS NULL;

   -- Audit log entry created
   INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
   VALUES (
     'mcp.grant.expired',
     'secret',
     secret_id,
     jsonb_build_object('request_id', request_id, 'duration_minutes', 60)
   );
   ```

**Sequence Diagram:**

```
Developer    Claude Code    MCP Server    Abyrith API    Web App    User
    |            |              |              |            |         |
    |--request-->|              |              |            |         |
    |            |              |              |            |         |
    |            |-mcp_secrets_get------------>|            |         |
    |            |              |              |            |         |
    |            |              |<-create req--|            |         |
    |            |              |              |            |         |
    |            |              |              |--notify--->|         |
    |            |              |              |            |-------->|
    |            |              |              |            | Toast   |
    |            |              |              |            |         |
    |            |              |<--poll------>|            |         |
    |            |              |              |            |         |
    |            |              |              |            |<-approve|
    |            |              |              |            |         |
    |            |              |              |<-decrypt---|         |
    |            |              |              |   (client) |         |
    |            |              |              |            |         |
    |            |              |<-approved----|            |         |
    |            |              |   + secret   |            |         |
    |            |<-return------|              |            |         |
    |            |   secret     |              |            |         |
    |<-code------|              |              |            |         |
    |            |              |              |            |         |
```

**Expected Outcome:**
- ✅ Secret delivered to AI tool within 5 seconds of approval
- ✅ Access automatically expires after configured duration
- ✅ All activity logged in audit trail
- ✅ Zero-knowledge encryption maintained (decryption on client)

---

### Flow 2: AI Tool Requests Secret (Denied Path)

**Scenario:** Junior developer using Cursor attempts to access production secret without permission

**Preconditions:**
- User authenticated in both Abyrith and Cursor
- Production secret exists in vault
- User has "Developer" role (lacks production access)

**Steps:**

1. **AI tool requests production secret**
   ```
   Junior Dev: "Test this feature against production"

   Cursor thinks:
   - This needs production API key
   - Request: mcp_secrets_get for PROD_API_KEY
   ```

2. **MCP server checks permissions**
   ```typescript
   // Before creating approval request, check RBAC
   const hasPermission = await checkUserPermission({
     user_id: currentUser.id,
     project_id: currentProject.id,
     environment: 'production',
     action: 'read'
   });

   if (!hasPermission) {
     // User cannot approve their own production access
     // Request must go to admin
     await createApprovalRequest({
       ...requestData,
       requires_admin_approval: true
     });
   }
   ```

3. **Admin receives notification**
   ```typescript
   // Web app shows notification to project admins
   showNotification({
     title: 'Production Access Request',
     message: `${userName} (Developer) requesting: PROD_API_KEY`,
     type: 'warning',
     requiresReview: true,
     actions: ['Approve', 'Deny', 'Request Context']
   });
   ```

4. **Admin denies request**
   ```typescript
   async function denyRequest(requestId: string, reason: string) {
     await supabase
       .from('mcp_requests')
       .update({
         status: 'denied',
         denied_by: currentUser.id,
         denied_at: new Date().toISOString(),
         denial_reason: reason
       })
       .eq('id', requestId);

     // Log denial
     await logAuditEvent({
       action: 'mcp.request.denied',
       user_id: originalRequesterId,
       metadata: {
         request_id: requestId,
         denied_by: currentUser.id,
         denial_reason: reason
       }
     });

     // Notify requester
     await sendNotification({
       user_id: originalRequesterId,
       title: 'Request Denied',
       message: `Your request for ${secretName} was denied. Reason: ${reason}`
     });
   }
   ```

5. **MCP server receives denial**
   ```typescript
   // Polling detects denial
   const approval = await pollForApproval(request.id);

   if (approval.status === 'denied') {
     // Return error to Cursor
     return {
       success: false,
       error: 'ACCESS_DENIED',
       message: `Request denied by ${adminName}. Reason: ${approval.denial_reason}`,
       suggestion: 'Use staging environment for testing, or contact your admin.'
     };
   }
   ```

6. **Cursor informs developer**
   ```
   Cursor response:
   "I couldn't access the production API key. Your request was denied
   by Admin with reason: 'Testing should use staging environment.'

   Would you like me to:
   1. Switch to staging environment
   2. Request staging access instead
   3. Explain the difference between staging and production"
   ```

**Expected Outcome:**
- ✅ Unauthorized access prevented
- ✅ Admin review triggered for sensitive request
- ✅ Clear explanation provided to requester
- ✅ Audit trail records denial with reason

---

### Flow 3: AI Tool Requests Missing Secret

**Scenario:** Developer using Claude Code to integrate new service (Resend email)

**Preconditions:**
- User authenticated in Abyrith and Claude Code
- Resend API key does NOT exist in vault yet

**Steps:**

1. **AI tool discovers secret is missing**
   ```
   Developer: "Add email notifications using Resend"

   Claude Code thinks:
   - This requires Resend API key
   - Check: mcp_secrets_list → No Resend key found
   - Trigger acquisition flow: mcp_secrets_request
   ```

2. **MCP server invokes request tool**
   ```typescript
   await mcp.useTool('mcp_secrets_request', {
     service_name: 'resend',
     key_name: 'RESEND_API_KEY',
     project_id: currentProject.id,
     environment: 'development',
     missing: true,
     reason: 'Implementing email notification feature'
   });
   ```

3. **Abyrith triggers guided acquisition**
   ```typescript
   // API creates acquisition task
   const { data: task } = await supabase
     .from('acquisition_tasks')
     .insert({
       user_id: currentUser.id,
       project_id: currentProject.id,
       service_name: 'resend',
       key_name: 'RESEND_API_KEY',
       status: 'pending',
       triggered_by: 'mcp'
     })
     .select()
     .single();

   // Notify web app to open acquisition flow
   await notifyWebApp({
     action: 'open_acquisition',
     task_id: task.id
   });
   ```

4. **Web app opens guided acquisition modal**
   ```typescript
   // Modal displays AI-generated acquisition steps
   function AcquisitionModal({ serviceName }: Props) {
     const [steps, setSteps] = useState<AcquisitionStep[]>([]);

     useEffect(() => {
       // AI generates step-by-step instructions
       generateAcquisitionSteps(serviceName).then(setSteps);
     }, [serviceName]);

     return (
       <Modal title={`Get Your ${serviceName} API Key`}>
         <StepByStepGuide steps={steps} />
         <SecretInputForm
           onSubmit={saveSecret}
           placeholder="Paste your Resend API key here"
         />
       </Modal>
     );
   }
   ```

5. **User follows steps and adds key**
   ```typescript
   // User completes acquisition, enters key
   async function saveSecret(value: string) {
     // Encrypt client-side
     const encrypted = await encryptSecret(value, userMasterKey);

     // Store in vault
     const { data: secret } = await supabase
       .from('secrets')
       .insert({
         user_id: currentUser.id,
         project_id: currentProject.id,
         environment: 'development',
         service_name: 'resend',
         key_name: 'RESEND_API_KEY',
         encrypted_value: encrypted.encryptedValue,
         encrypted_dek: encrypted.encryptedDEK,
         ...encrypted.nonces
       })
       .select()
       .single();

     // Mark acquisition task complete
     await supabase
       .from('acquisition_tasks')
       .update({
         status: 'completed',
         secret_id: secret.id,
         completed_at: new Date().toISOString()
       })
       .eq('id', task.id);

     // Notify MCP server that secret is now available
     await notifyMCPServer({
       action: 'secret_added',
       secret_id: secret.id,
       task_id: task.id
     });
   }
   ```

6. **MCP server detects completion and re-requests**
   ```typescript
   // MCP server was polling acquisition task status
   const task = await pollAcquisitionTask(taskId);

   if (task.status === 'completed') {
     // Now request access to the newly added secret
     const result = await mcp.useTool('mcp_secrets_get', {
       secret_id: task.secret_id,
       project_id: currentProject.id,
       reason: 'Using newly acquired Resend key for email feature'
     });

     // Return to Claude Code
     return result;
   }
   ```

7. **Claude Code continues with implementation**
   ```
   Claude Code:
   "Great! I've received your Resend API key. Now I'll implement
   the email notification feature..."

   [Generates code with Resend integration]
   ```

**Expected Outcome:**
- ✅ Seamless transition from "missing secret" to "acquired secret"
- ✅ AI-generated acquisition steps guide user
- ✅ Secret immediately available after acquisition
- ✅ Development workflow uninterrupted

---

### Flow 4: User Approves/Denies Request in Web App

**Scenario:** User reviewing multiple pending MCP requests in approval dashboard

**UI Components:**

**Approval Dashboard:**

```tsx
// Component: MCP Approval Dashboard
function MCPApprovalDashboard() {
  const { data: pendingRequests } = useQuery('mcp-pending-requests',
    fetchPendingRequests
  );

  return (
    <div className="mcp-dashboard">
      <h2>Pending MCP Requests</h2>

      <RequestList>
        {pendingRequests.map(request => (
          <RequestCard key={request.id}>
            <RequestHeader>
              <ToolIcon name={request.tool_name} />
              <span>{request.tool_name}</span>
              <Badge>{request.environment}</Badge>
            </RequestHeader>

            <RequestBody>
              <SecretName>{request.secret_name}</SecretName>
              <ProjectName>{request.project_name}</ProjectName>
              <Reason>{request.request_reason}</Reason>
              <Timestamp>{formatRelative(request.created_at)}</Timestamp>
            </RequestBody>

            <RequestActions>
              <ApprovalForm requestId={request.id} />
            </RequestActions>
          </RequestCard>
        ))}
      </RequestList>
    </div>
  );
}
```

**Approval Form:**

```tsx
// Component: Approval Form
function ApprovalForm({ requestId }: { requestId: string }) {
  const [duration, setDuration] = useState(60); // Default 1 hour

  const approve = useMutation(async () => {
    await approveRequest(requestId, duration);
    toast.success('Access granted for ' + formatDuration(duration));
  });

  const deny = useMutation(async (reason: string) => {
    await denyRequest(requestId, reason);
    toast.success('Request denied');
  });

  return (
    <div className="approval-form">
      <DurationSelector
        value={duration}
        onChange={setDuration}
        options={[
          { label: '15 minutes', value: 15 },
          { label: '1 hour', value: 60 },
          { label: '8 hours', value: 480 },
          { label: '24 hours', value: 1440 }
        ]}
      />

      <ButtonGroup>
        <Button
          variant="primary"
          onClick={approve.mutate}
        >
          Approve ({formatDuration(duration)})
        </Button>

        <DenyButton
          onDeny={(reason) => deny.mutate(reason)}
        />
      </ButtonGroup>
    </div>
  );
}
```

**Notification Toast:**

```tsx
// Component: Real-time Notification Toast
function MCPRequestNotification({ request }: Props) {
  return (
    <Toast variant="info">
      <ToastHeader>
        <Icon name="shield-check" />
        <Title>{request.tool_name} needs access</Title>
      </ToastHeader>

      <ToastBody>
        <SecretName>{request.secret_name}</SecretName>
        <Project>{request.project_name}</Project>
        <Environment badge={request.environment}>
          {request.environment}
        </Environment>
      </ToastBody>

      <ToastActions>
        <Button size="sm" onClick={openApprovalModal}>
          Review
        </Button>
        <Button size="sm" variant="ghost" onClick={dismissToast}>
          Later
        </Button>
      </ToastActions>
    </Toast>
  );
}
```

**User Interactions:**

1. **Instant notification when request arrives**
   - Toast notification appears in top-right
   - Shows tool name, secret requested, project
   - Actions: "Review" (opens modal) or "Later" (dismiss)

2. **Approval modal with context**
   - Shows full request details
   - Displays last 3 access logs for this secret
   - Shows requester's role and permissions
   - Duration selector (15 min, 1 hour, 8 hours, 24 hours, custom)

3. **One-click approval**
   - Click "Approve" with selected duration
   - Secret decrypted in browser (Web Crypto API)
   - Sent securely to MCP server
   - Confirmation toast: "Access granted for 1 hour"

4. **Denial with reason**
   - Click "Deny" button
   - Modal prompts for denial reason
   - Reason sent to MCP server and requester
   - Suggestion provided (e.g., "Use staging instead")

---

### Flow 5: Time-Limited Access Expiration

**Scenario:** Access grant expires after configured duration

**Background Process:**

```typescript
// Cron job runs every 1 minute
export async function expireOldGrants() {
  // Find all grants that have expired
  const { data: expiredGrants } = await supabase
    .from('mcp_grants')
    .select('*')
    .eq('is_active', true)
    .lt('expires_at', new Date().toISOString());

  for (const grant of expiredGrants) {
    // Mark as expired
    await supabase
      .from('mcp_grants')
      .update({ is_active: false })
      .eq('id', grant.id);

    // Update request status
    await supabase
      .from('mcp_requests')
      .update({ status: 'expired' })
      .eq('id', grant.request_id);

    // Log expiration
    await logAuditEvent({
      action: 'mcp.grant.expired',
      user_id: grant.user_id,
      resource_type: 'secret',
      resource_id: grant.secret_id,
      metadata: {
        grant_id: grant.id,
        duration_minutes: calculateDuration(grant.granted_at, grant.expires_at),
        access_count: grant.access_count
      }
    });

    // Notify user (optional)
    await sendNotification({
      user_id: grant.user_id,
      title: 'MCP Access Expired',
      message: `Access to ${grant.secret_name} has expired. Re-request if needed.`,
      priority: 'low'
    });
  }
}
```

**MCP Server Handling:**

```typescript
// When AI tool tries to use expired secret
async function getSecret(secretId: string): Promise<SecretResult> {
  // Check if active grant exists
  const grant = await checkActiveGrant(secretId);

  if (!grant || !grant.is_active) {
    // Grant expired or doesn't exist
    return {
      success: false,
      error: 'ACCESS_EXPIRED',
      message: 'Your access to this secret has expired. Request access again?',
      actions: [
        { type: 'request_access', label: 'Request Access' },
        { type: 'cancel', label: 'Cancel' }
      ]
    };
  }

  // Grant is still active, return secret
  return {
    success: true,
    secret: grant.secret_value,
    expires_in: calculateTimeRemaining(grant.expires_at)
  };
}
```

**AI Tool Response:**

```
Claude Code:
"My access to the OpenAI API key has expired. Would you like me to
request access again? This will send another approval notification."

[Yes] [No, I'll add it manually]
```

---

## MCP Tools Specifications

### Tool 1: `mcp_secrets_list`

**Purpose:** List all secrets available in current project

**When to use:** AI tool wants to discover what secrets exist before requesting access

**Parameters:**

```typescript
interface ListSecretsParams {
  project_id: string;           // Current project UUID
  environment?: string;          // Filter by environment (optional)
  service_name?: string;         // Filter by service (optional)
  tags?: string[];               // Filter by tags (optional)
}
```

**Returns:**

```typescript
interface ListSecretsResult {
  success: boolean;
  secrets: Array<{
    id: string;                  // Secret UUID
    name: string;                // Key name (e.g., "OPENAI_API_KEY")
    service_name: string;        // Service (e.g., "openai")
    environment: string;         // "development" | "staging" | "production"
    tags: string[];              // Tags (e.g., ["ai", "api-key"])
    created_at: string;          // ISO timestamp
    has_active_grant: boolean;   // Whether AI tool currently has access
  }>;
  total: number;
}
```

**Example Usage:**

```typescript
// Claude Code checks what secrets exist
const result = await mcp.useTool('mcp_secrets_list', {
  project_id: 'current-project-uuid',
  environment: 'development'
});

// Result:
{
  success: true,
  secrets: [
    {
      id: 'uuid-1',
      name: 'OPENAI_API_KEY',
      service_name: 'openai',
      environment: 'development',
      tags: ['ai', 'llm'],
      created_at: '2026-01-15T10:30:00Z',
      has_active_grant: false
    },
    {
      id: 'uuid-2',
      name: 'SUPABASE_URL',
      service_name: 'supabase',
      environment: 'development',
      tags: ['database', 'backend'],
      created_at: '2026-01-14T09:00:00Z',
      has_active_grant: false
    }
  ],
  total: 2
}
```

**RBAC Enforcement:**
- Users can only list secrets they have permission to view
- Respects project membership and role
- Respects environment-based access (dev vs. prod)

**Performance:**
- Target: < 200ms response time
- Caching: List cached for 30 seconds (invalidated on secret changes)

---

### Tool 2: `mcp_secrets_get`

**Purpose:** Request access to specific secret (triggers approval flow)

**When to use:** AI tool needs actual secret value to complete task

**Parameters:**

```typescript
interface GetSecretParams {
  secret_id: string;             // Secret UUID (from list)
  project_id: string;            // Current project UUID
  reason: string;                // Why tool needs this secret
  duration_minutes?: number;     // Requested duration (default: 60)
}
```

**Returns:**

```typescript
interface GetSecretResult {
  success: boolean;
  secret?: {
    id: string;
    name: string;
    value: string;               // Decrypted secret value
    expires_at: string;          // When access expires
  };
  error?: string;                // Error code if failed
  message?: string;              // Human-readable message
  request_id?: string;           // Approval request UUID
}
```

**Behavior:**

1. **Check existing grant:**
   - If active grant exists → return secret immediately
   - If no grant → create approval request

2. **Create approval request:**
   - Insert row in `mcp_requests` table
   - Trigger notification to user (Realtime)
   - Begin polling for approval (timeout: 15 minutes)

3. **Wait for approval:**
   - Poll every 2 seconds
   - If approved → return decrypted secret
   - If denied → return error with reason
   - If timeout → return timeout error

**Example Usage:**

```typescript
// Claude Code requests secret
const result = await mcp.useTool('mcp_secrets_get', {
  secret_id: 'uuid-of-openai-key',
  project_id: 'current-project-uuid',
  reason: 'Implementing text summarization feature',
  duration_minutes: 60
});

// Success result:
{
  success: true,
  secret: {
    id: 'uuid-of-openai-key',
    name: 'OPENAI_API_KEY',
    value: 'sk-proj-abc123...',
    expires_at: '2026-01-15T11:30:00Z'
  },
  request_id: 'approval-request-uuid'
}

// Denial result:
{
  success: false,
  error: 'ACCESS_DENIED',
  message: 'Request denied by Admin. Reason: Testing should use staging.',
  request_id: 'approval-request-uuid'
}

// Timeout result:
{
  success: false,
  error: 'APPROVAL_TIMEOUT',
  message: 'No response received within 15 minutes. Request cancelled.',
  request_id: 'approval-request-uuid'
}
```

**RBAC Enforcement:**
- User must have permission to read secret
- Environment-based restrictions apply
- Production secrets may require admin approval (configurable)

**Security:**
- Secret value never stored in MCP server logs
- Decryption happens in browser (zero-knowledge maintained)
- Time-limited access automatically expires

---

### Tool 3: `mcp_secrets_request`

**Purpose:** Request a secret that doesn't exist yet (triggers guided acquisition)

**When to use:** AI tool needs secret but it's not in vault

**Parameters:**

```typescript
interface RequestSecretParams {
  service_name: string;          // Service name (e.g., "resend")
  key_name: string;              // Key name (e.g., "RESEND_API_KEY")
  project_id: string;            // Current project UUID
  environment: string;           // Target environment
  reason: string;                // Why tool needs this secret
  missing: true;                 // Always true (indicates missing)
}
```

**Returns:**

```typescript
interface RequestSecretResult {
  success: boolean;
  task_id: string;               // Acquisition task UUID
  message: string;               // Instructions for user
  status: 'pending' | 'in_progress' | 'completed';
  estimated_time_minutes: number; // Estimated acquisition time
}
```

**Behavior:**

1. **Create acquisition task:**
   - Insert row in `acquisition_tasks` table
   - Generate AI-powered acquisition steps (via Claude API)
   - Notify user in web app

2. **User completes acquisition:**
   - Web app opens guided acquisition modal
   - User follows steps, obtains API key
   - User adds key to Abyrith vault

3. **MCP server polls task status:**
   - Check every 5 seconds
   - When completed → automatically invoke `mcp_secrets_get`
   - Return secret to AI tool

**Example Usage:**

```typescript
// Claude Code discovers missing secret
const result = await mcp.useTool('mcp_secrets_request', {
  service_name: 'resend',
  key_name: 'RESEND_API_KEY',
  project_id: 'current-project-uuid',
  environment: 'development',
  reason: 'Implementing email notifications',
  missing: true
});

// Result:
{
  success: true,
  task_id: 'acquisition-task-uuid',
  message: 'I\'ve opened the guided acquisition flow in your browser. Follow the steps to get your Resend API key.',
  status: 'pending',
  estimated_time_minutes: 5
}

// After user completes acquisition:
{
  success: true,
  task_id: 'acquisition-task-uuid',
  status: 'completed',
  secret_id: 'newly-created-secret-uuid',
  message: 'API key added successfully. Requesting access now...'
}
```

**AI Integration:**
- Claude API generates step-by-step acquisition instructions
- FireCrawl scrapes latest documentation if needed
- Instructions tailored to user's persona (beginner vs. advanced)

---

### Tool 4: `mcp_secrets_search`

**Purpose:** Search for secrets by name, service, or tags

**When to use:** AI tool wants to find secrets without knowing exact IDs

**Parameters:**

```typescript
interface SearchSecretsParams {
  query: string;                 // Search query
  project_id: string;            // Current project UUID
  environment?: string;          // Filter by environment (optional)
  limit?: number;                // Max results (default: 10)
}
```

**Returns:**

```typescript
interface SearchSecretsResult {
  success: boolean;
  results: Array<{
    id: string;
    name: string;
    service_name: string;
    environment: string;
    tags: string[];
    relevance_score: number;     // 0.0 - 1.0 (search relevance)
    has_active_grant: boolean;
  }>;
  total: number;
}
```

**Search Algorithm:**

```typescript
// Fuzzy search across multiple fields
function searchSecrets(query: string) {
  return supabase
    .from('secrets')
    .select('*')
    .or(`
      name.ilike.%${query}%,
      service_name.ilike.%${query}%,
      tags.cs.{${query}}
    `)
    .order('created_at', { ascending: false })
    .limit(10);
}
```

**Example Usage:**

```typescript
// Claude Code searches for OpenAI keys
const result = await mcp.useTool('mcp_secrets_search', {
  query: 'openai',
  project_id: 'current-project-uuid',
  environment: 'development',
  limit: 5
});

// Result:
{
  success: true,
  results: [
    {
      id: 'uuid-1',
      name: 'OPENAI_API_KEY',
      service_name: 'openai',
      environment: 'development',
      tags: ['ai', 'llm', 'gpt-4'],
      relevance_score: 1.0,
      has_active_grant: false
    },
    {
      id: 'uuid-2',
      name: 'OPENAI_ORG_ID',
      service_name: 'openai',
      environment: 'development',
      tags: ['ai', 'config'],
      relevance_score: 0.8,
      has_active_grant: false
    }
  ],
  total: 2
}
```

**Performance:**
- Full-text search on indexed fields
- Results cached for 60 seconds
- Target: < 150ms response time

---

## Approval Workflow State Machine

### States

```typescript
enum RequestStatus {
  PENDING = 'pending',         // Awaiting user approval
  APPROVED = 'approved',       // User approved, grant active
  DENIED = 'denied',           // User denied request
  EXPIRED = 'expired',         // Request timed out (15 min) or grant expired
  REVOKED = 'revoked'          // Admin manually revoked grant
}
```

### State Transition Rules

```typescript
interface StateTransition {
  from: RequestStatus;
  event: string;
  to: RequestStatus;
  conditions?: string[];
  actions: string[];
}

const transitions: StateTransition[] = [
  {
    from: RequestStatus.PENDING,
    event: 'user_approves',
    to: RequestStatus.APPROVED,
    actions: [
      'create_grant_record',
      'decrypt_secret_client_side',
      'return_secret_to_mcp',
      'log_approval_event',
      'start_expiration_timer'
    ]
  },
  {
    from: RequestStatus.PENDING,
    event: 'user_denies',
    to: RequestStatus.DENIED,
    actions: [
      'record_denial_reason',
      'log_denial_event',
      'return_error_to_mcp'
    ]
  },
  {
    from: RequestStatus.PENDING,
    event: 'timeout_15min',
    to: RequestStatus.EXPIRED,
    actions: [
      'log_timeout_event',
      'return_timeout_error_to_mcp'
    ]
  },
  {
    from: RequestStatus.APPROVED,
    event: 'duration_expires',
    to: RequestStatus.EXPIRED,
    actions: [
      'deactivate_grant',
      'log_expiration_event',
      'notify_user_optional'
    ]
  },
  {
    from: RequestStatus.APPROVED,
    event: 'admin_revokes',
    to: RequestStatus.REVOKED,
    conditions: ['user_is_admin'],
    actions: [
      'deactivate_grant_immediately',
      'log_revocation_event',
      'notify_requester',
      'return_revoked_error_to_mcp'
    ]
  }
];
```

### State Diagram

```
                    ┌────────────────┐
                    │   AI Tool      │
                    │ Requests Secret│
                    └───────┬────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   PENDING     │
                    │               │
                    │ Timeout: 15min│
                    └───┬───┬───┬───┘
                        │   │   │
        ┌───────────────┘   │   └───────────────┐
        │                   │                   │
        │                   │                   │
    User Approves       User Denies         Timeout
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   APPROVED    │   │    DENIED     │   │    EXPIRED    │
│               │   │               │   │               │
│ Grant Created │   │ Immediate End │   │ Request Failed│
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        │ Duration Timer
        │ (1-24 hours)
        ▼
┌───────────────┐
│   EXPIRED     │
│               │
│ Grant Ended   │
└───────────────┘

Special Transition:
APPROVED ──admin_revokes──> REVOKED (emergency revocation)
```

---

## Security Considerations

### Zero-Knowledge Encryption Compatibility

**Challenge:** How can MCP server return decrypted secrets while maintaining zero-knowledge architecture?

**Solution:** Two-phase approval with client-side decryption

1. **Phase 1: Approval Request**
   - MCP server creates approval request (no secrets involved)
   - User notified in web app

2. **Phase 2: Client-Side Decryption**
   - User approves in web app
   - Web app decrypts secret client-side (using master key in memory)
   - Decrypted secret sent to MCP server via secure channel
   - MCP server returns secret to AI tool
   - Secret never stored on server, only transmitted

**Security Properties:**
- ✅ Server never sees master key
- ✅ Server never decrypts secrets
- ✅ Decryption only happens in user's browser
- ✅ Time-limited access prevents long-term secret exposure
- ✅ Full audit trail of all access

**Threat Model:**

| Threat | Mitigation |
|--------|------------|
| MCP server compromise | Server has no decryption capability; secrets encrypted at rest |
| Man-in-the-middle (MCP ↔ API) | TLS 1.3, certificate pinning (future) |
| Malicious AI tool | Approval workflow prevents unauthorized access; RBAC enforcement |
| Stolen JWT token | Short expiration (15 min), revocable sessions |
| Replay attacks | Nonce-based requests, timestamp validation |
| Insider threat | Zero-knowledge architecture; no employee can see secrets |

---

### Authentication & Authorization

**MCP Server Authentication:**

```typescript
// OAuth2 flow for MCP server setup
async function authenticateMCPServer() {
  // 1. User initiates auth from CLI
  const authUrl = await generateAuthURL();
  console.log(`Open this URL to authenticate: ${authUrl}`);

  // 2. User completes OAuth in browser
  // 3. Abyrith issues long-lived refresh token
  const tokens = await exchangeAuthCode(authCode);

  // 4. Store tokens locally (encrypted)
  await storeTokens({
    access_token: tokens.access_token,   // Short-lived (15 min)
    refresh_token: tokens.refresh_token, // Long-lived (90 days)
    user_id: tokens.user_id,
    expires_at: tokens.expires_at
  });
}

// Every MCP request includes JWT
async function makeAuthenticatedRequest(endpoint: string, data: any) {
  // Refresh access token if expired
  if (isTokenExpired(accessToken)) {
    accessToken = await refreshAccessToken(refreshToken);
  }

  // Include in Authorization header
  return fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}
```

**RBAC Enforcement:**

```typescript
// Every MCP request checked against RBAC policies
async function checkMCPPermission(params: {
  user_id: string;
  project_id: string;
  secret_id: string;
  action: 'read' | 'write';
  environment: string;
}): Promise<boolean> {
  // 1. Check project membership
  const membership = await getProjectMembership(
    params.user_id,
    params.project_id
  );

  if (!membership) return false;

  // 2. Check role permissions
  const rolePermissions = getRolePermissions(membership.role);

  // 3. Check environment restrictions
  if (params.environment === 'production') {
    // Only Owners and Admins can access production
    if (!['owner', 'admin'].includes(membership.role)) {
      return false;
    }
  }

  // 4. Check action permission
  return rolePermissions.includes(params.action);
}
```

**Permission Matrix:**

| Role | Dev Secrets | Staging Secrets | Production Secrets | Approve Own Requests | Approve Others' Requests |
|------|-------------|-----------------|-------------------|---------------------|-------------------------|
| Owner | ✅ Read/Write | ✅ Read/Write | ✅ Read/Write | ✅ Yes | ✅ Yes |
| Admin | ✅ Read/Write | ✅ Read/Write | ✅ Read/Write | ✅ Yes | ✅ Yes |
| Developer | ✅ Read/Write | ✅ Read | ❌ No Access | ✅ Yes (Dev only) | ❌ No |
| Read-Only | ✅ Read | ✅ Read | ❌ No Access | ❌ No | ❌ No |

---

### Audit Logging

**All MCP activity logged:**

```typescript
interface MCPAuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  action: MCPAction;
  resource_type: 'secret' | 'request' | 'grant';
  resource_id: string;
  tool_name: string;
  tool_version: string;
  project_id: string;
  environment: string;
  result: 'success' | 'failure';
  error_code?: string;
  metadata: {
    request_id?: string;
    grant_id?: string;
    duration_minutes?: number;
    denial_reason?: string;
    [key: string]: any;
  };
  ip_address: string;
  user_agent: string;
}

enum MCPAction {
  // Tool invocations
  'mcp.list' = 'mcp.list',
  'mcp.get' = 'mcp.get',
  'mcp.search' = 'mcp.search',
  'mcp.request' = 'mcp.request',

  // Approval workflow
  'mcp.request.created' = 'mcp.request.created',
  'mcp.request.approved' = 'mcp.request.approved',
  'mcp.request.denied' = 'mcp.request.denied',
  'mcp.request.timeout' = 'mcp.request.timeout',

  // Grant lifecycle
  'mcp.grant.created' = 'mcp.grant.created',
  'mcp.grant.accessed' = 'mcp.grant.accessed',
  'mcp.grant.expired' = 'mcp.grant.expired',
  'mcp.grant.revoked' = 'mcp.grant.revoked'
}
```

**Compliance Queries:**

```sql
-- All MCP access to production secrets in date range
SELECT
  al.timestamp,
  u.email,
  al.tool_name,
  s.key_name,
  al.action,
  al.result
FROM audit_logs al
JOIN auth.users u ON u.id = al.user_id
JOIN secrets s ON s.id = al.resource_id
WHERE al.action LIKE 'mcp.%'
  AND s.environment = 'production'
  AND al.timestamp BETWEEN '2026-01-01' AND '2026-03-31'
ORDER BY al.timestamp DESC;

-- Denied MCP requests (security review)
SELECT
  al.timestamp,
  u.email,
  mr.secret_name,
  mr.request_reason,
  mr.denial_reason,
  approver.email as denied_by
FROM audit_logs al
JOIN mcp_requests mr ON mr.id = al.resource_id
JOIN auth.users u ON u.id = al.user_id
LEFT JOIN auth.users approver ON approver.id = mr.denied_by
WHERE al.action = 'mcp.request.denied'
ORDER BY al.timestamp DESC;
```

---

## Performance Requirements

### Response Time Targets

| Operation | Target (p95) | Maximum | Notes |
|-----------|--------------|---------|-------|
| `mcp_secrets_list` | 200ms | 500ms | Cached for 30 seconds |
| `mcp_secrets_search` | 150ms | 400ms | Full-text search indexed |
| `mcp_secrets_get` (with grant) | 100ms | 300ms | Grant check + secret fetch |
| `mcp_secrets_get` (approval flow) | 2-10s | 15min | Depends on user response |
| `mcp_secrets_request` | 5-300s | 15min | Depends on acquisition time |
| Approval notification delivery | 1s | 3s | Supabase Realtime latency |
| Client-side decryption | 50ms | 200ms | Web Crypto API |

### Scalability Targets

**MVP (Q1 2026):**
- 1,000 active users
- 10,000 MCP requests/day
- 100 concurrent approval workflows
- 10,000 active grants

**Post-MVP (Q2 2026):**
- 10,000 active users
- 100,000 MCP requests/day
- 1,000 concurrent approval workflows
- 100,000 active grants

**Enterprise (Q3 2026):**
- 100,000+ active users
- 1M+ MCP requests/day
- 10,000+ concurrent workflows
- 1M+ active grants

### Optimization Strategies

**Caching:**
```typescript
// Cache secrets list for 30 seconds
const cacheKey = `secrets:${userId}:${projectId}`;
const cached = await kv.get(cacheKey);
if (cached && Date.now() - cached.timestamp < 30000) {
  return cached.data;
}

// Fetch from database
const secrets = await fetchSecrets(userId, projectId);

// Store in cache
await kv.set(cacheKey, {
  data: secrets,
  timestamp: Date.now()
}, { ex: 30 });
```

**Database Indexes:**
```sql
-- Optimize secrets listing
CREATE INDEX idx_secrets_user_project_env
  ON secrets(user_id, project_id, environment);

-- Optimize grant lookups
CREATE INDEX idx_mcp_grants_active_secret
  ON mcp_grants(is_active, secret_id, user_id);

-- Optimize audit log queries
CREATE INDEX idx_audit_logs_mcp_actions
  ON audit_logs(action, timestamp DESC)
  WHERE action LIKE 'mcp.%';
```

**Connection Pooling:**
```typescript
// Supabase connection pool configuration
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    pooler: {
      mode: 'transaction',
      connections: 100,
      max_client_conn: 1000
    }
  }
});
```

---

## Testing Strategy

### Unit Tests

**MCP Server:**

```typescript
// Test: MCP tool invocation
describe('mcp_secrets_list', () => {
  it('returns secrets for authenticated user', async () => {
    const result = await mcpServer.handleToolCall('mcp_secrets_list', {
      project_id: testProjectId
    });

    expect(result.success).toBe(true);
    expect(result.secrets).toHaveLength(3);
    expect(result.secrets[0]).toHaveProperty('id');
    expect(result.secrets[0]).toHaveProperty('name');
  });

  it('enforces RBAC permissions', async () => {
    // User without project access
    const result = await mcpServer.handleToolCall('mcp_secrets_list', {
      project_id: unauthorizedProjectId
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('PERMISSION_DENIED');
  });
});

// Test: Approval workflow
describe('mcp_secrets_get approval flow', () => {
  it('creates approval request when grant does not exist', async () => {
    const promise = mcpServer.handleToolCall('mcp_secrets_get', {
      secret_id: testSecretId,
      project_id: testProjectId,
      reason: 'Test reason'
    });

    // Wait for request creation
    await waitFor(() => {
      expect(getApprovalRequests()).toHaveLength(1);
    });

    // Simulate approval
    await approveRequest(getApprovalRequests()[0].id);

    // Wait for result
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.secret.value).toBe('test-secret-value');
  });

  it('returns existing grant immediately', async () => {
    // Create active grant
    await createActiveGrant(testSecretId, testUserId);

    const start = Date.now();
    const result = await mcpServer.handleToolCall('mcp_secrets_get', {
      secret_id: testSecretId,
      project_id: testProjectId,
      reason: 'Test reason'
    });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(500); // No approval needed
  });
});
```

### Integration Tests

**End-to-End Approval Flow:**

```typescript
describe('MCP Integration: Full Approval Flow', () => {
  it('completes approval flow from request to secret delivery', async () => {
    // 1. MCP server requests secret
    const requestPromise = mcpClient.getSecret({
      secret_id: testSecretId,
      reason: 'Integration test'
    });

    // 2. Wait for notification in web app
    const notification = await waitForNotification();
    expect(notification.type).toBe('mcp_request');

    // 3. User approves in web app
    await webApp.approveMCPRequest(notification.request_id, {
      duration_minutes: 60
    });

    // 4. MCP server receives secret
    const result = await requestPromise;
    expect(result.success).toBe(true);
    expect(result.secret.value).toBeDefined();

    // 5. Verify grant created
    const grant = await getActiveGrant(testSecretId, testUserId);
    expect(grant).toBeDefined();
    expect(grant.is_active).toBe(true);

    // 6. Verify audit log
    const auditLogs = await getAuditLogs({
      action: 'mcp.request.approved',
      resource_id: testSecretId
    });
    expect(auditLogs).toHaveLength(1);
  });
});
```

### E2E Tests (Playwright)

**Test with Real AI Tool:**

```typescript
test('Claude Code MCP integration', async ({ page }) => {
  // 1. Setup: Add secret to vault
  await addSecretToVault({
    name: 'TEST_API_KEY',
    value: 'test-value-123',
    project: 'test-project'
  });

  // 2. Start Claude Code with MCP server
  const claudeCode = await startClaudeCode({
    mcpServers: ['abyrith']
  });

  // 3. Ask Claude Code to use the secret
  await claudeCode.sendMessage(
    'Use the TEST_API_KEY to make an API call'
  );

  // 4. Wait for approval notification
  await page.waitForSelector('[data-testid="mcp-notification"]');

  // 5. Approve request
  await page.click('[data-testid="approve-button"]');

  // 6. Verify Claude Code received secret
  await claudeCode.waitForResponse();
  const response = await claudeCode.getLastResponse();
  expect(response).toContain('API call successful');

  // 7. Verify audit log
  const auditLog = await page.goto('/activity');
  await expect(page.locator('text=Claude Code accessed TEST_API_KEY')).toBeVisible();
});
```

### Performance Tests

**Load Testing:**

```typescript
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 }     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests < 500ms
    'http_req_failed': ['rate<0.01']    // Error rate < 1%
  }
};

export default function() {
  // Test mcp_secrets_list
  const listResponse = http.post('https://api.abyrith.com/mcp/list',
    JSON.stringify({ project_id: testProjectId }),
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  check(listResponse, {
    'list status is 200': (r) => r.status === 200,
    'list response time < 200ms': (r) => r.timings.duration < 200
  });

  // Test mcp_secrets_get with existing grant
  const getResponse = http.post('https://api.abyrith.com/mcp/get',
    JSON.stringify({
      secret_id: testSecretId,
      project_id: testProjectId,
      reason: 'Load test'
    }),
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  check(getResponse, {
    'get status is 200': (r) => r.status === 200,
    'get response time < 300ms': (r) => r.timings.duration < 300
  });
}
```

### Security Tests

**Penetration Testing Scenarios:**

1. **Unauthorized access attempts**
   - Try to access secrets without JWT
   - Try to access secrets from different project
   - Try to access production secrets with developer role

2. **Token manipulation**
   - Expired JWT token
   - Invalid JWT signature
   - Token from different user

3. **Approval bypass attempts**
   - Request secret, modify request ID
   - Forge approval response
   - Replay old approval

4. **RBAC violations**
   - Developer trying to approve production access
   - Read-only user trying to get secrets
   - Non-member trying to access project secrets

5. **Audit log tampering**
   - Attempt to delete audit logs
   - Attempt to modify audit logs
   - Verify append-only constraint

**All tests must pass before MVP launch.**

---

## Implementation Plan

### Phase 1: Core MCP Server (Weeks 1-2)

**Week 1: MCP Server Foundation**
- [ ] Set up Node.js TypeScript project structure
- [ ] Install MCP SDK and dependencies
- [ ] Implement authentication (OAuth2 flow)
- [ ] Implement 4 MCP tools (list, get, request, search)
- [ ] Write unit tests for tools

**Week 2: Approval Workflow**
- [ ] Implement approval request creation
- [ ] Implement polling mechanism
- [ ] Handle approval/denial responses
- [ ] Implement time-limited grants
- [ ] Write integration tests

### Phase 2: API Endpoints (Weeks 2-3)

**Week 2-3: Backend API**
- [ ] Create MCP endpoints (see `05-api/endpoints/mcp-endpoints.md`)
- [ ] Implement RBAC enforcement
- [ ] Implement Supabase Realtime notifications
- [ ] Create database tables (mcp_requests, mcp_grants)
- [ ] Write API tests

### Phase 3: Web App Integration (Weeks 3-4)

**Week 3: Notification UI**
- [ ] Real-time notification toast component
- [ ] Approval modal component
- [ ] Duration selector component
- [ ] Deny with reason modal

**Week 4: Dashboard & Activity**
- [ ] MCP approval dashboard
- [ ] Active grants visualization
- [ ] Recent requests history
- [ ] Pending approvals inbox

### Phase 4: Testing & Documentation (Week 5)

**Week 5: QA & Polish**
- [ ] E2E tests with Claude Code
- [ ] E2E tests with Cursor
- [ ] Performance testing (load tests)
- [ ] Security penetration testing
- [ ] User documentation
- [ ] Setup guides for Claude Code and Cursor

### Phase 5: Beta Launch (Week 6)

**Week 6: Beta Testing**
- [ ] Deploy to production
- [ ] Invite 10 beta users
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Prepare for MVP launch

**Total Implementation Time:** 6 weeks (within MVP timeline)

---

## Success Metrics

### Adoption Metrics

**MVP (Month 1):**
- 70% of Claude Code users enable MCP integration
- 50% of Cursor users enable MCP integration
- 100+ MCP requests processed successfully
- 10+ teams using MCP for development workflows

**Post-MVP (Month 3):**
- 90% of Claude Code users use MCP daily
- 80% of Cursor users use MCP daily
- 10,000+ MCP requests/day
- 50+ teams with 5+ developers using MCP

### Performance Metrics

**Target:**
- 95% of approval requests completed within 10 seconds
- < 200ms p95 response time for list/search
- < 300ms p95 response time for get (with grant)
- 99.9% uptime for MCP server

**Measured:**
- Average time from request to approval: **target < 5 seconds**
- Average time from approval to secret delivery: **target < 2 seconds**
- MCP server success rate: **target > 99.5%**

### Security Metrics

**Target:**
- Zero unauthorized access incidents
- 100% of MCP activity logged
- 100% RBAC enforcement (no bypass)
- 100% zero-knowledge architecture maintained

**Measured:**
- Number of denied requests (should be > 0, indicates RBAC working)
- Number of expired grants (should be > 0, indicates time-limiting working)
- Number of security audit findings: **target = 0**

### User Satisfaction Metrics

**Target:**
- NPS score > 50 for MCP feature
- < 5% support tickets related to MCP issues
- > 4.5/5 rating for "MCP makes AI development easier"
- > 4.5/5 rating for "MCP approval flow is clear and fast"

**Feedback Questions:**
1. "How satisfied are you with MCP integration?" (1-5 scale)
2. "MCP makes my AI development workflow faster" (Agree/Disagree)
3. "I feel secure with MCP approval workflow" (Agree/Disagree)
4. "What would improve the MCP experience?"

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/security-model.md` - Zero-knowledge architecture defined
- [x] `09-integrations/mcp/mcp-overview.md` - MCP architecture overview
- [x] `09-integrations/mcp/mcp-secrets-server.md` - MCP server technical spec
- [ ] `05-api/endpoints/mcp-endpoints.md` - MCP API endpoints (to be created)
- [x] `08-features/zero-knowledge-vault/encryption-ux-flow.md` - Encryption workflow
- [x] `ROADMAP.md` - MCP listed as MVP critical feature
- [x] `GLOSSARY.md` - Terminology definitions

**External Dependencies:**
- MCP SDK (@anthropic/mcp-sdk) - Official SDK from Anthropic
- Claude Code - AI development tool (supports MCP)
- Cursor - AI-powered IDE (supports MCP)
- Supabase Realtime - WebSocket notifications
- Web Crypto API - Client-side encryption

### Infrastructure Dependencies

**Required services:**
- Supabase PostgreSQL - Database for requests/grants
- Cloudflare Workers - API gateway
- Supabase Realtime - Real-time notifications
- Cloudflare Pages - Web app hosting

**Database tables:**
- `mcp_requests` - Approval requests
- `mcp_grants` - Time-limited access grants
- `audit_logs` - Activity logging
- `secrets` - Encrypted secrets (already exists)
- `projects` - Project organization (already exists)
- `project_members` - Team memberships (already exists)

---

## References

### Internal Documentation

- [MCP Secrets Server Integration Guide](../../09-integrations/mcp/mcp-secrets-server.md) - Technical implementation
- [MCP Architecture Overview](../../09-integrations/mcp/mcp-overview.md) - High-level architecture
- [Zero-Knowledge Encryption UX Flow](../zero-knowledge-vault/encryption-ux-flow.md) - Encryption workflow
- [Security Model](../../03-security/security-model.md) - Zero-knowledge architecture
- [Product Roadmap](../../ROADMAP.md) - MCP as MVP feature
- [Glossary](../../GLOSSARY.md) - Terminology definitions

### External Resources

- [Model Context Protocol Specification](https://github.com/anthropics/mcp) - Official MCP protocol
- [Claude Code Documentation](https://docs.anthropic.com/claude-code) - Claude Code MCP integration
- [Cursor MCP Guide](https://cursor.sh/docs/mcp) - Cursor MCP setup
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) - Real-time notifications
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Browser encryption

### Related Features

- **AI Secret Assistant** - Uses MCP to trigger guided acquisition
- **Approval Workflows** - Reused for enterprise dual authorization (Phase 2)
- **Audit Logging** - Comprehensive MCP activity tracking
- **RBAC** - Environment-based access control for MCP

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-02 | Product Lead / Engineering Lead | Initial MCP feature documentation (MVP critical) |

---

## Next Steps

1. **Create API endpoints documentation:** `05-api/endpoints/mcp-endpoints.md`
2. **Begin implementation:** Start with Phase 1 (Core MCP Server)
3. **Security review:** Third-party review of approval workflow and zero-knowledge compatibility
4. **Beta testing:** Recruit 10 Claude Code/Cursor users for early testing
5. **Prepare launch:** User guides, setup documentation, video tutorials

**Status:** Ready for implementation (all dependencies documented)

**Estimated Completion:** 6 weeks from start of development

---

**Document Status:** Draft → Pending review by Product Lead, Security Lead, and Engineering Lead
