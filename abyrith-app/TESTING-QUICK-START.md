# Testing Quick Start Guide

**Goal:** Get integration tests running in < 5 minutes

## Prerequisites

- Node.js 18+ installed
- npm or pnpm installed
- Supabase project created
- Anthropic API key (for AI tests)

## Step 1: Install Dependencies (2 min)

```bash
cd abyrith-app

# Install npm dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

## Step 2: Configure Environment (2 min)

```bash
# Copy example environment file
cp .env.local.example .env.local

# Edit .env.local and fill in these required values:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For AI tests (optional):
# ANTHROPIC_API_KEY=sk-ant-your-key

# For FireCrawl tests (optional):
# FIRECRAWL_API_KEY=fc-your-key
```

Get Supabase credentials from: https://app.supabase.com/project/YOUR_PROJECT/settings/api

## Step 3: Start Services (1 min)

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start Cloudflare Workers (in another terminal)
cd workers
npm install
npm run dev
```

Verify services:
- Next.js: http://localhost:3000
- Workers: http://localhost:8787

## Step 4: Run Tests (< 1 min)

```bash
# Run all tests (recommended for first run)
npm run test:integration

# OR run with UI mode (easier to see what's happening)
npm run test:integration:ui
```

## Expected Results

**First run:**
- 3 test suites (auth, secrets, ai-assistant)
- ~15-20 tests total
- Takes ~2-3 minutes
- All tests should PASS

**If tests fail:**
1. Check environment variables are set
2. Verify Supabase is accessible
3. Check both services are running (3000, 8787)
4. Review test output for specific errors

## Test Modes

### UI Mode (Recommended for Development)
```bash
npm run test:integration:ui
```
- Visual test runner
- Step through tests
- Inspect DOM/Network
- See failures in real-time

### Headed Mode (See Browser)
```bash
npm run test:integration:headed
```
- Watch tests execute in real browser
- Good for understanding flow
- See UI interactions

### Debug Mode (Fix Issues)
```bash
npm run test:integration:debug
```
- Pauses at each step
- DevTools open
- Manual inspection
- Set breakpoints

### View Report (After Running)
```bash
npm run test:report
```
- HTML report with screenshots
- Video recordings of failures
- Full test results

## Manual Testing

For comprehensive manual testing:

1. Open **INTEGRATION-TEST-PLAN.md**
2. Follow test suites 1-7
3. Record results in **INTEGRATION-TEST-RESULTS.md**
4. Takes ~90 minutes total

## Common Issues

### "Failed to fetch" error
**Fix:** Start both services (Next.js on 3000, Workers on 8787)

### "Missing environment variables"
**Fix:** Check `.env.local` has all required values

### Tests timeout
**Fix:** Increase timeout in `playwright.config.ts` (default: 60s)

### Database errors
**Fix:** Verify Supabase connection, run migrations

### AI tests fail
**Fix:** Add valid `ANTHROPIC_API_KEY` to `.env.local`

## Next Steps

After tests pass:
1. ✅ You're ready to develop!
2. Run tests after each feature
3. Add new tests for new features
4. Update test plan documentation

## Documentation

- **Complete Test Plan:** `INTEGRATION-TEST-PLAN.md`
- **Test Results Template:** `INTEGRATION-TEST-RESULTS.md`
- **Test Infrastructure:** `tests/README.md`
- **Helper Functions:** `tests/helpers/test-utils.ts`

## Support

Need help?
1. Check `tests/README.md` for detailed docs
2. Review `INTEGRATION-TEST-PLAN.md` for test details
3. Ask in team Slack/Discord
4. Create issue on GitHub

---

**Total Time:** < 5 minutes
**Difficulty:** Easy
**Prerequisites:** Supabase project + API keys
