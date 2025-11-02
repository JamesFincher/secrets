---
Document: Audit Logs API Endpoints - API Endpoint Documentation
Version: 1.0.0
Last Updated: 2025-11-02
Owner: Backend Engineering
Status: Draft
Dependencies: 04-database/schemas/audit-logs.md, 05-api/api-rest-design.md, 08-features/audit-logs/audit-logs-overview.md, TECH-STACK.md, GLOSSARY.md
---

# Audit Logs API Endpoints

## Overview

This document defines all audit logging and compliance API endpoints for Abyrith. These endpoints provide comprehensive access to immutable audit trails, enabling security monitoring, compliance reporting (SOC 2, ISO 27001, GDPR), and forensic investigation. All endpoints enforce Row-Level Security (RLS) to ensure users can only access audit logs they are authorized to view.

**Base URL:** `https://api.abyrith.com/v1`

**Resource:** Audit Logs, Access Events, MCP Requests

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
  org_id?: string;    // Primary organization ID
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
  per_page?: number;  // Items per page (default: 50, max: 100)
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
  user_id?: string;           // Filter by user (admin only)
  event_type?: string;        // Filter by event type
  event_category?: string;    // Filter by category (secret, auth, project, etc.)
  resource_type?: string;     // Filter by resource type
  resource_id?: string;       // Filter by specific resource UUID
  start_date?: string;        // ISO 8601 timestamp (inclusive)
  end_date?: string;          // ISO 8601 timestamp (exclusive)
  success?: boolean;          // Filter by success/failure
}
```

**Example:**
```
GET /audit-logs?event_type=secret.read&start_date=2025-10-01T00:00:00Z&per_page=50
```

### Sorting

**Query Parameter:**
```
sort=created_at:desc
```

Default: `created_at:desc` (most recent first)

---

## Endpoints

### 1. List Audit Logs

**Endpoint:** `GET /audit-logs`

**Description:** Retrieve audit logs with filtering, sorting, and pagination. Users see their own logs; Admins/Owners see organization-wide logs.

**Permissions Required:** `authenticated` (RLS enforces scope)

**Query Parameters:**
```typescript
interface ListAuditLogsParams {
  // Pagination
  page?: number;              // Page number (default: 1)
  per_page?: number;          // Items per page (default: 50, max: 100)

  // Filters
  user_id?: string;           // Filter by user UUID (Admin/Owner only)
  event_type?: string;        // Filter by event type (e.g., 'secret.read')
  event_category?: string;    // Filter by category ('secret', 'auth', 'project', 'member', 'mcp')
  resource_type?: string;     // Filter by resource type ('secret', 'project', 'organization', 'member')
  resource_id?: string;       // Filter by specific resource UUID
  start_date?: string;        // ISO 8601 timestamp (inclusive)
  end_date?: string;          // ISO 8601 timestamp (exclusive)
  success?: boolean;          // Filter by success/failure

  // Sorting
  sort?: string;              // Sort field:direction (default: 'created_at:desc')
}
```

**Example Request:**
```http
GET /audit-logs?event_type=secret.read&start_date=2025-10-01T00:00:00Z&per_page=50&page=1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface ListAuditLogsResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface AuditLogEntry {
  id: string;                 // UUID
  user_id: string;            // User who performed action
  organization_id?: string;   // Organization context (null for personal actions)
  project_id?: string;        // Project context (null if not project-specific)
  secret_id?: string;         // Secret context (null if not secret-specific)
  event_type: string;         // e.g., 'secret.read', 'auth.login', 'mcp.request'
  event_category: string;     // 'secret', 'auth', 'project', 'organization', 'member', 'mcp'
  action: string;             // Human-readable description
  resource_type: string;      // 'secret', 'project', 'organization', 'member', 'user', 'mcp_request'
  resource_id?: string;       // UUID of affected resource
  ip_address?: string;        // Source IP address (INET format)
  user_agent?: string;        // Browser/client identifier
  request_id?: string;        // Request tracking ID
  session_id?: string;        // Session identifier
  metadata?: object;          // Event-specific data (JSON)
  success: boolean;           // Whether action succeeded
  error_message?: string;     // If failed, error message
  created_at: string;         // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": "p1r2o3j4-e5c6-7890-abcd-ef1234567890",
      "secret_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
      "event_type": "secret.read",
      "event_category": "secret",
      "action": "Accessed secret: OPENAI_API_KEY",
      "resource_type": "secret",
      "resource_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "request_id": "req_7f8e9d0c1b2a3456",
      "session_id": "sess_abc123def456",
      "metadata": {
        "secret_name": "OPENAI_API_KEY",
        "environment": "production",
        "access_method": "web_ui"
      },
      "success": true,
      "created_at": "2025-11-02T14:23:45.123Z"
    },
    {
      "id": "a2b3c4d5-e6f7-8901-2345-6789abcdef01",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "event_type": "auth.login",
      "event_category": "auth",
      "action": "User logged in successfully",
      "resource_type": "user",
      "resource_id": "123e4567-e89b-12d3-a456-426614174000",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "metadata": {
        "auth_method": "email",
        "device": "macOS Chrome"
      },
      "success": true,
      "created_at": "2025-11-02T10:15:30.456Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 1234,
    "total_pages": 25
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid date format for start_date",
      "details": { "start_date": "must be ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)" },
      "request_id": "req_7f8e9d0c1b2a3456",
      "timestamp": "2025-11-02T14:23:45.123Z"
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have permission to view requested logs
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `page`: Must be >= 1
- `per_page`: Must be between 1 and 100 (default: 50)
- `start_date`, `end_date`: Must be valid ISO 8601 timestamps
- `user_id`, `resource_id`: Must be valid UUIDs
- `event_type`: Must match predefined event types (see database schema)
- `event_category`: Must be one of: secret, project, organization, member, auth, mcp

---

### 2. Get Audit Log by ID

**Endpoint:** `GET /audit-logs/:id`

**Description:** Retrieve detailed information for a specific audit log entry, including expanded metadata and related resources.

**Permissions Required:** User must have access to the audit log (RLS enforced)

**Path Parameters:**
- `id` (string, required) - Audit log ID (UUID)

**Success Response (200 OK):**
```typescript
interface GetAuditLogResponse {
  id: string;
  user_id: string;
  user_email: string;         // Joined from auth.users
  organization_id?: string;
  organization_name?: string; // Joined from organizations
  project_id?: string;
  project_name?: string;      // Joined from projects
  secret_id?: string;
  secret_name?: string;       // From metadata or secrets table
  event_type: string;
  event_category: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  session_id?: string;
  metadata?: object;
  success: boolean;
  error_message?: string;
  created_at: string;
}
```

**Example Response:**
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_email": "alice@example.com",
  "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "organization_name": "Acme Corp",
  "project_id": "p1r2o3j4-e5c6-7890-abcd-ef1234567890",
  "project_name": "RecipeApp",
  "secret_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
  "secret_name": "OPENAI_API_KEY",
  "event_type": "secret.read",
  "event_category": "secret",
  "action": "Accessed secret: OPENAI_API_KEY",
  "resource_type": "secret",
  "resource_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "request_id": "req_7f8e9d0c1b2a3456",
  "session_id": "sess_abc123def456",
  "metadata": {
    "secret_name": "OPENAI_API_KEY",
    "environment": "production",
    "access_method": "web_ui",
    "browser": "Chrome 118.0",
    "os": "macOS 14.0"
  },
  "success": true,
  "created_at": "2025-11-02T14:23:45.123Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have access to this audit log
- `404 Not Found` - Audit log doesn't exist or user lacks access
- `500 Internal Server Error` - Server error

---

### 3. Get Secret Access History

**Endpoint:** `GET /secrets/:id/access-history`

**Description:** View complete access history for a specific secret, showing who accessed it, when, and how.

**Permissions Required:** User must have access to the secret (RLS enforced)

**Path Parameters:**
- `id` (string, required) - Secret ID (UUID)

**Query Parameters:**
```typescript
interface SecretAccessHistoryParams {
  page?: number;              // Page number (default: 1)
  per_page?: number;          // Items per page (default: 50, max: 100)
  start_date?: string;        // ISO 8601 timestamp (inclusive)
  end_date?: string;          // ISO 8601 timestamp (exclusive)
  access_method?: string;     // Filter by method: 'web_ui', 'api', 'mcp', 'cli'
}
```

**Example Request:**
```http
GET /secrets/s1e2c3r4-e5t6-7890-abcd-ef1234567890/access-history?per_page=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface SecretAccessHistoryResponse {
  secret_id: string;
  secret_name: string;
  data: AccessEvent[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface AccessEvent {
  id: string;                 // UUID
  secret_id: string;
  user_id: string;
  user_email: string;         // Joined from auth.users
  organization_id: string;
  project_id: string;
  access_type: string;        // 'read', 'copy', 'download', 'mcp_access'
  access_method: string;      // 'web_ui', 'api', 'mcp', 'cli', 'browser_extension'
  ip_address?: string;
  user_agent?: string;
  mcp_request_id?: string;    // If accessed via MCP
  mcp_client_name?: string;   // If accessed via MCP (e.g., 'claude-code')
  accessed_at: string;        // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "secret_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
  "secret_name": "OPENAI_API_KEY",
  "data": [
    {
      "id": "ae1b2c3d-4e5f-6789-0abc-def123456789",
      "secret_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "user_email": "alice@example.com",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": "p1r2o3j4-e5c6-7890-abcd-ef1234567890",
      "access_type": "read",
      "access_method": "web_ui",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "accessed_at": "2025-11-02T14:23:45.123Z"
    },
    {
      "id": "ae2c3d4e-5f67-8901-2bcd-ef1234567890",
      "secret_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "user_email": "alice@example.com",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": "p1r2o3j4-e5c6-7890-abcd-ef1234567890",
      "access_type": "mcp_access",
      "access_method": "mcp",
      "ip_address": "192.168.1.100",
      "user_agent": "Claude Code 1.0.0",
      "mcp_request_id": "mcp1-2345-6789-abcd-ef1234567890",
      "mcp_client_name": "claude-code",
      "accessed_at": "2025-11-01T10:15:30.456Z"
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
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have access to this secret
- `404 Not Found` - Secret doesn't exist or user lacks access
- `500 Internal Server Error` - Server error

---

### 4. Get Organization Audit Logs

**Endpoint:** `GET /organizations/:id/audit-logs`

**Description:** Retrieve organization-wide audit logs. Available only to Admins and Owners of the organization.

**Permissions Required:** Admin or Owner role in the organization

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)

**Query Parameters:**
Same as `GET /audit-logs` (pagination, filtering, sorting)

**Success Response (200 OK):**
Same structure as `GET /audit-logs`

**Example Request:**
```http
GET /organizations/a1b2c3d4-e5f6-7890-abcd-ef1234567890/audit-logs?event_category=secret&per_page=100
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User is not Admin/Owner of this organization
- `404 Not Found` - Organization doesn't exist or user lacks access
- `500 Internal Server Error` - Server error

---

### 5. Export Audit Logs

**Endpoint:** `POST /audit-logs/export`

**Description:** Export audit logs for compliance reporting in CSV or JSON format. Supports filtering by date range, event type, and user.

**Permissions Required:** Admin or Owner role (for organization exports)

**Request:**
```typescript
interface ExportAuditLogsRequest {
  format: 'csv' | 'json';               // Export format
  organization_id?: string;             // Organization ID (Admin/Owner only)
  start_date: string;                   // ISO 8601 timestamp (required)
  end_date: string;                     // ISO 8601 timestamp (required)
  filters?: {
    user_id?: string;                   // Filter by user
    event_type?: string;                // Filter by event type
    event_category?: string;            // Filter by category
    resource_type?: string;             // Filter by resource type
  };
  include_metadata?: boolean;           // Include metadata column (default: true)
}
```

**Example Request:**
```http
POST /audit-logs/export
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "format": "csv",
  "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-04-01T00:00:00Z",
  "filters": {
    "event_category": "secret"
  },
  "include_metadata": true
}
```

**Success Response (200 OK):**

**CSV Format:**
```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="audit_logs_2025-01-01_to_2025-04-01.csv"

id,timestamp,user_email,event_type,action,resource_type,ip_address,success,metadata
f47ac10b-58cc-4372-a567-0e02b2c3d479,2025-11-02T14:23:45.123Z,alice@example.com,secret.read,"Accessed secret: OPENAI_API_KEY",secret,192.168.1.100,true,"{""secret_name"":""OPENAI_API_KEY"",""environment"":""production""}"
```

**JSON Format:**
```http
Content-Type: application/json
Content-Disposition: attachment; filename="audit_logs_2025-01-01_to_2025-04-01.json"

{
  "export_metadata": {
    "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-04-01T00:00:00Z",
    "generated_at": "2025-11-02T15:00:00.000Z",
    "generated_by": "alice@example.com",
    "total_records": 1234
  },
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "timestamp": "2025-11-02T14:23:45.123Z",
      "user_email": "alice@example.com",
      "event_type": "secret.read",
      "action": "Accessed secret: OPENAI_API_KEY",
      "resource_type": "secret",
      "ip_address": "192.168.1.100",
      "success": true,
      "metadata": {
        "secret_name": "OPENAI_API_KEY",
        "environment": "production"
      }
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Invalid date range or parameters
  ```json
  {
    "error": {
      "code": "INVALID_DATE_RANGE",
      "message": "start_date must be before end_date",
      "details": {
        "start_date": "2025-04-01T00:00:00Z",
        "end_date": "2025-01-01T00:00:00Z"
      },
      "request_id": "req_7f8e9d0c1b2a3456",
      "timestamp": "2025-11-02T15:00:00.000Z"
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have export permissions
- `404 Not Found` - No audit logs found in specified date range
- `422 Unprocessable Entity` - Date range exceeds maximum allowed (1 year)
- `500 Internal Server Error` - Export generation failed

**Validation Rules:**
- `start_date` and `end_date` are required
- Date range cannot exceed 1 year
- `format` must be either 'csv' or 'json'
- `organization_id` required for organization exports

---

### 6. List Access Events

**Endpoint:** `GET /access-events`

**Description:** Retrieve high-frequency secret access events for compliance reporting. Optimized for performance with separate table from general audit logs.

**Permissions Required:** User sees own access events; Admin/Owner sees organization access events

**Query Parameters:**
```typescript
interface ListAccessEventsParams {
  page?: number;              // Page number (default: 1)
  per_page?: number;          // Items per page (default: 50, max: 100)
  secret_id?: string;         // Filter by secret UUID
  user_id?: string;           // Filter by user UUID (Admin/Owner only)
  organization_id?: string;   // Filter by organization (Admin/Owner only)
  access_type?: string;       // Filter by type: 'read', 'copy', 'download', 'mcp_access'
  access_method?: string;     // Filter by method: 'web_ui', 'api', 'mcp', 'cli'
  start_date?: string;        // ISO 8601 timestamp (inclusive)
  end_date?: string;          // ISO 8601 timestamp (exclusive)
  sort?: string;              // Sort field:direction (default: 'accessed_at:desc')
}
```

**Example Request:**
```http
GET /access-events?start_date=2025-11-01T00:00:00Z&access_type=mcp_access&per_page=100
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface ListAccessEventsResponse {
  data: AccessEvent[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
```

Response structure same as `GET /secrets/:id/access-history`

**Error Responses:**
Same as other audit log endpoints

---

### 7. List MCP Request Audit Trail

**Endpoint:** `GET /mcp-requests/audit`

**Description:** Retrieve audit trail of all MCP (Model Context Protocol) requests from AI tools like Claude Code and Cursor, including approval status and access grants.

**Permissions Required:** User sees own MCP requests; Admin/Owner sees organization MCP requests

**Query Parameters:**
```typescript
interface ListMCPRequestsParams {
  page?: number;              // Page number (default: 1)
  per_page?: number;          // Items per page (default: 50, max: 100)
  user_id?: string;           // Filter by user UUID (Admin/Owner only)
  organization_id?: string;   // Filter by organization (Admin/Owner only)
  approval_status?: string;   // Filter by status: 'pending', 'approved', 'denied', 'expired'
  mcp_client_name?: string;   // Filter by client: 'claude-code', 'cursor'
  request_type?: string;      // Filter by type: 'secret_list', 'secret_get', 'secret_search'
  start_date?: string;        // ISO 8601 timestamp (inclusive)
  end_date?: string;          // ISO 8601 timestamp (exclusive)
  sort?: string;              // Sort field:direction (default: 'created_at:desc')
}
```

**Example Request:**
```http
GET /mcp-requests/audit?approval_status=pending&per_page=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface ListMCPRequestsResponse {
  data: MCPRequest[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface MCPRequest {
  id: string;                 // UUID
  user_id: string;
  user_email: string;         // Joined from auth.users
  organization_id: string;
  project_id?: string;
  secret_id?: string;
  mcp_tool_name: string;      // e.g., 'abyrith_secrets'
  mcp_client_name: string;    // e.g., 'claude-code', 'cursor'
  mcp_client_version?: string;
  request_type: string;       // 'secret_list', 'secret_get', 'secret_search', 'project_list'
  requested_resource?: string; // Human-readable description
  request_params?: object;    // Request parameters
  approval_status: string;    // 'pending', 'approved', 'denied', 'expired'
  approved_by?: string;       // User ID who approved (if approved)
  approved_by_email?: string; // Email of approver
  approved_at?: string;       // ISO 8601 timestamp
  denied_reason?: string;     // If denied, reason
  expires_at?: string;        // When approval expires (time-limited access)
  access_granted: boolean;    // Whether access was ultimately granted
  error_message?: string;     // If request failed, error message
  ip_address?: string;
  user_agent?: string;
  created_at: string;         // ISO 8601 timestamp
  updated_at: string;         // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "mcp1-2345-6789-abcd-ef1234567890",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "user_email": "alice@example.com",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": "p1r2o3j4-e5c6-7890-abcd-ef1234567890",
      "secret_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
      "mcp_tool_name": "abyrith_secrets",
      "mcp_client_name": "claude-code",
      "mcp_client_version": "1.0.0",
      "request_type": "secret_get",
      "requested_resource": "STRIPE_SECRET_KEY (production)",
      "request_params": {
        "secret_name": "STRIPE_SECRET_KEY",
        "environment": "production"
      },
      "approval_status": "approved",
      "approved_by": "123e4567-e89b-12d3-a456-426614174000",
      "approved_by_email": "alice@example.com",
      "approved_at": "2025-11-02T14:25:00.000Z",
      "expires_at": "2025-11-02T15:25:00.000Z",
      "access_granted": true,
      "ip_address": "192.168.1.100",
      "user_agent": "Claude Code 1.0.0",
      "created_at": "2025-11-02T14:24:30.456Z",
      "updated_at": "2025-11-02T14:25:00.000Z"
    },
    {
      "id": "mcp2-3456-7890-bcde-f12345678901",
      "user_id": "234f5678-f90c-23e4-b567-1f23c4d5e678",
      "user_email": "bob@example.com",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "mcp_tool_name": "abyrith_secrets",
      "mcp_client_name": "cursor",
      "mcp_client_version": "0.9.5",
      "request_type": "secret_list",
      "requested_resource": "List all secrets in project RecipeApp",
      "request_params": {
        "project_id": "p1r2o3j4-e5c6-7890-abcd-ef1234567890"
      },
      "approval_status": "pending",
      "access_granted": false,
      "ip_address": "192.168.1.105",
      "user_agent": "Cursor 0.9.5",
      "created_at": "2025-11-02T14:30:15.789Z",
      "updated_at": "2025-11-02T14:30:15.789Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 15,
    "total_pages": 1
  }
}
```

**Error Responses:**
Same as other audit log endpoints

---

## Error Handling

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Error code (UPPER_SNAKE_CASE)
    message: string;        // Human-readable error message
    details?: object;       // Additional error context (optional)
    request_id: string;     // Request ID for debugging
    timestamp: string;      // ISO 8601 timestamp
  };
}
```

### Common Error Codes

**Authentication Errors:**
- `INVALID_TOKEN` - JWT signature invalid or malformed
- `TOKEN_EXPIRED` - JWT expiration time passed
- `MISSING_AUTHORIZATION` - Authorization header not provided

**Authorization Errors:**
- `INSUFFICIENT_PERMISSIONS` - User role lacks required permission
- `RESOURCE_ACCESS_DENIED` - User cannot access this specific resource
- `ORGANIZATION_MISMATCH` - Resource belongs to different organization

**Validation Errors:**
- `VALIDATION_ERROR` - Generic validation failure
- `INVALID_DATE_FORMAT` - Date format incorrect (must be ISO 8601)
- `INVALID_UUID` - UUID format incorrect
- `DATE_RANGE_TOO_LARGE` - Date range exceeds maximum allowed (1 year for exports)
- `INVALID_FILTER` - Filter parameter value invalid

**Resource Errors:**
- `RESOURCE_NOT_FOUND` - Resource doesn't exist or user lacks access
- `NO_AUDIT_LOGS_FOUND` - No audit logs exist for specified filters

**Rate Limiting Errors:**
- `RATE_LIMIT_EXCEEDED` - Too many requests

**Server Errors:**
- `INTERNAL_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database connection/query failure
- `EXPORT_GENERATION_FAILED` - Compliance report export failed

---

## Rate Limiting

### Rate Limit Rules

**Audit Log Queries:**
- **100 requests per hour** per user (all audit log endpoints combined)
- Limit tracked by JWT `sub` claim (user ID)

**Export Requests:**
- **10 exports per hour** per user
- **50 exports per day** per organization

### Rate Limit Headers

Response includes these headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1730305600
X-RateLimit-Policy: audit-logs;w=3600
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 45 minutes.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2025-11-02T15:00:00.000Z",
      "retry_after": 2700
    },
    "request_id": "req_7f8e9d0c1b2a3456",
    "timestamp": "2025-11-02T14:15:00.000Z"
  }
}
```

---

## Examples

### Example 1: User Views Personal Activity

**Scenario:** User wants to see their recent activity in Abyrith

**Step 1: Fetch recent audit logs**
```bash
curl -X GET "https://api.abyrith.com/v1/audit-logs?per_page=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "event_type": "secret.read",
      "action": "Accessed secret: OPENAI_API_KEY",
      "created_at": "2025-11-02T14:23:45.123Z"
    },
    {
      "id": "a2b3c4d5-e6f7-8901-2345-6789abcdef01",
      "event_type": "auth.login",
      "action": "User logged in successfully",
      "created_at": "2025-11-02T10:15:30.456Z"
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

---

### Example 2: Admin Investigates Suspicious Activity

**Scenario:** Admin needs to investigate a user who accessed 50 secrets in 5 minutes

**Step 1: Filter audit logs by user and time range**
```bash
curl -X GET "https://api.abyrith.com/v1/audit-logs?user_id=123e4567-e89b-12d3-a456-426614174000&event_type=secret.read&start_date=2025-11-02T14:00:00Z&end_date=2025-11-02T14:05:00Z&per_page=100" \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "Content-Type: application/json"
```

**Response:** Returns list of 50+ secret access events in 5-minute window

**Step 2: Export incident report**
```bash
curl -X POST "https://api.abyrith.com/v1/audit-logs/export" \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "start_date": "2025-11-02T14:00:00Z",
    "end_date": "2025-11-02T14:05:00Z",
    "filters": {
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "event_type": "secret.read"
    }
  }' \
  --output incident_report.csv
```

---

### Example 3: Compliance Officer Generates Quarterly Report

**Scenario:** Compliance officer needs SOC 2 audit evidence for Q1 2025

**Step 1: Export audit logs for Q1 2025**
```bash
curl -X POST "https://api.abyrith.com/v1/audit-logs/export" \
  -H "Authorization: Bearer {owner_jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-04-01T00:00:00Z",
    "include_metadata": true
  }' \
  --output audit_logs_q1_2025.json
```

**Response:** JSON file with all audit logs and export metadata for auditor review

---

### Example 4: View Secret Access History

**Scenario:** User wants to see who accessed their production API key

**Step 1: Get access history for specific secret**
```bash
curl -X GET "https://api.abyrith.com/v1/secrets/s1e2c3r4-e5t6-7890-abcd-ef1234567890/access-history?per_page=50" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "secret_id": "s1e2c3r4-e5t6-7890-abcd-ef1234567890",
  "secret_name": "STRIPE_SECRET_KEY",
  "data": [
    {
      "user_email": "alice@example.com",
      "access_type": "read",
      "access_method": "web_ui",
      "accessed_at": "2025-11-02T14:23:45.123Z"
    },
    {
      "user_email": "bob@example.com",
      "access_type": "mcp_access",
      "access_method": "mcp",
      "mcp_client_name": "claude-code",
      "accessed_at": "2025-11-01T10:15:30.456Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### Example 5: Monitor MCP Request Approvals

**Scenario:** Admin wants to see all pending MCP access requests

**Step 1: List pending MCP requests**
```bash
curl -X GET "https://api.abyrith.com/v1/mcp-requests/audit?approval_status=pending&per_page=20" \
  -H "Authorization: Bearer {admin_jwt_token}" \
  -H "Content-Type: application/json"
```

**Response:** List of all pending MCP requests awaiting approval

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/audit-logs.md` - Database schema for audit logs, access_events, mcp_requests
- [x] `05-api/api-rest-design.md` - API design standards, pagination, error handling patterns
- [x] `08-features/audit-logs/audit-logs-overview.md` - Feature requirements and user flows
- [x] `TECH-STACK.md` - Cloudflare Workers, PostgreSQL 15.x specifications
- [x] `GLOSSARY.md` - Audit log, RLS, compliance term definitions

**Related APIs:**
- `05-api/endpoints/secrets-endpoints.md` - Secrets API (access history integration)
- `05-api/endpoints/auth-endpoints.md` - Authentication API (JWT tokens)
- `05-api/endpoints/organizations-endpoints.md` - Organizations API (organization context)

---

## References

### Internal Documentation
- `05-api/api-rest-design.md` - REST API design patterns and standards
- `03-security/auth/authentication-flow.md` - JWT authentication details
- `03-security/rbac/rls-policies.md` - Row-Level Security enforcement
- `04-database/schemas/audit-logs.md` - Database schema and RLS policies
- `08-features/audit-logs/audit-logs-overview.md` - Feature overview and user scenarios
- `TECH-STACK.md` - Technology decisions (Cloudflare Workers, PostgreSQL)
- `GLOSSARY.md` - Terminology (audit log, compliance, RLS, MCP)

### External Resources
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS documentation
- [SOC 2 Audit Log Requirements](https://www.vanta.com/resources/soc-2-audit-logs) - Compliance guidelines
- [ISO 27001 A.12.4.1](https://www.iso.org/standard/54534.html) - Event logging standard
- [GDPR Article 30](https://gdpr-info.eu/art-30-gdpr/) - Records of processing activities
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/) - Workers API reference

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-02 | Backend Engineering | Initial audit logs API endpoint documentation |

---

## Notes

### Implementation Notes

**RLS Enforcement:**
All audit log endpoints rely on PostgreSQL Row-Level Security (RLS) to enforce access control:
- Regular users see only their own audit logs
- Admins/Owners see organization-wide logs
- Service role can bypass RLS for system operations

**Performance Optimization:**
- Separate `access_events` table for high-frequency secret access logging prevents index contention
- Database indexes optimize common query patterns (user_id, organization_id, timestamp, event_type)
- Pagination enforced (max 100 items per page) to prevent excessive data transfer

**Compliance Requirements:**
- Audit logs are immutable (INSERT-only, no UPDATE/DELETE by users)
- 2-year retention policy (automatically enforced by service role)
- Export formats support SOC 2, ISO 27001, and GDPR requirements
- All timestamps in UTC (ISO 8601 format)

### Security Considerations

**Data Privacy:**
- Audit logs never contain secret values (only metadata: key names, service names)
- IP addresses can be anonymized for GDPR compliance (configurable per organization)
- User can request audit log deletion after retention period (GDPR Right to Erasure)

**Tampering Prevention:**
- Append-only database tables (no UPDATE/DELETE allowed)
- RLS policies prevent user modification
- Only service_role can delete for retention policy
- Future enhancement: Cryptographic signatures on entries

**Rate Limiting:**
- Audit log queries limited to 100 per hour per user (prevents abuse)
- Export requests limited to 10 per hour, 50 per day (prevents excessive exports)

### Known Limitations

- Pagination doesn't support cursor-based pagination (may be needed for very large datasets)
- Export date range limited to 1 year (prevents excessive memory usage)
- No real-time streaming of audit logs (future enhancement with WebSocket)
- No full-text search on audit log content (future enhancement with PostgreSQL FTS)

### Future Enhancements

- **Real-time audit log streaming** - WebSocket API for live audit log updates
- **Cryptographic signatures** - Sign each entry with server private key (tamper-evident)
- **Blockchain anchoring** - Anchor audit log hashes to blockchain (enterprise feature)
- **Full-text search** - Search audit logs using PostgreSQL Full-Text Search
- **ML anomaly detection** - Automatically detect unusual access patterns
- **Automated compliance reporting** - Schedule quarterly reports via email
- **Custom report builder** - UI for building custom compliance reports

### Compliance Mapping

| Framework | Control | Evidence Endpoint |
|-----------|---------|-------------------|
| SOC 2 CC6.1 | Logical and Physical Access Controls | `GET /audit-logs?event_category=auth` |
| SOC 2 CC6.2 | Prior to Issuing Credentials | `GET /audit-logs?event_type=member.invited` |
| SOC 2 CC6.3 | Removes Access When Appropriate | `GET /audit-logs?event_type=member.removed` |
| SOC 2 CC7.2 | System Monitoring | `GET /audit-logs` (all events) |
| ISO 27001 A.12.4.1 | Event Logging | `GET /audit-logs` (comprehensive logging) |
| ISO 27001 A.12.4.3 | Administrator Logs | `GET /audit-logs?user_role=admin,owner` |
| GDPR Article 30 | Records of Processing | `POST /audit-logs/export` |
| GDPR Article 33 | Breach Notification | `GET /audit-logs?success=false` |

### Retention Policy

**Default:** 2 years

**Rationale:**
- SOC 2 requires audit logs for annual audits (minimum 1 year)
- GDPR allows reasonable retention for security purposes
- 2 years provides sufficient history for forensic investigation

**Cleanup:**
- Automated monthly cleanup job deletes logs older than 2 years
- Service role only (users cannot delete audit logs)
- Organization can configure custom retention (1-7 years)
