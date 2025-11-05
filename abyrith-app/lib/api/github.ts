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
import { createApiLogger } from '../utils/logger';

// Create logger for GitHub API operations
const log = createApiLogger('github-api');

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  const response = await fetch(`${workerUrl}/api/v1/github/connect`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      redirect_uri: redirectUri,
      scopes: ['repo', 'read:user']
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to initialize GitHub OAuth');
  }

  const result = await response.json();
  return result.data;
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
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new Error('Not authenticated');

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  const response = await fetch(`${workerUrl}/api/v1/github/callback`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionData.session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code, state })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OAuth exchange failed: ${error.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  const { access_token, github_user, scope } = result.data;

  // Step 2: Encrypt token client-side (zero-knowledge)
  const encryptedToken = await encryptGitHubToken(
    access_token,
    masterPassword,
    kekSalt
  );

  // Step 3: Store encrypted token in database
  const userId = sessionData.session.user.id;

  // Get user's organization
  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single();

  if (!orgMember) {
    throw new Error('User not associated with an organization');
  }

  const { data: connection, error: insertError } = await supabase
    .from('github_connections')
    .insert({
      organization_id: orgMember.organization_id,
      user_id: userId,
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
  log.debug('listGitHubRepositories called', {
    hasMasterPassword: !!masterPassword,
    masterPasswordLength: masterPassword?.length,
    hasKekSalt: !!kekSalt,
    kekSaltLength: kekSalt?.length,
    page,
    perPage,
  });

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

  log.debug('Decrypting GitHub token for list repos', {
    hasEncryptedToken: !!encryptedToken.encrypted_github_token,
    hasMasterPassword: !!masterPassword,
    masterPasswordLength: masterPassword?.length,
    hasKekSalt: !!kekSalt,
    kekSaltLength: kekSalt?.length,
  });

  const accessToken = await decryptGitHubToken(
    encryptedToken,
    masterPassword,
    kekSalt
  );

  log.debug('GitHub token decrypted successfully for list repos');

  // Call GitHub API via Cloudflare Worker proxy
  const { data: sessionData2 } = await supabase.auth.getSession();
  if (!sessionData2?.session) throw new Error('Not authenticated');

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  const response = await fetch(`${workerUrl}/api/v1/github/repos?page=${page}&per_page=${perPage}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionData2.session.access_token}`,
      'X-GitHub-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to list repositories: ${error.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  return result.data;
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
  log.info('Starting GitHub repository link', {
    repoId,
    repoOwner,
    repoName,
    action,
    projectName,
    projectId,
    defaultEnvironmentId,
    writeMarkerFile,
  });

  try {
    // Get and decrypt GitHub token
    log.debug('Fetching GitHub connection');
    const connection = await getGitHubConnection();

    if (!connection) {
      log.error('GitHub not connected');
      throw new Error('GitHub not connected');
    }

    log.debug('GitHub connection found', {
      connectionId: connection.id,
      githubUsername: connection.github_username,
    });

    const encryptedToken: EncryptedGitHubToken = {
      encrypted_github_token: connection.encrypted_github_token,
      token_nonce: connection.token_nonce,
      token_dek: connection.token_dek,
      dek_nonce: connection.dek_nonce,
      token_auth_tag: connection.token_auth_tag,
    };

    log.debug('Decrypting GitHub token', {
      hasEncryptedToken: !!encryptedToken.encrypted_github_token,
      hasTokenDek: !!encryptedToken.token_dek,
      hasTokenNonce: !!encryptedToken.token_nonce,
      hasDekNonce: !!encryptedToken.dek_nonce,
      hasAuthTag: !!encryptedToken.token_auth_tag,
      hasMasterPassword: !!masterPassword,
      masterPasswordLength: masterPassword?.length,
      hasKekSalt: !!kekSalt,
      kekSaltLength: kekSalt?.length,
    });
    const accessToken = await decryptGitHubToken(
      encryptedToken,
      masterPassword,
      kekSalt
    );
    log.debug('GitHub token decrypted successfully');

    // Call link endpoint via Cloudflare Worker
    log.debug('Getting Supabase session');
    const { data: sessionData3 } = await supabase.auth.getSession();

    if (!sessionData3?.session) {
      log.error('User not authenticated');
      throw new Error('Not authenticated');
    }

    log.debug('Session found', {
      userId: sessionData3.session.user.id,
    });

    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
    const endpoint = `${workerUrl}/api/v1/github/repos/link`;

    const requestPayload = {
      repo_id: repoId,
      repo_owner: repoOwner,
      repo_name: repoName,
      repo_url: repoUrl,
      action,
      project_name: projectName,
      project_id: projectId,
      default_environment_id: defaultEnvironmentId,
      write_marker_file: writeMarkerFile,
      sync_config: {
        env_files: true,
        github_actions: true,
        dependencies: true
      }
    };

    log.request('POST', endpoint, requestPayload);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionData3.session.access_token}`,
        'X-GitHub-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    log.debug('Received response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('Link repository request failed', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });

      let errorMessage = 'Unknown error';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
        log.error('Parsed error response', errorJson);
      } catch (e) {
        log.error('Could not parse error response as JSON', { errorText });
      }

      throw new Error(`Failed to link repository: ${errorMessage}`);
    }

    const result = await response.json();
    log.success('POST', endpoint, response.status, result);
    log.info('GitHub repository linked successfully', {
      linkedRepoId: result.data?.linked_repo_id,
      projectId: result.data?.project_id,
    });

    return result.data;
  } catch (error: any) {
    log.error('POST', `${process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'}/api/v1/github/repos/link`, error);
    throw error;
  }
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

  const { data: sessionData4 } = await supabase.auth.getSession();
  if (!sessionData4?.session) throw new Error('Not authenticated');

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  const response = await fetch(`${workerUrl}/api/v1/github/repos/${repoId}/unlink`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionData4.session.access_token}`,
      'X-GitHub-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to unlink repository: ${error.error?.message || 'Unknown error'}`);
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

  const { data: sessionData5 } = await supabase.auth.getSession();
  if (!sessionData5?.session) throw new Error('Not authenticated');

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  const response = await fetch(`${workerUrl}/api/v1/github/repos/${repoId}/preview`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionData5.session.access_token}`,
      'X-GitHub-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sources })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to preview secrets: ${error.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  return result.data;
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

  const { data: sessionData6 } = await supabase.auth.getSession();
  if (!sessionData6?.session) throw new Error('Not authenticated');

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  const response = await fetch(`${workerUrl}/api/v1/github/repos/${repoId}/sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionData6.session.access_token}`,
      'X-GitHub-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sources,
      environment_id: environmentId,
      collision_strategy: collisionStrategy
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to sync repository: ${error.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  return result.data;
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
