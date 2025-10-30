---
Document: React Query Setup - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: TECH-STACK.md, 07-frontend/frontend-architecture.md, 05-api/api-rest-design.md
---

# React Query Setup Architecture

## Overview

This document defines the React Query (TanStack Query v5) configuration and usage patterns for the Abyrith frontend. React Query manages all server state, providing automatic caching, background refetching, optimistic updates, and request deduplication for API calls. This architecture ensures efficient data synchronization while maintaining zero-knowledge encryption guarantees.

**Purpose:** Establish standardized patterns for server state management using React Query, ensuring consistent API data handling, optimal caching strategies, and seamless integration with client-side encryption.

**Scope:** This document covers React Query provider configuration, query/mutation patterns, cache management strategies, integration with the encryption layer, error handling, and performance optimization.

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
The Abyrith frontend needs to fetch encrypted secrets, projects, organizations, and other data from the API, cache this data efficiently, handle loading and error states, implement optimistic updates for instant UI feedback, and synchronize data across components—all while maintaining zero-knowledge encryption guarantees where secrets are decrypted only client-side.

**Pain points:**
- Manual state management for API calls is error-prone and verbose
- Cache invalidation logic becomes complex quickly
- Loading and error states require boilerplate in every component
- Optimistic updates need careful rollback logic
- Request deduplication must be implemented manually
- Background refetching for data freshness adds complexity
- Encrypted secrets must remain encrypted in cache until decryption is needed

**Why now?**
React Query setup is foundational to the frontend. All features that fetch data from the API depend on proper React Query configuration, and establishing patterns now prevents inconsistencies later.

### Background

**Existing system:**
This is a greenfield implementation. No existing React Query setup.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Frontend Team | Developer experience, maintainability | Complexity, learning curve, debugging |
| Backend Team | API usage patterns, efficient requests | Request volume, proper caching, API contract adherence |
| Security Lead | Zero-knowledge guarantees | Decrypted data not cached improperly |
| End Users | Fast, responsive UI | Loading states, stale data, perceived performance |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Standardized data fetching** - All API calls use React Query hooks (success metric: 100% of API calls use React Query, 0 manual fetch calls)
2. **Optimal caching** - Reduce unnecessary API calls through intelligent caching (success metric: 50% reduction in duplicate requests)
3. **Preserve zero-knowledge encryption** - Secrets remain encrypted in cache (success metric: 0 plaintext secrets in React Query cache)
4. **Excellent developer experience** - Simple, consistent API for fetching data (success metric: < 10 lines of code for typical query)

**Secondary goals:**
- Optimistic updates for instant UI feedback
- Automatic background refetching for data freshness
- Request deduplication to avoid redundant API calls
- Proper error handling with retry logic

### Non-Goals

**Explicitly out of scope:**
- **Real-time updates** - Handled by Supabase Realtime subscriptions, not React Query polling
- **Complex offline synchronization** - Post-MVP, basic offline read-only access only
- **Global state management** - Client-only state (UI state, auth state) managed by Zustand

### Success Metrics

**How we measure success:**
- **API Efficiency**: 50% reduction in duplicate API requests vs. manual fetch approach
- **Cache Hit Rate**: > 80% of queries served from cache within stale time
- **Developer Experience**: < 10 lines of code for typical query/mutation
- **Error Recovery**: 95% of transient errors recovered automatically via retry

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                React Components                         │
│  (SecretCard, ProjectList, Dashboard, etc.)             │
└────────────┬────────────────────────────────────────────┘
             │
             │ useQuery, useMutation hooks
             │
┌────────────▼────────────────────────────────────────────┐
│          React Query (TanStack Query v5)                │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │           Query Cache                          │    │
│  │  • Secrets (encrypted)                         │    │
│  │  • Projects                                    │    │
│  │  • Organizations                               │    │
│  │  • User profiles                               │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Query Client Configuration             │    │
│  │  • Default stale time: 5 min                   │    │
│  │  • Default cache time: 10 min                  │    │
│  │  • Retry: 3 attempts with exponential backoff  │    │
│  │  • Refetch on window focus: true               │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└────────────┬────────────────────────────────────────────┘
             │
             │ API calls (fetch)
             │
┌────────────▼────────────────────────────────────────────┐
│              API Client Layer                           │
│  • JWT token injection                                  │
│  • Request/response interceptors                        │
│  • Error normalization                                  │
└────────────┬────────────────────────────────────────────┘
             │
             │ Encrypted data passes through encryption layer
             │
┌────────────▼────────────────────────────────────────────┐
│          Client-Side Encryption Layer                   │
│  • Encrypt secrets before mutation                      │
│  • Decrypt secrets after query                          │
│  • Master key management                                │
└────────────┬────────────────────────────────────────────┘
             │
             │ HTTPS + JWT
             │
┌────────────▼────────────────────────────────────────────┐
│         Cloudflare Workers (Edge API)                   │
└─────────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│              Supabase Backend                           │
│  • PostgreSQL (secrets stored encrypted)                │
│  • Realtime (triggers React Query invalidation)         │
└─────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: QueryClientProvider**
- **Purpose:** Provides React Query context to all components
- **Technology:** React Query v5, React Context
- **Responsibilities:**
  - Initialize QueryClient with default configuration
  - Provide query client to component tree
  - Configure global query/mutation defaults

**Component 2: Query Hooks**
- **Purpose:** Custom hooks for data fetching (useSecrets, useProjects, etc.)
- **Technology:** React Query useQuery hook + custom wrappers
- **Responsibilities:**
  - Fetch data from API
  - Decrypt encrypted data (secrets)
  - Return loading/error/data states
  - Handle cache keys consistently

**Component 3: Mutation Hooks**
- **Purpose:** Custom hooks for data modification (useCreateSecret, useUpdateProject, etc.)
- **Technology:** React Query useMutation hook + custom wrappers
- **Responsibilities:**
  - Encrypt data before sending (secrets)
  - Send mutations to API
  - Optimistic updates
  - Cache invalidation after success

**Component 4: Query Cache**
- **Purpose:** In-memory cache of API responses
- **Technology:** React Query internal cache
- **Responsibilities:**
  - Store query results (secrets remain encrypted until decryption)
  - Garbage collection of stale data
  - Cache invalidation on mutations
  - Deduplication of identical requests

**Component 5: DevTools**
- **Purpose:** Debug React Query state in development
- **Technology:** @tanstack/react-query-devtools
- **Responsibilities:**
  - Visualize query cache
  - Show query states (fresh/stale/fetching)
  - Manual cache manipulation for debugging
  - Performance insights

### Component Interactions

**React Components ↔ Query Hooks:**
- Protocol: React hooks (useQuery, useMutation)
- Data format: TypeScript interfaces
- Components call hooks, receive loading/error/data states

**Query Hooks ↔ API Client:**
- Protocol: Async function calls
- Data format: JSON (encrypted values remain encrypted)
- Query hooks call API client methods

**API Client ↔ Encryption Layer:**
- Protocol: Function calls
- Data format: Plaintext → Encrypted (mutations), Encrypted → Plaintext (queries)
- Encryption layer wraps API calls for secrets

**React Query ↔ Cache:**
- Protocol: Internal React Query cache API
- Data format: JavaScript objects
- Automatic caching based on query keys

---

## Component Details

### Component: QueryClient Configuration

**Purpose:** Configure global React Query behavior for all queries and mutations.

**Configuration File:** `lib/react-query/queryClient.ts`

**Configuration Options:**

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: Data considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache time (garbage collection): Keep in cache for 10 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes

      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus (user returns to tab)
      refetchOnWindowFocus: true,

      // Refetch on network reconnect
      refetchOnReconnect: true,

      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
});
```

**Per-Resource Overrides:**

```typescript
// Secrets: More frequent refetching (sensitive data)
export const secretsQueryOptions = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 5 * 60 * 1000,    // 5 minutes
};

// Projects: Less frequent refetching (changes infrequently)
export const projectsQueryOptions = {
  staleTime: 10 * 60 * 1000, // 10 minutes
  gcTime: 30 * 60 * 1000,    // 30 minutes
};

// User profile: Rarely changes
export const userProfileQueryOptions = {
  staleTime: 15 * 60 * 1000, // 15 minutes
  gcTime: 60 * 60 * 1000,    // 1 hour
};

// Organization members: Moderately frequent refetching
export const orgMembersQueryOptions = {
  staleTime: 5 * 60 * 1000,  // 5 minutes
  gcTime: 15 * 60 * 1000,    // 15 minutes
};
```

---

### Component: Query Hook Pattern

**Purpose:** Standardized pattern for creating query hooks.

**File Location:** `lib/api/[resource-name].ts`

**Pattern:**

```typescript
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { decrypt } from '../crypto/encryption';
import { getMasterKey } from '../crypto/keyStorage';

// Type definitions
interface Secret {
  id: string;
  name: string;
  encrypted_value: string;
  decrypted_value?: string; // Added client-side after decryption
  service_name: string;
  project_id: string;
  environment: 'development' | 'staging' | 'production';
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Fetch secrets for a project and decrypt them client-side
 *
 * @param projectId - Project ID to fetch secrets for
 * @returns Query result with decrypted secrets
 */
export function useSecrets(
  projectId: string
): UseQueryResult<Secret[], Error> {
  return useQuery({
    // Query key: Uniquely identifies this query in cache
    queryKey: ['secrets', projectId],

    // Query function: Fetches and decrypts data
    queryFn: async () => {
      // 1. Fetch encrypted secrets from API
      const response = await apiClient.get<Secret[]>(
        `/projects/${projectId}/secrets`
      );

      // 2. Get master key for decryption
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available. Please unlock your vault.');
      }

      // 3. Decrypt all secrets in parallel
      const decryptedSecrets = await Promise.all(
        response.data.map(async (secret) => ({
          ...secret,
          decrypted_value: await decrypt(secret.encrypted_value, masterKey),
        }))
      );

      return decryptedSecrets;
    },

    // Per-resource options (override defaults)
    staleTime: 2 * 60 * 1000, // Secrets: 2 minutes
    gcTime: 5 * 60 * 1000,    // 5 minutes

    // Only run query if projectId is provided
    enabled: !!projectId,
  });
}

/**
 * Fetch a single secret by ID
 *
 * @param secretId - Secret ID
 * @returns Query result with decrypted secret
 */
export function useSecret(
  secretId: string
): UseQueryResult<Secret, Error> {
  return useQuery({
    queryKey: ['secrets', secretId],
    queryFn: async () => {
      const response = await apiClient.get<Secret>(`/secrets/${secretId}`);
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      return {
        ...response.data,
        decrypted_value: await decrypt(response.data.encrypted_value, masterKey),
      };
    },
    enabled: !!secretId,
  });
}

/**
 * Fetch all projects for the current user
 *
 * @returns Query result with projects list
 */
export function useProjects(): UseQueryResult<Project[], Error> {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await apiClient.get<Project[]>('/projects');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // Projects: 10 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes
  });
}
```

**Query Key Conventions:**

```typescript
// Query keys follow a hierarchical structure
// Format: [resource, id?, filter?, page?]

// Examples:
['secrets']                        // All secrets (no filter)
['secrets', projectId]             // Secrets for a project
['secrets', projectId, 'production'] // Secrets filtered by environment
['secrets', secretId]              // Single secret by ID
['projects']                       // All projects
['projects', projectId]            // Single project
['organizations', orgId]           // Single organization
['organizations', orgId, 'members'] // Organization members
```

**Why this structure?**
- Hierarchical keys enable partial cache invalidation
- Example: Invalidate `['secrets', projectId]` invalidates all secrets for that project
- Consistent structure makes debugging easier

---

### Component: Mutation Hook Pattern

**Purpose:** Standardized pattern for creating mutation hooks.

**Pattern:**

```typescript
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { encrypt } from '../crypto/encryption';
import { getMasterKey } from '../crypto/keyStorage';

/**
 * Create a new secret
 *
 * @returns Mutation function and state
 */
export function useCreateSecret(): UseMutationResult<
  Secret,
  Error,
  CreateSecretInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSecretInput) => {
      // 1. Get master key
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      // 2. Encrypt the secret value
      const encryptedValue = await encrypt(input.value, masterKey);

      // 3. Send to API (without plaintext value)
      const response = await apiClient.post<Secret>('/secrets', {
        name: input.name,
        encrypted_value: encryptedValue,
        service_name: input.service_name,
        project_id: input.project_id,
        environment: input.environment,
        tags: input.tags,
      });

      return response.data;
    },

    // Optimistic update: Add secret to cache immediately
    onMutate: async (newSecret) => {
      // Cancel outgoing refetches (so they don't overwrite optimistic update)
      await queryClient.cancelQueries({
        queryKey: ['secrets', newSecret.project_id],
      });

      // Snapshot previous value (for rollback)
      const previousSecrets = queryClient.getQueryData<Secret[]>([
        'secrets',
        newSecret.project_id,
      ]);

      // Optimistically update cache
      queryClient.setQueryData<Secret[]>(
        ['secrets', newSecret.project_id],
        (old = []) => [
          ...old,
          {
            id: 'temp-' + Date.now(), // Temporary ID
            name: newSecret.name,
            encrypted_value: '', // Will be filled by API response
            decrypted_value: newSecret.value, // Show plaintext in UI
            service_name: newSecret.service_name,
            project_id: newSecret.project_id,
            environment: newSecret.environment,
            tags: newSecret.tags,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      );

      // Return context for rollback
      return { previousSecrets };
    },

    // Rollback on error
    onError: (err, newSecret, context) => {
      // Restore previous cache state
      if (context?.previousSecrets) {
        queryClient.setQueryData(
          ['secrets', newSecret.project_id],
          context.previousSecrets
        );
      }
    },

    // Refetch after success (to get real ID and server timestamp)
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['secrets', variables.project_id],
      });
    },
  });
}

/**
 * Update an existing secret
 */
export function useUpdateSecret(): UseMutationResult<
  Secret,
  Error,
  UpdateSecretInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSecretInput) => {
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      // Encrypt new value if provided
      const encryptedValue = input.value
        ? await encrypt(input.value, masterKey)
        : undefined;

      const response = await apiClient.put<Secret>(`/secrets/${input.id}`, {
        name: input.name,
        encrypted_value: encryptedValue,
        service_name: input.service_name,
        environment: input.environment,
        tags: input.tags,
      });

      return response.data;
    },

    onSuccess: (data) => {
      // Invalidate both list and individual secret queries
      queryClient.invalidateQueries({ queryKey: ['secrets', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['secrets', data.id] });
    },
  });
}

/**
 * Delete a secret
 */
export function useDeleteSecret(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (secretId: string) => {
      await apiClient.delete(`/secrets/${secretId}`);
    },

    onSuccess: () => {
      // Invalidate all secrets queries (we don't know which project)
      queryClient.invalidateQueries({ queryKey: ['secrets'] });
    },
  });
}
```

---

### Component: Provider Setup

**Purpose:** Provide React Query to the application.

**File:** `app/layout.tsx` (Next.js root layout)

```typescript
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/react-query/queryClient';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          {/* DevTools: Only in development */}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

---

## Data Flow

### Flow 1: Fetch and Decrypt Secrets

**Trigger:** Component calls `useSecrets(projectId)`

**Steps:**

1. **React Query checks cache**
   - Query key: `['secrets', projectId]`
   - If data is fresh (< 2 min old), return from cache immediately
   - If stale, return cached data and refetch in background
   - If no cache, show loading state and fetch

2. **Query function executes**
   ```typescript
   const response = await apiClient.get(`/projects/${projectId}/secrets`);
   // Returns: Array of secrets with encrypted_value
   ```

3. **Get master key**
   ```typescript
   const masterKey = await getMasterKey();
   // Returns: CryptoKey from memory or throws error if locked
   ```

4. **Decrypt all secrets in parallel**
   ```typescript
   const decryptedSecrets = await Promise.all(
     response.data.map(async (secret) => ({
       ...secret,
       decrypted_value: await decrypt(secret.encrypted_value, masterKey),
     }))
   );
   ```

5. **Update cache and return data**
   - React Query caches decrypted secrets
   - Component receives `{ data, isLoading: false, error: null }`
   - UI renders decrypted secret values

**Sequence Diagram:**

```
Component    ReactQuery   API Client   Encryption   Supabase
    |            |            |            |            |
    |--useSecrets(projectId)->|            |            |
    |            |            |            |            |
    |            |--check cache            |            |
    |            |  (stale?)  |            |            |
    |            |            |            |            |
    |            |--------GET /secrets---->|            |
    |            |            |------------|------query->
    |            |            |            |<--encrypted-|
    |            |            |<--encrypted|            |
    |            |            |            |            |
    |            |------decrypt(secrets)-->|            |
    |            |            |<--plaintext|            |
    |            |--cache-----|            |            |
    |            |            |            |            |
    |<--data-----|            |            |            |
    |            |            |            |            |
```

**Data Transformations:**
- **Point A (API response):** Encrypted secrets (`{ encrypted_value: "base64..." }`)
- **Point B (Post-decryption):** Decrypted secrets (`{ encrypted_value: "base64...", decrypted_value: "plaintext" }`)
- **Point C (Cache):** Decrypted secrets stored in React Query cache (memory only)
- **Point D (Component):** Component receives decrypted secrets and renders

**Important Security Note:** Decrypted secrets are stored in React Query cache (memory only, not persisted). This is acceptable because:
- Cache is cleared on page refresh
- Master key required to decrypt on page load
- No persistence to localStorage/IndexedDB

---

### Flow 2: Create Secret with Optimistic Update

**Trigger:** User submits "Create Secret" form, component calls `createSecret.mutate(formData)`

**Steps:**

1. **Optimistic update executes (onMutate)**
   ```typescript
   // Cancel ongoing refetches
   await queryClient.cancelQueries(['secrets', projectId]);

   // Snapshot current cache
   const previousSecrets = queryClient.getQueryData(['secrets', projectId]);

   // Add secret to cache immediately (with temp ID)
   queryClient.setQueryData(['secrets', projectId], (old) => [
     ...old,
     { id: 'temp-123', name: 'Stripe API Key', decrypted_value: 'sk_test_...' }
   ]);
   ```

2. **UI updates instantly**
   - Secret appears in list immediately
   - No loading spinner (optimistic)

3. **Encrypt secret value**
   ```typescript
   const masterKey = await getMasterKey();
   const encryptedValue = await encrypt(formData.value, masterKey);
   ```

4. **Send mutation to API**
   ```typescript
   const response = await apiClient.post('/secrets', {
     name: formData.name,
     encrypted_value: encryptedValue,
     project_id: formData.project_id,
     // ...other fields
   });
   ```

5. **On success: Invalidate cache and refetch**
   ```typescript
   queryClient.invalidateQueries(['secrets', projectId]);
   // Triggers refetch, replaces temp ID with real ID
   ```

6. **On error: Rollback optimistic update**
   ```typescript
   queryClient.setQueryData(['secrets', projectId], previousSecrets);
   // UI reverts to previous state, error toast shown
   ```

**Sequence Diagram:**

```
User    Component   ReactQuery   Encryption   API     Cache
 |          |           |            |          |       |
 |--submit->|           |            |          |       |
 |          |--mutate-->|            |          |       |
 |          |           |            |          |       |
 |          |           |--onMutate (optimistic)|       |
 |          |           |---------------------->|--add->|
 |          |<--update--|            |          |       |
 |          |           |            |          |       |
 |          |           |--encrypt-->|          |       |
 |          |           |<--encrypted|          |       |
 |          |           |                       |       |
 |          |           |----------POST-------->|       |
 |          |           |                       |       |
 |          |           |<------success---------|       |
 |          |           |                       |       |
 |          |           |--invalidate---------->|--clear|
 |          |           |--refetch------------->|       |
 |          |           |<------new data--------|       |
 |          |<--updated-|                       |       |
```

---

## API Contracts

### Internal APIs

**API: useQuery Hook Interface**

**Purpose:** Standardized interface for all query hooks.

**Interface:**
```typescript
interface UseQueryOptions<TData, TError> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  retry?: number | boolean;
  retryDelay?: number | ((attemptIndex: number) => number);
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchOnMount?: boolean;
}

interface UseQueryResult<TData, TError> {
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<UseQueryResult<TData, TError>>;
}
```

**Usage:**
```typescript
const { data, isLoading, error } = useSecrets(projectId);

if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
return <SecretsList secrets={data} />;
```

---

**API: useMutation Hook Interface**

**Purpose:** Standardized interface for all mutation hooks.

**Interface:**
```typescript
interface UseMutationOptions<TData, TError, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onError?: (error: TError, variables: TVariables, context: TContext) => void;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext
  ) => void;
}

interface UseMutationResult<TData, TError, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}
```

**Usage:**
```typescript
const createSecret = useCreateSecret();

const handleSubmit = (formData) => {
  createSecret.mutate(formData, {
    onSuccess: () => {
      toast.success('Secret created successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(`Failed to create secret: ${error.message}`);
    },
  });
};
```

---

## Security Architecture

### Trust Boundaries

**Boundary 1: React Query Cache ↔ Component Memory**
- **Threats:** Decrypted secrets in cache could be accessed by malicious code
- **Controls:**
  - Cache is in-memory only (not persisted)
  - Cache cleared on page refresh
  - Master key required to decrypt on page load
  - React's memory isolation (no cross-component access)

**Boundary 2: Query Function ↔ API Client**
- **Threats:** Plaintext secrets transmitted to API
- **Controls:**
  - Secrets encrypted before API call (in mutation functions)
  - API only receives encrypted values
  - Decryption happens after API response (in query functions)

### Data Security

**Data at Rest (Cache):**
- **Decrypted secrets:** Stored in React Query cache (memory only)
- **Encrypted secrets:** Also available in cache for re-encryption if needed
- **Access control:** React Query cache is sandboxed per-tab (browser security model)

**Data in Transit:**
- All API calls over HTTPS
- JWT token in Authorization header
- Secrets transmitted encrypted (double encryption: client-side + TLS)

**Data in Use:**
- Decrypted secrets in component state (React)
- Cleared when component unmounts
- Master key required to decrypt

### Threat Model

**Threat 1: XSS Attack Steals Decrypted Secrets from Cache**
- **Description:** Attacker injects malicious JavaScript that reads React Query cache
- **Likelihood:** Medium (common web attack)
- **Impact:** Critical (all decrypted secrets exposed)
- **Mitigation:**
  - Strict CSP (no inline scripts)
  - React escapes all JSX
  - Sanitize user input
  - Regular security audits
  - Cache is in-memory only (not persisted)

**Threat 2: Browser Memory Dump**
- **Description:** Attacker dumps browser memory to read decrypted secrets
- **Likelihood:** Low (requires device access)
- **Impact:** Critical (all decrypted secrets exposed)
- **Mitigation:**
  - Auto-lock after inactivity (clear cache and master key)
  - User must re-enter master password to unlock
  - Limit decrypted secret lifetime in cache

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Query execution: < 100ms (if cached)
- API fetch + decrypt: < 500ms (network latency + decryption)
- Optimistic update: < 10ms (instant UI feedback)

**Throughput:**
- Handle 100+ queries simultaneously without blocking UI
- Decrypt 100 secrets in < 500ms

**Resource Usage:**
- Memory: < 50MB for query cache (typical usage)
- CPU: < 5% average (spikes during decryption)

### Performance Optimization

**Optimizations implemented:**
- **Request deduplication:** Multiple components requesting same data trigger only one API call
- **Parallel decryption:** `Promise.all()` decrypts all secrets simultaneously
- **Stale-while-revalidate:** Return cached data immediately, refetch in background
- **Query key hierarchy:** Efficient cache invalidation (invalidate project invalidates all secrets in that project)
- **Optimistic updates:** Instant UI feedback, no waiting for API

**Caching Strategy:**
- Secrets: 2 min stale time, 5 min cache time (sensitive data)
- Projects: 10 min stale time, 30 min cache time (changes infrequently)
- User profile: 15 min stale time, 1 hour cache time (rarely changes)

---

## Scalability

### Horizontal Scaling

Not applicable (client-side library, no server-side scaling).

### Vertical Scaling

**Cache size limits:**
- React Query cache grows with number of queries
- Garbage collection removes stale queries after `gcTime`
- Typical usage: 50MB cache (100 secrets, 10 projects, 5 organizations)
- Maximum: 200MB cache before performance degradation

**Mitigation:**
- Aggressive `gcTime` for infrequently accessed data
- Manual cache clearing for large lists: `queryClient.removeQueries(['secrets'])`

### Bottlenecks

**Current bottlenecks:**
- **Decryption overhead:** Decrypting 100+ secrets takes 500ms
- **Large query results:** Fetching 1000+ secrets causes memory pressure

**Mitigation strategies:**
- Pagination for large lists (fetch 20 secrets at a time)
- Virtual scrolling for long lists
- Web Workers for decryption (offload to background thread) - Post-MVP

---

## Failure Modes

### Failure Mode 1: API Call Fails

**Scenario:** Network error or backend unavailable.

**Impact:** Query returns error state, component shows error UI.

**Detection:** `error` property is non-null in query result.

**Recovery:**
1. React Query automatically retries (3 attempts with exponential backoff)
2. If all retries fail, show error message to user
3. Provide "Retry" button to manually refetch

**Prevention:**
- Cloudflare edge reduces network failures
- Graceful degradation: Show cached data if available

---

### Failure Mode 2: Master Key Not Available

**Scenario:** User's master key is locked or cleared from memory.

**Impact:** Decryption fails, query throws error.

**Detection:** `getMasterKey()` returns null or throws error.

**Recovery:**
1. Catch error in query function
2. Redirect user to "Unlock Vault" prompt
3. After unlock, retry query

**Prevention:**
- Check `masterKeyReady` before attempting to fetch secrets
- Show "Unlock Vault" button proactively

---

### Failure Mode 3: Optimistic Update Rollback

**Scenario:** Mutation fails after optimistic update.

**Impact:** UI briefly shows optimistic state, then reverts.

**Detection:** `onError` callback triggered.

**Recovery:**
1. Restore previous cache state (from `onMutate` context)
2. Show error toast to user
3. UI reverts to previous state

**Prevention:**
- Validate input before mutation
- Show loading indicator during mutation (optional)

---

## Alternatives Considered

### Alternative 1: SWR

**Description:** Use Vercel's SWR library instead of React Query.

**Pros:**
- Lighter bundle size (~10KB vs ~40KB)
- Simpler API
- Built by Next.js team (good integration)

**Cons:**
- Less feature-complete than React Query
- No built-in optimistic updates
- Less flexible caching strategies
- Smaller ecosystem

**Why not chosen:** React Query provides more features (optimistic updates, better TypeScript support, devtools) for only marginally larger bundle size.

---

### Alternative 2: Apollo Client

**Description:** Use Apollo Client for state management.

**Pros:**
- Comprehensive GraphQL client
- Normalized cache
- Excellent devtools

**Cons:**
- Designed for GraphQL (we use REST)
- Much larger bundle size (~100KB)
- Overkill for our needs
- Steeper learning curve

**Why not chosen:** We use REST APIs, not GraphQL. Apollo Client is overkill and too heavy.

---

### Alternative 3: Redux Toolkit Query (RTK Query)

**Description:** Use Redux Toolkit's built-in query solution.

**Pros:**
- Integrated with Redux
- Type-safe
- Good caching

**Cons:**
- Requires Redux (we use Zustand for client state)
- More boilerplate than React Query
- Less flexible caching

**Why not chosen:** We're not using Redux. React Query is more focused and flexible.

---

## Decision Log

### Decision 1: React Query v5 over v4

**Date:** 2025-10-30

**Context:** React Query v5 released with breaking changes and new features.

**Options:**
1. React Query v4 (stable, well-documented)
2. React Query v5 (latest, new features)

**Decision:** Use React Query v5.

**Rationale:**
- Renamed `cacheTime` to `gcTime` (clearer naming)
- Better TypeScript support
- Improved devtools
- Future-proof

**Consequences:**
- Must use updated API (breaking changes from v4)
- Some third-party docs reference v4

---

### Decision 2: Decrypt in Query Function vs. After Cache

**Date:** 2025-10-30

**Context:** Should we decrypt secrets in the query function (before caching) or after retrieving from cache?

**Options:**
1. Decrypt in query function (before cache)
2. Store encrypted in cache, decrypt when accessed

**Decision:** Decrypt in query function, store decrypted in cache.

**Rationale:**
- Simpler: Components receive ready-to-use data
- Performance: Decrypt once, use many times
- Cache is memory-only (cleared on refresh), acceptable security trade-off

**Consequences:**
- Decrypted secrets in cache (memory only)
- Must re-decrypt on page refresh

---

### Decision 3: Optimistic Updates for Mutations

**Date:** 2025-10-30

**Context:** Should mutations update the UI optimistically or wait for API response?

**Options:**
1. Optimistic updates (instant UI feedback, rollback on error)
2. Wait for API response (slower, but guaranteed correct)

**Decision:** Use optimistic updates for create/update/delete mutations.

**Rationale:**
- Better UX (instant feedback)
- Rollback logic is manageable
- Modern best practice

**Consequences:**
- Must implement rollback logic
- UI briefly shows optimistic state if API fails

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `TECH-STACK.md` - Technology stack decisions
- [x] `07-frontend/frontend-architecture.md` - Overall frontend architecture
- [x] `05-api/api-rest-design.md` - REST API specification

**External Services:**
- Cloudflare Workers (API gateway)
- Supabase (database and API)

### Architecture Dependencies

**Depends on these components:**
- API Client Layer (`lib/api/client.ts`) - For making API calls
- Encryption Layer (`lib/crypto/`) - For encrypting/decrypting secrets
- Authentication Store (`lib/stores/authStore.ts`) - For JWT token access

**Required by these components:**
- All React components that fetch data
- All features that interact with the API

---

## References

### Internal Documentation
- `07-frontend/frontend-architecture.md` - Overall frontend architecture
- `07-frontend/client-encryption/webcrypto-implementation.md` - Encryption details
- `03-security/security-model.md` - Zero-knowledge architecture
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [TanStack Query (React Query) Docs](https://tanstack.com/query/latest) - Official documentation
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query) - Community best practices
- [Optimistic Updates Guide](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates) - Optimistic update patterns
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools) - Debugging guide

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial React Query setup documentation |

---

## Notes

### Future Enhancements
- **Web Workers for decryption** - Offload decryption to background thread to avoid blocking UI
- **Persistent cache** - Optional IndexedDB persistence for offline read access
- **GraphQL support** - If we migrate to GraphQL in the future
- **Query prefetching** - Prefetch data on hover for instant navigation

### Known Issues
- **Large decryption overhead** - Decrypting 100+ secrets takes 500ms (mitigate with pagination)
- **Cache memory usage** - Cache can grow large with many queries (mitigate with aggressive `gcTime`)

### Next Review Date
2025-11-30 (review after initial implementation and performance testing)
