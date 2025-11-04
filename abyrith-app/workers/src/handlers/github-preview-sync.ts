/**
 * GitHub Preview Sync Handler
 *
 * GET /api/v1/github/repos/:repo_id/preview
 * Previews secrets that would be imported from a GitHub repository
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError, createSuccessResponse } from '../middleware/error-handler';
import { Octokit } from '@octokit/rest';

interface PreviewSecret {
  key_name: string;
  source_file: string;
  source_type: 'env_file' | 'github_actions' | 'dependency';
  exists_in_abyrith: boolean;
  collision: boolean;
}

interface PreviewResponse {
  secrets: PreviewSecret[];
  total_secrets: number;
  collisions: number;
  files_scanned: string[];
}

/**
 * Parse .env file contents
 */
function parseEnvFile(content: string, fileName: string): PreviewSecret[] {
  const secrets: PreviewSecret[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Match: KEY=value
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
    if (match) {
      const keyName = match[1];
      secrets.push({
        key_name: keyName,
        source_file: fileName,
        source_type: 'env_file',
        exists_in_abyrith: false, // Will be checked later
        collision: false,
      });
    }
  }

  return secrets;
}

/**
 * Detect dependencies from package.json
 */
function detectDependencies(content: string, fileName: string): PreviewSecret[] {
  try {
    const pkg = JSON.parse(content);
    const deps = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ];

    // Map common packages to required API keys
    const apiKeyMap: Record<string, string[]> = {
      'openai': ['OPENAI_API_KEY', 'OPENAI_ORG_ID'],
      '@anthropic-ai/sdk': ['ANTHROPIC_API_KEY'],
      'stripe': ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'],
      '@stripe/stripe-js': ['STRIPE_PUBLISHABLE_KEY'],
      'sendgrid': ['SENDGRID_API_KEY'],
      'twilio': ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
      '@aws-sdk/client-s3': ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
      'firebase-admin': ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'],
      '@supabase/supabase-js': ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
      'mongodb': ['MONGODB_URI'],
      'pg': ['DATABASE_URL'],
      '@vercel/postgres': ['POSTGRES_URL'],
    };

    const secrets: PreviewSecret[] = [];

    for (const dep of deps) {
      if (apiKeyMap[dep]) {
        for (const keyName of apiKeyMap[dep]) {
          secrets.push({
            key_name: keyName,
            source_file: fileName,
            source_type: 'dependency',
            exists_in_abyrith: false,
            collision: false,
          });
        }
      }
    }

    return secrets;
  } catch (error) {
    console.error('Failed to parse package.json:', error);
    return [];
  }
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
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Check which secrets already exist in Abyrith
 */
async function checkExistingSecrets(
  projectId: string,
  secretKeys: string[],
  env: Env
): Promise<Set<string>> {
  if (secretKeys.length === 0) return new Set();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/secrets?project_id=eq.${projectId}&key_name=in.(${secretKeys.join(',')})&select=key_name`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    return new Set();
  }

  const secrets = await response.json();
  return new Set(secrets.map((s: any) => s.key_name));
}

/**
 * Get project ID from linked repo
 */
async function getProjectIdFromLinkedRepo(
  repoId: number,
  userId: string,
  env: Env
): Promise<string | null> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/github_linked_repos?repo_id=eq.${repoId}&user_id=eq.${userId}&select=project_id`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const linkedRepos = await response.json();
  return linkedRepos[0]?.project_id || null;
}

/**
 * Main handler
 */
export async function handleGitHubPreviewSync(
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

    // Get query parameters
    const sourcesParam = c.req.query('sources') || 'env_files,github_actions,dependencies';
    const sources = sourcesParam.split(',').map(s => s.trim());

    const filesParam = c.req.query('files');
    const specificFiles = filesParam ? filesParam.split(',').map(f => f.trim()) : null;

    // Get GitHub token from request header
    const githubToken = c.req.header('X-GitHub-Token');

    if (!githubToken) {
      throw new ApiError(
        ErrorCode.UNAUTHORIZED,
        'GitHub token required. Please provide X-GitHub-Token header.',
        HttpStatus.UNAUTHORIZED
      );
    }

    // Get project ID from linked repo
    const projectId = await getProjectIdFromLinkedRepo(repoId, user.id, env);

    if (!projectId) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Repository is not linked to any Abyrith project',
        HttpStatus.NOT_FOUND
      );
    }

    // Get repo details from database
    const repoResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/github_linked_repos?repo_id=eq.${repoId}&user_id=eq.${user.id}&select=*`,
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

    // Collect all secrets
    const allSecrets: PreviewSecret[] = [];
    const filesScanned: string[] = [];

    // Fetch .env files
    if (sources.includes('env_files')) {
      const envFileNames = specificFiles || [
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
          allSecrets.push(...secrets);
          filesScanned.push(fileName);
        }
      }
    }

    // Fetch dependency files
    if (sources.includes('dependencies')) {
      const depFiles = ['package.json', 'requirements.txt', 'composer.json'];

      for (const fileName of depFiles) {
        const content = await fetchFile(
          octokit,
          linkedRepo.repo_owner,
          linkedRepo.repo_name,
          fileName
        );

        if (content && fileName === 'package.json') {
          const secrets = detectDependencies(content, fileName);
          allSecrets.push(...secrets);
          filesScanned.push(fileName);
        }
      }
    }

    // Check which secrets already exist in Abyrith
    const secretKeys = allSecrets.map(s => s.key_name);
    const existingKeys = await checkExistingSecrets(projectId, secretKeys, env);

    // Mark existing secrets and collisions
    let collisionCount = 0;
    for (const secret of allSecrets) {
      if (existingKeys.has(secret.key_name)) {
        secret.exists_in_abyrith = true;
        secret.collision = true;
        collisionCount++;
      }
    }

    // Remove duplicates (same key from multiple sources)
    const uniqueSecrets = Array.from(
      new Map(allSecrets.map(s => [s.key_name, s])).values()
    );

    const response: PreviewResponse = {
      secrets: uniqueSecrets,
      total_secrets: uniqueSecrets.length,
      collisions: collisionCount,
      files_scanned: filesScanned,
    };

    return c.json(createSuccessResponse(response), HttpStatus.OK);
  } catch (error) {
    console.error('GitHub preview sync error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to preview secrets',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
