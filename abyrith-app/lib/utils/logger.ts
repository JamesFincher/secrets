/**
 * Logging Utility for Frontend
 *
 * Provides structured logging with automatic context enrichment.
 * Uses pino for structured logs that can be easily parsed and analyzed.
 */

import pino from 'pino';

// Determine if we're in the browser
const isBrowser = typeof window !== 'undefined';

// Create base logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  browser: isBrowser ? {
    asObject: false, // Changed to false for better console output
    serialize: true,
    write: {
      debug: (obj) => {
        const msg = typeof obj === 'string' ? obj : obj.msg || '';
        const data = typeof obj === 'object' && obj !== null ? { ...obj, msg: undefined } : {};
        console.debug(`[DEBUG] ${msg}`, data);
      },
      info: (obj) => {
        const msg = typeof obj === 'string' ? obj : obj.msg || '';
        const data = typeof obj === 'object' && obj !== null ? { ...obj, msg: undefined } : {};
        console.info(`[INFO] ${msg}`, data);
      },
      warn: (obj) => {
        const msg = typeof obj === 'string' ? obj : obj.msg || '';
        const data = typeof obj === 'object' && obj !== null ? { ...obj, msg: undefined } : {};
        console.warn(`[WARN] ${msg}`, data);
      },
      error: (obj) => {
        const msg = typeof obj === 'string' ? obj : obj.msg || '';
        const data = typeof obj === 'object' && obj !== null ? { ...obj, msg: undefined } : {};
        console.error(`[ERROR] ${msg}`, data);
      },
    }
  } : undefined,
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
      environment: process.env.NODE_ENV,
      userAgent: isBrowser ? navigator.userAgent : undefined,
    }
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger({ module: 'app' });

/**
 * Create an API call logger with automatic request/response logging
 *
 * @param module - Module name (e.g., 'github-api', 'secrets-api')
 * @returns Object with helper methods for logging API calls
 */
export function createApiLogger(module: string) {
  const log = createLogger({ module, type: 'api' });

  return {
    /**
     * Log the start of an API request
     */
    request: (method: string, url: string, data?: any) => {
      log.info({
        event: 'api.request',
        method,
        url,
        hasBody: !!data,
        bodyPreview: data ? JSON.stringify(data).substring(0, 100) : undefined,
      }, `${method} ${url}`);
    },

    /**
     * Log successful API response
     */
    success: (method: string, url: string, status: number, data?: any) => {
      log.info({
        event: 'api.success',
        method,
        url,
        status,
        hasData: !!data,
      }, `${method} ${url} - ${status}`);
    },

    /**
     * Log API error
     */
    error: (method: string, url: string, error: any) => {
      log.error({
        event: 'api.error',
        method,
        url,
        error: {
          message: error.message,
          status: error.status,
          code: error.code,
          stack: error.stack,
        },
      }, `${method} ${url} failed: ${error.message}`);
    },

    /**
     * Log general info
     */
    info: (message: string, data?: any) => {
      log.info({ ...data }, message);
    },

    /**
     * Log debug info
     */
    debug: (message: string, data?: any) => {
      log.debug({ ...data }, message);
    },

    /**
     * Log warning
     */
    warn: (message: string, data?: any) => {
      log.warn({ ...data }, message);
    },
  };
}

/**
 * Log uncaught errors
 */
if (isBrowser) {
  window.addEventListener('error', (event) => {
    logger.error({
      event: 'uncaught.error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    }, 'Uncaught error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error({
      event: 'unhandled.rejection',
      reason: event.reason,
    }, 'Unhandled promise rejection');
  });
}

export default logger;
