/**
 * GitHub OAuth Connect Handler
 *
 * POST /api/v1/github/connect
 * Initiates the GitHub OAuth flow by generating authorization URL
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError, createSuccessResponse } from '../middleware/error-handler';
import { z } from 'zod';

/**
 * Request validation schema
 */
const ConnectRequestSchema = z.object({
  redirect_uri: z.string().url().refine(
    (url) => url.startsWith('https://'),
    { message: 'redirect_uri must use HTTPS' }
  ),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
});

interface ConnectRequest {
  redirect_uri: string;
  scopes: string[];
}

interface ConnectResponse {
  oauth_url: string;
  state: string;
}

/**
 * Generate random state token for CSRF protection
 */
function generateStateToken(): string {
  return crypto.randomUUID();
}

/**
 * Build GitHub OAuth authorization URL
 */
function buildOAuthUrl(clientId: string, redirectUri: string, scopes: string[], state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state: state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Main handler
 */
export async function handleGitHubConnect(
  c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>
): Promise<Response> {
  try {
    const user = c.get('user');
    const env = c.env;

    // Validate GitHub client ID is configured
    if (!env.GITHUB_CLIENT_ID) {
      throw new ApiError(
        ErrorCode.INTERNAL_ERROR,
        'GitHub integration not configured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validation = ConnectRequestSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0].message,
        HttpStatus.BAD_REQUEST,
        { errors: validation.error.errors }
      );
    }

    const request: ConnectRequest = validation.data;

    // Generate state token for CSRF protection
    const state = generateStateToken();

    // Store state token in KV with 5-minute expiry (300 seconds)
    const stateKey = `github:oauth:state:${user.id}:${state}`;
    await env.CACHE_KV.put(stateKey, JSON.stringify({
      user_id: user.id,
      redirect_uri: request.redirect_uri,
      created_at: new Date().toISOString(),
    }), {
      expirationTtl: 300, // 5 minutes
    });

    // Build OAuth URL
    const oauthUrl = buildOAuthUrl(
      env.GITHUB_CLIENT_ID,
      request.redirect_uri,
      request.scopes,
      state
    );

    const response: ConnectResponse = {
      oauth_url: oauthUrl,
      state: state,
    };

    return c.json(createSuccessResponse(response), HttpStatus.OK);
  } catch (error) {
    console.error('GitHub connect error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to initiate GitHub connection',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
