-- ============================================================================
-- Audit Logging System - Quick Verification Queries
-- ============================================================================
-- Run these queries in Supabase SQL Editor to verify audit logging is working
-- After applying migration 20241102000003_audit_triggers.sql

-- ============================================================================
-- 1. VERIFY TRIGGERS INSTALLED
-- ============================================================================

-- Should return 15 rows (3 triggers per table × 5 tables)
SELECT
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event_type,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'audit_%'
ORDER BY event_object_table, event_manipulation;

-- Expected output:
-- environments        audit_environments_delete    DELETE
-- environments        audit_environments_insert    INSERT
-- environments        audit_environments_update    UPDATE
-- organization_members audit_members_delete        DELETE
-- organization_members audit_members_insert        INSERT
-- organization_members audit_members_update        UPDATE
-- organizations       audit_organizations_delete   DELETE
-- organizations       audit_organizations_insert   INSERT
-- organizations       audit_organizations_update   UPDATE
-- projects            audit_projects_delete        DELETE
-- projects            audit_projects_insert        INSERT
-- projects            audit_projects_update        UPDATE
-- secrets             audit_secrets_delete         DELETE
-- secrets             audit_secrets_insert         INSERT
-- secrets             audit_secrets_update         UPDATE

-- ============================================================================
-- 2. VERIFY FUNCTIONS INSTALLED
-- ============================================================================

-- Should return 2 functions
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('log_audit', 'log_secret_access');

-- Expected output:
-- log_audit          FUNCTION    trigger
-- log_secret_access  FUNCTION    void

-- ============================================================================
-- 3. VERIFY AUDIT LOGS TABLE EXISTS
-- ============================================================================

-- Should describe the audit_logs table structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
ORDER BY ordinal_position;

-- Expected columns:
-- id, organization_id, user_id, action, resource_type, resource_id,
-- metadata, ip_address, user_agent, created_at

-- ============================================================================
-- 4. VERIFY INDEXES ON AUDIT_LOGS
-- ============================================================================

-- Should return 5 indexes (plus primary key)
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'audit_logs'
ORDER BY indexname;

-- Expected indexes:
-- audit_logs_pkey (primary key on id)
-- idx_audit_logs_action
-- idx_audit_logs_created_at
-- idx_audit_logs_organization_id
-- idx_audit_logs_resource (composite: resource_type, resource_id)
-- idx_audit_logs_user_id

-- ============================================================================
-- 5. VERIFY RLS POLICIES
-- ============================================================================

-- Should return 2 policies (SELECT for members, INSERT for system)
SELECT
  policyname,
  cmd as command,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'audit_logs';

-- Expected policies:
-- Members can view audit logs    SELECT
-- System can insert audit logs   INSERT

-- ============================================================================
-- 6. COUNT EXISTING AUDIT LOGS
-- ============================================================================

-- Shows total logs in the system
SELECT COUNT(*) as total_audit_logs FROM audit_logs;

-- Shows breakdown by action type
SELECT
  action,
  COUNT(*) as count
FROM audit_logs
GROUP BY action
ORDER BY count DESC;

-- Shows breakdown by resource type
SELECT
  resource_type,
  COUNT(*) as count
FROM audit_logs
GROUP BY resource_type
ORDER BY count DESC;

-- ============================================================================
-- 7. RECENT AUDIT ACTIVITY (Last 10 logs)
-- ============================================================================

SELECT
  created_at,
  action,
  resource_type,
  resource_id,
  user_id,
  metadata->>'operation' as operation
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 8. VERIFY SECURITY - NO PLAINTEXT SECRETS
-- ============================================================================

-- CRITICAL: This query should return 0 rows
-- If it returns any rows, plaintext secrets are being logged (BAD!)
SELECT
  id,
  action,
  metadata
FROM audit_logs
WHERE resource_type = 'secrets'
  AND (
    metadata::text ILIKE '%plaintext%'
    OR metadata::text ILIKE '%decrypted%'
    OR metadata::text ILIKE '%password%'
  );

-- Expected: 0 rows (empty result)

-- ============================================================================
-- 9. VERIFY ENCRYPTED VALUES ARE LOGGED
-- ============================================================================

-- This should show that encrypted_value structure is logged
-- (ciphertext, iv, salt, algorithm)
SELECT
  action,
  metadata->'new'->'encrypted_value' as encrypted_structure
FROM audit_logs
WHERE resource_type = 'secrets'
  AND action = 'secrets.create'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: Shows JSONB object with keys: ciphertext, iv, salt, algorithm

-- ============================================================================
-- 10. AUDIT LOGS BY USER
-- ============================================================================

-- Shows most active users
SELECT
  user_id,
  COUNT(*) as action_count,
  MIN(created_at) as first_action,
  MAX(created_at) as last_action
FROM audit_logs
GROUP BY user_id
ORDER BY action_count DESC;

-- ============================================================================
-- 11. SECRET ACCESS TRACKING
-- ============================================================================

-- Shows which secrets were accessed (read)
SELECT
  al.created_at,
  al.resource_id as secret_id,
  al.metadata->>'accessed_at' as access_time,
  s.key as secret_key,
  s.service_name
FROM audit_logs al
LEFT JOIN secrets s ON al.resource_id = s.id
WHERE al.action = 'secrets.read'
ORDER BY al.created_at DESC
LIMIT 20;

-- ============================================================================
-- 12. AUDIT LOGS FOR SPECIFIC ORGANIZATION
-- ============================================================================

-- Replace <org_id> with actual organization ID
SELECT
  created_at,
  action,
  resource_type,
  user_id,
  metadata->>'operation' as operation
FROM audit_logs
WHERE organization_id = '<org_id>'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 13. CHANGED FIELDS ON UPDATES
-- ============================================================================

-- Shows what fields were changed in UPDATE operations
SELECT
  created_at,
  action,
  resource_type,
  metadata->'old'->'changed_fields' as old_values,
  metadata->'new'->'changed_fields' as new_values
FROM audit_logs
WHERE action LIKE '%.update'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 14. CRITICAL OPERATIONS (Deletions and Member Changes)
-- ============================================================================

-- Track all deletions
SELECT
  created_at,
  action,
  resource_type,
  resource_id,
  metadata->'old'->>'key' as deleted_key, -- for secrets
  metadata->'old'->>'name' as deleted_name -- for projects/envs
FROM audit_logs
WHERE action LIKE '%.delete'
ORDER BY created_at DESC
LIMIT 20;

-- Track team membership changes (security-critical)
SELECT
  created_at,
  action,
  user_id,
  metadata->'new'->>'role' as new_role,
  metadata->'old'->'changed_fields'->>'role' as old_role
FROM audit_logs
WHERE resource_type = 'organization_members'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 15. AUDIT LOG STATISTICS
-- ============================================================================

-- Comprehensive statistics
SELECT
  'Total Logs' as metric,
  COUNT(*)::text as value
FROM audit_logs
UNION ALL
SELECT
  'Unique Actions',
  COUNT(DISTINCT action)::text
FROM audit_logs
UNION ALL
SELECT
  'Unique Resource Types',
  COUNT(DISTINCT resource_type)::text
FROM audit_logs
UNION ALL
SELECT
  'Unique Users',
  COUNT(DISTINCT user_id)::text
FROM audit_logs
UNION ALL
SELECT
  'Oldest Log',
  MIN(created_at)::text
FROM audit_logs
UNION ALL
SELECT
  'Newest Log',
  MAX(created_at)::text
FROM audit_logs;

-- ============================================================================
-- 16. PERFORMANCE CHECK - QUERY SPEED
-- ============================================================================

-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT *
FROM audit_logs
WHERE organization_id = (SELECT id FROM organizations LIMIT 1)
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Look for "Index Scan" in the output (good)
-- If you see "Seq Scan" (sequential scan), indexes may not be working

-- ============================================================================
-- 17. TEST TRIGGER FUNCTIONALITY (QUICK TEST)
-- ============================================================================

-- Create a test project (will trigger audit log)
INSERT INTO projects (organization_id, name, description, created_by)
SELECT
  id,
  'Audit Verification Test',
  'Quick test to verify triggers work',
  (SELECT auth.uid())
FROM organizations
LIMIT 1
RETURNING id, name;

-- Verify audit log was created
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  metadata->'new'->>'name' as project_name,
  created_at
FROM audit_logs
WHERE action = 'projects.create'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: One log with action='projects.create' and name='Audit Verification Test'

-- Cleanup test project
DELETE FROM projects WHERE name = 'Audit Verification Test';

-- Verify delete log was created
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  metadata->'old'->>'name' as deleted_project_name,
  created_at
FROM audit_logs
WHERE action = 'projects.delete'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: One log with action='projects.delete' and name='Audit Verification Test'

-- ============================================================================
-- 18. IP ADDRESS AND USER AGENT TRACKING
-- ============================================================================

-- Check if IP addresses and user agents are being captured
SELECT
  created_at,
  action,
  ip_address,
  user_agent,
  CASE
    WHEN ip_address IS NOT NULL THEN 'Captured'
    ELSE 'Not Captured'
  END as ip_status,
  CASE
    WHEN user_agent IS NOT NULL THEN 'Captured'
    ELSE 'Not Captured'
  END as ua_status
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- Note: ip_address and user_agent may be NULL if not available from request headers
-- In production, these should be populated

-- ============================================================================
-- 19. COMPLIANCE REPORT - LAST 30 DAYS
-- ============================================================================

-- Summary report for compliance
SELECT
  action,
  COUNT(*) as total_operations,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY action
ORDER BY total_operations DESC;

-- ============================================================================
-- 20. VERIFY REALTIME ENABLED
-- ============================================================================

-- Check if audit_logs table is configured for Realtime
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename = 'audit_logs';

-- Note: Realtime enablement is done in Supabase Dashboard → Database → Replication
-- This query just shows the table exists and its size

-- ============================================================================
-- FINAL VERIFICATION CHECKLIST
-- ============================================================================

-- Run all of the above queries and verify:
-- [x] 15 triggers installed
-- [x] 2 functions installed (log_audit, log_secret_access)
-- [x] audit_logs table exists with correct columns
-- [x] 5+ indexes on audit_logs
-- [x] 2 RLS policies (SELECT, INSERT)
-- [x] Audit logs exist in database
-- [x] No plaintext secrets in logs (CRITICAL)
-- [x] Encrypted values are logged correctly
-- [x] Test triggers work (create/delete project)
-- [x] IP address and user agent captured (if available)

-- If all checks pass, audit logging is working correctly! ✅

-- ============================================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================================
