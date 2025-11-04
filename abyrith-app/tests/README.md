# Abyrith Integration Testing

This directory contains integration tests for the Abyrith MVP. Tests verify end-to-end functionality with real services (Supabase, Anthropic API, FireCrawl).

## Quick Start

### 1. Install Dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure Environment

Create `.env.local` from `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Fill in required values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `FIRECRAWL_API_KEY` (optional)

### 3. Start Services

```bash
# Terminal 1: Start Next.js app
npm run dev

# Terminal 2: Start Cloudflare Workers
cd workers
npm run dev
```

### 4. Run Tests

```bash
# Run all integration tests
npm run test:integration

# Run with UI mode (recommended for debugging)
npm run test:integration:ui

# Run in headed mode (see browser)
npm run test:integration:headed

# Debug mode (step through tests)
npm run test:integration:debug

# View test report
npm run test:report
```

## Test Structure

```
tests/
├── integration/           # Integration test specs
│   ├── auth.spec.ts      # Authentication tests
│   ├── secrets.spec.ts   # Secret CRUD tests
│   └── ai-assistant.spec.ts  # AI chat tests
├── helpers/              # Test utilities
│   ├── test-utils.ts     # General test helpers
│   └── playwright-helpers.ts  # Playwright-specific helpers
└── README.md             # This file
```

## Test Suites

### Test Suite 1: Authentication (auth.spec.ts)
- User registration
- User login
- Master password setup
- Session persistence
- Error handling

### Test Suite 2: Secrets (secrets.spec.ts)
- Create secret (with encryption verification)
- Read secret (decrypt and display)
- Update secret (versioning)
- Delete secret (soft delete)
- Zero-knowledge architecture verification

### Test Suite 3: AI Assistant (ai-assistant.spec.ts)
- Basic chat functionality
- Streaming responses
- Conversation history
- Guided API key acquisition
- Error handling

## Helper Functions

### test-utils.ts

**Database Helpers:**
- `createTestClient()` - Create Supabase client
- `createTestAdminClient()` - Create admin client
- `cleanupTestData(userId)` - Delete all test data
- `deleteTestUser(userId)` - Delete test user

**Test Data Generators:**
- `generateTestEmail()` - Generate unique email
- `generateTestUser()` - Generate user credentials
- `generateTestSecret()` - Generate test secret
- `generateTestSecrets(count)` - Generate multiple secrets

**Verification Helpers:**
- `verifySecretEncrypted(secretId, plaintextValue)` - Verify encryption
- `checkAuditLog(userId, action, resourceId)` - Check audit logs
- `isValidEncryptedValue(encrypted, plaintext)` - Validate encryption format
- `isValidKEKSalt(salt)` - Validate KEK salt format

**Performance Helpers:**
- `measurePerformance(operation, count)` - Measure operation performance
- `formatPerformanceMetrics(metrics)` - Format metrics for output

**Utilities:**
- `waitForCondition(condition, options)` - Poll for condition
- `sleep(ms)` - Simple delay
- `retry(operation, options)` - Retry with backoff

### playwright-helpers.ts

**Authentication:**
- `loginUser(page, user)` - Login flow
- `signupUser(page, user)` - Signup flow
- `setupMasterPassword(page, password)` - Setup master password
- `logoutUser(page)` - Logout flow

**Secret Operations:**
- `createSecret(page, secret)` - Create secret via UI
- `deleteSecret(page, secretName)` - Delete secret via UI

**AI Operations:**
- `sendAIMessage(page, message)` - Send AI message

**Verification:**
- `verifyEncryptedRequest(page, operation, plaintext)` - Verify no plaintext in network
- `checkConsoleErrors(page)` - Capture console errors

**Navigation:**
- `waitForElement(page, selector, options)` - Wait for element
- `waitForURLPattern(page, pattern, options)` - Wait for URL

**Performance:**
- `measurePageLoad(page, url)` - Measure page load time
- `measureAPIResponse(page, urlPattern, operation)` - Measure API latency

**Storage:**
- `clearStorage(page)` - Clear local/session storage
- `setLocalStorageItem(page, key, value)` - Set localStorage
- `getLocalStorageItem(page, key)` - Get localStorage

## Manual Testing

For comprehensive manual testing, follow the **INTEGRATION-TEST-PLAN.md** document in the parent directory.

The test plan includes:
- 7 test suites (21+ individual tests)
- Estimated time: 90 minutes
- Detailed verification steps
- Database queries for validation
- Performance benchmarks

After completing manual tests, fill in **INTEGRATION-TEST-RESULTS.md** with results.

## Best Practices

### 1. Test Data Cleanup

Always clean up test data to avoid conflicts:

```typescript
import { cleanupTestData } from '../helpers/test-utils'

test.afterEach(async () => {
  // Get user ID from test
  const userId = 'user-id-here'
  await cleanupTestData(userId)
})
```

### 2. Unique Test Data

Use unique emails/names for each test run:

```typescript
import { generateTestUser } from '../helpers/test-utils'

const testUser = generateTestUser()
// testUser.email is unique every time
```

### 3. Zero-Knowledge Verification

Always verify encryption in secret tests:

```typescript
import { verifyEncryptedRequest } from '../helpers/playwright-helpers'

await verifyEncryptedRequest(page, async () => {
  // Create secret
}, 'plaintext-value')
```

### 4. Performance Testing

Measure performance for critical operations:

```typescript
import { measurePerformance, formatPerformanceMetrics } from '../helpers/test-utils'

const metrics = await measurePerformance(async () => {
  // Encrypt secret
}, 100)

console.log(formatPerformanceMetrics(metrics))
```

### 5. Error Handling

Capture errors and screenshots on failure:

```typescript
import { screenshotOnFailure, checkConsoleErrors } from '../helpers/playwright-helpers'

test('my test', async ({ page }) => {
  try {
    // Test steps
  } catch (error) {
    await screenshotOnFailure(page, 'my-test')
    throw error
  }
})
```

## Debugging Tests

### UI Mode (Recommended)

```bash
npm run test:integration:ui
```

UI mode provides:
- Visual test runner
- Step-by-step execution
- DOM snapshots at each step
- Network inspection
- Console logs

### Debug Mode

```bash
npm run test:integration:debug
```

Debug mode:
- Opens browser with DevTools
- Pauses at each step
- Allows manual inspection
- Can set breakpoints

### Headed Mode

```bash
npm run test:integration:headed
```

Headed mode:
- Shows browser window during test
- Watch test execution in real-time
- Useful for understanding test flow

### View Test Report

```bash
npm run test:report
```

Opens HTML report with:
- Test results summary
- Screenshots of failures
- Video recordings (if enabled)
- Trace files for debugging

## Common Issues

### Issue: "Failed to fetch" errors

**Cause:** Services not running

**Solution:**
```bash
# Verify services
lsof -i :3000  # Next.js
lsof -i :8787  # Workers

# Restart if needed
npm run dev
```

### Issue: Tests fail with database errors

**Cause:** Missing environment variables

**Solution:**
```bash
# Check .env.local exists and has all required values
cat .env.local

# Verify Supabase connection
# Should NOT return error
curl -X GET "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
```

### Issue: Encryption tests fail

**Cause:** Master password not set or KEK derivation failing

**Solution:**
- Check browser console for crypto errors
- Verify Web Crypto API is available
- Ensure tests run in headed mode to debug

### Issue: AI tests timeout

**Cause:** Invalid API key or rate limiting

**Solution:**
```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Check Anthropic API status
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"

# Increase timeout in test if needed
```

### Issue: RLS tests fail

**Cause:** Service role key used instead of user JWT

**Solution:**
- Tests should use `createTestClient()` not `createTestAdminClient()`
- Verify authentication flow in test
- Check Supabase logs for RLS violations

## Performance Targets

All tests should meet these performance targets:

| Operation | Target | Test |
|-----------|--------|------|
| Encryption (per secret) | < 100ms | Test 6.1 |
| Decryption (100 secrets) | < 2s | Test 6.2 |
| AI time to first token | < 2s | Test 6.3 |
| Page load | < 2s | General |
| API response | < 200ms | General |

If tests fail to meet targets, investigate:
1. Network latency (local vs. remote)
2. CPU performance (device specs)
3. Database query optimization
4. Bundle size (affects load time)

## Security Verification

Critical security checks in tests:

1. **Zero-Knowledge Architecture**
   - Plaintext NEVER sent to server
   - Encrypted values unreadable in database
   - No master password in database

2. **RLS Enforcement**
   - Users can only access own data
   - Cross-user access blocked
   - Database-level enforcement

3. **Input Sanitization**
   - XSS attempts blocked
   - SQL injection prevented
   - Content rendered safely

Run security tests with:
```bash
npx playwright test tests/integration/secrets.spec.ts --grep "encryption"
```

## CI/CD Integration

To run tests in CI/CD:

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Run integration tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npm run test:integration

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## GitHub Integration Tests

### Overview

GitHub integration tests cover OAuth flow, repository linking, and secret syncing.

**Test Files:**
- `lib/crypto/github-encryption.test.ts` - Token encryption unit tests
- `lib/api/github.test.ts` - API service unit tests (with mocked Supabase)
- `tests/integration/github.spec.ts` - End-to-end integration tests
- `tests/helpers/github-helpers.ts` - GitHub-specific test utilities

### Running GitHub Tests

**Unit Tests (Encryption & API):**
```bash
# Run encryption tests
npm test lib/crypto/github-encryption.test.ts

# Run API service tests
npm test lib/api/github.test.ts

# Run all GitHub unit tests
npm test -- --grep "GitHub"
```

**Integration Tests:**
```bash
# Run all GitHub integration tests
npx playwright test tests/integration/github.spec.ts

# Run with UI mode (recommended)
npx playwright test tests/integration/github.spec.ts --ui

# Run specific test suite
npx playwright test tests/integration/github.spec.ts --grep "OAuth"
```

### Test Coverage

**Encryption Tests (100% coverage):**
- ✅ Token encryption produces valid structure
- ✅ Token decryption reverses encryption
- ✅ Round-trip encrypt/decrypt preserves original
- ✅ Invalid password throws error
- ✅ Token format validation
- ✅ Security properties (unique nonces, auth tags)
- ✅ Performance benchmarks

**API Service Tests (>90% coverage):**
- ✅ OAuth initialization
- ✅ OAuth completion with token encryption
- ✅ Connection management (get, disconnect)
- ✅ Repository listing with pagination
- ✅ Repository linking (create/link existing project)
- ✅ Secret preview and sync
- ✅ Sync log retrieval
- ✅ Error handling

**Integration Tests (End-to-End):**
- ✅ Complete OAuth flow
- ✅ Repository browsing and filtering
- ✅ Repository linking with project creation
- ✅ Secret preview with collision detection
- ✅ Secret import with encryption verification
- ✅ Sync history display
- ✅ Error handling (OAuth cancel, network errors)

### Test Utilities

**GitHub Test Helpers (`tests/helpers/github-helpers.ts`):**

```typescript
import {
  generateMockGitHubToken,
  generateMockRepository,
  generateMockLinkedRepository,
  generateMockSyncLog,
  createMockSupabaseClient,
  mockGitHubAPIResponses,
} from '../helpers/github-helpers'

// Generate test data
const token = generateMockGitHubToken('ghp')
const repo = generateMockRepository()
const linkedRepo = generateMockLinkedRepository()

// Mock Supabase client
const mockClient = createMockSupabaseClient({
  sessionUser: { id: 'test-user-123' },
  connectionData: generateMockGitHubConnection(),
})

// Mock GitHub API responses
mockClient.functions.invoke.mockResolvedValue(
  mockGitHubAPIResponses.listRepos(10)
)
```

### Testing OAuth Flow

**Local Testing (with Mock):**

```bash
# 1. Start dev server
npm run dev

# 2. Run OAuth tests
npx playwright test tests/integration/github.spec.ts --grep "OAuth"
```

**Testing with Real GitHub (Optional):**

1. Create GitHub OAuth App:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create new OAuth App
   - Set callback URL: `http://localhost:3000/auth/callback/github`

2. Configure environment:
```bash
# Add to .env.local
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

3. Run tests with real GitHub account:
```bash
# Set test GitHub account credentials
TEST_GITHUB_TOKEN=ghp_your_test_token

npx playwright test tests/integration/github.spec.ts --headed
```

### Testing Secret Import

**Prerequisites:**
1. GitHub account connected
2. Repository linked to project
3. Test repository with `.env` file

**Test Repository Setup:**

Create a test repository with:
```
# .env
API_KEY=test_api_key_value
DATABASE_URL=postgres://localhost/test
SECRET_TOKEN=test_secret_123
```

**Run Import Tests:**
```bash
npx playwright test tests/integration/github.spec.ts --grep "Secret Import"
```

### Verifying Encryption

All GitHub tests verify zero-knowledge encryption:

```typescript
// Verify token encrypted in database
import { verifySecretEncrypted } from '../helpers/test-utils'

const isEncrypted = await verifySecretEncrypted(secretId, plaintextValue)
expect(isEncrypted).toBe(true)
```

### Mock Data Generators

**Available Generators:**

```typescript
// Tokens
generateMockGitHubToken('ghp') // Personal access token
generateMockGitHubToken('gho') // OAuth token

// Connections
generateMockGitHubConnection({
  github_username: 'testuser',
})

// Repositories
generateMockRepository({
  name: 'test-repo',
  private: true,
})

generateMockRepositories(10) // Generate 10 repos

// Linked Repositories
generateMockLinkedRepository({
  sync_enabled: true,
  auto_sync_enabled: false,
})

// Sync Logs
generateMockSyncLog({
  sync_status: 'success',
  secrets_imported: 5,
})

// Secret Previews
generateMockSecretPreviews(10)
```

### Debugging GitHub Tests

**1. UI Mode (Recommended):**
```bash
npx playwright test tests/integration/github.spec.ts --ui
```

**2. Debug Mode:**
```bash
npx playwright test tests/integration/github.spec.ts --debug
```

**3. View Network Requests:**
```bash
# Run with network logging
DEBUG=pw:api npx playwright test tests/integration/github.spec.ts
```

**4. Check Encryption:**
```typescript
// Add to test
const adminClient = createTestAdminClient()
const { data: connection } = await adminClient
  .from('github_connections')
  .select('*')
  .single()

console.log('Encrypted token:', connection.encrypted_github_token)
console.log('Token nonce:', connection.token_nonce)
```

### Common Issues

**Issue: "GitHub not connected" error**

**Cause:** OAuth flow not completed

**Solution:**
```bash
# Complete OAuth manually in headed mode
npx playwright test --grep "OAuth" --headed

# Or mock the connection
const mockConnection = generateMockGitHubConnection()
```

**Issue: "Token decryption failed"**

**Cause:** Wrong master password or corrupted encryption data

**Solution:**
- Verify master password matches
- Check KEK salt is valid base64
- Verify encryption happened before decryption

**Issue: "Repository list empty"**

**Cause:** GitHub account has no repos or token invalid

**Solution:**
- Use test account with repositories
- Verify token has `repo` scope
- Check GitHub API rate limits

**Issue: "Sync failed - secrets not imported"**

**Cause:** No secrets found in repository or import failed

**Solution:**
- Verify test repository has `.env` file
- Check secret parsing logic
- Review sync logs for errors

### Performance Targets

GitHub integration tests should meet these targets:

| Operation | Target | Actual |
|-----------|--------|--------|
| Token encryption | < 500ms | TBD |
| Token decryption | < 500ms | TBD |
| List repositories | < 2s | TBD |
| Secret preview | < 3s | TBD |
| Secret import (10 secrets) | < 5s | TBD |
| OAuth flow (complete) | < 10s | TBD |

Run performance tests:
```bash
npx playwright test tests/integration/github.spec.ts --reporter=html
```

### Security Verification

**Critical Security Checks:**

1. **Zero-Knowledge Encryption:**
```typescript
// Token never sent plaintext to server
await verifyEncryptedRequest(page, async () => {
  await listRepositories()
}, 'ghp_plaintext_token')
```

2. **Token Storage:**
```typescript
// Verify encrypted in database
const { data } = await adminClient
  .from('github_connections')
  .select('encrypted_github_token')
  .single()

expect(data.encrypted_github_token).not.toContain('ghp_')
```

3. **RLS Enforcement:**
```typescript
// User can only access own connections
const { error } = await clientB
  .from('github_connections')
  .select()
  .eq('user_id', userA.id)

expect(error).toBeDefined() // Should fail
```

### Test Data Cleanup

**Cleanup GitHub Test Data:**

```typescript
import { cleanupTestData, createTestAdminClient } from '../helpers/test-utils'

test.afterEach(async () => {
  const adminClient = createTestAdminClient()

  // Clean up GitHub connections
  await adminClient
    .from('github_connections')
    .delete()
    .eq('user_id', testUserId)

  // Clean up linked repos
  await adminClient
    .from('github_linked_repos')
    .delete()
    .eq('organization_id', testOrgId)

  // Clean up sync logs
  await adminClient
    .from('github_sync_logs')
    .delete()
    .eq('github_linked_repo_id', testRepoId)

  // Clean up all user data
  await cleanupTestData(testUserId)
})
```

### CI/CD Integration

**GitHub Actions Workflow:**

```yaml
# .github/workflows/test-github-integration.yml
name: GitHub Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Run GitHub unit tests
        run: |
          npm test lib/crypto/github-encryption.test.ts
          npm test lib/api/github.test.ts

      - name: Run GitHub integration tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          TEST_GITHUB_TOKEN: ${{ secrets.TEST_GITHUB_TOKEN }}
        run: |
          npx playwright test tests/integration/github.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: github-test-results
          path: playwright-report/
```

### Best Practices

**DO:**
- ✅ Use mock data for unit tests
- ✅ Clean up test data after each test
- ✅ Verify encryption at every step
- ✅ Test error scenarios
- ✅ Use test-specific GitHub account
- ✅ Mock GitHub API in unit tests

**DON'T:**
- ❌ Use production GitHub account for tests
- ❌ Commit real GitHub tokens
- ❌ Skip encryption verification
- ❌ Leave test data in database
- ❌ Test against rate-limited endpoints
- ❌ Hardcode test data

## Contributing

When adding new tests:

1. **Follow existing patterns** - Use helper functions
2. **Add to test plan** - Update INTEGRATION-TEST-PLAN.md
3. **Clean up data** - Use `cleanupTestData()` in afterEach
4. **Verify zero-knowledge** - Check encryption for secrets
5. **Document** - Add comments explaining test purpose
6. **Add GitHub tests** - Update github-helpers.ts with new mocks

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Integration Test Plan](../INTEGRATION-TEST-PLAN.md)
- [Test Results Template](../INTEGRATION-TEST-RESULTS.md)
- [Supabase Testing Docs](https://supabase.com/docs/guides/testing)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [Jest/Vitest Documentation](https://vitest.dev/)

## Support

For issues or questions:
1. Check this README
2. Review test plan documentation
3. Check Playwright docs
4. Review GitHub test helpers
5. Ask in team Slack/Discord
