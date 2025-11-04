---
Document: GitHub API - Integration Guide
Version: 1.0.0
Last Updated: 2025-11-04
Owner: Integration Engineer
Status: Draft
Dependencies: 03-security/security-model.md, 05-api/endpoints/secrets-endpoints.md, 04-database/schemas/secrets-metadata.md, TECH-STACK.md
---

# GitHub API Integration

## Overview

This document provides comprehensive guidance for integrating with the GitHub API to enable repository linking, secret import from .env files, dependency detection, and bidirectional synchronization between Abyrith and GitHub repositories.

**External Service:** GitHub (github.com)

**Integration Type:** OAuth 2.0 + REST API (GitHub App architecture)

**Status:** Planned for post-MVP implementation

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
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
- One-click secret import from existing GitHub repositories
- Automatic detection of required API keys based on dependencies (package.json, requirements.txt, etc.)
- Repository linking for project-to-codebase association
- Future: Bidirectional sync (update .env files from Abyrith)
- Future: GitHub Actions integration (inject secrets at runtime)

**User benefits:**
- **For Learners:** Discover which API keys they need based on tutorial code
- **For Solo Developers:** Quickly import existing secrets from multiple projects
- **For Development Teams:** Centralize secret management across repositories
- **For Enterprise:** Audit trail of which repos access which secrets

### Technical Purpose

**Responsibilities:**
- OAuth 2.0 authentication flow for repository access
- Fetch .env files from repositories (all variants: .env, .env.example, .env.production, etc.)
- Parse .env files and extract key names (not values)
- Detect dependencies (npm, pip, bundler, composer, etc.)
- Suggest required API keys based on detected dependencies
- Write .abyrith marker file to repository for tracking
- Store repository variables (ABYRITH_ORG_ID) for future integration

**Integration Points:**
- Secret import wizard (frontend)
- Project creation flow (suggest repo linking)
- Dependency analysis service (backend)
- Audit logging (track repo access events)

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────┐
│                 Abyrith Frontend (Next.js)               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  "Connect GitHub Repository" Button                │  │
│  │  → Initiates OAuth flow                            │  │
│  └─────────────────┬──────────────────────────────────┘  │
└────────────────────┼─────────────────────────────────────┘
                     │
                     │ 1. Redirect to GitHub OAuth
                     ▼
┌──────────────────────────────────────────────────────────┐
│              GitHub OAuth Authorization                  │
│  User grants permission to access repositories           │
└─────────────────┬────────────────────────────────────────┘
                  │
                  │ 2. Callback with authorization code
                  ▼
┌──────────────────────────────────────────────────────────┐
│           Cloudflare Workers (API Gateway)               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  /api/v1/github/callback                           │  │
│  │  - Exchange code for access token                  │  │
│  │  - Encrypt token client-side                       │  │
│  │  - Store encrypted token in Supabase               │  │
│  └─────────────────┬──────────────────────────────────┘  │
└────────────────────┼─────────────────────────────────────┘
                     │
                     │ 3. Fetch repo data using token
                     ▼
┌──────────────────────────────────────────────────────────┐
│              GitHub REST API                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  GET /repos/:owner/:repo/contents/.env             │  │
│  │  GET /repos/:owner/:repo/contents/package.json     │  │
│  │  GET /actions/secrets (list only, no values)       │  │
│  │  PUT /repos/:owner/:repo/contents/.abyrith         │  │
│  │  POST /actions/variables (ABYRITH_ORG_ID)          │  │
│  └─────────────────┬──────────────────────────────────┘  │
└────────────────────┼─────────────────────────────────────┘
                     │
                     │ 4. Store encrypted token + metadata
                     ▼
┌──────────────────────────────────────────────────────────┐
│            Supabase PostgreSQL Database                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  github_connections table:                         │  │
│  │  - user_id                                         │  │
│  │  - project_id                                      │  │
│  │  - repo_full_name (owner/repo)                     │  │
│  │  - encrypted_token (encrypted with master key)     │  │
│  │  - encrypted_dek (envelope encryption)             │  │
│  │  - token_nonce, dek_nonce                          │  │
│  │  - scopes (permissions granted)                    │  │
│  │  - last_sync_at                                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

**Outbound (Abyrith → GitHub):**
1. User initiates OAuth flow from Abyrith UI
2. Redirect to GitHub authorization endpoint
3. User grants permissions to Abyrith GitHub App
4. GitHub redirects back to Abyrith with authorization code
5. Exchange code for access token (server-side)
6. Encrypt token client-side before storing
7. Use token to fetch repository data

**Inbound (GitHub → Abyrith):**
1. Fetch .env files from repository
2. Parse .env files to extract key names
3. Fetch dependency files (package.json, requirements.txt)
4. Analyze dependencies to suggest required keys
5. Present suggestions to user
6. User selects which keys to import/create

### Components Involved

**Frontend:**
- `components/GitHubConnectButton.tsx` - OAuth initiation button
- `components/GitHubRepoSelector.tsx` - Repository selection UI
- `components/DependencyAnalysisResults.tsx` - Display detected dependencies
- `pages/projects/[id]/import-from-github.tsx` - Import wizard

**Backend:**
- `workers/github-oauth.ts` - OAuth flow handler
- `workers/github-fetch.ts` - Fetch repo data
- `lib/github/parser.ts` - Parse .env and dependency files
- `lib/github/analyzer.ts` - Analyze dependencies and suggest keys

**External:**
- GitHub OAuth endpoints
- GitHub REST API v3

---

## Authentication

### Authentication Method

**Type:** OAuth 2.0 (GitHub App installation)

**How it works:**

**GitHub App vs OAuth App:**

We use **GitHub App** architecture instead of OAuth App because:
- Fine-grained repository permissions
- Better security model (installation tokens)
- Works for both personal and organization repos
- More scalable (higher rate limits)
- Can request specific permissions per installation

**OAuth Flow:**

1. User clicks "Connect GitHub Repository"
2. Redirect to GitHub OAuth authorization URL:
   ```
   https://github.com/login/oauth/authorize?
     client_id=YOUR_GITHUB_APP_CLIENT_ID&
     redirect_uri=https://app.abyrith.com/api/v1/github/callback&
     scope=repo read:org&
     state=CSRF_TOKEN
   ```
3. User grants permissions
4. GitHub redirects back with authorization code
5. Exchange code for access token (server-side)
6. Send token to client for encryption (zero-knowledge)
7. Store encrypted token in database

### Credentials Management

**Where credentials are stored:**
- **Development:** `.dev.vars` file (Cloudflare Workers local secrets)
- **Staging:** Cloudflare Workers secrets (wrangler secret put)
- **Production:** Cloudflare Workers secrets (wrangler secret put)

**Credential Format:**
```bash
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=secret_value_here
GITHUB_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
```

**User tokens (OAuth access tokens):**
- Encrypted client-side using user's master key
- Stored in `github_connections` table
- Envelope encryption pattern (DEK encrypted with master key)
- Server cannot decrypt tokens (zero-knowledge)

### Obtaining Credentials

**Step 1: Create GitHub App**

1. Go to GitHub Settings → Developer Settings → GitHub Apps
2. Click "New GitHub App"
3. Fill in required information:
   - **App Name:** "Abyrith Secrets Manager"
   - **Homepage URL:** https://abyrith.com
   - **Callback URL:** https://app.abyrith.com/api/v1/github/callback
   - **Webhook:** Disable (for MVP; enable in future)
   - **Permissions:**
     - Repository permissions:
       - Contents: Read (read .env files, write .abyrith marker)
       - Administration: Read & Write (read repo variables, write ABYRITH_ORG_ID)
       - Actions: Read (optional, read GitHub Actions secrets list)
     - Organization permissions: None (for MVP)
   - **Where can this GitHub App be installed?** Any account
4. Generate private key (download .pem file)
5. Note App ID and Client ID

**Step 2: Store credentials in Cloudflare Workers**

```bash
# Development (.dev.vars file)
echo "GITHUB_APP_ID=123456" >> .dev.vars
echo "GITHUB_CLIENT_ID=Iv1.abc123def456" >> .dev.vars
echo "GITHUB_CLIENT_SECRET=your_secret_here" >> .dev.vars
echo "GITHUB_PRIVATE_KEY='-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'" >> .dev.vars

# Production (Cloudflare Workers secrets)
echo "your_secret_here" | wrangler secret put GITHUB_CLIENT_SECRET
echo "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----" | wrangler secret put GITHUB_PRIVATE_KEY
```

**Step 3: Configure callback URL in Supabase**

Update Supabase Auth configuration to allow GitHub OAuth redirect:
```
Supabase Dashboard → Authentication → URL Configuration
→ Redirect URLs → Add: https://app.abyrith.com/api/v1/github/callback
```

---

## Configuration

### Environment Variables

**Required:**
```bash
GITHUB_APP_ID=123456                     # GitHub App ID
GITHUB_CLIENT_ID=Iv1.abc123def456        # GitHub App Client ID
GITHUB_CLIENT_SECRET=secret_value        # GitHub App Client Secret (encrypted at rest)
GITHUB_PRIVATE_KEY=-----BEGIN RSA...     # GitHub App Private Key (for generating installation tokens)
```

**Optional:**
```bash
GITHUB_API_TIMEOUT=30000                 # API request timeout (default: 30s)
GITHUB_RETRY_ATTEMPTS=3                  # Number of retry attempts (default: 3)
GITHUB_WEBHOOK_SECRET=webhook_secret     # For future webhook verification
```

### Configuration File

**Location:** `workers/github-oauth.ts`

**Structure:**
```typescript
interface GitHubConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  apiTimeout?: number;
  retryAttempts?: number;
}
```

**Example:**
```typescript
const config: GitHubConfig = {
  appId: process.env.GITHUB_APP_ID!,
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  apiTimeout: 30000,
  retryAttempts: 3
};
```

---

## API Reference

### Client Setup

**Installation:**
```bash
pnpm add @octokit/rest @octokit/auth-app
```

**Initialization:**
```typescript
import { Octokit } from '@octokit/rest';

// Using OAuth access token (user-authenticated)
const octokit = new Octokit({
  auth: userAccessToken, // Decrypted client-side
  userAgent: 'Abyrith Secrets Manager v1.0'
});
```

### Available Methods

#### Method 1: `generateOAuthUrl`

**Purpose:** Generate GitHub OAuth authorization URL for user to grant permissions

**Signature:**
```typescript
function generateOAuthUrl(state: string): string
```

**Parameters:**
- `state` - CSRF protection token (random UUID)

**Returns:**
```typescript
string; // Full OAuth authorization URL
```

**Example Usage:**
```typescript
const state = crypto.randomUUID();
const authUrl = generateOAuthUrl(state);

// Store state in session for verification
sessionStorage.setItem('github_oauth_state', state);

// Redirect user
window.location.href = authUrl;

// Output: https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&scope=repo&state=...
```

**Error Cases:**
- Missing `GITHUB_CLIENT_ID` - Throws configuration error

---

#### Method 2: `handleOAuthCallback`

**Purpose:** Exchange authorization code for access token

**Signature:**
```typescript
async function handleOAuthCallback(
  code: string,
  state: string
): Promise<GitHubOAuthResponse>
```

**Parameters:**
- `code` - Authorization code from GitHub redirect
- `state` - CSRF token to verify (must match stored state)

**Returns:**
```typescript
interface GitHubOAuthResponse {
  access_token: string;  // Send to client for encryption
  scope: string;         // Permissions granted
  token_type: 'bearer';
  github_user: {
    id: number;
    login: string;
    name: string;
    email: string;
    avatar_url: string;
  };
}
```

**Example Usage:**
```typescript
// Worker: Handle callback
const { code, state } = await request.query;

// Verify state
const storedState = await getStoredState(userId);
if (state !== storedState) {
  return new Response('Invalid state', { status: 400 });
}

// Exchange code for token
const response = await handleOAuthCallback(code, state);

// IMPORTANT: Send token to client for encryption
// Server should NOT store plaintext token
return new Response(JSON.stringify({
  access_token: response.access_token,  // Client will encrypt
  scope: response.scope,
  github_user: response.github_user
}), {
  headers: { 'Content-Type': 'application/json' }
});
```

**Error Cases:**
- Invalid code - Returns 401 Unauthorized
- State mismatch - Returns 400 Bad Request (CSRF protection)
- Rate limit exceeded - Returns 429 Too Many Requests

---

#### Method 3: `fetchRepositoryFiles`

**Purpose:** Fetch .env files and dependency files from repository

**Signature:**
```typescript
async function fetchRepositoryFiles(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<RepositoryFiles>
```

**Parameters:**
- `octokit` - Authenticated Octokit instance
- `owner` - Repository owner (username or organization)
- `repo` - Repository name

**Returns:**
```typescript
interface RepositoryFiles {
  envFiles: Array<{
    name: string;      // '.env', '.env.production', etc.
    content: string;   // File contents
  }>;
  dependencyFiles: Array<{
    name: string;      // 'package.json', 'requirements.txt', etc.
    content: string;   // File contents
  }>;
}
```

**Example Usage:**
```typescript
const files = await fetchRepositoryFiles(octokit, 'username', 'my-repo');

// Parse .env files
const secrets = files.envFiles.flatMap(file => parseEnvFile(file.content));

// Detect dependencies
const dependencies = files.dependencyFiles.map(file =>
  detectDependencies(file.name, file.content)
);

console.log('Found secrets:', secrets);
console.log('Detected dependencies:', dependencies);
```

**Error Cases:**
- Repository not found - Returns 404 Not Found
- Permission denied - Returns 403 Forbidden
- Rate limit exceeded - Returns 429 Too Many Requests

---

#### Method 4: `parseEnvFile`

**Purpose:** Parse .env file and extract key names (not values)

**Signature:**
```typescript
function parseEnvFile(content: string): Array<EnvVariable>
```

**Parameters:**
- `content` - Raw .env file contents

**Returns:**
```typescript
interface EnvVariable {
  key: string;        // Variable name (e.g., 'OPENAI_API_KEY')
  value: string;      // Variable value (may be empty in .env.example)
  comment?: string;   // Inline comment if present
}
```

**Example Usage:**
```typescript
const envContent = `
# OpenAI Configuration
OPENAI_API_KEY=sk-test-abc123
OPENAI_ORG_ID=org-xyz789  # Optional organization ID

# Database
DATABASE_URL=postgresql://...
`;

const variables = parseEnvFile(envContent);

// Output:
// [
//   { key: 'OPENAI_API_KEY', value: 'sk-test-abc123', comment: undefined },
//   { key: 'OPENAI_ORG_ID', value: 'org-xyz789', comment: 'Optional organization ID' },
//   { key: 'DATABASE_URL', value: 'postgresql://...', comment: undefined }
// ]
```

**Error Cases:**
- Invalid .env format - Logs warning, continues parsing

---

#### Method 5: `detectDependencies`

**Purpose:** Analyze dependency files and suggest required API keys

**Signature:**
```typescript
function detectDependencies(
  fileName: string,
  content: string
): Array<APISuggestion>
```

**Parameters:**
- `fileName` - Name of dependency file ('package.json', 'requirements.txt', etc.)
- `content` - File contents

**Returns:**
```typescript
interface APISuggestion {
  service: string;           // 'OpenAI', 'Stripe', 'Twilio', etc.
  suggestedKeys: string[];   // ['OPENAI_API_KEY', 'OPENAI_ORG_ID']
  detectedFrom: string;      // 'openai' (package name)
  confidence: number;        // 0.0 - 1.0 (how sure we are)
}
```

**Example Usage:**
```typescript
const packageJson = `{
  "dependencies": {
    "openai": "^4.0.0",
    "@stripe/stripe-js": "^2.0.0",
    "twilio": "^4.0.0"
  }
}`;

const suggestions = detectDependencies('package.json', packageJson);

// Output:
// [
//   {
//     service: 'OpenAI',
//     suggestedKeys: ['OPENAI_API_KEY', 'OPENAI_ORG_ID'],
//     detectedFrom: 'openai',
//     confidence: 0.95
//   },
//   {
//     service: 'Stripe',
//     suggestedKeys: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY'],
//     detectedFrom: '@stripe/stripe-js',
//     confidence: 0.9
//   },
//   {
//     service: 'Twilio',
//     suggestedKeys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
//     detectedFrom: 'twilio',
//     confidence: 0.95
//   }
// ]
```

**Error Cases:**
- Unsupported file type - Returns empty array
- Invalid JSON/YAML - Returns empty array with warning

---

#### Method 6: `writeAbyrithMarker`

**Purpose:** Write .abyrith marker file to repository for tracking

**Signature:**
```typescript
async function writeAbyrithMarker(
  octokit: Octokit,
  owner: string,
  repo: string,
  projectId: string
): Promise<void>
```

**Parameters:**
- `octokit` - Authenticated Octokit instance
- `owner` - Repository owner
- `repo` - Repository name
- `projectId` - Abyrith project UUID

**Returns:** `Promise<void>`

**Example Usage:**
```typescript
await writeAbyrithMarker(octokit, 'username', 'my-repo', 'project-uuid-123');

// Creates file at: .abyrith
// Content:
// # Abyrith Secrets Manager
// # This repository is linked to an Abyrith project
// version: 1
// project_id: project-uuid-123
// linked_at: 2025-11-04T12:00:00Z
```

**Error Cases:**
- Permission denied - Throws 403 Forbidden (requires write access)
- Repository archived - Throws 403 Forbidden

---

#### Method 7: `storeRepoVariable`

**Purpose:** Store organization ID as GitHub repository variable

**Signature:**
```typescript
async function storeRepoVariable(
  octokit: Octokit,
  owner: string,
  repo: string,
  organizationId: string
): Promise<void>
```

**Parameters:**
- `octokit` - Authenticated Octokit instance
- `owner` - Repository owner
- `repo` - Repository name
- `organizationId` - Abyrith organization UUID

**Returns:** `Promise<void>`

**Example Usage:**
```typescript
await storeRepoVariable(octokit, 'username', 'my-repo', 'org-uuid-456');

// Creates GitHub Actions variable: ABYRITH_ORG_ID=org-uuid-456
// This enables future GitHub Actions integration
```

**Error Cases:**
- Permission denied - Throws 403 Forbidden (requires admin access)
- Organization doesn't exist - Throws 404 Not Found

---

## Implementation Details

### Integration Code

**File:** `workers/github-oauth.ts`

**Implementation:**
```typescript
import { Octokit } from '@octokit/rest';

interface GitHubConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  apiTimeout: number;
  retryAttempts: number;
}

export class GitHubIntegrationService {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  // Generate OAuth URL
  generateOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: 'https://app.abyrith.com/api/v1/github/callback',
      scope: 'repo read:org',
      state: state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  // Handle OAuth callback
  async handleOAuthCallback(code: string, state: string): Promise<GitHubOAuthResponse> {
    try {
      // Exchange code for token
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
        }),
      });

      if (!response.ok) {
        throw new Error(`GitHub OAuth failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Fetch user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const userData = await userResponse.json();

      // IMPORTANT: Return token to client for encryption
      return {
        access_token: data.access_token,  // Client will encrypt
        scope: data.scope,
        token_type: data.token_type,
        github_user: {
          id: userData.id,
          login: userData.login,
          name: userData.name,
          email: userData.email,
          avatar_url: userData.avatar_url
        }
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Fetch repository files
  async fetchRepositoryFiles(
    accessToken: string,
    owner: string,
    repo: string
  ): Promise<RepositoryFiles> {
    const octokit = new Octokit({
      auth: accessToken,
      userAgent: 'Abyrith Secrets Manager v1.0'
    });

    const envFiles = await this.fetchEnvFiles(octokit, owner, repo);
    const dependencyFiles = await this.fetchDependencyFiles(octokit, owner, repo);

    return { envFiles, dependencyFiles };
  }

  // Fetch .env files
  private async fetchEnvFiles(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<Array<{ name: string; content: string }>> {
    const envFileNames = ['.env', '.env.example', '.env.production', '.env.staging', '.env.local'];
    const results = [];

    for (const fileName of envFileNames) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: fileName,
        });

        if ('content' in data && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          results.push({ name: fileName, content });
        }
      } catch (error: any) {
        if (error.status !== 404) throw error;
        // File doesn't exist, skip
      }
    }

    return results;
  }

  // Fetch dependency files
  private async fetchDependencyFiles(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<Array<{ name: string; content: string }>> {
    const depFileNames = [
      'package.json',
      'requirements.txt',
      'Gemfile',
      'go.mod',
      'composer.json',
      'pom.xml'
    ];
    const results = [];

    for (const fileName of depFileNames) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: fileName,
        });

        if ('content' in data && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          results.push({ name: fileName, content });
        }
      } catch (error: any) {
        if (error.status !== 404) throw error;
        // File doesn't exist, skip
      }
    }

    return results;
  }

  // Parse .env file
  parseEnvFile(content: string): Array<EnvVariable> {
    const variables: Array<EnvVariable> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Match: KEY=value or KEY=value # comment
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const [, key, rest] = match;

        // Extract value and comment
        const commentMatch = rest.match(/^(.*?)\s*#\s*(.*)$/);
        const value = commentMatch ? commentMatch[1].trim() : rest.trim();
        const comment = commentMatch ? commentMatch[2].trim() : undefined;

        // Remove quotes
        const cleanValue = value.replace(/^["']|["']$/g, '');

        variables.push({ key, value: cleanValue, comment });
      }
    }

    return variables;
  }

  // Detect dependencies
  detectDependencies(fileName: string, content: string): Array<APISuggestion> {
    if (fileName === 'package.json') {
      return this.detectNpmDependencies(content);
    } else if (fileName === 'requirements.txt') {
      return this.detectPythonDependencies(content);
    }
    // Add more detectors as needed
    return [];
  }

  // Detect npm dependencies
  private detectNpmDependencies(content: string): Array<APISuggestion> {
    try {
      const pkg = JSON.parse(content);
      const deps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {})
      ];

      // Map common packages to required API keys
      const apiKeyMap: Record<string, { service: string; keys: string[] }> = {
        'openai': { service: 'OpenAI', keys: ['OPENAI_API_KEY', 'OPENAI_ORG_ID'] },
        '@anthropic-ai/sdk': { service: 'Anthropic (Claude)', keys: ['ANTHROPIC_API_KEY'] },
        'stripe': { service: 'Stripe', keys: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'] },
        '@stripe/stripe-js': { service: 'Stripe', keys: ['STRIPE_PUBLISHABLE_KEY'] },
        'sendgrid': { service: 'SendGrid', keys: ['SENDGRID_API_KEY'] },
        'twilio': { service: 'Twilio', keys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'] },
        '@aws-sdk/client-s3': { service: 'AWS', keys: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] },
        'firebase-admin': { service: 'Firebase', keys: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'] },
      };

      const suggestions: Array<APISuggestion> = [];

      for (const dep of deps) {
        if (apiKeyMap[dep]) {
          suggestions.push({
            service: apiKeyMap[dep].service,
            suggestedKeys: apiKeyMap[dep].keys,
            detectedFrom: dep,
            confidence: 0.9
          });
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Failed to parse package.json:', error);
      return [];
    }
  }

  // Write .abyrith marker file
  async writeAbyrithMarker(
    accessToken: string,
    owner: string,
    repo: string,
    projectId: string
  ): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });

    const content = `# Abyrith Secrets Manager
# This repository is linked to an Abyrith project
version: 1
project_id: ${projectId}
linked_at: ${new Date().toISOString()}
`;

    const contentBase64 = Buffer.from(content).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: '.abyrith',
      message: 'Link to Abyrith Secrets Manager',
      content: contentBase64,
    });
  }

  // Store repo variable
  async storeRepoVariable(
    accessToken: string,
    owner: string,
    repo: string,
    organizationId: string
  ): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });

    await octokit.actions.createRepoVariable({
      owner,
      repo,
      name: 'ABYRITH_ORG_ID',
      value: organizationId,
    });
  }

  // Error handling
  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('GitHub token expired. Please reconnect your account.');
    }
    if (error.status === 403) {
      if (error.response?.headers['x-ratelimit-remaining'] === '0') {
        const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
        const waitMinutes = Math.ceil((resetTime - Date.now()) / 1000 / 60);
        return new Error(`GitHub rate limit exceeded. Reset in ${waitMinutes} minutes.`);
      }
      return new Error('Permission denied. Please check repository access.');
    }
    if (error.status === 404) {
      return new Error('Repository or file not found.');
    }
    return new Error(`GitHub API error: ${error.message}`);
  }
}
```

### Data Transformation

**External Format → Internal Format:**
```typescript
// GitHub OAuth response
interface GitHubOAuthTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

// Internal format (after encryption)
interface StoredGitHubConnection {
  user_id: string;
  project_id: string;
  repo_full_name: string;          // 'owner/repo'
  encrypted_token: string;          // Base64 encrypted token
  encrypted_dek: string;            // Base64 encrypted DEK
  token_nonce: string;              // Base64 nonce
  dek_nonce: string;                // Base64 DEK nonce
  scopes: string[];                 // ['repo', 'read:org']
  github_user_id: number;
  github_username: string;
  last_sync_at: string | null;     // ISO timestamp
  created_at: string;               // ISO timestamp
}

// Transform function
function transformToStoredConnection(
  userId: string,
  projectId: string,
  repoFullName: string,
  encryptedData: EncryptedToken,
  oauthResponse: GitHubOAuthTokenResponse,
  githubUser: GitHubUser
): StoredGitHubConnection {
  return {
    user_id: userId,
    project_id: projectId,
    repo_full_name: repoFullName,
    encrypted_token: encryptedData.encrypted_token,
    encrypted_dek: encryptedData.encrypted_dek,
    token_nonce: encryptedData.token_nonce,
    dek_nonce: encryptedData.dek_nonce,
    scopes: oauthResponse.scope.split(' '),
    github_user_id: githubUser.id,
    github_username: githubUser.login,
    last_sync_at: null,
    created_at: new Date().toISOString()
  };
}
```

---

## Error Handling

### Error Types

**Error 1: Token Expired (401 Unauthorized)**
- **When:** GitHub access token has expired (typically after 1 year)
- **External Code:** `401`
- **Internal Code:** `GITHUB_TOKEN_EXPIRED`
- **Recovery:** Prompt user to reconnect GitHub account (re-do OAuth flow)

**Error 2: Rate Limit Exceeded (403 Forbidden)**
- **When:** Too many API requests in short period
- **External Code:** `403` with `X-RateLimit-Remaining: 0`
- **Internal Code:** `GITHUB_RATE_LIMIT`
- **Recovery:** Wait until rate limit reset (check `X-RateLimit-Reset` header), retry automatically

**Error 3: Permission Denied (403 Forbidden)**
- **When:** User hasn't granted sufficient permissions or repository access
- **External Code:** `403`
- **Internal Code:** `GITHUB_PERMISSION_DENIED`
- **Recovery:** Prompt user to reconnect with correct permissions

**Error 4: Repository Not Found (404 Not Found)**
- **When:** Repository doesn't exist or user doesn't have access
- **External Code:** `404`
- **Internal Code:** `GITHUB_REPO_NOT_FOUND`
- **Recovery:** Verify repository name, check user has access

### Retry Strategy

**Retry Policy:**
- Attempts: 3
- Backoff: Exponential (2s, 4s, 8s)
- Max wait: 8 seconds

**Retriable Errors:**
- `500 Internal Server Error` - GitHub temporary issue
- `502 Bad Gateway` - GitHub server issue
- `503 Service Unavailable` - GitHub maintenance
- `429 Too Many Requests` - Rate limit (with backoff)

**Non-Retriable Errors:**
- `401 Unauthorized` - Token expired, requires re-auth
- `403 Forbidden` - Permission issue, requires user action
- `404 Not Found` - Resource doesn't exist

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
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        throw error;
      }

      // Exponential backoff
      if (i < attempts - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

---

## Testing

### Unit Tests

**Test File:** `workers/github-oauth.test.ts`

**Mock Setup:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { GitHubIntegrationService } from './github-oauth';

describe('GitHubIntegrationService', () => {
  const mockConfig = {
    appId: '123456',
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    privateKey: 'test_key',
    apiTimeout: 30000,
    retryAttempts: 3
  };

  it('should generate OAuth URL with correct parameters', () => {
    const service = new GitHubIntegrationService(mockConfig);
    const state = 'test_state_123';
    const url = service.generateOAuthUrl(state);

    expect(url).toContain('client_id=test_client_id');
    expect(url).toContain('state=test_state_123');
    expect(url).toContain('scope=repo%20read%3Aorg');
  });

  it('should parse .env file correctly', () => {
    const service = new GitHubIntegrationService(mockConfig);
    const envContent = `
OPENAI_API_KEY=sk-test-abc123
DATABASE_URL=postgresql://localhost
# Comment line
STRIPE_KEY=pk_test_xyz789  # Inline comment
`;

    const variables = service.parseEnvFile(envContent);

    expect(variables).toHaveLength(3);
    expect(variables[0]).toEqual({
      key: 'OPENAI_API_KEY',
      value: 'sk-test-abc123',
      comment: undefined
    });
    expect(variables[2].comment).toBe('Inline comment');
  });

  it('should detect npm dependencies correctly', () => {
    const service = new GitHubIntegrationService(mockConfig);
    const packageJson = `{
      "dependencies": {
        "openai": "^4.0.0",
        "stripe": "^13.0.0"
      }
    }`;

    const suggestions = service.detectDependencies('package.json', packageJson);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].service).toBe('OpenAI');
    expect(suggestions[0].suggestedKeys).toContain('OPENAI_API_KEY');
    expect(suggestions[1].service).toBe('Stripe');
  });
});
```

### Integration Tests

**Test Scenario 1: Complete OAuth Flow**
```typescript
describe('GitHub OAuth Integration', () => {
  it('should complete full OAuth flow', async () => {
    // 1. Generate OAuth URL
    const state = crypto.randomUUID();
    const authUrl = service.generateOAuthUrl(state);
    expect(authUrl).toContain('github.com/login/oauth/authorize');

    // 2. Mock GitHub callback with code
    const mockCode = 'test_authorization_code';
    const response = await service.handleOAuthCallback(mockCode, state);

    expect(response.access_token).toBeDefined();
    expect(response.github_user).toBeDefined();

    // 3. Use token to fetch repository data
    const files = await service.fetchRepositoryFiles(
      response.access_token,
      'test-owner',
      'test-repo'
    );

    expect(files.envFiles.length).toBeGreaterThan(0);
  });
});
```

### Manual Testing

**Test in development:**
```bash
# 1. Start local Workers dev server
wrangler dev

# 2. Open browser to OAuth flow
open "http://localhost:8787/api/v1/github/connect"

# 3. Complete OAuth flow on GitHub
# (GitHub will redirect back to localhost callback)

# 4. Verify token stored encrypted in database
psql -h localhost -U postgres -d abyrith
SELECT encrypted_token, scopes FROM github_connections WHERE user_id = 'test-user-id';
```

**Verify:**
- [ ] OAuth URL redirects to GitHub correctly
- [ ] User can grant permissions
- [ ] Callback handler receives authorization code
- [ ] Access token is returned (not stored server-side)
- [ ] Token can be encrypted client-side
- [ ] Encrypted token stored in database
- [ ] Can fetch repository files using decrypted token

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- GitHub API requests per minute
- OAuth flow completion rate
- Token refresh success rate
- Repository file fetch latency
- Rate limit usage (percentage of limit)

**Business Metrics:**
- Number of connected repositories per user
- Most commonly imported secrets
- Average secrets imported per repository
- Dependency detection accuracy (user feedback)

### Logging

**Log Level:** INFO | WARN | ERROR

**Logged Events:**
- OAuth flow initiated
- OAuth flow completed successfully
- OAuth flow failed (with reason)
- Repository file fetch started
- Repository file fetch succeeded
- Repository file fetch failed
- Rate limit warning (>80% of limit used)
- Token expiration detected

**Log Format:**
```typescript
{
  event: 'github_oauth_completed',
  service: 'github-integration',
  user_id: 'user-uuid',
  repo: 'owner/repo',
  scopes: ['repo', 'read:org'],
  duration_ms: 1234,
  status: 'success'
}
```

### Alerts

**Alert 1: High OAuth Failure Rate**
- **Condition:** OAuth failure rate > 10% over 15 minutes
- **Severity:** P2
- **Action:** Check GitHub OAuth app configuration, verify callback URL

**Alert 2: GitHub Rate Limit Warning**
- **Condition:** Rate limit usage > 80% of limit
- **Severity:** P3
- **Action:** Review API usage patterns, consider caching strategies

**Alert 3: Token Expiration Spike**
- **Condition:** Token expiration errors > 20 per hour
- **Severity:** P2
- **Action:** Check token refresh logic, verify OAuth scopes

---

## Security Considerations

### Data Privacy

**Data sent to GitHub:**
- OAuth authorization code (temporary, one-time use)
- Access token in API requests (encrypted in transit via HTTPS)
- Repository owner/name (required for API calls)

**Data received from GitHub:**
- Access token (sent to client for encryption, never stored plaintext on server)
- Repository file contents (.env files, dependency files)
- User profile information (ID, username, email, avatar)

**PII Handling:**
- User email: Stored in database for account linking
- Access tokens: Encrypted client-side with user's master key (zero-knowledge)
- Repository names: Stored plaintext for display purposes

### Credential Security

**How credentials are protected:**
- **Storage:** Access tokens encrypted with AES-256-GCM before storage
- **Access control:** User can only decrypt their own tokens (master key required)
- **Rotation policy:** Tokens valid for 1 year, user prompted to reconnect before expiration

### Compliance

**GDPR:**
- User can disconnect GitHub at any time (token deleted)
- User can export all linked repository data
- User can delete account (all GitHub connections deleted)
- Clear consent requested during OAuth flow

**SOC 2:**
- Audit log tracks all GitHub API access
- Access tokens encrypted at rest (zero-knowledge)
- Rate limiting prevents abuse
- Token expiration tracked and monitored

---

## Cost & Rate Limits

### Pricing Model

**GitHub API is free for authenticated requests with these limits:**

**Pricing structure:**
- Free for OAuth users: 5,000 requests/hour per user
- Free for GitHub Apps: 5,000 requests/hour per installation
- No cost per request

**Estimated monthly cost:**
- $0 (GitHub API is free)

### Rate Limits

**Limits:**
- **Authenticated requests:** 5,000 requests/hour per user
- **OAuth App:** 5,000 requests/hour
- **GitHub App:** 5,000 requests/hour per installation (higher limit)

**Our usage estimates:**
- OAuth flow: 2 requests (token exchange + user fetch)
- Repository import: 10-20 requests (fetch files + analyze)
- Average: 25 requests per repository connection
- Limit allows: 200 repository connections per hour

**How we handle limits:**
- Cache repository file contents (5 minutes)
- Batch file fetches where possible
- Exponential backoff on rate limit errors
- User notification if approaching limit

**Monitoring usage:**
- Track `X-RateLimit-Remaining` header
- Alert if remaining < 1000 requests
- Log rate limit resets
- Dashboard showing current rate limit usage

---

## Troubleshooting

### Issue 1: OAuth Callback Fails with "Invalid state"

**Symptoms:**
```
Error: OAuth callback failed - Invalid state parameter
```

**Cause:** CSRF token mismatch between authorization request and callback

**Solution:**
```typescript
// 1. Check state is stored correctly
const state = crypto.randomUUID();
sessionStorage.setItem('github_oauth_state', state);

// 2. Verify state in callback
const storedState = sessionStorage.getItem('github_oauth_state');
if (callbackState !== storedState) {
  throw new Error('CSRF token mismatch');
}

// 3. Clear state after use
sessionStorage.removeItem('github_oauth_state');
```

---

### Issue 2: "Repository not found" despite correct repo name

**Symptoms:**
```
Error: Repository or file not found (404)
```

**Cause:** User hasn't granted access to this specific repository, or repository is private

**Solution:**
```bash
# 1. Verify user has access to repository
# 2. Check OAuth scopes include 'repo' permission
# 3. If repository is in organization, ensure organization access granted

# 4. Re-initiate OAuth with correct scopes
const authUrl = generateOAuthUrl(state);
// Ensure 'repo' scope is included
```

---

### Issue 3: Rate limit exceeded unexpectedly

**Symptoms:**
```
Error: GitHub rate limit exceeded. Reset in 45 minutes.
```

**Cause:** Too many API requests in short period, possibly due to retry loops

**Solution:**
```typescript
// 1. Check rate limit status
const response = await fetch('https://api.github.com/rate_limit', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const rateLimit = await response.json();
console.log('Remaining:', rateLimit.resources.core.remaining);

// 2. Implement exponential backoff
// 3. Cache repository data more aggressively
// 4. Consider GitHub App instead of OAuth App (higher limits)
```

---

### Debug Mode

**Enable debug logging:**
```bash
GITHUB_DEBUG=true
```

**What gets logged:**
- All GitHub API requests (URL, method, headers)
- Rate limit headers on every response
- OAuth flow steps with timestamps
- Token encryption/decryption events (token value redacted)

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [ ] `03-security/security-model.md` - Zero-knowledge encryption specs
- [ ] `04-database/schemas/secrets-metadata.md` - Database schema for secrets
- [ ] `05-api/endpoints/secrets-endpoints.md` - API endpoints for secrets
- [ ] Supabase database with `github_connections` table

**External Dependencies:**
- GitHub OAuth App (registered at github.com/settings/apps)
- GitHub API access (free tier)
- Cloudflare Workers for OAuth callback handling

### Feature Dependencies

**Required by features:**
- `08-features/project-management/project-management-overview.md` - Project creation with GitHub linking
- Secret import wizard (frontend feature)
- Dependency analysis UI (show detected API key suggestions)

---

## References

### Internal Documentation
- `TECH-STACK.md` - Technology specifications
- `03-security/security-model.md` - Encryption implementation
- `GLOSSARY.md` - Term definitions

### External Resources
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps) - OAuth flow
- [GitHub REST API v3 Documentation](https://docs.github.com/en/rest) - API reference
- [Octokit.js Documentation](https://github.com/octokit/octokit.js) - JavaScript SDK
- [GitHub App Documentation](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps) - GitHub Apps

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-04 | Integration Engineer | Initial GitHub API integration documentation |

---

## Notes

### Future Improvements
- Bidirectional sync (.env file updates from Abyrith)
- GitHub Actions integration (inject secrets at runtime)
- Support for GitHub Codespaces secret injection
- Automatic pull request creation for .abyrith marker file
- Webhook notifications when repository .env files change

### Known Limitations
- Cannot read secret values from GitHub Actions secrets (API only returns names)
- .env parsing is basic (doesn't support all .env formats)
- Dependency detection limited to common packages (needs expansion)
- No support for monorepos (multiple package.json files) in MVP
