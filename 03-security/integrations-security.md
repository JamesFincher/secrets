---
Document: GitHub Integration Security - Architecture
Version: 1.0.0
Last Updated: 2025-11-04
Owner: Security Team / Engineering Lead
Status: Draft
Dependencies: 03-security/security-model.md, 04-database/schemas/github-connections.md, 06-backend/integrations/github-api-integration.md
---

# GitHub Integration Security Architecture

## Overview

This document defines the comprehensive security architecture for Abyrith's GitHub repository integration feature. The integration maintains Abyrith's zero-knowledge security model while enabling secure repository linking, automatic discovery of `.env` files, and bidirectional verification of repository ownership.

**Purpose:** Ensure the GitHub integration feature adheres to zero-knowledge principles, prevents unauthorized access, and maintains data isolation across organizations while enabling seamless repository-to-project linking.

**Scope:** GitHub OAuth security, token encryption, repository verification mechanisms, threat model, RLS enforcement, and audit logging for all GitHub-related operations.

**Status:** Draft - Security specifications for GitHub integration feature

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Security Boundaries](#security-boundaries)
7. [Threat Model](#threat-model)
8. [Security Controls](#security-controls)
9. [Cryptographic Specifications](#cryptographic-specifications)
10. [Performance Characteristics](#performance-characteristics)
11. [Failure Modes](#failure-modes)
12. [Compliance Considerations](#compliance-considerations)
13. [Alternatives Considered](#alternatives-considered)
14. [Decision Log](#decision-log)
15. [Dependencies](#dependencies)
16. [References](#references)
17. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Developers need to link GitHub repositories to Abyrith projects to enable automatic secret discovery, import `.env` files, and allow AI tools to access project-specific secrets. This requires storing GitHub access tokens and creating bidirectional verification between repositories and Abyrith projects.

**Pain points:**
- GitHub tokens are sensitive credentials that must be protected with the same rigor as user secrets
- Repository linking must prevent unauthorized access across organizations
- The `.abyrith` marker file must be anonymous enough to not leak organizational information
- Two-way verification (marker file + repo variable) must prevent tampering attacks
- OAuth flow must be secure against MITM and CSRF attacks
- Malicious `.env` files could be injected if sync is automatic

**Why now?**
The GitHub integration is a core MVP feature enabling:
- AI tools to discover secrets for active projects
- Automatic import of existing `.env` files
- Repository-aware secret management
- MCP integration for Claude Code and Cursor

### Background

**Existing system (if applicable):**
This is a new feature. No existing GitHub integration to replace.

**Previous attempts:**
Traditional approaches often store GitHub tokens in plaintext on the server or use server-side OAuth flows that expose tokens to backend systems. Abyrith requires client-side token encryption to maintain zero-knowledge architecture.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Solo Developers | Easy GitHub connection without complex setup | Don't want to learn OAuth details, "just connect" |
| Development Teams | Secure token sharing, team-wide repo linking | Need audit trail, token compromise handling |
| Enterprise Security | SOC 2 compliance, no token leakage | Need proof tokens encrypted, audit logs complete |
| AI Development Tools | Access to repo-specific secrets via MCP | Must not expose tokens to AI, only metadata |
| Repository Owners | Control over which repos linked | Don't want unauthorized Abyrith connections |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Zero-knowledge token storage** - GitHub tokens encrypted client-side, server cannot decrypt (Success metric: Pass security audit demonstrating server cannot access plaintext tokens)
2. **OAuth security** - Prevent CSRF, MITM, token interception during OAuth flow (Success metric: Zero OAuth vulnerabilities in penetration test)
3. **Two-way verification** - `.abyrith` marker file + GitHub repo variable ensure link integrity (Success metric: Tampering attempts detected and blocked 100% of the time)
4. **Organization isolation** - RLS policies prevent cross-org repo access (Success metric: No user can access repos from other organizations)
5. **Audit trail** - All GitHub operations logged for compliance (Success metric: 100% of GitHub actions captured in audit logs)

**Secondary goals:**
- Support multiple GitHub connections per user (personal + orgs)
- Allow repo unlinking without data loss
- Enable OAuth token refresh without user re-auth
- Provide clear user guidance for OAuth flow

### Non-Goals

**Explicitly out of scope:**
- **GitHub App installation** - Use OAuth user tokens, not GitHub Apps (Why: OAuth simpler for MVP, can add Apps later)
- **GitHub Enterprise Server** - Only support github.com initially (Why: Adds complexity, can add on-prem later)
- **Automatic secret sync** - No automatic `.env` import without user approval (Why: Security risk, user must explicitly trigger sync)
- **GitHub Actions integration** - No first-class GitHub Actions secrets sync (Why: Different security model, future enhancement)
- **Bi-directional sync** - Changes in Abyrith don't push back to `.env` files (Why: Git commits from Abyrith adds complexity)

### Success Metrics

**How we measure success:**
- **Security:** Zero GitHub token exposures; pass third-party OAuth security audit
- **Usability:** 95% of users successfully connect GitHub on first attempt
- **Performance:** OAuth callback to token storage < 2 seconds
- **Reliability:** 99.9% uptime for GitHub API integration (excluding GitHub downtime)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. User clicks "Connect GitHub"                    │   │
│  │  2. Generate OAuth state token (CSRF protection)    │   │
│  │  3. Redirect to GitHub OAuth                        │   │
│  └───────────────────┬─────────────────────────────────┘   │
└────────────────────────┼─────────────────────────────────────┘
                       │
                       │ HTTPS Redirect
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    GitHub OAuth                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. User grants repository access                   │    │
│  │  2. GitHub issues authorization code (5 min TTL)    │    │
│  │  3. Redirect back to Abyrith with code + state      │    │
│  └───────────────────┬─────────────────────────────────┘    │
└────────────────────────┼──────────────────────────────────────┘
                       │
                       │ HTTPS Redirect (callback)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Validate state token (prevent CSRF)             │   │
│  │  2. Exchange auth code for access token (via proxy) │   │
│  │  3. Encrypt token with user's master key            │   │
│  │  4. Send encrypted token to server                  │   │
│  └───────────────────┬─────────────────────────────────┘   │
└────────────────────────┼─────────────────────────────────────┘
                       │
                       │ HTTPS (encrypted token)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (API Gateway)                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  - Authenticate user (JWT)                          │    │
│  │  - Validate encrypted token structure               │    │
│  │  - Rate limit (prevent token flooding)              │    │
│  │  - Forward to Supabase                              │    │
│  │  (CANNOT decrypt token: no master key)              │    │
│  └───────────────────┬─────────────────────────────────┘    │
└────────────────────────┼──────────────────────────────────────┘
                       │
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│               Supabase PostgreSQL                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  github_connections table:                          │    │
│  │  - id (UUID)                                        │    │
│  │  - user_id, organization_id (RLS enforcement)       │    │
│  │  - encrypted_token (AES-256-GCM blob)               │    │
│  │  - encrypted_dek (envelope encryption)              │    │
│  │  - token_nonce, dek_nonce                           │    │
│  │  - github_username, github_user_id (plaintext)      │    │
│  │  - scopes, expires_at                               │    │
│  │  - RLS policies (organization isolation)            │    │
│  │  (CANNOT decrypt token: no master key)              │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘

                      When user links repo:

┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Select repo from GitHub list                    │   │
│  │  2. Decrypt GitHub token (using master key)         │   │
│  │  3. Generate .abyrith marker UUID                   │   │
│  │  4. Commit .abyrith to repo (via GitHub API)        │   │
│  │  5. Set ABYRITH_ORG_ID repo variable (hidden)       │   │
│  │  6. Store link in github_linked_repos table         │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

                      Repository structure:

Repository Root
├── .abyrith                    ← Marker file (safe to be public)
│   version: 1
│   project_id: "uuid"          ← Anonymous, no org info
│   linked_at: "timestamp"
│
└── GitHub Repo Variables (hidden, not in files)
    └── ABYRITH_ORG_ID          ← For two-way verification
```

### Key Components

**Component 1: GitHub OAuth Flow**
- **Purpose:** Securely obtain user authorization to access GitHub repos
- **Technology:** GitHub OAuth 2.0 with authorization code flow
- **Responsibilities:**
  - Generate cryptographically secure state tokens (CSRF protection)
  - Exchange authorization code for access token
  - Validate callback state parameter
  - Handle OAuth errors and edge cases
  - **CRITICAL:** Never expose token to server logs or client console

**Component 2: Client-Side Token Encryption**
- **Purpose:** Encrypt GitHub tokens before server storage
- **Technology:** Web Crypto API, AES-256-GCM
- **Responsibilities:**
  - Encrypt GitHub token with user's master key (same as secrets)
  - Use envelope encryption (token → DEK → master key)
  - Generate unique nonces for each encryption
  - Securely wipe plaintext token from memory after encryption

**Component 3: Repository Marker System**
- **Purpose:** Create bidirectional repo-project link verification
- **Technology:** `.abyrith` YAML file + GitHub repo variables
- **Responsibilities:**
  - Generate anonymous project UUID for marker file
  - Commit marker file to repo root
  - Store organization ID as hidden repo variable
  - Verify link integrity on every repo access
  - Prevent tampering by validating both sides

**Component 4: RLS Policy Enforcement**
- **Purpose:** Database-level organization isolation
- **Technology:** PostgreSQL Row-Level Security
- **Responsibilities:**
  - Prevent cross-org access to GitHub connections
  - Enforce user membership checks on every query
  - Block unauthorized repo linking attempts
  - Ensure audit logs capture all access attempts

**Component 5: Audit Logging System**
- **Purpose:** Compliance and security monitoring
- **Technology:** PostgreSQL append-only audit_logs table
- **Responsibilities:**
  - Log OAuth connections/disconnections
  - Log repo linking/unlinking events
  - Log sync operations (with file counts, not contents)
  - Log failed access attempts for security monitoring
  - Support GDPR data export requirements

### Component Interactions

**Browser ↔ GitHub:**
- Protocol: HTTPS redirect (OAuth 2.0 authorization code flow)
- Data format: URL query parameters
- Authentication: OAuth state parameter (CSRF protection)

**Browser ↔ Cloudflare Workers:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON (encrypted token payloads)
- Authentication: JWT Bearer token (Supabase Auth)

**Browser ↔ GitHub API (via Octokit):**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON (GitHub REST API v3)
- Authentication: Decrypted OAuth token (in memory only)

---

## Component Details

### Component: GitHub OAuth Flow

**Purpose:** Implement secure OAuth 2.0 authorization code flow to obtain user permission to access GitHub repositories

**Responsibilities:**
- Generate OAuth authorization URL with correct scopes
- Create and validate CSRF state tokens
- Exchange authorization code for access token
- Handle OAuth errors (user denies, expired code, etc.)
- Store state tokens temporarily (5 minute expiration)
- Prevent token interception and replay attacks

**Technology Stack:**
- **OAuth 2.0** - GitHub's authorization framework
- **@octokit/oauth-app** - Official GitHub OAuth library
- **TypeScript** - Type-safe implementation
- **Supabase** - Temporary state storage

**Internal Architecture:**
```
┌─────────────────────────────────────────────────────┐
│         GitHubOAuthService (TypeScript)             │
│  ┌─────────────────────────────────────────────┐   │
│  │  initiateOAuth(orgId: string)               │   │
│  │  1. Generate random state (32 bytes)        │   │
│  │  2. Store state in DB with expiration       │   │
│  │  3. Build GitHub OAuth URL                  │   │
│  │  4. Redirect user to GitHub                 │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  handleOAuthCallback(code, state)           │   │
│  │  1. Validate state token (CSRF check)       │   │
│  │  2. Delete state token (one-time use)       │   │
│  │  3. Exchange code for access token          │   │
│  │  4. Return token to client (encrypt it!)    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Modules:**
- `lib/github/oauth.ts` - OAuth flow orchestration
- `lib/github/state-manager.ts` - CSRF state token management
- `lib/github/token-exchange.ts` - Authorization code to token exchange

**Configuration:**
```typescript
interface GitHubOAuthConfig {
  clientId: string;          // GitHub OAuth app client ID
  clientSecret: string;      // GitHub OAuth app secret (server-side only)
  redirectUri: string;       // OAuth callback URL
  scopes: string[];          // Requested permissions
  stateExpiration: number;   // State token TTL (5 minutes)
}
```

**Example:**
```typescript
const oauthConfig: GitHubOAuthConfig = {
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!, // Never sent to client
  redirectUri: 'https://app.abyrith.com/auth/github/callback',
  scopes: ['repo', 'read:user'], // Minimum required scopes
  stateExpiration: 300000, // 5 minutes
};

// Initiate OAuth flow
const oauthService = new GitHubOAuthService(oauthConfig);
const authUrl = await oauthService.initiateOAuth(organizationId);
window.location.href = authUrl; // Redirect to GitHub
```

**Security Properties:**
- ✅ State parameter prevents CSRF attacks
- ✅ Authorization code is one-time use (5 minute expiration)
- ✅ HTTPS enforced for all OAuth endpoints
- ✅ Client secret never exposed to browser
- ✅ State tokens stored server-side with expiration

---

### Component: Client-Side Token Encryption

**Purpose:** Encrypt GitHub OAuth tokens client-side before sending to server, maintaining zero-knowledge architecture

**Responsibilities:**
- Encrypt GitHub access token using user's master key
- Use same envelope encryption pattern as secrets (token → DEK → master key)
- Generate cryptographically secure nonces
- Wipe plaintext token from memory after encryption
- Decrypt token on-demand when GitHub API access needed

**Technology Stack:**
- **Web Crypto API** - Native browser cryptography
- **TypeScript** - Type-safe encryption operations
- **Same encryption as secrets** - Consistency with existing patterns

**Internal Architecture:**
```
┌─────────────────────────────────────────────────────┐
│      GitHubTokenEncryption (TypeScript)             │
│  ┌─────────────────────────────────────────────┐   │
│  │  encryptToken(token: string, masterKey)     │   │
│  │  1. Generate random DEK (AES-256)           │   │
│  │  2. Generate token nonce (12 bytes)         │   │
│  │  3. Encrypt token with DEK (AES-GCM)        │   │
│  │  4. Generate DEK nonce (12 bytes)           │   │
│  │  5. Encrypt DEK with master key             │   │
│  │  6. Return encrypted payloads + nonces      │   │
│  │  7. Wipe token and DEK from memory          │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  decryptToken(encrypted, masterKey)         │   │
│  │  1. Decrypt DEK with master key             │   │
│  │  2. Decrypt token with DEK                  │   │
│  │  3. Verify auth tag (integrity)             │   │
│  │  4. Return plaintext token                  │   │
│  │  5. Wipe DEK from memory                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Modules:**
- `lib/crypto/github-token-encryption.ts` - Token encryption/decryption
- `lib/crypto/masterKey.ts` - Master key derivation (shared with secrets)
- `lib/crypto/encryption.ts` - Core encryption primitives (shared)

**Configuration:**
```typescript
interface TokenEncryptionConfig {
  algorithm: 'AES-GCM';
  keySize: 256;          // bits
  nonceSize: 12;         // bytes (96 bits)
  tagSize: 128;          // bits
}
```

**Example:**
```typescript
// After receiving GitHub token from OAuth callback
const githubToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';

// Encrypt token with user's master key (already derived from password)
const encrypted = await encryptGitHubToken(githubToken, masterKey);

// Send encrypted data to server
await fetch('/api/github/connections', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    organization_id: orgId,
    encrypted_token: btoa(String.fromCharCode(...encrypted.encryptedToken)),
    encrypted_dek: btoa(String.fromCharCode(...encrypted.encryptedDek)),
    token_nonce: btoa(String.fromCharCode(...encrypted.tokenNonce)),
    dek_nonce: btoa(String.fromCharCode(...encrypted.dekNonce)),
    github_username: 'octocat', // Plaintext metadata
    github_user_id: 1234567,
    scopes: ['repo', 'read:user'],
    expires_at: null // GitHub tokens don't expire unless revoked
  })
});

// Wipe token from memory
githubToken = null; // Clear reference (best effort in JS)
```

**Security Properties:**
- ✅ Token encrypted with same AES-256-GCM as secrets
- ✅ Server cannot decrypt token (no master key)
- ✅ Envelope encryption enables key rotation
- ✅ Unique nonces prevent ciphertext reuse
- ✅ Auth tag ensures integrity (tampering detected)

---

### Component: Repository Marker System

**Purpose:** Establish bidirectional verification between GitHub repositories and Abyrith projects using anonymous marker files and hidden variables

**Responsibilities:**
- Generate anonymous UUIDs for `.abyrith` marker files
- Commit marker files to repo root via GitHub API
- Store organization ID as hidden GitHub repo variable
- Verify both marker and variable match on every access
- Detect and block tampering attempts
- Allow safe marker file visibility (no sensitive data)

**Technology Stack:**
- **GitHub REST API** - File creation, repo variables
- **@octokit/rest** - Official GitHub API client
- **YAML** - Human-readable marker file format
- **PostgreSQL** - Store marker-to-project mappings

**Internal Architecture:**
```
┌─────────────────────────────────────────────────────┐
│       RepositoryMarkerService (TypeScript)          │
│  ┌─────────────────────────────────────────────┐   │
│  │  linkRepository(repo, projectId, orgId)     │   │
│  │  1. Generate abyrith_project_uuid (random)  │   │
│  │  2. Create .abyrith YAML content            │   │
│  │  3. Commit .abyrith to repo root            │   │
│  │  4. Set ABYRITH_ORG_ID repo variable        │   │
│  │  5. Store link in github_linked_repos       │   │
│  │  6. Audit log: repo_linked event            │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  verifyRepositoryLink(owner, repo)          │   │
│  │  1. Fetch .abyrith file (via GitHub API)    │   │
│  │  2. Parse YAML, extract project_id          │   │
│  │  3. Query github_linked_repos (RLS check)   │   │
│  │  4. Fetch ABYRITH_ORG_ID repo variable      │   │
│  │  5. Verify org_id matches database          │   │
│  │  6. Return verification result (bool)       │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Modules:**
- `lib/github/repository-marker.ts` - Marker file management
- `lib/github/repo-verification.ts` - Two-way link verification
- `lib/github/octokit-client.ts` - GitHub API interactions

**Configuration:**
```typescript
interface MarkerFileConfig {
  filename: '.abyrith';
  format: 'yaml';
  commitMessage: string;
  branch: 'main' | 'master'; // Auto-detect default branch
}
```

**Example:**

**.abyrith file content (safe to be public):**
```yaml
version: 1
project_id: "550e8400-e29b-41d4-a716-446655440000"
linked_at: "2025-11-04T10:30:00Z"
```

**Repository variable (hidden, not in files):**
```
Name: ABYRITH_ORG_ID
Value: "a3f1b8c9-4d5e-6a7b-8c9d-0e1f2a3b4c5d"
```

**Verification Logic:**
```typescript
async function verifyRepositoryLink(
  owner: string,
  repo: string,
  octokit: Octokit
): Promise<boolean> {
  try {
    // 1. Fetch .abyrith file
    const fileResponse = await octokit.repos.getContent({
      owner,
      repo,
      path: '.abyrith'
    });

    if (!('content' in fileResponse.data)) {
      return false; // File doesn't exist or is a directory
    }

    const content = Buffer.from(fileResponse.data.content, 'base64').toString();
    const markerData = parseYaml(content);
    const projectUuid = markerData.project_id;

    // 2. Query database for this project UUID (RLS auto-enforces org access)
    const { data: linkRecord, error } = await supabase
      .from('github_linked_repos')
      .select('organization_id, project_id')
      .eq('abyrith_project_uuid', projectUuid)
      .single();

    if (error || !linkRecord) {
      return false; // Link doesn't exist or user doesn't have access
    }

    // 3. Fetch repo variable ABYRITH_ORG_ID
    const { data: variable } = await octokit.actions.getRepoVariable({
      owner,
      repo,
      name: 'ABYRITH_ORG_ID'
    });

    // 4. Verify org_id matches
    if (variable.value !== linkRecord.organization_id) {
      // SECURITY ALERT: Tampering detected!
      await auditLog('repo_verification_failed', {
        reason: 'org_id_mismatch',
        expected: linkRecord.organization_id,
        actual: variable.value
      });
      return false;
    }

    return true; // Link verified
  } catch (error) {
    // Log error and return false
    return false;
  }
}
```

**Security Properties:**
- ✅ `.abyrith` UUID is anonymous (no org/user info)
- ✅ Two-way verification prevents marker file copying
- ✅ Repo variable hidden from casual inspection
- ✅ RLS prevents cross-org UUID lookups
- ✅ Tampering attempts logged for security monitoring

---

## Data Flow

### Flow 1: Connect GitHub Account (OAuth)

**Trigger:** User clicks "Connect GitHub" button in Abyrith UI

**Steps:**

1. **Generate OAuth State Token:**
   ```typescript
   // Browser: User initiates OAuth
   const state = crypto.randomUUID(); // 36-character UUID
   const expiresAt = Date.now() + 300000; // 5 minutes

   // Store state in database (temporary)
   await supabase.from('oauth_states').insert({
     state: state,
     user_id: currentUser.id,
     organization_id: currentOrg.id,
     provider: 'github',
     expires_at: new Date(expiresAt).toISOString()
   });
   ```

2. **Redirect to GitHub OAuth:**
   ```typescript
   // Browser: Build OAuth URL
   const oauthUrl = new URL('https://github.com/login/oauth/authorize');
   oauthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
   oauthUrl.searchParams.set('redirect_uri', 'https://app.abyrith.com/auth/github/callback');
   oauthUrl.searchParams.set('scope', 'repo read:user');
   oauthUrl.searchParams.set('state', state);

   // Redirect
   window.location.href = oauthUrl.toString();
   ```

3. **User Grants Permission on GitHub:**
   ```
   User sees GitHub permission screen:
   - "Abyrith wants to access your repositories"
   - Lists requested permissions: repo, read:user
   - User clicks "Authorize Abyrith"
   ```

4. **GitHub Redirects with Authorization Code:**
   ```
   GitHub redirects to:
   https://app.abyrith.com/auth/github/callback?code=abc123...&state=550e8400...
   ```

5. **Validate State Token (CSRF Check):**
   ```typescript
   // Browser: Extract query parameters
   const urlParams = new URLSearchParams(window.location.search);
   const code = urlParams.get('code');
   const state = urlParams.get('state');

   // Validate state exists in database
   const { data: stateRecord, error } = await supabase
     .from('oauth_states')
     .select('*')
     .eq('state', state)
     .eq('user_id', currentUser.id)
     .single();

   if (error || !stateRecord) {
     throw new Error('Invalid or expired OAuth state (possible CSRF attack)');
   }

   if (new Date(stateRecord.expires_at) < new Date()) {
     throw new Error('OAuth state expired (took longer than 5 minutes)');
   }

   // Delete state token (one-time use)
   await supabase.from('oauth_states').delete().eq('state', state);
   ```

6. **Exchange Authorization Code for Token:**
   ```typescript
   // Browser: Exchange code for token (via Cloudflare Worker proxy)
   const response = await fetch('/api/github/exchange-token', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwtToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({ code })
   });

   const { access_token, scope } = await response.json();

   // Worker code (never sends client_secret to browser):
   const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
     method: 'POST',
     headers: {
       'Accept': 'application/json',
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       client_id: env.GITHUB_CLIENT_ID,
       client_secret: env.GITHUB_CLIENT_SECRET, // Server-side only!
       code: code
     })
   });

   return tokenResponse.json(); // Return token to client
   ```

7. **Encrypt Token Client-Side:**
   ```typescript
   // Browser: Encrypt GitHub token before storing
   const encrypted = await encryptGitHubToken(access_token, masterKey);
   ```

8. **Store Encrypted Token:**
   ```typescript
   // Browser: Send encrypted token to server
   await fetch('/api/github/connections', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwtToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       organization_id: currentOrg.id,
       encrypted_token: btoa(String.fromCharCode(...encrypted.encryptedToken)),
       encrypted_dek: btoa(String.fromCharCode(...encrypted.encryptedDek)),
       token_nonce: btoa(String.fromCharChar(...encrypted.tokenNonce)),
       dek_nonce: btoa(String.fromCharCode(...encrypted.dekNonce)),
       github_username: 'octocat',
       github_user_id: 1234567,
       scopes: ['repo', 'read:user']
     })
   });
   ```

9. **Audit Log:**
   ```sql
   INSERT INTO audit_logs (
     organization_id, user_id, action_type, resource_type, metadata
   ) VALUES (
     'org_uuid', 'user_uuid', 'github_connected', 'github_connection',
     jsonb_build_object('github_username', 'octocat', 'scopes', '["repo", "read:user"]')
   );
   ```

**Sequence Diagram:**
```
User    Browser    Workers    GitHub    Supabase
  |        |          |         |           |
  |--click->|          |         |           |
  |        |--state--->|         |           |
  |        |          |--store-->|           |
  |        |          |         |           |--OK
  |        |<-redirect-|         |           |
  |        |                    |           |
  |---------------------auth--->|           |
  |        |                    |--grant--> (user approves)
  |<--------------------code----|           |
  |        |                    |           |
  |--code->|                    |           |
  |        |--validate---------->|           |--verify state
  |        |<-------------------OK          |
  |        |--exchange---------->|           |
  |        |                    |--token--> (token returned)
  |        |<---token-----------|           |
  |        |                    |           |
  |        |--encrypt (master key locally)  |
  |        |                    |           |
  |        |--POST encrypted--->|           |
  |        |                    |--INSERT-->|
  |        |                    |           |--audit
  |        |<---success---------|           |
  |<-done--|                    |           |
```

**Data Transformations:**
- **Point A (GitHub callback):** Authorization code (plaintext, 5 min TTL)
- **Point B (Token exchange):** Access token (plaintext, in browser memory)
- **Point C (Encryption):** Encrypted token + encrypted DEK + nonces
- **Point D (Database):** Base64-encoded encrypted blobs + plaintext metadata

---

### Flow 2: Link Repository to Project

**Trigger:** User selects a GitHub repository from the list and links it to an Abyrith project

**Steps:**

1. **Fetch User's Repositories:**
   ```typescript
   // Browser: Get list of repos user has access to
   const connection = await fetchGitHubConnection(organizationId);
   const decryptedToken = await decryptGitHubToken(
     connection.encrypted_token,
     connection.encrypted_dek,
     connection.token_nonce,
     connection.dek_nonce,
     masterKey
   );

   const octokit = new Octokit({ auth: decryptedToken });
   const { data: repos } = await octokit.repos.listForAuthenticatedUser({
     per_page: 100,
     sort: 'updated'
   });

   // Display repos to user
   ```

2. **User Selects Repo:**
   ```typescript
   // Browser: User clicks "Link" on a repository
   const selectedRepo = {
     owner: 'octocat',
     name: 'Hello-World',
     full_name: 'octocat/Hello-World',
     default_branch: 'main'
   };
   ```

3. **Generate Project UUID:**
   ```typescript
   // Browser: Generate anonymous UUID for .abyrith marker
   const abyrithProjectUuid = crypto.randomUUID();
   ```

4. **Create .abyrith Marker File:**
   ```typescript
   // Browser: Create marker file content
   const markerContent = `version: 1
project_id: "${abyrithProjectUuid}"
linked_at: "${new Date().toISOString()}"
`;

   // Commit to repo
   await octokit.repos.createOrUpdateFileContents({
     owner: selectedRepo.owner,
     repo: selectedRepo.name,
     path: '.abyrith',
     message: 'Add Abyrith project marker',
     content: btoa(markerContent),
     branch: selectedRepo.default_branch
   });
   ```

5. **Set Hidden Repo Variable:**
   ```typescript
   // Browser: Store organization ID as hidden repo variable
   await octokit.actions.createRepoVariable({
     owner: selectedRepo.owner,
     repo: selectedRepo.name,
     name: 'ABYRITH_ORG_ID',
     value: currentOrg.id
   });
   ```

6. **Store Link in Database:**
   ```typescript
   // Browser: Save link to database
   await fetch('/api/github/linked-repos', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwtToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       organization_id: currentOrg.id,
       project_id: projectId,
       github_connection_id: connection.id,
       repo_owner: selectedRepo.owner,
       repo_name: selectedRepo.name,
       repo_full_name: selectedRepo.full_name,
       default_branch: selectedRepo.default_branch,
       abyrith_project_uuid: abyrithProjectUuid
     })
   });
   ```

7. **Audit Log:**
   ```sql
   INSERT INTO audit_logs (
     organization_id, user_id, action_type, resource_type, resource_id, metadata
   ) VALUES (
     'org_uuid', 'user_uuid', 'github_repo_linked', 'github_repo', 'repo_uuid',
     jsonb_build_object(
       'repo_full_name', 'octocat/Hello-World',
       'project_id', 'project_uuid',
       'abyrith_project_uuid', 'marker_uuid'
     )
   );
   ```

**Success Criteria:**
- `.abyrith` file committed to repo root
- `ABYRITH_ORG_ID` variable set on repository
- `github_linked_repos` record created
- Audit log entry recorded
- User sees success message: "Repository linked successfully"

---

## Security Boundaries

### Trust Boundaries

**Boundary 1: User's Browser ↔ GitHub OAuth**
- **Threats:**
  - CSRF attacks (attacker initiates OAuth without user consent)
  - Authorization code interception
  - User denies permission, attacker retries
- **Controls:**
  - OAuth state parameter (cryptographically random, stored server-side, one-time use)
  - HTTPS enforced for all OAuth redirects
  - Authorization code has 5-minute expiration
  - GitHub validates redirect_uri matches registered URI

**Boundary 2: User's Browser ↔ Cloudflare Workers**
- **Threats:**
  - Encrypted token flooding (attacker sends many fake tokens)
  - Token replay attacks (reuse old encrypted tokens)
  - JWT token theft
- **Controls:**
  - JWT authentication required for all API calls
  - Rate limiting (100 requests per minute per user)
  - Input validation (reject malformed encrypted payloads)
  - Nonce verification (prevent replay attacks)

**Boundary 3: Cloudflare Workers ↔ Supabase**
- **Threats:**
  - SQL injection
  - Cross-org data access
  - Audit log tampering
- **Controls:**
  - Parameterized queries (prevent SQL injection)
  - RLS policies (database-level org isolation)
  - Append-only audit logs (no UPDATE or DELETE)
  - Service-to-service authentication (service role key)

**Boundary 4: User's Device ↔ Abyrith Platform**
- **Threats:**
  - Server compromise attempts to access plaintext tokens
  - Insider threats (malicious Abyrith employee)
  - Legal demands for GitHub token disclosure
- **Controls:**
  - **Zero-knowledge architecture**: Server cannot decrypt tokens even if compromised
  - Master key never transmitted to server
  - No server-side decryption capability exists
  - Encrypted data-at-rest in database

**Boundary 5: Abyrith ↔ GitHub API**
- **Threats:**
  - Token leakage via logs
  - Token used beyond intended scope
  - Malicious repo variable injection
- **Controls:**
  - Token decrypted in memory only, never logged
  - Minimum scopes requested (`repo`, `read:user`)
  - HTTPS for all GitHub API requests
  - Token used only for user-initiated actions

---

## Threat Model

### Threat 1: Database Compromise

**Description:** Attacker gains read access to Supabase PostgreSQL database

**Likelihood:** Medium (databases are high-value targets)

**Impact:** High (contains all GitHub connections)

**Mitigation:**
- ✅ **Zero-knowledge token encryption**: All GitHub tokens encrypted with keys derived from user passwords
- ✅ **No server-side decryption**: Even with database access, attacker gets only encrypted blobs
- ✅ **Row-Level Security**: Prevents cross-org access even with database read
- ✅ **Encrypted DEKs**: DEKs encrypted with master keys, never stored plaintext
- ✅ **Audit trail**: Database access monitored, anomalies detected

**Residual Risk:** Attacker could brute-force weak passwords (mitigated by password strength requirements, 2FA)

---

### Threat 2: OAuth CSRF Attack

**Description:** Attacker tricks user into connecting attacker's GitHub account to victim's Abyrith org

**Likelihood:** Low (requires social engineering + timing)

**Impact:** Medium (attacker's repos linked to victim's org, no secret exposure)

**Mitigation:**
- ✅ **OAuth state parameter**: Cryptographically random, stored server-side, validated on callback
- ✅ **One-time use**: State token deleted after first use (prevents replay)
- ✅ **Short expiration**: State tokens expire after 5 minutes
- ✅ **Audit logging**: OAuth connections logged with IP address, user agent

**Residual Risk:** User socially engineered into completing OAuth flow (acceptable, out of scope)

---

### Threat 3: Man-in-the-Middle (OAuth Flow)

**Description:** Attacker intercepts OAuth callback, steals authorization code

**Likelihood:** Low (requires privileged network position or compromised CA)

**Impact:** High (attacker gets GitHub token for 5-minute window)

**Mitigation:**
- ✅ **HTTPS only**: All OAuth endpoints require TLS 1.3
- ✅ **Authorization code TTL**: Code expires after 5 minutes (GitHub enforced)
- ✅ **One-time use**: Code cannot be reused after exchange
- ✅ **State validation**: MITM cannot forge valid state parameter
- 🔄 **Certificate pinning** (future): Prevent rogue CA attacks

**Residual Risk:** Authorization code theft within 5-minute window (low impact due to short TTL)

---

### Threat 4: .abyrith Marker File Tampering

**Description:** Attacker copies `.abyrith` file to different repository to gain access

**Likelihood:** Medium (simple file copy, no crypto knowledge needed)

**Impact:** High (attacker links their repo to victim's project)

**Mitigation:**
- ✅ **Two-way verification**: `.abyrith` UUID + `ABYRITH_ORG_ID` repo variable both checked
- ✅ **Hidden repo variable**: `ABYRITH_ORG_ID` not in files, requires GitHub API access
- ✅ **RLS enforcement**: Database query automatically filters by organization membership
- ✅ **Audit logging**: Verification failures logged for security monitoring
- ✅ **Tampering detection**: Mismatched org_id triggers security alert

**Residual Risk:** Attacker with write access to victim's repo (acceptable, repo owner trusted)

---

### Threat 5: Cross-Organization Access

**Description:** User in Org A tries to access GitHub connections from Org B

**Likelihood:** Medium (intentional malicious attempt or confused user)

**Impact:** High (unauthorized access to other org's repos)

**Mitigation:**
- ✅ **Row-Level Security**: Database policies enforce organization membership
- ✅ **JWT org_id validation**: API gateway verifies user is member of requested org
- ✅ **Query filtering**: All queries automatically scoped to user's organizations
- ✅ **Audit logging**: Cross-org access attempts logged

**Residual Risk:** None (RLS is enforced at database level, cannot be bypassed)

**RLS Policy Example:**
```sql
CREATE POLICY "Users can only access their org's GitHub connections"
  ON github_connections
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

---

### Threat 6: Malicious .env File Injection

**Description:** Attacker adds malicious `.env` file to repository, user syncs it to Abyrith

**Likelihood:** Medium (attacker with repo write access)

**Impact:** High (malicious secrets imported into Abyrith)

**Mitigation:**
- ✅ **Manual sync only**: No automatic `.env` import without user approval
- ✅ **Preview before import**: User sees all secrets before confirming import
- ✅ **Audit logging**: Sync operations logged with file counts and repo info
- ✅ **Repo access required**: Attacker needs write access to victim's repo (trust boundary)
- ✅ **User confirmation**: Explicit "Import X secrets" button click required

**Residual Risk:** User explicitly imports malicious secrets (acceptable, user trust boundary)

---

### Threat 7: GitHub Token Exposure via Logs

**Description:** Decrypted GitHub token accidentally logged to server or client console

**Likelihood:** Medium (common developer mistake)

**Impact:** High (token exposure allows repo access)

**Mitigation:**
- ✅ **No server-side decryption**: Tokens never decrypted on server, cannot appear in server logs
- ✅ **Client-side log filtering**: Redact sensitive values from console output
- ✅ **Code review**: Review for accidental logging
- ✅ **Production console disabling**: Disable console.log in production builds
- ✅ **Token scoping**: Tokens have minimum required scopes

**Residual Risk:** Developer accidentally logs decrypted token in browser console (mitigated by code review, security training)

---

### Threat 8: Insider Threat (Abyrith Employee)

**Description:** Malicious Abyrith employee attempts to access user GitHub tokens

**Likelihood:** Low (requires intentional malicious action)

**Impact:** Critical (erosion of user trust)

**Mitigation:**
- ✅ **Zero-knowledge architecture**: Employees cannot decrypt tokens (no master keys)
- ✅ **Least privilege access**: Database access limited to necessary personnel
- ✅ **Audit logging**: All administrative actions logged
- ✅ **Code review**: All token access code reviewed for backdoors
- ✅ **Third-party audit**: Independent security audit verifies zero-knowledge claims

**Residual Risk:** Theoretical code injection to capture master keys client-side (mitigated by open-source frontend, security audits)

---

## Security Controls

### Authentication

**Method:** GitHub OAuth 2.0 with authorization code flow

**How it works:**
1. User redirected to GitHub to grant permissions
2. GitHub issues authorization code (5 minute TTL, one-time use)
3. Abyrith exchanges code for access token (client secret on server)
4. Token encrypted client-side with user's master key
5. Encrypted token stored in database (server cannot decrypt)

**Token Structure:**
```
ghp_16C7e42F292c6912E7710c838347Ae178B4a  // Personal access token format (classic)
gho_16C7e42F292c6912E7710c838347Ae178B4a  // OAuth token format (new)
```

**Token Lifecycle:**
- **Expiration:** GitHub OAuth tokens do not expire unless revoked
- **Refresh:** No refresh token (user must re-authorize if revoked)
- **Revocation:** User can revoke via GitHub settings or Abyrith disconnect
- **Storage:** Encrypted BYTEA column in `github_connections` table

### Authorization

**Model:** Role-Based Access Control (RBAC) + Organization Membership

**Enforcement points:**
1. **Client-side (UX):** Hide GitHub features if user not authorized
2. **API Gateway (Cloudflare Workers):** Verify user is org member before processing
3. **Database (PostgreSQL RLS):** Final enforcement layer, prevents data access

**Permission evaluation:**
```sql
-- Example RLS policy for github_connections table
CREATE POLICY "Users can only access their org's GitHub connections"
  ON github_connections
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Example RLS policy for github_linked_repos table
CREATE POLICY "Users can only access their org's linked repos"
  ON github_linked_repos
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Permissions:**
- **Owner/Admin:** Can connect GitHub, link/unlink repos, disconnect GitHub
- **Developer:** Can view linked repos, sync .env files (if org allows)
- **Read-Only:** Cannot access GitHub integration features

### Data Protection

**Data at Rest:**
- **Encryption:** AES-256-GCM client-side encryption for GitHub tokens
- **Storage:** PostgreSQL encrypted BYTEA columns
- **Access controls:** Row-Level Security enforces organization isolation
- **Key management:** DEKs encrypted with user master keys

**Data in Transit:**
- **Encryption:** TLS 1.3 for all network traffic (browser ↔ Workers ↔ Supabase ↔ GitHub)
- **Certificate management:** Managed by Cloudflare and GitHub
- **HSTS:** Enforces HTTPS, prevents downgrade attacks

**Data in Use:**
- **Processing:** GitHub tokens decrypted in browser memory only
- **Temporary storage:** Plaintext tokens in memory for duration of GitHub API call
- **Memory security:** Token references cleared after use (best effort in JavaScript)

### Audit Logging

**What events are logged:**
- GitHub account connected (OAuth completed)
- GitHub account disconnected
- Repository linked to project
- Repository unlinked from project
- `.env` file synced from repository
- Repository verification failed (tampering detected)
- GitHub API errors (authentication failures, rate limits)

**What information is captured:**
```typescript
interface GitHubAuditLogEntry {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  organization_id: string;       // Organization UUID
  user_id: string;               // Actor UUID
  action_type: string;           // 'github_connected', 'github_repo_linked', etc.
  resource_type: string;         // 'github_connection', 'github_repo'
  resource_id: string;           // UUID of resource
  ip_address: string;            // Source IP
  user_agent: string;            // Browser/tool identifier
  metadata: {
    github_username?: string;
    repo_full_name?: string;
    scopes?: string[];
    file_count?: number;
    error?: string;
  };
  result: 'success' | 'failure';
}
```

**Audit log properties:**
- **Append-only:** No deletions or modifications allowed
- **Immutability:** Database constraints prevent tampering
- **Retention:** 1 year minimum (configurable per organization)
- **Export:** CSV/JSON export for compliance reporting

---

## Cryptographic Specifications

### GitHub Token Encryption

**Algorithm:** AES-256-GCM (same as secrets encryption)

**Parameters:**
```typescript
interface TokenEncryptionSpec {
  algorithm: 'AES-GCM';
  keySize: 256;           // bits
  nonceSize: 12;          // bytes (96 bits)
  tagSize: 128;           // bits (authentication tag)
  envelopeEncryption: true; // Token → DEK → Master Key
}
```

**Process:**
1. Generate random 256-bit DEK for token
2. Generate random 96-bit nonce for token encryption
3. Encrypt GitHub token with DEK using AES-256-GCM
4. Export DEK (to be encrypted with master key)
5. Generate random 96-bit nonce for DEK encryption
6. Encrypt DEK with user's master key
7. Store: encrypted_token, encrypted_dek, token_nonce, dek_nonce, auth_tag

**Security Rationale:**
- Same encryption as secrets (consistency, proven secure)
- Envelope encryption enables key rotation
- Master key never leaves browser
- Server cannot decrypt even if compromised
- Authenticated encryption prevents tampering

**Example Implementation:**
```typescript
async function encryptGitHubToken(
  token: string,
  masterKey: CryptoKey
): Promise<EncryptedGitHubToken> {
  // 1. Generate Data Encryption Key
  const dek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // 2. Generate nonce for token encryption
  const tokenNonce = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt token with DEK
  const encryptedToken = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: tokenNonce,
      tagLength: 128
    },
    dek,
    new TextEncoder().encode(token)
  );

  // 4. Export DEK
  const rawDEK = await crypto.subtle.exportKey('raw', dek);

  // 5. Generate nonce for DEK encryption
  const dekNonce = crypto.getRandomValues(new Uint8Array(12));

  // 6. Encrypt DEK with master key
  const encryptedDEK = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: dekNonce,
      tagLength: 128
    },
    masterKey,
    rawDEK
  );

  return {
    encryptedToken: new Uint8Array(encryptedToken),
    encryptedDEK: new Uint8Array(encryptedDEK),
    tokenNonce: tokenNonce,
    dekNonce: dekNonce
  };
}
```

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- **OAuth flow initiation:** < 200ms (generate state, build URL)
- **OAuth callback processing:** < 500ms (validate state, exchange code)
- **Token encryption:** < 100ms (client-side, same as secrets)
- **Token decryption:** < 100ms (client-side, on-demand)
- **Repository listing:** < 2s (GitHub API call)
- **Repository linking:** < 5s (commit marker + set variable + DB insert)

**Throughput:**
- **OAuth connections:** 10+ per minute per user (rate-limited to prevent abuse)
- **Repository listings:** 100+ repos returned per request
- **Repository operations:** 5+ concurrent operations per user

**Resource Usage:**
- **Memory (client):** ~2MB for Octokit client, < 10MB during repo operations
- **CPU (client):** Minimal except during token encryption/decryption
- **Storage (database):** ~500 bytes per connection, ~200 bytes per linked repo

### Performance Optimization

**Optimizations implemented:**
- **Web Crypto API:** Hardware-accelerated AES-GCM (10-100x faster than JS)
- **Token caching:** Decrypted token kept in memory for duration of operation
- **Octokit caching:** Repository lists cached for 5 minutes (React Query)
- **Lazy loading:** Repositories fetched on-demand, not at page load
- **Pagination:** GitHub API supports 100 repos per page (sufficient for most users)

**Caching Strategy:**
- **Encrypted tokens:** Cached in browser memory during session (cleared on logout)
- **Repository lists:** Cached for 5 minutes (React Query)
- **Linked repos:** Cached indefinitely, invalidated on link/unlink
- **Verification results:** Cached for 1 hour (reduces GitHub API calls)

**Database Optimization:**
- **Indexes:**
  ```sql
  CREATE INDEX idx_github_connections_org_user
    ON github_connections(organization_id, user_id);

  CREATE INDEX idx_github_linked_repos_org_project
    ON github_linked_repos(organization_id, project_id);

  CREATE INDEX idx_github_linked_repos_uuid
    ON github_linked_repos(abyrith_project_uuid);
  ```

---

## Failure Modes

### Failure Mode 1: User Revokes GitHub Token

**Scenario:** User revokes OAuth token via GitHub settings

**Impact:** GitHub API calls fail with 401 Unauthorized

**Detection:** GitHub API returns `Bad credentials` error

**Recovery:**
1. Display user-friendly error: "Your GitHub connection has been revoked. Please reconnect."
2. Mark connection as `invalid` in database
3. Notify user via UI banner
4. Provide "Reconnect GitHub" button
5. Audit log: `github_token_revoked` event

**Prevention:**
- Cannot prevent user from revoking (user's right)
- Graceful error handling when token invalid
- Periodic token validation (check on first use per session)

---

### Failure Mode 2: .abyrith File Deleted

**Scenario:** User manually deletes `.abyrith` file from repository

**Impact:** Repository verification fails, repo appears unlinked

**Detection:** GitHub API returns 404 when fetching `.abyrith` file

**Recovery:**
1. Display warning: "Repository marker file missing. Re-link repository?"
2. Offer "Re-link Repository" button (recreates marker)
3. Mark link as `broken` in database
4. Audit log: `repo_marker_missing` event

**Prevention:**
- `.abyrith` file is small and non-intrusive (unlikely to be deleted)
- Documentation warns against manual deletion
- Git ignore patterns should not exclude `.abyrith`

---

### Failure Mode 3: GitHub API Rate Limit Exceeded

**Scenario:** User performs many GitHub operations, hits rate limit (5,000 requests/hour)

**Impact:** GitHub API calls fail with 429 Too Many Requests

**Detection:** GitHub API returns `rate limit exceeded` error with reset timestamp

**Recovery:**
1. Display user-friendly error: "GitHub rate limit exceeded. Try again in X minutes."
2. Show countdown timer until rate limit resets
3. Cache responses aggressively to reduce API calls
4. Audit log: `github_rate_limit_exceeded` event

**Prevention:**
- Cache repository lists for 5 minutes
- Cache verification results for 1 hour
- Batch operations where possible
- Display rate limit status in UI (X/5000 remaining)

---

## Compliance Considerations

### SOC 2 Type II

**Security:**
- ✅ GitHub tokens encrypted with zero-knowledge architecture
- ✅ Audit logs capture all GitHub operations
- ✅ RLS policies enforce organization isolation
- ✅ OAuth state parameter prevents CSRF attacks
- ✅ Two-way verification prevents tampering

**Availability:**
- ✅ GitHub API errors handled gracefully (doesn't break app)
- ✅ Token revocation detected and user notified
- ✅ Rate limit handling (fallback to cached data)

**Confidentiality:**
- ✅ GitHub tokens never exposed in logs or responses
- ✅ `.abyrith` marker file contains no sensitive data
- ✅ Repo variables hidden from casual inspection

**Processing Integrity:**
- ✅ Two-way verification ensures link integrity
- ✅ OAuth state validation prevents CSRF
- ✅ Input validation on all API endpoints

**Privacy:**
- ✅ GDPR compliant (user can export/delete GitHub connections)
- ✅ Audit logs support compliance reporting
- ✅ No unnecessary data collection

### GDPR

**Right to Access:**
- ✅ User can export all GitHub connections and linked repos

**Right to Erasure:**
- ✅ User can disconnect GitHub account (deletes all connections and links)
- ✅ Deletion cascades to linked repos and audit logs (with retention policy)

**Right to Portability:**
- ✅ Export GitHub connections as JSON (includes metadata, not encrypted token)

**Data Minimization:**
- ✅ Only collect necessary data (GitHub username, user ID, scopes)
- ✅ `.abyrith` marker contains only anonymous UUID

**Privacy by Design:**
- ✅ Zero-knowledge token encryption
- ✅ No server-side decryption capability

---

## Alternatives Considered

### Alternative 1: GitHub App Installation (Instead of OAuth)

**Description:** Use GitHub App with installation tokens instead of user OAuth tokens

**Pros:**
- Fine-grained repository access
- Separate permissions per repository
- Higher rate limits (5,000/hour per installation)
- Can work across organizations

**Cons:**
- More complex for users (install app on org, configure access)
- Requires organization admin permissions
- Installation tokens expire (refresh needed)
- Less intuitive UX ("Install app" vs "Connect GitHub")

**Why not chosen:** OAuth user tokens are simpler for MVP. Users understand "Connect GitHub" better than "Install App." Can add GitHub Apps in Phase 2 for enterprise customers.

---

### Alternative 2: Store GitHub Tokens Server-Side (No Client-Side Encryption)

**Description:** Store GitHub tokens in plaintext or server-side encryption on backend

**Pros:**
- Simpler implementation (no client-side crypto)
- Faster token access (no decryption step)
- Easier debugging (can inspect tokens in logs)

**Cons:**
- Violates zero-knowledge architecture (core product principle)
- Server compromise exposes all tokens
- Insider threats can access tokens
- Legal demands can force disclosure
- Reduces trust in Abyrith platform

**Why not chosen:** Violates zero-knowledge security model. GitHub tokens are secrets and must be protected with same rigor as user secrets.

---

### Alternative 3: No .abyrith Marker File (Database-Only Linking)

**Description:** Link repos to projects purely via database, no marker file in repos

**Pros:**
- No file clutter in repositories
- No risk of marker file being deleted
- Simpler linking flow (no Git commit)

**Cons:**
- AI tools cannot discover project context from repo
- No two-way verification (link integrity at risk)
- Harder for users to see which repos are linked (must check Abyrith UI)
- No MCP auto-discovery of project secrets

**Why not chosen:** Marker file enables AI tool integration (Claude Code, Cursor) and provides two-way verification for security. File is small and non-intrusive.

---

## Decision Log

### Decision 1: Encrypt GitHub Tokens Client-Side

**Date:** 2025-11-04

**Context:** Should GitHub OAuth tokens be encrypted like secrets, or stored differently?

**Options:**
1. **Client-side encryption** - Same as secrets (zero-knowledge)
2. **Server-side encryption** - Encrypt with server-managed keys
3. **Plaintext storage** - Store tokens unencrypted

**Decision:** Client-side encryption with user's master key

**Rationale:**
- GitHub tokens are secrets and must be protected with same rigor
- Maintains zero-knowledge architecture consistency
- Server compromise does not expose tokens
- Users maintain data sovereignty
- Aligns with product vision and security model

**Consequences:**
- More complex implementation (client-side crypto)
- Decryption required for every GitHub API call
- Master password required to use GitHub features
- Cannot access tokens server-side for automation (acceptable trade-off)

---

### Decision 2: Use .abyrith Marker File + Repo Variable

**Date:** 2025-11-04

**Context:** How to link repositories to projects securely and detect tampering?

**Options:**
1. **Marker file only** - Store UUID in `.abyrith` file
2. **Repo variable only** - Store project ID as hidden variable
3. **Both (two-way verification)** - Marker file + repo variable

**Decision:** Both marker file and repo variable

**Rationale:**
- Two-way verification prevents marker file copying attacks
- Marker file enables AI tool discovery (Claude Code, Cursor)
- Repo variable provides hidden verification (requires API access)
- Organization ID mismatch detected = tampering attempt
- Defense in depth (two independent verification mechanisms)

**Consequences:**
- More complex linking flow (commit + set variable)
- Two GitHub API calls instead of one
- Slightly slower repo linking (~5s vs ~2s)
- Higher security confidence (worth the trade-off)

---

### Decision 3: Manual .env Sync Only (No Automatic Import)

**Date:** 2025-11-04

**Context:** Should `.env` files be automatically imported when repo is linked?

**Options:**
1. **Automatic sync** - Import `.env` immediately on repo link
2. **Manual sync** - User explicitly triggers import
3. **No sync** - User manually copies secrets

**Decision:** Manual sync with preview

**Rationale:**
- Security risk: Attacker could inject malicious `.env` before user links
- User must explicitly approve secrets being imported
- Preview step allows user to review secrets before import
- Follows principle of least surprise (no automatic actions)
- Audit trail clearly shows user triggered sync

**Consequences:**
- Extra user step (click "Sync .env" button)
- Slightly less convenient than automatic
- Much safer against malicious secret injection

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `03-security/security-model.md` - Zero-knowledge architecture
- [ ] `04-database/schemas/github-connections.md` - Database schema
- [ ] `06-backend/integrations/github-api-integration.md` - GitHub API integration
- [ ] `lib/crypto/encryption.ts` - Encryption primitives (shared with secrets)
- [ ] `lib/crypto/masterKey.ts` - Master key derivation

**External Services:**
- **GitHub OAuth** - Authorization code flow (SLA: 99.95%)
- **GitHub API** - REST API v3 (Rate limit: 5,000 req/hour)
- **GitHub Repo Variables** - Actions secrets API
- **Web Crypto API** - Browser standard (no external dependency)

### Architecture Dependencies

**Depends on these components:**
- `auth.users` table (Supabase managed) - User authentication
- `organizations` table - Organization management
- `user_organizations` table - User-org membership
- `projects` table - Project definitions
- `audit_logs` table - Audit logging infrastructure

**Required by these components:**
- `08-features/github-integration/github-integration-overview.md` - Feature documentation
- `09-integrations/mcp/repo-discovery.md` - MCP repository discovery
- `07-frontend/components/GitHubConnectionButton.tsx` - UI component

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge architecture
- `04-database/schemas/github-connections.md` - Database schema
- `06-backend/integrations/github-api-integration.md` - Integration implementation
- `TECH-STACK.md` - Technology specifications
- `GLOSSARY.md` - Security terminology

### External Resources
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps) - OAuth 2.0 flow
- [GitHub API Documentation](https://docs.github.com/en/rest) - REST API reference
- [GitHub Actions Variables](https://docs.github.com/en/actions/learn-github-actions/variables) - Repo variables
- [Web Crypto API Specification](https://www.w3.org/TR/WebCryptoAPI/) - Browser crypto
- [OWASP OAuth Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth_2_0_Security_Cheat_Sheet.html) - OAuth best practices

### Security Standards
- **SOC 2 Type II** - Service Organization Control 2
- **GDPR** - General Data Protection Regulation
- **OWASP Top 10** - Web application security risks

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-04 | Security Team / Engineering Lead | Initial GitHub integration security documentation |

---

## Notes

### Future Enhancements
- **GitHub App support** - Fine-grained repository access (Phase 2)
- **GitHub Enterprise Server** - On-premises GitHub support (Phase 3)
- **Bidirectional sync** - Changes in Abyrith push to `.env` files (Phase 4)
- **Certificate pinning** - Prevent MITM attacks on OAuth flow (Phase 2)
- **Token refresh** - Implement token rotation without user re-auth (Phase 3)

### Known Limitations
- GitHub OAuth tokens do not expire (no refresh mechanism)
- Rate limit: 5,000 requests/hour per user (GitHub limit)
- Cannot access private repos user doesn't have access to
- `.abyrith` marker file visible to all repo collaborators (by design)

### Next Review Date
**2026-02-04** - Review OAuth security, check for new GitHub API features, validate RLS policies
