---
Document: Document Templates
Version: 1.0.0
Last Updated: 2025-10-29
Owner: Engineering Lead
Status: Approved
Dependencies: 00-admin/versioning-strategy.md
---

# Document Templates

## Overview

This document provides standardized templates for all documentation types in the Abyrith documentation repository. Using these templates ensures consistency, completeness, and makes it easier for both humans and AI agents (like Claude Code) to create and navigate documentation.

**Purpose:** Provide copy-paste-ready templates for common documentation types to ensure consistency and completeness across the documentation repository.

---

## Table of Contents

1. [General Template Requirements](#general-template-requirements)
2. [Feature Documentation Template](#feature-documentation-template)
3. [API Endpoint Documentation Template](#api-endpoint-documentation-template)
4. [Database Schema Documentation Template](#database-schema-documentation-template)
5. [Integration Guide Template](#integration-guide-template)
6. [Operations Runbook Template](#operations-runbook-template)
7. [Architecture Document Template](#architecture-document-template)
8. [Using These Templates](#using-these-templates)

---

## General Template Requirements

### Version Header (Required on All Documents)

**Every document must start with this header:**

```markdown
---
Document: [Document Name]
Version: X.Y.Z
Last Updated: YYYY-MM-DD
Owner: [Team/Person responsible]
Status: [Draft | Review | Approved | Deprecated]
Dependencies: [comma-separated list of document file paths]
---
```

### Semantic Versioning for Documents

- **Major (X.0.0):** Breaking changes, complete rewrites, architectural shifts
- **Minor (X.Y.0):** New sections, significant additions, feature documentation
- **Patch (X.Y.Z):** Typo fixes, clarifications, minor updates

### Common Placeholders

When using templates, replace these placeholders:

- `[FEATURE_NAME]` - Name of the feature (e.g., "AI Assistant", "Zero-Knowledge Encryption")
- `[API_ENDPOINT]` - API endpoint path (e.g., "/api/v1/secrets", "/api/v1/projects")
- `[TABLE_NAME]` - Database table name (e.g., "secrets", "organizations")
- `[INTEGRATION_NAME]` - External integration name (e.g., "FireCrawl", "Claude API")
- `[RUNBOOK_NAME]` - Operations runbook name (e.g., "Deployment", "Incident Response")
- `[COMPONENT_NAME]` - Architecture component name (e.g., "Cloudflare Workers", "Supabase Auth")
- `YYYY-MM-DD` - Current date in ISO format
- `[Your Name]` - Document author's name

---

## Feature Documentation Template

**Purpose:** Document user-facing features from both product and technical perspectives.

**Location:** `08-features/[feature-name]/`

**Use for:** AI Assistant, Project Management, Team Collaboration, Audit Logs, etc.

### Template

```markdown
---
Document: [FEATURE_NAME] - Feature Documentation
Version: 1.0.0
Last Updated: YYYY-MM-DD
Owner: [Product/Engineering]
Status: Draft
Dependencies: [list related docs: API endpoints, database schemas, architecture docs]
---

# [FEATURE_NAME] Feature

## Overview

[2-3 sentence summary: What is this feature? What problem does it solve? Who is it for?]

**Purpose:** [What business/user need does this address?]

**Target Users:** [The Learner / Solo Developer / Development Team / Enterprise]

**Priority:** [P0 - MVP | P1 - Post-MVP | P2 - Future]

---

## Table of Contents

1. [User Perspective](#user-perspective)
2. [Technical Architecture](#technical-architecture)
3. [User Flows](#user-flows)
4. [Technical Implementation](#technical-implementation)
5. [API Contracts](#api-contracts)
6. [Security Considerations](#security-considerations)
7. [Performance Requirements](#performance-requirements)
8. [Testing Strategy](#testing-strategy)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## User Perspective

### What Users See

[Describe the feature from the user's perspective. What does it look like? How does it behave?]

**Key Capabilities:**
- [Capability 1]
- [Capability 2]
- [Capability 3]

### User Benefits

**For Learners (Beginners):**
- [Benefit 1]
- [Benefit 2]

**For Solo Developers:**
- [Benefit 1]
- [Benefit 2]

**For Development Teams:**
- [Benefit 1]
- [Benefit 2]

**For Enterprise:**
- [Benefit 1]
- [Benefit 2]

### Example Scenarios

**Scenario 1: [Common Use Case]**

[Describe a concrete scenario where a user would use this feature]

**Scenario 2: [Another Use Case]**

[Describe another scenario]

---

## Technical Architecture

### System Components

**Components involved:**
- **Frontend:** [React components, pages, state management]
- **Backend:** [API endpoints, Workers, Supabase functions]
- **Database:** [Tables, RLS policies]
- **External Services:** [Third-party integrations]

### Architecture Diagram

```
[ASCII diagram or Mermaid diagram showing component relationships]

Example:
┌─────────────┐
│   User UI   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│  Frontend   │────▶│   API Layer  │
│  Component  │     │  (Workers)   │
└─────────────┘     └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Supabase   │
                    │   Database   │
                    └──────────────┘
```

### Data Flow

1. **Step 1:** [User action or system event]
2. **Step 2:** [Frontend processing]
3. **Step 3:** [API call]
4. **Step 4:** [Backend processing]
5. **Step 5:** [Database interaction]
6. **Step 6:** [Response back to user]

---

## User Flows

### Flow 1: [Primary Flow Name]

**Trigger:** [What starts this flow?]

**Steps:**
1. User [action]
2. System [response]
3. User [next action]
4. System [final response]

**Success Criteria:** [What indicates successful completion?]

**Error Cases:**
- **Error 1:** [What can go wrong?] → [How is it handled?]
- **Error 2:** [Another error case] → [Resolution]

### Flow 2: [Secondary Flow Name]

[Repeat structure for each major flow]

---

## Technical Implementation

### Frontend Implementation

**Components:**
- `[ComponentName].tsx` - [Component purpose]
- `[AnotherComponent].tsx` - [Component purpose]

**State Management:**
- **Local state:** [What is managed locally?]
- **Global state (Zustand):** [What is in global state?]
- **Server state (React Query):** [What is cached from API?]

**Key Functions:**
```typescript
// Example function signature
async function [functionName]([params]): Promise<[ReturnType]> {
  // [Brief description of what this function does]
}
```

### Backend Implementation

**API Endpoints:**
- `POST [endpoint]` - [Purpose]
- `GET [endpoint]` - [Purpose]
- `PUT [endpoint]` - [Purpose]
- `DELETE [endpoint]` - [Purpose]

**Cloudflare Workers:**
- `[worker-name].ts` - [Worker purpose and responsibilities]

**Supabase Functions:**
- `[function-name]` - [Function purpose]

### Database Implementation

**Tables Used:**
- `[table_name]` - [Purpose and key columns]

**Key Queries:**
```sql
-- [Query purpose]
SELECT [columns]
FROM [tables]
WHERE [conditions];
```

**RLS Policies:**
- Policy: `[policy_name]` - [What it enforces]

---

## API Contracts

### Endpoint: [METHOD] [endpoint_path]

**Purpose:** [What does this endpoint do?]

**Request:**
```typescript
interface [RequestType] {
  [field]: [type]; // [description]
  [field2]: [type]; // [description]
}
```

**Example Request:**
```json
{
  "[field]": "[example_value]",
  "[field2]": "[example_value]"
}
```

**Response (Success - 200):**
```typescript
interface [ResponseType] {
  [field]: [type]; // [description]
  [field2]: [type]; // [description]
}
```

**Example Response:**
```json
{
  "[field]": "[example_value]",
  "[field2]": "[example_value]"
}
```

**Error Responses:**
- `400 Bad Request` - [When this occurs]
- `401 Unauthorized` - [When this occurs]
- `403 Forbidden` - [When this occurs]
- `404 Not Found` - [When this occurs]
- `500 Internal Server Error` - [When this occurs]

[Repeat for each API endpoint]

---

## Security Considerations

### Threat Model

**Potential Threats:**
1. **[Threat 1]** - [Description]
   - **Mitigation:** [How we prevent/mitigate this]

2. **[Threat 2]** - [Description]
   - **Mitigation:** [How we prevent/mitigate this]

### Security Controls

**Authentication:**
- [How is the user authenticated for this feature?]

**Authorization:**
- [What permissions are required?]
- [How are permissions enforced?]

**Data Protection:**
- [Is data encrypted? When and how?]
- [What data is encrypted client-side vs. server-side?]

**Audit Logging:**
- [What events are logged?]
- [What information is captured in logs?]

### Compliance

**GDPR:** [How does this feature handle GDPR requirements?]

**SOC 2:** [What controls are relevant for SOC 2 compliance?]

---

## Performance Requirements

### Performance Targets

- **Page Load:** [Target time, e.g., < 2s on 3G]
- **Time to Interactive:** [Target time, e.g., < 3s]
- **API Response:** [Target time, e.g., < 200ms p95]
- **Database Query:** [Target time, e.g., < 100ms p95]

### Optimization Strategy

**Frontend:**
- [Optimization technique 1]
- [Optimization technique 2]

**Backend:**
- [Optimization technique 1]
- [Optimization technique 2]

**Database:**
- [Indexes needed]
- [Query optimization]

### Load Handling

**Expected Load:**
- [Concurrent users]
- [Requests per second]

**Scalability:**
- [How does this scale?]
- [What are the bottlenecks?]

---

## Testing Strategy

### Unit Tests

**Frontend:**
- Test: [What to test]
- Coverage: [Expected coverage %]

**Backend:**
- Test: [What to test]
- Coverage: [Expected coverage %]

### Integration Tests

**Test Scenarios:**
1. [Test scenario 1]
2. [Test scenario 2]

### End-to-End Tests

**E2E Flows:**
1. [Complete user flow to test]
2. [Another user flow]

### Security Tests

**Security Test Cases:**
1. [Security test 1]
2. [Security test 2]

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `[dependency-doc-1.md]` - [Why needed]
- [ ] `[dependency-doc-2.md]` - [Why needed]

**External Services:**
- [Service 1] - [Purpose]
- [Service 2] - [Purpose]

### Feature Dependencies

**Depends on these features:**
- [Feature 1] - [Why]
- [Feature 2] - [Why]

**Enables these features:**
- [Feature 1] - [How]
- [Feature 2] - [How]

---

## References

### Internal Documentation
- `[related-doc-1.md]` - [What it covers]
- `[related-doc-2.md]` - [What it covers]
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [External resource 1] - [Description]
- [External resource 2] - [Description]

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | [Your Name] | Initial feature documentation |

---

## Notes

[Any additional notes, considerations, or future enhancements to consider]
```

---

## API Endpoint Documentation Template

**Purpose:** Document REST API endpoints with complete request/response specifications.

**Location:** `05-api/endpoints/`

**Use for:** Secrets API, Projects API, Authentication API, etc.

### Template

```markdown
---
Document: [API_ENDPOINT] - API Endpoint Documentation
Version: 1.0.0
Last Updated: YYYY-MM-DD
Owner: Backend Engineering
Status: Draft
Dependencies: [database schemas, security model, API design doc]
---

# [API_ENDPOINT] API Endpoints

## Overview

[2-3 sentence summary: What do these endpoints do? What resource do they manage?]

**Base URL:** `https://api.abyrith.com/v1`

**Resource:** [Resource name, e.g., "Secrets", "Projects", "Organizations"]

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
GET /[endpoint]?environment=production&status=active
```

### Sorting

**Query Parameter:**
```
sort=[field]:[asc|desc]
```

**Example:**
```
GET /[endpoint]?sort=created_at:desc
```

---

## Endpoints

### 1. Create [Resource]

**Endpoint:** `POST /[endpoint]`

**Description:** [What does this endpoint do?]

**Permissions Required:** `[permission_name]`

**Request:**
```typescript
interface CreateRequest {
  [field]: [type];        // [Description, constraints]
  [field2]?: [type];      // [Description, optional]
}
```

**Example Request:**
```json
POST /[endpoint]
{
  "[field]": "[example_value]",
  "[field2]": "[example_value]"
}
```

**Success Response (201 Created):**
```typescript
interface CreateResponse {
  id: string;
  [field]: [type];
  created_at: string;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "uuid-here",
  "[field]": "[value]",
  "created_at": "2025-10-29T12:00:00Z",
  "updated_at": "2025-10-29T12:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
  ```json
  {
    "error": "validation_error",
    "message": "Field [field] is required",
    "details": { "[field]": ["is required"] }
  }
  ```
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

**Validation Rules:**
- `[field]`: [Validation rules, e.g., "Required, max 255 characters"]
- `[field2]`: [Validation rules, e.g., "Optional, must be valid URL"]

---

### 2. Get [Resource] by ID

**Endpoint:** `GET /[endpoint]/:id`

**Description:** [What does this endpoint retrieve?]

**Permissions Required:** `[permission_name]`

**Path Parameters:**
- `id` (string, required) - [Resource] ID (UUID)

**Success Response (200 OK):**
```typescript
interface GetResponse {
  id: string;
  [field]: [type];
  created_at: string;
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "uuid-here",
  "[field]": "[value]",
  "created_at": "2025-10-29T12:00:00Z",
  "updated_at": "2025-10-29T12:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have access to this resource
- `404 Not Found` - Resource doesn't exist
- `500 Internal Server Error` - Server error

---

### 3. List [Resources]

**Endpoint:** `GET /[endpoint]`

**Description:** [What does this endpoint list? What filters are available?]

**Permissions Required:** `[permission_name]`

**Query Parameters:**
```typescript
interface ListParams extends PaginationParams {
  [filter1]?: [type];     // [Filter description]
  [filter2]?: [type];     // [Filter description]
  sort?: string;          // Sort field and direction
}
```

**Success Response (200 OK):**
```typescript
interface ListResponse {
  data: [ResourceType][];
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
      "id": "uuid-1",
      "[field]": "[value]"
    },
    {
      "id": "uuid-2",
      "[field]": "[value]"
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
- `401 Unauthorized` - Missing or invalid token
- `500 Internal Server Error` - Server error

---

### 4. Update [Resource]

**Endpoint:** `PUT /[endpoint]/:id` or `PATCH /[endpoint]/:id`

**Description:** [What does this endpoint update?]

**Permissions Required:** `[permission_name]`

**Path Parameters:**
- `id` (string, required) - [Resource] ID (UUID)

**Request:**
```typescript
interface UpdateRequest {
  [field]?: [type];       // [Description, optional]
  [field2]?: [type];      // [Description, optional]
}
```

**Example Request:**
```json
PUT /[endpoint]/:id
{
  "[field]": "[new_value]"
}
```

**Success Response (200 OK):**
```typescript
interface UpdateResponse {
  id: string;
  [field]: [type];
  updated_at: string;
}
```

**Example Response:**
```json
{
  "id": "uuid-here",
  "[field]": "[new_value]",
  "updated_at": "2025-10-29T13:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Update conflicts with existing state
- `500 Internal Server Error` - Server error

---

### 5. Delete [Resource]

**Endpoint:** `DELETE /[endpoint]/:id`

**Description:** [What does this endpoint delete? Is it soft or hard delete?]

**Permissions Required:** `[permission_name]`

**Path Parameters:**
- `id` (string, required) - [Resource] ID (UUID)

**Success Response (204 No Content):**
```
[Empty response body]
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Cannot delete due to dependencies
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
| 409 | `conflict` | Resource conflict |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |

### Error Handling Best Practices

**Client-side handling:**
1. Always check HTTP status code first
2. Parse error response body
3. Display user-friendly error messages
4. Log full error details for debugging
5. Implement exponential backoff for 429 errors

---

## Rate Limiting

### Rate Limit Rules

**Per User:**
- [X] requests per minute
- [Y] requests per hour

**Per IP Address:**
- [X] requests per minute (unauthenticated)

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

### Example 1: [Common Workflow]

**Scenario:** [Describe a complete workflow]

**Step 1: [Action]**
```bash
curl -X POST https://api.abyrith.com/v1/[endpoint] \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "[field]": "[value]"
  }'
```

**Response:**
```json
{
  "id": "uuid-here",
  "[field]": "[value]"
}
```

**Step 2: [Next action]**
```bash
curl -X GET https://api.abyrith.com/v1/[endpoint]/uuid-here \
  -H "Authorization: Bearer {token}"
```

---

### Example 2: [Another Workflow]

[Repeat structure for another common workflow]

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `04-database/schemas/[schema-name].md` - Database schema definition
- [ ] `03-security/rbac/permissions-model.md` - Permission definitions
- [ ] `05-api/rest-api-design.md` - API design patterns

**Related APIs:**
- `[related-api-1.md]` - [How they interact]
- `[related-api-2.md]` - [How they interact]

---

## References

### Internal Documentation
- `05-api/rest-api-design.md` - REST API patterns
- `03-security/auth/authentication-flow.md` - Authentication details
- `TECH-STACK.md` - Technology stack
- `GLOSSARY.md` - Term definitions

### External Resources
- [OpenAPI Specification](https://swagger.io/specification/) - API specification standard
- [REST API Best Practices](https://restfulapi.net/) - REST patterns

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | [Your Name] | Initial API endpoint documentation |

---

## Notes

[Any additional implementation notes, known issues, or future improvements]
```

---

## Database Schema Documentation Template

**Purpose:** Document database tables, columns, relationships, and policies.

**Location:** `04-database/schemas/`

**Use for:** Users & Organizations schema, Secrets schema, Audit Logs schema, etc.

### Template

```markdown
---
Document: [TABLE_NAME] - Database Schema
Version: 1.0.0
Last Updated: YYYY-MM-DD
Owner: Database Engineer
Status: Draft
Dependencies: [security model, other schemas, RBAC policies]
---

# [TABLE_NAME] Database Schema

## Overview

[2-3 sentence summary: What data does this schema manage? What is its purpose?]

**Schema:** [Schema name, e.g., "public", "auth"]

**Multi-tenancy:** [How is data isolated? Organization-level? User-level?]

**Encryption:** [What is encrypted? At rest? In transit? Client-side?]

---

## Table of Contents

1. [Tables](#tables)
2. [Relationships](#relationships)
3. [Row-Level Security (RLS)](#row-level-security-rls)
4. [Indexes](#indexes)
5. [Triggers](#triggers)
6. [Functions](#functions)
7. [Migration Scripts](#migration-scripts)
8. [Sample Queries](#sample-queries)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## Tables

### Table: `[table_name]`

**Purpose:** [What does this table store?]

**Ownership:** [Who owns records in this table? Users? Organizations?]

**Definition:**

```sql
CREATE TABLE [table_name] (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  [foreign_key_id] UUID NOT NULL REFERENCES [other_table](id) ON DELETE CASCADE,

  -- Data Fields
  [field_name] [TYPE] [CONSTRAINTS],
  [field_name_2] [TYPE] [CONSTRAINTS],

  -- Metadata Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT [constraint_name] [CONSTRAINT_DEFINITION]
);
```

**Column Descriptions:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `[field_name]` | [TYPE] | [Yes/No] | [DEFAULT] | [Description] |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last update timestamp |

**Constraints:**

| Name | Type | Definition | Purpose |
|------|------|------------|---------|
| `[constraint_name]` | UNIQUE | `([field1], [field2])` | [Why this constraint exists] |
| `[check_name]` | CHECK | `[field] > 0` | [What this validates] |

**Validation Rules:**
- `[field_name]`: [Validation rules, e.g., "Max 255 characters, no special characters"]
- `[field_name_2]`: [Validation rules]

---

### Table: `[another_table_name]`

[Repeat the structure above for each table in the schema]

---

## Relationships

### Entity Relationship Diagram

```
[ASCII or Mermaid ERD showing table relationships]

Example:
┌─────────────────┐
│  organizations  │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐     ┌──────────────┐
│  org_members    │  N  │   projects   │
└────────┬────────┘◄───┬┘
         │             │
         │             │ 1
         │ 1           │
         │             │ N
         │        ┌────▼──────┐
         │        │  secrets  │
         │        └───────────┘
```

### Relationship Details

**organizations → org_members**
- Type: One-to-Many
- Foreign Key: `org_members.organization_id → organizations.id`
- Cascade: `ON DELETE CASCADE`
- Description: [Explain the relationship]

**org_members → users**
- Type: Many-to-One
- Foreign Key: `org_members.user_id → auth.users.id`
- Cascade: `ON DELETE CASCADE`
- Description: [Explain the relationship]

[Document each relationship]

---

## Row-Level Security (RLS)

### RLS Overview

**RLS Enabled:** Yes

**Purpose:** [Why RLS is needed for these tables. What does it protect?]

**Multi-tenancy Strategy:** [How RLS enforces data isolation]

---

### Table: `[table_name]`

**RLS Policy 1: `[policy_name]`**

**Purpose:** [What does this policy allow/prevent?]

**Operation:** `SELECT` | `INSERT` | `UPDATE` | `DELETE` | `ALL`

**Role:** `authenticated` | `anon` | `service_role`

**Definition:**
```sql
CREATE POLICY [policy_name] ON [table_name]
  FOR [OPERATION]
  TO [ROLE]
  USING (
    [CONDITION]
  )
  [WITH CHECK (
    [CONDITION]
  )];
```

**Example Scenario:**
[Describe when this policy applies and what it allows]

**RLS Policy 2: `[another_policy_name]`**

[Repeat for each policy]

---

### RLS Testing

**Test Case 1: [Scenario]**
```sql
-- As user A
SET request.jwt.claim.sub = '[user_a_id]';

-- This should succeed
SELECT * FROM [table_name] WHERE [condition];

-- This should fail
SELECT * FROM [table_name] WHERE [different_condition];
```

**Expected:** [What should happen]

**Test Case 2: [Another scenario]**

[Document test cases to verify RLS works correctly]

---

## Indexes

### Performance Indexes

**Index 1: `[index_name]`**

**Purpose:** [Why this index is needed. What queries does it optimize?]

**Table:** `[table_name]`

**Columns:** `([column1], [column2])`

**Type:** B-tree | Hash | GiST | GIN

**Definition:**
```sql
CREATE INDEX [index_name]
  ON [table_name] ([column1], [column2]);
```

**Queries Optimized:**
```sql
-- Example query that uses this index
SELECT * FROM [table_name]
WHERE [column1] = $1 AND [column2] = $2;
```

**Performance Impact:**
- Query time: [Before index] → [After index]
- Index size: [Estimated size]

**Index 2: `[another_index_name]`**

[Repeat for each index]

---

## Triggers

### Trigger: `[trigger_name]`

**Purpose:** [What does this trigger do?]

**Table:** `[table_name]`

**Event:** `BEFORE` | `AFTER` `INSERT` | `UPDATE` | `DELETE`

**Definition:**
```sql
CREATE TRIGGER [trigger_name]
  [BEFORE|AFTER] [INSERT|UPDATE|DELETE] ON [table_name]
  FOR EACH ROW
  EXECUTE FUNCTION [function_name]();
```

**Example:**
```sql
-- Trigger function
CREATE OR REPLACE FUNCTION [function_name]()
RETURNS TRIGGER AS $$
BEGIN
  -- [What the function does]
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER [trigger_name]
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW
  EXECUTE FUNCTION [function_name]();
```

---

## Functions

### Function: `[function_name]`

**Purpose:** [What does this function do?]

**Parameters:**
- `[param1]` ([TYPE]) - [Description]
- `[param2]` ([TYPE]) - [Description]

**Returns:** [RETURN_TYPE]

**Definition:**
```sql
CREATE OR REPLACE FUNCTION [function_name]([param1] [TYPE], [param2] [TYPE])
RETURNS [RETURN_TYPE] AS $$
BEGIN
  -- [Function logic]
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage Example:**
```sql
SELECT [function_name]('[param1_value]', '[param2_value]');
```

**Security Considerations:**
- [Any security considerations for this function]
- [Why SECURITY DEFINER is or isn't used]

---

## Migration Scripts

### Initial Migration (v1.0.0)

**File:** `migrations/001_create_[schema_name].sql`

**Description:** [What does this migration create?]

**SQL:**
```sql
-- Create tables
CREATE TABLE [table_name] (
  -- [Table definition from above]
);

-- Create indexes
CREATE INDEX [index_name] ON [table_name] ([columns]);

-- Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY [policy_name] ON [table_name]
  FOR [OPERATION] TO [ROLE]
  USING ([CONDITION]);

-- Create triggers
CREATE TRIGGER [trigger_name]
  [TIMING] [EVENT] ON [table_name]
  FOR EACH ROW
  EXECUTE FUNCTION [function_name]();
```

**Verification:**
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = '[schema]';

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = '[table_name]';
```

**Rollback:**
```sql
DROP TABLE IF EXISTS [table_name] CASCADE;
```

---

### Migration: [Description] (vX.Y.Z)

[Document each subsequent migration]

---

## Sample Queries

### Query 1: [Common Operation]

**Purpose:** [What does this query accomplish?]

**SQL:**
```sql
SELECT
  [fields]
FROM [table_name]
WHERE [conditions]
ORDER BY [field]
LIMIT 10;
```

**Explanation:** [Explain the query logic]

**Performance:** [Expected performance, index usage]

---

### Query 2: [Another Common Operation]

**Purpose:** [What does this query accomplish?]

**SQL:**
```sql
-- [Query with explanation comments]
```

[Document common queries that will be used frequently]

---

## Dependencies

### Schema Dependencies

**Must exist before this schema:**
- [ ] `auth.users` (Supabase managed) - User authentication
- [ ] `[other-schema].md` - [Why needed]

**Required by these schemas:**
- `[dependent-schema].md` - [How it uses this schema]

### Feature Dependencies

**Required by features:**
- `08-features/[feature-name].md` - [How feature uses this schema]

---

## References

### Internal Documentation
- `04-database/database-overview.md` - Database architecture
- `03-security/rbac/rls-policies.md` - RLS patterns
- `TECH-STACK.md` - Technology stack
- `GLOSSARY.md` - Term definitions

### External Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - PostgreSQL reference
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security) - RLS patterns

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | [Your Name] | Initial schema definition |

---

## Notes

### Future Enhancements
- [Potential schema improvements]
- [Performance optimizations to consider]

### Known Issues
- [Any known limitations or issues]

### Migration Considerations
- [Things to be careful about when migrating]
```

---

## Integration Guide Template

**Purpose:** Document integration with external services and APIs.

**Location:** `09-integrations/`

**Use for:** Claude API, FireCrawl, MCP, Cursor, OAuth providers, etc.

### Template

```markdown
---
Document: [INTEGRATION_NAME] - Integration Guide
Version: 1.0.0
Last Updated: YYYY-MM-DD
Owner: Integration Engineer
Status: Draft
Dependencies: [API docs, security model, feature docs]
---

# [INTEGRATION_NAME] Integration

## Overview

[2-3 sentence summary: What is this integration? Why do we need it? What does it enable?]

**External Service:** [Service name and website]

**Integration Type:** [API integration | OAuth provider | MCP server | Webhook | etc.]

**Status:** [Active | Planned | Deprecated]

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Implementation Details](#implementation-details)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Monitoring](#monitoring)
10. [Security Considerations](#security-considerations)
11. [Cost & Rate Limits](#cost--rate-limits)
12. [Troubleshooting](#troubleshooting)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Integration Purpose

### Business Value

**What it enables:**
- [Capability 1]
- [Capability 2]
- [Capability 3]

**User benefits:**
- [Benefit 1]
- [Benefit 2]

### Technical Purpose

**Responsibilities:**
- [What this integration handles]
- [Data it processes]
- [Services it connects]

**Integration Points:**
- [Where in the system this is used]

---

## Architecture

### System Diagram

```
[ASCII or Mermaid diagram showing integration architecture]

Example:
┌──────────────┐
│   Abyrith    │
│   Backend    │
└──────┬───────┘
       │
       │ HTTPS/API calls
       ▼
┌──────────────────┐
│  [External       │
│   Service]       │
└──────────────────┘
```

### Data Flow

**Outbound (Abyrith → External Service):**
1. [Step 1 in the flow]
2. [Step 2]
3. [Step 3]

**Inbound (External Service → Abyrith):**
1. [Step 1 in the flow]
2. [Step 2]
3. [Step 3]

### Components Involved

**Frontend:**
- [Component 1] - [Purpose]

**Backend:**
- [Service 1] - [Purpose]
- [Worker 1] - [Purpose]

**External:**
- [External service component]

---

## Authentication

### Authentication Method

**Type:** [API Key | OAuth 2.0 | JWT | HMAC Signature]

**How it works:**
[Explain the authentication flow]

### Credentials Management

**Where credentials are stored:**
- **Development:** [.env.local file]
- **Staging:** [Cloudflare Workers secrets]
- **Production:** [Cloudflare Workers secrets]

**Credential Format:**
```bash
[SERVICE]_API_KEY=your_key_here
[SERVICE]_SECRET=your_secret_here
```

### Obtaining Credentials

**Step 1:** [How to get credentials]

**Step 2:** [Configuration steps]

**Step 3:** [Verification]

---

## Configuration

### Environment Variables

**Required:**
```bash
[SERVICE]_API_KEY=                # [Description]
[SERVICE]_ENDPOINT=               # [Description]
```

**Optional:**
```bash
[SERVICE]_TIMEOUT=30000           # [Description, default: 30s]
[SERVICE]_RETRY_ATTEMPTS=3        # [Description, default: 3]
```

### Configuration File

**Location:** `[path/to/config]`

**Structure:**
```typescript
interface [IntegrationConfig] {
  apiKey: string;
  endpoint: string;
  timeout?: number;
  retryAttempts?: number;
}
```

**Example:**
```typescript
const config: [IntegrationConfig] = {
  apiKey: process.env.[SERVICE]_API_KEY!,
  endpoint: process.env.[SERVICE]_ENDPOINT!,
  timeout: 30000,
  retryAttempts: 3
};
```

---

## API Reference

### Client Setup

**Installation:**
```bash
pnpm add [service-sdk]
```

**Initialization:**
```typescript
import { [ServiceClient] } from '[service-sdk]';

const client = new [ServiceClient]({
  apiKey: config.apiKey,
  endpoint: config.endpoint
});
```

### Available Methods

#### Method 1: `[methodName]`

**Purpose:** [What does this method do?]

**Signature:**
```typescript
async function [methodName](
  [param1]: [Type],
  [param2]: [Type]
): Promise<[ReturnType]>
```

**Parameters:**
- `[param1]` - [Description]
- `[param2]` - [Description]

**Returns:**
```typescript
interface [ReturnType] {
  [field]: [type];
}
```

**Example Usage:**
```typescript
const result = await client.[methodName](
  '[param1_value]',
  '[param2_value]'
);

console.log(result);
// Output: { [field]: '[value]' }
```

**Error Cases:**
- [Error 1] - [When it occurs, how to handle]
- [Error 2] - [When it occurs, how to handle]

---

#### Method 2: `[anotherMethod]`

[Repeat structure for each method]

---

## Implementation Details

### Integration Code

**File:** `[path/to/integration/file.ts]`

**Implementation:**
```typescript
// [Integration implementation]
export class [IntegrationService] {
  private client: [ServiceClient];

  constructor(config: [IntegrationConfig]) {
    this.client = new [ServiceClient](config);
  }

  async [method]([params]): Promise<[ReturnType]> {
    try {
      // [Implementation logic]
      const result = await this.client.[apiMethod]([params]);
      return this.transformResponse(result);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private transformResponse([response]): [ReturnType] {
    // [Transform external API response to internal format]
  }

  private handleError([error]): [ErrorType] {
    // [Error handling logic]
  }
}
```

### Data Transformation

**External Format → Internal Format:**
```typescript
// External API response
interface [ExternalResponse] {
  [external_field]: [type];
}

// Internal format
interface [InternalFormat] {
  [internal_field]: [type];
}

function transform(external: [ExternalResponse]): [InternalFormat] {
  return {
    [internal_field]: external.[external_field]
  };
}
```

---

## Error Handling

### Error Types

**Error 1: [Error Name]**
- **When:** [When this error occurs]
- **External Code:** `[error_code]`
- **Internal Code:** `[mapped_error_code]`
- **Recovery:** [How to handle]

**Error 2: [Another Error]**
- **When:** [When this error occurs]
- **Recovery:** [How to handle]

### Retry Strategy

**Retry Policy:**
- Attempts: [Number]
- Backoff: [Exponential/Linear]
- Max wait: [Time]

**Retriable Errors:**
- `[error_code_1]` - [Why retriable]
- `[error_code_2]` - [Why retriable]

**Non-Retriable Errors:**
- `[error_code_1]` - [Why not retriable]

**Implementation:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = 3
): Promise<T> {
  // [Retry logic implementation]
}
```

---

## Testing

### Unit Tests

**Test File:** `[path/to/test/file.test.ts]`

**Mock Setup:**
```typescript
import { mock[ServiceClient] } from '[service-sdk]/mocks';

describe('[IntegrationService]', () => {
  it('should [test case]', async () => {
    // [Test implementation]
  });
});
```

### Integration Tests

**Test Scenario 1: [Scenario]**
```typescript
describe('[Integration scenario]', () => {
  it('should handle [specific case]', async () => {
    // [Test implementation]
  });
});
```

### Manual Testing

**Test in development:**
```bash
# [Commands to test integration manually]
```

**Verify:**
- [ ] [Verification step 1]
- [ ] [Verification step 2]

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- Request count
- Success rate
- Error rate
- Latency (p50, p95, p99)

**Business Metrics:**
- [Business metric 1]
- [Business metric 2]

### Logging

**Log Level:** INFO | WARN | ERROR

**Logged Events:**
- Request initiated
- Request succeeded
- Request failed
- Retry attempted

**Log Format:**
```typescript
{
  event: '[event_name]',
  service: '[INTEGRATION_NAME]',
  method: '[method_name]',
  duration_ms: 123,
  status: 'success' | 'error',
  error?: '[error_message]'
}
```

### Alerts

**Alert 1: High Error Rate**
- **Condition:** Error rate > [threshold]% over [time period]
- **Severity:** P2
- **Action:** [What to do]

**Alert 2: Service Unavailable**
- **Condition:** All requests failing for [time period]
- **Severity:** P1
- **Action:** [What to do]

---

## Security Considerations

### Data Privacy

**Data sent to external service:**
- [What data is sent]
- [Is it PII? If yes, is it necessary?]

**Data received from external service:**
- [What data is received]
- [How is it stored? Encrypted?]

### Credential Security

**How credentials are protected:**
- [Storage method]
- [Access control]
- [Rotation policy]

### Compliance

**GDPR:** [How this integration handles GDPR requirements]

**SOC 2:** [Relevant SOC 2 controls]

---

## Cost & Rate Limits

### Pricing Model

**Pricing structure:**
- [How external service charges]
- [Cost per request/user/etc.]

**Estimated monthly cost:**
- [Calculation based on expected usage]

### Rate Limits

**Limits:**
- [Requests per second/minute/hour]
- [Quota limits]

**How we handle limits:**
- [Rate limiting strategy]
- [Queueing strategy]

**Monitoring usage:**
- [How to track usage]
- [Alerts for approaching limits]

---

## Troubleshooting

### Issue 1: [Common Problem]

**Symptoms:**
```
[Error message or behavior]
```

**Cause:** [Why this happens]

**Solution:**
```bash
# [Commands or steps to fix]
```

---

### Issue 2: [Another Problem]

[Repeat structure]

---

### Debug Mode

**Enable debug logging:**
```bash
[SERVICE]_DEBUG=true
```

**What gets logged:**
- [Debug information available]

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [ ] `[dependency-1.md]` - [Why needed]
- [ ] `[dependency-2.md]` - [Why needed]

**External Dependencies:**
- [External service account]
- [API access/credentials]

### Feature Dependencies

**Required by features:**
- `08-features/[feature-name].md` - [How feature uses this]

---

## References

### Internal Documentation
- `TECH-STACK.md` - Technology stack
- `06-backend/cloudflare-workers/workers-overview.md` - Worker configuration
- `GLOSSARY.md` - Term definitions

### External Resources
- [[Service] Documentation](URL) - Official docs
- [[Service] API Reference](URL) - API reference
- [[Service] Status Page](URL) - Service status

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | [Your Name] | Initial integration documentation |

---

## Notes

### Future Improvements
- [Potential enhancements]
- [Alternative approaches to consider]

### Known Limitations
- [Limitation 1]
- [Limitation 2]
```

---

## Operations Runbook Template

**Purpose:** Document operational procedures for deployment, incidents, and maintenance.

**Location:** `10-operations/`

**Use for:** Deployment runbooks, incident response, database maintenance, security procedures, etc.

### Template

```markdown
---
Document: [RUNBOOK_NAME] - Operations Runbook
Version: 1.0.0
Last Updated: YYYY-MM-DD
Owner: Operations/DevOps
Status: Draft
Dependencies: [deployment pipeline, monitoring setup, architecture docs]
---

# [RUNBOOK_NAME] Operations Runbook

## Overview

[2-3 sentence summary: What operational procedure does this document cover? When is it used?]

**Purpose:** [Specific goal of this runbook]

**Frequency:** [How often is this performed? On-demand, weekly, monthly?]

**Estimated Time:** [How long does this procedure take?]

**Risk Level:** [Low | Medium | High | Critical]

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [Procedure](#procedure)
5. [Verification](#verification)
6. [Rollback](#rollback)
7. [Troubleshooting](#troubleshooting)
8. [Post-Procedure](#post-procedure)
9. [Communication](#communication)
10. [Dependencies](#dependencies)
11. [References](#references)
12. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- [Trigger condition 1]
- [Trigger condition 2]
- [Trigger condition 3]

**Do NOT use this runbook when:**
- [Exclusion 1]
- [Exclusion 2]

### Scope

**What this covers:**
- [Scope item 1]
- [Scope item 2]

**What this does NOT cover:**
- [Out of scope item 1]
- [Out of scope item 2]

---

## Prerequisites

### Required Access

**Systems:**
- [ ] [System 1] - [Access level needed]
- [ ] [System 2] - [Access level needed]
- [ ] [System 3] - [Access level needed]

**Credentials:**
- [ ] [Credential 1] - [What it's for]
- [ ] [Credential 2] - [What it's for]

**How to request access:**
[Process for getting access if you don't have it]

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
[tool1] --version  # Should be [version] or higher
[tool2] --version  # Should be [version] or higher
```

**Installation:**
```bash
# If tools are missing
pnpm install -g [tool1]
brew install [tool2]
```

### Required Knowledge

**You should understand:**
- [Concept 1]
- [Concept 2]
- [Concept 3]

**Reference documentation:**
- `[doc1.md]` - [What to review]
- `[doc2.md]` - [What to review]

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication
- [ ] Notify team in [Slack channel]
- [ ] Create incident/maintenance ticket: [Ticket system]
- [ ] Update status page (if customer-facing): [Status page URL]

### 2. Backup
- [ ] Verify recent backup exists
- [ ] Backup timestamp: [How to check]
- [ ] Backup verification: [How to verify backup is valid]

### 3. Environment Check
- [ ] Verify current system state
- [ ] Check for ongoing operations
- [ ] Review recent changes/deployments
- [ ] Check system health metrics

### 4. Timing
- [ ] Confirm maintenance window (if applicable)
- [ ] Verify low-traffic period
- [ ] Coordinate with dependent teams

### 5. Preparation
- [ ] Read through entire runbook
- [ ] Prepare rollback plan
- [ ] Have emergency contacts ready

---

## Procedure

### Step 1: [First Action]

**Purpose:** [Why this step is necessary]

**Commands:**
```bash
# [Description of what this does]
[command1]

# Verify
[verification_command]
```

**Expected output:**
```
[What you should see]
```

**If something goes wrong:**
- [Error message] → [What to do]

**Time:** ~[X minutes]

---

### Step 2: [Second Action]

**Purpose:** [Why this step is necessary]

**Commands:**
```bash
[command2]
```

**Expected output:**
```
[What you should see]
```

**Important notes:**
- ⚠️ [Warning about this step]
- ℹ️ [Important information]

**Time:** ~[X minutes]

---

### Step 3: [Third Action]

[Repeat structure for each step]

**Checkpoint:** After this step, [what should be true]

---

### Step 4: [Continue...]

[Continue with all procedure steps]

---

## Verification

### Post-Procedure Checks

**1. System Health:**
```bash
# Check system is responding
[health_check_command]
```

**Expected:** [What indicates success]

---

**2. Functionality Tests:**
```bash
# Test critical functionality
[test_command_1]
[test_command_2]
```

**Expected:** [What indicates success]

---

**3. Monitoring:**
- [ ] Check dashboards: [Dashboard URLs]
- [ ] Verify metrics are normal
- [ ] Check error rates
- [ ] Review logs for errors

**Metrics to check:**
- [Metric 1]: Should be [expected value/range]
- [Metric 2]: Should be [expected value/range]

---

**4. User Impact:**
- [ ] Verify users can access system
- [ ] Test key user flows
- [ ] Check no increase in support tickets

---

### Success Criteria

**Procedure is successful when:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] All verification checks pass
- [ ] No errors in logs
- [ ] Metrics within normal range

---

## Rollback

### When to Rollback

**Rollback if:**
- [Condition 1 that requires rollback]
- [Condition 2 that requires rollback]
- [Time limit] has passed without successful verification

### Rollback Procedure

**Step 1: Stop Forward Progress**
```bash
# [Commands to stop current procedure]
```

---

**Step 2: Restore Previous State**
```bash
# [Commands to rollback changes]
```

**Time:** ~[X minutes]

---

**Step 3: Verify Rollback**
```bash
# [Commands to verify system is back to previous state]
```

**Expected:** [What indicates successful rollback]

---

**Step 4: Notify**
- [ ] Update team in [Slack channel]
- [ ] Update status page
- [ ] Document what went wrong

---

### Post-Rollback

**After rollback:**
1. Investigate root cause
2. Update runbook if needed
3. Plan retry with fixes
4. Schedule post-mortem (if major incident)

---

## Troubleshooting

### Issue 1: [Common Problem]

**Symptoms:**
```
[Error message or behavior]
```

**Cause:** [Why this happens]

**Solution:**
```bash
# [Commands to fix]
```

**If solution doesn't work:**
- [Next step to try]
- [Who to escalate to]

---

### Issue 2: [Another Problem]

[Repeat structure for common issues]

---

### Emergency Contacts

**If you need help:**

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| Primary | [Name] | [Contact method] | Immediate |
| Backup | [Name] | [Contact method] | If primary unavailable |
| Escalation | [Name] | [Contact method] | After [X] minutes |

---

## Post-Procedure

### Cleanup

**After successful completion:**
```bash
# [Cleanup commands]
```

### Documentation

**Update these documents:**
- [ ] This runbook (if issues/improvements identified)
- [ ] [Related documentation]
- [ ] Incident/maintenance ticket

### Communication

**Notify:**
- [ ] Team in [Slack channel]: "Procedure completed successfully"
- [ ] Update status page (if customer-facing)
- [ ] Close maintenance ticket
- [ ] Send summary to stakeholders (if major procedure)

### Monitoring

**Increased monitoring period:**
- Monitor for [time period] after procedure
- Watch for [specific metrics/issues]
- Set up temporary alerts (if applicable)

---

## Communication

### Communication Templates

**Pre-Procedure Announcement:**
```
📢 [RUNBOOK_NAME] Scheduled

When: [Date/Time] ([Timezone])
Duration: ~[X] minutes
Impact: [Expected impact]
Purpose: [Why we're doing this]

Updates: [Where updates will be posted]
```

---

**During Procedure:**
```
🔧 [RUNBOOK_NAME] in progress

Status: [Current step]
Progress: [X]% complete
ETA: [Estimated completion time]

Everything proceeding as expected.
```

---

**Completion:**
```
✅ [RUNBOOK_NAME] Complete

Completed: [Time]
Duration: [Actual duration]
Status: Success

All systems operational. Monitoring for [time period].
```

---

**Rollback Announcement:**
```
⚠️ [RUNBOOK_NAME] Rolled Back

Rollback completed: [Time]
Reason: [Brief explanation]
Impact: [Any impact]

System restored to previous state. Investigation underway.
Post-mortem: [When/where]
```

---

## Dependencies

### Technical Dependencies

**Must exist before procedure:**
- [ ] `[dependency-1.md]` - [Why needed]
- [ ] `[dependency-2.md]` - [Why needed]

**Systems involved:**
- [System 1] - [Role in procedure]
- [System 2] - [Role in procedure]

### Team Dependencies

**Requires coordination with:**
- [Team 1] - [What they need to do]
- [Team 2] - [What they need to do]

---

## References

### Internal Documentation
- `10-operations/[related-runbook].md` - [Related procedure]
- `02-architecture/system-overview.md` - Architecture overview
- `TECH-STACK.md` - Technology stack

### External Resources
- [[Tool] Documentation](URL) - Tool reference
- [[Service] Status](URL) - Service status page

### Incident History

**Previous incidents related to this procedure:**
- [Date]: [Brief description] - [Ticket link] - [Lessons learned]

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | [Your Name] | Initial runbook |

---

## Notes

### Improvements Needed
- [Potential improvement 1]
- [Potential improvement 2]

### Lessons Learned
- [Lesson 1 from previous executions]
- [Lesson 2]

### Next Review Date
[Date to review and update this runbook]
```

---

## Architecture Document Template

**Purpose:** Document architectural components, patterns, and technical decisions.

**Location:** `02-architecture/`

**Use for:** System architecture, security model, authentication flow, component design, etc.

### Template

```markdown
---
Document: [COMPONENT_NAME] - Architecture
Version: 1.0.0
Last Updated: YYYY-MM-DD
Owner: Engineering Lead
Status: Draft
Dependencies: [system overview, tech stack, related architecture docs]
---

# [COMPONENT_NAME] Architecture

## Overview

[2-3 sentence summary: What component/system does this document describe? What is its role in the overall system?]

**Purpose:** [What problem does this component solve?]

**Scope:** [What is included/excluded from this document]

**Status:** [Proposed | In Development | Implemented | Deprecated]

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
[Describe the current state or problem that necessitates this architecture]

**Pain points:**
- [Pain point 1]
- [Pain point 2]
- [Pain point 3]

**Why now?**
[Why is this being built/changed now?]

### Background

**Existing system (if applicable):**
[Describe current architecture this replaces/enhances]

**Previous attempts:**
[Any previous approaches tried? Why did they fail/succeed?]

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| [Role/Team] | [What they care about] | [Their concerns] |
| [Role/Team] | [What they care about] | [Their concerns] |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. [Goal 1] - [Success metric]
2. [Goal 2] - [Success metric]
3. [Goal 3] - [Success metric]

**Secondary goals:**
- [Goal A]
- [Goal B]

### Non-Goals

**Explicitly out of scope:**
- [Non-goal 1] - [Why out of scope]
- [Non-goal 2] - [Why out of scope]
- [Non-goal 3] - [Why out of scope]

### Success Metrics

**How we measure success:**
- [Metric 1]: [Target value]
- [Metric 2]: [Target value]
- [Metric 3]: [Target value]

---

## Architecture Overview

### High-Level Architecture

```
[ASCII or Mermaid diagram showing system architecture]

Example:
┌─────────────────────────────────────────┐
│          Client Layer                   │
│  (Browser, Mobile, CLI, AI Tools)       │
└────────────┬────────────────────────────┘
             │
             │ HTTPS
             ▼
┌─────────────────────────────────────────┐
│       Edge Layer                        │
│  (Cloudflare Workers, Rate Limiting)    │
└────────────┬────────────────────────────┘
             │
             │ Internal API
             ▼
┌─────────────────────────────────────────┐
│       Application Layer                 │
│  (Business Logic, Validation)           │
└────────────┬────────────────────────────┘
             │
             │ SQL/Realtime
             ▼
┌─────────────────────────────────────────┐
│       Data Layer                        │
│  (PostgreSQL, Row-Level Security)       │
└─────────────────────────────────────────┘
```

### Key Components

**Component 1: [Name]**
- **Purpose:** [What it does]
- **Technology:** [What it's built with]
- **Responsibilities:** [What it's responsible for]

**Component 2: [Name]**
- **Purpose:** [What it does]
- **Technology:** [What it's built with]
- **Responsibilities:** [What it's responsible for]

[List all major components]

### Component Interactions

**[Component A] ↔ [Component B]:**
- Protocol: [HTTP/gRPC/WebSocket/etc.]
- Data format: [JSON/Protocol Buffers/etc.]
- Authentication: [How authenticated]

**[Component B] ↔ [Component C]:**
[Repeat for each interaction]

---

## Component Details

### Component: [Component Name]

**Purpose:** [Detailed explanation of what this component does]

**Responsibilities:**
- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

**Technology Stack:**
- [Technology 1] - [Why chosen]
- [Technology 2] - [Why chosen]

**Internal Architecture:**
```
[Diagram showing internal structure of this component]
```

**Key Modules:**
- `[ModuleName]` - [Purpose]
- `[AnotherModule]` - [Purpose]

**Configuration:**
```typescript
interface [ComponentConfig] {
  [option1]: [type];  // [Description]
  [option2]: [type];  // [Description]
}
```

**Example:**
```typescript
const config: [ComponentConfig] = {
  [option1]: '[value]',
  [option2]: '[value]'
};
```

[Repeat for each major component]

---

## Data Flow

### Flow 1: [Primary Flow Name]

**Trigger:** [What initiates this flow]

**Steps:**

1. **[Component A]:** [Action]
   ```typescript
   // Example code
   [code_snippet]
   ```

2. **[Component B]:** [Action]
   ```typescript
   // Example code
   [code_snippet]
   ```

3. **[Component C]:** [Action]
   ```typescript
   // Example code
   [code_snippet]
   ```

**Sequence Diagram:**
```
[Sequence diagram showing message flow]

User       Frontend    API        Database
  |           |         |            |
  |--request->|         |            |
  |           |--call-->|            |
  |           |         |--query---->|
  |           |         |<--result---|
  |           |<--resp--|            |
  |<-display--|         |            |
```

**Data Transformations:**
- [Point A]: Data format is [format1]
- [Point B]: Data transformed to [format2]
- [Point C]: Data stored as [format3]

---

### Flow 2: [Secondary Flow Name]

[Repeat structure for each major flow]

---

## API Contracts

### Internal APIs

**API: [API Name]**

**Endpoint:** `[METHOD] [path]`

**Purpose:** [What this API does]

**Request:**
```typescript
interface [RequestType] {
  [field]: [type];
}
```

**Response:**
```typescript
interface [ResponseType] {
  [field]: [type];
}
```

**Error Handling:**
- [Error condition 1] → [How handled]
- [Error condition 2] → [How handled]

[Document each internal API]

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Client ↔ Edge**
- **Threats:** [Potential threats]
- **Controls:** [Security controls in place]

**Boundary 2: Edge ↔ Application**
- **Threats:** [Potential threats]
- **Controls:** [Security controls in place]

[Document each trust boundary]

### Authentication & Authorization

**Authentication:**
- Method: [How users/services are authenticated]
- Token format: [JWT/API key/etc.]
- Token lifecycle: [Creation, refresh, expiration]

**Authorization:**
- Model: [RBAC/ABAC/etc.]
- Enforcement points: [Where permissions are checked]
- Permission evaluation: [How permissions are evaluated]

### Data Security

**Data at Rest:**
- Encryption: [Algorithm, key management]
- Storage: [Where data is stored]
- Access controls: [Who can access]

**Data in Transit:**
- Encryption: [TLS version, cipher suites]
- Certificate management: [How certs are managed]

**Data in Use:**
- Processing: [Where data is processed]
- Temporary storage: [How temp data is handled]
- Memory security: [Memory protection measures]

### Threat Model

**Threat 1: [Threat Name]**
- **Description:** [What the threat is]
- **Likelihood:** [Low/Medium/High]
- **Impact:** [Low/Medium/High/Critical]
- **Mitigation:** [How we mitigate this]

[Document key threats]

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- [Operation 1]: < [X]ms (p95)
- [Operation 2]: < [X]ms (p95)
- [Operation 3]: < [X]ms (p95)

**Throughput:**
- [Operation 1]: [X] requests/second
- [Operation 2]: [X] requests/second

**Resource Usage:**
- Memory: [Expected usage]
- CPU: [Expected usage]
- Storage: [Growth rate]

### Performance Optimization

**Optimizations implemented:**
- [Optimization 1] - [Impact]
- [Optimization 2] - [Impact]
- [Optimization 3] - [Impact]

**Caching Strategy:**
- [What is cached]: [Cache location, TTL]
- [Cache invalidation]: [How/when cache is invalidated]

**Database Optimization:**
- Indexes: [Key indexes]
- Query optimization: [Key optimizations]
- Connection pooling: [Configuration]

---

## Scalability

### Horizontal Scaling

**Components that scale horizontally:**
- [Component 1]: [How it scales]
- [Component 2]: [How it scales]

**Load balancing:**
- Strategy: [Round-robin/least-connections/etc.]
- Health checks: [How health is determined]

### Vertical Scaling

**Components that scale vertically:**
- [Component 1]: [Resource limits]
- [Component 2]: [Resource limits]

### Bottlenecks

**Current bottlenecks:**
- [Bottleneck 1]: [Description, impact]
- [Bottleneck 2]: [Description, impact]

**Mitigation strategies:**
- [Strategy 1]
- [Strategy 2]

### Capacity Planning

**Current capacity:**
- [Resource 1]: [Current usage/capacity]
- [Resource 2]: [Current usage/capacity]

**Growth projections:**
- [Month/Year]: [Expected capacity needs]

---

## Failure Modes

### Failure Mode 1: [Component] Failure

**Scenario:** [What fails]

**Impact:** [What breaks]

**Detection:** [How we detect this]

**Recovery:**
1. [Recovery step 1]
2. [Recovery step 2]

**Prevention:** [How we prevent this]

---

### Failure Mode 2: [Another Failure]

[Repeat for each failure mode]

---

### Disaster Recovery

**Recovery Time Objective (RTO):** [Time]

**Recovery Point Objective (RPO):** [Time]

**Backup Strategy:**
- Frequency: [How often]
- Retention: [How long]
- Location: [Where backups are stored]

**Recovery Procedure:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

---

## Alternatives Considered

### Alternative 1: [Alternative Approach]

**Description:** [What this alternative was]

**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Why not chosen:** [Reason]

---

### Alternative 2: [Another Approach]

[Repeat for each alternative]

---

## Decision Log

### Decision 1: [Decision Title]

**Date:** YYYY-MM-DD

**Context:** [Why this decision was needed]

**Options:**
1. [Option 1] - [Pros/Cons]
2. [Option 2] - [Pros/Cons]

**Decision:** [What was decided]

**Rationale:** [Why this was chosen]

**Consequences:** [Implications of this decision]

---

### Decision 2: [Another Decision]

[Repeat for each key decision]

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [ ] `[dependency-1.md]` - [Why needed]
- [ ] `[dependency-2.md]` - [Why needed]

**External Services:**
- [Service 1] - [Purpose, SLA]
- [Service 2] - [Purpose, SLA]

### Architecture Dependencies

**Depends on these components:**
- `[component-1]` - [Why/How]
- `[component-2]` - [Why/How]

**Required by these components:**
- `[component-3]` - [Why/How]

---

## References

### Internal Documentation
- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - Technology decisions
- `GLOSSARY.md` - Term definitions

### External Resources
- [Resource 1](URL) - [Description]
- [Resource 2](URL) - [Description]

### Design Patterns Used
- [Pattern 1] - [How/Where used]
- [Pattern 2] - [How/Where used]

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | YYYY-MM-DD | [Your Name] | Initial architecture document |

---

## Notes

### Future Enhancements
- [Enhancement 1]
- [Enhancement 2]

### Known Issues
- [Issue 1]
- [Issue 2]

### Next Review Date
[Date to review this architecture]
```

---

## Using These Templates

### How to Use These Templates

1. **Choose the appropriate template** based on what you're documenting
2. **Copy the entire template** to a new file in the appropriate directory
3. **Fill in the version header** first - this is required on all documents
4. **Replace all placeholders** (marked with [BRACKETS])
5. **Delete sections that don't apply** - not every template section is required for every document
6. **Add custom sections** if needed for your specific case
7. **Review against the checklist** below before submitting

### Pre-Submission Checklist

Before considering a document complete, verify:

- [ ] **Version header is complete** with all required fields
- [ ] **All placeholders replaced** (search for `[` to find any missed)
- [ ] **Dependencies listed** accurately
- [ ] **Examples provided** for technical concepts
- [ ] **Diagrams included** where helpful (ASCII or Mermaid)
- [ ] **Cross-references added** to related documents
- [ ] **Change log updated** with initial version entry
- [ ] **Document follows naming convention** (kebab-case)
- [ ] **Status is set appropriately** (Draft/Review/Approved)
- [ ] **Owner is assigned** (person/team responsible)

### Common Mistakes to Avoid

**Don't:**
- ❌ Skip the version header
- ❌ Leave placeholder text like `[FEATURE_NAME]`
- ❌ Copy-paste without customizing to your specific use case
- ❌ Skip the dependencies section
- ❌ Forget to add examples
- ❌ Use relative dates like "last month" (use YYYY-MM-DD format)
- ❌ Forget to update related documents when creating new ones

**Do:**
- ✅ Fill in all required sections
- ✅ Customize templates to your needs
- ✅ Add diagrams for complex concepts
- ✅ Provide concrete examples
- ✅ Reference other documents by path
- ✅ Update the CHANGELOG.md when creating new docs
- ✅ Ask for review before marking Status: Approved

---

## Template Customization

### When to Add Sections

**Add custom sections when:**
- The standard template doesn't cover a unique aspect of your document
- There's domain-specific information that needs a dedicated section
- Stakeholders request specific information not in the template

### When to Remove Sections

**Remove sections when:**
- The section genuinely doesn't apply (not just because it's hard to fill)
- You're certain the information won't be needed in the future
- The section would be empty and isn't a placeholder for future content

### Creating New Templates

**If you need a new template type:**

1. Check if an existing template can be adapted
2. Review several similar documents for common patterns
3. Draft the new template structure
4. Get review from engineering lead
5. Add the new template to this document
6. Update CLAUDE.md to reference the new template

---

## Dependencies

### Technical Dependencies

**Must exist before using templates:**
- [ ] `00-admin/versioning-strategy.md` - Understanding versioning (⚠️ **Note:** This doc doesn't exist yet but is referenced as a dependency)
- [ ] `GLOSSARY.md` - Standard terminology
- [ ] `FOLDER-STRUCTURE.md` - Where to save documents

---

## References

### Internal Documentation
- `DOCUMENTATION-ROADMAP.md` - What docs to create and when
- `CONTRIBUTING.md` - How to contribute documentation
- `FOLDER-STRUCTURE.md` - Repository organization
- `CLAUDE.md` - Claude Code guidance
- `GLOSSARY.md` - Term definitions

### External Resources
- [Semantic Versioning](https://semver.org/) - Versioning standard
- [Architecture Decision Records](https://adr.github.io/) - ADR patterns
- [Runbook Best Practices](https://www.pagerduty.com/resources/learn/what-is-a-runbook/) - Operations runbooks

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-29 | Engineering Lead | Initial document templates |

---

## Notes

These templates are living documents. If you find sections that are consistently unused or missing information that's always needed, please update these templates and increment the version number.

**Feedback:** Please provide feedback on these templates to the Engineering Lead. We want these to be as useful as possible while maintaining consistency.
