---
Document: Authentication API Endpoints
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 05-api/api-rest-design.md, 03-security/auth/authentication-flow.md
---

# Authentication API Endpoints

## Overview

This document defines all authentication-related API endpoints for Abyrith, including user login, logout, session management, token refresh, password reset, and multi-factor authentication (MFA). These endpoints integrate with Supabase Auth while maintaining Abyrith's zero-knowledge encryption architecture where the master password never leaves the client.

**Base URL:** `https://api.abyrith.com/v1`

**Resource:** Authentication & Session Management

**Authentication:** Most endpoints require JWT Bearer token (except login, signup, password reset initiation)

---

## Table of Contents

1. [Authentication Overview](#authentication-overview)
2. [Common Patterns](#common-patterns)
3. [Endpoints](#endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Examples](#examples)
7. [Dependencies](#dependencies)
8. [References](#references)
9. [Change Log](#change-log)

---

## Authentication Overview

### Authentication Model

Abyrith uses a **dual-password system** to maintain zero-knowledge encryption:

1. **Account Password:** Used for authentication with the server (Supabase Auth). This password is sent to the server (over HTTPS) for verification.
2. **Master Password:** Used for client-side encryption key derivation. This password NEVER leaves the client device.

### Required Headers

**For authenticated endpoints:**
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**For public endpoints (login, signup, password reset):**
```http
Content-Type: application/json
```

### Token Structure

Supabase generates JWT tokens with the following payload:

```typescript
interface JWTPayload {
  aud: 'authenticated';        // Audience
  exp: number;                 // Expiration timestamp (Unix)
  iat: number;                 // Issued at timestamp (Unix)
  iss: string;                 // Issuer (Supabase project URL)
  sub: string;                 // Subject (User ID - UUID)
  email: string;               // User email address
  phone?: string;              // Phone number (if provided)
  role: 'authenticated';       // Supabase role

  // Custom claims
  app_metadata: {
    provider: string;          // 'email' | 'google' | 'github'
    providers: string[];       // All linked providers
  };

  user_metadata: {
    org_id?: string;           // Primary organization ID
    display_name?: string;     // User display name
    avatar_url?: string;       // Profile picture URL
  };
}
```

### Token Lifecycle

- **Access Token Expiration:** 1 hour
- **Refresh Token Expiration:** 30 days (rolling)
- **Automatic Refresh:** Client should refresh tokens 15 minutes before expiry
- **Token Rotation:** New refresh token issued on each refresh

---

## Common Patterns

### Pagination

Authentication endpoints do not use pagination as they operate on single resources (user sessions).

### Error Response Format

All authentication errors follow this structure:

```typescript
interface AuthErrorResponse {
  error: string;               // Error code (snake_case)
  message: string;             // Human-readable error message
  details?: {                  // Additional error context
    [key: string]: string[];
  };
  request_id?: string;         // Request ID for debugging
}
```

### Common Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| 200 | Success | Successful authentication, token refresh |
| 201 | Created | New user registration |
| 204 | No Content | Successful logout |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Invalid credentials, expired token |
| 403 | Forbidden | Account locked, email not verified |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

---

## Endpoints

### 1. Sign Up (Create Account)

**Endpoint:** `POST /auth/signup`

**Description:** Register a new user account with email and account password. Triggers email verification.

**Permissions Required:** None (public endpoint)

**Request:**
```typescript
interface SignUpRequest {
  email: string;              // Valid email address
  account_password: string;   // Account password (min 12 characters)
  display_name?: string;      // Optional display name
}
```

**Example Request:**
```json
POST /auth/signup
{
  "email": "user@example.com",
  "account_password": "SecureAccountPass123!",
  "display_name": "John Developer"
}
```

**Success Response (201 Created):**
```typescript
interface SignUpResponse {
  user: {
    id: string;               // User UUID
    email: string;
    email_confirmed_at: null; // Not confirmed yet
    created_at: string;       // ISO 8601 timestamp
  };
  session: null;              // No session until email verified
  message: string;            // "Check your email to verify your account"
}
```

**Example Response:**
```json
{
  "user": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "user@example.com",
    "email_confirmed_at": null,
    "created_at": "2025-10-30T12:00:00Z"
  },
  "session": null,
  "message": "Check your email to verify your account"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email format or weak password
  ```json
  {
    "error": "validation_error",
    "message": "Invalid request data",
    "details": {
      "email": ["Invalid email format"],
      "account_password": ["Password must be at least 12 characters"]
    }
  }
  ```
- `409 Conflict` - Email already registered
  ```json
  {
    "error": "user_already_exists",
    "message": "A user with this email already exists"
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `email`: Required, valid email format, max 255 characters
- `account_password`: Required, min 12 characters, max 72 characters
- `display_name`: Optional, max 100 characters

**Implementation Notes:**
- Account password is hashed by Supabase Auth (bcrypt)
- Sends verification email automatically
- User cannot log in until email is verified
- Master password is set separately on first login

---

### 2. Login (Email/Password)

**Endpoint:** `POST /auth/login`

**Description:** Authenticate with email and account password. Returns JWT tokens for session management. Client must separately handle master password for encryption.

**Permissions Required:** None (public endpoint)

**Request:**
```typescript
interface LoginRequest {
  email: string;              // User's email
  account_password: string;   // User's account password
}
```

**Example Request:**
```json
POST /auth/login
{
  "email": "user@example.com",
  "account_password": "SecureAccountPass123!"
}
```

**Success Response (200 OK):**
```typescript
interface LoginResponse {
  user: {
    id: string;
    email: string;
    email_confirmed_at: string;
    created_at: string;
    updated_at: string;
    user_metadata: {
      display_name?: string;
      avatar_url?: string;
    };
  };
  session: {
    access_token: string;      // JWT access token (1 hour expiry)
    refresh_token: string;     // Refresh token (30 days expiry)
    expires_in: number;        // Seconds until expiration
    expires_at: number;        // Unix timestamp of expiration
    token_type: 'bearer';
  };
}
```

**Example Response:**
```json
{
  "user": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "user@example.com",
    "email_confirmed_at": "2025-10-30T12:05:00Z",
    "created_at": "2025-10-30T12:00:00Z",
    "updated_at": "2025-10-30T12:00:00Z",
    "user_metadata": {
      "display_name": "John Developer"
    }
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1_refresh_token_here",
    "expires_in": 3600,
    "expires_at": 1730296800,
    "token_type": "bearer"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing credentials
  ```json
  {
    "error": "invalid_request",
    "message": "Email and password are required"
  }
  ```
- `401 Unauthorized` - Invalid credentials
  ```json
  {
    "error": "invalid_credentials",
    "message": "Invalid email or password"
  }
  ```
- `403 Forbidden` - Email not verified
  ```json
  {
    "error": "email_not_confirmed",
    "message": "Please verify your email before logging in"
  }
  ```
- `429 Too Many Requests` - Too many failed login attempts
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Too many login attempts. Please try again in 15 minutes.",
    "retry_after": 900
  }
  ```
- `500 Internal Server Error` - Server error

**Post-Login Client Flow:**
1. Store `access_token` and `refresh_token` securely (memory/IndexedDB)
2. Prompt user for master password (if not already unlocked)
3. Derive master key from master password using PBKDF2
4. Verify master key by attempting to decrypt a test secret
5. Store encrypted master key in IndexedDB for session persistence

---

### 3. Login (OAuth - Google/GitHub)

**Endpoint:** `POST /auth/oauth`

**Description:** Initiate OAuth login flow with Google or GitHub. Returns redirect URL.

**Permissions Required:** None (public endpoint)

**Request:**
```typescript
interface OAuthLoginRequest {
  provider: 'google' | 'github';  // OAuth provider
  redirect_to?: string;            // Post-login redirect URL
}
```

**Example Request:**
```json
POST /auth/oauth
{
  "provider": "google",
  "redirect_to": "https://app.abyrith.com/dashboard"
}
```

**Success Response (200 OK):**
```typescript
interface OAuthLoginResponse {
  provider: string;
  url: string;                    // OAuth authorization URL
}
```

**Example Response:**
```json
{
  "provider": "google",
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

**OAuth Flow:**
1. Client calls `/auth/oauth` endpoint
2. User redirects to provider's authorization page
3. User grants permission
4. Provider redirects back to `https://app.abyrith.com/auth/callback?code=...`
5. Supabase Auth exchanges code for session
6. Client handles session and prompts for master password

**Error Responses:**
- `400 Bad Request` - Invalid provider
  ```json
  {
    "error": "invalid_provider",
    "message": "Provider must be 'google' or 'github'"
  }
  ```
- `500 Internal Server Error` - Server error

**Implementation Notes:**
- OAuth only handles account authentication
- Master password still required for encryption (set on first login, entered on subsequent logins)
- OAuth accounts can be linked to existing email accounts

---

### 4. Logout

**Endpoint:** `POST /auth/logout`

**Description:** End the current session and invalidate refresh token. Client should also clear local storage.

**Permissions Required:** Authenticated user

**Request Headers:**
```http
Authorization: Bearer {access_token}
```

**Request Body:** None

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired token
  ```json
  {
    "error": "unauthorized",
    "message": "Invalid or expired authentication token"
  }
  ```
- `500 Internal Server Error` - Server error

**Client-Side Logout Steps:**
1. Call `/auth/logout` endpoint
2. Clear access token from memory
3. Clear refresh token from storage
4. Clear encrypted master key from IndexedDB
5. Clear master key from memory
6. Redirect to login page

---

### 5. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Description:** Exchange refresh token for new access token and refresh token (token rotation).

**Permissions Required:** Valid refresh token

**Request:**
```typescript
interface RefreshRequest {
  refresh_token: string;      // Current refresh token
}
```

**Example Request:**
```json
POST /auth/refresh
{
  "refresh_token": "v1_refresh_token_here"
}
```

**Success Response (200 OK):**
```typescript
interface RefreshResponse {
  access_token: string;       // New JWT access token
  refresh_token: string;      // New refresh token (rotated)
  expires_in: number;         // Seconds until expiration (3600)
  expires_at: number;         // Unix timestamp
  token_type: 'bearer';
  user: {
    id: string;
    email: string;
    // ... user details
  };
}
```

**Example Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1_new_refresh_token_here",
  "expires_in": 3600,
  "expires_at": 1730300400,
  "token_type": "bearer",
  "user": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "user@example.com"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired refresh token
  ```json
  {
    "error": "invalid_refresh_token",
    "message": "Refresh token is invalid or expired"
  }
  ```
- `500 Internal Server Error` - Server error

**Implementation Notes:**
- Refresh tokens are rotated (new refresh token issued each time)
- Old refresh token is invalidated after use
- Client should refresh proactively (15 minutes before expiry)
- Store new tokens securely, replacing old ones

---

### 6. Password Reset (Request)

**Endpoint:** `POST /auth/password-reset/request`

**Description:** Initiate password reset flow. Sends reset link to user's email.

**Permissions Required:** None (public endpoint)

**Request:**
```typescript
interface PasswordResetRequest {
  email: string;              // User's email address
}
```

**Example Request:**
```json
POST /auth/password-reset/request
{
  "email": "user@example.com"
}
```

**Success Response (200 OK):**
```typescript
interface PasswordResetResponse {
  message: string;
}
```

**Example Response:**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email format
  ```json
  {
    "error": "validation_error",
    "message": "Invalid email format"
  }
  ```
- `429 Too Many Requests` - Too many reset requests
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Too many reset requests. Please try again later.",
    "retry_after": 300
  }
  ```
- `500 Internal Server Error` - Server error

**Implementation Notes:**
- Always returns success message (even if email doesn't exist) to prevent email enumeration
- Reset link expires in 1 hour
- Reset link can only be used once
- Account password reset is separate from master password

**Security Consideration:**
- Resetting account password does NOT reset master password (zero-knowledge)
- User retains access to encrypted secrets after account password reset
- If master password is forgotten, user must use recovery key or lose access to secrets

---

### 7. Password Reset (Confirm)

**Endpoint:** `POST /auth/password-reset/confirm`

**Description:** Complete password reset with token from email and new password.

**Permissions Required:** Valid reset token

**Request:**
```typescript
interface PasswordResetConfirmRequest {
  token: string;              // Reset token from email link
  new_password: string;       // New account password
}
```

**Example Request:**
```json
POST /auth/password-reset/confirm
{
  "token": "reset_token_from_email",
  "new_password": "NewSecurePassword123!"
}
```

**Success Response (200 OK):**
```typescript
interface PasswordResetConfirmResponse {
  message: string;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
    token_type: 'bearer';
  };
}
```

**Example Response:**
```json
{
  "message": "Password reset successful",
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1_refresh_token_here",
    "expires_in": 3600,
    "expires_at": 1730296800,
    "token_type": "bearer"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid or expired token
  ```json
  {
    "error": "invalid_reset_token",
    "message": "Password reset link is invalid or expired"
  }
  ```
- `400 Bad Request` - Weak password
  ```json
  {
    "error": "validation_error",
    "message": "Password does not meet security requirements",
    "details": {
      "new_password": ["Must be at least 12 characters"]
    }
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `new_password`: Min 12 characters, max 72 characters, cannot be same as old password

**Post-Reset Flow:**
1. User is automatically logged in with new session
2. Master password remains unchanged (zero-knowledge)
3. User can immediately access encrypted secrets with existing master password

---

### 8. MFA Enrollment (Generate QR Code)

**Endpoint:** `POST /auth/mfa/enroll`

**Description:** Generate TOTP secret and QR code for MFA enrollment.

**Permissions Required:** Authenticated user

**Request Headers:**
```http
Authorization: Bearer {access_token}
```

**Request Body:** None

**Success Response (200 OK):**
```typescript
interface MFAEnrollResponse {
  id: string;                 // Factor ID
  type: 'totp';
  totp: {
    qr_code: string;          // Base64-encoded QR code image
    secret: string;           // TOTP secret (for manual entry)
    uri: string;              // otpauth:// URI
  };
}
```

**Example Response:**
```json
{
  "id": "factor_a1b2c3d4e5",
  "type": "totp",
  "totp": {
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "secret": "JBSWY3DPEHPK3PXP",
    "uri": "otpauth://totp/Abyrith:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Abyrith"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid token
- `409 Conflict` - MFA already enrolled
  ```json
  {
    "error": "mfa_already_enrolled",
    "message": "MFA is already enabled for this account"
  }
  ```
- `500 Internal Server Error` - Server error

**Enrollment Flow:**
1. User calls `/auth/mfa/enroll`
2. Client displays QR code for user to scan with authenticator app (Google Authenticator, Authy, etc.)
3. User enters code from authenticator to verify enrollment (next endpoint)

---

### 9. MFA Enrollment (Verify and Enable)

**Endpoint:** `POST /auth/mfa/verify`

**Description:** Verify TOTP code and enable MFA on account.

**Permissions Required:** Authenticated user with pending MFA enrollment

**Request:**
```typescript
interface MFAVerifyRequest {
  factor_id: string;          // Factor ID from enrollment response
  code: string;               // 6-digit TOTP code from authenticator
}
```

**Example Request:**
```json
POST /auth/mfa/verify
{
  "factor_id": "factor_a1b2c3d4e5",
  "code": "123456"
}
```

**Success Response (200 OK):**
```typescript
interface MFAVerifyResponse {
  status: 'verified';
  message: string;
}
```

**Example Response:**
```json
{
  "status": "verified",
  "message": "MFA successfully enabled"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid code
  ```json
  {
    "error": "invalid_mfa_code",
    "message": "Invalid verification code"
  }
  ```
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Factor ID not found
  ```json
  {
    "error": "factor_not_found",
    "message": "MFA enrollment not found"
  }
  ```
- `500 Internal Server Error` - Server error

**Post-Verification:**
- MFA is now required for all future logins
- User should save backup codes (future endpoint)

---

### 10. MFA Challenge (Login with MFA)

**Endpoint:** `POST /auth/mfa/challenge`

**Description:** After successful email/password login, verify MFA code to complete authentication.

**Permissions Required:** Pending MFA verification (partial session)

**Request:**
```typescript
interface MFAChallengeRequest {
  factor_id: string;          // Factor ID (from login response)
  code: string;               // 6-digit TOTP code
}
```

**Example Request:**
```json
POST /auth/mfa/challenge
{
  "factor_id": "factor_a1b2c3d4e5",
  "code": "123456"
}
```

**Success Response (200 OK):**
```typescript
interface MFAChallengeResponse {
  access_token: string;       // Full access token
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: 'bearer';
  user: {
    id: string;
    email: string;
    // ... user details
  };
}
```

**Example Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1_refresh_token_here",
  "expires_in": 3600,
  "expires_at": 1730296800,
  "token_type": "bearer",
  "user": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "user@example.com"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid code
  ```json
  {
    "error": "invalid_mfa_code",
    "message": "Invalid verification code"
  }
  ```
- `401 Unauthorized` - No pending MFA challenge
- `429 Too Many Requests` - Too many failed attempts
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Too many failed MFA attempts. Account temporarily locked.",
    "retry_after": 900
  }
  ```
- `500 Internal Server Error` - Server error

**Login Flow with MFA:**
1. User calls `/auth/login` with email and password
2. Server returns partial session with `mfa_required: true`
3. Client prompts for MFA code
4. User calls `/auth/mfa/challenge` with code
5. Server returns full access token upon successful verification

---

### 11. MFA Disable (Unenroll)

**Endpoint:** `POST /auth/mfa/unenroll`

**Description:** Disable MFA for account. Requires password re-authentication.

**Permissions Required:** Authenticated user with MFA enabled

**Request:**
```typescript
interface MFAUnenrollRequest {
  factor_id: string;          // Factor ID to remove
  password: string;           // Account password for verification
}
```

**Example Request:**
```json
POST /auth/mfa/unenroll
{
  "factor_id": "factor_a1b2c3d4e5",
  "password": "SecureAccountPass123!"
}
```

**Success Response (200 OK):**
```typescript
interface MFAUnenrollResponse {
  status: 'unenrolled';
  message: string;
}
```

**Example Response:**
```json
{
  "status": "unenrolled",
  "message": "MFA successfully disabled"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid password
  ```json
  {
    "error": "invalid_credentials",
    "message": "Incorrect password"
  }
  ```
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Factor not found
  ```json
  {
    "error": "factor_not_found",
    "message": "MFA factor not found"
  }
  ```
- `500 Internal Server Error` - Server error

---

### 12. Get Current User

**Endpoint:** `GET /auth/user`

**Description:** Retrieve current authenticated user's details.

**Permissions Required:** Authenticated user

**Request Headers:**
```http
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**
```typescript
interface GetUserResponse {
  id: string;
  email: string;
  email_confirmed_at: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  user_metadata: {
    display_name?: string;
    avatar_url?: string;
    org_id?: string;
  };
  app_metadata: {
    provider: string;
    providers: string[];
  };
}
```

**Example Response:**
```json
{
  "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "email": "user@example.com",
  "email_confirmed_at": "2025-10-30T12:05:00Z",
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T14:00:00Z",
  "user_metadata": {
    "display_name": "John Developer",
    "avatar_url": "https://example.com/avatar.png",
    "org_id": "org_123456"
  },
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired token
  ```json
  {
    "error": "unauthorized",
    "message": "Invalid or expired authentication token"
  }
  ```
- `500 Internal Server Error` - Server error

---

### 13. Update User Profile

**Endpoint:** `PATCH /auth/user`

**Description:** Update user profile information (display name, avatar, etc.).

**Permissions Required:** Authenticated user

**Request:**
```typescript
interface UpdateUserRequest {
  display_name?: string;      // New display name
  avatar_url?: string;        // New avatar URL
}
```

**Example Request:**
```json
PATCH /auth/user
{
  "display_name": "John Smith",
  "avatar_url": "https://example.com/new-avatar.png"
}
```

**Success Response (200 OK):**
```typescript
interface UpdateUserResponse {
  id: string;
  email: string;
  user_metadata: {
    display_name: string;
    avatar_url: string;
  };
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "email": "user@example.com",
  "user_metadata": {
    "display_name": "John Smith",
    "avatar_url": "https://example.com/new-avatar.png"
  },
  "updated_at": "2025-10-30T15:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
  ```json
  {
    "error": "validation_error",
    "message": "Invalid avatar URL format"
  }
  ```
- `401 Unauthorized` - Invalid token
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `display_name`: Optional, max 100 characters
- `avatar_url`: Optional, valid URL format, max 500 characters

---

### 14. Change Account Password

**Endpoint:** `POST /auth/password-change`

**Description:** Change account password (requires current password). Does NOT affect master password.

**Permissions Required:** Authenticated user

**Request:**
```typescript
interface PasswordChangeRequest {
  current_password: string;   // Current account password
  new_password: string;       // New account password
}
```

**Example Request:**
```json
POST /auth/password-change
{
  "current_password": "OldPassword123!",
  "new_password": "NewSecurePassword456!"
}
```

**Success Response (200 OK):**
```typescript
interface PasswordChangeResponse {
  message: string;
}
```

**Example Response:**
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid current password
  ```json
  {
    "error": "invalid_credentials",
    "message": "Current password is incorrect"
  }
  ```
- `400 Bad Request` - Weak new password
  ```json
  {
    "error": "validation_error",
    "message": "New password does not meet security requirements",
    "details": {
      "new_password": ["Must be at least 12 characters"]
    }
  }
  ```
- `401 Unauthorized` - Invalid token
- `500 Internal Server Error` - Server error

**Important Notes:**
- Changing account password does NOT change master password (zero-knowledge)
- User retains access to all encrypted secrets
- All active sessions remain valid (consider option to revoke all sessions)

---

## Error Handling

### Error Response Format

All authentication errors follow this consistent structure:

```typescript
interface AuthErrorResponse {
  error: string;               // Error code in snake_case
  message: string;             // Human-readable error message
  details?: {                  // Optional field-specific errors
    [field: string]: string[];
  };
  request_id?: string;         // Request ID for support/debugging
  retry_after?: number;        // Seconds to wait before retry (for rate limits)
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `validation_error` | Input validation failed |
| 400 | `invalid_request` | Malformed request |
| 401 | `unauthorized` | Missing or invalid authentication |
| 401 | `invalid_credentials` | Wrong email or password |
| 401 | `invalid_refresh_token` | Refresh token expired or invalid |
| 403 | `email_not_confirmed` | Email verification required |
| 403 | `mfa_required` | MFA verification required |
| 404 | `user_not_found` | User does not exist |
| 404 | `factor_not_found` | MFA factor not found |
| 409 | `user_already_exists` | Email already registered |
| 409 | `mfa_already_enrolled` | MFA already enabled |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |

### Error Handling Best Practices

**Client-side handling:**
1. Always check HTTP status code first
2. Parse error response body for specific error codes
3. Display user-friendly error messages (don't expose technical details)
4. Log full error details for debugging (including `request_id`)
5. Implement exponential backoff for 429 errors
6. Handle 401 errors by refreshing token or redirecting to login
7. Clear session on unrecoverable auth errors

**Example Error Handler:**
```typescript
async function handleAuthRequest(endpoint: string, body: any) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();

      switch (error.error) {
        case 'invalid_credentials':
          throw new Error('Incorrect email or password');
        case 'email_not_confirmed':
          throw new Error('Please verify your email before logging in');
        case 'rate_limit_exceeded':
          throw new Error(`Too many attempts. Try again in ${error.retry_after} seconds`);
        default:
          throw new Error(error.message || 'Authentication failed');
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Auth error:', error);
    throw error;
  }
}
```

---

## Rate Limiting

### Rate Limit Rules

**Per IP Address (unauthenticated endpoints):**
- Login attempts: 5 per minute, 20 per hour
- Signup attempts: 3 per minute, 10 per hour
- Password reset requests: 3 per hour
- OAuth initiation: 10 per minute

**Per User (authenticated endpoints):**
- Token refresh: 60 per minute (should be much less in practice)
- MFA verification: 5 attempts per 15 minutes
- Profile updates: 10 per minute
- Password changes: 3 per hour

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1730296800
```

### Rate Limit Exceeded Response

```json
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730296800

{
  "error": "rate_limit_exceeded",
  "message": "Too many login attempts. Please try again later.",
  "retry_after": 900
}
```

**Client Handling:**
- Parse `retry_after` field (seconds)
- Display countdown timer to user
- Disable submit button until rate limit resets
- Consider implementing exponential backoff

---

## Examples

### Example 1: Complete Login Flow (Email/Password with MFA)

**Scenario:** User logs in with email/password and completes MFA verification.

**Step 1: Login with credentials**
```bash
curl -X POST https://api.abyrith.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "account_password": "SecureAccountPass123!"
  }'
```

**Response (MFA Required):**
```json
{
  "mfa_required": true,
  "factor_id": "factor_a1b2c3d4e5",
  "message": "MFA verification required"
}
```

**Step 2: Submit MFA code**
```bash
curl -X POST https://api.abyrith.com/v1/auth/mfa/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "factor_id": "factor_a1b2c3d4e5",
    "code": "123456"
  }'
```

**Response (Success):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1_refresh_token_here",
  "expires_in": 3600,
  "expires_at": 1730296800,
  "token_type": "bearer",
  "user": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "user@example.com"
  }
}
```

**Step 3: Client prompts for master password**
```typescript
// Client-side only (master password never sent to server)
const masterPassword = await promptForMasterPassword();
const masterKey = await deriveMasterKey(masterPassword, user.id);
const isCorrect = await verifyMasterKey(masterKey);
```

---

### Example 2: OAuth Login Flow (Google)

**Step 1: Initiate OAuth**
```bash
curl -X POST https://api.abyrith.com/v1/auth/oauth \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "redirect_to": "https://app.abyrith.com/dashboard"
  }'
```

**Response:**
```json
{
  "provider": "google",
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

**Step 2: Redirect user to OAuth URL**
- Browser redirects to Google
- User authenticates and grants permission
- Google redirects back to `https://app.abyrith.com/auth/callback?code=...`

**Step 3: Supabase Auth handles callback**
- Frontend uses Supabase Auth Helpers to exchange code for session
- Session is automatically stored

**Step 4: Client prompts for master password**
- If first-time OAuth user: Set master password
- If returning user: Enter existing master password

---

### Example 3: Token Refresh Flow

**Scenario:** Access token is about to expire, refresh proactively.

**Step 1: Detect expiration**
```typescript
const session = getSession();
const expiresAt = session.expires_at;
const now = Date.now() / 1000;

// Refresh 15 minutes before expiry
if (expiresAt - now < 900) {
  await refreshSession();
}
```

**Step 2: Refresh token**
```bash
curl -X POST https://api.abyrith.com/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "v1_refresh_token_here"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1_new_refresh_token_here",
  "expires_in": 3600,
  "expires_at": 1730300400,
  "token_type": "bearer"
}
```

**Step 3: Update stored tokens**
```typescript
setSession({
  access_token: response.access_token,
  refresh_token: response.refresh_token,
  expires_at: response.expires_at
});
```

---

### Example 4: Password Reset Flow

**Step 1: Request password reset**
```bash
curl -X POST https://api.abyrith.com/v1/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Response:**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Step 2: User clicks link in email**
- Link contains token: `https://app.abyrith.com/reset-password?token=...`

**Step 3: Submit new password**
```bash
curl -X POST https://api.abyrith.com/v1/auth/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "new_password": "NewSecurePassword456!"
  }'
```

**Response:**
```json
{
  "message": "Password reset successful",
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1_refresh_token_here"
  }
}
```

**Important:** Master password is unchanged. User can still access encrypted secrets.

---

### Example 5: MFA Enrollment Flow

**Step 1: Generate TOTP secret**
```bash
curl -X POST https://api.abyrith.com/v1/auth/mfa/enroll \
  -H "Authorization: Bearer {access_token}"
```

**Response:**
```json
{
  "id": "factor_a1b2c3d4e5",
  "type": "totp",
  "totp": {
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "secret": "JBSWY3DPEHPK3PXP",
    "uri": "otpauth://totp/Abyrith:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Abyrith"
  }
}
```

**Step 2: User scans QR code with authenticator app**

**Step 3: Verify code to enable MFA**
```bash
curl -X POST https://api.abyrith.com/v1/auth/mfa/verify \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "factor_id": "factor_a1b2c3d4e5",
    "code": "123456"
  }'
```

**Response:**
```json
{
  "status": "verified",
  "message": "MFA successfully enabled"
}
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `05-api/api-rest-design.md` - REST API design patterns
- [x] `03-security/auth/authentication-flow.md` - Authentication flow architecture
- [x] `TECH-STACK.md` - Supabase Auth configuration
- [x] `GLOSSARY.md` - Authentication terminology

**External Services:**
- Supabase Auth - User authentication and JWT generation
- Cloudflare Workers - JWT verification and rate limiting
- OAuth Providers - Google and GitHub authentication

### Related APIs

**These APIs interact with authentication:**
- Secrets API (`05-api/endpoints/secrets-endpoints.md`) - Requires authenticated user
- Projects API (`05-api/endpoints/projects-endpoints.md`) - Requires authenticated user
- Organizations API (future) - Requires authenticated user and org membership

---

## References

### Internal Documentation
- `03-security/auth/authentication-flow.md` - Complete authentication architecture
- `03-security/security-model.md` - Zero-knowledge encryption model
- `03-security/rbac/permissions-model.md` - Authorization and permissions
- `TECH-STACK.md` - Supabase Auth configuration
- `GLOSSARY.md` - Authentication terminology definitions

### External Resources
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) - Official Supabase Auth guide
- [JWT Best Practices (RFC 8725)](https://tools.ietf.org/html/rfc8725) - JSON Web Token security
- [OAuth 2.0 Specification (RFC 6749)](https://tools.ietf.org/html/rfc6749) - OAuth standard
- [TOTP Specification (RFC 6238)](https://tools.ietf.org/html/rfc6238) - Time-based OTP
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) - Security best practices

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial authentication API endpoints documentation |

---

## Notes

### Implementation Priority

**P0 (MVP - Must Have):**
- Sign up (email/password)
- Login (email/password)
- Logout
- Token refresh
- Get current user

**P1 (Post-MVP - High Priority):**
- OAuth (Google, GitHub)
- Password reset
- Change password
- Update profile

**P2 (Future Enhancements):**
- MFA enrollment and verification
- MFA unenrollment
- Account linking (multiple OAuth providers)
- Magic link authentication
- Session management (view/revoke active sessions)

### Security Considerations

**Critical Security Requirements:**
1. Master password MUST NEVER be transmitted to server
2. Account password and master password MUST be clearly distinguished in UI
3. JWT tokens MUST be stored securely (not localStorage for refresh tokens)
4. All endpoints MUST use HTTPS (TLS 1.3)
5. Rate limiting MUST be enforced to prevent brute force attacks
6. Password reset links MUST expire and be single-use
7. MFA codes MUST be time-limited and rate-limited

**Zero-Knowledge Implications:**
- Account password reset does NOT reset master password
- User retains access to secrets after account password reset
- If master password is forgotten, encrypted secrets are unrecoverable (by design)
- Recovery key mechanism required for master password recovery (future feature)

### API Design Decisions

**Why dual-password system?**
- Enables server-based authentication (multi-device, team features)
- Preserves zero-knowledge (master password never leaves client)
- Allows OAuth while maintaining encryption (OAuth handles account auth only)

**Why JWT over session cookies?**
- Works better with serverless architecture (Cloudflare Workers)
- Easier to implement cross-origin authentication
- Better for API-first design
- Stateless (no session storage in database)

**Why token rotation on refresh?**
- Limits impact of stolen refresh tokens
- Detects token reuse (security violation)
- Best practice for refresh token security

### Known Limitations

1. **No device management (yet):** Users can't view/revoke sessions on specific devices
2. **No passwordless auth (yet):** Magic links and WebAuthn/passkeys are future features
3. **Limited OAuth providers:** Only Google and GitHub in MVP (Microsoft, Apple, Twitter later)
4. **No account recovery without master password:** Zero-knowledge means we can't help if master password is forgotten (recovery key feature planned)

### Future Enhancements

- Device management (view/revoke active sessions)
- WebAuthn/FIDO2 (hardware security keys)
- Biometric authentication (Touch ID, Face ID)
- Magic link authentication
- Account linking (multiple OAuth providers for same account)
- Recovery key backup (encrypted backup of master key)
- IP-based anomaly detection (flag suspicious login locations)
- HaveIBeenPwned integration (warn about compromised passwords)
- Enterprise SSO (SAML) for large organizations
