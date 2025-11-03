import { Page, expect } from '@playwright/test'

/**
 * Playwright-specific test helpers
 *
 * Common page interactions and assertions for Playwright tests.
 */

export interface TestUser {
  email: string
  password: string
  masterPassword: string
}

/**
 * Login helper for Playwright tests
 *
 * Handles login flow including master password setup if needed.
 */
export async function loginUser(page: Page, user: TestUser) {
  await page.goto('/auth/login')

  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for redirect
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })

  // Handle master password setup if prompted
  const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i')
  if (await masterPasswordPrompt.isVisible({ timeout: 3000 })) {
    await setupMasterPassword(page, user.masterPassword)
  }
}

/**
 * Signup helper for Playwright tests
 *
 * Creates a new user account.
 */
export async function signupUser(page: Page, user: TestUser) {
  await page.goto('/auth/signup')

  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for redirect
  await page.waitForURL(/\/(dashboard|auth\/confirm)/, { timeout: 10000 })

  // Handle master password setup if prompted
  if (page.url().includes('/dashboard')) {
    const masterPasswordPrompt = page.locator('text=/master password|unlock vault/i')
    if (await masterPasswordPrompt.isVisible({ timeout: 3000 })) {
      await setupMasterPassword(page, user.masterPassword)
    }
  }
}

/**
 * Setup master password
 */
export async function setupMasterPassword(page: Page, masterPassword: string) {
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill(masterPassword)

  // Check if confirmation field exists
  const confirmInput = page.locator('input[type="password"]').nth(1)
  if (await confirmInput.isVisible({ timeout: 1000 })) {
    await confirmInput.fill(masterPassword)
  }

  await page.click('button[type="submit"]')
  await page.waitForTimeout(2000) // Wait for vault to unlock
}

/**
 * Logout helper
 */
export async function logoutUser(page: Page) {
  const logoutButton = page.locator(
    'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout-button"]'
  )
  await logoutButton.click()

  // Wait for redirect to login
  await page.waitForURL(/\/auth\/login/, { timeout: 5000 })
}

/**
 * Create a secret via UI
 */
export async function createSecret(
  page: Page,
  secret: { name: string; value: string; description: string }
) {
  // Navigate to secrets page
  await page.goto('/dashboard/secrets')

  // Click new secret button
  await page.click('button:has-text("New Secret"), [data-testid="new-secret-button"]')

  // Wait for form
  await page.waitForSelector('input[name="name"], [data-testid="secret-name-input"]', {
    timeout: 5000,
  })

  // Fill form
  await page.fill('input[name="name"], [data-testid="secret-name-input"]', secret.name)
  await page.fill('input[name="value"], [data-testid="secret-value-input"]', secret.value)
  await page.fill(
    'textarea[name="description"], [data-testid="secret-description-input"]',
    secret.description
  )

  // Submit
  await page.click('button[type="submit"], [data-testid="save-secret-button"]')

  // Wait for success
  await page.waitForTimeout(2000)
}

/**
 * Delete a secret via UI
 */
export async function deleteSecret(page: Page, secretName: string) {
  // Navigate to secrets page
  await page.goto('/dashboard/secrets')

  // Click on the secret
  await page.click(`text=${secretName}`)
  await page.waitForTimeout(1000)

  // Click delete button
  const deleteButton = page.locator('button:has-text("Delete"), [data-testid="delete-secret-button"]')
  await deleteButton.click()

  // Confirm deletion
  const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")')
  if (await confirmButton.isVisible({ timeout: 3000 })) {
    await confirmButton.click()
  }

  await page.waitForTimeout(2000)
}

/**
 * Send AI message and wait for response
 */
export async function sendAIMessage(page: Page, message: string) {
  // Navigate to AI assistant
  await page.goto('/dashboard/assistant')

  // Wait for input
  const messageInput = page.locator('textarea, [data-testid="chat-input"]')
  await messageInput.fill(message)

  // Send
  const sendButton = page.locator('button[type="submit"], [data-testid="send-message-button"]')
  await sendButton.click()

  // Wait for response to start
  await page.waitForTimeout(3000)
}

/**
 * Verify network request does not contain plaintext
 */
export async function verifyEncryptedRequest(
  page: Page,
  operation: () => Promise<void>,
  plaintextValue: string
) {
  const requests: any[] = []

  // Capture network requests
  page.on('request', (request) => {
    if (request.url().includes('secrets') || request.url().includes('supabase')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      })
    }
  })

  // Perform operation
  await operation()

  // Wait a moment for requests to complete
  await page.waitForTimeout(1000)

  // Verify no request contains plaintext
  for (const request of requests) {
    if (request.postData) {
      expect(request.postData).not.toContain(plaintextValue)
    }
  }
}

/**
 * Check console for errors
 */
export async function checkConsoleErrors(page: Page): Promise<string[]> {
  const consoleErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  return consoleErrors
}

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
) {
  const { timeout = 5000 } = options
  await page.waitForSelector(selector, { state: 'visible', timeout })
}

/**
 * Take screenshot on failure
 */
export async function screenshotOnFailure(page: Page, testName: string) {
  const timestamp = Date.now()
  const filename = `screenshots/failure-${testName}-${timestamp}.png`
  await page.screenshot({ path: filename, fullPage: true })
  console.log(`Screenshot saved: ${filename}`)
}

/**
 * Measure page load time
 */
export async function measurePageLoad(page: Page, url: string): Promise<number> {
  const startTime = Date.now()
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  const endTime = Date.now()
  return endTime - startTime
}

/**
 * Verify API response time
 */
export async function measureAPIResponse(
  page: Page,
  urlPattern: string,
  operation: () => Promise<void>
): Promise<number> {
  return new Promise(async (resolve) => {
    let responseTime = 0

    const startTime = Date.now()

    page.on('response', (response) => {
      if (response.url().includes(urlPattern)) {
        responseTime = Date.now() - startTime
      }
    })

    await operation()

    // Wait a moment for response to complete
    await page.waitForTimeout(1000)

    resolve(responseTime)
  })
}

/**
 * Fill form with multiple fields
 */
export async function fillForm(page: Page, fields: Record<string, string>) {
  for (const [selector, value] of Object.entries(fields)) {
    await page.fill(selector, value)
  }
}

/**
 * Check if element exists (without waiting)
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.locator(selector)
    return (await element.count()) > 0
  } catch {
    return false
  }
}

/**
 * Wait for URL to match pattern
 */
export async function waitForURLPattern(
  page: Page,
  pattern: RegExp,
  options: { timeout?: number } = {}
) {
  const { timeout = 10000 } = options
  await page.waitForURL(pattern, { timeout })
}

/**
 * Clear browser storage
 */
export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

/**
 * Set local storage item
 */
export async function setLocalStorageItem(page: Page, key: string, value: string) {
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    { key, value }
  )
}

/**
 * Get local storage item
 */
export async function getLocalStorageItem(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((key) => {
    return localStorage.getItem(key)
  }, key)
}

/**
 * Retry operation with custom attempts
 */
export async function retryOperation(
  operation: () => Promise<void>,
  maxAttempts = 3,
  delayMs = 1000
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await operation()
      return
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}
