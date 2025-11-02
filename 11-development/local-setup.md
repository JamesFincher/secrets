---
Document: Local Development Environment Setup
Version: 1.0.0
Last Updated: 2025-11-02
Owner: Engineering Lead
Status: Draft
Dependencies: MACOS-DEVELOPMENT-SETUP.md, 04-database/schemas/users-organizations.md, 04-database/schemas/secrets-metadata.md, 04-database/schemas/audit-logs.md, 04-database/migrations/migration-guide.md, TECH-STACK.md, 10-operations/deployment/deployment-pipeline.md
---

# Local Development Environment Setup

## Overview

This guide walks through setting up a complete local development environment for the Abyrith platform after macOS environment configuration is complete. By following these procedures, you'll have a fully functional development environment with the frontend running on `http://localhost:3000`, database migrations applied, TypeScript types generated, and all tests passing.

**Purpose:** Enable developers to quickly set up and run the Abyrith platform locally for feature development, bug fixes, and testing.

**Prerequisites:** Complete macOS development environment setup per MACOS-DEVELOPMENT-SETUP.md (Node.js 20.x, pnpm 8.x, Git, Supabase CLI, Wrangler CLI).

**Estimated Time:** 15-20 minutes (first-time setup)

---

## Table of Contents

1. [Prerequisites Verification](#prerequisites-verification)
2. [Repository Setup](#repository-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Type Generation](#type-generation)
6. [Running the Development Server](#running-the-development-server)
7. [Running Tests](#running-tests)
8. [Common Development Workflows](#common-development-workflows)
9. [Troubleshooting](#troubleshooting)
10. [Dependencies](#dependencies)
11. [References](#references)
12. [Change Log](#change-log)

---

## Prerequisites Verification

Before starting, verify your development environment is properly configured:

### Required Tools Checklist

```bash
# Verify all required tools are installed
node --version    # Should show v20.x.x
pnpm --version    # Should show 8.x.x
git --version     # Should show 2.40+
psql --version    # Should show 15.x (PostgreSQL client)
supabase --version # Should show 1.x or later
wrangler --version # Should show 3.x or later
```

**Expected Output:**
```
v20.11.0
8.10.5
git version 2.42.0
psql (PostgreSQL) 15.5
1.123.4
3.15.0
```

**If any command fails:** See [MACOS-DEVELOPMENT-SETUP.md](/home/user/secrets/MACOS-DEVELOPMENT-SETUP.md) to install missing tools.

### Authentication Verification

Ensure you're authenticated with external services:

```bash
# Verify Supabase authentication
supabase projects list
# Should list your Supabase projects

# Verify Cloudflare authentication
wrangler whoami
# Should show your Cloudflare account email
```

**If authentication fails:** Run `supabase login` and `wrangler login` to authenticate.

---

## Repository Setup

### Step 1: Clone the Repository

Clone the Abyrith secrets management repository:

```bash
# Clone the repository
git clone https://github.com/JamesFincher/secrets.git abyrith
cd abyrith

# Verify you're in the correct directory
pwd
# Should show: /path/to/abyrith

# Check current branch
git branch
# Should show: * main (or current working branch)
```

**Expected Result:** Repository cloned with all files present.

**Time:** ~30 seconds (depends on network speed)

---

### Step 2: Install Dependencies

Install all project dependencies using pnpm:

```bash
# Install all dependencies
pnpm install

# This will:
# - Install Next.js 14.2.x, React 18.3.x, TypeScript 5.3.x
# - Install Tailwind CSS, shadcn/ui components
# - Install Zustand, React Query for state management
# - Install testing libraries (Vitest, Playwright, Testing Library)
# - Set up Git hooks (Husky) for pre-commit checks
```

**Expected Output:**
```
Progress: resolved 1234, reused 1200, downloaded 34, added 1234, done
Done in 45s
```

**Time:** 1-2 minutes (first install), ~10 seconds (subsequent installs with cache)

**Verification:**

```bash
# Verify node_modules directory exists
ls -la | grep node_modules
# Should show: drwxr-xr-x  node_modules

# Check package versions
pnpm list next react typescript
# Should show Next.js 14.2.x, React 18.3.x, TypeScript 5.3.x
```

---

## Environment Configuration

### Step 3: Create Environment File

Create your local environment configuration file:

```bash
# Copy the environment template
cp .env.example .env.local

# Verify the file was created
ls -la .env.local
# Should show: -rw-r--r--  .env.local
```

**Time:** ~5 seconds

---

### Step 4: Configure Environment Variables

Open `.env.local` in your editor and configure the required variables:

```bash
# Edit environment file
nano .env.local
# or
code .env.local  # If using VS Code
```

**Required Configuration:**

```bash
#
# Supabase Configuration
#

# Supabase project URL (from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase anonymous key (safe to expose to client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase service role key (NEVER expose to client, server-side only)
# Used for admin operations and bypassing RLS (use with caution)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

#
# Cloudflare Configuration
#

# Cloudflare account ID (from Cloudflare dashboard)
CLOUDFLARE_ACCOUNT_ID=abc123def456...

# Cloudflare API token (for Workers deployment)
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

#
# AI Services Configuration
#

# Claude API key (from Anthropic console)
ANTHROPIC_API_KEY=sk-ant-api03-...

# FireCrawl API key (from FireCrawl dashboard)
FIRECRAWL_API_KEY=fc-...

#
# Next.js Configuration
#

# Application base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API base URL (Cloudflare Workers or local)
NEXT_PUBLIC_API_URL=http://localhost:8787

# Environment name
NODE_ENV=development
```

**How to Obtain Required Keys:**

1. **Supabase Credentials:**
   - Go to https://supabase.com/dashboard
   - Select your project (or create one)
   - Navigate to **Settings → API**
   - Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon/public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

2. **Cloudflare Credentials:**
   - Go to https://dash.cloudflare.com
   - Navigate to **Workers & Pages → Account ID** (in right sidebar)
   - Copy Account ID → `CLOUDFLARE_ACCOUNT_ID`
   - Create API Token: **My Profile → API Tokens → Create Token**
   - Use "Edit Cloudflare Workers" template → `CLOUDFLARE_API_TOKEN`

3. **Claude API Key:**
   - Go to https://console.anthropic.com
   - Navigate to **API Keys**
   - Click **Create Key**
   - Copy key → `ANTHROPIC_API_KEY` (starts with `sk-ant-api03-`)

4. **FireCrawl API Key:**
   - Go to https://firecrawl.dev
   - Sign up for account
   - Navigate to **API Keys** in dashboard
   - Copy key → `FIRECRAWL_API_KEY` (starts with `fc-`)

**Security Note:** Never commit `.env.local` to Git. It's already in `.gitignore`.

**Verification:**

```bash
# Check that environment variables are set
cat .env.local | grep NEXT_PUBLIC_SUPABASE_URL
# Should output: NEXT_PUBLIC_SUPABASE_URL=https://...

# Verify .env.local is not tracked by Git
git status
# Should NOT show .env.local in untracked files
```

**Time:** 5-10 minutes (depending on how quickly you gather API keys)

---

## Database Setup

### Step 5: Initialize Supabase Project

Link your local repository to your Supabase project:

```bash
# Initialize Supabase in the project (if not already done)
supabase init

# Link to your remote Supabase project
supabase link --project-ref your-project-ref
# Replace 'your-project-ref' with your actual Supabase project reference
# (found in Supabase dashboard URL: https://supabase.com/dashboard/project/YOUR-REF)

# You'll be prompted to enter your database password
# Enter the password you set when creating the Supabase project
```

**Expected Output:**
```
Linking project...
Enter your database password (or leave blank to skip):
Finished supabase link.
```

**Verification:**

```bash
# Check Supabase configuration
cat supabase/.temp/project-ref
# Should show your project reference ID

# Test database connection
supabase db remote status
# Should show: Database is up and running
```

**Time:** 1-2 minutes

---

### Step 6: Apply Database Migrations

Apply all database migrations to create tables, indexes, and RLS policies:

```bash
# Push all migrations to the remote database
supabase db push

# This will:
# - Create all tables (organizations, projects, secrets, etc.)
# - Apply Row-Level Security (RLS) policies
# - Create indexes for performance optimization
# - Set up triggers for automated timestamps
# - Create helper functions for permissions
```

**Expected Output:**
```
Applying migration 20231029_initial_schema.sql...
Applying migration 20231030_secrets_metadata.sql...
Applying migration 20231031_audit_logs.sql...
Finished supabase db push.
```

**What Gets Created:**

Per [04-database/schemas/users-organizations.md](/home/user/secrets/04-database/schemas/users-organizations.md):
- `organizations` table
- `organization_members` table
- `user_preferences` table
- `project_members` table

Per [04-database/schemas/secrets-metadata.md](/home/user/secrets/04-database/schemas/secrets-metadata.md):
- `projects` table
- `environments` table
- `secrets` table
- `secret_metadata` table
- `api_service_info` table

Per [04-database/schemas/audit-logs.md](/home/user/secrets/04-database/schemas/audit-logs.md):
- `audit_logs` table (tamper-proof, append-only)
- `access_events` table
- `mcp_requests` table

**Verification:**

```bash
# List all tables in the database
supabase db remote list-tables

# Should show:
# - organizations
# - organization_members
# - user_preferences
# - projects
# - project_members
# - environments
# - secrets
# - secret_metadata
# - api_service_info
# - audit_logs
# - access_events
# - mcp_requests

# Verify RLS is enabled on all tables
psql "$DATABASE_URL" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"
# All tables should show: rowsecurity = t (true)
```

**Troubleshooting Migration Issues:**

If migrations fail:

```bash
# Check migration status
supabase migration list

# Reset database (WARNING: This deletes all data!)
supabase db reset

# Reapply migrations
supabase db push
```

**Time:** 30 seconds - 2 minutes (depends on number of migrations)

---

## Type Generation

### Step 7: Generate TypeScript Types

Generate TypeScript type definitions from your Supabase database schema:

```bash
# Generate TypeScript types
supabase gen types typescript --linked > types/supabase.ts

# This creates types/supabase.ts with TypeScript interfaces for:
# - All database tables
# - All table columns with correct types
# - Row-Level Security policies
# - Database functions and views
```

**Expected Output:**
```
Generating types...
Wrote types to types/supabase.ts
```

**Generated File Structure:**

```typescript
// types/supabase.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          // ... all columns with correct types
        }
        Insert: {
          id?: string
          name: string
          // ... required fields for INSERT
        }
        Update: {
          id?: string
          name?: string
          // ... optional fields for UPDATE
        }
      }
      secrets: {
        Row: {
          id: string
          project_id: string
          environment_id: string
          encrypted_value: string
          // ... all columns
        }
        // ... Insert and Update types
      }
      // ... all other tables
    }
    Views: {
      // ... any database views
    }
    Functions: {
      // ... any database functions
    }
  }
}
```

**Using Generated Types:**

```typescript
// In your TypeScript files
import { Database } from '@/types/supabase'

type Organization = Database['public']['Tables']['organizations']['Row']
type SecretInsert = Database['public']['Tables']['secrets']['Insert']
```

**Verification:**

```bash
# Check that types file was created
ls -la types/supabase.ts
# Should show: -rw-r--r--  types/supabase.ts

# Check file is not empty
wc -l types/supabase.ts
# Should show: ~500+ lines

# Verify TypeScript compilation works
pnpm type-check
# Should show: No errors
```

**When to Regenerate Types:**

Regenerate types whenever you:
- Add a new table
- Add/remove/modify columns
- Change column types
- Add database functions
- Modify views

**Command to remember:**
```bash
# Quick alias (add to ~/.zshrc)
alias db-types="supabase gen types typescript --linked > types/supabase.ts"
```

**Time:** 10-30 seconds

---

## Running the Development Server

### Step 8: Start Next.js Development Server

Start the frontend development server with hot reload:

```bash
# Start the development server
pnpm dev

# This will:
# - Start Next.js on http://localhost:3000
# - Enable hot module replacement (HMR) for instant updates
# - Watch for file changes
# - Show build errors in the terminal and browser
```

**Expected Output:**
```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 2.3s
```

**Access the Application:**

Open your browser to:
- **Frontend:** http://localhost:3000
- **API Health Check:** http://localhost:3000/api/health

**What You Should See:**

1. **First Visit:** Landing page or login screen
2. **Console:** No errors (check browser DevTools → Console)
3. **Network Tab:** Successful API calls to Supabase

**Development Server Features:**

- **Hot Reload:** Changes to `.tsx`, `.ts`, `.css` files automatically reload
- **Error Overlay:** Build errors and runtime errors show in browser overlay
- **Fast Refresh:** React components update without losing state
- **TypeScript Checking:** Type errors show in terminal

**Stopping the Server:**

```bash
# Press Ctrl+C in the terminal to stop
^C
```

**Verification:**

```bash
# In another terminal, check that the server is running
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"2025-11-02T..."}

# Check Next.js process
ps aux | grep next-server
# Should show running Next.js process
```

**Time:** 2-5 seconds to start server

---

### Step 9: Start Cloudflare Workers (Optional)

If you're developing backend API routes using Cloudflare Workers:

```bash
# Navigate to Workers directory (if separate repo)
# cd workers

# Start Wrangler development server
wrangler dev

# This will:
# - Start local Workers on http://localhost:8787
# - Enable hot reload for Worker changes
# - Simulate Cloudflare Workers environment
# - Access Workers KV locally
```

**Expected Output:**
```
⛅️ wrangler 3.15.0
-------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

**When to Run Workers Locally:**

- Developing custom API endpoints not covered by Supabase PostgREST
- Testing rate limiting logic
- Testing edge caching with Workers KV
- Testing MCP server integration

**Note:** Most development can be done with Next.js API routes and Supabase. Workers development is optional for advanced features.

---

## Running Tests

### Step 10: Run Unit Tests

Run all unit tests using Vitest:

```bash
# Run all unit tests
pnpm test

# Watch mode (automatically reruns tests on file changes)
pnpm test:watch

# Run specific test file
pnpm test src/lib/encryption.test.ts

# Run tests with coverage report
pnpm test:coverage
```

**Expected Output:**
```
✓ src/lib/encryption.test.ts (12 tests) 234ms
✓ src/components/SecretCard.test.tsx (8 tests) 156ms
✓ src/hooks/useSecrets.test.ts (10 tests) 89ms

Test Files  3 passed (3)
     Tests  30 passed (30)
  Start at  10:30:15
  Duration  1.23s
```

**Coverage Report:**

```bash
pnpm test:coverage

# Generates coverage report in coverage/ directory
# Open coverage/index.html to view detailed report

# Coverage targets:
# - Statements: 80%+
# - Branches: 75%+
# - Functions: 80%+
# - Lines: 80%+
```

**Common Test Commands:**

```bash
# Run only changed tests (fast during development)
pnpm test --changed

# Run tests matching pattern
pnpm test --grep "encryption"

# Run tests in specific directory
pnpm test src/lib/

# Update snapshots (if using snapshot testing)
pnpm test -u
```

**Verification:**

All tests should pass. If any tests fail:

1. Check that database migrations are applied (`supabase db push`)
2. Check that environment variables are set correctly (`.env.local`)
3. Check that dependencies are installed (`pnpm install`)
4. Read the test failure message for specific issues

**Time:** 10-30 seconds (unit tests), 1-2 minutes (with coverage)

---

### Step 11: Run End-to-End Tests

Run E2E tests using Playwright:

```bash
# Install Playwright browsers (first time only)
pnpm playwright install

# Run E2E tests
pnpm test:e2e

# Run E2E tests in headed mode (see browser)
pnpm test:e2e --headed

# Run specific E2E test file
pnpm test:e2e tests/e2e/auth.spec.ts

# Debug E2E tests (opens Playwright Inspector)
pnpm test:e2e --debug
```

**Expected Output:**
```
Running 12 tests using 3 workers

  ✓ tests/e2e/auth.spec.ts:8:1 › login with email and password (2s)
  ✓ tests/e2e/secrets.spec.ts:10:1 › create and decrypt secret (3s)
  ✓ tests/e2e/projects.spec.ts:12:1 › create project and environments (2s)

  12 passed (14s)
```

**E2E Test Coverage:**

- User authentication (login, logout, signup)
- Secret creation and decryption
- Project and environment management
- Team member invitation and role management
- AI Assistant interactions
- MCP request approval workflows

**Prerequisites for E2E Tests:**

- Development server must be running (`pnpm dev`)
- Database must have migrations applied
- Test user accounts may need to be created

**Debugging E2E Tests:**

```bash
# Generate trace for failed tests
pnpm test:e2e --trace on

# View trace in Playwright Trace Viewer
pnpm playwright show-trace trace.zip

# Take screenshots on failure (automatic)
# Screenshots saved to test-results/
```

**Time:** 1-5 minutes (depends on number of tests)

---

## Common Development Workflows

### Workflow 1: Feature Development

**Typical workflow for developing a new feature:**

```bash
# 1. Create feature branch
git checkout -b feature/secret-rotation

# 2. Start development server (in terminal 1)
pnpm dev

# 3. Run tests in watch mode (in terminal 2)
pnpm test:watch

# 4. Make code changes
# - Edit files in src/
# - See changes instantly in browser (hot reload)
# - Tests automatically rerun on file changes

# 5. Add database changes if needed
supabase migration new add_rotation_timestamp_to_secrets
# Edit the generated SQL file in supabase/migrations/
supabase db push
supabase gen types typescript --linked > types/supabase.ts

# 6. Run linting and formatting
pnpm lint
pnpm format

# 7. Run full test suite
pnpm test
pnpm test:e2e

# 8. Commit changes (triggers pre-commit hooks)
git add .
git commit -m "feat: add secret rotation with timestamp tracking"

# Pre-commit hooks automatically run:
# - ESLint (pnpm lint)
# - Prettier (pnpm format)
# - TypeScript type checking (pnpm type-check)
# - Unit tests on changed files

# 9. Push branch
git push origin feature/secret-rotation
```

---

### Workflow 2: Database Schema Changes

**Adding or modifying database tables:**

```bash
# 1. Create new migration
supabase migration new add_secret_tags_table

# 2. Edit migration file
# File created at: supabase/migrations/20251102_add_secret_tags_table.sql
nano supabase/migrations/20251102_add_secret_tags_table.sql

# Example migration content:
-- Create secret_tags table
CREATE TABLE secret_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(secret_id, tag)
);

-- Enable RLS
ALTER TABLE secret_tags ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see tags for secrets they can access
CREATE POLICY "Users can view secret tags they can access"
  ON secret_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM secrets
      WHERE secrets.id = secret_tags.secret_id
      -- Relies on secrets RLS policies
    )
  );

-- Create index for performance
CREATE INDEX idx_secret_tags_secret_id ON secret_tags(secret_id);
CREATE INDEX idx_secret_tags_tag ON secret_tags(tag);

# 3. Apply migration
supabase db push

# 4. Regenerate TypeScript types
supabase gen types typescript --linked > types/supabase.ts

# 5. Verify migration succeeded
supabase migration list
# Should show: 20251102_add_secret_tags_table.sql [APPLIED]

# 6. Test the new table
psql "$DATABASE_URL" -c "SELECT * FROM secret_tags LIMIT 1;"
```

**Rollback a Migration (if needed):**

```bash
# Create rollback migration
supabase migration new rollback_secret_tags_table

# Edit rollback file
-- Drop table and dependencies
DROP TABLE IF EXISTS secret_tags CASCADE;

# Apply rollback
supabase db push
```

See [04-database/migrations/migration-guide.md](/home/user/secrets/04-database/migrations/migration-guide.md) for detailed migration procedures.

---

### Workflow 3: Working with Encrypted Secrets

**Testing client-side encryption locally:**

```typescript
// Example: Test encryption in browser console

// 1. Start dev server and open http://localhost:3000
pnpm dev

// 2. Open browser DevTools Console

// 3. Test encryption functions
import { encrypt, decrypt, deriveMasterKey } from '@/lib/encryption'

// Derive master key from password
const masterKey = await deriveMasterKey('user@example.com', 'test-password-123')

// Encrypt a secret
const plaintext = 'sk-test-api-key-12345'
const encrypted = await encrypt(plaintext, masterKey)
console.log('Encrypted:', encrypted)
// Output: IV:ciphertext:authTag format (Base64)

// Decrypt the secret
const decrypted = await decrypt(encrypted, masterKey)
console.log('Decrypted:', decrypted)
// Output: sk-test-api-key-12345

// Verify round-trip
console.assert(decrypted === plaintext, 'Encryption round-trip failed')
```

**Testing with Different Master Passwords:**

```typescript
// Derive key for User A
const keyA = await deriveMasterKey('usera@example.com', 'password-a')

// Derive key for User B (different password)
const keyB = await deriveMasterKey('userb@example.com', 'password-b')

// Encrypt with User A's key
const encrypted = await encrypt('secret-data', keyA)

// Attempt to decrypt with User B's key
try {
  const decrypted = await decrypt(encrypted, keyB)
  console.error('Should have failed!')
} catch (error) {
  console.log('✓ Correctly failed to decrypt with wrong key')
}
```

See [07-frontend/client-encryption/webcrypto-implementation.md](/home/user/secrets/07-frontend/client-encryption/webcrypto-implementation.md) for encryption implementation details.

---

### Workflow 4: Testing API Endpoints

**Using curl to test API endpoints:**

```bash
# 1. Get authentication token (from browser DevTools)
# Login to http://localhost:3000
# Open DevTools → Application → Session Storage → supabase.auth.token
# Copy the access_token value

export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Test health check endpoint
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}

# 3. Test authenticated endpoint (list projects)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/projects

# Expected:
# {
#   "data": [
#     {"id":"uuid","name":"RecipeApp",...}
#   ],
#   "pagination": {"page":1,"per_page":20,"total":1}
# }

# 4. Test creating a project
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestProject","description":"Testing API"}'

# Expected:
# {
#   "id": "new-uuid",
#   "name": "TestProject",
#   "description": "Testing API",
#   "created_at": "2025-11-02T..."
# }

# 5. Test error handling (unauthorized request)
curl -X GET http://localhost:3000/api/projects
# Expected:
# {
#   "error": "unauthorized",
#   "message": "Missing or invalid authentication token"
# }
```

**Using Postman/Insomnia:**

1. Import API collection (if available in `05-api/postman/`)
2. Set `baseUrl` variable to `http://localhost:3000`
3. Set `bearerToken` variable to your JWT token
4. Run requests from collection

---

### Workflow 5: Debugging Issues

**Common debugging techniques:**

```bash
# 1. Check Next.js logs
# Terminal running 'pnpm dev' shows all server-side logs

# 2. Check browser console
# Open DevTools → Console
# Look for errors, warnings, network failures

# 3. Check Supabase logs
supabase functions logs
# or visit Supabase dashboard → Logs

# 4. Enable verbose logging
DEBUG=* pnpm dev
# Shows detailed logs from all libraries

# 5. Check TypeScript errors
pnpm type-check
# Shows all type errors without running

# 6. Check database connection
psql "$DATABASE_URL" -c "SELECT 1"
# Should output: 1

# 7. Verify environment variables are loaded
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
# Should output your Supabase URL

# 8. Clear Next.js cache (if strange behavior)
rm -rf .next
pnpm dev

# 9. Clear pnpm cache (if dependency issues)
pnpm store prune
pnpm install

# 10. Reset database (nuclear option)
supabase db reset
# WARNING: Deletes all data!
```

---

## Troubleshooting

### Issue 1: `pnpm install` fails with permission errors

**Symptoms:**
```
EACCES: permission denied, mkdir '/Users/name/.pnpm-store'
```

**Cause:** pnpm store directory has incorrect permissions.

**Solution:**

```bash
# Fix pnpm permissions
sudo chown -R $(whoami) ~/.pnpm-store

# Retry installation
pnpm install
```

**Prevention:** Don't run `pnpm install` with `sudo`.

---

### Issue 2: Database connection fails with "permission denied"

**Symptoms:**
```
Error: permission denied for schema public
```

**Cause:** Database user doesn't have correct permissions.

**Solution:**

```bash
# 1. Check database URL is correct
echo $DATABASE_URL
# Should show: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# 2. Verify service role key is correct in .env.local
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY

# 3. Reconnect to Supabase
supabase link --project-ref your-project-ref

# 4. Retry migration
supabase db push
```

---

### Issue 3: TypeScript errors after generating types

**Symptoms:**
```
Type 'string | null' is not assignable to type 'string'
```

**Cause:** Generated types include `null` for nullable columns, but code expects non-null.

**Solution:**

```typescript
// Option 1: Handle null explicitly
const name: string = organization.name ?? 'Unknown'

// Option 2: Use type assertion (if you're certain it's not null)
const name: string = organization.name!

// Option 3: Update database schema to make column NOT NULL
-- In migration:
ALTER TABLE organizations ALTER COLUMN name SET NOT NULL;
```

**Prevention:** Design database schema with appropriate nullable/non-nullable constraints.

---

### Issue 4: Hot reload not working

**Symptoms:**
- Make changes to code
- Browser doesn't update
- Need to manually refresh

**Cause:** Various Next.js issues or file watcher limits.

**Solution:**

```bash
# 1. Restart development server
# Press Ctrl+C, then:
pnpm dev

# 2. Clear Next.js cache
rm -rf .next
pnpm dev

# 3. Increase file watcher limit (macOS/Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 4. Check for syntax errors
pnpm type-check
pnpm lint
```

---

### Issue 5: Tests fail with "Cannot find module"

**Symptoms:**
```
Error: Cannot find module '@/lib/encryption'
```

**Cause:** TypeScript path aliases not configured for tests.

**Solution:**

```bash
# 1. Verify tsconfig.json has correct paths
cat tsconfig.json
# Should include:
# "paths": {
#   "@/*": ["./src/*"]
# }

# 2. Verify vitest.config.ts has path resolution
cat vitest.config.ts
# Should include:
# resolve: {
#   alias: {
#     '@': path.resolve(__dirname, './src')
#   }
# }

# 3. Restart test watcher
# Press Ctrl+C, then:
pnpm test:watch
```

---

### Issue 6: Environment variables undefined in browser

**Symptoms:**
```
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
// Output: undefined
```

**Cause:** Environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

**Solution:**

```bash
# 1. Check .env.local has correct prefix
cat .env.local | grep NEXT_PUBLIC

# 2. Verify variable is defined
NEXT_PUBLIC_SUPABASE_URL=https://...
# NOT: SUPABASE_URL=https://... (missing NEXT_PUBLIC_ prefix)

# 3. Restart development server
# Press Ctrl+C, then:
pnpm dev
```

**Note:** Server-side code can access variables without `NEXT_PUBLIC_` prefix. Client-side code cannot.

---

### Issue 7: RLS policies blocking database queries

**Symptoms:**
```
Error: new row violates row-level security policy for table "projects"
```

**Cause:** Row-Level Security (RLS) policies prevent the operation.

**Debugging:**

```bash
# 1. Check RLS policies for the table
psql "$DATABASE_URL" -c "\d+ projects"
# Shows RLS policies applied to the table

# 2. Check your JWT token claims
# In browser console:
const token = localStorage.getItem('supabase.auth.token')
const decoded = JSON.parse(atob(token.split('.')[1]))
console.log(decoded)
// Should show: { sub: 'user-id', role: 'authenticated', ... }

# 3. Test query as service role (bypasses RLS)
# In .env.local, temporarily use service role key for testing
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 4. Review RLS policy logic
# Open 03-security/rbac/rls-policies.md
# Check policy for the specific table and operation
```

**Solution:**

Either:
1. Fix RLS policy to allow the operation
2. Fix application code to meet policy requirements
3. Use service role key for admin operations (server-side only!)

See [03-security/rbac/rls-policies.md](/home/user/secrets/03-security/rbac/rls-policies.md) for RLS policy details.

---

### Issue 8: Port 3000 already in use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause:** Another process is using port 3000.

**Solution:**

```bash
# 1. Find process using port 3000
lsof -ti:3000
# Output: 12345 (process ID)

# 2. Kill the process
kill -9 12345

# 3. Or use different port
PORT=3001 pnpm dev
# Server will start on http://localhost:3001

# 4. Or add to .env.local
PORT=3001
```

---

### Issue 9: Prisma/Supabase migration conflicts

**Symptoms:**
```
Migration "20251102_..." failed to apply
```

**Cause:** Conflicting schema changes or out-of-order migrations.

**Solution:**

```bash
# 1. Check migration status
supabase migration list

# 2. Review failed migration SQL
cat supabase/migrations/20251102_....sql

# 3. Reset database (if in development)
supabase db reset
# WARNING: Deletes all data!

# 4. Or manually fix conflict
supabase migration repair 20251102_failed_migration --status applied
```

See [04-database/migrations/migration-guide.md](/home/user/secrets/04-database/migrations/migration-guide.md) for migration troubleshooting.

---

### Issue 10: Out of memory errors during build

**Symptoms:**
```
JavaScript heap out of memory
FATAL ERROR: Reached heap limit
```

**Cause:** Node.js default memory limit too low for large builds.

**Solution:**

```bash
# 1. Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm build

# 2. Or add to package.json scripts
{
  "scripts": {
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
  }
}

# 3. Or reduce bundle size
# - Remove unused dependencies
# - Use dynamic imports for large libraries
# - Optimize images
```

---

## Dependencies

### Technical Dependencies

**Must exist before local setup:**
- [x] MACOS-DEVELOPMENT-SETUP.md - Complete macOS environment configuration
- [x] 04-database/schemas/users-organizations.md - Users and organizations schema
- [x] 04-database/schemas/secrets-metadata.md - Secrets and projects schema
- [x] 04-database/schemas/audit-logs.md - Audit logs schema
- [x] 04-database/migrations/migration-guide.md - Migration procedures
- [x] TECH-STACK.md - Technology versions and specifications

**External Services:**
- Supabase project with database
- Cloudflare account with Workers enabled
- Anthropic Claude API key
- FireCrawl API key (optional)

### Feature Dependencies

**Required for local development:**
- Git repository cloned
- pnpm package manager installed
- Node.js 20.x runtime
- PostgreSQL 15.x client tools
- Supabase CLI
- Wrangler CLI

---

## References

### Internal Documentation

- [MACOS-DEVELOPMENT-SETUP.md](/home/user/secrets/MACOS-DEVELOPMENT-SETUP.md) - Prerequisite macOS setup
- [04-database/database-overview.md](/home/user/secrets/04-database/database-overview.md) - Database architecture
- [04-database/migrations/migration-guide.md](/home/user/secrets/04-database/migrations/migration-guide.md) - Migration procedures
- [07-frontend/frontend-architecture.md](/home/user/secrets/07-frontend/frontend-architecture.md) - Frontend architecture
- [07-frontend/client-encryption/webcrypto-implementation.md](/home/user/secrets/07-frontend/client-encryption/webcrypto-implementation.md) - Encryption implementation
- [10-operations/deployment/deployment-pipeline.md](/home/user/secrets/10-operations/deployment/deployment-pipeline.md) - Deployment procedures
- [TECH-STACK.md](/home/user/secrets/TECH-STACK.md) - Technology specifications
- [GLOSSARY.md](/home/user/secrets/GLOSSARY.md) - Term definitions

### External Resources

- [Next.js Documentation](https://nextjs.org/docs) - Next.js framework
- [Supabase Documentation](https://supabase.com/docs) - Supabase platform
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/) - Workers platform
- [pnpm Documentation](https://pnpm.io/) - Package manager
- [Vitest Documentation](https://vitest.dev/) - Testing framework
- [Playwright Documentation](https://playwright.dev/) - E2E testing

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-02 | Documentation Creator Agent | Initial comprehensive local development setup guide covering repository cloning, dependency installation, environment configuration, database migrations, type generation, development server, testing, common workflows, and troubleshooting |

---

## Notes

### Development Tips

**Keyboard Shortcuts:**
- `Ctrl+C` - Stop development server
- `Cmd+Shift+F` (VS Code) - Search across all files
- `Cmd+P` (VS Code) - Quick file open
- `Cmd+K Cmd+T` (VS Code) - Change theme (light/dark)

**VS Code Extensions:**
- ESLint - Linting
- Prettier - Code formatting
- Tailwind CSS IntelliSense - Tailwind autocomplete
- TypeScript Error Translator - Better error messages
- Supabase - Database management
- GitLens - Git integration

**Performance Tips:**
- Use `pnpm install --prefer-offline` for faster installs (uses cache)
- Enable Next.js compiler caching in `next.config.js`
- Use `React.memo()` for expensive components
- Implement virtual scrolling for long lists
- Optimize images with Next.js Image component

**Security Tips:**
- Never commit `.env.local` to Git
- Use service role key only in server-side code
- Always validate user input
- Test RLS policies thoroughly
- Review audit logs regularly

### Future Enhancements

- Add Docker Compose for local Supabase instance
- Add Storybook for component development
- Add bundle analyzer for optimization
- Add performance profiling tools
- Add automated screenshot testing

### Maintenance Schedule

- **Weekly:** Update dependencies with `pnpm update`
- **Monthly:** Review and update `.env.local` variables
- **Quarterly:** Update Node.js to latest LTS version
