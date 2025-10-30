---
Document: MFA Implementation - Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/auth/authentication-flow.md, GLOSSARY.md, TECH-STACK.md
---

# Multi-Factor Authentication (MFA) Implementation

## Overview

This document specifies the multi-factor authentication (MFA) implementation for Abyrith, providing an additional security layer beyond email/password authentication. Abyrith implements TOTP (Time-based One-Time Password) as the primary MFA method, with future support for SMS and backup codes. MFA is optional for individual users but can be enforced at the organization level for compliance requirements.

**Purpose:** Enhance account security by requiring a second factor of authentication, protecting against password compromise and credential theft while maintaining usability.

**Scope:** TOTP enrollment and verification, backup code generation, MFA enforcement policies, recovery mechanisms, and integration with Supabase Auth MFA capabilities.

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
Password-based authentication alone is vulnerable to credential theft, phishing, and brute force attacks. Users need an additional security layer that doesn't compromise the zero-knowledge architecture.

**Pain points:**
- Single factor (password) is insufficient for security-conscious users
- Account compromise leads to potential secret exposure
- Compliance requirements (SOC 2, ISO 27001) often mandate MFA
- Recovery from lost MFA devices is challenging but necessary
- MFA must work with both account password and master password system

**Why now?**
MFA is a foundational security feature expected by developers and required for enterprise customers. Implementing it early ensures proper integration with the authentication system.

### Background

**Existing system:**
Supabase Auth provides built-in MFA support via TOTP. We leverage this infrastructure rather than building custom MFA.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Security Lead | Strong second factor authentication | Secure enrollment, backup codes, recovery process |
| Backend Engineer | Integration with Supabase Auth | MFA verification flow, error handling, state management |
| Frontend Engineer | User-friendly enrollment | Clear QR codes, easy verification, recovery options |
| End Users (Security-conscious) | Additional account protection | Easy setup, reliable verification, device loss recovery |
| Enterprise Customers | Compliance requirements | Organization-wide enforcement, audit trail, SCIM integration |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **TOTP support** - Google Authenticator, Authy, 1Password compatible (success metric: Works with 95% of authenticator apps)
2. **Optional enrollment** - Users choose to enable MFA (success metric: Clear opt-in flow, < 2 minutes to enroll)
3. **Organization enforcement** - Admins can require MFA for all team members (success metric: Policy enforcement, grace period for enrollment)
4. **Recovery mechanism** - Backup codes and account recovery without lockout (success metric: 99.9% of users can recover access)

**Secondary goals:**
- Track MFA usage and adoption rates
- Support multiple TOTP devices per user
- Audit log all MFA events (enrollment, verification, recovery)
- Integrate with organization SSO policies

### Non-Goals

**Explicitly out of scope:**
- **SMS-based MFA** - Security concerns with SMS, SMS costs, international support complexity (Future consideration)
- **Hardware security keys (WebAuthn/FIDO2)** - Too advanced for MVP, consider post-MVP
- **Biometric authentication** - Requires device-specific APIs, mobile app needed
- **Email-based codes** - Email is already used for initial auth, not a true second factor
- **App-based push notifications** - Requires custom mobile app

### Success Metrics

**How we measure success:**
- **Enrollment Success Rate**: > 95% of users who attempt enrollment complete it successfully
- **Verification Speed**: p95 verification time < 10 seconds (including user typing code)
- **False Rejection Rate**: < 1% of valid TOTP codes rejected due to time sync issues
- **Recovery Success Rate**: 99% of users with backup codes can recover access
- **Organization Compliance**: 100% of organization members comply with MFA requirement within grace period

---

## Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Browser                             │
│  ┌────────────────────────────────────────────────┐  │
│  │         React Frontend                         │  │
│  │  • MFA enrollment UI                           │  │
│  │  • QR code display                             │  │
│  │  • TOTP code input                             │  │
│  │  • Backup codes display/storage                │  │
│  └──────────────┬─────────────────────────────────┘  │
│                 │ HTTPS + JWT                        │
└─────────────────┼────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│         Cloudflare Workers (Edge)                   │
│  • JWT verification                                 │
│  • MFA requirement check                            │
│  • Request routing                                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│              Supabase Backend                        │
│  ┌────────────────────────────────────────────────┐  │
│  │         Supabase Auth MFA                      │  │
│  │  • TOTP secret generation                      │  │
│  │  • QR code provisioning URI                    │  │
│  │  • TOTP verification (RFC 6238)                │  │
│  │  • Factor management                           │  │
│  │  • MFA challenge/verify flow                   │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │         PostgreSQL                             │  │
│  │  • auth.mfa_factors (Supabase managed)         │  │
│  │  • auth.mfa_challenges (Supabase managed)      │  │
│  │  • User MFA preferences                        │  │
│  │  • Organization MFA policies                   │  │
│  │  • Backup codes (hashed)                       │  │
│  │  • MFA audit logs                              │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Frontend MFA Interface**
- **Purpose:** Guide users through MFA enrollment, verification, and recovery
- **Technology:** React 18.3.x, Supabase Auth Helpers 0.10.x, QRCode.js
- **Responsibilities:**
  - Display QR code for TOTP enrollment
  - Manual entry key display (for users who can't scan)
  - TOTP code input and validation
  - Backup code generation and display
  - MFA requirement enforcement UI
  - Recovery code redemption

**Component 2: Supabase Auth MFA Service**
- **Purpose:** Manage TOTP secrets, verify codes, track MFA factors
- **Technology:** Supabase Auth (built-in MFA support), PostgreSQL 15.x
- **Responsibilities:**
  - Generate TOTP secrets (base32-encoded)
  - Create provisioning URIs (otpauth://)
  - Verify TOTP codes (30-second time window, ±1 window tolerance)
  - Manage MFA factors (enrollment, deletion)
  - Challenge-response flow for MFA verification
  - Store and validate backup codes

**Component 3: Cloudflare Workers MFA Enforcement**
- **Purpose:** Enforce MFA requirements at the API gateway level
- **Technology:** Cloudflare Workers (TypeScript), Supabase JWT verification
- **Responsibilities:**
  - Check JWT claims for MFA status
  - Enforce organization MFA policies
  - Redirect to MFA enrollment when required
  - Allow bypass for MFA setup endpoints

**Component 4: PostgreSQL MFA Data**
- **Purpose:** Store MFA factors, policies, and audit logs
- **Technology:** PostgreSQL 15.x (managed by Supabase)
- **Responsibilities:**
  - Store MFA factors (Supabase-managed tables)
  - Store backup codes (bcrypt hashed)
  - Store organization MFA policies
  - Log MFA events (enrollment, verification, failures)
  - Track MFA adoption metrics

### Component Interactions

**Frontend ↔ Supabase Auth MFA:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: JWT Bearer token + MFA challenge token

**Frontend ↔ Cloudflare Workers:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: JWT Bearer token (includes MFA status in claims)

**Cloudflare Workers ↔ Supabase:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: Service role key (server-side only)

---

## Component Details

### Component: Frontend MFA Interface

**Purpose:** Provide a user-friendly interface for MFA enrollment, verification, and recovery.

**Responsibilities:**
- Render QR code for authenticator app scanning
- Display manual entry key for users unable to scan
- Capture and validate TOTP code input
- Generate and securely display backup codes
- Guide users through recovery process
- Handle MFA requirement prompts

**Technology Stack:**
- React 18.3.x - UI components
- Supabase Auth Helpers 0.10.x - MFA API integration
- QRCode.js - QR code generation
- React Hook Form + Zod - Form validation
- Zustand 4.5.x - MFA state management

**Internal Architecture:**
```
┌──────────────────────────────────────┐
│     MFA Context/State                │
│  • MFA status (enabled/disabled)     │
│  • Active factors                    │
│  • Challenge token                   │
│  • Enrollment flow state             │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│     MFA Service Layer                │
│  • enrollMFA()                       │
│  • verifyMFA(code)                   │
│  • generateBackupCodes()             │
│  • disableMFA()                      │
│  • redeemBackupCode(code)            │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│     UI Components                    │
│  • MFAEnrollmentModal                │
│  • MFAVerificationModal              │
│  • BackupCodesDisplay                │
│  • MFASettingsPanel                  │
└──────────────────────────────────────┘
```

**Key Functions:**

```typescript
// MFA enrollment flow
async function enrollMFA(): Promise<MFAEnrollmentData> {
  // 1. Request TOTP secret from Supabase
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator App'
  });

  if (error) {
    throw new Error('Failed to generate MFA secret');
  }

  // 2. Generate QR code and manual entry key
  const qrCodeUrl = data.totp.qr_code; // otpauth:// URI
  const secret = data.totp.secret;     // Base32-encoded secret

  // 3. Display QR code and secret to user
  return {
    factorId: data.id,
    qrCodeUrl,
    secret,
    uri: data.totp.uri
  };
}

// Verify TOTP code during enrollment
async function verifyEnrollment(
  factorId: string,
  code: string
): Promise<void> {
  // Challenge-verify flow
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({
      factorId
    });

  if (challengeError) {
    throw new Error('Failed to create MFA challenge');
  }

  // Verify the TOTP code
  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code
  });

  if (error) {
    throw new Error('Invalid TOTP code');
  }

  // MFA now enabled for user
}

// Generate backup codes
async function generateBackupCodes(): Promise<string[]> {
  // Call custom backend endpoint to generate backup codes
  const response = await fetch('/api/mfa/backup-codes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to generate backup codes');
  }

  const { codes } = await response.json();

  // codes = ['ABCD-1234-EFGH', 'IJKL-5678-MNOP', ...]
  // Display to user once, must be saved
  return codes;
}

// Verify MFA during login
async function verifyMFADuringLogin(code: string): Promise<void> {
  // User has successfully logged in with password
  // Now MFA challenge is required

  // 1. Get active MFA factor
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactor = factors.find(f => f.factor_type === 'totp');

  if (!totpFactor) {
    throw new Error('No MFA factor enrolled');
  }

  // 2. Create challenge
  const { data: challengeData } = await supabase.auth.mfa.challenge({
    factorId: totpFactor.id
  });

  // 3. Verify code
  const { data, error } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challengeData.id,
    code
  });

  if (error) {
    throw new Error('Invalid MFA code');
  }

  // Authentication complete, user now fully authenticated
}
```

### Component: Supabase Auth MFA Service

**Purpose:** Leverage Supabase's built-in MFA capabilities for TOTP generation and verification.

**Responsibilities:**
- Generate TOTP secrets using cryptographically secure random number generator
- Create provisioning URIs compatible with Google Authenticator, Authy, 1Password
- Verify TOTP codes according to RFC 6238 specification
- Manage factor lifecycle (enroll, verify, unenroll)
- Handle time skew (±30 seconds tolerance)
- Prevent code reuse within time window

**TOTP Specification:**
```typescript
interface TOTPConfiguration {
  // Algorithm: SHA1 (most compatible with authenticator apps)
  algorithm: 'SHA1';

  // Time step: 30 seconds (RFC 6238 standard)
  period: 30;

  // Code length: 6 digits
  digits: 6;

  // Time skew tolerance: ±1 window (±30 seconds)
  skew: 1;

  // Secret length: 32 bytes (256 bits)
  // Base32-encoded: ~52 characters
  secretLength: 32;
}
```

**Provisioning URI Format:**
```
otpauth://totp/Abyrith:user@example.com?secret=BASE32SECRET&issuer=Abyrith&algorithm=SHA1&digits=6&period=30
```

**JWT Claims After MFA:**
```typescript
interface SupabaseJWTWithMFA {
  // Standard claims
  sub: string;              // User ID
  email: string;
  role: 'authenticated';

  // MFA-specific claims
  aal: 'aal1' | 'aal2';     // Authentication Assurance Level
  // aal1 = single factor (password only)
  // aal2 = multi-factor (password + TOTP)

  amr: Array<{              // Authentication Methods Reference
    method: 'password' | 'totp' | 'recovery';
    timestamp: number;
  }>;
}
```

### Component: Backup Codes System

**Purpose:** Provide recovery mechanism when TOTP device is lost or unavailable.

**Responsibilities:**
- Generate 8-10 cryptographically random backup codes
- Hash codes with bcrypt before storage (never store plaintext)
- Single-use codes (invalidate after redemption)
- Display codes to user exactly once during generation
- Allow download as text file
- Track usage in audit logs

**Implementation:**

**Database Schema:**
```sql
CREATE TABLE mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,          -- bcrypt hash of code
  used_at TIMESTAMPTZ,              -- NULL = unused, timestamp = used
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT backup_codes_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Index for fast lookup
CREATE INDEX idx_backup_codes_user ON mfa_backup_codes(user_id);
CREATE INDEX idx_backup_codes_unused ON mfa_backup_codes(user_id) WHERE used_at IS NULL;

-- RLS policies
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own backup codes"
  ON mfa_backup_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users cannot directly modify backup codes"
  ON mfa_backup_codes FOR ALL
  TO authenticated
  USING (false);  -- All operations go through Edge Functions
```

**Code Generation:**
```typescript
async function generateBackupCodes(userId: string): Promise<string[]> {
  // Generate 8 codes
  const codes: string[] = [];

  for (let i = 0; i < 8; i++) {
    // Generate 12 random bytes (96 bits of entropy)
    const randomBytes = crypto.getRandomValues(new Uint8Array(12));

    // Convert to base32 (alphanumeric, no ambiguous characters)
    const code = base32Encode(randomBytes)
      .replace(/=/g, '') // Remove padding
      .toUpperCase()
      .match(/.{1,4}/g)  // Group into 4-character chunks
      .join('-');         // ABCD-EFGH-IJKL format

    codes.push(code);
  }

  // Hash and store codes
  for (const code of codes) {
    const hash = await bcrypt.hash(code, 10);

    await supabase
      .from('mfa_backup_codes')
      .insert({
        user_id: userId,
        code_hash: hash
      });
  }

  return codes; // Return plaintext codes ONCE for user to save
}

// Verify and redeem backup code
async function redeemBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  // Fetch all unused codes for user
  const { data: backupCodes } = await supabase
    .from('mfa_backup_codes')
    .select('id, code_hash')
    .eq('user_id', userId)
    .is('used_at', null);

  // Try to match against any unused code
  for (const backupCode of backupCodes) {
    const isValid = await bcrypt.compare(code, backupCode.code_hash);

    if (isValid) {
      // Mark code as used
      await supabase
        .from('mfa_backup_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', backupCode.id);

      // Log redemption
      await logMFAEvent({
        user_id: userId,
        event_type: 'backup_code_redeemed',
        success: true
      });

      return true;
    }
  }

  // No matching code found
  return false;
}
```

---

## Data Flow

### Flow 1: MFA Enrollment (First-Time Setup)

**Trigger:** User clicks "Enable Two-Factor Authentication" in account settings

**Steps:**

1. **Frontend: Request MFA Enrollment**
   ```typescript
   const { data, error } = await supabase.auth.mfa.enroll({
     factorType: 'totp',
     friendlyName: 'Authenticator App'
   });
   ```

2. **Supabase Auth: Generate TOTP Secret**
   - Generate 32-byte random secret
   - Base32-encode secret
   - Create provisioning URI
   - Store factor in `auth.mfa_factors` (status: 'unverified')

3. **Frontend: Display QR Code**
   ```typescript
   // Display QR code using QRCode.js
   <QRCode value={data.totp.uri} size={256} />

   // Also show manual entry
   <p>Manual Entry: {data.totp.secret}</p>
   ```

4. **User: Scan QR Code with Authenticator App**
   - User opens Google Authenticator / Authy / 1Password
   - Scans QR code or manually enters secret
   - App begins generating 6-digit codes every 30 seconds

5. **Frontend: Prompt for Verification Code**
   ```typescript
   <input
     type="text"
     placeholder="Enter 6-digit code"
     maxLength={6}
     pattern="[0-9]{6}"
   />
   ```

6. **Frontend: Submit Verification Code**
   ```typescript
   // Create challenge
   const { data: challengeData } = await supabase.auth.mfa.challenge({
     factorId: data.id
   });

   // Verify code
   const { data: verifyData, error } = await supabase.auth.mfa.verify({
     factorId: data.id,
     challengeId: challengeData.id,
     code: userInputCode
   });
   ```

7. **Supabase Auth: Verify TOTP Code**
   - Calculate expected TOTP value using secret and current time
   - Check ±1 time window (90 seconds total)
   - If valid, update factor status to 'verified'
   - Add 'mfa' to user's authentication methods

8. **Frontend: Generate Backup Codes**
   ```typescript
   const backupCodes = await generateBackupCodes();

   // Display codes prominently
   <BackupCodesDisplay
     codes={backupCodes}
     onDownload={() => downloadAsTextFile(backupCodes)}
     onPrint={() => window.print()}
   />

   // Warning: Save these codes! They won't be shown again.
   ```

9. **Frontend: Confirm Backup Codes Saved**
   ```typescript
   <Checkbox required>
     I have saved my backup codes in a secure location
   </Checkbox>
   ```

10. **Frontend: MFA Enrollment Complete**
    ```typescript
    // Update UI to show MFA enabled
    showSuccessMessage('Two-factor authentication enabled!');

    // Redirect back to security settings
    router.push('/settings/security');
    ```

**Sequence Diagram:**
```
User       Frontend    Supabase Auth    Database
  |             |            |             |
  |--enable MFA>|            |             |
  |             |--enroll--->|             |
  |             |            |--generate-->|
  |             |            |  secret     |
  |             |            |<--store-----|
  |             |            |  factor     |
  |             |<--QR code--|             |
  |             |   + secret |             |
  |<--display---|            |             |
  |  QR code    |            |             |
  |             |            |             |
  |--scan QR--->|            |             |
  | (in app)    |            |             |
  |             |            |             |
  |--enter code>|            |             |
  |             |--challenge>|             |
  |             |<--challenge|             |
  |             |  ID        |             |
  |             |            |             |
  |             |--verify--->|             |
  |             |  + code    |--verify---->|
  |             |            |  TOTP       |
  |             |            |<--success---|
  |             |            |             |
  |             |<--success--|             |
  |             |            |             |
  |             |--generate->|             |
  |             |  backup    |--store----->|
  |             |  codes     |  hashes     |
  |             |<--codes----|             |
  |             |  (once)    |             |
  |<--display---|            |             |
  |  backup     |            |             |
  |  codes      |            |             |
  |             |            |             |
  |--saved!---->|            |             |
  |             |--complete->|             |
  |<--done!-----|            |             |
```

**Data Transformations:**
- **Point A (Server):** Random bytes → Base32-encoded TOTP secret
- **Point B (QR Code):** Secret → otpauth:// URI → QR code image
- **Point C (Authenticator App):** Secret → 6-digit TOTP codes (every 30 seconds)
- **Point D (Verification):** User input code → Validated against expected value
- **Point E (Backup Codes):** Random bytes → Formatted codes → bcrypt hashes (storage)

---

### Flow 2: MFA Verification During Login

**Trigger:** User successfully authenticates with email/password and has MFA enabled

**Steps:**

1. **Frontend: User Logs In**
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password: accountPassword
   });
   ```

2. **Supabase Auth: Check MFA Status**
   - User successfully authenticated (password correct)
   - Check if user has verified MFA factor
   - If MFA enabled, return `aal: 'aal1'` (only password verified)
   - Require MFA challenge

3. **Frontend: Detect MFA Required**
   ```typescript
   if (data.user && data.session.aal === 'aal1') {
     // MFA required but not yet verified
     setShowMFAPrompt(true);
   }
   ```

4. **Frontend: Display MFA Verification Modal**
   ```typescript
   <MFAVerificationModal
     onVerify={handleMFAVerify}
     onUseBackupCode={handleBackupCode}
   />
   ```

5. **User: Enter TOTP Code from Authenticator App**
   - Open authenticator app
   - Find "Abyrith" entry
   - Read current 6-digit code
   - Enter code in modal

6. **Frontend: Submit MFA Code**
   ```typescript
   // Get user's MFA factors
   const { data: factors } = await supabase.auth.mfa.listFactors();
   const totpFactor = factors.find(f => f.factor_type === 'totp');

   // Create challenge
   const { data: challengeData } = await supabase.auth.mfa.challenge({
     factorId: totpFactor.id
   });

   // Verify code
   const { data: verifyData, error } = await supabase.auth.mfa.verify({
     factorId: totpFactor.id,
     challengeId: challengeData.id,
     code: mfaCode
   });
   ```

7. **Supabase Auth: Verify TOTP Code**
   - Calculate expected TOTP value
   - Check ±1 time window
   - If valid, upgrade session to 'aal2' (multi-factor verified)
   - Update JWT with MFA authentication method

8. **Frontend: Complete Authentication**
   ```typescript
   if (!error) {
     // Session now upgraded to aal2
     // Proceed with master password entry (from authentication-flow.md)
     setShowMasterPasswordPrompt(true);
   }
   ```

9. **Frontend: Derive Master Key**
   - Same as standard login flow
   - User enters master password
   - Derive encryption key
   - Load encrypted secrets

**Sequence Diagram:**
```
User       Frontend    Supabase Auth    Database
  |             |            |             |
  |--login----->|            |             |
  |  (password) |--signIn--->|             |
  |             |            |--verify---->|
  |             |            |  password   |
  |             |            |<--aal1------|
  |             |<--partial--|             |
  |             |  auth      |             |
  |             |  (aal1)    |             |
  |<--MFA prompt|            |             |
  |             |            |             |
  |--TOTP code->|            |             |
  |             |--challenge>|             |
  |             |<--challenge|             |
  |             |  ID        |             |
  |             |            |             |
  |             |--verify--->|             |
  |             |  + code    |--verify---->|
  |             |            |  TOTP       |
  |             |            |<--aal2------|
  |             |<--full auth|             |
  |             |  (aal2)    |             |
  |<--success---|            |             |
  |             |            |             |
  |--master pw->|            |             |
  |             |--derive----|             |
  |             |  key       |  (client)   |
  |<--dashboard-|            |             |
```

---

### Flow 3: MFA Recovery with Backup Code

**Trigger:** User cannot access authenticator app (device lost/broken) but has backup code

**Steps:**

1. **Frontend: User Attempts Login**
   - Enter email and password
   - MFA prompt appears

2. **Frontend: User Clicks "Use Backup Code"**
   ```typescript
   <button onClick={() => setShowBackupCodeInput(true)}>
     Lost your device? Use a backup code
   </button>
   ```

3. **Frontend: Display Backup Code Input**
   ```typescript
   <input
     type="text"
     placeholder="ABCD-EFGH-IJKL"
     pattern="[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}"
   />
   ```

4. **Frontend: Submit Backup Code**
   ```typescript
   const response = await fetch('/api/mfa/redeem-backup-code', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${session.access_token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({ code: backupCode })
   });
   ```

5. **Backend: Verify Backup Code**
   ```typescript
   // Edge Function or Cloudflare Worker
   const isValid = await redeemBackupCode(userId, code);

   if (isValid) {
     // Upgrade session to aal2
     // Code is now used and cannot be reused
     return { success: true };
   } else {
     return { success: false, error: 'Invalid backup code' };
   }
   ```

6. **Frontend: Prompt to Re-Enroll MFA**
   ```typescript
   <Alert>
     You've used a backup code to log in.
     Please re-enroll MFA with your new device.
   </Alert>
   ```

7. **Frontend: Complete Login**
   - Proceed to master password entry
   - User should set up MFA again on new device

---

### Flow 4: Organization-Wide MFA Enforcement

**Trigger:** Organization admin enables "Require MFA for all team members"

**Steps:**

1. **Admin: Enable MFA Policy**
   ```typescript
   await updateOrganizationPolicy({
     organization_id: orgId,
     mfa_required: true,
     enforcement_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days grace period
   });
   ```

2. **Backend: Notify All Organization Members**
   ```typescript
   const members = await getOrganizationMembers(orgId);

   for (const member of members) {
     if (!member.mfa_enabled) {
       await sendEmail({
         to: member.email,
         subject: 'Action Required: Enable Two-Factor Authentication',
         body: `Your organization requires MFA. Please enable it by ${enforcementDate}.`
       });
     }
   }
   ```

3. **Frontend: Display MFA Enrollment Banner**
   ```typescript
   <Banner severity="warning">
     Your organization requires two-factor authentication.
     Please enable it by {enforcementDate}.
     <Button onClick={handleEnrollMFA}>Enable MFA</Button>
   </Banner>
   ```

4. **Cloudflare Workers: Enforce MFA Requirement**
   ```typescript
   async function checkMFAEnforcement(request: Request, jwt: JWT): Response | null {
     // Check if user's organization requires MFA
     const orgPolicy = await getOrganizationPolicy(jwt.org_id);

     if (orgPolicy.mfa_required) {
       // Check if enforcement date has passed
       if (new Date() > orgPolicy.enforcement_date) {
         // Check if user has MFA enabled
         if (jwt.aal !== 'aal2') {
           // Redirect to MFA enrollment
           return Response.redirect('/security/mfa-setup', 302);
         }
       }
     }

     return null; // No enforcement needed
   }
   ```

5. **Frontend: Block Access Until MFA Enrolled**
   ```typescript
   // After grace period expires
   if (organizationRequiresMFA && !user.mfaEnabled) {
     return <MFAEnrollmentRequired />;
   }
   ```

6. **Audit Log: Track MFA Enrollment**
   ```typescript
   await logMFAEvent({
     organization_id: orgId,
     user_id: userId,
     event_type: 'mfa_enrolled_for_compliance',
     metadata: {
       policy_id: policyId,
       days_remaining: daysUntilEnforcement
     }
   });
   ```

---

## API Contracts

### API: MFA Enrollment

**Endpoint:** Supabase Auth `POST /auth/v1/factors`

**Purpose:** Initiate MFA enrollment and generate TOTP secret

**Request:**
```typescript
interface MFAEnrollRequest {
  factor_type: 'totp';
  friendly_name?: string;  // Optional: "Authenticator App", "Work Phone"
}
```

**Example Request:**
```json
POST /auth/v1/factors
{
  "factor_type": "totp",
  "friendly_name": "Authenticator App"
}
```

**Success Response (200 OK):**
```typescript
interface MFAEnrollResponse {
  id: string;              // Factor ID (UUID)
  type: 'totp';
  status: 'unverified';    // Not yet verified
  friendly_name: string;
  created_at: string;
  updated_at: string;

  totp: {
    qr_code: string;       // Data URI for QR code image
    secret: string;        // Base32-encoded secret
    uri: string;           // otpauth:// provisioning URI
  };
}
```

**Example Response:**
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "type": "totp",
  "status": "unverified",
  "friendly_name": "Authenticator App",
  "created_at": "2025-10-29T12:00:00Z",
  "updated_at": "2025-10-29T12:00:00Z",
  "totp": {
    "qr_code": "data:image/svg+xml;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "uri": "otpauth://totp/Abyrith:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Abyrith"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid factor type
- `401 Unauthorized` - Not authenticated
- `409 Conflict` - MFA already enrolled
- `500 Internal Server Error` - Server error

---

### API: MFA Verification (Challenge-Verify)

**Endpoint 1:** Supabase Auth `POST /auth/v1/factors/:factor_id/challenge`

**Purpose:** Create MFA challenge

**Success Response (200 OK):**
```typescript
interface MFAChallengeResponse {
  id: string;              // Challenge ID (UUID)
  type: 'totp';
  expires_at: number;      // Unix timestamp (usually 60 seconds)
}
```

---

**Endpoint 2:** Supabase Auth `POST /auth/v1/factors/:factor_id/verify`

**Purpose:** Verify TOTP code and complete MFA

**Request:**
```typescript
interface MFAVerifyRequest {
  challenge_id: string;
  code: string;            // 6-digit TOTP code
}
```

**Example Request:**
```json
POST /auth/v1/factors/f47ac10b-58cc-4372-a567-0e02b2c3d479/verify
{
  "challenge_id": "c13d4ff0-e829-4a8c-a567-0e02b2c3d479",
  "code": "123456"
}
```

**Success Response (200 OK):**
```typescript
interface MFAVerifyResponse {
  access_token: string;    // New JWT with aal2
  refresh_token: string;   // New refresh token
  expires_in: number;      // Token expiration (seconds)
  token_type: 'bearer';
  user: User;              // User object
}
```

**Error Responses:**
- `400 Bad Request` - Invalid code format
- `401 Unauthorized` - Incorrect code
- `410 Gone` - Challenge expired
- `429 Too Many Requests` - Rate limit exceeded (after 5 failed attempts)

---

### API: List MFA Factors

**Endpoint:** Supabase Auth `GET /auth/v1/factors`

**Purpose:** List all MFA factors for the authenticated user

**Success Response (200 OK):**
```typescript
interface MFAFactorsResponse {
  factors: Array<{
    id: string;
    type: 'totp';
    status: 'verified' | 'unverified';
    friendly_name: string;
    created_at: string;
    updated_at: string;
  }>;
}
```

---

### API: Unenroll MFA

**Endpoint:** Supabase Auth `DELETE /auth/v1/factors/:factor_id`

**Purpose:** Remove MFA factor (disable MFA)

**Success Response (200 OK):**
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "deleted"
}
```

**Error Responses:**
- `403 Forbidden` - Organization policy requires MFA (cannot unenroll)

---

### Custom API: Generate Backup Codes

**Endpoint:** `POST /api/mfa/backup-codes`

**Purpose:** Generate new backup codes (invalidates old codes)

**Request:**
```typescript
// No request body, authenticated via JWT
```

**Success Response (200 OK):**
```typescript
interface BackupCodesResponse {
  codes: string[];         // Array of 8 codes
  created_at: string;
  warning: string;         // "Save these codes now. They won't be shown again."
}
```

**Example Response:**
```json
{
  "codes": [
    "ABCD-1234-EFGH",
    "IJKL-5678-MNOP",
    "QRST-9012-UVWX",
    "YZAB-3456-CDEF",
    "GHIJ-7890-KLMN",
    "OPQR-2345-STUV",
    "WXYZ-6789-ABCD",
    "EFGH-0123-IJKL"
  ],
  "created_at": "2025-10-29T12:00:00Z",
  "warning": "Save these codes now. They won't be shown again."
}
```

---

### Custom API: Redeem Backup Code

**Endpoint:** `POST /api/mfa/redeem-backup-code`

**Purpose:** Use backup code for MFA verification

**Request:**
```typescript
interface RedeemBackupCodeRequest {
  code: string;            // Backup code (e.g., "ABCD-1234-EFGH")
}
```

**Success Response (200 OK):**
```typescript
interface RedeemBackupCodeResponse {
  success: true;
  access_token: string;    // New JWT with aal2
  refresh_token: string;
  remaining_codes: number; // Number of unused backup codes left
  warning?: string;        // If only 1-2 codes remain
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid backup code
- `410 Gone` - Code already used
- `429 Too Many Requests` - Rate limit (after 5 failed attempts)

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Client ↔ Supabase Auth**
- **Threats:** TOTP secret interception, code replay attacks, timing attacks
- **Controls:**
  - HTTPS (TLS 1.3) for all communication
  - TOTP secret transmitted only once during enrollment
  - Challenge-verify flow prevents code reuse
  - Time-based codes expire after 30 seconds
  - Rate limiting on verification attempts (5 attempts per minute)

**Boundary 2: Authenticator App ↔ User**
- **Threats:** Shoulder surfing, malicious authenticator apps, device theft
- **Controls:**
  - User responsibility to use legitimate authenticator apps
  - Backup codes provide recovery mechanism
  - Device-level security (PIN/biometric) recommended
  - Cannot mitigate: user must protect their device

**Boundary 3: Backup Codes Storage ↔ User**
- **Threats:** Backup codes stored insecurely (screenshots, plaintext files)
- **Controls:**
  - Prominent warnings during generation
  - Encourage password manager storage
  - Single-use codes (cannot be reused)
  - Hashed in database (bcrypt)

### Authentication & Authorization

**MFA in Authentication Flow:**
1. **aal1 (Assurance Level 1):** Password verified, MFA not yet verified
2. **aal2 (Assurance Level 2):** Password + TOTP verified (full authentication)

**Authorization Based on aal:**
- Sensitive operations require aal2 (e.g., view production secrets, change security settings)
- Standard operations allow aal1 (e.g., view projects, update profile)
- MFA enforcement policies checked at API gateway (Cloudflare Workers)

### Data Security

**Data at Rest:**
- **TOTP Secrets:** Encrypted in Supabase Auth (managed encryption)
- **Backup Codes:** Bcrypt hashed (cost factor: 10), never stored plaintext
- **MFA Audit Logs:** Encrypted at rest in PostgreSQL

**Data in Transit:**
- **TOTP Secret:** Transmitted over HTTPS during enrollment only
- **TOTP Codes:** Transmitted over HTTPS during verification
- **QR Code:** Generated server-side, transmitted as data URI

**Data in Use:**
- **TOTP Verification:** Server-side computation using secret and current time
- **Backup Code Verification:** Bcrypt comparison, constant-time to prevent timing attacks

### Threat Model

**Threat 1: TOTP Secret Compromise**
- **Description:** Attacker obtains user's TOTP secret
- **Likelihood:** Low (secret only transmitted once, over HTTPS)
- **Impact:** High (attacker can generate valid codes)
- **Mitigation:**
  - Secret encrypted in database
  - Secret transmitted over HTTPS only
  - Secret never logged or exposed in errors
  - User can disable/re-enroll MFA to rotate secret

**Threat 2: Backup Code Theft**
- **Description:** Attacker gains access to user's backup codes
- **Likelihood:** Medium (users may store insecurely)
- **Impact:** High (attacker can bypass MFA)
- **Mitigation:**
  - Codes are single-use (invalidated after redemption)
  - Codes hashed in database (bcrypt)
  - Audit log tracks backup code usage
  - User notified via email when backup code used
  - Rate limiting prevents brute force (5 attempts per minute)

**Threat 3: Time-Based Replay Attack**
- **Description:** Attacker intercepts and reuses a valid TOTP code
- **Likelihood:** Low (30-second window, HTTPS)
- **Impact:** Medium (single authentication)
- **Mitigation:**
  - Challenge-verify flow prevents code reuse
  - Codes expire after 30 seconds
  - Server tracks recently used codes (prevents replay within window)
  - HTTPS prevents interception

**Threat 4: Phishing Attack**
- **Description:** Attacker tricks user into entering TOTP code on fake site
- **Likelihood:** Medium (phishing is common)
- **Impact:** High (attacker gains access)
- **Mitigation:**
  - User education (check URL before entering code)
  - Time-limited codes (attacker must act quickly)
  - MFA doesn't protect against real-time phishing (future: WebAuthn addresses this)
  - Audit logs detect unusual login locations (future)

**Threat 5: MFA Bypass via Account Takeover**
- **Description:** Attacker compromises account password and disables MFA
- **Likelihood:** Low (requires password + disabling MFA)
- **Impact:** Critical (full account compromise)
- **Mitigation:**
  - Disabling MFA requires current TOTP code or backup code
  - Organization-enforced MFA cannot be disabled by user
  - Email notification when MFA is disabled
  - Audit log tracks MFA disable events

**Threat 6: Lost Device (No Backup Codes)**
- **Description:** User loses authenticator device and didn't save backup codes
- **Likelihood:** Medium (users forget to save codes)
- **Impact:** High (user locked out of account)
- **Mitigation:**
  - Prominent warnings during enrollment
  - Recovery flow via email (zero-knowledge implications)
  - Support ticket for account recovery (manual verification)
  - Future: Social recovery or secondary contact

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- MFA enrollment: < 3s p95 (secret generation, QR code creation)
- TOTP verification: < 500ms p95 (code validation)
- Backup code generation: < 2s p95 (8 codes, bcrypt hashing)
- Backup code redemption: < 1s p95 (bcrypt comparison)

**Throughput:**
- MFA verification requests: 10,000 per minute (global)
- MFA enrollment: 1,000 per minute (global)

**Resource Usage:**
- Memory: < 10MB for MFA state management
- CPU: Bcrypt hashing is CPU-intensive (intentional)
- Storage: ~500 bytes per user for MFA data

### Performance Optimization

**Optimizations implemented:**
- **TOTP verification caching:** Cache recent codes to prevent replay (5-minute Redis TTL)
- **Backup code lookup:** Index on `user_id` for fast lookup
- **Bcrypt cost factor:** 10 rounds (balance security vs. performance)
- **Challenge expiration:** 60-second challenge expiration reduces state storage

**Caching Strategy:**
- **What is cached:**
  - Organization MFA policies: Redis, 10-minute TTL
  - User MFA status (in JWT claims): No caching needed, JWT carries state
- **Cache invalidation:**
  - MFA policy changes: Invalidate on update
  - MFA enrollment/unenrollment: No caching needed

**Database Optimization:**
- **Indexes:**
  - `mfa_backup_codes.user_id` - B-tree index for user lookup
  - `mfa_backup_codes.user_id WHERE used_at IS NULL` - Partial index for unused codes
- **Query optimization:**
  - Fetch only unused backup codes (partial index)
  - Limit to 10 most recent factors per user

---

## Scalability

### Horizontal Scaling

**Components that scale horizontally:**
- **Supabase Auth:** Managed service, scales automatically
- **Cloudflare Workers:** Automatically scale to millions of requests
- **Frontend:** Static site, scales via Cloudflare CDN

**Load balancing:**
- Cloudflare automatically routes to nearest edge location
- Supabase handles database connection pooling

### Vertical Scaling

**Components that scale vertically:**
- **PostgreSQL:** Supabase managed, can upgrade instance size (not needed for MFA data volume)

### Bottlenecks

**Current bottlenecks:**
- **Bcrypt hashing:** CPU-bound, ~100ms per code verification (intentional security measure)
- **Database lookups:** Minimal (indexed, < 5ms p95)

**Mitigation strategies:**
- Bcrypt cost factor tunable (currently 10 rounds)
- Use Supabase connection pooling (PgBouncer)

### Capacity Planning

**Current capacity:**
- 1,000,000 MFA verifications per day (well within limits)
- 100,000 active MFA users (< 100MB storage)

**Growth projections:**
- Year 1: < 50,000 MFA users
- Year 2: < 200,000 MFA users

---

## Failure Modes

### Failure Mode 1: Time Sync Issues

**Scenario:** User's device clock is significantly out of sync (> 90 seconds)

**Impact:** TOTP codes fail verification despite being generated correctly

**Detection:** User reports "code always invalid"

**Recovery:**
1. Check device time settings
2. Advise user to enable automatic time sync
3. Use backup code to log in
4. Re-enroll MFA if persistent

**Prevention:**
- Server allows ±1 time window (90 seconds tolerance)
- Display time sync warning in UI
- Provide troubleshooting help in error message

---

### Failure Mode 2: Lost Authenticator Device (No Backup Codes)

**Scenario:** User loses phone and didn't save backup codes

**Impact:** User cannot log in

**Detection:** User contacts support

**Recovery:**
1. Verify user identity (email verification, support ticket)
2. Manually disable MFA for user (support action)
3. User logs in with password only
4. User re-enrolls MFA with new device

**Prevention:**
- Prominent warnings to save backup codes
- Email notification after enrollment with reminder
- Option to add multiple devices (future)

---

### Failure Mode 3: All Backup Codes Exhausted

**Scenario:** User has used all 8 backup codes without re-generating

**Impact:** No recovery option if device lost

**Detection:** System tracks backup code count

**Recovery:**
1. Prompt user to generate new backup codes
2. Email warning when < 3 codes remaining

**Prevention:**
- Automatic prompt to regenerate when < 2 codes remain
- Email notification when codes running low

---

### Failure Mode 4: Supabase Auth MFA Service Unavailable

**Scenario:** Supabase Auth MFA service is down

**Impact:** Users cannot verify MFA codes, cannot log in

**Detection:** Health check endpoints return 5xx errors

**Recovery:**
1. Monitor Supabase status page
2. Display "MFA verification temporarily unavailable" message
3. Consider temporary MFA bypass for critical users (with enhanced logging)

**Prevention:**
- Supabase has 99.9% uptime SLA
- Implement circuit breaker pattern
- Queue MFA verifications for retry

---

### Failure Mode 5: Organization MFA Policy Misconfiguration

**Scenario:** Admin sets enforcement date in past, locks out users immediately

**Impact:** Users without MFA cannot access platform

**Detection:** Spike in support tickets

**Recovery:**
1. Admin extends grace period
2. Notify all users
3. Provide expedited MFA enrollment support

**Prevention:**
- Minimum 7-day grace period (UI enforced)
- Confirmation dialog for MFA policy changes
- Dry-run mode showing impact before enforcement

---

## Alternatives Considered

### Alternative 1: SMS-Based MFA

**Description:** Send 6-digit code via SMS instead of TOTP

**Pros:**
- More familiar to non-technical users
- No app installation required
- Works on any phone

**Cons:**
- SMS is insecure (SIM swapping attacks)
- International SMS costs
- Delivery delays and failures
- Phone number privacy concerns
- Compliance issues (NIST discourages SMS for MFA)

**Why not chosen:** Security concerns outweigh convenience. SMS is vulnerable to SIM swapping and interception. TOTP is more secure and cost-effective.

---

### Alternative 2: Email-Based MFA

**Description:** Send code to user's email

**Pros:**
- No additional app required
- Universal access (everyone has email)
- Easy to implement

**Cons:**
- Email is already used for account recovery (not a true second factor)
- Email account compromise defeats MFA
- Not accepted for compliance (SOC 2, NIST)
- Delivery delays

**Why not chosen:** Email doesn't provide a true second factor if it's already used for account access and recovery.

---

### Alternative 3: WebAuthn / Hardware Security Keys

**Description:** Use FIDO2-compliant hardware keys (YubiKey, etc.)

**Pros:**
- Strongest phishing protection
- No time-sync issues
- Works offline
- Future-proof standard

**Cons:**
- Requires hardware purchase ($20-50)
- Not beginner-friendly (our primary persona)
- Limited device support (especially mobile)
- Complex enrollment flow
- Backup/recovery difficult

**Why not chosen:** Too high a barrier for beginners. Consider as optional advanced MFA method post-MVP.

---

### Alternative 4: Biometric Authentication

**Description:** Use Touch ID, Face ID, Windows Hello

**Pros:**
- Very user-friendly
- Fast authentication
- Built into devices

**Cons:**
- Requires native mobile/desktop app (not web-based)
- Platform-specific APIs
- Privacy concerns
- No cross-device support
- Compliance acceptance unclear

**Why not chosen:** Requires native app development, out of scope for MVP. Web Crypto API doesn't expose biometric APIs.

---

### Alternative 5: Push Notification MFA (Duo-style)

**Description:** Send push notification to mobile app, user approves

**Pros:**
- Very user-friendly
- No code entry needed
- Can show login context (location, device)

**Cons:**
- Requires custom mobile app
- Push notification infrastructure (Firebase Cloud Messaging, APNs)
- Network dependency
- Approval fatigue (users auto-approve)
- Complex implementation

**Why not chosen:** Requires mobile app development and push infrastructure. Too complex for MVP. TOTP is simpler and works with existing apps.

---

## Decision Log

### Decision 1: TOTP over SMS

**Date:** 2025-10-29

**Context:** Need to choose primary MFA method between TOTP and SMS.

**Options:**
1. TOTP (Time-based One-Time Password) - Authenticator app
2. SMS-based codes - Text message delivery
3. Both TOTP and SMS - User choice

**Decision:** TOTP only for MVP, SMS as future consideration

**Rationale:**
- TOTP is more secure (no SIM swapping risk)
- TOTP is cost-effective (no SMS fees)
- TOTP works globally (no international SMS issues)
- TOTP is compliance-friendly (NIST recommends)
- Users can use existing apps (Google Authenticator, Authy, 1Password)

**Consequences:**
- Non-technical users may need help installing authenticator app
- Must provide clear setup instructions and QR code
- Backup codes become critical for recovery
- Cannot use SMS as fallback (must use backup codes)

---

### Decision 2: Leverage Supabase Auth MFA

**Date:** 2025-10-29

**Context:** Build custom MFA system or use Supabase's built-in MFA?

**Options:**
1. Custom implementation (RFC 6238 TOTP library)
2. Supabase Auth MFA (built-in, managed)
3. Third-party service (Twilio Authy, Duo)

**Decision:** Use Supabase Auth MFA

**Rationale:**
- Already using Supabase for authentication
- Built-in, battle-tested implementation
- No additional service dependencies
- Automatic JWT claims update (aal2)
- Included in Supabase pricing
- RFC 6238 compliant

**Consequences:**
- Tied to Supabase Auth (acceptable, already committed)
- Limited customization of TOTP parameters (acceptable defaults)
- Must understand Supabase MFA API (well-documented)

---

### Decision 3: Backup Codes Mandatory

**Date:** 2025-10-29

**Context:** Should backup codes be optional or mandatory during MFA enrollment?

**Options:**
1. Mandatory - User must acknowledge backup codes before completing enrollment
2. Optional - User can skip backup codes
3. Delayed - User can generate backup codes later

**Decision:** Mandatory with strong warnings

**Rationale:**
- Prevents user lockout (lost device)
- Reduces support burden (can't access account)
- Industry best practice (Google, GitHub require it)
- Zero-knowledge architecture makes recovery hard

**Consequences:**
- Slightly longer enrollment flow
- Users may save codes insecurely (education required)
- Must provide clear download/print options

---

### Decision 4: Organization MFA Enforcement with Grace Period

**Date:** 2025-10-29

**Context:** How should organization-wide MFA enforcement work?

**Options:**
1. Immediate enforcement (users locked out if no MFA)
2. Grace period (7-30 days to enroll)
3. Voluntary (no enforcement)

**Decision:** 7-day minimum grace period, configurable up to 30 days

**Rationale:**
- Gives users time to enroll (reduces support burden)
- Balances security with usability
- Compliance frameworks often allow grace periods
- Admin can choose urgency (7-30 days)

**Consequences:**
- Organization partially vulnerable during grace period
- Notification emails required
- Must track enrollment status per user
- Banner/prompt reminders needed

---

### Decision 5: bcrypt Cost Factor 10 for Backup Codes

**Date:** 2025-10-29

**Context:** What hashing algorithm and cost factor for backup codes?

**Options:**
1. bcrypt cost 10 (~100ms)
2. bcrypt cost 12 (~400ms)
3. Argon2 (newer, memory-hard)

**Decision:** bcrypt cost factor 10

**Rationale:**
- Balance security vs. performance
- ~100ms verification time acceptable
- Backup codes already single-use (reduces attack value)
- Rate limiting provides additional protection
- bcrypt widely supported and trusted

**Consequences:**
- ~100ms delay during backup code redemption
- 8 codes = ~800ms total generation time
- Cost factor tunable if performance becomes issue

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `03-security/auth/authentication-flow.md` - Base authentication system
- [ ] `04-database/schemas/users-orgs.md` - User tables (auth.users)
- [ ] `GLOSSARY.md` - Terms like TOTP, MFA, aal1/aal2, bcrypt
- [ ] `TECH-STACK.md` - Supabase Auth, React, QRCode.js, Web Crypto API

**External Services:**
- Supabase Auth - MFA service provider
- Authenticator Apps - Google Authenticator, Authy, 1Password (user-provided)

### Feature Dependencies

**Depends on this MFA implementation:**
- Organization-wide security policies
- Compliance reporting (SOC 2, ISO 27001)
- Access to production secrets (may require aal2)
- Enterprise SSO integration (MFA + SSO combined)

**Enables these features:**
- Enhanced account security
- Compliance certifications
- Organization-level security policies
- Secure team collaboration

---

## References

### Internal Documentation
- `03-security/auth/authentication-flow.md` - Base authentication system
- `03-security/security-model.md` - Zero-knowledge architecture
- `03-security/rbac/permissions-model.md` - Authorization model
- `TECH-STACK.md` - Technology decisions (Supabase Auth)
- `GLOSSARY.md` - Authentication and MFA terms

### External Resources
- [Supabase Auth MFA Documentation](https://supabase.com/docs/guides/auth/auth-mfa) - Official MFA guide
- [RFC 6238 - TOTP: Time-Based One-Time Password Algorithm](https://tools.ietf.org/html/rfc6238) - TOTP specification
- [OWASP MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) - Security best practices
- [NIST Digital Identity Guidelines (SP 800-63B)](https://pages.nist.gov/800-63-3/sp800-63b.html) - Authentication standards
- [Google Authenticator Key URI Format](https://github.com/google/google-authenticator/wiki/Key-Uri-Format) - otpauth:// URI spec

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Documentation Agent | Initial MFA implementation architecture |

---

## Notes

### Future Enhancements
- **SMS fallback** - Consider for users without smartphones (security trade-off)
- **WebAuthn/FIDO2 support** - Hardware security keys for advanced users
- **Multiple TOTP devices** - Allow users to register 2-3 devices
- **Passwordless authentication** - WebAuthn as primary authentication (not just MFA)
- **Biometric authentication** - Touch ID / Face ID for mobile apps
- **Push notification MFA** - Custom mobile app with push approvals
- **Trusted devices** - Skip MFA on recognized devices (with risk scoring)
- **Adaptive MFA** - Risk-based MFA prompts (unusual location, new device)

### Known Issues
- **Time sync dependency** - TOTP relies on accurate device time (±90 seconds tolerance helps)
- **Lost device without backup codes** - User must contact support (manual recovery)
- **Authenticator app compatibility** - Some obscure apps may not support otpauth:// URIs
- **QR code scanning issues** - Some devices/browsers have camera permission issues (manual entry available)

### Implementation Priorities
**MVP (P0):**
- TOTP enrollment and verification
- Backup code generation and redemption
- Organization MFA enforcement policies
- Basic audit logging

**Post-MVP (P1):**
- Multiple TOTP devices per user
- Enhanced audit reporting
- MFA usage analytics
- Integration with SSO policies

**Future (P2):**
- SMS fallback
- WebAuthn support
- Adaptive MFA
- Push notifications

### Next Review Date
2025-11-29 (review after initial implementation and user feedback)
