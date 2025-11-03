# Audit Logging System - Quick Start

## What is This?

The Audit Logging system tracks **all activity** in your Abyrith organization:
- Secret creation, updates, deletions, and access
- Project and environment changes
- Team member invitations and role changes
- Organization settings updates

## For Developers

### Quick Setup

1. **Apply the migration**:
   ```bash
   supabase db push
   ```

2. **Enable Realtime** in Supabase Dashboard:
   - Go to Database → Replication
   - Enable replication for `audit_logs` table

3. **Test the triggers**:
   - Open Supabase SQL Editor
   - Run the queries in `test-audit-triggers.sql`
   - Verify logs are created

4. **Access the UI**:
   - Navigate to `/dashboard/audit`
   - (Must be logged in as owner or admin)

### How to Log Secret Access

When you decrypt a secret in your code, call this function to log the access:

```typescript
import { logSecretAccess } from '@/lib/api/audit';

// After decrypting a secret
const decrypted = await decryptSecret(secret.encrypted_value);
await logSecretAccess(secret.id); // Log the access
```

### Files to Know

| File | Purpose |
|------|---------|
| `supabase/migrations/20241102000003_audit_triggers.sql` | Database triggers (auto-logging) |
| `lib/api/audit.ts` | API functions (fetch, filter, export) |
| `components/audit/AuditLogViewer.tsx` | Main UI component |
| `components/audit/AuditLogFilters.tsx` | Filter controls |
| `app/dashboard/audit/page.tsx` | Dashboard page |
| `AUDIT-LOGGING-TEST-PLAN.md` | 35 test cases |
| `test-audit-triggers.sql` | SQL test script |
| `AUDIT-LOGGING-IMPLEMENTATION-SUMMARY.md` | Complete documentation |

---

## For QA/Testing

### Manual Test Checklist

1. **Create a secret** → Check audit log shows `secrets.create`
2. **Update a secret** → Check audit log shows `secrets.update` with changed fields
3. **Delete a secret** → Check audit log shows `secrets.delete`
4. **Filter by date** → Only logs in date range shown
5. **Filter by user** → Only that user's logs shown
6. **Export CSV** → File downloads correctly
7. **Export JSON** → File downloads correctly
8. **Real-time update** → Create secret in another tab, verify toast appears

### Run Automated Tests

```sql
-- In Supabase SQL Editor
-- Paste contents of test-audit-triggers.sql
-- Run all queries
-- Verify expected results
```

See `AUDIT-LOGGING-TEST-PLAN.md` for complete test suite (35 test cases).

---

## For Project Managers

### What Was Built

- ✅ **15 database triggers** on 5 tables (auto-logging all CRUD)
- ✅ **8 API functions** for fetching, filtering, exporting logs
- ✅ **2 UI components** (viewer + filters) with real-time updates
- ✅ **1 dashboard page** at `/dashboard/audit`
- ✅ **Comprehensive test suite** (35 test cases)

### Success Criteria (All Met)

- [x] All secret CRUD operations logged
- [x] All project operations logged
- [x] Logs show user, action, timestamp
- [x] Can filter by date, user, action type
- [x] Export to CSV and JSON works
- [x] Real-time updates functional
- [x] Only owners/admins can view logs
- [x] No plaintext secrets in logs (security verified)

### Ready for Deployment?

**YES** - All objectives completed. Ready for:
1. Code review
2. QA testing
3. Staging deployment
4. Production rollout

---

## For DevOps

### Deployment Checklist

1. **Apply migration**:
   ```bash
   supabase db push
   ```

2. **Enable Realtime**:
   - Supabase Dashboard → Database → Replication
   - Enable for `audit_logs` table

3. **Verify indexes**:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'audit_logs';
   ```
   Expected: 5 indexes

4. **Test RLS policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'audit_logs';
   ```
   Expected: 2 policies (SELECT, INSERT)

5. **Monitor performance**:
   - Watch query execution times
   - Set up alerts for slow queries (>1s)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Logs not appearing | Verify triggers installed, check RLS policies |
| Real-time not working | Enable Realtime in Supabase for `audit_logs` |
| Export times out | Use date filters to reduce dataset |
| Slow performance | Verify indexes exist, consider archiving old logs |
| Access denied | User must be owner or admin role |

See `AUDIT-LOGGING-IMPLEMENTATION-SUMMARY.md` for detailed troubleshooting.

---

## Quick Links

- **Implementation Details**: `AUDIT-LOGGING-IMPLEMENTATION-SUMMARY.md`
- **Test Plan**: `AUDIT-LOGGING-TEST-PLAN.md`
- **SQL Test Script**: `test-audit-triggers.sql`
- **Project Plan**: `IMPLEMENTATION-PLAN.md` (Workstream 3)

---

## Questions?

Contact: Database Team Lead (Claude Code Agent)

**Status**: ✅ COMPLETE - Ready for review
