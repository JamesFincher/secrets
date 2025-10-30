---
Document: Incident Response Playbook
Version: 1.1.0
Last Updated: 2025-10-30
Owner: DevOps Team
Status: Draft
Dependencies: 10-operations/deployment/deployment-runbook.md, 10-operations/monitoring/monitoring-alerting.md, 03-security/security-model.md
---

# Incident Response Playbook

## Overview

This playbook defines the process for responding to production incidents affecting the Abyrith platform. It provides clear procedures for detecting, communicating, resolving, and learning from incidents to ensure platform reliability and minimize user impact.

**Purpose:** Provide a standardized, step-by-step response process for handling production incidents from detection through post-mortem.

**Frequency:** On-demand (when incidents occur)

**Estimated Time:** Varies by severity (15 minutes to several hours)

**Risk Level:** Critical

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Severity Classification](#severity-classification)
3. [Incident Response Team](#incident-response-team)
4. [Detection & Alert Response](#detection--alert-response)
5. [Incident Response Procedure](#incident-response-procedure)
6. [Communication Protocols](#communication-protocols)
7. [Common Incidents & Resolutions](#common-incidents--resolutions)
8. [Post-Incident Process](#post-incident-process)
9. [Post-Mortem Template](#post-mortem-template)
10. [On-Call Rotation](#on-call-rotation)
11. [Escalation Paths](#escalation-paths)
12. [Dependencies](#dependencies)
13. [References](#references)
14. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Production service is down or degraded
- Security incident or breach suspected
- Data loss or corruption detected
- Critical functionality unavailable to users
- Third-party service failure impacting Abyrith
- Performance degradation affecting user experience
- Monitoring alerts indicate P0 or P1 severity

**Do NOT use this runbook when:**
- Issue only affects staging or development environments (use standard debugging)
- Single user reports a non-critical issue (route to support)
- Planned maintenance or deployments (use deployment runbook)
- Feature requests or enhancements (create GitHub issue)

### Scope

**What this covers:**
- Production incident detection and triage
- Communication with stakeholders (internal and external)
- Resolution procedures for common incidents
- Post-incident analysis and learning

**What this does NOT cover:**
- Security incident forensics (see `10-operations/security/security-incident-response.md`)
- Database backup/restore procedures (see `10-operations/database/maintenance-runbook.md`)
- Deployment rollbacks (see `10-operations/deployment/deployment-runbook.md`)
- Individual customer support issues (route to support system)

---

## Severity Classification

### P0 - Critical (SEV 1)

**Definition:** Complete platform outage or critical security breach.

**Examples:**
- Abyrith platform completely unavailable
- Database completely inaccessible
- Zero-knowledge encryption compromised
- Suspected data breach
- All users unable to access secrets
- Authentication system down

**Response Time:**
- **Detection to acknowledgment:** 5 minutes
- **Acknowledgment to mitigation:** 30 minutes
- **Full resolution target:** 2 hours

**Communication:**
- Immediate notification to entire engineering team
- Status page update within 5 minutes
- Customer email notification within 15 minutes
- Updates every 30 minutes until resolved

**On-Call:** All engineers on deck

---

### P1 - High (SEV 2)

**Definition:** Major functionality degraded but platform accessible.

**Examples:**
- API severely degraded (>50% error rate)
- AI Assistant completely unavailable
- Supabase Auth intermittent failures
- Cloudflare Workers experiencing high latency
- MCP server not responding
- Critical feature broken for all users

**Response Time:**
- **Detection to acknowledgment:** 15 minutes
- **Acknowledgment to mitigation:** 1 hour
- **Full resolution target:** 4 hours

**Communication:**
- Notification to on-call engineer and engineering lead
- Status page update within 15 minutes
- Customer email if issue persists >1 hour
- Updates every hour until resolved

**On-Call:** Primary on-call engineer + escalation to lead if needed

---

### P2 - Medium (SEV 3)

**Definition:** Non-critical functionality impaired, workarounds available.

**Examples:**
- Single feature broken (e.g., export functionality)
- Performance degradation (<20% slower)
- Third-party integration failing (FireCrawl)
- Email notifications delayed
- Audit log export not working
- Dashboard metrics not updating

**Response Time:**
- **Detection to acknowledgment:** 1 hour
- **Acknowledgment to mitigation:** 4 hours
- **Full resolution target:** 24 hours

**Communication:**
- Notification to on-call engineer
- Status page update if affecting multiple users
- No immediate customer notification unless requested
- Updates every 4 hours if actively being worked

**On-Call:** Primary on-call engineer

---

### P3 - Low (SEV 4)

**Definition:** Minor issues with minimal user impact.

**Examples:**
- Cosmetic UI bugs
- Non-critical documentation errors
- Single user experiencing issues (configuration problem)
- Minor performance degradation in non-critical features
- Analytics data gaps

**Response Time:**
- **Detection to acknowledgment:** 4 hours (during business hours)
- **Resolution target:** Next sprint

**Communication:**
- Create GitHub issue
- No status page update
- No customer notification
- Address during normal development cycle

**On-Call:** Not required

---

## Incident Response Team

### Roles & Responsibilities

#### Incident Commander (IC)

**Responsibility:** Overall incident coordination, decision-making authority.

**Who:** Primary on-call engineer becomes IC by default; Engineering Lead for P0 incidents.

**Key actions:**
- Assess severity and classify incident
- Coordinate response team
- Make technical decisions during incident
- Communicate status updates
- Decide when incident is resolved
- Ensure post-mortem is completed

---

#### Technical Lead (TL)

**Responsibility:** Hands-on investigation and resolution.

**Who:** Engineer with deepest knowledge of affected system; IC can also be TL for smaller incidents.

**Key actions:**
- Investigate root cause
- Implement fixes or workarounds
- Test solutions before deploying
- Document actions taken
- Provide technical updates to IC

---

#### Communications Lead (CL)

**Responsibility:** Internal and external communication.

**Who:** Product Lead or Engineering Lead for P0/P1; IC handles for P2.

**Key actions:**
- Update status page (status.abyrith.com)
- Send customer email notifications
- Post updates to team Slack channel
- Coordinate with support team
- Draft external messaging

---

#### Scribe

**Responsibility:** Document incident timeline and actions.

**Who:** Any available engineer not directly involved in resolution.

**Key actions:**
- Record all significant events with timestamps
- Capture chat logs and Slack messages
- Note all changes made to systems
- Compile information for post-mortem
- Document workarounds or temporary fixes

---

## Detection & Alert Response

### Alert Sources

**Primary monitoring systems:**
- **Cloudflare Analytics:** Traffic drops, error rate spikes
- **Supabase Dashboard:** Database performance, query failures
- **Sentry:** Application errors, crash reports
- **External monitoring:** Uptime monitoring service (e.g., UptimeRobot)
- **User reports:** Support tickets, social media

**Alert channels:**
- PagerDuty (P0/P1 incidents)
- Slack #incidents channel (all severities)
- Email (P2/P3 incidents)

---

### Initial Alert Response

**When you receive an alert:**

1. **Acknowledge within SLA:**
   - P0: 5 minutes
   - P1: 15 minutes
   - P2: 1 hour

2. **Verify the incident:**
   - Check multiple data sources (not just one alert)
   - Confirm user impact (check status.abyrith.com, support tickets)
   - Reproduce issue if possible

3. **Classify severity:**
   - Use severity definitions above
   - When in doubt, start higher and downgrade later

4. **Assign Incident Commander:**
   - Primary on-call becomes IC by default
   - For P0, Engineering Lead becomes IC

5. **Create incident channel:**
   - Slack: `#incident-YYYY-MM-DD-brief-description`
   - Example: `#incident-2025-10-30-api-down`

6. **Begin incident response procedure** (see below)

---

## Incident Response Procedure

### Step 1: Assess & Classify (First 5 minutes)

**Purpose:** Understand the scope and severity of the incident.

**Actions:**

1. **Check system health dashboards:**
   ```bash
   # Check Cloudflare Workers status
   # Open: https://dash.cloudflare.com/[account]/workers/overview

   # Check Supabase status
   # Open: https://supabase.com/dashboard/project/[project-id]

   # Check Sentry for recent errors
   # Open: https://sentry.io/organizations/abyrith/issues/
   ```

2. **Verify user impact:**
   - Check support ticket queue
   - Review recent user feedback/complaints
   - Test key user flows manually if possible

3. **Determine affected components:**
   - Frontend (Cloudflare Pages)
   - API Gateway (Cloudflare Workers)
   - Database (Supabase PostgreSQL)
   - Authentication (Supabase Auth)
   - AI Assistant (Claude API)
   - Third-party services (FireCrawl, etc.)

4. **Classify severity:**
   - Review severity definitions above
   - Document classification in incident channel
   - Set incident priority in tracking system

**Expected output:**
- Severity classification (P0-P3)
- List of affected systems/features
- Estimated user impact (percentage or count)
- Initial hypothesis of root cause

**Time:** ~5 minutes

---

### Step 2: Assemble Response Team (Next 5-10 minutes)

**Purpose:** Get the right people involved based on severity.

**Actions for P0/P1:**

1. **Notify team via Slack:**
   ```
   @channel INCIDENT: [P0/P1] [Brief description]

   Status: [Down/Degraded]
   Impact: [User impact]
   Incident Channel: #incident-YYYY-MM-DD-description
   IC: @[incident-commander]

   All hands needed for P0. Joining incident channel now.
   ```

2. **Assign roles:**
   - Incident Commander: [Name]
   - Technical Lead: [Name]
   - Communications Lead: [Name]
   - Scribe: [Name]

3. **Start incident war room** (if needed):
   - Video call for real-time coordination (Google Meet, Zoom)
   - Post link in incident Slack channel

**Actions for P2:**
- Notify primary on-call engineer
- Post incident summary in #incidents channel
- IC handles most roles solo, requests help as needed

**Actions for P3:**
- Create GitHub issue
- Assign to appropriate engineer
- No immediate team assembly required

**Time:** ~5-10 minutes

---

### Step 3: Communicate Status (Parallel with investigation)

**Purpose:** Keep stakeholders informed while investigating.

**Actions:**

1. **Update status page** (status.abyrith.com):
   ```
   [Component] - [Status]

   We are investigating reports of [issue description].
   Users may experience [specific impact].

   Posted: [timestamp]
   Next update: [timestamp + 30 min for P0, +1hr for P1]
   ```

2. **Post to incident channel:**
   ```
   STATUS UPDATE [HH:MM]

   Current status: [Investigating/Mitigating/Resolved]
   Severity: [P0/P1/P2]
   Impact: [Description]
   Actions taken: [Bullet list]
   Next steps: [What we're doing next]
   ETA for next update: [timestamp]
   ```

3. **Send customer notification** (P0/P1, >15 min duration):
   - Use communications templates below
   - Send via email to all users
   - Post on social media if appropriate

**Frequency:**
- P0: Every 30 minutes
- P1: Every 60 minutes
- P2: Every 4 hours (if actively working)

**Time:** 5 minutes per update

---

### Step 4: Investigate Root Cause (Concurrent with mitigation)

**Purpose:** Understand what caused the incident.

**Investigation checklist:**

1. **Review recent changes:**
   ```bash
   # Check recent deployments
   git log --since="24 hours ago" --oneline

   # Review GitHub Actions runs
   # Open: https://github.com/abyrith/secrets/actions

   # Check Cloudflare Workers deployments
   wrangler deployments list

   # Review Supabase migrations
   supabase db history
   ```

2. **Check error logs:**
   ```bash
   # Cloudflare Workers logs
   wrangler tail

   # Supabase logs
   # Open Supabase Dashboard > Logs

   # Sentry error logs
   # Open Sentry dashboard, filter by last 1 hour
   ```

3. **Review monitoring metrics:**
   - CPU usage spikes
   - Memory consumption
   - Database connection pool exhaustion
   - API response times
   - Error rates by endpoint

4. **Check third-party service status:**
   - Cloudflare Status: https://www.cloudflarestatus.com/
   - Supabase Status: https://status.supabase.com/
   - Anthropic Status: https://status.anthropic.com/
   - GitHub Status: https://www.githubstatus.com/

5. **Review dependencies:**
   - Are environment variables set correctly?
   - Are API keys/secrets valid and not expired?
   - Are rate limits being hit?
   - Is database storage full?

**Document findings:**
- Note all observations in incident channel
- Capture screenshots of dashboards/graphs
- Save relevant log excerpts
- Record hypothesis as it evolves

**Time:** Varies (ongoing during incident)

---

### Step 5: Implement Mitigation (Priority: stop the bleeding)

**Purpose:** Restore service as quickly as possible, even if not permanently fixed.

**Mitigation strategies by incident type:**

#### API Gateway Down (Cloudflare Workers)

**Quick mitigations:**
```bash
# Rollback to previous deployment
wrangler rollback [deployment-id]

# Check if KV store is responding
wrangler kv:key get --namespace-id=[id] "test-key"

# Temporarily disable rate limiting if causing issues
# (requires code change + quick deploy)
```

**Verification:**
```bash
# Test API endpoint
curl -X GET https://api.abyrith.com/v1/health \
  -H "Authorization: Bearer [test-token]"

# Expected: 200 OK
```

---

#### Database Issues (Supabase PostgreSQL)

**Quick mitigations:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill long-running queries (if needed)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active' AND query_start < now() - interval '5 minutes';

-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));
```

**Connection pool exhaustion:**
- Scale up Supabase instance temporarily
- Review and optimize slow queries
- Check for connection leaks in Workers

**Verification:**
```bash
# Test database connectivity
curl https://[project-ref].supabase.co/rest/v1/health
```

---

#### Authentication Failures (Supabase Auth)

**Quick mitigations:**
- Check Supabase Auth service status
- Verify JWT signing key hasn't rotated unexpectedly
- Test authentication flow manually
- Review recent auth policy changes

**Verification:**
```bash
# Test login flow
curl -X POST https://[project-ref].supabase.co/auth/v1/token \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Expected: 200 OK with access_token
```

---

#### Third-Party Service Outage

**Quick mitigations:**
- Enable graceful degradation mode (if implemented)
- Cache last known good responses
- Display user-friendly error messages
- Disable affected features temporarily

**Example: Claude API down:**
```typescript
// Fallback behavior
if (claudeAPIDown) {
  return {
    message: "AI Assistant is temporarily unavailable. Please try again in a few minutes.",
    fallback: true
  };
}
```

---

#### Frontend Issues (Cloudflare Pages)

**Quick mitigations:**
```bash
# Rollback to previous Pages deployment
# Via Cloudflare Dashboard > Pages > [project] > Deployments > Rollback

# Clear Cloudflare cache if stale content
curl -X POST "https://api.cloudflare.com/client/v4/zones/[zone-id]/purge_cache" \
  -H "Authorization: Bearer [api-token]" \
  -d '{"purge_everything":true}'
```

**Verification:**
- Load homepage in incognito window
- Test critical user flows
- Check browser console for errors

---

### Step 6: Verify Resolution

**Purpose:** Confirm the incident is fully resolved before closing.

**Verification checklist:**

1. **Automated checks:**
   ```bash
   # Run health check endpoints
   curl https://api.abyrith.com/v1/health
   curl https://app.abyrith.com/api/health

   # Expected: All return 200 OK
   ```

2. **Manual testing:**
   - [ ] Login flow works
   - [ ] Can create new secret
   - [ ] Can retrieve existing secret
   - [ ] Can update secret
   - [ ] Can delete secret
   - [ ] AI Assistant responds
   - [ ] Team collaboration features work
   - [ ] Audit logs recording events

3. **Monitoring verification:**
   - [ ] Error rates back to normal (<1%)
   - [ ] Response times within SLA (p95 <200ms)
   - [ ] No new alerts firing
   - [ ] Database performance normal
   - [ ] Connection pool healthy

4. **User feedback check:**
   - [ ] No new support tickets related to incident
   - [ ] Existing tickets show issue resolved
   - [ ] Status page comments indicate resolution

**Success criteria:**
- All verification checks pass
- No alerts active
- Monitoring metrics within normal range
- At least 30 minutes of stable operation (P0/P1)
- Root cause understood (or documented as unknown)

**If verification fails:**
- Do NOT close incident
- Return to investigation (Step 4)
- Consider additional mitigation strategies

**Time:** ~15-30 minutes

---

### Step 7: Close Incident

**Purpose:** Formally close the incident and begin recovery process.

**Actions:**

1. **Final status update:**
   ```
   RESOLVED [HH:MM]

   The incident affecting [component] has been resolved.

   Root cause: [Brief explanation]
   Resolution: [What was done]
   Duration: [Total incident time]

   We will continue monitoring and conduct a post-mortem.
   Thank you for your patience.
   ```

2. **Update status page:**
   - Mark all affected components as "Operational"
   - Post resolution message
   - Link to incident report (once available)

3. **Send all-clear notification:**
   - Email customers (if they were notified of incident)
   - Post in incident Slack channel
   - Notify support team

4. **Incident record:**
   - Document final incident details
   - Save all logs, screenshots, chat transcripts
   - Create GitHub issue for post-mortem
   - Schedule post-mortem meeting (within 48 hours)

5. **Thank the team:**
   ```
   Thank you to everyone who helped resolve this incident:
   - IC: @[name]
   - TL: @[name]
   - CL: @[name]
   - Also: @[names of others who helped]

   Post-mortem scheduled: [date/time]
   ```

**Time:** ~15 minutes

---

## Communication Protocols

### Internal Communication

**Primary channels:**
- **Slack #incidents:** All incident notifications and updates
- **Incident-specific channel:** `#incident-YYYY-MM-DD-description`
- **PagerDuty:** P0/P1 alerts to on-call engineer
- **Video call:** War room for P0 incidents

**Communication cadence:**
- **P0:** Continuous updates, status every 30 min
- **P1:** Status updates every 60 min
- **P2:** Updates every 4 hours if active work

**Message format:**
```
UPDATE [HH:MM] - [STATUS]

What we know: [Current understanding]
What we're doing: [Actions in progress]
What's next: [Planned next steps]
ETA next update: [timestamp]

IC: @[name]
```

---

### External Communication

#### Status Page Updates

**Location:** status.abyrith.com (Hosted on Statuspage.io or similar)

**Update template - Investigating:**
```
[Component Name] - Investigating

We are currently investigating reports of [issue description].
Users may experience [specific impact].

This incident affects: [list affected features]

Investigation started: [timestamp]
Next update: [timestamp + interval]
```

**Update template - Identified:**
```
[Component Name] - Identified

We have identified the issue causing [problem].
[Brief explanation of root cause].

We are implementing a fix and expect resolution within [timeframe].

Next update: [timestamp + interval]
```

**Update template - Monitoring:**
```
[Component Name] - Monitoring

A fix has been implemented and we are monitoring the results.
Early signs indicate the issue is resolved.

Next update: [timestamp + interval]
```

**Update template - Resolved:**
```
[Component Name] - Resolved

The incident has been fully resolved.

Root cause: [Brief explanation]
Resolution: [What was done]
Duration: [Total time from start to resolution]

We will publish a detailed post-mortem within 48 hours.
```

---

#### Customer Email Notifications

**When to send:**
- P0 incidents: Always (within 15 minutes)
- P1 incidents: If duration >1 hour or affects >50% of users
- P2/P3 incidents: Only if specifically requested

**Email template - Incident notification:**
```
Subject: [Abyrith] Service Disruption - [Brief description]

Hello,

We are currently experiencing [issue description] affecting [features/users].

What's happening:
[Detailed explanation of user impact]

What we're doing:
[Actions being taken]

Current status:
You can track real-time updates at https://status.abyrith.com

We apologize for any inconvenience and will keep you updated.

- The Abyrith Team
```

**Email template - Resolution:**
```
Subject: [Abyrith] Service Restored - [Brief description]

Hello,

The service disruption affecting [features] has been resolved.

Incident summary:
- Start time: [timestamp]
- End time: [timestamp]
- Duration: [total time]
- Root cause: [brief explanation]
- Resolution: [what was done]

What's next:
We will publish a detailed post-mortem within 48 hours outlining:
- Detailed timeline
- Root cause analysis
- Steps we're taking to prevent recurrence

Thank you for your patience.

- The Abyrith Team
```

---

#### Social Media Communication

**Platforms:**
- Twitter/X: @Abyrith
- LinkedIn: Abyrith Company Page

**When to post:**
- P0 incidents affecting all users
- P1 incidents with widespread impact (>50% users)
- Never for P2/P3

**Template:**
```
We're investigating reports of [issue]. Users may experience [impact].

Status updates: https://status.abyrith.com

[timestamp]
```

---

## Common Incidents & Resolutions

### Incident Type: Complete Platform Outage

**Symptoms:**
- All API requests returning 500/503 errors
- Users cannot access app.abyrith.com
- Monitoring shows 100% error rate

**Common causes:**
1. Cloudflare Workers deployment issue
2. Supabase database unavailable
3. DNS configuration error
4. SSL certificate expired

**Resolution steps:**

1. **Check Cloudflare status:**
   ```bash
   curl https://www.cloudflarestatus.com/api/v2/status.json
   ```

2. **Check Supabase status:**
   - Visit https://status.supabase.com/

3. **Test API endpoint directly:**
   ```bash
   curl -v https://api.abyrith.com/v1/health
   ```

4. **If Workers issue, rollback:**
   ```bash
   wrangler rollback [previous-deployment-id]
   ```

5. **If database issue:**
   - Check Supabase dashboard for alerts
   - Scale up instance if resource exhaustion
   - Contact Supabase support for infrastructure issues

6. **If DNS issue:**
   - Verify DNS records in Cloudflare dashboard
   - Check SSL certificate expiration
   - Flush Cloudflare cache if needed

**Average resolution time:** 30-60 minutes

**Severity:** P0

---

### Incident Type: High API Error Rate (>10%)

**Symptoms:**
- API returning errors intermittently
- Some requests succeed, others fail
- Monitoring shows elevated error rate

**Common causes:**
1. Database connection pool exhaustion
2. Rate limiting too aggressive
3. Third-party API (Claude, FireCrawl) timing out
4. Cloudflare Workers memory limits hit

**Resolution steps:**

1. **Check error types in Sentry:**
   - Filter by last 15 minutes
   - Group by error message
   - Identify most common error

2. **If database connection errors:**
   ```sql
   -- Check active connections
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;

   -- Check for long-running queries
   SELECT pid, now() - query_start as duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC;
   ```

3. **If rate limiting issue:**
   - Temporarily increase rate limits
   - Review legitimate traffic patterns
   - Block abusive IPs if identified

4. **If third-party timeout:**
   - Check status pages (status.anthropic.com, etc.)
   - Implement fallback/retry logic
   - Increase timeout values if needed

5. **If memory limits:**
   - Review Workers memory usage in dashboard
   - Optimize code to reduce memory footprint
   - Consider splitting into multiple Workers

**Average resolution time:** 1-2 hours

**Severity:** P1

---

### Incident Type: Authentication Failures

**Symptoms:**
- Users unable to log in
- JWT validation errors
- "Invalid token" errors

**Common causes:**
1. Supabase Auth service degraded
2. JWT signing key rotated unexpectedly
3. Session expiration logic bug
4. Clock skew between services

**Resolution steps:**

1. **Verify Supabase Auth status:**
   - Check https://status.supabase.com/
   - Test auth endpoint directly

2. **Test authentication flow:**
   ```bash
   curl -X POST https://[project-ref].supabase.co/auth/v1/token \
     -H "Content-Type: application/json" \
     -d '{"email":"test@abyrith.com","password":"TestPassword123!"}'
   ```

3. **Check JWT configuration:**
   - Verify JWT_SECRET environment variable
   - Confirm expiration times are reasonable
   - Check for clock skew issues

4. **Review recent auth changes:**
   ```bash
   git log --since="24 hours ago" --grep="auth" --oneline
   ```

5. **If Supabase issue, implement workaround:**
   - Queue login requests for retry
   - Display user-friendly error message
   - Monitor Supabase status for resolution

**Average resolution time:** 30-90 minutes

**Severity:** P0 (if all users affected) or P1 (if intermittent)

---

### Incident Type: AI Assistant Unresponsive

**Symptoms:**
- Chat interface not responding
- "Assistant unavailable" messages
- Timeouts on Claude API calls

**Common causes:**
1. Claude API rate limits hit
2. Anthropic service outage
3. Cloudflare Workers timeout
4. Invalid API key

**Resolution steps:**

1. **Check Claude API status:**
   - Visit https://status.anthropic.com/

2. **Test Claude API directly:**
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: $CLAUDE_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"test"}]}'
   ```

3. **Check rate limits:**
   - Review API usage in Anthropic dashboard
   - Check for unexpected traffic spike
   - Implement request queuing if needed

4. **Check Worker timeout:**
   - Workers have 50-second timeout on free plan, 15 min on paid
   - Review long-running AI requests
   - Implement streaming responses if needed

5. **If Anthropic outage:**
   - Display graceful error message to users
   - Disable AI Assistant temporarily
   - Monitor status page for resolution

**Average resolution time:** 15-60 minutes (faster if Anthropic issue)

**Severity:** P1

---

### Incident Type: Deployment Failure

**Symptoms:**
- Deployment pipeline fails during build or deploy
- Application not starting after deployment
- New deployment causing immediate errors
- Rollout stuck at 0% or partial completion
- Health checks failing after deployment

**Common causes:**
1. Broken code merged to main branch
2. Environment variable misconfiguration
3. Database migration failure
4. Dependency conflict or missing package
5. Build timeout or resource exhaustion
6. Invalid configuration in wrangler.toml or next.config.js

**Resolution steps:**

**Step 1: Assess deployment failure scope**

```bash
# Check GitHub Actions status
gh run list --limit 5

# View failed workflow details
gh run view [run-id]

# Check Cloudflare Workers deployment status
wrangler deployments list

# Check Cloudflare Pages deployment status
# Via Dashboard: https://dash.cloudflare.com/[account]/pages/[project]/deployments
```

**Step 2: Identify failure stage**

**If build failed:**
```bash
# Review build logs
gh run view [run-id] --log

# Common issues:
# - TypeScript compilation errors
# - Missing dependencies (check package.json)
# - Environment variable not set
# - Build timeout
```

**If deployment succeeded but app failing:**
```bash
# Check application logs
wrangler tail

# Check error rates in Sentry
# Open: https://sentry.io/organizations/abyrith/issues/?query=is:unresolved+release:[version]

# Test health endpoint
curl https://api.abyrith.com/v1/health
```

**Step 3: Decision point - Fix forward or rollback?**

**Rollback immediately if:**
- Complete outage affecting all users (P0)
- Unable to identify root cause within 15 minutes
- Fix requires significant code changes
- Database migration failed and needs manual intervention

**Fix forward if:**
- Root cause is obvious and quick fix available (<5 min)
- Only affects non-critical feature
- Hotfix already prepared and tested
- Rollback would cause data loss

**Step 4A: Rollback procedure (SAFE PATH)**

See detailed [Rollback Procedures](#rollback-procedures) section below.

**Step 4B: Fix forward procedure (FAST PATH)**

```bash
# 1. Create hotfix branch
git checkout -b hotfix/deployment-failure-[issue]

# 2. Make minimal fix
# - Fix only the breaking issue
# - Don't add new features
# - Test locally first

# 3. Fast-track review and merge
# - Create PR with [HOTFIX] prefix
# - Get immediate review from Engineering Lead
# - Override normal review process if P0

# 4. Deploy hotfix
# - GitHub Actions will auto-deploy on merge to main
# - Monitor deployment closely

# 5. Verify fix
curl https://api.abyrith.com/v1/health
# Check Sentry for new errors
# Test affected functionality manually
```

**Step 5: Post-deployment verification**

```bash
# Wait 5 minutes after deployment
# Monitor key metrics:

# 1. Error rate (should be <1%)
# Check Sentry dashboard

# 2. Response times (p95 <200ms)
# Check Cloudflare Analytics

# 3. User reports
# Check #support channel and support queue

# 4. Health checks passing
curl https://api.abyrith.com/v1/health
curl https://app.abyrith.com/api/health
```

**Step 6: Document and learn**

```bash
# Create incident report
# File: 10-operations/incidents/reports/YYYY-MM-DD-deployment-failure.md

# Key questions:
# - What broke?
# - Why did it pass CI/CD but fail in production?
# - What tests would have caught this?
# - How can we prevent this in the future?
```

**Common deployment failure scenarios:**

**Scenario 1: Environment variable missing**
```bash
# Symptom: "Cannot read environment variable FOO" error

# Fix:
# 1. Add to GitHub Secrets
# 2. Update wrangler.toml with new variable
# 3. Re-deploy
```

**Scenario 2: Database migration failed**
```bash
# Symptom: Migration error in deployment logs

# Fix:
# 1. STOP - Do not rollback code without rolling back migration
# 2. Check Supabase migration status
# 3. If migration partially applied:
#    - Manually complete migration OR
#    - Write rollback migration
# 4. If migration failed completely:
#    - Fix migration SQL
#    - Re-deploy

# WARNING: Never rollback code if migration changed schema
# The old code won't work with the new schema
```

**Scenario 3: Dependency conflict**
```bash
# Symptom: "Cannot find module" or version conflict errors

# Fix:
# 1. Delete node_modules and package-lock.json
# 2. Run: pnpm install
# 3. Test locally
# 4. Commit lockfile changes
# 5. Re-deploy
```

**Scenario 4: Cloudflare Workers size limit exceeded**
```bash
# Symptom: "Worker size exceeds limit" during deploy

# Quick fix:
# 1. Check bundle size: wrangler deploy --dry-run
# 2. Options:
#    a) Split into multiple Workers
#    b) Remove unused dependencies
#    c) Enable tree-shaking
#    d) Move large data to KV storage

# Long-term: Implement bundle size monitoring in CI
```

**Average resolution time:** 15-45 minutes (rollback) or 30-90 minutes (fix forward)

**Severity:** P0 (if production down) or P1 (if partial degradation)

---

### Incident Type: Database Performance Degradation

**Symptoms:**
- Slow API response times
- Database query timeouts
- High CPU usage on database

**Common causes:**
1. Missing indexes on frequently queried columns
2. N+1 query problem in code
3. Large table scans
4. Autovacuum not running
5. Connection pool exhaustion

**Resolution steps:**

1. **Identify slow queries:**
   ```sql
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. **Check missing indexes:**
   ```sql
   SELECT schemaname, tablename, attname, n_distinct
   FROM pg_stats
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY n_distinct DESC;
   ```

3. **Analyze table bloat:**
   ```sql
   SELECT schemaname, tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

4. **Quick fixes:**
   - Add missing indexes (be careful, can lock table)
   - Kill long-running queries
   - Scale up database instance temporarily
   - Enable query result caching in Workers KV

5. **Long-term fixes (post-incident):**
   - Optimize queries
   - Implement pagination
   - Add database read replicas
   - Review and optimize RLS policies

**Average resolution time:** 2-4 hours

**Severity:** P1 or P2 (depending on severity of degradation)

---

### Incident Type: Secret Encryption/Decryption Failures

**Symptoms:**
- Users unable to decrypt secrets
- "Decryption failed" errors
- Secrets showing as garbled text

**Common causes:**
1. Master key derivation issue
2. Nonce/IV collision (rare but critical)
3. Database corruption
4. Client-side encryption library bug

**CRITICAL: This is a potential security incident**

**Immediate actions:**

1. **STOP: Do not dismiss this quickly**
   - This could indicate encryption key compromise
   - Treat as potential security incident until proven otherwise

2. **Collect information:**
   - How many users affected?
   - What secrets are affected?
   - When did it start?
   - Any recent code changes to encryption logic?

3. **Check encryption implementation:**
   - Review Web Crypto API usage
   - Verify PBKDF2 parameters unchanged
   - Confirm AES-256-GCM mode correct
   - Check nonce generation (must be unique!)

4. **Test encryption/decryption:**
   ```typescript
   // In browser console (test environment!)
   const testData = "test secret";
   const encrypted = await encryptSecret(testData, masterKey);
   const decrypted = await decryptSecret(encrypted, masterKey);
   console.log(decrypted === testData); // Should be true
   ```

5. **If database corruption:**
   - Restore from most recent backup
   - Assess data loss scope
   - Communicate immediately with affected users

6. **If confirmed security issue:**
   - Follow security incident runbook immediately
   - Notify security lead
   - Potentially force password reset for all users

**Average resolution time:** 1-4 hours (or longer if security breach)

**Severity:** P0 (treat as security incident until proven otherwise)

---

## Rollback Procedures

### Overview

This section provides detailed rollback procedures for different components of the Abyrith platform. Rollbacks should be executed when a deployment causes issues that cannot be quickly fixed forward.

**General rollback principles:**
- **Speed over perfection:** Rollback first, investigate later
- **Document everything:** Record all actions taken
- **Communicate proactively:** Update status page and team
- **Verify thoroughly:** Test before declaring rollback complete
- **Learn from it:** Every rollback is a learning opportunity

---

### When to Rollback vs. Fix Forward

**Rollback decision matrix:**

| Scenario | Rollback | Fix Forward |
|----------|----------|-------------|
| Complete platform outage (P0) | ✅ Yes | ❌ No |
| Root cause unknown after 15 min | ✅ Yes | ❌ No |
| Database migration failed | ⚠️ Maybe* | ⚠️ Maybe* |
| Single feature broken, workaround exists | ❌ No | ✅ Yes |
| Fix is obvious and takes <5 min | ❌ No | ✅ Yes |
| Security vulnerability | ⚠️ Case-by-case** | ⚠️ Case-by-case** |

*Database rollback is complex - see [Database Migration Rollback](#database-migration-rollback) below

**Security vulnerabilities require special handling - see security incident runbook

---

### Frontend Rollback (Cloudflare Pages)

**Estimated time:** 5-10 minutes

**Steps:**

1. **Access Cloudflare Pages dashboard:**
   ```
   https://dash.cloudflare.com/[account-id]/pages/view/[project-name]
   ```

2. **Identify last known good deployment:**
   - Navigate to "Deployments" tab
   - Find the last successful deployment before the problematic one
   - Note the deployment ID and timestamp

3. **Rollback to previous deployment:**
   ```
   Option A: Via Cloudflare Dashboard (RECOMMENDED)
   1. Click on the deployment to rollback to
   2. Click "Rollback to this deployment" button
   3. Confirm the action

   Option B: Via Wrangler CLI
   # Note: Pages doesn't support direct CLI rollback
   # Must re-deploy previous commit
   git log --oneline -n 10  # Find previous commit
   git checkout [previous-commit-sha]
   git push origin HEAD:main --force  # Triggers new deployment
   ```

4. **Monitor rollback progress:**
   - Watch deployment status in Cloudflare Dashboard
   - Should complete in 2-3 minutes
   - Check deployment logs for any errors

5. **Verify frontend is working:**
   ```bash
   # Clear your browser cache or use incognito
   # Test homepage
   curl -I https://app.abyrith.com
   # Expected: 200 OK

   # Test app loads
   # Open: https://app.abyrith.com in browser
   # Verify: Login page loads correctly

   # Test key user flows:
   # - Login works
   # - Dashboard loads
   # - Can view secrets list
   ```

6. **Verify assets serving correctly:**
   ```bash
   # Check static assets
   curl -I https://app.abyrith.com/_next/static/chunks/main.js
   # Expected: 200 OK

   # Check no caching issues
   # Add ?v=test query param to bypass cache
   curl https://app.abyrith.com/?v=rollback-test
   ```

7. **Update team:**
   ```
   UPDATE: Frontend rolled back to deployment [ID]
   Status: Monitoring
   Deployment: [previous-deployment-id]
   Commit: [commit-sha]
   Time: [timestamp]
   ```

---

### Backend Rollback (Cloudflare Workers)

**Estimated time:** 5-10 minutes

**Steps:**

1. **List recent Worker deployments:**
   ```bash
   # View deployment history
   wrangler deployments list

   # Output shows:
   # Created     Version ID    Message
   # 2025-10-30  abc123def     Deploy commit: fix auth bug
   # 2025-10-29  xyz789ghi     Deploy commit: add new feature
   ```

2. **Identify deployment to rollback to:**
   ```bash
   # Choose the last known good deployment
   # Look for deployment before the problematic one
   # Note the Version ID
   ```

3. **Execute rollback:**
   ```bash
   # Rollback to specific deployment
   wrangler rollback --message "Rolling back due to incident [P0/P1]"

   # Wrangler will prompt to select a deployment
   # Select the last known good version

   # Or rollback to specific version ID:
   wrangler rollback [version-id]
   ```

4. **Verify rollback:**
   ```bash
   # Check current active deployment
   wrangler deployments list

   # Test API health endpoint
   curl https://api.abyrith.com/v1/health
   # Expected: {"status":"ok","version":"[previous-version]"}

   # Test authentication
   curl -X POST https://api.abyrith.com/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@abyrith.com","password":"test123"}'
   # Expected: 200 OK with access token
   ```

5. **Verify Workers KV (if applicable):**
   ```bash
   # Check KV namespace is accessible
   wrangler kv:key get --namespace-id=[id] "test-key"

   # If KV data was modified, may need to restore:
   # WARNING: KV doesn't have automatic rollback
   # You must have backup or re-populate data
   ```

6. **Monitor error rates:**
   ```bash
   # Check Sentry for errors after rollback
   # Open: https://sentry.io/organizations/abyrith/issues/?query=is:unresolved

   # Check Cloudflare Analytics
   # Ensure error rate drops below 1%
   ```

7. **Update team:**
   ```
   UPDATE: Workers API rolled back
   Status: Monitoring
   Version: [version-id]
   Commit: [commit-sha]
   Error rate: [current-rate]%
   Response time: [p95-latency]ms
   ```

---

### Database Migration Rollback

**⚠️ CRITICAL: Database rollbacks are HIGH RISK**

**Estimated time:** 15-60 minutes (varies by complexity)

**IMPORTANT WARNINGS:**
- **Data loss risk:** Rolling back migrations can cause data loss
- **Code compatibility:** Old code may not work with new schema
- **Coordination required:** Must rollback code AND database together
- **Test in staging first:** If possible, test rollback in staging environment

---

**Pre-rollback checklist:**

- [ ] **Backup database immediately** (see backup procedure below)
- [ ] **Identify which migration failed** (check Supabase logs)
- [ ] **Determine if migration partially applied** (some tables created?)
- [ ] **Check for data written to new schema** (would be lost on rollback)
- [ ] **Coordinate with team** (ensure no one is deploying code)
- [ ] **Notify users** (if downtime required)

---

**Scenario 1: Migration failed completely (nothing applied)**

This is the SAFEST rollback scenario.

```sql
-- 1. Verify migration status
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;

-- 2. If migration not recorded, you're safe
-- Just fix the migration and re-deploy

-- 3. If migration recorded but failed, remove record:
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '[failed-migration-version]';

-- 4. Fix the migration SQL
-- 5. Re-deploy with corrected migration
```

---

**Scenario 2: Migration partially applied (some changes made)**

This requires MANUAL intervention.

```bash
# 1. Backup database IMMEDIATELY
supabase db dump --file backup-before-rollback.sql

# 2. Identify what was created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%new_%';  -- Look for new tables

# 3. Write rollback migration
# Create file: supabase/migrations/YYYYMMDDHHMMSS_rollback_broken_migration.sql
```

**Example rollback migration:**
```sql
-- Rollback migration: [description of what went wrong]
-- Original migration: [version-number]
-- Date: 2025-10-30

BEGIN;

-- Drop tables created by failed migration
DROP TABLE IF EXISTS new_feature_table CASCADE;

-- Drop columns added by failed migration
ALTER TABLE existing_table
DROP COLUMN IF EXISTS new_column;

-- Restore indexes that were dropped
CREATE INDEX IF NOT EXISTS idx_existing_column
ON existing_table(existing_column);

-- Restore RLS policies that were changed
-- (copy from previous migration)

COMMIT;
```

```bash
# 4. Apply rollback migration
supabase db push

# 5. Verify schema state
supabase db diff

# 6. Test application with rolled-back schema
```

---

**Scenario 3: Migration succeeded but code doesn't work with new schema**

**This is MOST DANGEROUS - old code may be incompatible with new schema.**

**Decision point:**
1. **Can you fix the code quickly (<10 min)?** → Fix code forward
2. **Is new schema additive only (no breaking changes)?** → Fix code forward
3. **Did schema remove or modify existing columns?** → May need full rollback

**If full rollback required:**

```bash
# 1. CRITICAL: Stop all API servers immediately
# This prevents writes to new schema that would be lost

# 2. Backup database
supabase db dump --file backup-before-rollback.sql

# 3. Option A: Point-in-time recovery (PITR) - BEST option if available
# Restore database to state before migration
# Supabase Pro: Restore from automated backups
# Supabase Free: PITR not available, use manual backup

# 4. Option B: Manual rollback
# Write reverse migration (see Scenario 2 above)

# 5. Rollback code to before migration
git log --grep="migration" --oneline -n 5
git revert [migration-commit]
git push origin main

# 6. Deploy rollback (code + database)
# Ensure deployment is synchronized

# 7. Verify everything works
curl https://api.abyrith.com/v1/health
# Test critical functionality
```

---

**Post-database-rollback actions:**

```bash
# 1. Verify data integrity
SELECT count(*) FROM critical_table;
# Compare with pre-rollback count

# 2. Check for orphaned data
# Query for foreign key violations
# Query for data that references non-existent records

# 3. Run application tests
# Especially tests related to rolled-back feature

# 4. Monitor closely for 24 hours
# Watch for any delayed side effects

# 5. Document what went wrong
# Update migration with lessons learned
# Add tests to catch issue in future
```

---

### Environment Variable Rollback

**Estimated time:** 2-5 minutes

If a deployment failed due to incorrect environment variables:

```bash
# 1. Access environment variable management

# For Cloudflare Workers:
# Dashboard: https://dash.cloudflare.com/[account]/workers/services/[worker]/settings/variables

# For GitHub Secrets:
# https://github.com/[org]/[repo]/settings/secrets/actions

# 2. Identify what changed
git log --oneline -n 5 | grep -i "env\|secret\|config"

# 3. Revert environment variable
# Option A: Via Cloudflare Dashboard
# - Navigate to Workers > Settings > Variables
# - Find the incorrect variable
# - Update to previous value
# - Click "Save"

# Option B: Via Wrangler
# Edit wrangler.toml, then:
wrangler deploy

# 4. Verify application restarts with correct variables
wrangler tail
# Watch for startup logs confirming correct config

# 5. Test affected functionality
curl https://api.abyrith.com/v1/[affected-endpoint]
```

---

### Dependency Rollback (Package Downgrade)

**Estimated time:** 10-20 minutes

If a dependency update caused issues:

```bash
# 1. Identify problematic dependency
git diff HEAD~1 package.json

# 2. Check npm registry for previous version
npm view [package-name] versions --json

# 3. Downgrade to previous version
pnpm remove [package-name]
pnpm add [package-name]@[previous-version]

# 4. Test locally
pnpm run dev
# Test affected functionality

# 5. Commit and deploy
git add package.json pnpm-lock.yaml
git commit -m "Rollback [package-name] to [version] due to [issue]"
git push origin main

# 6. Monitor deployment
gh run list --limit 1

# 7. Verify in production
curl https://api.abyrith.com/v1/health
```

---

### Complete System Rollback (Nuclear Option)

**⚠️ EXTREME SCENARIO: Use only when all else fails**

**Estimated time:** 30-60 minutes

**When to use:**
- Multiple components failing simultaneously
- Unknown root cause affecting entire platform
- Cascading failures across services
- Data corruption detected

**Steps:**

```bash
# 1. STOP: Get Engineering Lead approval first
# This is a major operation with high risk

# 2. Notify all stakeholders immediately
# Post in #incidents: "EXECUTING FULL SYSTEM ROLLBACK"

# 3. Create snapshot of current broken state
# For forensics and post-mortem analysis
supabase db dump --file snapshot-broken-state.sql
git log -1 --format="%H %s" > broken-commit.txt

# 4. Identify last known good state (LKG)
# When was the last time everything worked?
git log --since="24 hours ago" --oneline
# Find commit before problems started

# 5. Rollback in reverse dependency order

# Step 5a: Rollback frontend (least risky)
# Cloudflare Pages dashboard → Rollback to LKG deployment

# Step 5b: Rollback backend API (medium risk)
wrangler rollback [lkg-version-id]

# Step 5c: Rollback database (HIGHEST RISK - last resort)
# See Database Migration Rollback section above
# Consider if database rollback is truly necessary
# Can old code work with current schema?

# 6. Verify each component after rollback
curl https://app.abyrith.com
curl https://api.abyrith.com/v1/health

# 7. Manual smoke testing
# - Login works
# - Can view secrets
# - Can create secret
# - Can update secret
# - Can delete secret

# 8. Monitor for 30 minutes before declaring success
# Watch error rates
# Watch user reports
# Check support queue

# 9. Incident Commander declares resolution
# Or escalates if rollback didn't fix issue
```

---

### Rollback Verification Checklist

After ANY rollback, verify these before declaring success:

**Automated checks:**
- [ ] All health endpoints return 200 OK
- [ ] Error rate <1% (check Sentry)
- [ ] API response times within SLA (p95 <200ms)
- [ ] Database connections healthy
- [ ] No alerts firing

**Manual checks:**
- [ ] Login flow works
- [ ] Dashboard loads
- [ ] Secrets list displays
- [ ] Can decrypt a secret
- [ ] Can create a new secret
- [ ] Team collaboration features work
- [ ] AI Assistant responds (if applicable)

**Monitoring checks:**
- [ ] No new errors in Sentry
- [ ] Cloudflare Analytics shows normal traffic
- [ ] Supabase metrics within normal range
- [ ] User feedback is positive (no new complaints)

**Communication checks:**
- [ ] Status page updated to "Operational"
- [ ] Team notified in #incidents channel
- [ ] Customers notified if they were alerted to incident
- [ ] Post-mortem scheduled

---

### Rollback Failure - What to Do

If rollback doesn't fix the issue or makes things worse:

**DO:**
1. **Stop and reassess** - Don't keep rolling back randomly
2. **Call for help** - Escalate to Engineering Lead immediately
3. **Gather data** - What changed after rollback?
4. **Consider forward fix** - Maybe rollback wasn't the answer
5. **Check dependencies** - Third-party services down?

**DON'T:**
1. ❌ Keep trying different rollback combinations
2. ❌ Rollback without understanding why it failed
3. ❌ Make changes without documenting them
4. ❌ Assume rollback will always work

**Escalation path:**
```
Rollback failed → Engineering Lead (immediate)
                → Consider external help (Cloudflare, Supabase support)
                → Possible service degradation mode
                → Communicate honestly with users
```

---

## Post-Incident Process

### Immediate Post-Incident (Within 1 hour of resolution)

1. **Ensure monitoring is stable:**
   - All metrics back to normal
   - No new alerts firing
   - Extended monitoring period (1-2 hours)

2. **Collect all incident data:**
   - Chat logs from incident channel
   - Screenshots of dashboards during incident
   - Error logs and stack traces
   - Timeline of events with timestamps
   - List of all actions taken

3. **Create incident report document:**
   - Template: See [Post-Mortem Template](#post-mortem-template)
   - Location: `10-operations/incidents/reports/YYYY-MM-DD-incident-name.md`
   - Assign: Incident Commander

4. **Schedule post-mortem meeting:**
   - When: Within 48 hours (sooner for P0)
   - Who: All involved team members + stakeholders
   - Duration: 60-90 minutes
   - Send calendar invite with incident report draft

---

### Post-Mortem Meeting (Within 48 hours)

**Purpose:** Learn from the incident and prevent recurrence.

**Agenda:**

1. **Incident timeline (10 min):**
   - Walk through what happened, when
   - Review detection to resolution timeline
   - Note any delays or blockers

2. **Root cause analysis (20 min):**
   - What was the underlying cause?
   - Why did it happen?
   - Five Whys technique:
     - Why did X happen? Because Y.
     - Why did Y happen? Because Z.
     - (Continue 5 times to reach root cause)

3. **What went well (10 min):**
   - What did we do right?
   - What helped us resolve it quickly?
   - What should we keep doing?

4. **What went wrong (15 min):**
   - What slowed us down?
   - What could have prevented this?
   - Where did our processes fail?

5. **Action items (20 min):**
   - Preventive measures
   - Process improvements
   - Monitoring/alerting gaps
   - Documentation updates
   - Assign owners and deadlines

6. **Communication review (5 min):**
   - Was communication effective?
   - Were customers informed properly?
   - What can we improve?

**Rules for post-mortem:**
- **Blameless:** No finger-pointing, focus on systems and processes
- **Constructive:** What can we do better?
- **Actionable:** Every insight becomes a concrete action item
- **Honest:** Safe space to discuss what really happened

---

### Post-Mortem Document Finalization (Within 1 week)

1. **Incorporate meeting feedback:**
   - Update draft post-mortem with discussion points
   - Add action items with owners and deadlines
   - Include any additional data or analysis

2. **Review and approve:**
   - Engineering Lead reviews
   - Product Lead reviews (for customer-facing impacts)
   - Security Lead reviews (if security-related)

3. **Publish:**
   - Internal: Share in #engineering Slack channel
   - External: Publish sanitized version to status page (optional, for P0/P1)
   - File: Save in `10-operations/incidents/reports/`

4. **Track action items:**
   - Create GitHub issues for each action item
   - Link to post-mortem document
   - Assign to owners with due dates
   - Add to sprint planning

---

## Post-Mortem Template

```markdown
---
Document: Post-Mortem - [Brief Incident Description]
Version: 1.0.0
Date: YYYY-MM-DD
Severity: [P0/P1/P2/P3]
Incident Commander: [Name]
Author: [Name]
Status: [Draft/Final]
---

# Post-Mortem: [Incident Description]

## Incident Summary

**Date:** YYYY-MM-DD
**Duration:** [HH:MM] to [HH:MM] ([X] hours [Y] minutes)
**Severity:** [P0/P1/P2/P3]
**Impact:** [Brief description of user impact]

**Quick summary:** [2-3 sentence overview of what happened]

---

## Impact

**Users affected:** [Number or percentage]

**Services affected:**
- [Service 1]: [Impact description]
- [Service 2]: [Impact description]

**Business impact:**
- [Revenue impact, if applicable]
- [Customer trust impact]
- [Data loss, if any]

---

## Timeline (All times in UTC)

| Time | Event |
|------|-------|
| HH:MM | [First signs of issue detected] |
| HH:MM | [Alert fired] |
| HH:MM | [Incident acknowledged] |
| HH:MM | [Severity classified as PX] |
| HH:MM | [Response team assembled] |
| HH:MM | [Status page updated] |
| HH:MM | [Root cause identified] |
| HH:MM | [Fix implemented] |
| HH:MM | [Service restored] |
| HH:MM | [Incident closed] |

**Total time to detect:** [X] minutes
**Total time to resolve:** [X] hours [Y] minutes

---

## Root Cause

**What happened:**
[Detailed technical explanation of what caused the incident]

**Why it happened:**
[Five Whys analysis]
1. Why did [symptom] happen? Because [reason 1].
2. Why did [reason 1] happen? Because [reason 2].
3. Why did [reason 2] happen? Because [reason 3].
4. Why did [reason 3] happen? Because [reason 4].
5. Why did [reason 4] happen? Because [ROOT CAUSE].

**Root cause:** [The ultimate underlying cause]

---

## Detection

**How we detected the issue:**
[How the incident was first identified - alert, user report, etc.]

**Time to detect:** [X] minutes after issue started

**What worked well:**
- [Detection mechanism that worked]

**What could be improved:**
- [Gaps in monitoring or alerting]

---

## Resolution

**Actions taken:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**What worked well:**
- [Effective resolution steps]

**What could be improved:**
- [What slowed down resolution]

---

## What Went Well

- [Thing 1 that worked well]
- [Thing 2 that worked well]
- [Thing 3 that worked well]

---

## What Went Wrong

- [Thing 1 that didn't work or could be better]
- [Thing 2 that didn't work or could be better]
- [Thing 3 that didn't work or could be better]

---

## Action Items

### Immediate (This week)

- [ ] [Action item 1] - Owner: [Name] - Due: [Date]
- [ ] [Action item 2] - Owner: [Name] - Due: [Date]

### Short-term (This month)

- [ ] [Action item 3] - Owner: [Name] - Due: [Date]
- [ ] [Action item 4] - Owner: [Name] - Due: [Date]

### Long-term (This quarter)

- [ ] [Action item 5] - Owner: [Name] - Due: [Date]
- [ ] [Action item 6] - Owner: [Name] - Due: [Date]

---

## Lessons Learned

**Key takeaways:**
1. [Lesson 1]
2. [Lesson 2]
3. [Lesson 3]

**Process improvements:**
- [Improvement 1]
- [Improvement 2]

**Technical improvements:**
- [Improvement 1]
- [Improvement 2]

---

## Appendix

### Supporting Data

[Include relevant graphs, logs, screenshots]

### Related Issues

- GitHub Issue: [Link]
- Sentry Error: [Link]
- Slack Thread: [Link]

---

**This post-mortem was conducted in accordance with our blameless post-mortem culture. The goal is to learn and improve, not to assign blame.**
```

---

## On-Call Rotation

### On-Call Schedule

**Rotation type:** Weekly rotation (Monday 00:00 UTC to Sunday 23:59 UTC)

**Current rotation:**
- Week 1: [Engineer 1] (Primary), [Engineer 2] (Secondary)
- Week 2: [Engineer 3] (Primary), [Engineer 1] (Secondary)
- Week 3: [Engineer 2] (Primary), [Engineer 3] (Secondary)
- [Continues rotating]

**View schedule:** [Link to PagerDuty schedule]

---

### On-Call Responsibilities

**Primary on-call:**
- Respond to all P0/P1/P2 alerts within SLA
- Become Incident Commander by default
- Triage and classify incidents
- Assemble response team if needed
- Ensure handoff notes are documented

**Secondary on-call:**
- Backup if primary doesn't respond within 15 minutes
- Support primary during P0 incidents
- Take over if primary becomes unavailable

**Engineering Lead:**
- Automatically escalation point for P0 incidents
- Available for complex technical decisions
- Can override IC if needed

---

### On-Call Best Practices

**Before your shift:**
- [ ] Verify PagerDuty notifications working (test page)
- [ ] Review recent incidents and ongoing issues
- [ ] Ensure you have access to all required systems
- [ ] Read handoff notes from previous on-call

**During your shift:**
- [ ] Respond to alerts promptly within SLA
- [ ] Document all significant events
- [ ] Keep incident channel updated
- [ ] Ask for help if needed (no hero culture)
- [ ] Take breaks during long incidents

**After your shift:**
- [ ] Write handoff notes for next on-call
- [ ] Ensure all incidents closed or handed off
- [ ] Update any runbooks based on experience
- [ ] Follow up on action items from your incidents

---

### On-Call Compensation

**Policy:**
- On-call stipend: $[amount] per week
- Incident response: Additional compensation for time spent (>1 hour)
- Time off in lieu: Can take comp time after major incidents
- No expectation to work 24/7: reasonable response times within SLA

---

## Escalation Paths

### Escalation Criteria

**When to escalate:**
- Primary on-call not responding within 15 minutes
- Incident severity higher than on-call comfortable handling
- Incident requires specialized knowledge
- Incident duration exceeds 2 hours without progress
- Security incident or data breach
- Need approval for high-risk mitigation (e.g., database restore)

---

### Escalation Chain

```
P3 Incident:
Primary On-Call → (if no progress in 4 hours) → Engineering Lead

P2 Incident:
Primary On-Call → (if no progress in 2 hours) → Engineering Lead

P1 Incident:
Primary On-Call → (if no progress in 1 hour) → Engineering Lead → (if needed) → CTO

P0 Incident:
Primary On-Call → Engineering Lead (immediately) → All hands → (if needed) → CTO/CEO

Security Incident:
Primary On-Call → Engineering Lead + Security Lead (immediately) → CTO
```

---

### Contact Information

| Role | Name | Primary Contact | Secondary Contact | Escalation Time |
|------|------|----------------|-------------------|-----------------|
| Primary On-Call | [Rotation] | PagerDuty | Slack DM | N/A |
| Engineering Lead | [Name] | [Phone] | [Email] | 15 min |
| Security Lead | [Name] | [Phone] | [Email] | Immediate (P0) |
| Product Lead | [Name] | [Slack] | [Email] | 30 min |
| CTO | [Name] | [Phone] | [Email] | 1 hour (P0/P1 only) |

**Emergency contacts:** Stored in 1Password shared vault "On-Call Contacts"

---

## Dependencies

### Technical Dependencies

**Must exist before effective incident response:**
- [ ] `10-operations/monitoring/monitoring-alerting.md` - How to set up alerts
- [ ] `10-operations/deployment/deployment-runbook.md` - Rollback procedures
- [ ] `10-operations/database/maintenance-runbook.md` - Database operations

**Related runbooks:**
- `10-operations/security/security-incident-response.md` - Security-specific incidents
- `10-operations/deployment/rollback-procedures.md` - How to rollback deployments

### System Dependencies

**Required access:**
- Cloudflare Dashboard (Workers, Pages, Analytics)
- Supabase Dashboard (Database, Auth, Logs)
- Sentry (Error tracking)
- PagerDuty (Alert management)
- GitHub (Code deployments, Actions)
- Status page admin (Statuspage.io or equivalent)
- Team Slack with admin permissions

---

## References

### Internal Documentation

- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - All technologies used
- `10-operations/monitoring/monitoring-alerting.md` - Monitoring setup
- `GLOSSARY.md` - Technical terminology

### External Resources

- [Cloudflare Status](https://www.cloudflarestatus.com/)
- [Supabase Status](https://status.supabase.com/)
- [Anthropic Status](https://status.anthropic.com/)
- [GitHub Status](https://www.githubstatus.com/)
- [PagerDuty Incident Response Guide](https://response.pagerduty.com/)
- [Google SRE Book - Incident Management](https://sre.google/sre-book/managing-incidents/)

### Incident History

**Major incidents for reference:**
- [Link to previous post-mortems in `10-operations/incidents/reports/`]

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1.0 | 2025-10-30 | DevOps Team | Added comprehensive deployment failure procedures, detailed rollback procedures for all components, database migration rollback scenarios, and updated dependencies |
| 1.0.0 | 2025-10-30 | Engineering Lead | Initial incident response playbook |

---

## Notes

### Continuous Improvement

This runbook should be updated:
- After every major incident (P0/P1)
- Quarterly review of procedures
- When new services/tools are added
- When escalation contacts change

**Next review date:** 2026-01-30

### Cultural Principles

**Remember:**
- **Blameless culture:** Focus on systems, not individuals
- **Psychological safety:** Safe to report issues and mistakes
- **Continuous learning:** Every incident is a learning opportunity
- **User-centric:** Always prioritize user impact and communication
- **Team support:** No heroes, ask for help

---

**Remember: The best incident is the one that never happens. Focus on prevention, monitoring, and graceful degradation.**
