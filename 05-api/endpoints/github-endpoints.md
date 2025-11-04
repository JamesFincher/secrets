---
Document: GitHub Integration - API Endpoint Documentation
Version: 1.0.0
Last Updated: 2025-11-04
Owner: Backend Engineering
Status: Draft
Dependencies: 05-api/api-rest-design.md, 04-database/schemas/github-connections.md, 06-backend/integrations/github-api-integration.md, 03-security/security-model.md
---

# GitHub Integration API Endpoints

## Overview

This document defines all API endpoints for GitHub repository linking and syncing functionality in Abyrith. The GitHub integration enables users to connect their GitHub accounts, link repositories to Abyrith Projects, and synchronize secrets from GitHub repositories (environment files, GitHub Actions secrets, and dependency configurations).

**Base URL:** `https://api.abyrith.com/v1`

**Resource:** GitHub Integrations

**Authentication:** Required (JWT Bearer token)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Patterns](#common-patterns)
3. [Endpoints](#endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Examples](#examples)
7. [Dependencies](#dependencies)
8. [References](#references)
9. [Change Log](#change-log)

---

## Authentication

### Required Headers

```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Token Structure

```typescript
interface JWTPayload {
  sub: string;        // User ID
  email: string;      // User email
  org_id?: string;    // Organization ID (if applicable)
  role: string;       // User role
  iat: number;        // Issued at
  exp: number;        // Expiration
}
```

### Obtaining Tokens

See `05-api/endpoints/auth-endpoints.md` for token acquisition flows.

---

## Common Patterns

### Pagination

**Query Parameters:**
```typescript
interface PaginationParams {
  page?: number;      // Page number (default: 1)
  per_page?: number;  // Items per page (default: 30, max: 100)
}
```

**Response Structure:**
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
```

### Filtering

**Query Parameters:**
```typescript
interface FilterParams {
  [key: string]: string | number | boolean;
}
```

**Example:**
```
GET /github/repos?sort=updated&linked=false
```

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  error: string;          // Error code (snake_case)
  message: string;        // Human-readable error message
  details?: object;       // Additional error details (optional)
  request_id?: string;    // Request ID for debugging (optional)
}
```

---

## Endpoints

### 1. Initiate GitHub OAuth Connection

**Endpoint:** `POST /api/v1/github/connect`

**Description:** Initiates the GitHub OAuth flow to connect a user's GitHub account to Abyrith.

**Permissions Required:** `authenticated`

**Request:**
```typescript
interface ConnectRequest {
  redirect_uri: string;    // OAuth callback URL
  scopes: string[];        // OAuth scopes (e.g., ["repo", "read:org"])
}
```

**Example Request:**
```json
POST /api/v1/github/connect
{
  "redirect_uri": "https://app.abyrith.com/github/callback",
  "scopes": ["repo", "read:org"]
}
```

**Success Response (200 OK):**
```typescript
interface ConnectResponse {
  oauth_url: string;       // GitHub authorization URL
  state: string;           // Random state token for CSRF protection
}
```

**Example Response:**
```json
{
  "oauth_url": "https://github.com/login/oauth/authorize?client_id=abc123&redirect_uri=https%3A%2F%2Fapp.abyrith.com%2Fgithub%2Fcallback&scope=repo+read%3Aorg&state=random_state_token_xyz",
  "state": "random_state_token_xyz"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `400 Bad Request` - Invalid redirect_uri or scopes
  ```json
  {
    "error": "invalid_request",
    "message": "Invalid redirect_uri: must use HTTPS"
  }
  ```
- `429 Too Many Requests` - Rate limit exceeded (10 requests/hour)

**Validation Rules:**
- `redirect_uri`: Required, must use HTTPS, must match registered callback URLs
- `scopes`: Required, array of valid GitHub OAuth scopes

---

### 2. Handle GitHub OAuth Callback

**Endpoint:** `POST /api/v1/github/callback`

**Description:** Handles the GitHub OAuth callback after user authorization, exchanges the authorization code for an access token, and stores the encrypted token.

**Permissions Required:** `authenticated`

**Request:**
```typescript
interface CallbackRequest {
  code: string;            // GitHub OAuth authorization code
  state: string;           // State token from initiate step
}
```

**Example Request:**
```json
POST /api/v1/github/callback
{
  "code": "github_oauth_code_abc123",
  "state": "random_state_token_xyz"
}
```

**Success Response (201 Created):**
```typescript
interface CallbackResponse {
  connection_id: string;   // UUID of connection
  github_username: string; // GitHub username
  github_user_id: number;  // GitHub user ID
  scopes: string[];        // Granted OAuth scopes
  expires_at: string;      // ISO 8601 timestamp (null for GitHub apps)
}
```

**Example Response:**
```json
{
  "connection_id": "550e8400-e29b-41d4-a716-446655440000",
  "github_username": "user123",
  "github_user_id": 12345678,
  "scopes": ["repo", "read:org"],
  "expires_at": null
}
```

**Server Actions:**
1. Verify state token matches session state
2. Exchange authorization code for GitHub access token
3. Fetch GitHub user information (username, user_id)
4. Encrypt access token using platform encryption key (AES-256-GCM)
5. Store encrypted token in `github_connections` table
6. Return connection metadata

**Error Responses:**
- `400 Bad Request` - Invalid code or state mismatch
  ```json
  {
    "error": "invalid_state",
    "message": "State token mismatch or expired"
  }
  ```
- `401 Unauthorized` - Missing or invalid JWT token
- `409 Conflict` - GitHub account already connected
  ```json
  {
    "error": "connection_exists",
    "message": "This GitHub account is already connected to your Abyrith account"
  }
  ```
- `502 Bad Gateway` - GitHub API error
  ```json
  {
    "error": "github_api_error",
    "message": "Failed to exchange authorization code with GitHub"
  }
  ```

**Validation Rules:**
- `code`: Required, string, non-empty
- `state`: Required, must match stored session state

---

### 3. Get GitHub Connection Status

**Endpoint:** `GET /api/v1/github/connection`

**Description:** Retrieves the current GitHub connection status and metadata for the authenticated user.

**Permissions Required:** `authenticated`

**Success Response (200 OK):**
```typescript
interface ConnectionStatusResponse {
  connected: boolean;
  connection_id?: string;
  github_username?: string;
  github_user_id?: number;
  scopes?: string[];
  expires_at?: string | null;
  last_used_at?: string;
}
```

**Example Response (Connected):**
```json
{
  "connected": true,
  "connection_id": "550e8400-e29b-41d4-a716-446655440000",
  "github_username": "user123",
  "github_user_id": 12345678,
  "scopes": ["repo", "read:org"],
  "expires_at": null,
  "last_used_at": "2025-11-04T10:30:00Z"
}
```

**Example Response (Not Connected):**
```json
{
  "connected": false
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token

---

### 4. Disconnect GitHub Account

**Endpoint:** `DELETE /api/v1/github/connection`

**Description:** Disconnects the user's GitHub account from Abyrith, removing the connection and unlinking all repositories.

**Permissions Required:** `authenticated`

**Success Response (200 OK):**
```typescript
interface DisconnectResponse {
  success: boolean;
  message: string;
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "GitHub connection removed successfully"
}
```

**Server Actions:**
1. Delete `github_connections` record
2. Mark all linked repositories as unlinked in `github_linked_repos` (soft delete)
3. Disable auto-sync for all linked repos
4. Secrets remain in Abyrith (not deleted)

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `404 Not Found` - No GitHub connection exists
  ```json
  {
    "error": "connection_not_found",
    "message": "No GitHub connection found for this user"
  }
  ```

---

### 5. List Accessible GitHub Repositories

**Endpoint:** `GET /api/v1/github/repos`

**Description:** Lists all GitHub repositories the user has access to through their connected GitHub account.

**Permissions Required:** `authenticated`

**Query Parameters:**
```typescript
interface ListReposParams extends PaginationParams {
  sort?: 'updated' | 'created' | 'pushed' | 'full_name';  // Sort order (default: 'updated')
}
```

**Example Request:**
```
GET /api/v1/github/repos?page=1&per_page=30&sort=updated
```

**Success Response (200 OK):**
```typescript
interface ListReposResponse {
  repos: GitHubRepo[];
  total_count: number;
  page: number;
  per_page: number;
}

interface GitHubRepo {
  id: number;              // GitHub repository ID
  owner: string;           // Repository owner username
  name: string;            // Repository name
  full_name: string;       // owner/name
  url: string;             // GitHub repository URL
  private: boolean;        // Is private repository
  description: string | null;
  language: string | null; // Primary programming language
  updated_at: string;      // ISO 8601 timestamp
  linked: boolean;         // Is linked to Abyrith
}
```

**Example Response:**
```json
{
  "repos": [
    {
      "id": 12345,
      "owner": "user123",
      "name": "my-app",
      "full_name": "user123/my-app",
      "url": "https://github.com/user123/my-app",
      "private": true,
      "description": "My awesome app",
      "language": "TypeScript",
      "updated_at": "2025-11-04T10:00:00Z",
      "linked": false
    },
    {
      "id": 67890,
      "owner": "user123",
      "name": "backend-api",
      "full_name": "user123/backend-api",
      "url": "https://github.com/user123/backend-api",
      "private": true,
      "description": "Backend REST API",
      "language": "Python",
      "updated_at": "2025-11-03T15:30:00Z",
      "linked": true
    }
  ],
  "total_count": 150,
  "page": 1,
  "per_page": 30
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `404 Not Found` - No GitHub connection exists
  ```json
  {
    "error": "connection_not_found",
    "message": "No GitHub connection found. Please connect your GitHub account first."
  }
  ```
- `503 Service Unavailable` - GitHub API unavailable
  ```json
  {
    "error": "github_api_unavailable",
    "message": "GitHub API is currently unavailable. Please try again later."
  }
  ```

**GitHub API Rate Limiting:**
- Uses authenticated GitHub API requests (5,000 requests/hour)
- Rate limit headers passed through to client

---

### 6. Link GitHub Repository to Abyrith Project

**Endpoint:** `POST /api/v1/github/repos/link`

**Description:** Links a GitHub repository to an Abyrith Project, enabling secret synchronization from the repository.

**Permissions Required:** `project:write` (Admin or Owner role)

**Request:**
```typescript
interface LinkRepoRequest {
  repo_id: number;                    // GitHub repository ID
  repo_owner: string;                 // Repository owner username
  repo_name: string;                  // Repository name
  repo_url: string;                   // GitHub repository URL
  action: 'create_project' | 'link_existing';  // Create new or link existing
  project_name?: string;              // Required if action=create_project
  project_id?: string;                // Required if action=link_existing
  default_environment_id?: string;    // Target environment for synced secrets
  write_marker_file?: boolean;        // Write .abyrith file to repo (default: true)
  sync_config: {
    env_files: boolean;               // Sync .env files
    github_actions: boolean;          // Sync GitHub Actions secrets
    dependencies: boolean;            // Sync dependency configs
  };
}
```

**Example Request:**
```json
POST /api/v1/github/repos/link
{
  "repo_id": 12345,
  "repo_owner": "user123",
  "repo_name": "my-app",
  "repo_url": "https://github.com/user123/my-app",
  "action": "create_project",
  "project_name": "My App Backend",
  "write_marker_file": true,
  "sync_config": {
    "env_files": true,
    "github_actions": true,
    "dependencies": true
  }
}
```

**Success Response (201 Created):**
```typescript
interface LinkRepoResponse {
  linked_repo_id: string;             // UUID of linked repo record
  project_id: string;                 // UUID of Abyrith Project
  project_name: string;               // Project name
  abyrith_identifier: string;         // Anonymous UUID for .abyrith file
  marker_file_created: boolean;       // Was .abyrith file written
  repo_variable_created: boolean;     // Was ABYRITH_ORG_ID variable created
}
```

**Example Response:**
```json
{
  "linked_repo_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_id": "660e9500-f39c-52e5-b827-557766551111",
  "project_name": "My App Backend",
  "abyrith_identifier": "770ea600-g49d-63f6-c938-668877662222",
  "marker_file_created": true,
  "repo_variable_created": true
}
```

**Server Actions:**
1. Verify user has admin/owner access to GitHub repository
2. Create Project if `action=create_project` (or verify access if `link_existing`)
3. Generate anonymous UUID for `.abyrith` file
4. Write `.abyrith` file to repository root (if `write_marker_file=true`)
5. Create GitHub repository variable `ABYRITH_ORG_ID` with organization ID
6. Insert record into `github_linked_repos` table
7. Return success with identifiers

**Error Responses:**
- `400 Bad Request` - Invalid request body
  ```json
  {
    "error": "validation_error",
    "message": "Missing required field: project_name",
    "details": { "project_name": ["is required when action=create_project"] }
  }
  ```
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - No write access to repository
  ```json
  {
    "error": "insufficient_permissions",
    "message": "You do not have write access to this GitHub repository"
  }
  ```
- `404 Not Found` - Project not found (if `link_existing`)
  ```json
  {
    "error": "project_not_found",
    "message": "Project with ID 660e9500-f39c-52e5-b827-557766551111 not found"
  }
  ```
- `409 Conflict` - Repository already linked
  ```json
  {
    "error": "repo_already_linked",
    "message": "This repository is already linked to project 'My App Backend'"
  }
  ```

**Validation Rules:**
- `repo_id`: Required, positive integer
- `repo_owner`: Required, non-empty string
- `repo_name`: Required, non-empty string
- `repo_url`: Required, valid GitHub repository URL
- `action`: Required, must be 'create_project' or 'link_existing'
- `project_name`: Required if `action=create_project`, max 255 characters
- `project_id`: Required if `action=link_existing`, valid UUID
- `sync_config`: Required, at least one option must be true

---

### 7. Unlink GitHub Repository

**Endpoint:** `DELETE /api/v1/github/repos/:repo_id/unlink`

**Description:** Unlinks a GitHub repository from Abyrith, disabling synchronization.

**Permissions Required:** `project:write` (Admin or Owner role)

**Path Parameters:**
- `repo_id` (integer, required) - GitHub repository ID

**Success Response (200 OK):**
```typescript
interface UnlinkRepoResponse {
  success: boolean;
  marker_file_removed: boolean;       // Was .abyrith file removed
  repo_variable_removed: boolean;     // Was ABYRITH_ORG_ID variable removed
  secrets_retained: boolean;          // Secrets not deleted (always true)
}
```

**Example Response:**
```json
{
  "success": true,
  "marker_file_removed": true,
  "repo_variable_removed": true,
  "secrets_retained": true
}
```

**Server Actions:**
1. Verify user has admin/owner access to linked repository
2. Remove `.abyrith` file from repository
3. Delete GitHub repository variable `ABYRITH_ORG_ID`
4. Soft-delete `github_linked_repos` record (mark as `unlinked`)
5. Secrets remain in Abyrith (not deleted)

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - No access to repository or project
  ```json
  {
    "error": "insufficient_permissions",
    "message": "You do not have permission to unlink this repository"
  }
  ```
- `404 Not Found` - Repository not linked
  ```json
  {
    "error": "repo_not_linked",
    "message": "This repository is not linked to any Abyrith project"
  }
  ```

---

### 8. Trigger Manual Sync from GitHub Repository

**Endpoint:** `POST /api/v1/github/repos/:repo_id/sync`

**Description:** Manually triggers a synchronization of secrets from a linked GitHub repository to Abyrith.

**Permissions Required:** `project:write` (Admin or Owner role)

**Path Parameters:**
- `repo_id` (integer, required) - GitHub repository ID

**Request:**
```typescript
interface SyncRequest {
  sources: ('env_files' | 'github_actions' | 'dependencies')[];  // What to sync
  environment_id?: string;         // Target environment UUID (default: development)
  collision_strategy: 'skip' | 'overwrite' | 'rename';  // How to handle existing secrets
  files?: string[];                // Specific files to sync (optional)
}
```

**Example Request:**
```json
POST /api/v1/github/repos/12345/sync
{
  "sources": ["env_files", "github_actions", "dependencies"],
  "environment_id": "770ea600-g49d-63f6-c938-668877662222",
  "collision_strategy": "skip",
  "files": [".env", ".env.production"]
}
```

**Success Response (200 OK):**
```typescript
interface SyncResponse {
  sync_log_id: string;             // UUID of sync log
  status: 'success' | 'partial' | 'failed';
  secrets_imported: number;        // Count of successfully imported secrets
  secrets_skipped: number;         // Count of skipped secrets
  secrets_failed: number;          // Count of failed imports
  imported_files: string[];        // Files successfully synced
  details: SyncDetail[];           // Per-secret details
}

interface SyncDetail {
  key_name: string;                // Secret key name
  source_file: string;             // Source file path
  action: 'imported' | 'skipped' | 'failed';
  secret_id?: string;              // UUID of created secret (if imported)
  reason?: string;                 // Reason for skip/failure
}
```

**Example Response:**
```json
{
  "sync_log_id": "880fb700-h59e-74g7-d049-779988773333",
  "status": "success",
  "secrets_imported": 15,
  "secrets_skipped": 3,
  "secrets_failed": 0,
  "imported_files": [".env", ".env.production", "package.json"],
  "details": [
    {
      "key_name": "DATABASE_URL",
      "source_file": ".env.production",
      "action": "imported",
      "secret_id": "990gc800-i69f-85h8-e150-880099884444"
    },
    {
      "key_name": "STRIPE_API_KEY",
      "source_file": ".env",
      "action": "skipped",
      "reason": "Secret already exists in environment"
    },
    {
      "key_name": "OPENAI_API_KEY",
      "source_file": ".env",
      "action": "imported",
      "secret_id": "aa0hd900-j70g-96i9-f261-991100995555"
    }
  ]
}
```

**Server Actions:**
1. Verify repository is linked and user has write access
2. Fetch specified files from GitHub API
3. Parse .env files, GitHub Actions secrets, dependency configs
4. For each discovered secret:
   - Check if secret already exists in target environment
   - Apply collision_strategy (skip/overwrite/rename)
   - Encrypt secret value client-side (via browser WebSocket)
   - Store encrypted secret in Abyrith database
5. Create entries in `github_imported_secrets` table
6. Log operation to `github_sync_logs` table
7. Return sync results

**Error Responses:**
- `400 Bad Request` - Invalid request body
  ```json
  {
    "error": "validation_error",
    "message": "Invalid collision_strategy: must be 'skip', 'overwrite', or 'rename'"
  }
  ```
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - No access to repository or project
- `404 Not Found` - Repository not linked
- `429 Too Many Requests` - Rate limit exceeded (20 requests/hour)
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Too many sync requests. Please try again in 30 minutes."
  }
  ```
- `503 Service Unavailable` - GitHub API unavailable

**Validation Rules:**
- `sources`: Required, non-empty array
- `collision_strategy`: Required, must be 'skip', 'overwrite', or 'rename'
- `environment_id`: Optional, valid UUID
- `files`: Optional, array of strings

---

### 9. Preview Secrets from GitHub Repository

**Endpoint:** `GET /api/v1/github/repos/:repo_id/preview`

**Description:** Previews secrets that would be imported from a GitHub repository without actually importing them.

**Permissions Required:** `project:read` (any role)

**Path Parameters:**
- `repo_id` (integer, required) - GitHub repository ID

**Query Parameters:**
```typescript
interface PreviewParams {
  sources?: string;                // Comma-separated: 'env_files,github_actions,dependencies'
  files?: string;                  // Comma-separated list of specific files
}
```

**Example Request:**
```
GET /api/v1/github/repos/12345/preview?sources=env_files,github_actions&files=.env,.env.production
```

**Success Response (200 OK):**
```typescript
interface PreviewResponse {
  secrets: PreviewSecret[];
  total_secrets: number;
  collisions: number;              // Count of existing secrets
  files_scanned: string[];
}

interface PreviewSecret {
  key_name: string;
  source_file: string;
  source_type: 'env_file' | 'github_actions' | 'dependency';
  exists_in_abyrith: boolean;
  collision: boolean;
}
```

**Example Response:**
```json
{
  "secrets": [
    {
      "key_name": "DATABASE_URL",
      "source_file": ".env.production",
      "source_type": "env_file",
      "exists_in_abyrith": true,
      "collision": true
    },
    {
      "key_name": "STRIPE_API_KEY",
      "source_file": ".env",
      "source_type": "env_file",
      "exists_in_abyrith": false,
      "collision": false
    },
    {
      "key_name": "ACTIONS_DEPLOY_KEY",
      "source_file": ".github/workflows/deploy.yml",
      "source_type": "github_actions",
      "exists_in_abyrith": false,
      "collision": false
    }
  ],
  "total_secrets": 15,
  "collisions": 3,
  "files_scanned": [".env", ".env.production", ".github/workflows/deploy.yml", "package.json"]
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - No access to repository
- `404 Not Found` - Repository not linked

---

### 10. Get Sync History for Linked Repository

**Endpoint:** `GET /api/v1/github/repos/:repo_id/sync-logs`

**Description:** Retrieves synchronization history for a linked GitHub repository.

**Permissions Required:** `project:read` (any role)

**Path Parameters:**
- `repo_id` (integer, required) - GitHub repository ID

**Query Parameters:**
```typescript
interface SyncLogsParams extends PaginationParams {
  // Pagination inherited: page, per_page
}
```

**Example Request:**
```
GET /api/v1/github/repos/12345/sync-logs?page=1&per_page=20
```

**Success Response (200 OK):**
```typescript
interface SyncLogsResponse {
  logs: SyncLog[];
  total_count: number;
  page: number;
  per_page: number;
}

interface SyncLog {
  id: string;                      // UUID
  sync_type: 'manual' | 'automatic';
  sync_status: 'success' | 'partial' | 'failed';
  secrets_imported: number;
  secrets_skipped: number;
  secrets_failed: number;
  imported_files: string[];
  user_email: string;              // User who triggered sync
  started_at: string;              // ISO 8601 timestamp
  completed_at: string;            // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "logs": [
    {
      "id": "880fb700-h59e-74g7-d049-779988773333",
      "sync_type": "manual",
      "sync_status": "success",
      "secrets_imported": 15,
      "secrets_skipped": 3,
      "secrets_failed": 0,
      "imported_files": [".env", ".env.production"],
      "user_email": "user@example.com",
      "started_at": "2025-11-04T10:00:00Z",
      "completed_at": "2025-11-04T10:00:05Z"
    },
    {
      "id": "990gc800-i69f-85h8-e150-880099884444",
      "sync_type": "automatic",
      "sync_status": "partial",
      "secrets_imported": 12,
      "secrets_skipped": 5,
      "secrets_failed": 2,
      "imported_files": [".env", "package.json"],
      "user_email": "system",
      "started_at": "2025-11-03T15:00:00Z",
      "completed_at": "2025-11-03T15:00:08Z"
    }
  ],
  "total_count": 42,
  "page": 1,
  "per_page": 20
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - No access to repository
- `404 Not Found` - Repository not linked

---

## Error Handling

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  error: string;          // Error code (snake_case)
  message: string;        // Human-readable error message
  details?: object;       // Additional error details (optional)
  request_id?: string;    // Request ID for debugging (optional)
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `validation_error` | Input validation failed |
| 400 | `invalid_request` | Malformed request |
| 401 | `unauthorized` | Missing or invalid authentication |
| 403 | `forbidden` | Insufficient permissions |
| 403 | `insufficient_permissions` | User lacks required GitHub permissions |
| 404 | `not_found` | Resource not found |
| 404 | `connection_not_found` | No GitHub connection exists |
| 404 | `repo_not_linked` | Repository not linked to Abyrith |
| 409 | `conflict` | Resource conflict |
| 409 | `connection_exists` | GitHub account already connected |
| 409 | `repo_already_linked` | Repository already linked |
| 429 | `rate_limit_exceeded` | Too many requests |
| 502 | `github_api_error` | GitHub API error |
| 503 | `service_unavailable` | Service unavailable |
| 503 | `github_api_unavailable` | GitHub API unavailable |

### Error Handling Best Practices

**Client-side handling:**
1. Always check HTTP status code first
2. Parse error response body for `error` code
3. Display user-friendly error messages from `message` field
4. Log full error details including `request_id` for debugging
5. Implement exponential backoff for 429 errors
6. Handle GitHub-specific errors (502, 503) with retry logic

---

## Rate Limiting

### Rate Limit Rules

**Per User:**
- OAuth endpoints: 10 requests/hour
- Sync endpoints: 20 requests/hour per repository
- List repos: 60 requests/hour (GitHub API limit)
- Preview: 60 requests/hour

**Per Organization:**
- Total GitHub API calls: 5,000 requests/hour (GitHub authenticated API limit)

### Rate Limit Headers

Response includes these headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635789600
X-RateLimit-Resource: github:oauth
```

### Rate Limit Exceeded Response

```json
HTTP/1.1 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded for GitHub OAuth endpoints. Try again in 30 minutes.",
  "retry_after": 1800,
  "resource": "github:oauth"
}
```

---

## Examples

### Example 1: Complete GitHub Integration Workflow

**Scenario:** Connect GitHub account and link repository to new project

**Step 1: Initiate OAuth flow**
```bash
curl -X POST https://api.abyrith.com/v1/github/connect \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "redirect_uri": "https://app.abyrith.com/github/callback",
    "scopes": ["repo", "read:org"]
  }'
```

**Response:**
```json
{
  "oauth_url": "https://github.com/login/oauth/authorize?...",
  "state": "random_state_token_xyz"
}
```

**Step 2: User authorizes on GitHub (browser redirect)**

**Step 3: Handle callback**
```bash
curl -X POST https://api.abyrith.com/v1/github/callback \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "github_oauth_code",
    "state": "random_state_token_xyz"
  }'
```

**Response:**
```json
{
  "connection_id": "550e8400-e29b-41d4-a716-446655440000",
  "github_username": "user123",
  "github_user_id": 12345678,
  "scopes": ["repo", "read:org"],
  "expires_at": null
}
```

**Step 4: List repositories**
```bash
curl -X GET https://api.abyrith.com/v1/github/repos?page=1&per_page=30&sort=updated \
  -H "Authorization: Bearer {token}"
```

**Step 5: Link repository**
```bash
curl -X POST https://api.abyrith.com/v1/github/repos/link \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": 12345,
    "repo_owner": "user123",
    "repo_name": "my-app",
    "repo_url": "https://github.com/user123/my-app",
    "action": "create_project",
    "project_name": "My App Backend",
    "write_marker_file": true,
    "sync_config": {
      "env_files": true,
      "github_actions": true,
      "dependencies": true
    }
  }'
```

**Response:**
```json
{
  "linked_repo_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_id": "660e9500-f39c-52e5-b827-557766551111",
  "project_name": "My App Backend",
  "abyrith_identifier": "770ea600-g49d-63f6-c938-668877662222",
  "marker_file_created": true,
  "repo_variable_created": true
}
```

---

### Example 2: Preview and Sync Secrets

**Scenario:** Preview secrets before importing

**Step 1: Preview secrets**
```bash
curl -X GET "https://api.abyrith.com/v1/github/repos/12345/preview?sources=env_files&files=.env,.env.production" \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
{
  "secrets": [
    {
      "key_name": "DATABASE_URL",
      "source_file": ".env.production",
      "source_type": "env_file",
      "exists_in_abyrith": true,
      "collision": true
    },
    {
      "key_name": "STRIPE_API_KEY",
      "source_file": ".env",
      "source_type": "env_file",
      "exists_in_abyrith": false,
      "collision": false
    }
  ],
  "total_secrets": 15,
  "collisions": 3,
  "files_scanned": [".env", ".env.production"]
}
```

**Step 2: Sync with skip collision strategy**
```bash
curl -X POST https://api.abyrith.com/v1/github/repos/12345/sync \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["env_files"],
    "collision_strategy": "skip",
    "files": [".env", ".env.production"]
  }'
```

**Response:**
```json
{
  "sync_log_id": "880fb700-h59e-74g7-d049-779988773333",
  "status": "success",
  "secrets_imported": 12,
  "secrets_skipped": 3,
  "secrets_failed": 0,
  "imported_files": [".env", ".env.production"],
  "details": [...]
}
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `04-database/schemas/github-connections.md` - Database schema for storing GitHub connections and linked repositories
- [ ] `06-backend/integrations/github-api-integration.md` - GitHub API client implementation
- [ ] `03-security/security-model.md` - Encryption specifications for storing GitHub access tokens
- [ ] `05-api/api-rest-design.md` - API design patterns

**Related APIs:**
- `05-api/endpoints/secrets-endpoints.md` - Secrets API for storing imported secrets
- `05-api/endpoints/projects-endpoints.md` - Projects API for linking repositories to projects

---

## References

### Internal Documentation
- `05-api/api-rest-design.md` - REST API patterns and standards
- `04-database/schemas/github-connections.md` - Database schema
- `06-backend/integrations/github-api-integration.md` - GitHub API client
- `03-security/security-model.md` - Encryption architecture
- `TECH-STACK.md` - Technology stack specifications
- `GLOSSARY.md` - Term definitions

### External Resources
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps) - OAuth flow
- [GitHub REST API](https://docs.github.com/en/rest) - API reference
- [GitHub API Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting) - Rate limits

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-04 | Backend Engineering | Initial GitHub integration API documentation |

---

## Notes

### Implementation Priorities

**MVP (Phase 1):**
- OAuth connection flow (endpoints 1-4)
- List repositories (endpoint 5)
- Link repository to project (endpoint 6)
- Manual sync (endpoint 8)
- Preview secrets (endpoint 9)

**Post-MVP:**
- Automatic sync triggers (webhooks from GitHub)
- Sync scheduling (daily/weekly)
- Advanced collision strategies (smart merge)
- Bidirectional sync (push secrets to GitHub)

### Known Limitations

- GitHub access tokens are stored encrypted but not refreshed (OAuth apps don't expire)
- Manual sync only (automatic sync requires webhook setup)
- Maximum 100 repositories per page (GitHub API limit)
- No support for GitHub Enterprise Server (Cloud only)

### Future Enhancements

- **Automatic Sync:** Trigger sync on GitHub push events via webhooks
- **Sync Scheduling:** Configure daily/weekly automatic sync
- **Conflict Resolution UI:** Visual diff tool for resolving secret collisions
- **Bidirectional Sync:** Push Abyrith secrets back to GitHub repository variables
- **GitHub Enterprise Server:** Support for self-hosted GitHub instances
- **Organization-level Integration:** Connect entire GitHub organizations
- **Advanced Filtering:** Sync only specific directories or file patterns
