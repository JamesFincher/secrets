/**
 * Unit Tests for GitHub API Service
 *
 * Tests GitHub integration API client functions with mocked Supabase.
 * Verifies OAuth flow, repository operations, and secret syncing.
 *
 * Test Coverage:
 * - OAuth initialization and completion
 * - Connection management (get, disconnect)
 * - Repository listing and linking
 * - Secret preview and sync
 * - Sync log retrieval
 * - Error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  initGitHubOAuth,
  completeGitHubOAuth,
  getGitHubConnection,
  disconnectGitHub,
  listGitHubRepositories,
  linkGitHubRepository,
  unlinkGitHubRepository,
  previewRepositorySecrets,
  syncRepositorySecrets,
  getRepositorySyncLogs,
  getLinkedRepositories,
  type GitHubConnection,
  type GitHubRepository,
  type LinkedRepository,
  type SyncLog,
  type SecretPreview,
} from './github';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
  },
  from: jest.fn(),
  functions: {
    invoke: jest.fn(),
  },
};

// Mock the Supabase import
jest.mock('./supabase', () => ({
  supabase: mockSupabase,
}));

// Mock encryption functions
jest.mock('../crypto/github-encryption', () => ({
  encryptGitHubToken: jest.fn(),
  decryptGitHubToken: jest.fn(),
}));

const { encryptGitHubToken, decryptGitHubToken } = require('../crypto/github-encryption');

describe('GitHub API Service', () => {
  const mockUserId = 'user-123';
  const mockOrgId = 'org-456';
  const masterPassword = 'SecureMasterPassword123!';
  const kekSalt = 'dGVzdHNhbHQxMjM0NTY3ODkwYWJjZGVmZ2hpams=';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default mock session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: mockUserId },
        },
      },
    });
  });

  describe('initGitHubOAuth', () => {
    it('should return OAuth URL and state', async () => {
      const mockResponse = {
        oauth_url: 'https://github.com/login/oauth/authorize?client_id=xxx&state=abc123',
        state: 'abc123',
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await initGitHubOAuth('http://localhost:3000/callback');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-connect', {
        body: { redirect_uri: 'http://localhost:3000/callback' },
      });

      expect(result).toEqual(mockResponse);
      expect(result.oauth_url).toContain('github.com/login/oauth/authorize');
      expect(result.state).toBeDefined();
    });

    it('should throw error on failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'OAuth init failed' },
      });

      await expect(initGitHubOAuth('http://localhost:3000/callback')).rejects.toThrow(
        /failed to initialize github oauth/i
      );
    });
  });

  describe('completeGitHubOAuth', () => {
    const mockCode = 'auth-code-123';
    const mockState = 'state-abc-123';
    const mockAccessToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz1234';

    beforeEach(() => {
      // Mock OAuth exchange response
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          access_token: mockAccessToken,
          github_user: {
            id: 12345,
            login: 'testuser',
            email: 'test@example.com',
          },
          scope: 'repo read:user',
        },
        error: null,
      });

      // Mock encryption
      encryptGitHubToken.mockResolvedValue({
        encrypted_github_token: 'encrypted_token_base64',
        token_nonce: 'nonce_base64',
        token_dek: 'dek_base64',
        dek_nonce: 'dek_nonce_base64',
        token_auth_tag: 'auth_tag_base64',
      });

      // Mock organization lookup
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { organization_id: mockOrgId },
          error: null,
        }),
        insert: jest.fn().mockReturnThis(),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);
    });

    it('should complete OAuth and store encrypted token', async () => {
      const mockConnection: GitHubConnection = {
        id: 'conn-123',
        organization_id: mockOrgId,
        user_id: mockUserId,
        github_user_id: 12345,
        github_username: 'testuser',
        github_email: 'test@example.com',
        token_scope: ['repo', 'read:user'],
        token_expires_at: null,
        connected_at: new Date().toISOString(),
        last_used_at: null,
      };

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { organization_id: mockOrgId },
          error: null,
        }),
        insert: jest.fn().mockReturnThis(),
      };

      // Last call in chain should return connection
      mockFromChain.single.mockResolvedValueOnce({
        data: { organization_id: mockOrgId },
        error: null,
      });
      mockFromChain.single.mockResolvedValueOnce({
        data: mockConnection,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await completeGitHubOAuth(mockCode, mockState, masterPassword, kekSalt);

      // Verify OAuth exchange was called
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-callback', {
        body: { code: mockCode, state: mockState },
      });

      // Verify encryption was called
      expect(encryptGitHubToken).toHaveBeenCalledWith(
        mockAccessToken,
        masterPassword,
        kekSalt
      );

      // Verify connection was stored
      expect(mockFromChain.insert).toHaveBeenCalled();
      expect(result).toMatchObject({
        github_user_id: 12345,
        github_username: 'testuser',
      });
    });

    it('should throw error if OAuth exchange fails', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Invalid code' },
      });

      await expect(
        completeGitHubOAuth(mockCode, mockState, masterPassword, kekSalt)
      ).rejects.toThrow(/oauth exchange failed/i);
    });

    it('should throw error if user not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      await expect(
        completeGitHubOAuth(mockCode, mockState, masterPassword, kekSalt)
      ).rejects.toThrow(/user not authenticated/i);
    });

    it('should throw error if user not in organization', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(
        completeGitHubOAuth(mockCode, mockState, masterPassword, kekSalt)
      ).rejects.toThrow(/user not associated with an organization/i);
    });
  });

  describe('getGitHubConnection', () => {
    it('should return connection if exists', async () => {
      const mockConnection: GitHubConnection = {
        id: 'conn-123',
        organization_id: mockOrgId,
        user_id: mockUserId,
        github_user_id: 12345,
        github_username: 'testuser',
        github_email: 'test@example.com',
        token_scope: ['repo', 'read:user'],
        token_expires_at: null,
        connected_at: new Date().toISOString(),
        last_used_at: null,
      };

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockConnection,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await getGitHubConnection();

      expect(mockFromChain.select).toHaveBeenCalledWith('*');
      expect(mockFromChain.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(result).toEqual(mockConnection);
    });

    it('should return null if not connected', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await getGitHubConnection();
      expect(result).toBeNull();
    });

    it('should return null if user not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const result = await getGitHubConnection();
      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(getGitHubConnection()).rejects.toThrow(/failed to get github connection/i);
    });
  });

  describe('disconnectGitHub', () => {
    it('should delete GitHub connection', async () => {
      const mockFromChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      await disconnectGitHub();

      expect(mockFromChain.delete).toHaveBeenCalled();
      expect(mockFromChain.eq).toHaveBeenCalledWith('user_id', mockUserId);
    });

    it('should throw error if user not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      await expect(disconnectGitHub()).rejects.toThrow(/user not authenticated/i);
    });

    it('should throw error on database failure', async () => {
      const mockFromChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Delete failed' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(disconnectGitHub()).rejects.toThrow(/failed to disconnect github/i);
    });
  });

  describe('listGitHubRepositories', () => {
    beforeEach(() => {
      // Mock getConnection
      const mockConnection = {
        encrypted_github_token: 'encrypted_token_base64',
        token_nonce: 'nonce_base64',
        token_dek: 'dek_base64',
        dek_nonce: 'dek_nonce_base64',
        token_auth_tag: 'auth_tag_base64',
      };

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockConnection,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      // Mock decryption
      decryptGitHubToken.mockResolvedValue('ghp_decrypted_token');

      // Mock GitHub API response
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          repos: [
            {
              id: 123,
              owner: 'testuser',
              name: 'test-repo',
              full_name: 'testuser/test-repo',
              url: 'https://github.com/testuser/test-repo',
              private: false,
              description: 'Test repository',
              language: 'TypeScript',
              updated_at: '2025-01-01T00:00:00Z',
              linked: false,
            },
          ],
          total_count: 1,
        },
        error: null,
      });
    });

    it('should list repositories after decrypting token', async () => {
      const result = await listGitHubRepositories(masterPassword, kekSalt);

      // Verify decryption was called
      expect(decryptGitHubToken).toHaveBeenCalled();

      // Verify GitHub API was called with decrypted token
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-repos', {
        body: {
          access_token: 'ghp_decrypted_token',
          page: 1,
          per_page: 30,
        },
      });

      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].name).toBe('test-repo');
      expect(result.total_count).toBe(1);
    });

    it('should support pagination', async () => {
      await listGitHubRepositories(masterPassword, kekSalt, 2, 50);

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-repos', {
        body: {
          access_token: 'ghp_decrypted_token',
          page: 2,
          per_page: 50,
        },
      });
    });

    it('should throw error if not connected', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(
        listGitHubRepositories(masterPassword, kekSalt)
      ).rejects.toThrow(/github not connected/i);
    });

    it('should throw error on GitHub API failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'API error' },
      });

      await expect(
        listGitHubRepositories(masterPassword, kekSalt)
      ).rejects.toThrow(/failed to list repositories/i);
    });
  });

  describe('linkGitHubRepository', () => {
    beforeEach(() => {
      // Mock getConnection and decryption
      const mockConnection = {
        encrypted_github_token: 'encrypted_token_base64',
        token_nonce: 'nonce_base64',
        token_dek: 'dek_base64',
        dek_nonce: 'dek_nonce_base64',
        token_auth_tag: 'auth_tag_base64',
      };

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockConnection,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);
      decryptGitHubToken.mockResolvedValue('ghp_decrypted_token');
    });

    it('should link repository with create_project action', async () => {
      const mockLinkedRepo: LinkedRepository = {
        id: 'linked-123',
        organization_id: mockOrgId,
        project_id: 'project-456',
        github_repo_id: 123,
        repo_owner: 'testuser',
        repo_name: 'test-repo',
        repo_url: 'https://github.com/testuser/test-repo',
        abyrith_project_uuid: 'uuid-789',
        sync_enabled: true,
        auto_sync_enabled: false,
        sync_sources: {
          env_files: true,
          github_actions: false,
          dependencies: false,
        },
        default_environment_id: 'env-123',
        linked_at: new Date().toISOString(),
        last_synced_at: null,
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockLinkedRepo,
        error: null,
      });

      const result = await linkGitHubRepository(
        123,
        'testuser',
        'test-repo',
        'https://github.com/testuser/test-repo',
        'create_project',
        'Test Project',
        null,
        'env-123',
        true,
        masterPassword,
        kekSalt
      );

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-link-repo', {
        body: expect.objectContaining({
          access_token: 'ghp_decrypted_token',
          repo_id: 123,
          action: 'create_project',
          project_name: 'Test Project',
        }),
      });

      expect(result).toEqual(mockLinkedRepo);
    });

    it('should link repository with link_existing action', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {} as LinkedRepository,
        error: null,
      });

      await linkGitHubRepository(
        123,
        'testuser',
        'test-repo',
        'https://github.com/testuser/test-repo',
        'link_existing',
        null,
        'existing-project-123',
        'env-123',
        false,
        masterPassword,
        kekSalt
      );

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-link-repo', {
        body: expect.objectContaining({
          action: 'link_existing',
          project_id: 'existing-project-123',
          write_marker_file: false,
        }),
      });
    });

    it('should throw error on link failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Link failed' },
      });

      await expect(
        linkGitHubRepository(
          123,
          'testuser',
          'test-repo',
          'https://github.com/testuser/test-repo',
          'create_project',
          'Test Project',
          null,
          null,
          false,
          masterPassword,
          kekSalt
        )
      ).rejects.toThrow(/failed to link repository/i);
    });
  });

  describe('previewRepositorySecrets', () => {
    beforeEach(() => {
      // Mock getConnection and decryption
      const mockConnection = {
        encrypted_github_token: 'encrypted_token_base64',
        token_nonce: 'nonce_base64',
        token_dek: 'dek_base64',
        dek_nonce: 'dek_nonce_base64',
        token_auth_tag: 'auth_tag_base64',
      };

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockConnection,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);
      decryptGitHubToken.mockResolvedValue('ghp_decrypted_token');
    });

    it('should preview secrets from repository', async () => {
      const mockPreview = {
        secrets: [
          {
            key_name: 'API_KEY',
            source_file: '.env',
            source_type: 'env_file' as const,
            exists_in_abyrith: false,
            collision: false,
          },
          {
            key_name: 'DATABASE_URL',
            source_file: '.env',
            source_type: 'env_file' as const,
            exists_in_abyrith: true,
            collision: true,
          },
        ],
        total_secrets: 2,
        collisions: 1,
        files_scanned: ['.env', '.env.example'],
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockPreview,
        error: null,
      });

      const result = await previewRepositorySecrets(
        'repo-123',
        ['env_files', 'github_actions'],
        masterPassword,
        kekSalt
      );

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-preview-sync', {
        body: {
          access_token: 'ghp_decrypted_token',
          repo_id: 'repo-123',
          sources: ['env_files', 'github_actions'],
        },
      });

      expect(result.secrets).toHaveLength(2);
      expect(result.collisions).toBe(1);
    });

    it('should throw error on preview failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Preview failed' },
      });

      await expect(
        previewRepositorySecrets('repo-123', ['env_files'], masterPassword, kekSalt)
      ).rejects.toThrow(/failed to preview secrets/i);
    });
  });

  describe('syncRepositorySecrets', () => {
    beforeEach(() => {
      // Mock getConnection and decryption
      const mockConnection = {
        encrypted_github_token: 'encrypted_token_base64',
        token_nonce: 'nonce_base64',
        token_dek: 'dek_base64',
        dek_nonce: 'dek_nonce_base64',
        token_auth_tag: 'auth_tag_base64',
      };

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockConnection,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);
      decryptGitHubToken.mockResolvedValue('ghp_decrypted_token');
    });

    it('should sync secrets from repository', async () => {
      const mockSyncLog: SyncLog = {
        id: 'log-123',
        github_linked_repo_id: 'repo-123',
        sync_type: 'manual',
        sync_status: 'success',
        secrets_imported: 5,
        secrets_skipped: 1,
        secrets_failed: 0,
        imported_files: ['.env', '.env.production'],
        error_message: null,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockSyncLog,
        error: null,
      });

      const result = await syncRepositorySecrets(
        'repo-123',
        ['env_files'],
        'env-456',
        'skip',
        masterPassword,
        kekSalt
      );

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('github-sync-repo', {
        body: {
          access_token: 'ghp_decrypted_token',
          repo_id: 'repo-123',
          sources: ['env_files'],
          environment_id: 'env-456',
          collision_strategy: 'skip',
        },
      });

      expect(result.sync_status).toBe('success');
      expect(result.secrets_imported).toBe(5);
    });

    it('should handle partial sync', async () => {
      const mockSyncLog: SyncLog = {
        id: 'log-123',
        github_linked_repo_id: 'repo-123',
        sync_type: 'manual',
        sync_status: 'partial',
        secrets_imported: 3,
        secrets_skipped: 2,
        secrets_failed: 1,
        imported_files: ['.env'],
        error_message: 'Some secrets failed to import',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockSyncLog,
        error: null,
      });

      const result = await syncRepositorySecrets(
        'repo-123',
        ['env_files', 'github_actions'],
        'env-456',
        'overwrite',
        masterPassword,
        kekSalt
      );

      expect(result.sync_status).toBe('partial');
      expect(result.secrets_failed).toBe(1);
    });

    it('should throw error on sync failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Sync failed' },
      });

      await expect(
        syncRepositorySecrets(
          'repo-123',
          ['env_files'],
          'env-456',
          'skip',
          masterPassword,
          kekSalt
        )
      ).rejects.toThrow(/failed to sync repository/i);
    });
  });

  describe('getRepositorySyncLogs', () => {
    it('should retrieve sync logs with pagination', async () => {
      const mockLogs: SyncLog[] = [
        {
          id: 'log-1',
          github_linked_repo_id: 'repo-123',
          sync_type: 'manual',
          sync_status: 'success',
          secrets_imported: 5,
          secrets_skipped: 0,
          secrets_failed: 0,
          imported_files: ['.env'],
          error_message: null,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
        },
      ];

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockLogs,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await getRepositorySyncLogs('repo-123', 1, 20);

      expect(mockFromChain.eq).toHaveBeenCalledWith('github_linked_repo_id', 'repo-123');
      expect(mockFromChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockFromChain.range).toHaveBeenCalledWith(0, 19);
      expect(result.logs).toEqual(mockLogs);
    });

    it('should handle empty logs', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await getRepositorySyncLogs('repo-123');

      expect(result.logs).toEqual([]);
      expect(result.total_count).toBe(0);
    });

    it('should throw error on database failure', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(getRepositorySyncLogs('repo-123')).rejects.toThrow(
        /failed to get sync logs/i
      );
    });
  });

  describe('getLinkedRepositories', () => {
    beforeEach(() => {
      // Mock organization lookup
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { organization_id: mockOrgId },
          error: null,
        }),
        order: jest.fn().mockReturnThis(),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);
    });

    it('should retrieve all linked repositories', async () => {
      const mockLinkedRepos: LinkedRepository[] = [
        {
          id: 'linked-1',
          organization_id: mockOrgId,
          project_id: 'project-1',
          github_repo_id: 123,
          repo_owner: 'testuser',
          repo_name: 'test-repo',
          repo_url: 'https://github.com/testuser/test-repo',
          abyrith_project_uuid: 'uuid-1',
          sync_enabled: true,
          auto_sync_enabled: false,
          sync_sources: {
            env_files: true,
            github_actions: false,
            dependencies: false,
          },
          default_environment_id: 'env-1',
          linked_at: '2025-01-01T00:00:00Z',
          last_synced_at: null,
        },
      ];

      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { organization_id: mockOrgId },
          error: null,
        }),
        order: jest.fn().mockReturnThis(),
      };

      // Second from() call returns linked repos
      mockFromChain.order.mockResolvedValue({
        data: mockLinkedRepos,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await getLinkedRepositories();

      expect(result).toEqual(mockLinkedRepos);
    });

    it('should return empty array if no repos linked', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { organization_id: mockOrgId },
          error: null,
        }),
        order: jest.fn().mockReturnThis(),
      };

      mockFromChain.order.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await getLinkedRepositories();
      expect(result).toEqual([]);
    });

    it('should throw error if user not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      await expect(getLinkedRepositories()).rejects.toThrow(/user not authenticated/i);
    });

    it('should throw error if user not in organization', async () => {
      const mockFromChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(getLinkedRepositories()).rejects.toThrow(
        /user not associated with an organization/i
      );
    });
  });
});
