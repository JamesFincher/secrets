---
Document: Integration Testing - Test Database Setup and API Integration
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Engineering Lead
Status: Draft
Dependencies: 11-development/testing/testing-strategy.md, TECH-STACK.md, 04-database/database-overview.md, 05-api/api-rest-design.md
---

# Integration Testing

## Overview

This document provides comprehensive guidance for integration testing in the Abyrith platform, covering test database setup, API mocking strategies, test data management, and integration test patterns. Integration tests verify that different parts of the system work together correctly—database queries execute properly, API endpoints respect Row-Level Security policies, authentication flows work end-to-end, and external services integrate correctly.

**Purpose:** Enable developers to write reliable integration tests that catch interface and integration issues before production while maintaining fast test execution and developer productivity.

**Scope:** Test database configuration (Supabase local), API mocking (MSW), test data factories and fixtures, integration test patterns for authentication, database operations, and external service integration.

**Status:** Draft - Implementation starting Phase 3

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Test Database Setup](#test-database-setup)
5. [API Mocking Strategy](#api-mocking-strategy)
6. [Test Data Management](#test-data-management)
7. [Integration Test Patterns](#integration-test-patterns)
8. [Authentication Testing](#authentication-testing)
9. [Database Integration Testing](#database-integration-testing)
10. [External Service Integration](#external-service-integration)
11. [Test Isolation & Cleanup](#test-isolation--cleanup)
12. [Running Integration Tests](#running-integration-tests)
13. [Troubleshooting](#troubleshooting)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Integration tests sit between unit tests (fast, isolated) and E2E tests (slow, full-system). They verify that components work together correctly without requiring a full browser environment. For Abyrith, integration testing is critical because:

1. **Row-Level Security (RLS)** policies must be tested against real PostgreSQL
2. **Authentication flows** require Supabase Auth integration testing
3. **Encryption workflows** span frontend and backend components
4. **API contracts** between frontend and backend must be verified
5. **External services** (Claude API, FireCrawl) need mocked integration tests

**Pain points:**
- Database state management is complex (setup, teardown, isolation)
- RLS policies can't be tested with in-memory mocks alone
- API mocking requires realistic request/response handling
- Test data setup is repetitive and error-prone
- External service integration needs both mocked and real testing
- Race conditions in async operations lead to flaky tests

**Why now?**
Integration testing strategy must be established before significant feature development to ensure database schemas, API contracts, and security policies work correctly together. Retrofitting integration tests is expensive and error-prone.

### Background

**Existing system:**
Greenfield implementation. No existing integration test suite.

**Previous attempts:**
N/A - Initial integration testing strategy design.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Engineering Lead | Code quality, integration reliability | Test maintenance burden, CI/CD time |
| Backend Team | Database integrity, API correctness | Test database setup complexity |
| Frontend Team | API client reliability | Mock accuracy, test brittleness |
| Security Lead | RLS policy verification | Security regression detection |
| DevOps/SRE | CI/CD reliability | Test execution time, resource usage |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Verify RLS policies prevent data leaks** - Test multi-tenancy enforcement (success metric: 100% RLS policy coverage)
2. **Validate API contracts** - Ensure frontend and backend agree on request/response formats (success metric: All API endpoints integration tested)
3. **Test authentication flows** - Verify JWT generation, validation, and refresh (success metric: All auth flows tested)
4. **Fast test execution** - Integration tests complete in <5 minutes (success metric: <5min CI execution)

**Secondary goals:**
- Provide realistic test database seeding and cleanup
- Enable isolated test execution (no test dependencies)
- Support parallel test execution when possible
- Provide clear failure messages for debugging

### Non-Goals

**Explicitly out of scope:**
- **Full E2E testing** - Use Playwright for browser-based testing instead
- **Performance testing** - Use dedicated load testing tools (k6) instead
- **Testing external services directly** - Mock external APIs unless explicitly testing integration
- **Manual database setup** - Automate all test database operations

### Success Metrics

**How we measure success:**
- **RLS Coverage**: 100% of RLS policies tested in integration tests
- **API Coverage**: 100% of API endpoints have integration tests
- **Test Reliability**: <1% flaky test rate
- **Execution Time**: <5min for full integration test suite
- **Developer Productivity**: Developers can run integration tests locally in <2min

---

## Architecture Overview

### Integration Testing Stack

```
┌─────────────────────────────────────────┐
│       Integration Test Suite            │
│          (Vitest + MSW)                 │
└───────────┬─────────────────────────────┘
            │
            ├──────────────────┬───────────────────┬─────────────────┐
            ▼                  ▼                   ▼                 ▼
    ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐
    │  Test         │  │   MSW        │  │  Supabase    │  │  Test Data  │
    │  Database     │  │   Handlers   │  │  Client      │  │  Factories  │
    │  (Local PG)   │  │  (API Mocks) │  │              │  │             │
    └───────────────┘  └──────────────┘  └──────────────┘  └─────────────┘
            │                  │                   │                 │
            │                  │                   │                 │
            ▼                  ▼                   ▼                 ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                  System Under Test                              │
    │  • API Endpoints                                                │
    │  • Database Queries (with RLS)                                  │
    │  • Authentication Logic                                         │
    │  • External Service Integrations (mocked)                       │
    └─────────────────────────────────────────────────────────────────┘
```

### Key Components

**1. Supabase Local (Test Database)**
- **Purpose:** Real PostgreSQL instance for testing RLS policies
- **Technology:** Docker-based local Supabase stack
- **Responsibilities:**
  - Run actual database queries
  - Enforce RLS policies
  - Provide real Supabase Auth
  - Support database migrations

**2. MSW (Mock Service Worker)**
- **Purpose:** Mock external API calls
- **Technology:** MSW 2.x (Node.js handlers)
- **Responsibilities:**
  - Mock Claude API responses
  - Mock FireCrawl API responses
  - Mock external OAuth providers
  - Intercept HTTP requests in tests

**3. Vitest Integration Test Runner**
- **Purpose:** Execute integration tests
- **Technology:** Vitest 1.x
- **Responsibilities:**
  - Run tests in Node.js environment
  - Manage test lifecycle (setup/teardown)
  - Provide test isolation
  - Generate coverage reports

**4. Test Data Factories**
- **Purpose:** Generate realistic test data
- **Technology:** Custom factories + Faker.js
- **Responsibilities:**
  - Create test users
  - Generate test secrets
  - Seed test database
  - Clean up test data

---

## Test Database Setup

### Supabase Local Installation

**Prerequisites:**
- Docker Desktop installed
- Supabase CLI installed

**Installation:**
```bash
# Install Supabase CLI
npm install -g supabase

# Verify installation
supabase --version
# Expected: supabase 1.x.x
```

### Starting Local Supabase

**Directory Structure:**
```
secrets/
├── supabase/
│   ├── config.toml              # Supabase configuration
│   ├── seed.sql                 # Optional seed data
│   └── migrations/
│       ├── 20250101000000_init.sql
│       └── ...
└── tests/
    └── integration/
        └── setup.ts
```

**Start Supabase:**
```bash
# Start all Supabase services (PostgreSQL, Auth, Realtime, etc.)
supabase start

# Expected output:
# Started supabase local development setup.
#
# API URL: http://localhost:54321
# GraphQL URL: http://localhost:54321/graphql/v1
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Inbucket URL: http://localhost:54324
# JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
# anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Environment Variables:**
```bash
# .env.test (for integration tests)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### Database Migration Management

**Apply Migrations:**
```bash
# Apply all pending migrations
supabase db reset

# Apply specific migration
supabase migration up
```

**Create New Migration:**
```bash
# Create new migration file
supabase migration new add_secrets_table

# Edit supabase/migrations/[timestamp]_add_secrets_table.sql
# Then apply:
supabase db reset
```

### Test Database Configuration

**Vitest Configuration:**
```typescript
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load .env.test
config({ path: '.env.test' });

export default defineConfig({
  test: {
    name: 'integration',
    include: ['**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // 30s for database operations
    hookTimeout: 30000,
    globals: true,
    setupFiles: ['./tests/integration/setup.ts'],
    // Run tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Use single worker for database tests
      },
    },
  },
});
```

**Setup File:**
```typescript
// tests/integration/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Global Supabase client for setup/teardown
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Verify database connection before tests
beforeAll(async () => {
  const { data, error } = await supabaseAdmin
    .from('_test_connection')
    .select('*')
    .limit(1);

  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to connect to test database: ${error.message}`);
  }

  console.log('✓ Connected to test database');
});

// Clean up after all tests
afterAll(async () => {
  // Optionally reset database
  // await resetTestDatabase();
  console.log('✓ Integration tests complete');
});

// Provide clean state for each test
beforeEach(async () => {
  // Start database transaction (optional, for test isolation)
  // await supabaseAdmin.rpc('begin_transaction');
});

afterEach(async () => {
  // Rollback transaction (optional)
  // await supabaseAdmin.rpc('rollback_transaction');

  // Or clean up test data
  await cleanupTestData();
});

async function cleanupTestData() {
  // Delete test data in reverse dependency order
  const tables = [
    'audit_logs',
    'secrets',
    'projects',
    'organization_members',
    'organizations',
    // Note: auth.users managed by Supabase Auth
  ];

  for (const table of tables) {
    // Delete all rows except system rows (if any)
    await supabaseAdmin
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Keep system data
  }
}
```

### Database Seeding

**Seed Helper:**
```typescript
// tests/helpers/seed.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
}

export interface TestOrganization {
  id: string;
  name: string;
}

export interface TestProject {
  id: string;
  name: string;
  organization_id: string;
  created_by: string;
}

/**
 * Create test user with email/password
 */
export async function createTestUser(
  email: string = 'test@example.com',
  password: string = 'test_password_123'
): Promise<TestUser> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm for testing
  });

  if (error) throw error;

  // Generate access token for API requests
  const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) throw signInError;

  return {
    id: data.user.id,
    email,
    password,
    accessToken: session.session!.access_token,
  };
}

/**
 * Create test organization
 */
export async function createTestOrganization(
  name: string = 'Test Organization',
  userId: string
): Promise<TestOrganization> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .insert({
      name,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Add user as owner
  await supabaseAdmin.from('organization_members').insert({
    organization_id: data.id,
    user_id: userId,
    role: 'owner',
  });

  return {
    id: data.id,
    name: data.name,
  };
}

/**
 * Create test project
 */
export async function createTestProject(
  name: string = 'Test Project',
  organizationId: string,
  userId: string
): Promise<TestProject> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      name,
      organization_id: organizationId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    organization_id: data.organization_id,
    created_by: data.created_by,
  };
}

/**
 * Complete test environment setup (user + org + project)
 */
export async function setupTestEnvironment() {
  const user = await createTestUser();
  const org = await createTestOrganization('Test Org', user.id);
  const project = await createTestProject('Test Project', org.id, user.id);

  return { user, org, project };
}
```

---

## API Mocking Strategy

### MSW Setup

**Installation:**
```bash
pnpm add -D msw@latest
```

**MSW Configuration:**
```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with all handlers
export const server = setupServer(...handlers);

// Start server before all tests
export function startMockServer() {
  server.listen({
    onUnhandledRequest: 'warn', // Warn about unmocked requests
  });
}

// Reset handlers after each test
export function resetMockHandlers() {
  server.resetHandlers();
}

// Close server after all tests
export function closeMockServer() {
  server.close();
}
```

**Integration with Vitest:**
```typescript
// tests/integration/setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { startMockServer, resetMockHandlers, closeMockServer } from '../mocks/server';

beforeAll(() => {
  startMockServer();
  console.log('✓ MSW server started');
});

afterEach(() => {
  resetMockHandlers();
});

afterAll(() => {
  closeMockServer();
  console.log('✓ MSW server closed');
});
```

### Mock Handlers

**Supabase API Mocking:**
```typescript
// tests/mocks/handlers/supabase.ts
import { http, HttpResponse } from 'msw';

export const supabaseHandlers = [
  // Mock auth token endpoint
  http.post('http://localhost:54321/auth/v1/token', async ({ request }) => {
    const body = await request.json() as any;

    // Simulate successful login
    if (body.email === 'test@example.com' && body.password === 'test_password_123') {
      return HttpResponse.json({
        access_token: 'mock_access_token_here',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock_refresh_token_here',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          email_confirmed_at: new Date().toISOString(),
        },
      });
    }

    // Invalid credentials
    return HttpResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid login credentials' },
      { status: 400 }
    );
  }),

  // Mock token refresh
  http.post('http://localhost:54321/auth/v1/token?grant_type=refresh_token', async ({ request }) => {
    const body = await request.json() as any;

    if (body.refresh_token === 'mock_refresh_token_here') {
      return HttpResponse.json({
        access_token: 'new_mock_access_token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'new_mock_refresh_token',
      });
    }

    return HttpResponse.json(
      { error: 'invalid_grant' },
      { status: 400 }
    );
  }),
];
```

**External Service Mocking (Claude API):**
```typescript
// tests/mocks/handlers/claude.ts
import { http, HttpResponse } from 'msw';

export const claudeHandlers = [
  // Mock Claude API messages endpoint
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const body = await request.json() as any;
    const userMessage = body.messages?.[0]?.content || '';

    // Simulate AI response based on request
    if (userMessage.toLowerCase().includes('openai')) {
      return HttpResponse.json({
        id: 'msg_test_id',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'To get an OpenAI API key:\n1. Visit https://platform.openai.com/signup\n2. Create an account\n3. Navigate to API Keys section\n4. Click "Create new secret key"',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 20,
          output_tokens: 50,
        },
      });
    }

    // Default response
    return HttpResponse.json({
      id: 'msg_test_id',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I can help you with API key management. What would you like to know?',
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 15,
      },
    });
  }),
];
```

**External Service Mocking (FireCrawl):**
```typescript
// tests/mocks/handlers/firecrawl.ts
import { http, HttpResponse } from 'msw';

export const firecrawlHandlers = [
  // Mock FireCrawl scrape endpoint
  http.post('https://api.firecrawl.dev/v0/scrape', async ({ request }) => {
    const body = await request.json() as any;
    const url = body.url;

    // Return mocked scraped content
    if (url.includes('openai.com/docs')) {
      return HttpResponse.json({
        success: true,
        data: {
          markdown: '# OpenAI API Documentation\n\n## Authentication\n\nUse Bearer token authentication...',
          metadata: {
            title: 'OpenAI API Documentation',
            description: 'Documentation for OpenAI API',
            language: 'en',
          },
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: 'Failed to scrape URL' },
      { status: 400 }
    );
  }),
];
```

**Combine All Handlers:**
```typescript
// tests/mocks/handlers/index.ts
import { supabaseHandlers } from './supabase';
import { claudeHandlers } from './claude';
import { firecrawlHandlers } from './firecrawl';

export const handlers = [
  ...supabaseHandlers,
  ...claudeHandlers,
  ...firecrawlHandlers,
];
```

---

## Test Data Management

### Test Fixtures

**Static Test Data:**
```typescript
// tests/fixtures/secrets.ts
export const testSecrets = {
  openaiKey: {
    id: 'test-secret-openai-001',
    name: 'OPENAI_API_KEY',
    encrypted_value: 'ZW5jcnlwdGVkX2Jsb2JfaGVyZQ==', // Base64 encoded
    service_name: 'OpenAI',
    environment: 'development',
    tags: ['ai', 'api-key'],
    created_at: '2025-10-30T12:00:00Z',
    updated_at: '2025-10-30T12:00:00Z',
  },
  stripeKey: {
    id: 'test-secret-stripe-001',
    name: 'STRIPE_SECRET_KEY',
    encrypted_value: 'c3RyaXBlX2VuY3J5cHRlZA==',
    service_name: 'Stripe',
    environment: 'development',
    tags: ['payment', 'api-key'],
    created_at: '2025-10-30T12:00:00Z',
    updated_at: '2025-10-30T12:00:00Z',
  },
};

export const testProjects = {
  recipeApp: {
    id: 'test-project-recipe-001',
    name: 'RecipeApp',
    description: 'Recipe sharing platform',
    created_at: '2025-10-30T10:00:00Z',
  },
  clientWebsite: {
    id: 'test-project-client-001',
    name: 'ClientWebsite',
    description: 'Client portfolio website',
    created_at: '2025-10-30T10:00:00Z',
  },
};

export const testOrganizations = {
  acmeCorp: {
    id: 'test-org-acme-001',
    name: 'Acme Corporation',
    created_at: '2025-10-30T09:00:00Z',
  },
  testCo: {
    id: 'test-org-testco-001',
    name: 'Test Company',
    created_at: '2025-10-30T09:00:00Z',
  },
};
```

### Test Factories

**Dynamic Test Data Generation:**
```typescript
// tests/factories/secret.factory.ts
import { faker } from '@faker-js/faker';
import type { Database } from '../../types/supabase';

type Secret = Database['public']['Tables']['secrets']['Insert'];

export function createTestSecret(overrides: Partial<Secret> = {}): Secret {
  return {
    id: faker.string.uuid(),
    name: faker.internet.domainWord().toUpperCase() + '_API_KEY',
    encrypted_value: faker.string.alphanumeric(64),
    service_name: faker.company.name(),
    environment: faker.helpers.arrayElement(['development', 'staging', 'production']),
    tags: [faker.word.noun(), faker.word.noun()],
    project_id: faker.string.uuid(),
    created_by: faker.string.uuid(),
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Create multiple test secrets
 */
export function createTestSecrets(count: number, overrides: Partial<Secret> = {}): Secret[] {
  return Array.from({ length: count }, () => createTestSecret(overrides));
}

/**
 * Create realistic secret for specific service
 */
export function createServiceSecret(
  service: 'openai' | 'stripe' | 'github' | 'google',
  overrides: Partial<Secret> = {}
): Secret {
  const serviceConfigs = {
    openai: {
      name: 'OPENAI_API_KEY',
      service_name: 'OpenAI',
      tags: ['ai', 'api-key'],
    },
    stripe: {
      name: 'STRIPE_SECRET_KEY',
      service_name: 'Stripe',
      tags: ['payment', 'api-key'],
    },
    github: {
      name: 'GITHUB_TOKEN',
      service_name: 'GitHub',
      tags: ['git', 'access-token'],
    },
    google: {
      name: 'GOOGLE_API_KEY',
      service_name: 'Google Cloud',
      tags: ['google', 'api-key'],
    },
  };

  return createTestSecret({
    ...serviceConfigs[service],
    ...overrides,
  });
}
```

**Organization Factory:**
```typescript
// tests/factories/organization.factory.ts
import { faker } from '@faker-js/faker';
import type { Database } from '../../types/supabase';

type Organization = Database['public']['Tables']['organizations']['Insert'];

export function createTestOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    created_by: faker.string.uuid(),
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}
```

**Project Factory:**
```typescript
// tests/factories/project.factory.ts
import { faker } from '@faker-js/faker';
import type { Database } from '../../types/supabase';

type Project = Database['public']['Tables']['projects']['Insert'];

export function createTestProject(overrides: Partial<Project> = {}): Project {
  return {
    id: faker.string.uuid(),
    name: faker.word.noun() + 'App',
    description: faker.lorem.sentence(),
    organization_id: faker.string.uuid(),
    created_by: faker.string.uuid(),
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}
```

---

## Integration Test Patterns

### Basic Integration Test Structure

**Template:**
```typescript
// tests/integration/example.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { setupTestEnvironment } from '../helpers/seed';

describe('Example Integration Test', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let supabase: ReturnType<typeof createClient>;

  beforeEach(async () => {
    // Setup test environment (user, org, project)
    testEnv = await setupTestEnvironment();

    // Create authenticated Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${testEnv.user.accessToken}`,
          },
        },
      }
    );
  });

  afterEach(async () => {
    // Cleanup is handled by global afterEach in setup.ts
  });

  it('should perform integration test', async () => {
    // Arrange
    const testData = { /* ... */ };

    // Act
    const { data, error } = await supabase
      .from('secrets')
      .insert(testData)
      .select()
      .single();

    // Assert
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
```

### API Client Integration Tests

**Test API Client with Real Database:**
```typescript
// lib/api/client.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from './client';
import { setupTestEnvironment } from '../../tests/helpers/seed';

describe('API Client Integration', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment();
    // Set auth token for API client
    apiClient.setAuthToken(testEnv.user.accessToken);
  });

  it('should fetch projects with authentication', async () => {
    const response = await apiClient.get('/projects');

    expect(response.status).toBe(200);
    expect(response.data).toBeInstanceOf(Array);
  });

  it('should handle 401 by refreshing token', async () => {
    // Simulate expired token
    apiClient.setAuthToken('expired_token');

    // Should automatically refresh and retry
    const response = await apiClient.get('/projects');

    expect(response.status).toBe(200);
  });

  it('should create secret with encrypted value', async () => {
    const secretData = {
      name: 'TEST_SECRET',
      encrypted_value: 'encrypted_blob_here',
      project_id: testEnv.project.id,
      environment: 'development',
    };

    const response = await apiClient.post('/secrets', secretData);

    expect(response.status).toBe(201);
    expect(response.data.id).toBeDefined();
    expect(response.data.name).toBe('TEST_SECRET');
  });
});
```

### React Query Integration Tests

**Test Server State Management:**
```typescript
// lib/hooks/useSecrets.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSecrets } from './useSecrets';
import { setupTestEnvironment } from '../../tests/helpers/seed';
import { createTestSecret } from '../../tests/factories/secret.factory';
import { supabaseAdmin } from '../../tests/helpers/seed';

describe('useSecrets Hook Integration', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let queryClient: QueryClient;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment();

    // Create test secrets in database
    const secret1 = createTestSecret({
      name: 'OPENAI_API_KEY',
      project_id: testEnv.project.id,
      created_by: testEnv.user.id,
    });

    const secret2 = createTestSecret({
      name: 'STRIPE_SECRET_KEY',
      project_id: testEnv.project.id,
      created_by: testEnv.user.id,
    });

    await supabaseAdmin.from('secrets').insert([secret1, secret2]);

    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  it('should fetch secrets for project', async () => {
    const wrapper = ({ children }: any) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useSecrets(testEnv.project.id),
      { wrapper }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check data
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    // Use invalid project ID
    const { result } = renderHook(
      () => useSecrets('invalid-project-id')
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});
```

---

## Authentication Testing

### Login Flow Integration Test

```typescript
// tests/integration/auth/login.integration.test.ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTestUser } from '../../helpers/seed';

describe('Authentication Flow', () => {
  it('should authenticate user with email/password', async () => {
    // Create test user
    const testUser = await createTestUser('auth@example.com', 'secure_password');

    // Attempt login
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'auth@example.com',
      password: 'secure_password',
    });

    // Verify success
    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe('auth@example.com');
    expect(data.session?.access_token).toBeDefined();
  });

  it('should fail authentication with wrong password', async () => {
    await createTestUser('auth@example.com', 'correct_password');

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'auth@example.com',
      password: 'wrong_password',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid');
    expect(data.user).toBeNull();
  });

  it('should refresh expired token', async () => {
    const testUser = await createTestUser();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Sign in to get refresh token
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    const refreshToken = signInData.session!.refresh_token;

    // Refresh session
    const { data: refreshData, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    expect(error).toBeNull();
    expect(refreshData.session).toBeDefined();
    expect(refreshData.session?.access_token).not.toBe(signInData.session?.access_token);
  });
});
```

### JWT Token Validation

```typescript
// tests/integration/auth/jwt.integration.test.ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTestUser } from '../../helpers/seed';
import jwt from 'jsonwebtoken';

describe('JWT Token Handling', () => {
  it('should include user ID in JWT claims', async () => {
    const testUser = await createTestUser();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    const token = data.session!.access_token;

    // Decode JWT (without verification for testing)
    const decoded = jwt.decode(token) as any;

    expect(decoded.sub).toBe(testUser.id);
    expect(decoded.email).toBe(testUser.email);
    expect(decoded.role).toBe('authenticated');
  });

  it('should reject requests with invalid JWT', async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: 'Bearer invalid_jwt_token_here',
          },
        },
      }
    );

    const { data, error } = await supabase.from('secrets').select('*');

    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT');
  });
});
```

---

## Database Integration Testing

### RLS Policy Testing

```typescript
// tests/integration/database/rls.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTestUser, createTestOrganization, createTestProject } from '../../helpers/seed';
import { createTestSecret } from '../../tests/factories/secret.factory';
import { supabaseAdmin } from '../../helpers/seed';

describe('Row-Level Security Policies', () => {
  describe('Secrets Table RLS', () => {
    it('should prevent users from accessing secrets in other organizations', async () => {
      // Setup: Two users in different organizations
      const userA = await createTestUser('usera@example.com');
      const userB = await createTestUser('userb@example.com');

      const orgA = await createTestOrganization('Org A', userA.id);
      const orgB = await createTestOrganization('Org B', userB.id);

      const projectA = await createTestProject('Project A', orgA.id, userA.id);

      // User A creates secret in Org A
      const secretA = createTestSecret({
        name: 'ORG_A_SECRET',
        project_id: projectA.id,
        created_by: userA.id,
      });

      const { data: insertedSecret } = await supabaseAdmin
        .from('secrets')
        .insert(secretA)
        .select()
        .single();

      // User B attempts to access User A's secret
      const supabaseUserB = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${userB.accessToken}`,
            },
          },
        }
      );

      const { data: accessAttempt, error } = await supabaseUserB
        .from('secrets')
        .select('*')
        .eq('id', insertedSecret!.id);

      // RLS should block access (empty result)
      expect(accessAttempt).toHaveLength(0);
      expect(error).toBeNull(); // No error, just filtered out
    });

    it('should allow users to access secrets in their organization', async () => {
      const userA = await createTestUser('usera@example.com');
      const userB = await createTestUser('userb@example.com');

      const sharedOrg = await createTestOrganization('Shared Org', userA.id);

      // Add User B to same organization
      await supabaseAdmin.from('organization_members').insert({
        organization_id: sharedOrg.id,
        user_id: userB.id,
        role: 'developer',
      });

      const project = await createTestProject('Shared Project', sharedOrg.id, userA.id);

      // User A creates secret
      const secret = createTestSecret({
        name: 'SHARED_SECRET',
        project_id: project.id,
        created_by: userA.id,
      });

      const { data: insertedSecret } = await supabaseAdmin
        .from('secrets')
        .insert(secret)
        .select()
        .single();

      // User B (same org) should be able to access
      const supabaseUserB = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${userB.accessToken}`,
            },
          },
        }
      );

      const { data: accessedSecret, error } = await supabaseUserB
        .from('secrets')
        .select('*')
        .eq('id', insertedSecret!.id)
        .single();

      expect(error).toBeNull();
      expect(accessedSecret).toBeDefined();
      expect(accessedSecret.name).toBe('SHARED_SECRET');
    });
  });

  describe('Projects Table RLS', () => {
    it('should enforce organization-level access to projects', async () => {
      const userA = await createTestUser('usera@example.com');
      const userB = await createTestUser('userb@example.com');

      const orgA = await createTestOrganization('Org A', userA.id);
      const projectA = await createTestProject('Project A', orgA.id, userA.id);

      // User B attempts to access User A's project
      const supabaseUserB = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${userB.accessToken}`,
            },
          },
        }
      );

      const { data, error } = await supabaseUserB
        .from('projects')
        .select('*')
        .eq('id', projectA.id);

      // RLS should block access
      expect(data).toHaveLength(0);
    });
  });
});
```

### Database Query Performance Testing

```typescript
// tests/integration/database/performance.integration.test.ts
import { describe, it, expect } from 'vitest';
import { setupTestEnvironment } from '../../helpers/seed';
import { createTestSecrets } from '../../tests/factories/secret.factory';
import { supabaseAdmin } from '../../helpers/seed';

describe('Database Query Performance', () => {
  it('should query 100 secrets in < 500ms', async () => {
    const testEnv = await setupTestEnvironment();

    // Create 100 test secrets
    const secrets = createTestSecrets(100, {
      project_id: testEnv.project.id,
      created_by: testEnv.user.id,
    });

    await supabaseAdmin.from('secrets').insert(secrets);

    // Measure query time
    const startTime = Date.now();

    const { data, error } = await supabaseAdmin
      .from('secrets')
      .select('*')
      .eq('project_id', testEnv.project.id)
      .limit(100);

    const queryTime = Date.now() - startTime;

    expect(error).toBeNull();
    expect(data).toHaveLength(100);
    expect(queryTime).toBeLessThan(500); // < 500ms
  });

  it('should use index for filtering by environment', async () => {
    const testEnv = await setupTestEnvironment();

    // Create secrets with different environments
    const secrets = [
      ...createTestSecrets(50, { environment: 'development', project_id: testEnv.project.id }),
      ...createTestSecrets(50, { environment: 'production', project_id: testEnv.project.id }),
    ];

    await supabaseAdmin.from('secrets').insert(secrets);

    // Query with environment filter (should use index)
    const startTime = Date.now();

    const { data, error } = await supabaseAdmin
      .from('secrets')
      .select('*')
      .eq('project_id', testEnv.project.id)
      .eq('environment', 'production');

    const queryTime = Date.now() - startTime;

    expect(error).toBeNull();
    expect(data).toHaveLength(50);
    expect(queryTime).toBeLessThan(200); // Should be fast with index
  });
});
```

---

## External Service Integration

### Claude API Integration Test

```typescript
// tests/integration/external/claude-api.integration.test.ts
import { describe, it, expect } from 'vitest';
import { claudeClient } from '../../../lib/external/claude';

describe('Claude API Integration', () => {
  it('should send message and receive response (mocked)', async () => {
    const response = await claudeClient.sendMessage(
      'How do I get an OpenAI API key?'
    );

    expect(response.content).toBeDefined();
    expect(response.content[0].text).toContain('OpenAI');
    expect(response.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('should handle API errors gracefully', async () => {
    // Force error by sending invalid request
    await expect(
      claudeClient.sendMessage('') // Empty message
    ).rejects.toThrow();
  });
});
```

### FireCrawl Integration Test

```typescript
// tests/integration/external/firecrawl.integration.test.ts
import { describe, it, expect } from 'vitest';
import { firecrawlClient } from '../../../lib/external/firecrawl';

describe('FireCrawl API Integration', () => {
  it('should scrape documentation URL (mocked)', async () => {
    const result = await firecrawlClient.scrape('https://platform.openai.com/docs');

    expect(result.success).toBe(true);
    expect(result.data.markdown).toContain('OpenAI');
    expect(result.data.metadata.title).toBeDefined();
  });

  it('should handle scraping failures', async () => {
    const result = await firecrawlClient.scrape('https://invalid-url-here.com');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

## Test Isolation & Cleanup

### Transaction-Based Isolation

```typescript
// tests/helpers/transaction.ts
import { supabaseAdmin } from './seed';

/**
 * Run test in database transaction (rollback after test)
 * NOTE: Supabase client doesn't directly support transactions,
 * so this is a conceptual approach using direct PostgreSQL
 */
export async function runInTransaction(
  testFn: () => Promise<void>
): Promise<void> {
  // This requires direct PostgreSQL connection, not Supabase client
  // Implementation depends on using pg client directly
  // For now, use cleanup-based approach
  await testFn();
}
```

### Cleanup-Based Isolation

```typescript
// tests/helpers/cleanup.ts
import { supabaseAdmin } from './seed';

/**
 * Clean up all test data from database
 */
export async function cleanupAllTestData() {
  // Delete in reverse dependency order
  const tables = [
    'audit_logs',
    'secrets',
    'projects',
    'organization_members',
    'organizations',
  ];

  for (const table of tables) {
    await supabaseAdmin
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
  }

  // Clean up auth users (requires admin API)
  // Note: Be careful in shared test environments
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();

  for (const user of users.users) {
    if (user.email?.includes('@example.com')) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }
  }
}

/**
 * Clean up test data for specific organization
 */
export async function cleanupOrganizationData(organizationId: string) {
  // Delete organization-specific data
  await supabaseAdmin
    .from('secrets')
    .delete()
    .in('project_id', (builder) =>
      builder.from('projects').select('id').eq('organization_id', organizationId)
    );

  await supabaseAdmin
    .from('projects')
    .delete()
    .eq('organization_id', organizationId);

  await supabaseAdmin
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId);

  await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', organizationId);
}
```

### Test Isolation Best Practices

**1. Independent Tests:**
```typescript
describe('Secret Management', () => {
  // ❌ Bad: Tests depend on each other
  it('should create secret', async () => {
    const secret = await createSecret();
    // Stored in shared variable
  });

  it('should update secret', async () => {
    // Assumes secret from previous test exists
  });

  // ✅ Good: Each test sets up its own data
  it('should create secret', async () => {
    const testEnv = await setupTestEnvironment();
    const secret = await createSecret(testEnv.project.id);
    expect(secret).toBeDefined();
  });

  it('should update secret', async () => {
    const testEnv = await setupTestEnvironment();
    const secret = await createSecret(testEnv.project.id);
    const updated = await updateSecret(secret.id, { name: 'NEW_NAME' });
    expect(updated.name).toBe('NEW_NAME');
  });
});
```

**2. Cleanup in afterEach:**
```typescript
describe('Integration Tests', () => {
  let testOrg: any;

  beforeEach(async () => {
    const user = await createTestUser();
    testOrg = await createTestOrganization('Test Org', user.id);
  });

  afterEach(async () => {
    // Clean up after each test
    await cleanupOrganizationData(testOrg.id);
  });

  it('should test something', async () => {
    // Test uses testOrg
  });
});
```

---

## Running Integration Tests

### Local Development

**Run Integration Tests:**
```bash
# Start Supabase local
supabase start

# Run integration tests
pnpm test:integration

# Or with watch mode
pnpm test:integration --watch

# Run specific integration test file
pnpm test:integration tests/integration/auth/login.integration.test.ts

# Run with coverage
pnpm test:integration --coverage
```

**Scripts Configuration:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:watch": "vitest --config vitest.integration.config.ts",
    "test:all": "pnpm test:unit && pnpm test:integration",
    "test:coverage": "vitest run --coverage"
  }
}
```

### CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 54322:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Setup Supabase CLI
        run: |
          npm install -g supabase
          supabase --version

      - name: Start Supabase local
        run: |
          supabase start
          supabase db reset

      - name: Run integration tests
        run: pnpm test:integration
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_KEY }}

      - name: Upload test coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/integration/coverage-final.json
          flags: integration

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

---

## Troubleshooting

### Common Issues

**Issue 1: "Cannot connect to test database"**

**Symptoms:**
```
Error: Failed to connect to test database: connection refused
```

**Cause:** Supabase local not running or wrong connection URL.

**Solution:**
```bash
# Check if Supabase is running
supabase status

# If not running, start it
supabase start

# Verify .env.test has correct URL
cat .env.test
# Should have: SUPABASE_URL=http://localhost:54321
```

---

**Issue 2: "RLS policy test failing"**

**Symptoms:**
```
Expected: 0 rows
Received: 1 row
```

**Cause:** RLS policies not applied or user has service_role access.

**Solution:**
```typescript
// Use anon key, not service_role key
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!, // Not SERVICE_ROLE_KEY
  {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  }
);
```

---

**Issue 3: "Test data persists between tests"**

**Symptoms:**
```
Error: duplicate key value violates unique constraint
```

**Cause:** Cleanup not running or incomplete.

**Solution:**
```typescript
// Add afterEach cleanup
afterEach(async () => {
  await cleanupAllTestData();
});

// Or use transactions (if supported)
```

---

**Issue 4: "MSW not intercepting requests"**

**Symptoms:**
```
Error: Request failed with status code 404
```

**Cause:** MSW server not started or handlers not matching URL.

**Solution:**
```typescript
// Verify MSW server is started in setup.ts
import { startMockServer } from '../mocks/server';

beforeAll(() => {
  startMockServer();
});

// Check handler URL matches exactly
http.post('https://api.anthropic.com/v1/messages', /* ... */)
// Not: 'https://api.anthropic.com/messages' (missing /v1)
```

---

**Issue 5: "Integration tests timing out"**

**Symptoms:**
```
Error: Test timed out in 5000ms
```

**Cause:** Database operation taking too long or waiting for network.

**Solution:**
```typescript
// Increase timeout for integration tests
// vitest.integration.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds
    hookTimeout: 30000,
  },
});

// Or per-test:
it('should perform slow operation', async () => {
  // Test implementation
}, { timeout: 60000 }); // 60 seconds
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `11-development/testing/testing-strategy.md` - Overall testing strategy
- [x] `TECH-STACK.md` - Testing tools (Vitest, MSW, Supabase)
- [x] `04-database/database-overview.md` - Database schema to test
- [x] `05-api/api-rest-design.md` - API contracts to verify

**Testing Infrastructure:**
- Vitest 1.x (integration test runner)
- MSW 2.x (API mocking)
- Supabase CLI (local database)
- Faker.js (test data generation)
- @testing-library/react (component testing)

**Database:**
- PostgreSQL 15.x (via Supabase local)
- Supabase Auth (local)
- Docker (for Supabase services)

---

## References

### Internal Documentation
- `11-development/testing/testing-strategy.md` - Overall testing approach
- `TECH-STACK.md` - Testing tools and versions
- `04-database/database-overview.md` - Database architecture
- `04-database/schemas/*.md` - Database schemas to test
- `05-api/api-rest-design.md` - API contracts
- `03-security/rbac/rls-policies.md` - RLS policies to verify
- `GLOSSARY.md` - Testing terminology

### External Resources
- [Vitest Documentation](https://vitest.dev/) - Integration testing framework
- [MSW Documentation](https://mswjs.io/) - API mocking
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli) - Local development
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/testing) - Testing patterns
- [Faker.js Documentation](https://fakerjs.dev/) - Test data generation
- [Testing Library](https://testing-library.com/) - Component testing utilities

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Engineering Lead | Initial integration testing documentation with test database setup, API mocking, and test data management |

---

## Notes

### Future Enhancements
- **Snapshot Testing** - Add snapshot testing for API responses
- **Contract Testing** - Implement Pact for API contract verification
- **Database Seeding Library** - Create reusable seeding library
- **Parallel Test Execution** - Optimize for parallel integration tests
- **Visual Database Diff** - Tool to compare test DB state before/after

### Known Issues
- Supabase local startup can be slow (~30-60s) on first run
- RLS policy tests require careful auth token management
- Test database cleanup can miss cascading deletes (document dependencies)
- MSW doesn't intercept fetch() in some edge cases (use node-fetch polyfill)

### Next Review Date
2025-12-01 (review after initial integration test implementation)
