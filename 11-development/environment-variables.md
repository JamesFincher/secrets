---
Document: Environment Variables - Configuration Reference
Version: 1.0.0
Last Updated: 2025-11-02
Owner: DevOps Team
Status: Draft
Dependencies: TECH-STACK.md, 11-development/local-setup.md, 06-backend/cloudflare-workers/workers-architecture.md, 09-integrations/mcp/mcp-secrets-server.md, 09-integrations/firecrawl/firecrawl-integration.md
---

# Environment Variables - Configuration Reference

## Overview

This document provides a comprehensive reference for all environment variables required to run the Abyrith secrets management platform. It covers configuration for frontend (Next.js), backend (Cloudflare Workers), MCP server, database connections, and external API integrations.

**Purpose:** Centralized reference for all environment variable configuration across all Abyrith components.

**Audience:** Developers, DevOps engineers, system administrators

---

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Frontend Environment Variables (Next.js)](#frontend-environment-variables-nextjs)
3. [Backend Environment Variables (Cloudflare Workers)](#backend-environment-variables-cloudflare-workers)
4. [MCP Server Environment Variables](#mcp-server-environment-variables)
5. [Database Configuration (Supabase)](#database-configuration-supabase)
6. [External API Keys](#external-api-keys)
7. [Development Environment Setup](#development-environment-setup)
8. [Staging Environment Setup](#staging-environment-setup)
9. [Production Environment Setup](#production-environment-setup)
10. [Example Configuration Files](#example-configuration-files)
11. [Security Best Practices](#security-best-practices)
12. [Troubleshooting](#troubleshooting)
13. [References](#references)
14. [Change Log](#change-log)

---

## Environment Overview

### Environment Types

Abyrith uses three deployment environments:

| Environment | Purpose | Configuration File | Secrets Management |
|-------------|---------|-------------------|-------------------|
| **Development** | Local development | `.env.local` | Git-ignored file |
| **Staging** | Testing/QA | GitHub Secrets + Cloudflare | GitHub Actions |
| **Production** | Live platform | GitHub Secrets + Cloudflare | GitHub Actions |

### Configuration Strategy

**Frontend (Next.js):**
- `.env.local` file for local development
- Environment variables injected at build time
- Public variables prefixed with `NEXT_PUBLIC_`
- Private variables available only on server-side

**Backend (Cloudflare Workers):**
- `.dev.vars` file for local development (Wrangler)
- Cloudflare Workers secrets for staging/production
- Managed via `wrangler secret put` command
- Never committed to Git

**MCP Server:**
- `~/.abyrith/mcp-config.json` for configuration
- OS keychain for JWT storage (macOS Keychain, Windows Credential Manager)
- Environment variables for optional overrides

---

## Frontend Environment Variables (Next.js)

### Configuration File

**Location:** `frontend/.env.local` (development)

**Never commit this file to Git** - it's included in `.gitignore`

### Public Environment Variables

These variables are exposed to the browser (embedded in the JavaScript bundle).

#### NEXT_PUBLIC_APP_URL

**Description:** The public URL where the Abyrith frontend is hosted

**Required:** Yes

**Default:** None

**Examples:**
```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Staging
NEXT_PUBLIC_APP_URL=https://staging.abyrith.com

# Production
NEXT_PUBLIC_APP_URL=https://app.abyrith.com
```

**Usage:** Used for OAuth redirects, absolute URLs in emails, sitemap generation

**How to obtain:** Provided by your Cloudflare Pages deployment or local dev server

---

#### NEXT_PUBLIC_API_URL

**Description:** The API base URL for backend requests (Cloudflare Workers)

**Required:** Yes

**Default:** None

**Examples:**
```bash
# Development (local Workers)
NEXT_PUBLIC_API_URL=http://localhost:8787/api

# Development (staging API)
NEXT_PUBLIC_API_URL=https://api-staging.abyrith.com

# Staging
NEXT_PUBLIC_API_URL=https://api-staging.abyrith.com

# Production
NEXT_PUBLIC_API_URL=https://api.abyrith.com
```

**Usage:** Frontend makes all API requests to this base URL

**How to obtain:** Set up Cloudflare Workers custom domain or use localhost for development

---

#### NEXT_PUBLIC_SUPABASE_URL

**Description:** Supabase project URL for database and auth

**Required:** Yes

**Default:** None

**Examples:**
```bash
# Development/Staging
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co

# Production
NEXT_PUBLIC_SUPABASE_URL=https://xyzabcdefghijklm.supabase.co
```

**Usage:** Supabase client initialization, authentication, real-time subscriptions

**How to obtain:**
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy "Project URL"

**Security:** This URL is public and safe to expose

---

#### NEXT_PUBLIC_SUPABASE_ANON_KEY

**Description:** Supabase anonymous key for client-side database access with RLS

**Required:** Yes

**Default:** None

**Example:**
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Usage:** Client-side Supabase queries (Row-Level Security enforced)

**How to obtain:**
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy "anon public" key

**Security:** This key is public and safe to expose (protected by RLS policies)

---

#### NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY

**Description:** Cloudflare Turnstile site key for bot protection

**Required:** No (Optional - future enhancement)

**Default:** None

**Example:**
```bash
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAA...
```

**Usage:** Bot protection on signup/login forms

**How to obtain:**
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to Turnstile
3. Create new site
4. Copy site key

**Security:** This key is public

---

#### NEXT_PUBLIC_ENVIRONMENT

**Description:** Current environment name for debugging and feature flags

**Required:** Yes

**Default:** `development`

**Examples:**
```bash
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_ENVIRONMENT=production
```

**Usage:** Conditional features, debug logging, error reporting context

---

### Private Environment Variables

These variables are only available on the server-side (Next.js API routes, server components).

#### SUPABASE_SERVICE_ROLE_KEY

**Description:** Supabase service role key for bypassing RLS (admin operations)

**Required:** Yes (server-side only)

**Default:** None

**Example:**
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Usage:** Admin operations, migrations, bypassing RLS for system tasks

**How to obtain:**
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy "service_role secret" key

**Security:** ⚠️ **CRITICAL** - Never expose this key to the client. Keep server-side only.

---

#### ANTHROPIC_API_KEY

**Description:** Claude API key for AI Secret Assistant

**Required:** Yes (for AI features)

**Default:** None

**Example:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Usage:** AI conversation orchestration, guided acquisition flows

**How to obtain:**
1. Sign up at [Anthropic Console](https://console.anthropic.com)
2. Go to API Keys
3. Create new key
4. Copy and store securely

**Security:** ⚠️ **SENSITIVE** - Never commit to Git, rotate quarterly

---

#### FIRECRAWL_API_KEY

**Description:** FireCrawl API key for documentation scraping

**Required:** Yes (for AI research features)

**Default:** None

**Example:**
```bash
FIRECRAWL_API_KEY=fc_sk_...
```

**Usage:** Real-time API documentation scraping for guided acquisition

**How to obtain:**
1. Sign up at [FireCrawl](https://firecrawl.dev)
2. Go to API Keys section
3. Create new key
4. Copy and store securely

**Security:** ⚠️ **SENSITIVE** - Never commit to Git, rotate bi-annually

**Pricing:** 500 free credits/month, $19/month for 5,000 credits

---

#### SENTRY_DSN

**Description:** Sentry Data Source Name for error tracking

**Required:** No (Optional)

**Default:** None

**Example:**
```bash
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7654321
```

**Usage:** Frontend error tracking, performance monitoring

**How to obtain:**
1. Sign up at [Sentry](https://sentry.io)
2. Create new project (Next.js)
3. Copy DSN from project settings

**Security:** Can be public (limited information exposure)

**Pricing:** Free tier available, $26/month Team plan

---

### Next.js Framework Variables

#### NODE_ENV

**Description:** Node.js environment mode

**Required:** Yes (automatically set)

**Default:** `development` (auto)

**Valid values:** `development`, `production`, `test`

**Usage:** Enables React dev tools, verbose logging, hot reload in development

**Do not manually set** - Next.js sets this automatically

---

## Backend Environment Variables (Cloudflare Workers)

### Configuration File

**Development:** `.dev.vars` (Wrangler local development)

**Staging/Production:** Cloudflare Workers secrets (via `wrangler secret put`)

**Never commit `.dev.vars` to Git** - it's included in `.gitignore`

---

### Required Variables

#### SUPABASE_URL

**Description:** Supabase project URL for database access

**Required:** Yes

**Default:** None

**Example:**
```bash
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
```

**Usage:** Workers connect to Supabase for database operations

**How to obtain:** Same as `NEXT_PUBLIC_SUPABASE_URL` (from Supabase Dashboard)

---

#### SUPABASE_ANON_KEY

**Description:** Supabase anon key for RLS-protected database access

**Required:** Yes

**Default:** None

**Example:**
```bash
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Usage:** Workers use this + user JWT for database access (RLS enforced)

**How to obtain:** Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Security:** Public key, safe to use

---

#### BACKEND_ENCRYPTION_KEY

**Description:** Backend encryption key for encrypting DEKs in envelope encryption

**Required:** Yes

**Default:** None

**Example:**
```bash
BACKEND_ENCRYPTION_KEY=base64_encoded_256_bit_key_here...
```

**Usage:** Encrypting Data Encryption Keys (DEKs) before storing in database

**How to obtain:**
```bash
# Generate a secure 256-bit key
openssl rand -base64 32
```

**Security:** ⚠️ **CRITICAL**
- This is NOT the master key (user's master password derived key never transmitted)
- Only used for envelope encryption (encrypting DEKs)
- User secrets are ALWAYS encrypted client-side before transmission
- Rotate annually
- Store in Cloudflare Workers secrets
- Never commit to Git

**Important:** This maintains zero-knowledge architecture - backend never has access to unencrypted user secrets

---

#### ANTHROPIC_API_KEY

**Description:** Claude API key for AI orchestration

**Required:** Yes

**Default:** None

**Same as frontend ANTHROPIC_API_KEY** - Workers use this for AI conversations

---

#### FIRECRAWL_API_KEY

**Description:** FireCrawl API key for documentation scraping

**Required:** Yes

**Default:** None

**Same as frontend FIRECRAWL_API_KEY** - Workers use this for research

---

### Optional Variables

#### FIRECRAWL_ENDPOINT

**Description:** FireCrawl API endpoint URL

**Required:** No

**Default:** `https://api.firecrawl.dev/v0`

**Usage:** Override default FireCrawl endpoint (for testing or custom deployments)

---

#### FIRECRAWL_TIMEOUT

**Description:** FireCrawl request timeout in milliseconds

**Required:** No

**Default:** `30000` (30 seconds)

**Example:**
```bash
FIRECRAWL_TIMEOUT=60000
```

**Usage:** Increase for slow websites or complex scrapes

---

#### FIRECRAWL_MAX_RETRIES

**Description:** Maximum retry attempts for FireCrawl requests

**Required:** No

**Default:** `3`

**Example:**
```bash
FIRECRAWL_MAX_RETRIES=5
```

**Usage:** Adjust retry behavior for reliability vs. speed trade-off

---

#### FIRECRAWL_CACHE_TTL

**Description:** Cache TTL for FireCrawl responses in seconds

**Required:** No

**Default:** `86400` (24 hours)

**Example:**
```bash
FIRECRAWL_CACHE_TTL=172800  # 48 hours
```

**Usage:** Adjust caching duration for freshness vs. cost trade-off

---

#### SENTRY_DSN

**Description:** Sentry DSN for Workers error tracking

**Required:** No

**Default:** None

**Same as frontend SENTRY_DSN** - Workers send errors to same Sentry project

---

#### LOG_LEVEL

**Description:** Logging verbosity level

**Required:** No

**Default:** `info`

**Valid values:** `debug`, `info`, `warn`, `error`

**Examples:**
```bash
LOG_LEVEL=debug   # Development - verbose logging
LOG_LEVEL=info    # Staging - standard logging
LOG_LEVEL=warn    # Production - warnings and errors only
```

**Usage:** Control console log output verbosity

---

## MCP Server Environment Variables

### Configuration File

**Primary config:** `~/.abyrith/mcp-config.json`

**Environment overrides:** Environment variables (optional)

**JWT storage:** OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

---

### Required Variables

#### ABYRITH_API_URL

**Description:** Abyrith API endpoint for MCP server

**Required:** Yes

**Default:** None

**Examples:**
```bash
# Development
ABYRITH_API_URL=http://localhost:8787/api

# Staging
ABYRITH_API_URL=https://api-staging.abyrith.com

# Production
ABYRITH_API_URL=https://api.abyrith.com
```

**Usage:** MCP server connects to this API for secret operations

**How to obtain:** Set during `abyrith-mcp auth` command

**Stored in:** `~/.abyrith/mcp-config.json`

---

#### ABYRITH_PROJECT_ID

**Description:** Default project UUID for MCP operations

**Required:** Yes

**Default:** None

**Example:**
```bash
ABYRITH_PROJECT_ID=550e8400-e29b-41d4-a716-446655440000
```

**Usage:** Default project context for AI tool secret requests

**How to obtain:** Selected during `abyrith-mcp auth` command

**Stored in:** `~/.abyrith/mcp-config.json`

---

### Optional Variables

#### ABYRITH_APPROVAL_TIMEOUT

**Description:** Timeout for user approval requests in seconds

**Required:** No

**Default:** `300` (5 minutes)

**Example:**
```bash
ABYRITH_APPROVAL_TIMEOUT=600  # 10 minutes
```

**Usage:** How long MCP server waits for user approval before timing out

---

#### ABYRITH_LOG_LEVEL

**Description:** MCP server logging verbosity

**Required:** No

**Default:** `info`

**Valid values:** `debug`, `info`, `warn`, `error`

**Example:**
```bash
ABYRITH_LOG_LEVEL=debug
```

**Usage:** Troubleshooting MCP integration issues

---

#### ABYRITH_CACHE_TTL

**Description:** Approval cache TTL in seconds

**Required:** No

**Default:** `3600` (1 hour)

**Example:**
```bash
ABYRITH_CACHE_TTL=7200  # 2 hours
```

**Usage:** How long approved secrets stay cached before re-requesting approval

---

#### ABYRITH_DECRYPTION_METHOD

**Description:** Preferred decryption method

**Required:** No

**Default:** `auto`

**Valid values:** `auto`, `browser`, `cli`

**Examples:**
```bash
ABYRITH_DECRYPTION_METHOD=browser  # Always use browser
ABYRITH_DECRYPTION_METHOD=cli      # Always prompt for password
ABYRITH_DECRYPTION_METHOD=auto     # Try browser, fallback to CLI
```

**Usage:** Control how secrets are decrypted (browser WebSocket vs. CLI password prompt)

---

## Database Configuration (Supabase)

### Connection Details

**Database:** PostgreSQL 15.x (managed by Supabase)

**Connection:** Handled via Supabase client SDK (no direct connection string needed)

**Authentication:** JWT-based via Supabase Auth

---

### Required Variables (Already covered)

All Supabase configuration is provided via:
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

**No additional database environment variables required** - Supabase abstracts connection pooling, SSL, etc.

---

### Database Connection Strings (Advanced)

For direct database access (migrations, backups):

#### SUPABASE_DB_URL

**Description:** Direct PostgreSQL connection string

**Required:** No (only for advanced operations)

**Default:** None

**Example:**
```bash
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Usage:** Direct `psql` access, migration tools

**How to obtain:**
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Go to Project Settings → Database
3. Copy connection string
4. Replace `[password]` with your database password

**Security:** ⚠️ **CRITICAL** - Contains database password, never commit

**Use cases:**
- Running migrations locally with Supabase CLI
- Database backups
- Emergency direct access

---

## External API Keys

### Summary Table

| Service | Key Name | Required | Cost | Rotation Schedule |
|---------|----------|----------|------|-------------------|
| Claude API | `ANTHROPIC_API_KEY` | Yes | Pay-as-you-go | Bi-annually |
| FireCrawl | `FIRECRAWL_API_KEY` | Yes | 500 free/mo | Bi-annually |
| Supabase | `SUPABASE_ANON_KEY` | Yes | Free tier | Never (RLS protected) |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | Yes | Free tier | Annually |
| Sentry | `SENTRY_DSN` | No | Free tier | Annually |
| Cloudflare | Managed in dashboard | Yes | Free tier | Quarterly |

---

### Obtaining API Keys

#### 1. Anthropic (Claude API)

**Signup:** [console.anthropic.com](https://console.anthropic.com)

**Steps:**
1. Create account
2. Verify email
3. Add payment method
4. Go to API Keys
5. Create new key
6. Copy and store in password manager

**Initial credit:** $5 (usually)

**Pricing:** ~$0.003-0.06 per 1K tokens (model dependent)

---

#### 2. FireCrawl

**Signup:** [firecrawl.dev](https://firecrawl.dev)

**Steps:**
1. Create account
2. Verify email
3. Go to API Keys
4. Create new key
5. Copy and store securely

**Free tier:** 500 credits/month

**Pricing:** $19/month for 5,000 credits

---

#### 3. Supabase

**Signup:** [supabase.com](https://supabase.com)

**Steps:**
1. Create account
2. Create new project (provide name, password, region)
3. Wait ~2 minutes for provisioning
4. Go to Settings → API
5. Copy URL and keys

**Free tier:** 2 projects, 500MB database, 1GB bandwidth

**Pricing:** $25/month Pro plan for production

---

#### 4. Sentry (Optional)

**Signup:** [sentry.io](https://sentry.io)

**Steps:**
1. Create account
2. Create new project (Next.js)
3. Copy DSN from project settings

**Free tier:** 5,000 errors/month

**Pricing:** $26/month Team plan

---

#### 5. Cloudflare

**Signup:** [dash.cloudflare.com](https://dash.cloudflare.com)

**Steps:**
1. Create account
2. Add your domain (or use Workers.dev subdomain)
3. Create Cloudflare Pages project
4. Create Workers

**Free tier:** 100,000 requests/day

**Pricing:** $5/month Workers Paid plan

---

## Development Environment Setup

### Quick Setup (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/JamesFincher/secrets.git abyrith
cd abyrith/frontend

# 2. Copy environment template
cp .env.example .env.local

# 3. Edit .env.local with your values
code .env.local  # or nano, vim, etc.

# 4. Install dependencies
pnpm install

# 5. Start development server
pnpm dev

# Open http://localhost:3000
```

---

### Example .env.local (Development)

```bash
#################################################################
# Abyrith Frontend Environment Variables
# Development Environment
# Never commit this file to Git
#################################################################

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8787/api
NEXT_PUBLIC_ENVIRONMENT=development

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (Server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Services
ANTHROPIC_API_KEY=sk-ant-api03-...
FIRECRAWL_API_KEY=fc_sk_...

# Optional: Error Tracking
# SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7654321

# Optional: Bot Protection (future)
# NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAA...
```

---

### Backend .dev.vars (Development)

**Location:** `backend/workers/.dev.vars`

```bash
#################################################################
# Abyrith Cloudflare Workers Environment Variables
# Development Environment
# Never commit this file to Git
#################################################################

# Supabase
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Encryption (generate with: openssl rand -base64 32)
BACKEND_ENCRYPTION_KEY=your_base64_encoded_256_bit_key_here...

# AI Services
ANTHROPIC_API_KEY=sk-ant-api03-...
FIRECRAWL_API_KEY=fc_sk_...

# Optional Configuration
FIRECRAWL_TIMEOUT=30000
FIRECRAWL_MAX_RETRIES=3
FIRECRAWL_CACHE_TTL=86400
LOG_LEVEL=debug

# Optional: Error Tracking
# SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7654321
```

---

## Staging Environment Setup

### Configuration Method

**Frontend:** GitHub Actions injects environment variables at build time

**Backend:** Cloudflare Workers secrets

---

### GitHub Secrets (Frontend)

**Path:** Repository → Settings → Secrets and variables → Actions

**Required secrets:**

```bash
STAGING_NEXT_PUBLIC_APP_URL=https://staging.abyrith.com
STAGING_NEXT_PUBLIC_API_URL=https://api-staging.abyrith.com
STAGING_NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
STAGING_SUPABASE_SERVICE_ROLE_KEY=eyJ...
STAGING_ANTHROPIC_API_KEY=sk-ant-api03-...
STAGING_FIRECRAWL_API_KEY=fc_sk_...
STAGING_SENTRY_DSN=https://abc123@...
```

**All staging variables prefixed with `STAGING_`**

---

### Cloudflare Workers Secrets (Backend)

**Set via Wrangler CLI:**

```bash
# Navigate to Workers directory
cd backend/workers

# Set each secret (prompts for value)
wrangler secret put SUPABASE_URL --env staging
wrangler secret put SUPABASE_ANON_KEY --env staging
wrangler secret put BACKEND_ENCRYPTION_KEY --env staging
wrangler secret put ANTHROPIC_API_KEY --env staging
wrangler secret put FIRECRAWL_API_KEY --env staging
wrangler secret put SENTRY_DSN --env staging

# Verify secrets set
wrangler secret list --env staging
```

**Never commit values** - secrets stored securely in Cloudflare

---

## Production Environment Setup

### Configuration Method

**Same as staging** but with `PROD_` prefix and `--env production`

---

### GitHub Secrets (Frontend)

```bash
PROD_NEXT_PUBLIC_APP_URL=https://app.abyrith.com
PROD_NEXT_PUBLIC_API_URL=https://api.abyrith.com
PROD_NEXT_PUBLIC_SUPABASE_URL=https://production-project.supabase.co
PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
PROD_SUPABASE_SERVICE_ROLE_KEY=eyJ...
PROD_ANTHROPIC_API_KEY=sk-ant-api03-...
PROD_FIRECRAWL_API_KEY=fc_sk_...
PROD_SENTRY_DSN=https://xyz789@...
```

---

### Cloudflare Workers Secrets (Backend)

```bash
cd backend/workers

wrangler secret put SUPABASE_URL --env production
wrangler secret put SUPABASE_ANON_KEY --env production
wrangler secret put BACKEND_ENCRYPTION_KEY --env production
wrangler secret put ANTHROPIC_API_KEY --env production
wrangler secret put FIRECRAWL_API_KEY --env production
wrangler secret put SENTRY_DSN --env production

wrangler secret list --env production
```

---

## Example Configuration Files

### .env.example (Template)

**Location:** `frontend/.env.example`

**Purpose:** Template for developers to copy to `.env.local`

**Committed to Git:** Yes (no secrets)

```bash
#################################################################
# Abyrith Frontend Environment Variables Template
# Copy this file to .env.local and fill in your values
#################################################################

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8787/api
NEXT_PUBLIC_ENVIRONMENT=development

# Supabase (get from https://app.supabase.com)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Supabase Service Role (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI Services
# Get from: https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-api03-your_key_here
# Get from: https://firecrawl.dev
FIRECRAWL_API_KEY=fc_sk_your_key_here

# Optional: Error Tracking (https://sentry.io)
# SENTRY_DSN=https://your_dsn@o123456.ingest.sentry.io/7654321

# Optional: Bot Protection (future enhancement)
# NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAA...
```

---

### .dev.vars.example (Backend Template)

**Location:** `backend/workers/.dev.vars.example`

**Purpose:** Template for Wrangler local development

**Committed to Git:** Yes (no secrets)

```bash
#################################################################
# Abyrith Cloudflare Workers Environment Variables Template
# Copy this file to .dev.vars and fill in your values
#################################################################

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Backend Encryption Key
# Generate with: openssl rand -base64 32
# CRITICAL: This is NOT the user's master key
# Used only for envelope encryption (encrypting DEKs)
BACKEND_ENCRYPTION_KEY=your_base64_encoded_256_bit_key_here

# AI Services
ANTHROPIC_API_KEY=sk-ant-api03-your_key_here
FIRECRAWL_API_KEY=fc_sk_your_key_here

# Optional Configuration
FIRECRAWL_TIMEOUT=30000
FIRECRAWL_MAX_RETRIES=3
FIRECRAWL_CACHE_TTL=86400
LOG_LEVEL=info

# Optional: Error Tracking
# SENTRY_DSN=https://your_dsn@o123456.ingest.sentry.io/7654321
```

---

### mcp-config.example.json

**Location:** `mcp-server/mcp-config.example.json`

**Purpose:** Template for MCP server configuration

**Committed to Git:** Yes (no secrets)

```json
{
  "apiUrl": "https://api.abyrith.com/v1",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "projectName": "MyProject",
  "approvalTimeout": 300,
  "logLevel": "info",
  "cacheTTL": 3600,
  "decryptionMethod": "auto",
  "allowedTools": [
    "mcp_secrets_list",
    "mcp_secrets_get",
    "mcp_secrets_search",
    "mcp_secrets_request"
  ],
  "notificationSound": true
}
```

**Actual config location:** `~/.abyrith/mcp-config.json` (created by `abyrith-mcp auth`)

---

## Security Best Practices

### 1. Never Commit Secrets to Git

**Files to NEVER commit:**
- `.env.local`
- `.dev.vars`
- `~/.abyrith/mcp-config.json` (contains JWT)
- Any file with actual API keys or passwords

**Verify .gitignore includes:**
```gitignore
.env.local
.env*.local
.dev.vars
*.secret
.abyrith/
```

---

### 2. Use Different Keys Per Environment

**Do:**
- ✅ Separate Supabase projects for dev/staging/prod
- ✅ Separate Anthropic API keys per environment
- ✅ Different backend encryption keys per environment

**Don't:**
- ❌ Use production keys in development
- ❌ Share keys between environments

---

### 3. Rotate Secrets Regularly

**Rotation Schedule:**
| Secret | Frequency | Method |
|--------|-----------|---------|
| `BACKEND_ENCRYPTION_KEY` | Annually | Generate new, migrate data |
| `ANTHROPIC_API_KEY` | Bi-annually | Revoke old, create new |
| `FIRECRAWL_API_KEY` | Bi-annually | Revoke old, create new |
| `SUPABASE_SERVICE_ROLE_KEY` | Annually | Generate new in dashboard |
| `SENTRY_DSN` | Annually | Regenerate project DSN |

**Rotation procedure:**
1. Generate new secret
2. Update in all environments (dev → staging → prod)
3. Deploy with new secret
4. Verify functionality
5. Revoke old secret

---

### 4. Use Secrets Management Tools

**Development:**
- 1Password CLI for team secret sharing
- `.env.local` files (never committed)

**CI/CD:**
- GitHub Actions Secrets (encrypted at rest)
- Cloudflare Workers Secrets (encrypted at rest)

**Never:**
- ❌ Email secrets
- ❌ Share in Slack/chat
- ❌ Store in plain text notes

---

### 5. Audit Secret Access

**Enable logging:**
- GitHub Actions audit log
- Cloudflare Workers analytics
- Supabase auth logs

**Regular reviews:**
- Quarterly: Review who has access to GitHub Secrets
- Monthly: Review Cloudflare Workers secret access logs
- Weekly: Review unusual API key usage patterns

---

### 6. Principle of Least Privilege

**Frontend:**
- Only `NEXT_PUBLIC_*` variables exposed to browser
- Service role key NEVER exposed to client

**Backend:**
- Workers use anon key + user JWT (RLS enforced)
- Service role key only for admin operations

**MCP Server:**
- Approval required for all secret access
- Time-limited access grants

---

## Troubleshooting

### Issue 1: "Missing environment variable" Error

**Symptoms:**
```
Error: Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL
```

**Cause:** Variable not defined in `.env.local`

**Solution:**
1. Verify `.env.local` exists: `ls -la .env.local`
2. Check variable is defined: `cat .env.local | grep NEXT_PUBLIC_SUPABASE_URL`
3. Ensure no typos in variable name
4. Restart dev server: `pnpm dev`

---

### Issue 2: "Invalid Supabase credentials"

**Symptoms:**
```
Error: Invalid API key
```

**Cause:** Incorrect Supabase URL or anon key

**Solution:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Verify project URL matches `SUPABASE_URL`
3. Re-copy anon key from Settings → API
4. Ensure no extra spaces or newlines
5. Restart application

---

### Issue 3: Environment variables not updating

**Symptoms:** Changes to `.env.local` not reflected

**Cause:** Dev server needs restart

**Solution:**
```bash
# Stop dev server (Ctrl+C)
# Restart
pnpm dev

# If still not working, clear Next.js cache
rm -rf .next
pnpm dev
```

---

### Issue 4: "NEXT_PUBLIC_* variable is undefined in browser"

**Symptoms:** `window.ENV` or `process.env.NEXT_PUBLIC_*` is undefined

**Cause:** Variable not prefixed correctly or not set at build time

**Solution:**
1. Ensure variable starts with `NEXT_PUBLIC_`
2. Rebuild application: `pnpm build`
3. Check build output for variable inclusion
4. For production, verify GitHub Secrets set correctly

---

### Issue 5: Cloudflare Workers secrets not working

**Symptoms:** Workers returning 500 errors with "undefined secret"

**Cause:** Secrets not set in Cloudflare

**Solution:**
```bash
# List current secrets
wrangler secret list

# Set missing secret
wrangler secret put SUPABASE_URL

# Verify
wrangler secret list

# Deploy Workers
wrangler deploy
```

---

### Issue 6: MCP server authentication failing

**Symptoms:** "Authentication expired. Run `abyrith-mcp auth`"

**Cause:** JWT expired or corrupted

**Solution:**
```bash
# Logout
abyrith-mcp logout

# Re-authenticate
abyrith-mcp auth

# Test connection
abyrith-mcp test
```

---

### Issue 7: Rate limit exceeded immediately

**Symptoms:** API returns 429 Too Many Requests

**Cause:** Using same API key across multiple environments

**Solution:**
1. Create separate API keys for dev/staging/prod
2. Verify `.env.local` uses development key
3. Check staging/prod GitHub Secrets use different keys

---

## References

### Internal Documentation
- `TECH-STACK.md` - Complete technology stack specification
- `11-development/local-setup.md` - Local development environment setup
- `MACOS-DEVELOPMENT-SETUP.md` - macOS-specific setup instructions
- `06-backend/cloudflare-workers/workers-architecture.md` - Workers configuration
- `09-integrations/mcp/mcp-secrets-server.md` - MCP server environment variables
- `09-integrations/firecrawl/firecrawl-integration.md` - FireCrawl configuration
- `03-security/security-model.md` - Zero-knowledge encryption architecture
- `10-operations/deployment/deployment-pipeline.md` - CI/CD environment configuration

### External Resources
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables) - Official Next.js docs
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/platform/environment-variables) - Wrangler CLI secrets
- [Supabase Project Settings](https://supabase.com/docs/guides/platform/project-settings) - Getting API keys
- [Anthropic API Keys](https://docs.anthropic.com/claude/reference/getting-started-with-the-api) - Claude API documentation
- [FireCrawl Documentation](https://docs.firecrawl.dev/) - FireCrawl API reference
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) - CI/CD secrets management

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-02 | DevOps Team | Initial comprehensive environment variables documentation |

---

## Notes

### Critical Security Reminders

⚠️ **BACKEND_ENCRYPTION_KEY:**
- This is NOT the user's master password
- Only used for envelope encryption (encrypting DEKs)
- User secrets are ALWAYS encrypted client-side
- Backend never has access to unencrypted user data
- Maintains zero-knowledge architecture

⚠️ **SUPABASE_SERVICE_ROLE_KEY:**
- Bypasses Row-Level Security
- NEVER expose to client
- Server-side only (Next.js API routes, Workers)
- Use sparingly (only for admin operations)

⚠️ **Never commit:**
- `.env.local`
- `.dev.vars`
- Any file with actual API keys

### Future Enhancements

**Planned additions:**
- Cloudflare Turnstile for bot protection
- Additional monitoring integrations (DataDog, New Relic)
- Custom SMTP for transactional emails
- Webhook signature secrets
- OAuth client IDs for Google/GitHub

**Version 2.0.0 will include:**
- Enterprise-specific environment variables
- Self-hosted deployment configuration
- Advanced security headers configuration
- Multi-region deployment variables
