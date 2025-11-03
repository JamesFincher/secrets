/**
 * Error Handler Middleware
 *
 * Unified error handling and response formatting
 */

import { MiddlewareHandler, ErrorHandler } from 'hono';
import { Env, ApiResponse, ErrorCode, HttpStatus } from '../types/api';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Map error codes to HTTP status codes
 */
function getStatusCodeFromErrorCode(code: ErrorCode): number {
  const mapping: Record<ErrorCode, number> = {
    [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
    [ErrorCode.INVALID_TOKEN]: HttpStatus.UNAUTHORIZED,
    [ErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,
    [ErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
    [ErrorCode.INVALID_INPUT]: HttpStatus.BAD_REQUEST,
    [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
    [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
    [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
    [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  };

  return mapping[code] || HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Error handler middleware
 *
 * Catches errors and returns consistent error responses
 */
export const errorHandler: ErrorHandler = (err, c) => {
  console.error('Error:', err);

  // Handle ApiError instances
  if (err instanceof ApiError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return c.json(response, err.statusCode as any);
  }

  // Handle validation errors (from Zod)
  if (err.name === 'ZodError') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          errors: (err as any).errors || [],
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return c.json(response, HttpStatus.BAD_REQUEST as any);
  }

  // Handle generic errors
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message || 'Internal server error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  return c.json(response, HttpStatus.INTERNAL_SERVER_ERROR as any);
};

/**
 * Create standard error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      statusCode: getStatusCodeFromErrorCode(code),
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create standard success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ApiResponse['meta']>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Async handler wrapper that catches errors
 */
export function asyncHandler<T extends { Bindings: Env }>(
  handler: (c: any) => Promise<Response>
): MiddlewareHandler<T> {
  return async (c, next) => {
    try {
      return await handler(c);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }

      console.error('Unhandled error in async handler:', err);
      throw new ApiError(
        ErrorCode.INTERNAL_ERROR,
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    }
  };
}
