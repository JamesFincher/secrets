---
Document: Zero-Knowledge Encryption UX Flow - Feature Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 03-security/security-model.md, 05-api/endpoints/secrets-endpoints.md
---

# Zero-Knowledge Encryption UX Flow Feature

## Overview

This document details the user experience flow for Abyrith's zero-knowledge encryption system, where users create a master password, encrypt secrets in their browser, and store encrypted data on servers that can never decrypt the values. The feature ensures enterprise-grade security while maintaining "5-year-old simple" usability.

**Purpose:** Provide a transparent, intuitive encryption experience that makes security invisible to users while maintaining complete data sovereignty through zero-knowledge architecture.

**Target Users:** All personas (The Learner, Solo Developer, Development Team, Enterprise)

**Priority:** P0 - MVP Critical (Zero-knowledge encryption is foundational to Abyrith's value proposition)

---

## Table of Contents

1. [User Perspective](#user-perspective)
2. [Technical Architecture](#technical-architecture)
3. [User Flows](#user-flows)
4. [Technical Implementation](#technical-implementation)
5. [API Contracts](#api-contracts)
6. [Security Considerations](#security-considerations)
7. [Performance Requirements](#performance-requirements)
8. [Testing Strategy](#testing-strategy)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## User Perspective

### What Users See

**For first-time users:**
- After creating an Abyrith account (email/password or OAuth), users are prompted to create a separate "master password" for encrypting their secrets
- Clear explanation: "This password encrypts your secrets. We can never recover it or your secrets if you forget it."
- Optional: Generate and download a recovery key for emergency access
- Secrets are automatically encrypted before being saved (no manual encryption step)
- Decryption happens automatically when viewing secrets (just enter master password once per session)

**Key Capabilities:**
- Create master password with strength indicator
- Generate secure recovery key (optional but recommended)
- Automatic session-based master key caching (no repeated password entry)
- Transparent encryption/decryption (happens behind the scenes)
- Visual indicators showing when data is encrypted vs. decrypted
- Master password change flow (re-encrypts all secrets)
- Password strength requirements and validation
- "What if I forget my password?" educational prompts

### User Benefits

**For Learners (Beginners):**
- Security that "just works" without technical knowledge required
- Clear warnings about password importance without fear-mongering
- Visual feedback showing secrets are protected
- Simple recovery key concept: "Download this file and keep it safe"

**For Solo Developers:**
- Complete control over encryption keys (no trust required in Abyrith)
- Fast encryption/decryption (< 100ms) doesn't slow down workflow
- Confidence that secrets can't be accessed even if Abyrith is compromised
- No vendor lock-in (data sovereignty)

**For Development Teams:**
- Compliance-ready (SOC 2, GDPR) out of the box
- Audit trails show who accessed what, but never the decrypted values
- Team sharing works through envelope encryption (no master password sharing)
- Individual accountability (each user has own master password)

**For Enterprise:**
- Zero-knowledge architecture passes security audits
- Cannot be compelled to disclose secrets (don't have access)
- Meets data sovereignty requirements
- Reduces liability (plaintext secrets never on servers)

### Example Scenarios

**Scenario 1: First-Time User Creating First Secret**

Sarah is a beginner following a tutorial that requires an OpenAI API key.

1. Sarah creates Abyrith account with email/password
2. Prompted: "Create a master password to encrypt your secrets"
   - Password strength indicator shows "Strong" as she types
   - Warning: "We can never recover this password. Keep it safe."
   - Option: "Generate recovery key" (recommended)
3. Sarah downloads recovery key file (abyrith-recovery-key.txt)
4. Clicks "Add Your First Secret"
5. AI Assistant asks: "What API key do you need?"
6. Sarah types: "OpenAI"
7. AI guides her through getting the key
8. She pastes the key, clicks "Save Secret"
9. **Behind the scenes:** Browser encrypts key with master password (she doesn't see this complexity)
10. Success message: "Secret saved securely! Only you can decrypt it with your master password."

**Scenario 2: Returning User Accessing Secrets**

Tom logs back into Abyrith after a week.

1. Logs in with account password
2. Navigates to "RecipeApp" project
3. Clicks on "STRIPE_API_KEY" to view
4. **First secret access of session:** Prompted for master password
5. Enters master password (with "Remember for this session" checked)
6. Secret decrypts and displays
7. For the rest of the session, secrets decrypt automatically (master key cached in memory)
8. Closes browser → Master key cleared from memory (no persistence)

**Scenario 3: User Forgets Master Password**

Alex tries to access secrets but forgot the master password.

1. Enters incorrect master password 3 times
2. Abyrith shows: "Master password incorrect. Do you have a recovery key?"
3. Options:
   - **If has recovery key:** Upload recovery key file → Enter recovery key passphrase → Access restored
   - **If no recovery key:** "Without your master password or recovery key, your secrets cannot be recovered. This is necessary for zero-knowledge security."
4. Alex creates new project with new master password
5. Old secrets remain encrypted (unrecoverable without original master password)

---

## Technical Architecture

### System Components

**Components involved:**
- **Frontend (Browser):**
  - Master password input component (React)
  - Web Crypto API encryption service (TypeScript)
  - Session key manager (in-memory only, Zustand state)
  - Password strength calculator
  - Recovery key generator
- **Backend:**
  - API endpoints (Cloudflare Workers) for CRUD operations
  - Storage (Supabase PostgreSQL) for encrypted blobs
  - Audit logging system
- **Database:**
  - `user_encryption_keys` table (stores PBKDF2 salt, not master password)
  - `secrets` table (stores encrypted values, encrypted DEKs, nonces)
  - `audit_logs` table (records access events, not decrypted values)
- **External Services:**
  - None (encryption happens entirely client-side)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   User's Browser                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  User Interface (React Components)                │  │
│  │  - MasterPasswordSetup.tsx                        │  │
│  │  - SecretEncryptionIndicator.tsx                  │  │
│  │  - MasterPasswordPrompt.tsx                       │  │
│  │  - RecoveryKeyGenerator.tsx                       │  │
│  └─────────────────┬─────────────────────────────────┘  │
│                    │                                     │
│                    ▼                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Encryption Service (EncryptionService.ts)        │  │
│  │  - deriveMasterKey(password, salt)                │  │
│  │  - encryptSecret(plaintext, masterKey)            │  │
│  │  - decryptSecret(encrypted, masterKey)            │  │
│  │  - generateRecoveryKey(masterKey)                 │  │
│  │                                                    │  │
│  │  Uses: Web Crypto API (SubtleCrypto)              │  │
│  │  - PBKDF2-SHA256 (600,000 iterations)             │  │
│  │  - AES-256-GCM encryption                         │  │
│  │  - CSPRNG for nonce generation                    │  │
│  └─────────────────┬─────────────────────────────────┘  │
│                    │                                     │
│                    ▼                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Session Key Manager (Zustand Store)              │  │
│  │  - masterKey: CryptoKey | null (in-memory only)   │  │
│  │  - sessionExpiry: timestamp                       │  │
│  │  - clearMasterKey() on logout/timeout            │  │
│  └─────────────────┬─────────────────────────────────┘  │
│                    │                                     │
└────────────────────┼─────────────────────────────────────┘
                     │ HTTPS (TLS 1.3)
                     │ Encrypted blob + metadata
                     ▼
┌──────────────────────────────────────────────────────────┐
│          Cloudflare Workers (API Gateway)                │
│  - Authenticate JWT                                      │
│  - Validate input (encrypted blob format)                │
│  - Forward to Supabase                                   │
│  - CANNOT decrypt (no master key)                        │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│          Supabase PostgreSQL (Data Layer)                │
│  - secrets table (encrypted_value, encrypted_dek, nonce) │
│  - user_encryption_keys table (pbkdf2_salt)              │
│  - RLS policies (user isolation)                         │
│  - CANNOT decrypt (no master key)                        │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

**High-level encryption flow:**
1. User enters master password (only in browser, never transmitted)
2. Browser derives 256-bit master key using PBKDF2 (with user's salt from DB)
3. Master key stored in memory only (non-extractable CryptoKey object)
4. For each secret:
   - Generate random 256-bit Data Encryption Key (DEK)
   - Encrypt secret value with DEK using AES-256-GCM
   - Encrypt DEK with master key (envelope encryption)
   - Send encrypted secret + encrypted DEK + nonce to server
5. Server stores encrypted blobs (cannot decrypt)
6. On retrieval: Reverse process (decrypt DEK with master key, then decrypt secret with DEK)

---

## User Flows

### Flow 1: Master Password Setup (First-Time User)

**Trigger:** User completes account creation (email verification or OAuth)

**Steps:**

1. **User sees onboarding screen:**
   ```
   "Secure Your Secrets"

   Create a master password to encrypt your API keys and secrets.
   This password:
   - Encrypts everything in your browser
   - Never leaves your device
   - Cannot be recovered by Abyrith

   [Input: Master Password]
   [Password strength: Weak | Good | Strong | Excellent]

   [Checkbox] I understand I must remember this password

   [Button: Create Master Password]
   [Link: Learn about zero-knowledge encryption]
   ```

2. **User types password, sees real-time strength indicator:**
   - Checks length (min 12 characters)
   - Checks complexity (uppercase, lowercase, numbers, symbols)
   - Visual indicator changes color: Red → Yellow → Green
   - Suggestions: "Add a symbol" or "Use a longer passphrase"

3. **User checks understanding checkbox and clicks "Create Master Password"**

4. **Browser generates salt and derives master key:**
   ```typescript
   const salt = crypto.getRandomValues(new Uint8Array(16));
   const masterKey = await deriveMasterKey(password, salt);
   // masterKey is CryptoKey object, non-extractable
   ```

5. **Salt sent to server (plaintext, safe to store):**
   ```typescript
   POST /api/user-encryption-keys
   {
     user_id: "user-uuid",
     pbkdf2_salt: base64(salt),
     created_at: "2025-10-30T12:00:00Z"
   }
   ```

6. **Recovery key generation prompt:**
   ```
   "Create Recovery Key (Recommended)"

   If you forget your master password, this recovery key can restore access.

   [Button: Generate Recovery Key]
   [Button: Skip (Not Recommended)]
   ```

7. **If user generates recovery key:**
   - Browser generates recovery passphrase (BIP39 24-word mnemonic)
   - Encrypts master key with recovery passphrase
   - Downloads file: `abyrith-recovery-key.txt`
   - File contents:
     ```
     Abyrith Recovery Key
     Created: 2025-10-30

     Recovery Passphrase:
     apple banana cherry ... (24 words)

     Encrypted Master Key:
     <base64-encoded-encrypted-key>

     KEEP THIS FILE SAFE! Anyone with this file and passphrase can access your secrets.
     ```

8. **Success message:**
   ```
   "Master Password Created!"

   Your secrets will now be encrypted automatically.
   ✓ Recovery key saved to Downloads

   [Button: Add Your First Secret]
   ```

**Success Criteria:** Master password created, salt stored, recovery key generated (optional), user redirected to dashboard

**Error Cases:**
- **Weak password:** "Password too weak. Must be at least 12 characters with uppercase, lowercase, and numbers."
- **Network error saving salt:** "Could not save encryption settings. Please try again."
- **Browser doesn't support Web Crypto API:** "Your browser doesn't support the encryption features required by Abyrith. Please use Chrome 100+, Firefox 100+, or Safari 15+."

---

### Flow 2: Encrypting and Storing a Secret

**Trigger:** User clicks "Add Secret" or "Save" after editing secret

**Steps:**

1. **User fills out secret form:**
   ```
   Secret Name: OPENAI_API_KEY
   Service: OpenAI
   Environment: Development
   Value: [Input: sk_test_abc123...]
   Tags: ai, api-key
   ```

2. **User clicks "Save Secret"**

3. **Browser checks for master key in session:**
   ```typescript
   const masterKey = sessionKeyStore.getMasterKey();
   if (!masterKey) {
     // Prompt for master password
     await promptMasterPassword();
   }
   ```

4. **If master key not in session, prompt for password:**
   ```
   "Enter Master Password"

   To encrypt this secret, please enter your master password.

   [Input: Master Password]
   [Checkbox] Remember for this session

   [Button: Decrypt]
   [Link: Use recovery key instead]
   ```

5. **User enters master password, browser re-derives key:**
   ```typescript
   // Fetch user's salt from DB
   const { data } = await supabase
     .from('user_encryption_keys')
     .select('pbkdf2_salt')
     .eq('user_id', userId)
     .single();

   // Re-derive master key
   const masterKey = await deriveMasterKey(password, data.pbkdf2_salt);

   // Cache in session store
   sessionKeyStore.setMasterKey(masterKey, sessionDurationMs);
   ```

6. **Encrypt secret client-side:**
   ```typescript
   // Generate Data Encryption Key
   const dek = await crypto.subtle.generateKey(
     { name: 'AES-GCM', length: 256 },
     true,
     ['encrypt', 'decrypt']
   );

   // Generate nonce
   const secretNonce = crypto.getRandomValues(new Uint8Array(12));

   // Encrypt secret value with DEK
   const encryptedSecret = await crypto.subtle.encrypt(
     { name: 'AES-GCM', iv: secretNonce },
     dek,
     new TextEncoder().encode(secretValue)
   );

   // Export DEK
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

7. **Send encrypted data to server:**
   ```typescript
   POST /api/secrets
   {
     project_id: "project-uuid",
     environment: "development",
     service_name: "openai",
     key_name: "OPENAI_API_KEY",
     encrypted_value: base64(encryptedSecret),
     encrypted_dek: base64(encryptedDEK),
     secret_nonce: base64(secretNonce),
     dek_nonce: base64(dekNonce),
     tags: ["ai", "api-key"]
   }
   ```

8. **Server stores encrypted blob (cannot decrypt):**
   ```sql
   INSERT INTO secrets (
     id, user_id, project_id, environment,
     service_name, key_name,
     encrypted_value, encrypted_dek,
     secret_nonce, dek_nonce, tags
   ) VALUES (
     gen_random_uuid(), 'user-uuid', 'project-uuid', 'development',
     'openai', 'OPENAI_API_KEY',
     decode('base64_blob', 'base64'), decode('base64_blob', 'base64'),
     decode('base64_nonce', 'base64'), decode('base64_nonce', 'base64'),
     ARRAY['ai', 'api-key']
   );
   ```

9. **Success feedback:**
   ```
   "Secret Saved!"

   ✓ Encrypted in your browser
   ✓ Stored securely

   [Icon: Lock] Only you can decrypt this with your master password.
   ```

**Success Criteria:** Secret encrypted client-side, encrypted blob stored server-side, success message shown

**Error Cases:**
- **Incorrect master password:** "Master password incorrect. Please try again or use your recovery key."
- **Encryption fails (Web Crypto API error):** "Encryption failed. Please refresh the page and try again."
- **Network error:** "Could not save secret. Please check your connection and try again."
- **Validation error (server-side):** "Invalid secret format. Please check your input."

---

### Flow 3: Decrypting and Viewing a Secret

**Trigger:** User clicks on a secret card to view the decrypted value

**Steps:**

1. **User clicks secret card:**
   ```
   [Secret Card]
   OPENAI_API_KEY
   Service: OpenAI
   Environment: Development
   [Icon: Eye] View Secret
   ```

2. **Browser checks for master key in session:**
   ```typescript
   const masterKey = sessionKeyStore.getMasterKey();
   if (!masterKey) {
     // First access this session, prompt for password
     await promptMasterPassword();
   }
   ```

3. **If needed, prompt for master password** (same as Flow 2 step 4-5)

4. **Fetch encrypted secret from server:**
   ```typescript
   GET /api/secrets/:secretId

   Response:
   {
     id: "secret-uuid",
     service_name: "openai",
     key_name: "OPENAI_API_KEY",
     encrypted_value: "base64...",
     encrypted_dek: "base64...",
     secret_nonce: "base64...",
     dek_nonce: "base64...",
     environment: "development",
     tags: ["ai", "api-key"]
   }
   ```

5. **Decrypt DEK with master key:**
   ```typescript
   const dekNonce = base64ToUint8Array(secret.dek_nonce);
   const encryptedDEK = base64ToUint8Array(secret.encrypted_dek);

   const rawDEK = await crypto.subtle.decrypt(
     { name: 'AES-GCM', iv: dekNonce },
     masterKey,
     encryptedDEK
   );

   const dek = await crypto.subtle.importKey(
     'raw',
     rawDEK,
     'AES-GCM',
     false,
     ['decrypt']
   );
   ```

6. **Decrypt secret value with DEK:**
   ```typescript
   const secretNonce = base64ToUint8Array(secret.secret_nonce);
   const encryptedValue = base64ToUint8Array(secret.encrypted_value);

   const plaintextBuffer = await crypto.subtle.decrypt(
     { name: 'AES-GCM', iv: secretNonce },
     dek,
     encryptedValue
   );

   const secretValue = new TextDecoder().decode(plaintextBuffer);
   ```

7. **Display decrypted secret:**
   ```
   [Secret Details]
   OPENAI_API_KEY
   Service: OpenAI
   Environment: Development

   Value: sk_test_abc123...xyz [Icon: Copy] [Icon: Hide]

   [Icon: Warning] This value is decrypted. Never share your screen while visible.
   ```

8. **Auto-hide after timeout (optional):**
   - After 30 seconds of viewing, automatically hide decrypted value
   - User can click "View" again to show

9. **Audit log entry created (server-side):**
   ```typescript
   INSERT INTO audit_logs (
     user_id, action, resource_type, resource_id,
     ip_address, user_agent, timestamp
   ) VALUES (
     'user-uuid', 'secret.read', 'secret', 'secret-uuid',
     '203.0.113.1', 'Mozilla/5.0...', NOW()
   );
   ```

**Success Criteria:** Secret decrypted in browser, plaintext displayed, audit log recorded (without decrypted value)

**Error Cases:**
- **Incorrect master password:** "Master password incorrect. Cannot decrypt secret."
- **Decryption fails (auth tag verification):** "Secret integrity check failed. This secret may have been tampered with."
- **Secret not found (404):** "Secret not found or you don't have permission to access it."
- **Network error:** "Could not load secret. Please check your connection."

---

### Flow 4: Master Password Change (Re-encryption)

**Trigger:** User navigates to Settings → Security → "Change Master Password"

**Steps:**

1. **User clicks "Change Master Password"**

2. **Prompt for current master password:**
   ```
   "Change Master Password"

   Step 1: Verify Current Password

   [Input: Current Master Password]

   [Button: Continue]
   ```

3. **User enters current password, verify by deriving key:**
   ```typescript
   const currentMasterKey = await deriveMasterKey(
     currentPassword,
     storedSalt
   );

   // Test decryption on a known secret to verify
   const testSecret = await fetchOneSecret();
   const decryptedTest = await decryptSecret(testSecret, currentMasterKey);
   // If successful, password is correct
   ```

4. **Prompt for new master password:**
   ```
   "Change Master Password"

   Step 2: Create New Password

   [Input: New Master Password]
   [Password strength: ...]

   [Input: Confirm New Password]

   [Button: Change Password]
   ```

5. **Derive new master key:**
   ```typescript
   // Generate NEW salt
   const newSalt = crypto.getRandomValues(new Uint8Array(16));

   // Derive new master key
   const newMasterKey = await deriveMasterKey(newPassword, newSalt);
   ```

6. **Fetch ALL secrets for user:**
   ```typescript
   const secrets = await fetchAllUserSecrets();
   // Returns encrypted secrets with encrypted DEKs
   ```

7. **Re-encrypt all DEKs (NOT the secret values themselves):**
   ```typescript
   for (const secret of secrets) {
     // Decrypt DEK with OLD master key
     const dek = await decryptDEK(secret.encrypted_dek, currentMasterKey);

     // Re-encrypt DEK with NEW master key
     const newEncryptedDEK = await encryptDEK(dek, newMasterKey);

     // Update secret with new encrypted DEK
     await updateSecretDEK(secret.id, newEncryptedDEK);
   }
   ```

8. **Update salt in database:**
   ```typescript
   UPDATE user_encryption_keys
   SET pbkdf2_salt = newSalt,
       updated_at = NOW()
   WHERE user_id = 'user-uuid';
   ```

9. **Success message:**
   ```
   "Master Password Changed!"

   ✓ All secrets re-encrypted with new password
   ✓ Old password no longer works

   [Button: Generate New Recovery Key]
   [Button: Done]
   ```

10. **Invalidate old session, require new login:**
    ```typescript
    sessionKeyStore.clearMasterKey();
    supabase.auth.signOut();
    // Force re-authentication
    ```

**Success Criteria:** New master key derived, all DEKs re-encrypted, old password no longer works, user logged out

**Error Cases:**
- **Incorrect current password:** "Current password is incorrect."
- **New password too weak:** "New password doesn't meet security requirements."
- **Re-encryption fails mid-process:** "Error re-encrypting secrets. Password change cancelled. Your secrets are safe."
- **Network error during re-encryption:** "Could not complete password change. Please try again with stable connection."

**Note:** Envelope encryption enables efficient master password changes. We only re-encrypt small DEKs (32 bytes each), not large secret values. This completes in seconds even with hundreds of secrets.

---

### Flow 5: Recovery Key Usage ("Forgot Password")

**Trigger:** User clicks "Use recovery key instead" on master password prompt

**Steps:**

1. **User clicks "Use recovery key instead"**

2. **Recovery key upload prompt:**
   ```
   "Recover Access with Recovery Key"

   Upload your recovery key file (abyrith-recovery-key.txt)

   [File Upload: Drag and drop or browse]

   [Button: Cancel]
   ```

3. **User uploads file, browser parses:**
   ```typescript
   const file = uploadedFile;
   const text = await file.text();

   // Parse recovery key file
   const recoveryData = parseRecoveryKeyFile(text);
   // Contains: recovery passphrase, encrypted master key
   ```

4. **Prompt for recovery passphrase:**
   ```
   "Enter Recovery Passphrase"

   Enter the 24-word passphrase from your recovery key.

   [Textarea: Recovery Passphrase]

   [Button: Recover Access]
   ```

5. **User enters passphrase, decrypt master key:**
   ```typescript
   // Derive key from recovery passphrase (BIP39)
   const recoveryKey = await deriveKeyFromMnemonic(passphrase);

   // Decrypt master key
   const masterKey = await crypto.subtle.decrypt(
     { name: 'AES-GCM', iv: recoveryData.nonce },
     recoveryKey,
     recoveryData.encryptedMasterKey
   );

   // Cache master key in session
   sessionKeyStore.setMasterKey(masterKey, sessionDurationMs);
   ```

6. **Success message:**
   ```
   "Access Restored!"

   You can now access your secrets with your recovery key.

   [Button: Continue]

   [Link: Set new master password] (recommended)
   ```

7. **Strongly recommend setting new master password:**
   - Anyone with recovery key file + passphrase has access
   - Changing master password invalidates old recovery key
   - Generate new recovery key after password change

**Success Criteria:** Master key restored from recovery key, user can decrypt secrets, prompted to set new password

**Error Cases:**
- **Invalid file format:** "This doesn't appear to be a valid Abyrith recovery key."
- **Incorrect passphrase:** "Recovery passphrase is incorrect."
- **Decryption fails:** "Could not decrypt recovery key. The file may be corrupted."
- **Recovery key for different account:** "This recovery key is for a different Abyrith account."

---

## Technical Implementation

### Frontend Implementation

**Key Components:**

- **`/components/security/MasterPasswordSetup.tsx`** - Initial master password creation wizard
- **`/components/security/MasterPasswordPrompt.tsx`** - Modal prompt for entering master password
- **`/components/security/RecoveryKeyGenerator.tsx`** - Recovery key generation and download
- **`/components/security/PasswordStrengthIndicator.tsx`** - Visual password strength meter
- **`/components/secrets/EncryptionBadge.tsx`** - Shows encryption status on secret cards
- **`/lib/encryption/EncryptionService.ts`** - Core encryption/decryption logic
- **`/lib/encryption/KeyDerivation.ts`** - PBKDF2 master key derivation
- **`/lib/encryption/RecoveryKey.ts`** - Recovery key generation and parsing
- **`/stores/sessionKeyStore.ts`** - Zustand store for in-memory master key

**State Management:**

**Local state (React useState):**
- Form input values (passwords, recovery phrases)
- UI states (loading, error messages)
- Password visibility toggles

**Global state (Zustand):**
```typescript
interface SessionKeyStore {
  masterKey: CryptoKey | null;
  sessionExpiry: number | null;

  setMasterKey: (key: CryptoKey, durationMs: number) => void;
  getMasterKey: () => CryptoKey | null;
  clearMasterKey: () => void;
  isSessionValid: () => boolean;
}
```

**Server state (React Query):**
- User encryption keys (salt) fetching
- Secret CRUD operations (encrypted)
- Audit log queries

**Key Functions:**

```typescript
// Core encryption service
class EncryptionService {
  /**
   * Derives master key from password using PBKDF2
   * @param password - User's master password
   * @param salt - 16-byte salt (from user_encryption_keys table)
   * @returns Non-extractable CryptoKey for AES-GCM operations
   */
  async deriveMasterKey(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 600000, // OWASP 2023 recommendation
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts secret value using envelope encryption
   * @param plaintext - Secret value to encrypt
   * @param masterKey - User's master key
   * @returns Encrypted secret, encrypted DEK, nonces
   */
  async encryptSecret(
    plaintext: string,
    masterKey: CryptoKey
  ): Promise<EncryptedSecret> {
    // Generate DEK
    const dek = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Encrypt secret with DEK
    const secretNonce = crypto.getRandomValues(new Uint8Array(12));
    const encryptedSecret = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: secretNonce, tagLength: 128 },
      dek,
      new TextEncoder().encode(plaintext)
    );

    // Export and encrypt DEK
    const rawDEK = await crypto.subtle.exportKey('raw', dek);
    const dekNonce = crypto.getRandomValues(new Uint8Array(12));
    const encryptedDEK = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: dekNonce, tagLength: 128 },
      masterKey,
      rawDEK
    );

    return {
      encryptedValue: new Uint8Array(encryptedSecret),
      encryptedDEK: new Uint8Array(encryptedDEK),
      secretNonce,
      dekNonce
    };
  }

  /**
   * Decrypts secret value
   * @param encrypted - Encrypted secret object from server
   * @param masterKey - User's master key
   * @returns Plaintext secret value
   */
  async decryptSecret(
    encrypted: EncryptedSecret,
    masterKey: CryptoKey
  ): Promise<string> {
    // Decrypt DEK
    const rawDEK = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.dekNonce, tagLength: 128 },
      masterKey,
      encrypted.encryptedDEK
    );

    const dek = await crypto.subtle.importKey(
      'raw',
      rawDEK,
      'AES-GCM',
      false,
      ['decrypt']
    );

    // Decrypt secret
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.secretNonce, tagLength: 128 },
      dek,
      encrypted.encryptedValue
    );

    return new TextDecoder().decode(plaintextBuffer);
  }
}
```

### Backend Implementation

**API Endpoints:**

Secrets API endpoints defined in `05-api/endpoints/secrets-endpoints.md` (dependency). Server handles only encrypted blobs.

**Cloudflare Workers (API Gateway):**
```typescript
// Worker cannot decrypt, only validates and forwards
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Authenticate user
    const jwt = request.headers.get('Authorization')?.replace('Bearer ', '');
    const user = await verifyJWT(jwt, env.SUPABASE_JWT_SECRET);

    // Parse request
    const body = await request.json();

    // Validate encrypted blob format (NOT the content, can't decrypt)
    if (!body.encrypted_value || !body.encrypted_dek ||
        !body.secret_nonce || !body.dek_nonce) {
      return new Response('Missing required encryption fields', {
        status: 400
      });
    }

    // Rate limiting
    const rateLimitKey = `ratelimit:secrets:${user.id}`;
    const requests = await env.KV.get(rateLimitKey);
    if (requests && parseInt(requests) > 100) {
      return new Response('Rate limit exceeded', { status: 429 });
    }
    await env.KV.put(rateLimitKey, String((parseInt(requests || '0') + 1)), {
      expirationTtl: 60 // 1 minute
    });

    // Forward to Supabase (we cannot decrypt)
    const supabaseResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/secrets`,
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...body,
          user_id: user.id,
          created_at: new Date().toISOString()
        })
      }
    );

    return supabaseResponse;
  }
};
```

**Supabase Functions:**
- None required for encryption (happens client-side)
- Audit logging handled by PostgreSQL trigger

### Database Implementation

**Tables Used:**

See `04-database/schemas/secrets-metadata.md` (dependency) for full schema.

**Key tables:**
- `user_encryption_keys` - Stores PBKDF2 salt per user
- `secrets` - Stores encrypted values, encrypted DEKs, nonces
- `audit_logs` - Records access events (not decrypted values)

**Key Queries:**

```sql
-- Fetch user's salt for key derivation
SELECT pbkdf2_salt
FROM user_encryption_keys
WHERE user_id = $1;

-- Store encrypted secret
INSERT INTO secrets (
  id, user_id, project_id, environment,
  service_name, key_name,
  encrypted_value, encrypted_dek,
  secret_nonce, dek_nonce,
  tags, created_at
) VALUES (
  gen_random_uuid(), $1, $2, $3,
  $4, $5,
  decode($6, 'base64'), decode($7, 'base64'),
  decode($8, 'base64'), decode($9, 'base64'),
  $10, NOW()
);

-- Retrieve encrypted secret
SELECT
  id, service_name, key_name,
  encode(encrypted_value, 'base64') as encrypted_value,
  encode(encrypted_dek, 'base64') as encrypted_dek,
  encode(secret_nonce, 'base64') as secret_nonce,
  encode(dek_nonce, 'base64') as dek_nonce,
  environment, tags
FROM secrets
WHERE id = $1
  AND user_id = $2; -- RLS enforces this automatically
```

**RLS Policies:**

```sql
-- Users can only access their own secrets
CREATE POLICY "Users access own secrets"
  ON secrets
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only access their own encryption keys
CREATE POLICY "Users access own encryption keys"
  ON user_encryption_keys
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## API Contracts

### Endpoint: POST /api/user-encryption-keys

**Purpose:** Store user's PBKDF2 salt (used for master key derivation)

**Request:**
```typescript
interface CreateEncryptionKeyRequest {
  user_id: string;       // UUID
  pbkdf2_salt: string;   // Base64-encoded 16-byte salt
}
```

**Example Request:**
```json
POST /api/user-encryption-keys
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "pbkdf2_salt": "YWJjZGVmZ2hpamtsbW5vcA=="
}
```

**Response (Success - 201):**
```typescript
interface CreateEncryptionKeyResponse {
  id: string;
  user_id: string;
  pbkdf2_salt: string;
  created_at: string;
}
```

**Example Response:**
```json
{
  "id": "uuid-here",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "pbkdf2_salt": "YWJjZGVmZ2hpamtsbW5vcA==",
  "created_at": "2025-10-30T12:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid salt format
- `401 Unauthorized` - Missing or invalid JWT
- `409 Conflict` - User already has encryption key
- `500 Internal Server Error` - Server error

---

### Endpoint: GET /api/user-encryption-keys

**Purpose:** Retrieve user's PBKDF2 salt for master key derivation

**Request:** No body (user ID from JWT)

**Response (Success - 200):**
```typescript
interface GetEncryptionKeyResponse {
  pbkdf2_salt: string;   // Base64-encoded salt
  created_at: string;
}
```

**Example Response:**
```json
{
  "pbkdf2_salt": "YWJjZGVmZ2hpamtsbW5vcA==",
  "created_at": "2025-10-30T12:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT
- `404 Not Found` - User hasn't set up encryption yet
- `500 Internal Server Error` - Server error

---

### Endpoint: POST /api/secrets

**Purpose:** Store encrypted secret

See `05-api/endpoints/secrets-endpoints.md` for full specification.

**Request:**
```typescript
interface CreateSecretRequest {
  project_id: string;
  environment: 'development' | 'staging' | 'production';
  service_name: string;
  key_name: string;
  encrypted_value: string;    // Base64-encoded
  encrypted_dek: string;      // Base64-encoded
  secret_nonce: string;       // Base64-encoded
  dek_nonce: string;          // Base64-encoded
  tags?: string[];
}
```

**Response:** See API endpoint documentation

---

## Security Considerations

### Threat Model

**Potential Threats:**

1. **Master password theft (keylogger on user's device)**
   - **Mitigation:** Out of scope for web application. Recommend users:
     - Use trusted devices
     - Enable 2FA on Abyrith account
     - Use biometric authentication (future enhancement)
   - **Residual Risk:** High (user device compromise is outside our control)

2. **Recovery key file theft**
   - **Mitigation:**
     - Recovery key file itself is encrypted (requires passphrase)
     - Warn users to store recovery key securely (not in cloud storage)
     - Option to never generate recovery key (user accepts risk)
   - **Residual Risk:** Medium (requires both file + passphrase)

3. **Browser memory scraping attack**
   - **Mitigation:**
     - Master key stored as non-extractable CryptoKey
     - Decrypted secrets cleared from memory immediately after use
     - Session timeout clears master key from memory
   - **Residual Risk:** Low (requires malicious browser extension or sophisticated attack)

4. **Brute-force attack on PBKDF2**
   - **Mitigation:**
     - 600,000 iterations makes brute-force expensive (~$10,000s to crack weak password)
     - Enforce strong password requirements (12+ chars, complexity)
     - Optional 2FA for account access
   - **Residual Risk:** Low with strong passwords, Medium with weak passwords

5. **Nonce reuse (encryption vulnerability)**
   - **Mitigation:**
     - Use CSPRNG for nonce generation (crypto.getRandomValues)
     - 96-bit nonces (2^96 possible values, collision probability negligible)
     - Each secret gets unique nonce
   - **Residual Risk:** Very Low (cryptographically negligible)

### Security Controls

**Authentication:**
- Supabase Auth for account authentication (JWT)
- Master password never sent to server (client-side only)
- Optional 2FA for account access

**Authorization:**
- RLS policies enforce user-level data isolation
- Server validates encrypted blob format (not content)
- Rate limiting per user (100 requests/minute)

**Data Protection:**
- **Client-side:** AES-256-GCM encryption before upload
- **In transit:** TLS 1.3 (HTTPS)
- **At rest:** PostgreSQL encryption (optional, Supabase managed)
- **In memory:** Master key stored as non-extractable CryptoKey object

**Audit Logging:**
- Every secret access logged (not the decrypted value)
- Logs include: timestamp, user, action (read/write/delete), IP, user agent
- Logs retained for 1 year (configurable per organization)

### Compliance

**GDPR:**
- Right to access: Users can export all encrypted data
- Right to deletion: Delete user also deletes all secrets
- Right to portability: Export includes encrypted blobs + salt
- Data minimization: Only store necessary metadata
- Privacy by design: Zero-knowledge architecture

**SOC 2:**
- Security: Zero-knowledge encryption, audit logs, access controls
- Availability: 99.9% uptime SLA (via Cloudflare/Supabase)
- Confidentiality: Server cannot decrypt secrets
- Processing integrity: AES-GCM provides integrity verification

---

## Performance Requirements

### Performance Targets

**Client-side operations:**
- **Master key derivation (PBKDF2):** < 2s (happens once per session)
- **Secret encryption:** < 100ms for secrets up to 1MB
- **Secret decryption:** < 100ms for secrets up to 1MB
- **UI responsiveness:** No blocking during encryption/decryption

**Server-side operations:**
- **API response (excluding crypto):** < 200ms p95
- **Database query:** < 100ms p95
- **Blob storage/retrieval:** < 50ms p95

**Resource Usage:**
- **Memory (client):** ~10MB for encryption service + master key
- **Storage (client):** 0 (master key never persisted)
- **Storage (server):** ~1KB per secret (encrypted blob + metadata)

### Optimization Strategy

**Frontend optimizations:**
- Web Crypto API (hardware-accelerated) for all cryptographic operations
- Master key cached in memory (avoid re-deriving every operation)
- Lazy decryption (only decrypt secrets when viewed)
- Web Workers for PBKDF2 derivation (keep UI responsive)
- Incremental re-encryption during password change (show progress)

**Backend optimizations:**
- Edge workers (Cloudflare) reduce latency
- Database indexes on user_id, project_id for fast queries
- Connection pooling (PgBouncer) for efficient DB access

**Database optimizations:**
- Indexes:
  ```sql
  CREATE INDEX idx_secrets_user_project ON secrets(user_id, project_id);
  CREATE INDEX idx_secrets_environment ON secrets(environment);
  CREATE INDEX idx_user_encryption_keys_user ON user_encryption_keys(user_id);
  ```

### Load Handling

**Expected Load (MVP):**
- 1,000 active users
- Average 50 secrets per user
- 10,000 API requests/day
- Peak: 100 concurrent encryption operations

**Scalability:**
- Client-side encryption scales with user devices (no server bottleneck)
- Cloudflare Workers auto-scale to handle traffic
- Supabase scales PostgreSQL vertically (future: read replicas)

---

## Testing Strategy

### Unit Tests

**Frontend (Vitest + Testing Library):**

**Test: Master key derivation:**
```typescript
describe('EncryptionService.deriveMasterKey', () => {
  it('derives same key from same password and salt', async () => {
    const password = 'test-password-123';
    const salt = new Uint8Array(16).fill(1);

    const key1 = await encryptionService.deriveMasterKey(password, salt);
    const key2 = await encryptionService.deriveMasterKey(password, salt);

    // Keys should be identical (test by encrypting same data)
    const testData = 'test';
    const encrypted1 = await encryptSecret(testData, key1);
    const decrypted = await decryptSecret(encrypted1, key2);

    expect(decrypted).toBe(testData);
  });

  it('derives different keys from different salts', async () => {
    const password = 'test-password-123';
    const salt1 = new Uint8Array(16).fill(1);
    const salt2 = new Uint8Array(16).fill(2);

    const key1 = await encryptionService.deriveMasterKey(password, salt1);
    const key2 = await encryptionService.deriveMasterKey(password, salt2);

    // Keys should be different (decryption with wrong key fails)
    const encrypted = await encryptSecret('test', key1);
    await expect(decryptSecret(encrypted, key2)).rejects.toThrow();
  });
});
```

**Test: Encryption/decryption roundtrip:**
```typescript
describe('EncryptionService encryption', () => {
  it('encrypts and decrypts secret correctly', async () => {
    const plaintext = 'sk_test_abc123xyz';
    const masterKey = await deriveMasterKey('password', salt);

    const encrypted = await encryptionService.encryptSecret(plaintext, masterKey);
    const decrypted = await encryptionService.decryptSecret(encrypted, masterKey);

    expect(decrypted).toBe(plaintext);
  });

  it('fails decryption with wrong master key', async () => {
    const plaintext = 'sk_test_abc123xyz';
    const key1 = await deriveMasterKey('password1', salt);
    const key2 = await deriveMasterKey('password2', salt);

    const encrypted = await encryptionService.encryptSecret(plaintext, key1);

    await expect(
      encryptionService.decryptSecret(encrypted, key2)
    ).rejects.toThrow();
  });

  it('detects tampered ciphertext', async () => {
    const plaintext = 'sk_test_abc123xyz';
    const masterKey = await deriveMasterKey('password', salt);

    const encrypted = await encryptionService.encryptSecret(plaintext, masterKey);

    // Tamper with ciphertext
    encrypted.encryptedValue[0] ^= 0xFF;

    // Decryption should fail (auth tag verification)
    await expect(
      encryptionService.decryptSecret(encrypted, masterKey)
    ).rejects.toThrow();
  });
});
```

**Coverage:** 90%+ for encryption service

**Backend (Vitest):**
- Test input validation (encrypted blob format)
- Test rate limiting logic
- Test RLS policy enforcement

**Coverage:** 80%+ for API endpoints

### Integration Tests

**Test Scenarios:**

1. **End-to-end encryption flow:**
   - Create master password
   - Encrypt secret client-side
   - Store on server
   - Retrieve encrypted blob
   - Decrypt client-side
   - Verify plaintext matches

2. **Master password change:**
   - Create secrets with password1
   - Change to password2
   - Verify all secrets decrypt with password2
   - Verify password1 no longer works

3. **Recovery key flow:**
   - Generate recovery key
   - "Forget" master password
   - Restore access with recovery key
   - Decrypt secrets successfully

4. **Session timeout:**
   - Decrypt secret (master key cached)
   - Wait for session timeout
   - Attempt decryption (should prompt for password)

### End-to-End Tests

**E2E Flows (Playwright):**

```typescript
test('First-time user creates master password and encrypts secret', async ({ page }) => {
  // Sign up
  await page.goto('/signup');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'account-password');
  await page.click('button[type="submit"]');

  // Master password setup
  await expect(page.locator('text=Create a master password')).toBeVisible();
  await page.fill('[name="masterPassword"]', 'strong-master-password-123!');
  await expect(page.locator('text=Strong')).toBeVisible();
  await page.check('[name="understand"]');
  await page.click('text=Create Master Password');

  // Add secret
  await page.click('text=Add Your First Secret');
  await page.fill('[name="keyName"]', 'TEST_API_KEY');
  await page.fill('[name="value"]', 'sk_test_abc123xyz');
  await page.click('text=Save Secret');

  // Verify success
  await expect(page.locator('text=Secret Saved!')).toBeVisible();
  await expect(page.locator('text=Only you can decrypt')).toBeVisible();

  // Verify encrypted value not visible in network requests
  const response = await page.waitForResponse(resp => resp.url().includes('/api/secrets'));
  const body = await response.json();
  expect(body.encrypted_value).toBeDefined();
  expect(body.encrypted_value).not.toContain('sk_test');
});

test('User views secret with master password prompt', async ({ page, context }) => {
  // ... setup (user with existing secret)

  // Clear session (simulate new browser session)
  await context.clearCookies();
  await page.reload();

  // View secret
  await page.click('text=TEST_API_KEY');

  // Master password prompt
  await expect(page.locator('text=Enter Master Password')).toBeVisible();
  await page.fill('[name="masterPassword"]', 'strong-master-password-123!');
  await page.click('text=Decrypt');

  // Verify decrypted secret visible
  await expect(page.locator('text=sk_test_abc123xyz')).toBeVisible();
});
```

### Security Tests

**Security Test Cases:**

1. **Brute-force protection:**
   - Test rate limiting (100 requests/minute)
   - Verify lockout after N failed attempts

2. **Encryption strength:**
   - Verify 600k PBKDF2 iterations
   - Verify AES-256-GCM used
   - Verify unique nonces per encryption

3. **Data isolation:**
   - Create secrets as user A
   - Attempt access as user B (should fail via RLS)

4. **XSS prevention:**
   - Inject script tags in secret values
   - Verify they're escaped when rendered

5. **CSRF protection:**
   - Attempt state-changing requests without CSRF token
   - Verify requests blocked

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/security-model.md` - Zero-knowledge architecture specification
- [ ] `05-api/endpoints/secrets-endpoints.md` - API endpoint specifications (in progress)
- [ ] `04-database/schemas/secrets-metadata.md` - Database schema (in progress)

**External Services:**
- Web Crypto API (browser standard, no external dependency)
- Supabase Auth (JWT authentication)
- Supabase PostgreSQL (database)
- Cloudflare Workers (API gateway)

### Feature Dependencies

**Depends on these features:**
- None (foundational feature)

**Enables these features:**
- All secret management features (this is the foundation)
- Team sharing (uses envelope encryption for multi-user access)
- MCP integration (decrypts secrets for AI tools after approval)
- Audit logs (records access without exposing decrypted values)

---

## References

### Internal Documentation
- `03-security/security-model.md` - Comprehensive security architecture
- `TECH-STACK.md` - Web Crypto API, React, Supabase specifications
- `GLOSSARY.md` - Term definitions (Zero-Knowledge, Master Password, etc.)
- `01-product/product-vision-strategy.md` - Product context and personas

### External Resources
- [Web Crypto API Specification](https://www.w3.org/TR/WebCryptoAPI/) - W3C standard
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - PBKDF2 recommendations
- [NIST SP 800-132](https://csrc.nist.gov/publications/detail/sp/800-132/final) - Key derivation best practices
- [AES-GCM Security](https://csrc.nist.gov/publications/detail/sp/800-38d/final) - NIST guidance on AES-GCM
- [BIP39 Mnemonic Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) - Recovery key passphrases

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial feature documentation for zero-knowledge encryption UX flow |

---

## Notes

### Future Enhancements
- **WebAuthn integration:** Passwordless authentication using biometrics (Phase 3)
- **Hardware security key support:** YubiKey for 2FA (Phase 3)
- **Mobile app:** Native iOS/Android with Keychain/Keystore integration (Phase 4)
- **Secure password sharing:** Temporary one-time links (Phase 4)

### Known Limitations
- Master password loss = unrecoverable secrets (necessary trade-off for zero-knowledge)
- PBKDF2 derivation adds 1-2s latency on first session access (acceptable for security)
- JavaScript cannot guarantee secure memory wiping (OS-level concern, mitigated by non-extractable keys)
- Recovery key file must be stored securely by user (we cannot recover if lost)

### User Education Priorities
1. Master password importance (cannot be recovered)
2. Recovery key backup (recommended but optional)
3. Never share master password (even with team members)
4. What zero-knowledge means (we can't see your secrets)
5. Why this trade-off matters (security vs. convenience)
