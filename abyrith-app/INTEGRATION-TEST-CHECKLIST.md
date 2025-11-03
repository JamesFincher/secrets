# Integration Test Checklist

**Date:** 2025-11-02
**Purpose:** Verify encryption integration fixes are working correctly

---

## Pre-Testing Setup

### 1. Apply Database Migration

```bash
cd abyrith-app
supabase db reset
```

**Expected:** Migration `20241102000004_add_kek_salt.sql` should be applied.

### 2. Verify Database Schema

```sql
-- Check that kek_salt column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_preferences'
AND column_name = 'kek_salt';
```

**Expected Output:**
```
column_name | data_type | is_nullable
kek_salt    | text      | YES
```

### 3. Start Development Server

```bash
cd abyrith-app
npm run dev
```

**Expected:** App running on http://localhost:3000

---

## Test Suite

### ✅ Test 1: Master Password Setup

**Steps:**
1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Enter email and password
4. Complete signup
5. You should be redirected to "Setup Master Password"
6. Enter a strong master password (12+ chars, uppercase, lowercase, number, special)
7. Submit

**Expected Results:**
- ✅ Master password is accepted
- ✅ User is redirected to dashboard
- ✅ Database: `user_preferences.kek_salt` is populated
- ✅ Database: `user_preferences.master_password_verification` contains encrypted verification

**Verification Query:**
```sql
SELECT
  user_id,
  kek_salt IS NOT NULL as has_kek_salt,
  master_password_verification IS NOT NULL as has_verification
FROM user_preferences;
```

**Expected:** Both columns should return `true`

---

### ✅ Test 2: Create Secret with Master Password in Memory

**Prerequisites:** Completed Test 1 (master password still in memory)

**Steps:**
1. On dashboard, click "Create Project"
2. Enter project name: "Test Project"
3. Click "Create"
4. Select the project
5. Click "Add Secret"
6. Enter:
   - Key: `TEST_API_KEY`
   - Value: `sk-test-123456789`
   - Service: `Test Service`
   - Description: `Test secret`
7. Click "Create Secret"

**Expected Results:**
- ✅ Secret is created successfully
- ✅ No master password prompt shown (password already in memory)
- ✅ Secret appears in list as "TEST_API_KEY"
- ✅ Database: `secrets.encrypted_value` contains encrypted data
- ✅ Database: `secrets.encrypted_dek` contains encrypted DEK
- ✅ Database: All envelope encryption fields populated

**Verification Query:**
```sql
SELECT
  key,
  encrypted_value IS NOT NULL as has_encrypted_value,
  encrypted_dek IS NOT NULL as has_encrypted_dek,
  secret_nonce IS NOT NULL as has_secret_nonce,
  dek_nonce IS NOT NULL as has_dek_nonce,
  auth_tag IS NOT NULL as has_auth_tag
FROM secrets
WHERE key = 'TEST_API_KEY';
```

**Expected:** All columns should return `true`

---

### ✅ Test 3: Create Secret WITHOUT Master Password (Prompt Test)

**Prerequisites:**
- Completed Test 2
- Need to clear master password from memory

**Steps to Clear Master Password:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run:
   ```javascript
   // Clear master password from Zustand store
   window.useAuthStore.getState().clearMasterPassword()
   ```
4. Verify it's cleared:
   ```javascript
   console.log(window.useAuthStore.getState().masterPassword) // Should be null
   ```

**Test Steps:**
1. Click "Add Secret"
2. Enter:
   - Key: `TEST_API_KEY_2`
   - Value: `sk-test-987654321`
3. Click "Create Secret"

**Expected Results:**
- ✅ Master password prompt dialog appears
- ✅ Dialog shows: "Unlock Your Vault"
- ✅ Enter your master password
- ✅ Click "Unlock Vault"
- ✅ Dialog closes
- ✅ Secret is created automatically
- ✅ Toast notification: "Vault unlocked successfully"
- ✅ Toast notification: "Secret created" (or similar)

**Verification:**
- ✅ Secret appears in list
- ✅ Master password is now cached in memory again

---

### ✅ Test 4: Reveal Secret with Master Password in Memory

**Prerequisites:** Completed Test 3 (master password in memory)

**Steps:**
1. Find "TEST_API_KEY" in secrets list
2. Click "Reveal" button

**Expected Results:**
- ✅ No master password prompt (password already in memory)
- ✅ Secret value appears: `sk-test-123456789`
- ✅ Button changes to "Hide"
- ✅ "Copy" button appears
- ✅ Click "Copy" - value copied to clipboard

---

### ✅ Test 5: Reveal Secret WITHOUT Master Password (Prompt Test)

**Prerequisites:** Completed Test 4

**Steps to Clear Master Password:**
1. Open DevTools Console
2. Run:
   ```javascript
   window.useAuthStore.getState().clearMasterPassword()
   ```

**Test Steps:**
1. Find "TEST_API_KEY_2" in secrets list
2. Click "Reveal" button

**Expected Results:**
- ✅ Master password prompt dialog appears
- ✅ Enter master password
- ✅ Click "Unlock Vault"
- ✅ Dialog closes
- ✅ Secret value appears automatically: `sk-test-987654321`
- ✅ No need to click "Reveal" again

---

### ✅ Test 6: Guided Acquisition with Master Password

**Prerequisites:** Master password in memory

**Steps:**
1. Navigate to Dashboard
2. Click "AI Assistant" button
3. In AI chat, type: "Help me get an OpenAI API key"
4. Wait for AI response
5. Follow guided acquisition wizard:
   - Select "OpenAI" service
   - Click through documentation steps
   - When prompted, enter a test API key: `sk-test-openai-12345`
   - Click "Save & Finish"

**Expected Results:**
- ✅ No master password prompt (password in memory)
- ✅ Secret saved successfully
- ✅ Secret appears in secrets list
- ✅ Key name: `OPENAI_API_KEY` (or similar)

---

### ✅ Test 7: Guided Acquisition WITHOUT Master Password

**Prerequisites:**
- Completed Test 6
- Clear master password from memory

**Steps to Clear:**
```javascript
window.useAuthStore.getState().clearMasterPassword()
```

**Test Steps:**
1. Start guided acquisition again
2. Complete wizard steps
3. Enter test API key: `sk-test-openai-67890`
4. Click "Save & Finish"

**Expected Results:**
- ✅ Master password prompt appears
- ✅ Enter master password
- ✅ Dialog closes
- ✅ Secret saved automatically
- ✅ Wizard completes successfully

---

### ✅ Test 8: Session Persistence

**Steps:**
1. Sign in with existing account
2. Enter master password when prompted
3. Create a secret
4. Refresh page (F5)
5. Try to reveal a secret

**Expected Results:**
- ✅ After refresh, master password is NOT in memory (security)
- ✅ Clicking "Reveal" shows master password prompt
- ✅ After entering password, secret is revealed
- ✅ KEK salt is loaded from database (not regenerated)

**Verification Query:**
```sql
-- Check that kek_salt hasn't changed
SELECT user_id, kek_salt, updated_at
FROM user_preferences
WHERE user_id = '[your-user-id]';
```

**Expected:** `kek_salt` should remain constant across sessions

---

### ✅ Test 9: Sign Out and Clear State

**Steps:**
1. Click "Sign Out"
2. Check DevTools Console:
   ```javascript
   console.log(window.useAuthStore.getState().masterPassword) // Should be null
   console.log(window.useAuthStore.getState().kekSalt) // Should be null
   ```

**Expected Results:**
- ✅ Master password cleared from memory
- ✅ KEK salt cleared from memory
- ✅ User redirected to sign-in page

---

### ✅ Test 10: Invalid Master Password Handling

**Steps:**
1. Sign in
2. Clear master password from memory
3. Try to reveal a secret
4. Master password prompt appears
5. Enter WRONG password
6. Click "Unlock Vault"

**Expected Results:**
- ✅ Error toast: "Invalid master password"
- ✅ Dialog remains open
- ✅ Can try again
- ✅ Enter correct password
- ✅ Secret reveals successfully

---

## Performance Tests

### Test 11: KEK Salt Caching Performance

**Steps:**
1. Sign in and verify master password
2. Open DevTools Performance tab
3. Start recording
4. Create 10 secrets rapidly
5. Stop recording

**Expected Results:**
- ✅ Only ONE PBKDF2 key derivation at the start (when verifying master password)
- ✅ All subsequent encryptions use cached KEK salt
- ✅ No additional 600,000-iteration PBKDF2 calls
- ✅ Encryption operations complete in <100ms each

**How to Verify:**
- Look for `crypto.subtle.deriveKey` calls in Performance timeline
- Should see only 1 call for KEK derivation
- Should see multiple `crypto.subtle.encrypt` calls (fast)

---

## Database Verification

### Test 12: Envelope Encryption Schema

**Query:**
```sql
SELECT
  s.key,
  s.algorithm,
  length(s.encrypted_value) as encrypted_value_length,
  length(s.encrypted_dek) as encrypted_dek_length,
  length(s.secret_nonce) as secret_nonce_length,
  length(s.dek_nonce) as dek_nonce_length,
  length(s.auth_tag) as auth_tag_length,
  up.kek_salt IS NOT NULL as user_has_kek_salt
FROM secrets s
JOIN user_preferences up ON s.created_by = up.user_id
LIMIT 5;
```

**Expected Output:**
- `algorithm`: "AES-256-GCM"
- `encrypted_value_length`: Variable (depends on secret length)
- `encrypted_dek_length`: ~64 bytes (base64 of encrypted 32-byte key)
- `secret_nonce_length`: 16 bytes (base64 of 12 bytes)
- `dek_nonce_length`: 16 bytes (base64 of 12 bytes)
- `auth_tag_length`: ~24 bytes (base64 of 16 bytes)
- `user_has_kek_salt`: true

---

## Error Handling Tests

### Test 13: Corrupted Secret Handling

**Steps:**
1. Create a secret normally
2. In database, corrupt the `encrypted_value`:
   ```sql
   UPDATE secrets
   SET encrypted_value = 'corrupted-data-12345'
   WHERE key = 'TEST_API_KEY'
   LIMIT 1;
   ```
3. Try to reveal the secret

**Expected Results:**
- ✅ Error message: "Failed to decrypt secret"
- ✅ No app crash
- ✅ Other secrets still work

### Test 14: Wrong Master Password After Creation

**Scenario:** User changes master password externally

**Steps:**
1. Create secret with Master Password A
2. In database, change master password verification:
   ```sql
   -- This simulates changing master password
   -- (Don't actually do this - just simulate the scenario)
   ```
3. Sign out and sign back in
4. Enter different master password
5. Try to reveal old secret

**Expected Results:**
- ✅ Decryption fails (password mismatch)
- ✅ Error message shown
- ✅ No data corruption

---

## Success Criteria

### All Tests Must Pass:
- ✅ Test 1: Master password setup
- ✅ Test 2: Create secret (with password)
- ✅ Test 3: Create secret (prompt)
- ✅ Test 4: Reveal secret (with password)
- ✅ Test 5: Reveal secret (prompt)
- ✅ Test 6: Guided acquisition (with password)
- ✅ Test 7: Guided acquisition (prompt)
- ✅ Test 8: Session persistence
- ✅ Test 9: Sign out cleanup
- ✅ Test 10: Invalid password handling
- ✅ Test 11: KEK salt caching performance
- ✅ Test 12: Database schema verification
- ✅ Test 13: Corrupted secret handling
- ✅ Test 14: Wrong password handling

### Key Metrics:
- **Performance:** KEK derivation happens only once per session
- **Security:** Master password never transmitted to server
- **UX:** Master password prompt appears when needed, auto-retries on success
- **Reliability:** All encryption/decryption operations succeed with correct password

---

## Troubleshooting

### Issue: "Cannot find module '@/components/ui/dialog'"

**Fix:**
```bash
cd abyrith-app
npx shadcn@latest add dialog
```

### Issue: Migration not applied

**Fix:**
```bash
cd abyrith-app
supabase db reset
```

### Issue: Master password prompt doesn't appear

**Check:**
1. DevTools Console for errors
2. Verify `MasterPasswordPrompt` component imported
3. Check that `showMasterPasswordPrompt` state is set to `true`

### Issue: Decryption fails after refresh

**Check:**
1. Is `kek_salt` in database?
   ```sql
   SELECT kek_salt FROM user_preferences;
   ```
2. Is `kekSalt` loaded in auth store?
   ```javascript
   console.log(window.useAuthStore.getState().kekSalt)
   ```

---

## Report Template

After completing all tests, fill out this report:

```
=== INTEGRATION TEST REPORT ===

Date: [DATE]
Tester: [NAME]
Environment: [dev/staging/prod]

Test Results:
- Test 1: [PASS/FAIL] - Notes: ___
- Test 2: [PASS/FAIL] - Notes: ___
- Test 3: [PASS/FAIL] - Notes: ___
- Test 4: [PASS/FAIL] - Notes: ___
- Test 5: [PASS/FAIL] - Notes: ___
- Test 6: [PASS/FAIL] - Notes: ___
- Test 7: [PASS/FAIL] - Notes: ___
- Test 8: [PASS/FAIL] - Notes: ___
- Test 9: [PASS/FAIL] - Notes: ___
- Test 10: [PASS/FAIL] - Notes: ___
- Test 11: [PASS/FAIL] - Notes: ___
- Test 12: [PASS/FAIL] - Notes: ___
- Test 13: [PASS/FAIL] - Notes: ___
- Test 14: [PASS/FAIL] - Notes: ___

Overall Status: [PASS/FAIL]

Issues Found:
1. ___
2. ___

Performance Metrics:
- KEK derivation time: ___ ms
- Encryption time (avg): ___ ms
- Decryption time (avg): ___ ms

Recommendations:
- ___
- ___
```

---

**Next Step:** Run through all tests and report results.
