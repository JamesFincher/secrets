import { test, expect } from '@playwright/test'

/**
 * Secret CRUD Operations Integration Tests
 *
 * Tests create, read, update, delete operations for secrets.
 * Corresponds to Test Suite 2 in INTEGRATION-TEST-PLAN.md
 *
 * CRITICAL: Verifies zero-knowledge encryption
 */

test.describe('Secret CRUD Operations', () => {
  const TEST_EMAIL = `test-secrets-${Date.now()}@example.com`
  const TEST_PASSWORD = 'SecureTestPassword123!'
  const TEST_MASTER_PASSWORD = 'MasterSecret123!'

  const TEST_SECRET = {
    name: 'STRIPE_API_KEY',
    value: 'sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxx',
    description: 'Test Stripe API key for development',
  }

  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    // Create account and login
    await page.goto('/auth/signup')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/dashboard/, { timeout: 10000 })

    // Setup master password if prompted
    const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i')
    if (await masterPasswordPrompt.isVisible({ timeout: 3000 })) {
      await page.fill('input[type="password"]', TEST_MASTER_PASSWORD)
      const confirmInput = page.locator('input[type="password"]').nth(1)
      if (await confirmInput.isVisible({ timeout: 1000 })) {
        await confirmInput.fill(TEST_MASTER_PASSWORD)
      }
      await page.click('button[type="submit"]')
      await page.waitForTimeout(2000)
    }
  })

  test('Test 2.1: Create secret encrypts client-side', async ({ page, context }) => {
    // Enable network monitoring to verify encryption
    const requests: any[] = []
    page.on('request', (request) => {
      if (request.url().includes('secrets')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData(),
        })
      }
    })

    // Navigate to secrets page
    await page.goto('/dashboard/secrets')

    // Click "New Secret" button
    await page.click('button:has-text("New Secret"), [data-testid="new-secret-button"]')

    // Wait for form to appear
    await page.waitForSelector('input[name="name"], [data-testid="secret-name-input"]', {
      timeout: 5000,
    })

    // Fill form
    await page.fill('input[name="name"], [data-testid="secret-name-input"]', TEST_SECRET.name)
    await page.fill('input[name="value"], [data-testid="secret-value-input"]', TEST_SECRET.value)
    await page.fill(
      'textarea[name="description"], [data-testid="secret-description-input"]',
      TEST_SECRET.description
    )

    // Submit
    await page.click('button[type="submit"], [data-testid="save-secret-button"]')

    // Wait for success message or redirect
    await page.waitForTimeout(2000)

    // Verify secret appears in list
    await expect(page.locator(`text=${TEST_SECRET.name}`)).toBeVisible()

    // CRITICAL: Verify plaintext value was NOT sent to server
    const createRequest = requests.find((r) => r.method === 'POST' && r.url.includes('secrets'))
    if (createRequest && createRequest.postData) {
      expect(createRequest.postData).not.toContain(TEST_SECRET.value)
      expect(createRequest.postData).toContain('encrypted_value')
    }
  })

  test('Test 2.2: Read secret decrypts client-side', async ({ page }) => {
    // First create a secret
    await page.goto('/dashboard/secrets')
    await page.click('button:has-text("New Secret"), [data-testid="new-secret-button"]')
    await page.fill('input[name="name"]', TEST_SECRET.name)
    await page.fill('input[name="value"]', TEST_SECRET.value)
    await page.fill('textarea[name="description"]', TEST_SECRET.description)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // Click on the secret to view details
    await page.click(`text=${TEST_SECRET.name}`)

    // Wait for detail view
    await page.waitForTimeout(1000)

    // Secret value should be masked initially
    const maskedValue = page.locator('text=/•••|\\*\\*\\*/') // Masked characters
    await expect(maskedValue).toBeVisible({ timeout: 5000 })

    // Click "Show" or eye icon to reveal
    const showButton = page.locator('button:has-text("Show"), [data-testid="show-secret-button"], [aria-label="Show secret"]')
    if (await showButton.isVisible({ timeout: 3000 })) {
      await showButton.click()
      await page.waitForTimeout(500)
    }

    // Verify plaintext value is displayed
    await expect(page.locator(`text=${TEST_SECRET.value}`)).toBeVisible({ timeout: 5000 })
  })

  test('Test 2.3: Update secret creates new version', async ({ page }) => {
    // Create initial secret
    await page.goto('/dashboard/secrets')
    await page.click('button:has-text("New Secret")')
    await page.fill('input[name="name"]', TEST_SECRET.name)
    await page.fill('input[name="value"]', TEST_SECRET.value)
    await page.fill('textarea[name="description"]', TEST_SECRET.description)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // Click on secret to view
    await page.click(`text=${TEST_SECRET.name}`)
    await page.waitForTimeout(1000)

    // Click "Edit" button
    const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-secret-button"]')
    await editButton.click()

    // Wait for edit form
    await page.waitForTimeout(500)

    // Update value
    const newValue = 'sk_test_51Hyyyyyyyyyyyyyyyyyyyyyy'
    await page.fill('input[name="value"]', newValue)

    // Update description
    await page.fill('textarea[name="description"]', 'Updated test key')

    // Save
    await page.click('button[type="submit"], [data-testid="save-secret-button"]')
    await page.waitForTimeout(2000)

    // Verify new value displays
    const showButton = page.locator('button:has-text("Show")')
    if (await showButton.isVisible({ timeout: 3000 })) {
      await showButton.click()
      await page.waitForTimeout(500)
    }

    await expect(page.locator(`text=${newValue}`)).toBeVisible({ timeout: 5000 })
  })

  test('Test 2.4: Delete secret removes from list', async ({ page }) => {
    // Create secret
    await page.goto('/dashboard/secrets')
    await page.click('button:has-text("New Secret")')
    await page.fill('input[name="name"]', 'DELETE_ME_SECRET')
    await page.fill('input[name="value"]', 'temporary_value_123')
    await page.fill('textarea[name="description"]', 'This will be deleted')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // Verify secret exists
    await expect(page.locator('text=DELETE_ME_SECRET')).toBeVisible()

    // Click on secret
    await page.click('text=DELETE_ME_SECRET')
    await page.waitForTimeout(1000)

    // Click delete button
    const deleteButton = page.locator('button:has-text("Delete"), [data-testid="delete-secret-button"]')
    await deleteButton.click()

    // Confirm deletion in modal
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")')
    if (await confirmButton.isVisible({ timeout: 3000 })) {
      await confirmButton.click()
    }

    await page.waitForTimeout(2000)

    // Verify secret no longer in list
    await expect(page.locator('text=DELETE_ME_SECRET')).not.toBeVisible({ timeout: 5000 })
  })

  test('Test 2.5: Empty state shows when no secrets', async ({ page }) => {
    // Navigate to secrets page (fresh account)
    await page.goto('/dashboard/secrets')

    // Should show empty state
    const emptyState = page.locator('text=/no secrets|get started|create your first/i')
    await expect(emptyState).toBeVisible({ timeout: 5000 })
  })

  test('Test 2.6: Secret list shows all user secrets', async ({ page }) => {
    // Create multiple secrets
    const secrets = [
      { name: 'SECRET_1', value: 'value_1', description: 'First secret' },
      { name: 'SECRET_2', value: 'value_2', description: 'Second secret' },
      { name: 'SECRET_3', value: 'value_3', description: 'Third secret' },
    ]

    await page.goto('/dashboard/secrets')

    for (const secret of secrets) {
      await page.click('button:has-text("New Secret")')
      await page.fill('input[name="name"]', secret.name)
      await page.fill('input[name="value"]', secret.value)
      await page.fill('textarea[name="description"]', secret.description)
      await page.click('button[type="submit"]')
      await page.waitForTimeout(1500)
    }

    // Verify all secrets appear in list
    for (const secret of secrets) {
      await expect(page.locator(`text=${secret.name}`)).toBeVisible()
    }
  })
})
