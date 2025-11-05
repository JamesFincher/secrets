# Logging Setup and Debug Guide

## Overview

Added comprehensive structured logging using **pino** to both frontend and backend to make debugging easy and automatic.

## What Was Added

### 1. Logging Libraries

- **pino** - Fast, structured JSON logging
- **pino-pretty** - Human-readable log formatting for development

Installed in both:
- `abyrith-app/` (frontend)
- `abyrith-app/workers/` (backend)

### 2. Logging Utilities

#### Frontend: `lib/utils/logger.ts`

Features:
- **Browser-compatible** structured logging
- **Automatic context enrichment** (environment, user agent, timestamps)
- **API call logger** with request/response tracking
- **Uncaught error handling** automatically logs unhandled errors

Usage:
```typescript
import { createApiLogger } from '@/lib/utils/logger';

const log = createApiLogger('github-api');

// Log API request
log.request('POST', endpoint, requestData);

// Log success
log.success('POST', endpoint, 200, responseData);

// Log error
log.error('POST', endpoint, error);

// Log debug info
log.debug('Decrypting token', { userId: '...' });
```

#### Backend: `workers/src/utils/logger.ts`

Features:
- **Cloudflare Workers compatible**
- **Request context tracking** with unique request IDs
- **Handler-specific logging** with automatic enrichment
- **Database operation logging**
- **External API call logging**

Usage:
```typescript
import { createHandlerLogger } from '../utils/logger';

export async function handleGitHubLinkRepo(c: Context) {
  const log = createHandlerLogger('github-link-repo', c);

  log.start({ userId: user.id });

  // Log database operations
  log.database('INSERT', 'github_linked_repos', data);

  // Log external API calls
  log.externalApi('GitHub', 'GET', '/repos/owner/repo');

  // Log success
  log.success({ linkedRepoId: '...' });

  // Log errors
  log.error(error, { context: 'verify_repo_access' });
}
```

### 3. Enhanced Files with Logging

#### Frontend
- `lib/api/github.ts` - All GitHub API client functions now log:
  - Request payloads
  - Response status
  - Errors with full context
  - Token decryption steps

#### Backend
- `workers/src/handlers/github-link-repo.ts` - Complete request flow logging:
  - Request validation
  - Database queries
  - GitHub API calls
  - Project creation
  - Repository linking
  - All errors with context

## How to Use

### Development

1. **Start Workers (Backend)**
   ```bash
   cd abyrith-app/workers
   pnpm dev
   ```

   Logs will appear in console with structured JSON format.

2. **Start Frontend**
   ```bash
   cd abyrith-app
   pnpm dev
   ```

   Browser console will show structured logs.

### Log Levels

- **debug** - Detailed information (token decryption, data transforms)
- **info** - General information (request start, success)
- **warn** - Warning messages (validation errors, missing data)
- **error** - Error messages (exceptions, failures)

### Reading Logs

#### Browser Console (Frontend)

Logs appear as expandable objects with:
- `level` - Log level (debug, info, warn, error)
- `time` - ISO timestamp
- `context` - Request/module context
- `event` - Event type (api.request, api.success, api.error)
- `...data` - Additional structured data

Example:
```json
{
  "level": "info",
  "time": "2025-11-04T12:34:56.789Z",
  "context": {
    "module": "github-api",
    "type": "api",
    "environment": "development"
  },
  "event": "api.request",
  "method": "POST",
  "url": "http://localhost:8787/api/v1/github/repos/link",
  "hasBody": true,
  "msg": "POST http://localhost:8787/api/v1/github/repos/link"
}
```

#### Worker Console (Backend)

Logs appear in terminal with:
- Request ID for tracing
- Handler name
- Event type
- Structured data

Example:
```json
{
  "level": "info",
  "time": "2025-11-04T12:34:56.789Z",
  "context": {
    "worker": "abyrith-api",
    "request": {
      "id": "abc-123-def",
      "method": "POST",
      "path": "/api/v1/github/repos/link"
    }
  },
  "handler": "github-link-repo",
  "event": "handler.start",
  "userId": "user-uuid-here",
  "msg": "[github-link-repo] Handler started"
}
```

## Debugging the GitHub Link Error

### The 500 Error Issue

The logs will now show **exactly** where the error occurs:

1. **Frontend logs** show:
   - Request payload sent to worker
   - Response status and error message
   - Token decryption success/failure

2. **Backend logs** show:
   - Request received
   - Validation results
   - GitHub API calls (success/failure)
   - Database operations (each query)
   - Project creation (RPC call details)
   - Linked repo insertion (payload and response)
   - **Exact error with stack trace**

### Common Error Patterns

#### 1. Token Decryption Failure
```json
{
  "level": "error",
  "event": "api.error",
  "msg": "Decryption failed: Invalid master password"
}
```

#### 2. Database RLS Policy Rejection
```json
{
  "level": "error",
  "handler": "github-link-repo",
  "operation": "INSERT",
  "table": "github_linked_repos",
  "error": "new row violates row-level security policy"
}
```

#### 3. GitHub API Failure
```json
{
  "level": "error",
  "service": "GitHub",
  "status": 404,
  "msg": "Repository not found or you do not have access"
}
```

#### 4. Missing Organization
```json
{
  "level": "error",
  "msg": "User not associated with an organization"
}
```

### How to Reproduce and Debug

1. **Start both servers with logging enabled**
2. **Open Browser DevTools** → Console tab
3. **Attempt to link a GitHub repository**
4. **Watch logs flow in real-time:**
   - Frontend: Request preparation → API call → Response
   - Backend: Request received → Validation → GitHub check → DB operations
5. **Find the first error** - The logs will show the exact step that failed
6. **Check error context** - Structured data shows what values were present

### Example Debug Session

```
# Frontend logs
[INFO] Starting GitHub repository link
[DEBUG] Fetching GitHub connection
[DEBUG] GitHub connection found
[DEBUG] Decrypting GitHub token
[DEBUG] GitHub token decrypted successfully
[INFO] api.request POST /api/v1/github/repos/link
[ERROR] api.error status=500 message="Failed to link repository: ..."

# Backend logs
[INFO] [github-link-repo] Handler started
[DEBUG] [github-link-repo] Request body received
[INFO] [github-link-repo] Request validated successfully
[DEBUG] [github-link-repo] DB SELECT on github_connections
[DEBUG] [github-link-repo] Using GitHub connection ID
[DEBUG] [github-link-repo] DB RPC CALL create_project_with_environments
[ERROR] [github-link-repo] Create project RPC failed
        error: "permission denied for table projects"
        status: 403
```

From this, we can see the **exact issue**: RLS policy rejection on project creation.

## Production Considerations

### Log Level Configuration

In production, set log level to `info` or `warn`:

```typescript
// Frontend: lib/utils/logger.ts
const loggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  // ...
};

// Backend: workers/src/utils/logger.ts
const loggerConfig = {
  level: process.env.ENVIRONMENT === 'production' ? 'info' : 'debug',
  // ...
};
```

### Sensitive Data

The logger automatically:
- **Never logs** master passwords or decrypted secrets
- **Truncates** request bodies to 100 characters in summaries
- **Masks** GitHub tokens (shown as "hasToken: true" in logs)

### Log Aggregation

For production, integrate with:
- **Sentry** - Already configured for error tracking
- **LogTail** / **Datadog** - For centralized log aggregation
- **Cloudflare Logpush** - For worker logs

## Next Steps

1. **Test the enhanced logging** by reproducing the error
2. **Analyze the logs** to identify the root cause
3. **Fix the issue** based on the detailed error context
4. **Keep logging** in place for future debugging

## Benefits

✅ **Automatic logging** - No manual console.log needed
✅ **Structured data** - Easy to parse and analyze
✅ **Request tracing** - Follow a request through the entire flow
✅ **Error context** - Know exactly what values caused errors
✅ **Performance tracking** - See timing for each operation
✅ **Production ready** - Log levels and sensitive data handling
