---
Document: Model Context Protocol (MCP) - Integration Guide
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Integration Team
Status: Draft
Dependencies: 05-api/endpoints/secrets-endpoints.md, 08-features/ai-assistant/ai-assistant-overview.md, 03-security/security-model.md, 02-architecture/system-overview.md
---

# Model Context Protocol (MCP) Integration

## Overview

The Model Context Protocol (MCP) integration is a **key differentiator** for Abyrith, enabling seamless secrets access for AI-powered development tools like Claude Code and Cursor. MCP allows AI assistants to request API keys and credentials directly from Abyrith with user approval, eliminating the need to manually copy-paste secrets into terminal environments.

**External Service:** [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic

**Integration Type:** MCP Server (custom implementation)

**Status:** Active (MVP Feature - Phase 5)

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [MCP Tools Reference](#mcp-tools-reference)
6. [Implementation Details](#implementation-details)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Monitoring](#monitoring)
10. [Security Considerations](#security-considerations)
11. [Cost & Rate Limits](#cost--rate-limits)
12. [Troubleshooting](#troubleshooting)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Integration Purpose

### Business Value

**What it enables:**
- AI-powered development tools (Claude Code, Cursor) can request secrets directly from Abyrith
- Developers never need to manually copy-paste API keys into terminal environments
- Centralized secret access control with approval workflows for AI tools
- Complete audit trail of which AI tools accessed which secrets and when
- Zero-knowledge architecture maintained (secrets only decrypted client-side)

**User benefits:**
- **For Learners:** AI tools automatically get the keys they need after one-time approval
- **For Solo Developers:** Seamless Claude Code experience without managing environment variables
- **For Development Teams:** Team members can approve AI tool access without sharing plaintext secrets
- **For Enterprise:** Complete visibility and control over AI tool secret access

### Technical Purpose

**Responsibilities:**
- Expose Abyrith secrets to MCP-compatible AI tools (Claude Code, Cursor, future tools)
- Implement approval workflows for secret access requests
- Maintain zero-knowledge security (decryption happens client-side)
- Provide detailed audit logging of all MCP requests
- Handle rate limiting to prevent abuse by AI tools

**Integration Points:**
- MCP server runs as a Node.js/Deno process alongside AI development tools
- Communicates with Abyrith API for secret metadata and approval status
- Triggers user approval prompts in Abyrith web app (via WebSocket or polling)
- Returns decrypted secrets only after user approval

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   AI Development Tools                       │
│   (Claude Code, Cursor, future MCP-compatible tools)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ MCP Protocol (JSON-RPC over stdio/HTTP)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Abyrith MCP Server (Node.js/Deno)              │
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
│  • Rate limiting (per user, per AI tool)                     │
│  • Route to Supabase or trigger approval flow               │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  Supabase DB    │         │  Abyrith Web    │
│  (metadata)     │         │  App (approval  │
│                 │         │  UI)            │
└─────────────────┘         └─────────────────┘
         │                           │
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
               ┌───────────────┐
               │  User Device  │
               │  (client-side │
               │  decryption)  │
               └───────────────┘
```

### Data Flow

**Outbound (MCP Tool Request → Abyrith):**
1. AI tool (Claude Code) requests secret via MCP: `abyrith_secrets_get("OPENAI_API_KEY")`
2. MCP server validates request and calls Abyrith API with JWT
3. Cloudflare Worker checks authentication, rate limits, and permissions
4. If secret exists and user has permission:
   - If approval not yet granted: Trigger approval flow (notification to web app)
   - If approval already granted: Return encrypted secret to MCP server
5. MCP server decrypts secret client-side (if user approved)
6. MCP server returns plaintext secret to AI tool (in memory only)

**Inbound (User Approval → MCP Tool):**
1. User receives notification in Abyrith web app: "Claude Code requests OPENAI_API_KEY"
2. User approves with time limit (1 hour, 24 hours, always)
3. Web app sends approval to Supabase (approval record created)
4. MCP server polls or receives WebSocket notification of approval
5. MCP server requests encrypted secret from API
6. MCP server decrypts secret client-side using user's master key
7. MCP server returns secret to waiting AI tool

### Components Involved

**Frontend:**
- Approval UI component (modal/notification in web app)
- Real-time approval status updates (via Supabase Realtime)
- MCP request activity log viewer

**Backend:**
- **Abyrith MCP Server** (Node.js/Deno): Standalone process implementing MCP protocol
- **Cloudflare Workers**: API gateway, rate limiting, approval status checks
- **Supabase Database**: Stores MCP approval records, audit logs, secret metadata

**External:**
- **AI Development Tools**: Claude Code, Cursor (MCP clients)
- **MCP Protocol**: JSON-RPC over stdio or HTTP/SSE

---

## Authentication

### Authentication Method

**Type:** JWT Bearer Token + MCP Session

**How it works:**

1. **Initial Setup:**
   - User authenticates to Abyrith web app (standard login)
   - User authorizes MCP server (one-time device authorization)
   - MCP server receives long-lived JWT (refresh token) for the user
   - MCP server stores JWT securely in local keychain/credential store

2. **Per-Request Auth:**
   - MCP server includes JWT in `Authorization: Bearer {token}` header
   - Cloudflare Worker validates JWT signature and expiration
   - Worker checks user permissions for requested project/secret
   - JWT contains user ID and organization ID for RLS enforcement

3. **Master Key for Decryption:**
   - User's master password never transmitted to MCP server
   - MCP server requests decryption from web app (if browser open) OR
   - User prompted to enter master password in MCP client (for CLI workflows)
   - Decryption happens in secure enclave (browser or MCP server memory)

### Credentials Management

**Where credentials are stored:**
- **Development:** Local keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **JWT Storage:** Encrypted at rest using OS-level credential APIs
- **Master Key:** Never persisted; held in memory only during active session

**Credential Format:**
```bash
# Stored securely in OS keychain
ABYRITH_MCP_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ABYRITH_MCP_USER_ID=user_uuid_here
ABYRITH_MCP_PROJECT_ID=project_uuid_here  # Current project context
```

### Obtaining Credentials

**Step 1: Install Abyrith MCP Server**
```bash
npm install -g @abyrith/mcp-server
# or
brew install abyrith-mcp
```

**Step 2: Authenticate**
```bash
abyrith-mcp auth
```
This opens browser to Abyrith web app for OAuth-style authorization:
- User logs in (if not already)
- User sees: "Claude Code wants to access your secrets"
- User approves and selects default project
- Browser redirects back with authorization code
- MCP server exchanges code for JWT and stores in keychain

**Step 3: Configure AI Tool**

For **Claude Code**, add to `claude_desktop_config.json`:
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

For **Cursor**, add to `.cursor/mcp.json`:
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
# Output: ✓ Connected to Abyrith
#         ✓ Found project: RecipeApp
#         ✓ Available secrets: 5
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
ABYRITH_MCP_LOG_LEVEL=info                   # Logging level: debug|info|warn|error
ABYRITH_MCP_CACHE_TTL=3600                   # Secret list cache TTL in seconds (default: 3600)
```

### Configuration File

**Location:** `~/.abyrith/mcp-config.json`

**Structure:**
```typescript
interface MCPConfig {
  apiUrl: string;
  projectId: string;
  projectName: string;
  approvalTimeout: number;  // seconds
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  cacheTTL: number;  // seconds
  allowedTools?: string[];  // Restrict which MCP tools are available
}
```

**Example:**
```json
{
  "apiUrl": "https://api.abyrith.com/v1",
  "projectId": "uuid-here",
  "projectName": "RecipeApp",
  "approvalTimeout": 300,
  "logLevel": "info",
  "cacheTTL": 3600,
  "allowedTools": [
    "abyrith_secrets_list",
    "abyrith_secrets_get",
    "abyrith_secrets_search"
  ]
}
```

---

## MCP Tools Reference

The Abyrith MCP server exposes four tools that AI assistants can use:

### Tool 1: `abyrith_secrets_list`

**Purpose:** List all secrets available in the current project

**Signature:**
```typescript
interface ListSecretsRequest {
  project?: string;        // Optional: override default project
  environment?: string;    // Optional: filter by environment (dev/staging/prod)
}

interface ListSecretsResponse {
  secrets: Array<{
    name: string;
    service: string;
    environment: string;
    lastAccessed: string;  // ISO 8601 timestamp
    tags: string[];
  }>;
}
```

**Example Usage (from AI tool):**
```typescript
const result = await mcpClient.callTool('abyrith_secrets_list', {
  environment: 'development'
});

console.log(result);
// Output:
// {
//   secrets: [
//     {
//       name: "OPENAI_API_KEY",
//       service: "OpenAI",
//       environment: "development",
//       lastAccessed: "2025-10-29T14:23:00Z",
//       tags: ["ai", "api"]
//     },
//     ...
//   ]
// }
```

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `403 Forbidden` - User doesn't have access to project
- `404 Not Found` - Project doesn't exist

---

### Tool 2: `abyrith_secrets_get`

**Purpose:** Retrieve a specific secret (requires approval)

**Signature:**
```typescript
interface GetSecretRequest {
  name: string;            // Secret name (e.g., "OPENAI_API_KEY")
  project?: string;        // Optional: override default project
  environment?: string;    // Optional: specify environment (defaults to dev)
}

interface GetSecretResponse {
  name: string;
  value: string;           // Decrypted secret value (plaintext)
  service: string;
  environment: string;
  expiresIn?: number;      // Seconds until approval expires (null if permanent)
}
```

**Example Usage:**
```typescript
// AI tool requests secret
const result = await mcpClient.callTool('abyrith_secrets_get', {
  name: 'OPENAI_API_KEY',
  environment: 'development'
});

// If approval not yet granted, throws error with approval URL
// If approval granted, returns:
// {
//   name: "OPENAI_API_KEY",
//   value: "sk-proj-abc123...",
//   service: "OpenAI",
//   environment: "development",
//   expiresIn: 86400  // 24 hours
// }
```

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `403 Forbidden` - User doesn't have permission to access this secret
- `404 Not Found` - Secret doesn't exist in this project/environment
- `409 Conflict` - Approval required (response includes approval_url)
  ```json
  {
    "error": "approval_required",
    "message": "User approval needed for OPENAI_API_KEY",
    "approval_url": "https://app.abyrith.com/approvals/uuid",
    "approval_id": "uuid"
  }
  ```
- `408 Request Timeout` - User didn't approve within timeout period

**Approval Flow:**
1. AI tool calls `abyrith_secrets_get`
2. MCP server checks if approval exists for (user, secret, AI tool)
3. If no approval: Return 409 error with `approval_url`
4. User receives notification in Abyrith web app
5. User approves with time limit selection
6. MCP server polls or receives WebSocket notification
7. MCP server retries request, now returns decrypted secret

---

### Tool 3: `abyrith_secrets_request`

**Purpose:** Request a secret that doesn't exist yet (triggers guided acquisition)

**Signature:**
```typescript
interface RequestSecretRequest {
  name: string;            // Requested secret name
  service?: string;        // Optional: service hint (e.g., "Stripe", "OpenAI")
  context?: string;        // Optional: why AI needs this secret
  project?: string;        // Optional: override default project
}

interface RequestSecretResponse {
  requestId: string;
  status: 'pending' | 'in_progress' | 'completed';
  message: string;
  dashboardUrl: string;    // URL to Abyrith dashboard for user
}
```

**Example Usage:**
```typescript
// AI tool needs a secret that doesn't exist
const result = await mcpClient.callTool('abyrith_secrets_request', {
  name: 'STRIPE_API_KEY',
  service: 'Stripe',
  context: 'Setting up payment processing for checkout flow'
});

console.log(result);
// {
//   requestId: "uuid",
//   status: "pending",
//   message: "Request sent to user. You'll be notified when the secret is available.",
//   dashboardUrl: "https://app.abyrith.com/projects/RecipeApp/secrets/requests/uuid"
// }
```

**User Experience:**
1. AI tool calls `abyrith_secrets_request`
2. User receives notification: "Claude Code requested STRIPE_API_KEY for payment processing"
3. User clicks notification, opens Abyrith AI Assistant
4. AI Assistant: "I see you need a Stripe API key. Let me help you get one..."
5. AI provides guided acquisition flow (step-by-step instructions)
6. User follows steps, stores key in Abyrith
7. MCP server receives notification that secret is now available
8. AI tool notified, continues execution

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `429 Too Many Requests` - Too many secret requests in short time period

---

### Tool 4: `abyrith_secrets_search`

**Purpose:** Search for secrets by name, service, or tags

**Signature:**
```typescript
interface SearchSecretsRequest {
  query: string;           // Search query (name, service, or tag)
  project?: string;        // Optional: override default project
  environment?: string;    // Optional: filter by environment
}

interface SearchSecretsResponse {
  secrets: Array<{
    name: string;
    service: string;
    environment: string;
    tags: string[];
    relevance: number;     // 0-1 score indicating match quality
  }>;
}
```

**Example Usage:**
```typescript
// AI tool searches for API keys related to payments
const result = await mcpClient.callTool('abyrith_secrets_search', {
  query: 'payment',
  environment: 'production'
});

console.log(result);
// {
//   secrets: [
//     {
//       name: "STRIPE_SECRET_KEY",
//       service: "Stripe",
//       environment: "production",
//       tags: ["payment", "api"],
//       relevance: 0.95
//     },
//     {
//       name: "PAYPAL_CLIENT_SECRET",
//       service: "PayPal",
//       environment: "production",
//       tags: ["payment", "oauth"],
//       relevance: 0.78
//     }
//   ]
// }
```

**Error Cases:**
- `401 Unauthorized` - JWT expired or invalid
- `400 Bad Request` - Invalid query format

---

## Implementation Details

### Integration Code

**File:** `packages/mcp-server/src/server.ts`

**Implementation:**
```typescript
import { MCPServer } from '@anthropic/mcp-sdk';
import { AbyrithClient } from './client';

export class AbyrithMCPServer {
  private client: AbyrithClient;
  private approvalCache: Map<string, ApprovalStatus>;

  constructor(config: MCPConfig) {
    this.client = new AbyrithClient({
      apiUrl: config.apiUrl,
      jwt: config.jwt
    });
    this.approvalCache = new Map();
  }

  async initialize(): Promise<void> {
    const server = new MCPServer({
      name: 'abyrith',
      version: '1.0.0'
    });

    // Register MCP tools
    server.registerTool('abyrith_secrets_list', this.handleListSecrets.bind(this));
    server.registerTool('abyrith_secrets_get', this.handleGetSecret.bind(this));
    server.registerTool('abyrith_secrets_request', this.handleRequestSecret.bind(this));
    server.registerTool('abyrith_secrets_search', this.handleSearchSecrets.bind(this));

    await server.start();
  }

  async handleGetSecret(params: GetSecretRequest): Promise<GetSecretResponse> {
    const { name, project, environment = 'development' } = params;

    try {
      // Check if we have approval cached
      const cacheKey = `${project}-${name}-${environment}`;
      const cachedApproval = this.approvalCache.get(cacheKey);

      if (cachedApproval && !cachedApproval.isExpired()) {
        // Approval exists, fetch encrypted secret
        const encryptedSecret = await this.client.getSecret(name, project, environment);

        // Decrypt client-side (using cached master key or prompt user)
        const decryptedValue = await this.decryptSecret(encryptedSecret);

        return {
          name,
          value: decryptedValue,
          service: encryptedSecret.service,
          environment,
          expiresIn: cachedApproval.expiresIn
        };
      }

      // No approval yet - trigger approval flow
      const approvalRequest = await this.client.requestApproval({
        secretName: name,
        project,
        environment,
        requestedBy: 'mcp-client',
        context: 'AI tool requesting access'
      });

      // Wait for approval (with timeout)
      const approval = await this.waitForApproval(approvalRequest.id, 300); // 5 min timeout

      // Cache approval
      this.approvalCache.set(cacheKey, approval);

      // Now fetch and decrypt secret
      const encryptedSecret = await this.client.getSecret(name, project, environment);
      const decryptedValue = await this.decryptSecret(encryptedSecret);

      return {
        name,
        value: decryptedValue,
        service: encryptedSecret.service,
        environment,
        expiresIn: approval.expiresIn
      };

    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async decryptSecret(encrypted: EncryptedSecret): Promise<string> {
    // Option 1: If web app is open, request decryption from browser
    if (this.isWebAppConnected()) {
      return this.requestDecryptionFromWebApp(encrypted);
    }

    // Option 2: Prompt user for master password in MCP client
    const masterPassword = await this.promptForMasterPassword();
    const masterKey = await this.deriveMasterKey(masterPassword);

    // Decrypt using Web Crypto API
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encrypted.iv
      },
      masterKey,
      encrypted.ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  private async waitForApproval(approvalId: string, timeoutSeconds: number): Promise<ApprovalStatus> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.client.checkApprovalStatus(approvalId);

      if (status.approved) {
        return status;
      }

      // Poll every 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Approval timeout: User did not approve within time limit');
  }

  private handleError(error: any): Error {
    // Map API errors to MCP errors
    if (error.status === 401) {
      return new Error('Authentication failed. Run `abyrith-mcp auth` to re-authenticate.');
    }
    if (error.status === 403) {
      return new Error('Permission denied. You may not have access to this secret.');
    }
    if (error.status === 404) {
      return new Error('Secret not found. Try `abyrith_secrets_list` to see available secrets.');
    }
    return error;
  }
}
```

### Data Transformation

**External Format (MCP Protocol) → Internal Format (Abyrith API):**

```typescript
// MCP tool request
interface MCPGetSecretRequest {
  name: string;
  project?: string;
  environment?: string;
}

// Transformed to Abyrith API request
interface AbyrithAPIRequest {
  secret_name: string;
  project_id: string;
  environment: 'development' | 'staging' | 'production';
  requested_by: 'mcp-client';
  request_context: {
    tool: 'abyrith_secrets_get';
    timestamp: string;
    client_version: string;
  };
}

function transformMCPtoAPI(mcpRequest: MCPGetSecretRequest): AbyrithAPIRequest {
  return {
    secret_name: mcpRequest.name,
    project_id: mcpRequest.project || getDefaultProject(),
    environment: mcpRequest.environment || 'development',
    requested_by: 'mcp-client',
    request_context: {
      tool: 'abyrith_secrets_get',
      timestamp: new Date().toISOString(),
      client_version: process.env.npm_package_version || '1.0.0'
    }
  };
}
```

---

## Error Handling

### Error Types

**Error 1: Authentication Failure**
- **When:** JWT expired or invalid
- **External Code:** `401`
- **Internal Code:** `AUTH_EXPIRED`
- **Recovery:**
  1. Attempt to refresh JWT using refresh token
  2. If refresh fails, prompt user: "Authentication expired. Run `abyrith-mcp auth` to re-authenticate."
  3. User runs auth command, receives new JWT

**Error 2: Approval Required**
- **When:** User hasn't approved AI tool access to secret
- **External Code:** `409`
- **Internal Code:** `APPROVAL_REQUIRED`
- **Recovery:**
  1. Send approval request to Abyrith API
  2. Notify user (desktop notification + web app)
  3. Wait for approval (with timeout)
  4. Retry original request

**Error 3: Approval Timeout**
- **When:** User doesn't approve within timeout period (default 5 minutes)
- **External Code:** `408`
- **Internal Code:** `APPROVAL_TIMEOUT`
- **Recovery:**
  1. Notify AI tool that approval timed out
  2. AI tool can inform user: "I need access to OPENAI_API_KEY. Please approve in Abyrith and try again."
  3. User can manually trigger approval in web app

**Error 4: Secret Not Found**
- **When:** Requested secret doesn't exist in project
- **External Code:** `404`
- **Internal Code:** `SECRET_NOT_FOUND`
- **Recovery:**
  1. AI tool suggests using `abyrith_secrets_request` instead
  2. User receives notification to add the secret
  3. AI Assistant provides guided acquisition flow

**Error 5: Rate Limit Exceeded**
- **When:** Too many MCP requests in short time period
- **External Code:** `429`
- **Internal Code:** `RATE_LIMIT_EXCEEDED`
- **Recovery:**
  1. Wait for rate limit window to reset (header: `Retry-After`)
  2. Cache previously fetched secrets to reduce requests
  3. If persistent, notify user of unusual AI tool behavior

### Retry Strategy

**Retry Policy:**
- Attempts: 3
- Backoff: Exponential (1s, 2s, 4s)
- Max wait: 8 seconds total

**Retriable Errors:**
- `500 Internal Server Error` - Temporary server issue
- `503 Service Unavailable` - Supabase or Cloudflare temporarily down
- `408 Request Timeout` - Network timeout

**Non-Retriable Errors:**
- `401 Unauthorized` - Need to re-authenticate
- `403 Forbidden` - Permission issue won't resolve with retry
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

// Mock Abyrith API client
jest.mock('../client');

describe('AbyrithMCPServer', () => {
  let server: AbyrithMCPServer;
  let mockClient: jest.Mocked<AbyrithClient>;

  beforeEach(() => {
    mockClient = new AbyrithClient({}) as jest.Mocked<AbyrithClient>;
    server = new AbyrithMCPServer({
      apiUrl: 'https://api.abyrith.test',
      jwt: 'mock-jwt'
    });
    (server as any).client = mockClient;
  });

  describe('handleListSecrets', () => {
    it('should return list of secrets from API', async () => {
      mockClient.listSecrets.mockResolvedValue({
        secrets: [
          { name: 'OPENAI_API_KEY', service: 'OpenAI', environment: 'dev' }
        ]
      });

      const result = await server.handleListSecrets({ environment: 'dev' });

      expect(result.secrets).toHaveLength(1);
      expect(result.secrets[0].name).toBe('OPENAI_API_KEY');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.listSecrets.mockRejectedValue({ status: 401, message: 'Unauthorized' });

      await expect(server.handleListSecrets({}))
        .rejects.toThrow('Authentication failed');
    });
  });

  describe('handleGetSecret', () => {
    it('should request approval if not cached', async () => {
      mockClient.requestApproval.mockResolvedValue({ id: 'approval-123' });
      mockClient.checkApprovalStatus.mockResolvedValue({
        approved: true,
        expiresIn: 3600
      });
      mockClient.getSecret.mockResolvedValue({
        name: 'OPENAI_API_KEY',
        encrypted_value: 'encrypted-data',
        iv: 'iv-data'
      });

      // Mock decryption
      (server as any).decryptSecret = jest.fn().mockResolvedValue('sk-proj-abc123');

      const result = await server.handleGetSecret({
        name: 'OPENAI_API_KEY'
      });

      expect(result.value).toBe('sk-proj-abc123');
      expect(mockClient.requestApproval).toHaveBeenCalled();
    });

    it('should use cached approval if available', async () => {
      // Pre-populate approval cache
      (server as any).approvalCache.set('default-OPENAI_API_KEY-development', {
        approved: true,
        expiresIn: 3600,
        isExpired: () => false
      });

      mockClient.getSecret.mockResolvedValue({
        name: 'OPENAI_API_KEY',
        encrypted_value: 'encrypted-data'
      });
      (server as any).decryptSecret = jest.fn().mockResolvedValue('sk-proj-abc123');

      const result = await server.handleGetSecret({ name: 'OPENAI_API_KEY' });

      expect(result.value).toBe('sk-proj-abc123');
      expect(mockClient.requestApproval).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

**Test Scenario 1: Full Approval Flow**
```typescript
describe('MCP Approval Flow Integration', () => {
  it('should complete full approval workflow', async () => {
    // 1. AI tool requests secret (no approval yet)
    const getSecretPromise = mcpServer.handleGetSecret({
      name: 'STRIPE_API_KEY'
    });

    // 2. Verify approval request sent to API
    await waitFor(() => {
      expect(apiMock.requestApproval).toHaveBeenCalledWith({
        secretName: 'STRIPE_API_KEY'
      });
    });

    // 3. Simulate user approval in web app
    apiMock.checkApprovalStatus.mockResolvedValueOnce({
      approved: true,
      expiresIn: 86400
    });

    // 4. Verify secret returned to AI tool
    const result = await getSecretPromise;
    expect(result.value).toBe('sk_test_stripe_key_here');
  });
});
```

### Manual Testing

**Test in development:**
```bash
# Terminal 1: Start MCP server in debug mode
DEBUG=abyrith:* abyrith-mcp serve

# Terminal 2: Test each MCP tool
abyrith-mcp test list
abyrith-mcp test get OPENAI_API_KEY
abyrith-mcp test search "payment"
abyrith-mcp test request STRIPE_API_KEY --context "Testing payments"
```

**Verify:**
- [ ] MCP server starts without errors
- [ ] Authentication works (JWT validated)
- [ ] List tool returns correct secrets
- [ ] Get tool triggers approval flow
- [ ] User receives approval notification in web app
- [ ] After approval, secret returned to AI tool
- [ ] Request tool creates notification for missing secrets
- [ ] Search tool returns relevant results
- [ ] Audit logs created for all MCP requests

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- MCP tool invocations per minute/hour (by tool type)
- Approval request rate
- Approval success rate (approved vs. denied vs. timeout)
- Secret access latency (time from request to decrypted value)
- Error rate by error type (auth, approval, not found, etc.)

**Business Metrics:**
- Active MCP users (users with at least 1 MCP request in past 7 days)
- Most frequently requested secrets via MCP
- Average time to approve MCP requests
- Percentage of AI-driven secret access vs. manual web app access

### Logging

**Log Level:** INFO | WARN | ERROR

**Logged Events:**
- MCP server started/stopped
- Tool invocation (with tool name, user ID, project ID)
- Approval request sent
- Approval granted/denied/timeout
- Secret decrypted and returned
- Error encountered (with error type and context)

**Log Format:**
```typescript
{
  timestamp: '2025-10-30T12:34:56Z',
  level: 'INFO',
  event: 'mcp_tool_invoked',
  service: 'abyrith-mcp',
  tool: 'abyrith_secrets_get',
  user_id: 'uuid',
  project_id: 'uuid',
  secret_name: 'OPENAI_API_KEY',  // Not secret value!
  duration_ms: 1234,
  status: 'success' | 'error',
  error?: 'approval_required' | 'auth_failed' | etc
}
```

### Alerts

**Alert 1: High Approval Timeout Rate**
- **Condition:** >20% of approval requests timeout over 1 hour period
- **Severity:** P2
- **Action:** Investigate if users aren't receiving notifications or if timeout is too short

**Alert 2: MCP Authentication Failures**
- **Condition:** >10 auth failures from same user in 5 minutes
- **Severity:** P3
- **Action:** May indicate JWT expiration issue or compromised credentials

**Alert 3: Secret Not Found Spike**
- **Condition:** >50 "secret not found" errors in 10 minutes
- **Severity:** P2
- **Action:** May indicate misconfigured AI tool or project context issue

**Alert 4: MCP Server Unavailable**
- **Condition:** No MCP requests processed in 15 minutes (during business hours)
- **Severity:** P1
- **Action:** MCP server may have crashed; restart service

---

## Security Considerations

### Data Privacy

**Data sent to MCP server from AI tool:**
- Secret name (not value)
- Project ID
- Environment name
- Request context (why AI needs the secret)
- **NO sensitive data**: Secret values never transmitted until user approves

**Data received from Abyrith API:**
- Encrypted secret blobs (AES-256-GCM ciphertext)
- Secret metadata (name, service, last accessed)
- Approval status
- **NO plaintext secrets**: Decryption happens client-side in MCP server

**Data stored by MCP server:**
- JWT (refresh token) in OS keychain (encrypted at rest)
- Approval cache (approval status + expiration, no secret values)
- Master key in memory only (never persisted to disk)

### Credential Security

**How credentials are protected:**
- JWT stored in OS-level secure credential store (Keychain/Credential Manager/Secret Service)
- Master password never transmitted over network
- Master key held in memory only during active decryption
- Memory zeroed after decryption completes

**Access control:**
- Only user's own processes can access keychain credentials
- MCP server runs with user's privileges (not elevated)
- No network exposure (MCP server only accepts local stdio/socket connections)

**Rotation policy:**
- JWT refresh tokens rotated every 30 days
- User can revoke MCP access anytime in web app
- Master password can be changed (triggers re-encryption of all secrets)

### Compliance

**GDPR:** MCP server respects user data rights:
- User can revoke MCP access (delete all approvals and cached data)
- Audit logs show exactly which secrets were accessed via MCP
- User can export their MCP access history

**SOC 2:** Relevant controls for MCP integration:
- Access control: User approval required for every secret access
- Audit logging: All MCP requests logged with timestamps and context
- Encryption: Secrets encrypted in transit and at rest
- Least privilege: AI tools only get approved secrets, not all project secrets

---

## Cost & Rate Limits

### Pricing Model

**Pricing structure:**
- MCP integration is **included** in all Abyrith plans (Free, Team, Enterprise)
- No per-request charges for MCP API calls
- Costs are absorbed as part of platform infrastructure

**Estimated monthly cost (to Abyrith):**
- Cloudflare Workers: ~$0.15 per million MCP requests
- Supabase DB reads: ~$0.08 per million MCP requests
- Total cost: ~$0.23 per million MCP requests (negligible)

### Rate Limits

**Limits:**
- **Free plan:** 100 MCP requests per hour per user
- **Team plan:** 1,000 MCP requests per hour per user
- **Enterprise plan:** 10,000 MCP requests per hour per organization (shared pool)

**How we handle limits:**
- Rate limit tracked by Cloudflare Worker (per-user or per-org)
- When limit exceeded:
  - Return `429 Too Many Requests` with `Retry-After` header
  - MCP server caches secrets locally to reduce requests
  - User notified if consistently hitting limits

**Monitoring usage:**
- Dashboard shows MCP request count per user/project
- Email notification at 80% of hourly limit
- Suggestions to upgrade plan if consistently hitting limits

---

## Troubleshooting

### Issue 1: "Authentication failed. Run `abyrith-mcp auth` to re-authenticate."

**Symptoms:**
```
Error: Authentication failed. Run `abyrith-mcp auth` to re-authenticate.
```

**Cause:** JWT expired or was revoked in Abyrith web app

**Solution:**
```bash
# Re-authenticate MCP server
abyrith-mcp auth

# If that fails, clear cached credentials and try again
abyrith-mcp logout
abyrith-mcp auth
```

---

### Issue 2: "Approval timeout: User did not approve within time limit"

**Symptoms:**
```
Error: Approval timeout: User did not approve within 5 minutes
```

**Cause:** User didn't see or didn't approve the MCP request in time

**Solution:**
1. Check if Abyrith web app is open (approvals require browser)
2. Increase timeout in config: `ABYRITH_MCP_APPROVAL_TIMEOUT=600` (10 minutes)
3. Enable browser notifications for Abyrith app
4. Manually approve in web app: Go to Dashboard → MCP Requests → Approve pending requests

---

### Issue 3: Claude Code/Cursor not finding Abyrith MCP server

**Symptoms:**
```
Claude Code: Error: MCP server 'abyrith' not found
```

**Cause:** MCP server not configured correctly in AI tool config

**Solution:**

For **Claude Code**:
```bash
# Check if config file exists
cat ~/.config/Claude/claude_desktop_config.json

# If missing, create it
mkdir -p ~/.config/Claude
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

For **Cursor**:
```bash
# Check if config file exists
cat ~/.cursor/mcp.json

# If missing, create it
mkdir -p ~/.cursor
cat > ~/.cursor/mcp.json <<EOF
{
  "mcpServers": {
    "abyrith": {
      "command": "abyrith-mcp",
      "args": ["serve"]
    }
  }
}
EOF

# Restart Cursor
```

---

### Issue 4: "Secret not found" but I know it exists

**Symptoms:**
```
Error: Secret 'OPENAI_API_KEY' not found in project 'RecipeApp'
```

**Cause:** MCP server context pointing to wrong project or environment

**Solution:**
```bash
# Check current project context
abyrith-mcp config show

# Change project context
abyrith-mcp config set project "CorrectProjectName"

# Or specify environment explicitly in AI tool request
# (AI tool would call with { environment: 'production' })
```

---

### Debug Mode

**Enable debug logging:**
```bash
# Set environment variable
export ABYRITH_MCP_LOG_LEVEL=debug

# Or add to config file
abyrith-mcp config set logLevel debug

# Start server
abyrith-mcp serve
```

**What gets logged in debug mode:**
- Every HTTP request/response to Abyrith API
- JWT contents (claims, expiration)
- Approval polling attempts
- Cache hits/misses
- Decryption attempts (not the plaintext values!)

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [x] `05-api/endpoints/secrets-endpoints.md` - API for secret retrieval and metadata
- [x] `03-security/security-model.md` - Zero-knowledge encryption specification
- [x] `02-architecture/system-overview.md` - Overall system architecture
- [x] `08-features/ai-assistant/ai-assistant-overview.md` - AI Assistant feature documentation (for guided acquisition)

**External Dependencies:**
- Model Context Protocol SDK (`@anthropic/mcp-sdk`)
- Node.js 20+ or Deno 1.40+ (runtime)
- OS-level credential storage (Keychain, Credential Manager, Secret Service)

### Feature Dependencies

**Required by features:**
- `09-integrations/claude-code/setup.md` - Claude Code configuration guide
- `09-integrations/cursor/setup.md` - Cursor IDE configuration guide
- `08-features/approval-workflows.md` - User approval flow for MCP requests

---

## References

### Internal Documentation
- `TECH-STACK.md` - Technology stack specification
- `01-product/product-vision-strategy.md` - Why MCP is a key differentiator
- `02-architecture/system-overview.md` - MCP server architecture
- `GLOSSARY.md` - Term definitions (MCP, Zero-Knowledge, JWT, etc.)

### External Resources
- [Model Context Protocol Documentation](https://modelcontextprotocol.io) - Official MCP spec
- [MCP SDK (Anthropic)](https://github.com/anthropics/mcp-sdk) - TypeScript SDK for building MCP servers
- [Claude Code Documentation](https://claude.ai/code) - How to configure MCP servers in Claude Code
- [Cursor MCP Support](https://cursor.sh/docs/mcp) - Cursor's MCP integration guide

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Integration Team | Initial MCP integration documentation |

---

## Notes

### Why MCP is a Key Differentiator

MCP integration positions Abyrith as the **first secrets manager built for AI-native development**. While traditional password managers (1Password, LastPass) and enterprise secrets managers (Vault, AWS Secrets Manager) require manual copy-paste workflows, Abyrith lets AI tools request secrets directly with user approval.

**Competitive Advantage:**
1. **Zero Friction for AI Tools:** Claude Code/Cursor users get secrets instantly after one-time approval
2. **Maintains Security:** User approves every secret access; zero-knowledge architecture preserved
3. **Complete Auditability:** Every AI tool request logged with context
4. **Future-Proof:** As more AI tools support MCP, Abyrith automatically works with them

**User Experience Win:**
- **Before MCP:** "Claude Code needs OPENAI_API_KEY" → User opens Abyrith → Copies key → Pastes in terminal → Claude continues
- **With MCP:** "Claude Code needs OPENAI_API_KEY" → User clicks "Approve" in notification → Claude continues (no copy-paste)

### Future Enhancements
- Support for MCP Servers exposing multiple projects simultaneously
- Project-specific approval policies (auto-approve for dev, require approval for prod)
- Temporary approval grants (approve for next 10 requests only)
- Integration with additional AI tools as MCP adoption grows
