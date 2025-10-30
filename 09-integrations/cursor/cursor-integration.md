---
Document: Cursor IDE - Integration Guide
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Integration Team
Status: Draft
Dependencies: 09-integrations/mcp/mcp-overview.md, 05-api/endpoints/secrets-endpoints.md, 03-security/security-model.md
---

# Cursor IDE Integration

## Overview

The Cursor integration enables Cursor AI to access Abyrith secrets directly through the Model Context Protocol (MCP), allowing AI-powered development workflows without manual secret copy-pasting. Cursor users can authorize their AI assistant to request API keys and credentials with explicit approval, maintaining zero-knowledge security while eliminating context-switching friction.

**External Service:** [Cursor IDE](https://cursor.sh) - AI-powered code editor built on VSCode

**Integration Type:** MCP Client integration

**Status:** Active (MVP Feature - Phase 5)

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [Setup Guide](#setup-guide)
6. [Usage Examples](#usage-examples)
7. [Cursor-Specific Features](#cursor-specific-features)
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
- Cursor AI can request secrets directly from Abyrith during development sessions
- Developers stay in their code editor; no context switching to web browsers
- One-time approval per secret unlocks continuous AI assistance
- Complete audit trail of which AI requests accessed which secrets
- Zero-knowledge encryption maintained throughout the flow

**User benefits:**
- **For Learners:** Cursor AI gets the keys it needs automatically after tutorial-style approval
- **For Solo Developers:** Seamless Cursor experience without maintaining .env files
- **For Development Teams:** Team members approve AI access without exposing plaintext secrets
- **For Enterprise:** Centralized control and visibility over AI tool secret access

### Technical Purpose

**Responsibilities:**
- Enable Cursor AI to discover and request Abyrith secrets via MCP
- Provide seamless authentication from Cursor to Abyrith
- Trigger user approval flows when Cursor requests unapproved secrets
- Maintain zero-knowledge security (decryption client-side only)
- Log all Cursor AI secret access for audit compliance

**Integration Points:**
- Cursor communicates with Abyrith MCP server (Node.js/Deno process)
- MCP server authenticates to Abyrith API via JWT
- User approves requests in Abyrith web app
- Secrets decrypted client-side and returned to Cursor in memory only

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Cursor IDE                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Cursor AI (built-in AI assistant)                    │  │
│  │  • Code completion                                    │  │
│  │  • Chat interface                                     │  │
│  │  • Inline edits                                       │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │ MCP Protocol                         │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        │ stdio / JSON-RPC
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         Abyrith MCP Server (Local Process)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MCP Tools:                                          │   │
│  │  • abyrith_secrets_list                              │   │
│  │  • abyrith_secrets_get                               │   │
│  │  • abyrith_secrets_request                           │   │
│  │  • abyrith_secrets_search                            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS (JWT Auth)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (API Gateway)                │
│  • Validate JWT                                              │
│  • Rate limiting                                             │
│  • Route to Supabase                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
               ┌───────────────┐        ┌──────────────────┐
               │  Supabase DB  │        │  Abyrith Web App │
               │  (metadata +  │◄──────►│  (approval UI)   │
               │  encrypted    │        │                  │
               │  secrets)     │        │                  │
               └───────────────┘        └──────────────────┘
```

### Data Flow

**Cursor AI Requests Secret:**
1. Developer asks Cursor AI: "Create a payment integration with Stripe"
2. Cursor AI recognizes need for `STRIPE_API_KEY`
3. Cursor calls MCP tool: `abyrith_secrets_get("STRIPE_API_KEY")`
4. MCP server checks if approval exists
5. If no approval: Trigger approval request → Notify user in Abyrith web app
6. User approves (one-time or time-limited)
7. MCP server fetches encrypted secret from API
8. MCP server decrypts secret client-side
9. MCP server returns plaintext secret to Cursor AI (in memory only)
10. Cursor AI uses secret to generate code with proper Stripe integration

**User Approval Flow:**
1. User receives browser notification: "Cursor AI requests STRIPE_API_KEY"
2. User opens Abyrith web app
3. Approval modal shows: "Cursor AI needs STRIPE_API_KEY for payment integration"
4. User selects approval duration:
   - For 1 hour
   - For 24 hours
   - Always (until revoked)
5. User clicks "Approve"
6. MCP server notified via polling or WebSocket
7. Cursor AI continues with approved secret

### Components Involved

**Frontend (Cursor IDE):**
- Cursor AI chat interface (built-in)
- MCP client (built into Cursor)
- Configuration UI for MCP servers (Cursor settings)

**Backend:**
- **Abyrith MCP Server** (Node.js/Deno): Standalone process implementing MCP protocol
- **Cloudflare Workers**: API gateway, rate limiting, approval checks
- **Supabase Database**: Stores approval records, audit logs, encrypted secrets

**External:**
- **Cursor IDE**: MCP client that requests secrets
- **Abyrith Web App**: User approval UI

---

## Authentication

### Authentication Method

**Type:** JWT Bearer Token + OAuth-style authorization flow

**How it works:**

1. **Initial Setup (One-Time):**
   - Developer runs `abyrith-mcp auth` in terminal
   - Browser opens to Abyrith web app
   - Developer logs in (if not already authenticated)
   - Authorization screen: "Cursor wants to access your secrets"
   - Developer approves and selects default project
   - Browser redirects with authorization code
   - MCP server exchanges code for JWT (refresh token)
   - JWT stored securely in OS keychain

2. **Per-Request Authentication:**
   - Cursor AI requests secret via MCP
   - MCP server includes JWT in API request headers
   - Cloudflare Worker validates JWT signature and expiration
   - Worker enforces RLS policies based on user ID in JWT

3. **Master Key for Decryption:**
   - User's master password never transmitted
   - When decryption needed:
     - Option A: MCP server requests decryption from open Abyrith web app (via WebSocket)
     - Option B: MCP server prompts user for master password in terminal
   - Decryption happens client-side only

### Credentials Management

**Where credentials are stored:**
- **Development:** OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **JWT Storage:** Encrypted at rest using OS-level APIs
- **Master Key:** Never persisted; held in memory only during active session

**Credential Format:**
```bash
# Stored securely in OS keychain
ABYRITH_MCP_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ABYRITH_MCP_USER_ID=user_uuid_here
ABYRITH_MCP_PROJECT_ID=project_uuid_here
```

### Obtaining Credentials

See [Setup Guide](#setup-guide) for complete authentication flow.

---

## Configuration

### Cursor Configuration File

**Location:** `~/.cursor/mcp.json` (created during setup)

**Structure:**
```json
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_PROJECT": "RecipeApp",
        "ABYRITH_MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

**Configuration Options:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | Command to start MCP server (`abyrith-mcp`) |
| `args` | string[] | Yes | Arguments to command (`["serve"]`) |
| `env.ABYRITH_PROJECT` | string | No | Default project name (can be changed later) |
| `env.ABYRITH_MCP_LOG_LEVEL` | string | No | Logging level: `debug`, `info`, `warn`, `error` (default: `info`) |
| `env.ABYRITH_MCP_APPROVAL_TIMEOUT` | number | No | Seconds to wait for approval (default: 300) |
| `env.ABYRITH_MCP_CACHE_TTL` | number | No | Secret list cache TTL in seconds (default: 3600) |

### Environment Variables

**Set in Cursor config or shell:**
```bash
ABYRITH_API_URL=https://api.abyrith.com/v1   # API endpoint (default)
ABYRITH_MCP_PROJECT=RecipeApp                # Default project
ABYRITH_MCP_APPROVAL_TIMEOUT=300             # Approval wait time (seconds)
ABYRITH_MCP_LOG_LEVEL=info                   # Logging: debug|info|warn|error
ABYRITH_MCP_CACHE_TTL=3600                   # Secret list cache (seconds)
```

### Cursor-Specific Settings

**Accessing Cursor MCP Settings:**
1. Open Cursor
2. Press `Cmd/Ctrl + Shift + P`
3. Search: "Preferences: Open User Settings (JSON)"
4. Cursor settings are in `.cursor/` directory in home folder

**Recommended Cursor Settings:**
```json
{
  "cursor.mcp.enabled": true,
  "cursor.mcp.autoStart": true,
  "cursor.mcp.logLevel": "info"
}
```

---

## Setup Guide

### Prerequisites

**Required Software:**
- [Cursor IDE](https://cursor.sh) - Latest version
- Node.js 20+ OR Deno 1.40+ (for MCP server)
- Abyrith account (free or paid plan)

**Before You Start:**
1. Create Abyrith account at [app.abyrith.com](https://app.abyrith.com)
2. Create at least one project in Abyrith
3. Add at least one secret to test integration

---

### Step 1: Install Abyrith MCP Server

**Option A: Install via npm (recommended)**
```bash
npm install -g @abyrith/mcp-server
```

**Option B: Install via Homebrew (macOS/Linux)**
```bash
brew tap abyrith/tap
brew install abyrith-mcp
```

**Option C: Install via Deno**
```bash
deno install -A -n abyrith-mcp https://deno.land/x/abyrith_mcp/mod.ts
```

**Verify installation:**
```bash
abyrith-mcp --version
# Output: abyrith-mcp version 1.0.0
```

---

### Step 2: Authenticate MCP Server

**Run authentication command:**
```bash
abyrith-mcp auth
```

**What happens:**
1. Browser opens to `https://app.abyrith.com/mcp/authorize`
2. You see: "Cursor wants to access your secrets"
3. Log in (if not already logged in)
4. Select default project (e.g., "RecipeApp")
5. Click "Authorize"
6. Browser shows: "✓ Authorization successful. You can close this window."
7. Terminal shows: "✓ Authenticated successfully as your-email@example.com"

**Stored credentials:**
- JWT stored in OS keychain
- Project context saved to `~/.abyrith/mcp-config.json`

**Verify authentication:**
```bash
abyrith-mcp test
# Output:
# ✓ Connected to Abyrith
# ✓ Authenticated as: your-email@example.com
# ✓ Default project: RecipeApp
# ✓ Available secrets: 5
```

---

### Step 3: Configure Cursor to Use Abyrith MCP Server

**Create Cursor MCP configuration file:**

```bash
# Create .cursor directory if it doesn't exist
mkdir -p ~/.cursor

# Create MCP configuration
cat > ~/.cursor/mcp.json <<'EOF'
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_PROJECT": "RecipeApp"
      }
    }
  }
}
EOF
```

**Replace "RecipeApp" with your actual project name.**

**Alternative: Configure via Cursor UI (if supported)**
1. Open Cursor
2. Settings (Cmd/Ctrl + ,)
3. Search: "MCP Servers"
4. Add new server:
   - Name: `abyrith`
   - Command: `abyrith-mcp`
   - Args: `serve`

---

### Step 4: Restart Cursor

**Fully restart Cursor IDE:**
1. Quit Cursor completely (Cmd/Ctrl + Q)
2. Relaunch Cursor

**Verify MCP server loaded:**
1. Open Cursor AI chat (Cmd/Ctrl + L or Cmd/Ctrl + K)
2. Type: "Can you list my Abyrith secrets?"
3. Cursor AI should respond with a list of your secrets

**If Cursor AI doesn't recognize Abyrith:**
- Check MCP server status: Run `abyrith-mcp status`
- Check Cursor logs: See [Troubleshooting](#troubleshooting)

---

### Step 5: Test Secret Access

**Request a secret via Cursor AI:**

1. Open Cursor AI chat (Cmd/Ctrl + L)
2. Type: "Get my OPENAI_API_KEY from Abyrith"
3. Expected behavior:
   - If first time: Browser notification "Cursor AI requests OPENAI_API_KEY"
   - You approve in Abyrith web app
   - Cursor AI receives secret and confirms: "I have your OpenAI API key"

**Test inline usage:**

1. In a code file, start typing:
   ```python
   import openai
   openai.api_key =
   ```

2. Cursor AI suggests: `"sk-proj-..."` (your actual key)

3. Approve if prompted

**Verify audit log:**
1. Open Abyrith web app
2. Navigate to: Dashboard → Audit Logs
3. See entry: "Cursor AI accessed OPENAI_API_KEY"

---

### Step 6: Configure Project Context (Optional)

**If you have multiple projects in Abyrith:**

**Switch default project:**
```bash
abyrith-mcp config set project "MyOtherProject"
```

**Or specify project in Cursor MCP config:**
```json
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_PROJECT": "MyOtherProject"
      }
    }
  }
}
```

**Or let Cursor AI ask for project:**
- In Cursor AI chat: "Get my database password from the ClientWebsite project in Abyrith"
- Cursor AI will specify project in MCP request

---

## Usage Examples

### Example 1: AI-Powered API Integration

**Scenario:** You're building a new feature and need to integrate with Stripe.

**Developer action:**
```
Cursor AI Chat: "Help me integrate Stripe payments. Set up the API client."
```

**What happens:**
1. Cursor AI recognizes need for Stripe API key
2. Cursor AI calls: `abyrith_secrets_get("STRIPE_API_KEY")`
3. MCP server checks approval status
4. If not approved yet:
   - Browser notification: "Cursor AI requests STRIPE_API_KEY"
   - You approve in Abyrith web app
5. MCP server returns decrypted key to Cursor
6. Cursor AI generates code:

```typescript
import Stripe from 'stripe';

// Stripe API key securely accessed from Abyrith
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: '2023-10-16',
});

export async function createPaymentIntent(amount: number) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
  });
  return paymentIntent;
}
```

7. Cursor AI also suggests adding to `.env.example`:
```bash
STRIPE_API_KEY=your_stripe_key_here
```

---

### Example 2: Searching for Secrets

**Developer action:**
```
Cursor AI Chat: "Show me all my database credentials"
```

**What happens:**
1. Cursor AI calls: `abyrith_secrets_search("database")`
2. MCP server returns matching secrets:
   ```json
   {
     "secrets": [
       {
         "name": "DATABASE_URL",
         "service": "PostgreSQL",
         "environment": "production",
         "tags": ["database", "postgres"],
         "relevance": 0.95
       },
       {
         "name": "REDIS_URL",
         "service": "Redis",
         "environment": "production",
         "tags": ["database", "cache"],
         "relevance": 0.82
       }
     ]
   }
   ```
3. Cursor AI responds:
   ```
   I found 2 database-related secrets:
   1. DATABASE_URL (PostgreSQL, production)
   2. REDIS_URL (Redis, production)

   Would you like me to use any of these in your code?
   ```

---

### Example 3: Requesting New Secrets

**Scenario:** Cursor AI needs a secret that doesn't exist yet.

**Developer action:**
```
Cursor AI Chat: "Connect to SendGrid to send welcome emails"
```

**What happens:**
1. Cursor AI calls: `abyrith_secrets_get("SENDGRID_API_KEY")`
2. MCP server returns: `404 Not Found`
3. Cursor AI calls: `abyrith_secrets_request("SENDGRID_API_KEY", service: "SendGrid")`
4. You receive notification: "Cursor AI requested SENDGRID_API_KEY"
5. You click notification → Opens Abyrith AI Assistant
6. AI Assistant: "I see you need a SendGrid API key. Let me help you get one..."
7. AI provides guided acquisition flow:
   ```
   Step 1: Go to https://sendgrid.com/login
   Step 2: Navigate to Settings → API Keys
   Step 3: Click "Create API Key"
   Step 4: Name it "Abyrith-Development"
   Step 5: Select "Full Access" permissions
   Step 6: Click "Create & View"
   Step 7: Copy the key and paste here
   ```
8. You complete steps, store key in Abyrith
9. Cursor AI receives notification: "SENDGRID_API_KEY is now available"
10. Cursor AI continues with email integration code

---

### Example 4: Environment-Specific Secrets

**Developer action:**
```
Cursor AI Chat: "Use the production database URL to write a migration script"
```

**What happens:**
1. Cursor AI calls: `abyrith_secrets_get("DATABASE_URL", environment: "production")`
2. If production secrets require extra approval:
   - Notification: "Cursor AI requests production DATABASE_URL"
   - Approval modal shows warning: "⚠️ This is a production secret. Approve carefully."
   - You approve
3. Cursor AI generates migration script with production URL

**Security consideration:**
- Enterprise plans can require dual approval for production secrets
- Cursor AI access to production can be revoked per-project

---

### Example 5: Secret List for .env File Generation

**Developer action:**
```
Cursor AI Chat: "Generate a .env.example file for this project"
```

**What happens:**
1. Cursor AI calls: `abyrith_secrets_list()`
2. MCP server returns metadata (no secret values):
   ```json
   {
     "secrets": [
       { "name": "OPENAI_API_KEY", "service": "OpenAI" },
       { "name": "DATABASE_URL", "service": "PostgreSQL" },
       { "name": "REDIS_URL", "service": "Redis" }
     ]
   }
   ```
3. Cursor AI generates `.env.example`:
   ```bash
   # OpenAI API Key
   OPENAI_API_KEY=your_openai_api_key_here

   # PostgreSQL Database URL
   DATABASE_URL=postgresql://user:password@host:port/database

   # Redis Cache URL
   REDIS_URL=redis://user:password@host:port
   ```

---

## Cursor-Specific Features

### Inline Secret Suggestions

**Feature:** Cursor AI can auto-complete secrets inline.

**Usage:**
1. Start typing: `const apiKey = process.env.`
2. Cursor suggests: `OPENAI_API_KEY` (from your Abyrith project)
3. Continue typing: `const apiKey = process.env.OPENAI_API_KEY`
4. Cursor doesn't insert plaintext value (security best practice)

**Security:** Cursor never writes plaintext secrets to files; only suggests environment variable names.

---

### Composer Mode Integration

**Feature:** Cursor's Composer mode can orchestrate multi-file changes using Abyrith secrets.

**Usage:**
1. Open Cursor Composer (Cmd/Ctrl + I)
2. Request: "Set up authentication with Clerk, use my Clerk API keys from Abyrith"
3. Cursor Composer:
   - Calls `abyrith_secrets_get("CLERK_PUBLISHABLE_KEY")`
   - Calls `abyrith_secrets_get("CLERK_SECRET_KEY")`
   - Generates `lib/clerk.ts`, `middleware.ts`, `.env.local`
   - Configures all files with proper Clerk setup

---

### Chat History Persistence

**Feature:** Approved secrets persist across Cursor sessions.

**Behavior:**
- Once you approve "Cursor AI → OPENAI_API_KEY", approval lasts for duration you selected (1 hour, 24 hours, always)
- Cursor can request same secret again without re-approval (until expiration)
- You can revoke approval anytime in Abyrith web app

**Security:** Secrets never stored in Cursor's chat history; only approval status cached.

---

### Project-Specific Context

**Feature:** Cursor can switch Abyrith projects based on workspace.

**Setup:**
Create workspace-specific MCP config:

```bash
# In your project directory
mkdir -p .cursor
cat > .cursor/mcp.json <<'EOF'
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_PROJECT": "ThisSpecificProject"
      }
    }
  }
}
EOF
```

**Behavior:**
- When you open this workspace, Cursor uses "ThisSpecificProject" from Abyrith
- When you open a different workspace, Cursor uses its configured project
- Global config: `~/.cursor/mcp.json`
- Workspace config: `<project>/.cursor/mcp.json` (takes precedence)

---

## Error Handling

### Common Errors in Cursor

**Error 1: "MCP server 'abyrith' not found"**

**Symptoms:**
Cursor AI responds: "I don't have access to Abyrith secrets."

**Cause:** MCP server not configured or not running

**Solution:**
1. Verify MCP config exists: `cat ~/.cursor/mcp.json`
2. If missing, follow [Setup Guide](#setup-guide)
3. Restart Cursor IDE
4. Check MCP server status: `abyrith-mcp status`

---

**Error 2: "Authentication failed"**

**Symptoms:**
```
Error: Authentication failed. Run `abyrith-mcp auth` to re-authenticate.
```

**Cause:** JWT expired or revoked

**Solution:**
```bash
# Re-authenticate
abyrith-mcp auth

# If that fails, logout and re-auth
abyrith-mcp logout
abyrith-mcp auth
```

---

**Error 3: "Approval timeout"**

**Symptoms:**
```
Error: Approval timeout: User did not approve within 5 minutes
```

**Cause:** You didn't approve Cursor's request in time

**Solution:**
1. Ensure Abyrith web app is open
2. Enable browser notifications for Abyrith
3. Increase timeout: `abyrith-mcp config set approvalTimeout 600` (10 minutes)
4. Manually approve pending requests: Abyrith Dashboard → MCP Requests

---

**Error 4: "Secret not found"**

**Symptoms:**
```
Error: Secret 'DATABASE_URL' not found in project 'RecipeApp'
```

**Cause:** Secret doesn't exist in specified project or environment

**Solution:**
1. List available secrets: In Cursor AI chat, ask "List my Abyrith secrets"
2. Check project context: `abyrith-mcp config show`
3. Add secret to Abyrith web app
4. OR request secret: Cursor AI chat "Request DATABASE_URL secret"

---

## Testing

### Manual Testing Checklist

**Test 1: MCP Server Connection**
- [ ] Run `abyrith-mcp test`
- [ ] Output shows "Connected to Abyrith"
- [ ] Output lists available secrets

**Test 2: Cursor AI Secret List**
- [ ] Open Cursor AI chat
- [ ] Ask: "List my Abyrith secrets"
- [ ] Cursor AI displays list of secrets (names only, no values)

**Test 3: Cursor AI Secret Access with Approval**
- [ ] Open Cursor AI chat
- [ ] Ask: "Get my OPENAI_API_KEY from Abyrith"
- [ ] Browser notification appears
- [ ] Approve in Abyrith web app
- [ ] Cursor AI confirms: "I have your OpenAI API key"

**Test 4: Cursor AI Secret Access (Pre-Approved)**
- [ ] Request same secret again
- [ ] No approval prompt (already approved)
- [ ] Cursor AI receives secret instantly

**Test 5: Cursor AI Secret Search**
- [ ] Open Cursor AI chat
- [ ] Ask: "Search Abyrith for database credentials"
- [ ] Cursor AI displays relevant secrets

**Test 6: Cursor AI Secret Request (Missing Secret)**
- [ ] Open Cursor AI chat
- [ ] Ask: "Get my NONEXISTENT_SECRET from Abyrith"
- [ ] Cursor AI offers to request it
- [ ] Notification sent to Abyrith web app

**Test 7: Audit Log Verification**
- [ ] Access several secrets via Cursor
- [ ] Open Abyrith web app → Audit Logs
- [ ] Verify all Cursor accesses logged with timestamps

**Test 8: Revoke Access**
- [ ] In Abyrith web app, revoke Cursor access to a secret
- [ ] Request secret again in Cursor
- [ ] Approval required again

---

## Monitoring

### Metrics to Track

**Cursor-Specific Metrics:**
- Number of active Cursor users (users with Cursor MCP requests in past 7 days)
- Average secrets accessed per Cursor session
- Approval success rate for Cursor requests
- Most frequently accessed secrets via Cursor
- Cursor session duration (time between first and last MCP request)

**General MCP Metrics (includes Cursor):**
- MCP tool invocations per hour
- Approval request rate
- Secret access latency
- Error rate by error type

### Logging

**Log Events for Cursor:**
- Cursor MCP session started
- Cursor AI requested secret
- User approved/denied Cursor request
- Secret returned to Cursor
- Cursor session ended

**Log Format:**
```typescript
{
  timestamp: '2025-10-30T14:23:45Z',
  event: 'cursor_secret_requested',
  user_id: 'uuid',
  project_id: 'uuid',
  secret_name: 'OPENAI_API_KEY',
  environment: 'development',
  approved: true,
  approval_duration: '24h',
  duration_ms: 1234
}
```

---

## Security Considerations

### Data Privacy

**Data sent from Cursor to MCP server:**
- Secret name (not value)
- Project name
- Environment name
- Request context (why Cursor AI needs the secret)
- **NO sensitive data**: Secret values never sent until approved

**Data received from Abyrith:**
- Encrypted secret blobs (AES-256-GCM)
- Secret metadata
- Approval status
- **NO plaintext secrets**: Decryption happens client-side

**Data stored by MCP server:**
- JWT in OS keychain (encrypted at rest)
- Approval cache (status + expiration, no secret values)
- Master key in memory only (never persisted)

### Cursor-Specific Security

**Chat History:**
- Cursor doesn't persist plaintext secrets in chat history
- Cursor may cache approval status
- Users can clear Cursor chat history to remove any references

**Workspace Security:**
- Workspace-specific MCP configs don't contain credentials
- MCP config only contains project name (not secrets)
- Workspace can be shared safely (no secrets exposed)

**Extension Security:**
- Abyrith MCP server runs as separate process (not a Cursor extension)
- No third-party code in Cursor with access to secrets
- MCP server only accepts connections from local Cursor process

### Compliance

**GDPR:**
- User can revoke Cursor access anytime
- Audit logs show exactly which secrets Cursor accessed
- User can export Cursor access history

**SOC 2:**
- Access control: User approval required for each secret
- Audit logging: All Cursor requests logged
- Encryption: Secrets encrypted in transit and at rest
- Least privilege: Cursor only gets approved secrets

---

## Cost & Rate Limits

### Pricing

**Cursor Integration Costs:**
- Abyrith MCP integration: **Included in all plans** (Free, Team, Enterprise)
- No per-request charges for Cursor MCP calls
- Cursor IDE subscription: Separate (billed by Cursor)

### Rate Limits

**Cursor-Specific Limits:**
- **Free plan:** 100 Cursor MCP requests per hour
- **Team plan:** 1,000 Cursor MCP requests per hour per user
- **Enterprise plan:** 10,000 MCP requests per hour per organization

**Limit Handling:**
- When limit exceeded: `429 Too Many Requests`
- MCP server caches secrets locally to reduce requests
- Cursor AI notified: "Rate limit reached. Try again in X minutes."

---

## Troubleshooting

### Issue 1: Cursor AI Doesn't Recognize Abyrith

**Symptoms:**
Cursor AI responds: "I don't have access to Abyrith" or "What is Abyrith?"

**Cause:** MCP server not configured or not running

**Solution:**
```bash
# Check MCP config exists
cat ~/.cursor/mcp.json

# If missing, create it (see Setup Guide)
# Then restart Cursor completely

# Verify MCP server running
abyrith-mcp status

# If not running, start it
abyrith-mcp serve
```

---

### Issue 2: "command not found: abyrith-mcp"

**Symptoms:**
```
Error: spawn abyrith-mcp ENOENT
```

**Cause:** Abyrith MCP server not installed or not in PATH

**Solution:**
```bash
# Reinstall MCP server
npm install -g @abyrith/mcp-server

# Verify installation
which abyrith-mcp
# Output: /usr/local/bin/abyrith-mcp

# If not in PATH, add to shell config (~/.zshrc or ~/.bashrc)
export PATH="$PATH:/usr/local/bin"

# Reload shell
source ~/.zshrc  # or source ~/.bashrc

# Restart Cursor
```

---

### Issue 3: Cursor Logs Show "MCP server crashed"

**Symptoms:**
Cursor logs:
```
[MCP] abyrith server crashed with code 1
```

**Cause:** MCP server encountered error and exited

**Solution:**
```bash
# Check MCP server logs
abyrith-mcp logs

# Common issues:
# 1. Authentication expired
abyrith-mcp auth

# 2. Invalid config
abyrith-mcp config validate

# 3. Outdated version
npm update -g @abyrith/mcp-server

# Restart Cursor after fixing
```

---

### Issue 4: Approval Notifications Not Appearing

**Symptoms:**
Cursor AI requests secret, but no browser notification

**Cause:** Browser notifications disabled or Abyrith web app not open

**Solution:**
1. **Enable browser notifications:**
   - Chrome: Settings → Privacy and Security → Site Settings → Notifications
   - Enable for `app.abyrith.com`

2. **Keep Abyrith web app open:**
   - Approvals require browser window open
   - Consider pinning Abyrith tab

3. **Check notification settings in Abyrith:**
   - Abyrith Dashboard → Settings → Notifications
   - Enable "MCP Request Notifications"

4. **Manually check for pending approvals:**
   - Abyrith Dashboard → MCP Requests
   - Approve pending requests manually

---

### Issue 5: Cursor Uses Wrong Project

**Symptoms:**
Cursor AI says: "I can't find that secret" but you know it exists

**Cause:** MCP server pointing to wrong Abyrith project

**Solution:**
```bash
# Check current project
abyrith-mcp config show

# Switch project
abyrith-mcp config set project "CorrectProjectName"

# Or edit Cursor MCP config
nano ~/.cursor/mcp.json
# Update ABYRITH_PROJECT value

# Restart Cursor
```

---

### Debug Mode

**Enable debug logging:**
```bash
# Option 1: Environment variable
export ABYRITH_MCP_LOG_LEVEL=debug
abyrith-mcp serve

# Option 2: Update Cursor MCP config
# Edit ~/.cursor/mcp.json
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"],
      "env": {
        "ABYRITH_MCP_LOG_LEVEL": "debug"
      }
    }
  }
}

# Restart Cursor
```

**What gets logged:**
- Every MCP tool call from Cursor
- HTTP requests to Abyrith API
- JWT validation attempts
- Approval polling
- Decryption attempts (not plaintext values!)
- Cache hits/misses

**View logs:**
```bash
# Real-time logs
tail -f ~/.abyrith/mcp-server.log

# Or via CLI
abyrith-mcp logs --tail 100
```

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [x] `09-integrations/mcp/mcp-overview.md` - MCP architecture and protocol details
- [x] `05-api/endpoints/secrets-endpoints.md` - API for secret retrieval
- [x] `03-security/security-model.md` - Zero-knowledge encryption spec

**External Dependencies:**
- Cursor IDE (latest version with MCP support)
- Abyrith MCP Server (`@abyrith/mcp-server` npm package)
- Node.js 20+ OR Deno 1.40+
- OS-level credential storage (Keychain/Credential Manager/Secret Service)

### Feature Dependencies

**Required by features:**
- User approval workflows in Abyrith web app
- Audit logging for Cursor AI access
- Real-time notifications (browser or WebSocket)

---

## References

### Internal Documentation
- `09-integrations/mcp/mcp-overview.md` - MCP architecture and implementation
- `09-integrations/claude-code/claude-code-integration.md` - Similar integration for Claude Code
- `TECH-STACK.md` - Technology stack specification
- `GLOSSARY.md` - Term definitions (MCP, Zero-Knowledge, JWT, etc.)
- `01-product/product-vision-strategy.md` - Why MCP integrations are key differentiators

### External Resources
- [Cursor Documentation](https://cursor.sh/docs) - Official Cursor docs
- [Cursor MCP Support](https://cursor.sh/docs/mcp) - Cursor's MCP integration guide
- [Model Context Protocol Specification](https://modelcontextprotocol.io) - Official MCP spec
- [MCP SDK](https://github.com/anthropics/mcp-sdk) - TypeScript SDK for MCP servers

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Integration Team | Initial Cursor integration documentation |

---

## Notes

### Why Cursor Integration Matters

Cursor is one of the fastest-growing AI-powered code editors, with thousands of developers using it daily for AI-assisted coding. By integrating Abyrith with Cursor via MCP, we enable a **zero-friction developer experience**:

**Traditional Workflow (Without Abyrith):**
1. Cursor AI: "I need your OpenAI API key"
2. Developer opens browser → Finds key → Copies
3. Developer pastes in terminal or .env file
4. Developer: "I pasted it, continue"
5. Cursor AI continues

**With Abyrith + MCP:**
1. Cursor AI: "I need your OpenAI API key"
2. Developer sees notification → Clicks "Approve" (one-time)
3. Cursor AI continues immediately

**Result:** 5 steps → 2 steps. Developer never leaves Cursor.

### Cursor vs. Claude Code

**Similarities:**
- Both use MCP protocol
- Both integrate with Abyrith MCP server
- Both require user approval for secret access

**Differences:**
- **Cursor:** Full IDE (VSCode fork) with AI features
- **Claude Code:** Standalone app by Anthropic, specifically for Claude AI
- **Cursor:** More general-purpose development
- **Claude Code:** Optimized for conversational AI workflows

**Abyrith supports both seamlessly** via same MCP server.

### Future Enhancements
- Cursor workspace-level approval policies (auto-approve for dev, require for prod)
- Cursor extension for visual approval UI (approve without leaving IDE)
- Integration with Cursor's team features (shared project contexts)
- Support for Cursor's future MCP features as they're released
