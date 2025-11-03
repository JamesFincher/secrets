/**
 * Rate Limiting Middleware
 *
 * KV-based rate limiting with configurable windows and limits
 */

import { MiddlewareHandler } from 'hono';
import { Env, RateLimitConfig, ErrorCode, HttpStatus } from '../types/api';
import { incrementRateLimit, generateRateLimitKey } from '../lib/kv';

/**
 * Default rate limit configurations by endpoint type
 */
export const RateLimitPresets = {
  // Strict limits for expensive operations
  AI_CHAT: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
  DOCUMENTATION_SCRAPE: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 requests per minute

  // Moderate limits for standard API operations
  API_WRITE: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 requests per minute
  API_READ: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute

  // Relaxed limits for health checks and public endpoints
  HEALTH: { windowMs: 60 * 1000, maxRequests: 1000 }, // 1000 requests per minute
} as const;

/**
 * Get identifier for rate limiting
 *
 * Uses user ID if authenticated, otherwise IP address
 */
function getIdentifier(c: any): string {
  // Try to get user from context (set by auth middleware)
  const user = c.get('user');
  if (user?.id) {
    return `user:${user.id}`;
  }

  // Fall back to IP address
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limiting middleware with custom config
 */
export function createRateLimiter(
  config: RateLimitConfig
): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const identifier = getIdentifier(c);
    const endpoint = c.req.path;
    const key = generateRateLimitKey(identifier, endpoint);

    try {
      const result = await incrementRateLimit(
        c.env.RATE_LIMIT_KV,
        key,
        config.windowMs
      );

      // Add rate limit headers to response
      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - result.count).toString());
      c.header('X-RateLimit-Reset', result.resetAt.toString());

      // Check if limit exceeded
      if (result.count > config.maxRequests) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

        return c.json(
          {
            success: false,
            error: {
              code: ErrorCode.RATE_LIMIT_EXCEEDED,
              message: 'Rate limit exceeded. Please try again later.',
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              details: {
                limit: config.maxRequests,
                windowMs: config.windowMs,
                retryAfter,
              },
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
          {
            'Retry-After': retryAfter.toString(),
          }
        );
      }

      await next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If rate limiting fails, allow the request (fail open)
      // In production, you might want to fail closed instead
      await next();
    }
  };
}

/**
 * Rate limiter for AI chat endpoints
 */
export const aiChatRateLimiter = createRateLimiter(RateLimitPresets.AI_CHAT);

/**
 * Rate limiter for documentation scraping
 */
export const scrapeRateLimiter = createRateLimiter(RateLimitPresets.DOCUMENTATION_SCRAPE);

/**
 * Rate limiter for write operations
 */
export const writeRateLimiter = createRateLimiter(RateLimitPresets.API_WRITE);

/**
 * Rate limiter for read operations
 */
export const readRateLimiter = createRateLimiter(RateLimitPresets.API_READ);

/**
 * Rate limiter for health checks
 */
export const healthRateLimiter = createRateLimiter(RateLimitPresets.HEALTH);
