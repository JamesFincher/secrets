/**
 * GitHub Repositories List Handler
 *
 * GET /api/v1/github/repos
 * Lists accessible GitHub repositories for the authenticated user
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError, createSuccessResponse } from '../middleware/error-handler';
import { Octokit } from '@octokit/rest';

interface GitHubRepo {
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

interface ListReposResponse {
  repos: GitHubRepo[];
  total_count: number;
  page: number;
  per_page: number;
}

/**
 * Get GitHub access token from connection
 */
async function getGitHubToken(userId: string, env: Env): Promise<string> {
  // Fetch connection from database
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/github_connections?user_id=eq.${userId}&select=*`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub connection');
  }

  const connections = await response.json();

  if (connections.length === 0) {
    throw new ApiError(
      ErrorCode.NOT_FOUND,
      'No GitHub connection found. Please connect your GitHub account first.',
      HttpStatus.NOT_FOUND
    );
  }

  // Note: In production, the token would be encrypted and we'd need to
  // handle decryption client-side. For now, assuming token is in header
  // or passed via request context.
  // This is a placeholder - actual implementation needs proper token handling
  const connection = connections[0];

  // Token would be decrypted client-side and passed in request header
  return ''; // Placeholder - token comes from X-GitHub-Token header
}

/**
 * Get linked repository IDs for user
 */
async function getLinkedRepoIds(userId: string, env: Env): Promise<Set<number>> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/github_linked_repos?user_id=eq.${userId}&select=github_repo_id`,
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

  const linkedRepos = await response.json();
  return new Set(linkedRepos.map((r: any) => r.github_repo_id));
}

/**
 * Main handler
 */
export async function handleGitHubRepos(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>
): Promise<Response> {
  try {
    const user = c.get('user');
    const env = c.env;

    // Get pagination parameters
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '30', 10), 100);
    const sort = c.req.query('sort') || 'updated';

    // Get GitHub token from request header (decrypted client-side)
    const githubToken = c.req.header('X-GitHub-Token');

    if (!githubToken) {
      throw new ApiError(
        ErrorCode.UNAUTHORIZED,
        'GitHub token required. Please provide X-GitHub-Token header.',
        HttpStatus.UNAUTHORIZED
      );
    }

    // Initialize Octokit
    const octokit = new Octokit({
      auth: githubToken,
      userAgent: 'Abyrith Secrets Manager v1.0',
    });

    // Fetch repositories from GitHub
    const response = await octokit.repos.listForAuthenticatedUser({
      sort: sort as any,
      per_page: perPage,
      page: page,
    });

    // Get linked repository IDs
    const linkedRepoIds = await getLinkedRepoIds(user.id, env);

    // Transform GitHub repos to our format
    const repos: GitHubRepo[] = response.data.map(repo => ({
      id: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      full_name: repo.full_name,
      url: repo.html_url,
      private: repo.private,
      description: repo.description,
      language: repo.language,
      updated_at: repo.updated_at || repo.created_at,
      linked: linkedRepoIds.has(repo.id),
    }));

    // GitHub doesn't return total count in list endpoint
    // We'll use the Link header to determine if there are more pages
    const linkHeader = response.headers.link;
    const hasNextPage = linkHeader?.includes('rel="next"');
    const hasPrevPage = page > 1;

    // Estimate total count (GitHub's total_count isn't always available)
    const totalCount = hasNextPage ? (page * perPage) + 1 : repos.length + ((page - 1) * perPage);

    const result: ListReposResponse = {
      repos,
      total_count: totalCount,
      page,
      per_page: perPage,
    };

    return c.json(createSuccessResponse(result), HttpStatus.OK);
  } catch (error) {
    console.error('GitHub repos error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    // Handle Octokit errors
    if (error && typeof error === 'object' && 'status' in error) {
      const octokitError = error as any;

      if (octokitError.status === 401) {
        throw new ApiError(
          ErrorCode.UNAUTHORIZED,
          'GitHub token expired or invalid. Please reconnect your GitHub account.',
          HttpStatus.UNAUTHORIZED
        );
      }

      if (octokitError.status === 403) {
        throw new ApiError(
          ErrorCode.FORBIDDEN,
          'GitHub rate limit exceeded or insufficient permissions.',
          HttpStatus.FORBIDDEN
        );
      }

      if (octokitError.status === 503) {
        throw new ApiError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'GitHub API is currently unavailable. Please try again later.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    }

    throw new ApiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch GitHub repositories',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
