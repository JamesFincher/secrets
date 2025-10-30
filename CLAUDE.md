# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository Overview

This is a **documentation repository** for **Abyrith**, an AI-native secrets management platform. This repo contains product vision, technical architecture, and team playbook documents that guide the development of the Abyrith platform.

**Purpose:** Centralized documentation for product strategy, technical architecture, and team practices for the Abyrith project.

**Current Status:** Planning & Documentation Phase (Pre-MVP)

---

## Project Mission

Make API key management and secrets handling accessible to everyone—from complete beginners ("5-year-old simple") to enterprise security teams—through AI-first design, zero-knowledge encryption, and seamless developer workflow integration.

---

## Tech Stack (Complete Specification)

**See `TECH-STACK.md` for full details. Quick reference:**

### Frontend
- **Next.js 14.2.x** (App Router) + **React 18.3.x** + **TypeScript 5.3.x**
- **Tailwind CSS 3.4.x** + **shadcn/ui** (Radix UI components)
- **Zustand** (state) + **React Query** (server state)
- **Web Crypto API** (client-side encryption)
- **React Hook Form** + **Zod** (forms & validation)

### Backend
- **Supabase** (PostgreSQL 15.x + Auth + Realtime + Storage)
- **Cloudflare Workers** (TypeScript, edge functions)
- **Cloudflare Workers KV** (edge caching)
- **Claude API** (3.5 Sonnet, Haiku, Extended Thinking)
- **FireCrawl API** (doc scraping)

### Infrastructure
- **Cloudflare Pages** (hosting + CDN)
- **GitHub Actions** (CI/CD)
- **pnpm** (package manager)

### Testing
- **Vitest** (unit tests)
- **Playwright** (E2E tests)
- **Testing Library** (React testing)

### Tools
- **ESLint** + **Prettier** (code quality)
- **Husky** + **lint-staged** (git hooks)
- **Sentry** (error tracking, optional)

---

## Core Principles

When working on this project, these principles are foundational:

### 1. Abstraction is Our Superpower
- Hide complexity, don't expose it
- Default to zero configuration
- Design for both a 12-year-old and a CTO to understand
- Progressive disclosure: show advanced options only when requested

### 2. AI-Native First
- AI is not a feature—it's the foundation
- Design for conversational interfaces before traditional UIs
- Build MCP integrations for AI tool ecosystems
- Every feature should work through natural language conversation

### 3. Security First, Always
- Zero-knowledge encryption: platform never has access to unencrypted secrets
- Client-side encryption before data leaves the user's device
- Security is built-in, not added later
- Never compromise security for convenience or speed

### 4. Simplicity & Reuse
- Use existing tools and services (Supabase, Cloudflare, shadcn/ui)
- Don't reinvent the wheel
- Keep code simple and readable
- Build only what makes us unique

---

## Claude Code Best Practices for This Project

### Leveraging Claude Code Features

#### 1. Parallel Agent Spawning (CRITICAL WORKFLOW)

**When to use multiple agents in parallel:**

✅ **DO spawn multiple agents for:**
- Creating multiple documentation files simultaneously
- Setting up different parts of the project structure
- Implementing independent features (e.g., frontend component + backend API)
- Running tests while working on features
- Exploring multiple approaches to a problem

**Example: Creating documentation for a feature**
```
User: "Create documentation for the AI Assistant feature"

Claude Code should:
1. Spawn 3-5 agents in PARALLEL (one message with multiple Task tool calls):
   - Agent 1: `08-features/ai-assistant/ai-assistant-overview.md`
   - Agent 2: `08-features/ai-assistant/conversation-management.md`
   - Agent 3: `08-features/ai-assistant/guided-acquisition.md`
   - Agent 4: `08-features/ai-assistant/prompt-engineering.md`
   - Agent 5: `06-backend/integrations/claude-api-integration.md`
2. Each agent works independently
3. Consolidate and ensure consistency after all complete
```

**Example: Setting up a new feature (code)**
```
User: "Create the secret card component with tests"

Claude Code should:
1. Spawn 3 agents in PARALLEL:
   - Agent 1: Create `07-frontend/components/SecretCard.tsx`
   - Agent 2: Create `07-frontend/components/SecretCard.test.tsx`
   - Agent 3: Create `07-frontend/components/SecretCard.stories.tsx` (Storybook, if used)
2. Each agent has the interface contract
3. Consolidate and ensure they work together
```

#### 2. Using the Explore Agent Efficiently

**When to use the Explore agent:**
- Understanding codebase structure (even in this docs repo)
- Finding related documentation before creating new docs
- Searching for similar patterns across existing docs
- Verifying naming conventions are consistent
- Finding all references to a specific term or concept

**Set thoroughness level:**
- `"quick"` - Basic searches when you know roughly where things are
- `"medium"` - Moderate exploration for most tasks
- `"very thorough"` - Comprehensive analysis when mapping entire domains

**Example:**
```typescript
// Before creating a new doc about authentication
Task({
  subagent_type: "Explore",
  description: "Find all authentication documentation",
  prompt: "Search for all documentation related to authentication, OAuth, JWT, and session management. Thoroughness: medium. I need to understand what's already documented before adding new auth docs."
})
```

#### 3. Plan Agent for Complex Tasks

**When to use Plan agent:**
- Breaking down large features into implementation steps
- Planning multi-phase documentation creation
- Structuring complex database schemas
- Designing API endpoints with dependencies

**Example:**
```typescript
Task({
  subagent_type: "Plan",
  description: "Plan zero-knowledge encryption implementation",
  prompt: "Create a detailed implementation plan for the zero-knowledge encryption system. Include: client-side encryption, key derivation, secure storage, and integration with Supabase. Thoroughness: very thorough. Break down into specific tasks with dependencies."
})
```

#### 4. Task Management with TodoWrite

**ALWAYS use TodoWrite for:**
- Multi-step documentation creation
- Feature implementation with multiple files
- Debugging complex issues
- Any task with 3+ distinct steps

**Best practices:**
- Create todos BEFORE starting work
- Mark todos as in_progress immediately when starting
- Complete todos immediately when done (don't batch)
- Only ONE todo in_progress at a time
- Use descriptive content (imperative) and activeForm (present continuous)

#### 5. Custom Agents (SPEED MULTIPLIER - USE AGGRESSIVELY!)

**This repository has 6 specialized custom agents. USE THEM to move fast!**

**Priority: Use these agents FIRST before doing work manually.**

##### 🚀 Available Custom Agents

**1. `/doc-creator` - Documentation Creator Agent** ⭐⭐⭐
- **Use for:** Creating ANY new documentation file
- **Automatically:** Uses templates, adds version headers, updates CHANGELOG.md, checks dependencies
- **Example:** `/doc-creator Create 03-security/security-model.md using Architecture Document Template`

**2. `/alignment-checker` - Alignment Checker Agent** ⭐⭐⭐
- **Use for:** Verifying documentation consistency across all files
- **Automatically:** Checks cross-references, terminology, version headers, alignment with TECH-STACK.md
- **Example:** `/alignment-checker Check Phase 1 documents for consistency`

**3. `/phase-validator` - Phase Validator Agent** ⭐⭐
- **Use for:** Verifying phase completion before moving to next phase
- **Automatically:** Checks all requirements from DOCUMENTATION-ROADMAP.md, verifies approvals
- **Example:** `/phase-validator Verify Phase 1 completion`

**4. `/security-reviewer` - Security Review Agent** ⭐⭐
- **Use for:** Reviewing security-related documentation (03-security/, 05-api/, 06-backend/)
- **Automatically:** Checks zero-knowledge architecture, encryption specs, RLS policies, threat models
- **Example:** `/security-reviewer Review 03-security/security-model.md`

**5. `/xref-updater` - Cross-Reference Updater Agent** ⭐
- **Use for:** Updating broken cross-references when files are moved/renamed
- **Automatically:** Finds and fixes all references to old paths
- **Example:** `/xref-updater Update references from "old.md" to "new/path.md"`

**6. `/repo-manager` - GitHub Repository Manager Agent** ⭐⭐⭐
- **Use for:** GitHub operations, compliance checking, PR management, phase tracking
- **Automatically:** Uses gh CLI, enforces standards, generates reports
- **Examples:**
  - `/repo-manager setup repository` - Configure GitHub repo
  - `/repo-manager check compliance` - Audit repository
  - `/repo-manager phase status` - Check phase progress
  - `/repo-manager create pr` - Submit work for review

##### ⚡ SPEED OPTIMIZATION: Use Multiple Agents Simultaneously!

**Scenario 1: Creating multiple Phase 1 docs**
```bash
# DON'T do this sequentially - too slow!
/doc-creator Create security-model.md
# wait...
/doc-creator Create encryption-specification.md
# wait...
/doc-creator Create authentication-flow.md

# DO THIS instead - spawn 3 doc-creator agents in parallel:
# Open 3 separate Claude Code conversations or use built-in parallel spawning
# All 3 docs created simultaneously = 3x faster!
```

**Scenario 2: Creating docs + checking quality**
```bash
# BETTER: Spawn doc-creator for multiple docs, then immediately spawn alignment-checker
# While doc-creator agents work, alignment-checker can start checking existing docs
# Total time = max(doc-creation, alignment-check) instead of sum
```

**Scenario 3: Complete workflow for new phase**
```bash
# Step 1: Create all phase docs (use multiple doc-creator agents in parallel)
# Step 2: Run security review (if Phase 1) in parallel with alignment check
/security-reviewer Review all 03-security/ docs
/alignment-checker Check Phase 1 alignment
# Step 3: Validate phase completion
/phase-validator Verify Phase 1 complete
# Step 4: Submit to GitHub
/repo-manager create pr
```

##### 🎯 When to Use Which Agent

**Creating new documentation?**
→ `/doc-creator` (ALWAYS use this, never create docs manually)

**Finished creating 3+ documents?**
→ `/alignment-checker` (run after each batch of docs)

**Moved or renamed files?**
→ `/xref-updater` (immediately after moving files)

**Working on security docs?**
→ `/security-reviewer` (use for ANY doc in 03-security/, 05-api/, 06-backend/)

**Completing a phase?**
→ `/phase-validator` (must pass before proceeding)

**Need to commit/push/PR?**
→ `/repo-manager` (handles all GitHub operations)

##### 🚀 Agent Combinations for Maximum Speed

**Combo 1: Rapid Doc Creation**
```
1. Spawn 3-5 /doc-creator agents for different docs (parallel)
2. While they work, spawn /alignment-checker for existing docs (parallel)
3. Results ready in ~same time as creating 1 doc!
```

**Combo 2: Phase Completion Sprint**
```
1. Spawn /doc-creator for remaining phase docs (parallel, up to 5)
2. Spawn /alignment-checker (runs while docs are created)
3. Spawn /security-reviewer if security docs (runs in parallel)
4. When all complete: /phase-validator
5. When validated: /repo-manager create pr
```

**Combo 3: Quality Assurance Sweep**
```
1. /alignment-checker (check consistency)
2. /security-reviewer (check security docs) - can run in parallel
3. /phase-validator (validate phase) - runs after above
4. /repo-manager check compliance - verify GitHub standards
```

##### ⚠️ Agent Best Practices

**DO:**
- ✅ Use agents for EVERY documentation task (faster + consistent)
- ✅ Spawn multiple agents when tasks are independent
- ✅ Let agents handle CHANGELOG.md updates (don't do manually)
- ✅ Trust agent output (they follow standards automatically)
- ✅ Use /repo-manager for ALL GitHub operations

**DON'T:**
- ❌ Create docs manually (use /doc-creator)
- ❌ Update CHANGELOG.md manually (agents do this)
- ❌ Check alignment manually (use /alignment-checker)
- ❌ Manually verify phase completion (use /phase-validator)
- ❌ Use git directly for PR/merge (use /repo-manager)

##### 🎓 Agent Learning Curve

**Level 1 (Beginner):**
- Use `/doc-creator` for every new doc
- Use `/alignment-checker` after creating docs
- Use `/repo-manager phase status` to track progress

**Level 2 (Intermediate):**
- Spawn 2-3 `/doc-creator` agents in parallel
- Use `/security-reviewer` for security docs
- Use `/phase-validator` before phase transitions

**Level 3 (Advanced):**
- Spawn 5+ agents simultaneously for maximum speed
- Combine agents strategically (creation + review in parallel)
- Use `/repo-manager` for automated compliance and reporting

**Level 4 (Expert):**
- Design entire phase workflows with agent orchestration
- Predict and prevent issues using agents proactively
- Automate phase transitions with agent combinations

---

## Project-Specific Workflows

### Workflow 1: Creating New Documentation

**Step-by-step:**

1. **Check DOCUMENTATION-ROADMAP.md** for the doc's phase and dependencies
2. **Verify dependencies exist** (docs it depends on)
3. **Choose appropriate template** from `00-admin/document-templates.md` (6 types available)
4. **Spawn Explore agent** to find related existing docs
5. **Read related docs** to extract relevant content
6. **Create new doc** using template with proper version header
7. **Follow versioning rules** from `00-admin/versioning-strategy.md`
8. **Spawn parallel agents if creating multiple related docs**
9. **Update CHANGELOG.md** with the new doc
10. **Submit for review** following `00-admin/review-process.md` workflow
11. **Cross-reference** from other relevant docs

**Template for version header:**
```markdown
---
Document: [Document Name]
Version: 1.0.0
Last Updated: YYYY-MM-DD
Owner: [Team/Person]
Status: Draft | Review | Approved
Dependencies: [list of docs this depends on]
---
```

**Available Templates in `00-admin/document-templates.md`:**
- Feature Documentation Template (for `08-features/`)
- API Endpoint Documentation Template (for `05-api/endpoints/`)
- Database Schema Documentation Template (for `04-database/schemas/`)
- Integration Guide Template (for `09-integrations/`)
- Operations Runbook Template (for `10-operations/`)
- Architecture Document Template (for `02-architecture/`)

### Workflow 2: Ensuring Documentation Alignment

**CRITICAL: All docs must be consistent!**

**When updating any doc, check alignment:**

1. **Security docs** - Must align with `TECH-STACK.md` and `03-security/security-model.md`
2. **API docs** - Must align with `04-database/` schemas and `TECH-STACK.md`
3. **Feature docs** - Must align with `01-product/product-vision-strategy.md` and `02-architecture/system-overview.md`
4. **Integration docs** - Must reference correct API endpoints and feature docs

**Process:**
```
1. Spawn Explore agent to find all related docs
2. Read each related doc
3. Note any inconsistencies
4. Update all affected docs (use parallel agents for multiple files)
5. Verify changes don't create new inconsistencies
```

### Workflow 3: Tech Stack Documentation

**When documenting a technology:**

1. **Check `TECH-STACK.md`** for the exact version and purpose
2. **Create tool-specific doc** in appropriate folder:
   - Frontend tools → `07-frontend/`
   - Backend tools → `06-backend/`
   - Database → `04-database/`
   - Testing → `11-development/testing/`
3. **Include:**
   - Why we chose this tool (from `TECH-STACK.md`)
   - What it's responsible for
   - How to set it up locally
   - Common patterns and examples
   - Integration with other tools
   - Troubleshooting

### Workflow 4: Creating Implementation Specs

**For features that will be coded:**

1. **Reference product vision** (`01-product/product-vision-strategy.md`)
2. **Check architectural constraints** (`02-architecture/system-overview.md`)
3. **Verify security requirements** (`03-security/`)
4. **Define database schema** (`04-database/schemas/`)
5. **Specify API endpoints** (`05-api/endpoints/`)
6. **Document frontend components** (`07-frontend/components/`)
7. **Plan integration points** (`09-integrations/`)

**Use parallel agents for each layer!**

---

## Service Responsibility Matrix

**Quick reference for "which service does what":**

| Need | Service | Documentation |
|------|---------|---------------|
| Store data | Supabase PostgreSQL | `06-backend/supabase/` |
| Authenticate users | Supabase Auth | `03-security/auth/` |
| Real-time updates | Supabase Realtime | `06-backend/supabase/` |
| Host frontend | Cloudflare Pages | `07-frontend/deployment/` |
| Custom API logic | Cloudflare Workers | `06-backend/cloudflare-workers/` |
| Cache at edge | Cloudflare Workers KV | `06-backend/cloudflare-workers/kv-storage.md` |
| AI conversations | Claude API | `06-backend/integrations/claude-api-integration.md` |
| Scrape API docs | FireCrawl | `06-backend/integrations/firecrawl-integration.md` |
| MCP for Claude Code | Custom MCP Server | `09-integrations/mcp/` |
| Run tests | Vitest + Playwright | `11-development/testing/` |
| CI/CD | GitHub Actions | `11-development/ci-cd/` |
| Error tracking | Sentry | `10-operations/monitoring/` |

---

## Folder Structure & Organization

**See `FOLDER-STRUCTURE.md` for complete details.**

**Quick reference:**
```
00-admin/           - Documentation admin (templates, versioning, review process)
01-product/         - Product vision, strategy, playbook
02-architecture/    - High-level system architecture
03-security/        - Security model, auth, RBAC, compliance
04-database/        - Database schemas, migrations
05-api/             - API specifications, endpoints
06-backend/         - Backend services (Supabase, Workers, integrations)
07-frontend/        - Frontend architecture, components
08-features/        - Feature-specific documentation
09-integrations/    - External integrations (MCP, Claude Code, Cursor)
10-operations/      - Deployment, monitoring, incidents
11-development/     - Developer setup, testing, code quality
12-user-docs/       - End-user guides
```

**File naming:**
- Kebab-case: `feature-name.md`
- Descriptive: `secret-card-component.md` not `component1.md`
- Prefixed by category when useful: `arch-`, `db-`, `feature-`, `api-`, `ops-`

---

## Common Tasks & How to Approach Them

### Task: "Create documentation for [Feature]"

**Approach:**
1. Check `DOCUMENTATION-ROADMAP.md` to find the feature's phase
2. Verify all dependency docs exist
3. Spawn Explore agent to find related content
4. Extract content from existing docs (product vision, architecture)
5. **Spawn multiple agents in parallel** to create:
   - Feature overview
   - Technical implementation
   - API endpoints
   - Frontend components
   - Integration points
6. Ensure all docs reference each other correctly
7. Update CHANGELOG.md

### Task: "Set up [Technology]"

**Approach:**
1. Check `TECH-STACK.md` for exact version and purpose
2. Create tool-specific documentation
3. Include:
   - Installation/setup
   - Configuration
   - Integration with other tools
   - Examples
   - Troubleshooting
4. Update `11-development/local-setup.md` with setup steps

### Task: "Design database schema for [Feature]"

**Approach:**
1. Review `03-security/rbac/rls-policies.md` for security requirements
2. Check `04-database/database-overview.md` for multi-tenancy strategy
3. Create schema doc in `04-database/schemas/`
4. Include:
   - Table definitions (SQL)
   - RLS policies
   - Indexes
   - Relationships
   - Migration plan
5. Create corresponding API endpoint doc in `05-api/endpoints/`
6. Ensure alignment between schema and API

### Task: "Plan implementation of [Feature]"

**Approach:**
1. **Use Plan agent** with thorough analysis
2. Break down into phases matching documentation structure:
   - Database schema
   - API endpoints
   - Backend services
   - Frontend components
   - Integration points
   - Tests
3. **Spawn multiple agents to create docs in parallel**
4. Ensure each phase references dependencies correctly

---

## Key Files to Reference

**Always check these before starting work:**

- **`TECH-STACK.md`** - Exact technologies and versions
- **`DOCUMENTATION-ROADMAP.md`** - What to create and in what order
- **`FOLDER-STRUCTURE.md`** - Where files go
- **`GLOSSARY.md`** - Standard terminology
- **`01-product/product-vision-strategy.md`** - Product requirements
- **`02-architecture/system-overview.md`** - System architecture
- **`01-product/team-playbook.md`** - Core principles and anti-patterns

**Administrative Standards (00-admin/):**
- **`00-admin/versioning-strategy.md`** - How to version documents (semantic versioning)
- **`00-admin/document-templates.md`** - 6 templates for common document types
- **`00-admin/review-process.md`** - Documentation review workflow and approval gates
- **`00-admin/tool-documentation-template.md`** - Template for documenting technologies

---

## Decision-Making Framework

When documenting new features or architectural changes, evaluate against:

1. **Security:** Does this compromise security? (🚫 Blocker if yes)
2. **Simplicity:** Is this the simplest approach that works? (⭐⭐⭐)
3. **AI-Native:** Can AI orchestrate this conversationally? (⭐⭐⭐)
4. **Reuse:** Are we reinventing something that exists? (⭐⭐)
5. **User-Centric:** Will target users understand this? (⭐⭐⭐)

**If security is compromised → Stop, find another way.**

---

## Naming Conventions

### Projects & Environments
- Projects: `"RecipeApp"`, `"ClientWebsite"` (PascalCase)
- Environments: `development`, `staging`, `production` (lowercase)

### Roles
- `Owner`, `Admin`, `Developer`, `Read-Only` (PascalCase)

### Technical Terms
- Use definitions from `GLOSSARY.md`
- When introducing new terms, add to GLOSSARY.md

### Code Conventions
- React components: `PascalCase` (e.g., `SecretCard.tsx`)
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: Tailwind utilities
- Files: `kebab-case.ts` or `PascalCase.tsx` (for components)

---

## Target Personas (Context for Design)

1. **The Learner** - First-time coder, needs "5-year-old simple" guidance
2. **The Solo Developer** - Indie hacker, keys scattered across .env files
3. **The Development Team** - 3-50 developers, need secure sharing and audit trails
4. **The Enterprise** - Security teams, compliance requirements (SOC 2, ISO 27001)

**Every feature must work for ALL personas** (different complexity levels).

---

## Key Differentiators (What Makes Abyrith Unique)

- **AI-powered education** for API key acquisition
- **MCP integration** for seamless AI development workflows
- **Zero-knowledge security** that "just works"
- **Real-time research** using FireCrawl + AI
- **Beginner to enterprise** on the same simple interface

---

## Technical Constraints (Non-Negotiable)

### Security Requirements
- All secrets encrypted client-side with AES-256-GCM
- Master key derived from password using PBKDF2 (never transmitted)
- Row-Level Security (RLS) on all database tables
- Comprehensive audit logging
- Zero-knowledge architecture (server can't decrypt secrets)

### Performance Targets
- Page load: <2s on 3G
- Time to interactive: <3s
- API response: <200ms p95 (edge functions)
- Database query: <100ms p95

### Browser Support
- Chrome/Edge 100+
- Firefox 100+
- Safari 15+
- Mobile Safari 15+

---

## Documentation Standards

### Version Headers (Required on Every Doc)
```markdown
---
Document: [Name]
Version: X.Y.Z
Last Updated: YYYY-MM-DD
Owner: [Team/Person]
Status: Draft | Review | Approved | Deprecated
Dependencies: [comma-separated list of files]
---
```

### Structure Template
```markdown
# Document Title

## Overview
[2-3 sentence summary]

## [Main Content Sections]

## Dependencies
[What must exist before this can be implemented]

## References
[Links to related docs]

## Change Log
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | Name | Initial version |
```

### Documentation Principles
1. **Single source of truth** - each concept documented once
2. **Beginner-friendly first** - plain English, then technical details
3. **Diagrams required** for complex systems (Mermaid preferred)
4. **Examples over explanations** - show concrete examples
5. **Explicit dependencies** - always list what must exist first

---

## Workflow Examples

### Example 1: User asks to document "AI Assistant" feature

**Claude Code should:**
1. Check `DOCUMENTATION-ROADMAP.md` → Find it's in Phase 4
2. Check dependencies: `api-endpoints-secrets.md`, `arch-security-model.md`
3. Spawn Explore agent to find related content
4. **Spawn 5 agents in PARALLEL (one message):**
   - Agent 1: Create `08-features/ai-assistant/ai-assistant-overview.md`
   - Agent 2: Create `08-features/ai-assistant/conversation-management.md`
   - Agent 3: Create `08-features/ai-assistant/guided-acquisition.md`
   - Agent 4: Create `08-features/ai-assistant/prompt-engineering.md`
   - Agent 5: Create `08-features/ai-assistant/model-selection.md`
5. After agents complete, ensure consistency and cross-references
6. Update `CHANGELOG.md`

### Example 2: User asks to "set up the database schema for secrets"

**Claude Code should:**
1. Read `03-security/security-model.md` for encryption requirements
2. Read `04-database/database-overview.md` for multi-tenancy approach
3. Create `04-database/schemas/secrets-metadata.md` with:
   - Table definitions (SQL)
   - RLS policies
   - Indexes
   - Encryption column specifications
4. Create corresponding `05-api/endpoints/secrets-endpoints.md`
5. Ensure both docs reference each other
6. Update `CHANGELOG.md`

### Example 3: User asks "check all documentation is aligned"

**Claude Code should:**
1. **Spawn Explore agent** to map all documentation
2. **Spawn multiple agents in parallel to check different areas:**
   - Agent 1: Check security docs align with TECH-STACK.md
   - Agent 2: Check API docs align with database schemas
   - Agent 3: Check feature docs align with product vision
   - Agent 4: Check integration docs reference correct endpoints
   - Agent 5: Check all version headers are present
3. Consolidate findings
4. Report inconsistencies
5. Offer to fix them (spawn agents to update multiple files in parallel)

---

## Anti-Patterns to Avoid

### 🚫 Don't: Create docs without checking dependencies
✅ Do: Always check `DOCUMENTATION-ROADMAP.md` for dependencies first

### 🚫 Don't: Duplicate information across multiple files
✅ Do: Reference the source of truth, don't copy

### 🚫 Don't: Use jargon without defining it
✅ Do: Define terms in `GLOSSARY.md` and reference them

### 🚫 Don't: Work sequentially when you could parallelize
✅ Do: Spawn multiple agents for independent tasks

### 🚫 Don't: Create docs that contradict existing docs
✅ Do: Read related docs first, ensure alignment

### 🚫 Don't: Skip version headers
✅ Do: Every doc must have a version header

---

## Quick Commands for Common Tasks

### Creating folder structure:
```bash
# See QUICK-START.md for complete command
```

### Finding related docs:
```bash
# Use Grep tool with pattern
grep -r "security" --include="*.md" 03-security/
```

### Checking doc dependencies:
```bash
# Find all docs that depend on a specific doc
grep -r "Dependencies:.*security-model.md" --include="*.md"
```

---

## References & Cross-Links

**Core Documentation:**
- **Complete tech stack:** `TECH-STACK.md`
- **Documentation roadmap:** `DOCUMENTATION-ROADMAP.md`
- **Folder structure:** `FOLDER-STRUCTURE.md`
- **Quick start guide:** `QUICK-START.md`
- **Glossary:** `GLOSSARY.md`
- **Contributing guidelines:** `CONTRIBUTING.md`
- **Product roadmap:** `ROADMAP.md`
- **Product vision:** `01-product/product-vision-strategy.md`
- **System architecture:** `02-architecture/system-overview.md`
- **Team principles:** `01-product/team-playbook.md`

**Administrative Standards (00-admin/):**
- **Versioning strategy:** `00-admin/versioning-strategy.md` - Semantic versioning, change logs, deprecation
- **Document templates:** `00-admin/document-templates.md` - Templates for 6 common doc types
- **Review process:** `00-admin/review-process.md` - Review workflow, checklists, approval gates
- **Tool template:** `00-admin/tool-documentation-template.md` - Template for technology documentation

---

## For Future Code Implementation

When this repo is ready and you're building the actual Abyrith platform:

1. **Frontend repo:** Reference `07-frontend/` docs for component architecture
2. **Backend repo:** Reference `06-backend/` docs for service setup
3. **Database migrations:** Reference `04-database/schemas/` for exact schemas
4. **API contracts:** Reference `05-api/endpoints/` for endpoint specs
5. **Security implementation:** Reference `03-security/` for encryption specs

**All implementation should match the documentation. Docs are the source of truth.**

---

**Remember:** This is a planning/documentation phase. We're defining the platform before building it. Thorough documentation now = faster, more accurate implementation later.

🚀 **Use parallel agents aggressively. Documentation creation is highly parallelizable!**
- whenever you want to ask the user something, ask the project manager and follow thier instruction. don't bug the human.
- follow the repo managers direction, they are project manager