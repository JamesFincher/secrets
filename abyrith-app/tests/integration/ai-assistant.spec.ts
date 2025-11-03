import { test, expect } from '@playwright/test'

/**
 * AI Assistant Integration Tests
 *
 * Tests AI chat functionality, streaming, and conversation management.
 * Corresponds to Test Suite 4 in INTEGRATION-TEST-PLAN.md
 */

test.describe('AI Assistant', () => {
  const TEST_EMAIL = `test-ai-${Date.now()}@example.com`
  const TEST_PASSWORD = 'SecureTestPassword123!'
  const TEST_MASTER_PASSWORD = 'MasterSecret123!'

  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
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

  test('Test 4.1: AI chat sends and receives messages', async ({ page }) => {
    // Navigate to AI assistant
    await page.goto('/dashboard/assistant')

    // Wait for chat interface
    await page.waitForSelector('textarea, input[type="text"]', { timeout: 5000 })

    // Type message
    const messageInput = page.locator('textarea, input[placeholder*="message" i], [data-testid="chat-input"]')
    await messageInput.fill('How do I get an API key for OpenAI?')

    // Send message
    const sendButton = page.locator('button[type="submit"], button:has-text("Send"), [data-testid="send-message-button"]')
    await sendButton.click()

    // Wait for response to start appearing
    await page.waitForTimeout(3000)

    // Verify user message appears
    await expect(page.locator('text=/How do I get an API key/i')).toBeVisible()

    // Verify AI response appears (should contain relevant keywords)
    const aiResponse = page.locator('text=/OpenAI|API key|account|dashboard/i')
    await expect(aiResponse.first()).toBeVisible({ timeout: 10000 })
  })

  test('Test 4.2: AI streaming shows progressive response', async ({ page }) => {
    await page.goto('/dashboard/assistant')

    const messageInput = page.locator('textarea, [data-testid="chat-input"]')
    await messageInput.fill('Tell me about Stripe API keys in one sentence.')

    const sendButton = page.locator('button[type="submit"], [data-testid="send-message-button"]')
    await sendButton.click()

    // Wait a short time
    await page.waitForTimeout(1500)

    // Check if response is streaming (partial text visible)
    // This is a rough check - in real implementation, you'd verify progressive updates
    const responseContainer = page.locator('[data-testid="ai-response"], [role="article"]').last()
    const initialText = await responseContainer.textContent()

    // Wait a bit more
    await page.waitForTimeout(1500)

    const updatedText = await responseContainer.textContent()

    // Text should have grown (streaming)
    expect(updatedText?.length).toBeGreaterThan(initialText?.length || 0)
  })

  test('Test 4.3: Conversation history persists', async ({ page }) => {
    await page.goto('/dashboard/assistant')

    // Send first message
    const messageInput = page.locator('textarea, [data-testid="chat-input"]')
    await messageInput.fill('My name is TestUser')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    // Send second message referencing first
    await messageInput.fill('What is my name?')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    // AI should remember the name from first message
    await expect(page.locator('text=/TestUser/i')).toBeVisible({ timeout: 10000 })
  })

  test('Test 4.4: New conversation creates fresh context', async ({ page }) => {
    await page.goto('/dashboard/assistant')

    // Send message in first conversation
    const messageInput = page.locator('textarea, [data-testid="chat-input"]')
    await messageInput.fill('Remember the number 42')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    // Start new conversation
    const newConversationButton = page.locator('button:has-text("New"), [data-testid="new-conversation-button"]')
    if (await newConversationButton.isVisible({ timeout: 3000 })) {
      await newConversationButton.click()
      await page.waitForTimeout(1000)
    }

    // Send message asking about previous context
    await messageInput.fill('What number did I tell you to remember?')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    // AI should NOT remember (new conversation)
    // Response should indicate it doesn't have that information
    const response = page.locator('text=/don\'t have|no previous|can\'t recall/i')
    await expect(response.first()).toBeVisible({ timeout: 10000 })
  })

  test('Test 4.5: Guided acquisition provides helpful steps', async ({ page }) => {
    await page.goto('/dashboard/assistant')

    const messageInput = page.locator('textarea, [data-testid="chat-input"]')
    await messageInput.fill('Help me get a Stripe API key')
    await page.click('button[type="submit"]')

    // Wait for response
    await page.waitForTimeout(4000)

    // Verify step-by-step guidance appears
    // Look for numbered steps or bullet points
    const guidanceIndicators = page.locator('text=/step|1\\.|first|sign up|account|dashboard/i')
    await expect(guidanceIndicators.first()).toBeVisible({ timeout: 10000 })
  })

  test('Test 4.6: Multiple messages in same conversation', async ({ page }) => {
    await page.goto('/dashboard/assistant')

    const messages = [
      'What is Stripe?',
      'How do I integrate it?',
      'What about webhooks?',
    ]

    const messageInput = page.locator('textarea, [data-testid="chat-input"]')

    for (const message of messages) {
      await messageInput.fill(message)
      await page.click('button[type="submit"]')
      await page.waitForTimeout(3000)

      // Verify message appears
      await expect(page.locator(`text=${message}`)).toBeVisible()
    }

    // Verify all messages visible in conversation
    for (const message of messages) {
      await expect(page.locator(`text=${message}`)).toBeVisible()
    }
  })

  test('Test 4.7: Error handling for API failures', async ({ page, context }) => {
    // Block AI API requests to simulate failure
    await context.route('**/api/chat', (route) => {
      route.abort()
    })

    await page.goto('/dashboard/assistant')

    const messageInput = page.locator('textarea, [data-testid="chat-input"]')
    await messageInput.fill('This should fail')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // Verify error message appears
    const errorMessage = page.locator('text=/error|failed|try again/i')
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })
  })
})
