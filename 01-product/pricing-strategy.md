---
Document: Pricing Strategy
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Product Lead
Status: Draft
Dependencies: 01-product/product-vision-strategy.md, ROADMAP.md, TECH-STACK.md
---

# Abyrith Pricing Strategy

## Overview

This document defines Abyrith's complete monetization strategy, pricing tiers, unit economics, and growth model. Our pricing is designed to serve everyone from complete beginners to enterprise security teams while building a sustainable, scalable business.

**Philosophy:** Make secrets management accessible to beginners while capturing value from teams and enterprises. Pricing reflects value delivered, not arbitrary limitations.

**Target:** $10M ARR within 3 years with 40%+ gross margins.

---

## Table of Contents

1. [Pricing Tiers](#pricing-tiers)
2. [Tier Comparison Matrix](#tier-comparison-matrix)
3. [Competitive Pricing Analysis](#competitive-pricing-analysis)
4. [Pricing Psychology & Positioning](#pricing-psychology--positioning)
5. [Unit Economics](#unit-economics)
6. [Discount Strategy](#discount-strategy)
7. [Trial & Freemium Strategy](#trial--freemium-strategy)
8. [Upgrade Path & Conversion Funnel](#upgrade-path--conversion-funnel)
9. [Payment Infrastructure](#payment-infrastructure)
10. [Pricing Experiments & Optimization](#pricing-experiments--optimization)
11. [Revenue Projections](#revenue-projections)
12. [Dependencies](#dependencies)
13. [References](#references)
14. [Change Log](#change-log)

---

## Pricing Tiers

### FREE Tier - "The Learner"

**Target Persona:** Complete beginners, students, hobbyists learning to code

**Price:** $0/month forever

**Purpose:**
- Acquisition funnel top-of-funnel
- Education and brand awareness
- Convert learners to paid as they grow
- Viral growth through word-of-mouth

**Limits:**
- **20 secrets** maximum
- **1 project**
- **2 environments** (Development, Production)
- **Basic AI assistant** (10 AI requests/month with Claude 3.5 Haiku)
- **MCP integration** (read-only, 5 requests/day)
- **Email support** (48-hour response time)
- **Standard security:** Zero-knowledge encryption, 2FA

**What's NOT included:**
- ❌ Team collaboration (invite members)
- ❌ Unlimited AI requests
- ❌ Advanced audit logs (only 7 days)
- ❌ API access
- ❌ Priority support
- ❌ Usage tracking & cost insights

**Estimated COGS:** $0.50-$1.00/user/month
- Storage: ~$0.10
- Database queries: ~$0.20
- AI requests (10 Haiku): ~$0.10
- Bandwidth: ~$0.10
- Infrastructure overhead: ~$0.50

**Conversion Goal:** 15% to PRO within 6 months

**Annual Value if Converted:** $144

---

### PRO Tier - "The Solo Developer"

**Target Persona:** Indie hackers, freelancers, solo developers with multiple projects

**Price:** $12/month ($10/month billed annually - 17% savings)

**Purpose:**
- Primary revenue driver for individuals
- Power users who need unlimited secrets
- High-margin tier (80%+ gross margin)
- Bridge to team/enterprise as they grow

**Limits:**
- **Unlimited secrets**
- **Unlimited projects**
- **Unlimited environments** (dev/staging/prod/custom)
- **Full AI assistant** (100 AI requests/month with Claude 3.5 Sonnet)
- **Extended Thinking AI** (5 complex requests/month with Claude 3.5 Sonnet Extended Thinking)
- **Unlimited MCP integration** (full read/write access)
- **30-day audit logs**
- **Usage tracking** for top 20 API services
- **Cost insights** and limit warnings
- **Browser extension** (when available)
- **CLI tool access** (when available)
- **Priority email support** (24-hour response time)
- **All security features:** Breach detection, key rotation reminders

**What's NOT included:**
- ❌ Team collaboration (can't invite members)
- ❌ Advanced RBAC
- ❌ SSO
- ❌ Approval workflows
- ❌ Custom roles
- ❌ Advanced compliance reporting

**Estimated COGS:** $2.50-$3.50/user/month
- Storage: ~$0.50
- Database queries: ~$0.50
- AI requests (100 Sonnet + 5 Extended): ~$1.50
- Bandwidth: ~$0.30
- Infrastructure overhead: ~$0.70

**Gross Margin:** ~75% ($8.50 profit per user at $12/month)

**Positioning:** "The best $12/month you'll spend as a developer. Never lose an API key again."

**Annual Price:** $120/year ($10/month effective - save $24)

---

### TEAM Tier - "The Development Team"

**Target Persona:** Startups, agencies, small product teams (3-50 developers)

**Price:** $8/user/month ($7/user/month billed annually - 12.5% savings)

**Minimum:** 3 seats ($24/month minimum)

**Purpose:**
- Primary revenue driver overall
- High retention (teams don't churn easily)
- Expansion revenue (add seats as team grows)
- Land-and-expand strategy

**Includes everything in PRO, plus:**
- **Team collaboration:** Invite unlimited members
- **Role-based access control:** Owner, Admin, Developer, Read-Only
- **Shared projects** with environment isolation
- **Activity feed:** See who accessed what and when
- **60-day audit logs** with full search
- **One-time secret sharing** (expiring links)
- **Slack/Email notifications** for secret access
- **Team usage analytics**
- **Priority chat support** (4-hour response time)
- **Onboarding assistance** (for 10+ seats)

**What's NOT included:**
- ❌ SSO (SAML, Okta, Azure AD)
- ❌ SCIM provisioning
- ❌ Advanced approval workflows
- ❌ Custom roles (beyond 4 standard)
- ❌ Compliance exports (SOC 2, ISO 27001)
- ❌ Uptime SLA
- ❌ Dedicated support

**Estimated COGS:** $4.00-$5.00/user/month
- Storage: ~$1.00
- Database queries: ~$1.00
- AI requests: ~$1.50
- Bandwidth: ~$0.50
- Support overhead: ~$1.00

**Gross Margin:** ~40% ($3.20 profit per seat at $8/month)

**Expansion Model:**
- Start with 3-5 seats
- Add seats as team grows
- Average team expansion: 2-3 seats/year
- Retention target: 95%+

**Annual Price:** $84/user/year ($7/user/month effective - save $96 total for 12-user team)

**Positioning:** "Security and collaboration for your entire team. Less than a coffee per developer per week."

---

### ENTERPRISE Tier - "The Security Team"

**Target Persona:** Large organizations (50+ developers), regulated industries (FinTech, HealthTech)

**Price:** Custom pricing (starts at ~$15/user/month for 50+ seats)

**Minimum:** 50 seats (~$9,000/year minimum)

**Purpose:**
- High-value contracts ($50K-$500K ARR)
- Anchor customers for credibility
- Feedback for enterprise features
- Reference customers for sales

**Includes everything in TEAM, plus:**
- **Enterprise SSO:** SAML 2.0, Okta, Azure AD, Google Workspace
- **SCIM provisioning:** Automatic user lifecycle management
- **Advanced approval workflows:** Multi-step approvals, temporary access
- **Custom roles:** Granular permission definitions beyond standard 4 roles
- **Unlimited audit log retention** (7 years for compliance)
- **Compliance exports:** One-click SOC 2, ISO 27001, GDPR reports
- **Advanced security:** Hardware key support (YubiKey), BYOE (Bring Your Own Encryption)
- **API access:** Full REST API for automation
- **Webhook system:** Custom event notifications
- **Dedicated success manager** (for 100+ seats)
- **Priority phone support** (1-hour response time)
- **99.9% uptime SLA** with financial penalties
- **Custom contract terms:** MSA, BAA (HIPAA), DPA (GDPR)
- **Private cloud deployment** (optional, additional cost)
- **White-label options** (optional, additional cost)
- **Custom integrations** (optional, professional services)

**Estimated COGS:** $6.00-$8.00/user/month (economies of scale)
- Storage: ~$1.50
- Database queries: ~$1.50
- AI requests: ~$2.00
- Bandwidth: ~$1.00
- Support + customer success: ~$2.00

**Gross Margin:** ~50% at $15/user/month

**Sales Model:**
- Direct sales (not self-serve)
- 30-day trial with dedicated onboarding
- Annual contracts only
- Optional multi-year discounts (5-10%)

**Contract Structure:**
- Minimum commitment: 1 year
- Quarterly business reviews
- Dedicated Slack channel
- Custom training for security teams

**Pricing Tiers within Enterprise:**
- **Standard Enterprise:** $15/user/month (50-100 seats)
- **Growth Enterprise:** $12/user/month (100-500 seats)
- **Elite Enterprise:** $10/user/month (500+ seats)

**Typical Enterprise Deal:** 100 seats × $12/month × 12 months = **$144,000 ARR**

**Annual Price:** Custom contracts, typically $150-$180K for 100-seat team

**Positioning:** "Enterprise-grade secrets management that your security team will love and your developers will actually use."

---

## Tier Comparison Matrix

| Feature | FREE | PRO | TEAM | ENTERPRISE |
|---------|------|-----|------|------------|
| **Pricing** | $0 | $12/mo | $8/user/mo | Custom ($15+/user) |
| **Annual Discount** | N/A | 17% ($10/mo) | 12.5% ($7/user) | Negotiable |
| **Minimum Seats** | 1 | 1 | 3 ($24/mo) | 50 (~$9K/yr) |
| | | | | |
| **Secrets** | 20 | Unlimited | Unlimited | Unlimited |
| **Projects** | 1 | Unlimited | Unlimited | Unlimited |
| **Environments** | 2 | Unlimited | Unlimited | Unlimited |
| **Team Members** | Solo only | Solo only | Unlimited | Unlimited |
| | | | | |
| **AI Assistant** | 10/mo (Haiku) | 100/mo (Sonnet) | 100/mo (Sonnet) | Unlimited |
| **Extended Thinking** | ❌ | 5/mo | 10/mo | Unlimited |
| **MCP Integration** | Limited (5/day) | Unlimited | Unlimited | Unlimited |
| **Guided Acquisition** | ✅ Top 20 APIs | ✅ Any API | ✅ Any API | ✅ Any API |
| | | | | |
| **Audit Logs** | 7 days | 30 days | 60 days | Unlimited (7yr) |
| **Usage Tracking** | ❌ | ✅ Top 20 | ✅ Top 50 | ✅ All services |
| **Cost Insights** | ❌ | ✅ | ✅ | ✅ Advanced |
| **Breach Detection** | ❌ | ✅ | ✅ | ✅ Priority |
| | | | | |
| **RBAC** | N/A | N/A | 4 roles | Custom roles |
| **Approval Workflows** | ❌ | ❌ | Basic | Advanced |
| **One-Time Shares** | ❌ | ❌ | ✅ | ✅ |
| **Activity Feed** | ❌ | ❌ | ✅ | ✅ Advanced |
| | | | | |
| **SSO (SAML, OAuth)** | ❌ | ❌ | ❌ | ✅ |
| **SCIM Provisioning** | ❌ | ❌ | ❌ | ✅ |
| **Compliance Exports** | ❌ | ❌ | ❌ | ✅ SOC2, ISO |
| **API Access** | ❌ | ❌ | ❌ | ✅ Full REST |
| **Webhooks** | ❌ | ❌ | Basic | ✅ Advanced |
| | | | | |
| **Browser Extension** | When avail. | ✅ | ✅ | ✅ |
| **CLI Tool** | When avail. | ✅ | ✅ | ✅ |
| **Mobile App** | When avail. | ✅ | ✅ | ✅ Priority |
| | | | | |
| **Support** | Email (48hr) | Email (24hr) | Chat (4hr) | Phone (1hr) |
| **Onboarding** | Self-serve | Self-serve | Assisted (10+) | Dedicated CSM |
| **Uptime SLA** | Best effort | 99.5% | 99.5% | 99.9% w/ SLA |
| **Contract Terms** | Monthly | Monthly/Annual | Monthly/Annual | Annual only |

---

## Competitive Pricing Analysis

### 1Password Teams (Password Manager)

**Pricing:**
- Starter: $19.95/month for 10 users ($1.99/user/month)
- Business: $7.99/user/month (min 10 users)
- Enterprise: Custom

**Positioning:**
- Password-first, developer secrets as afterthought
- No AI education or guidance
- No MCP integration
- Strong brand recognition

**Abyrith Advantage:**
- AI-native developer experience
- MCP integration for Claude Code/Cursor
- Purpose-built for API keys, not passwords
- More affordable for small teams ($8/user vs $7.99/user, but 3-seat min vs 10)

---

### HashiCorp Vault (Enterprise Secrets Manager)

**Pricing:**
- Open Source: Free (self-hosted, complex setup)
- HCP Vault: Starts at $0.03/hour (~$22/month for starter cluster)
- Enterprise: $150K-$500K+ annually

**Positioning:**
- Enterprise-focused, steep learning curve
- Infrastructure secrets (not just API keys)
- Requires DevOps expertise
- Very powerful but overkill for most teams

**Abyrith Advantage:**
- 5-year-old simple (vs. requires DevOps team)
- Fully managed (vs. self-hosted complexity)
- AI assistant (vs. documentation-only)
- Affordable for individuals ($12 vs. $22 minimum)
- 90% lower cost for enterprises ($10-15/user vs. $150K base)

---

### AWS Secrets Manager

**Pricing:**
- $0.40 per secret per month
- $0.05 per 10,000 API calls
- No free tier

**Example:** 50 secrets + 100K calls/month = $20 + $0.50 = **$20.50/month**

**Positioning:**
- AWS-native, good for infrastructure secrets
- No UI, API-only
- No AI guidance or education
- Pay-per-secret model

**Abyrith Advantage:**
- Predictable pricing (vs. usage-based surprise bills)
- Beautiful UI (vs. CLI-only)
- AI assistant (vs. none)
- Multi-cloud (vs. AWS-only)
- Cheaper for most use cases ($12 PRO vs. $20+ AWS)

---

### GitHub Secrets (Free with GitHub)

**Pricing:**
- Free for GitHub Actions
- Limited to CI/CD workflows
- No web UI for developers

**Positioning:**
- Free but extremely limited
- CI/CD only, not for development
- No team management
- No audit trails

**Abyrith Advantage:**
- Full-featured secrets management
- Works everywhere (not just GitHub Actions)
- Team collaboration
- AI guidance
- Audit trails and compliance

---

### Doppler (Secrets Management for Developers)

**Pricing:**
- Free: 5 users, basic features
- Team: $12/user/month (min 5 users = $60/month)
- Enterprise: Custom

**Positioning:**
- Developer-focused, good UI
- Environment variables focus
- No AI features
- No MCP integration

**Abyrith Advantage:**
- AI-native guidance (unique to Abyrith)
- MCP integration for Claude Code (unique)
- More affordable for small teams ($24 for 3 vs. $60 for 5)
- Education-first approach (vs. assumes you know what you're doing)

---

### Competitive Pricing Summary

| Competitor | Individual | Team (10 users) | Enterprise | AI Features | MCP |
|------------|------------|-----------------|------------|-------------|-----|
| **Abyrith** | **$12/mo** | **$80/mo** | **$120/mo** | **✅ Full** | **✅** |
| 1Password | N/A | $79.90/mo | Custom | ❌ | ❌ |
| Doppler | Free (limited) | $120/mo | Custom | ❌ | ❌ |
| Vault | $22/mo | ~$200/mo | $150K+/yr | ❌ | ❌ |
| AWS Secrets | $20+/mo | ~$50+/mo | Variable | ❌ | ❌ |
| GitHub | Free | Free | N/A | ❌ | ❌ |

**Abyrith is 20-40% cheaper than direct competitors while offering unique AI and MCP features.**

---

## Pricing Psychology & Positioning

### Anchoring Strategy

**Price Anchor:** Display ENTERPRISE tier first on pricing page to make TEAM and PRO feel like bargains.

**Psychological Anchoring:**
- Show annual pricing as "per month" ($10/mo instead of $120/year)
- Display total team cost vs. per-user cost ("$80/month for your team" vs. "$8/user")
- Compare to daily coffee ("Less than $0.40/day per developer")

**Decoy Effect:**
- TEAM tier is designed to make PRO feel like great value for individuals
- ENTERPRISE makes TEAM look extremely affordable
- FREE tier gets people in the door, PRO is "obvious" upgrade

### Value-Based Pricing

**PRO Tier Value Proposition:**
- Time saved finding lost API keys: **10+ hours/year** = $500+ value (at $50/hour developer rate)
- Prevented security incidents: **Priceless** (average breach costs $4.35M according to IBM)
- AI guidance: Equivalent to **$100+/month** Claude API subscription for power users
- Peace of mind: **$144/year** for never worrying about API keys again

**ROI Pitch:**
"If Abyrith saves you just 2 hours per year finding lost API keys, it's paid for itself 8× over."

**TEAM Tier Value Proposition:**
- Developer productivity: **5 hours saved per developer per year** = $2,500 value for 10-person team
- Security risk reduction: Prevents accidental key leaks to git (**$50K+ average incident cost**)
- Compliance readiness: Audit logs and access control = **$10K-$50K** value for SOC 2 prep
- **ROI: 31× return** on $960/year investment for 10-person team

---

### Framing & Messaging

**FREE Tier:**
- Headline: "Start Free, Forever"
- Subhead: "Perfect for learning to code and personal projects"
- CTA: "Start Learning" (not "Sign Up")

**PRO Tier:**
- Headline: "For Serious Developers"
- Subhead: "Everything you need, nothing you don't"
- Badge: "MOST POPULAR" or "BEST VALUE"
- CTA: "Start 14-Day Free Trial" (no credit card required)

**TEAM Tier:**
- Headline: "Built for Teams"
- Subhead: "Secure collaboration for modern development teams"
- Social Proof: "Trusted by 500+ development teams"
- CTA: "Start Team Trial" or "Talk to Sales" (for 20+ seats)

**ENTERPRISE Tier:**
- Headline: "Enterprise-Grade Security"
- Subhead: "Everything your security team requires, everything your developers will love"
- Badge: "COMPLIANCE READY"
- CTA: "Contact Sales" or "Schedule Demo"

---

### Pricing Page Design

**Layout (Top to Bottom):**

1. **Hero Section:**
   - "Pricing That Scales With You"
   - "From learning to code to enterprise security. One platform, four plans."

2. **Annual/Monthly Toggle:**
   - Default: Annual (shows savings)
   - "Save 17% with annual billing"

3. **Pricing Cards (Left to Right):**
   - FREE → PRO (highlighted) → TEAM → ENTERPRISE
   - Each card shows: Price, Key features (5-7 bullets), CTA button

4. **Comparison Table:**
   - All features compared side-by-side
   - Collapsible sections: Security, AI, Collaboration, Compliance, Support

5. **FAQ Section:**
   - "Can I change plans anytime?" (Yes)
   - "What payment methods do you accept?" (Credit card, ACH for Enterprise)
   - "Do you offer discounts?" (Students, open source, non-profits - see Discount Strategy)
   - "What happens if I exceed my limits?" (Friendly notification, easy upgrade)
   - "Is my data secure?" (Link to security model)

6. **Social Proof:**
   - Customer logos (when available)
   - Testimonials
   - "Join 5,000+ developers who trust Abyrith"

7. **Bottom CTA:**
   - "Still not sure? Start free and upgrade when you're ready."

---

## Unit Economics

### Customer Acquisition Cost (CAC)

**Target CAC by Channel:**

**Organic (Content Marketing, SEO):**
- CAC: $10-$30
- Strategy: Blog posts, tutorials, open-source contributions
- Best for: FREE → PRO conversions

**Product-Led Growth (PLG):**
- CAC: $5-$15
- Strategy: Viral features (MCP sharing, project templates)
- Best for: Team expansion (existing users invite teammates)

**Paid Advertising (Google Ads, Reddit, Dev.to):**
- CAC: $50-$150
- Strategy: Target "API key management," "secrets management for developers"
- Best for: PRO direct signups

**Direct Sales (Enterprise):**
- CAC: $5,000-$15,000
- Strategy: Outbound sales, conferences, partnerships
- Best for: ENTERPRISE deals ($144K+ ARR)

**Blended CAC Target (Year 1):** $100

**Blended CAC Target (Year 3):** $50 (as organic/PLG increases)

---

### Lifetime Value (LTV)

**FREE Users:**
- LTV: $0 direct (but 15% convert to PRO within 6 months)
- Lifetime: 6-12 months before churn or conversion
- Value: Brand awareness, viral growth, future conversion

**PRO Users:**
- Average subscription length: 24 months (before upgrade to TEAM or churn)
- Churn rate: 5% monthly = 60% annual retention
- LTV = $12/month × 24 months = **$288**
- LTV:CAC ratio = $288 / $100 = **2.9:1** (target: >3:1)

**TEAM Users:**
- Average subscription length: 36+ months (teams don't churn easily)
- Churn rate: 2% monthly = 78% annual retention
- Average starting team size: 5 seats
- Expansion: +2 seats/year
- LTV = ($8 × 5 seats × 12 months × 3 years) + (expansion revenue)
- LTV = $1,440 + $576 (expansion) = **$2,016**
- LTV:CAC ratio = $2,016 / $100 = **20:1** (excellent)

**ENTERPRISE Users:**
- Average contract length: 3+ years (annual renewals)
- Churn rate: <5% annually
- Average contract size: $144K/year
- Expansion: 10-20% annual growth
- LTV = $144K × 3 years × 1.15 (expansion) = **$496,800**
- LTV:CAC ratio = $496,800 / $10,000 = **49.7:1** (exceptional)

**Blended LTV Target:** $500-$1,000 per customer

**Overall LTV:CAC Target:** 5:1 (healthy SaaS benchmark is 3:1+)

---

### Gross Margin Targets

**By Tier:**
- FREE: -100% (loss leader for acquisition)
- PRO: 75% ($9 profit on $12 revenue)
- TEAM: 40% ($3.20 profit per seat on $8 revenue)
- ENTERPRISE: 50% ($7.50 profit per seat on $15 revenue)

**Blended Gross Margin Target:** 60-65% (year 1) → 70%+ (year 3 as scale improves)

**Cost Structure:**
- Infrastructure (Supabase, Cloudflare): 20-25% of revenue
- AI costs (Claude API): 10-15% of revenue
- Support: 5-10% of revenue
- Payment processing (Stripe): 2.9% + $0.30

**Margin Improvement Levers:**
- Negotiate volume discounts with Supabase, Cloudflare (at $1M+ ARR)
- Optimize AI usage (cache responses, use cheaper models when appropriate)
- Self-serve reduces support costs
- Infrastructure efficiency improvements

---

### Payback Period

**Target Payback Period:** <12 months for all tiers

**PRO:**
- CAC: $100
- Monthly Revenue: $12
- Payback: 8.3 months (good)

**TEAM:**
- CAC: $100 (PLG, existing user adds team)
- Monthly Revenue: $40 (5 seats)
- Payback: 2.5 months (excellent)

**ENTERPRISE:**
- CAC: $10,000 (direct sales)
- Monthly Revenue: $12,000 (100 seats × $10/month with annual discount)
- Payback: 0.83 months (exceptional - typically paid upfront annually)

---

## Discount Strategy

### Standard Discounts

**Annual Discount:**
- PRO: 17% discount ($10/month instead of $12/month) = **Save $24/year**
- TEAM: 12.5% discount ($7/user instead of $8/user) = **Save $12/user/year**
- ENTERPRISE: Negotiable (5-10% for multi-year contracts)

**Rationale:**
- Improves cash flow (upfront annual payment)
- Reduces churn (annual commitment)
- Standard SaaS practice
- 2 months free effectively (10 months cost = 12 months service)

---

### Educational Discounts

**Students & Educators:**
- **100% off PRO** (free as long as verified student status via GitHub Student Developer Pack or .edu email)
- Purpose: Build brand loyalty, word-of-mouth growth
- Verification: GitHub Education verification or valid .edu email
- Limitations: Cannot upgrade to TEAM (must graduate to standard PRO first)

**Educational Institutions:**
- TEAM tier: **50% off** ($4/user/month)
- Purpose: Teach secure development practices
- Requirements: .edu domain, minimum 10 seats
- Case studies and testimonials for marketing

---

### Open Source & Non-Profit Discounts

**Open Source Maintainers:**
- **Free PRO** for verified open source maintainers with 1,000+ GitHub stars on project
- **50% off TEAM** for open source organizations
- Purpose: Give back to community, build goodwill
- Verification: GitHub API check for repository stars
- Marketing: "Abyrith supports open source" badge for their README

**Non-Profit Organizations:**
- TEAM tier: **40% off** ($4.80/user/month)
- ENTERPRISE tier: **30% off**
- Requirements: 501(c)(3) status verification
- Purpose: Social good, tax benefits, case studies

---

### Startup Discounts

**Early-Stage Startups (Seed/Series A):**
- TEAM tier: **25% off for first year** ($6/user/month)
- Requirements:
  - <2 years since incorporation
  - <$5M in funding
  - Apply through startup program
- Purpose: Land future enterprise customers early
- Value: $480/year savings for 10-person team
- Marketing: Case studies, testimonials, co-marketing

**Y Combinator / Accelerator Partners:**
- TEAM tier: **50% off for 12 months** ($4/user/month)
- Exclusive partnership with accelerators
- Convert to standard pricing after 12 months
- Purpose: Rapid growth, brand association with top startups

---

### Volume Discounts (Enterprise)

**Seat-Based Discounts:**
- 50-100 seats: Standard rate ($15/user/month)
- 100-500 seats: 20% off ($12/user/month)
- 500+ seats: 33% off ($10/user/month)
- 1,000+ seats: Custom pricing (call it $8-9/user/month)

**Multi-Year Discounts:**
- 2-year contract: Additional 5% off
- 3-year contract: Additional 10% off

**Example:** 200-seat team, 2-year contract:
- Base: $12/user/month × 200 = $2,400/month = $28,800/year
- 2-year discount (5%): $27,360/year
- Total 2-year contract: **$54,720**

---

### Referral Program

**Referral Rewards:**
- Referrer: **1 month free** for each paying customer referred (PRO or TEAM)
- Referee: **1 month free** on PRO/TEAM signup
- Purpose: Viral growth, reduce CAC
- Limitations: Max 12 months free per year (cannot stack indefinitely)

**Implementation:**
- Unique referral links for each user
- Automatic credit applied
- Dashboard showing referral status

**Projected Impact:**
- 10-15% of signups come from referrals
- CAC reduction: $50 → $35 for referred customers

---

### Partner & Reseller Discounts

**Technology Partners (Stripe, Supabase, Cloudflare):**
- Listed in partner marketplace
- Special co-marketing pricing (20% off first year)
- Purpose: Distribution, brand alignment

**Resellers & Agencies:**
- 20% commission on referred enterprise deals
- White-label options (additional fee)
- Purpose: Channel sales expansion

---

## Trial & Freemium Strategy

### Free Trial Strategy

**PRO Tier:**
- **14-day free trial** (no credit card required)
- Full PRO features unlocked
- Email sequence:
  - Day 1: Welcome + quick start guide
  - Day 3: "Here's how to use AI assistant"
  - Day 7: "You're halfway through your trial"
  - Day 10: "4 days left - here's what you'll lose"
  - Day 13: "Last chance - upgrade now"
- Conversion goal: 25% trial → paid
- Friction removal: 1-click upgrade, saved payment method

**TEAM Tier:**
- **14-day free trial** (no credit card required)
- Can invite up to 10 teammates during trial
- Dedicated onboarding for 10+ seat trials
- Conversion goal: 35% trial → paid (higher because teams have more friction to churn)

**ENTERPRISE Tier:**
- **30-day proof-of-concept** with dedicated support
- Requires sales call to activate
- Custom onboarding, SSO setup, compliance review
- Conversion goal: 60% trial → contract

---

### Freemium Model Details

**FREE Tier as Funnel:**
- Designed to be genuinely useful (20 secrets is enough for most learners)
- Not crippled/annoying (vs. competitors with 5-secret limits)
- Natural upgrade triggers:
  - Hit 20-secret limit
  - Want to start a second project
  - Need unlimited AI requests
  - Want to use MCP integration more than 5 times/day

**Upgrade Prompts (In-App):**
- Gentle notification at 15/20 secrets: "You're almost at the limit. Upgrade to PRO for unlimited secrets."
- Hard stop at 20/20 secrets: "You've reached the FREE limit. Upgrade to continue adding secrets."
- MCP rate limit: "You've used 5 MCP requests today. Upgrade to PRO for unlimited access."
- AI request limit: "You've used 10 AI requests this month. Upgrade for 100 requests with Claude 3.5 Sonnet."

**Conversion Optimization:**
- Show value before asking for payment (e.g., "You've saved 50 hours with Abyrith. Upgrade to save even more.")
- Social proof: "Join 1,000+ PRO users who've upgraded"
- Offer discount for immediate upgrade: "Upgrade now and get 20% off your first month"

---

### Trial-to-Paid Conversion Tactics

**Email Campaigns:**
- Onboarding sequence (Days 1, 3, 5, 7)
- Value demonstration: "Here's what you accomplished this week"
- Feature education: "Did you know PRO includes breach detection?"
- Urgency: "Trial ending soon - don't lose your setup"

**In-App Messaging:**
- Feature callouts: "This feature is available in PRO"
- Usage milestones: "You've used Abyrith 20 times. Upgrade to PRO?"
- Success metrics: "You've secured 50 API keys. PRO users secure 200+ on average."

**Exit Intent:**
- When user tries to cancel or end trial: "What would make you stay?"
- Offer alternatives: "Not ready for PRO? Stay on FREE (with limits)"
- Last-minute discount: "Take 20% off your first month if you upgrade now"

---

## Upgrade Path & Conversion Funnel

### FREE → PRO Conversion

**Triggers:**
1. Hit 20-secret limit (most common)
2. Want second project
3. Hit AI request limit (10/month)
4. Hit MCP daily limit (5/day)
5. Want browser extension or CLI
6. Need longer audit logs (30 days vs 7 days)

**Conversion Funnel:**
1. **Awareness:** In-app prompt "Upgrade to PRO for unlimited secrets"
2. **Consideration:** Show pricing comparison modal
3. **Decision:** 1-click upgrade (saved payment method or Stripe checkout)
4. **Confirmation:** "Welcome to PRO! Here's what's unlocked:"

**Conversion Rate Target:** 15% FREE → PRO within 6 months

**Optimization:**
- A/B test upgrade prompts
- Test different pricing display formats
- Personalized upgrade messages based on usage patterns

---

### PRO → TEAM Conversion

**Triggers:**
1. User tries to share a secret (realizes they can't on PRO)
2. User mentions "my team" in support conversation
3. User has >50 secrets (indicates team-scale usage)
4. LinkedIn shows they're at a company with 5+ engineers

**Conversion Funnel:**
1. **Detection:** Identify PRO users who would benefit from TEAM
2. **Outreach:** Email campaign "Ready to bring your team to Abyrith?"
3. **Demo:** Show team features (RBAC, activity feed, shared projects)
4. **Offer:** "Your first 3 teammates are free for 30 days"
5. **Conversion:** Upgrade to TEAM, invite teammates

**Conversion Rate Target:** 10% PRO → TEAM within 12 months

**Incentive:**
- Keep user's PRO price ($12) when they upgrade to TEAM owner role
- First month free for all invited teammates
- Dedicated onboarding call for smooth transition

---

### TEAM → ENTERPRISE Conversion

**Triggers:**
1. Team grows past 50 seats
2. Security/compliance requirements (SOC 2, ISO 27001)
3. Need for SSO (Okta, Azure AD)
4. Request for MSA, BAA, or DPA contract terms
5. Support asks exceed TEAM SLA

**Conversion Funnel:**
1. **Qualification:** Sales team reaches out to large TEAM accounts
2. **Discovery Call:** Understand compliance, security, and scale needs
3. **Demo:** Show enterprise features (SSO, SCIM, compliance exports)
4. **Proposal:** Custom pricing based on seat count and requirements
5. **Negotiation:** Contract terms, MSA, SLA agreements
6. **Onboarding:** Dedicated CSM, migration assistance, training

**Conversion Rate Target:** 30% of TEAM accounts with 50+ seats → ENTERPRISE within 24 months

**Sales-Assist Model:**
- TEAM accounts with 20+ seats flagged for sales outreach
- Quarterly business reviews for 30+ seat teams
- Proactive feature suggestions based on usage

---

## Payment Infrastructure

### Payment Provider

**Primary: Stripe**
- **Why:** Best-in-class for SaaS, supports subscriptions, global payments, excellent API
- **Features:**
  - Subscription management
  - Automatic invoicing
  - Dunning (failed payment recovery)
  - Revenue recognition
  - Tax calculation (Stripe Tax)
  - PCI compliance (Stripe handles all card data)
- **Fees:** 2.9% + $0.30 per transaction
- **Documentation needed:** `06-backend/integrations/stripe-integration.md`

**Secondary (Enterprise): ACH / Wire Transfer**
- For large enterprise contracts (>$50K/year)
- Lower fees (ACH: $5 flat fee)
- Requires manual invoice processing

---

### Subscription Management

**Billing Cycles:**
- Monthly: Billed on signup date (e.g., 15th of each month)
- Annual: Billed once per year, 17% discount

**Proration:**
- Upgrades: Immediate access, prorated charge
- Downgrades: Take effect at next billing cycle (keep current features until then)
- Seat changes: Prorated immediately (add/remove seats)

**Failed Payments:**
- Retry schedule:
  - Day 0: Payment fails, email notification
  - Day 3: Retry, second email notification
  - Day 7: Retry, final warning email
  - Day 10: Retry, downgrade warning
  - Day 14: Downgrade to FREE or suspend account
- Grace period: 14 days before downgrade
- Recovery: 90% recovery rate with Stripe's smart retries

**Invoicing:**
- Auto-generated invoices via Stripe
- PDF download available in dashboard
- Custom PO numbers for enterprise (via Stripe metadata)

---

### Supported Payment Methods

**Credit/Debit Cards:**
- Visa, Mastercard, American Express, Discover
- International cards supported
- 3D Secure (SCA compliance for EU)

**Digital Wallets:**
- Apple Pay
- Google Pay

**Enterprise Payments:**
- ACH (US)
- Wire transfer (global)
- Custom NET-30 or NET-60 terms (for $100K+ contracts)

**Regional Support:**
- USD (primary)
- EUR, GBP (planned for year 2)
- Local payment methods (Giropay, iDEAL, Bancontact) via Stripe

---

### Tax Handling

**Stripe Tax Integration:**
- Automatic tax calculation for 50+ countries
- VAT, GST, sales tax
- Tax ID validation (EU VAT numbers)
- Tax-exempt certificates (non-profits, educational institutions)

**Tax Compliance:**
- Reverse charge for EU B2B (VAT not charged if valid VAT ID)
- US sales tax (collected in states where required)
- Quarterly tax remittance

---

## Pricing Experiments & Optimization

### A/B Testing Framework

**Tests to Run:**

**Test 1: Pricing Page Layout**
- Variant A: 4 tiers horizontal (FREE, PRO, TEAM, ENTERPRISE)
- Variant B: 3 tiers horizontal (hide FREE, show as footnote)
- Variant C: Slider (move slider to see tier features)
- Metric: Conversion rate to trial signup

**Test 2: Price Display**
- Variant A: $12/month (monthly price)
- Variant B: $10/month (billed annually)
- Variant C: $120/year (annual price upfront)
- Metric: Annual vs. monthly subscription ratio

**Test 3: CTA Button Text**
- Variant A: "Start Free Trial"
- Variant B: "Try PRO Free for 14 Days"
- Variant C: "Get Started Free"
- Metric: Click-through rate to signup

**Test 4: Social Proof**
- Variant A: "Join 5,000+ developers"
- Variant B: "Trusted by teams at Google, Stripe, Vercel"
- Variant C: Customer testimonial quotes
- Metric: Conversion rate

**Test 5: Discount Messaging**
- Variant A: "Save 17% with annual billing"
- Variant B: "Get 2 months free"
- Variant C: "Save $24/year"
- Metric: Annual subscription rate

---

### Price Elasticity Testing

**Willingness to Pay Research:**
- Van Westendorp Price Sensitivity Meter (survey)
- Conjoint analysis (feature vs. price trade-offs)
- User interviews (what would you pay for this?)

**Price Increase Testing:**
- Grandfather existing customers (keep current price)
- Test higher prices on new signups only
- Measure: Conversion rate, churn rate, revenue per customer

**Potential Price Adjustments (Year 2):**
- PRO: $12 → $15 (25% increase if market accepts)
- TEAM: $8 → $10 (if competitive landscape allows)
- Always grandfather existing customers

---

### Conversion Rate Optimization

**Key Metrics to Track:**
- FREE signup rate (visitors → signups)
- FREE → PRO conversion rate (target: 15% within 6 months)
- PRO trial → paid conversion rate (target: 25%)
- TEAM trial → paid conversion rate (target: 35%)
- Monthly → annual conversion rate (target: 40% choose annual)
- Upsell rate PRO → TEAM (target: 10% within 12 months)

**Optimization Tactics:**
- Reduce friction: 1-click upgrades, saved payment methods
- Increase urgency: "Upgrade now and save 20%" (limited-time offers)
- Personalization: Show upgrade prompts based on usage patterns
- Incentives: Free month for annual commitment
- Exit intent: Offer discount if user tries to cancel trial

---

### Feature-Value Alignment

**Regularly Assess:**
- Which features drive upgrades? (usage data)
- Which features are never used? (remove or make more visible)
- Which features should move to different tiers? (value-based rebalancing)

**Example Insights:**
- If 80% of PRO users never use Extended Thinking AI (5 requests/month), move to TEAM tier
- If FREE users constantly hit MCP rate limit (5/day), increase to 10/day to reduce frustration
- If TEAM users rarely use activity feed, simplify or improve UX

---

## Revenue Projections

### Year 1 (MVP Launch + Growth)

**Assumptions:**
- Launch: January 2026
- Growth: 40% MoM for first 6 months, then 20% MoM
- Conversion rates: 15% FREE → PRO, 10% PRO → TEAM, 5% TEAM → ENTERPRISE

**Q1 2026 (Launch):**
- FREE: 500 users
- PRO: 50 users × $12 = $600 MRR
- TEAM: 5 teams (25 seats) × $8 = $200 MRR
- **Total Q1:** $800 MRR, $2,400 revenue

**Q2 2026:**
- FREE: 3,000 users
- PRO: 400 users × $12 = $4,800 MRR
- TEAM: 30 teams (200 seats) × $8 = $1,600 MRR
- **Total Q2:** $6,400 MRR, $19,200 revenue

**Q3 2026:**
- FREE: 10,000 users
- PRO: 1,200 users × $12 = $14,400 MRR
- TEAM: 80 teams (600 seats) × $8 = $4,800 MRR
- ENTERPRISE: 2 contracts (150 seats) × $12 = $1,800 MRR
- **Total Q3:** $21,000 MRR, $63,000 revenue

**Q4 2026:**
- FREE: 25,000 users
- PRO: 2,500 users × $12 = $30,000 MRR
- TEAM: 150 teams (1,200 seats) × $8 = $9,600 MRR
- ENTERPRISE: 5 contracts (400 seats) × $12 = $4,800 MRR
- **Total Q4:** $44,400 MRR, $133,200 revenue

**Year 1 Total Revenue:** ~$220K

---

### Year 2 (Scaling + Enterprise Focus)

**Assumptions:**
- Growth: 15% MoM (more sustainable)
- Enterprise sales ramp up (3-6 month sales cycle)
- Improved conversion rates (better product, more features)

**Q1 2027:**
- PRO: 5,000 users × $12 = $60,000 MRR
- TEAM: 300 teams (2,500 seats) × $8 = $20,000 MRR
- ENTERPRISE: 12 contracts (1,000 seats) × $12 = $12,000 MRR
- **Total Q1 2027:** $92,000 MRR, $276,000 revenue

**Q4 2027:**
- PRO: 10,000 users × $12 = $120,000 MRR
- TEAM: 600 teams (5,000 seats) × $8 = $40,000 MRR
- ENTERPRISE: 25 contracts (2,500 seats) × $12 = $30,000 MRR
- **Total Q4 2027:** $190,000 MRR, $570,000 revenue

**Year 2 Total Revenue:** ~$1.8M ARR

---

### Year 3 (Profitability + Scaling)

**Assumptions:**
- Growth: 10% MoM (mature growth)
- Enterprise becomes 40% of revenue
- Improved margins (scale economies)

**Q1 2028:**
- PRO: 18,000 users × $12 = $216,000 MRR
- TEAM: 1,000 teams (10,000 seats) × $8 = $80,000 MRR
- ENTERPRISE: 60 contracts (6,000 seats) × $12 = $72,000 MRR
- **Total Q1 2028:** $368,000 MRR, $1.1M revenue

**Q4 2028:**
- PRO: 30,000 users × $12 = $360,000 MRR
- TEAM: 1,500 teams (15,000 seats) × $8 = $120,000 MRR
- ENTERPRISE: 100 contracts (10,000 seats) × $12 = $120,000 MRR
- **Total Q4 2028:** $600,000 MRR, $1.8M revenue

**Year 3 Total Revenue:** ~$5.5M ARR

**Profitability:**
- Gross margin: 70% ($3.85M gross profit)
- Operating expenses: $2.5M (team of 15-20)
- EBITDA: $1.35M (25% margin)
- **Profitable in Year 3!**

---

### 3-Year Summary

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **MRR (End of Year)** | $44K | $190K | $600K |
| **ARR** | $220K | $1.8M | $5.5M |
| **FREE Users** | 25,000 | 100,000 | 250,000 |
| **PRO Users** | 2,500 | 10,000 | 30,000 |
| **TEAM Seats** | 1,200 | 5,000 | 15,000 |
| **ENTERPRISE Seats** | 400 | 2,500 | 10,000 |
| **Gross Margin** | 50% | 60% | 70% |
| **EBITDA Margin** | -300% | -50% | +25% |
| **Team Size** | 5 | 12 | 20 |

---

## Dependencies

### Technical Dependencies

**Must exist before pricing implementation:**
- [ ] `06-backend/integrations/stripe-integration.md` - Payment processing
- [ ] `07-frontend/billing/billing-dashboard.md` - User billing UI
- [ ] `05-api/endpoints/subscriptions-endpoints.md` - Subscription management API
- [ ] `04-database/schemas/subscriptions.md` - Subscription data model

**Business Dependencies:**
- [ ] Legal: Terms of Service, Privacy Policy
- [ ] Finance: Stripe account, bank account
- [ ] Compliance: Tax registration, PCI compliance (handled by Stripe)

---

## References

### Internal Documentation
- `01-product/product-vision-strategy.md` - Product vision and personas
- `ROADMAP.md` - Feature roadmap and prioritization
- `TECH-STACK.md` - Technology stack and costs
- `02-architecture/system-overview.md` - System architecture
- `GLOSSARY.md` - Term definitions

### External Resources
- [Stripe Billing Documentation](https://stripe.com/docs/billing) - Payment infrastructure
- [OpenView SaaS Benchmarks](https://openviewpartners.com/benchmarks/) - SaaS metrics
- [Price Intelligently](https://www.priceintelligently.com/) - Pricing research
- [SaaStr](https://www.saastr.com/) - SaaS business insights
- [Profitwell](https://www.profitwell.com/recur) - Subscription analytics

### Competitive Research
- 1Password pricing: https://1password.com/teams/pricing/
- Doppler pricing: https://www.doppler.com/pricing
- HashiCorp Vault pricing: https://www.hashicorp.com/products/vault/pricing
- AWS Secrets Manager pricing: https://aws.amazon.com/secrets-manager/pricing/

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Product Lead | Initial comprehensive pricing strategy covering all tiers, unit economics, competitive analysis, and 3-year revenue projections |

---

## Notes

### Future Pricing Considerations

**Year 2 Additions:**
- **Add-ons:** White-label ($500/month), Private Cloud Deployment ($5K/month), Custom Integrations (professional services)
- **Usage-Based Pricing:** Consider usage-based tier for high-volume API access (e.g., $0.10/1000 API calls beyond included amount)
- **Partner Tiers:** Reseller pricing, technology partner bundles

**International Expansion:**
- Local currency support (EUR, GBP by Year 2)
- Regional pricing adjustments (purchasing power parity)
- Local payment methods (Alipay, WeChat Pay for Asia expansion)

**Price Optimization:**
- Consider raising PRO to $15/month in Year 2 (grandfather existing customers)
- Test $9-10/user for TEAM tier if competitive landscape allows
- Enterprise pricing optimization based on deal data

### Open Questions

**To Validate:**
- [ ] Is $12/month PRO price optimal? (Run Van Westendorp survey)
- [ ] Should TEAM minimum be 3 seats or 5 seats? (Test conversion rates)
- [ ] Is 17% annual discount enough incentive? (Test 15% vs 20%)
- [ ] Should we offer monthly enterprise contracts? (Current: annual only)

**To Research:**
- [ ] What's the optimal FREE tier limit? (20 secrets vs 50 secrets vs unlimited with usage caps)
- [ ] Should we cap MCP requests on FREE/PRO or make unlimited? (Usage-based risk)
- [ ] What's the willingness to pay for white-label and private cloud? (Enterprise research)

**Next Review:** Q1 2026 (after 3 months of live pricing data)
