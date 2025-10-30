---
Document: OAuth Provider Integration - Integration Guide
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Backend Engineer
Status: Draft
Dependencies: 03-security/auth/authentication-flow.md, GLOSSARY.md, TECH-STACK.md
---

# OAuth Provider Integration

## Overview

This document details how Abyrith integrates OAuth 2.0 providers (Google and GitHub for MVP) for user authentication. OAuth handles account authentication while maintaining zero-knowledge architecture—users must still provide their master password for secret decryption after OAuth login.

**External Service:** Multiple OAuth providers (Google, GitHub, and future enterprise providers)

**Integration Type:** OAuth 2.0 authorization flows via Supabase Auth

**Status:** Active (MVP scope: Google and GitHub only)

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [Provider-Specific Setup](#provider-specific-setup)
6. [Implementation Details](#implementation-details)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Monitoring](#monitoring)
10. [Security Considerations](#security-considerations)
11. [Cost & Rate Limits](#cost--rate-limits)
12. [Troubleshooting](#troubleshooting)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Integration Purpose

### Business Value

**What it enables:**
- One-click authentication with popular accounts (Google, GitHub)
- Reduced friction for new users (no password to create)
- Familiar authentication flow (users trust "Sign in with Google")
- Reduced support burden (fewer password reset requests)
- Better security (users more likely to enable MFA on Google/GitHub)

**User benefits:**
- Faster account creation and login (2-3 clicks vs. form filling)
- No need to remember another password (account password, not master password)
- Leverage existing security settings (2FA on Google/GitHub account)
- Seamless experience across devices

### Technical Purpose

**Responsibilities:**
- Delegate account authentication to trusted OAuth providers
- Create or link Supabase Auth user records
- Generate JWT tokens for authenticated sessions
- Maintain zero-knowledge architecture (master password still required)

**Integration Points:**
- Supabase Auth handles OAuth flows automatically
- Frontend initiates OAuth and handles callbacks
- Master password prompt appears after successful OAuth login

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────┐
│         User's Browser                   │
│  ┌────────────────────────────────────┐  │
│  │  Abyrith Frontend (React)          │  │
│  │  • "Sign in with Google" button    │  │
│  │  • OAuth initiation                │  │
│  │  • Callback handler                │  │
│  │  • Master password prompt          │  │
│  └────────────┬───────────────────────┘  │
└───────────────┼──────────────────────────┘
                │ HTTPS
                ▼
┌───────────────────────────────────────────┐
│         Supabase Auth Service             │
│  • Generates OAuth authorization URL      │
│  • Handles provider redirects            │
│  • Exchanges authorization code for token│
│  • Creates/updates user in auth.users    │
│  • Issues JWT session token              │
└───────────────┬───────────────────────────┘
                │ OAuth 2.0 Flow
                ▼
┌───────────────────────────────────────────┐
│      OAuth Provider                       │
│  (Google or GitHub)                       │
│  • User authentication                    │
│  • Authorization consent screen          │
│  • Issues authorization code             │
│  • Returns user profile information      │
└───────────────────────────────────────────┘
```

### Data Flow

**Outbound (Abyrith → OAuth Provider):**
1. User clicks "Sign in with Google/GitHub" button
2. Frontend calls Supabase Auth `signInWithOAuth()`
3. Supabase Auth generates OAuth authorization URL
4. Browser redirects to OAuth provider (Google/GitHub)
5. User authenticates and grants permissions
6. OAuth provider redirects back with authorization code

**Inbound (OAuth Provider → Abyrith):**
1. OAuth provider redirects to callback URL with authorization code
2. Supabase Auth exchanges code for access token and user profile
3. Supabase Auth creates or updates user record in `auth.users`
4. Supabase Auth generates JWT session token
5. Frontend receives session, prompts for master password
6. User enters master password, derives encryption key
7. User authenticated and ready to decrypt secrets

### Components Involved

**Frontend:**
- OAuth login buttons (`SignInWithGoogle.tsx`, `SignInWithGitHub.tsx`)
- OAuth callback page (`/auth/callback`)
- Master password prompt modal (`MasterPasswordModal.tsx`)

**Backend:**
- Supabase Auth (handles OAuth flows automatically)
- PostgreSQL (`auth.users`, `auth.identities` tables)

**External:**
- Google OAuth 2.0 API
- GitHub OAuth Apps API

---

## Authentication

### Authentication Method

**Type:** OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange)

**How it works:**
1. **Authorization Request:** Abyrith redirects user to OAuth provider with client ID, redirect URI, and requested scopes
2. **User Consent:** User authenticates with provider and grants permissions
3. **Authorization Code:** Provider redirects back to Abyrith with one-time authorization code
4. **Token Exchange:** Supabase Auth exchanges code for access token (server-to-server, secure)
5. **User Creation/Update:** Supabase Auth creates or links user account
6. **Session Token:** Supabase Auth issues JWT for Abyrith session

### Credentials Management

**Where credentials are stored:**
- **Development:** `.env.local` file (not committed to Git)
- **Staging:** Supabase Dashboard → Authentication → Providers (Supabase managed)
- **Production:** Supabase Dashboard → Authentication → Providers (Supabase managed)

**Credential Format:**
```bash
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Important:** Client secrets are configured in Supabase Dashboard, NOT in frontend environment variables. Only client IDs are public.

### Obtaining Credentials

#### Google OAuth Credentials

**Step 1: Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project (or select existing)
3. Project name: "Abyrith" (or your chosen name)

**Step 2: Enable Google+ API**
1. Navigate to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click "Enable"

**Step 3: Create OAuth 2.0 Credentials**
1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: "Abyrith Web App"
5. Authorized redirect URIs:
   - Development: `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
   - Production: `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
6. Click "Create"
7. Copy Client ID and Client Secret

**Step 4: Configure in Supabase**
1. Go to Supabase Dashboard → Authentication → Providers
2. Find "Google" provider
3. Toggle "Enable"
4. Paste Client ID and Client Secret
5. Save

#### GitHub OAuth Credentials

**Step 1: Register GitHub OAuth App**
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Application name: "Abyrith"
4. Homepage URL:
   - Development: `http://localhost:3000` or `https://your-dev-domain.com`
   - Production: `https://app.abyrith.com`
5. Authorization callback URL:
   - `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
6. Click "Register application"

**Step 2: Generate Client Secret**
1. On the OAuth App page, click "Generate a new client secret"
2. Copy Client ID and Client Secret immediately (secret shown only once)

**Step 3: Configure in Supabase**
1. Go to Supabase Dashboard → Authentication → Providers
2. Find "GitHub" provider
3. Toggle "Enable"
4. Paste Client ID and Client Secret
5. Save

---

## Configuration

### Environment Variables

**Frontend (Next.js):**
```bash
# Supabase (required for all auth methods)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OAuth providers are configured in Supabase Dashboard
# No client secrets in frontend code
```

**Supabase Dashboard Configuration (OAuth Providers):**
```json
{
  "providers": {
    "google": {
      "enabled": true,
      "client_id": "YOUR_GOOGLE_CLIENT_ID",
      "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
      "redirect_uri": "https://your-project-id.supabase.co/auth/v1/callback"
    },
    "github": {
      "enabled": true,
      "client_id": "YOUR_GITHUB_CLIENT_ID",
      "client_secret": "YOUR_GITHUB_CLIENT_SECRET",
      "redirect_uri": "https://your-project-id.supabase.co/auth/v1/callback"
    }
  }
}
```

### Configuration File

**Location:** Supabase Dashboard → Authentication → Providers

**Supabase Auth Configuration:**
```typescript
// Frontend OAuth configuration
interface OAuthConfig {
  provider: 'google' | 'github';
  redirectTo: string;        // Post-login redirect URL
  scopes: string;            // Requested OAuth scopes
  queryParams?: object;      // Optional provider-specific params
}
```

**Example:**
```typescript
const oauthConfig: OAuthConfig = {
  provider: 'google',
  redirectTo: 'https://app.abyrith.com/auth/callback',
  scopes: 'email profile',  // Minimal scopes requested
  queryParams: {
    access_type: 'offline',  // For refresh tokens (optional)
    prompt: 'consent'        // Force consent screen (optional)
  }
};
```

---

## Provider-Specific Setup

### Google OAuth Configuration

**Scopes Requested:**
```typescript
const googleScopes = 'email profile';
```

**Scope Breakdown:**
- `email` - User's email address (required for account creation)
- `profile` - User's name and profile picture (optional, for display)

**Important Notes:**
- Keep scopes minimal to reduce user friction
- More scopes = longer consent screen = higher drop-off
- Avoid requesting `https://www.googleapis.com/auth/userinfo.profile` (deprecated)

**OAuth Flow Options:**
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://app.abyrith.com/auth/callback',
    scopes: 'email profile',
    queryParams: {
      access_type: 'offline',  // Get refresh token (if needed for future API access)
      prompt: 'select_account' // Let user choose account (useful for multiple Google accounts)
    }
  }
});
```

**Authorized Redirect URIs (Google Cloud Console):**
- Development: `https://your-project-id.supabase.co/auth/v1/callback`
- Production: `https://your-project-id.supabase.co/auth/v1/callback`

**Verification Status:**
- Unverified apps show warning screen to users
- For production: Submit for Google OAuth verification (if >100 users/week)
- Verification process: ~1-2 weeks, requires privacy policy and terms of service

### GitHub OAuth Configuration

**Scopes Requested:**
```typescript
const githubScopes = 'read:user user:email';
```

**Scope Breakdown:**
- `read:user` - Read user profile information (name, avatar)
- `user:email` - Access user's email addresses

**Important Notes:**
- GitHub OAuth requires `user:email` scope for email access (unlike Google)
- Private email addresses: Handle users who hide email on GitHub profile
- GitHub Apps vs. OAuth Apps: We use OAuth Apps (simpler for authentication-only use case)

**OAuth Flow Options:**
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: 'https://app.abyrith.com/auth/callback',
    scopes: 'read:user user:email'
  }
});
```

**Authorized Callback URLs (GitHub OAuth App Settings):**
- `https://your-project-id.supabase.co/auth/v1/callback`

**Email Privacy Handling:**
```typescript
// GitHub users can hide their email addresses
// Supabase Auth automatically handles fetching verified emails
// If no public email, use GitHub's no-reply email format:
// <user_id>+<username>@users.noreply.github.com
```

### Enterprise OAuth Providers (Post-MVP)

**Okta:**
- SAML 2.0 or OAuth 2.0 (OIDC)
- Requires Supabase Enterprise plan
- Configuration via SAML metadata exchange

**Azure AD (Microsoft):**
- OAuth 2.0 with Microsoft identity platform
- Scopes: `openid profile email`
- Supports multi-tenancy

**Implementation Priority:**
- MVP: Google + GitHub only
- Post-MVP Phase 1: Microsoft (Azure AD)
- Post-MVP Phase 2: Okta, Auth0 (enterprise customers)

---

## Implementation Details

### Frontend Implementation

**File:** `07-frontend/components/auth/OAuthButtons.tsx`

**Implementation:**
```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';

export function OAuthButtons() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState<string | null>(null);

  async function signInWithProvider(provider: 'google' | 'github') {
    setLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: provider === 'google' ? 'email profile' : 'read:user user:email',
          queryParams: provider === 'google' ? {
            access_type: 'offline',
            prompt: 'select_account'
          } : {}
        }
      });

      if (error) {
        console.error(`${provider} OAuth error:`, error);
        alert(`Failed to sign in with ${provider}. Please try again.`);
      }
      // Browser redirects automatically if successful
    } catch (error) {
      console.error('Unexpected OAuth error:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => signInWithProvider('google')}
        disabled={loading !== null}
        className="flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {loading === 'google' ? (
          <span>Loading...</span>
        ) : (
          <>
            <GoogleIcon />
            <span>Continue with Google</span>
          </>
        )}
      </button>

      <button
        onClick={() => signInWithProvider('github')}
        disabled={loading !== null}
        className="flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {loading === 'github' ? (
          <span>Loading...</span>
        ) : (
          <>
            <GitHubIcon />
            <span>Continue with GitHub</span>
          </>
        )}
      </button>
    </div>
  );
}
```

### OAuth Callback Handler

**File:** `app/auth/callback/route.ts`

**Implementation:**
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // Exchange authorization code for session
  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=authentication_failed`
      );
    }
  }

  // Check if first-time OAuth user
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to master password setup if first-time user
  if (user && !user.user_metadata.has_master_password) {
    return NextResponse.redirect(`${requestUrl.origin}/setup-master-password`);
  }

  // Redirect to master password unlock for returning users
  return NextResponse.redirect(`${requestUrl.origin}/unlock`);
}
```

### Master Password Flow After OAuth

**First-Time OAuth Users:**
```typescript
// File: app/setup-master-password/page.tsx
export default function SetupMasterPassword() {
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const supabase = createClientComponentClient();

  async function handleSetup(e: FormEvent) {
    e.preventDefault();

    // Validate passwords match
    if (masterPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Validate password strength
    if (masterPassword.length < 16) {
      alert('Master password must be at least 16 characters');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Derive master key from password
      const userSalt = user.id;
      const masterKey = await deriveMasterKey(masterPassword, userSalt);

      // Store encrypted master key in browser
      await storeEncryptedMasterKey(masterKey);

      // Update user metadata to indicate master password is set
      await supabase.auth.updateUser({
        data: { has_master_password: true }
      });

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Master password setup error:', error);
      alert('Failed to set up master password. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSetup}>
      <h1>Set Your Master Password</h1>
      <p>Your master password encrypts all your secrets. Choose a strong password you'll remember.</p>

      <input
        type="password"
        placeholder="Master Password (16+ characters)"
        value={masterPassword}
        onChange={(e) => setMasterPassword(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Confirm Master Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      <button type="submit">Set Master Password</button>
    </form>
  );
}
```

**Returning OAuth Users:**
```typescript
// File: app/unlock/page.tsx
// Same master password entry flow as email/password login
// See 03-security/auth/authentication-flow.md for full implementation
```

---

## Error Handling

### Error Types

**Error 1: OAuth Provider Denied Access**
- **When:** User clicks "Cancel" on OAuth consent screen
- **External Code:** `access_denied`
- **Internal Code:** `oauth_cancelled`
- **Recovery:** Redirect to login page with message: "Sign-in cancelled. Please try again."

**Error 2: Invalid OAuth Configuration**
- **When:** Client ID or redirect URI misconfigured
- **External Code:** `invalid_client`, `invalid_request`
- **Internal Code:** `oauth_config_error`
- **Recovery:** Log error, show generic error message to user, alert engineering team

**Error 3: OAuth State Mismatch**
- **When:** CSRF attack detected (state parameter doesn't match)
- **External Code:** `state_mismatch`
- **Internal Code:** `oauth_security_error`
- **Recovery:** Block request, log security event, show error to user

**Error 4: Email Already Registered with Different Method**
- **When:** User tries OAuth with email already used for email/password signup
- **External Code:** N/A (Supabase handles linking)
- **Internal Code:** `email_conflict`
- **Recovery:** Prompt user to sign in with original method, offer to link accounts

**Error 5: Provider API Rate Limited**
- **When:** Too many OAuth requests from same IP/client
- **External Code:** `429 Too Many Requests`
- **Internal Code:** `rate_limit_exceeded`
- **Recovery:** Show user: "Too many attempts. Please wait 5 minutes and try again."

### Retry Strategy

**Retry Policy:**
- Attempts: 0 (do not automatically retry OAuth flows)
- Reason: OAuth is user-driven, automatic retries confusing
- Manual retry: User must click button again

**Non-Retriable Errors:**
- `access_denied` - User cancelled, must manually retry
- `invalid_client` - Configuration issue, needs fix
- `state_mismatch` - Security issue, do not retry
- `email_conflict` - Business logic, needs user decision

**User Guidance for Errors:**
```typescript
function getErrorMessage(error: string): string {
  switch (error) {
    case 'access_denied':
      return 'Sign-in was cancelled. Please try again if you want to continue.';
    case 'invalid_request':
    case 'invalid_client':
      return 'Authentication configuration error. Please contact support.';
    case 'rate_limit_exceeded':
      return 'Too many sign-in attempts. Please wait a few minutes and try again.';
    default:
      return 'An error occurred during sign-in. Please try again or use email/password.';
  }
}
```

---

## Testing

### Unit Tests

**Test File:** `__tests__/auth/oauth-buttons.test.tsx`

**Mock Setup:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn()
}));

describe('OAuthButtons', () => {
  it('should initiate Google OAuth flow', async () => {
    const mockSignInWithOAuth = jest.fn().mockResolvedValue({ error: null });
    (createClientComponentClient as jest.Mock).mockReturnValue({
      auth: { signInWithOAuth: mockSignInWithOAuth }
    });

    render(<OAuthButtons />);

    const googleButton = screen.getByText(/Continue with Google/i);
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: expect.objectContaining({
          scopes: 'email profile'
        })
      });
    });
  });

  it('should handle OAuth errors gracefully', async () => {
    const mockSignInWithOAuth = jest.fn().mockResolvedValue({
      error: { message: 'OAuth failed' }
    });
    (createClientComponentClient as jest.Mock).mockReturnValue({
      auth: { signInWithOAuth: mockSignInWithOAuth }
    });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    render(<OAuthButtons />);

    const googleButton = screen.getByText(/Continue with Google/i);
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sign in')
      );
    });
  });
});
```

### Integration Tests

**Test Scenario 1: Complete OAuth Flow (Google)**
```typescript
describe('OAuth Integration Flow', () => {
  it('should complete Google OAuth and prompt for master password', async () => {
    // 1. User clicks "Sign in with Google"
    // 2. Redirect to Google (mocked in test)
    // 3. User authenticates and grants permissions (mocked)
    // 4. Callback processes authorization code
    // 5. User redirected to master password setup or unlock
    // 6. User enters master password
    // 7. Master key derived and stored
    // 8. User lands on dashboard
  });
});
```

### Manual Testing

**Test in development:**
```bash
# Set up OAuth credentials in Supabase Dashboard (development project)
# Update .env.local with callback URL
# Start dev server
pnpm dev

# Test Google OAuth:
# 1. Navigate to http://localhost:3000/login
# 2. Click "Continue with Google"
# 3. Select Google account (or authenticate)
# 4. Grant permissions
# 5. Verify redirect to /auth/callback
# 6. Verify redirect to /setup-master-password (first time) or /unlock (returning)

# Test GitHub OAuth:
# (Same steps, but click "Continue with GitHub")
```

**Verify:**
- [ ] OAuth buttons render correctly
- [ ] Click initiates redirect to OAuth provider
- [ ] User can authenticate with OAuth provider
- [ ] Callback processes authorization code successfully
- [ ] First-time users redirected to master password setup
- [ ] Returning users redirected to unlock page
- [ ] Master password flow works after OAuth
- [ ] User lands on dashboard after successful authentication
- [ ] Error cases display appropriate messages

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- OAuth initiation count (per provider)
- OAuth success rate (per provider)
- OAuth error rate (by error type)
- Time to complete OAuth flow (p50, p95, p99)

**Business Metrics:**
- OAuth vs. email/password signup ratio
- OAuth provider preference (Google vs. GitHub)
- OAuth completion rate (initiated → successful login)
- First-time vs. returning OAuth user ratio

### Logging

**Log Level:** INFO | WARN | ERROR

**Logged Events:**
- OAuth flow initiated (provider, timestamp)
- OAuth callback received (success/error, provider)
- Authorization code exchange completed
- Master password setup initiated (after OAuth)
- OAuth errors (detailed error information)

**Log Format:**
```typescript
{
  event: 'oauth_initiated',
  provider: 'google' | 'github',
  user_id: 'uuid' | null,
  timestamp: '2025-10-29T12:00:00Z',
  redirect_to: 'https://app.abyrith.com/auth/callback'
}

{
  event: 'oauth_completed',
  provider: 'google' | 'github',
  user_id: 'uuid',
  new_user: true | false,
  duration_ms: 1234,
  timestamp: '2025-10-29T12:00:05Z'
}

{
  event: 'oauth_error',
  provider: 'google' | 'github',
  error_code: 'access_denied',
  error_message: 'User cancelled authorization',
  timestamp: '2025-10-29T12:00:03Z'
}
```

### Alerts

**Alert 1: High OAuth Error Rate**
- **Condition:** Error rate > 10% over 15 minutes
- **Severity:** P2
- **Action:** Investigate OAuth provider status, check configuration, review error logs

**Alert 2: OAuth Provider Unavailable**
- **Condition:** All OAuth requests failing for a provider for 5+ minutes
- **Severity:** P1
- **Action:** Check OAuth provider status page, notify users via status page, consider disabling provider temporarily

**Alert 3: Suspicious OAuth Activity**
- **Condition:** 10+ OAuth attempts from same IP in 5 minutes
- **Severity:** P2
- **Action:** Check for abuse, implement rate limiting, monitor for attack patterns

---

## Security Considerations

### Data Privacy

**Data sent to OAuth provider:**
- Redirect URI (public, safe to share)
- Requested scopes (minimal: email, profile)
- Client ID (public, safe to share)
- State parameter (CSRF protection token)

**Data received from OAuth provider:**
- User email address (stored in `auth.users`)
- User name (stored in `user_metadata`)
- Profile picture URL (stored in `user_metadata`)
- Provider user ID (stored in `auth.identities`)

**PII Handling:**
- Email addresses encrypted at rest in Supabase
- Profile pictures loaded from OAuth provider CDN (not stored in Abyrith)
- User can disconnect OAuth provider (deletes provider user ID)

### Credential Security

**How credentials are protected:**
- Client secrets stored in Supabase (never in frontend code)
- OAuth flows use PKCE (Proof Key for Code Exchange) for added security
- State parameter prevents CSRF attacks
- Authorization codes are single-use and expire quickly

**Access control:**
- Only Supabase has access to client secrets
- Frontend never sees authorization codes (exchanged server-side by Supabase)
- JWT tokens issued by Supabase, signed with secret key

**Rotation policy:**
- Rotate client secrets annually
- Rotate immediately if compromise suspected
- Document rotation process in `ops-security-runbook.md`

### Compliance

**GDPR:**
- Users can disconnect OAuth providers (right to erasure)
- OAuth provider data (email, name) included in data export
- Users must consent to OAuth data collection (consent screen)

**SOC 2:**
- OAuth access logged in audit trail
- Client secrets stored securely (Supabase managed)
- Regular security reviews of OAuth configuration

### CSRF Protection

**State Parameter:**
```typescript
// Supabase Auth automatically generates and validates state parameter
// No manual implementation required

// State parameter flow:
// 1. Frontend initiates OAuth → Supabase generates random state
// 2. State stored in browser (cookie or session storage)
// 3. OAuth provider redirects back with state parameter
// 4. Supabase validates state matches stored value
// 5. If mismatch, OAuth flow rejected (potential CSRF attack)
```

### Still Requires Master Password

**Critical Security Note:**
OAuth only handles account authentication. Master password is still required for zero-knowledge encryption:

1. User authenticates via OAuth → Account verified
2. User must enter master password → Encryption key derived
3. Master password never transmitted to server
4. Only user with master password can decrypt secrets

**This dual-password system maintains zero-knowledge architecture even with OAuth.**

---

## Cost & Rate Limits

### Pricing Model

**Google OAuth:**
- **Cost:** Free for up to 100 million requests/month
- **Our usage:** ~10,000 OAuth logins/month (MVP)
- **Estimated cost:** $0/month

**GitHub OAuth:**
- **Cost:** Free (no usage limits for OAuth Apps)
- **Our usage:** ~5,000 OAuth logins/month (MVP)
- **Estimated cost:** $0/month

**Supabase Auth:**
- **Cost:** Included in Supabase plan
- **Free tier:** 50,000 monthly active users
- **Our usage:** <10,000 MAU (MVP)
- **Estimated cost:** $0/month (within free tier)

### Rate Limits

**Google OAuth Limits:**
- 10 requests/second per client ID
- 100 million requests/month (free tier)

**GitHub OAuth Limits:**
- 5,000 requests/hour per OAuth App
- No monthly limits

**Supabase Auth Limits:**
- Free tier: 50,000 MAU
- Rate limiting: 60 requests/minute per user (automatic)

**How we handle limits:**
- Well within free tier limits for MVP
- Frontend rate limiting: Disable button after click, prevent double-clicks
- Backend rate limiting: Supabase handles automatically

**Monitoring usage:**
- Google Cloud Console → APIs & Services → Dashboard
- GitHub Settings → OAuth Apps → [App Name] (no usage metrics, but unlimited)
- Supabase Dashboard → Authentication → Users (track MAU)

---

## Troubleshooting

### Issue 1: "Invalid OAuth Configuration" Error

**Symptoms:**
```
Error: invalid_client
Description: The client configuration is invalid
```

**Cause:** Client ID or redirect URI misconfigured in OAuth provider settings

**Solution:**
```bash
# Verify redirect URI matches exactly:
# Supabase: https://your-project-id.supabase.co/auth/v1/callback
# Google Cloud Console: Check "Authorized redirect URIs"
# GitHub OAuth App: Check "Authorization callback URL"

# Ensure client ID and secret are correctly entered in Supabase Dashboard
# Providers → [Google/GitHub] → Enable → Paste credentials → Save
```

---

### Issue 2: "Redirect URI Mismatch"

**Symptoms:**
```
Error: redirect_uri_mismatch
Description: The redirect URI in the request does not match
```

**Cause:** Redirect URI passed in OAuth request doesn't match authorized URIs

**Solution:**
```bash
# Check Supabase Auth callback URL:
https://your-project-id.supabase.co/auth/v1/callback

# Add this EXACT URL to OAuth provider:
# Google: Authorized redirect URIs
# GitHub: Authorization callback URL

# Common mistakes:
# ❌ http:// instead of https://
# ❌ Trailing slash (/) at the end
# ❌ Wrong Supabase project ID
# ❌ /auth/callback instead of /auth/v1/callback
```

---

### Issue 3: User Sees "This App Hasn't Been Verified" (Google)

**Symptoms:**
Google shows warning screen: "Google hasn't verified this app"

**Cause:** OAuth app not verified by Google (normal for <100 users/week)

**Solution:**
```bash
# For development/testing: Click "Advanced" → "Go to [App Name] (unsafe)"
# For production with >100 users/week:
# 1. Submit app for Google OAuth verification
# 2. Provide privacy policy URL
# 3. Provide terms of service URL
# 4. Complete verification questionnaire
# 5. Wait 1-2 weeks for review
# 6. Verification removes warning screen
```

---

### Issue 4: GitHub Email is Null or Private

**Symptoms:**
User authenticates via GitHub but email address is null or shows `<user_id>+<username>@users.noreply.github.com`

**Cause:** User has hidden email address on GitHub profile

**Solution:**
```typescript
// Supabase Auth automatically handles this:
// 1. Fetches primary email from GitHub API
// 2. If no public email, uses verified private email
// 3. If all private, uses GitHub no-reply email

// If you need to handle manually:
const { data: { user } } = await supabase.auth.getUser();

if (user?.email?.includes('@users.noreply.github.com')) {
  // Ask user to verify email or use email/password signup
  console.warn('GitHub user has hidden email');
}
```

---

### Issue 5: "Master Password Not Set" Loop

**Symptoms:**
After OAuth login, user redirected to master password setup, but setup fails and loops back

**Cause:** Master password setup flow not updating user metadata correctly

**Solution:**
```typescript
// Ensure master password setup updates user metadata:
await supabase.auth.updateUser({
  data: { has_master_password: true }
});

// Check user metadata after setup:
const { data: { user } } = await supabase.auth.getUser();
console.log('has_master_password:', user?.user_metadata?.has_master_password);

// If still false, check for errors in updateUser call
```

---

### Debug Mode

**Enable debug logging:**
```bash
# Frontend (Next.js)
NEXT_PUBLIC_SUPABASE_DEBUG=true

# Check browser console for detailed OAuth flow logs
```

**What gets logged:**
- OAuth initiation (provider, scopes, redirect URI)
- OAuth callback received (authorization code, state)
- Code exchange result (success/error)
- User session details (user ID, email, metadata)
- Master password flow (setup vs. unlock)

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [x] `03-security/auth/authentication-flow.md` - Authentication architecture
- [x] `GLOSSARY.md` - OAuth, JWT, PKCE definitions
- [x] `TECH-STACK.md` - Supabase Auth version and capabilities

**External Dependencies:**
- Google Cloud Platform account (for Google OAuth credentials)
- GitHub account (for GitHub OAuth App)
- Supabase project (for OAuth provider configuration)

### Feature Dependencies

**Required by features:**
- `08-features/team-collaboration.md` - OAuth login for team members
- `08-features/ai-assistant.md` - Authenticated sessions for AI interactions
- `09-integrations/mcp/secrets-server-spec.md` - OAuth users requesting secrets via MCP

---

## References

### Internal Documentation
- `03-security/auth/authentication-flow.md` - Complete authentication flows
- `03-security/zero-knowledge-architecture.md` - Why master password still required
- `TECH-STACK.md` - Supabase Auth version and capabilities
- `GLOSSARY.md` - OAuth, JWT, PKCE, MFA definitions

### External Resources
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) - Official Supabase Auth guide
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login) - OAuth provider setup
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2) - Google OAuth spec
- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps) - GitHub OAuth setup
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 specification
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636) - Proof Key for Code Exchange

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Documentation Agent | Initial OAuth provider integration guide |

---

## Notes

### Future Enhancements
- **Microsoft OAuth (Azure AD)** - Post-MVP, enterprise customers
- **Apple Sign In** - iOS/macOS users, privacy-focused
- **OAuth provider analytics** - Track which providers users prefer
- **Account linking** - Allow users to link multiple OAuth providers to one account
- **Social login buttons redesign** - A/B test button copy and design

### Known Limitations
- **Unverified Google OAuth apps** - Shows warning screen until verified (requires privacy policy)
- **GitHub email privacy** - Users with hidden emails show no-reply address (acceptable)
- **Master password still required** - OAuth doesn't replace master password (by design, zero-knowledge)
- **No SAML support in MVP** - Enterprise SSO requires Supabase Enterprise plan

### Next Review Date
2025-11-29 (review after MVP implementation and user feedback)
