---
Document: Authentication Flow - Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/security-model.md, GLOSSARY.md, TECH-STACK.md
---

# Authentication Flow Architecture

## Overview

This document defines the complete authentication architecture for Abyrith, including how users authenticate, how sessions are managed, and how the master password is handled in a zero-knowledge architecture. Abyrith uses Supabase Auth for identity management while maintaining zero-knowledge encryption through careful master password handling.

**Purpose:** Ensure secure user authentication while preserving zero-knowledge encryption guarantees. The server must be able to authenticate users without ever having access to their master password or decryption keys.

**Scope:** User authentication, session management, JWT token lifecycle, master password handling, and integration with Supabase Auth.

**Status:** Draft - Implementation pending

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [API Contracts](#api-contracts)
7. [Security Architecture](#security-architecture)
8. [Performance Characteristics](#performance-characteristics)
9. [Scalability](#scalability)
10. [Failure Modes](#failure-modes)
11. [Alternatives Considered](#alternatives-considered)
12. [Decision Log](#decision-log)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith must authenticate users to control access to encrypted secrets while maintaining a zero-knowledge architecture where the server never has access to unencrypted secrets or the master encryption key.

**Pain points:**
- Traditional authentication stores passwords on the server
- Zero-knowledge architecture requires master password to stay client-side only
- Need to support multiple authentication methods (email/password, OAuth, MFA)
- Must handle session management across browser sessions and devices
- Recovery mechanisms must work without server knowing master password

**Why now?**
Authentication is the foundation of the security model. Every other feature depends on secure, zero-knowledge authentication being properly implemented.

### Background

**Existing system:**
This is a greenfield implementation. No existing authentication system.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Security Lead | Zero-knowledge architecture preserved | Master password never transmitted, recovery mechanisms secure |
| Backend Engineer | Reliable authentication | Supabase Auth integration, session management, token refresh |
| Frontend Engineer | Seamless user experience | Fast authentication, persistent sessions, clear error states |
| End Users | Easy access, secure | Simple login, don't lose access to secrets, understand security |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Authenticate users** - Verify user identity using email/password or OAuth (success metric: < 2s authentication time p95)
2. **Preserve zero-knowledge** - Master password never leaves client, server cannot decrypt secrets (success metric: 100% of secrets remain encrypted server-side)
3. **Support multiple auth methods** - Email/password, Google OAuth, GitHub OAuth, magic links (success metric: All 4 methods working in MVP)
4. **Secure session management** - JWT-based sessions with automatic refresh, secure storage (success metric: No session hijacking vulnerabilities in security audit)

**Secondary goals:**
- Support multi-factor authentication (TOTP)
- Enable seamless cross-device authentication
- Provide audit trail of authentication events

### Non-Goals

**Explicitly out of scope:**
- **Enterprise SSO (SAML)** - Post-MVP feature, separate implementation
- **Biometric authentication** - WebAuthn/passkeys are future enhancement
- **Password recovery with AI** - Too complex for MVP, standard email flow only
- **Social auth beyond Google/GitHub** - Limit OAuth providers for MVP

### Success Metrics

**How we measure success:**
- **Authentication Speed**: p95 < 2 seconds from submit to authenticated state
- **Session Persistence**: 99.9% of sessions survive browser restart
- **Zero-Knowledge Compliance**: 0 master passwords logged or stored server-side
- **Security Audit**: 0 critical or high vulnerabilities in auth flow

---

## Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────┐
│                  Browser                         │
│  ┌────────────────────────────────────────────┐  │
│  │         React Frontend                     │  │
│  │  • Login form                              │  │
│  │  • Master password input                   │  │
│  │  • Key derivation (PBKDF2)                 │  │
│  │  • Encrypted key storage (IndexedDB)       │  │
│  └──────────────┬─────────────────────────────┘  │
│                 │ HTTPS + JWT                    │
└─────────────────┼────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         Cloudflare Workers (Edge)               │
│  • JWT verification                             │
│  • Rate limiting                                │
│  • Request routing                              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│              Supabase Backend                    │
│  ┌────────────────────────────────────────────┐  │
│  │         Supabase Auth                      │  │
│  │  • User identity management                │  │
│  │  • JWT token generation                    │  │
│  │  • OAuth provider integration              │  │
│  │  • MFA (TOTP) verification                 │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │         PostgreSQL                         │  │
│  │  • auth.users (Supabase managed)           │  │
│  │  • User metadata                           │  │
│  │  • Session records                         │  │
│  │  • Audit logs (auth events)                │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Frontend Authentication Layer**
- **Purpose:** Handle user credentials, derive encryption keys, manage local session state
- **Technology:** React 18.3.x, Web Crypto API, Supabase Auth Helpers 0.10.x
- **Responsibilities:**
  - Master password collection (never sent to server)
  - Key derivation using PBKDF2
  - Authentication account password (separate from master password)
  - JWT token storage and refresh
  - Encrypted master key storage in IndexedDB

**Component 2: Cloudflare Workers API Gateway**
- **Purpose:** Verify JWT tokens, enforce rate limits, route authenticated requests
- **Technology:** Cloudflare Workers (TypeScript), Supabase JWT verification
- **Responsibilities:**
  - Validate JWT signature and expiration
  - Extract user ID and organization ID from JWT claims
  - Rate limiting per user and per IP
  - Forward authenticated requests to Supabase

**Component 3: Supabase Auth Service**
- **Purpose:** Manage user identities, generate JWT tokens, handle OAuth flows
- **Technology:** Supabase Auth (PostgreSQL 15.x backend)
- **Responsibilities:**
  - User registration and login
  - Password hashing and verification (for account password)
  - OAuth 2.0 flows (Google, GitHub)
  - JWT token generation with custom claims
  - MFA enrollment and verification
  - Magic link generation and validation

**Component 4: PostgreSQL Database**
- **Purpose:** Store user identities, session metadata, audit logs
- **Technology:** PostgreSQL 15.x (managed by Supabase)
- **Responsibilities:**
  - Store user accounts (auth.users table)
  - Store authentication audit logs
  - Store user preferences and metadata
  - Enforce Row-Level Security (RLS) policies

### Component Interactions

**Frontend ↔ Supabase Auth:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: API key (public) + JWT (after authentication)

**Frontend ↔ Cloudflare Workers:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: JWT Bearer token in Authorization header

**Cloudflare Workers ↔ Supabase:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: Service role key (server-side only)

---

## Component Details

### Component: Frontend Authentication Layer

**Purpose:** Manage the dual-password system: account password (sent to server) and master password (client-only for encryption).

**Responsibilities:**
- Collect and validate user credentials
- Derive encryption key from master password using PBKDF2
- Store encrypted master key in browser (IndexedDB)
- Manage JWT tokens (storage, refresh)
- Handle authentication state (logged in/out)
- Provide authentication context to React components

**Technology Stack:**
- React 18.3.x - UI components
- Supabase Auth Helpers 0.10.x - Next.js integration
- Web Crypto API - PBKDF2 key derivation
- IndexedDB - Encrypted key storage
- Zustand 4.5.x - Authentication state management

**Internal Architecture:**
```
┌──────────────────────────────────────┐
│     Authentication Context           │
│  • User state                        │
│  • Session token                     │
│  • Master key (in memory only)       │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│     Auth Service Layer               │
│  • login(email, password, masterPw)  │
│  • logout()                          │
│  • refreshSession()                  │
│  • deriveKey(masterPassword)         │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│     Storage Layer                    │
│  • IndexedDB (encrypted master key)  │
│  • Session storage (JWT tokens)      │
│  • Memory (decrypted master key)     │
└──────────────────────────────────────┘
```

**Key Functions:**

```typescript
// Master password key derivation
async function deriveMasterKey(
  masterPassword: string,
  userSalt: string
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  // 600,000 iterations (OWASP recommendation for 2023)
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(userSalt),
      iterations: 600000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  return key;
}

// Authentication with dual-password system
async function login(
  email: string,
  accountPassword: string, // Sent to Supabase
  masterPassword: string    // Client-only, never sent
): Promise<AuthResponse> {
  // 1. Authenticate with Supabase (account password)
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password: accountPassword
  });

  if (error || !authData.user) {
    throw new Error('Authentication failed');
  }

  // 2. Derive master key from master password
  const userSalt = authData.user.id; // Use user ID as salt
  const masterKey = await deriveMasterKey(masterPassword, userSalt);

  // 3. Store encrypted master key in IndexedDB
  // (Encrypted with a key derived from the session token)
  await storeEncryptedMasterKey(masterKey, authData.session.access_token);

  // 4. Keep master key in memory for current session
  setMasterKeyInMemory(masterKey);

  return {
    user: authData.user,
    session: authData.session,
    masterKeyReady: true
  };
}
```

### Component: Cloudflare Workers API Gateway

**Purpose:** Act as the authentication enforcement point for all API requests.

**Responsibilities:**
- Verify JWT signature using Supabase public key
- Extract and validate JWT claims (user_id, org_id, role, exp)
- Enforce rate limits per user and per IP
- Add user context to forwarded requests
- Handle token refresh requests

**Configuration:**
```typescript
interface WorkerAuthConfig {
  supabaseUrl: string;           // Supabase project URL
  supabaseAnonKey: string;       // Public anon key
  supabaseJwtSecret: string;     // JWT verification secret
  rateLimitPerMinute: number;    // 60 requests per minute
  rateLimitPerHour: number;      // 1000 requests per hour
}
```

**JWT Verification:**
```typescript
import { createClient } from '@supabase/supabase-js';

async function verifyJWT(request: Request): Promise<JWTPayload | null> {
  // Extract Bearer token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Verify JWT using Supabase client
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  // Return validated payload
  return {
    sub: user.id,              // User ID
    email: user.email,
    org_id: user.user_metadata.org_id,
    role: user.role,
    iat: user.created_at,
    exp: user.exp
  };
}
```

### Component: Supabase Auth Service

**Purpose:** Manage user identities and generate JWT tokens for authenticated sessions.

**Responsibilities:**
- User registration (email verification)
- Password-based authentication
- OAuth 2.0 flows (Google, GitHub)
- JWT token generation with custom claims
- Token refresh
- MFA enrollment and verification
- Magic link generation

**JWT Structure:**
```typescript
interface SupabaseJWTPayload {
  // Standard JWT claims
  aud: 'authenticated';          // Audience
  exp: number;                   // Expiration (Unix timestamp)
  iat: number;                   // Issued at (Unix timestamp)
  iss: string;                   // Issuer (Supabase project URL)
  sub: string;                   // Subject (User ID)

  // User identity
  email: string;
  phone?: string;
  role: 'authenticated';         // Role in Supabase context

  // Custom claims (Abyrith-specific)
  app_metadata: {
    provider: string;            // 'email' | 'google' | 'github'
    providers: string[];         // List of linked auth providers
  };

  user_metadata: {
    org_id?: string;             // Primary organization ID
    display_name?: string;       // User's display name
    avatar_url?: string;         // Profile picture URL
  };
}
```

**OAuth Configuration:**
```typescript
// Supabase dashboard configuration
{
  "providers": {
    "google": {
      "enabled": true,
      "client_id": "YOUR_GOOGLE_CLIENT_ID",
      "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
      "redirect_uri": "https://app.abyrith.com/auth/callback"
    },
    "github": {
      "enabled": true,
      "client_id": "YOUR_GITHUB_CLIENT_ID",
      "client_secret": "YOUR_GITHUB_CLIENT_SECRET",
      "redirect_uri": "https://app.abyrith.com/auth/callback"
    }
  }
}
```

---

## Data Flow

### Flow 1: Email/Password Login with Master Password

**Trigger:** User submits login form with email, account password, and master password.

**Steps:**

1. **Frontend: Validate Input**
   ```typescript
   // Validate email format
   if (!isValidEmail(email)) {
     throw new Error('Invalid email format');
   }

   // Validate account password (min 12 characters)
   if (accountPassword.length < 12) {
     throw new Error('Account password must be at least 12 characters');
   }

   // Validate master password (min 16 characters)
   if (masterPassword.length < 16) {
     throw new Error('Master password must be at least 16 characters');
   }
   ```

2. **Frontend: Authenticate with Supabase**
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password: accountPassword // Only account password sent
   });
   ```

3. **Supabase Auth: Verify Credentials**
   - Hash account password and compare with stored hash
   - Generate JWT token if valid
   - Return user object and session

4. **Frontend: Derive Master Key**
   ```typescript
   const userSalt = data.user.id;
   const masterKey = await deriveMasterKey(masterPassword, userSalt);
   ```

5. **Frontend: Verify Master Key is Correct**
   ```typescript
   // Attempt to decrypt a test secret to verify key is correct
   const testSecret = await fetchTestSecret(data.user.id);
   try {
     await decrypt(testSecret.encrypted_value, masterKey);
   } catch (error) {
     throw new Error('Incorrect master password');
   }
   ```

6. **Frontend: Store Encrypted Master Key**
   ```typescript
   // Derive storage key from session token
   const storageKey = await deriveStorageKey(data.session.access_token);

   // Encrypt master key with storage key
   const encryptedMasterKey = await encrypt(masterKey, storageKey);

   // Store in IndexedDB
   await indexedDB.put('encrypted_master_key', encryptedMasterKey);
   ```

7. **Frontend: Update Authentication State**
   ```typescript
   authStore.setState({
     user: data.user,
     session: data.session,
     masterKey: masterKey, // Keep in memory
     isAuthenticated: true
   });
   ```

**Sequence Diagram:**
```
User       Frontend      Supabase Auth    Database
  |             |               |             |
  |--login----->|               |             |
  |  (email,    |               |             |
  |   acctPw,   |               |             |
  |   masterPw) |               |             |
  |             |               |             |
  |             |--signIn------>|             |
  |             | (email,       |             |
  |             |  acctPw)      |             |
  |             |               |             |
  |             |               |--verify---->|
  |             |               |  password   |
  |             |               |<--result----|
  |             |               |             |
  |             |<--JWT---------|             |
  |             |  + user       |             |
  |             |               |             |
  |             |--deriveKey----|             |
  |             | (masterPw)    |  (client)   |
  |             |<--masterKey---|             |
  |             |               |             |
  |             |--verify------>|             |
  |             | (test decrypt)|             |
  |             |               |--fetch----->|
  |             |               |  test       |
  |             |               |  secret     |
  |             |               |<--data------|
  |             |<--success-----|             |
  |             |               |             |
  |<--success---|               |             |
  |  redirect   |               |             |
```

**Data Transformations:**
- **Point A (User input):** Plain text passwords (account + master)
- **Point B (Network):** Only account password sent over HTTPS, master password never transmitted
- **Point C (Server):** Account password hashed (bcrypt), JWT token generated
- **Point D (Client storage):** Master key encrypted and stored in IndexedDB
- **Point E (Memory):** Master key kept in memory as CryptoKey object

---

### Flow 2: OAuth Login (Google/GitHub)

**Trigger:** User clicks "Sign in with Google" or "Sign in with GitHub"

**Steps:**

1. **Frontend: Initiate OAuth Flow**
   ```typescript
   const { data, error } = await supabase.auth.signInWithOAuth({
     provider: 'google', // or 'github'
     options: {
       redirectTo: 'https://app.abyrith.com/auth/callback',
       scopes: 'email profile' // Request minimal scopes
     }
   });
   ```

2. **Frontend: Redirect to OAuth Provider**
   - Browser redirects to Google/GitHub authorization page
   - User authenticates with their Google/GitHub account
   - User grants permission to Abyrith

3. **OAuth Provider: Redirect to Callback**
   - Provider redirects back to `https://app.abyrith.com/auth/callback`
   - URL includes authorization code

4. **Frontend: Exchange Code for Session**
   ```typescript
   // Supabase Auth Helpers automatically handles this in Next.js
   // Exchanges authorization code for JWT session
   const { data: { session } } = await supabase.auth.getSession();
   ```

5. **Frontend: Prompt for Master Password**
   ```typescript
   // First-time OAuth users: Set master password
   if (isFirstTimeOAuthUser(session.user)) {
     return <SetMasterPasswordModal />;
   }

   // Returning OAuth users: Enter existing master password
   return <EnterMasterPasswordModal />;
   ```

6. **Frontend: Derive and Verify Master Key**
   - Same as Flow 1, steps 4-7

**Important Note:** OAuth only handles account authentication. Master password is still required for zero-knowledge encryption and is set/entered separately.

---

### Flow 3: Session Refresh

**Trigger:** JWT token is approaching expiration (15 minutes before expiry)

**Steps:**

1. **Frontend: Detect Token Expiration**
   ```typescript
   useEffect(() => {
     const checkTokenExpiry = () => {
       const session = authStore.getState().session;
       const expiresAt = session.expires_at;
       const now = Date.now() / 1000;

       // Refresh 15 minutes before expiry
       if (expiresAt - now < 900) {
         refreshSession();
       }
     };

     const interval = setInterval(checkTokenExpiry, 60000); // Check every minute
     return () => clearInterval(interval);
   }, []);
   ```

2. **Frontend: Request Token Refresh**
   ```typescript
   const { data, error } = await supabase.auth.refreshSession();
   ```

3. **Supabase Auth: Verify Refresh Token**
   - Validate refresh token from cookie/storage
   - Generate new access token
   - Generate new refresh token (token rotation)

4. **Frontend: Update Session**
   ```typescript
   authStore.setState({
     session: data.session
   });

   // Re-encrypt master key with new session token
   await reEncryptMasterKey(data.session.access_token);
   ```

---

### Flow 4: Logout

**Trigger:** User clicks logout button or session is terminated

**Steps:**

1. **Frontend: Clear Master Key from Memory**
   ```typescript
   authStore.setState({
     masterKey: null
   });
   ```

2. **Frontend: Sign Out of Supabase**
   ```typescript
   await supabase.auth.signOut();
   ```

3. **Frontend: Clear Local Storage**
   ```typescript
   // Clear encrypted master key
   await indexedDB.delete('encrypted_master_key');

   // Clear authentication state
   authStore.setState({
     user: null,
     session: null,
     isAuthenticated: false
   });
   ```

4. **Frontend: Redirect to Login**
   ```typescript
   router.push('/login');
   ```

---

## API Contracts

### Internal APIs

**API: Authentication State Management**

**Purpose:** Provide React components with authentication context

**Interface:**
```typescript
interface AuthContext {
  // User state
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Master key state (in memory only)
  masterKeyReady: boolean;

  // Actions
  login: (email: string, accountPassword: string, masterPassword: string) => Promise<void>;
  loginWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;

  // Master key management
  setMasterPassword: (password: string) => Promise<void>;
  unlockWithMasterPassword: (password: string) => Promise<void>;
  lockMasterKey: () => void;
}
```

**Usage:**
```typescript
const { login, isAuthenticated, user } = useAuth();

const handleLogin = async (email: string, accountPw: string, masterPw: string) => {
  try {
    await login(email, accountPw, masterPw);
    router.push('/dashboard');
  } catch (error) {
    setError(error.message);
  }
};
```

**Error Handling:**
- `AuthError: Invalid credentials` - Account password is incorrect
- `AuthError: Incorrect master password` - Master password cannot decrypt secrets
- `AuthError: Email not verified` - User must verify email before logging in
- `AuthError: MFA required` - User must complete MFA verification

---

## Security Architecture

### Trust Boundaries

**Boundary 1: User's Browser ↔ Internet**
- **Threats:** Man-in-the-middle attacks, session hijacking, credential theft
- **Controls:**
  - All traffic over HTTPS (TLS 1.3)
  - Secure cookie flags (HttpOnly, Secure, SameSite=Strict)
  - JWT tokens instead of session cookies
  - Master password never transmitted

**Boundary 2: Cloudflare Workers ↔ Supabase**
- **Threats:** Unauthorized access to backend, token tampering
- **Controls:**
  - Service role key authentication (server-side only)
  - JWT signature verification
  - Rate limiting to prevent abuse
  - Request validation

**Boundary 3: Client Code ↔ User's Input**
- **Threats:** XSS attacks, credential stuffing, brute force
- **Controls:**
  - React's built-in XSS protection
  - Content Security Policy (CSP) headers
  - Rate limiting on authentication endpoints
  - Password strength requirements (zxcvbn)

### Authentication & Authorization

**Authentication:**
- **Method:** Email/password OR OAuth 2.0 (Google, GitHub)
- **Token format:** JWT (JSON Web Token)
- **Token lifecycle:**
  - Access token: 1 hour expiration
  - Refresh token: 30 days expiration (rolling)
  - Automatic refresh 15 minutes before expiry

**Authorization:**
- **Model:** RBAC (Role-Based Access Control)
- **Enforcement points:**
  - Client-side: UI element visibility (not security boundary)
  - API Gateway (Workers): JWT verification, rate limiting
  - Database (PostgreSQL): Row-Level Security (RLS) policies
- **Permission evaluation:** JWT claims (user_id, org_id, role) evaluated in RLS policies

### Data Security

**Data at Rest:**
- **Encryption:** Secrets encrypted with AES-256-GCM using user's master key
- **Storage:**
  - Encrypted secrets: PostgreSQL database
  - Master key: Never stored server-side
  - Encrypted master key (client): IndexedDB (encrypted with session-derived key)
- **Access controls:** RLS policies enforce data isolation per user/organization

**Data in Transit:**
- **Encryption:** TLS 1.3 for all network communication
- **Certificate management:** Automated via Cloudflare
- **Sensitive data:**
  - Master password: Never transmitted (client-only)
  - Account password: Transmitted over HTTPS to Supabase Auth
  - Encrypted secrets: Transmitted over HTTPS, remain encrypted

**Data in Use:**
- **Processing:**
  - Master key: Kept in memory as CryptoKey object (non-extractable)
  - Decrypted secrets: Only in memory, never written to disk
- **Temporary storage:** None - all decryption happens in memory
- **Memory security:** CryptoKey objects are non-extractable, cleared on logout

### Threat Model

**Threat 1: Compromised Server**
- **Description:** Attacker gains access to Supabase database or Workers code
- **Likelihood:** Low (managed services with security controls)
- **Impact:** Medium (can see encrypted secrets but cannot decrypt)
- **Mitigation:**
  - Zero-knowledge architecture: Server never has master key
  - All secrets encrypted client-side
  - Audit logs detect unusual access patterns
  - Regular security audits and penetration testing

**Threat 2: Stolen JWT Token**
- **Description:** Attacker steals JWT token from user's browser
- **Likelihood:** Medium (XSS, malware, network sniffing)
- **Impact:** High (can access user's account and encrypted secrets)
- **Mitigation:**
  - HttpOnly cookies for refresh tokens (where possible)
  - Short token expiration (1 hour)
  - Token rotation on refresh
  - IP-based anomaly detection (future)
  - MFA for sensitive operations

**Threat 3: Master Password Compromise**
- **Description:** Attacker obtains user's master password
- **Likelihood:** Low (never transmitted, not stored)
- **Impact:** Critical (can decrypt all secrets)
- **Mitigation:**
  - Master password never leaves client
  - Strong password requirements (16+ characters, entropy check)
  - Optional recovery key (separate from master password)
  - Audit logs track secret decryption events
  - Rate limiting prevents brute force

**Threat 4: Account Password Compromise**
- **Description:** Attacker obtains user's account password
- **Likelihood:** Medium (phishing, credential stuffing, data breaches)
- **Impact:** Medium (can log in but cannot decrypt secrets without master password)
- **Mitigation:**
  - Separate account password from master password
  - MFA (TOTP) adds second factor
  - Breach detection (HaveIBeenPwned integration, future)
  - Password strength requirements
  - Rate limiting on login attempts

**Threat 5: OAuth Provider Compromise**
- **Description:** Attacker compromises user's Google/GitHub account
- **Likelihood:** Low (well-protected providers)
- **Impact:** Medium (can log in but still need master password)
- **Mitigation:**
  - Minimal OAuth scopes requested
  - Master password still required for decryption
  - MFA on OAuth provider side (user's responsibility)
  - Option to disable OAuth login

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Authentication (email/password): < 2s p95
- OAuth redirect: < 1s p95
- Token refresh: < 500ms p95
- Master key derivation: < 3s p95 (PBKDF2 is intentionally slow)

**Throughput:**
- Login requests: 1000 requests/minute (global)
- Token refresh: 10,000 requests/minute (global)

**Resource Usage:**
- Memory: < 50MB for auth state management
- CPU: PBKDF2 key derivation is CPU-intensive (intentional security measure)
- Storage: < 5MB IndexedDB for encrypted master key

### Performance Optimization

**Optimizations implemented:**
- **JWT caching:** Cache verified JWT payload in Workers KV (5-minute TTL)
- **PBKDF2 iterations:** 600,000 iterations (balance security vs. UX)
- **Automatic token refresh:** Proactive refresh before expiration prevents login interruptions
- **Session persistence:** Store encrypted master key in IndexedDB for browser restart

**Caching Strategy:**
- **What is cached:**
  - JWT verification result: Cloudflare Workers KV, 5-minute TTL
  - User profile: React Query, 5-minute stale time
- **Cache invalidation:**
  - JWT cache: Auto-expire after 5 minutes
  - User profile: Invalidate on logout, role change

**Database Optimization:**
- **Indexes:**
  - `auth.users.email` - B-tree index for login lookup
  - `auth.sessions.user_id` - B-tree index for session queries
- **Query optimization:**
  - Use prepared statements for auth queries
  - Connection pooling via PgBouncer

---

## Scalability

### Horizontal Scaling

**Components that scale horizontally:**
- **Cloudflare Workers:** Automatically scale to handle millions of requests (zero configuration)
- **Supabase Auth:** Managed service, scales automatically
- **Frontend:** Static site on Cloudflare Pages, scales globally via CDN

**Load balancing:**
- **Strategy:** Cloudflare automatically routes to nearest edge location
- **Health checks:** Automatic via Cloudflare

### Vertical Scaling

**Components that scale vertically:**
- **PostgreSQL:** Supabase managed, can upgrade instance size (not needed for MVP)

**Resource limits:**
- Supabase Free Tier: 500MB database, 50MB storage
- Production: Start with Small instance, scale as needed

### Bottlenecks

**Current bottlenecks:**
- **PBKDF2 computation:** CPU-bound, runs on user's device (intentionally slow for security)
- **Database connections:** Limited by Supabase plan (mitigated by PgBouncer pooling)

**Mitigation strategies:**
- PBKDF2: Iteration count tunable, can reduce if UX feedback indicates too slow
- Database: Supabase handles connection pooling automatically

### Capacity Planning

**Current capacity:**
- Free tier: 50,000 monthly active users (MAU) supported
- Pro tier: 100,000 MAU (if needed)

**Growth projections:**
- Year 1: < 10,000 MAU (well within free tier limits)
- Year 2: < 50,000 MAU (may upgrade to Pro tier)

---

## Failure Modes

### Failure Mode 1: Supabase Auth Unavailable

**Scenario:** Supabase Auth service is down

**Impact:** Users cannot log in or refresh sessions. Existing sessions continue to work until token expiry.

**Detection:** Health check endpoint returns 5xx errors

**Recovery:**
1. Display "Authentication service temporarily unavailable" message
2. Retry login attempts with exponential backoff
3. Existing authenticated users can continue using the app (until token expires)
4. Monitor Supabase status page

**Prevention:** Supabase has 99.9% uptime SLA. Consider caching last known good JWT for grace period.

---

### Failure Mode 2: JWT Token Expired (Refresh Failed)

**Scenario:** User's JWT token expires and automatic refresh fails

**Impact:** User is logged out unexpectedly

**Detection:** API returns 401 Unauthorized

**Recovery:**
1. Attempt silent refresh one more time
2. If refresh fails, redirect to login page
3. Show "Your session has expired, please log in again" message
4. Preserve application state (route, form data) for post-login redirect

**Prevention:**
- Proactive refresh 15 minutes before expiry
- Retry logic with exponential backoff
- Clear error messages to user

---

### Failure Mode 3: Incorrect Master Password After Account Auth

**Scenario:** User successfully authenticates account but enters wrong master password

**Impact:** User is logged in but cannot decrypt secrets

**Detection:** Test decryption fails after master key derivation

**Recovery:**
1. Keep user in "partially authenticated" state
2. Prompt for master password again (3 attempts)
3. Offer "Forgot master password?" recovery flow
4. Log out user if max attempts exceeded

**Prevention:**
- Clear separation between account password and master password in UI
- Password manager integration to reduce manual entry errors

---

### Failure Mode 4: Master Key Lost from Memory

**Scenario:** Browser tab crashes or user closes tab before proper logout

**Impact:** User must re-enter master password when returning

**Detection:** Master key not found in memory on page load

**Recovery:**
1. Check for encrypted master key in IndexedDB
2. If found, prompt user to re-enter master password
3. Derive key and compare with test decryption
4. If not found or fails, require full re-authentication

**Prevention:**
- Store encrypted master key in IndexedDB (persists across browser sessions)
- Implement auto-lock timeout (e.g., 15 minutes of inactivity)

---

### Disaster Recovery

**Recovery Time Objective (RTO):** 1 hour

**Recovery Point Objective (RPO):** 5 minutes

**Backup Strategy:**
- **Frequency:** Supabase automated daily backups
- **Retention:** 7 days (free tier), 30 days (pro tier)
- **Location:** Supabase managed, geographically distributed

**Recovery Procedure:**
1. Confirm scope of data loss
2. Contact Supabase support for point-in-time recovery
3. Restore database to last known good state
4. Communicate downtime and data loss to users
5. Investigate root cause and implement fixes

---

## Alternatives Considered

### Alternative 1: Single Password (No Account/Master Split)

**Description:** Use a single password for both account authentication and encryption key derivation.

**Pros:**
- Simpler UX (one password to remember)
- Fewer steps in authentication flow
- Easier onboarding for beginners

**Cons:**
- Server must have access to the password to authenticate (compromises zero-knowledge)
- Password reset becomes extremely complex (requires re-encrypting all secrets)
- Cannot use OAuth (OAuth doesn't provide password for key derivation)

**Why not chosen:** Breaks zero-knowledge architecture. Master password must never be transmitted to server.

---

### Alternative 2: Client-Side Only Authentication (No Server)

**Description:** Store encrypted secrets in browser local storage only, no backend authentication.

**Pros:**
- Truly zero-knowledge (no server at all)
- Maximum privacy
- No backend costs

**Cons:**
- No multi-device sync
- No team collaboration
- Secrets lost if browser data is cleared
- Cannot implement MCP integration (requires server)

**Why not chosen:** Doesn't support multi-device or team collaboration, core features of Abyrith.

---

### Alternative 3: Hardware Security Key (WebAuthn/FIDO2)

**Description:** Use hardware security keys (YubiKey, etc.) for authentication instead of passwords.

**Pros:**
- Very strong phishing resistance
- Better security than passwords
- Modern, forward-looking approach

**Cons:**
- Requires users to purchase hardware ($20-50)
- Not beginner-friendly (our primary persona)
- Limited device support (especially mobile)
- Complex recovery mechanisms

**Why not chosen:** Too high a barrier for beginners. Consider as optional MFA method post-MVP.

---

### Alternative 4: Decentralized Identity (DID)

**Description:** Use blockchain-based decentralized identifiers for authentication.

**Pros:**
- User owns their identity
- No central authority
- Interoperable across services

**Cons:**
- Extremely complex UX
- Requires blockchain knowledge
- High transaction costs
- Still experimental technology

**Why not chosen:** Far too complex for our target personas. Not practical for production.

---

## Decision Log

### Decision 1: Dual-Password System (Account + Master)

**Date:** 2025-10-29

**Context:** Need to balance server-based authentication (for multi-device access) with zero-knowledge encryption.

**Options:**
1. Single password (sent to server) - Breaks zero-knowledge
2. Dual password (account + master) - Requires two passwords
3. Client-only (no server) - No multi-device sync

**Decision:** Implement dual-password system.

**Rationale:**
- Preserves zero-knowledge (master password never transmitted)
- Enables server-based features (multi-device, team collaboration, MCP)
- Users can use password manager for both passwords
- Allows OAuth for account auth while keeping encryption client-side

**Consequences:**
- More complex UX (must explain two passwords)
- Account password reset is simple, but master password reset is complex
- OAuth login still requires master password step

---

### Decision 2: PBKDF2 Iteration Count (600,000)

**Date:** 2025-10-29

**Context:** Must derive encryption key from master password using PBKDF2. How many iterations?

**Options:**
1. 100,000 iterations (NIST 2017 recommendation)
2. 600,000 iterations (OWASP 2023 recommendation)
3. 1,000,000 iterations (maximum security)

**Decision:** 600,000 iterations

**Rationale:**
- OWASP 2023 recommendation for password-based encryption
- Balances security (brute-force resistance) with UX (3-5 second derivation time)
- Modern devices can handle this without excessive delay
- Higher than minimum, lower than maximum

**Consequences:**
- ~3-5 second delay when deriving key on login
- May need to reduce if user feedback indicates too slow
- Configurable per user if needed (future: let power users choose)

---

### Decision 3: JWT Token Expiration (1 hour access, 30 day refresh)

**Date:** 2025-10-29

**Context:** How long should JWT access tokens and refresh tokens last?

**Options:**
1. Short-lived: 15min access, 7 day refresh
2. Medium-lived: 1hr access, 30 day refresh (chosen)
3. Long-lived: 24hr access, 90 day refresh

**Decision:** 1 hour access token, 30 day refresh token

**Rationale:**
- 1 hour is long enough to avoid frequent refresh interruptions
- 30 days is convenient for returning users (don't have to log in daily)
- Stolen access token has limited window (1 hour)
- Refresh token rotation every refresh adds security

**Consequences:**
- Users auto-logged out after 30 days of inactivity
- Token refresh must be reliable (or users get logged out)
- Audit logs can track token refresh events

---

### Decision 4: OAuth Providers (Google and GitHub Only for MVP)

**Date:** 2025-10-29

**Context:** Which OAuth providers should we support?

**Options:**
1. Just email/password (no OAuth)
2. Google only
3. Google + GitHub
4. Google + GitHub + Microsoft + Apple + Twitter

**Decision:** Google + GitHub for MVP

**Rationale:**
- Google: Most common (billions of users)
- GitHub: Perfect for developer audience
- Microsoft/Apple/Twitter: Lower priority, add post-MVP
- More providers = more maintenance burden

**Consequences:**
- Users with only Microsoft/Apple accounts must use email/password
- Can add more providers easily later (Supabase supports many)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `03-security/security-model.md` - Zero-knowledge architecture defined
- [ ] `04-database/schemas/users-orgs.md` - auth.users table schema (Supabase managed)
- [ ] `GLOSSARY.md` - Terms like JWT, PBKDF2, OAuth defined
- [ ] `TECH-STACK.md` - Supabase Auth, Web Crypto API, Cloudflare Workers specified

**External Services:**
- Supabase Auth - Identity management, JWT generation, OAuth flows
- Google OAuth - "Sign in with Google" provider
- GitHub OAuth - "Sign in with GitHub" provider
- Cloudflare Workers - JWT verification, rate limiting

### Feature Dependencies

**Depends on this authentication flow:**
- Secret encryption/decryption (needs master key)
- Team collaboration (needs user identity)
- MCP integration (needs authenticated sessions)
- Audit logging (needs user context)

**Enables these features:**
- All Abyrith features (authentication is foundation)

---

## References

### Internal Documentation
- `03-security/security-model.md` - Zero-knowledge architecture
- `03-security/encryption-specification.md` - Encryption details
- `03-security/rbac/permissions-model.md` - Authorization model
- `TECH-STACK.md` - Technology decisions (Supabase, Web Crypto API)
- `GLOSSARY.md` - Authentication and encryption terms

### External Resources
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) - Official auth guide
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Browser crypto
- [PBKDF2 Specification (RFC 2898)](https://tools.ietf.org/html/rfc2898) - Key derivation standard
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - Security best practices
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725) - JSON Web Token security

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Documentation Agent | Initial authentication flow architecture |

---

## Notes

### Future Enhancements
- **WebAuthn/FIDO2 support** - Hardware security keys as optional MFA
- **Biometric authentication** - Touch ID / Face ID for mobile apps
- **Social recovery** - Recover master password via trusted friends
- **Device management** - View and revoke sessions on specific devices
- **IP-based anomaly detection** - Flag suspicious login locations
- **HaveIBeenPwned integration** - Warn users of compromised passwords
- **Enterprise SSO (SAML)** - For large organizations

### Known Issues
- **Dual-password UX complexity** - Some users confused by two passwords (mitigate with clear UI and help text)
- **Master password recovery is hard** - By design (zero-knowledge), but creates support burden
- **PBKDF2 derivation time** - 3-5 seconds may feel slow on older devices (tunable if needed)

### Next Review Date
2025-11-29 (review after initial implementation and security audit)
