# GitHub Tests - Quick Reference

One-page reference for GitHub integration testing.

## 🚀 Quick Start (5 minutes)

```bash
# 1. Install dependencies
npm install && npx playwright install chromium

# 2. Configure environment
cp .env.local.example .env.local
# Add your Supabase credentials to .env.local

# 3. Run tests
npm test                                           # Unit tests
npx playwright test tests/integration/github.spec.ts --ui  # Integration tests
```

## 📁 Test Files

```
tests/
├── integration/
│   └── github.spec.ts              # E2E tests (OAuth, repos, sync)
├── helpers/
│   ├── github-helpers.ts           # GitHub test utilities
│   ├── test-utils.ts               # General test utilities
│   └── playwright-helpers.ts       # Playwright utilities
├── GITHUB-TEST-SETUP.md            # Full setup guide
├── GITHUB-TESTS-SUMMARY.md         # Complete test summary
└── README.md                       # Main test documentation

lib/
├── crypto/
│   └── github-encryption.test.ts   # Encryption unit tests
└── api/
    └── github.test.ts              # API service unit tests
```

## 🧪 Running Tests

### Unit Tests
```bash
npm test                                        # All unit tests
npm test lib/crypto/github-encryption.test.ts  # Encryption only
npm test lib/api/github.test.ts                # API only
npm test -- --grep "GitHub"                    # All GitHub tests
```

### Integration Tests
```bash
npx playwright test tests/integration/github.spec.ts         # All
npx playwright test tests/integration/github.spec.ts --ui    # UI mode
npx playwright test --grep "OAuth"                           # OAuth only
npx playwright test --grep "Repository Linking"              # Repos only
npx playwright test --grep "Secret Import"                   # Import only
```

### Debug Mode
```bash
npx playwright test tests/integration/github.spec.ts --debug  # Step through
npx playwright test tests/integration/github.spec.ts --headed # See browser
DEBUG=pw:api npx playwright test ...                          # Network logs
```

## 🔧 Common Test Utilities

### Mock Data Generators
```typescript
import {
  generateMockGitHubToken,
  generateMockRepository,
  generateMockLinkedRepository,
  generateMockSyncLog,
  createMockSupabaseClient,
} from '../helpers/github-helpers'

// Generate test token
const token = generateMockGitHubToken('ghp')  // ghp_random_string

// Generate repository
const repo = generateMockRepository({
  name: 'test-repo',
  private: true,
})

// Generate multiple repos
const repos = generateMockRepositories(10)

// Mock Supabase client
const mockClient = createMockSupabaseClient({
  sessionUser: { id: 'test-user' },
  connectionData: generateMockGitHubConnection(),
})
```

### Test Utilities
```typescript
import {
  cleanupTestData,
  cleanupGitHubConnection,
  cleanupLinkedRepositories,
  verifySecretEncrypted,
} from '../helpers/test-utils'

// Cleanup after test
await cleanupGitHubConnection(userId)
await cleanupLinkedRepositories(orgId)
await cleanupTestData(userId)

// Verify encryption
const isEncrypted = await verifySecretEncrypted(secretId, plaintext)
```

### Playwright Helpers
```typescript
import {
  loginUser,
  setupMasterPassword,
  verifyEncryptedRequest,
  screenshotOnFailure,
} from '../helpers/playwright-helpers'

// Login test user
await loginUser(page, testUser)

// Setup master password
await setupMasterPassword(page, 'MasterPassword123!')

// Verify no plaintext in network
await verifyEncryptedRequest(page, async () => {
  await doSomeOperation()
}, plaintextValue)

// Screenshot on error
try {
  // test code
} catch (error) {
  await screenshotOnFailure(page, 'test-name')
  throw error
}
```

## 📝 Test Structure Template

```typescript
import { test, expect } from '@playwright/test'
import { generateTestUser, cleanupTestData } from '../helpers/test-utils'
import { generateMockGitHubToken } from '../helpers/github-helpers'

test.describe('Feature Name', () => {
  let testUser: ReturnType<typeof generateTestUser>

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser()
    // Setup code
  })

  test.afterEach(async () => {
    // Cleanup
    await cleanupTestData(testUser.id)
  })

  test('should do something', async ({ page }) => {
    // Test code
    expect(result).toBe(expected)
  })
})
```

## 🔐 Security Verification

### Verify Token Encryption
```typescript
// Check encrypted structure
expect(encrypted.encrypted_github_token).toBeDefined()
expect(encrypted.token_nonce).toBeDefined()
expect(encrypted.token_dek).toBeDefined()

// Check no plaintext
expect(encrypted.encrypted_github_token).not.toContain('ghp_')

// Round-trip test
const decrypted = await decryptGitHubToken(encrypted, password, salt)
expect(decrypted).toBe(originalToken)
```

### Verify Database Encryption
```typescript
const { data } = await adminClient
  .from('github_connections')
  .select('encrypted_github_token')
  .single()

// Token should be base64, not GitHub format
expect(data.encrypted_github_token).toMatch(/^[A-Za-z0-9+/]+=*$/)
expect(data.encrypted_github_token).not.toContain('ghp_')
```

### Verify Network Encryption
```typescript
await verifyEncryptedRequest(page, async () => {
  await page.click('button:has-text("Connect GitHub")')
}, plaintextToken)
```

## ⚙️ Environment Setup

### Minimal .env.local
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Full .env.local (for real GitHub testing)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Test tokens (optional)
TEST_GITHUB_TOKEN=ghp_your_test_token
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Supabase connection error | Check `.env.local` credentials |
| OAuth failed | Verify OAuth app setup and callback URL |
| Token decryption failed | Check master password and KEK salt |
| Repository list empty | Create test repo or use account with repos |
| Rate limit exceeded | Use mock mode or wait 1 hour |
| Browser not found | Run `npx playwright install chromium` |

## 📊 Test Coverage

- **Unit Tests (Encryption):** 100% coverage
- **Unit Tests (API):** >90% coverage
- **Integration Tests:** ~85% coverage
- **Overall:** ~87% coverage

## ⏱️ Performance Targets

| Operation | Target | Status |
|-----------|--------|--------|
| Token encryption | < 500ms | ✅ |
| Token decryption | < 500ms | ✅ |
| List repos | < 2s | ✅ |
| Secret preview | < 3s | ✅ |
| Secret import (10) | < 5s | ✅ |

## 📚 Documentation

- **Setup Guide:** `/tests/GITHUB-TEST-SETUP.md`
- **Full Summary:** `/tests/GITHUB-TESTS-SUMMARY.md`
- **Main Docs:** `/tests/README.md` (GitHub section)
- **This Reference:** `/tests/GITHUB-TESTS-QUICK-REF.md`

## 🎯 Test Checklist

Before committing:
- [ ] All unit tests pass (`npm test`)
- [ ] All integration tests pass (`npx playwright test`)
- [ ] Test data cleaned up
- [ ] No hardcoded secrets
- [ ] Encryption verified
- [ ] Error scenarios tested
- [ ] Documentation updated

## 💡 Tips

1. **Use UI mode for debugging:** `--ui` flag shows visual test runner
2. **Mock by default:** Use real GitHub only when necessary
3. **Clean up data:** Always use afterEach hooks
4. **Verify encryption:** Check at every step
5. **Screenshots on failure:** Use `screenshotOnFailure()` in catch blocks
6. **Use test account:** Never use production GitHub account

## 🚨 Common Pitfalls

❌ **DON'T:**
- Use production database for tests
- Commit `.env.local` or tokens
- Skip cleanup in afterEach
- Hardcode test data
- Use personal GitHub account

✅ **DO:**
- Use test database
- Mock external APIs
- Clean up after tests
- Generate test data dynamically
- Verify encryption always

## 🔗 Quick Links

- [Playwright Docs](https://playwright.dev/)
- [Supabase Testing](https://supabase.com/docs/guides/testing)
- [GitHub OAuth Docs](https://docs.github.com/en/apps/oauth-apps)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

## 📞 Support

Need help?
1. Check `/tests/GITHUB-TEST-SETUP.md`
2. Review test examples in `/tests/integration/github.spec.ts`
3. Check helper utilities in `/tests/helpers/github-helpers.ts`
4. Ask in team communication channel
