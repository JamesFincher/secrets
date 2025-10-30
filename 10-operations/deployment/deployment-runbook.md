---
Document: Deployment Procedures - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: DevOps Team
Status: Draft
Dependencies: 10-operations/deployment/deployment-pipeline.md, 02-architecture/system-overview.md, TECH-STACK.md
---

# Deployment Procedures Operations Runbook

## Overview

This runbook defines the complete deployment procedures for the Abyrith secrets management platform across all environments (staging and production). It covers pre-deployment checks, deployment execution, verification procedures, rollback strategies, and emergency hotfix processes.

**Purpose:** Ensure safe, repeatable, and auditable deployments with minimal downtime and risk.

**Frequency:** On-demand (per release) or as needed for hotfixes

**Estimated Time:**
- Staging deployment: ~15 minutes
- Production deployment: ~30-45 minutes (including verification)
- Rollback: ~10-15 minutes
- Emergency hotfix: ~20-30 minutes

**Risk Level:** High (production deployments can impact all users)

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
10. [Dependencies](#dependencies)
11. [References](#references)
12. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Deploying a new release to staging or production
- Promoting staging changes to production
- Deploying security patches or critical bug fixes
- Performing database migrations
- Updating infrastructure configuration
- Rolling back a problematic deployment

**Do NOT use this runbook when:**
- Making configuration-only changes (use environment variable update procedure)
- Updating documentation only (no deployment needed)
- Testing in local development environment
- Performing read-only operations or queries

### Scope

**What this covers:**
- Frontend deployments (Cloudflare Pages)
- Backend deployments (Cloudflare Workers)
- Database migrations (Supabase)
- Environment variable updates
- Deployment verification and health checks
- Rollback procedures

**What this does NOT cover:**
- Infrastructure provisioning (see infrastructure setup docs)
- DNS changes (see DNS management runbook)
- Security incident response (see security runbook)
- Performance tuning (see operations runbook)

---

## Prerequisites

### Required Access

**Systems:**
- [ ] GitHub - Write access to main repository
- [ ] Cloudflare Dashboard - Deploy permissions for production account
- [ ] Supabase Dashboard - Admin access to production project
- [ ] Sentry - Release tracking permissions (if configured)
- [ ] Slack - Access to #deployments channel

**Credentials:**
- [ ] GitHub Personal Access Token (PAT) with repo and workflow permissions
- [ ] Cloudflare API Token with Workers and Pages deploy permissions
- [ ] Supabase Service Role Key for production (stored in GitHub Secrets)
- [ ] Sentry Auth Token for release tracking (if configured)

**How to request access:**
1. Contact DevOps Lead or Engineering Manager
2. Submit access request via [access management system]
3. Complete required security training for production access
4. Set up 2FA on all production systems

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
git --version          # Should be 2.40+ or higher
node --version         # Should be 20.x or higher
pnpm --version         # Should be 8.x or higher
gh --version           # GitHub CLI - Should be 2.x or higher (optional but recommended)
```

**Installation:**
```bash
# If tools are missing

# Install Node.js 20 LTS
# macOS (using Homebrew):
brew install node@20

# Install pnpm
npm install -g pnpm

# Install GitHub CLI (optional)
brew install gh
```

**Cloudflare CLI (Wrangler):**
```bash
# Install Wrangler for Workers deployment
pnpm install -g wrangler

# Verify installation
wrangler --version  # Should be 3.x or higher
```

**Supabase CLI:**
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Verify installation
supabase --version  # Should be 1.x or higher
```

### Required Knowledge

**You should understand:**
- Git branching and merging strategies
- Cloudflare Pages deployment process
- Cloudflare Workers architecture
- Supabase database migration workflow
- Zero-knowledge encryption architecture (secrets cannot be accessed server-side)
- Rollback procedures and impact on users

**Reference documentation:**
- `TECH-STACK.md` - Technology stack overview
- `02-architecture/system-overview.md` - System architecture
- `10-operations/deployment/deployment-pipeline.md` - CI/CD pipeline details
- `04-database/database-overview.md` - Database architecture

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication

- [ ] Notify team in `#deployments` Slack channel
  - Template: "🚀 Deploying release [version] to [staging/production] - ETA [time]"
- [ ] Create deployment tracking issue in GitHub
  - Template: Use `.github/ISSUE_TEMPLATE/deployment.md`
- [ ] Update internal status page (if customer-facing changes): [Status page URL]
- [ ] For production: Schedule deployment during approved maintenance window

### 2. Backup

- [ ] Verify recent database backup exists
  - Go to Supabase Dashboard → Database → Backups
  - Confirm backup timestamp is within last 24 hours
- [ ] Verify backup integrity
  - Check backup file size is reasonable (>0 bytes)
  - Review backup logs for any errors
- [ ] Tag current production deployment
  ```bash
  # Tag the current production commit for easy rollback
  git tag -a prod-backup-$(date +%Y%m%d-%H%M%S) -m "Pre-deployment backup"
  git push origin --tags
  ```

### 3. Environment Check

- [ ] Verify current system state
  ```bash
  # Check Cloudflare Pages deployment status
  # Visit: https://dash.cloudflare.com/[account-id]/pages

  # Check current Workers deployment
  wrangler deployments list

  # Check Supabase project status
  # Visit: https://app.supabase.com/project/[project-id]/settings/general
  ```

- [ ] Check for ongoing operations
  - No active deployments in progress
  - No database migrations running
  - No scheduled maintenance in progress

- [ ] Review recent changes/deployments
  ```bash
  # Review recent commits
  git log --oneline -10

  # Check GitHub Actions status
  gh run list --limit 5
  ```

- [ ] Check system health metrics
  - Cloudflare Analytics: Error rate <1%
  - Supabase: Database connections <80% of max
  - Sentry: No spike in errors in last hour

### 4. Timing

- [ ] Confirm maintenance window (if applicable)
  - **Staging:** Any time (low user impact)
  - **Production:** Off-peak hours (typically 2 AM - 6 AM UTC) or approved window

- [ ] Verify low-traffic period
  - Check Cloudflare Analytics for current traffic
  - Aim for <50% of peak traffic for production deploys

- [ ] Coordinate with dependent teams
  - Notify customer support of upcoming deployment
  - Confirm no major demos or customer events scheduled

### 5. Preparation

- [ ] Read through entire runbook
- [ ] Review release notes and changelog
  ```bash
  # Generate changelog since last release
  git log --oneline $(git describe --tags --abbrev=0)..HEAD
  ```

- [ ] Identify any breaking changes or migrations
  - Review database migration files in `supabase/migrations/`
  - Check for API contract changes
  - Verify environment variable changes

- [ ] Prepare rollback plan
  - Note current production version/commit
  - Verify rollback procedure is understood
  - Ensure backup is available

- [ ] Have emergency contacts ready
  - DevOps Lead: [Contact]
  - Engineering Manager: [Contact]
  - On-Call Engineer: [PagerDuty link]

---

## Procedure

### Step 1: Deploy to Staging

**Purpose:** Test deployment process and verify changes in staging environment before production

**Commands:**
```bash
# 1. Ensure you're on the correct branch
git checkout main
git pull origin main

# 2. Verify all tests pass locally
pnpm install
pnpm run test
pnpm run lint

# 3. Build frontend locally to catch any build errors
pnpm run build
```

**Expected output:**
```
✓ All tests passed
✓ No linting errors
✓ Build completed successfully
```

**If something goes wrong:**
- Build fails → Fix build errors before proceeding
- Tests fail → Fix failing tests or document known issues
- Lint errors → Run `pnpm run lint:fix` and commit fixes

**Time:** ~5-10 minutes

---

**Trigger Staging Deployment:**

```bash
# Option 1: Automatic deployment via GitHub Actions (recommended)
# Push to main branch triggers staging deployment
git push origin main

# Option 2: Manual deployment via Cloudflare CLI
# For frontend:
cd frontend
pnpm run deploy:staging

# For Workers:
cd workers
wrangler deploy --env staging
```

**Monitor deployment:**
```bash
# Watch GitHub Actions workflow
gh run watch

# Or visit: https://github.com/[org]/[repo]/actions
```

**Expected output:**
```
✓ Tests passed
✓ Build completed
✓ Deployed to Cloudflare Pages (staging)
✓ Workers deployed to staging environment
✓ Database migrations applied (if any)
```

**Staging URL:** `https://staging.abyrith.com` (or Cloudflare preview URL)

**Time:** ~10 minutes

---

### Step 2: Verify Staging Deployment

**Purpose:** Ensure staging deployment is functional before promoting to production

**Manual verification:**
```bash
# 1. Check deployment status
curl -I https://staging.abyrith.com
# Should return: HTTP/2 200

# 2. Verify API health
curl https://staging.abyrith.com/api/health
# Should return: {"status":"ok","version":"x.y.z"}

# 3. Check database connectivity
# Via Supabase Dashboard → Database → Query Editor
SELECT count(*) FROM secrets;
# Should return: count > 0 (if data exists)
```

**Functional testing:**
- [ ] User authentication flow (login/logout)
- [ ] Create a new secret (encrypted client-side)
- [ ] Retrieve secret (decryption works)
- [ ] Update secret metadata
- [ ] Delete secret
- [ ] AI Assistant responds correctly
- [ ] MCP integration (if configured)
- [ ] Audit logs are created

**Database migration verification:**
```bash
# If migrations were applied, verify schema changes
supabase db diff --schema public --linked --env staging
# Should show no unexpected differences
```

**Performance check:**
- [ ] Page load time <3s
- [ ] API response time <500ms
- [ ] No JavaScript errors in console
- [ ] No 404 errors for static assets

**Checkpoint:** After this step, staging should be fully functional

**Time:** ~5-10 minutes

---

### Step 3: Create Production Release

**Purpose:** Tag the release and prepare for production deployment

**Commands:**
```bash
# 1. Create release tag
VERSION="v1.2.3"  # Update version number
git tag -a $VERSION -m "Release $VERSION - [Brief description]"
git push origin $VERSION

# 2. Create GitHub Release
gh release create $VERSION \
  --title "Release $VERSION" \
  --notes-file CHANGELOG.md \
  --latest

# 3. Notify Sentry of new release (if configured)
# This helps track errors by release version
export SENTRY_AUTH_TOKEN="[your-sentry-token]"
sentry-cli releases new -p abyrith $VERSION
sentry-cli releases set-commits --auto $VERSION
```

**Expected output:**
```
✓ Tag created: v1.2.3
✓ GitHub release created
✓ Sentry release tracked
```

**Time:** ~2 minutes

---

### Step 4: Apply Database Migrations (Production)

**Purpose:** Apply any database schema changes before deploying application code

⚠️ **CRITICAL:** Database migrations should be backwards-compatible with the current production code

**Commands:**
```bash
# 1. Review pending migrations
supabase db diff --schema public --linked --env production

# 2. Apply migrations to production
supabase db push --linked --env production

# 3. Verify migrations applied successfully
supabase migration list --linked --env production
```

**Expected output:**
```
✓ Migrations applied successfully
✓ No errors in migration logs
```

**Important notes:**
- ⚠️ Migrations are applied before code deployment
- ⚠️ Ensure migrations are backwards-compatible
- ⚠️ Monitor database performance during migration
- ⚠️ Large migrations may require maintenance window

**If migration fails:**
1. **DO NOT PROCEED** with code deployment
2. Review migration error logs
3. Rollback migration if possible
4. Fix migration issues
5. Restart deployment process

**Time:** ~2-5 minutes (varies with migration size)

---

### Step 5: Deploy to Production

**Purpose:** Deploy verified code to production environment

**Commands:**
```bash
# Option 1: Automatic deployment via GitHub Actions (recommended)
# Triggered by creating a release tag in Step 3
# Monitor at: https://github.com/[org]/[repo]/actions

# Option 2: Manual deployment (use only if CI/CD unavailable)

# Deploy frontend
cd frontend
pnpm run build
pnpm run deploy:production

# Deploy Workers
cd workers
wrangler deploy --env production

# Verify deployments
curl -I https://abyrith.com
# Should return: HTTP/2 200
```

**Monitor deployment:**
```bash
# Watch GitHub Actions workflow
gh run watch

# Real-time logs
wrangler tail --env production
```

**Expected output:**
```
✓ Frontend deployed to Cloudflare Pages (production)
✓ Workers deployed to production environment
✓ DNS propagation complete
✓ Health checks passing
```

**Production URL:** `https://abyrith.com`

**Important notes:**
- ⚠️ Users may experience brief disruption during deployment
- ⚠️ Old Workers continue serving requests until new deployment completes
- ⚠️ CDN cache may need purging (see verification step)

**Time:** ~10-15 minutes

---

### Step 6: Purge CDN Cache (if needed)

**Purpose:** Ensure users receive latest static assets immediately

**When to purge:**
- Major UI changes
- JavaScript bundle changes
- CSS updates
- Critical bug fixes

**Commands:**
```bash
# Purge everything (use sparingly)
curl -X POST "https://api.cloudflare.com/client/v4/zones/[zone-id]/purge_cache" \
  -H "Authorization: Bearer [api-token]" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# Purge specific files (recommended)
curl -X POST "https://api.cloudflare.com/client/v4/zones/[zone-id]/purge_cache" \
  -H "Authorization: Bearer [api-token]" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://abyrith.com/main.js","https://abyrith.com/styles.css"]}'
```

**Expected output:**
```json
{
  "success": true,
  "result": {"id": "purge-id"}
}
```

**Time:** ~1 minute

---

## Verification

### Post-Procedure Checks

**1. System Health:**
```bash
# Check production health endpoint
curl https://abyrith.com/api/health
# Expected: {"status":"ok","version":"1.2.3"}

# Check frontend loads
curl -I https://abyrith.com
# Expected: HTTP/2 200

# Check Workers are responding
curl https://api.abyrith.com/v1/status
# Expected: HTTP/2 200
```

**Expected:** All health checks return 200 OK with correct version

---

**2. Functionality Tests:**

Perform critical path testing:

```bash
# Test API authentication
curl -X POST https://api.abyrith.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test-password"}'
# Expected: JWT token returned

# Test secrets API (with auth token)
curl -X GET https://api.abyrith.com/v1/secrets \
  -H "Authorization: Bearer [token]"
# Expected: List of encrypted secrets
```

**Manual testing:**
- [ ] Load homepage: `https://abyrith.com`
- [ ] Login with test account
- [ ] Create a new secret
- [ ] Retrieve and decrypt secret
- [ ] Test AI Assistant chat
- [ ] Verify audit logs created
- [ ] Test MCP integration (if available)
- [ ] Logout successfully

**Expected:** All core functionality works without errors

---

**3. Monitoring:**

- [ ] Check dashboards:
  - Cloudflare Analytics: `https://dash.cloudflare.com/[account]/analytics`
  - Supabase Dashboard: `https://app.supabase.com/project/[project-id]`
  - Sentry: `https://sentry.io/organizations/[org]/issues/`

- [ ] Verify metrics are normal:
  - Error rate: <1%
  - Response time: p95 <500ms
  - Database connections: <80% capacity

- [ ] Check error rates:
  - Sentry: No new error spikes
  - Cloudflare: HTTP 5xx errors <0.1%

- [ ] Review logs for errors:
  ```bash
  # Cloudflare Workers logs
  wrangler tail --env production --format pretty

  # Supabase logs (via Dashboard)
  # Visit: https://app.supabase.com/project/[project-id]/logs/edge-logs
  ```

**Metrics to check:**
- **Request rate:** Should match pre-deployment baseline
- **Error rate:** Should be <1% and not increasing
- **Latency p95:** Should be <500ms
- **Database CPU:** Should be <70%

---

**4. User Impact:**

- [ ] Verify users can access system (test login)
- [ ] Test key user flows:
  - Secret creation → encryption → storage
  - Secret retrieval → decryption → display
  - AI Assistant interaction
- [ ] Check no increase in support tickets
  - Review support dashboard
  - Monitor `#support` Slack channel
- [ ] Confirm no user-reported errors
  - Check Twitter/social mentions
  - Review in-app feedback (if configured)

---

### Success Criteria

**Deployment is successful when:**
- [ ] All health checks return 200 OK
- [ ] Frontend loads without JavaScript errors
- [ ] API endpoints respond correctly
- [ ] Database connections are healthy
- [ ] All verification checks pass
- [ ] No errors in logs (or only expected warnings)
- [ ] Metrics within normal range (error rate <1%, latency p95 <500ms)
- [ ] No user complaints in first 30 minutes
- [ ] Sentry shows no new critical errors
- [ ] Audit logs are being created correctly
- [ ] Version number matches release tag

**If all criteria met:** Deployment successful ✅

**If any criteria fail:** Proceed to rollback section ⚠️

---

## Rollback

### When to Rollback

**Rollback immediately if:**
- Error rate >5% for more than 2 minutes
- Critical functionality broken (login, secret retrieval, encryption)
- Database connection errors
- Zero-knowledge encryption not working correctly
- Data corruption detected
- Security vulnerability introduced
- Performance degradation >50% (p95 latency doubles)
- 30 minutes have passed without successful verification

**Consider rollback if:**
- Error rate 2-5% sustained
- Non-critical features broken
- User complaints increasing
- Unexpected behavior in production

**Do NOT rollback if:**
- Minor UI issues only
- Single user reports error (not reproducible)
- Metrics within acceptable range

---

### Rollback Procedure

#### Option 1: Rollback via GitHub (Recommended)

**Step 1: Identify previous stable version**
```bash
# List recent release tags
git tag -l --sort=-v:refname | head -5

# Identify previous production tag
PREVIOUS_VERSION="v1.2.2"  # Replace with actual previous version
```

**Time:** ~1 minute

---

**Step 2: Revert to previous release**
```bash
# Option A: Revert deployment in Cloudflare Dashboard
# 1. Go to Cloudflare Pages → Deployments
# 2. Find previous successful deployment
# 3. Click "Rollback to this deployment"

# Option B: Redeploy previous version via Git
git checkout $PREVIOUS_VERSION

# Trigger deployment
git push origin $PREVIOUS_VERSION --force-with-lease

# Or create a revert commit
git revert HEAD --no-edit
git push origin main
```

**Time:** ~5 minutes

---

**Step 3: Rollback Workers (if needed)**
```bash
# View recent Worker deployments
wrangler deployments list --env production

# Rollback to previous deployment
wrangler rollback --env production --deployment-id [previous-deployment-id]
```

**Expected output:**
```
✓ Rolled back to deployment: [deployment-id]
✓ Workers serving previous version
```

**Time:** ~2 minutes

---

**Step 4: Rollback Database Migrations (if needed)**

⚠️ **CRITICAL:** Only rollback migrations if they cause issues and are reversible

```bash
# View applied migrations
supabase migration list --linked --env production

# Create rollback migration (manual process)
# 1. Create new migration file that reverses changes
supabase migration new rollback_[feature_name]

# 2. Write SQL to undo the changes
# Example:
# DROP TABLE IF EXISTS new_table;
# ALTER TABLE existing_table DROP COLUMN new_column;

# 3. Apply rollback migration
supabase db push --linked --env production
```

**Important:**
- ⚠️ Database rollbacks are risky
- ⚠️ May cause data loss if not carefully planned
- ⚠️ Consult with database engineer before rolling back migrations
- ⚠️ Ensure no data was written to new schema

**Time:** ~5-10 minutes (varies with migration complexity)

---

#### Option 2: Emergency Rollback (Manual)

**Use only if automated rollback fails**

```bash
# 1. Stop current deployment
# Via Cloudflare Dashboard: Pause deployments

# 2. Deploy known-good version
git checkout [known-good-commit]
pnpm install
pnpm run build
pnpm run deploy:production

# 3. Deploy known-good Workers
cd workers
git checkout [known-good-commit]
wrangler deploy --env production

# 4. Verify rollback
curl https://abyrith.com/api/health
```

**Time:** ~10 minutes

---

### Verify Rollback

**Post-rollback checks:**
```bash
# 1. Verify correct version deployed
curl https://abyrith.com/api/health
# Should return previous version number

# 2. Check error rates
# Visit Cloudflare Analytics
# Error rate should decrease to <1%

# 3. Test critical functionality
# Login, create secret, retrieve secret
```

**Expected:** System restored to previous stable state

---

### Notify After Rollback

- [ ] Update team in `#deployments` Slack channel
  - Template: "⚠️ Rolled back production deployment due to [reason]. System restored to version [previous-version]. Investigating issue."

- [ ] Update GitHub deployment issue
  - Mark deployment as failed
  - Document reason for rollback
  - Link to error logs/metrics

- [ ] Update status page (if customer-facing)
  - Template: "We experienced issues with a recent deployment and have rolled back to a stable version. Service is now restored."

- [ ] Create post-mortem issue
  - Template: Use `.github/ISSUE_TEMPLATE/postmortem.md`
  - Schedule post-mortem meeting within 48 hours

---

### Post-Rollback Actions

**After rollback:**
1. **Investigate root cause**
   - Review error logs (Sentry, Cloudflare, Supabase)
   - Identify what caused the failure
   - Document findings in post-mortem issue

2. **Update runbook if needed**
   - Add new failure scenario
   - Update verification steps
   - Improve pre-deployment checks

3. **Plan retry with fixes**
   - Fix identified issues in staging
   - Add tests to prevent regression
   - Schedule new deployment window

4. **Schedule post-mortem (if major incident)**
   - Invite: Engineering team, DevOps, Product
   - Agenda: Timeline, root cause, action items
   - Document: Lessons learned, preventive measures

---

## Troubleshooting

### Issue 1: Build Fails in Production

**Symptoms:**
```
Error: Build failed with exit code 1
Module not found: Error: Can't resolve '[package]'
```

**Cause:** Dependency not installed or build environment mismatch

**Solution:**
```bash
# 1. Verify package.json includes the dependency
cat package.json | grep [package]

# 2. Clear node_modules and reinstall
rm -rf node_modules
pnpm install

# 3. Rebuild locally
pnpm run build

# 4. If successful locally, clear GitHub Actions cache
# Via GitHub → Actions → Caches → Delete all caches

# 5. Retry deployment
git commit --allow-empty -m "Retry deployment"
git push origin main
```

**If solution doesn't work:**
- Check Node.js version matches production (20.x)
- Review build logs for specific error
- Contact Engineering Lead

---

### Issue 2: Database Migration Fails

**Symptoms:**
```
Error: Migration failed: relation "table_name" already exists
Error: Migration failed: column "column_name" does not exist
```

**Cause:** Migration script has errors or was partially applied

**Solution:**
```bash
# 1. Check current database state
supabase db diff --schema public --linked --env production

# 2. Manually verify the state
# Via Supabase Dashboard → Database → Table Editor

# 3. If table/column exists, migration already applied
# Skip migration or create corrected migration

# 4. If partially applied, create cleanup migration
supabase migration new fix_partial_migration
# Write SQL to clean up partial state

# 5. Apply corrected migration
supabase db push --linked --env production
```

**If solution doesn't work:**
- **DO NOT force-apply migrations**
- Contact Database Engineer
- Consider manual schema fixes via SQL console
- Document exact error for post-mortem

---

### Issue 3: Workers Not Responding

**Symptoms:**
```
HTTP 502 Bad Gateway
HTTP 503 Service Unavailable
Workers returning old version
```

**Cause:** Worker deployment incomplete or serving old code

**Solution:**
```bash
# 1. Check Worker deployment status
wrangler deployments list --env production

# 2. Verify latest deployment
wrangler whoami
wrangler tail --env production --format pretty

# 3. Redeploy Workers
cd workers
wrangler deploy --env production --force

# 4. Verify deployment
curl https://api.abyrith.com/v1/status
```

**If solution doesn't work:**
- Check Cloudflare status page: https://www.cloudflarestatus.com/
- Verify Workers KV is accessible
- Check environment variables are set correctly
- Escalate to Cloudflare support

---

### Issue 4: CDN Serving Stale Content

**Symptoms:**
```
Frontend shows old version
CSS/JS files not updated
Users see cached UI
```

**Cause:** CDN cache not purged after deployment

**Solution:**
```bash
# 1. Purge CDN cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/[zone-id]/purge_cache" \
  -H "Authorization: Bearer [api-token]" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 2. Verify cache purged
curl -I https://abyrith.com/main.js
# Check headers: cf-cache-status should be MISS (not HIT)

# 3. Hard refresh browser
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# 4. If still stale, check Cloudflare cache settings
# Cloudflare Dashboard → Caching → Configuration
```

**If solution doesn't work:**
- Wait 5-10 minutes for global CDN purge
- Verify cache rules in Cloudflare Dashboard
- Check Page Rules for caching overrides
- Contact Cloudflare support

---

### Issue 5: Authentication Errors

**Symptoms:**
```
HTTP 401 Unauthorized
JWT token invalid
Users unable to login
```

**Cause:** JWT secret mismatch or Supabase Auth misconfiguration

**Solution:**
```bash
# 1. Verify Supabase Auth is running
# Visit: https://app.supabase.com/project/[project-id]/auth/users

# 2. Check environment variables
# Via Cloudflare Pages → Settings → Environment Variables
# Verify: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Test auth endpoint
curl -X POST https://api.abyrith.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test-password"}'

# 4. If JWT secret changed, redeploy with correct secret
# Update environment variable in Cloudflare Dashboard
# Redeploy frontend and Workers
```

**If solution doesn't work:**
- Verify Supabase project is not paused
- Check API rate limits not exceeded
- Review Supabase Auth logs
- Contact Supabase support

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| Primary - DevOps Lead | [Name] | Slack: @devops-lead, PagerDuty | Immediate |
| Backup - Engineering Manager | [Name] | Slack: @eng-manager, Phone: [number] | If primary unavailable (15 min) |
| Escalation - CTO/Eng Director | [Name] | Slack: @cto, Phone: [number] | After 30 minutes |
| Cloudflare Support | N/A | Enterprise Support Portal | If platform issue |
| Supabase Support | N/A | Dashboard → Support | If database issue |

**Emergency escalation:**
1. Post in `#incidents` Slack channel
2. Page on-call engineer via PagerDuty
3. If critical (all users affected), escalate to CTO immediately

---

## Post-Procedure

### Cleanup

**After successful deployment:**
```bash
# 1. Clean up local Git tags (if any temporary tags created)
git tag -d prod-backup-*

# 2. Archive deployment artifacts (if any)
# Move logs to archive folder

# 3. Update version in documentation
# Update CHANGELOG.md with release notes

# 4. Close GitHub deployment issue
gh issue close [issue-number] --comment "Deployment successful"
```

### Documentation

**Update these documents:**
- [ ] `CHANGELOG.md` - Add release notes (if not already added)
- [ ] This runbook (if issues/improvements identified)
  - Add new troubleshooting scenarios
  - Update verification steps
  - Improve deployment procedure
- [ ] Deployment tracking spreadsheet/dashboard
  - Record: Date, version, duration, issues encountered

### Communication

**Notify:**
- [ ] Team in `#deployments` Slack channel:
  ```
  ✅ Production deployment complete

  Version: v1.2.3
  Duration: 32 minutes
  Status: Success
  Issues: None

  Release notes: https://github.com/[org]/[repo]/releases/tag/v1.2.3
  ```

- [ ] Update status page (if customer-facing):
  - Template: "Deployment completed successfully. All systems operational."

- [ ] Close deployment issue in GitHub:
  - Add deployment summary
  - Link to release notes
  - Note any issues encountered and resolutions

- [ ] Send summary to stakeholders (if major release):
  - Email to: Product, Customer Support, Sales (if customer-facing)
  - Include: What was deployed, benefits to users, known issues

### Monitoring

**Increased monitoring period:**
- Monitor for **24-48 hours** after deployment
- Watch for:
  - Error rate spikes (should stay <1%)
  - Performance degradation (latency should be <500ms p95)
  - User complaints in support channels
  - Database performance (CPU <70%, connections <80%)
  - Memory usage in Workers (should be stable)

**Set up temporary alerts (if applicable):**
```bash
# Example: Lower error threshold for 24 hours
# Via Sentry: Settings → Alerts → Create Alert
# Condition: Error rate >0.5% (instead of usual 1%)
# Duration: 24 hours
```

**Daily check for 3 days:**
- Review Sentry for new error patterns
- Check Cloudflare Analytics for anomalies
- Review Supabase metrics for database health
- Monitor support tickets for deployment-related issues

---

## Communication

### Communication Templates

**Pre-Procedure Announcement:**
```
📢 Production Deployment Scheduled

When: [Date/Time] ([Timezone])
Duration: ~30-45 minutes
Impact: Brief service disruption possible during deployment
Purpose: Release v[X.Y.Z] - [Brief description of changes]

Release notes: https://github.com/[org]/[repo]/releases/tag/v[X.Y.Z]
Updates: #deployments channel
Status: https://status.abyrith.com
```

---

**During Procedure:**
```
🔧 Production deployment in progress

Status: [Current step - e.g., "Deploying frontend to Cloudflare Pages"]
Progress: ~60% complete
ETA: 15 minutes

Current metrics:
• Error rate: 0.3% ✅
• Response time: 320ms ✅
• Active deployments: Workers deployed ✅, Frontend deploying 🔄

Everything proceeding as expected.
```

---

**Completion:**
```
✅ Production Deployment Complete

Completed: [Time] ([Timezone])
Duration: 32 minutes
Status: Success ✅

Deployed: Release v1.2.3
Changes:
• [Feature/fix 1]
• [Feature/fix 2]
• [Feature/fix 3]

Metrics:
• Error rate: 0.2% (normal) ✅
• Response time: 285ms (normal) ✅
• All health checks: Passing ✅

All systems operational. Monitoring for next 24 hours.

Release notes: https://github.com/[org]/[repo]/releases/tag/v1.2.3
```

---

**Rollback Announcement:**
```
⚠️ Production Deployment Rolled Back

Rollback completed: [Time] ([Timezone])
Reason: [Brief explanation - e.g., "High error rate detected in production"]
Impact: Service temporarily degraded, now restored

Details:
• Attempted deployment: v1.2.3
• Rolled back to: v1.2.2
• Issue detected: Error rate increased to 5.2%
• Time to rollback: 12 minutes

System restored to previous stable state. All systems operational.

Investigation: Post-mortem scheduled for [date/time]
Post-mortem doc: [Link to issue]

We apologize for any inconvenience.
```

---

## Dependencies

### Technical Dependencies

**Must exist before procedure:**
- [ ] `10-operations/deployment/deployment-pipeline.md` - CI/CD pipeline configuration
- [ ] `02-architecture/system-overview.md` - System architecture understanding
- [ ] `TECH-STACK.md` - Technology stack specification
- [ ] `04-database/database-overview.md` - Database architecture
- [ ] GitHub Actions workflows configured
- [ ] Cloudflare Pages project set up
- [ ] Cloudflare Workers deployed to staging
- [ ] Supabase projects (staging and production) provisioned
- [ ] Environment variables configured in Cloudflare Dashboard
- [ ] DNS configured and pointing to Cloudflare

**Systems involved:**
- **GitHub** - Source code repository and CI/CD
- **Cloudflare Pages** - Frontend hosting
- **Cloudflare Workers** - Serverless backend functions
- **Supabase** - Database and authentication
- **Sentry** - Error tracking (optional)

### Team Dependencies

**Requires coordination with:**
- **Engineering Team** - Code review and approval before deployment
- **DevOps Team** - Infrastructure readiness and deployment execution
- **Product Team** - Release notes and feature communication
- **Customer Support** - Awareness of changes and potential user impact

---

## References

### Internal Documentation

- `10-operations/deployment/deployment-pipeline.md` - CI/CD pipeline details
- `10-operations/monitoring/monitoring-alerting.md` - Monitoring and alerting setup
- `10-operations/incident-response.md` - Incident response procedures
- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - Technology stack
- `04-database/database-overview.md` - Database architecture
- `03-security/security-model.md` - Security architecture
- `CHANGELOG.md` - Platform changelog
- `GLOSSARY.md` - Term definitions

### External Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/) - Deployment reference
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/) - Workers deployment
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/) - CLI reference
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli) - Database migrations
- [GitHub Actions Documentation](https://docs.github.com/en/actions) - CI/CD workflows
- [Cloudflare Status Page](https://www.cloudflarestatus.com/) - Service status
- [Supabase Status Page](https://status.supabase.com/) - Service status

### Incident History

**Previous incidents related to this procedure:**
- *No incidents recorded yet* - This is the first version of the runbook

*(Update this section after each deployment incident with learnings)*

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | DevOps Team | Initial deployment runbook creation |

---

## Notes

### Improvements Needed

- [ ] Automate more verification steps (add to CI/CD)
- [ ] Create automated rollback script
- [ ] Add smoke tests to run post-deployment
- [ ] Integrate deployment notifications with status page
- [ ] Create deployment dashboard for real-time monitoring
- [ ] Add automated database backup verification
- [ ] Implement blue-green deployment strategy (future)

### Lessons Learned

*(Update after each deployment with lessons learned)*

- TBD - First deployment not yet completed

### Next Review Date

**Review this runbook:** 2025-12-30 (or after first production deployment, whichever comes first)

**Review triggers:**
- After each production deployment incident
- Quarterly (every 3 months)
- When deployment process changes significantly
- When new infrastructure is added

---

## Emergency Hotfix Process

### When to Use Hotfix Process

**Use hotfix process for:**
- Critical security vulnerabilities (immediate threat to user data)
- Data loss or corruption issues
- Zero-knowledge encryption failures (secrets exposed)
- Authentication system down (all users locked out)
- Payment processing failures (if applicable)
- Legal/compliance violations detected

**Do NOT use hotfix process for:**
- Non-critical bugs (use regular deployment)
- Feature requests (use regular deployment)
- Performance optimizations (use regular deployment)
- UI/UX improvements (use regular deployment)

---

### Hotfix Procedure (Fast-Track)

**Time limit:** Complete within 2 hours of detection

**Step 1: Declare Emergency (5 min)**
```bash
# 1. Post in #incidents Slack channel
Template: "🚨 CRITICAL: [Brief description]. Initiating emergency hotfix procedure."

# 2. Page on-call engineer
# Via PagerDuty

# 3. Create incident issue in GitHub
gh issue create --title "CRITICAL: [Issue]" --label "incident,hotfix" --assignee @on-call
```

**Step 2: Create Hotfix Branch (5 min)**
```bash
# 1. Branch from current production
git checkout main
git pull origin main

# 2. Create hotfix branch
git checkout -b hotfix/[issue-description]

# 3. Make minimal fix (code only what's needed)
# Edit files...

# 4. Test locally
pnpm run test
pnpm run build
```

**Step 3: Deploy to Staging (10 min)**
```bash
# 1. Push hotfix branch
git push origin hotfix/[issue-description]

# 2. Deploy to staging
# Via CI/CD or manual:
pnpm run deploy:staging

# 3. Quick verification in staging
# Test ONLY the critical fix
```

**Step 4: Emergency Production Deploy (15 min)**
```bash
# 1. Create PR (skip normal review for critical issues)
gh pr create --title "HOTFIX: [Issue]" --body "Critical fix for [issue]. Details: [link to incident]"

# 2. Get emergency approval (1 reviewer minimum)
# Tag: @devops-lead or @eng-manager

# 3. Merge PR
gh pr merge --squash

# 4. Deploy to production
# Via CI/CD or manual:
pnpm run deploy:production

# 5. Monitor closely
wrangler tail --env production --format pretty
```

**Step 5: Verify Fix (10 min)**
```bash
# 1. Test critical functionality
curl https://abyrith.com/api/health

# 2. Verify issue resolved
# Test the specific issue that was fixed

# 3. Monitor error rates
# Sentry, Cloudflare Analytics

# 4. Get user confirmation (if possible)
# Check support tickets, user reports
```

**Step 6: Post-Hotfix Communication (5 min)**
```bash
# 1. Update #incidents channel
Template: "✅ Hotfix deployed. Issue resolved. Monitoring for 2 hours."

# 2. Update incident issue
gh issue comment [issue-number] --body "Hotfix deployed: v[X.Y.Z]. Monitoring."

# 3. Notify stakeholders
# Customer support, product team, affected users (if applicable)
```

**Total time:** ~50 minutes (within 2-hour target)

---

### Post-Hotfix Actions

**Within 24 hours:**
- [ ] Create proper fix in main branch (if hotfix was a temporary workaround)
- [ ] Write post-mortem document
- [ ] Schedule post-mortem meeting
- [ ] Update monitoring/alerts to prevent recurrence
- [ ] Communicate incident summary to team

**Within 1 week:**
- [ ] Conduct post-mortem review
- [ ] Implement preventive measures
- [ ] Update runbooks based on learnings
- [ ] Add tests to prevent regression

---

**Remember:** Hotfixes skip normal review processes. Use only for genuine emergencies. Most issues should go through standard deployment procedure.

---

**END OF RUNBOOK**
