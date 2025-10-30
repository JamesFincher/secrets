---
Document: Abyrith Glossary
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Product + Engineering
Status: Draft
Dependencies: None
---

# Abyrith Glossary

## Overview

This glossary defines all technical terms, acronyms, and Abyrith-specific concepts used throughout the platform documentation and codebase. Terms are organized into logical sections and alphabetized within each section for easy reference.

**Purpose:** Ensure consistent terminology across all documentation and provide beginner-friendly definitions for all technical concepts.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Security & Encryption](#security--encryption)
3. [Authentication & Authorization](#authentication--authorization)
4. [Technologies & Services](#technologies--services)
5. [Database & Data](#database--data)
6. [API & Integration](#api--integration)
7. [Development & Operations](#development--operations)
8. [User Roles & Permissions](#user-roles--permissions)
9. [Personas & Use Cases](#personas--use-cases)
10. [Abyrith-Specific Terms](#abyrith-specific-terms)

---

## Core Concepts

### AI-Native
A design philosophy where AI is not just a feature but the foundational interface and orchestration layer of the platform. Users interact primarily through conversational AI rather than traditional UI elements.

### API Key
A unique identifier used to authenticate requests to an API (Application Programming Interface). Also called a "secret" or "developer key." In Abyrith, API keys are stored with zero-knowledge encryption.

### Client-Side Encryption
The process of encrypting data in the user's browser or device before it is transmitted to the server. This ensures the server never has access to unencrypted data. See also: [Zero-Knowledge Encryption](#zero-knowledge-encryption)

### Developer Secrets
Sensitive credentials used in software development, including API keys, passwords, database connection strings, and access tokens. Abyrith specializes in managing these securely.

### Edge Computing
Running code and storing data closer to end users (at the "edge" of the network) for faster performance. Abyrith uses Cloudflare's edge network for global distribution.

### Environment
A distinct deployment context for an application, such as Development, Staging, or Production. Each environment typically has its own set of secrets to prevent production credentials from being used in testing.

### Envelope Encryption
A security technique where data is encrypted with a data key, and that data key is then encrypted with a master key. This allows for efficient key rotation and enhanced security.

### MCP (Model Context Protocol)
An open standard developed by Anthropic that allows AI assistants like Claude Code to safely interact with external tools and services. Abyrith implements an MCP server to provide secrets to AI development tools.

### Master Password
A user-created password that is used to derive the encryption key for all their secrets. The master password never leaves the user's device and is not stored by Abyrith.

### Project
A logical grouping of related secrets and environments in Abyrith. For example, "RecipeApp" might be a project containing secrets for development, staging, and production environments.

### Secret
In Abyrith, a "secret" is any sensitive credential (API key, token, password) that needs to be stored securely. Secrets are always encrypted client-side before being stored.

### Zero-Knowledge Architecture
A security model where the service provider (Abyrith) has no ability to access or decrypt user data, even if they wanted to. Only the user, with their master password, can decrypt their secrets.

---

## Security & Encryption

### 2FA (Two-Factor Authentication)
An additional security layer requiring users to provide two forms of identification before accessing their account. Typically combines something you know (password) with something you have (phone app code). Also called MFA (Multi-Factor Authentication).

### AES-256-GCM
Advanced Encryption Standard with 256-bit keys using Galois/Counter Mode. This is a highly secure encryption algorithm that provides both confidentiality and authenticity. Used by Abyrith for encrypting secrets.

### Audit Log
A chronological record of all actions taken within a system, including who did what and when. Used for security monitoring, compliance, and debugging.

### Audit Trail
See [Audit Log](#audit-log). A complete history of access and changes to sensitive data, essential for compliance and security investigations.

### CORS (Cross-Origin Resource Sharing)
A security feature that controls which websites can make requests to your API. Prevents unauthorized websites from accessing your data.

### CSP (Content Security Policy)
HTTP headers that help prevent cross-site scripting (XSS) and other code injection attacks by specifying which sources of content are trusted.

### DDoS (Distributed Denial of Service)
A cyber attack that attempts to overwhelm a service with traffic, making it unavailable. Cloudflare provides automatic DDoS protection for Abyrith.

### GDPR (General Data Protection Regulation)
European Union regulation on data protection and privacy. Abyrith is designed to be GDPR-compliant with features for data export, deletion, and user consent.

### HMAC (Hash-based Message Authentication Code)
A cryptographic technique used to verify data integrity and authenticity. Used by Abyrith for webhook signatures.

### HTTPS (HTTP Secure)
The secure version of HTTP, encrypting all data transmitted between browser and server using TLS/SSL.

### ISO 27001
An international standard for information security management systems (ISMS). Enterprise customers may require ISO 27001 certification.

### IV (Initialization Vector)
A random value used in encryption to ensure that encrypting the same data multiple times produces different encrypted outputs. Also called a "nonce."

### JWT (JSON Web Token)
A compact, URL-safe token format used for authentication. Contains user identity and permissions, digitally signed to prevent tampering. Used by Supabase Auth in Abyrith.

### Key Derivation
The process of generating an encryption key from a password using algorithms like PBKDF2. Makes passwords suitable for cryptographic operations.

### Key Rotation
The practice of periodically changing encryption keys or API keys to limit the impact of potential compromises. Abyrith reminds users to rotate keys regularly.

### Nonce
See [IV (Initialization Vector)](#iv-initialization-vector). A "number used once" in cryptographic operations to ensure uniqueness.

### OAuth 2.0
An authorization framework that allows third-party services to access user data without sharing passwords. Used for "Sign in with Google" and similar flows.

### PBKDF2 (Password-Based Key Derivation Function 2)
An algorithm that converts passwords into encryption keys through many iterations of hashing, making brute-force attacks computationally expensive.

### Principle of Least Privilege
A security principle stating that users and services should only have the minimum permissions necessary to perform their tasks.

### RLS (Row-Level Security)
A database security feature that restricts which rows a user can access in a table. Used extensively in Abyrith to enforce multi-tenancy and data isolation.

### SAML (Security Assertion Markup Language)
A standard for enterprise single sign-on (SSO). Allows employees to use their corporate credentials to access Abyrith.

### SOC 2 (Service Organization Control 2)
A compliance framework for service providers storing customer data. Demonstrates security, availability, and confidentiality controls.

### SSL/TLS (Secure Sockets Layer / Transport Layer Security)
Cryptographic protocols that provide secure communication over networks. TLS 1.3 is the current standard used by Abyrith.

### WAF (Web Application Firewall)
A security system that filters and monitors HTTP traffic to protect web applications from attacks. Provided by Cloudflare for Abyrith.

### XSS (Cross-Site Scripting)
A security vulnerability where attackers inject malicious scripts into web pages. Abyrith prevents XSS through CSP headers and React's built-in escaping.

---

## Authentication & Authorization

### Authentication
The process of verifying who a user is (proving identity), typically through passwords, OAuth, or biometrics.

### Authorization
The process of determining what a user is allowed to do after they've been authenticated (checking permissions).

### Magic Link
A passwordless authentication method where users receive a one-time login link via email. Supported by Supabase Auth.

### Master Key
See [Master Password](#master-password). The key used to decrypt all of a user's secrets, derived from their master password.

### MFA (Multi-Factor Authentication)
See [2FA (Two-Factor Authentication)](#2fa-two-factor-authentication).

### OAuth Provider
A service like Google, GitHub, or Microsoft that handles user authentication using the OAuth 2.0 protocol.

### RBAC (Role-Based Access Control)
A security model that assigns permissions based on user roles (Owner, Admin, Developer, Read-Only) rather than to individual users.

### Session
A period of authenticated activity. In Abyrith, sessions are managed using JWT tokens with automatic refresh.

### SSO (Single Sign-On)
A system that allows users to authenticate once and access multiple applications. Enterprise feature for Abyrith.

### Token
A piece of data used to prove authentication. JWTs are tokens that contain user identity and permissions.

### TOTP (Time-based One-Time Password)
A method of generating temporary authentication codes (like Google Authenticator). Used for 2FA in Abyrith.

---

## Technologies & Services

### Anthropic
The company that created Claude AI. Abyrith uses Claude API for its AI assistant and developed MCP integration for Claude Code.

### Cloudflare
A cloud platform providing CDN, DDoS protection, Workers (serverless functions), and Pages (hosting). Primary infrastructure provider for Abyrith.

### Cloudflare Pages
Static site hosting with support for server-side rendering and edge functions. Hosts the Abyrith frontend.

### Cloudflare Workers
Serverless JavaScript functions that run on Cloudflare's edge network with zero cold starts. Used for Abyrith's API gateway and custom logic.

### Cloudflare Workers KV
A global, low-latency key-value store for caching data at the edge.

### Claude API
Anthropic's API for accessing Claude AI models (Haiku, Sonnet, Opus, Extended Thinking). Powers Abyrith's AI assistant.

### Claude Code
An AI-powered development tool from Anthropic that integrates with IDEs and can request secrets via MCP.

### Cursor
An AI-powered code editor that supports MCP integration with Abyrith.

### Deno
A secure runtime for JavaScript and TypeScript. Used by Supabase Edge Functions.

### ESLint
A JavaScript linting tool that identifies code quality issues and enforces coding standards.

### FireCrawl
A web scraping service that converts websites to markdown. Used by Abyrith to fetch latest API documentation for the AI assistant.

### GitHub Actions
An automation platform for CI/CD workflows. Used for testing, building, and deploying Abyrith.

### Husky
A tool for running scripts on Git hooks (like pre-commit checks).

### Lucide React
An icon library providing clean, customizable icons for React applications.

### MCP Server
A server implementation of the Model Context Protocol that exposes tools for AI assistants to use.

### MSW (Mock Service Worker)
A tool for mocking API requests in tests.

### Next.js
A React framework with server-side rendering, static generation, and excellent developer experience. Powers the Abyrith frontend.

### Node.js
A JavaScript runtime for server-side applications. Used for development tooling and MCP server.

### Playwright
A modern browser automation tool for end-to-end testing.

### pnpm
A fast, disk-efficient package manager for JavaScript projects.

### PostgREST
A tool that automatically generates a RESTful API from a PostgreSQL database schema. Built into Supabase.

### PostgreSQL
A powerful open-source relational database. The foundation of Supabase and Abyrith's data layer.

### Prettier
An opinionated code formatter that ensures consistent code style.

### Radix UI
A library of unstyled, accessible UI components. Used via shadcn/ui in Abyrith.

### React
A JavaScript library for building user interfaces. The foundation of Abyrith's frontend.

### React Hook Form
A library for performant form handling in React.

### React Query (TanStack Query)
A library for managing server state, caching, and background data fetching in React applications.

### Sentry
An error tracking and performance monitoring service.

### shadcn/ui
A collection of accessible, customizable React components built on Radix UI and Tailwind CSS. Uses a copy-paste approach rather than package dependency.

### Supabase
An open-source Firebase alternative providing PostgreSQL database, authentication, real-time subscriptions, and storage. Primary backend service for Abyrith.

### Supabase Auth
Built-in authentication service supporting email/password, OAuth, magic links, and MFA.

### Supabase Realtime
WebSocket-based system for real-time database subscriptions and updates.

### Tailwind CSS
A utility-first CSS framework for rapid UI development.

### TypeScript
A typed superset of JavaScript that catches errors during development. Used throughout Abyrith codebase.

### Vitest
A fast testing framework powered by Vite, compatible with Jest API.

### Web Crypto API
A browser API providing cryptographic operations like encryption, hashing, and key generation. Used for client-side encryption in Abyrith.

### Zod
A TypeScript-first schema validation library used for form validation and API contracts.

### Zustand
A lightweight state management library for React.

---

## Database & Data

### ACID
A set of database transaction properties: Atomicity, Consistency, Isolation, Durability. PostgreSQL is ACID-compliant.

### Connection Pooling
Reusing database connections to improve performance. Supabase uses PgBouncer for connection pooling.

### Database Migration
A version-controlled change to the database schema. Allows teams to evolve database structure safely.

### Foreign Key
A database constraint that creates a relationship between tables, ensuring data integrity.

### Index
A database structure that speeds up data retrieval. Like an index in a book, it helps find data quickly.

### JSONB
PostgreSQL's binary JSON data type, allowing flexible schemas while maintaining query performance.

### Multi-Tenancy
An architecture where a single instance of software serves multiple customers (tenants), keeping their data isolated.

### PgBouncer
A connection pooler for PostgreSQL that manages database connections efficiently.

### Point-in-Time Recovery (PITR)
The ability to restore a database to any specific moment in time, useful for recovering from data corruption.

### Primary Key
A unique identifier for each row in a database table. Abyrith uses UUIDs for primary keys.

### Schema
The structure of a database, including tables, columns, relationships, and constraints.

### SQL (Structured Query Language)
The standard language for interacting with relational databases like PostgreSQL.

### UUID (Universally Unique Identifier)
A 128-bit identifier that's globally unique. Used for primary keys in Abyrith to prevent enumeration attacks.

---

## API & Integration

### API (Application Programming Interface)
A set of rules and protocols that allows different software applications to communicate with each other.

### API Endpoint
A specific URL path where an API can be accessed to perform operations (e.g., `/secrets` or `/projects/:id`).

### API Gateway
A server that acts as a single entry point for API requests, handling routing, authentication, and rate limiting.

### CI/CD (Continuous Integration / Continuous Deployment)
Automated processes for testing code (CI) and deploying it to production (CD).

### GraphQL
A query language for APIs that allows clients to request exactly the data they need. (Note: Abyrith uses REST, not GraphQL)

### HTTP Methods
Standard operations in REST APIs: GET (retrieve), POST (create), PUT (update), DELETE (remove), PATCH (partial update).

### Rate Limiting
Restricting the number of API requests a user can make in a time period to prevent abuse and ensure fair usage.

### REST (Representational State Transfer)
An architectural style for building APIs using standard HTTP methods and status codes.

### Status Code
Numeric codes indicating the result of an HTTP request (e.g., 200 = success, 404 = not found, 500 = server error).

### Webhook
A way for one application to send real-time data to another when an event occurs. Abyrith can send webhooks for secret access events.

### WebSocket
A protocol for two-way communication between browser and server. Used by Supabase Realtime for live updates.

---

## Development & Operations

### Blue-Green Deployment
A deployment strategy where you maintain two identical environments (blue and green), allowing zero-downtime deployments.

### Boilerplate
Standard, repetitive code that can be reused across projects.

### Branch Protection
Git/GitHub rules that prevent direct commits to important branches, requiring pull requests and reviews.

### Build
The process of converting source code into executable software.

### Cache Invalidation
The process of removing outdated data from a cache so fresh data is retrieved.

### CDN (Content Delivery Network)
A geographically distributed network of servers that delivers content faster by serving it from locations closer to users.

### Cold Start
The delay when a serverless function runs for the first time. Cloudflare Workers have zero cold starts.

### DX (Developer Experience)
How enjoyable and efficient it is to work with a tool, framework, or platform.

### E2E Testing (End-to-End Testing)
Testing an entire application flow from start to finish, simulating real user scenarios.

### Hot Reload
Automatically updating a running application when code changes, without manual restarts.

### Horizontal Scaling
Adding more servers to handle increased load. Cloudflare Workers scale horizontally automatically.

### Incident
An unplanned disruption or degradation of service.

### Integration Testing
Testing how different parts of an application work together.

### Lint / Linting
Analyzing code for potential errors, style issues, and best practice violations.

### Monorepo
A single repository containing multiple related projects or packages.

### MVP (Minimum Viable Product)
The simplest version of a product that delivers core value to early users.

### Post-Mortem
A detailed analysis written after an incident, documenting what happened, why, and how to prevent it in the future.

### PR (Pull Request)
A GitHub feature for proposing code changes, enabling review and discussion before merging.

### Production
The live environment where real users access the application.

### Rollback
Reverting to a previous version of software after discovering issues with a new deployment.

### RPO (Recovery Point Objective)
The maximum acceptable amount of data loss measured in time (e.g., 1 hour of data).

### RTO (Recovery Time Objective)
The maximum acceptable time to restore service after an incident (e.g., 4 hours).

### Semantic Versioning (SemVer)
A versioning scheme using MAJOR.MINOR.PATCH format (e.g., 1.2.3).

### Serverless
Cloud architecture where infrastructure is automatically managed and scaled. You pay only for actual usage.

### Spike
A time-boxed investigation to learn about a technical problem or solution.

### Staging
A pre-production environment used for testing before deploying to production.

### Technical Debt
Code or architecture shortcuts taken for speed that create future maintenance challenges.

### Unit Testing
Testing individual functions or components in isolation.

### V8 Isolate
A lightweight execution environment for JavaScript code. Cloudflare Workers run in V8 isolates, not containers.

### Vertical Scaling
Adding more resources (CPU, RAM) to a single server. Database scaling often starts with vertical scaling.

---

## User Roles & Permissions

### Admin
A user role with permission to manage keys and team members but cannot delete the project. See also: [RBAC](#rbac-role-based-access-control)

### Developer
A user role with permission to read and write secrets but cannot manage team members or project settings.

### Owner
The highest user role with full control over a project, including the ability to delete it and manage all team members.

### Permissions
Specific capabilities granted to users, such as "can read secrets" or "can invite members."

### Read-Only
A user role that can view secret names and metadata but cannot decrypt secret values or make changes.

### Role
A collection of permissions assigned to users. Abyrith has four primary roles: Owner, Admin, Developer, and Read-Only.

---

## Personas & Use Cases

### Enterprise Security / DevOps Team
Organizations with 50+ developers requiring compliance (SOC 2, ISO 27001), SSO, detailed audit trails, and automated key rotation. See [Product Vision Strategy](abyrith-product-vision-strategy.md) for full persona details.

### Solo Developer / Indie Hacker
Individual developers or small teams building projects, struggling with keys scattered across .env files and notes apps.

### The Development Team
Teams of 3-50 developers needing secure secret sharing, project organization, and audit trails for compliance.

### The Learner
Someone new to programming following tutorials who encounters "add your API key" and doesn't know what that means or how to get one. Abyrith's primary beginner persona requiring "5-year-old simple" guidance.

---

## Abyrith-Specific Terms

### 5-Year-Old Simple
Abyrith's design philosophy: instructions and interfaces should be so clear that even a 5-year-old could follow them. Emphasizes radical simplicity.

### Approval Workflow
A feature allowing organizations to require explicit approval before team members can access production secrets.

### Development (Environment)
The environment where developers build and test features locally before staging. Typically uses test API keys.

### FireCrawl Integration
Abyrith's use of the FireCrawl API to scrape and convert API documentation sites into AI-readable markdown for generating guided acquisition flows.

### Guided Acquisition
Abyrith's step-by-step AI-generated instructions for obtaining API keys from any service, complete with screenshots and progress tracking.

### MCP Request
When an AI tool like Claude Code asks Abyrith for a secret via the Model Context Protocol.

### Production (Environment)
The live environment with real users and data. Production secrets should be kept separate from development secrets.

### Project Reference
An encrypted file (`.abyrith-ref`) that can be safely committed to Git, linking a repository to an Abyrith project.

### Secret Assistant
Abyrith's AI-powered guide that helps users understand, acquire, and manage API keys through conversational interaction.

### Secret Card
A UI component displaying information about a stored secret (name, service, last accessed, tags).

### Staging (Environment)
A pre-production environment that mirrors production for final testing before release.

### Temporary Access Grant
Allowing an AI tool or team member to access secrets for a limited time (e.g., 1 hour, 24 hours).

### Usage Tracking
Abyrith's feature for monitoring API usage, costs, and approaching rate limits for stored secrets.

---

## Acronyms Quick Reference

| Acronym | Full Term | Definition Link |
|---------|-----------|-----------------|
| 2FA | Two-Factor Authentication | [Link](#2fa-two-factor-authentication) |
| ACID | Atomicity, Consistency, Isolation, Durability | [Link](#acid) |
| API | Application Programming Interface | [Link](#api-application-programming-interface) |
| CDN | Content Delivery Network | [Link](#cdn-content-delivery-network) |
| CI/CD | Continuous Integration / Continuous Deployment | [Link](#cicd-continuous-integration--continuous-deployment) |
| CORS | Cross-Origin Resource Sharing | [Link](#cors-cross-origin-resource-sharing) |
| CSP | Content Security Policy | [Link](#csp-content-security-policy) |
| DDoS | Distributed Denial of Service | [Link](#ddos-distributed-denial-of-service) |
| DX | Developer Experience | [Link](#dx-developer-experience) |
| E2E | End-to-End | [Link](#e2e-testing-end-to-end-testing) |
| GDPR | General Data Protection Regulation | [Link](#gdpr-general-data-protection-regulation) |
| HMAC | Hash-based Message Authentication Code | [Link](#hmac-hash-based-message-authentication-code) |
| HTTPS | HTTP Secure | [Link](#https-http-secure) |
| IV | Initialization Vector | [Link](#iv-initialization-vector) |
| JWT | JSON Web Token | [Link](#jwt-json-web-token) |
| KV | Key-Value | [Link](#cloudflare-workers-kv) |
| MCP | Model Context Protocol | [Link](#mcp-model-context-protocol) |
| MFA | Multi-Factor Authentication | [Link](#mfa-multi-factor-authentication) |
| MSW | Mock Service Worker | [Link](#msw-mock-service-worker) |
| MVP | Minimum Viable Product | [Link](#mvp-minimum-viable-product) |
| OAuth | Open Authorization | [Link](#oauth-20) |
| PBKDF2 | Password-Based Key Derivation Function 2 | [Link](#pbkdf2-password-based-key-derivation-function-2) |
| PITR | Point-in-Time Recovery | [Link](#point-in-time-recovery-pitr) |
| PR | Pull Request | [Link](#pr-pull-request) |
| RBAC | Role-Based Access Control | [Link](#rbac-role-based-access-control) |
| REST | Representational State Transfer | [Link](#rest-representational-state-transfer) |
| RLS | Row-Level Security | [Link](#rls-row-level-security) |
| RPO | Recovery Point Objective | [Link](#rpo-recovery-point-objective) |
| RTO | Recovery Time Objective | [Link](#rto-recovery-time-objective) |
| SAML | Security Assertion Markup Language | [Link](#saml-security-assertion-markup-language) |
| SemVer | Semantic Versioning | [Link](#semantic-versioning-semver) |
| SOC 2 | Service Organization Control 2 | [Link](#soc-2-service-organization-control-2) |
| SQL | Structured Query Language | [Link](#sql-structured-query-language) |
| SSO | Single Sign-On | [Link](#sso-single-sign-on) |
| SSL/TLS | Secure Sockets Layer / Transport Layer Security | [Link](#ssltls-secure-sockets-layer--transport-layer-security) |
| TOTP | Time-based One-Time Password | [Link](#totp-time-based-one-time-password) |
| UI/UX | User Interface / User Experience | N/A |
| UUID | Universally Unique Identifier | [Link](#uuid-universally-unique-identifier) |
| WAF | Web Application Firewall | [Link](#waf-web-application-firewall) |
| XSS | Cross-Site Scripting | [Link](#xss-cross-site-scripting) |

---

## Cross-References

### Related Documentation

- **Product Vision:** [Product Vision & Strategy](abyrith-product-vision-strategy.md)
- **Technical Architecture:** [Technical Architecture](abyrith-technical-architecture (1).md)
- **Team Principles:** [Team Playbook](abyrith-team-playbook (1).md)
- **Tech Stack:** [Tech Stack Specification](TECH-STACK.md)
- **Documentation Standards:** [Documentation Roadmap](DOCUMENTATION-ROADMAP.md)
- **Claude Code Guidance:** [Claude Code Instructions](CLAUDE.md)

### Adding New Terms

When adding new technical terms to Abyrith documentation:

1. Add definition to appropriate section in this glossary
2. Use the term consistently across all documentation
3. Link to this glossary on first usage in new documents
4. Update version header and change log below

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Claude (via User Request) | Initial comprehensive glossary creation with all terms from core documentation |

---

**Maintenance Note:** This glossary should be updated whenever new technical terms are introduced to the Abyrith platform or documentation. Regular reviews should occur quarterly to ensure accuracy and completeness.
