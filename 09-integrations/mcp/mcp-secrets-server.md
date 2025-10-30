---
Document: MCP Secrets Server - Integration Guide
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Integration Team
Status: Draft
Dependencies: 09-integrations/mcp/mcp-overview.md, 05-api/endpoints/secrets-endpoints.md, 08-features/ai-assistant/ai-assistant-overview.md, 03-security/security-model.md
---

# MCP Secrets Server Integration

## Overview

The MCP Secrets Server is Abyrith's **key differentiator**, providing the first zero-knowledge secrets manager built for AI-native development. This custom MCP server implementation exposes four specialized tools that allow AI assistants (Claude Code, Cursor) to request, search, and access secrets with user approval, maintaining complete security through zero-knowledge architecture.

**External Service:** Model Context Protocol (Anthropic standard)

**Integration Type:** Custom MCP Server (Node.js/TypeScript)

**Status:** Planned - MVP Feature (Phase 5)

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [MCP Tools Reference](#mcp-tools-reference)
6. [Approval Flow](#approval-flow)
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
- AI development tools can request secrets without manual copy-paste
- Developers maintain workflow context while AI handles secret acquisition
- Zero-knowledge security preserved: secrets decrypted client-side only
- Complete audit trail of all AI tool secret access
- Centralized approval management for team environments

**User benefits:**
- **For Learners:** AI automatically requests keys needed for tutorials, user approves once
- **For Solo Developers:** Claude Code gets secrets instantly without interrupting flow
- **For Development Teams:** Approve AI tool access per developer, track all AI-driven secret usage
- **For Enterprise:** Granular control over which AI tools can access which secrets in which environments

### Technical Purpose

**Responsibilities:**
- Implement MCP protocol standard (JSON-RPC over stdio/HTTP)
- Expose four specialized tools: `list`, `get`, `request`, `search`
- Manage approval workflow for secret access
- Handle time-limited access grants (1 hour, 24 hours, always)
- Maintain zero-knowledge architecture (decrypt client-side)
- Provide comprehensive audit logging for compliance
- Rate limit to prevent abuse

**Integration Points:**
- MCP server runs as standalone Node.js process
- Communicates with Abyrith API over HTTPS (JWT auth)
- Triggers approval notifications in web app (WebSocket or polling)
- Integrates with Claude Code, Cursor via MCP config files
- Logs all requests to audit database

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   AI Development Tools                       │
│         (Claude Code, Cursor, future MCP clients)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ MCP Protocol (JSON-RPC)
                       │ stdio / HTTP+SSE
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Abyrith MCP Server (Node.js/TypeScript)          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MCP Tools (4 exposed):                              │   │
│  │  • mcp_secrets_list                                  │   │
│  │  • mcp_secrets_get      ← Requires approval          │   │
│  │  • mcp_secrets_request  ← Guided acquisition         │   │
│  │  • mcp_secrets_search                                │   │
│  └────────────────────┬─────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Approval Manager:                                   │   │
│  │  • Poll/subscribe to approval status                 │   │
│  │  • Cache approved secrets (encrypted)                │   │
│  │  • Handle timeouts                                   │   │
│  └────────────────────┬─────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Decryption Engine:                                  │   │
│  │  • Request decryption from web app (if open) OR      │   │
│  │  • Prompt user for master password                   │   │
│  │  • Decrypt using Web Crypto API                      │   │
│  └────────────────────┬─────────────────────────────────┘   │
└────────────────────────┼─────────────────────────────────────┘
                       │
                       │ HTTPS (JWT Authentication)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (API Gateway)                │
│  • Validate JWT                                              │
│  • Rate limiting (100/hour free, 1000/hour team)             │
│  • Check approval status                                     │
│  • Route to Supabase or trigger approval flow               │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  Supabase DB    │         │  Abyrith Web    │
│  (secrets,      │         │  App (approval  │
│  approvals,     │         │  UI, WebSocket  │
│  audit logs)    │         │  notifications) │
└─────────────────┘         └─────────────────┘
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
               ┌───────────────┐
               │  User Device  │
               │  (approves    │
               │  requests,    │
               │  decrypts)    │
               └───────────────┘
```

### Data Flow

**Outbound (AI Tool → Abyrith):**

1. **AI tool makes request:**
   - Claude Code: `"I need the OPENAI_API_KEY for this project"`
   - MCP server receives: `mcp_secrets_get({ name: "OPENAI_API_KEY" })`

2. **MCP server checks approval cache:**
   - Cache key: `{user_id}-{project_id}-{secret_name}-{environment}`
   - If cached and not expired: Skip to step 6
   - If not cached: Continue to step 3

3. **MCP server requests approval:**
   - POST `/api/mcp/approvals/request`
   - Body: `{ secret_name, project_id, environment, requested_by: "claude-code" }`
   - Response: `{ approval_id, status: "pending", approval_url }`

4. **User receives notification:**
   - WebSocket message to browser: "Claude Code requests OPENAI_API_KEY"
   - Browser displays approval modal with options:
     - "Approve for 1 hour"
     - "Approve for 24 hours"
     - "Always approve (until revoked)"
     - "Deny"

5. **User approves/denies:**
   - User clicks "Approve for 1 hour"
   - POST `/api/mcp/approvals/{approval_id}/approve`
   - Body: `{ duration: 3600 }`
   - Approval record created in database

6. **MCP server receives approval:**
   - Polling: GET `/api/mcp/approvals/{approval_id}` every 2 seconds
   - OR WebSocket: Real-time notification
   - Response: `{ approved: true, expires_at: "ISO8601" }`

7. **MCP server fetches encrypted secret:**
   - GET `/api/secrets/{secret_id}`
   - Response: `{ encrypted_value, encrypted_dek, nonce, ... }`

8. **MCP server decrypts secret:**
   - **Option A:** If web app open, request decryption via WebSocket
   - **Option B:** Prompt user for master password, decrypt locally
   - Decryption happens client-side (MCP server or browser)
   - Plaintext secret returned to AI tool (in memory only)

9. **MCP server returns to AI tool:**
   - Response: `{ name: "OPENAI_API_KEY", value: "sk-proj-...", expires_in: 3600 }`
   - AI tool uses secret, continues execution

**Inbound (User Initiates):**

1. **User revokes approval:**
   - DELETE `/api/mcp/approvals/{approval_id}`
   - MCP server cache invalidated
   - Next AI request requires new approval

2. **User views MCP activity:**
   - GET `/api/mcp/requests?limit=100`
   - Response: List of all MCP requests with timestamps, results

### Components Involved

**Frontend:**
- Approval modal component (React)
- MCP activity dashboard (view all AI tool requests)
- Real-time notifications (Supabase Realtime)

**Backend:**
- **Abyrith MCP Server** (Node.js/TypeScript): Standalone process, MCP protocol implementation
- **Cloudflare Workers**: API gateway, rate limiting, approval status checks
- **Supabase Database**: `mcp_approvals`, `mcp_requests`, `secrets` tables

**External:**
- **AI Tools**: Claude Code, Cursor (MCP clients)
- **MCP Protocol**: JSON-RPC over stdio or HTTP+SSE

---

## Authentication

### Authentication Method

**Type:** JWT Bearer Token (Supabase Auth) + Device Authorization

**How it works:**

1. **Initial Setup (Device Authorization Flow):**
   ```bash
   # User runs MCP server auth command
   abyrith-mcp auth
   ```

   - Opens browser to Abyrith web app (`https://app.abyrith.com/mcp/authorize`)
   - User logs in (if not already authenticated)
   - User sees: "Claude Code wants to access secrets in project 'RecipeApp'"
   - User selects default project, approves
   - Browser redirects with authorization code: `https://localhost:8888/callback?code=auth_code_here`
   - MCP server exchanges code for JWT (refresh token)
   - JWT stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

2. **Per-Request Authentication:**
   - MCP server includes JWT in `Authorization: Bearer {token}` header
   - Cloudflare Worker validates JWT signature, expiration
   - Worker checks user permissions for requested project/secret
   - JWT contains: `user_id`, `org_id`, `role`, `exp` (expiration)

3. **Master Key for Decryption:**
   - User's master password **never transmitted** to MCP server
   - **Option A (Web App Open):**
     - MCP server requests decryption from browser via WebSocket
     - Browser has master key in memory (user already unlocked)
     - Browser decrypts, returns plaintext to MCP server
   - **Option B (CLI Workflow):**
     - MCP server prompts: "Enter master password to decrypt secrets:"
     - User enters password (input hidden)
     - MCP server derives master key using PBKDF2
     - MCP server decrypts secret
     - Master key wiped from memory after decryption

### Credentials Management

**Where credentials are stored:**
- **Development:** Local keychain (OS-level encryption)
- **JWT Storage:** `~/.abyrith/credentials.json` (encrypted using OS keychain)
- **Master Key:** Never persisted; held in memory only during active decryption

**Credential Format:**
```json
{
  "user_id": "uuid-here",
  "project_id": "uuid-here",
  "project_name": "RecipeApp",
  "jwt_token": "encrypted_blob",
  "created_at": "2025-10-30T12:00:00Z"
}
```

### Obtaining Credentials

**Step 1: Install Abyrith MCP Server**
```bash
# Via npm
npm install -g @abyrith/mcp-server

# Or via Homebrew (future)
brew install abyrith-mcp
```

**Step 2: Authenticate**
```bash
abyrith-mcp auth
```

**Output:**
```
Opening browser for authentication...

✓ Authenticated successfully!
✓ Selected project: RecipeApp
✓ Credentials saved to keychain

Next: Configure your AI tool (Claude Code or Cursor)
Run: abyrith-mcp config show
```

**Step 3: Configure AI Tool**

For **Claude Code** (`~/.config/Claude/claude_desktop_config.json`):
```json
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
```

For **Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"]
    }
  }
}
```

**Step 4: Verify Connection**
```bash
abyrith-mcp test

# Output:
# ✓ Connected to Abyrith API
# ✓ Authenticated as: user@example.com
# ✓ Current project: RecipeApp
# ✓ Available secrets: 5
# ✓ MCP tools registered: 4
```

---

## Configuration

### Environment Variables

**Required:**
```bash
# Automatically set during `abyrith-mcp auth`
ABYRITH_API_URL=https://api.abyrith.com/v1
ABYRITH_PROJECT_ID=uuid-here
```

**Optional:**
```bash
ABYRITH_APPROVAL_TIMEOUT=300        # Seconds to wait for approval (default: 300)
ABYRITH_LOG_LEVEL=info              # Logging level: debug|info|warn|error
ABYRITH_CACHE_TTL=3600              # Approval cache TTL in seconds (default: 3600)
ABYRITH_DECRYPTION_METHOD=auto      # auto|browser|cli (default: auto)
```

### Configuration File

**Location:** `~/.abyrith/mcp-config.json`

**Structure:**
```typescript
interface MCPConfig {
  apiUrl: string;
  projectId: string;
  projectName: string;
  approvalTimeout: number;     // seconds
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  cacheTTL: number;            // seconds
  decryptionMethod: 'auto' | 'browser' | 'cli';
  allowedTools?: string[];     // Restrict which tools are available
  notificationSound?: boolean; // Play sound on approval request
}
```

**Example:**
```json
{
  "apiUrl": "https://api.abyrith.com/v1",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "projectName": "RecipeApp",
  "approvalTimeout": 300,
  "logLevel": "info",
  "cacheTTL": 3600,
  "decryptionMethod": "auto",
  "allowedTools": [
    "mcp_secrets_list",
    "mcp_secrets_get",
    "mcp_secrets_search"
  ],
  "notificationSound": true
}
```

---

## MCP Tools Reference

### Tool 1: `mcp_secrets_list`

**Purpose:** List all secrets available in the current project/environment

**No approval required** (only returns metadata, not values)

**Request Schema:**
```typescript
interface ListSecretsRequest {
  project?: string;        // Optional: override default project
  environment?: string;    // Optional: filter by environment (dev/staging/prod)
  tags?: string[];         // Optional: filter by tags
}
```

**Response Schema:**
```typescript
interface ListSecretsResponse {
  secrets: Array<{
    id: string;              // Secret UUID
    name: string;            // e.g., "OPENAI_API_KEY"
    service: string;         // e.g., "OpenAI"
    environment: string;     // "development" | "staging" | "production"
    lastAccessed: string;    // ISO 8601 timestamp
    tags: string[];          // e.g., ["ai", "api"]
    approvalRequired: boolean; // Always true for mcp_secrets_get
  }>;
  total: number;
}
```

**Example Usage (from AI tool):**
```typescript
const result = await mcpClient.callTool('mcp_secrets_list', {
  environment: 'development',
  tags: ['ai']
});

console.log(result);
// {
//   secrets: [
//     {
//       id: "uuid-1",
//       name: "OPENAI_API_KEY",
//       service: "OpenAI",
//       environment: "development",
//       lastAccessed: "2025-10-29T14:23:00Z",
//       tags: ["ai", "api"],
//       approvalRequired: true
//     },
//     {
//       id: "uuid-2",
//       name: "ANTHROPIC_API_KEY",
//       service: "Anthropic",
//       environment: "development",
//       lastAccessed: "2025-10-28T10:15:00Z",
//       tags: ["ai", "api"],
//       approvalRequired: true
//     }
//   ],
//   total: 2
// }
```

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `403 Forbidden` - User doesn't have access to project
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Server error

---

### Tool 2: `mcp_secrets_get`

**Purpose:** Retrieve a specific secret value (decrypted)

**⚠️ REQUIRES USER APPROVAL** (unless previously approved)

**Request Schema:**
```typescript
interface GetSecretRequest {
  name: string;            // Secret name (e.g., "OPENAI_API_KEY")
  project?: string;        // Optional: override default project
  environment?: string;    // Optional: specify environment (default: development)
  reason?: string;         // Optional: why AI needs this secret (shown to user)
}
```

**Response Schema (Success):**
```typescript
interface GetSecretResponse {
  name: string;
  value: string;           // ⚠️ DECRYPTED SECRET VALUE (plaintext)
  service: string;
  environment: string;
  expiresIn?: number;      // Seconds until approval expires (null if permanent)
}
```

**Response Schema (Approval Required):**
```typescript
interface ApprovalRequiredResponse {
  error: "approval_required";
  message: string;
  approval_id: string;
  approval_url: string;    // URL to Abyrith web app approval page
  timeout: number;         // Seconds until timeout (default: 300)
}
```

**Example Usage:**
```typescript
try {
  // AI tool requests secret
  const result = await mcpClient.callTool('mcp_secrets_get', {
    name: 'OPENAI_API_KEY',
    environment: 'development',
    reason: 'Running AI code generation task'
  });

  console.log(result);
  // {
  //   name: "OPENAI_API_KEY",
  //   value: "sk-proj-abc123def456...",
  //   service: "OpenAI",
  //   environment: "development",
  //   expiresIn: 86400  // 24 hours
  // }

} catch (error) {
  if (error.code === 'approval_required') {
    // User needs to approve
    console.log(`Waiting for approval: ${error.approval_url}`);
    console.log(`Approval ID: ${error.approval_id}`);

    // MCP server waits/polls for approval automatically
    // When approved, request succeeds
  }
}
```

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `403 Forbidden` - User doesn't have permission to access this secret
- `404 Not Found` - Secret doesn't exist
- `409 Conflict` - Approval required (includes `approval_id` and `approval_url`)
- `408 Request Timeout` - User didn't approve within timeout period
- `429 Too Many Requests` - Rate limit exceeded

**Approval Flow (detailed in [Approval Flow](#approval-flow) section)**

---

### Tool 3: `mcp_secrets_request`

**Purpose:** Request a secret that doesn't exist yet (triggers guided acquisition)

**Request Schema:**
```typescript
interface RequestSecretRequest {
  name: string;            // Requested secret name (e.g., "STRIPE_API_KEY")
  service?: string;        // Optional: service hint (e.g., "Stripe", "OpenAI")
  context?: string;        // Optional: why AI needs this secret
  project?: string;        // Optional: override default project
}
```

**Response Schema:**
```typescript
interface RequestSecretResponse {
  request_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  message: string;
  dashboard_url: string;    // URL to Abyrith AI Assistant for guided acquisition
}
```

**Example Usage:**
```typescript
// AI tool needs a secret that doesn't exist
const result = await mcpClient.callTool('mcp_secrets_request', {
  name: 'STRIPE_API_KEY',
  service: 'Stripe',
  context: 'Setting up payment processing for checkout flow'
});

console.log(result);
// {
//   request_id: "uuid",
//   status: "pending",
//   message: "Request sent to user. Open Abyrith to get this secret with AI guidance.",
//   dashboard_url: "https://app.abyrith.com/projects/RecipeApp/ai-assistant?request_id=uuid"
// }
```

**User Experience:**
1. AI tool calls `mcp_secrets_request`
2. User receives notification: "Claude Code requested STRIPE_API_KEY for payment processing"
3. User clicks notification → Opens Abyrith AI Assistant
4. AI Assistant: "I see you need a Stripe API key. Let me guide you through getting one..."
5. AI provides step-by-step instructions (powered by FireCrawl + Claude API)
6. User follows steps, stores key in Abyrith
7. MCP server receives notification that secret is now available
8. AI tool retries `mcp_secrets_get`, now succeeds

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `429 Too Many Requests` - Too many secret requests in short time period
- `500 Internal Server Error` - Server error

---

### Tool 4: `mcp_secrets_search`

**Purpose:** Search for secrets by name, service, or tags

**No approval required** (only returns metadata, not values)

**Request Schema:**
```typescript
interface SearchSecretsRequest {
  query: string;           // Search query (name, service, or tag)
  project?: string;        // Optional: override default project
  environment?: string;    // Optional: filter by environment
  limit?: number;          // Optional: max results (default: 20, max: 100)
}
```

**Response Schema:**
```typescript
interface SearchSecretsResponse {
  secrets: Array<{
    id: string;
    name: string;
    service: string;
    environment: string;
    tags: string[];
    relevance: number;     // 0-1 score indicating match quality
  }>;
  total: number;
}
```

**Example Usage:**
```typescript
// AI tool searches for payment-related secrets
const result = await mcpClient.callTool('mcp_secrets_search', {
  query: 'payment',
  environment: 'production',
  limit: 10
});

console.log(result);
// {
//   secrets: [
//     {
//       id: "uuid-1",
//       name: "STRIPE_SECRET_KEY",
//       service: "Stripe",
//       environment: "production",
//       tags: ["payment", "api"],
//       relevance: 0.95
//     },
//     {
//       id: "uuid-2",
//       name: "PAYPAL_CLIENT_SECRET",
//       service: "PayPal",
//       environment: "production",
//       tags: ["payment", "oauth"],
//       relevance: 0.78
//     }
//   ],
//   total: 2
// }
```

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `400 Bad Request` - Invalid query format
- `500 Internal Server Error` - Server error

---

## Approval Flow

### Detailed Approval Process

**Step-by-Step:**

1. **AI tool requests secret:**
   ```typescript
   const secret = await mcpClient.callTool('mcp_secrets_get', {
     name: 'OPENAI_API_KEY',
     reason: 'Generating code with GPT-4'
   });
   ```

2. **MCP server checks cache:**
   ```typescript
   const cacheKey = `${userId}-${projectId}-OPENAI_API_KEY-development`;
   const cachedApproval = approvalCache.get(cacheKey);

   if (cachedApproval && !cachedApproval.isExpired()) {
     // Skip to decryption
   } else {
     // Request approval
   }
   ```

3. **MCP server requests approval:**
   ```typescript
   POST /api/mcp/approvals/request
   {
     "user_id": "uuid",
     "project_id": "uuid",
     "secret_name": "OPENAI_API_KEY",
     "environment": "development",
     "requested_by": "claude-code",
     "reason": "Generating code with GPT-4"
   }

   Response:
   {
     "approval_id": "uuid",
     "status": "pending",
     "approval_url": "https://app.abyrith.com/approvals/uuid",
     "timeout": 300
   }
   ```

4. **User receives notification:**
   - **Browser (if open):** WebSocket message triggers modal
     ```
     ┌────────────────────────────────────────────┐
     │  Claude Code requests access to:           │
     │                                            │
     │  OPENAI_API_KEY (OpenAI)                   │
     │  Environment: development                  │
     │  Reason: Generating code with GPT-4        │
     │                                            │
     │  [ Approve for 1 hour ]                    │
     │  [ Approve for 24 hours ]                  │
     │  [ Always approve ]                        │
     │  [ Deny ]                                  │
     └────────────────────────────────────────────┘
     ```
   - **Desktop notification (if browser closed):**
     ```
     Abyrith: Claude Code requests OPENAI_API_KEY
     Click to approve or deny
     ```

5. **User approves:**
   ```typescript
   POST /api/mcp/approvals/{approval_id}/approve
   {
     "duration": 3600  // 1 hour in seconds
   }

   Response:
   {
     "approved": true,
     "expires_at": "2025-10-30T13:00:00Z"
   }
   ```

   **Database record created:**
   ```sql
   INSERT INTO mcp_approvals (
     id,
     user_id,
     project_id,
     secret_id,
     requested_by,
     approved_at,
     expires_at,
     duration
   ) VALUES (
     'approval_uuid',
     'user_uuid',
     'project_uuid',
     'secret_uuid',
     'claude-code',
     NOW(),
     NOW() + INTERVAL '1 hour',
     3600
   );
   ```

6. **MCP server receives approval:**
   - **Polling approach:**
     ```typescript
     async function waitForApproval(approvalId: string, timeout: number) {
       const startTime = Date.now();
       while (Date.now() - startTime < timeout * 1000) {
         const status = await checkApprovalStatus(approvalId);
         if (status.approved) return status;
         await sleep(2000); // Poll every 2 seconds
       }
       throw new Error('Approval timeout');
     }
     ```
   - **WebSocket approach (better UX):**
     ```typescript
     const ws = new WebSocket('wss://api.abyrith.com/v1/mcp/approvals/ws');
     ws.on('message', (data) => {
       const event = JSON.parse(data);
       if (event.approval_id === approvalId && event.approved) {
         resolveApproval(event);
       }
     });
     ```

7. **MCP server fetches encrypted secret:**
   ```typescript
   GET /api/secrets/{secret_id}

   Response:
   {
     "id": "secret_uuid",
     "name": "OPENAI_API_KEY",
     "encrypted_value": "base64_encrypted_blob",
     "encrypted_dek": "base64_encrypted_key",
     "secret_nonce": "base64_nonce",
     "dek_nonce": "base64_nonce",
     "service": "OpenAI",
     "environment": "development"
   }
   ```

8. **MCP server decrypts secret:**
   - **Option A (Browser decryption):**
     ```typescript
     // Send decryption request to browser via WebSocket
     ws.send({
       type: 'decrypt_request',
       secret_id: 'secret_uuid',
       encrypted_value: '...',
       encrypted_dek: '...',
       nonces: { secret: '...', dek: '...' }
     });

     // Browser decrypts using master key in memory
     const plaintext = await decryptSecret(encrypted, masterKey);

     // Browser sends back plaintext via WebSocket
     ws.send({
       type: 'decrypt_response',
       secret_id: 'secret_uuid',
       plaintext: 'sk-proj-abc123...'
     });
     ```

   - **Option B (CLI decryption):**
     ```typescript
     // Prompt user for master password
     const masterPassword = await promptSecure('Master password: ');

     // Retrieve salt from API
     const { salt } = await getUserEncryptionKey(userId);

     // Derive master key
     const masterKey = await deriveMasterKey(masterPassword, salt);

     // Decrypt DEK
     const dek = await decryptDEK(encryptedDEK, dekNonce, masterKey);

     // Decrypt secret
     const plaintext = await decryptSecret(encryptedValue, secretNonce, dek);

     // Wipe keys from memory
     masterKey = null;
     dek = null;
     ```

9. **MCP server caches approval:**
   ```typescript
   approvalCache.set(cacheKey, {
     approved: true,
     expiresAt: new Date(Date.now() + 3600 * 1000),
     isExpired: function() {
       return Date.now() > this.expiresAt.getTime();
     }
   });
   ```

10. **MCP server returns to AI tool:**
    ```typescript
    return {
      name: 'OPENAI_API_KEY',
      value: 'sk-proj-abc123def456...',
      service: 'OpenAI',
      environment: 'development',
      expiresIn: 3600
    };
    ```

### Time-Limited Access Grants

**Duration Options:**
- **1 hour:** Temporary approval for current task
- **24 hours:** Approval for full working day
- **Always (until revoked):** Permanent approval for this secret

**Implementation:**
```typescript
interface ApprovalGrant {
  id: string;
  secretId: string;
  approvedAt: Date;
  expiresAt: Date | null;  // null = always approved
  duration: number;         // seconds
}

function isApprovalValid(grant: ApprovalGrant): boolean {
  if (grant.expiresAt === null) return true;  // Always approved
  return new Date() < grant.expiresAt;
}
```

**User can revoke anytime:**
```typescript
DELETE /api/mcp/approvals/{approval_id}

// MCP server cache invalidated
approvalCache.delete(cacheKey);
```

---

## Implementation Details

### Integration Code

**File:** `packages/mcp-server/src/server.ts`

**Full Implementation:**
```typescript
import { MCPServer } from '@modelcontextprotocol/sdk';
import { AbyrithClient } from './client';
import { ApprovalManager } from './approval';
import { DecryptionEngine } from './decryption';

export class AbyrithMCPServer {
  private client: AbyrithClient;
  private approvalManager: ApprovalManager;
  private decryptionEngine: DecryptionEngine;
  private config: MCPConfig;

  constructor(config: MCPConfig) {
    this.config = config;
    this.client = new AbyrithClient({
      apiUrl: config.apiUrl,
      projectId: config.projectId
    });
    this.approvalManager = new ApprovalManager(this.client, config);
    this.decryptionEngine = new DecryptionEngine(config);
  }

  async initialize(): Promise<void> {
    const server = new MCPServer({
      name: 'abyrith',
      version: '1.0.0'
    });

    // Register MCP tools
    server.registerTool('mcp_secrets_list', {
      description: 'List all secrets in the current project',
      schema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          environment: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        }
      },
      handler: this.handleListSecrets.bind(this)
    });

    server.registerTool('mcp_secrets_get', {
      description: 'Get a secret value (requires user approval)',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          project: { type: 'string' },
          environment: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['name']
      },
      handler: this.handleGetSecret.bind(this)
    });

    server.registerTool('mcp_secrets_request', {
      description: 'Request a secret that doesn\'t exist (triggers AI guidance)',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          service: { type: 'string' },
          context: { type: 'string' },
          project: { type: 'string' }
        },
        required: ['name']
      },
      handler: this.handleRequestSecret.bind(this)
    });

    server.registerTool('mcp_secrets_search', {
      description: 'Search for secrets by name, service, or tags',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          project: { type: 'string' },
          environment: { type: 'string' },
          limit: { type: 'number' }
        },
        required: ['query']
      },
      handler: this.handleSearchSecrets.bind(this)
    });

    await server.start();
  }

  async handleGetSecret(params: GetSecretRequest): Promise<GetSecretResponse> {
    const { name, project, environment = 'development', reason } = params;

    try {
      // Check approval cache
      const approval = await this.approvalManager.checkApproval({
        secretName: name,
        project: project || this.config.projectId,
        environment
      });

      if (!approval || approval.isExpired()) {
        // Request approval from user
        const approvalRequest = await this.approvalManager.requestApproval({
          secretName: name,
          project: project || this.config.projectId,
          environment,
          reason
        });

        // Wait for user approval (with timeout)
        const approvedGrant = await this.approvalManager.waitForApproval(
          approvalRequest.id,
          this.config.approvalTimeout
        );

        // Cache approval
        this.approvalManager.cacheApproval(approvedGrant);
      }

      // Fetch encrypted secret
      const encryptedSecret = await this.client.getSecret({
        name,
        project: project || this.config.projectId,
        environment
      });

      // Decrypt secret
      const plaintext = await this.decryptionEngine.decrypt(encryptedSecret);

      return {
        name,
        value: plaintext,
        service: encryptedSecret.service,
        environment,
        expiresIn: approval?.expiresIn || null
      };

    } catch (error) {
      throw this.handleError(error);
    }
  }

  async handleListSecrets(params: ListSecretsRequest): Promise<ListSecretsResponse> {
    const { project, environment, tags } = params;

    const secrets = await this.client.listSecrets({
      project: project || this.config.projectId,
      environment,
      tags
    });

    return {
      secrets: secrets.map(s => ({
        id: s.id,
        name: s.name,
        service: s.service,
        environment: s.environment,
        lastAccessed: s.lastAccessed,
        tags: s.tags,
        approvalRequired: true
      })),
      total: secrets.length
    };
  }

  async handleRequestSecret(params: RequestSecretRequest): Promise<RequestSecretResponse> {
    const { name, service, context, project } = params;

    const request = await this.client.requestSecret({
      name,
      service,
      context,
      project: project || this.config.projectId
    });

    return {
      request_id: request.id,
      status: request.status,
      message: 'Request sent to user. Open Abyrith to get this secret with AI guidance.',
      dashboard_url: request.dashboardUrl
    };
  }

  async handleSearchSecrets(params: SearchSecretsRequest): Promise<SearchSecretsResponse> {
    const { query, project, environment, limit = 20 } = params;

    const results = await this.client.searchSecrets({
      query,
      project: project || this.config.projectId,
      environment,
      limit: Math.min(limit, 100)
    });

    return {
      secrets: results,
      total: results.length
    };
  }

  private handleError(error: any): Error {
    // Map API errors to user-friendly messages
    if (error.status === 401) {
      return new Error('Authentication expired. Run `abyrith-mcp auth` to re-authenticate.');
    }
    if (error.status === 403) {
      return new Error('Permission denied. You may not have access to this secret.');
    }
    if (error.status === 404) {
      return new Error('Secret not found. Try `mcp_secrets_list` to see available secrets.');
    }
    if (error.status === 408) {
      return new Error('Approval timeout. User did not approve within time limit.');
    }
    if (error.status === 409) {
      return new Error(`Approval required. Waiting for user to approve: ${error.approval_url}`);
    }
    return error;
  }
}
```

### Data Transformation

**MCP Request → Abyrith API Request:**

```typescript
// MCP tool call
interface MCPGetSecretRequest {
  name: string;
  project?: string;
  environment?: string;
  reason?: string;
}

// Transformed to Abyrith API
interface AbyrithAPIApprovalRequest {
  user_id: string;
  project_id: string;
  secret_name: string;
  environment: 'development' | 'staging' | 'production';
  requested_by: 'claude-code' | 'cursor' | 'other';
  reason?: string;
  request_context: {
    tool: 'mcp_secrets_get';
    timestamp: string;
    client_version: string;
  };
}

function transformMCPtoAPI(mcpRequest: MCPGetSecretRequest): AbyrithAPIApprovalRequest {
  return {
    user_id: getCurrentUserId(),
    project_id: mcpRequest.project || getDefaultProject(),
    secret_name: mcpRequest.name,
    environment: mcpRequest.environment || 'development',
    requested_by: detectAITool(), // 'claude-code' or 'cursor'
    reason: mcpRequest.reason,
    request_context: {
      tool: 'mcp_secrets_get',
      timestamp: new Date().toISOString(),
      client_version: process.env.npm_package_version || '1.0.0'
    }
  };
}
```

---

## Error Handling

### Error Types

**Error 1: Authentication Expired**
- **When:** JWT token expired (15 minutes)
- **External Code:** `401 Unauthorized`
- **Internal Code:** `AUTH_EXPIRED`
- **Recovery:**
  1. Attempt JWT refresh using refresh token
  2. If refresh fails: `Error: Authentication expired. Run 'abyrith-mcp auth'`
  3. User re-authenticates

**Error 2: Approval Required**
- **When:** User hasn't approved AI tool access to secret
- **External Code:** `409 Conflict`
- **Internal Code:** `APPROVAL_REQUIRED`
- **Recovery:**
  1. Send approval request to API
  2. Display: "Waiting for user approval. Check Abyrith web app."
  3. Poll or wait for WebSocket notification
  4. Retry when approved

**Error 3: Approval Timeout**
- **When:** User doesn't approve within timeout (default: 5 minutes)
- **External Code:** `408 Request Timeout`
- **Internal Code:** `APPROVAL_TIMEOUT`
- **Recovery:**
  1. AI tool informed: "User did not approve OPENAI_API_KEY within 5 minutes"
  2. User can manually approve in web app
  3. AI tool can retry request

**Error 4: Secret Not Found**
- **When:** Requested secret doesn't exist in project
- **External Code:** `404 Not Found`
- **Internal Code:** `SECRET_NOT_FOUND`
- **Recovery:**
  1. AI tool suggests: "Try 'mcp_secrets_request' to get help acquiring this secret"
  2. User can use `mcp_secrets_request` for guided acquisition

**Error 5: Rate Limit Exceeded**
- **When:** Too many MCP requests in short time
- **External Code:** `429 Too Many Requests`
- **Internal Code:** `RATE_LIMIT_EXCEEDED`
- **Recovery:**
  1. Wait for rate limit window (header: `Retry-After`)
  2. Cache previously fetched secrets
  3. Alert user if persistent (possible misconfigured AI tool)

### Retry Strategy

**Retry Policy:**
- Attempts: 3
- Backoff: Exponential (1s, 2s, 4s)
- Max wait: 8 seconds total

**Retriable Errors:**
- `500 Internal Server Error`
- `503 Service Unavailable`
- Network timeout

**Non-Retriable Errors:**
- `401 Unauthorized` (need to re-auth)
- `403 Forbidden` (permission issue)
- `404 Not Found` (secret doesn't exist)
- `409 Conflict` (approval required, different flow)

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

      // Don't retry non-retriable errors
      if ([401, 403, 404, 409].includes(error.status)) {
        throw error;
      }

      // Don't retry on last attempt
      if (i === attempts - 1) break;

      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

---

## Testing

### Unit Tests

**Test File:** `packages/mcp-server/src/__tests__/server.test.ts`

**Mock Setup:**
```typescript
import { jest } from '@jest/globals';
import { AbyrithMCPServer } from '../server';
import { AbyrithClient } from '../client';

jest.mock('../client');

describe('AbyrithMCPServer', () => {
  let server: AbyrithMCPServer;
  let mockClient: jest.Mocked<AbyrithClient>;

  beforeEach(() => {
    mockClient = new AbyrithClient({}) as jest.Mocked<AbyrithClient>;
    server = new AbyrithMCPServer({
      apiUrl: 'https://api.abyrith.test',
      projectId: 'test-project',
      approvalTimeout: 300
    });
    (server as any).client = mockClient;
  });

  describe('handleListSecrets', () => {
    it('should return list of secrets', async () => {
      mockClient.listSecrets.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'OPENAI_API_KEY',
          service: 'OpenAI',
          environment: 'development',
          lastAccessed: '2025-10-30T12:00:00Z',
          tags: ['ai']
        }
      ]);

      const result = await server.handleListSecrets({ environment: 'development' });

      expect(result.secrets).toHaveLength(1);
      expect(result.secrets[0].name).toBe('OPENAI_API_KEY');
      expect(result.secrets[0].approvalRequired).toBe(true);
    });
  });

  describe('handleGetSecret', () => {
    it('should request approval if not cached', async () => {
      const approvalManager = (server as any).approvalManager;
      jest.spyOn(approvalManager, 'checkApproval').mockResolvedValue(null);
      jest.spyOn(approvalManager, 'requestApproval').mockResolvedValue({
        id: 'approval-123',
        status: 'pending'
      });
      jest.spyOn(approvalManager, 'waitForApproval').mockResolvedValue({
        approved: true,
        expiresIn: 3600
      });

      mockClient.getSecret.mockResolvedValue({
        name: 'OPENAI_API_KEY',
        encrypted_value: 'encrypted',
        encrypted_dek: 'encrypted_key',
        service: 'OpenAI',
        environment: 'development'
      });

      const decryptionEngine = (server as any).decryptionEngine;
      jest.spyOn(decryptionEngine, 'decrypt').mockResolvedValue('sk-proj-abc123');

      const result = await server.handleGetSecret({ name: 'OPENAI_API_KEY' });

      expect(result.value).toBe('sk-proj-abc123');
      expect(approvalManager.requestApproval).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

**Test Scenario: Full Approval Workflow**
```typescript
describe('MCP Approval Flow Integration', () => {
  it('should complete full approval workflow', async () => {
    // 1. AI tool requests secret (no approval yet)
    const getSecretPromise = mcpServer.handleGetSecret({
      name: 'STRIPE_API_KEY'
    });

    // 2. Verify approval request sent
    await waitFor(() => {
      expect(apiMock.requestApproval).toHaveBeenCalledWith({
        secretName: 'STRIPE_API_KEY'
      });
    });

    // 3. Simulate user approval
    apiMock.checkApprovalStatus.mockResolvedValueOnce({
      approved: true,
      expiresIn: 86400
    });

    // 4. Verify secret returned
    const result = await getSecretPromise;
    expect(result.value).toBe('sk_test_stripe_key');
  });
});
```

### Manual Testing

**Test in development:**
```bash
# Terminal 1: Start MCP server in debug mode
DEBUG=abyrith:* abyrith-mcp serve

# Terminal 2: Test each tool
abyrith-mcp test list
abyrith-mcp test get OPENAI_API_KEY
abyrith-mcp test search "payment"
abyrith-mcp test request STRIPE_API_KEY --context "Testing"
```

**Verification Checklist:**
- [ ] MCP server starts without errors
- [ ] Authentication works (JWT validated)
- [ ] `list` tool returns correct secrets
- [ ] `get` tool triggers approval flow
- [ ] User receives approval notification in web app
- [ ] After approval, secret returned to AI tool
- [ ] `request` tool creates notification for missing secrets
- [ ] `search` tool returns relevant results
- [ ] Audit logs created for all requests

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- MCP tool invocations per minute/hour (by tool type)
- Approval request rate
- Approval success rate (approved vs. denied vs. timeout)
- Secret access latency (request to decrypted value)
- Error rate by type (auth, approval, not found)

**Business Metrics:**
- Active MCP users (≥1 request in past 7 days)
- Most frequently requested secrets via MCP
- Average time to approve requests
- Percentage of AI-driven secret access vs. manual web app access

### Logging

**Log Format:**
```typescript
{
  timestamp: '2025-10-30T12:34:56Z',
  level: 'INFO',
  event: 'mcp_tool_invoked',
  service: 'abyrith-mcp',
  tool: 'mcp_secrets_get',
  user_id: 'uuid',
  project_id: 'uuid',
  secret_name: 'OPENAI_API_KEY',  // Not the value!
  duration_ms: 1234,
  status: 'success' | 'error',
  error?: 'approval_required' | 'auth_failed'
}
```

### Alerts

**Alert 1: High Approval Timeout Rate**
- Condition: >20% of approvals timeout over 1 hour
- Severity: P2
- Action: Investigate if users aren't receiving notifications

**Alert 2: MCP Authentication Failures**
- Condition: >10 auth failures from same user in 5 minutes
- Severity: P3
- Action: May indicate JWT expiration issue

**Alert 3: Secret Not Found Spike**
- Condition: >50 "not found" errors in 10 minutes
- Severity: P2
- Action: Possible misconfigured AI tool or project context

---

## Security Considerations

### Data Privacy

**Data sent to MCP server:**
- Secret name (not value)
- Project ID
- Environment name
- Request context/reason

**Data received from API:**
- Encrypted secret blobs (AES-256-GCM ciphertext)
- Secret metadata
- Approval status

**Data stored by MCP server:**
- JWT in OS keychain (encrypted at rest)
- Approval cache (status + expiration, no secret values)
- Master key in memory only (never persisted)

### Credential Security

**Protection mechanisms:**
- JWT in OS-level secure credential store
- Master password never transmitted
- Master key held in memory only
- Memory zeroed after decryption

### Compliance

**GDPR:**
- User can revoke MCP access anytime
- Audit logs show which secrets accessed via MCP
- User can export MCP access history

**SOC 2:**
- Access control: User approval required
- Audit logging: All requests logged
- Encryption: Secrets encrypted in transit and at rest
- Least privilege: AI tools only get approved secrets

---

## Cost & Rate Limits

### Pricing Model

**Included in all plans** (Free, Team, Enterprise)

**Estimated cost to Abyrith:**
- Cloudflare Workers: ~$0.15 per million requests
- Supabase DB reads: ~$0.08 per million requests
- Total: ~$0.23 per million MCP requests

### Rate Limits

**Limits:**
- **Free plan:** 100 MCP requests/hour per user
- **Team plan:** 1,000 MCP requests/hour per user
- **Enterprise plan:** 10,000 MCP requests/hour per organization

**How limits are enforced:**
- Rate limit tracked by Cloudflare Worker
- When exceeded: `429 Too Many Requests` with `Retry-After` header
- MCP server caches secrets locally to reduce requests

---

## Troubleshooting

### Issue 1: "Authentication failed. Run `abyrith-mcp auth`"

**Cause:** JWT expired or revoked

**Solution:**
```bash
abyrith-mcp logout
abyrith-mcp auth
```

### Issue 2: "Approval timeout: User did not approve within 5 minutes"

**Cause:** User didn't see or approve request

**Solution:**
1. Check if Abyrith web app is open
2. Increase timeout: `ABYRITH_APPROVAL_TIMEOUT=600`
3. Enable browser notifications
4. Manually approve in Dashboard → MCP Requests

### Issue 3: Claude Code/Cursor not finding MCP server

**Cause:** MCP server not configured in AI tool config

**Solution (Claude Code):**
```bash
cat > ~/.config/Claude/claude_desktop_config.json <<EOF
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"]
    }
  }
}
EOF

# Restart Claude Code
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `09-integrations/mcp/mcp-overview.md` - MCP architecture
- [ ] `05-api/endpoints/secrets-endpoints.md` - Secret API
- [ ] `08-features/ai-assistant/ai-assistant-overview.md` - AI Assistant feature
- [x] `03-security/security-model.md` - Zero-knowledge encryption

**External Dependencies:**
- Model Context Protocol SDK (`@modelcontextprotocol/sdk`)
- Node.js 20+ or Deno 1.40+
- OS-level credential storage (Keychain, Credential Manager, Secret Service)

### Feature Dependencies

**Required by features:**
- `09-integrations/claude-code/setup.md` - Claude Code configuration
- `09-integrations/cursor/setup.md` - Cursor configuration
- `08-features/approval-workflows.md` - User approval flow

---

## References

### Internal Documentation
- `09-integrations/mcp/mcp-overview.md` - MCP integration overview
- `TECH-STACK.md` - Technology stack
- `01-product/product-vision-strategy.md` - Why MCP is key differentiator
- `GLOSSARY.md` - Term definitions (MCP, Zero-Knowledge, JWT)

### External Resources
- [Model Context Protocol Documentation](https://modelcontextprotocol.io) - Official MCP spec
- [MCP SDK (Anthropic)](https://github.com/modelcontextprotocol/sdk) - TypeScript SDK
- [Claude Code Documentation](https://claude.ai/code) - MCP configuration
- [Cursor MCP Support](https://cursor.sh/docs/mcp) - Cursor integration

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Integration Team | Initial MCP Secrets Server specification |

---

## Notes

### Why MCP Secrets Server is a Key Differentiator

MCP integration positions Abyrith as the **first secrets manager built for AI-native development**. Traditional password managers and enterprise secrets managers require manual copy-paste workflows. Abyrith lets AI tools request secrets directly with user approval.

**Competitive Advantage:**
1. **Zero Friction for AI Tools:** Claude Code/Cursor get secrets instantly after one-time approval
2. **Maintains Security:** User approves every access; zero-knowledge architecture preserved
3. **Complete Auditability:** Every AI tool request logged with context
4. **Future-Proof:** As more AI tools support MCP, Abyrith automatically works

**User Experience Win:**
- **Before MCP:** AI needs key → User opens Abyrith → Copy → Paste in terminal → AI continues
- **With MCP:** AI needs key → User clicks "Approve" → AI continues (no copy-paste)

### Future Enhancements
- Support for multiple projects in single MCP server instance
- Project-specific approval policies (auto-approve dev, require approval for prod)
- Temporary approval grants (approve for next 10 requests only)
- Integration with additional AI tools as MCP adoption grows
