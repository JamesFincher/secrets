# Development Database Reset Guide

When you reset the local Supabase database, you need to reset **both** the application database and the auth users.

## Problem

`supabase db reset` only resets the **public schema** (your application tables), but **NOT** the auth schema. This creates a mismatch where:
- Old users still exist in Supabase Auth
- But their preferences/data no longer exist in the application database

## Solution

### Option 1: Full Reset (Recommended)

```bash
# Stop Supabase
supabase stop

# Remove all Supabase data (including auth)
rm -rf supabase/.temp

# Start fresh
supabase start

# Database will be automatically initialized with all migrations
```

### Option 2: Quick Reset (Keeps running)

```bash
# Reset the database
supabase db reset

# Then manually delete auth users via Supabase Studio:
# 1. Open http://127.0.0.1:54323
# 2. Go to Authentication → Users
# 3. Delete all test users
# 4. Or use SQL: DELETE FROM auth.users;
```

### Option 3: SQL Script

```sql
-- Run this in Supabase Studio SQL Editor (http://127.0.0.1:54323)

-- Delete all auth users (this cascades to your app tables due to foreign keys)
DELETE FROM auth.users;

-- Verify
SELECT COUNT(*) FROM auth.users;  -- Should be 0
SELECT COUNT(*) FROM public.organizations;  -- Should be 0
SELECT COUNT(*) FROM public.user_preferences;  -- Should be 0
```

## After Reset

1. **Clear browser cache**: Run `clearAbyrithCache()` in browser console
2. **Sign up fresh**: Create a NEW account
3. **Set up master password**: You'll be properly redirected
4. **Everything works**: Organization will auto-create

## Preventing This Issue

When developing, if you need to reset data:

1. Always sign out before running `supabase db reset`
2. Or better yet, use Option 1 (full reset)
3. Clear browser localStorage after reset

## Quick Commands

```bash
# Full reset
supabase stop && rm -rf supabase/.temp && supabase start

# Just DB reset
supabase db reset

# Check running status
supabase status
```

## Browser Console Commands

```javascript
// Clear Abyrith cache
clearAbyrithCache()

// Debug cache state
debugAbyrithCache()

// Manual clear all
localStorage.clear()
```
