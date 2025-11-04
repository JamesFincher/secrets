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

/**
 * Request validation schema
 */
const LinkRepoRequestSchema = z.object({
  repo_id: z.number().positive(),
  repo_owner: z.string().min(1),
  repo_name: z.string().min(1),
  repo_url: z.string().url(),
  action: z.enum(['create_project', 'link_existing']),
  project_name: z.string().min(1).max(255).optional(),
  project_id: z.string().uuid().optional(),
  default_environment_id: z.string().uuid().optional(),
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
  project_name?: string;
  project_id?: string;
  default_environment_id?: string;
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
 * Create new project
 */
async function createProject(
  name: string,
  userId: string,
  organizationId: string,
  env: Env
): Promise<{ id: string; name: string }> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      name,
      organization_id: organizationId,
      created_by: userId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create project: ${error}`);
  }

  const data = await response.json();
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
  } catch (error) {
    console.error('Failed to create repo variable:', error);
    return false;
  }
}

/**
 * Store linked repository in database
 */
async function storeLinkedRepo(
  userId: string,
  projectId: string,
  repoId: number,
  repoOwner: string,
  repoName: string,
  repoUrl: string,
  abyrithIdentifier: string,
  syncConfig: any,
  env: Env
): Promise<string> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/github_linked_repos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      project_id: projectId,
      repo_id: repoId,
      repo_owner: repoOwner,
      repo_name: repoName,
      repo_url: repoUrl,
      abyrith_identifier: abyrithIdentifier,
      sync_env_files: syncConfig.env_files,
      sync_github_actions: syncConfig.github_actions,
      sync_dependencies: syncConfig.dependencies,
      linked_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to store linked repo: ${error}`);
  }

  const data = await response.json();
  return data[0]?.id || data.id;
}

/**
 * Main handler
 */
export async function handleGitHubLinkRepo(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>
): Promise<Response> {
  try {
    const user = c.get('user');
    const env = c.env;

    // Validate user has organization
    if (!user.organizationId) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'User must belong to an organization',
        HttpStatus.BAD_REQUEST
      );
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validation = LinkRepoRequestSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0].message,
        HttpStatus.BAD_REQUEST,
        { errors: validation.error.errors }
      );
    }

    const request: LinkRepoRequest = validation.data;

    // Validate request based on action
    if (request.action === 'create_project' && !request.project_name) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'project_name is required when action=create_project',
        HttpStatus.BAD_REQUEST
      );
    }

    if (request.action === 'link_existing' && !request.project_id) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'project_id is required when action=link_existing',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate at least one sync option is enabled
    const { env_files, github_actions, dependencies } = request.sync_config;
    if (!env_files && !github_actions && !dependencies) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'At least one sync option must be enabled',
        HttpStatus.BAD_REQUEST
      );
    }

    // Get GitHub token from request header
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

    // Verify user has write access to repository
    try {
      const repoResponse = await octokit.repos.get({
        owner: request.repo_owner,
        repo: request.repo_name,
      });

      if (!repoResponse.data.permissions?.push) {
        throw new ApiError(
          ErrorCode.FORBIDDEN,
          'You do not have write access to this GitHub repository',
          HttpStatus.FORBIDDEN
        );
      }
    } catch (error: any) {
      if (error.status === 404) {
        throw new ApiError(
          ErrorCode.NOT_FOUND,
          'Repository not found or you do not have access',
          HttpStatus.NOT_FOUND
        );
      }
      throw error;
    }

    // Create or get project
    let project: { id: string; name: string };

    if (request.action === 'create_project') {
      project = await createProject(
        request.project_name!,
        user.id,
        user.organizationId,
        env
      );
    } else {
      project = await getProject(request.project_id!, user.id, env);
    }

    // Generate anonymous identifier for .abyrith file
    const abyrithIdentifier = crypto.randomUUID();

    // Write .abyrith marker file (if requested)
    let markerFileCreated = false;
    if (request.write_marker_file) {
      markerFileCreated = await writeMarkerFile(
        octokit,
        request.repo_owner,
        request.repo_name,
        abyrithIdentifier
      );
    }

    // Create GitHub repository variable
    const repoVariableCreated = await createRepoVariable(
      octokit,
      request.repo_owner,
      request.repo_name,
      user.organizationId
    );

    // Store linked repository in database
    const linkedRepoId = await storeLinkedRepo(
      user.id,
      project.id,
      request.repo_id,
      request.repo_owner,
      request.repo_name,
      request.repo_url,
      abyrithIdentifier,
      request.sync_config,
      env
    );

    const response: LinkRepoResponse = {
      linked_repo_id: linkedRepoId,
      project_id: project.id,
      project_name: project.name,
      abyrith_identifier: abyrithIdentifier,
      marker_file_created: markerFileCreated,
      repo_variable_created: repoVariableCreated,
    };

    return c.json(createSuccessResponse(response), HttpStatus.CREATED);
  } catch (error) {
    console.error('GitHub link repo error:', error);

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
