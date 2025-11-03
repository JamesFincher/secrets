# Audit Logging Test Plan

## Overview
Comprehensive testing plan for the Abyrith audit logging system.

## Components Implemented

### 1. Database Layer
- **Migration**: `20241102000003_audit_triggers.sql`
- **Triggers**: Automatic logging on INSERT, UPDATE, DELETE
- **Tables tracked**:
  - `secrets`
  - `projects`
  - `environments`
  - `organization_members`
  - `organizations`

### 2. API Layer
- **File**: `lib/api/audit.ts`
- **Functions**:
  - `fetchAuditLogs()` - Fetch logs with filters and pagination
  - `getActionTypes()` - Get unique action types for filtering
  - `getResourceTypes()` - Get unique resource types
  - `getOrganizationMembers()` - Get members for user filter
  - `exportAuditLogsToCSV()` - Export to CSV format
  - `exportAuditLogsToJSON()` - Export to JSON format
  - `subscribeToAuditLogs()` - Real-time updates via Realtime
  - `logSecretAccess()` - Log when secrets are read

### 3. UI Components
- **File**: `components/audit/AuditLogViewer.tsx`
  - Main viewer with table, pagination, export
  - Real-time updates
  - Toast notifications for new logs
- **File**: `components/audit/AuditLogFilters.tsx`
  - Date range filters (start/end date)
  - User filter
  - Action type filter
  - Resource type filter
  - Search by resource ID

### 4. Dashboard Page
- **File**: `app/dashboard/audit/page.tsx`
  - Server-side auth check
  - Permission check (owner/admin only)
  - Renders AuditLogViewer

---

## Manual Testing Checklist

### Database Triggers

#### Test 1: Secret Creation Logging
```sql
-- Create a test secret
INSERT INTO secrets (
  project_id,
  environment_id,
  key,
  encrypted_value,
  description,
  service_name,
  created_by
) VALUES (
  '<project_id>',
  '<environment_id>',
  'TEST_API_KEY',
  '{"ciphertext": "encrypted", "iv": "test", "salt": "test", "algorithm": "AES-256-GCM"}',
  'Test secret for audit logging',
  'TestService',
  auth.uid()
);

-- Verify audit log created
SELECT * FROM audit_logs
WHERE action = 'secrets.create'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- One audit log entry created
- `action` = 'secrets.create'
- `resource_type` = 'secrets'
- `user_id` = current user
- `metadata` contains the new secret data (encrypted_value should be present)

#### Test 2: Secret Update Logging
```sql
-- Update the test secret
UPDATE secrets
SET description = 'Updated description'
WHERE key = 'TEST_API_KEY';

-- Verify audit log
SELECT * FROM audit_logs
WHERE action = 'secrets.update'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- One audit log entry created
- `action` = 'secrets.update'
- `metadata` contains `changed_fields` showing old and new values

#### Test 3: Secret Deletion Logging
```sql
-- Delete the test secret
DELETE FROM secrets
WHERE key = 'TEST_API_KEY';

-- Verify audit log
SELECT * FROM audit_logs
WHERE action = 'secrets.delete'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- One audit log entry created
- `action` = 'secrets.delete'
- `metadata` contains the old secret data

#### Test 4: Project Operations
```sql
-- Create project
INSERT INTO projects (organization_id, name, description, created_by)
VALUES ('<org_id>', 'Test Project', 'Test', auth.uid());

-- Update project
UPDATE projects SET name = 'Updated Project' WHERE name = 'Test Project';

-- Archive project
UPDATE projects SET archived = true WHERE name = 'Updated Project';

-- Verify logs
SELECT action, metadata FROM audit_logs
WHERE resource_type = 'projects'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected Result:**
- Three audit logs (create, update, update)
- Each log has correct action type and metadata

#### Test 5: Organization Members
```sql
-- Invite member (insert)
INSERT INTO organization_members (organization_id, user_id, role)
VALUES ('<org_id>', '<user_id>', 'developer');

-- Change role (update)
UPDATE organization_members
SET role = 'admin'
WHERE user_id = '<user_id>';

-- Remove member (delete)
DELETE FROM organization_members
WHERE user_id = '<user_id>';

-- Verify logs
SELECT action, metadata FROM audit_logs
WHERE resource_type = 'organization_members'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected Result:**
- Three audit logs (create, update, delete)
- Security-critical operations properly logged

---

### API Functions Testing

#### Test 6: Fetch Audit Logs with Pagination
```typescript
// In browser console or test file
const result = await fetchAuditLogs(organizationId, {}, { page: 1, pageSize: 50 });

console.log('Logs:', result.logs);
console.log('Total:', result.total);
console.log('Pages:', result.totalPages);
```

**Expected Result:**
- Returns array of logs (max 50)
- Total count matches database
- Pagination metadata correct

#### Test 7: Filter by Date Range
```typescript
const filters = {
  startDate: new Date('2024-11-01'),
  endDate: new Date('2024-11-03'),
};

const result = await fetchAuditLogs(organizationId, filters, { page: 1, pageSize: 50 });
console.log('Filtered logs:', result.logs);
```

**Expected Result:**
- Only logs within date range returned
- Logs sorted by created_at DESC

#### Test 8: Filter by User
```typescript
const filters = {
  userId: '<specific_user_id>',
};

const result = await fetchAuditLogs(organizationId, filters);
console.log('User logs:', result.logs);
```

**Expected Result:**
- Only logs from specified user returned

#### Test 9: Filter by Action Type
```typescript
const filters = {
  action: 'secrets.create',
};

const result = await fetchAuditLogs(organizationId, filters);
console.log('Create logs:', result.logs);
```

**Expected Result:**
- Only 'secrets.create' actions returned

#### Test 10: Export to CSV
```typescript
const csv = await exportAuditLogsToCSV(organizationId, {});
console.log(csv);
```

**Expected Result:**
- Valid CSV string with headers
- All logs included (no pagination)
- Special characters properly escaped

#### Test 11: Export to JSON
```typescript
const json = await exportAuditLogsToJSON(organizationId, {});
console.log(JSON.parse(json));
```

**Expected Result:**
- Valid JSON array
- All logs included
- Proper structure with user_email

#### Test 12: Real-time Subscription
```typescript
const channel = subscribeToAuditLogs(organizationId, (newLog) => {
  console.log('New log received:', newLog);
});

// Perform an operation that creates a log
// (e.g., create a secret in another tab)

// Clean up
channel.unsubscribe();
```

**Expected Result:**
- Callback fires when new log created
- Log includes user_email
- No memory leaks

---

### UI Component Testing

#### Test 13: AuditLogViewer Rendering
1. Navigate to `/dashboard/audit`
2. Verify table displays with columns:
   - Timestamp
   - User
   - Action
   - Resource Type
   - Resource ID
   - IP Address
   - Details

**Expected Result:**
- Table renders correctly
- Data loads automatically
- Loading state shown during fetch

#### Test 14: Pagination
1. Ensure there are > 50 audit logs
2. Verify pagination controls appear
3. Click "Next" button
4. Verify page 2 loads
5. Click "Previous" button
6. Verify page 1 loads

**Expected Result:**
- Pagination buttons enable/disable correctly
- Page numbers update
- Data changes when navigating

#### Test 15: Page Size Selection
1. Change page size from 50 to 25
2. Verify table shows only 25 rows
3. Verify pagination updates (more pages)

**Expected Result:**
- Page size changes correctly
- Resets to page 1
- Total pages recalculated

#### Test 16: Date Filters
1. Click "Start Date" calendar
2. Select a date
3. Verify table updates
4. Click "End Date" calendar
5. Select a date
6. Verify table shows logs within range

**Expected Result:**
- Calendar pickers work
- Filters apply immediately
- No logs outside date range shown

#### Test 17: User Filter
1. Click "User" dropdown
2. Select a specific user
3. Verify only that user's logs shown

**Expected Result:**
- Dropdown populated with org members
- Filter applies correctly
- "All users" option clears filter

#### Test 18: Action Filter
1. Click "Action" dropdown
2. Select a specific action (e.g., "secrets.create")
3. Verify only that action shown

**Expected Result:**
- Dropdown populated with unique actions
- Filter applies correctly

#### Test 19: Resource Type Filter
1. Click "Resource Type" dropdown
2. Select a resource type (e.g., "secrets")
3. Verify only that resource type shown

**Expected Result:**
- Dropdown populated with unique types
- Filter applies correctly

#### Test 20: Search by Resource ID
1. Type a resource ID into search box
2. Verify table filters to matching logs

**Expected Result:**
- Search works with partial matches
- Debouncing prevents too many requests

#### Test 21: Clear All Filters
1. Apply multiple filters
2. Click "Clear All" button
3. Verify all filters reset

**Expected Result:**
- All dropdowns reset to "All"
- Date pickers cleared
- Table shows all logs

#### Test 22: Export CSV
1. Click "Export" dropdown
2. Select "Export CSV"
3. Verify CSV file downloads

**Expected Result:**
- CSV file downloads with timestamp filename
- Contains all logs matching current filters
- Opens correctly in Excel/Google Sheets

#### Test 23: Export JSON
1. Click "Export" dropdown
2. Select "Export JSON"
3. Verify JSON file downloads

**Expected Result:**
- JSON file downloads
- Valid JSON structure
- Can be parsed without errors

#### Test 24: Real-time Updates
1. Open audit logs page
2. In another tab, create a new secret
3. Verify toast notification appears
4. Verify new log appears at top of table

**Expected Result:**
- Toast shows immediately
- New log prepended to table (if on page 1)
- No page refresh needed

#### Test 25: Details Expansion
1. Click "View" on any log's Details column
2. Verify metadata JSON expands
3. Click again to collapse

**Expected Result:**
- Details expand/collapse smoothly
- JSON formatted with syntax highlighting
- Scrollable if long

#### Test 26: Refresh Button
1. Click "Refresh" button
2. Verify loading spinner appears
3. Verify data reloads

**Expected Result:**
- Button shows loading state
- Data fetched from server
- Table updates with latest logs

---

### Permission Testing

#### Test 27: Owner/Admin Access
1. Sign in as organization owner
2. Navigate to `/dashboard/audit`
3. Verify audit logs page loads

**Expected Result:**
- Page accessible
- Logs display correctly

#### Test 28: Developer/Read-Only Access
1. Sign in as developer or read-only user
2. Navigate to `/dashboard/audit`
3. Verify "Access Denied" message shown

**Expected Result:**
- Access denied message displayed
- No audit logs visible
- Guidance to contact owner

---

### Security Testing

#### Test 29: Secret Values Not Logged
1. Create a secret with sensitive value
2. Check audit log metadata
3. Verify encrypted_value is logged, not plaintext

**Expected Result:**
- `encrypted_value` JSONB is logged
- No plaintext secrets in logs
- Only metadata visible

#### Test 30: RLS Policy Enforcement
1. Sign in as User A (Org 1)
2. Try to fetch audit logs for Org 2 (different org)
3. Verify no logs returned

**Expected Result:**
- RLS blocks access to other orgs' logs
- Empty result set returned
- No error thrown (proper security)

#### Test 31: IP Address Logging
1. Perform an operation from different IP
2. Check audit log
3. Verify IP address captured

**Expected Result:**
- IP address logged in `ip_address` column
- Matches actual IP (or proxy IP)

#### Test 32: User Agent Logging
1. Perform operation from different browser
2. Check audit log
3. Verify user agent captured

**Expected Result:**
- User agent string logged
- Identifies browser correctly

---

### Performance Testing

#### Test 33: Large Dataset Performance
1. Generate 10,000+ audit logs
2. Navigate to audit logs page
3. Verify page loads in < 2 seconds

**Expected Result:**
- Pagination prevents loading all logs
- Query performance acceptable
- UI remains responsive

#### Test 34: Filter Performance
1. Apply multiple filters simultaneously
2. Verify results return quickly (< 500ms)

**Expected Result:**
- Indexed columns make queries fast
- No significant lag

#### Test 35: Export Large Dataset
1. Export 10,000+ logs to CSV
2. Verify export completes without timeout

**Expected Result:**
- Export succeeds
- File size reasonable
- No browser memory issues

---

## SQL Test Queries

### Verify All Triggers Exist
```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'audit_%'
ORDER BY event_object_table, trigger_name;
```

**Expected Result:**
- 15 triggers total (3 per table × 5 tables)
- INSERT, UPDATE, DELETE for each table

### Verify Audit Log Function
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('log_audit', 'log_secret_access');
```

**Expected Result:**
- Both functions exist
- Type = FUNCTION

### Count Logs by Action Type
```sql
SELECT action, COUNT(*) as count
FROM audit_logs
GROUP BY action
ORDER BY count DESC;
```

**Expected Result:**
- Breakdown of all action types
- Verify expected operations logged

### Most Active Users
```sql
SELECT
  u.email,
  COUNT(*) as action_count
FROM audit_logs al
JOIN auth.users u ON al.user_id = u.id
GROUP BY u.email
ORDER BY action_count DESC
LIMIT 10;
```

**Expected Result:**
- List of most active users
- Useful for compliance reporting

### Recent Secret Access
```sql
SELECT
  s.key,
  s.service_name,
  al.created_at,
  u.email
FROM audit_logs al
JOIN secrets s ON al.resource_id = s.id
JOIN auth.users u ON al.user_id = u.id
WHERE al.action = 'secrets.read'
ORDER BY al.created_at DESC
LIMIT 20;
```

**Expected Result:**
- Recent secret reads
- Useful for security audits

---

## Automated Test Script (Vitest)

Create `__tests__/audit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  fetchAuditLogs,
  exportAuditLogsToCSV,
  exportAuditLogsToJSON,
} from '@/lib/api/audit';

describe('Audit Logging System', () => {
  let supabase: any;
  let testOrgId: string;
  let testProjectId: string;
  let testEnvId: string;

  beforeEach(async () => {
    // Setup test data
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
    // Create test org, project, environment
  });

  afterEach(async () => {
    // Cleanup test data
  });

  it('should log secret creation', async () => {
    // Create a secret
    const { data: secret } = await supabase.from('secrets').insert({
      project_id: testProjectId,
      environment_id: testEnvId,
      key: 'TEST_KEY',
      encrypted_value: { ciphertext: 'test' },
      created_by: 'test-user-id',
    }).select().single();

    // Fetch audit logs
    const { logs } = await fetchAuditLogs(testOrgId);

    // Verify log created
    const log = logs.find((l) => l.resource_id === secret.id);
    expect(log).toBeDefined();
    expect(log?.action).toBe('secrets.create');
  });

  it('should filter logs by date range', async () => {
    const startDate = new Date('2024-11-01');
    const endDate = new Date('2024-11-03');

    const { logs } = await fetchAuditLogs(testOrgId, { startDate, endDate });

    logs.forEach((log) => {
      const logDate = new Date(log.created_at);
      expect(logDate >= startDate && logDate <= endDate).toBe(true);
    });
  });

  it('should export to CSV format', async () => {
    const csv = await exportAuditLogsToCSV(testOrgId);

    expect(csv).toContain('Timestamp,User,Action');
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });

  it('should export to JSON format', async () => {
    const json = await exportAuditLogsToJSON(testOrgId);
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty('timestamp');
    expect(parsed[0]).toHaveProperty('action');
  });
});
```

---

## Production Readiness Checklist

- [ ] All database triggers installed
- [ ] RLS policies enforced
- [ ] API functions tested
- [ ] UI components tested
- [ ] Permission checks working
- [ ] Real-time updates working
- [ ] Export functions working
- [ ] Performance acceptable (< 2s page load)
- [ ] No sensitive data logged
- [ ] Error handling comprehensive
- [ ] Documentation complete

---

## Known Limitations

1. **IP Address**: May show Cloudflare/proxy IP in production
2. **User Agent**: Limited detail on mobile devices
3. **Real-time Updates**: Only shown on page 1 with no filters
4. **Export Limit**: Very large exports (>100k rows) may timeout

---

## Future Enhancements

1. **Retention Policy**: Auto-delete logs older than X days
2. **Anomaly Detection**: AI-powered unusual activity alerts
3. **Compliance Reports**: Pre-built reports for SOC 2, ISO 27001
4. **Webhook Notifications**: Send critical events to external systems
5. **Advanced Search**: Full-text search in metadata
6. **Visualizations**: Charts showing activity trends

---

## Troubleshooting

### Issue: Logs not appearing
- Check triggers are installed: See "Verify All Triggers Exist" query
- Verify RLS policies allow access
- Check user is owner/admin

### Issue: Real-time updates not working
- Verify Supabase Realtime enabled for `audit_logs` table
- Check browser console for subscription errors
- Ensure WebSocket connection established

### Issue: Export fails
- Check for large datasets (>100k rows)
- Verify browser memory sufficient
- Try exporting with date filters

### Issue: Performance slow
- Verify indexes exist on `organization_id`, `created_at`, `action`, `resource_type`
- Check query execution plan
- Consider archiving old logs

---

**End of Test Plan**
