# GitHub Integration Test Setup Guide

Complete guide for setting up and running GitHub integration tests.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Configure environment (see below)
cp .env.local.example .env.local
# Edit .env.local with your credentials

# 4. Run tests
npm test                                    # Unit tests
npx playwright test tests/integration/github.spec.ts  # Integration tests
```

## Prerequisites

### Required

- Node.js 18+ and npm/pnpm
- Supabase project (test instance recommended)
- Cloudflare Workers account (for GitHub API proxy)
- Test GitHub account (NOT production account)

### Optional

- GitHub OAuth App (for real OAuth testing)
- Test repository with secrets (for import testing)

## Environment Configuration

### 1. Supabase Configuration

Create or update `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Separate test database
TEST_SUPABASE_URL=https://test-project.supabase.co
TEST_SUPABASE_ANON_KEY=test-anon-key
TEST_SUPABASE_SERVICE_KEY=test-service-key
```

**Get Supabase credentials:**
1. Go to Supabase Dashboard
2. Select your project
3. Settings → API
4. Copy URL, anon key, and service_role key

### 2. GitHub OAuth App Setup (Optional)

**For testing real OAuth flow:**

1. Create GitHub OAuth App:
   - Go to https://github.com/settings/developers
   - Click "New OAuth App"
   - **Application name:** Abyrith Test
   - **Homepage URL:** http://localhost:3000
   - **Authorization callback URL:** http://localhost:3000/auth/callback/github
   - Click "Register application"

2. Add credentials to `.env.local`:
```bash
# GitHub OAuth (optional for real OAuth testing)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

3. Configure Cloudflare Workers:
```bash
cd workers
cp .dev.vars.example .dev.vars

# Add to .dev.vars
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 3. Test GitHub Account

**Create a test GitHub account (recommended):**

1. Create new GitHub account at https://github.com/signup
2. Username: `abyrith-test-user` (or similar)
3. Email: Use a test email address
4. Verify email

**Create test personal access token:**
```bash
# Go to: https://github.com/settings/tokens/new

# Scopes needed:
# - repo (full control of private repositories)
# - read:user (read user profile data)

# Generate token and save
TEST_GITHUB_TOKEN=ghp_your_test_token_here
```

Add to `.env.local`:
```bash
TEST_GITHUB_TOKEN=ghp_your_test_token_here
```

### 4. Test Repository Setup

**Create a test repository with secrets:**

1. Create new repo: `https://github.com/new`
   - Name: `abyrith-test-repo`
   - Description: Test repository for Abyrith integration tests
   - Private or Public (your choice)

2. Add test secrets to `.env` file:
```bash
# Clone repo
git clone https://github.com/your-username/abyrith-test-repo.git
cd abyrith-test-repo

# Create .env file
cat > .env << 'EOF'
# Test API Keys
API_KEY=test_api_key_12345
DATABASE_URL=postgresql://localhost:5432/testdb
SECRET_TOKEN=secret_token_67890

# Test Configuration
APP_ENV=development
DEBUG_MODE=true
MAX_RETRIES=3
EOF

# Commit and push
git add .env
git commit -m "Add test secrets"
git push
```

3. Add GitHub Actions secrets (optional):
   - Go to repo Settings → Secrets and variables → Actions
   - Add secrets:
     - `API_KEY`: test_api_key_12345
     - `DATABASE_URL`: postgresql://localhost:5432/testdb

## Database Setup

### Create GitHub Integration Tables

If not already created, run migrations:

```bash
# Navigate to Supabase project
cd supabase

# Run migration
supabase migration up
```

**Or create tables manually:**

```sql
-- GitHub connections table
CREATE TABLE IF NOT EXISTS github_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_github_token TEXT NOT NULL,
  token_nonce TEXT NOT NULL,
  token_dek TEXT NOT NULL,
  dek_nonce TEXT NOT NULL,
  token_auth_tag TEXT NOT NULL,
  github_user_id BIGINT NOT NULL,
  github_username TEXT NOT NULL,
  github_email TEXT,
  token_scope TEXT[] NOT NULL DEFAULT '{}',
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub linked repositories table
CREATE TABLE IF NOT EXISTS github_linked_repos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  github_repo_id BIGINT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  abyrith_project_uuid UUID NOT NULL,
  sync_enabled BOOLEAN DEFAULT true,
  auto_sync_enabled BOOLEAN DEFAULT false,
  sync_sources JSONB DEFAULT '{"env_files": true, "github_actions": false, "dependencies": false}',
  default_environment_id UUID REFERENCES environments(id),
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub sync logs table
CREATE TABLE IF NOT EXISTS github_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_linked_repo_id UUID NOT NULL REFERENCES github_linked_repos(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('success', 'partial', 'failed')),
  secrets_imported INTEGER DEFAULT 0,
  secrets_skipped INTEGER DEFAULT 0,
  secrets_failed INTEGER DEFAULT 0,
  imported_files TEXT[] DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_linked_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own GitHub connections"
  ON github_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GitHub connections"
  ON github_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GitHub connections"
  ON github_connections FOR DELETE
  USING (auth.uid() = user_id);
```

## Running Tests

### Unit Tests (Encryption & API)

**Test token encryption:**
```bash
npm test lib/crypto/github-encryption.test.ts
```

**Test API service:**
```bash
npm test lib/api/github.test.ts
```

**Run all unit tests:**
```bash
npm test
```

### Integration Tests (End-to-End)

**Prerequisites:**
1. Start Next.js dev server:
```bash
npm run dev
```

2. Start Cloudflare Workers (in separate terminal):
```bash
cd workers
npm run dev
```

**Run all GitHub integration tests:**
```bash
npx playwright test tests/integration/github.spec.ts
```

**Run with UI mode (recommended for debugging):**
```bash
npx playwright test tests/integration/github.spec.ts --ui
```

**Run specific test suite:**
```bash
# OAuth tests only
npx playwright test tests/integration/github.spec.ts --grep "OAuth"

# Repository linking tests
npx playwright test tests/integration/github.spec.ts --grep "Repository Linking"

# Secret import tests
npx playwright test tests/integration/github.spec.ts --grep "Secret Import"
```

**Run in headed mode (see browser):**
```bash
npx playwright test tests/integration/github.spec.ts --headed
```

**Debug mode:**
```bash
npx playwright test tests/integration/github.spec.ts --debug
```

## Test Modes

### 1. Mock Mode (Default)

Uses mock GitHub API responses. No real GitHub account needed.

**Pros:**
- Fast execution
- No rate limits
- Predictable results
- No GitHub account needed

**Cons:**
- Doesn't test real GitHub integration
- May miss API changes

**Usage:**
```bash
npm test  # Unit tests use mocks
```

### 2. Integration Mode

Uses test environment with mocked GitHub OAuth but real database.

**Pros:**
- Tests database interactions
- Tests encryption/decryption
- Verifies RLS policies

**Cons:**
- Requires test database
- Slower than mock mode

**Usage:**
```bash
npx playwright test tests/integration/github.spec.ts
```

### 3. Real GitHub Mode (Optional)

Uses real GitHub account and OAuth flow.

**Pros:**
- Tests complete real-world flow
- Catches GitHub API changes
- Tests actual OAuth

**Cons:**
- Requires GitHub account
- Subject to rate limits
- Slower execution
- Requires OAuth app setup

**Usage:**
```bash
# Set environment variables
export TEST_GITHUB_TOKEN=ghp_your_token
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret

# Run tests in headed mode
npx playwright test tests/integration/github.spec.ts --headed
```

## Troubleshooting

### Issue: Tests fail with "Supabase connection error"

**Cause:** Invalid Supabase credentials or database not accessible

**Solution:**
1. Verify `.env.local` has correct credentials
2. Test connection:
```bash
curl "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
```
3. Check Supabase project is running
4. Verify network connectivity

### Issue: "GitHub OAuth failed" error

**Cause:** Invalid OAuth credentials or callback URL mismatch

**Solution:**
1. Verify GitHub OAuth app credentials in `.env.local`
2. Check callback URL matches: `http://localhost:3000/auth/callback/github`
3. Ensure Cloudflare Workers are running
4. Check Workers have GitHub credentials in `.dev.vars`

### Issue: "Token decryption failed"

**Cause:** Master password mismatch or corrupted encryption data

**Solution:**
1. Verify test uses same master password for encrypt/decrypt
2. Check KEK salt is valid base64
3. Clear test database and retry:
```bash
# In Supabase SQL editor
DELETE FROM github_connections;
DELETE FROM github_linked_repos;
DELETE FROM github_sync_logs;
```

### Issue: "Repository list empty"

**Cause:** Test GitHub account has no repositories

**Solution:**
1. Create test repository (see setup above)
2. Or use real GitHub account with repositories
3. Verify token has `repo` scope

### Issue: "Rate limit exceeded"

**Cause:** Too many GitHub API requests

**Solution:**
1. Use mock mode for development
2. Wait 1 hour for rate limit reset
3. Use GitHub OAuth token (higher rate limit)
4. Implement request throttling in tests

### Issue: Playwright browser not found

**Cause:** Playwright browsers not installed

**Solution:**
```bash
npx playwright install chromium
```

## Performance Benchmarks

Run performance tests:
```bash
npx playwright test tests/integration/github.spec.ts --reporter=html
```

**Expected timings:**
- Token encryption: < 500ms
- Token decryption: < 500ms
- List repositories: < 2s
- Secret preview: < 3s
- Secret import (10 secrets): < 5s
- Complete OAuth flow: < 10s

## Test Data Cleanup

Tests should automatically clean up, but manual cleanup:

```sql
-- Clean up test user's GitHub data
DELETE FROM github_sync_logs
WHERE github_linked_repo_id IN (
  SELECT id FROM github_linked_repos
  WHERE organization_id = 'test-org-id'
);

DELETE FROM github_linked_repos
WHERE organization_id = 'test-org-id';

DELETE FROM github_connections
WHERE user_id = 'test-user-id';
```

**Or use test utility:**
```typescript
import { cleanupAllGitHubData } from '../helpers/test-utils'

await cleanupAllGitHubData(userId, organizationId)
```

## CI/CD Setup

Add to `.github/workflows/test.yml`:

```yaml
- name: Run GitHub integration tests
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
    TEST_GITHUB_TOKEN: ${{ secrets.TEST_GITHUB_TOKEN }}
  run: |
    npm test
    npx playwright test tests/integration/github.spec.ts
```

## Security Considerations

**DO:**
- ✅ Use separate test database
- ✅ Use test GitHub account (not production)
- ✅ Rotate test tokens regularly
- ✅ Never commit real tokens to repo
- ✅ Clean up test data after tests
- ✅ Verify encryption in tests

**DON'T:**
- ❌ Use production database for tests
- ❌ Use personal GitHub account
- ❌ Commit `.env.local` to repo
- ❌ Leave test tokens in CI logs
- ❌ Skip encryption verification
- ❌ Test with real user data

## Next Steps

1. **Run unit tests:** `npm test`
2. **Run integration tests:** `npx playwright test tests/integration/github.spec.ts --ui`
3. **Review test coverage:** Check test output
4. **Add more tests:** Extend test suites as needed
5. **Setup CI/CD:** Add tests to GitHub Actions

## Support

**Issues or questions?**
1. Check this setup guide
2. Review test README: `tests/README.md`
3. Check test examples in `tests/integration/github.spec.ts`
4. Review helper utilities in `tests/helpers/github-helpers.ts`
5. Ask in team communication channel

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
- [GitHub OAuth Documentation](https://docs.github.com/en/apps/oauth-apps)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
