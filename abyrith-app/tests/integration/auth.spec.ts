import { test, expect } from '@playwright/test'

/**
 * Authentication Flow Integration Tests
 *
 * Tests user registration, login, and master password setup.
 * Corresponds to Test Suite 1 in INTEGRATION-TEST-PLAN.md
 */

test.describe('Authentication Flow', () => {
  const TEST_EMAIL = `test-${Date.now()}@example.com`
  const TEST_PASSWORD = 'SecureTestPassword123!'
  const TEST_MASTER_PASSWORD = 'MasterSecret123!'

  test('Test 1.1: User can sign up successfully', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/auth/signup')

    // Wait for page to load
    await expect(page).toHaveURL(/\/auth\/signup/)

    // Fill signup form
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for redirect (may be dashboard or email confirmation)
    // Adjust timeout based on email confirmation flow
    await page.waitForURL(/\/(dashboard|auth\/confirm)/, { timeout: 10000 })

    // If redirected to dashboard, verify we're logged in
    if (page.url().includes('/dashboard')) {
      await expect(page.locator('h1, [data-testid="dashboard-title"]')).toBeVisible()
    }
  })

  test('Test 1.2: User can login with correct credentials', async ({ page }) => {
    // First, sign up (or use existing test user)
    await page.goto('/auth/signup')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait a moment for account creation
    await page.waitForTimeout(1000)

    // Logout if logged in
    if (page.url().includes('/dashboard')) {
      const logoutButton = page.locator('button:has-text("Logout"), [data-testid="logout-button"]')
      if (await logoutButton.isVisible()) {
        await logoutButton.click()
      }
    }

    // Navigate to login
    await page.goto('/auth/login')

    // Fill login form
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)

    // Submit
    await page.click('button[type="submit"]')

    // Verify redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/dashboard/)

    // Verify session persists on refresh
    await page.reload()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Test 1.3: Master password setup creates KEK', async ({ page }) => {
    // Login first
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/dashboard/, { timeout: 10000 })

    // Look for master password setup prompt
    const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i')

    if (await masterPasswordPrompt.isVisible({ timeout: 5000 })) {
      // Fill master password
      const passwordInput = page.locator('input[type="password"]').first()
      await passwordInput.fill(TEST_MASTER_PASSWORD)

      // Confirm password (if there's a second input)
      const confirmInput = page.locator('input[type="password"]').nth(1)
      if (await confirmInput.isVisible({ timeout: 1000 })) {
        await confirmInput.fill(TEST_MASTER_PASSWORD)
      }

      // Submit
      await page.click('button[type="submit"]')

      // Wait for vault to unlock
      await page.waitForTimeout(2000)

      // Verify vault is unlocked (check for secrets page or unlocked indicator)
      const vaultUnlockedIndicator = page.locator('text=/unlocked|vault ready/i')
      await expect(vaultUnlockedIndicator).toBeVisible({ timeout: 5000 })
    }
  })

  test('Test 1.4: Login fails with incorrect password', async ({ page }) => {
    await page.goto('/auth/login')

    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', 'WrongPassword123!')

    await page.click('button[type="submit"]')

    // Verify error message appears
    const errorMessage = page.locator('text=/invalid|incorrect|wrong/i')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })

    // Verify we're still on login page
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('Test 1.5: Session persists across page reloads', async ({ page }) => {
    // Login
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/dashboard/, { timeout: 10000 })

    // Get current URL
    const dashboardUrl = page.url()

    // Reload page
    await page.reload()

    // Verify still on dashboard
    await expect(page).toHaveURL(dashboardUrl)

    // Verify not redirected to login
    await expect(page).not.toHaveURL(/\/auth\/login/)
  })
})
