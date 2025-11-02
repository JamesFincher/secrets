---
Document: Organizations API Endpoints - API Endpoint Documentation
Version: 1.0.0
Last Updated: 2025-11-02
Owner: Backend Engineering
Status: Draft
Dependencies: 04-database/schemas/users-organizations.md, 05-api/api-rest-design.md, 03-security/rbac/permissions-model.md, TECH-STACK.md, GLOSSARY.md
---

# Organizations API Endpoints

## Overview

This document defines all REST API endpoints for managing organizations and team members in Abyrith. Organizations are the top-level multi-tenancy boundary, enabling teams to collaborate on projects while maintaining secure data isolation through role-based access control.

**Base URL:** `https://api.abyrith.com/v1`

**Resource:** Organizations and organization members

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
  org_id?: string;    // Primary organization ID
  role: string;       // User role in primary organization
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
  per_page?: number;  // Items per page (default: 20, max: 100)
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
GET /organizations/:id/members?role=admin&removed_at=null
```

### Sorting

**Query Parameter:**
```
sort=[field]:[asc|desc]
```

**Example:**
```
GET /organizations/:id/members?sort=joined_at:desc
```

---

## Endpoints

### 1. Create Organization

**Endpoint:** `POST /organizations`

**Description:** Creates a new organization. The authenticated user automatically becomes the Owner.

**Permissions Required:** Authenticated user (no specific organization permission needed)

**Request:**
```typescript
interface CreateOrganizationRequest {
  name: string;              // Organization display name (1-255 chars)
  slug: string;              // URL-friendly identifier (lowercase, alphanumeric, hyphens only)
  settings?: {
    require_2fa?: boolean;
    require_approval_for_production?: boolean;
    allowed_oauth_providers?: string[];
    session_timeout_minutes?: number;
  };
  plan?: string;             // 'free' | 'pro' | 'team' | 'enterprise' (default: 'free')
  billing_email?: string;    // Billing contact email (optional)
}
```

**Example Request:**
```json
POST /v1/organizations
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "settings": {
    "require_2fa": false,
    "require_approval_for_production": true,
    "allowed_oauth_providers": ["google", "github"],
    "session_timeout_minutes": 60
  },
  "plan": "team",
  "billing_email": "billing@acme.com"
}
```

**Success Response (201 Created):**
```typescript
interface CreateOrganizationResponse {
  id: string;                // UUID
  name: string;
  slug: string;
  settings: object;
  plan: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  created_at: string;        // ISO 8601 timestamp
  updated_at: string;
  created_by: string;        // User ID who created org
  deleted_at: string | null;
}
```

**Example Response:**
```json
HTTP/1.1 201 Created
Location: /v1/organizations/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "settings": {
    "require_2fa": false,
    "require_approval_for_production": true,
    "allowed_oauth_providers": ["google", "github"],
    "session_timeout_minutes": 60
  },
  "plan": "team",
  "billing_email": "billing@acme.com",
  "stripe_customer_id": null,
  "created_at": "2025-11-02T12:00:00.000Z",
  "updated_at": "2025-11-02T12:00:00.000Z",
  "created_by": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "deleted_at": null
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request payload",
      "details": {
        "slug": ["Slug must be lowercase alphanumeric with hyphens only"],
        "name": ["Name is required and must be 1-255 characters"]
      },
      "request_id": "req_7f8e9d0c1b2a3456",
      "timestamp": "2025-11-02T12:00:00.000Z"
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `409 Conflict` - Organization slug already exists
  ```json
  {
    "error": {
      "code": "RESOURCE_ALREADY_EXISTS",
      "message": "An organization with this slug already exists",
      "details": {
        "field": "slug",
        "value": "acme-corp"
      },
      "request_id": "req_8a9b0c1d2e3f4567",
      "timestamp": "2025-11-02T12:00:00.000Z"
    }
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `name`: Required, 1-255 characters, not empty
- `slug`: Required, 1-255 characters, lowercase alphanumeric with hyphens only, globally unique
- `plan`: One of: 'free', 'pro', 'team', 'enterprise'
- `billing_email`: Valid email format (if provided)
- `settings`: Valid JSON object (optional)

**Side Effects:**
- User is automatically added to `organization_members` with role='Owner'
- Audit log entry created: `organization_created`

---

### 2. Get Organization by ID

**Endpoint:** `GET /organizations/:id`

**Description:** Retrieves details of a specific organization. User must be a member.

**Permissions Required:** User must be a member of the organization

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)

**Success Response (200 OK):**
```typescript
interface GetOrganizationResponse {
  id: string;
  name: string;
  slug: string;
  settings: object;
  plan: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  deleted_at: string | null;
  member_count: number;          // Total active members
  your_role: string;             // Requesting user's role
}
```

**Example Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "settings": {
    "require_2fa": false,
    "require_approval_for_production": true,
    "allowed_oauth_providers": ["google", "github"],
    "session_timeout_minutes": 60
  },
  "plan": "team",
  "billing_email": "billing@acme.com",
  "stripe_customer_id": "cus_abcdef123456",
  "created_at": "2025-11-02T12:00:00.000Z",
  "updated_at": "2025-11-02T13:00:00.000Z",
  "created_by": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "deleted_at": null,
  "member_count": 12,
  "your_role": "Admin"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not a member of this organization
- `404 Not Found` - Organization doesn't exist
- `500 Internal Server Error` - Server error

---

### 3. List Organizations

**Endpoint:** `GET /organizations`

**Description:** Lists all organizations the authenticated user is a member of.

**Permissions Required:** Authenticated user

**Query Parameters:**
```typescript
interface ListOrganizationsParams extends PaginationParams {
  plan?: string;              // Filter by plan: 'free' | 'pro' | 'team' | 'enterprise'
  sort?: string;              // Sort field and direction (e.g., 'name:asc', 'created_at:desc')
}
```

**Success Response (200 OK):**
```typescript
interface ListOrganizationsResponse {
  data: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    member_count: number;
    your_role: string;
    created_at: string;
    updated_at: string;
  }>;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "plan": "team",
      "member_count": 12,
      "your_role": "Admin",
      "created_at": "2025-11-02T12:00:00.000Z",
      "updated_at": "2025-11-02T13:00:00.000Z"
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "Startup Inc",
      "slug": "startup-inc",
      "plan": "free",
      "member_count": 3,
      "your_role": "Owner",
      "created_at": "2025-10-15T08:00:00.000Z",
      "updated_at": "2025-10-20T10:00:00.000Z"
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
- `500 Internal Server Error` - Server error

---

### 4. Update Organization

**Endpoint:** `PUT /organizations/:id`

**Description:** Updates organization settings and metadata. Requires Owner or Admin role.

**Permissions Required:** `can_update_org_settings` (Owner or Admin)

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)

**Request:**
```typescript
interface UpdateOrganizationRequest {
  name?: string;              // Organization display name (1-255 chars)
  settings?: object;          // Organization settings (partial update allowed)
  billing_email?: string;     // Billing contact email
}
```

**Example Request:**
```json
PUT /v1/organizations/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "name": "Acme Corporation (Renamed)",
  "settings": {
    "require_2fa": true,
    "session_timeout_minutes": 30
  },
  "billing_email": "newbilling@acme.com"
}
```

**Success Response (200 OK):**
```typescript
interface UpdateOrganizationResponse {
  id: string;
  name: string;
  slug: string;
  settings: object;
  plan: string;
  billing_email: string | null;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corporation (Renamed)",
  "slug": "acme-corp",
  "settings": {
    "require_2fa": true,
    "require_approval_for_production": true,
    "allowed_oauth_providers": ["google", "github"],
    "session_timeout_minutes": 30
  },
  "plan": "team",
  "billing_email": "newbilling@acme.com",
  "updated_at": "2025-11-02T14:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User lacks permission (not Owner or Admin)
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_PERMISSIONS",
      "message": "You do not have permission to update organization settings",
      "details": {
        "required_permission": "can_update_org_settings",
        "required_role": ["Owner", "Admin"],
        "current_role": "Developer"
      },
      "request_id": "req_9b0c1d2e3f4g5678",
      "timestamp": "2025-11-02T14:30:00.000Z"
    }
  }
  ```
- `404 Not Found` - Organization doesn't exist
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `name`: 1-255 characters (if provided)
- `billing_email`: Valid email format (if provided)
- `settings`: Valid JSON object (if provided)

**Side Effects:**
- `updated_at` timestamp updated
- Audit log entry created: `organization_updated`

**Note:** `slug` and `plan` cannot be changed via this endpoint. Contact support for slug changes or billing for plan upgrades.

---

### 5. Delete Organization

**Endpoint:** `DELETE /organizations/:id`

**Description:** Permanently deletes an organization and all associated data (projects, secrets, members). Requires Owner role. This action is irreversible.

**Permissions Required:** `can_delete_organization` (Owner only)

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not Owner
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_PERMISSIONS",
      "message": "Only organization Owner can delete the organization",
      "details": {
        "required_permission": "can_delete_organization",
        "required_role": ["Owner"],
        "current_role": "Admin"
      },
      "request_id": "req_0c1d2e3f4g5h6789",
      "timestamp": "2025-11-02T15:00:00.000Z"
    }
  }
  ```
- `404 Not Found` - Organization doesn't exist
- `409 Conflict` - Cannot delete organization with active subscriptions or projects
- `500 Internal Server Error` - Server error

**Side Effects:**
- Organization soft-deleted (`deleted_at` timestamp set)
- All organization members removed
- All projects in organization archived/deleted (based on organization settings)
- Audit log entry created: `organization_deleted`
- User notified via email

**Important:** This is a destructive action. Consider implementing a confirmation flow on the client side.

---

### 6. List Organization Members

**Endpoint:** `GET /organizations/:id/members`

**Description:** Lists all members of an organization with their roles and join status.

**Permissions Required:** User must be a member of the organization

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)

**Query Parameters:**
```typescript
interface ListMembersParams extends PaginationParams {
  role?: string;              // Filter by role: 'Owner' | 'Admin' | 'Developer' | 'Read-Only'
  status?: string;            // Filter by status: 'active' | 'pending' | 'removed'
  sort?: string;              // Sort field (default: 'joined_at:desc')
}
```

**Success Response (200 OK):**
```typescript
interface ListMembersResponse {
  data: Array<{
    user_id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;              // 'Owner' | 'Admin' | 'Developer' | 'Read-Only'
    invited_by: string | null; // User ID who invited
    invited_by_email: string | null;
    invited_at: string;
    joined_at: string | null;  // null = pending invitation
    created_at: string;
    updated_at: string;
    removed_at: string | null;
  }>;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
```

**Example Response:**
```json
{
  "data": [
    {
      "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "email": "owner@acme.com",
      "display_name": "Jane Doe",
      "avatar_url": "https://example.com/avatar.jpg",
      "role": "Owner",
      "invited_by": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "invited_by_email": "owner@acme.com",
      "invited_at": "2025-11-02T12:00:00.000Z",
      "joined_at": "2025-11-02T12:00:00.000Z",
      "created_at": "2025-11-02T12:00:00.000Z",
      "updated_at": "2025-11-02T12:00:00.000Z",
      "removed_at": null
    },
    {
      "user_id": "8b5e3d1c-9a7f-4e2b-8c6d-1a2b3c4d5e6f",
      "email": "admin@acme.com",
      "display_name": "John Smith",
      "avatar_url": null,
      "role": "Admin",
      "invited_by": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "invited_by_email": "owner@acme.com",
      "invited_at": "2025-11-02T13:00:00.000Z",
      "joined_at": "2025-11-02T13:30:00.000Z",
      "created_at": "2025-11-02T13:00:00.000Z",
      "updated_at": "2025-11-02T13:30:00.000Z",
      "removed_at": null
    },
    {
      "user_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "email": "developer@acme.com",
      "display_name": null,
      "avatar_url": null,
      "role": "Developer",
      "invited_by": "8b5e3d1c-9a7f-4e2b-8c6d-1a2b3c4d5e6f",
      "invited_by_email": "admin@acme.com",
      "invited_at": "2025-11-02T14:00:00.000Z",
      "joined_at": null,
      "created_at": "2025-11-02T14:00:00.000Z",
      "updated_at": "2025-11-02T14:00:00.000Z",
      "removed_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 12,
    "total_pages": 1
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not a member of this organization
- `404 Not Found` - Organization doesn't exist
- `500 Internal Server Error` - Server error

**Notes:**
- Members with `joined_at: null` have pending invitations
- Members sorted by role hierarchy (Owner > Admin > Developer > Read-Only), then by join date
- Removed members (`removed_at != null`) excluded by default (use `status=removed` to include)

---

### 7. Invite Organization Member

**Endpoint:** `POST /organizations/:id/members`

**Description:** Invites a new member to the organization by email. Sends invitation email with join link.

**Permissions Required:** `can_invite_members` (Owner or Admin)

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)

**Request:**
```typescript
interface InviteMemberRequest {
  email: string;              // Email address of user to invite
  role: string;               // 'Admin' | 'Developer' | 'Read-Only' (cannot invite as Owner)
}
```

**Example Request:**
```json
POST /v1/organizations/550e8400-e29b-41d4-a716-446655440000/members
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "email": "newmember@example.com",
  "role": "Developer"
}
```

**Success Response (201 Created):**
```typescript
interface InviteMemberResponse {
  user_id: string | null;     // null if user doesn't exist yet
  email: string;
  role: string;
  invited_by: string;
  invited_at: string;
  joined_at: string | null;   // null until user accepts
  status: string;             // 'pending' | 'active'
}
```

**Example Response:**
```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "user_id": null,
  "email": "newmember@example.com",
  "role": "Developer",
  "invited_by": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "invited_at": "2025-11-02T15:30:00.000Z",
  "joined_at": null,
  "status": "pending"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request payload",
      "details": {
        "email": ["Must be a valid email address"],
        "role": ["Must be one of: Admin, Developer, Read-Only"]
      },
      "request_id": "req_1d2e3f4g5h6i7890",
      "timestamp": "2025-11-02T15:30:00.000Z"
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User lacks permission to invite members
- `404 Not Found` - Organization doesn't exist
- `409 Conflict` - User is already a member
  ```json
  {
    "error": {
      "code": "RESOURCE_ALREADY_EXISTS",
      "message": "User is already a member of this organization",
      "details": {
        "email": "newmember@example.com",
        "current_role": "Developer"
      },
      "request_id": "req_2e3f4g5h6i7j8901",
      "timestamp": "2025-11-02T15:30:00.000Z"
    }
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `email`: Valid email format, required
- `role`: One of: 'Admin', 'Developer', 'Read-Only' (cannot set 'Owner' via this endpoint)

**Side Effects:**
- If user doesn't exist, creates pending invitation
- If user exists, creates organization membership with `joined_at: null`
- Sends invitation email to user
- Audit log entry created: `member_invited`

**Important:** Cannot invite users as Owner. Owner role is assigned only at organization creation.

---

### 8. Update Organization Member Role

**Endpoint:** `PUT /organizations/:id/members/:user_id`

**Description:** Changes a member's role in the organization. Cannot change Owner role.

**Permissions Required:** `can_change_member_roles` (Owner or Admin)

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)
- `user_id` (string, required) - User ID (UUID)

**Request:**
```typescript
interface UpdateMemberRequest {
  role: string;               // 'Admin' | 'Developer' | 'Read-Only'
}
```

**Example Request:**
```json
PUT /v1/organizations/550e8400-e29b-41d4-a716-446655440000/members/8b5e3d1c-9a7f-4e2b-8c6d-1a2b3c4d5e6f
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "role": "Admin"
}
```

**Success Response (200 OK):**
```typescript
interface UpdateMemberResponse {
  user_id: string;
  email: string;
  role: string;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "user_id": "8b5e3d1c-9a7f-4e2b-8c6d-1a2b3c4d5e6f",
  "email": "member@acme.com",
  "role": "Admin",
  "updated_at": "2025-11-02T16:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid role
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid role specified",
      "details": {
        "role": ["Must be one of: Admin, Developer, Read-Only"]
      },
      "request_id": "req_3f4g5h6i7j8k9012",
      "timestamp": "2025-11-02T16:00:00.000Z"
    }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User lacks permission or attempting to change Owner
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_PERMISSIONS",
      "message": "Cannot change Owner role",
      "details": {
        "reason": "Owner role can only be transferred, not changed"
      },
      "request_id": "req_4g5h6i7j8k9l0123",
      "timestamp": "2025-11-02T16:00:00.000Z"
    }
  }
  ```
- `404 Not Found` - Organization or user doesn't exist
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `role`: One of: 'Admin', 'Developer', 'Read-Only' (cannot set or change 'Owner')
- Cannot change your own role (use a different Admin/Owner)
- Cannot change Owner role (owner transfer requires separate flow)

**Side Effects:**
- Member's role updated
- `updated_at` timestamp updated
- Audit log entry created: `member_role_changed`
- User notified via email of role change

---

### 9. Remove Organization Member

**Endpoint:** `DELETE /organizations/:id/members/:user_id`

**Description:** Removes a member from the organization. Members can remove themselves. Admins and Owners can remove others (except Owner).

**Permissions Required:** `can_remove_members` (Owner or Admin) OR self-removal

**Path Parameters:**
- `id` (string, required) - Organization ID (UUID)
- `user_id` (string, required) - User ID (UUID)

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User lacks permission or attempting to remove Owner
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_PERMISSIONS",
      "message": "Cannot remove organization Owner",
      "details": {
        "reason": "Transfer ownership before removing the Owner"
      },
      "request_id": "req_5h6i7j8k9l0m1234",
      "timestamp": "2025-11-02T16:30:00.000Z"
    }
  }
  ```
- `404 Not Found` - Organization or user doesn't exist
- `409 Conflict` - Cannot remove last Owner
- `500 Internal Server Error` - Server error

**Side Effects:**
- Member soft-deleted (`removed_at` timestamp set)
- User loses access to all organization projects
- Audit log entry created: `member_removed`
- User notified via email

**Important:**
- Cannot remove the Owner (must transfer ownership first)
- Cannot remove yourself if you're the only Owner
- Removed members can be re-invited later

---

## Error Handling

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  error: {
    code: string;          // Error code (UPPER_SNAKE_CASE)
    message: string;        // Human-readable error message
    details?: object;       // Additional error details (optional)
    request_id: string;     // Request ID for debugging
    timestamp: string;      // ISO 8601 timestamp
  };
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Input validation failed |
| 400 | `INVALID_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `INSUFFICIENT_PERMISSIONS` | User lacks required permission |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict |
| 409 | `RESOURCE_ALREADY_EXISTS` | Duplicate resource (e.g., slug) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Error Handling Best Practices

**Client-side handling:**
1. Always check HTTP status code first
2. Parse `error.code` for programmatic handling
3. Display `error.message` to users
4. Log `error.details` and `request_id` for debugging
5. Implement exponential backoff for 429 errors

---

## Rate Limiting

### Rate Limit Rules

**Per User:**
- 1,000 requests per hour (all endpoints combined)
- 100 requests per hour for invitation endpoints (to prevent spam)

**Per IP Address:**
- 100 requests per hour (unauthenticated)

### Rate Limit Headers

Response includes these headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1730305600
X-RateLimit-Policy: user;w=3600
```

### Rate Limit Exceeded Response

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 2700

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 45 minutes.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2025-11-02T17:00:00.000Z",
      "retry_after": 2700
    },
    "request_id": "req_6i7j8k9l0m1n2345",
    "timestamp": "2025-11-02T16:15:00.000Z"
  }
}
```

---

## Examples

### Example 1: Create Organization and Invite Team

**Scenario:** Company owner creates organization and invites team members

**Step 1: Create Organization**
```bash
curl -X POST https://api.abyrith.com/v1/organizations \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Startup",
    "slug": "tech-startup",
    "plan": "pro"
  }'
```

**Response:**
```json
{
  "id": "org-uuid-here",
  "name": "Tech Startup",
  "slug": "tech-startup",
  "plan": "pro",
  "created_at": "2025-11-02T12:00:00.000Z"
}
```

**Step 2: Invite Admin**
```bash
curl -X POST https://api.abyrith.com/v1/organizations/org-uuid-here/members \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@techstartup.com",
    "role": "Admin"
  }'
```

**Step 3: Invite Developers**
```bash
curl -X POST https://api.abyrith.com/v1/organizations/org-uuid-here/members \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev1@techstartup.com",
    "role": "Developer"
  }'
```

---

### Example 2: Update Member Role (Promote Developer to Admin)

**Scenario:** Admin promotes a Developer to Admin role

**Request:**
```bash
curl -X PUT https://api.abyrith.com/v1/organizations/org-uuid-here/members/user-uuid \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "Admin"
  }'
```

**Response:**
```json
{
  "user_id": "user-uuid",
  "email": "dev1@techstartup.com",
  "role": "Admin",
  "updated_at": "2025-11-02T14:00:00.000Z"
}
```

---

### Example 3: List Active Members

**Scenario:** Get all active members sorted by role

**Request:**
```bash
curl -X GET "https://api.abyrith.com/v1/organizations/org-uuid-here/members?status=active&sort=role:desc" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response:**
```json
{
  "data": [
    {
      "user_id": "owner-uuid",
      "email": "owner@techstartup.com",
      "role": "Owner",
      "joined_at": "2025-11-02T12:00:00.000Z"
    },
    {
      "user_id": "admin-uuid",
      "email": "admin@techstartup.com",
      "role": "Admin",
      "joined_at": "2025-11-02T13:00:00.000Z"
    },
    {
      "user_id": "dev-uuid",
      "email": "dev1@techstartup.com",
      "role": "Developer",
      "joined_at": "2025-11-02T14:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 3,
    "total_pages": 1
  }
}
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/users-organizations.md` - Database schema definition
- [x] `03-security/rbac/permissions-model.md` - Permission definitions
- [x] `05-api/api-rest-design.md` - API design patterns
- [x] `TECH-STACK.md` - Technology stack
- [x] `GLOSSARY.md` - Term definitions

**Related APIs:**
- `05-api/endpoints/auth-endpoints.md` - Authentication flows
- `05-api/endpoints/projects-endpoints.md` - Project management (organizations own projects)

---

## References

### Internal Documentation
- `04-database/schemas/users-organizations.md` - Database schema for organizations and members
- `03-security/rbac/permissions-model.md` - Permission model and role definitions
- `03-security/rbac/role-definitions.md` - Detailed role specifications
- `03-security/rbac/rls-policies.md` - Row-Level Security enforcement
- `05-api/api-rest-design.md` - REST API patterns and conventions
- `03-security/auth/authentication-flow.md` - Authentication details
- `TECH-STACK.md` - Technology stack
- `GLOSSARY.md` - Term definitions

### External Resources
- [OpenAPI Specification](https://swagger.io/specification/) - API specification standard
- [REST API Best Practices](https://restfulapi.net/) - REST patterns
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS documentation
- [Supabase Auth](https://supabase.com/docs/guides/auth) - Authentication system

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-02 | Documentation Creator Agent | Initial API endpoint documentation for organizations |

---

## Notes

### Implementation Notes
- All endpoints enforce RLS policies at database level (see `04-database/schemas/users-organizations.md`)
- Organization slug is immutable after creation (contact support for changes)
- Owner role cannot be assigned via invitation (automatic at creation)
- Soft deletes used for organizations and members (`deleted_at` field)
- Email notifications triggered for invitations and role changes

### Known Issues
- Pending invitations don't expire automatically (future: 7-day expiry)
- No batch operations for inviting multiple members (future enhancement)
- Slug uniqueness is global (future: allow namespace conflicts with archived orgs)

### Future Enhancements
- **Batch invitation endpoint** - Invite multiple members in one request
- **Owner transfer endpoint** - Explicit workflow for changing ownership
- **Organization statistics endpoint** - Get member counts, project counts, etc.
- **Invitation link generation** - Generate shareable invitation links
- **Invitation expiry** - Auto-expire invitations after 7 days
- **Member search** - Search members by email or name
- **Export member list** - CSV export for compliance
- **Audit log filtering** - Filter organization events by type, user, date

### Next Review Date
2025-12-02 (review after initial implementation and API testing)
