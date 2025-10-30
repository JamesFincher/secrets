---
Document: App Router Page Structure - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: TECH-STACK.md, 07-frontend/frontend-architecture.md, 02-architecture/system-overview.md
---

# App Router Page Structure Architecture

## Overview

This document defines the page routing structure, file organization, layout patterns, and data fetching strategies for the Abyrith Next.js 14 App Router frontend. It establishes conventions for creating new pages, managing layouts, handling authentication guards, and implementing server/client component patterns that preserve zero-knowledge encryption guarantees.

**Purpose:** Provide a clear, consistent structure for organizing pages and routes in the Abyrith application, ensuring maintainable code, optimal performance through server components, and adherence to Next.js 14 App Router best practices.

**Scope:** File-based routing structure, layout composition, server vs client components, data fetching patterns, metadata configuration, loading/error states, and authentication routing.

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
Abyrith requires a well-organized routing structure that supports both public marketing pages (landing page) and authenticated application pages (dashboard, secrets management, AI chat). Next.js 14 App Router introduces server components, layouts, and file-based routing conventions that must be leveraged correctly to balance performance, SEO, and client-side encryption requirements.

**Pain points:**
- Server components cannot access browser APIs (Web Crypto API) needed for decryption
- Layouts must handle both authenticated and unauthenticated states
- Route groups needed to share layouts without affecting URL structure
- Loading and error states must be consistent across all pages
- Authentication guards must redirect correctly without blocking public pages

**Why now?**
Page structure is foundational to the entire frontend. All features depend on a clear routing architecture that developers can follow consistently.

### Background

**Existing system:**
This is a greenfield implementation. No existing page structure.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Frontend Team | Clear conventions, easy to extend | Code organization, route complexity, maintainability |
| Product Team | SEO for marketing pages | Landing page performance, discoverability |
| Security Lead | Auth guards on protected routes | Unauthenticated users cannot access secrets |
| Users | Fast page loads, intuitive navigation | Performance, UX consistency |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Clear, intuitive routing structure** - Developers can find and create pages easily (success metric: New pages added in < 10 minutes)
2. **Optimal performance via server components** - Static content served fast, dynamic content client-rendered (success metric: LCP < 2s, FCP < 1.5s)
3. **Authentication guards on protected routes** - Unauthenticated users redirected to login (success metric: 0 unauthorized access to secrets)
4. **Consistent layouts and error handling** - All pages share common UI patterns (success metric: 100% of pages use layout system)

**Secondary goals:**
- SEO-optimized metadata for public pages
- Proper loading states during navigation
- Type-safe route parameters and search params
- Organized colocated components per route

### Non-Goals

**Explicitly out of scope:**
- **Middleware-based authentication** - Use client-side auth checks (master key requirement makes middleware complex)
- **Internationalization (i18n)** - English only for MVP
- **Multi-tenant routing** - All orgs use same routes (no `/org/:id` prefix)

### Success Metrics

**How we measure success:**
- **Routing clarity**: New pages created with correct structure 100% of the time
- **Performance**: Public pages LCP < 2s, authenticated pages LCP < 2.5s
- **Auth security**: 0 incidents of unauthorized access to protected routes
- **Code consistency**: 100% of pages follow established patterns (layout usage, file naming)

---

## Architecture Overview

### High-Level Architecture

```
/abyrith-frontend/app/
│
├── layout.tsx                    # Root layout (providers, fonts, global styles)
├── page.tsx                      # Landing page (/)
├── globals.css                   # Global styles + Tailwind
├── not-found.tsx                 # 404 page
│
├── (marketing)/                  # Route group: public pages
│   ├── layout.tsx               # Marketing layout (header, footer)
│   ├── about/
│   │   └── page.tsx            # /about
│   ├── pricing/
│   │   └── page.tsx            # /pricing
│   ├── blog/
│   │   ├── page.tsx            # /blog
│   │   └── [slug]/
│   │       └── page.tsx        # /blog/:slug
│   └── docs/
│       ├── page.tsx            # /docs
│       └── [slug]/
│           └── page.tsx        # /docs/:slug
│
├── (auth)/                       # Route group: authentication pages
│   ├── layout.tsx               # Auth layout (centered card, no sidebar)
│   ├── login/
│   │   ├── page.tsx            # /login
│   │   ├── loading.tsx         # Loading state
│   │   └── error.tsx           # Error state
│   ├── signup/
│   │   ├── page.tsx            # /signup
│   │   └── loading.tsx
│   ├── forgot-password/
│   │   └── page.tsx            # /forgot-password
│   └── reset-password/
│       └── page.tsx            # /reset-password?token=xxx
│
├── (app)/                        # Route group: authenticated application
│   ├── layout.tsx               # App layout (sidebar, header)
│   ├── dashboard/
│   │   ├── page.tsx            # /dashboard
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── projects/
│   │   ├── page.tsx            # /projects (list)
│   │   ├── [id]/
│   │   │   ├── page.tsx        # /projects/:id
│   │   │   ├── layout.tsx      # Project-specific layout (tabs)
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   ├── secrets/
│   │   │   │   └── page.tsx    # /projects/:id/secrets
│   │   │   ├── environments/
│   │   │   │   └── page.tsx    # /projects/:id/environments
│   │   │   ├── team/
│   │   │   │   └── page.tsx    # /projects/:id/team
│   │   │   └── settings/
│   │   │       └── page.tsx    # /projects/:id/settings
│   │   └── new/
│   │       └── page.tsx        # /projects/new
│   ├── settings/
│   │   ├── page.tsx            # /settings (redirects to profile)
│   │   ├── layout.tsx          # Settings layout (sidebar tabs)
│   │   ├── profile/
│   │   │   └── page.tsx        # /settings/profile
│   │   ├── security/
│   │   │   └── page.tsx        # /settings/security
│   │   ├── billing/
│   │   │   └── page.tsx        # /settings/billing
│   │   └── preferences/
│   │       └── page.tsx        # /settings/preferences
│   ├── team/
│   │   ├── page.tsx            # /team (org members list)
│   │   └── [memberId]/
│   │       └── page.tsx        # /team/:memberId
│   └── ai-chat/
│       ├── page.tsx            # /ai-chat
│       └── [conversationId]/
│           └── page.tsx        # /ai-chat/:conversationId
│
└── api/                          # API routes (optional, for server-side logic)
    └── health/
        └── route.ts            # /api/health (health check endpoint)
```

### Key Components

**Component 1: Root Layout**
- **Purpose:** Wrap entire application with providers and global configuration
- **Technology:** React Server Component (default)
- **Responsibilities:**
  - Render HTML structure (<html>, <body>)
  - Provide React Query provider
  - Provide theme provider (dark mode)
  - Load global fonts (next/font)
  - Include global styles

**Component 2: Route Groups**
- **Purpose:** Organize routes without affecting URL structure
- **Technology:** Next.js App Router convention (folders in parentheses)
- **Responsibilities:**
  - `(marketing)` - Public pages with marketing layout
  - `(auth)` - Authentication pages with centered card layout
  - `(app)` - Authenticated pages with sidebar/header layout

**Component 3: Layouts**
- **Purpose:** Share UI structure across multiple pages
- **Technology:** React Server Components or Client Components
- **Responsibilities:**
  - Marketing layout: Public header + footer
  - Auth layout: Centered card, no sidebar
  - App layout: Sidebar + header (authenticated)
  - Settings layout: Nested sidebar for settings tabs

**Component 4: Pages**
- **Purpose:** Render route-specific content
- **Technology:** Server Components (default) or Client Components ('use client')
- **Responsibilities:**
  - Fetch data (server components)
  - Render UI (mix of server/client components)
  - Handle form submissions (client components)

**Component 5: Loading & Error States**
- **Purpose:** Provide consistent feedback during async operations
- **Technology:** Next.js conventions (`loading.tsx`, `error.tsx`)
- **Responsibilities:**
  - `loading.tsx` - Shown during navigation/data fetching
  - `error.tsx` - Shown when errors occur (with retry button)

### Component Interactions

**Root Layout → Route Group Layouts:**
- Root layout wraps all pages
- Route group layouts wrap specific sections
- Nested composition (Root → Marketing → Page)

**Pages → Components:**
- Pages import and render components
- Server components for static content
- Client components for interactivity

**Pages → Data Fetching:**
- Server components fetch data directly
- Client components use React Query hooks

---

## Component Details

### Component: Root Layout

**Purpose:** Provide global application setup and providers.

**File: `app/layout.tsx`**
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Abyrith - AI-Native Secrets Management',
    template: '%s | Abyrith',
  },
  description:
    'Manage API keys and secrets with zero-knowledge encryption and AI-powered guidance.',
  keywords: ['secrets management', 'API keys', 'zero-knowledge', 'AI'],
  authors: [{ name: 'Abyrith Team' }],
  creator: 'Abyrith',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://abyrith.com',
    title: 'Abyrith - AI-Native Secrets Management',
    description:
      'Manage API keys and secrets with zero-knowledge encryption and AI-powered guidance.',
    siteName: 'Abyrith',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Abyrith - AI-Native Secrets Management',
    description:
      'Manage API keys and secrets with zero-knowledge encryption and AI-powered guidance.',
    creator: '@abyrith',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Providers Component:**
```typescript
// app/providers.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { queryClient } from '@/lib/api/queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

---

### Component: App Layout (Authenticated Pages)

**Purpose:** Provide sidebar and header for authenticated users.

**File: `app/(app)/layout.tsx`**
```typescript
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />

          <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
```

**AuthGuard Component:**
```typescript
// components/auth/AuthGuard.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, masterKeyReady } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Show nothing while checking authentication
  if (!isAuthenticated) {
    return null;
  }

  // Show master key unlock prompt if needed
  if (!masterKeyReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <UnlockVaultPrompt />
      </div>
    );
  }

  return <>{children}</>;
}
```

---

### Component: Project Page with Dynamic Route

**Purpose:** Display project details with dynamic project ID.

**File: `app/(app)/projects/[id]/page.tsx`**
```typescript
'use client';

import { useParams } from 'next/navigation';
import { useProject } from '@/lib/api/projects';
import { useSecrets } from '@/lib/api/secrets';
import { SecretList } from '@/components/secrets/SecretList';
import { ProjectHeader } from '@/components/projects/ProjectHeader';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Fetch project data
  const { data: project, isLoading: projectLoading } = useProject(projectId);

  // Fetch secrets for project
  const { data: secrets, isLoading: secretsLoading } = useSecrets(projectId);

  if (projectLoading || secretsLoading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div>
      <ProjectHeader project={project} />

      <div className="mt-6">
        <SecretList secrets={secrets || []} projectId={projectId} />
      </div>
    </div>
  );
}
```

**Loading State:**
```typescript
// app/(app)/projects/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Skeleton for project header */}
      <div className="h-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>

      {/* Skeleton for secret cards */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
        ></div>
      ))}
    </div>
  );
}
```

**Error State:**
```typescript
// app/(app)/projects/[id]/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service (Sentry)
    console.error('Project page error:', error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="text-gray-600 dark:text-gray-400">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

---

### Component: Settings Layout (Nested Layout)

**Purpose:** Provide tabbed navigation for settings pages.

**File: `app/(app)/settings/layout.tsx`**
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const settingsTabs = [
  { name: 'Profile', href: '/settings/profile' },
  { name: 'Security', href: '/settings/security' },
  { name: 'Billing', href: '/settings/billing' },
  { name: 'Preferences', href: '/settings/preferences' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {settingsTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium',
                pathname === tab.href
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>{children}</div>
    </div>
  );
}
```

---

## Data Flow

### Flow 1: Navigating to Project Page

**Trigger:** User clicks on project link in dashboard.

**Steps:**

1. **Next.js Router: Navigate**
   ```typescript
   router.push('/projects/proj_123');
   ```

2. **App Layout: Render**
   - AuthGuard checks authentication
   - Sidebar and header rendered

3. **Page: Mount**
   - Extract `projectId` from params
   - Call `useProject(projectId)` and `useSecrets(projectId)`

4. **React Query: Fetch Data**
   - Check cache first
   - If cache miss, fetch from API
   - Show loading state while fetching

5. **Page: Render**
   - Receive project and secrets data
   - Render ProjectHeader and SecretList components

**Sequence Diagram:**
```
User    Router   Layout   Page   ReactQuery   API
 |        |        |       |         |          |
 |--click->       |       |         |          |
 |        |--nav-->       |         |          |
 |        |        |--auth check     |          |
 |        |        |--render         |          |
 |        |        |       |--mount  |          |
 |        |        |       |--useProject------->|
 |        |        |       |         |--fetch-->|
 |        |        |       |         |<--data---|
 |        |        |       |<--data--|          |
 |<-------render project---|         |          |
```

---

## API Contracts

### Page Props Interface

**Dynamic Routes:**
```typescript
interface PageProps {
  params: {
    [key: string]: string; // Dynamic route segments
  };
  searchParams: {
    [key: string]: string | string[] | undefined; // Query params
  };
}

// Example: /projects/[id]/page.tsx
export default function ProjectPage({ params, searchParams }: PageProps) {
  const projectId = params.id;
  const tab = searchParams.tab; // ?tab=secrets
  // ...
}
```

### Metadata Export

**For SEO:**
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Details',
  description: 'View and manage project secrets',
};

// Or dynamic metadata
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const project = await fetchProject(params.id);

  return {
    title: `${project.name} - Abyrith`,
    description: `Manage secrets for ${project.name}`,
  };
}
```

---

## Security Architecture

### Authentication Guards

**Client-Side Auth Check:**
```typescript
// AuthGuard redirects to login if not authenticated
// Master key check shows unlock prompt if needed
```

**Route Protection:**
- All routes under `(app)/` are protected by AuthGuard
- Public routes (`(marketing)/`, `(auth)/`) have no guard
- API routes use JWT verification (not covered in this doc)

### Data Security

**Server Components:**
- Cannot access browser APIs (Web Crypto API)
- Cannot decrypt secrets
- Used for static content only

**Client Components:**
- Can access Web Crypto API
- Handle secret decryption
- Manage master key state

---

## Performance Characteristics

### Performance Requirements

**Page Load Times:**
- Public pages (marketing): < 2s LCP
- Authenticated pages: < 2.5s LCP
- Navigation between pages: < 500ms

### Server Component Strategy

**Use Server Components for:**
- Static content (headers, footers, marketing text)
- Initial data fetching (project metadata, user profile)
- SEO-important content

**Use Client Components for:**
- Interactive forms
- Encryption/decryption
- State management (Zustand, React Query)
- Real-time updates

---

## Scalability

### Route Organization

**As application grows:**
- Add new route groups for major features
- Colocate components with pages
- Keep route depth reasonable (< 4 levels)

**Example: New feature (Audit Logs)**
```
app/(app)/audit-logs/
├── page.tsx              # /audit-logs
├── layout.tsx
├── [logId]/
│   └── page.tsx          # /audit-logs/:logId
└── filters/
    └── page.tsx          # /audit-logs/filters
```

---

## Failure Modes

### Failure Mode 1: 404 Not Found

**Scenario:** User navigates to non-existent route.

**Impact:** User sees 404 page.

**Detection:** Next.js automatically handles via `not-found.tsx`.

**Recovery:**
- Custom 404 page with helpful links
- Search functionality (future)

**File: `app/not-found.tsx`**
```typescript
export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-2 text-xl">Page not found</p>
      <Link href="/dashboard" className="mt-4">
        Go to Dashboard
      </Link>
    </div>
  );
}
```

---

### Failure Mode 2: Auth Guard Redirect Loop

**Scenario:** Authenticated user redirected to login, then back to app, repeat.

**Impact:** User cannot access application.

**Detection:** Browser console shows repeated redirects.

**Recovery:**
1. Clear localStorage/sessionStorage
2. Log out completely
3. Log in again

**Prevention:**
- Proper session management
- Check auth state before redirecting

---

## Alternatives Considered

### Alternative 1: Pages Router instead of App Router

**Description:** Use Next.js Pages Router (pages/ directory).

**Pros:**
- More mature, stable
- Wider ecosystem support
- Simpler mental model

**Cons:**
- No server components
- Less optimal performance
- Future of Next.js is App Router

**Why not chosen:** App Router is the future of Next.js, provides better performance via server components, and Abyrith is a greenfield project.

---

### Alternative 2: No Route Groups

**Description:** Organize routes without parentheses grouping.

**Pros:**
- Simpler file structure
- Fewer folders

**Cons:**
- Cannot share layouts without affecting URL
- Harder to organize related pages
- URL structure dictates folder structure

**Why not chosen:** Route groups allow layout sharing without affecting URLs, making code more organized and maintainable.

---

## Decision Log

### Decision 1: Use App Router (not Pages Router)

**Date:** 2025-10-30

**Context:** Next.js offers both Pages Router (older) and App Router (newer).

**Decision:** Use App Router.

**Rationale:**
- Future of Next.js development
- Server components reduce bundle size
- Better performance for static content
- Improved data fetching patterns

---

### Decision 2: Client-Side Auth Guards (not Middleware)

**Date:** 2025-10-30

**Context:** Authentication can be checked in middleware or client components.

**Decision:** Use client-side AuthGuard component.

**Rationale:**
- Master key availability must be checked client-side
- Middleware cannot access client-side state
- Simpler to implement and debug
- Good enough for MVP (middleware can be added later)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `TECH-STACK.md` - Next.js 14 specified
- [x] `07-frontend/frontend-architecture.md` - Overall architecture

**External Services:**
- Next.js 14.2.x (App Router)
- React 18.3.x

### Architecture Dependencies

**Depends on these components:**
- Auth Store (Zustand) - For authentication state
- API Client - For data fetching
- Component Library (shadcn/ui) - For UI components

---

## References

### Internal Documentation
- `07-frontend/frontend-architecture.md` - Frontend architecture
- `TECH-STACK.md` - Technology stack
- `GLOSSARY.md` - Term definitions

### External Resources
- [Next.js App Router Documentation](https://nextjs.org/docs/app) - Official App Router guide
- [Next.js Routing](https://nextjs.org/docs/app/building-your-application/routing) - Routing patterns
- [Server vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns) - When to use each

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial App Router page structure architecture |

---

## Notes

### Future Enhancements
- Middleware-based auth (when master key management is more robust)
- Internationalization (i18n) for multi-language support
- Parallel routes for modal views
- Intercepting routes for optimistic navigation

### Known Issues
- Auth guard causes flash of redirect on slow connections (mitigate with better loading states)

### Next Review Date
2025-11-30 (after initial implementation)
