---
Document: Encryption Specification - Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Security Lead
Status: Draft
Dependencies: 03-security/security-model.md, GLOSSARY.md, TECH-STACK.md
---

# Encryption Specification Architecture

## Overview

This document provides the complete technical specification for Abyrith's encryption implementation. It defines the exact cryptographic algorithms, parameters, key derivation functions, data formats, and implementation details required to build the zero-knowledge encryption system that protects all secrets in Abyrith.

**Purpose:** Serve as the authoritative reference for implementing client-side encryption using Web Crypto API, ensuring all secrets are encrypted before leaving the user's device.

**Scope:** Covers encryption/decryption, key derivation, nonce generation, data formats, key rotation, browser compatibility, and performance considerations.

**Status:** Draft - Awaiting security review

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
Developers need a way to store API keys and secrets securely without trusting a third-party service with unencrypted access. Existing solutions either store secrets in plaintext server-side or require complex encryption infrastructure that's difficult for individuals to implement correctly.

**Pain points:**
- Most secret management tools have access to unencrypted secrets
- Users must trust the service provider won't be compromised
- Compliance requirements (SOC 2, ISO 27001) demand zero-knowledge architecture
- Implementing encryption correctly is difficult and error-prone
- Key management and rotation add complexity

**Why now?**
Abyrith's core value proposition is zero-knowledge security that "just works." The encryption specification must be bulletproof, performant, and implementable entirely in the browser using standard Web Crypto API.

### Background

**Zero-Knowledge Architecture Requirement:**
Abyrith follows a strict zero-knowledge model where the server never has access to:
- Master passwords
- Derived encryption keys
- Unencrypted secret values
- Decrypted secret metadata

**Existing system (if applicable):**
This is a new implementation. No previous encryption system exists.

**Previous attempts:**
N/A - Initial implementation

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Security Lead | Cryptographic correctness | Algorithm choice, implementation flaws, key management |
| Frontend Engineers | Implementation complexity | Browser compatibility, performance, debuggability |
| Backend Engineers | Key storage, RLS policies | Encrypted data format, query performance, indexing |
| Product Team | User experience | Master password flow, recovery mechanisms, performance |
| Compliance Team | Regulatory requirements | SOC 2, GDPR, ISO 27001 compliance |
| End Users | Data security | Trust that secrets are truly protected, password recovery |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Zero-knowledge encryption** - Server cannot decrypt secrets under any circumstance (Success metric: Cryptographic proof that server never receives unencrypted keys)
2. **Standards-based cryptography** - Use only well-vetted, industry-standard algorithms (Success metric: All algorithms are NIST-approved or equivalent)
3. **Browser-native implementation** - Use Web Crypto API without external libraries (Success metric: Zero npm dependencies for core crypto operations)
4. **Performance** - Encryption/decryption completes in <100ms for typical secrets (Success metric: p95 latency <100ms)

**Secondary goals:**
- Secure key derivation with adjustable iteration count
- Support for key rotation without data migration
- Backward compatibility with future algorithm upgrades
- Comprehensive error handling and security logging

### Non-Goals

**Explicitly out of scope:**
- **Hardware security modules (HSM)** - Not required for MVP, too complex for solo developers
- **Post-quantum cryptography** - AES-256 is quantum-resistant for symmetric encryption; asymmetric PQC out of scope for MVP
- **Homomorphic encryption** - Server-side computation on encrypted data not needed for our use case
- **Multi-party computation** - Not implementing threshold cryptography or secret sharing (future consideration for enterprise)

### Success Metrics

**How we measure success:**
- **Security audits pass**: External security audit finds no critical vulnerabilities
- **Performance target met**: p95 encryption latency <100ms, decryption <50ms
- **Browser compatibility**: Works on 95%+ of browsers (Chrome 100+, Firefox 100+, Safari 15+)
- **Zero security incidents**: No successful attacks on encryption implementation in first year

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│                                                          │
│  ┌──────────────┐                                       │
│  │   Master     │ (never transmitted)                   │
│  │   Password   │                                       │
│  └──────┬───────┘                                       │
│         │                                                │
│         │ PBKDF2 (600,000 iterations)                   │
│         ▼                                                │
│  ┌──────────────┐                                       │
│  │   Master     │ (never transmitted)                   │
│  │     Key      │ (stored in memory only)               │
│  └──────┬───────┘                                       │
│         │                                                │
│         │ Derive (HKDF)                                 │
│         ▼                                                │
│  ┌──────────────┐                                       │
│  │ Encryption   │ (ephemeral)                           │
│  │     Key      │                                       │
│  └──────┬───────┘                                       │
│         │                                                │
│         │ AES-256-GCM                                   │
│         │ + Random 96-bit nonce                        │
│         ▼                                                │
│  ┌──────────────────────────┐                          │
│  │   Encrypted Secret        │                          │
│  │   (Base64-encoded)        │                          │
│  └──────────┬────────────────┘                          │
│             │                                            │
└─────────────┼────────────────────────────────────────────┘
              │
              │ HTTPS
              ▼
┌─────────────────────────────────────────────────────────┐
│                  Abyrith Backend                         │
│                 (Cloudflare Workers)                     │
│                                                          │
│  - Receives only encrypted ciphertext                   │
│  - Stores encrypted data in PostgreSQL                  │
│  - No access to encryption keys                         │
│  - Cannot decrypt secrets                               │
└─────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Key Derivation Function (PBKDF2)**
- **Purpose:** Derives encryption key from user's master password
- **Technology:** Web Crypto API `crypto.subtle.deriveBits()`
- **Responsibilities:**
  - Convert password to cryptographically strong key
  - Slow down brute-force attacks (600,000 iterations)
  - Generate deterministic key from same password + salt

**Component 2: Symmetric Encryption (AES-256-GCM)**
- **Purpose:** Encrypts and decrypts secret values
- **Technology:** Web Crypto API `crypto.subtle.encrypt()` and `crypto.subtle.decrypt()`
- **Responsibilities:**
  - Encrypt secret values before transmission
  - Decrypt secret values after retrieval
  - Provide authenticated encryption (integrity + confidentiality)
  - Use unique nonces for every encryption operation

**Component 3: Nonce/IV Generator**
- **Purpose:** Generates cryptographically secure random nonces
- **Technology:** Web Crypto API `crypto.getRandomValues()`
- **Responsibilities:**
  - Generate 96-bit (12-byte) nonces for AES-GCM
  - Ensure statistical uniqueness (collision probability <2^-32)
  - Store nonce alongside ciphertext

**Component 4: Key Storage Manager**
- **Purpose:** Manages encryption keys in browser memory
- **Technology:** JavaScript `WeakMap` or session storage (encrypted)
- **Responsibilities:**
  - Hold master key in memory during session
  - Automatically clear keys on logout
  - Re-derive keys after browser refresh
  - Never persist unencrypted keys to disk

### Component Interactions

**Master Password → Master Key:**
- Protocol: PBKDF2
- Data format: Raw password bytes → 256-bit key
- Authentication: None (local operation)

**Master Key → Encryption Key:**
- Protocol: HKDF (optional, for future key rotation)
- Data format: 256-bit master key → 256-bit encryption key
- Authentication: None (local operation)

**Plaintext Secret → Ciphertext:**
- Protocol: AES-256-GCM
- Data format: UTF-8 plaintext → Base64 ciphertext + nonce + tag
- Authentication: GCM authentication tag

---

## Component Details

### Component: PBKDF2 Key Derivation

**Purpose:** Convert user's master password into a cryptographically strong 256-bit encryption key using Password-Based Key Derivation Function 2 (PBKDF2).

**Responsibilities:**
- Accept master password and salt as input
- Perform 600,000 iterations of HMAC-SHA-256
- Output 256-bit (32-byte) derived key
- Provide consistent results for same password + salt
- Resist brute-force and dictionary attacks

**Technology Stack:**
- Web Crypto API `crypto.subtle.deriveBits()`
- HMAC-SHA-256 as the pseudorandom function (PRF)
- 128-bit (16-byte) cryptographically random salt

**Internal Architecture:**
```
┌──────────────────┐
│ Master Password  │
│   (UTF-8 string) │
└────────┬─────────┘
         │
         │ Import as CryptoKey
         ▼
┌────────────────────────────────────────┐
│  PBKDF2 Parameters:                    │
│  - Algorithm: PBKDF2                   │
│  - Hash: SHA-256                       │
│  - Salt: 128-bit random                │
│  - Iterations: 600,000                 │
│  - Output length: 256 bits             │
└────────┬───────────────────────────────┘
         │
         │ crypto.subtle.deriveBits()
         ▼
┌──────────────────┐
│   Master Key     │
│   (256-bit)      │
└──────────────────┘
```

**Configuration:**
```typescript
interface PBKDF2Config {
  name: 'PBKDF2';
  hash: 'SHA-256';
  salt: Uint8Array;        // 128-bit (16 bytes)
  iterations: 600000;      // OWASP recommendation (2023)
}
```

**Example:**
```typescript
const config: PBKDF2Config = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  salt: crypto.getRandomValues(new Uint8Array(16)),
  iterations: 600000
};

// Import password as key material
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(masterPassword),
  'PBKDF2',
  false,
  ['deriveBits']
);

// Derive 256-bit key
const derivedBits = await crypto.subtle.deriveBits(
  config,
  keyMaterial,
  256
);

const masterKey = new Uint8Array(derivedBits);
```

---

### Component: AES-256-GCM Encryption

**Purpose:** Encrypt secret values using Advanced Encryption Standard (AES) in Galois/Counter Mode (GCM) with 256-bit keys, providing both confidentiality and authenticity.

**Responsibilities:**
- Encrypt plaintext secrets to ciphertext
- Generate authentication tags to detect tampering
- Use unique nonces for every encryption
- Provide fast encryption/decryption (<100ms)

**Technology Stack:**
- Web Crypto API `crypto.subtle.encrypt()` and `crypto.subtle.decrypt()`
- AES-256 in GCM mode
- 96-bit (12-byte) nonces (recommended for GCM)
- 128-bit (16-byte) authentication tags

**Internal Architecture:**
```
┌──────────────────┐      ┌──────────────────┐
│  Plaintext       │      │  Master Key      │
│  Secret Value    │      │  (256-bit)       │
└────────┬─────────┘      └────────┬─────────┘
         │                         │
         │                         │ Import as CryptoKey
         │                         ▼
         │                ┌─────────────────┐
         │                │  AES-GCM Key    │
         │                └────────┬────────┘
         │                         │
         └─────────┬───────────────┘
                   │
                   │ Generate random nonce (96-bit)
                   │
                   ▼
         ┌──────────────────────────┐
         │  crypto.subtle.encrypt() │
         │  - Algorithm: AES-GCM    │
         │  - Key: 256-bit          │
         │  - Nonce: 96-bit         │
         │  - Tag length: 128-bit   │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │  Ciphertext Output:      │
         │  [nonce || ciphertext || │
         │   authentication tag]    │
         └──────────────────────────┘
```

**Configuration:**
```typescript
interface AESGCMConfig {
  name: 'AES-GCM';
  iv: Uint8Array;          // 96-bit (12 bytes) nonce
  tagLength: 128;          // 128-bit authentication tag
}
```

**Example - Encryption:**
```typescript
// Generate random nonce (96-bit)
const nonce = crypto.getRandomValues(new Uint8Array(12));

// Import master key for AES-GCM
const aesKey = await crypto.subtle.importKey(
  'raw',
  masterKey,
  { name: 'AES-GCM' },
  false,
  ['encrypt', 'decrypt']
);

// Encrypt secret value
const plaintextBytes = new TextEncoder().encode(secretValue);

const ciphertext = await crypto.subtle.encrypt(
  {
    name: 'AES-GCM',
    iv: nonce,
    tagLength: 128
  },
  aesKey,
  plaintextBytes
);

// Combine nonce + ciphertext (includes tag)
const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
combined.set(nonce, 0);
combined.set(new Uint8Array(ciphertext), nonce.length);

// Encode as Base64 for storage
const encryptedValue = btoa(String.fromCharCode(...combined));
```

**Example - Decryption:**
```typescript
// Decode from Base64
const combined = Uint8Array.from(
  atob(encryptedValue),
  c => c.charCodeAt(0)
);

// Extract nonce (first 12 bytes) and ciphertext
const nonce = combined.slice(0, 12);
const ciphertext = combined.slice(12);

// Import master key for AES-GCM
const aesKey = await crypto.subtle.importKey(
  'raw',
  masterKey,
  { name: 'AES-GCM' },
  false,
  ['encrypt', 'decrypt']
);

// Decrypt
const plaintextBytes = await crypto.subtle.decrypt(
  {
    name: 'AES-GCM',
    iv: nonce,
    tagLength: 128
  },
  aesKey,
  ciphertext
);

const secretValue = new TextDecoder().decode(plaintextBytes);
```

---

### Component: Nonce/IV Generator

**Purpose:** Generate cryptographically secure random nonces (Initialization Vectors) for each encryption operation to ensure semantic security.

**Responsibilities:**
- Generate 96-bit (12-byte) random values
- Use cryptographically secure random number generator (CSPRNG)
- Ensure statistical uniqueness (birthday bound: 2^48 encryptions before 1% collision risk)
- Never reuse nonces with the same key

**Technology Stack:**
- Web Crypto API `crypto.getRandomValues()`
- Browser's underlying CSPRNG (platform-specific)

**Internal Architecture:**
```
┌──────────────────────────┐
│  crypto.getRandomValues()│
│  (Browser CSPRNG)        │
└──────────┬───────────────┘
           │
           │ Request 12 random bytes
           ▼
┌──────────────────────────┐
│  96-bit Nonce            │
│  (12 bytes)              │
└──────────────────────────┘
```

**Key Modules:**
- Nonce generator function (single-purpose utility)

**Configuration:**
```typescript
const NONCE_LENGTH_BYTES = 12; // 96 bits (recommended for AES-GCM)
```

**Example:**
```typescript
/**
 * Generates a cryptographically secure random nonce for AES-GCM
 * @returns {Uint8Array} 96-bit (12-byte) nonce
 */
function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES));
}

// Usage
const nonce = generateNonce();
console.log(nonce.length); // 12
console.log(nonce); // Uint8Array(12) [random bytes]
```

**Nonce Uniqueness Guarantee:**
- **Collision probability:** With 96-bit nonces, the probability of collision after N encryptions is approximately N²/2^97
- **Safe limit:** Can perform ~2^48 encryptions before collision probability reaches 1%
- **Practical limit:** Each secret can be updated millions of times safely
- **Rotation strategy:** If a single key encrypts >2^32 secrets, rotate the master key

---

### Component: Key Storage Manager

**Purpose:** Securely manage encryption keys in browser memory during user sessions, ensuring keys are never persisted unencrypted to disk and are cleared on logout.

**Responsibilities:**
- Store master key in memory during active session
- Provide access to key for encryption/decryption operations
- Automatically clear keys on logout or session timeout
- Re-derive keys from password on browser refresh
- Prevent key leakage to local storage or disk

**Technology Stack:**
- JavaScript in-memory storage (`WeakMap` or plain object)
- Session Storage (for encrypted key caching, optional)
- Web Crypto API `CryptoKey` objects (non-extractable when possible)

**Internal Architecture:**
```
┌─────────────────────────────────────┐
│   User Session (Browser Tab)        │
│                                      │
│  ┌─────────────────────────────┐   │
│  │  KeyStorageManager          │   │
│  │                              │   │
│  │  - masterKey: CryptoKey?    │   │
│  │  - derivedAt: timestamp     │   │
│  │  - expiresAt: timestamp     │   │
│  │                              │   │
│  │  Methods:                    │   │
│  │  - setKey(key)               │   │
│  │  - getKey(): CryptoKey?      │   │
│  │  - clearKey()                │   │
│  │  - isExpired(): boolean      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Key Modules:**
- `KeyStorageManager` class (singleton pattern)
- Automatic cleanup on `beforeunload` event
- Timeout-based expiration (optional)

**Configuration:**
```typescript
interface KeyStorageConfig {
  maxSessionDuration: number;  // Default: 3600000 (1 hour in ms)
  autoLock: boolean;           // Default: true (lock after inactivity)
  inactivityTimeout: number;   // Default: 900000 (15 minutes in ms)
}
```

**Example:**
```typescript
/**
 * Manages encryption keys in memory during user session
 */
class KeyStorageManager {
  private masterKey: CryptoKey | null = null;
  private derivedAt: number | null = null;
  private lastActivity: number | null = null;

  private config: KeyStorageConfig = {
    maxSessionDuration: 3600000,  // 1 hour
    autoLock: true,
    inactivityTimeout: 900000     // 15 minutes
  };

  constructor() {
    // Clear keys on page unload
    window.addEventListener('beforeunload', () => this.clearKey());

    // Check for inactivity
    if (this.config.autoLock) {
      setInterval(() => this.checkInactivity(), 60000); // Check every minute
    }
  }

  /**
   * Stores master key in memory
   */
  setKey(key: CryptoKey): void {
    this.masterKey = key;
    this.derivedAt = Date.now();
    this.lastActivity = Date.now();
  }

  /**
   * Retrieves master key if available and not expired
   */
  getKey(): CryptoKey | null {
    if (!this.masterKey) return null;

    if (this.isExpired()) {
      this.clearKey();
      return null;
    }

    this.lastActivity = Date.now();
    return this.masterKey;
  }

  /**
   * Clears master key from memory
   */
  clearKey(): void {
    this.masterKey = null;
    this.derivedAt = null;
    this.lastActivity = null;
  }

  /**
   * Checks if key has expired
   */
  private isExpired(): boolean {
    if (!this.derivedAt) return true;

    const now = Date.now();
    const age = now - this.derivedAt;

    // Check max session duration
    if (age > this.config.maxSessionDuration) {
      return true;
    }

    // Check inactivity timeout
    if (this.config.autoLock && this.lastActivity) {
      const inactivity = now - this.lastActivity;
      if (inactivity > this.config.inactivityTimeout) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks for inactivity and locks if needed
   */
  private checkInactivity(): void {
    if (this.isExpired()) {
      this.clearKey();
      // Optionally: dispatch event to trigger re-authentication UI
      window.dispatchEvent(new CustomEvent('abyrith:session-expired'));
    }
  }
}

// Singleton instance
export const keyStorage = new KeyStorageManager();
```

---

## Data Flow

### Flow 1: Secret Encryption (Create/Update)

**Trigger:** User creates or updates a secret in Abyrith

**Steps:**

1. **User Input:** User enters secret value in plaintext
   ```typescript
   const plaintext = "sk-1234567890abcdef"; // Example API key
   ```

2. **Retrieve Master Key:** Get master key from KeyStorageManager
   ```typescript
   const masterKey = keyStorage.getKey();
   if (!masterKey) {
     // Redirect to master password prompt
     throw new Error('Session expired');
   }
   ```

3. **Generate Nonce:** Create unique 96-bit nonce for this encryption
   ```typescript
   const nonce = crypto.getRandomValues(new Uint8Array(12));
   ```

4. **Encrypt Secret:** Use AES-256-GCM to encrypt plaintext
   ```typescript
   const aesKey = await crypto.subtle.importKey(
     'raw',
     masterKey,
     { name: 'AES-GCM' },
     false,
     ['encrypt']
   );

   const plaintextBytes = new TextEncoder().encode(plaintext);

   const ciphertext = await crypto.subtle.encrypt(
     {
       name: 'AES-GCM',
       iv: nonce,
       tagLength: 128
     },
     aesKey,
     plaintextBytes
   );
   ```

5. **Combine Nonce and Ciphertext:** Prepend nonce to ciphertext
   ```typescript
   const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
   combined.set(nonce, 0);
   combined.set(new Uint8Array(ciphertext), nonce.length);
   ```

6. **Encode for Transmission:** Convert to Base64
   ```typescript
   const encryptedValue = btoa(String.fromCharCode(...combined));
   ```

7. **Send to Server:** POST encrypted value to API
   ```typescript
   const response = await fetch('/api/secrets', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${jwtToken}`
     },
     body: JSON.stringify({
       name: 'OPENAI_API_KEY',
       encrypted_value: encryptedValue,
       project_id: 'uuid-here',
       environment: 'production'
     })
   });
   ```

8. **Server Storage:** Backend stores encrypted value in PostgreSQL
   - Server never sees plaintext
   - RLS policies enforce access control
   - Audit log records the creation event

**Sequence Diagram:**
```
User       Frontend    KeyStorage    WebCrypto      Backend      Database
 |            |            |             |             |             |
 |--input---->|            |             |             |             |
 |            |--getKey()->|             |             |             |
 |            |<--key------|             |             |             |
 |            |--genNonce()--->          |             |             |
 |            |<--nonce------>           |             |             |
 |            |--encrypt(plaintext, key, nonce)------->|             |
 |            |<--ciphertext-------------|             |             |
 |            |--POST /secrets (ciphertext)----------->|             |
 |            |                          |             |--INSERT---->|
 |            |<--201 Created--------------------------|             |
 |<--success--|                          |             |             |
```

**Data Transformations:**
- **Input:** Plaintext string (UTF-8)
- **After key retrieval:** Raw 256-bit master key
- **After nonce generation:** 96-bit random nonce
- **After encryption:** Raw ciphertext bytes + 128-bit auth tag
- **After combining:** [nonce || ciphertext || tag] as byte array
- **Before transmission:** Base64-encoded string
- **In database:** Base64 string stored in `encrypted_value` column

---

### Flow 2: Secret Decryption (Retrieve)

**Trigger:** User requests to view a secret value

**Steps:**

1. **Request Secret:** Frontend requests encrypted secret from API
   ```typescript
   const response = await fetch(`/api/secrets/${secretId}`, {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${jwtToken}`
     }
   });

   const data = await response.json();
   const encryptedValue = data.encrypted_value; // Base64 string
   ```

2. **Decode from Base64:** Convert to byte array
   ```typescript
   const combined = Uint8Array.from(
     atob(encryptedValue),
     c => c.charCodeAt(0)
   );
   ```

3. **Extract Nonce and Ciphertext:** Split combined data
   ```typescript
   const nonce = combined.slice(0, 12);          // First 12 bytes
   const ciphertext = combined.slice(12);        // Remaining bytes (includes tag)
   ```

4. **Retrieve Master Key:** Get key from KeyStorageManager
   ```typescript
   const masterKey = keyStorage.getKey();
   if (!masterKey) {
     // Redirect to master password re-entry
     throw new Error('Session expired - please re-enter master password');
   }
   ```

5. **Decrypt Secret:** Use AES-256-GCM to decrypt
   ```typescript
   const aesKey = await crypto.subtle.importKey(
     'raw',
     masterKey,
     { name: 'AES-GCM' },
     false,
     ['decrypt']
   );

   const plaintextBytes = await crypto.subtle.decrypt(
     {
       name: 'AES-GCM',
       iv: nonce,
       tagLength: 128
     },
     aesKey,
     ciphertext
   );
   ```

6. **Decode Plaintext:** Convert bytes to UTF-8 string
   ```typescript
   const plaintext = new TextDecoder().decode(plaintextBytes);
   ```

7. **Display to User:** Show decrypted secret value in UI
   - Use click-to-reveal pattern
   - Optionally auto-hide after timeout
   - Log access event (audit trail)

**Sequence Diagram:**
```
User       Frontend    KeyStorage    WebCrypto      Backend      Database
 |            |            |             |             |             |
 |--request-->|            |             |             |             |
 |            |--GET /secrets/:id---------------------->|             |
 |            |                          |             |--SELECT---->|
 |            |<--200 OK (encrypted)------------------<|             |
 |            |--decode(base64)          |             |             |
 |            |--getKey()->|             |             |             |
 |            |<--key------|             |             |             |
 |            |--decrypt(ciphertext, key, nonce)------>|             |
 |            |<--plaintext-------------|             |             |
 |<--display--|                          |             |             |
```

**Data Transformations:**
- **From database:** Base64-encoded string
- **After Base64 decode:** Byte array [nonce || ciphertext || tag]
- **After split:** Separate nonce (12 bytes) and ciphertext (variable)
- **After decryption:** Raw plaintext bytes
- **Final output:** UTF-8 string

---

### Flow 3: Master Password Setup (First-Time)

**Trigger:** New user creates an account and sets up encryption

**Steps:**

1. **User Creates Account:** User signs up with email/OAuth
   ```typescript
   // Supabase Auth handles this
   const { user, error } = await supabase.auth.signUp({
     email: 'user@example.com',
     password: 'account_password' // Note: Different from master password!
   });
   ```

2. **Prompt for Master Password:** UI prompts for separate master password
   ```typescript
   // UI shows modal: "Create a master password to encrypt your secrets"
   const masterPassword = prompt('Create master password (min 16 chars):');
   const confirmPassword = prompt('Confirm master password:');

   if (masterPassword !== confirmPassword) {
     throw new Error('Passwords do not match');
   }

   // Validate password strength
   if (masterPassword.length < 16) {
     throw new Error('Master password must be at least 16 characters');
   }
   ```

3. **Generate Salt:** Create random 128-bit salt for PBKDF2
   ```typescript
   const salt = crypto.getRandomValues(new Uint8Array(16));
   ```

4. **Derive Master Key:** Use PBKDF2 to derive key from password
   ```typescript
   const keyMaterial = await crypto.subtle.importKey(
     'raw',
     new TextEncoder().encode(masterPassword),
     'PBKDF2',
     false,
     ['deriveBits']
   );

   const derivedBits = await crypto.subtle.deriveBits(
     {
       name: 'PBKDF2',
       hash: 'SHA-256',
       salt: salt,
       iterations: 600000
     },
     keyMaterial,
     256 // 256 bits = 32 bytes
   );

   const masterKey = new Uint8Array(derivedBits);
   ```

5. **Store Salt in Database:** Save salt (NOT the key!) for future derivations
   ```typescript
   // Salt is NOT secret - can be stored in plaintext
   const saltBase64 = btoa(String.fromCharCode(...salt));

   await fetch('/api/users/encryption-setup', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${jwtToken}`
     },
     body: JSON.stringify({
       salt: saltBase64,
       pbkdf2_iterations: 600000
     })
   });
   ```

6. **Store Master Key in Memory:** Save key for current session
   ```typescript
   const cryptoKey = await crypto.subtle.importKey(
     'raw',
     masterKey,
     { name: 'AES-GCM' },
     false,
     ['encrypt', 'decrypt']
   );

   keyStorage.setKey(cryptoKey);
   ```

7. **Generate Recovery Key (Optional):** Create recovery mechanism
   ```typescript
   // Generate recovery key (random 32-byte key)
   const recoveryKey = crypto.getRandomValues(new Uint8Array(32));
   const recoveryKeyBase64 = btoa(String.fromCharCode(...recoveryKey));

   // Display recovery key to user (print/download)
   console.log('Save this recovery key:', recoveryKeyBase64);

   // Encrypt master key with recovery key and store
   // (Implementation details in password-reset.md)
   ```

**Important Notes:**
- Master password is NEVER sent to server
- Salt is stored in database (not secret)
- Master key is derived client-side and stored in memory only
- Recovery key allows password reset without losing encrypted data

---

## API Contracts

### Internal APIs

**API: Encryption Service**

**Purpose:** Provides encryption and decryption functions for secrets

**TypeScript Interface:**
```typescript
interface EncryptionService {
  /**
   * Derives master key from user's master password
   * @param password Master password (never transmitted)
   * @param salt User's salt (retrieved from database)
   * @returns CryptoKey for encryption/decryption
   */
  deriveMasterKey(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey>;

  /**
   * Encrypts a plaintext secret value
   * @param plaintext Secret value to encrypt
   * @param key Master key (from deriveMasterKey)
   * @returns Base64-encoded ciphertext (includes nonce and tag)
   */
  encryptSecret(
    plaintext: string,
    key: CryptoKey
  ): Promise<string>;

  /**
   * Decrypts an encrypted secret value
   * @param ciphertext Base64-encoded encrypted value
   * @param key Master key (from deriveMasterKey)
   * @returns Decrypted plaintext secret value
   */
  decryptSecret(
    ciphertext: string,
    key: CryptoKey
  ): Promise<string>;

  /**
   * Generates a cryptographically secure random nonce
   * @returns 96-bit (12-byte) nonce
   */
  generateNonce(): Uint8Array;
}
```

**Example Request (encryptSecret):**
```typescript
const service = new EncryptionService();

// Derive key
const masterKey = await service.deriveMasterKey(
  'user-master-password',
  saltFromDatabase
);

// Encrypt secret
const encryptedValue = await service.encryptSecret(
  'sk-1234567890abcdef', // OpenAI API key
  masterKey
);

console.log(encryptedValue);
// Output: "DFj8k3hs9dKLm2n4p6q8r0sT1uV3wX5yZ7a9bC1dE3fG4hI6jK8..." (Base64)
```

**Example Response (decryptSecret):**
```typescript
const plaintext = await service.decryptSecret(
  'DFj8k3hs9dKLm2n4p6q8r0sT1uV3wX5yZ7a9bC1dE3fG4hI6jK8...',
  masterKey
);

console.log(plaintext);
// Output: "sk-1234567890abcdef"
```

**Error Handling:**
- `DecryptionError` - Authentication tag mismatch (tampering detected)
- `InvalidKeyError` - Wrong master password used
- `InvalidFormatError` - Ciphertext format incorrect
- `BrowserNotSupportedError` - Web Crypto API not available

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Browser ↔ Server**
- **Threats:**
  - Man-in-the-middle (MITM) attacks
  - Server compromise
  - Malicious backend engineer
- **Controls:**
  - All data encrypted client-side before transmission
  - TLS 1.3 for transport security
  - Server never receives master password or keys
  - Encrypted values use authenticated encryption (GCM)

**Boundary 2: User's Device ↔ Browser Memory**
- **Threats:**
  - Malicious browser extensions
  - XSS attacks
  - Memory dumps
- **Controls:**
  - Content Security Policy (CSP) headers
  - Keys stored in memory only (not localStorage)
  - Automatic key clearing on logout
  - Non-extractable CryptoKey objects

**Boundary 3: User's Mind ↔ Application**
- **Threats:**
  - Weak master passwords
  - Password reuse
  - Phishing attacks
- **Controls:**
  - Minimum password length enforcement (16 characters)
  - Password strength meter
  - User education about master password importance
  - Optional 2FA on account (separate from encryption)

### Authentication & Authorization

**Authentication:**
- User authentication handled by Supabase Auth (JWT tokens)
- Master password authentication is local (proves user knows password to derive key)
- No server-side verification of master password possible (zero-knowledge)

**Authorization:**
- RLS policies enforce who can access encrypted secrets
- Server authorizes read/write access but cannot decrypt
- MCP requests include additional approval layer

### Data Security

**Data at Rest:**
- Encryption: AES-256-GCM (client-side before storage)
- Key management: Keys never stored, only derived from password
- Access controls: PostgreSQL RLS policies

**Data in Transit:**
- Encryption: TLS 1.3 (HTTPS)
- Certificate management: Cloudflare-managed certificates
- Only encrypted ciphertext transmitted

**Data in Use:**
- Processing: Keys held in browser memory during session
- Temporary storage: Keys in JavaScript variables (not persisted)
- Memory security: Automatic clearing on logout

### Threat Model

**Threat 1: Server Compromise**
- **Description:** Attacker gains full access to Abyrith servers and database
- **Likelihood:** Low (Cloudflare + Supabase security)
- **Impact:** High (all encrypted secrets exposed)
- **Mitigation:**
  - Zero-knowledge architecture ensures attacker only gets ciphertext
  - Without user's master password, secrets remain encrypted
  - Brute-force attacks infeasible (600,000 PBKDF2 iterations)

**Threat 2: XSS Attack**
- **Description:** Attacker injects malicious JavaScript to steal keys from memory
- **Likelihood:** Medium (common web vulnerability)
- **Impact:** Critical (keys in memory during session)
- **Mitigation:**
  - Strict Content Security Policy (CSP)
  - React's built-in XSS protection
  - Input sanitization
  - Regular security audits

**Threat 3: Weak Master Password**
- **Description:** User chooses easily guessable password
- **Likelihood:** High (user behavior)
- **Impact:** High (enables brute-force attacks)
- **Mitigation:**
  - Enforce minimum 16 character length
  - Password strength meter
  - Recommend passphrase generation
  - 600,000 PBKDF2 iterations slows brute-force

**Threat 4: Malicious Browser Extension**
- **Description:** Browser extension with access to page memory steals keys
- **Likelihood:** Medium
- **Impact:** High (keys exposed during session)
- **Mitigation:**
  - User education (be careful with extensions)
  - Non-extractable CryptoKey objects (limits exposure)
  - Session timeout (limits exposure window)

**Threat 5: Database SQL Injection**
- **Description:** SQL injection attack to extract encrypted secrets
- **Likelihood:** Low (Supabase uses PostgREST with parameterized queries)
- **Impact:** Medium (only ciphertext exposed)
- **Mitigation:**
  - PostgREST prevents SQL injection
  - RLS policies limit row access
  - Even if attacker gets ciphertext, cannot decrypt

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- **PBKDF2 key derivation:** < 2000ms (p95) - acceptable for login
- **Secret encryption:** < 100ms (p95)
- **Secret decryption:** < 50ms (p95)
- **Nonce generation:** < 1ms (p99)

**Throughput:**
- **Batch encryption:** 50+ secrets per second
- **Batch decryption:** 100+ secrets per second

**Resource Usage:**
- **Memory:** < 5MB for key storage and crypto operations
- **CPU:** Minimal (hardware-accelerated AES when available)

### Performance Optimization

**Optimizations implemented:**
- **Hardware acceleration:** Web Crypto API uses native crypto when available
- **Key caching:** Master key derived once per session, cached in memory
- **Parallel operations:** Encrypt/decrypt multiple secrets concurrently
- **Worker threads:** Optional offloading to Web Workers for batch operations

**PBKDF2 Iteration Tuning:**
- **Current:** 600,000 iterations (OWASP recommendation 2023)
- **Performance:** ~1-2 seconds on modern devices
- **Trade-off:** Security vs. UX (acceptable delay during login)
- **Future:** Increase iterations as hardware improves (stored in database per user)

**AES-GCM Performance:**
- **Typical secret size:** 100-500 bytes
- **Encryption time:** 5-20ms for typical secret
- **Decryption time:** 2-10ms for typical secret
- **Large secrets (>10KB):** Still <100ms due to hardware acceleration

### Browser Compatibility

**Supported Browsers:**
- Chrome 100+ (Web Crypto API fully supported)
- Firefox 100+ (Web Crypto API fully supported)
- Safari 15+ (Web Crypto API fully supported)
- Edge 100+ (Chromium-based, same as Chrome)

**Feature Detection:**
```typescript
function isWebCryptoSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.encrypt === 'function' &&
    typeof window.crypto.subtle.decrypt === 'function' &&
    typeof window.crypto.subtle.deriveBits === 'function'
  );
}

if (!isWebCryptoSupported()) {
  // Show error: Browser not supported
  throw new Error('Web Crypto API not available. Please use a modern browser.');
}
```

**Graceful Degradation:**
- No fallback possible - encryption is mandatory
- Unsupported browsers show error message
- Recommend Chrome/Firefox/Safari/Edge

---

## Scalability

### Horizontal Scaling

**Components that scale horizontally:**
- All encryption/decryption happens client-side (scales with users automatically)
- Server-side: Stateless API (Cloudflare Workers scales automatically)

**Load balancing:**
- Not applicable - client-side operations

### Vertical Scaling

**Components that scale vertically:**
- User's device performance determines encryption speed
- Server database storage scales with secret count

### Bottlenecks

**Current bottlenecks:**
- **PBKDF2 key derivation:** CPU-intensive, blocks UI thread
  - Mitigation: Run in Web Worker
  - Impact: 1-2 seconds per login (acceptable)

- **Browser memory limits:** Theoretical limit on concurrent keys
  - Mitigation: Single key per session (low memory usage)
  - Impact: Negligible for typical use

**No bottlenecks expected at scale:**
- Client-side encryption scales naturally
- Each user's device does their own crypto work

### Capacity Planning

**Current capacity:**
- **Per user:** Unlimited secrets (client-side encryption)
- **Per session:** 1 master key in memory (~32 bytes)

**Growth projections:**
- No infrastructure scaling needed for encryption
- Database storage is the only growth concern (handled by Supabase)

---

## Failure Modes

### Failure Mode 1: User Forgets Master Password

**Scenario:** User cannot remember their master password

**Impact:** Cannot decrypt any secrets (zero-knowledge design)

**Detection:** Failed decryption attempts, authentication tag mismatches

**Recovery:**
1. Prompt user for master password
2. If recovery key was saved, use recovery key to decrypt secrets
3. If no recovery key, secrets are permanently lost
4. User must re-enter all secrets

**Prevention:**
- Emphasize importance of master password during setup
- Offer recovery key option
- Warn users before encryption setup

---

### Failure Mode 2: Corrupted Encrypted Data

**Scenario:** Database corruption or transmission error corrupts ciphertext

**Impact:** Specific secret(s) cannot be decrypted

**Detection:** GCM authentication tag verification fails

**Recovery:**
1. Detect authentication tag mismatch
2. Show error: "This secret has been corrupted and cannot be decrypted"
3. User must re-enter secret value
4. Log corruption event for investigation

**Prevention:**
- Database integrity checks
- Backup and point-in-time recovery
- GCM authentication tag detects tampering

---

### Failure Mode 3: Browser Crashes During Encryption

**Scenario:** Browser crashes while encrypting a secret

**Impact:** User loses current work, secret not saved

**Detection:** User reports lost data

**Recovery:**
1. User re-enters secret
2. No data corruption (transaction incomplete)

**Prevention:**
- Auto-save draft (metadata only, not plaintext)
- Show "Encrypting..." status during operation

---

### Failure Mode 4: Nonce Collision (Extremely Unlikely)

**Scenario:** Same nonce used twice with same key (statistical improbability)

**Impact:** Security vulnerability (GCM security compromised)

**Detection:** Statistical analysis (monitoring nonce reuse)

**Recovery:**
1. Rotate master key immediately
2. Re-encrypt all secrets with new key
3. Revoke all potentially compromised secrets

**Prevention:**
- 96-bit nonces provide 2^48 encryptions before 1% collision risk
- Enforce key rotation policy (e.g., every 100 million encryptions)
- Monitor encryption counters

---

### Disaster Recovery

**Recovery Time Objective (RTO):** Immediate (client-side operations)

**Recovery Point Objective (RPO):** Last successful secret save

**Backup Strategy:**
- Database backups (Supabase handles this)
- User's master password is not backed up (user's responsibility)
- Salt is backed up with database

**Recovery Procedure:**
1. Restore database from backup
2. User logs in with master password
3. Master key re-derived from password + salt
4. All secrets accessible again

---

## Alternatives Considered

### Alternative 1: Server-Side Encryption

**Description:** Encrypt secrets server-side with keys managed by Abyrith

**Pros:**
- Easier password recovery (server has keys)
- Faster key rotation
- No browser dependency

**Cons:**
- Not zero-knowledge (server can decrypt secrets)
- Requires trusting Abyrith
- Single point of failure (server compromise = all secrets exposed)
- Doesn't meet compliance requirements (SOC 2, ISO 27001)

**Why not chosen:** Violates zero-knowledge architecture principle, which is core to Abyrith's value proposition

---

### Alternative 2: RSA Public-Key Encryption

**Description:** Use RSA for asymmetric encryption instead of AES

**Pros:**
- Enables sharing secrets without sharing master password
- Key rotation easier (rotate key pair)

**Cons:**
- Slower than AES (10-100x)
- More complex key management
- Larger ciphertext size
- Requires key escrow or complex recovery mechanisms

**Why not chosen:** AES-256-GCM provides better performance and simpler implementation. For sharing, we can use envelope encryption (future feature).

---

### Alternative 3: Argon2 Instead of PBKDF2

**Description:** Use Argon2 for key derivation instead of PBKDF2

**Pros:**
- More resistant to GPU/ASIC attacks
- Memory-hard (increases cost of brute-force)
- Winner of Password Hashing Competition (2015)

**Cons:**
- Not natively supported by Web Crypto API
- Requires JavaScript library (additional dependency)
- Slower on low-memory devices
- Less widely deployed and audited

**Why not chosen:** PBKDF2 with 600,000 iterations is sufficient for our threat model, avoids JavaScript crypto dependencies, and is native to Web Crypto API.

---

### Alternative 4: ChaCha20-Poly1305 Instead of AES-GCM

**Description:** Use ChaCha20-Poly1305 for authenticated encryption

**Pros:**
- Better performance on devices without AES hardware acceleration
- More modern design (2014 vs. 2001)
- Used by WireGuard, TLS 1.3

**Cons:**
- Not supported by Web Crypto API (requires library)
- AES hardware acceleration is nearly universal now
- Larger ciphertext size

**Why not chosen:** AES-256-GCM is natively supported by Web Crypto API and provides hardware acceleration on most devices. No benefit to using library-based ChaCha20-Poly1305.

---

## Decision Log

### Decision 1: AES-256-GCM for Symmetric Encryption

**Date:** 2025-10-29

**Context:** Need to choose symmetric encryption algorithm for zero-knowledge secret storage

**Options:**
1. AES-256-GCM - Web Crypto native, authenticated encryption, hardware accelerated
2. AES-256-CBC + HMAC - Encrypt-then-MAC pattern, older but well-understood
3. ChaCha20-Poly1305 - Modern, fast on software, requires library

**Decision:** AES-256-GCM

**Rationale:**
- Native Web Crypto API support (no dependencies)
- Hardware acceleration on modern CPUs (AES-NI)
- Authenticated encryption (integrity + confidentiality in one operation)
- Recommended by NIST, used widely in TLS 1.3
- GCM mode is performant and secure

**Consequences:**
- All secrets use AES-256-GCM format
- Must use unique nonces (96-bit recommended)
- Authentication tags detect tampering automatically
- Future algorithm migration would require re-encryption

---

### Decision 2: PBKDF2 with 600,000 Iterations

**Date:** 2025-10-29

**Context:** Need to derive encryption key from user's master password

**Options:**
1. PBKDF2 (600,000 iterations) - Native Web Crypto, OWASP recommendation
2. Argon2 - Memory-hard, more secure, requires library
3. bcrypt - Popular for passwords, not designed for key derivation

**Decision:** PBKDF2 with 600,000 iterations (SHA-256)

**Rationale:**
- Native Web Crypto API support (no JavaScript crypto dependencies)
- OWASP recommends 600,000 iterations for PBKDF2-SHA256 (2023)
- Sufficient protection against brute-force attacks (~1-2 seconds on modern hardware)
- Store iteration count in database to increase over time as hardware improves
- Widely deployed and audited

**Consequences:**
- Login takes 1-2 seconds (acceptable UX trade-off)
- Iteration count can be increased per-user without breaking existing users
- Future migration to Argon2 possible when Web Crypto API adds support

---

### Decision 3: 96-bit Nonces for AES-GCM

**Date:** 2025-10-29

**Context:** Must choose nonce size for AES-GCM encryption

**Options:**
1. 96-bit (12 bytes) - Recommended for GCM, efficient
2. 128-bit (16 bytes) - Longer, more collision-resistant
3. 64-bit (8 bytes) - Shorter, lower overhead

**Decision:** 96-bit (12 bytes)

**Rationale:**
- NIST recommends 96-bit nonces for AES-GCM
- Efficient for GCM (no additional internal processing)
- 2^48 encryptions before 1% collision probability (sufficient for our use case)
- Standard across most GCM implementations

**Consequences:**
- Nonce stored with ciphertext (adds 12 bytes overhead)
- Must monitor encryption count per key (rotate before 2^32)
- Collision risk acceptably low for expected usage

---

### Decision 4: Base64 Encoding for Ciphertext

**Date:** 2025-10-29

**Context:** Need text-safe format for storing binary ciphertext in database

**Options:**
1. Base64 - Standard, ~33% overhead
2. Hex - Simple, 100% overhead
3. Raw binary (BYTEA) - No overhead, harder to debug

**Decision:** Base64

**Rationale:**
- Industry standard for encoding binary in JSON/text contexts
- ~33% overhead (acceptable trade-off)
- Easy to copy/paste for debugging
- PostgreSQL handles TEXT efficiently
- Compatible with APIs and export formats

**Consequences:**
- Ciphertext size increases by ~33%
- Easy to debug and inspect in logs
- Standard format enables easy migration

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `GLOSSARY.md` - Terminology definitions (AES-GCM, PBKDF2, nonce, etc.)
- [ ] `03-security/security-model.md` - Overall security architecture and zero-knowledge principles (currently being created in parallel)
- [x] `TECH-STACK.md` - Web Crypto API specifications

**Browser APIs Required:**
- Web Crypto API (`crypto.subtle.*`)
- TextEncoder/TextDecoder (UTF-8 conversion)
- Browser CSPRNG (`crypto.getRandomValues()`)

### Architecture Dependencies

**Depends on these components:**
- Frontend: React components for master password input
- Backend: User salt storage in database
- Database: `user_encryption_settings` table (salt, iteration count)

**Required by these components:**
- All secret storage operations (`08-features/zero-knowledge-encryption.md`)
- MCP secret access (`09-integrations/mcp/secrets-server-spec.md`)
- Secret sharing features (future)

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge architecture overview
- `03-security/zero-knowledge-architecture.md` - Trust boundaries and server limitations
- `03-security/threat-model.md` - Security threat analysis
- `04-database/schemas/secrets-metadata.md` - Database schema for encrypted secrets
- `07-frontend/client-encryption/webcrypto-implementation.md` - Frontend implementation guide
- `TECH-STACK.md` - Technology stack and Web Crypto API specifications
- `GLOSSARY.md` - Cryptography term definitions

### External Resources
- [Web Crypto API Specification](https://www.w3.org/TR/WebCryptoAPI/) - W3C standard
- [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) - GCM mode specification
- [NIST SP 800-132](https://csrc.nist.gov/publications/detail/sp/800-132/final) - PBKDF2 recommendations
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - PBKDF2 iteration recommendations
- [RFC 5869](https://tools.ietf.org/html/rfc5869) - HKDF (future key derivation)
- [Mozilla Web Crypto API Examples](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) - Code examples

### Security Standards
- [FIPS 197](https://csrc.nist.gov/publications/detail/fips/197/final) - AES specification
- [FIPS 198-1](https://csrc.nist.gov/publications/detail/fips/198/1/final) - HMAC specification
- [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) - SHA-256 specification

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Security Lead | Initial encryption specification using Architecture Document Template |

---

## Notes

### Future Enhancements
- **Argon2 migration:** When Web Crypto API adds Argon2 support, migrate from PBKDF2
- **Key rotation:** Implement automatic key rotation after N encryptions
- **Hardware security keys:** Support for FIDO2 keys as second factor
- **Post-quantum cryptography:** Monitor NIST PQC standards for future hybrid encryption
- **Web Workers:** Offload PBKDF2 key derivation to Web Worker to avoid blocking UI

### Known Issues
- **PBKDF2 blocks UI thread:** 1-2 second freeze during login (mitigate with Web Worker)
- **No password recovery:** By design (zero-knowledge), but UX concern for users
- **Browser dependency:** Unsupported browsers cannot use Abyrith (acceptable trade-off)

### Performance Testing Plan
1. Benchmark PBKDF2 key derivation on target devices (mobile, desktop, low-end)
2. Measure AES-GCM encryption/decryption latency for various secret sizes
3. Test batch encryption performance (100+ secrets)
4. Profile memory usage during extended sessions
5. Test on slowest supported browser (Safari 15)

### Security Audit Checklist
- [ ] External cryptography audit by reputable firm
- [ ] Verify PBKDF2 iteration count matches OWASP recommendations
- [ ] Confirm nonces are never reused
- [ ] Test GCM authentication tag verification
- [ ] Verify master key is never transmitted to server
- [ ] Confirm keys are cleared from memory on logout
- [ ] Test Web Crypto API feature detection
- [ ] Verify CSP headers prevent key exfiltration

### Next Review Date
**2026-01-29** (Quarterly review, or sooner if security vulnerabilities discovered)

---

**Security Note:** This specification has been drafted but requires external security review before implementation. Do not proceed with implementation until cryptographic design is audited by a qualified security professional.
