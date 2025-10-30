---
Document: Password Reset - Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/zero-knowledge-architecture.md, 03-security/auth/authentication-flow.md, GLOSSARY.md
---

# Password Reset Architecture

## Overview

This document defines the password reset flows for Abyrith, maintaining zero-knowledge encryption principles while providing account recovery options. Abyrith has a dual-password system: an **account password** (for authentication, can be reset) and a **master password** (for encryption, cannot be reset without data loss). Understanding this distinction is critical to Abyrith's security model and user experience.

**Purpose:** Define secure password reset mechanisms that balance usability with zero-knowledge security guarantees. Users must understand the implications of forgetting their master password.

**Scope:** Account password reset (Supabase Auth), master password implications, recovery key mechanisms, secret re-encryption flows, and user communication strategies.

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

Abyrith uses a dual-password system to maintain zero-knowledge encryption:
- **Account Password:** Used for authentication (Supabase Auth). Can be reset via email verification.
- **Master Password:** Used to derive encryption keys for secrets. Never transmitted to server, never stored anywhere.

If a user forgets their account password, it's a simple reset. If they forget their master password, their encrypted secrets become permanently inaccessible—this is by design for zero-knowledge security.

**Pain points:**
- Users confuse account password with master password
- Forgetting master password means permanent data loss (scary for users)
- Password reset must be clearly different for account vs. master passwords
- Need to provide recovery options without compromising zero-knowledge
- Must communicate consequences clearly ("forget master password = lose all secrets")

**Why now?**

Password reset is essential for MVP. Users will forget passwords. We need to handle this gracefully while maintaining security guarantees.

### Background

**Existing system:**

Greenfield implementation. No existing password reset system.

**Previous attempts:**

N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| End Users | Recover access if they forget password | "What happens if I forget my master password?" |
| Security Lead | Maintain zero-knowledge guarantees | Master password reset must not compromise security |
| Support Team | Minimize support burden | Users will contact support when they lose master password (nothing we can do) |
| Product Team | Balance security and usability | Must clearly communicate master password implications |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Easy account password reset** - Standard email verification flow (success metric: < 5 minutes to complete reset)
2. **Clear master password implications** - Users understand that forgetting master password = data loss (success metric: < 10% of users contact support about master password recovery)
3. **Recovery key option** - Users can download a recovery key at signup that can restore master password access (success metric: 80%+ of users download recovery key)
4. **Master password change** - Users can change master password if they know the current one, triggering secret re-encryption (success metric: Complete re-encryption within 5 minutes for 100 secrets)

**Secondary goals:**
- Audit trail of password reset events
- Rate limiting to prevent password reset abuse
- Clear UI distinctions between account and master password
- Recovery key storage guidance (print, password manager, secure file)

### Non-Goals

**Explicitly out of scope:**
- **Server-side master password recovery** - Impossible in zero-knowledge architecture
- **Social recovery for master password** - Too complex for MVP
- **Automated secret re-encryption without user** - Requires server to have encryption keys (breaks zero-knowledge)
- **Master password reset via support** - Would require support to have access to encryption keys (impossible)

### Success Metrics

**How we measure success:**
- **Account Reset Completion:** 95%+ of account password resets complete within 5 minutes
- **Master Password Understanding:** < 10% of users contact support expecting master password recovery
- **Recovery Key Adoption:** 80%+ of new users download recovery key
- **Re-encryption Success:** 99%+ of master password changes complete without data loss

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Password Reset Types                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACCOUNT PASSWORD RESET                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. User clicks "Forgot account password?"           │  │
│  │  2. Supabase sends reset email                       │  │
│  │  3. User clicks link, sets new account password      │  │
│  │  4. ✅ Access restored (secrets still encrypted)     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  MASTER PASSWORD FORGOTTEN (NO RECOVERY KEY)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. User forgot master password                      │  │
│  │  2. ❌ NO SERVER-SIDE RECOVERY POSSIBLE              │  │
│  │  3. All secrets permanently inaccessible             │  │
│  │  4. Option: Delete account and start fresh           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  MASTER PASSWORD RECOVERY (WITH RECOVERY KEY)               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. User forgot master password                      │  │
│  │  2. User has recovery key (generated at signup)      │  │
│  │  3. Recovery key derives alternate master key        │  │
│  │  4. ✅ Access restored, can set new master password  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  MASTER PASSWORD CHANGE (KNOWS CURRENT PASSWORD)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. User enters current master password              │  │
│  │  2. User enters new master password                  │  │
│  │  3. All secrets re-encrypted with new key            │  │
│  │  4. ✅ Master password updated                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Account Password Reset (Supabase Auth)**
- **Purpose:** Reset account authentication password via email verification
- **Technology:** Supabase Auth built-in password reset
- **Responsibilities:**
  - Send password reset email with secure token
  - Verify token validity (expiration, single-use)
  - Update account password hash in database
  - No impact on master password or encrypted secrets

**Component 2: Master Password Recovery Key System**
- **Purpose:** Provide user-controlled recovery mechanism for forgotten master passwords
- **Technology:** Web Crypto API, client-side key derivation
- **Responsibilities:**
  - Generate recovery key at signup (separate from master password)
  - Derive alternate encryption key from recovery key
  - Allow user to restore access using recovery key
  - Store recovery key client-side only (never transmitted)

**Component 3: Master Password Change with Re-Encryption**
- **Purpose:** Allow users to change master password by re-encrypting all secrets
- **Technology:** Web Crypto API, client-side batch decryption/encryption
- **Responsibilities:**
  - Verify current master password
  - Decrypt all secrets with old master key
  - Encrypt all secrets with new master key
  - Update encrypted secret blobs in database
  - Atomic operation (all or nothing)

**Component 4: User Education & Warnings**
- **Purpose:** Clearly communicate password reset options and implications
- **Technology:** React UI components, tooltips, warning modals
- **Responsibilities:**
  - Distinguish account password from master password in UI
  - Warn users about master password implications at signup
  - Display recovery key with storage instructions
  - Show clear error messages when master password is incorrect

### Component Interactions

**User ↔ Frontend:**
- Protocol: React UI interactions
- Data flow: User input (passwords) → Frontend validation → Server/encryption actions

**Frontend ↔ Supabase Auth:**
- Protocol: HTTPS (REST API)
- Data flow: Password reset requests, email verification, account password updates

**Frontend ↔ Database (for re-encryption):**
- Protocol: HTTPS (Supabase API)
- Data flow: Fetch encrypted secrets → Decrypt client-side → Re-encrypt → Update database

---

## Component Details

### Component: Account Password Reset (Supabase Auth)

**Purpose:** Handle standard account authentication password reset using email verification.

**Responsibilities:**
- Send password reset email to user's registered email
- Generate secure, single-use reset token with expiration
- Verify token when user clicks reset link
- Allow user to set new account password
- Update password hash in `auth.users` table
- No interaction with master password or secret encryption

**Technology Stack:**
- Supabase Auth (PostgreSQL 15.x backend)
- Email delivery via Supabase (configurable SMTP)
- JWT token for reset authentication

**Internal Architecture:**

```typescript
// Account Password Reset Flow
async function requestAccountPasswordReset(email: string): Promise<void> {
  // Supabase Auth handles email sending
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://app.abyrith.com/auth/reset-password'
  });

  if (error) {
    throw new Error('Failed to send reset email');
  }

  // Email sent with secure token link
  // Token valid for 1 hour (Supabase default)
}

async function updateAccountPassword(
  resetToken: string,
  newPassword: string
): Promise<void> {
  // Verify token and update password
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error('Failed to update password');
  }

  // Account password updated
  // Master password and secrets unaffected
}
```

**Configuration:**
```typescript
interface AccountPasswordResetConfig {
  tokenExpirationMinutes: 60;      // Reset token valid for 1 hour
  emailTemplate: string;            // Customizable email template
  rateLimitPerHour: 3;             // Max 3 reset requests per hour per email
  minimumPasswordLength: 12;        // Password strength requirement
}
```

**Important:** Account password reset does NOT affect:
- Master password (still required for decryption)
- Encrypted secrets (remain encrypted with master key)
- Recovery key (unchanged)

---

### Component: Master Password Recovery Key System

**Purpose:** Provide a user-controlled, offline recovery mechanism for forgotten master passwords.

**Responsibilities:**
- Generate cryptographically random recovery key at signup
- Derive alternate master key from recovery key
- Store recovery key client-side only (never sent to server)
- Allow user to restore access using recovery key
- Enable master password reset after recovery

**Technology Stack:**
- Web Crypto API (`crypto.getRandomValues`)
- PBKDF2 for key derivation from recovery key
- Base64 encoding for human-readable recovery key
- Optional: QR code generation for easy transfer

**Recovery Key Generation:**

```typescript
// Generate recovery key at signup
async function generateRecoveryKey(userId: string): Promise<RecoveryKey> {
  // Generate 256-bit random key
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));

  // Encode as base64 for readability
  const recoveryKeyString = btoa(String.fromCharCode(...randomBytes));

  // Derive encryption key from recovery key
  const recoveryMasterKey = await deriveKeyFromRecoveryKey(
    recoveryKeyString,
    userId // User ID as salt
  );

  return {
    recoveryKeyString,       // Show to user, prompt to save
    recoveryMasterKey        // Store in memory for initial encryption
  };
}

async function deriveKeyFromRecoveryKey(
  recoveryKey: string,
  salt: string
): Promise<CryptoKey> {
  // Import recovery key as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(recoveryKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive master key using PBKDF2
  const masterKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 600000, // Same as master password
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return masterKey;
}
```

**Recovery Key Usage (User Forgot Master Password):**

```typescript
async function recoverWithRecoveryKey(
  userId: string,
  recoveryKey: string
): Promise<MasterKeyRestored> {
  try {
    // 1. Derive master key from recovery key
    const recoveredMasterKey = await deriveKeyFromRecoveryKey(
      recoveryKey,
      userId
    );

    // 2. Verify key is correct by attempting to decrypt a test secret
    const testSecret = await fetchTestSecret(userId);
    await decrypt(testSecret.encrypted_value, recoveredMasterKey);

    // 3. Success! Master key restored
    return {
      masterKey: recoveredMasterKey,
      canSetNewMasterPassword: true
    };
  } catch (error) {
    throw new Error('Invalid recovery key or corrupted data');
  }
}
```

**Recovery Key Storage Options:**

Users are presented with these options at signup:
1. **Download as file** - `abyrith-recovery-key-[user-id].txt`
2. **Print to paper** - Physical backup
3. **Copy to password manager** - 1Password, Bitwarden, etc.
4. **Save to secure notes** - Apple Notes (encrypted), Google Keep
5. **Email to self** (optional, less secure) - User's responsibility

**Warning UI:**
```
⚠️ CRITICAL: Save Your Recovery Key

Your recovery key is the ONLY way to restore access if you forget
your master password.

- Abyrith cannot recover your master password
- Without your recovery key, your secrets are permanently lost
- Keep it safe but accessible

✅ Download recovery key
✅ Print recovery key
✅ Copy to password manager

[I have saved my recovery key] (required to proceed)
```

---

### Component: Master Password Change with Re-Encryption

**Purpose:** Allow users to change their master password by re-encrypting all secrets with a new key.

**Responsibilities:**
- Verify user knows current master password
- Decrypt all secrets using current master key
- Encrypt all secrets using new master key
- Update encrypted blobs in database atomically
- Handle re-encryption errors gracefully
- Generate audit log entry

**Re-Encryption Process:**

```typescript
async function changeMasterPassword(
  currentMasterPassword: string,
  newMasterPassword: string,
  userId: string
): Promise<ReEncryptionResult> {
  // 1. Verify current master password
  const currentMasterKey = await deriveMasterKey(currentMasterPassword, userId);

  // Test decryption to verify password is correct
  try {
    const testSecret = await fetchTestSecret(userId);
    await decrypt(testSecret.encrypted_value, currentMasterKey);
  } catch (error) {
    throw new Error('Current master password is incorrect');
  }

  // 2. Derive new master key
  const newMasterKey = await deriveMasterKey(newMasterPassword, userId);

  // 3. Fetch all user's secrets
  const secrets = await fetchAllUserSecrets(userId);

  // 4. Re-encrypt all secrets (batch operation)
  const reEncryptionTasks = secrets.map(async (secret) => {
    try {
      // Decrypt with old key
      const plaintext = await decrypt(secret.encrypted_value, currentMasterKey);

      // Encrypt with new key
      const newEncrypted = await encrypt(plaintext, newMasterKey);

      return {
        id: secret.id,
        encrypted_value: newEncrypted.ciphertext,
        nonce: newEncrypted.nonce,
        success: true
      };
    } catch (error) {
      return {
        id: secret.id,
        error: error.message,
        success: false
      };
    }
  });

  // 5. Execute all re-encryptions in parallel
  const results = await Promise.all(reEncryptionTasks);

  // 6. Check if all succeeded
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    throw new Error(`Failed to re-encrypt ${failures.length} secrets`);
  }

  // 7. Update database (atomic transaction)
  await updateSecretsInTransaction(results);

  // 8. Update recovery key (optional)
  const newRecoveryKey = await generateRecoveryKey(userId);

  return {
    secretsReEncrypted: results.length,
    newRecoveryKey: newRecoveryKey.recoveryKeyString,
    masterPasswordChanged: true
  };
}
```

**Database Update (Atomic Transaction):**

```sql
-- PostgreSQL transaction to update all secrets atomically
BEGIN;

-- Update each secret's encrypted value
UPDATE secrets
SET
  encrypted_value = $1,
  nonce = $2,
  updated_at = now()
WHERE id = $3;

-- Repeat for all secrets...

-- If any update fails, rollback entire transaction
COMMIT; -- or ROLLBACK on error
```

**Performance Considerations:**

- **Batch size:** Re-encrypt 100 secrets at a time (prevent memory issues)
- **Progress indicator:** Show "Re-encrypting secrets... 45/100"
- **Timeout:** Allow up to 5 minutes for large secret collections
- **Rollback:** If re-encryption fails, keep old master password (no changes saved)

---

### Component: User Education & Warnings

**Purpose:** Clearly communicate the implications of password types and reset options.

**Warning Messages:**

**At Signup:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔐 Create Your Master Password                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Your master password encrypts your secrets.             │
│                                                         │
│ IMPORTANT:                                              │
│ • Abyrith CANNOT recover your master password          │
│ • If you forget it, your secrets are PERMANENTLY LOST  │
│ • Save your recovery key (shown next) as backup        │
│                                                         │
│ Master Password: [___________________________]          │
│ (min 16 characters)                                     │
│                                                         │
│ Confirm: [___________________________]                  │
│                                                         │
│ [Continue] [Learn More About Master Passwords]          │
└─────────────────────────────────────────────────────────┘
```

**Recovery Key Download:**
```
┌─────────────────────────────────────────────────────────┐
│ 💾 Save Your Recovery Key                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Your recovery key: XyZ9...abc123 (32 characters)        │
│                                                         │
│ This key can restore access if you forget your master  │
│ password. Keep it safe but accessible.                  │
│                                                         │
│ ✅ Recommended Options:                                 │
│ • Download as file                                      │
│ • Print to paper                                        │
│ • Save in password manager (1Password, Bitwarden)       │
│                                                         │
│ ⚠️  Do NOT:                                              │
│ • Store in email (unless encrypted)                     │
│ • Share with anyone (including Abyrith support)         │
│ • Store on same device as master password               │
│                                                         │
│ [Download] [Print] [Copy to Clipboard]                  │
│                                                         │
│ ☐ I have saved my recovery key securely                 │
│                                                         │
│ [Continue to Dashboard]                                 │
└─────────────────────────────────────────────────────────┘
```

**Forgot Master Password (No Recovery Key):**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Master Password Cannot Be Reset                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Unfortunately, if you've forgotten your master password │
│ and don't have your recovery key, we cannot help.       │
│                                                         │
│ Why?                                                    │
│ Abyrith uses zero-knowledge encryption. We never have   │
│ access to your master password or encryption keys.      │
│                                                         │
│ This means:                                             │
│ ✅ Your secrets are private (we can't read them)        │
│ ❌ We can't reset your master password                  │
│                                                         │
│ Your options:                                           │
│ 1. Try to remember your master password                │
│ 2. Use your recovery key (if you saved it)             │
│ 3. Delete account and start fresh (all data lost)       │
│                                                         │
│ [Try Again] [Use Recovery Key] [Contact Support]        │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Flow 1: Account Password Reset (Standard Email Flow)

**Trigger:** User clicks "Forgot account password?" on login page

**Steps:**

1. **User Initiates Reset**
   ```typescript
   // User enters email on reset page
   const email = 'user@example.com';
   ```

2. **Frontend Requests Reset Email**
   ```typescript
   await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: 'https://app.abyrith.com/auth/reset-password'
   });
   ```

3. **Supabase Sends Email**
   - Email contains: "Reset your Abyrith account password"
   - Link: `https://app.abyrith.com/auth/reset-password?token=abc123&type=recovery`
   - Token valid for 1 hour

4. **User Clicks Email Link**
   - Browser opens reset page
   - Token extracted from URL

5. **Frontend Verifies Token & Prompts for New Password**
   ```typescript
   // Supabase automatically verifies token from URL
   const { data: { user } } = await supabase.auth.getUser();

   if (!user) {
     throw new Error('Invalid or expired reset link');
   }

   // Show password input form
   ```

6. **User Enters New Account Password**
   ```typescript
   const newPassword = 'newSecurePassword123!';

   // Validate password strength
   if (newPassword.length < 12) {
     throw new Error('Password must be at least 12 characters');
   }
   ```

7. **Frontend Updates Password**
   ```typescript
   const { error } = await supabase.auth.updateUser({
     password: newPassword
   });

   if (error) {
     throw new Error('Failed to update password');
   }

   // Success! Account password updated
   ```

8. **User Re-Authenticates**
   - Redirect to login page
   - User logs in with new account password
   - Must still enter master password to access secrets

**Sequence Diagram:**
```
User        Frontend    Supabase Auth    Email Service    Database
  |             |               |               |             |
  |--forgot---->|               |               |             |
  |  password   |               |               |             |
  |             |               |               |             |
  |             |--reset------->|               |             |
  |             |  request      |               |             |
  |             |               |               |             |
  |             |               |--generate-----|------------>|
  |             |               |  token        |  store      |
  |             |               |               |  token      |
  |             |               |<--------------|<------------|
  |             |               |               |             |
  |             |               |--send-------->|             |
  |             |               |  email        |             |
  |             |               |               |--deliver--->|
  |<------------|<--------------|<--------------|  email      |
  |  (email)    |               |               |             |
  |             |               |               |             |
  |--click----->|               |               |             |
  |  link       |               |               |             |
  |             |               |               |             |
  |             |--verify------>|               |             |
  |             |  token        |               |             |
  |             |               |--check------->|             |
  |             |               |  token        |             |
  |             |               |<--valid-------|             |
  |             |<--verified----|               |             |
  |             |               |               |             |
  |--new------->|               |               |             |
  |  password   |               |               |             |
  |             |               |               |             |
  |             |--update------>|               |             |
  |             |  password     |               |             |
  |             |               |--hash---------|------------>|
  |             |               |  store        |  update     |
  |             |               |<--------------|<------------|
  |             |<--success-----|               |             |
  |<--success---|               |               |             |
```

**Data Transformations:**
- **Point A (User input):** Email address (plaintext)
- **Point B (Token):** Secure random token, single-use, 1-hour expiration
- **Point C (New password):** Hashed with bcrypt before storage
- **Point D (Database):** Only password hash stored, never plaintext

**Important:** Master password is NOT affected by this flow.

---

### Flow 2: Master Password Recovery Using Recovery Key

**Trigger:** User forgot master password but has recovery key saved

**Steps:**

1. **User Indicates Master Password Forgotten**
   ```typescript
   // On login, user enters correct account password
   // But enters incorrect master password
   // System detects: "Master password incorrect. Use recovery key?"
   ```

2. **User Enters Recovery Key**
   ```typescript
   const recoveryKey = 'XyZ9pQrS7tUvWxYz...'; // 32-character key
   ```

3. **Frontend Derives Master Key from Recovery Key**
   ```typescript
   const recoveredMasterKey = await deriveKeyFromRecoveryKey(
     recoveryKey,
     user.id
   );
   ```

4. **Frontend Verifies Recovery Key is Correct**
   ```typescript
   // Attempt to decrypt a test secret
   try {
     const testSecret = await fetchTestSecret(user.id);
     await decrypt(testSecret.encrypted_value, recoveredMasterKey);
     // Success! Recovery key is valid
   } catch (error) {
     throw new Error('Invalid recovery key');
   }
   ```

5. **User Prompted to Set New Master Password**
   ```typescript
   // Now that we have recovered the master key,
   // user can set a new master password
   const newMasterPassword = 'myNewMasterPassword2024!';

   // Re-encrypt all secrets with new master password
   await changeMasterPassword(
     null, // No current password (using recovered key)
     newMasterPassword,
     user.id,
     recoveredMasterKey // Use recovered key for decryption
   );
   ```

6. **All Secrets Re-Encrypted**
   - Decrypt with recovered master key
   - Encrypt with new master key
   - Update database

7. **New Recovery Key Generated**
   ```typescript
   const newRecoveryKey = await generateRecoveryKey(user.id);
   // Show to user: "Save your new recovery key"
   ```

8. **Success**
   - Master password changed
   - Access restored
   - User logs in with new master password

**Sequence Diagram:**
```
User          Frontend      Database
  |               |             |
  |--forgot------>|             |
  |  master pw    |             |
  |               |             |
  |--recovery---->|             |
  |  key          |             |
  |               |             |
  |               |--derive-----|
  |               | (client)    |
  |               |             |
  |               |--test------>|
  |               | decrypt     |
  |               |<--secret----|
  |               |             |
  |               |--decrypt----|
  |               | (client)    |
  |               | ✅ valid    |
  |               |             |
  |--new--------->|             |
  |  master pw    |             |
  |               |             |
  |               |--fetch----->|
  |               | all secrets |
  |               |<--secrets---|
  |               |             |
  |               |--decrypt----|
  |               | re-encrypt  |
  |               | (client)    |
  |               |             |
  |               |--update---->|
  |               | encrypted   |
  |               | secrets     |
  |               |<--success---|
  |               |             |
  |<--restored----|             |
  |  access       |             |
```

---

### Flow 3: Master Password Change (User Knows Current Password)

**Trigger:** User wants to change master password proactively

**Steps:**

1. **User Navigates to Security Settings**
   ```typescript
   // User clicks "Change Master Password" in settings
   ```

2. **User Enters Current Master Password**
   ```typescript
   const currentMasterPassword = 'myOldMasterPassword123!';
   ```

3. **Frontend Verifies Current Master Password**
   ```typescript
   const currentMasterKey = await deriveMasterKey(currentMasterPassword, user.id);

   // Test decryption
   try {
     const testSecret = await fetchTestSecret(user.id);
     await decrypt(testSecret.encrypted_value, currentMasterKey);
   } catch (error) {
     throw new Error('Current master password is incorrect');
   }
   ```

4. **User Enters New Master Password**
   ```typescript
   const newMasterPassword = 'myNewMasterPassword2024!';

   // Validate strength
   if (newMasterPassword.length < 16) {
     throw new Error('Master password must be at least 16 characters');
   }
   ```

5. **Frontend Initiates Re-Encryption**
   ```typescript
   // Show progress UI: "Re-encrypting secrets... 0/100"

   await changeMasterPassword(
     currentMasterPassword,
     newMasterPassword,
     user.id
   );
   ```

6. **All Secrets Re-Encrypted**
   - Decrypt with old master key: 0.05s per secret
   - Encrypt with new master key: 0.05s per secret
   - Total: ~10 seconds for 100 secrets
   - Progress shown to user

7. **Database Updated Atomically**
   ```sql
   BEGIN;
   -- Update all secrets in single transaction
   UPDATE secrets SET encrypted_value = $1, nonce = $2 WHERE id = $3;
   -- ...repeat for all secrets
   COMMIT;
   ```

8. **New Recovery Key Generated**
   ```typescript
   const newRecoveryKey = await generateRecoveryKey(user.id);
   ```

9. **Success**
   - User shown new recovery key
   - Prompted to save new recovery key
   - Master password changed
   - All secrets re-encrypted

**Important Error Handling:**

If re-encryption fails partway through:
- **Rollback:** Database transaction rolls back (no changes saved)
- **User state:** Old master password still valid
- **Retry:** User can try again
- **Audit:** Log failure for investigation

---

## API Contracts

### API: Account Password Reset Request

**Endpoint:** `POST /auth/v1/recover` (Supabase Auth)

**Purpose:** Send password reset email to user

**Request:**
```typescript
interface PasswordResetRequest {
  email: string;
  redirectTo?: string; // Optional redirect URL after reset
}
```

**Example:**
```json
POST /auth/v1/recover
{
  "email": "user@example.com",
  "redirectTo": "https://app.abyrith.com/auth/reset-password"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset email sent"
}
```

**Note:** Always returns 200 even if email doesn't exist (security best practice - no user enumeration).

---

### API: Update Account Password

**Endpoint:** `PUT /auth/v1/user` (Supabase Auth)

**Purpose:** Update user's account password after verification

**Request:**
```typescript
interface UpdatePasswordRequest {
  password: string; // New password (min 12 characters)
}
```

**Example:**
```json
PUT /auth/v1/user
Authorization: Bearer {reset_token_from_email}
{
  "password": "newSecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Error Responses:**
- `400` - Password too weak
- `401` - Invalid or expired reset token
- `422` - Validation error

---

### API: Fetch All User Secrets (for Re-Encryption)

**Endpoint:** `GET /v1/secrets?user_id={user_id}&include_encrypted=true`

**Purpose:** Fetch all encrypted secrets for client-side re-encryption

**Request:** Standard authenticated GET request

**Response (200 OK):**
```typescript
interface BulkSecretsResponse {
  secrets: Array<{
    id: string;
    encrypted_value: string; // Base64 ciphertext
    nonce: string;           // Base64 nonce
    algorithm: 'AES-256-GCM';
  }>;
  count: number;
}
```

**Example:**
```json
{
  "secrets": [
    {
      "id": "uuid-1",
      "encrypted_value": "base64...",
      "nonce": "base64...",
      "algorithm": "AES-256-GCM"
    },
    // ... more secrets
  ],
  "count": 100
}
```

---

### API: Bulk Update Encrypted Secrets

**Endpoint:** `PATCH /v1/secrets/bulk-update`

**Purpose:** Update multiple secrets' encrypted values atomically

**Request:**
```typescript
interface BulkUpdateRequest {
  updates: Array<{
    id: string;
    encrypted_value: string; // New ciphertext
    nonce: string;           // New nonce
  }>;
}
```

**Response (200 OK):**
```json
{
  "updated": 100,
  "failed": 0
}
```

**Error Responses:**
- `400` - Invalid request format
- `403` - User doesn't own these secrets
- `409` - Concurrent modification detected (retry)

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Password Reset Email**
- **Threats:** Email interception, unauthorized reset requests
- **Controls:**
  - Reset token valid for 1 hour only
  - Single-use token (invalidated after use)
  - Rate limiting (3 reset requests per hour per email)
  - HTTPS-only reset links
  - No user enumeration (always return success)

**Boundary 2: Recovery Key Storage**
- **Threats:** Recovery key theft, unauthorized access
- **Controls:**
  - User responsible for secure storage
  - Clear guidance on storage options
  - Never sent to server (client-only)
  - Separate from master password
  - Can be regenerated after master password change

**Boundary 3: Master Password Re-Encryption**
- **Threats:** Data loss during re-encryption, unauthorized change
- **Controls:**
  - Atomic database transaction (all or nothing)
  - Verify current master password before allowing change
  - Progress indicator prevents premature cancellation
  - Audit log of master password changes
  - Rate limiting (max 1 change per hour)

### Authentication & Authorization

**Account Password Reset:**
- Requires: Access to email account
- No authentication needed to request reset
- Token in email authenticates the reset action

**Master Password Change:**
- Requires: Current master password OR valid recovery key
- Authenticated session required
- Additional verification recommended (email confirmation)

**Recovery Key Usage:**
- Requires: Authenticated session + valid recovery key
- No rate limiting (user can try unlimited times with correct account auth)

### Data Security

**Password Storage:**
- **Account password:** Hashed with bcrypt (server-side)
- **Master password:** Never stored anywhere
- **Recovery key:** Never stored server-side (client-only)

**Reset Token Security:**
- Random, cryptographically secure token (32 bytes)
- Single-use (invalidated after use)
- Short expiration (1 hour)
- Stored hashed in database

**Re-Encryption Security:**
- All decryption happens client-side
- Plaintext never sent to server
- Atomic transaction prevents partial re-encryption
- Old encrypted values kept until transaction commits

### Threat Model

**Threat 1: Account Password Reset Abuse**
- **Likelihood:** Medium (common attack vector)
- **Impact:** Medium (can access account but not decrypt secrets without master password)
- **Mitigation:** Rate limiting, email verification, MFA option

**Threat 2: Recovery Key Theft**
- **Likelihood:** Low (user-controlled storage)
- **Impact:** Critical (can recover master key and access secrets)
- **Mitigation:** User education, separate storage from account password, optional deletion after use

**Threat 3: Re-Encryption Failure Leading to Data Loss**
- **Likelihood:** Very Low (atomic transactions)
- **Impact:** Critical (could lose access to secrets)
- **Mitigation:** Atomic database transactions, rollback on failure, pre-flight checks

**Threat 4: Forgotten Master Password with No Recovery Key**
- **Likelihood:** Medium (users forget to save recovery key)
- **Impact:** Critical for user (permanent data loss)
- **Mitigation:** Mandatory recovery key download at signup, multiple save options, clear warnings

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Account password reset email: < 5 seconds to send
- Account password update: < 1 second
- Master password re-encryption (100 secrets): < 30 seconds
- Recovery key derivation: < 3 seconds

**Throughput:**
- Password reset requests: 1000/minute (global)
- Re-encryption operations: 10 concurrent users

**Resource Usage:**
- Re-encryption memory: < 100MB for 1000 secrets
- Client CPU: High during re-encryption (expected)

### Performance Optimization

**Re-Encryption Optimizations:**
- Batch processing (100 secrets at a time)
- Parallel decryption/encryption where possible
- Progress indicator to prevent user from canceling prematurely
- Database transaction batching

**Email Delivery:**
- Async email sending (doesn't block API response)
- Email queue for reliability
- Retry logic for failed deliveries

---

## Scalability

### Horizontal Scaling

**Email service:** Supabase handles email delivery scalability
**Database updates:** PostgreSQL handles concurrent re-encryption operations

### Vertical Scaling

**Database:** Can scale PostgreSQL instance if re-encryption operations become bottleneck

### Bottlenecks

**Re-encryption:** Limited by client device CPU (expected, intentional)
**Email delivery:** Limited by email service rate limits (Supabase manages)

---

## Failure Modes

### Failure Mode 1: Email Delivery Failure

**Scenario:** Reset email fails to deliver

**Detection:** Email bounce, SMTP error

**Recovery:**
- Supabase automatically retries failed emails
- User can request new reset email
- Show "Check spam folder" message

---

### Failure Mode 2: Re-Encryption Fails Midway

**Scenario:** Browser crashes during re-encryption

**Detection:** Transaction not committed

**Recovery:**
- Database transaction automatically rolls back
- Old master password still valid
- User can retry re-encryption
- No data loss

---

### Failure Mode 3: User Loses Recovery Key

**Scenario:** User forgets master password and also loses recovery key

**Detection:** User reports cannot access secrets

**Recovery:**
- No recovery possible (by design)
- User must delete account and start fresh
- Support can only explain the situation, cannot recover data

---

## Alternatives Considered

### Alternative 1: Server-Side Master Password Reset

**Why not chosen:** Breaks zero-knowledge architecture. If server can reset master password, server can access secrets.

---

### Alternative 2: Social Recovery (Trusted Contacts)

**Description:** Split recovery key among trusted friends

**Why not chosen:** Too complex for MVP. Consider for future enterprise feature.

---

### Alternative 3: Time-Delayed Recovery

**Description:** Allow password reset after 30-day waiting period

**Why not chosen:** Still requires server to have access to secrets during waiting period. Doesn't solve zero-knowledge problem.

---

## Decision Log

### Decision 1: Separate Account and Master Passwords

**Date:** 2025-10-29

**Decision:** Use dual-password system (account + master)

**Rationale:** Enables account password reset without compromising zero-knowledge encryption

---

### Decision 2: Mandatory Recovery Key at Signup

**Date:** 2025-10-29

**Decision:** Require users to acknowledge recovery key before proceeding

**Rationale:** Prevent "forgot master password" support tickets. User has been warned and given recovery option.

---

### Decision 3: Atomic Re-Encryption Transactions

**Date:** 2025-10-29

**Decision:** Use database transactions for re-encryption updates

**Rationale:** Prevent partial re-encryption leaving secrets in inconsistent state

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/zero-knowledge-architecture.md` - Encryption architecture
- [x] `03-security/auth/authentication-flow.md` - Authentication flows
- [x] `GLOSSARY.md` - Password terminology
- [ ] `04-database/schemas/secrets.md` - Secrets table schema
- [ ] `07-frontend/components/PasswordResetForm.tsx` - UI components

**External Services:**
- Supabase Auth - Account password reset
- Email service - Reset email delivery (Supabase SMTP)

---

## References

### Internal Documentation
- `03-security/zero-knowledge-architecture.md` - Zero-knowledge principles
- `03-security/auth/authentication-flow.md` - Authentication flows
- `03-security/encryption-specification.md` - Encryption details
- `GLOSSARY.md` - Password terminology
- `TECH-STACK.md` - Web Crypto API, Supabase Auth

### External Resources
- [Supabase Auth - Password Reset](https://supabase.com/docs/guides/auth/passwords) - Official documentation
- [OWASP Password Reset Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) - Security best practices
- [1Password Security Model](https://1passwordstatic.com/files/security/1password-white-paper.pdf) - Recovery key inspiration

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Backend Engineer | Initial password reset architecture |

---

## Notes

### Future Enhancements
- **Social recovery** - Split recovery key among trusted contacts
- **Time-locked recovery** - Delayed recovery mechanism
- **Hardware security key** - YubiKey as recovery method
- **Multiple recovery keys** - Generate multiple keys for redundancy
- **Recovery key rotation** - Periodic regeneration of recovery keys

### Known Limitations
- **User forgets both passwords** - Permanent data loss (by design)
- **Recovery key theft** - Single point of failure if stolen
- **Re-encryption time** - Can be slow for large secret collections (>1000 secrets)
