---
Document: Secrets Management - API Endpoint Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 05-api/api-rest-design.md, 04-database/schemas/secrets-metadata.md, 03-security/security-model.md, GLOSSARY.md
---

# Secrets Management API Endpoints

## Overview

These endpoints manage encrypted secrets with zero-knowledge architecture. All secret values are encrypted client-side before transmission to the server, and the server never has access to unencrypted secret values. These endpoints handle the storage, retrieval, updating, and deletion of secrets within projects and environments.

**Base URL:** `https://api.abyrith.com/v1`

**Resource:** Secrets (encrypted credentials stored within projects and environments)

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
  sub: string;        // User ID (UUID)
  email: string;      // User email
  org_id?: string;    // Organization ID (if applicable)
  role: string;       // User role
  iat: number;        // Issued at (Unix timestamp)
  exp: number;        // Expiration (Unix timestamp)
}
```

### Obtaining Tokens

See `05-api/endpoints/auth-endpoints.md` for token acquisition flows.

**Token Refresh:**
Tokens expire after 1 hour. Use the refresh token endpoint to obtain a new access token without re-authentication.

---

## Common Patterns

### Pagination

**Query Parameters:**
```typescript
interface PaginationParams {
  page?: number;      // Page number (default: 1, min: 1)
  per_page?: number;  // Items per page (default: 20, min: 1, max: 100)
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
  environment_id?: string;   // Filter by environment UUID
  service_name?: string;     // Filter by service name
  tags?: string;             // Comma-separated tags (AND logic)
  search?: string;           // Search in key_name, service_name, description
}
```

**Example:**
```
GET /secrets?environment_id=env-uuid&tags=production,critical
```

### Sorting

**Query Parameter:**
```
sort=[field]:[asc|desc]
```

**Supported sort fields:**
- `created_at` (default)
- `updated_at`
- `key_name`
- `last_accessed_at`

**Example:**
```
GET /secrets?sort=updated_at:desc
```

---

## Endpoints

### 1. Create Secret

**Endpoint:** `POST /secrets`

**Description:** Creates a new encrypted secret within a project and environment. Secret value must be encrypted client-side before transmission.

**Permissions Required:** `secrets.create` (Owner, Admin, Developer roles)

**Request:**
```typescript
interface CreateSecretRequest {
  project_id: string;           // UUID of the project
  environment_id: string;       // UUID of the environment
  key_name: string;             // Secret identifier (e.g., "OPENAI_API_KEY")
  encrypted_value: string;      // Base64-encoded encrypted value
  encrypted_dek: string;        // Base64-encoded encrypted Data Encryption Key
  secret_nonce: string;         // Base64-encoded 12-byte nonce for secret
  dek_nonce: string;            // Base64-encoded 12-byte nonce for DEK
  auth_tag: string;             // Base64-encoded 16-byte authentication tag
  service_name?: string;        // Service name (e.g., "OpenAI", "Stripe")
  description?: string;         // Human-readable description
  tags?: string[];              // Array of tags for organization
  documentation_url?: string;   // Link to service documentation
}
```

**Example Request:**
```json
POST /secrets
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "environment_id": "660e8400-e29b-41d4-a716-446655440000",
  "key_name": "OPENAI_API_KEY",
  "encrypted_value": "YmFzZTY0LWVuY3J5cHRlZC12YWx1ZQ==",
  "encrypted_dek": "ZGVrLWVuY3J5cHRlZC13aXRoLW1hc3Rlci1rZXk=",
  "secret_nonce": "MTItYnl0ZS1ub25jZQ==",
  "dek_nonce": "ZGVrLW5vbmNlLTEyYnl0ZXM=",
  "auth_tag": "YXV0aC10YWctMTZieXRlcw==",
  "service_name": "OpenAI",
  "description": "Production API key for OpenAI GPT-4",
  "tags": ["production", "ai", "critical"],
  "documentation_url": "https://platform.openai.com/docs/api-reference"
}
```

**Success Response (201 Created):**
```typescript
interface CreateSecretResponse {
  id: string;                   // Secret UUID
  project_id: string;
  environment_id: string;
  key_name: string;
  service_name: string | null;
  description: string | null;
  tags: string[];
  documentation_url: string | null;
  version: number;
  created_at: string;           // ISO 8601 timestamp
  updated_at: string;           // ISO 8601 timestamp
  created_by: string;           // User UUID
  last_accessed_at: string | null;
  last_rotated_at: string | null;
}
```

**Example Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "environment_id": "660e8400-e29b-41d4-a716-446655440000",
  "key_name": "OPENAI_API_KEY",
  "service_name": "OpenAI",
  "description": "Production API key for OpenAI GPT-4",
  "tags": ["production", "ai", "critical"],
  "documentation_url": "https://platform.openai.com/docs/api-reference",
  "version": 1,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z",
  "created_by": "440e8400-e29b-41d4-a716-446655440000",
  "last_accessed_at": null,
  "last_rotated_at": null
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": "validation_error",
    "message": "Invalid encryption data format",
    "details": {
      "secret_nonce": ["must be exactly 12 bytes when decoded"],
      "encrypted_value": ["is required"]
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions (user is read-only)
- `404 Not Found` - Project or environment doesn't exist or user doesn't have access
- `409 Conflict` - Secret with same key_name already exists in this project/environment
  ```json
  {
    "error": "conflict",
    "message": "Secret with key_name 'OPENAI_API_KEY' already exists in this environment",
    "details": {
      "existing_secret_id": "770e8400-e29b-41d4-a716-446655440000"
    }
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `project_id`: Required, valid UUID, user must have access
- `environment_id`: Required, valid UUID, must belong to specified project
- `key_name`: Required, max 255 characters, alphanumeric + underscores
- `encrypted_value`: Required, valid base64-encoded string
- `encrypted_dek`: Required, valid base64-encoded string
- `secret_nonce`: Required, must decode to exactly 12 bytes
- `dek_nonce`: Required, must decode to exactly 12 bytes
- `auth_tag`: Required, valid base64-encoded string
- `service_name`: Optional, max 255 characters
- `description`: Optional, max 5000 characters
- `tags`: Optional, array of strings, each max 50 characters
- `documentation_url`: Optional, valid URL format

---

### 2. Get Secret by ID

**Endpoint:** `GET /secrets/:id`

**Description:** Retrieves a secret's encrypted value and metadata. Client must decrypt the value using their master key.

**Permissions Required:** `secrets.read` (Owner, Admin, Developer, Read-Only roles)

**Path Parameters:**
- `id` (string, required) - Secret ID (UUID)

**Success Response (200 OK):**
```typescript
interface GetSecretResponse {
  id: string;
  project_id: string;
  environment_id: string;
  key_name: string;
  service_name: string | null;
  encrypted_value: string;      // Base64-encoded encrypted value
  encrypted_dek: string;        // Base64-encoded encrypted DEK
  secret_nonce: string;         // Base64-encoded nonce
  dek_nonce: string;            // Base64-encoded DEK nonce
  auth_tag: string;             // Base64-encoded authentication tag
  description: string | null;
  tags: string[];
  documentation_url: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_accessed_at: string | null;
  last_rotated_at: string | null;
}
```

**Example Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "environment_id": "660e8400-e29b-41d4-a716-446655440000",
  "key_name": "OPENAI_API_KEY",
  "service_name": "OpenAI",
  "encrypted_value": "YmFzZTY0LWVuY3J5cHRlZC12YWx1ZQ==",
  "encrypted_dek": "ZGVrLWVuY3J5cHRlZC13aXRoLW1hc3Rlci1rZXk=",
  "secret_nonce": "MTItYnl0ZS1ub25jZQ==",
  "dek_nonce": "ZGVrLW5vbmNlLTEyYnl0ZXM=",
  "auth_tag": "YXV0aC10YWctMTZieXRlcw==",
  "description": "Production API key for OpenAI GPT-4",
  "tags": ["production", "ai", "critical"],
  "documentation_url": "https://platform.openai.com/docs/api-reference",
  "version": 1,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z",
  "created_by": "440e8400-e29b-41d4-a716-446655440000",
  "last_accessed_at": "2025-10-30T14:30:00Z",
  "last_rotated_at": null
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this secret's project
- `404 Not Found` - Secret doesn't exist
- `500 Internal Server Error` - Server error

**Side Effects:**
- Updates `last_accessed_at` timestamp in the database
- Logs access event in audit log (see `04-database/schemas/audit-logs.md`)

---

### 3. List Secrets

**Endpoint:** `GET /projects/:project_id/secrets`

**Description:** Lists all secrets within a project, optionally filtered by environment, service, tags, or search query. Returns metadata only by default; use individual GET to retrieve encrypted values.

**Permissions Required:** `secrets.read` (Owner, Admin, Developer, Read-Only roles)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)

**Query Parameters:**
```typescript
interface ListSecretsParams extends PaginationParams {
  environment_id?: string;    // Filter by specific environment
  service_name?: string;      // Filter by service name
  tags?: string;              // Comma-separated tags (AND logic)
  search?: string;            // Search in key_name, service_name, description
  sort?: string;              // Sort field and direction (e.g., "updated_at:desc")
  include_encrypted?: boolean; // Include encrypted values (default: false)
}
```

**Success Response (200 OK):**
```typescript
interface ListSecretsResponse {
  data: SecretListItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface SecretListItem {
  id: string;
  project_id: string;
  environment_id: string;
  key_name: string;
  service_name: string | null;
  description: string | null;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  last_rotated_at: string | null;
  // Encrypted fields only included if include_encrypted=true
  encrypted_value?: string;
  encrypted_dek?: string;
  secret_nonce?: string;
  dek_nonce?: string;
  auth_tag?: string;
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "environment_id": "660e8400-e29b-41d4-a716-446655440000",
      "key_name": "OPENAI_API_KEY",
      "service_name": "OpenAI",
      "description": "Production API key for OpenAI GPT-4",
      "tags": ["production", "ai", "critical"],
      "version": 1,
      "created_at": "2025-10-30T12:00:00Z",
      "updated_at": "2025-10-30T12:00:00Z",
      "last_accessed_at": "2025-10-30T14:30:00Z",
      "last_rotated_at": null
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "environment_id": "660e8400-e29b-41d4-a716-446655440000",
      "key_name": "STRIPE_SECRET_KEY",
      "service_name": "Stripe",
      "description": "Stripe payment processing key",
      "tags": ["production", "payment"],
      "version": 2,
      "created_at": "2025-10-29T10:00:00Z",
      "updated_at": "2025-10-30T09:15:00Z",
      "last_accessed_at": "2025-10-30T13:00:00Z",
      "last_rotated_at": "2025-10-30T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this project
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Server error

**Performance Notes:**
- Listing with `include_encrypted=true` is slower due to larger payload
- Use pagination for large projects (100+ secrets)
- Search queries use database indexes on `key_name`, `service_name`, and tags

---

### 4. Update Secret

**Endpoint:** `PUT /secrets/:id`

**Description:** Updates a secret's encrypted value and/or metadata. When updating the encrypted value, all encryption fields must be provided. Increments version number and updates `last_rotated_at` timestamp.

**Permissions Required:** `secrets.update` (Owner, Admin, Developer roles)

**Path Parameters:**
- `id` (string, required) - Secret ID (UUID)

**Request:**
```typescript
interface UpdateSecretRequest {
  // Encryption fields (all required if updating encrypted value)
  encrypted_value?: string;
  encrypted_dek?: string;
  secret_nonce?: string;
  dek_nonce?: string;
  auth_tag?: string;

  // Metadata fields (optional)
  key_name?: string;
  service_name?: string;
  description?: string;
  tags?: string[];
  documentation_url?: string;
}
```

**Example Request (Rotate Secret Value):**
```json
PUT /secrets/770e8400-e29b-41d4-a716-446655440000
{
  "encrypted_value": "bmV3LWVuY3J5cHRlZC12YWx1ZQ==",
  "encrypted_dek": "bmV3LWVuY3J5cHRlZC1kZWs=",
  "secret_nonce": "bmV3LW5vbmNlLTEyYg==",
  "dek_nonce": "bmV3LWRlay1ub25jZQ==",
  "auth_tag": "bmV3LWF1dGgtdGFnMTY=",
  "description": "Rotated production API key for OpenAI GPT-4"
}
```

**Example Request (Update Metadata Only):**
```json
PUT /secrets/770e8400-e29b-41d4-a716-446655440000
{
  "tags": ["production", "ai", "critical", "gpt4"],
  "description": "Updated description"
}
```

**Success Response (200 OK):**
```typescript
interface UpdateSecretResponse {
  id: string;
  project_id: string;
  environment_id: string;
  key_name: string;
  service_name: string | null;
  description: string | null;
  tags: string[];
  documentation_url: string | null;
  version: number;              // Incremented if encrypted_value changed
  created_at: string;
  updated_at: string;           // Updated to current timestamp
  created_by: string;
  last_accessed_at: string | null;
  last_rotated_at: string | null; // Updated to current timestamp if encrypted_value changed
}
```

**Example Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "environment_id": "660e8400-e29b-41d4-a716-446655440000",
  "key_name": "OPENAI_API_KEY",
  "service_name": "OpenAI",
  "description": "Rotated production API key for OpenAI GPT-4",
  "tags": ["production", "ai", "critical"],
  "documentation_url": "https://platform.openai.com/docs/api-reference",
  "version": 2,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T16:45:00Z",
  "created_by": "440e8400-e29b-41d4-a716-446655440000",
  "last_accessed_at": "2025-10-30T14:30:00Z",
  "last_rotated_at": "2025-10-30T16:45:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": "validation_error",
    "message": "If updating encrypted_value, all encryption fields must be provided",
    "details": {
      "missing_fields": ["encrypted_dek", "secret_nonce"]
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions (user is read-only)
- `404 Not Found` - Secret doesn't exist
- `409 Conflict` - Concurrent update detected (version mismatch)
  ```json
  {
    "error": "conflict",
    "message": "Secret has been modified by another user",
    "details": {
      "current_version": 3,
      "attempted_version": 2
    }
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- If any encryption field is provided, ALL encryption fields must be provided
- `key_name`: Max 255 characters, alphanumeric + underscores
- `service_name`: Max 255 characters
- `description`: Max 5000 characters
- `tags`: Array of strings, each max 50 characters
- `documentation_url`: Valid URL format

**Side Effects:**
- Increments `version` number if encrypted value changed
- Updates `last_rotated_at` if encrypted value changed
- Updates `updated_at` timestamp
- Logs update event in audit log

---

### 5. Delete Secret

**Endpoint:** `DELETE /secrets/:id`

**Description:** Permanently deletes a secret. This action cannot be undone. Consider archiving or moving to a different environment instead of deleting.

**Permissions Required:** `secrets.delete` (Owner, Admin roles only)

**Path Parameters:**
- `id` (string, required) - Secret ID (UUID)

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions (developers and read-only cannot delete)
  ```json
  {
    "error": "forbidden",
    "message": "Only organization owners and admins can delete secrets",
    "details": {
      "required_roles": ["owner", "admin"],
      "user_role": "developer"
    }
  }
  ```
- `404 Not Found` - Secret doesn't exist
- `409 Conflict` - Cannot delete due to active MCP access grants
  ```json
  {
    "error": "conflict",
    "message": "Cannot delete secret while it has active MCP access grants",
    "details": {
      "active_grants": 2,
      "expires_at": "2025-10-30T18:00:00Z"
    }
  }
  ```
- `500 Internal Server Error` - Server error

**Side Effects:**
- Permanently removes secret from database
- Cascades to delete related `secret_metadata` records
- Logs deletion event in audit log
- Invalidates any active MCP access grants for this secret

**Important Notes:**
- Deletion is permanent and cannot be undone
- Consider using archive flag or moving to "archived" environment instead
- Deleted secrets cannot be recovered from backups in production (zero-knowledge architecture)

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
| 400 | `encryption_error` | Invalid encryption data format |
| 401 | `unauthorized` | Missing or invalid authentication |
| 401 | `token_expired` | JWT token has expired |
| 403 | `forbidden` | Insufficient permissions |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Resource conflict (duplicate key_name, version mismatch) |
| 409 | `active_grants` | Cannot delete due to active access grants |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |
| 503 | `service_unavailable` | Service temporarily unavailable |

### Error Handling Best Practices

**Client-side handling:**
1. Always check HTTP status code first
2. Parse error response body for details
3. Display user-friendly error messages
4. Log full error details for debugging
5. Implement exponential backoff for 429 errors
6. Handle 401 errors by refreshing token or re-authenticating
7. For 409 version conflicts, fetch latest version and retry

**Example Error Handler:**
```typescript
async function handleSecretRequest(secretId: string) {
  try {
    const response = await fetch(`/secrets/${secretId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.json();

      switch (response.status) {
        case 401:
          // Refresh token and retry
          await refreshAuthToken();
          return handleSecretRequest(secretId);

        case 404:
          console.error('Secret not found');
          break;

        case 429:
          // Exponential backoff
          await delay(error.retry_after * 1000);
          return handleSecretRequest(secretId);

        default:
          console.error('API error:', error);
      }

      throw new Error(error.message);
    }

    return await response.json();
  } catch (err) {
    console.error('Request failed:', err);
    throw err;
  }
}
```

---

## Rate Limiting

### Rate Limit Rules

**Per User (Authenticated):**
- 100 requests per minute across all endpoints
- 1000 requests per hour across all endpoints

**Per IP Address (Unauthenticated):**
- 20 requests per minute
- Used for login/signup endpoints

**Per Endpoint Specific Limits:**
- `POST /secrets`: 20 creates per minute (prevent bulk uploads)
- `GET /secrets/:id`: 200 reads per minute (higher limit for decryption operations)
- `DELETE /secrets/:id`: 10 deletes per minute (destructive operation)

### Rate Limit Headers

Response includes these headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698764400
```

**Header Meanings:**
- `X-RateLimit-Limit`: Maximum requests allowed in window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

### Rate Limit Exceeded Response

```json
HTTP/1.1 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 30 seconds.",
  "retry_after": 30,
  "details": {
    "limit": 100,
    "window": "minute",
    "reset_at": "2025-10-30T12:01:00Z"
  }
}
```

**Client Implementation:**
```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  // Retry request
}
```

---

## Examples

### Example 1: Complete Secret Creation Flow

**Scenario:** User creates a new OpenAI API key secret in production environment

**Step 1: Client-side encryption**
```typescript
// Client-side TypeScript
import { encrypt } from './crypto';

// User's plaintext secret
const plaintextSecret = 'sk-proj-abc123xyz...';

// Derive master key from user's password (done at login)
const masterKey = await deriveMasterKey(userPassword);

// Generate random DEK for this secret
const dek = crypto.getRandomValues(new Uint8Array(32)); // 256-bit key

// Encrypt secret value with DEK
const { encryptedValue, nonce, authTag } = await encrypt(
  plaintextSecret,
  dek
);

// Encrypt DEK with master key
const { encryptedDek, dekNonce, dekAuthTag } = await encrypt(
  dek,
  masterKey
);

// Prepare API request
const requestBody = {
  project_id: projectId,
  environment_id: productionEnvId,
  key_name: 'OPENAI_API_KEY',
  encrypted_value: btoa(encryptedValue),
  encrypted_dek: btoa(encryptedDek),
  secret_nonce: btoa(nonce),
  dek_nonce: btoa(dekNonce),
  auth_tag: btoa(authTag),
  service_name: 'OpenAI',
  description: 'Production API key for GPT-4',
  tags: ['production', 'ai', 'critical']
};
```

**Step 2: Send API request**
```bash
curl -X POST https://api.abyrith.com/v1/secrets \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "environment_id": "660e8400-e29b-41d4-a716-446655440000",
    "key_name": "OPENAI_API_KEY",
    "encrypted_value": "YmFzZTY0LWVuY3J5cHRlZC12YWx1ZQ==",
    "encrypted_dek": "ZGVrLWVuY3J5cHRlZC13aXRoLW1hc3Rlci1rZXk=",
    "secret_nonce": "MTItYnl0ZS1ub25jZQ==",
    "dek_nonce": "ZGVrLW5vbmNlLTEyYnl0ZXM=",
    "auth_tag": "YXV0aC10YWctMTZieXRlcw==",
    "service_name": "OpenAI",
    "description": "Production API key for GPT-4",
    "tags": ["production", "ai", "critical"]
  }'
```

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "environment_id": "660e8400-e29b-41d4-a716-446655440000",
  "key_name": "OPENAI_API_KEY",
  "service_name": "OpenAI",
  "description": "Production API key for GPT-4",
  "tags": ["production", "ai", "critical"],
  "documentation_url": null,
  "version": 1,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z",
  "created_by": "440e8400-e29b-41d4-a716-446655440000",
  "last_accessed_at": null,
  "last_rotated_at": null
}
```

---

### Example 2: Retrieve and Decrypt Secret

**Scenario:** User retrieves secret to use in their application

**Step 1: Fetch encrypted secret**
```bash
curl -X GET https://api.abyrith.com/v1/secrets/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "encrypted_value": "YmFzZTY0LWVuY3J5cHRlZC12YWx1ZQ==",
  "encrypted_dek": "ZGVrLWVuY3J5cHRlZC13aXRoLW1hc3Rlci1rZXk=",
  "secret_nonce": "MTItYnl0ZS1ub25jZQ==",
  "dek_nonce": "ZGVrLW5vbmNlLTEyYnl0ZXM=",
  "auth_tag": "YXV0aC10YWctMTZieXRlcw==",
  ...
}
```

**Step 2: Client-side decryption**
```typescript
// Client-side TypeScript
import { decrypt } from './crypto';

// Decode base64 values
const encryptedValue = atob(response.encrypted_value);
const encryptedDek = atob(response.encrypted_dek);
const nonce = atob(response.secret_nonce);
const dekNonce = atob(response.dek_nonce);
const authTag = atob(response.auth_tag);

// Decrypt DEK with user's master key
const dek = await decrypt(
  encryptedDek,
  masterKey,
  dekNonce,
  authTag
);

// Decrypt secret value with DEK
const plaintextSecret = await decrypt(
  encryptedValue,
  dek,
  nonce,
  authTag
);

console.log('Decrypted secret:', plaintextSecret);
// Output: "sk-proj-abc123xyz..."
```

---

### Example 3: List and Filter Secrets

**Scenario:** List all production secrets for a project, sorted by last access

```bash
curl -X GET "https://api.abyrith.com/v1/projects/550e8400-e29b-41d4-a716-446655440000/secrets?tags=production&sort=last_accessed_at:desc&per_page=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "key_name": "OPENAI_API_KEY",
      "service_name": "OpenAI",
      "tags": ["production", "ai", "critical"],
      "last_accessed_at": "2025-10-30T14:30:00Z"
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "key_name": "STRIPE_SECRET_KEY",
      "service_name": "Stripe",
      "tags": ["production", "payment"],
      "last_accessed_at": "2025-10-30T13:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### Example 4: Rotate Secret (Update Encrypted Value)

**Scenario:** Rotate an API key by generating new encrypted value

```bash
curl -X PUT https://api.abyrith.com/v1/secrets/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted_value": "bmV3LWVuY3J5cHRlZC12YWx1ZQ==",
    "encrypted_dek": "bmV3LWVuY3J5cHRlZC1kZWs=",
    "secret_nonce": "bmV3LW5vbmNlLTEyYg==",
    "dek_nonce": "bmV3LWRlay1ub25jZQ==",
    "auth_tag": "bmV3LWF1dGgtdGFnMTY=",
    "description": "Rotated on 2025-10-30 (previous key compromised)"
  }'
```

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "version": 2,
  "updated_at": "2025-10-30T16:45:00Z",
  "last_rotated_at": "2025-10-30T16:45:00Z",
  ...
}
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/secrets-metadata.md` - Database schema definition
- [x] `03-security/rbac/permissions-model.md` - Permission definitions
- [x] `05-api/api-rest-design.md` - API design patterns
- [x] `03-security/security-model.md` - Zero-knowledge encryption specification

**Related APIs:**
- `05-api/endpoints/projects-endpoints.md` - Project management (projects and environments must exist before creating secrets)
- `05-api/endpoints/auth-endpoints.md` - Authentication and JWT token management
- `04-database/schemas/audit-logs.md` - Audit logging for secret access events

---

## References

### Internal Documentation
- `05-api/api-rest-design.md` - REST API patterns and conventions
- `03-security/auth/authentication-flow.md` - Authentication details
- `03-security/security-model.md` - Zero-knowledge encryption architecture
- `04-database/schemas/secrets-metadata.md` - Database schema for secrets
- `TECH-STACK.md` - Technology stack (Cloudflare Workers, Supabase)
- `GLOSSARY.md` - Term definitions (Secret, DEK, Zero-Knowledge, etc.)

### External Resources
- [OpenAPI Specification](https://swagger.io/specification/) - API specification standard
- [REST API Best Practices](https://restfulapi.net/) - REST patterns
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Client-side encryption
- [AES-GCM Mode](https://en.wikipedia.org/wiki/Galois/Counter_Mode) - Encryption algorithm details

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial API endpoint documentation for secrets management |

---

## Notes

### Security Considerations

**Zero-Knowledge Architecture:**
- Server NEVER has access to unencrypted secret values
- All encryption/decryption happens client-side
- Server only stores encrypted blobs and plaintext metadata
- Even if database is compromised, secrets remain secure (without user master password)

**Encryption Implementation:**
- Use Web Crypto API in browser for AES-256-GCM
- Generate fresh nonces for every encryption operation (never reuse)
- Use envelope encryption: encrypt secret with DEK, encrypt DEK with master key
- Validate nonce length (exactly 12 bytes) before storing

**Rate Limiting:**
- Implement rate limiting at Cloudflare Workers layer
- Use Workers KV for distributed rate limit state
- Consider per-project rate limits for enterprise customers

### Performance Optimizations

**Caching:**
- Cache project membership checks at edge (Workers KV)
- Cache JWT verification results for 5 minutes
- Don't cache encrypted secret values (security risk)

**Database:**
- Use indexes on `(project_id, environment_id)` for fast secret listing
- Use GIN index on `tags` array for fast tag filtering
- Partial index on `last_accessed_at` for stale secret queries

**Payload Size:**
- List endpoint returns metadata only by default (faster, smaller)
- Use `include_encrypted=true` query param only when needed
- Consider pagination for projects with 100+ secrets

### Future Enhancements

**Planned Features:**
- Secret versioning history (track all previous values)
- Secret expiration and auto-rotation
- Bulk operations (create/update multiple secrets)
- Secret templates (pre-filled metadata for common services)
- Advanced filtering (created_by, date ranges)
- Export secrets in various formats (.env, JSON, YAML)
- Secret sharing with time-limited access links

### Known Limitations

**Current Limitations:**
- No bulk operations (must create/update secrets one at a time)
- No secret history (only current version stored)
- No secret expiration or auto-rotation
- Search is case-sensitive (improve with PostgreSQL full-text search)
- Maximum secret value size: 64KB encrypted
