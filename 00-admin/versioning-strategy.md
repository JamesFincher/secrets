---
Document: Versioning Strategy
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Engineering Lead
Status: Approved
Dependencies: None
---

# Documentation Versioning Strategy

## Overview

This document defines the semantic versioning standards and version control practices for all documentation in the Abyrith project. Consistent versioning ensures clarity about document evolution, enables dependency tracking, and supports safe documentation updates across teams.

---

## Table of Contents

1. [Semantic Versioning Rules](#semantic-versioning-rules)
2. [Version Header Requirements](#version-header-requirements)
3. [Change Log Standards](#change-log-standards)
4. [Git Workflow for Versions](#git-workflow-for-versions)
5. [Deprecation Policy](#deprecation-policy)
6. [Version Compatibility](#version-compatibility)
7. [Examples](#examples)
8. [References](#references)

---

## Semantic Versioning Rules

All documentation follows **Semantic Versioning 2.0.0** adapted for documentation:

### Version Format: `MAJOR.MINOR.PATCH`

**Example:** `2.3.1`

- **MAJOR** = 2 (breaking changes)
- **MINOR** = 3 (new content)
- **PATCH** = 1 (fixes)

### When to Increment Each Version Number

#### MAJOR Version (X.0.0)

Increment MAJOR version when making **breaking changes** that invalidate previous implementations or require significant updates to dependent documents.

**Examples of MAJOR changes:**
- Complete document restructure or rewrite
- Architectural decisions that contradict previous version
- API endpoint changes that break backward compatibility
- Database schema changes requiring migrations
- Security model changes that require code refactoring
- Removing entire sections or features
- Changing fundamental assumptions or requirements

**Impact:** Teams using this document must review and update their work.

**Trigger phrases:** "breaking change," "complete rewrite," "architecture shift," "no longer valid"

---

#### MINOR Version (0.X.0)

Increment MINOR version when adding **new content** or expanding functionality without invalidating existing content.

**Examples of MINOR changes:**
- Adding new sections to existing document
- Documenting new features or capabilities
- Adding new endpoints to API documentation
- Expanding database schema with new tables (non-breaking)
- Adding new examples or use cases
- Adding new integrations or workflows
- Clarifying ambiguous content with substantial new information

**Impact:** Teams may want to review new capabilities but existing implementations remain valid.

**Trigger phrases:** "new section," "additional feature," "expanded coverage," "new capability"

---

#### PATCH Version (0.0.X)

Increment PATCH version for **minor fixes** and clarifications that don't change functionality or add new content.

**Examples of PATCH changes:**
- Typo corrections
- Grammar and spelling fixes
- Formatting improvements (headings, lists, spacing)
- Broken link fixes
- Code example formatting (no logic changes)
- Clarifying existing content (no new information)
- Updating dates or owner information
- Minor rewording for clarity

**Impact:** No action required. Changes are purely cosmetic or clarifying.

**Trigger phrases:** "typo fix," "clarification," "formatting," "minor update"

---

### Special Cases

#### Initial Version
- All new documents start at **`1.0.0`** when first approved
- Use **`0.1.0`** for draft documents (pre-approval)
- Use **`0.X.0`** for documents in review

#### Pre-Release Versions
For documents under active development:
- **`0.1.0`** = Initial draft
- **`0.2.0`** = Second draft
- **`0.X.0`** = Continue until approved
- **`1.0.0`** = First approved version

#### Status Alignment
Version increments should align with status changes:
- **Draft** → typically `0.X.0`
- **Review** → typically `0.X.0` or `1.0.0-rc1`
- **Approved** → **must** be `1.0.0` or higher
- **Deprecated** → marked in header, no version change

---

## Version Header Requirements

### Standard Version Header Template

Every documentation file **must** include this header at the top:

```markdown
---
Document: [Document Name]
Version: X.Y.Z
Last Updated: YYYY-MM-DD
Owner: [Team/Person]
Status: [Draft | Review | Approved | Deprecated]
Dependencies: [Comma-separated list of files]
---
```

### Field Specifications

#### Document
- **Format:** Plain English name (not filename)
- **Example:** `"Secrets Management API"` not `"api-endpoints-secrets.md"`
- **Purpose:** Human-readable document identification

#### Version
- **Format:** `MAJOR.MINOR.PATCH` (no `v` prefix)
- **Example:** `1.2.3` ✅ | `v1.2.3` ❌
- **Required:** Yes, always

#### Last Updated
- **Format:** `YYYY-MM-DD` (ISO 8601)
- **Example:** `2025-10-29`
- **Update:** Every time version changes

#### Owner
- **Format:** Team name or individual role
- **Examples:** `"Engineering Lead"`, `"Security Team"`, `"Product + Engineering"`
- **Purpose:** Who is responsible for maintaining this document

#### Status
- **Options:** `Draft`, `Review`, `Approved`, `Deprecated`
- **Rules:**
  - `Draft` = Work in progress, not ready for review
  - `Review` = Ready for team review, not yet approved
  - `Approved` = Official, can be used for implementation
  - `Deprecated` = No longer maintained, see replacement doc

#### Dependencies
- **Format:** Comma-separated list of filenames (relative to repo root)
- **Example:** `"03-security/security-model.md, 04-database/database-overview.md"`
- **Use "None"** if no dependencies
- **Purpose:** Tracks which documents must exist before this one

### Example Headers

**New draft document:**
```markdown
---
Document: AI Assistant Feature Specification
Version: 0.1.0
Last Updated: 2025-10-29
Owner: AI Engineer
Status: Draft
Dependencies: api-endpoints-secrets.md, arch-security-model.md
---
```

**Approved document:**
```markdown
---
Document: Database Schema Overview
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Lead
Status: Approved
Dependencies: None
---
```

**Updated document:**
```markdown
---
Document: REST API Design
Version: 2.1.3
Last Updated: 2025-11-15
Owner: Backend Team
Status: Approved
Dependencies: database-overview.md, auth-flow.md
---
```

**Deprecated document:**
```markdown
---
Document: Legacy Authentication Flow
Version: 1.4.2
Last Updated: 2025-09-01
Owner: Backend Team
Status: Deprecated
Dependencies: None
---

**DEPRECATED:** This document has been replaced by `03-security/auth/authentication-flow.md`. Please refer to the new document for current authentication flows.
```

---

## Change Log Standards

### Change Log Location

Every document **must** include a change log section at the **bottom of the document** (before References section).

### Change Log Format

```markdown
## Change Log

| Version | Date       | Author      | Changes                                      |
|---------|------------|-------------|----------------------------------------------|
| 1.2.1   | 2025-11-15 | Jane Smith  | Fixed typos in authentication section        |
| 1.2.0   | 2025-11-10 | John Doe    | Added OAuth 2.0 provider setup instructions  |
| 1.1.0   | 2025-11-01 | Jane Smith  | Added MFA implementation section             |
| 1.0.0   | 2025-10-29 | John Doe    | Initial approved version                     |
| 0.2.0   | 2025-10-25 | John Doe    | Second draft with security review feedback   |
| 0.1.0   | 2025-10-20 | John Doe    | Initial draft                                |
```

### Change Log Rules

1. **Newest entries first** (reverse chronological order)
2. **Include all versions** (don't delete old entries)
3. **Be specific** about changes (not just "updates" or "changes")
4. **Use active voice** ("Added MFA section" not "MFA section was added")
5. **Reference version rules** (MAJOR/MINOR/PATCH aligned with change description)

### Change Description Guidelines

**Good change descriptions:**
- ✅ `"Added database migration procedures section"`
- ✅ `"Fixed typos in API endpoint examples"`
- ✅ `"Restructured security model for zero-trust architecture (breaking change)"`
- ✅ `"Updated Supabase version from 2.38.0 to 2.40.1"`

**Bad change descriptions:**
- ❌ `"Updates"`
- ❌ `"Various changes"`
- ❌ `"Fixed stuff"`
- ❌ `"Modified document"`

---

## Git Workflow for Versions

### Branch Strategy

**Main branch:** `main`
- Contains only **Approved** documents
- All documents on `main` must be version `1.0.0` or higher
- Protected branch (requires PR + review)

**Feature branches:** `docs/[feature-name]`
- For creating new documents or updating existing ones
- Example: `docs/add-mcp-integration`, `docs/update-security-model`
- Can contain Draft/Review status documents

**Review branches:** `review/[document-name]`
- For documents in Review status
- Example: `review/api-endpoints-secrets`

### Git Commit Messages for Documentation

Follow this format:

```
docs(scope): verb description [version bump]

Examples:
- docs(security): add encryption specification [MINOR]
- docs(api): fix typo in endpoint examples [PATCH]
- docs(architecture): restructure system overview [MAJOR]
- docs(admin): create versioning strategy [MAJOR]
```

**Scope options:** `admin`, `security`, `database`, `api`, `backend`, `frontend`, `features`, `integrations`, `operations`, `development`, `user-docs`

**Version bump indicators:**
- `[MAJOR]` - Breaking changes, complete rewrites
- `[MINOR]` - New sections, features
- `[PATCH]` - Typos, clarifications

### Git Tags for Documentation Releases

**Tagging conventions:**

For **platform-wide documentation releases** (milestones):
```bash
git tag -a docs-v1.0.0 -m "Phase 0: Admin & Core Documentation Complete"
git push origin docs-v1.0.0
```

For **individual document major versions** (optional, for critical docs):
```bash
git tag -a security-model-v2.0.0 -m "Security model v2.0.0: Zero-trust architecture"
git push origin security-model-v2.0.0
```

**Tag naming:**
- Platform releases: `docs-v[VERSION]`
- Document releases: `[doc-slug]-v[VERSION]`

**When to tag:**
- End of each documentation phase (Phase 0, Phase 1, etc.)
- Major version bumps for critical documents (security, architecture)
- Before large refactoring efforts (create tag as restore point)

### Pull Request Process

**PR Title Format:**
```
docs: [scope] description (version X.Y.Z → X.Y.Z)

Examples:
- docs: [security] add MFA implementation guide (1.2.0 → 1.3.0)
- docs: [api] fix endpoint typos (2.1.1 → 2.1.2)
- docs: [architecture] restructure system overview (1.5.2 → 2.0.0)
```

**PR Description Template:**
```markdown
## Document(s) Updated
- `03-security/auth/mfa-implementation.md`

## Version Change
- **Previous:** 1.2.0
- **New:** 1.3.0
- **Type:** MINOR (added new section)

## Summary of Changes
- Added biometric authentication section
- Expanded TOTP setup instructions
- Added troubleshooting guide

## Dependencies Checked
- [x] All dependency documents exist
- [x] No breaking changes to dependent documents
- [x] Cross-references updated

## Checklist
- [x] Version header updated
- [x] Change log updated
- [x] Last Updated date changed
- [x] No typos or formatting issues
- [x] Links tested and working
```

### Merge Requirements

Before merging documentation PRs:

1. ✅ **Version header updated** (Version + Last Updated)
2. ✅ **Change log entry added**
3. ✅ **Status appropriate** (Approved for main branch)
4. ✅ **Dependencies verified** (all listed docs exist)
5. ✅ **At least one reviewer approval**
6. ✅ **All comments resolved**
7. ✅ **CI checks pass** (link validation, spell check)

---

## Deprecation Policy

### When to Deprecate Documents

Deprecate documents when:
- Document content is obsolete or superseded
- Architecture or technology has fundamentally changed
- Document has been split into multiple new documents
- Feature has been removed from product roadmap

### Deprecation Process

#### Step 1: Mark Document as Deprecated

Update version header:
```markdown
---
Document: Legacy Authentication Flow
Version: 1.4.2
Last Updated: 2025-09-01
Owner: Backend Team
Status: Deprecated
Dependencies: None
---
```

Add deprecation notice at top of document:
```markdown
---
[Version Header]
---

⚠️ **DEPRECATED**

This document has been deprecated as of 2025-09-01 and is no longer maintained.

**Replacement:** See `03-security/auth/authentication-flow.md` for current authentication documentation.

**Reason:** Authentication flow redesigned for OAuth 2.0 standard compliance.

**Migration:** Follow the migration guide in `03-security/auth/migration-guide.md`.

---

[Rest of document content remains for historical reference]
```

#### Step 2: Update Dependent Documents

Find all documents that depend on deprecated document:
```bash
grep -r "Dependencies:.*legacy-auth-flow.md" --include="*.md"
```

Update dependencies to reference new document(s).

#### Step 3: Add Deprecation to CHANGELOG.md

```markdown
## [2025-09-01] - Deprecations

### Deprecated
- **`03-security/legacy-auth-flow.md`** - Replaced by `03-security/auth/authentication-flow.md`
  - Reason: OAuth 2.0 standard compliance
  - Migration guide: `03-security/auth/migration-guide.md`
```

#### Step 4: Retention Period

**Retention rules:**
- Keep deprecated docs for **6 months** minimum
- After 6 months, move to `archive/` folder (do not delete)
- Archived docs remain in Git history forever

**Archive structure:**
```
archive/
  2025/
    03-security/
      legacy-auth-flow.md
```

### Deprecation Labels

Use clear labels in filenames for archived docs:
```
archive/2025/03-security/legacy-auth-flow-DEPRECATED-2025-09-01.md
```

---

## Version Compatibility

### Dependency Version Tracking

When Document A depends on Document B, track compatible versions.

#### Implicit Version Dependencies

By default, dependencies reference **latest approved version** of dependent document.

```markdown
Dependencies: 03-security/security-model.md
```
This means: "Compatible with current approved version of security-model.md"

#### Explicit Version Dependencies (Advanced)

For critical dependencies, specify exact version compatibility:

```markdown
Dependencies: 03-security/security-model.md@2.1.0
```

This means: "Requires security-model.md version 2.1.0 or higher"

**Use explicit versions when:**
- Dependent document has breaking changes
- Implementation code references specific version
- Compliance requires version tracking

### Breaking Change Propagation

When a document has a **MAJOR version bump** (breaking change):

1. **Identify dependent documents:**
   ```bash
   grep -r "Dependencies:.*[document-name]" --include="*.md"
   ```

2. **Review each dependent document** for compatibility

3. **Update or bump versions** of affected documents

4. **Document the cascade** in change log:
   ```markdown
   | 2.0.0 | 2025-11-15 | Team | Updated for security-model.md v3.0.0 breaking changes |
   ```

### Version Compatibility Matrix

For complex multi-document features, create compatibility matrix:

**Example: Authentication System Compatibility**

| Auth Flow | Security Model | Database Schema | API Endpoints | Status     |
|-----------|----------------|-----------------|---------------|------------|
| 2.0.x     | 3.0.x          | 2.1.x           | 2.0.x         | Current    |
| 1.5.x     | 2.4.x          | 2.0.x           | 1.8.x         | Legacy     |
| 1.0.x     | 1.x.x          | 1.x.x           | 1.0.x         | Deprecated |

Include this matrix in high-level overview documents.

---

## Examples

### Example 1: Typo Fix (PATCH)

**Scenario:** Found typos in database schema documentation.

**Before:**
```markdown
---
Document: Database Schema Overview
Version: 1.2.0
Last Updated: 2025-10-15
---
```

**After:**
```markdown
---
Document: Database Schema Overview
Version: 1.2.1
Last Updated: 2025-10-29
---
```

**Change Log Entry:**
```markdown
| 1.2.1 | 2025-10-29 | Jane Smith | Fixed typos in table name examples |
```

**Git Commit:**
```bash
git commit -m "docs(database): fix typos in schema examples [PATCH]"
```

---

### Example 2: Adding New Section (MINOR)

**Scenario:** Adding new section about database indexes to existing schema doc.

**Before:**
```markdown
---
Document: Secrets Schema
Version: 1.1.0
Last Updated: 2025-10-20
---

## Tables
[existing content]
```

**After:**
```markdown
---
Document: Secrets Schema
Version: 1.2.0
Last Updated: 2025-10-29
---

## Tables
[existing content]

## Indexes
[new content about database indexes]
```

**Change Log Entry:**
```markdown
| 1.2.0 | 2025-10-29 | John Doe | Added database indexes section with performance guidelines |
```

**Git Commit:**
```bash
git commit -m "docs(database): add indexes section to secrets schema [MINOR]"
```

---

### Example 3: Breaking Architectural Change (MAJOR)

**Scenario:** Complete rewrite of security model from single-key to envelope encryption.

**Before:**
```markdown
---
Document: Security Model
Version: 1.5.3
Last Updated: 2025-09-15
Status: Approved
---

## Encryption Approach
Single master key for all secrets...
```

**After:**
```markdown
---
Document: Security Model
Version: 2.0.0
Last Updated: 2025-10-29
Status: Approved
---

## Encryption Approach
Envelope encryption with per-secret data keys...

⚠️ **BREAKING CHANGE:** This version introduces envelope encryption, which is incompatible with v1.x implementations. See migration guide in change log.
```

**Change Log Entry:**
```markdown
| 2.0.0 | 2025-10-29 | Security Team | Complete rewrite for envelope encryption architecture (BREAKING CHANGE) |
| 1.5.3 | 2025-09-15 | Jane Smith    | Fixed clarifications in key rotation section |
```

**Git Commit:**
```bash
git commit -m "docs(security): restructure security model for envelope encryption [MAJOR]"
```

**Git Tag:**
```bash
git tag -a security-model-v2.0.0 -m "Security Model v2.0.0: Envelope Encryption Architecture"
git push origin security-model-v2.0.0
```

**Update Dependent Documents:**
```bash
# Find all dependent documents
grep -r "Dependencies:.*security-model.md" --include="*.md"

# Update each dependent document to reference v2.0.0
# Update their versions accordingly (likely MINOR or MAJOR bumps)
```

---

### Example 4: Document Deprecation

**Scenario:** Legacy authentication flow replaced by OAuth 2.0 standard.

**Before:**
```markdown
---
Document: Legacy Authentication Flow
Version: 1.4.2
Last Updated: 2025-08-01
Owner: Backend Team
Status: Approved
---
```

**After:**
```markdown
---
Document: Legacy Authentication Flow
Version: 1.4.2
Last Updated: 2025-09-01
Owner: Backend Team
Status: Deprecated
---

⚠️ **DEPRECATED**

This document has been deprecated as of 2025-09-01.

**Replacement:** `03-security/auth/authentication-flow.md`

**Reason:** OAuth 2.0 standard compliance and improved security model.

**Migration Guide:** See `03-security/auth/migration-guide.md` for step-by-step migration instructions.

---

[Original content remains for historical reference]
```

**CHANGELOG.md Entry:**
```markdown
## [2025-09-01] - Deprecations

### Deprecated
- **`03-security/legacy-auth-flow.md` (v1.4.2)** - Replaced by OAuth 2.0 standard authentication
  - **New document:** `03-security/auth/authentication-flow.md`
  - **Migration guide:** `03-security/auth/migration-guide.md`
  - **Retention:** Will be archived on 2026-03-01 (6 months)
```

**Git Commit:**
```bash
git commit -m "docs(security): deprecate legacy-auth-flow.md, replaced by OAuth 2.0 flow [MAJOR]"
```

---

### Example 5: Multi-Document Feature Release

**Scenario:** Completing Phase 1 (Security & Auth documentation) with multiple new documents.

**Documents created:**
- `03-security/security-model.md` (v1.0.0)
- `03-security/encryption-specification.md` (v1.0.0)
- `03-security/auth/authentication-flow.md` (v1.0.0)
- `03-security/auth/oauth-setup.md` (v1.0.0)
- `03-security/rbac/permissions-model.md` (v1.0.0)

**Git Tag for Phase:**
```bash
git tag -a docs-v1.0.0-phase1 -m "Phase 1: Security & Auth Documentation Complete"
git push origin docs-v1.0.0-phase1
```

**CHANGELOG.md Entry:**
```markdown
## [2025-10-29] - Phase 1: Security & Auth

### Added
- **Security Model** (`03-security/security-model.md` v1.0.0) - Zero-knowledge encryption architecture
- **Encryption Specification** (`03-security/encryption-specification.md` v1.0.0) - AES-256-GCM implementation details
- **Authentication Flow** (`03-security/auth/authentication-flow.md` v1.0.0) - Supabase Auth integration
- **OAuth Setup** (`03-security/auth/oauth-setup.md` v1.0.0) - OAuth provider configurations
- **Permissions Model** (`03-security/rbac/permissions-model.md` v1.0.0) - RBAC and RLS policies

### Milestone
- ✅ Phase 1 Complete: Security foundation established for all future development
```

---

## References

### Related Documents
- **DOCUMENTATION-ROADMAP.md** - Documentation creation phases and dependencies
- **CONTRIBUTING.md** - How to contribute to documentation (to be created)
- **00-admin/document-templates.md** - Templates for new documents (to be created)
- **00-admin/review-process.md** - Documentation review workflow (to be created)

### External Standards
- **Semantic Versioning 2.0.0** - https://semver.org/
- **ISO 8601 Date Format** - https://www.iso.org/iso-8601-date-and-time-format.html
- **Git Tagging Best Practices** - https://git-scm.com/book/en/v2/Git-Basics-Tagging

### Tools
- **Markdown Linters** - For validating document formatting
- **Git Hooks** - For enforcing version header requirements
- **Link Checkers** - For validating internal/external links

---

## Change Log

| Version | Date       | Author            | Changes                 |
|---------|------------|-------------------|-------------------------|
| 1.0.0   | 2025-10-29 | Engineering Lead  | Initial approved version |
