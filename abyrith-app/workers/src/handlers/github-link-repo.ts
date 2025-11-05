/**
 * GitHub Link Repository Handler
 *
 * POST /api/v1/github/repos/link
 * Links a GitHub repository to an Abyrith project
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError, createSuccessResponse } from '../middleware/error-handler';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { createHandlerLogger } from '../utils/logger';

/**
 * Request validation schema
 */
const LinkRepoRequestSchema = z.object({
  repo_id: z.number().positive(),
  repo_owner: z.string().min(1),
  repo_name: z.string().min(1),
  repo_url: z.string().url(),
  action: z.enum(['create_project', 'link_existing']),
  project_name: z.union([z.string().min(1).max(255), z.null()]).optional(),
  project_id: z.union([z.string().uuid(), z.null()]).optional(),
  default_environment_id: z.union([z.string().uuid(), z.null()]).optional(),
  write_marker_file: z.boolean().default(true),
  sync_config: z.object({
    env_files: z.boolean(),
    github_actions: z.boolean(),
    dependencies: z.boolean(),
  }),
});

interface LinkRepoRequest {
  repo_id: number;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  action: 'create_project' | 'link_existing';
  project_name?: string | null;
  project_id?: string | null;
  default_environment_id?: string | null;
  write_marker_file: boolean;
  sync_config: {
    env_files: boolean;
    github_actions: boolean;
    dependencies: boolean;
  };
}

interface LinkRepoResponse {
  linked_repo_id: string;
  project_id: string;
  project_name: string;
  abyrith_identifier: string;
  marker_file_created: boolean;
  repo_variable_created: boolean;
}

/**
 * Create new project using database function
 * This uses the create_project_with_environments() function which:
 * - Runs with SECURITY DEFINER (elevated privileges)
 * - Handles RLS checks internally via has_role()
 * - Temporarily disables RLS after validating permissions
 * - Creates project + default environments atomically
 */
async function createProject(
  name: string,
  userId: string,
  organizationId: string,
  env: Env,
  authToken: string,
  log?: ReturnType<typeof createHandlerLogger>
): Promise<{ id: string; name: string }> {
  log?.database('RPC CALL', 'create_project_with_environments', {
    organizationId,
    name,
    userId,
  });

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/create_project_with_environments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      p_organization_id: organizationId,
      p_name: name,
      p_description: '',
      p_created_by: userId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log?.error(new Error('Create project RPC failed'), { error, status: response.status });
    throw new Error(`Failed to create project: ${error}`);
  }

  const data = await response.json();
  log?.debug('Create project RPC response', { dataLength: data?.length });

  if (!data || !Array.isArray(data) || data.length === 0) {
    log?.error(new Error('RPC did not return project data'), { data });
    throw new Error('RPC did not return project data');
  }

  log?.info('Project created via RPC', { projectId: data[0].id, projectName: data[0].name });

  return { id: data[0].id, name: data[0].name };
}

/**
 * Get existing project
 */
async function getProject(
  projectId: string,
  userId: string,
  env: Env
): Promise<{ id: string; name: string }> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch project');
  }

  const projects = await response.json();

  if (projects.length === 0) {
    throw new ApiError(
      ErrorCode.NOT_FOUND,
      `Project with ID ${projectId} not found`,
      HttpStatus.NOT_FOUND
    );
  }

  return { id: projects[0].id, name: projects[0].name };
}

/**
 * Write .abyrith marker file to repository
 */
async function writeMarkerFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  abyrithIdentifier: string
): Promise<boolean> {
  try {
    const content = `# Abyrith Secrets Manager
# This repository is linked to an Abyrith project
version: 1
abyrith_identifier: ${abyrithIdentifier}
linked_at: ${new Date().toISOString()}
`;

    const contentBase64 = Buffer.from(content).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: '.abyrith',
      message: 'Link to Abyrith Secrets Manager',
      content: contentBase64,
    });

    return true;
  } catch (error) {
    console.error('Failed to write marker file:', error);
    return false;
  }
}

/**
 * Create GitHub repository variable
 */
async function createRepoVariable(
  octokit: Octokit,
  owner: string,
  repo: string,
  organizationId: string
): Promise<boolean> {
  try {
    await octokit.actions.createRepoVariable({
      owner,
      repo,
      name: 'ABYRITH_ORG_ID',
      value: organizationId,
    });

    return true;
  } catch (error: any) {
    // If variable already exists (409), try to update it
    if (error.status === 409) {
      try {
        await octokit.actions.updateRepoVariable({
          owner,
          repo,
          name: 'ABYRITH_ORG_ID',
          value: organizationId,
        });
        return true;
      } catch (updateError) {
        console.error('Failed to update existing repo variable:', updateError);
        return false;
      }
    }

    console.error('Failed to create repo variable:', error);
    return false;
  }
}

/**
 * Store linked repository in database
 */
async function storeLinkedRepo(
  projectId: string,
  repoId: number,
  repoOwner: string,
  repoName: string,
  repoUrl: string,
  abyrithIdentifier: string,
  syncConfig: any,
  env: Env,
  token: string,
  userId: string,  // Still needed for fetching github_connection_id
  log?: ReturnType<typeof createHandlerLogger>
): Promise<string> {
  // Fetch github_connection_id for this user
  log?.database('SELECT', 'github_connections', { userId });

  const connectionResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/github_connections?user_id=eq.${userId}&select=id`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!connectionResponse.ok) {
    const error = await connectionResponse.text();
    log?.error(new Error('Failed to fetch github connection'), { error, status: connectionResponse.status });
    throw new Error(`Failed to fetch github connection: ${error}`);
  }

  const connectionData = await connectionResponse.json();
  log?.debug('GitHub connection fetched', { connectionCount: connectionData?.length });

  if (!connectionData || connectionData.length === 0) {
    log?.error(new Error('GitHub not connected'));
    throw new Error('GitHub not connected');
  }

  const githubConnectionId = connectionData[0].id;
  log?.debug('Using GitHub connection ID', { githubConnectionId });

  // Fetch user's organization
  log?.database('SELECT', 'organization_members', { userId });

  const orgResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${userId}&select=organization_id`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!orgResponse.ok) {
    const error = await orgResponse.text();
    log?.error(new Error('Failed to fetch organization membership'), { error, status: orgResponse.status });
    throw new Error(`Failed to fetch organization membership: ${error}`);
  }

  const orgData = await orgResponse.json();
  log?.debug('Organization membership fetched', { orgCount: orgData?.length });

  if (!orgData || orgData.length === 0) {
    log?.error(new Error('User not associated with an organization'));
    throw new Error('User not associated with an organization');
  }

  const organizationId = orgData[0].organization_id;
  log?.debug('Using organization ID', { organizationId });

  const insertPayload = {
    organization_id: organizationId,
    github_connection_id: githubConnectionId,
    project_id: projectId,
    github_repo_id: repoId,
    repo_owner: repoOwner,
    repo_name: repoName,
    repo_url: repoUrl,
    abyrith_project_uuid: abyrithIdentifier,  // Match database column name
    sync_sources: syncConfig,  // PostgREST handles JSONB automatically
    linked_at: new Date().toISOString(),
  };

  log?.database('INSERT', 'github_linked_repos', insertPayload);

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/github_linked_repos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(insertPayload),
  });

  log?.debug('Insert response received', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  if (!response.ok) {
    const error = await response.text();
    log?.error(new Error('Failed to store linked repo'), {
      error,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Failed to store linked repo: ${error}`);
  }

  const data = await response.json();
  log?.debug('Store linked repo response', { data });

  if (!data) {
    log?.error(new Error('No data returned from store linked repo'));
    throw new Error('No data returned from store linked repo');
  }

  // Handle both array and single object responses
  if (Array.isArray(data) && data.length > 0) {
    log?.info('Linked repo stored successfully (array response)', { id: data[0].id });
    return data[0].id;
  } else if (data.id) {
    log?.info('Linked repo stored successfully (object response)', { id: data.id });
    return data.id;
  } else {
    log?.error(new Error('Invalid response format from store linked repo'), { data });
    throw new Error('Invalid response format from store linked repo');
  }
}

/**
 * Get user's organization ID from database
 */
async function getOrganizationId(userId: string, env: Env, authToken: string): Promise<string> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${userId}&select=organization_id`,
    {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch organization membership');
  }

  const orgData = await response.json();
  if (!orgData || orgData.length === 0) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'User must belong to an organization',
      HttpStatus.BAD_REQUEST
    );
  }

  return orgData[0].organization_id;
}

/**
 * Main handler
 */
export async function handleGitHubLinkRepo(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>
): Promise<Response> {
  const log = createHandlerLogger('github-link-repo', c);

  try {
    const user = c.get('user');
    const env = c.env;

    log.start({
      userId: user.id,
      userEmail: user.email,
    });

    // Get user's auth token for database queries
    const authHeader = c.req.header('Authorization');
    const authToken = authHeader?.replace('Bearer ', '') || '';

    log.debug('Fetching organization ID for user');

    // Fetch user's organization ID from database
    const organizationId = await getOrganizationId(user.id, env, authToken);

    log.debug('Organization ID fetched', { organizationId });

    // Parse and validate request body
    const body = await c.req.json();
    log.debug('Request body received', body);

    const validation = LinkRepoRequestSchema.safeParse(body);

    if (!validation.success) {
      log.warn('Request validation failed', {
        errors: validation.error?.errors,
      });
      const errorMessage = validation.error?.errors?.[0]?.message || 'Invalid request body';
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        errorMessage,
        HttpStatus.BAD_REQUEST,
        { errors: validation.error?.errors || [] }
      );
    }

    const request: LinkRepoRequest = validation.data;
    log.info('Request validated successfully', {
      action: request.action,
      repoOwner: request.repo_owner,
      repoName: request.repo_name,
    });

    // Validate request based on action
    if (request.action === 'create_project' && !request.project_name) {
      log.warn('Validation error: project_name missing for create_project action');
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'project_name is required when action=create_project',
        HttpStatus.BAD_REQUEST
      );
    }

    if (request.action === 'link_existing' && !request.project_id) {
      log.warn('Validation error: project_id missing for link_existing action');
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'project_id is required when action=link_existing',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate at least one sync option is enabled
    const { env_files, github_actions, dependencies } = request.sync_config;
    if (!env_files && !github_actions && !dependencies) {
      log.warn('Validation error: no sync options enabled');
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'At least one sync option must be enabled',
        HttpStatus.BAD_REQUEST
      );
    }

    // Get GitHub token from request header
    const githubToken = c.req.header('X-GitHub-Token');

    if (!githubToken) {
      log.warn('Missing X-GitHub-Token header');
      throw new ApiError(
        ErrorCode.UNAUTHORIZED,
        'GitHub token required. Please provide X-GitHub-Token header.',
        HttpStatus.UNAUTHORIZED
      );
    }

    log.debug('Initializing Octokit with GitHub token');

    // Initialize Octokit
    const octokit = new Octokit({
      auth: githubToken,
      userAgent: 'Abyrith Secrets Manager v1.0',
    });

    // Verify user has write access to repository
    log.externalApi('GitHub', 'GET', `/repos/${request.repo_owner}/${request.repo_name}`, {
      purpose: 'verify repository access',
    });

    try {
      const repoResponse = await octokit.repos.get({
        owner: request.repo_owner,
        repo: request.repo_name,
      });

      log.debug('Repository access verified', {
        repoId: repoResponse.data.id,
        hasPushPermission: repoResponse.data.permissions?.push,
      });

      if (!repoResponse.data.permissions?.push) {
        log.warn('User does not have write access to repository');
        throw new ApiError(
          ErrorCode.FORBIDDEN,
          'You do not have write access to this GitHub repository',
          HttpStatus.FORBIDDEN
        );
      }
    } catch (error: any) {
      if (error.status === 404) {
        log.warn('Repository not found or no access', {
          owner: request.repo_owner,
          repo: request.repo_name,
        });
        throw new ApiError(
          ErrorCode.NOT_FOUND,
          'Repository not found or you do not have access',
          HttpStatus.NOT_FOUND
        );
      }
      log.error(error, { context: 'verify_repo_access' });
      throw error;
    }

    // Create or get project
    let project: { id: string; name: string };

    if (request.action === 'create_project') {
      log.info('Creating new project', {
        projectName: request.project_name,
        organizationId,
      });

      project = await createProject(
        request.project_name!,
        user.id,
        organizationId,
        env,
        authToken,
        log
      );

      log.info('Project created successfully', {
        projectId: project.id,
        projectName: project.name,
      });
    } else {
      log.info('Fetching existing project', {
        projectId: request.project_id,
      });

      project = await getProject(request.project_id!, user.id, env);

      log.info('Project found', {
        projectId: project.id,
        projectName: project.name,
      });
    }

    // Generate anonymous identifier for .abyrith file
    const abyrithIdentifier = crypto.randomUUID();
    log.debug('Generated Abyrith identifier', { abyrithIdentifier });

    // Write .abyrith marker file (if requested)
    let markerFileCreated = false;
    if (request.write_marker_file) {
      log.info('Writing .abyrith marker file to repository');
      markerFileCreated = await writeMarkerFile(
        octokit,
        request.repo_owner,
        request.repo_name,
        abyrithIdentifier
      );
      log.info('Marker file write result', { markerFileCreated });
    } else {
      log.debug('Skipping marker file creation (write_marker_file=false)');
    }

    // Create GitHub repository variable
    log.info('Creating ABYRITH_ORG_ID repository variable');
    const repoVariableCreated = await createRepoVariable(
      octokit,
      request.repo_owner,
      request.repo_name,
      organizationId
    );
    log.info('Repository variable creation result', { repoVariableCreated });

    // Store linked repository in database
    log.info('Storing linked repository in database');
    const linkedRepoId = await storeLinkedRepo(
      project.id,
      request.repo_id,
      request.repo_owner,
      request.repo_name,
      request.repo_url,
      abyrithIdentifier,
      request.sync_config,
      env,
      authToken,
      user.id,  // userId for fetching github_connection_id
      log
    );
    log.info('Linked repository stored', { linkedRepoId });

    const response: LinkRepoResponse = {
      linked_repo_id: linkedRepoId,
      project_id: project.id,
      project_name: project.name,
      abyrith_identifier: abyrithIdentifier,
      marker_file_created: markerFileCreated,
      repo_variable_created: repoVariableCreated,
    };

    log.success(response);

    return c.json(createSuccessResponse(response), HttpStatus.CREATED);
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
      'Failed to link GitHub repository',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
