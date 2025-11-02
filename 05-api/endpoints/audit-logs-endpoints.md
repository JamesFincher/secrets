---
Document: Audit Logs API Endpoints - API Endpoint Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineering
Status: Draft
Dependencies: 04-database/schemas/audit-logs.md, 05-api/api-rest-design.md, 03-security/rbac/permissions-model.md, 08-features/audit-logs/audit-logs-overview.md
---

# Audit Logs API Endpoints

## Overview

This document specifies all REST API endpoints for accessing audit logs, compliance reporting, access events, and MCP request tracking. These endpoints enable users to view their activity history, administrators to monitor organization-wide security events, and compliance officers to generate audit reports for SOC 2, ISO 27001, and GDPR requirements.

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
  user_id?: string;              // Filter by user UUID
  event_type?: string;           // Filter by event type
  event_category?: string;       // Filter by category
  start_date?: string;           // ISO 8601 timestamp
  end_date?: string;             // ISO 8601 timestamp
  success?: boolean;             // Filter by success/failure
  resource_type?: string;        // Filter by resource type
  resource_id?: string;          // Filter by specific resource UUID
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

**Available sort fields:**
- `created_at` - Event timestamp (default: desc)
- `event_type` - Event type alphabetically

**Example:**
```
GET /audit-logs?sort=created_at:desc
```

---

## Endpoints

### 1. List Audit Logs

**Endpoint:** `GET /audit-logs`

**Description:** Retrieve paginated audit logs with filtering. Users see their own logs; Admins/Owners see organization logs.

**Permissions Required:** `authenticated` (RLS enforces visibility)

**Query Parameters:**
```typescript
interface ListAuditLogsParams extends PaginationParams, FilterParams {
  sort?: string;                 // Sort field and direction (default: "created_at:desc")
}
```

**Example Request:**
```bash
GET /audit-logs?event_type=secret.read&start_date=2025-10-01T00:00:00Z&per_page=50&sort=created_at:desc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface AuditLogsResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface AuditLogEntry {
  id: string;                    // UUID
  user_id: string;               // User who performed action
  organization_id?: string;      // Organization context (null for personal)
  project_id?: string;           // Project context (null if not project-specific)
  secret_id?: string;            // Secret context (null if not secret-specific)
  event_type: string;            // e.g., "secret.read", "auth.login"
  event_category: string;        // "secret", "auth", "project", "organization", "member", "mcp"
  action: string;                // Human-readable action description
  resource_type: string;         // "secret", "project", "organization", "member", "user", "mcp_request"
  resource_id?: string;          // UUID of affected resource
  ip_address?: string;           // Source IP address (IPv4 or IPv6)
  user_agent?: string;           // Browser/client identifier
  request_id?: string;           // Request ID for tracing
  session_id?: string;           // Session identifier
  metadata?: object;             // Event-specific additional data (JSONB)
  success: boolean;              // Whether action succeeded
  error_message?: string;        // Error message if action failed
  created_at: string;            // ISO 8601 timestamp
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
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "secret_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "event_type": "secret.read",
      "event_category": "secret",
      "action": "Accessed secret: OPENAI_API_KEY",
      "resource_type": "secret",
      "resource_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "request_id": "req_abc123def456",
      "session_id": "sess_xyz789",
      "metadata": {
        "secret_name": "OPENAI_API_KEY",
        "environment": "production",
        "access_method": "web_ui"
      },
      "success": true,
      "created_at": "2025-10-30T14:23:45.123Z"
    },
    {
      "id": "8c9e5d20-1a2b-3c4d-5e6f-7890abcdef12",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": null,
      "secret_id": null,
      "event_type": "auth.login",
      "event_category": "auth",
      "action": "User logged in",
      "resource_type": "user",
      "resource_id": "123e4567-e89b-12d3-a456-426614174000",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "request_id": "req_ghi789jkl012",
      "session_id": "sess_mno345",
      "metadata": {
        "login_method": "email_password"
      },
      "success": true,
      "created_at": "2025-10-30T12:00:00.000Z"
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
      "details": { "start_date": "must be ISO 8601 format" },
      "request_id": "req_...",
      "timestamp": "2025-10-30T14:30:00.000Z"
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid JWT token
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `page`: Integer >= 1
- `per_page`: Integer between 1 and 100
- `start_date` / `end_date`: Valid ISO 8601 timestamps
- `event_type`: Must match predefined event types
- `user_id`, `resource_id`: Valid UUIDs

---

### 2. Get Audit Log Entry by ID

**Endpoint:** `GET /audit-logs/:id`

**Description:** Retrieve a specific audit log entry with detailed metadata. Users can only access their own logs unless Admin/Owner.

**Permissions Required:** `authenticated` (RLS enforces visibility)

**Path Parameters:**
- `id` (string, required) - Audit log entry ID (UUID)

**Success Response (200 OK):**
```typescript
interface AuditLogDetailResponse {
  id: string;
  user_id: string;
  user_email: string;            // Joined from auth.users
  organization_id?: string;
  organization_name?: string;    // Joined from organizations
  project_id?: string;
  project_name?: string;         // Joined from projects
  secret_id?: string;
  secret_name?: string;          // Metadata only (from audit log metadata)
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
  "user_email": "user@example.com",
  "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "organization_name": "Acme Corp",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_name": "RecipeApp",
  "secret_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "secret_name": "OPENAI_API_KEY",
  "event_type": "secret.read",
  "event_category": "secret",
  "action": "Accessed secret: OPENAI_API_KEY",
  "resource_type": "secret",
  "resource_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "request_id": "req_abc123def456",
  "session_id": "sess_xyz789",
  "metadata": {
    "secret_name": "OPENAI_API_KEY",
    "environment": "production",
    "access_method": "web_ui",
    "decryption_successful": true
  },
  "success": true,
  "created_at": "2025-10-30T14:23:45.123Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this audit log entry
- `404 Not Found` - Audit log entry doesn't exist
- `500 Internal Server Error` - Server error

---

### 3. Get Audit Log Summary

**Endpoint:** `GET /audit-logs/summary`

**Description:** Get summary statistics of audit activity for the current user or organization (if Admin/Owner) over a specified date range.

**Permissions Required:** `authenticated` (users get personal summary, Admins get org summary)

**Query Parameters:**
```typescript
interface SummaryParams {
  start_date?: string;           // ISO 8601 timestamp (default: 30 days ago)
  end_date?: string;             // ISO 8601 timestamp (default: now)
  organization_id?: string;      // UUID (Admins only, optional)
}
```

**Example Request:**
```bash
GET /audit-logs/summary?start_date=2025-10-01T00:00:00Z&end_date=2025-10-31T23:59:59Z
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface AuditSummaryResponse {
  date_range: {
    start: string;               // ISO 8601
    end: string;                 // ISO 8601
  };
  total_events: number;
  events_by_type: {
    [event_type: string]: number;
  };
  events_by_category: {
    [event_category: string]: number;
  };
  unique_users: number;          // Admins only (org-wide)
  secrets_accessed: number;
  secrets_created: number;
  secrets_modified: number;
  secrets_deleted: number;
  failed_operations: number;     // success = false
  last_activity: string;         // ISO 8601 timestamp of most recent event
}
```

**Example Response:**
```json
{
  "date_range": {
    "start": "2025-10-01T00:00:00.000Z",
    "end": "2025-10-31T23:59:59.999Z"
  },
  "total_events": 1523,
  "events_by_type": {
    "secret.read": 842,
    "secret.created": 123,
    "secret.updated": 45,
    "secret.deleted": 12,
    "auth.login": 234,
    "auth.logout": 198,
    "member.invited": 8,
    "member.removed": 3,
    "mcp.request": 58
  },
  "events_by_category": {
    "secret": 1022,
    "auth": 432,
    "member": 11,
    "mcp": 58
  },
  "unique_users": 12,
  "secrets_accessed": 842,
  "secrets_created": 123,
  "secrets_modified": 45,
  "secrets_deleted": 12,
  "failed_operations": 27,
  "last_activity": "2025-10-31T18:45:23.456Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid date range or parameters
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User requested org summary without Admin/Owner role
- `500 Internal Server Error` - Server error

---

### 4. Export Audit Logs

**Endpoint:** `POST /audit-logs/export`

**Description:** Generate and download audit logs in CSV or JSON format for compliance reporting. Large exports are processed asynchronously and delivered via email.

**Permissions Required:** Admins/Owners can export organization logs, users can export personal logs

**Request:**
```typescript
interface ExportRequest {
  format: 'csv' | 'json';
  start_date: string;            // ISO 8601 timestamp (required)
  end_date: string;              // ISO 8601 timestamp (required)
  filters?: {
    event_type?: string;
    event_category?: string;
    user_id?: string;            // Admins only
    resource_type?: string;
  };
  include_metadata?: boolean;    // Include full metadata objects (default: true)
}
```

**Example Request:**
```bash
POST /audit-logs/export
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "format": "csv",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-03-31T23:59:59Z",
  "filters": {
    "event_category": "secret"
  },
  "include_metadata": true
}
```

**Success Response (200 OK - Synchronous, <10,000 records):**
```
Content-Type: text/csv (or application/json)
Content-Disposition: attachment; filename="audit_logs_2025-01-01_2025-03-31.csv"

[CSV or JSON file content]
```

**Success Response (202 Accepted - Asynchronous, >10,000 records):**
```json
{
  "export_id": "exp_abc123def456",
  "status": "processing",
  "estimated_completion": "2025-10-30T15:30:00.000Z",
  "message": "Export is being processed. You will receive an email with download link when ready.",
  "polling_url": "/audit-logs/export/exp_abc123def456/status"
}
```

**CSV Format:**
```
id,timestamp,user_email,event_type,action,resource_type,ip_address,success
f47ac10b-58cc-4372-a567-0e02b2c3d479,2025-10-30T14:23:45.123Z,user@example.com,secret.read,"Accessed secret: OPENAI_API_KEY",secret,192.168.1.1,true
...
```

**JSON Format:**
```json
{
  "export_metadata": {
    "generated_at": "2025-10-30T15:00:00.000Z",
    "date_range": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-03-31T23:59:59.999Z"
    },
    "total_records": 8432,
    "filters_applied": {
      "event_category": "secret"
    }
  },
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "user_email": "user@example.com",
      "event_type": "secret.read",
      "action": "Accessed secret: OPENAI_API_KEY",
      "created_at": "2025-10-30T14:23:45.123Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Invalid date range or format
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Date range cannot exceed 1 year",
      "details": { "date_range": "start_date and end_date must be within 365 days" },
      "request_id": "req_...",
      "timestamp": "2025-10-30T15:00:00.000Z"
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have export permission
- `413 Payload Too Large` - Export exceeds maximum size (>1M records)
- `500 Internal Server Error` - Export generation failed

**Validation Rules:**
- `start_date` and `end_date`: Required, valid ISO 8601 timestamps
- Date range: Maximum 1 year
- `format`: Must be "csv" or "json"

---

### 5. Get Export Status

**Endpoint:** `GET /audit-logs/export/:export_id/status`

**Description:** Check status of an asynchronous audit log export.

**Permissions Required:** `authenticated` (user must own the export request)

**Path Parameters:**
- `export_id` (string, required) - Export job ID

**Success Response (200 OK):**
```typescript
interface ExportStatusResponse {
  export_id: string;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;            // ISO 8601
  completed_at?: string;         // ISO 8601 (if completed)
  download_url?: string;         // Presigned URL (if completed, expires in 24h)
  error_message?: string;        // Error message (if failed)
  records_exported?: number;     // Total records (if completed)
}
```

**Example Response (Completed):**
```json
{
  "export_id": "exp_abc123def456",
  "status": "completed",
  "created_at": "2025-10-30T15:00:00.000Z",
  "completed_at": "2025-10-30T15:05:32.123Z",
  "download_url": "https://storage.abyrith.com/exports/exp_abc123def456.csv?expires=1730401200",
  "records_exported": 8432
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't own this export
- `404 Not Found` - Export ID doesn't exist
- `500 Internal Server Error` - Server error

---

### 6. List Access Events

**Endpoint:** `GET /access-events`

**Description:** Retrieve high-frequency secret access events (optimized for performance, separate from general audit logs).

**Permissions Required:** `authenticated` (RLS enforces visibility)

**Query Parameters:**
```typescript
interface AccessEventsParams extends PaginationParams {
  secret_id?: string;            // Filter by specific secret UUID
  user_id?: string;              // Filter by user UUID (Admins only)
  access_type?: string;          // "read" | "copy" | "download" | "mcp_access"
  access_method?: string;        // "web_ui" | "api" | "mcp" | "cli" | "browser_extension"
  start_date?: string;           // ISO 8601 timestamp
  end_date?: string;             // ISO 8601 timestamp
  sort?: string;                 // Sort field and direction (default: "accessed_at:desc")
}
```

**Example Request:**
```bash
GET /access-events?secret_id=6ba7b810-9dad-11d1-80b4-00c04fd430c8&per_page=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface AccessEventsResponse {
  data: AccessEvent[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface AccessEvent {
  id: string;                    // UUID
  secret_id: string;             // Secret that was accessed
  user_id: string;               // User who accessed
  organization_id: string;       // Organization context
  project_id: string;            // Project context
  access_type: string;           // "read" | "copy" | "download" | "mcp_access"
  access_method: string;         // "web_ui" | "api" | "mcp" | "cli" | "browser_extension"
  ip_address?: string;           // Source IP
  user_agent?: string;           // Client identifier
  mcp_request_id?: string;       // Reference to MCP request (if via MCP)
  accessed_at: string;           // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "ae_123e4567-e89b-12d3-a456-426614174000",
      "secret_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "access_type": "read",
      "access_method": "web_ui",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "accessed_at": "2025-10-30T14:23:45.123Z"
    },
    {
      "id": "ae_234f5678-f90c-23e4-b567-537725285111",
      "secret_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "access_type": "mcp_access",
      "access_method": "mcp",
      "ip_address": "192.168.1.1",
      "user_agent": "Claude Code/1.0",
      "mcp_request_id": "mcp_abc123def456",
      "accessed_at": "2025-10-30T12:15:32.456Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 234,
    "total_pages": 5
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid token
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

### 7. Get Access History for Secret

**Endpoint:** `GET /access-events/secret/:secret_id`

**Description:** Get complete access history for a specific secret, showing who accessed it and when.

**Permissions Required:** User must have `can_view_project_audit_logs` permission for the secret's project

**Path Parameters:**
- `secret_id` (string, required) - Secret UUID

**Query Parameters:**
```typescript
interface SecretAccessHistoryParams extends PaginationParams {
  start_date?: string;           // ISO 8601 timestamp
  end_date?: string;             // ISO 8601 timestamp
  access_type?: string;          // Filter by access type
  sort?: string;                 // Default: "accessed_at:desc"
}
```

**Example Request:**
```bash
GET /access-events/secret/6ba7b810-9dad-11d1-80b4-00c04fd430c8?per_page=100
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```typescript
interface SecretAccessHistoryResponse {
  secret_id: string;
  secret_name: string;           // Metadata only
  project_id: string;
  project_name: string;
  access_summary: {
    total_accesses: number;
    unique_users: number;
    first_access: string;        // ISO 8601
    last_access: string;         // ISO 8601
  };
  data: AccessEventWithUser[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface AccessEventWithUser extends AccessEvent {
  user_email: string;            // Joined from auth.users
  user_name?: string;            // Display name if available
}
```

**Example Response:**
```json
{
  "secret_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "secret_name": "OPENAI_API_KEY",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_name": "RecipeApp",
  "access_summary": {
    "total_accesses": 234,
    "unique_users": 5,
    "first_access": "2025-09-15T10:00:00.000Z",
    "last_access": "2025-10-30T14:23:45.123Z"
  },
  "data": [
    {
      "id": "ae_123e4567-e89b-12d3-a456-426614174000",
      "secret_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "user_email": "developer@example.com",
      "user_name": "Jane Developer",
      "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "access_type": "read",
      "access_method": "web_ui",
      "ip_address": "192.168.1.1",
      "accessed_at": "2025-10-30T14:23:45.123Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 100,
    "total": 234,
    "total_pages": 3
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to view this secret's access history
- `404 Not Found` - Secret doesn't exist or user lacks access
- `500 Internal Server Error` - Server error

---

## Error Handling

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code (UPPER_SNAKE_CASE)
    message: string;        // Human-readable error message
    details?: object;       // Additional error context (optional)
    request_id: string;     // Request ID for debugging
    timestamp: string;      // ISO 8601 timestamp
  };
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Input validation failed |
| 400 | `INVALID_DATE_RANGE` | Date range invalid or too large |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `ORGANIZATION_ACCESS_DENIED` | User not member of organization |
| 404 | `NOT_FOUND` | Resource not found |
| 413 | `EXPORT_TOO_LARGE` | Export exceeds maximum size |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Error Handling Best Practices

**Client-side handling:**
1. Always check HTTP status code first
2. Parse error response body for `error.code`
3. Display `error.message` to users
4. Log full error details including `request_id` for debugging
5. Implement exponential backoff for 429 errors

---

## Rate Limiting

### Rate Limit Rules

**Authenticated Users:**
- **100 requests per minute** for all audit log endpoints combined
- Higher limits for export endpoints (10 requests per hour)

**Per-Endpoint Overrides:**
- `GET /audit-logs`: 100 requests/minute
- `GET /audit-logs/:id`: 200 requests/minute (cached)
- `POST /audit-logs/export`: 10 requests/hour (resource-intensive)
- `GET /access-events`: 100 requests/minute

### Rate Limit Headers

Every response includes:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1730305600
X-RateLimit-Policy: audit-logs;w=60
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded for audit log API. Try again in 30 seconds.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2025-10-30T15:01:00.000Z",
      "retry_after": 30
    },
    "request_id": "req_...",
    "timestamp": "2025-10-30T15:00:30.000Z"
  }
}
```

---

## Examples

### Example 1: View Personal Activity History

**Scenario:** User wants to see their recent activity

**Step 1: Fetch recent audit logs**
```bash
curl -X GET "https://api.abyrith.com/v1/audit-logs?per_page=20&sort=created_at:desc" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "data": [
    {
      "id": "...",
      "event_type": "secret.read",
      "action": "Accessed secret: OPENAI_API_KEY",
      "created_at": "2025-10-30T14:23:45.123Z"
    }
  ],
  "pagination": { ... }
}
```

---

### Example 2: Admin Investigates Suspicious Activity

**Scenario:** Admin receives alert about user accessing 50+ secrets in 5 minutes

**Step 1: Filter audit logs by user and time range**
```bash
curl -X GET "https://api.abyrith.com/v1/audit-logs?user_id=${SUSPICIOUS_USER_ID}&start_date=2025-10-30T14:00:00Z&end_date=2025-10-30T14:05:00Z&event_type=secret.read" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}"
```

**Step 2: Check access events for pattern**
```bash
curl -X GET "https://api.abyrith.com/v1/access-events?user_id=${SUSPICIOUS_USER_ID}&start_date=2025-10-30T14:00:00Z&end_date=2025-10-30T14:05:00Z" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}"
```

**Step 3: Export for incident report**
```bash
curl -X POST "https://api.abyrith.com/v1/audit-logs/export" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "start_date": "2025-10-30T14:00:00Z",
    "end_date": "2025-10-30T14:05:00Z",
    "filters": {
      "user_id": "'${SUSPICIOUS_USER_ID}'",
      "event_category": "secret"
    }
  }'
```

---

### Example 3: Compliance Officer Generates SOC 2 Report

**Scenario:** Quarterly audit requires evidence of access control monitoring

**Step 1: Get audit summary for Q1 2025**
```bash
curl -X GET "https://api.abyrith.com/v1/audit-logs/summary?start_date=2025-01-01T00:00:00Z&end_date=2025-03-31T23:59:59Z" \
  -H "Authorization: Bearer ${OWNER_JWT_TOKEN}"
```

**Response:**
```json
{
  "date_range": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-03-31T23:59:59.999Z"
  },
  "total_events": 45231,
  "events_by_type": { ... },
  "unique_users": 42,
  "secrets_accessed": 12843
}
```

**Step 2: Generate full export for auditor**
```bash
curl -X POST "https://api.abyrith.com/v1/audit-logs/export" \
  -H "Authorization: Bearer ${OWNER_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-03-31T23:59:59Z",
    "include_metadata": true
  }'
```

**Response (Asynchronous):**
```json
{
  "export_id": "exp_q1_2025_soc2",
  "status": "processing",
  "estimated_completion": "2025-10-30T15:30:00.000Z",
  "message": "Export is being processed. You will receive an email with download link when ready."
}
```

**Step 3: Check export status**
```bash
curl -X GET "https://api.abyrith.com/v1/audit-logs/export/exp_q1_2025_soc2/status" \
  -H "Authorization: Bearer ${OWNER_JWT_TOKEN}"
```

**Response (When completed):**
```json
{
  "export_id": "exp_q1_2025_soc2",
  "status": "completed",
  "download_url": "https://storage.abyrith.com/exports/exp_q1_2025_soc2.json?expires=...",
  "records_exported": 45231
}
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/audit-logs.md` - Database schema for audit logs, access events, MCP requests
- [x] `05-api/api-rest-design.md` - REST API design patterns
- [x] `03-security/rbac/permissions-model.md` - Permission definitions and RLS policies
- [x] `08-features/audit-logs/audit-logs-overview.md` - Feature requirements

**Related APIs:**
- `05-api/endpoints/secrets-endpoints.md` - Secrets create audit log events (to be created)
- `05-api/endpoints/mcp-endpoints.md` - MCP requests tracked in mcp_requests table (to be created)

---

## References

### Internal Documentation
- `04-database/schemas/audit-logs.md` - Complete database schema and RLS policies
- `05-api/api-rest-design.md` - REST API patterns and conventions
- `03-security/rbac/permissions-model.md` - Permission model and role definitions
- `08-features/audit-logs/audit-logs-overview.md` - Feature documentation
- `TECH-STACK.md` - Technology stack
- `GLOSSARY.md` - Term definitions

### External Resources
- [SOC 2 Audit Log Requirements](https://www.vanta.com/resources/soc-2-audit-logs) - Compliance guidelines
- [ISO 27001 A.12.4.1](https://www.iso.org/standard/54534.html) - Event logging standard
- [GDPR Article 30](https://gdpr-info.eu/art-30-gdpr/) - Records of processing activities
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS documentation

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineering | Initial audit logs API endpoint documentation |

---

## Notes

### Implementation Priorities

**Phase 1 (MVP):**
- `GET /audit-logs` - List audit logs
- `GET /audit-logs/:id` - Get specific entry
- `GET /access-events` - List access events
- `GET /access-events/secret/:secret_id` - Secret access history

**Phase 2 (Post-MVP):**
- `GET /audit-logs/summary` - Activity summary
- `POST /audit-logs/export` - Compliance export
- `GET /audit-logs/export/:export_id/status` - Export status tracking

### Performance Considerations

**Optimization Strategies:**
- Use database indexes on `user_id`, `organization_id`, `event_type`, `created_at`
- Cache frequent queries (user's recent activity) in Workers KV
- Paginate large result sets (default 50, max 100 per page)
- Use asynchronous export for large date ranges (>10,000 records)
- Separate `access_events` table for high-frequency secret access (prevents index contention)

**Rate Limiting:**
- Audit log queries are read-heavy, generous limits (100/minute)
- Export endpoint is resource-intensive, strict limits (10/hour)
- Failed authentication attempts logged but don't count toward rate limit

### Security Considerations

**RLS Enforcement:**
- Users see only their own audit logs
- Admins/Owners see organization-wide logs
- Cannot be bypassed via API manipulation
- All queries enforced at database level

**Data Privacy:**
- Audit logs never contain secret values (only metadata)
- IP addresses can be anonymized for GDPR compliance
- User can request audit log deletion after retention period
- Export includes only data user has permission to see

### Future Enhancements

- **Real-time audit log streaming** - WebSocket endpoint for live activity feed
- **Audit log search** - Full-text search on audit logs using PostgreSQL FTS
- **Anomaly detection API** - Endpoint to query detected suspicious patterns
- **Audit log retention policies** - Configurable retention (default 90 days, enterprise 2 years)
- **Custom compliance report templates** - Pre-configured exports for different frameworks
- **Webhook notifications** - Real-time webhooks for critical audit events

### Known Limitations

- Export limited to 1M records per request (pagination required for larger)
- Date range for export limited to 1 year (prevents excessive load)
- Access event IP addresses may be proxy IPs (if behind CDN)
- Audit log deletion requires manual intervention (no automated retention policy in MVP)
