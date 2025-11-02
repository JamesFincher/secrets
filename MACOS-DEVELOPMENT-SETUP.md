# macOS Development Environment Setup for Abyrith

**Generated:** 2025-11-02
**Target:** macOS (Apple Silicon & Intel)
**Purpose:** Complete Claude Code (AI) self-sufficient development environment

---

## Overview

This guide sets up a macOS machine for **Claude Code** (AI-powered development) to build the Abyrith platform with **minimal human intervention**. All CLIs and tools are configured for autonomous operation.

**Philosophy:** The human does as little as possible. Claude Code does everything.

---

## System Requirements

### Minimum Requirements
- **macOS:** 13.0 (Ventura) or later
- **RAM:** 16 GB (32 GB recommended for running local Supabase)
- **Storage:** 50 GB free space
- **Processor:** Apple Silicon (M1/M2/M3) or Intel x86_64

### Recommended Configuration
- **macOS:** 14.0 (Sonoma) or later
- **RAM:** 32 GB
- **Storage:** 100 GB free SSD
- **Processor:** Apple Silicon M2 or better

---

## Quick Setup Script (5 Minutes)

**Run this as the human, then let Claude Code take over:**

```bash
# 1. Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Add Homebrew to PATH (for Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# 3. Install all required CLIs in one command
brew install node@20 pnpm git postgresql@15 &&\
npm install -g wrangler supabase &&\
pnpm setup &&\
source ~/.zshrc

# 4. Verify installation
node --version    # Should show v20.x.x
pnpm --version    # Should show 8.x.x
git --version     # Should show 2.40+
psql --version    # Should show 15.x
wrangler --version # Should show 3.x
supabase --version # Should show 1.x

# 5. Done! Clone the repo and let Claude Code handle the rest
```

---

## Detailed Installation Guide

### 1. Homebrew Package Manager

**Why:** macOS package manager for installing all tools
**Claude Code Needs:** `brew` command access

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add to PATH (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Add to PATH (Intel)
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"

# Verify
brew --version  # Should show 4.x or later
```

**Claude Code will use:** `brew install`, `brew upgrade`, `brew list`

---

### 2. Node.js 20.x (JavaScript Runtime)

**Why:** Required for Next.js frontend and backend tooling
**Version:** 20.x LTS (per TECH-STACK.md)
**Claude Code Needs:** `node` and `npm` commands

```bash
# Install Node.js 20
brew install node@20

# Link it to PATH
brew link node@20 --force --overwrite

# Verify
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

**Claude Code will use:** `node`, `npm`, `npx`

---

### 3. pnpm 8.x (Package Manager)

**Why:** Fast, disk-efficient package manager (per TECH-STACK.md)
**Version:** 8.x
**Claude Code Needs:** `pnpm` command for all package operations

```bash
# Install pnpm globally
npm install -g pnpm@8

# Setup pnpm (creates ~/.pnpm-store)
pnpm setup

# Add pnpm to PATH
source ~/.zshrc  # or source ~/.bash_profile

# Verify
pnpm --version  # Should show 8.x.x
```

**Claude Code will use:** `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`

---

### 4. Git 2.40+ (Version Control)

**Why:** Repository management and collaboration
**Claude Code Needs:** `git` command for all version control operations

```bash
# Install latest Git (macOS ships with older version)
brew install git

# Configure Git (replace with actual values)
git config --global user.name "Claude Code Bot"
git config --global user.email "claude@abyrith.dev"

# Set default branch name
git config --global init.defaultBranch main

# Enable credential caching
git config --global credential.helper osxkeychain

# Verify
git --version  # Should show 2.40 or later
```

**Claude Code will use:** `git clone`, `git commit`, `git push`, `git pull`, `git branch`, `git checkout`

---

### 5. PostgreSQL 15.x Client (Database CLI)

**Why:** Connect to Supabase PostgreSQL database locally
**Version:** 15.x (per TECH-STACK.md)
**Claude Code Needs:** `psql` command for database operations

```bash
# Install PostgreSQL client tools
brew install postgresql@15

# Link to PATH
brew link postgresql@15 --force

# Verify
psql --version  # Should show 15.x
```

**Note:** We use Supabase cloud for the actual database. This is just the CLI client.

**Claude Code will use:** `psql` (for debugging, migrations verification)

---

### 6. Supabase CLI (Database Management)

**Why:** Run database migrations, manage Supabase projects
**Claude Code Needs:** `supabase` command for all database operations

```bash
# Install Supabase CLI
npm install -g supabase

# Verify
supabase --version  # Should show 1.x or later

# Login to Supabase (will open browser for auth)
supabase login

# Test connection
supabase projects list
```

**Claude Code will use:**
- `supabase init` - Initialize project
- `supabase start` - Start local Supabase (optional)
- `supabase db push` - Push migrations
- `supabase db reset` - Reset database
- `supabase gen types` - Generate TypeScript types

---

### 7. Wrangler CLI (Cloudflare Workers)

**Why:** Deploy and manage Cloudflare Workers (API layer)
**Claude Code Needs:** `wrangler` command for all Worker operations

```bash
# Install Wrangler CLI
npm install -g wrangler

# Verify
wrangler --version  # Should show 3.x or later

# Login to Cloudflare (will open browser for auth)
wrangler login

# Test connection
wrangler whoami
```

**Claude Code will use:**
- `wrangler dev` - Local Worker development
- `wrangler deploy` - Deploy to Cloudflare
- `wrangler tail` - View Worker logs
- `wrangler kv` - Manage KV namespaces
- `wrangler secret put` - Manage Worker secrets

---

### 8. VS Code or Cursor IDE (Recommended)

**Why:** Best IDE for TypeScript/React development with AI
**Claude Code Benefits:** Better integration with Cursor AI

```bash
# Install Cursor (AI-first IDE)
brew install --cask cursor

# OR install VS Code
brew install --cask visual-studio-code
```

**Recommended Extensions (Claude Code will suggest installing these):**
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- TypeScript Error Translator
- Supabase (for database management)
- GitLens (for git operations)

---

### 9. Docker Desktop (Optional - For Local Supabase)

**Why:** Run local Supabase stack (PostgreSQL, Auth, Storage)
**When to use:** For offline development or testing migrations locally

```bash
# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop (opens GUI)
open -a Docker

# Verify
docker --version  # Should show 24.x or later
docker-compose --version  # Should show 2.x or later
```

**Claude Code will use:** `docker ps`, `docker logs`, `supabase start` (which uses Docker)

---

### 10. jq (JSON Processor - Highly Recommended)

**Why:** Parse and manipulate JSON in shell scripts
**Claude Code Needs:** `jq` for processing API responses

```bash
# Install jq
brew install jq

# Verify
jq --version  # Should show 1.6 or later

# Test
echo '{"name":"Abyrith"}' | jq '.name'  # Should output: "Abyrith"
```

**Claude Code will use:** `jq` extensively for API testing and JSON manipulation

---

## Environment Configuration

### 1. Shell Configuration (~/.zshrc or ~/.bash_profile)

Add these aliases to make Claude Code more efficient:

```bash
# Add to ~/.zshrc (macOS default shell)
cat >> ~/.zshrc <<'EOF'

# Abyrith Development Aliases
alias dev="pnpm dev"
alias build="pnpm build"
alias test="pnpm test"
alias lint="pnpm lint"
alias format="pnpm format"
alias db-push="supabase db push"
alias db-reset="supabase db reset"
alias workers-dev="wrangler dev"
alias workers-deploy="wrangler deploy"

# Git shortcuts
alias gs="git status"
alias ga="git add"
alias gc="git commit"
alias gp="git push"
alias gl="git log --oneline -10"

# pnpm shortcuts
alias pi="pnpm install"
alias pa="pnpm add"
alias pr="pnpm remove"

EOF

# Reload shell config
source ~/.zshrc
```

---

### 2. Git Configuration for Claude Code

```bash
# Set up GPG signing (optional but recommended)
brew install gnupg

# Configure Git for better diffs
git config --global diff.algorithm histogram
git config --global merge.conflictstyle diff3
git config --global pull.rebase true
git config --global fetch.prune true

# Enable auto-correct for typos
git config --global help.autocorrect 1

# Better git log format
git config --global alias.lg "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
```

---

## Project-Specific Setup

After installing all tools, clone the repository and run setup:

```bash
# 1. Clone the repository
git clone https://github.com/JamesFincher/secrets.git abyrith
cd abyrith

# 2. Install dependencies
pnpm install

# 3. Copy environment template
cp .env.example .env.local

# 4. (Human) Fill in environment variables
# Open .env.local and add:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - ANTHROPIC_API_KEY (Claude API)
# - FIRECRAWL_API_KEY
# - Cloudflare account details

# 5. Initialize Supabase
supabase init

# 6. Link to Supabase project (will prompt for project ID)
supabase link --project-ref your-project-ref

# 7. Push database migrations
supabase db push

# 8. Generate TypeScript types from database
supabase gen types typescript --local > types/supabase.ts

# 9. Start development server
pnpm dev

# 10. Open http://localhost:3000 in browser
```

**Claude Code will automate steps 2, 5, 7, 8, 9 after the human provides environment variables.**

---

## Claude Code Self-Sufficiency Checklist

### ✅ Core Development
- [x] `node` - Run JavaScript/TypeScript
- [x] `pnpm` - Package management
- [x] `git` - Version control operations
- [x] `brew` - Install additional tools if needed

### ✅ Database Operations
- [x] `supabase` - Migrations, types, local dev
- [x] `psql` - Direct database queries
- [x] `docker` - Local Supabase stack (optional)

### ✅ Backend/API Operations
- [x] `wrangler` - Cloudflare Workers deployment
- [x] `curl` - API testing
- [x] `jq` - JSON processing

### ✅ Code Quality
- [x] ESLint (via `pnpm lint`)
- [x] Prettier (via `pnpm format`)
- [x] TypeScript (via `pnpm type-check`)
- [x] Git hooks (via Husky - auto-installed)

### ✅ Testing
- [x] Vitest (via `pnpm test`)
- [x] Playwright (via `pnpm test:e2e`)
- [x] Testing Library (included in dependencies)

---

## What Claude Code Will Do Autonomously

### Daily Development Tasks
1. **Code Generation**
   - Write React components
   - Create API endpoints (Cloudflare Workers)
   - Implement business logic
   - Write tests (unit, integration, E2E)

2. **Database Management**
   - Create migrations (`supabase migration new`)
   - Apply migrations (`supabase db push`)
   - Generate TypeScript types (`supabase gen types`)
   - Verify RLS policies

3. **Version Control**
   - Create feature branches (`git checkout -b feature/...`)
   - Commit changes (`git commit -m "..."`)
   - Push to remote (`git push`)
   - Create pull requests (via GitHub CLI if installed)

4. **Testing & Quality**
   - Run tests (`pnpm test`)
   - Fix linting errors (`pnpm lint --fix`)
   - Format code (`pnpm format`)
   - Type-check (`pnpm type-check`)

5. **Deployment**
   - Build frontend (`pnpm build`)
   - Deploy Workers (`wrangler deploy`)
   - Deploy frontend (Cloudflare Pages via git push)
   - Monitor deployments

### What Requires Human Intervention

1. **Initial Setup (One-Time)**
   - Installing Homebrew
   - Installing CLIs (via setup script above)
   - Creating Supabase project (via Supabase web UI)
   - Creating Cloudflare account
   - Obtaining API keys (Claude API, FireCrawl)

2. **Secrets Management**
   - Adding environment variables to `.env.local`
   - Adding secrets to GitHub Actions
   - Adding secrets to Cloudflare Workers (`wrangler secret put`)

3. **External Account Setup**
   - Supabase project creation
   - Cloudflare account setup
   - Anthropic API account
   - FireCrawl API account
   - Domain registration (if applicable)

4. **Production Decisions**
   - Approving pull requests
   - Triggering production deployments
   - Database migration approvals (for production)

---

## Verification Script

Run this to verify Claude Code has everything needed:

```bash
#!/bin/bash
# save as verify-setup.sh and run: bash verify-setup.sh

echo "🔍 Verifying Abyrith Development Environment..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js: NOT INSTALLED"
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    echo "✅ pnpm: $(pnpm --version)"
else
    echo "❌ pnpm: NOT INSTALLED"
fi

# Check Git
if command -v git &> /dev/null; then
    echo "✅ Git: $(git --version)"
else
    echo "❌ Git: NOT INSTALLED"
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL: $(psql --version)"
else
    echo "⚠️  PostgreSQL client: NOT INSTALLED (optional)"
fi

# Check Supabase CLI
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI: $(supabase --version)"
else
    echo "❌ Supabase CLI: NOT INSTALLED"
fi

# Check Wrangler
if command -v wrangler &> /dev/null; then
    echo "✅ Wrangler CLI: $(wrangler --version)"
else
    echo "❌ Wrangler CLI: NOT INSTALLED"
fi

# Check jq
if command -v jq &> /dev/null; then
    echo "✅ jq: $(jq --version)"
else
    echo "⚠️  jq: NOT INSTALLED (recommended)"
fi

# Check Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker: $(docker --version)"
else
    echo "⚠️  Docker: NOT INSTALLED (optional for local Supabase)"
fi

echo ""
echo "📦 Checking project dependencies..."

if [ -d "node_modules" ]; then
    echo "✅ node_modules: EXISTS"
else
    echo "⚠️  node_modules: NOT FOUND (run: pnpm install)"
fi

if [ -f ".env.local" ]; then
    echo "✅ .env.local: EXISTS"
else
    echo "⚠️  .env.local: NOT FOUND (copy .env.example)"
fi

echo ""
echo "🎯 Setup verification complete!"
```

---

## Troubleshooting

### Issue: `command not found: brew`
**Solution:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/opt/homebrew/bin/brew shellenv)"  # Apple Silicon
eval "$(/usr/local/bin/brew shellenv)"     # Intel
```

### Issue: `command not found: pnpm`
**Solution:**
```bash
npm install -g pnpm@8
pnpm setup
source ~/.zshrc
```

### Issue: `supabase login` fails
**Solution:**
```bash
# Make sure you're logged into Supabase web dashboard first
# Then retry:
supabase login --no-browser
# Copy the URL into browser manually
```

### Issue: `wrangler login` fails
**Solution:**
```bash
# Make sure you're logged into Cloudflare dashboard first
# Then retry:
wrangler login
# Follow browser authentication flow
```

### Issue: Node version mismatch
**Solution:**
```bash
# Uninstall current Node
brew uninstall node

# Install Node 20 specifically
brew install node@20
brew link node@20 --force --overwrite

# Verify
node --version  # Should show v20.x.x
```

### Issue: Permission denied errors during `pnpm install`
**Solution:**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/.pnpm-store

# Retry
pnpm install
```

---

## Next Steps After Setup

1. **Human:** Run the quick setup script at the top of this document
2. **Human:** Create accounts:
   - Supabase: https://supabase.com
   - Cloudflare: https://dash.cloudflare.com
   - Anthropic: https://console.anthropic.com
   - FireCrawl: https://firecrawl.dev
3. **Human:** Obtain API keys and add to `.env.local`
4. **Claude Code:** Take over from here and build the entire platform! 🚀

---

## Summary: What the Human Must Do

**Total Time: 10-15 minutes**

1. Run quick setup script (5 minutes)
2. Create external accounts (5 minutes)
3. Copy API keys into `.env.local` (2 minutes)
4. **Done! Claude Code handles the rest.**

---

## What Claude Code Can Now Do

With this setup, Claude Code can:
- ✅ Clone and manage repositories
- ✅ Install and update dependencies
- ✅ Write code (React, TypeScript, API routes)
- ✅ Create and run database migrations
- ✅ Generate TypeScript types from database
- ✅ Run tests (unit, integration, E2E)
- ✅ Lint and format code
- ✅ Commit and push changes
- ✅ Deploy to Cloudflare (Workers + Pages)
- ✅ Monitor deployments and logs
- ✅ Debug issues via logs and error messages
- ✅ Iterate on implementations based on test results

**Claude Code is now fully self-sufficient for development! 🎉**
