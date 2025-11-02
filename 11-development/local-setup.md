---
Document: Local Development Environment Setup
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Engineering Team
Status: Draft
Dependencies: TECH-STACK.md, 04-database/database-overview.md, 06-backend/cloudflare-workers/workers-architecture.md, 07-frontend/frontend-architecture.md, GLOSSARY.md
---

# Local Development Environment Setup

## Overview

This guide provides complete instructions for setting up a local development environment for Abyrith. By following these steps, you'll have a fully functional development instance running locally with Next.js frontend (port 3000), Cloudflare Workers (port 8787), and local Supabase database. This setup enables you to develop, test, and debug all platform features before deploying to staging or production.

**Purpose:** Enable developers to contribute to Abyrith with a consistent, reproducible local development environment.

**Estimated Time:** 45-60 minutes (including tool downloads)

**Risk Level:** Low (local development only, no production impact)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Running Development Servers](#running-development-servers)
6. [Verification & Testing](#verification--testing)
7. [Development Workflow](#development-workflow)
8. [Troubleshooting](#troubleshooting)
9. [Hot Module Replacement & Debugging](#hot-module-replacement--debugging)
10. [Common Development Tasks](#common-development-tasks)
11. [Next Steps](#next-steps)
12. [References](#references)
13. [Change Log](#change-log)

---

## Prerequisites

### Required Software

Before you begin, ensure you have the following software installed on your machine:

**1. Node.js 20.x LTS**
```bash
# Check version
node --version
# Should output: v20.x.x (e.g., v20.10.0)

# Install Node.js 20.x LTS
# macOS (via Homebrew)
brew install node@20

# Windows (via nvm-windows)
nvm install 20
nvm use 20

# Linux (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**Why 20.x LTS?** Node.js 20.x is the Long-Term Support version with the best stability and performance for Next.js 14.2.x, Cloudflare Workers (Wrangler), and Supabase CLI.

---

**2. pnpm 8.x**
```bash
# Check version
pnpm --version
# Should output: 8.x.x (e.g., 8.15.0)

# Install pnpm globally
npm install -g pnpm@8

# Or via Homebrew (macOS)
brew install pnpm
```

**Why pnpm?** pnpm is faster, more disk-efficient, and has stricter dependency resolution than npm or yarn. See `TECH-STACK.md` for details.

---

**3. Git 2.40+**
```bash
# Check version
git --version
# Should output: git version 2.40.x or higher

# Install Git
# macOS (via Homebrew)
brew install git

# Windows
# Download from https://git-scm.com/download/win

# Linux
sudo apt-get install git   # Debian/Ubuntu
sudo yum install git        # CentOS/RHEL
```

---

**4. VS Code or Cursor (Recommended IDE)**

**VS Code:**
```bash
# macOS (via Homebrew)
brew install --cask visual-studio-code

# Or download from https://code.visualstudio.com/
```

**Cursor (AI-powered IDE):**
```bash
# Download from https://cursor.sh/
```

**Required Extensions (VS Code/Cursor):**
- **ESLint** (`dbaeumer.vscode-eslint`) - JavaScript/TypeScript linting
- **Prettier** (`esbenp.prettier-vscode`) - Code formatting
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) - Tailwind autocomplete
- **Supabase** (`supabase.supabase-vscode`) - Supabase integration
- **PostgreSQL** (`ms-ossdata.vscode-postgresql`) - Database tools

Install extensions:
```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension supabase.supabase-vscode
code --install-extension ms-ossdata.vscode-postgresql
```

---

**5. Supabase CLI**
```bash
# Check version
supabase --version
# Should output: 1.150.0 or higher

# Install Supabase CLI
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
# Or download binary from https://github.com/supabase/cli/releases
```

**Why Supabase CLI?** The Supabase CLI allows you to run a local PostgreSQL database with Supabase Auth, Realtime, and Storage services without needing cloud credentials.

---

**6. Wrangler CLI (Cloudflare Workers)**
```bash
# Check version
wrangler --version
# Should output: 3.x.x or higher

# Install Wrangler CLI globally
pnpm add -g wrangler

# Verify installation
wrangler --version
```

**Why Wrangler?** Wrangler is the official CLI for developing and deploying Cloudflare Workers. It enables local development of the API gateway layer.

---

### Optional Software (Recommended)

**Docker Desktop** (for containerized Supabase)
```bash
# macOS
brew install --cask docker

# Windows
# Download from https://www.docker.com/products/docker-desktop

# Linux
sudo apt-get install docker.io docker-compose
```

**Why Docker?** Supabase CLI uses Docker to run local PostgreSQL, PostgREST, and other services. Required for `supabase start`.

---

**PostgreSQL Client (psql)** (for database inspection)
```bash
# macOS
brew install postgresql@15

# Windows
# Download from https://www.postgresql.org/download/windows/

# Linux
sudo apt-get install postgresql-client-15
```

---

### System Requirements

**Minimum:**
- **CPU:** 2 cores (4 cores recommended)
- **RAM:** 8GB (16GB recommended for running all services)
- **Disk:** 10GB free space (for dependencies and Docker images)
- **OS:** macOS 10.15+, Windows 10+, Ubuntu 20.04+

**Ports Required:**
- `3000` - Next.js frontend development server
- `8787` - Cloudflare Workers local development
- `54321` - Supabase local API (PostgREST)
- `54322` - PostgreSQL database
- `54323` - Supabase Studio (web UI)
- `54324` - Supabase Auth API

**Important:** Ensure these ports are not in use by other applications. See [Troubleshooting](#troubleshooting) if you encounter port conflicts.

---

## Initial Setup

### Step 1: Clone the Repository

```bash
# Clone the Abyrith repository (replace with actual repository URL)
git clone https://github.com/your-org/abyrith.git

# Navigate to project directory
cd abyrith

# Verify you're on the main branch
git branch
# Should show: * main

# Pull latest changes
git pull origin main
```

**Expected output:**
```
Cloning into 'abyrith'...
remote: Enumerating objects: 1234, done.
remote: Counting objects: 100% (1234/1234), done.
remote: Compressing objects: 100% (567/567), done.
Receiving objects: 100% (1234/1234), 2.34 MiB | 5.67 MiB/s, done.
```

---

### Step 2: Install Dependencies

```bash
# Install all project dependencies using pnpm
pnpm install

# This will install:
# - Next.js, React, TypeScript
# - Tailwind CSS, shadcn/ui components
# - Zustand, React Query
# - Supabase client libraries
# - Development tools (ESLint, Prettier, Vitest, Playwright)
```

**Expected output:**
```
Packages: +423
Progress: resolved 423, reused 423, downloaded 0, added 423, done
Done in 30s
```

**Time:** ~2-3 minutes (depending on internet speed)

**Troubleshooting:**
- If `pnpm install` fails with "No matching version found", ensure you're using pnpm 8.x
- If you see "EACCES: permission denied", do NOT use `sudo`. Fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally

---

### Step 3: Verify Project Structure

```bash
# List project structure
ls -la

# You should see:
# - app/              (Next.js App Router)
# - components/       (React components)
# - lib/              (Utilities, API clients, stores)
# - public/           (Static assets)
# - supabase/         (Supabase migrations and config)
# - workers/          (Cloudflare Workers code)
# - package.json      (Dependencies)
# - next.config.js    (Next.js configuration)
# - tsconfig.json     (TypeScript configuration)
# - tailwind.config.ts (Tailwind CSS configuration)
```

---

## Environment Configuration

### Step 1: Copy Environment Template

```bash
# Copy the example environment file
cp .env.example .env.local

# Open .env.local in your editor
code .env.local  # VS Code
cursor .env.local  # Cursor
```

---

### Step 2: Configure Environment Variables

Edit `.env.local` with the following configuration:

```bash
# =============================================================================
# Abyrith Local Development Environment Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Next.js Configuration
# -----------------------------------------------------------------------------
# Public variables (exposed to browser, prefix with NEXT_PUBLIC_)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_ENVIRONMENT=development

# -----------------------------------------------------------------------------
# Supabase Configuration (Local)
# -----------------------------------------------------------------------------
# Supabase local instance (started with `supabase start`)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# ⚠️ IMPORTANT: This key is automatically generated by `supabase start`
# Look for "anon key" in the output of `supabase start`

# Server-side Supabase credentials
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# ⚠️ IMPORTANT: This key is automatically generated by `supabase start`
# Look for "service_role key" in the output of `supabase start`

# Database connection string (for migrations and direct queries)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# -----------------------------------------------------------------------------
# Cloudflare Workers Configuration (Local)
# -----------------------------------------------------------------------------
WORKERS_DEV=true
WORKERS_PORT=8787

# Workers KV namespace IDs (local development uses in-memory KV)
KV_CACHE_NAMESPACE=local-cache
KV_RATE_LIMIT_NAMESPACE=local-rate-limit

# -----------------------------------------------------------------------------
# External API Keys (Development/Test Keys Only!)
# -----------------------------------------------------------------------------
# ⚠️ NEVER commit production keys to .env.local
# Use test/development keys only

# Claude API (Anthropic) - Get test key from https://console.anthropic.com/
CLAUDE_API_KEY=sk-ant-api03-test-key-here
# Use Claude 3.5 Haiku for development (cheaper)
CLAUDE_MODEL=claude-3.5-haiku-20241022

# FireCrawl API - Get test key from https://firecrawl.dev/
FIRECRAWL_API_KEY=fc-test-key-here

# -----------------------------------------------------------------------------
# Security Configuration (Development)
# -----------------------------------------------------------------------------
# Master encryption key for backend envelope encryption (DEKs only)
# In development, use a static key for consistency
# ⚠️ In production, this is stored in Cloudflare Workers Secrets
BACKEND_ENCRYPTION_KEY=dev-only-encryption-key-change-in-production

# JWT secret (for local token signing, Supabase generates this)
JWT_SECRET=super-secret-jwt-token-dev-only

# -----------------------------------------------------------------------------
# Feature Flags (Development)
# -----------------------------------------------------------------------------
ENABLE_AI_FEATURES=true
ENABLE_MCP_SERVER=true
ENABLE_REALTIME=true
ENABLE_AUDIT_LOGGING=true

# -----------------------------------------------------------------------------
# Development Tools
# -----------------------------------------------------------------------------
# Enable verbose logging
DEBUG=abyrith:*

# Enable React Query DevTools
NEXT_PUBLIC_ENABLE_REACT_QUERY_DEVTOOLS=true

# Enable Redux DevTools (for Zustand)
NEXT_PUBLIC_ENABLE_ZUSTAND_DEVTOOLS=true

# Sentry (Error Tracking) - Leave empty for local development
SENTRY_DSN=
```

---

### Step 3: Generate Supabase Keys (via `supabase start`)

**Important:** The Supabase anon key and service role key are generated when you start the local Supabase instance. We'll update `.env.local` after starting Supabase in the next section.

---

## Database Setup

### Step 1: Initialize Supabase

```bash
# Initialize Supabase in the project (creates supabase/ directory)
supabase init

# This creates:
# - supabase/config.toml (Supabase configuration)
# - supabase/migrations/ (SQL migration files)
# - supabase/seed.sql (Seed data for development)
```

**Expected output:**
```
Finished supabase init.
```

---

### Step 2: Start Local Supabase

```bash
# Start local Supabase instance (requires Docker)
supabase start

# This will:
# 1. Pull Docker images (first time: ~5 minutes)
# 2. Start PostgreSQL 15.x
# 3. Start Supabase Auth, PostgREST, Realtime, Storage
# 4. Start Supabase Studio (web UI)
# 5. Apply migrations from supabase/migrations/
```

**Expected output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

**Time:** 5-10 minutes (first run, with Docker image downloads)

---

### Step 3: Update Environment Variables with Supabase Keys

Copy the `anon key` and `service_role key` from the `supabase start` output and update `.env.local`:

```bash
# Update .env.local with the keys from supabase start output
code .env.local

# Replace these lines:
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here>
```

---

### Step 4: Access Supabase Studio

Open your browser and navigate to:

```
http://localhost:54323
```

**Supabase Studio** is a web-based interface for:
- Viewing database tables and data
- Running SQL queries
- Managing authentication users
- Viewing real-time subscriptions
- Inspecting API logs

**Default credentials:** No login required for local instance.

---

### Step 5: Run Database Migrations

```bash
# Apply all migrations in supabase/migrations/
supabase db reset

# This will:
# 1. Drop all tables (if any)
# 2. Apply all migrations in order
# 3. Run seed.sql to populate test data
```

**Expected output:**
```
Applying migration 20251030000001_initial_schema.sql...
Applying migration 20251030000002_add_organizations.sql...
Applying migration 20251030000003_add_secrets.sql...
Seeding database...
Done.
```

**Verify migrations:**
```bash
# List applied migrations
supabase migration list

# Expected output:
# - 20251030000001_initial_schema.sql (applied)
# - 20251030000002_add_organizations.sql (applied)
# - 20251030000003_add_secrets.sql (applied)
```

---

### Step 6: Verify Database Schema

```bash
# Connect to local PostgreSQL database
psql postgresql://postgres:postgres@localhost:54322/postgres

# List tables
\dt

# Expected tables:
# - auth.users (Supabase Auth)
# - public.organizations
# - public.org_members
# - public.projects
# - public.project_members
# - public.secrets
# - public.audit_logs

# Check RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

# Exit psql
\q
```

---

## Running Development Servers

### Step 1: Start Frontend Development Server (Next.js)

Open a **new terminal tab/window** and run:

```bash
# Start Next.js development server on port 3000
pnpm dev

# Or with verbose logging
pnpm dev --turbo
```

**Expected output:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully in 2.3s (2204 modules)
```

**Time to start:** 5-10 seconds

**Access frontend:**
```
http://localhost:3000
```

---

### Step 2: Start Cloudflare Workers Development Server

Open **another terminal tab/window** and run:

```bash
# Navigate to workers directory
cd workers

# Start Wrangler dev server on port 8787
pnpm dev
# or
wrangler dev --port 8787
```

**Expected output:**
```
⛅️ wrangler 3.22.0
-------------------
wrangler dev now uses local mode by default, powered by Miniflare 🎉!
⎔ Starting local server...
[mf:inf] Worker reloaded! (3.45sec)
[mf:inf] Listening on :8787
[b] open a browser, [d] open Devtools, [l] turn off local mode, [c] clear console, [x] to exit
```

**Time to start:** 3-5 seconds

**Access API gateway:**
```
http://localhost:8787/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-30T12:34:56.789Z",
  "services": {
    "database": "connected",
    "auth": "connected"
  }
}
```

---

### Step 3: Verify All Services Running

Open a new terminal and check all services:

```bash
# Check Next.js (frontend)
curl http://localhost:3000/api/health

# Check Cloudflare Workers (API gateway)
curl http://localhost:8787/health

# Check Supabase API (PostgREST)
curl http://localhost:54321/rest/v1/

# Check Supabase Studio (web UI)
open http://localhost:54323  # macOS
# or visit http://localhost:54323 in browser
```

**Expected:** All services respond with 200 OK or valid JSON.

---

## Verification & Testing

### Step 1: Run Automated Tests

```bash
# Run all tests (unit + integration)
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run E2E tests (requires Playwright)
pnpm test:e2e

# Run tests in watch mode (re-runs on file change)
pnpm test:watch
```

**Expected output:**
```
 ✓ lib/crypto/encryption.test.ts (3)
 ✓ lib/api/client.test.ts (5)
 ✓ components/secrets/SecretCard.test.tsx (4)

 Test Files  12 passed (12)
      Tests  47 passed (47)
   Start at  12:34:56
   Duration  2.34s
```

---

### Step 2: Lint and Format Code

```bash
# Run ESLint (check code quality)
pnpm lint

# Fix ESLint issues automatically
pnpm lint:fix

# Format code with Prettier
pnpm format

# Check TypeScript types
pnpm type-check
```

---

### Step 3: Verify Frontend Rendering

1. **Open frontend:** http://localhost:3000
2. **Expected:** Landing page loads without errors
3. **Check browser console:** No errors (F12 → Console tab)

**Test navigation:**
- Click "Sign Up" → Should navigate to `/signup`
- Click "Login" → Should navigate to `/login`

---

### Step 4: Verify API Gateway

```bash
# Test API health check
curl http://localhost:8787/health

# Test authenticated endpoint (should fail without token)
curl http://localhost:8787/api/v1/secrets
# Expected: {"error": "unauthorized", "message": "Authentication required"}

# Test rate limiting (send 100 requests)
for i in {1..100}; do curl http://localhost:8787/health; done
# Expected: First 20 succeed, rest return 429 (rate limited)
```

---

## Development Workflow

### Starting Your Day

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
pnpm install

# 3. Start Supabase (if not already running)
supabase start

# 4. Apply any new migrations
supabase db reset

# 5. Start frontend (terminal 1)
pnpm dev

# 6. Start workers (terminal 2)
cd workers && pnpm dev
```

---

### Making Changes

**1. Create a feature branch:**
```bash
git checkout -b feature/your-feature-name
```

**2. Make your changes:**
- Edit files in `app/`, `components/`, `lib/`, or `workers/`
- Hot module replacement (HMR) will automatically reload changes

**3. Test your changes:**
```bash
pnpm test
pnpm lint
pnpm type-check
```

**4. Commit your changes:**
```bash
git add .
git commit -m "feat: add your feature description"
```

**5. Push to remote:**
```bash
git push origin feature/your-feature-name
```

**6. Create a pull request:**
- Go to GitHub repository
- Click "Compare & pull request"
- Fill out PR template
- Request review from team

---

### Stopping Development Servers

```bash
# Stop Next.js (frontend)
# In terminal 1: Press Ctrl+C

# Stop Cloudflare Workers
# In terminal 2: Press Ctrl+C

# Stop Supabase
supabase stop

# Stop all services and remove containers
supabase stop --no-backup
```

---

## Troubleshooting

### Issue 1: Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause:** Another process is using port 3000, 8787, or Supabase ports.

**Solution:**

**macOS/Linux:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

**Windows:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

---

### Issue 2: Module Not Found Errors

**Symptoms:**
```
Error: Cannot find module 'some-package'
```

**Cause:** Dependencies not installed or corrupted `node_modules`.

**Solution:**
```bash
# Remove node_modules and lockfile
rm -rf node_modules pnpm-lock.yaml

# Reinstall dependencies
pnpm install

# Clear Next.js cache
rm -rf .next
pnpm dev
```

---

### Issue 3: Supabase Connection Failed

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:54321
```

**Cause:** Supabase not running or Docker not started.

**Solution:**
```bash
# Check Docker is running
docker ps

# If Docker not running, start Docker Desktop

# Restart Supabase
supabase stop
supabase start

# Check Supabase status
supabase status
```

---

### Issue 4: Database Migration Errors

**Symptoms:**
```
Error: relation "secrets" does not exist
```

**Cause:** Migrations not applied or applied in wrong order.

**Solution:**
```bash
# Reset database (⚠️ destroys all data)
supabase db reset

# Or apply migrations manually
supabase migration up

# Verify migrations
supabase migration list
```

---

### Issue 5: Environment Variables Not Loading

**Symptoms:**
```
TypeError: Cannot read property 'SUPABASE_URL' of undefined
```

**Cause:** `.env.local` not created or variables not prefixed with `NEXT_PUBLIC_`.

**Solution:**
```bash
# Verify .env.local exists
ls -la .env.local

# Check if variables are correctly prefixed
cat .env.local | grep NEXT_PUBLIC_

# Restart Next.js (required to load new .env changes)
# Press Ctrl+C and run:
pnpm dev
```

---

### Issue 6: CORS Errors in Browser

**Symptoms:**
```
Access to fetch at 'http://localhost:8787' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Cause:** Cloudflare Workers not configured to allow `localhost:3000` origin.

**Solution:**

Edit `workers/src/index.ts`:
```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://abyrith.com',
];
```

---

### Issue 7: Slow Next.js Build Times

**Symptoms:**
Next.js build takes > 30 seconds on file change.

**Cause:** Too many files, large dependencies, or no Turbopack.

**Solution:**
```bash
# Use Turbopack (faster bundler)
pnpm dev --turbo

# Clear cache
rm -rf .next
pnpm dev

# Reduce checked files in tsconfig.json
# Edit tsconfig.json:
{
  "exclude": ["node_modules", ".next", "out"]
}
```

---

## Hot Module Replacement & Debugging

### Next.js Hot Module Replacement (HMR)

**How it works:**
- Next.js automatically detects file changes in `app/`, `components/`, `lib/`
- Browser reloads changed components without full page refresh
- State is preserved where possible

**Test HMR:**
1. Edit a React component (e.g., `components/ui/button.tsx`)
2. Save file (Cmd+S / Ctrl+S)
3. Browser updates instantly (< 1 second)

**If HMR not working:**
```bash
# Restart dev server
# Press Ctrl+C
pnpm dev

# Or use legacy watcher
pnpm dev --no-turbo
```

---

### Debugging Frontend (Chrome DevTools)

**1. Open DevTools:**
- Chrome/Edge: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- Firefox: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)

**2. Set Breakpoints:**
- Sources tab → Open file (e.g., `lib/api/client.ts`)
- Click line number to set breakpoint
- Trigger action in app (e.g., fetch secrets)
- Execution pauses at breakpoint

**3. Inspect State:**
- Console tab → Type `window.__ZUSTAND__` to inspect Zustand state
- Components tab (React DevTools) → Inspect component props/state

**4. Network Inspection:**
- Network tab → Filter by "Fetch/XHR"
- Click request to see headers, payload, response
- Verify JWT token in `Authorization` header

---

### Debugging Workers (Wrangler DevTools)

**1. Enable Wrangler DevTools:**
```bash
# Start Wrangler with devtools
wrangler dev --port 8787 --inspector-port 9229

# Or press 'd' in Wrangler terminal to open DevTools
```

**2. Open Chrome DevTools:**
```
chrome://inspect
```

**3. Click "inspect" next to your Worker:**
- Set breakpoints in Worker code
- Inspect KV storage
- View console logs

**4. Test Worker locally:**
```bash
# Send test request
curl -X POST http://localhost:8787/api/v1/secrets \
  -H "Authorization: Bearer test-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": "encrypted..."}'
```

---

### VS Code Debugging (Launch Configuration)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Cloudflare Workers: debug",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/workers",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"]
    }
  ]
}
```

**Usage:**
1. Press `F5` in VS Code
2. Select debug configuration
3. Set breakpoints in code
4. Trigger action in app

---

## Common Development Tasks

### Task 1: Add a New Database Table

**1. Create migration file:**
```bash
supabase migration new add_new_table
```

**2. Edit migration file:**
```sql
-- supabase/migrations/<timestamp>_add_new_table.sql

CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users see own data"
  ON new_table FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**3. Apply migration:**
```bash
supabase db reset
```

---

### Task 2: Add a New API Endpoint

**1. Create Worker route:**

Edit `workers/src/router.ts`:
```typescript
const routes = [
  // ... existing routes
  {
    pattern: '/api/v1/new-endpoint',
    methods: ['GET', 'POST'],
    backend: BackendService.SUPABASE,
    requireAuth: true,
  },
];
```

**2. Test endpoint:**
```bash
curl http://localhost:8787/api/v1/new-endpoint \
  -H "Authorization: Bearer test-jwt"
```

---

### Task 3: Add a New React Component

**1. Create component file:**
```bash
touch components/new/NewComponent.tsx
```

**2. Write component:**
```typescript
// components/new/NewComponent.tsx
import { FC } from 'react';

interface NewComponentProps {
  title: string;
}

export const NewComponent: FC<NewComponentProps> = ({ title }) => {
  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
  );
};
```

**3. Add to page:**
```typescript
// app/page.tsx
import { NewComponent } from '@/components/new/NewComponent';

export default function Home() {
  return <NewComponent title="Hello World" />;
}
```

---

### Task 4: Run Database Queries

**1. Via Supabase Studio:**
- Open http://localhost:54323
- Click "SQL Editor" in sidebar
- Write query:
  ```sql
  SELECT * FROM secrets WHERE project_id = 'uuid';
  ```
- Click "Run"

**2. Via psql:**
```bash
psql postgresql://postgres:postgres@localhost:54322/postgres

-- List all secrets
SELECT id, service_name, key_name, created_at FROM secrets;

-- Exit
\q
```

**3. Via code:**
```typescript
const { data, error } = await supabase
  .from('secrets')
  .select('*')
  .eq('project_id', projectId);
```

---

### Task 5: Test API Endpoints with Postman/Thunder Client

**1. Install Thunder Client (VS Code extension):**
```bash
code --install-extension rangav.vscode-thunder-client
```

**2. Create new request:**
- Method: `GET`
- URL: `http://localhost:8787/api/v1/secrets`
- Headers:
  - `Authorization: Bearer <jwt-token>`
  - `Content-Type: application/json`

**3. Send request and inspect response.**

---

## Next Steps

After successfully setting up your local environment, explore these resources:

**1. Development Workflow:**
- Read `CONTRIBUTING.md` for contribution guidelines
- Read `11-development/code-review-checklist.md` for PR standards
- Read `11-development/testing/testing-strategy.md` for testing approach

**2. Architecture Documentation:**
- Read `07-frontend/frontend-architecture.md` for frontend patterns
- Read `06-backend/cloudflare-workers/workers-architecture.md` for API gateway
- Read `04-database/database-overview.md` for database design

**3. Feature Implementation:**
- Read `08-features/` for feature specifications
- Read `05-api/endpoints/` for API contracts
- Read `03-security/security-model.md` for security requirements

**4. Join the Team:**
- Slack channel: `#abyrith-dev`
- Weekly standup: Mondays 10am PT
- Office hours: Fridays 2-4pm PT

---

## References

### Internal Documentation
- `TECH-STACK.md` - Complete technology specifications
- `04-database/database-overview.md` - Database architecture
- `06-backend/cloudflare-workers/workers-architecture.md` - Workers architecture
- `07-frontend/frontend-architecture.md` - Frontend architecture
- `GLOSSARY.md` - Technical terminology
- `CONTRIBUTING.md` - Contribution guidelines

### External Resources
- [Next.js Documentation](https://nextjs.org/docs) - Next.js 14 App Router
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development) - Supabase CLI guide
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/) - Cloudflare Workers CLI
- [pnpm Documentation](https://pnpm.io/) - pnpm package manager
- [VS Code Documentation](https://code.visualstudio.com/docs) - VS Code guide

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Engineering Team | Initial local development setup guide |

---

## Notes

### Known Issues
- **Docker on Windows:** May require WSL 2 for Supabase CLI
- **Apple M1/M2:** Some Docker images may take longer to build (Rosetta translation)
- **Port conflicts:** If ports are in use, you can configure alternative ports in `.env.local`

### Future Enhancements
- Docker Compose setup for simplified multi-service startup
- Dev container configuration for VS Code/GitHub Codespaces
- Automated setup script (`setup.sh`) for one-command initialization
- Pre-commit hooks setup documentation (Husky + lint-staged)

### Feedback
If you encounter issues not covered in this guide, please:
1. Check `#abyrith-dev` Slack channel for solutions
2. Open an issue on GitHub with "local-setup" label
3. Update this document with your solution (PR welcome!)

**Last Updated:** 2025-10-30 (review quarterly)
