# Abyrith Documentation Folder Structure

**Version:** 1.0
**Last Updated:** 2025-10-29

---

## Folder Organization Philosophy

Each major component/service/domain of the Abyrith platform has its own dedicated folder containing:
- Architecture documents
- API specifications
- Implementation guides
- Testing documentation
- Operational runbooks

This keeps related documentation together and makes it easy to find everything about a specific component.

---

## Root Level Structure

```
/
├── README.md                           # Repository overview
├── CLAUDE.md                           # Guidance for Claude Code
├── DOCUMENTATION-ROADMAP.md            # This strategic checklist (you are here)
├── FOLDER-STRUCTURE.md                 # This file
├── CHANGELOG.md                        # Platform-wide changes
├── CONTRIBUTING.md                     # How to contribute to docs
├── GLOSSARY.md                         # Terms and definitions
├── ROADMAP.md                          # Product roadmap with timelines
│
├── 00-admin/                           # Administrative documents
│   ├── versioning-strategy.md
│   ├── document-templates.md
│   └── review-process.md
│
├── 01-product/                         # Product strategy and vision
│   ├── product-vision-strategy.md      # Current: abyrith-product-vision-strategy.md
│   ├── team-playbook.md                # Current: abyrith-team-playbook (1).md
│   ├── target-personas.md
│   ├── competitive-analysis.md
│   └── feature-prioritization.md
│
├── 02-architecture/                    # High-level architecture
│   ├── system-overview.md              # Current: abyrith-technical-architecture (1).md
│   ├── technology-decisions.md
│   ├── security-architecture.md
│   ├── scalability-strategy.md
│   └── diagrams/
│       ├── system-architecture.mmd
│       ├── data-flow.mmd
│       └── deployment-diagram.mmd
│
├── 03-security/                        # Security and compliance
│   ├── security-model.md
│   ├── encryption-specification.md
│   ├── zero-knowledge-architecture.md
│   ├── threat-model.md
│   ├── auth/
│   │   ├── authentication-flow.md
│   │   ├── oauth-setup.md
│   │   ├── mfa-implementation.md
│   │   ├── session-management.md
│   │   └── password-reset.md
│   ├── rbac/
│   │   ├── permissions-model.md
│   │   ├── role-definitions.md
│   │   └── rls-policies.md
│   └── compliance/
│       ├── soc2-compliance.md
│       ├── gdpr-compliance.md
│       ├── iso27001-compliance.md
│       └── audit-requirements.md
│
├── 04-database/                        # Database architecture and schemas
│   ├── database-overview.md
│   ├── multi-tenancy-strategy.md
│   ├── migration-guide.md
│   ├── schemas/
│   │   ├── users-organizations.md
│   │   ├── projects-environments.md
│   │   ├── secrets-metadata.md
│   │   ├── audit-logs.md
│   │   └── api-service-info.md
│   ├── migrations/
│   │   ├── migration-template.sql
│   │   ├── 001-initial-schema.sql
│   │   └── README.md
│   ├── indexes-performance.md
│   └── backup-recovery.md
│
├── 05-api/                             # API specifications
│   ├── api-design-principles.md
│   ├── rest-api-overview.md
│   ├── authentication.md
│   ├── error-handling.md
│   ├── rate-limiting.md
│   ├── endpoints/
│   │   ├── auth-endpoints.md
│   │   ├── secrets-endpoints.md
│   │   ├── projects-endpoints.md
│   │   ├── teams-endpoints.md
│   │   └── audit-endpoints.md
│   ├── schemas/
│   │   ├── request-schemas.json
│   │   └── response-schemas.json
│   └── postman/
│       └── abyrith-api.postman_collection.json
│
├── 06-backend/                         # Backend services
│   ├── supabase/
│   │   ├── setup-guide.md
│   │   ├── edge-functions/
│   │   │   ├── overview.md
│   │   │   ├── secrets-handler.md
│   │   │   └── webhook-handler.md
│   │   ├── rls-policies.md
│   │   └── realtime-config.md
│   ├── cloudflare-workers/
│   │   ├── architecture.md
│   │   ├── api-gateway.md
│   │   ├── rate-limiter.md
│   │   ├── secrets-encryption.md
│   │   ├── kv-storage.md
│   │   └── deployment.md
│   └── integrations/
│       ├── firecrawl-integration.md
│       ├── claude-api-integration.md
│       └── webhook-system.md
│
├── 07-frontend/                        # Frontend application
│   ├── architecture.md
│   ├── nextjs-setup.md
│   ├── state-management.md
│   ├── routing-strategy.md
│   ├── client-encryption/
│   │   ├── webcrypto-implementation.md
│   │   ├── key-derivation.md
│   │   └── secret-encryption-flow.md
│   ├── components/
│   │   ├── component-library.md
│   │   ├── secret-card.md
│   │   ├── project-selector.md
│   │   ├── ai-chat-interface.md
│   │   └── approval-dialog.md
│   ├── pages/
│   │   ├── dashboard.md
│   │   ├── project-detail.md
│   │   ├── settings.md
│   │   └── auth-pages.md
│   ├── api-client/
│   │   ├── api-client-layer.md
│   │   ├── error-handling.md
│   │   └── request-interceptors.md
│   └── deployment/
│       ├── cloudflare-pages.md
│       └── environment-config.md
│
├── 08-features/                        # Feature-specific documentation
│   ├── ai-assistant/
│   │   ├── overview.md
│   │   ├── conversation-management.md
│   │   ├── guided-acquisition.md
│   │   ├── prompt-engineering.md
│   │   ├── model-selection.md
│   │   └── cost-tracking.md
│   ├── zero-knowledge-vault/
│   │   ├── feature-overview.md
│   │   ├── master-password-setup.md
│   │   ├── encryption-flow.md
│   │   └── key-recovery.md
│   ├── project-management/
│   │   ├── feature-overview.md
│   │   ├── project-creation.md
│   │   ├── environment-management.md
│   │   └── secret-organization.md
│   ├── team-collaboration/
│   │   ├── feature-overview.md
│   │   ├── invitation-flow.md
│   │   ├── role-assignment.md
│   │   ├── approval-workflows.md
│   │   └── activity-feed.md
│   ├── audit-logs/
│   │   ├── feature-overview.md
│   │   ├── logging-spec.md
│   │   ├── export-formats.md
│   │   └── compliance-reports.md
│   ├── usage-tracking/                 # Post-MVP
│   │   ├── feature-overview.md
│   │   ├── cost-estimation.md
│   │   └── limit-warnings.md
│   ├── browser-extension/              # Post-MVP
│   │   ├── architecture.md
│   │   ├── autofill-implementation.md
│   │   ├── supported-sites.md
│   │   └── security-model.md
│   └── cli-tool/                       # Post-MVP
│       ├── architecture.md
│       ├── command-reference.md
│       ├── authentication.md
│       └── github-integration.md
│
├── 09-integrations/                    # External integrations
│   ├── mcp/
│   │   ├── mcp-overview.md
│   │   ├── server-architecture.md
│   │   ├── secrets-server-spec.md
│   │   ├── tools-reference.md
│   │   ├── authentication.md
│   │   └── audit-logging.md
│   ├── claude-code/
│   │   ├── integration-guide.md
│   │   ├── setup-instructions.md
│   │   ├── workflow-examples.md
│   │   └── troubleshooting.md
│   ├── cursor/
│   │   ├── integration-guide.md
│   │   ├── configuration.md
│   │   └── troubleshooting.md
│   ├── firecrawl/
│   │   ├── api-integration.md
│   │   ├── scraping-strategy.md
│   │   └── caching-policy.md
│   └── webhooks/
│       ├── webhook-system.md
│       ├── event-types.md
│       ├── security.md
│       └── retry-logic.md
│
├── 10-operations/                      # Operations and DevOps
│   ├── deployment/
│   │   ├── deployment-runbook.md
│   │   ├── staging-process.md
│   │   ├── production-process.md
│   │   ├── rollback-procedures.md
│   │   └── hotfix-process.md
│   ├── monitoring/
│   │   ├── monitoring-strategy.md
│   │   ├── cloudflare-analytics.md
│   │   ├── supabase-monitoring.md
│   │   ├── application-metrics.md
│   │   └── alerting-config.md
│   ├── incidents/
│   │   ├── incident-response.md
│   │   ├── severity-levels.md
│   │   ├── on-call-rotation.md
│   │   ├── communication-templates.md
│   │   └── post-mortem-template.md
│   ├── database/
│   │   ├── backup-procedures.md
│   │   ├── pitr-recovery.md
│   │   ├── performance-tuning.md
│   │   └── scaling-procedures.md
│   └── security/
│       ├── security-incident-response.md
│       ├── key-rotation-process.md
│       ├── breach-notification.md
│       └── forensics-guide.md
│
├── 11-development/                     # Developer experience
│   ├── local-setup.md
│   ├── prerequisites.md
│   ├── environment-variables.md
│   ├── running-locally.md
│   ├── troubleshooting.md
│   ├── testing/
│   │   ├── testing-strategy.md
│   │   ├── unit-testing.md
│   │   ├── integration-testing.md
│   │   ├── e2e-testing.md
│   │   ├── security-testing.md
│   │   └── test-data.md
│   ├── code-quality/
│   │   ├── code-review-checklist.md
│   │   ├── security-review.md
│   │   ├── performance-checklist.md
│   │   └── accessibility-guidelines.md
│   └── ci-cd/
│       ├── github-actions.md
│       ├── test-automation.md
│       ├── security-scanning.md
│       └── deployment-gates.md
│
└── 12-user-docs/                       # End-user documentation
    ├── getting-started/
    │   ├── account-creation.md
    │   ├── master-password-setup.md
    │   ├── first-project.md
    │   ├── adding-secrets.md
    │   └── inviting-team.md
    ├── features/
    │   ├── using-ai-assistant.md
    │   ├── managing-projects.md
    │   ├── team-collaboration.md
    │   └── audit-logs.md
    ├── integrations/
    │   ├── claude-code-setup.md
    │   ├── cursor-setup.md
    │   ├── browser-extension-setup.md
    │   └── cli-installation.md
    ├── security/
    │   ├── security-best-practices.md
    │   ├── enabling-2fa.md
    │   ├── key-rotation-guide.md
    │   └── incident-reporting.md
    ├── troubleshooting/
    │   ├── common-issues.md
    │   ├── mcp-connection-problems.md
    │   ├── encryption-errors.md
    │   └── contact-support.md
    └── api-reference/
        ├── rest-api.md
        ├── mcp-api.md
        └── webhooks-api.md
```

---

## Folder Naming Conventions

1. **Numbered prefixes (00-12):** Indicate logical order/dependencies
   - `00-admin` - Must read first
   - `01-product` - Understanding the vision
   - `02-architecture` - High-level system design
   - `03-security` - Foundation for everything
   - `04-database` - Data layer
   - `05-api` - Interface layer
   - `06-backend` - Server-side implementation
   - `07-frontend` - Client-side implementation
   - `08-features` - User-facing features
   - `09-integrations` - External systems
   - `10-operations` - Running in production
   - `11-development` - Developer workflows
   - `12-user-docs` - End-user help

2. **Kebab-case for all folders and files:** `feature-name.md`, not `Feature Name.md`

3. **Descriptive names:** Folder/file name should clearly indicate contents

4. **Group by domain:** Keep related docs together (all auth docs in `03-security/auth/`)

---

## File Placement Rules

### When to create a new folder:
- ✅ The component has 3+ related documents
- ✅ The component is a distinct service/system
- ✅ The domain is logically separate (e.g., security vs. frontend)

### When to use a single file:
- ✅ The topic is simple and self-contained
- ✅ The document is unlikely to grow beyond 500 lines
- ✅ There are no sub-topics that need separate docs

### Cross-referencing:
When referencing other docs, use relative paths:
```markdown
See [Database Schema](../04-database/schemas/secrets-metadata.md) for details.
```

---

## Special Folders

### `/00-admin/`
Contains meta-documentation about documentation itself. Only modify when changing doc processes.

### `/diagrams/` (within architecture folders)
- Use Mermaid (`.mmd`) for diagrams when possible (renders in GitHub)
- Use `.drawio` for complex diagrams
- Export `.png` versions for compatibility

### `/schemas/` (within API/database folders)
- JSON Schema files for API contracts
- SQL schema files for database structure
- OpenAPI specs for REST APIs

### `/migrations/` (within database folder)
- Actual SQL migration files
- Numbered sequentially: `001-initial-schema.sql`, `002-add-audit-logs.sql`

### `/postman/` (within API folder)
- Postman collections for API testing
- Environment files for different environments (dev/staging/prod)

---

## Migration Plan

To reorganize existing documents into this structure:

1. Create folder structure:
   ```bash
   mkdir -p 00-admin 01-product 02-architecture 03-security/auth 03-security/rbac 03-security/compliance
   mkdir -p 04-database/schemas 04-database/migrations
   mkdir -p 05-api/endpoints 05-api/schemas
   # ... etc
   ```

2. Move existing documents:
   ```bash
   mv abyrith-product-vision-strategy.md 01-product/product-vision-strategy.md
   mv "abyrith-team-playbook (1).md" 01-product/team-playbook.md
   mv "abyrith-technical-architecture (1).md" 02-architecture/system-overview.md
   ```

3. Update internal references in all documents to point to new paths

4. Update DOCUMENTATION-ROADMAP.md with new paths

5. Keep root-level docs minimal:
   - README.md (repo overview)
   - CLAUDE.md (for Claude Code)
   - DOCUMENTATION-ROADMAP.md (strategic checklist)
   - FOLDER-STRUCTURE.md (this file)
   - CHANGELOG.md (platform changes)
   - CONTRIBUTING.md (how to contribute)
   - GLOSSARY.md (shared terms)
   - ROADMAP.md (product roadmap)

---

## Benefits of This Structure

1. **Discoverability:** Easy to find all docs related to a component
2. **Maintainability:** Changes to a service only affect its folder
3. **Scalability:** Add new services without cluttering root
4. **Logical grouping:** Related docs are physically near each other
5. **Clear dependencies:** Numbered folders show build order
6. **Team alignment:** Each team can "own" their folder (frontend team owns `/07-frontend/`)

---

## Ownership Model

Each folder should have a clear owner (team or individual):

| Folder | Owner |
|--------|-------|
| `00-admin/` | Engineering Lead |
| `01-product/` | Product Lead |
| `02-architecture/` | Engineering Lead |
| `03-security/` | Security Lead / Engineering Lead |
| `04-database/` | Backend Team |
| `05-api/` | Backend Team |
| `06-backend/` | Backend Team |
| `07-frontend/` | Frontend Team |
| `08-features/` | Product + Engineering (shared) |
| `09-integrations/` | Integration Team / AI Team |
| `10-operations/` | DevOps / Engineering Lead |
| `11-development/` | Engineering Lead |
| `12-user-docs/` | Product + Technical Writer |

**Ownership means:**
- Responsible for keeping docs up-to-date
- Reviews PRs that modify docs in their folder
- Ensures consistency within their domain

---

## Next Steps

1. Create the folder structure (run the mkdir commands)
2. Move existing documents to appropriate locations
3. Update DOCUMENTATION-ROADMAP.md with new file paths
4. Update cross-references in all documents
5. Communicate new structure to team
6. Update CONTRIBUTING.md with folder structure guidelines

---

**Remember:** A well-organized documentation tree is like a well-organized codebase - it should be intuitive to navigate and easy to maintain.
