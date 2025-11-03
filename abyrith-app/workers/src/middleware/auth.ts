/**
 * Authentication Middleware
 *
 * Validates JWT tokens and attaches user to request context
 */

import { MiddlewareHandler } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { extractToken, validateJWT, getUserId, getUserEmail, getOrganizationId } from '../lib/jwt';

/**
 * Authentication middleware
 *
 * Validates JWT from Authorization header and attaches user to context.
 * Returns 401 if token is missing, invalid, or expired.
 */
export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: { user: AuthUser } }> = async (c, next) => {
  const authHeader = c.req.header('Authorization') || null;
  const token = extractToken(authHeader);

  if (!token) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Missing authorization token',
          statusCode: HttpStatus.UNAUTHORIZED,
        },
      },
      HttpStatus.UNAUTHORIZED
    );
  }

  const jwtSecret = c.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error('SUPABASE_JWT_SECRET not configured');
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Authentication service unavailable',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  const result = await validateJWT(token, jwtSecret);

  if (!result.valid || !result.payload) {
    const errorCode = result.error?.includes('expired')
      ? ErrorCode.TOKEN_EXPIRED
      : ErrorCode.INVALID_TOKEN;

    return c.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: result.error || 'Invalid token',
          statusCode: HttpStatus.UNAUTHORIZED,
        },
      },
      HttpStatus.UNAUTHORIZED
    );
  }

  // Attach user to context
  const user: AuthUser = {
    id: getUserId(result.payload),
    email: getUserEmail(result.payload),
    role: result.payload.role,
    organizationId: getOrganizationId(result.payload),
  };

  c.set('user', user);

  await next();
};

/**
 * Optional authentication middleware
 *
 * Validates JWT if present, but allows request to continue without auth.
 * Useful for endpoints that have different behavior for authenticated users.
 */
export const optionalAuthMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: { user?: AuthUser } }> = async (c, next) => {
  const authHeader = c.req.header('Authorization') || null;
  const token = extractToken(authHeader);

  if (token) {
    const jwtSecret = c.env.SUPABASE_JWT_SECRET;
    if (jwtSecret) {
      const result = await validateJWT(token, jwtSecret);

      if (result.valid && result.payload) {
        const user: AuthUser = {
          id: getUserId(result.payload),
          email: getUserEmail(result.payload),
          role: result.payload.role,
          organizationId: getOrganizationId(result.payload),
        };

        c.set('user', user);
      }
    }
  }

  await next();
};
