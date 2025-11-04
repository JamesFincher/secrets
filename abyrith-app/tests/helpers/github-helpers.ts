/**
 * GitHub Integration Test Helpers
 *
 * Provides mock data generators, test utilities, and helper functions
 * specifically for GitHub integration testing.
 */

import type {
  GitHubConnection,
  GitHubRepository,
  LinkedRepository,
  SyncLog,
  SecretPreview,
} from '../../lib/api/github';
import type { EncryptedGitHubToken } from '../../lib/crypto/github-encryption';

/**
 * Generate mock GitHub OAuth access token
 */
export function generateMockGitHubToken(prefix: 'ghp' | 'gho' | 'ghs' | 'ghu' | 'github_pat' = 'ghp'): string {
  const randomPart = Math.random().toString(36).substring(2, 15) +
                     Math.random().toString(36).substring(2, 15) +
                     Math.random().toString(36).substring(2, 15);

  if (prefix === 'github_pat') {
    return `github_pat_${randomPart}`;
  }

  return `${prefix}_${randomPart}`;
}

/**
 * Generate mock encrypted GitHub token
 */
export function generateMockEncryptedToken(): EncryptedGitHubToken {
  return {
    encrypted_github_token: btoa('encrypted_token_' + Math.random()),
    token_nonce: btoa('nonce_' + Math.random()),
    token_dek: btoa('dek_' + Math.random()),
    dek_nonce: btoa('dek_nonce_' + Math.random()),
    token_auth_tag: btoa('auth_tag_' + Math.random()),
  };
}

/**
 * Generate mock GitHub connection
 */
export function generateMockGitHubConnection(
  overrides?: Partial<GitHubConnection>
): GitHubConnection {
  const timestamp = new Date().toISOString();

  return {
    id: `conn-${Math.random().toString(36).substring(7)}`,
    organization_id: `org-${Math.random().toString(36).substring(7)}`,
    user_id: `user-${Math.random().toString(36).substring(7)}`,
    github_user_id: Math.floor(Math.random() * 1000000),
    github_username: `testuser${Math.floor(Math.random() * 1000)}`,
    github_email: `test${Math.floor(Math.random() * 1000)}@example.com`,
    token_scope: ['repo', 'read:user'],
    token_expires_at: null,
    connected_at: timestamp,
    last_used_at: null,
    ...overrides,
  };
}

/**
 * Generate mock GitHub repository
 */
export function generateMockRepository(
  overrides?: Partial<GitHubRepository>
): GitHubRepository {
  const repoId = Math.floor(Math.random() * 1000000);
  const owner = `user${Math.floor(Math.random() * 1000)}`;
  const name = `repo${Math.floor(Math.random() * 1000)}`;

  return {
    id: repoId,
    owner,
    name,
    full_name: `${owner}/${name}`,
    url: `https://github.com/${owner}/${name}`,
    private: Math.random() > 0.5,
    description: `Test repository ${repoId}`,
    language: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust'][
      Math.floor(Math.random() * 5)
    ],
    updated_at: new Date().toISOString(),
    linked: false,
    ...overrides,
  };
}

/**
 * Generate multiple mock repositories
 */
export function generateMockRepositories(count: number): GitHubRepository[] {
  return Array.from({ length: count }, () => generateMockRepository());
}

/**
 * Generate mock linked repository
 */
export function generateMockLinkedRepository(
  overrides?: Partial<LinkedRepository>
): LinkedRepository {
  const timestamp = new Date().toISOString();
  const repo = generateMockRepository();

  return {
    id: `linked-${Math.random().toString(36).substring(7)}`,
    organization_id: `org-${Math.random().toString(36).substring(7)}`,
    project_id: `project-${Math.random().toString(36).substring(7)}`,
    github_repo_id: repo.id,
    repo_owner: repo.owner,
    repo_name: repo.name,
    repo_url: repo.url,
    abyrith_project_uuid: `uuid-${Math.random().toString(36).substring(7)}`,
    sync_enabled: true,
    auto_sync_enabled: false,
    sync_sources: {
      env_files: true,
      github_actions: false,
      dependencies: false,
    },
    default_environment_id: `env-${Math.random().toString(36).substring(7)}`,
    linked_at: timestamp,
    last_synced_at: null,
    ...overrides,
  };
}

/**
 * Generate mock sync log
 */
export function generateMockSyncLog(
  overrides?: Partial<SyncLog>
): SyncLog {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 60000); // 1 minute later

  return {
    id: `log-${Math.random().toString(36).substring(7)}`,
    github_linked_repo_id: `repo-${Math.random().toString(36).substring(7)}`,
    sync_type: 'manual',
    sync_status: 'success',
    secrets_imported: Math.floor(Math.random() * 20),
    secrets_skipped: Math.floor(Math.random() * 5),
    secrets_failed: 0,
    imported_files: ['.env', '.env.production'],
    error_message: null,
    started_at: startTime.toISOString(),
    completed_at: endTime.toISOString(),
    ...overrides,
  };
}

/**
 * Generate mock secret preview
 */
export function generateMockSecretPreview(
  overrides?: Partial<SecretPreview>
): SecretPreview {
  const keyName = `SECRET_${Math.floor(Math.random() * 1000)}`;

  return {
    key_name: keyName,
    source_file: '.env',
    source_type: 'env_file',
    exists_in_abyrith: Math.random() > 0.7,
    collision: Math.random() > 0.8,
    ...overrides,
  };
}

/**
 * Generate multiple secret previews
 */
export function generateMockSecretPreviews(count: number): SecretPreview[] {
  return Array.from({ length: count }, (_, i) =>
    generateMockSecretPreview({
      key_name: `SECRET_${i}`,
    })
  );
}

/**
 * Mock GitHub OAuth response
 */
export interface MockOAuthResponse {
  oauth_url: string;
  state: string;
}

export function generateMockOAuthResponse(): MockOAuthResponse {
  const state = Math.random().toString(36).substring(2, 15);
  return {
    oauth_url: `https://github.com/login/oauth/authorize?client_id=test&state=${state}`,
    state,
  };
}

/**
 * Mock GitHub user data
 */
export interface MockGitHubUser {
  id: number;
  login: string;
  email: string;
  name: string;
  avatar_url: string;
}

export function generateMockGitHubUser(): MockGitHubUser {
  const userId = Math.floor(Math.random() * 1000000);
  const username = `testuser${userId}`;

  return {
    id: userId,
    login: username,
    email: `${username}@example.com`,
    name: `Test User ${userId}`,
    avatar_url: `https://avatars.githubusercontent.com/u/${userId}?v=4`,
  };
}

/**
 * Mock GitHub API token exchange response
 */
export interface MockTokenExchangeResponse {
  access_token: string;
  token_type: string;
  scope: string;
  github_user: MockGitHubUser;
}

export function generateMockTokenExchange(): MockTokenExchangeResponse {
  return {
    access_token: generateMockGitHubToken('gho'),
    token_type: 'bearer',
    scope: 'repo read:user',
    github_user: generateMockGitHubUser(),
  };
}

/**
 * Mock file content for secret scanning
 */
export interface MockRepoFile {
  path: string;
  content: string;
  type: 'env_file' | 'github_actions' | 'config_file' | 'dependency';
}

export function generateMockEnvFile(secretCount: number = 5): MockRepoFile {
  const secrets = Array.from(
    { length: secretCount },
    (_, i) => `SECRET_${i}=value_${i}`
  );

  return {
    path: '.env',
    content: secrets.join('\n'),
    type: 'env_file',
  };
}

export function generateMockGitHubActionsFile(): MockRepoFile {
  return {
    path: '.github/workflows/deploy.yml',
    content: `
name: Deploy
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      API_KEY: \${{ secrets.API_KEY }}
      DATABASE_URL: \${{ secrets.DATABASE_URL }}
    `,
    type: 'github_actions',
  };
}

export function generateMockPackageJson(): MockRepoFile {
  return {
    path: 'package.json',
    content: JSON.stringify({
      name: 'test-app',
      dependencies: {
        '@supabase/supabase-js': '^2.0.0',
        'stripe': '^10.0.0',
      },
    }),
    type: 'dependency',
  };
}

/**
 * Mock Supabase query builder for GitHub tests
 */
export class MockSupabaseQueryBuilder {
  private data: any = null;
  private error: any = null;

  constructor(data: any = null, error: any = null) {
    this.data = data;
    this.error = error;
  }

  select(columns: string = '*') {
    return this;
  }

  insert(values: any) {
    this.data = values;
    return this;
  }

  update(values: any) {
    this.data = values;
    return this;
  }

  delete() {
    return this;
  }

  eq(column: string, value: any) {
    return this;
  }

  neq(column: string, value: any) {
    return this;
  }

  gt(column: string, value: any) {
    return this;
  }

  gte(column: string, value: any) {
    return this;
  }

  lt(column: string, value: any) {
    return this;
  }

  lte(column: string, value: any) {
    return this;
  }

  like(column: string, pattern: string) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  is(column: string, value: any) {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  range(from: number, to: number) {
    return this;
  }

  single() {
    return Promise.resolve({
      data: this.data,
      error: this.error,
    });
  }

  maybeSingle() {
    return Promise.resolve({
      data: this.data,
      error: this.error,
    });
  }

  then(resolve: any, reject?: any) {
    return Promise.resolve({
      data: this.data,
      error: this.error,
    }).then(resolve, reject);
  }

  catch(reject: any) {
    return Promise.resolve({
      data: this.data,
      error: this.error,
    }).catch(reject);
  }
}

/**
 * Create mock Supabase client for GitHub tests
 */
export function createMockSupabaseClient(options: {
  sessionUser?: { id: string };
  connectionData?: GitHubConnection | null;
  linkedRepos?: LinkedRepository[];
  syncLogs?: SyncLog[];
  error?: any;
} = {}) {
  const {
    sessionUser = { id: 'test-user-123' },
    connectionData = null,
    linkedRepos = [],
    syncLogs = [],
    error = null,
  } = options;

  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: sessionUser ? { user: sessionUser } : null,
        },
      }),
    },
    from: jest.fn((table: string) => {
      if (table === 'github_connections') {
        return new MockSupabaseQueryBuilder(connectionData, error);
      }
      if (table === 'github_linked_repos') {
        return new MockSupabaseQueryBuilder(linkedRepos, error);
      }
      if (table === 'github_sync_logs') {
        return new MockSupabaseQueryBuilder(syncLogs, error);
      }
      if (table === 'organization_members') {
        return new MockSupabaseQueryBuilder(
          { organization_id: 'test-org-123' },
          error
        );
      }
      return new MockSupabaseQueryBuilder(null, error);
    }),
    functions: {
      invoke: jest.fn(),
    },
  };
}

/**
 * Mock GitHub API responses for Cloudflare Worker
 */
export const mockGitHubAPIResponses = {
  /**
   * Mock successful OAuth initialization
   */
  oauthInit: (redirectUri: string) => ({
    data: generateMockOAuthResponse(),
    error: null,
  }),

  /**
   * Mock successful OAuth callback
   */
  oauthCallback: () => ({
    data: generateMockTokenExchange(),
    error: null,
  }),

  /**
   * Mock repository list
   */
  listRepos: (count: number = 10) => ({
    data: {
      repos: generateMockRepositories(count),
      total_count: count,
    },
    error: null,
  }),

  /**
   * Mock repository link
   */
  linkRepo: () => ({
    data: generateMockLinkedRepository(),
    error: null,
  }),

  /**
   * Mock secret preview
   */
  previewSecrets: (secretCount: number = 5) => ({
    data: {
      secrets: generateMockSecretPreviews(secretCount),
      total_secrets: secretCount,
      collisions: Math.floor(secretCount * 0.2),
      files_scanned: ['.env', '.env.production', '.github/workflows/deploy.yml'],
    },
    error: null,
  }),

  /**
   * Mock successful sync
   */
  syncSuccess: (imported: number = 5) => ({
    data: generateMockSyncLog({
      sync_status: 'success',
      secrets_imported: imported,
      secrets_skipped: 0,
      secrets_failed: 0,
    }),
    error: null,
  }),

  /**
   * Mock partial sync (some failures)
   */
  syncPartial: (imported: number = 3, failed: number = 2) => ({
    data: generateMockSyncLog({
      sync_status: 'partial',
      secrets_imported: imported,
      secrets_skipped: 0,
      secrets_failed: failed,
      error_message: 'Some secrets failed to import',
    }),
    error: null,
  }),

  /**
   * Mock failed sync
   */
  syncFailed: (errorMessage: string = 'Sync failed') => ({
    data: generateMockSyncLog({
      sync_status: 'failed',
      secrets_imported: 0,
      secrets_skipped: 0,
      secrets_failed: 5,
      error_message: errorMessage,
    }),
    error: null,
  }),

  /**
   * Mock API error
   */
  error: (message: string = 'API error') => ({
    data: null,
    error: { message },
  }),
};

/**
 * Validate GitHub token format (for testing)
 */
export function isValidGitHubTokenFormat(token: string): boolean {
  const validPrefixes = ['ghp_', 'gho_', 'ghs_', 'ghu_', 'github_pat_'];
  return (
    token.length >= 40 &&
    validPrefixes.some((prefix) => token.startsWith(prefix))
  );
}

/**
 * Validate encrypted token structure
 */
export function isValidEncryptedTokenStructure(
  encrypted: EncryptedGitHubToken
): boolean {
  return (
    typeof encrypted.encrypted_github_token === 'string' &&
    typeof encrypted.token_nonce === 'string' &&
    typeof encrypted.token_dek === 'string' &&
    typeof encrypted.dek_nonce === 'string' &&
    typeof encrypted.token_auth_tag === 'string' &&
    encrypted.encrypted_github_token.length > 0 &&
    encrypted.token_nonce.length > 0 &&
    encrypted.token_dek.length > 0 &&
    encrypted.dek_nonce.length > 0 &&
    encrypted.token_auth_tag.length > 0
  );
}

/**
 * Simulate OAuth callback URL
 */
export function generateOAuthCallbackURL(
  code: string,
  state: string,
  baseUrl: string = 'http://localhost:3000'
): string {
  return `${baseUrl}/auth/callback/github?code=${code}&state=${state}`;
}

/**
 * Wait for GitHub connection to be established
 */
export async function waitForGitHubConnection(
  checkFn: () => Promise<GitHubConnection | null>,
  timeoutMs: number = 10000
): Promise<GitHubConnection> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const connection = await checkFn();
    if (connection) {
      return connection;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('GitHub connection not established within timeout');
}

/**
 * Wait for repository sync to complete
 */
export async function waitForSyncComplete(
  checkFn: () => Promise<SyncLog | null>,
  timeoutMs: number = 60000
): Promise<SyncLog> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const log = await checkFn();
    if (log && log.completed_at) {
      return log;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Repository sync did not complete within timeout');
}
