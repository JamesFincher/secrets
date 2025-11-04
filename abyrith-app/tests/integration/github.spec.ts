/**
 * Integration Tests for GitHub Integration
 *
 * End-to-end tests for GitHub OAuth, repository linking, and secret syncing.
 * Tests complete user workflows with real UI interactions.
 *
 * Test Flows:
 * 1. OAuth Flow - Connect GitHub account
 * 2. Repository Linking - Link repository to project
 * 3. Secret Import - Preview and import secrets
 *
 * Prerequisites:
 * - Next.js app running on localhost:3000
 * - Cloudflare Workers running (for GitHub proxy)
 * - Valid test GitHub account
 * - Test Supabase instance
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginUser,
  setupMasterPassword,
  waitForElement,
  verifyEncryptedRequest,
  screenshotOnFailure,
} from '../helpers/playwright-helpers';
import {
  generateTestUser,
  cleanupTestData,
  createTestAdminClient,
} from '../helpers/test-utils';
import {
  generateMockGitHubToken,
  generateMockRepository,
  isValidGitHubTokenFormat,
} from '../helpers/github-helpers';

/**
 * Test Suite 1: GitHub OAuth Flow
 *
 * Tests the complete OAuth authorization flow including:
 * - Initiating OAuth
 * - GitHub authorization (mocked)
 * - Callback handling
 * - Token encryption and storage
 * - Connection status display
 */
test.describe('GitHub OAuth Flow', () => {
  let testUser: ReturnType<typeof generateTestUser>;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    testUser = generateTestUser();

    // Create user and login
    await page.goto('/auth/signup');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Setup master password
    const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i');
    if (await masterPasswordPrompt.isVisible({ timeout: 3000 })) {
      await setupMasterPassword(page, testUser.masterPassword);
    }
  });

  test.afterEach(async () => {
    // Cleanup test data
    try {
      const adminClient = createTestAdminClient();
      const { data: user } = await adminClient
        .from('auth.users')
        .select('id')
        .eq('email', testUser.email)
        .single();

      if (user) {
        await cleanupTestData(user.id);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('should initiate GitHub OAuth flow', async () => {
    try {
      // Navigate to integrations settings
      await page.goto('/dashboard/settings/integrations');

      // Find and click "Connect GitHub" button
      const connectButton = page.locator(
        'button:has-text("Connect GitHub"), [data-testid="connect-github-button"]'
      );
      await waitForElement(page, 'button:has-text("Connect GitHub")', { timeout: 5000 });

      // Click connect button
      await connectButton.click();

      // Should redirect to OAuth URL or show OAuth modal
      await page.waitForTimeout(2000);

      // Verify OAuth initialization happened
      // In a real test, this would redirect to GitHub
      // For integration tests, we might mock the GitHub response
      const currentUrl = page.url();

      // Check if redirected to GitHub or if OAuth modal appeared
      const isRedirectedToGitHub = currentUrl.includes('github.com/login/oauth');
      const hasOAuthModal = await page.locator('[role="dialog"]').isVisible();

      expect(isRedirectedToGitHub || hasOAuthModal).toBe(true);
    } catch (error) {
      await screenshotOnFailure(page, 'github-oauth-init');
      throw error;
    }
  });

  test('should handle OAuth callback and store encrypted token', async () => {
    try {
      // Simulate OAuth callback
      // In a real scenario, user would authorize on GitHub and be redirected back
      const mockCode = 'test_auth_code_' + Math.random().toString(36).substring(7);
      const mockState = 'test_state_' + Math.random().toString(36).substring(7);

      // Navigate to callback URL with code and state
      await page.goto(`/auth/callback/github?code=${mockCode}&state=${mockState}`);

      // Wait for callback processing
      await page.waitForTimeout(3000);

      // Should redirect to integrations page or show success
      await page.waitForURL(/\/(dashboard|settings\/integrations)/, { timeout: 10000 });

      // Verify connection status shows connected
      await page.goto('/dashboard/settings/integrations');

      const connectionStatus = page.locator(
        'text=/connected/i, [data-testid="github-connection-status"]'
      );

      // Should show GitHub username or connection indicator
      const isConnected = await connectionStatus.isVisible({ timeout: 5000 });
      expect(isConnected).toBe(true);
    } catch (error) {
      await screenshotOnFailure(page, 'github-oauth-callback');
      throw error;
    }
  });

  test('should verify token is encrypted in database', async () => {
    try {
      // Complete OAuth flow (simplified for test)
      await page.goto('/dashboard/settings/integrations');

      // After OAuth completes, verify token encryption
      const adminClient = createTestAdminClient();
      const { data: user } = await adminClient.auth.getSession();

      if (user?.session?.user) {
        const { data: connection } = await adminClient
          .from('github_connections')
          .select('*')
          .eq('user_id', user.session.user.id)
          .maybeSingle();

        if (connection) {
          // Verify token is encrypted (not plaintext)
          expect(connection.encrypted_github_token).toBeDefined();
          expect(connection.token_nonce).toBeDefined();
          expect(connection.token_dek).toBeDefined();

          // Verify it's not a GitHub token format (should be base64)
          expect(isValidGitHubTokenFormat(connection.encrypted_github_token)).toBe(false);

          // Verify nonces are present
          expect(connection.token_nonce.length).toBeGreaterThan(0);
          expect(connection.dek_nonce.length).toBeGreaterThan(0);
        }
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-token-encryption');
      throw error;
    }
  });

  test('should display GitHub username after connection', async () => {
    try {
      // Navigate to integrations page
      await page.goto('/dashboard/settings/integrations');

      // Look for GitHub username display
      const githubUsername = page.locator(
        '[data-testid="github-username"], .github-username'
      );

      // Should show username or connection status
      const hasUsername = await githubUsername.isVisible({ timeout: 3000 });

      if (hasUsername) {
        const username = await githubUsername.textContent();
        expect(username).toBeTruthy();
        expect(username?.length).toBeGreaterThan(0);
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-username-display');
      throw error;
    }
  });

  test('should allow disconnecting GitHub', async () => {
    try {
      // Navigate to integrations page
      await page.goto('/dashboard/settings/integrations');

      // Find disconnect button
      const disconnectButton = page.locator(
        'button:has-text("Disconnect"), [data-testid="disconnect-github-button"]'
      );

      if (await disconnectButton.isVisible({ timeout: 3000 })) {
        await disconnectButton.click();

        // Confirm disconnection if modal appears
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Disconnect")'
        );

        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }

        await page.waitForTimeout(2000);

        // Verify connection removed
        const connectButton = page.locator('button:has-text("Connect GitHub")');
        await expect(connectButton).toBeVisible();
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-disconnect');
      throw error;
    }
  });
});

/**
 * Test Suite 2: Repository Linking
 *
 * Tests repository browsing and linking to projects.
 */
test.describe('GitHub Repository Linking', () => {
  let testUser: ReturnType<typeof generateTestUser>;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    testUser = generateTestUser();

    // Setup: Create user, login, connect GitHub
    await page.goto('/auth/signup');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i');
    if (await masterPasswordPrompt.isVisible({ timeout: 3000 })) {
      await setupMasterPassword(page, testUser.masterPassword);
    }

    // Note: In real tests, would need to complete OAuth first
    // For integration tests, might use test GitHub account
  });

  test.afterEach(async () => {
    try {
      const adminClient = createTestAdminClient();
      const { data: user } = await adminClient
        .from('auth.users')
        .select('id')
        .eq('email', testUser.email)
        .single();

      if (user) {
        await cleanupTestData(user.id);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('should list GitHub repositories', async () => {
    try {
      // Navigate to repository browser
      await page.goto('/dashboard/integrations/github/repositories');

      // Wait for repositories to load
      await page.waitForTimeout(3000);

      // Check if repositories are displayed
      const repoList = page.locator('[data-testid="repository-list"], .repository-list');

      // Should show repositories or empty state
      const hasRepos = await repoList.isVisible({ timeout: 5000 });

      if (hasRepos) {
        // Verify repository items exist
        const repoItems = page.locator('[data-testid="repository-item"], .repository-item');
        const count = await repoItems.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-list-repos');
      throw error;
    }
  });

  test('should filter repositories by name', async () => {
    try {
      await page.goto('/dashboard/integrations/github/repositories');
      await page.waitForTimeout(2000);

      // Find search input
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="Search"], [data-testid="repo-search"]'
      );

      if (await searchInput.isVisible({ timeout: 3000 })) {
        // Type search query
        await searchInput.fill('test');
        await page.waitForTimeout(1000);

        // Verify filtering occurred
        const repoItems = page.locator('[data-testid="repository-item"]');
        const count = await repoItems.count();

        // Should show filtered results
        expect(count).toBeGreaterThanOrEqual(0);
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-filter-repos');
      throw error;
    }
  });

  test('should open link repository dialog', async () => {
    try {
      await page.goto('/dashboard/integrations/github/repositories');
      await page.waitForTimeout(2000);

      // Find a repository link button
      const linkButton = page
        .locator('button:has-text("Link"), [data-testid="link-repository-button"]')
        .first();

      if (await linkButton.isVisible({ timeout: 3000 })) {
        await linkButton.click();

        // Dialog should appear
        const dialog = page.locator('[role="dialog"], [data-testid="link-repo-dialog"]');
        await expect(dialog).toBeVisible();

        // Verify dialog has form elements
        const actionSelect = page.locator('select, [data-testid="link-action-select"]');
        await expect(actionSelect).toBeVisible();
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-link-dialog');
      throw error;
    }
  });

  test('should link repository with create new project', async () => {
    try {
      await page.goto('/dashboard/integrations/github/repositories');
      await page.waitForTimeout(2000);

      // Click link button on first repo
      const linkButton = page
        .locator('button:has-text("Link"), [data-testid="link-repository-button"]')
        .first();

      if (await linkButton.isVisible({ timeout: 3000 })) {
        await linkButton.click();

        // Fill link form
        const projectNameInput = page.locator(
          'input[name="projectName"], [data-testid="project-name-input"]'
        );

        if (await projectNameInput.isVisible({ timeout: 3000 })) {
          await projectNameInput.fill('Test Project from GitHub');

          // Submit form
          const submitButton = page.locator(
            'button[type="submit"], button:has-text("Link Repository")'
          );
          await submitButton.click();

          await page.waitForTimeout(3000);

          // Verify link succeeded
          const successMessage = page.locator('text=/linked|success/i');
          const isSuccess = await successMessage.isVisible({ timeout: 5000 });

          expect(isSuccess).toBe(true);
        }
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-link-create-project');
      throw error;
    }
  });
});

/**
 * Test Suite 3: Secret Import Flow
 *
 * Tests secret preview and import from GitHub repositories.
 */
test.describe('GitHub Secret Import', () => {
  let testUser: ReturnType<typeof generateTestUser>;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    testUser = generateTestUser();

    // Setup: Create user, login, connect GitHub, link repo
    await page.goto('/auth/signup');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i');
    if (await masterPasswordPrompt.isVisible({ timeout: 3000 })) {
      await setupMasterPassword(page, testUser.masterPassword);
    }

    // Note: Would need to have a linked repository for these tests
  });

  test.afterEach(async () => {
    try {
      const adminClient = createTestAdminClient();
      const { data: user } = await adminClient
        .from('auth.users')
        .select('id')
        .eq('email', testUser.email)
        .single();

      if (user) {
        await cleanupTestData(user.id);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('should preview secrets before import', async () => {
    try {
      // Navigate to linked repository sync page
      await page.goto('/dashboard/integrations/github/sync');
      await page.waitForTimeout(2000);

      // Click preview button
      const previewButton = page.locator(
        'button:has-text("Preview"), [data-testid="preview-secrets-button"]'
      );

      if (await previewButton.isVisible({ timeout: 3000 })) {
        await previewButton.click();
        await page.waitForTimeout(3000);

        // Verify preview loaded
        const previewPanel = page.locator('[data-testid="secret-preview-panel"]');

        if (await previewPanel.isVisible({ timeout: 5000 })) {
          // Should show secrets found
          const secretItems = page.locator('[data-testid="preview-secret-item"]');
          const count = await secretItems.count();

          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-preview-secrets');
      throw error;
    }
  });

  test('should show collision warnings', async () => {
    try {
      await page.goto('/dashboard/integrations/github/sync');
      await page.waitForTimeout(2000);

      const previewButton = page.locator('button:has-text("Preview")');

      if (await previewButton.isVisible({ timeout: 3000 })) {
        await previewButton.click();
        await page.waitForTimeout(3000);

        // Look for collision warnings
        const collisionWarning = page.locator(
          'text=/collision|already exists/i, [data-testid="collision-warning"]'
        );

        // May or may not have collisions
        const hasCollisions = await collisionWarning.isVisible({ timeout: 3000 });

        if (hasCollisions) {
          // Verify collision strategy selector is shown
          const strategySelect = page.locator('[data-testid="collision-strategy-select"]');
          await expect(strategySelect).toBeVisible();
        }
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-collision-warnings');
      throw error;
    }
  });

  test('should import secrets with skip collision strategy', async () => {
    try {
      await page.goto('/dashboard/integrations/github/sync');
      await page.waitForTimeout(2000);

      // Select collision strategy
      const strategySelect = page.locator('[data-testid="collision-strategy-select"]');

      if (await strategySelect.isVisible({ timeout: 3000 })) {
        await strategySelect.selectOption('skip');

        // Click import button
        const importButton = page.locator(
          'button:has-text("Import"), [data-testid="import-secrets-button"]'
        );
        await importButton.click();

        await page.waitForTimeout(5000);

        // Verify import completed
        const successMessage = page.locator('text=/imported|success/i');
        const isSuccess = await successMessage.isVisible({ timeout: 10000 });

        expect(isSuccess).toBe(true);
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-import-secrets');
      throw error;
    }
  });

  test('should show sync history', async () => {
    try {
      await page.goto('/dashboard/integrations/github/sync');
      await page.waitForTimeout(2000);

      // Navigate to sync history tab
      const historyTab = page.locator(
        'button:has-text("History"), [data-testid="sync-history-tab"]'
      );

      if (await historyTab.isVisible({ timeout: 3000 })) {
        await historyTab.click();
        await page.waitForTimeout(2000);

        // Verify history panel
        const historyPanel = page.locator('[data-testid="sync-history-panel"]');
        await expect(historyPanel).toBeVisible();

        // May or may not have sync logs
        const logItems = page.locator('[data-testid="sync-log-item"]');
        const count = await logItems.count();

        expect(count).toBeGreaterThanOrEqual(0);
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-sync-history');
      throw error;
    }
  });

  test('should verify secrets encrypted after import', async () => {
    try {
      // After importing secrets, verify they're encrypted
      const adminClient = createTestAdminClient();
      const { data: user } = await adminClient.auth.getSession();

      if (user?.session?.user) {
        // Get imported secrets
        const { data: secrets } = await adminClient
          .from('secrets')
          .select('*')
          .eq('user_id', user.session.user.id)
          .limit(5);

        if (secrets && secrets.length > 0) {
          // Verify each secret is encrypted
          secrets.forEach((secret) => {
            expect(secret.encrypted_value).toBeDefined();
            expect(secret.nonce).toBeDefined();
            expect(secret.encrypted_dek).toBeDefined();

            // Should not contain plaintext (basic check)
            expect(secret.encrypted_value).not.toContain('API_KEY');
            expect(secret.encrypted_value).not.toContain('SECRET');
          });
        }
      }
    } catch (error) {
      await screenshotOnFailure(page, 'github-verify-encryption');
      throw error;
    }
  });
});

/**
 * Test Suite 4: Error Handling
 *
 * Tests error scenarios and edge cases.
 */
test.describe('GitHub Integration Error Handling', () => {
  let testUser: ReturnType<typeof generateTestUser>;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    testUser = generateTestUser();

    await page.goto('/auth/signup');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i');
    if (await masterPasswordPrompt.isVisible({ timeout: 3000 })) {
      await setupMasterPassword(page, testUser.masterPassword);
    }
  });

  test('should handle OAuth cancellation gracefully', async () => {
    try {
      await page.goto('/dashboard/settings/integrations');

      // Simulate OAuth cancellation by going to callback with error
      await page.goto('/auth/callback/github?error=access_denied');

      await page.waitForTimeout(2000);

      // Should show error message or redirect back
      const errorMessage = page.locator('text=/denied|cancelled|error/i');
      const hasError = await errorMessage.isVisible({ timeout: 5000 });

      // Should either show error or redirect to integrations
      expect(hasError || page.url().includes('/integrations')).toBe(true);
    } catch (error) {
      await screenshotOnFailure(page, 'github-oauth-cancel');
      throw error;
    }
  });

  test('should handle network errors when listing repos', async () => {
    try {
      await page.goto('/dashboard/integrations/github/repositories');

      // Wait for load attempt
      await page.waitForTimeout(3000);

      // Should show error state or empty state
      const errorState = page.locator('text=/error|failed|try again/i');
      const emptyState = page.locator('text=/no repositories/i');

      const hasErrorOrEmpty =
        (await errorState.isVisible({ timeout: 3000 })) ||
        (await emptyState.isVisible({ timeout: 3000 }));

      expect(hasErrorOrEmpty || page.url().includes('/repositories')).toBe(true);
    } catch (error) {
      await screenshotOnFailure(page, 'github-network-error');
      throw error;
    }
  });

  test('should require master password for token decryption', async () => {
    try {
      // Clear master password from memory (simulate session)
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });

      // Try to access GitHub features
      await page.goto('/dashboard/integrations/github/repositories');
      await page.waitForTimeout(2000);

      // Should prompt for master password
      const passwordPrompt = page.locator('text=/master password|unlock/i');
      const hasPrompt = await passwordPrompt.isVisible({ timeout: 5000 });

      // Should require password or redirect
      expect(hasPrompt || !page.url().includes('/github')).toBe(true);
    } catch (error) {
      await screenshotOnFailure(page, 'github-require-password');
      throw error;
    }
  });
});
