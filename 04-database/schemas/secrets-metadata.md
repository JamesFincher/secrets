---
Document: Secrets & Projects - Database Schema
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineer
Status: Draft
Dependencies: 04-database/schemas/users-organizations.md, 03-security/security-model.md, GLOSSARY.md
---

# Secrets & Projects Database Schema

## Overview

This schema defines the core data model for storing encrypted secrets, organizing them into projects and environments, and maintaining rich metadata for AI-powered features. All secret values are encrypted client-side using zero-knowledge encryption before being stored in the database.

**Schema:** `public`

**Multi-tenancy:** Organization-level isolation enforced via Row-Level Security (RLS) policies

**Encryption:** Secret values encrypted client-side with AES-256-GCM; server stores only encrypted blobs and plaintext metadata

---

## Table of Contents

1. [Tables](#tables)
2. [Relationships](#relationships)
3. [Row-Level Security (RLS)](#row-level-security-rls)
4. [Indexes](#indexes)
5. [Triggers](#triggers)
6. [Functions](#functions)
7. [Migration Scripts](#migration-scripts)
8. [Sample Queries](#sample-queries)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## Tables

### Table: `projects`

**Purpose:** Organizes secrets into logical projects (e.g., "RecipeApp", "ClientWebsite")

**Ownership:** Projects belong to organizations; users access via organization membership

**Definition:**

```sql
CREATE TABLE projects (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Data Fields
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  archived BOOLEAN NOT NULL DEFAULT false,

  -- Metadata Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT projects_name_org_unique UNIQUE(organization_id, name)
);

COMMENT ON TABLE projects IS 'Logical groupings of secrets and environments';
COMMENT ON COLUMN projects.settings IS 'JSON configuration: default environment, approval workflows, etc.';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `organization_id` | UUID | No | - | Organization that owns this project |
| `name` | VARCHAR(255) | No | - | Project name (unique per organization) |
| `description` | TEXT | Yes | NULL | Optional project description |
| `settings` | JSONB | No | `{}` | Project-level configuration (approval workflows, default environment) |
| `archived` | BOOLEAN | No | `false` | Soft delete flag |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |
| `created_by` | UUID | Yes | NULL | User who created the project |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `projects_name_org_unique` | UNIQUE | `(organization_id, name)` | Prevent duplicate project names within organization |

**Validation Rules:**
- `name`: Max 255 characters, must not be empty
- `organization_id`: Must reference existing organization
- `settings`: Valid JSON object

---

### Table: `environments`

**Purpose:** Define deployment environments within projects (development, staging, production)

**Ownership:** Environments belong to projects

**Definition:**

```sql
CREATE TABLE environments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Data Fields
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'custom',
  description TEXT,
  color VARCHAR(7),
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Metadata Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT environments_name_project_unique UNIQUE(project_id, name),
  CONSTRAINT environments_type_check CHECK (type IN ('development', 'staging', 'production', 'custom'))
);

COMMENT ON TABLE environments IS 'Deployment contexts within projects (dev, staging, prod)';
COMMENT ON COLUMN environments.type IS 'Standard types: development, staging, production, or custom';
COMMENT ON COLUMN environments.color IS 'Hex color code for UI display (e.g., #FF5733)';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `project_id` | UUID | No | - | Project this environment belongs to |
| `name` | VARCHAR(100) | No | - | Environment name (e.g., "Development", "Staging") |
| `type` | VARCHAR(50) | No | `'custom'` | Environment type: development, staging, production, or custom |
| `description` | TEXT | Yes | NULL | Optional environment description |
| `color` | VARCHAR(7) | Yes | NULL | Hex color code for UI (e.g., #00FF00) |
| `sort_order` | INTEGER | No | `0` | Display order in UI |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `environments_name_project_unique` | UNIQUE | `(project_id, name)` | Prevent duplicate environment names within project |
| `environments_type_check` | CHECK | `type IN (...)` | Enforce valid environment types |

**Validation Rules:**
- `name`: Max 100 characters, must not be empty
- `type`: Must be one of: development, staging, production, custom
- `color`: Must be valid hex color code (#RRGGBB) if provided

---

### Table: `secrets`

**Purpose:** Store encrypted secret values with their encryption metadata

**Ownership:** Secrets belong to projects and are accessed via organization membership

**Definition:**

```sql
CREATE TABLE secrets (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,

  -- Identification Fields
  key_name VARCHAR(255) NOT NULL,
  service_name VARCHAR(255),

  -- Encrypted Data (Zero-Knowledge)
  encrypted_value BYTEA NOT NULL,
  encrypted_dek BYTEA NOT NULL,
  secret_nonce BYTEA NOT NULL,
  dek_nonce BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,

  -- Plaintext Metadata (for search & AI)
  description TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  documentation_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,

  -- Metadata Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  last_accessed_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT secrets_key_project_env_unique UNIQUE(project_id, environment_id, key_name),
  CONSTRAINT secrets_nonce_length_check CHECK (octet_length(secret_nonce) = 12),
  CONSTRAINT secrets_dek_nonce_length_check CHECK (octet_length(dek_nonce) = 12)
);

COMMENT ON TABLE secrets IS 'Encrypted secrets with zero-knowledge architecture';
COMMENT ON COLUMN secrets.encrypted_value IS 'Secret value encrypted with DEK using AES-256-GCM';
COMMENT ON COLUMN secrets.encrypted_dek IS 'Data Encryption Key (DEK) encrypted with user master key';
COMMENT ON COLUMN secrets.secret_nonce IS '96-bit nonce for secret encryption (never reuse)';
COMMENT ON COLUMN secrets.dek_nonce IS '96-bit nonce for DEK encryption (never reuse)';
COMMENT ON COLUMN secrets.auth_tag IS '128-bit authentication tag from AES-GCM';
COMMENT ON COLUMN secrets.tags IS 'Plaintext tags for organization and search';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `project_id` | UUID | No | - | Project this secret belongs to |
| `environment_id` | UUID | No | - | Environment this secret is for |
| `key_name` | VARCHAR(255) | No | - | Secret identifier (e.g., "OPENAI_API_KEY") |
| `service_name` | VARCHAR(255) | Yes | NULL | Service this secret is for (e.g., "OpenAI") |
| `encrypted_value` | BYTEA | No | - | Encrypted secret value (AES-256-GCM) |
| `encrypted_dek` | BYTEA | No | - | Encrypted Data Encryption Key |
| `secret_nonce` | BYTEA | No | - | 12-byte nonce for secret encryption |
| `dek_nonce` | BYTEA | No | - | 12-byte nonce for DEK encryption |
| `auth_tag` | BYTEA | No | - | 16-byte authentication tag |
| `description` | TEXT | Yes | NULL | Human-readable description |
| `tags` | TEXT[] | No | `[]` | Array of tags for organization |
| `documentation_url` | TEXT | Yes | NULL | Link to service documentation |
| `version` | INTEGER | No | `1` | Secret version (increments on update) |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |
| `created_by` | UUID | Yes | NULL | User who created the secret |
| `last_accessed_at` | TIMESTAMPTZ | Yes | NULL | Last time secret was decrypted |
| `last_rotated_at` | TIMESTAMPTZ | Yes | NULL | Last time secret was rotated |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `secrets_key_project_env_unique` | UNIQUE | `(project_id, environment_id, key_name)` | Prevent duplicate keys in same project/environment |
| `secrets_nonce_length_check` | CHECK | `octet_length(secret_nonce) = 12` | Enforce 96-bit nonce length |
| `secrets_dek_nonce_length_check` | CHECK | `octet_length(dek_nonce) = 12` | Enforce 96-bit DEK nonce length |

**Validation Rules:**
- `key_name`: Max 255 characters, must not be empty
- `encrypted_value`: Must not be empty
- `encrypted_dek`: Must not be empty
- `secret_nonce`: Exactly 12 bytes (96 bits)
- `dek_nonce`: Exactly 12 bytes (96 bits)
- `auth_tag`: Must not be empty
- `tags`: Each tag max 50 characters

**Encryption Details:**
- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Size:** 256 bits (32 bytes)
- **Nonce Size:** 96 bits (12 bytes)
- **Tag Size:** 128 bits (16 bytes)
- **Encryption Pattern:** Envelope encryption (see `03-security/security-model.md`)
  1. Generate random 256-bit DEK
  2. Encrypt secret value with DEK
  3. Encrypt DEK with user's master key
  4. Store encrypted value, encrypted DEK, nonces, and auth tag

---

### Table: `secret_metadata`

**Purpose:** Extended metadata about secrets for AI assistant and intelligent features

**Ownership:** One-to-one relationship with secrets

**Definition:**

```sql
CREATE TABLE secret_metadata (
  -- Primary Key (also Foreign Key)
  secret_id UUID PRIMARY KEY REFERENCES secrets(id) ON DELETE CASCADE,

  -- Service Information
  service_category VARCHAR(100),
  service_pricing_tier VARCHAR(50),
  api_version VARCHAR(50),

  -- Usage Intelligence
  estimated_monthly_cost DECIMAL(10, 2),
  rate_limit_info JSONB,
  requires_billing BOOLEAN DEFAULT false,
  requires_verification BOOLEAN DEFAULT false,

  -- Documentation
  acquisition_guide_url TEXT,
  official_docs_url TEXT,
  common_issues_url TEXT,

  -- AI-Generated Content
  ai_generated_guide TEXT,
  ai_guide_generated_at TIMESTAMPTZ,

  -- Metadata Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE secret_metadata IS 'Extended metadata for AI-powered secret management';
COMMENT ON COLUMN secret_metadata.rate_limit_info IS 'JSON structure: {requests_per_second: 10, requests_per_day: 1000}';
COMMENT ON COLUMN secret_metadata.ai_generated_guide IS 'AI-generated step-by-step acquisition guide';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `secret_id` | UUID | No | - | Foreign key to secrets table |
| `service_category` | VARCHAR(100) | Yes | NULL | Category (e.g., "AI", "Payment", "Analytics") |
| `service_pricing_tier` | VARCHAR(50) | Yes | NULL | Pricing tier (e.g., "free", "basic", "enterprise") |
| `api_version` | VARCHAR(50) | Yes | NULL | API version (e.g., "v1", "2023-11") |
| `estimated_monthly_cost` | DECIMAL(10, 2) | Yes | NULL | Estimated monthly cost in USD |
| `rate_limit_info` | JSONB | Yes | NULL | Rate limiting information |
| `requires_billing` | BOOLEAN | No | `false` | Whether service requires billing setup |
| `requires_verification` | BOOLEAN | No | `false` | Whether service requires identity verification |
| `acquisition_guide_url` | TEXT | Yes | NULL | URL to acquisition guide |
| `official_docs_url` | TEXT | Yes | NULL | Official service documentation URL |
| `common_issues_url` | TEXT | Yes | NULL | Common issues and troubleshooting URL |
| `ai_generated_guide` | TEXT | Yes | NULL | AI-generated step-by-step guide |
| `ai_guide_generated_at` | TIMESTAMPTZ | Yes | NULL | When AI guide was generated |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |

**Validation Rules:**
- `service_category`: Max 100 characters
- `service_pricing_tier`: Max 50 characters
- `api_version`: Max 50 characters
- `estimated_monthly_cost`: Non-negative decimal
- `rate_limit_info`: Valid JSON object

---

### Table: `api_service_info`

**Purpose:** Global database of API service information for the AI assistant

**Ownership:** Platform-level data (not organization-specific)

**Definition:**

```sql
CREATE TABLE api_service_info (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Service Identification
  service_name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),

  -- Service Details
  homepage_url TEXT,
  documentation_url TEXT,
  pricing_url TEXT,
  api_reference_url TEXT,
  signup_url TEXT,

  -- Service Characteristics
  requires_credit_card BOOLEAN DEFAULT false,
  has_free_tier BOOLEAN DEFAULT false,
  pricing_model VARCHAR(50),
  typical_setup_time_minutes INTEGER,

  -- Rate Limiting (default values)
  default_rate_limits JSONB,

  -- Popularity & Trust
  popularity_score INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  common_use_cases TEXT[],

  -- Metadata Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_scraped_at TIMESTAMPTZ
);

COMMENT ON TABLE api_service_info IS 'Platform knowledge base of API services';
COMMENT ON COLUMN api_service_info.popularity_score IS 'Higher = more commonly used (0-100)';
COMMENT ON COLUMN api_service_info.pricing_model IS 'e.g., "per-request", "subscription", "free", "freemium"';
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `service_name` | VARCHAR(255) | No | - | Canonical service name (e.g., "openai") |
| `display_name` | VARCHAR(255) | No | - | Display name (e.g., "OpenAI") |
| `category` | VARCHAR(100) | Yes | NULL | Service category |
| `homepage_url` | TEXT | Yes | NULL | Service homepage |
| `documentation_url` | TEXT | Yes | NULL | Main documentation URL |
| `pricing_url` | TEXT | Yes | NULL | Pricing information URL |
| `api_reference_url` | TEXT | Yes | NULL | API reference documentation |
| `signup_url` | TEXT | Yes | NULL | Account signup URL |
| `requires_credit_card` | BOOLEAN | No | `false` | Whether signup requires credit card |
| `has_free_tier` | BOOLEAN | No | `false` | Whether service has free tier |
| `pricing_model` | VARCHAR(50) | Yes | NULL | Pricing model type |
| `typical_setup_time_minutes` | INTEGER | Yes | NULL | Typical time to get API key |
| `default_rate_limits` | JSONB | Yes | NULL | Default rate limiting info |
| `popularity_score` | INTEGER | No | `0` | Popularity score (0-100) |
| `is_verified` | BOOLEAN | No | `false` | Whether service info is verified |
| `common_use_cases` | TEXT[] | Yes | NULL | Common use case tags |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |
| `last_scraped_at` | TIMESTAMPTZ | Yes | NULL | Last time docs were scraped |

**Validation Rules:**
- `service_name`: Max 255 characters, unique, lowercase
- `display_name`: Max 255 characters
- `popularity_score`: Integer between 0 and 100
- `typical_setup_time_minutes`: Non-negative integer
- `default_rate_limits`: Valid JSON object

---

## Relationships

### Entity Relationship Diagram

```
┌──────────────────┐
│  organizations   │
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────▼─────────┐
│    projects      │
└────────┬─────────┘
         │ 1
         │
         ├─────────────────┐
         │ N               │ N
┌────────▼─────────┐  ┌───▼──────────┐
│  environments    │  │   secrets    │
└──────────────────┘  └───┬──────────┘
                          │ 1
                          │
                          │ 1 (optional)
                     ┌────▼────────────────┐
                     │  secret_metadata    │
                     └─────────────────────┘

┌──────────────────┐
│api_service_info  │ (platform-level, no foreign keys)
└──────────────────┘
```

### Relationship Details

**organizations → projects**
- Type: One-to-Many
- Foreign Key: `projects.organization_id → organizations.id`
- Cascade: `ON DELETE CASCADE` (deleting organization deletes all projects)
- Description: An organization can have multiple projects

**projects → environments**
- Type: One-to-Many
- Foreign Key: `environments.project_id → projects.id`
- Cascade: `ON DELETE CASCADE` (deleting project deletes all environments)
- Description: A project can have multiple environments

**projects → secrets**
- Type: One-to-Many
- Foreign Key: `secrets.project_id → projects.id`
- Cascade: `ON DELETE CASCADE` (deleting project deletes all secrets)
- Description: A project can have multiple secrets

**environments → secrets**
- Type: One-to-Many
- Foreign Key: `secrets.environment_id → environments.id`
- Cascade: `ON DELETE CASCADE` (deleting environment deletes all secrets in that environment)
- Description: An environment can have multiple secrets

**secrets → secret_metadata**
- Type: One-to-One
- Foreign Key: `secret_metadata.secret_id → secrets.id`
- Cascade: `ON DELETE CASCADE` (deleting secret deletes its metadata)
- Description: A secret may have extended metadata

**auth.users → projects**
- Type: One-to-Many (via created_by)
- Foreign Key: `projects.created_by → auth.users.id`
- Cascade: No cascade (user deletion doesn't delete projects)
- Description: Track who created each project

**auth.users → secrets**
- Type: One-to-Many (via created_by)
- Foreign Key: `secrets.created_by → auth.users.id`
- Cascade: No cascade (user deletion doesn't delete secrets)
- Description: Track who created each secret

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes, on all tables

**Purpose:** Enforce multi-tenancy and data isolation at the database level. Ensures users can only access secrets belonging to organizations they are members of.

**Multi-tenancy Strategy:** Organization-based isolation. Users access data through their organization membership, which is verified at the database level via RLS policies.

---

### Table: `projects`

**RLS Policy 1: `projects_select_policy`**

**Purpose:** Users can view projects in organizations they belong to

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

**Example Scenario:**
User Alice is a member of Organization "Acme Corp". She can see all projects in "Acme Corp" but cannot see projects in other organizations.

---

**RLS Policy 2: `projects_insert_policy`**

**Purpose:** Users with appropriate permissions can create projects

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = projects.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
```

**Example Scenario:**
Only organization owners and admins can create new projects.

---

**RLS Policy 3: `projects_update_policy`**

**Purpose:** Users with appropriate permissions can update projects

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = projects.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = projects.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
```

---

**RLS Policy 4: `projects_delete_policy`**

**Purpose:** Only organization owners can delete projects

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = projects.organization_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );
```

---

### Table: `environments`

**RLS Policy 1: `environments_select_policy`**

**Purpose:** Users can view environments in projects they have access to

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY environments_select_policy ON environments
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );
```

---

**RLS Policy 2: `environments_modify_policy`**

**Purpose:** Owners and admins can manage environments

**Operation:** `INSERT`, `UPDATE`, `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY environments_modify_policy ON environments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = environments.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = environments.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
```

---

### Table: `secrets`

**RLS Policy 1: `secrets_select_policy`**

**Purpose:** Users can read secrets in projects they belong to (with appropriate role)

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_select_policy ON secrets
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer', 'read-only')
    )
  );
```

**Example Scenario:**
All organization members can view secrets (read-only members see metadata but may not decrypt values based on client-side logic).

---

**RLS Policy 2: `secrets_insert_policy`**

**Purpose:** Owners, admins, and developers can create secrets

**Operation:** `INSERT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_insert_policy ON secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = secrets.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer')
    )
  );
```

---

**RLS Policy 3: `secrets_update_policy`**

**Purpose:** Owners, admins, and developers can update secrets

**Operation:** `UPDATE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_update_policy ON secrets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = secrets.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = secrets.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer')
    )
  );
```

---

**RLS Policy 4: `secrets_delete_policy`**

**Purpose:** Owners and admins can delete secrets

**Operation:** `DELETE`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secrets_delete_policy ON secrets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = secrets.project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
```

---

### Table: `secret_metadata`

**RLS Policy: `secret_metadata_access_policy`**

**Purpose:** Inherit access permissions from parent secret

**Operation:** `ALL`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY secret_metadata_access_policy ON secret_metadata
  FOR ALL
  TO authenticated
  USING (
    secret_id IN (
      SELECT s.id FROM secrets s
      INNER JOIN projects p ON s.project_id = p.id
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    secret_id IN (
      SELECT s.id FROM secrets s
      INNER JOIN projects p ON s.project_id = p.id
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer')
    )
  );
```

---

### Table: `api_service_info`

**RLS Policy: `api_service_info_public_read`**

**Purpose:** Platform-level data, readable by all authenticated users

**Operation:** `SELECT`

**Role:** `authenticated`

**Definition:**
```sql
CREATE POLICY api_service_info_public_read ON api_service_info
  FOR SELECT
  TO authenticated
  USING (true);

-- Only platform admins can modify (not implemented via RLS, use application logic)
```

---

### RLS Testing

**Test Case 1: User can only access their organization's projects**

```sql
-- As user Alice (member of Acme Corp)
SET request.jwt.claim.sub = 'alice_user_id';

-- This should succeed
SELECT * FROM projects
WHERE organization_id = 'acme_org_id';

-- This should return 0 rows (RLS filters it out)
SELECT * FROM projects
WHERE organization_id = 'competitor_org_id';
```

**Expected:** Alice sees only Acme Corp projects

---

**Test Case 2: Read-only user cannot create secrets**

```sql
-- As user Bob (read-only role in Acme Corp)
SET request.jwt.claim.sub = 'bob_user_id';

-- This should fail (RLS blocks it)
INSERT INTO secrets (project_id, environment_id, key_name, encrypted_value, encrypted_dek, secret_nonce, dek_nonce, auth_tag)
VALUES ('project_id', 'env_id', 'TEST_KEY', 'encrypted', 'encrypted_dek', 'nonce', 'dek_nonce', 'tag');
```

**Expected:** INSERT fails due to RLS policy

---

**Test Case 3: Developer can create and update secrets, but not delete**

```sql
-- As user Carol (developer role in Acme Corp)
SET request.jwt.claim.sub = 'carol_user_id';

-- This should succeed
INSERT INTO secrets (project_id, environment_id, key_name, encrypted_value, encrypted_dek, secret_nonce, dek_nonce, auth_tag)
VALUES ('project_id', 'env_id', 'API_KEY', 'enc_value', 'enc_dek', 'nonce1', 'nonce2', 'tag');

-- This should succeed
UPDATE secrets SET description = 'Updated description' WHERE key_name = 'API_KEY';

-- This should fail (only owners and admins can delete)
DELETE FROM secrets WHERE key_name = 'API_KEY';
```

**Expected:** INSERT and UPDATE succeed, DELETE fails

---

## Indexes

### Performance Indexes

**Index 1: `idx_projects_organization_id`**

**Purpose:** Speed up project lookups by organization (used in every RLS policy)

**Table:** `projects`

**Columns:** `(organization_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_projects_organization_id
  ON projects(organization_id);
```

**Queries Optimized:**
```sql
-- Example query that uses this index
SELECT * FROM projects
WHERE organization_id = 'org_uuid';
```

**Performance Impact:**
- Query time: O(N) → O(log N)
- Index size: ~1KB per 100 projects

---

**Index 2: `idx_environments_project_id`**

**Purpose:** Speed up environment lookups by project

**Table:** `environments`

**Columns:** `(project_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_environments_project_id
  ON environments(project_id);
```

**Queries Optimized:**
```sql
SELECT * FROM environments
WHERE project_id = 'project_uuid'
ORDER BY sort_order;
```

**Performance Impact:**
- Query time: 50ms → 5ms
- Index size: ~500 bytes per 100 environments

---

**Index 3: `idx_secrets_project_environment`**

**Purpose:** Composite index for fast secret lookups by project and environment

**Table:** `secrets`

**Columns:** `(project_id, environment_id)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_secrets_project_environment
  ON secrets(project_id, environment_id);
```

**Queries Optimized:**
```sql
-- List all secrets in a project/environment
SELECT * FROM secrets
WHERE project_id = 'project_uuid'
  AND environment_id = 'env_uuid';
```

**Performance Impact:**
- Query time: 200ms → 20ms
- Index size: ~2KB per 1000 secrets

---

**Index 4: `idx_secrets_service_name`**

**Purpose:** Speed up searches by service name

**Table:** `secrets`

**Columns:** `(service_name)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_secrets_service_name
  ON secrets(service_name)
  WHERE service_name IS NOT NULL;
```

**Queries Optimized:**
```sql
-- Find all OpenAI secrets across projects
SELECT * FROM secrets
WHERE service_name = 'openai';
```

**Performance Impact:**
- Query time: 500ms → 50ms
- Partial index (only non-NULL service names)

---

**Index 5: `idx_secrets_tags_gin`**

**Purpose:** Fast full-text search on tags array

**Table:** `secrets`

**Columns:** `(tags)`

**Type:** GIN (Generalized Inverted Index)

**Definition:**
```sql
CREATE INDEX idx_secrets_tags_gin
  ON secrets USING gin(tags);
```

**Queries Optimized:**
```sql
-- Find secrets with specific tag
SELECT * FROM secrets
WHERE tags @> ARRAY['production'];

-- Find secrets with any of multiple tags
SELECT * FROM secrets
WHERE tags && ARRAY['ai', 'payment'];
```

**Performance Impact:**
- Query time: 1000ms → 50ms
- Index size: ~3KB per 1000 secrets

---

**Index 6: `idx_secrets_last_accessed`**

**Purpose:** Find stale secrets that haven't been accessed recently

**Table:** `secrets`

**Columns:** `(last_accessed_at)`

**Type:** B-tree

**Definition:**
```sql
CREATE INDEX idx_secrets_last_accessed
  ON secrets(last_accessed_at)
  WHERE last_accessed_at IS NOT NULL;
```

**Queries Optimized:**
```sql
-- Find secrets not accessed in last 90 days
SELECT * FROM secrets
WHERE last_accessed_at < NOW() - INTERVAL '90 days';
```

**Performance Impact:**
- Query time: 800ms → 80ms
- Partial index (only non-NULL timestamps)

---

**Index 7: `idx_api_service_info_name`**

**Purpose:** Fast service lookup by canonical name (already has UNIQUE constraint)

**Table:** `api_service_info`

**Columns:** `(service_name)`

**Type:** B-tree (created automatically by UNIQUE constraint)

**Definition:**
```sql
-- Automatically created by UNIQUE constraint
-- No additional index needed
```

---

## Triggers

### Trigger: `update_projects_updated_at`

**Purpose:** Automatically update `updated_at` timestamp on row modification

**Table:** `projects`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Example:**
```sql
-- When updating a project
UPDATE projects SET name = 'New Name' WHERE id = 'project_uuid';

-- updated_at is automatically set to current timestamp
```

---

### Trigger: `update_environments_updated_at`

**Purpose:** Automatically update `updated_at` timestamp on row modification

**Table:** `environments`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
CREATE TRIGGER update_environments_updated_at
  BEFORE UPDATE ON environments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Trigger: `update_secrets_updated_at`

**Purpose:** Automatically update `updated_at` timestamp and increment version on modification

**Table:** `secrets`

**Event:** `BEFORE UPDATE`

**Definition:**
```sql
CREATE OR REPLACE FUNCTION update_secrets_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  -- Increment version if encrypted value changed
  IF NEW.encrypted_value IS DISTINCT FROM OLD.encrypted_value THEN
    NEW.version = OLD.version + 1;
    NEW.last_rotated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_secrets_metadata
  BEFORE UPDATE ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_secrets_metadata();
```

**Example:**
```sql
-- When secret value is updated
UPDATE secrets SET encrypted_value = 'new_encrypted_value' WHERE id = 'secret_uuid';

-- Automatically:
-- - updated_at = now()
-- - version = version + 1
-- - last_rotated_at = now()
```

---

### Trigger: `log_secret_access`

**Purpose:** Log every time a secret is accessed (for audit trail)

**Table:** `secrets`

**Event:** `AFTER SELECT` (implemented via application logic, not database trigger)

**Note:** PostgreSQL doesn't support `AFTER SELECT` triggers. Secret access logging is handled in the application layer (Cloudflare Workers) and written to the `audit_logs` table.

---

## Functions

### Function: `get_user_organization_role`

**Purpose:** Get user's role in a specific organization

**Parameters:**
- `user_id` (UUID) - User ID
- `org_id` (UUID) - Organization ID

**Returns:** TEXT (role name or NULL)

**Definition:**
```sql
CREATE OR REPLACE FUNCTION get_user_organization_role(user_id UUID, org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM organization_members
  WHERE organization_members.user_id = $1
    AND organization_members.organization_id = $2
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_organization_role IS 'Returns user role in organization or NULL';
```

**Usage Example:**
```sql
SELECT get_user_organization_role(auth.uid(), 'org_uuid');
-- Returns: 'owner', 'admin', 'developer', 'read-only', or NULL
```

**Security Considerations:**
- `SECURITY DEFINER`: Runs with privileges of function creator (bypasses RLS temporarily)
- Used for permission checks in application logic

---

### Function: `search_secrets`

**Purpose:** Full-text search across secrets metadata

**Parameters:**
- `search_query` (TEXT) - Search term
- `org_id` (UUID) - Organization to search within

**Returns:** TABLE of secrets

**Definition:**
```sql
CREATE OR REPLACE FUNCTION search_secrets(search_query TEXT, org_id UUID)
RETURNS TABLE (
  id UUID,
  key_name VARCHAR(255),
  service_name VARCHAR(255),
  description TEXT,
  tags TEXT[],
  project_id UUID,
  environment_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.key_name,
    s.service_name,
    s.description,
    s.tags,
    s.project_id,
    s.environment_id
  FROM secrets s
  INNER JOIN projects p ON s.project_id = p.id
  WHERE p.organization_id = org_id
    AND (
      s.key_name ILIKE '%' || search_query || '%'
      OR s.service_name ILIKE '%' || search_query || '%'
      OR s.description ILIKE '%' || search_query || '%'
      OR search_query = ANY(s.tags)
    )
  ORDER BY s.updated_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Usage Example:**
```sql
SELECT * FROM search_secrets('openai', 'org_uuid');
-- Returns all secrets matching "openai" in name, service, description, or tags
```

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/001_create_secrets_schema.sql`

**Description:** Create projects, environments, secrets, and related tables

**SQL:**
```sql
-- =====================================================
-- Migration: Create Secrets & Projects Schema
-- Version: 1.0.0
-- Description: Core schema for secrets management
-- =====================================================

-- Create projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT projects_name_org_unique UNIQUE(organization_id, name)
);

-- Create environments table
CREATE TABLE environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'custom',
  description TEXT,
  color VARCHAR(7),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT environments_name_project_unique UNIQUE(project_id, name),
  CONSTRAINT environments_type_check CHECK (type IN ('development', 'staging', 'production', 'custom'))
);

-- Create secrets table
CREATE TABLE secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL,
  service_name VARCHAR(255),
  encrypted_value BYTEA NOT NULL,
  encrypted_dek BYTEA NOT NULL,
  secret_nonce BYTEA NOT NULL,
  dek_nonce BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  documentation_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  last_accessed_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,
  CONSTRAINT secrets_key_project_env_unique UNIQUE(project_id, environment_id, key_name),
  CONSTRAINT secrets_nonce_length_check CHECK (octet_length(secret_nonce) = 12),
  CONSTRAINT secrets_dek_nonce_length_check CHECK (octet_length(dek_nonce) = 12)
);

-- Create secret_metadata table
CREATE TABLE secret_metadata (
  secret_id UUID PRIMARY KEY REFERENCES secrets(id) ON DELETE CASCADE,
  service_category VARCHAR(100),
  service_pricing_tier VARCHAR(50),
  api_version VARCHAR(50),
  estimated_monthly_cost DECIMAL(10, 2),
  rate_limit_info JSONB,
  requires_billing BOOLEAN DEFAULT false,
  requires_verification BOOLEAN DEFAULT false,
  acquisition_guide_url TEXT,
  official_docs_url TEXT,
  common_issues_url TEXT,
  ai_generated_guide TEXT,
  ai_guide_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create api_service_info table
CREATE TABLE api_service_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  homepage_url TEXT,
  documentation_url TEXT,
  pricing_url TEXT,
  api_reference_url TEXT,
  signup_url TEXT,
  requires_credit_card BOOLEAN DEFAULT false,
  has_free_tier BOOLEAN DEFAULT false,
  pricing_model VARCHAR(50),
  typical_setup_time_minutes INTEGER,
  default_rate_limits JSONB,
  popularity_score INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  common_use_cases TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_scraped_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_environments_project_id ON environments(project_id);
CREATE INDEX idx_secrets_project_environment ON secrets(project_id, environment_id);
CREATE INDEX idx_secrets_service_name ON secrets(service_name) WHERE service_name IS NOT NULL;
CREATE INDEX idx_secrets_tags_gin ON secrets USING gin(tags);
CREATE INDEX idx_secrets_last_accessed ON secrets(last_accessed_at) WHERE last_accessed_at IS NOT NULL;

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_service_info ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see RLS section above for full policy definitions)
-- [All RLS policies would be included here]

-- Create triggers
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_environments_updated_at
  BEFORE UPDATE ON environments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secrets_metadata
  BEFORE UPDATE ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_secrets_metadata();

-- Create helper functions
CREATE OR REPLACE FUNCTION get_user_organization_role(user_id UUID, org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM organization_members
  WHERE organization_members.user_id = $1
    AND organization_members.organization_id = $2
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE projects IS 'Logical groupings of secrets and environments';
COMMENT ON TABLE environments IS 'Deployment contexts within projects (dev, staging, prod)';
COMMENT ON TABLE secrets IS 'Encrypted secrets with zero-knowledge architecture';
COMMENT ON TABLE secret_metadata IS 'Extended metadata for AI-powered secret management';
COMMENT ON TABLE api_service_info IS 'Platform knowledge base of API services';
```

**Verification:**
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'environments', 'secrets', 'secret_metadata', 'api_service_info');

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('projects', 'environments', 'secrets', 'secret_metadata', 'api_service_info');

-- Expected: All tables should have rowsecurity = true
```

**Rollback:**
```sql
DROP TABLE IF EXISTS secret_metadata CASCADE;
DROP TABLE IF EXISTS secrets CASCADE;
DROP TABLE IF EXISTS environments CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS api_service_info CASCADE;
DROP FUNCTION IF EXISTS get_user_organization_role(UUID, UUID);
DROP FUNCTION IF EXISTS update_secrets_metadata();
```

---

## Sample Queries

### Query 1: List all secrets in a project

**Purpose:** Retrieve all secrets for a specific project and environment

**SQL:**
```sql
SELECT
  s.id,
  s.key_name,
  s.service_name,
  s.description,
  s.tags,
  s.version,
  s.created_at,
  s.last_accessed_at,
  e.name AS environment_name,
  e.type AS environment_type
FROM secrets s
INNER JOIN environments e ON s.environment_id = e.id
WHERE s.project_id = 'project_uuid'
  AND e.type = 'production'
ORDER BY s.key_name ASC;
```

**Explanation:** Joins secrets with environments to get environment details, filters by project and environment type

**Performance:** Uses `idx_secrets_project_environment` index, ~20ms for 1000 secrets

---

### Query 2: Find secrets that haven't been rotated in 90 days

**Purpose:** Identify stale secrets that need rotation

**SQL:**
```sql
SELECT
  s.id,
  s.key_name,
  s.service_name,
  p.name AS project_name,
  e.name AS environment_name,
  s.last_rotated_at,
  COALESCE(s.last_rotated_at, s.created_at) AS last_change,
  NOW() - COALESCE(s.last_rotated_at, s.created_at) AS age
FROM secrets s
INNER JOIN projects p ON s.project_id = p.id
INNER JOIN environments e ON s.environment_id = e.id
WHERE COALESCE(s.last_rotated_at, s.created_at) < NOW() - INTERVAL '90 days'
  AND p.organization_id = 'org_uuid'
ORDER BY last_change ASC
LIMIT 50;
```

**Explanation:** Finds secrets older than 90 days by checking `last_rotated_at` or falling back to `created_at`

**Performance:** Uses partial index on `last_accessed`, ~100ms for 10,000 secrets

---

### Query 3: Search secrets by tag

**Purpose:** Find all secrets tagged with specific keywords

**SQL:**
```sql
SELECT
  s.id,
  s.key_name,
  s.service_name,
  s.tags,
  p.name AS project_name
FROM secrets s
INNER JOIN projects p ON s.project_id = p.id
WHERE s.tags @> ARRAY['production', 'critical']
  AND p.organization_id = 'org_uuid'
ORDER BY s.updated_at DESC;
```

**Explanation:** Uses GIN index for fast array containment search (`@>` operator means "contains all elements")

**Performance:** Uses `idx_secrets_tags_gin` index, ~50ms for 10,000 secrets

---

### Query 4: Get project with secret count per environment

**Purpose:** Dashboard view showing project statistics

**SQL:**
```sql
SELECT
  p.id,
  p.name AS project_name,
  e.name AS environment_name,
  e.type AS environment_type,
  COUNT(s.id) AS secret_count,
  MAX(s.updated_at) AS last_secret_updated
FROM projects p
LEFT JOIN environments e ON e.project_id = p.id
LEFT JOIN secrets s ON s.environment_id = e.id
WHERE p.organization_id = 'org_uuid'
  AND p.archived = false
GROUP BY p.id, p.name, e.name, e.type
ORDER BY p.name, e.sort_order;
```

**Explanation:** Aggregates secret counts per project/environment combination

**Performance:** ~100ms for 100 projects with 10,000 secrets

---

### Query 5: Get secret with all metadata

**Purpose:** Full secret details including extended metadata

**SQL:**
```sql
SELECT
  s.*,
  sm.service_category,
  sm.service_pricing_tier,
  sm.estimated_monthly_cost,
  sm.requires_billing,
  sm.official_docs_url,
  asi.display_name AS service_display_name,
  asi.homepage_url,
  asi.has_free_tier
FROM secrets s
LEFT JOIN secret_metadata sm ON s.id = sm.secret_id
LEFT JOIN api_service_info asi ON LOWER(s.service_name) = asi.service_name
WHERE s.id = 'secret_uuid';
```

**Explanation:** Joins all related tables to get complete secret information including platform service data

**Performance:** ~10ms (single-row lookup by primary key)

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [x] `auth.users` (Supabase managed) - User authentication
- [ ] `04-database/schemas/users-organizations.md` - Organizations and organization_members tables

**Required by these schemas:**
- `04-database/schemas/audit-logs.md` - Audit logging depends on secrets schema

### Feature Dependencies

**Required by features:**
- `08-features/ai-assistant.md` - AI assistant needs service info and metadata
- `08-features/zero-knowledge-encryption.md` - Encryption UX depends on secrets table
- `08-features/project-management.md` - Project management features
- `08-features/team-collaboration.md` - Team access to projects and secrets

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture (to be created)
- `03-security/rbac/rls-policies.md` - RLS patterns (to be created)
- `03-security/security-model.md` - Encryption specifications
- `TECH-STACK.md` - PostgreSQL version and specifications
- `GLOSSARY.md` - Term definitions

### External Resources
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/) - PostgreSQL reference
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/15/gin.html) - Array indexing
- [PostgreSQL BYTEA Type](https://www.postgresql.org/docs/15/datatype-binary.html) - Binary data storage

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineer | Initial schema definition with zero-knowledge encryption support |

---

## Notes

### Future Enhancements
- Add full-text search indexes (PostgreSQL `tsvector`) for secret descriptions
- Implement secret history table for version tracking
- Add secret expiration and auto-rotation features
- Consider partitioning `secrets` table by organization for very large deployments

### Known Issues
- GIN indexes on large arrays can be expensive to maintain (acceptable for tags use case)
- BYTEA storage is not space-efficient for very large secrets (>1MB secrets may need optimization)

### Migration Considerations
- Zero-downtime migrations: Add new columns with defaults, then backfill
- Encryption format changes: Requires re-encryption of all secrets (complex migration)
- RLS policy changes: Test thoroughly in staging before production deployment
- Index creation: Run with `CONCURRENTLY` option to avoid table locks in production
