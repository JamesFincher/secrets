# Abyrith - AI-Native Secrets Management Platform

🚧 **Status:** In Development (MVP Phase)

Abyrith is an AI-first secrets management platform that makes API key management accessible to everyone—from complete beginners to enterprise security teams—through zero-knowledge encryption and seamless AI-driven workflows.

## 🏗️ Architecture

**3-Layer Cloud-First Architecture:**

```
Frontend (Next.js 14) → API Gateway (Cloudflare Workers) → Data Layer (Supabase)
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install
cd workers && pnpm install && cd ..

# Start Supabase
supabase start

# Start dev servers (separate terminals)
pnpm dev              # Frontend (port 3000)
cd workers && pnpm dev # Workers (port 8787)
```

**Access Points:**
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8787
- Supabase Studio: http://localhost:54323

## 🔐 Zero-Knowledge Security

- **Client-side encryption only** (AES-256-GCM)
- **PBKDF2** with 600,000 iterations
- **Server can never decrypt secrets**

## 📚 Documentation

Complete docs in parent directory (`../`)

## 🛠️ Tech Stack

Next.js 14 • React 18 • TypeScript • Tailwind CSS • Cloudflare Workers • Supabase • Zustand • React Query
