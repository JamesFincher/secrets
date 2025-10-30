---
Document: Cloudflare Pages Deployment - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: TECH-STACK.md, 07-frontend/frontend-architecture.md, 02-architecture/system-overview.md
---

# Cloudflare Pages Deployment Operations Runbook

## Overview

This document provides step-by-step instructions for deploying the Abyrith Next.js frontend application to Cloudflare Pages, including initial setup, environment configuration, build optimization, deployment workflows, rollback procedures, and troubleshooting common issues.

**Purpose:** Enable consistent, reproducible deployments of the Abyrith frontend to Cloudflare Pages with zero downtime, proper environment variable management, and integration with GitHub Actions CI/CD.

**Frequency:** Deployments occur on every merge to `main` (production) and `develop` (staging). Manual deployments may be triggered for hotfixes.

**Estimated Time:** Initial setup: 30 minutes. Routine deployments: 5-10 minutes (automated via CI/CD).

**Risk Level:** Medium (production deployment affects all users; proper testing and rollback procedures mitigate risk)

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
- Setting up Cloudflare Pages for the first time
- Deploying a new version of the frontend to staging or production
- Configuring environment variables for a new environment
- Rolling back a problematic deployment
- Investigating deployment failures or performance issues

**Do NOT use this runbook when:**
- Deploying backend services (use backend deployment runbooks)
- Making database schema changes (requires separate migration runbook)
- Deploying Cloudflare Workers (use Workers deployment runbook)

### Scope

**What this covers:**
- Cloudflare Pages project setup and configuration
- Next.js build configuration for Cloudflare Pages
- Environment variable management
- GitHub integration for automatic deployments
- Custom domain configuration
- Deployment verification and rollback procedures

**What this does NOT cover:**
- Cloudflare Workers deployment (separate runbook)
- Database migrations (separate runbook)
- DNS configuration (see DNS setup documentation)
- Backend API deployment

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Cloudflare account with Pages access (Admin or Super Administrator role)
- [ ] GitHub repository access (Write permissions minimum)
- [ ] Production environment variable access (stored in 1Password/secure vault)

**Credentials:**
- [ ] Cloudflare API token (for CLI deployments)
- [ ] GitHub personal access token (for GitHub Actions, if not using GitHub App)

**How to request access:**
Contact DevOps lead or engineering manager for Cloudflare and GitHub access provisioning.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
node --version    # Should be 20.x or higher
pnpm --version    # Should be 8.x or higher
git --version     # Should be 2.40+ or higher
```

**Installation:**
```bash
# If tools are missing
# Node.js 20.x LTS
brew install node@20

# pnpm
npm install -g pnpm

# Git (usually pre-installed on macOS)
brew install git

# Wrangler CLI (for Cloudflare Workers, optional for Pages)
pnpm install -g wrangler
```

### Required Knowledge

**You should understand:**
- Next.js 14 App Router architecture
- Cloudflare Pages build system
- Environment variable management
- Git branching and merging workflows
- Basic DNS concepts (CNAME, A records)

**Reference documentation:**
- `07-frontend/frontend-architecture.md` - Frontend architecture overview
- `TECH-STACK.md` - Next.js and Cloudflare Pages specifications
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication
- [ ] Notify team in `#engineering` Slack channel (for production deployments)
- [ ] Create deployment ticket in Linear/GitHub Issues
- [ ] Update status page if customer-facing changes expected

### 2. Code Verification
- [ ] All tests passing on target branch (`npm run test`)
- [ ] Linting and type checking passing (`npm run lint`, `npm run type-check`)
- [ ] Pull request reviewed and approved
- [ ] Target branch (`main` or `develop`) is up to date

### 3. Environment Check
- [ ] Verify environment variables are configured in Cloudflare Pages dashboard
- [ ] Check for any breaking changes in dependencies (review `CHANGELOG.md`)
- [ ] Review recent deployments for any patterns of failure

### 4. Timing
- [ ] Confirm deployment during low-traffic window (optional for zero-downtime deploys)
- [ ] Verify no other critical deployments are in progress

### 5. Preparation
- [ ] Read through entire runbook before starting
- [ ] Have rollback plan ready (previous deployment ID noted)
- [ ] Have emergency contacts ready

---

## Procedure

### Step 1: Initial Cloudflare Pages Setup (One-Time)

**Purpose:** Create Cloudflare Pages project connected to GitHub repository.

**Commands:**

1. **Log in to Cloudflare Dashboard**
   - Navigate to https://dash.cloudflare.com
   - Select your account

2. **Create Pages Project**
   - Click "Workers & Pages" in left sidebar
   - Click "Create application" → "Pages" → "Connect to Git"
   - Authorize GitHub (if not already authorized)
   - Select repository: `your-org/abyrith-frontend`
   - Click "Begin setup"

3. **Configure Build Settings**
   ```
   Framework preset: Next.js
   Build command: pnpm run build
   Build output directory: .next (Cloudflare handles Next.js automatically)
   Root directory: / (leave blank if frontend in root, adjust if monorepo)
   ```

4. **Environment Variables (Production)**
   Add these in Cloudflare Pages dashboard → Settings → Environment variables → Production:
   ```bash
   NEXT_PUBLIC_API_URL=https://api.abyrith.com/v1
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=your_turnstile_key
   ```

5. **Environment Variables (Preview/Staging)**
   Add these for Preview/Staging environment:
   ```bash
   NEXT_PUBLIC_API_URL=https://api-staging.abyrith.com/v1
   NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_staging_anon_key
   NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=your_staging_turnstile_key
   ```

6. **Save and Deploy**
   - Click "Save and Deploy"
   - First deployment will start automatically

**Expected output:**
```
✓ Build complete
✓ Uploading... (100%)
✓ Deployment complete
✓ Site available at: https://abyrith-frontend.pages.dev
```

**Time:** ~5 minutes (first build may take longer)

---

### Step 2: Configure Custom Domain (Production Only)

**Purpose:** Point custom domain (`app.abyrith.com`) to Cloudflare Pages deployment.

**Commands:**

1. **Add Custom Domain**
   - In Cloudflare Pages dashboard → Custom domains
   - Click "Set up a custom domain"
   - Enter domain: `app.abyrith.com`
   - Click "Continue"

2. **Verify DNS Configuration**
   - Cloudflare will show CNAME record to add
   - If domain is on Cloudflare DNS (recommended):
     - Record is automatically added
     - Click "Activate domain"
   - If domain is elsewhere:
     - Add CNAME record: `app` → `abyrith-frontend.pages.dev`
     - Wait for DNS propagation (~5-10 minutes)

3. **Enable HTTPS**
   - Cloudflare automatically provisions SSL certificate
   - Wait for "Active" status (~2 minutes)

**Expected output:**
```
✓ Custom domain added
✓ SSL certificate issued
✓ app.abyrith.com is now live
```

**Time:** ~10 minutes (including DNS propagation)

---

### Step 3: Configure Next.js Build Settings

**Purpose:** Optimize Next.js configuration for Cloudflare Pages deployment.

**File: `next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration for Cloudflare Pages
  // Pages automatically detects Next.js and uses correct adapter
  output: 'standalone', // Not needed for Cloudflare Pages, but doesn't hurt

  // Image optimization (Cloudflare Images or built-in)
  images: {
    // Cloudflare Pages supports Next.js Image Optimization
    unoptimized: false,
    domains: ['your-supabase-project.supabase.co'], // Allow Supabase avatars
  },

  // Strict mode for better development
  reactStrictMode: true,

  // Bundle analyzer (enable for debugging large bundles)
  // @next/bundle-analyzer - uncomment when needed
  // bundleAnalyzer: {
  //   enabled: process.env.ANALYZE === 'true',
  // },

  // Webpack config (if needed for custom loaders)
  webpack: (config, { isServer }) => {
    // Custom webpack configuration
    return config;
  },

  // Environment variables (public only, prefixed with NEXT_PUBLIC_)
  env: {
    // No sensitive keys here - use Cloudflare Pages env vars
  },

  // Redirects (if needed)
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/auth/login',
        permanent: true,
      },
    ];
  },

  // Headers (security headers set by Cloudflare, but can add more)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

**Commit and push:**
```bash
git add next.config.js
git commit -m "Configure Next.js for Cloudflare Pages deployment"
git push origin main
```

**Time:** ~2 minutes

---

### Step 4: Deploy via GitHub Push (Automatic Deployment)

**Purpose:** Trigger automatic deployment by pushing to GitHub.

**Commands:**

1. **Ensure all changes are committed**
   ```bash
   git status
   # Should show: nothing to commit, working tree clean
   ```

2. **Push to main branch (Production)**
   ```bash
   git checkout main
   git pull origin main  # Ensure up to date
   git push origin main
   ```

   **Or push to develop branch (Staging)**
   ```bash
   git checkout develop
   git pull origin develop
   git push origin develop
   ```

3. **Monitor Deployment in Cloudflare Dashboard**
   - Navigate to Pages project → Deployments
   - Watch build logs in real-time
   - Wait for "Success" status

4. **Check GitHub Actions (if CI/CD is configured)**
   - Navigate to GitHub repository → Actions
   - Verify all checks pass
   - Deployment happens after checks pass

**Expected output:**
```
Cloudflare Pages Dashboard:
  ✓ Building (2-3 minutes)
  ✓ Deploying (30 seconds)
  ✓ Success

Deployment URL: https://abc123.abyrith-frontend.pages.dev
Production URL: https://app.abyrith.com
```

**Important notes:**
- Cloudflare Pages creates a unique preview URL for every commit
- Production environment (`main` branch) deploys to custom domain
- Preview environments (`develop` or PR branches) get unique URLs

**Time:** ~3-5 minutes (build + deploy)

---

### Step 5: Manual Deployment (Using Wrangler CLI)

**Purpose:** Deploy manually using Wrangler CLI (for testing or emergency deploys).

**Commands:**

1. **Build Next.js Application Locally**
   ```bash
   cd /path/to/abyrith-frontend
   pnpm install
   pnpm run build
   ```

2. **Deploy to Cloudflare Pages**
   ```bash
   # Using wrangler
   pnpm wrangler pages publish .next --project-name=abyrith-frontend
   ```

3. **Verify Deployment**
   ```bash
   # Wrangler will output deployment URL
   curl -I https://abc123.abyrith-frontend.pages.dev
   ```

**Expected output:**
```
✓ Build complete
✓ Uploading... (100%)
✓ Deployment ID: abc123
✓ Deployment URL: https://abc123.abyrith-frontend.pages.dev
```

**Time:** ~5 minutes (local build + upload)

---

## Verification

### Post-Deployment Checks

**1. Health Check:**
```bash
# Check site is responding
curl -I https://app.abyrith.com

# Expected: HTTP/2 200
```

**2. Functionality Tests:**
- [ ] Homepage loads (`https://app.abyrith.com`)
- [ ] Login page loads (`https://app.abyrith.com/login`)
- [ ] Dashboard loads for authenticated user
- [ ] Secrets list loads (fetch from API works)
- [ ] Create secret form works
- [ ] Real-time updates work (if testable)

**3. Monitoring:**
- [ ] Check Cloudflare Analytics dashboard (traffic, errors)
- [ ] Check Sentry for new errors (if configured)
- [ ] Review recent deployment logs for warnings

**4. User Impact:**
- [ ] Verify no increase in support tickets
- [ ] Check feedback channels (Slack, email)

**Metrics to check:**
- **Response time**: < 500ms for main pages (p95)
- **Error rate**: < 0.1%
- **Availability**: 100% (no downtime)

---

### Success Criteria

**Deployment is successful when:**
- [ ] Site is accessible at production URL
- [ ] All critical user flows work (login, create secret, view dashboard)
- [ ] No errors in Cloudflare/Sentry logs
- [ ] Performance metrics within acceptable ranges
- [ ] No reports of user-facing issues

---

## Rollback

### When to Rollback

**Rollback if:**
- Critical functionality is broken (login fails, secrets can't be accessed)
- Performance degrades significantly (>2s page load times)
- Errors spike (>1% error rate)
- Security vulnerability discovered in deployed code

### Rollback Procedure

**Step 1: Identify Previous Working Deployment**

1. **Find Last Good Deployment**
   - Navigate to Cloudflare Pages → Deployments
   - Identify last deployment with "Success" status before problematic one
   - Note deployment ID (e.g., `abc123`)

**Step 2: Rollback via Cloudflare Dashboard**

1. **Promote Previous Deployment**
   - Click on last good deployment
   - Click "Rollback to this deployment"
   - Confirm rollback

2. **Verify Rollback**
   ```bash
   # Check production site
   curl -I https://app.abyrith.com
   # Verify deployment ID in headers or check Cloudflare dashboard
   ```

**Expected:** Production URL now serves previous deployment (instant rollback)

**Time:** ~30 seconds (instant, no rebuild)

---

**Step 3: Revert Code Changes (Git)**

If rollback via dashboard isn't sufficient, revert code in Git:

```bash
# Option 1: Revert specific commit
git log --oneline  # Find problematic commit hash
git revert <commit-hash>
git push origin main

# Option 2: Hard reset to previous commit (DANGEROUS - use with caution)
git reset --hard <previous-commit-hash>
git push --force origin main  # ⚠️ Only if approved by team lead
```

**Time:** ~5 minutes (including rebuild)

---

### Post-Rollback

**After rollback:**
1. Investigate root cause of failure
2. Create incident post-mortem
3. Fix issue in separate branch
4. Test thoroughly before re-deploying
5. Schedule post-mortem meeting (if major incident)

---

## Troubleshooting

### Issue 1: Build Fails with "Module not found"

**Symptoms:**
```
Error: Cannot find module '@/lib/api/client'
```

**Cause:** Incorrect TypeScript path alias configuration or missing dependency.

**Solution:**
```bash
# Check tsconfig.json paths are correct
cat tsconfig.json | grep paths

# Verify dependency is installed
pnpm list <dependency-name>

# If missing, install
pnpm install <dependency-name>

# Clear Next.js cache and rebuild
rm -rf .next
pnpm run build
```

**If solution doesn't work:**
- Check `package.json` for correct dependency versions
- Verify `tsconfig.json` paths match project structure

---

### Issue 2: Environment Variables Not Available at Runtime

**Symptoms:**
```
process.env.NEXT_PUBLIC_API_URL is undefined
```

**Cause:** Environment variables not prefixed with `NEXT_PUBLIC_` or not set in Cloudflare Pages.

**Solution:**

1. **Verify Variables in Cloudflare Dashboard**
   - Pages project → Settings → Environment variables
   - Ensure all required variables are set for correct environment (Production/Preview)

2. **Prefix Public Variables**
   - All client-side environment variables MUST start with `NEXT_PUBLIC_`
   - Example: `NEXT_PUBLIC_API_URL`, not `API_URL`

3. **Redeploy After Adding Variables**
   ```bash
   # Trigger redeploy in Cloudflare dashboard (Deployments → Retry)
   # Or push a new commit to trigger rebuild
   git commit --allow-empty -m "Trigger rebuild"
   git push origin main
   ```

**If solution doesn't work:**
- Check for typos in variable names
- Verify variables are set for correct environment (Production vs Preview)

---

### Issue 3: "502 Bad Gateway" After Deployment

**Symptoms:**
```
502 Bad Gateway
```

**Cause:** Next.js server component error or Workers runtime issue.

**Solution:**

1. **Check Build Logs**
   - Cloudflare Pages → Deployments → View build logs
   - Look for errors during build

2. **Check Runtime Logs**
   - Cloudflare dashboard → Workers & Pages → Your project → Logs
   - Look for runtime errors

3. **Verify Next.js Configuration**
   ```javascript
   // next.config.js
   // Ensure no incompatible settings for Cloudflare Pages
   ```

4. **Test Locally**
   ```bash
   pnpm run build
   pnpm run start
   # Visit http://localhost:3000
   # Reproduce error locally
   ```

**If solution doesn't work:**
- Contact Cloudflare support
- Check Cloudflare status page for platform issues

---

### Issue 4: Slow Build Times (>5 minutes)

**Symptoms:**
Build takes 10+ minutes to complete.

**Cause:** Large dependencies, inefficient builds, or missing caching.

**Solution:**

1. **Enable Caching**
   Cloudflare Pages automatically caches `node_modules` and `.next`.

2. **Reduce Bundle Size**
   ```bash
   # Analyze bundle size
   pnpm run build
   # Check output for large chunks

   # Use next/bundle-analyzer
   pnpm add -D @next/bundle-analyzer
   ANALYZE=true pnpm run build
   ```

3. **Optimize Dependencies**
   - Remove unused dependencies
   - Use dynamic imports for large libraries
   - Consider using lighter alternatives

**If solution doesn't work:**
- Review Cloudflare Pages build limits
- Consider caching strategies in `next.config.js`

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| Frontend Lead | [Name] | Slack @frontend-lead | Immediate |
| DevOps Lead | [Name] | Slack @devops-lead | Within 15 minutes |
| Engineering Manager | [Name] | Slack @eng-manager | After 30 minutes |

---

## Post-Procedure

### Cleanup

**After successful deployment:**
```bash
# No cleanup needed - Cloudflare manages old deployments
# (Old deployments remain accessible for rollback)
```

### Documentation

**Update these documents:**
- [ ] Deployment log (if major changes)
- [ ] This runbook (if issues/improvements identified)
- [ ] CHANGELOG.md (if user-facing changes)
- [ ] Linear/GitHub ticket with deployment notes

### Communication

**Notify:**
- [ ] Team in `#engineering` Slack: "Frontend deployed to production successfully ✓"
- [ ] Update status page (if customer-facing changes)
- [ ] Close deployment ticket

### Monitoring

**Increased monitoring period:**
- Monitor for 2 hours after production deployment
- Watch for:
  - Error rate spikes
  - Performance degradation
  - User reports of issues
- Set up temporary alerts if major changes deployed

---

## Communication

### Communication Templates

**Pre-Deployment Announcement:**
```
📢 Frontend Deployment Scheduled

When: [Date/Time] ([Timezone])
Duration: ~5 minutes
Impact: None expected (zero-downtime deployment)
Changes: [Brief summary]

Updates: #engineering Slack channel
```

---

**During Deployment:**
```
🔧 Frontend Deployment in Progress

Status: Building application...
Progress: 50% complete
ETA: 2 minutes

No action required. Will update when complete.
```

---

**Completion:**
```
✅ Frontend Deployment Complete

Completed: [Time]
Duration: 4 minutes
Status: Success ✓
Deployment URL: https://app.abyrith.com

All systems operational. Monitoring for next 2 hours.
```

---

**Rollback Announcement:**
```
⚠️ Frontend Rolled Back to Previous Version

Rollback completed: [Time]
Reason: [Brief explanation]
Impact: Service restored to previous working version

Investigation underway. Post-mortem scheduled for [Date/Time].
```

---

## Dependencies

### Technical Dependencies

**Must exist before deployment:**
- [ ] Next.js application built and tested locally
- [ ] Cloudflare Pages project created
- [ ] GitHub repository connected to Cloudflare Pages
- [ ] Environment variables configured

**Systems involved:**
- Cloudflare Pages (hosting and build)
- GitHub (source code and CI/CD triggers)
- Supabase (API backend, must be accessible)
- Cloudflare DNS (for custom domain)

### Team Dependencies

**Requires coordination with:**
- Backend team - Ensure API is ready to receive requests from new frontend version
- Product team - Confirm feature flags and rollout strategy

---

## References

### Internal Documentation
- `07-frontend/frontend-architecture.md` - Frontend architecture
- `TECH-STACK.md` - Technology stack (Next.js version, Cloudflare Pages)
- `11-development/ci-cd/github-actions.md` - CI/CD pipeline

### External Resources
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/) - Official Cloudflare Pages docs
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment) - Next.js deployment best practices
- [Cloudflare Pages Status](https://www.cloudflarestatus.com/) - Platform status page

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial Cloudflare Pages deployment runbook |

---

## Notes

### Future Improvements
- Automate rollback via GitHub Actions workflow
- Implement blue-green deployment strategy
- Add smoke tests that run automatically post-deployment
- Set up deployment notifications in Slack (webhooks)

### Known Limitations
- Cloudflare Pages free tier: 500 builds/month (upgrade if exceeded)
- Build timeout: 20 minutes (contact support for increase)
- Maximum file size: 25MB per file (optimize large assets)

### Next Review Date
2025-12-01 (review after 3 months of production deployments)
