---
Document: Security Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Security Team
Status: Draft
Dependencies: 03-security/security-model.md, 03-security/threat-model.md, 10-operations/incidents/incident-response.md
---

# Security Operations Runbook

## Overview

This runbook provides operational procedures for maintaining security controls, responding to security incidents, rotating credentials, conducting security audits, and ensuring compliance for the Abyrith secrets management platform. All procedures are designed to maintain zero-knowledge encryption while enabling enterprise-grade security operations.

**Purpose:** Define repeatable security operations procedures to maintain platform security, ensure compliance, and respond effectively to security events.

**Frequency:** Various (detailed per procedure)

**Estimated Time:** 15 minutes to 8 hours (depending on procedure)

**Risk Level:** Critical (security operations directly impact platform trust)

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Security Incident Classification](#security-incident-classification)
4. [Security Incident Response](#security-incident-response)
5. [Secrets Rotation Procedures](#secrets-rotation-procedures)
6. [Security Audit Procedures](#security-audit-procedures)
7. [Vulnerability Disclosure Process](#vulnerability-disclosure-process)
8. [Access Review Procedures](#access-review-procedures)
9. [Compliance Monitoring](#compliance-monitoring)
10. [Security Tooling Setup](#security-tooling-setup)
11. [Post-Procedure](#post-procedure)
12. [Communication](#communication)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- A security incident has been detected (alert, user report, security scan)
- Scheduled secrets rotation is due (API keys, database credentials)
- Quarterly security audit is scheduled
- Security vulnerability disclosure is received
- Access review is required (user role changes, departures)
- Compliance audit preparation is needed (SOC 2, GDPR, ISO 27001)
- Security tooling needs to be configured or updated
- New security controls need to be implemented
- Security metrics need to be reviewed

**Do NOT use this runbook when:**
- General operational incidents (use `10-operations/incidents/incident-response.md`)
- Non-security deployments (use `10-operations/deployment/deployment-runbook.md`)
- Database performance issues (use `10-operations/database/database-maintenance.md`)

### Scope

**What this covers:**
- Security incident detection and response
- Credential rotation (infrastructure, not user secrets)
- Security audits and assessments
- Vulnerability management
- Access control reviews
- Compliance reporting and monitoring
- Security tooling configuration

**What this does NOT cover:**
- User password resets (see user documentation)
- General application incidents (see incident response runbook)
- Customer support issues (see support procedures)
- Feature deployments (see deployment runbook)

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Cloudflare Dashboard - Admin access (Workers, Pages, DNS, Analytics)
- [ ] Supabase Dashboard - Owner access (Database, Auth, Settings)
- [ ] GitHub Repository - Admin access (Secrets, Actions, Settings)
- [ ] Sentry - Admin access (if using for error tracking)
- [ ] Production Secrets Vault - Admin access (1Password, LastPass, or Bitwarden team vault)

**Credentials:**
- [ ] Cloudflare API token with Workers and Pages permissions
- [ ] Supabase service role key
- [ ] GitHub Personal Access Token (PAT) with admin:org scope
- [ ] 2FA device for critical operations
- [ ] PGP key for vulnerability disclosure (if established)

**How to request access:**
Contact Security Lead with business justification. Access requires approval from Engineering Lead and adherence to principle of least privilege.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
node --version    # Should be 20.x or higher
pnpm --version    # Should be 8.x or higher
git --version     # Should be 2.40 or higher
wrangler --version  # Cloudflare Workers CLI
supabase --version  # Supabase CLI (optional)
```

**Installation:**
```bash
# If tools are missing
brew install node@20
npm install -g pnpm
brew install git
pnpm install -g wrangler
pnpm install -g supabase
```

**Security scanning tools:**
```bash
# Optional but recommended
brew install nmap
pnpm install -g snyk
pnpm install -g npm-audit
```

### Required Knowledge

**You should understand:**
- Zero-knowledge encryption architecture (see `03-security/security-model.md`)
- Threat model and attack vectors (see `03-security/threat-model.md`)
- Incident response procedures (see `10-operations/incidents/incident-response.md`)
- RLS policies and database security (see `03-security/rbac/rls-policies.md`)
- Compliance requirements (SOC 2, GDPR, ISO 27001)

**Reference documentation:**
- `03-security/security-model.md` - Zero-knowledge architecture
- `03-security/threat-model.md` - Threat analysis
- `10-operations/incidents/incident-response.md` - Incident workflows
- `TECH-STACK.md` - Technology stack

---

## Security Incident Classification

**Severity Levels:**

### P0 - Critical Security Incident

**Definition:** Immediate threat to zero-knowledge guarantee, active data breach, or mass secret exposure

**Examples:**
- Server-side decryption capability discovered
- Cross-tenant data leakage confirmed
- Master password database compromised
- Active ongoing attack with data exfiltration
- XSS vulnerability allowing master key theft

**Response Time:** Immediate (< 15 minutes)

**Escalation:** Security Lead, Engineering Lead, CEO

**Actions:**
1. Invoke security incident response (see [Security Incident Response](#security-incident-response))
2. Notify entire security team immediately
3. Consider emergency maintenance mode
4. Prepare for public disclosure

---

### P1 - High Security Incident

**Definition:** Significant security vulnerability or confirmed unauthorized access to limited data

**Examples:**
- RLS policy bypass discovered
- Single-user account compromise with secret access
- Authentication bypass vulnerability
- Database backup theft (encrypted data)
- Critical dependency vulnerability (actively exploited)

**Response Time:** < 1 hour

**Escalation:** Security Lead, Engineering Lead

**Actions:**
1. Invoke security incident response
2. Assess scope and impact
3. Implement immediate containment
4. Schedule post-mortem

---

### P2 - Medium Security Event

**Definition:** Security issue requiring attention but no confirmed breach

**Examples:**
- DDoS attack affecting availability
- Suspicious activity detected (no confirmed breach)
- Minor vulnerability discovered (no active exploit)
- Failed login attempts pattern
- Security scan finding (medium severity)

**Response Time:** < 4 hours

**Escalation:** Security Lead

**Actions:**
1. Investigate and assess risk
2. Implement mitigation if needed
3. Document in security log
4. Schedule review in next security sync

---

### P3 - Low Security Event

**Definition:** Security observation or minor issue with no immediate risk

**Examples:**
- Dependency vulnerability with no exploit
- Cosmetic security issue (missing header)
- Security configuration improvement opportunity
- Security awareness training needed

**Response Time:** < 24 hours

**Escalation:** None (track in backlog)

**Actions:**
1. Document in security backlog
2. Address in next sprint if appropriate
3. No immediate action required

---

## Security Incident Response

### Overview

Security incidents follow the general incident response workflow defined in `10-operations/incidents/incident-response.md` with additional security-specific procedures.

**See full incident response procedures:** `10-operations/incidents/incident-response.md`

### Security-Specific Incident Procedures

**For detailed step-by-step procedures, see:** `10-operations/incidents/incident-response.md`

This runbook focuses on security-specific aspects:

1. **Incident Classification** - Use severity levels above
2. **Containment** - Block malicious IPs, revoke sessions, enable maintenance mode
3. **Evidence Preservation** - Export audit logs, capture database state
4. **Impact Assessment** - Identify affected users and data
5. **User Protection** - Force logout, temporarily disable accounts
6. **System Hardening** - Update WAF rules, enable rate limiting, verify RLS policies
7. **Post-Incident** - Documentation, communication, compliance reporting

**Key Security Controls:**
- Zero-knowledge encryption (secrets remain encrypted even if database compromised)
- Row-Level Security policies (prevent cross-tenant access)
- Audit logging (comprehensive activity tracking)
- Rate limiting (prevent brute force attacks)
- Content Security Policy (prevent XSS attacks)

---

## Secrets Rotation Procedures

### Overview

This section covers rotation of **infrastructure secrets** (API keys, database credentials, service tokens), **NOT user secrets** (those are managed by users via the Abyrith platform).

**Frequency:** Quarterly (minimum) or immediately after suspected compromise

**Estimated Time:** 1-3 hours (depending on number of secrets)

**Risk Level:** High (incorrect rotation can cause service outage)

---

### Procedure 1: Rotate Cloudflare API Tokens

**When:** Quarterly or if token suspected compromised

**Purpose:** Limit exposure window for Cloudflare API tokens used in CI/CD and operations

#### Pre-Flight Checklist

- [ ] Identify all services using the current token (GitHub Actions, local development, scripts)
- [ ] Ensure you have backup access to Cloudflare Dashboard
- [ ] Schedule during low-traffic window (if possible)
- [ ] Notify team of rotation in advance

#### Steps

**Step 1: Generate New Token** (~2 minutes)

```bash
# Via Cloudflare Dashboard
# 1. Go to: My Profile → API Tokens → Create Token
# 2. Use "Edit Cloudflare Workers" template
# 3. Set permissions:
#    - Workers Scripts: Edit
#    - Account Settings: Read
#    - Zone: Read
# 4. Set IP filtering (optional): Restrict to CI/CD and office IPs
# 5. Set TTL: 1 year
# 6. Copy token immediately (shown once)
```

**Step 2: Update GitHub Secrets** (~3 minutes)

```bash
# Via GitHub CLI:
gh secret set CLOUDFLARE_API_TOKEN --body "${NEW_CLOUDFLARE_TOKEN}" \
  --repo abyrith/platform

# Verify secret was updated
gh secret list --repo abyrith/platform | grep CLOUDFLARE
```

**Step 3: Update Local Development** (~5 minutes)

```bash
# Update .env.local (do NOT commit this file)
sed -i '' "s/CLOUDFLARE_API_TOKEN=.*/CLOUDFLARE_API_TOKEN=${NEW_TOKEN}/" .env.local

# Update team password manager (1Password, LastPass, etc.)
# Manually add new token to shared vault
```

**Step 4: Verify New Token Works** (~10 minutes)

```bash
# Test token locally
wrangler whoami --env production

# Test deployment to staging
git checkout main
git pull
git checkout -b test/token-rotation
git commit --allow-empty -m "Test: Verify new Cloudflare token"
git push origin test/token-rotation

# Monitor GitHub Actions run
gh run watch
```

**Step 5: Revoke Old Token** (~2 minutes)

```bash
# Via Cloudflare Dashboard
# My Profile → API Tokens → [Old Token] → Revoke
```

**Success Criteria:**
- [ ] New token works in all environments
- [ ] CI/CD pipelines deploy successfully
- [ ] Old token revoked
- [ ] Team password manager updated
- [ ] No authentication errors in logs

---

### Procedure 2: Rotate Supabase Service Role Key

**When:** Quarterly or if key suspected compromised

**Purpose:** Rotate the service role key used by Cloudflare Workers to access Supabase

**⚠️ WARNING:** This is a high-risk operation. Service outage will occur if not done carefully.

#### Pre-Flight Checklist

- [ ] Schedule maintenance window (announce to users)
- [ ] Backup current key in secure vault
- [ ] Identify all services using the key (Workers, Edge Functions, scripts)
- [ ] Prepare rollback plan

#### Steps

**Step 1: Create New Service Role Key** (~1 minute)

```bash
# Via Supabase Dashboard:
# Project Settings → API → Service role key → Reset

# ⚠️ WARNING: This immediately invalidates the old key!
# Only proceed if you can update Workers immediately

# Copy new key (shown once)
```

**Step 2: Update Cloudflare Workers Secrets** (~5 minutes - CRITICAL TO DO QUICKLY)

```bash
# Update secret in Cloudflare Workers
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production

# Paste new key when prompted

# Deploy Workers with new secret
pnpm run deploy:production
```

**Step 3: Verify Service Restored** (~5 minutes)

```bash
# Test API endpoint
curl -H "Authorization: Bearer ${TEST_JWT}" \
  https://api.abyrith.com/api/secrets

# Should return 200 OK and user's secrets

# Check Worker logs for errors
wrangler tail --env production
```

**Step 4: Update Backup Systems** (~5 minutes)

```bash
# Update team password manager
# Store new key in shared vault

# Update GitHub Secrets (if used for CI/CD database access)
gh secret set SUPABASE_SERVICE_ROLE_KEY \
  --body "${NEW_SERVICE_ROLE_KEY}" \
  --repo abyrith/platform
```

---

### Procedure 3: Rotate GitHub Personal Access Tokens

**When:** Quarterly or if token suspected compromised

**Purpose:** Rotate PATs used for CI/CD and automation

#### Steps

**Step 1: Generate New PAT** (~5 minutes)

```bash
# Via GitHub Web UI:
# Settings → Developer settings → Personal access tokens → Fine-grained tokens
# → Generate new token

# Set permissions:
# - Repository: Read and Write
# - Actions: Read and Write
# - Secrets: Read and Write (if managing secrets)

# Set expiration: 90 days (force quarterly rotation)

# Copy token (shown once)
```

**Step 2: Update CI/CD** (~5 minutes)

```bash
# Update GitHub Actions secrets
gh secret set GITHUB_TOKEN --body "${NEW_GITHUB_PAT}" \
  --repo abyrith/platform

# Test CI/CD pipeline
git commit --allow-empty -m "Test: Verify new GitHub PAT"
git push

# Monitor Actions run
gh run watch
```

**Step 3: Revoke Old PAT** (~2 minutes)

```bash
# Via GitHub Web UI:
# Settings → Developer settings → Personal access tokens
# → [Old token] → Delete

# Verify old token no longer works
curl -H "Authorization: token ${OLD_PAT}" \
  https://api.github.com/user

# Should return 401 Unauthorized
```

**Success Criteria:**
- [ ] New PAT works in CI/CD
- [ ] Old PAT revoked
- [ ] No failed Actions runs

---

### Secret Rotation Schedule

| Secret | Rotation Frequency | Last Rotated | Next Rotation | Owner |
|--------|-------------------|--------------|---------------|-------|
| Cloudflare API Token | Quarterly | YYYY-MM-DD | YYYY-MM-DD | DevOps |
| Supabase Service Role Key | Quarterly | YYYY-MM-DD | YYYY-MM-DD | Backend |
| GitHub PAT | Quarterly | YYYY-MM-DD | YYYY-MM-DD | DevOps |
| Sentry DSN | Annually | YYYY-MM-DD | YYYY-MM-DD | DevOps |
| Claude API Key | Bi-annually | YYYY-MM-DD | YYYY-MM-DD | Backend |
| FireCrawl API Key | Bi-annually | YYYY-MM-DD | YYYY-MM-DD | Backend |

---

## Security Audit Procedures

### Overview

Regular security audits ensure platform security posture remains strong and compliant.

**Frequency:** Quarterly (internal), Annually (external)

**Estimated Time:** 4-8 hours (internal), 1-2 weeks (external)

---

### Procedure 1: Quarterly Internal Security Audit

**When:** First week of each quarter (Q1: January, Q2: April, Q3: July, Q4: October)

**Purpose:** Identify security gaps and verify controls are working

#### Audit Checklist

**1. Access Control Review** (~1 hour)

```bash
# Review Cloudflare access
# Dashboard → Account → Members
# Verify all members have appropriate roles

# Review Supabase access
# Dashboard → Settings → Team

# Review GitHub access
# Settings → Manage access
```

**2. RLS Policy Verification** (~2 hours)

```sql
-- Test RLS policies in production
-- Via Supabase SQL Editor:

-- Test 1: User cannot access other users' secrets
SET request.jwt.claim.sub = 'user_a_id';
SELECT * FROM secrets WHERE user_id = 'user_b_id';
-- Should return 0 rows

-- Test 2: User can access own secrets
SELECT * FROM secrets WHERE user_id = 'user_a_id';
-- Should return user A's secrets
```

**3. Dependency Vulnerability Scan** (~1 hour)

```bash
# Frontend dependencies
cd frontend
pnpm audit
pnpm audit --json > audit_report_$(date +%Y%m%d).json

# Backend dependencies (Workers)
cd workers
pnpm audit

# Alternative: Use Snyk
snyk test --all-projects
```

**4. Security Headers Verification** (~30 minutes)

```bash
# Check security headers on production
curl -I https://app.abyrith.com | grep -i "security\|x-frame\|content-security"

# Expected headers:
# - Strict-Transport-Security
# - X-Content-Type-Options
# - X-Frame-Options
# - Content-Security-Policy
```

**5. Audit Log Review** (~1 hour)

```sql
-- Review audit logs for suspicious activity

-- Failed login attempts
SELECT user_id, ip_address, COUNT(*) as attempts
FROM audit_logs
WHERE action = 'auth.failed_login'
  AND created_at >= now() - interval '7 days'
GROUP BY user_id, ip_address
HAVING COUNT(*) > 5
ORDER BY attempts DESC;

-- Rapid secret access (potential exfiltration)
SELECT user_id, COUNT(*) as secret_accesses
FROM audit_logs
WHERE action = 'secret.read'
  AND created_at >= now() - interval '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 50
ORDER BY secret_accesses DESC;
```

**6. Encryption Verification** (~30 minutes)

```sql
-- Verify secrets are encrypted in database
SELECT
  id,
  service_name,
  substring(encrypted_value::text, 1, 50) as encrypted_value_preview,
  length(encrypted_value) as ciphertext_length
FROM secrets
LIMIT 10;

-- Verify nonces are unique
SELECT nonce, COUNT(*) as usage_count
FROM secrets
GROUP BY nonce
HAVING COUNT(*) > 1;
-- Should return 0 rows (no nonce reuse)
```

---

### Procedure 2: Annual External Security Audit

**When:** Once per year (typically Q4 for SOC 2 alignment)

**Purpose:** Independent verification of security controls for compliance

**Estimated Time:** 1-2 weeks (external auditor time) + 1-2 weeks (preparation)

**Steps:**
1. Select auditor (Trail of Bits, NCC Group, Cure53, Bishop Fox)
2. Prepare documentation package
3. Conduct internal pre-audit
4. External auditor testing (1-2 weeks)
5. Findings review and remediation
6. Final report

**See:** `03-security/threat-model.md` for detailed audit procedures

---

## Vulnerability Disclosure Process

### Overview

Handle security vulnerability reports from external researchers responsibly and promptly.

**Estimated Time:** Varies (1 hour to 1 week depending on severity)

---

### Procedure: Handle Vulnerability Disclosure

**Step 1: Receive Report** (0-1 hour)

- Acknowledge receipt immediately (within 1 hour)
- Assign report ID: SEC-YYYYMMDD-NNN
- Do not disclose publicly until fixed

**Step 2: Triage and Assess** (1-4 hours)

- Attempt to reproduce vulnerability
- Assess severity using CVSS v3.1
- Determine if valid and in scope

**Step 3: Fix Development** (1 hour to 1 week)

- Develop patch
- Test thoroughly
- Security review

**Step 4: Coordinated Disclosure** (7-90 days from report)

- Agree on disclosure timeline with reporter
- Deploy fix to production
- Publish security advisory

**Step 5: Post-Disclosure**

- Update threat model
- Implement preventive controls
- Thank reporter publicly (if disclosed)
- Bug bounty payment (if program exists)

---

### Vulnerability Disclosure Policy

**Publish to:** `https://abyrith.com/security` and `.well-known/security.txt`

```
# Abyrith Security Policy

Email: security@abyrith.com

We commit to:
- Acknowledgment within 1 business day
- Assessment within 48 hours
- Regular updates every 5 business days
- 90-day disclosure deadline
```

---

## Access Review Procedures

### Overview

Regular access reviews ensure only authorized personnel have access to sensitive systems.

**Frequency:** Quarterly

**Estimated Time:** 2-3 hours

---

### Procedure: Quarterly Access Review

**When:** First week of each quarter

**Purpose:** Verify access levels are appropriate and remove stale access

#### Steps

**Step 1: Inventory Current Access** (~1 hour)

```bash
# Export GitHub collaborators
gh api /repos/abyrith/platform/collaborators \
  --jq '.[] | [.login, .role_name] | @csv'

# Export Cloudflare members
# Via Dashboard → Account → Members → Export

# Export Supabase team
# Via Dashboard → Settings → Team
```

**Step 2: Review Access Appropriateness** (~1 hour)

For each user, verify:
- Still with company/team?
- Role requires this access?
- Access level appropriate? (least privilege)
- Accessed recently? (last 90 days)

**Step 3: Implement Access Changes** (~30 minutes)

```bash
# Revoke GitHub access
gh api -X DELETE /repos/abyrith/platform/collaborators/USERNAME

# Revoke Cloudflare access (via Dashboard)
# Revoke Supabase access (via Dashboard)
```

**Step 4: Verify Changes** (~30 minutes)

Confirm removed users cannot access systems

**Step 5: Report to Leadership** (~30 minutes)

Create executive summary of access review results

---

## Compliance Monitoring

### Overview

Continuous monitoring of compliance posture for SOC 2, GDPR, and ISO 27001.

**Frequency:** Continuous (automated alerts) + Monthly review

**Estimated Time:** 2-4 hours per month

---

### Procedure: Monthly Compliance Review

**When:** First Monday of each month

**Purpose:** Ensure compliance requirements are met and documented

#### SOC 2 Compliance

- [ ] Security controls operational (RLS, audit logs, encryption)
- [ ] Availability > 99.9% uptime
- [ ] Confidentiality (zero-knowledge verified)
- [ ] Processing integrity (input validation)
- [ ] Privacy (GDPR compliance)

#### GDPR Compliance

- [ ] Data subject rights supported (access, deletion, portability)
- [ ] Consent obtained for data processing
- [ ] Data protection by design (zero-knowledge)
- [ ] Breach notification procedure ready (72-hour timeline)

#### ISO 27001 Compliance

- [ ] Information security policy documented
- [ ] Risk assessment completed
- [ ] Security controls implemented (Annex A)
- [ ] Internal audits conducted
- [ ] Management review completed

---

## Security Tooling Setup

### Overview

Configure security scanning and monitoring tools for continuous security validation.

**Frequency:** One-time setup + ongoing maintenance

**Estimated Time:** 4-8 hours (initial setup)

---

### Procedure 1: Configure Dependabot (~30 minutes)

```bash
# Create .github/dependabot.yml
cat > .github/dependabot.yml << EOF
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    reviewers:
      - "engineering-team"
    labels:
      - "dependencies"
      - "security"
EOF

git add .github/dependabot.yml
git commit -m "Configure Dependabot for automated dependency updates"
git push origin main
```

---

### Procedure 2: Configure Snyk (~1 hour)

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test project
snyk test

# Monitor continuously
snyk monitor

# Integrate with GitHub
# Snyk → Integrations → GitHub → Connect
```

---

### Procedure 3: Configure CodeQL (~30 minutes)

```bash
# Create .github/workflows/codeql-analysis.yml
cat > .github/workflows/codeql-analysis.yml << EOF
name: "CodeQL"

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 1'

jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [ 'javascript', 'typescript' ]
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    - name: Initialize CodeQL
      uses: github/codeql-action/init@v2
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2
EOF
```

---

### Procedure 4: Configure OWASP ZAP (~1 hour)

```bash
# Create .github/workflows/zap-scan.yml
cat > .github/workflows/zap-scan.yml << EOF
name: OWASP ZAP Scan

on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM
  workflow_dispatch:

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'https://staging.abyrith.com'
EOF
```

---

### Procedure 5: Configure Sentry (~1 hour)

```bash
# Install Sentry SDK
pnpm add @sentry/nextjs

# Initialize Sentry
npx @sentry/wizard@latest -i nextjs

# Add Sentry DSN to environment variables
gh secret set NEXT_PUBLIC_SENTRY_DSN --body "${SENTRY_DSN}" \
  --repo abyrith/platform
```

---

## Post-Procedure

### Cleanup

**After any security procedure:**
```bash
# 1. Archive logs and reports
mkdir -p 10-operations/security/archives/$(date +%Y)
mv *_report_*.* 10-operations/security/archives/$(date +%Y)/

# 2. Clear temporary access

# 3. Update documentation

# 4. Verify systems are operational
curl -I https://app.abyrith.com/api/health
```

### Documentation

**Update these documents:**
- [ ] This security runbook (if procedures changed)
- [ ] `03-security/threat-model.md` (if new threats identified)
- [ ] `03-security/security-model.md` (if controls updated)
- [ ] Compliance evidence folder (add reports)

### Communication

**Notify:**
- [ ] Security team: Procedure completed successfully
- [ ] Engineering team (if affects development workflow)
- [ ] Leadership (monthly compliance report)

### Monitoring

**Increased monitoring period:**
- Monitor for 24-48 hours after security changes
- Watch for unusual activity patterns
- Set up temporary alerts for sensitive operations

---

## Communication

### Security Incident Notification to Users

```
Subject: Security Incident Notification - Action Required

Dear [User Name],

We are writing to inform you of a security incident affecting your Abyrith account.

What happened:
[Brief description]

What information was affected:
[Specific data]

What we've done:
- [Action 1]
- [Action 2]

What you should do:
1. Change your master password immediately
2. Rotate all secrets stored in Abyrith
3. Review your audit logs
4. Enable two-factor authentication

For questions: security@abyrith.com

Abyrith Security Team
```

---

## Dependencies

### Technical Dependencies

**Must exist before using this runbook:**
- [x] `03-security/security-model.md` - Zero-knowledge architecture
- [x] `03-security/threat-model.md` - Threat analysis
- [x] `10-operations/incidents/incident-response.md` - Incident procedures

**Related Documentation:**
- `03-security/rbac/rls-policies.md` - Row-level security policies
- `04-database/database-overview.md` - Database architecture
- `TECH-STACK.md` - Technology stack

### Security Tools Required

**For Operations:**
- Cloudflare Dashboard access
- Supabase Dashboard access
- GitHub admin access
- Secrets vault access

**For Scanning:**
- Dependabot (GitHub built-in)
- Snyk (optional, recommended)
- CodeQL (GitHub Advanced Security)
- OWASP ZAP (GitHub Actions)
- Sentry (error tracking)

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge architecture
- `03-security/threat-model.md` - Comprehensive threat analysis
- `10-operations/incidents/incident-response.md` - Incident response procedures
- `TECH-STACK.md` - Technology specifications

### External Resources

**Security Standards:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

**Compliance:**
- [SOC 2 Trust Services Criteria](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report)
- [GDPR Official Text](https://gdpr.eu/)
- [ISO/IEC 27001:2013](https://www.iso.org/standard/54534.html)

**Tools:**
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Snyk Documentation](https://docs.snyk.io/)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
- [Sentry Documentation](https://docs.sentry.io/)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Security Team | Initial security runbook covering incident classification, response procedures, secrets rotation, security audits, vulnerability disclosure, access reviews, compliance monitoring, and security tooling setup |

---

## Notes

### Future Enhancements

**Phase 2 (Post-MVP):**
- Automated compliance dashboard (Vanta, Drata)
- Bug bounty program launch
- Automated secrets rotation for infrastructure
- Real-time security metrics dashboard

**Phase 3 (Enterprise):**
- SOC 2 Type II certification
- ISO 27001 certification
- Penetration testing automation
- Security awareness training program

### Review Schedule

- **Weekly:** Review security alerts and vulnerabilities
- **Monthly:** Compliance monitoring and reporting
- **Quarterly:** Access reviews, security audits, secrets rotation
- **Annually:** External security audit, penetration testing

---

**Security is everyone's responsibility. If you see something suspicious, report it immediately to security@abyrith.com.**
