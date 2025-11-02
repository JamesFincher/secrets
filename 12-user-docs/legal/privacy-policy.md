---
Document: Abyrith Privacy Policy
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Legal / Compliance Team
Status: Draft
Dependencies: 03-security/security-model.md, TECH-STACK.md
---

# Abyrith Privacy Policy

**Last Updated:** October 30, 2025
**Effective Date:** [To be determined at launch]

---

## Overview

At Abyrith, your privacy and security are fundamental to everything we do. This Privacy Policy explains what personal data we collect, why we collect it, how we use it, and your rights regarding your information.

**Our Core Privacy Principles:**
- **Zero-Knowledge Encryption:** We cannot access your encrypted secrets, even if we wanted to
- **Data Minimization:** We only collect what's necessary to provide our service
- **Transparency:** We clearly explain our practices in plain language
- **Your Control:** You decide what data we collect and can delete your data at any time

This policy applies to all users of Abyrith's services, including our web application, mobile apps, browser extensions, CLI tools, and MCP (Model Context Protocol) integrations.

---

## Table of Contents

1. [Information We Collect](#information-we-collect)
2. [How We Use Your Information](#how-we-use-your-information)
3. [Zero-Knowledge Architecture](#zero-knowledge-architecture)
4. [Data Sharing and Third-Party Services](#data-sharing-and-third-party-services)
5. [Data Security](#data-security)
6. [Data Retention](#data-retention)
7. [Your Privacy Rights](#your-privacy-rights)
8. [International Data Transfers](#international-data-transfers)
9. [Cookies and Tracking Technologies](#cookies-and-tracking-technologies)
10. [Children's Privacy](#childrens-privacy)
11. [Changes to This Privacy Policy](#changes-to-this-privacy-policy)
12. [Contact Us](#contact-us)

---

## Information We Collect

### 1.1 Account Information

When you create an Abyrith account, we collect:

- **Email address** (required for account creation and authentication)
- **Full name** (optional, used for personalization and team collaboration)
- **Password** (hashed and salted using industry-standard bcrypt; never stored in plaintext)
- **Master password salt** (used for client-side encryption key derivation; the master password itself is never transmitted to or stored by Abyrith)

**Why we collect this:** To create and manage your account, authenticate you securely, and enable collaboration features.

### 1.2 Profile Information

You may optionally provide:

- **Profile picture** (for account personalization and team member identification)
- **Organization name** (for team and enterprise accounts)
- **Job title** (optional, for team context)
- **Time zone** (for displaying timestamps in your local time)

**Why we collect this:** To enhance your user experience and enable team collaboration features.

### 1.3 Encrypted Secrets and Metadata

When you store secrets in Abyrith:

**Data We CANNOT See (Encrypted):**
- **Secret values** (API keys, passwords, tokens) - Encrypted client-side with AES-256-GCM
- **Master password** (used only in your browser, never transmitted to our servers)
- **Data Encryption Keys (DEKs)** - Encrypted with your master key before storage

**Data We CAN See (Plaintext Metadata):**
- **Project names and descriptions**
- **Environment names** (development, staging, production)
- **Secret names and labels** (e.g., "OPENAI_API_KEY")
- **Service names** (e.g., "OpenAI", "Stripe", "AWS")
- **Tags** (for organization and search)
- **Creation and modification timestamps**
- **Secret expiration dates** (if set)

**Why we collect this:** Encrypted values provide zero-knowledge security. Plaintext metadata enables search, organization, AI assistance, and audit logging without exposing sensitive values.

### 1.4 Usage and Analytics Data

We automatically collect:

- **IP address** (for security monitoring and geographic analytics)
- **Browser type and version** (to ensure compatibility)
- **Device type** (desktop, mobile, tablet)
- **Operating system** (Windows, macOS, Linux, iOS, Android)
- **Page views and feature usage** (to improve the product)
- **API request logs** (for debugging and security monitoring)
- **Session duration and frequency** (to understand engagement)
- **Error logs** (to identify and fix bugs)

**Why we collect this:** To improve service performance, identify bugs, prevent abuse, and understand how users interact with Abyrith.

### 1.5 Audit and Security Logs

For security and compliance, we log:

- **Authentication events** (login, logout, failed login attempts)
- **Secret access events** (when secrets are created, viewed, updated, or deleted)
- **Team changes** (member added, removed, role changed)
- **Project changes** (created, archived, deleted)
- **MCP requests** (when AI tools request access to secrets)
- **Approval grants and denials** (for approval workflows)
- **API key usage** (rate limits, quotas)

**Why we collect this:** To provide audit trails for compliance, detect security incidents, investigate unauthorized access, and meet SOC 2 and GDPR requirements.

### 1.6 Payment Information

If you subscribe to a paid plan:

- **Billing name and address**
- **Payment method details** (processed by Stripe; we never store full credit card numbers)
- **Transaction history** (invoices, receipts)
- **Tax identification numbers** (if required by law)

**Why we collect this:** To process payments, issue invoices, and comply with tax regulations.

### 1.7 Communications

If you contact us:

- **Email correspondence** (support requests, feedback)
- **Survey responses** (product feedback, feature requests)
- **Community forum posts** (if we launch a public forum)

**Why we collect this:** To provide customer support, respond to inquiries, and improve our product based on feedback.

---

## How We Use Your Information

We use your personal data for the following purposes:

### 2.1 Service Provision

- Create and manage your account
- Authenticate and authorize access to your secrets
- Enable secret encryption and decryption (client-side)
- Provide search, organization, and management features
- Generate AI-powered guidance for API key acquisition
- Enable team collaboration and sharing
- Process MCP requests from AI development tools
- Provide customer support

**Legal Basis (GDPR):** Performance of contract, legitimate interests

### 2.2 Security and Fraud Prevention

- Detect and prevent unauthorized access
- Monitor for suspicious activity and security threats
- Enforce rate limits to prevent abuse
- Maintain audit logs for security investigations
- Respond to security incidents

**Legal Basis (GDPR):** Legitimate interests, legal obligations

### 2.3 Product Improvement

- Analyze usage patterns to improve features
- Identify and fix bugs and performance issues
- Conduct A/B testing for new features
- Gather feedback to prioritize product development

**Legal Basis (GDPR):** Legitimate interests

### 2.4 Compliance and Legal Obligations

- Comply with applicable laws and regulations
- Respond to lawful requests from government authorities
- Enforce our Terms of Service
- Protect our rights and property

**Legal Basis (GDPR):** Legal obligations, legitimate interests

### 2.5 Communications

- Send service-related notifications (account security, downtime, updates)
- Respond to support requests
- Send product updates and feature announcements (you can opt out)
- Request feedback and survey participation (you can opt out)

**Legal Basis (GDPR):** Performance of contract, legitimate interests, consent (for marketing)

---

## Zero-Knowledge Architecture

Abyrith is built on a **zero-knowledge security model**, which means:

### What This Means for Your Privacy

**We CANNOT access your encrypted secrets under any circumstances:**
- Your secrets are encrypted in your browser using AES-256-GCM before being sent to our servers
- Your master password is used only in your browser to derive an encryption key and is never transmitted to Abyrith
- Even if our servers are compromised, attackers only get encrypted blobs that cannot be decrypted without your master password
- Abyrith employees cannot access your secret values, even for customer support
- Subpoenas and legal demands cannot force us to disclose secret values (we don't have access)

### How Zero-Knowledge Encryption Works

1. **You create a master password** (separate from your account password)
2. **Key derivation happens in your browser** using PBKDF2 (600,000 iterations) to generate a 256-bit encryption key
3. **Each secret is encrypted with a unique Data Encryption Key (DEK)** using AES-256-GCM
4. **The DEK is encrypted with your master key** (envelope encryption pattern)
5. **Only encrypted data is sent to our servers** - we never see plaintext secrets
6. **Decryption happens only in your browser** when you view a secret

### Trade-Offs of Zero-Knowledge Security

**Benefit:** Complete data sovereignty - only you can access your secrets
**Trade-Off:** If you forget your master password, your secrets are unrecoverable (we provide optional encrypted recovery keys)

For full technical details, see our [Security Model documentation](../../03-security/security-model.md).

---

## Data Sharing and Third-Party Services

We do not sell, rent, or share your personal data with third parties for their marketing purposes. We only share data with service providers who help us operate Abyrith:

### 4.1 Infrastructure and Hosting

**Cloudflare (United States)**
- **Purpose:** Hosting, CDN, edge computing, DDoS protection
- **Data Shared:** Encrypted secrets, metadata, IP addresses, usage logs
- **Privacy Policy:** https://www.cloudflare.com/privacypolicy/

**Supabase (United States)**
- **Purpose:** Database, authentication, real-time data synchronization
- **Data Shared:** Account information, encrypted secrets, metadata, audit logs
- **Privacy Policy:** https://supabase.com/privacy

### 4.2 AI Services

**Anthropic (United States)**
- **Purpose:** AI-powered Secret Assistant, guided acquisition flows, natural language understanding
- **Data Shared:** Plaintext metadata (service names, tags), user questions, conversation context
- **Data NOT Shared:** Encrypted secret values, master passwords, personal information
- **Privacy Policy:** https://www.anthropic.com/privacy

**Important:** Your encrypted secret values are NEVER sent to Anthropic. Only metadata and conversational context are shared to provide AI assistance.

### 4.3 Documentation Services

**FireCrawl (United States)**
- **Purpose:** Scraping and converting API documentation for guided acquisition flows
- **Data Shared:** URLs of API documentation sites (e.g., openai.com/docs)
- **Data NOT Shared:** Any user data, secrets, or personal information
- **Privacy Policy:** https://www.firecrawl.dev/privacy

### 4.4 Payment Processing

**Stripe (United States)**
- **Purpose:** Payment processing, subscription management, invoicing
- **Data Shared:** Billing name, email, payment method details, transaction amounts
- **Privacy Policy:** https://stripe.com/privacy

### 4.5 Analytics and Monitoring

**Cloudflare Web Analytics (United States)**
- **Purpose:** Privacy-friendly website analytics (no cookies, no personal data collection)
- **Data Shared:** Aggregate page views, visitor counts, anonymized metrics
- **Privacy Policy:** https://www.cloudflare.com/privacypolicy/

**Sentry (United States) - Optional**
- **Purpose:** Error tracking and performance monitoring
- **Data Shared:** Error logs, stack traces, user IDs (anonymized), device information
- **Data NOT Shared:** Secret values, passwords, personal information (we scrub logs)
- **Privacy Policy:** https://sentry.io/privacy/

### 4.6 Data Processing Agreements

All third-party service providers who process personal data on our behalf have signed Data Processing Agreements (DPAs) that:
- Limit their use of your data to providing services to Abyrith
- Require them to implement appropriate security measures
- Prohibit them from using your data for their own purposes
- Comply with GDPR and other applicable privacy laws

---

## Data Security

We implement industry-leading security measures to protect your data:

### 5.1 Encryption

**Data at Rest:**
- **Secret values:** AES-256-GCM client-side encryption (zero-knowledge)
- **Database:** PostgreSQL with encryption at rest (managed by Supabase)
- **Backups:** Encrypted backups with AES-256

**Data in Transit:**
- **All connections:** TLS 1.3 encryption (HTTPS)
- **API requests:** Authenticated with JWT tokens, encrypted in transit
- **WebSocket connections:** Encrypted WSS protocol

**Data in Use:**
- **Browser memory:** Secrets decrypted only when viewed, cleared after use
- **Server processing:** Secrets never decrypted on server (zero-knowledge architecture)

### 5.2 Access Controls

- **Row-Level Security (RLS):** Database policies enforce multi-tenancy and data isolation
- **Role-Based Access Control (RBAC):** Owner, Admin, Developer, Read-Only roles
- **Least Privilege:** Users and services have minimum necessary permissions
- **Multi-Factor Authentication (MFA):** Required for sensitive operations (optional for basic accounts)
- **Session Management:** 15-minute JWT token expiration, secure HttpOnly cookies

### 5.3 Infrastructure Security

- **DDoS Protection:** Cloudflare automatic mitigation
- **Web Application Firewall (WAF):** Cloudflare WAF blocks common attacks
- **Rate Limiting:** Per-user and per-IP rate limits prevent abuse
- **Intrusion Detection:** Monitoring for suspicious activity
- **Vulnerability Scanning:** Automated dependency scanning (Dependabot)
- **Penetration Testing:** Regular third-party security audits (planned)

### 5.4 Application Security

- **Input Validation:** All user input sanitized and validated
- **SQL Injection Prevention:** Parameterized queries, prepared statements
- **XSS Prevention:** Content Security Policy (CSP), React auto-escaping
- **CSRF Protection:** Token-based CSRF protection
- **Secure Headers:** HSTS, X-Frame-Options, X-Content-Type-Options

### 5.5 Employee Access

- **Background Checks:** All employees undergo security screening
- **Minimal Access:** Engineers have limited database access (read-only for debugging)
- **Audit Logging:** All administrative actions are logged
- **Training:** Regular security and privacy training for all employees
- **Zero-Knowledge Guarantee:** Employees cannot access encrypted secret values

### 5.6 Incident Response

We maintain a comprehensive incident response plan:
- **Detection:** 24/7 monitoring and alerting
- **Containment:** Immediate action to stop incidents
- **Investigation:** Forensic analysis to understand scope
- **Notification:** User notification within 72 hours of discovering a data breach (GDPR requirement)
- **Remediation:** Patching vulnerabilities and improving security

For security incidents, see our [Security Incident Response Runbook](../../10-operations/incidents/security-incident-response.md).

---

## Data Retention

We retain your personal data only as long as necessary to provide our services and meet legal obligations:

### 6.1 Account Data

- **Active accounts:** Retained while your account is active
- **Deleted accounts:** Personal data deleted within 30 days of account deletion (except as required for legal compliance)
- **Backup retention:** Backups containing deleted data are retained for 90 days, then permanently deleted

### 6.2 Encrypted Secrets

- **Active secrets:** Retained while your account is active
- **Deleted secrets:** Permanently deleted within 7 days (after which they cannot be recovered)
- **Backup retention:** Encrypted backups retained for 90 days

### 6.3 Audit Logs

- **Default retention:** 1 year for all accounts
- **Enterprise retention:** Configurable (1-7 years) for compliance requirements
- **Legal holds:** Retained longer if required by law or ongoing investigation

### 6.4 Usage and Analytics Data

- **Aggregate analytics:** Retained indefinitely (anonymized)
- **Individual usage data:** Retained for 2 years
- **IP addresses:** Anonymized after 90 days (last octet removed)

### 6.5 Payment Data

- **Transaction records:** Retained for 7 years (required by tax laws)
- **Payment method details:** Stored by Stripe per their retention policy

### 6.6 Communications

- **Support tickets:** Retained for 3 years
- **Email correspondence:** Retained for 2 years

---

## Your Privacy Rights

You have the following rights regarding your personal data:

### 7.1 Right to Access

**What it means:** You can request a copy of all personal data we hold about you.

**How to exercise:** Email privacy@abyrith.com or use the "Export My Data" feature in Account Settings.

**Response time:** Within 30 days

**Format:** JSON (machine-readable) or PDF (human-readable)

### 7.2 Right to Rectification

**What it means:** You can correct inaccurate or incomplete personal data.

**How to exercise:** Update your profile in Account Settings or email privacy@abyrith.com.

**Response time:** Immediate for self-service updates; within 30 days for email requests

### 7.3 Right to Erasure ("Right to be Forgotten")

**What it means:** You can request deletion of your personal data.

**How to exercise:** Use the "Delete My Account" feature in Account Settings or email privacy@abyrith.com.

**What gets deleted:**
- All account information
- All encrypted secrets and metadata
- All audit logs (except as required for legal compliance)
- All usage data linked to your account

**What we retain (legal obligations):**
- Transaction records for tax purposes (7 years)
- Data required for ongoing legal proceedings
- Aggregate anonymized analytics (not linked to you)

**Response time:** Account deletion within 30 days; backup deletion within 90 days

### 7.4 Right to Data Portability

**What it means:** You can export your data in a machine-readable format to transfer to another service.

**How to exercise:** Use the "Export My Data" feature in Account Settings.

**What you receive:**
- Account information (JSON)
- Project and environment structure (JSON)
- Secret metadata (JSON)
- Encrypted secret values (Base64-encoded)
- Audit logs (CSV)

**Note:** Encrypted secrets can only be decrypted with your master password. We do not provide decrypted exports.

### 7.5 Right to Restriction of Processing

**What it means:** You can request that we limit how we use your data.

**How to exercise:** Email privacy@abyrith.com with your specific request.

**Response time:** Within 30 days

### 7.6 Right to Object

**What it means:** You can object to certain types of data processing (e.g., marketing emails, analytics).

**How to exercise:**
- **Marketing emails:** Click "Unsubscribe" in any marketing email
- **Analytics:** Contact privacy@abyrith.com (we'll exclude you from analytics)

**Response time:** Immediate for email unsubscribe; within 30 days for analytics opt-out

### 7.7 Right to Withdraw Consent

**What it means:** If we process your data based on consent, you can withdraw that consent at any time.

**How to exercise:** Email privacy@abyrith.com or update your preferences in Account Settings.

**Effect:** We will stop processing based on that consent (but may continue if we have another legal basis).

### 7.8 Right to Lodge a Complaint

**What it means:** You can file a complaint with a data protection authority if you believe we've violated privacy laws.

**How to exercise:**
- **EU residents:** Contact your national Data Protection Authority (list at https://edpb.europa.eu/about-edpb/board/members_en)
- **UK residents:** Contact the Information Commissioner's Office (ICO) at https://ico.org.uk/
- **US residents:** Contact the Federal Trade Commission (FTC) at https://www.ftc.gov/

**Our commitment:** We prefer to resolve concerns directly. Please contact us first at privacy@abyrith.com.

---

## International Data Transfers

Abyrith is operated from the United States. If you access our services from outside the US, your personal data will be transferred to and processed in the United States.

### 8.1 Legal Basis for Transfers

**For European Union (EU) and UK users:**
- **Standard Contractual Clauses (SCCs):** We use EU-approved SCCs with our service providers to ensure adequate data protection.
- **Adequacy Decisions:** We rely on adequacy decisions where available (e.g., EU-US Data Privacy Framework).

**For other jurisdictions:**
- We comply with applicable data protection laws and implement appropriate safeguards.

### 8.2 Data Privacy Framework

Abyrith is committed to complying with the EU-US Data Privacy Framework and UK Extension to the EU-US DPF (when certified).

### 8.3 Third-Party Transfers

Our service providers (Cloudflare, Supabase, Anthropic) may also transfer data internationally. We ensure they implement appropriate safeguards as required by law.

---

## Cookies and Tracking Technologies

Abyrith uses cookies and similar technologies to provide and improve our services.

### 9.1 Types of Cookies We Use

**Essential Cookies (Required):**
- **Authentication:** Secure session management, JWT tokens (HttpOnly, Secure flags)
- **Security:** CSRF protection tokens
- **Functionality:** User preferences, language settings

**Analytics Cookies (Optional):**
- **Cloudflare Web Analytics:** Privacy-friendly analytics (no cookies, no personal data tracking)
- **Sentry:** Error tracking (no cookies, user IDs anonymized)

**We do NOT use:**
- ❌ Third-party advertising cookies
- ❌ Cross-site tracking cookies
- ❌ Social media cookies

### 9.2 Your Cookie Choices

- **Essential cookies:** Cannot be disabled (required for service functionality)
- **Analytics cookies:** Can be disabled in Account Settings or using browser settings

**How to control cookies:**
- **Browser settings:** Most browsers allow you to block or delete cookies
- **Do Not Track (DNT):** We honor DNT signals by not collecting analytics for users with DNT enabled
- **Account settings:** Toggle "Share Analytics" in Account Settings

### 9.3 Browser Local Storage

We use browser Local Storage for:
- Encrypted session keys (temporary, cleared on logout)
- UI preferences (theme, layout)
- Cached metadata (for faster loading)

**Security:** Sensitive data (like decrypted secrets) is stored only in memory, not Local Storage.

---

## Children's Privacy

Abyrith is not directed to children under the age of 13 (or 16 in the EU). We do not knowingly collect personal data from children.

**If you are a parent or guardian** and believe your child has provided personal data to Abyrith:
- Contact us immediately at privacy@abyrith.com
- We will delete the data within 30 days
- We will terminate the child's account

**Age verification:** We do not actively verify ages but rely on users to provide accurate information.

**Compliance:** We comply with the Children's Online Privacy Protection Act (COPPA) and the EU General Data Protection Regulation (GDPR) requirements for children's data.

---

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, or legal requirements.

### 11.1 Notification of Changes

**Material changes** (e.g., new data collection, third-party sharing):
- Email notification to all users at least 30 days before the change takes effect
- Prominent notice in the Abyrith dashboard
- Option to delete your account if you disagree with the changes

**Non-material changes** (e.g., clarifications, formatting):
- Update the "Last Updated" date at the top of this policy
- No email notification (but you can subscribe to updates)

### 11.2 Version History

We maintain a public version history of this Privacy Policy:
- View past versions at https://abyrith.com/legal/privacy-history
- See a diff of changes between versions

### 11.3 Your Continued Use

By continuing to use Abyrith after changes take effect, you accept the updated Privacy Policy. If you do not agree, you may delete your account before the changes take effect.

---

## Contact Us

We're here to answer your privacy questions and address your concerns.

### 12.1 Privacy Inquiries

**Email:** privacy@abyrith.com
**Response Time:** Within 5 business days

**Mailing Address:**
Abyrith Inc.
[Street Address - To be added]
[City, State, ZIP - To be added]
United States

### 12.2 Data Protection Officer

For EU and UK users, our Data Protection Officer can be reached at:
**Email:** dpo@abyrith.com

### 12.3 Security Issues

**For security vulnerabilities or incidents:**
**Email:** security@abyrith.com
**Response Time:** Within 24 hours

**PGP Key:** [To be added at launch]

### 12.4 General Support

**Email:** support@abyrith.com
**Website:** https://abyrith.com/support
**Documentation:** https://docs.abyrith.com

---

## Legal Compliance

This Privacy Policy complies with:

- ✅ **GDPR (General Data Protection Regulation)** - EU Regulation 2016/679
- ✅ **UK GDPR** - UK Data Protection Act 2018
- ✅ **CCPA (California Consumer Privacy Act)** - California Civil Code §§ 1798.100–1798.199
- ✅ **COPPA (Children's Online Privacy Protection Act)** - 15 U.S.C. §§ 6501–6506
- ✅ **SOC 2 Type II** - Privacy and security controls (certification in progress)

---

## Summary: What You Should Know

**In Plain English:**

✅ **We use zero-knowledge encryption** - we can't read your secrets, ever
✅ **We collect minimal data** - only what's needed to provide the service
✅ **You control your data** - export or delete it anytime
✅ **We don't sell your data** - we're not in the data selling business
✅ **We use trusted partners** - Cloudflare, Supabase, Anthropic, Stripe
✅ **You have rights** - access, deletion, portability, and more
✅ **We're transparent** - this policy is written in plain language (no legalese)

**Questions?** Email privacy@abyrith.com

---

## References

### Related Documentation

- **Security Architecture:** [Zero-Knowledge Security Model](../../03-security/security-model.md)
- **Tech Stack:** [Technology Specifications](../../TECH-STACK.md)
- **Product Vision:** [Product Vision & Strategy](../../01-product/product-vision-strategy.md)
- **Terms of Service:** [Terms of Service](./terms-of-service.md) (to be created)

### External Resources

- **GDPR Full Text:** https://gdpr-info.eu/
- **Cloudflare Privacy:** https://www.cloudflare.com/privacypolicy/
- **Supabase Privacy:** https://supabase.com/privacy
- **Anthropic Privacy:** https://www.anthropic.com/privacy
- **EU Data Protection:** https://edpb.europa.eu/

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Legal / Compliance Team | Initial privacy policy creation for pre-launch review |

---

**End of Privacy Policy**

**Abyrith Inc. - Making API key management accessible to everyone**
