/**
 * Abyrith API Gateway - Cloudflare Worker
 *
 * Main entry point for all API requests.
 * Handles routing, authentication, rate limiting, and request orchestration.
 */

import { Hono } from 'hono';
import { Env } from './types/api';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, createSuccessResponse } from './middleware/error-handler';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import {
  healthRateLimiter,
  readRateLimiter,
  writeRateLimiter,
  aiChatRateLimiter,
  scrapeRateLimiter,
} from './middleware/rate-limit';
import { handleScrape } from './handlers/scrape';
import { handleAiChat } from './handlers/ai-chat';

/**
 * Initialize Hono app with environment bindings
 */
const app = new Hono<{ Bindings: Env }>();

/**
 * Global middleware
 */

// CORS - must be first to handle preflight requests
app.use('*', corsMiddleware);

// Error handler
app.onError(errorHandler);

/**
 * Health check endpoint
 */
app.get('/health', healthRateLimiter, (c) => {
  return c.json(
    createSuccessResponse({
      status: 'ok',
      environment: c.env.ENVIRONMENT || 'unknown',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  );
});

/**
 * API v1 Routes
 */
const api = new Hono<{ Bindings: Env }>();

/**
 * Public endpoints (no auth required)
 */
api.get('/public/status', readRateLimiter, (c) => {
  return c.json(
    createSuccessResponse({
      api: 'Abyrith API Gateway',
      version: 'v1',
      status: 'operational',
    })
  );
});

/**
 * Protected endpoints (auth required)
 * These are placeholders for the actual implementation
 */

// Secrets endpoints (matching /05-api/endpoints/secrets-endpoints.md)
// POST /secrets - Create new secret
api.post('/secrets', authMiddleware, writeRateLimiter, (c) => {
  const user = c.get('user');
  return c.json(
    createSuccessResponse({
      message: 'Create secret endpoint - Coming soon',
      user: { id: user.id, email: user.email },
    })
  );
});

// GET /secrets/:id - Get secret by ID
api.get('/secrets/:id', authMiddleware, readRateLimiter, (c) => {
  const user = c.get('user');
  const secretId = c.req.param('id');
  return c.json(
    createSuccessResponse({
      message: 'Get secret by ID - Coming soon',
      secretId,
      user: { id: user.id, email: user.email },
    })
  );
});

// GET /projects/:project_id/secrets - List all secrets in project
api.get('/projects/:project_id/secrets', authMiddleware, readRateLimiter, (c) => {
  const user = c.get('user');
  const projectId = c.req.param('project_id');
  return c.json(
    createSuccessResponse({
      message: 'List secrets in project - Coming soon',
      projectId,
      user: { id: user.id, email: user.email },
    })
  );
});

// PUT /secrets/:id - Update secret
api.put('/secrets/:id', authMiddleware, writeRateLimiter, (c) => {
  const user = c.get('user');
  const secretId = c.req.param('id');
  return c.json(
    createSuccessResponse({
      message: 'Update secret - Coming soon',
      secretId,
      user: { id: user.id, email: user.email },
    })
  );
});

// DELETE /secrets/:id - Delete secret
api.delete('/secrets/:id', authMiddleware, writeRateLimiter, (c) => {
  const user = c.get('user');
  const secretId = c.req.param('id');
  return c.json(
    createSuccessResponse({
      message: 'Delete secret - Coming soon',
      secretId,
      user: { id: user.id, email: user.email },
    })
  );
});

// Projects endpoints
api.get('/projects', authMiddleware, readRateLimiter, (c) => {
  const user = c.get('user');
  return c.json(
    createSuccessResponse({
      message: 'Projects endpoint - Coming soon',
      user: { id: user.id, email: user.email },
    })
  );
});

api.post('/projects', authMiddleware, writeRateLimiter, (c) => {
  const user = c.get('user');
  return c.json(
    createSuccessResponse({
      message: 'Create project endpoint - Coming soon',
      user: { id: user.id, email: user.email },
    })
  );
});

// AI Chat endpoints (higher rate limit)
api.post('/ai/chat', authMiddleware, aiChatRateLimiter, handleAiChat);

// Documentation scraping endpoints
api.post('/scrape', authMiddleware, scrapeRateLimiter, async (c) => {
  // Convert Hono context to standard Request/Response
  const request = c.req.raw;
  const env = c.env as any; // Cast to our Env type

  return handleScrape(request, env);
});

// Audit logs endpoints
api.get('/audit-logs', authMiddleware, readRateLimiter, (c) => {
  const user = c.get('user');
  return c.json(
    createSuccessResponse({
      message: 'Audit logs endpoint - Coming soon',
      user: { id: user.id, email: user.email },
    })
  );
});

/**
 * Mount API routes under /api/v1
 */
app.route('/api/v1', api);

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        statusCode: 404,
      },
    },
    404
  );
});

/**
 * Export worker
 */
export default app;
