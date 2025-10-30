---
Document: Projects - API Endpoint Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Engineering
Status: Draft
Dependencies: 05-api/api-rest-design.md, 04-database/schemas/secrets-metadata.md, 03-security/rbac/permissions-model.md, GLOSSARY.md
---

# Projects API Endpoints

## Overview

This document defines the REST API endpoints for managing projects, environments, and team members in the Abyrith secrets management platform. Projects are logical groupings of secrets and environments that enable teams to organize their API keys and credentials by application or service.

**Base URL:** `https://api.abyrith.com/v1`

**Resource:** Projects, Environments, Project Members

**Authentication:** Required (JWT Bearer token)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Patterns](#common-patterns)
3. [Endpoints](#endpoints)
   - [Projects](#projects)
   - [Environments](#environments)
   - [Project Members](#project-members)
   - [Project Settings](#project-settings)
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
  archived?: boolean;      // Include archived projects (default: false)
  organization_id?: string; // Filter by organization (auto-applied via RLS)
}
```

**Example:**
```
GET /projects?archived=false
```

### Sorting

**Query Parameter:**
```
sort=[field]:[asc|desc]
```

**Example:**
```
GET /projects?sort=created_at:desc
```

---

## Endpoints

## Projects

### 1. Create Project

**Endpoint:** `POST /projects`

**Description:** Create a new project within an organization. Projects are logical groupings for organizing secrets by application or service.

**Permissions Required:** `projects:create` (Owner, Admin roles)

**Request:**
```typescript
interface CreateProjectRequest {
  name: string;              // Required, max 255 characters, unique per org
  description?: string;      // Optional project description
  organization_id: string;   // Required, organization UUID
  settings?: ProjectSettings; // Optional project configuration
}

interface ProjectSettings {
  default_environment?: string; // Default environment ID
  approval_required?: boolean;  // Require approval for secret access (default: false)
  mcp_enabled?: boolean;        // Allow MCP access (default: true)
}
```

**Example Request:**
```json
POST /projects
{
  "name": "RecipeApp",
  "description": "Recipe sharing platform API keys and secrets",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "settings": {
    "approval_required": false,
    "mcp_enabled": true
  }
}
```

**Success Response (201 Created):**
```typescript
interface CreateProjectResponse {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  settings: ProjectSettings;
  archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}
```

**Example Response:**
```json
{
  "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "name": "RecipeApp",
  "description": "Recipe sharing platform API keys and secrets",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "settings": {
    "approval_required": false,
    "mcp_enabled": true
  },
  "archived": false,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z",
  "created_by": "user-uuid-here"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": "validation_error",
    "message": "Project name is required",
    "details": { "name": ["is required"] }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to create projects in this organization
- `409 Conflict` - Project name already exists in organization
  ```json
  {
    "error": "conflict",
    "message": "A project with this name already exists in your organization"
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `name`: Required, max 255 characters, alphanumeric with spaces/hyphens/underscores allowed
- `organization_id`: Required, must reference existing organization user has access to
- `settings`: Valid JSON object matching ProjectSettings schema

---

### 2. Get Project by ID

**Endpoint:** `GET /projects/:id`

**Description:** Retrieve a specific project by its ID, including metadata and settings.

**Permissions Required:** `projects:read` (Owner, Admin, Developer, Read-Only)

**Path Parameters:**
- `id` (string, required) - Project ID (UUID)

**Success Response (200 OK):**
```typescript
interface GetProjectResponse {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  settings: ProjectSettings;
  archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  environment_count: number;  // Number of environments
  secret_count: number;       // Total number of secrets across all environments
  member_count: number;       // Number of team members with access
}
```

**Example Response:**
```json
{
  "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "name": "RecipeApp",
  "description": "Recipe sharing platform API keys and secrets",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "settings": {
    "default_environment": "env-uuid-production",
    "approval_required": false,
    "mcp_enabled": true
  },
  "archived": false,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z",
  "created_by": "user-uuid-here",
  "environment_count": 3,
  "secret_count": 12,
  "member_count": 5
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this project
- `404 Not Found` - Project doesn't exist
  ```json
  {
    "error": "not_found",
    "message": "Project not found"
  }
  ```
- `500 Internal Server Error` - Server error

---

### 3. List Projects

**Endpoint:** `GET /projects`

**Description:** List all projects in the user's organization(s) with optional filtering and pagination.

**Permissions Required:** `projects:read` (All authenticated users)

**Query Parameters:**
```typescript
interface ListProjectsParams extends PaginationParams {
  organization_id?: string;   // Filter by organization (optional, RLS enforced)
  archived?: boolean;          // Include archived projects (default: false)
  search?: string;             // Search by project name or description
  sort?: string;               // Sort field and direction (e.g., "created_at:desc")
}
```

**Success Response (200 OK):**
```typescript
interface ListProjectsResponse {
  data: ProjectSummary[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  archived: boolean;
  environment_count: number;
  secret_count: number;
  last_activity: string | null;  // Most recent secret access or update
  created_at: string;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "name": "RecipeApp",
      "description": "Recipe sharing platform API keys",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "archived": false,
      "environment_count": 3,
      "secret_count": 12,
      "last_activity": "2025-10-30T11:45:00Z",
      "created_at": "2025-10-30T12:00:00Z",
      "updated_at": "2025-10-30T12:00:00Z"
    },
    {
      "id": "b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e",
      "name": "ClientWebsite",
      "description": "Client portfolio website secrets",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "archived": false,
      "environment_count": 2,
      "secret_count": 8,
      "last_activity": "2025-10-29T15:30:00Z",
      "created_at": "2025-10-28T09:00:00Z",
      "updated_at": "2025-10-29T15:30:00Z"
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
  ```json
  {
    "error": "validation_error",
    "message": "Invalid pagination parameters",
    "details": { "per_page": ["must be between 1 and 100"] }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `500 Internal Server Error` - Server error

---

### 4. Update Project

**Endpoint:** `PUT /projects/:id`

**Description:** Update project metadata, description, or settings. Project name changes must maintain uniqueness within the organization.

**Permissions Required:** `projects:update` (Owner, Admin)

**Path Parameters:**
- `id` (string, required) - Project ID (UUID)

**Request:**
```typescript
interface UpdateProjectRequest {
  name?: string;              // Optional, max 255 characters
  description?: string | null; // Optional, can be set to null to clear
  settings?: Partial<ProjectSettings>; // Optional, partial update
  archived?: boolean;         // Optional, soft delete flag
}
```

**Example Request:**
```json
PUT /projects/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d
{
  "description": "Updated description for recipe app",
  "settings": {
    "approval_required": true
  }
}
```

**Success Response (200 OK):**
```typescript
interface UpdateProjectResponse {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  settings: ProjectSettings;
  archived: boolean;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "name": "RecipeApp",
  "description": "Updated description for recipe app",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "settings": {
    "default_environment": "env-uuid-production",
    "approval_required": true,
    "mcp_enabled": true
  },
  "archived": false,
  "updated_at": "2025-10-30T13:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to update this project
- `404 Not Found` - Project doesn't exist
- `409 Conflict` - Project name conflicts with existing project in organization
  ```json
  {
    "error": "conflict",
    "message": "A project with this name already exists in your organization"
  }
  ```
- `500 Internal Server Error` - Server error

---

### 5. Delete Project

**Endpoint:** `DELETE /projects/:id`

**Description:** Permanently delete a project and all associated environments, secrets, and metadata. This action is irreversible. Only organization owners can delete projects.

**Permissions Required:** `projects:delete` (Owner only)

**Path Parameters:**
- `id` (string, required) - Project ID (UUID)

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to delete this project (must be Owner)
  ```json
  {
    "error": "forbidden",
    "message": "Only organization owners can delete projects"
  }
  ```
- `404 Not Found` - Project doesn't exist
- `409 Conflict` - Cannot delete project with active dependencies
  ```json
  {
    "error": "conflict",
    "message": "Cannot delete project with active secrets. Archive the project or delete all secrets first."
  }
  ```
- `500 Internal Server Error` - Server error

---

## Environments

### 6. Create Environment

**Endpoint:** `POST /projects/:project_id/environments`

**Description:** Create a new environment within a project (e.g., development, staging, production).

**Permissions Required:** `projects:update` (Owner, Admin)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)

**Request:**
```typescript
interface CreateEnvironmentRequest {
  name: string;          // Required, max 100 characters, unique per project
  type: EnvironmentType; // Required: 'development', 'staging', 'production', 'custom'
  description?: string;  // Optional environment description
  color?: string;        // Optional hex color code (#RRGGBB)
  sort_order?: number;   // Optional display order (default: 0)
}

type EnvironmentType = 'development' | 'staging' | 'production' | 'custom';
```

**Example Request:**
```json
POST /projects/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d/environments
{
  "name": "Production",
  "type": "production",
  "description": "Live production environment",
  "color": "#FF5733",
  "sort_order": 1
}
```

**Success Response (201 Created):**
```typescript
interface CreateEnvironmentResponse {
  id: string;
  project_id: string;
  name: string;
  type: EnvironmentType;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "env-prod-uuid-here",
  "project_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "name": "Production",
  "type": "production",
  "description": "Live production environment",
  "color": "#FF5733",
  "sort_order": 1,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": "validation_error",
    "message": "Invalid environment type",
    "details": { "type": ["must be one of: development, staging, production, custom"] }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to create environments
- `404 Not Found` - Project doesn't exist
- `409 Conflict` - Environment name already exists in project
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `name`: Required, max 100 characters, unique per project
- `type`: Required, must be one of: development, staging, production, custom
- `color`: Must be valid hex color code (#RRGGBB) if provided
- `sort_order`: Integer (used for display ordering in UI)

---

### 7. List Environments

**Endpoint:** `GET /projects/:project_id/environments`

**Description:** List all environments for a specific project, ordered by sort_order.

**Permissions Required:** `projects:read` (All authenticated users with project access)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)

**Success Response (200 OK):**
```typescript
interface ListEnvironmentsResponse {
  data: Environment[];
}

interface Environment {
  id: string;
  project_id: string;
  name: string;
  type: EnvironmentType;
  description: string | null;
  color: string | null;
  sort_order: number;
  secret_count: number;  // Number of secrets in this environment
  created_at: string;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "env-dev-uuid",
      "project_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "name": "Development",
      "type": "development",
      "description": "Local development environment",
      "color": "#00FF00",
      "sort_order": 0,
      "secret_count": 5,
      "created_at": "2025-10-30T12:00:00Z",
      "updated_at": "2025-10-30T12:00:00Z"
    },
    {
      "id": "env-prod-uuid",
      "project_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "name": "Production",
      "type": "production",
      "description": "Live production environment",
      "color": "#FF5733",
      "sort_order": 1,
      "secret_count": 7,
      "created_at": "2025-10-30T12:05:00Z",
      "updated_at": "2025-10-30T12:05:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this project
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Server error

---

### 8. Update Environment

**Endpoint:** `PUT /projects/:project_id/environments/:id`

**Description:** Update environment metadata, color, or sort order.

**Permissions Required:** `projects:update` (Owner, Admin)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)
- `id` (string, required) - Environment ID (UUID)

**Request:**
```typescript
interface UpdateEnvironmentRequest {
  name?: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number;
}
```

**Example Request:**
```json
PUT /projects/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d/environments/env-prod-uuid
{
  "description": "Production environment - requires approval for access",
  "sort_order": 2
}
```

**Success Response (200 OK):**
```typescript
interface UpdateEnvironmentResponse {
  id: string;
  project_id: string;
  name: string;
  type: EnvironmentType;
  description: string | null;
  color: string | null;
  sort_order: number;
  updated_at: string;
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to update environments
- `404 Not Found` - Project or environment doesn't exist
- `409 Conflict` - Environment name conflicts with existing environment in project
- `500 Internal Server Error` - Server error

---

### 9. Delete Environment

**Endpoint:** `DELETE /projects/:project_id/environments/:id`

**Description:** Delete an environment and all its secrets. This action is irreversible.

**Permissions Required:** `projects:update` (Owner, Admin)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)
- `id` (string, required) - Environment ID (UUID)

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to delete environments
- `404 Not Found` - Project or environment doesn't exist
- `409 Conflict` - Cannot delete last environment in project
  ```json
  {
    "error": "conflict",
    "message": "Cannot delete the last environment in a project. Projects must have at least one environment."
  }
  ```
- `500 Internal Server Error` - Server error

---

## Project Members

### 10. List Project Members

**Endpoint:** `GET /projects/:project_id/members`

**Description:** List all team members with access to a project, including their roles and permissions.

**Permissions Required:** `projects:read` (All authenticated users with project access)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)

**Success Response (200 OK):**
```typescript
interface ListProjectMembersResponse {
  data: ProjectMember[];
}

interface ProjectMember {
  user_id: string;
  email: string;
  name: string | null;
  role: UserRole;           // 'owner', 'admin', 'developer', 'read_only'
  added_at: string;
  added_by: string;
  last_accessed: string | null;
}

type UserRole = 'owner' | 'admin' | 'developer' | 'read_only';
```

**Example Response:**
```json
{
  "data": [
    {
      "user_id": "user-1-uuid",
      "email": "alice@example.com",
      "name": "Alice Johnson",
      "role": "owner",
      "added_at": "2025-10-30T12:00:00Z",
      "added_by": "user-1-uuid",
      "last_accessed": "2025-10-30T11:45:00Z"
    },
    {
      "user_id": "user-2-uuid",
      "email": "bob@example.com",
      "name": "Bob Smith",
      "role": "developer",
      "added_at": "2025-10-30T13:00:00Z",
      "added_by": "user-1-uuid",
      "last_accessed": "2025-10-30T14:30:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this project
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Server error

---

### 11. Add Project Member

**Endpoint:** `POST /projects/:project_id/members`

**Description:** Invite a user to join a project with a specific role. User must already be a member of the organization.

**Permissions Required:** `projects:manage_members` (Owner, Admin)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)

**Request:**
```typescript
interface AddProjectMemberRequest {
  user_id: string;      // Required, must be organization member
  role: UserRole;       // Required: 'admin', 'developer', 'read_only'
}
```

**Example Request:**
```json
POST /projects/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d/members
{
  "user_id": "user-3-uuid",
  "role": "developer"
}
```

**Success Response (201 Created):**
```typescript
interface AddProjectMemberResponse {
  user_id: string;
  email: string;
  name: string | null;
  role: UserRole;
  added_at: string;
  added_by: string;
}
```

**Example Response:**
```json
{
  "user_id": "user-3-uuid",
  "email": "charlie@example.com",
  "name": "Charlie Davis",
  "role": "developer",
  "added_at": "2025-10-30T15:00:00Z",
  "added_by": "user-1-uuid"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": "validation_error",
    "message": "Invalid role specified",
    "details": { "role": ["must be one of: admin, developer, read_only"] }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to add members
- `404 Not Found` - Project or user doesn't exist
- `409 Conflict` - User is already a member of this project
  ```json
  {
    "error": "conflict",
    "message": "User is already a member of this project"
  }
  ```
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `user_id`: Must be a member of the organization
- `role`: Cannot assign 'owner' role via this endpoint (owner role inherited from organization)

---

### 12. Update Project Member Role

**Endpoint:** `PUT /projects/:project_id/members/:user_id`

**Description:** Update a team member's role within a project.

**Permissions Required:** `projects:manage_members` (Owner, Admin)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)
- `user_id` (string, required) - User ID (UUID)

**Request:**
```typescript
interface UpdateProjectMemberRequest {
  role: UserRole;  // Required: 'admin', 'developer', 'read_only'
}
```

**Example Request:**
```json
PUT /projects/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d/members/user-3-uuid
{
  "role": "admin"
}
```

**Success Response (200 OK):**
```typescript
interface UpdateProjectMemberResponse {
  user_id: string;
  email: string;
  role: UserRole;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "user_id": "user-3-uuid",
  "email": "charlie@example.com",
  "role": "admin",
  "updated_at": "2025-10-30T16:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid role
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to update member roles
  ```json
  {
    "error": "forbidden",
    "message": "Cannot modify owner role or change your own role"
  }
  ```
- `404 Not Found` - Project or user doesn't exist
- `500 Internal Server Error` - Server error

**Business Rules:**
- Cannot change the owner role
- Cannot change your own role (prevents accidental lockout)
- At least one owner must remain in the project

---

### 13. Remove Project Member

**Endpoint:** `DELETE /projects/:project_id/members/:user_id`

**Description:** Remove a team member's access to a project.

**Permissions Required:** `projects:manage_members` (Owner, Admin)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)
- `user_id` (string, required) - User ID (UUID)

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to remove members
  ```json
  {
    "error": "forbidden",
    "message": "Cannot remove the project owner or yourself"
  }
  ```
- `404 Not Found` - Project or user doesn't exist
- `409 Conflict` - Cannot remove last owner
  ```json
  {
    "error": "conflict",
    "message": "Cannot remove the last owner from a project"
  }
  ```
- `500 Internal Server Error` - Server error

**Business Rules:**
- Cannot remove the project owner
- Cannot remove yourself
- At least one owner must remain in the project

---

## Project Settings

### 14. Get Project Settings

**Endpoint:** `GET /projects/:project_id/settings`

**Description:** Retrieve detailed project settings and configuration.

**Permissions Required:** `projects:read` (All authenticated users with project access)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)

**Success Response (200 OK):**
```typescript
interface ProjectSettingsResponse {
  project_id: string;
  settings: ProjectSettings;
  updated_at: string;
}

interface ProjectSettings {
  default_environment?: string;      // Default environment ID
  approval_required?: boolean;       // Require approval for secret access
  mcp_enabled?: boolean;             // Allow MCP access
  notification_settings?: NotificationSettings;
  security_settings?: SecuritySettings;
}

interface NotificationSettings {
  email_on_access?: boolean;         // Email when secrets are accessed
  slack_webhook_url?: string;        // Slack notifications
}

interface SecuritySettings {
  require_2fa?: boolean;              // Require 2FA for project access
  session_timeout_minutes?: number;  // Session timeout (default: 60)
  ip_whitelist?: string[];           // Allowed IP addresses
}
```

**Example Response:**
```json
{
  "project_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "settings": {
    "default_environment": "env-prod-uuid",
    "approval_required": true,
    "mcp_enabled": true,
    "notification_settings": {
      "email_on_access": false,
      "slack_webhook_url": null
    },
    "security_settings": {
      "require_2fa": false,
      "session_timeout_minutes": 60,
      "ip_whitelist": []
    }
  },
  "updated_at": "2025-10-30T12:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this project
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Server error

---

### 15. Update Project Settings

**Endpoint:** `PUT /projects/:project_id/settings`

**Description:** Update project settings and configuration.

**Permissions Required:** `projects:update` (Owner, Admin)

**Path Parameters:**
- `project_id` (string, required) - Project ID (UUID)

**Request:**
```typescript
interface UpdateProjectSettingsRequest {
  settings: Partial<ProjectSettings>;  // Partial update allowed
}
```

**Example Request:**
```json
PUT /projects/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d/settings
{
  "settings": {
    "approval_required": true,
    "notification_settings": {
      "email_on_access": true
    }
  }
}
```

**Success Response (200 OK):**
```typescript
interface UpdateProjectSettingsResponse {
  project_id: string;
  settings: ProjectSettings;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "project_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "settings": {
    "default_environment": "env-prod-uuid",
    "approval_required": true,
    "mcp_enabled": true,
    "notification_settings": {
      "email_on_access": true,
      "slack_webhook_url": null
    },
    "security_settings": {
      "require_2fa": false,
      "session_timeout_minutes": 60,
      "ip_whitelist": []
    }
  },
  "updated_at": "2025-10-30T17:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid settings data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission to update settings
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Server error

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
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Resource conflict (e.g., duplicate name) |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |

### Error Handling Best Practices

**Client-side handling:**
1. Always check HTTP status code first
2. Parse error response body
3. Display user-friendly error messages
4. Log full error details for debugging
5. Implement exponential backoff for 429 errors
6. Provide actionable error messages (e.g., "Project name already exists. Please choose a different name.")

---

## Rate Limiting

### Rate Limit Rules

**Per User:**
- 100 requests per minute for read operations (GET)
- 30 requests per minute for write operations (POST, PUT, DELETE)

**Per IP Address:**
- 300 requests per minute (unauthenticated requests to public endpoints)

### Rate Limit Headers

Response includes these headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635789600
```

### Rate Limit Exceeded Response

```json
HTTP/1.1 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 30 seconds.",
  "retry_after": 30
}
```

---

## Examples

### Example 1: Create Complete Project with Environments

**Scenario:** Create a new project called "MyApp" with development, staging, and production environments.

**Step 1: Create Project**
```bash
curl -X POST https://api.abyrith.com/v1/projects \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyApp",
    "description": "My application secrets",
    "organization_id": "org-uuid-here",
    "settings": {
      "approval_required": true,
      "mcp_enabled": true
    }
  }'
```

**Response:**
```json
{
  "id": "project-uuid-here",
  "name": "MyApp",
  "description": "My application secrets",
  "organization_id": "org-uuid-here",
  "settings": {
    "approval_required": true,
    "mcp_enabled": true
  },
  "archived": false,
  "created_at": "2025-10-30T12:00:00Z",
  "updated_at": "2025-10-30T12:00:00Z",
  "created_by": "user-uuid-here"
}
```

**Step 2: Create Development Environment**
```bash
curl -X POST https://api.abyrith.com/v1/projects/project-uuid-here/environments \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Development",
    "type": "development",
    "description": "Local development environment",
    "color": "#00FF00",
    "sort_order": 0
  }'
```

**Step 3: Create Staging Environment**
```bash
curl -X POST https://api.abyrith.com/v1/projects/project-uuid-here/environments \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staging",
    "type": "staging",
    "description": "Pre-production testing environment",
    "color": "#FFA500",
    "sort_order": 1
  }'
```

**Step 4: Create Production Environment**
```bash
curl -X POST https://api.abyrith.com/v1/projects/project-uuid-here/environments \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production",
    "type": "production",
    "description": "Live production environment",
    "color": "#FF0000",
    "sort_order": 2
  }'
```

---

### Example 2: Invite Team Member to Project

**Scenario:** Add a developer to the project and then promote them to admin.

**Step 1: Add Member as Developer**
```bash
curl -X POST https://api.abyrith.com/v1/projects/project-uuid-here/members \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "new-user-uuid",
    "role": "developer"
  }'
```

**Response:**
```json
{
  "user_id": "new-user-uuid",
  "email": "developer@example.com",
  "name": "Jane Developer",
  "role": "developer",
  "added_at": "2025-10-30T13:00:00Z",
  "added_by": "owner-user-uuid"
}
```

**Step 2: Promote to Admin**
```bash
curl -X PUT https://api.abyrith.com/v1/projects/project-uuid-here/members/new-user-uuid \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

**Response:**
```json
{
  "user_id": "new-user-uuid",
  "email": "developer@example.com",
  "role": "admin",
  "updated_at": "2025-10-30T14:00:00Z"
}
```

---

### Example 3: List Projects with Filtering

**Scenario:** Get all non-archived projects, sorted by most recently updated.

```bash
curl -X GET "https://api.abyrith.com/v1/projects?archived=false&sort=updated_at:desc&per_page=50" \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
{
  "data": [
    {
      "id": "project-1-uuid",
      "name": "MyApp",
      "description": "My application secrets",
      "organization_id": "org-uuid",
      "archived": false,
      "environment_count": 3,
      "secret_count": 15,
      "last_activity": "2025-10-30T17:30:00Z",
      "created_at": "2025-10-30T12:00:00Z",
      "updated_at": "2025-10-30T17:30:00Z"
    },
    {
      "id": "project-2-uuid",
      "name": "ClientSite",
      "description": "Client website secrets",
      "organization_id": "org-uuid",
      "archived": false,
      "environment_count": 2,
      "secret_count": 8,
      "last_activity": "2025-10-29T10:00:00Z",
      "created_at": "2025-10-28T09:00:00Z",
      "updated_at": "2025-10-29T10:00:00Z"
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

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `05-api/api-rest-design.md` - REST API design patterns
- [x] `04-database/schemas/secrets-metadata.md` - Database schema for projects, environments
- [ ] `03-security/rbac/permissions-model.md` - Permission definitions (referenced but not yet created)
- [x] `GLOSSARY.md` - Term definitions

**Related APIs:**
- `05-api/endpoints/secrets-endpoints.md` - Secrets management depends on projects and environments
- `05-api/endpoints/auth-endpoints.md` - Authentication required for all project endpoints

---

## References

### Internal Documentation
- `05-api/api-rest-design.md` - REST API patterns and conventions
- `04-database/schemas/secrets-metadata.md` - Database schema definitions
- `03-security/auth/authentication-flow.md` - Authentication details (to be created)
- `TECH-STACK.md` - Technology stack specifications
- `GLOSSARY.md` - Term definitions

### External Resources
- [OpenAPI Specification](https://swagger.io/specification/) - API specification standard
- [REST API Best Practices](https://restfulapi.net/) - REST patterns
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS implementation

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Engineering | Initial project management API endpoint documentation |

---

## Notes

### Implementation Considerations

**Multi-tenancy:**
- All project access is filtered through organization membership via RLS policies
- Users can only access projects in organizations they belong to
- Project owners inherit ownership from organization ownership

**Performance:**
- List endpoints return lightweight summaries with counts for efficiency
- Full project details available via GET /projects/:id endpoint
- Indexes on organization_id, project_id, and user_id ensure fast queries

**Security:**
- All endpoints require authentication via JWT Bearer tokens
- Role-based permissions enforced at both application and database level (RLS)
- Project settings can include IP whitelisting and 2FA requirements for enterprise customers

### Future Enhancements
- Project templates for common application types
- Project transfer between organizations
- Project archival with retention policies
- Bulk environment creation for new projects
- Project-level activity feeds and analytics
- Custom role definitions (enterprise feature)

### Known Limitations
- Cannot transfer projects between organizations (post-MVP feature)
- Maximum 50 environments per project (configurable)
- Project name uniqueness enforced per organization only
