---
Document: Zero-Knowledge Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Security Lead
Status: Draft
Dependencies: 03-security/security-model.md, GLOSSARY.md, TECH-STACK.md
---

# Zero-Knowledge Architecture

## Overview

Abyrith uses a zero-knowledge architecture where the server never has access to your unencrypted secrets—even if we wanted to, even if hackers broke in, we literally cannot read your API keys. Only you, with your master password, can decrypt your secrets. This document explains how this works, what it means for security, and what happens in edge cases like password recovery.

**Purpose:** Define the technical architecture and trust boundaries that ensure Abyrith cannot access user secrets, while maintaining usability and intelligent features.

**Scope:** Client-server encryption architecture, key management, recovery mechanisms, and security guarantees.

**Status:** Draft - defining MVP implementation

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [API Contracts](#api-contracts)
7. [Security Architecture](#security-architecture)
8. [Performance Characteristics](#performance-characteristics)
9. [Scalability](#scalability)
10. [Failure Modes](#failure-modes)
11. [Alternatives Considered](#alternatives-considered)
12. [Decision Log](#decision-log)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**

Traditional secrets management platforms store encryption keys on their servers. This creates a fundamental security risk:
- If the platform is compromised, all secrets are at risk
- Platform employees could theoretically access secrets
- Government subpoenas could force disclosure
- Users must trust the platform operator completely

Most password managers (1Password, LastPass, Bitwarden) solved this with zero-knowledge encryption, but developer secrets managers (HashiCorp Vault, AWS Secrets Manager) still use server-side encryption because they prioritize automation over privacy.

**Pain points:**
- Developers don't trust third-party services with production API keys
- Enterprises require guarantees that sensitive credentials cannot be accessed by vendors
- Security teams need provable encryption that doesn't rely on trust
- Current zero-knowledge solutions lack features like AI assistance and cost tracking

**Why now?**

With Abyrith's AI-native approach and MCP integration, we need to prove we can provide intelligent features (guided acquisition, cost tracking, AI assistance) while maintaining zero-knowledge security. This has never been done before in the developer secrets space.

### Background

**Existing system (if applicable):**

None—this is a greenfield architecture. We're building zero-knowledge from day one rather than retrofitting it later.

**Previous attempts:**

Password managers like 1Password have proven zero-knowledge can work for consumers. We're adapting this proven approach for developer workflows while adding intelligent metadata-based features.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Security Teams | Provable security guarantees | "How do we verify secrets can't be accessed?" |
| Developers | Easy to use, doesn't slow them down | "Will encryption make this complex?" |
| Compliance Officers | Audit trails and compliance | "Can we still get audit logs if it's zero-knowledge?" |
| Product Team | Intelligent features (AI, cost tracking) | "Can we do AI guidance without reading secrets?" |
| Learners/Beginners | Simple setup, no confusion | "What happens if I forget my password?" |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Server-side blindness** - Abyrith servers cannot decrypt user secrets under any circumstance
   - Success metric: Security audit confirms no decryption keys present on server
2. **Client-side encryption** - All encryption/decryption happens in the user's browser before data transmission
   - Success metric: Network traffic analysis shows only encrypted data transmitted
3. **Usable security** - Beginners can use zero-knowledge encryption without understanding cryptography
   - Success metric: 95%+ of first-time users successfully encrypt/decrypt secrets without help
4. **Intelligent features** - Provide AI assistance, cost tracking, and search using only metadata
   - Success metric: AI assistant works fully without accessing secret values

**Secondary goals:**
- Recovery mechanisms that maintain zero-knowledge properties
- Multi-device access without server-side keys
- Team sharing with per-user encryption
- Performance: encryption/decryption in <100ms on modern browsers

### Non-Goals

**Explicitly out of scope:**
- Server-side AI analysis of secret values (breaks zero-knowledge)
- Passwordless authentication without master password (compromises zero-knowledge)
- Client-side key escrow by Abyrith (defeats the purpose)
- Secret recovery without user cooperation (impossible in true zero-knowledge)

### Success Metrics

**How we measure success:**
- **Security audits:** Pass independent security review confirming zero-knowledge claims
- **Penetration testing:** Hired security firm cannot decrypt secrets with full server access
- **User trust:** 80%+ of security-conscious users believe our zero-knowledge claims
- **Usability:** <5% of users contact support about encryption/decryption issues

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                         │
│  ┌────────────────┐                                          │
│  │ Master Password│ (never leaves device)                    │
│  │  "myP@ssw0rd"  │                                          │
│  └───────┬────────┘                                          │
│          │ PBKDF2 (600,000 iterations)                       │
│          ▼                                                   │
│  ┌────────────────┐                                          │
│  │ Master Key     │ (derived, stored in memory only)         │
│  │  [256-bit key] │                                          │
│  └───────┬────────┘                                          │
│          │                                                   │
│          │ AES-256-GCM                                       │
│          ▼                                                   │
│  ┌────────────────┐      ┌─────────────────┐               │
│  │ Secret Value   │─────▶│ Encrypted Blob  │               │
│  │ "sk_live_xxx"  │      │ [encrypted data]│               │
│  └────────────────┘      └────────┬────────┘               │
│                                    │                         │
│  ┌────────────────────────────────┴──────────────────────┐ │
│  │  Only encrypted data crosses browser boundary          │ │
│  └────────────────────────────────┬──────────────────────┘ │
└────────────────────────────────────┼──────────────────────┘
                                     │
                                     │ HTTPS (TLS 1.3)
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Supabase + Workers)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  What Server CAN See:                                   │ │
│  │  - Encrypted blob: "2f8a9b3c..." (meaningless)          │ │
│  │  - Metadata: "Service: Stripe, Environment: production" │ │
│  │  - User ID, project ID, timestamps                      │ │
│  │  - Audit events: "User accessed secret at 2025-10-29"   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  What Server CANNOT See:                                │ │
│  │  ❌ Master password                                      │ │
│  │  ❌ Master key                                           │ │
│  │  ❌ Secret values (even encrypted, we can't decrypt)     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Master Password Handler (Client)**
- **Purpose:** Accepts user password and derives master key
- **Technology:** Web Crypto API (browser-native)
- **Responsibilities:**
  - Accept master password input
  - Derive master key using PBKDF2
  - Store derived key in memory only (never persisted)
  - Clear key from memory on logout

**Component 2: Client-Side Encryptor (Browser)**
- **Purpose:** Encrypt/decrypt secrets before they leave/enter the browser
- **Technology:** Web Crypto API (AES-256-GCM)
- **Responsibilities:**
  - Encrypt plaintext secrets to ciphertext
  - Generate random nonces for each encryption
  - Decrypt ciphertext back to plaintext
  - Validate encryption integrity (GCM auth tags)

**Component 3: Encrypted Storage (Server)**
- **Purpose:** Store encrypted secrets we cannot decrypt
- **Technology:** Supabase PostgreSQL
- **Responsibilities:**
  - Store encrypted blobs
  - Store metadata (service name, tags, timestamps)
  - Enforce access control via RLS
  - Cannot decrypt stored blobs

**Component 4: Metadata Intelligence Engine (Server)**
- **Purpose:** Provide intelligent features using only metadata
- **Technology:** Cloudflare Workers + Claude API
- **Responsibilities:**
  - AI guidance based on service type (not secret value)
  - Cost tracking based on metadata tags
  - Search based on service names and tags
  - Never accesses encrypted secret values

### Component Interactions

**Client ↔ Server:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: JWT Bearer token (from Supabase Auth)
- Encryption boundary: Client encrypts before sending, server stores encrypted blobs, client decrypts after receiving

**Server ↔ Database:**
- Protocol: PostgreSQL wire protocol
- Data format: Encrypted blobs (bytea) + metadata (JSONB)
- Authorization: Row-Level Security (RLS) policies
- Server can query metadata but cannot decrypt blobs

---

## Component Details

### Component: Master Password Handler

**Purpose:** Securely derive encryption keys from user passwords without ever transmitting the password.

**Responsibilities:**
- Accept user password input
- Derive master key using PBKDF2 (Password-Based Key Derivation Function 2)
- Store derived key in JavaScript memory (sessionStorage for persistence across page refreshes)
- Clear key from memory on logout or session expiration
- Never log, transmit, or persist the master password itself

**Technology Stack:**
- Web Crypto API - `crypto.subtle.importKey()` and `crypto.subtle.deriveKey()`
- PBKDF2 algorithm with 600,000 iterations (OWASP recommendation 2024)
- SHA-256 hash function
- 256-bit key output

**Internal Architecture:**
```typescript
// Master Password Handler
class MasterKeyDerivation {
  private masterKey: CryptoKey | null = null;

  async deriveMasterKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive master key
    const masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 600000, // OWASP 2023 recommendation
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false, // Not extractable (cannot export key)
      ['encrypt', 'decrypt']
    );

    this.masterKey = masterKey;
    return masterKey;
  }

  clearMasterKey(): void {
    this.masterKey = null;
    // Note: JavaScript doesn't allow explicit memory zeroing,
    // relying on garbage collection
  }
}
```

**Configuration:**
```typescript
interface MasterKeyConfig {
  algorithm: 'PBKDF2';
  hashFunction: 'SHA-256';
  iterations: 600000;
  keyLength: 256; // bits
  saltLength: 16; // bytes
}
```

**Example:**
```typescript
const config: MasterKeyConfig = {
  algorithm: 'PBKDF2',
  hashFunction: 'SHA-256',
  iterations: 600000,
  keyLength: 256,
  saltLength: 16
};

// User enters password
const password = 'mySecurePassword123!';

// Generate random salt (once per user, stored unencrypted on server)
const salt = crypto.getRandomValues(new Uint8Array(16));

// Derive master key
const masterKey = await deriveMasterKey(password, salt);

// Use masterKey for encryption/decryption (never transmitted)
```

---

### Component: Client-Side Encryptor

**Purpose:** Encrypt and decrypt secret values entirely in the user's browser, ensuring plaintext never touches the server.

**Responsibilities:**
- Encrypt plaintext secrets to ciphertext using AES-256-GCM
- Generate cryptographically random nonces for each encryption operation
- Decrypt ciphertext back to plaintext
- Validate authentication tags to ensure data integrity
- Handle encryption errors gracefully

**Technology Stack:**
- Web Crypto API - `crypto.subtle.encrypt()` and `crypto.subtle.decrypt()`
- AES-256-GCM (Galois/Counter Mode - provides both confidentiality and authenticity)
- Random nonce generation via `crypto.getRandomValues()`

**Internal Architecture:**
```typescript
class SecretEncryptor {
  async encryptSecret(
    masterKey: CryptoKey,
    plaintext: string
  ): Promise<EncryptedSecret> {
    // Generate random 12-byte nonce (96 bits, recommended for GCM)
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      masterKey,
      new TextEncoder().encode(plaintext)
    );

    return {
      ciphertext: new Uint8Array(ciphertext),
      nonce: nonce,
      algorithm: 'AES-256-GCM'
    };
  }

  async decryptSecret(
    masterKey: CryptoKey,
    encrypted: EncryptedSecret
  ): Promise<string> {
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encrypted.nonce },
        masterKey,
        encrypted.ciphertext
      );

      return new TextDecoder().decode(plaintext);
    } catch (error) {
      // GCM authentication failed - data tampered or wrong key
      throw new DecryptionError('Failed to decrypt: invalid key or corrupted data');
    }
  }
}
```

**Key Modules:**
- `encryptSecret()` - Encrypts plaintext to ciphertext
- `decryptSecret()` - Decrypts ciphertext to plaintext
- `generateNonce()` - Creates random nonces
- `validateIntegrity()` - Verifies GCM authentication tags

**Configuration:**
```typescript
interface EncryptionConfig {
  algorithm: 'AES-256-GCM';
  keyLength: 256; // bits
  nonceLength: 12; // bytes (96 bits)
  tagLength: 128; // bits (GCM authentication tag)
}

interface EncryptedSecret {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  algorithm: string;
}
```

**Example:**
```typescript
const encryptor = new SecretEncryptor();

// Encrypt a secret (client-side only)
const plaintext = 'sk_live_51H7xQyDpVy8aB3cD';
const encrypted = await encryptor.encryptSecret(masterKey, plaintext);

console.log('Encrypted:', encrypted);
// {
//   ciphertext: Uint8Array[...], // Encrypted data
//   nonce: Uint8Array[...],      // Random nonce
//   algorithm: 'AES-256-GCM'
// }

// Send encrypted data to server (server cannot decrypt)
await api.storeSecret({
  encrypted_value: base64Encode(encrypted.ciphertext),
  nonce: base64Encode(encrypted.nonce),
  metadata: { service: 'Stripe', environment: 'production' }
});

// Later: Decrypt secret (client-side only)
const decrypted = await encryptor.decryptSecret(masterKey, encrypted);
console.log('Decrypted:', decrypted);
// 'sk_live_51H7xQyDpVy8aB3cD'
```

---

### Component: Encrypted Storage (Server)

**Purpose:** Store encrypted secrets in a way that the server cannot decrypt, while maintaining queryability of metadata.

**Responsibilities:**
- Store encrypted blobs as opaque binary data
- Store metadata (service name, tags, environment) separately
- Enforce access control via PostgreSQL Row-Level Security (RLS)
- Provide metadata-based search and filtering
- Never attempt to decrypt stored blobs

**Technology Stack:**
- Supabase PostgreSQL 15.x
- Row-Level Security (RLS) policies
- JSONB for flexible metadata
- Audit logging for compliance

**Internal Architecture:**

**Database Schema:**
```sql
-- Secrets table
CREATE TABLE secrets (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,

  -- Encrypted data (server cannot decrypt)
  encrypted_value BYTEA NOT NULL,  -- The encrypted secret
  nonce BYTEA NOT NULL,             -- Nonce used for encryption
  encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',

  -- Metadata (server CAN read and use for intelligence)
  service_name TEXT NOT NULL,       -- e.g., "Stripe", "OpenAI"
  secret_name TEXT NOT NULL,        -- e.g., "STRIPE_SECRET_KEY"
  environment TEXT NOT NULL,        -- e.g., "development", "production"
  tags JSONB DEFAULT '[]',          -- e.g., ["payment", "api-key"]
  description TEXT,                 -- User-provided description

  -- Cost & usage metadata (for intelligence features)
  estimated_monthly_cost DECIMAL(10,2),
  usage_limit_warning_enabled BOOLEAN DEFAULT false,
  last_accessed_at TIMESTAMPTZ,

  -- Audit metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT unique_secret_per_environment
    UNIQUE(project_id, environment_id, secret_name)
);

-- Index for fast metadata queries
CREATE INDEX idx_secrets_metadata ON secrets
  USING GIN (to_tsvector('english', service_name || ' ' || secret_name || ' ' || description));

-- Index for environment filtering
CREATE INDEX idx_secrets_environment ON secrets (project_id, environment_id);
```

**Row-Level Security:**
```sql
-- Enable RLS
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

-- Users can only access secrets in projects they're members of
CREATE POLICY secrets_access ON secrets
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can only insert secrets in projects where they're Developer or Admin
CREATE POLICY secrets_insert ON secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'developer')
    )
  );

-- Users can only update/delete secrets in projects where they're Admin or Owner
CREATE POLICY secrets_update ON secrets
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
```

**Key Features:**
- **Encrypted blob storage:** `encrypted_value` is opaque to server
- **Metadata separation:** Server can search/filter by `service_name`, `tags`, etc.
- **Audit trail:** `last_accessed_at`, `created_by`, etc.
- **Multi-tenancy:** RLS ensures users only see their project's secrets

---

### Component: Metadata Intelligence Engine

**Purpose:** Provide AI guidance, cost tracking, and intelligent features using only metadata—never accessing secret values.

**Responsibilities:**
- Generate AI guidance based on service type (e.g., "Stripe" → payment-related help)
- Track costs using metadata tags and user-reported usage
- Search secrets by service name, tags, and description
- Suggest related secrets or missing keys
- Never access or attempt to decrypt secret values

**Technology Stack:**
- Cloudflare Workers (edge API)
- Claude API (for AI guidance)
- PostgreSQL JSONB queries (metadata search)

**Internal Architecture:**
```typescript
// Metadata Intelligence Engine
class MetadataIntelligence {
  async generateGuidanceForService(serviceName: string): Promise<Guidance> {
    // Query only metadata, never secret values
    const serviceInfo = await db.query(
      'SELECT service_name, tags, description FROM api_service_info WHERE name = $1',
      [serviceName]
    );

    // Use Claude API with only metadata
    const guidance = await claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{
        role: 'user',
        content: `Generate step-by-step acquisition guide for ${serviceName} API key.

        Context (metadata only):
        - Service: ${serviceName}
        - Tags: ${serviceInfo.tags.join(', ')}
        - Description: ${serviceInfo.description}

        Provide beginner-friendly instructions.`
      }]
    });

    return guidance;
  }

  async searchSecrets(query: string, projectId: string): Promise<Secret[]> {
    // Full-text search on metadata only
    return await db.query(`
      SELECT id, service_name, secret_name, environment, tags, description, last_accessed_at
      FROM secrets
      WHERE project_id = $1
        AND to_tsvector('english', service_name || ' ' || secret_name || ' ' || description)
            @@ plainto_tsquery('english', $2)
      -- Note: encrypted_value is NOT selected, not accessible
    `, [projectId, query]);
  }

  async trackCost(secretId: string, usage: UsageData): Promise<void> {
    // Update cost metadata (user-reported or API-integrated)
    await db.query(`
      UPDATE secrets
      SET estimated_monthly_cost = $2,
          updated_at = now()
      WHERE id = $1
      -- Again: not accessing encrypted_value
    `, [secretId, usage.estimatedCost]);
  }
}
```

**What Intelligence Engine CAN Do:**
- ✅ Search secrets by service name: "Find all Stripe keys"
- ✅ Generate AI guidance: "How to get OpenAI API key"
- ✅ Track costs: "Your Stripe key costs $45/month"
- ✅ Suggest keys: "You're using Stripe, did you get a webhook secret?"
- ✅ Alert on usage: "You're at 90% of your OpenAI quota"

**What Intelligence Engine CANNOT Do:**
- ❌ Read secret values: Cannot see `sk_live_xxx`
- ❌ Decrypt secrets: No access to master key
- ❌ AI analysis of secret content: AI only sees metadata
- ❌ Server-side secret rotation: Cannot modify encrypted values

**Example:**
```typescript
// User asks AI: "How do I get a Stripe API key?"
const guidance = await intelligence.generateGuidanceForService('Stripe');

// Claude API receives only metadata:
// - Service name: "Stripe"
// - Tags: ["payment", "api-key"]
// - Description: "Payment processing API"
//
// Claude NEVER sees actual secret values like "sk_live_xxx"

// User searches: "production payment keys"
const results = await intelligence.searchSecrets('production payment', projectId);

// Returns metadata only:
// [
//   {
//     id: 'uuid-1',
//     service_name: 'Stripe',
//     secret_name: 'STRIPE_SECRET_KEY',
//     environment: 'production',
//     tags: ['payment', 'api-key'],
//     last_accessed_at: '2025-10-29T10:00:00Z'
//     // Note: encrypted_value is NOT included
//   }
// ]
```

---

## Data Flow

### Flow 1: Encrypting and Storing a Secret

**Trigger:** User creates a new secret (e.g., Stripe API key)

**Steps:**

1. **User Input (Browser)**
   ```typescript
   // User enters secret in web form
   const secretData = {
     name: 'STRIPE_SECRET_KEY',
     value: 'sk_live_51H7xQyDpVy8aB3cD',  // Plaintext
     service: 'Stripe',
     environment: 'production',
     tags: ['payment', 'api-key']
   };
   ```

2. **Client-Side Encryption (Browser)**
   ```typescript
   // Encrypt ONLY the secret value
   const encrypted = await encryptor.encryptSecret(
     masterKey,
     secretData.value  // 'sk_live_51H7xQyDpVy8aB3cD'
   );

   // Result:
   // {
   //   ciphertext: Uint8Array[...],  // Encrypted, meaningless to server
   //   nonce: Uint8Array[...],       // Random nonce
   //   algorithm: 'AES-256-GCM'
   // }
   ```

3. **Prepare API Request (Browser)**
   ```typescript
   const apiRequest = {
     // Encrypted data (server cannot decrypt)
     encrypted_value: base64Encode(encrypted.ciphertext),
     nonce: base64Encode(encrypted.nonce),
     encryption_algorithm: encrypted.algorithm,

     // Metadata (server CAN read and use)
     secret_name: secretData.name,
     service_name: secretData.service,
     environment: secretData.environment,
     tags: secretData.tags,
     project_id: currentProject.id,
     environment_id: currentEnvironment.id
   };
   ```

4. **Send to Server (HTTPS)**
   ```typescript
   const response = await fetch('https://api.abyrith.com/v1/secrets', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwtToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(apiRequest)
   });
   ```

5. **Server Stores Encrypted Blob (Supabase)**
   ```sql
   -- Server inserts into database
   INSERT INTO secrets (
     encrypted_value,  -- Opaque blob: 0x2f8a9b3c... (meaningless to server)
     nonce,            -- Nonce for GCM
     encryption_algorithm,
     secret_name,      -- 'STRIPE_SECRET_KEY' (readable)
     service_name,     -- 'Stripe' (readable)
     environment,      -- 'production' (readable)
     tags,             -- ['payment', 'api-key'] (readable)
     project_id,
     environment_id,
     created_by
   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

   -- Server can query: "SELECT service_name FROM secrets"
   -- Server CANNOT: Decrypt encrypted_value
   ```

6. **Audit Log (Server)**
   ```typescript
   // Log metadata event (no secret value)
   await auditLog.record({
     event: 'secret_created',
     user_id: auth.userId,
     secret_id: newSecret.id,
     secret_name: 'STRIPE_SECRET_KEY',  // Metadata only
     service: 'Stripe',
     environment: 'production',
     timestamp: new Date()
     // Note: secret VALUE is never logged
   });
   ```

**Sequence Diagram:**
```
User          Browser         API Server      Database
  |              |                |              |
  |--Enter Key-->|                |              |
  |              |                |              |
  |              |--Derive Key--->|              |
  |              |(PBKDF2, local) |              |
  |              |                |              |
  |              |--Encrypt------>|              |
  |              |(AES-GCM, local)|              |
  |              |                |              |
  |              |--POST /secrets-|------------->|
  |              |  (encrypted)   |              |
  |              |                |              |
  |              |                |--Store blob->|
  |              |                | (can't read) |
  |              |                |              |
  |              |<--201 Created--|<-------------|
  |<--Success----|                |              |
```

**Data Transformations:**
- **Point A (User Input):** Plaintext: `"sk_live_51H7xQyDpVy8aB3cD"`
- **Point B (After Encryption):** Ciphertext: `Uint8Array[0x2f, 0x8a, 0x9b, ...]` (meaningless)
- **Point C (Server Storage):** Blob: `\x2f8a9b3c...` (database bytea, still meaningless)

---

### Flow 2: Retrieving and Decrypting a Secret

**Trigger:** User requests a secret (e.g., to copy Stripe key)

**Steps:**

1. **User Requests Secret (Browser)**
   ```typescript
   // User clicks "View Secret" or "Copy Secret"
   const secretId = 'uuid-of-stripe-key';
   ```

2. **Fetch from Server (HTTPS)**
   ```typescript
   const response = await fetch(`https://api.abyrith.com/v1/secrets/${secretId}`, {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${jwtToken}`
     }
   });

   const secretData = await response.json();
   // Server returns:
   // {
   //   id: 'uuid',
   //   encrypted_value: 'base64...',  // Still encrypted
   //   nonce: 'base64...',
   //   algorithm: 'AES-256-GCM',
   //   secret_name: 'STRIPE_SECRET_KEY',
   //   service_name: 'Stripe',
   //   environment: 'production'
   // }
   ```

3. **Client-Side Decryption (Browser)**
   ```typescript
   // Decode from base64
   const ciphertext = base64Decode(secretData.encrypted_value);
   const nonce = base64Decode(secretData.nonce);

   // Decrypt (only possible with master key in browser)
   const plaintext = await encryptor.decryptSecret(masterKey, {
     ciphertext,
     nonce,
     algorithm: secretData.algorithm
   });

   // Result: 'sk_live_51H7xQyDpVy8aB3cD'
   ```

4. **Display to User (Browser)**
   ```typescript
   // Show in UI (masked by default)
   secretValueInput.value = plaintext;

   // Or copy to clipboard
   navigator.clipboard.writeText(plaintext);

   // UI shows: "••••••••••••••••" (masked)
   // Click "Reveal" shows: "sk_live_51H7xQyDpVy8aB3cD"
   ```

5. **Audit Log (Server)**
   ```typescript
   // Log access event (no secret value)
   await auditLog.record({
     event: 'secret_accessed',
     user_id: auth.userId,
     secret_id: secretId,
     secret_name: 'STRIPE_SECRET_KEY',  // Metadata only
     timestamp: new Date()
     // Note: Decrypted value is NEVER sent back to server
   });
   ```

**Sequence Diagram:**
```
User          Browser         API Server      Database
  |              |                |              |
  |--View Key--->|                |              |
  |              |                |              |
  |              |--GET /secrets/id------------->|
  |              |                |              |
  |              |                |<--encrypted--|
  |              |<--encrypted----|              |
  |              |                |              |
  |              |--Decrypt------>|              |
  |              |(AES-GCM, local)|              |
  |              |                |              |
  |<--Plaintext--|                |              |
  |  (sk_live_xxx)               |              |
```

**Data Transformations:**
- **Point A (Server Response):** Encrypted blob (base64)
- **Point B (After Decryption):** Plaintext: `"sk_live_51H7xQyDpVy8aB3cD"`
- **Point C (User Sees):** Plaintext displayed/copied

**Important:** Server never sees plaintext. Decryption happens entirely in the browser.

---

### Flow 3: Team Member Access (Shared Secret)

**Trigger:** Team member requests a secret they have access to

**Challenge:** How do team members access secrets without sharing the master password?

**Solution:** Per-user encryption using asymmetric cryptography (future enhancement) OR password-derived keys per user (MVP approach).

**MVP Approach (Simplified):**

Each user derives their own master key from their own password. Secrets are encrypted with a project-level key, which is then encrypted for each team member using their personal master key.

**Steps (Simplified):**

1. **Project Owner Creates Secret**
   - Generates project encryption key (random 256-bit key)
   - Encrypts secret with project key
   - Encrypts project key with owner's master key
   - Stores encrypted secret + encrypted project key

2. **Owner Invites Team Member**
   - Re-encrypts project key with new member's master key
   - New member can now decrypt project key, then decrypt secrets

**This ensures:**
- Each user has their own master password
- No sharing of passwords needed
- Server still can't decrypt anything
- Users can be removed by deleting their encrypted copy of project key

**Note:** This is a simplified explanation. Full implementation details in `03-security/team-encryption.md` (future document).

---

## API Contracts

### Internal APIs

**API: Create Secret**

**Endpoint:** `POST /v1/secrets`

**Purpose:** Store an encrypted secret with metadata

**Request:**
```typescript
interface CreateSecretRequest {
  // Encrypted data
  encrypted_value: string;      // Base64-encoded ciphertext
  nonce: string;                // Base64-encoded nonce
  encryption_algorithm: string; // 'AES-256-GCM'

  // Metadata
  secret_name: string;          // e.g., 'STRIPE_SECRET_KEY'
  service_name: string;         // e.g., 'Stripe'
  environment: string;          // 'development' | 'staging' | 'production'
  tags?: string[];              // ['payment', 'api-key']
  description?: string;         // Optional user description

  // References
  project_id: string;           // UUID
  environment_id: string;       // UUID
}
```

**Example Request:**
```json
POST /v1/secrets
{
  "encrypted_value": "2f8a9b3c7d1e...", // Base64 encrypted data
  "nonce": "a1b2c3d4e5f6...",           // Base64 nonce
  "encryption_algorithm": "AES-256-GCM",
  "secret_name": "STRIPE_SECRET_KEY",
  "service_name": "Stripe",
  "environment": "production",
  "tags": ["payment", "api-key"],
  "description": "Production Stripe secret key for payments",
  "project_id": "proj-uuid-123",
  "environment_id": "env-uuid-prod"
}
```

**Response (Success - 201 Created):**
```typescript
interface CreateSecretResponse {
  id: string;                   // UUID of created secret
  secret_name: string;
  service_name: string;
  environment: string;
  created_at: string;           // ISO 8601 timestamp
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "secret-uuid-456",
  "secret_name": "STRIPE_SECRET_KEY",
  "service_name": "Stripe",
  "environment": "production",
  "created_at": "2025-10-29T12:00:00Z",
  "updated_at": "2025-10-29T12:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid encryption format or missing required fields
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have permission to create secrets in this project
- `409 Conflict` - Secret with same name already exists in this environment
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `encrypted_value`: Required, Base64 string, max 10KB
- `nonce`: Required, Base64 string, exactly 16 bytes (12 bytes original + encoding)
- `secret_name`: Required, alphanumeric + underscores, max 255 chars
- `service_name`: Required, max 100 chars
- `environment`: Required, must be 'development', 'staging', or 'production'

---

**API: Get Secret**

**Endpoint:** `GET /v1/secrets/:id`

**Purpose:** Retrieve encrypted secret for client-side decryption

**Path Parameters:**
- `id` (string, required) - Secret ID (UUID)

**Success Response (200 OK):**
```typescript
interface GetSecretResponse {
  id: string;
  encrypted_value: string;      // Base64 ciphertext (client will decrypt)
  nonce: string;                // Base64 nonce
  encryption_algorithm: string; // 'AES-256-GCM'
  secret_name: string;
  service_name: string;
  environment: string;
  tags: string[];
  description?: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}
```

**Example Response:**
```json
{
  "id": "secret-uuid-456",
  "encrypted_value": "2f8a9b3c7d1e...",  // Still encrypted!
  "nonce": "a1b2c3d4e5f6...",
  "encryption_algorithm": "AES-256-GCM",
  "secret_name": "STRIPE_SECRET_KEY",
  "service_name": "Stripe",
  "environment": "production",
  "tags": ["payment", "api-key"],
  "description": "Production Stripe secret key",
  "created_at": "2025-10-29T12:00:00Z",
  "updated_at": "2025-10-29T12:00:00Z",
  "last_accessed_at": "2025-10-29T14:30:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have access to this secret
- `404 Not Found` - Secret doesn't exist
- `500 Internal Server Error` - Server error

**Important:** Server returns encrypted data. Client decrypts using master key that only exists in browser.

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Browser ↔ Network**
- **Threats:**
  - Man-in-the-middle (MITM) attacks
  - Network eavesdropping
  - DNS spoofing
- **Controls:**
  - TLS 1.3 with strong cipher suites
  - HSTS (HTTP Strict Transport Security)
  - Certificate pinning (future)
  - All data encrypted before transmission

**Boundary 2: Network ↔ Server**
- **Threats:**
  - Server compromise
  - Database breach
  - Malicious employees
  - Government subpoenas
- **Controls:**
  - Server receives only encrypted blobs (cannot decrypt)
  - No master keys stored on server
  - No plaintext secrets ever reach server
  - Even with full server access, secrets remain encrypted

**Boundary 3: Client Memory ↔ Browser Storage**
- **Threats:**
  - XSS (Cross-Site Scripting) attacks
  - Memory dumps
  - Browser extensions
- **Controls:**
  - Master key stored in memory only (not localStorage)
  - CSP headers prevent script injection
  - Master key cleared on logout
  - Secrets displayed in isolated, secure contexts

### Authentication & Authorization

**Authentication:**
- **Method:** Supabase Auth with JWT tokens
- **Token format:** JWT with user ID, email, role claims
- **Token lifecycle:**
  - Access token: 1 hour expiration
  - Refresh token: 7 days (stored in httpOnly cookie)
  - Automatic refresh before expiration

**Note:** Authentication proves user identity but does NOT give server access to decrypt secrets. Master key remains in client.

**Authorization:**
- **Model:** Role-Based Access Control (RBAC) + Row-Level Security (RLS)
- **Enforcement points:**
  - API layer: JWT claims verified
  - Database layer: RLS policies enforce project membership
  - Client layer: UI hides unauthorized actions
- **Permission evaluation:**
  - User requests secret
  - Server verifies user is project member (RLS policy)
  - Server returns encrypted secret (still can't decrypt)
  - Client decrypts with master key

### Data Security

**Data at Rest:**
- **Encryption:**
  - Secrets: AES-256-GCM (client-side, before storage)
  - Database: PostgreSQL native encryption (additional layer)
  - Backups: Encrypted at rest in Supabase
- **Storage:**
  - Encrypted secrets: PostgreSQL BYTEA column
  - Metadata: JSONB column (unencrypted, used for intelligence)
- **Access controls:**
  - RLS policies prevent unauthorized database access
  - Application-level checks in API layer
  - No direct database access for users

**Data in Transit:**
- **Encryption:** TLS 1.3 only
- **Cipher suites:** Modern AEAD ciphers (AES-GCM, ChaCha20-Poly1305)
- **Certificate management:**
  - Cloudflare-managed certificates
  - Automatic renewal
  - HSTS enforced

**Data in Use (Client Memory):**
- **Processing:** Master key and plaintext secrets exist in JavaScript memory
- **Temporary storage:**
  - Master key: sessionStorage (cleared on tab close)
  - Plaintext: Never persisted, only in DOM temporarily
- **Memory security:**
  - JavaScript doesn't allow memory zeroing (limitation)
  - Rely on garbage collection after key clearance
  - Master key not extractable from Web Crypto API

### Threat Model

**Threat 1: Server Compromise**
- **Description:** Attacker gains full access to Abyrith servers and database
- **Likelihood:** Low (good security practices, but possible)
- **Impact:** High (user trust, reputation damage)
- **Mitigation:**
  - Zero-knowledge architecture: Encrypted secrets are useless without master keys
  - Master keys never touch server
  - Even with database dump, secrets remain encrypted
  - Attackers get metadata only (service names, tags, timestamps)
- **Residual risk:** Metadata exposure (who has which services)

**Threat 2: Malicious Insider (Abyrith Employee)**
- **Description:** Abyrith employee tries to access user secrets
- **Likelihood:** Very Low (background checks, access controls)
- **Impact:** Critical (violates zero-knowledge guarantee)
- **Mitigation:**
  - Zero-knowledge: Employee cannot decrypt secrets
  - No master keys in company systems
  - Database access logs monitored
  - Separation of duties (no single person has full access)
- **Residual risk:** Employee could see metadata

**Threat 3: Man-in-the-Middle (MITM) Attack**
- **Description:** Attacker intercepts traffic between user and server
- **Likelihood:** Low (TLS 1.3 widely deployed)
- **Impact:** High (could intercept encrypted secrets or JWT tokens)
- **Mitigation:**
  - TLS 1.3 with strong ciphers
  - HSTS prevents HTTP fallback
  - Certificate pinning (future)
  - Even if HTTPS is broken, secrets are still encrypted client-side
- **Residual risk:** JWT token interception (mitigated by short expiration)

**Threat 4: Cross-Site Scripting (XSS)**
- **Description:** Attacker injects malicious script to steal master key or secrets
- **Likelihood:** Medium (common web vulnerability)
- **Impact:** Critical (could access user's plaintext secrets)
- **Mitigation:**
  - Content Security Policy (CSP) headers
  - React automatic escaping
  - No `dangerouslySetInnerHTML` without sanitization
  - Master key in non-extractable Web Crypto format
  - Subresource Integrity (SRI) for external scripts
- **Residual risk:** XSS could exfiltrate decrypted secrets displayed in DOM

**Threat 5: Password Guessing / Brute Force**
- **Description:** Attacker tries to guess user's master password
- **Likelihood:** Medium (common attack vector)
- **Impact:** Critical (would allow decryption)
- **Mitigation:**
  - PBKDF2 with 600,000 iterations (computationally expensive)
  - Password strength requirements enforced client-side
  - Rate limiting on API endpoints
  - 2FA/MFA as additional layer (future)
- **Residual risk:** Weak user passwords remain vulnerable

**Threat 6: Lost Master Password**
- **Description:** User forgets master password (not a security threat, but usability issue)
- **Likelihood:** Medium (users forget passwords)
- **Impact:** High (user loses access to all secrets)
- **Mitigation:**
  - Recovery key mechanism (user-controlled, not server-controlled)
  - Clear warnings during account creation
  - Master password change flow (requires current password)
  - No server-side password reset (would break zero-knowledge)
- **Residual risk:** Irrecoverable data loss if user loses both password and recovery key

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- **Master key derivation:** < 500ms (PBKDF2 600K iterations on modern CPU)
- **Secret encryption:** < 50ms per secret (AES-256-GCM is fast)
- **Secret decryption:** < 50ms per secret
- **Bulk operations (10 secrets):** < 300ms total

**Throughput:**
- **Concurrent encryptions:** Limited by browser (typically 1-2 cores for Web Crypto)
- **API requests:** Standard REST limits (100 req/min per user)
- **Database queries:** < 100ms p95 (indexed metadata queries)

**Resource Usage:**
- **Memory:** Master key ~32 bytes, minimal overhead
- **CPU:** PBKDF2 uses ~500ms of CPU on login (intentionally expensive)
- **Storage:** Encrypted secrets ~10-20% larger than plaintext (due to nonce + auth tag)

### Performance Optimization

**Optimizations implemented:**

1. **Web Crypto API (Native)**
   - **Impact:** 10-100x faster than JavaScript crypto libraries
   - Browser-native implementation uses hardware acceleration
   - No polyfill needed for modern browsers

2. **PBKDF2 Iterations Tuned**
   - **Impact:** Balance security vs. usability
   - 600,000 iterations = 500ms on modern CPU (acceptable)
   - Prevents brute-force while maintaining good UX

3. **Batch Encryption**
   - **Impact:** Encrypt multiple secrets in parallel when creating project
   - Web Crypto supports async operations
   - Can parallelize encryption of independent secrets

4. **Master Key Caching**
   - **Impact:** Derive once per session, reuse for all operations
   - Stored in sessionStorage (cleared on tab close)
   - No need to re-derive on every encryption/decryption

5. **Metadata Indexing**
   - **Impact:** Fast search without touching encrypted values
   - PostgreSQL GIN index on `to_tsvector(service_name || secret_name)`
   - Query metadata in <50ms even with 10,000+ secrets

**Caching Strategy:**
- **Master key:** Cached in sessionStorage (per browser tab)
- **Decrypted secrets:** Never cached (security over performance)
- **Metadata:** Cached in React Query for 5 minutes
- **API responses:** Standard HTTP caching headers

**Database Optimization:**
- **Indexes:**
  - GIN index on metadata (full-text search)
  - B-tree index on (project_id, environment_id)
  - Index on last_accessed_at for "recently used" queries
- **Query optimization:**
  - Select only needed columns (avoid encrypted_value when listing)
  - Paginated results (20 secrets per page)
- **Connection pooling:** Supabase handles automatically

---

## Scalability

### Horizontal Scaling

**Components that scale horizontally:**

1. **Cloudflare Workers (API Gateway)**
   - **How it scales:** Automatically distributed globally
   - No configuration needed
   - Zero cold starts
   - Handles millions of requests per second

2. **Supabase PostgreSQL**
   - **How it scales:** Read replicas for metadata queries
   - Connection pooling via PgBouncer
   - Vertical scaling for write-heavy workloads

3. **Client-Side Encryption**
   - **How it scales:** Computation happens on user devices
   - No server CPU load for encryption/decryption
   - Scales infinitely with number of users

**Load balancing:**
- **Strategy:** Cloudflare's global network (automatic)
- **Health checks:** Cloudflare monitors origin health
- No manual load balancer configuration

### Vertical Scaling

**Components that scale vertically:**

1. **PostgreSQL Database**
   - **Resource limits:** Supabase tiers (shared → dedicated → large)
   - Start: 2 vCPU, 1GB RAM
   - Scale: Up to 64 vCPU, 256GB RAM
   - Storage: Auto-scaling (up to 500GB+ per project)

2. **User Browser (Client-Side Crypto)**
   - **Resource limits:** User's device capability
   - Modern smartphones handle PBKDF2 + AES-256-GCM easily
   - Older devices may see 1-2 second delays on login

### Bottlenecks

**Current bottlenecks:**

1. **PBKDF2 Computation (Client CPU)**
   - **Description:** Master key derivation takes ~500ms on modern CPU
   - **Impact:** Noticeable delay on login, especially on mobile
   - **Mitigation:**
     - Cache derived key in sessionStorage (persist across page loads)
     - Show loading indicator with progress
     - Consider reducing iterations for mobile (future optimization)

2. **Database Write Throughput**
   - **Description:** PostgreSQL write operations are single-threaded
   - **Impact:** High-frequency secret creation/updates could bottleneck
   - **Mitigation:**
     - Batch secret creation when possible
     - Use async operations
     - Scale database vertically if needed

3. **Metadata Query Performance (Large Projects)**
   - **Description:** Full-text search on 10,000+ secrets could slow down
   - **Impact:** Search results take >1 second
   - **Mitigation:**
     - GIN indexes on metadata columns
     - Pagination (20 results per page)
     - Client-side filtering for small result sets

**Mitigation strategies:**
- **Strategy 1:** Optimize PBKDF2 iterations based on device capability (detect CPU speed)
- **Strategy 2:** Use database read replicas for metadata-heavy queries
- **Strategy 3:** Implement client-side caching for frequently accessed metadata

### Capacity Planning

**Current capacity (MVP):**
- **Users:** 10,000 concurrent users
- **Secrets:** 100,000 secrets per project (metadata indexed)
- **API requests:** 1,000 req/sec (Cloudflare Workers limit)
- **Database storage:** 100GB (Supabase starter tier)

**Growth projections:**
- **Year 1:** 50,000 users, 5M secrets, upgrade to dedicated database
- **Year 2:** 200,000 users, 20M secrets, read replicas + connection pooling
- **Year 3:** 1M users, 100M secrets, sharded database architecture

---

## Failure Modes

### Failure Mode 1: User Forgets Master Password

**Scenario:** User loses access to master password and cannot decrypt secrets

**Impact:**
- User cannot access any secrets
- All encrypted data becomes permanently inaccessible
- No server-side password reset possible (would break zero-knowledge)

**Detection:**
- User attempts login with wrong password
- PBKDF2 derivation succeeds but decryption fails (GCM auth error)

**Recovery:**
1. **If user has recovery key:**
   - User enters recovery key (generated at signup)
   - Recovery key derives alternate master key
   - User can decrypt secrets and set new master password
2. **If user has no recovery key:**
   - Secrets are permanently lost (no recovery possible)
   - User can delete account and start fresh
   - Zero-knowledge means Abyrith cannot help

**Prevention:**
- Require recovery key download at signup (mandatory)
- Show warning: "If you lose your password AND recovery key, your data is gone forever"
- Optional: Email recovery key to user (still user-controlled)
- Password strength requirements (enforce strong passwords)

---

### Failure Mode 2: Database Breach (Server Compromise)

**Scenario:** Attacker gains full access to Abyrith database

**Impact:**
- Attacker gets encrypted secrets + metadata
- Metadata exposure: service names, usernames, timestamps
- Encrypted secrets remain unreadable (no master keys)

**Detection:**
- Database access logs show unauthorized queries
- Intrusion detection system alerts
- Supabase monitoring catches anomalous activity

**Recovery:**
1. **Immediate:**
   - Isolate compromised systems
   - Revoke API keys and database credentials
   - Enable read-only mode on database
2. **Investigation:**
   - Forensic analysis of breach scope
   - Identify what data was accessed
3. **User notification:**
   - Email all users about breach
   - Explain: Secrets remain encrypted, metadata may be exposed
   - Recommend key rotation out of abundance of caution
4. **Long-term:**
   - Publish post-mortem
   - Implement additional security controls
   - Potential re-encryption with new algorithms (if needed)

**Prevention:**
- Regular security audits
- Penetration testing
- Database access logs monitored
- Principle of least privilege for Abyrith employees
- Zero-knowledge architecture limits damage

---

### Failure Mode 3: XSS Attack (Script Injection)

**Scenario:** Attacker injects malicious JavaScript that steals decrypted secrets

**Impact:**
- Attacker could exfiltrate plaintext secrets displayed in DOM
- Attacker could exfiltrate master key from sessionStorage
- User's secrets compromised until attack is detected

**Detection:**
- Content Security Policy (CSP) violations logged
- User reports suspicious behavior
- Security monitoring catches outbound data exfiltration

**Recovery:**
1. **Immediate:**
   - Patch XSS vulnerability
   - Deploy fix to production immediately
   - Clear all user sessions (force re-login)
2. **User notification:**
   - Email affected users (if attack detected)
   - Recommend rotating all secrets exposed during timeframe
   - Provide instructions for checking secret access logs
3. **Investigation:**
   - Identify scope: which users, which secrets
   - Forensics: where exfiltrated data went

**Prevention:**
- Strict CSP headers (no inline scripts, no eval())
- React automatic escaping (avoid `dangerouslySetInnerHTML`)
- Regular security code reviews
- Subresource Integrity (SRI) for external scripts
- Input sanitization on all user-controlled data

---

### Disaster Recovery

**Recovery Time Objective (RTO):** 4 hours (service restored within 4 hours of total failure)

**Recovery Point Objective (RPO):** 1 hour (maximum data loss of 1 hour)

**Backup Strategy:**
- **Frequency:** Continuous (Supabase Point-in-Time Recovery)
- **Retention:**
  - Database backups: 7 days (Supabase automatic)
  - Long-term archives: 90 days (exported to S3-compatible storage)
- **Location:**
  - Primary: Supabase cloud (multi-region)
  - Secondary: Cloudflare R2 (encrypted backups)

**Recovery Procedure:**
1. **Assess impact:** What failed? Database? Workers? Frontend?
2. **Activate backup:**
   - Database: Restore from Supabase PITR (point-in-time recovery)
   - Workers: Redeploy from Git (infrastructure as code)
   - Frontend: Redeploy from Git to Cloudflare Pages
3. **Verify integrity:**
   - Test encrypted secrets can still be decrypted
   - Verify metadata queries work
   - Check API endpoints respond correctly
4. **Gradual rollout:**
   - Enable for internal team first
   - Monitor for errors
   - Enable for 10% of users, then 50%, then 100%
5. **Post-mortem:**
   - Document what happened
   - Implement preventive measures

---

## Alternatives Considered

### Alternative 1: Server-Side Encryption (Traditional Secrets Manager Approach)

**Description:** Store master keys on server, encrypt/decrypt server-side

**Pros:**
- Easier password recovery (server can reset)
- Server-side AI could analyze secret values
- Better automation capabilities (server can rotate keys)
- No client-side crypto complexity

**Cons:**
- Violates zero-knowledge guarantee
- Server compromise exposes all secrets
- Users must trust Abyrith with plaintext secrets
- Government subpoenas could force disclosure
- Not differentiating from competitors

**Why not chosen:**
- Fundamentally conflicts with our security-first principle
- Doesn't solve trust problem we're addressing
- Competitive disadvantage (same as HashiCorp Vault, AWS Secrets Manager)
- Users are increasingly demanding zero-knowledge privacy

---

### Alternative 2: Envelope Encryption with Server-Held Master Keys

**Description:** Secrets encrypted with data keys, data keys encrypted with master keys stored on server

**Pros:**
- Easier key rotation (rotate master key, re-encrypt data keys)
- Server can manage access control more easily
- Better performance (server-side is faster)

**Cons:**
- Still not zero-knowledge (server has master keys)
- Minimal security improvement over Alternative 1
- Adds complexity without solving core problem

**Why not chosen:**
- Doesn't achieve zero-knowledge goal
- False sense of security ("it's encrypted!" but server can decrypt)
- Industry is moving away from this model

---

### Alternative 3: Asymmetric (Public-Key) Encryption for All Secrets

**Description:** Use RSA or Ed25519 instead of AES-256-GCM

**Pros:**
- Elegant team sharing model (public key sharing)
- No symmetric key management complexity
- Per-user encryption keys naturally

**Cons:**
- Slower than AES-256-GCM (RSA is 100x slower)
- Larger encrypted data size (RSA expands data significantly)
- Still need symmetric crypto for large secrets (hybrid approach)
- More complex key management

**Why not chosen:**
- Performance penalty not worth it for MVP
- AES-256-GCM is faster and well-supported in Web Crypto API
- Can add asymmetric crypto later for team sharing (hybrid model)
- Industry standard is symmetric for data, asymmetric for key exchange

---

### Alternative 4: Client-Side Encryption with Client-Held Key Escrow

**Description:** User's master key encrypted and stored on server, but user controls decryption key

**Pros:**
- User could recover account from new device
- Abyrith still can't decrypt (user holds decryption key)
- Better multi-device experience

**Cons:**
- Complex key management
- User could lose decryption key (same problem as master password)
- Adds security assumptions (trust in key escrow mechanism)
- Non-standard approach

**Why not chosen:**
- Complexity outweighs benefits for MVP
- Doesn't solve "forgot password" problem (just shifts it)
- Can implement later if multi-device becomes major pain point
- Current approach (master password + recovery key) is simpler

---

## Decision Log

### Decision 1: Use PBKDF2 with 600,000 Iterations

**Date:** 2025-10-29

**Context:** Need to derive master key from user password securely

**Options:**
1. **PBKDF2 600K iterations** - OWASP recommendation
2. **Argon2** - Modern algorithm, better than PBKDF2
3. **scrypt** - Memory-hard algorithm

**Decision:** PBKDF2 with 600,000 iterations

**Rationale:**
- Web Crypto API native support (no external libraries)
- OWASP 2023 recommendation for password hashing
- Good balance of security and performance (~500ms on modern CPUs)
- Widely tested and audited
- Argon2 not available in Web Crypto API (would require polyfill)

**Consequences:**
- Users see ~500ms delay on login (acceptable)
- Mobile devices may see longer delays (can optimize later)
- Future: Could switch to Argon2 when Web Crypto API supports it

---

### Decision 2: AES-256-GCM for Secret Encryption

**Date:** 2025-10-29

**Context:** Choose symmetric encryption algorithm for secrets

**Options:**
1. **AES-256-GCM** - Galois/Counter Mode with authentication
2. **AES-256-CBC** - Cipher Block Chaining (older)
3. **ChaCha20-Poly1305** - Alternative AEAD cipher

**Decision:** AES-256-GCM

**Rationale:**
- AEAD cipher (provides both confidentiality and authenticity)
- Fast (hardware acceleration on modern CPUs)
- Widely supported in Web Crypto API
- Industry standard for zero-knowledge systems (1Password, Bitwarden)
- GCM mode prevents tampering (integrity check)

**Consequences:**
- Fast encryption/decryption (<50ms per secret)
- Built-in integrity verification (no need for separate HMAC)
- Future: Could add ChaCha20-Poly1305 as alternative if needed

---

### Decision 3: No Server-Side Password Reset (True Zero-Knowledge)

**Date:** 2025-10-29

**Context:** How to handle users who forget master password?

**Options:**
1. **No server reset, user-controlled recovery keys** - True zero-knowledge
2. **Server-assisted reset with email verification** - Easier for users
3. **Key escrow with trusted contacts** - Social recovery

**Decision:** No server reset, user-controlled recovery keys only

**Rationale:**
- Aligns with zero-knowledge architecture
- No backdoor for server to access secrets
- User controls recovery (recovery key generated at signup)
- Industry best practice (1Password, Bitwarden do same)
- Clear warning to users: "We cannot reset your password"

**Consequences:**
- Some users will lose access if they lose password + recovery key
- Must educate users about importance of recovery key
- Potential support burden (users asking for reset we can't provide)
- Trade-off: Security over convenience (acceptable for our target market)

---

### Decision 4: Metadata Not Encrypted (Enables Intelligence Features)

**Date:** 2025-10-29

**Context:** Should metadata (service name, tags, descriptions) be encrypted?

**Options:**
1. **Encrypt everything** - Maximum security, no intelligence features
2. **Metadata plaintext** - Enables AI guidance, cost tracking, search
3. **Encrypted metadata with server-side decryption** - Hybrid (breaks zero-knowledge)

**Decision:** Metadata stored in plaintext, secret values encrypted

**Rationale:**
- Enables AI assistant to provide context-aware guidance
- Allows server-side search and filtering (fast, efficient)
- Metadata is not sensitive (service name "Stripe" is not a secret)
- Secret value is what matters (the actual API key)
- User can see metadata before decrypting secret

**Consequences:**
- Server can see which services user uses (Stripe, OpenAI, etc.)
- Metadata could reveal user's tech stack
- Acceptable trade-off for intelligence features
- Future: Could add option to encrypt metadata for paranoid users

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `GLOSSARY.md` - Understand zero-knowledge, master key, encryption terms
- [ ] `03-security/security-model.md` - Overall security architecture
- [x] `TECH-STACK.md` - Web Crypto API, Supabase, Cloudflare Workers

**External Services:**
- Web Crypto API - Browser-native cryptography (no external dependency)
- Supabase - PostgreSQL database for encrypted storage
- Cloudflare Workers - API gateway (no access to secrets)

### Architecture Dependencies

**Depends on these components:**
- Browser: Web Crypto API support (all modern browsers)
- Database: PostgreSQL BYTEA support (for encrypted blobs)
- TLS: HTTPS for secure transmission

**Required by these components:**
- `05-api/endpoints/secrets-endpoints.md` - API will use encrypted storage
- `07-frontend/client-encryption/webcrypto-implementation.md` - Frontend implements this
- `08-features/zero-knowledge-encryption.md` - Feature documentation references this

---

## References

### Internal Documentation
- `03-security/security-model.md` - Overall security architecture
- `TECH-STACK.md` - Technology decisions (Web Crypto API, Supabase)
- `GLOSSARY.md` - Term definitions (zero-knowledge, master key, etc.)
- `01-product/product-vision-strategy.md` - Why zero-knowledge matters for Abyrith

### External Resources
- [Web Crypto API Specification](https://www.w3.org/TR/WebCryptoAPI/) - W3C standard
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - PBKDF2 recommendations
- [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) - AES-GCM specification
- [1Password Security Design](https://1passwordstatic.com/files/security/1password-white-paper.pdf) - Zero-knowledge reference
- [Bitwarden Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/) - Another zero-knowledge implementation

### Design Patterns Used
- **Zero-Knowledge Architecture** - Client-side encryption, server has no keys
- **Envelope Encryption** - (Future) Project keys encrypted per-user for team sharing
- **AEAD (Authenticated Encryption with Associated Data)** - GCM mode provides both
- **Key Derivation** - PBKDF2 transforms password to cryptographic key

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Security Lead | Initial zero-knowledge architecture document |

---

## Notes

### Future Enhancements

**Team Encryption Model (Post-MVP):**
- Asymmetric encryption for per-user project key sharing
- Each project has a project encryption key
- Project key encrypted separately for each team member
- Allows adding/removing team members without re-encrypting all secrets

**Multi-Device Support:**
- QR code for syncing master key across devices
- Secure device pairing mechanism
- Still maintains zero-knowledge (devices sync directly, not through server)

**Advanced Recovery Options:**
- Social recovery (trusted contacts hold encrypted key shards)
- Hardware security key support (YubiKey as second factor)
- Biometric unlock (device-level, master key still derived from password)

**Performance Optimizations:**
- Web Assembly (WASM) for faster PBKDF2 on low-end devices
- Adaptive iterations based on device capability
- Service Worker caching for metadata

### Known Issues

**Limitation 1: JavaScript Memory Management**
- JavaScript doesn't allow explicit memory zeroing
- Master key remains in memory until garbage collection
- Mitigation: Use Web Crypto non-extractable keys when possible

**Limitation 2: Browser Extension Risks**
- Malicious browser extensions could access DOM and steal secrets
- Mitigation: Warn users, recommend minimal extensions

**Limitation 3: Password Recovery**
- Users who lose password + recovery key permanently lose access
- Mitigation: Clear warnings, mandatory recovery key download

**Limitation 4: Mobile Performance**
- PBKDF2 600K iterations slower on mobile devices (~1-2 seconds)
- Mitigation: Future adaptive iterations, progress indicator

### Security Assumptions

This architecture assumes:
1. **Browser is trusted:** Web Crypto API implementation is secure
2. **TLS is secure:** HTTPS cannot be intercepted (no MITM)
3. **User device is not compromised:** No keyloggers, malware on user's machine
4. **Random number generation is cryptographically secure:** `crypto.getRandomValues()` is truly random
5. **Users choose strong master passwords:** PBKDF2 only slows brute-force, doesn't prevent it

If any assumption is violated, security may be compromised. Most are reasonable for target threat model.

---

**Next Review Date:** 2025-11-29 (monthly review of cryptographic choices)
