/**
 * Logging Utility for Cloudflare Workers
 *
 * Provides structured logging with automatic context enrichment.
 * Uses pino for structured logs that can be easily parsed and analyzed.
 */

import pino from 'pino';
import type { Context } from 'hono';

// Create base logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: 'debug', // Always debug in workers, can filter in production
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

// Create base logger
const baseLogger = pino(loggerConfig);

/**
 * Create a child logger with specific context
 *
 * @param context - Context object to attach to all logs from this logger
 * @returns Child logger instance
 */
export function createLogger(context: Record<string, any> = {}) {
  return baseLogger.child({
    context: {
      ...context,
      worker: 'abyrith-api',
    }
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger({ module: 'worker' });

/**
 * Create a request-specific logger from Hono context
 *
 * @param c - Hono context
 * @returns Logger with request context
 */
export function createRequestLogger(c: Context) {
  const requestId = crypto.randomUUID();

  return createLogger({
    request: {
      id: requestId,
      method: c.req.method,
      url: c.req.url,
      path: c.req.path,
      headers: {
        'user-agent': c.req.header('user-agent'),
        'content-type': c.req.header('content-type'),
      },
    }
  });
}

/**
 * Create an API handler logger with automatic request/response logging
 *
 * @param handler - Handler name (e.g., 'github-link-repo', 'secrets-create')
 * @param c - Hono context
 * @returns Object with helper methods for logging
 */
export function createHandlerLogger(handler: string, c: Context) {
  const log = createRequestLogger(c).child({ handler });

  return {
    /**
     * Log handler start
     */
    start: (data?: any) => {
      log.info({
        event: 'handler.start',
        ...data,
      }, `[${handler}] Handler started`);
    },

    /**
     * Log successful completion
     */
    success: (data?: any) => {
      log.info({
        event: 'handler.success',
        ...data,
      }, `[${handler}] Handler completed successfully`);
    },

    /**
     * Log handler error
     */
    error: (error: any, data?: any) => {
      log.error({
        event: 'handler.error',
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
          status: error.status,
          stack: error.stack,
        },
        ...data,
      }, `[${handler}] Handler error: ${error.message}`);
    },

    /**
     * Log info
     */
    info: (message: string, data?: any) => {
      log.info({ ...data }, `[${handler}] ${message}`);
    },

    /**
     * Log debug info
     */
    debug: (message: string, data?: any) => {
      log.debug({ ...data }, `[${handler}] ${message}`);
    },

    /**
     * Log warning
     */
    warn: (message: string, data?: any) => {
      log.warn({ ...data }, `[${handler}] ${message}`);
    },

    /**
     * Log database operation
     */
    database: (operation: string, table: string, data?: any) => {
      log.debug({
        event: 'database.operation',
        operation,
        table,
        ...data,
      }, `[${handler}] DB ${operation} on ${table}`);
    },

    /**
     * Log external API call
     */
    externalApi: (service: string, method: string, endpoint: string, data?: any) => {
      log.debug({
        event: 'external.api',
        service,
        method,
        endpoint,
        ...data,
      }, `[${handler}] External API: ${method} ${service}${endpoint}`);
    },
  };
}

/**
 * Middleware to add request logging to Hono app
 */
export function requestLoggingMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const startTime = Date.now();
    const log = createRequestLogger(c);

    log.info({
      event: 'request.start',
    }, `${c.req.method} ${c.req.path}`);

    try {
      await next();

      const duration = Date.now() - startTime;
      log.info({
        event: 'request.complete',
        status: c.res.status,
        duration,
      }, `${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      log.error({
        event: 'request.error',
        status: 500,
        duration,
        error: {
          message: error.message,
          stack: error.stack,
        },
      }, `${c.req.method} ${c.req.path} - Error (${duration}ms): ${error.message}`);
      throw error;
    }
  };
}

export default logger;
