# Changelog

All notable changes to the Abyrith platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phase 0 core documentation (CRITICAL foundation documents)
- Comprehensive glossary with 165 technical terms and definitions (GLOSSARY.md)
- Contributing guidelines with PR process and documentation standards (CONTRIBUTING.md)
- Product roadmap with MVP and post-MVP features across 5 phases (ROADMAP.md)
- Changelog tracking system following Keep a Changelog standard (this file)
- Complete folder structure with 12 numbered directories (00-admin through 12-user-docs)
- Administrative documentation templates and processes:
  - Versioning strategy with semantic versioning rules (00-admin/versioning-strategy.md)
  - Document templates for 6 common document types (00-admin/document-templates.md)
  - Review process with checklists and approval gates (00-admin/review-process.md)
  - Tool documentation template (00-admin/tool-documentation-template.md)
- GitHub repository configuration:
  - CODEOWNERS file with folder ownership assignments (.github/CODEOWNERS)
  - Pull request template with phase tracking (.github/pull_request_template.md)
  - Issue templates for documentation management (.github/ISSUE_TEMPLATE/)
  - GitHub Actions workflow for documentation validation (.github/workflows/docs-validation.yml)
  - Repository setup compliance report (GITHUB-SETUP-REPORT.md)
- Phase 1 security documentation (Authentication & Threat Modeling):
  - Authentication flow architecture with dual-password system (03-security/auth/authentication-flow.md)
  - OAuth provider integration guide covering Google and GitHub OAuth setup, configuration, implementation, error handling, and security considerations while maintaining zero-knowledge architecture (03-security/auth/oauth-setup.md)
  - Password reset architecture defining account password reset, master password implications, recovery key mechanism, and secret re-encryption flows while maintaining zero-knowledge guarantees (03-security/auth/password-reset.md)
  - Comprehensive threat model with 7 threat categories, attack scenarios, and risk assessment (03-security/threat-model.md)
  - Detailed encryption specification with AES-256-GCM, PBKDF2, and Web Crypto API implementation (03-security/encryption-specification.md)
  - Zero-knowledge security model architecture with complete cryptographic specifications, data flows, threat analysis, and security controls (03-security/security-model.md)
  - Zero-knowledge architecture design explaining client-server trust boundaries, master password handling, server limitations, recovery mechanisms, and "5-year-old simple" explanations (03-security/zero-knowledge-architecture.md)
  - Row-Level Security (RLS) policies for PostgreSQL with complete policy definitions for all tables (organizations, projects, environments, secrets, audit_logs), multi-tenancy enforcement, performance optimization strategies, testing procedures, and debugging guides (03-security/rbac/rls-policies.md)
  - Permissions model architecture defining role-based access control with 4 roles (Owner, Admin, Developer, Read-Only), granular permissions, inheritance model, API and database enforcement, permission evaluation logic, and comprehensive security controls (03-security/rbac/permissions-model.md)
  - Session management architecture specifying JWT token lifecycle (1 hour access, 30 day refresh), automatic token refresh strategy (15 minutes before expiration), token storage (sessionStorage + httpOnly cookies), master key lifecycle in memory and encrypted IndexedDB backup, concurrent session handling, logout propagation, inactivity timeout, and security controls for XSS/CSRF protection (03-security/auth/session-management.md)
  - Multi-factor authentication (MFA) implementation with TOTP support (Google Authenticator, Authy, 1Password compatible), QR code enrollment flow, backup code generation and redemption with bcrypt hashing, organization-wide MFA enforcement policies with grace periods, recovery mechanisms for lost devices, and complete integration with Supabase Auth MFA capabilities (03-security/auth/mfa-implementation.md)
  - Role definitions architecture specifying 4 standard roles (Owner, Admin, Developer, Read-Only) with complete capability descriptions, permission mappings, role hierarchy, assignment rules at organization and project levels, role change workflows, and future custom role architecture for enterprise (03-security/rbac/role-definitions.md)

### Changed
- Reorganized existing documents into proper folder structure:
  - Moved product-vision-strategy.md to 01-product/
  - Moved team-playbook.md to 01-product/
  - Moved system-overview.md to 02-architecture/
- Fixed ROADMAP.md timeline errors (changed Q1-Q4 2025 MVP dates to 2026)

### Fixed
- Corrected impossible timeline in ROADMAP.md (MVP now correctly scheduled for Q1 2026)
- **CRITICAL SECURITY FIX:** Updated PBKDF2 iterations from 100,000 to 600,000 in security-model.md to align with OWASP 2023 recommendations and maintain consistency across all security documentation
- Removed spaces and "(1)" from filenames for proper naming conventions
- Updated all cross-references to point to new file locations

## [0.1.0] - 2025-10-29

### Added
- Initial documentation structure and repository setup
- Product vision and strategy document (now at 01-product/product-vision-strategy.md)
- Technical architecture overview (now at 02-architecture/system-overview.md)
- Team playbook for operational guidelines (now at 01-product/team-playbook.md)
- Tech stack specification with detailed tool selections (TECH-STACK.md)
- Documentation roadmap outlining Phase 0-4 deliverables (DOCUMENTATION-ROADMAP.md)
- Folder structure specification for repository organization (FOLDER-STRUCTURE.md)
- Quick start guide for onboarding (QUICK-START.md)
- Claude Code optimization guides and best practices (CLAUDE.md)
- Documentation alignment checklist for consistency (DOC-ALIGNMENT-CHECKLIST.md)
- Administrative tools directory (00-admin/) with documentation templates
- Tool documentation template for standardized tool specs
- README with project overview and navigation
- Git repository initialization with .gitignore
- Semantic versioning and changelog standards
