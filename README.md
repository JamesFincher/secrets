---
Document: README
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Engineering Lead
Status: Approved
Dependencies: None
---

# Abyrith - AI-Native Secrets Management Platform

**Status:** 📋 Planning & Documentation Phase (Pre-MVP)

---

## What is Abyrith?

Abyrith is an AI-native secrets management platform that makes API key management accessible to everyone—from complete beginners to enterprise security teams—through AI-first design, zero-knowledge encryption, and seamless developer workflow integration.

**Mission:** Make API key management "5-year-old simple" while maintaining enterprise-grade security.

---

## This Repository

This is the **documentation repository** for the Abyrith platform. It contains:

- 📊 Product vision and strategy
- 🏗️ Technical architecture specifications
- 🔒 Security model and compliance docs
- 💾 Database schemas and API specifications
- ⚙️ Implementation guides for all features
- 🚀 Deployment and operations procedures
- 👥 Team playbook and development practices

**Purpose:** Define the platform completely before building it. Documentation is the source of truth for implementation.

---

## Quick Start

### For New Contributors

1. **Read these first (in order):**
   - [CLAUDE.md](./CLAUDE.md) - How to work with this repo (especially if using Claude Code)
   - [01-product/product-vision-strategy.md](./01-product/product-vision-strategy.md) - What we're building and why
   - [TECH-STACK.md](./TECH-STACK.md) - Exact technologies we're using
   - [01-product/team-playbook.md](./01-product/team-playbook.md) - Core principles and practices

2. **Set up folder structure:**
   - Follow [QUICK-START.md](./QUICK-START.md) to create folders and reorganize existing docs

3. **Start documenting:**
   - Follow [DOCUMENTATION-ROADMAP.md](./DOCUMENTATION-ROADMAP.md) phase by phase
   - Check [FOLDER-STRUCTURE.md](./FOLDER-STRUCTURE.md) for where files go
   - Use [DOC-ALIGNMENT-CHECKLIST.md](./DOC-ALIGNMENT-CHECKLIST.md) to ensure consistency

### For Developers (Future Implementation Phase)

1. **Reference complete specs:**
   - Database: `04-database/schemas/`
   - API: `05-api/endpoints/`
   - Frontend: `07-frontend/`
   - Backend: `06-backend/`

2. **Set up local environment:**
   - Follow `11-development/local-setup.md` (to be created in Phase 9)

3. **Implement features:**
   - Build exactly as documented
   - Documentation is the contract

---

## Documentation Structure

```
/
├── CLAUDE.md                    # Claude Code guidance (READ THIS FIRST if using Claude)
├── TECH-STACK.md                # Exact tech stack with versions
├── DOCUMENTATION-ROADMAP.md     # What to create, in what order
├── FOLDER-STRUCTURE.md          # Where files go
├── QUICK-START.md               # Get started in 15 minutes
├── DOC-ALIGNMENT-CHECKLIST.md   # Ensure all docs are consistent
├── GLOSSARY.md                  # Standard terminology (create in Phase 0)
├── CONTRIBUTING.md              # How to contribute (create in Phase 0)
├── CHANGELOG.md                 # Platform-wide changes (create in Phase 0)
├── ROADMAP.md                   # Feature roadmap (create in Phase 0)
│
├── 00-admin/                    # Documentation admin
│   ├── versioning-strategy.md
│   ├── document-templates.md
│   ├── review-process.md
│   └── tool-documentation-template.md
│
├── 01-product/                  # Product strategy
│   ├── product-vision-strategy.md
│   └── team-playbook.md
│
├── 02-architecture/             # System architecture
│   └── system-overview.md
│
├── 03-security/                 # Security & auth
│   ├── auth/                    # Authentication flows
│   ├── rbac/                    # Permissions
│   └── compliance/              # SOC 2, GDPR, etc.
│
├── 04-database/                 # Database schemas
│   ├── schemas/                 # Table definitions
│   └── migrations/              # SQL migrations
│
├── 05-api/                      # API specifications
│   └── endpoints/               # REST endpoints
│
├── 06-backend/                  # Backend services
│   ├── supabase/                # Supabase setup
│   ├── cloudflare-workers/     # Cloudflare Workers
│   └── integrations/            # External services
│
├── 07-frontend/                 # Frontend architecture
│   ├── components/              # React components
│   └── client-encryption/       # Client-side crypto
│
├── 08-features/                 # Feature specs
│   ├── ai-assistant/
│   ├── zero-knowledge-vault/
│   ├── project-management/
│   └── team-collaboration/
│
├── 09-integrations/             # External integrations
│   ├── mcp/                     # Model Context Protocol
│   ├── claude-code/             # Claude Code integration
│   └── cursor/                  # Cursor integration
│
├── 10-operations/               # Deployment & ops
│   ├── deployment/
│   ├── monitoring/
│   └── incidents/
│
├── 11-development/              # Developer experience
│   ├── testing/
│   └── ci-cd/
│
└── 12-user-docs/                # End-user guides
    ├── getting-started/
    ├── features/
    └── integrations/
```

---

## Tech Stack Summary

**See [TECH-STACK.md](./TECH-STACK.md) for complete details.**

### Frontend
- Next.js 14.2.x + React 18.3.x + TypeScript 5.3.x
- Tailwind CSS 3.4.x + shadcn/ui
- Zustand + React Query
- Web Crypto API (client-side encryption)

### Backend
- Supabase (PostgreSQL 15.x + Auth + Realtime)
- Cloudflare Workers (edge functions)
- Claude API (AI conversations)
- FireCrawl (doc scraping)

### Infrastructure
- Cloudflare Pages (hosting + CDN)
- GitHub Actions (CI/CD)
- Vitest + Playwright (testing)

---

## Core Principles

**From [01-product/team-playbook.md](./01-product/team-playbook.md):**

1. **Abstraction is Our Superpower** - Hide complexity, design for both a 12-year-old and a CTO
2. **AI-Native First** - AI is the foundation, not a feature
3. **Security First, Always** - Zero-knowledge encryption, never compromise
4. **Simplicity & Reuse** - Use existing tools, build only what makes us unique

---

## Key Features

**MVP (Phase 1):**
- ✨ AI Secret Assistant (guided API key acquisition)
- 🔐 Zero-knowledge vault (client-side encryption)
- 🤖 MCP integration (Claude Code, Cursor)
- 👥 Team collaboration (secure sharing)
- 📊 Audit logs (compliance ready)

**Post-MVP:**
- 🌐 Browser extension (autofill)
- ⌨️ CLI tool
- 💰 Usage tracking
- 🏢 Enterprise SSO

See [ROADMAP.md](./ROADMAP.md) (to be created) for complete timeline.

---

## Documentation Workflow

### Creating Documentation

**Follow this order (critical):**

1. **Phase 0:** Admin docs (GLOSSARY, CONTRIBUTING, etc.)
2. **Phase 1:** Security & auth (foundation)
3. **Phase 2:** Database schemas (data layer)
4. **Phase 3:** API design (interface layer)
5. **Phase 4:** Features (user-facing)
6. **Phase 5:** Integrations (external systems)
7. **Phase 6:** Frontend (UI layer)
8. **Phase 7-10:** Operations, dev experience, user docs

**Why this order?** Each phase builds on the previous. You can't design APIs without database schemas. You can't document features without APIs. Following the order prevents rework.

### Using Claude Code Effectively

**See [CLAUDE.md](./CLAUDE.md) for complete guidance.**

**Key workflows:**
- ✅ **Spawn multiple agents in parallel** for independent tasks
- ✅ **Use Explore agent** to find related docs before creating new ones
- ✅ **Use Plan agent** for complex feature planning
- ✅ **Check alignment** after every documentation update
- ✅ **Update CHANGELOG.md** for all changes

### Ensuring Documentation Quality

**Before marking a phase complete:**

1. Run alignment checks from [DOC-ALIGNMENT-CHECKLIST.md](./DOC-ALIGNMENT-CHECKLIST.md)
2. Verify all docs have version headers
3. Check for broken references
4. Ensure terminology matches [GLOSSARY.md](./GLOSSARY.md)
5. Update [CHANGELOG.md](./CHANGELOG.md)

---

## Current Status

**Completed:**
- ✅ Product vision and strategy
- ✅ Technical architecture overview
- ✅ Team playbook
- ✅ Tech stack specification
- ✅ Documentation infrastructure (roadmap, folder structure, templates)

**Next Steps:**
1. Create Phase 0 docs (GLOSSARY, CONTRIBUTING, CHANGELOG, ROADMAP)
2. Set up folder structure (run commands from QUICK-START.md)
3. Move existing docs to organized folders
4. Begin Phase 1: Security & auth documentation

---

## For Future Implementers

**When documentation is complete:**

1. **Database:** Implement schemas from `04-database/schemas/` exactly as documented
2. **Backend:** Set up services following `06-backend/` guides
3. **Frontend:** Build components per `07-frontend/` architecture
4. **Features:** Implement following `08-features/` specifications
5. **Integrations:** Integrate external services per `09-integrations/` docs

**Documentation is the contract.** Implementation should match docs exactly.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) (to be created in Phase 0)

**Quick guidelines:**
- Follow the documentation roadmap phases
- Use version headers on all docs
- Check alignment before and after changes
- Update CHANGELOG.md
- Reference TECH-STACK.md for technology decisions

---

## Resources

**Key Documents:**
- [CLAUDE.md](./CLAUDE.md) - Claude Code workflows
- [TECH-STACK.md](./TECH-STACK.md) - Technology decisions
- [DOCUMENTATION-ROADMAP.md](./DOCUMENTATION-ROADMAP.md) - What to create
- [FOLDER-STRUCTURE.md](./FOLDER-STRUCTURE.md) - Where files go
- [DOC-ALIGNMENT-CHECKLIST.md](./DOC-ALIGNMENT-CHECKLIST.md) - Quality assurance

**Product Documents:**
- [01-product/product-vision-strategy.md](./01-product/product-vision-strategy.md)
- [01-product/team-playbook.md](./01-product/team-playbook.md)
- [02-architecture/system-overview.md](./02-architecture/system-overview.md)

---

## Contact & Support

**For questions about:**
- Product vision: See product docs or create GitHub issue
- Technical architecture: See architecture docs or create GitHub issue
- Development process: See team playbook
- Documentation: See CLAUDE.md or CONTRIBUTING.md

---

## License

[To be determined]

---

**Built with ❤️ for developers who want security without complexity.**

**🚀 Making API key management "5-year-old simple" since 2025**
