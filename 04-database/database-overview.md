---
Document: Database Architecture Overview
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Database Architect / Backend Lead
Status: Draft
Dependencies: 03-security/security-model.md, 03-security/rbac/permissions-model.md, TECH-STACK.md, GLOSSARY.md
---

# Database Architecture Overview

## Overview

This document defines the complete database architecture for Abyrith, built on Supabase PostgreSQL 15.x with a zero-knowledge encryption model. The architecture supports multi-tenant data isolation, enterprise-grade security through Row-Level Security (RLS), and comprehensive audit logging while enabling AI-powered features through encrypted metadata.

**Purpose:** Provide a foundational database architecture that ensures data sovereignty, scalability, and compliance while maintaining exceptional performance for secret management operations.

**Scope:** PostgreSQL schema design, multi-tenancy strategy, Row-Level Security policies, backup/recovery strategy, migration approach, and database performance optimization.

**Status:** Proposed - Phase 2 architecture for MVP implementation

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Multi-Tenancy Strategy](#multi-tenancy-strategy)
6. [Row-Level Security (RLS)](#row-level-security-rls)
7. [Schema Naming Conventions](#schema-naming-conventions)
8. [Data Flow](#data-flow)
9. [Backup and Recovery](#backup-and-recovery)
10. [Migration Strategy](#migration-strategy)
11. [Performance Optimization](#performance-optimization)
12. [Security Architecture](#security-architecture)
13. [Performance Characteristics](#performance-characteristics)
14. [Scalability](#scalability)
15. [Failure Modes](#failure-modes)
16. [Alternatives Considered](#alternatives-considered)
17. [Decision Log](#decision-log)
18. [Dependencies](#dependencies)
19. [References](#references)
20. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Secret management systems typically use one of two approaches: (1) server-side encryption where the platform can decrypt secrets, or (2) client-side encryption with poor query performance and no metadata intelligence. Abyrith needs a database architecture that supports zero-knowledge encryption while enabling intelligent features like AI assistance, search, and usage tracking.

**Pain points:**
- Traditional databases store plaintext or server-decryptable data (security risk)
- Multi-tenancy is often implemented poorly with application-level filtering (security vulnerability)
- Audit logging is frequently an afterthought (compliance gaps)
- Migration strategies are manual and error-prone (deployment risk)
- Scaling from solo developer to enterprise team is difficult (architectural limitation)

**Why now?**
PostgreSQL 15.x with Supabase provides enterprise-grade features (RLS, JSONB, real-time subscriptions) with excellent developer experience. This foundation enables us to build a zero-knowledge system that "just works" while meeting SOC 2 and GDPR requirements.

### Background

**Existing system (if applicable):**
This is a greenfield project. No existing database to migrate from.

**Previous attempts:**
Traditional secrets managers (HashiCorp Vault, AWS Secrets Manager) use centralized encryption with server-side decryption. Password managers (1Password, LastPass) use SQLite or proprietary formats. Neither approach enables the AI-native, zero-knowledge experience we're building.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Solo Developers | Simple setup, fast access | Don't want complex database operations |
| Development Teams | Data isolation, audit trails | Need guaranteed multi-tenancy security |
| Enterprise Security | SOC 2, zero-knowledge proof | Need evidence of data protection |
| Engineering Team | Maintainable schema, good performance | Avoid over-engineering, keep it simple |
| AI Features | Metadata for intelligence | Can't access encrypted secret values |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Zero-knowledge data model** - Database stores only encrypted secret values, never plaintext (Success metric: Third-party security audit confirms server cannot decrypt)
2. **Multi-tenant isolation** - Organizations and users cannot access each other's data, enforced at database level (Success metric: Pass RLS penetration testing)
3. **Audit completeness** - Every secret access, modification, and permission change is logged immutably (Success metric: Generate SOC 2 audit report in < 5 minutes)
4. **Query performance** - Sub-100ms response time for typical secret retrieval (Success metric: p95 latency < 100ms)
5. **AI-friendly metadata** - Plaintext metadata enables intelligent features without exposing secret values (Success metric: AI assistant provides guidance without decrypting secrets)

**Secondary goals:**
- Support 10,000+ users on a single database instance
- Enable zero-downtime schema migrations
- Provide point-in-time recovery with RPO < 1 hour
- Support real-time subscriptions for collaborative features

### Non-Goals

**Explicitly out of scope:**
- **Server-side decryption capability** - Database will never contain keys to decrypt secrets (Why: Violates zero-knowledge architecture)
- **Blockchain/distributed database** - Use centralized PostgreSQL (Why: Adds complexity without security benefit; PostgreSQL scales sufficiently)
- **NoSQL/document database** - Use relational PostgreSQL (Why: Relationships and ACID transactions are critical for secrets management)
- **Sharding across databases** - Single PostgreSQL instance (Why: Unnecessary for MVP scale; Supabase handles vertical scaling)

### Success Metrics

**How we measure success:**
- **Security:** Zero data breaches; pass SOC 2 Type II audit; pass RLS penetration testing
- **Performance:** p95 query latency < 100ms; p99 query latency < 200ms
- **Scalability:** Support 10,000+ users with < 1 CPU core utilization
- **Compliance:** Generate audit reports in < 5 minutes; 100% audit log coverage

---

## Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Client Application Layer                     │
│  (Browser: Web Crypto API encrypts before sending to server)    │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS (encrypted in transit)
                         │ Sends: encrypted_value, encrypted_dek,
                         │        nonce, metadata (plaintext)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│               Cloudflare Workers (API Gateway)                   │
│  - JWT authentication                                            │
│  - Input validation                                              │
│  - Rate limiting                                                 │
│  - Request forwarding                                            │
│  (CANNOT decrypt: no master keys)                                │
└────────────────────────┬─────────────────────────────────────────┘
                         │ Service-to-service auth (Supabase key)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL 15.x Database                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  public schema (application data)                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │organizations │  │   projects   │  │   secrets    │ │    │
│  │  │              │  │              │  │              │ │    │
│  │  │ - id         │  │ - id         │  │ - id         │ │    │
│  │  │ - name       │  │ - org_id     │  │ - project_id │ │    │
│  │  │ - settings   │  │ - name       │  │ - encrypted_ │ │    │
│  │  │              │  │ - created_at │  │   value      │ │    │
│  │  └──────┬───────┘  └───────┬──────┘  │ - encrypted_ │ │    │
│  │         │ 1:N              │ 1:N     │   dek        │ │    │
│  │         │                  │         │ - service_   │ │    │
│  │         │                  │         │   name       │ │    │
│  │         │                  │         │ - environment│ │    │
│  │         │                  │         │ - tags[]     │ │    │
│  │         │                  │         │              │ │    │
│  │         │                  │         │ RLS: user can│ │    │
│  │         │                  │         │ only see own │ │    │
│  │         │                  │         │ or team's    │ │    │
│  │         │                  │         └──────────────┘ │    │
│  │         │                  │                           │    │
│  │         ▼                  ▼                           │    │
│  │  ┌──────────────────────────────────────────────┐    │    │
│  │  │        org_members / project_members         │    │    │
│  │  │  (Many-to-Many relationships with roles)     │    │    │
│  │  └──────────────────────────────────────────────┘    │    │
│  │                                                        │    │
│  │  ┌──────────────────────────────────────────────┐    │    │
│  │  │           audit_logs (append-only)           │    │    │
│  │  │  - id, user_id, action, resource_type,       │    │    │
│  │  │  - resource_id, timestamp, ip_address        │    │    │
│  │  │                                               │    │    │
│  │  │  RLS: users can only see logs for their org  │    │    │
│  │  └──────────────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  auth schema (managed by Supabase Auth)               │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │             auth.users                       │     │    │
│  │  │  - id (UUID)                                 │     │    │
│  │  │  - email                                     │     │    │
│  │  │  - encrypted_password                        │     │    │
│  │  │  - created_at                                │     │    │
│  │  │  (Managed by Supabase Auth)                  │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Features:                                                       │
│  ✅ Row-Level Security (RLS) on all tables                      │
│  ✅ Encrypted values stored as BYTEA                            │
│  ✅ Metadata stored as JSONB for flexible queries               │
│  ✅ Automatic triggers for updated_at timestamps                │
│  ✅ Database-level constraints enforce data integrity           │
│  ✅ Real-time subscriptions for collaborative features          │
└──────────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Supabase PostgreSQL 15.x**
- **Purpose:** Primary data storage with advanced security features
- **Technology:** PostgreSQL 15.x (managed by Supabase)
- **Responsibilities:**
  - Store encrypted secrets and metadata
  - Enforce Row-Level Security for multi-tenancy
  - Manage relationships between users, organizations, projects, secrets
  - Provide ACID transactions for data integrity
  - Support real-time subscriptions via Supabase Realtime

**Component 2: Row-Level Security (RLS) Policies**
- **Purpose:** Database-level enforcement of data isolation
- **Technology:** PostgreSQL RLS feature
- **Responsibilities:**
  - Prevent users from accessing other users' secrets
  - Enforce organization and project membership
  - Control read/write permissions based on roles
  - Prevent SQL injection-based data leaks

**Component 3: Audit Log System**
- **Purpose:** Immutable record of all secret access and changes
- **Technology:** Append-only PostgreSQL table with triggers
- **Responsibilities:**
  - Log all secret CRUD operations
  - Log authentication and authorization events
  - Log team membership changes
  - Support compliance reporting (SOC 2, GDPR)
  - Prevent log tampering via database constraints

**Component 4: Migration Framework**
- **Purpose:** Version-controlled schema evolution
- **Technology:** Supabase Migrations (SQL-based)
- **Responsibilities:**
  - Apply schema changes in development → staging → production
  - Support rollback to previous schema versions
  - Verify migration success before marking complete
  - Track migration history in database

### Component Interactions

**Client ↔ Database (via Workers + Supabase):**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON (encrypted fields as base64)
- Authentication: JWT Bearer token (Supabase Auth)
- RLS: Automatically filters results based on auth.uid()

**Database ↔ Backup System:**
- Protocol: PostgreSQL streaming replication
- Frequency: Continuous (point-in-time recovery)
- Storage: Supabase managed storage (encrypted at rest)

---

## Component Details

### Component: Supabase PostgreSQL 15.x

**Purpose:** Managed PostgreSQL database providing enterprise-grade features with zero operational overhead.

**Responsibilities:**
- Store all encrypted secrets and plaintext metadata
- Enforce multi-tenancy via Row-Level Security
- Provide real-time subscriptions for collaborative features
- Handle automatic backups and point-in-time recovery
- Scale vertically as user base grows
- Generate auto-REST API via PostgREST

**Technology Stack:**
- **PostgreSQL 15.x** - ACID-compliant relational database
- **Supabase** - Managed PostgreSQL with Auth, Realtime, Storage
- **PostgREST** - Auto-generated REST API from schema
- **PgBouncer** - Connection pooling (transaction mode)

**Internal Architecture:**
```
┌─────────────────────────────────────────────────────┐
│         Supabase PostgreSQL Instance                │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │  PostgREST Layer                          │    │
│  │  - Auto-generates REST API from schema   │    │
│  │  - Enforces RLS policies                 │    │
│  │  - Handles JWT verification              │    │
│  └─────────────────┬─────────────────────────┘    │
│                    │                               │
│                    ▼                               │
│  ┌───────────────────────────────────────────┐    │
│  │  PostgreSQL 15.x Engine                   │    │
│  │  - Query planner and executor             │    │
│  │  - RLS policy enforcement                 │    │
│  │  - Transaction management (ACID)          │    │
│  │  - Index management                       │    │
│  └─────────────────┬─────────────────────────┘    │
│                    │                               │
│                    ▼                               │
│  ┌───────────────────────────────────────────┐    │
│  │  Storage Layer                            │    │
│  │  - Encrypted at rest (disk encryption)    │    │
│  │  - Write-Ahead Log (WAL) for durability   │    │
│  │  - Streaming replication for backups     │    │
│  └───────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Key Modules:**
- `auth` schema - Supabase Auth-managed user authentication
- `public` schema - Application data (organizations, projects, secrets)
- `storage` schema - Supabase Storage (for user avatars, exports)
- `realtime` - WebSocket subscriptions for live updates

**Configuration:**
```typescript
interface SupabaseConfig {
  url: string;              // Supabase project URL
  anonKey: string;          // Public (anon) key for client-side
  serviceRoleKey: string;   // Secret key for server-side (Workers)

  // Connection pooling (PgBouncer)
  poolMode: 'transaction';  // Transaction-level pooling
  maxConnections: 100;      // Max concurrent connections

  // Database settings
  version: '15.x';          // PostgreSQL version
  timezone: 'UTC';          // All timestamps in UTC

  // RLS enforcement
  rlsEnabled: true;         // Require RLS on all tables
}
```

**Example:**
```typescript
const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);

// All queries automatically enforce RLS
const { data, error } = await supabase
  .from('secrets')
  .select('*')
  .eq('project_id', projectId);
// RLS ensures user can only see secrets they have access to
```

---

## Multi-Tenancy Strategy

### Approach: Organization-Based Isolation with RLS

Abyrith uses a **shared database, shared schema** multi-tenancy model with PostgreSQL Row-Level Security (RLS) enforcing data isolation at the database level. This approach provides strong security guarantees while enabling efficient resource utilization.

**Tenancy Hierarchy:**
```
User (auth.users)
  ↓ belongs to (via org_members)
Organization (organizations)
  ↓ contains (via projects)
Project (projects)
  ↓ contains (via secrets)
Secret (secrets)
```

**Data Isolation Guarantees:**

1. **User Level:**
   - Users can only access their own user profile
   - Users can see organizations they're members of
   - Users cannot enumerate other users

2. **Organization Level:**
   - Organization members can see organization settings
   - Only Owners/Admins can modify organization settings
   - Organization members cannot see other organizations

3. **Project Level:**
   - Project members can see project secrets based on role
   - Project access is granted via `project_members` table
   - Users cannot access projects they're not members of

4. **Secret Level:**
   - Secrets are only visible to project members
   - Read-Only members can see secret names but not decrypt values
   - Audit logs record every secret access

**RLS Policy Structure:**

```sql
-- Example: secrets table RLS policy
CREATE POLICY "Users can only access secrets in their projects"
  ON secrets
  FOR SELECT
  TO authenticated
  USING (
    -- User is a member of the project
    EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'developer', 'read-only')
    )
  );
```

**Multi-Tenancy Implementation Details:**

| Aspect | Implementation | Enforcement |
|--------|---------------|-------------|
| Data Isolation | RLS policies on every table | Database level (cannot bypass) |
| User Enumeration | No cross-organization queries | RLS + API design |
| Performance | Indexes on tenant_id columns | Query planner optimization |
| Scalability | Shared database, vertical scaling | Supabase manages scaling |

**Benefits of This Approach:**
- ✅ **Strong security:** Database enforces isolation, no application bugs can leak data
- ✅ **Performance:** Single database, no cross-database joins, efficient indexing
- ✅ **Simplicity:** No complex sharding logic, straightforward queries
- ✅ **Cost-effective:** Shared resources, pay for actual usage
- ✅ **Compliance:** Clear audit trail, SOC 2 friendly

**Limitations:**
- ❌ **No physical separation:** All data in same database (acceptable: encrypted secrets)
- ❌ **Vertical scaling only:** Cannot shard across databases (acceptable: PostgreSQL scales to 10,000+ users)
- ❌ **RLS overhead:** Slight query performance penalty (~5-10%) (acceptable: sub-100ms queries)

---

## Row-Level Security (RLS)

### RLS Overview

**Purpose:** Enforce data isolation at the database level, preventing unauthorized access even if application logic has bugs.

**How RLS Works:**
1. User authenticates → Supabase Auth issues JWT token
2. JWT contains `sub` claim (user ID)
3. PostgreSQL sets `auth.uid()` to user ID from JWT
4. Every query automatically includes RLS policy checks
5. Rows that don't pass policy checks are invisible to user

**RLS Benefits:**
- **Security:** No SQL injection can bypass RLS
- **Simplicity:** Application code doesn't need authorization checks
- **Audit:** Clear separation of concerns (database handles access control)
- **Performance:** RLS uses indexes efficiently

### RLS Policy Patterns

**Pattern 1: User owns resource**
```sql
-- User can only see their own data
CREATE POLICY "Users see own data"
  ON table_name
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Pattern 2: Organization membership**
```sql
-- User can see data if they're an org member
CREATE POLICY "Org members see org data"
  ON table_name
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id
      FROM org_members
      WHERE user_id = auth.uid()
    )
  );
```

**Pattern 3: Project membership with roles**
```sql
-- User can see data if they're a project member with specific roles
CREATE POLICY "Project members see project data"
  ON secrets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = secrets.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'developer', 'read-only')
    )
  );
```

**Pattern 4: Write restrictions by role**
```sql
-- Only owners/admins can update
CREATE POLICY "Only owners and admins can update"
  ON table_name
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = table_name.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = table_name.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );
```

### RLS Performance Optimization

**Best Practices:**
1. **Index RLS columns:** Always index columns used in RLS policies
   ```sql
   CREATE INDEX idx_secrets_project_id ON secrets(project_id);
   CREATE INDEX idx_project_members_project_user ON project_members(project_id, user_id);
   ```

2. **Avoid complex subqueries:** Use `EXISTS` instead of `IN` for better performance
   ```sql
   -- Good (fast)
   EXISTS (SELECT 1 FROM members WHERE ...)

   -- Bad (slow)
   org_id IN (SELECT org_id FROM members WHERE ...)
   ```

3. **Cache membership checks:** Use materialized views for frequently checked relationships (if needed)

4. **Monitor query plans:** Use `EXPLAIN ANALYZE` to verify RLS doesn't cause table scans
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM secrets WHERE project_id = 'uuid';
   ```

---

## Schema Naming Conventions

### Table Naming

**Format:** `lowercase_with_underscores` (snake_case)

**Examples:**
- `organizations` (plural noun)
- `project_members` (relationship table)
- `audit_logs` (plural noun)
- `user_encryption_keys` (descriptive noun)

**Rules:**
- ✅ **Use plural nouns:** `secrets` not `secret`
- ✅ **Use underscores:** `project_members` not `projectMembers` or `project-members`
- ✅ **Be descriptive:** `user_encryption_keys` not `user_keys`
- ❌ **Avoid abbreviations:** `organizations` not `orgs`

### Column Naming

**Format:** `lowercase_with_underscores` (snake_case)

**Standard Columns:**
- `id` - Primary key (UUID)
- `created_at` - Timestamp (TIMESTAMPTZ)
- `updated_at` - Timestamp (TIMESTAMPTZ)
- `created_by` - User ID (UUID, foreign key to auth.users)
- `user_id` - User ownership (UUID, foreign key to auth.users)
- `organization_id` - Organization ownership (UUID, foreign key)
- `project_id` - Project ownership (UUID, foreign key)

**Foreign Key Naming:**
- Pattern: `{referenced_table_singular}_id`
- Examples: `organization_id`, `project_id`, `user_id`

**Boolean Columns:**
- Pattern: `is_{adjective}` or `has_{noun}`
- Examples: `is_active`, `has_mfa_enabled`, `is_archived`

**JSONB Columns:**
- Pattern: Descriptive noun
- Examples: `metadata`, `settings`, `tags`

**Encrypted Data:**
- Pattern: `encrypted_{data_name}`
- Examples: `encrypted_value`, `encrypted_dek`

### Index Naming

**Format:** `idx_{table}_{column1}_{column2}`

**Examples:**
```sql
CREATE INDEX idx_secrets_project_id ON secrets(project_id);
CREATE INDEX idx_secrets_project_env ON secrets(project_id, environment);
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
```

### Constraint Naming

**Format:** `{table}_{column}_{constraint_type}`

**Examples:**
```sql
ALTER TABLE secrets
  ADD CONSTRAINT secrets_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE projects
  ADD CONSTRAINT projects_name_not_empty
    CHECK (length(name) > 0);
```

---

## Data Flow

### Flow 1: User Creates Secret

**Trigger:** User submits new secret via web interface

**Steps:**

1. **Client-Side Encryption:**
   ```typescript
   // Browser: User enters secret
   const secretValue = 'sk_test_abc123...';
   const masterKey = await deriveMasterKey(password, salt);

   // Encrypt secret with DEK, then encrypt DEK with master key
   const encrypted = await encryptSecret(secretValue, masterKey);
   // Returns: {encryptedValue, encryptedDEK, secretNonce, dekNonce}
   ```

2. **API Request (via Cloudflare Workers):**
   ```typescript
   // POST /api/secrets
   {
     project_id: 'project-uuid',
     environment: 'production',
     service_name: 'openai',
     key_name: 'OPENAI_API_KEY',
     encrypted_value: 'base64...',
     encrypted_dek: 'base64...',
     secret_nonce: 'base64...',
     dek_nonce: 'base64...',
     tags: ['ai', 'api-key']
   }
   ```

3. **Database Insert (via PostgREST):**
   ```sql
   INSERT INTO secrets (
     id,
     user_id,
     project_id,
     environment,
     service_name,
     key_name,
     encrypted_value,
     encrypted_dek,
     secret_nonce,
     dek_nonce,
     tags,
     created_at,
     created_by
   ) VALUES (
     gen_random_uuid(),
     auth.uid(),                    -- From JWT
     'project-uuid',
     'production',
     'openai',
     'OPENAI_API_KEY',
     decode('base64...', 'base64'), -- BYTEA
     decode('base64...', 'base64'), -- BYTEA
     decode('base64...', 'base64'), -- BYTEA
     decode('base64...', 'base64'), -- BYTEA
     ARRAY['ai', 'api-key'],        -- TEXT[]
     now(),
     auth.uid()
   );

   -- RLS policy automatically verifies user has project access
   ```

4. **Audit Log Creation (via Trigger):**
   ```sql
   -- Automatic trigger on secrets INSERT
   CREATE TRIGGER audit_secret_created
     AFTER INSERT ON secrets
     FOR EACH ROW
     EXECUTE FUNCTION log_secret_event();

   -- Function inserts into audit_logs:
   INSERT INTO audit_logs (
     id,
     user_id,
     action,
     resource_type,
     resource_id,
     timestamp,
     ip_address,
     metadata
   ) VALUES (
     gen_random_uuid(),
     NEW.user_id,
     'secret.created',
     'secret',
     NEW.id,
     now(),
     current_setting('request.headers')::json->>'cf-connecting-ip',
     jsonb_build_object(
       'service_name', NEW.service_name,
       'environment', NEW.environment,
       'project_id', NEW.project_id
     )
   );
   ```

**Sequence Diagram:**
```
User    Browser    Workers    PostgreSQL    Audit
  |        |          |            |           |
  |--data-->|          |            |           |
  |        |          |            |           |
  |        |--encrypt->            |           |
  |        |  (PBKDF2, AES-GCM)   |           |
  |        |          |            |           |
  |        |--POST--->|            |           |
  |        |          |--INSERT--->|           |
  |        |          |            |           |
  |        |          |            |--trigger->|
  |        |          |            |           |
  |        |          |<--success--|           |
  |        |<--200----|            |           |
  |<-done--|          |            |           |
```

**Data Transformations:**
- **Point A (User input):** Plaintext secret value
- **Point B (After encryption):** Encrypted blob + encrypted DEK + nonces
- **Point C (API request):** Base64-encoded encrypted data + plaintext metadata
- **Point D (Database):** BYTEA encrypted data + TEXT metadata

---

### Flow 2: User Retrieves Secret

**Trigger:** User requests secret from project

**Steps:**

1. **API Request:**
   ```typescript
   // GET /api/secrets/:id
   // Headers: Authorization: Bearer {jwt}
   ```

2. **Database Query (with RLS):**
   ```sql
   SELECT
     id,
     service_name,
     key_name,
     encrypted_value,
     encrypted_dek,
     secret_nonce,
     dek_nonce,
     environment,
     tags,
     created_at,
     updated_at
   FROM secrets
   WHERE id = 'secret-uuid';

   -- RLS policy automatically filters to user's accessible projects
   -- If user doesn't have access, query returns 0 rows
   ```

3. **Client-Side Decryption:**
   ```typescript
   // Browser receives encrypted data
   const encryptedData = await response.json();

   // User enters master password (if not cached)
   const masterKey = await deriveMasterKey(password, salt);

   // Decrypt DEK, then decrypt secret
   const secretValue = await decryptSecret(encryptedData, masterKey);

   // Display to user
   displaySecret(secretValue);
   ```

4. **Audit Log Creation:**
   ```sql
   -- Automatic trigger on secrets SELECT
   -- (Note: PostgreSQL doesn't have SELECT triggers;
   --  this is handled by application layer)

   INSERT INTO audit_logs (...)
   VALUES (..., 'secret.read', 'secret', 'secret-uuid', now(), ...);
   ```

---

## Backup and Recovery

### Backup Strategy

**Approach:** Continuous backups via Supabase with point-in-time recovery (PITR)

**Backup Types:**

1. **Continuous Backups (WAL Archiving):**
   - **Frequency:** Continuous (every transaction written to Write-Ahead Log)
   - **Retention:** 7 days minimum (configurable to 30 days)
   - **Storage:** Supabase managed storage (encrypted at rest)
   - **RPO:** < 1 minute (can restore to any second within retention period)

2. **Daily Snapshots:**
   - **Frequency:** Daily at 02:00 UTC
   - **Retention:** 7 days for daily, 4 weeks for weekly
   - **Storage:** Supabase managed storage
   - **Purpose:** Fast restoration without replaying WAL

3. **Manual Snapshots:**
   - **Trigger:** Before major schema migrations or deployments
   - **Retention:** 30 days
   - **Purpose:** Rollback point for migrations

**Backup Contents:**
- ✅ All database schemas and tables
- ✅ RLS policies and database functions
- ✅ Encrypted secret data (still encrypted in backup)
- ✅ Audit logs (immutable records)
- ✅ Database configuration and settings

**Backup Verification:**
- Weekly automated backup restoration test (staging environment)
- Monthly verification of backup integrity (checksums)
- Quarterly disaster recovery drill (full restoration test)

### Recovery Strategy

**Recovery Time Objective (RTO):** 4 hours (time to restore service)

**Recovery Point Objective (RPO):** 1 hour (maximum acceptable data loss)

**Recovery Scenarios:**

**Scenario 1: Accidental Data Deletion**
```bash
# Restore to point before deletion
supabase db restore \
  --project-id $PROJECT_ID \
  --timestamp "2025-10-30T14:30:00Z"
```
- **RTO:** 30 minutes
- **RPO:** 0 (point-in-time recovery to exact timestamp)

**Scenario 2: Database Corruption**
```bash
# Restore from latest daily snapshot
supabase db restore \
  --project-id $PROJECT_ID \
  --snapshot latest
```
- **RTO:** 1 hour
- **RPO:** Up to 24 hours (last daily snapshot)

**Scenario 3: Complete Supabase Outage**
```bash
# Restore to new Supabase instance from backup
1. Create new Supabase project
2. Restore from backup to new project
3. Update DNS to point to new project
4. Verify data integrity
5. Resume operations
```
- **RTO:** 4 hours
- **RPO:** 1 hour

**Recovery Procedures:**

1. **Detection:** Monitor alerts trigger (database unavailable, data inconsistency)
2. **Assessment:** Identify scope of issue (single table, entire database, outage)
3. **Decision:** Choose recovery approach (PITR, snapshot, new instance)
4. **Execution:** Restore from backup using Supabase tools
5. **Verification:** Run integrity checks, compare row counts, test queries
6. **Communication:** Notify users of restoration and any data loss
7. **Post-Mortem:** Document incident and improve monitoring

---

## Migration Strategy

### Migration Approach

**Framework:** Supabase Migrations (SQL-based)

**Migration Workflow:**
```
Development → Staging → Production

1. Create migration in development
2. Test migration locally
3. Apply to staging environment
4. Run integration tests
5. Apply to production (with rollback plan)
6. Monitor for issues
```

**Migration File Structure:**
```
supabase/
  migrations/
    20251030000001_initial_schema.sql
    20251030000002_add_organizations.sql
    20251030000003_add_audit_logs.sql
  seed.sql (test data for local development)
```

### Migration Best Practices

**1. Reversible Migrations:**
Every migration should have a clear rollback path.

```sql
-- Migration: 20251030000001_add_tags_to_secrets.sql

-- Up migration
ALTER TABLE secrets
  ADD COLUMN tags TEXT[] DEFAULT '{}';

CREATE INDEX idx_secrets_tags ON secrets USING GIN(tags);

-- Down migration (in separate rollback file)
-- 20251030000001_add_tags_to_secrets_rollback.sql
DROP INDEX IF EXISTS idx_secrets_tags;
ALTER TABLE secrets DROP COLUMN IF EXISTS tags;
```

**2. Zero-Downtime Migrations:**
Use additive changes that don't break existing code.

```sql
-- Good: Add column with default
ALTER TABLE secrets ADD COLUMN description TEXT DEFAULT '';
-- Existing queries continue working

-- Bad: Remove column immediately
-- ALTER TABLE secrets DROP COLUMN old_field;
-- Breaks existing queries!

-- Better: Deprecate then remove in separate deployment
-- Phase 1: Add new column, migrate data
-- Phase 2: Update application to use new column
-- Phase 3: Remove old column (in next migration)
```

**3. Data Migrations:**
Separate schema changes from data migrations.

```sql
-- Migration: 20251030000002_rename_column_safe.sql

-- Step 1: Add new column
ALTER TABLE secrets ADD COLUMN service_name TEXT;

-- Step 2: Copy data (for small tables)
UPDATE secrets SET service_name = old_service;

-- Step 3: Add NOT NULL constraint after data copied
ALTER TABLE secrets ALTER COLUMN service_name SET NOT NULL;

-- Step 4: Drop old column (in future migration after deploy)
-- ALTER TABLE secrets DROP COLUMN old_service;
```

**4. Testing Migrations:**
```bash
# Test locally
supabase migration up

# Verify schema
supabase db diff

# Run application tests
npm test

# Test rollback
supabase migration down
supabase migration up  # Re-apply
```

**5. Production Migration Checklist:**
- [ ] Migration tested in development
- [ ] Migration tested in staging with production-like data volume
- [ ] Database backup created immediately before migration
- [ ] Rollback script prepared and tested
- [ ] Monitoring alerts configured for new tables/columns
- [ ] Team notified of maintenance window (if needed)
- [ ] Application deployment coordinated with migration
- [ ] Post-migration verification queries prepared

### Migration Patterns

**Pattern 1: Add Table**
```sql
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS immediately
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users see own data"
  ON new_table FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX idx_new_table_user_id ON new_table(user_id);
CREATE INDEX idx_new_table_created_at ON new_table(created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON new_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Pattern 2: Add Column (with default)**
```sql
ALTER TABLE existing_table
  ADD COLUMN new_column TEXT DEFAULT 'default_value';

-- Add index after data populated (if needed)
CREATE INDEX idx_existing_table_new_column ON existing_table(new_column);
```

**Pattern 3: Modify Enum (PostgreSQL)**
```sql
-- PostgreSQL doesn't support modifying enums directly
-- Create new type, migrate data, swap

-- Create new type
CREATE TYPE environment_v2 AS ENUM ('development', 'staging', 'production', 'preview');

-- Add new column with new type
ALTER TABLE secrets ADD COLUMN environment_v2 environment_v2;

-- Copy data
UPDATE secrets SET environment_v2 = environment::TEXT::environment_v2;

-- Make new column NOT NULL after migration
ALTER TABLE secrets ALTER COLUMN environment_v2 SET NOT NULL;

-- In next deployment:
-- 1. Update application to use environment_v2
-- 2. Drop old column
-- 3. Rename new column
ALTER TABLE secrets DROP COLUMN environment;
ALTER TABLE secrets RENAME COLUMN environment_v2 TO environment;
```

---

## Performance Optimization

### Database Optimization

**Connection Pooling:**
```typescript
// Supabase uses PgBouncer in transaction mode
// Configuration:
{
  poolMode: 'transaction',        // Connection per transaction
  maxConnections: 100,            // Max concurrent connections
  defaultPoolSize: 20,            // Default pool size per user
  reserveConnections: 5           // Reserved for admin
}
```

**Query Optimization Strategies:**

1. **Index All Foreign Keys:**
   ```sql
   -- Every foreign key should have an index
   CREATE INDEX idx_secrets_project_id ON secrets(project_id);
   CREATE INDEX idx_secrets_user_id ON secrets(user_id);
   CREATE INDEX idx_project_members_project_id ON project_members(project_id);
   CREATE INDEX idx_project_members_user_id ON project_members(user_id);
   ```

2. **Composite Indexes for Common Queries:**
   ```sql
   -- For queries filtering by project AND environment
   CREATE INDEX idx_secrets_project_env ON secrets(project_id, environment);

   -- For audit log queries (user + recent timestamp)
   CREATE INDEX idx_audit_logs_user_timestamp
     ON audit_logs(user_id, timestamp DESC);
   ```

3. **JSONB Indexes for Metadata:**
   ```sql
   -- GIN index for JSONB columns (tag searches)
   CREATE INDEX idx_secrets_tags ON secrets USING GIN(tags);

   -- Query using index:
   SELECT * FROM secrets WHERE tags @> ARRAY['ai'];
   ```

4. **Partial Indexes for Filtered Queries:**
   ```sql
   -- Index only active (non-archived) secrets
   CREATE INDEX idx_secrets_active
     ON secrets(project_id, environment)
     WHERE archived_at IS NULL;
   ```

**Query Performance Monitoring:**
```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Analyze specific query
EXPLAIN ANALYZE
SELECT * FROM secrets
WHERE project_id = 'uuid'
  AND environment = 'production';
```

### Caching Strategy

**Edge Caching (Cloudflare Workers KV):**
```typescript
// Cache encrypted secrets at edge for 5 minutes
const cacheKey = `secret:${secretId}:${userId}`;
const cached = await env.KV.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// Fetch from database
const secret = await fetchSecret(secretId);

// Cache encrypted data (not plaintext!)
await env.KV.put(cacheKey, JSON.stringify(secret), {
  expirationTtl: 300  // 5 minutes
});

return secret;
```

**Application-Level Caching (React Query):**
```typescript
// Cache encrypted secrets in browser
const { data: secret } = useQuery({
  queryKey: ['secret', secretId],
  queryFn: () => fetchSecret(secretId),
  staleTime: 5 * 60 * 1000,     // 5 minutes
  cacheTime: 10 * 60 * 1000,    // 10 minutes
});
```

**Cache Invalidation:**
```typescript
// Invalidate cache on secret update
await supabase
  .from('secrets')
  .update({ encrypted_value: newValue })
  .eq('id', secretId);

// Invalidate edge cache
await env.KV.delete(`secret:${secretId}:${userId}`);

// Invalidate React Query cache
queryClient.invalidateQueries(['secret', secretId]);
```

---

## Security Architecture

### Encryption at Rest

**Database-Level Encryption:**
- Supabase encrypts all data at rest using AES-256
- Encryption keys managed by cloud provider (AWS)
- Automatic key rotation

**Application-Level Encryption (Zero-Knowledge):**
- Secret values encrypted client-side before storage
- Database stores only encrypted blobs (BYTEA)
- Server cannot decrypt even with database access

**Data Classification:**

| Data Type | Storage Format | Encryption | Reason |
|-----------|---------------|------------|--------|
| Secret values | BYTEA | Client-side AES-256-GCM | Zero-knowledge requirement |
| Data Encryption Keys (DEKs) | BYTEA | Client-side AES-256-GCM | Envelope encryption |
| Nonces/IVs | BYTEA | None (public, random) | Required for decryption |
| Service names | TEXT | None (plaintext) | Required for search/AI |
| Tags | TEXT[] | None (plaintext) | Required for organization |
| Audit logs | JSONB | None (plaintext) | Required for compliance |
| User emails | TEXT | None (plaintext, Supabase managed) | Required for auth |

### Access Control

**Multi-Layered Security:**

1. **Network Layer (Cloudflare):**
   - DDoS protection
   - WAF (Web Application Firewall)
   - Rate limiting (per IP, per user)

2. **Authentication Layer (Supabase Auth):**
   - JWT verification
   - Token expiration (15 minutes)
   - Refresh token rotation
   - MFA support (TOTP)

3. **Authorization Layer (RLS):**
   - Database-enforced access control
   - Row-level filtering based on user ID
   - Role-based permissions (Owner, Admin, Developer, Read-Only)

4. **Application Layer:**
   - Input validation
   - Output encoding
   - CSRF protection
   - Content Security Policy

### Audit Logging

**What Gets Logged:**
```typescript
interface AuditLogEntry {
  id: string;              // UUID
  user_id: string;         // Actor
  action: string;          // 'secret.created', 'secret.read', etc.
  resource_type: string;   // 'secret', 'project', 'organization'
  resource_id: string;     // Resource UUID
  timestamp: string;       // ISO 8601 timestamp (UTC)
  ip_address: string;      // Source IP (from Cloudflare)
  user_agent: string;      // Browser/tool identifier
  metadata: object;        // Additional context (non-sensitive)
  result: 'success' | 'failure';
}
```

**Audit Log Implementation:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  result TEXT NOT NULL CHECK (result IN ('success', 'failure'))
);

-- Append-only: no updates or deletes allowed
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- No UPDATE or DELETE policies (append-only)
```

**Audit Log Retention:**
- Standard: 1 year
- Enterprise: 7 years (configurable)
- Export format: CSV, JSON, SIEM-compatible

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- **Single secret retrieval:** < 100ms p95, < 200ms p99
- **List secrets (page of 20):** < 150ms p95, < 300ms p99
- **Create secret:** < 200ms p95, < 400ms p99
- **Search secrets (metadata):** < 200ms p95, < 500ms p99

**Throughput:**
- **Concurrent users:** 1,000+ (per database instance)
- **Requests per second:** 100+ per user (rate-limited)
- **Database connections:** 100 concurrent (PgBouncer)

**Resource Usage:**
- **Database CPU:** < 50% at 1,000 concurrent users
- **Database memory:** < 2GB at 10,000 secrets stored
- **Database storage:** ~1KB per secret (encrypted value + metadata)
- **Storage growth:** ~100MB per 100,000 secrets

### Performance Benchmarks

**Expected Query Performance:**
```sql
-- Single secret by ID (indexed)
-- Expected: 5-10ms
SELECT * FROM secrets WHERE id = 'uuid';

-- List secrets for project (indexed)
-- Expected: 10-20ms for 100 secrets
SELECT * FROM secrets
WHERE project_id = 'uuid'
ORDER BY created_at DESC
LIMIT 20;

-- Search by tags (GIN index)
-- Expected: 20-50ms for 1,000 secrets
SELECT * FROM secrets
WHERE tags @> ARRAY['ai']
  AND project_id = 'uuid';

-- Audit log query (composite index)
-- Expected: 30-60ms for 10,000 logs
SELECT * FROM audit_logs
WHERE user_id = 'uuid'
  AND timestamp > now() - interval '30 days'
ORDER BY timestamp DESC
LIMIT 50;
```

### Optimization Techniques

**Implemented:**
- ✅ Indexes on all foreign keys
- ✅ Composite indexes for common queries
- ✅ GIN indexes for JSONB and array columns
- ✅ Connection pooling (PgBouncer)
- ✅ Query result caching (Cloudflare KV)
- ✅ RLS policies optimized with EXISTS

**Future Optimizations (if needed):**
- 🔄 Materialized views for complex aggregations
- 🔄 Partitioning for audit_logs table (by timestamp)
- 🔄 Read replicas for reporting queries
- 🔄 Database-level caching (pgpool)

---

## Scalability

### Vertical Scaling

**Supabase Scaling Path:**
```
Free tier:
  - 500MB database
  - 1 core CPU
  - Up to 1,000 users

Pro tier ($25/month):
  - 8GB database
  - 2 core CPU shared
  - Up to 10,000 users

Team tier ($599/month):
  - 100GB database
  - 4 core CPU dedicated
  - Up to 100,000 users

Enterprise tier (custom):
  - TB-scale database
  - 16+ core CPU dedicated
  - Millions of users
```

**Current Target:** Pro tier (10,000 users)

### Horizontal Scaling (Future)

**Read Replicas:**
- Use for reporting and analytics queries
- Offload read-heavy operations from primary
- Supabase supports read replicas (enterprise feature)

**Partitioning:**
```sql
-- Partition audit_logs by timestamp (if table grows large)
CREATE TABLE audit_logs (
  id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  -- other columns
) PARTITION BY RANGE (timestamp);

CREATE TABLE audit_logs_2025_10 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

### Capacity Planning

**Storage Growth Estimation:**
```
Assumptions:
- Average secret size: 500 bytes (encrypted value)
- Metadata size: 500 bytes (service name, tags, timestamps)
- Total per secret: 1KB

Projections:
- 1,000 users × 20 secrets = 20,000 secrets = 20MB
- 10,000 users × 20 secrets = 200,000 secrets = 200MB
- 100,000 users × 20 secrets = 2,000,000 secrets = 2GB

Audit logs:
- 10 events per user per day
- 10,000 users = 100,000 events/day = 36M events/year
- ~500 bytes per event = 18GB/year
```

**Recommended Monitoring:**
- Database size growth rate (MB/day)
- Table sizes (pg_total_relation_size)
- Index sizes (pg_indexes_size)
- Connection count (pg_stat_activity)
- Query latency (p50, p95, p99)

---

## Failure Modes

### Failure Mode 1: Database Connection Exhaustion

**Scenario:** Too many concurrent connections exceed PgBouncer limit

**Impact:** New requests fail with "connection pool exhausted" error

**Detection:**
```sql
-- Monitor active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
-- Alert if > 90 connections
```

**Recovery:**
1. Increase PgBouncer connection limit (if headroom available)
2. Identify long-running queries and terminate if necessary
   ```sql
   SELECT pid, query, state, query_start
   FROM pg_stat_activity
   WHERE state != 'idle' AND query_start < now() - interval '5 minutes';

   SELECT pg_terminate_backend(pid);
   ```
3. Scale database vertically (increase connections limit)

**Prevention:**
- Set max connection limits in application code
- Implement connection timeouts (30 seconds)
- Use connection pooling correctly (close connections after use)
- Monitor connection count and alert at 80% capacity

---

### Failure Mode 2: RLS Policy Misconfiguration

**Scenario:** Incorrect RLS policy allows cross-tenant data access

**Impact:** Critical security vulnerability (data leak)

**Detection:**
- Automated RLS penetration tests (run on every schema change)
- Manual security review of all RLS policies
- Monitor for unexpected cross-org queries in audit logs

**Recovery:**
1. Immediately disable public access (if compromised)
2. Fix RLS policy in development
3. Test fix thoroughly with adversarial queries
4. Deploy fix to staging, re-test
5. Deploy to production with monitoring
6. Audit logs to identify if any data was accessed improperly
7. Notify affected users if breach confirmed

**Prevention:**
- Peer review all RLS policy changes
- Automated tests for RLS policies (test framework)
- Never deploy RLS changes without testing
- Use RLS policy templates (reduce custom logic)

---

### Failure Mode 3: Backup Failure

**Scenario:** Backup process fails silently, no recent backups available

**Impact:** Data loss risk if database failure occurs

**Detection:**
```bash
# Check last successful backup timestamp
supabase db backups list --project-id $PROJECT_ID

# Alert if no backup in last 25 hours
```

**Recovery:**
1. Investigate backup failure cause (storage full, permissions, etc.)
2. Fix underlying issue
3. Manually trigger backup immediately
4. Verify backup integrity (restore to staging)
5. Resume automated backup schedule

**Prevention:**
- Monitor backup success/failure (daily alert)
- Weekly backup restoration test (automated)
- Backup to multiple regions (if critical)
- Maintain backup retention policy (7 days minimum)

---

## Alternatives Considered

### Alternative 1: NoSQL Database (MongoDB, DynamoDB)

**Description:** Use document database instead of relational PostgreSQL

**Pros:**
- Flexible schema for evolving data models
- Horizontal scaling built-in
- Fast writes for high-throughput scenarios

**Cons:**
- No native Row-Level Security (must implement in application)
- Weaker consistency guarantees than ACID
- No JOIN operations (denormalization required)
- More complex to audit and ensure data integrity
- Relationships between users/orgs/projects/secrets are natural fit for relational

**Why not chosen:** Relationships and ACID transactions are critical for secrets management. RLS provides database-level security guarantee that application-level filtering cannot match. PostgreSQL provides better security posture.

---

### Alternative 2: Separate Database Per Tenant

**Description:** Each organization gets their own PostgreSQL database

**Pros:**
- Complete physical isolation between tenants
- Easier to scale per-tenant (different hardware for large customers)
- Simpler backup/restore per organization
- No RLS overhead

**Cons:**
- Extremely complex operationally (managing thousands of databases)
- No cross-organization queries (analytics, billing)
- Schema migrations must run across all databases
- Costly (idle resources per database)
- Difficult to onboard new customers (provision time)

**Why not chosen:** Operational complexity far outweighs benefits. RLS provides sufficient isolation with much better operational simplicity. Zero-knowledge encryption makes physical isolation unnecessary (data is encrypted even within same database).

---

### Alternative 3: Serverless SQL (Planetscale, Neon)

**Description:** Use serverless PostgreSQL with automatic scaling

**Pros:**
- Scales to zero when unused (cost savings)
- Automatic scaling based on load
- Branching for database changes (like git)

**Cons:**
- Cold start latency (not acceptable for API responses)
- More expensive than traditional PostgreSQL at scale
- Less mature ecosystem than Supabase
- Supabase provides more than just database (Auth, Realtime, Storage)

**Why not chosen:** Supabase provides integrated stack (database + auth + realtime) that reduces operational complexity. Cold starts are unacceptable for secret retrieval operations. Cost structure favors Supabase for our use case.

---

## Decision Log

### Decision 1: PostgreSQL 15.x over Other Databases

**Date:** 2025-10-30

**Context:** Choose primary database technology for secret storage

**Options:**
1. **PostgreSQL 15.x** - Relational, ACID, RLS, JSONB
2. **MySQL 8.0** - Relational, ACID, no RLS
3. **MongoDB** - NoSQL, flexible schema, horizontal scaling

**Decision:** PostgreSQL 15.x via Supabase

**Rationale:**
- Row-Level Security (RLS) provides database-level multi-tenancy enforcement
- JSONB support enables flexible metadata storage while maintaining relational integrity
- Supabase provides integrated stack (Auth, Realtime, Storage) reducing operational overhead
- ACID transactions ensure data integrity for critical secret operations
- Excellent performance for read-heavy workloads (secrets are read more than written)
- Native support for arrays (tags), full-text search, and advanced indexing (GIN)

**Consequences:**
- Must design schema with relationships (cannot denormalize easily)
- Vertical scaling only (acceptable for target scale)
- Slightly more complex queries than NoSQL (acceptable trade-off for consistency)

---

### Decision 2: Supabase Managed vs Self-Hosted PostgreSQL

**Date:** 2025-10-30

**Context:** Should we manage PostgreSQL ourselves or use Supabase?

**Options:**
1. **Supabase Managed** - Fully managed PostgreSQL + Auth + Realtime
2. **Self-Hosted PostgreSQL** - Deploy on AWS RDS, Azure Database, or VMs
3. **Hybrid** - Self-host PostgreSQL, use Supabase Auth separately

**Decision:** Supabase Managed

**Rationale:**
- Integrated authentication (Supabase Auth) reduces custom auth implementation
- Real-time subscriptions built-in for collaborative features (Supabase Realtime)
- Auto-generated REST API via PostgREST (faster development)
- Managed backups, replication, and scaling (reduced operational burden)
- Free tier for development, affordable Pro tier for MVP
- Focus team effort on product features, not infrastructure

**Consequences:**
- Vendor lock-in to Supabase (mitigated: PostgreSQL data is portable)
- Less control over database configuration (acceptable: Supabase defaults are good)
- Must coordinate Supabase features with Cloudflare Workers (acceptable: clean API boundary)

---

### Decision 3: Row-Level Security (RLS) for Multi-Tenancy

**Date:** 2025-10-30

**Context:** How to enforce data isolation between users and organizations?

**Options:**
1. **Application-level filtering** - WHERE user_id = current_user in every query
2. **Row-Level Security (RLS)** - Database-enforced policies
3. **Separate schemas per tenant** - Each org has own schema
4. **Separate databases per tenant** - Each org has own database

**Decision:** Row-Level Security (RLS)

**Rationale:**
- Security enforced at database level (cannot bypass with SQL injection or buggy code)
- Single schema simplifies operations and migrations
- Performance overhead is minimal (~5-10%) with proper indexing
- PostgreSQL RLS is mature and well-tested
- Reduces application code complexity (database handles filtering)
- Meets SOC 2 requirements for data isolation

**Consequences:**
- Must define RLS policies for every table (acceptable: use templates)
- Slight query performance penalty (mitigated: proper indexes)
- Cannot easily query across organizations (acceptable: not a common use case)
- Must test RLS policies thoroughly (mitigated: automated testing)

---

### Decision 4: BYTEA vs TEXT for Encrypted Secrets

**Date:** 2025-10-30

**Context:** How to store encrypted secret values in PostgreSQL?

**Options:**
1. **BYTEA** - Binary data type, stores raw bytes
2. **TEXT** - Store base64-encoded encrypted data
3. **JSONB** - Store encrypted data in JSON structure

**Decision:** BYTEA

**Rationale:**
- More efficient storage (no base64 overhead, ~33% smaller)
- Clearly indicates binary data (type safety)
- Direct byte storage matches encryption output format
- Better performance for read/write operations (no encoding/decoding)

**Consequences:**
- Must encode/decode when transmitting over HTTP (acceptable: standard practice)
- Slightly less human-readable in database tools (acceptable: secrets shouldn't be readable anyway)
- Must use decode() in SQL for base64 input (acceptable: one-time at insert)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/security-model.md` - Zero-knowledge architecture, encryption specs
- [x] `03-security/rbac/permissions-model.md` - Role definitions (Owner, Admin, Developer, Read-Only)
- [x] `TECH-STACK.md` - PostgreSQL 15.x, Supabase specifications
- [x] `GLOSSARY.md` - Database terminology (RLS, ACID, JSONB, UUID, etc.)

**External Services:**
- **Supabase** - Managed PostgreSQL, Auth, Realtime
- **PostgreSQL 15.x** - Database engine
- **PgBouncer** - Connection pooling (managed by Supabase)
- **PostgREST** - Auto-generated REST API (managed by Supabase)

### Architecture Dependencies

**Depends on these components:**
- `auth.users` table - Supabase Auth-managed user table
- Cloudflare Workers - API gateway for database access

**Required by these components:**
- `04-database/schemas/` - Individual table schema definitions (Phase 2)
- `05-api/endpoints/` - API endpoints that query database (Phase 3)
- `07-frontend/` - Frontend components that display database data (Phase 6)

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge encryption architecture
- `03-security/rbac/permissions-model.md` - Role-based access control
- `TECH-STACK.md` - Technology stack specifications
- `GLOSSARY.md` - Database terminology definitions
- `DOCUMENTATION-ROADMAP.md` - Phase 2 (Data Layer) requirements

### External Resources
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/) - Official PostgreSQL docs
- [Supabase Documentation](https://supabase.com/docs) - Supabase platform docs
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS best practices
- [PostgREST Documentation](https://postgrest.org/) - Auto-generated API reference
- [PgBouncer Documentation](https://www.pgbouncer.org/) - Connection pooling
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) - Security best practices

### Database Design Patterns
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/sharding) - Isolation strategies
- [Audit Logging Patterns](https://martinfowler.com/eaaDev/AuditLog.html) - Immutable audit trails

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Database Architect / Backend Lead | Initial database architecture overview document |

---

## Notes

### Future Enhancements
- **Read replicas** - Offload reporting queries to read replicas (Phase 4+)
- **Table partitioning** - Partition audit_logs by timestamp when table grows large (Phase 4+)
- **Materialized views** - Pre-compute expensive aggregations for dashboards (Phase 4+)
- **Database-level encryption** - Transparent Data Encryption (TDE) for additional security layer (Phase 5+)

### Known Issues
- RLS adds ~5-10% query overhead (acceptable for security benefit)
- No cross-organization queries possible (by design for isolation)
- BYTEA columns not human-readable in database tools (by design for security)

### Next Review Date
**2026-01-30** - Review scaling approach, performance metrics, and optimization needs after 3 months of production usage
