---
Document: Database Migration Guide - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 04-database/schemas/*.md, TECH-STACK.md, 03-security/rbac/rls-policies.md
---

# Database Migration Guide - Operations Runbook

## Overview

This runbook provides step-by-step procedures for safely creating, testing, and applying database migrations to the Abyrith platform using Supabase. It covers both schema changes (DDL) and data migrations (DML), with emphasis on zero-downtime deployments and security-first practices.

**Purpose:** Ensure all database changes are applied safely, consistently, and reversibly across development, staging, and production environments.

**Frequency:** On-demand (per feature/bug fix requiring database changes)

**Estimated Time:** 15-45 minutes per migration (depending on complexity)

**Risk Level:** High (database changes affect entire platform)

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [Procedure](#procedure)
5. [Verification](#verification)
6. [Rollback](#rollback)
7. [Troubleshooting](#troubleshooting)
8. [Post-Procedure](#post-procedure)
9. [Communication](#communication)
10. [Migration Templates](#migration-templates)
11. [Dependencies](#dependencies)
12. [References](#references)
13. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Adding new tables to the database
- Modifying existing table schemas (adding/removing/changing columns)
- Creating or updating RLS (Row-Level Security) policies
- Adding database indexes for performance
- Creating database functions, triggers, or views
- Migrating data between schema versions
- Updating database constraints or relationships

**Do NOT use this runbook when:**
- Making configuration-only changes (no schema/data changes)
- Testing migrations in local development (use abbreviated version)
- Rolling back a failed migration (see [Rollback](#rollback) section)

### Scope

**What this covers:**
- Supabase CLI migration workflow
- Creating SQL migration files
- Testing migrations locally
- Applying migrations to staging and production
- Data migrations and transformations
- RLS policy deployment
- Index creation strategies

**What this does NOT cover:**
- Application code changes (see deployment runbooks)
- Cloudflare Workers deployment
- Frontend deployment
- Database performance tuning (see `10-operations/database-maintenance.md`)

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Supabase Dashboard - Admin access
- [ ] GitHub repository - Write access
- [ ] Staging environment - Database access
- [ ] Production environment - Database access (for production migrations)

**Credentials:**
- [ ] Supabase project credentials (database URL, service role key)
- [ ] GitHub personal access token (for PR creation)
- [ ] Supabase CLI authentication token

**How to request access:**
Contact the Engineering Lead with your GitHub username and role. Access is granted via Supabase project invitations and GitHub team membership.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
supabase --version    # Should be 1.123.0 or higher
psql --version        # Should be 15.x or higher
git --version         # Should be 2.40+ or higher
node --version        # Should be 20.x LTS
pnpm --version        # Should be 8.x
```

**Installation:**
```bash
# If tools are missing

# Install Supabase CLI (macOS)
brew install supabase/tap/supabase

# Install Supabase CLI (Linux/WSL)
curl -sL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xz
sudo mv supabase /usr/local/bin/

# Install PostgreSQL client tools (macOS)
brew install postgresql@15

# Install PostgreSQL client tools (Linux)
sudo apt-get install postgresql-client-15

# Install Node.js, pnpm if needed
# See 11-development/local-setup.md
```

### Required Knowledge

**You should understand:**
- SQL fundamentals (CREATE TABLE, ALTER TABLE, SELECT, etc.)
- PostgreSQL data types and constraints
- Row-Level Security (RLS) concepts
- Database transactions and ACID properties
- Git workflow and pull requests

**Reference documentation:**
- `04-database/database-overview.md` - Database architecture
- `03-security/rbac/rls-policies.md` - RLS patterns
- `TECH-STACK.md` - Supabase specifications

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication
- [ ] Notify team in `#engineering` Slack channel
- [ ] Create GitHub issue for migration: [GitHub Issues](https://github.com/org/repo/issues)
- [ ] Update status in project tracker (if production migration)

### 2. Backup
- [ ] Verify recent backup exists (Supabase auto-backups daily)
- [ ] Backup timestamp: Check Supabase Dashboard → Database → Backups
- [ ] Backup verification: Confirm backup status is "completed"
- [ ] For critical migrations: Create manual snapshot before proceeding

### 3. Environment Check
- [ ] Verify current database schema version
- [ ] Check for ongoing migrations or deployments
- [ ] Review recent schema changes (check migration history)
- [ ] Check database health metrics (Supabase Dashboard → Logs)

### 4. Timing
- [ ] Confirm maintenance window (if production, use low-traffic period)
- [ ] Verify low-traffic period (check analytics)
- [ ] Coordinate with frontend/backend deployments if needed
- [ ] Allow 2x estimated time for production migrations

### 5. Preparation
- [ ] Read through entire runbook
- [ ] Have rollback SQL prepared (see [Rollback](#rollback))
- [ ] Test migration in local environment first
- [ ] Have emergency contacts ready (Engineering Lead, Database Engineer)

---

## Procedure

### Step 1: Create New Migration File

**Purpose:** Generate a timestamped migration file using Supabase CLI

**Commands:**
```bash
# Navigate to project root
cd /path/to/abyrith

# Create a new migration file
supabase migration new <descriptive_name>

# Example: Adding secrets table
supabase migration new add_secrets_table

# Example: Adding RLS policies
supabase migration new add_rls_policies_secrets

# Example: Adding index for performance
supabase migration new add_index_secrets_project_id
```

**Expected output:**
```
Created new migration at supabase/migrations/20251030120000_add_secrets_table.sql
```

**Migration file location:**
The file is created at `supabase/migrations/YYYYMMDDHHMMSS_<descriptive_name>.sql`

**If something goes wrong:**
- `Error: Not a supabase project` → Run `supabase init` first
- `Error: Migration already exists` → Choose a more specific name

**Time:** ~1 minute

---

### Step 2: Write Migration SQL

**Purpose:** Define the database changes in SQL

**SQL Migration Structure:**
```sql
-- Migration: Add secrets table
-- Created: 2025-10-30
-- Author: [Your Name]

-- ============================================
-- UP MIGRATION (Apply changes)
-- ============================================

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS public.secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,

  -- Encrypted data (client-side encrypted before storage)
  encrypted_value TEXT NOT NULL,
  encryption_iv TEXT NOT NULL, -- Initialization vector for AES-256-GCM

  -- Metadata (NOT encrypted, used for search/organization)
  name VARCHAR(255) NOT NULL,
  description TEXT,
  service_name VARCHAR(255),
  tags TEXT[], -- Array of tags for organization

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  last_accessed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT unique_secret_per_project_env UNIQUE (project_id, environment_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_secrets_project_id ON public.secrets(project_id);
CREATE INDEX idx_secrets_environment_id ON public.secrets(environment_id);
CREATE INDEX idx_secrets_name ON public.secrets(name);
CREATE INDEX idx_secrets_created_at ON public.secrets(created_at DESC);

-- Enable Row-Level Security
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view secrets in their projects"
  ON public.secrets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create secrets in their projects"
  ON public.secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'developer')
    )
  );

CREATE POLICY "Users can update secrets in their projects"
  ON public.secrets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'developer')
    )
  );

CREATE POLICY "Users can delete secrets in their projects"
  ON public.secrets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
```

**Important notes:**
- ⚠️ Always wrap changes in `BEGIN;` and `COMMIT;` for transaction safety
- ⚠️ Use `IF NOT EXISTS` for idempotent migrations
- ⚠️ Always enable RLS on new tables containing user data
- ℹ️ Add comments explaining complex logic
- ℹ️ Include author and date in migration header

**Best Practices:**
- One logical change per migration file
- Use descriptive migration names
- Add indexes AFTER table creation
- Test RLS policies thoroughly
- Consider performance impact of indexes on large tables

**Time:** 10-30 minutes (depending on complexity)

---

### Step 3: Test Migration Locally

**Purpose:** Verify the migration works correctly before applying to shared environments

**Commands:**
```bash
# Start local Supabase (if not already running)
supabase start

# Check current migration status
supabase migration list

# Apply migration to local database
supabase db reset

# Alternative: Apply only new migrations
supabase migration up
```

**Expected output:**
```
Applying migration 20251030120000_add_secrets_table.sql...
Migration applied successfully.
```

**Verify migration:**
```bash
# Connect to local database
supabase db connect

# In psql, verify table exists
\dt public.secrets

# Verify columns
\d public.secrets

# Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'secrets';

# Verify policies exist
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'secrets';

# Exit psql
\q
```

**Test RLS policies:**
```sql
-- Test as authenticated user
SET request.jwt.claim.sub = 'test-user-uuid';

-- This should succeed (if user is member of project)
SELECT * FROM public.secrets WHERE project_id = 'test-project-uuid';

-- This should fail (if user is NOT member of project)
SELECT * FROM public.secrets WHERE project_id = 'other-project-uuid';
```

**If something goes wrong:**
- `Error: syntax error at or near...` → Fix SQL syntax in migration file
- `Error: relation already exists` → Check for duplicate CREATE statements or existing tables
- `Error: constraint violation` → Review foreign key relationships and data

**Checkpoint:** After this step, migration should work perfectly in local environment

**Time:** 5-10 minutes

---

### Step 4: Create Pull Request

**Purpose:** Get migration reviewed before applying to shared environments

**Commands:**
```bash
# Create feature branch
git checkout -b migration/add-secrets-table

# Add migration file
git add supabase/migrations/20251030120000_add_secrets_table.sql

# Commit with descriptive message
git commit -m "feat(db): Add secrets table with RLS policies

- Create secrets table with encrypted value storage
- Add indexes for project_id, environment_id, name
- Implement RLS policies for multi-tenancy
- Add updated_at trigger

Related: #123"

# Push to remote
git push origin migration/add-secrets-table

# Create pull request (using GitHub CLI or web interface)
gh pr create \
  --title "feat(db): Add secrets table with RLS policies" \
  --body "## Summary
- Adds secrets table for encrypted credential storage
- Implements RLS policies for project-based access control
- Includes performance indexes

## Testing
- [x] Tested locally with supabase db reset
- [x] Verified RLS policies work correctly
- [x] Confirmed indexes improve query performance

## Migration Details
- Migration file: 20251030120000_add_secrets_table.sql
- Rollback: See migration file comments
- Risk: Medium (new table, no data migration)

## Checklist
- [x] Migration tested locally
- [x] RLS policies verified
- [x] Rollback plan documented
- [x] Performance impact considered"
```

**Expected:** PR created and assigned to reviewers

**Review checklist for reviewers:**
- [ ] Migration is idempotent (can be run multiple times safely)
- [ ] RLS policies are comprehensive and secure
- [ ] Indexes are appropriate for expected queries
- [ ] Rollback SQL is provided or obvious
- [ ] Migration follows naming conventions
- [ ] No sensitive data in migration file

**Time:** 5 minutes

---

### Step 5: Apply to Staging Environment

**Purpose:** Test migration in environment similar to production

**Commands:**
```bash
# Link to staging Supabase project
supabase link --project-ref <staging-project-ref>

# Verify connection
supabase db ping

# Check current migration status on staging
supabase migration list --remote

# Apply migration to staging
supabase db push

# Alternative: Run specific migration
# supabase migration up --db-url "postgresql://..."
```

**Expected output:**
```
Applying migration 20251030120000_add_secrets_table.sql...
Migration applied successfully to staging.
```

**Verify on staging:**
```bash
# Connect to staging database
supabase db connect --remote

# Verify table, indexes, and RLS (same queries as Step 3)
\dt public.secrets
\d public.secrets
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'secrets';
SELECT policyname FROM pg_policies WHERE tablename = 'secrets';

\q
```

**Smoke test:**
- [ ] Run integration tests against staging
- [ ] Verify API endpoints work with new schema
- [ ] Check Supabase Dashboard for any errors
- [ ] Monitor staging logs for RLS denials or errors

**If something goes wrong:**
- Immediately execute rollback (see [Rollback](#rollback))
- Document issue in PR
- Fix migration and restart from Step 2

**Checkpoint:** Migration successfully applied to staging and verified

**Time:** 10-15 minutes

---

### Step 6: Apply to Production Environment

**Purpose:** Apply verified migration to production database

**⚠️ WARNING: This step affects live users. Proceed with caution.**

**Commands:**
```bash
# Link to production Supabase project
supabase link --project-ref <production-project-ref>

# Verify connection to production
supabase db ping

# CRITICAL: Create manual backup before migration
# (Done via Supabase Dashboard → Database → Backups → Create backup)

# Check current migration status on production
supabase migration list --remote

# Apply migration to production
supabase db push

# Monitor Supabase Dashboard → Logs during migration
```

**Expected output:**
```
Applying migration 20251030120000_add_secrets_table.sql...
Migration applied successfully to production.
```

**Important notes:**
- ⚠️ **Maintenance window:** For large migrations, schedule during low-traffic hours
- ⚠️ **Monitor closely:** Watch Supabase logs for errors
- ⚠️ **Performance impact:** Large index creation may slow queries temporarily
- ℹ️ **Communication:** Update status page if user-facing impact expected

**Time:** 5-10 minutes (monitoring for 15-30 minutes after)

---

## Verification

### Post-Procedure Checks

**1. Database Health:**
```bash
# Connect to production database
supabase db connect --remote

# Verify migration applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;

# Expected: Latest migration version appears in list
```

**Expected:** Migration version `20251030120000` listed with status "applied"

---

**2. Schema Verification:**
```sql
-- Verify table exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'secrets';

-- Verify columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'secrets';

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'secrets';

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'secrets';

-- Verify RLS policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'secrets';
```

**Expected:** All expected columns, indexes, and policies present

---

**3. Functionality Tests:**
```bash
# Run automated test suite
pnpm test:integration

# Run E2E tests against production (read-only tests)
pnpm test:e2e:production
```

**Expected:** All tests pass

---

**4. Monitoring:**
- [ ] Check Supabase Dashboard → Logs (no new errors)
- [ ] Check application error tracking (Sentry, if configured)
- [ ] Verify API response times normal
- [ ] Monitor database connection pool usage

**Metrics to check:**
- Error rate: Should remain < 1% (or baseline)
- Query latency: Should remain < 100ms p95 (or baseline)
- Connection pool: Should not spike unexpectedly

---

**5. User Impact:**
- [ ] Verify users can access application
- [ ] Test key user flows (create secret, read secret, etc.)
- [ ] Check for increased support tickets or error reports

---

### Success Criteria

**Migration is successful when:**
- [ ] Migration appears in `schema_migrations` table
- [ ] All schema changes (tables, columns, indexes, policies) are present
- [ ] RLS policies enforce expected access control
- [ ] Automated tests pass
- [ ] No errors in logs
- [ ] Metrics within normal range
- [ ] No user-reported issues

---

## Rollback

### When to Rollback

**Rollback if:**
- Migration fails to apply (syntax error, constraint violation)
- RLS policies block legitimate user access
- Performance degrades significantly (p95 latency > 2x baseline)
- Data corruption detected
- Critical functionality breaks
- 30 minutes have passed without successful verification

### Rollback Procedure

**Step 1: Assess Damage**
```sql
-- Check how many rows affected (if data migration)
SELECT COUNT(*) FROM public.secrets;

-- Check for locked transactions
SELECT * FROM pg_stat_activity
WHERE state = 'active' AND query LIKE '%secrets%';

-- Check for errors in logs
-- (Supabase Dashboard → Logs → Filter for errors)
```

---

**Step 2: Execute Rollback SQL**

For table creation (can be dropped safely if new):
```sql
BEGIN;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view secrets in their projects" ON public.secrets;
DROP POLICY IF EXISTS "Users can create secrets in their projects" ON public.secrets;
DROP POLICY IF EXISTS "Users can update secrets in their projects" ON public.secrets;
DROP POLICY IF EXISTS "Users can delete secrets in their projects" ON public.secrets;

-- Drop triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.secrets;

-- Drop function
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_secrets_project_id;
DROP INDEX IF EXISTS idx_secrets_environment_id;
DROP INDEX IF EXISTS idx_secrets_name;
DROP INDEX IF EXISTS idx_secrets_created_at;

-- Drop table
DROP TABLE IF EXISTS public.secrets CASCADE;

COMMIT;
```

For data migrations (restore from backup):
```bash
# Restore from Supabase backup (via Dashboard)
# Supabase Dashboard → Database → Backups → Restore

# Alternative: Point-in-time recovery
# Contact Supabase support for PITR within 7 days
```

**Time:** 5-10 minutes

---

**Step 3: Verify Rollback**
```sql
-- Verify table removed
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'secrets';

-- Expected: No rows returned

-- Verify application still functions
-- Run smoke tests
```

**Expected:** Database returns to previous state, application functional

---

**Step 4: Notify**
- [ ] Update team in `#engineering` Slack channel: "Migration rolled back"
- [ ] Update GitHub PR with rollback details
- [ ] Document what went wrong (for post-mortem)
- [ ] Schedule fix and retry

---

### Post-Rollback

**After rollback:**
1. Investigate root cause (syntax error, logic error, performance issue)
2. Update migration SQL with fix
3. Test extensively in local and staging
4. Schedule retry with more conservative approach
5. Schedule post-mortem if major incident (P0/P1)

---

## Troubleshooting

### Issue 1: Migration Fails with "Relation Already Exists"

**Symptoms:**
```
ERROR: relation "secrets" already exists
```

**Cause:** Migration was partially applied or table already exists from previous attempt

**Solution:**
```sql
-- Option 1: Make migration idempotent (use IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.secrets (...);

-- Option 2: Drop table and retry (only safe if no data)
DROP TABLE IF EXISTS public.secrets CASCADE;

-- Option 3: Skip this migration (mark as applied)
-- Only if table structure matches migration exactly
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('20251030120000');
```

**If solution doesn't work:**
- Check for table name typos
- Verify schema (public, auth, etc.)
- Contact Database Engineer

---

### Issue 2: RLS Policies Block All Access

**Symptoms:**
```
ERROR: new row violates row-level security policy for table "secrets"
```
or
```
SELECT returns no rows even though data exists
```

**Cause:** RLS policy logic is too restrictive or has incorrect JOIN conditions

**Solution:**
```sql
-- Temporarily disable RLS to test (DEVELOPMENT ONLY)
ALTER TABLE public.secrets DISABLE ROW LEVEL SECURITY;

-- Test query
SELECT * FROM public.secrets;

-- Re-enable RLS
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- Fix policy (example: allow owners and admins)
DROP POLICY "Users can view secrets in their projects" ON public.secrets;

CREATE POLICY "Users can view secrets in their projects"
  ON public.secrets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
        -- Allow all roles (was missing read-only)
        AND pm.role IN ('owner', 'admin', 'developer', 'read_only')
    )
  );
```

**Debug RLS policies:**
```sql
-- Check if user is in project_members
SELECT * FROM public.project_members
WHERE user_id = auth.uid();

-- Test policy condition manually
SELECT 1 FROM public.project_members pm
WHERE pm.project_id = '<test-project-id>'
  AND pm.user_id = auth.uid();
```

---

### Issue 3: Performance Degradation After Index Creation

**Symptoms:**
- Query times increase significantly
- Database CPU spikes
- Connection pool exhausted

**Cause:** Index creation can lock tables and slow queries on large datasets

**Solution:**
```sql
-- Option 1: Create index CONCURRENTLY (no table lock)
CREATE INDEX CONCURRENTLY idx_secrets_project_id ON public.secrets(project_id);

-- Option 2: Drop problematic index
DROP INDEX IF EXISTS idx_secrets_project_id;

-- Option 3: Create index during maintenance window
-- Schedule for low-traffic period
```

**Prevent in future:**
- Use `CONCURRENTLY` for indexes on large tables
- Test index creation on staging with production-sized data
- Monitor query plans before and after

---

### Issue 4: Data Migration Timeout

**Symptoms:**
```
ERROR: timeout exceeded
```

**Cause:** Data migration processing too many rows at once

**Solution:**
```sql
-- Batch data migrations in smaller chunks
DO $$
DECLARE
  batch_size INT := 1000;
  offset_val INT := 0;
  total_rows INT;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM public.secrets;

  WHILE offset_val < total_rows LOOP
    -- Update in batches
    UPDATE public.secrets
    SET encrypted_value = encrypt_value(encrypted_value)
    WHERE id IN (
      SELECT id FROM public.secrets
      ORDER BY id
      LIMIT batch_size OFFSET offset_val
    );

    offset_val := offset_val + batch_size;

    -- Log progress
    RAISE NOTICE 'Processed % of % rows', offset_val, total_rows;

    -- Commit each batch
    COMMIT;
  END LOOP;
END $$;
```

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| Database Engineer | [Name] | @username (Slack) | Immediate |
| Backend Lead | [Name] | @username (Slack) | If DB engineer unavailable |
| Engineering Lead | [Name] | @username (Slack) + phone | After 15 minutes |

**Supabase Support:**
- Dashboard: [Supabase Support](https://supabase.com/dashboard/support)
- Priority: Based on plan (Pro plan = 24-hour response)

---

## Post-Procedure

### Cleanup

**After successful migration:**
```bash
# No cleanup needed - migration files are versioned in Git

# Optional: Analyze tables for query optimization
# (Supabase Dashboard → Database → Query Performance)
```

### Documentation

**Update these documents:**
- [ ] This runbook (if issues/improvements identified)
- [ ] Relevant schema documentation in `04-database/schemas/`
- [ ] GitHub PR with final results and metrics
- [ ] `CHANGELOG.md` if user-facing changes

### Communication

**Notify:**
- [ ] Team in `#engineering` Slack: "Migration completed successfully ✅"
- [ ] Close GitHub PR (merge after approval)
- [ ] Update project tracker status
- [ ] Send summary to stakeholders (if major migration):
  ```
  Database Migration Complete: Secrets Table

  - Applied: 2025-10-30 14:30 UTC
  - Duration: 12 minutes
  - Downtime: None (zero-downtime migration)
  - Impact: New feature enabled (encrypted secret storage)
  - Rollback: Available if needed

  Monitoring for next 24 hours. No issues detected.
  ```

### Monitoring

**Increased monitoring period:**
- Monitor for **24 hours** after production migration
- Watch for:
  - RLS policy denials (Supabase logs)
  - Unexpected query performance changes
  - Connection pool exhaustion
  - User-reported issues
- Set up temporary alerts (if applicable):
  - Error rate > 1%
  - Query latency p95 > 200ms
  - Connection pool > 80% utilization

---

## Communication

### Communication Templates

**Pre-Migration Announcement (Production Only):**
```
📢 Database Migration Scheduled

When: 2025-10-30 02:00 UTC (Low-traffic period)
Duration: ~15 minutes
Impact: None (zero-downtime migration)
Purpose: Adding secrets table for encrypted credential storage

Updates will be posted in #engineering
Status page: [If applicable]
```

---

**During Migration:**
```
🔧 Database Migration in Progress

Status: Applying secrets table migration
Progress: 60% complete
ETA: 5 minutes

Everything proceeding as expected.
No user impact detected.
```

---

**Completion:**
```
✅ Database Migration Complete

Completed: 2025-10-30 02:12 UTC
Duration: 12 minutes
Status: Success
Downtime: None

All systems operational. Monitoring for 24 hours.
New feature: Encrypted secret storage now available.
```

---

**Rollback Announcement:**
```
⚠️ Database Migration Rolled Back

Rollback completed: 2025-10-30 02:15 UTC
Reason: RLS policy blocking legitimate access
Impact: No data loss, feature temporarily unavailable

Database restored to previous state. Investigation underway.
Fix scheduled for tomorrow's deployment window.
Post-mortem: [Link to doc]
```

---

## Migration Templates

### Template 1: Add New Table

```sql
-- Migration: Add [table_name] table
-- Created: YYYY-MM-DD
-- Author: [Your Name]

BEGIN;

CREATE TABLE IF NOT EXISTS public.[table_name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Add columns here

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_[table_name]_[column] ON public.[table_name]([column]);

-- Enable RLS
ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "[policy_name]"
  ON public.[table_name]
  FOR SELECT
  TO authenticated
  USING ([condition]);

-- Triggers
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.[table_name]
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMIT;

-- ROLLBACK SQL (for reference):
-- DROP TABLE IF EXISTS public.[table_name] CASCADE;
```

### Template 2: Add Column to Existing Table

```sql
-- Migration: Add [column_name] to [table_name]
-- Created: YYYY-MM-DD
-- Author: [Your Name]

BEGIN;

-- Add column
ALTER TABLE public.[table_name]
ADD COLUMN IF NOT EXISTS [column_name] [DATA_TYPE] [CONSTRAINTS];

-- Add index if needed for queries
CREATE INDEX IF NOT EXISTS idx_[table_name]_[column_name]
ON public.[table_name]([column_name]);

-- Update existing rows if needed
UPDATE public.[table_name]
SET [column_name] = [default_value]
WHERE [column_name] IS NULL;

COMMIT;

-- ROLLBACK SQL:
-- ALTER TABLE public.[table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX IF EXISTS idx_[table_name]_[column_name];
```

### Template 3: Update RLS Policy

```sql
-- Migration: Update RLS policy for [table_name]
-- Created: YYYY-MM-DD
-- Author: [Your Name]

BEGIN;

-- Drop old policy
DROP POLICY IF EXISTS "[old_policy_name]" ON public.[table_name];

-- Create updated policy
CREATE POLICY "[new_policy_name]"
  ON public.[table_name]
  FOR [SELECT|INSERT|UPDATE|DELETE]
  TO [authenticated|anon|service_role]
  USING ([new_condition])
  [WITH CHECK ([new_check_condition])];

COMMIT;

-- ROLLBACK SQL:
-- DROP POLICY IF EXISTS "[new_policy_name]" ON public.[table_name];
-- CREATE POLICY "[old_policy_name]" ON public.[table_name]...
```

### Template 4: Data Migration

```sql
-- Migration: Migrate data from [old_structure] to [new_structure]
-- Created: YYYY-MM-DD
-- Author: [Your Name]

BEGIN;

-- Create temporary backup table
CREATE TABLE IF NOT EXISTS public.[table_name]_backup AS
SELECT * FROM public.[table_name];

-- Perform data transformation
UPDATE public.[table_name]
SET [new_column] = [transformation_function]([old_column])
WHERE [condition];

-- Verify transformation
DO $$
DECLARE
  expected_count INT;
  actual_count INT;
BEGIN
  SELECT COUNT(*) INTO expected_count FROM public.[table_name]_backup;
  SELECT COUNT(*) INTO actual_count FROM public.[table_name];

  IF expected_count != actual_count THEN
    RAISE EXCEPTION 'Data count mismatch: expected %, got %', expected_count, actual_count;
  END IF;

  RAISE NOTICE 'Data migration verified: % rows', actual_count;
END $$;

-- Drop backup table after verification
DROP TABLE IF EXISTS public.[table_name]_backup;

COMMIT;

-- ROLLBACK SQL:
-- Restore from backup table or Supabase backup
```

### Template 5: Add Index for Performance

```sql
-- Migration: Add index on [table_name].[column_name] for performance
-- Created: YYYY-MM-DD
-- Author: [Your Name]

BEGIN;

-- Create index CONCURRENTLY (no table lock)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_[table_name]_[column_name]
ON public.[table_name]([column_name]);

-- For composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_[table_name]_[col1]_[col2]
ON public.[table_name]([col1], [col2]);

-- For partial indexes (filtered)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_[table_name]_[column]_active
ON public.[table_name]([column])
WHERE active = true;

COMMIT;

-- ROLLBACK SQL:
-- DROP INDEX IF EXISTS idx_[table_name]_[column_name];
```

---

## Naming Conventions

**Migration Files:**
- Format: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Use snake_case for multi-word names
- Be specific: `add_secrets_table` not `add_table`
- Include action: `add_`, `update_`, `remove_`, `fix_`

**Examples:**
- ✅ `20251030120000_add_secrets_table.sql`
- ✅ `20251030130000_add_index_secrets_project_id.sql`
- ✅ `20251030140000_update_rls_policy_secrets_read.sql`
- ❌ `20251030120000_migration.sql` (too generic)
- ❌ `20251030120000_changes.sql` (not descriptive)

**Database Objects:**
- Tables: `snake_case` (e.g., `secrets`, `project_members`)
- Columns: `snake_case` (e.g., `encrypted_value`, `created_at`)
- Indexes: `idx_[table]_[column(s)]` (e.g., `idx_secrets_project_id`)
- Policies: `"Descriptive policy name"` (e.g., `"Users can view secrets in their projects"`)
- Functions: `snake_case` (e.g., `handle_updated_at`)
- Triggers: `snake_case` (e.g., `set_updated_at`)

---

## Zero-Downtime Migration Strategies

### Strategy 1: Backward-Compatible Changes

**Safe operations (no downtime):**
- Adding new tables
- Adding new columns with defaults or NULL allowed
- Creating indexes `CONCURRENTLY`
- Adding RLS policies (only affects new access)

**Example:**
```sql
-- Add optional column (backward-compatible)
ALTER TABLE public.secrets
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
```

### Strategy 2: Blue-Green Deployment for Schema Changes

**For breaking changes:**
1. Deploy new schema alongside old (duplicate tables/columns)
2. Write to both old and new schema
3. Migrate data in background
4. Switch reads to new schema
5. Remove old schema in next migration

**Example:**
```sql
-- Step 1: Add new column
ALTER TABLE public.secrets
ADD COLUMN encrypted_value_v2 TEXT;

-- Step 2: Application writes to both columns
-- (Done in application code)

-- Step 3: Backfill old data
UPDATE public.secrets
SET encrypted_value_v2 = encrypted_value
WHERE encrypted_value_v2 IS NULL;

-- Step 4: Switch reads (application code change)

-- Step 5: Drop old column (next migration)
-- ALTER TABLE public.secrets DROP COLUMN encrypted_value;
```

### Strategy 3: Batched Data Migrations

**For large data transformations:**
```sql
-- Process in batches to avoid long locks
DO $$
DECLARE
  batch_size INT := 1000;
  processed INT := 0;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM public.secrets
      WHERE encrypted_value_v2 IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.secrets
    SET encrypted_value_v2 = encrypt_new(encrypted_value)
    FROM batch
    WHERE public.secrets.id = batch.id;

    GET DIAGNOSTICS processed = ROW_COUNT;
    EXIT WHEN processed = 0;

    RAISE NOTICE 'Processed % rows', processed;
    COMMIT;
  END LOOP;
END $$;
```

---

## Dependencies

### Technical Dependencies

**Must exist before using this runbook:**
- [ ] `04-database/database-overview.md` - Database architecture overview
- [ ] `03-security/rbac/rls-policies.md` - RLS policy patterns
- [ ] `TECH-STACK.md` - Supabase specifications

**Migration dependencies:**
- Supabase project provisioned (development, staging, production)
- Supabase CLI installed and configured
- Database schemas defined (in `04-database/schemas/`)

### Team Dependencies

**Requires coordination with:**
- Backend team - API changes may accompany migrations
- Frontend team - Schema changes may affect queries
- DevOps - Staging/production deployment coordination

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture
- `04-database/schemas/` - Schema definitions
- `03-security/rbac/rls-policies.md` - RLS policy patterns
- `TECH-STACK.md` - Supabase version and configuration
- `10-operations/deployment/deployment-runbook.md` - Deployment procedures
- `GLOSSARY.md` - Database terminology

### External Resources
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli) - CLI commands and workflows
- [Supabase Migrations Guide](https://supabase.com/docs/guides/database/migrations) - Migration best practices
- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/) - SQL reference
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS details

### Incident History

**Previous migration incidents:**
- 2025-10-15: RLS policy too restrictive, blocked all reads → Fixed by updating policy to include read_only role
- 2025-10-20: Index creation locked table for 5 minutes → Fixed by using CREATE INDEX CONCURRENTLY

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineer | Initial database migration runbook |

---

## Notes

### Improvements Needed
- Add automated migration testing in CI/CD pipeline
- Create migration dry-run functionality
- Implement automated rollback on failure
- Add performance benchmarking before/after migrations

### Lessons Learned
- Always use `IF NOT EXISTS` for idempotent migrations
- Test RLS policies thoroughly in staging before production
- Use `CREATE INDEX CONCURRENTLY` for large tables
- Batch data migrations to avoid long-running transactions
- Create manual backups before risky migrations

### Next Review Date
2025-11-30 (Review quarterly and after major migrations)

---

**Remember:** Database migrations are permanent and affect all users. When in doubt, ask for review. It's better to be slow and safe than fast and broken.
