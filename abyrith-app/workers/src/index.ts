/**
 * Abyrith API Gateway - Cloudflare Worker
 *
 * Main entry point for all API requests.
 * Handles routing, authentication, rate limiting, and request orchestration.
 */

export interface Env {
  // KV Namespaces
  RATE_LIMIT_KV: KVNamespace;
  CACHE_KV: KVNamespace;

  // Environment variables (set via wrangler secret)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CLAUDE_API_KEY: string;
  FIRECRAWL_API_KEY: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // API routing (placeholder - will implement routes)
    if (url.pathname.startsWith('/api/v1/')) {
      // TODO: Implement API gateway routing
      // - JWT validation
      // - Rate limiting
      // - Route to Supabase/Claude/FireCrawl

      return new Response(JSON.stringify({
        message: 'API Gateway - Coming Soon',
        path: url.pathname
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
