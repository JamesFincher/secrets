# ✅ PRODUCTION LAUNCH CHECKLIST

**Project:** Abyrith MVP
**Date Created:** 2025-11-02
**Current Status:** 85% Complete
**Target:** Production Ready

---

## 🎯 CHECKLIST OVERVIEW

**Total Items:** 58
**Critical (Blocking):** 23 items
**High Priority:** 15 items
**Medium Priority:** 12 items
**Low Priority (Nice to Have):** 8 items

---

## 🚨 PHASE 1: CRITICAL BLOCKERS (MUST FIX - 2-2.5 hours)

### Build System (17 minutes)

- [ ] **Install lucide-react** (5 min)
  ```bash
  cd abyrith-app && pnpm add lucide-react
  ```
  **Why:** Used in 5+ components for icons
  **Impact:** Build fails without it

- [ ] **Install date-fns** (5 min)
  ```bash
  pnpm add date-fns
  ```
  **Why:** Used in AuditLogFilters for date handling
  **Impact:** Runtime error

- [ ] **Install class-variance-authority** (5 min)
  ```bash
  pnpm add class-variance-authority
  ```
  **Why:** Used in Badge component
  **Impact:** Build fails

- [ ] **Install clsx** (5 min)
  ```bash
  pnpm add clsx
  ```
  **Why:** Utility for class names
  **Impact:** cn() function fails

- [ ] **Install shadcn/ui components** (10 min)
  ```bash
  npx shadcn-ui@latest add alert card table select popover calendar
  ```
  **Why:** Used by AuditLogViewer, AuditLogFilters
  **Impact:** Components fail to render

- [ ] **Create /lib/utils.ts** (5 min)
  ```typescript
  import { type ClassValue, clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```
  **Why:** cn() function used throughout
  **Impact:** Build fails

- [ ] **Create /lib/hooks/use-toast.ts** (10 min)
  ```typescript
  import { useState } from 'react';

  type Toast = {
    id: string;
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  };

  export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toast = ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36);
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };
    return { toast, toasts };
  }
  ```
  **Why:** AuditLogViewer imports this
  **Impact:** Runtime error

- [ ] **Configure .env.local** (2 min - requires user's Supabase credentials)
  ```bash
  cp .env.local.example .env.local
  # Edit and fill in:
  # NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  # NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```
  **Why:** Required for Supabase connection
  **Impact:** App cannot connect to database

- [ ] **Verify build succeeds** (5 min)
  ```bash
  pnpm build
  ```
  **Expected:** Build completes without errors
  **If fails:** Check error messages and fix

### Integration Fixes (32 minutes)

- [ ] **Fix KEK salt caching during setup** (2 min)
  **File:** `/lib/stores/auth-store.ts`
  **Line:** 180
  **Change:**
  ```typescript
  set({
    masterPassword,
    preferences: { verification },
    kekSalt: verification.salt,  // ADD THIS LINE
    isLoading: false,
  });
  ```
  **Why:** KEK salt needed for encryption/decryption
  **Impact:** Secret creation fails after signup

- [ ] **Create master password prompt component** (30 min)
  **File:** `/components/auth/master-password-prompt.tsx` (NEW)
  **Content:** See FINAL-COMPREHENSIVE-AUDIT-REPORT.md Phase 3.2
  **Why:** User needs to enter master password after signin
  **Impact:** Returning users cannot decrypt secrets

- [ ] **Add master password prompt to dashboard layout** (5 min)
  **File:** `/app/dashboard/layout.tsx`
  **Add:** `<MasterPasswordPrompt />` before children
  **Why:** Trigger prompt when masterPassword is null
  **Impact:** UX broken without this

### Security Fixes (1-2 hours)

- [ ] **Fix XSS vulnerability in ChatMessage.tsx** (1-2 hours)
  **File:** `/components/ai/ChatMessage.tsx`
  **Line:** 94
  **Install:**
  ```bash
  pnpm add marked dompurify react-markdown
  pnpm add -D @types/dompurify
  ```
  **Replace:**
  ```typescript
  // BEFORE (DANGEROUS):
  <div dangerouslySetInnerHTML={{ __html: content }} />

  // AFTER (SAFE - Option 1):
  import ReactMarkdown from 'react-markdown';
  <ReactMarkdown>{content}</ReactMarkdown>

  // OR (Option 2):
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  const cleanHtml = DOMPurify.sanitize(marked.parse(content));
  <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
  ```
  **Why:** Prevents arbitrary code execution
  **Impact:** CRITICAL security vulnerability

- [ ] **Verify no other dangerouslySetInnerHTML usage** (10 min)
  ```bash
  grep -r "dangerouslySetInnerHTML" abyrith-app/components/
  ```
  **Expected:** Only ChatMessage.tsx (now fixed)
  **Action:** Fix any others found

---

## 🧪 PHASE 2: INTEGRATION TESTING (MUST DO - 60 min)

### User Flow Testing (30 min)

- [ ] **Test Case 1: New User Signup → Create Secret** (10 min)
  1. Navigate to /auth/signup
  2. Enter email + password → Submit
  3. Verify redirected to /auth/setup-master-password
  4. Enter master password (12+ chars) → Submit
  5. Verify redirected to /dashboard
  6. Click "Create Secret" button
  7. Fill in key="TEST_API_KEY", value="sk-test-123", description="Test"
  8. Click "Save"
  9. Verify secret appears in list (value hidden)
  10. Click "Reveal" button
  11. Verify plaintext value displays: "sk-test-123"
  12. Click "Hide" button
  13. Verify value hidden again
  14. Sign out
  **Expected:** All steps succeed without errors

- [ ] **Test Case 2: Returning User Signin → View Secret** (10 min)
  1. Navigate to /auth/signin
  2. Enter email + password → Submit
  3. Verify master password prompt appears
  4. Enter master password → Click "Unlock"
  5. Verify redirected to /dashboard
  6. Navigate to secrets list
  7. Verify secrets load (encrypted, values hidden)
  8. Click "Reveal" on previously created secret
  9. Verify plaintext displays correctly
  **Expected:** All steps succeed without errors

- [ ] **Test Case 3: Wrong Password Rejection** (5 min)
  1. Sign in successfully
  2. Master password prompt appears
  3. Enter WRONG password → Click "Unlock"
  4. Verify error message: "Incorrect master password"
  5. Enter CORRECT password → Click "Unlock"
  6. Verify unlocks successfully
  **Expected:** Wrong password rejected, correct password works

- [ ] **Test Case 4: Page Refresh (Session Persistence)** (5 min)
  1. Sign in and unlock vault
  2. Create a secret
  3. Refresh page (F5)
  4. Verify: Session persists (still signed in)
  5. Verify: Master password prompt appears (masterPassword not persisted)
  6. Enter master password → Unlock
  7. Verify: Can decrypt secrets again
  **Expected:** Session persists, but master password must be re-entered

### Security Testing (15 min)

- [ ] **Test Case 5: RLS Policy Enforcement** (10 min)
  **Prerequisites:** Need 2 users in different organizations
  1. User A creates secret in Organization A
  2. Sign out User A, sign in as User B (Organization B)
  3. Navigate to secrets list
  4. Verify: User B cannot see User A's secret
  5. Open Supabase Studio → Secrets table
  6. Verify: RLS policies block cross-org access
  **Expected:** Multi-tenancy enforced, no data leakage

- [ ] **Test Case 6: Tampered Ciphertext Rejection** (5 min)
  1. Create a secret
  2. Open Supabase Studio → Secrets table
  3. Find the secret row
  4. Manually modify `encrypted_value` field (change a few characters)
  5. Save changes in Supabase Studio
  6. In app, try to decrypt the secret
  7. Verify: Decryption fails with authentication tag mismatch
  **Expected:** GCM auth tag prevents tampering

### Edge Case Testing (10 min)

- [ ] **Test Case 7: Special Characters in Secret** (5 min)
  **Secret value:** `!@#$%^&*()_+-={}[]|:";'<>?,./`
  1. Create secret with special characters
  2. Decrypt secret
  3. Verify: Special characters preserved correctly
  **Expected:** All characters encrypt/decrypt correctly

- [ ] **Test Case 8: Very Long Secret** (5 min)
  **Secret value:** 10KB of text (paste lorem ipsum 100 times)
  1. Create secret with very long value
  2. Decrypt secret
  3. Verify: Long value handled without error
  4. Verify: Performance acceptable (< 2s to decrypt)
  **Expected:** Large secrets work correctly

### Buffer (5 min)

- [ ] **Fix any issues found during testing**
  **Action:** Address failures immediately
  **Re-test:** Ensure fixes work

---

## 📊 PHASE 3: HIGH-PRIORITY FIXES (5 hours - CAN DEFER TO POST-BETA)

### Database (10 min)

- [ ] **Add kek_salt field to user_preferences table** (10 min)
  **File:** Create new migration `supabase/migrations/20241102000004_add_kek_salt.sql`
  **Content:**
  ```sql
  -- Add kek_salt field to user_preferences
  ALTER TABLE user_preferences
  ADD COLUMN kek_salt TEXT NOT NULL DEFAULT '';

  -- Update TypeScript types after migration
  ```
  **File:** Update `/types/database.ts` to include `kek_salt: string`
  **Why:** Documented but not implemented
  **Impact:** KEK salt currently derived from verification, this is more explicit

### Security (20 min)

- [ ] **Add secret access logging** (10 min)
  **File:** `/lib/stores/secret-store.ts`
  **Line:** 276 (after successful decryption)
  **Add:**
  ```typescript
  const decryptedValue = await decryptSecret(...);

  // Log the access event
  await supabase.rpc('log_secret_access', { secret_id: secret.id });

  // Cache the result
  const newDecrypted = new Map(get().decryptedSecrets);
  newDecrypted.set(secret.id, decryptedValue);
  set({ decryptedSecrets: newDecrypted });
  ```
  **Why:** Audit logging for compliance (SOC 2, ISO 27001)
  **Impact:** Cannot track who accessed which secret

- [ ] **Fix audit.ts Supabase client** (10 min)
  **File:** `/lib/api/audit.ts`
  **Line:** Check imports
  **Replace:** Deprecated `@supabase/auth-helpers-nextjs` with shared client
  **Why:** Using deprecated package
  **Impact:** May break in future Supabase versions

### Documentation (2 hours)

- [ ] **Document AI Chat endpoint** (1 hour)
  **File:** `/05-api/endpoints/ai-chat-endpoints.md` (NEW)
  **Content:**
  - Endpoint: POST /api/v1/ai/chat
  - Request schema (message, conversationId, stream)
  - Response schema (SSE stream or JSON with usage)
  - Authentication requirements
  - Rate limiting (10 req/min)
  - Examples
  **Why:** Fully implemented but not documented
  **Impact:** Developers don't know how to use it

- [ ] **Document Scrape endpoint** (1 hour)
  **File:** `/05-api/endpoints/scrape-endpoints.md` (NEW)
  **Content:**
  - Endpoint: POST /api/scrape
  - Request schema (url or service)
  - Response schema (markdown content, cached flag)
  - Rate limiting (1 req/30s)
  - Service URL mapping (20+ services)
  - Examples
  **Why:** Fully implemented but not documented
  **Impact:** Developers don't know how to use it

### Testing (2 hours)

- [ ] **Write unit tests for encryption** (2 hours)
  **File:** `/lib/crypto/envelope-encryption.test.ts` (NEW)
  **Tests:**
  - Test encryptSecret() produces 5 fields
  - Test decryptSecret() recovers plaintext
  - Test wrong password fails decryption
  - Test tampered ciphertext fails (GCM auth tag)
  - Test PBKDF2 iterations = 600,000
  - Test nonce uniqueness
  **Framework:** Vitest (already in package.json)
  **Why:** No tests for critical encryption code
  **Impact:** Cannot verify encryption works correctly

---

## 🛡️ PHASE 4: PRODUCTION HARDENING (1 week - DEFER TO POST-BETA)

### Security Hardening (4-5 days)

- [ ] **Implement CSRF protection** (2-3 days)
  - [ ] Add CSRF token middleware in Workers
  - [ ] Generate CSRF token on page load
  - [ ] Include token in all POST/PUT/DELETE requests
  - [ ] Verify token on server-side
  - [ ] Set SameSite=Strict on cookies
  - [ ] Verify Origin/Referer headers
  **Why:** Prevent cross-site request forgery
  **Impact:** Vulnerable to CSRF attacks

- [ ] **Add security headers** (1 day)
  - [ ] Content-Security-Policy (CSP)
  - [ ] X-Frame-Options: DENY
  - [ ] Strict-Transport-Security (HSTS)
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Referrer-Policy: strict-origin-when-cross-origin
  **File:** Configure in `next.config.js` and Workers
  **Why:** Defense against XSS, clickjacking, MIME sniffing
  **Impact:** Multiple attack vectors open

- [ ] **Implement rate limiting on password verification** (1 hour)
  **File:** `/lib/stores/auth-store.ts`
  **Add:** Rate limiter (5 attempts per 15 minutes)
  **Why:** Prevent brute force on master password
  **Impact:** Vulnerable to password guessing

- [ ] **Add MFA/2FA support** (1 week)
  - [ ] TOTP (Time-based One-Time Password) setup
  - [ ] QR code generation for authenticator apps
  - [ ] Backup codes generation
  - [ ] Enforce MFA for admin accounts
  - [ ] Recovery mechanism
  **Why:** Required for enterprise customers
  **Impact:** Single factor authentication only

### Performance Optimization (2 days)

- [ ] **Benchmark API response times** (1 day)
  - [ ] Measure AI Chat endpoint latency
  - [ ] Measure Scrape endpoint latency
  - [ ] Measure secret CRUD operations
  - [ ] Target: <200ms p95 for API calls
  **Tool:** Artillery, k6, or custom script
  **Why:** Need to verify performance targets
  **Impact:** May not meet SLA

- [ ] **Optimize frontend bundle size** (1 day)
  - [ ] Analyze bundle with `next bundle-analyzer`
  - [ ] Tree-shake unused code
  - [ ] Code-split large components
  - [ ] Lazy-load heavy dependencies
  - [ ] Target: <500KB gzipped
  **Why:** Fast page loads (target <2s)
  **Impact:** Slow initial load times

### Reliability (2 days)

- [ ] **Implement offline queue for mutations** (1 day)
  - [ ] Queue secret create/update/delete when offline
  - [ ] Replay on reconnection
  - [ ] Handle conflicts
  **Why:** Better UX during network issues
  **Impact:** Data loss if offline

- [ ] **Add error recovery mechanisms** (1 day)
  - [ ] Retry logic for failed requests
  - [ ] Exponential backoff
  - [ ] Graceful degradation
  - [ ] User-friendly error messages
  **Why:** Resilience to transient failures
  **Impact:** Poor UX on errors

---

## 🧪 PHASE 5: COMPREHENSIVE TESTING (1 week - DEFER TO POST-BETA)

### Automated Testing (5 days)

- [ ] **Write E2E tests with Playwright** (3 days)
  - [ ] Complete user signup flow
  - [ ] Complete signin → create secret → decrypt flow
  - [ ] Master password verification flow
  - [ ] RLS policy enforcement
  - [ ] Session management
  **File:** `/tests/e2e/` directory
  **Why:** Automated regression testing
  **Impact:** Manual testing only

- [ ] **Write integration tests** (2 days)
  - [ ] Secret CRUD operations
  - [ ] Auth flow integration
  - [ ] Database RLS policies
  - [ ] API endpoint integration
  **File:** `/tests/integration/` directory
  **Why:** Verify components work together
  **Impact:** Integration bugs not caught

### Performance Testing (2 days)

- [ ] **Load testing** (1 day)
  - [ ] Simulate 100 concurrent users
  - [ ] Test secret creation under load
  - [ ] Test decryption under load
  - [ ] Measure database performance
  **Tool:** Artillery, k6
  **Why:** Verify scalability
  **Impact:** Unknown performance limits

- [ ] **Stress testing** (1 day)
  - [ ] Test with 10,000+ secrets per user
  - [ ] Test with 1,000+ concurrent requests
  - [ ] Test database connection pooling
  - [ ] Identify breaking points
  **Tool:** Artillery, k6
  **Why:** Find limits before users do
  **Impact:** May fail at scale

---

## 📚 PHASE 6: DOCUMENTATION POLISH (2 days - DEFER TO POST-BETA)

### User-Facing Documentation

- [ ] **Create comprehensive setup guide** (1 day)
  - [ ] Prerequisites
  - [ ] Environment setup
  - [ ] Configuration steps
  - [ ] First-time user walkthrough
  - [ ] Screenshots
  **File:** `/12-user-docs/getting-started/setup-guide.md`
  **Why:** Users need clear instructions
  **Impact:** Confusion during onboarding

- [ ] **Create troubleshooting guide** (1 day)
  - [ ] Common errors and solutions
  - [ ] Database connection issues
  - [ ] Authentication problems
  - [ ] Encryption errors
  - [ ] Performance issues
  **File:** `/12-user-docs/troubleshooting.md`
  **Why:** Self-service support
  **Impact:** Support burden

---

## ✅ PRE-LAUNCH CHECKLIST

### Final Verification (Before Any Launch)

- [ ] **Build succeeds without errors**
  ```bash
  pnpm build
  ```

- [ ] **No console errors in browser**
  - Open DevTools → Console
  - Navigate through app
  - Verify: No errors

- [ ] **All critical test cases pass**
  - See Phase 2 testing checklist
  - Document pass/fail results

- [ ] **Documentation updated**
  - CHANGELOG.md includes recent changes
  - README.md has setup instructions
  - API docs complete

- [ ] **Environment configured correctly**
  - .env.local has valid Supabase credentials
  - Workers .dev.vars has valid API keys
  - All secrets in place

- [ ] **Security vulnerabilities addressed**
  - XSS vulnerability fixed
  - No dangerouslySetInnerHTML misuse
  - Input validation present

- [ ] **Mobile responsive works**
  - Test on mobile device or emulator
  - Verify layouts don't break

- [ ] **Accessibility basics**
  - Keyboard navigation works
  - Form labels present
  - No color-only indicators

- [ ] **Sign out clears session completely**
  - Sign in → Create secret → Sign out
  - Verify: Master password cleared
  - Verify: Decrypted secrets cleared
  - Verify: Session cleared

- [ ] **Database migrations applied**
  ```bash
  supabase db reset  # or supabase db push
  ```

- [ ] **No TypeScript errors**
  ```bash
  npx tsc --noEmit
  ```

---

## 🎯 LAUNCH DECISION MATRIX

### Beta Launch (Limited Testing)

**Requirements:**
- ✅ Phase 1 complete (all critical blockers fixed)
- ✅ Phase 2 complete (integration testing passed)
- ✅ Phase 3 (high-priority) can be deferred

**Timeline:** 3-4 hours
**Risk:** LOW (core features work, tested)
**Audience:** Internal team, friendly beta testers
**Support:** High-touch, manual support

### Production Launch (Public)

**Requirements:**
- ✅ Phase 1 complete
- ✅ Phase 2 complete
- ✅ Phase 3 complete
- ✅ Phase 4 complete (security hardening)
- ⚠️ Phase 5 (comprehensive testing) recommended
- ⚠️ Phase 6 (documentation) recommended

**Timeline:** +1 week after beta
**Risk:** MEDIUM (need security hardening)
**Audience:** General public
**Support:** Self-service docs + support tickets

### Enterprise Launch (Enterprise Customers)

**Requirements:**
- ✅ All phases complete (1-6)
- ✅ MFA/2FA implemented
- ✅ Full test coverage
- ✅ SOC 2 Type II audit started
- ✅ Comprehensive documentation
- ✅ SLA commitments met

**Timeline:** +2-3 weeks after production
**Risk:** LOW (fully hardened)
**Audience:** Enterprise customers
**Support:** Dedicated support, SLA guarantees

---

## 📊 COMPLETION TRACKING

**Total Items:** 58

### By Phase

| Phase | Items | Status |
|-------|-------|--------|
| Phase 1: Critical Blockers | 23 | ☐ To Do |
| Phase 2: Integration Testing | 9 | ☐ To Do |
| Phase 3: High-Priority | 5 | ☐ To Do |
| Phase 4: Production Hardening | 9 | ☐ To Do |
| Phase 5: Comprehensive Testing | 4 | ☐ To Do |
| Phase 6: Documentation Polish | 2 | ☐ To Do |
| Pre-Launch Verification | 6 | ☐ To Do |

### By Priority

| Priority | Count | Time Estimate |
|----------|-------|---------------|
| P0 (Blocking) | 23 | 2-2.5 hours |
| P0 (Testing) | 9 | 60 minutes |
| P1 (High) | 5 | 5 hours |
| P2 (Production) | 9 | 1 week |
| P3 (Testing) | 4 | 1 week |
| P4 (Docs) | 2 | 2 days |

---

**Checklist Status:** ☐ NOT STARTED
**Next Action:** Begin Phase 1 (Critical Blockers)
**Time to Beta:** 3-4 hours
**Time to Production:** +1 week
**Time to Enterprise:** +2-3 weeks

**Good luck! 🚀**
