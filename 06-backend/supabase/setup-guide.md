---
Document: Supabase Backend Setup Guide
Version: 1.0.0
Last Updated: 2025-11-02
Owner: Backend Engineer / DevOps
Status: Draft
Dependencies: TECH-STACK.md, 04-database/schemas/users-organizations.md, 04-database/schemas/secrets-metadata.md, 04-database/schemas/audit-logs.md, MACOS-DEVELOPMENT-SETUP.md, 03-security/security-model.md
---

# Supabase Backend Setup Guide

## Overview

This guide provides complete step-by-step instructions for setting up the Supabase backend infrastructure for Abyrith, including database configuration, authentication, Row-Level Security (RLS) policies, connection pooling, and production-ready monitoring. Supabase serves as the primary backend-as-a-service platform, providing PostgreSQL database, authentication, real-time subscriptions, and storage.

**Purpose:** Complete Supabase project setup from initial project creation through production deployment

**Frequency:** One-time setup for each environment (development, staging, production)

**Estimated Time:** 2-4 hours for complete setup (faster for experienced users)

**Risk Level:** Medium (requires careful configuration of security policies and authentication)

---

## Table of Contents

1. [When to Use This Guide](#when-to-use-this-guide)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [Part 1: Project Creation](#part-1-project-creation)
5. [Part 2: Database Configuration](#part-2-database-configuration)
6. [Part 3: Authentication Configuration](#part-3-authentication-configuration)
7. [Part 4: Connection Pooling Setup](#part-4-connection-pooling-setup)
8. [Part 5: Environment Variables](#part-5-environment-variables)
9. [Part 6: Database Migrations](#part-6-database-migrations)
10. [Part 7: RLS Policy Activation](#part-7-rls-policy-activation)
11. [Part 8: Backup Configuration](#part-8-backup-configuration)
12. [Part 9: Monitoring Setup](#part-9-monitoring-setup)
13. [Verification](#verification)
14. [Troubleshooting](#troubleshooting)
15. [Post-Setup](#post-setup)
16. [References](#references)
17. [Change Log](#change-log)

---

## When to Use This Guide

### Triggers

**Use this guide when:**
- Setting up a new Supabase project for Abyrith (development, staging, or production)
- Migrating to a new Supabase organization or project
- Recovering from a catastrophic database failure (requires restore from backup)
- Setting up a local development environment with Supabase CLI

**Do NOT use this guide when:**
- Making routine database schema changes (use migration guide instead)
- Updating application code (no Supabase changes needed)
- Troubleshooting individual RLS policies (see RLS troubleshooting guide)

### Scope

**What this covers:**
- Complete Supabase project setup from scratch
- All database configuration (PostgreSQL 15.x settings)
- Authentication configuration (JWT, OAuth providers, MFA)
- Connection pooling (PgBouncer) for optimal performance
- Environment variable management
- Database migration execution
- RLS policy activation and testing
- Backup and disaster recovery configuration
- Monitoring and alerting setup

**What this does NOT cover:**
- Application code deployment (see deployment guide)
- Cloudflare Workers setup (see Workers architecture guide)
- Frontend deployment (see Cloudflare Pages guide)
- Local development setup (see MACOS-DEVELOPMENT-SETUP.md)

---

## Prerequisites

### Required Access

**Accounts:**
- [ ] Supabase account (https://supabase.com/dashboard) - verified email
- [ ] GitHub account (for OAuth setup)
- [ ] Google Cloud Console account (for OAuth setup, optional)
- [ ] Organization owner or admin access (for production setup)

**Tools Installed:**
- [ ] Supabase CLI (`supabase` command)
- [ ] PostgreSQL client (`psql` command)
- [ ] Node.js 20.x LTS
- [ ] pnpm 8.x
- [ ] Git 2.40+
- [ ] jq (for JSON processing)

**Verification:**
```bash
# Verify all required tools are installed
supabase --version   # Should show 1.x or later
psql --version       # Should show 15.x
node --version       # Should show v20.x.x
pnpm --version       # Should show 8.x.x
git --version        # Should show 2.40+
jq --version         # Should show 1.6+
```

### Required Knowledge

**You should understand:**
- Basic PostgreSQL concepts (tables, indexes, constraints)
- Row-Level Security (RLS) fundamentals
- Environment variable management
- OAuth 2.0 authentication flows
- SQL migration concepts

**Reference documentation:**
- `03-security/security-model.md` - Zero-knowledge architecture
- `04-database/database-overview.md` - Database architecture
- `03-security/rbac/rls-policies.md` - RLS patterns
- `TECH-STACK.md` - Technology specifications

### Required Information

**Before starting, gather:**
- Organization name and slug (for project naming)
- Environment name (development, staging, production)
- OAuth app credentials (if setting up OAuth)
- Database password requirements (strong password generator)
- AWS region preference (closest to your users)

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication
- [ ] Notify team in Slack/communication channel
- [ ] Create setup task/ticket in project management system
- [ ] Document which environment you're setting up (dev/staging/prod)

### 2. Planning
- [ ] Determine database size requirements (starter vs. pro plan)
- [ ] Choose AWS region (us-east-1, eu-west-1, etc.)
- [ ] Plan OAuth provider setup (Google, GitHub, or both)
- [ ] Review security requirements (MFA, email verification)

### 3. Backup Strategy (Production Only)
- [ ] Understand RTO (Recovery Time Objective): 1 hour
- [ ] Understand RPO (Recovery Point Objective): 24 hours (daily backups)
- [ ] Plan for point-in-time recovery (PITR) if on Pro plan

### 4. Security Review
- [ ] Read `03-security/security-model.md`
- [ ] Understand zero-knowledge encryption requirements
- [ ] Review RLS policy requirements from schema docs

### 5. Preparation
- [ ] Read through this entire guide
- [ ] Have emergency contacts ready (Supabase support, team lead)
- [ ] Allocate 2-4 hours for complete setup

---

## Part 1: Project Creation

### Step 1.1: Create Supabase Project

**Purpose:** Create a new Supabase project in the dashboard

**Instructions:**

1. **Navigate to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Sign in with your account (or create one)

2. **Create New Project**
   - Click "New Project" button
   - Select organization (or create new organization)

3. **Configure Project Settings**
   - **Name:** `abyrith-[environment]` (e.g., `abyrith-production`, `abyrith-staging`)
   - **Database Password:** Generate strong password (32+ characters, save in password manager)
   - **Region:** Select closest to your users:
     - US East Coast: `us-east-1` (N. Virginia)
     - US West Coast: `us-west-1` (N. California)
     - Europe: `eu-west-1` (Ireland)
     - Asia Pacific: `ap-southeast-1` (Singapore)
   - **Pricing Plan:**
     - Development/Staging: Free tier (sufficient for testing)
     - Production: Pro plan (recommended for daily backups and PITR)

4. **Create Project**
   - Click "Create new project"
   - Wait 2-5 minutes for provisioning

**Expected output:**
- Project dashboard loads successfully
- Database is "Healthy" status
- Project URL: `https://[project-ref].supabase.co`

**Save these credentials immediately:**
```bash
# Add to password manager or secure note
Project Name: abyrith-production
Project ID: [project-ref-here]
Database Password: [your-strong-password]
Region: us-east-1
```

**Time:** ~5-10 minutes (including provisioning)

---

### Step 1.2: Access Project Settings

**Purpose:** Locate and document key project configuration values

**Instructions:**

1. **Navigate to Project Settings**
   - In Supabase dashboard, click "Settings" (gear icon in left sidebar)
   - Click "General" section

2. **Document Project Details**
   ```bash
   Project Reference ID: [copy from dashboard]
   Project URL: https://[project-ref].supabase.co
   ```

3. **Navigate to API Settings**
   - Click "API" in settings sidebar
   - Document these values:

   ```bash
   # API Configuration
   Project URL: https://[project-ref].supabase.co
   API URL: https://[project-ref].supabase.co/rest/v1
   GraphQL URL: https://[project-ref].supabase.co/graphql/v1

   # API Keys (CRITICAL - KEEP SECURE)
   anon key (public): eyJhbG... (starts with eyJ)
   service_role key (private): eyJhbG... (starts with eyJ)
   ```

   **WARNING:**
   - `anon` key is safe for client-side use (respects RLS)
   - `service_role` key bypasses RLS - NEVER expose to clients
   - Store `service_role` key in environment variables only

4. **Navigate to Database Settings**
   - Click "Database" in settings sidebar
   - Document connection strings:

   ```bash
   # Connection Pooler (PgBouncer) - Use for most connections
   Connection string: postgresql://postgres.{ref}:{password}@{host}:6543/postgres

   # Direct connection - Use for migrations only
   Direct connection: postgresql://postgres.{ref}:{password}@{host}:5432/postgres

   # Connection pool mode: Transaction (default, recommended)
   ```

**Save to `.env.local` (gitignored):**
```bash
# Supabase Configuration
SUPABASE_PROJECT_ID=[project-ref]
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=[anon-key-here]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key-here]

# Database (for migrations)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[host]:5432/postgres
DATABASE_POOLED_URL=postgresql://postgres.[project-ref]:[password]@[host]:6543/postgres
```

**Time:** ~5 minutes

---

## Part 2: Database Configuration

### Step 2.1: Configure PostgreSQL Settings

**Purpose:** Optimize database performance and security settings

**Instructions:**

1. **Navigate to Database Settings**
   - Settings → Database → Configuration

2. **Review Default Settings**
   ```sql
   -- Default PostgreSQL 15.x configuration
   max_connections = 100          -- Connection limit (adjusted by PgBouncer)
   shared_buffers = 128MB         -- Memory for caching
   effective_cache_size = 4GB     -- Planner's assumption of cache size
   work_mem = 4MB                 -- Memory per query operation
   maintenance_work_mem = 64MB    -- Memory for VACUUM, CREATE INDEX
   ```

3. **Enable Required Extensions**
   - Navigate to "Database" → "Extensions"
   - Enable these extensions:

   ```sql
   -- UUID support (should be enabled by default)
   uuid-ossp ✓

   -- Full-text search (for future search features)
   pg_trgm ✓

   -- JSON functions (enabled by default)
   -- No action needed
   ```

4. **Configure Statement Timeout**
   - Settings → Database → Configuration
   - Set statement timeout to prevent runaway queries:

   ```sql
   -- In SQL Editor, run:
   ALTER DATABASE postgres SET statement_timeout = '30s';
   ```

   This prevents queries from running longer than 30 seconds (protects against expensive queries).

**Verification:**
```sql
-- Run in SQL Editor
SHOW max_connections;
SHOW shared_buffers;
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm');
```

**Expected output:**
- `max_connections`: 100
- `shared_buffers`: 128MB
- Both extensions shown in results

**Time:** ~10 minutes

---

### Step 2.2: Configure Database Timezone

**Purpose:** Ensure all timestamps are stored in UTC for consistency

**Instructions:**

1. **Set Database Timezone**
   ```sql
   -- Run in SQL Editor
   ALTER DATABASE postgres SET timezone TO 'UTC';
   ```

2. **Verify Timezone Setting**
   ```sql
   SHOW timezone;
   -- Expected: UTC

   SELECT NOW();
   -- Should show UTC time with +00 offset
   ```

**Expected output:**
```
timezone | UTC
NOW()    | 2025-11-02 10:30:00+00
```

**Time:** ~2 minutes

---

## Part 3: Authentication Configuration

### Step 3.1: Configure JWT Settings

**Purpose:** Configure JSON Web Token (JWT) settings for secure authentication

**Instructions:**

1. **Navigate to Auth Settings**
   - Settings → Authentication → Settings

2. **Review JWT Configuration**
   ```json
   {
     "jwt_secret": "[auto-generated-secret]",
     "jwt_expiry": 3600,
     "jwt_algorithm": "HS256"
   }
   ```

   **Default values (DO NOT CHANGE unless required):**
   - JWT Secret: Auto-generated (keep secure, rotated by Supabase)
   - JWT Expiry: 3600 seconds (1 hour) - can be adjusted
   - Algorithm: HS256 (HMAC with SHA-256)

3. **Configure JWT Expiry (Optional)**
   - For development: Keep default 1 hour
   - For production: Consider 4 hours (14400 seconds) for better UX

   ```bash
   # To update JWT expiry:
   # Settings → Authentication → Settings → JWT Expiry
   JWT Expiry: 14400  # 4 hours
   ```

4. **Enable Refresh Tokens**
   - Settings → Authentication → Settings
   - Verify "Enable refresh tokens" is ON (default)
   - Refresh token lifetime: 2592000 seconds (30 days)

**Verification:**
- JWT settings saved successfully
- Refresh tokens enabled
- JWT expiry set to desired value

**Time:** ~5 minutes

---

### Step 3.2: Configure Email Authentication

**Purpose:** Set up email/password authentication (primary authentication method)

**Instructions:**

1. **Navigate to Authentication Providers**
   - Settings → Authentication → Providers

2. **Configure Email Provider**
   - Email: Enable ✓
   - Confirm email: Enable ✓ (recommended for production)
   - Secure email change: Enable ✓ (requires re-verification)
   - Auto confirm email: Disable for production (enable for dev/testing)

3. **Configure Email Templates**
   - Settings → Authentication → Email Templates

   **Customize templates (optional but recommended):**

   **Confirmation Email:**
   ```html
   Subject: Confirm your Abyrith account

   <h2>Confirm your email</h2>
   <p>Follow this link to confirm your email address for Abyrith:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
   <p>This link expires in 24 hours.</p>
   ```

   **Password Reset:**
   ```html
   Subject: Reset your Abyrith password

   <h2>Reset your password</h2>
   <p>Follow this link to reset your password:</p>
   <p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
   <p>This link expires in 1 hour.</p>
   <p>If you didn't request this, you can safely ignore this email.</p>
   ```

4. **Configure SMTP (Production Only)**
   - Settings → Authentication → SMTP Settings
   - For production, use custom SMTP (more reliable deliverability)

   **Options:**
   - SendGrid (recommended)
   - AWS SES
   - Mailgun
   - Postmark

   **Example SendGrid configuration:**
   ```bash
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Password: [your-sendgrid-api-key]
   Sender Email: noreply@abyrith.com
   Sender Name: Abyrith
   ```

**Verification:**
```bash
# Test email authentication (SQL Editor)
# This will send a test email if SMTP is configured
SELECT auth.send_confirmation('test@example.com');
```

**Time:** ~15 minutes

---

### Step 3.3: Configure OAuth Providers

**Purpose:** Set up Google and GitHub OAuth for social login

#### Google OAuth Setup

**Instructions:**

1. **Create Google OAuth App**
   - Go to https://console.cloud.google.com
   - Create new project (or select existing): "Abyrith"
   - Enable "Google+ API"
   - Navigate to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"

2. **Configure OAuth Consent Screen**
   - User Type: External
   - App name: Abyrith
   - User support email: support@abyrith.com
   - Developer contact: your@email.com
   - Scopes: email, profile, openid

3. **Create OAuth Client ID**
   - Application type: Web application
   - Name: Abyrith Production
   - Authorized JavaScript origins:
     ```
     https://[project-ref].supabase.co
     https://abyrith.com
     ```
   - Authorized redirect URIs:
     ```
     https://[project-ref].supabase.co/auth/v1/callback
     ```

4. **Save Credentials**
   ```bash
   Client ID: [your-client-id].apps.googleusercontent.com
   Client Secret: [your-client-secret]
   ```

5. **Configure in Supabase**
   - Settings → Authentication → Providers → Google
   - Enable: ✓
   - Client ID: [paste-client-id]
   - Client Secret: [paste-client-secret]
   - Redirect URL (auto-filled): https://[project-ref].supabase.co/auth/v1/callback

#### GitHub OAuth Setup

**Instructions:**

1. **Create GitHub OAuth App**
   - Go to https://github.com/settings/developers
   - Click "New OAuth App"

2. **Configure OAuth App**
   - Application name: Abyrith
   - Homepage URL: https://abyrith.com
   - Authorization callback URL:
     ```
     https://[project-ref].supabase.co/auth/v1/callback
     ```

3. **Save Credentials**
   ```bash
   Client ID: [your-github-client-id]
   Client Secret: [your-github-client-secret]
   ```

4. **Configure in Supabase**
   - Settings → Authentication → Providers → GitHub
   - Enable: ✓
   - Client ID: [paste-client-id]
   - Client Secret: [paste-client-secret]
   - Redirect URL (auto-filled): https://[project-ref].supabase.co/auth/v1/callback

**Verification:**
- Google OAuth enabled and configured
- GitHub OAuth enabled and configured
- Redirect URLs match exactly

**Time:** ~20-30 minutes

---

### Step 3.4: Configure MFA (Multi-Factor Authentication)

**Purpose:** Enable TOTP-based MFA for enhanced security

**Instructions:**

1. **Navigate to MFA Settings**
   - Settings → Authentication → Settings
   - Scroll to "Multi-Factor Authentication"

2. **Enable MFA**
   - TOTP (Time-based One-Time Password): Enable ✓
   - Max enrolled factors: 10 (allows users to have multiple TOTP devices)

3. **Configure MFA Requirements**
   - For Production: Strongly recommend MFA for Admin/Owner roles
   - For Development: Optional (can be disabled for easier testing)

**Note:** MFA enrollment is user-initiated from the frontend. This setting enables the capability.

**Time:** ~5 minutes

---

## Part 4: Connection Pooling Setup

### Step 4.1: Configure PgBouncer

**Purpose:** Set up connection pooling to optimize database connections and performance

**Instructions:**

1. **Navigate to Database Settings**
   - Settings → Database → Connection Pooling

2. **Review PgBouncer Configuration**
   ```bash
   # PgBouncer is enabled by default on all Supabase projects
   Pool Mode: Transaction (default)
   Max Client Connections: 200
   Default Pool Size: 15
   ```

3. **Understand Pool Modes**
   - **Transaction mode (default, recommended):**
     - Connection returned to pool after each transaction
     - Best for most applications
     - Compatible with prepared statements

   - **Session mode:**
     - Connection held for entire session
     - Required for certain PostgreSQL features (LISTEN/NOTIFY, temp tables)
     - Use direct connection instead

   - **Statement mode:**
     - Most aggressive pooling
     - Not recommended for Supabase (breaks many features)

4. **Use Connection Pooler in Application**
   ```typescript
   // ✅ CORRECT: Use pooled connection (port 6543) for application queries
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY,
     {
       db: {
         schema: 'public'
       },
       auth: {
         persistSession: false
       }
     }
   );

   // Connection string (if needed):
   // postgresql://postgres.[ref]:[password]@[host]:6543/postgres
   ```

5. **Use Direct Connection for Migrations**
   ```bash
   # ✅ CORRECT: Use direct connection (port 5432) for migrations
   DATABASE_URL=postgresql://postgres.[ref]:[password]@[host]:5432/postgres

   # Run migrations
   supabase db push
   ```

**Why This Matters:**
- **Pooled connection (6543):** Efficient for high concurrency (100s of connections)
- **Direct connection (5432):** Required for migrations, schema changes, and certain PostgreSQL features
- Mixing them up can cause "prepared statement does not exist" errors

**Verification:**
```bash
# Test pooled connection
psql "postgresql://postgres.[ref]:[password]@[host]:6543/postgres" -c "SELECT 1;"

# Test direct connection
psql "postgresql://postgres.[ref]:[password]@[host]:5432/postgres" -c "SELECT 1;"
```

**Expected output:**
- Both connections succeed
- Query returns "1"

**Time:** ~5 minutes

---

### Step 4.2: Configure Pool Size

**Purpose:** Optimize connection pool size based on expected load

**Instructions:**

1. **Calculate Required Pool Size**
   ```
   Pool Size Calculation:
   - Free tier: Max 2 concurrent connections (sufficient for dev)
   - Pro tier: Default 15, max adjustable based on plan
   - Enterprise: Custom sizing based on workload

   Recommended formula:
   Pool Size = (Number of app instances × Expected concurrent queries per instance)

   Example:
   - 3 Cloudflare Workers instances
   - 5 concurrent queries per instance
   - Pool size: 3 × 5 = 15 (default is perfect)
   ```

2. **Adjust Pool Size (if needed)**
   - For most applications, **default 15 is sufficient**
   - Only increase if you see connection pool exhaustion errors
   - To adjust: Contact Supabase support or upgrade plan

3. **Monitor Connection Usage**
   - Navigate to: Database → Connection Pooling
   - Watch "Active connections" graph
   - Alert if consistently near pool size limit

**Time:** ~5 minutes

---

## Part 5: Environment Variables

### Step 5.1: Create Environment Configuration

**Purpose:** Set up environment variables for all environments

**Instructions:**

1. **Create `.env.local` (Development)**
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]

   # Server-side only (never expose to client)
   SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

   # Database (for migrations and direct access)
   DATABASE_URL=postgresql://postgres.[ref]:[password]@[host]:5432/postgres
   DATABASE_POOLED_URL=postgresql://postgres.[ref]:[password]@[host]:6543/postgres

   # Optional: Supabase CLI
   SUPABASE_ACCESS_TOKEN=[personal-access-token]
   SUPABASE_DB_PASSWORD=[database-password]
   ```

2. **Add to `.gitignore`**
   ```bash
   # Ensure .env.local is never committed
   echo ".env.local" >> .gitignore
   echo ".env.*.local" >> .gitignore
   ```

3. **Create `.env.example` (Template)**
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

   # Server-side only
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

   # Database
   DATABASE_URL=postgresql://postgres.[ref]:password@[host]:5432/postgres
   DATABASE_POOLED_URL=postgresql://postgres.[ref]:password@[host]:6543/postgres
   ```

4. **Configure Production Environment Variables**
   - For Cloudflare Workers (API):
     ```bash
     wrangler secret put SUPABASE_URL
     wrangler secret put SUPABASE_SERVICE_ROLE_KEY
     wrangler secret put DATABASE_URL
     ```

   - For Cloudflare Pages (Frontend):
     - Navigate to project settings
     - Add environment variables:
       - `NEXT_PUBLIC_SUPABASE_URL`
       - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Security Notes:**
- ✅ `NEXT_PUBLIC_*` variables are safe for client-side (public)
- ❌ `SERVICE_ROLE_KEY` must NEVER be exposed to client
- ❌ Database passwords must NEVER be in client-side code
- ✅ Use Cloudflare Workers secrets for server-side keys

**Verification:**
```bash
# Test environment variables are loaded
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
# Should output: https://[project-ref].supabase.co
```

**Time:** ~10 minutes

---

## Part 6: Database Migrations

### Step 6.1: Initialize Supabase Locally

**Purpose:** Set up local Supabase CLI project for managing migrations

**Instructions:**

1. **Link Local Project to Supabase**
   ```bash
   # Navigate to project root
   cd /path/to/abyrith

   # Link to remote Supabase project
   supabase link --project-ref [your-project-ref]
   # Enter database password when prompted
   ```

2. **Verify Link**
   ```bash
   supabase db remote list
   # Should show tables from remote database (if any exist)
   ```

**Expected output:**
```
Linked to project ref: [project-ref]
```

**Time:** ~5 minutes

---

### Step 6.2: Run Database Migrations

**Purpose:** Execute all database schema migrations to set up tables, RLS policies, and functions

**Instructions:**

1. **Review Migration Files**
   ```bash
   # List all migrations
   ls supabase/migrations/*.sql

   # Expected files (from schema docs):
   # 001_create_users_organizations.sql
   # 002_create_secrets_schema.sql
   # 003_create_audit_logs_schema.sql
   ```

2. **Run Migrations Against Remote Database**
   ```bash
   # Push migrations to remote database
   supabase db push

   # This will:
   # 1. Connect to remote database (direct connection, port 5432)
   # 2. Run all migrations that haven't been executed yet
   # 3. Update migration history table
   ```

3. **Monitor Migration Progress**
   ```
   Output should show:
   ✓ Running migration 001_create_users_organizations.sql
   ✓ Running migration 002_create_secrets_schema.sql
   ✓ Running migration 003_create_audit_logs_schema.sql
   Finished supabase db push.
   ```

**If migrations fail:**
```bash
# Check migration status
supabase migration list

# View migration history
supabase db remote list

# Rollback if needed (DANGEROUS - only in development)
# See troubleshooting section for rollback procedures
```

**Verification:**
```bash
# Verify tables were created
supabase db remote list

# Or use SQL Editor in dashboard:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

**Expected tables:**
- organizations
- organization_members
- project_members
- user_preferences
- projects
- environments
- secrets
- secret_metadata
- api_service_info
- audit_logs
- access_events
- mcp_requests

**Time:** ~10 minutes (including verification)

---

### Step 6.3: Generate TypeScript Types

**Purpose:** Generate TypeScript types from database schema for type-safe queries

**Instructions:**

1. **Generate Types**
   ```bash
   # Generate TypeScript types from remote database
   supabase gen types typescript --linked > types/supabase.ts
   ```

2. **Verify Types Generated**
   ```bash
   # Check types file
   cat types/supabase.ts | head -50

   # Should see:
   # export type Json = ...
   # export interface Database {
   #   public: {
   #     Tables: {
   #       organizations: { ... }
   #       secrets: { ... }
   #       ...
   ```

3. **Use Types in Application**
   ```typescript
   // Example usage in TypeScript code
   import { Database } from './types/supabase';

   type Secret = Database['public']['Tables']['secrets']['Row'];
   type Organization = Database['public']['Tables']['organizations']['Row'];
   ```

**Time:** ~5 minutes

---

## Part 7: RLS Policy Activation

### Step 7.1: Verify RLS is Enabled

**Purpose:** Ensure Row-Level Security is active on all tables for data isolation

**Instructions:**

1. **Check RLS Status for All Tables**
   ```sql
   -- Run in SQL Editor
   SELECT
     schemaname,
     tablename,
     rowsecurity AS rls_enabled
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```

**Expected output:**
All tables should have `rls_enabled = true`:
- organizations: true ✓
- organization_members: true ✓
- project_members: true ✓
- user_preferences: true ✓
- projects: true ✓
- environments: true ✓
- secrets: true ✓
- secret_metadata: true ✓
- api_service_info: true ✓
- audit_logs: true ✓
- access_events: true ✓
- mcp_requests: true ✓

**If RLS is not enabled on any table:**
```sql
-- Enable RLS manually (should not be needed if migrations ran correctly)
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

**Time:** ~5 minutes

---

### Step 7.2: Verify RLS Policies Exist

**Purpose:** Ensure all RLS policies were created correctly

**Instructions:**

1. **List All RLS Policies**
   ```sql
   -- Run in SQL Editor
   SELECT
     schemaname,
     tablename,
     policyname,
     permissive,
     roles,
     cmd
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

**Expected policies (at minimum):**

**organizations:**
- organizations_select_policy (SELECT, authenticated)
- organizations_insert_policy (INSERT, authenticated)
- organizations_update_policy (UPDATE, authenticated)
- organizations_delete_policy (DELETE, authenticated)

**secrets:**
- secrets_select_policy (SELECT, authenticated)
- secrets_insert_policy (INSERT, authenticated)
- secrets_update_policy (UPDATE, authenticated)
- secrets_delete_policy (DELETE, authenticated)

**audit_logs:**
- audit_logs_select_policy (SELECT, authenticated)
- audit_logs_no_user_insert (INSERT, authenticated) - blocks user inserts
- audit_logs_service_insert (INSERT, service_role) - allows service inserts
- audit_logs_no_update (UPDATE, authenticated) - blocks all updates
- audit_logs_no_delete (DELETE, authenticated) - blocks user deletes

**Verification:**
- Count policies: Should be 40+ policies across all tables
- All tables have SELECT policy
- Audit tables have immutability policies (no UPDATE, restricted DELETE)

**Time:** ~10 minutes

---

### Step 7.3: Test RLS Policies

**Purpose:** Verify RLS policies work correctly (users can only access their own data)

**Instructions:**

1. **Create Test Users**
   ```sql
   -- Run in SQL Editor
   -- Note: This requires service_role privileges

   -- Create test organization
   INSERT INTO organizations (id, name, slug, created_by)
   VALUES (
     '00000000-0000-0000-0000-000000000001'::uuid,
     'Test Org',
     'test-org',
     auth.uid()
   );

   -- Create test user membership (trigger should auto-create owner)
   -- Verify by querying
   SELECT * FROM organization_members
   WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid;
   ```

2. **Test RLS Isolation**
   ```sql
   -- Create a test function to simulate different users
   CREATE OR REPLACE FUNCTION test_rls_as_user(user_id uuid)
   RETURNS TABLE(org_count bigint) AS $$
   BEGIN
     -- Simulate being a specific user
     PERFORM set_config('request.jwt.claim.sub', user_id::text, true);

     -- Query organizations (should only see orgs user is member of)
     RETURN QUERY
     SELECT COUNT(*)::bigint FROM organizations;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Test: User A should see only their orgs
   SELECT test_rls_as_user('[user-a-uuid]'::uuid);

   -- Test: User B should NOT see User A's orgs
   SELECT test_rls_as_user('[user-b-uuid]'::uuid);
   ```

3. **Test Audit Log Immutability**
   ```sql
   -- Try to insert audit log as regular user (should fail)
   INSERT INTO audit_logs (
     user_id, event_type, event_category, action, resource_type
   ) VALUES (
     auth.uid(),
     'secret.read',
     'secret',
     'Test action',
     'secret'
   );
   -- Expected: Error - new row violates row-level security policy

   -- Try to update audit log (should fail)
   UPDATE audit_logs SET action = 'Modified' WHERE id = '[some-id]';
   -- Expected: Error - row-level security policy prevents update
   ```

**Expected results:**
- Users can only see their own organization's data ✓
- Cross-organization access blocked ✓
- Audit logs cannot be modified by users ✓

**If tests fail:**
- Check RLS policies are correctly defined
- Verify `auth.uid()` is being set correctly
- Review migration logs for policy creation errors

**Time:** ~15 minutes

---

## Part 8: Backup Configuration

### Step 8.1: Configure Automatic Backups

**Purpose:** Set up automated backups for disaster recovery

**Instructions:**

1. **Review Backup Settings**
   - Navigate to: Settings → Database → Backups

   **Free Tier:**
   - Daily backups: Last 7 days
   - Point-in-time recovery (PITR): Not available

   **Pro Tier (Recommended for Production):**
   - Daily backups: Last 30 days
   - Point-in-time recovery: Last 7 days
   - Manual snapshots: Up to 10

2. **Enable PITR (Pro Plan Only)**
   - Settings → Database → Backups → Point-in-Time Recovery
   - Enable PITR: ✓
   - Retention: 7 days (default)

   **What is PITR:**
   - Allows restoration to any point in time within the last 7 days
   - Critical for recovering from data corruption or accidental deletion
   - Example: Restore database to 10:30 AM yesterday

3. **Test Backup Restoration (Development Only)**
   ```bash
   # WARNING: Only test in development environment!
   # This will create a new project from backup

   # List available backups
   supabase db backups list --project-ref [project-ref]

   # Restore from backup (creates new database)
   # Do this in Supabase dashboard:
   # Settings → Database → Backups → Click backup → Restore
   ```

**Backup Schedule:**
- Automatic backups: 02:00 UTC daily
- Manual snapshots: On-demand (before major changes)

**Time:** ~10 minutes

---

### Step 8.2: Create Manual Backup

**Purpose:** Create on-demand backup before major changes

**Instructions:**

1. **Create Manual Snapshot**
   - Navigate to: Settings → Database → Backups
   - Click "Create backup"
   - Name: `pre-migration-[date]` or `pre-[change-description]`
   - Click "Create"

2. **Wait for Backup Completion**
   - Backup status: "In progress" → "Completed"
   - Time: 5-15 minutes depending on database size

3. **Verify Backup**
   - Backup should appear in "Manual backups" list
   - Status: Completed ✓
   - Size: Should match database size

**When to create manual backups:**
- Before running major migrations
- Before bulk data operations
- Before schema changes
- Before production deployments

**Time:** ~15-20 minutes (including backup creation)

---

### Step 8.3: Document Recovery Procedures

**Purpose:** Document how to restore from backup in case of disaster

**Instructions:**

1. **Create Recovery Documentation**
   ```markdown
   # Disaster Recovery Procedure

   ## Recovery Time Objective (RTO)
   - Target: 1 hour from detection to restoration

   ## Recovery Point Objective (RPO)
   - Daily backups: Up to 24 hours of data loss
   - PITR (Pro plan): Up to minutes of data loss

   ## Restoration Steps

   ### Option 1: Restore from Daily Backup
   1. Navigate to Settings → Database → Backups
   2. Find most recent backup before incident
   3. Click "Restore" → Creates new project
   4. Update DNS/environment variables to point to new project
   5. Verify data integrity
   6. Update frontend to use new Supabase URL

   ### Option 2: PITR (Pro Plan)
   1. Navigate to Settings → Database → Backups → PITR
   2. Select exact timestamp to restore to
   3. Click "Restore" → Creates new project
   4. Follow steps 4-6 above

   ## Post-Recovery Checklist
   - [ ] Verify all tables present
   - [ ] Verify RLS policies active
   - [ ] Test authentication
   - [ ] Verify recent data exists
   - [ ] Update application environment variables
   - [ ] Notify team and stakeholders
   ```

2. **Save Recovery Documentation**
   - Location: `10-operations/database/disaster-recovery.md`
   - Store offline copy (in case dashboard is inaccessible)

**Time:** ~10 minutes

---

## Part 9: Monitoring Setup

### Step 9.1: Configure Database Monitoring

**Purpose:** Set up monitoring and alerts for database health

**Instructions:**

1. **Review Database Metrics Dashboard**
   - Navigate to: Database → Metrics

   **Key metrics to monitor:**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Connection count
   - Query performance
   - Table sizes

2. **Set Up Alerts (Pro Plan)**
   - Navigate to: Settings → Alerts
   - Configure alerts for:

   **Critical alerts:**
   ```
   Alert: High CPU Usage
   Condition: CPU > 80% for 15 minutes
   Action: Email to ops@abyrith.com

   Alert: Connection Pool Exhaustion
   Condition: Active connections > 90% of pool size
   Action: Email + Slack notification

   Alert: Disk Space Low
   Condition: Disk usage > 85%
   Action: Email to ops@abyrith.com
   ```

3. **Configure Query Performance Monitoring**
   - Navigate to: Database → Query Performance
   - Enable slow query logging
   - Threshold: Queries > 1000ms logged

4. **Set Up External Monitoring (Optional)**
   - Use external monitoring service:
     - Better Uptime
     - Pingdom
     - DataDog

   **Endpoint to monitor:**
   ```
   https://[project-ref].supabase.co/rest/v1/
   Expected response: 200 OK (with auth header)
   ```

**Time:** ~20 minutes

---

### Step 9.2: Configure Auth Monitoring

**Purpose:** Monitor authentication events and detect suspicious activity

**Instructions:**

1. **Review Auth Logs**
   - Navigate to: Authentication → Logs
   - Review recent authentication events:
     - Successful logins
     - Failed login attempts
     - Password resets
     - OAuth authentications

2. **Set Up Auth Alerts (Pro Plan)**
   ```
   Alert: Unusual Failed Login Attempts
   Condition: > 10 failed logins from same IP in 5 minutes
   Action: Email security team

   Alert: Mass Account Creation
   Condition: > 50 new accounts in 1 hour
   Action: Email + Slack notification (possible bot attack)
   ```

3. **Enable Security Event Logging**
   - All authentication events are logged by default
   - Review logs periodically for suspicious patterns
   - Failed logins from multiple IPs
   - Multiple password reset requests
   - OAuth callback errors

**Time:** ~10 minutes

---

### Step 9.3: Set Up Application-Level Monitoring

**Purpose:** Monitor Supabase API usage from application

**Instructions:**

1. **Integrate Sentry (Optional)**
   ```typescript
   // Example Sentry integration for error tracking
   import * as Sentry from '@sentry/nextjs';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     integrations: [
       new Sentry.Integrations.Supabase()
     ]
   });
   ```

2. **Monitor Supabase Client Errors**
   ```typescript
   // Log Supabase errors to monitoring service
   const supabase = createClient(url, key, {
     global: {
       headers: {
         'x-request-id': generateRequestId()
       }
     }
   });

   // Catch and log errors
   const { data, error } = await supabase
     .from('secrets')
     .select('*');

   if (error) {
     console.error('[Supabase Error]', error);
     Sentry.captureException(error);
   }
   ```

3. **Create Health Check Endpoint**
   ```typescript
   // api/health/supabase.ts
   export async function checkSupabaseHealth() {
     const { data, error } = await supabase
       .from('organizations')
       .select('count')
       .limit(1);

     return {
       status: error ? 'unhealthy' : 'healthy',
       latency_ms: /* measure query time */,
       timestamp: new Date().toISOString()
     };
   }
   ```

**Time:** ~15 minutes

---

## Verification

### Post-Setup Verification Checklist

**Complete after all setup steps:**

### 1. Database Verification
```sql
-- Run in SQL Editor

-- ✓ Verify all tables exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Expected: 12+ tables

-- ✓ Verify RLS enabled on all tables
SELECT COUNT(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: 12+ tables

-- ✓ Verify RLS policies exist
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public';
-- Expected: 40+ policies

-- ✓ Verify indexes exist
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public';
-- Expected: 20+ indexes

-- ✓ Verify functions exist
SELECT COUNT(*) FROM information_schema.routines
WHERE routine_schema = 'public';
-- Expected: 5+ functions

-- ✓ Verify triggers exist
SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_schema = 'public';
-- Expected: 8+ triggers
```

### 2. Authentication Verification
- [ ] Email authentication enabled
- [ ] OAuth providers configured (Google, GitHub)
- [ ] MFA enabled
- [ ] Email templates customized
- [ ] JWT settings configured
- [ ] Test login works

### 3. Connection Verification
```bash
# Test pooled connection
psql "$DATABASE_POOLED_URL" -c "SELECT 1;"
# Expected: 1 row returned

# Test direct connection
psql "$DATABASE_URL" -c "SELECT version();"
# Expected: PostgreSQL 15.x
```

### 4. Environment Variables Verification
```bash
# Verify all required env vars are set
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
node -e "console.log(process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')"
# Expected: Both should output values
```

### 5. Backup Verification
- [ ] Daily backups enabled
- [ ] PITR enabled (Pro plan)
- [ ] Manual backup created successfully
- [ ] Recovery documentation created

### 6. Monitoring Verification
- [ ] Database metrics dashboard accessible
- [ ] Alerts configured
- [ ] Auth logging enabled
- [ ] Health check endpoint created

### Success Criteria

**Setup is complete when:**
- [ ] All tables created successfully
- [ ] All RLS policies active
- [ ] Authentication works (email + OAuth)
- [ ] Connection pooling configured
- [ ] Migrations run successfully
- [ ] Backups configured
- [ ] Monitoring active
- [ ] Environment variables set
- [ ] TypeScript types generated
- [ ] Test queries execute successfully

---

## Troubleshooting

### Issue 1: Migration Failed

**Symptoms:**
```
Error: relation "organizations" does not exist
Migration failed: 002_create_secrets_schema.sql
```

**Cause:** Migrations ran out of order or dependency missing

**Solution:**
```bash
# Check migration status
supabase migration list

# Identify which migration failed
# Review migration order in file names (001_, 002_, 003_)

# Check for missing dependencies
# Example: secrets schema depends on organizations schema

# Reset database (DEVELOPMENT ONLY - DESTROYS ALL DATA)
supabase db reset

# Re-run migrations in correct order
supabase db push
```

**If in production:** DO NOT reset. Contact Supabase support.

---

### Issue 2: RLS Policy Blocking Legitimate Access

**Symptoms:**
```
Error: new row violates row-level security policy for table "secrets"
```

**Cause:** User doesn't have required role or membership

**Solution:**
```sql
-- Check user's organization membership
SELECT
  om.organization_id,
  om.role,
  o.name as org_name
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.user_id = auth.uid();

-- Check if user has required role
SELECT has_organization_permission(
  auth.uid(),
  '[organization-id]'::uuid,
  ARRAY['owner', 'admin', 'developer']
);

-- If user should have access but doesn't:
-- 1. Verify organization membership exists
-- 2. Check role is correct
-- 3. Review RLS policy logic
```

---

### Issue 3: Connection Pool Exhausted

**Symptoms:**
```
Error: sorry, too many clients already
Error: remaining connection slots are reserved
```

**Cause:** Too many concurrent connections, pool size too small

**Solution:**
```bash
# 1. Check current connection count
SELECT COUNT(*) FROM pg_stat_activity;

# 2. Identify what's using connections
SELECT
  datname,
  usename,
  application_name,
  state,
  COUNT(*)
FROM pg_stat_activity
GROUP BY datname, usename, application_name, state
ORDER BY count DESC;

# 3. Kill idle connections (if necessary)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';

# 4. Ensure application uses pooled connection (port 6543)
# NOT direct connection (port 5432)

# 5. Consider upgrading plan for larger pool size
```

---

### Issue 4: Slow Queries

**Symptoms:**
- Queries taking > 1 second
- Application feels slow
- Database CPU high

**Solution:**
```sql
-- Identify slow queries
SELECT
  pid,
  now() - query_start as duration,
  query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '1 second'
ORDER BY duration DESC;

-- Check missing indexes
-- Run EXPLAIN on slow queries
EXPLAIN ANALYZE
SELECT * FROM secrets WHERE service_name = 'openai';

-- Add index if needed (example)
CREATE INDEX idx_secrets_service_name
  ON secrets(service_name)
  WHERE service_name IS NOT NULL;
```

---

### Issue 5: OAuth Login Fails

**Symptoms:**
- "OAuth callback error"
- Redirect doesn't work
- "Invalid client ID"

**Solution:**
```bash
# 1. Verify redirect URLs match EXACTLY
Supabase callback URL:
https://[project-ref].supabase.co/auth/v1/callback

OAuth provider redirect URL:
https://[project-ref].supabase.co/auth/v1/callback

# Must match character-for-character (including https://)

# 2. Check client ID and secret
# Re-enter in Supabase dashboard if uncertain

# 3. Check OAuth app is active
# Google: Check OAuth consent screen is published
# GitHub: Check OAuth app is not suspended

# 4. Test with different browser (clear cookies)

# 5. Check Supabase Auth logs for specific error
# Settings → Authentication → Logs
```

---

### Issue 6: Environment Variables Not Loading

**Symptoms:**
```
Error: SUPABASE_URL is undefined
TypeError: Cannot read property 'url' of undefined
```

**Solution:**
```bash
# 1. Verify .env.local exists
ls -la .env.local

# 2. Check file format (no spaces around =)
cat .env.local
# Correct:
SUPABASE_URL=https://...
# Incorrect:
SUPABASE_URL = https://...

# 3. Restart development server
# Environment variables are loaded on startup

# 4. Check variable names match exactly
# NEXT_PUBLIC_ prefix required for client-side variables

# 5. For production, verify secrets are set in deployment platform
wrangler secret list  # Cloudflare Workers
# Or check Cloudflare Pages environment variables
```

---

### Emergency Contacts

**If you need help:**

| Issue | Contact | Response Time |
|-------|---------|---------------|
| Database down | Supabase Support (dashboard) | < 1 hour (Pro plan) |
| Security incident | security@abyrith.com | Immediate |
| Migration failed | Backend team lead | < 30 minutes |
| Production outage | On-call engineer | Immediate |

**Supabase Support:**
- Dashboard: Settings → Support → New ticket
- Email: support@supabase.io
- Discord: https://discord.supabase.com (community support)

---

## Post-Setup

### Cleanup

**After successful setup:**
- [ ] Remove test data (if any)
- [ ] Delete test user accounts
- [ ] Remove debug logging (if added)
- [ ] Document project credentials in team password manager

### Documentation Updates

**Update these documents:**
- [ ] Add Supabase project details to team wiki
- [ ] Update deployment documentation with new URLs
- [ ] Document any custom configurations
- [ ] Update runbook if issues/improvements identified

### Monitoring

**Set up ongoing monitoring:**
- [ ] Add Supabase health check to uptime monitoring
- [ ] Configure alerting to team channel
- [ ] Schedule weekly backup verification
- [ ] Review query performance monthly

### Next Steps

**After Supabase setup is complete:**

1. **Backend Integration**
   - Set up Cloudflare Workers (see `06-backend/cloudflare-workers/architecture.md`)
   - Configure API gateway
   - Set up rate limiting

2. **Frontend Integration**
   - Install Supabase client libraries
   - Configure authentication flows
   - Set up real-time subscriptions

3. **Security Hardening**
   - Review RLS policies with security team
   - Conduct security audit
   - Set up automated security scanning

4. **Performance Optimization**
   - Monitor query performance
   - Add indexes as needed
   - Optimize slow queries

---

## References

### Internal Documentation
- `TECH-STACK.md` - Supabase specifications and version requirements
- `04-database/database-overview.md` - Database architecture
- `04-database/schemas/users-organizations.md` - User and organization schema
- `04-database/schemas/secrets-metadata.md` - Secrets schema
- `04-database/schemas/audit-logs.md` - Audit log schema
- `04-database/migrations/migration-guide.md` - Migration procedures
- `03-security/security-model.md` - Zero-knowledge encryption architecture
- `03-security/rbac/rls-policies.md` - RLS policy patterns
- `03-security/auth/authentication-flow.md` - Authentication details
- `MACOS-DEVELOPMENT-SETUP.md` - Local development setup
- `10-operations/deployment/deployment-runbook.md` - Deployment procedures

### External Resources
- [Supabase Documentation](https://supabase.com/docs) - Official Supabase docs
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/) - PostgreSQL reference
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli) - CLI commands
- [PgBouncer Documentation](https://www.pgbouncer.org/) - Connection pooling
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns
- [OAuth Setup Guide](https://supabase.com/docs/guides/auth/social-login) - Social login setup

### Supabase Support
- **Dashboard Support:** Settings → Support
- **Community Discord:** https://discord.supabase.com
- **GitHub Issues:** https://github.com/supabase/supabase/issues
- **Status Page:** https://status.supabase.com

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-02 | Documentation Creator Agent | Initial Supabase setup guide with complete configuration procedures |

---

## Notes

### Production Considerations

**Before going to production:**
- Upgrade to Pro plan (daily backups, PITR, better support)
- Enable PITR for point-in-time recovery
- Set up custom SMTP for reliable email delivery
- Configure monitoring and alerting
- Review and test backup restoration procedure
- Conduct security audit of RLS policies
- Load test with expected traffic patterns

### Performance Optimization Tips

**Connection pooling:**
- Always use pooled connection (port 6543) for application queries
- Use direct connection (port 5432) only for migrations
- Monitor connection pool usage and adjust if needed

**Query optimization:**
- Review slow query logs weekly
- Add indexes for frequently queried columns
- Use EXPLAIN ANALYZE to optimize complex queries
- Consider materialized views for expensive aggregations

**Database size management:**
- Monitor table sizes (especially audit_logs and access_events)
- Implement data retention policies
- Archive old data to cold storage
- Use partitioning for tables > 10M rows

### Security Best Practices

**Critical security checklist:**
- ✅ Never expose `service_role` key to client-side code
- ✅ Enable RLS on ALL tables (no exceptions)
- ✅ Test RLS policies thoroughly before production
- ✅ Use environment variables for all credentials
- ✅ Enable MFA for admin/owner accounts
- ✅ Review auth logs for suspicious activity
- ✅ Set up automated security alerts
- ✅ Conduct regular security audits

### Common Pitfalls to Avoid

**Database:**
- ❌ Using direct connection (port 5432) for application queries → Use pooled (6543)
- ❌ Forgetting to enable RLS on new tables → Enable by default
- ❌ Creating tables without indexes → Add indexes for foreign keys
- ❌ Not testing RLS policies → Always test before production

**Authentication:**
- ❌ Hardcoding OAuth credentials → Use environment variables
- ❌ Mismatched redirect URLs → Must match exactly
- ❌ Not enabling email confirmation → Required for production
- ❌ Weak password requirements → Enforce strong passwords

**Backups:**
- ❌ Not testing backup restoration → Test in development
- ❌ Relying only on automated backups → Create manual snapshots before major changes
- ❌ Not documenting recovery procedure → Document and practice

### Cost Optimization

**Supabase pricing tiers:**
- **Free:** $0/month - Good for development/testing
  - 500 MB database space
  - 1 GB file storage
  - 2 GB bandwidth
  - 7-day log retention
  - Daily backups (last 7 days)

- **Pro:** $25/month - Recommended for production
  - 8 GB database space
  - 100 GB file storage
  - 250 GB bandwidth
  - 90-day log retention
  - Daily backups (last 30 days) + PITR
  - Email support

- **Enterprise:** Custom pricing
  - Custom database size
  - Dedicated support
  - SLA guarantees
  - Advanced security features

**Cost optimization tips:**
- Start with Free for development
- Use Pro for production (backups and support worth it)
- Monitor database size and clean up old data
- Use connection pooling to reduce connection overhead
- Archive old audit logs to reduce database size

### Future Enhancements

**Planned improvements:**
- Database partitioning for audit_logs table (when > 10M rows)
- Read replicas for read-heavy workloads
- Enhanced monitoring dashboards
- Automated performance tuning
- Advanced security scanning

---

**Setup complete! Your Supabase backend is ready for Abyrith. Next: Configure Cloudflare Workers (see `06-backend/cloudflare-workers/architecture.md`).**
