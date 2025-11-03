# Integration Test Plan - Abyrith MVP

## Overview
This document defines the integration tests required to verify end-to-end functionality before launch. The plan includes manual test procedures, automated test infrastructure, and validation criteria to ensure all critical paths work correctly with real services.

**Testing Philosophy:**
- Test with REAL services (Supabase, Anthropic API, FireCrawl)
- Verify encryption/decryption end-to-end
- Validate RLS policies in practice
- Measure performance under realistic conditions
- Document results for audit trail

**Total Estimated Time:** ~90-120 minutes for complete manual execution

---

## Test Environment Setup

### Prerequisites

**Required Services:**
- Supabase project (production or dedicated test project)
- Cloudflare Workers deployed or running locally (`npm run dev` in workers/)
- Next.js app running (`npm run dev` in abyrith-app/)
- All API keys configured

**Required Tools:**
- Modern browser (Chrome/Firefox) with DevTools
- Supabase Studio access for database inspection
- Terminal for running services
- (Optional) Playwright for automated tests

### Configuration Steps

1. **Environment Variables**
   ```bash
   # Copy example file
   cp abyrith-app/.env.local.example abyrith-app/.env.local

   # Fill in required values:
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Worker Configuration**
   ```bash
   # Copy example file
   cp abyrith-app/workers/.env.example abyrith-app/workers/.dev.vars

   # Fill in required values:
   ANTHROPIC_API_KEY=sk-ant-your-key
   FIRECRAWL_API_KEY=fc-your-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

3. **Start Services**
   ```bash
   # Terminal 1: Start Next.js app
   cd abyrith-app
   npm run dev
   # Should run on http://localhost:3000

   # Terminal 2: Start Cloudflare Workers
   cd abyrith-app/workers
   npm run dev
   # Should run on http://localhost:8787
   ```

4. **Verify Database Migrations**
   ```bash
   # Check Supabase Studio -> SQL Editor
   # Verify all tables exist:
   # - auth.users (built-in)
   # - public.projects
   # - public.user_preferences
   # - public.secrets
   # - public.secret_versions
   # - public.audit_logs
   # - public.conversations
   # - public.messages
   ```

---

## Critical Integration Tests

### Test Suite 1: Authentication Flow (15 min)

#### Test 1.1: User Registration

**Objective:** Verify new user can sign up and initial data is created

**Steps:**
1. Navigate to `http://localhost:3000/auth/signup`
2. Enter test email: `test-${timestamp}@example.com`
3. Enter secure password: `SecureTestPassword123!`
4. Click "Sign Up"
5. If email confirmation required, check email and confirm
6. Verify redirect to dashboard or onboarding

**Expected Results:**
- ✅ User created in `auth.users` table
- ✅ Default project created in `public.projects` table with name "Personal"
- ✅ User preferences created in `public.user_preferences` table
- ✅ Session token set in browser cookies
- ✅ Redirect to `/dashboard` or master password setup

**Verification Queries:**
```sql
-- Check user exists
SELECT id, email, created_at FROM auth.users
WHERE email = 'test-email@example.com';

-- Check project created
SELECT id, name, user_id FROM public.projects
WHERE user_id = '[user-id-from-above]';

-- Check preferences created
SELECT user_id, kek_salt, created_at FROM public.user_preferences
WHERE user_id = '[user-id]';
```

**Pass Criteria:**
- All database entries created
- User can access dashboard
- No console errors in DevTools

---

#### Test 1.2: User Login

**Objective:** Verify existing user can authenticate

**Steps:**
1. Logout if currently logged in
2. Navigate to `http://localhost:3000/auth/login`
3. Enter credentials from Test 1.1
4. Click "Sign In"
5. Verify redirect to dashboard

**Expected Results:**
- ✅ Session token set
- ✅ Redirect to `/dashboard`
- ✅ User ID available in app state
- ✅ Projects and secrets loaded (if any exist)

**Verification:**
- Open DevTools -> Application -> Cookies
- Verify Supabase auth cookies present
- Check Network tab for successful API calls

**Pass Criteria:**
- Successful login with correct credentials
- Failed login with wrong password shows error
- Session persists on page refresh

---

#### Test 1.3: Master Password Setup (Zero-Knowledge Encryption)

**Objective:** Verify KEK generation and vault unlock flow

**Steps:**
1. Login as new user (from Test 1.1)
2. Should be prompted for master password setup
3. Enter master password: `MasterSecret123!`
4. Confirm master password: `MasterSecret123!`
5. Click "Setup Encryption"
6. Wait for vault to unlock

**Expected Results:**
- ✅ KEK generated from master password using PBKDF2
- ✅ KEK salt stored in `user_preferences.kek_salt`
- ✅ Vault status changes to "unlocked"
- ✅ User can now create encrypted secrets

**Verification Queries:**
```sql
-- Check KEK salt stored
SELECT user_id, kek_salt, LENGTH(kek_salt) as salt_length
FROM public.user_preferences
WHERE user_id = '[user-id]';

-- Salt should be 44 characters (32 bytes base64 encoded)
```

**Verification (Browser):**
- Open DevTools -> Console
- Check for encryption library initialization logs
- Verify no plaintext master password in memory (use debugger)

**Pass Criteria:**
- KEK salt stored (32-byte base64 string)
- Vault unlocks successfully
- Re-entering correct master password unlocks vault
- Wrong master password shows error

---

### Test Suite 2: Secret CRUD Operations (20 min)

#### Test 2.1: Create Secret

**Objective:** Verify secret encryption and storage

**Steps:**
1. Login and unlock vault (master password entered)
2. Navigate to secrets page (`/dashboard/secrets`)
3. Click "New Secret" or "+" button
4. Fill in form:
   - Name: `STRIPE_API_KEY`
   - Value: `sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxx`
   - Description: `Test Stripe API key for development`
5. Click "Save" or "Create"
6. Wait for success message

**Expected Results:**
- ✅ Secret encrypted client-side with KEK
- ✅ Encrypted secret stored in `public.secrets` table
- ✅ Secret appears in secrets list
- ✅ Secret value is masked by default (shows `••••••••`)
- ✅ Audit log entry created

**CRITICAL: Zero-Knowledge Verification**

**DevTools Network Tab:**
1. Open DevTools -> Network tab
2. Filter for API calls to Supabase
3. Click on the POST request to `/rest/v1/secrets`
4. Check Request Payload
5. **VERIFY:** `encrypted_value` is base64 gibberish
6. **VERIFY:** Plaintext value `sk_test_51H...` NEVER appears in request

**Database Verification:**
```sql
-- Check secret stored encrypted
SELECT
  id,
  name,
  encrypted_value,
  description,
  user_id,
  project_id
FROM public.secrets
WHERE name = 'STRIPE_API_KEY';

-- encrypted_value should be base64 gibberish like:
-- "AQIDBAUGBwgJ..." (NOT the plaintext value!)
```

**Pass Criteria:**
- Secret appears in list
- Server NEVER receives plaintext value
- Encrypted value in database is unreadable
- Audit log records "secret_created" event

---

#### Test 2.2: Read Secret (Decrypt and Display)

**Objective:** Verify client-side decryption

**Steps:**
1. Navigate to secrets list
2. Click on the secret created in Test 2.1
3. Secret detail view should show masked value initially
4. Click "Show" or eye icon to reveal value
5. If vault locked, enter master password
6. Verify plaintext value displayed

**Expected Results:**
- ✅ Secret decrypted client-side with KEK
- ✅ Plaintext value displays correctly
- ✅ Click "Hide" to mask value again
- ✅ Audit log entry created for "secret_accessed"

**CRITICAL: Zero-Knowledge Verification**

**DevTools Network Tab:**
1. Open Network tab before revealing secret
2. Click "Show" to reveal value
3. Check Network tab for API calls
4. **VERIFY:** GET request to `/rest/v1/secrets` returns `encrypted_value`
5. **VERIFY:** Plaintext value NEVER sent from server
6. **VERIFY:** Decryption happens in browser (check Console for crypto logs)

**Pass Criteria:**
- Correct plaintext value displayed
- Value matches what was entered in Test 2.1
- Network shows only encrypted data transmitted
- Copy button copies plaintext to clipboard

---

#### Test 2.3: Update Secret

**Objective:** Verify secret update and versioning

**Steps:**
1. Navigate to secret detail view
2. Click "Edit" button
3. Change value to new value: `sk_test_51Hyyyyyyyyyyyyyyyyyyyyyy`
4. Update description: `Updated test key`
5. Click "Save"
6. Verify updated value displays

**Expected Results:**
- ✅ New encrypted version stored in `public.secrets.encrypted_value`
- ✅ Old version stored in `public.secret_versions` table
- ✅ Updated secret displays correct new value
- ✅ Version number incremented
- ✅ Audit log entry created for "secret_updated"

**Verification Queries:**
```sql
-- Check current version
SELECT
  id,
  name,
  encrypted_value,
  version,
  updated_at
FROM public.secrets
WHERE name = 'STRIPE_API_KEY';

-- Check version history
SELECT
  id,
  secret_id,
  version,
  encrypted_value,
  created_at
FROM public.secret_versions
WHERE secret_id = '[secret-id-from-above]'
ORDER BY version DESC;
```

**Pass Criteria:**
- New value decrypts correctly
- Old value preserved in secret_versions
- Audit log shows update action
- No data loss during update

---

#### Test 2.4: Delete Secret

**Objective:** Verify soft delete and audit trail

**Steps:**
1. Navigate to secret detail view
2. Click "Delete" button
3. Confirm deletion in modal
4. Verify secret no longer appears in list

**Expected Results:**
- ✅ Secret marked as deleted (soft delete via `deleted_at` timestamp)
- ✅ Secret no longer appears in UI
- ✅ Audit log entry created for "secret_deleted"
- ✅ Secret data preserved in database (soft delete, not hard delete)

**Verification Queries:**
```sql
-- Check secret soft deleted
SELECT
  id,
  name,
  deleted_at,
  encrypted_value  -- Still present!
FROM public.secrets
WHERE name = 'STRIPE_API_KEY';

-- deleted_at should be NOT NULL
```

**Pass Criteria:**
- Secret removed from UI
- Data preserved in database (soft delete)
- Can be restored if needed (future feature)
- Audit log records deletion

---

### Test Suite 3: Encryption Verification (15 min)

#### Test 3.1: Zero-Knowledge Architecture Verification

**Objective:** Prove server cannot decrypt secrets

**Steps:**
1. Create a secret with known value: `KNOWN_SECRET_VALUE_12345`
2. Open Supabase Studio
3. Navigate to Table Editor -> `public.secrets`
4. Find the row for your secret
5. Copy the `encrypted_value` field
6. Attempt to decrypt using only server-side data

**Expected Results:**
- ✅ `encrypted_value` is base64-encoded ciphertext
- ✅ Value is unreadable without KEK
- ✅ KEK cannot be derived without master password
- ✅ Master password never transmitted to server
- ✅ Server has NO way to decrypt

**Verification Test:**
```bash
# Try to decode base64 (will produce binary gibberish)
echo "AQIDBAUGBwgJ..." | base64 -d
# Output: binary garbage, NOT "KNOWN_SECRET_VALUE_12345"

# This proves encryption is working!
```

**Pass Criteria:**
- Encrypted value is unintelligible
- No master password in database
- No KEK in database (only salt)
- Server cannot decrypt even with full database access

---

#### Test 3.2: KEK Salt Persistence and Derivation

**Objective:** Verify KEK can be re-derived consistently

**Steps:**
1. Setup master password: `TestMasterPassword123!`
2. Create a secret
3. Check `user_preferences.kek_salt` in database
4. Logout completely
5. Login again
6. Enter same master password
7. Verify secret decrypts correctly

**Expected Results:**
- ✅ KEK salt stored in `user_preferences.kek_salt`
- ✅ Salt is 32-byte random value (44 chars base64)
- ✅ Same master password + same salt = same KEK
- ✅ Secret decrypts correctly after re-login

**Verification Queries:**
```sql
-- Check KEK salt
SELECT
  user_id,
  kek_salt,
  LENGTH(kek_salt) as salt_length,
  created_at
FROM public.user_preferences
WHERE user_id = '[user-id]';

-- salt_length should be 44 (32 bytes base64 encoded)
```

**Pass Criteria:**
- Salt persists across sessions
- Same master password consistently unlocks vault
- Different master password fails to decrypt
- Salt is cryptographically random

---

#### Test 3.3: Encryption Algorithm Verification

**Objective:** Verify correct encryption algorithm usage

**Steps:**
1. Open DevTools Console
2. Create a secret
3. Check console logs for encryption details
4. Verify algorithm: AES-256-GCM
5. Verify key derivation: PBKDF2 with 100,000 iterations

**Expected Results:**
- ✅ Algorithm: AES-256-GCM
- ✅ Key derivation: PBKDF2-SHA256
- ✅ Iterations: 100,000+
- ✅ IV (Initialization Vector) is unique per encryption
- ✅ Auth tag included for integrity

**Verification (Code):**
```typescript
// Check lib/encryption.ts implementation
// Should use Web Crypto API:
// - crypto.subtle.deriveKey (PBKDF2)
// - crypto.subtle.encrypt (AES-GCM)
```

**Pass Criteria:**
- Industry-standard algorithms used
- Sufficient iteration count (>= 100,000)
- Unique IV per encryption
- Auth tag for integrity verification

---

### Test Suite 4: AI Assistant (10 min)

#### Test 4.1: Basic AI Chat

**Objective:** Verify AI assistant integration and streaming

**Steps:**
1. Navigate to AI assistant page (`/dashboard/assistant`)
2. Verify chat interface loads
3. Send message: `How do I get an API key for OpenAI?`
4. Wait for response
5. Observe streaming behavior

**Expected Results:**
- ✅ Message sent to Cloudflare Worker
- ✅ Worker calls Anthropic API
- ✅ Response streams back to UI
- ✅ Response contains helpful information
- ✅ Conversation persisted to database
- ✅ Token usage tracked

**Verification:**
- Open DevTools -> Network tab
- Filter for calls to `http://localhost:8787/api/chat`
- Verify streaming response (Transfer-Encoding: chunked)
- Check conversation saved in database:

```sql
-- Check conversation created
SELECT id, user_id, title, created_at
FROM public.conversations
WHERE user_id = '[user-id]'
ORDER BY created_at DESC
LIMIT 1;

-- Check messages saved
SELECT
  id,
  conversation_id,
  role,
  content,
  created_at
FROM public.messages
WHERE conversation_id = '[conversation-id]'
ORDER BY created_at ASC;
```

**Pass Criteria:**
- Streaming response works smoothly
- Messages saved to database
- Conversation history persists
- Token usage recorded

---

#### Test 4.2: Guided Acquisition with FireCrawl

**Objective:** Verify AI can research and guide API key acquisition

**Steps:**
1. Send message: `Help me get a Stripe API key`
2. Wait for AI response
3. AI should provide step-by-step guidance
4. (Optional) If FireCrawl enabled, verify real-time scraping

**Expected Results:**
- ✅ AI provides clear instructions
- ✅ Step-by-step guide generated
- ✅ (If FireCrawl enabled) Real documentation scraped
- ✅ Conversation context maintained
- ✅ Can follow up with questions

**Verification (If FireCrawl Enabled):**
```sql
-- Check FireCrawl metadata in messages
SELECT
  id,
  content,
  metadata
FROM public.messages
WHERE conversation_id = '[conversation-id]'
AND metadata->>'firecrawl_used' = 'true';
```

**Pass Criteria:**
- Helpful guidance provided
- Multi-turn conversation works
- Context maintained across messages
- FireCrawl integration works (if configured)

---

### Test Suite 5: Audit Logging (10 min)

#### Test 5.1: Audit Events Captured

**Objective:** Verify all critical actions are logged

**Steps:**
1. Perform the following actions:
   - Create a secret
   - View the secret
   - Update the secret
   - Delete the secret
2. Check `audit_logs` table
3. Verify all actions logged

**Expected Results:**
- ✅ All actions logged in `public.audit_logs`
- ✅ Correct action types: `secret_created`, `secret_accessed`, `secret_updated`, `secret_deleted`
- ✅ User ID captured
- ✅ Resource ID captured
- ✅ Timestamp recorded
- ✅ Metadata includes relevant details

**Verification Queries:**
```sql
-- Check all audit logs for user
SELECT
  id,
  user_id,
  action,
  resource_type,
  resource_id,
  metadata,
  created_at
FROM public.audit_logs
WHERE user_id = '[user-id]'
ORDER BY created_at DESC;

-- Should see entries for:
-- - secret_created
-- - secret_accessed
-- - secret_updated
-- - secret_deleted
```

**Pass Criteria:**
- All actions logged
- Correct metadata captured
- No duplicate logs
- Timestamps accurate

---

#### Test 5.2: Audit Log RLS Enforcement

**Objective:** Verify users can only see their own audit logs

**Steps:**
1. Create two test users (User A and User B)
2. User A creates secrets and performs actions
3. User B creates secrets and performs actions
4. Login as User A, check audit logs
5. Login as User B, check audit logs

**Expected Results:**
- ✅ User A only sees own audit logs
- ✅ User B only sees own audit logs
- ✅ RLS policy prevents cross-user access
- ✅ Direct database query also respects RLS

**Verification Queries:**
```sql
-- As User A (using their session)
SELECT COUNT(*) FROM public.audit_logs;
-- Should only return User A's logs

-- As User B (using their session)
SELECT COUNT(*) FROM public.audit_logs;
-- Should only return User B's logs
```

**Pass Criteria:**
- RLS enforced correctly
- No cross-user data leakage
- Audit logs remain private

---

### Test Suite 6: Performance Tests (15 min)

#### Test 6.1: Encryption Performance

**Objective:** Measure encryption speed for bulk operations

**Steps:**
1. Create a test script to create 100 secrets
2. Measure total time
3. Calculate time per secret

**Test Script:**
```typescript
// tests/performance/encryption-benchmark.ts
async function testEncryptionPerformance() {
  const startTime = performance.now();

  for (let i = 0; i < 100; i++) {
    await createSecret({
      name: `PERF_TEST_SECRET_${i}`,
      value: `test_value_${i}_${crypto.randomUUID()}`,
      description: 'Performance test secret',
    });
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / 100;

  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average per secret: ${avgTime}ms`);
  console.log(`Target: <100ms per secret`);

  return avgTime < 100; // Pass if < 100ms per secret
}
```

**Expected Results:**
- ✅ Total time: < 10 seconds (for 100 secrets)
- ✅ Average time: < 100ms per secret
- ✅ No memory leaks
- ✅ UI remains responsive

**Pass Criteria:**
- < 100ms per secret encryption
- Consistent performance (no degradation)
- No browser hangs or freezes

---

#### Test 6.2: Decryption Performance

**Objective:** Measure decryption speed for bulk display

**Steps:**
1. Create 100 secrets (from Test 6.1)
2. Navigate to secrets list page
3. Measure time to decrypt and display all secrets
4. Check browser memory usage

**Expected Results:**
- ✅ Total time: < 2 seconds for 100 secrets
- ✅ Average time: < 20ms per secret
- ✅ UI remains responsive during decryption
- ✅ No memory leaks

**Verification:**
- Open DevTools -> Performance tab
- Start recording
- Load secrets page
- Stop recording
- Check:
  - Total time
  - Main thread blocking time
  - Memory usage

**Pass Criteria:**
- < 2s to decrypt and display 100 secrets
- No UI freezing
- Smooth scrolling in secrets list

---

#### Test 6.3: AI Streaming Latency

**Objective:** Measure AI response time and streaming performance

**Steps:**
1. Send message to AI assistant
2. Measure time to first token (TTFT)
3. Measure time to complete response
4. Observe streaming smoothness

**Expected Results:**
- ✅ Time to first token: < 2 seconds
- ✅ Streaming is smooth (no stuttering)
- ✅ Total response time: < 10 seconds
- ✅ No dropped tokens

**Verification:**
- Open DevTools -> Network tab
- Send message
- Check timing for `/api/chat` request
- Verify:
  - Time to first byte (TTFB)
  - Total time
  - Transfer size

**Pass Criteria:**
- < 2s to first token
- Smooth streaming experience
- No errors or retries
- Complete response received

---

### Test Suite 7: Security Tests (10 min)

#### Test 7.1: XSS Prevention

**Objective:** Verify user input is sanitized

**Steps:**
1. Try to inject XSS in various fields:
   - Secret name: `<script>alert('XSS')</script>`
   - Secret value: `<img src=x onerror=alert('XSS')>`
   - AI message: `<script>document.location='http://evil.com'</script>`
2. Verify script not executed
3. Verify content rendered as text

**Expected Results:**
- ✅ Script tags rendered as text, not executed
- ✅ No alert dialogs appear
- ✅ Content displays safely
- ✅ React escapes HTML by default

**Pass Criteria:**
- No XSS execution in any field
- Content displayed safely as text
- No console errors about unsafe content

---

#### Test 7.2: RLS Enforcement on Secrets

**Objective:** Verify Row-Level Security prevents data leakage

**Steps:**
1. Create User A and User B
2. User A creates secret with ID `secret-123`
3. User B attempts to access `secret-123` directly

**Test Methods:**

**Method 1: Direct API Call**
```bash
# As User B, try to fetch User A's secret
curl -X GET \
  'https://your-project.supabase.co/rest/v1/secrets?id=eq.secret-123' \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer USER_B_JWT"

# Expected: Empty array [] (RLS blocks access)
```

**Method 2: UI Manipulation**
1. Login as User B
2. Manually navigate to `/dashboard/secrets/secret-123` (User A's secret)
3. Verify 403 or empty result

**Expected Results:**
- ✅ User B cannot access User A's secret
- ✅ API returns empty result or 403
- ✅ RLS policy enforced at database level
- ✅ No data leakage possible

**Pass Criteria:**
- RLS completely blocks cross-user access
- No way to bypass RLS
- Error handling graceful

---

#### Test 7.3: SQL Injection Prevention

**Objective:** Verify parameterized queries prevent SQL injection

**Steps:**
1. Try SQL injection in various inputs:
   - Secret name: `'; DROP TABLE secrets; --`
   - Search query: `' OR '1'='1`
   - Filter: `1=1; DELETE FROM secrets;`
2. Verify attacks fail
3. Verify data remains intact

**Expected Results:**
- ✅ SQL injection attempts stored as literal strings
- ✅ No database modifications
- ✅ Parameterized queries used throughout
- ✅ Supabase client escapes inputs automatically

**Verification:**
```sql
-- Check if malicious input stored literally
SELECT name FROM public.secrets
WHERE name LIKE '%DROP TABLE%';

-- Should return the row with literal string, NOT execute SQL
```

**Pass Criteria:**
- No SQL injection possible
- Data integrity maintained
- All queries use parameterized inputs

---

## Test Execution Checklist

Use this checklist to track progress during testing:

### Authentication & Setup
- [ ] Test 1.1: User Registration (5 min)
- [ ] Test 1.2: User Login (3 min)
- [ ] Test 1.3: Master Password Setup (7 min)

### Secret Management
- [ ] Test 2.1: Create Secret (5 min)
- [ ] Test 2.2: Read Secret (3 min)
- [ ] Test 2.3: Update Secret (5 min)
- [ ] Test 2.4: Delete Secret (3 min)

### Encryption Verification
- [ ] Test 3.1: Zero-Knowledge Verification (5 min)
- [ ] Test 3.2: KEK Salt Persistence (5 min)
- [ ] Test 3.3: Encryption Algorithm (5 min)

### AI Features
- [ ] Test 4.1: Basic AI Chat (5 min)
- [ ] Test 4.2: Guided Acquisition (5 min)

### Audit & Compliance
- [ ] Test 5.1: Audit Events Captured (5 min)
- [ ] Test 5.2: Audit Log RLS (5 min)

### Performance
- [ ] Test 6.1: Encryption Performance (5 min)
- [ ] Test 6.2: Decryption Performance (5 min)
- [ ] Test 6.3: AI Streaming Latency (5 min)

### Security
- [ ] Test 7.1: XSS Prevention (3 min)
- [ ] Test 7.2: RLS Enforcement (4 min)
- [ ] Test 7.3: SQL Injection Prevention (3 min)

**Total Estimated Time: ~90 minutes**

---

## Test Results Template

After completing tests, copy this template to `INTEGRATION-TEST-RESULTS.md` and fill in results:

```markdown
# Integration Test Results

**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Environment:** Local / Staging / Production
**Branch/Commit:** [git commit hash]

## Executive Summary

- **Total Tests:** X
- **Passed:** X
- **Failed:** X
- **Skipped:** X
- **Pass Rate:** X%
- **Overall Status:** PASS / FAIL / PARTIAL

## Detailed Results

### Test Suite 1: Authentication (15 min)
- [x] Test 1.1: User Registration - **PASS** ✅
  - Notes: All database entries created correctly
- [x] Test 1.2: User Login - **PASS** ✅
  - Notes: Session persists correctly
- [ ] Test 1.3: Master Password Setup - **FAIL** ❌
  - Issue: KEK derivation taking too long (>5s)
  - Action Required: Optimize PBKDF2 iteration count

### Test Suite 2: Secret CRUD (20 min)
- [x] Test 2.1: Create Secret - **PASS** ✅
- [ ] Test 2.2: Read Secret - **FAIL** ❌
  - Issue: Decryption fails on second load
- [ ] Test 2.3: Update Secret - **SKIPPED** ⏭️
  - Reason: Blocked by 2.2 failure
- [x] Test 2.4: Delete Secret - **PASS** ✅

### Test Suite 3: Encryption (15 min)
- [x] Test 3.1: Zero-Knowledge Verification - **PASS** ✅
- [x] Test 3.2: KEK Salt Persistence - **PASS** ✅
- [x] Test 3.3: Encryption Algorithm - **PASS** ✅

### Test Suite 4: AI Assistant (10 min)
- [x] Test 4.1: Basic AI Chat - **PASS** ✅
- [ ] Test 4.2: Guided Acquisition - **PARTIAL** ⚠️
  - Notes: Works but FireCrawl integration not tested (no API key)

### Test Suite 5: Audit Logging (10 min)
- [x] Test 5.1: Audit Events Captured - **PASS** ✅
- [x] Test 5.2: Audit Log RLS - **PASS** ✅

### Test Suite 6: Performance (15 min)
- [x] Test 6.1: Encryption Performance - **PASS** ✅
  - Result: 85ms average per secret (target: <100ms)
- [ ] Test 6.2: Decryption Performance - **FAIL** ❌
  - Result: 3.2s for 100 secrets (target: <2s)
  - Action Required: Optimize decryption loop
- [x] Test 6.3: AI Streaming Latency - **PASS** ✅
  - Result: 1.5s to first token (target: <2s)

### Test Suite 7: Security (10 min)
- [x] Test 7.1: XSS Prevention - **PASS** ✅
- [x] Test 7.2: RLS Enforcement - **PASS** ✅
- [x] Test 7.3: SQL Injection Prevention - **PASS** ✅

## Issues Found

### Critical Issues (Blockers)
1. **Test 2.2 Failure: Decryption Fails on Reload**
   - Description: Secrets decrypt correctly on first load, but fail after page refresh
   - Impact: HIGH - Users cannot view secrets after closing app
   - Root Cause: KEK not persisting in session storage
   - Action: Fix KEK persistence logic in `lib/encryption.ts`
   - Owner: [Name]
   - ETA: [Date]

### High Priority Issues
2. **Test 6.2 Failure: Slow Decryption Performance**
   - Description: Decrypting 100 secrets takes 3.2s (target: <2s)
   - Impact: MEDIUM - Poor UX with many secrets
   - Root Cause: Sequential decryption, not parallelized
   - Action: Use Promise.all() to parallelize decryption
   - Owner: [Name]
   - ETA: [Date]

### Medium Priority Issues
3. **Test 1.3 Performance: KEK Derivation Slow**
   - Description: PBKDF2 takes >5s on low-end devices
   - Impact: MEDIUM - Poor UX on mobile
   - Action: Consider reducing iterations to 50,000 (still secure)
   - Owner: [Name]
   - ETA: [Date]

### Low Priority Issues
4. **Test 4.2 Incomplete: FireCrawl Not Tested**
   - Description: No FireCrawl API key configured
   - Impact: LOW - Feature works without it
   - Action: Get FireCrawl API key and retest
   - Owner: [Name]
   - ETA: [Date]

## Blockers

- [ ] **Test 2.2 Failure** - Prevents secret viewing after reload
- [ ] **Performance Issue** - Decryption too slow for production

## Next Steps

1. **Fix Critical Issues**
   - [ ] Fix KEK persistence (Test 2.2)
   - [ ] Retest secret viewing after fix

2. **Fix High Priority Issues**
   - [ ] Parallelize decryption (Test 6.2)
   - [ ] Retest with 100+ secrets

3. **Optimize Performance**
   - [ ] Tune PBKDF2 iterations (Test 1.3)
   - [ ] Profile and optimize hot paths

4. **Complete Skipped Tests**
   - [ ] Test 2.3: Update Secret (blocked by 2.2)
   - [ ] Test 4.2: FireCrawl integration (need API key)

5. **Regression Testing**
   - [ ] Re-run all failed tests after fixes
   - [ ] Verify no new issues introduced

6. **Sign-Off**
   - [ ] All critical tests passing
   - [ ] Performance meets targets
   - [ ] Security tests passing
   - [ ] Ready for production

## Recommendations

1. **Add Automated Tests**
   - Convert manual tests to Playwright tests
   - Run in CI/CD pipeline
   - Catch regressions early

2. **Performance Monitoring**
   - Add Sentry performance tracking
   - Monitor encryption/decryption times in production
   - Alert on performance degradation

3. **Security Audit**
   - Schedule external security audit
   - Penetration testing
   - Verify zero-knowledge architecture

4. **Load Testing**
   - Test with 1,000+ secrets
   - Test with multiple concurrent users
   - Verify database performance

## Sign-Off

- [ ] Developer: [Name] - Date: [YYYY-MM-DD]
- [ ] QA: [Name] - Date: [YYYY-MM-DD]
- [ ] Product Manager: [Name] - Date: [YYYY-MM-DD]
- [ ] Security Lead: [Name] - Date: [YYYY-MM-DD]

**Status:** APPROVED / REJECTED / REQUIRES CHANGES

**Notes:**
[Any final comments or observations]
```

---

## Automated Testing Infrastructure

See `tests/integration/` directory for Playwright automated tests that cover these scenarios.

**Running Automated Tests:**
```bash
# Install Playwright
npm install --save-dev @playwright/test

# Run all integration tests
npm run test:integration

# Run specific test suite
npx playwright test tests/integration/auth.spec.ts

# Run with UI mode
npx playwright test --ui

# Generate test report
npx playwright show-report
```

---

## Common Issues & Troubleshooting

### Issue: "Failed to fetch" errors in tests

**Cause:** Services not running or wrong ports

**Solution:**
```bash
# Verify services running:
lsof -i :3000  # Next.js app
lsof -i :8787  # Cloudflare Workers

# Restart services if needed
```

### Issue: Secrets fail to decrypt

**Cause:** KEK not derived correctly or wrong master password

**Solution:**
1. Check KEK salt exists in database
2. Verify master password correct
3. Check browser console for crypto errors
4. Clear local storage and try again

### Issue: RLS tests fail

**Cause:** Service role key used instead of user JWT

**Solution:**
- Use anon key for client requests
- Generate proper JWT for user
- Check Authorization header format

### Issue: Performance tests fail

**Cause:** Running on slow hardware or debug build

**Solution:**
- Run production build: `npm run build && npm start`
- Test on target hardware
- Close other applications

### Issue: AI tests timeout

**Cause:** API keys invalid or rate limited

**Solution:**
- Verify API keys in `.dev.vars`
- Check Anthropic API dashboard for quota
- Increase timeout in test config

---

## Appendix: SQL Queries for Verification

### Check All User Data
```sql
-- View all user data (for debugging)
SELECT
  u.id as user_id,
  u.email,
  p.name as project_name,
  up.kek_salt,
  COUNT(s.id) as secret_count,
  COUNT(a.id) as audit_log_count
FROM auth.users u
LEFT JOIN public.projects p ON p.user_id = u.id
LEFT JOIN public.user_preferences up ON up.user_id = u.id
LEFT JOIN public.secrets s ON s.user_id = u.id AND s.deleted_at IS NULL
LEFT JOIN public.audit_logs a ON a.user_id = u.id
WHERE u.email = 'test@example.com'
GROUP BY u.id, u.email, p.name, up.kek_salt;
```

### Check Encryption Quality
```sql
-- Verify all secrets are encrypted (no plaintext values)
SELECT
  id,
  name,
  encrypted_value,
  LENGTH(encrypted_value) as ciphertext_length,
  created_at
FROM public.secrets
WHERE encrypted_value NOT LIKE '%encrypted%'  -- Should return 0 rows
LIMIT 10;
```

### Check Audit Trail Completeness
```sql
-- Verify audit logs for all critical actions
SELECT
  action,
  COUNT(*) as count
FROM public.audit_logs
WHERE user_id = '[user-id]'
GROUP BY action
ORDER BY count DESC;

-- Should see:
-- secret_created: X
-- secret_accessed: Y
-- secret_updated: Z
-- secret_deleted: W
```

---

## Summary

This integration test plan provides comprehensive coverage of all critical MVP functionality:

1. **Authentication & Encryption** - Zero-knowledge architecture verified
2. **Secret Management** - Full CRUD operations tested
3. **AI Assistant** - Streaming and conversation management
4. **Audit Logging** - Compliance and security tracking
5. **Performance** - Meets production targets
6. **Security** - XSS, RLS, SQL injection prevention

**Total Time Investment:** ~90-120 minutes for complete manual execution

**Recommendation:** Run full test suite before every major release. Automate critical paths with Playwright.

**Next Steps:**
1. Execute this test plan manually
2. Document results in `INTEGRATION-TEST-RESULTS.md`
3. Fix any critical issues found
4. Implement Playwright automated tests
5. Add to CI/CD pipeline

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-02
**Owner:** Testing Team
**Status:** Ready for Execution
