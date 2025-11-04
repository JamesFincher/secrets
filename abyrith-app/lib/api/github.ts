/**
 * GitHub Integration API Client
 *
 * Handles GitHub OAuth, repository linking, and secret syncing operations.
 * Implements zero-knowledge encryption for GitHub tokens.
 *
 * Based on:
 * - 05-api/endpoints/github-endpoints.md
 * - 06-backend/integrations/github-api-integration.md
 * - 03-security/integrations-security.md
 */

import { supabase } from './supabase';
import {
  encryptGitHubToken,
  decryptGitHubToken,
  type EncryptedGitHubToken,
} from '../crypto/github-encryption';

/**
 * GitHub connection status
 */
export interface GitHubConnection {
  id: string;
  organization_id: string;
  user_id: string;
  github_user_id: number;
  github_username: string;
  github_email: string | null;
  token_scope: string[];
  token_expires_at: string | null;
  connected_at: string;
  last_used_at: string | null;
}

/**
 * GitHub repository information
 */
export interface GitHubRepository {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  url: string;
  private: boolean;
  description: string | null;
  language: string | null;
  updated_at: string;
  linked: boolean;
}

/**
 * Linked repository details
 */
export interface LinkedRepository {
  id: string;
  organization_id: string;
  project_id: string;
  github_repo_id: number;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  abyrith_project_uuid: string;
  sync_enabled: boolean;
  auto_sync_enabled: boolean;
  sync_sources: {
    env_files: boolean;
    github_actions: boolean;
    dependencies: boolean;
  };
  default_environment_id: string | null;
  linked_at: string;
  last_synced_at: string | null;
}

/**
 * Sync log entry
 */
export interface SyncLog {
  id: string;
  github_linked_repo_id: string;
  sync_type: 'manual' | 'scheduled' | 'webhook';
  sync_status: 'success' | 'partial' | 'failed';
  secrets_imported: number;
  secrets_skipped: number;
  secrets_failed: number;
  imported_files: string[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

/**
 * Secret preview for import
 */
export interface SecretPreview {
  key_name: string;
  source_file: string;
  source_type: 'env_file' | 'github_actions' | 'config_file' | 'dependency';
  exists_in_abyrith: boolean;
  collision: boolean;
}

/**
 * Initialize GitHub OAuth flow
 *
 * Generates OAuth URL for user to authorize Abyrith to access their GitHub repos.
 *
 * @param redirectUri - Where to redirect after authorization
 * @returns OAuth URL to redirect user to
 */
export async function initGitHubOAuth(
  redirectUri: string
): Promise<{ oauth_url: string; state: string }> {
  const { data, error } = await supabase.functions.invoke('github-connect', {
    body: { redirect_uri: redirectUri },
  });

  if (error) throw new Error(`Failed to initialize GitHub OAuth: ${error.message}`);
  return data;
}

/**
 * Complete GitHub OAuth flow
 *
 * Exchanges authorization code for access token and stores encrypted token.
 *
 * @param code - OAuth authorization code from GitHub
 * @param state - State parameter for CSRF protection
 * @param masterPassword - User's master password for token encryption
 * @param kekSalt - User's KEK salt for encryption
 * @returns GitHub connection details
 */
export async function completeGitHubOAuth(
  code: string,
  state: string,
  masterPassword: string,
  kekSalt: string
): Promise<GitHubConnection> {
  // Step 1: Exchange code for access token (server-side)
  const { data: tokenData, error: exchangeError } = await supabase.functions.invoke(
    'github-callback',
    {
      body: { code, state },
    }
  );

  if (exchangeError) {
    throw new Error(`OAuth exchange failed: ${exchangeError.message}`);
  }

  const { access_token, github_user, scope } = tokenData;

  // Step 2: Encrypt token client-side (zero-knowledge)
  const encryptedToken = await encryptGitHubToken(
    access_token,
    masterPassword,
    kekSalt
  );

  // Step 3: Store encrypted token in database
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user) {
    throw new Error('User not authenticated');
  }

  // Get user's organization
  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', session.session.user.id)
    .single();

  if (!orgMember) {
    throw new Error('User not associated with an organization');
  }

  const { data: connection, error: insertError } = await supabase
    .from('github_connections')
    .insert({
      organization_id: orgMember.organization_id,
      user_id: session.session.user.id,
      encrypted_github_token: encryptedToken.encrypted_github_token,
      token_nonce: encryptedToken.token_nonce,
      token_dek: encryptedToken.token_dek,
      dek_nonce: encryptedToken.dek_nonce,
      token_auth_tag: encryptedToken.token_auth_tag,
      github_user_id: github_user.id,
      github_username: github_user.login,
      github_email: github_user.email,
      token_scope: scope.split(' '),
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to store GitHub connection: ${insertError.message}`);
  }

  return connection;
}

/**
 * Get current GitHub connection status
 *
 * @returns GitHub connection details or null if not connected
 */
export async function getGitHubConnection(): Promise<GitHubConnection | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user) return null;

  const { data: connection, error } = await supabase
    .from('github_connections')
    .select('*')
    .eq('user_id', session.session.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get GitHub connection: ${error.message}`);
  }

  return connection;
}

/**
 * Disconnect GitHub account
 *
 * Removes GitHub connection and unlinks all repositories.
 */
export async function disconnectGitHub(): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('github_connections')
    .delete()
    .eq('user_id', session.session.user.id);

  if (error) {
    throw new Error(`Failed to disconnect GitHub: ${error.message}`);
  }
}

/**
 * List accessible GitHub repositories
 *
 * @param masterPassword - User's master password to decrypt token
 * @param kekSalt - User's KEK salt
 * @param page - Page number (default 1)
 * @param perPage - Results per page (default 30)
 * @returns List of repositories
 */
export async function listGitHubRepositories(
  masterPassword: string,
  kekSalt: string,
  page: number = 1,
  perPage: number = 30
): Promise<{ repos: GitHubRepository[]; total_count: number }> {
  // Get encrypted token from database
  const connection = await getGitHubConnection();
  if (!connection) {
    throw new Error('GitHub not connected');
  }

  // Decrypt token client-side
  const encryptedToken: EncryptedGitHubToken = {
    encrypted_github_token: connection.encrypted_github_token,
    token_nonce: connection.token_nonce,
    token_dek: connection.token_dek,
    dek_nonce: connection.dek_nonce,
    token_auth_tag: connection.token_auth_tag,
  };

  const accessToken = await decryptGitHubToken(
    encryptedToken,
    masterPassword,
    kekSalt
  );

  // Call GitHub API via Cloudflare Worker proxy
  const { data, error } = await supabase.functions.invoke('github-repos', {
    body: {
      access_token: accessToken,
      page,
      per_page: perPage,
    },
  });

  if (error) {
    throw new Error(`Failed to list repositories: ${error.message}`);
  }

  return data;
}

/**
 * Link a GitHub repository to an Abyrith project
 *
 * @param repoId - GitHub repository ID
 * @param repoOwner - Repository owner
 * @param repoName - Repository name
 * @param repoUrl - Repository URL
 * @param action - "create_project" or "link_existing"
 * @param projectName - Name for new project (if action=create_project)
 * @param projectId - Existing project ID (if action=link_existing)
 * @param defaultEnvironmentId - Where to import secrets
 * @param writeMarkerFile - Whether to write .abyrith file to repo
 * @param masterPassword - User's master password to decrypt token
 * @param kekSalt - User's KEK salt
 * @returns Linked repository details
 */
export async function linkGitHubRepository(
  repoId: number,
  repoOwner: string,
  repoName: string,
  repoUrl: string,
  action: 'create_project' | 'link_existing',
  projectName: string | null,
  projectId: string | null,
  defaultEnvironmentId: string | null,
  writeMarkerFile: boolean,
  masterPassword: string,
  kekSalt: string
): Promise<LinkedRepository> {
  // Get and decrypt GitHub token
  const connection = await getGitHubConnection();
  if (!connection) {
    throw new Error('GitHub not connected');
  }

  const encryptedToken: EncryptedGitHubToken = {
    encrypted_github_token: connection.encrypted_github_token,
    token_nonce: connection.token_nonce,
    token_dek: connection.token_dek,
    dek_nonce: connection.dek_nonce,
    token_auth_tag: connection.token_auth_tag,
  };

  const accessToken = await decryptGitHubToken(
    encryptedToken,
    masterPassword,
    kekSalt
  );

  // Call link endpoint via Cloudflare Worker
  const { data, error } = await supabase.functions.invoke('github-link-repo', {
    body: {
      access_token: accessToken,
      repo_id: repoId,
      repo_owner: repoOwner,
      repo_name: repoName,
      repo_url: repoUrl,
      action,
      project_name: projectName,
      project_id: projectId,
      default_environment_id: defaultEnvironmentId,
      write_marker_file: writeMarkerFile,
    },
  });

  if (error) {
    throw new Error(`Failed to link repository: ${error.message}`);
  }

  return data;
}

/**
 * Unlink a GitHub repository
 *
 * @param repoId - Linked repository ID
 * @param masterPassword - User's master password to decrypt token
 * @param kekSalt - User's KEK salt
 */
export async function unlinkGitHubRepository(
  repoId: string,
  masterPassword: string,
  kekSalt: string
): Promise<void> {
  // Get and decrypt GitHub token
  const connection = await getGitHubConnection();
  if (!connection) {
    throw new Error('GitHub not connected');
  }

  const encryptedToken: EncryptedGitHubToken = {
    encrypted_github_token: connection.encrypted_github_token,
    token_nonce: connection.token_nonce,
    token_dek: connection.token_dek,
    dek_nonce: connection.dek_nonce,
    token_auth_tag: connection.token_auth_tag,
  };

  const accessToken = await decryptGitHubToken(
    encryptedToken,
    masterPassword,
    kekSalt
  );

  const { error } = await supabase.functions.invoke('github-unlink-repo', {
    body: {
      access_token: accessToken,
      repo_id: repoId,
    },
  });

  if (error) {
    throw new Error(`Failed to unlink repository: ${error.message}`);
  }
}

/**
 * Preview secrets that would be imported from a repository
 *
 * @param repoId - Linked repository ID
 * @param sources - Which sources to scan
 * @param masterPassword - User's master password to decrypt token
 * @param kekSalt - User's KEK salt
 * @returns Preview of secrets to import
 */
export async function previewRepositorySecrets(
  repoId: string,
  sources: ('env_files' | 'github_actions' | 'dependencies')[],
  masterPassword: string,
  kekSalt: string
): Promise<{
  secrets: SecretPreview[];
  total_secrets: number;
  collisions: number;
  files_scanned: string[];
}> {
  // Get and decrypt GitHub token
  const connection = await getGitHubConnection();
  if (!connection) {
    throw new Error('GitHub not connected');
  }

  const encryptedToken: EncryptedGitHubToken = {
    encrypted_github_token: connection.encrypted_github_token,
    token_nonce: connection.token_nonce,
    token_dek: connection.token_dek,
    dek_nonce: connection.dek_nonce,
    token_auth_tag: connection.token_auth_tag,
  };

  const accessToken = await decryptGitHubToken(
    encryptedToken,
    masterPassword,
    kekSalt
  );

  const { data, error } = await supabase.functions.invoke('github-preview-sync', {
    body: {
      access_token: accessToken,
      repo_id: repoId,
      sources,
    },
  });

  if (error) {
    throw new Error(`Failed to preview secrets: ${error.message}`);
  }

  return data;
}

/**
 * Sync secrets from GitHub repository to Abyrith
 *
 * @param repoId - Linked repository ID
 * @param sources - Which sources to import from
 * @param environmentId - Target environment for secrets
 * @param collisionStrategy - How to handle existing secrets
 * @param masterPassword - User's master password to decrypt token
 * @param kekSalt - User's KEK salt
 * @returns Sync results
 */
export async function syncRepositorySecrets(
  repoId: string,
  sources: ('env_files' | 'github_actions' | 'dependencies')[],
  environmentId: string,
  collisionStrategy: 'skip' | 'overwrite' | 'rename',
  masterPassword: string,
  kekSalt: string
): Promise<SyncLog> {
  // Get and decrypt GitHub token
  const connection = await getGitHubConnection();
  if (!connection) {
    throw new Error('GitHub not connected');
  }

  const encryptedToken: EncryptedGitHubToken = {
    encrypted_github_token: connection.encrypted_github_token,
    token_nonce: connection.token_nonce,
    token_dek: connection.token_dek,
    dek_nonce: connection.dek_nonce,
    token_auth_tag: connection.token_auth_tag,
  };

  const accessToken = await decryptGitHubToken(
    encryptedToken,
    masterPassword,
    kekSalt
  );

  const { data, error } = await supabase.functions.invoke('github-sync-repo', {
    body: {
      access_token: accessToken,
      repo_id: repoId,
      sources,
      environment_id: environmentId,
      collision_strategy: collisionStrategy,
    },
  });

  if (error) {
    throw new Error(`Failed to sync repository: ${error.message}`);
  }

  return data;
}

/**
 * Get sync logs for a linked repository
 *
 * @param repoId - Linked repository ID
 * @param page - Page number
 * @param perPage - Results per page
 * @returns Sync log entries
 */
export async function getRepositorySyncLogs(
  repoId: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ logs: SyncLog[]; total_count: number }> {
  const { data, error } = await supabase
    .from('github_sync_logs')
    .select('*', { count: 'exact' })
    .eq('github_linked_repo_id', repoId)
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) {
    throw new Error(`Failed to get sync logs: ${error.message}`);
  }

  return {
    logs: data || [],
    total_count: data?.length || 0,
  };
}

/**
 * Get all linked repositories for the user's organization
 *
 * @returns List of linked repositories
 */
export async function getLinkedRepositories(): Promise<LinkedRepository[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user) {
    throw new Error('User not authenticated');
  }

  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', session.session.user.id)
    .single();

  if (!orgMember) {
    throw new Error('User not associated with an organization');
  }

  const { data, error } = await supabase
    .from('github_linked_repos')
    .select('*')
    .eq('organization_id', orgMember.organization_id)
    .order('linked_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get linked repositories: ${error.message}`);
  }

  return data || [];
}
