---
Document: Abyrith Tech Stack Specification
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Engineering Lead
Status: Approved
Dependencies: 02-architecture/system-overview.md
---

# Abyrith Tech Stack Specification

## Tech Stack Overview

This document defines the **exact** technologies, versions, and tools used in the Abyrith platform. This is the single source of truth for technology decisions.

**Philosophy:** Use managed services and proven tools. Build only what makes us unique.

---

## Frontend Stack

### Framework & UI

**Next.js** - `14.2.x` (App Router)
- **Why:** React framework with SSR, excellent DX, Vercel-backed
- **Responsible for:**
  - Client-side routing
  - Server components for SEO
  - API routes (if needed as middleware)
  - Image optimization
- **Documentation needed:** `07-frontend/nextjs-setup.md`

**React** - `18.3.x`
- **Why:** Industry standard, excellent ecosystem, Claude Code understands it well
- **Responsible for:**
  - Component architecture
  - State management
  - Client-side interactivity
- **Documentation needed:** `07-frontend/architecture.md`

**TypeScript** - `5.3.x`
- **Why:** Type safety, better DX, catches errors early
- **Responsible for:**
  - Type checking across entire frontend
  - Interface definitions for API contracts
  - Improved IDE support
- **Documentation needed:** `07-frontend/typescript-config.md`

### Styling & UI Components

**Tailwind CSS** - `3.4.x`
- **Why:** Utility-first, fast development, excellent with TypeScript, works great with AI code generation
- **Responsible for:**
  - All styling (no CSS-in-JS)
  - Responsive design
  - Dark mode support
- **Documentation needed:** `07-frontend/styling-guide.md`

**shadcn/ui** - Latest
- **Why:** Accessible React components built on Radix UI, copy-paste approach (no package dependency), works perfectly with Tailwind
- **Responsible for:**
  - Base component library (buttons, dialogs, forms, etc.)
  - Accessibility foundation
  - Consistent design system
- **Documentation needed:** `07-frontend/components/component-library.md`

**Radix UI** - `1.x` (via shadcn/ui)
- **Why:** Unstyled, accessible components
- **Responsible for:**
  - Accessibility primitives
  - Complex UI patterns (dropdowns, dialogs, tooltips)

**Lucide React** - Latest
- **Why:** Beautiful icon set, tree-shakeable, TypeScript support
- **Responsible for:**
  - All icons in the application
- **Documentation needed:** `07-frontend/design-system.md`

### State Management

**Zustand** - `4.5.x`
- **Why:** Simple, TypeScript-friendly, less boilerplate than Redux, works great with React Server Components
- **Responsible for:**
  - Global client state
  - User preferences
  - UI state (modals, sidebars, etc.)
- **Documentation needed:** `07-frontend/state-management.md`

**React Query (TanStack Query)** - `5.x`
- **Why:** Server state management, caching, background updates
- **Responsible for:**
  - API data fetching and caching
  - Optimistic updates
  - Background refetching
  - Request deduplication
- **Documentation needed:** `07-frontend/api-client/react-query-setup.md`

### Client-Side Encryption

**Web Crypto API** - Native browser API
- **Why:** Native, secure, no dependencies, auditable
- **Responsible for:**
  - AES-256-GCM encryption/decryption
  - PBKDF2 key derivation
  - Random number generation for nonces/IVs
- **Documentation needed:** `07-frontend/client-encryption/webcrypto-implementation.md`

### Form Handling

**React Hook Form** - `7.x`
- **Why:** Performant, TypeScript support, less re-renders
- **Responsible for:**
  - Form state management
  - Validation
  - Error handling
- **Documentation needed:** `07-frontend/forms-guide.md`

**Zod** - `3.x`
- **Why:** TypeScript-first validation, integrates with React Hook Form
- **Responsible for:**
  - Schema validation
  - Type inference
  - API contract validation
- **Documentation needed:** `07-frontend/validation-schemas.md`

### Authentication (Client)

**Supabase Auth Helpers** - `0.10.x` (for Next.js)
- **Why:** First-party integration with Next.js
- **Responsible for:**
  - Session management in Next.js
  - Cookie handling
  - Server/client auth state sync
- **Documentation needed:** `07-frontend/auth-integration.md`

---

## Backend Stack

### Database & Backend-as-a-Service

**Supabase** - Cloud (latest)
- **PostgreSQL** - `15.x` (managed by Supabase)
  - **Why:** Most advanced open-source RDBMS, excellent for JSON, full-text search, extensions
  - **Responsible for:**
    - All persistent data storage
    - Row-Level Security (RLS) for multi-tenancy
    - ACID transactions
    - Full-text search (if needed)
- **Supabase Auth** - Built-in
  - **Why:** Managed auth service, JWT-based, OAuth support
  - **Responsible for:**
    - User authentication
    - JWT token generation and validation
    - OAuth flows (Google, GitHub, etc.)
    - MFA (TOTP)
    - Magic links
- **Supabase Realtime** - Built-in
  - **Why:** WebSocket-based real-time subscriptions
  - **Responsible for:**
    - Real-time updates for audit logs
    - Activity feed updates
    - Team collaboration notifications
- **Supabase Storage** - Built-in (if needed)
  - **Why:** S3-compatible object storage
  - **Responsible for:**
    - User avatars
    - Project images
    - Export files
- **Documentation needed:**
  - `06-backend/supabase/setup-guide.md`
  - `04-database/database-overview.md`
  - `03-security/auth/authentication-flow.md`

**PostgREST** - Built into Supabase
- **Why:** Auto-generates REST API from PostgreSQL schema
- **Responsible for:**
  - CRUD operations via REST
  - Query filtering and pagination
  - Enforcing RLS policies
- **Documentation needed:** `05-api/rest-api-overview.md`

### Serverless Functions

**Cloudflare Workers** - Latest (V8 runtime)
- **Why:** Zero cold starts, global edge deployment, excellent DX
- **Language:** TypeScript (transpiled to JS)
- **Responsible for:**
  - API gateway and request routing
  - Rate limiting (per IP, per user)
  - Custom API endpoints (not covered by Supabase)
  - Secret encryption/decryption orchestration
  - Webhook handlers
  - MCP server endpoints
- **Documentation needed:**
  - `06-backend/cloudflare-workers/architecture.md`
  - `06-backend/cloudflare-workers/api-gateway.md`

**Cloudflare Workers KV** - Built-in
- **Why:** Low-latency key-value storage at the edge
- **Responsible for:**
  - Caching API responses
  - Rate limit counters
  - Feature flags
  - Session data (short-term)
- **Documentation needed:** `06-backend/cloudflare-workers/kv-storage.md`

**Cloudflare Durable Objects** - (Future, if needed)
- **Why:** Strongly consistent state coordination
- **Responsible for:**
  - Real-time collaboration features (future)
  - Distributed locks
  - Atomic counters

**Supabase Edge Functions** - (Deno runtime, if needed)
- **Why:** Deno-based serverless functions, close to database
- **Responsible for:**
  - Database triggers and webhooks
  - Complex database operations
  - Background jobs (future)
- **Documentation needed:** `06-backend/supabase/edge-functions/overview.md`

### AI & Integrations

**Claude API** - Anthropic (latest)
- **Models:**
  - **Claude 3.5 Sonnet** - Primary model for conversations
  - **Claude 3.5 Haiku** - Fast model for simple queries
  - **Claude 3.5 Sonnet Extended Thinking** - Complex orchestration and planning
- **Responsible for:**
  - AI Secret Assistant conversations
  - Guided acquisition flow generation
  - Natural language understanding
  - Code generation (for guided steps)
- **Documentation needed:**
  - `06-backend/integrations/claude-api-integration.md`
  - `08-features/ai-assistant/model-selection.md`

**FireCrawl API** - Cloud service
- **Why:** Scrapes and converts API docs to markdown
- **Responsible for:**
  - Real-time API documentation scraping
  - Converting docs to AI-readable format
  - Keeping API instructions up-to-date
- **Documentation needed:** `06-backend/integrations/firecrawl-integration.md`

**Model Context Protocol (MCP)** - Anthropic standard
- **Implementation:** Custom MCP server (Node.js or Deno)
- **Responsible for:**
  - Exposing Abyrith tools to Claude Code/Cursor
  - Handling secret request/approval flows
  - Audit logging of AI tool access
- **Documentation needed:**
  - `09-integrations/mcp/server-architecture.md`
  - `09-integrations/mcp/secrets-server-spec.md`

---

## Infrastructure & Deployment

### Hosting & CDN

**Cloudflare Pages** - Latest
- **Why:** Global CDN, integrated with Workers, excellent DX
- **Responsible for:**
  - Hosting Next.js frontend (static + SSR)
  - Global distribution
  - SSL/TLS certificates
  - DDoS protection
  - Web Application Firewall (WAF)
- **Documentation needed:** `07-frontend/deployment/cloudflare-pages.md`

**Cloudflare DNS** - Latest
- **Why:** Fast, secure, integrated with Pages and Workers
- **Responsible for:**
  - Domain management
  - DNS routing
  - DNSSEC
- **Documentation needed:** `10-operations/deployment/dns-setup.md`

### CI/CD

**GitHub Actions** - Latest
- **Why:** Native to GitHub, free for open source, powerful
- **Responsible for:**
  - Running tests on PR
  - Type checking
  - Linting
  - Security scanning
  - Building and deploying to staging
  - Deploying to production (with approval)
- **Documentation needed:** `11-development/ci-cd/github-actions.md`

**Dependabot** - Built into GitHub
- **Why:** Automated dependency updates
- **Responsible for:**
  - Security vulnerability alerts
  - Dependency update PRs
- **Documentation needed:** `11-development/security-scanning.md`

### Version Control

**Git** - `2.40+`
- **Why:** Industry standard
- **Responsible for:**
  - Source code versioning
  - Collaboration
  - Code review via PRs

**GitHub** - Cloud
- **Why:** Best Git hosting, excellent integrations, Actions included
- **Responsible for:**
  - Repository hosting
  - Pull request reviews
  - Issue tracking
  - Project management (Projects feature)
  - Secrets management (GitHub Secrets for CI/CD)
- **Documentation needed:** `11-development/github-workflow.md`

---

## Development Tools

### Package Management

**pnpm** - `8.x`
- **Why:** Faster than npm, disk-efficient, strict node_modules
- **Responsible for:**
  - Installing dependencies
  - Lockfile management
  - Monorepo support (if needed)
- **Documentation needed:** `11-development/local-setup.md`

### Code Quality

**ESLint** - `8.x`
- **Why:** Standard JavaScript/TypeScript linter
- **Config:** `@next/eslint-config` + custom rules
- **Responsible for:**
  - Code style enforcement
  - Catching common bugs
  - Security issue detection
- **Documentation needed:** `11-development/code-quality/linting-config.md`

**Prettier** - `3.x`
- **Why:** Opinionated code formatter, integrates with ESLint
- **Responsible for:**
  - Consistent code formatting
  - Automatic formatting on save
- **Documentation needed:** `11-development/code-quality/prettier-config.md`

**TypeScript ESLint** - `6.x`
- **Why:** TypeScript-specific linting rules
- **Responsible for:**
  - TypeScript best practices
  - Type safety enforcement

**Husky** - `8.x`
- **Why:** Git hooks for pre-commit checks
- **Responsible for:**
  - Running lint before commit
  - Running tests before push
- **Documentation needed:** `11-development/code-quality/git-hooks.md`

**lint-staged** - `15.x`
- **Why:** Run linters only on staged files (faster)
- **Responsible for:**
  - Fast pre-commit checks

### Testing

**Vitest** - `1.x`
- **Why:** Fast, Vite-powered, Jest-compatible API
- **Responsible for:**
  - Unit tests
  - Integration tests
  - Test coverage reporting
- **Documentation needed:** `11-development/testing/unit-testing.md`

**Testing Library (React)** - `14.x`
- **Why:** Best practices for testing React components
- **Responsible for:**
  - Component testing
  - User interaction testing
- **Documentation needed:** `11-development/testing/component-testing.md`

**Playwright** - `1.40.x`
- **Why:** Modern E2E testing, cross-browser, excellent debugging
- **Responsible for:**
  - End-to-end tests
  - Cross-browser testing
  - Visual regression testing (future)
- **Documentation needed:** `11-development/testing/e2e-testing.md`

**MSW (Mock Service Worker)** - `2.x`
- **Why:** API mocking for tests, works in browser and Node
- **Responsible for:**
  - Mocking Supabase API in tests
  - Mocking Claude API in tests
  - Intercepting HTTP requests

---

## Monitoring & Observability

### Analytics & Monitoring

**Cloudflare Web Analytics** - Built-in
- **Why:** Privacy-friendly, no cookies, free
- **Responsible for:**
  - Page views
  - Visitor counts
  - Performance metrics
- **Documentation needed:** `10-operations/monitoring/cloudflare-analytics.md`

**Sentry** - Cloud (if budget allows)
- **Why:** Best-in-class error tracking
- **Responsible for:**
  - Frontend error tracking
  - Backend error tracking (Workers)
  - Performance monitoring
  - Release tracking
- **Documentation needed:** `10-operations/monitoring/sentry-setup.md`

**Supabase Dashboard** - Built-in
- **Why:** Database metrics, query performance
- **Responsible for:**
  - Database performance monitoring
  - Query analysis
  - Connection pool status
  - Storage usage

### Logging

**Cloudflare Logpush** - (If needed)
- **Why:** Export logs from Workers
- **Responsible for:**
  - Worker request logs
  - Error logs
  - Security events

**Supabase Logs** - Built-in
- **Why:** Database and API logs
- **Responsible for:**
  - Database query logs
  - Auth events
  - Edge function logs

---

## Runtime Environments

### Node.js

**Node.js** - `20.x LTS` (for development and MCP server)
- **Why:** LTS support, best compatibility with tooling
- **Responsible for:**
  - Running development servers
  - MCP server runtime
  - Build processes
  - CI/CD scripts

### Deno

**Deno** - `1.40+` (for Supabase Edge Functions, if used)
- **Why:** Secure by default, TypeScript native, used by Supabase Edge Functions
- **Responsible for:**
  - Supabase Edge Functions runtime
  - Future CLI tool (consideration)

### Browser

**Target Browsers:**
- Chrome/Edge `100+`
- Firefox `100+`
- Safari `15+`
- Mobile Safari `15+`
- Mobile Chrome `100+`

**Responsible for:**
- Client-side encryption (Web Crypto API)
- Running React application
- WebSocket connections (Supabase Realtime)

---

## CLI Tools (Post-MVP)

**Abyrith CLI** - Custom (Future)
- **Language:** Node.js (TypeScript) or Deno
- **Why:** Developer-friendly secret access
- **Responsible for:**
  - `abyrith get SECRET_NAME`
  - `abyrith set SECRET_NAME value`
  - `abyrith init` (project setup)
  - Local encryption key management
- **Documentation needed:** `08-features/cli-tool/architecture.md`

---

## Communication & Collaboration

### Team Communication

**Slack** - (If team exists)
- **Why:** Standard team communication
- **Responsible for:**
  - Team chat
  - Integration webhooks
  - Incident alerts

**Linear** or **GitHub Issues**
- **Why:** Issue tracking and project management
- **Responsible for:**
  - Feature tracking
  - Bug tracking
  - Sprint planning

### Documentation

**Markdown** - All documentation
- **Why:** Simple, git-friendly, AI-readable
- **Responsible for:**
  - All technical documentation
  - READMEs
  - Architecture docs

**Mermaid** - Diagrams in markdown
- **Why:** Text-based diagrams, version control friendly
- **Responsible for:**
  - Architecture diagrams
  - Flow charts
  - Sequence diagrams
- **Documentation needed:** `00-admin/diagram-standards.md`

---

## Service Responsibility Matrix

Quick reference for "which service does what":

| Need | Service | Why |
|------|---------|-----|
| Store data | Supabase PostgreSQL | Managed, RLS, JSON support |
| Authenticate users | Supabase Auth | Managed, JWT, OAuth built-in |
| Real-time updates | Supabase Realtime | WebSocket, built into Supabase |
| Host frontend | Cloudflare Pages | Global CDN, SSR support |
| Custom API logic | Cloudflare Workers | Zero cold start, edge computing |
| Cache at edge | Cloudflare Workers KV | Low latency, global |
| AI conversations | Claude API | Best reasoning, Extended Thinking |
| Scrape API docs | FireCrawl | Specialized tool |
| MCP for Claude Code | Custom MCP Server | Anthropic standard |
| Run tests | Vitest + Playwright | Fast unit tests + E2E |
| CI/CD | GitHub Actions | Free, integrated |
| Error tracking | Sentry | Best error tracking |
| Code hosting | GitHub | Standard, Actions included |

---

## Development Environment Setup

**Required on developer machine:**
- Node.js 20.x LTS
- pnpm 8.x
- Git 2.40+
- VS Code (recommended) or Cursor
  - Extensions: ESLint, Prettier, Tailwind CSS IntelliSense

**Optional but recommended:**
- Supabase CLI (for local development)
- Wrangler CLI (for Cloudflare Workers development)
- Playwright browsers (for E2E testing)

**Documentation needed:** `11-development/local-setup.md`

---

## Technology Decision Log

| Decision | Alternatives Considered | Rationale | Date |
|----------|------------------------|-----------|------|
| Next.js over Vite + React Router | Vite + React Router, Remix | SSR support, excellent DX, Vercel backing | 2025-10-29 |
| Tailwind over CSS-in-JS | Emotion, Styled Components | Faster, works great with AI, utility-first | 2025-10-29 |
| shadcn/ui over component library | Material-UI, Chakra UI | Copy-paste approach, no package bloat, full control | 2025-10-29 |
| Zustand over Redux | Redux Toolkit, Jotai | Simpler, less boilerplate, TypeScript-friendly | 2025-10-29 |
| Supabase over custom backend | Firebase, AWS Amplify, Custom | PostgreSQL power, open source, RLS built-in | 2025-10-29 |
| Cloudflare Workers over Vercel Functions | Vercel Edge Functions, AWS Lambda | Zero cold start, global, better pricing | 2025-10-29 |
| Vitest over Jest | Jest, Mocha | Faster, Vite-powered, modern | 2025-10-29 |
| Playwright over Cypress | Cypress, Puppeteer | Modern, cross-browser, excellent debugging | 2025-10-29 |
| pnpm over npm/yarn | npm, yarn, bun | Faster, disk efficient, strict | 2025-10-29 |

---

## Version Pinning Strategy

**Pin exact versions for:**
- React, Next.js, TypeScript (critical to app)
- Testing libraries (test consistency)
- Build tools (reproducible builds)

**Use range for:**
- UI libraries (shadcn components update independently)
- Development tools (ESLint, Prettier - want latest fixes)
- Cloudflare Workers (always latest in production)

**Update schedule:**
- Dependencies: Monthly review of Dependabot PRs
- Major versions: Quarterly evaluation
- Security patches: Immediate

**Documentation needed:** `11-development/dependency-management.md`

---

## Next Steps

1. Create tool-specific documentation:
   - `07-frontend/nextjs-setup.md`
   - `06-backend/supabase/setup-guide.md`
   - `06-backend/cloudflare-workers/architecture.md`

2. Define API contracts:
   - `05-api/rest-api-overview.md`
   - `05-api/schemas/` (Zod schemas)

3. Setup development environment guide:
   - `11-development/local-setup.md`
   - `11-development/environment-variables.md`

4. Create integration guides:
   - `09-integrations/claude-code/setup.md`
   - `09-integrations/mcp/server-architecture.md`

---

**This tech stack is approved and locked for MVP. Any changes require update to this document and team review.**
