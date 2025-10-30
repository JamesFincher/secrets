---
Document: Audit Logs and Compliance - Feature Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 04-database/schemas/audit-logs.md, 03-security/security-model.md, GLOSSARY.md, TECH-STACK.md
---

# Audit Logs and Compliance Feature

## Overview

The Audit Logs and Compliance feature provides comprehensive, tamper-proof tracking of all actions within Abyrith, ensuring security monitoring, regulatory compliance (SOC 2, ISO 27001, GDPR), and forensic investigation capabilities. All audit events are immutable, automatically logged, and available for export in compliance-ready formats.

**Purpose:** Enable enterprises to meet compliance requirements while providing all users with transparency into who accessed their secrets and when.

**Target Users:** All personas (with varying levels of access)
- The Learner: View their own activity history
- Solo Developer: Track their secret access patterns
- Development Team: Monitor team member activities
- Enterprise: Generate compliance reports, pass audits

**Priority:** P0 - MVP (CRITICAL for enterprise adoption and compliance)

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

**For Individual Users (Learner, Solo Developer):**
- Personal activity dashboard showing recent actions
- Timeline of when they accessed each secret
- Login history with device and location information
- Ability to export their own activity for personal records

**For Team Members (Developer, Admin):**
- Team activity feed showing all actions within their projects
- Who accessed which secrets and when
- Project-level activity filtering (by user, by secret, by date range)
- Real-time notifications for sensitive operations

**For Organization Admins/Owners (Enterprise):**
- Organization-wide audit log viewer
- Advanced filtering by event type, user, resource, date range
- Compliance report generation (SOC 2, ISO 27001, GDPR formats)
- Audit log export in multiple formats (CSV, JSON, PDF)
- Retention policy management
- Anomaly detection alerts (unusual access patterns)

### Key Capabilities

**Comprehensive Event Tracking:**
- All secret operations: create, read, update, delete
- Authentication events: login, logout, password changes, MFA events
- Team management: member invitations, role changes, removals
- Project operations: creation, updates, archival
- MCP requests: AI tool access requests and approvals
- Failed operations and errors

**Immutable Audit Trail:**
- Records cannot be modified or deleted by users
- Cryptographically signed entries (future enhancement)
- Tamper-evident logging system
- Retention policies enforced automatically

**Compliance Reporting:**
- Pre-built SOC 2 audit report templates
- ISO 27001 control evidence generation
- GDPR data processing activity records
- Custom compliance report builder
- Automated report scheduling

**Search and Filtering:**
- Full-text search across all audit logs
- Filter by user, event type, date range, resource
- Saved search queries for recurring reports
- Real-time log streaming for security monitoring

### User Benefits

**For Learners (Beginners):**
- Understand who can see their secrets
- Learn about security best practices through activity tracking
- Build trust through transparency

**For Solo Developers:**
- Track when they last accessed each secret
- Detect unauthorized access attempts
- Maintain personal security audit trail

**For Development Teams:**
- Monitor team secret access patterns
- Detect suspicious behavior (e.g., developer accessing 100 secrets in 1 minute)
- Coordinate key rotation based on usage patterns
- Audit trail for compliance reviews

**For Enterprise:**
- Pass SOC 2, ISO 27001, GDPR audits
- Meet regulatory compliance requirements
- Forensic investigation capabilities after security incidents
- Demonstrate security controls to customers and auditors
- Automated compliance reporting saves hours of manual work

### Example Scenarios

**Scenario 1: Solo Developer Tracks Secret Usage**

Alice is a solo developer who stores her API keys in Abyrith. She wants to see when she last accessed her OpenAI API key.

1. Alice opens the secret card for "OPENAI_API_KEY"
2. She clicks "View Access History"
3. She sees a timeline:
   - "Accessed from Chrome on macOS" - 2 hours ago
   - "Accessed from VS Code (MCP)" - 1 day ago
   - "Accessed from Firefox on macOS" - 3 days ago
4. Alice notices an access from a device she doesn't recognize
5. She immediately changes her master password and rotates the API key
6. **Result:** Early detection of potential compromise

**Scenario 2: Team Admin Investigates Unusual Activity**

Bob is an Admin for a development team. He receives an alert that a developer accessed 50 secrets in 5 minutes.

1. Bob opens the audit log dashboard
2. He filters by user "charlie@company.com" and last 1 hour
3. He sees Charlie accessed all production secrets sequentially
4. Bob contacts Charlie and learns his laptop was stolen
5. Bob immediately:
   - Revokes Charlie's access
   - Forces re-authentication for all team members
   - Rotates all production secrets Charlie accessed
6. Bob generates an incident report from the audit logs
7. **Result:** Rapid incident response, minimal damage

**Scenario 3: Enterprise Compliance Officer Prepares for SOC 2 Audit**

Diana is preparing for her company's annual SOC 2 Type II audit. The auditor requests evidence of access control monitoring.

1. Diana logs into Abyrith as Organization Owner
2. She navigates to "Compliance Reports" → "SOC 2 Type II"
3. She selects date range: Q1 2025 (January 1 - March 31)
4. She clicks "Generate Report"
5. Within 5 minutes, she receives:
   - PDF audit report with all access events
   - CSV export with detailed event data
   - Control mapping document (CC6.1, CC6.2, CC6.3)
   - Summary statistics (total events, unique users, secrets accessed)
6. Diana provides the report to the auditor
7. **Result:** Audit passed with zero findings on access control monitoring

**Scenario 4: Developer Approves MCP Request from Claude Code**

Eve is a developer using Claude Code. Claude requests access to a production secret to help debug an issue.

1. Claude Code sends MCP request to Abyrith: "Get secret: STRIPE_SECRET_KEY (production)"
2. Abyrith creates an audit log entry: "mcp.request" by Eve's account
3. Eve receives notification: "Claude Code is requesting access to STRIPE_SECRET_KEY"
4. Eve reviews the request context and clicks "Approve for 1 hour"
5. Audit log entry created: "mcp.approved" by Eve, expires at [timestamp]
6. Claude Code receives the secret (encrypted, decrypted client-side)
7. Audit log entry created: "secret.read via MCP" with MCP client details
8. After 1 hour, approval expires automatically
9. Eve later reviews the audit log and confirms everything was appropriate
10. **Result:** AI tool integration with security oversight and full auditability

---

## Technical Architecture

### System Components

**Components involved:**

**Frontend:**
- `AuditLogViewer.tsx` - Main audit log browsing interface
- `AuditLogTimeline.tsx` - Visual timeline of events
- `ComplianceReportGenerator.tsx` - Report generation UI
- `AuditLogFilters.tsx` - Advanced filtering controls
- `ActivityFeed.tsx` - Real-time activity updates
- **State management:** Zustand for filter state, React Query for data fetching

**Backend:**
- **API endpoints:** Cloudflare Workers for audit log retrieval, filtering, export
- **Supabase Functions:** PostgreSQL functions for compliance report queries
- **Database:** PostgreSQL tables (`audit_logs`, `access_events`, `mcp_requests`)
- **Triggers:** Automatic logging on secret operations

**External Services:**
- **Sentry** (optional) - Anomaly detection and alerting
- **Email service** - Compliance report delivery

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AuditLogViewer (React Component)               │   │
│  │  - Filter controls (date, user, event type)     │   │
│  │  - Event list (paginated, infinite scroll)      │   │
│  │  - Export buttons (CSV, JSON, PDF)              │   │
│  └────────────────────┬────────────────────────────┘   │
│                       │                                  │
│                       │ React Query                      │
│                       ▼                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  API Client (fetch + authentication)            │   │
│  └────────────────────┬────────────────────────────┘   │
└────────────────────────┼──────────────────────────────────┘
                        │ HTTPS (JWT Bearer token)
                        ▼
┌─────────────────────────────────────────────────────────┐
│          Cloudflare Workers (Edge API)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  GET /api/audit-logs                            │   │
│  │  - Authenticate user (JWT)                      │   │
│  │  - Validate filters                             │   │
│  │  - Rate limiting                                │   │
│  │  - Forward to Supabase with RLS context         │   │
│  └────────────────────┬────────────────────────────┘   │
└────────────────────────┼──────────────────────────────────┘
                        │ PostgREST API
                        ▼
┌─────────────────────────────────────────────────────────┐
│            Supabase PostgreSQL                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  audit_logs table (append-only)                 │   │
│  │  - RLS: Users see own logs, Admins see all      │   │
│  │  - Indexes: user_id, organization_id, timestamp │   │
│  │  - No UPDATE/DELETE (immutability)              │   │
│  └────────────────────┬────────────────────────────┘   │
│                       │                                  │
│  ┌────────────────────▼────────────────────────────┐   │
│  │  Helper Functions                               │   │
│  │  - compliance_export(org_id, date_range)        │   │
│  │  - get_user_audit_summary(user_id, days)        │   │
│  │  - detect_anomalies(user_id)                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│         Audit Log Creation (Automatic)                  │
│                                                          │
│  Secret Operation (create/read/update/delete)           │
│         │                                                │
│         ▼                                                │
│  API Endpoint (Cloudflare Workers)                      │
│         │                                                │
│         ├─────► Process operation                       │
│         │                                                │
│         └─────► Insert audit log entry (service_role)   │
│                 - event_type: 'secret.read'             │
│                 - user_id: current user                 │
│                 - ip_address: request IP                │
│                 - metadata: {secret_name, environment}  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → User performs operation (e.g., reads secret)
2. **API Processing** → Cloudflare Workers handles request
3. **Automatic Logging** → Workers insert audit log entry (service role)
4. **Database Storage** → PostgreSQL stores immutable log entry
5. **RLS Enforcement** → Only authorized users can query logs
6. **UI Display** → React Query fetches and displays logs
7. **Export/Reporting** → Compliance reports generated via SQL functions

---

## User Flows

### Flow 1: User Views Personal Activity

**Trigger:** User wants to see what they've been doing in Abyrith

**Steps:**
1. User clicks "Activity" in navigation menu
2. Frontend fetches audit logs: `GET /api/audit-logs?user_id=current_user`
3. PostgreSQL RLS automatically filters to user's own logs
4. Frontend displays timeline:
   - "You accessed OPENAI_API_KEY" - 2 hours ago
   - "You created new secret STRIPE_KEY" - 1 day ago
   - "You logged in from Chrome" - 2 days ago
5. User can filter by event type, date range
6. User can export their activity as CSV

**Success Criteria:** User sees their complete activity history in chronological order

**Error Cases:**
- **Network failure** → Display cached logs, show "Offline" banner
- **No logs found** → Display "No activity yet" message
- **Unauthorized** → Redirect to login (JWT expired)

### Flow 2: Admin Investigates Security Incident

**Trigger:** Admin receives alert about suspicious activity or user reports compromise

**Steps:**
1. Admin opens "Audit Logs" dashboard
2. Admin applies filters:
   - Event type: "secret.read"
   - User: suspicious_user@company.com
   - Date range: Last 24 hours
3. API call: `GET /api/audit-logs?user_id=user_uuid&event_type=secret.read&start=2025-10-29T00:00:00Z`
4. PostgreSQL executes query with RLS (Admin can see organization logs):
   ```sql
   SELECT * FROM audit_logs
   WHERE user_id = $1
     AND event_type = $2
     AND created_at >= $3
     AND organization_id = current_user_org_id
   ORDER BY created_at DESC;
   ```
5. Admin sees list of 50+ secret access events in 5 minutes
6. Admin identifies pattern: All production secrets accessed sequentially
7. Admin clicks "Generate Incident Report"
8. System generates PDF with:
   - Timeline of suspicious events
   - Affected resources (which secrets were accessed)
   - Recommended actions (revoke access, rotate secrets)
9. Admin takes corrective action (revoke user, rotate keys)
10. Admin documents findings in incident report

**Success Criteria:** Admin identifies suspicious behavior, takes action, generates report

**Error Cases:**
- **Too many results** → Paginate results, show first 100 with "Load More"
- **Invalid filter** → Display validation error, prevent API call
- **Permission denied** → Display "You don't have permission to view organization logs"

### Flow 3: Compliance Officer Generates SOC 2 Report

**Trigger:** Quarterly compliance audit requires access control evidence

**Steps:**
1. Compliance officer logs in as Organization Owner
2. Navigates to "Compliance" → "Reports" → "SOC 2 Type II"
3. Selects report parameters:
   - Report type: SOC 2 Type II
   - Date range: Q1 2025 (2025-01-01 to 2025-03-31)
   - Format: PDF + CSV
4. Clicks "Generate Report"
5. Backend calls PostgreSQL function:
   ```sql
   SELECT * FROM compliance_export(
     organization_id,
     '2025-01-01'::TIMESTAMPTZ,
     '2025-04-01'::TIMESTAMPTZ
   );
   ```
6. Function returns:
   - All audit log entries in date range
   - User emails (joined from auth.users)
   - Event summaries and statistics
7. Backend generates PDF report:
   - Cover page with organization details
   - Executive summary (total events, unique users, secrets accessed)
   - Control mapping (CC6.1, CC6.2, CC6.3 → audit log evidence)
   - Detailed event log (chronological, all events)
   - Appendices (methodology, data retention policy)
8. Backend generates CSV export (machine-readable format)
9. Officer receives download links:
   - SOC2_Report_Q1_2025.pdf (for auditor review)
   - audit_logs_q1_2025.csv (for data analysis)
10. Officer provides reports to auditor
11. Auditor reviews and approves (audit passed)

**Success Criteria:** Compliance report generated in < 5 minutes, contains all required evidence

**Error Cases:**
- **No data in date range** → Display "No audit logs found for this period"
- **Report generation timeout** → Queue report job, email when complete
- **Insufficient permissions** → Display "Only Organization Owners can generate compliance reports"

### Flow 4: User Approves MCP Secret Access Request

**Trigger:** AI tool (Claude Code, Cursor) requests secret via MCP

**Steps:**
1. Developer uses Claude Code to debug production issue
2. Claude Code detects need for secret, sends MCP request:
   ```json
   {
     "tool": "secret_get",
     "params": {
       "secret_name": "STRIPE_SECRET_KEY",
       "environment": "production"
     }
   }
   ```
3. Abyrith MCP server receives request, creates audit log:
   - event_type: "mcp.request"
   - user_id: developer's account
   - metadata: { mcp_client: "claude-code", requested_secret: "STRIPE_SECRET_KEY" }
4. MCP server inserts pending approval record:
   ```sql
   INSERT INTO mcp_requests (
     user_id, organization_id, secret_id,
     mcp_client_name, request_type, approval_status
   ) VALUES (..., 'pending');
   ```
5. Notification sent to user: "Claude Code is requesting STRIPE_SECRET_KEY"
6. User reviews request in Abyrith UI:
   - What: STRIPE_SECRET_KEY (production)
   - Why: Claude Code needs it for debugging
   - Options: Approve (1 hour, 24 hours, indefinite) or Deny
7. User clicks "Approve for 1 hour"
8. Audit log entry created:
   - event_type: "mcp.approved"
   - approved_by: user_id
   - expires_at: NOW() + INTERVAL '1 hour'
9. MCP server grants access, Claude Code receives secret
10. Audit log entry created:
    - event_type: "secret.read"
    - access_method: "mcp"
    - mcp_request_id: [request UUID]
11. After 1 hour, approval expires automatically:
    - Background job updates mcp_requests.approval_status = 'expired'
12. User later reviews audit log and sees full MCP access history

**Success Criteria:** AI tool receives secret after explicit user approval, all events logged

**Error Cases:**
- **User denies request** → Audit log entry: "mcp.denied", AI tool receives error
- **Request times out** → After 5 minutes, auto-deny, notify user
- **Approval expires** → AI tool loses access, must request again

---

## Technical Implementation

### Frontend Implementation

**Components:**

**1. `AuditLogViewer.tsx` - Main audit log interface**
```typescript
interface AuditLogViewerProps {
  userId?: string;      // If set, filter to specific user (admin view)
  projectId?: string;   // If set, filter to specific project
  initialFilters?: AuditLogFilters;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ userId, projectId, initialFilters }) => {
  const [filters, setFilters] = useState<AuditLogFilters>(initialFilters || defaultFilters);

  // Fetch audit logs with pagination
  const { data, isLoading, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['auditLogs', filters],
    queryFn: ({ pageParam = 0 }) => fetchAuditLogs({
      ...filters,
      offset: pageParam * LOGS_PER_PAGE,
      limit: LOGS_PER_PAGE
    }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === LOGS_PER_PAGE ? pages.length : undefined
  });

  return (
    <div className="audit-log-viewer">
      <AuditLogFilters filters={filters} onFilterChange={setFilters} />
      <AuditLogTimeline logs={data?.pages.flat() || []} />
      {hasNextPage && <button onClick={fetchNextPage}>Load More</button>}
      <AuditLogExport filters={filters} />
    </div>
  );
};
```

**2. `AuditLogTimeline.tsx` - Visual event timeline**
```typescript
interface AuditLogTimelineProps {
  logs: AuditLogEntry[];
}

const AuditLogTimeline: React.FC<AuditLogTimelineProps> = ({ logs }) => {
  return (
    <div className="timeline">
      {logs.map(log => (
        <AuditLogCard key={log.id} log={log} />
      ))}
    </div>
  );
};

const AuditLogCard: React.FC<{ log: AuditLogEntry }> = ({ log }) => {
  const icon = getEventIcon(log.event_type);
  const color = getEventColor(log.success);

  return (
    <div className={`log-card ${color}`}>
      <div className="log-icon">{icon}</div>
      <div className="log-content">
        <div className="log-action">{log.action}</div>
        <div className="log-metadata">
          <span>{formatTimestamp(log.created_at)}</span>
          <span>{log.ip_address}</span>
          {log.user_agent && <span>{parseUserAgent(log.user_agent)}</span>}
        </div>
        {log.metadata && <AuditLogMetadata metadata={log.metadata} />}
      </div>
    </div>
  );
};
```

**3. `ComplianceReportGenerator.tsx` - Report generation UI**
```typescript
const ComplianceReportGenerator: React.FC = () => {
  const [reportType, setReportType] = useState<'soc2' | 'iso27001' | 'gdpr'>('soc2');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');

  const generateReport = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/compliance/reports', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reportType, dateRange, format })
      });
      return response.blob();
    },
    onSuccess: (blob) => {
      // Download the report
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${dateRange.start}_${dateRange.end}.${format}`;
      a.click();
    }
  });

  return (
    <div className="compliance-report-generator">
      <h2>Generate Compliance Report</h2>
      <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
        <option value="soc2">SOC 2 Type II</option>
        <option value="iso27001">ISO 27001</option>
        <option value="gdpr">GDPR Data Processing</option>
      </select>
      <DateRangePicker value={dateRange} onChange={setDateRange} />
      <select value={format} onChange={(e) => setFormat(e.target.value)}>
        <option value="pdf">PDF (for auditors)</option>
        <option value="csv">CSV (for analysis)</option>
        <option value="json">JSON (machine-readable)</option>
      </select>
      <button onClick={() => generateReport.mutate()}>
        Generate Report
      </button>
    </div>
  );
};
```

**State Management:**
- **Local state:** Filter selections, pagination cursors
- **Global state (Zustand):** User role, permissions (for showing/hiding admin features)
- **Server state (React Query):** Audit logs, cached with 5-minute TTL

### Backend Implementation

**API Endpoints:**

**1. `GET /api/audit-logs` - Retrieve audit logs**
- Rate limit: 100 requests/minute per user
- Authentication: JWT Bearer token (required)
- Authorization: RLS enforces user can only see permitted logs

**2. `GET /api/audit-logs/:id` - Get specific audit log entry**
- Returns detailed metadata, related resources

**3. `GET /api/audit-logs/summary` - Get audit statistics**
- Returns: total events, events by type, unique users, date range

**4. `POST /api/compliance/reports` - Generate compliance report**
- Request body: { reportType, dateRange, format }
- Response: Binary file (PDF, CSV, or JSON)

**Cloudflare Workers (API Gateway):**

```typescript
// audit-logs-api.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Authenticate user
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const user = await verifyJWT(token, env.SUPABASE_JWT_SECRET);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Rate limiting
    const rateLimitKey = `ratelimit:auditlogs:${user.id}`;
    const current = await env.KV.get(rateLimitKey);
    if (current && parseInt(current) > 100) {
      return new Response('Rate limit exceeded', { status: 429 });
    }
    await env.KV.put(rateLimitKey, String(parseInt(current || '0') + 1), { expirationTtl: 60 });

    // Parse filters
    const filters = {
      user_id: url.searchParams.get('user_id'),
      event_type: url.searchParams.get('event_type'),
      start_date: url.searchParams.get('start_date'),
      end_date: url.searchParams.get('end_date'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
      limit: Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    };

    // Build Supabase query
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);

    // Apply filters
    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.event_type) query = query.eq('event_type', filters.event_type);
    if (filters.start_date) query = query.gte('created_at', filters.start_date);
    if (filters.end_date) query = query.lte('created_at', filters.end_date);

    // RLS automatically enforces user can only see permitted logs
    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

**Supabase Functions:**

Functions are defined in the database schema documentation (`04-database/schemas/audit-logs.md`):
- `create_audit_log()` - Helper function to insert audit logs
- `get_user_audit_summary()` - Get user activity statistics
- `compliance_export()` - Export audit logs for compliance reporting

### Database Implementation

**Tables Used:**
- `audit_logs` - Comprehensive audit trail (all event types)
- `access_events` - High-frequency secret access tracking
- `mcp_requests` - MCP tool access requests and approvals

See `04-database/schemas/audit-logs.md` for complete schema definitions.

**Key Queries:**

**Query 1: User's recent activity**
```sql
SELECT
  event_type,
  action,
  resource_type,
  created_at,
  success,
  metadata
FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

**Query 2: Organization audit report (Admin view)**
```sql
SELECT
  al.created_at,
  u.email AS user_email,
  al.event_type,
  al.action,
  al.resource_type,
  al.ip_address,
  al.success
FROM audit_logs al
JOIN auth.users u ON u.id = al.user_id
WHERE al.organization_id = $1
  AND al.created_at >= $2
  AND al.created_at < $3
ORDER BY al.created_at DESC;
```

**Query 3: Detect suspicious activity (many accesses in short time)**
```sql
SELECT
  user_id,
  u.email,
  COUNT(*) AS access_count,
  MIN(accessed_at) AS first_access,
  MAX(accessed_at) AS last_access
FROM access_events ae
JOIN auth.users u ON u.id = ae.user_id
WHERE accessed_at > NOW() - INTERVAL '5 minutes'
GROUP BY user_id, u.email
HAVING COUNT(*) > 50
ORDER BY access_count DESC;
```

**RLS Policies:**

All audit tables have Row-Level Security enabled:
- Users can see their own logs
- Admins/Owners can see organization logs
- Users cannot modify or delete logs (append-only)
- Only service_role can delete logs (for retention policy)

See `04-database/schemas/audit-logs.md` for complete RLS policy definitions.

---

## API Contracts

### Endpoint: GET /api/audit-logs

**Purpose:** Retrieve audit logs with filtering and pagination

**Request:**
```typescript
interface AuditLogsRequest {
  user_id?: string;       // Filter by user (admin only)
  event_type?: string;    // Filter by event type
  event_category?: string; // Filter by category (secret, auth, project, etc.)
  start_date?: string;    // ISO 8601 timestamp
  end_date?: string;      // ISO 8601 timestamp
  offset?: number;        // Pagination offset (default: 0)
  limit?: number;         // Results per page (default: 50, max: 100)
}
```

**Example Request:**
```bash
GET /api/audit-logs?event_type=secret.read&start_date=2025-10-01T00:00:00Z&limit=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success - 200 OK):**
```typescript
interface AuditLogsResponse {
  data: AuditLogEntry[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

interface AuditLogEntry {
  id: string;              // UUID
  user_id: string;         // User who performed action
  event_type: string;      // e.g., 'secret.read', 'auth.login'
  event_category: string;  // 'secret', 'auth', 'project', etc.
  action: string;          // Human-readable description
  resource_type: string;   // 'secret', 'project', 'member', etc.
  resource_id?: string;    // UUID of affected resource
  ip_address?: string;     // Source IP address
  user_agent?: string;     // Browser/client identifier
  metadata?: object;       // Event-specific data
  success: boolean;        // Whether action succeeded
  error_message?: string;  // If failed, error message
  created_at: string;      // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "event_type": "secret.read",
      "event_category": "secret",
      "action": "Accessed secret: OPENAI_API_KEY",
      "resource_type": "secret",
      "resource_id": "secret-uuid-here",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "metadata": {
        "secret_name": "OPENAI_API_KEY",
        "environment": "production",
        "access_method": "web_ui"
      },
      "success": true,
      "created_at": "2025-10-30T14:23:45.123Z"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 50,
    "total": 1234
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid filter parameters
  ```json
  {
    "error": "validation_error",
    "message": "Invalid date format for start_date",
    "details": { "start_date": "must be ISO 8601 format" }
  }
  ```
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have permission to view requested logs
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Endpoint: POST /api/compliance/reports

**Purpose:** Generate compliance report (SOC 2, ISO 27001, GDPR)

**Request:**
```typescript
interface ComplianceReportRequest {
  report_type: 'soc2' | 'iso27001' | 'gdpr';
  start_date: string;      // ISO 8601 timestamp
  end_date: string;        // ISO 8601 timestamp
  format: 'pdf' | 'csv' | 'json';
  include_sections?: string[]; // Optional: specific sections to include
}
```

**Example Request:**
```bash
POST /api/compliance/reports
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "report_type": "soc2",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-04-01T00:00:00Z",
  "format": "pdf"
}
```

**Response (Success - 200 OK):**
```
Content-Type: application/pdf (or text/csv, application/json)
Content-Disposition: attachment; filename="SOC2_Report_Q1_2025.pdf"

[Binary file content]
```

**Error Responses:**
- `400 Bad Request` - Invalid date range or parameters
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Only Organization Owners can generate reports
- `404 Not Found` - No audit logs in specified date range
- `500 Internal Server Error` - Report generation failed
- `503 Service Unavailable` - Report generation taking too long, queued for background processing

---

## Security Considerations

### Threat Model

**Potential Threats:**

**1. Audit Log Tampering**
- **Description:** Attacker modifies or deletes audit logs to hide malicious activity
- **Mitigation:**
  - Append-only database tables (no UPDATE/DELETE allowed)
  - RLS policies prevent user modification
  - Only service_role can delete (for retention policy, with 2-year minimum)
  - Cryptographic signatures on entries (future enhancement)
  - Regular backups to immutable storage

**2. Unauthorized Access to Audit Logs**
- **Description:** User views audit logs they shouldn't have access to
- **Mitigation:**
  - Row-Level Security (RLS) enforces access control at database level
  - Users see only their own logs
  - Admins/Owners see only their organization's logs
  - JWT authentication required for all API calls
  - Rate limiting prevents enumeration attacks

**3. Privacy Violations (Excessive Logging)**
- **Description:** Audit logs contain personally identifiable information (PII) inappropriately
- **Mitigation:**
  - Never log secret values (only metadata: key name, service)
  - IP addresses can be anonymized for GDPR compliance
  - User can request audit log deletion after retention period
  - GDPR-compliant data retention policies

**4. Compliance Report Forgery**
- **Description:** Attacker creates fake compliance reports
- **Mitigation:**
  - Reports generated directly from database (not editable after generation)
  - Digital signatures on PDF reports (future enhancement)
  - Audit trail of who generated which reports
  - Direct auditor access to Abyrith for verification

### Security Controls

**Authentication:**
- JWT Bearer token required for all audit log API calls
- Token contains user ID, organization ID, role
- Token verified by Cloudflare Workers before forwarding to Supabase

**Authorization:**
- Row-Level Security (RLS) at database level enforces access control
- Admins/Owners can view organization logs
- Regular users can only view their own logs
- MCP request approval requires explicit user action (not automatic)

**Data Protection:**
- Audit logs contain only metadata (never secret values)
- Encrypted in transit (TLS 1.3)
- Encrypted at rest (PostgreSQL encryption if enabled)
- Immutable (append-only, no modifications allowed)

**Audit Logging:**
- All audit log accesses are themselves logged
- Who generated compliance reports is logged
- Failed access attempts are logged

### Compliance

**GDPR (General Data Protection Regulation):**
- **Article 30:** Audit logs serve as "record of processing activities"
- **Right to Access:** Users can export their own audit logs
- **Right to Deletion:** Users can request deletion after retention period
- **Data Minimization:** Only necessary data logged (no excessive PII)

**SOC 2 Type II:**
- **CC6.1:** Logical and Physical Access Controls - Audit logs demonstrate monitoring
- **CC6.2:** Prior to Issuing System Credentials - Audit logs track credential issuance
- **CC6.3:** Removes Access When Appropriate - Audit logs show access removal
- **CC7.2:** System Monitoring - Audit logs enable security monitoring

**ISO 27001:**
- **A.12.4.1:** Event Logging - Comprehensive event logging implemented
- **A.12.4.3:** Administrator and Operator Logs - All privileged actions logged
- **A.12.4.4:** Clock Synchronization - All timestamps in UTC (TIMESTAMPTZ)

---

## Performance Requirements

### Performance Targets

**Latency:**
- **Audit log query:** < 100ms p95 for 50 logs (with indexes)
- **Compliance report generation:** < 5 minutes for quarterly report (up to 1M logs)
- **Real-time logging:** < 50ms to insert audit log entry (async, doesn't block operation)

**Throughput:**
- **Concurrent log writes:** 10,000+ per second (high-frequency secret access logging)
- **Concurrent log reads:** 1,000+ per second (users viewing their activity)

**Resource Usage:**
- **Storage:** ~1KB per audit log entry (grows over time, requires retention policy)
- **Database:** Separate table for high-frequency access_events to prevent index contention

### Optimization Strategy

**Frontend:**
- Virtualized scrolling for large log lists (only render visible rows)
- Debounced filter inputs (avoid excessive API calls)
- React Query caching (5-minute TTL for audit logs)
- Infinite scroll pagination (load more on demand)

**Backend:**
- Database indexes on user_id, organization_id, timestamp, event_type
- Partitioning by month for tables exceeding 10M rows (future enhancement)
- Connection pooling (PgBouncer) to handle concurrent queries
- Edge caching for compliance report templates (Cloudflare Workers KV)

**Database:**
- Indexes (see `04-database/schemas/audit-logs.md`):
  - `idx_audit_logs_user_id` - User's own logs
  - `idx_audit_logs_organization_id` - Organization logs
  - `idx_audit_logs_event_type` - Filter by event type
  - `idx_audit_logs_resource` - Find all events for a resource
- Separate `access_events` table for high-frequency secret access (reduces contention)
- Batch INSERT operations where possible (queue 10 events, insert together)

### Load Handling

**Expected Load:**
- 10,000 concurrent users
- 100,000 secret accesses per hour (peak)
- 1,000 compliance reports per month

**Scalability:**
- Cloudflare Workers auto-scale to handle read traffic
- Supabase connection pooling handles database connections
- Partitioning by month enables efficient archival and querying

---

## Testing Strategy

### Unit Tests

**Frontend:**
- Test: AuditLogViewer component renders logs correctly
- Test: AuditLogFilters component applies filters
- Test: ComplianceReportGenerator generates correct API request
- Coverage: 80%+ for audit log components

**Backend:**
- Test: Audit log API endpoint returns correct data
- Test: RLS policies enforce access control (user can't see others' logs)
- Test: Rate limiting prevents abuse
- Test: Compliance report generation produces valid PDF/CSV
- Coverage: 90%+ for audit log API

### Integration Tests

**Test Scenarios:**
1. **User views personal activity:**
   - User logs in
   - User accesses secret
   - Audit log entry created
   - User views activity, sees recent access
2. **Admin views organization logs:**
   - Admin logs in
   - Admin filters logs by user
   - Sees all organization logs, not other orgs
3. **Compliance report generation:**
   - Owner generates SOC 2 report
   - Report contains all events in date range
   - Report downloadable as PDF
4. **MCP approval workflow:**
   - AI tool requests secret
   - MCP request logged
   - User approves
   - Approval logged
   - Secret access logged

### End-to-End Tests (Playwright)

**E2E Flows:**
1. **Complete audit trail for secret lifecycle:**
   - User creates secret → logged
   - User accesses secret → logged
   - User updates secret → logged
   - User deletes secret → logged
   - User views audit log, sees all 4 events
2. **Security incident investigation:**
   - Simulate user accessing 50 secrets in 1 minute
   - Admin receives alert
   - Admin filters logs, sees suspicious activity
   - Admin generates incident report
3. **Compliance audit:**
   - Owner generates quarterly SOC 2 report
   - Report contains all required evidence
   - Report matches expected format

### Security Tests

**Security Test Cases:**
1. **RLS enforcement:**
   - User A cannot view User B's audit logs (403 Forbidden)
   - User cannot modify or delete audit logs (403 Forbidden)
2. **Audit log immutability:**
   - Attempt UPDATE on audit_logs table → fails
   - Attempt DELETE on audit_logs table (as user) → fails
3. **Rate limiting:**
   - Send 101 requests in 1 minute → 429 Too Many Requests
4. **Injection attacks:**
   - SQL injection in filters → sanitized, query safe
   - XSS in audit log display → escaped, no script execution

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/audit-logs.md` - Database schema (EXISTS)
- [x] `03-security/security-model.md` - Security requirements (EXISTS)
- [ ] `08-features/team-collaboration/team-collaboration-overview.md` - Team membership for RLS (PENDING)
- [x] `GLOSSARY.md` - Terminology (audit log, RLS, compliance) (EXISTS)

**External Services:**
- Supabase PostgreSQL - Audit log storage
- Cloudflare Workers - API gateway
- React Query - Frontend data fetching
- PostgreSQL RLS - Access control enforcement

### Feature Dependencies

**Depends on these features:**
- Authentication - User identity for audit logs
- Row-Level Security - Access control for audit logs
- Team Collaboration - Organization membership for admin access

**Enables these features:**
- Compliance - SOC 2, ISO 27001, GDPR reports
- Security Monitoring - Detect suspicious activity
- Forensic Investigation - Investigate security incidents
- User Transparency - Users see who accessed their secrets

---

## References

### Internal Documentation
- `04-database/schemas/audit-logs.md` - Complete database schema
- `03-security/security-model.md` - Security architecture
- `03-security/rbac/rls-policies.md` - Row-Level Security patterns
- `TECH-STACK.md` - PostgreSQL, React Query specifications
- `GLOSSARY.md` - Audit log, compliance, RLS definitions

### External Resources
- [SOC 2 Audit Log Requirements](https://www.vanta.com/resources/soc-2-audit-logs) - Compliance guidelines
- [ISO 27001 A.12.4.1](https://www.iso.org/standard/54534.html) - Event logging standard
- [GDPR Article 30](https://gdpr-info.eu/art-30-gdpr/) - Records of processing activities
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) - RLS documentation
- [React Query Documentation](https://tanstack.com/query/latest) - Data fetching library

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial audit logs and compliance feature documentation |

---

## Notes

**Critical for MVP:** This feature is essential for enterprise adoption. Without comprehensive audit logs and compliance reporting, enterprises cannot meet regulatory requirements or pass audits.

**Privacy Considerations:**
- Audit logs intentionally do NOT contain secret values (only metadata)
- IP addresses can be anonymized for GDPR compliance (configurable per organization)
- Users control their own audit log retention policy

**Performance Considerations:**
- Audit logs grow linearly with user activity (requires retention policy)
- Separate `access_events` table prevents index contention on `audit_logs`
- Partitioning by month recommended when exceeding 10M rows

**Future Enhancements:**
- **Cryptographic signatures:** Sign each audit log entry with server private key (tamper-evident)
- **Blockchain anchoring:** Anchor audit log hashes to blockchain for immutability proof (enterprise feature)
- **ML anomaly detection:** Use machine learning to detect unusual access patterns
- **Real-time alerting:** Push notifications for suspicious activity
- **Audit log search:** Full-text search on audit logs using PostgreSQL FTS
- **Compliance automation:** Automatically generate and email quarterly reports

**Compliance Mapping Reference:**

| Compliance Framework | Control | Evidence from Audit Logs |
|---------------------|---------|--------------------------|
| SOC 2 CC6.1 | Logical and Physical Access Controls | User authentication logs, secret access logs |
| SOC 2 CC6.2 | Prior to Issuing System Credentials | Member invitation logs, role assignment logs |
| SOC 2 CC6.3 | Removes Access When Appropriate | Member removal logs, access revocation logs |
| SOC 2 CC7.2 | System Monitoring | All audit logs demonstrate continuous monitoring |
| ISO 27001 A.12.4.1 | Event Logging | All security-relevant events logged |
| ISO 27001 A.12.4.3 | Administrator Logs | Admin/Owner actions logged separately |
| ISO 27001 A.12.4.4 | Clock Synchronization | All timestamps in UTC (TIMESTAMPTZ) |
| GDPR Article 30 | Records of Processing Activities | Audit logs serve as processing records |
| GDPR Article 33 | Breach Notification | Audit logs enable breach detection |
| GDPR Article 32 | Security of Processing | Audit logs demonstrate security measures |
