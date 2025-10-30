---
Document: Database Maintenance - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 04-database/migrations/migration-guide.md, TECH-STACK.md, 04-database/database-overview.md
---

# Database Maintenance - Operations Runbook

## Overview

This runbook provides operational procedures for maintaining the Abyrith PostgreSQL database on Supabase, including backup verification, point-in-time recovery testing, index optimization, query performance monitoring, connection pool tuning, and scaling procedures.

**Purpose:** Ensure database reliability, optimal performance, and data integrity through proactive maintenance and monitoring.

**Frequency:** Daily monitoring, weekly checks, monthly optimization tasks

**Estimated Time:** 15-60 minutes per task (depending on complexity)

**Risk Level:** Medium to High (database operations affect entire platform)

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [Procedure: Backup Verification](#procedure-backup-verification)
5. [Procedure: Point-in-Time Recovery Testing](#procedure-point-in-time-recovery-testing)
6. [Procedure: Index Optimization](#procedure-index-optimization)
7. [Procedure: Query Performance Monitoring](#procedure-query-performance-monitoring)
8. [Procedure: Connection Pool Tuning](#procedure-connection-pool-tuning)
9. [Procedure: Scaling](#procedure-scaling)
10. [Verification](#verification)
11. [Rollback](#rollback)
12. [Troubleshooting](#troubleshooting)
13. [Post-Procedure](#post-procedure)
14. [Communication](#communication)
15. [Dependencies](#dependencies)
16. [References](#references)
17. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Performing routine database maintenance (weekly/monthly)
- Database performance degrades (slow queries, high CPU)
- Connection pool exhaustion occurs
- Preparing for expected traffic increases
- After significant schema changes or data migrations
- Testing disaster recovery procedures
- Compliance requirements demand backup verification
- Database storage approaching capacity

**Do NOT use this runbook when:**
- Database is actively experiencing an outage (use incident response runbook)
- In the middle of a deployment (wait until complete)
- During a production migration (coordinate timing)

### Scope

**What this covers:**
- Supabase PostgreSQL database maintenance
- Backup and recovery procedures
- Performance optimization
- Connection pool management
- Scaling strategies
- Monitoring and alerting

**What this does NOT cover:**
- Database migrations (see `04-database/migrations/migration-guide.md`)
- Schema changes (see migration runbook)
- Application-level performance tuning
- Infrastructure deployment (see deployment runbooks)

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Supabase Dashboard - Admin access
- [ ] Supabase Database - Direct access (psql or Studio)
- [ ] Cloudflare Dashboard - For monitoring Workers
- [ ] Production environment - Read-only initially, write for optimizations

**Credentials:**
- [ ] Supabase project credentials (connection string, service role key)
- [ ] PgBouncer connection string
- [ ] Supabase API keys

**How to request access:**
Contact the Engineering Lead with your role and justification. Database admin access is restricted to Backend Team and DevOps.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
psql --version          # Should be 15.x or higher
supabase --version      # Should be 1.123.0 or higher
pnpm --version          # Should be 8.x

# Optional but helpful
pgbench --version       # For load testing
```

**Installation:**
```bash
# Install PostgreSQL client tools (macOS)
brew install postgresql@15

# Install PostgreSQL client tools (Linux)
sudo apt-get install postgresql-client-15

# Install Supabase CLI
brew install supabase/tap/supabase
```

### Required Knowledge

**You should understand:**
- PostgreSQL fundamentals (indexes, EXPLAIN ANALYZE, vacuuming)
- Connection pooling concepts
- Database backup and recovery strategies
- Query performance analysis
- Supabase architecture and limitations

**Reference documentation:**
- `04-database/database-overview.md` - Database architecture
- `TECH-STACK.md` - PostgreSQL and Supabase specifications
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication
- [ ] Notify team in `#engineering` Slack channel (for production operations)
- [ ] Create tracking ticket in project management system
- [ ] Review maintenance window schedule (for disruptive operations)

### 2. Current State Assessment
- [ ] Review Supabase Dashboard → Database → Overview for current health
- [ ] Check current database size and storage usage
- [ ] Review active connections and connection pool status
- [ ] Check for any ongoing backups or maintenance operations
- [ ] Review recent error logs

### 3. Backup Verification
- [ ] Confirm recent automated backup exists (< 24 hours old)
- [ ] Verify backup status is "completed"
- [ ] Note backup timestamp and size

### 4. Performance Baseline
- [ ] Record current query performance metrics
- [ ] Note current connection count
- [ ] Document current database CPU and memory usage
- [ ] Save baseline metrics for comparison after maintenance

### 5. Preparation
- [ ] Read through entire relevant procedure section
- [ ] Have rollback plan ready (if applicable)
- [ ] Schedule maintenance during low-traffic period (if disruptive)
- [ ] Have emergency contacts available

---

## Procedure: Backup Verification

**Purpose:** Verify that automated backups are working correctly and can be restored if needed.

**Frequency:** Weekly (production), Monthly (staging)

**Estimated Time:** 10-15 minutes

**Risk Level:** Low (read-only verification)

---

### Step 1: Access Backup Dashboard

**Purpose:** Navigate to Supabase backup interface

**Commands:**
```
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select project (production or staging)
3. Navigate to: Database → Backups
```

**Expected:** Backup dashboard displays with list of recent backups

**Time:** 1 minute

---

### Step 2: Verify Backup Schedule

**Purpose:** Confirm backup schedule is configured correctly

**Check:**
- **Automated backups:** Daily at configured time (typically 2:00 AM UTC)
- **Retention period:** Configured based on plan (7 days for Pro, 30 days for Team/Enterprise)
- **Point-in-time recovery (PITR):** Enabled for production (7-day window)

**Expected configuration:**
```
Backup Schedule: Daily at 02:00 UTC
Retention: 7 days (Pro plan) or 30 days (Team/Enterprise plan)
PITR: Enabled (production only)
Status: Active
```

**If something goes wrong:**
- Backup schedule disabled → Re-enable in Supabase Dashboard settings
- No PITR on production → Upgrade plan or contact Supabase support

**Time:** 2 minutes

---

### Step 3: Review Recent Backups

**Purpose:** Verify backups are completing successfully

**Checks:**
```
For each backup in the last 7 days:
- Status: "Completed" (green checkmark)
- Size: Reasonable (should be consistent or growing gradually)
- Duration: Completed in reasonable time (< 30 minutes for small DBs)
- No error messages
```

**Expected output:**
```
Date: 2025-10-30 02:00 UTC | Status: ✓ Completed | Size: 2.3 GB | Duration: 8m 23s
Date: 2025-10-29 02:00 UTC | Status: ✓ Completed | Size: 2.2 GB | Duration: 8m 15s
Date: 2025-10-28 02:00 UTC | Status: ✓ Completed | Size: 2.1 GB | Duration: 8m 10s
```

**Red flags:**
- ⚠️ Backup status: "Failed" or "In Progress" for > 1 hour
- ⚠️ Backup size dropped significantly (possible data loss)
- ⚠️ Backup duration increasing dramatically (performance issue)
- ⚠️ Missing backups (gaps in schedule)

**If something goes wrong:**
- Failed backup → Check Supabase logs for errors, retry manually
- Missing backup → Contact Supabase support immediately
- Size discrepancy → Investigate potential data loss or corruption

**Time:** 3 minutes

---

### Step 4: Verify Backup Integrity (Metadata Check)

**Purpose:** Ensure backup metadata is valid

**Commands:**
```bash
# Connect to Supabase database (read-only)
psql "postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres?sslmode=require"

# Check database size
SELECT
  pg_size_pretty(pg_database_size('postgres')) AS database_size;

# Check table count
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public';

# Check row counts for critical tables
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

# Exit
\q
```

**Expected output:**
```
database_size: 2.3 GB
table_count: 15
Critical tables with expected row counts:
  - secrets: ~10,000 rows
  - projects: ~500 rows
  - organizations: ~100 rows
  - audit_logs: ~50,000 rows
```

**Compare against previous backup:** Row counts should match or increase, not decrease significantly

**If something goes wrong:**
- Row count dropped unexpectedly → Investigate potential data loss
- Table missing → Verify schema hasn't been corrupted

**Time:** 5 minutes

---

### Step 5: Document Verification Results

**Purpose:** Record verification results for compliance and troubleshooting

**Documentation:**
```markdown
## Backup Verification Report - YYYY-MM-DD

**Status:** ✅ Passed / ⚠️ Issues Found / ❌ Failed

**Latest Backup:**
- Timestamp: 2025-10-30 02:00 UTC
- Size: 2.3 GB
- Duration: 8m 23s
- Status: Completed

**Database Integrity:**
- Total tables: 15
- Total rows (critical tables): ~60,000
- Database size: 2.3 GB
- Consistency check: ✅ Passed

**Issues Found:** None

**Action Items:** None

**Next Verification:** 2025-11-06
```

**Save report to:** `10-operations/database/backup-reports/YYYY-MM-DD-backup-verification.md`

**Time:** 4 minutes

---

## Procedure: Point-in-Time Recovery Testing

**Purpose:** Test the ability to restore the database to a specific point in time

**Frequency:** Monthly (production), Quarterly (staging)

**Estimated Time:** 30-45 minutes

**Risk Level:** Medium (requires staging environment testing)

⚠️ **WARNING:** NEVER test PITR directly on production. Always test on staging or a separate test environment.

---

### Step 1: Prepare Test Environment

**Purpose:** Set up isolated environment for testing recovery

**Commands:**
```bash
# Option 1: Use Supabase to create a restore from backup
# (Done via Supabase Dashboard → Database → Backups → Restore)

# Option 2: Create a new temporary Supabase project for testing
# (Done via Supabase Dashboard → New Project)

# Document the test environment details
Test Project: abyrith-pitr-test-YYYYMMDD
Connection String: [saved securely]
Created: 2025-10-30 10:00 UTC
```

**Expected:** Test environment created and accessible

**Time:** 5-10 minutes

---

### Step 2: Record Baseline State

**Purpose:** Establish a known state before simulating data changes

**Commands:**
```bash
# Connect to TEST environment
psql "postgresql://postgres:[password]@[test-project-ref].supabase.co:5432/postgres"

# Record baseline row counts
SELECT 'secrets' AS table_name, COUNT(*) AS row_count FROM secrets
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;

# Record baseline timestamp
SELECT now() AS baseline_timestamp;

# Exit
\q
```

**Expected output:**
```
table_name  | row_count
secrets     | 100
projects    | 10
audit_logs  | 500

baseline_timestamp: 2025-10-30 10:05:00.123456+00
```

**Save baseline data** for comparison after recovery

**Time:** 3 minutes

---

### Step 3: Simulate Data Changes

**Purpose:** Make changes that will be reverted during PITR test

**Commands:**
```bash
# Connect to TEST environment
psql "postgresql://postgres:[password]@[test-project-ref].supabase.co:5432/postgres"

# Simulate data changes (INSERT, UPDATE, DELETE)
-- Insert test records
INSERT INTO secrets (id, project_id, environment_id, name, encrypted_value, encryption_iv, created_by)
VALUES
  (gen_random_uuid(), (SELECT id FROM projects LIMIT 1), (SELECT id FROM environments LIMIT 1), 'PITR_TEST_1', 'encrypted_test_value_1', 'test_iv_1', (SELECT id FROM auth.users LIMIT 1)),
  (gen_random_uuid(), (SELECT id FROM projects LIMIT 1), (SELECT id FROM environments LIMIT 1), 'PITR_TEST_2', 'encrypted_test_value_2', 'test_iv_2', (SELECT id FROM auth.users LIMIT 1));

-- Update existing record
UPDATE projects SET name = 'PITR_TEST_PROJECT' WHERE id = (SELECT id FROM projects LIMIT 1);

-- Record post-change timestamp (SAVE THIS - it's the recovery target)
SELECT now() AS post_change_timestamp;

-- Wait 2 minutes to ensure PITR window

-- Delete test record (to be recovered)
DELETE FROM secrets WHERE name LIKE 'PITR_TEST_%';

-- Record post-deletion timestamp
SELECT now() AS post_deletion_timestamp;

# Exit
\q
```

**Expected output:**
```
post_change_timestamp: 2025-10-30 10:10:00.123456+00
Inserted 2 records
Updated 1 project
Deleted 2 records

post_deletion_timestamp: 2025-10-30 10:12:00.123456+00
```

**CRITICAL:** Save `post_change_timestamp` - this is the point-in-time to recover to

**Time:** 5 minutes

---

### Step 4: Perform Point-in-Time Recovery

**Purpose:** Restore database to the state before deletion

**Supabase Dashboard:**
```
1. Navigate to: Database → Backups
2. Click "Point in Time Recovery" or "PITR"
3. Select recovery target time: 2025-10-30 10:10:00 UTC (post_change_timestamp)
4. Review recovery details:
   - Source: Production/Staging backup
   - Target time: 2025-10-30 10:10:00 UTC
   - Restore to: Test environment
5. Click "Restore"
6. Wait for restoration to complete (10-20 minutes)
```

**Alternative (Supabase CLI):**
```bash
# Note: PITR via CLI may not be available in all Supabase plans
# Contact Supabase support for enterprise PITR options
```

**Expected:** Restoration completes successfully

**Time:** 15-20 minutes (mostly waiting)

---

### Step 5: Verify Recovery Success

**Purpose:** Confirm database was restored to correct point in time

**Commands:**
```bash
# Connect to TEST environment (after restoration)
psql "postgresql://postgres:[password]@[test-project-ref].supabase.co:5432/postgres"

# Verify test records exist (should be present - they were inserted before recovery point)
SELECT * FROM secrets WHERE name LIKE 'PITR_TEST_%';
-- Expected: 2 rows (PITR_TEST_1, PITR_TEST_2)

# Verify project was updated
SELECT * FROM projects WHERE name = 'PITR_TEST_PROJECT';
-- Expected: 1 row with updated name

# Verify records deleted AFTER recovery point are restored
SELECT COUNT(*) FROM secrets WHERE name LIKE 'PITR_TEST_%';
-- Expected: 2 (deletion was AFTER recovery point, so records restored)

# Exit
\q
```

**Success criteria:**
- ✅ Records inserted before recovery point exist
- ✅ Records deleted after recovery point are restored
- ✅ Updates made before recovery point are present
- ✅ Database size matches expected size at recovery timestamp

**If something goes wrong:**
- Records missing → PITR failed, contact Supabase support
- Wrong timestamp → Retry with correct timestamp
- Restoration timeout → Check Supabase status page, retry

**Time:** 5 minutes

---

### Step 6: Document PITR Test Results

**Purpose:** Record test results for compliance and incident preparation

**Documentation:**
```markdown
## PITR Test Report - YYYY-MM-DD

**Test Environment:** abyrith-pitr-test-YYYYMMDD

**Test Scenario:**
1. Baseline: 100 secrets, 10 projects
2. Changes: Added 2 test secrets, updated 1 project
3. Recovery target: 2025-10-30 10:10:00 UTC
4. Post-recovery action: Deleted 2 test secrets
5. PITR restoration: Restored to 10:10:00 UTC

**Results:**
- ✅ Test secrets restored successfully
- ✅ Project updates preserved
- ✅ Deletions after recovery point were reverted
- ✅ Recovery completed in 18 minutes

**RTO (Recovery Time Objective):** 18 minutes
**RPO (Recovery Point Objective):** Exact (second-precision)

**Issues Found:** None

**Action Items:**
- None (test passed)

**Next PITR Test:** 2025-11-30
```

**Save report to:** `10-operations/database/pitr-reports/YYYY-MM-DD-pitr-test.md`

**Time:** 5 minutes

---

### Step 7: Cleanup Test Environment

**Purpose:** Remove temporary test project to avoid costs

**Commands:**
```bash
# Supabase Dashboard:
1. Navigate to project settings for test environment
2. Scroll to "Danger Zone"
3. Click "Delete Project"
4. Confirm deletion by typing project name
5. Project deleted
```

**Time:** 2 minutes

---

## Procedure: Index Optimization

**Purpose:** Analyze and optimize database indexes for query performance

**Frequency:** Monthly (production), Quarterly (staging)

**Estimated Time:** 20-40 minutes

**Risk Level:** Medium (index creation can impact performance temporarily)

---

### Step 1: Identify Missing Indexes

**Purpose:** Find queries that could benefit from indexes

**Commands:**
```bash
# Connect to database
psql "postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres"

-- Check for sequential scans on large tables (candidates for indexing)
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / NULLIF(seq_scan, 0) AS avg_seq_tup_read
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;

-- Identify missing indexes for foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = tc.table_name
    AND indexdef LIKE '%' || kcu.column_name || '%'
  );
```

**Expected output:**
```
Tables with high sequential scans:
tablename   | seq_scan | seq_tup_read | idx_scan | avg_seq_tup_read
secrets     | 1000     | 100000       | 5000     | 100
audit_logs  | 500      | 250000       | 1000     | 500

Missing indexes on foreign keys:
table_name       | column_name        | foreign_table_name
secret_metadata  | secret_id          | secrets
```

**Analysis:**
- High `seq_scan` + High `avg_seq_tup_read` → Table needs index
- Foreign keys without indexes → Performance issue for JOINs

**Time:** 5 minutes

---

### Step 2: Analyze Unused Indexes

**Purpose:** Identify indexes that can be removed to save space and maintenance overhead

**Commands:**
```sql
-- Find unused indexes (never or rarely used)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan < 50  -- Adjust threshold as needed
  AND indexrelname NOT LIKE '%_pkey'  -- Exclude primary keys
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Expected output:**
```
tablename   | indexname                    | index_scans | index_size
secrets     | idx_secrets_description      | 5           | 256 kB
projects    | idx_projects_created_by      | 12          | 128 kB
```

**Analysis:**
- Index with very low scans + large size → Candidate for removal
- Consider query patterns before dropping (usage may be infrequent but critical)

**Time:** 5 minutes

---

### Step 3: Create Missing Indexes

**Purpose:** Add indexes to improve query performance

⚠️ **WARNING:** Index creation can lock tables. Use `CONCURRENTLY` option to avoid downtime.

**Commands:**
```sql
-- Create indexes CONCURRENTLY (no table lock)
-- Example: Add index for foreign key
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_secret_metadata_secret_id
ON public.secret_metadata(secret_id);

-- Example: Add composite index for common query pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_secrets_project_environment
ON public.secrets(project_id, environment_id);

-- Example: Add partial index for active records only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_active
ON public.projects(id)
WHERE deleted_at IS NULL;

-- Verify index creation
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('secrets', 'secret_metadata', 'projects')
ORDER BY tablename, indexname;
```

**Expected output:**
```
Index created: idx_secret_metadata_secret_id
Index created: idx_secrets_project_environment
Index created: idx_projects_active

Verification: 3 new indexes listed
```

**Important notes:**
- ℹ️ `CONCURRENTLY` prevents table locks but takes longer
- ℹ️ Monitor database CPU during index creation
- ℹ️ Index creation on large tables can take 10-30 minutes

**If something goes wrong:**
- Index creation fails → Check for duplicate index definition
- High CPU usage → Index creation in progress, wait for completion
- Table locked → Index created without `CONCURRENTLY`, consider dropping and recreating

**Time:** 10-20 minutes (depending on table size)

---

### Step 4: Remove Unused Indexes

**Purpose:** Free up disk space and reduce maintenance overhead

⚠️ **WARNING:** Confirm index is truly unused before dropping. Backup database first.

**Commands:**
```sql
-- Drop unused index (only if confident it's not needed)
DROP INDEX IF EXISTS idx_secrets_description;

-- Verify index removed
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'secrets'
ORDER BY indexname;
```

**Expected output:**
```
Index dropped: idx_secrets_description
Verification: Index no longer listed
```

**Caution:**
- ⚠️ Only drop indexes with VERY low usage over extended period (30+ days)
- ⚠️ Check with backend team before dropping any index
- ⚠️ Monitor query performance after dropping to ensure no regression

**Time:** 3 minutes

---

### Step 5: Analyze Index Bloat

**Purpose:** Identify indexes that need REINDEX due to bloat

**Commands:**
```sql
-- Check for index bloat
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;

-- Estimate bloat (rough approximation)
-- If index size is much larger than expected, may need REINDEX
```

**Expected output:**
```
tablename   | indexname               | index_size | index_scans
secrets     | idx_secrets_project_id  | 512 MB     | 100000
audit_logs  | idx_audit_logs_user_id  | 256 MB     | 50000
```

**Red flags:**
- Index size growing disproportionately to row count
- Index size > 2x expected size (indicates bloat)

**If bloat detected:**
```sql
-- REINDEX to rebuild and remove bloat
-- WARNING: REINDEX acquires EXCLUSIVE lock, do during maintenance window
REINDEX INDEX CONCURRENTLY idx_secrets_project_id;
```

**Time:** 5 minutes (analysis), 10-30 minutes (REINDEX if needed)

---

### Step 6: Update Table Statistics

**Purpose:** Ensure query planner has accurate statistics for optimization

**Commands:**
```sql
-- Update statistics for all tables
ANALYZE;

-- Or analyze specific tables
ANALYZE secrets;
ANALYZE projects;
ANALYZE audit_logs;

-- Verify statistics are up-to-date
SELECT
  schemaname,
  tablename,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY last_analyze DESC NULLS LAST;
```

**Expected output:**
```
tablename   | last_analyze         | last_autoanalyze
secrets     | 2025-10-30 10:30:00  | 2025-10-29 14:22:15
projects    | 2025-10-30 10:30:01  | 2025-10-29 08:15:30
```

**Time:** 2 minutes

---

## Procedure: Query Performance Monitoring

**Purpose:** Monitor and analyze slow queries to identify performance bottlenecks

**Frequency:** Daily (automated), Weekly (manual review)

**Estimated Time:** 15-30 minutes

**Risk Level:** Low (read-only monitoring)

---

### Step 1: Enable Query Logging (if not already enabled)

**Purpose:** Capture slow query logs for analysis

**Supabase Dashboard:**
```
1. Navigate to: Database → Settings → Query Performance
2. Enable "Log slow queries"
3. Set threshold: 100ms (adjust as needed)
4. Save settings
```

**Verification:**
```sql
-- Check current logging configuration
SHOW log_min_duration_statement;
-- Expected: 100ms (or configured value)
```

**Time:** 2 minutes

---

### Step 2: Identify Slow Queries

**Purpose:** Find queries taking longer than acceptable performance targets

**Commands:**
```sql
-- Install pg_stat_statements extension (if not already installed)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View top 10 slowest queries by mean execution time
SELECT
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  ROUND(total_exec_time::numeric, 2) AS total_ms,
  calls,
  ROUND((100 * total_exec_time / SUM(total_exec_time) OVER ())::numeric, 2) AS percent_total,
  LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'  -- Exclude meta queries
ORDER BY mean_exec_time DESC
LIMIT 10;

-- View queries by total execution time (most impactful)
SELECT
  ROUND(total_exec_time::numeric, 2) AS total_ms,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  ROUND((100 * total_exec_time / SUM(total_exec_time) OVER ())::numeric, 2) AS percent_total,
  LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

**Expected output:**
```
Slowest queries:
avg_ms  | total_ms | calls | percent_total | query_preview
1250.50 | 125050   | 100   | 15.3%         | SELECT * FROM secrets WHERE project_id = $1 AND encrypted_value...
890.25  | 89025    | 100   | 10.8%         | SELECT COUNT(*) FROM audit_logs WHERE user_id = $1 AND created_at...

Most impactful queries (by total time):
total_ms | calls | avg_ms | percent_total | query_preview
250000   | 5000  | 50.00  | 30.5%         | SELECT * FROM secrets WHERE environment_id = $1
125050   | 100   | 1250.5 | 15.3%         | SELECT * FROM secrets WHERE project_id = $1...
```

**Analysis:**
- Queries with high `avg_ms` → Slow query optimization needed
- Queries with high `total_ms` → High-frequency query optimization needed (biggest impact)
- Queries > 200ms → Performance target exceeded

**Time:** 5 minutes

---

### Step 3: Analyze Query Execution Plans

**Purpose:** Understand why queries are slow using EXPLAIN ANALYZE

**Commands:**
```sql
-- Get execution plan for slow query
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM secrets
WHERE project_id = 'example-uuid'
  AND environment_id = 'example-env-uuid'
  AND deleted_at IS NULL;

-- Look for:
-- - Seq Scan (should be Index Scan for large tables)
-- - High cost estimates
-- - High actual time
-- - Large buffer reads
```

**Expected output (good plan):**
```
Index Scan using idx_secrets_project_id on secrets  (cost=0.29..8.31 rows=1 width=1234) (actual time=0.015..0.017 rows=1 loops=1)
  Index Cond: (project_id = 'example-uuid'::uuid)
  Filter: ((environment_id = 'example-env-uuid'::uuid) AND (deleted_at IS NULL))
  Buffers: shared hit=4
Planning Time: 0.102 ms
Execution Time: 0.041 ms
```

**Red flags:**
- ⚠️ Seq Scan on large tables (millions of rows)
- ⚠️ Nested Loop with large outer loop
- ⚠️ High "Buffers: shared read" (disk I/O, should be "hit" for cached)
- ⚠️ Execution Time >> Planning Time (query itself is slow)

**Common fixes:**
- Missing index → Create index (see Index Optimization procedure)
- Outdated statistics → Run `ANALYZE table_name`
- Inefficient JOIN order → Rewrite query or add indexes
- Missing WHERE clause → Query retrieving too much data

**Time:** 10 minutes

---

### Step 4: Document Query Performance Issues

**Purpose:** Track query performance trends and optimization efforts

**Documentation:**
```markdown
## Query Performance Report - YYYY-MM-DD

**Slowest Queries:**
1. `SELECT * FROM secrets WHERE project_id = ?`
   - Avg: 1250ms
   - Calls: 100
   - Issue: Seq Scan on large table
   - Fix: Add composite index on (project_id, environment_id)

2. `SELECT COUNT(*) FROM audit_logs WHERE user_id = ?`
   - Avg: 890ms
   - Calls: 100
   - Issue: Counting all rows without limit
   - Fix: Use estimated count or add limit

**Most Impactful Queries:**
1. `SELECT * FROM secrets WHERE environment_id = ?`
   - Total time: 250s (5000 calls)
   - Issue: High-frequency query without index
   - Fix: Add index on environment_id

**Optimizations Applied:**
- Created index: `idx_secrets_project_environment`
- Rewritten query: `audit_logs` count with limit

**Impact:**
- Avg query time reduced: 1250ms → 45ms (96% improvement)
- Total time saved: 5.5 minutes per 100 requests

**Next Review:** 2025-11-06
```

**Save report to:** `10-operations/database/performance-reports/YYYY-MM-DD-query-performance.md`

**Time:** 5 minutes

---

### Step 5: Set Up Performance Alerts

**Purpose:** Automatically detect performance degradation

**Recommended thresholds:**
- Query latency p95 > 200ms → Warning
- Query latency p95 > 500ms → Critical
- Queries per second drops > 50% → Critical
- Database CPU > 80% for 5 minutes → Warning

**Implementation:**
- Use Supabase Dashboard → Alerts to configure
- Or integrate with external monitoring (Sentry, Datadog, etc.)

**Time:** 5 minutes (initial setup)

---

## Procedure: Connection Pool Tuning

**Purpose:** Optimize connection pool settings to handle application load efficiently

**Frequency:** As needed (when connection issues arise), Quarterly review

**Estimated Time:** 20-30 minutes

**Risk Level:** Medium (incorrect settings can cause connection exhaustion or waste resources)

---

### Step 1: Monitor Current Connection Usage

**Purpose:** Understand current connection patterns and identify issues

**Commands:**
```sql
-- Check active connections
SELECT
  datname AS database,
  COUNT(*) AS connections,
  MAX(backend_start) AS oldest_connection
FROM pg_stat_activity
GROUP BY datname
ORDER BY connections DESC;

-- Check connection states
SELECT
  state,
  COUNT(*) AS count
FROM pg_stat_activity
WHERE datname = 'postgres'
GROUP BY state
ORDER BY count DESC;

-- Identify long-running connections
SELECT
  pid,
  usename,
  application_name,
  state,
  state_change,
  NOW() - state_change AS duration,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND state_change < NOW() - INTERVAL '1 minute'
ORDER BY duration DESC;
```

**Expected output:**
```
Current connections:
database  | connections | oldest_connection
postgres  | 45          | 2025-10-30 09:00:00

Connection states:
state              | count
idle               | 20
active             | 15
idle in transaction| 5
disabled           | 5

Long-running connections:
pid   | usename  | state  | duration  | query
12345 | postgres | active | 00:02:15  | SELECT * FROM secrets...
```

**Analysis:**
- Total connections approaching max (default: 60 for Pro, 200+ for Team/Enterprise) → Need to increase pool size or optimize queries
- High "idle in transaction" → Application not properly closing transactions
- Long-running queries → Performance issue or hung connection

**Time:** 5 minutes

---

### Step 2: Review Connection Pool Configuration

**Purpose:** Check PgBouncer and application pool settings

**Supabase Configuration:**
```
Default connection limits:
- Free: 20 connections
- Pro: 60 connections
- Team: 120 connections
- Enterprise: 200+ connections

PgBouncer (transaction pooling):
- Enabled by default on Supabase
- Connection string format:
  postgresql://postgres:[password]@[host]:6543/postgres (PgBouncer)
  postgresql://postgres:[password]@[host]:5432/postgres (Direct)
```

**Application pool settings (check codebase):**
```typescript
// Example: Supabase client configuration
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: true
    },
    // Connection pool settings (if using custom client)
    global: {
      fetch: customFetch // Can configure connection pooling here
    }
  }
);

// For custom PostgreSQL clients:
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // Max connections in pool
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Wait 2s for connection
});
```

**Recommendations:**
- Use PgBouncer port (6543) for transaction pooling (recommended for most cases)
- Use direct port (5432) only for long-running transactions or LISTEN/NOTIFY
- Application pool size: 5-20 per instance (avoid exceeding database max)

**Time:** 5 minutes

---

### Step 3: Optimize Connection Pool Settings

**Purpose:** Adjust pool settings based on observed patterns

**Decision matrix:**
```
Issue: Connection exhaustion (max connections reached)
Solutions:
1. Increase Supabase plan (more connections)
2. Reduce application pool size per instance
3. Fix connection leaks (ensure connections are released)
4. Implement connection retry logic with backoff

Issue: High "idle in transaction"
Solutions:
1. Reduce idle_in_transaction_session_timeout
2. Fix application code to commit/rollback transactions
3. Use PgBouncer transaction pooling (6543)

Issue: Connection timeouts
Solutions:
1. Increase connection timeout in application
2. Reduce pool size to avoid contention
3. Optimize slow queries causing connection wait
```

**Application-level changes (example):**
```typescript
// Recommended connection pool settings for Cloudflare Workers
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Use PgBouncer port 6543
  max: 10,                    // Max 10 connections per Worker instance
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 3000,  // Wait 3s for connection
  statement_timeout: 5000,    // Terminate queries after 5s
});

// Ensure connections are released
async function queryDatabase(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release(); // CRITICAL: Always release connection
  }
}
```

**Supabase-level changes:**
```
If plan upgrade is needed:
1. Navigate to: Supabase Dashboard → Settings → Billing
2. Review current plan limits
3. Upgrade to plan with higher connection limit (Team or Enterprise)
4. Verify new limit: SELECT * FROM pg_settings WHERE name = 'max_connections';
```

**Time:** 10 minutes

---

### Step 4: Identify and Fix Connection Leaks

**Purpose:** Find application code not properly releasing connections

**Commands:**
```sql
-- Identify connections held by specific applications
SELECT
  application_name,
  state,
  COUNT(*) AS connection_count,
  MAX(NOW() - state_change) AS max_idle_time
FROM pg_stat_activity
WHERE datname = 'postgres'
  AND application_name != ''
GROUP BY application_name, state
ORDER BY connection_count DESC;

-- Find stuck connections (idle in transaction > 1 minute)
SELECT
  pid,
  usename,
  application_name,
  state,
  NOW() - state_change AS idle_duration,
  query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND NOW() - state_change > INTERVAL '1 minute';
```

**Expected output:**
```
Connection by application:
application_name       | state              | connection_count | max_idle_time
api-worker-prod        | idle               | 15               | 00:00:45
api-worker-prod        | active             | 5                | 00:00:01
api-worker-prod        | idle in transaction| 3                | 00:05:12  ⚠️ LEAK

Stuck connections:
pid   | application_name | state              | idle_duration | query
67890 | api-worker-prod  | idle in transaction| 00:05:12      | BEGIN; SELECT...
```

**Analysis:**
- Long "idle in transaction" → Application not committing/rolling back
- High idle connection count → Pool not releasing connections efficiently

**Fix connection leaks:**
1. Review application code for missing `finally` blocks that release connections
2. Ensure all transactions have explicit `COMMIT` or `ROLLBACK`
3. Set `idle_in_transaction_session_timeout` to force-close stuck transactions
4. Add connection pool monitoring in application logs

**Terminate stuck connections (if necessary):**
```sql
-- Kill specific stuck connection (use with caution)
SELECT pg_terminate_backend(67890);

-- Or set automatic timeout
ALTER SYSTEM SET idle_in_transaction_session_timeout = '5min';
SELECT pg_reload_conf();
```

**Time:** 10 minutes

---

## Procedure: Scaling

**Purpose:** Scale database resources to handle increased load

**Frequency:** As needed (when approaching capacity), Quarterly capacity planning

**Estimated Time:** 30-60 minutes (plus migration time if upgrading plan)

**Risk Level:** High (can require downtime for plan upgrades)

---

### Step 1: Assess Current Capacity

**Purpose:** Determine if scaling is needed

**Metrics to check:**
```
Supabase Dashboard → Database → Overview:
- Database size: ____ GB / ____ GB (% used)
- Connections: ____ / ____ (% used)
- CPU usage: ____% average
- Memory usage: ____% average
- Disk IOPS: ____ / ____ (% used)
```

**Thresholds for scaling:**
- ⚠️ **Database size > 80%:** Plan storage upgrade
- ⚠️ **Connections > 70%:** Connection limit upgrade or optimization
- ⚠️ **CPU > 70% sustained:** Compute upgrade
- ⚠️ **Memory > 80%:** Compute upgrade
- ⚠️ **Disk IOPS > 80%:** Disk performance upgrade

**Commands:**
```sql
-- Check database size
SELECT
  pg_size_pretty(pg_database_size('postgres')) AS database_size,
  pg_size_pretty(pg_total_relation_size('public.secrets')) AS largest_table_size;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

**Expected output:**
```
database_size: 4.2 GB
largest_table_size: 2.1 GB (secrets)

Table sizes:
tablename   | size
secrets     | 2.1 GB
audit_logs  | 1.5 GB
projects    | 128 MB
```

**Decision:**
- Size growing rapidly (> 1 GB/month) → Plan storage upgrade or archival strategy
- Size stable but approaching limit → Implement data retention policy
- Performance degraded → Compute upgrade or query optimization

**Time:** 10 minutes

---

### Step 2: Plan Scaling Strategy

**Purpose:** Choose appropriate scaling method

**Scaling options:**

**1. Vertical Scaling (Increase compute)**
- **When:** CPU or memory consistently high
- **How:** Upgrade Supabase plan (Pro → Team → Enterprise)
- **Downtime:** Yes (typically 1-5 minutes during migration)
- **Cost:** Higher plan tier

**2. Connection Scaling**
- **When:** Connection limit reached
- **How:** Upgrade plan or optimize connection pool
- **Downtime:** No (if optimizing pool)
- **Cost:** Higher plan tier (if upgrading)

**3. Storage Scaling**
- **When:** Database size approaching limit
- **How:** Upgrade plan or implement data archival
- **Downtime:** No (if archival), Yes (if upgrade)
- **Cost:** Higher plan tier or archival storage costs

**4. Read Replica (Enterprise only)**
- **When:** High read load impacting write performance
- **How:** Enable read replicas in Supabase
- **Downtime:** No
- **Cost:** Additional replica costs

**Recommended approach:**
1. **First:** Optimize queries and indexes (no cost, no downtime)
2. **Then:** Vertical scaling (if optimizations insufficient)
3. **Finally:** Read replicas (for very high read load)

**Time:** 10 minutes

---

### Step 3: Execute Scaling (Vertical Scaling Example)

**Purpose:** Upgrade Supabase plan for more resources

⚠️ **WARNING:** Plan upgrades may require brief downtime. Schedule during maintenance window.

**Pre-upgrade checklist:**
- [ ] Create manual backup (Supabase Dashboard → Database → Backups)
- [ ] Notify team and users of brief maintenance window
- [ ] Update status page (if applicable)
- [ ] Schedule during low-traffic period

**Upgrade procedure:**
```
Supabase Dashboard:
1. Navigate to: Settings → Billing → Upgrade Plan
2. Select target plan (Team or Enterprise)
3. Review new resource limits:
   - Connections: 60 → 120
   - Compute: Shared → Dedicated 2 CPU
   - Memory: 1 GB → 4 GB
   - Storage: 8 GB → 50 GB
4. Confirm upgrade
5. Wait for migration to complete (typically 5-10 minutes)
6. Verify new plan active
```

**During migration:**
- Database may be temporarily unavailable
- Connections will be dropped and need to reconnect
- API requests may fail (implement retry logic)

**Post-upgrade verification:**
```sql
-- Verify new connection limit
SHOW max_connections;
-- Expected: 120 (or new plan limit)

-- Verify database accessible
SELECT version();
-- Expected: PostgreSQL 15.x

-- Test critical queries
SELECT COUNT(*) FROM secrets;
-- Expected: Same count as before upgrade
```

**Time:** 15-30 minutes (including migration)

---

### Step 4: Implement Data Archival (Storage Scaling)

**Purpose:** Archive old data to reduce database size and costs

**Archival strategy:**
```sql
-- Identify candidates for archival (example: audit logs > 90 days old)
SELECT
  COUNT(*) AS total_rows,
  MIN(created_at) AS oldest_record,
  MAX(created_at) AS newest_record,
  pg_size_pretty(pg_total_relation_size('audit_logs')) AS table_size
FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive old records to separate table or export
-- Option 1: Move to archive table
CREATE TABLE IF NOT EXISTS audit_logs_archive (LIKE audit_logs INCLUDING ALL);

BEGIN;
-- Move old records
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Verify count matches
-- If verified, delete from main table
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

COMMIT;

-- Option 2: Export to CSV and delete
COPY (
  SELECT * FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
) TO '/tmp/audit_logs_archive_2025-10-30.csv' WITH CSV HEADER;

-- After export verified, delete old records
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Reclaim space
VACUUM FULL audit_logs;
```

**Important notes:**
- ⚠️ `VACUUM FULL` locks table, do during maintenance window
- ℹ️ Test archival on staging first
- ℹ️ Verify exports are complete before deleting data
- ℹ️ Update application queries to search archive if needed

**Time:** 20-30 minutes (depending on data volume)

---

### Step 5: Monitor Scaling Impact

**Purpose:** Verify scaling improved performance

**Metrics to compare (before vs. after):**
```
Database size: 4.2 GB → 3.1 GB (archival)
Connections used: 55/60 (92%) → 55/120 (46%)
CPU usage: 75% average → 35% average
Query latency p95: 450ms → 120ms
```

**Monitoring period:** 24-48 hours after scaling

**Commands:**
```sql
-- Check query performance improvement
SELECT
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  calls,
  LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 5;

-- Compare with previous baseline
```

**Success criteria:**
- ✅ CPU usage reduced to < 70%
- ✅ Query latency below performance targets (< 200ms p95)
- ✅ Connection utilization < 80%
- ✅ No increase in error rates

**Time:** Ongoing monitoring for 24-48 hours

---

## Verification

### Post-Procedure Checks

**1. Database Health:**
```sql
-- Connect to database
psql "postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres"

-- Verify database is responding
SELECT version();

-- Check database size
SELECT pg_size_pretty(pg_database_size('postgres'));

-- Check active connections
SELECT COUNT(*) FROM pg_stat_activity;

-- Exit
\q
```

**Expected:** Database responding, size within limits, connections normal

---

**2. Backup Status:**
```
Supabase Dashboard → Database → Backups:
- Latest backup: < 24 hours old
- Status: ✓ Completed
- Size: Consistent with database size
```

**Expected:** Recent backup available and completed successfully

---

**3. Performance Metrics:**
```sql
-- Check query performance
SELECT
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  calls
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_exec_time DESC
LIMIT 5;
```

**Expected:** Query latency within performance targets (< 200ms p95)

---

**4. Connection Pool:**
```sql
-- Check connection usage
SELECT
  state,
  COUNT(*)
FROM pg_stat_activity
GROUP BY state;
```

**Expected:** Active connections < 80% of limit, minimal "idle in transaction"

---

**5. Index Health:**
```sql
-- Verify indexes exist
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

**Expected:** New indexes created, unused indexes removed (if applicable)

---

### Success Criteria

**Maintenance is successful when:**
- [ ] Backups verified and recent (< 24 hours)
- [ ] PITR tested and working (if tested)
- [ ] Query performance meets targets (< 200ms p95)
- [ ] Indexes optimized (missing indexes added, unused removed)
- [ ] Connection pool tuned (< 80% utilization)
- [ ] Database scaled appropriately (if needed)
- [ ] No errors in Supabase logs
- [ ] All metrics within normal range

---

## Rollback

### When to Rollback

**Rollback if:**
- Index creation causes performance degradation
- Connection pool changes cause connection exhaustion
- Scaling operation fails or degrades performance
- Data loss occurs during archival

### Rollback Procedure

**Step 1: Identify Issue**
```sql
-- Check for performance regression
SELECT
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  calls,
  LEFT(query, 100) AS query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 5;

-- Compare with baseline metrics
```

---

**Step 2: Rollback Changes**

**For index changes:**
```sql
-- Drop newly created index causing issues
DROP INDEX IF EXISTS idx_name_causing_issue;

-- Restore old index (if dropped)
-- (Recreate from backup or migration file)
```

**For connection pool changes:**
```typescript
// Revert application connection pool settings
const pool = new Pool({
  max: 20, // Previous value
  idleTimeoutMillis: 30000, // Previous value
});

// Redeploy application
```

**For plan upgrade issues:**
```
Supabase Dashboard:
1. Contact Supabase support for assistance
2. Request rollback to previous plan (may not be immediate)
3. Restore from backup if data corruption occurred
```

**For archival issues:**
```sql
-- Restore from archive table
INSERT INTO audit_logs
SELECT * FROM audit_logs_archive
WHERE id IN (SELECT id FROM missing_records);

-- Or restore from backup
-- (Use Supabase Dashboard → Backups → Restore)
```

**Time:** 10-20 minutes

---

**Step 3: Verify Rollback**
```sql
-- Verify performance restored
SELECT
  ROUND(mean_exec_time::numeric, 2) AS avg_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 5;

-- Expected: Performance metrics return to baseline
```

---

**Step 4: Document and Notify**
- [ ] Update team in Slack: "Maintenance rolled back due to [reason]"
- [ ] Document issue and rollback steps
- [ ] Schedule post-mortem if major issue
- [ ] Plan corrective action

---

## Troubleshooting

### Issue 1: Backup Verification Failed

**Symptoms:**
```
Error: Backup status shows "Failed"
or
Error: Cannot access backup files
```

**Cause:** Backup process failed due to insufficient storage, connectivity issue, or database error

**Solution:**
```bash
# Check Supabase logs for backup errors
# Supabase Dashboard → Logs → Filter for "backup"

# Manually trigger backup
# Supabase Dashboard → Database → Backups → Create Backup

# If persistent failure, contact Supabase support
# Dashboard → Support → Create ticket with backup logs
```

**If solution doesn't work:**
- Escalate to Supabase support (critical issue)
- Document backup failure in incident log
- Consider plan upgrade if storage limit reached

---

### Issue 2: Connection Pool Exhaustion

**Symptoms:**
```
Error: remaining connection slots are reserved
or
Error: FATAL:  sorry, too many clients already
```

**Cause:** Application using more connections than available

**Solution:**
```sql
-- Check current connection usage
SELECT COUNT(*) FROM pg_stat_activity;

-- Identify applications using most connections
SELECT
  application_name,
  COUNT(*) AS connection_count
FROM pg_stat_activity
GROUP BY application_name
ORDER BY connection_count DESC;

-- Kill idle connections (use with caution)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '5 minutes'
  AND application_name != '';

-- Reduce application pool size
-- (Update application configuration and redeploy)
```

**Permanent fix:**
- Upgrade Supabase plan for more connections
- Optimize application to use fewer connections
- Implement connection retry logic with exponential backoff

---

### Issue 3: Query Performance Degradation After Index Creation

**Symptoms:**
- Queries slower after creating new index
- Database CPU usage increased
- Index not being used by query planner

**Cause:** Query planner choosing suboptimal index or index statistics outdated

**Solution:**
```sql
-- Update table statistics
ANALYZE table_name;

-- Check if query is using new index
EXPLAIN (ANALYZE)
SELECT * FROM secrets WHERE project_id = 'uuid';

-- If not using index, may need to:
-- 1. Rewrite query to match index
-- 2. Drop and recreate index with different columns
-- 3. Update query planner settings

-- Force use of index (testing only)
SET enable_seqscan = off;
EXPLAIN SELECT * FROM secrets WHERE project_id = 'uuid';
SET enable_seqscan = on;

-- If index is not beneficial, drop it
DROP INDEX IF EXISTS problematic_index_name;
```

---

### Issue 4: PITR Restoration Stuck or Failed

**Symptoms:**
```
Error: PITR restoration timeout
or
Restoration in progress for > 1 hour
```

**Cause:** Large database size, network issues, or Supabase infrastructure issue

**Solution:**
```
1. Check Supabase status page: https://status.supabase.com
2. If no known issues:
   - Cancel restoration (if option available)
   - Contact Supabase support with:
     * Project ID
     * Restoration timestamp
     * Error messages/logs
3. If urgent:
   - Restore from full backup instead of PITR
   - Accept potential data loss within recovery window
```

---

### Issue 5: Database Storage Full

**Symptoms:**
```
Error: ERROR:  could not extend file
or
Warning: Database size approaching limit (95%)
```

**Cause:** Database size exceeded plan storage limit

**Solution:**
```sql
-- Identify largest tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Option 1: Archive old data (see Scaling procedure)
-- Option 2: Upgrade plan for more storage
-- Option 3: Delete unnecessary data

-- Reclaim space after deletion
VACUUM FULL table_name;
```

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| Backend Engineer | [Name] | @username (Slack) | Immediate |
| Database Lead | [Name] | @username (Slack) | If backend engineer unavailable |
| Engineering Lead | [Name] | @username (Slack) + phone | After 15 minutes |

**Supabase Support:**
- Dashboard: [Supabase Support](https://supabase.com/dashboard/support)
- Email: support@supabase.com
- Priority: Based on plan (Team/Enterprise = faster response)

---

## Post-Procedure

### Cleanup

**After successful maintenance:**
```sql
-- Reset pg_stat_statements (if analyzed)
SELECT pg_stat_statements_reset();

-- No other cleanup typically needed
```

### Documentation

**Update these documents:**
- [ ] This runbook (if improvements identified)
- [ ] Save maintenance report to `10-operations/database/maintenance-reports/YYYY-MM-DD-maintenance.md`
- [ ] Update database capacity planning doc (if scaling performed)
- [ ] Document any new indexes or optimizations in `04-database/schemas/`

### Communication

**Notify:**
- [ ] Team in `#engineering` Slack: "Database maintenance completed successfully ✅"
- [ ] Update project tracker status
- [ ] Send summary to stakeholders (if major maintenance):
  ```
  Database Maintenance Complete - 2025-10-30

  Tasks Completed:
  - Backup verification: ✅ Passed
  - Query optimization: ✅ 3 indexes added, 1 removed
  - Connection pool tuned: ✅ Pool size optimized
  - Performance improved: ✅ Query latency reduced 40%

  Impact: Zero downtime, improved performance

  Next Maintenance: 2025-11-06 (weekly backup verification)
  ```

### Monitoring

**Increased monitoring period:**
- Monitor for **24-48 hours** after major maintenance
- Watch for:
  - Query performance regression
  - Connection pool issues
  - Backup failures
  - Increased error rates
- Set up temporary alerts (if needed):
  - Query latency p95 > 200ms
  - Connection pool > 80%
  - Backup failures

---

## Communication

### Communication Templates

**Pre-Maintenance Announcement (Production, Disruptive Operations Only):**
```
📢 Database Maintenance Scheduled

When: 2025-10-30 02:00 UTC (Low-traffic period)
Duration: ~30 minutes
Impact: Brief connection resets (automatic reconnect)
Purpose: Database optimization and scaling

Updates will be posted in #engineering
Status page: [If applicable]
```

---

**During Maintenance:**
```
🔧 Database Maintenance in Progress

Status: Optimizing indexes and performance
Progress: 60% complete
ETA: 15 minutes

No user impact detected. All systems operational.
```

---

**Completion:**
```
✅ Database Maintenance Complete

Completed: 2025-10-30 02:25 UTC
Duration: 25 minutes
Status: Success
Downtime: None

Improvements:
- Query performance improved 40%
- 3 indexes optimized
- Connection pool tuned

All systems operational. Monitoring for 24 hours.
```

---

**Rollback Announcement:**
```
⚠️ Database Maintenance Rolled Back

Rollback completed: 2025-10-30 02:20 UTC
Reason: Performance regression detected
Impact: Database returned to previous state

Investigation underway. No data loss.
Post-mortem: [Link to doc]
```

---

## Dependencies

### Technical Dependencies

**Must exist before using this runbook:**
- [ ] `04-database/migrations/migration-guide.md` - Migration procedures
- [ ] `04-database/database-overview.md` - Database architecture
- [ ] `TECH-STACK.md` - PostgreSQL and Supabase specifications
- [ ] Supabase project provisioned (production, staging)

**Related runbooks:**
- `10-operations/deployment/deployment-runbook.md` - Deployment coordination
- `10-operations/incident-response.md` - Incident procedures

### Team Dependencies

**Requires coordination with:**
- Backend team - Query optimization and schema changes
- DevOps team - Scaling and infrastructure changes
- Product team - Downtime scheduling for user-facing maintenance

---

## References

### Internal Documentation
- `04-database/migrations/migration-guide.md` - Database migration procedures
- `04-database/database-overview.md` - Database architecture overview
- `04-database/schemas/` - Schema definitions
- `TECH-STACK.md` - PostgreSQL and Supabase specifications
- `GLOSSARY.md` - Database terminology

### External Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/) - PostgreSQL 15 reference
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization) - Performance best practices
- [Supabase Database Guide](https://supabase.com/docs/guides/database) - Supabase-specific database documentation
- [Supabase Backups](https://supabase.com/docs/guides/platform/backups) - Backup and recovery guide
- [PgBouncer Documentation](https://www.pgbouncer.org/usage.html) - Connection pooling reference

### Incident History

**Previous database maintenance incidents:**
- None yet (this is the initial runbook)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial database maintenance runbook |

---

## Notes

### Improvements Needed
- Automate backup verification with monitoring alerts
- Create dashboard for real-time database health metrics
- Implement automated query performance regression detection
- Build tooling for automated archival of old audit logs
- Add PITR automation scripts for faster recovery testing

### Lessons Learned
- Regular maintenance prevents performance degradation
- Backup verification is critical for disaster recovery confidence
- Connection pool tuning requires coordination with application deployment
- Index optimization has significant performance impact
- Proactive monitoring prevents capacity issues

### Next Review Date
2025-11-30 (Review quarterly and after major database changes)

---

**Remember:** Database maintenance is essential for platform reliability. Schedule maintenance during low-traffic periods and always verify backups before making changes. When in doubt, test on staging first.
