# GitHub OAuth App Setup Guide

This guide walks you through setting up a GitHub OAuth App for Abyrith's GitHub integration.

## Current Status

✅ **Database**: GitHub integration tables created successfully
✅ **Workers**: Running on http://localhost:8787
✅ **Dependencies**: All installed (@octokit/rest, hono, zod-validator)
⚠️ **GitHub OAuth**: Needs configuration (this guide)

## Step 1: Create GitHub OAuth App

1. Go to GitHub Settings: https://github.com/settings/developers
2. Click **"OAuth Apps"** in the left sidebar
3. Click **"New OAuth App"**
4. Fill in the form:

   ```
   Application name: Abyrith Development
   Homepage URL: http://localhost:3000
   Application description: AI-native secrets management (development)
   Authorization callback URL: http://localhost:3000/dashboard/github/callback
   ```

5. Click **"Register application"**

## Step 2: Copy Credentials

After creating the app, you'll see:

- **Client ID**: Copy this (e.g., `Iv1.abc123def456`)
- Click **"Generate a new client secret"**
- **Client Secret**: Copy this immediately (you won't see it again!)

## Step 3: Configure Workers Environment

Edit `/Users/james/code/secrets/abyrith-app/workers/.dev.vars`:

```bash
# Add these lines (replace with your actual values):
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=your_secret_here_from_github
```

**Important**: Never commit `.dev.vars` to Git! It's already in `.gitignore`.

## Step 4: Configure Frontend Environment

Edit `/Users/james/code/secrets/abyrith-app/.env.local`:

```bash
# Add this line (replace with your Client ID):
NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=your_secret_here_from_github

# Also ensure you have:
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

**Important**: Never commit `.env.local` to Git! It's already in `.gitignore`.

## Step 5: Restart Services

After adding credentials, restart both services:

```bash
# Terminal 1: Restart Workers
cd workers
# Press Ctrl+C to stop, then:
pnpm dev

# Terminal 2: Restart Next.js (if running)
cd ..
pnpm dev
```

## Step 6: Verify Configuration

Check that credentials are loaded:

```bash
# Workers should show:
# - GITHUB_CLIENT_ID: "(hidden)"
# - GITHUB_CLIENT_SECRET: "(hidden)"

# You can test the connect endpoint:
curl -X POST http://localhost:8787/api/v1/github/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -d '{"redirect_uri": "http://localhost:3000/dashboard/github/callback", "scopes": ["repo", "read:user"]}'
```

## OAuth Scopes Explained

The GitHub integration requests these permissions:

- **`repo`**: Full control of private repositories (required to read `.env` files and repo variables)
- **`read:user`**: Read user profile data (username, email for display)

You can modify the scopes in `lib/api/github.ts:initGitHubOAuth()` if needed.

## Security Notes

### Zero-Knowledge Architecture Maintained

1. **Client-Side Token Encryption**:
   - GitHub OAuth token is encrypted in the browser using your master password
   - Server (Supabase + Workers) never sees the plaintext token
   - Uses AES-256-GCM envelope encryption (same as secrets)

2. **Token Storage**:
   - Encrypted token stored in `github_connections` table
   - Includes: `encrypted_github_token`, `token_nonce`, `token_dek`, `dek_nonce`, `token_auth_tag`
   - Decryption requires user's master password

3. **.abyrith Marker File**:
   - Contains only a UUID (no secrets)
   - Public and safe to commit to Git
   - Links repo to Abyrith project anonymously

## Troubleshooting

### "Client ID not found"
- Make sure you copied the entire Client ID from GitHub
- Verify it's in both `.dev.vars` and `.env.local`
- Restart Workers and Next.js

### "Invalid callback URL"
- Check that the callback URL in GitHub OAuth app settings is exactly:
  `http://localhost:3000/dashboard/github/callback`
- Must match exactly (no trailing slash)

### "State parameter mismatch"
- This is CSRF protection
- Clear browser sessionStorage and try again
- Make sure you're not blocking cookies/sessionStorage

### "Failed to encrypt token"
- Ensure you've set up a master password in Abyrith
- Check browser console for Web Crypto API errors
- Verify you're using HTTPS in production (required for Web Crypto API)

## Next Steps

After configuration is complete:

1. ✅ Start Next.js frontend: `pnpm dev`
2. ✅ Navigate to http://localhost:3000/dashboard/github
3. ✅ Click "Connect GitHub"
4. ✅ Authorize the OAuth app
5. ✅ Enter your master password to encrypt the token
6. ✅ Browse your repositories
7. ✅ Link a repository to a project
8. ✅ Test secret import from `.env` files

## Production Deployment

When deploying to production:

1. **Create Production OAuth App**:
   - Separate OAuth app for production
   - Callback URL: `https://app.abyrith.com/dashboard/github/callback`

2. **Set Production Secrets**:
   ```bash
   # Cloudflare Workers secrets:
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET

   # Environment variables:
   # Set in Cloudflare Pages dashboard or via CLI
   ```

3. **Update Frontend**:
   - Set `NEXT_PUBLIC_GITHUB_CLIENT_ID` in Cloudflare Pages settings
   - Set `NEXT_PUBLIC_WORKER_URL` to your production Worker URL

## References

- GitHub OAuth Documentation: https://docs.github.com/en/apps/oauth-apps
- Abyrith Security Model: `/docs/03-security/integrations-security.md`
- GitHub Integration Feature Spec: `/docs/08-features/github-integration/`
- Database Schema: `supabase/migrations/20241104000001_add_github_integration.sql`
- Encryption Library: `lib/crypto/github-encryption.ts`

---

**Status**: Ready for OAuth app configuration
**Last Updated**: 2025-11-04
**Next Step**: Follow Steps 1-6 above to configure GitHub OAuth
