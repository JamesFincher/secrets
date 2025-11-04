---
Document: GitHub Repository Syncing - Feature Documentation
Version: 1.0.0
Last Updated: 2025-11-04
Owner: Engineering Team
Status: Draft
Dependencies: 03-security/security-model.md, 02-architecture/system-overview.md, 04-database/schemas/github-connections.md, 05-api/endpoints/github-endpoints.md, 06-backend/integrations/github-api-integration.md
---

# GitHub Repository Syncing Feature

## Overview

GitHub Repository Syncing enables users to link GitHub repositories to Abyrith Projects, import existing secrets from repository files, and maintain a connection for future automation. This feature bridges the gap between existing development workflows and Abyrith's secure secrets management.

**Purpose:** Seamlessly import existing secrets from .env files and GitHub Actions, detect needed API keys from dependencies, and manage secrets across development workflows without disrupting existing practices.

**Target Users:** Solo Developers, Development Teams

**Priority:** P1 - Post-MVP (Phase 5: Advanced Features)

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

GitHub Repository Syncing appears as a connection option when creating or managing Projects. Users can link a GitHub repository to a Project through OAuth authentication, then import secrets with a simple wizard-like flow.

**Key Capabilities:**

- **One-Way Sync (GitHub → Abyrith):** Import secrets from repository files without writing back to GitHub
- **Multiple Source Types:** Import from .env files, GitHub Actions secrets, and detect from dependencies
- **Smart Detection:** Automatically scan package.json, requirements.txt, and similar files to suggest needed API keys
- **Collision Handling:** Choose how to handle existing secrets (skip, overwrite, rename)
- **Secure Linking:** Anonymous identifier system that doesn't expose sensitive data in repositories
- **Environment Mapping:** Map repository files to Abyrith environments (dev, staging, production)

### User Benefits

**For Solo Developers:**
- Quickly migrate existing secrets from scattered .env files to secure storage
- Stop worrying about accidentally committing secrets to Git
- Maintain existing workflow while gaining security benefits
- One-time import simplifies the migration process

**For Development Teams:**
- Centralize secrets across team members without sharing .env files via Slack
- Onboard new developers faster (they get secrets from Abyrith, not scattered docs)
- Maintain audit trail of who imported secrets and when
- Coordinate secret changes across team without manual .env updates

**For Enterprise:**
- Compliance-friendly import audit logs
- Controlled migration from legacy secret storage
- Integration with existing GitHub-based workflows
- Support for GitHub Enterprise repositories

### Example Scenarios

**Scenario 1: Solo Developer Migrating to Abyrith**

Alex is a solo developer with 5 side projects, each with .env files containing API keys for Stripe, SendGrid, OpenAI, and various cloud services. The keys are scattered across local .env files and some are even saved in their notes app.

1. Alex signs up for Abyrith and creates a new Project called "RecipeApp"
2. Clicks "Import from GitHub" and authorizes Abyrith to access their repositories
3. Selects the "recipe-app" repository from the list
4. Abyrith scans the repository and finds:
   - `.env` file with 8 secrets
   - `.env.production` file with 6 secrets
   - GitHub Actions secrets (3 deployment-related secrets)
   - package.json dependencies suggesting 2 additional API keys needed
5. Alex reviews the preview, maps .env → development, .env.production → production
6. Clicks "Import" and within seconds, all 17 secrets are encrypted and stored in Abyrith
7. Alex can now delete the .env files from the repository and use Abyrith's CLI or MCP integration

**Scenario 2: Development Team Onboarding New Member**

A startup team of 5 developers needs to onboard a new engineer, Jordan. Previously, they would share .env files via Slack DMs (insecure and tedious).

1. Team lead links the team's GitHub repository to their Abyrith Project
2. Jordan joins the team and is invited to the Abyrith Project as a "Developer"
3. Jordan can now access all development secrets through Abyrith
4. Jordan clones the GitHub repository (no .env file present)
5. Jordan uses Abyrith's CLI to fetch secrets: `abyrith env inject --project team-project --env development npm run dev`
6. Application starts with all secrets loaded from Abyrith
7. Future secret changes are made in Abyrith, not scattered .env files

**Scenario 3: Detecting Missing API Keys from Dependencies**

Maria adds a new npm package to her project: `@stripe/stripe-js`. She forgets that Stripe requires API keys.

1. Maria commits the package.json change
2. Next time she opens the Abyrith Project, she sees a notification: "Detected new dependency: Stripe. You may need an API key."
3. Maria clicks the notification, which opens the AI Assistant
4. AI Assistant: "I noticed you added Stripe. Would you like help getting your Stripe API key?"
5. AI Assistant provides guided acquisition steps
6. Maria follows the steps, gets the key, and stores it securely in Abyrith

---

## Technical Architecture

### System Components

**Components involved:**

- **Frontend (Next.js):**
  - GitHub OAuth authorization flow UI
  - Repository selection dropdown
  - Secret import preview/review component
  - Collision resolution UI (skip/overwrite/rename)
  - Environment mapping interface

- **Backend (Cloudflare Workers + Supabase):**
  - GitHub OAuth token exchange and storage
  - Repository content fetching (via GitHub API)
  - .env file parsing
  - GitHub Actions secret detection (read-only)
  - Dependency analysis (package.json, requirements.txt, etc.)
  - Secret encryption orchestration
  - .abyrith marker file creation
  - Repository variable storage (organization_id)

- **Database (PostgreSQL via Supabase):**
  - `github_connections` table (stores encrypted GitHub tokens, repo metadata)
  - `secrets` table (stores imported secrets with "GitHub" origin tag)
  - `audit_logs` table (logs all GitHub operations)

- **External Services:**
  - **GitHub API:** Repository access, content retrieval, GitHub Actions secrets, repository variables
  - **GitHub OAuth App:** User authorization for repository access

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Browser                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Abyrith Frontend (Next.js)                          │  │
│  │  - OAuth authorization UI                            │  │
│  │  - Repository selector                               │  │
│  │  - Import preview & collision handler                │  │
│  └───────────────┬───────────────────────────────────────┘  │
└─────────────────┼───────────────────────────────────────────┘
                  │
                  │ HTTPS API Calls
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          Cloudflare Workers (API Gateway)                   │
│  - GitHub OAuth token exchange                              │
│  - Request routing & authentication                         │
│  - Rate limiting                                            │
└─────────────────┬──────────────────┬────────────────────────┘
                  │                  │
                  │                  │ GitHub API Calls
                  │                  ▼
                  │          ┌────────────────────┐
                  │          │   GitHub API       │
                  │          │  - Repository      │
                  │          │    content         │
                  │          │  - Actions secrets │
                  │          │  - Repo variables  │
                  │          └────────────────────┘
                  │
                  │ Database Operations
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + RLS)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tables:                                             │   │
│  │  - github_connections (encrypted tokens, metadata)  │   │
│  │  - secrets (imported secrets, "GitHub" origin)      │   │
│  │  - audit_logs (GitHub operation history)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**GitHub Repository Linking Flow:**

1. **User clicks "Import from GitHub"** → Frontend redirects to GitHub OAuth authorization page
2. **User authorizes Abyrith** → GitHub redirects back with authorization code
3. **Frontend sends code to Cloudflare Workers** → Workers exchange code for GitHub access token
4. **Workers encrypt token** → Uses envelope encryption (DEK + user's KEK derived from master password)
5. **Store encrypted token** → Saved in `github_connections` table with RLS policies enforcing organization isolation
6. **Fetch user's repositories** → Workers use encrypted token to call GitHub API, return repository list to frontend
7. **User selects repository** → Frontend stores selection, prepares for secret import

**Secret Import Flow:**

1. **User initiates import** → Frontend sends repository ID to Workers
2. **Workers decrypt GitHub token** → Retrieves from database, decrypts with user's KEK
3. **Fetch repository contents** → GitHub API calls to retrieve:
   - `.env`, `.env.example`, `.env.production`, `.env.staging`, etc.
   - GitHub Actions secrets (read-only access)
   - `package.json`, `requirements.txt`, `Gemfile`, etc. (dependency files)
4. **Parse and analyze** → Workers parse .env files, extract GitHub Actions secrets, analyze dependencies
5. **Detect needed API keys** → Pattern matching in dependencies (e.g., "@stripe/stripe-js" → "Stripe API key needed")
6. **Return preview to frontend** → JSON response with discovered secrets and suggestions
7. **User reviews and configures** → Maps files to environments, handles collisions
8. **User confirms import** → Frontend sends final configuration to Workers
9. **Workers encrypt secrets** → Each secret encrypted client-side (browser) with user's KEK, then stored
10. **Create .abyrith marker** → Workers create `.abyrith` file in repository (anonymous UUID only)
11. **Store repository variable** → Workers create GitHub repository variable with organization_id (private, not in git)
12. **Audit logging** → Log all operations (import, token storage, marker creation)
13. **Return success** → Frontend shows success message with imported secret count

**Unlinking Repository Flow:**

1. **User clicks "Unlink Repository"** → Frontend shows confirmation dialog
2. **User confirms** → Frontend sends unlink request to Workers
3. **Workers delete marker** → GitHub API call to delete `.abyrith` file
4. **Delete repository variable** → GitHub API call to delete repository variable
5. **Delete connection record** → Remove from `github_connections` table (cascade deletes related records)
6. **Audit logging** → Log unlink operation
7. **Existing secrets remain** → Secrets imported from GitHub are NOT deleted, only the connection is removed

---

## User Flows

### Flow 1: Link GitHub Repository (Create New Project)

**Trigger:** User clicks "Add Project" → "Import from GitHub"

**Steps:**

1. **User:** Dashboard → "Add Project" → "Import from GitHub"
2. **System:** Displays explanation: "Connect a GitHub repository to import secrets from .env files and GitHub Actions"
3. **User:** Clicks "Authorize GitHub"
4. **System:** Redirects to GitHub OAuth authorization page
5. **User:** Reviews permissions requested (read-only repository access), clicks "Authorize"
6. **System:** GitHub redirects back to Abyrith with authorization code
7. **System:** Exchanges code for access token, encrypts token, stores in database
8. **System:** Fetches user's repositories via GitHub API, displays list
9. **User:** Selects repository from dropdown (e.g., "jane-dev/recipe-app")
10. **User:** Chooses "Create new Project" → Enters Project name (e.g., "RecipeApp")
11. **System:** Creates new Project, links repository to Project
12. **System:** Creates `.abyrith` marker file in repository (contains only anonymous UUID)
13. **System:** Stores `organization_id` as repository variable (private, not in git)
14. **User:** Sees new Project with "GitHub" badge indicating linked repository

**Success Criteria:** Project created, repository linked, marker file committed, ready for secret import

**Error Cases:**

- **User denies OAuth authorization** → System shows message: "GitHub authorization required to import secrets. Please try again." Returns to Project creation screen.
- **GitHub API rate limit exceeded** → System shows message: "GitHub rate limit reached. Please try again in X minutes." (Rate limit reset time displayed)
- **Repository already linked** → System shows message: "This repository is already linked to Project '[ProjectName]'. Would you like to import more secrets or unlink the existing connection?"
- **Network error during OAuth** → System shows message: "Connection error. Please check your internet connection and try again."

### Flow 2: Link GitHub Repository (Link to Existing Project)

**Trigger:** User clicks "Add Project" → "Import from GitHub"

**Steps:**

1-8. **Same as Flow 1** (OAuth authorization and repository selection)
9. **User:** Selects repository from dropdown
10. **User:** Chooses "Link to existing Project" → Selects Project from dropdown (e.g., "RecipeApp")
11. **System:** Links repository to selected Project
12. **System:** Creates `.abyrith` marker file in repository
13. **System:** Stores `organization_id` as repository variable
14. **User:** Sees Project with "GitHub" badge

**Success Criteria:** Repository linked to existing Project, marker file created, ready for secret import

**Error Cases:**

- **Project already has linked repository** → System shows message: "This Project is already linked to repository '[repo-name]'. Unlink the existing repository first."
- **All other errors same as Flow 1**

### Flow 3: Import Secrets from Repository

**Trigger:** User opens Project with linked repository → "Sync from GitHub"

**Steps:**

1. **User:** Opens Project dashboard, clicks "Sync from GitHub" button
2. **System:** Shows loading indicator: "Scanning repository for secrets..."
3. **System:** Fetches repository contents:
   - Scans for .env files (`.env`, `.env.local`, `.env.example`, `.env.production`, `.env.staging`, etc.)
   - Retrieves GitHub Actions secrets (read-only)
   - Analyzes dependencies (package.json, requirements.txt, Gemfile, etc.)
4. **System:** Parses discovered files, extracts secrets, detects patterns
5. **System:** Displays import preview:
   ```
   Found 23 secrets to import:

   .env (8 secrets) → Development
   - STRIPE_SECRET_KEY=sk_test_***
   - OPENAI_API_KEY=sk-***
   - DATABASE_URL=postgresql://***
   - [5 more...]

   .env.production (6 secrets) → Production
   - STRIPE_SECRET_KEY=sk_live_***
   - DATABASE_URL=postgresql://***
   - [4 more...]

   GitHub Actions (3 secrets) → CI/CD
   - DEPLOY_TOKEN
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY

   Suggested (from dependencies):
   - SENDGRID_API_KEY (detected @sendgrid/mail in package.json)
   - CLOUDFLARE_API_TOKEN (detected wrangler.toml)
   ```
6. **User:** Reviews preview, adjusts environment mappings if needed
7. **System:** Detects collisions: "3 secrets already exist in this Project. How should we handle them?"
8. **User:** Chooses collision strategy for each:
   - **Skip:** Keep existing secret, don't import new one
   - **Overwrite:** Replace existing secret with imported value
   - **Rename:** Import as "STRIPE_SECRET_KEY_IMPORTED"
9. **User:** Clicks "Import Secrets"
10. **System:** Encrypts each secret client-side (browser) using envelope encryption
11. **System:** Stores encrypted secrets in database with origin tag: "GitHub"
12. **System:** Logs import operation in audit log
13. **System:** Shows success message: "Successfully imported 20 secrets (3 skipped due to collisions)"
14. **User:** Sees imported secrets in Project with "GitHub" origin badge

**Success Criteria:** All selected secrets imported, encrypted, tagged with GitHub origin, audit log created

**Error Cases:**

- **GitHub token expired** → System shows message: "GitHub authorization expired. Please re-authorize to sync secrets." Provides "Re-authorize" button.
- **Repository access revoked** → System shows message: "Abyrith no longer has access to this repository. Please check GitHub app permissions or re-authorize."
- **File parsing error** → System shows message: "Unable to parse .env file (line 5: invalid format). Skipping this file. Other secrets will still import."
- **Dependency detection fails** → System logs warning, continues without suggestions
- **Encryption key unavailable** → System shows message: "Master password required to encrypt secrets. Please enter your master password to continue." (Session expired scenario)

### Flow 4: Unlink Repository

**Trigger:** User opens Project settings → "Unlink GitHub repository"

**Steps:**

1. **User:** Project settings → "Connected Services" → "GitHub" → "Unlink"
2. **System:** Shows confirmation dialog:
   ```
   Unlink GitHub Repository?

   This will:
   - Remove the .abyrith marker file from your repository
   - Delete the GitHub connection from Abyrith
   - Stop future sync operations

   This will NOT:
   - Delete existing secrets imported from GitHub
   - Revoke GitHub OAuth authorization

   Are you sure you want to unlink?
   ```
3. **User:** Clicks "Yes, Unlink"
4. **System:** Deletes `.abyrith` marker file from repository (GitHub API call)
5. **System:** Deletes repository variable with `organization_id` (GitHub API call)
6. **System:** Removes connection record from `github_connections` table
7. **System:** Logs unlink operation in audit log
8. **System:** Shows success message: "Repository unlinked. Your existing secrets remain in Abyrith."
9. **User:** GitHub badge removed from Project, "Import from GitHub" option available again

**Success Criteria:** Repository unlinked, marker file removed, connection deleted, existing secrets preserved

**Error Cases:**

- **Marker file already deleted** → System continues silently, logs warning (not critical)
- **GitHub API error** → System shows message: "Unable to remove marker file from GitHub. Connection removed from Abyrith, but you may need to manually delete .abyrith file from your repository."
- **User lacks permissions** → System shows message: "You need 'Owner' or 'Admin' role to unlink repositories."

---

## Technical Implementation

### Frontend Implementation

**Components:**

- `GitHubOAuthButton.tsx` - Initiates OAuth flow, handles callback
- `RepositorySelector.tsx` - Dropdown for selecting GitHub repositories
- `ImportPreview.tsx` - Displays discovered secrets, environment mappings, collision handling
- `CollisionResolver.tsx` - UI for resolving secret name collisions (skip/overwrite/rename)
- `GitHubBadge.tsx` - Displays "Connected to GitHub" badge on Projects
- `UnlinkConfirmationDialog.tsx` - Confirmation modal for unlinking repositories

**State Management:**

- **Local state:**
  - OAuth callback state
  - Selected repository
  - Import configuration (environment mappings, collision strategies)
  - Loading states for API calls

- **Global state (Zustand):**
  - GitHub connection status per Project
  - Cached repository list (invalidated on OAuth re-authorization)

- **Server state (React Query):**
  - GitHub repositories (fetched via Abyrith API)
  - Import preview data
  - Connection status

**Key Functions:**

```typescript
// Initiate GitHub OAuth flow
async function initiateGitHubAuth(): Promise<void> {
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store code verifier in sessionStorage for callback
  sessionStorage.setItem('github_code_verifier', codeVerifier);

  // Redirect to GitHub OAuth authorization URL
  const authUrl = buildGitHubAuthUrl(codeChallenge);
  window.location.href = authUrl;
}

// Handle OAuth callback
async function handleGitHubCallback(code: string): Promise<void> {
  // Retrieve code verifier from sessionStorage
  const codeVerifier = sessionStorage.getItem('github_code_verifier');

  // Exchange code for access token via Abyrith API
  const response = await api.post('/github/oauth/callback', {
    code,
    codeVerifier
  });

  // Clear code verifier
  sessionStorage.removeItem('github_code_verifier');

  // Redirect to repository selection
  router.push('/projects/new?step=github-repo');
}

// Fetch user's GitHub repositories
async function fetchGitHubRepositories(): Promise<Repository[]> {
  // API call to Abyrith backend, which uses stored GitHub token
  const response = await api.get('/github/repositories');
  return response.data.repositories;
}

// Preview secrets to import
async function previewSecretImport(
  repositoryId: string
): Promise<ImportPreview> {
  const response = await api.post('/github/repositories/preview', {
    repositoryId
  });

  return {
    envFiles: response.data.envFiles,
    actionsSecrets: response.data.actionsSecrets,
    suggestedSecrets: response.data.suggestedSecrets,
    collisions: response.data.collisions
  };
}

// Import secrets from GitHub
async function importSecrets(
  repositoryId: string,
  config: ImportConfiguration
): Promise<ImportResult> {
  // Encrypt secrets client-side before sending to backend
  const encryptedSecrets = await Promise.all(
    config.selectedSecrets.map(secret => encryptSecret(secret))
  );

  const response = await api.post('/github/repositories/import', {
    repositoryId,
    secrets: encryptedSecrets,
    environmentMappings: config.environmentMappings,
    collisionStrategies: config.collisionStrategies
  });

  return response.data;
}

// Client-side secret encryption (uses envelope encryption)
async function encryptSecret(secret: PlainSecret): Promise<EncryptedSecret> {
  // Derive KEK from user's master password (cached in memory during session)
  const kek = await deriveKEK(masterPassword, kekSalt);

  // Generate unique DEK for this secret
  const dek = generateDEK();

  // Encrypt secret value with DEK
  const { encrypted: encryptedValue, nonce: secretNonce, authTag } =
    await aesGcmEncrypt(secret.value, dek);

  // Encrypt DEK with KEK
  const { encrypted: encryptedDek, nonce: dekNonce } =
    await aesGcmEncrypt(dek, kek);

  return {
    name: secret.name,
    encryptedValue,
    encryptedDek,
    secretNonce,
    dekNonce,
    authTag,
    environment: secret.environment,
    origin: 'github'
  };
}
```

### Backend Implementation

**API Endpoints:**

- `POST /github/oauth/callback` - Exchange authorization code for access token
- `GET /github/repositories` - List user's GitHub repositories
- `POST /github/repositories/link` - Link repository to Project
- `POST /github/repositories/preview` - Preview secrets to import
- `POST /github/repositories/import` - Import secrets from repository
- `DELETE /github/repositories/:id/unlink` - Unlink repository from Project
- `GET /github/connections/:projectId` - Get GitHub connection status for Project

**Cloudflare Workers:**

- `github-oauth-handler.ts` - Handles OAuth token exchange and storage
- `github-import-worker.ts` - Orchestrates secret import (fetch, parse, store)
- `github-sync-worker.ts` - Handles repository content retrieval and analysis

**Key Backend Functions:**

```typescript
// Exchange OAuth code for access token
async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<GitHubToken> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier
    })
  });

  const data = await response.json();
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope
  };
}

// Encrypt and store GitHub token
async function storeGitHubToken(
  userId: string,
  organizationId: string,
  token: string
): Promise<void> {
  // Retrieve user's KEK (derived from master password)
  const kek = await getUserKEK(userId);

  // Encrypt token using envelope encryption
  const { encryptedValue, encryptedDek, nonces } =
    await envelopeEncrypt(token, kek);

  // Store in database with RLS enforcement
  await supabase
    .from('github_connections')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      encrypted_token: encryptedValue,
      encrypted_dek: encryptedDek,
      token_nonce: nonces.secretNonce,
      dek_nonce: nonces.dekNonce,
      created_at: new Date().toISOString()
    });
}

// Fetch repository contents
async function fetchRepositoryContents(
  repositoryFullName: string,
  token: string
): Promise<RepositoryContents> {
  const octokit = new Octokit({ auth: token });

  // Fetch .env files
  const envFiles = await findEnvFiles(octokit, repositoryFullName);

  // Fetch GitHub Actions secrets (read-only)
  const actionsSecrets = await fetchActionsSecrets(octokit, repositoryFullName);

  // Fetch dependency files for analysis
  const dependencyFiles = await fetchDependencyFiles(octokit, repositoryFullName);

  return { envFiles, actionsSecrets, dependencyFiles };
}

// Parse .env file
function parseEnvFile(content: string): EnvSecret[] {
  const lines = content.split('\n');
  const secrets: EnvSecret[] = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    // Parse KEY=VALUE format
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      secrets.push({
        name: match[1],
        value: match[2].trim().replace(/^["']|["']$/g, '') // Remove quotes
      });
    }
  }

  return secrets;
}

// Detect needed API keys from dependencies
function detectNeededAPIKeys(dependencyFile: DependencyFile): SuggestedSecret[] {
  const suggestions: SuggestedSecret[] = [];

  // Pattern matching for common services
  const patterns = [
    { pattern: /@stripe\/stripe-js|stripe/i, service: 'Stripe', key: 'STRIPE_SECRET_KEY' },
    { pattern: /@sendgrid\/mail/i, service: 'SendGrid', key: 'SENDGRID_API_KEY' },
    { pattern: /openai/i, service: 'OpenAI', key: 'OPENAI_API_KEY' },
    { pattern: /firebase/i, service: 'Firebase', key: 'FIREBASE_API_KEY' },
    // ... more patterns
  ];

  for (const { pattern, service, key } of patterns) {
    if (dependencyFile.content.match(pattern)) {
      suggestions.push({ service, key, confidence: 0.9 });
    }
  }

  return suggestions;
}

// Create .abyrith marker file
async function createMarkerFile(
  octokit: Octokit,
  repositoryFullName: string,
  projectId: string
): Promise<void> {
  const markerContent = {
    version: '1.0',
    created_at: new Date().toISOString(),
    project_ref: projectId // Anonymous UUID, not sensitive
  };

  await octokit.repos.createOrUpdateFileContents({
    owner: repositoryFullName.split('/')[0],
    repo: repositoryFullName.split('/')[1],
    path: '.abyrith',
    message: 'Add Abyrith project reference',
    content: Buffer.from(JSON.stringify(markerContent, null, 2)).toString('base64')
  });
}

// Store organization_id as repository variable (private)
async function storeRepositoryVariable(
  octokit: Octokit,
  repositoryFullName: string,
  organizationId: string
): Promise<void> {
  await octokit.actions.createOrUpdateRepoVariable({
    owner: repositoryFullName.split('/')[0],
    repo: repositoryFullName.split('/')[1],
    variable_name: 'ABYRITH_ORG_ID',
    value: organizationId
  });
}
```

### Database Implementation

**Tables Used:**

- `github_connections` - Stores encrypted GitHub tokens and repository metadata
  ```sql
  CREATE TABLE github_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    repository_full_name TEXT NOT NULL, -- e.g., "jane-dev/recipe-app"
    repository_id INTEGER NOT NULL,     -- GitHub's numeric repository ID
    encrypted_token TEXT NOT NULL,      -- Encrypted GitHub OAuth token
    encrypted_dek TEXT NOT NULL,        -- Encrypted DEK for token
    token_nonce TEXT NOT NULL,          -- Nonce for token encryption
    dek_nonce TEXT NOT NULL,            -- Nonce for DEK encryption
    marker_file_sha TEXT,               -- SHA of .abyrith file (for updates)
    last_synced_at TIMESTAMPTZ,         -- Last successful import
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(repository_id, organization_id)
  );
  ```

- `secrets` - Existing table, extended with GitHub origin metadata
  ```sql
  -- Origin metadata stored in JSONB metadata column:
  {
    "origin": "github",
    "source_file": ".env.production",
    "repository": "jane-dev/recipe-app",
    "imported_at": "2025-11-04T12:00:00Z"
  }
  ```

**Key Queries:**

```sql
-- Get GitHub connection for a Project
SELECT
  gc.id,
  gc.repository_full_name,
  gc.last_synced_at,
  gc.created_at
FROM github_connections gc
WHERE gc.project_id = $1
  AND gc.organization_id = $2; -- RLS enforces this

-- Check if repository is already linked
SELECT EXISTS (
  SELECT 1
  FROM github_connections
  WHERE repository_id = $1
    AND organization_id = $2
) AS is_linked;

-- Get secrets imported from GitHub
SELECT
  s.id,
  s.name,
  s.environment,
  s.metadata->>'origin' AS origin,
  s.metadata->>'source_file' AS source_file,
  s.created_at
FROM secrets s
WHERE s.project_id = $1
  AND s.metadata->>'origin' = 'github'
ORDER BY s.created_at DESC;

-- Audit log for GitHub operations
INSERT INTO audit_logs (
  organization_id,
  user_id,
  action,
  resource_type,
  resource_id,
  metadata,
  created_at
) VALUES (
  $1, $2, 'github.import', 'secrets', $3,
  jsonb_build_object(
    'repository', $4,
    'secret_count', $5,
    'source_files', $6
  ),
  now()
);
```

**RLS Policies:**

```sql
-- Only organization members can access connections
CREATE POLICY github_connections_organization_access ON github_connections
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Only users with appropriate roles can link/unlink
CREATE POLICY github_connections_link_unlink ON github_connections
  FOR INSERT, DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = github_connections.organization_id
        AND om.role IN ('Owner', 'Admin')
    )
  );
```

---

## API Contracts

### Endpoint: POST /github/oauth/callback

**Purpose:** Exchange GitHub OAuth authorization code for access token

**Request:**
```typescript
interface GitHubOAuthCallbackRequest {
  code: string;           // Authorization code from GitHub
  codeVerifier: string;   // PKCE code verifier
}
```

**Example Request:**
```json
{
  "code": "a1b2c3d4e5f6g7h8",
  "codeVerifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

**Response (Success - 200):**
```typescript
interface GitHubOAuthCallbackResponse {
  success: boolean;
  message: string;
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "GitHub account connected successfully"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid authorization code or code verifier
  ```json
  {
    "error": "invalid_code",
    "message": "GitHub authorization code is invalid or expired"
  }
  ```
- `401 Unauthorized` - Missing authentication token
- `500 Internal Server Error` - GitHub API error

---

### Endpoint: GET /github/repositories

**Purpose:** List user's GitHub repositories

**Request:** No body, authentication via JWT header

**Response (Success - 200):**
```typescript
interface GitHubRepositoriesResponse {
  repositories: Repository[];
}

interface Repository {
  id: number;              // GitHub's numeric ID
  fullName: string;        // "owner/repo"
  name: string;            // "repo"
  owner: string;           // "owner"
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  updatedAt: string;       // ISO 8601
}
```

**Example Response:**
```json
{
  "repositories": [
    {
      "id": 123456789,
      "fullName": "jane-dev/recipe-app",
      "name": "recipe-app",
      "owner": "jane-dev",
      "description": "A recipe sharing application",
      "isPrivate": true,
      "defaultBranch": "main",
      "updatedAt": "2025-11-01T10:30:00Z"
    }
  ]
}
```

**Error Responses:**

- `401 Unauthorized` - No GitHub token found or token expired
- `403 Forbidden` - GitHub token revoked
- `429 Too Many Requests` - GitHub API rate limit exceeded
- `500 Internal Server Error` - Server error

---

### Endpoint: POST /github/repositories/preview

**Purpose:** Preview secrets to import from repository

**Request:**
```typescript
interface PreviewImportRequest {
  repositoryId: number;  // GitHub repository ID
}
```

**Example Request:**
```json
{
  "repositoryId": 123456789
}
```

**Response (Success - 200):**
```typescript
interface PreviewImportResponse {
  envFiles: EnvFilePreview[];
  actionsSecrets: ActionsSecretPreview[];
  suggestedSecrets: SuggestedSecretPreview[];
  collisions: CollisionPreview[];
}

interface EnvFilePreview {
  fileName: string;
  secretCount: number;
  secrets: { name: string; valueMasked: string }[];
  suggestedEnvironment: 'development' | 'staging' | 'production';
}

interface ActionsSecretPreview {
  name: string;
  createdAt: string;
}

interface SuggestedSecretPreview {
  service: string;
  keyName: string;
  confidence: number;
  reason: string;
}

interface CollisionPreview {
  name: string;
  environment: string;
  existingValueMasked: string;
  newValueMasked: string;
}
```

**Example Response:**
```json
{
  "envFiles": [
    {
      "fileName": ".env",
      "secretCount": 8,
      "secrets": [
        { "name": "STRIPE_SECRET_KEY", "valueMasked": "sk_test_***" },
        { "name": "OPENAI_API_KEY", "valueMasked": "sk-***" }
      ],
      "suggestedEnvironment": "development"
    }
  ],
  "actionsSecrets": [
    { "name": "DEPLOY_TOKEN", "createdAt": "2025-10-15T08:00:00Z" }
  ],
  "suggestedSecrets": [
    {
      "service": "SendGrid",
      "keyName": "SENDGRID_API_KEY",
      "confidence": 0.9,
      "reason": "Detected @sendgrid/mail in package.json"
    }
  ],
  "collisions": [
    {
      "name": "DATABASE_URL",
      "environment": "production",
      "existingValueMasked": "postgresql://***@prod.db",
      "newValueMasked": "postgresql://***@github.db"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request` - Invalid repository ID
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - No access to repository
- `404 Not Found` - Repository not found
- `500 Internal Server Error` - Server error

---

### Endpoint: POST /github/repositories/import

**Purpose:** Import secrets from GitHub repository

**Request:**
```typescript
interface ImportSecretsRequest {
  repositoryId: number;
  projectId: string;
  secrets: EncryptedSecretImport[];
  environmentMappings: Record<string, string>;  // fileName -> environment
  collisionStrategies: Record<string, 'skip' | 'overwrite' | 'rename'>;
  createMarker: boolean;
}

interface EncryptedSecretImport {
  name: string;
  encryptedValue: string;
  encryptedDek: string;
  secretNonce: string;
  dekNonce: string;
  authTag: string;
  environment: string;
  sourceFile: string;
}
```

**Example Request:**
```json
{
  "repositoryId": 123456789,
  "projectId": "proj_abc123",
  "secrets": [
    {
      "name": "STRIPE_SECRET_KEY",
      "encryptedValue": "encrypted_base64_data",
      "encryptedDek": "encrypted_base64_dek",
      "secretNonce": "nonce_base64",
      "dekNonce": "dek_nonce_base64",
      "authTag": "auth_tag_base64",
      "environment": "development",
      "sourceFile": ".env"
    }
  ],
  "environmentMappings": {
    ".env": "development",
    ".env.production": "production"
  },
  "collisionStrategies": {
    "DATABASE_URL": "overwrite"
  },
  "createMarker": true
}
```

**Response (Success - 201):**
```typescript
interface ImportSecretsResponse {
  success: boolean;
  imported: number;
  skipped: number;
  overwritten: number;
  renamed: number;
  markerCreated: boolean;
  auditLogId: string;
}
```

**Example Response:**
```json
{
  "success": true,
  "imported": 17,
  "skipped": 3,
  "overwritten": 1,
  "renamed": 0,
  "markerCreated": true,
  "auditLogId": "audit_xyz789"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid secret data or encryption
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `409 Conflict` - Repository already linked to another Project
- `500 Internal Server Error` - Server error

---

### Endpoint: DELETE /github/repositories/:id/unlink

**Purpose:** Unlink GitHub repository from Project

**Path Parameters:**
- `id` (string) - GitHub connection ID

**Response (Success - 200):**
```typescript
interface UnlinkRepositoryResponse {
  success: boolean;
  message: string;
  markerDeleted: boolean;
  variableDeleted: boolean;
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Repository unlinked successfully",
  "markerDeleted": true,
  "variableDeleted": true
}
```

**Error Responses:**

- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions (need Owner or Admin role)
- `404 Not Found` - Connection not found
- `500 Internal Server Error` - Server error

---

## Security Considerations

### Threat Model

**Threat 1: GitHub Token Exposure**
- **Description:** Attacker gains access to GitHub OAuth token, allowing repository access
- **Likelihood:** Medium (if token storage or transmission is insecure)
- **Impact:** High (attacker can read all repository contents, including .env files)
- **Mitigation:**
  - Encrypt GitHub tokens using envelope encryption with user's KEK
  - Store encrypted tokens in database with RLS policies
  - Never transmit tokens to frontend
  - Tokens automatically expire after GitHub's configured lifetime
  - Support token revocation via GitHub settings

**Threat 2: Sensitive Data in .abyrith Marker File**
- **Description:** .abyrith file contains sensitive data that should not be in public repositories
- **Likelihood:** Low (by design, marker file contains only anonymous UUID)
- **Impact:** Low (UUID alone reveals no sensitive information)
- **Mitigation:**
  - .abyrith file contains ONLY: version, created_at timestamp, anonymous project UUID
  - NO organization ID, NO user data, NO secret references
  - File is public-safe by design
  - Documentation emphasizes this file is safe to commit

**Threat 3: Repository Variable Exposure**
- **Description:** Organization ID stored as repository variable could leak if repository becomes public
- **Likelihood:** Low (variables are private by default in GitHub)
- **Impact:** Medium (organization ID alone doesn't grant access, but could be used for reconnaissance)
- **Mitigation:**
  - Repository variables are private by default in GitHub (not visible in git history)
  - Even if exposed, organization ID requires authentication to access data
  - RLS policies enforce organization-level isolation
  - Audit logs capture all operations for forensic analysis

**Threat 4: Malicious .env File Injection**
- **Description:** Attacker commits malicious .env file to repository, which gets imported
- **Likelihood:** Low (requires repository write access)
- **Impact:** Medium (malicious secrets could be imported, but encrypted)
- **Mitigation:**
  - Import is user-initiated, not automatic
  - Preview step shows all secrets before import
  - User must explicitly confirm import
  - Secrets are still encrypted with user's master key
  - Audit logs capture who imported what and when
  - Cannot overwrite existing secrets without explicit collision resolution

**Threat 5: GitHub Actions Secret Enumeration**
- **Description:** Attacker uses secret name enumeration to discover what services are used
- **Likelihood:** Medium (secret names are visible in import preview)
- **Impact:** Low (names alone don't reveal values, but could guide further attacks)
- **Mitigation:**
  - Import preview only shows names, not values (values are masked: "sk_test_***")
  - Requires authenticated Abyrith account to see preview
  - RLS policies enforce organization isolation
  - Audit logs capture all access

### Security Controls

**Authentication:**
- GitHub OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Abyrith JWT authentication for all API calls
- GitHub tokens stored encrypted, never transmitted to frontend
- Session-based master password caching for encryption operations

**Authorization:**
- Only "Owner" and "Admin" roles can link/unlink repositories
- RLS policies enforce organization-level data isolation
- GitHub OAuth scopes limited to read-only repository access (no write permissions)
- Project-level permissions inherited from Abyrith RBAC model

**Data Protection:**
- **GitHub tokens encrypted at rest:** Envelope encryption (DEK + KEK)
- **Secrets encrypted client-side:** Browser encrypts secrets before sending to backend
- **TLS in transit:** All API calls over HTTPS
- **.abyrith marker file:** Contains only anonymous UUID (public-safe)
- **Repository variable:** Private by default in GitHub, not in git history

**Audit Logging:**
- All GitHub operations logged: OAuth authorization, repository linking, secret import, unlinking
- Audit logs capture: user ID, organization ID, repository name, secret count, source files
- Logs stored with RLS enforcement, accessible only to organization members
- Retention policy: 90 days (configurable per enterprise requirements)

### Compliance

**GDPR:**
- User consent required for GitHub OAuth (explicit authorization flow)
- GitHub tokens can be deleted via account deletion or manual unlink
- Audit logs support data export and deletion requests
- .abyrith marker file contains no personal data

**SOC 2:**
- Comprehensive audit logs for all GitHub operations
- Encryption at rest and in transit
- Access controls enforced via RLS and RBAC
- Automated security scanning for vulnerabilities (GitHub Dependabot, Snyk)

---

## Performance Requirements

### Performance Targets

- **GitHub OAuth Flow:** < 3s for token exchange (p95)
- **Repository List Fetch:** < 2s to load user's repositories (p95)
- **Import Preview:** < 5s to scan repository and generate preview (p95)
- **Secret Import:** < 10s to import 50 secrets (p95)
- **Marker File Creation:** < 2s to create .abyrith file and repository variable (p95)

### Optimization Strategy

**Frontend:**
- Lazy-load repository list (pagination if > 100 repositories)
- Cache repository list in React Query (5-minute TTL)
- Optimistic UI updates for import operations
- Web Worker for client-side secret encryption (parallelized)
- Debounce collision strategy selection to avoid excessive re-renders

**Backend:**
- Cache GitHub API responses in Cloudflare Workers KV (10-minute TTL)
- Parallel fetching of .env files and GitHub Actions secrets
- Batch secret inserts to database (50 at a time)
- Lazy-load dependency analysis (only analyze if user opts in)
- Stream large .env files instead of loading entirely into memory

**Database:**
- Index on `github_connections.repository_id` for collision detection
- Index on `secrets.project_id` and `secrets.metadata->>'origin'` for import preview
- Batch inserts with single transaction for atomicity
- Connection pooling via PgBouncer (Supabase built-in)

### Load Handling

**Expected Load:**
- Concurrent imports: 10 users importing simultaneously
- Peak repository list requests: 50 requests/minute
- Average secrets per import: 20 secrets

**Scalability:**
- Cloudflare Workers auto-scale globally (edge compute)
- Supabase database can scale vertically (increase compute)
- GitHub API rate limits: 5,000 requests/hour (authenticated)
- If rate limit approached: queue import requests, show estimated wait time

**Bottlenecks:**
- GitHub API rate limit (5,000 req/hr per user)
- Client-side encryption (CPU-bound in browser, mitigated with Web Workers)
- Database write throughput (mitigated with batch inserts)

---

## Testing Strategy

### Unit Tests

**Frontend:**
- Test: OAuth callback handler correctly extracts code and exchanges for token
- Test: Repository selector filters and sorts repositories correctly
- Test: Collision resolver applies correct strategy (skip/overwrite/rename)
- Test: Client-side encryption produces valid encrypted output
- Coverage: 80%+ for critical components

**Backend:**
- Test: .env file parser correctly extracts KEY=VALUE pairs
- Test: Dependency analyzer detects API keys from package.json
- Test: Envelope encryption/decryption round-trips successfully
- Test: Collision detection identifies existing secrets
- Coverage: 90%+ for import logic

### Integration Tests

**Test Scenarios:**

1. **End-to-End Import Flow:**
   - Create test GitHub repository with .env file
   - Link repository to test Project
   - Import secrets
   - Verify secrets stored correctly in database
   - Verify .abyrith marker file created
   - Verify audit log entry

2. **Collision Handling:**
   - Create Project with existing secret "DATABASE_URL"
   - Import .env with conflicting "DATABASE_URL"
   - Test skip strategy (existing secret unchanged)
   - Test overwrite strategy (existing secret replaced)
   - Test rename strategy (new secret created as "DATABASE_URL_IMPORTED")

3. **GitHub Token Expiration:**
   - Mock expired GitHub token
   - Attempt import
   - Verify error message prompts re-authorization
   - Re-authorize and retry import

4. **Rate Limit Handling:**
   - Mock GitHub API rate limit response
   - Verify graceful error message with retry time
   - Verify import queues for retry

### End-to-End Tests (Playwright)

**E2E Flows:**

1. **Happy Path: Link Repo and Import Secrets:**
   - User navigates to "Add Project" → "Import from GitHub"
   - Authorizes GitHub (mocked OAuth flow)
   - Selects repository
   - Creates new Project
   - Reviews import preview
   - Confirms import
   - Verifies secrets appear in Project dashboard

2. **Unlink Repository:**
   - User navigates to Project settings
   - Clicks "Unlink GitHub repository"
   - Confirms unlink
   - Verifies GitHub badge removed
   - Verifies existing secrets remain

3. **Collision Resolution:**
   - User imports secrets with collisions
   - Selects collision strategies
   - Verifies correct strategy applied

### Security Tests

**Security Test Cases:**

1. **Encrypted Token Storage:**
   - Import secrets
   - Query database directly
   - Verify GitHub token is encrypted (not plaintext)
   - Verify cannot decrypt without user's KEK

2. **.abyrith Marker File Safety:**
   - Inspect .abyrith file contents
   - Verify no sensitive data (only UUID, version, timestamp)
   - Verify safe to commit to public repository

3. **RLS Policy Enforcement:**
   - User A imports secrets to their Project
   - User B (different organization) attempts to access
   - Verify User B cannot see User A's GitHub connections or secrets

4. **OAuth Scope Limitation:**
   - Inspect GitHub OAuth scopes
   - Verify read-only repository access (no write permissions)
   - Verify cannot modify repository or push code

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**

- [x] `03-security/security-model.md` - Encryption specifications (envelope encryption)
- [x] `02-architecture/system-overview.md` - System architecture
- [ ] `04-database/schemas/github-connections.md` - Database schema for GitHub connections (⚠️ Does not exist yet)
- [ ] `05-api/endpoints/github-endpoints.md` - API endpoint specifications (⚠️ Does not exist yet)
- [ ] `06-backend/integrations/github-api-integration.md` - GitHub API client implementation (⚠️ Does not exist yet)

**External Services:**

- **GitHub API** - Repository access, OAuth, GitHub Actions secrets, repository variables
- **GitHub OAuth App** - Application registration for OAuth flows

**GitHub App Configuration:**

```yaml
# GitHub OAuth App Settings (to be created)
Application name: Abyrith Secrets
Homepage URL: https://abyrith.com
Authorization callback URL: https://abyrith.com/api/github/oauth/callback
Requested OAuth scopes:
  - repo (read-only repository access)
  - read:org (read organization membership, for enterprise features)
```

### Feature Dependencies

**Depends on these features:**

- **Project Management** - Projects must exist to link repositories
- **Zero-Knowledge Vault** - Encryption system required for token and secret storage
- **Audit Logs** - All GitHub operations must be logged

**Enables these features:**

- **CLI Tool** - CLI can use `.abyrith` marker to auto-detect Projects
- **AI Assistant** - AI can suggest secrets based on repository dependencies
- **Usage Tracking** - Track which secrets are used by which repositories
- **Dependency Monitoring** - Notify users when dependencies change (new API keys needed)

---

## Future Enhancements

### Post-MVP Features

1. **Bidirectional Sync (Abyrith → GitHub Actions):**
   - Push secrets TO GitHub Actions (with approval workflow)
   - Sync secret updates from Abyrith to GitHub
   - Encryption: Secrets encrypted by GitHub Actions (not zero-knowledge), with user consent

2. **AI Chat with Repository Context:**
   - AI reads repository code to suggest needed secrets
   - AI detects hardcoded secrets in commits (security scanning)
   - AI generates setup instructions based on repository structure

3. **Webhook Monitoring:**
   - Detect changes to .env files in repository
   - Notify team when .env files are modified
   - Suggest re-importing secrets

4. **Security Scanning:**
   - Scan commit history for accidentally committed secrets
   - Alert if secrets are found in git history
   - Provide remediation steps (git filter-branch, BFG Repo-Cleaner)

5. **Branch-Specific Environments:**
   - Map branches to Abyrith environments (main → production, develop → staging)
   - Auto-select environment based on current branch when using CLI

6. **Dependency Auto-Suggestions:**
   - AI detects new dependencies added to package.json
   - Suggests API key acquisition via AI Assistant
   - Proactive notification: "You added Stripe. Need an API key?"

7. **Continuous Sync:**
   - Automatically import new secrets when .env files change
   - Optional: Watch repository for changes (requires webhook)
   - User controls sync frequency (manual, daily, real-time)

8. **GitHub Enterprise Support:**
   - Support for self-hosted GitHub Enterprise instances
   - Custom OAuth endpoint configuration
   - Enterprise-specific features (SAML integration, IP allowlisting)

---

## Status

- **Version:** 1.0.0
- **Status:** Draft
- **Owner:** Engineering Team
- **Phase:** Phase 5 (Advanced Features) - Post-MVP
- **Priority:** P1 - High priority for post-MVP

---

## References

### Internal Documentation

- [`03-security/security-model.md`](/Users/james/code/secrets/03-security/security-model.md) - Encryption and zero-knowledge architecture
- [`02-architecture/system-overview.md`](/Users/james/code/secrets/02-architecture/system-overview.md) - System architecture
- `04-database/schemas/github-connections.md` - GitHub connections schema (to be created)
- `05-api/endpoints/github-endpoints.md` - GitHub API endpoints (to be created)
- `06-backend/integrations/github-api-integration.md` - GitHub API integration (to be created)
- [`TECH-STACK.md`](/Users/james/code/secrets/TECH-STACK.md) - Technology stack
- [`GLOSSARY.md`](/Users/james/code/secrets/GLOSSARY.md) - Term definitions

### External Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps) - OAuth flow and best practices
- [GitHub REST API](https://docs.github.com/en/rest) - Repository contents, GitHub Actions secrets, repository variables
- [Octokit.js](https://github.com/octokit/octokit.js) - GitHub API client for Node.js/TypeScript
- [PKCE for OAuth 2.0](https://oauth.net/2/pkce/) - Proof Key for Code Exchange specification
- [GitHub Actions Secrets API](https://docs.github.com/en/rest/actions/secrets) - Read-only access to GitHub Actions secrets
- [GitHub Repository Variables](https://docs.github.com/en/actions/learn-github-actions/variables#creating-configuration-variables-for-a-repository) - Store organization_id privately

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-04 | Engineering Team | Initial feature documentation for GitHub Repository Syncing |

---

## Notes

### Implementation Considerations

- **GitHub API Rate Limits:** 5,000 requests/hour per authenticated user. Implement caching and batch operations.
- **OAuth Security:** Use PKCE to prevent authorization code interception attacks.
- **Token Storage:** Encrypt tokens with envelope encryption (DEK + user's KEK). Never expose tokens to frontend.
- **.abyrith File:** Keep contents minimal and public-safe (only UUID). No sensitive data.
- **Repository Variable:** Private by default in GitHub, not in git history. Ideal for organization_id storage.
- **Import Performance:** Parallel fetching and batch inserts critical for large repositories (100+ secrets).
- **Dependency Detection:** Pattern matching in dependency files (package.json, requirements.txt, etc.). Not exhaustive, but helpful for common services.
- **Future Automation:** .abyrith marker enables CLI auto-detection and future webhook integrations.

### Known Limitations

- **Read-Only Sync:** MVP only supports GitHub → Abyrith (one-way). Bidirectional sync requires user consent and GitHub Actions encryption (not zero-knowledge).
- **GitHub Actions Secrets:** Can only read secret names, not values (GitHub API limitation). Values must be manually copied if needed.
- **Large Repositories:** Repositories with 1,000+ .env entries may require pagination or streaming to avoid memory issues.
- **GitHub Enterprise:** MVP targets GitHub.com. GitHub Enterprise support requires custom OAuth endpoints and testing.

### User Feedback Priorities

After MVP launch, gather feedback on:
1. Is the import preview clear and helpful?
2. Are collision resolution options intuitive?
3. Do users want bidirectional sync (Abyrith → GitHub Actions)?
4. Is dependency detection accurate? False positives/negatives?
5. How often do users re-import secrets? Would continuous sync be valuable?
