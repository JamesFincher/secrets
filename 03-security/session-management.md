---
Document: Session Management - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineering
Status: Draft
Dependencies: 03-security/security-model.md, 03-security/auth/authentication-flow.md, TECH-STACK.md, GLOSSARY.md
---

# Session Management Architecture

## Overview

This document defines Abyrith's session management architecture, covering JWT-based authentication, refresh token rotation, secure session storage, and session lifecycle management. The architecture balances security with user experience, implementing industry best practices for token-based authentication while maintaining the zero-knowledge encryption model.

**Purpose:** Provide secure, seamless session management that protects user authentication state while supporting zero-knowledge architecture and multi-device access.

**Scope:** JWT token structure, refresh token rotation, session storage, timeout policies, revocation mechanisms, and multi-device session management.

**Status:** Proposed - Core authentication architecture for MVP

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Token Specifications](#token-specifications)
7. [Refresh Token Rotation](#refresh-token-rotation)
8. [Session Storage](#session-storage)
9. [Security Architecture](#security-architecture)
10. [Performance Characteristics](#performance-characteristics)
11. [Failure Modes](#failure-modes)
12. [Alternatives Considered](#alternatives-considered)
13. [Decision Log](#decision-log)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Web applications require authentication state management across multiple requests while maintaining security. Traditional server-side sessions require database lookups on every request, creating performance bottlenecks. Users expect seamless authentication that persists across browser sessions but automatically expires for security. The challenge is amplified in Abyrith's zero-knowledge architecture where the master encryption key must be managed separately from the authentication session.

**Pain points:**
- Session tokens stored insecurely (localStorage) are vulnerable to XSS attacks
- Long-lived tokens without rotation increase exposure window after compromise
- Session state tied to single device prevents multi-device workflows
- Master encryption keys stored in session storage risk exposure
- Refresh token theft enables persistent unauthorized access
- No graceful handling of concurrent sessions across devices
- Session revocation requires database query on every request (poor performance)

**Why now?**
Building the authentication foundation for MVP. Session management must be defined before implementing user flows, as it affects every authenticated API request and client-side encryption workflow.

### Background

**Existing system (if applicable):**
This is a new platform. No existing session management to replace.

**Previous attempts:**
Traditional password managers use long-lived sessions with minimal rotation, prioritizing convenience over security. Enterprise secrets managers use short-lived sessions with complex refresh mechanisms that frustrate users. Abyrith must balance both.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| End Users | Seamless login experience, stay logged in | Don't want to re-authenticate constantly |
| Security Team | Minimize token exposure, prevent XSS/CSRF | Short token lifetimes without poor UX |
| Development Team | Simple integration, reliable auth | Must work with AI tools (MCP), multi-device |
| Compliance | Audit trail of sessions, ability to revoke | SOC 2 requires session timeout, forced logout |
| Engineering | Performance (avoid DB lookup on every request) | Stateless tokens with security guarantees |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Stateless authentication** - JWTs verified without database lookup (Success metric: < 1ms token verification)
2. **Short-lived access tokens** - Minimize exposure window (Success metric: 15-minute expiration)
3. **Automatic token refresh** - Seamless UX, no re-login (Success metric: 99% of refreshes succeed without user action)
4. **Refresh token rotation** - One-time use refresh tokens prevent replay (Success metric: 100% token rotation on refresh)
5. **Secure storage** - HttpOnly cookies prevent XSS theft (Success metric: Zero localStorage JWT storage)
6. **Multi-device support** - Independent sessions per device (Success metric: User can logout from one device without affecting others)
7. **Graceful session timeout** - Clear communication, save work before logout (Success metric: User warned 5 minutes before timeout)

**Secondary goals:**
- Session activity tracking for security monitoring
- Geographic anomaly detection (login from new location/device)
- Concurrent session limits for Enterprise tier
- Biometric authentication support (future)

### Non-Goals

**Explicitly out of scope:**
- **Server-side session storage** - Use stateless JWTs (Why: Avoid database bottleneck, enable edge computing)
- **Single sign-on (SSO) for MVP** - Add post-MVP (Why: Enterprise feature, not needed for initial users)
- **Biometric authentication** - Use passwords + 2FA for MVP (Why: WebAuthn support requires additional infrastructure)
- **OAuth token storage** - Supabase handles OAuth flows (Why: Managed by Supabase Auth, not our responsibility)

### Success Metrics

**How we measure success:**
- **Security:** Zero XSS-based session theft incidents; 100% token rotation on refresh
- **Performance:** Token verification < 1ms p95; refresh operation < 200ms p95
- **UX:** < 0.1% of users complain about re-authentication frequency
- **Reliability:** 99.9% token refresh success rate

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. User logs in with email + password              │   │
│  └───────────────────┬─────────────────────────────────┘   │
│                      │ POST /auth/login                      │
│                      ▼                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────────┐
│             Supabase Auth (Authentication)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  2. Validate credentials                            │    │
│  │  3. Generate JWT access token (15 min expiry)       │    │
│  │  4. Generate refresh token (1 year expiry)          │    │
│  │  5. Hash refresh token, store in database           │    │
│  └───────────────────┬─────────────────────────────────┘    │
└────────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   Browser (Set Cookies)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Set-Cookie: sb-access-token=JWT; HttpOnly; Secure │    │
│  │  Set-Cookie: sb-refresh-token=TOKEN; HttpOnly       │    │
│  └───────────────────┬─────────────────────────────────┘    │
│                      │                                       │
│                      │ User makes API request                │
│                      ▼                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Authorization: Bearer {JWT}                        │    │
│  └───────────────────┬─────────────────────────────────┘    │
└────────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (API Gateway)                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  6. Extract JWT from Authorization header           │    │
│  │  7. Verify JWT signature (HMAC-SHA256)              │    │
│  │  8. Check expiration (exp claim)                    │    │
│  │  9. Extract user_id from sub claim                  │    │
│  │  10. Forward request to Supabase with user_id       │    │
│  │  (NO database lookup - stateless!)                  │    │
│  └───────────────────┬─────────────────────────────────┘    │
└────────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  11. RLS policies use auth.uid() (from JWT)         │    │
│  │  12. Query only rows user has access to             │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│              TOKEN REFRESH FLOW (every 15 min)              │
└─────────────────────────────────────────────────────────────┘

Browser detects access token expiring soon (< 5 min remaining)
    │
    ▼
POST /auth/token with refresh token in HttpOnly cookie
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│                   Supabase Auth                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Extract refresh token from cookie               │    │
│  │  2. Hash refresh token                              │    │
│  │  3. Lookup in database (refresh_tokens table)       │    │
│  │  4. Verify not expired, not revoked                 │    │
│  │  5. Mark old refresh token as used (revoke)         │    │
│  │  6. Generate NEW JWT access token (15 min)          │    │
│  │  7. Generate NEW refresh token (rotation)           │    │
│  │  8. Store hash of new refresh token in database     │    │
│  │  9. Return new tokens to client                     │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
Set new cookies (access token + refresh token)
Browser continues seamlessly without re-login
```

### Key Components

**Component 1: Supabase Auth Service**
- **Purpose:** Centralized authentication and token management
- **Technology:** Supabase Auth (managed service, GoTrue backend)
- **Responsibilities:**
  - Issue JWT access tokens signed with HMAC-SHA256
  - Issue refresh tokens with secure random generation
  - Store hashed refresh tokens in PostgreSQL
  - Verify credentials (email/password, OAuth, MFA)
  - Handle token refresh and rotation
  - Manage refresh token revocation

**Component 2: Browser Token Storage**
- **Purpose:** Securely store authentication tokens in browser
- **Technology:** HttpOnly cookies (set by Supabase)
- **Responsibilities:**
  - Store access token in HttpOnly cookie (XSS-safe)
  - Store refresh token in HttpOnly cookie
  - Automatically include tokens in API requests
  - Prevent JavaScript access to tokens
  - Clear tokens on logout

**Component 3: Cloudflare Workers JWT Verifier**
- **Purpose:** Stateless token verification at the edge
- **Technology:** Cloudflare Workers (V8 runtime)
- **Responsibilities:**
  - Extract JWT from Authorization header or cookie
  - Verify JWT signature using Supabase public key (HMAC-SHA256)
  - Check token expiration (exp claim)
  - Extract user ID (sub claim) and metadata
  - Reject invalid/expired tokens (401 Unauthorized)
  - Forward valid requests with user context

**Component 4: Refresh Token Storage (PostgreSQL)**
- **Purpose:** Track valid refresh tokens and enable revocation
- **Technology:** PostgreSQL table in Supabase
- **Responsibilities:**
  - Store hashed refresh tokens (never plaintext)
  - Track token metadata (user_id, device, IP, created_at)
  - Mark tokens as revoked when rotated
  - Enable global logout (revoke all user tokens)
  - Cleanup expired tokens (background job)

### Component Interactions

**Browser ↔ Supabase Auth:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON
- Authentication: Email/password, OAuth, magic link, MFA

**Browser ↔ Cloudflare Workers:**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON
- Authentication: JWT Bearer token in Authorization header or HttpOnly cookie

**Cloudflare Workers ↔ Supabase (Data API):**
- Protocol: HTTPS (TLS 1.3)
- Data format: JSON (PostgREST API)
- Authentication: Service role key (server-to-server) or user JWT (for RLS)

---

## Component Details

### Component: JWT Access Token

**Purpose:** Short-lived authentication token for API access

**Structure:**
```typescript
interface JWTAccessToken {
  // Header
  alg: 'HS256';          // HMAC-SHA256 signature
  typ: 'JWT';            // Token type

  // Payload (claims)
  sub: string;           // Subject: User ID (UUID)
  email: string;         // User email
  phone?: string;        // User phone (if provided)
  app_metadata: {
    provider: 'email' | 'google' | 'github' | 'azure' | 'okta';
    providers: string[]; // All connected providers
  };
  user_metadata: {
    name?: string;       // User display name
    avatar_url?: string; // Profile picture
  };
  role: 'authenticated'; // Supabase role (always 'authenticated' for logged-in users)
  aal?: 'aal1' | 'aal2'; // Authentication Assurance Level (aal2 = 2FA enabled)
  amr?: Array<{         // Authentication Methods References
    method: 'password' | 'otp' | 'oauth' | 'totp';
    timestamp: number;
  }>;
  session_id: string;    // Unique session identifier
  iat: number;           // Issued at (Unix timestamp)
  exp: number;           // Expires at (Unix timestamp, +15 minutes from iat)
  iss: string;           // Issuer: Supabase project URL
  aud: string;           // Audience: "authenticated"
}
```

**Example JWT Payload:**
```json
{
  "sub": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  },
  "user_metadata": {
    "name": "Jane Developer"
  },
  "role": "authenticated",
  "aal": "aal2",
  "amr": [
    { "method": "password", "timestamp": 1698764400 },
    { "method": "totp", "timestamp": 1698764405 }
  ],
  "session_id": "sess_9876543210abcdef",
  "iat": 1698764400,
  "exp": 1698765300,
  "iss": "https://abcdefgh.supabase.co/auth/v1",
  "aud": "authenticated"
}
```

**Key Properties:**
- **Expiration:** 15 minutes (900 seconds)
- **Size:** ~500-800 bytes (base64-encoded)
- **Signature:** HMAC-SHA256 with Supabase project secret
- **Storage:** HttpOnly cookie (`sb-access-token`)
- **Validation:** Verified on every API request (Cloudflare Workers)

---

### Component: Refresh Token

**Purpose:** Long-lived token for obtaining new access tokens without re-authentication

**Structure:**
```typescript
interface RefreshToken {
  token: string;         // Cryptographically random token (256 bits)
  token_hash: string;    // SHA-256 hash of token (stored in database)
  user_id: string;       // Owner UUID
  session_id: string;    // Associated session ID
  created_at: string;    // ISO 8601 timestamp
  expires_at: string;    // ISO 8601 timestamp (+1 year)
  revoked: boolean;      // True if token has been used or revoked
  device_info?: {
    user_agent: string;
    ip_address: string;  // Anonymized if GDPR applies
    device_name?: string;
  };
}
```

**Database Schema:**
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  device_info JSONB,
  CONSTRAINT token_not_expired CHECK (expires_at > now())
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at) WHERE NOT revoked;
```

**Key Properties:**
- **Expiration:** 1 year (31,536,000 seconds)
- **Size:** 256-bit random token (32 bytes, 44 base64 characters)
- **Storage:** HttpOnly cookie (`sb-refresh-token`)
- **Rotation:** One-time use - new token issued on each refresh
- **Hashing:** SHA-256 hash stored in database (never plaintext)
- **Revocation:** Marked as revoked after use or on logout

---

## Data Flow

### Flow 1: Initial Login (Email + Password)

**Trigger:** User submits login form with email and password

**Steps:**

1. **User submits login:**
   ```typescript
   // Browser: Login form submission
   const { data, error } = await supabase.auth.signInWithPassword({
     email: 'user@example.com',
     password: 'user_account_password' // Not the master encryption password
   });
   ```

2. **Supabase Auth validates credentials:**
   ```sql
   -- Supabase Auth queries auth.users table
   SELECT id, encrypted_password, email_confirmed_at
   FROM auth.users
   WHERE email = 'user@example.com'
     AND deleted_at IS NULL;

   -- Verify password hash using bcrypt
   -- Check email confirmed (if email verification enabled)
   ```

3. **Supabase Auth generates tokens:**
   ```typescript
   // Supabase Auth (internal process)
   const accessToken = generateJWT({
     sub: user.id,
     email: user.email,
     role: 'authenticated',
     session_id: generateSessionId(),
     iat: Math.floor(Date.now() / 1000),
     exp: Math.floor(Date.now() / 1000) + 900 // +15 minutes
   }, supabaseSecret);

   const refreshToken = generateRandomToken(32); // 256 bits
   const refreshTokenHash = sha256(refreshToken);

   // Store refresh token hash in database
   await db.query(`
     INSERT INTO refresh_tokens (user_id, token_hash, session_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 year')
   `, [user.id, refreshTokenHash, sessionId]);
   ```

4. **Supabase Auth sets cookies:**
   ```http
   HTTP/1.1 200 OK
   Set-Cookie: sb-access-token=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900
   Set-Cookie: sb-refresh-token=abcd1234...; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000
   Content-Type: application/json

   {
     "access_token": "eyJhbGc...",
     "refresh_token": "abcd1234...",
     "token_type": "bearer",
     "expires_in": 900,
     "expires_at": 1698765300,
     "user": {
       "id": "a1b2c3d4-...",
       "email": "user@example.com",
       "email_confirmed_at": "2025-10-29T12:00:00Z"
     }
   }
   ```

5. **Browser stores tokens:**
   ```typescript
   // Cookies stored automatically by browser
   // JavaScript CANNOT access HttpOnly cookies (XSS protection)

   // Frontend updates auth state
   setAuthState({
     user: data.user,
     session: data.session,
     authenticated: true
   });
   ```

6. **User is redirected to dashboard:**
   ```typescript
   // Browser: Navigate to authenticated area
   router.push('/dashboard');
   ```

**Success Criteria:** User successfully authenticated, tokens stored securely, redirected to dashboard

---

### Flow 2: Authenticated API Request

**Trigger:** User performs action requiring API call (e.g., fetch secrets)

**Steps:**

1. **Frontend makes API request:**
   ```typescript
   // Browser: Fetch secrets
   const response = await fetch('https://api.abyrith.com/secrets', {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${accessToken}` // OR cookie sent automatically
     },
     credentials: 'include' // Include cookies
   });
   ```

2. **Cloudflare Workers intercepts request:**
   ```typescript
   // Worker: Extract and verify JWT
   export default {
     async fetch(request: Request, env: Env): Promise<Response> {
       // Extract JWT from Authorization header or cookie
       const authHeader = request.headers.get('Authorization');
       const jwt = authHeader?.replace('Bearer ', '') || getCookie(request, 'sb-access-token');

       if (!jwt) {
         return new Response('Unauthorized', { status: 401 });
       }

       // Verify JWT signature and expiration
       const payload = await verifyJWT(jwt, env.SUPABASE_JWT_SECRET);

       if (!payload) {
         return new Response('Invalid token', { status: 401 });
       }

       // Check expiration
       const now = Math.floor(Date.now() / 1000);
       if (payload.exp < now) {
         return new Response('Token expired', { status: 401 });
       }

       // Forward request to Supabase with user context
       const supabaseRequest = new Request(request.url.replace('api.abyrith.com', env.SUPABASE_URL), {
         method: request.method,
         headers: {
           'Authorization': `Bearer ${jwt}`, // Pass JWT for RLS
           'apikey': env.SUPABASE_ANON_KEY,
           'Content-Type': 'application/json'
         },
         body: request.body
       });

       return fetch(supabaseRequest);
     }
   };
   ```

3. **Supabase enforces Row-Level Security:**
   ```sql
   -- PostgreSQL RLS automatically filters query
   SELECT * FROM secrets
   WHERE user_id = auth.uid(); -- auth.uid() extracted from JWT automatically
   ```

4. **Response returned to browser:**
   ```typescript
   // Browser: Process response
   const secrets = await response.json();
   displaySecrets(secrets);
   ```

**Performance:** < 200ms end-to-end (JWT verification ~1ms, database query ~50ms, network ~150ms)

---

### Flow 3: Automatic Token Refresh (Background)

**Trigger:** Access token nearing expiration (< 5 minutes remaining)

**Steps:**

1. **Frontend detects token expiring soon:**
   ```typescript
   // Browser: Check token expiration every 60 seconds
   setInterval(async () => {
     const session = supabase.auth.session();
     if (!session) return;

     const expiresAt = session.expires_at * 1000; // Convert to milliseconds
     const now = Date.now();
     const timeUntilExpiry = expiresAt - now;

     // Refresh if < 5 minutes remaining
     if (timeUntilExpiry < 5 * 60 * 1000) {
       await refreshSession();
     }
   }, 60000); // Check every 60 seconds
   ```

2. **Frontend requests token refresh:**
   ```typescript
   // Browser: Call Supabase refresh method
   async function refreshSession() {
     const { data, error } = await supabase.auth.refreshSession();

     if (error) {
       console.error('Token refresh failed:', error);
       // Optionally force re-login
       if (error.message === 'Invalid refresh token') {
         await supabase.auth.signOut();
         router.push('/login');
       }
       return;
     }

     // Session refreshed automatically, new tokens stored in cookies
     console.log('Session refreshed successfully');
   }
   ```

3. **Supabase Auth validates refresh token:**
   ```typescript
   // Supabase Auth (internal process)
   const refreshToken = getCookie(request, 'sb-refresh-token');
   const refreshTokenHash = sha256(refreshToken);

   // Lookup refresh token in database
   const tokenRecord = await db.query(`
     SELECT user_id, session_id, expires_at, revoked
     FROM refresh_tokens
     WHERE token_hash = $1
   `, [refreshTokenHash]);

   if (!tokenRecord) {
     return { error: 'Invalid refresh token' };
   }

   if (tokenRecord.revoked) {
     return { error: 'Refresh token has been revoked' };
   }

   if (new Date(tokenRecord.expires_at) < new Date()) {
     return { error: 'Refresh token expired' };
   }
   ```

4. **Supabase Auth rotates tokens:**
   ```typescript
   // Revoke old refresh token (mark as used)
   await db.query(`
     UPDATE refresh_tokens
     SET revoked = true, revoked_at = now()
     WHERE token_hash = $1
   `, [refreshTokenHash]);

   // Generate NEW access token (15 min)
   const newAccessToken = generateJWT({
     sub: tokenRecord.user_id,
     email: user.email,
     role: 'authenticated',
     session_id: tokenRecord.session_id, // Same session ID
     iat: Math.floor(Date.now() / 1000),
     exp: Math.floor(Date.now() / 1000) + 900
   }, supabaseSecret);

   // Generate NEW refresh token (rotation)
   const newRefreshToken = generateRandomToken(32);
   const newRefreshTokenHash = sha256(newRefreshToken);

   // Store new refresh token
   await db.query(`
     INSERT INTO refresh_tokens (user_id, token_hash, session_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 year')
   `, [tokenRecord.user_id, newRefreshTokenHash, tokenRecord.session_id]);
   ```

5. **New tokens sent to browser:**
   ```http
   HTTP/1.1 200 OK
   Set-Cookie: sb-access-token=NEW_JWT...; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900
   Set-Cookie: sb-refresh-token=NEW_TOKEN...; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000

   {
     "access_token": "NEW_JWT...",
     "refresh_token": "NEW_TOKEN...",
     "expires_in": 900
   }
   ```

6. **User continues seamlessly:**
   ```typescript
   // No user action required - refresh happens in background
   // User never sees re-login screen
   ```

**Success Criteria:** Token refreshed seamlessly, no interruption to user workflow

**Failure Handling:** If refresh fails, prompt user to re-login after warning

---

### Flow 4: Logout (Single Device)

**Trigger:** User clicks "Logout" button

**Steps:**

1. **Frontend initiates logout:**
   ```typescript
   // Browser: Logout button click
   async function logout() {
     await supabase.auth.signOut();

     // Clear local state
     clearAuthState();
     clearEncryptionKeys(); // Clear master key from memory

     // Redirect to login
     router.push('/login');
   }
   ```

2. **Supabase Auth revokes tokens:**
   ```typescript
   // Supabase Auth: Revoke refresh token for this session
   const refreshToken = getCookie(request, 'sb-refresh-token');
   const refreshTokenHash = sha256(refreshToken);

   await db.query(`
     UPDATE refresh_tokens
     SET revoked = true, revoked_at = now()
     WHERE token_hash = $1
   `, [refreshTokenHash]);
   ```

3. **Cookies cleared:**
   ```http
   HTTP/1.1 200 OK
   Set-Cookie: sb-access-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0
   Set-Cookie: sb-refresh-token=; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0

   { "message": "Logged out successfully" }
   ```

4. **Other devices remain logged in:**
   ```typescript
   // Only this session's refresh token was revoked
   // Other devices with different refresh tokens unaffected
   ```

---

### Flow 5: Global Logout (All Devices)

**Trigger:** User clicks "Logout from all devices" or security action (password reset)

**Steps:**

1. **Frontend requests global logout:**
   ```typescript
   // Browser: Global logout
   async function logoutAllDevices() {
     // Call custom API endpoint
     await fetch('/api/auth/logout-all', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${accessToken}`
       }
     });

     // Then logout locally
     await logout();
   }
   ```

2. **Backend revokes all refresh tokens:**
   ```sql
   -- Revoke ALL refresh tokens for this user
   UPDATE refresh_tokens
   SET revoked = true, revoked_at = now()
   WHERE user_id = 'current_user_id'
     AND revoked = false;
   ```

3. **All sessions invalidated:**
   ```typescript
   // All devices will fail token refresh
   // Users forced to re-login on next API request
   ```

**Use Cases:**
- User suspects account compromise
- Password reset (security measure)
- User wants to revoke access from shared/public computer
- Enterprise policy requires re-authentication

---

## Token Specifications

### JWT Access Token Specification

**Lifetime:** 15 minutes (900 seconds)

**Signature Algorithm:** HMAC-SHA256 (HS256)

**Signing Key:** Supabase project JWT secret (256-bit)

**Token Structure:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.    ← Header (base64url)
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ik    ← Payload (base64url)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature (HMAC-SHA256)
```

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Required Claims:**
- `sub` (subject): User ID (UUID)
- `email`: User email address
- `role`: User role ("authenticated")
- `iat` (issued at): Unix timestamp
- `exp` (expires): Unix timestamp (+900 seconds)

**Optional Claims:**
- `aal`: Authentication Assurance Level (aal1, aal2)
- `amr`: Authentication Methods References
- `session_id`: Unique session identifier
- `app_metadata`: Provider info
- `user_metadata`: Custom user data

**Verification Process:**
1. Split token into header, payload, signature
2. Decode header and payload (base64url)
3. Verify signature using HMAC-SHA256 with secret key
4. Check `exp` claim (must be in the future)
5. Extract `sub` claim for user ID

**Security Properties:**
- Cannot be forged without secret key
- Tampering detected via signature verification
- Expiration enforced to limit exposure window
- Stateless (no database lookup required)

---

### Refresh Token Specification

**Lifetime:** 1 year (31,536,000 seconds)

**Format:** Cryptographically random string (256 bits)

**Generation:**
```typescript
// Generate cryptographically secure random token
const refreshToken = crypto.getRandomValues(new Uint8Array(32));
const refreshTokenBase64 = btoa(String.fromCharCode(...refreshToken));
```

**Storage:**
```typescript
// NEVER store plaintext refresh token in database
// Always hash before storage
const sha256 = async (message: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const refreshTokenHash = await sha256(refreshToken);
```

**Database Schema:**
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash, never plaintext
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
  revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  device_info JSONB
);
```

**Security Properties:**
- One-time use (rotated on every refresh)
- Hashed in database (plaintext never stored)
- Long expiration (user convenience) mitigated by rotation
- Revocable (marked as revoked after use)
- Per-device tracking (device_info)

---

## Refresh Token Rotation

### Rotation Strategy

**Why rotate?**
- Limits damage from refresh token theft
- Stolen refresh token becomes useless after single use
- Detects concurrent usage (security anomaly)
- Provides audit trail of token usage

**Rotation Flow:**
```
User holds: Refresh Token A
    │
    │ User requests new access token
    ▼
Server receives: Refresh Token A
    │
    │ Validate token A (check hash in database)
    │ Mark token A as revoked
    │ Generate new Refresh Token B
    │ Store hash of token B
    ▼
Server returns: New Access Token + Refresh Token B
    │
    ▼
User now holds: Refresh Token B
(Token A is dead, cannot be reused)
```

**Implementation:**
```typescript
// Supabase Auth (internal refresh logic)
async function refreshAccessToken(oldRefreshToken: string): Promise<TokenPair> {
  // 1. Hash the incoming refresh token
  const oldTokenHash = await sha256(oldRefreshToken);

  // 2. Lookup in database
  const tokenRecord = await db.query(`
    SELECT user_id, session_id, expires_at, revoked
    FROM refresh_tokens
    WHERE token_hash = $1
  `, [oldTokenHash]);

  if (!tokenRecord || tokenRecord.revoked) {
    throw new Error('Invalid or revoked refresh token');
  }

  // 3. Check expiration
  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error('Refresh token expired');
  }

  // 4. Revoke old token (mark as used)
  await db.query(`
    UPDATE refresh_tokens
    SET revoked = true, revoked_at = now()
    WHERE token_hash = $1
  `, [oldTokenHash]);

  // 5. Generate new access token
  const newAccessToken = generateJWT({
    sub: tokenRecord.user_id,
    session_id: tokenRecord.session_id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900 // +15 min
  }, jwtSecret);

  // 6. Generate new refresh token
  const newRefreshToken = generateRandomToken(32);
  const newTokenHash = await sha256(newRefreshToken);

  // 7. Store new refresh token hash
  await db.query(`
    INSERT INTO refresh_tokens (user_id, token_hash, session_id, expires_at)
    VALUES ($1, $2, $3, now() + interval '1 year')
  `, [tokenRecord.user_id, newTokenHash, tokenRecord.session_id]);

  return {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    expires_in: 900
  };
}
```

### Detecting Token Theft

**Scenario:** Attacker steals refresh token, uses it before legitimate user

**Detection:**
```typescript
// If revoked token is used again, it's suspicious
async function detectSuspiciousRefresh(tokenHash: string) {
  const tokenRecord = await db.query(`
    SELECT user_id, revoked, revoked_at
    FROM refresh_tokens
    WHERE token_hash = $1
  `, [tokenHash]);

  if (tokenRecord && tokenRecord.revoked) {
    // This token was already used!
    // Either:
    // 1. User tried to use old token (client bug)
    // 2. Attacker is using stolen token

    // Security response: Revoke ALL tokens for this user
    await revokeAllTokensForUser(tokenRecord.user_id);

    // Alert user via email
    await sendSecurityAlert(tokenRecord.user_id, {
      type: 'refresh_token_reuse',
      timestamp: new Date(),
      message: 'Your account may be compromised. All sessions have been logged out.'
    });

    throw new Error('Refresh token reuse detected - all sessions revoked');
  }
}
```

**User Experience:**
- User receives email: "Unusual activity detected. You've been logged out of all devices."
- User must re-login with password (and 2FA if enabled)
- Attacker's stolen token is now useless

---

## Session Storage

### Browser Storage Strategy

**Access Token Storage:**
- **Method:** HttpOnly cookie (`sb-access-token`)
- **Why:** Cannot be accessed by JavaScript (XSS protection)
- **Path:** `/` (available to all routes)
- **Secure:** Yes (HTTPS only)
- **SameSite:** `Lax` (prevents CSRF while allowing normal navigation)
- **Max-Age:** 900 seconds (15 minutes)

**Refresh Token Storage:**
- **Method:** HttpOnly cookie (`sb-refresh-token`)
- **Why:** Cannot be accessed by JavaScript, long-lived
- **Path:** `/auth` (only sent to auth endpoints, reduces exposure)
- **Secure:** Yes (HTTPS only)
- **SameSite:** `Lax`
- **Max-Age:** 31536000 seconds (1 year)

**Cookie Configuration:**
```typescript
// Set by Supabase Auth automatically
Set-Cookie: sb-access-token=JWT_HERE;
  Path=/;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Max-Age=900

Set-Cookie: sb-refresh-token=TOKEN_HERE;
  Path=/auth;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Max-Age=31536000
```

### ❌ What NOT to Store

**Do NOT store in localStorage:**
```typescript
// ❌ NEVER do this - vulnerable to XSS
localStorage.setItem('access_token', jwt);
localStorage.setItem('refresh_token', refreshToken);

// ❌ NEVER do this either
sessionStorage.setItem('access_token', jwt);
```

**Why?**
- JavaScript can access localStorage/sessionStorage
- XSS attack can steal tokens: `const token = localStorage.getItem('access_token');`
- HttpOnly cookies are immune to XSS (JavaScript cannot read them)

**Do NOT store master encryption key in session:**
```typescript
// ❌ NEVER persist master key
localStorage.setItem('master_key', masterKey); // NO!
sessionStorage.setItem('master_key', masterKey); // NO!

// ✅ Keep master key in memory only (React state, Context)
const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);

// ✅ Clear on window close or inactivity timeout
window.addEventListener('beforeunload', () => {
  setMasterKey(null); // Clear from memory
});
```

### Session Timeout Policy

**Inactivity Timeout:**
```typescript
// Frontend: Track last activity
let lastActivity = Date.now();

// Update on user interaction
['click', 'keypress', 'mousemove', 'scroll'].forEach(event => {
  window.addEventListener(event, () => {
    lastActivity = Date.now();
  });
});

// Check inactivity every minute
setInterval(() => {
  const inactive = Date.now() - lastActivity;
  const timeout = 30 * 60 * 1000; // 30 minutes

  if (inactive > timeout) {
    // Warn user before logout
    showInactivityWarning({
      message: 'You will be logged out in 5 minutes due to inactivity',
      countdown: 5 * 60 // seconds
    });
  }

  if (inactive > timeout + 5 * 60 * 1000) {
    // Force logout after 35 minutes total
    await supabase.auth.signOut();
    router.push('/login?reason=inactivity');
  }
}, 60000); // Check every minute
```

**Absolute Session Timeout:**
```typescript
// Maximum session duration: 24 hours
// After 24 hours, force re-authentication regardless of activity
const sessionStart = Date.now();
const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 hours

setInterval(() => {
  const sessionDuration = Date.now() - sessionStart;

  if (sessionDuration > maxSessionDuration) {
    showMessage({
      type: 'info',
      message: 'For security, please log in again.'
    });
    await supabase.auth.signOut();
    router.push('/login?reason=session_expired');
  }
}, 60000);
```

---

## Security Architecture

### Threat Model

**Threat 1: XSS (Cross-Site Scripting) Attack**

**Scenario:** Attacker injects malicious JavaScript into Abyrith web app

**Impact:** Could steal tokens if stored in localStorage

**Mitigation:**
- ✅ HttpOnly cookies (JavaScript cannot access)
- ✅ Content Security Policy (CSP) headers
- ✅ React's automatic XSS escaping
- ✅ Input sanitization
- ✅ No `dangerouslySetInnerHTML` usage

**Residual Risk:** Zero-day XSS in React or dependencies (mitigated by rapid patching)

---

**Threat 2: CSRF (Cross-Site Request Forgery)**

**Scenario:** Malicious website tricks user's browser into making authenticated request to Abyrith

**Impact:** Could perform actions on behalf of user

**Mitigation:**
- ✅ SameSite=Lax cookies (CSRF protection for state-changing requests)
- ✅ CORS configuration (only allow requests from Abyrith domain)
- ✅ CSRF tokens for state-changing operations (if needed)

**Residual Risk:** Low (SameSite cookies provide strong protection)

---

**Threat 3: Refresh Token Theft**

**Scenario:** Attacker steals refresh token (malware, network interception, etc.)

**Impact:** Could access user account until token expires (1 year)

**Mitigation:**
- ✅ Refresh token rotation (stolen token useless after one use)
- ✅ Detection of token reuse (revoke all sessions)
- ✅ HttpOnly cookie storage (XSS protection)
- ✅ TLS 1.3 (prevents network interception)
- ✅ Device tracking (detect logins from new devices)

**Residual Risk:** Attacker must use token before legitimate user to maintain access (narrow window)

---

**Threat 4: Session Fixation**

**Scenario:** Attacker tricks user into using attacker-controlled session ID

**Impact:** Attacker gains access to user session

**Mitigation:**
- ✅ Generate new session ID on login (Supabase Auth handles this)
- ✅ Invalidate old session IDs on authentication
- ✅ Bind session to device characteristics

**Residual Risk:** Very low (Supabase Auth implements proper session management)

---

**Threat 5: Token Replay Attack**

**Scenario:** Attacker intercepts and reuses valid JWT

**Impact:** Could impersonate user until token expires (15 minutes)

**Mitigation:**
- ✅ Short JWT lifetime (15 minutes)
- ✅ TLS 1.3 (prevents interception)
- ✅ Automatic token refresh (limits exposure)
- ✅ Bind tokens to IP address or device (future)

**Residual Risk:** 15-minute exposure window (acceptable for balance of security and UX)

---

## Performance Characteristics

### Performance Targets

**Latency:**
- **JWT verification:** < 1ms p95 (stateless, no DB lookup)
- **Token refresh:** < 200ms p95 (includes DB query + token generation)
- **Login:** < 500ms p95 (including credential verification)
- **Logout:** < 100ms p95 (simple DB update)

**Throughput:**
- **Concurrent sessions:** 10,000+ (stateless JWTs scale horizontally)
- **Token refreshes per second:** 1,000+ (database can handle burst load)

**Resource Usage:**
- **JWT verification memory:** < 1MB (lightweight crypto)
- **Refresh token storage:** ~200 bytes per token in database
- **Cookie overhead:** ~1KB per request (JWT in header)

### Performance Optimization

**JWT Verification Optimization:**
```typescript
// Cache Supabase JWT secret in Worker memory (avoid repeated fetches)
let cachedJWTSecret: string | null = null;

async function getJWTSecret(env: Env): Promise<string> {
  if (cachedJWTSecret) return cachedJWTSecret;

  cachedJWTSecret = env.SUPABASE_JWT_SECRET;
  return cachedJWTSecret;
}

// Use native Web Crypto API (hardware-accelerated)
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const [header, payload, signature] = token.split('.');

  // Verify signature using HMAC-SHA256
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64urlDecode(signature),
    new TextEncoder().encode(data)
  );

  if (!valid) return null;

  // Decode payload
  const payloadJson = atob(payload);
  return JSON.parse(payloadJson);
}
```

**Database Query Optimization:**
```sql
-- Index on token_hash for fast lookup
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- Composite index for user-based queries
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, revoked) WHERE NOT revoked;

-- Cleanup expired tokens periodically (reduce table size)
DELETE FROM refresh_tokens
WHERE expires_at < now() - interval '7 days'; -- Keep for 7 days for audit
```

**Token Refresh Optimization:**
```typescript
// Debounce multiple refresh requests (prevent simultaneous refreshes)
let refreshInProgress = false;

async function refreshSession() {
  if (refreshInProgress) {
    // Wait for existing refresh to complete
    while (refreshInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  refreshInProgress = true;
  try {
    await supabase.auth.refreshSession();
  } finally {
    refreshInProgress = false;
  }
}
```

---

## Failure Modes

### Failure Mode 1: Refresh Token Expired

**Scenario:** User returns after 1 year, refresh token expired

**Impact:** Cannot obtain new access token, must re-authenticate

**Detection:** Refresh request returns error "Refresh token expired"

**Recovery:**
```typescript
// Frontend: Handle expired refresh token
const { error } = await supabase.auth.refreshSession();

if (error?.message === 'Refresh token expired') {
  // Clear local state
  clearAuthState();

  // Show friendly message
  showMessage({
    type: 'info',
    message: 'Your session has expired. Please log in again.'
  });

  // Redirect to login
  router.push('/login?reason=token_expired');
}
```

**Prevention:**
- Warn users before long inactivity (e.g., email after 11 months)
- Encourage frequent usage to maintain active session

---

### Failure Mode 2: Token Refresh Failure (Network Error)

**Scenario:** Network error prevents token refresh (offline, server down)

**Impact:** Access token expires, user cannot make API requests

**Detection:** Refresh request fails with network error

**Recovery:**
```typescript
// Frontend: Retry with exponential backoff
async function refreshSessionWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (!error) return; // Success

      if (error.message.includes('network')) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
        continue;
      } else {
        // Non-network error, don't retry
        throw error;
      }
    } catch (err) {
      if (i === maxRetries - 1) {
        // Final retry failed
        showMessage({
          type: 'error',
          message: 'Unable to refresh your session. Please check your internet connection.'
        });
      }
    }
  }
}
```

**Prevention:**
- Implement retry logic with exponential backoff
- Cache user data for offline access (read-only mode)

---

### Failure Mode 3: Concurrent Refresh Requests

**Scenario:** Multiple browser tabs attempt token refresh simultaneously

**Impact:** Could create race condition, multiple refresh tokens issued

**Detection:** Multiple refresh requests within short time window

**Recovery:**
```typescript
// Frontend: Use shared storage to coordinate refreshes
const REFRESH_LOCK_KEY = 'supabase_refresh_lock';

async function refreshSessionCoordinated() {
  // Acquire lock
  const lockId = Math.random().toString(36);
  localStorage.setItem(REFRESH_LOCK_KEY, lockId);

  // Wait 100ms to see if another tab acquired lock first
  await new Promise(resolve => setTimeout(resolve, 100));

  if (localStorage.getItem(REFRESH_LOCK_KEY) !== lockId) {
    // Another tab is refreshing, wait for it
    return waitForRefreshCompletion();
  }

  try {
    // We have the lock, perform refresh
    await supabase.auth.refreshSession();
  } finally {
    // Release lock
    localStorage.removeItem(REFRESH_LOCK_KEY);
  }
}
```

**Prevention:**
- Supabase Auth handles this internally (single refresh per session)
- Use BroadcastChannel API to coordinate across tabs (future)

---

## Alternatives Considered

### Alternative 1: Server-Side Sessions (Traditional)

**Description:** Store session state in database, use session ID cookie

**Pros:**
- Instant revocation (delete from database)
- Easier to track active sessions
- Familiar pattern for developers

**Cons:**
- Database lookup on every request (performance bottleneck)
- Doesn't work well with edge computing (Cloudflare Workers)
- Horizontal scaling requires shared session store (Redis)
- Violates stateless API design

**Why not chosen:** Performance and scalability. Stateless JWTs enable edge computing and horizontal scaling without shared state.

---

### Alternative 2: Long-Lived JWTs (No Refresh)

**Description:** Issue JWTs with 1-year expiration, no refresh mechanism

**Pros:**
- Simpler implementation (no refresh logic)
- No refresh token storage needed
- Zero refresh requests (better performance)

**Cons:**
- Cannot revoke tokens (logout doesn't work immediately)
- Stolen token valid for 1 year (huge security risk)
- No audit trail of token usage
- Doesn't meet security best practices

**Why not chosen:** Severe security implications. Short-lived tokens with refresh is industry standard for good reason.

---

### Alternative 3: Refresh Tokens WITHOUT Rotation

**Description:** Reusable refresh tokens (same token used multiple times)

**Pros:**
- Simpler implementation
- No risk of client losing sync with server
- Easier to debug

**Cons:**
- Stolen refresh token valid until expiration (1 year)
- Cannot detect token theft
- No audit trail of refresh events
- Violates OAuth 2.0 best practices (RFC 6749)

**Why not chosen:** Security benefits of rotation outweigh implementation complexity. Rotation is recommended by OWASP and OAuth 2.0 best practices.

---

## Decision Log

### Decision 1: 15-Minute JWT Expiration

**Date:** 2025-10-30

**Context:** Need to balance security (short expiration) with UX (avoid frequent refreshes)

**Options:**
1. **5 minutes** - Maximum security, frequent refreshes
2. **15 minutes** - Good security, reasonable UX
3. **60 minutes** - Better UX, weaker security

**Decision:** 15 minutes

**Rationale:**
- Industry standard for access tokens (OAuth 2.0 typical range: 10-60 minutes)
- Short enough to limit damage from token theft (~15 min exposure)
- Long enough to avoid constant refresh requests (refresh every ~10-12 minutes in practice)
- Automatic refresh is seamless to users (no UX impact)

**Consequences:**
- Token must be refreshed 4 times per hour
- Stolen token valid for maximum 15 minutes

---

### Decision 2: Refresh Token Rotation (One-Time Use)

**Date:** 2025-10-30

**Context:** Should refresh tokens be reusable or one-time use?

**Options:**
1. **Reusable** - Same refresh token used multiple times
2. **One-time use (rotation)** - New refresh token issued on each refresh

**Decision:** One-time use with rotation

**Rationale:**
- Detects token theft (reuse of revoked token is suspicious)
- Limits damage from stolen refresh token (single use only)
- Recommended by OAuth 2.0 best practices and OWASP
- Modern standard (Supabase Auth, Auth0, Firebase Auth all use rotation)

**Consequences:**
- Slightly more complex implementation (track revoked tokens)
- Database write on every refresh (acceptable performance impact)
- Risk of client losing sync if refresh response not received (mitigated by retry logic)

---

### Decision 3: HttpOnly Cookies vs. localStorage

**Date:** 2025-10-30

**Context:** Where to store JWT access tokens in browser?

**Options:**
1. **localStorage** - Accessible to JavaScript, vulnerable to XSS
2. **sessionStorage** - Accessible to JavaScript, lost on tab close
3. **HttpOnly cookies** - NOT accessible to JavaScript, XSS-safe

**Decision:** HttpOnly cookies

**Rationale:**
- XSS attacks cannot steal tokens from HttpOnly cookies
- Automatic inclusion in requests (no manual header management)
- SameSite attribute provides CSRF protection
- Industry best practice for authentication tokens

**Consequences:**
- Cannot access token directly in JavaScript (acceptable, server handles verification)
- Must handle CORS carefully (credentials: 'include')
- More secure against common attack vectors

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `03-security/security-model.md` - Zero-knowledge architecture (master key separate from auth token)
- [ ] `03-security/auth/authentication-flow.md` - Login flows (email/password, OAuth)
- [ ] `TECH-STACK.md` - Supabase Auth, Cloudflare Workers specifications
- [ ] `GLOSSARY.md` - JWT, refresh token, session terminology

**External Services:**
- **Supabase Auth** - JWT generation, refresh token management, credential verification
- **Cloudflare Workers** - JWT verification at edge, request routing
- **PostgreSQL (Supabase)** - Refresh token storage, revocation tracking

### Architecture Dependencies

**Depends on these components:**
- `auth.users` table (Supabase managed) - User accounts
- `refresh_tokens` table (custom) - Refresh token storage

**Required by these components:**
- `05-api/endpoints/*` - All API endpoints require authentication
- `07-frontend/auth-integration.md` - Frontend session management
- `08-features/*` - All features require authenticated users

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge architecture
- `03-security/auth/authentication-flow.md` - Authentication flows
- `TECH-STACK.md` - Technology specifications
- `GLOSSARY.md` - Terminology definitions

### External Resources
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 specification
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519) - JSON Web Token specification
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) - Best practices
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) - Supabase Auth integration
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics) - Token handling security

### Standards Referenced
- **OAuth 2.0** - Token-based authentication framework
- **JWT (RFC 7519)** - JSON Web Token standard
- **HMAC-SHA256** - Token signature algorithm
- **HttpOnly Cookies** - Secure token storage in browsers

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineering | Initial session management architecture documentation |

---

## Notes

### Future Enhancements
- **Biometric authentication (WebAuthn):** Use device biometrics instead of password (Phase 3)
- **Geographic anomaly detection:** Alert on login from unusual location (Phase 3)
- **Concurrent session limits:** Enforce maximum active sessions per user (Enterprise feature)
- **Device fingerprinting:** Bind sessions to device characteristics (Phase 4)
- **Refresh token reuse detection:** More sophisticated anomaly detection (Phase 4)

### Known Limitations
- JavaScript cannot guarantee secure memory wiping (master encryption key vulnerability)
- Refresh token storage in database creates slight performance overhead (acceptable)
- 15-minute JWT expiration requires periodic refresh (seamless to users)

### Next Review Date
**2026-01-30** - Review token expiration times, assess refresh frequency, update for new security standards
