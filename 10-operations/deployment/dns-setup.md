---
Document: DNS Setup and Configuration - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: DevOps Team
Status: Draft
Dependencies: TECH-STACK.md, 10-operations/deployment/deployment-pipeline.md
---

# DNS Setup and Configuration Operations Runbook

## Overview

This runbook documents the procedures for configuring DNS settings for the Abyrith platform using Cloudflare DNS. It covers custom domain setup, SSL/TLS certificate configuration, and subdomain configuration for different environments (staging and production).

**Purpose:** Provide step-by-step instructions for setting up and verifying DNS configuration for Cloudflare Pages deployment.

**Frequency:** Once per domain, occasional updates for new subdomains or configuration changes.

**Estimated Time:** 30-45 minutes for initial setup, 10-15 minutes for subsequent changes.

**Risk Level:** Medium - Incorrect DNS configuration can cause service outages, but changes are easily reversible.

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
- Setting up a new custom domain for the first time
- Adding a new environment subdomain (e.g., staging.abyrith.com)
- Migrating from one domain registrar to another
- Troubleshooting DNS resolution issues
- Updating SSL/TLS certificate configuration
- Adding or modifying DNS records for verification

**Do NOT use this runbook when:**
- Making changes to application code or deployment pipeline
- Modifying Cloudflare Workers configuration
- Changing database connection strings
- The domain is not yet registered (complete domain registration first)

### Scope

**What this covers:**
- Cloudflare DNS zone setup
- A and CNAME record configuration
- TXT record setup for domain verification
- SSL/TLS certificate provisioning
- Subdomain configuration (staging, api, etc.)
- DNS propagation verification

**What this does NOT cover:**
- Domain registration process
- Email DNS configuration (MX records)
- CDN configuration beyond DNS
- Application-level routing

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Cloudflare account - Full Administrator access
- [ ] Domain registrar account - DNS management permissions
- [ ] Cloudflare Pages project - Project admin access
- [ ] GitHub repository - Read access (for deployment verification)

**Credentials:**
- [ ] Cloudflare account credentials (email + password + 2FA)
- [ ] Domain registrar credentials
- [ ] API tokens (if using Cloudflare API)

**How to request access:**
If you don't have access to Cloudflare or the domain registrar:
1. Contact the DevOps lead or engineering manager
2. Request specific role: "Cloudflare DNS Administrator"
3. Provide justification and expected duration of access
4. Complete security training if required

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
dig --version      # Should be installed on macOS/Linux
nslookup --version # Alternative to dig (Windows)
curl --version     # Should be 7.0+ or higher
```

**Installation:**
```bash
# macOS (dig and curl are pre-installed)
# If dig is missing:
brew install bind

# Linux (Ubuntu/Debian)
sudo apt-get install dnsutils curl

# Windows
# dig is not native, use nslookup instead
# Or install Windows Subsystem for Linux (WSL)
```

**Optional but helpful:**
- Browser with developer tools (Chrome, Firefox, Safari)
- DNS propagation checker: https://www.whatsmydns.net/
- SSL checker: https://www.ssllabs.com/ssltest/

### Required Knowledge

**You should understand:**
- Basic DNS concepts (A records, CNAME records, TXT records, nameservers)
- How DNS propagation works (TTL, caching)
- SSL/TLS certificate basics
- Cloudflare Pages deployment architecture

**Reference documentation:**
- `TECH-STACK.md` - Cloudflare DNS and Pages specifications
- `10-operations/deployment/deployment-pipeline.md` - Deployment workflow
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication
- [ ] Notify team in #engineering Slack channel
- [ ] Create maintenance ticket: [Ticket system - Linear/GitHub Issues]
- [ ] Update status page (if customer-facing): https://status.abyrith.com
- [ ] Inform team of expected downtime window (if any)

### 2. Backup
- [ ] Document current DNS configuration
  ```bash
  # Export current DNS records
  dig abyrith.com ANY +noall +answer > dns-backup-$(date +%Y%m%d).txt
  ```
- [ ] Take screenshots of current Cloudflare DNS settings
- [ ] Save current nameserver configuration
- [ ] Verify backup timestamp and contents

### 3. Environment Check
- [ ] Verify domain is registered and not expiring soon
  ```bash
  whois abyrith.com | grep -i "expiry\|expiration"
  ```
- [ ] Check current DNS provider and nameservers
  ```bash
  dig abyrith.com NS +short
  ```
- [ ] Verify Cloudflare Pages project exists and is deployed
- [ ] Check no ongoing deployments or maintenance

### 4. Timing
- [ ] Confirm low-traffic period (if changing production DNS)
- [ ] Verify maintenance window (recommended: off-peak hours)
- [ ] Coordinate with dependent teams (if applicable)
- [ ] Allow 24-48 hours for full DNS propagation

### 5. Preparation
- [ ] Read through entire runbook
- [ ] Prepare rollback plan (save old nameservers)
- [ ] Have Cloudflare support contact ready (if enterprise plan)
- [ ] Prepare communication templates (see Communication section)

---

## Procedure

### Step 1: Add Domain to Cloudflare

**Purpose:** Create a DNS zone in Cloudflare for your domain.

**Commands:**
```bash
# No command-line step - use Cloudflare Dashboard
```

**Manual Steps:**
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click "Add a Site" in the top navigation
3. Enter your domain name (e.g., `abyrith.com`)
4. Select plan: "Free" for staging, "Pro" or higher for production
5. Click "Add Site"

**Expected output:**
- Cloudflare will scan existing DNS records automatically
- You'll see a list of detected DNS records
- Cloudflare will provide you with 2 nameservers (e.g., `elena.ns.cloudflare.com`, `shane.ns.cloudflare.com`)

**Important notes:**
- ⚠️ **Do NOT change nameservers at registrar yet** - complete DNS record setup first
- ℹ️ Cloudflare will auto-import existing DNS records, but verify them
- ℹ️ Save the Cloudflare nameservers for Step 3

**Time:** ~5 minutes

---

### Step 2: Configure DNS Records

**Purpose:** Set up the necessary DNS records for Cloudflare Pages deployment.

**2a. Add A Record for Root Domain**

Navigate to DNS settings in Cloudflare Dashboard:
- Go to "DNS" tab in your Cloudflare site
- Click "Add record"

**Configuration:**
- **Type:** `A`
- **Name:** `@` (represents root domain)
- **IPv4 address:** See Cloudflare Pages custom domain settings for IP
  - Typically: Check your Cloudflare Pages project → "Custom domains" for the IP
  - Or use: This will be provided by Cloudflare Pages when you add custom domain
- **Proxy status:** ✅ Proxied (orange cloud icon)
- **TTL:** Auto

**Verification command:**
```bash
# This will only work after nameservers are changed (Step 3)
# For now, just save the configuration
```

---

**2b. Add CNAME Record for www Subdomain**

**Configuration:**
- **Type:** `CNAME`
- **Name:** `www`
- **Target:** `@` (or your root domain: `abyrith.com`)
- **Proxy status:** ✅ Proxied (orange cloud icon)
- **TTL:** Auto

**Purpose:** Redirect www.abyrith.com to abyrith.com

---

**2c. Add CNAME Record for Staging Subdomain**

**Configuration:**
- **Type:** `CNAME`
- **Name:** `staging`
- **Target:** Your Cloudflare Pages staging deployment URL
  - Format: `<project-name>.pages.dev`
  - Example: `abyrith-staging.pages.dev`
- **Proxy status:** ✅ Proxied (recommended) or ☁️ DNS only
- **TTL:** Auto

**Purpose:** Point staging.abyrith.com to staging environment

---

**2d. Add CNAME Record for API Subdomain (Optional)**

If you have a separate API deployment:

**Configuration:**
- **Type:** `CNAME`
- **Name:** `api`
- **Target:** Your Cloudflare Workers custom domain or Pages URL
  - Example: `api.abyrith.com` → `abyrith-api.workers.dev`
- **Proxy status:** ✅ Proxied
- **TTL:** Auto

**Purpose:** Route API traffic to separate Workers deployment

---

**2e. Add TXT Record for Domain Verification**

Some services require TXT record verification (e.g., Google Search Console, email providers).

**Configuration:**
- **Type:** `TXT`
- **Name:** `@` (or specific subdomain)
- **Content:** Verification string from the service
  - Example: `google-site-verification=ABC123...`
- **TTL:** Auto

**Purpose:** Verify domain ownership for external services

---

**Expected output:**
You should now see these DNS records in your Cloudflare DNS dashboard:
```
Type    Name      Content                          Proxy Status
A       @         <Cloudflare Pages IP>            Proxied
CNAME   www       abyrith.com                      Proxied
CNAME   staging   abyrith-staging.pages.dev        Proxied
CNAME   api       abyrith-api.workers.dev          Proxied (optional)
TXT     @         google-site-verification=...     DNS only
```

**If something goes wrong:**
- **Error: "Record already exists"** → Delete the duplicate and re-add
- **Error: "Invalid target"** → Verify the target domain is correct and accessible

**Time:** ~10 minutes

---

### Step 3: Update Nameservers at Domain Registrar

**Purpose:** Point your domain to Cloudflare's nameservers to activate DNS management.

**⚠️ CRITICAL: Save your current nameservers before making changes!**

**Backup current nameservers:**
```bash
# Document current nameservers
dig abyrith.com NS +short > nameservers-backup-$(date +%Y%m%d).txt
cat nameservers-backup-$(date +%Y%m%d).txt
```

**Manual Steps:**
1. Log in to your domain registrar (e.g., Namecheap, GoDaddy, Google Domains)
2. Navigate to domain management for `abyrith.com`
3. Find "Nameservers" or "DNS" settings
4. Change from "Default Nameservers" to "Custom Nameservers"
5. Replace existing nameservers with Cloudflare's nameservers:
   ```
   elena.ns.cloudflare.com
   shane.ns.cloudflare.com
   ```
   (Use the exact nameservers provided by Cloudflare in Step 1)
6. Save changes

**Expected output:**
- Registrar confirms nameserver change
- Warning: "Changes may take 24-48 hours to propagate"

**Verification:**
```bash
# Check nameservers (may take 5-30 minutes to update)
dig abyrith.com NS +short

# Expected output:
# elena.ns.cloudflare.com.
# shane.ns.cloudflare.com.
```

**Important notes:**
- ⚠️ **DNS propagation can take up to 48 hours**, but typically completes in 5-30 minutes
- ℹ️ During propagation, some users may see old DNS, others new DNS
- ℹ️ Lower TTL values before making changes to speed up propagation (do this 24 hours in advance if possible)

**Time:** ~5 minutes (plus propagation time: 5 minutes - 48 hours)

---

### Step 4: Add Custom Domain to Cloudflare Pages

**Purpose:** Connect your custom domain to the Cloudflare Pages project.

**Manual Steps:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → "Workers & Pages"
2. Select your Pages project (e.g., `abyrith-production`)
3. Navigate to "Custom domains" tab
4. Click "Set up a custom domain"
5. Enter your domain: `abyrith.com`
6. Click "Continue"
7. Cloudflare will verify DNS records and provision SSL certificate

**Expected output:**
- Status: "Active" with green checkmark
- SSL certificate status: "Active"
- Certificate type: "Universal SSL" or "Advanced Certificate Manager" (if on paid plan)

**For www subdomain:**
1. Click "Set up a custom domain" again
2. Enter: `www.abyrith.com`
3. Cloudflare will automatically configure it

**For staging subdomain:**
1. Go to staging Pages project (e.g., `abyrith-staging`)
2. Repeat the same process for `staging.abyrith.com`

**Time:** ~10 minutes (SSL provisioning may take an additional 5-15 minutes)

---

### Step 5: Configure SSL/TLS Settings

**Purpose:** Ensure secure HTTPS connections with proper SSL/TLS configuration.

**Navigate to SSL/TLS settings:**
1. Cloudflare Dashboard → Select your site
2. Go to "SSL/TLS" in the left sidebar

**5a. Set SSL/TLS Encryption Mode**

**Configuration:**
- **Mode:** "Full (strict)" (recommended for production)
- **Why:** Ensures end-to-end encryption between users and origin server

**Options:**
- **Off:** Not encrypted (never use)
- **Flexible:** Encrypts traffic between visitor and Cloudflare only (not recommended)
- **Full:** Encrypts end-to-end, but doesn't validate certificate (acceptable for staging)
- **Full (strict):** Encrypts end-to-end with valid certificate (production)

**Set to "Full (strict)":**
```
SSL/TLS encryption mode: Full (strict)
```

---

**5b. Enable Always Use HTTPS**

**Configuration:**
- Navigate to "SSL/TLS" → "Edge Certificates"
- Toggle "Always Use HTTPS" to **On**
- This redirects all HTTP requests to HTTPS

**Verification:**
```bash
# Test HTTP redirect
curl -I http://abyrith.com

# Expected output:
# HTTP/1.1 301 Moved Permanently
# Location: https://abyrith.com/
```

---

**5c. Enable HTTP Strict Transport Security (HSTS)**

**Configuration:**
- Navigate to "SSL/TLS" → "Edge Certificates"
- Scroll to "HTTP Strict Transport Security (HSTS)"
- Click "Enable HSTS"
- **Settings:**
  - Max Age Header: 6 months (15768000 seconds)
  - Apply HSTS policy to subdomains: ✅ On
  - Preload: ✅ On (after testing)
  - No-Sniff Header: ✅ On

**⚠️ WARNING:** HSTS is irreversible during the max-age period. Test thoroughly before enabling!

**Recommended approach:**
1. Start with short max-age: 1 day (86400 seconds)
2. Test for 1 week
3. Gradually increase: 1 week → 1 month → 6 months

---

**5d. Set Minimum TLS Version**

**Configuration:**
- Navigate to "SSL/TLS" → "Edge Certificates"
- Set "Minimum TLS Version": **TLS 1.2** (recommended) or **TLS 1.3**
- Modern browsers support TLS 1.3, but TLS 1.2 has wider compatibility

**Verification:**
```bash
# Check TLS version support
openssl s_client -connect abyrith.com:443 -tls1_2

# Expected: Successful connection
```

---

**5e. Enable Automatic HTTPS Rewrites**

**Configuration:**
- Navigate to "SSL/TLS" → "Edge Certificates"
- Toggle "Automatic HTTPS Rewrites" to **On**
- This automatically changes HTTP links to HTTPS in HTML

**Time:** ~10 minutes

---

### Step 6: Configure Advanced DNS Settings

**Purpose:** Optimize DNS performance and security.

**6a. Enable DNSSEC**

DNSSEC adds cryptographic signatures to DNS records to prevent DNS spoofing.

**Configuration:**
1. Navigate to "DNS" → "Settings"
2. Find "DNSSEC" section
3. Click "Enable DNSSEC"
4. Copy the DS record information provided
5. Add DS record to your domain registrar

**DS Record format:**
```
Key Tag: 2371
Algorithm: 13 (ECDSAP256SHA256)
Digest Type: 2 (SHA-256)
Digest: [long hex string]
```

**At domain registrar:**
1. Log in to domain registrar
2. Find "DNSSEC" or "DNS Security" settings
3. Add the DS record provided by Cloudflare
4. Save changes

**Verification:**
```bash
# Check DNSSEC status
dig abyrith.com +dnssec

# Expected: RRSIG records present in response
```

**⚠️ Note:** Not all registrars support DNSSEC. If not available, skip this step.

---

**6b. Set DNS CAA Records (Optional but Recommended)**

CAA records specify which Certificate Authorities can issue certificates for your domain.

**Configuration:**
- **Type:** `CAA`
- **Name:** `@`
- **Tag:** `issue`
- **Value:** `letsencrypt.org` (for Let's Encrypt)
- **Flag:** 0

**Add additional CAA record for wildcard:**
- **Type:** `CAA`
- **Name:** `@`
- **Tag:** `issuewild`
- **Value:** `letsencrypt.org`
- **Flag:** 0

**Purpose:** Prevent unauthorized certificate issuance

**Verification:**
```bash
dig abyrith.com CAA +short

# Expected output:
# 0 issue "letsencrypt.org"
# 0 issuewild "letsencrypt.org"
```

**Time:** ~5 minutes

---

## Verification

### Post-Procedure Checks

**1. DNS Resolution:**
```bash
# Check A record
dig abyrith.com A +short
# Expected: Cloudflare proxy IP (not your origin IP if proxied)

# Check CNAME records
dig www.abyrith.com CNAME +short
dig staging.abyrith.com CNAME +short

# Check nameservers
dig abyrith.com NS +short
# Expected: elena.ns.cloudflare.com, shane.ns.cloudflare.com
```

**Expected:** All records return correct values

---

**2. HTTPS and SSL:**
```bash
# Test HTTPS connection
curl -I https://abyrith.com

# Expected:
# HTTP/2 200
# server: cloudflare
# (or HTTP/1.1 200 OK)

# Check SSL certificate
openssl s_client -connect abyrith.com:443 -servername abyrith.com < /dev/null | openssl x509 -noout -text

# Verify certificate issued by Let's Encrypt or Cloudflare
# Check expiration date is in the future
```

**Expected:** Valid SSL certificate, HTTPS working

---

**3. HTTP to HTTPS Redirect:**
```bash
# Test redirect
curl -I http://abyrith.com

# Expected:
# HTTP/1.1 301 Moved Permanently
# Location: https://abyrith.com/
```

**Expected:** HTTP redirects to HTTPS

---

**4. Subdomain Verification:**
```bash
# Test staging subdomain
curl -I https://staging.abyrith.com

# Test www subdomain
curl -I https://www.abyrith.com

# Both should return 200 OK with valid SSL
```

**Expected:** All subdomains resolve and serve HTTPS

---

**5. DNS Propagation Check:**

Use online tools to verify global DNS propagation:
- Visit: https://www.whatsmydns.net/
- Enter your domain: `abyrith.com`
- Select record type: `A`
- Check results globally

**Expected:** Green checkmarks from most locations worldwide (allow 24-48 hours for 100%)

---

**6. SSL Certificate Verification:**

Use SSL Labs to verify certificate configuration:
- Visit: https://www.ssllabs.com/ssltest/
- Enter domain: `abyrith.com`
- Wait for scan to complete

**Expected:**
- Grade: A or A+
- Certificate chain valid
- TLS 1.2 or 1.3 supported
- No major vulnerabilities

---

**7. Application Functionality:**
- [ ] Open https://abyrith.com in browser
- [ ] Verify page loads correctly
- [ ] Check browser shows secure padlock icon
- [ ] Test user login (if applicable)
- [ ] Verify API endpoints work (https://api.abyrith.com)
- [ ] Check staging environment (https://staging.abyrith.com)

---

**8. Cloudflare Dashboard Check:**
- [ ] Go to Cloudflare Dashboard → Your site
- [ ] Navigate to "DNS" tab
- [ ] Verify status: "Active"
- [ ] Check "SSL/TLS" tab → Certificate status: "Active"
- [ ] Review "Analytics" tab → Confirm traffic is being proxied

---

### Success Criteria

**Procedure is successful when:**
- [ ] All DNS records resolve correctly
- [ ] Nameservers point to Cloudflare
- [ ] SSL certificate is active and valid
- [ ] HTTP redirects to HTTPS automatically
- [ ] All subdomains (www, staging, api) work
- [ ] HSTS is enabled (if configured)
- [ ] DNSSEC is active (if configured)
- [ ] DNS propagation is complete (or in progress)
- [ ] Application is accessible and functional
- [ ] No errors in browser console or SSL Labs
- [ ] Cloudflare analytics showing traffic

---

## Rollback

### When to Rollback

**Rollback if:**
- DNS records are not resolving correctly after 1 hour
- SSL certificate provisioning fails repeatedly
- Application becomes inaccessible
- Nameserver change causes unexpected issues
- Critical errors appear in production

**⚠️ Note:** DNS rollback can take time due to TTL and caching. Plan accordingly.

### Rollback Procedure

**Step 1: Restore Previous Nameservers**
1. Log in to domain registrar
2. Navigate to nameserver settings
3. Change back to previous nameservers:
   ```bash
   # Check backup file created in Pre-Flight Checklist
   cat nameservers-backup-YYYYMMDD.txt
   ```
4. Enter the old nameservers
5. Save changes

**Time:** ~5 minutes (plus propagation: 5 minutes - 48 hours)

---

**Step 2: Verify Rollback**
```bash
# Check nameservers
dig abyrith.com NS +short

# Expected: Old nameservers from backup
```

**Expected:** Old nameservers appear, old DNS records resolve

---

**Step 3: Monitor Application**
- [ ] Verify application is accessible
- [ ] Check SSL certificate (may use old certificate temporarily)
- [ ] Test critical user flows
- [ ] Monitor error rates in Sentry/monitoring tools

---

**Step 4: Notify Stakeholders**
- [ ] Update #engineering Slack channel: "DNS rollback complete, service restored"
- [ ] Update status page (if customer-facing)
- [ ] Close or update maintenance ticket with rollback details
- [ ] Document what went wrong for post-mortem

---

### Post-Rollback

**After rollback:**
1. Investigate root cause
   - Check Cloudflare DNS settings for errors
   - Verify SSL certificate provisioning logs
   - Review nameserver propagation status
2. Update runbook if needed based on failure
3. Plan retry with fixes:
   - Correct DNS record errors
   - Ensure Cloudflare account is properly configured
   - Test in staging environment first
4. Schedule post-mortem if major incident

---

## Troubleshooting

### Issue 1: DNS Records Not Resolving

**Symptoms:**
```bash
dig abyrith.com A +short
# Returns nothing or wrong IP
```

**Cause:** Nameservers not updated, DNS propagation in progress, or incorrect records

**Solution:**
```bash
# 1. Verify nameservers
dig abyrith.com NS +short

# 2. If nameservers are correct, check propagation status
# Use https://www.whatsmydns.net/

# 3. If propagation is slow, wait and check TTL
dig abyrith.com SOA +short
# Note TTL value

# 4. Flush local DNS cache
# macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Linux:
sudo systemd-resolve --flush-caches

# Windows:
ipconfig /flushdns
```

**If solution doesn't work:**
- Wait 24-48 hours for full propagation
- Contact Cloudflare support if records are incorrect
- Verify registrar nameserver update was saved

---

### Issue 2: SSL Certificate Not Provisioning

**Symptoms:**
```
Cloudflare Pages → Custom Domains → Status: "Provisioning certificate"
(Stuck for >15 minutes)
```

**Cause:** DNS not propagated, CAA records blocking issuance, or Cloudflare issue

**Solution:**
1. Verify DNS propagation:
   ```bash
   dig abyrith.com A +short
   # Must return Cloudflare IP
   ```
2. Check CAA records:
   ```bash
   dig abyrith.com CAA +short
   # If present, ensure "letsencrypt.org" is listed
   ```
3. Remove conflicting CAA records if necessary
4. Wait 15-30 minutes and refresh Cloudflare Pages dashboard
5. If still failing, delete custom domain and re-add it

**If solution doesn't work:**
- Contact Cloudflare support with error details
- Check Cloudflare status page: https://www.cloudflarestatus.com/
- Temporarily use `Full` SSL mode instead of `Full (strict)`

---

### Issue 3: HTTPS Not Working (Certificate Error in Browser)

**Symptoms:**
```
Browser error: "Your connection is not private" or "NET::ERR_CERT_COMMON_NAME_INVALID"
```

**Cause:** SSL certificate not covering subdomain, wrong SSL mode, or certificate not trusted

**Solution:**
1. Check SSL mode in Cloudflare:
   - Go to "SSL/TLS" → Overview
   - Set to "Full (strict)" for production
2. Verify certificate covers your domain:
   ```bash
   openssl s_client -connect abyrith.com:443 -servername abyrith.com < /dev/null | openssl x509 -noout -text | grep DNS
   # Should list: DNS:abyrith.com, DNS:*.abyrith.com
   ```
3. Clear browser cache and retry
4. Try incognito/private browsing mode
5. Check certificate expiration

**If solution doesn't work:**
- Contact Cloudflare support
- Consider using Cloudflare Advanced Certificate Manager (paid feature)

---

### Issue 4: HTTP Not Redirecting to HTTPS

**Symptoms:**
```bash
curl -I http://abyrith.com
# Returns: HTTP/1.1 200 OK (no redirect)
```

**Cause:** "Always Use HTTPS" not enabled in Cloudflare

**Solution:**
1. Go to Cloudflare Dashboard → "SSL/TLS" → "Edge Certificates"
2. Toggle "Always Use HTTPS" to **On**
3. Wait 1-2 minutes for change to propagate
4. Test again:
   ```bash
   curl -I http://abyrith.com
   # Expected: HTTP/1.1 301 Moved Permanently
   ```

---

### Issue 5: Subdomain Not Resolving

**Symptoms:**
```bash
dig staging.abyrith.com A +short
# Returns nothing
```

**Cause:** CNAME record not created or incorrect target

**Solution:**
1. Check Cloudflare DNS records:
   - Go to "DNS" tab
   - Verify CNAME record exists for `staging`
   - Verify target is correct (e.g., `abyrith-staging.pages.dev`)
2. Ensure proxy status is set correctly (orange cloud = proxied)
3. Verify Pages custom domain is added:
   - Go to Workers & Pages → Staging project → Custom domains
   - Ensure `staging.abyrith.com` is listed and active
4. Test again after 5 minutes

---

### Issue 6: DNSSEC Validation Failing

**Symptoms:**
```bash
dig abyrith.com +dnssec
# Returns SERVFAIL or no RRSIG records
```

**Cause:** DS record not added to registrar, or incorrect DS record

**Solution:**
1. Verify DS record at registrar matches Cloudflare:
   - Cloudflare Dashboard → "DNS" → "Settings" → "DNSSEC"
   - Copy DS record values
2. Log in to registrar and verify DS record
3. If incorrect, update DS record at registrar
4. Wait 1-24 hours for DNSSEC propagation
5. Test validation:
   ```bash
   dig abyrith.com +dnssec +multi
   # Should see RRSIG records
   ```

**If solution doesn't work:**
- Disable DNSSEC temporarily and re-enable after fixing
- Contact registrar support for DNSSEC help

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| Primary | DevOps Lead | Slack: @devops-lead | Immediate |
| Backup | Senior Backend Engineer | Slack: @backend-lead | If primary unavailable |
| Escalation | Engineering Manager | Slack: @eng-manager | After 30 minutes |
| Cloudflare Support | Cloudflare | [Support Portal](https://dash.cloudflare.com/?to=/:account/support) | If internal escalation fails |

---

## Post-Procedure

### Cleanup

**After successful completion:**
```bash
# No cleanup commands needed
# DNS records are permanent until changed
```

**Archive backup files:**
- Store `dns-backup-YYYYMMDD.txt` and `nameservers-backup-YYYYMMDD.txt` in secure location
- Document location: `/docs/backups/dns/`
- Retention: Keep for 1 year

### Documentation

**Update these documents:**
- [ ] This runbook (if issues/improvements identified)
- [ ] `TECH-STACK.md` (if DNS provider changed)
- [ ] `10-operations/deployment/deployment-pipeline.md` (if deployment process affected)
- [ ] Internal wiki with actual domain and nameserver values
- [ ] Team onboarding docs with DNS access instructions

### Communication

**Notify:**
- [ ] Team in #engineering Slack channel: "DNS setup completed successfully for [domain]"
- [ ] Update status page (if customer-facing): "All systems operational"
- [ ] Close maintenance ticket with completion notes
- [ ] Send summary to stakeholders (if major change):
  ```
  ✅ DNS Setup Complete for abyrith.com

  Completed: 2025-10-30 14:30 UTC
  Duration: 35 minutes (plus DNS propagation)

  Changes:
  - Migrated to Cloudflare DNS
  - Configured production (abyrith.com)
  - Configured staging (staging.abyrith.com)
  - Enabled SSL/TLS with Full (strict) mode
  - Enabled DNSSEC

  Status: All systems operational
  DNS propagation: In progress (24-48 hours for full global propagation)
  ```

### Monitoring

**Increased monitoring period:**
- Monitor DNS resolution for 48 hours after nameserver change
- Watch for:
  - Increase in SSL/TLS errors
  - DNS resolution failures
  - Unexpected traffic drops
  - Certificate expiration warnings
- Set up temporary alerts:
  - Alert if DNS query failure rate >5%
  - Alert if SSL certificate expires within 7 days
  - Alert if traffic drops >20% (may indicate DNS issues)

**Monitoring commands:**
```bash
# Check DNS resolution every hour for 48 hours
watch -n 3600 'dig abyrith.com A +short'

# Monitor SSL certificate expiration
echo | openssl s_client -servername abyrith.com -connect abyrith.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Communication

### Communication Templates

**Pre-Procedure Announcement:**
```
📢 DNS Configuration Scheduled for abyrith.com

When: 2025-10-30 14:00 UTC
Duration: ~45 minutes (plus 24-48 hours DNS propagation)
Impact: None expected, but some users may experience brief DNS resolution delays during propagation
Purpose: Migrate DNS management to Cloudflare and configure custom domains

Updates will be posted in #engineering
Status page: https://status.abyrith.com
```

---

**During Procedure:**
```
🔧 DNS Configuration in Progress

Status: Configuring DNS records
Progress: Step 3 of 6 complete
ETA: 20 minutes remaining

Everything proceeding as expected. Nameservers updated, DNS records configured.
```

---

**Completion:**
```
✅ DNS Configuration Complete for abyrith.com

Completed: 2025-10-30 14:35 UTC
Duration: 35 minutes

Changes:
- Nameservers migrated to Cloudflare
- Production domain: abyrith.com (active)
- Staging domain: staging.abyrith.com (active)
- SSL/TLS: Full (strict) mode enabled
- DNSSEC: Enabled

DNS propagation in progress. Full global propagation may take 24-48 hours.
All systems operational. Monitoring for 48 hours.
```

---

**Rollback Announcement:**
```
⚠️ DNS Configuration Rolled Back

Rollback completed: 2025-10-30 15:00 UTC
Reason: SSL certificate provisioning failed repeatedly
Impact: Service restored to previous DNS configuration

System restored to previous state using original nameservers.
Investigation underway. Root cause will be documented in post-mortem.
Post-mortem scheduled: 2025-10-31 10:00 UTC
```

---

## Dependencies

### Technical Dependencies

**Must exist before procedure:**
- [ ] Domain registered and owned by organization
- [ ] Cloudflare account created (Free or paid plan)
- [ ] Cloudflare Pages project deployed
  - See: `10-operations/deployment/deployment-pipeline.md`
- [ ] Access to domain registrar account

**Systems involved:**
- **Cloudflare DNS** - DNS zone management and record configuration
- **Cloudflare Pages** - Custom domain hosting and SSL provisioning
- **Domain Registrar** - Nameserver updates (e.g., Namecheap, GoDaddy)
- **Let's Encrypt** - SSL certificate authority (via Cloudflare)

### Team Dependencies

**Requires coordination with:**
- **Engineering Team** - For application deployment and verification
- **Product Team** - For customer communication (if production change)
- **Support Team** - To handle potential user questions during propagation

---

## References

### Internal Documentation
- `10-operations/deployment/deployment-pipeline.md` - Deployment procedures
- `TECH-STACK.md` - Cloudflare DNS and Pages specifications
- `02-architecture/system-overview.md` - System architecture overview

### External Resources
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/) - DNS record management
- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/platform/custom-domains/) - Custom domain setup
- [Cloudflare SSL/TLS Documentation](https://developers.cloudflare.com/ssl/) - SSL configuration
- [DNSSEC Guide](https://developers.cloudflare.com/dns/dnssec/) - DNSSEC setup
- [DNS Propagation Checker](https://www.whatsmydns.net/) - Check global DNS propagation
- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/) - SSL certificate verification

### Incident History

**Previous incidents related to this procedure:**
- None yet (initial documentation)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | DevOps Team | Initial DNS setup runbook using Operations Runbook Template |

---

## Notes

### Improvements Needed
- Add automation scripts for DNS record creation via Cloudflare API
- Create Terraform configuration for DNS infrastructure as code
- Add monitoring alerts for DNS resolution failures
- Document process for migrating between DNS providers

### Lessons Learned
- None yet (initial documentation)
- Will be updated after first production DNS configuration

### Next Review Date
2025-11-30 (1 month after initial creation)

---

**End of Runbook**
