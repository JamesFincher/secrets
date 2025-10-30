---
Document: Claude Code - Integration Guide
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Integration Team
Status: Draft
Dependencies: 09-integrations/mcp/mcp-overview.md, 08-features/ai-assistant/ai-assistant-overview.md, 03-security/security-model.md, 05-api/endpoints/secrets-endpoints.md
---

# Claude Code Integration

## Overview

The Claude Code integration is a **key differentiator** for Abyrith, enabling seamless, AI-native secrets management directly within Claude's official AI coding assistant. Claude Code can request, access, and utilize secrets stored in Abyrith with user approval, eliminating manual copy-paste workflows and maintaining zero-knowledge security throughout.

**External Service:** [Claude Code](https://claude.ai/code) by Anthropic

**Integration Type:** MCP Client (Abyrith MCP Server)

**Status:** Active (MVP Feature - Phase 5)

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [User Setup Instructions](#user-setup-instructions)
6. [Example Workflows](#example-workflows)
7. [Implementation Details](#implementation-details)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Monitoring](#monitoring)
11. [Security Considerations](#security-considerations)
12. [Cost & Rate Limits](#cost--rate-limits)
13. [Troubleshooting](#troubleshooting)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Integration Purpose

### Business Value

**What it enables:**
- Claude Code users can request secrets from Abyrith without leaving their IDE workflow
- One-time approval grants Claude Code access to secrets for specified time periods
- Complete audit trail of which secrets Claude Code accessed and when
- Zero-knowledge security maintained (secrets only decrypted client-side)
- AI-native workflow: Claude Code discovers secrets contextually when needed

**User benefits:**
- **For Learners:** Claude Code automatically helps you get API keys you need for tutorials
- **For Solo Developers:** Seamless development workflow without managing .env files
- **For Development Teams:** Team members approve AI access without sharing plaintext credentials
- **For Enterprise:** Complete visibility and control over AI tool secret access with audit trails

### Technical Purpose

**Responsibilities:**
- Expose Abyrith MCP server to Claude Code via stdio/HTTP protocol
- Handle Claude Code secret requests through approval workflow
- Maintain zero-knowledge architecture (decryption client-side only)
- Provide detailed audit logging of all Claude Code requests
- Rate limiting to prevent abuse

**Integration Points:**
- Claude Code desktop application discovers Abyrith MCP server via configuration file
- MCP server runs as background process when Claude Code starts
- Claude Code sends JSON-RPC requests over stdio to Abyrith MCP server
- MCP server communicates with Abyrith API for secret metadata and approvals
- User approves requests in Abyrith web app (browser-based)

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Claude Code Desktop App                     │
│  • User writes code requiring API keys                           │
│  • Claude Code detects need for secrets                          │
│  • Sends MCP request to Abyrith server                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ JSON-RPC over stdio
                       │ (MCP Protocol)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│          Abyrith MCP Server (Node.js background process)        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Exposes MCP Tools:                                      │   │
│  │  • abyrith_secrets_list                                  │   │
│  │  • abyrith_secrets_get (requires approval)               │   │
│  │  • abyrith_secrets_request (for missing secrets)         │   │
│  │  • abyrith_secrets_search                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ HTTPS (JWT Auth)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (API Gateway)                    │
│  • Validate JWT from MCP server                                  │
│  • Rate limiting (per user, per Claude Code instance)           │
│  • Route to Supabase or trigger approval flow                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│  Supabase DB    │         │  Abyrith Web App │
│  • Secret       │         │  • User sees     │
│    metadata     │         │    approval      │
│  • Approval     │         │    request       │
│    records      │         │  • Approves      │
│  • Audit logs   │         │    access        │
└─────────────────┘         └──────────────────┘
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
               ┌───────────────────┐
               │  User's Browser   │
               │  • Receives       │
               │    encrypted      │
               │    secret         │
               │  • Decrypts       │
               │    client-side    │
               └───────────────────┘
```

### Data Flow

**Flow 1: Claude Code discovers MCP server on startup**

1. User launches Claude Code desktop application
2. Claude Code reads `~/.config/Claude/claude_desktop_config.json`
3. Finds `abyrith` MCP server configuration
4. Spawns `abyrith-mcp serve` as child process (stdio communication)
5. MCP server initializes, loads JWT from OS keychain
6. Claude Code sends `mcp/initialize` handshake
7. MCP server responds with available tools list
8. Claude Code now has access to Abyrith secrets via MCP tools

**Flow 2: Claude Code requests secret (with approval)**

1. **Claude Code detects need:** User asks "Help me set up OpenAI integration"
2. **Request sent:** Claude Code calls `abyrith_secrets_get("OPENAI_API_KEY")`
3. **MCP server checks approval:** No approval cached for this secret
4. **Trigger approval flow:**
   - MCP server calls Abyrith API: `POST /api/v1/mcp/approvals`
   - API creates approval request record in Supabase
   - Approval request ID returned to MCP server
5. **User notification:**
   - Abyrith web app (if open) receives real-time notification via Supabase Realtime
   - Browser notification: "Claude Code requests OPENAI_API_KEY"
   - User clicks notification, sees approval modal
6. **User approves:**
   - User selects time limit: "1 hour", "24 hours", "Always"
   - Web app sends approval: `PUT /api/v1/mcp/approvals/{id}`
   - Approval record updated in Supabase
7. **MCP server notified:**
   - MCP server polling `GET /api/v1/mcp/approvals/{id}` every 2 seconds
   - Approval status changes to `approved`
   - MCP server caches approval with expiration time
8. **Fetch encrypted secret:**
   - MCP server calls `GET /api/v1/secrets/OPENAI_API_KEY`
   - API returns encrypted blob (AES-256-GCM ciphertext)
9. **Decrypt secret:**
   - MCP server requests decryption from web app (if browser open) OR
   - MCP server prompts user for master password in system dialog
   - Decryption happens client-side using Web Crypto API
   - Plaintext secret held in memory only
10. **Return to Claude Code:**
    - MCP server returns: `{ name: "OPENAI_API_KEY", value: "sk-proj-abc123..." }`
    - Claude Code uses secret in code generation
    - Secret value never logged or persisted

**Flow 3: Secret request for missing key (guided acquisition)**

1. Claude Code calls `abyrith_secrets_request("STRIPE_API_KEY", { service: "Stripe" })`
2. MCP server creates secret request in Abyrith
3. User receives notification: "Claude Code needs STRIPE_API_KEY"
4. User opens Abyrith web app, sees AI Assistant prompt
5. AI Assistant: "Let me help you get a Stripe API key..."
6. AI provides step-by-step guided acquisition (via FireCrawl scraped docs)
7. User follows steps, obtains key, stores in Abyrith
8. MCP server receives notification that secret is available
9. Claude Code automatically retries `abyrith_secrets_get("STRIPE_API_KEY")`
10. Approval flow (Flow 2) kicks in, Claude Code receives secret

### Components Involved

**Frontend:**
- Approval UI (modal in Abyrith web app showing Claude Code icon + secret name)
- Real-time notification component (Supabase Realtime subscription)
- MCP request activity log page (shows all Claude Code requests)

**Backend:**
- **Abyrith MCP Server** (Node.js): Standalone process implementing MCP stdio protocol
- **Cloudflare Workers**: API gateway, JWT validation, rate limiting
- **Supabase Database**: Approval records, audit logs, secret metadata
- **Supabase Realtime**: WebSocket for instant approval notifications

**External:**
- **Claude Code Desktop App**: MCP client, spawns MCP server as child process
- **MCP Protocol**: JSON-RPC over stdin/stdout

---

## Authentication

### Authentication Method

**Type:** JWT Bearer Token + Device Authorization

**How it works:**

1. **Initial Device Authorization (one-time setup):**
   - User runs `abyrith-mcp auth` in terminal
   - Opens browser to Abyrith web app at `/mcp/authorize`
   - User logs in (if not already authenticated)
   - User sees authorization screen: "Authorize Claude Code on this device?"
   - Shows device info: hostname, OS, browser used for auth
   - User clicks "Authorize"
   - Browser redirects with authorization code
   - MCP server exchanges code for long-lived JWT (refresh token)
   - JWT stored securely in OS keychain

2. **Per-Request Authentication:**
   - MCP server includes JWT in `Authorization: Bearer {token}` header
   - Cloudflare Worker validates JWT signature using Supabase Auth keys
   - JWT contains: `user_id`, `org_id`, `device_id`, `iat`, `exp`
   - Worker enforces Row-Level Security policies using JWT claims

3. **Token Refresh:**
   - Access tokens expire after 1 hour
   - Refresh token valid for 30 days
   - MCP server automatically refreshes access token when expired
   - If refresh fails, user prompted to re-authenticate

4. **Master Key for Decryption:**
   - User's master password NEVER transmitted to MCP server or API
   - Two decryption options:
     - **Option A (preferred):** Browser open → MCP server requests decryption from web app via WebSocket
     - **Option B:** Browser closed → System password dialog prompts user for master password
   - Decryption happens in secure memory, master key zeroed after use

### Credentials Management

**Where credentials are stored:**

**Development:**
- JWT stored in OS keychain:
  - **macOS:** Keychain Access (`abyrith-mcp-token` entry)
  - **Windows:** Credential Manager (`abyrith-mcp-token`)
  - **Linux:** Secret Service API (`abyrith-mcp-token`)
- Credentials encrypted at rest by OS

**Credential Format:**
```bash
# Stored in OS keychain (not visible to user)
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2025-10-30T14:00:00Z",
  "user_id": "uuid",
  "device_id": "uuid"
}
```

### Obtaining Credentials

**Step 1: Install Abyrith MCP Server**

```bash
# Option 1: npm (recommended)
npm install -g @abyrith/mcp-server

# Option 2: Homebrew (macOS/Linux)
brew tap abyrith/tap
brew install abyrith-mcp

# Option 3: Direct download (Windows)
# Download from https://github.com/abyrith/mcp-server/releases
```

**Step 2: Authenticate**

```bash
# Run authentication command
abyrith-mcp auth

# Output:
# 🔐 Abyrith MCP Authentication
#
# Opening browser to authorize Claude Code...
#
# Waiting for authorization... (timeout: 5 minutes)
```

Browser opens to:
```
https://app.abyrith.com/mcp/authorize?device=MacBook-Pro&client=claude-code
```

User sees:
```
┌──────────────────────────────────────────────────┐
│  Authorize Claude Code?                          │
│                                                  │
│  Claude Code on MacBook-Pro wants to access     │
│  your Abyrith secrets.                           │
│                                                  │
│  Device: MacBook-Pro (macOS 15.0)               │
│  Browser: Chrome 120                             │
│  IP: 192.168.1.100                               │
│                                                  │
│  This will allow Claude Code to:                │
│  • List your secrets (names only)               │
│  • Request access to specific secrets           │
│  • You'll approve each secret individually      │
│                                                  │
│  [Cancel]  [Authorize for 30 days]              │
└──────────────────────────────────────────────────┘
```

User clicks "Authorize for 30 days"

Terminal shows:
```
✅ Authentication successful!

Device authorized: MacBook-Pro
Token expires: 2025-11-29
Default project: RecipeApp

Run `abyrith-mcp test` to verify connection.
```

**Step 3: Verify Connection**

```bash
abyrith-mcp test

# Output:
# ✅ Connected to Abyrith API
# ✅ Authenticated as: user@example.com
# ✅ Default project: RecipeApp
# ✅ Secrets available: 5
#
# Available secrets:
#   • OPENAI_API_KEY (OpenAI, development)
#   • STRIPE_SECRET_KEY (Stripe, development)
#   • DATABASE_URL (PostgreSQL, development)
#   • REDIS_URL (Redis, development)
#   • SENDGRID_API_KEY (SendGrid, development)
```

---

## Configuration

### Environment Variables

**Required:**
```bash
# Automatically set during `abyrith-mcp auth`
ABYRITH_API_URL=https://api.abyrith.com/v1   # API endpoint
ABYRITH_MCP_PROJECT=RecipeApp                # Default project
```

**Optional:**
```bash
ABYRITH_MCP_APPROVAL_TIMEOUT=300             # Seconds to wait for approval (default: 300)
ABYRITH_MCP_LOG_LEVEL=info                   # Logging: debug|info|warn|error
ABYRITH_MCP_CACHE_TTL=3600                   # Secret list cache TTL (default: 3600s)
ABYRITH_MCP_AUTO_APPROVE_DEV=false           # Auto-approve dev env requests (default: false)
```

### Configuration File

**Claude Code Configuration Location:**
- **macOS/Linux:** `~/.config/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Structure:**
```json
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_MCP_PROJECT": "RecipeApp",
        "ABYRITH_MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

**Example (multiple projects):**
```json
{
  "mcpServers": {
    "abyrith-recipeapp": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_MCP_PROJECT": "RecipeApp"
      }
    },
    "abyrith-clientwebsite": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_MCP_PROJECT": "ClientWebsite"
      }
    }
  }
}
```

**Abyrith MCP Server Configuration Location:**
- **macOS/Linux:** `~/.abyrith/mcp-config.json`
- **Windows:** `%USERPROFILE%\.abyrith\mcp-config.json`

**Structure:**
```json
{
  "apiUrl": "https://api.abyrith.com/v1",
  "projectId": "uuid-here",
  "projectName": "RecipeApp",
  "approvalTimeout": 300,
  "logLevel": "info",
  "cacheTTL": 3600,
  "autoApproveDev": false
}
```

---

## User Setup Instructions

### For First-Time Users (Beginners)

**What you'll need:**
- Claude Code desktop application installed
- Abyrith account (sign up at https://app.abyrith.com)
- 5 minutes

**Step-by-step setup:**

**1. Install Abyrith MCP Server**

Open your terminal and run:

```bash
npm install -g @abyrith/mcp-server
```

Wait for installation to complete. You should see:
```
✅ Abyrith MCP Server installed successfully!
```

**2. Authenticate with Abyrith**

```bash
abyrith-mcp auth
```

- Your browser will open automatically
- Log in to Abyrith (or sign up if you don't have an account)
- Click "Authorize" when prompted
- Go back to your terminal

You should see:
```
✅ Authentication successful!
```

**3. Configure Claude Code**

Run this command (it will configure Claude Code automatically):

```bash
abyrith-mcp configure-claude
```

You should see:
```
✅ Claude Code configured successfully!
   Restart Claude Code to activate Abyrith integration.
```

**4. Restart Claude Code**

- Close Claude Code completely (Quit, not just close window)
- Open Claude Code again

**5. Test the integration**

Open Claude Code and type:

```
Can you show me what secrets I have available in Abyrith?
```

Claude Code should respond with a list of your secrets.

**You're done!** 🎉

Now when Claude Code needs an API key, it will ask your permission first.

---

### For Developers (Advanced Setup)

**Manual Configuration:**

**1. Install MCP Server**

```bash
npm install -g @abyrith/mcp-server
```

**2. Authenticate**

```bash
abyrith-mcp auth
```

**3. Manually configure Claude Code**

Create or edit `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_MCP_PROJECT": "YourProjectName",
        "ABYRITH_MCP_LOG_LEVEL": "debug",
        "ABYRITH_MCP_CACHE_TTL": "1800"
      }
    }
  }
}
```

**4. (Optional) Configure per-project settings**

Create `.abyrith/config.json` in your project directory:

```json
{
  "project": "RecipeApp",
  "environment": "development",
  "autoApproveDev": true
}
```

**5. Restart Claude Code**

**6. Verify**

```bash
# Check MCP server status
abyrith-mcp status

# Test connection
abyrith-mcp test

# View logs
abyrith-mcp logs
```

---

## Example Workflows

### Workflow 1: Claude Code requests existing secret

**Scenario:** User asks Claude Code to help set up OpenAI integration

**User action:**
```
User (in Claude Code): Help me set up OpenAI integration for my chatbot
```

**Claude Code response:**
```
I'll help you set up OpenAI integration. I need access to your OpenAI API key.

Requesting OPENAI_API_KEY from Abyrith...
```

**What happens (behind the scenes):**

1. Claude Code detects need for OpenAI API key
2. Calls MCP tool: `abyrith_secrets_get({ name: "OPENAI_API_KEY", environment: "development" })`
3. MCP server checks approval cache (not found)
4. MCP server sends approval request to Abyrith API
5. User receives browser notification

**User sees (in browser notification):**
```
🔐 Abyrith - Claude Code Request

Claude Code requests access to:
OPENAI_API_KEY (OpenAI, development)

[Deny] [Approve for 1 hour] [Approve for 24 hours] [Always approve]
```

**User clicks:** "Approve for 24 hours"

**Claude Code continues:**
```
✅ Access approved!

Here's how to set up OpenAI integration:

1. Install the OpenAI SDK:
   npm install openai

2. Create your OpenAI client:

   import OpenAI from 'openai';

   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY // Using your key from Abyrith
   });

3. Make your first chat completion request:

   const response = await openai.chat.completions.create({
     model: "gpt-4",
     messages: [{ role: "user", content: "Hello!" }]
   });

I've configured the code to use your OPENAI_API_KEY securely.
```

**Result:**
- User approved once, Claude Code has access for 24 hours
- Secret never exposed in logs or terminal
- Audit log records: "Claude Code accessed OPENAI_API_KEY at 2025-10-30 14:23:00"

---

### Workflow 2: Claude Code requests non-existent secret

**Scenario:** User needs a Stripe API key that doesn't exist yet

**User action:**
```
User: Help me set up Stripe payments for my e-commerce site
```

**Claude Code response:**
```
I'll help you set up Stripe payments. First, I need your Stripe API key.

Checking Abyrith for STRIPE_SECRET_KEY...

❌ Secret not found.

Would you like me to help you get a Stripe API key? I can guide you through
the process step-by-step.
```

**User:** "Yes, please help me get one"

**Claude Code:**
```
I've sent a request to Abyrith to help you acquire a Stripe API key.

Check your Abyrith dashboard - the AI Assistant will guide you through
the steps to get your key.

I'll wait here while you set it up (timeout: 10 minutes)
```

**User experience (in Abyrith web app):**

Browser notification appears:
```
💡 Claude Code needs STRIPE_SECRET_KEY

Click to get started with AI-guided setup
```

User clicks notification, Abyrith AI Assistant opens:

```
Abyrith AI Assistant:

I see you need a Stripe API key! Let me help you get one.

Stripe API keys are used for payment processing. Here's how to get yours:

Step 1/4: Create a Stripe account
────────────────────────────────
→ Go to: https://stripe.com/
→ Click "Sign up"
→ Enter your email and create a password
→ Verify your email

[I've completed this step] [Skip - I already have a Stripe account]
```

User follows steps, gets API key, pastes into Abyrith

```
Abyrith AI Assistant:

✅ Great! I've securely stored your STRIPE_SECRET_KEY.

Claude Code is waiting for this key. I'm notifying it now...
```

**Claude Code (automatically continues):**
```
✅ STRIPE_SECRET_KEY is now available!

Requesting access for development... [Awaiting your approval]
```

User approves in notification (same as Workflow 1)

**Claude Code continues:**
```
✅ Access approved!

Now let's set up Stripe:

1. Install Stripe SDK:
   npm install stripe

2. Initialize Stripe client:

   import Stripe from 'stripe';

   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

3. Create a payment intent:

   const paymentIntent = await stripe.paymentIntents.create({
     amount: 2000,
     currency: 'usd'
   });

Your Stripe integration is ready!
```

**Result:**
- User was guided through obtaining API key
- Key securely stored in Abyrith
- Claude Code received key after approval
- Complete audit trail of process

---

### Workflow 3: User wants to review Claude Code activity

**User action (in Abyrith web app):**

Navigate to: Dashboard → MCP Activity → Claude Code

**User sees:**
```
Claude Code Activity Log
───────────────────────────────────────────────────────────────

Today, 2:45 PM
✓ Accessed OPENAI_API_KEY (development)
  Purpose: Setting up OpenAI integration
  Duration: 3 minutes
  Status: Approved (expires in 22 hours)

Today, 2:30 PM
✓ Accessed DATABASE_URL (development)
  Purpose: Database connection for migration script
  Duration: 15 minutes
  Status: Approved (expired)

Today, 1:15 PM
✗ Request denied: STRIPE_SECRET_KEY (production)
  Purpose: Payment processing setup
  Reason: User denied access

Yesterday, 4:20 PM
✓ Accessed SENDGRID_API_KEY (development)
  Purpose: Email sending functionality
  Duration: 45 minutes
  Status: Approved (expired)

───────────────────────────────────────────────────────────────
Total requests this week: 12
Approved: 10 | Denied: 2 | Expired: 8
───────────────────────────────────────────────────────────────

[Revoke all Claude Code access] [Configure auto-approvals]
```

**User can click any entry to see details:**
```
┌──────────────────────────────────────────────────────────────┐
│ Access Details: OPENAI_API_KEY                              │
├──────────────────────────────────────────────────────────────┤
│ Secret:        OPENAI_API_KEY                                │
│ Service:       OpenAI                                        │
│ Environment:   development                                   │
│ Requested by:  Claude Code (MacBook-Pro)                     │
│ Request time:  2025-10-30 14:45:00 UTC                       │
│ Approved:      2025-10-30 14:45:23 UTC (23 seconds later)   │
│ Expires:       2025-10-31 14:45:00 UTC (in 22 hours)        │
│ Purpose:       Setting up OpenAI integration                 │
│ Files accessed:                                              │
│   - src/lib/openai.ts                                        │
│   - src/api/chat.ts                                          │
│ Status:        Active ✓                                      │
│                                                              │
│ [Revoke access now] [Extend approval]                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### How Claude Code Discovers Abyrith MCP Server

**Discovery Process:**

1. **Startup:** Claude Code launches, reads `claude_desktop_config.json`
2. **Parse config:** Finds `mcpServers.abyrith` entry
3. **Spawn process:** Executes `abyrith-mcp serve` as child process
4. **Establish communication:** Creates stdio pipes (stdin/stdout)
5. **Handshake:** Claude Code sends MCP `initialize` request
6. **Server responds:** Abyrith MCP server returns capabilities and tools list
7. **Ready:** Claude Code can now call Abyrith MCP tools

**MCP Protocol Flow (JSON-RPC over stdio):**

```typescript
// Claude Code → Abyrith MCP Server
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "mcp/initialize",
  "params": {
    "clientInfo": {
      "name": "claude-code",
      "version": "1.0.0"
    }
  }
}

// Abyrith MCP Server → Claude Code
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "serverInfo": {
      "name": "abyrith-mcp",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": [
        {
          "name": "abyrith_secrets_list",
          "description": "List all secrets in the current project",
          "inputSchema": { /* JSON Schema */ }
        },
        {
          "name": "abyrith_secrets_get",
          "description": "Get a specific secret (requires user approval)",
          "inputSchema": { /* JSON Schema */ }
        },
        {
          "name": "abyrith_secrets_request",
          "description": "Request a secret that doesn't exist yet",
          "inputSchema": { /* JSON Schema */ }
        },
        {
          "name": "abyrith_secrets_search",
          "description": "Search for secrets by name, service, or tags",
          "inputSchema": { /* JSON Schema */ }
        }
      ]
    }
  }
}
```

**Tool Invocation Example:**

```typescript
// Claude Code → Abyrith MCP Server (requesting secret)
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "abyrith_secrets_get",
    "arguments": {
      "name": "OPENAI_API_KEY",
      "environment": "development"
    }
  }
}

// Abyrith MCP Server → Claude Code (if approval needed)
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32001,
    "message": "Approval required",
    "data": {
      "approval_id": "uuid",
      "approval_url": "https://app.abyrith.com/approvals/uuid",
      "timeout": 300
    }
  }
}

// After user approves, Claude Code retries same request

// Abyrith MCP Server → Claude Code (success)
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "name": "OPENAI_API_KEY",
    "value": "sk-proj-abc123...",
    "service": "OpenAI",
    "environment": "development",
    "expiresIn": 86400
  }
}
```

### Integration Code

**File:** `packages/mcp-server/src/claude-code-adapter.ts`

**Implementation:**

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AbyrithClient } from './client.js';

export class ClaudeCodeAdapter {
  private server: Server;
  private client: AbyrithClient;
  private approvalCache: Map<string, ApprovalStatus>;

  constructor(config: MCPConfig) {
    this.client = new AbyrithClient(config);
    this.approvalCache = new Map();

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'abyrith-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerTools();
  }

  async start(): Promise<void> {
    // Create stdio transport for Claude Code communication
    const transport = new StdioServerTransport();

    await this.server.connect(transport);

    console.error('Abyrith MCP Server started (Claude Code mode)');
  }

  private registerTools(): void {
    // Register abyrith_secrets_list tool
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'abyrith_secrets_list',
          description: 'List all secrets available in the current Abyrith project',
          inputSchema: {
            type: 'object',
            properties: {
              project: {
                type: 'string',
                description: 'Project name (optional, defaults to configured project)',
              },
              environment: {
                type: 'string',
                enum: ['development', 'staging', 'production'],
                description: 'Environment filter (optional)',
              },
            },
          },
        },
        {
          name: 'abyrith_secrets_get',
          description: 'Get a specific secret value (requires user approval)',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Secret name (e.g., OPENAI_API_KEY)',
              },
              environment: {
                type: 'string',
                enum: ['development', 'staging', 'production'],
                description: 'Environment (defaults to development)',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'abyrith_secrets_request',
          description: 'Request a secret that does not exist yet (triggers guided acquisition)',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Requested secret name',
              },
              service: {
                type: 'string',
                description: 'Service hint (e.g., Stripe, OpenAI)',
              },
              context: {
                type: 'string',
                description: 'Why this secret is needed',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'abyrith_secrets_search',
          description: 'Search for secrets by name, service, or tags',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              environment: {
                type: 'string',
                enum: ['development', 'staging', 'production'],
                description: 'Environment filter (optional)',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    // Register tool call handler
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'abyrith_secrets_list':
          return this.handleListSecrets(args);
        case 'abyrith_secrets_get':
          return this.handleGetSecret(args);
        case 'abyrith_secrets_request':
          return this.handleRequestSecret(args);
        case 'abyrith_secrets_search':
          return this.handleSearchSecrets(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleGetSecret(args: any): Promise<any> {
    const { name, environment = 'development' } = args;

    // Check approval cache
    const cacheKey = `${name}-${environment}`;
    const cachedApproval = this.approvalCache.get(cacheKey);

    if (cachedApproval && !cachedApproval.isExpired()) {
      // Fetch and decrypt secret
      return this.fetchAndDecryptSecret(name, environment);
    }

    // Request approval
    const approvalRequest = await this.client.requestApproval({
      secretName: name,
      environment,
      requestedBy: 'claude-code',
      context: 'Claude Code requesting access',
    });

    // Log to stderr (Claude Code ignores stderr, only stdout is MCP protocol)
    console.error(`⏳ Waiting for user approval: ${name}`);
    console.error(`   Approval URL: ${approvalRequest.approvalUrl}`);

    // Wait for approval (with timeout)
    const approval = await this.waitForApproval(approvalRequest.id, 300);

    // Cache approval
    this.approvalCache.set(cacheKey, approval);

    console.error(`✅ Approval granted: ${name} (expires in ${approval.expiresIn}s)`);

    // Fetch and decrypt secret
    return this.fetchAndDecryptSecret(name, environment);
  }

  private async fetchAndDecryptSecret(
    name: string,
    environment: string
  ): Promise<any> {
    // Fetch encrypted secret from API
    const encryptedSecret = await this.client.getSecret(name, environment);

    // Decrypt client-side
    const decryptedValue = await this.decryptSecret(encryptedSecret);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            name,
            value: decryptedValue,
            service: encryptedSecret.service,
            environment,
          }),
        },
      ],
    };
  }

  private async waitForApproval(
    approvalId: string,
    timeoutSeconds: number
  ): Promise<ApprovalStatus> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.client.checkApprovalStatus(approvalId);

      if (status.approved) {
        return status;
      }

      // Poll every 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Approval timeout: User did not approve within time limit');
  }

  private async decryptSecret(encrypted: EncryptedSecret): Promise<string> {
    // Implementation depends on whether browser is open
    // See MCP overview doc for full decryption logic
    // ...
  }
}
```

### Data Transformation

**Claude Code → Abyrith API:**

```typescript
// Claude Code calls tool
{
  name: "abyrith_secrets_get",
  arguments: {
    name: "OPENAI_API_KEY",
    environment: "development"
  }
}

// Transformed to Abyrith API request
POST https://api.abyrith.com/v1/mcp/approvals
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "secret_name": "OPENAI_API_KEY",
  "environment": "development",
  "requested_by": "claude-code",
  "device_id": "uuid",
  "request_context": {
    "tool": "abyrith_secrets_get",
    "timestamp": "2025-10-30T14:23:00Z",
    "client_version": "1.0.0"
  }
}
```

---

## Error Handling

### Error Types

**Error 1: Authentication Expired**
- **When:** JWT refresh token expired (after 30 days)
- **Claude Code sees:** "Error: Authentication expired"
- **MCP server logs:** "AUTH_EXPIRED - JWT refresh failed"
- **Recovery:**
  1. MCP server logs error to stderr
  2. User notified via system notification: "Abyrith authentication expired"
  3. User runs `abyrith-mcp auth` to re-authenticate
  4. Claude Code automatically reconnects after re-auth

**Error 2: Approval Timeout**
- **When:** User doesn't approve within 5 minutes
- **Claude Code sees:** "Error: User approval timed out for OPENAI_API_KEY"
- **MCP server logs:** "APPROVAL_TIMEOUT - No response for approval_uuid"
- **Recovery:**
  1. Claude Code informs user: "I need access to OPENAI_API_KEY. Please approve in Abyrith and try again."
  2. User can manually approve in web app and retry
  3. Approval requests don't expire (user can approve later)

**Error 3: Secret Not Found**
- **When:** Requested secret doesn't exist in project
- **Claude Code sees:** "Error: Secret 'STRIPE_API_KEY' not found"
- **MCP server logs:** "SECRET_NOT_FOUND - STRIPE_API_KEY not in RecipeApp"
- **Recovery:**
  1. Claude Code suggests: "Would you like me to help you get this API key?"
  2. If user agrees, Claude Code calls `abyrith_secrets_request`
  3. Triggers guided acquisition flow

**Error 4: Permission Denied**
- **When:** User doesn't have access to requested secret
- **Claude Code sees:** "Error: Permission denied for SECRET_NAME"
- **MCP server logs:** "PERMISSION_DENIED - User lacks Developer role"
- **Recovery:**
  1. Claude Code informs user: "You don't have permission to access this secret. Contact your project owner."
  2. User must request access in Abyrith web app

**Error 5: Rate Limit Exceeded**
- **When:** Too many MCP requests in short time
- **Claude Code sees:** "Error: Rate limit exceeded. Retry in 30 seconds."
- **MCP server logs:** "RATE_LIMIT_EXCEEDED - 100 requests/hour limit hit"
- **Recovery:**
  1. MCP server caches previously fetched secrets
  2. Waits for rate limit window to reset
  3. Retries automatically after wait period

### Retry Strategy

**Retry Policy:**
- Attempts: 3
- Backoff: Exponential (1s, 2s, 4s)
- Max wait: 8 seconds total

**Retriable Errors:**
- `500 Internal Server Error` - Temporary API issue
- `503 Service Unavailable` - Supabase/Cloudflare down
- `408 Request Timeout` - Network timeout

**Non-Retriable Errors:**
- `401 Unauthorized` - Re-authentication required
- `403 Forbidden` - Permission issue
- `404 Not Found` - Secret doesn't exist
- `409 Conflict` - Approval required (different flow)

**Implementation:**

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = 3
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Log to stderr (visible in MCP server logs, not Claude Code)
      console.error(`Attempt ${i + 1}/${attempts} failed:`, error.message);

      // Don't retry non-retriable errors
      if ([401, 403, 404, 409].includes(error.status)) {
        throw error;
      }

      // Don't retry on last attempt
      if (i === attempts - 1) {
        break;
      }

      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      console.error(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

---

## Testing

### Unit Tests

**Test File:** `packages/mcp-server/src/__tests__/claude-code-adapter.test.ts`

**Mock Setup:**
```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClaudeCodeAdapter } from '../claude-code-adapter';
import { AbyrithClient } from '../client';

jest.mock('../client');

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;
  let mockClient: jest.Mocked<AbyrithClient>;

  beforeEach(() => {
    mockClient = new AbyrithClient({}) as jest.Mocked<AbyrithClient>;
    adapter = new ClaudeCodeAdapter({
      apiUrl: 'https://api.abyrith.test',
      jwt: 'mock-jwt',
    });
    (adapter as any).client = mockClient;
  });

  describe('handleGetSecret', () => {
    it('should request approval for first-time secret access', async () => {
      mockClient.requestApproval.mockResolvedValue({
        id: 'approval-123',
        approvalUrl: 'https://app.abyrith.test/approvals/123',
      });
      mockClient.checkApprovalStatus.mockResolvedValue({
        approved: true,
        expiresIn: 3600,
        isExpired: () => false,
      });
      mockClient.getSecret.mockResolvedValue({
        name: 'OPENAI_API_KEY',
        encrypted_value: new Uint8Array(),
        iv: new Uint8Array(),
        service: 'OpenAI',
      });
      (adapter as any).decryptSecret = jest.fn().mockResolvedValue('sk-proj-abc123');

      const result = await adapter.handleGetSecret({
        name: 'OPENAI_API_KEY',
        environment: 'development',
      });

      expect(mockClient.requestApproval).toHaveBeenCalledWith({
        secretName: 'OPENAI_API_KEY',
        environment: 'development',
        requestedBy: 'claude-code',
        context: expect.any(String),
      });
      expect(JSON.parse(result.content[0].text).value).toBe('sk-proj-abc123');
    });

    it('should use cached approval for subsequent requests', async () => {
      // Pre-populate cache
      (adapter as any).approvalCache.set('OPENAI_API_KEY-development', {
        approved: true,
        expiresIn: 3600,
        isExpired: () => false,
      });

      mockClient.getSecret.mockResolvedValue({
        name: 'OPENAI_API_KEY',
        encrypted_value: new Uint8Array(),
        iv: new Uint8Array(),
        service: 'OpenAI',
      });
      (adapter as any).decryptSecret = jest.fn().mockResolvedValue('sk-proj-abc123');

      const result = await adapter.handleGetSecret({
        name: 'OPENAI_API_KEY',
        environment: 'development',
      });

      expect(mockClient.requestApproval).not.toHaveBeenCalled();
      expect(JSON.parse(result.content[0].text).value).toBe('sk-proj-abc123');
    });
  });
});
```

### Integration Tests

**Test Scenario: Full Claude Code workflow**

```typescript
describe('Claude Code Integration', () => {
  it('should complete full secret access workflow', async () => {
    // Simulate Claude Code launching MCP server
    const adapter = new ClaudeCodeAdapter(config);
    await adapter.start();

    // Simulate Claude Code requesting tools list
    const tools = await adapter.server.request({
      method: 'tools/list',
      params: {},
    });

    expect(tools.tools).toContainEqual(
      expect.objectContaining({ name: 'abyrith_secrets_get' })
    );

    // Simulate Claude Code requesting secret
    const getSecretPromise = adapter.server.request({
      method: 'tools/call',
      params: {
        name: 'abyrith_secrets_get',
        arguments: { name: 'OPENAI_API_KEY' },
      },
    });

    // Wait for approval request
    await waitFor(() => {
      expect(apiMock.requestApproval).toHaveBeenCalled();
    });

    // Simulate user approval
    apiMock.checkApprovalStatus.mockResolvedValueOnce({
      approved: true,
      expiresIn: 86400,
    });

    // Verify secret returned
    const result = await getSecretPromise;
    const secret = JSON.parse(result.content[0].text);
    expect(secret.value).toBe('sk-proj-abc123');
  });
});
```

### Manual Testing

**Test in development:**

```bash
# Terminal 1: Start MCP server in debug mode
DEBUG=abyrith:* abyrith-mcp serve

# Terminal 2: Simulate Claude Code tool calls
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | abyrith-mcp serve

# Expected output (JSON-RPC response with tools list)

echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"abyrith_secrets_list","arguments":{}}}' | abyrith-mcp serve

# Expected output (list of secrets)
```

**Verify in Claude Code:**

1. Launch Claude Code
2. Check MCP server is running: Menu → Developer → MCP Servers → Should show "abyrith" (active)
3. Type: "What secrets do I have in Abyrith?"
4. Claude Code should list your secrets
5. Type: "Get my OPENAI_API_KEY"
6. Approve in browser notification
7. Claude Code should receive the key

**Checklist:**
- [ ] MCP server starts without errors
- [ ] Claude Code discovers Abyrith MCP server
- [ ] List tool returns correct secrets
- [ ] Get tool triggers approval flow
- [ ] Browser notification appears
- [ ] After approval, secret returned to Claude Code
- [ ] Audit log records access
- [ ] Request tool creates guided acquisition flow

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- Claude Code tool invocations per hour (by tool type)
- Approval request rate (per user, per day)
- Approval success rate (approved vs. denied vs. timeout)
- Secret access latency (request to decrypted value)
- Error rate by error type

**Business Metrics:**
- Active Claude Code users (users with ≥1 MCP request in past 7 days)
- Most frequently requested secrets via Claude Code
- Average time to approve requests
- Percentage of secrets accessed via Claude Code vs. web app

**User Experience Metrics:**
- Time from installation to first successful secret access
- Approval timeout rate (% of requests that timeout)
- Re-authentication frequency (JWTs expiring unexpectedly)

### Logging

**Log Level:** INFO | WARN | ERROR

**Logged Events:**
- MCP server started/stopped
- Claude Code connected/disconnected
- Tool invocation (tool name, user ID, project ID)
- Approval request sent
- Approval granted/denied/timeout
- Secret accessed and decrypted
- Errors encountered

**Log Format (to stderr, not interfering with MCP protocol on stdout):**

```typescript
{
  timestamp: '2025-10-30T12:34:56Z',
  level: 'INFO',
  event: 'tool_invoked',
  service: 'abyrith-mcp',
  client: 'claude-code',
  tool: 'abyrith_secrets_get',
  user_id: 'uuid',
  project_id: 'uuid',
  secret_name: 'OPENAI_API_KEY',  // Name only, never value!
  duration_ms: 1234,
  status: 'success' | 'error',
  error?: 'approval_required' | 'auth_failed' | 'timeout'
}
```

### Alerts

**Alert 1: High Approval Timeout Rate (Claude Code specific)**
- **Condition:** >25% of Claude Code approval requests timeout over 1 hour
- **Severity:** P2
- **Action:** Investigate browser notification delivery or increase timeout

**Alert 2: Claude Code Authentication Failures**
- **Condition:** >5 auth failures from same user in 10 minutes
- **Severity:** P3
- **Action:** May indicate JWT expiration issue or credential corruption

**Alert 3: MCP Server Crashes**
- **Condition:** >10 users report "MCP server not found" in 1 hour
- **Severity:** P1
- **Action:** Check for MCP server binary issues or Claude Code compatibility

**Alert 4: Zero Claude Code Activity**
- **Condition:** No Claude Code requests in 24 hours (after initial users exist)
- **Severity:** P2
- **Action:** May indicate configuration issue or service outage

---

## Security Considerations

### Data Privacy

**Data sent from Claude Code to MCP server:**
- Tool invocation requests (JSON-RPC)
- Secret names (not values)
- Project and environment names
- **NO sensitive data transmitted over stdio**

**Data sent from MCP server to Abyrith API:**
- Secret names (not values)
- User JWT (for authentication)
- Approval requests (metadata only)
- **NO secret values transmitted unencrypted**

**Data received from Abyrith API:**
- Encrypted secret blobs (AES-256-GCM ciphertext)
- Secret metadata (service name, last accessed)
- Approval status
- **NO plaintext secrets in API responses**

**Data stored by MCP server:**
- JWT in OS keychain (encrypted at rest)
- Approval cache (status + expiration, no secrets)
- Master key in memory only (never persisted)
- **NO secret values persisted to disk**

### Credential Security

**How credentials are protected:**
- JWT stored in OS-level secure credential store
  - **macOS:** Keychain (requires user password to access)
  - **Windows:** Credential Manager (encrypted by OS)
  - **Linux:** Secret Service API (GNOME Keyring, KWallet)
- Master password never transmitted over network
- Master key held in memory only during decryption
- Memory zeroed immediately after decryption completes
- MCP server runs with user privileges (not elevated)
- No network exposure (stdio communication only)

**Access control:**
- Only user's processes can access OS keychain credentials
- MCP server process isolated from other applications
- Claude Code spawns MCP server as child process (inherits permissions)
- JWT tied to specific device (device_id in claims)

**Rotation policy:**
- JWT access tokens expire after 1 hour (automatically refreshed)
- JWT refresh tokens expire after 30 days (user re-authenticates)
- User can revoke Claude Code access anytime in web app
- Revoking access invalidates all JWTs for that device
- Master password change triggers re-encryption of all secrets

### Compliance

**GDPR:**
- User can revoke Claude Code access (right to be forgotten)
- Complete audit trail of which secrets accessed (right to access)
- User can export Claude Code activity log (data portability)
- No secret values logged or transmitted unencrypted (data minimization)
- User consent required for every secret access (consent)

**SOC 2:**
- Access control: User approval required for every secret (CC1.1, CC6.1)
- Audit logging: All Claude Code requests logged with timestamps (CC4.1)
- Encryption: Secrets encrypted in transit and at rest (CC6.6, CC6.7)
- Least privilege: Claude Code only gets approved secrets, not all project secrets (CC6.2)
- Monitoring: Alerts for unusual Claude Code activity (CC7.2)

---

## Cost & Rate Limits

### Pricing Model

**Pricing structure:**
- Claude Code integration **included** in all Abyrith plans (Free, Team, Enterprise)
- No per-request charges for MCP API calls
- No additional fees for Claude Code users
- MCP server is open-source and free to install

**Estimated monthly cost (to Abyrith):**
- Cloudflare Workers: ~$0.15 per million MCP requests
- Supabase DB reads: ~$0.08 per million MCP requests
- Total cost: ~$0.23 per million requests (negligible)

### Rate Limits

**Limits by plan:**

| Plan | Requests/Hour | Requests/Day | Approvals/Hour |
|------|---------------|--------------|----------------|
| **Free** | 100 | 500 | 20 |
| **Team** | 1,000 | 10,000 | 200 |
| **Enterprise** | 10,000 | 100,000 | 2,000 |

**How we handle limits:**
- Rate limit tracked by Cloudflare Worker (per user)
- When limit exceeded:
  - Return `429 Too Many Requests` with `Retry-After: 60` header
  - MCP server caches secrets locally for 1 hour (reduces repeat requests)
  - User notified via system notification after 3 consecutive rate limit hits
  - Email sent at 80% of daily limit

**Monitoring usage:**
- Dashboard shows Claude Code request count (hourly/daily/weekly)
- Email notification at 80% of hourly limit
- Upgrade suggestions if consistently hitting limits

---

## Troubleshooting

### Issue 1: Claude Code says "MCP server 'abyrith' not found"

**Symptoms:**
```
Claude Code Error: MCP server 'abyrith' could not be started
```

**Cause:** Configuration file missing or incorrect

**Solution:**

**Option 1: Automatic configuration (easiest)**
```bash
abyrith-mcp configure-claude
```

**Option 2: Manual configuration**

1. Check if config file exists:
```bash
# macOS/Linux
cat ~/.config/Claude/claude_desktop_config.json

# Windows
type %APPDATA%\Claude\claude_desktop_config.json
```

2. If missing, create it:
```bash
# macOS/Linux
mkdir -p ~/.config/Claude
cat > ~/.config/Claude/claude_desktop_config.json <<'EOF'
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"]
    }
  }
}
EOF

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Claude"
@"
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"]
    }
  }
}
"@ | Out-File -Encoding UTF8 "$env:APPDATA\Claude\claude_desktop_config.json"
```

3. Verify `abyrith-mcp` command exists:
```bash
which abyrith-mcp  # macOS/Linux
where abyrith-mcp  # Windows
```

If not found, reinstall:
```bash
npm install -g @abyrith/mcp-server
```

4. Restart Claude Code (fully quit, not just close window)

---

### Issue 2: "Authentication expired" every few hours

**Symptoms:**
```
Error: Authentication expired. Run `abyrith-mcp auth` to re-authenticate.
```
(Happening frequently, not just after 30 days)

**Cause:** System clock skew or JWT refresh failing

**Solution:**

1. Check system time:
```bash
# macOS/Linux
date

# Windows
date /t && time /t
```
Ensure time is accurate (use NTP time sync)

2. Clear cached credentials and re-authenticate:
```bash
abyrith-mcp logout
abyrith-mcp auth
```

3. Check MCP server logs for refresh errors:
```bash
abyrith-mcp logs --tail 50
```
Look for `JWT_REFRESH_FAILED` errors

4. If persistent, check network connectivity to Abyrith API:
```bash
curl -I https://api.abyrith.com/v1/health
```

---

### Issue 3: Approval notifications not appearing in browser

**Symptoms:**
- Claude Code says "Waiting for approval..."
- No notification appears in browser
- Request times out after 5 minutes

**Cause:** Browser notifications disabled or Abyrith web app not open

**Solution:**

1. **Enable browser notifications:**
   - Open Abyrith web app (https://app.abyrith.com)
   - Browser should prompt: "Allow notifications?"
   - Click "Allow"

2. **Keep Abyrith web app open in background:**
   - Approval notifications only appear when web app is open
   - Open web app in browser tab before using Claude Code
   - Pin the tab to prevent accidental closure

3. **Manually approve pending requests:**
   - Go to: Dashboard → MCP Activity → Pending Requests
   - Click "Approve" on pending Claude Code requests

4. **Increase approval timeout:**
```bash
abyrith-mcp config set approvalTimeout 600  # 10 minutes
```

---

### Issue 4: Claude Code receives wrong secret value

**Symptoms:**
- Claude Code gets a secret value, but it's for the wrong environment
- Expected production key, got development key

**Cause:** MCP server context pointing to wrong environment

**Solution:**

1. Check current project/environment context:
```bash
abyrith-mcp config show
```

2. Set correct environment:
```bash
abyrith-mcp config set environment production
```

3. Or specify environment in Claude Code config:
```json
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_MCP_PROJECT": "RecipeApp",
        "ABYRITH_MCP_ENVIRONMENT": "production"
      }
    }
  }
}
```

4. Restart Claude Code

---

### Issue 5: "Rate limit exceeded" errors

**Symptoms:**
```
Error: Rate limit exceeded. Retry in 30 seconds.
```

**Cause:** Too many MCP requests in short time period

**Solution:**

1. **Increase cache TTL** (reduces repeat requests):
```bash
abyrith-mcp config set cacheTTL 7200  # 2 hours
```

2. **Check for request loops:**
```bash
abyrith-mcp logs --tail 100 | grep "tool_invoked"
```
Look for excessive identical requests

3. **Upgrade plan** if consistently hitting limits:
- Free: 100 requests/hour
- Team: 1,000 requests/hour
- Enterprise: 10,000 requests/hour

4. **Contact support** if rate limits seem incorrect

---

### Debug Mode

**Enable debug logging:**

```bash
# Set log level to debug
abyrith-mcp config set logLevel debug

# Or set environment variable
export ABYRITH_MCP_LOG_LEVEL=debug

# Start MCP server manually (to see logs in terminal)
abyrith-mcp serve
```

**What gets logged in debug mode:**
- Every JSON-RPC message (stdin/stdout) between Claude Code and MCP server
- Every HTTP request/response to Abyrith API (URL, headers, status)
- JWT contents (claims, expiration) - NOT the token itself
- Approval polling attempts (every 2 seconds)
- Cache hits/misses for approval and secret lists
- Decryption attempts - NOT the plaintext values!
- Memory usage and performance metrics

**View logs:**
```bash
# View live logs
abyrith-mcp logs --follow

# View last 100 lines
abyrith-mcp logs --tail 100

# Search logs
abyrith-mcp logs | grep "ERROR"

# Export logs to file
abyrith-mcp logs --since "2025-10-30" > abyrith-debug.log
```

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [x] `09-integrations/mcp/mcp-overview.md` - MCP server architecture and tools
- [x] `03-security/security-model.md` - Zero-knowledge encryption specification
- [x] `08-features/ai-assistant/ai-assistant-overview.md` - AI Assistant for guided acquisition
- [x] `05-api/endpoints/secrets-endpoints.md` - Secrets API specification

**External Dependencies:**
- Claude Code desktop application (installed by user)
- Node.js 20+ (for running MCP server)
- OS-level credential storage (Keychain, Credential Manager, Secret Service)
- Modern web browser (for approval notifications)

### Feature Dependencies

**Depends on these features:**
- Abyrith MCP server (`@abyrith/mcp-server` npm package)
- Approval workflow in Abyrith web app
- Real-time notifications (Supabase Realtime)
- Client-side decryption (Web Crypto API)

**Enables these features:**
- AI-native secrets access for Claude Code users
- Seamless development workflow without manual secret management
- Complete audit trail of AI tool secret access

---

## References

### Internal Documentation
- `09-integrations/mcp/mcp-overview.md` - MCP server architecture and tools specification
- `TECH-STACK.md` - Technology stack (Node.js, Web Crypto API, Supabase)
- `01-product/product-vision-strategy.md` - Why Claude Code integration is a key differentiator
- `02-architecture/system-overview.md` - Overall system architecture
- `GLOSSARY.md` - Term definitions (MCP, Zero-Knowledge, JWT, etc.)

### External Resources
- [Claude Code Documentation](https://claude.ai/code) - Official Claude Code docs
- [Claude Code MCP Configuration](https://docs.claude.ai/code/mcp-config) - How to configure MCP servers
- [Model Context Protocol Specification](https://modelcontextprotocol.io) - MCP protocol standard
- [MCP SDK (TypeScript)](https://github.com/modelcontextprotocol/sdk) - SDK for building MCP servers
- [Anthropic MCP Examples](https://github.com/anthropics/mcp-examples) - Example MCP server implementations

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Integration Team | Initial Claude Code integration documentation |

---

## Notes

### Why Claude Code Integration is a Key Differentiator

Claude Code is Anthropic's official AI coding assistant, used by thousands of developers daily. By integrating Abyrith with Claude Code, we position Abyrith as the **first secrets manager purpose-built for AI-native development**.

**Competitive Advantage:**
1. **Zero Friction:** Claude Code users get secrets instantly after one-time approval (no copy-paste)
2. **Security Maintained:** User approves every secret access; zero-knowledge architecture preserved
3. **Complete Auditability:** Every Claude Code request logged with context
4. **Official Integration:** Abyrith becomes the recommended secrets manager for Claude Code users

**User Experience Win:**
- **Without Abyrith:** User manually copies API key from password manager → pastes in terminal → Claude Code continues
- **With Abyrith:** Claude Code requests key → user clicks "Approve" → Claude Code continues (2 seconds vs. 30 seconds)

### Future Enhancements
- Auto-approval policies (approve all dev environment requests automatically)
- Project-specific approval policies (different rules for different projects)
- Temporary approval grants (approve for next N requests only)
- Integration with Claude Code Extensions API (deeper integration)
- Contextual secret suggestions (Claude Code suggests which secrets you need)
- Secret rotation triggered by Claude Code usage patterns
