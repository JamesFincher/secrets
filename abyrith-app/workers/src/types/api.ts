/**
 * API Types and Interfaces
 *
 * Common types used across the Cloudflare Workers API Gateway
 */

import { Context } from 'hono';

/**
 * Cloudflare Worker Environment Bindings
 */
export interface Env {
  // KV Namespaces
  RATE_LIMIT_KV: KVNamespace;
  CACHE_KV: KVNamespace;

  // Environment variables (set via wrangler secret)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET: string;
  CLAUDE_API_KEY: string;
  FIRECRAWL_API_KEY: string;
  ENVIRONMENT: string;
  FRONTEND_URL?: string;

  // GitHub integration
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_APP_ID?: string;
  GITHUB_PRIVATE_KEY?: string;
}

/**
 * Authenticated User Context
 * Attached to requests after JWT validation
 */
export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  organizationId?: string;
}

/**
 * Extended Context with Auth User
 */
export type AppContext = Context<{ Bindings: Env; Variables: { user?: AuthUser } }>;

/**
 * Standard API Response Format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/**
 * API Error Format
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

/**
 * API Response Metadata
 */
export interface ApiMeta {
  timestamp: string;
  requestId?: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

/**
 * Rate Limit Info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * JWT Payload (from Supabase Auth)
 */
export interface JWTPayload {
  sub: string; // user ID
  email: string;
  role?: string;
  aud: string;
  exp: number;
  iat: number;
  app_metadata?: {
    provider?: string;
    [key: string]: unknown;
  };
  user_metadata?: {
    organizationId?: string;
    [key: string]: unknown;
  };
}

/**
 * Error Types
 */
export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
}

/**
 * HTTP Status Codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
