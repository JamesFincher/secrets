/**
 * JWT Validation Utilities
 *
 * Handles JWT token validation using Supabase JWT secret
 */

import { JWTPayload } from '../types/api';

/**
 * Base64 URL decode helper
 */
function base64UrlDecode(str: string): string {
  // Replace base64url chars with base64 chars
  str = str.replace(/-/g, '+').replace(/_/g, '/');

  // Pad with '=' to make length multiple of 4
  while (str.length % 4) {
    str += '=';
  }

  return atob(str);
}

/**
 * Parse JWT without verification (for debugging)
 */
export function parseJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = base64UrlDecode(parts[1]);
    return JSON.parse(payload) as JWTPayload;
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
}

/**
 * Verify JWT signature using HMAC SHA-256
 */
async function verifySignature(
  token: string,
  secret: string
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const message = `${headerB64}.${payloadB64}`;

  // Import secret as CryptoKey
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  // Decode the signature from base64url
  const signatureStr = base64UrlDecode(signatureB64);
  const signatureBytes = Uint8Array.from(signatureStr, c => c.charCodeAt(0));

  // Verify signature
  const messageBytes = encoder.encode(message);
  return await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    messageBytes
  );
}

/**
 * Validate JWT token and return payload
 *
 * Checks:
 * 1. Token format (3 parts)
 * 2. Signature validity (HMAC SHA-256)
 * 3. Expiration time
 * 4. Issued at time (not in future)
 */
export async function validateJWT(
  token: string,
  secret: string
): Promise<{ valid: boolean; payload?: JWTPayload; error?: string }> {
  try {
    // Parse token
    const payload = parseJWT(token);
    if (!payload) {
      return { valid: false, error: 'Invalid token format' };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired', payload };
    }

    // Check issued at (not in future)
    if (payload.iat && payload.iat > now + 60) {
      // Allow 60s clock skew
      return { valid: false, error: 'Token issued in future', payload };
    }

    // Verify signature
    const signatureValid = await verifySignature(token, secret);
    if (!signatureValid) {
      return { valid: false, error: 'Invalid signature', payload };
    }

    return { valid: true, payload };
  } catch (error) {
    console.error('JWT validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract JWT from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get user ID from JWT payload
 */
export function getUserId(payload: JWTPayload): string {
  return payload.sub;
}

/**
 * Get user email from JWT payload
 */
export function getUserEmail(payload: JWTPayload): string {
  return payload.email;
}

/**
 * Get organization ID from JWT payload (if present)
 */
export function getOrganizationId(payload: JWTPayload): string | undefined {
  return payload.user_metadata?.organizationId as string | undefined;
}
