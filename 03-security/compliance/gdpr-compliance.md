---
Document: GDPR Compliance - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Security Lead / Legal + Engineering
Status: Draft
Dependencies: 03-security/security-model.md, 04-database/schemas/audit-logs.md, 04-database/schemas/users-organizations.md, 04-database/schemas/secrets-metadata.md, GLOSSARY.md, TECH-STACK.md
---

# GDPR Compliance Architecture

## Overview

This document defines Abyrith's comprehensive compliance architecture for the General Data Protection Regulation (GDPR), the European Union's data protection and privacy regulation. Abyrith is designed with "privacy by design and default" as a core principle, leveraging zero-knowledge encryption to minimize data processing risks while enabling full compliance with GDPR's data subject rights requirements.

**Purpose:** Ensure Abyrith platform fully complies with GDPR requirements for European users while maintaining our zero-knowledge security architecture.

**Scope:** Data subject rights implementation, lawful basis for processing, cross-border data transfers, data protection impact assessments, breach notification procedures, and records of processing activities.

**Status:** Proposed - Core compliance architecture for MVP and post-MVP

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Data Subject Rights Implementation](#data-subject-rights-implementation)
5. [Lawful Basis for Processing](#lawful-basis-for-processing)
6. [Data Processing Architecture](#data-processing-architecture)
7. [Data Retention and Deletion](#data-retention-and-deletion)
8. [Cross-Border Data Transfers](#cross-border-data-transfers)
9. [Data Breach Notification](#data-breach-notification)
10. [Privacy by Design and Default](#privacy-by-design-and-default)
11. [Data Protection Impact Assessment](#data-protection-impact-assessment)
12. [Records of Processing Activities](#records-of-processing-activities)
13. [Subprocessors and DPAs](#subprocessors-and-dpas)
14. [Cookie Consent and Tracking](#cookie-consent-and-tracking)
15. [Children's Data Protection](#childrens-data-protection)
16. [Technical and Organizational Measures](#technical-and-organizational-measures)
17. [Dependencies](#dependencies)
18. [References](#references)
19. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
European users of cloud services face significant privacy risks when service providers have unrestricted access to their data. Traditional secrets management platforms require users to trust that providers won't access sensitive credentials, creating compliance challenges under GDPR's strict data protection requirements.

**Pain points:**
- Service providers can access unencrypted user data (processor vs. controller ambiguity)
- Data subject rights requests are manual and time-consuming
- Cross-border data transfers to US companies face legal uncertainty
- Compliance documentation is complex and error-prone
- Data breach notification requirements are difficult to meet within 72 hours
- Users have no visibility into data processing activities

**Why now?**
GDPR enforcement has intensified since 2018, with significant fines for non-compliance (up to €20 million or 4% of global turnover). European users increasingly demand GDPR-compliant services, and Abyrith's zero-knowledge architecture provides a unique compliance advantage.

### Background

**Existing system (if applicable):**
This is a new platform. No existing Abyrith system to replace.

**Previous attempts:**
Traditional secrets management platforms (1Password, LastPass, HashiCorp Vault) struggle with GDPR compliance because they can access unencrypted data, making them data processors under GDPR. This creates complex Data Processing Agreement (DPA) requirements and increases breach liability.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| European Users | Data privacy and control | Want assurance their data is protected and they can exercise rights |
| Enterprise Customers | GDPR compliance certification | Need proof of compliance for their audits and procurement |
| Data Protection Authorities | GDPR enforcement | Require evidence of compliance and rapid breach notification |
| Legal/Compliance Team | Risk mitigation | Need clear documentation and automated compliance processes |
| Engineering Team | Implementation complexity | Concerned about development overhead and technical debt |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Full GDPR compliance** - Meet all GDPR requirements for European users (Success metric: Pass third-party GDPR audit)
2. **Zero-knowledge advantage** - Leverage zero-knowledge architecture to minimize data processing liability (Success metric: Demonstrate we are NOT a data processor for encrypted secrets)
3. **Automated data subject rights** - Enable users to exercise rights (access, deletion, portability) automatically (Success metric: 95% of DSR requests fulfilled automatically in < 5 minutes)
4. **72-hour breach notification** - Detect and notify breaches within GDPR's 72-hour requirement (Success metric: Automated breach detection and notification system)
5. **Privacy by design** - Build privacy into every feature from the start (Success metric: Privacy review completed for 100% of new features)

**Secondary goals:**
- Generate GDPR compliance reports automatically
- Provide user-friendly privacy controls and dashboards
- Enable enterprise customers to meet their own GDPR obligations
- Maintain comprehensive Records of Processing Activities (ROPA)

### Non-Goals

**Explicitly out of scope:**
- **Other regional compliance frameworks** - Focus on GDPR first, adapt for CCPA/LGPD later (Why: GDPR is most stringent, achieving GDPR compliance makes other frameworks easier)
- **Legal advice** - This is technical implementation, not legal counsel (Why: Requires qualified legal professionals)
- **Non-EU user compliance** - GDPR applies only to EU residents or EU-targeted services (Why: Different requirements for other regions)
- **Retroactive compliance** - GDPR applies from service launch, not historical data (Why: New platform with no legacy data)

### Success Metrics

**How we measure success:**
- **Compliance:** Pass independent GDPR audit; zero GDPR fines or complaints
- **Data subject rights:** 95% of access/deletion/portability requests fulfilled automatically in < 5 minutes
- **Breach notification:** 100% of breaches detected and notified within 72 hours
- **User trust:** 90% of users rate privacy controls as "excellent" or "very good"
- **Documentation:** Records of Processing Activities maintained and up-to-date

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GDPR Compliance System                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Data Subject Rights Portal                   │ │
│  │  - Access Request (Data Export)                           │ │
│  │  - Deletion Request (Right to be Forgotten)               │ │
│  │  - Rectification (Data Correction)                        │ │
│  │  │  - Portability (Structured Data Export)                 │ │
│  │  - Restriction (Limit Processing)                         │ │
│  │  - Objection (Opt-out)                                    │ │
│  └───────────────────────┬───────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │          Data Processing Coordinator                      │ │
│  │  - Validate user identity                                 │ │
│  │  - Coordinate data collection across systems              │ │
│  │  - Execute deletion/anonymization                         │ │
│  │  - Generate compliance reports                            │ │
│  └───────────────────────┬───────────────────────────────────┘ │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              ▼                       ▼                          │
│  ┌──────────────────┐    ┌──────────────────────┐             │
│  │  User Data       │    │  Audit Logs          │             │
│  │  - Profile       │    │  - Access Events     │             │
│  │  - Secrets       │    │  - Actions           │             │
│  │  - Projects      │    │  - Timestamps        │             │
│  │  - Organizations │    └──────────────────────┘             │
│  └──────────────────┘                                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Breach Detection & Notification               │ │
│  │  - Real-time monitoring                                    │ │
│  │  - Automated DPA notification                              │ │
│  │  - User notification                                       │ │
│  │  - Incident documentation                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Records of Processing Activities (ROPA)       │ │
│  │  - Processing purposes                                     │ │
│  │  - Data categories                                         │ │
│  │  - Data subjects                                           │ │
│  │  - Retention periods                                       │ │
│  │  - Security measures                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Data Subject Rights Portal**
- **Purpose:** User-facing interface for exercising GDPR rights
- **Technology:** Next.js 14 + React 18, Tailwind CSS
- **Responsibilities:**
  - Provide easy-to-use interface for data access, deletion, rectification
  - Authenticate users before processing requests
  - Display progress and completion status
  - Generate exportable reports (JSON, CSV)

**Component 2: Data Processing Coordinator**
- **Purpose:** Backend service orchestrating GDPR compliance operations
- **Technology:** Cloudflare Workers (TypeScript), Supabase Edge Functions
- **Responsibilities:**
  - Validate and authenticate DSR (Data Subject Request) submissions
  - Coordinate data collection across tables
  - Execute deletion/anonymization operations
  - Generate compliance exports
  - Maintain ROPA (Records of Processing Activities)

**Component 3: Breach Detection & Notification System**
- **Purpose:** Detect security incidents and notify within 72 hours
- **Technology:** Supabase Realtime, Cloudflare Workers, external alerting (email/Slack)
- **Responsibilities:**
  - Real-time monitoring of suspicious activity
  - Automated breach severity assessment
  - DPA (Data Protection Authority) notification
  - User notification
  - Incident documentation for auditors

**Component 4: Privacy Dashboard**
- **Purpose:** User transparency and control over data processing
- **Technology:** Next.js 14 + React 18
- **Responsibilities:**
  - Display what data we process and why
  - Show data retention timelines
  - Allow users to manage consent
  - Export ROPA in user-friendly format

---

## Data Subject Rights Implementation

### Right to Access (Article 15)

**Purpose:** Users can obtain confirmation that we process their data and receive a copy of their personal data.

**Implementation:**

**Data Export Process:**
1. User clicks "Export My Data" in privacy dashboard
2. System validates user identity (require re-authentication)
3. Backend collects all user data from multiple tables:
   - User profile (email, name, profile picture)
   - Organization memberships and roles
   - Projects owned or member of
   - Secrets metadata (NOT encrypted values - we cannot decrypt)
   - Audit logs (user's actions)
   - Access events (user's secret accesses)
   - MCP requests (AI tool access requests)
4. System generates JSON export with human-readable format
5. User downloads export or receives via secure email link

**Data Included in Export:**
```typescript
interface GDPRDataExport {
  metadata: {
    export_date: string;
    user_id: string;
    format_version: string;
  };
  personal_information: {
    email: string;
    name: string;
    profile_picture_url?: string;
    created_at: string;
    last_login: string;
    email_verified: boolean;
  };
  organizations: OrganizationMembership[];
  projects: Project[];
  secrets: {
    // NOTE: We cannot export encrypted values (zero-knowledge)
    // Only metadata is exported
    secret_id: string;
    service_name: string;
    key_name: string;
    environment: string;
    tags: string[];
    created_at: string;
    last_accessed: string;
  }[];
  audit_logs: AuditLogEntry[];
  access_events: AccessEvent[];
  mcp_requests: MCPRequest[];
  consent_records: ConsentRecord[];
}
```

**Important Note on Zero-Knowledge Encryption:**
> We **cannot** export encrypted secret values because we do not have access to them (zero-knowledge architecture). The export includes secret metadata only. This is **compliant** with GDPR because the encrypted values are not personal data we process - they are user-controlled encrypted blobs we merely store.

**API Endpoint:**
```typescript
// POST /api/gdpr/data-export
// Generates GDPR-compliant data export
export async function handleDataExport(userId: string): Promise<GDPRDataExport> {
  // 1. Validate user authentication (require recent login)
  // 2. Collect data from all tables
  const userData = await collectUserData(userId);

  // 3. Format for export
  const exportData: GDPRDataExport = {
    metadata: {
      export_date: new Date().toISOString(),
      user_id: userId,
      format_version: '1.0.0'
    },
    personal_information: userData.profile,
    organizations: userData.organizations,
    projects: userData.projects,
    secrets: userData.secretsMetadata, // Only metadata, no values
    audit_logs: userData.auditLogs,
    access_events: userData.accessEvents,
    mcp_requests: userData.mcpRequests,
    consent_records: userData.consents
  };

  // 4. Log export event
  await createAuditLog({
    user_id: userId,
    event_type: 'gdpr.data_export',
    action: 'User requested GDPR data export',
    resource_type: 'user',
    resource_id: userId
  });

  return exportData;
}
```

**Timeline:** Data export available for download within 5 minutes (automated)

---

### Right to Deletion (Article 17 - "Right to be Forgotten")

**Purpose:** Users can request deletion of their personal data when there is no legal obligation to retain it.

**Implementation:**

**Deletion Process:**
1. User clicks "Delete My Account" in privacy dashboard
2. System displays clear warning about consequences:
   - All secrets will be permanently deleted
   - All projects owned by user will be deleted
   - Organization memberships will be removed
   - Audit logs will be anonymized (retain for compliance)
   - This action is **irreversible**
3. User must type "DELETE MY ACCOUNT" to confirm
4. System requires re-authentication (password or 2FA)
5. Backend executes deletion workflow:
   - Delete user profile
   - Delete all secrets owned by user
   - Transfer project ownership or delete projects
   - Remove organization memberships
   - Anonymize audit logs (replace user_id with NULL, keep event data)
6. User receives confirmation email
7. Account marked as deleted, data purged within 30 days

**What Gets Deleted:**
- User profile (email, name, profile picture)
- Authentication credentials
- All secrets owned by user (encrypted values + metadata)
- Projects where user is sole owner
- Organization memberships

**What Gets Anonymized (NOT Deleted):**
- Audit logs (required for compliance - anonymize user_id but keep event)
- Access events (security requirement - anonymize user_id)
- MCP requests (audit trail - anonymize user_id)

**Why Audit Logs Are Anonymized, Not Deleted:**
GDPR Article 17(3)(b) allows retention of data "for compliance with a legal obligation" or "for the establishment, exercise or defense of legal claims." Audit logs serve these purposes and must be retained for SOC 2 compliance (minimum 1 year).

**Anonymization Process:**
```sql
-- Replace user_id with NULL, keep event metadata
UPDATE audit_logs
SET user_id = NULL,
    metadata = jsonb_set(
      metadata,
      '{anonymized}',
      'true'
    )
WHERE user_id = '[deleted_user_id]';

-- Retain email in anonymized form for audit purposes
UPDATE audit_logs
SET metadata = jsonb_set(
      metadata,
      '{anonymized_email}',
      '"user_[hash_of_email]@deleted.abyrith.com"'
    )
WHERE user_id IS NULL AND user_id WAS '[deleted_user_id]';
```

**API Endpoint:**
```typescript
// POST /api/gdpr/delete-account
// Deletes user account and anonymizes audit trail
export async function handleAccountDeletion(userId: string, confirmation: string): Promise<void> {
  // 1. Validate confirmation
  if (confirmation !== 'DELETE MY ACCOUNT') {
    throw new Error('Confirmation string does not match');
  }

  // 2. Delete user data
  await deleteUserData(userId);

  // 3. Anonymize audit logs
  await anonymizeAuditLogs(userId);

  // 4. Mark account as deleted
  await markAccountDeleted(userId);

  // 5. Send confirmation email
  await sendDeletionConfirmationEmail(userId);

  // 6. Log deletion event (before user_id is nullified)
  await createAuditLog({
    user_id: userId,
    event_type: 'gdpr.account_deleted',
    action: 'User requested account deletion (Right to be Forgotten)',
    resource_type: 'user',
    resource_id: userId
  });
}
```

**Timeline:** Account deletion completed within 30 days; immediate logout and data access revocation

---

### Right to Rectification (Article 16)

**Purpose:** Users can correct inaccurate or incomplete personal data.

**Implementation:**

**What Users Can Rectify:**
- Email address (requires email verification)
- Name / display name
- Profile picture
- Organization details (if Owner)
- Project metadata (if Owner)
- Secret metadata (service name, key name, tags)

**What Users Cannot Rectify:**
- Encrypted secret values (require deletion + recreation due to zero-knowledge)
- Audit logs (immutable for compliance)
- Historical access events (immutable for security)

**Rectification Process:**
1. User navigates to profile settings
2. Edits field (email, name, etc.)
3. System validates new data
4. If email change: Send verification email to new address
5. Update database with new values
6. Log rectification event in audit log

**API Endpoint:**
```typescript
// PUT /api/gdpr/rectify
// Updates user personal data
export async function handleDataRectification(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  // 1. Validate updates
  validateProfileUpdates(updates);

  // 2. If email change, require verification
  if (updates.email) {
    await sendEmailVerification(updates.email);
    // Email change completes after verification
  }

  // 3. Update user profile
  await updateUserProfile(userId, updates);

  // 4. Log rectification
  await createAuditLog({
    user_id: userId,
    event_type: 'gdpr.data_rectified',
    action: 'User updated personal information',
    resource_type: 'user',
    resource_id: userId,
    metadata: {
      fields_updated: Object.keys(updates)
    }
  });
}
```

**Timeline:** Immediate (synchronous operation)

---

### Right to Data Portability (Article 20)

**Purpose:** Users can receive their personal data in a structured, commonly used, machine-readable format and transmit it to another controller.

**Implementation:**

**Export Formats:**
- **JSON** (primary format, machine-readable)
- **CSV** (for spreadsheet software)
- **XML** (for enterprise systems)

**Portability Scope:**
Data provided by the user or generated by their use of the service:
- User profile
- Organization memberships
- Projects and secret metadata
- Audit logs and access events
- Consent records

**Not Included (Not User-Provided Data):**
- Server logs
- Internal system metrics
- Derived analytics

**Export Structure (JSON):**
```json
{
  "format": "GDPR Data Portability Export",
  "version": "1.0.0",
  "export_date": "2025-10-30T12:00:00Z",
  "user": {
    "email": "user@example.com",
    "name": "Jane Doe",
    "created_at": "2025-01-15T10:00:00Z"
  },
  "secrets": [
    {
      "secret_id": "uuid",
      "service_name": "openai",
      "key_name": "OPENAI_API_KEY",
      "environment": "production",
      "tags": ["ai", "api-key"],
      "created_at": "2025-01-20T14:30:00Z",
      "note": "Encrypted value not exportable (zero-knowledge)"
    }
  ],
  "audit_logs": [...],
  "consents": [...]
}
```

**API Endpoint:**
```typescript
// GET /api/gdpr/data-portability?format=json
// Generates GDPR-compliant portable data export
export async function handleDataPortability(
  userId: string,
  format: 'json' | 'csv' | 'xml'
): Promise<Blob> {
  // 1. Collect user data
  const userData = await collectUserData(userId);

  // 2. Format according to requested format
  let exportBlob: Blob;
  switch (format) {
    case 'json':
      exportBlob = generateJSONExport(userData);
      break;
    case 'csv':
      exportBlob = generateCSVExport(userData);
      break;
    case 'xml':
      exportBlob = generateXMLExport(userData);
      break;
  }

  // 3. Log portability request
  await createAuditLog({
    user_id: userId,
    event_type: 'gdpr.data_portability',
    action: `User exported data in ${format} format`,
    resource_type: 'user',
    resource_id: userId
  });

  return exportBlob;
}
```

**Timeline:** Export available for download within 5 minutes (automated)

---

### Right to Restrict Processing (Article 18)

**Purpose:** Users can request restriction of processing under certain circumstances (e.g., disputing accuracy of data).

**Implementation:**

**Restriction Scenarios:**
1. User contests accuracy of data (restrict until verified)
2. Processing is unlawful but user doesn't want deletion
3. We no longer need data but user needs it for legal claims

**What "Restriction" Means:**
- Data is stored but not processed (no analysis, no sharing)
- User can still access their data
- We can store data and respond to legal claims
- We cannot use data for other purposes

**Restriction Process:**
1. User submits restriction request via support or dashboard
2. Compliance team reviews request (manual, within 30 days)
3. If approved, mark account with `processing_restricted: true`
4. System prevents non-essential processing:
   - No marketing emails
   - No data sharing with subprocessors (where possible)
   - No analytics or usage tracking
5. User can lift restriction or request deletion at any time

**Database Implementation:**
```sql
ALTER TABLE user_profiles
ADD COLUMN processing_restricted BOOLEAN DEFAULT false,
ADD COLUMN restriction_reason TEXT,
ADD COLUMN restricted_at TIMESTAMPTZ;

-- When restricted, flag the user
UPDATE user_profiles
SET processing_restricted = true,
    restriction_reason = 'User contests data accuracy',
    restricted_at = NOW()
WHERE id = '[user_id]';
```

**Application Logic:**
```typescript
// Before processing user data, check restriction flag
async function canProcessUserData(userId: string): Promise<boolean> {
  const user = await getUserProfile(userId);

  if (user.processing_restricted) {
    // Only allow essential processing (access to account, legal claims)
    return false;
  }

  return true;
}
```

**Timeline:** Restriction applied within 30 days of request (manual review required)

---

### Right to Object (Article 21)

**Purpose:** Users can object to processing based on legitimate interests or for direct marketing.

**Implementation:**

**Objection Scenarios:**
1. Direct marketing (must stop immediately)
2. Processing based on legitimate interests (must assess and potentially stop)
3. Scientific/historical research (must respect unless research purpose cannot be achieved)

**Marketing Opt-Out:**
- User can opt out of all marketing communications immediately
- Preference stored in `user_preferences` table
- Email service checks opt-out flag before sending

**Legitimate Interest Objection:**
- User can object to processing not strictly necessary
- Examples: Usage analytics, feature usage tracking
- Must assess whether to continue (balance user rights vs. our legitimate interests)

**Implementation:**
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Marketing preferences
  marketing_emails BOOLEAN DEFAULT false,
  product_updates BOOLEAN DEFAULT true,

  -- Analytics preferences
  usage_analytics BOOLEAN DEFAULT true,
  error_reporting BOOLEAN DEFAULT true,

  -- Legitimate interest objections
  objection_submitted BOOLEAN DEFAULT false,
  objection_reason TEXT,
  objection_resolved BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**API Endpoint:**
```typescript
// POST /api/gdpr/object
// User objects to processing
export async function handleObjection(
  userId: string,
  objectionType: 'marketing' | 'legitimate_interest',
  reason?: string
): Promise<void> {
  if (objectionType === 'marketing') {
    // Immediate opt-out
    await updateUserPreferences(userId, {
      marketing_emails: false
    });
  } else {
    // Legitimate interest objection requires review
    await createObjectionRecord(userId, reason);
    // Compliance team notified for review
    await notifyComplianceTeam(userId, reason);
  }

  await createAuditLog({
    user_id: userId,
    event_type: 'gdpr.objection_submitted',
    action: `User objected to ${objectionType}`,
    resource_type: 'user',
    resource_id: userId,
    metadata: { reason }
  });
}
```

**Timeline:**
- Marketing opt-out: Immediate
- Legitimate interest objection: Reviewed and resolved within 30 days

---

## Lawful Basis for Processing

**GDPR Article 6** requires a lawful basis for processing personal data. Abyrith relies on multiple bases depending on the processing activity.

### Processing Activity Matrix

| Processing Activity | Lawful Basis | GDPR Article | Justification |
|---------------------|--------------|--------------|---------------|
| Account creation | **Contract (Art 6(1)(b))** | Performance of contract | Necessary to provide service |
| Secret storage | **Contract (Art 6(1)(b))** | Performance of contract | Core service feature |
| Authentication | **Contract (Art 6(1)(b))** | Performance of contract | Required for secure access |
| Audit logging | **Legal Obligation (Art 6(1)(c))** | Compliance with law | Required for SOC 2, security regulations |
| Security monitoring | **Legitimate Interest (Art 6(1)(f))** | Fraud prevention, security | Necessary to protect user accounts |
| Email communications (service updates) | **Contract (Art 6(1)(b))** | Performance of contract | Necessary service communications |
| Email communications (marketing) | **Consent (Art 6(1)(a))** | User consent | Optional, opt-in marketing |
| Usage analytics | **Legitimate Interest (Art 6(1)(f))** | Product improvement | Minimal, pseudonymized, user can object |
| Breach notification | **Legal Obligation (Art 6(1)(c))** | GDPR Article 33/34 | Required to notify users and DPA |

### Consent Management

**When Consent is Required:**
- Marketing communications (newsletters, product announcements)
- Optional analytics (beyond essential usage tracking)
- Cookie placement (non-essential cookies)

**Consent Requirements (GDPR Article 7):**
- **Freely given:** Users can refuse without consequences
- **Specific:** Separate consent for each purpose (not bundled)
- **Informed:** Clear explanation of what data and why
- **Unambiguous:** Affirmative action (checkbox, not pre-ticked)
- **Withdrawable:** Easy to withdraw consent (one-click unsubscribe)

**Consent Record Structure:**
```typescript
interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: 'marketing' | 'analytics' | 'cookies';
  consent_given: boolean;
  consent_date: string;
  consent_method: 'signup_checkbox' | 'preference_page' | 'cookie_banner';
  consent_withdrawn: boolean;
  withdrawn_date?: string;
  ip_address: string; // Evidence of consent
  user_agent: string;
}
```

**Database Table:**
```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_method TEXT NOT NULL,
  consent_withdrawn BOOLEAN DEFAULT false,
  withdrawn_date TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,

  CONSTRAINT valid_consent_type CHECK (consent_type IN (
    'marketing',
    'analytics',
    'cookies_functional',
    'cookies_analytics',
    'cookies_marketing'
  ))
);

CREATE INDEX idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX idx_consent_records_type ON consent_records(user_id, consent_type);
```

---

## Data Processing Architecture

### Data Controller vs. Data Processor

**Abyrith's Role:**
- **Data Controller** for user account data (email, name, profile)
- **NOT a Data Processor** for encrypted secrets (we cannot access them)
- **Data Processor** for secret metadata (service name, tags) if used by enterprise organizations

**Zero-Knowledge Architecture Advantage:**
> Because Abyrith uses client-side encryption and cannot decrypt user secrets, we are **NOT a data processor** for the encrypted secret values. This significantly reduces our GDPR liability and eliminates the need for Data Processing Agreements (DPAs) with users for the secret values themselves.

### Data Categories We Process

**Personal Data Categories:**

1. **Identity Data**
   - Email address
   - Name / display name
   - User ID (UUID)
   - Profile picture (optional)

2. **Authentication Data**
   - Password hash (never plaintext)
   - 2FA secrets (TOTP seeds)
   - OAuth tokens (from Google, GitHub)
   - Session tokens (JWT)

3. **Usage Data**
   - Audit logs (actions taken)
   - Access events (secrets accessed)
   - MCP requests (AI tool access)
   - Timestamps

4. **Technical Data**
   - IP addresses
   - User agent strings
   - Device information (browser, OS)

5. **Organizational Data** (for enterprise users)
   - Organization memberships
   - Team roles (Owner, Admin, Developer)
   - Project memberships

**Not Personal Data (Zero-Knowledge):**
- Encrypted secret values (we cannot access or process them)

### Data Flow Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ Provides email, name during signup
       │ Encrypts secrets client-side
       ▼
┌──────────────────────────────────────┐
│     Abyrith Platform                 │
│  ┌────────────────────────────────┐  │
│  │  Data We Process (Controller)  │  │
│  │  - Email, name, profile        │  │
│  │  - Audit logs, access events   │  │
│  │  - Organization memberships    │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Data We Store (Not Process)   │  │
│  │  - Encrypted secrets (blobs)   │  │
│  │  - Cannot decrypt or access    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
       │
       │ Stored in Supabase (EU region)
       │ Cached at edge (Cloudflare EU data centers)
       ▼
┌──────────────────────────────────────┐
│         Subprocessors                │
│  - Supabase (database)               │
│  - Cloudflare (edge, CDN)            │
│  - Anthropic (Claude API, optional)  │
│  - FireCrawl (doc scraping, optional)│
└──────────────────────────────────────┘
```

---

## Data Retention and Deletion

### Retention Policies by Data Type

| Data Type | Retention Period | Justification | Deletion Method |
|-----------|------------------|---------------|-----------------|
| User profile | Until account deletion | Contract performance | Hard delete |
| Encrypted secrets | Until user deletes | Contract performance | Hard delete (overwrite with NULL) |
| Audit logs | 2 years | Legal obligation (SOC 2) | Automated deletion after 2 years |
| Access events | 2 years | Security requirement | Automated deletion after 2 years |
| MCP requests | 2 years | Audit trail | Automated deletion after 2 years |
| Session tokens | 15 minutes | Security best practice | Automatic expiration |
| Consent records | 3 years after withdrawal | Legal defense | Automated deletion |
| Deleted account data (anonymized) | 2 years | Legal obligation | Automated deletion |

### Retention Policy Rationale

**2-Year Retention for Audit Logs:**
- **SOC 2 Type II:** Requires audit logs for annual audits (minimum 1 year, best practice 2 years)
- **GDPR Article 17(3)(b):** Allows retention for compliance with legal obligations
- **Legal Claims:** Provides evidence for potential disputes (statute of limitations)

**Account Deletion Process:**
1. User requests account deletion
2. Immediate: Revoke access (logout, invalidate sessions)
3. Day 1-30: "Soft delete" - mark account as deleted, data retained for recovery
4. Day 30: "Hard delete" - purge user data from database
5. Audit logs anonymized (user_id nullified, event data retained)

**Automated Cleanup Jobs:**
```typescript
// Run monthly: Delete audit logs older than 2 years
async function cleanupOldAuditLogs() {
  await supabase
    .from('audit_logs')
    .delete()
    .lt('created_at', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000));
}

// Run daily: Permanently delete accounts after 30-day grace period
async function cleanupDeletedAccounts() {
  const deleteDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const deletedUsers = await supabase
    .from('user_profiles')
    .select('id')
    .eq('account_deleted', true)
    .lt('deleted_at', deleteDate);

  for (const user of deletedUsers) {
    await permanentlyDeleteUser(user.id);
  }
}
```

---

## Cross-Border Data Transfers

### Data Location Strategy

**Primary Storage:**
- **Supabase:** EU region (Frankfurt, Germany) for European users
- **Cloudflare Workers KV:** EU data centers for edge caching
- **Cloudflare Pages:** Global CDN with EU origin

**Data Transfer Scenarios:**

**1. EU User → EU Servers (No Transfer)**
- User data stored in Supabase EU region
- No cross-border transfer
- **Compliant:** Data stays within EU

**2. EU User → US Subprocessors (Transfer)**
- Anthropic Claude API (US-based)
- FireCrawl API (US-based)
- **Mechanism:** Standard Contractual Clauses (SCCs)
- **Safeguard:** Minimal data transfer (only necessary for AI features)

### Legal Mechanisms for Cross-Border Transfers

**Standard Contractual Clauses (SCCs):**
- Use European Commission approved SCCs with all US-based subprocessors
- SCCs establish contractual obligations for data protection
- Valid under GDPR Article 46(2)(c)

**Data Processing Agreements (DPAs):**
- Signed with Supabase, Cloudflare, Anthropic, FireCrawl
- Specify purpose, duration, and security measures
- Require subprocessors to comply with GDPR

**Transfer Impact Assessment (TIA):**
For each US-based subprocessor, we perform:
1. Assessment of US surveillance laws (FISA, CLOUD Act)
2. Evaluation of supplementary measures
3. Documentation of data protection safeguards

**Supplementary Measures:**
- **Anthropic Claude API:** No personally identifiable information (PII) sent
  - Only send API documentation URLs and anonymized queries
  - No user emails, names, or secret values transmitted
- **FireCrawl API:** Only public URLs scraped
  - No user data sent to FireCrawl
  - Scraping is on-demand, no data retention by FireCrawl

### User Data Transfer Transparency

**Privacy Dashboard Disclosure:**
Users can see:
- Where their data is stored (EU region)
- Which subprocessors have access to data
- Purpose of each data transfer
- Legal basis for transfer (SCCs)

---

## Data Breach Notification

**GDPR Articles 33 & 34** require notification of data breaches to supervisory authorities within 72 hours and affected users "without undue delay."

### Breach Detection System

**What Constitutes a Breach:**
- Unauthorized access to database (Supabase intrusion)
- Unauthorized access to encrypted secrets (even if not decrypted)
- Exposure of user email addresses or personal data
- Accidental public exposure of data (misconfigured S3 bucket, etc.)
- Loss of data availability (ransomware, deletion)

**What is NOT a Breach (Zero-Knowledge Protection):**
- Database compromise where only encrypted secrets are accessed
  - Attacker cannot decrypt secrets without user master passwords
  - No breach of personal data if only encrypted blobs accessed
- Failed login attempts (normal security event)
- User forgetting master password (user error, not breach)

### Breach Severity Assessment

**Severity Levels:**

**Critical (Notify immediately):**
- Plaintext user data exposed (email addresses, names)
- Authentication credentials compromised
- Master passwords or encryption keys compromised
- Mass data exfiltration

**High (Notify within 24 hours):**
- Unauthorized access to encrypted secrets
- Access to audit logs or metadata
- Compromise of admin accounts

**Medium (Notify within 72 hours):**
- Limited user data exposure (< 100 users)
- Brief unauthorized access (logged and blocked)

**Low (Internal review, may not require notification):**
- Failed attack attempts (no data accessed)
- Vulnerability discovered and patched before exploitation

### 72-Hour Notification Workflow

**Detection → Assessment → Notification**

**Phase 1: Detection (0-2 hours)**
1. **Automated Monitoring:**
   - Supabase alerts on unusual database access patterns
   - Cloudflare alerts on traffic anomalies
   - Audit log monitoring for suspicious activity patterns
2. **Manual Detection:**
   - Security researcher reports vulnerability
   - User reports suspicious account activity
3. **Immediate Actions:**
   - Trigger incident response team
   - Begin forensic investigation
   - Contain breach (revoke access, block IPs, etc.)

**Phase 2: Assessment (2-24 hours)**
1. Determine what data was accessed
2. Identify affected users (UUIDs)
3. Assess severity (Critical/High/Medium/Low)
4. Determine if breach involves personal data (GDPR applies)
5. Document findings in incident report

**Phase 3: Notification to DPA (24-72 hours)**
**Requirement:** Notify supervisory authority within 72 hours (Article 33)

**DPA Notification Contents:**
- Description of breach nature
- Categories and approximate number of affected users
- Likely consequences of breach
- Measures taken or proposed to address breach
- Contact point for further information

**Responsible DPA:**
- **Lead Supervisory Authority:** Irish Data Protection Commission (DPC) if EU headquarters in Ireland
- **Or:** DPA in EU country where we have "main establishment"

**Notification Method:**
- Email to DPA (secure email)
- Online breach notification form (if available)
- Follow-up with detailed written report

**Phase 4: Notification to Users (0-72 hours)**
**Requirement:** Notify affected users "without undue delay" if breach likely to result in high risk to their rights and freedoms (Article 34)

**User Notification Contents:**
- Description of breach in clear, plain language
- Contact point for questions
- Likely consequences of breach
- Measures we have taken
- Measures users should take (e.g., change password, enable 2FA)

**Notification Methods:**
- Direct email to affected users
- In-app notification (if user logs in)
- Public statement on website (if cannot contact individually)

**Example Email Template:**
```
Subject: Security Incident Notification - Action Required

Dear [User Name],

We are writing to inform you of a security incident affecting your Abyrith account.

What happened:
On [date], we discovered unauthorized access to our database. The attacker accessed [description of data], including your [specific data: email address, name, etc.].

What was NOT affected:
Your encrypted secrets were not accessed or decrypted. Due to our zero-knowledge encryption architecture, only you have the ability to decrypt your secrets.

What we've done:
- Immediately blocked the attacker's access
- Strengthened security measures to prevent future incidents
- Notified the Irish Data Protection Commission
- Engaged forensic security experts to investigate

What you should do:
1. Change your Abyrith account password immediately
2. Enable two-factor authentication (2FA) if you haven't already
3. Review your audit logs for any suspicious activity
4. Monitor your email for phishing attempts

For questions, contact: security@abyrith.com

We sincerely apologize for this incident and are taking all necessary steps to prevent future occurrences.

Abyrith Security Team
```

### Breach Documentation

**Incident Report Template:**
```typescript
interface BreachIncidentReport {
  incident_id: string;
  detection_date: string;
  detection_method: string;
  breach_description: string;
  data_categories_affected: string[];
  number_of_affected_users: number;
  severity_level: 'critical' | 'high' | 'medium' | 'low';
  dpa_notified: boolean;
  dpa_notification_date?: string;
  users_notified: boolean;
  user_notification_date?: string;
  containment_measures: string[];
  remediation_measures: string[];
  lessons_learned: string;
  report_author: string;
  report_date: string;
}
```

**Storage:**
- Breach incident reports stored in secure, access-controlled location
- Available for audit by DPA or auditors
- Retained for 5 years (legal defense)

---

## Privacy by Design and Default

**GDPR Article 25** requires privacy to be considered at the design stage and that default settings should be privacy-friendly.

### Privacy by Design Principles

**1. Proactive not Reactive**
- Zero-knowledge encryption designed from the start (not added later)
- Privacy review required for all new features
- Threat modeling includes privacy risks

**2. Privacy as the Default Setting**
- Marketing emails opt-in (not opt-out)
- Minimal data collection by default
- Encryption enabled automatically (no user configuration)
- Audit logging anonymizes IP addresses in compliance mode

**3. Privacy Embedded into Design**
- Master password never transmitted to server
- Client-side encryption before data leaves browser
- Row-Level Security enforces data isolation at database level

**4. Positive-Sum (Not Zero-Sum)**
- Security AND usability (not security OR usability)
- Privacy AND AI features (AI works on metadata, not sensitive data)

**5. End-to-End Security**
- TLS 1.3 in transit
- AES-256-GCM at rest (client-side)
- Access control at every layer (client, API gateway, database)

**6. Visibility and Transparency**
- Privacy dashboard shows what data we process
- Audit logs show all actions taken
- ROPA (Records of Processing Activities) available to users

**7. Respect for User Privacy**
- User controls their data (export, delete, rectify)
- Zero-knowledge means we cannot access secrets even if subpoenaed
- Clear, plain-language privacy policy

### Privacy by Default Implementation

**Examples:**

**Feature: AI Secret Assistant**
- **Privacy by Design:** AI only receives service name and public API documentation URLs (no secret values)
- **Privacy by Default:** AI features opt-in for enterprise users (not enabled by default)

**Feature: Audit Logging**
- **Privacy by Design:** IP addresses hashed or anonymized in logs for non-essential events
- **Privacy by Default:** Audit logs visible only to user who performed action (not team by default)

**Feature: Team Collaboration**
- **Privacy by Design:** Secrets shared with explicit permission only (no default access)
- **Privacy by Default:** New team members start with "Read-Only" role (least privilege)

---

## Data Protection Impact Assessment

**GDPR Article 35** requires Data Protection Impact Assessments (DPIA) for processing that is likely to result in high risk to individuals' rights and freedoms.

### When DPIA is Required

**High-Risk Processing (DPIA Required):**
- Systematic and extensive profiling with automated decision-making
- Large-scale processing of sensitive data
- Systematic monitoring of publicly accessible areas (CCTV, etc.)

**Abyrith's Assessment:**
- **Zero-knowledge encryption** significantly reduces risk
- **No automated decision-making** affecting users
- **No sensitive data processing** (secrets are user-encrypted blobs)
- **Minimal profiling** (only usage analytics, pseudonymized)

**Conclusion:** DPIA not strictly required, but we conduct one as best practice.

### DPIA Template for Abyrith

**1. Description of Processing:**
- Purpose: Secure storage and management of developer API keys
- Data categories: Email, name, encrypted secrets, audit logs
- Data subjects: Individual developers and enterprise teams
- Retention: 2 years for audit logs, indefinite for active accounts

**2. Necessity and Proportionality:**
- Is processing necessary? **Yes** - core service functionality
- Is data collection minimized? **Yes** - only essential data collected
- Are there less intrusive alternatives? **No** - zero-knowledge is most privacy-preserving

**3. Risks to Individuals:**
- **Risk 1:** Database breach exposing email addresses
  - Likelihood: Low (strong security controls)
  - Severity: Medium (email addresses are low-sensitivity)
  - Mitigation: Encryption at rest, access controls, breach notification
- **Risk 2:** Insider threat (malicious employee)
  - Likelihood: Very Low (least privilege access, audit logging)
  - Severity: Medium (cannot decrypt secrets, only see metadata)
  - Mitigation: Zero-knowledge architecture, background checks, monitoring
- **Risk 3:** User loses master password (data loss)
  - Likelihood: Low (password recovery warnings, recovery keys)
  - Severity: High (user loses all secrets)
  - Mitigation: Prominent warnings, optional recovery key, clear documentation

**4. Measures to Mitigate Risks:**
- Zero-knowledge encryption (secrets cannot be decrypted by us)
- Row-Level Security in database (multi-tenancy isolation)
- Comprehensive audit logging (detect suspicious activity)
- 2FA/MFA options (prevent account takeover)
- Regular security audits and penetration testing
- Breach detection and 72-hour notification system

**5. Sign-Off:**
- Conducted by: Security Lead + Legal Counsel
- Reviewed by: Engineering Lead + Product Lead
- Approved by: CEO / Data Protection Officer
- Date: [To be completed before launch]
- Next review: Annually or when processing activities change

**DPIA Outcome:** Processing is compliant with GDPR, risks are acceptable and adequately mitigated.

---

## Records of Processing Activities

**GDPR Article 30** requires controllers to maintain Records of Processing Activities (ROPA).

### ROPA Template

**Processing Activity 1: User Account Management**
- **Purpose:** Provide account registration and authentication
- **Legal Basis:** Contract (Article 6(1)(b))
- **Data Subjects:** Individual users and enterprise team members
- **Data Categories:** Email address, name, password hash, profile picture
- **Recipients:** Supabase (database), Cloudflare (CDN)
- **Retention:** Until account deletion
- **Security Measures:** AES-256 encryption at rest, TLS 1.3 in transit, Row-Level Security

**Processing Activity 2: Secret Storage**
- **Purpose:** Encrypted storage of API keys and credentials
- **Legal Basis:** Contract (Article 6(1)(b))
- **Data Subjects:** Individual users and enterprise team members
- **Data Categories:** Encrypted secret values (we cannot decrypt), secret metadata (service name, tags)
- **Recipients:** Supabase (database)
- **Retention:** Until user deletes secret
- **Security Measures:** Client-side AES-256-GCM encryption, zero-knowledge architecture, RLS

**Processing Activity 3: Audit Logging**
- **Purpose:** Security monitoring, compliance, forensic investigation
- **Legal Basis:** Legal Obligation (Article 6(1)(c)) + Legitimate Interest (Article 6(1)(f))
- **Data Subjects:** Individual users and enterprise team members
- **Data Categories:** User actions, timestamps, IP addresses (anonymized), user agent
- **Recipients:** Supabase (database), Sentry (error tracking, optional)
- **Retention:** 2 years
- **Security Measures:** Immutable logs (INSERT-only), RLS, encryption at rest

**Processing Activity 4: AI Secret Assistant (Optional)**
- **Purpose:** Provide AI-powered guidance for obtaining API keys
- **Legal Basis:** Contract (Article 6(1)(b))
- **Data Subjects:** Users who enable AI assistant
- **Data Categories:** Service names (e.g., "OpenAI"), API documentation URLs (public)
- **Recipients:** Anthropic (Claude API)
- **Retention:** Conversation history for user session only (not retained long-term)
- **Security Measures:** No secret values transmitted, no PII sent to AI, TLS 1.3

**Processing Activity 5: Marketing Communications (Optional)**
- **Purpose:** Send product updates and promotional emails
- **Legal Basis:** Consent (Article 6(1)(a))
- **Data Subjects:** Users who opt in to marketing
- **Data Categories:** Email address, name
- **Recipients:** Email service provider (e.g., SendGrid, AWS SES)
- **Retention:** Until consent withdrawn + 3 years (legal defense)
- **Security Measures:** Opt-in only, one-click unsubscribe, TLS encryption

**Processing Activity 6: Usage Analytics (Anonymized)**
- **Purpose:** Understand product usage, improve features
- **Legal Basis:** Legitimate Interest (Article 6(1)(f))
- **Data Subjects:** All users (anonymized)
- **Data Categories:** Page views, feature usage, anonymized user IDs
- **Recipients:** Cloudflare Analytics (privacy-friendly), Sentry (error tracking)
- **Retention:** 90 days
- **Security Measures:** Pseudonymization, no cookies (Cloudflare Analytics), user can object

### ROPA Maintenance

**Update Frequency:**
- Quarterly review of all processing activities
- Immediate update when new processing activity added
- Annual comprehensive audit

**Responsibility:**
- Maintained by: Data Protection Officer (DPO) or Security Lead
- Reviewed by: Legal Counsel + Engineering Lead
- Available to: Data Protection Authorities upon request, users upon request (simplified version)

---

## Subprocessors and DPAs

**GDPR Article 28** requires Data Processing Agreements (DPAs) with subprocessors who process personal data on our behalf.

### Subprocessor List

| Subprocessor | Service | Data Processed | Location | DPA Status | Purpose |
|--------------|---------|----------------|----------|------------|---------|
| Supabase | Database, Auth | User profile, encrypted secrets, audit logs | EU (Frankfurt) | ✅ Signed | Core data storage |
| Cloudflare | CDN, Workers | User profile (cached), IP addresses | Global (EU data centers) | ✅ Signed | Edge computing, caching |
| Anthropic | Claude API | Service names, API doc URLs (no PII) | US | ✅ Signed | AI secret assistant |
| FireCrawl | Web scraping | Public API documentation URLs | US | ✅ Signed | Documentation scraping |
| SendGrid / AWS SES | Email | Email addresses, names | US / EU | ✅ Signed | Transactional emails |
| Sentry (optional) | Error tracking | Error logs, anonymized user IDs | US / EU | ✅ Signed | Application monitoring |

### Data Processing Agreement (DPA) Requirements

**DPA Must Specify:**
1. Subject matter and duration of processing
2. Nature and purpose of processing
3. Type of personal data and categories of data subjects
4. Obligations and rights of controller (Abyrith)
5. Security measures required
6. Subprocessor's obligation to notify of data breaches
7. Subprocessor's obligation to assist with GDPR compliance
8. Deletion of data upon termination

**DPA Template:**
```markdown
# Data Processing Agreement

This Data Processing Agreement ("DPA") is entered into between:
- Abyrith ("Controller")
- [Subprocessor Name] ("Processor")

## 1. Subject Matter
Processor will provide [service description] to Controller.

## 2. Duration
This DPA is effective from [start date] until termination of the main service agreement.

## 3. Nature and Purpose
Processor will process personal data for the purpose of [purpose].

## 4. Personal Data Categories
- User email addresses
- [Other data categories]

## 5. Data Subject Categories
- Individual users of Abyrith platform
- [Other categories]

## 6. Processor Obligations
Processor shall:
- Process data only on documented instructions from Controller
- Ensure personnel are bound by confidentiality
- Implement appropriate technical and organizational measures (Article 32)
- Notify Controller of data breaches without undue delay (within 24 hours)
- Assist Controller with data subject rights requests
- Delete or return data upon termination of services

## 7. Subprocessors
Processor may engage subprocessors only with prior written consent from Controller.

## 8. International Transfers
If Processor transfers data outside EU:
- Use Standard Contractual Clauses (SCCs)
- Perform Transfer Impact Assessment (TIA)
- Implement supplementary measures

## 9. Audit Rights
Controller has the right to audit Processor's compliance with this DPA.

## 10. Liability
Processor is liable for damages caused by non-compliance with GDPR.

Signed:
Abyrith: ____________________ Date: ________
[Subprocessor]: ______________ Date: ________
```

### Subprocessor Change Notification

**Process:**
1. Abyrith identifies need for new subprocessor
2. Conduct due diligence (security, GDPR compliance, location)
3. Sign DPA with new subprocessor
4. Notify users 30 days before engaging subprocessor
5. Users can object within 30 days
6. Update subprocessor list in privacy policy

**User Notification Template:**
```
Subject: Subprocessor Change Notification

Dear Abyrith User,

We are updating our subprocessor list to include [New Subprocessor Name] for [purpose].

What this means:
[New Subprocessor] will process [data categories] for the purpose of [purpose].

Location: [EU/US]
Data Protection: We have signed a Data Processing Agreement and ensured GDPR compliance.

Your rights:
If you object to this change, you may terminate your account within 30 days without penalty.

View our full subprocessor list: https://abyrith.com/privacy/subprocessors

Questions? Contact: privacy@abyrith.com

Abyrith Privacy Team
```

---

## Cookie Consent and Tracking

**ePrivacy Directive** (and GDPR) requires consent for non-essential cookies and tracking.

### Cookie Categories

**Essential Cookies (No Consent Required):**
- Session cookies (authentication)
- Security cookies (CSRF tokens)
- Load balancing cookies

**Non-Essential Cookies (Consent Required):**
- Analytics cookies (Cloudflare Analytics, Sentry)
- Marketing cookies (if we add ad tracking)
- Third-party cookies (if we embed external content)

### Cookie Consent Implementation

**Cookie Banner:**
```
🍪 Cookie Notice

We use cookies to provide authentication and essential functionality.

[ ] Analytics cookies (help us improve the product)
[ ] Marketing cookies (personalized content)

[Accept All] [Reject Non-Essential] [Customize]

Learn more: Privacy Policy | Cookie Policy
```

**Consent Requirements:**
- Not pre-ticked (user must actively check boxes)
- Granular control (separate consent for analytics, marketing)
- Easy to withdraw (one-click in settings)
- No cookie wall (user can use service with essential cookies only)

**Cookie Banner Logic:**
```typescript
interface CookieConsent {
  essential: boolean; // Always true (required for service)
  analytics: boolean; // User choice
  marketing: boolean; // User choice
  timestamp: string;
  version: string; // Cookie policy version
}

// Only set non-essential cookies if user consented
function loadAnalyticsCookies(consent: CookieConsent) {
  if (consent.analytics) {
    // Load Cloudflare Analytics
    loadCloudflareAnalytics();
  }
}

function loadMarketingCookies(consent: CookieConsent) {
  if (consent.marketing) {
    // Load marketing tracking (if any)
  }
}
```

**Storage:**
```sql
CREATE TABLE cookie_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  essential BOOLEAN DEFAULT true,
  analytics BOOLEAN DEFAULT false,
  marketing BOOLEAN DEFAULT false,
  consent_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT
);
```

---

## Children's Data Protection

**GDPR Article 8** requires parental consent for processing children's data (under 16 years, or lower age set by member states).

### Abyrith's Approach

**Age Restriction:**
- Abyrith is designed for developers and professionals
- Minimum age: 16 years (GDPR requirement)
- No marketing to children
- No specific features for children

**Age Verification:**
- Users must confirm they are 16+ during signup
- Checkbox: "I confirm I am at least 16 years old"
- If user indicates they are under 16, signup is blocked
- No collection of additional age verification data (privacy by design)

**Parental Consent:**
Not currently implemented (service not targeted at children)

**If Children's Data Discovered:**
1. Immediately suspend account
2. Contact user's email address to verify age
3. If confirmed under 16:
   - Request parental consent
   - If no consent, delete account within 7 days
4. Document incident in audit log

---

## Technical and Organizational Measures

**GDPR Article 32** requires appropriate technical and organizational measures to ensure security of processing.

### Technical Measures

**Encryption:**
- Client-side AES-256-GCM encryption for secrets (zero-knowledge)
- TLS 1.3 for all data in transit
- Database encryption at rest (Supabase managed)

**Access Control:**
- Row-Level Security (RLS) in PostgreSQL
- Role-Based Access Control (RBAC) for team permissions
- Principle of least privilege (users only access their data)
- 2FA/MFA for user accounts

**Audit Logging:**
- Comprehensive audit trail (all actions logged)
- Immutable logs (INSERT-only, no updates or deletions by users)
- Retention: 2 years for compliance

**Backup and Recovery:**
- Daily automated backups (Supabase managed)
- Point-in-time recovery capability
- Backup encryption
- Tested restore procedures

**Vulnerability Management:**
- Dependency scanning (Dependabot)
- Security patches applied within 48 hours of disclosure
- Quarterly penetration testing (planned)
- Bug bounty program (post-MVP)

### Organizational Measures

**Data Protection Officer (DPO):**
- Required if: Large-scale processing of personal data or sensitive data
- Abyrith: DPO or equivalent role (Security Lead) responsible for GDPR compliance
- Contact: privacy@abyrith.com

**Staff Training:**
- All employees complete GDPR training within 30 days of hiring
- Annual refresher training
- Privacy awareness in development onboarding

**Incident Response Plan:**
- Documented breach notification procedures
- 72-hour notification timeline
- Incident response team roles defined
- Regular incident response drills

**Privacy Reviews:**
- New features require privacy impact review
- Changes to data processing require legal approval
- Quarterly compliance audits

**Vendor Management:**
- Due diligence before engaging subprocessors
- DPAs signed with all subprocessors
- Annual review of subprocessor compliance

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/security-model.md` - Zero-knowledge architecture
- [x] `04-database/schemas/audit-logs.md` - Audit logging system
- [x] `04-database/schemas/users-organizations.md` - User data structures
- [x] `04-database/schemas/secrets-metadata.md` - Secret storage structures
- [ ] `03-security/compliance/subprocessors.md` - Subprocessor list and DPAs

### Feature Dependencies

**Required by features:**
- `08-features/privacy-dashboard.md` - User-facing privacy controls (to be created)
- `08-features/data-export.md` - GDPR data export functionality (to be created)
- `10-operations/breach-response.md` - Breach notification procedures (to be created)

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge encryption
- `04-database/schemas/audit-logs.md` - Audit logging implementation
- `GLOSSARY.md` - GDPR terminology
- `TECH-STACK.md` - Technology specifications

### External Resources
- [GDPR Official Text](https://gdpr-info.eu/) - Full regulation text
- [ICO GDPR Guide](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/) - UK regulator guidance
- [EDPB Guidelines](https://edpb.europa.eu/our-work-tools/general-guidance/gdpr-guidelines-recommendations-best-practices_en) - European Data Protection Board
- [Standard Contractual Clauses](https://ec.europa.eu/info/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) - EU Commission SCCs
- [NOYB (European Privacy NGO)](https://noyb.eu/) - Privacy enforcement organization

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Security Lead / Legal + Engineering | Initial GDPR compliance documentation |

---

## Notes

### Next Steps Before Launch

**MVP Requirements:**
1. ✅ Design zero-knowledge architecture (complete)
2. ✅ Define audit logging system (complete)
3. [ ] Implement data export functionality
4. [ ] Implement account deletion with anonymization
5. [ ] Sign DPAs with all subprocessors
6. [ ] Create user-facing privacy policy
7. [ ] Implement cookie consent banner
8. [ ] Establish breach notification procedures
9. [ ] Conduct DPIA (Data Protection Impact Assessment)
10. [ ] Designate DPO or equivalent role

**Post-MVP:**
1. Third-party GDPR audit
2. Privacy dashboard for users
3. Automated compliance reporting
4. Enhanced breach detection with ML
5. Privacy certifications (ePrivacy Seal, etc.)

### Competitive Advantage

**Zero-Knowledge as GDPR Superpower:**
Abyrith's zero-knowledge architecture provides unique GDPR advantages:
1. **Not a processor for secrets:** We cannot access encrypted secrets, reducing liability
2. **Breach resilience:** Even if database is compromised, secrets cannot be decrypted
3. **Simplified DPAs:** No complex data processing agreements for core service
4. **User sovereignty:** Users maintain complete control over their data
5. **Legal defense:** Cannot comply with subpoenas for data we don't have access to

### Known Limitations

**Encrypted Secrets Not Exportable:**
Due to zero-knowledge architecture, we cannot export encrypted secret values in plaintext. This is **compliant** with GDPR because we are not a processor of that data—users control encryption keys.

**Master Password Loss:**
If user loses master password, we cannot recover secrets. This is documented prominently and users are warned during setup. GDPR allows this (privacy by design trade-off).

**Audit Log Anonymization:**
We anonymize but don't delete audit logs after account deletion. This is permitted under GDPR Article 17(3)(b) for legal compliance.

### Next Review Date

**2026-10-30** - Annual GDPR compliance review, update for regulatory changes, audit third-party GDPR practices
