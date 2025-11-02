---
Document: Deployment Pipeline and CI/CD - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: DevOps Team
Status: Draft
Dependencies: 06-backend/cloudflare-workers/workers-architecture.md, TECH-STACK.md, 02-architecture/system-overview.md
---

# Deployment Pipeline and CI/CD Operations Runbook

## Overview

This runbook defines the complete CI/CD pipeline, deployment procedures, and operational practices for the Abyrith platform. It covers GitHub Actions workflows, environment management, deployment gates, rollback procedures, and environment variable handling across development, staging, and production environments.

**Purpose:** Provide step-by-step procedures for deploying Abyrith safely and reliably using automated CI/CD pipelines with appropriate safety gates and rollback capabilities.

**Frequency:** Continuous deployments to staging, manual approval for production

**Estimated Time:**
- Staging deployment: ~5 minutes (automated)
- Production deployment: ~8 minutes (with approval)
- Rollback: ~2 minutes

**Risk Level:** High (production changes affect all users)

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [CI/CD Architecture](#cicd-architecture)
5. [GitHub Actions Workflows](#github-actions-workflows)
6. [Environment Configuration](#environment-configuration)
7. [Deployment Procedure](#deployment-procedure)
8. [Verification](#verification)
9. [Rollback](#rollback)
10. [Database Migrations](#database-migrations)
11. [Troubleshooting](#troubleshooting)
12. [Post-Deployment](#post-deployment)
13. [Communication](#communication)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Deploying new features or bug fixes to staging
- Deploying approved changes to production
- Rolling back a problematic deployment
- Running database migrations
- Updating environment variables or secrets
- Troubleshooting deployment failures

**Do NOT use this runbook when:**
- Making local development changes (use `11-development/local-setup.md`)
- Testing features locally (no deployment needed)
- Reviewing code (use PR review process)

### Scope

**What this covers:**
- GitHub Actions CI/CD workflows
- Staging and production deployment processes
- Environment variable management
- Cloudflare Pages and Workers deployment
- Supabase project configuration
- Database migration procedures
- Rollback and recovery procedures
- Deployment verification and monitoring

**What this does NOT cover:**
- Local development setup (see `11-development/local-setup.md`)
- Infrastructure provisioning (Cloudflare/Supabase initial setup)
- DNS configuration (see `10-operations/deployment/dns-setup.md`)
- Security incident response (see `10-operations/security/security-runbook.md`)

---

## Prerequisites

### Required Access

**Systems:**
- [ ] GitHub repository - Write access (for merging PRs)
- [ ] GitHub Actions - Admin access (for managing secrets)
- [ ] Cloudflare account - Admin access (for Pages and Workers)
- [ ] Supabase dashboard - Admin access (staging and production projects)
- [ ] Sentry (optional) - Admin access (error tracking)

**Credentials:**
- [ ] GitHub personal access token (for workflow triggers)
- [ ] Cloudflare API token (stored in GitHub Secrets)
- [ ] Supabase service role keys (stored in GitHub Secrets)
- [ ] Claude API key (stored in GitHub Secrets)
- [ ] FireCrawl API key (stored in GitHub Secrets)

**How to request access:**
Contact DevOps team lead or repository admin. For production access, security review may be required.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
git --version          # Should be 2.40 or higher
node --version         # Should be 20.x LTS
pnpm --version         # Should be 8.x
wrangler --version     # Should be latest (for Workers)
supabase --version     # Should be latest (for migrations)
```

**Installation:**
```bash
# If tools are missing
npm install -g pnpm
npm install -g wrangler
brew install supabase/tap/supabase
```

### Required Knowledge

**You should understand:**
- Git branching and merging strategies
- GitHub Actions workflow syntax
- Cloudflare Workers and Pages architecture
- Supabase database migrations
- Environment variable management
- Zero-downtime deployment principles

**Reference documentation:**
- `TECH-STACK.md` - Complete technology specifications
- `06-backend/cloudflare-workers/workers-architecture.md` - Workers deployment
- `CLAUDE.md` - Repository workflow guidance

---

## Pre-Flight Checklist

**Complete before starting deployment:**

### 1. Communication

- [ ] Notify team in `#deployments` Slack channel
- [ ] Create deployment ticket in issue tracker
- [ ] Update status page if customer-facing change (production only)

**Template message:**
```
🚀 Deployment Starting
Environment: [Staging | Production]
Branch: [branch-name]
Changes: [Brief description]
Deployer: @[your-name]
ETA: ~[X] minutes
```

### 2. Code Review

- [ ] All PRs merged to target branch (`develop` for staging, `main` for production)
- [ ] All CI checks passed (tests, lint, build)
- [ ] Code review approved by at least 1 reviewer
- [ ] No merge conflicts
- [ ] All required approvals obtained (production requires 2 approvals)

### 3. Testing

- [ ] Unit tests passing locally
- [ ] Integration tests passing in CI
- [ ] E2E tests passing in CI
- [ ] Manual testing completed for major features
- [ ] Staging validation completed (for production deployments)

### 4. Database

- [ ] Database migrations prepared (if applicable)
- [ ] Migration tested in local environment
- [ ] Migration backward-compatible (can rollback)
- [ ] Database backup verified (automatic daily backups)

### 5. Environment Variables

- [ ] New secrets added to GitHub Secrets (if needed)
- [ ] Cloudflare Workers secrets updated (if needed)
- [ ] Environment-specific configuration verified

### 6. Dependencies

- [ ] No blocking issues in issue tracker
- [ ] Dependent services healthy (Supabase, Cloudflare, Claude API)
- [ ] No ongoing incidents affecting deployment

---

## CI/CD Architecture

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Workflow                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ git push
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │           PR Validation Workflow                    │ │
│  │  • Checkout code                                   │ │
│  │  • Install dependencies (pnpm)                     │ │
│  │  • Run linting (ESLint, Prettier)                 │ │
│  │  • Type checking (TypeScript)                     │ │
│  │  • Run unit tests (Vitest)                        │ │
│  │  • Run integration tests                          │ │
│  │  • Build frontend (Next.js)                       │ │
│  │  • Security scan (npm audit, Dependabot)         │ │
│  │  • Bundle size check                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│         ↓ (on merge to develop)                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Staging Deployment Workflow                 │ │
│  │  • Run full test suite                             │ │
│  │  • Build production bundle                         │ │
│  │  • Run database migrations (staging)              │ │
│  │  • Deploy to Cloudflare Pages (staging)           │ │
│  │  • Deploy Workers (staging)                       │ │
│  │  • Run E2E smoke tests                            │ │
│  │  • Update Supabase config (staging)               │ │
│  │  • Post-deployment verification                   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│         ↓ (on merge to main)                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │       Production Deployment Workflow                │ │
│  │  • Wait for manual approval (required)             │ │
│  │  • Run full test suite                             │ │
│  │  • Build production bundle                         │ │
│  │  • Run database migrations (production)           │ │
│  │  • Deploy to Cloudflare Pages (production)        │ │
│  │  • Deploy Workers (production)                    │ │
│  │  • Run E2E smoke tests                            │ │
│  │  • Update Supabase config (production)            │ │
│  │  • Post-deployment verification                   │ │
│  │  • Send success notification                      │ │
│  │  • Create release tag                             │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Branch Strategy

**Branches:**
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature branches
- `hotfix/*` - Emergency fixes for production

**Flow:**
1. Feature work: `feature/xxx` → `develop` (via PR)
2. Staging deployment: `develop` (automatic on merge)
3. Production deployment: `develop` → `main` (via PR, manual approval required)
4. Hotfixes: `hotfix/xxx` → `main` (expedited review, immediate deploy)

### Deployment Gates

**Staging Deployment Gates:**
- ✅ All tests pass (unit, integration, E2E)
- ✅ Code linting passes
- ✅ TypeScript type checking passes
- ✅ Build succeeds
- ✅ Security scan passes (no critical vulnerabilities)

**Production Deployment Gates:**
- ✅ All staging gates pass
- ✅ Staging deployment successful
- ✅ Manual testing in staging completed
- ✅ **Manual approval from 2 team members required**
- ✅ Database migrations backward-compatible
- ✅ No ongoing incidents (P0, P1)
- ✅ Deployment window approved (avoid peak hours for major changes)

---

## GitHub Actions Workflows

### Workflow 1: PR Validation (`.github/workflows/pr-validation.yml`)

**Trigger:** On pull request to `develop` or `main`

**Purpose:** Ensure code quality and prevent broken code from being merged

**Steps:**

```yaml
name: PR Validation

on:
  pull_request:
    branches: [develop, main]

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linting
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Run unit tests
        run: pnpm test:unit --coverage

      - name: Run integration tests
        run: pnpm test:integration

      - name: Build frontend
        run: pnpm build

      - name: Security audit
        run: pnpm audit --audit-level=high

      - name: Bundle size check
        run: pnpm bundlesize

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

**Success Criteria:**
- All steps complete successfully
- Test coverage > 70% for critical paths
- No critical security vulnerabilities
- Bundle size within limits

---

### Workflow 2: Staging Deployment (`.github/workflows/deploy-staging.yml`)

**Trigger:** On push to `develop` branch

**Purpose:** Automatically deploy changes to staging for testing

**Steps:**

```yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run full test suite
        run: pnpm test:ci

      - name: Build production bundle
        run: pnpm build
        env:
          NODE_ENV: production
          NEXT_PUBLIC_ENVIRONMENT: staging

      - name: Run database migrations
        run: pnpm supabase:migrate
        env:
          SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: abyrith-staging
          directory: .next
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy Cloudflare Workers
        run: pnpm wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          ENVIRONMENT: staging

      - name: Update Worker secrets
        run: |
          # ZERO-KNOWLEDGE ARCHITECTURE NOTE:
          # User master encryption keys are derived from passwords using PBKDF2
          # and exist ONLY in the user's browser. The server has NO access to
          # master keys and CANNOT decrypt user secrets.
          echo "${{ secrets.STAGING_SUPABASE_URL }}" | wrangler secret put SUPABASE_URL
          echo "${{ secrets.STAGING_SUPABASE_ANON_KEY }}" | wrangler secret put SUPABASE_ANON_KEY
          echo "${{ secrets.STAGING_CLAUDE_API_KEY }}" | wrangler secret put CLAUDE_API_KEY
          echo "${{ secrets.STAGING_FIRECRAWL_API_KEY }}" | wrangler secret put FIRECRAWL_API_KEY

      - name: Run E2E smoke tests
        run: pnpm test:e2e:smoke
        env:
          BASE_URL: https://staging.abyrith.com

      - name: Post-deployment verification
        run: pnpm verify:deployment
        env:
          ENVIRONMENT: staging

      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Staging Deployment ${{ job.status }}",
              "environment": "staging",
              "commit": "${{ github.sha }}",
              "actor": "${{ github.actor }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Success Criteria:**
- All tests pass
- Build succeeds
- Database migrations apply successfully
- Frontend deploys to Cloudflare Pages
- Workers deploy successfully
- Smoke tests pass
- Verification checks pass

---

### Workflow 3: Production Deployment (`.github/workflows/deploy-production.yml`)

**Trigger:** On push to `main` branch (after PR merge)

**Purpose:** Deploy approved changes to production with safety gates

**Steps:**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment:
      name: production
      url: https://abyrith.com

    steps:
      - name: Wait for manual approval
        uses: trstringer/manual-approval@v1
        with:
          secret: ${{ secrets.GITHUB_TOKEN }}
          approvers: eng-lead,devops-lead
          minimum-approvals: 2
          issue-title: "Production Deployment Approval Required"

      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run full test suite
        run: pnpm test:ci

      - name: Build production bundle
        run: pnpm build
        env:
          NODE_ENV: production
          NEXT_PUBLIC_ENVIRONMENT: production

      - name: Verify database migrations
        run: pnpm supabase:migrate:check
        env:
          SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PROD_SUPABASE_SERVICE_KEY }}

      - name: Run database migrations
        run: pnpm supabase:migrate
        env:
          SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PROD_SUPABASE_SERVICE_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: abyrith-production
          directory: .next
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy Cloudflare Workers
        run: pnpm wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Update Worker secrets
        run: |
          # ZERO-KNOWLEDGE ARCHITECTURE NOTE:
          # User master encryption keys are derived from passwords using PBKDF2
          # and exist ONLY in the user's browser. The server has NO access to
          # master keys and CANNOT decrypt user secrets.
          echo "${{ secrets.PROD_SUPABASE_URL }}" | wrangler secret put SUPABASE_URL --env production
          echo "${{ secrets.PROD_SUPABASE_ANON_KEY }}" | wrangler secret put SUPABASE_ANON_KEY --env production
          echo "${{ secrets.PROD_CLAUDE_API_KEY }}" | wrangler secret put CLAUDE_API_KEY --env production
          echo "${{ secrets.PROD_FIRECRAWL_API_KEY }}" | wrangler secret put FIRECRAWL_API_KEY --env production

      - name: Run E2E smoke tests
        run: pnpm test:e2e:smoke
        env:
          BASE_URL: https://abyrith.com

      - name: Post-deployment verification
        run: pnpm verify:deployment
        env:
          ENVIRONMENT: production

      - name: Create release tag
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          VERSION=$(node -p "require('./package.json').version")
          git tag -a "v${VERSION}" -m "Release v${VERSION}"
          git push origin "v${VERSION}"

      - name: Notify Slack - Success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ Production Deployment Successful",
              "environment": "production",
              "commit": "${{ github.sha }}",
              "actor": "${{ github.actor }}",
              "version": "${{ steps.version.outputs.version }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify Slack - Failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "❌ Production Deployment Failed",
              "environment": "production",
              "commit": "${{ github.sha }}",
              "actor": "${{ github.actor }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Success Criteria:**
- Manual approval obtained (2 approvers)
- All tests pass
- Database migrations succeed
- Frontend deploys successfully
- Workers deploy successfully
- Smoke tests pass
- Verification checks pass
- Release tag created

---

## Environment Configuration

### Environment Matrix

| Environment | Purpose | Branch | URL | Supabase Project | Auto-Deploy |
|-------------|---------|--------|-----|------------------|-------------|
| **Development** | Local development | any | localhost:3000 | Local (via Supabase CLI) | No |
| **Staging** | Pre-production testing | `develop` | staging.abyrith.com | staging-project | Yes |
| **Production** | Live user-facing | `main` | abyrith.com | production-project | Manual approval |

### Environment Variables by Environment

**Development (`.env.local`):**
```bash
# Public variables (committed to .env.example)
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>

# Private variables (never committed)
SUPABASE_SERVICE_ROLE_KEY=<local-service-key>
CLAUDE_API_KEY=<dev-claude-key>
FIRECRAWL_API_KEY=<dev-firecrawl-key>

# NOTE: NO MASTER_ENCRYPTION_KEY - User master keys are derived from
# passwords using PBKDF2 in the browser and never leave the client
```

**Staging (GitHub Secrets + Cloudflare):**
```bash
# Stored in GitHub Secrets (prefixed with STAGING_)
STAGING_SUPABASE_URL=https://xyz-staging.supabase.co
STAGING_SUPABASE_ANON_KEY=<staging-anon-key>
STAGING_SUPABASE_SERVICE_KEY=<staging-service-key>
STAGING_CLAUDE_API_KEY=<staging-claude-api-key>
STAGING_FIRECRAWL_API_KEY=<staging-firecrawl-key>

# Stored in Cloudflare Workers Secrets (via wrangler)
SUPABASE_URL=<from-github-secrets>
SUPABASE_ANON_KEY=<from-github-secrets>
CLAUDE_API_KEY=<from-github-secrets>
FIRECRAWL_API_KEY=<from-github-secrets>

# NOTE: NO MASTER_ENCRYPTION_KEY - Zero-knowledge architecture means
# user master keys never leave the browser
```

**Production (GitHub Secrets + Cloudflare):**
```bash
# Stored in GitHub Secrets (prefixed with PROD_)
PROD_SUPABASE_URL=https://xyz-production.supabase.co
PROD_SUPABASE_ANON_KEY=<prod-anon-key>
PROD_SUPABASE_SERVICE_KEY=<prod-service-key>
PROD_CLAUDE_API_KEY=<prod-claude-api-key>
PROD_FIRECRAWL_API_KEY=<prod-firecrawl-key>

# Stored in Cloudflare Workers Secrets
SUPABASE_URL=<from-github-secrets>
SUPABASE_ANON_KEY=<from-github-secrets>
CLAUDE_API_KEY=<from-github-secrets>
FIRECRAWL_API_KEY=<from-github-secrets>

# NOTE: NO MASTER_ENCRYPTION_KEY - Zero-knowledge architecture means
# user master keys never leave the browser
```

### Managing Secrets

**Adding a new secret to GitHub:**
```bash
# Navigate to repository settings
# Settings → Secrets and variables → Actions → New repository secret

# Add with appropriate prefix:
STAGING_NEW_SECRET=value
PROD_NEW_SECRET=value
```

**Adding a secret to Cloudflare Workers:**
```bash
# Staging
echo "secret-value" | wrangler secret put SECRET_NAME --env staging

# Production
echo "secret-value" | wrangler secret put SECRET_NAME --env production

# List secrets (values hidden)
wrangler secret list --env production
```

**Rotating secrets:**
1. Generate new secret value
2. Update in GitHub Secrets
3. Trigger re-deployment (secrets automatically updated in Workers)
4. Verify new secret works
5. Invalidate old secret

---

## Deployment Procedure

### Step 1: Prepare Code for Deployment

**Purpose:** Ensure code is ready for staging deployment

**Commands:**
```bash
# 1. Ensure you're on develop branch
git checkout develop
git pull origin develop

# 2. Merge feature branch (if deploying feature)
git merge feature/your-feature-name

# 3. Resolve any conflicts
# (Use editor to resolve, then commit)

# 4. Run local verification
pnpm install
pnpm lint
pnpm type-check
pnpm test
pnpm build

# 5. Push to develop
git push origin develop
```

**Expected output:**
```
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Writing objects: 100% (3/3), 320 bytes | 320.00 KiB/s, done.
Total 3 (delta 0), reused 0 (delta 0), pack-reused 0
To github.com:abyrith/platform.git
   abc123..def456  develop -> develop
```

**If something goes wrong:**
- Merge conflicts → Resolve manually, commit, push
- Test failures → Fix tests before pushing
- Build failures → Fix build errors before pushing

**Time:** ~5 minutes

---

### Step 2: Monitor Staging Deployment

**Purpose:** Watch GitHub Actions deploy to staging automatically

**Steps:**

1. **Navigate to GitHub Actions:**
   - Go to https://github.com/abyrith/platform/actions
   - Find "Deploy to Staging" workflow run
   - Click to view details

2. **Monitor progress:**
   - Watch each step complete
   - Check for any failures
   - Review logs if errors occur

3. **Wait for completion:**
   - Total time: ~5-10 minutes
   - Green checkmark = success
   - Red X = failure (investigate logs)

**Expected output:**
```
✅ Checkout code
✅ Setup Node.js
✅ Install dependencies
✅ Run full test suite
✅ Build production bundle
✅ Run database migrations
✅ Deploy to Cloudflare Pages
✅ Deploy Cloudflare Workers
✅ Run E2E smoke tests
✅ Post-deployment verification
```

**If deployment fails:**
- Check workflow logs for error message
- Common issues:
  - Test failures → Fix tests, push again
  - Build errors → Fix build, push again
  - Migration errors → Review migration, rollback if needed
  - Cloudflare errors → Check API token, retry

**Time:** ~10 minutes (mostly automated)

---

### Step 3: Test in Staging

**Purpose:** Manually verify changes work correctly in staging

**Testing checklist:**

- [ ] Open https://staging.abyrith.com
- [ ] Verify page loads correctly
- [ ] Test authentication flow (login/logout)
- [ ] Test key features affected by changes
- [ ] Check browser console for errors
- [ ] Test on mobile (if UI changes)
- [ ] Verify API responses are correct
- [ ] Check database data (if schema changes)

**Smoke test commands:**
```bash
# Run automated smoke tests
pnpm test:e2e:smoke --base-url=https://staging.abyrith.com

# Check API health
curl https://staging.abyrith.com/api/health

# Verify Workers are responding
curl https://api-staging.abyrith.com/health
```

**Expected:** All tests pass, no errors in console, features work as expected

**Time:** ~10-15 minutes

---

### Step 4: Create Production PR

**Purpose:** Prepare staging changes for production deployment

**Commands:**
```bash
# 1. Create PR from develop to main
git checkout develop
git pull origin develop

# 2. Create PR via GitHub CLI
gh pr create \
  --base main \
  --head develop \
  --title "Production Deployment: [Brief description]" \
  --body "$(cat <<EOF
## Changes
- [Change 1]
- [Change 2]

## Testing
- [x] Staging deployment successful
- [x] Manual testing completed in staging
- [x] E2E tests passing
- [x] Database migrations tested

## Deployment Checklist
- [ ] All tests passing
- [ ] Staging validated
- [ ] Database migrations backward-compatible
- [ ] Environment variables updated (if needed)
- [ ] Breaking changes documented (if any)

## Rollback Plan
- Cloudflare Pages: Instant rollback via dashboard
- Cloudflare Workers: `wrangler rollback`
- Database: Migration rollback scripts ready

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**PR requirements:**
- 2 approvals required (including 1 from DevOps/Eng Lead)
- All CI checks must pass
- Staging validation confirmed

**Time:** ~5 minutes to create PR

---

### Step 5: Production Deployment Approval

**Purpose:** Obtain required approvals and trigger production deployment

**Steps:**

1. **Request reviews:**
   - Tag reviewers in PR
   - Notify in #deployments Slack channel
   - Wait for 2 approvals

2. **Approval checklist for reviewers:**
   - [ ] Code changes reviewed
   - [ ] Staging testing completed
   - [ ] Database migrations safe
   - [ ] No ongoing incidents
   - [ ] Deployment window appropriate (avoid peak hours)

3. **Merge PR:**
   - Click "Merge pull request"
   - Use "Create a merge commit" option
   - Confirm merge

4. **Approve deployment:**
   - GitHub Actions will pause for manual approval
   - 2 approvers must approve via GitHub Actions UI
   - Deployment continues automatically after approval

**Communication template:**
```
🚀 Production Deployment Ready
PR: [link]
Changes: [brief summary]
Staging: ✅ Validated
Approvals needed: 2
ETA: ~10 minutes after approval
```

**Time:** Variable (depends on reviewer availability)

---

### Step 6: Monitor Production Deployment

**Purpose:** Watch production deployment and verify success

**Steps:**

1. **Navigate to GitHub Actions:**
   - Go to https://github.com/abyrith/platform/actions
   - Find "Deploy to Production" workflow run
   - Monitor each step

2. **Watch for:**
   - Database migration success
   - Cloudflare deployment success
   - Smoke tests passing
   - No errors in logs

3. **Real-time monitoring:**
   - Open https://abyrith.com in browser
   - Keep Sentry dashboard open (errors)
   - Monitor Cloudflare Analytics (traffic)
   - Watch #alerts Slack channel

**Expected output:**
```
✅ Manual approval obtained
✅ Run full test suite
✅ Build production bundle
✅ Run database migrations
✅ Deploy to Cloudflare Pages
✅ Deploy Cloudflare Workers
✅ Run E2E smoke tests
✅ Post-deployment verification
✅ Create release tag
```

**Checkpoint:** After this step, production should be updated successfully

**Time:** ~10 minutes

---

## Verification

### Post-Deployment Checks

**1. System Health:**
```bash
# Check application health endpoint
curl https://abyrith.com/api/health

# Expected response:
# {
#   "status": "healthy",
#   "version": "1.2.3",
#   "environment": "production",
#   "database": "connected",
#   "workers": "healthy"
# }
```

---

**2. Functionality Tests:**
```bash
# Run smoke test suite
pnpm test:e2e:smoke --base-url=https://abyrith.com

# Expected: All tests pass
```

---

**3. Monitoring:**
- [ ] Check Cloudflare Analytics dashboard
  - Verify requests are being served
  - Check for elevated error rates
  - Monitor response times

- [ ] Check Sentry dashboard
  - No new critical errors
  - Error rate within normal range
  - No performance regressions

- [ ] Check Supabase dashboard
  - Database connections healthy
  - Query performance normal
  - No connection pool exhaustion

**Metrics to check:**
- **HTTP Status Codes:**
  - 2xx rate > 99%
  - 4xx rate < 1% (user errors)
  - 5xx rate < 0.1% (server errors)
- **Response Time:** p95 < 500ms, p99 < 1s
- **Database Queries:** p95 < 100ms
- **Error Rate:** < 0.1% of requests

---

**4. User Impact:**
- [ ] Verify users can log in
- [ ] Test creating new secret
- [ ] Test retrieving existing secret
- [ ] Check AI assistant functionality
- [ ] Verify team collaboration features

---

### Success Criteria

**Deployment is successful when:**
- [ ] Health endpoint returns 200 OK
- [ ] All smoke tests pass
- [ ] No increase in error rates (< 0.1%)
- [ ] Response times within normal range (p95 < 500ms)
- [ ] No critical alerts triggered
- [ ] Database migrations applied successfully
- [ ] Cloudflare Pages and Workers deployed successfully
- [ ] User-facing features functional
- [ ] Team notified of successful deployment

---

## Rollback

### When to Rollback

**Rollback immediately if:**
- Critical functionality broken (users cannot access secrets)
- Security vulnerability introduced
- Data corruption detected
- Error rate > 5% of requests
- P0 incident triggered
- Database migration cannot be applied

**Consider rollback if:**
- Non-critical feature broken (can be fixed forward)
- Performance degradation detected (> 2x slower)
- User complaints increasing rapidly
- 15 minutes passed without successful verification

### Rollback Procedure

**Step 1: Announce Rollback**
```
⚠️ PRODUCTION ROLLBACK INITIATED
Reason: [brief description]
Initiated by: @[your-name]
ETA: ~5 minutes
```

---

**Step 2: Rollback Cloudflare Pages**

```bash
# Option A: Via Cloudflare Dashboard (fastest)
# 1. Go to Cloudflare Dashboard → Pages → abyrith-production
# 2. View deployments
# 3. Find previous successful deployment
# 4. Click "Rollback to this deployment"
# 5. Confirm rollback

# Option B: Via Wrangler CLI
# 1. List recent deployments
wrangler pages deployment list --project-name=abyrith-production

# 2. Rollback to previous deployment ID
wrangler pages deployment rollback <deployment-id>
```

**Time:** ~30 seconds (instant rollback)

---

**Step 3: Rollback Cloudflare Workers**

```bash
# 1. List recent Worker deployments
wrangler deployments list

# 2. Rollback to previous deployment
wrangler rollback --message "Rollback: [reason]"

# 3. Verify rollback
curl https://api.abyrith.com/health
```

**Time:** ~1 minute

---

**Step 4: Rollback Database Migrations (if needed)**

⚠️ **CAUTION:** Only rollback database if migration caused issue

```bash
# 1. Connect to production database
supabase db remote connect

# 2. Check migration history
supabase migration list

# 3. Rollback last migration (if needed)
supabase migration rollback

# Alternative: Run manual rollback SQL
psql $DATABASE_URL < migrations/rollback/xxx_rollback.sql
```

**Important notes:**
- Database rollbacks are risky if data was modified
- Only rollback if migration was backward-compatible
- Consider fixing forward if data integrity at risk

**Time:** ~2-5 minutes

---

**Step 5: Verify Rollback**

```bash
# Check health endpoint
curl https://abyrith.com/api/health

# Run smoke tests
pnpm test:e2e:smoke --base-url=https://abyrith.com

# Verify in browser
open https://abyrith.com
```

**Expected:** Previous version functioning correctly

---

**Step 6: Notify Team**

```
✅ ROLLBACK COMPLETE
Previous version restored
System status: Operational
Root cause: [description]
Next steps: [fix plan]
Post-mortem: [when]
```

---

### Post-Rollback Actions

**After successful rollback:**
1. Investigate root cause of deployment failure
2. Document issue in incident log
3. Fix issue in code
4. Re-test in staging thoroughly
5. Schedule new deployment attempt
6. Conduct post-mortem if P0/P1 incident

---

## Database Migrations

### Migration Workflow

**1. Create Migration:**
```bash
# Generate new migration file
supabase migration new <migration-name>

# Edit generated file in supabase/migrations/
# Example: 20251030000000_add_secrets_table.sql
```

**2. Write Migration SQL:**
```sql
-- Migration: Add secrets table
CREATE TABLE IF NOT EXISTS secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  encrypted_value TEXT NOT NULL,
  service_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_secrets_user_id ON secrets(user_id);
CREATE INDEX idx_secrets_project_id ON secrets(project_id);

-- Enable RLS
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can only access their own secrets"
  ON secrets
  FOR ALL
  USING (user_id = auth.uid());
```

**3. Create Rollback Script (REQUIRED):**
```sql
-- File: supabase/migrations/rollback/20251030000000_add_secrets_table_rollback.sql
DROP POLICY IF EXISTS "Users can only access their own secrets" ON secrets;
DROP INDEX IF EXISTS idx_secrets_project_id;
DROP INDEX IF EXISTS idx_secrets_user_id;
DROP TABLE IF EXISTS secrets;
```

**4. Test Locally:**
```bash
# Apply migration to local database
supabase migration up

# Verify tables created
supabase db inspect

# Test rollback
psql $LOCAL_DATABASE_URL < supabase/migrations/rollback/xxx_rollback.sql

# Reapply migration
supabase migration up
```

**5. Test in Staging:**
```bash
# Push to develop branch
git add supabase/migrations/
git commit -m "feat(db): Add secrets table with RLS"
git push origin develop

# GitHub Actions will automatically apply migration to staging
# Monitor deployment logs
```

**6. Verify Migration:**
```bash
# Check migration applied
supabase migration list --env staging

# Verify table structure
supabase db inspect --env staging
```

---

### Migration Best Practices

**DO:**
- ✅ Make migrations backward-compatible
- ✅ Add indexes for foreign keys
- ✅ Enable RLS on all user tables
- ✅ Use `IF NOT EXISTS` for safety
- ✅ Test rollback script
- ✅ Document breaking changes
- ✅ Keep migrations small and focused

**DON'T:**
- ❌ Delete columns (deprecate first, delete later)
- ❌ Rename columns without compatibility layer
- ❌ Drop tables with user data without backup
- ❌ Make non-nullable columns without default value
- ❌ Skip testing locally first
- ❌ Combine unrelated schema changes

---

### Migration Checklist

**Before committing migration:**
- [ ] Migration SQL tested locally
- [ ] Rollback script created and tested
- [ ] Indexes added for foreign keys
- [ ] RLS policies defined
- [ ] Migration is backward-compatible
- [ ] Breaking changes documented
- [ ] Performance impact assessed (for large tables)

---

## Troubleshooting

### Issue 1: Deployment Fails - Tests Not Passing

**Symptoms:**
```
❌ Run full test suite
Error: 5 tests failed
```

**Cause:** Code changes broke existing tests

**Solution:**
```bash
# 1. Check which tests failed
# Review GitHub Actions logs for failed test names

# 2. Run tests locally
pnpm test

# 3. Fix failing tests
# Edit test files to match new behavior

# 4. Verify fixes
pnpm test

# 5. Commit and push
git add .
git commit -m "fix(tests): Update tests for new behavior"
git push
```

**If solution doesn't work:**
- Review test logic to ensure tests are correct
- Check if feature behavior matches expectations
- Consider if tests need updating vs. code needs fixing

---

### Issue 2: Cloudflare Deployment Fails

**Symptoms:**
```
❌ Deploy to Cloudflare Pages
Error: Failed to upload build artifacts
```

**Cause:** Cloudflare API issues or invalid credentials

**Solution:**
```bash
# 1. Verify Cloudflare API token is valid
# Check GitHub Secrets → CLOUDFLARE_API_TOKEN

# 2. Check Cloudflare status
open https://www.cloudflarestatus.com/

# 3. Retry deployment manually
wrangler pages publish .next --project-name=abyrith-production

# 4. If manual deploy works, re-trigger GitHub Action
# Re-run failed jobs in GitHub Actions UI
```

**If solution doesn't work:**
- Regenerate Cloudflare API token
- Update token in GitHub Secrets
- Contact Cloudflare support if status page shows incidents

---

### Issue 3: Database Migration Fails

**Symptoms:**
```
❌ Run database migrations
Error: column "xyz" already exists
```

**Cause:** Migration already applied or not idempotent

**Solution:**
```bash
# 1. Check migration history
supabase migration list --env production

# 2. If migration was partially applied:
# Run rollback script
psql $PROD_DATABASE_URL < supabase/migrations/rollback/xxx_rollback.sql

# 3. Make migration idempotent
# Add IF NOT EXISTS / IF EXISTS clauses

# 4. Reapply migration
supabase migration up --env production
```

**Prevention:**
- Always use `IF NOT EXISTS` and `IF EXISTS`
- Test migrations locally first
- Test rollback scripts

---

### Issue 4: High Error Rate After Deployment

**Symptoms:**
- Sentry showing 10x increase in errors
- Users reporting "500 Internal Server Error"
- Cloudflare Analytics showing elevated 5xx responses

**Cause:** Code bug introduced in deployment

**Solution:**
```bash
# 1. IMMEDIATE ACTION: Initiate rollback (see Rollback section)

# 2. After rollback, investigate:
# Check Sentry for error stack traces
open https://sentry.io/abyrith/errors

# 3. Review recent changes
git log --oneline -10

# 4. Identify problematic commit
git diff <previous-commit> <current-commit>

# 5. Fix issue locally
# Make code changes

# 6. Test thoroughly
pnpm test
pnpm build

# 7. Deploy fix to staging first
git push origin develop

# 8. Validate in staging before re-deploying to production
```

---

### Issue 5: Worker Secrets Not Updated

**Symptoms:**
```
❌ Post-deployment verification
Error: Worker cannot connect to Supabase
```

**Cause:** Worker secrets not updated correctly

**Solution:**
```bash
# 1. List current secrets
wrangler secret list --env production

# 2. Manually update secrets
echo "$PROD_SUPABASE_URL" | wrangler secret put SUPABASE_URL --env production
echo "$PROD_SUPABASE_ANON_KEY" | wrangler secret put SUPABASE_ANON_KEY --env production

# 3. Verify secrets updated
# Re-run verification
pnpm verify:deployment --env production

# 4. Test Worker endpoint
curl https://api.abyrith.com/health
```

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| DevOps Lead | [Name] | Slack @devops-lead | Immediate |
| Engineering Lead | [Name] | Slack @eng-lead | If DevOps unavailable |
| On-Call Engineer | Rotating | PagerDuty | For P0 incidents |
| Cloudflare Support | - | support@cloudflare.com | For platform issues |
| Supabase Support | - | support@supabase.com | For database issues |

---

## Post-Deployment

### Cleanup

**After successful deployment:**
```bash
# 1. Close deployment PR (if not auto-closed)

# 2. Update issue tracker
# Mark deployment ticket as complete

# 3. Document any issues encountered
# Add to deployment log

# 4. No cleanup needed for Cloudflare
# Old deployments automatically retained for rollback
```

### Documentation

**Update these documents:**
- [ ] This runbook (if process issues identified)
- [ ] `CHANGELOG.md` (with deployment date and version)
- [ ] Release notes (if customer-facing changes)
- [ ] `11-development/known-issues.md` (if workarounds needed)

### Communication

**Notify:**
- [ ] Team in #deployments Slack channel: "Deployment completed successfully"
- [ ] Update status page (if customer-facing)
- [ ] Close deployment ticket
- [ ] Send summary to stakeholders (if major release):

**Summary template:**
```
📦 Production Deployment Summary
Version: v1.2.3
Deployed: 2025-10-30 14:00 UTC
Deployer: @name
Duration: 8 minutes

Changes:
- [Feature 1]
- [Bug fix 1]
- [Performance improvement]

Status: ✅ Successful
Issues: None
Rollbacks: None

Next deployment: [planned date]
```

### Monitoring

**Increased monitoring period:**
- Monitor for 2 hours after deployment
- Watch for unexpected error rate increases
- Monitor user feedback channels
- Check performance metrics

**Set up temporary alerts (if major deployment):**
- Alert on error rate > 0.5%
- Alert on response time p95 > 1s
- Alert on database connection pool > 80%

---

## Communication

### Communication Templates

**Pre-Deployment Announcement:**
```
📢 Production Deployment Scheduled

When: [Date/Time] ([Timezone])
Duration: ~10 minutes
Impact: None expected (zero-downtime deployment)
Purpose: [Briefly describe changes]

Changes:
- [Change 1]
- [Change 2]

Staging validation: ✅ Complete
Approvals: ✅ Obtained

Updates will be posted in #deployments
```

---

**During Deployment:**
```
🔧 Production Deployment In Progress

Status: [Current step]
Progress: 60% complete
ETA: ~5 minutes remaining

Latest:
✅ Tests passed
✅ Build successful
🔄 Deploying Workers
⏳ Running smoke tests

Everything proceeding as expected.
```

---

**Completion:**
```
✅ Production Deployment Complete

Completed: [Time]
Duration: 8 minutes
Status: Success

Version: v1.2.3
Changes:
- [Summary of changes]

Verification:
✅ All smoke tests passing
✅ Health checks healthy
✅ Error rates normal
✅ Performance metrics normal

System fully operational. Monitoring continues for 2 hours.
```

---

**Rollback Announcement:**
```
⚠️ Production Rollback Executed

Rollback completed: [Time]
Reason: [Brief explanation]
Impact: Service restored to previous version
Duration: 5 minutes

Status: System operational
Previous version: v1.2.2

Investigation: In progress
Root cause: [What went wrong]
Next steps: [Plan to fix and redeploy]

Post-mortem scheduled: [When]
```

---

## Dependencies

### Technical Dependencies

**Must exist before deployment:**
- [x] `06-backend/cloudflare-workers/workers-architecture.md` - Worker deployment procedures
- [x] `TECH-STACK.md` - Technology specifications
- [x] `02-architecture/system-overview.md` - System architecture

**Systems involved:**
- GitHub Actions - CI/CD automation
- Cloudflare Pages - Frontend hosting
- Cloudflare Workers - API gateway and serverless functions
- Supabase - Database and authentication
- npm registry - Package dependencies

### Team Dependencies

**Requires coordination with:**
- Engineering team - Code review and approval
- DevOps team - Deployment approval and monitoring
- Product team - User communication (for major releases)
- Support team - User impact awareness

---

## References

### Internal Documentation
- `06-backend/cloudflare-workers/workers-architecture.md` - Workers deployment details
- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - Technology stack
- `11-development/local-setup.md` - Local development environment
- `10-operations/monitoring/monitoring-alerting.md` - Monitoring setup (when created)
- `10-operations/incidents/incident-response.md` - Incident response (when created)

### External Resources
- [GitHub Actions Documentation](https://docs.github.com/en/actions) - Workflow syntax
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/) - Pages deployment
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/) - Workers deployment
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli) - Database migrations
- [Semantic Versioning](https://semver.org/) - Version numbering

### Incident History

**Previous deployment incidents:**
- 2025-10-25: Database migration timeout (resolved: increased timeout, migration optimized)
- 2025-10-20: Cloudflare token expired (resolved: regenerated token, set expiration reminder)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | DevOps Team | Initial deployment pipeline documentation |

---

## Notes

### Improvements Needed
- Add automated rollback on critical error rate threshold
- Implement canary deployment for production (gradual rollout)
- Add database migration testing in CI
- Create dashboard for deployment status visibility

### Lessons Learned
- Always test database migrations in staging first
- Manual approval gates are critical for production stability
- Smoke tests catch 80% of deployment issues before users notice
- Clear communication reduces support tickets during deployments

### Next Review Date
2025-11-30 - Review after 1 month of production deployments
