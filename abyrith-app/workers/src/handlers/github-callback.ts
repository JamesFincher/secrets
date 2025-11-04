/**
 * GitHub OAuth Callback Handler
 *
 * POST /api/v1/github/callback
 * Handles GitHub OAuth callback, exchanges code for access token
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError, createSuccessResponse } from '../middleware/error-handler';
import { z } from 'zod';

/**
 * Request validation schema
 */
const CallbackRequestSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State token is required'),
});

interface CallbackRequest {
  code: string;
  state: string;
}

interface CallbackResponse {
  connection_id: string;
  github_username: string;
  github_user_id: number;
  scopes: string[];
  expires_at: string | null;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; scope: string; token_type: string }> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub OAuth failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data;
}

/**
 * Fetch GitHub user information
 */
async function fetchGitHubUser(accessToken: string): Promise<{
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Abyrith Secrets Manager v1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Store GitHub connection in database
 * Note: Token is returned to client for encryption, not stored here
 */
async function storeGitHubConnection(
  userId: string,
  githubUser: { id: number; login: string },
  scopes: string[],
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

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/github_connections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      organization_id: organizationId,
      user_id: userId,
      github_user_id: githubUser.id,
      github_username: githubUser.login,
      scopes: scopes,
      last_used_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to store GitHub connection: ${error}`);
  }

  const data = await response.json();
  return data[0]?.id || data.id;
}

/**
 * Main handler
 */
export async function handleGitHubCallback(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>
): Promise<Response> {
  try {
    const user = c.get('user');
    const env = c.env;

    // Validate GitHub credentials are configured
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new ApiError(
        ErrorCode.INTERNAL_ERROR,
        'GitHub integration not configured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validation = CallbackRequestSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0].message,
        HttpStatus.BAD_REQUEST,
        { errors: validation.error.errors }
      );
    }

    const request: CallbackRequest = validation.data;

    // Verify state token (CSRF protection)
    const stateKey = `github:oauth:state:${user.id}:${request.state}`;
    const storedState = await env.CACHE_KV.get(stateKey);

    if (!storedState) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid or expired state token',
        HttpStatus.BAD_REQUEST
      );
    }

    // Delete state token (one-time use)
    await env.CACHE_KV.delete(stateKey);

    // Exchange authorization code for access token
    const tokenData = await exchangeCodeForToken(
      request.code,
      env.GITHUB_CLIENT_ID,
      env.GITHUB_CLIENT_SECRET
    );

    // Fetch GitHub user information
    const githubUser = await fetchGitHubUser(tokenData.access_token);

    // Parse scopes
    const scopes = tokenData.scope.split(' ').filter(s => s.length > 0);

    // Get JWT token from Authorization header
    const authHeader = c.req.header('Authorization');
    const jwtToken = authHeader?.replace('Bearer ', '') || '';

    // Store connection metadata (without token)
    // Token will be returned to client for encryption
    const connectionId = await storeGitHubConnection(
      user.id,
      githubUser,
      scopes,
      env,
      jwtToken
    );

    // Return connection info + token (client will encrypt token)
    // Return token in response body for encryption
    return c.json({
      success: true,
      data: {
        access_token: tokenData.access_token,
        github_user: githubUser,
        scope: tokenData.scope,
        connection_id: connectionId
      }
    }, HttpStatus.CREATED);
  } catch (error) {
    console.error('GitHub callback error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    // Handle GitHub API errors
    if (error instanceof Error) {
      if (error.message.includes('OAuth')) {
        throw new ApiError(
          ErrorCode.VALIDATION_ERROR,
          error.message,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    throw new ApiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to complete GitHub connection',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
