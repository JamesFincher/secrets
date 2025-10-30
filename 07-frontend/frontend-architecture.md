---
Document: Frontend Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 05-api/api-rest-design.md, 03-security/auth/authentication-flow.md, TECH-STACK.md, 02-architecture/system-overview.md
---

# Frontend Architecture

## Overview

This document defines the complete frontend architecture for Abyrith, detailing the Next.js project structure, state management approach, routing strategy, client-side encryption implementation, API client layer, and error handling patterns. The frontend is built using Next.js 14.2.x with React 18.3.x and TypeScript 5.3.x, emphasizing zero-knowledge encryption, exceptional developer experience, and AI-native design.

**Purpose:** Establish a scalable, maintainable, and secure frontend architecture that preserves zero-knowledge encryption guarantees while delivering a seamless user experience. The architecture must support AI-first interactions, real-time collaboration, and multi-device synchronization.

**Scope:** This document covers the client-side application architecture, from project structure to state management, API integration to encryption flows. It includes component architecture, routing, state management, client-side cryptography, API client patterns, error handling, performance optimization, and deployment strategy.

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
Abyrith requires a frontend application that can handle complex client-side encryption while maintaining an intuitive user experience for users ranging from complete beginners ("The Learner") to enterprise security teams. The frontend must encrypt all secrets before transmission, manage cryptographic keys securely in the browser, and provide a conversational AI interface as the primary interaction model.

**Pain points:**
- Client-side encryption adds complexity to state management and data flows
- Master password/key must be managed securely in browser memory without persistence risks
- AI-native interfaces require different UX patterns than traditional CRUD applications
- Multi-device sync requires careful session and key management
- Real-time collaboration needs efficient state synchronization
- Zero-knowledge architecture means traditional "forgot password" flows don't work

**Why now?**
The frontend architecture is foundational to the entire platform. All features—from secret management to AI assistance to team collaboration—depend on a well-designed client application that correctly implements zero-knowledge encryption and provides an excellent user experience.

### Background

**Existing system:**
This is a greenfield implementation. No existing frontend application.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Frontend Team | Maintainable, scalable architecture | Technical debt, performance, DX |
| Security Lead | Zero-knowledge guarantees preserved | Key management, XSS/CSRF protection, audit trail |
| Product Team | Exceptional UX for all personas | Simplicity for beginners, power for advanced users |
| Backend Team | Clean API contracts, efficient data usage | API design alignment, request optimization |
| End Users | Fast, intuitive, secure application | Loading speed, ease of use, trust in security |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Preserve zero-knowledge encryption** - All secrets encrypted client-side, master key never leaves browser (success metric: 0 secrets transmitted unencrypted, 0 master passwords logged)
2. **Deliver fast, responsive UX** - Page load < 2s on 3G, TTI < 3s, smooth animations (success metric: Core Web Vitals pass, Lighthouse score > 90)
3. **Support AI-native interactions** - Conversational AI as primary interface, not just a chatbot add-on (success metric: 80% of secret acquisitions start via AI chat)
4. **Enable real-time collaboration** - Live updates when team members change secrets or settings (success metric: < 500ms update latency)

**Secondary goals:**
- Exceptional mobile experience (responsive design, touch-friendly)
- Offline-first capabilities for reading cached secrets
- Seamless multi-device experience with session sync
- Accessibility compliance (WCAG 2.1 AA minimum)

### Non-Goals

**Explicitly out of scope:**
- **Native mobile apps (iOS/Android)** - Post-MVP, use responsive web app initially
- **Desktop application (Electron)** - Post-MVP, browser-based for MVP
- **Offline secret creation** - Can only read cached secrets offline, creation requires network
- **Legacy browser support** - Target modern evergreen browsers only (Chrome 100+, Firefox 100+, Safari 15+)

### Success Metrics

**How we measure success:**
- **Zero-Knowledge Compliance**: 0 secrets transmitted unencrypted, 100% of encryption happens client-side
- **Performance**: Core Web Vitals pass (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- **User Experience**: Lighthouse score > 90, Accessibility score > 90
- **Security**: 0 critical/high XSS, CSRF, or key exposure vulnerabilities in security audit
- **AI Adoption**: > 70% of users interact with AI assistant in first session

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                       │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Next.js Frontend (Port 3000)              │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────┐    │ │
│  │  │          Pages & Layouts (App Router)        │    │ │
│  │  │  • /login, /dashboard, /projects/:id         │    │ │
│  │  │  • /settings, /team, /ai-chat                │    │ │
│  │  └────────────┬─────────────────────────────────┘    │ │
│  │               │                                       │ │
│  │  ┌────────────▼─────────────────────────────────┐    │ │
│  │  │        React Components (shadcn/ui)          │    │ │
│  │  │  • SecretCard, ProjectSelector, AIChat       │    │ │
│  │  │  • EncryptedInput, MasterPasswordPrompt      │    │ │
│  │  └────────────┬─────────────────────────────────┘    │ │
│  │               │                                       │ │
│  │  ┌────────────▼─────────────────────────────────┐    │ │
│  │  │         State Management (Zustand)           │    │ │
│  │  │  • Auth state (user, session, masterKey)     │    │ │
│  │  │  • UI state (modals, sidebar, theme)         │    │ │
│  │  │  • Crypto state (encryption ready flag)      │    │ │
│  │  └────────────┬─────────────────────────────────┘    │ │
│  │               │                                       │ │
│  │  ┌────────────▼─────────────────────────────────┐    │ │
│  │  │     Server State (React Query)               │    │ │
│  │  │  • Secrets cache (encrypted)                 │    │ │
│  │  │  • Projects, teams, organizations            │    │ │
│  │  │  • Optimistic updates, background refetch    │    │ │
│  │  └────────────┬─────────────────────────────────┘    │ │
│  │               │                                       │ │
│  │  ┌────────────▼─────────────────────────────────┐    │ │
│  │  │      Client-Side Encryption Layer            │    │ │
│  │  │  • Web Crypto API (AES-256-GCM)              │    │ │
│  │  │  • PBKDF2 key derivation (600k iterations)   │    │ │
│  │  │  • Master key in memory (CryptoKey object)   │    │ │
│  │  └────────────┬─────────────────────────────────┘    │ │
│  │               │                                       │ │
│  │  ┌────────────▼─────────────────────────────────┐    │ │
│  │  │         API Client Layer                     │    │ │
│  │  │  • REST client (fetch + custom wrapper)      │    │ │
│  │  │  • JWT token management & refresh            │    │ │
│  │  │  • Request/response interceptors             │    │ │
│  │  │  • Error handling & retry logic              │    │ │
│  │  └────────────┬─────────────────────────────────┘    │ │
│  │               │                                       │ │
│  └───────────────┼─────────────────────────────────────┘ │
│                  │                                         │
│  ┌───────────────▼─────────────────────────────────────┐ │
│  │         Local Storage (IndexedDB)                   │ │
│  │  • Encrypted master key (session-derived)          │ │
│  │  • Cached secrets (encrypted, for offline read)    │ │
│  │  • User preferences                                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
└──────────────────────┬────────────────────────────────────┘
                       │ HTTPS + JWT
                       │
┌──────────────────────▼────────────────────────────────────┐
│             Cloudflare Workers (Edge)                     │
│  • JWT verification                                       │
│  • Rate limiting                                          │
│  • API routing                                            │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│              Supabase Backend                             │
│  • PostgreSQL database (RLS enforced)                     │
│  • Supabase Auth (JWT tokens)                             │
│  • Realtime subscriptions (WebSocket)                     │
│  • Storage (avatars, exports)                             │
└───────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Next.js App Router**
- **Purpose:** Application framework providing routing, SSR, and build optimization
- **Technology:** Next.js 14.2.x (App Router), React 18.3.x, TypeScript 5.3.x
- **Responsibilities:**
  - File-based routing with dynamic routes
  - Server Components for SEO and initial load performance
  - Client Components for interactivity
  - API routes for server-side operations (if needed)
  - Image optimization and font loading

**Component 2: React Component Library (shadcn/ui)**
- **Purpose:** Reusable, accessible UI components
- **Technology:** React 18.3.x, Radix UI 1.x (primitives), Tailwind CSS 3.4.x
- **Responsibilities:**
  - Consistent design system components
  - Accessibility (ARIA labels, keyboard navigation)
  - Dark mode support
  - Responsive layouts

**Component 3: State Management (Zustand)**
- **Purpose:** Global client state for authentication, UI, and app configuration
- **Technology:** Zustand 4.5.x
- **Responsibilities:**
  - Authentication state (user, session, master key ready flag)
  - UI state (modals, sidebar collapsed, theme)
  - Encryption readiness flag
  - User preferences (local settings)

**Component 4: Server State Management (React Query)**
- **Purpose:** Cache and synchronize server data
- **Technology:** React Query 5.x (TanStack Query)
- **Responsibilities:**
  - Cache API responses (secrets remain encrypted)
  - Optimistic updates for instant UI feedback
  - Background refetching for data freshness
  - Request deduplication
  - Automatic retry on failure

**Component 5: Client-Side Encryption Layer**
- **Purpose:** Encrypt/decrypt secrets using master key, never expose plaintext to server
- **Technology:** Web Crypto API (native browser), PBKDF2, AES-256-GCM
- **Responsibilities:**
  - Master key derivation from master password (PBKDF2, 600k iterations)
  - Encrypt secrets before API calls
  - Decrypt secrets after retrieval
  - Secure key storage (memory + encrypted IndexedDB backup)
  - Key lifecycle management (lock/unlock)

**Component 6: API Client Layer**
- **Purpose:** Abstract REST API calls, handle authentication and errors
- **Technology:** Custom fetch wrapper, Axios alternative (lighter weight)
- **Responsibilities:**
  - JWT token injection into headers
  - Automatic token refresh on 401
  - Request/response interceptors
  - Error normalization
  - Retry logic with exponential backoff

### Component Interactions

**Next.js App Router ↔ React Components:**
- Protocol: React component composition
- Data format: Props and state
- Pages render components, components dispatch actions

**React Components ↔ Zustand:**
- Protocol: React hooks (`useAuthStore`, `useUIStore`)
- Data format: JavaScript objects
- Components read state and call actions

**React Components ↔ React Query:**
- Protocol: React hooks (`useQuery`, `useMutation`)
- Data format: JavaScript objects (encrypted secrets remain encrypted)
- Automatic caching and refetching

**Encryption Layer ↔ API Client:**
- Protocol: Function calls
- Data format: Encrypt before send, decrypt after receive
- All secret values pass through encryption layer

**API Client ↔ Cloudflare Workers:**
- Protocol: HTTPS (REST API)
- Data format: JSON
- Authentication: JWT Bearer token in `Authorization` header

---

## Component Details

### Component: Next.js Project Structure

**Purpose:** Organize code for scalability and maintainability using Next.js 14 App Router conventions.

**Project Structure:**
```
/abyrith-frontend
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx               # Root layout (providers, fonts)
│   ├── page.tsx                 # Landing page (/)
│   ├── (auth)/                  # Auth group (shared layout)
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── signup/
│   │   │   └── page.tsx        # Signup page
│   │   └── layout.tsx          # Auth layout (centered card)
│   ├── (app)/                   # Main app group (authenticated)
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Dashboard (/)
│   │   ├── projects/
│   │   │   ├── page.tsx        # Projects list
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Project detail
│   │   ├── settings/
│   │   │   └── page.tsx        # User settings
│   │   ├── team/
│   │   │   └── page.tsx        # Team management
│   │   ├── ai-chat/
│   │   │   └── page.tsx        # AI assistant chat
│   │   └── layout.tsx          # App layout (sidebar, header)
│   └── api/                     # API routes (if needed)
│       └── health/
│           └── route.ts        # Health check endpoint
├── components/                  # React components
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...                 # All shadcn components
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── MasterPasswordPrompt.tsx
│   │   └── OAuthButtons.tsx
│   ├── secrets/
│   │   ├── SecretCard.tsx
│   │   ├── SecretList.tsx
│   │   ├── CreateSecretDialog.tsx
│   │   └── EncryptedInput.tsx
│   ├── projects/
│   │   ├── ProjectSelector.tsx
│   │   └── ProjectSettings.tsx
│   ├── ai/
│   │   ├── AIChat.tsx
│   │   ├── MessageList.tsx
│   │   └── GuidedAcquisitionFlow.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
├── lib/                        # Utility libraries
│   ├── api/
│   │   ├── client.ts          # API client wrapper
│   │   ├── secrets.ts         # Secrets API methods
│   │   ├── projects.ts        # Projects API methods
│   │   └── auth.ts            # Auth API methods
│   ├── crypto/
│   │   ├── encryption.ts      # AES-256-GCM encrypt/decrypt
│   │   ├── keyDerivation.ts   # PBKDF2 master key derivation
│   │   └── keyStorage.ts      # IndexedDB key management
│   ├── auth/
│   │   ├── supabase.ts        # Supabase client setup
│   │   └── session.ts         # Session management
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useSecrets.ts
│   │   ├── useEncryption.ts
│   │   └── useRealtime.ts
│   ├── stores/                # Zustand stores
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   └── cryptoStore.ts
│   └── utils/
│       ├── cn.ts             # classnames utility (from shadcn)
│       └── validators.ts     # Zod schemas
├── types/                     # TypeScript types
│   ├── api.ts                # API response types
│   ├── database.ts           # Database types (generated)
│   └── index.ts              # Exported types
├── styles/
│   └── globals.css           # Global styles + Tailwind
├── public/
│   ├── images/
│   └── fonts/
├── .env.local                # Environment variables
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies
```

**Key Modules:**
- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
- `lib/api/` - API client and request methods
- `lib/crypto/` - Client-side encryption utilities
- `lib/stores/` - Zustand state stores
- `lib/hooks/` - Custom React hooks

---

### Component: State Management (Zustand)

**Purpose:** Manage global client state that doesn't come from the server (auth, UI, crypto readiness).

**Store Architecture:**

```typescript
// lib/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  // User identity (from Supabase)
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;

  // Master key state (NOT persisted, memory only)
  masterKeyReady: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setMasterKeyReady: (ready: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      masterKeyReady: false,

      setUser: (user) => set({
        user,
        isAuthenticated: !!user
      }),

      setSession: (session) => set({ session }),

      setMasterKeyReady: (ready) => set({
        masterKeyReady: ready
      }),

      logout: () => set({
        user: null,
        session: null,
        isAuthenticated: false,
        masterKeyReady: false
      }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist user and session, NOT masterKeyReady
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

```typescript
// lib/stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  // UI state
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  activeModal: string | null;

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  theme: 'system',
  activeModal: null,

  toggleSidebar: () => set((state) => ({
    sidebarCollapsed: !state.sidebarCollapsed
  })),

  setTheme: (theme) => set({ theme }),

  openModal: (modalId) => set({ activeModal: modalId }),

  closeModal: () => set({ activeModal: null }),
}));
```

**Why Zustand over Redux:**
- Simpler API (less boilerplate)
- No context provider needed
- TypeScript-friendly
- Better performance (fine-grained reactivity)
- Easier to test

---

### Component: Server State Management (React Query)

**Purpose:** Cache and synchronize data from the API, handle loading/error states, optimistic updates.

**Query Architecture:**

```typescript
// lib/api/secrets.ts (React Query hooks)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { encrypt, decrypt } from '../crypto/encryption';
import { getMasterKey } from '../crypto/keyStorage';

interface Secret {
  id: string;
  name: string;
  encrypted_value: string;  // Stored encrypted
  decrypted_value?: string; // Decrypted client-side (not sent to server)
  service_name: string;
  project_id: string;
  environment: 'development' | 'staging' | 'production';
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Fetch secrets for a project (returns encrypted, we decrypt)
export function useSecrets(projectId: string) {
  return useQuery({
    queryKey: ['secrets', projectId],
    queryFn: async () => {
      const response = await apiClient.get<Secret[]>(
        `/projects/${projectId}/secrets`
      );

      // Decrypt all secrets client-side
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      const decryptedSecrets = await Promise.all(
        response.data.map(async (secret) => ({
          ...secret,
          decrypted_value: await decrypt(
            secret.encrypted_value,
            masterKey
          ),
        }))
      );

      return decryptedSecrets;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
  });
}

// Create a new secret (encrypt before sending)
export function useCreateSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newSecret: {
      name: string;
      value: string;         // Plaintext (will be encrypted)
      service_name: string;
      project_id: string;
      environment: string;
      tags: string[];
    }) => {
      // Encrypt the value client-side
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      const encryptedValue = await encrypt(newSecret.value, masterKey);

      // Send encrypted value to server
      const response = await apiClient.post<Secret>('/secrets', {
        ...newSecret,
        encrypted_value: encryptedValue,
        value: undefined, // Remove plaintext
      });

      return response.data;
    },

    // Optimistic update
    onMutate: async (newSecret) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['secrets', newSecret.project_id]
      });

      // Snapshot previous value
      const previousSecrets = queryClient.getQueryData([
        'secrets',
        newSecret.project_id
      ]);

      // Optimistically update
      queryClient.setQueryData(
        ['secrets', newSecret.project_id],
        (old: Secret[] = []) => [
          ...old,
          {
            id: 'temp-' + Date.now(),
            ...newSecret,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      );

      return { previousSecrets };
    },

    // Rollback on error
    onError: (err, newSecret, context) => {
      queryClient.setQueryData(
        ['secrets', newSecret.project_id],
        context?.previousSecrets
      );
    },

    // Refetch on success
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['secrets', variables.project_id]
      });
    },
  });
}
```

**Cache Strategy:**
- **Secrets:** Stale after 5 min, cache for 10 min, refetch on window focus
- **Projects:** Stale after 10 min, cache for 30 min
- **User profile:** Stale after 15 min, cache for 1 hour
- **Organization members:** Stale after 5 min, cache for 15 min

---

### Component: Client-Side Encryption Layer

**Purpose:** Implement zero-knowledge encryption using Web Crypto API.

**Encryption Implementation:**

```typescript
// lib/crypto/keyDerivation.ts
/**
 * Derive master encryption key from master password using PBKDF2
 *
 * @param masterPassword - User's master password (never transmitted)
 * @param userSalt - Salt (typically user ID)
 * @returns CryptoKey for AES-256-GCM encryption
 */
export async function deriveMasterKey(
  masterPassword: string,
  userSalt: string
): Promise<CryptoKey> {
  // Import password as key material
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  // 600,000 iterations (OWASP 2023 recommendation)
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(userSalt),
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,  // extractable (for storage)
    ['encrypt', 'decrypt']
  );

  return key;
}
```

```typescript
// lib/crypto/encryption.ts
/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @param key - CryptoKey (AES-256-GCM)
 * @returns Base64-encoded encrypted data with IV prepended
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt using AES-256-GCM
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  // Prepend IV to ciphertext
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv, 0);
  combined.set(encryptedArray, iv.length);

  // Return Base64-encoded
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param ciphertext - Base64-encoded encrypted data with IV
 * @param key - CryptoKey (AES-256-GCM)
 * @returns Decrypted plaintext
 */
export async function decrypt(
  ciphertext: string,
  key: CryptoKey
): Promise<string> {
  // Decode Base64
  const combined = Uint8Array.from(
    atob(ciphertext),
    (c) => c.charCodeAt(0)
  );

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  // Decrypt using AES-256-GCM
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encryptedData
  );

  // Decode UTF-8
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
```

```typescript
// lib/crypto/keyStorage.ts
let masterKeyInMemory: CryptoKey | null = null;

/**
 * Store master key in memory and encrypted backup in IndexedDB
 */
export async function storeMasterKey(
  masterKey: CryptoKey,
  sessionToken: string
): Promise<void> {
  // Keep in memory
  masterKeyInMemory = masterKey;

  // Encrypt master key with session-derived key
  const storageKey = await deriveStorageKey(sessionToken);

  // Export master key to raw bytes
  const exportedKey = await crypto.subtle.exportKey('raw', masterKey);

  // Encrypt exported key
  const encryptedKey = await encrypt(
    btoa(String.fromCharCode(...new Uint8Array(exportedKey))),
    storageKey
  );

  // Store in IndexedDB
  await indexedDBSet('encrypted_master_key', encryptedKey);
}

/**
 * Retrieve master key from memory (or decrypt from IndexedDB)
 */
export async function getMasterKey(): Promise<CryptoKey | null> {
  // Return from memory if available
  if (masterKeyInMemory) {
    return masterKeyInMemory;
  }

  // Try to load from IndexedDB and decrypt
  const encryptedKey = await indexedDBGet('encrypted_master_key');
  if (!encryptedKey) {
    return null;
  }

  // Would need session token to decrypt (prompt user for master password)
  throw new Error('Master key locked, please re-enter master password');
}

/**
 * Lock master key (clear from memory)
 */
export function lockMasterKey(): void {
  masterKeyInMemory = null;
}

/**
 * Clear master key entirely (logout)
 */
export async function clearMasterKey(): Promise<void> {
  masterKeyInMemory = null;
  await indexedDBDelete('encrypted_master_key');
}
```

---

### Component: API Client Layer

**Purpose:** Abstract API calls, handle authentication, errors, and retries.

**API Client Implementation:**

```typescript
// lib/api/client.ts
import { useAuthStore } from '../stores/authStore';

interface APIError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  status: number;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; status: number }> {
    // Get JWT token from auth store
    const session = useAuthStore.getState().session;
    const token = session?.access_token;

    // Build headers
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Make request
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 (token expired) - attempt refresh
    if (response.status === 401 && token) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry request with new token
        return this.request<T>(endpoint, options);
      } else {
        // Refresh failed, redirect to login
        useAuthStore.getState().logout();
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    // Parse response
    const data = await response.json();

    // Handle errors
    if (!response.ok) {
      const error: APIError = {
        error: data.error || 'unknown_error',
        message: data.message || 'An error occurred',
        details: data.details,
        status: response.status,
      };
      throw error;
    }

    return { data, status: response.status };
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error || !session) {
        return false;
      }

      useAuthStore.getState().setSession(session);
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(endpoint: string): Promise<{ data: T; status: number }> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    body: unknown
  ): Promise<{ data: T; status: number }> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(
    endpoint: string,
    body: unknown
  ): Promise<{ data: T; status: number }> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<{ data: T; status: number }> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new APIClient(
  process.env.NEXT_PUBLIC_API_URL || 'https://api.abyrith.com/v1'
);
```

**API Endpoint Documentation Cross-References:**

The API Client Layer interacts with the following documented API endpoints:

- **Authentication Endpoints:** See `05-api/endpoints/auth-endpoints.md` for complete authentication API specifications including login, logout, OAuth flows, token refresh, and MFA endpoints
- **Secrets Management Endpoints:** See `05-api/endpoints/secrets-endpoints.md` for secrets CRUD operations, encryption/decryption flows, secret rotation, and filtering patterns
- **Projects & Environments Endpoints:** See `05-api/endpoints/projects-endpoints.md` for project and environment management APIs
- **REST API Design Patterns:** See `05-api/api-rest-design.md` for API conventions, error handling standards, rate limiting, pagination, and authentication patterns used across all endpoints

**Important:** All API requests must follow the authentication pattern documented in `05-api/endpoints/auth-endpoints.md` using JWT Bearer tokens. Error responses follow the standardized format defined in `05-api/api-rest-design.md`.

---

## Data Flow

### Flow 1: User Logs In and Decrypts Secrets

**Trigger:** User submits login form with email, account password, and master password.

**Steps:**

1. **Frontend: Authenticate with Supabase Auth**
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password: accountPassword,
   });
   ```

2. **Frontend: Derive Master Key from Master Password**
   ```typescript
   const userSalt = data.user.id;
   const masterKey = await deriveMasterKey(masterPassword, userSalt);
   ```

3. **Frontend: Verify Master Key (Test Decrypt)**
   ```typescript
   // Fetch a test secret to verify key is correct
   const testSecret = await apiClient.get(`/secrets/test`);
   try {
     await decrypt(testSecret.data.encrypted_value, masterKey);
   } catch (error) {
     throw new Error('Incorrect master password');
   }
   ```

4. **Frontend: Store Master Key (Memory + IndexedDB)**
   ```typescript
   await storeMasterKey(masterKey, data.session.access_token);
   useAuthStore.getState().setMasterKeyReady(true);
   ```

5. **Frontend: Fetch and Decrypt Secrets**
   ```typescript
   const { data: secrets } = useSecrets(projectId);
   // Secrets are automatically decrypted by React Query hook
   ```

**Sequence Diagram:**
```
User    LoginForm   Supabase   CryptoLayer   APIClient   Backend
 |          |           |            |            |          |
 |--submit->|           |            |            |          |
 |  (email, |           |            |            |          |
 |   acctPw,|           |            |            |          |
 |  masterPw)           |            |            |          |
 |          |--signIn-->|            |            |          |
 |          |           |--verify--->|            |          |
 |          |           |<--JWT------|            |          |
 |          |           |            |            |          |
 |          |--derive-->|            |            |          |
 |          |  masterKey|            |            |          |
 |          |<--key-----|            |            |          |
 |          |           |            |            |          |
 |          |-----------|----------->|--testDecrypt-------->|
 |          |           |            |            |--query-->|
 |          |           |            |            |<--data---|
 |          |           |            |<--encrypted|          |
 |          |           |<--decrypt--|            |          |
 |          |<--success-|            |            |          |
 |          |           |            |            |          |
 |          |--store--->|            |            |          |
 |          |  masterKey|            |            |          |
 |          |           |            |            |          |
 |<--redirect to dashboard            |          |          |
```

---

### Flow 2: User Creates a New Secret

**Trigger:** User fills out "Create Secret" form and clicks submit.

**Steps:**

1. **User Input:**
   ```typescript
   const formData = {
     name: 'Stripe API Key',
     value: 'sk_test_51H...',  // Plaintext
     service_name: 'Stripe',
     project_id: 'proj_123',
     environment: 'development',
     tags: ['payment', 'api-key'],
   };
   ```

2. **Encrypt Secret Value Client-Side:**
   ```typescript
   const masterKey = await getMasterKey();
   const encryptedValue = await encrypt(formData.value, masterKey);
   ```

3. **Send Encrypted Secret to API:**
   ```typescript
   const { mutate: createSecret } = useCreateSecret();
   createSecret({
     ...formData,
     encrypted_value: encryptedValue,
     value: undefined, // Remove plaintext
   });
   ```

4. **React Query: Optimistic Update**
   - Immediately add secret to UI (with temp ID)
   - If API call fails, rollback

5. **API Client: POST to `/secrets`**
   - Includes JWT token in headers
   - Server stores encrypted value (cannot decrypt)

6. **Backend: Store in Database**
   - RLS policies enforce user can only create in their organization
   - Encrypted value stored in `secrets.encrypted_value` column

7. **React Query: Refetch and Update Cache**
   - On success, invalidate cache
   - Refetch secrets list
   - New secret appears with real ID

**Data Transformations:**
- **Point A (Form input):** Plaintext secret value
- **Point B (Pre-API):** Encrypted with master key (Base64 string)
- **Point C (Network):** Encrypted value transmitted over HTTPS
- **Point D (Database):** Encrypted value stored in PostgreSQL BYTEA
- **Point E (Retrieve):** Encrypted value returned via API
- **Point F (Post-decrypt):** Decrypted in browser, plaintext shown in UI

---

### Flow 3: Real-Time Secret Update (Team Collaboration)

**Trigger:** Team member updates a secret in another browser/device.

**Steps:**

1. **Team Member A: Updates Secret**
   - Encrypts new value with their master key
   - Sends to API

2. **Backend: Database Update**
   - PostgreSQL triggers update
   - Supabase Realtime detects change

3. **WebSocket: Broadcast to Subscribed Clients**
   ```typescript
   supabase
     .channel(`project:${projectId}`)
     .on('postgres_changes', {
       event: 'UPDATE',
       schema: 'public',
       table: 'secrets',
       filter: `project_id=eq.${projectId}`,
     }, (payload) => {
       // Invalidate React Query cache
       queryClient.invalidateQueries(['secrets', projectId]);
     })
     .subscribe();
   ```

4. **Team Member B: React Query Refetch**
   - Cache invalidated by Realtime event
   - React Query automatically refetches
   - New encrypted value fetched

5. **Team Member B: Decrypt New Value**
   - Decrypt with Team Member B's master key
   - (Both use same master key for shared secrets via organization key)

6. **UI Update**
   - React Query updates component state
   - Secret value changes in UI

**Important:** Shared secrets use organization-level encryption key (derived from organization master key), not individual user keys.

---

## API Contracts

### Internal APIs

**API: Authentication Hook**

**Purpose:** Provide React components with authentication state and actions.

**Interface:**
```typescript
interface AuthHook {
  // State
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  masterKeyReady: boolean;

  // Actions
  login: (
    email: string,
    accountPassword: string,
    masterPassword: string
  ) => Promise<void>;

  loginWithOAuth: (provider: 'google' | 'github') => Promise<void>;

  logout: () => Promise<void>;

  unlockMasterKey: (masterPassword: string) => Promise<void>;

  lockMasterKey: () => void;
}
```

**Usage:**
```typescript
const { login, isAuthenticated, masterKeyReady } = useAuth();

const handleLogin = async () => {
  try {
    await login(email, accountPassword, masterPassword);
    router.push('/dashboard');
  } catch (error) {
    setError(error.message);
  }
};
```

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Browser ↔ Internet**
- **Threats:** MITM, XSS, CSRF, session hijacking
- **Controls:**
  - All traffic over HTTPS (TLS 1.3)
  - Content Security Policy (CSP) headers
  - Secure cookies (HttpOnly, Secure, SameSite=Strict)
  - No inline scripts (CSP blocks)
  - React's built-in XSS escaping

**Boundary 2: JavaScript Code ↔ User Input**
- **Threats:** XSS via user-generated content, malicious input
- **Controls:**
  - All user input sanitized (Zod validation)
  - React escapes JSX by default
  - No `dangerouslySetInnerHTML` except for trusted markdown (sanitized)
  - CSP prevents inline scripts

**Boundary 3: Memory ↔ Storage**
- **Threats:** Master key leakage via browser storage
- **Controls:**
  - Master key kept in memory only (CryptoKey object, non-extractable)
  - IndexedDB backup is encrypted with session-derived key
  - Clear master key on logout
  - Auto-lock after inactivity timeout

### Data Security

**Data at Rest (Browser):**
- **Encryption:** Master key encrypted in IndexedDB, secrets cached encrypted
- **Storage:**
  - IndexedDB: Encrypted master key, cached encrypted secrets
  - sessionStorage: Nothing sensitive (JWT in httpOnly cookie if possible)
  - localStorage: User preferences only (no secrets)
- **Access controls:** Same-origin policy, IndexedDB sandboxed per domain

**Data in Transit:**
- **Encryption:** TLS 1.3 for all API calls
- **Sensitive data:**
  - Master password: Never transmitted (client-only)
  - Encrypted secrets: Transmitted encrypted over HTTPS

**Data in Use (Memory):**
- **Processing:** Master key in CryptoKey object (non-extractable where possible)
- **Decrypted secrets:** Only in React component state (cleared on unmount)
- **Memory security:** Web Crypto API handles key security, clear on logout

### Threat Model

**Threat 1: XSS Attack**
- **Description:** Attacker injects malicious JavaScript into application
- **Likelihood:** Medium (common web attack)
- **Impact:** Critical (could steal master key from memory)
- **Mitigation:**
  - Strict CSP (no inline scripts, no eval)
  - React escapes all JSX
  - Sanitize all user input
  - Regular security audits
  - Dependency scanning (Dependabot)

**Threat 2: Master Key Exposure via Browser Storage**
- **Description:** Attacker accesses browser storage (localStorage, IndexedDB)
- **Likelihood:** Low (requires device access or malware)
- **Impact:** Critical (could decrypt all secrets)
- **Mitigation:**
  - Master key in memory only
  - IndexedDB backup is encrypted
  - Auto-lock after inactivity
  - Clear on logout

**Threat 3: Man-in-the-Middle (MITM)**
- **Description:** Attacker intercepts network traffic
- **Likelihood:** Low (HTTPS widely supported)
- **Impact:** High (could steal JWT, encrypted secrets)
- **Mitigation:**
  - HTTPS only (TLS 1.3)
  - HSTS headers
  - Certificate pinning (future consideration)
  - Secrets transmitted encrypted (even over HTTPS)

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Page load (first contentful paint): < 1.5s p95
- Time to interactive: < 3s p95
- Secret decryption: < 100ms per secret
- API calls: < 500ms p95 (with Cloudflare Workers caching)

**Throughput:**
- Handle 100+ secrets on page without lag
- Smooth 60fps animations
- Real-time updates < 500ms latency

**Resource Usage:**
- Memory: < 100MB for typical usage (50 secrets)
- CPU: < 10% average (spikes during PBKDF2 derivation)
- Storage: < 50MB IndexedDB

### Performance Optimization

**Optimizations implemented:**
- **Code splitting:** Lazy load routes with Next.js dynamic imports
- **Image optimization:** Next.js Image component with webp/avif
- **Font optimization:** Self-hosted fonts with `font-display: swap`
- **Tree shaking:** Remove unused code at build time
- **Caching:** React Query caches API responses, Cloudflare Workers caches at edge
- **Memoization:** `useMemo` and `React.memo` for expensive components
- **Virtual scrolling:** For large secret lists (react-virtual)

**Caching Strategy:**
- **API responses:** React Query 5-minute stale time
- **Static assets:** Immutable caching via Next.js (1 year)
- **IndexedDB:** Encrypted master key, encrypted secret cache

**Bundle Size Optimization:**
- **Target:** < 300KB gzipped main bundle
- **Techniques:**
  - Dynamic imports for routes
  - Tree-shake unused shadcn components
  - Analyze bundle with `@next/bundle-analyzer`

---

## Scalability

### Horizontal Scaling

**Components that scale horizontally:**
- **Next.js frontend:** Deployed to Cloudflare Pages, scales globally
- **API calls:** Cloudflare Workers auto-scale

**Load balancing:**
- Cloudflare automatically routes to nearest edge
- No client-side load balancing needed

### Vertical Scaling

Not applicable (serverless frontend on CDN).

### Bottlenecks

**Current bottlenecks:**
- **PBKDF2 key derivation:** 3-5s on slow devices (intentionally slow)
- **Large secret lists:** Decrypting 100+ secrets sequentially takes time

**Mitigation strategies:**
- PBKDF2: Tunable iteration count, show progress indicator
- Decryption: Batch decrypt in parallel using `Promise.all()`

---

## Failure Modes

### Failure Mode 1: Master Key Lost from Memory

**Scenario:** Browser tab crashes or user closes tab unexpectedly.

**Impact:** User must re-enter master password to unlock secrets.

**Detection:** `getMasterKey()` returns null on page load.

**Recovery:**
1. Check for encrypted master key in IndexedDB
2. If found, prompt user to re-enter master password
3. Derive key and compare with stored encrypted key
4. If correct, unlock; if not, require full re-authentication

**Prevention:**
- Store encrypted backup in IndexedDB
- Implement auto-save draft for forms

---

### Failure Mode 2: API Call Fails

**Scenario:** Network error or backend unavailable.

**Impact:** User cannot fetch/create/update secrets.

**Detection:** `fetch()` throws error or returns 5xx status.

**Recovery:**
1. React Query automatic retry (3 attempts with exponential backoff)
2. Show error toast with retry button
3. Optimistic updates rollback on failure
4. Queue mutations for offline mode (future)

**Prevention:**
- Cloudflare CDN reduces downtime
- Cache secrets in IndexedDB for offline read

---

### Failure Mode 3: JWT Token Expired (Refresh Fails)

**Scenario:** Access token expires and refresh fails.

**Impact:** User logged out unexpectedly.

**Detection:** API returns 401 after refresh attempt.

**Recovery:**
1. Clear authentication state
2. Redirect to login page
3. Show "Session expired, please log in again" message

**Prevention:**
- Proactive token refresh 15 minutes before expiry
- Extend refresh token lifetime to 30 days

---

## Alternatives Considered

### Alternative 1: Redux Toolkit instead of Zustand

**Description:** Use Redux Toolkit for state management.

**Pros:**
- Industry standard, large community
- Redux DevTools for debugging
- Time-travel debugging

**Cons:**
- More boilerplate (actions, reducers, slices)
- Larger bundle size
- Steeper learning curve
- Context provider required

**Why not chosen:** Zustand is simpler, lighter, and easier to test while providing all needed functionality.

---

### Alternative 2: Vite + React Router instead of Next.js

**Description:** Use Vite for build tooling and React Router for routing.

**Pros:**
- Faster build times
- Simpler configuration
- More control over routing

**Cons:**
- No SSR/SSG out of box
- Manual SEO optimization
- No Image component
- No API routes
- Fewer conventions

**Why not chosen:** Next.js provides SSR, excellent SEO, image optimization, and better DX out of the box.

---

### Alternative 3: Axios instead of custom fetch wrapper

**Description:** Use Axios library for HTTP requests.

**Pros:**
- Built-in request/response interceptors
- Automatic JSON parsing
- Request cancellation
- Progress events

**Cons:**
- Larger bundle size (~13KB)
- Fetch API is native (no dependency)
- Modern browsers have equivalent features

**Why not chosen:** Native fetch + custom wrapper is lighter and sufficient for our needs.

---

## Decision Log

### Decision 1: Next.js App Router (not Pages Router)

**Date:** 2025-10-30

**Context:** Next.js 13+ introduced App Router with server components. Should we use new App Router or stick with Pages Router?

**Options:**
1. Pages Router (stable, familiar)
2. App Router (new, server components)

**Decision:** Use App Router.

**Rationale:**
- Server Components reduce client bundle size
- Better data fetching patterns
- Future of Next.js (Pages Router in maintenance mode)
- Layouts reduce duplication

**Consequences:**
- Some third-party libraries may not fully support server components yet
- Learning curve for team
- But: Better performance and future-proof

---

### Decision 2: Zustand over Redux Toolkit

**Date:** 2025-10-30

**Context:** Need global state management for auth and UI state.

**Options:**
1. Redux Toolkit
2. Zustand
3. Jotai
4. React Context only

**Decision:** Zustand.

**Rationale:**
- Much simpler API than Redux (less boilerplate)
- Better TypeScript support
- No provider needed
- Smaller bundle size
- Adequate for our needs (auth state, UI state)

**Consequences:**
- No Redux DevTools time-travel (but Zustand has devtools)
- Smaller ecosystem than Redux

---

### Decision 3: React Query for Server State

**Date:** 2025-10-30

**Context:** Need to cache API responses and manage loading/error states.

**Options:**
1. React Query (TanStack Query)
2. SWR
3. Apollo Client (GraphQL)
4. Custom solution

**Decision:** React Query v5.

**Rationale:**
- Best-in-class caching and request deduplication
- Automatic background refetching
- Optimistic updates
- Excellent TypeScript support
- Large community and active development

**Consequences:**
- Adds dependency (~40KB)
- Must learn React Query patterns

---

### Decision 4: Client-Side Encryption Only (No Server-Side Decryption)

**Date:** 2025-10-30

**Context:** Zero-knowledge architecture requires all encryption happens client-side.

**Options:**
1. Client-side encryption only (chosen)
2. Hybrid (some secrets encrypted client-side, some server-side)
3. Server-side encryption only

**Decision:** Client-side encryption only.

**Rationale:**
- Aligns with zero-knowledge promise
- Server cannot decrypt secrets (trustless)
- Simpler security model (one encryption layer)
- Better for compliance (server never sees plaintext)

**Consequences:**
- Cannot search encrypted secret values server-side
- Recovery is harder (no server-side decryption fallback)
- Encryption overhead on client (but manageable with Web Crypto API)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `05-api/api-rest-design.md` - REST API specification
- [x] `03-security/auth/authentication-flow.md` - Authentication flows
- [x] `TECH-STACK.md` - Technology stack decisions
- [x] `02-architecture/system-overview.md` - System architecture

**External Services:**
- Supabase (PostgreSQL, Auth, Realtime)
- Cloudflare Workers (API gateway)
- Cloudflare Pages (hosting)

### Architecture Dependencies

**Depends on these components:**
- Cloudflare Workers API Gateway - For API routing and JWT verification
- Supabase Auth - For user authentication and session management
- Supabase Realtime - For real-time updates
- PostgreSQL (via Supabase) - For data storage

**Required by these components:**
- All user-facing features (secrets, projects, AI chat, team management)
- Browser extension (future)
- CLI tool (future)

---

## References

### Internal Documentation
- `03-security/auth/authentication-flow.md` - Authentication architecture
- `03-security/security-model.md` - Zero-knowledge encryption
- `03-security/encryption-specification.md` - Encryption implementation details
- `TECH-STACK.md` - Technology decisions (Next.js, React, Zustand, React Query, Web Crypto API)
- `GLOSSARY.md` - Technical term definitions
- `02-architecture/system-overview.md` - Overall system architecture

### External Resources
- [Next.js Documentation](https://nextjs.org/docs) - Next.js 14 App Router guide
- [React Documentation](https://react.dev) - React 18 official docs
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction) - Zustand state management
- [TanStack Query (React Query)](https://tanstack.com/query/latest) - React Query v5 docs
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Browser cryptography
- [shadcn/ui](https://ui.shadcn.com) - Component library
- [Tailwind CSS](https://tailwindcss.com/docs) - Utility-first CSS framework
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction) - Supabase SDK

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial frontend architecture document |

---

## Notes

### Future Enhancements
- **Service Worker for offline mode** - Cache encrypted secrets for offline read access
- **React Native mobile apps** - Reuse encryption layer and API client
- **Electron desktop app** - Better native integration (biometric unlock)
- **WebAuthn/Passkeys** - Hardware key support for authentication
- **Virtual scrolling optimization** - For users with 1000+ secrets
- **Web Workers for encryption** - Offload PBKDF2 and AES to worker thread to avoid blocking UI

### Known Issues
- **PBKDF2 derivation blocks UI** - 600k iterations take 3-5 seconds on slow devices (by design for security, but UX impact)
- **Large secret lists slow to decrypt** - Decrypting 100+ secrets sequentially impacts initial load (mitigate with pagination and parallel decryption)
- **No offline secret creation** - Requires network connection to encrypt and store (future: queue for later sync)

### Next Review Date
2025-11-30 (review after initial implementation and performance testing)
