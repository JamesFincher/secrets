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

## Contributing

When adding new tests:

1. **Follow existing patterns** - Use helper functions
2. **Add to test plan** - Update INTEGRATION-TEST-PLAN.md
3. **Clean up data** - Use `cleanupTestData()` in afterEach
4. **Verify zero-knowledge** - Check encryption for secrets
5. **Document** - Add comments explaining test purpose

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Integration Test Plan](../INTEGRATION-TEST-PLAN.md)
- [Test Results Template](../INTEGRATION-TEST-RESULTS.md)
- [Supabase Testing Docs](https://supabase.com/docs/guides/testing)

## Support

For issues or questions:
1. Check this README
2. Review test plan documentation
3. Check Playwright docs
4. Ask in team Slack/Discord
