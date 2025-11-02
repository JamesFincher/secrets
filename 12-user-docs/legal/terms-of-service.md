---
Document: Terms of Service
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Legal / Product Lead
Status: Draft
Dependencies: 03-security/security-model.md, 01-product/product-vision-strategy.md, TECH-STACK.md
---

# Abyrith Terms of Service

## Effective Date: [To be determined upon launch]

Welcome to Abyrith. Please read these Terms of Service ("Terms") carefully before using the Abyrith platform.

**Last Updated:** October 30, 2025

---

## Table of Contents

1. [Acceptance of Terms](#acceptance-of-terms)
2. [Service Description](#service-description)
3. [User Eligibility](#user-eligibility)
4. [Account Registration & Security](#account-registration--security)
5. [Acceptable Use Policy](#acceptable-use-policy)
6. [Zero-Knowledge Architecture Disclosure](#zero-knowledge-architecture-disclosure)
7. [User Content & Data Ownership](#user-content--data-ownership)
8. [Payment Terms](#payment-terms)
9. [Service Level Agreement](#service-level-agreement)
10. [Intellectual Property Rights](#intellectual-property-rights)
11. [Third-Party Services](#third-party-services)
12. [Termination & Suspension](#termination--suspension)
13. [Disclaimers](#disclaimers)
14. [Limitation of Liability](#limitation-of-liability)
15. [Indemnification](#indemnification)
16. [Data Privacy](#data-privacy)
17. [Dispute Resolution & Governing Law](#dispute-resolution--governing-law)
18. [Changes to Terms](#changes-to-terms)
19. [Contact Information](#contact-information)
20. [Miscellaneous](#miscellaneous)

---

## 1. Acceptance of Terms

### 1.1 Binding Agreement

By accessing or using Abyrith's services (the "Service"), you ("User", "you", or "your") agree to be bound by these Terms of Service. If you do not agree to these Terms, you must not access or use the Service.

### 1.2 Capacity to Contract

By accepting these Terms, you represent that:
- You have the legal capacity to enter into binding agreements
- You are not barred from receiving services under applicable law
- You will comply with all applicable laws when using the Service

### 1.3 On Behalf of an Organization

If you are using the Service on behalf of an organization:
- You represent that you have authority to bind that organization to these Terms
- References to "you" and "your" apply to both you as an individual and the organization

---

## 2. Service Description

### 2.1 Overview

Abyrith provides a cloud-based secrets management platform designed to help individuals and organizations securely store, manage, and access developer secrets, API keys, tokens, passwords, and other sensitive credentials ("Secrets").

### 2.2 Core Features

The Service includes:
- **Zero-knowledge encrypted storage** for Secrets
- **AI-powered guidance** for acquiring and managing API keys
- **Project-based organization** with environment management (development, staging, production)
- **Team collaboration** with role-based access control (Owner, Admin, Developer, Read-Only)
- **Audit logging** for compliance and security tracking
- **MCP (Model Context Protocol) integration** for AI development tools
- **Multi-platform access** via web application, API, CLI, and browser extensions (as available)

### 2.3 Service Availability

The Service is provided on an "as available" basis. We strive to maintain 99.9% uptime but do not guarantee uninterrupted access. Scheduled maintenance will be announced in advance when possible.

### 2.4 Service Modifications

Abyrith reserves the right to:
- Modify, suspend, or discontinue any aspect of the Service at any time
- Introduce new features or impose limits on certain features
- Update technical requirements for accessing the Service

Material changes affecting paid users will be communicated at least 30 days in advance.

---

## 3. User Eligibility

### 3.1 Age Requirement

You must be at least **13 years old** to use the Service. If you are between 13 and 18 years old, you may only use the Service with the consent and supervision of a parent or legal guardian.

### 3.2 Prohibited Jurisdictions

The Service is not available to:
- Users in jurisdictions where the Service is prohibited by law
- Persons subject to sanctions or export control restrictions
- Entities or individuals on any government restricted party lists

### 3.3 Account Accuracy

You agree to:
- Provide accurate, current, and complete information during registration
- Maintain and update your account information to keep it accurate
- Notify us immediately of any unauthorized use of your account

---

## 4. Account Registration & Security

### 4.1 Account Creation

To use the Service, you must:
- Create an account with a valid email address
- Create a secure account password (for authentication)
- **Separately** create a Master Password (for encryption)

### 4.2 Master Password Responsibility

**CRITICAL:** Your Master Password is used to encrypt and decrypt your Secrets. You acknowledge and agree that:

- **Abyrith CANNOT recover your Master Password** if you forget it
- **Lost Master Passwords result in permanent loss of access to your encrypted Secrets**
- **You are solely responsible for remembering, securing, and protecting your Master Password**
- We strongly recommend:
  - Using a strong, unique Master Password
  - Storing your Master Password securely (e.g., in a physical password manager)
  - Creating a recovery key during account setup
  - NEVER sharing your Master Password with anyone, including Abyrith support

### 4.3 Account Security

You are responsible for:
- Maintaining the confidentiality of your account password and Master Password
- All activities that occur under your account
- Ensuring authorized personnel only have appropriate access levels
- Immediately notifying Abyrith of any security breaches

### 4.4 Two-Factor Authentication

We strongly recommend enabling two-factor authentication (2FA) for additional account security. Some features or subscription tiers may require 2FA.

---

## 5. Acceptable Use Policy

### 5.1 Permitted Use

You may use the Service only for:
- Lawful purposes
- Storing and managing your legitimate developer secrets and credentials
- Collaborating with authorized team members on shared projects
- Integrating with AI development tools and workflows

### 5.2 Prohibited Activities

You agree NOT to:

**Illegal Use:**
- Use the Service to commit or facilitate any illegal activity
- Store stolen credentials, unauthorized access tokens, or illegally obtained data
- Violate any applicable laws, regulations, or third-party rights

**Platform Abuse:**
- Attempt to gain unauthorized access to the Service, other user accounts, or systems
- Interfere with or disrupt the Service's operation or infrastructure
- Reverse engineer, decompile, or attempt to extract source code
- Bypass any security measures or access restrictions
- Use automated systems (bots, scrapers) without written permission

**Harmful Content:**
- Store malware, viruses, or malicious code
- Distribute spam or unsolicited communications via the Service
- Attempt to use the Service to attack or compromise third-party systems

**Resource Abuse:**
- Exceed rate limits or quotas specified for your subscription tier
- Engage in cryptocurrency mining or similar resource-intensive activities
- Create multiple accounts to circumvent usage limits

### 5.3 Enforcement

Violation of this Acceptable Use Policy may result in:
- Immediate suspension or termination of your account
- Reporting to law enforcement if illegal activity is suspected
- Legal action to recover damages
- Forfeiture of any refunds or credits

---

## 6. Zero-Knowledge Architecture Disclosure

### 6.1 What Zero-Knowledge Means

Abyrith employs **zero-knowledge encryption** architecture, meaning:

- All Secrets are **encrypted client-side** in your browser before transmission to our servers
- Encryption is performed using a key derived from your Master Password
- **Abyrith personnel CANNOT access, view, or decrypt your Secrets**
- Even if our systems are compromised, attackers cannot decrypt your Secrets without your Master Password

### 6.2 What Abyrith CAN See

Abyrith stores and can access:
- **Encrypted Secret blobs** (ciphertext only)
- **Unencrypted metadata** (project names, secret names, service tags, environment labels, timestamps)
- Account information (email, name, profile data)
- Team membership and access permissions
- Audit logs (who accessed what, when, from where)
- Billing information

### 6.3 What Abyrith CANNOT See

Abyrith **CANNOT** access:
- **Your Master Password** (it never leaves your device)
- **Decrypted Secret values** (API keys, tokens, passwords)
- **Any plaintext content** of your Secrets

### 6.4 Implications for Users

This zero-knowledge architecture means:

**Benefits:**
- Maximum security and privacy for your Secrets
- Protection even if Abyrith is hacked or legally compelled to provide data
- You maintain complete sovereignty over your data

**Responsibilities:**
- **You must remember your Master Password** (we cannot reset it)
- Lost Master Passwords result in **permanent, irreversible loss** of access to Secrets
- You should create and securely store a recovery key
- You are responsible for managing your own encryption keys

### 6.5 Legal Requests

In the event Abyrith receives a legal demand (subpoena, court order, warrant) for user data:
- We can only provide encrypted Secret blobs and metadata
- **We cannot provide decrypted Secrets because we do not have access to them**
- We will provide the minimum information legally required
- We will notify affected users unless legally prohibited from doing so

---

## 7. User Content & Data Ownership

### 7.1 Your Data Ownership

You retain all rights, title, and interest in your Secrets and any content you store in the Service ("User Content"). Abyrith does not claim ownership of your User Content.

### 7.2 License to Abyrith

To provide the Service, you grant Abyrith a limited, worldwide, non-exclusive license to:
- Store your encrypted User Content on our infrastructure
- Process metadata for Service functionality (search, organization, AI assistance)
- Generate audit logs and analytics
- Backup and replicate data for redundancy

This license terminates when you delete content or close your account, subject to reasonable retention periods for backups.

### 7.3 Responsibility for User Content

You are solely responsible for:
- The legality and appropriateness of content you store
- Obtaining any necessary rights or permissions for stored credentials
- Compliance with third-party terms of service
- Not storing illegal, infringing, or harmful content

### 7.4 Data Portability

You may export your Secrets at any time in standard formats (JSON, CSV). Encrypted exports preserve zero-knowledge security; plaintext exports are encrypted in transit and deleted after download.

---

## 8. Payment Terms

### 8.1 Subscription Plans

Abyrith offers multiple subscription tiers:
- **Free Plan:** Limited features and usage quotas (as specified on our pricing page)
- **Individual Plans:** For solo developers and small teams
- **Team Plans:** For development teams (3-50 members)
- **Enterprise Plans:** For large organizations with custom requirements

### 8.2 Billing

**Subscription Billing:**
- Subscriptions are billed in advance on a monthly or annual basis
- Pricing is specified on our website and may be updated with 30 days' notice
- You authorize Abyrith to charge your payment method on each billing cycle
- If payment fails, we will attempt to notify you and retry payment

**Usage-Based Billing (if applicable):**
- Some features may incur usage-based charges (e.g., AI assistance requests, API calls)
- You will be notified of usage-based pricing before incurring charges
- Usage charges are billed monthly in arrears

### 8.3 Taxes

All prices are exclusive of applicable taxes (VAT, sales tax, etc.). You are responsible for paying all taxes associated with your use of the Service. We will collect and remit taxes where legally required.

### 8.4 Refunds

**Subscription Refunds:**
- Monthly subscriptions: No refunds for partial months
- Annual subscriptions: Pro-rated refunds within 30 days of initial purchase or renewal
- Refunds are at Abyrith's sole discretion for extenuating circumstances

**No Refunds for:**
- Violations of these Terms resulting in suspension
- User error or Master Password loss
- Change of mind after free trial period

### 8.5 Cancellation

You may cancel your subscription at any time:
- Cancellation takes effect at the end of the current billing period
- You retain access to paid features until the end of the billing period
- After cancellation, your account reverts to the Free Plan
- If Free Plan limits are exceeded, you may be required to delete content or upgrade

### 8.6 Price Changes

Abyrith may change subscription pricing with 30 days' advance notice. Price changes:
- Do not affect current billing periods
- Apply starting with the next billing cycle
- Give you the option to cancel before the new price takes effect

---

## 9. Service Level Agreement

### 9.1 Uptime Target

Abyrith aims to provide **99.9% uptime** for the Service (excluding scheduled maintenance). This is a target, not a guarantee.

**Calculation:**
- Uptime is measured monthly
- Scheduled maintenance (announced in advance) is excluded
- Force majeure events are excluded

### 9.2 Support

**Free Plan:**
- Community support via documentation and forums
- Email support (best-effort response time)

**Paid Plans:**
- Email support (24-48 hour response time)
- Priority support for critical issues

**Enterprise Plans:**
- Dedicated support contacts
- SLA with guaranteed response times
- Onboarding assistance

### 9.3 Maintenance

**Scheduled Maintenance:**
- Announced at least 48 hours in advance (except emergencies)
- Conducted during low-traffic periods when possible
- Status updates provided via status page

**Emergency Maintenance:**
- May be performed without advance notice for security or stability
- Users notified as soon as possible

### 9.4 No Service Credits

Due to our zero-knowledge architecture and budget-conscious pricing, **we do not offer service credits for downtime**. If you require guaranteed uptime with financial penalties, please contact us about Enterprise SLA options.

---

## 10. Intellectual Property Rights

### 10.1 Abyrith's IP

Abyrith retains all rights, title, and interest in:
- The Service platform and infrastructure
- All software, code, and technology powering the Service
- Abyrith trademarks, logos, and branding
- Documentation, guides, and educational content
- AI models, prompts, and training data

### 10.2 License to Use the Service

Abyrith grants you a limited, non-exclusive, non-transferable, revocable license to use the Service in accordance with these Terms. This license:
- Is personal to you (or your organization)
- May not be sublicensed, sold, or transferred
- Terminates immediately upon violation of these Terms

### 10.3 Restrictions

You may not:
- Copy, modify, or create derivative works of the Service
- Sell, resell, rent, lease, or sublicense access to the Service
- Remove or modify any proprietary notices or labels
- Use Abyrith's trademarks without written permission

### 10.4 Feedback

If you provide suggestions, ideas, or feedback about the Service ("Feedback"):
- You grant Abyrith a perpetual, irrevocable, worldwide license to use the Feedback
- Abyrith has no obligation to implement Feedback or compensate you
- Feedback is considered non-confidential

---

## 11. Third-Party Services

### 11.1 Integrations

The Service integrates with third-party services including:
- **Supabase** (database and authentication)
- **Cloudflare** (infrastructure and CDN)
- **Claude API** (AI assistance)
- **FireCrawl** (documentation scraping)
- OAuth providers (Google, GitHub, Microsoft)

### 11.2 Third-Party Terms

Your use of third-party integrations is subject to:
- The third party's terms of service and privacy policies
- Any limitations or restrictions imposed by the third party
- Abyrith's policies regarding third-party integrations

Abyrith is not responsible for:
- Third-party service availability, performance, or security
- Changes to third-party APIs or terms
- Data practices of third parties

### 11.3 MCP Tool Access

When you authorize AI tools (Claude Code, Cursor, etc.) to access your Secrets via MCP:
- You control which Secrets are accessible to which tools
- You can grant temporary or permanent access
- You can revoke access at any time
- All MCP access is logged in your audit trail

**You are responsible for:**
- Vetting AI tools before granting access
- Understanding what the AI tool will do with your Secrets
- Complying with the AI tool's terms of service

---

## 12. Termination & Suspension

### 12.1 Termination by You

You may terminate your account at any time by:
- Navigating to account settings and selecting "Delete Account"
- Contacting support to request account deletion
- Allowing your subscription to expire and deleting content within Free Plan limits

**Upon Termination:**
- Your encrypted Secrets will be deleted within 30 days
- Backups will be deleted within 90 days
- Audit logs may be retained for compliance purposes (metadata only)
- You will not receive refunds for prepaid subscription periods (except as specified in Section 8.4)

### 12.2 Termination by Abyrith

Abyrith may suspend or terminate your account if:
- You violate these Terms or the Acceptable Use Policy
- Your account is involved in fraudulent or illegal activity
- You fail to pay for subscription services after notice
- Your account poses a security risk to other users or the Service
- Required by law or legal process

**Notice:**
- We will provide notice when possible, except for:
  - Immediate threats to security or stability
  - Legal requirements prohibiting notice
  - Fraud or illegal activity

### 12.3 Effect of Termination

Upon termination or suspension:
- Your access to the Service immediately ceases
- Your right to use the Service terminates
- You remain liable for any outstanding fees
- Sections that by their nature should survive (warranties, indemnification, limitations of liability) remain in effect

### 12.4 Data Retention

After account termination:
- Encrypted Secrets deleted from production within 30 days
- Backups deleted within 90 days
- Audit logs (metadata only) retained for up to 7 years for compliance
- You may request early deletion of backups (subject to verification)

---

## 13. Disclaimers

### 13.1 Service "AS IS"

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
- Warranties of merchantability
- Fitness for a particular purpose
- Non-infringement
- Uninterrupted or error-free operation
- Accuracy, reliability, or completeness of content

### 13.2 No Guarantee of Security

While Abyrith implements industry-standard security measures:
- We cannot guarantee absolute security
- No system is completely immune to breaches or attacks
- You use the Service at your own risk
- You are responsible for implementing your own security measures (strong passwords, 2FA, recovery keys)

### 13.3 AI-Generated Content

AI-powered features (Secret Assistant, guided acquisition) may:
- Produce inaccurate, incomplete, or outdated information
- Contain errors or omissions
- Not be suitable for all use cases

**You are responsible for:**
- Verifying AI-generated instructions before following them
- Ensuring compatibility with your specific requirements
- Not relying solely on AI assistance for critical operations

### 13.4 Third-Party Content

Abyrith is not responsible for:
- Content or accuracy of third-party documentation
- Changes to third-party APIs or services
- Errors in scraped documentation used by AI features

### 13.5 Jurisdictional Limitations

Some jurisdictions do not allow disclaimers of implied warranties. In such jurisdictions, the above disclaimers may be limited to the extent prohibited by law.

---

## 14. Limitation of Liability

### 14.1 Exclusion of Damages

TO THE MAXIMUM EXTENT PERMITTED BY LAW, ABYRITH SHALL NOT BE LIABLE FOR:
- **Indirect, incidental, special, consequential, or punitive damages**
- Loss of profits, revenue, data, or use
- Loss of business opportunities
- Costs of procurement of substitute services
- Damage to reputation or goodwill

This exclusion applies regardless of:
- The legal theory (contract, tort, negligence, strict liability, etc.)
- Whether Abyrith was advised of the possibility of such damages
- Whether damages were foreseeable

### 14.2 Specific Exclusions

Abyrith is not liable for damages resulting from:
- **Lost Master Passwords and resulting inability to access Secrets**
- Unauthorized access to your account due to weak passwords or compromised credentials
- Deletion of Secrets by you or authorized team members
- Third-party service failures (Supabase, Cloudflare, Claude API, etc.)
- Your violation of third-party terms of service
- Government actions, legal orders, or force majeure events
- Your reliance on AI-generated content or instructions
- Compatibility issues with your systems or workflows

### 14.3 Cap on Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, ABYRITH'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE GREATER OF:
- **$100 USD**, or
- **The amount you paid to Abyrith in the 12 months preceding the claim**

### 14.4 Essential Purpose

You acknowledge that:
- These limitations of liability reflect a reasonable allocation of risk
- Abyrith would not provide the Service without these limitations
- The pricing of the Service reflects these limitations

### 14.5 Jurisdictional Limitations

Some jurisdictions do not allow limitations on certain types of liability. In such jurisdictions, Abyrith's liability is limited to the maximum extent permitted by law.

---

## 15. Indemnification

### 15.1 Your Indemnification Obligation

You agree to indemnify, defend, and hold harmless Abyrith, its affiliates, officers, directors, employees, agents, and contractors from and against any claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising from:

- **Your use or misuse of the Service**
- **Your violation of these Terms**
- **Your violation of any applicable laws or regulations**
- **Your violation of third-party rights** (intellectual property, privacy, etc.)
- **Content you store in the Service** (including illegally obtained credentials)
- **Your team members' use of the Service** under your account
- **Claims that your use of the Service caused harm to third parties**

### 15.2 Procedure

If Abyrith seeks indemnification:
- We will provide prompt written notice of the claim
- You will have control of the defense and settlement
- We may participate in defense at our own expense
- You may not settle any claim without our written consent if it imposes obligations on us or admits liability on our behalf

### 15.3 Abyrith's Rights

This indemnification does not limit:
- Abyrith's right to suspend or terminate your account
- Any other rights or remedies available to Abyrith

---

## 16. Data Privacy

### 16.1 Privacy Policy

Your privacy is important to us. Our collection, use, and protection of personal data is governed by our Privacy Policy, available at [PRIVACY_POLICY_URL].

### 16.2 GDPR Compliance

For users in the European Union:
- You have rights under GDPR (access, rectification, erasure, portability, restriction, objection)
- We process data based on consent, contractual necessity, or legitimate interests
- Data is stored in EU-approved regions or under adequacy agreements
- See our Privacy Policy for full GDPR information

### 16.3 Data Processing Addendum

For Enterprise customers subject to GDPR or other data protection laws, a Data Processing Addendum (DPA) is available upon request.

### 16.4 Security Practices

Abyrith implements:
- Zero-knowledge encryption (see Section 6)
- Industry-standard security measures
- Regular security audits and penetration testing
- Incident response procedures
- Employee security training

For detailed security information, see our Security Documentation [SECURITY_DOC_URL].

---

## 17. Dispute Resolution & Governing Law

### 17.1 Governing Law

These Terms shall be governed by and construed in accordance with the laws of **[JURISDICTION]**, without regard to conflict of law principles.

### 17.2 Informal Resolution

Before filing a formal dispute, you agree to:
- Contact Abyrith support at legal@abyrith.com
- Describe the issue and desired resolution
- Allow 60 days for good-faith negotiation

### 17.3 Arbitration

**Binding Arbitration:**
If informal resolution fails, disputes shall be resolved by **binding arbitration** rather than in court, except:
- Small claims court actions (if qualified)
- Injunctive or equitable relief for intellectual property infringement
- Enforcement of the arbitration clause

**Arbitration Rules:**
- Administered by [ARBITRATION_ORGANIZATION] under its rules
- One arbitrator mutually agreed upon or appointed by the organization
- Arbitration held in [LOCATION] or remotely by video conference
- Each party bears its own costs and attorneys' fees unless awarded by arbitrator
- Discovery is limited to expedite resolution

**No Class Actions:**
You agree to arbitrate disputes individually, not as part of a class, collective, or representative action. You waive the right to participate in class-action lawsuits.

### 17.4 Exceptions to Arbitration

Either party may seek:
- Small claims court resolution (if claim qualifies)
- Emergency equitable relief in court to prevent irreparable harm
- Enforcement or protection of intellectual property rights

### 17.5 Jurisdiction

For any disputes not subject to arbitration:
- Exclusive jurisdiction in the courts of [JURISDICTION]
- You consent to personal jurisdiction in those courts

### 17.6 Waiver of Jury Trial

To the extent arbitration does not apply, **you waive the right to a jury trial**.

---

## 18. Changes to Terms

### 18.1 Right to Modify

Abyrith reserves the right to modify these Terms at any time. We will provide notice of material changes by:
- Posting the updated Terms on our website
- Sending email notification to your registered email address
- Displaying a notice when you log in to the Service

### 18.2 Notice Period

**Material Changes:**
- 30 days' advance notice for changes affecting paid users
- 14 days' advance notice for changes affecting free users
- Immediate effect for legal or regulatory compliance changes

**Non-Material Changes:**
- May take effect immediately upon posting
- Examples: clarifications, formatting, additional examples

### 18.3 Acceptance of Changes

By continuing to use the Service after changes take effect, you accept the revised Terms. If you do not agree:
- You must stop using the Service
- You may cancel your subscription for a pro-rated refund (if within 30 days of notice)

### 18.4 Version History

Previous versions of these Terms are available upon request at legal@abyrith.com.

---

## 19. Contact Information

### 19.1 General Inquiries

**Email:** support@abyrith.com
**Website:** https://abyrith.com
**Address:** [PHYSICAL_ADDRESS]

### 19.2 Legal & Compliance

**Email:** legal@abyrith.com

For legal notices, use:
- Email: legal@abyrith.com
- Mail: [LEGAL_ADDRESS]

### 19.3 Security Issues

**Email:** security@abyrith.com
**Bug Bounty:** [BUG_BOUNTY_URL] (if applicable)

For security vulnerabilities, please use responsible disclosure procedures.

### 19.4 Data Protection Officer (GDPR)

**Email:** dpo@abyrith.com (for EU data protection inquiries)

---

## 20. Miscellaneous

### 20.1 Entire Agreement

These Terms, together with:
- Our Privacy Policy
- Acceptable Use Policy (incorporated by reference)
- Any applicable DPA or SLA

Constitute the entire agreement between you and Abyrith regarding the Service, superseding any prior agreements.

### 20.2 Severability

If any provision of these Terms is held invalid or unenforceable:
- That provision shall be modified to the minimum extent necessary to make it valid
- All other provisions remain in full force and effect

### 20.3 Waiver

Abyrith's failure to enforce any right or provision does not constitute a waiver of that right or provision. Any waiver must be in writing and signed by Abyrith.

### 20.4 Assignment

You may not assign or transfer these Terms or your account without Abyrith's written consent. Abyrith may assign these Terms:
- To an affiliate or subsidiary
- In connection with a merger, acquisition, or sale of assets
- To any successor entity

### 20.5 Force Majeure

Abyrith is not liable for delays or failures in performance due to circumstances beyond reasonable control, including:
- Natural disasters
- War, terrorism, riots, civil unrest
- Government actions or regulations
- Internet or telecommunications failures
- Strikes or labor disputes
- Acts of third-party service providers

### 20.6 Relationship

These Terms do not create a partnership, joint venture, employment, or agency relationship between you and Abyrith.

### 20.7 Export Compliance

You agree to comply with all applicable export and import laws. You represent that:
- You are not located in a country subject to U.S. trade embargo
- You are not on any U.S. list of prohibited or restricted parties
- You will not use the Service in violation of export restrictions

### 20.8 Language

These Terms are written in English. Any translations are provided for convenience only. In the event of conflict, the English version controls.

### 20.9 Survival

The following sections survive termination of these Terms:
- Section 6 (Zero-Knowledge Architecture)
- Section 7 (Data Ownership)
- Section 10 (Intellectual Property)
- Section 13 (Disclaimers)
- Section 14 (Limitation of Liability)
- Section 15 (Indemnification)
- Section 17 (Dispute Resolution)
- Any other provisions that by their nature should survive

---

## Acknowledgment

**BY CREATING AN ACCOUNT, ACCESSING, OR USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.**

**YOU SPECIFICALLY ACKNOWLEDGE AND AGREE TO:**

1. **Zero-Knowledge Architecture:** Abyrith cannot recover lost Master Passwords, and lost Master Passwords result in permanent loss of access to encrypted Secrets.

2. **Disclaimer of Warranties:** The Service is provided "as is" without warranties of any kind.

3. **Limitation of Liability:** Abyrith's liability is limited as specified in Section 14.

4. **Arbitration:** Disputes will be resolved through binding individual arbitration, not class actions or jury trials.

5. **Data Responsibility:** You are responsible for the legality and appropriateness of content you store.

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Legal / Product Lead | Initial Terms of Service draft for Abyrith platform |

---

## Notes for Legal Review

**Before publication, the following must be completed:**

1. **Jurisdiction Specifics:**
   - Specify governing law jurisdiction (Section 17.1)
   - Specify arbitration organization and location (Section 17.3)
   - Specify court jurisdiction (Section 17.5)

2. **Contact Information:**
   - Add physical address (Section 19.1)
   - Add legal notice address (Section 19.2)
   - Confirm email addresses are operational

3. **URLs:**
   - Privacy Policy URL (Section 16.1)
   - Security Documentation URL (Section 16.4)
   - Bug Bounty URL if applicable (Section 19.3)

4. **Legal Compliance:**
   - Review GDPR compliance language with EU legal counsel
   - Review arbitration clause for enforceability in target jurisdictions
   - Confirm export compliance language is adequate
   - Ensure warranty disclaimers and liability limitations are enforceable

5. **Business Specifics:**
   - Finalize pricing and refund policies (Section 8)
   - Define specific uptime SLA (Section 9)
   - Confirm data retention periods (Section 12.4)
   - Verify third-party service names (Section 11)

6. **Translation:**
   - If offering service in non-English jurisdictions, prepare legally reviewed translations

**Legal Disclaimer:** This document is a draft for documentation purposes. It should be reviewed and finalized by qualified legal counsel before use in production.

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge architecture details
- `01-product/product-vision-strategy.md` - Product strategy and target users
- `TECH-STACK.md` - Third-party services used
- `GLOSSARY.md` - Technical term definitions

### External Resources
- [GDPR Official Text](https://gdpr.eu/) - EU data protection regulation
- [SOC 2 Trust Service Criteria](https://www.aicpa.org/soc4so) - Security compliance framework
- [ISO 27001 Standard](https://www.iso.org/isoiec-27001-information-security.html) - Information security management

---

**Document Status:** Draft - Requires legal review before publication

**Next Steps:**
1. Legal team review and revision
2. Compliance team review (GDPR, SOC 2)
3. Executive approval
4. Translation if needed
5. Publication on website and in-app
6. User acceptance flow implementation
