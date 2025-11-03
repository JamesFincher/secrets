# AUTHENTICATION FLOW END-TO-END TRACE

**Date:** 2025-11-02  
**Status:** Very Thorough Analysis  
**Purpose:** Complete user authentication journey from signup to accessing encrypted secrets

---

## FLOW 1: NEW USER SIGN UP

### Step 1.1: User Visits Sign Up Page
- **File:** `/Users/james/code/secrets/abyrith-app/app/auth/signup/page.tsx`
- **Status:** EXISTS ✓
- **Component:** `SignUpPage` (client component)
- **What happens:**
  - User enters email + password + confirm password
  - Form validates password is 8+ characters
  - Form validates passwords match
  - On submit, calls `signUp(email, password)` from `useAuth()` hook

### Step 1.2: Supabase Auth Creates User
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 104-125)
- **Function:** `signUp(email, password)`
- **What happens:**
  1. Calls `supabase.auth.signUp({ email, password })`
  2. Supabase creates user in auth.users table
  3. Returns user object and optional session
  4. Sets `user` and `session` in auth store
  5. **CRITICAL:** Does NOT load preferences (new user doesn't have any yet)

### Step 1.3: User Redirected to Master Password Setup
- **File:** `/Users/james/code/secrets/abyrith-app/app/auth/signup/page.tsx` (line 35)
- **Redirect:** `router.push('/auth/setup-master-password')`
- **Status:** CORRECT ✓
- **Why:** New users need to set up master password before using app

### Step 1.4: Master Password Setup Page
- **File:** `/Users/james/code/secrets/abyrith-app/app/auth/setup-master-password/page.tsx`
- **Status:** EXISTS ✓
- **What displays:**
  - Heading: "Set Up Master Password"
  - Requirements list (12 chars, uppercase, lowercase, number, special char)
  - Two password inputs (master password + confirm)
  - Warning: "Never forget this password! Due to zero-knowledge encryption, we cannot recover your master password."
  - "Set Up Master Password" button

### Step 1.5: Master Password Validation
- **File:** `/Users/james/code/secrets/abyrith-app/app/auth/setup-master-password/page.tsx` (lines 22-32)
- **Function Called:** `validatePasswordStrength(masterPassword)`
- **Location:** `/Users/james/code/secrets/abyrith-app/lib/crypto/encryption.ts` (lines 226-256)
- **Validation Rules:**
  - Minimum 12 characters ✓
  - At least one uppercase letter ✓
  - At least one lowercase letter ✓
  - At least one number ✓
  - At least one special character ✓
- **Status:** CORRECT ✓

### Step 1.6: Generate Verification Value (KEK Salt + Verification Data)
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 156-195)
- **Function:** `setupMasterPassword(masterPassword)`
- **Calls:** `generateVerificationValue(masterPassword)`
- **Location:** `/Users/james/code/secrets/abyrith-app/lib/crypto/envelope-encryption.ts` (lines 270-301)
- **What happens:**
  1. Generates 16-byte random salt (SALT_LENGTH)
  2. Generates 12-byte random IV/nonce (NONCE_LENGTH)
  3. Derives KEK from master password + salt using PBKDF2:
     - Algorithm: PBKDF2
     - Hash: SHA-256
     - Iterations: 600,000 (OWASP 2023)
     - Output: 256-bit AES-GCM key
  4. Encrypts test string `"abyrith-verification-v1"` with KEK
  5. Returns encrypted verification structure:
     ```
     {
       ciphertext: base64-encoded encrypted test string
       iv: base64-encoded nonce
       salt: base64-encoded salt
       algorithm: "AES-256-GCM"
       iterations: 600000
     }
     ```

### Step 1.7: Store in user_preferences Table
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 167-174)
- **Database:** `user_preferences` table
- **Schema:** `/Users/james/code/secrets/abyrith-app/supabase/migrations/20241102000001_initial_schema.sql` (lines 124-131)
- **Fields stored:**
  - `user_id`: UUID (primary key, references auth.users)
  - `master_password_verification`: JSONB (encrypted verification value)
    - Contains: ciphertext, iv, salt, algorithm, iterations
  - `theme`: 'system' (default)
  - `notifications_enabled`: true (default)
  - `created_at`: NOW()
  - `updated_at`: NOW()
- **Status:** CORRECT ✓
- **Important:** Salt is stored in the database (this is correct and necessary for deriving KEK later)

### Step 1.8: Update Auth Store
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 179-187)
- **State updated:**
  - `masterPassword`: Set to plaintext master password (memory only)
  - `preferences`: Set to UserPreferences object
  - `kekSalt`: NOT SET at this point (missing!)
  - `isLoading`: false
- **Critical Issue:** `kekSalt` is NOT cached during setup!
- **Status:** BUG - SEE ISSUE #1 BELOW

### Step 1.9: Redirect to Dashboard
- **File:** `/Users/james/code/secrets/abyrith-app/app/auth/setup-master-password/page.tsx` (line 36)
- **Redirect:** `router.push('/dashboard')`
- **Status:** CORRECT ✓

---

## FLOW 2: NEW USER ACCESSES DASHBOARD (FIRST TIME)

### Step 2.1: Dashboard Page Loads
- **File:** `/Users/james/code/secrets/abyrith-app/app/dashboard/page.tsx` (lines 14-72)
- **Checks performed (lines 34-39):**
  ```javascript
  if (!isAuthenticated) {
    router.push('/auth/signin');
  } else if (!preferences) {
    router.push('/auth/setup-master-password');
  }
  ```
- **Status:** CORRECT ✓
- **Result:** User stays on dashboard if authenticated AND has preferences

### Step 2.2: Organizations Auto-Created (lines 48-52)
- Checks if user has no organizations
- Auto-creates organization: `"{user.email}'s Workspace"`
- Status: CORRECT ✓

### Step 2.3: User Can Create Secrets
- **File:** `/Users/james/code/secrets/abyrith-app/components/secrets/create-secret-dialog.tsx`
- **Required:** `masterPassword` from auth store
- **Status:** Depends on masterPassword being available

### CRITICAL ISSUE #1: KEK SALT NOT CACHED DURING SETUP
**Severity:** CRITICAL - Encryption/Decryption will fail  
**Location:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` line 180  
**Problem:**
```typescript
// After setupMasterPassword, state is:
// masterPassword: "user's master password" ✓
// preferences.masterPasswordVerification: { ciphertext, iv, salt, ... } ✓
// kekSalt: null ❌ NOT SET!
```

**Why it matters:** When creating/decrypting secrets, the code needs `kekSalt`:
- Line 105 in secret-store.ts: `const kekSalt = useAuthStore.getState().getKEKSalt();`
- Line 147 in envelope-encryption.ts: `const kekSaltBuffer = base64ToBuffer(kekSalt);`

**Fix needed:** Add this after storing preferences (line 179):
```typescript
set({
  masterPassword,
  preferences: { ... },
  kekSalt: verification.salt,  // ADD THIS LINE!
  isLoading: false,
});
```

---

## FLOW 3: RETURNING USER SIGN IN

### Step 3.1: User Visits Sign In Page
- **File:** `/Users/james/code/secrets/abyrith-app/app/auth/signin/page.tsx`
- **Status:** EXISTS ✓
- **User enters:** email + password
- **Calls:** `signIn(email, password)`

### Step 3.2: Supabase Auth Validates
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 75-99)
- **Function:** `signIn(email, password)`
- **What happens:**
  1. Calls `supabase.auth.signInWithPassword({ email, password })`
  2. Supabase validates email/password against auth.users
  3. Returns user object and session
  4. Sets `user` and `session` in auth store
  5. **Immediately calls:** `loadUserPreferences()` (line 93)

### Step 3.3: Load User Preferences
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 224-254)
- **Function:** `loadUserPreferences()`
- **Query:** 
  ```sql
  SELECT * FROM user_preferences 
  WHERE user_id = {user.id}
  SINGLE ROW
  ```
- **Returns:**
  - `master_password_verification`: EncryptedVerification (with salt)
  - `theme`: string
  - `notifications_enabled`: boolean
- **Stores in state:** `preferences` object
- **Status:** CORRECT ✓

### Step 3.4: User Redirected to Dashboard
- **File:** `/Users/james/code/secrets/abyrith-app/app/auth/signin/page.tsx` (line 22)
- **Redirect:** `router.push('/dashboard')`
- **Status:** CORRECT ✓

### Step 3.5: Dashboard Page Guard
- **File:** `/Users/james/code/secrets/abyrith-app/app/dashboard/page.tsx` (lines 34-39)
- **Check:** User authenticated AND has preferences
- **If NOT authenticated:** Redirects to /auth/signin
- **If NOT preferences:** Redirects to /auth/setup-master-password
- **Status:** CORRECT ✓

### CRITICAL ISSUE #2: MASTER PASSWORD NOT VERIFIED ON SIGNIN
**Severity:** HIGH - User can access dashboard without unlocking  
**Location:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` line 93  
**Problem:**
```typescript
// After signIn:
// user: loaded ✓
// session: loaded ✓
// preferences: loaded ✓
// masterPassword: null ❌ NOT VERIFIED!
// kekSalt: null ❌ NOT CACHED!
```

**What's missing:**
The flow loads preferences but does NOT prompt user to verify master password.
- `useAuth()` returns `hasMasterPassword = !!masterPassword` (false after signin)
- User can view dashboard but CANNOT decrypt secrets (no masterPassword in memory)

**Current behavior:**
1. User signs in
2. User sees dashboard
3. User clicks "Reveal" on secret card
4. Code checks `if (!masterPassword)` → shows alert
5. User is blocked from decrypting

**Better behavior (needed):**
1. User signs in
2. If preferences exist, show master password verification dialog
3. User enters master password
4. Code verifies against stored verification value
5. If valid, cache masterPassword + kekSalt in memory
6. User can then access dashboard and decrypt secrets

---

## FLOW 4: DECRYPTING SECRETS (CRITICAL PATH)

### Step 4.1: User Clicks "Reveal" on Secret Card
- **File:** `/Users/james/code/secrets/abyrith-app/components/secrets/secret-card.tsx` (lines 25-46)
- **Function:** `handleReveal()`
- **Check 1 (line 26-28):** Is secret already decrypted?
  - If yes: Toggle visibility
  - If no: Proceed to decrypt
- **Check 2 (line 31):** Does masterPassword exist in store?
  - If no: Alert "Master password not available. Please unlock your vault."
  - **Status:** This is where the bug manifests!

### Step 4.2: Decrypt Secret with Master Password
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/secret-store.ts`
- **Function:** `decryptSecret(secret, masterPassword)`
- **What happens:**
  1. Calls envelope-encryption `decryptSecret()` function
  2. Gets KEK salt from auth store: `useAuthStore.getState().getKEKSalt()`
  3. **Critical:** If no KEK salt, throws error: "Master password session expired"
  4. Derives KEK from masterPassword + kekSalt using PBKDF2
  5. Decrypts DEK using KEK
  6. Decrypts secret value using DEK
  7. Stores decrypted value in memory cache
  8. Returns plaintext secret value

### Step 4.3: Envelope Encryption Decryption Process
- **File:** `/Users/james/code/secrets/abyrith-app/lib/crypto/envelope-encryption.ts` (lines 195-261)
- **Function:** `decryptSecret(encryptedSecret, masterPassword, kekSalt)`
- **Two-layer decryption:**
  ```
  Database (encrypted):
  ├─ encrypted_value (AES-256-GCM with DEK)
  ├─ encrypted_dek (AES-256-GCM with KEK)
  ├─ secret_nonce (IV for secret encryption)
  ├─ dek_nonce (IV for DEK encryption)
  └─ auth_tag (authentication tag)
  
  Decryption (client-side):
  1. Import kekSalt (base64 to Uint8Array)
  2. Derive KEK = PBKDF2(masterPassword, kekSalt, 600k iterations)
  3. Decrypt DEK using KEK
  4. Decrypt secret value using DEK
  5. Return plaintext secret
  ```
- **Security:** Server NEVER has master password or KEK
- **Status:** CORRECT ✓ (if KEK salt is available)

---

## FLOW 5: SESSION MANAGEMENT & AUTH LISTENER

### Step 5.1: Auth State Listener Initialization
- **File:** `/Users/james/code/secrets/abyrith-app/app/providers.tsx` (lines 25-29)
- **When:** App mounts (in Providers component)
- **Function:** `initAuthListener()`
- **What happens:** Calls `supabase.auth.onAuthStateChange((event, session) => { ... })`

### Step 5.2: Auth State Change Events
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 271-288)
- **Function:** `initAuthListener()`
- **Events handled:**
  1. **SIGNED_IN:** 
     - Sets user and session
     - Loads user preferences
     - **Missing:** Verify master password! (No prompt shown)
  2. **SIGNED_OUT:**
     - Clears user, session, masterPassword, kekSalt
     - Clears preferences
     - **Status:** CORRECT ✓
  3. **TOKEN_REFRESHED:**
     - Updates session
     - **Missing:** Should re-verify master password? (Depends on design)

### Step 5.3: Master Password Persistence
- **File:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts` (lines 256-263)
- **Zustand persist middleware:**
  ```typescript
  partialize: (state) => ({
    user: state.user,
    session: state.session,
  }),
  ```
- **What persists:** user, session
- **What does NOT persist:** masterPassword, kekSalt, preferences
- **Status:** CORRECT ✓
- **Why:** Master password should NEVER be persisted to localStorage
- **Consequence:** User must re-verify master password on page refresh

---

## VERIFICATION CHECKLIST

- [x] Sign-up page exists and is complete
- [x] Sign-in page exists and is complete
- [x] Supabase Auth integration working
- [x] Master password setup page exists
- [x] Master password validation (strength) exists
- [x] Verification value generation exists
- [x] Verification value stored in database
- [x] KEK salt stored in database (in verification.salt)
- [x] User preferences table has all required fields
- [x] Dashboard loads after signup/signin
- [x] Sign-out clears sensitive data
- [x] Session listeners configured
- [x] Auth state persists correctly
- [ ] Master password verification prompted after signin
- [ ] KEK salt cached in memory during setup
- [ ] KEK salt cached in memory after signin verification
- [ ] Master password timeout/re-verification mechanism

---

## ISSUES FOUND

### CRITICAL ISSUES

#### Issue #1: KEK Salt NOT Cached During Setup
- **Severity:** CRITICAL
- **Location:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts:180`
- **Problem:** After `setupMasterPassword()`, the `kekSalt` state is not set
- **Impact:** Secrets created during initial setup will fail to decrypt later
- **Fix:** Add `kekSalt: verification.salt` to state update
- **Code location:** Line 179-187

#### Issue #2: No Master Password Verification After Signin
- **Severity:** HIGH
- **Location:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts:93`
- **Problem:** `signIn()` loads preferences but does NOT verify master password
- **Impact:** 
  - User sees dashboard but cannot decrypt secrets until manually entering password
  - No UI component prompts for master password
  - User experience is broken
- **Fix:** Add master password verification prompt after signin
- **Missing component:** Master password unlock dialog doesn't exist
- **Expected flow:** 
  1. Signin successful
  2. Load preferences
  3. Show master password prompt dialog
  4. User enters password
  5. Verify against stored verification value
  6. If valid, cache masterPassword + kekSalt
  7. Then allow dashboard access

#### Issue #3: No Master Password Verification on Auth State Change
- **Severity:** HIGH
- **Location:** `/Users/james/code/secrets/abyrith-app/lib/stores/auth-store.ts:275-278`
- **Problem:** SIGNED_IN event does not verify master password
- **Impact:** Same as Issue #2 - user can't decrypt secrets
- **Fix:** Call `verifyMasterPassword()` after signin event (needs UI component)

### MAJOR ISSUES

#### Issue #4: Missing Master Password Prompt Component
- **Severity:** MAJOR
- **Location:** No file - doesn't exist
- **Problem:** No UI component to prompt user for master password
- **Impact:** No way for user to unlock vault after signin
- **Fix:** Create new component: `components/auth/master-password-prompt.tsx`
- **Should display:**
  - "Unlock Your Vault"
  - Password input field
  - Submit button
  - Status: "Verifying..." while checking

#### Issue #5: Master Password Not Re-Verified on Page Refresh
- **Severity:** MAJOR
- **Location:** Master password is not persisted (correct) but also not re-verified
- **Problem:** User must re-verify master password on every page refresh
- **Expected behavior:** Either:
  - Option A: Keep master password in sessionStorage during current browser session
  - Option B: Require re-verification on every refresh (current, but undiscovered)
- **Fix:** Add sessionStorage persistence with optional timeout

### MINOR ISSUES

#### Issue #6: No Master Password Timeout
- **Severity:** MINOR
- **Location:** Auth store
- **Problem:** Master password cached indefinitely in memory
- **Better:** Should timeout after 15-30 minutes of inactivity
- **Fix:** Add timeout mechanism to auth store

#### Issue #7: Verification Value String Mismatch
- **Severity:** MINOR
- **Location:** `/Users/james/code/secrets/abyrith-app/lib/crypto/envelope-encryption.ts:273` vs `encryption.ts:190`
- **Problem:** Two different verification strings used:
  - `envelope-encryption.ts`: `'abyrith-verification-v1'`
  - `encryption.ts`: `'abyrith-verification'`
- **Status:** Not a bug (different files for different use cases) but confusing
- **Fix:** Use consistent string or add comment explaining difference

---

## INTEGRATION TEST CASES

### Test Case 1: New User Signup to First Secret Creation
1. Go to `/auth/signup`
2. Enter email: `test@example.com`
3. Enter password: `SecurePass123!`
4. Confirm password: `SecurePass123!`
5. Click "Sign Up"
   - Expected: Redirect to `/auth/setup-master-password`
6. Enter master password: `MyVaultPassword123!`
7. Confirm password: `MyVaultPassword123!`
8. Click "Set Up Master Password"
   - Expected: Redirect to `/dashboard`
   - Actual: Dashboard loads
9. Create project: "Test Project"
10. Create environment: "Development"
11. Create secret: key="API_KEY", value="sk_test_123456"
    - **BUG**: Will fail because kekSalt not cached (Issue #1)

### Test Case 2: Returning User Signin and Access Secrets
1. Go to `/auth/signin`
2. Enter email: `test@example.com`
3. Enter password: `SecurePass123!`
4. Click "Sign In"
   - Expected: Redirect to `/dashboard`
   - Actual: Redirect to `/dashboard` BUT...
5. See list of secrets from previous session
6. Click "Reveal" on secret
   - **BUG**: Shows alert "Master password not available. Please unlock your vault."
   - Expected: Should show master password prompt (Issue #2)

### Test Case 3: Secret Encryption/Decryption Flow
1. Create secret with value `"my-secret-value"`
2. Secret stored with encryption:
   - encrypted_value (AES-256-GCM with DEK)
   - encrypted_dek (AES-256-GCM with KEK)
   - auth_tag (GCM authentication tag)
3. Click "Reveal"
4. Code flow:
   - Gets masterPassword from store
   - Gets kekSalt from store
   - Derives KEK from masterPassword + kekSalt
   - Decrypts DEK using KEK
   - Decrypts secret value using DEK
   - Returns plaintext "my-secret-value"
5. User sees decrypted value
   - **Status:** Works IF Issue #1 & #2 are fixed

---

## SUMMARY: Integration Points Needing Attention

| Component | File | Issue | Severity |
|-----------|------|-------|----------|
| Auth Store | `auth-store.ts` | KEK salt not cached after setup | CRITICAL |
| Auth Store | `auth-store.ts` | No master password verification after signin | HIGH |
| Auth Listener | `auth-store.ts` | No master password verification on SIGNED_IN event | HIGH |
| UI Component | Missing | No master password prompt dialog | MAJOR |
| Secret Creation | `secret-store.ts` | Depends on KEK salt being available | CRITICAL |
| Secret Decryption | `secret-card.tsx` | Depends on master password being verified | CRITICAL |
| Crypto | `envelope-encryption.ts` | Implementation is correct | OK ✓ |
| Database | Schema OK | All required fields present | OK ✓ |
| Supabase Auth | Working | Integration is correct | OK ✓ |

---

## AUTHENTICATION FLOW DIAGRAM (Current Implementation)

```
SIGNUP FLOW:
┌──────────────────┐
│ Sign Up Page     │
│ (email/password) │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Supabase Auth: signUp()              │
│ ✓ User created in auth.users         │
│ ✓ Session returned                   │
│ ✓ Auth store updated                 │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Setup Master Password Page           │
│ ✓ Validates password strength        │
│ ✓ Generates KEK salt + verification │
│ ✓ Stores in user_preferences        │
│ ❌ Does NOT cache kekSalt in memory │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Dashboard        │
│ ✓ Can view UI    │
│ ❌ Cannot create │
│    secrets (no   │
│    kekSalt)      │
└──────────────────┘

SIGNIN FLOW:
┌──────────────────┐
│ Sign In Page     │
│ (email/password) │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Supabase Auth: signInWithPassword()  │
│ ✓ User authenticated                 │
│ ✓ Session returned                   │
│ ✓ Auth store updated                 │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Load User Preferences                │
│ ✓ master_password_verification      │
│ ✓ Preferences loaded                │
│ ❌ No master password verification  │
│ ❌ No kekSalt cached                │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Dashboard        │
│ ✓ Can view UI    │
│ ❌ Cannot decrypt│
│    secrets (no   │
│    masterPassword)│
└──────────────────┘

SECRET DECRYPTION:
┌──────────────────┐
│ Click "Reveal"   │
│ on Secret Card   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Check masterPassword in store        │
│ ❌ Not available (not verified)      │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Alert: "Master   │
│ password not     │
│ available"       │
└──────────────────┘
```

---

## RECOMMENDED FIXES (Priority Order)

### 1. Add KEK Salt Caching (CRITICAL - 2 minutes)
```typescript
// File: auth-store.ts, line 179
set({
  masterPassword,
  preferences: {
    masterPasswordVerification: verification,
    theme: 'system',
    notificationsEnabled: true,
  },
  kekSalt: verification.salt,  // ADD THIS
  isLoading: false,
});
```

### 2. Add Master Password Verification After Signin (HIGH - 30 minutes)
- Create new component: `components/auth/master-password-prompt.tsx`
- Show after signin if preferences exist
- Verify against `preferences.masterPasswordVerification`
- Cache `masterPassword` and `kekSalt` on success
- Redirect to dashboard on success

### 3. Handle Auth State Changes (HIGH - 15 minutes)
- Update `initAuthListener()` to prompt for master password on SIGNED_IN

### 4. Add Master Password Timeout (MINOR - 15 minutes)
- Set timeout in auth store (30 minutes default)
- Clear on timeout
- Re-prompt user to verify

---

**Prepared by:** Authentication Flow Trace Analysis  
**Completion Date:** 2025-11-02  
**Files Analyzed:** 15  
**Issues Found:** 7 (2 Critical, 3 High, 1 Major, 1 Minor)
