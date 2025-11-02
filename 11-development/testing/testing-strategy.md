---
Document: Testing Strategy - Quality Assurance Foundation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Engineering Lead
Status: Draft
Dependencies: TECH-STACK.md, 07-frontend/frontend-architecture.md, 05-api/api-rest-design.md, 03-security/security-model.md
---

# Testing Strategy

## Overview

This document defines the comprehensive testing strategy for the Abyrith platform, establishing standards for unit testing, integration testing, end-to-end testing, security testing, performance testing, and test data management. The strategy implements a testing pyramid approach to ensure high code quality, security compliance, and reliable operation while maintaining developer velocity and minimizing maintenance overhead.

**Purpose:** Provide a unified testing framework that ensures zero-knowledge encryption guarantees, catches bugs early in development, supports confident refactoring, and enables continuous deployment with high reliability.

**Scope:** All testing practices for frontend (Next.js/React), backend (Cloudflare Workers, Supabase), API contracts, security controls, encryption implementation, and performance characteristics.

**Status:** Draft - Implementation starting Phase 3

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Testing Pyramid Overview](#testing-pyramid-overview)
4. [Unit Testing Strategy](#unit-testing-strategy)
5. [Integration Testing Strategy](#integration-testing-strategy)
6. [End-to-End Testing Strategy](#end-to-end-testing-strategy)
7. [Security Testing Strategy](#security-testing-strategy)
8. [Performance & Load Testing](#performance--load-testing)
9. [Test Data Management](#test-data-management)
10. [Testing Workflow & CI/CD Integration](#testing-workflow--cicd-integration)
11. [Coverage Requirements](#coverage-requirements)
12. [Testing Best Practices](#testing-best-practices)
13. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith is a security-critical application requiring zero-knowledge encryption, multi-tenancy isolation, and complex cryptographic operations. Without a comprehensive testing strategy, we risk security vulnerabilities, data loss, performance degradation, and poor user experience.

**Pain points:**
- Cryptographic code is difficult to test and easy to break silently
- Zero-knowledge architecture requires rigorous testing to verify server cannot decrypt secrets
- Row-Level Security policies must be thoroughly tested to prevent data leaks
- Complex state management and async operations lead to subtle bugs
- Manual testing is slow, error-prone, and doesn't scale
- Lack of clear testing standards leads to inconsistent coverage

**Why now?**
Testing strategy must be established before significant implementation to avoid technical debt and ensure security guarantees from day one. Retrofitting tests is exponentially more expensive than building them alongside features.

### Background

**Existing system:**
This is a greenfield implementation. No existing test suite to refactor.

**Previous attempts:**
N/A - Initial testing strategy design.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Engineering Lead | Code quality, velocity, maintainability | Test maintenance burden, developer productivity |
| Security Lead | Zero-knowledge guarantees, vulnerability prevention | Cryptographic correctness, security regression |
| Backend Team | API reliability, database integrity | Test environment setup complexity |
| Frontend Team | Component reliability, UX consistency | Test brittleness, slow test execution |
| Product Team | Feature stability, user experience | Bug escape rate, release confidence |
| DevOps/SRE | Deployment reliability, production stability | CI/CD integration, performance testing |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Prevent security vulnerabilities** - Detect encryption bugs, auth bypasses, and RLS violations before production (success metric: 0 critical security bugs in production)
2. **Maintain 70%+ code coverage** - Ensure critical paths thoroughly tested (success metric: 90%+ coverage for encryption, auth, and API layers)
3. **Enable confident refactoring** - Comprehensive tests provide safety net for code changes (success metric: <5% test breakage per refactor)
4. **Fast feedback loops** - Tests run quickly in CI/CD (success metric: <10min full test suite)

**Secondary goals:**
- Catch integration issues between frontend and backend
- Validate API contracts and error handling
- Ensure consistent user experience across browsers
- Provide executable documentation via tests
- Support test-driven development (TDD) workflow

### Non-Goals

**Explicitly out of scope:**
- **100% code coverage** - Not practical or valuable; focus on critical paths
- **Testing third-party libraries** - Trust well-maintained libraries (React, Next.js, Supabase)
- **Manual QA for every change** - Automate as much as possible, manual testing for complex UX flows only
- **Chaos engineering** - Not MVP scope; consider post-launch
- **Penetration testing** - Use third-party security audits instead

### Success Metrics

**How we measure success:**
- **Code Coverage**: 70%+ overall, 90%+ for critical paths (encryption, auth, RLS)
- **Bug Escape Rate**: <2 critical bugs per month in production
- **Test Reliability**: <1% flaky test rate
- **Test Execution Time**: <5min unit tests, <10min full suite in CI
- **Developer Confidence**: 95%+ confident deploying after tests pass (team survey)

---

## Testing Pyramid Overview

### Test Distribution (70% / 20% / 10%)

```
         /\
        /  \
       / E2E \       10% - End-to-End Tests
      /------\       • Critical user journeys
     /        \      • Cross-browser validation
    / Integr.  \     • Full system flows
   /------------\
  /              \   20% - Integration Tests
 /  Unit Tests   \  • API contracts
/------------------\ • Database interactions
                     • Service integrations

                    70% - Unit Tests
                    • Pure functions
                    • Component logic
                    • Business logic
```

**Why the pyramid?**
- **Unit tests are fast** (milliseconds) and provide quick feedback
- **Integration tests catch interface issues** but are slower (seconds)
- **E2E tests validate real user flows** but are slowest (minutes) and most brittle
- **Inverted pyramid leads to slow, flaky test suites** (anti-pattern)

### Test Coverage by Layer

**Frontend (Next.js/React):**
- Unit: 70% (components, hooks, utilities)
- Integration: 20% (API client, state management)
- E2E: 10% (user flows, navigation)

**Backend (Workers/Supabase):**
- Unit: 70% (business logic, validation, encryption)
- Integration: 25% (API endpoints, database queries, RLS)
- E2E: 5% (full request/response cycles)

**Critical Paths (90%+ coverage required):**
- Client-side encryption/decryption
- Master key derivation (PBKDF2)
- JWT authentication and verification
- Row-Level Security policies
- API error handling
- Rate limiting logic

---

## Unit Testing Strategy

### Technology Stack

**Frontend:**
- **Framework:** Vitest 1.x
- **Component Testing:** Testing Library (React) 14.x
- **Mocking:** Vitest mocks + MSW for API
- **Assertions:** Expect API (Vitest built-in)

**Backend (Workers):**
- **Framework:** Vitest 1.x
- **Mocking:** Vitest mocks
- **Database:** In-memory mock or Supabase local
- **Assertions:** Expect API (Vitest built-in)

**Why Vitest?**
- Fast execution (Vite-powered, ESM-first)
- Jest-compatible API (easy migration if needed)
- Built-in TypeScript support
- Watch mode for instant feedback
- Coverage reporting (c8)

### What to Unit Test

**Frontend Components:**
```typescript
// components/secrets/SecretCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SecretCard } from './SecretCard';

describe('SecretCard', () => {
  it('should render secret metadata without decrypting', () => {
    const secret = {
      id: 'test-id',
      name: 'OPENAI_API_KEY',
      service_name: 'OpenAI',
      encrypted_value: 'encrypted_blob_here',
      created_at: '2025-10-30T12:00:00Z',
      tags: ['ai', 'api-key']
    };

    render(<SecretCard secret={secret} />);

    expect(screen.getByText('OPENAI_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.queryByText('sk_test_')).not.toBeInTheDocument(); // Not decrypted
  });

  it('should decrypt and show secret when user clicks reveal', async () => {
    const secret = {
      id: 'test-id',
      name: 'OPENAI_API_KEY',
      encrypted_value: 'encrypted_blob_here',
    };

    const mockDecrypt = vi.fn().mockResolvedValue('sk_test_abc123');
    render(<SecretCard secret={secret} onDecrypt={mockDecrypt} />);

    const revealButton = screen.getByRole('button', { name: /reveal/i });
    fireEvent.click(revealButton);

    expect(mockDecrypt).toHaveBeenCalledWith('encrypted_blob_here');
    expect(await screen.findByText('sk_test_abc123')).toBeInTheDocument();
  });

  it('should handle decryption errors gracefully', async () => {
    const mockDecrypt = vi.fn().mockRejectedValue(new Error('Decryption failed'));
    render(<SecretCard secret={{}} onDecrypt={mockDecrypt} />);

    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));

    expect(await screen.findByText(/decryption failed/i)).toBeInTheDocument();
  });
});
```

**Encryption Utilities:**
```typescript
// lib/crypto/encryption.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveMasterKey } from './encryption';

describe('Encryption Utilities', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt plaintext correctly', async () => {
      const plaintext = 'sk_test_secret_api_key_here';
      const password = 'strong_master_password';
      const salt = 'user_id_as_salt';

      // Derive master key
      const masterKey = await deriveMasterKey(password, salt);

      // Encrypt
      const encrypted = await encrypt(plaintext, masterKey);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64

      // Decrypt
      const decrypted = await decrypt(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong key', async () => {
      const plaintext = 'secret';
      const correctKey = await deriveMasterKey('correct_password', 'salt');
      const wrongKey = await deriveMasterKey('wrong_password', 'salt');

      const encrypted = await encrypt(plaintext, correctKey);

      await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
    });

    it('should generate unique ciphertext for same plaintext', async () => {
      const plaintext = 'secret';
      const masterKey = await deriveMasterKey('password', 'salt');

      const encrypted1 = await encrypt(plaintext, masterKey);
      const encrypted2 = await encrypt(plaintext, masterKey);

      // Different nonces produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same plaintext
      expect(await decrypt(encrypted1, masterKey)).toBe(plaintext);
      expect(await decrypt(encrypted2, masterKey)).toBe(plaintext);
    });
  });

  describe('deriveMasterKey', () => {
    it('should derive consistent key from same password and salt', async () => {
      const password = 'test_password';
      const salt = 'test_salt';

      const key1 = await deriveMasterKey(password, salt);
      const key2 = await deriveMasterKey(password, salt);

      // Export keys to compare (for testing only)
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);

      expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
    });

    it('should derive different keys for different passwords', async () => {
      const salt = 'same_salt';

      const key1 = await deriveMasterKey('password1', salt);
      const key2 = await deriveMasterKey('password2', salt);

      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);

      expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
    });

    it('should derive different keys for different salts', async () => {
      const password = 'same_password';

      const key1 = await deriveMasterKey(password, 'salt1');
      const key2 = await deriveMasterKey(password, 'salt2');

      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);

      expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
    });

    it('should take reasonable time (PBKDF2 iteration check)', async () => {
      const start = Date.now();
      await deriveMasterKey('password', 'salt');
      const duration = Date.now() - start;

      // OWASP 2023 recommendation: 600k iterations
      // Should take 1-3 seconds on modern hardware
      expect(duration).toBeGreaterThan(500); // At least 500ms (security)
      expect(duration).toBeLessThan(10000); // Less than 10s (UX)
    });
  });
});
```

**API Client:**
```typescript
// lib/api/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './client';
import { useAuthStore } from '../stores/authStore';

vi.mock('../stores/authStore');

describe('API Client', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should include JWT token in Authorization header', async () => {
    const mockToken = 'test_jwt_token';
    vi.mocked(useAuthStore.getState).mockReturnValue({
      session: { access_token: mockToken }
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'success' })
    } as Response);

    await apiClient.get('/projects');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`
        })
      })
    );
  });

  it('should handle 401 by refreshing token and retrying', async () => {
    const expiredToken = 'expired_token';
    const newToken = 'refreshed_token';

    vi.mocked(useAuthStore.getState).mockReturnValueOnce({
      session: { access_token: expiredToken }
    });

    // First call returns 401
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'TOKEN_EXPIRED' })
      } as Response);

    // Token refresh succeeds
    // Mock supabase.auth.refreshSession() here...

    // Retry succeeds
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'success' })
      } as Response);

    const result = await apiClient.get('/projects');

    expect(global.fetch).toHaveBeenCalledTimes(2); // Original + retry
    expect(result.data).toBe('success');
  });

  it('should throw error for non-2xx responses', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Resource not found'
        }
      })
    } as Response);

    await expect(apiClient.get('/projects/invalid-id')).rejects.toThrow();
  });
});
```

### Unit Test Organization

**File Structure:**
```
src/
├── components/
│   ├── SecretCard.tsx
│   └── SecretCard.test.tsx          # Co-located tests
├── lib/
│   ├── crypto/
│   │   ├── encryption.ts
│   │   └── encryption.test.ts       # Co-located tests
│   └── api/
│       ├── client.ts
│       └── client.test.ts           # Co-located tests
```

**Naming Conventions:**
- Test files: `*.test.ts` or `*.test.tsx`
- Test suites: `describe('ComponentName', () => {})`
- Test cases: `it('should do something', () => {})`
- Use descriptive test names (avoid "works" or "test 1")

### Test Coverage Thresholds

**Vitest Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html', 'json'],
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
      // Critical paths require higher coverage
      include: [
        'lib/crypto/**',    // 90%+ required
        'lib/api/**',       // 80%+ required
        'lib/auth/**',      // 90%+ required
      ],
    },
  },
});
```

---

## Integration Testing Strategy

### What to Integration Test

**API + Database Integration:**
- API endpoints correctly query database
- Row-Level Security policies enforce multi-tenancy
- JWT claims properly extracted and used in queries
- Transactions commit/rollback correctly
- Foreign key constraints enforced

**Frontend + API Integration:**
- API client correctly formats requests
- Response deserialization works
- Error handling propagates correctly
- React Query caches responses
- Optimistic updates roll back on error

**External Service Integration:**
- Supabase Auth authentication flows
- Cloudflare Workers KV caching
- Claude API integration (mocked)
- FireCrawl API integration (mocked)

### Integration Test Setup

**MSW (Mock Service Worker) for API Mocking:**
```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock Supabase Auth
  http.post('/auth/v1/token', async ({ request }) => {
    const body = await request.json();

    if (body.email === 'test@example.com' && body.password === 'correct') {
      return HttpResponse.json({
        access_token: 'mock_jwt_token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      });
    }

    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Mock Secrets API
  http.get('/v1/projects/:projectId/secrets', ({ params }) => {
    return HttpResponse.json({
      data: [
        {
          id: 'secret-1',
          name: 'OPENAI_API_KEY',
          encrypted_value: 'encrypted_blob',
          project_id: params.projectId,
        }
      ],
      pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 }
    });
  }),

  // Mock Secret Creation
  http.post('/v1/secrets', async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json(
      {
        id: 'new-secret-id',
        ...body,
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),
];
```

```typescript
// test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());
```

**Integration Test Example:**
```typescript
// lib/hooks/useSecrets.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSecrets } from './useSecrets';

// MSW handlers imported from test/setup.ts

describe('useSecrets Hook', () => {
  it('should fetch and decrypt secrets', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useSecrets('test-project-id'),
      { wrapper }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check data
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].name).toBe('OPENAI_API_KEY');
    expect(result.current.data[0].encrypted_value).toBe('encrypted_blob');
  });

  it('should handle API errors', async () => {
    // Override handler to return error
    server.use(
      http.get('/v1/projects/:projectId/secrets', () => {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => useSecrets('test-project-id'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error.message).toContain('Server error');
  });
});
```

### Database Integration Tests

**Supabase Local Testing:**
```bash
# Start local Supabase instance
supabase start

# Run migrations
supabase db reset

# Run integration tests against local DB
vitest run --config vitest.integration.config.ts
```

**Database Integration Test Example:**
```typescript
// lib/api/secrets.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_LOCAL_URL,
  process.env.SUPABASE_LOCAL_ANON_KEY
);

describe('Secrets API (Database Integration)', () => {
  let testUserId: string;
  let testProjectId: string;

  beforeEach(async () => {
    // Create test user and project
    const { data: user } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'test_password'
    });
    testUserId = user.user.id;

    const { data: project } = await supabase
      .from('projects')
      .insert({ name: 'Test Project', user_id: testUserId })
      .select()
      .single();
    testProjectId = project.id;
  });

  it('should enforce RLS: users can only access their own secrets', async () => {
    // User A creates secret
    const { data: secret } = await supabase
      .from('secrets')
      .insert({
        name: 'USER_A_SECRET',
        encrypted_value: 'encrypted',
        project_id: testProjectId,
        user_id: testUserId
      })
      .select()
      .single();

    // User B tries to access User A's secret
    const { data: userB } = await supabase.auth.signUp({
      email: 'userb@example.com',
      password: 'password'
    });

    const supabaseUserB = createClient(
      process.env.SUPABASE_LOCAL_URL,
      process.env.SUPABASE_LOCAL_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${userB.session.access_token}` }
        }
      }
    );

    const { data, error } = await supabaseUserB
      .from('secrets')
      .select('*')
      .eq('id', secret.id);

    // User B should not see User A's secret (RLS enforced)
    expect(data).toHaveLength(0);
  });

  it('should create secret with encrypted value', async () => {
    const { data: secret, error } = await supabase
      .from('secrets')
      .insert({
        name: 'TEST_SECRET',
        encrypted_value: 'base64_encrypted_blob_here',
        project_id: testProjectId,
        user_id: testUserId,
        service_name: 'TestService',
        environment: 'development'
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(secret.id).toBeDefined();
    expect(secret.encrypted_value).toBe('base64_encrypted_blob_here');
    expect(secret.name).toBe('TEST_SECRET');
  });
});
```

---

## End-to-End Testing Strategy

### Technology Stack

**Framework:** Playwright 1.40.x
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile emulation (iOS Safari, Android Chrome)
- Built-in test runner with parallel execution
- Network interception and mocking
- Screenshot and video recording on failure

**Why Playwright?**
- Modern, fast, and reliable
- Built-in retry and wait mechanisms
- Excellent debugging tools
- Cross-browser support (WebKit, Chromium, Firefox)
- TypeScript-first

### What to E2E Test

**Critical User Journeys (10% of tests):**

**1. User Registration and Master Password Setup:**
```typescript
// tests/e2e/auth/registration.spec.ts
import { test, expect } from '@playwright/test';

test('User can register and set master password', async ({ page }) => {
  // Navigate to signup
  await page.goto('/signup');

  // Fill registration form
  await page.getByLabel('Email').fill('newuser@example.com');
  await page.getByLabel('Account Password').fill('secure_password_123');
  await page.getByLabel('Confirm Password').fill('secure_password_123');
  await page.getByRole('button', { name: /sign up/i }).click();

  // Wait for email verification (mocked in test env)
  await expect(page).toHaveURL('/verify-email');

  // Master password setup
  await page.goto('/setup-master-password');
  await page.getByLabel('Master Password').fill('master_password_strong');
  await page.getByLabel('Confirm Master Password').fill('master_password_strong');
  await page.getByRole('button', { name: /continue/i }).click();

  // Should redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText(/welcome/i)).toBeVisible();
});
```

**2. Create Secret with Encryption:**
```typescript
// tests/e2e/secrets/create-secret.spec.ts
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

test('User can create and encrypt secret', async ({ page }) => {
  // Login and unlock master key
  await loginAs(page, 'test@example.com', 'account_password', 'master_password');

  // Navigate to projects
  await page.goto('/projects/test-project-id');

  // Click "Add Secret" button
  await page.getByRole('button', { name: /add secret/i }).click();

  // Fill secret form
  await page.getByLabel('Secret Name').fill('OPENAI_API_KEY');
  await page.getByLabel('Service').fill('OpenAI');
  await page.getByLabel('Secret Value').fill('sk_test_abc123xyz');
  await page.getByLabel('Environment').selectOption('development');
  await page.getByLabel('Tags').fill('ai, api-key');

  // Submit form
  await page.getByRole('button', { name: /save secret/i }).click();

  // Wait for success message
  await expect(page.getByText(/secret created successfully/i)).toBeVisible();

  // Verify secret appears in list (encrypted)
  await expect(page.getByText('OPENAI_API_KEY')).toBeVisible();
  await expect(page.getByText('OpenAI')).toBeVisible();

  // Secret value should NOT be visible initially
  await expect(page.getByText('sk_test_abc123xyz')).not.toBeVisible();
});
```

**3. Decrypt and View Secret:**
```typescript
// tests/e2e/secrets/view-secret.spec.ts
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

test('User can decrypt and view secret', async ({ page }) => {
  await loginAs(page, 'test@example.com', 'account_password', 'master_password');

  await page.goto('/projects/test-project-id');

  // Find secret card
  const secretCard = page.locator('[data-testid="secret-card-OPENAI_API_KEY"]');

  // Click "Reveal" button
  await secretCard.getByRole('button', { name: /reveal/i }).click();

  // Master password prompt (if locked)
  const passwordPrompt = page.getByRole('dialog', { name: /enter master password/i });
  if (await passwordPrompt.isVisible()) {
    await page.getByLabel('Master Password').fill('master_password');
    await page.getByRole('button', { name: /unlock/i }).click();
  }

  // Secret value should now be visible
  await expect(secretCard.getByText('sk_test_abc123xyz')).toBeVisible();

  // Click "Hide" button
  await secretCard.getByRole('button', { name: /hide/i }).click();

  // Secret should be hidden again
  await expect(secretCard.getByText('sk_test_abc123xyz')).not.toBeVisible();
});
```

**4. Team Collaboration (Share Secret):**
```typescript
// tests/e2e/collaboration/share-secret.spec.ts
import { test, expect } from '@playwright/test';

test('Owner can invite team member and share secrets', async ({ page, context }) => {
  // Login as owner
  await loginAs(page, 'owner@example.com', 'password', 'master_password');

  await page.goto('/team');

  // Invite new member
  await page.getByRole('button', { name: /invite member/i }).click();
  await page.getByLabel('Email').fill('developer@example.com');
  await page.getByLabel('Role').selectOption('developer');
  await page.getByRole('button', { name: /send invitation/i }).click();

  await expect(page.getByText(/invitation sent/i)).toBeVisible();

  // Accept invitation in new browser context (different user)
  const memberPage = await context.newPage();
  await memberPage.goto('/invitations/test-invitation-token');
  await memberPage.getByRole('button', { name: /accept/i }).click();

  // Setup master password for new member
  await memberPage.getByLabel('Master Password').fill('developer_master_password');
  await memberPage.getByRole('button', { name: /continue/i }).click();

  // Developer should see shared project
  await expect(memberPage.getByText('Shared Project')).toBeVisible();

  // Developer can view (but not delete) secrets based on role
  await memberPage.goto('/projects/test-project-id');
  await expect(memberPage.getByText('OPENAI_API_KEY')).toBeVisible();

  // Developer role should NOT see delete button
  await expect(
    memberPage.getByRole('button', { name: /delete project/i })
  ).not.toBeVisible();
});
```

**5. AI Assistant Integration:**
```typescript
// tests/e2e/ai/ai-assistant.spec.ts
import { test, expect } from '@playwright/test';

test('User can ask AI assistant for help acquiring API key', async ({ page }) => {
  await loginAs(page, 'test@example.com', 'password', 'master_password');

  await page.goto('/ai-chat');

  // Type message to AI
  const chatInput = page.getByPlaceholder(/ask me anything/i);
  await chatInput.fill('How do I get an OpenAI API key?');
  await chatInput.press('Enter');

  // Wait for AI response
  const aiMessage = page.locator('[data-role="ai-message"]').last();
  await expect(aiMessage).toBeVisible({ timeout: 10000 });

  // AI should provide step-by-step guidance
  await expect(aiMessage).toContainText(/sign up/i);
  await expect(aiMessage).toContainText(/api key/i);

  // Follow guided acquisition flow
  await aiMessage.getByRole('button', { name: /start guided flow/i }).click();

  // Guided flow should open
  await expect(page.getByText(/step 1:/i)).toBeVisible();
});
```

### E2E Test Organization

**File Structure:**
```
tests/
├── e2e/
│   ├── auth/
│   │   ├── registration.spec.ts
│   │   ├── login.spec.ts
│   │   └── password-reset.spec.ts
│   ├── secrets/
│   │   ├── create-secret.spec.ts
│   │   ├── view-secret.spec.ts
│   │   ├── update-secret.spec.ts
│   │   └── delete-secret.spec.ts
│   ├── collaboration/
│   │   ├── share-secret.spec.ts
│   │   ├── team-permissions.spec.ts
│   │   └── approval-workflow.spec.ts
│   └── ai/
│       ├── ai-assistant.spec.ts
│       └── guided-acquisition.spec.ts
├── helpers/
│   ├── auth.ts          # Login helpers
│   └── fixtures.ts      # Test data
└── playwright.config.ts
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Security Testing Strategy

### Security Test Categories

**1. Encryption Correctness:**
- Verify AES-256-GCM encryption works correctly
- Confirm PBKDF2 uses 600,000 iterations (OWASP 2023)
- Validate nonces are unique per encryption
- Test key derivation consistency

**2. Authentication Security:**
- JWT signature verification
- Token expiration enforcement
- Session hijacking prevention
- Brute-force protection (rate limiting)

**3. Authorization (RBAC & RLS):**
- Test row-level security policies
- Verify users can only access their organization's data
- Test role-based permission enforcement
- Ensure privilege escalation is impossible

**4. Zero-Knowledge Verification:**
- Confirm server never receives plaintext secrets
- Verify master password is never transmitted
- Test that encrypted data cannot be decrypted server-side
- Validate client-side encryption before transmission

**5. Input Validation & Injection Prevention:**
- SQL injection tests (should be prevented by RLS and parameterized queries)
- XSS prevention (React escaping + CSP)
- Path traversal prevention
- CSRF protection

### Security Test Examples

**Encryption Security Test:**
```typescript
// lib/crypto/security.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './encryption';

describe('Encryption Security', () => {
  it('should use unique nonces for each encryption', async () => {
    const plaintext = 'secret';
    const masterKey = await deriveMasterKey('password', 'salt');

    const encrypted1 = await encrypt(plaintext, masterKey);
    const encrypted2 = await encrypt(plaintext, masterKey);

    // Different ciphertext (different nonces)
    expect(encrypted1).not.toBe(encrypted2);

    // Extract nonces (first 12 bytes after base64 decode)
    const nonce1 = encrypted1.substring(0, 16); // Base64 prefix
    const nonce2 = encrypted2.substring(0, 16);

    expect(nonce1).not.toBe(nonce2);
  });

  it('should fail decryption if ciphertext is tampered', async () => {
    const plaintext = 'secret';
    const masterKey = await deriveMasterKey('password', 'salt');

    const encrypted = await encrypt(plaintext, masterKey);

    // Tamper with ciphertext (flip a bit)
    const tampered = encrypted.slice(0, -1) + 'X';

    // Decryption should fail (GCM auth tag verification)
    await expect(decrypt(tampered, masterKey)).rejects.toThrow();
  });

  it('should enforce PBKDF2 iteration count (600k)', async () => {
    // Mock crypto.subtle.deriveKey to verify parameters
    const originalDeriveKey = crypto.subtle.deriveKey;
    let capturedIterations: number | undefined;

    crypto.subtle.deriveKey = vi.fn(async (algorithm, ...args) => {
      if ('iterations' in algorithm) {
        capturedIterations = algorithm.iterations;
      }
      return originalDeriveKey.call(crypto.subtle, algorithm, ...args);
    });

    await deriveMasterKey('password', 'salt');

    expect(capturedIterations).toBe(600000); // OWASP 2023

    crypto.subtle.deriveKey = originalDeriveKey;
  });
});
```

**RLS Security Test:**
```typescript
// tests/security/rls.test.ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Row-Level Security', () => {
  it('should prevent cross-organization data access', async () => {
    // Setup: Two users in different organizations
    const userA = await createTestUser('usera@example.com', 'org-a');
    const userB = await createTestUser('userb@example.com', 'org-b');

    const supabaseA = createAuthenticatedClient(userA.token);
    const supabaseB = createAuthenticatedClient(userB.token);

    // User A creates secret in org A
    const { data: secretA } = await supabaseA
      .from('secrets')
      .insert({
        name: 'ORG_A_SECRET',
        encrypted_value: 'encrypted',
        project_id: userA.projectId,
        organization_id: 'org-a'
      })
      .select()
      .single();

    // User B attempts to access User A's secret
    const { data: accessAttempt, error } = await supabaseB
      .from('secrets')
      .select('*')
      .eq('id', secretA.id);

    // RLS should block access
    expect(accessAttempt).toHaveLength(0);
    expect(error).toBeNull(); // No error, just empty result
  });

  it('should allow users to access secrets in their organization', async () => {
    const userA = await createTestUser('usera@example.com', 'shared-org');
    const userB = await createTestUser('userb@example.com', 'shared-org');

    const supabaseA = createAuthenticatedClient(userA.token);
    const supabaseB = createAuthenticatedClient(userB.token);

    // User A creates secret in shared org
    const { data: secret } = await supabaseA
      .from('secrets')
      .insert({
        name: 'SHARED_SECRET',
        encrypted_value: 'encrypted',
        organization_id: 'shared-org'
      })
      .select()
      .single();

    // User B (same org) should be able to access
    const { data: accessedSecret } = await supabaseB
      .from('secrets')
      .select('*')
      .eq('id', secret.id)
      .single();

    expect(accessedSecret).toBeDefined();
    expect(accessedSecret.name).toBe('SHARED_SECRET');
  });
});
```

**Zero-Knowledge Verification:**
```typescript
// tests/security/zero-knowledge.test.ts
import { describe, it, expect } from 'vitest';

describe('Zero-Knowledge Architecture', () => {
  it('should never transmit master password to server', async () => {
    const networkRequests: Request[] = [];

    // Intercept all network requests
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url, options) => {
      networkRequests.push({ url, ...options });
      return originalFetch(url, options);
    });

    // Simulate user login and secret creation
    await loginUser('test@example.com', 'account_password', 'master_password');
    await createSecret('TEST_SECRET', 'secret_value');

    // Check all network requests
    for (const request of networkRequests) {
      const body = request.body ? JSON.parse(request.body) : {};

      // Master password should NEVER appear in any request
      expect(JSON.stringify(body)).not.toContain('master_password');
      expect(request.headers?.Authorization).not.toContain('master_password');
    }

    global.fetch = originalFetch;
  });

  it('should only transmit encrypted secret values', async () => {
    const networkRequests: string[] = [];

    global.fetch = vi.fn(async (url, options) => {
      if (url.includes('/secrets')) {
        networkRequests.push(options.body);
      }
      return originalFetch(url, options);
    });

    const plaintextSecret = 'sk_test_my_secret_api_key_12345';
    await createSecret('API_KEY', plaintextSecret);

    // Check that plaintext never appears in network requests
    for (const body of networkRequests) {
      expect(body).not.toContain(plaintextSecret);
      expect(body).not.toContain('sk_test_my_secret_api_key');
    }

    global.fetch = originalFetch;
  });
});
```

### Automated Security Scanning

**Dependabot (GitHub):**
- Automatically scan dependencies for known vulnerabilities
- Create PRs for security updates
- Run weekly

**OWASP Dependency-Check (CI):**
```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  schedule:
    - cron: '0 0 * * 0' # Weekly
  pull_request:
    branches: [main]

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run OWASP Dependency-Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'Abyrith'
          path: '.'
          format: 'HTML'
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: dependency-check-report
          path: dependency-check-report.html
```

**Third-Party Security Audit:**
- Conduct penetration testing before launch
- Schedule annual security audits
- Focus on zero-knowledge encryption, RLS, and authentication

---

## Performance & Load Testing

### Performance Test Objectives

**1. Frontend Performance:**
- Page load time < 2s (3G network)
- Time to Interactive < 3s
- Client-side encryption < 100ms per secret
- PBKDF2 derivation < 5s (acceptable for security)

**2. Backend Performance:**
- API response time < 200ms p95 (edge-cached)
- Database query < 500ms p95
- Rate limiting overhead < 10ms

**3. Load Testing:**
- Handle 1,000 concurrent users
- 10,000 requests/second at edge
- Database connections scale via PgBouncer

### Performance Testing Tools

**Frontend (Lighthouse):**
```bash
# Run Lighthouse in CI
npm run build
npm run start

lighthouse http://localhost:3000 \
  --output=html \
  --output-path=./lighthouse-report.html \
  --chrome-flags="--headless"
```

**Load Testing (k6):**
```javascript
// tests/load/api-load.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // <1% error rate
  },
};

export default function () {
  const token = __ENV.TEST_JWT_TOKEN;

  // Test API endpoint
  const res = http.get('https://api.abyrith.com/v1/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

**Run load test:**
```bash
k6 run tests/load/api-load.test.js
```

### Performance Benchmarks

**Encryption Performance Test:**
```typescript
// lib/crypto/benchmarks.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveMasterKey } from './encryption';

describe('Encryption Performance Benchmarks', () => {
  it('should encrypt secrets in < 100ms', async () => {
    const masterKey = await deriveMasterKey('password', 'salt');
    const plaintext = 'sk_test_secret_api_key_here';

    const start = Date.now();
    await encrypt(plaintext, masterKey);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should decrypt secrets in < 100ms', async () => {
    const masterKey = await deriveMasterKey('password', 'salt');
    const plaintext = 'sk_test_secret_api_key_here';
    const encrypted = await encrypt(plaintext, masterKey);

    const start = Date.now();
    await decrypt(encrypted, masterKey);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should derive master key in 1-5 seconds (PBKDF2 600k iterations)', async () => {
    const start = Date.now();
    await deriveMasterKey('password', 'salt');
    const duration = Date.now() - start;

    // Security vs UX tradeoff
    expect(duration).toBeGreaterThan(1000); // At least 1s for security
    expect(duration).toBeLessThan(5000);    // Less than 5s for UX
  });
});
```

---

## Test Data Management

### Test Data Strategy

**1. Fixtures (Static Test Data):**
```typescript
// tests/fixtures/secrets.ts
export const testSecrets = {
  openaiKey: {
    id: 'test-secret-openai',
    name: 'OPENAI_API_KEY',
    encrypted_value: 'base64_encrypted_blob_here',
    service_name: 'OpenAI',
    environment: 'development',
    tags: ['ai', 'api-key'],
    created_at: '2025-10-30T12:00:00Z',
  },
  stripeKey: {
    id: 'test-secret-stripe',
    name: 'STRIPE_SECRET_KEY',
    encrypted_value: 'base64_encrypted_blob_here',
    service_name: 'Stripe',
    environment: 'development',
    tags: ['payment', 'api-key'],
    created_at: '2025-10-30T12:00:00Z',
  },
};
```

**2. Factories (Dynamic Test Data):**
```typescript
// tests/factories/secret.factory.ts
import { faker } from '@faker-js/faker';

export function createTestSecret(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.internet.domainWord().toUpperCase() + '_API_KEY',
    encrypted_value: faker.string.alphanumeric(64),
    service_name: faker.company.name(),
    environment: faker.helpers.arrayElement(['development', 'staging', 'production']),
    tags: [faker.word.noun(), faker.word.noun()],
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

// Usage
const secret = createTestSecret({ name: 'CUSTOM_KEY', environment: 'production' });
```

**3. Database Seeding (Integration Tests):**
```typescript
// tests/helpers/seed.ts
import { createClient } from '@supabase/supabase-js';

export async function seedTestDatabase() {
  const supabase = createClient(
    process.env.SUPABASE_TEST_URL,
    process.env.SUPABASE_TEST_SERVICE_KEY
  );

  // Create test organization
  const { data: org } = await supabase
    .from('organizations')
    .insert({ name: 'Test Organization' })
    .select()
    .single();

  // Create test user
  const { data: user } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'test_password',
    email_confirm: true,
  });

  // Create test project
  const { data: project } = await supabase
    .from('projects')
    .insert({
      name: 'Test Project',
      organization_id: org.id,
      created_by: user.id,
    })
    .select()
    .single();

  return { org, user, project };
}

export async function cleanTestDatabase() {
  const supabase = createClient(
    process.env.SUPABASE_TEST_URL,
    process.env.SUPABASE_TEST_SERVICE_KEY
  );

  // Delete all test data
  await supabase.from('secrets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
```

**4. MSW Handlers (API Mocking):**
```typescript
// tests/mocks/handlers/secrets.ts
import { http, HttpResponse } from 'msw';
import { testSecrets } from '../../fixtures/secrets';

export const secretsHandlers = [
  http.get('/v1/projects/:projectId/secrets', ({ params }) => {
    return HttpResponse.json({
      data: Object.values(testSecrets),
      pagination: { page: 1, per_page: 20, total: 2, total_pages: 1 }
    });
  }),

  http.post('/v1/secrets', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        ...body,
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),
];
```

### Test Isolation

**Best Practices:**
- Each test should be independent (no shared state)
- Use `beforeEach` to reset state
- Clean up after tests (`afterEach`)
- Use transactions for database tests (rollback after test)
- Avoid test interdependencies (Test A shouldn't depend on Test B)

**Example:**
```typescript
describe('Secrets API', () => {
  let supabase;
  let testUser;
  let testProject;

  beforeEach(async () => {
    // Setup fresh state for each test
    supabase = createTestClient();
    const seedData = await seedTestDatabase();
    testUser = seedData.user;
    testProject = seedData.project;
  });

  afterEach(async () => {
    // Clean up after each test
    await cleanTestDatabase();
  });

  it('should create secret', async () => {
    // Test implementation
  });

  it('should list secrets', async () => {
    // Test implementation (independent of previous test)
  });
});
```

---

## Testing Workflow & CI/CD Integration

### Local Development Workflow

**Pre-commit Hooks (Husky):**
```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test && npm run type-check"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Running Tests Locally:**
```bash
# Unit tests (fast feedback)
npm run test:watch

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: pnpm install

      - name: Run Supabase locally
        run: |
          pnpm supabase start
          pnpm supabase db reset

      - name: Run integration tests
        run: pnpm test:integration
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm playwright install --with-deps

      - name: Build frontend
        run: pnpm build

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          BASE_URL: http://localhost:3000

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run security audit
        run: pnpm audit --audit-level=moderate

      - name: Run OWASP Dependency-Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'Abyrith'
          path: '.'
          format: 'HTML'
```

### Test Execution Strategy

**On Every Commit:**
- Lint and format check
- Unit tests (fast feedback)

**On Pull Request:**
- All unit tests
- Integration tests
- Type checking
- Security scan

**Before Merge to Main:**
- Full test suite (unit + integration + E2E)
- Coverage report
- Performance benchmarks
- Security audit

**Nightly (Scheduled):**
- Full E2E test suite (all browsers)
- Load testing
- Security vulnerability scan
- Visual regression tests

---

## Coverage Requirements

### Coverage Targets by Layer

| Layer | Target Coverage | Critical Paths | Priority |
|-------|----------------|----------------|----------|
| **Encryption** | 95%+ | 100% | P0 |
| **Authentication** | 90%+ | 100% | P0 |
| **Authorization (RLS)** | 90%+ | 100% | P0 |
| **API Endpoints** | 80%+ | 90%+ | P1 |
| **Business Logic** | 80%+ | 90%+ | P1 |
| **React Components** | 70%+ | 80%+ | P2 |
| **Utilities** | 70%+ | 80%+ | P2 |
| **UI Components** | 60%+ | N/A | P3 |

**Coverage Metrics:**
- **Line Coverage**: % of code lines executed during tests
- **Branch Coverage**: % of conditional branches tested
- **Function Coverage**: % of functions called during tests
- **Statement Coverage**: % of statements executed

**Enforcement:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
      include: [
        'lib/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        '**/types/**',
        '**/mocks/**',
      ],
      // Fail CI if coverage drops below thresholds
      thresholds: {
        'lib/crypto/**': {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
        'lib/auth/**': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  },
});
```

---

## Testing Best Practices

### Best Practices

**1. Write Tests First (TDD):**
```typescript
// Write test first
describe('deriveMasterKey', () => {
  it('should derive consistent key from same password and salt', async () => {
    const key1 = await deriveMasterKey('password', 'salt');
    const key2 = await deriveMasterKey('password', 'salt');
    expect(key1).toEqual(key2);
  });
});

// Then implement
export async function deriveMasterKey(password: string, salt: string) {
  // Implementation
}
```

**2. Test Behavior, Not Implementation:**
```typescript
// ❌ Bad: Testing implementation details
it('should call encrypt function', () => {
  const spy = vi.spyOn(crypto, 'encrypt');
  component.saveSecret();
  expect(spy).toHaveBeenCalled();
});

// ✅ Good: Testing behavior
it('should save encrypted secret to database', async () => {
  await component.saveSecret('plaintext');
  const secret = await getSecretFromDB();
  expect(secret.encrypted_value).not.toBe('plaintext');
});
```

**3. Use Descriptive Test Names:**
```typescript
// ❌ Bad
it('test 1', () => {});
it('works', () => {});

// ✅ Good
it('should decrypt secret with correct master key', () => {});
it('should throw error when decrypting with wrong key', () => {});
```

**4. Arrange-Act-Assert Pattern:**
```typescript
it('should create project with valid data', async () => {
  // Arrange
  const projectData = { name: 'Test Project', org_id: 'test-org' };

  // Act
  const result = await createProject(projectData);

  // Assert
  expect(result.id).toBeDefined();
  expect(result.name).toBe('Test Project');
});
```

**5. Test Edge Cases:**
```typescript
describe('encrypt', () => {
  it('should encrypt normal string', async () => {
    // Normal case
  });

  it('should encrypt empty string', async () => {
    // Edge case: empty
  });

  it('should encrypt very long string (10MB)', async () => {
    // Edge case: large input
  });

  it('should encrypt unicode characters', async () => {
    // Edge case: special characters
  });

  it('should encrypt null bytes', async () => {
    // Edge case: binary data
  });
});
```

**6. Mock External Dependencies:**
```typescript
// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signIn: vi.fn().mockResolvedValue({ data: { user: {} } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));
```

**7. Keep Tests Fast:**
- Unit tests should run in milliseconds
- Use mocks instead of real API calls
- Avoid unnecessary `sleep()` or delays
- Parallelize independent tests

**8. Avoid Test Interdependencies:**
```typescript
// ❌ Bad: Tests depend on execution order
it('should create user', async () => {
  await createUser('test@example.com');
});

it('should find user', async () => {
  const user = await findUser('test@example.com'); // Depends on previous test
  expect(user).toBeDefined();
});

// ✅ Good: Each test is independent
describe('User Management', () => {
  beforeEach(async () => {
    await createUser('test@example.com');
  });

  it('should create user', async () => {
    const user = await findUser('test@example.com');
    expect(user).toBeDefined();
  });

  it('should update user', async () => {
    await updateUser('test@example.com', { name: 'New Name' });
    const user = await findUser('test@example.com');
    expect(user.name).toBe('New Name');
  });
});
```

---

## Anti-Patterns to Avoid

### Common Testing Anti-Patterns

**1. Testing Implementation Details:**
```typescript
// ❌ Bad
it('should call useState hook', () => {
  const spy = vi.spyOn(React, 'useState');
  render(<Component />);
  expect(spy).toHaveBeenCalled();
});

// ✅ Good
it('should toggle visibility when button clicked', () => {
  render(<Component />);
  expect(screen.getByText('Hidden')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /toggle/i }));
  expect(screen.getByText('Visible')).toBeVisible();
});
```

**2. Flaky Tests (Non-Deterministic):**
```typescript
// ❌ Bad: Race condition
it('should load data', async () => {
  fetchData();
  await sleep(1000); // Hope 1 second is enough
  expect(data).toBeDefined();
});

// ✅ Good: Wait for specific condition
it('should load data', async () => {
  fetchData();
  await waitFor(() => {
    expect(data).toBeDefined();
  }, { timeout: 5000 });
});
```

**3. Testing Too Much in One Test:**
```typescript
// ❌ Bad: Mega test
it('should do everything', async () => {
  // Create user
  // Login
  // Create project
  // Create secret
  // Update secret
  // Delete secret
  // Logout
  // 100 lines of test code
});

// ✅ Good: Focused tests
it('should create user', async () => {});
it('should login user', async () => {});
it('should create project', async () => {});
```

**4. Brittle Selectors (E2E):**
```typescript
// ❌ Bad: Fragile selectors
await page.locator('div > div > button:nth-child(3)').click();
await page.locator('.css-abc123-Button').click();

// ✅ Good: Semantic selectors
await page.getByRole('button', { name: /save/i }).click();
await page.getByTestId('save-button').click();
await page.getByLabel('Email').fill('test@example.com');
```

**5. Ignoring Test Failures:**
```typescript
// ❌ Bad
it.skip('should validate input', () => {
  // Skip because it's failing
});

// ✅ Good: Fix or remove
it('should validate input', () => {
  // Fix the test or remove if no longer relevant
});
```

**6. Not Cleaning Up:**
```typescript
// ❌ Bad: Leaving state between tests
let globalUser;

it('should create user', () => {
  globalUser = createUser();
});

it('should find user', () => {
  expect(findUser(globalUser.id)).toBeDefined();
});

// ✅ Good: Clean state
describe('User Tests', () => {
  let user;

  beforeEach(() => {
    user = createUser();
  });

  afterEach(() => {
    cleanupUser(user.id);
  });

  it('should create user', () => {});
  it('should find user', () => {});
});
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `TECH-STACK.md` - Technology specifications (Vitest, Playwright, MSW, Testing Library)
- [x] `07-frontend/frontend-architecture.md` - Frontend architecture to test
- [x] `05-api/api-rest-design.md` - API contracts to test
- [x] `03-security/security-model.md` - Security requirements to validate

**Testing Infrastructure:**
- Vitest 1.x (unit/integration testing)
- Playwright 1.40.x (E2E testing)
- Testing Library 14.x (React component testing)
- MSW 2.x (API mocking)
- c8 (code coverage)
- k6 (load testing)

---

## References

### Internal Documentation
- `TECH-STACK.md` - Testing tools and versions
- `07-frontend/frontend-architecture.md` - Frontend structure to test
- `05-api/api-rest-design.md` - API contracts and error handling
- `03-security/security-model.md` - Security guarantees to verify
- `GLOSSARY.md` - Testing terminology

### External Resources
- [Vitest Documentation](https://vitest.dev/) - Vitest testing framework
- [Playwright Documentation](https://playwright.dev/) - E2E testing
- [Testing Library](https://testing-library.com/) - React component testing
- [MSW Documentation](https://mswjs.io/) - API mocking
- [Kent C. Dodds - Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Martin Fowler - Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Engineering Lead | Initial comprehensive testing strategy |

---

## Notes

### Future Enhancements
- **Visual Regression Testing** - Percy or Chromatic for UI screenshots
- **Contract Testing** - Pact for API contract verification
- **Mutation Testing** - Stryker to validate test quality
- **Performance Budgets** - Enforce performance thresholds in CI
- **Chaos Engineering** - Simulate failures in production-like environments
- **A/B Testing Framework** - Support feature flag testing

### Known Issues
- PBKDF2 performance tests may fail on slow CI runners (adjust thresholds)
- E2E tests occasionally flaky due to network conditions (retry logic in place)
- Large integration test suite takes 10+ minutes (consider parallelization)

### Next Review Date
2025-12-01 (review after initial implementation and first production deployment)
