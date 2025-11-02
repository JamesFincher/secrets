---
Document: Search Functionality
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 05-api/endpoints/secrets-endpoints.md, 04-database/schemas/secrets-metadata.md, 07-frontend/frontend-architecture.md, TECH-STACK.md
---

# Search Functionality

## Overview

The search functionality enables users to quickly find secrets across projects and environments using full-text search, filters, and advanced search operators. Search operates on unencrypted metadata (secret names, service names, tags, descriptions) while respecting zero-knowledge encryption guarantees—secret values remain encrypted and unsearchable by the server. This document covers search UI components, backend query optimization, filtering strategies, and performance considerations.

**Key Features:** Full-text search across metadata, multi-faceted filtering (environment, service, tags), fuzzy matching, search history, keyboard-driven interface, and real-time search suggestions.

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [User Experience](#user-experience)
4. [Technical Implementation](#technical-implementation)
5. [Search Capabilities](#search-capabilities)
6. [API Integration](#api-integration)
7. [Performance & Optimization](#performance--optimization)
8. [Security Considerations](#security-considerations)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Future Enhancements](#future-enhancements)
11. [Dependencies](#dependencies)
12. [References](#references)
13. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Users managing dozens or hundreds of secrets across multiple projects and environments need efficient ways to locate specific secrets. Traditional list scrolling becomes impractical at scale, and manual filtering is time-consuming. Users need instant, accurate search results without compromising zero-knowledge security.

**Pain points:**
- Finding a specific secret among 100+ secrets requires excessive scrolling
- No quick way to filter by multiple criteria simultaneously (e.g., "production Stripe keys")
- Users forget exact secret names or service names
- No search history or suggestions to speed up repeated searches
- Filtering UI requires multiple clicks instead of keyboard-driven search

**User needs:**
- **The Learner:** Simple search bar that "just works" without complex operators
- **The Solo Developer:** Quick keyboard shortcuts to find secrets by name or service
- **The Development Team:** Filter by environment and tags to find team-shared secrets
- **The Enterprise:** Advanced search with audit trail and search analytics

### Background

**Existing patterns:**
- `05-api/endpoints/secrets-endpoints.md` defines the List Secrets endpoint with `search` and filter query parameters
- `04-database/schemas/secrets-metadata.md` includes GIN indexes on tags and full-text search columns
- `07-frontend/frontend-architecture.md` describes React Query for caching search results

**Previous decisions:**
- Search operates on metadata only (secret values never searchable)
- Backend uses PostgreSQL full-text search with GIN indexes
- Frontend implements debounced search to reduce API calls

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Fast search results** - Return results in < 200ms p95 for typical queries (success metric: 95% of searches return < 200ms)
2. **Intuitive search UX** - Users find secrets without reading documentation (success metric: 90% of users succeed in first search attempt)
3. **Zero-knowledge compliance** - Search never exposes encrypted secret values (success metric: 0 plaintext secrets in search index)
4. **Keyboard-first interface** - Power users can search without touching mouse (success metric: All search actions have keyboard shortcuts)

**Secondary goals:**
- Search history for repeated queries
- Search suggestions based on recent searches
- Export search results
- Search analytics for administrators

### Non-Goals

**Explicitly out of scope:**
- **Searching encrypted secret values** - Violates zero-knowledge architecture (post-MVP: client-side search on decrypted values in memory)
- **Natural language search** - AI-powered queries like "find my Stripe key" (post-MVP: integrate with AI Assistant)
- **Fuzzy secret value matching** - Cannot match approximate secret values (security risk)
- **Cross-organization search** - Enterprise feature for future consideration

### Success Metrics

**How we measure success:**
- **Search Speed**: 95% of searches return results in < 200ms
- **Search Accuracy**: Users find target secret in top 3 results 80% of the time
- **Adoption**: 60% of users use search feature within first session
- **Efficiency**: Average time to find secret reduced from 30s (scrolling) to < 5s (search)

---

## User Experience

### User Flows

**Flow 1: Quick Search by Name**

**Persona:** The Solo Developer
**Goal:** Find "OPENAI_API_KEY" secret quickly

**Steps:**
1. User presses `/` keyboard shortcut (opens search)
2. Types "openai" in search box
3. Sees instant results as they type (debounced)
4. Presses Enter or clicks result to view secret
5. Secret card opens with encrypted value ready to decrypt/copy

**Expected outcome:** User finds secret in < 5 seconds without leaving keyboard.

---

**Flow 2: Filter by Environment and Service**

**Persona:** The Development Team
**Goal:** Find all production Stripe secrets

**Steps:**
1. User opens search (`/` keyboard shortcut)
2. Types "stripe" in search box
3. Clicks "Filters" button (or presses `Ctrl+F`)
4. Selects "production" from environment filter
5. Selects "Stripe" from service filter
6. Sees filtered results: only production Stripe secrets
7. Can export results or copy multiple secrets

**Expected outcome:** User sees exactly the subset of secrets they need without scrolling through unrelated secrets.

---

**Flow 3: Search with Tags**

**Persona:** The Enterprise
**Goal:** Find all "critical" and "payment" tagged secrets

**Steps:**
1. User opens search
2. Types "tag:critical tag:payment" (advanced search operator)
3. Sees all secrets with both tags
4. Alternatively: Uses tag filter UI (clicks "Tags" dropdown, selects multiple tags)
5. Results update in real-time as tags are selected

**Expected outcome:** User finds all critical payment secrets across all projects and environments.

---

### UI Components

**Component 1: Search Bar**

**Location:** Top-right of header on all authenticated pages

**Appearance:**
```
┌──────────────────────────────────────────────┐
│  🔍 Search secrets...               Ctrl+K  │
└──────────────────────────────────────────────┘
```

**Behavior:**
- Always visible on dashboard and project pages
- Clicking opens search modal with full filters
- Typing immediately starts search (debounced 300ms)
- Shows loading spinner while searching
- Displays result count: "42 results for 'stripe'"

**Keyboard shortcuts:**
- `/` or `Ctrl+K` (Windows/Linux) / `Cmd+K` (Mac) - Open search
- `Esc` - Close search modal
- `↑/↓` arrows - Navigate results
- `Enter` - Select highlighted result
- `Ctrl+F` - Open filters panel

---

**Component 2: Search Modal**

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Search Secrets                                      ✕  │
├─────────────────────────────────────────────────────────┤
│  🔍 [Search query...]                   🎚️ Filters (3) │
├─────────────────────────────────────────────────────────┤
│  Filters:                                                │
│  ☑ Production  ☑ Stripe  ☑ critical                     │
│  📋 42 results                                           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⚡ STRIPE_SECRET_KEY                  Stripe     │   │
│  │ Production • Updated 2 hours ago                 │   │
│  │ Tags: payment, critical                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⚡ STRIPE_WEBHOOK_SECRET              Stripe     │   │
│  │ Production • Updated 1 day ago                   │   │
│  │ Tags: payment, webhook                           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  Load more...                                            │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Full-screen modal with dimmed background
- Real-time search as user types
- Filter pills show active filters (click to remove)
- Result cards show: secret name, service icon, environment, last updated, tags
- Infinite scroll or pagination for large result sets
- Export button to download filtered results

---

**Component 3: Filter Panel**

**Location:** Right side of search modal (collapsible)

**Filters available:**
```
Filters
───────
Environment
☐ Development (24)
☑ Staging (18)
☑ Production (42)

Service
☐ OpenAI (8)
☑ Stripe (12)
☐ AWS (15)
☐ Other (7)

Tags
☐ api-key (20)
☑ critical (15)
☑ payment (8)

Date Created
○ Any time
○ Last 7 days
○ Last 30 days
● Custom range

[Clear All]  [Apply]
```

**Behavior:**
- Filters update results in real-time (no "Apply" button for simple filters)
- Filter counts show number of secrets matching each filter
- Selected filters appear as pills above results
- Filters persist during session (reset on page refresh)

---

**Component 4: Search Suggestions**

**Appearance:** Dropdown below search bar showing recent/popular searches

```
┌──────────────────────────────────────────┐
│  Recent Searches                         │
│  🕐 openai production                    │
│  🕐 stripe webhook                       │
│  🕐 tag:critical                         │
│                                          │
│  Suggested                               │
│  💡 production secrets                   │
│  💡 recently updated                     │
└──────────────────────────────────────────┘
```

**Behavior:**
- Shows when search box is focused but empty
- Recent searches stored in localStorage (max 10)
- Suggested searches based on common patterns
- Click suggestion to populate search box

---

## Technical Implementation

### Frontend Architecture

**Technology Stack:**
- **React 18.3.x** - UI components
- **React Query 5.x** - Search result caching and request deduplication
- **Zustand** - Search UI state (modal open/closed, active filters)
- **Debounce** - 300ms delay before sending search API call
- **Fuse.js** (optional) - Client-side fuzzy search on cached results

**Component Structure:**

```typescript
// components/search/SearchModal.tsx
import { useState, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useSearchSecrets } from '@/lib/api/search';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    environments: [],
    services: [],
    tags: [],
  });

  // Debounce search query (300ms delay)
  const debouncedQuery = useDebounce(query, 300);

  // Fetch search results with React Query
  const { data, isLoading, error } = useSearchSecrets({
    query: debouncedQuery,
    filters,
  });

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <SearchBar
          value={query}
          onChange={handleQueryChange}
          onFilterClick={() => {/* toggle filter panel */}}
        />

        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
        />

        <SearchResults
          results={data?.results || []}
          isLoading={isLoading}
          error={error}
          onResultClick={(secret) => {
            // Navigate to secret detail or open decrypt modal
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
```

**Custom Hooks:**

```typescript
// lib/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

```typescript
// lib/api/search.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

interface SearchFilters {
  environments?: string[];
  services?: string[];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

interface SearchParams {
  query: string;
  filters?: SearchFilters;
  page?: number;
  per_page?: number;
}

interface SearchResult {
  id: string;
  key_name: string;
  service_name: string | null;
  description: string | null;
  tags: string[];
  environment_id: string;
  environment_name: string;
  project_id: string;
  project_name: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export function useSearchSecrets(params: SearchParams) {
  return useQuery({
    queryKey: ['search', params.query, params.filters, params.page],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      // Add search query
      if (params.query) {
        queryParams.set('search', params.query);
      }

      // Add filters
      if (params.filters?.environments?.length) {
        queryParams.set('environments', params.filters.environments.join(','));
      }
      if (params.filters?.services?.length) {
        queryParams.set('services', params.filters.services.join(','));
      }
      if (params.filters?.tags?.length) {
        queryParams.set('tags', params.filters.tags.join(','));
      }

      // Pagination
      queryParams.set('page', String(params.page || 1));
      queryParams.set('per_page', String(params.per_page || 20));

      const response = await apiClient.get<SearchResponse>(
        `/search/secrets?${queryParams.toString()}`
      );

      return response.data;
    },
    enabled: params.query.length >= 2, // Only search if query >= 2 chars
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,     // 5 minutes (formerly cacheTime)
  });
}
```

---

### Backend Implementation

**Database Schema:**

Search relies on indexes defined in `04-database/schemas/secrets-metadata.md`:

```sql
-- Full-text search index on key_name and description
CREATE INDEX idx_secrets_fulltext ON secrets_metadata
USING GIN (to_tsvector('english', key_name || ' ' || COALESCE(description, '')));

-- GIN index on tags array for fast tag filtering
CREATE INDEX idx_secrets_tags ON secrets_metadata USING GIN (tags);

-- Composite index for environment + service filtering
CREATE INDEX idx_secrets_env_service ON secrets_metadata (environment_id, service_name);

-- Index for sorting by updated_at
CREATE INDEX idx_secrets_updated ON secrets_metadata (updated_at DESC);
```

**API Endpoint:**

See `05-api/endpoints/secrets-endpoints.md` for the List Secrets endpoint:

```
GET /projects/:project_id/secrets?search={query}&environment_id={env}&tags={tags}&sort={field}:{order}
```

**Search Query Parameters:**
- `search` - Full-text search on `key_name`, `service_name`, `description`
- `environment_id` - Filter by specific environment
- `service_name` - Filter by service
- `tags` - Comma-separated tags (AND logic)
- `sort` - Sort field and order (e.g., `updated_at:desc`)
- `page` - Page number (pagination)
- `per_page` - Results per page (default 20, max 100)

**Backend Query (PostgreSQL):**

```sql
SELECT
  s.id,
  s.key_name,
  s.service_name,
  s.description,
  s.tags,
  s.environment_id,
  e.name AS environment_name,
  s.project_id,
  p.name AS project_name,
  s.created_at,
  s.updated_at,
  s.last_accessed_at
FROM secrets_metadata s
JOIN environments e ON s.environment_id = e.id
JOIN projects p ON s.project_id = p.id
WHERE
  s.project_id = $1  -- User's project filter
  AND (
    -- Full-text search
    to_tsvector('english', s.key_name || ' ' || COALESCE(s.description, ''))
    @@ plainto_tsquery('english', $2)
    OR s.service_name ILIKE '%' || $2 || '%'
  )
  -- Environment filter (optional)
  AND ($3::uuid IS NULL OR s.environment_id = $3)
  -- Service filter (optional)
  AND ($4::text IS NULL OR s.service_name = $4)
  -- Tags filter (optional, AND logic)
  AND ($5::text[] IS NULL OR s.tags @> $5)
ORDER BY
  -- Relevance ranking
  ts_rank(
    to_tsvector('english', s.key_name || ' ' || COALESCE(s.description, '')),
    plainto_tsquery('english', $2)
  ) DESC,
  s.updated_at DESC
LIMIT $6 OFFSET $7;
```

**Performance Considerations:**
- Full-text search uses GIN index (fast)
- Tag filtering uses GIN index on array (fast)
- Composite index on `(environment_id, service_name)` for common filters
- Query planner uses indexes efficiently with proper WHERE clause ordering
- Pagination limits result set size

---

## Search Capabilities

### Basic Search

**Text Search:**
- Searches across `key_name`, `service_name`, `description` fields
- Case-insensitive matching
- Partial word matching (e.g., "stripe" matches "STRIPE_SECRET_KEY")
- Stemming enabled (e.g., "payment" matches "payments")

**Example queries:**
- `"openai"` → Finds all secrets with "openai" in name, service, or description
- `"api key"` → Finds secrets containing both "api" and "key"
- `"STRIPE_"` → Finds all Stripe-related secrets

---

### Advanced Search Operators

**Tag Search:**
```
tag:critical
tag:production
tag:api-key
```

**Environment Search:**
```
env:production
env:staging
environment:development
```

**Service Search:**
```
service:stripe
service:"open ai"  (quotes for multi-word)
```

**Date Filters:**
```
created:>2025-10-01
updated:<2025-10-30
created:2025-10-01..2025-10-31  (range)
```

**Combined Queries:**
```
stripe tag:production env:production
service:openai tag:critical tag:api-key
```

**Negation:**
```
-tag:deprecated  (exclude deprecated secrets)
-service:aws     (exclude AWS secrets)
```

**Example:**
```
stripe tag:production -tag:deprecated
```
Finds: Stripe secrets tagged "production" but NOT tagged "deprecated"

---

### Fuzzy Search (Client-Side)

For cached results, implement client-side fuzzy search using **Fuse.js**:

```typescript
// lib/search/fuzzy.ts
import Fuse from 'fuse.js';

interface Secret {
  id: string;
  key_name: string;
  service_name: string;
  description: string;
  tags: string[];
}

const fuseOptions = {
  keys: ['key_name', 'service_name', 'description', 'tags'],
  threshold: 0.3,  // 0 = exact match, 1 = match anything
  includeScore: true,
};

export function fuzzySearchSecrets(secrets: Secret[], query: string): Secret[] {
  const fuse = new Fuse(secrets, fuseOptions);
  const results = fuse.search(query);
  return results.map((result) => result.item);
}
```

**When to use:**
- User is searching within cached results (no API call needed)
- Typos in search query (e.g., "stirpe" → "stripe")
- Approximate matching for better UX

---

## API Integration

### Search Endpoint

**Endpoint:** `GET /search/secrets`

**Query Parameters:**
```typescript
interface SearchQueryParams {
  query?: string;           // Search query (min 2 chars)
  project_id?: string;      // Filter by project (UUID)
  environment_id?: string;  // Filter by environment (UUID)
  service_name?: string;    // Filter by service
  tags?: string;            // Comma-separated tags (AND logic)
  created_after?: string;   // ISO 8601 date
  created_before?: string;  // ISO 8601 date
  updated_after?: string;   // ISO 8601 date
  updated_before?: string;  // ISO 8601 date
  sort?: string;            // Sort field:order (e.g., "updated_at:desc")
  page?: number;            // Page number (default 1)
  per_page?: number;        // Results per page (default 20, max 100)
}
```

**Success Response (200 OK):**
```json
{
  "results": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "key_name": "STRIPE_SECRET_KEY",
      "service_name": "Stripe",
      "description": "Production Stripe API key",
      "tags": ["production", "payment", "critical"],
      "environment_id": "660e8400-e29b-41d4-a716-446655440000",
      "environment_name": "production",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "project_name": "E-commerce Platform",
      "created_at": "2025-10-29T10:00:00Z",
      "updated_at": "2025-10-30T14:30:00Z",
      "last_accessed_at": "2025-10-30T16:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have access to specified project
- `429 Too Many Requests` - Rate limit exceeded

**Rate Limiting:**
- 100 search requests per minute per user
- Higher limit for read-only searches (no mutations)

---

### Caching Strategy

**React Query Caching:**
```typescript
// Cache configuration for search results
{
  queryKey: ['search', query, filters],
  staleTime: 2 * 60 * 1000,  // 2 minutes before considered stale
  gcTime: 5 * 60 * 1000,      // 5 minutes before garbage collected
  refetchOnWindowFocus: false, // Don't refetch on tab focus (search results unlikely to change)
}
```

**Cache Invalidation:**
- When user creates/updates/deletes a secret, invalidate search cache:
```typescript
// After secret mutation
queryClient.invalidateQueries({ queryKey: ['search'] });
```

**Browser Caching:**
- Search API responses include `Cache-Control: private, max-age=120` (2 minutes)
- Cloudflare Workers cache at edge for unauthenticated requests (public docs search)

---

## Performance & Optimization

### Database Optimization

**Indexes:**
- `GIN` index on full-text search vector (key_name + description)
- `GIN` index on tags array
- `B-tree` index on `(environment_id, service_name)` composite
- `B-tree` index on `updated_at` for sorting

**Query Optimization:**
```sql
-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM secrets_metadata
WHERE to_tsvector('english', key_name || ' ' || description)
      @@ plainto_tsquery('english', 'stripe')
  AND tags @> ARRAY['production'];

-- Expected: Index Scan using idx_secrets_fulltext
```

**Performance Targets:**
- Simple search (no filters): < 50ms p95
- Search with filters: < 100ms p95
- Complex search (multiple filters + tags): < 200ms p95

---

### Frontend Optimization

**Debouncing:**
- 300ms debounce delay before API call
- Prevents excessive API calls while user is typing
- Cancel in-flight requests when query changes

**Virtual Scrolling:**
- Use `react-virtual` for large result sets (100+ results)
- Renders only visible results (improves performance)

**Memoization:**
- Memoize search results to avoid re-renders:
```typescript
const filteredResults = useMemo(() => {
  return results.filter(/* ... */);
}, [results, filters]);
```

**Request Deduplication:**
- React Query automatically deduplicates identical search requests
- If two components search for "stripe", only one API call is made

---

### Search Index Optimization

**PostgreSQL Full-Text Search:**
- Use `ts_rank()` for relevance scoring
- Boost exact matches over partial matches:
```sql
ORDER BY
  CASE
    WHEN s.key_name ILIKE query THEN 1  -- Exact match highest priority
    WHEN s.service_name ILIKE query THEN 2
    ELSE 3
  END,
  ts_rank(...) DESC
```

**Precomputed Search Vectors (Future):**
- Store precomputed `tsvector` in dedicated column
- Update via trigger on INSERT/UPDATE
- Faster queries (no need to compute vector on each search)

---

## Security Considerations

### Zero-Knowledge Compliance

**Critical: Secret values NEVER indexed or searchable**

**What is searchable:**
- ✅ Secret name (`key_name`)
- ✅ Service name (`service_name`)
- ✅ Description
- ✅ Tags
- ✅ Environment name
- ✅ Project name
- ✅ Metadata (created_at, updated_at)

**What is NOT searchable:**
- ❌ Encrypted secret value (`encrypted_value`)
- ❌ Decrypted secret value (never reaches server)
- ❌ Master password
- ❌ Master key

**Verification:**
- Audit database to ensure `encrypted_value` column is never included in full-text search index
- Security review of all search queries to confirm no plaintext secret access

---

### Search Privacy

**User search queries:**
- Logged for analytics (optional, admin-enabled)
- Not logged by default for privacy
- If logging enabled, queries stored with user ID and timestamp
- Retention: 90 days maximum

**Search History:**
- Stored in browser localStorage (not on server)
- User can clear search history manually
- Max 10 recent searches stored

**Rate Limiting:**
- 100 searches per minute per user
- Prevents abuse and excessive database load

---

### Access Control

**Row-Level Security (RLS):**
- Search queries respect RLS policies
- Users can only search secrets in projects they have access to
- Backend enforces `project_id` filter based on JWT claims

**Example RLS Policy:**
```sql
CREATE POLICY "Users can search secrets in their projects"
ON secrets_metadata FOR SELECT
USING (
  project_id IN (
    SELECT project_id
    FROM project_members
    WHERE user_id = auth.uid()
  )
);
```

---

## Edge Cases & Error Handling

### Edge Case 1: No Results Found

**Scenario:** User searches for "nonexistent-service"

**Handling:**
- Display empty state: "No secrets found for 'nonexistent-service'"
- Suggest:
  - Check spelling
  - Try different keywords
  - Remove filters
  - Browse all secrets

**UI:**
```
No results found

Try:
• Checking your spelling
• Using different keywords
• Removing some filters

[Browse All Secrets]
```

---

### Edge Case 2: Search Query Too Short

**Scenario:** User types single character (e.g., "s")

**Handling:**
- Don't send API request (minimum 2 characters)
- Show hint: "Type at least 2 characters to search"
- Allow exact filter operators with 1 char (e.g., `tag:a`)

---

### Edge Case 3: Rate Limit Exceeded

**Scenario:** User exceeds 100 searches per minute

**Handling:**
- Display error toast: "Too many searches. Please wait 30 seconds."
- Disable search input temporarily
- Show countdown timer
- Log excessive usage for potential abuse investigation

---

### Edge Case 4: Search API Timeout

**Scenario:** Database query takes > 10 seconds (slow query)

**Handling:**
- Cancel request after 10s timeout
- Display error: "Search took too long. Try simplifying your query."
- Suggest:
  - Use more specific keywords
  - Reduce number of filters
  - Contact support if issue persists
- Log slow query for optimization analysis

---

### Error Handling

**Network Errors:**
```typescript
if (error) {
  return (
    <div className="error-state">
      <p>Search failed. Please try again.</p>
      <button onClick={() => refetch()}>Retry</button>
    </div>
  );
}
```

**Validation Errors:**
- Frontend validates query length before API call
- Backend returns 400 with validation details:
```json
{
  "error": "validation_error",
  "message": "Invalid search parameters",
  "details": {
    "query": ["must be at least 2 characters"],
    "per_page": ["must be between 1 and 100"]
  }
}
```

---

## Future Enhancements

### Phase 1 (Post-MVP)

**1. Client-Side Search on Decrypted Values**
- After secrets decrypted in memory, enable search on plaintext values
- Privacy-preserving (search happens locally)
- Implementation:
  ```typescript
  const decryptedSecrets = useDecryptedSecrets(projectId);
  const localResults = decryptedSecrets.filter((s) =>
    s.decrypted_value.includes(query)
  );
  ```

**2. Search History & Suggestions**
- Store recent searches in localStorage
- Show autocomplete suggestions
- Track popular searches (anonymized)

**3. Saved Searches**
- Allow users to save complex search queries
- Quick access to frequently used filters
- Example: "Production critical secrets", "Stripe keys"

---

### Phase 2 (Enterprise Features)

**4. Natural Language Search (AI-Powered)**
- Integrate with AI Assistant
- Example: "Find my Stripe webhook secret for production"
- AI translates to: `service:stripe tag:webhook env:production`

**5. Search Analytics Dashboard**
- Admins see most searched terms
- Identify unused secrets (never searched)
- Optimize naming conventions based on search patterns

**6. Cross-Project Search**
- Enterprise users search across all projects
- Requires explicit permission (security consideration)

---

### Phase 3 (Advanced Features)

**7. Search Export**
- Export search results to CSV, JSON, or `.env` format
- Encrypted exports with user's master key

**8. Search Filters UI Improvements**
- Date range picker with visual calendar
- Multi-select dropdown for services and tags
- Filter presets (e.g., "Recently updated", "Critical secrets")

**9. Search Performance Monitoring**
- Track search latency p95/p99
- Alert on slow queries
- Auto-optimize database indexes based on usage

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `05-api/endpoints/secrets-endpoints.md` - List Secrets endpoint with search parameter
- [x] `04-database/schemas/secrets-metadata.md` - Database schema with full-text search indexes
- [x] `07-frontend/frontend-architecture.md` - React Query caching strategy
- [x] `TECH-STACK.md` - Technology stack decisions (PostgreSQL, React Query, Zustand)

**Related Features:**
- `08-features/project-management/project-management.md` - Project context for search
- `08-features/team-collaboration/team-collaboration.md` - Shared secret search
- `08-features/ai-assistant/ai-assistant-overview.md` - Natural language search integration (future)

---

## References

### Internal Documentation
- `05-api/endpoints/secrets-endpoints.md` - Secrets API with search query parameters
- `04-database/schemas/secrets-metadata.md` - Database schema and indexes
- `07-frontend/frontend-architecture.md` - Frontend state management and API client
- `03-security/security-model.md` - Zero-knowledge encryption (no secret values in search)
- `GLOSSARY.md` - Term definitions (Secret, Environment, Project, Tags)
- `TECH-STACK.md` - PostgreSQL full-text search, React Query, Fuse.js

### External Resources
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html) - Full-text search documentation
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html) - Generalized Inverted Index for arrays and full-text
- [React Query Documentation](https://tanstack.com/query/latest) - Caching and state management
- [Fuse.js](https://fusejs.io/) - Fuzzy search library for JavaScript
- [Debouncing in React](https://www.freecodecamp.org/news/debouncing-in-react/) - Debounce implementation patterns

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial search functionality documentation |

---

## Notes

### Implementation Checklist

**Backend (Cloudflare Workers + Supabase):**
- [ ] Create `/search/secrets` API endpoint
- [ ] Implement full-text search query with PostgreSQL `to_tsvector` and `plainto_tsquery`
- [ ] Add filter support (environment, service, tags)
- [ ] Implement pagination
- [ ] Add relevance ranking with `ts_rank()`
- [ ] Verify RLS policies enforce access control
- [ ] Add rate limiting (100 req/min per user)
- [ ] Performance test with 10,000+ secrets

**Frontend (React + Next.js):**
- [ ] Create `SearchModal` component
- [ ] Implement search bar with keyboard shortcut (`/` or `Ctrl+K`)
- [ ] Add debounce hook (300ms delay)
- [ ] Integrate React Query for search API calls
- [ ] Create filter panel UI (environment, service, tags)
- [ ] Implement result cards with metadata
- [ ] Add pagination or infinite scroll
- [ ] Store search history in localStorage (max 10)
- [ ] Add empty state and error handling
- [ ] Implement keyboard navigation (arrows, Enter, Esc)

**Testing:**
- [ ] Unit tests for search query builder
- [ ] Integration tests for search API endpoint
- [ ] E2E tests for search user flows
- [ ] Performance tests for large result sets (1000+ secrets)
- [ ] Security audit: confirm no secret values in search index

---

### Known Limitations

**Current Limitations:**
- Cannot search encrypted secret values (by design for zero-knowledge)
- No fuzzy matching on backend (exact word matching only)
- No autocomplete suggestions (post-MVP feature)
- Search history not synced across devices (stored in localStorage only)
- Maximum 100 results per page (pagination required for more)

**Workarounds:**
- Client-side fuzzy search on cached results using Fuse.js
- Use descriptive secret names and tags for better searchability
- Advanced search operators for precise filtering

---

### Performance Benchmarks

**Target Performance:**
- Simple search (no filters): < 50ms p95
- Search with 1 filter: < 100ms p95
- Search with 3+ filters: < 200ms p95
- Frontend debounce: 300ms delay
- Time to first result displayed: < 500ms total

**Database Query Performance (with 10,000 secrets):**
- Full-text search: ~30ms (with GIN index)
- Tag filter: ~20ms (with GIN index)
- Environment filter: ~10ms (with B-tree index)
- Combined query: ~50ms

---

### Next Review Date
2025-11-30 (review after initial implementation and user feedback)
