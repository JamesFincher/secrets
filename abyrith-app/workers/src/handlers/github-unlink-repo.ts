/**
 * GitHub Unlink Repository Handler
 *
 * POST /api/v1/github/repos/:repo_id/unlink
 * Unlinks a GitHub repository from an Abyrith project
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError, createSuccessResponse } from '../middleware/error-handler';
import { Octokit } from '@octokit/rest';
import { createHandlerLogger } from '../utils/logger';

interface UnlinkRepoResponse {
  success: boolean;
  linked_repo_id: string;
  marker_file_deleted: boolean;
  repo_variable_deleted: boolean;
}

/**
 * Delete .abyrith marker file from repository
 */
async function deleteMarkerFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  log?: ReturnType<typeof createHandlerLogger>
): Promise<boolean> {
  try {
    log?.debug('Attempting to delete .abyrith marker file');

    // First, get the file to obtain its SHA
    const fileResponse = await octokit.repos.getContent({
      owner,
      repo,
      path: '.abyrith',
    });

    if ('sha' in fileResponse.data) {
      await octokit.repos.deleteFile({
        owner,
        repo,
        path: '.abyrith',
        message: 'Unlink from Abyrith Secrets Manager',
        sha: fileResponse.data.sha,
      });

      log?.info('.abyrith marker file deleted successfully');
      return true;
    }

    log?.warn('.abyrith file found but no SHA available');
    return false;
  } catch (error: any) {
    if (error.status === 404) {
      log?.debug('.abyrith marker file not found (may have been deleted already)');
      return false;
    }
    log?.error(error, { context: 'delete_marker_file' });
    return false;
  }
}

/**
 * Delete GitHub repository variable
 */
async function deleteRepoVariable(
  octokit: Octokit,
  owner: string,
  repo: string,
  log?: ReturnType<typeof createHandlerLogger>
): Promise<boolean> {
  try {
    log?.debug('Attempting to delete ABYRITH_ORG_ID repository variable');

    await octokit.actions.deleteRepoVariable({
      owner,
      repo,
      name: 'ABYRITH_ORG_ID',
    });

    log?.info('ABYRITH_ORG_ID repository variable deleted successfully');
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      log?.debug('ABYRITH_ORG_ID variable not found (may have been deleted already)');
      return false;
    }
    log?.error(error, { context: 'delete_repo_variable' });
    return false;
  }
}

/**
 * Delete linked repository from database
 */
async function deleteLinkedRepo(
  linkedRepoId: string,
  userId: string,
  env: Env,
  authToken: string,
  log?: ReturnType<typeof createHandlerLogger>
): Promise<void> {
  log?.database('DELETE', 'github_linked_repos', { linkedRepoId, userId });

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/github_linked_repos?id=eq.${linkedRepoId}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    log?.error(new Error('Failed to delete linked repo'), {
      error,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Failed to delete linked repo: ${error}`);
  }

  log?.info('Linked repository deleted from database', { linkedRepoId });
}

/**
 * Get linked repository details
 */
async function getLinkedRepo(
  linkedRepoId: string,
  userId: string,
  env: Env,
  authToken: string,
  log?: ReturnType<typeof createHandlerLogger>
): Promise<{ repo_owner: string; repo_name: string; organization_id: string } | null> {
  log?.database('SELECT', 'github_linked_repos', { linkedRepoId });

  // First, get user's organization
  const orgResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${userId}&select=organization_id`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );

  if (!orgResponse.ok) {
    const error = await orgResponse.text();
    log?.error(new Error('Failed to fetch organization membership'), { error });
    throw new Error(`Failed to fetch organization membership: ${error}`);
  }

  const orgData = await orgResponse.json();
  if (!orgData || orgData.length === 0) {
    throw new ApiError(
      ErrorCode.FORBIDDEN,
      'User not associated with an organization',
      HttpStatus.FORBIDDEN
    );
  }

  const organizationId = orgData[0].organization_id;

  // Now get the linked repo
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/github_linked_repos?id=eq.${linkedRepoId}&organization_id=eq.${organizationId}`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    log?.error(new Error('Failed to fetch linked repo'), { error });
    throw new Error(`Failed to fetch linked repo: ${error}`);
  }

  const data = await response.json();

  if (!data || data.length === 0) {
    log?.warn('Linked repository not found', { linkedRepoId, organizationId });
    return null;
  }

  log?.debug('Linked repository found', {
    linkedRepoId,
    repoOwner: data[0].repo_owner,
    repoName: data[0].repo_name,
  });

  return {
    repo_owner: data[0].repo_owner,
    repo_name: data[0].repo_name,
    organization_id: organizationId,
  };
}

/**
 * Main handler
 */
export async function handleGitHubUnlinkRepo(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>
): Promise<Response> {
  const log = createHandlerLogger('github-unlink-repo', c);

  try {
    const user = c.get('user');
    const env = c.env;
    const linkedRepoId = c.req.param('repo_id');

    log.start({
      userId: user.id,
      userEmail: user.email,
      linkedRepoId,
    });

    if (!linkedRepoId) {
      log.warn('Missing repo_id parameter');
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Repository ID is required',
        HttpStatus.BAD_REQUEST
      );
    }

    // Get user's auth token for database queries
    const authHeader = c.req.header('Authorization');
    const authToken = authHeader?.replace('Bearer ', '') || '';

    // Get linked repository details
    log.debug('Fetching linked repository details');
    const linkedRepo = await getLinkedRepo(linkedRepoId, user.id, env, authToken, log);

    if (!linkedRepo) {
      log.warn('Linked repository not found or access denied', { linkedRepoId });
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Linked repository not found or you do not have access',
        HttpStatus.NOT_FOUND
      );
    }

    log.info('Linked repository found', {
      repoOwner: linkedRepo.repo_owner,
      repoName: linkedRepo.repo_name,
    });

    // Get GitHub token from request header (optional for cleanup)
    const githubToken = c.req.header('X-GitHub-Token');
    let markerFileDeleted = false;
    let repoVariableDeleted = false;

    if (githubToken) {
      log.debug('GitHub token provided, will attempt to clean up repository files');

      // Initialize Octokit
      const octokit = new Octokit({
        auth: githubToken,
        userAgent: 'Abyrith Secrets Manager v1.0',
      });

      // Try to delete marker file and repo variable (best effort)
      markerFileDeleted = await deleteMarkerFile(
        octokit,
        linkedRepo.repo_owner,
        linkedRepo.repo_name,
        log
      );

      repoVariableDeleted = await deleteRepoVariable(
        octokit,
        linkedRepo.repo_owner,
        linkedRepo.repo_name,
        log
      );
    } else {
      log.debug('No GitHub token provided, skipping repository cleanup');
    }

    // Delete linked repository from database
    log.info('Deleting linked repository from database');
    await deleteLinkedRepo(linkedRepoId, user.id, env, authToken, log);

    const response: UnlinkRepoResponse = {
      success: true,
      linked_repo_id: linkedRepoId,
      marker_file_deleted: markerFileDeleted,
      repo_variable_deleted: repoVariableDeleted,
    };

    log.success(response);

    return c.json(createSuccessResponse(response), HttpStatus.OK);
  } catch (error: any) {
    log.error(error, {
      errorName: error.name,
      errorCode: error.code,
      errorStatus: error.status,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to unlink GitHub repository',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
