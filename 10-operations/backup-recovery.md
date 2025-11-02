---
Document: Backup and Recovery Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: DevOps Team / Database Administrator
Status: Draft
Dependencies: 04-database/database-overview.md, 10-operations/deployment/deployment-pipeline.md, 03-security/security-model.md, TECH-STACK.md
---

# Backup and Recovery Operations Runbook

## Overview

This runbook defines comprehensive backup and recovery procedures for the Abyrith platform, covering automated backups, point-in-time recovery (PITR), disaster recovery, and business continuity. It ensures that user data (encrypted secrets, metadata, audit logs) can be reliably restored in the event of data loss, corruption, or catastrophic failure.

**Purpose:** Provide step-by-step procedures for backing up and recovering Abyrith data to meet Recovery Time Objective (RTO) of 4 hours and Recovery Point Objective (RPO) of 1 hour.

**Frequency:**
- Automated backups: Continuous (WAL archiving)
- Daily snapshots: Automated at 02:00 UTC
- Recovery drills: Monthly
- Full disaster recovery test: Quarterly

**Estimated Time:**
- Point-in-time recovery: 30 minutes - 1 hour
- Full database restore: 1-2 hours
- Complete disaster recovery: 4 hours

**Risk Level:** Critical (data loss affects all users, zero-knowledge encryption means lost data is unrecoverable)

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [Backup Architecture](#backup-architecture)
5. [Automated Backup Procedures](#automated-backup-procedures)
6. [Point-in-Time Recovery (PITR)](#point-in-time-recovery-pitr)
7. [Disaster Recovery Procedures](#disaster-recovery-procedures)
8. [Verification](#verification)
9. [Rollback](#rollback)
10. [Troubleshooting](#troubleshooting)
11. [Post-Procedure](#post-procedure)
12. [Communication](#communication)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Recovering from accidental data deletion (user deleted secrets, projects, organizations)
- Responding to database corruption or failure
- Performing disaster recovery after complete system failure
- Testing backup integrity and recovery procedures
- Restoring data to a specific point in time
- Migrating to new infrastructure
- Investigating data inconsistencies or integrity issues
- Conducting quarterly disaster recovery drills

**Do NOT use this runbook when:**
- Performing routine database maintenance (use `10-operations/database/database-maintenance.md`)
- Applying schema migrations (use `04-database/migrations/migration-guide.md`)
- Troubleshooting application bugs (use incident response procedures)
- Responding to security incidents (use `10-operations/security/security-runbook.md` first)

### Scope

**What this covers:**
- Supabase PostgreSQL database backups (continuous WAL + daily snapshots)
- Point-in-time recovery to any second within retention period
- Complete disaster recovery procedures
- Backup verification and testing
- Recovery from various failure scenarios
- Data integrity validation post-recovery

**What this does NOT cover:**
- Cloudflare Workers deployment rollbacks (see `10-operations/deployment/deployment-pipeline.md`)
- Frontend (Cloudflare Pages) rollbacks (instant via dashboard)
- User file storage backups (Supabase Storage, if used)
- Third-party service recovery (Claude API, FireCrawl)
- Local development environment setup (see `11-development/local-setup.md`)

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Supabase dashboard - Admin access (production and staging projects)
- [ ] Supabase CLI - Installed and authenticated
- [ ] PostgreSQL client (psql) - Installed and configured
- [ ] GitHub repository - Write access (for documentation updates)
- [ ] Cloudflare dashboard - Admin access (for coordinating service status)
- [ ] AWS/cloud storage - Access for backup verification (if external backups configured)

**Credentials:**
- [ ] Supabase project ID (production and staging)
- [ ] Supabase service role key (stored in password manager, NOT in code)
- [ ] Database connection strings (production and staging)
- [ ] Cloud storage credentials (if applicable)
- [ ] PagerDuty/alerting system access

**How to request access:**
Contact DevOps team lead or database administrator. Production database access requires security review and approval from Engineering Lead.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
supabase --version      # Should be latest (1.x or higher)
psql --version          # Should be PostgreSQL 15.x client
pg_dump --version       # Should match PostgreSQL 15.x
pg_restore --version    # Should match PostgreSQL 15.x
```

**Installation:**
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Install PostgreSQL client tools
brew install postgresql@15

# Verify installation
supabase --version
psql --version
```

### Required Knowledge

**You should understand:**
- PostgreSQL backup and recovery concepts (WAL, PITR, snapshots)
- Supabase project architecture and managed backups
- Zero-knowledge encryption implications (encrypted data in backups)
- Database migrations and schema versioning
- RTO and RPO metrics and how they guide recovery decisions
- Communication protocols for incidents affecting users

**Reference documentation:**
- `04-database/database-overview.md` - Database architecture and backup strategy
- `03-security/security-model.md` - Zero-knowledge encryption (backups contain encrypted data)
- `TECH-STACK.md` - PostgreSQL 15.x and Supabase specifications
- `10-operations/incidents/incident-response.md` - Incident response procedures (when created)

---

## Pre-Flight Checklist

**Complete before starting recovery:**

### 1. Communication

- [ ] Notify team in `#incidents` Slack channel
- [ ] Create incident ticket in issue tracker (include severity: P0/P1/P2)
- [ ] Update status page if user-facing impact expected
- [ ] Notify Engineering Lead and DevOps Lead

**Template message:**
```
🚨 Data Recovery Required - [Severity]
Issue: [Brief description of data loss/corruption]
Affected: [Users/projects/data affected]
Recovery approach: [PITR / Snapshot restore / Full DR]
ETA: [Estimated recovery time]
Initiated by: @[your-name]

Status updates will be posted in this channel.
```

### 2. Assessment

- [ ] Identify scope of data loss (specific secrets, projects, entire database)
- [ ] Determine when data loss occurred (timestamp)
- [ ] Verify current database state (is it still functional?)
- [ ] Check if issue is isolated or system-wide
- [ ] Estimate number of users affected
- [ ] Determine if this is accidental deletion or corruption

### 3. Backup Verification

- [ ] Verify recent backup exists and is accessible
- [ ] Check backup timestamp (when was it taken?)
- [ ] Verify backup integrity (checksums, if available)
- [ ] Confirm backup covers the time period before data loss
- [ ] Check retention period (data within 7 days for WAL, 30 days for snapshots)

### 4. Recovery Strategy

- [ ] Choose recovery approach (PITR vs snapshot vs full DR)
- [ ] Verify recovery point available (timestamp to restore to)
- [ ] Estimate recovery time based on approach
- [ ] Identify dependencies (applications, Workers, frontend)
- [ ] Plan for service downtime (if required)
- [ ] Prepare rollback plan (if recovery fails)

### 5. Approvals

- [ ] Obtain approval from DevOps Lead or Engineering Lead (for production)
- [ ] Confirm with Product team if user-facing impact expected
- [ ] Document decision rationale in incident ticket

---

## Backup Architecture

### Backup Strategy Overview

Abyrith uses Supabase's managed backup system with multiple layers of protection:

```
┌────────────────────────────────────────────────────────────┐
│              Backup Architecture (Supabase)                 │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Layer 1: Continuous Backups (WAL Archiving)       │   │
│  │  • Frequency: Continuous (every transaction)       │   │
│  │  • Retention: 7 days (configurable to 30 days)     │   │
│  │  • RPO: < 1 minute                                  │   │
│  │  • Purpose: Point-in-time recovery                 │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Layer 2: Daily Automated Snapshots                │   │
│  │  • Frequency: Daily at 02:00 UTC                   │   │
│  │  • Retention: 7 daily + 4 weekly backups           │   │
│  │  • RPO: Up to 24 hours                             │   │
│  │  • Purpose: Fast restoration, long-term retention  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Layer 3: Manual Snapshots (On-Demand)             │   │
│  │  • Frequency: Before major changes/migrations      │   │
│  │  • Retention: 30 days                              │   │
│  │  • Purpose: Rollback point for risky operations    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Storage: Supabase Managed (Encrypted at Rest)     │   │
│  │  • Encryption: AES-256 (cloud provider managed)    │   │
│  │  • Redundancy: Multi-region replication            │   │
│  │  • Access: Admin console + CLI                     │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘

Important Notes:
• Backups contain ENCRYPTED secrets (zero-knowledge architecture)
• Server cannot decrypt secrets in backups (user master keys required)
• Metadata is plaintext in backups (service names, tags, audit logs)
• RLS policies are included in backups
```

### What Gets Backed Up

**Included in all backups:**
- ✅ All database schemas (`public`, `auth`, `storage`)
- ✅ All tables and data:
  - `secrets` table (encrypted values, encrypted DEKs, nonces, metadata)
  - `projects`, `organizations`, `org_members`, `project_members`
  - `audit_logs` (immutable event history)
  - `user_encryption_keys` (PBKDF2 salts, NOT master keys)
  - Supabase Auth tables (`auth.users`, sessions, etc.)
- ✅ Row-Level Security (RLS) policies
- ✅ Database functions, triggers, indexes
- ✅ Database configuration and settings

**NOT included in backups:**
- ❌ User master passwords (never stored server-side)
- ❌ Master encryption keys (derived from passwords, never stored)
- ❌ Cloudflare Workers code (versioned in Git)
- ❌ Frontend code (versioned in Git, deployed to Cloudflare Pages)
- ❌ Environment variables (stored in GitHub Secrets)
- ❌ Third-party API keys (stored in GitHub Secrets and Workers secrets)

### Retention Policies

**Continuous Backups (WAL):**
- **Retention:** 7 days minimum
- **Upgrade option:** 30 days (Pro/Team plan)
- **Access:** Via Supabase CLI `supabase db restore --timestamp`

**Daily Snapshots:**
- **Daily backups:** Retained for 7 days
- **Weekly backups:** Retained for 4 weeks (28 days)
- **Access:** Via Supabase dashboard or CLI

**Manual Snapshots:**
- **Retention:** 30 days
- **Purpose:** Pre-migration rollback points
- **Access:** Via Supabase dashboard

---

## Automated Backup Procedures

### Continuous Backups (WAL Archiving)

**How it works:**
Supabase automatically captures Write-Ahead Log (WAL) files for continuous backup. Every transaction is written to WAL, providing point-in-time recovery.

**Configuration:**
```bash
# Check current backup configuration
supabase projects list
supabase db inspect --project-id $PROJECT_ID

# Verify WAL archiving enabled (enabled by default in Supabase)
# No manual configuration required - managed by Supabase
```

**Verification:**
```bash
# Check last WAL backup timestamp
supabase db backups list --project-id $PROJECT_ID

# Expected output:
# BACKUP_ID          TYPE    STATUS     CREATED_AT            SIZE
# 20251030120000    WAL     completed  2025-10-30T12:00:00Z  150MB
# 20251030110000    WAL     completed  2025-10-30T11:00:00Z  145MB
```

**Monitoring:**
- Automated: Supabase monitors WAL archiving internally
- Alert if WAL archiving fails (Supabase sends email notification)
- Manual check: Run backup list command weekly

---

### Daily Automated Snapshots

**Schedule:** Daily at 02:00 UTC (automatically configured by Supabase)

**How it works:**
Supabase takes full database snapshot (pg_dump) every day, providing fast restoration without replaying WAL logs.

**Configuration:**
```bash
# View snapshot schedule (via Supabase dashboard)
# Settings → Database → Backups → Schedule

# Snapshots are automatic, no manual configuration needed
```

**Verification:**
```bash
# List recent snapshots
supabase db backups list --project-id $PROJECT_ID --type snapshot

# Expected output:
# BACKUP_ID          TYPE       STATUS     CREATED_AT            SIZE
# snap_20251030      snapshot   completed  2025-10-30T02:00:00Z  2.5GB
# snap_20251029      snapshot   completed  2025-10-29T02:00:00Z  2.4GB
# snap_20251028      snapshot   completed  2025-10-28T02:00:00Z  2.4GB
```

**Monitoring:**
- Daily automated check: Verify snapshot completed successfully
- Alert if snapshot fails: Email notification from Supabase
- Weekly manual verification: Restore latest snapshot to staging

**Alert Configuration:**
```yaml
# PagerDuty alert rule (example)
name: Daily Backup Failed
condition: No successful snapshot in 25 hours
severity: P2
notification: #alerts channel, on-call engineer
```

---

### Manual Snapshot Creation

**When to create:**
- Before major schema migrations
- Before deploying significant database changes
- Before bulk data operations (imports, deletions)
- Before emergency fixes that touch data
- On-demand for specific recovery points

**Procedure:**

**Step 1: Create manual snapshot**
```bash
# Via Supabase CLI
supabase db dump \
  --project-id $PROD_PROJECT_ID \
  --output ./backups/manual-snapshot-$(date +%Y%m%d-%H%M%S).sql

# Via Supabase Dashboard
# 1. Go to Dashboard → Project → Settings → Database → Backups
# 2. Click "Create manual backup"
# 3. Enter description: "Pre-migration backup for [description]"
# 4. Click "Create backup"
# 5. Wait for completion (1-5 minutes depending on database size)
```

**Step 2: Verify snapshot created**
```bash
# List backups to verify
supabase db backups list --project-id $PROD_PROJECT_ID

# Check snapshot size is reasonable
# Expected: 2-3GB for production database
```

**Step 3: Document snapshot**
```bash
# Add entry to backup log
echo "$(date) - Manual snapshot created: [backup_id] - Purpose: [reason]" \
  >> /var/log/backups/manual-backups.log

# Update incident/maintenance ticket with backup ID
```

**Time:** 2-5 minutes

---

### Backup Verification (Weekly)

**Purpose:** Ensure backups are restorable before they're needed

**Schedule:** Every Monday at 10:00 AM (automated via GitHub Actions)

**Procedure:**

**Step 1: Restore latest backup to staging**
```bash
# 1. Get latest snapshot ID
LATEST_BACKUP=$(supabase db backups list --project-id $PROD_PROJECT_ID \
  --type snapshot --limit 1 --format json | jq -r '.[0].id')

echo "Testing restore of backup: $LATEST_BACKUP"

# 2. Restore to staging environment
supabase db restore \
  --project-id $STAGING_PROJECT_ID \
  --backup-id $LATEST_BACKUP

# Expected: Restore completes in 5-10 minutes
```

**Step 2: Verify data integrity**
```bash
# Connect to staging database
psql $STAGING_DATABASE_URL

-- Run verification queries
-- 1. Check row counts match expected values
SELECT 'secrets' as table_name, count(*) as row_count FROM secrets
UNION ALL
SELECT 'projects', count(*) FROM projects
UNION ALL
SELECT 'organizations', count(*) FROM organizations
UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs;

-- 2. Verify RLS policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- 4. Verify recent data exists
SELECT max(created_at) as latest_secret FROM secrets;
-- Should be within 24 hours of backup time
```

**Step 3: Document results**
```bash
# Log verification results
echo "$(date) - Backup verification: SUCCESS - Backup ID: $LATEST_BACKUP" \
  >> /var/log/backups/verification.log

# If verification fails:
# 1. Alert DevOps team immediately
# 2. Investigate backup integrity
# 3. Create incident ticket
# 4. Do NOT proceed until issue resolved
```

**Time:** 15-20 minutes (mostly automated)

---

## Point-in-Time Recovery (PITR)

### When to Use PITR

**Use PITR when:**
- Accidental deletion occurred (user deleted secrets, project deleted)
- Data corruption detected at specific timestamp
- Need to restore to exact moment before issue occurred
- Issue happened within last 7 days (WAL retention period)
- Need surgical recovery (restore specific data, not entire database)

**Example scenarios:**
- User reports: "I accidentally deleted all secrets in my project at 2:30 PM today"
- Developer ran incorrect UPDATE statement affecting production data
- Application bug corrupted specific table data

### PITR Recovery Procedure

**Recovery Time:** 30 minutes - 1 hour
**RPO:** < 1 minute (can restore to exact second)

---

**Step 1: Identify Recovery Point**

**Purpose:** Determine exact timestamp to restore to

```bash
# 1. Gather information
# - When was data loss discovered?
# - When did data loss occur? (user report, audit logs)
# - What was last known good state?

# 2. Check audit logs to pinpoint timestamp
psql $PROD_DATABASE_URL <<EOF
SELECT
  timestamp,
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
FROM audit_logs
WHERE resource_type = 'secret'
  AND action = 'secret.deleted'
  AND timestamp > now() - interval '24 hours'
ORDER BY timestamp DESC
LIMIT 20;
EOF

# Example output:
# timestamp             | user_id | action         | resource_type | resource_id | metadata
# ----------------------+---------+----------------+---------------+-------------+----------
# 2025-10-30 14:32:15Z  | uuid-1  | secret.deleted | secret        | secret-123  | {...}
# 2025-10-30 14:32:10Z  | uuid-1  | secret.deleted | secret        | secret-124  | {...}

# Recovery point: 2025-10-30T14:32:00Z (1 minute before first deletion)
```

**Time:** 5-10 minutes

---

**Step 2: Create Current State Backup**

**Purpose:** Preserve current state before restoration (safety measure)

```bash
# Create snapshot of current database state
supabase db dump \
  --project-id $PROD_PROJECT_ID \
  --output ./backups/pre-pitr-backup-$(date +%Y%m%d-%H%M%S).sql

# Store backup ID for potential rollback
echo "Current state backup created: [timestamp]" >> pitr-recovery.log
```

**Time:** 2-5 minutes

---

**Step 3: Notify Users (If Downtime Required)**

**Purpose:** Inform users of planned maintenance

```bash
# Update status page
curl -X POST https://api.statuspage.io/v1/pages/$PAGE_ID/incidents \
  -H "Authorization: OAuth $STATUS_PAGE_TOKEN" \
  -d '{
    "incident": {
      "name": "Database Recovery in Progress",
      "status": "investigating",
      "impact": "maintenance",
      "body": "We are performing a point-in-time database recovery to restore accidentally deleted data. Service will be unavailable for approximately 30 minutes.",
      "components": ["database"]
    }
  }'

# Notify team
# Post in #incidents and #status Slack channels
```

**Time:** 2 minutes

---

**Step 4: Execute Point-in-Time Restore**

**Purpose:** Restore database to identified recovery point

```bash
# Option A: Full database PITR restore (requires downtime)
# ⚠️ WARNING: This REPLACES current database with past state

# 1. Put application in maintenance mode (if possible)
# Update Cloudflare Workers to return 503 (if maintenance mode exists)

# 2. Restore to recovery point timestamp
RECOVERY_TIMESTAMP="2025-10-30T14:32:00Z"

supabase db restore \
  --project-id $PROD_PROJECT_ID \
  --timestamp "$RECOVERY_TIMESTAMP"

# Expected output:
# Restoring database to 2025-10-30T14:32:00Z...
# Downloading WAL files...
# Replaying transactions...
# Restore complete. Database now at 2025-10-30T14:32:00Z.

# 3. Verify restore completed
psql $PROD_DATABASE_URL -c "SELECT now() as current_time, pg_last_wal_replay_lsn();"
```

**Alternative: Partial recovery (restore specific data only)**
```bash
# If full restore not needed, restore to temporary database first
# Then extract specific data

# 1. Restore to temporary staging database
supabase db restore \
  --project-id $TEMP_PROJECT_ID \
  --timestamp "$RECOVERY_TIMESTAMP"

# 2. Export specific data
psql $TEMP_DATABASE_URL <<EOF > recovered_secrets.sql
\copy (SELECT * FROM secrets WHERE project_id = 'affected-project-uuid') TO STDOUT CSV HEADER;
EOF

# 3. Import recovered data to production
psql $PROD_DATABASE_URL -f recovered_secrets.sql

# 4. Clean up temporary database
```

**Time:** 15-30 minutes (depending on database size and recovery point)

---

**Step 5: Verify Recovery**

**Purpose:** Ensure data restored correctly

```bash
# 1. Check recovered data exists
psql $PROD_DATABASE_URL <<EOF
-- Verify deleted secrets are back
SELECT id, service_name, key_name, created_at
FROM secrets
WHERE project_id = 'affected-project-uuid'
  AND id IN ('secret-123', 'secret-124');

-- Expected: Secrets exist again

-- Verify timestamps are correct
SELECT max(created_at) as latest_timestamp FROM secrets;
-- Should match recovery point timestamp
EOF

# 2. Test application functionality
# - User can log in
# - Secrets can be decrypted (user has master password)
# - Projects and teams intact
# - Audit logs present

# 3. Check for data consistency
psql $PROD_DATABASE_URL <<EOF
-- Verify referential integrity
SELECT
  'secrets without projects' as issue,
  count(*) as count
FROM secrets s
LEFT JOIN projects p ON s.project_id = p.id
WHERE p.id IS NULL
UNION ALL
SELECT
  'project_members without users',
  count(*)
FROM project_members pm
LEFT JOIN auth.users u ON pm.user_id = u.id
WHERE u.id IS NULL;
-- Expected: 0 rows (no orphaned data)
EOF
```

**Time:** 10 minutes

---

**Step 6: Resume Normal Operations**

**Purpose:** Bring application back online

```bash
# 1. Remove maintenance mode (if enabled)

# 2. Update status page
curl -X PATCH https://api.statuspage.io/v1/pages/$PAGE_ID/incidents/$INCIDENT_ID \
  -H "Authorization: OAuth $STATUS_PAGE_TOKEN" \
  -d '{
    "incident": {
      "status": "resolved",
      "body": "Database recovery completed successfully. All services operational."
    }
  }'

# 3. Notify team
# Post success message in Slack

# 4. Monitor for issues
# Watch error rates, user reports for 2 hours
```

**Time:** 5 minutes

---

**Checkpoint:** After PITR, verify:
- [ ] Deleted/corrupted data restored
- [ ] Application functional
- [ ] Users can access their secrets
- [ ] No data inconsistencies
- [ ] Audit logs show recovery event

---

## Disaster Recovery Procedures

### When to Use Full Disaster Recovery

**Use full DR when:**
- Complete Supabase outage or failure
- Database corruption beyond repair
- Data center failure affecting primary region
- Security incident requiring complete rebuild
- Migration to new infrastructure required

**Characteristics:**
- RTO: 4 hours (time to restore service)
- RPO: 1 hour (maximum data loss)
- Requires creating new database instance
- Full application rebuild

---

### Disaster Recovery Procedure

**Recovery Time:** 2-4 hours
**RPO:** Up to 1 hour

---

**Step 1: Declare Disaster Recovery Incident**

**Purpose:** Activate DR team and communicate severity

```bash
# 1. Create P0 incident ticket
# Title: "DISASTER RECOVERY: [brief description]"
# Severity: P0
# Assigned: DevOps Lead + Engineering Lead

# 2. Activate PagerDuty escalation
# Notify: On-call engineer + DevOps team + Engineering leadership

# 3. Update status page
# Status: "Major outage - disaster recovery in progress"

# 4. Notify stakeholders
# Email: founders, investors (for prolonged outage)
```

**Time:** 5 minutes

---

**Step 2: Assess Damage and Recovery Options**

**Purpose:** Understand scope and choose recovery strategy

```bash
# 1. Check primary Supabase project status
supabase projects list
supabase db inspect --project-id $PROD_PROJECT_ID

# 2. Attempt to connect to database
psql $PROD_DATABASE_URL -c "SELECT 1;"

# If connection fails:
# - Supabase outage (check status.supabase.com)
# - Database corruption
# - Network/DNS issue

# 3. Check Supabase status page
open https://status.supabase.com

# 4. Verify backup availability
supabase db backups list --project-id $PROD_PROJECT_ID

# 5. Decide recovery strategy:
# Option A: Wait for Supabase to restore (if temporary outage)
# Option B: Restore to new Supabase project
# Option C: Migrate to self-hosted PostgreSQL (extreme)
```

**Time:** 10-15 minutes

---

**Step 3: Create New Supabase Project (If Needed)**

**Purpose:** Provision new infrastructure for database restoration

```bash
# 1. Create new Supabase project
# Via Supabase Dashboard:
# - Go to https://app.supabase.com
# - Click "New Project"
# - Name: "abyrith-production-dr-$(date +%Y%m%d)"
# - Region: Same as original (or closest available)
# - Database password: Generate strong password
# - Plan: Same tier as production (Pro/Team)

# 2. Save new project credentials
NEW_PROJECT_ID="<new-project-id>"
NEW_DATABASE_URL="<new-connection-string>"
NEW_ANON_KEY="<new-anon-key>"
NEW_SERVICE_KEY="<new-service-role-key>"

# Store in password manager immediately

# 3. Configure project settings
# - Enable RLS (should be default)
# - Configure retention (7 days WAL minimum)
# - Set up backup schedule
```

**Time:** 5-10 minutes

---

**Step 4: Restore Latest Backup to New Project**

**Purpose:** Restore database from most recent backup

```bash
# 1. Identify best backup to restore
# Prefer: Latest WAL backup (most recent data)
# Fallback: Latest daily snapshot

BACKUP_ID=$(supabase db backups list \
  --project-id $OLD_PROJECT_ID \
  --limit 1 \
  --format json | jq -r '.[0].id')

echo "Restoring backup: $BACKUP_ID"

# 2. Restore backup to new project
supabase db restore \
  --project-id $NEW_PROJECT_ID \
  --backup-id $BACKUP_ID

# Expected: 15-45 minutes depending on database size

# 3. Monitor restore progress
# Watch Supabase dashboard for restore status
# Logs will show: "Restoring... 25% complete"

# 4. Verify restore completed
psql $NEW_DATABASE_URL <<EOF
-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;

-- Verify table row counts
SELECT 'secrets' as table_name, count(*) FROM secrets
UNION ALL
SELECT 'projects', count(*) FROM projects
UNION ALL
SELECT 'organizations', count(*) FROM organizations;

-- Check latest data timestamp
SELECT max(created_at) as latest_data FROM secrets;
EOF
```

**Time:** 20-60 minutes (mostly waiting for restore)

---

**Step 5: Update Application Configuration**

**Purpose:** Point application to new database

```bash
# 1. Update GitHub Secrets
# Go to: GitHub repo → Settings → Secrets and variables → Actions

# Update these secrets:
PROD_SUPABASE_URL=$NEW_DATABASE_URL
PROD_SUPABASE_ANON_KEY=$NEW_ANON_KEY
PROD_SUPABASE_SERVICE_KEY=$NEW_SERVICE_KEY

# 2. Update Cloudflare Workers secrets
echo "$NEW_DATABASE_URL" | wrangler secret put SUPABASE_URL --env production
echo "$NEW_ANON_KEY" | wrangler secret put SUPABASE_ANON_KEY --env production

# 3. Trigger re-deployment
# This picks up new secrets
git tag -a "dr-recovery-$(date +%Y%m%d-%H%M%S)" -m "DR: Update to new database"
git push origin main --tags

# 4. Monitor deployment
# Watch GitHub Actions for successful deployment
```

**Time:** 10-15 minutes

---

**Step 6: Verify Application Functionality**

**Purpose:** Ensure application works with new database

```bash
# 1. Run smoke tests
pnpm test:e2e:smoke --base-url=https://abyrith.com

# 2. Manual testing checklist
# - [ ] User can log in
# - [ ] User can see their projects
# - [ ] User can decrypt existing secrets (master password works)
# - [ ] User can create new secret
# - [ ] Team features work (invite, permissions)
# - [ ] Audit logs accessible
# - [ ] AI assistant functional

# 3. Check for errors
# - Sentry dashboard: No spike in errors
# - Cloudflare Analytics: Traffic flowing normally
# - Database connections: Healthy

# 4. Test across multiple users
# Have team members verify their accounts work
```

**Time:** 20-30 minutes

---

**Step 7: Monitor and Stabilize**

**Purpose:** Ensure system stability after DR

```bash
# 1. Intensive monitoring for 4 hours
# - Error rates: Should be < 0.1%
# - Response times: p95 < 500ms
# - Database connections: < 80% of pool
# - User reports: Monitor support channels

# 2. Set up temporary alerts
# Alert on:
# - Error rate > 1%
# - Response time p95 > 1s
# - Database connection pool > 90%

# 3. Prepare rollback (if needed)
# Keep old project accessible for 7 days
# Can revert DNS/configuration if issues arise

# 4. Document DR event
# Update incident ticket with:
# - Timeline of events
# - Actions taken
# - Data loss (if any)
# - Lessons learned
```

**Time:** Ongoing (4+ hours of monitoring)

---

**Step 8: Post-DR Cleanup**

**Purpose:** Clean up old infrastructure and update documentation

```bash
# 1. Wait 7 days for stability

# 2. Decommission old Supabase project (after 7 days)
# - Export final backup for records
# - Cancel subscription (if separate billing)
# - Archive connection strings (do not delete)

# 3. Update documentation
# - Update TECH-STACK.md with new project ID
# - Update deployment docs with new endpoints
# - Document DR event in incident history

# 4. Conduct post-mortem
# Schedule: Within 5 business days of DR
# Attendees: DevOps team, Engineering Lead, affected users (if applicable)
# Document: Root cause, timeline, action items
```

**Time:** Variable (7+ days)

---

**Checkpoint:** After DR, verify:
- [ ] Application fully operational on new database
- [ ] Users can access their data
- [ ] Data loss quantified and communicated
- [ ] All services pointing to new database
- [ ] Monitoring alerts configured
- [ ] Post-mortem scheduled

---

## Verification

### Post-Recovery Checks

**1. Data Integrity:**
```bash
# Connect to restored database
psql $DATABASE_URL

-- 1. Verify row counts
SELECT
  'secrets' as table_name,
  count(*) as row_count
FROM secrets
UNION ALL
SELECT 'projects', count(*) FROM projects
UNION ALL
SELECT 'organizations', count(*) FROM organizations
UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs;

-- Compare to expected counts (from before recovery)

-- 2. Check for orphaned data
SELECT 'secrets without projects' as issue, count(*) as count
FROM secrets s
LEFT JOIN projects p ON s.project_id = p.id
WHERE p.id IS NULL
UNION ALL
SELECT 'project_members without users', count(*)
FROM project_members pm
LEFT JOIN auth.users u ON pm.user_id = u.id
WHERE u.id IS NULL;

-- Expected: 0 rows (no orphans)

-- 3. Verify recent data
SELECT
  max(created_at) as latest_secret,
  min(created_at) as earliest_secret,
  count(*) as total_secrets
FROM secrets;

-- Check timestamps make sense
```

---

**2. Schema Integrity:**
```bash
# Verify database schema is correct
psql $DATABASE_URL <<EOF
-- Check RLS policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected: All RLS policies present

-- Check indexes exist
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Expected: All performance indexes present

-- Check triggers exist
SELECT
  trigger_schema,
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Expected: updated_at triggers, audit triggers
EOF
```

---

**3. Application Functionality:**
```bash
# Run automated smoke tests
pnpm test:e2e:smoke

# Expected: All tests pass

# Manual test checklist:
# - [ ] User authentication works (login/logout)
# - [ ] User can view projects
# - [ ] User can decrypt secrets (master password required)
# - [ ] User can create new secret
# - [ ] User can update existing secret
# - [ ] User can delete secret
# - [ ] Team features work (invite, remove members)
# - [ ] Audit logs display correctly
# - [ ] AI assistant accessible (if integrated)
# - [ ] MCP endpoints respond (if integrated)
```

---

**4. Performance Metrics:**
```bash
# Check database performance
psql $DATABASE_URL <<EOF
-- Query latency
EXPLAIN ANALYZE
SELECT * FROM secrets WHERE user_id = 'test-user-uuid' LIMIT 10;

-- Expected: Execution time < 50ms

-- Check connection pool
SELECT
  count(*) as active_connections,
  max_conn,
  used_conn
FROM pg_stat_activity,
  (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') AS max,
  (SELECT count(*) as used_conn FROM pg_stat_activity) AS used;

-- Expected: Connections < 80% of max
EOF

# Check application response times
curl -w "@curl-format.txt" -o /dev/null -s https://abyrith.com/api/health

# Expected: < 200ms response time
```

---

### Success Criteria

**Recovery is successful when:**
- [ ] Database restored to correct point in time
- [ ] No unexpected data loss beyond RPO
- [ ] All tables and data present
- [ ] RLS policies, indexes, triggers intact
- [ ] Application connects successfully to database
- [ ] Users can authenticate and access their secrets
- [ ] Users can decrypt secrets (encryption keys intact)
- [ ] Audit logs show complete history
- [ ] Performance metrics within normal range
- [ ] No spike in error rates (< 0.1%)
- [ ] Team notified and documentation updated

---

## Rollback

### When to Rollback Recovery

**Rollback recovery if:**
- Restored data is corrupted
- Wrong recovery point selected (data missing)
- Application fails to connect to restored database
- Data integrity checks fail
- Users report widespread issues
- Recovery introduced new problems worse than original issue

### Rollback Procedure

**Step 1: Stop Recovery Process**
```bash
# 1. If recovery in progress, cancel immediately
# Press Ctrl+C if running in terminal

# 2. Do not make additional changes
# Preserve current state for analysis

# 3. Notify team
# Post in #incidents: "Recovery rollback initiated - [reason]"
```

**Time:** Immediate

---

**Step 2: Restore to Pre-Recovery State**

```bash
# If PITR rollback:
# 1. Restore from pre-recovery backup created in Step 2
supabase db restore \
  --project-id $PROD_PROJECT_ID \
  --backup-id $PRE_RECOVERY_BACKUP_ID

# If DR rollback:
# 1. Revert application configuration to old database
echo "$OLD_DATABASE_URL" | wrangler secret put SUPABASE_URL --env production
echo "$OLD_ANON_KEY" | wrangler secret put SUPABASE_ANON_KEY --env production

# 2. Trigger re-deployment
git revert HEAD
git push origin main

# 3. Wait for deployment (5-10 minutes)
```

**Time:** 10-20 minutes

---

**Step 3: Verify Rollback**

```bash
# 1. Test database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# 2. Check application health
curl https://abyrith.com/api/health

# 3. Verify users can access data
# Manual testing by team members

# 4. Check error rates
# Sentry dashboard should show normal error rate
```

**Time:** 10 minutes

---

**Step 4: Investigate Recovery Failure**

```bash
# 1. Document what went wrong
# - Which step failed?
# - What error messages appeared?
# - What data was affected?

# 2. Analyze recovery logs
# Save all command output for analysis

# 3. Determine root cause
# - Wrong recovery point?
# - Backup corruption?
# - Application incompatibility?
# - Configuration error?

# 4. Plan corrective action
# - Fix issue
# - Re-test in staging
# - Attempt recovery again (or choose alternative)
```

---

### Post-Rollback

**After rollback:**
1. Update incident ticket with rollback details
2. Schedule post-mortem to analyze failure
3. Update recovery procedures if issues identified
4. Re-plan recovery approach with corrective measures
5. Communicate status to stakeholders

---

## Troubleshooting

### Issue 1: Backup Not Found

**Symptoms:**
```
Error: Backup ID not found
supabase db restore: backup snap_20251030 does not exist
```

**Cause:** Backup ID invalid, deleted, or outside retention period

**Solution:**
```bash
# 1. List all available backups
supabase db backups list --project-id $PROJECT_ID

# 2. Check retention period
# - WAL backups: 7 days (or 30 days if upgraded)
# - Daily snapshots: 7 days + 4 weeks

# 3. If backup outside retention:
# - Cannot restore to that point (data loss)
# - Restore to oldest available backup
# - Accept data loss and communicate to users

# 4. If backup should exist but missing:
# - Contact Supabase support immediately
# - Escalate to emergency support
# - Investigate backup system failure
```

**Prevention:**
- Monitor backup completion daily
- Set up alerts for backup failures
- Extend retention to 30 days for critical environments
- Test restore process monthly

---

### Issue 2: Restore Takes Too Long

**Symptoms:**
- Restore running for 2+ hours
- Progress bar stuck at same percentage
- No log activity

**Cause:** Large database, network issues, or Supabase performance problem

**Solution:**
```bash
# 1. Check restore progress
# Via Supabase Dashboard: Settings → Database → Backups → View restore

# 2. Check Supabase status
open https://status.supabase.com
# Look for performance degradation alerts

# 3. If stuck:
# - Wait additional 30 minutes (large databases take time)
# - Do NOT cancel restore (may corrupt database)
# - Contact Supabase support if no progress after 3 hours

# 4. Alternative: Restore to different region
# If source region having issues, try different region
supabase db restore \
  --project-id $NEW_PROJECT_ID \
  --backup-id $BACKUP_ID \
  --region us-east-1  # Different region
```

**Expected restore times:**
- Small DB (< 1GB): 5-15 minutes
- Medium DB (1-10GB): 15-45 minutes
- Large DB (10GB+): 45 minutes - 2 hours

---

### Issue 3: Data Inconsistency After Restore

**Symptoms:**
- Foreign key violations
- Orphaned records
- Unexpected row counts
- Application errors referencing missing data

**Cause:** Partial restore, backup corruption, or mid-transaction restore point

**Solution:**
```bash
# 1. Run integrity checks
psql $DATABASE_URL <<EOF
-- Check foreign key violations
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  contype AS constraint_type
FROM pg_constraint
WHERE contype = 'f'; -- foreign keys

-- Try to find violations
SELECT s.*
FROM secrets s
LEFT JOIN projects p ON s.project_id = p.id
WHERE p.id IS NULL;

-- Check for orphaned data
SELECT pm.*
FROM project_members pm
LEFT JOIN auth.users u ON pm.user_id = u.id
WHERE u.id IS NULL;
EOF

# 2. If inconsistencies found:
# Option A: Restore to different (earlier) recovery point
# Option B: Clean up orphaned data manually (if safe)

# 3. Clean up orphaned data (CAREFULLY)
psql $DATABASE_URL <<EOF
-- Only if safe and approved by Engineering Lead
DELETE FROM secrets
WHERE project_id NOT IN (SELECT id FROM projects);

DELETE FROM project_members
WHERE user_id NOT IN (SELECT id FROM auth.users);
EOF

# 4. Verify cleanup
# Re-run integrity checks
```

**Prevention:**
- Use daily snapshots for consistent restore points
- Test restores monthly to detect corruption early
- Choose recovery timestamps between transactions (e.g., 2:00 AM, low activity)

---

### Issue 4: Users Cannot Decrypt Secrets After Restore

**Symptoms:**
- Users report "Failed to decrypt secret"
- Error: "Invalid nonce" or "Authentication tag mismatch"
- Some secrets decrypt, others don't

**Cause:** Backup corruption, encryption key mismatch, or partial restore

**Solution:**
```bash
# 1. Verify encryption metadata intact
psql $DATABASE_URL <<EOF
-- Check secrets have all required fields
SELECT
  id,
  encrypted_value IS NOT NULL as has_value,
  encrypted_dek IS NOT NULL as has_dek,
  secret_nonce IS NOT NULL as has_nonce,
  dek_nonce IS NOT NULL as has_dek_nonce
FROM secrets
WHERE encrypted_value IS NULL
   OR encrypted_dek IS NULL
   OR secret_nonce IS NULL
   OR dek_nonce IS NULL;

-- Expected: 0 rows (all secrets complete)
EOF

# 2. If encryption data missing:
# - This is DATA LOSS (cannot recover encrypted secrets without keys)
# - Identify affected secrets
# - Notify affected users
# - Users must re-enter secrets from original sources

# 3. If encryption data present but decryption fails:
# - User may have wrong master password
# - Verify user's PBKDF2 salt intact:
psql $DATABASE_URL <<EOF
SELECT user_id, salt IS NOT NULL as has_salt
FROM user_encryption_keys
WHERE user_id = 'affected-user-uuid';
EOF

# - If salt missing, user must reset master password (LOSES ALL SECRETS)

# 4. Test decryption manually (if possible)
# Have user attempt to decrypt via application
# If fails, check browser console for specific error
```

**Prevention:**
- Zero-knowledge encryption means encrypted data is as good as plaintext data in backups
- Integrity checks cannot detect encryption corruption (data is opaque)
- Users should maintain offline backup of critical secrets

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| DevOps Lead | [Name] | Slack @devops-lead | Immediate |
| Database Administrator | [Name] | Slack @dba | If DevOps unavailable |
| Engineering Lead | [Name] | Slack @eng-lead | For DR decisions |
| Supabase Support | - | support@supabase.com | For platform issues |
| PagerDuty On-Call | Rotating | PagerDuty | For P0 incidents |

---

## Post-Procedure

### Cleanup

**After successful recovery:**
```bash
# 1. No cleanup needed for PITR (Supabase manages WAL files)

# 2. For DR with new project:
# - Keep old project for 7 days (safety period)
# - Archive connection strings in password manager
# - Cancel old project subscription after 7 days
# - Document new project ID in TECH-STACK.md

# 3. Clean up temporary files
rm -f ./backups/pre-pitr-backup-*.sql
rm -f ./backups/manual-snapshot-*.sql
# (Keep for 30 days, then archive to cold storage)
```

### Documentation

**Update these documents:**
- [ ] This runbook (if process improvements identified)
- [ ] `04-database/database-overview.md` (if architecture changed)
- [ ] `TECH-STACK.md` (if new Supabase project created)
- [ ] `CHANGELOG.md` (document recovery event)
- [ ] Incident ticket (complete timeline and resolution)
- [ ] Post-mortem document (if P0/P1 incident)

### Communication

**Notify:**
- [ ] Team in #incidents Slack channel: "Recovery completed successfully"
- [ ] Update status page: "All systems operational"
- [ ] Close incident ticket
- [ ] Email affected users (if applicable):

**User notification template:**
```
Subject: Service Recovery Complete - Data Restored

Hello,

We successfully completed a database recovery operation at [time]. Your data has been restored to [timestamp].

What happened:
[Brief explanation of data loss]

What we did:
[Brief explanation of recovery process]

Impact:
- Data loss: [X minutes/hours] of data between [time] and [time]
- Service downtime: [X minutes]

What you need to do:
- Verify your secrets and projects
- Re-enter any secrets created between [time] and [time]
- Contact support if anything is missing

We apologize for the inconvenience and have implemented additional safeguards to prevent future occurrences.

Best regards,
Abyrith Team
```

### Monitoring

**Increased monitoring period:**
- Monitor for 24 hours after recovery
- Watch for:
  - Unusual error rates (> 0.5%)
  - Performance degradation (p95 > 1s)
  - User reports of missing data
  - Database connection issues
  - Unexpected data modifications

**Set up temporary alerts:**
- Alert on error rate > 1%
- Alert on response time p95 > 1s
- Alert on database connection pool > 90%
- Alert on user complaints (support tickets)

---

## Communication

### Communication Templates

**Pre-Recovery Announcement:**
```
🔧 Database Recovery Scheduled

When: [Date/Time] ([Timezone])
Duration: ~[X] minutes to [X] hours
Impact: Service unavailable during recovery
Purpose: Restoring data lost due to [reason]

What this means:
- You will not be able to access Abyrith during recovery
- Data will be restored to [timestamp]
- Any changes made between [time] and [time] will be lost

Recovery progress will be posted in this channel.

Questions? Contact support@abyrith.com
```

---

**During Recovery:**
```
🔄 Recovery In Progress

Status: [Current step - e.g., "Restoring from backup"]
Progress: [X]% complete
ETA: ~[X] minutes remaining

Latest:
✅ Backup verified
✅ Recovery initiated
🔄 Restoring database...
⏳ Verification pending

Everything proceeding as expected.
```

---

**Completion:**
```
✅ Database Recovery Complete

Completed: [Time]
Duration: [Actual time taken]
Status: Success

Recovery summary:
- Data restored to: [timestamp]
- Data loss: [X minutes] (between [time] and [time])
- All services: Operational
- Verification: Complete

What's next:
- Please verify your secrets and projects
- Re-enter any secrets created between [time] and [time]
- Contact support if anything is missing

We apologize for the disruption and thank you for your patience.
```

---

**Recovery Failure Announcement:**
```
⚠️ Recovery Delayed - Investigating

Status: Recovery encountered issues
Issue: [Brief description]
Current state: [Rolled back / Investigating / Attempting alternative]

Timeline:
- Original ETA was [time]
- New ETA: [time] (additional [X] hours)

We are working urgently to resolve this. Updates every 30 minutes.

Contact: support@abyrith.com
```

---

## Dependencies

### Technical Dependencies

**Must exist before recovery:**
- [x] `04-database/database-overview.md` - Database architecture and backup strategy
- [x] `03-security/security-model.md` - Zero-knowledge encryption (backups contain encrypted data)
- [x] `TECH-STACK.md` - PostgreSQL 15.x and Supabase specifications
- [x] `10-operations/deployment/deployment-pipeline.md` - Deployment procedures for post-recovery

**Systems involved:**
- Supabase PostgreSQL - Database to be backed up and restored
- Supabase CLI - Tool for backup/restore operations
- PostgreSQL client tools - For verification and manual operations
- GitHub Actions - For automated backup verification
- Monitoring tools - For post-recovery verification (Sentry, Cloudflare Analytics)

### Team Dependencies

**Requires coordination with:**
- DevOps team - Execute recovery procedures, monitor systems
- Engineering team - Verify application functionality post-recovery
- Product team - User communication for service interruptions
- Support team - Handle user inquiries during and after recovery

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture and backup strategy details
- `03-security/security-model.md` - Zero-knowledge encryption implications for backups
- `10-operations/deployment/deployment-pipeline.md` - Deployment procedures
- `10-operations/database/database-maintenance.md` - Routine database operations (when created)
- `10-operations/incidents/incident-response.md` - Incident response procedures (when created)
- `TECH-STACK.md` - Technology specifications

### External Resources
- [Supabase Backup Documentation](https://supabase.com/docs/guides/platform/backups) - Official backup guide
- [PostgreSQL PITR Documentation](https://www.postgresql.org/docs/15/continuous-archiving.html) - Point-in-time recovery
- [PostgreSQL Backup Best Practices](https://www.postgresql.org/docs/15/backup.html) - Backup strategies
- [Disaster Recovery Planning](https://en.wikipedia.org/wiki/Disaster_recovery) - DR concepts

### Incident History

**Previous recovery events:**
- None yet (new platform)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | DevOps Team / Database Administrator | Initial backup and recovery runbook |

---

## Notes

### Improvements Needed
- Implement automated backup verification (weekly GitHub Actions job)
- Set up cross-region backup replication for additional redundancy
- Create backup restoration dashboard for visibility
- Automate PITR for common scenarios (self-service recovery)
- Implement backup encryption verification (ensure backups are restorable)

### Lessons Learned
- Zero-knowledge encryption means lost data cannot be recovered by server (by design)
- Users must be educated about master password importance (no recovery possible)
- Regular backup testing is critical (quarterly DR drills required)
- Clear communication during recovery reduces user frustration

### Next Review Date
2025-11-30 - Review after first month of production operations
