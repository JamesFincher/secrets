# Abyrith: Product Vision & Strategy

## Executive Summary

Abyrith is an AI-native secrets management platform that makes acquiring, storing, and using API keys effortless for everyone—from complete beginners to enterprise teams. We eliminate the friction and confusion around developer secrets through intelligent guidance, zero-knowledge security, and seamless integration with modern development workflows.

**Core Vision:** Make API key management so simple a 5-year-old could do it, while maintaining enterprise-grade security.

**The Problem:** 
- Beginners see "Add your API key" in tutorials and have no idea what that means or how to get one
- Developers store keys insecurely (.env files committed to git, keys in Slack messages)
- Teams lack visibility into who has access to what keys
- No one understands what they're paying for or usage limits until they get a surprise bill

**Abyrith's Solution:**
- **AI Education:** Explains what each API key does, how to get it, pricing, limits—in plain English
- **Guided Acquisition:** Step-by-step instructions so simple anyone can follow them
- **Secure by Default:** Zero-knowledge encryption, you control the keys to decrypt
- **Everywhere:** Web app, MCP (for Claude Code/AI tools), browser extension, CLI, mobile
- **Team-Ready:** Project-based organization, environment management, audit trails

**Key Differentiators:**
- **AI-Native Design** - Built for the age of AI-powered development
- **Education-First** - We teach as we protect
- **MCP Integration** - Claude Code requests keys directly, you approve once
- **Zero-Knowledge** - We can't read your secrets, even if we wanted to
- **Beginner to Enterprise** - Same simplicity whether you're learning or managing 1000 keys

---

## The Problem We Solve

**For Beginners & Learners:**
"I'm following a tutorial that says 'Add your OpenAI API key' but I have no idea what that is, where to get one, or if it costs money."

**For Developers:**
"I'm storing keys in .env files, sometimes they get committed to git, I've accidentally leaked keys in Slack, and I have no idea which keys are used where or what they're costing me."

**For Teams:**
"We need to share API keys securely, track who has access, rotate them regularly, and maintain audit trails for compliance. Current solutions are either too complex or not developer-focused."

**Why Current Solutions Fail:**

**Traditional Password Managers (1Password, LastPass):**
- Great for passwords, awkward for developer secrets
- No understanding of API keys, pricing, usage limits
- No integration with development workflows
- No education or guidance

**Enterprise Secrets Managers (HashiCorp Vault, AWS Secrets Manager):**
- Too complex for individuals and small teams
- Steep learning curve
- Expensive
- Overkill for most use cases

**The "Just Use .env Files" Approach:**
- Keys get committed to git (security nightmare)
- No sharing mechanism for teams
- No encryption at rest
- No audit trails
- No understanding of costs or limits

**Abyrith Solves This:** A secrets manager that educates, guides, protects, and integrates seamlessly with how developers actually work—especially in the age of AI-powered development.

---

## Target Market

Abyrith serves anyone who needs to manage API keys and developer secrets, from complete beginners to enterprise security teams.

### Primary Personas

**🌱 The Learner ("5-Year-Old Simple")**
- **Profile:** Learning to code, following tutorials, building first projects
- **Background:** Student, bootcamp grad, career changer, hobbyist
- **Pain Point:** Tutorial says "add your API key" and they're completely lost
- **Needs:** 
  - Plain English explanation of what an API key is
  - Step-by-step instructions to get keys from services
  - Understanding of costs before signing up
  - Secure storage without complexity
- **Success Metric:** Gets their first API key working in under 10 minutes

**🚀 The Solo Developer / Indie Hacker**
- **Profile:** Building projects alone or with a small team
- **Background:** Freelancer, startup founder, side project enthusiast
- **Pain Point:** Keys scattered across .env files, Slack, notes apps—insecure and disorganized
- **Needs:**
  - Secure storage for all their API keys
  - Quick access across projects
  - Understanding of what each key costs
  - Not another enterprise tool to learn
- **Success Metric:** All secrets centralized and secure within a day

**👥 The Development Team**
- **Profile:** 3-50 developers working on multiple projects
- **Background:** Startups, agencies, small product teams
- **Pain Point:** Sharing keys via Slack/email, no visibility into who has what, keys never rotated
- **Needs:**
  - Team sharing with role-based access
  - Project and environment organization
  - Audit trails for compliance
  - Works with their existing tools (GitHub, Claude, Cursor)
- **Success Metric:** Entire team onboarded and using secure secrets in a week

**🏢 The Enterprise Security / DevOps Team**
- **Profile:** Managing secrets for dozens of teams and hundreds of developers
- **Background:** FinTech, Healthcare, Large SaaS companies
- **Pain Point:** Compliance requirements, key rotation, audit trails, preventing leaks
- **Needs:**
  - Enterprise SSO
  - Detailed audit logs
  - Automated rotation and expiry policies
  - Compliance reporting (SOC 2, ISO 27001)
  - API for automation
- **Success Metric:** Meets compliance requirements while developers stay productive

### Use Case Scenarios

**Scenario 1: First-Time API User**
```
Student following tutorial: "Add your OpenAI API key"
→ Opens Abyrith: "I need an OpenAI API key"
→ AI explains: "OpenAI lets you use ChatGPT in your code. 
   You'll get $5 free credit, then pay per use."
→ Shows step-by-step: "1) Go to platform.openai.com/api-keys 
   2) Click 'Create new secret key' 3) Copy it here"
→ User gets key, stores it securely
→ Tutorial works!
```

**Scenario 2: Developer Using Claude Code**
```
Developer building app with Claude Code
→ Claude Code: "I need STRIPE_API_KEY to test payments"
→ Abyrith MCP triggers
→ If key exists: User approves once, Claude gets it
→ If not: Dashboard shows "Claude requested STRIPE_API_KEY"
→ User: "I need Stripe key"
→ AI: Shows instructions, explains pricing
→ User adds key, Claude continues building
```

**Scenario 3: Team Onboarding**
```
New developer joins team
→ Gets invited to Abyrith project
→ Clones repo with encrypted Abyrith reference
→ Runs `abyrith init`
→ Authenticates once
→ All project keys available to their dev environment
→ No keys in Slack, no .env files to find
```

**Scenario 4: Enterprise Compliance**
```
Security audit coming up
→ Security team: "Show me all API key access for Q4"
→ Abyrith: Generates audit report
→ Who accessed what, when, from where
→ Which keys are close to limits
→ Which keys haven't been rotated
→ One-click compliance export
```

### Universal Value Proposition

Regardless of persona, everyone gets:
- **AI Education** - Understand what each key does, costs, and how to get it
- **Security by Default** - Zero-knowledge encryption, you control decryption
- **Works Everywhere** - Web, MCP, browser extension, CLI, mobile
- **Project Organization** - Keys organized by project and environment (dev/staging/prod)
- **Team Ready** - Share securely with role-based permissions from day one

---

## Product Strategy

### 1. Education-First Approach
**Goal:** Nobody should feel lost or confused about API keys and secrets.

**Approach:**
- **AI Explains Everything:** What is this key? What does it do? What will it cost?
- **Guided Acquisition:** "5-year-old simple" instructions to get any API key
- **Context-Aware Help:** AI understands what you're building and suggests relevant keys
- **Best Practices Built-In:** Teach secure habits as users learn
- **Real-Time Intelligence:** Use FireCrawl + AI to research any API service on demand

**Success Metric:** 95% of first-time users successfully acquire and store their first API key without external help.

### 2. AI-Native by Design
**Goal:** Work seamlessly with AI-powered development workflows.

**Approach:**
- **MCP Integration:** Claude Code, Cursor, and other AI tools can request keys directly
- **Intelligent Requests:** When Claude needs a key that doesn't exist, user gets notified with context
- **Conversational Interface:** "I need a Stripe key" triggers AI guidance
- **Proactive Suggestions:** "You're using OpenAI—want to track your usage and costs?"
- **AI Research Agent:** Automatically fetch latest instructions, pricing, and docs for any service

**Success Metric:** 70% of keys accessed through MCP by power users; AI successfully guides 90% of acquisition requests.

### 3. Security Without Compromise
**Goal:** Enterprise-grade security that beginners can use and trust.

**Approach:**
- **Zero-Knowledge Encryption:** We can't read your secrets, even if compromised
- **Client-Side Encryption:** Keys encrypted in browser before sending to server
- **Master Password/Key:** User controls the decryption key
- **Secure by Default:** No configuration needed for strong security
- **Audit Trails:** Track every access for compliance and debugging
- **Granular Permissions:** Team members get only what they need

**Success Metric:** Pass SOC 2 audit within year 1; zero security breaches; beginners rate security as "invisible but trustworthy."

### 4. Friction-Free Integration
**Goal:** Secrets available wherever and however developers work.

**Approach:**
- **Web App:** Primary interface for management and education
- **MCP Server:** For Claude Code, Cursor, and AI development tools
- **Browser Extension:** Autofill API keys in web consoles (like LastPass for passwords)
- **CLI:** `abyrith get OPENAI_KEY` for terminal workflows
- **GitHub Integration:** Encrypted project references in repos for team setup
- **Mobile App:** Quick access and approval on the go (future)
- **IDE Plugins:** VSCode, Cursor, JetBrains integration (future)

**Success Metric:** Users can access their keys in 3+ different contexts without friction.

### 5. Intelligent Organization
**Goal:** Scale from one key to hundreds without chaos.

**Approach:**
- **Project-Based:** Organize keys by project (e.g., "RecipeApp", "ClientWebsite")
- **Environment-Aware:** dev/staging/production keys kept separate and clear
- **Automatic Tagging:** AI suggests tags based on service type (payment, AI, analytics, etc.)
- **Usage Tracking:** Monitor which keys are actively used vs. forgotten
- **Cost Visibility:** Track API usage and costs where possible
- **Expiration Reminders:** Never let important keys expire unexpectedly

**Success Metric:** Teams with 50+ keys report finding what they need in <10 seconds.

### 6. Team Collaboration
**Goal:** Secure sharing without the security theater.

**Approach:**
- **Role-Based Access:** Owner, Admin, Developer, Read-Only roles
- **Project Invitations:** Invite teammates to specific projects only
- **Approval Workflows:** Require approval for production key access (optional)
- **Activity Feed:** See who accessed what and when
- **One-Time Shares:** Share a key securely with expiration
- **SSO for Enterprise:** Google, Microsoft, Okta integration

**Success Metric:** 80% of teams onboard new members in under 5 minutes with proper access.

---

## Key Features

### 🤖 AI Secret Assistant
Your intelligent guide to understanding, acquiring, and managing API keys.

**For Complete Beginners:**
- **User:** "I need an OpenAI API key"
- **AI:** "OpenAI lets you use ChatGPT and other AI models in your code. You get $5 free credit to start.
  
  Here's how to get your key:
  1. Go to platform.openai.com/api-keys
  2. Sign up or log in
  3. Click 'Create new secret key'
  4. Copy the key (you'll only see it once!)
  5. Paste it here
  
  Cost: Free $5 credit, then pay-per-use (about $0.002 per 1000 words)"

**For Developers:**
- **Developer:** "What's this Stripe key costing me?"
- **AI:** "Your Stripe test key is free. Your production key has processed $12,450 this month. You're on the standard plan (2.9% + $0.30 per transaction). Want to see the breakdown?"

**Real-Time Research:**
- AI uses FireCrawl + web search to get latest docs, pricing, and instructions for any API
- Always up-to-date, even for new services we haven't seen before
- Explains in plain English, no matter how technical the official docs are

### 🔐 Zero-Knowledge Vault
Enterprise-grade security that just works.

**How It Works:**
1. You create a master password (never leaves your device)
2. Your keys are encrypted in your browser before upload
3. We store encrypted blobs we can't decrypt
4. Only you can unlock your secrets

**What This Means:**
- **For You:** Your secrets are safe even if we get hacked
- **For Teams:** You control who can decrypt what
- **For Compliance:** We literally can't access your keys for any reason

**Features:**
- AES-256 encryption client-side
- Optional 2FA for extra protection
- Audit logs (who accessed what, when)
- Automatic key rotation reminders
- Breach detection (monitor if keys appear in leaks)

### 📚 Guided Key Acquisition
Step-by-step instructions so simple anyone can follow.

**The Flow:**
```
User: "I need a Google Gemini API key"

Abyrith generates:

Step 1/5: Set Up Google Cloud Account
→ Go to console.cloud.google.com
→ [Screenshot showing sign-in button]
→ Click "Get started for free"
→ ✓ Check: Did you create an account?

Step 2/5: Enable Gemini API
→ Go to console.cloud.google.com/apis/library
→ Search for "Gemini API"
→ [Screenshot of search results]
→ Click "Enable"
→ ⏱️ This takes about 30 seconds

Step 3/5: Set Up Billing (Required)
→ ⚠️ You need a credit card but won't be charged yet
→ You get $300 free credit
→ Go to console.cloud.google.com/billing
→ Click "Add billing account"
...

Step 5/5: Create API Key
→ Go to console.cloud.google.com/apis/credentials
→ Click "Create Credentials" → "API Key"
→ Copy your key
→ ✅ Paste it here to save securely
```

**Powered By:**
- AI-generated instructions
- FireCrawl to scrape latest docs
- Screenshots and visual guides
- Progress tracking
- "Get Help" button for AI clarification

### 🔌 MCP Integration (Model Context Protocol)
Works seamlessly with Claude Code, Cursor, and other AI development tools.

**How It Works:**

**Scenario 1: Key Exists**
```
Claude Code: "I need OPENAI_API_KEY to test this feature"
→ Abyrith MCP: Key found in project "MyApp" (dev environment)
→ You (one-time approval): "Claude can access OpenAI keys for 24 hours"
→ Claude: Gets key, continues building
```

**Scenario 2: Key Doesn't Exist**
```
Claude Code: "I need STRIPE_API_KEY"
→ Abyrith MCP: Key not found
→ Dashboard notification: "Claude requested STRIPE_API_KEY for MyApp"
→ You: "I need a Stripe key"
→ AI: Shows guided acquisition flow
→ You: Adds key
→ Claude: Notified, continues building
```

**Features:**
- Temporary access grants (1 hour, 24 hours, always)
- Per-project permissions
- Activity log of all MCP requests
- Revoke access anytime
- Works with: Claude Code, Cursor, future AI tools

### 🗂️ Smart Organization
Keep hundreds of keys organized without thinking about it.

**Project-Based Structure:**
```
📁 RecipeApp
  └─ 🌍 Development
      ├─ OPENAI_API_KEY
      ├─ SUPABASE_URL
      └─ SUPABASE_ANON_KEY
  └─ 🚀 Production
      ├─ OPENAI_API_KEY (different key)
      ├─ STRIPE_SECRET_KEY
      └─ SENDGRID_API_KEY

📁 ClientWebsite
  └─ 🌍 Development
      ├─ GOOGLE_MAPS_API_KEY
      └─ CLOUDINARY_KEY
```

**Auto-Tagging:**
- AI suggests categories: Payment, AI, Database, Email, Analytics, etc.
- Visual icons for quick recognition
- Search by name, project, environment, or tag

**Usage Tracking:**
- Last accessed timestamp
- Access frequency
- Which team members use it
- Mark keys as "archived" when no longer needed

### 💰 Cost & Usage Intelligence
Understand what you're paying for.

**For Each Key, Track:**
- **Current Plan:** "Free tier" or "Pro $20/month"
- **Usage This Month:** "148,000 API calls (45% of limit)"
- **Estimated Cost:** "$12.50 so far this month"
- **Limits:** "100,000 requests/day, 1,000,000/month"
- **Warnings:** "⚠️ You're at 90% of your monthly limit"

**AI-Powered Insights:**
- "Your OpenAI costs doubled this month—want to see why?"
- "You're on the free tier but hitting limits. Upgrade for $20/month?"
- "This API key hasn't been used in 60 days—archive it?"

**Data Sources:**
- Scraped from service docs (FireCrawl)
- User-reported usage
- Integration with service APIs where available (future)

### 🤝 Team Collaboration
Secure sharing without the friction.

**Invite Flow:**
```
You: Invite sarah@company.com to "RecipeApp" project
→ Sarah gets email
→ Sarah signs up / logs in
→ Sarah sees only RecipeApp keys
→ Based on role (Developer), she can read keys but not delete
```

**Roles & Permissions:**
- **Owner:** Full control, can delete project
- **Admin:** Manage keys and members, can't delete project
- **Developer:** Read/write keys, can't manage members
- **Read-Only:** View key names and metadata, can't decrypt

**Approval Workflows (Enterprise):**
- Require approval to access production keys
- Approval notifications via email/Slack
- One-time access grants
- Automatic expiration

**Audit Trail:**
```
[2025-10-29 14:23] sarah@company.com accessed STRIPE_SECRET_KEY (Production)
[2025-10-29 10:15] john@company.com created SENDGRID_API_KEY (Development)
[2025-10-28 16:40] sarah@company.com updated OPENAI_API_KEY (Production)
```

### 🌐 Everywhere You Work
Access your secrets across all your tools.

**Web App (MVP):**
- Primary management interface
- AI chat for guidance
- Project and key organization
- Team management

**MCP Server (MVP):**
- Claude Code integration
- Cursor integration
- Future: Any MCP-compatible tool

**Browser Extension (Post-MVP):**
- Autofill API keys in web consoles
- Like LastPass but for developer secrets
- Works on platform.openai.com, console.cloud.google.com, etc.

**CLI Tool (Post-MVP):**
```bash
abyrith get OPENAI_API_KEY
abyrith set STRIPE_KEY sk_test_xxx --project RecipeApp --env dev
abyrith list --project RecipeApp
```

**GitHub Integration (Post-MVP):**
```bash
# In your project
abyrith init
# Creates .abyrith-ref (encrypted project reference)
# Commit this file—it's safe!

# Teammate clones repo
git clone repo
abyrith auth
# They're prompted to authenticate
# Keys automatically available in their environment
```

**Mobile App (Future):**
- Quick key lookup
- Approve MCP requests on the go
- Generate one-time shares
- Security notifications

### 📊 Security & Compliance Dashboard
Enterprise-ready from day one.

**For Security Teams:**
- Who has access to what
- Inactive keys (security risk)
- Keys close to expiration
- Recent suspicious activity
- Export audit logs for compliance

**One-Click Reports:**
- SOC 2 compliance report
- ISO 27001 audit trail
- GDPR data export
- Custom date ranges

**Automated Security:**
- Detect if keys appear in GitHub leaks
- Alert on unusual access patterns
- Remind about key rotation
- Enforce 2FA for production access

---

## Competitive Advantages

1. **AI-Powered Education** - We don't just store secrets, we teach you about them. No other secrets manager explains what keys do, how to get them, or what they cost.

2. **5-Year-Old Simple** - Instructions so clear that a complete beginner can acquire any API key. Competitors assume technical knowledge.

3. **AI-Native Development** - Built for the Claude Code / Cursor era. MCP integration means AI tools get keys directly. Competitors are built for the pre-AI world.

4. **Zero-Knowledge with Intelligence** - We can't read your secrets, but we can still provide intelligent features (tracking, suggestions, education) using metadata.

5. **Real-Time Research** - FireCrawl + AI means we can guide you through any API, even ones that launched yesterday. No manual documentation updates needed.

6. **Developer UX** - Not a password manager trying to do developer secrets. Not an enterprise tool that's overkill. Purpose-built for developers at every level.

7. **Everywhere You Work** - Web, MCP, browser extension, CLI, mobile. Competitors are locked to one or two interfaces.

---

## Success Metrics

**Education & Ease of Use:**
- Time for first-time user to acquire and store first API key (target: <10 minutes)
- % of users who successfully get keys without contacting support (target: >95%)
- User rating of instructions clarity (target: >4.5/5)
- % of users who say "I finally understand what API keys are" (qualitative)

**AI Effectiveness:**
- AI guide success rate for key acquisition (target: >90%)
- MCP request fulfillment rate (target: >95% when key exists)
- AI explanation helpfulness rating (target: >4.5/5)
- Time to resolve "key not found" MCP requests (target: <5 minutes)

**Security & Trust:**
- Security incidents (target: zero)
- Time to pass SOC 2 audit (target: <12 months)
- % of users who trust our zero-knowledge claim (survey)
- 2FA adoption rate (target: >60% of teams)

**Adoption & Growth:**
- User retention at 30/60/90 days (by segment)
- Average keys stored per user: Individual (<10), Team (50-200), Enterprise (500+)
- Weekly active usage rate (target: >40%)
- Team seat expansion rate (target: >30% add teammates in first month)

**Integration Success:**
- % of power users using MCP integration (target: >70%)
- CLI adoption rate among teams (target: >50%)
- Browser extension installation rate (future)
- GitHub integration adoption (future)

**Business Health:**
- Free-to-paid conversion rate
- Net Promoter Score (NPS) by segment
- Customer acquisition cost (CAC) vs. lifetime value (LTV)
- Referral rate ("I told my friend to use this")

---

## Strategic Roadmap Themes

**Phase 1: MVP Foundation (Current - 3 months)**
- Web app with authentication (zero-knowledge encryption)
- Project / Environment / API Key management UI
- AI Secret Assistant (guided acquisition with FireCrawl research)
- MCP server for Claude Code integration
- Basic team sharing (invite, roles, permissions)
- Core security: client-side encryption, audit logs
- "5-year-old simple" acquisition flows for top 20 APIs (OpenAI, Stripe, Google, AWS, etc.)

**Phase 2: Integration & Intelligence (3-6 months)**
- Browser extension (autofill in web consoles)
- CLI tool for terminal workflows
- GitHub integration (encrypted project references)
- Usage & cost tracking for major APIs
- AI-powered insights ("your costs doubled this month")
- Key rotation reminders
- Breach detection (monitor if keys leaked)
- Support for 100+ APIs with AI-generated instructions

**Phase 3: Enterprise & Scale (6-12 months)**
- Enterprise SSO (Google, Microsoft, Okta)
- Advanced approval workflows
- Compliance dashboard (SOC 2, ISO 27001 exports)
- API for automation and integrations
- Custom role definitions
- Slack/Teams notifications
- Mobile app for approvals on the go
- IDE plugins (VSCode, JetBrains)

**Phase 4: Platform Ecosystem (12+ months)**
- Marketplace for team-shared key templates
- Integration with CI/CD pipelines
- Secret scanning for repositories
- Automated key rotation for supported services
- Advanced analytics and reporting
- White-label options for enterprises
- Infrastructure secrets (database passwords, SSH keys)
- Bring-your-own-encryption for ultra-sensitive environments

---

## Risk Mitigation

**Dependency Risk:** Monitor third-party services closely, maintain ability to migrate if necessary.

**Quality Risk:** Balance speed with comprehensive testing and code review processes.

**User Experience Risk:** Continuously validate AI guidance accuracy and usefulness.

---

## Conclusion

Abyrith reimagines secrets management for the AI-powered development era. We solve three fundamental problems simultaneously:

1. **Education:** Making API keys understandable for complete beginners
2. **Security:** Zero-knowledge encryption that just works
3. **Integration:** Seamless workflows with modern AI development tools

**The Opportunity:**

- **Market Size:** Every developer needs secrets management, but current solutions fail different segments:
  - 1Password/LastPass: Great for passwords, awkward for API keys
  - Enterprise tools: Too complex and expensive for individuals/small teams
  - .env files: Convenient but catastrophically insecure

- **Timing:** We're at the inflection point:
  - AI-powered development (Claude Code, Cursor) is mainstream
  - Developer tools need MCP integration
  - Security breaches from leaked keys are increasing
  - Teams demand both simplicity and security

**Our Unique Position:**

We're not a password manager adding developer features. We're not an enterprise tool trying to go downmarket. We're built specifically for the intersection of:
- AI-native development workflows
- Beginners learning to code
- Teams that need enterprise security without enterprise complexity

**The Vision:**

In 3 years, when a new developer encounters "Add your API key" in a tutorial, they instinctively open Abyrith. When Claude Code needs credentials, Abyrith is how it gets them. When enterprises audit their secrets, Abyrith is their source of truth.

**Starting Point: MVP**

We begin with the core that delivers immediate value:
- Web app for managing secrets
- AI assistant that teaches and guides
- MCP integration for Claude Code
- Zero-knowledge security from day one

Then we expand to every surface where developers work (browser, CLI, IDE, mobile), always maintaining our core principles: educate, secure, and integrate seamlessly.

Let's build the secrets manager that finally makes API key management simple, secure, and actually enjoyable. 🔐
