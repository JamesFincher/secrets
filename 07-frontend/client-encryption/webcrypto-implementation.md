---
Document: Web Crypto API Implementation - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: TECH-STACK.md, 03-security/encryption-specification.md, 03-security/security-model.md, 07-frontend/frontend-architecture.md
---

# Web Crypto API Implementation Architecture

## Overview

This document defines the client-side encryption implementation for Abyrith using the Web Crypto API. All secrets are encrypted client-side with AES-256-GCM before transmission to the server, and the master encryption key is derived from the user's master password using PBKDF2 with 600,000 iterations. This implementation ensures zero-knowledge architecture where the server never has access to unencrypted secrets or the master password.

**Purpose:** Provide a comprehensive guide to the client-side encryption implementation, covering key derivation, encryption/decryption workflows, secure key storage, and integration with the frontend architecture.

**Scope:** This document covers the Web Crypto API usage, key lifecycle management, encryption/decryption functions, IndexedDB key storage, integration with React Query and components, and error handling for cryptographic operations.

**Status:** Draft - Implementation pending

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
Abyrith requires zero-knowledge encryption where secrets are encrypted client-side before leaving the user's browser, the server never has access to the master password or unencrypted secrets, and encryption keys must be managed securely in the browser without persistent plaintext storage.

**Pain points:**
- Cryptographic operations are complex and error-prone
- Master password must never be transmitted to the server
- Derived encryption key must be stored securely (not in localStorage plaintext)
- Browser-based encryption must meet enterprise security standards (AES-256-GCM, PBKDF2 600k iterations)
- Key lifecycle management (unlock, lock, session persistence) is complex
- Poor crypto implementation could compromise zero-knowledge guarantee

**Why now?**
Client-side encryption is foundational to Abyrith's security model. All features depend on this implementation working correctly, and getting it right from the start prevents security vulnerabilities.

### Background

**Existing system:**
This is a greenfield implementation. No existing encryption layer.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Security Lead | Zero-knowledge guarantees, compliance | Key leakage, weak crypto, implementation flaws |
| Frontend Team | Simple, reliable encryption API | Complexity, performance, debugging crypto issues |
| Product Team | Seamless user experience | Master password UX, unlock flow, key recovery |
| End Users | Security and privacy | Trust in encryption, fear of losing access |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Zero-knowledge encryption** - Master password and unencrypted secrets never leave browser (success metric: 0 plaintext secrets or master passwords transmitted)
2. **Industry-standard cryptography** - Use AES-256-GCM, PBKDF2 with 600k iterations (success metric: Pass security audit, compliance with OWASP 2023 recommendations)
3. **Secure key storage** - Master key stored in memory, encrypted backup in IndexedDB (success metric: 0 plaintext keys persisted)
4. **Excellent DX** - Simple API for encryption/decryption (success metric: < 5 lines of code to encrypt/decrypt)

**Secondary goals:**
- Auto-lock after inactivity (clear master key from memory)
- Session persistence (encrypted key backup for page refresh)
- Performance optimization (parallel encryption/decryption)

### Non-Goals

**Explicitly out of scope:**
- **Hardware key support (WebAuthn)** - Post-MVP, software-based encryption only
- **Biometric unlock** - Post-MVP, master password only
- **Multi-device key sync** - Post-MVP, each device derives its own key
- **Quantum-resistant cryptography** - Future consideration, AES-256 sufficient for MVP

### Success Metrics

**How we measure success:**
- **Zero-Knowledge Compliance**: 0 master passwords or plaintext secrets transmitted to server
- **Cryptographic Strength**: Pass penetration testing and security audit
- **Performance**: PBKDF2 key derivation < 5s on average device, AES-256-GCM encryption < 10ms per secret
- **Reliability**: 0 critical encryption/decryption bugs in production

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                       │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         User Enters Master Password                    │ │
│  │         (never transmitted to server)                  │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Key Derivation (PBKDF2)                        │ │
│  │  • Input: Master Password + User Salt (User ID)        │ │
│  │  • Algorithm: PBKDF2-SHA256                            │ │
│  │  • Iterations: 600,000 (OWASP 2023)                    │ │
│  │  • Output: Master Key (AES-256-GCM CryptoKey)          │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Master Key Storage                             │ │
│  │  • Memory: CryptoKey object (primary storage)          │ │
│  │  • IndexedDB: Encrypted backup (session-derived key)   │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                             │
│               ├─────────────────────────┐                   │
│               │                         │                   │
│               ▼                         ▼                   │
│  ┌──────────────────────┐   ┌──────────────────────┐      │
│  │  Encryption          │   │  Decryption          │      │
│  │  (AES-256-GCM)       │   │  (AES-256-GCM)       │      │
│  │                      │   │                      │      │
│  │  Input: Plaintext    │   │  Input: Ciphertext   │      │
│  │  Output: Encrypted   │   │  Output: Plaintext   │      │
│  │    (Base64 string)   │   │    (UTF-8 string)    │      │
│  └──────────┬───────────┘   └──────────┬───────────┘      │
│             │                           │                   │
│             ▼                           ▼                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         API Client Layer                               │ │
│  │  • Encrypted data transmitted to server                │ │
│  │  • Server stores encrypted secrets (cannot decrypt)    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Key Derivation (`lib/crypto/keyDerivation.ts`)**
- **Purpose:** Derive AES-256-GCM key from master password using PBKDF2
- **Technology:** Web Crypto API (`crypto.subtle.deriveKey`)
- **Responsibilities:**
  - Derive master key from master password + salt
  - Use PBKDF2 with 600,000 iterations
  - Return CryptoKey object for AES-256-GCM

**Component 2: Encryption/Decryption (`lib/crypto/encryption.ts`)**
- **Purpose:** Encrypt/decrypt data using AES-256-GCM
- **Technology:** Web Crypto API (`crypto.subtle.encrypt`, `crypto.subtle.decrypt`)
- **Responsibilities:**
  - Encrypt plaintext to Base64 ciphertext
  - Decrypt Base64 ciphertext to plaintext
  - Generate random IVs for each encryption
  - Prepend IV to ciphertext

**Component 3: Key Storage (`lib/crypto/keyStorage.ts`)**
- **Purpose:** Store master key securely in memory and IndexedDB
- **Technology:** JavaScript variable (memory) + IndexedDB (encrypted backup)
- **Responsibilities:**
  - Keep master key in memory (CryptoKey object)
  - Encrypt and store backup in IndexedDB
  - Lock/unlock key lifecycle
  - Clear key on logout

**Component 4: IndexedDB Helper (`lib/crypto/indexedDB.ts`)**
- **Purpose:** Low-level IndexedDB operations for key storage
- **Technology:** IndexedDB API
- **Responsibilities:**
  - Initialize IndexedDB database
  - Store/retrieve encrypted key
  - Delete key on logout

**Component 5: Master Password Prompt (`components/auth/MasterPasswordPrompt.tsx`)**
- **Purpose:** UI component for master password input
- **Technology:** React, shadcn/ui
- **Responsibilities:**
  - Prompt user for master password
  - Trigger key derivation
  - Show loading state during PBKDF2
  - Handle unlock errors

### Component Interactions

**Key Derivation ↔ Web Crypto API:**
- Protocol: `crypto.subtle.deriveKey()` function call
- Data format: Master password (string) → CryptoKey (AES-256-GCM)
- Salt: User ID (ensures different users with same password have different keys)

**Encryption ↔ Web Crypto API:**
- Protocol: `crypto.subtle.encrypt()` function call
- Data format: Plaintext (UTF-8 string) → Ciphertext (ArrayBuffer) → Base64 string
- IV prepended to ciphertext

**Key Storage ↔ IndexedDB:**
- Protocol: IndexedDB API (`indexedDB.open`, `objectStore.put`)
- Data format: Encrypted master key (Base64 string)
- Encryption: Master key encrypted with session-derived key

**React Components ↔ Encryption Functions:**
- Protocol: Async function calls
- Data format: `await encrypt(plaintext, masterKey)` → ciphertext (Base64)
- Integration: Used in React Query hooks for secrets

---

## Component Details

### Component: Key Derivation

**Purpose:** Derive master encryption key from user's master password.

**File:** `lib/crypto/keyDerivation.ts`

**Implementation:**

```typescript
/**
 * Derive master encryption key from master password using PBKDF2
 *
 * SECURITY:
 * - Master password never transmitted to server
 * - User ID used as salt (unique per user)
 * - 600,000 iterations (OWASP 2023 recommendation)
 * - Output: AES-256-GCM key (256-bit)
 *
 * PERFORMANCE:
 * - Takes 3-5 seconds on average device (intentionally slow)
 * - Show loading indicator to user
 *
 * @param masterPassword - User's master password (never transmitted)
 * @param userSalt - Salt for key derivation (typically user ID)
 * @returns CryptoKey for AES-256-GCM encryption
 */
export async function deriveMasterKey(
  masterPassword: string,
  userSalt: string
): Promise<CryptoKey> {
  // Validate inputs
  if (!masterPassword || masterPassword.length < 8) {
    throw new Error('Master password must be at least 8 characters');
  }

  if (!userSalt) {
    throw new Error('User salt is required');
  }

  // Convert master password to key material
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(masterPassword);

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false, // Not extractable
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-256-GCM key using PBKDF2
  const masterKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(userSalt), // User ID as salt
      iterations: 600000, // OWASP 2023 recommendation
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256, // 256-bit key
    },
    true, // Extractable (for storage in IndexedDB)
    ['encrypt', 'decrypt']
  );

  // Clear password from memory (best effort)
  passwordBytes.fill(0);

  return masterKey;
}

/**
 * Verify master password by attempting to decrypt a test secret
 *
 * @param masterPassword - Password to verify
 * @param userSalt - User ID
 * @param testCiphertext - Encrypted test secret from server
 * @returns True if password is correct, false otherwise
 */
export async function verifyMasterPassword(
  masterPassword: string,
  userSalt: string,
  testCiphertext: string
): Promise<boolean> {
  try {
    const masterKey = await deriveMasterKey(masterPassword, userSalt);
    const { decrypt } = await import('./encryption');
    await decrypt(testCiphertext, masterKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive storage key from session token (for encrypting master key in IndexedDB)
 *
 * @param sessionToken - JWT session token
 * @returns CryptoKey for encrypting master key
 */
export async function deriveStorageKey(
  sessionToken: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(sessionToken);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    tokenBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const storageKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('abyrith-storage-key'), // Static salt
      iterations: 100000, // Fewer iterations (less sensitive)
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );

  tokenBytes.fill(0);

  return storageKey;
}
```

**PBKDF2 Configuration Rationale:**
- **600,000 iterations:** OWASP 2023 recommendation for password-based key derivation
- **SHA-256:** Widely supported, strong hash function
- **User ID as salt:** Ensures different users with same password have different keys
- **Not extractable key material:** Prevents password from being extracted

---

### Component: Encryption/Decryption

**Purpose:** Encrypt and decrypt data using AES-256-GCM.

**File:** `lib/crypto/encryption.ts`

**Implementation:**

```typescript
/**
 * Encrypt plaintext using AES-256-GCM
 *
 * FORMAT:
 * [12-byte IV][Ciphertext + Auth Tag]
 * Base64-encoded
 *
 * SECURITY:
 * - AES-256-GCM (authenticated encryption)
 * - Random IV for each encryption
 * - Auth tag prevents tampering
 *
 * @param plaintext - Data to encrypt (UTF-8 string)
 * @param key - CryptoKey (AES-256-GCM)
 * @returns Base64-encoded encrypted data with IV prepended
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  // Validate inputs
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  if (!key || key.type !== 'secret' || key.algorithm.name !== 'AES-GCM') {
    throw new Error('Invalid encryption key');
  }

  // Convert plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Generate random IV (12 bytes for GCM mode)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  try {
    // Encrypt using AES-256-GCM
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        // tagLength: 128 (default, authentication tag)
      },
      key,
      plaintextBytes
    );

    // Convert to Uint8Array
    const ciphertext = new Uint8Array(ciphertextBuffer);

    // Prepend IV to ciphertext (needed for decryption)
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);

    // Encode as Base64
    const base64 = arrayBufferToBase64(combined);

    // Clear sensitive data from memory (best effort)
    plaintextBytes.fill(0);

    return base64;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * FORMAT:
 * [12-byte IV][Ciphertext + Auth Tag]
 * Base64-encoded
 *
 * @param ciphertext - Base64-encoded encrypted data with IV
 * @param key - CryptoKey (AES-256-GCM)
 * @returns Decrypted plaintext (UTF-8 string)
 */
export async function decrypt(
  ciphertext: string,
  key: CryptoKey
): Promise<string> {
  // Validate inputs
  if (!ciphertext) {
    throw new Error('Ciphertext cannot be empty');
  }

  if (!key || key.type !== 'secret' || key.algorithm.name !== 'AES-GCM') {
    throw new Error('Invalid decryption key');
  }

  try {
    // Decode Base64
    const combined = base64ToArrayBuffer(ciphertext);

    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12);

    // Extract ciphertext (remaining bytes)
    const ciphertextBytes = combined.slice(12);

    // Decrypt using AES-256-GCM
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertextBytes
    );

    // Convert to UTF-8 string
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(plaintextBuffer);

    return plaintext;
  } catch (error) {
    // Decryption failure could mean:
    // 1. Wrong key (wrong master password)
    // 2. Corrupted ciphertext
    // 3. Tampered data (auth tag mismatch)
    throw new Error('Decryption failed. Wrong password or corrupted data.');
  }
}

/**
 * Batch encrypt multiple secrets in parallel
 *
 * @param plaintexts - Array of plaintext strings
 * @param key - CryptoKey (AES-256-GCM)
 * @returns Array of Base64-encoded ciphertexts
 */
export async function encryptBatch(
  plaintexts: string[],
  key: CryptoKey
): Promise<string[]> {
  return Promise.all(plaintexts.map((plaintext) => encrypt(plaintext, key)));
}

/**
 * Batch decrypt multiple secrets in parallel
 *
 * @param ciphertexts - Array of Base64-encoded ciphertexts
 * @param key - CryptoKey (AES-256-GCM)
 * @returns Array of plaintext strings
 */
export async function decryptBatch(
  ciphertexts: string[],
  key: CryptoKey
): Promise<string[]> {
  return Promise.all(ciphertexts.map((ciphertext) => decrypt(ciphertext, key)));
}

// Helper: ArrayBuffer to Base64
function arrayBufferToBase64(buffer: Uint8Array): string {
  const binary = String.fromCharCode(...buffer);
  return btoa(binary);
}

// Helper: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

**AES-256-GCM Rationale:**
- **AES-256:** Industry standard, approved by NIST
- **GCM mode:** Authenticated encryption (prevents tampering)
- **Random IV:** Unique IV for each encryption (prevents pattern analysis)
- **12-byte IV:** Optimal for GCM mode
- **Prepended IV:** Simplifies storage (all data in one Base64 string)

---

### Component: Key Storage

**Purpose:** Manage master key lifecycle (store, retrieve, lock, clear).

**File:** `lib/crypto/keyStorage.ts`

**Implementation:**

```typescript
import { deriveStorageKey } from './keyDerivation';
import { encrypt, decrypt } from './encryption';
import { indexedDBSet, indexedDBGet, indexedDBDelete } from './indexedDB';

// Master key stored in memory (cleared on lock/logout)
let masterKeyInMemory: CryptoKey | null = null;

/**
 * Store master key in memory and encrypted backup in IndexedDB
 *
 * STORAGE:
 * - Memory: CryptoKey object (primary, cleared on logout)
 * - IndexedDB: Encrypted key (backup for page refresh)
 *
 * @param masterKey - Master encryption key
 * @param sessionToken - JWT session token (used to derive storage key)
 */
export async function storeMasterKey(
  masterKey: CryptoKey,
  sessionToken: string
): Promise<void> {
  // Store in memory
  masterKeyInMemory = masterKey;

  try {
    // Derive storage key from session token
    const storageKey = await deriveStorageKey(sessionToken);

    // Export master key to raw bytes
    const exportedKey = await crypto.subtle.exportKey('raw', masterKey);

    // Convert to Base64
    const keyBase64 = arrayBufferToBase64(new Uint8Array(exportedKey));

    // Encrypt exported key with storage key
    const encryptedKey = await encrypt(keyBase64, storageKey);

    // Store in IndexedDB
    await indexedDBSet('encrypted_master_key', encryptedKey);
  } catch (error) {
    console.error('Failed to backup master key to IndexedDB:', error);
    // Non-fatal: Master key still in memory
  }
}

/**
 * Retrieve master key from memory (or decrypt from IndexedDB if needed)
 *
 * @returns Master key or null if locked
 */
export async function getMasterKey(): Promise<CryptoKey | null> {
  // Return from memory if available
  if (masterKeyInMemory) {
    return masterKeyInMemory;
  }

  // Master key not in memory (locked or page refresh)
  return null;
}

/**
 * Restore master key from IndexedDB (after page refresh)
 *
 * REQUIRES:
 * - User must be authenticated (session token available)
 * - Encrypted key must exist in IndexedDB
 *
 * @param sessionToken - JWT session token
 * @returns Master key or null if not found
 */
export async function restoreMasterKey(
  sessionToken: string
): Promise<CryptoKey | null> {
  try {
    // Retrieve encrypted key from IndexedDB
    const encryptedKey = await indexedDBGet('encrypted_master_key');
    if (!encryptedKey) {
      return null; // No backup found
    }

    // Derive storage key from session token
    const storageKey = await deriveStorageKey(sessionToken);

    // Decrypt master key
    const keyBase64 = await decrypt(encryptedKey, storageKey);

    // Convert Base64 to ArrayBuffer
    const keyBytes = base64ToArrayBuffer(keyBase64);

    // Import as CryptoKey
    const masterKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // Extractable
      ['encrypt', 'decrypt']
    );

    // Store in memory
    masterKeyInMemory = masterKey;

    return masterKey;
  } catch (error) {
    console.error('Failed to restore master key from IndexedDB:', error);
    return null;
  }
}

/**
 * Lock master key (clear from memory, keep IndexedDB backup)
 *
 * USE CASE:
 * - User clicks "Lock Vault" button
 * - Auto-lock after inactivity timeout
 */
export function lockMasterKey(): void {
  masterKeyInMemory = null;
  console.log('Master key locked (cleared from memory)');
}

/**
 * Clear master key entirely (memory + IndexedDB)
 *
 * USE CASE:
 * - User logs out
 * - Session expires
 */
export async function clearMasterKey(): Promise<void> {
  // Clear from memory
  masterKeyInMemory = null;

  // Delete from IndexedDB
  await indexedDBDelete('encrypted_master_key');

  console.log('Master key cleared (memory + IndexedDB)');
}

/**
 * Check if master key is available in memory
 *
 * @returns True if master key is unlocked
 */
export function isMasterKeyUnlocked(): boolean {
  return masterKeyInMemory !== null;
}

// Helper functions
function arrayBufferToBase64(buffer: Uint8Array): string {
  const binary = String.fromCharCode(...buffer);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

**Key Storage Strategy:**
- **Memory (primary):** Fast access, cleared on logout/lock
- **IndexedDB (backup):** Encrypted backup for page refresh
- **Session-derived key:** IndexedDB backup encrypted with key derived from session token
- **Lock vs. Clear:** Lock keeps backup, Clear removes everything

---

### Component: IndexedDB Helper

**Purpose:** Low-level IndexedDB operations for key storage.

**File:** `lib/crypto/indexedDB.ts`

**Implementation:**

```typescript
const DB_NAME = 'abyrith-crypto';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

/**
 * Initialize IndexedDB database
 *
 * @returns IDBDatabase instance
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Store value in IndexedDB
 *
 * @param key - Key name
 * @param value - Value to store
 */
export async function indexedDBSet(key: string, value: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Retrieve value from IndexedDB
 *
 * @param key - Key name
 * @returns Value or null if not found
 */
export async function indexedDBGet(key: string): Promise<string | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete value from IndexedDB
 *
 * @param key - Key name
 */
export async function indexedDBDelete(key: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all data from IndexedDB
 */
export async function indexedDBClear(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}
```

---

## Data Flow

### Flow 1: User Logs In and Derives Master Key

**Trigger:** User submits login form with email, account password, and master password.

**Steps:**

1. **Authenticate with Supabase Auth (account password)**
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password: accountPassword, // NOT master password
   });
   ```

2. **Derive master key from master password**
   ```typescript
   const userSalt = data.user.id; // User ID as salt
   const masterKey = await deriveMasterKey(masterPassword, userSalt);
   // Takes 3-5 seconds (show loading indicator)
   ```

3. **Verify master key is correct (decrypt test secret)**
   ```typescript
   // Fetch encrypted test secret from user's account
   const testSecret = await apiClient.get('/auth/test-secret');

   try {
     await decrypt(testSecret.encrypted_value, masterKey);
     // Success: Master password is correct
   } catch {
     throw new Error('Incorrect master password');
   }
   ```

4. **Store master key (memory + IndexedDB backup)**
   ```typescript
   await storeMasterKey(masterKey, data.session.access_token);
   // Memory: Immediate access
   // IndexedDB: Backup for page refresh
   ```

5. **Update auth store**
   ```typescript
   useAuthStore.getState().setMasterKeyReady(true);
   // Components can now fetch and decrypt secrets
   ```

**Sequence Diagram:**

```
User    LoginForm   Supabase   KeyDerivation   KeyStorage   TestSecret
 |          |           |            |              |            |
 |--submit->|           |            |              |            |
 | (email,  |           |            |              |            |
 |  acctPw, |           |            |              |            |
 | masterPw)|           |            |              |            |
 |          |           |            |              |            |
 |          |--signIn-->|            |              |            |
 |          |           |--verify--->|              |            |
 |          |           |<--JWT------|              |            |
 |          |           |            |              |            |
 |          |----derive masterKey--->|              |            |
 |          |           |            |--(3-5s)----->|            |
 |          |           |            |<--CryptoKey--|            |
 |          |           |            |              |            |
 |          |------get test secret------------------>---------->|
 |          |           |            |              |<--encrypted|
 |          |           |            |              |            |
 |          |------decrypt(test)---->|              |            |
 |          |           |<--success--|              |            |
 |          |           |            |              |            |
 |          |------store(masterKey)---------------->|            |
 |          |           |            |              |--memory--->|
 |          |           |            |              |--IndexedDB>|
 |          |           |            |              |            |
 |<--success|           |            |              |            |
 | (redirect to dashboard)           |              |            |
```

**Performance:**
- PBKDF2 derivation: 3-5 seconds (intentionally slow for security)
- Test decryption: < 10ms
- Total unlock time: ~5 seconds

---

### Flow 2: Encrypt Secret Before Sending to API

**Trigger:** User creates new secret via "Create Secret" form.

**Steps:**

1. **Get master key from memory**
   ```typescript
   const masterKey = await getMasterKey();
   if (!masterKey) {
     throw new Error('Master key not available. Please unlock your vault.');
   }
   ```

2. **Encrypt secret value**
   ```typescript
   const plaintext = formData.value; // e.g., "sk_test_51H..."
   const ciphertext = await encrypt(plaintext, masterKey);
   // Output: Base64 string with IV prepended
   // Example: "AAECAwQFBgcICQoLDA0O..." (IV) + "encrypted bytes..."
   ```

3. **Send to API (without plaintext)**
   ```typescript
   const response = await apiClient.post('/secrets', {
     name: formData.name,
     encrypted_value: ciphertext, // Base64 ciphertext
     service_name: formData.service_name,
     project_id: formData.project_id,
     // No plaintext 'value' field
   });
   ```

4. **Server stores encrypted value (cannot decrypt)**
   - Database: `secrets.encrypted_value` column stores Base64 ciphertext
   - Server never sees plaintext secret

**Data Transformations:**
- **Point A (User input):** `"sk_test_51H..."` (plaintext)
- **Point B (Encryption):** Generate random IV, encrypt with AES-256-GCM
- **Point C (Base64):** `"AAECAwQFBgcICQoL..." (Base64 ciphertext with IV)`
- **Point D (Network):** Transmitted over HTTPS (double encryption: AES + TLS)
- **Point E (Database):** Stored as `encrypted_value` (Base64 ciphertext)

**Important:** Plaintext never transmitted or stored on server.

---

### Flow 3: Decrypt Secrets After Fetching from API

**Trigger:** Component calls `useSecrets(projectId)` (React Query hook).

**Steps:**

1. **Fetch encrypted secrets from API**
   ```typescript
   const response = await apiClient.get(`/projects/${projectId}/secrets`);
   // Returns: Array of secrets with encrypted_value (Base64)
   ```

2. **Get master key from memory**
   ```typescript
   const masterKey = await getMasterKey();
   if (!masterKey) {
     throw new Error('Master key not available');
   }
   ```

3. **Decrypt all secrets in parallel**
   ```typescript
   const decryptedSecrets = await Promise.all(
     response.data.map(async (secret) => ({
       ...secret,
       decrypted_value: await decrypt(secret.encrypted_value, masterKey),
     }))
   );
   // Each secret now has both encrypted_value and decrypted_value
   ```

4. **Cache decrypted secrets (React Query)**
   - React Query caches decrypted secrets in memory
   - Cache cleared on page refresh or logout

5. **Component renders plaintext**
   ```typescript
   <SecretCard secret={secret}>
     <div>{secret.decrypted_value}</div>
   </SecretCard>
   ```

**Performance:**
- Decrypt 10 secrets: ~50ms (parallel)
- Decrypt 100 secrets: ~500ms (parallel)

---

## API Contracts

### Internal APIs

**API: deriveMasterKey**

**Purpose:** Derive AES-256-GCM key from master password.

**Signature:**
```typescript
async function deriveMasterKey(
  masterPassword: string,
  userSalt: string
): Promise<CryptoKey>
```

**Parameters:**
- `masterPassword` (string) - User's master password (never transmitted)
- `userSalt` (string) - Salt for key derivation (typically user ID)

**Returns:** `CryptoKey` (AES-256-GCM, extractable)

**Throws:**
- `Error` - If master password is too short (< 8 characters)
- `Error` - If user salt is missing

**Example:**
```typescript
const masterKey = await deriveMasterKey('my-secure-password', user.id);
```

---

**API: encrypt**

**Purpose:** Encrypt plaintext using AES-256-GCM.

**Signature:**
```typescript
async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string>
```

**Parameters:**
- `plaintext` (string) - Data to encrypt (UTF-8)
- `key` (CryptoKey) - AES-256-GCM key

**Returns:** Base64-encoded ciphertext with IV prepended

**Throws:**
- `Error` - If plaintext is empty
- `Error` - If key is invalid

**Example:**
```typescript
const ciphertext = await encrypt('my-secret-api-key', masterKey);
// Returns: "AAECAwQFBgcICQoL..." (Base64)
```

---

**API: decrypt**

**Purpose:** Decrypt ciphertext using AES-256-GCM.

**Signature:**
```typescript
async function decrypt(
  ciphertext: string,
  key: CryptoKey
): Promise<string>
```

**Parameters:**
- `ciphertext` (string) - Base64-encoded ciphertext with IV
- `key` (CryptoKey) - AES-256-GCM key

**Returns:** Decrypted plaintext (UTF-8 string)

**Throws:**
- `Error` - If ciphertext is empty
- `Error` - If key is invalid
- `Error` - If decryption fails (wrong key, corrupted data, tampering)

**Example:**
```typescript
const plaintext = await decrypt(ciphertext, masterKey);
// Returns: "my-secret-api-key"
```

---

**API: storeMasterKey**

**Purpose:** Store master key in memory and encrypted backup in IndexedDB.

**Signature:**
```typescript
async function storeMasterKey(
  masterKey: CryptoKey,
  sessionToken: string
): Promise<void>
```

**Parameters:**
- `masterKey` (CryptoKey) - Master encryption key
- `sessionToken` (string) - JWT session token (for deriving storage key)

**Side Effects:**
- Stores master key in memory (module-level variable)
- Encrypts and stores backup in IndexedDB

---

**API: getMasterKey**

**Purpose:** Retrieve master key from memory.

**Signature:**
```typescript
async function getMasterKey(): Promise<CryptoKey | null>
```

**Returns:** Master key or `null` if locked

**Example:**
```typescript
const masterKey = await getMasterKey();
if (!masterKey) {
  // Show "Unlock Vault" prompt
}
```

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Browser Memory ↔ IndexedDB**
- **Threats:** Master key backup in IndexedDB could be accessed by malicious code
- **Controls:**
  - Master key encrypted before storing in IndexedDB
  - Storage key derived from session token (requires active session)
  - IndexedDB sandboxed per-origin (browser security)

**Boundary 2: JavaScript Code ↔ Web Crypto API**
- **Threats:** Crypto implementation bugs, weak algorithms
- **Controls:**
  - Use Web Crypto API (native, audited implementation)
  - No custom crypto (don't roll your own)
  - Industry-standard algorithms (AES-256-GCM, PBKDF2)

**Boundary 3: Client ↔ Server**
- **Threats:** Plaintext secrets or master password transmitted
- **Controls:**
  - Master password never transmitted (client-only)
  - Secrets encrypted before API calls
  - HTTPS for all communication

### Data Security

**Data at Rest (Browser):**
- **Memory:** Master key (CryptoKey), decrypted secrets (temporary)
- **IndexedDB:** Encrypted master key (backup)
- **Not stored:** Master password (never persisted)

**Data in Transit:**
- **HTTPS:** All API calls encrypted with TLS
- **Double encryption:** Secrets encrypted client-side, then TLS

**Data in Use:**
- **Memory:** Decrypted secrets in component state (cleared on unmount)
- **CryptoKey objects:** Native browser objects (limited exposure)

### Threat Model

**Threat 1: XSS Attack Steals Master Key from Memory**
- **Description:** Attacker injects malicious JavaScript that accesses master key
- **Likelihood:** Medium
- **Impact:** Critical (all secrets exposed)
- **Mitigation:**
  - Strict CSP (no inline scripts)
  - React escapes JSX
  - Sanitize user input
  - Auto-lock after inactivity

**Threat 2: Weak Master Password (Brute Force)**
- **Description:** Attacker brute-forces weak master password
- **Likelihood:** Medium (if user chooses weak password)
- **Impact:** Critical (access to all secrets)
- **Mitigation:**
  - Enforce strong password policy (min 12 characters, complexity)
  - PBKDF2 600k iterations (slows brute force)
  - Encourage passphrases

**Threat 3: IndexedDB Backup Extracted (Device Access)**
- **Description:** Attacker accesses device, extracts IndexedDB
- **Likelihood:** Low
- **Impact:** Medium (backup is encrypted, needs session token)
- **Mitigation:**
  - Backup encrypted with session-derived key
  - Session token expires (requires re-login)
  - Auto-lock on device close

**Threat 4: Quantum Computer Breaks AES-256**
- **Description:** Future quantum computers break AES-256 encryption
- **Likelihood:** Very Low (decades away)
- **Impact:** Critical (all secrets exposed retrospectively)
- **Mitigation:**
  - Monitor NIST post-quantum cryptography standards
  - Plan migration to quantum-resistant algorithms
  - AES-256 considered safe for 10+ years

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- PBKDF2 key derivation: 3-5 seconds (acceptable for high security)
- AES-256-GCM encryption: < 10ms per secret
- AES-256-GCM decryption: < 10ms per secret
- Batch decrypt 100 secrets: < 500ms (parallel)

**Throughput:**
- Handle 100+ encryption/decryption operations per second

**Resource Usage:**
- Memory: < 10MB for crypto operations
- CPU: 100% spike during PBKDF2 (intentional, shows loading indicator)

### Performance Optimization

**Optimizations implemented:**
- **Parallel encryption/decryption:** Use `Promise.all()` for batch operations
- **Reuse master key:** Derive once, use many times
- **Web Crypto API:** Native implementation (faster than JavaScript)

**PBKDF2 Tuning:**
- 600,000 iterations: OWASP 2023 recommendation
- Trade-off: Security (slow brute force) vs. UX (slow unlock)
- Show progress indicator during derivation

**Future Optimizations (Post-MVP):**
- **Web Workers:** Offload PBKDF2 to background thread (non-blocking UI)
- **Hardware acceleration:** Use WebGPU for PBKDF2 (faster on supported devices)

---

## Scalability

### Horizontal Scaling

Not applicable (client-side library).

### Vertical Scaling

**Crypto operations scale linearly with number of secrets:**
- 10 secrets: ~50ms decrypt
- 100 secrets: ~500ms decrypt
- 1000 secrets: ~5s decrypt (needs optimization)

**Mitigation:**
- Pagination (fetch 20 secrets at a time)
- Virtual scrolling (render visible secrets only)
- Web Workers (parallel decryption in background)

---

## Failure Modes

### Failure Mode 1: Wrong Master Password

**Scenario:** User enters incorrect master password.

**Impact:** Decryption fails, cannot access secrets.

**Detection:** `decrypt()` throws error during test secret verification.

**Recovery:**
- Show error message: "Incorrect master password"
- Allow user to retry

**Prevention:**
- Verify master password with test secret before proceeding

---

### Failure Mode 2: Master Key Cleared from Memory (Page Refresh)

**Scenario:** User refreshes page, master key cleared from memory.

**Impact:** User must re-enter master password to unlock.

**Detection:** `getMasterKey()` returns `null`.

**Recovery:**
1. Check for encrypted backup in IndexedDB
2. Attempt to restore from IndexedDB (using session token)
3. If restore fails, prompt user to re-enter master password

**Prevention:**
- Encrypted backup in IndexedDB (automatic)
- Session-based restore (seamless)

---

### Failure Mode 3: Corrupted Ciphertext

**Scenario:** Ciphertext corrupted in database or during transmission.

**Impact:** Decryption fails for affected secret.

**Detection:** `decrypt()` throws error (auth tag mismatch).

**Recovery:**
- Show error message: "Secret corrupted, cannot decrypt"
- Suggest re-creating secret

**Prevention:**
- GCM auth tag detects tampering/corruption
- Database integrity constraints
- API validation

---

## Alternatives Considered

### Alternative 1: CryptoJS Library

**Description:** Use CryptoJS library instead of Web Crypto API.

**Pros:**
- JavaScript implementation (works in older browsers)
- Familiar API

**Cons:**
- Slower than native Web Crypto API
- Larger bundle size
- Not audited by browser vendors
- Risk of implementation bugs

**Why not chosen:** Web Crypto API is native, faster, and more secure.

---

### Alternative 2: Server-Side Encryption

**Description:** Encrypt secrets server-side with a server-controlled key.

**Pros:**
- Simpler client implementation
- Easier key recovery
- Faster (no client-side crypto overhead)

**Cons:**
- NOT zero-knowledge (server can decrypt secrets)
- Server is a single point of failure
- Trust required in server operator

**Why not chosen:** Violates zero-knowledge principle. Server must never access plaintext secrets.

---

### Alternative 3: Argon2 instead of PBKDF2

**Description:** Use Argon2 for key derivation (more modern, memory-hard).

**Pros:**
- More secure against brute force (memory-hard)
- Winner of Password Hashing Competition

**Cons:**
- Not natively supported in Web Crypto API (requires WebAssembly)
- Larger bundle size
- Less browser support

**Why not chosen:** PBKDF2 with 600k iterations is sufficient and natively supported. Argon2 requires WebAssembly polyfill.

---

## Decision Log

### Decision 1: AES-256-GCM (not AES-256-CBC)

**Date:** 2025-10-30

**Context:** Choose AES mode for encryption.

**Options:**
1. AES-256-CBC (cipher block chaining)
2. AES-256-GCM (Galois/Counter Mode)

**Decision:** AES-256-GCM.

**Rationale:**
- GCM provides authenticated encryption (prevents tampering)
- CBC requires separate HMAC for authentication
- GCM is faster (parallelizable)
- GCM is recommended by NIST

**Consequences:**
- Must generate unique IV for each encryption
- Auth tag verifies integrity

---

### Decision 2: 600,000 PBKDF2 Iterations

**Date:** 2025-10-30

**Context:** Choose PBKDF2 iteration count.

**Options:**
1. 100,000 iterations (faster, less secure)
2. 600,000 iterations (OWASP 2023 recommendation)
3. 1,000,000+ iterations (slower, more secure)

**Decision:** 600,000 iterations.

**Rationale:**
- OWASP 2023 recommendation for password-based key derivation
- Slows brute force attacks significantly
- Acceptable UX (3-5s unlock time with loading indicator)

**Consequences:**
- Slow unlock (3-5 seconds)
- Must show loading indicator

---

### Decision 3: Store Decrypted Secrets in React Query Cache

**Date:** 2025-10-30

**Context:** Should React Query cache store encrypted or decrypted secrets?

**Options:**
1. Store encrypted, decrypt on access
2. Store decrypted in cache

**Decision:** Store decrypted in cache.

**Rationale:**
- Simpler: Decrypt once, use many times
- Performance: No repeated decryption
- Cache is memory-only (cleared on refresh)
- Acceptable security trade-off

**Consequences:**
- Decrypted secrets in memory (cleared on logout/refresh)
- Must re-decrypt on page refresh

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `TECH-STACK.md` - Technology decisions (Web Crypto API)
- [ ] `03-security/encryption-specification.md` - Encryption specification (referenced but doesn't exist yet)
- [x] `03-security/security-model.md` - Zero-knowledge architecture
- [x] `07-frontend/frontend-architecture.md` - Overall frontend architecture

**External APIs:**
- Web Crypto API (native browser API)
- IndexedDB API (native browser API)

### Architecture Dependencies

**Depends on these components:**
- Supabase Auth (for user ID as salt)
- API Client (for fetching encrypted secrets)

**Required by these components:**
- React Query hooks (useSecrets, useCreateSecret, etc.)
- All components that display secrets

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge architecture
- `07-frontend/frontend-architecture.md` - Overall frontend architecture
- `07-frontend/api-client/react-query-setup.md` - React Query integration
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [Web Crypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - MDN Web Crypto guide
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - PBKDF2 recommendations
- [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) - GCM specification
- [CryptoKey Interface](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey) - CryptoKey documentation

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial Web Crypto implementation documentation |

---

## Notes

### Future Enhancements
- **Web Workers for PBKDF2** - Offload key derivation to background thread (non-blocking UI)
- **Hardware key support (WebAuthn)** - Use hardware security keys for additional protection
- **Biometric unlock** - Face ID / Touch ID for mobile devices
- **Key rotation** - Allow users to change master password and re-encrypt all secrets
- **Quantum-resistant cryptography** - Migrate to post-quantum algorithms when standardized

### Known Issues
- **PBKDF2 blocks UI** - 600k iterations take 3-5 seconds (by design for security, but impacts UX)
- **No password recovery** - If user forgets master password, all secrets are permanently lost (zero-knowledge trade-off)
- **Browser compatibility** - Web Crypto API requires modern browsers (Chrome 60+, Firefox 52+, Safari 11+)

### Next Review Date
2025-11-30 (review after initial implementation and security audit)
