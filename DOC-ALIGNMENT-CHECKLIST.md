# Documentation Alignment Checklist

**Version:** 1.0.0
**Last Updated:** 2025-10-29
**Owner:** Engineering Lead
**Status:** Approved
**Purpose:** Ensure all documentation is consistent and accurate across the entire project

---

## Why This Matters

Documentation drift happens when one doc gets updated but related docs don't. This creates confusion, bugs, and wasted time. **This checklist ensures everything stays aligned.**

**Use this checklist:**
- Before marking a phase complete in DOCUMENTATION-ROADMAP.md
- After making significant updates to any document
- Weekly during active documentation phase
- Before starting implementation (to ensure docs are buildable)

---

## Quick Alignment Check

Run these commands to find common issues:

```bash
# Find docs without version headers
find . -name "*.md" -type f -exec grep -L "^---$" {} \; | grep -v node_modules

# Find broken internal links (references to files that don't exist)
grep -r "Dependencies:" --include="*.md" | cut -d: -f3 | tr ',' '\n' | while read dep; do
  [ -f "$dep" ] || echo "Missing: $dep"
done

# Find inconsistent terminology (should use GLOSSARY.md terms)
# Example: searching for "row level security" instead of "RLS"
grep -ri "row level security" --include="*.md" . | grep -v "GLOSSARY.md"

# Find version numbers that don't match TECH-STACK.md
# Example: searching for "Next.js" version mentions
grep -r "Next\.js" --include="*.md" | grep -v "14\.2"
```

---

## Phase 0: Admin & Core Documents

### ✅ Checklist

**All root-level docs exist:**
- [ ] `GLOSSARY.md` exists and defines all key terms
- [ ] `CONTRIBUTING.md` exists with PR process
- [ ] `CHANGELOG.md` exists and tracks changes
- [ ] `ROADMAP.md` exists with MVP and post-MVP features
- [ ] `TECH-STACK.md` exists with exact versions
- [ ] `DOCUMENTATION-ROADMAP.md` exists
- [ ] `FOLDER-STRUCTURE.md` exists
- [ ] `QUICK-START.md` exists
- [ ] `CLAUDE.md` exists

**Admin folder complete:**
- [ ] `00-admin/versioning-strategy.md` exists
- [ ] `00-admin/document-templates.md` exists
- [ ] `00-admin/review-process.md` exists

**Cross-references:**
- [ ] `CLAUDE.md` references `TECH-STACK.md`
- [ ] `DOCUMENTATION-ROADMAP.md` references `FOLDER-STRUCTURE.md`
- [ ] `QUICK-START.md` references `DOCUMENTATION-ROADMAP.md`

### Validation Questions

1. Are all technical terms from product docs added to `GLOSSARY.md`?
2. Does `TECH-STACK.md` match decisions in architecture docs?
3. Does `ROADMAP.md` align with product vision timeline?

---

## Phase 1: Security & Auth Foundation

### ✅ Checklist

**Core security docs:**
- [ ] `03-security/security-model.md` exists
- [ ] `03-security/encryption-specification.md` exists
- [ ] `03-security/zero-knowledge-architecture.md` exists
- [ ] `03-security/threat-model.md` exists

**Auth docs:**
- [ ] `03-security/auth/authentication-flow.md` exists
- [ ] `03-security/auth/oauth-setup.md` exists
- [ ] `03-security/auth/mfa-implementation.md` exists
- [ ] `03-security/auth/password-reset.md` exists
- [ ] `03-security/auth/session-management.md` exists

**RBAC docs:**
- [ ] `03-security/rbac/permissions-model.md` exists
- [ ] `03-security/rbac/role-definitions.md` exists
- [ ] `03-security/rbac/rls-policies.md` exists

### Alignment Checks

**Security model alignment:**
- [ ] Encryption algorithm in `encryption-specification.md` matches `TECH-STACK.md` (AES-256-GCM)
- [ ] Key derivation in `zero-knowledge-architecture.md` matches `TECH-STACK.md` (PBKDF2)
- [ ] Master password handling consistent across all security docs
- [ ] Zero-knowledge principle (server can't decrypt) stated consistently

**Auth alignment:**
- [ ] Supabase Auth version in auth docs matches `TECH-STACK.md`
- [ ] JWT structure documented consistently
- [ ] OAuth providers list matches product vision (Google, GitHub, enterprise)
- [ ] MFA method (TOTP) matches `TECH-STACK.md`

**RBAC alignment:**
- [ ] Role names match across all docs: Owner, Admin, Developer, Read-Only
- [ ] Permission descriptions consistent
- [ ] RLS policy examples use correct PostgreSQL syntax

### Validation Questions

1. Can you implement the encryption system from the security docs alone?
2. Are all security requirements from product vision documented?
3. Does the threat model cover all attack vectors mentioned in architecture?
4. Are there any contradictions between security and usability requirements?

---

## Phase 2: Database & Schemas

### ✅ Checklist

**Database docs:**
- [ ] `04-database/database-overview.md` exists
- [ ] `04-database/multi-tenancy-strategy.md` exists (if separate from overview)
- [ ] `04-database/migration-guide.md` exists

**Schema docs:**
- [ ] `04-database/schemas/users-organizations.md` exists
- [ ] `04-database/schemas/projects-environments.md` exists
- [ ] `04-database/schemas/secrets-metadata.md` exists
- [ ] `04-database/schemas/audit-logs.md` exists

**Supporting docs:**
- [ ] `04-database/indexes-performance.md` exists
- [ ] `04-database/backup-recovery.md` exists

### Alignment Checks

**Database alignment:**
- [ ] PostgreSQL version matches `TECH-STACK.md` (15.x)
- [ ] All schemas reference Supabase correctly
- [ ] RLS policies in schema docs match `03-security/rbac/rls-policies.md`

**Multi-tenancy:**
- [ ] Organization model consistent across all schema docs
- [ ] `organization_id` foreign key used consistently
- [ ] RLS policies enforce organization isolation in every table

**Encryption fields:**
- [ ] Secrets table has `encrypted_value` column (not `value`)
- [ ] Encryption specs from Phase 1 referenced correctly
- [ ] No plaintext secret storage anywhere

**Data types:**
- [ ] UUIDs used for primary keys (not integers)
- [ ] Timestamp columns named consistently: `created_at`, `updated_at`
- [ ] JSON columns use `jsonb` (not `json`)

### Validation Questions

1. Can you generate SQL DDL from the schema docs?
2. Are all RLS policies enforceable from the documented structure?
3. Does every table reference its owner (organization or user)?
4. Are audit requirements from compliance docs satisfied by audit_logs schema?

---

## Phase 3: API & Infrastructure

### ✅ Checklist

**API docs:**
- [ ] `05-api/rest-api-overview.md` exists
- [ ] `05-api/authentication.md` exists
- [ ] `05-api/error-handling.md` exists
- [ ] `05-api/rate-limiting.md` exists

**Endpoint docs:**
- [ ] `05-api/endpoints/auth-endpoints.md` exists
- [ ] `05-api/endpoints/secrets-endpoints.md` exists
- [ ] `05-api/endpoints/projects-endpoints.md` exists
- [ ] `05-api/endpoints/teams-endpoints.md` exists
- [ ] `05-api/endpoints/audit-endpoints.md` exists

**Infrastructure docs:**
- [ ] `06-backend/cloudflare-workers/architecture.md` exists
- [ ] `06-backend/cloudflare-workers/api-gateway.md` exists
- [ ] `06-backend/supabase/setup-guide.md` exists

### Alignment Checks

**API endpoints match database schemas:**
- [ ] Every endpoint references a corresponding schema doc
- [ ] Secrets endpoints align with `04-database/schemas/secrets-metadata.md`
- [ ] Projects endpoints align with `04-database/schemas/projects-environments.md`
- [ ] Audit endpoints align with `04-database/schemas/audit-logs.md`

**Authentication:**
- [ ] Auth endpoints match `03-security/auth/authentication-flow.md`
- [ ] JWT handling matches security docs
- [ ] OAuth flows match `03-security/auth/oauth-setup.md`

**Request/response formats:**
- [ ] All endpoints document request schema (JSON)
- [ ] All endpoints document response schema (JSON)
- [ ] Zod schemas (if included) match TypeScript types
- [ ] Error responses match `05-api/error-handling.md`

**Rate limiting:**
- [ ] Rate limit strategy documented in `05-api/rate-limiting.md`
- [ ] Cloudflare Workers rate limiting aligns with API spec
- [ ] Limits mentioned in product vision match API docs

**Infrastructure alignment:**
- [ ] Cloudflare Workers version matches `TECH-STACK.md`
- [ ] Supabase setup references correct PostgreSQL version
- [ ] KV storage use cases match caching strategy
- [ ] Worker deployment process aligns with `10-operations/deployment/`

### Validation Questions

1. Can you generate OpenAPI spec from endpoint docs?
2. Do all API endpoints enforce RLS policies from Phase 1?
3. Are all endpoints protected by authentication?
4. Does rate limiting apply to all endpoints as specified?

---

## Phase 4: Features

### ✅ Checklist

**Core MVP features:**
- [ ] `08-features/ai-assistant/` folder exists with all docs
- [ ] `08-features/zero-knowledge-vault/` folder exists with all docs
- [ ] `08-features/project-management/` folder exists with all docs
- [ ] `08-features/team-collaboration/` folder exists with all docs
- [ ] `08-features/audit-logs/` folder exists with all docs

### Alignment Checks

**Feature docs reference dependencies:**
- [ ] AI Assistant references `06-backend/integrations/claude-api-integration.md`
- [ ] Zero-knowledge vault references `03-security/encryption-specification.md`
- [ ] Team collaboration references `03-security/rbac/`
- [ ] Audit logs reference `04-database/schemas/audit-logs.md`

**Feature completeness:**
- [ ] Each feature has overview, implementation, API, frontend, integration docs
- [ ] Each feature maps to product vision features
- [ ] Each feature specifies database requirements
- [ ] Each feature specifies API endpoints needed

**AI Assistant alignment:**
- [ ] Claude API version matches `TECH-STACK.md`
- [ ] Model selection (Haiku vs Sonnet) matches `TECH-STACK.md`
- [ ] FireCrawl integration documented
- [ ] Guided acquisition flow matches product vision

**Zero-knowledge vault:**
- [ ] Master password flow matches security docs
- [ ] Encryption implementation matches `03-security/encryption-specification.md`
- [ ] Recovery mechanism documented and secure

### Validation Questions

1. Can each feature be implemented from its docs alone?
2. Do all features maintain zero-knowledge security model?
3. Are all features accessible via AI conversation (AI-native principle)?
4. Do features work for all personas (Learner, Developer, Team, Enterprise)?

---

## Phase 5: Integrations

### ✅ Checklist

**MCP integration:**
- [ ] `09-integrations/mcp/mcp-overview.md` exists
- [ ] `09-integrations/mcp/server-architecture.md` exists
- [ ] `09-integrations/mcp/secrets-server-spec.md` exists
- [ ] `09-integrations/mcp/tools-reference.md` exists

**AI tool integrations:**
- [ ] `09-integrations/claude-code/integration-guide.md` exists
- [ ] `09-integrations/cursor/integration-guide.md` exists

**External services:**
- [ ] `06-backend/integrations/claude-api-integration.md` exists
- [ ] `06-backend/integrations/firecrawl-integration.md` exists

### Alignment Checks

**MCP alignment:**
- [ ] MCP server architecture references correct API endpoints
- [ ] MCP tools align with features documented in Phase 4
- [ ] Approval flows match team collaboration feature
- [ ] Audit logging matches audit feature

**Claude Code integration:**
- [ ] Setup instructions reference CLAUDE.md workflows
- [ ] Tool list matches MCP server spec
- [ ] Authentication matches security model

**FireCrawl:**
- [ ] API usage matches AI Assistant feature docs
- [ ] Caching strategy documented
- [ ] Error handling for failed scrapes documented

### Validation Questions

1. Can you set up MCP server from integration docs?
2. Do all MCP tools respect security model (approval required)?
3. Are integration docs consistent with CLAUDE.md guidance?

---

## Phase 6: Frontend

### ✅ Checklist

**Architecture docs:**
- [ ] `07-frontend/architecture.md` exists
- [ ] `07-frontend/nextjs-setup.md` exists
- [ ] `07-frontend/state-management.md` exists
- [ ] `07-frontend/routing-strategy.md` exists

**Component docs:**
- [ ] `07-frontend/components/component-library.md` exists
- [ ] Key component docs exist (SecretCard, ProjectSelector, etc.)

**Client-side encryption:**
- [ ] `07-frontend/client-encryption/webcrypto-implementation.md` exists
- [ ] `07-frontend/client-encryption/key-derivation.md` exists

### Alignment Checks

**Tech stack:**
- [ ] Next.js version matches `TECH-STACK.md` (14.2.x)
- [ ] React version matches `TECH-STACK.md` (18.3.x)
- [ ] TypeScript version matches `TECH-STACK.md` (5.3.x)
- [ ] Tailwind version matches `TECH-STACK.md` (3.4.x)
- [ ] Zustand usage matches `TECH-STACK.md`
- [ ] React Query usage matches `TECH-STACK.md`

**Encryption implementation:**
- [ ] WebCrypto implementation matches `03-security/encryption-specification.md`
- [ ] Key derivation (PBKDF2) parameters match security docs
- [ ] Master password handling matches zero-knowledge architecture

**API integration:**
- [ ] API client layer references `05-api/` endpoint docs
- [ ] Request/response types match API schemas
- [ ] Error handling matches `05-api/error-handling.md`

**Component library:**
- [ ] shadcn/ui usage documented
- [ ] Components align with design system (if exists)
- [ ] Accessibility requirements met

### Validation Questions

1. Can you build the frontend from architecture docs?
2. Does encryption implementation maintain zero-knowledge guarantee?
3. Are all API calls properly typed based on API docs?
4. Do components match feature requirements?

---

## Phase 7-10: Operations, Dev, User Docs

### ✅ Checklist

**Operations:**
- [ ] Deployment docs reference correct infrastructure
- [ ] Monitoring setup matches services in use
- [ ] Incident response aligns with security requirements

**Development:**
- [ ] Local setup references correct tool versions
- [ ] Testing strategy covers all features
- [ ] CI/CD pipeline matches deployment architecture

**User docs:**
- [ ] User guides match implemented features
- [ ] Setup instructions match integration docs
- [ ] Security best practices align with security model

### Alignment Checks

- [ ] All tool versions in dev docs match `TECH-STACK.md`
- [ ] Deployment targets match infrastructure docs
- [ ] Test coverage requirements stated
- [ ] User-facing terminology matches GLOSSARY.md

---

## Cross-Cutting Alignment Checks

**Version headers:**
```bash
# Every .md file should have version header
find . -name "*.md" -type f ! -path "*/node_modules/*" -exec sh -c '
  if ! grep -q "^---$" "$1"; then
    echo "Missing version header: $1"
  fi
' _ {} \;
```

**Terminology consistency:**
- [ ] All docs use terms from `GLOSSARY.md`
- [ ] Role names consistent: Owner, Admin, Developer, Read-Only
- [ ] Environment names consistent: development, staging, production
- [ ] Service names consistent: Supabase, Cloudflare Workers, etc.

**Tech stack consistency:**
```bash
# Find docs that mention Next.js but not the correct version
grep -r "Next\.js" --include="*.md" . | grep -v "14\.2"

# Find docs that mention React but not correct version
grep -r "React" --include="*.md" . | grep -v "18\.3"
```

**Broken references:**
```bash
# Find markdown links to files that don't exist
grep -r "\[.*\](.*\.md)" --include="*.md" . | \
  sed 's/.*(\(.*\.md\)).*/\1/' | \
  while read file; do
    [ -f "$file" ] || echo "Broken link: $file"
  done
```

**Security model consistency:**
- [ ] "Zero-knowledge" mentioned consistently (server can't decrypt)
- [ ] "Client-side encryption" before data leaves device
- [ ] "AES-256-GCM" encryption algorithm
- [ ] "PBKDF2" key derivation
- [ ] No plaintext secret storage anywhere

---

## Alignment Workflow

**When creating new documentation:**

1. **Before writing:**
   - Check `DOCUMENTATION-ROADMAP.md` for dependencies
   - Read all dependency docs
   - Check `TECH-STACK.md` for technology specifics
   - Check `GLOSSARY.md` for terminology

2. **While writing:**
   - Use version header template
   - Reference dependencies explicitly
   - Use correct terminology from GLOSSARY
   - Include examples and diagrams

3. **After writing:**
   - Check alignment with related docs
   - Update `CHANGELOG.md`
   - Add cross-references from related docs
   - Verify no contradictions created

**When updating existing documentation:**

1. **Find all related docs:**
   ```bash
   # Example: updating security model
   grep -r "security-model" --include="*.md" .
   ```

2. **Update all related docs:**
   - Spawn parallel agents to update multiple files
   - Ensure consistency across all changes
   - Verify no new contradictions

3. **Run alignment checks:**
   - Use commands from this checklist
   - Manually verify critical alignments
   - Update version numbers and CHANGELOG

---

## Weekly Alignment Review (During Active Documentation)

**Every week, check:**

1. **Version header compliance:** All new docs have version headers
2. **CHANGELOG.md updated:** All changes logged
3. **TECH-STACK.md alignment:** No version mismatches
4. **Cross-references valid:** No broken links
5. **Terminology consistent:** GLOSSARY terms used correctly
6. **Security model intact:** Zero-knowledge preserved everywhere

**Quick command to find this week's changes:**
```bash
# Find all .md files modified in last 7 days
find . -name "*.md" -type f -mtime -7 ! -path "*/node_modules/*"
```

---

## Before Implementation Phase

**Final alignment check before writing code:**

1. **All phases complete:** Phases 0-6 fully documented and aligned
2. **No contradictions:** Run all alignment checks, fix issues
3. **Implementation-ready:** Devs can build from docs alone
4. **Security verified:** All security requirements documented consistently
5. **API contracts clear:** Frontend and backend aligned on interfaces

**Sign-off checklist:**
- [ ] Engineering Lead review complete
- [ ] Security review complete (Phases 1, 3, 4, 5)
- [ ] Product review complete (Phases 1, 4, 8)
- [ ] All alignment checks passed
- [ ] CHANGELOG.md comprehensive
- [ ] Documentation approved for implementation

---

## Tools for Alignment

**Recommended tools:**
- **ripgrep (rg):** Fast searching for cross-references
- **jq:** Parse JSON schemas if using OpenAPI
- **git diff:** Compare documentation versions
- **Markdown linters:** Ensure format consistency

**Custom scripts** (create in `/scripts/`):
- `check-version-headers.sh` - Verify all docs have version headers
- `check-tech-stack-versions.sh` - Find version mismatches
- `check-broken-links.sh` - Find broken internal references
- `check-terminology.sh` - Verify GLOSSARY terms used consistently

---

## When Misalignment is Found

**Process:**

1. **Document the issue:**
   - Which docs are misaligned?
   - What is the discrepancy?
   - Which one is correct?

2. **Determine root cause:**
   - Was a doc updated without updating related docs?
   - Was there never alignment to begin with?
   - Is this a contradiction in requirements?

3. **Fix systematically:**
   - Update all affected docs (use parallel agents)
   - Verify fix doesn't create new issues
   - Update CHANGELOG.md

4. **Prevent recurrence:**
   - Add to this checklist if needed
   - Update review process
   - Document the lesson learned

---

**Remember: Aligned documentation = Correct implementation. Spend time on alignment now to save time debugging later.**
