import { createClient } from '@supabase/supabase-js'

/**
 * Test Utilities for Integration Testing
 *
 * Provides helper functions for setting up test data, cleanup,
 * and common test operations.
 */

/**
 * Create a Supabase client for testing
 *
 * Uses environment variables for configuration.
 * Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 */
export function createTestClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Create a Supabase admin client for testing
 *
 * Uses service role key for admin operations.
 * CAUTION: Only use in tests, never in production client code.
 */
export function createTestAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase admin environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * Generate a unique test email address
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `${prefix}-${timestamp}-${random}@example.com`
}

/**
 * Generate test user credentials
 */
export function generateTestUser() {
  return {
    email: generateTestEmail(),
    password: 'SecureTestPassword123!',
    masterPassword: 'MasterSecret123!',
  }
}

/**
 * Generate test secret data
 */
export function generateTestSecret(index?: number) {
  const suffix = index !== undefined ? `_${index}` : `_${Date.now()}`

  return {
    name: `TEST_SECRET${suffix}`,
    value: `test_value_${Math.random().toString(36).substring(7)}`,
    description: `Test secret for integration testing ${suffix}`,
  }
}

/**
 * Generate multiple test secrets
 */
export function generateTestSecrets(count: number) {
  return Array.from({ length: count }, (_, i) => generateTestSecret(i))
}

/**
 * Cleanup test data for a specific user
 *
 * WARNING: This permanently deletes data. Only use in tests!
 *
 * @param userId - The user ID to clean up
 */
export async function cleanupTestData(userId: string) {
  const adminClient = createTestAdminClient()

  console.log(`Cleaning up test data for user: ${userId}`)

  try {
    // Delete secrets (soft deletes will still have data)
    const { error: secretsError } = await adminClient
      .from('secrets')
      .delete()
      .eq('user_id', userId)

    if (secretsError) {
      console.error('Error deleting secrets:', secretsError)
    }

    // Delete secret versions
    const { error: versionsError } = await adminClient
      .from('secret_versions')
      .delete()
      .eq('user_id', userId)

    if (versionsError) {
      console.error('Error deleting secret versions:', versionsError)
    }

    // Delete conversations
    const { error: conversationsError } = await adminClient
      .from('conversations')
      .delete()
      .eq('user_id', userId)

    if (conversationsError) {
      console.error('Error deleting conversations:', conversationsError)
    }

    // Delete messages (should cascade, but being explicit)
    const { error: messagesError } = await adminClient
      .from('messages')
      .delete()
      .eq('user_id', userId)

    if (messagesError) {
      console.error('Error deleting messages:', messagesError)
    }

    // Delete audit logs
    const { error: auditError } = await adminClient
      .from('audit_logs')
      .delete()
      .eq('user_id', userId)

    if (auditError) {
      console.error('Error deleting audit logs:', auditError)
    }

    // Delete projects
    const { error: projectsError } = await adminClient
      .from('projects')
      .delete()
      .eq('user_id', userId)

    if (projectsError) {
      console.error('Error deleting projects:', projectsError)
    }

    // Delete user preferences
    const { error: prefsError } = await adminClient
      .from('user_preferences')
      .delete()
      .eq('user_id', userId)

    if (prefsError) {
      console.error('Error deleting user preferences:', prefsError)
    }

    console.log(`Test data cleanup complete for user: ${userId}`)
  } catch (error) {
    console.error('Error during test data cleanup:', error)
    throw error
  }
}

/**
 * Delete a test user completely
 *
 * WARNING: This permanently deletes the user and all data!
 * Only use in tests!
 *
 * @param userId - The user ID to delete
 */
export async function deleteTestUser(userId: string) {
  const adminClient = createTestAdminClient()

  // First cleanup all related data
  await cleanupTestData(userId)

  // Then delete the user from auth.users
  // Note: This requires admin API access
  // You may need to use Supabase Admin API or SQL function
  console.log(`Deleting test user: ${userId}`)
  console.log('Note: User deletion from auth.users may require additional setup')

  // If you have a custom SQL function for deleting users:
  // const { error } = await adminClient.rpc('delete_user', { user_id: userId })

  // For now, just log (actual deletion may need to be done manually or via Supabase dashboard)
}

/**
 * Wait for a condition to be true
 *
 * Useful for polling database state in tests.
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    timeoutMessage?: string
  } = {}
): Promise<void> {
  const { timeout = 10000, interval = 500, timeoutMessage = 'Condition not met within timeout' } = options

  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(timeoutMessage)
}

/**
 * Get user ID from email
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const adminClient = createTestAdminClient()

  const { data, error } = await adminClient
    .from('auth.users')
    .select('id')
    .eq('email', email)
    .single()

  if (error) {
    console.error('Error fetching user by email:', error)
    return null
  }

  return data?.id || null
}

/**
 * Verify secret is encrypted in database
 *
 * Checks that the encrypted_value does not contain the plaintext value.
 */
export async function verifySecretEncrypted(
  secretId: string,
  plaintextValue: string
): Promise<boolean> {
  const adminClient = createTestAdminClient()

  const { data, error } = await adminClient
    .from('secrets')
    .select('encrypted_value')
    .eq('id', secretId)
    .single()

  if (error) {
    console.error('Error fetching secret:', error)
    return false
  }

  // Verify encrypted_value does NOT contain plaintext
  return !data.encrypted_value.includes(plaintextValue)
}

/**
 * Check if audit log entry exists
 */
export async function checkAuditLog(
  userId: string,
  action: string,
  resourceId?: string
): Promise<boolean> {
  const adminClient = createTestAdminClient()

  let query = adminClient
    .from('audit_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('action', action)

  if (resourceId) {
    query = query.eq('resource_id', resourceId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking audit log:', error)
    return false
  }

  return (data?.length || 0) > 0
}

/**
 * Performance testing utilities
 */

export interface PerformanceMetrics {
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  operations: number
}

/**
 * Measure performance of multiple operations
 */
export async function measurePerformance(
  operation: () => Promise<void>,
  count: number
): Promise<PerformanceMetrics> {
  const times: number[] = []

  for (let i = 0; i < count; i++) {
    const startTime = performance.now()
    await operation()
    const endTime = performance.now()
    times.push(endTime - startTime)
  }

  const totalTime = times.reduce((sum, time) => sum + time, 0)
  const averageTime = totalTime / count
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)

  return {
    totalTime,
    averageTime,
    minTime,
    maxTime,
    operations: count,
  }
}

/**
 * Format performance metrics for console output
 */
export function formatPerformanceMetrics(metrics: PerformanceMetrics): string {
  return `
Performance Metrics:
  Operations: ${metrics.operations}
  Total Time: ${metrics.totalTime.toFixed(2)}ms
  Average Time: ${metrics.averageTime.toFixed(2)}ms
  Min Time: ${metrics.minTime.toFixed(2)}ms
  Max Time: ${metrics.maxTime.toFixed(2)}ms
  `
}

/**
 * Encryption test utilities
 */

/**
 * Verify encrypted value is base64-encoded and not plaintext
 */
export function isValidEncryptedValue(encryptedValue: string, plaintext: string): boolean {
  // Check it's base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/
  if (!base64Regex.test(encryptedValue)) {
    return false
  }

  // Check it doesn't contain plaintext
  if (encryptedValue.includes(plaintext)) {
    return false
  }

  // Check it's at least as long as plaintext (usually longer due to encryption overhead)
  // AES-GCM adds IV (12 bytes) + auth tag (16 bytes) + ciphertext
  const minLength = Math.ceil(((plaintext.length + 28) * 4) / 3) // base64 encoding
  if (encryptedValue.length < minLength) {
    return false
  }

  return true
}

/**
 * Verify KEK salt format
 */
export function isValidKEKSalt(salt: string): boolean {
  // Should be 32 bytes base64 encoded = 44 characters
  const base64Regex = /^[A-Za-z0-9+/]{43}=$/
  return base64Regex.test(salt)
}

/**
 * Sleep utility for tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry an operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    backoffMultiplier?: number
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay)
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }

  throw lastError || new Error('Operation failed after retries')
}

/**
 * GitHub-specific cleanup utilities
 */

/**
 * Cleanup GitHub connection for a user
 */
export async function cleanupGitHubConnection(userId: string) {
  const adminClient = createTestAdminClient()

  console.log(`Cleaning up GitHub connection for user: ${userId}`)

  try {
    // Delete GitHub connection
    const { error: connectionError } = await adminClient
      .from('github_connections')
      .delete()
      .eq('user_id', userId)

    if (connectionError) {
      console.error('Error deleting GitHub connection:', connectionError)
    }

    console.log(`GitHub connection cleanup complete for user: ${userId}`)
  } catch (error) {
    console.error('Error during GitHub connection cleanup:', error)
    throw error
  }
}

/**
 * Cleanup linked GitHub repositories for an organization
 */
export async function cleanupLinkedRepositories(organizationId: string) {
  const adminClient = createTestAdminClient()

  console.log(`Cleaning up linked repositories for org: ${organizationId}`)

  try {
    // Get all linked repos for the org
    const { data: linkedRepos } = await adminClient
      .from('github_linked_repos')
      .select('id')
      .eq('organization_id', organizationId)

    if (linkedRepos) {
      // Delete sync logs for each linked repo
      for (const repo of linkedRepos) {
        const { error: logsError } = await adminClient
          .from('github_sync_logs')
          .delete()
          .eq('github_linked_repo_id', repo.id)

        if (logsError) {
          console.error('Error deleting sync logs:', logsError)
        }
      }
    }

    // Delete linked repos
    const { error: reposError } = await adminClient
      .from('github_linked_repos')
      .delete()
      .eq('organization_id', organizationId)

    if (reposError) {
      console.error('Error deleting linked repos:', reposError)
    }

    console.log(`Linked repositories cleanup complete for org: ${organizationId}`)
  } catch (error) {
    console.error('Error during linked repositories cleanup:', error)
    throw error
  }
}

/**
 * Complete GitHub integration cleanup
 * Removes all GitHub-related data for a user and their organization
 */
export async function cleanupAllGitHubData(userId: string, organizationId: string) {
  await cleanupGitHubConnection(userId)
  await cleanupLinkedRepositories(organizationId)
}
