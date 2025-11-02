---
Document: Cloudflare Workers Setup Guide
Version: 1.0.0
Last Updated: 2025-11-02
Owner: Backend Team
Status: Draft
Dependencies: 06-backend/cloudflare-workers/workers-architecture.md, TECH-STACK.md, MACOS-DEVELOPMENT-SETUP.md
---

# Cloudflare Workers Setup Guide

## Overview

This guide provides step-by-step instructions for setting up, configuring, and deploying Cloudflare Workers for the Abyrith platform. Workers serve as the API gateway and edge computing layer, handling authentication, rate limiting, routing, and orchestration between clients and backend services.

**Purpose:** Enable developers to configure Wrangler CLI, create Workers, manage secrets, set up KV namespaces, and deploy to multiple environments (development, staging, production).

**Estimated Time:** 30-45 minutes for initial setup

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Wrangler CLI Installation](#wrangler-cli-installation)
3. [Cloudflare Account Setup](#cloudflare-account-setup)
4. [Project Initialization](#project-initialization)
5. [wrangler.toml Configuration](#wranglertoml-configuration)
6. [KV Namespace Creation](#kv-namespace-creation)
7. [Secrets Management](#secrets-management)
8. [Environment Variables](#environment-variables)
9. [Local Development](#local-development)
10. [Deployment Procedures](#deployment-procedures)
11. [Monitoring and Logs](#monitoring-and-logs)
12. [Troubleshooting](#troubleshooting)
13. [References](#references)
14. [Change Log](#change-log)

---

## Prerequisites

### Required Tools

Before starting, ensure you have:

- [x] **Node.js 20.x LTS** installed
  ```bash
  node --version  # Should show v20.x.x
  ```

- [x] **pnpm 8.x** installed
  ```bash
  pnpm --version  # Should show 8.x.x
  ```

- [x] **Git** installed for version control
  ```bash
  git --version  # Should show 2.40+
  ```

- [x] **A Cloudflare account** (free tier is sufficient for development)
  - Sign up at: https://dash.cloudflare.com/sign-up

- [x] **Terminal or command line** access

### Required Knowledge

**You should understand:**
- Basic JavaScript/TypeScript
- REST API concepts
- Environment variables
- Git workflow

**Reference documentation:**
- `06-backend/cloudflare-workers/workers-architecture.md` - Worker architecture overview
- `TECH-STACK.md` - Technology stack decisions

---

## Wrangler CLI Installation

### Installation

**Wrangler** is the official CLI tool for managing Cloudflare Workers.

```bash
# Install Wrangler globally using npm
npm install -g wrangler

# Verify installation
wrangler --version  # Should show 3.x or later

# View available commands
wrangler --help
```

**Alternative installation (project-local):**

```bash
# Install as dev dependency in your project
pnpm add -D wrangler

# Use via pnpm scripts
pnpm wrangler --version
```

**Recommended:** Install globally for easier CLI access across projects.

---

## Cloudflare Account Setup

### Step 1: Create Cloudflare Account

1. Visit: https://dash.cloudflare.com/sign-up
2. Enter email and create password
3. Verify email address
4. Complete account setup

### Step 2: Authenticate Wrangler

```bash
# Login to Cloudflare via Wrangler
wrangler login

# This will:
# 1. Open browser authentication flow
# 2. Ask you to authorize Wrangler
# 3. Store authentication token locally

# Verify authentication
wrangler whoami

# Expected output:
# You are logged in with an API Token, associated with the email '<your-email>'.
```

**If browser doesn't open automatically:**

```bash
# Use no-browser mode and copy URL manually
wrangler login --no-browser

# Copy the URL shown and open in browser
# Paste the token back into terminal
```

### Step 3: Get Account ID

```bash
# List your Cloudflare accounts
wrangler whoami

# Your Account ID will be displayed
# Save this - you'll need it for wrangler.toml
```

**Alternative: Find in Cloudflare Dashboard**

1. Go to: https://dash.cloudflare.com
2. Click on "Workers & Pages"
3. Account ID is shown on the right sidebar

**Save this value:** You'll need it for the next steps.

---

## Project Initialization

### Step 1: Navigate to Project Directory

```bash
# Navigate to the Abyrith backend workers directory
cd /path/to/abyrith/workers

# If directory doesn't exist, create it
mkdir -p workers/api-gateway
cd workers/api-gateway
```

### Step 2: Initialize Wrangler Project

```bash
# Initialize a new Worker project
wrangler init

# Answer prompts:
# - Would you like to use TypeScript? → Yes
# - Would you like to create a Worker at src/index.ts? → Yes
# - Would you like to install dependencies? → Yes
```

**Project structure created:**

```
workers/api-gateway/
├── src/
│   └── index.ts          # Worker entry point
├── wrangler.toml         # Worker configuration
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── node_modules/         # Dependencies
```

### Step 3: Verify Installation

```bash
# Install dependencies if not done automatically
pnpm install

# Run local development server
wrangler dev

# Open http://localhost:8787 in browser
# You should see "Hello World!" or default Worker response
```

---

## wrangler.toml Configuration

The `wrangler.toml` file configures your Worker deployment.

### Basic Configuration

Create or update `workers/api-gateway/wrangler.toml`:

```toml
# Worker identification
name = "abyrith-api-gateway"
main = "src/index.ts"
compatibility_date = "2025-11-02"

# Account information
account_id = "YOUR_ACCOUNT_ID"  # Replace with your Account ID from earlier

# Worker type
workers_dev = true

# Routes (production only, configured per environment)
# routes = [
#   { pattern = "api.abyrith.com/*", zone_name = "abyrith.com" }
# ]

# KV Namespaces (will be configured later)
# kv_namespaces = [
#   { binding = "KV", id = "..." }
# ]

# Durable Objects (if needed in future)
# durable_objects.bindings = [
#   { name = "MY_DURABLE_OBJECT", class_name = "MyDurableObject" }
# ]

# Environment variables (non-secret)
[vars]
ENVIRONMENT = "development"

# Build configuration
[build]
command = "pnpm build"

[build.upload]
format = "modules"
main = "./dist/index.js"
```

**Replace `YOUR_ACCOUNT_ID`** with the Account ID from Step 3 of account setup.

---

### Multi-Environment Configuration

For development, staging, and production environments:

```toml
# Default (development) configuration
name = "abyrith-api-gateway-dev"
main = "src/index.ts"
compatibility_date = "2025-11-02"
account_id = "YOUR_ACCOUNT_ID"

[vars]
ENVIRONMENT = "development"

# Development KV namespaces
[[kv_namespaces]]
binding = "KV"
id = "DEV_KV_NAMESPACE_ID"  # Will be created later

# Staging environment
[env.staging]
name = "abyrith-api-gateway-staging"
vars = { ENVIRONMENT = "staging" }

[[env.staging.kv_namespaces]]
binding = "KV"
id = "STAGING_KV_NAMESPACE_ID"

# Staging routes
[[env.staging.routes]]
pattern = "api-staging.abyrith.com/*"
zone_name = "abyrith.com"

# Production environment
[env.production]
name = "abyrith-api-gateway"
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "KV"
id = "PRODUCTION_KV_NAMESPACE_ID"

# Production routes
[[env.production.routes]]
pattern = "api.abyrith.com/*"
zone_name = "abyrith.com"
```

**Note:** KV namespace IDs will be filled in after creating namespaces in the next section.

---

## KV Namespace Creation

Workers KV provides low-latency key-value storage at the edge for caching and rate limiting.

### Create KV Namespaces

```bash
# Create development KV namespace
wrangler kv:namespace create KV

# Output will show:
# ✨ Success!
# Add the following to your wrangler.toml:
# [[kv_namespaces]]
# binding = "KV"
# id = "a1b2c3d4e5f6..."

# Create staging KV namespace
wrangler kv:namespace create KV --env staging

# Create production KV namespace
wrangler kv:namespace create KV --env production
```

**Copy the namespace IDs** from the output and update `wrangler.toml`:

```toml
# Development
[[kv_namespaces]]
binding = "KV"
id = "a1b2c3d4e5f6..."  # Replace with actual ID

# Staging
[[env.staging.kv_namespaces]]
binding = "KV"
id = "b2c3d4e5f6a1..."  # Replace with actual ID

# Production
[[env.production.kv_namespaces]]
binding = "KV"
id = "c3d4e5f6a1b2..."  # Replace with actual ID
```

### Verify KV Namespaces

```bash
# List all KV namespaces
wrangler kv:namespace list

# Expected output:
# [
#   { "id": "a1b2c3d4e5f6...", "title": "abyrith-api-gateway-dev-KV" },
#   { "id": "b2c3d4e5f6a1...", "title": "abyrith-api-gateway-staging-KV" },
#   { "id": "c3d4e5f6a1b2...", "title": "abyrith-api-gateway-KV" }
# ]
```

### Test KV Operations

```bash
# Write a test value (development namespace)
wrangler kv:key put "test-key" "test-value" --namespace-id a1b2c3d4e5f6...

# Read the value
wrangler kv:key get "test-key" --namespace-id a1b2c3d4e5f6...

# Output: test-value

# Delete the test value
wrangler kv:key delete "test-key" --namespace-id a1b2c3d4e5f6...
```

---

## Secrets Management

Secrets are sensitive values (API keys, encryption keys) stored securely by Cloudflare.

### Overview

**Secrets vs Environment Variables:**
- **Secrets:** Encrypted at rest, not visible in code, accessed via `env` object
- **Environment Variables:** Visible in `wrangler.toml`, suitable for non-sensitive config

**Secrets for Abyrith:**
- `SUPABASE_URL` - Supabase API endpoint
- `SUPABASE_ANON_KEY` - Supabase anon key (public)
- `BACKEND_ENCRYPTION_KEY` - Backend key for envelope encryption (DEKs only)
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `FIRECRAWL_API_KEY` - FireCrawl API key
- `SENTRY_DSN` (optional) - Error tracking

### Add Secrets to Development Environment

```bash
# Add Supabase URL
wrangler secret put SUPABASE_URL
# Paste your Supabase URL when prompted
# Example: https://abcdefgh.supabase.co

# Add Supabase anon key
wrangler secret put SUPABASE_ANON_KEY
# Paste your anon key when prompted

# Add backend encryption key
wrangler secret put BACKEND_ENCRYPTION_KEY
# Generate a secure key (see below) and paste

# Add Claude API key
wrangler secret put CLAUDE_API_KEY
# Paste your Anthropic API key

# Add FireCrawl API key
wrangler secret put FIRECRAWL_API_KEY
# Paste your FireCrawl API key
```

### Add Secrets to Staging Environment

```bash
# Add secrets with --env staging flag
wrangler secret put SUPABASE_URL --env staging
wrangler secret put SUPABASE_ANON_KEY --env staging
wrangler secret put BACKEND_ENCRYPTION_KEY --env staging
wrangler secret put CLAUDE_API_KEY --env staging
wrangler secret put FIRECRAWL_API_KEY --env staging
```

### Add Secrets to Production Environment

```bash
# Add secrets with --env production flag
wrangler secret put SUPABASE_URL --env production
wrangler secret put SUPABASE_ANON_KEY --env production
wrangler secret put BACKEND_ENCRYPTION_KEY --env production
wrangler secret put CLAUDE_API_KEY --env production
wrangler secret put FIRECRAWL_API_KEY --env production
```

### Generate Backend Encryption Key

**CRITICAL: Backend encryption key is used for envelope encryption of DEKs, NOT user secrets.**

User secrets are encrypted client-side with the user's master key (which NEVER leaves the client).

```bash
# Generate a secure 256-bit key using OpenSSL
openssl rand -base64 32

# Output example: 3Jk8Mn2Pq9Rs5Tv7Uw0Xx1Yy4Zz6Aa8Bb9Cc2Dd5Ee8

# Copy this value and use it as BACKEND_ENCRYPTION_KEY
wrangler secret put BACKEND_ENCRYPTION_KEY
# Paste the generated key
```

**Store this key securely** in your password manager (1Password, LastPass, etc.).

### List Secrets

```bash
# List secret names (values are never shown)
wrangler secret list

# Output:
# [
#   { "name": "SUPABASE_URL" },
#   { "name": "SUPABASE_ANON_KEY" },
#   { "name": "BACKEND_ENCRYPTION_KEY" },
#   { "name": "CLAUDE_API_KEY" },
#   { "name": "FIRECRAWL_API_KEY" }
# ]

# List secrets for specific environment
wrangler secret list --env production
```

### Delete Secrets

```bash
# Delete a secret
wrangler secret delete FIRECRAWL_API_KEY

# Delete from specific environment
wrangler secret delete FIRECRAWL_API_KEY --env staging

# Confirm deletion when prompted
```

### Access Secrets in Worker Code

```typescript
// src/index.ts
export interface Env {
  // Secrets (accessed at runtime)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  BACKEND_ENCRYPTION_KEY: string;
  CLAUDE_API_KEY: string;
  FIRECRAWL_API_KEY: string;

  // KV namespace
  KV: KVNamespace;

  // Environment variable (from wrangler.toml)
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Access secrets via env object
    const supabaseUrl = env.SUPABASE_URL;
    const claudeKey = env.CLAUDE_API_KEY;

    // Use in API calls
    const response = await fetch(supabaseUrl, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
      }
    });

    return new Response('Worker is running!');
  }
};
```

---

## Environment Variables

Environment variables are non-sensitive configuration values stored in `wrangler.toml`.

### Configure Development Variables

```toml
[vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
RATE_LIMIT_PER_MINUTE = "100"
RATE_LIMIT_PER_HOUR = "1000"
CACHE_TTL_SECONDS = "300"
```

### Configure Staging Variables

```toml
[env.staging]
name = "abyrith-api-gateway-staging"
vars = {
  ENVIRONMENT = "staging",
  LOG_LEVEL = "info",
  RATE_LIMIT_PER_MINUTE = "100",
  RATE_LIMIT_PER_HOUR = "1000",
  CACHE_TTL_SECONDS = "600"
}
```

### Configure Production Variables

```toml
[env.production]
name = "abyrith-api-gateway"
vars = {
  ENVIRONMENT = "production",
  LOG_LEVEL = "warn",
  RATE_LIMIT_PER_MINUTE = "100",
  RATE_LIMIT_PER_HOUR = "1000",
  CACHE_TTL_SECONDS = "3600"
}
```

### Access Environment Variables

```typescript
// Access in Worker code
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const environment = env.ENVIRONMENT;  // "development", "staging", or "production"
    const logLevel = env.LOG_LEVEL;       // "debug", "info", or "warn"

    console.log(`Running in ${environment} mode with log level ${logLevel}`);

    return new Response('OK');
  }
};
```

---

## Local Development

### Start Development Server

```bash
# Start local development server
wrangler dev

# Output:
# ⎔ Starting local server...
# [wrangler:inf] Ready on http://localhost:8787

# Open http://localhost:8787 in browser
```

### Development Server Options

```bash
# Run on specific port
wrangler dev --port 3000

# Enable live reload (auto-restart on code changes)
wrangler dev --live-reload

# Use specific environment
wrangler dev --env staging

# Enable remote mode (test with actual Cloudflare infrastructure)
wrangler dev --remote

# View logs in terminal
wrangler dev --log-level debug
```

### Local Development with KV

```bash
# Start dev server with KV persistence
wrangler dev --persist

# KV data is stored in .wrangler/state/kv/
# Survives server restarts
```

### Test Worker Locally

```bash
# Using curl
curl http://localhost:8787/api/v1/health

# Using HTTPie
http http://localhost:8787/api/v1/health

# Test authenticated endpoint
curl -H "Authorization: Bearer <jwt>" http://localhost:8787/api/v1/secrets
```

### Hot Reload

**Wrangler automatically reloads when you save files:**

1. Edit `src/index.ts`
2. Save file
3. Wrangler detects change and reloads
4. Refresh browser or re-run curl command

**No manual restart needed!**

---

## Deployment Procedures

### Deploy to Development

```bash
# Deploy to default (development) environment
wrangler deploy

# Output:
# ✨ Success! Uploaded 1 file (2.34 KB)
# ✨ Deployed abyrith-api-gateway-dev
#    https://abyrith-api-gateway-dev.YOUR_SUBDOMAIN.workers.dev

# Test deployment
curl https://abyrith-api-gateway-dev.YOUR_SUBDOMAIN.workers.dev/health
```

### Deploy to Staging

```bash
# Deploy to staging environment
wrangler deploy --env staging

# Output:
# ✨ Success! Uploaded 1 file (2.34 KB)
# ✨ Deployed abyrith-api-gateway-staging
#    https://abyrith-api-gateway-staging.YOUR_SUBDOMAIN.workers.dev
#    https://api-staging.abyrith.com/* (if routes configured)

# Test staging deployment
curl https://api-staging.abyrith.com/health
```

### Deploy to Production

```bash
# Deploy to production environment
wrangler deploy --env production

# Output:
# ✨ Success! Uploaded 1 file (2.34 KB)
# ✨ Deployed abyrith-api-gateway
#    https://abyrith-api-gateway.YOUR_SUBDOMAIN.workers.dev
#    https://api.abyrith.com/* (if routes configured)

# Test production deployment
curl https://api.abyrith.com/health
```

### Deployment Verification Checklist

After each deployment:

- [ ] **Health check passes**
  ```bash
  curl https://api.abyrith.com/health
  ```

- [ ] **Authentication works**
  ```bash
  curl -H "Authorization: Bearer <jwt>" https://api.abyrith.com/api/v1/secrets
  ```

- [ ] **Rate limiting active**
  ```bash
  # Make 101 requests quickly (should be rate limited on 101st)
  for i in {1..101}; do curl https://api.abyrith.com/health; done
  ```

- [ ] **Logs are flowing**
  ```bash
  wrangler tail --env production
  ```

- [ ] **KV operations work**
  ```bash
  # Worker should use KV for rate limits and caching
  # Check logs for KV operations
  ```

- [ ] **Secrets are accessible**
  ```bash
  # Check logs to confirm Worker can access secrets
  # (Never log actual secret values!)
  ```

### Rollback Procedure

**If deployment fails or introduces bugs:**

```bash
# Option 1: Re-deploy previous working version
git checkout <previous-working-commit>
wrangler deploy --env production

# Option 2: Cloudflare Dashboard rollback
# 1. Go to https://dash.cloudflare.com
# 2. Navigate to Workers & Pages
# 3. Select worker
# 4. Click "Rollbacks" tab
# 5. Select previous version
# 6. Click "Rollback to this version"

# Option 3: Emergency disable
# Temporarily disable Worker routes in Cloudflare Dashboard
# While you investigate and fix the issue
```

---

## Monitoring and Logs

### Real-Time Logs

**Stream logs from Worker:**

```bash
# Tail development logs
wrangler tail

# Tail staging logs
wrangler tail --env staging

# Tail production logs
wrangler tail --env production

# Filter logs
wrangler tail --env production --format json | jq 'select(.level == "error")'

# Sample specific percentage of logs
wrangler tail --env production --sampling-rate 0.1  # 10% of logs
```

**Log output format:**

```json
{
  "outcome": "ok",
  "scriptName": "abyrith-api-gateway",
  "diagnosticsChannelEvents": [],
  "exceptions": [],
  "logs": [
    {
      "message": ["Request received: GET /api/v1/health"],
      "level": "log",
      "timestamp": 1699000000000
    }
  ],
  "eventTimestamp": 1699000000000,
  "event": {
    "request": {
      "url": "https://api.abyrith.com/api/v1/health",
      "method": "GET",
      "headers": { ... }
    }
  }
}
```

### Cloudflare Dashboard Analytics

**View metrics in dashboard:**

1. Go to: https://dash.cloudflare.com
2. Click "Workers & Pages"
3. Select your worker
4. Click "Metrics" tab

**Metrics available:**
- Requests per second
- Error rate
- CPU time (p50, p95, p99)
- Duration (total request time)
- Subrequest count
- KV operations

**Time ranges:**
- Last 24 hours
- Last 7 days
- Last 30 days
- Custom date range

### Custom Logging in Worker

```typescript
// src/index.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      // Log request
      console.log('Request received:', {
        method: request.method,
        path: url.pathname,
        timestamp: new Date().toISOString(),
      });

      // Process request
      const response = await handleRequest(request, env);

      // Log success
      console.log('Request successful:', {
        method: request.method,
        path: url.pathname,
        status: response.status,
        duration: Date.now() - startTime,
      });

      return response;

    } catch (error) {
      // Log error
      console.error('Request failed:', {
        method: request.method,
        path: url.pathname,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });

      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
```

### Error Tracking with Sentry (Optional)

```typescript
// Install Sentry SDK
// pnpm add @sentry/browser

import * as Sentry from '@sentry/browser';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry
    if (env.SENTRY_DSN) {
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.ENVIRONMENT,
        tracesSampleRate: 1.0,
      });
    }

    try {
      return await handleRequest(request, env);
    } catch (error) {
      // Report to Sentry
      Sentry.captureException(error);
      throw error;
    }
  }
};
```

### Performance Monitoring

**Monitor Worker performance:**

```bash
# View analytics via CLI
wrangler metrics --env production

# Output:
# Requests:     12,345 requests in last 24 hours
# Errors:       12 errors (0.1% error rate)
# Duration P50: 15ms
# Duration P95: 45ms
# Duration P99: 120ms
# CPU Time P50: 5ms
# CPU Time P95: 12ms
```

**Set up alerts:**

1. Go to Cloudflare Dashboard
2. Navigate to "Notifications"
3. Create new notification
4. Select "Workers" as service
5. Configure alert conditions:
   - Error rate > 1%
   - CPU time > 30ms (p95)
   - Request count drops (potential outage)

---

## Troubleshooting

### Issue: `wrangler login` fails

**Symptoms:**
```
Error: Could not authenticate. Please try again.
```

**Solutions:**

1. **Clear authentication cache:**
   ```bash
   rm -rf ~/.wrangler
   wrangler login
   ```

2. **Use no-browser mode:**
   ```bash
   wrangler login --no-browser
   # Copy URL and open in browser manually
   ```

3. **Check firewall/proxy:**
   ```bash
   # If behind corporate firewall, configure proxy
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   wrangler login
   ```

---

### Issue: KV namespace not found

**Symptoms:**
```
Error: KV namespace with id "abc123..." not found
```

**Solutions:**

1. **Verify namespace exists:**
   ```bash
   wrangler kv:namespace list
   ```

2. **Check wrangler.toml:**
   ```toml
   # Ensure ID matches output from kv:namespace list
   [[kv_namespaces]]
   binding = "KV"
   id = "abc123..."  # Must match actual namespace ID
   ```

3. **Recreate namespace:**
   ```bash
   wrangler kv:namespace create KV
   # Copy new ID to wrangler.toml
   ```

---

### Issue: Secrets not accessible in Worker

**Symptoms:**
```typescript
// env.SUPABASE_URL is undefined
console.log(env.SUPABASE_URL); // undefined
```

**Solutions:**

1. **Verify secrets are set:**
   ```bash
   wrangler secret list
   # Ensure SUPABASE_URL is listed
   ```

2. **Check environment:**
   ```bash
   # If deploying to staging, ensure secret is set for staging
   wrangler secret list --env staging
   ```

3. **Re-add secret:**
   ```bash
   wrangler secret put SUPABASE_URL --env production
   # Paste value when prompted
   ```

4. **Redeploy Worker:**
   ```bash
   # Secrets are bound at deployment time
   wrangler deploy --env production
   ```

---

### Issue: Worker exceeds CPU time limit

**Symptoms:**
```
Error: Worker exceeded CPU time limit of 50ms
```

**Solutions:**

1. **Profile slow code paths:**
   ```typescript
   const start = Date.now();
   // ... slow operation
   console.log('Operation took:', Date.now() - start, 'ms');
   ```

2. **Use streaming for large responses:**
   ```typescript
   // Instead of buffering entire response
   return new Response(backendResponse.body, {
     headers: backendResponse.headers
   });
   ```

3. **Offload heavy work to Edge Functions:**
   ```typescript
   // Move complex operations to Supabase Edge Functions
   const result = await fetch(`${supabaseUrl}/functions/v1/heavy-operation`);
   ```

4. **Set timeouts on external requests:**
   ```typescript
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 5000);

   try {
     const response = await fetch(url, { signal: controller.signal });
     return response;
   } finally {
     clearTimeout(timeout);
   }
   ```

---

### Issue: Rate limiting not working

**Symptoms:**
- Users can make unlimited requests
- No rate limit headers in responses

**Solutions:**

1. **Verify KV namespace is bound:**
   ```bash
   wrangler kv:namespace list
   # Check ID matches wrangler.toml
   ```

2. **Check rate limit logic:**
   ```typescript
   // Ensure rate limit is checked before proceeding
   const limited = await checkRateLimit(userId, env);
   if (limited) {
     return new Response('Rate limited', { status: 429 });
   }
   ```

3. **Test KV writes:**
   ```bash
   # Verify KV is writable
   wrangler kv:key put "test" "value" --namespace-id <your-id>
   wrangler kv:key get "test" --namespace-id <your-id>
   ```

4. **Check KV operation errors:**
   ```typescript
   try {
     await env.KV.put(key, value);
   } catch (error) {
     console.error('KV write failed:', error);
     // Fallback: allow request if KV unavailable
   }
   ```

---

### Issue: Deployment fails

**Symptoms:**
```
Error: Script startup failed: Error: ...
```

**Solutions:**

1. **Check syntax errors:**
   ```bash
   # Run TypeScript compiler
   pnpm tsc --noEmit
   ```

2. **Validate wrangler.toml:**
   ```bash
   # Ensure TOML syntax is correct
   wrangler validate
   ```

3. **Check build output:**
   ```bash
   # Inspect built files
   ls -la dist/
   cat dist/index.js
   ```

4. **Deploy with verbose logging:**
   ```bash
   wrangler deploy --env production --log-level debug
   ```

---

## References

### Internal Documentation
- `06-backend/cloudflare-workers/workers-architecture.md` - Worker architecture
- `TECH-STACK.md` - Technology decisions
- `MACOS-DEVELOPMENT-SETUP.md` - Development environment setup
- `05-api/api-rest-design.md` - API design patterns
- `GLOSSARY.md` - Term definitions

### External Resources
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/) - Official Wrangler guide
- [Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) - KV storage API
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) - CPU, memory, size limits
- [Workers Examples](https://developers.cloudflare.com/workers/examples/) - Code examples
- [Workers Discord](https://discord.gg/cloudflaredev) - Community support

### Related Setup Guides
- Supabase setup guide (when created)
- Frontend deployment guide (when created)
- CI/CD pipeline configuration (when created)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-02 | Backend Team | Initial Cloudflare Workers setup guide |

---

## Notes

### Next Steps After Setup

1. **Implement Worker routes** based on `workers-architecture.md`
2. **Set up CI/CD pipeline** for automated deployments
3. **Configure custom domains** in Cloudflare Dashboard
4. **Implement rate limiting** logic using KV
5. **Add monitoring alerts** for error rates and latency
6. **Document deployment runbook** in `10-operations/deployment/`

### Best Practices

**Secrets Management:**
- Never commit secrets to Git
- Rotate secrets quarterly or when compromised
- Use different secrets for each environment
- Store backup copies in password manager

**Deployment:**
- Always test in development first
- Deploy to staging before production
- Monitor logs during and after deployment
- Have rollback plan ready

**Performance:**
- Keep Worker code minimal (< 1MB)
- Use streaming for large responses
- Set timeouts on external requests
- Monitor CPU time metrics

**Security:**
- Use HTTPS for all requests
- Validate all inputs
- Implement rate limiting
- Log security events
- Never log secrets or PII

### Known Limitations

- Workers have 50ms CPU time limit per request
- KV is eventually consistent (< 60s globally)
- Maximum Worker size: 1MB (after compression)
- Maximum KV key size: 512 bytes
- Maximum KV value size: 25MB

### Future Enhancements

- Implement automated secret rotation
- Add distributed tracing (OpenTelemetry)
- Set up load testing pipeline
- Implement canary deployments
- Add more comprehensive monitoring dashboards
