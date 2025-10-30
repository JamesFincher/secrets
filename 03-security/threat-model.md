---
Document: Threat Model - Security Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Security Lead
Status: Draft
Dependencies: 03-security/security-model.md, GLOSSARY.md, TECH-STACK.md
---

# Abyrith Threat Model

## Overview

This document provides a comprehensive security threat analysis for the Abyrith secrets management platform. It identifies potential attack vectors, threat actors, attack scenarios, and mitigations to ensure the platform maintains zero-knowledge encryption while preventing unauthorized access to sensitive data.

**Purpose:** Identify, analyze, and mitigate security threats to the Abyrith platform across all layers (client, edge, application, database).

**Scope:** All components of the Abyrith platform including web application, API endpoints, database, integrations (MCP, Claude API, FireCrawl), and infrastructure (Cloudflare, Supabase).

**Status:** Draft - Initial threat modeling for MVP phase

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Threat Actors](#threat-actors)
5. [Attack Surface Analysis](#attack-surface-analysis)
6. [Threat Categories](#threat-categories)
7. [Attack Scenarios](#attack-scenarios)
8. [Security Controls](#security-controls)
9. [Defense in Depth Strategy](#defense-in-depth-strategy)
10. [Incident Response](#incident-response)
11. [Security Assumptions](#security-assumptions)
12. [Out-of-Scope Threats](#out-of-scope-threats)
13. [Risk Assessment Matrix](#risk-assessment-matrix)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith stores highly sensitive data (API keys, secrets, credentials) and must protect this data from unauthorized access while maintaining a zero-knowledge architecture where the platform itself cannot decrypt user secrets.

**Pain points:**
- Secrets are high-value targets for attackers
- Traditional security can break zero-knowledge guarantees
- Multi-tenancy requires strict data isolation
- AI integrations introduce new attack surfaces
- User experience must not compromise security

**Why now?**
Security must be designed from the beginning. Retrofitting security into an existing system is significantly harder and more risky than building it in from day one.

### Background

**Existing system (if applicable):**
This is a greenfield project. We learn from security incidents at other secrets management platforms (1Password breaches, LastPass incidents, etc.).

**Previous attempts:**
N/A - Initial implementation

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| End Users | Safe storage of secrets | Data breaches, unauthorized access |
| Enterprise Customers | Compliance (SOC 2, GDPR) | Audit trails, access control, data sovereignty |
| Development Team | Secure APIs and services | Managing secrets without seeing plaintext |
| Security Team | Zero vulnerabilities | All attack vectors covered |
| Product Team | Usable security | Security doesn't hurt UX |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Zero-Knowledge Enforcement** - Server cannot decrypt user secrets under any circumstances (success metric: mathematical proof)
2. **Data Isolation** - No cross-tenant data leakage (success metric: 100% RLS policy coverage)
3. **Comprehensive Audit Trail** - All secret access logged (success metric: 100% coverage of sensitive operations)
4. **Attack Prevention** - Block common attack patterns (success metric: penetration test pass rate)
5. **Compliance Readiness** - Meet SOC 2, GDPR, ISO 27001 requirements (success metric: certification achieved)

**Secondary goals:**
- Minimize attack surface
- Enable security monitoring and alerting
- Provide incident response capabilities
- Educate users on security best practices

### Non-Goals

**Explicitly out of scope:**
- **Physical security of user devices** - We cannot protect against compromised user machines (though we can mitigate)
- **Social engineering attacks on users** - User phishing is out of our control (though we can educate)
- **Supply chain attacks on dependencies** - We trust npm, GitHub, Cloudflare, Supabase (though we monitor)
- **Quantum computing attacks** - AES-256 is quantum-resistant for the foreseeable future
- **Nation-state zero-day exploits** - We cannot defend against unknown browser/OS vulnerabilities

### Success Metrics

**How we measure success:**
- **Zero secrets exposed** in any security audit
- **100% RLS policy coverage** on all database tables
- **< 24 hour** incident response time for critical vulnerabilities
- **SOC 2 Type II certification** achieved within 12 months
- **Penetration test score** of 95%+ on OWASP Top 10

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
│   Web App │ MCP Client │ CLI │ Browser Extension │ Mobile   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Client-Side Encryption Layer                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Master Key Derivation (PBKDF2)                    │   │ [CRITICAL TRUST BOUNDARY]
│  │  • AES-256-GCM Encryption/Decryption                 │   │
│  │  │  Key never leaves client                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │ (encrypted blobs only)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge Network                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │ [SECOND TRUST BOUNDARY]
│  │ Workers      │  │ DDoS & WAF   │  │ Rate Limiting│      │
│  │ (API Gateway)│  │ Protection   │  │ per IP/User  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │ [THIRD TRUST BOUNDARY]
│  │                  PostgreSQL Database                  │   │
│  │  • RLS Policies (multi-tenancy enforcement)          │   │
│  │  • Encrypted blobs stored (AES-256 at rest)          │   │
│  │  • Audit logs (tamper-evident)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Client-Side Encryption**
- **Purpose:** Encrypt secrets before transmission to server
- **Technology:** WebCrypto API (browser), Node.js crypto (CLI)
- **Responsibilities:** Master key derivation, encryption, decryption

**Component 2: Cloudflare Edge (API Gateway)**
- **Purpose:** Request routing, rate limiting, DDoS protection
- **Technology:** Cloudflare Workers
- **Responsibilities:** Authentication validation, request filtering, caching

**Component 3: Supabase Backend**
- **Purpose:** Data persistence, RLS enforcement, audit logging
- **Technology:** PostgreSQL 15, Supabase Auth
- **Responsibilities:** Store encrypted data, enforce permissions, log access

**Component 4: External Integrations**
- **Purpose:** AI assistance, API documentation scraping
- **Technology:** Claude API, FireCrawl API
- **Responsibilities:** Provide intelligence without accessing secrets

### Component Interactions

**Client ↔ Cloudflare:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON (encrypted blobs + metadata)
- Authentication: JWT Bearer token

**Cloudflare ↔ Supabase:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON (PostgREST API)
- Authentication: Service role key (Supabase)

---

## Threat Actors

### Threat Actor 1: External Attacker

**Profile:**
- **Motivation:** Financial gain, data theft, ransomware
- **Capabilities:** Medium to high technical skill, automated tools, vulnerability scanners
- **Resources:** Time, botnets, exploit databases

**Attack Vectors:**
- Web application vulnerabilities (XSS, CSRF, injection)
- API abuse and enumeration
- DDoS attacks
- Brute force attacks on authentication
- Man-in-the-middle (MITM) attacks

**Likelihood:** High (constant threat from internet)

### Threat Actor 2: Malicious User (Insider)

**Profile:**
- **Motivation:** Steal competitor secrets, corporate espionage
- **Capabilities:** Authenticated user, access to legitimate features
- **Resources:** Valid credentials, knowledge of platform

**Attack Vectors:**
- Abuse of team sharing features
- Privilege escalation within organization
- Data exfiltration via legitimate APIs
- Social engineering of team members
- Intentional exposure of shared secrets

**Likelihood:** Medium (smaller user base, but motivated attackers)

### Threat Actor 3: Compromised AI Tools (MCP Abuse)

**Profile:**
- **Motivation:** Automated secret harvesting by compromised Claude Code/Cursor
- **Capabilities:** MCP integration, AI tool access
- **Resources:** User's MCP credentials, API access

**Attack Vectors:**
- Malicious MCP server impersonation
- Compromised AI tool requesting all secrets
- Man-in-the-middle on MCP communication
- Abuse of approval workflows

**Likelihood:** Low to Medium (emerging threat as MCP adoption grows)

### Threat Actor 4: Rogue Administrator

**Profile:**
- **Motivation:** Internal data theft, sabotage
- **Capabilities:** Database access, infrastructure access
- **Resources:** Legitimate admin credentials, system knowledge

**Attack Vectors:**
- Database direct access attempts
- Bypassing RLS policies
- Modifying audit logs to cover tracks
- Infrastructure manipulation
- Extracting encrypted data for offline attacks

**Likelihood:** Low (trusted employees, but must defend against)

### Threat Actor 5: Nation-State Actor (APT)

**Profile:**
- **Motivation:** Intelligence gathering, long-term access
- **Capabilities:** Very high, zero-day exploits, supply chain attacks
- **Resources:** Significant funding, time, advanced tools

**Attack Vectors:**
- Zero-day vulnerabilities in dependencies
- Supply chain compromises (npm packages, CDN)
- Advanced persistent threats (long-term infiltration)
- Side-channel attacks on encryption

**Likelihood:** Very Low (unlikely to target small platform, but must consider)

---

## Attack Surface Analysis

### Attack Surface 1: Web Application (Frontend)

**Exposed Components:**
- React/Next.js application
- Client-side JavaScript code
- Browser localStorage/sessionStorage
- WebCrypto API usage

**Potential Vulnerabilities:**
- **XSS (Cross-Site Scripting):** Malicious JavaScript injection
- **CSRF (Cross-Site Request Forgery):** Unauthorized actions via forged requests
- **Open redirects:** Phishing via legitimate domain
- **Client-side logic bypass:** Tampering with JavaScript validation
- **Secret exposure in browser memory:** Memory scraping attacks

**Entry Points:**
- User input fields (project names, secret names, tags)
- URL parameters
- WebSocket connections (Supabase Realtime)
- Third-party OAuth callbacks

**Severity:** High (direct user interaction, secrets in browser memory)

### Attack Surface 2: API Endpoints (Cloudflare Workers + Supabase)

**Exposed Components:**
- REST API endpoints
- Authentication endpoints
- MCP server endpoints
- Webhook handlers

**Potential Vulnerabilities:**
- **Authentication bypass:** JWT token vulnerabilities
- **Authorization flaws:** Accessing other users' data
- **Injection attacks:** SQL injection, NoSQL injection
- **API abuse:** Rate limiting bypass, resource exhaustion
- **Mass assignment:** Setting unintended fields
- **Insecure direct object references (IDOR):** Accessing secrets by ID

**Entry Points:**
- `/api/secrets/*` - Secrets management
- `/api/projects/*` - Project management
- `/api/auth/*` - Authentication
- `/api/mcp/*` - MCP server
- `/api/webhooks/*` - Webhook handlers

**Severity:** Critical (central to all operations, data access)

### Attack Surface 3: Database (Supabase PostgreSQL)

**Exposed Components:**
- PostgreSQL database
- Row-Level Security policies
- Database functions and triggers
- Connection strings

**Potential Vulnerabilities:**
- **RLS policy bypass:** Flaws in RLS logic
- **SQL injection:** Via Supabase or custom queries
- **Privilege escalation:** Gaining higher database roles
- **Data leakage via timing:** Timing-based information disclosure
- **Connection string exposure:** Credentials in logs or code

**Entry Points:**
- PostgREST API (auto-generated)
- Supabase Edge Functions
- Database migrations
- Backup/restore processes

**Severity:** Critical (contains all data, RLS is last line of defense)

### Attack Surface 4: External Integrations

**Exposed Components:**
- Claude API integration
- FireCrawl API integration
- OAuth providers (Google, GitHub)
- Email/notification services

**Potential Vulnerabilities:**
- **API key exposure:** Leaked keys in logs or client
- **MITM on third-party APIs:** Intercepting API traffic
- **OAuth token theft:** Stolen access tokens
- **Prompt injection (Claude):** Manipulating AI behavior
- **Data leakage to third parties:** Sensitive data in API requests

**Entry Points:**
- Cloudflare Workers calling external APIs
- OAuth callback handlers
- Webhook receivers from external services

**Severity:** Medium to High (AI could be manipulated, OAuth is critical)

### Attack Surface 5: Infrastructure (Cloudflare, Supabase)

**Exposed Components:**
- Cloudflare DNS
- Cloudflare Workers runtime
- Supabase hosted infrastructure
- GitHub repositories (public or private)

**Potential Vulnerabilities:**
- **DNS hijacking:** Redirecting traffic to malicious servers
- **Supply chain attacks:** Compromised dependencies
- **Misconfigured security settings:** Public S3 buckets, open databases
- **Secrets in version control:** API keys committed to Git
- **Insider threats at providers:** Cloudflare/Supabase employee abuse

**Entry Points:**
- Domain registrar account
- Cloudflare dashboard
- Supabase dashboard
- GitHub repository

**Severity:** Critical (infrastructure compromise affects everything)

---

## Threat Categories

### Category 1: Authentication & Authorization Threats

**T1.1: Weak Password Authentication**
- **Description:** Users choose weak master passwords that can be brute-forced
- **Likelihood:** High
- **Impact:** Critical (entire account compromise)
- **Mitigation:**
  - Enforce strong password policy (12+ characters, complexity)
  - Use PBKDF2 with high iteration count (600,000 iterations per OWASP 2023)
  - Implement rate limiting on login attempts
  - Optional: Require 2FA for all users

**T1.2: JWT Token Theft**
- **Description:** Attacker steals JWT token from user's browser or network
- **Likelihood:** Medium
- **Impact:** High (access to all user resources)
- **Mitigation:**
  - Short token expiration (15 minutes)
  - Refresh token rotation
  - httpOnly cookies (where applicable)
  - Monitor for suspicious token usage patterns

**T1.3: Session Fixation**
- **Description:** Attacker forces user to use known session ID
- **Likelihood:** Low
- **Impact:** High (session hijacking)
- **Mitigation:**
  - Regenerate session ID on login
  - Use Supabase Auth's built-in session management
  - Implement CSRF tokens

**T1.4: OAuth Account Takeover**
- **Description:** Attacker compromises user's OAuth provider account
- **Likelihood:** Medium
- **Impact:** High (access to Abyrith account)
- **Mitigation:**
  - Require email verification even for OAuth
  - Detect and alert on new OAuth links
  - Allow account recovery without OAuth dependency

**T1.5: Privilege Escalation**
- **Description:** User escalates from Developer to Admin role
- **Likelihood:** Low to Medium
- **Impact:** High (unauthorized access to team secrets)
- **Mitigation:**
  - Enforce RLS policies at database level
  - Server-side role validation on all API calls
  - Audit log all role changes
  - Require Admin approval for role elevation

---

### Category 2: Encryption & Cryptography Threats

**T2.1: Weak Encryption Algorithm**
- **Description:** Use of deprecated or weak encryption (e.g., AES-128, DES)
- **Likelihood:** Very Low (we use AES-256-GCM)
- **Impact:** Critical (secrets exposed)
- **Mitigation:**
  - Use AES-256-GCM (industry standard)
  - Use WebCrypto API (browser-native, audited)
  - Prohibit custom encryption implementations
  - Regular cryptographic review

**T2.2: Key Derivation Weakness**
- **Description:** Weak password-to-key derivation allows brute force
- **Likelihood:** Low (we use PBKDF2 with 600,000 iterations per OWASP 2023)
- **Impact:** Critical (master key compromise)
- **Mitigation:**
  - PBKDF2 with 600,000 iterations (SHA-256, OWASP 2023 recommendation)
  - Unique salt per user
  - Enforce strong password policy
  - Future: Consider Argon2id upgrade

**T2.3: Nonce/IV Reuse**
- **Description:** Reusing initialization vectors breaks AES-GCM security
- **Likelihood:** Low (if properly implemented)
- **Impact:** High (encrypted data correlation)
- **Mitigation:**
  - Generate unique random IV for each encryption
  - Use `crypto.getRandomValues()` (cryptographically secure)
  - Include IV with encrypted blob
  - Automated tests to detect IV reuse

**T2.4: Timing Attacks**
- **Description:** Side-channel attacks via cryptographic timing differences
- **Likelihood:** Very Low (requires precise measurement)
- **Impact:** Medium (key information leakage)
- **Mitigation:**
  - Use constant-time comparison functions
  - Avoid branching based on secret data
  - Rate limiting reduces timing attack precision

**T2.5: Master Key Exposure**
- **Description:** Master key leaked in browser memory, logs, or network
- **Likelihood:** Low to Medium
- **Impact:** Critical (all secrets decrypted)
- **Mitigation:**
  - Never log master key or derived keys
  - Clear keys from memory after use
  - Use secure browser storage (IndexedDB with encryption)
  - Detect and prevent key transmission to server

---

### Category 3: Data Leakage & Exfiltration

**T3.1: Cross-Tenant Data Leakage**
- **Description:** User accesses another organization's secrets
- **Likelihood:** Low (if RLS implemented correctly)
- **Impact:** Critical (data breach, compliance violation)
- **Mitigation:**
  - Row-Level Security on all tables
  - Test RLS policies extensively
  - Automated RLS policy validation
  - Regular security audits

**T3.2: Audit Log Tampering**
- **Description:** Attacker modifies or deletes audit logs to cover tracks
- **Likelihood:** Low (requires database access)
- **Impact:** High (loss of forensic evidence)
- **Mitigation:**
  - Append-only audit log table (no UPDATE/DELETE)
  - RLS prevents deletion by non-admins
  - Export logs to external SIEM
  - Cryptographic log signing (future)

**T3.3: Data Exposure in Logs**
- **Description:** Secrets or PII logged in application/server logs
- **Likelihood:** Medium (common developer mistake)
- **Impact:** High (secrets exposed to Ops team)
- **Mitigation:**
  - Never log encrypted values or master keys
  - Redact sensitive fields in error messages
  - Automated log scanning for secrets
  - Use structured logging with sensitive field filters

**T3.4: Database Backup Theft**
- **Description:** Attacker gains access to database backups
- **Likelihood:** Low (Supabase manages backups securely)
- **Impact:** High (all encrypted secrets accessible)
- **Mitigation:**
  - Supabase encryption at rest
  - Backup encryption with separate keys
  - Limited access to backup storage
  - Regular backup restoration tests

**T3.5: Metadata Leakage**
- **Description:** Secret names, service names, or tags leak sensitive information
- **Likelihood:** Medium (metadata not encrypted)
- **Impact:** Low to Medium (intelligence gathering)
- **Mitigation:**
  - Educate users to use generic names
  - Option to encrypt metadata (future)
  - RLS prevents cross-tenant metadata access

---

### Category 4: API & Injection Attacks

**T4.1: SQL Injection**
- **Description:** Malicious SQL in user input
- **Likelihood:** Low (Supabase uses parameterized queries)
- **Impact:** Critical (database compromise)
- **Mitigation:**
  - Use Supabase's PostgREST (parameterized)
  - No raw SQL from user input
  - Input validation and sanitization
  - Principle of least privilege on database role

**T4.2: Cross-Site Scripting (XSS)**
- **Description:** Malicious JavaScript injected via user input
- **Likelihood:** Medium (if input not sanitized)
- **Impact:** High (session theft, secret access)
- **Mitigation:**
  - React's automatic HTML escaping
  - Content Security Policy (CSP) headers
  - Sanitize user-generated content
  - HttpOnly cookies for session tokens

**T4.3: API Rate Limit Bypass**
- **Description:** Attacker bypasses rate limiting to brute force or DDoS
- **Likelihood:** Medium
- **Impact:** Medium (service disruption, brute force)
- **Mitigation:**
  - Cloudflare rate limiting (per IP, per user)
  - Progressive backoff on failed attempts
  - CAPTCHA for suspicious behavior
  - Ban repeat offenders

**T4.4: Insecure Direct Object Reference (IDOR)**
- **Description:** Accessing secrets by guessing UUIDs
- **Likelihood:** Low (UUIDs are non-enumerable)
- **Impact:** High (unauthorized secret access)
- **Mitigation:**
  - Use UUIDs (not sequential IDs)
  - RLS enforces ownership checks
  - API validates user has access
  - Audit log all access attempts

**T4.5: Mass Assignment**
- **Description:** Setting unintended fields via API (e.g., `role=admin`)
- **Likelihood:** Low to Medium
- **Impact:** High (privilege escalation)
- **Mitigation:**
  - Whitelist allowed fields
  - Validate all input against schema (Zod)
  - RLS prevents unauthorized updates
  - Separate endpoints for privileged operations

---

### Category 5: Zero-Knowledge Architecture Threats

**T5.1: Server-Side Decryption Vulnerability**
- **Description:** Bug allows server to decrypt secrets
- **Likelihood:** Very Low (by design, server lacks keys)
- **Impact:** Critical (zero-knowledge guarantee broken)
- **Mitigation:**
  - Architectural guarantee: server never receives master key
  - Code review for any server-side crypto
  - Penetration testing for decryption attempts
  - Public security audit

**T5.2: Client-Side Key Extraction**
- **Description:** Malicious JavaScript extracts master key from browser
- **Likelihood:** Medium (XSS, compromised dependencies)
- **Impact:** Critical (all user secrets accessible)
- **Mitigation:**
  - CSP headers prevent inline scripts
  - Subresource Integrity (SRI) for CDN assets
  - Dependency scanning (Dependabot)
  - Clear keys from memory after use

**T5.3: Browser Extension Keylogging**
- **Description:** Malicious browser extension captures keystrokes
- **Likelihood:** Medium (user installs malicious extensions)
- **Impact:** Critical (master password stolen)
- **Mitigation:**
  - User education on extension safety
  - Detect clipboard access attempts
  - Optional: Virtual keyboard for password entry
  - **Note:** Cannot fully prevent

**T5.4: Man-in-the-Middle (MITM)**
- **Description:** Attacker intercepts encrypted blob in transit
- **Likelihood:** Low (HTTPS with TLS 1.3)
- **Impact:** Medium (encrypted data captured for offline attack)
- **Mitigation:**
  - Enforce HTTPS everywhere (HSTS)
  - TLS 1.3 with strong cipher suites
  - Certificate pinning (future)
  - Even if intercepted, data remains encrypted

---

### Category 6: MCP & AI Integration Threats

**T6.1: MCP Server Impersonation**
- **Description:** Fake MCP server tricks Claude Code into sending secrets
- **Likelihood:** Low to Medium
- **Impact:** High (secret exposure to attacker)
- **Mitigation:**
  - MCP server authentication (TLS certificates)
  - User approval required for first-time MCP clients
  - Display MCP client identity before approval
  - Audit log all MCP requests

**T6.2: Prompt Injection (Claude API)**
- **Description:** Malicious prompt tricks Claude into leaking information
- **Likelihood:** Medium (novel attack vector)
- **Impact:** Low to Medium (Claude doesn't have secret access)
- **Mitigation:**
  - Claude never receives secret values
  - Sanitize user input to Claude
  - Limit Claude's capabilities via MCP
  - Monitor Claude responses for anomalies

**T6.3: AI Tool Compromise**
- **Description:** Compromised Claude Code/Cursor harvests secrets
- **Likelihood:** Low
- **Impact:** High (automated secret theft)
- **Mitigation:**
  - Require user approval for each secret access
  - Time-limited access grants (1 hour default)
  - Display which tool is requesting access
  - Revoke access on suspicious patterns

**T6.4: FireCrawl Data Poisoning**
- **Description:** Attacker poisons API docs scraped by FireCrawl
- **Likelihood:** Low
- **Impact:** Low (misleading instructions, not secret theft)
- **Mitigation:**
  - Validate FireCrawl responses
  - Compare with known documentation
  - User reviews AI instructions before following
  - FireCrawl is read-only (no write access)

---

### Category 7: Operational & Infrastructure Threats

**T7.1: DDoS Attack**
- **Description:** Distributed denial of service overwhelms platform
- **Likelihood:** High (constant internet threat)
- **Impact:** Medium (service disruption, no data loss)
- **Mitigation:**
  - Cloudflare DDoS protection (automatic, unlimited)
  - Rate limiting per IP and per user
  - Auto-scaling (Cloudflare Workers, Supabase)
  - Incident response plan

**T7.2: Dependency Vulnerability (Supply Chain)**
- **Description:** Compromised npm package or CDN
- **Likelihood:** Medium (constant threat)
- **Impact:** High (code execution, data theft)
- **Mitigation:**
  - Dependabot alerts (automated)
  - Subresource Integrity (SRI) for CDN
  - Lock files (package-lock.json)
  - Regular dependency audits
  - Minimal dependency philosophy

**T7.3: Insider Threat (Infrastructure Admin)**
- **Description:** Rogue admin accesses infrastructure
- **Likelihood:** Very Low (trusted team)
- **Impact:** High (infrastructure manipulation)
- **Mitigation:**
  - Multi-person approval for critical operations
  - Audit log all infrastructure changes
  - Principle of least privilege
  - Background checks for admins
  - **Note:** Cannot fully prevent, must trust team

**T7.4: Cloud Provider Outage**
- **Description:** Cloudflare or Supabase experiences outage
- **Likelihood:** Low (high SLA providers)
- **Impact:** Medium (service unavailable, data intact)
- **Mitigation:**
  - Monitor provider status pages
  - Incident response plan
  - Status page for users
  - **Note:** Accept risk (no multi-cloud complexity)

---

## Attack Scenarios

### Scenario 1: Credential Stuffing Attack

**Attack Flow:**
1. Attacker obtains leaked credentials from other breaches
2. Automated tool tries credentials against Abyrith login
3. Some users reuse passwords → successful logins
4. Attacker accesses projects and secrets

**Likelihood:** High (common attack)

**Impact:** High (account compromise)

**Detection:**
- Monitor for multiple failed login attempts
- Detect logins from unusual locations
- Flag accounts with leaked passwords (HaveIBeenPwned API)

**Mitigation:**
- Rate limiting on login (5 attempts per 15 minutes)
- CAPTCHA after 3 failed attempts
- Require 2FA for all users (future)
- Email alerts on successful login from new location
- Force password reset for known leaked passwords

**Response:**
1. Lock affected accounts
2. Force password reset
3. Invalidate all sessions
4. Audit for data access
5. Notify affected users

---

### Scenario 2: XSS-Based Master Key Theft

**Attack Flow:**
1. Attacker injects malicious JavaScript via XSS vulnerability
2. Script waits for user to decrypt a secret (master key in memory)
3. Script exfiltrates master key to attacker's server
4. Attacker decrypts all user's secrets offline

**Likelihood:** Low to Medium (if XSS exists)

**Impact:** Critical (all secrets compromised)

**Detection:**
- CSP violation reports
- Unusual network requests from client
- User reports of strange behavior

**Mitigation:**
- React's automatic HTML escaping
- Content Security Policy (CSP) blocking inline scripts
- Subresource Integrity (SRI) for external scripts
- Regular security audits for XSS
- Clear master key from memory immediately after use

**Response:**
1. Patch XSS vulnerability immediately
2. Force all users to re-encrypt secrets with new master password
3. Invalidate all sessions
4. Public disclosure and user notification
5. Post-mortem and improved security testing

---

### Scenario 3: RLS Policy Bypass (Cross-Tenant Access)

**Attack Flow:**
1. Attacker discovers flaw in RLS policy logic
2. Crafts API request that bypasses RLS check
3. Accesses another organization's encrypted secrets
4. Even if encrypted, metadata and patterns are exposed

**Likelihood:** Low (if RLS thoroughly tested)

**Impact:** Critical (data breach, compliance violation)

**Detection:**
- Audit log shows access to secrets not in user's organization
- Anomaly detection on access patterns
- Regular RLS policy testing

**Mitigation:**
- Extensive RLS policy testing (unit tests + integration tests)
- Multiple layers: API validation + RLS + audit log
- Regular security audits focused on authorization
- Penetration testing specifically for multi-tenancy

**Response:**
1. Immediately patch RLS policy
2. Audit logs to identify affected users
3. Notify affected organizations
4. Regulatory reporting (GDPR breach notification)
5. Compensate affected customers
6. Third-party security audit

---

### Scenario 4: Malicious MCP Client Harvesting Secrets

**Attack Flow:**
1. User installs compromised Claude Code extension or malicious MCP client
2. MCP client requests access to all secrets in project
3. User approves (trusting "Claude Code")
4. Malicious client sends secrets to attacker

**Likelihood:** Low to Medium (as MCP adoption grows)

**Impact:** High (targeted secret theft)

**Detection:**
- MCP client requests unusually large number of secrets
- MCP client from unknown/untrusted source
- User reports suspicious approval requests

**Mitigation:**
- Display MCP client identity clearly before approval
- Require re-approval for each secret (not bulk approval)
- Whitelist known MCP client signatures (future)
- Time-limited access (auto-revoke after 1 hour)
- User education on MCP security

**Response:**
1. Revoke all MCP access for affected users
2. Identify and blacklist malicious MCP client
3. Notify users who approved requests from malicious client
4. Force secret rotation for exposed secrets
5. Publish list of trusted MCP clients

---

### Scenario 5: Database Backup Theft (Supabase Compromise)

**Attack Flow:**
1. Attacker compromises Supabase infrastructure or employee account
2. Gains access to database backups
3. Downloads encrypted secret blobs
4. Attempts offline brute-force decryption

**Likelihood:** Very Low (Supabase is well-secured)

**Impact:** High (all encrypted data exposed for offline attack)

**Detection:**
- Supabase security alerts
- Unusual database access patterns
- Public disclosure by Supabase

**Mitigation:**
- **Primary defense:** Zero-knowledge encryption (server doesn't have keys)
- Strong master passwords (PBKDF2 with 600,000 iterations per OWASP 2023)
- Even if backups stolen, secrets remain encrypted
- Trust in Supabase's security practices
- Monitor Supabase status and security announcements

**Response:**
1. Assess scope of compromise (did attacker get backups?)
2. Force all users to rotate master passwords
3. Re-encrypt all secrets with new keys
4. Public disclosure and transparency
5. Regulatory reporting
6. Evaluate alternative backup strategies

---

## Security Controls

### Preventive Controls

**Control 1: Client-Side Encryption**
- **Type:** Cryptographic
- **Purpose:** Ensure server never has access to plaintext secrets
- **Implementation:** WebCrypto API with AES-256-GCM
- **Effectiveness:** High (mathematical guarantee)

**Control 2: Row-Level Security (RLS)**
- **Type:** Access control
- **Purpose:** Enforce multi-tenancy at database level
- **Implementation:** PostgreSQL RLS policies on all tables
- **Effectiveness:** High (last line of defense)

**Control 3: Content Security Policy (CSP)**
- **Type:** Browser security
- **Purpose:** Prevent XSS attacks
- **Implementation:** CSP headers blocking inline scripts
- **Effectiveness:** High (browser-enforced)

**Control 4: Rate Limiting**
- **Type:** Network security
- **Purpose:** Prevent brute force and DDoS
- **Implementation:** Cloudflare rate limiting per IP/user
- **Effectiveness:** High (automated, scalable)

**Control 5: Input Validation**
- **Type:** Application security
- **Purpose:** Prevent injection attacks
- **Implementation:** Zod schema validation
- **Effectiveness:** Medium to High (requires thorough coverage)

### Detective Controls

**Control 6: Audit Logging**
- **Type:** Monitoring
- **Purpose:** Detect unauthorized access and security incidents
- **Implementation:** Append-only audit_logs table
- **Effectiveness:** High (comprehensive logging)

**Control 7: Anomaly Detection**
- **Type:** Monitoring
- **Purpose:** Identify suspicious behavior patterns
- **Implementation:** Monitor for unusual access patterns (future)
- **Effectiveness:** Medium (requires tuning)

**Control 8: Security Scanning**
- **Type:** Monitoring
- **Purpose:** Detect vulnerabilities in code and dependencies
- **Implementation:** Dependabot, Snyk, OWASP ZAP
- **Effectiveness:** Medium (identifies known issues)

### Corrective Controls

**Control 9: Incident Response Plan**
- **Type:** Operational
- **Purpose:** Minimize damage from security incidents
- **Implementation:** Documented runbook in `10-operations/ops-security-runbook.md`
- **Effectiveness:** High (if practiced)

**Control 10: Session Revocation**
- **Type:** Access control
- **Purpose:** Immediately terminate compromised sessions
- **Implementation:** API endpoint to invalidate JWT tokens
- **Effectiveness:** High (immediate effect)

**Control 11: Secret Rotation**
- **Type:** Cryptographic
- **Purpose:** Limit impact of exposed secrets
- **Implementation:** User-initiated or automated rotation
- **Effectiveness:** High (reduces exposure window)

---

## Defense in Depth Strategy

### Layer 1: Network Security

**Controls:**
- **Cloudflare DDoS protection** - Automatic mitigation
- **WAF (Web Application Firewall)** - Block common attacks
- **TLS 1.3 encryption** - Protect data in transit
- **HSTS (HTTP Strict Transport Security)** - Force HTTPS

**Rationale:** Stop attacks before they reach the application

---

### Layer 2: Edge Security (Cloudflare Workers)

**Controls:**
- **Rate limiting** - Per IP, per user
- **JWT validation** - Verify authentication
- **Request filtering** - Block malicious requests
- **Geographic restrictions** - Block traffic from high-risk countries (optional)

**Rationale:** Filter malicious traffic at the edge

---

### Layer 3: Application Security (API Layer)

**Controls:**
- **Input validation** - Zod schema validation
- **Authorization checks** - Verify user has access to resource
- **CSRF protection** - Prevent cross-site request forgery
- **API versioning** - Deprecate vulnerable endpoints

**Rationale:** Validate all inputs and enforce business logic

---

### Layer 4: Data Security (Database)

**Controls:**
- **Row-Level Security (RLS)** - Multi-tenancy enforcement
- **Encryption at rest** - AES-256 for stored data
- **Parameterized queries** - Prevent SQL injection
- **Least privilege** - Minimal database permissions

**Rationale:** Protect data even if application layer is compromised

---

### Layer 5: Cryptographic Security (Client-Side)

**Controls:**
- **Zero-knowledge encryption** - Server never has keys
- **Strong key derivation** - PBKDF2 with 600,000 iterations (OWASP 2023)
- **Unique IVs** - No nonce reuse
- **Secure random generation** - `crypto.getRandomValues()`

**Rationale:** Ultimate protection - encrypted data is worthless without keys

---

### Layer 6: Monitoring & Response

**Controls:**
- **Audit logging** - All sensitive operations logged
- **Alerting** - Real-time alerts on anomalies
- **Incident response** - Documented procedures
- **Security reviews** - Regular audits and penetration testing

**Rationale:** Detect and respond to breaches quickly

---

## Incident Response

### Incident Classification

**Severity Levels:**

**P0 - Critical:**
- Zero-knowledge guarantee broken (server can decrypt secrets)
- Mass secret exposure
- RLS bypass allowing cross-tenant access
- Active ongoing attack with data exfiltration

**P1 - High:**
- XSS or injection vulnerability discovered
- Authentication bypass
- Single-user account compromise with secret access
- Database backup theft

**P2 - Medium:**
- DDoS attack affecting service availability
- Minor vulnerability with no evidence of exploitation
- Suspicious activity detected but no confirmed breach

**P3 - Low:**
- Dependency vulnerability with no exploit available
- Cosmetic security issue (e.g., missing security header)

---

### Incident Response Workflow

**Phase 1: Detection (0-15 minutes)**
1. Alert triggered (monitoring, user report, security scan)
2. On-call engineer acknowledges
3. Initial triage and severity classification
4. Escalate to security lead if P0 or P1

**Phase 2: Containment (15 minutes - 2 hours)**
1. Stop the bleeding:
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IPs
   - Disable vulnerable endpoints
2. Preserve evidence (logs, database state)
3. Notify stakeholders (internal)

**Phase 3: Investigation (2 hours - 24 hours)**
1. Determine root cause
2. Identify scope of impact (which users, which secrets)
3. Assess data exposure
4. Document timeline of events

**Phase 4: Remediation (24 hours - 7 days)**
1. Patch vulnerability
2. Force password resets (if needed)
3. Rotate exposed secrets
4. Restore from backup (if needed)
5. Deploy fixes to production

**Phase 5: Notification (within 72 hours)**
1. Notify affected users
2. Regulatory reporting (GDPR, SOC 2)
3. Public disclosure (if warranted)
4. Transparency report

**Phase 6: Post-Mortem (within 14 days)**
1. Write incident post-mortem
2. Identify lessons learned
3. Update security controls
4. Improve detection and response

---

### Breach Notification Template

**Email to Affected Users:**
```
Subject: Security Incident Notification - Action Required

Dear [User Name],

We are writing to inform you of a security incident affecting your Abyrith account.

What happened:
[Brief description of incident]

What information was affected:
[Specific data exposed]

What we've done:
[Steps taken to contain and remediate]

What you should do:
1. [Action 1, e.g., "Change your master password"]
2. [Action 2, e.g., "Rotate all stored secrets"]
3. [Action 3, e.g., "Review audit logs for unauthorized access"]

For questions or assistance, contact: security@abyrith.com

We apologize for this incident and are committed to preventing future occurrences.

Abyrith Security Team
```

---

## Security Assumptions

### Assumptions We Make

**Assumption 1: User Device is Trusted**
- **Description:** We assume the user's browser/device is not compromised
- **Justification:** Cannot protect against keyloggers, screen capture, or malware on user device
- **Mitigation:** User education, recommendations for antivirus/OS updates

**Assumption 2: HTTPS/TLS is Secure**
- **Description:** We assume TLS 1.3 is not broken and MITM is not possible
- **Justification:** Industry standard, no known practical attacks
- **Mitigation:** Use latest TLS version, strong cipher suites

**Assumption 3: Dependencies are Trustworthy**
- **Description:** We assume npm packages, Cloudflare, Supabase are not malicious
- **Justification:** Necessary to build software, supply chain attacks are rare
- **Mitigation:** Dependency scanning, minimal dependencies, trusted providers

**Assumption 4: Cryptographic Algorithms are Secure**
- **Description:** We assume AES-256, PBKDF2 are not broken
- **Justification:** NIST-approved, widely used, no known attacks
- **Mitigation:** Follow cryptographic best practices, stay updated on research

**Assumption 5: Admin Team is Trustworthy**
- **Description:** We assume internal team will not intentionally harm platform
- **Justification:** Necessary for operation, background checks performed
- **Mitigation:** Principle of least privilege, audit logs, multi-person controls

**Assumption 6: Users Choose Strong Passwords**
- **Description:** We assume users create strong master passwords
- **Justification:** Cannot force users to remember complex passwords
- **Mitigation:** Password strength meter, education, optional 2FA

---

## Out-of-Scope Threats

### Threats We Do NOT Protect Against

**1. Physical Access to User Device**
- If attacker has physical access to unlocked device, they can access secrets
- **Rationale:** Out of our control, user responsibility
- **Recommendation:** Users should lock devices, use full-disk encryption

**2. Social Engineering of Users**
- Phishing emails tricking users into revealing master passwords
- **Rationale:** Cannot prevent user mistakes
- **Recommendation:** User education, phishing awareness training

**3. Compromised User Browser**
- Malware or malicious browser extensions capturing keystrokes
- **Rationale:** Cannot control user's software environment
- **Recommendation:** Recommend trusted browsers, extension hygiene

**4. Quantum Computing Attacks**
- Future quantum computers breaking AES-256 or SHA-256
- **Rationale:** Not a current threat, AES-256 is quantum-resistant for decades
- **Future Plan:** Migrate to post-quantum cryptography when standards emerge

**5. Nation-State Zero-Day Exploits**
- Undisclosed vulnerabilities in browsers, OS, or infrastructure
- **Rationale:** Cannot defend against unknown vulnerabilities
- **Mitigation:** Rapid patching, security monitoring, bug bounty program

**6. Insider Threats at Third-Party Providers**
- Rogue Cloudflare or Supabase employee accessing infrastructure
- **Rationale:** Must trust providers, contractual agreements in place
- **Mitigation:** Choose trusted providers, encryption at rest

**7. Legal Compulsion (Government Requests)**
- Government subpoena for user data
- **Rationale:** Must comply with lawful requests
- **Note:** Zero-knowledge architecture means we cannot decrypt secrets even if ordered to

---

## Risk Assessment Matrix

### Risk Scoring

**Likelihood:**
- **Very Low (1):** < 5% chance in next year
- **Low (2):** 5-20% chance
- **Medium (3):** 20-50% chance
- **High (4):** 50-80% chance
- **Very High (5):** > 80% chance

**Impact:**
- **Low (1):** Minor inconvenience, no data exposure
- **Medium (2):** Service disruption, limited data exposure
- **High (3):** Significant data exposure, regulatory reporting required
- **Critical (4):** Mass data breach, zero-knowledge guarantee broken

**Risk Score = Likelihood × Impact**

---

### Risk Matrix

| Threat | Likelihood | Impact | Risk Score | Priority | Mitigation Status |
|--------|-----------|---------|-----------|----------|-------------------|
| **T1.1** Weak Password Authentication | High (4) | Critical (4) | 16 | P0 | In Progress (password policy enforced) |
| **T1.2** JWT Token Theft | Medium (3) | High (3) | 9 | P1 | In Progress (short expiration, refresh rotation) |
| **T2.1** Weak Encryption Algorithm | Very Low (1) | Critical (4) | 4 | P2 | Complete (AES-256-GCM) |
| **T2.2** Key Derivation Weakness | Low (2) | Critical (4) | 8 | P1 | Complete (PBKDF2 600k iterations, OWASP 2023) |
| **T2.5** Master Key Exposure | Low (2) | Critical (4) | 8 | P1 | In Progress (memory clearing needed) |
| **T3.1** Cross-Tenant Data Leakage | Low (2) | Critical (4) | 8 | P1 | Planned (RLS policies) |
| **T3.2** Audit Log Tampering | Low (2) | High (3) | 6 | P2 | Planned (append-only table) |
| **T3.3** Data Exposure in Logs | Medium (3) | High (3) | 9 | P1 | In Progress (log filtering) |
| **T4.1** SQL Injection | Low (2) | Critical (4) | 8 | P1 | Complete (Supabase PostgREST) |
| **T4.2** Cross-Site Scripting (XSS) | Medium (3) | High (3) | 9 | P1 | In Progress (CSP, React escaping) |
| **T4.3** API Rate Limit Bypass | Medium (3) | Medium (2) | 6 | P2 | In Progress (Cloudflare rate limiting) |
| **T5.1** Server-Side Decryption Vulnerability | Very Low (1) | Critical (4) | 4 | P2 | Complete (architectural guarantee) |
| **T5.2** Client-Side Key Extraction | Medium (3) | Critical (4) | 12 | P0 | In Progress (CSP, SRI, audits) |
| **T6.1** MCP Server Impersonation | Low (2) | High (3) | 6 | P2 | Planned (MCP authentication) |
| **T6.2** Prompt Injection (Claude) | Medium (3) | Low (1) | 3 | P3 | Planned (input sanitization) |
| **T7.1** DDoS Attack | High (4) | Medium (2) | 8 | P1 | Complete (Cloudflare protection) |
| **T7.2** Dependency Vulnerability | Medium (3) | High (3) | 9 | P1 | In Progress (Dependabot, audits) |

**Key Findings:**
- **Highest Risk:** T1.1 (Weak Passwords), T5.2 (Client-Side Key Extraction) - Score 16 and 12
- **Most Critical Threats:** All T2.x (Cryptography), T3.1 (Cross-Tenant), T5.1 (Zero-Knowledge) - Impact 4
- **Most Likely Threats:** T1.1 (Weak Passwords), T7.1 (DDoS) - Likelihood 4

**Action Items:**
1. **Immediate (P0):** Enforce strong password policy, implement CSP headers
2. **High Priority (P1):** Complete RLS policies, improve XSS prevention, dependency scanning
3. **Medium Priority (P2):** MCP authentication, audit log improvements
4. **Low Priority (P3):** Prompt injection detection (low impact)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/security-model.md` - Zero-knowledge architecture specification
- [x] `GLOSSARY.md` - Security terminology definitions
- [x] `TECH-STACK.md` - Technology choices and versions

**Related Documentation:**
- `03-security/encryption-specification.md` - Detailed crypto specs
- `03-security/auth/authentication-flow.md` - Auth implementation
- `03-security/rbac/rls-policies.md` - RLS policy definitions
- `10-operations/ops-security-runbook.md` - Incident response procedures

### Security Tools Required

**For Testing:**
- OWASP ZAP (penetration testing)
- Burp Suite (API security testing)
- Dependabot (dependency scanning)
- Snyk (vulnerability scanning)

**For Monitoring:**
- Supabase audit logs
- Cloudflare security analytics
- Sentry (error tracking)
- Custom anomaly detection (future)

---

## References

### Internal Documentation
- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - Technology stack decisions
- `GLOSSARY.md` - Security terminology
- `04-database/database-overview.md` - Database architecture
- `01-product/product-vision-strategy.md` - Product context

### External Resources

**Security Standards:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Common web vulnerabilities
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework) - Security framework
- [CWE Top 25](https://cwe.mitre.org/top25/) - Most dangerous software weaknesses

**Cryptography:**
- [NIST SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) - Password-based key derivation
- [Web Crypto API Spec](https://www.w3.org/TR/WebCryptoAPI/) - Browser crypto standard
- [AES-GCM Security](https://csrc.nist.gov/publications/detail/sp/800-38d/final) - GCM mode specification

**Threat Modeling:**
- [STRIDE Threat Model](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) - Microsoft threat categorization
- [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling) - Threat modeling process

**Compliance:**
- [GDPR Requirements](https://gdpr.eu/) - European data protection
- [SOC 2 Trust Principles](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report) - Compliance framework

**Zero-Knowledge Patterns:**
- [1Password Security White Paper](https://1passwordstatic.com/files/security/1password-white-paper.pdf) - Industry reference
- [Bitwarden Security Assessment](https://bitwarden.com/help/is-bitwarden-audited/) - Security audits

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Security Lead | Initial threat model for Abyrith platform covering 7 threat categories, 5 attack scenarios, defense in depth strategy, and risk assessment matrix |

---

## Notes

### Next Steps

1. **Security Model Dependency:** This threat model references `03-security/security-model.md` which should be created next to define the comprehensive zero-knowledge architecture
2. **RLS Policy Implementation:** Detailed RLS policies must be documented in `03-security/rbac/rls-policies.md`
3. **Penetration Testing:** Schedule third-party security audit after MVP launch
4. **Security Runbook:** Create `10-operations/ops-security-runbook.md` with incident response procedures
5. **Automated Testing:** Implement automated security testing in CI/CD pipeline

### Future Enhancements

**Phase 2 (Post-MVP):**
- Automated anomaly detection using ML
- Real-time threat intelligence feeds
- Bug bounty program launch
- Security awareness training for users

**Phase 3 (Enterprise):**
- SOC 2 Type II certification
- ISO 27001 certification
- FIDO2/WebAuthn passwordless authentication
- Hardware security key support

### Known Limitations

- **User device security:** Cannot protect against compromised user devices
- **Browser vulnerabilities:** Dependent on browser vendors for security updates
- **Social engineering:** Cannot prevent all phishing attacks
- **Zero-day exploits:** Unknown vulnerabilities may exist

### Review Schedule

- **Monthly:** Review high-risk threats (P0, P1)
- **Quarterly:** Full threat model review and risk reassessment
- **Annually:** External security audit and penetration testing
- **Ad-hoc:** After any security incident or major architecture change

---

**Security is not a feature—it's the foundation. This threat model must evolve as the platform grows and new threats emerge.**
