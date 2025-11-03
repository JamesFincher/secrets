# Abyrith - AI-Native Secrets Management Platform

✅ **Status:** MVP Complete & Functional

Abyrith is an AI-first secrets management platform that makes API key management accessible to everyone—from complete beginners to enterprise security teams—through zero-knowledge encryption and seamless AI-driven workflows.

## ✅ What's Working Now

- ✅ **Zero-Knowledge Encryption** - AES-256-GCM with PBKDF2 (600k iterations)
- ✅ **Full Authentication** - Sign up, sign in, master password setup
- ✅ **Project Management** - Create projects with dev/staging/production environments
- ✅ **Secret Management** - Create, reveal, copy, delete encrypted secrets
- ✅ **Row Level Security** - Multi-tenancy isolation with role-based access control
- ✅ **Beautiful UI** - Responsive design with Tailwind CSS + shadcn/ui

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start Supabase
supabase start

# Start dev server
pnpm dev

# Open app
open http://localhost:3000
```

**Try it now:**
1. Sign up with email/password
2. Create strong master password (12+ chars)
3. Create your first project
4. Add encrypted secrets to any environment
5. Reveal/copy secrets securely

**Access Points:**
- Frontend: http://localhost:3000
- Supabase Studio: http://localhost:54323

## 🔐 Zero-Knowledge Security

### Encryption
- **AES-256-GCM** authenticated encryption
- **PBKDF2** key derivation with 600,000 iterations (OWASP 2023)
- **Client-side only** - server never sees plaintext
- **Master password** never transmitted or stored

### Database Security
- **Row Level Security (RLS)** enabled on all 9 tables
- **Multi-tenancy** isolation at database level
- **Role-based permissions** (Owner/Admin/Developer/Read-Only)
- **Audit logging** infrastructure ready

## 📁 Project Structure

```
abyrith-app/
├── app/
│   ├── auth/              # Sign in, sign up, master password setup
│   ├── dashboard/         # Main secrets dashboard
│   └── providers.tsx      # React Query + auth listener
├── components/
│   ├── ui/               # Button, Input, Label
│   ├── projects/         # Project creation dialog
│   └── secrets/          # Secret creation + card components
├── lib/
│   ├── crypto/           # Zero-knowledge encryption library
│   ├── api/              # Supabase client configuration
│   ├── stores/           # Zustand stores (auth, projects, secrets)
│   └── hooks/            # Custom React hooks
├── supabase/
│   └── migrations/       # Database schema + RLS policies
└── types/
    └── database.ts       # TypeScript database types
```

## 🔑 User Flow

1. **Sign Up** → Create account (email + password)
2. **Master Password** → Set up encryption key (12+ chars, strong validation)
3. **Auto Setup** → Workspace created automatically
4. **Create Project** → Add project (e.g., "My SaaS App")
5. **Add Secrets** → Store API keys in dev/staging/production
6. **Use Secrets** → Reveal, copy, or delete as needed

## 🗄️ Database Schema

### Core Tables (All with RLS)
- `organizations` - Workspaces/teams
- `organization_members` - User-org relationships + roles
- `projects` - Project containers for secrets
- `environments` - Dev/staging/production separation
- `secrets` - Encrypted secret storage (JSONB encrypted values)
- `user_preferences` - Master password verification + settings
- `audit_logs` - Activity tracking
- `conversations` - AI assistant conversation history
- `messages` - AI conversation messages

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14.2 (App Router)
- React 18 + TypeScript 5
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- React Query (server state)

**Backend:**
- Supabase (PostgreSQL 17 + Auth)
- Row Level Security (RLS)
- Cloudflare Workers (future API layer)

**Security:**
- Web Crypto API (browser-native encryption)
- PBKDF2 key derivation
- AES-256-GCM encryption

## 🐛 Troubleshooting

**Database connection issues:**
```bash
supabase status    # Check status
supabase start     # Start if not running
```

**RLS blocking queries:**
- Verify user is authenticated
- Check organization membership
- Review `supabase/migrations/20241102000002_rls_policies.sql`

**Forgot master password:**
- ⚠️ **No recovery possible** (zero-knowledge design)
- User must create new account
- This is intentional for security

## 🚧 Next Steps

### Phase 2 (Immediate)
- [ ] AI Assistant (Claude API integration)
- [ ] Team collaboration (invite members)
- [ ] Audit log viewer UI
- [ ] Secret search/filtering

### Phase 3 (Future)
- [ ] Browser extension
- [ ] CLI tool
- [ ] MCP server integration
- [ ] Usage tracking
- [ ] Mobile app

## 📚 Documentation

Complete architectural docs in parent directory (`../`)

---

**Built with ❤️ using Next.js, Supabase, and Web Crypto API**
