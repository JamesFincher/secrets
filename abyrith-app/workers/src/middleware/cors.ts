/**
 * CORS Middleware
 *
 * Handles Cross-Origin Resource Sharing headers
 */

import { MiddlewareHandler } from 'hono';
import { Env } from '../types/api';

/**
 * CORS configuration
 */
interface CorsConfig {
  origin: string | string[] | ((origin: string) => boolean);
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

/**
 * Default CORS configuration
 */
const defaultConfig: CorsConfig = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-GitHub-Token',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // 24 hours
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, allowedOrigin: string | string[] | ((origin: string) => boolean)): boolean {
  if (typeof allowedOrigin === 'string') {
    return allowedOrigin === '*' || allowedOrigin === origin;
  }

  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(origin);
  }

  if (typeof allowedOrigin === 'function') {
    return allowedOrigin(origin);
  }

  return false;
}

/**
 * Create CORS middleware
 */
export function createCorsMiddleware(config: Partial<CorsConfig> = {}): MiddlewareHandler<{ Bindings: Env }> {
  const finalConfig = { ...defaultConfig, ...config };

  return async (c, next) => {
    const origin = c.req.header('Origin') || '';

    // Determine allowed origin
    let allowedOrigin = '*';
    if (origin) {
      if (isOriginAllowed(origin, finalConfig.origin)) {
        allowedOrigin = origin;
      } else if (typeof finalConfig.origin === 'string' && finalConfig.origin !== '*') {
        allowedOrigin = finalConfig.origin;
      }
    }

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': finalConfig.methods?.join(', ') || '',
        'Access-Control-Allow-Headers': finalConfig.allowedHeaders?.join(', ') || '',
        'Access-Control-Max-Age': (finalConfig.maxAge || 0).toString(),
      };

      if (finalConfig.credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      if (finalConfig.exposedHeaders && finalConfig.exposedHeaders.length > 0) {
        headers['Access-Control-Expose-Headers'] = finalConfig.exposedHeaders.join(', ');
      }

      return new Response(null, { status: 204, headers });
    }

    // Add CORS headers to all responses
    await next();

    c.header('Access-Control-Allow-Origin', allowedOrigin);

    if (finalConfig.credentials) {
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    if (finalConfig.exposedHeaders && finalConfig.exposedHeaders.length > 0) {
      c.header('Access-Control-Expose-Headers', finalConfig.exposedHeaders.join(', '));
    }

    // Vary header for caching
    c.header('Vary', 'Origin');
  };
}

/**
 * CORS middleware with environment-aware origins
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:3000';
  const environment = c.env.ENVIRONMENT || 'development';

  // Allow all origins in development, specific origins in production
  const allowedOrigins = environment === 'development'
    ? '*'
    : [frontendUrl, 'https://abyrith.com', 'https://www.abyrith.com'];

  const corsHandler = createCorsMiddleware({
    origin: allowedOrigins,
    credentials: true,
  });

  return corsHandler(c, next);
};
