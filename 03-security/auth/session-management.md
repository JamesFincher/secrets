---
Document: Session Management - Architecture
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/auth/authentication-flow.md, GLOSSARY.md, TECH-STACK.md
---

# Session Management Architecture

## Overview

This document specifies how Abyrith manages user sessions, including JWT token lifecycle, token refresh strategies, session storage, and master key handling in memory. Session management must balance security (short token lifetimes) with user experience (seamless access) while preserving zero-knowledge encryption guarantees.

**Purpose:** Define secure, reliable session management that keeps users authenticated across devices and browser sessions without compromising the zero-knowledge architecture where master keys never leave the client.

**Scope:** JWT token management, token refresh mechanisms, session storage, concurrent session handling, master key lifecycle in memory, security considerations for XSS and CSRF protection.

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
Web applications need to maintain authenticated sessions for users without requiring constant re-authentication. However, long-lived sessions increase security risks (token theft, unauthorized access), while short-lived sessions harm user experience (frequent logouts).

**Pain points:**
- JWT tokens must be short-lived for security but users expect seamless access
- Master encryption keys must stay in memory but browsers can crash or tabs can close
- Need to support multiple devices and browser sessions concurrently
- Session state must sync between browser tabs
- Logout must be immediate and affect all tabs/devices
- Token refresh must be transparent to users

**Why now?**
Session management is a core security mechanism. Poor session handling creates vulnerabilities (token theft, replay attacks, session fixation) and frustrates users (unexpected logouts, lost work).

### Background

**Existing system:**
This is a greenfield implementation building on Supabase Auth's JWT-based session management.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Security Lead | Secure session handling | Short token expiration, secure storage, prevent token theft |
| Backend Engineer | Reliable authentication | Token refresh logic, session invalidation, concurrent sessions |
| Frontend Engineer | Seamless UX | Transparent refresh, persistent sessions, cross-tab sync |
| End Users | Uninterrupted access | Don't get logged out unexpectedly, work across devices |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Secure token management** - Short-lived access tokens (1 hour), automatic refresh 15 minutes before expiry (success metric: 0 token-related security incidents)
2. **Seamless user experience** - Transparent token refresh, persistent sessions across browser restarts (success metric: <0.1% unexpected logout rate)
3. **Master key lifecycle** - Master key stays in memory only, encrypted backup in IndexedDB (success metric: 0 master keys logged or persisted unencrypted)
4. **Concurrent session support** - Allow multiple devices, with centralized logout (success metric: Logout propagates to all devices within 5 minutes)

**Secondary goals:**
- Session inactivity timeout (configurable, default 30 days)
- Session activity extension (any API call extends session)
- Session revocation on security events (password change, suspicious activity)

### Non-Goals

**Explicitly out of scope:**
- **Biometric session unlock** - Future enhancement, requires WebAuthn
- **Session transfer between devices** - No QR code login for MVP
- **Offline session persistence** - Requires service worker complexity
- **Session analytics** - Detailed session metrics are post-MVP

### Success Metrics

**How we measure success:**
- **Token Security**: 0 incidents of token theft or replay attacks
- **Session Persistence**: 99% of sessions survive browser restart
- **Refresh Reliability**: 99.9% of token refreshes succeed before expiration
- **Logout Speed**: Global logout completes within 5 minutes across all devices

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Tab 1                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │     React Application                            │   │
│  │  • Auth state (Zustand)                          │   │
│  │  • Master key (memory, CryptoKey)                │   │
│  │  • Session check interval (1 min)                │   │
│  └────────────┬─────────────────────────────────────┘   │
│               │                                          │
│  ┌────────────▼─────────────────────────────────────┐   │
│  │     Local Storage Layer                          │   │
│  │  • JWT access token (sessionStorage)             │   │
│  │  • JWT refresh token (httpOnly cookie, if web)   │   │
│  └──────────────────────────────────────────────────┘   │
│               │                                          │
│  ┌────────────▼─────────────────────────────────────┐   │
│  │     IndexedDB                                    │   │
│  │  • Encrypted master key (AES-GCM)                │   │
│  │  • Session metadata (last active, device info)   │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────────────────────┘
                │ HTTPS + JWT
                │ BroadcastChannel (tab sync)
                ▼
┌──────────────────────────────────────────────────────────┐
│           Cloudflare Workers (Edge)                      │
│  • JWT verification                                      │
│  • Token blacklist check (KV)                            │
│  • Rate limiting per user/IP                             │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│               Supabase Backend                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │         Supabase Auth                              │  │
│  │  • JWT token generation                            │  │
│  │  • Token refresh                                   │  │
│  │  • Session invalidation                            │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │         PostgreSQL                                 │  │
│  │  • auth.sessions (Supabase managed)                │  │
│  │  • User sessions metadata                          │  │
│  │  • Refresh token rotation tracking                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Frontend Session Manager**
- **Purpose:** Manage JWT tokens, monitor expiration, trigger refresh, sync across tabs
- **Technology:** React 18.3.x, Zustand 4.5.x, BroadcastChannel API
- **Responsibilities:**
  - Store access token in sessionStorage
  - Monitor token expiration (check every minute)
  - Trigger refresh 15 minutes before expiry
  - Sync authentication state across browser tabs
  - Handle session termination (logout, expired)
  - Manage master key in memory (never persist unencrypted)

**Component 2: Master Key Storage Manager**
- **Purpose:** Securely store and retrieve encrypted master key across browser sessions
- **Technology:** IndexedDB, Web Crypto API
- **Responsibilities:**
  - Encrypt master key with session-derived key before storage
  - Store encrypted master key in IndexedDB
  - Retrieve and decrypt master key on page load
  - Clear master key on logout
  - Handle key rotation when password changes

**Component 3: Token Refresh Manager**
- **Purpose:** Automatically refresh access tokens before expiration
- **Technology:** React hooks, Supabase Auth client
- **Responsibilities:**
  - Calculate time until token expiration
  - Schedule refresh 15 minutes before expiry
  - Execute refresh silently (no UI disruption)
  - Retry on failure (exponential backoff)
  - Handle refresh token rotation
  - Logout on refresh failure after max retries

**Component 4: Cloudflare Workers Session Validator**
- **Purpose:** Verify JWT tokens on every API request
- **Technology:** Cloudflare Workers, Workers KV
- **Responsibilities:**
  - Validate JWT signature using Supabase public key
  - Check token expiration
  - Verify token is not blacklisted (logout, compromised)
  - Enforce rate limits per user
  - Add user context to requests

**Component 5: Supabase Auth Service**
- **Purpose:** Generate, refresh, and invalidate JWT tokens
- **Technology:** Supabase Auth (managed service)
- **Responsibilities:**
  - Generate access tokens (1 hour expiration)
  - Generate refresh tokens (30 day expiration)
  - Rotate refresh tokens on each refresh request
  - Invalidate tokens on logout
  - Track active sessions per user

### Component Interactions

**Frontend ↔ Supabase Auth:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: JWT Bearer token (after initial auth) + Refresh token (httpOnly cookie)

**Frontend ↔ Cloudflare Workers:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: JWT Bearer token in Authorization header

**Cloudflare Workers ↔ Supabase:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: Service role key (server-side only)

**Browser Tabs (cross-tab communication):**
- Protocol: BroadcastChannel API
- Data format: JSON messages
- Purpose: Sync auth state, propagate logout

---

## Component Details

### Component: Frontend Session Manager

**Purpose:** Central orchestration of session lifecycle from the client side.

**Responsibilities:**
- Initialize session state on page load
- Monitor token expiration continuously
- Schedule and execute token refresh
- Handle logout (local and global)
- Sync session state across browser tabs
- Manage error states (token expired, refresh failed)

**Technology Stack:**
- React 18.3.x - Component framework
- Zustand 4.5.x - Auth state management
- Supabase Auth Helpers 0.10.x - Supabase integration
- BroadcastChannel API - Cross-tab communication
- sessionStorage - Access token storage (cleared on browser close)

**Internal Architecture:**
```
┌────────────────────────────────────┐
│   useAuth Hook (Auth Context)     │
│  • isAuthenticated                 │
│  • user                            │
│  • session                         │
│  • masterKeyReady                  │
│  • logout()                        │
│  • refreshSession()                │
└──────────┬─────────────────────────┘
           │
┌──────────▼─────────────────────────┐
│   Session Monitor (useEffect)      │
│  • Check expiration every 1 min    │
│  • Refresh 15 min before expiry    │
│  • Handle inactivity timeout       │
└──────────┬─────────────────────────┘
           │
┌──────────▼─────────────────────────┐
│   Cross-Tab Sync (BroadcastChannel)│
│  • 'auth_state_changed' event      │
│  • 'logout' event                  │
│  • 'token_refreshed' event         │
└────────────────────────────────────┘
```

**Key Functions:**

```typescript
// Session monitoring and automatic refresh
function useSessionMonitor() {
  const { session, refreshSession, logout } = useAuth();

  useEffect(() => {
    // Check token expiration every minute
    const interval = setInterval(async () => {
      if (!session?.access_token) return;

      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;

      // Refresh 15 minutes (900 seconds) before expiry
      if (timeUntilExpiry < 900 && timeUntilExpiry > 0) {
        console.log('[Session] Token expires soon, refreshing...');

        try {
          await refreshSession();
          console.log('[Session] Token refreshed successfully');
        } catch (error) {
          console.error('[Session] Refresh failed:', error);
          // Retry once after 30 seconds
          setTimeout(async () => {
            try {
              await refreshSession();
            } catch (retryError) {
              console.error('[Session] Retry failed, logging out');
              logout();
            }
          }, 30000);
        }
      }

      // Token expired, immediate logout
      if (timeUntilExpiry <= 0) {
        console.warn('[Session] Token expired, logging out');
        logout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [session, refreshSession, logout]);
}

// Token refresh implementation
async function refreshSession(): Promise<Session> {
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    throw new Error('Failed to refresh session');
  }

  // Update session in state
  authStore.setState({
    session: data.session,
    user: data.user
  });

  // Re-encrypt master key with new session token
  await reEncryptMasterKey(data.session.access_token);

  // Broadcast to other tabs
  broadcastChannel.postMessage({
    type: 'token_refreshed',
    session: data.session
  });

  return data.session;
}

// Cross-tab session sync
function useCrossTabSync() {
  const { logout: localLogout } = useAuth();

  useEffect(() => {
    const channel = new BroadcastChannel('abyrith_auth');

    channel.onmessage = (event) => {
      switch (event.data.type) {
        case 'logout':
          // Another tab logged out, logout this tab too
          console.log('[Session] Logout event from another tab');
          localLogout({ skipBroadcast: true });
          break;

        case 'token_refreshed':
          // Another tab refreshed, update session
          console.log('[Session] Token refresh event from another tab');
          authStore.setState({
            session: event.data.session
          });
          break;

        case 'master_key_locked':
          // Master key was locked, clear from memory
          console.log('[Session] Master key locked from another tab');
          authStore.setState({
            masterKey: null,
            masterKeyReady: false
          });
          break;
      }
    };

    return () => channel.close();
  }, [localLogout]);
}

// Logout implementation
async function logout(options?: { skipBroadcast?: boolean }): Promise<void> {
  // 1. Clear master key from memory (immediate)
  authStore.setState({
    masterKey: null,
    masterKeyReady: false
  });

  // 2. Sign out from Supabase
  await supabase.auth.signOut();

  // 3. Clear IndexedDB
  await indexedDB.delete('encrypted_master_key');

  // 4. Clear sessionStorage
  sessionStorage.clear();

  // 5. Broadcast logout to other tabs
  if (!options?.skipBroadcast) {
    const channel = new BroadcastChannel('abyrith_auth');
    channel.postMessage({ type: 'logout' });
    channel.close();
  }

  // 6. Clear Zustand state
  authStore.setState({
    user: null,
    session: null,
    isAuthenticated: false
  });

  // 7. Redirect to login
  router.push('/login');
}
```

### Component: Master Key Storage Manager

**Purpose:** Manage the lifecycle of the master encryption key in a zero-knowledge compliant way.

**Responsibilities:**
- Derive storage encryption key from session token
- Encrypt master key before storing in IndexedDB
- Decrypt master key on page load (if available)
- Clear master key on logout
- Re-encrypt master key when session token refreshes

**Storage Encryption Strategy:**

```typescript
// Derive storage key from session token
async function deriveStorageKey(sessionToken: string): Promise<CryptoKey> {
  // Use session token as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionToken),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key (fast: 10,000 iterations, not for long-term security)
  const storageKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('abyrith-storage-salt'), // Fixed salt OK here
      iterations: 10000, // Fast: this key is only as secure as the session token
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt']
  );

  return storageKey;
}

// Encrypt master key for storage
async function storeEncryptedMasterKey(
  masterKey: CryptoKey,
  sessionToken: string
): Promise<void> {
  // Derive storage key from session token
  const storageKey = await deriveStorageKey(sessionToken);

  // Export master key (must be extractable)
  const masterKeyData = await crypto.subtle.exportKey('raw', masterKey);

  // Generate nonce
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt master key
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    storageKey,
    masterKeyData
  );

  // Store in IndexedDB
  await indexedDB.put('encrypted_master_key', {
    data: Array.from(new Uint8Array(encryptedData)),
    nonce: Array.from(nonce),
    timestamp: Date.now()
  });
}

// Retrieve and decrypt master key
async function retrieveMasterKey(
  sessionToken: string
): Promise<CryptoKey | null> {
  // Get encrypted data from IndexedDB
  const stored = await indexedDB.get('encrypted_master_key');
  if (!stored) return null;

  // Derive storage key from session token
  const storageKey = await deriveStorageKey(sessionToken);

  try {
    // Decrypt master key
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(stored.nonce) },
      storageKey,
      new Uint8Array(stored.data)
    );

    // Import as CryptoKey
    const masterKey = await crypto.subtle.importKey(
      'raw',
      decryptedData,
      { name: 'AES-GCM' },
      true, // extractable (needed for re-encryption)
      ['encrypt', 'decrypt']
    );

    return masterKey;
  } catch (error) {
    // Decryption failed (wrong session token or corrupted data)
    console.error('[Session] Failed to decrypt master key:', error);
    await indexedDB.delete('encrypted_master_key');
    return null;
  }
}

// Re-encrypt master key when session token changes
async function reEncryptMasterKey(newSessionToken: string): Promise<void> {
  const masterKey = authStore.getState().masterKey;
  if (!masterKey) {
    console.warn('[Session] No master key in memory to re-encrypt');
    return;
  }

  // Store with new session token
  await storeEncryptedMasterKey(masterKey, newSessionToken);
  console.log('[Session] Master key re-encrypted with new session token');
}
```

**Security Properties:**
- **Session-bound encryption**: Master key is only accessible with valid session token
- **Automatic cleanup**: If session expires, encrypted master key becomes unrecoverable (by design)
- **No persistent password**: Master password is never stored, only used to derive master key once
- **Session revocation**: Logging out invalidates session token, making encrypted master key inaccessible

### Component: Token Refresh Manager

**Purpose:** Proactively refresh access tokens before expiration.

**Configuration:**
```typescript
interface TokenRefreshConfig {
  accessTokenExpiration: number;   // 1 hour (3600 seconds)
  refreshTokenExpiration: number;  // 30 days (2592000 seconds)
  refreshBeforeExpiry: number;     // 15 minutes (900 seconds)
  maxRetryAttempts: number;        // 3
  retryBackoffMs: number;          // 5000 (5 seconds)
}

const REFRESH_CONFIG: TokenRefreshConfig = {
  accessTokenExpiration: 3600,
  refreshTokenExpiration: 2592000,
  refreshBeforeExpiry: 900,
  maxRetryAttempts: 3,
  retryBackoffMs: 5000
};
```

**Refresh Logic:**
```typescript
async function attemptTokenRefresh(retryCount = 0): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      throw new Error(error?.message || 'Refresh failed');
    }

    // Success: update state
    authStore.setState({
      session: data.session,
      user: data.user
    });

    // Re-encrypt master key with new token
    await reEncryptMasterKey(data.session.access_token);

    // Broadcast to other tabs
    const channel = new BroadcastChannel('abyrith_auth');
    channel.postMessage({
      type: 'token_refreshed',
      session: data.session
    });
    channel.close();

    return true;
  } catch (error) {
    console.error(`[Session] Token refresh attempt ${retryCount + 1} failed:`, error);

    if (retryCount < REFRESH_CONFIG.maxRetryAttempts - 1) {
      // Exponential backoff: 5s, 10s, 20s
      const backoff = REFRESH_CONFIG.retryBackoffMs * Math.pow(2, retryCount);
      console.log(`[Session] Retrying in ${backoff}ms...`);

      await new Promise(resolve => setTimeout(resolve, backoff));
      return attemptTokenRefresh(retryCount + 1);
    } else {
      // Max retries exceeded, force logout
      console.error('[Session] Max refresh retries exceeded, logging out');
      await logout();
      return false;
    }
  }
}
```

### Component: Cloudflare Workers Session Validator

**Purpose:** Server-side enforcement of session validity on every API request.

**JWT Verification:**
```typescript
import { createClient } from '@supabase/supabase-js';

async function validateSession(request: Request, env: Env): Promise<User | null> {
  // Extract JWT token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Check token blacklist (logout, compromised tokens)
  const blacklisted = await env.TOKEN_BLACKLIST.get(`blacklist:${token}`);
  if (blacklisted) {
    console.warn('[Session] Token is blacklisted');
    return null;
  }

  // Verify JWT with Supabase
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('[Session] JWT verification failed:', error);
    return null;
  }

  // Cache successful verification (5 minutes)
  await env.SESSION_CACHE.put(
    `session:${user.id}`,
    JSON.stringify(user),
    { expirationTtl: 300 }
  );

  return user;
}

// Blacklist token on logout
async function blacklistToken(token: string, env: Env): Promise<void> {
  // Store until token would expire anyway (1 hour)
  await env.TOKEN_BLACKLIST.put(`blacklist:${token}`, '1', {
    expirationTtl: 3600
  });
}
```

---

## Data Flow

### Flow 1: Session Initialization (Page Load)

**Trigger:** User opens browser or refreshes page

**Steps:**

1. **Frontend: Check for Existing Session**
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   ```

2. **If session exists:**
   - Verify access token is not expired
   - If expired, attempt refresh
   - If valid, restore authentication state

3. **Frontend: Attempt to Retrieve Master Key**
   ```typescript
   if (session) {
     const masterKey = await retrieveMasterKey(session.access_token);

     if (masterKey) {
       // Success: user is fully authenticated
       authStore.setState({
         user: session.user,
         session: session,
         masterKey: masterKey,
         isAuthenticated: true,
         masterKeyReady: true
       });
     } else {
       // Session valid but no master key, prompt for master password
       authStore.setState({
         user: session.user,
         session: session,
         isAuthenticated: true,
         masterKeyReady: false,
         needsMasterPassword: true
       });
     }
   }
   ```

4. **Frontend: Start Session Monitor**
   - Begin checking token expiration every minute
   - Set up cross-tab sync listeners

**Sequence Diagram:**
```
User       Browser    IndexedDB   Supabase
  |            |          |           |
  |--refresh-->|          |           |
  |            |          |           |
  |            |--check---|           |
  |            |  session |           |
  |            |<---------|           |
  |            |          |           |
  |            |--------getSession--->|
  |            |<--------session------|
  |            |          |           |
  |            |--get---->|           |
  |            |  master  |           |
  |            |  key     |           |
  |            |<-data----|           |
  |            |          |           |
  |            |--decrypt-|           |
  |            |  (local) |           |
  |            |          |           |
  |<--ready----|          |           |
  |  (show UI) |          |           |
```

---

### Flow 2: Automatic Token Refresh

**Trigger:** Access token is 15 minutes away from expiration

**Steps:**

1. **Frontend: Detect Approaching Expiration**
   ```typescript
   const expiresAt = session.expires_at;
   const now = Date.now() / 1000;
   const timeUntilExpiry = expiresAt - now;

   if (timeUntilExpiry < 900) {
     // Refresh needed
     await refreshSession();
   }
   ```

2. **Frontend: Call Supabase Refresh**
   ```typescript
   const { data, error } = await supabase.auth.refreshSession();
   ```

3. **Supabase: Validate Refresh Token**
   - Check refresh token is valid
   - Verify not expired (30 day lifetime)
   - Generate new access token (1 hour lifetime)
   - Rotate refresh token (security best practice)

4. **Frontend: Update Session State**
   - Store new access token
   - Update session in Zustand
   - Re-encrypt master key with new token

5. **Frontend: Broadcast to Other Tabs**
   ```typescript
   const channel = new BroadcastChannel('abyrith_auth');
   channel.postMessage({
     type: 'token_refreshed',
     session: data.session
   });
   ```

**Sequence Diagram:**
```
Frontend   Supabase   IndexedDB   Other Tabs
    |          |          |            |
    |--check---|          |            |
    |  expiry  |          |            |
    |          |          |            |
    |--refresh request--->|            |
    |  (refresh token)    |            |
    |          |          |            |
    |<--new tokens--------|            |
    |  (access + refresh) |            |
    |          |          |            |
    |--re-encrypt-------->|            |
    |  master key         |            |
    |<--------ok----------|            |
    |          |          |            |
    |--broadcast event--------------->|
    |          |          |            |
    |          |          |            |--update--|
    |          |          |            |  state   |
```

---

### Flow 3: Global Logout (All Devices)

**Trigger:** User clicks logout button

**Steps:**

1. **Frontend: Clear Master Key (Immediate)**
   ```typescript
   authStore.setState({
     masterKey: null,
     masterKeyReady: false
   });
   ```

2. **Frontend: Sign Out from Supabase**
   ```typescript
   await supabase.auth.signOut();
   ```

3. **Supabase: Invalidate Session**
   - Mark refresh token as revoked
   - Clear session from database

4. **Frontend: Clear Local Storage**
   - Delete IndexedDB encrypted master key
   - Clear sessionStorage
   - Clear Zustand state

5. **Frontend: Blacklist Current Access Token**
   ```typescript
   // Call API to blacklist token (prevent use until expiry)
   await fetch('/api/auth/blacklist', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${accessToken}` }
   });
   ```

6. **Cloudflare Workers: Add to Blacklist**
   ```typescript
   await env.TOKEN_BLACKLIST.put(`blacklist:${token}`, '1', {
     expirationTtl: 3600
   });
   ```

7. **Frontend: Broadcast Logout to Other Tabs**
   ```typescript
   const channel = new BroadcastChannel('abyrith_auth');
   channel.postMessage({ type: 'logout' });
   ```

8. **Other Tabs: Handle Logout Event**
   - Clear master key
   - Clear local storage
   - Redirect to login

**Sequence Diagram:**
```
Tab 1      Supabase   Workers   Blacklist   Tab 2
  |            |         |           |         |
  |--logout--->|         |           |         |
  |  (signOut) |         |           |         |
  |            |         |           |         |
  |<--ok-------|         |           |         |
  |            |         |           |         |
  |--blacklist request-->|           |         |
  |            |         |           |         |
  |            |         |--add----->|         |
  |            |         |<--ok------|         |
  |            |         |           |         |
  |<--ok-------|<--------|           |         |
  |            |         |           |         |
  |--broadcast logout event--------->|-------->|
  |            |         |           |         |
  |            |         |           |         |--logout--|
  |            |         |           |         |  (local) |
```

---

### Flow 4: Session Inactivity Timeout

**Trigger:** No API calls for 30 days (configurable)

**Steps:**

1. **Supabase: Detect Stale Refresh Token**
   - Refresh token reaches 30 day expiration
   - Token becomes invalid

2. **Frontend: Next API Call Fails**
   ```typescript
   // API returns 401 Unauthorized
   ```

3. **Frontend: Attempt Token Refresh**
   ```typescript
   const { error } = await supabase.auth.refreshSession();
   // Error: Refresh token expired
   ```

4. **Frontend: Force Logout**
   ```typescript
   console.log('[Session] Refresh token expired, logging out');
   await logout();
   ```

5. **Frontend: Show Informative Message**
   ```
   "Your session has expired due to inactivity. Please log in again."
   ```

**Alternative: Activity Extension**

If implementing automatic extension:
- Track last API call timestamp
- Reset refresh token expiration on activity
- Configurable maximum session lifetime (e.g., 90 days hard limit)

---

### Flow 5: Concurrent Session on New Device

**Trigger:** User logs in on a second device

**Steps:**

1. **Device 2: Login**
   - User authenticates with account password + master password
   - New session created with unique refresh token

2. **Supabase: Track Multiple Sessions**
   ```sql
   -- auth.sessions table (Supabase managed)
   user_id | refresh_token | device_info | created_at | last_active
   ```

3. **Device 1: Continue Working**
   - Existing session remains valid
   - Both devices have independent sessions

4. **Logout Strategies:**

   **Option A: Logout Current Device Only (Default)**
   - Invalidate only the refresh token from current device
   - Other devices remain logged in

   **Option B: Logout All Devices**
   - Invalidate all refresh tokens for user
   - Blacklist all current access tokens
   - All devices logged out within 5 minutes (or next API call)

**Configuration:**
```typescript
interface LogoutOptions {
  scope: 'current' | 'all'; // Default: 'current'
}

async function logout(options: LogoutOptions = { scope: 'current' }): Promise<void> {
  if (options.scope === 'all') {
    // Invalidate all sessions for this user
    await supabase.rpc('logout_all_sessions');
  } else {
    // Invalidate only current session
    await supabase.auth.signOut();
  }

  // Local cleanup
  await clearLocalSession();
}
```

---

## API Contracts

### Internal APIs

**API: Session Management Context**

**Interface:**
```typescript
interface SessionContext {
  // Session state
  session: Session | null;
  isSessionValid: boolean;
  expiresAt: number | null;
  timeUntilExpiry: number | null;

  // Actions
  refreshSession: () => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
  lockMasterKey: () => void;
  unlockMasterKey: (masterPassword: string) => Promise<void>;

  // Session info
  deviceInfo: DeviceInfo | null;
  sessionStartedAt: Date | null;
  lastActivityAt: Date | null;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;      // Unix timestamp
  expires_in: number;      // Seconds until expiration
  token_type: 'bearer';
  user: User;
}

interface LogoutOptions {
  scope: 'current' | 'all';
  skipBroadcast?: boolean;
}

interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}
```

**Usage:**
```typescript
const {
  session,
  isSessionValid,
  timeUntilExpiry,
  refreshSession,
  logout,
  lockMasterKey
} = useSession();

// Check session validity
if (!isSessionValid) {
  console.warn('Session is invalid or expired');
}

// Manual refresh
if (timeUntilExpiry && timeUntilExpiry < 600) {
  await refreshSession();
}

// Lock master key (keep session, clear master key from memory)
lockMasterKey();

// Logout
await logout({ scope: 'current' });
```

**Error Handling:**
- `SessionError: Token expired` - Access token has expired, refresh needed
- `SessionError: Refresh failed` - Unable to refresh token, re-login required
- `SessionError: Invalid session` - Session data is corrupted or invalid
- `SessionError: Network error` - Unable to reach authentication service

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Client ↔ Network**
- **Threats:** Man-in-the-middle, token interception, session hijacking
- **Controls:**
  - All traffic over HTTPS (TLS 1.3)
  - JWT tokens instead of session cookies (less vulnerable to CSRF)
  - Short token lifetimes (1 hour access, 30 day refresh)
  - Token rotation on refresh

**Boundary 2: Browser Tabs ↔ Local Storage**
- **Threats:** XSS attacks accessing tokens, malicious extensions
- **Controls:**
  - Content Security Policy (CSP) headers
  - HttpOnly cookies for refresh tokens (where possible)
  - sessionStorage for access tokens (cleared on browser close)
  - Encrypted master key in IndexedDB (session-bound encryption)

**Boundary 3: Cloudflare Workers ↔ Supabase**
- **Threats:** Unauthorized backend access, token forgery
- **Controls:**
  - Service role authentication (server-side only)
  - JWT signature verification
  - Token blacklist for revoked tokens
  - Rate limiting per user and IP

### Session Security Controls

**Token Expiration Strategy:**
| Token Type | Lifetime | Renewal | Storage |
|------------|----------|---------|---------|
| Access Token | 1 hour | Auto-refresh at 45 min | sessionStorage |
| Refresh Token | 30 days | Rotated on refresh | httpOnly cookie (web), secure storage (mobile) |
| Master Key | Session-bound | Re-derived from password | Memory + encrypted IndexedDB backup |

**Token Rotation:**
- Every token refresh generates a new refresh token
- Old refresh token immediately invalidated
- Prevents replay attacks with stolen refresh tokens

**Session Invalidation Triggers:**
- User-initiated logout (any device)
- Password change
- Account compromise detected
- Admin revocation
- Refresh token expiration (30 days inactivity)

### XSS Protection

**Content Security Policy:**
```typescript
// Next.js headers configuration
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.anthropic.com",
      "frame-ancestors 'none'"
    ].join('; ')
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }
];
```

**Input Sanitization:**
- React's built-in XSS protection (auto-escaping)
- Zod validation for all user inputs
- No `dangerouslySetInnerHTML` without sanitization

### CSRF Protection

**Why JWT mitigates CSRF:**
- Tokens stored in JavaScript-accessible storage (not cookies)
- Must be explicitly sent in Authorization header
- Cannot be automatically included by browser (unlike cookies)

**Additional Controls:**
- SameSite=Strict on any cookies (if used)
- Verify Origin/Referer headers on sensitive endpoints
- State parameter on OAuth flows

### Threat Model

**Threat 1: Stolen Access Token**
- **Likelihood:** Medium (XSS, browser extension, network sniffing)
- **Impact:** High (attacker can access user's account for 1 hour)
- **Mitigation:**
  - Short token lifetime (1 hour)
  - CSP headers prevent XSS
  - HTTPS prevents network sniffing
  - Token blacklist on logout
  - Activity anomaly detection (future)

**Threat 2: Stolen Refresh Token**
- **Likelihood:** Low (httpOnly cookies, secure storage)
- **Impact:** Critical (attacker can maintain access for 30 days)
- **Mitigation:**
  - HttpOnly cookies (web) prevent JavaScript access
  - Secure storage (mobile)
  - Token rotation on every refresh
  - Anomaly detection (IP change, unusual device)
  - Logout all sessions on password change

**Threat 3: Session Fixation**
- **Likelihood:** Low (modern frameworks handle this)
- **Impact:** Medium (attacker sets session ID for victim)
- **Mitigation:**
  - New session generated on login
  - Session ID not in URL
  - Supabase Auth handles session lifecycle

**Threat 4: Concurrent Session Abuse**
- **Likelihood:** Medium (stolen credentials, shared accounts)
- **Impact:** Medium (multiple users accessing same account)
- **Mitigation:**
  - Track device info per session
  - Alert on suspicious device additions
  - "Logout all sessions" feature
  - Limit maximum concurrent sessions (enterprise feature)

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Token refresh: < 500ms p95
- Session validation (cached): < 10ms p95
- Session validation (uncached): < 200ms p95
- Logout propagation: < 5 minutes to all devices

**Throughput:**
- Session validations: 100,000 requests/second (edge caching helps)
- Token refreshes: 1,000 requests/second (per instance)

**Resource Usage:**
- Memory: < 10MB per user session (client-side)
- IndexedDB: < 1MB per user (encrypted master key + metadata)
- Workers KV: ~1KB per session (cached validation results)

### Performance Optimization

**Caching Strategy:**

**JWT Verification Caching:**
- Cache successful JWT verifications in Workers KV
- TTL: 5 minutes
- Invalidate on logout
- Reduces database calls by ~95%

```typescript
// Check cache before verifying JWT
const cached = await env.SESSION_CACHE.get(`session:${userId}`);
if (cached) {
  return JSON.parse(cached);
}

// Cache miss: verify and cache
const user = await verifyJWT(token);
await env.SESSION_CACHE.put(`session:${userId}`, JSON.stringify(user), {
  expirationTtl: 300
});
```

**Token Refresh Optimization:**
- Proactive refresh (15 min before expiry) prevents user-facing delays
- Single refresh request per browser (deduplicate across tabs)
- Exponential backoff on retry prevents server overload

**Cross-Tab Sync:**
- BroadcastChannel API (native, no overhead)
- Only sync critical events (login, logout, refresh)
- Throttle broadcasts (max 1 per second)

---

## Scalability

### Horizontal Scaling

**Cloudflare Workers:**
- Automatically scale to millions of requests
- Session validation at edge (globally distributed)
- No configuration needed

**Supabase Auth:**
- Managed service, scales automatically
- Connection pooling via PgBouncer
- Can handle 100,000+ MAU on free tier

### Session Storage Scalability

**Current approach:**
- Client-side: IndexedDB (no server scaling needed)
- Server-side: Supabase Auth manages sessions

**If scaling issues:**
- Redis for session cache (faster than PostgreSQL)
- Separate session database (read replicas)

### Bottlenecks

**Current bottlenecks:**
- Token refresh: Limited by Supabase API rate limits (handled by retry logic)
- JWT verification: Reduced by Workers KV caching

**Future bottlenecks (at scale):**
- Token blacklist: Workers KV has limits (consider Redis if exceeding 10,000 blacklisted tokens)
- Concurrent sessions per user: No hard limit currently (may need enforcement for enterprise)

---

## Failure Modes

### Failure Mode 1: Token Refresh Fails (Network Issue)

**Scenario:** User's network connection drops during token refresh

**Impact:** User might be logged out unexpectedly

**Detection:** Token refresh API returns network error

**Recovery:**
1. Retry with exponential backoff (3 attempts)
2. If all retries fail, keep user in "partially authenticated" state
3. Show warning: "Connection lost, attempting to reconnect..."
4. Continue retrying in background
5. If refresh token expires during retries, force logout

**Prevention:**
- Refresh 15 minutes early (large buffer)
- Implement offline mode (service worker, future)

---

### Failure Mode 2: Master Key Lost from Memory (Browser Crash)

**Scenario:** Browser tab crashes or user closes browser

**Impact:** Master key is cleared from memory, user cannot decrypt secrets

**Detection:** Master key not found in memory on page reload

**Recovery:**
1. Check IndexedDB for encrypted master key
2. Retrieve session token
3. Attempt to decrypt master key
4. If successful, restore full session
5. If decryption fails (corrupted data, wrong token), prompt for master password

**Prevention:**
- Store encrypted master key in IndexedDB (persists across crashes)
- Encrypt with session token (automatically inaccessible when session expires)

---

### Failure Mode 3: Token Blacklist Unavailable

**Scenario:** Workers KV is down or slow

**Impact:** Logged-out users might temporarily access API with old tokens

**Detection:** Workers KV timeouts or errors

**Recovery:**
1. Fall back to JWT signature verification only (don't check blacklist)
2. Allow request to proceed (degraded security, better than downtime)
3. Log warning for security review
4. When KV recovers, blacklist checks resume

**Prevention:**
- Workers KV has 99.9% uptime SLA
- Blacklist is additional security layer, not critical path
- Tokens expire naturally after 1 hour

---

### Failure Mode 4: Cross-Tab Sync Fails

**Scenario:** BroadcastChannel not supported (old browser) or fails

**Impact:** Logout doesn't propagate to other tabs immediately

**Detection:** BroadcastChannel API not available

**Recovery:**
1. Fall back to polling sessionStorage every 10 seconds
2. Each tab independently checks for auth state changes
3. Tabs eventually sync (within 10 seconds)

**Prevention:**
- BroadcastChannel supported in all modern browsers
- Polling fallback for old browsers

---

### Disaster Recovery

**Recovery Time Objective (RTO):** 15 minutes

**Recovery Point Objective (RPO):** Real-time (sessions are not backed up, regenerated on login)

**Session Recovery Procedure:**
1. Sessions are ephemeral, no recovery needed
2. Users re-authenticate if service is down
3. Supabase Auth has built-in redundancy and backups

**Data Loss Scenarios:**
- **Lost sessions**: Users re-login (acceptable)
- **Lost refresh tokens**: Users re-login (acceptable)
- **Lost master keys**: Cannot recover (zero-knowledge by design)

---

## Alternatives Considered

### Alternative 1: Long-Lived Tokens (No Refresh)

**Description:** Use long-lived access tokens (24 hours or more) without refresh mechanism.

**Pros:**
- Simpler implementation (no refresh logic)
- Better user experience (no periodic refresh)
- Fewer API calls

**Cons:**
- Higher security risk (stolen token valid for 24+ hours)
- Cannot revoke access until token expires
- Harder to respond to compromises

**Why not chosen:** Security risk is too high. Short-lived tokens with refresh provide better security with minimal UX impact.

---

### Alternative 2: Server-Side Sessions (Session Cookies)

**Description:** Traditional session cookies managed server-side (like PHP sessions).

**Pros:**
- More secure (session ID only, data on server)
- Easy to invalidate (just delete server-side session)
- Simpler client-side code

**Cons:**
- Requires server-side session store (Redis, database)
- Harder to scale (sticky sessions or shared state)
- CSRF vulnerabilities
- Doesn't work well with edge computing (Cloudflare Workers)

**Why not chosen:** JWT-based sessions scale better at the edge and align with Supabase Auth's architecture. CSRF is mitigated by using Authorization headers instead of cookies.

---

### Alternative 3: Stateless JWTs Only (No Server-Side Tracking)

**Description:** Use JWTs with no server-side session tracking or blacklist.

**Pros:**
- Perfectly stateless and scalable
- No database or KV storage needed
- Fastest performance

**Cons:**
- Cannot invalidate tokens before expiration
- Logout doesn't truly log out (token still valid)
- Compromised tokens cannot be revoked
- No way to enforce "logout all devices"

**Why not chosen:** Inability to revoke tokens is a critical security gap. Token blacklist is essential for logout and security incident response.

---

### Alternative 4: Refresh Token in localStorage

**Description:** Store refresh token in localStorage instead of httpOnly cookie.

**Pros:**
- Easier to access from JavaScript
- Works in all environments (no cookie restrictions)
- Simpler cross-domain setup

**Cons:**
- Vulnerable to XSS attacks (JavaScript can steal token)
- Critical security weakness

**Why not chosen:** Refresh tokens are long-lived (30 days) and powerful. Storing in JavaScript-accessible storage is a major security risk. httpOnly cookies are essential for refresh token security.

---

## Decision Log

### Decision 1: Token Expiration (1 hour access, 30 day refresh)

**Date:** 2025-10-29

**Context:** Need to balance security (short tokens) with UX (don't logout frequently).

**Options:**
1. 15 min access / 7 day refresh - Very secure, frequent refreshes
2. 1 hour access / 30 day refresh - Balanced (chosen)
3. 24 hour access / 90 day refresh - Better UX, weaker security

**Decision:** 1 hour access token, 30 day refresh token

**Rationale:**
- 1 hour is long enough to avoid frequent refreshes
- 30 days allows returning users to stay logged in
- Stolen access token has limited damage (1 hour)
- Refresh token rotation adds additional security

**Consequences:**
- Token refresh must be reliable (or users get logged out)
- Refresh at 45 minutes requires careful timing
- 30 day inactivity timeout may surprise some users

---

### Decision 2: Master Key Storage (Encrypted in IndexedDB)

**Date:** 2025-10-29

**Context:** Need to persist master key across browser sessions without compromising zero-knowledge.

**Options:**
1. Memory only - Lose on browser close
2. Encrypted in localStorage - Vulnerable to XSS
3. Encrypted in IndexedDB with session key - Balanced (chosen)
4. Never store, always prompt - Annoying UX

**Decision:** Store encrypted master key in IndexedDB, encrypted with key derived from session token

**Rationale:**
- Survives browser restart (good UX)
- Session-bound encryption (automatic cleanup)
- IndexedDB is more secure than localStorage
- Decrypt with session token (only accessible while logged in)

**Consequences:**
- Master key must be re-encrypted on token refresh
- If session expires, encrypted master key becomes inaccessible (by design)
- Requires Web Crypto API (browser compatibility)

---

### Decision 3: Proactive Refresh (15 Minutes Before Expiry)

**Date:** 2025-10-29

**Context:** When should we refresh the access token?

**Options:**
1. On-demand (when API call fails with 401) - Reactive
2. 5 minutes before expiry - Tight timing
3. 15 minutes before expiry - Large buffer (chosen)
4. 30 minutes before expiry - Very safe but frequent

**Decision:** Refresh 15 minutes before expiration

**Rationale:**
- Large buffer for network issues or retries
- User never sees refresh interruption
- Balances security (token still short-lived) with reliability
- Reduces "session expired" errors

**Consequences:**
- Slightly more token refreshes than absolutely necessary
- Requires reliable interval checking (every minute)

---

### Decision 4: Concurrent Sessions Allowed

**Date:** 2025-10-29

**Context:** Should users be allowed to log in on multiple devices simultaneously?

**Options:**
1. Single session only - Force logout on new login
2. Unlimited concurrent sessions - No restrictions
3. Limited concurrent sessions (e.g., 5) - Balanced (chosen for future)
4. Configurable per user/organization - Enterprise feature

**Decision:** Allow unlimited concurrent sessions for MVP, add limit as enterprise feature

**Rationale:**
- Users expect to use multiple devices (laptop, phone, tablet)
- Forcing single session is frustrating
- Security risk is mitigated by short token lifetimes
- Enterprise can enforce stricter limits later

**Consequences:**
- Need "logout all devices" feature
- Potential abuse (shared accounts)
- May need session monitoring for anomalies

---

### Decision 5: Token Storage (sessionStorage for Access Token)

**Date:** 2025-10-29

**Context:** Where should we store the access token in the browser?

**Options:**
1. localStorage - Persists across sessions
2. sessionStorage - Cleared on browser close (chosen)
3. Memory only - Lost on page refresh
4. httpOnly cookie - Can't access from JavaScript

**Decision:** sessionStorage for access token, httpOnly cookie for refresh token (where possible)

**Rationale:**
- sessionStorage cleared on browser close (security benefit)
- Access token is short-lived anyway (1 hour)
- Refresh token in httpOnly cookie protects from XSS
- Can access access token from JavaScript for API calls

**Consequences:**
- User logged out when browser closes (without refresh token)
- Need to handle mobile app differently (secure storage)
- Cross-domain requires CORS (handled by Supabase)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `03-security/auth/authentication-flow.md` - Authentication flows defined
- [x] `GLOSSARY.md` - Terms like JWT, sessionStorage, CSRF defined
- [x] `TECH-STACK.md` - Supabase Auth, Zustand, IndexedDB specified

**External Services:**
- Supabase Auth - JWT generation, token refresh, session management
- Cloudflare Workers KV - Token blacklist, session caching
- BroadcastChannel API - Cross-tab communication (browser native)

### Feature Dependencies

**Session management enables:**
- All authenticated features (secrets, projects, teams)
- Master key persistence across sessions
- MCP tool authentication
- Audit logging (session context required)

---

## References

### Internal Documentation
- `03-security/auth/authentication-flow.md` - Authentication details
- `03-security/security-model.md` - Zero-knowledge architecture
- `07-frontend/state-management.md` - Zustand configuration
- `TECH-STACK.md` - Technology stack (Supabase, Zustand, IndexedDB)
- `GLOSSARY.md` - JWT, session, token definitions

### External Resources
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) - Session management
- [JWT Best Practices (RFC 8725)](https://tools.ietf.org/html/rfc8725) - Token security
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) - Security guidelines
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Client-side encryption
- [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel_API) - Cross-tab communication

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Documentation Agent | Initial session management architecture |

---

## Notes

### Future Enhancements
- **Biometric session unlock** - Touch ID / Face ID to unlock master key
- **Device trust management** - "Trust this device for 30 days"
- **Anomaly detection** - Flag suspicious logins (new location, new device)
- **Session analytics** - Track device types, browsers, locations
- **Offline mode** - Service worker for offline session persistence
- **Push notifications** - Alert user of new logins on other devices

### Known Issues
- **BroadcastChannel not supported in Safari < 15.4** - Use polling fallback
- **sessionStorage cleared on browser close** - By design (security), but may surprise users
- **Master key re-encryption on every refresh** - Adds ~50ms overhead, acceptable for security

### Next Review Date
2025-11-29 (review after initial implementation and security testing)
