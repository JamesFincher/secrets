# Abyrith Implementation Build Order

**Generated:** 2025-11-02
**Based on:** Architecture audit findings + DOCUMENTATION-ROADMAP.md + ROADMAP.md

---

## Executive Summary

**Current Documentation Completeness: 65-70%**

**Can Begin Implementation:** YES, with conditions
**Blocking Issues:** 3 critical documentation gaps
**Recommended Strategy:** Parallel development (build Phase 1 features while completing critical docs)

---

## Build Order Philosophy

> **Foundation → Data → API → Features → Integrations → Operations**
>
> You can't build MCP without the API. You can't build the API without the database schema. You can't design the schema without understanding the security model.

---

## Phase Status Overview

| Phase | Documentation | Ready for Code? | Missing Items |
|-------|---------------|-----------------|---------------|
| **Phase 0: Admin** | ✅ 100% | N/A | None |
| **Phase 1: Security** | ✅ 95% | ✅ YES | Auth/MFA feature doc |
| **Phase 2: Database** | ✅ 100% | ✅ YES | None |
| **Phase 3: API/Infra** | ⚠️ 60% | ⚠️ PARTIAL | 3 API endpoint docs, Supabase setup |
| **Phase 4: Features** | ⚠️ 60% | ⚠️ PARTIAL | 3 feature docs (MCP, Auth, Settings) |
| **Phase 5: Integrations** | ✅ 85% | ✅ YES | Minor gaps in Claude Code/Cursor |
| **Phase 6: Frontend** | ✅ 90% | ✅ YES | UI specs for Settings/Team/Audit |
| **Phase 7: Operations** | ✅ 85% | ✅ YES | None (good enough for MVP) |

---

## CRITICAL GAPS (Must Fix Before MVP)

### 🔴 Priority 1: API Endpoint Documentation (BLOCKING)

**Missing:**
1. `05-api/endpoints/organizations-endpoints.md` - Team/org management
2. `05-api/endpoints/audit-logs-endpoints.md` - Compliance exports
3. `05-api/endpoints/mcp-endpoints.md` - AI tool integration

**Impact:** Cannot implement team management, compliance, or MCP features
**Estimate:** 1,050-1,300 lines total
**Dependencies:** Database schemas exist ✅
**Owner:** API Team

---

### 🔴 Priority 2: MCP Integration Feature Documentation (BLOCKING)

**Missing:**
1. `08-features/mcp-integration/mcp-feature-overview.md`

**Impact:** MVP roadmap lists MCP as critical; zero feature-level UX/flow documentation
**Estimate:** 400-600 lines
**Dependencies:** All satisfied ✅
**Owner:** AI/Integration Team

---

### 🔴 Priority 3: Supabase Backend Documentation (BLOCKING)

**Missing:**
1. `06-backend/supabase/database-setup.md` - Setup procedures
2. `06-backend/supabase/connection-pooling.md` - Performance config
3. `06-backend/supabase/migration-strategy.md` - Deployment procedures

**Impact:** Cannot deploy database layer
**Estimate:** 800-1,000 lines total
**Dependencies:** Schemas exist ✅
**Owner:** Backend Team

---

## BUILD ORDER: Layer-by-Layer Implementation

### **LAYER 0: Complete Critical Documentation** ⏱️ 2-3 Days

**Do FIRST before any coding:**

1. **Create Missing API Endpoints** (Parallel)
   - `05-api/endpoints/organizations-endpoints.md`
   - `05-api/endpoints/audit-logs-endpoints.md`
   - `05-api/endpoints/mcp-endpoints.md`

2. **Create MCP Feature Doc**
   - `08-features/mcp-integration/mcp-feature-overview.md`

3. **Create Supabase Backend Docs**
   - `06-backend/supabase/database-setup.md`
   - `06-backend/supabase/connection-pooling.md`

4. **Create Auth/MFA Feature Doc** (High Priority)
   - `08-features/authentication/auth-mfa-overview.md`

5. **Create Settings Feature Doc** (High Priority)
   - `08-features/user-account/settings-profile-overview.md`

**Result:** 90%+ documentation coverage → Safe to begin full implementation

---

### **LAYER 1: Foundation (Security & Auth)** ⏱️ 2-3 Weeks

**Build in this order:**

#### Week 1-2: Core Security Infrastructure

1. ✅ **Web Crypto API Implementation**
   - `PBKDF2` key derivation (600k iterations)
   - `AES-256-GCM` encryption/decryption
   - Key storage manager (memory + IndexedDB)
   - **Docs:** `07-frontend/client-encryption/webcrypto-implementation.md` ✅ COMPLETE
   - **Test:** Unit tests for all crypto functions

2. ✅ **Authentication System**
   - Supabase Auth integration (email/password, OAuth)
   - JWT token management (refresh strategy)
   - Session persistence
   - **Docs:** `03-security/auth/authentication-flow.md` ✅ COMPLETE
   - **Docs:** `05-api/endpoints/auth-endpoints.md` ✅ COMPLETE
   - **Test:** Auth flow integration tests

3. ⚠️ **Multi-Factor Authentication (MFA)**
   - TOTP implementation (time-based one-time passwords)
   - Backup codes generation
   - MFA enrollment flow
   - **Docs:** `08-features/authentication/auth-mfa-overview.md` ⚠️ NEEDS CREATION
   - **Test:** MFA enrollment and verification tests

**Dependencies Satisfied:**
- ✅ Security model documented
- ✅ Encryption specification complete
- ✅ Zero-knowledge architecture defined
- ✅ Threat model analyzed
- ⚠️ Auth/MFA feature doc needed

**Checkpoint:** Can authenticate users, encrypt/decrypt data client-side

---

### **LAYER 2: Data Layer (Database Setup)** ⏱️ 1-2 Weeks

**Build in this order:**

1. ⚠️ **Supabase Project Setup**
   - Create Supabase project
   - Configure connection pooling
   - Set up RLS policies
   - **Docs:** `06-backend/supabase/database-setup.md` ⚠️ NEEDS CREATION
   - **Docs:** `04-database/database-overview.md` ✅ COMPLETE

2. ✅ **Run Database Migrations**
   - Create tables (users, organizations, projects, secrets, audit_logs)
   - Apply RLS policies
   - Create indexes
   - **Docs:** `04-database/schemas/*.md` ✅ ALL COMPLETE
   - **Docs:** `04-database/migrations/migration-guide.md` ✅ COMPLETE
   - **Test:** Verify RLS policies work correctly

3. ✅ **Verify Multi-Tenancy**
   - Test organization isolation
   - Test project-level access
   - Test RLS enforcement
   - **Test:** Integration tests for data isolation

**Dependencies Satisfied:**
- ✅ All database schemas documented
- ✅ RLS policies defined
- ⚠️ Supabase setup procedures needed

**Checkpoint:** Database deployed with full RLS isolation

---

### **LAYER 3: API Layer (Backend Services)** ⏱️ 2-3 Weeks

**Build in this order:**

#### Week 1: Core API Infrastructure

1. ✅ **Cloudflare Workers Setup**
   - Deploy Workers as API gateway
   - Implement rate limiting
   - Set up request routing
   - Configure KV caching
   - **Docs:** `06-backend/cloudflare-workers/workers-architecture.md` ✅ COMPLETE
   - **Test:** Load testing for rate limits

2. ✅ **API Design Standards Implementation**
   - Error response format
   - Pagination helpers
   - Filtering/sorting utilities
   - **Docs:** `05-api/api-rest-design.md` ✅ COMPLETE

#### Week 2: Core Endpoints

3. ✅ **Authentication Endpoints**
   - POST /auth/signup
   - POST /auth/login
   - POST /auth/logout
   - POST /auth/refresh
   - POST /auth/reset-password
   - **Docs:** `05-api/endpoints/auth-endpoints.md` ✅ COMPLETE
   - **Test:** Auth endpoint integration tests

4. ✅ **Secrets Endpoints**
   - POST /secrets (create)
   - GET /secrets/:id (retrieve)
   - PUT /secrets/:id (update)
   - DELETE /secrets/:id (delete)
   - GET /projects/:id/secrets (list)
   - **Docs:** `05-api/endpoints/secrets-endpoints.md` ✅ COMPLETE
   - **Test:** CRUD operation tests

5. ✅ **Projects Endpoints**
   - POST /projects (create)
   - GET /projects/:id (retrieve)
   - PUT /projects/:id (update)
   - DELETE /projects/:id (delete)
   - GET /organizations/:id/projects (list)
   - **Docs:** `05-api/endpoints/projects-endpoints.md` ✅ COMPLETE
   - **Test:** Project management tests

#### Week 3: Team & Compliance Endpoints

6. ⚠️ **Organizations Endpoints**
   - POST /organizations (create)
   - GET /organizations/:id (retrieve)
   - PUT /organizations/:id (update)
   - DELETE /organizations/:id (delete)
   - POST /organizations/:id/members (invite)
   - PUT /organizations/:id/members/:user_id (update role)
   - DELETE /organizations/:id/members/:user_id (remove)
   - **Docs:** `05-api/endpoints/organizations-endpoints.md` ⚠️ NEEDS CREATION
   - **Test:** Team management tests

7. ⚠️ **Audit Logs Endpoints**
   - GET /audit-logs (list with filters)
   - GET /audit-logs/:id (retrieve)
   - POST /audit-logs/export (compliance export)
   - GET /secrets/:id/access-history
   - **Docs:** `05-api/endpoints/audit-logs-endpoints.md` ⚠️ NEEDS CREATION
   - **Test:** Audit log query tests

8. ⚠️ **MCP Endpoints**
   - POST /mcp-requests (submit request)
   - GET /mcp-requests (list pending)
   - PUT /mcp-requests/:id (approve/deny)
   - GET /mcp-requests/:id/status
   - **Docs:** `05-api/endpoints/mcp-endpoints.md` ⚠️ NEEDS CREATION
   - **Test:** MCP approval flow tests

**Dependencies Satisfied:**
- ✅ Database layer operational
- ✅ Auth system working
- ⚠️ 3 API endpoint docs needed

**Checkpoint:** Full REST API operational with rate limiting

---

### **LAYER 4: Core Features (MVP User-Facing)** ⏱️ 3-4 Weeks

**Build in this order:**

#### Week 1: Zero-Knowledge Vault

1. ✅ **Master Password Setup Flow**
   - Master password input UI
   - Password strength indicator
   - Key derivation (PBKDF2)
   - Recovery key generation
   - **Docs:** `08-features/zero-knowledge-vault/encryption-ux-flow.md` ✅ COMPLETE
   - **Docs:** `07-frontend/client-encryption/webcrypto-implementation.md` ✅ COMPLETE
   - **Test:** E2E encryption flow test

2. ✅ **Master Password Unlock**
   - Unlock vault prompt
   - Key restoration from session
   - Session timeout handling
   - **Test:** Key persistence and lock/unlock flow

#### Week 2: Secret Management UI

3. ✅ **Secret CRUD Interface**
   - Create secret form (with encryption)
   - Secret card display
   - Update secret modal
   - Delete secret confirmation
   - **Docs:** `07-frontend/components/component-library.md` ✅ COMPLETE
   - **Docs:** `08-features/zero-knowledge-vault/encryption-ux-flow.md` ✅ COMPLETE
   - **Test:** E2E secret management tests

4. ✅ **Project Management Interface**
   - Project selector dropdown
   - Environment tabs (dev/staging/prod)
   - Project creation modal
   - Project settings page
   - **Docs:** `08-features/project-management/project-management-overview.md` ✅ COMPLETE
   - **Docs:** `07-frontend/components/component-library.md` ✅ COMPLETE
   - **Test:** Project organization E2E tests

#### Week 3: AI Assistant

5. ✅ **AI Chat Interface**
   - Chat container UI
   - Message rendering (user/assistant)
   - Streaming response handling
   - Code block and markdown rendering
   - **Docs:** `07-frontend/ai/ai-chat-interface.md` ✅ COMPLETE
   - **Test:** Chat UI rendering tests

6. ✅ **Claude API Integration**
   - Model selection logic (Haiku vs Sonnet)
   - Prompt engineering for secret guidance
   - Token limit management
   - Error handling (rate limits, context windows)
   - **Docs:** `08-features/ai-assistant/ai-assistant-overview.md` ✅ COMPLETE
   - **Docs:** `09-integrations/mcp/mcp-overview.md` ✅ COMPLETE (scattered)
   - **Test:** AI response quality tests

7. ✅ **FireCrawl Integration**
   - API documentation scraping
   - Cache strategy (24-hour TTL)
   - Parsing and extraction
   - Fallback mechanisms
   - **Docs:** `09-integrations/firecrawl/firecrawl-integration.md` ✅ COMPLETE
   - **Test:** FireCrawl scraping tests

#### Week 4: Team Collaboration

8. ✅ **Team Management UI**
   - Team member list
   - Invite member modal
   - Role assignment dropdown
   - Remove member confirmation
   - **Docs:** `08-features/team-collaboration/team-collaboration-overview.md` ✅ COMPLETE
   - **Test:** Team collaboration E2E tests

9. ✅ **Permissions Enforcement**
   - Frontend permission gates
   - Backend RLS verification
   - Role-based UI hiding/showing
   - **Docs:** `03-security/rbac/permissions-model.md` ✅ COMPLETE
   - **Test:** Permission enforcement tests

10. ✅ **Activity Feed**
    - Recent activity display
    - Filter by user/project/date
    - Real-time updates (Supabase Realtime)
    - **Docs:** `08-features/audit-logs/audit-logs-overview.md` ✅ COMPLETE
    - **Test:** Activity feed tests

**Dependencies Satisfied:**
- ✅ API layer operational
- ✅ All core feature docs exist
- ✅ Frontend architecture defined

**Checkpoint:** MVP features functional for individual users and small teams

---

### **LAYER 5: AI Tool Integration (MCP)** ⏱️ 2-3 Weeks

**Build in this order:**

1. ⚠️ **MCP Server Implementation**
   - MCP server foundation (Node.js/TypeScript)
   - Authentication and authorization
   - Tool registration (list, get, request, search)
   - **Docs:** `09-integrations/mcp/mcp-secrets-server.md` ✅ COMPLETE
   - **Docs:** `08-features/mcp-integration/mcp-feature-overview.md` ⚠️ NEEDS CREATION
   - **Test:** MCP server unit tests

2. ✅ **MCP Tools Implementation**
   - `mcp_secrets_list` - List available secrets
   - `mcp_secrets_get` - Retrieve with approval
   - `mcp_secrets_request` - Request missing key
   - `mcp_secrets_search` - Search secrets
   - **Docs:** `09-integrations/mcp/mcp-secrets-server.md` ✅ COMPLETE
   - **Test:** MCP tools integration tests

3. ✅ **Approval Workflow**
   - Approval request notification
   - Time-limited access grants (1h, 24h, always)
   - WebSocket-based approval notifications
   - Audit logging for MCP requests
   - **Docs:** `09-integrations/mcp/mcp-secrets-server.md` ✅ COMPLETE
   - **Test:** Approval flow E2E tests

4. ⚠️ **Claude Code Integration**
   - MCP configuration for Claude Code
   - Setup instructions
   - Troubleshooting guide
   - **Docs:** `09-integrations/claude-code/claude-code-integration.md` ⚠️ 75% COMPLETE
   - **Test:** Claude Code integration test

5. ⚠️ **Cursor Integration**
   - MCP configuration for Cursor
   - Setup instructions
   - **Docs:** `09-integrations/cursor/cursor-integration.md` ⚠️ 75% COMPLETE
   - **Test:** Cursor integration test

**Dependencies Satisfied:**
- ✅ API endpoints operational
- ✅ MCP technical specs complete
- ⚠️ MCP feature doc needed

**Checkpoint:** AI tools can access secrets via MCP with approval workflow

---

### **LAYER 6: Settings & Profile Management** ⏱️ 1-2 Weeks

**Build in this order:**

1. ⚠️ **Profile Settings Page**
   - User profile editing
   - Email change
   - Display preferences
   - **Docs:** `08-features/user-account/settings-profile-overview.md` ⚠️ NEEDS CREATION
   - **Test:** Profile settings tests

2. ⚠️ **Security Settings Page**
   - Master password change
   - MFA setup/disable
   - Recovery key regeneration
   - Active sessions list
   - **Docs:** `08-features/user-account/settings-profile-overview.md` ⚠️ NEEDS CREATION
   - **Test:** Security settings tests

3. ⚠️ **Notification Preferences**
   - Email notification toggles
   - Slack integration setup
   - Webhook configuration
   - **Docs:** `08-features/user-account/settings-profile-overview.md` ⚠️ NEEDS CREATION
   - **Test:** Notification preferences tests

**Dependencies Satisfied:**
- ✅ Auth system operational
- ⚠️ Settings feature doc needed

**Checkpoint:** Users can manage account settings and preferences

---

### **LAYER 7: Infrastructure & Deployment** ⏱️ 1-2 Weeks

**Build in this order:**

1. ✅ **Cloudflare Pages Deployment**
   - Next.js build configuration
   - Deploy to Cloudflare Pages
   - Environment variable setup
   - **Docs:** `07-frontend/deployment/cloudflare-pages-deployment.md` ✅ COMPLETE
   - **Docs:** `10-operations/deployment/deployment-runbook.md` ✅ COMPLETE

2. ⚠️ **Supabase Production Setup**
   - Production database configuration
   - Connection pooling optimization
   - Backup verification
   - **Docs:** `06-backend/supabase/database-setup.md` ⚠️ NEEDS CREATION

3. ✅ **CI/CD Pipeline**
   - GitHub Actions for testing
   - Automated deployment to staging
   - Production deployment with gates
   - **Docs:** `10-operations/deployment/deployment-pipeline.md` ✅ COMPLETE

4. ✅ **Monitoring Setup**
   - Cloudflare Analytics
   - Supabase monitoring
   - Error tracking (Sentry optional)
   - Uptime monitoring
   - **Docs:** `10-operations/monitoring/monitoring-alerting.md` ✅ COMPLETE

**Dependencies Satisfied:**
- ✅ All application components built
- ⚠️ Supabase setup doc needed

**Checkpoint:** Platform deployed and monitored in production

---

### **LAYER 8: Testing & Quality Assurance** ⏱️ 1-2 Weeks

**Build in this order:**

1. **Security Audit**
   - Penetration testing
   - RLS policy verification
   - Encryption audit
   - OWASP Top 10 verification

2. **Performance Testing**
   - Load testing (rate limits, concurrent users)
   - API response time verification (<200ms p95)
   - Database query optimization
   - Edge caching verification

3. **E2E User Testing**
   - First-time user onboarding flow
   - AI assistant key acquisition
   - Team collaboration flows
   - MCP integration flows

4. **Compliance Verification**
   - Audit log completeness
   - Data retention policies
   - RLS enforcement verification
   - Zero-knowledge encryption verification

**Dependencies Satisfied:**
- ✅ All features implemented
- ✅ Platform deployed

**Checkpoint:** Platform tested and ready for beta launch

---

## Parallel Development Strategy (RECOMMENDED)

**Maximize team efficiency by working in parallel:**

### Week 1-2: Documentation + Foundation
- **Docs Team:** Create 3 API endpoint docs + MCP feature doc + Supabase docs (Layer 0)
- **Dev Team:** Build Web Crypto + Auth system (Layer 1)

### Week 3-4: Database + Core API
- **Backend Team:** Supabase setup + Core API endpoints (Layer 2-3)
- **Frontend Team:** Master password UI + Secret management UI (Layer 4, Week 1-2)

### Week 5-6: Features
- **Backend Team:** Finish API endpoints (Organizations, Audit, MCP) (Layer 3)
- **Frontend Team:** AI Chat + Team Management (Layer 4, Week 3-4)
- **AI Team:** Claude API + FireCrawl integration (Layer 4)

### Week 7-8: MCP Integration
- **AI Team:** MCP server + tools + approval workflow (Layer 5)
- **Frontend Team:** Settings pages (Layer 6)
- **DevOps:** Deployment setup (Layer 7)

### Week 9-10: Testing & Launch
- **All Teams:** Security audit, performance testing, E2E testing (Layer 8)
- **Product Team:** Beta user onboarding

**Result:** MVP ready in 10 weeks with complete documentation

---

## Feature Implementation Checklist

### Must Have for MVP Launch

- [x] Zero-knowledge encryption operational
- [x] User authentication (email + OAuth)
- [ ] MFA enrollment and verification
- [x] Project organization
- [x] Environment management
- [x] Secret CRUD operations
- [x] AI Secret Assistant (Claude integration)
- [ ] FireCrawl API scraping
- [ ] MCP server + tools
- [ ] MCP approval workflow
- [x] Team invitations
- [x] RBAC enforcement
- [x] Basic audit logs
- [ ] Organizations management
- [ ] Settings & profile pages
- [ ] Cloudflare Pages deployment
- [ ] Supabase production setup
- [ ] CI/CD pipeline
- [ ] Basic monitoring

**Total:** 19 MVP features
**Complete:** 9/19 (47% - based on docs)
**Blocking:** 3 (Orgs API, Audit API, MCP API + feature doc)

---

## Success Criteria for MVP Launch

**Technical:**
- ✅ 99.5% uptime
- ✅ <500ms average API response time
- ✅ Zero security incidents
- ✅ Zero data breaches
- ✅ All RLS policies enforced

**User Experience:**
- ✅ <10 minutes for first-time user to acquire and store first API key
- ✅ >4.5/5 AI assistant helpfulness rating
- ✅ >95% success rate for guided key acquisition

**AI Integration:**
- ✅ >70% of power users enable MCP integration
- ✅ >95% MCP request fulfillment rate (when key exists)
- ✅ <5 minutes to resolve "key not found" MCP requests

**Adoption:**
- ✅ 100+ individual users in first month
- ✅ 10+ teams (3+ members) onboarded
- ✅ 50% of users return within 7 days

---

## Timeline Estimate

**Documentation Completion:** 2-3 days
**Layer 1 (Foundation):** 2-3 weeks
**Layer 2 (Data):** 1-2 weeks
**Layer 3 (API):** 2-3 weeks
**Layer 4 (Features):** 3-4 weeks
**Layer 5 (MCP):** 2-3 weeks
**Layer 6 (Settings):** 1-2 weeks
**Layer 7 (Deployment):** 1-2 weeks
**Layer 8 (Testing):** 1-2 weeks

**Total (Sequential):** 15-22 weeks
**Total (Parallel):** 10-12 weeks ⭐ RECOMMENDED

**Target MVP Launch:** 10 weeks from start of implementation

---

## Next Steps

1. ✅ Review and approve this build order
2. ⚠️ Create missing documentation (Layer 0) - **DO THIS FIRST**
3. ⚠️ Assign team members to layers
4. ⚠️ Set up project management tracking (GitHub Projects, Jira, Linear)
5. ⚠️ Create git branches for each layer
6. ⚠️ Begin parallel development

---

**Build Order Maintainer:** Engineering Lead
**Last Updated:** 2025-11-02
**Status:** Ready for Review → Approval
