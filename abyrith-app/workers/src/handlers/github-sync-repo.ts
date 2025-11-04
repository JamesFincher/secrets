/**
 * GitHub Sync Repository Handler
 *
 * POST /api/v1/github/repos/:repo_id/sync
 * Synchronizes secrets from a GitHub repository to Abyrith
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError, createSuccessResponse } from '../middleware/error-handler';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

/**
 * Request validation schema
 */
const SyncRequestSchema = z.object({
  sources: z.array(z.enum(['env_files', 'github_actions', 'dependencies'])).min(1),
  environment_id: z.string().uuid().optional(),
  collision_strategy: z.enum(['skip', 'overwrite', 'rename']),
  files: z.array(z.string()).optional(),
});

interface SyncRequest {
  sources: ('env_files' | 'github_actions' | 'dependencies')[];
  environment_id?: string;
  collision_strategy: 'skip' | 'overwrite' | 'rename';
  files?: string[];
}

interface SyncDetail {
  key_name: string;
  source_file: string;
  action: 'imported' | 'skipped' | 'failed';
  secret_id?: string;
  reason?: string;
}

interface SyncResponse {
  sync_log_id: string;
  status: 'success' | 'partial' | 'failed';
  secrets_imported: number;
  secrets_skipped: number;
  secrets_failed: number;
  imported_files: string[];
  details: SyncDetail[];
}

interface DiscoveredSecret {
  key_name: string;
  value: string;
  source_file: string;
  source_type: 'env_file' | 'github_actions' | 'dependency';
}

/**
 * Parse .env file contents
 */
function parseEnvFile(content: string, fileName: string): DiscoveredSecret[] {
  const secrets: DiscoveredSecret[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Match: KEY=value
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const keyName = match[1];
      let value = match[2];

      // Remove inline comments
      const commentMatch = value.match(/^(.*?)\s*#.*$/);
      if (commentMatch) {
        value = commentMatch[1];
      }

      // Remove quotes
      value = value.trim().replace(/^["']|["']$/g, '');

      secrets.push({
        key_name: keyName,
        value: value,
        source_file: fileName,
        source_type: 'env_file',
      });
    }
  }

  return secrets;
}

/**
 * Fetch file from GitHub
 */
async function fetchFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ('content' in data && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if secret exists in project
 */
async function checkSecretExists(
  projectId: string,
  keyName: string,
  environmentId: string | undefined,
  env: Env
): Promise<string | null> {
  let query = `${env.SUPABASE_URL}/rest/v1/secrets?project_id=eq.${projectId}&key_name=eq.${keyName}`;

  if (environmentId) {
    query += `&environment_id=eq.${environmentId}`;
  }

  query += '&select=id';

  const response = await fetch(query, {
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const secrets = await response.json();
  return secrets[0]?.id || null;
}

/**
 * Import secret to Abyrith
 * Note: This is a placeholder. In production, secrets should be encrypted client-side
 * before being sent to the server. The server should never see plaintext secrets.
 */
async function importSecret(
  projectId: string,
  environmentId: string | undefined,
  keyName: string,
  encryptedValue: string,
  sourceFile: string,
  userId: string,
  env: Env
): Promise<string> {
  // In production, the encrypted value would come from the client
  // For now, this is a placeholder that demonstrates the flow

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/secrets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      project_id: projectId,
      environment_id: environmentId,
      key_name: keyName,
      encrypted_value: encryptedValue, // Would be encrypted client-side
      created_by: userId,
      metadata: {
        imported_from: 'github',
        source_file: sourceFile,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to import secret: ${error}`);
  }

  const data = await response.json();
  return data[0]?.id || data.id;
}

/**
 * Log sync operation
 */
async function logSyncOperation(
  userId: string,
  linkedRepoId: string,
  syncType: 'manual' | 'automatic',
  syncStatus: 'success' | 'partial' | 'failed',
  secretsImported: number,
  secretsSkipped: number,
  secretsFailed: number,
  importedFiles: string[],
  env: Env,
  token: string
): Promise<string> {
  // Fetch user's organization
  const orgResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${userId}&select=organization_id`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const orgData = await orgResponse.json();
  if (!orgData || orgData.length === 0) {
    throw new Error('User not associated with an organization');
  }

  const organizationId = orgData[0].organization_id;

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/github_sync_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      organization_id: organizationId,
      linked_repo_id: linkedRepoId,
      user_id: userId,
      sync_type: syncType,
      sync_status: syncStatus,
      secrets_imported: secretsImported,
      secrets_skipped: secretsSkipped,
      secrets_failed: secretsFailed,
      imported_files: importedFiles,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    console.error('Failed to log sync operation');
    return '';
  }

  const data = await response.json();
  return data[0]?.id || data.id;
}

/**
 * Main handler
 */
export async function handleGitHubSyncRepo(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>
): Promise<Response> {
  try {
    const user = c.get('user');
    const env = c.env;

    // Get repo ID from path parameter
    const repoId = parseInt(c.req.param('repo_id'), 10);

    if (isNaN(repoId)) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid repository ID',
        HttpStatus.BAD_REQUEST
      );
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validation = SyncRequestSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0].message,
        HttpStatus.BAD_REQUEST,
        { errors: validation.error.errors }
      );
    }

    const request: SyncRequest = validation.data;

    // Get GitHub token from request header
    const githubToken = c.req.header('X-GitHub-Token');

    if (!githubToken) {
      throw new ApiError(
        ErrorCode.UNAUTHORIZED,
        'GitHub token required. Please provide X-GitHub-Token header.',
        HttpStatus.UNAUTHORIZED
      );
    }

    // Get JWT token from Authorization header
    const authHeader = c.req.header('Authorization');
    const jwtToken = authHeader?.replace('Bearer ', '') || '';

    // Get linked repo details
    const repoResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/github_linked_repos?github_repo_id=eq.${repoId}&user_id=eq.${user.id}&select=*`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!repoResponse.ok) {
      throw new Error('Failed to fetch repository details');
    }

    const linkedRepos = await repoResponse.json();

    if (linkedRepos.length === 0) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Repository not linked',
        HttpStatus.NOT_FOUND
      );
    }

    const linkedRepo = linkedRepos[0];

    // Initialize Octokit
    const octokit = new Octokit({
      auth: githubToken,
      userAgent: 'Abyrith Secrets Manager v1.0',
    });

    // Collect all discovered secrets
    const discoveredSecrets: DiscoveredSecret[] = [];
    const filesScanned: string[] = [];

    // Fetch .env files
    if (request.sources.includes('env_files')) {
      const envFileNames = request.files || [
        '.env',
        '.env.example',
        '.env.production',
        '.env.staging',
        '.env.local',
      ];

      for (const fileName of envFileNames) {
        const content = await fetchFile(
          octokit,
          linkedRepo.repo_owner,
          linkedRepo.repo_name,
          fileName
        );

        if (content) {
          const secrets = parseEnvFile(content, fileName);
          discoveredSecrets.push(...secrets);
          filesScanned.push(fileName);
        }
      }
    }

    // Process each discovered secret
    const details: SyncDetail[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const secret of discoveredSecrets) {
      try {
        // Check if secret already exists
        const existingSecretId = await checkSecretExists(
          linkedRepo.project_id,
          secret.key_name,
          request.environment_id,
          env
        );

        if (existingSecretId) {
          // Handle collision based on strategy
          if (request.collision_strategy === 'skip') {
            details.push({
              key_name: secret.key_name,
              source_file: secret.source_file,
              action: 'skipped',
              reason: 'Secret already exists in environment',
            });
            skipped++;
            continue;
          } else if (request.collision_strategy === 'overwrite') {
            // Update existing secret (not implemented in this placeholder)
            details.push({
              key_name: secret.key_name,
              source_file: secret.source_file,
              action: 'skipped',
              reason: 'Overwrite not implemented (requires client-side encryption)',
            });
            skipped++;
            continue;
          } else if (request.collision_strategy === 'rename') {
            // Rename by appending suffix
            secret.key_name = `${secret.key_name}_IMPORTED`;
          }
        }

        // TODO: SECURITY CRITICAL - Secrets should be encrypted client-side before calling this endpoint
        // The frontend should:
        // 1. Fetch secrets preview
        // 2. Encrypt each secret with user's master key
        // 3. Send encrypted secrets to this endpoint
        //
        // This placeholder Base64 encoding is NOT secure and violates zero-knowledge architecture
        const placeholderEncryptedValue = Buffer.from(secret.value).toString('base64');

        // Import secret
        const secretId = await importSecret(
          linkedRepo.project_id,
          request.environment_id,
          secret.key_name,
          placeholderEncryptedValue,
          secret.source_file,
          user.id,
          env
        );

        details.push({
          key_name: secret.key_name,
          source_file: secret.source_file,
          action: 'imported',
          secret_id: secretId,
        });
        imported++;
      } catch (error) {
        console.error(`Failed to import secret ${secret.key_name}:`, error);
        details.push({
          key_name: secret.key_name,
          source_file: secret.source_file,
          action: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    // Determine sync status
    let status: 'success' | 'partial' | 'failed';
    if (failed === 0 && imported > 0) {
      status = 'success';
    } else if (imported > 0 && failed > 0) {
      status = 'partial';
    } else {
      status = 'failed';
    }

    // Log sync operation
    const syncLogId = await logSyncOperation(
      user.id,
      linkedRepo.id,
      'manual',
      status,
      imported,
      skipped,
      failed,
      filesScanned,
      env,
      jwtToken
    );

    const response: SyncResponse = {
      sync_log_id: syncLogId,
      status,
      secrets_imported: imported,
      secrets_skipped: skipped,
      secrets_failed: failed,
      imported_files: filesScanned,
      details,
    };

    return c.json(createSuccessResponse(response), HttpStatus.OK);
  } catch (error) {
    console.error('GitHub sync repo error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to sync repository secrets',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
