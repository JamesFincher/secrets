---
Document: Zero-Knowledge Security Model - Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Security Lead / Engineering Lead
Status: Draft
Dependencies: GLOSSARY.md, TECH-STACK.md, 01-product/product-vision-strategy.md
---

# Zero-Knowledge Security Model

## Overview

This document defines Abyrith's comprehensive security architecture, built on a zero-knowledge foundation where the platform cannot access or decrypt user secrets. The architecture ensures that only users, with their master password, can decrypt their stored secrets, while maintaining usability and enabling intelligent features through metadata.

**Purpose:** Provide enterprise-grade security that beginners can use and trust, while maintaining complete data sovereignty for users.

**Scope:** Client-side encryption implementation, key derivation, threat model, security boundaries, and all cryptographic operations.

**Status:** Proposed - Core security architecture for MVP

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Security Boundaries](#security-boundaries)
7. [Cryptographic Specifications](#cryptographic-specifications)
8. [Threat Model](#threat-model)
9. [Security Controls](#security-controls)
10. [Performance Characteristics](#performance-characteristics)
11. [Failure Modes](#failure-modes)
12. [Alternatives Considered](#alternatives-considered)
13. [Decision Log](#decision-log)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Developers store API keys and secrets insecurely across .env files, Slack messages, password managers not designed for developer secrets, or enterprise tools too complex for individuals and small teams. Existing solutions force users to choose between convenience and security, often defaulting to insecure practices.

**Pain points:**
- Secrets are accidentally committed to git repositories
- Password managers are awkward for API keys and lack developer workflows
- Enterprise secrets managers are too complex and expensive
- No solution provides both simplicity and enterprise-grade security
- Users must trust service providers with unencrypted secrets
- Compliance requirements (SOC 2, GDPR) are difficult to meet
- Key rotation and access tracking are manual and error-prone

**Why now?**
The rise of AI-powered development (Claude Code, Cursor) creates new attack surfaces and requires new security paradigms. Developers need secure secret management that integrates with AI workflows while maintaining zero-trust architecture.

### Background

**Existing system (if applicable):**
This is a new platform. No existing Abyrith system to replace.

**Previous attempts:**
Traditional password managers (1Password, LastPass) apply password security models to developer secrets, which are fundamentally different. Enterprise solutions (HashiCorp Vault, AWS Secrets Manager) are designed for infrastructure teams, not individual developers or small teams.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Learner Users | Simple, works first time | Don't want complexity, "just want it to work" |
| Solo Developers | Secure storage without setup | Don't want to learn new enterprise tools |
| Development Teams | Sharing with audit trails | Need compliance without friction |
| Enterprise Security | SOC 2, ISO 27001 compliance | Need proof of security, audit logs, no breaches |
| AI Development Tools | Access to secrets when needed | Must be secure but not block AI workflows |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Zero-knowledge architecture** - Platform cannot decrypt user secrets under any circumstances (Success metric: Pass third-party security audit)
2. **Usability without compromise** - Security is invisible to users, works by default (Success metric: 95% of first-time users successfully encrypt/store secrets without help)
3. **Enterprise-grade security** - Meet SOC 2, ISO 27001, GDPR requirements (Success metric: Pass SOC 2 Type II audit within 12 months)
4. **Client-side encryption** - All encryption/decryption happens in user's browser (Success metric: Server logs show only encrypted blobs, never plaintext)
5. **Metadata intelligence** - Support AI features using encrypted metadata without exposing secret values (Success metric: AI assistant provides guidance without accessing encrypted values)

**Secondary goals:**
- Enable secure key rotation without re-encrypting all secrets
- Support team sharing with granular permissions
- Provide comprehensive audit trails for compliance
- Integrate securely with MCP for AI development workflows

### Non-Goals

**Explicitly out of scope:**
- **Server-side decryption** - Server will never have ability to decrypt secrets (Why: Violates zero-knowledge architecture)
- **Password recovery without data loss** - If master password is lost, secrets are unrecoverable (Why: Necessary consequence of zero-knowledge architecture; provide recovery keys instead)
- **Blockchain/decentralization** - Use traditional cloud infrastructure (Why: Adds complexity without security benefit for this use case)
- **Quantum-resistant encryption** - Use current standard algorithms (Why: Can migrate when quantum threat is imminent; current algorithms are sufficient)

### Success Metrics

**How we measure success:**
- **Security:** Zero security breaches; pass SOC 2 Type II audit
- **Usability:** Time to first successful encryption < 30 seconds; user rating > 4.5/5 for "security transparency"
- **Performance:** Client-side encryption/decryption < 100ms for secrets up to 1MB
- **Compliance:** Generate SOC 2, GDPR audit reports in < 5 minutes

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         User enters Master Password                 │   │
│  └───────────────────┬─────────────────────────────────┘   │
│                      │                                       │
│                      ▼                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PBKDF2 Key Derivation (100,000 iterations)         │   │
│  │  Password → 256-bit Master Key                      │   │
│  │  (NEVER leaves browser)                             │   │
│  └───────────────────┬─────────────────────────────────┘   │
│                      │                                       │
│                      ▼                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Generate Data Encryption Key (DEK)                 │   │
│  │  Random 256-bit AES key per secret                  │   │
│  └───────────────────┬─────────────────────────────────┘   │
│                      │                                       │
│           ┌──────────┴──────────┐                           │
│           ▼                     ▼                           │
│  ┌─────────────────┐   ┌─────────────────────┐            │
│  │ Encrypt Secret  │   │  Encrypt DEK with   │            │
│  │ with DEK        │   │  Master Key         │            │
│  │ (AES-256-GCM)   │   │  (Envelope Enc.)    │            │
│  └────────┬────────┘   └──────────┬──────────┘            │
│           │                       │                         │
│           └───────────┬───────────┘                         │
│                       ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Send to Server:                                    │   │
│  │  - Encrypted secret blob                            │   │
│  │  - Encrypted DEK                                    │   │
│  │  - Nonce/IV                                         │   │
│  │  - Auth tag                                         │   │
│  │  - Unencrypted metadata (service name, tags, etc.) │   │
│  └───────────────────┬─────────────────────────────────┘   │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │ HTTPS (encrypted in transit)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (Edge Layer)                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  - Authenticate user (JWT)                          │    │
│  │  - Rate limiting                                    │    │
│  │  - Input validation                                 │    │
│  │  - Forward to Supabase                              │    │
│  │  (CANNOT decrypt: no master key)                    │    │
│  └───────────────────┬─────────────────────────────────┘    │
└────────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│               Supabase PostgreSQL (Data Layer)               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  secrets table:                                     │    │
│  │  - id (UUID)                                        │    │
│  │  - user_id (foreign key)                            │    │
│  │  - project_id (foreign key)                         │    │
│  │  - encrypted_value (encrypted blob)                 │    │
│  │  - encrypted_dek (encrypted key)                    │    │
│  │  - nonce (12 bytes)                                 │    │
│  │  - auth_tag (16 bytes)                              │    │
│  │  - service_name (plaintext metadata)                │    │
│  │  - environment (dev/staging/prod)                   │    │
│  │  - tags (plaintext, for search/organization)        │    │
│  │  - created_at, updated_at                           │    │
│  │  - RLS policies (only user can access their rows)   │    │
│  │  (CANNOT decrypt: no master key)                    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Browser-Based Encryption Engine**
- **Purpose:** All cryptographic operations in user's browser
- **Technology:** Web Crypto API (SubtleCrypto interface)
- **Responsibilities:**
  - Master key derivation from password
  - Secret encryption/decryption
  - Nonce/IV generation
  - Key management (in-memory only)

**Component 2: Cloudflare Workers API Gateway**
- **Purpose:** Edge-based request routing and security
- **Technology:** Cloudflare Workers (V8 runtime)
- **Responsibilities:**
  - JWT authentication
  - Rate limiting (per user, per IP)
  - Input validation
  - Request forwarding
  - **CANNOT decrypt secrets** (no master key access)

**Component 3: Supabase PostgreSQL Database**
- **Purpose:** Encrypted secret storage
- **Technology:** PostgreSQL 15.x with Row-Level Security
- **Responsibilities:**
  - Store encrypted blobs
  - Enforce multi-tenancy via RLS
  - Manage relationships (projects, users, orgs)
  - Store plaintext metadata for search
  - **CANNOT decrypt secrets** (no master key access)

**Component 4: Audit Log System**
- **Purpose:** Tamper-proof activity tracking
- **Technology:** PostgreSQL append-only tables
- **Responsibilities:**
  - Log all secret access (read/write/delete)
  - Log authentication events
  - Log team membership changes
  - Support compliance reporting

### Component Interactions

**Browser ↔ Cloudflare Workers:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON
- Authentication: JWT Bearer token (Supabase Auth)

**Cloudflare Workers ↔ Supabase:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON (PostgREST API)
- Authentication: Service role key (server-to-server)

---

## Component Details

### Component: Browser-Based Encryption Engine

**Purpose:** Provides all cryptographic operations within the user's browser, ensuring the master key never leaves the client device.

**Responsibilities:**
- Derive master key from user password using PBKDF2
- Generate random Data Encryption Keys (DEKs) for each secret
- Encrypt secret values with DEKs using AES-256-GCM
- Encrypt DEKs with master key (envelope encryption)
- Decrypt secrets by first decrypting DEK, then secret value
- Generate cryptographically secure nonces and IVs
- Securely wipe keys from memory after use

**Technology Stack:**
- **Web Crypto API** - Native browser cryptography (audited, hardware-accelerated)
- **TypeScript** - Type-safe implementation
- **React Context** - Manage encryption state in UI

**Internal Architecture:**
```
┌─────────────────────────────────────────────────────┐
│         EncryptionService (TypeScript)              │
│  ┌─────────────────────────────────────────────┐   │
│  │  deriveMasterKey(password, salt)            │   │
│  │  → PBKDF2-SHA256, 100k iterations           │   │
│  │  → Returns CryptoKey object (non-extractable)│  │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  encryptSecret(plaintext, masterKey)        │   │
│  │  1. Generate random DEK (AES-256)           │   │
│  │  2. Generate random nonce (12 bytes)        │   │
│  │  3. Encrypt plaintext with DEK (AES-GCM)    │   │
│  │  4. Encrypt DEK with masterKey (AES-GCM)    │   │
│  │  5. Return {encryptedValue, encryptedDEK,   │   │
│  │             nonce, authTag}                 │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  decryptSecret(encrypted, masterKey)        │   │
│  │  1. Decrypt DEK using masterKey             │   │
│  │  2. Decrypt secret using DEK                │   │
│  │  3. Verify auth tag (integrity check)       │   │
│  │  4. Return plaintext                        │   │
│  │  5. Wipe DEK from memory                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Modules:**
- `crypto/masterKey.ts` - Master key derivation and management
- `crypto/encryption.ts` - Encryption/decryption operations
- `crypto/keystore.ts` - In-memory secure key storage
- `crypto/utils.ts` - Random generation, encoding utilities

**Configuration:**
```typescript
interface EncryptionConfig {
  algorithm: 'AES-GCM';
  keySize: 256;          // bits
  nonceSize: 12;         // bytes (96 bits)
  tagSize: 128;          // bits
  pbkdf2Iterations: 100000;
  pbkdf2Hash: 'SHA-256';
}
```

**Example:**
```typescript
const config: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keySize: 256,
  nonceSize: 12,
  tagSize: 128,
  pbkdf2Iterations: 100000,
  pbkdf2Hash: 'SHA-256'
};

// Usage
const encryptionService = new EncryptionService(config);
const masterKey = await encryptionService.deriveMasterKey(password, salt);
const encrypted = await encryptionService.encryptSecret(secretValue, masterKey);
```

---

## Data Flow

### Flow 1: User Creates First Secret (Master Password Setup)

**Trigger:** New user creates account and adds their first secret

**Steps:**

1. **User Registration:**
   ```typescript
   // Browser: User creates account via Supabase Auth
   const { user, error } = await supabase.auth.signUp({
     email: 'user@example.com',
     password: 'account_password' // Not the master password!
   });
   ```

2. **Master Password Creation:**
   ```typescript
   // Browser: User creates master password (separate from account password)
   const masterPassword = prompt('Create a master password for encrypting secrets:');

   // Generate salt (random, stored with user profile)
   const salt = crypto.getRandomValues(new Uint8Array(16));

   // Derive master key using PBKDF2
   const masterKey = await crypto.subtle.deriveKey(
     {
       name: 'PBKDF2',
       salt: salt,
       iterations: 100000,
       hash: 'SHA-256'
     },
     await crypto.subtle.importKey(
       'raw',
       new TextEncoder().encode(masterPassword),
       'PBKDF2',
       false,
       ['deriveKey']
     ),
     { name: 'AES-GCM', length: 256 },
     false, // non-extractable
     ['encrypt', 'decrypt']
   );

   // Store salt (plaintext) in database
   await supabase.from('user_encryption_keys').insert({
     user_id: user.id,
     salt: Array.from(salt), // Store as array
     created_at: new Date().toISOString()
   });
   ```

3. **Secret Encryption:**
   ```typescript
   // Browser: User enters secret value
   const secretValue = 'sk_test_abc123...';

   // Generate Data Encryption Key (DEK)
   const dek = await crypto.subtle.generateKey(
     { name: 'AES-GCM', length: 256 },
     true, // extractable (to be encrypted)
     ['encrypt', 'decrypt']
   );

   // Generate nonce for secret encryption
   const secretNonce = crypto.getRandomValues(new Uint8Array(12));

   // Encrypt secret with DEK
   const encryptedSecret = await crypto.subtle.encrypt(
     { name: 'AES-GCM', iv: secretNonce },
     dek,
     new TextEncoder().encode(secretValue)
   );

   // Export DEK (to encrypt it with master key)
   const rawDEK = await crypto.subtle.exportKey('raw', dek);

   // Generate nonce for DEK encryption
   const dekNonce = crypto.getRandomValues(new Uint8Array(12));

   // Encrypt DEK with master key
   const encryptedDEK = await crypto.subtle.encrypt(
     { name: 'AES-GCM', iv: dekNonce },
     masterKey,
     rawDEK
   );
   ```

4. **Server Storage:**
   ```typescript
   // Browser: Send encrypted data to server
   const response = await fetch('/api/secrets', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwtToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       project_id: 'project_uuid',
       environment: 'development',
       service_name: 'openai',
       key_name: 'OPENAI_API_KEY',
       encrypted_value: btoa(String.fromCharCode(...new Uint8Array(encryptedSecret))),
       encrypted_dek: btoa(String.fromCharCode(...new Uint8Array(encryptedDEK))),
       secret_nonce: btoa(String.fromCharCode(...new Uint8Array(secretNonce))),
       dek_nonce: btoa(String.fromCharCode(...new Uint8Array(dekNonce))),
       tags: ['ai', 'api-key']
     })
   });
   ```

5. **Server Processing (Cloudflare Workers):**
   ```typescript
   // Worker: Validate and forward (CANNOT decrypt)
   export default {
     async fetch(request, env) {
       // Authenticate user
       const jwt = request.headers.get('Authorization')?.replace('Bearer ', '');
       const user = await verifyJWT(jwt);

       // Validate input
       const body = await request.json();
       if (!body.encrypted_value || !body.encrypted_dek) {
         return new Response('Invalid request', { status: 400 });
       }

       // Rate limiting
       const rateLimitKey = `ratelimit:${user.id}`;
       const current = await env.KV.get(rateLimitKey);
       if (current && parseInt(current) > 100) {
         return new Response('Rate limit exceeded', { status: 429 });
       }

       // Forward to Supabase (we CANNOT decrypt, just pass through)
       const supabaseResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/secrets`, {
         method: 'POST',
         headers: {
           'apikey': env.SUPABASE_SERVICE_KEY,
           'Content-Type': 'application/json',
           'Prefer': 'return=representation'
         },
         body: JSON.stringify({
           ...body,
           user_id: user.id,
           created_at: new Date().toISOString()
         })
       });

       return supabaseResponse;
     }
   };
   ```

6. **Database Storage (Supabase PostgreSQL):**
   ```sql
   -- RLS ensures only owner can access
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
     created_at
   ) VALUES (
     gen_random_uuid(),
     'user_uuid',
     'project_uuid',
     'development',
     'openai',
     'OPENAI_API_KEY',
     decode('base64_encrypted_value', 'base64'),
     decode('base64_encrypted_dek', 'base64'),
     decode('base64_secret_nonce', 'base64'),
     decode('base64_dek_nonce', 'base64'),
     ARRAY['ai', 'api-key'],
     NOW()
   );
   ```

**Sequence Diagram:**
```
User       Browser        Workers        Supabase
  |           |             |              |
  |--password->|             |              |
  |           |             |              |
  |           |--PBKDF2---> (derive master key)
  |           |             |              |
  |--secret-->|             |              |
  |           |             |              |
  |           |--encrypt--> (DEK + AES-GCM)
  |           |             |              |
  |           |--POST------>|              |
  |           |             |--validate--->|
  |           |             |              |
  |           |             |--INSERT----->|
  |           |             |              |
  |           |             |<--success----|
  |           |<--success---|              |
  |<-confirm--|             |              |
```

**Data Transformations:**
- **Point A (User input):** Plaintext password and secret
- **Point B (After PBKDF2):** 256-bit master key (non-extractable CryptoKey)
- **Point C (After encryption):** Encrypted secret + encrypted DEK + nonces
- **Point D (Server storage):** Base64-encoded encrypted blobs + plaintext metadata

---

### Flow 2: User Retrieves and Decrypts Secret

**Trigger:** User needs to access a stored secret

**Steps:**

1. **Request Secret:**
   ```typescript
   // Browser: Request secret from API
   const response = await fetch(`/api/secrets/${secretId}`, {
     headers: {
       'Authorization': `Bearer ${jwtToken}`
     }
   });
   const encryptedData = await response.json();
   ```

2. **Database Retrieval:**
   ```sql
   -- RLS automatically filters to user's secrets
   SELECT
     id,
     service_name,
     key_name,
     encrypted_value,
     encrypted_dek,
     secret_nonce,
     dek_nonce,
     environment,
     tags
   FROM secrets
   WHERE id = 'secret_uuid'
     AND user_id = 'current_user_uuid'; -- Enforced by RLS
   ```

3. **Master Password Prompt:**
   ```typescript
   // Browser: Prompt user for master password (if not in session)
   const masterPassword = await promptMasterPassword();

   // Retrieve salt from user profile
   const { data: keyData } = await supabase
     .from('user_encryption_keys')
     .select('salt')
     .eq('user_id', user.id)
     .single();

   // Re-derive master key
   const masterKey = await deriveMasterKey(masterPassword, keyData.salt);
   ```

4. **Decrypt DEK:**
   ```typescript
   // Browser: Decrypt Data Encryption Key
   const dekNonce = base64ToUint8Array(encryptedData.dek_nonce);
   const encryptedDEK = base64ToUint8Array(encryptedData.encrypted_dek);

   const rawDEK = await crypto.subtle.decrypt(
     { name: 'AES-GCM', iv: dekNonce },
     masterKey,
     encryptedDEK
   );

   // Import DEK for use
   const dek = await crypto.subtle.importKey(
     'raw',
     rawDEK,
     'AES-GCM',
     false,
     ['decrypt']
   );
   ```

5. **Decrypt Secret:**
   ```typescript
   // Browser: Decrypt actual secret value
   const secretNonce = base64ToUint8Array(encryptedData.secret_nonce);
   const encryptedSecret = base64ToUint8Array(encryptedData.encrypted_value);

   const plaintextBuffer = await crypto.subtle.decrypt(
     { name: 'AES-GCM', iv: secretNonce },
     dek,
     encryptedSecret
   );

   const secretValue = new TextDecoder().decode(plaintextBuffer);

   // Display to user
   displaySecret(secretValue);

   // Securely wipe DEK from memory
   // (JavaScript doesn't guarantee this, but we clear references)
   dek = null;
   rawDEK = null;
   ```

6. **Audit Logging:**
   ```typescript
   // Browser: Log access event (happens automatically via trigger)
   // Server records: user_id, secret_id, action='read', timestamp, ip_address
   ```

---

## Security Boundaries

### Trust Boundaries

**Boundary 1: User's Browser ↔ Cloudflare Edge**
- **Threats:**
  - Man-in-the-middle attacks
  - Network eavesdropping
  - Session hijacking
- **Controls:**
  - TLS 1.3 encryption for all traffic
  - Certificate pinning (future enhancement)
  - JWT tokens with short expiration (15 minutes)
  - HTTP Strict Transport Security (HSTS)
  - Secure, HttpOnly cookies for session management

**Boundary 2: Cloudflare Workers ↔ Supabase**
- **Threats:**
  - API abuse
  - Data injection
  - Unauthorized access
- **Controls:**
  - Service-to-service authentication (service role key)
  - Input validation and sanitization
  - Rate limiting per user
  - Row-Level Security in PostgreSQL
  - Prepared statements to prevent SQL injection

**Boundary 3: User's Device ↔ Abyrith Platform**
- **Threats:**
  - Server compromise attempts to access plaintext
  - Insider threats (malicious employees)
  - Legal demands for data
- **Controls:**
  - **Zero-knowledge architecture**: Server cannot decrypt even if compromised
  - Master key never transmitted
  - No server-side decryption capability
  - Encrypted data-at-rest

### What the Server Can See

**CAN see (plaintext):**
- User account information (email, name, profile)
- Project names and descriptions
- Environment names (dev, staging, production)
- Secret metadata (service name, key name, tags)
- Access logs (who accessed what, when, from where)
- Team membership and roles

**CANNOT see (encrypted):**
- Secret values (API keys, passwords, tokens)
- Master password
- Data Encryption Keys (DEKs are encrypted)

**Why this matters:**
- Even if Abyrith's database is compromised, attackers get only encrypted blobs
- Subpoenas and legal demands cannot force disclosure of secret values (we don't have access)
- Insider threats are mitigated (employees cannot see secrets)
- Users maintain complete data sovereignty

---

## Cryptographic Specifications

### Master Key Derivation

**Algorithm:** PBKDF2 (Password-Based Key Derivation Function 2)

**Parameters:**
```typescript
interface MasterKeyDerivation {
  algorithm: 'PBKDF2';
  hash: 'SHA-256';
  iterations: 100000;      // Balance security and UX
  saltLength: 16;          // bytes (128 bits)
  keyLength: 32;           // bytes (256 bits)
  extractable: false;      // Key cannot be exported
}
```

**Process:**
1. Generate random 128-bit salt (once per user, stored in database)
2. Derive 256-bit key from password + salt using PBKDF2-SHA256
3. Key is non-extractable (cannot be exported from Web Crypto API)
4. Key remains in memory only during session

**Security Rationale:**
- 100,000 iterations makes brute-force attacks expensive (~100ms on modern hardware)
- SHA-256 is NIST-approved and widely supported
- Random salt prevents rainbow table attacks
- Non-extractable key prevents accidental leakage via JavaScript

**Example Implementation:**
```typescript
async function deriveMasterKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as CryptoKey material
  const keyMaterial = await crypto.subtle.importKey(
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
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );

  return masterKey;
}
```

### Secret Encryption (AES-256-GCM)

**Algorithm:** AES-256-GCM (Advanced Encryption Standard, Galois/Counter Mode)

**Parameters:**
```typescript
interface SecretEncryption {
  algorithm: 'AES-GCM';
  keyLength: 256;           // bits
  nonceLength: 12;          // bytes (96 bits)
  tagLength: 128;           // bits (authentication tag)
}
```

**Process:**
1. Generate random 256-bit Data Encryption Key (DEK) per secret
2. Generate random 96-bit nonce (never reuse with same key)
3. Encrypt secret plaintext with DEK using AES-256-GCM
4. GCM mode produces ciphertext + 128-bit authentication tag
5. Encrypt DEK with master key (envelope encryption)
6. Store: encrypted secret, encrypted DEK, nonce, tag

**Security Rationale:**
- AES-256 is NIST-approved, quantum-resistant for foreseeable future
- GCM provides both confidentiality and authenticity
- 96-bit nonce is sufficient for billions of encryptions per key
- Envelope encryption allows key rotation without re-encrypting all secrets
- Authentication tag prevents tampering (any modification detected)

**Example Implementation:**
```typescript
async function encryptSecret(
  plaintext: string,
  masterKey: CryptoKey
): Promise<EncryptedSecret> {
  // 1. Generate Data Encryption Key
  const dek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable (to be encrypted)
    ['encrypt', 'decrypt']
  );

  // 2. Generate nonce for secret encryption
  const secretNonce = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt secret with DEK
  const encryptedSecret = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: secretNonce,
      tagLength: 128
    },
    dek,
    new TextEncoder().encode(plaintext)
  );

  // 4. Export DEK (to encrypt with master key)
  const rawDEK = await crypto.subtle.exportKey('raw', dek);

  // 5. Generate nonce for DEK encryption
  const dekNonce = crypto.getRandomValues(new Uint8Array(12));

  // 6. Encrypt DEK with master key
  const encryptedDEK = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: dekNonce,
      tagLength: 128
    },
    masterKey,
    rawDEK
  );

  return {
    encryptedValue: new Uint8Array(encryptedSecret),
    encryptedDEK: new Uint8Array(encryptedDEK),
    secretNonce: secretNonce,
    dekNonce: dekNonce
  };
}
```

### Envelope Encryption Pattern

**Purpose:** Enable efficient key rotation and multiple-key access

**Structure:**
```
User's Secret (plaintext)
    ↓ encrypted with
Data Encryption Key (DEK) ← generated randomly per secret
    ↓ encrypted with
Master Key ← derived from user's password

For team sharing:
DEK can be encrypted with multiple Master Keys (one per team member)
Without re-encrypting the secret itself
```

**Benefits:**
- Key rotation: Change master key without re-encrypting all secrets
- Team sharing: Encrypt same DEK with multiple master keys
- Performance: Only DEK needs re-encryption, not large secret values

---

## Threat Model

### Threat 1: Database Compromise

**Description:** Attacker gains read access to PostgreSQL database (SQL injection, stolen credentials, insider threat)

**Likelihood:** Medium (databases are high-value targets)

**Impact:** High (contains all secrets)

**Mitigation:**
- ✅ **Zero-knowledge encryption**: All secret values encrypted with keys derived from user passwords
- ✅ **No server-side decryption**: Even with database access, attacker gets only encrypted blobs
- ✅ **Row-Level Security**: Multi-tenancy enforcement prevents cross-user access
- ✅ **Encrypted DEKs**: DEKs are encrypted with master keys, never stored plaintext
- ✅ **Strong key derivation**: PBKDF2 with 100k iterations makes password cracking expensive

**Residual Risk:** Attacker could attempt brute-force on weak passwords (mitigated by password strength requirements, 2FA)

### Threat 2: Man-in-the-Middle Attack

**Description:** Attacker intercepts network traffic between user and server

**Likelihood:** Low (requires privileged network position or compromised CA)

**Impact:** High (could capture encrypted secrets and JWT tokens)

**Mitigation:**
- ✅ **TLS 1.3**: All traffic encrypted in transit
- ✅ **HSTS**: Enforces HTTPS, prevents downgrade attacks
- ✅ **JWT short expiration**: 15-minute token lifetime limits exposure window
- ✅ **Secrets pre-encrypted**: Even if traffic intercepted, secrets are already encrypted client-side
- 🔄 **Certificate pinning** (future): Prevents rogue CA attacks

**Residual Risk:** JWT token theft within 15-minute window (mitigated by secure cookie flags, 2FA)

### Threat 3: Malicious JavaScript Injection (XSS)

**Description:** Attacker injects malicious JavaScript into Abyrith web app

**Likelihood:** Low (requires vulnerability in React/Next.js or dependencies)

**Impact:** Critical (could access decrypted secrets in memory)

**Mitigation:**
- ✅ **Content Security Policy (CSP)**: Restricts script sources
- ✅ **React's XSS protection**: Automatic escaping of user input
- ✅ **Dependency scanning**: Automated vulnerability scanning (Dependabot)
- ✅ **Subresource Integrity (SRI)**: Ensures external scripts unchanged
- ✅ **Short-lived decryption**: Secrets decrypted on-demand, not kept in memory
- ✅ **Input sanitization**: All user input sanitized before rendering

**Residual Risk:** Zero-day XSS in React or dependencies (mitigated by rapid patching)

### Threat 4: Compromised Developer Machine

**Description:** User's laptop is compromised by malware

**Likelihood:** Medium (common attack vector)

**Impact:** High (attacker could capture master password via keylogger)

**Mitigation:**
- ✅ **Device-level protection**: Users encouraged to use full-disk encryption
- ✅ **2FA requirement**: Even with password, attacker needs second factor
- ✅ **Session timeouts**: Require re-authentication after inactivity
- ✅ **Biometric authentication** (future): Use device biometrics instead of typing password
- 🔄 **Trusted device tracking** (future): Alert on login from new device

**Residual Risk:** Persistent malware on user's machine (out of scope for application security)

### Threat 5: Insider Threat (Abyrith Employee)

**Description:** Malicious Abyrith employee attempts to access user secrets

**Likelihood:** Low (requires intentional malicious action)

**Impact:** Critical (erosion of user trust)

**Mitigation:**
- ✅ **Zero-knowledge architecture**: Employees cannot decrypt secrets (no master keys)
- ✅ **Least privilege access**: Database access limited to necessary personnel
- ✅ **Audit logging**: All administrative actions logged
- ✅ **Code review**: All database access code reviewed for backdoors
- ✅ **Third-party audit**: Independent security audit verifies zero-knowledge claims

**Residual Risk:** Theoretical code injection to capture master keys client-side (mitigated by open-source frontend, security audits)

### Threat 6: Password Reset Attack

**Description:** Attacker initiates password reset to access account

**Likelihood:** Medium (common attack against password managers)

**Impact:** Critical (could lock out legitimate user, attempt master password reset)

**Mitigation:**
- ✅ **Separate account and master passwords**: Resetting account password does not reset master password
- ✅ **Master password is unrecoverable**: If lost, secrets cannot be decrypted (necessary for zero-knowledge)
- ✅ **Recovery keys**: Optional encrypted recovery keys for master password
- ✅ **Email verification**: Password resets require email confirmation
- ✅ **2FA for sensitive operations**: Require second factor for account changes

**Residual Risk:** Lost master password = lost secrets (acceptable trade-off for zero-knowledge; users warned during setup)

### Threat 7: API Key Leakage via Logs

**Description:** Decrypted secrets accidentally logged to server logs or client console

**Likelihood:** Medium (common developer mistake)

**Impact:** High (secret exposure)

**Mitigation:**
- ✅ **No server-side decryption**: Secrets never decrypted on server, cannot appear in server logs
- ✅ **Client-side log filtering**: Redact sensitive values from console output
- ✅ **Code review**: Review for accidental logging
- ✅ **Production console disabling**: Disable console.log in production builds

**Residual Risk:** Developer accidentally logs decrypted secret in client-side code (mitigated by code review, training)

### Threat 8: Quantum Computing Attack (Future)

**Description:** Quantum computers break AES-256 or PBKDF2-SHA256

**Likelihood:** Very Low (not a threat for 10+ years)

**Impact:** Critical (all encryption broken)

**Mitigation:**
- 🔄 **AES-256 is quantum-resistant**: Grover's algorithm provides only quadratic speedup (effective 128-bit security, still secure)
- 🔄 **SHA-256 is quantum-resistant**: Grover's algorithm reduces to 128-bit security (still secure)
- 🔄 **Algorithm migration plan**: Can migrate to post-quantum algorithms when needed
- 🔄 **Envelope encryption**: Only DEKs need re-encryption if algorithms change

**Residual Risk:** Quantum computers arrive faster than expected (monitor NIST post-quantum standards)

---

## Security Controls

### Authentication

**Method:** Supabase Auth with JWT tokens

**How it works:**
1. User authenticates with email/password or OAuth (Google, GitHub)
2. Supabase Auth issues JWT token containing user ID, email, role
3. Token signed with HMAC-SHA256 and Supabase secret key
4. Frontend includes token in Authorization header for all API requests
5. Cloudflare Workers verify token signature before processing requests

**JWT Structure:**
```typescript
interface JWTPayload {
  sub: string;        // User ID (UUID)
  email: string;      // User email
  app_metadata: {
    provider: string; // 'email' | 'google' | 'github'
  };
  user_metadata: {
    name?: string;
  };
  role: string;       // 'authenticated'
  iat: number;        // Issued at (Unix timestamp)
  exp: number;        // Expires at (Unix timestamp, +15 minutes)
}
```

**Token Lifecycle:**
- **Expiration:** 15 minutes (short-lived for security)
- **Refresh:** Automatic refresh via Supabase Auth Helpers
- **Revocation:** Logout invalidates refresh token
- **Storage:** Secure, HttpOnly cookies (not accessible via JavaScript)

### Authorization

**Model:** Role-Based Access Control (RBAC)

**Enforcement points:**
1. **Client-side (UX):** Hide UI elements user doesn't have permission to access
2. **API Gateway (Cloudflare Workers):** Verify user has permission before forwarding request
3. **Database (PostgreSQL RLS):** Final enforcement layer, prevents data access

**Permission evaluation:**
```sql
-- Example RLS policy for secrets table
CREATE POLICY "Users can only access their own secrets"
  ON secrets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = secrets.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('owner', 'admin', 'developer', 'read-only')
    )
  );
```

### Data Protection

**Data at Rest:**
- **Encryption:** AES-256-GCM client-side encryption for secret values
- **Storage:** PostgreSQL with built-in encryption at rest (if enabled by Supabase)
- **Access controls:** Row-Level Security enforces multi-tenancy

**Data in Transit:**
- **Encryption:** TLS 1.3 for all network traffic
- **Certificate management:** Managed by Cloudflare
- **HSTS:** Enforces HTTPS, prevents downgrade attacks

**Data in Use:**
- **Processing:** Secrets decrypted in user's browser only
- **Temporary storage:** Decrypted values in memory, cleared after use
- **Memory security:** JavaScript doesn't guarantee secure memory wiping (use references, garbage collection)

### Audit Logging

**What events are logged:**
- Secret created, read, updated, deleted
- Master password changed
- Team member added, removed, role changed
- Project created, archived, deleted
- Authentication events (login, logout, failed attempts)
- MCP requests (AI tools requesting secrets)
- Approval grants and denials

**What information is captured:**
```typescript
interface AuditLogEntry {
  id: string;              // UUID
  timestamp: string;       // ISO 8601
  user_id: string;         // Actor UUID
  action: string;          // 'secret.read', 'secret.create', etc.
  resource_type: string;   // 'secret', 'project', 'member'
  resource_id: string;     // UUID of resource
  ip_address: string;      // Source IP (anonymized in some jurisdictions)
  user_agent: string;      // Browser/tool identifier
  metadata: object;        // Additional context (non-sensitive)
  result: 'success' | 'failure';
}
```

**Audit log properties:**
- **Append-only:** No deletions or modifications allowed
- **Immutability:** Database constraints prevent tampering
- **Retention:** 1 year minimum (configurable per organization)
- **Export:** CSV/JSON export for compliance reporting

### Compliance

**GDPR (General Data Protection Regulation):**
- ✅ Right to access: Users can export all their data
- ✅ Right to deletion: Users can delete account and all data
- ✅ Right to portability: Export in machine-readable format (JSON)
- ✅ Consent: Clear consent for data processing
- ✅ Data minimization: Only collect necessary data
- ✅ Privacy by design: Zero-knowledge architecture

**SOC 2 Type II:**
- ✅ Security: Zero-knowledge encryption, audit logs
- ✅ Availability: 99.9% uptime SLA (via Cloudflare/Supabase)
- ✅ Confidentiality: Strong encryption, access controls
- ✅ Processing integrity: Data validation, error handling
- ✅ Privacy: GDPR compliance, data minimization

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- **Master key derivation:** < 500ms (PBKDF2 is intentionally slow)
- **Secret encryption:** < 100ms for secrets up to 1MB
- **Secret decryption:** < 100ms for secrets up to 1MB
- **API response:** < 200ms p95 (excluding client-side crypto)
- **Database query:** < 100ms p95 for single-secret retrieval

**Throughput:**
- **Concurrent users:** 10,000+ (Cloudflare Workers auto-scale)
- **Requests per second:** 1,000+ per user (rate-limited to prevent abuse)

**Resource Usage:**
- **Memory (client):** ~5MB for encryption engine, < 50MB during active use
- **CPU (client):** Minimal except during PBKDF2 (one-time per session)
- **Storage:** ~1KB per secret (encrypted value + metadata)

### Performance Optimization

**Optimizations implemented:**
- **Web Crypto API:** Hardware-accelerated AES-GCM (10-100x faster than JS implementations)
- **Key caching:** Master key kept in memory during session (avoid re-deriving)
- **Lazy decryption:** Secrets decrypted only when viewed
- **Edge computing:** Cloudflare Workers reduce latency via global distribution
- **Connection pooling:** PgBouncer for efficient database connections
- **Indexes:** Database indexes on user_id, project_id, environment for fast queries

**Caching Strategy:**
- **Master key:** Cached in browser memory during session (cleared on logout)
- **Encrypted secrets:** Cached in browser memory after first fetch (React Query)
- **Metadata:** Cached at edge (Cloudflare Workers KV) for 5 minutes
- **Cache invalidation:** On secret update/delete, invalidate cache immediately

**Database Optimization:**
- **Indexes:**
  ```sql
  CREATE INDEX idx_secrets_user_project ON secrets(user_id, project_id);
  CREATE INDEX idx_secrets_environment ON secrets(environment);
  CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
  ```
- **Query optimization:** Use SELECT only needed columns, avoid SELECT *
- **Connection pooling:** PgBouncer manages 100 connections (pool_mode: transaction)

---

## Failure Modes

### Failure Mode 1: User Forgets Master Password

**Scenario:** User cannot remember their master password

**Impact:** Cannot decrypt any secrets (by design of zero-knowledge architecture)

**Detection:** User reports inability to decrypt secrets, enters incorrect password repeatedly

**Recovery:**
1. **If recovery key was created:**
   - User enters recovery key (encrypted backup of master key)
   - Recovery key decrypted with separate passphrase
   - Master key restored, user can decrypt secrets
2. **If no recovery key:**
   - Secrets are unrecoverable (necessary consequence of zero-knowledge)
   - User must create new secrets from scratch
   - Clear communication during onboarding about this trade-off

**Prevention:**
- Strong password requirements during master password creation
- Optional recovery key generation (recommended for all users)
- Warning message: "If you forget this password, we cannot recover your secrets"
- Prompt to store password in physical password manager (not digital)

---

### Failure Mode 2: Database Compromise

**Scenario:** Attacker gains read access to PostgreSQL database

**Impact:** Attacker obtains encrypted secrets but cannot decrypt them

**Detection:**
- Supabase alerts on unusual database access patterns
- Monitor for sudden spike in data exports
- Monitor for privilege escalation attempts

**Recovery:**
1. Immediate incident response (follow `ops-security-runbook.md`)
2. Rotate Supabase service keys
3. Audit all database access logs
4. Force user re-authentication (invalidate all JWT tokens)
5. Notify affected users (if any data exfiltrated)
6. Third-party forensic investigation

**Prevention:**
- Row-Level Security policies prevent cross-user access
- Least privilege access (only necessary personnel have database access)
- Database access logging and monitoring
- Regular security audits and penetration testing
- Secrets stored with zero-knowledge encryption (attacker cannot decrypt)

---

### Failure Mode 3: Web Crypto API Unavailable

**Scenario:** User's browser doesn't support Web Crypto API or it's disabled

**Impact:** Cannot encrypt/decrypt secrets (platform unusable)

**Detection:** Browser compatibility check on page load

**Recovery:**
1. Display clear error message: "Your browser doesn't support the encryption features required by Abyrith"
2. Recommend supported browsers (Chrome 100+, Firefox 100+, Safari 15+)
3. Provide link to browser compatibility documentation

**Prevention:**
- Check for Web Crypto API support during initial page load
- Display warning before user creates account if unsupported
- Document browser requirements prominently in user guide

---

## Alternatives Considered

### Alternative 1: Server-Side Encryption with HSM

**Description:** Encrypt secrets on server using Hardware Security Module (HSM), eliminating client-side complexity

**Pros:**
- Simpler user experience (no master password)
- Easier key recovery
- Faster encryption (dedicated hardware)

**Cons:**
- Server can decrypt secrets (violates zero-knowledge principle)
- Trust in Abyrith platform required
- Vulnerable to insider threats
- Legal demands can force disclosure
- Less differentiated from competitors

**Why not chosen:** Violates core product principle of zero-knowledge architecture. Users demand data sovereignty, especially for sensitive developer secrets.

---

### Alternative 2: Blockchain-Based Decentralized Storage

**Description:** Store encrypted secrets on blockchain (IPFS, Ethereum, etc.)

**Pros:**
- Decentralized (no single point of failure)
- Immutable audit trail
- No trust in central server required

**Cons:**
- Extremely complex for users
- Expensive (gas fees for Ethereum transactions)
- Slow (blockchain confirmation times)
- Difficult key management (lose private key = lose everything)
- Poor user experience for mainstream adoption

**Why not chosen:** Complexity and cost vastly outweigh benefits. Zero-knowledge architecture on traditional infrastructure achieves same security properties with better UX.

---

### Alternative 3: Local-Only Encryption (No Cloud Storage)

**Description:** Secrets encrypted and stored only on user's device, like 1Password's local vaults

**Pros:**
- Ultimate data sovereignty
- No server compromise risk
- No subscription required

**Cons:**
- No team sharing
- No sync across devices
- Difficult backup and recovery
- No AI assistant features (requires server context)
- Doesn't solve for AI development tools (MCP requires server)

**Why not chosen:** Eliminates core value propositions (team collaboration, AI assistant, MCP integration). Market already has local solutions.

---

## Decision Log

### Decision 1: PBKDF2 vs. Argon2 for Key Derivation

**Date:** 2025-10-29

**Context:** Need to choose key derivation function for master password

**Options:**
1. **PBKDF2-SHA256** - NIST-approved, widely supported, built into Web Crypto API
2. **Argon2** - Winner of Password Hashing Competition, memory-hard, more resistant to GPU/ASIC attacks

**Decision:** PBKDF2-SHA256

**Rationale:**
- Native Web Crypto API support (no external library, reduced bundle size)
- Sufficient security with 100k iterations for our use case
- Argon2 requires JavaScript implementation (slower, larger bundle, more attack surface)
- Can migrate to Argon2 in future if needed (envelope encryption supports algorithm changes)

**Consequences:**
- More vulnerable to GPU-based attacks than Argon2
- Mitigated by strong password requirements and 2FA

---

### Decision 2: 100,000 PBKDF2 Iterations

**Date:** 2025-10-29

**Context:** Need to balance security (more iterations) with UX (faster key derivation)

**Options:**
1. **10,000 iterations** - Fast (~50ms), minimum security
2. **100,000 iterations** - Balanced (~200-500ms), good security
3. **1,000,000 iterations** - Maximum security (~2-5s), poor UX

**Decision:** 100,000 iterations

**Rationale:**
- OWASP recommends 100,000+ for PBKDF2-SHA256
- ~200-500ms derivation time is acceptable UX (happens once per session)
- Strong enough to make brute-force attacks expensive
- Can increase in future if hardware improves

**Consequences:**
- Slight delay when logging in (acceptable)
- Users on slow devices may experience 500ms delay (rare, still acceptable)

---

### Decision 3: Envelope Encryption with Per-Secret DEKs

**Date:** 2025-10-29

**Context:** Should we encrypt all secrets with master key directly, or use envelope encryption?

**Options:**
1. **Direct encryption** - Encrypt each secret directly with master key
2. **Envelope encryption** - Generate DEK per secret, encrypt DEK with master key

**Decision:** Envelope encryption

**Rationale:**
- Enables efficient key rotation (only re-encrypt DEKs, not all secrets)
- Supports team sharing (encrypt same DEK with multiple master keys)
- Performance: Large secrets encrypted once with DEK
- Standard enterprise pattern (AWS KMS, Google Cloud KMS use this)

**Consequences:**
- Slightly more complex implementation
- Two decryption operations instead of one (negligible performance impact)
- Additional storage for encrypted DEKs (~48 bytes per secret)

---

### Decision 4: AES-GCM vs. AES-CBC for Secret Encryption

**Date:** 2025-10-29

**Context:** Choose symmetric encryption mode for secrets

**Options:**
1. **AES-GCM** - Authenticated encryption, provides confidentiality + integrity
2. **AES-CBC** - Classic mode, requires separate HMAC for authentication

**Decision:** AES-GCM

**Rationale:**
- Authenticated encryption prevents tampering (CBC + HMAC achieves same but more complex)
- Single operation for encrypt + authenticate (better performance)
- Recommended by NIST and security experts
- Native Web Crypto API support

**Consequences:**
- Nonce reuse is catastrophic (mitigated by cryptographically secure random generation)
- Must ensure nonces never repeat (acceptable with 96-bit random nonces)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `GLOSSARY.md` - Security terminology definitions
- [ ] `TECH-STACK.md` - Web Crypto API, Supabase Auth specifications
- [ ] `01-product/product-vision-strategy.md` - Zero-knowledge architecture requirement

**External Services:**
- **Web Crypto API** - Browser standard, no external dependency
- **Supabase Auth** - JWT authentication, OAuth providers
- **Cloudflare Workers** - Edge computing for API gateway
- **PostgreSQL 15+** - Database with Row-Level Security

### Architecture Dependencies

**Depends on these components:**
- `auth.users` table (Supabase managed) - User authentication
- `user_encryption_keys` table - Store PBKDF2 salts per user

**Required by these components:**
- `04-database/schemas/secrets-metadata.md` - Database schema for secrets
- `05-api/endpoints/secrets-endpoints.md` - API endpoints for secret management
- `07-frontend/client-encryption/webcrypto-implementation.md` - Frontend encryption code

---

## References

### Internal Documentation
- `GLOSSARY.md` - Security terminology
- `TECH-STACK.md` - Technology specifications
- `01-product/product-vision-strategy.md` - Product vision
- `DOCUMENTATION-ROADMAP.md` - Documentation plan

### External Resources
- [Web Crypto API Specification](https://www.w3.org/TR/WebCryptoAPI/) - W3C standard
- [NIST SP 800-132](https://csrc.nist.gov/publications/detail/sp/800-132/final) - PBKDF2 recommendations
- [RFC 5869](https://tools.ietf.org/html/rfc5869) - HKDF key derivation
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - Best practices
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) - Authentication integration
- [Cloudflare Workers Security](https://developers.cloudflare.com/workers/platform/security/) - Edge security

### Security Standards
- **SOC 2 Type II** - Service Organization Control 2
- **ISO 27001** - Information Security Management
- **GDPR** - General Data Protection Regulation
- **NIST Cybersecurity Framework** - Security controls

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Security Lead / Engineering Lead | Initial security model documentation |

---

## Notes

### Future Enhancements
- **Biometric authentication:** Use WebAuthn for passwordless authentication (Phase 3)
- **Hardware security keys:** Support YubiKey, Titan for 2FA (Phase 3)
- **Post-quantum encryption:** Migrate to NIST-approved algorithms when standardized (Phase 4+)
- **Threshold cryptography:** Split master key across multiple devices for enterprise (Phase 4+)

### Known Issues
- JavaScript cannot guarantee secure memory wiping (OS-level concern, out of scope)
- Master password loss is unrecoverable (acceptable trade-off for zero-knowledge)
- PBKDF2 iterations may need increase as hardware improves (monitor annually)

### Next Review Date
**2026-01-29** - Review cryptographic parameters, check for new vulnerabilities, update for new standards
