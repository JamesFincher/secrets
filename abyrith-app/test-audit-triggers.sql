-- Test Script for Audit Logging Triggers
-- Run this in Supabase SQL Editor after applying migrations
-- This script tests that all triggers are working correctly

-- Prerequisites: You must have:
-- 1. An organization created
-- 2. A user logged in (auth.uid() must return a valid user)
-- 3. Migrations 20241102000001, 20241102000002, and 20241102000003 applied

-- ============================================================================
-- PART 1: VERIFY TRIGGERS EXIST
-- ============================================================================

SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'audit_%'
ORDER BY event_object_table, trigger_name;

-- Expected: 15 rows (3 triggers per table × 5 tables)
-- Each table should have: INSERT, UPDATE, DELETE triggers

-- ============================================================================
-- PART 2: VERIFY FUNCTIONS EXIST
-- ============================================================================

SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('log_audit', 'log_secret_access');

-- Expected: 2 functions (log_audit, log_secret_access)

-- ============================================================================
-- PART 3: TEST PROJECT AUDIT LOGGING
-- ============================================================================

-- Get current count
SELECT COUNT(*) as before_count FROM audit_logs WHERE resource_type = 'projects';

-- Create test project
INSERT INTO projects (organization_id, name, description, created_by)
SELECT
  id,
  'Audit Test Project',
  'Testing audit logging functionality',
  (SELECT auth.uid())
FROM organizations
LIMIT 1
RETURNING id;

-- Get new count
SELECT COUNT(*) as after_count FROM audit_logs WHERE resource_type = 'projects';

-- Verify the audit log
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  created_at
FROM audit_logs
WHERE resource_type = 'projects'
  AND action = 'projects.create'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: action = 'projects.create', operation = 'INSERT'

-- ============================================================================
-- PART 4: TEST ENVIRONMENT AUDIT LOGGING
-- ============================================================================

-- Create test environment
INSERT INTO environments (project_id, name, slug, description)
SELECT
  id,
  'test-env',
  'test',
  'Testing audit logging'
FROM projects
WHERE name = 'Audit Test Project'
LIMIT 1
RETURNING id;

-- Verify the audit log
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  created_at
FROM audit_logs
WHERE resource_type = 'environments'
  AND action = 'environments.create'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: action = 'environments.create', operation = 'INSERT'

-- ============================================================================
-- PART 5: TEST SECRET AUDIT LOGGING (CRITICAL)
-- ============================================================================

-- Create test secret
INSERT INTO secrets (
  project_id,
  environment_id,
  key,
  encrypted_value,
  description,
  service_name,
  created_by
)
SELECT
  p.id,
  e.id,
  'TEST_AUDIT_KEY',
  '{"ciphertext": "encrypted_value_here", "iv": "initialization_vector", "salt": "salt_value", "algorithm": "AES-256-GCM"}'::jsonb,
  'Test secret for audit logging',
  'TestService',
  (SELECT auth.uid())
FROM projects p
JOIN environments e ON e.project_id = p.id
WHERE p.name = 'Audit Test Project'
  AND e.name = 'test-env'
LIMIT 1
RETURNING id;

-- Verify the audit log for secret creation
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  metadata->'new'->>'key' as secret_key,
  metadata->'new'->>'service_name' as service,
  created_at
FROM audit_logs
WHERE resource_type = 'secrets'
  AND action = 'secrets.create'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: action = 'secrets.create', secret_key = 'TEST_AUDIT_KEY'
-- IMPORTANT: Verify that encrypted_value is present but NOT decrypted

-- ============================================================================
-- PART 6: TEST SECRET UPDATE LOGGING
-- ============================================================================

-- Update the test secret
UPDATE secrets
SET description = 'Updated description for audit test'
WHERE key = 'TEST_AUDIT_KEY';

-- Verify update audit log
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  metadata->'old'->'changed_fields'->>'description' as old_description,
  metadata->'new'->'changed_fields'->>'description' as new_description,
  created_at
FROM audit_logs
WHERE resource_type = 'secrets'
  AND action = 'secrets.update'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: Shows changed fields (old vs new description)

-- ============================================================================
-- PART 7: TEST SECRET ACCESS LOGGING (FUNCTION)
-- ============================================================================

-- Get the test secret ID
DO $$
DECLARE
  secret_uuid UUID;
BEGIN
  SELECT id INTO secret_uuid
  FROM secrets
  WHERE key = 'TEST_AUDIT_KEY'
  LIMIT 1;

  -- Log secret access (simulating decryption)
  PERFORM log_secret_access(secret_uuid);
END $$;

-- Verify secret access log
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  metadata->>'accessed_at' as accessed_at,
  created_at
FROM audit_logs
WHERE action = 'secrets.read'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: action = 'secrets.read', operation = 'READ'

-- Verify last_accessed_at updated
SELECT
  key,
  last_accessed_at,
  created_at
FROM secrets
WHERE key = 'TEST_AUDIT_KEY';

-- Expected: last_accessed_at is very recent (just now)

-- ============================================================================
-- PART 8: TEST SECRET DELETION LOGGING
-- ============================================================================

-- Delete test secret
DELETE FROM secrets
WHERE key = 'TEST_AUDIT_KEY';

-- Verify deletion audit log
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  metadata->'old'->>'key' as deleted_key,
  created_at
FROM audit_logs
WHERE resource_type = 'secrets'
  AND action = 'secrets.delete'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: action = 'secrets.delete', deleted_key = 'TEST_AUDIT_KEY'

-- ============================================================================
-- PART 9: TEST ORGANIZATION MEMBER LOGGING
-- ============================================================================

-- Note: This requires a second user to exist
-- Create a test invite (if you have another user)
-- Otherwise, skip this test

-- Verify organization_members triggers exist
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'organization_members'
  AND trigger_name LIKE 'audit_%';

-- Expected: 3 triggers (insert, update, delete)

-- ============================================================================
-- PART 10: COMPREHENSIVE AUDIT LOG SUMMARY
-- ============================================================================

-- Count logs by action type
SELECT
  action,
  COUNT(*) as count
FROM audit_logs
GROUP BY action
ORDER BY count DESC;

-- Recent audit activity
SELECT
  action,
  resource_type,
  metadata->>'operation' as operation,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- Verify organization_id is populated correctly
SELECT
  organization_id,
  action,
  resource_type,
  COUNT(*) as count
FROM audit_logs
GROUP BY organization_id, action, resource_type
ORDER BY organization_id, action;

-- Expected: All logs have valid organization_id

-- ============================================================================
-- PART 11: CLEANUP TEST DATA
-- ============================================================================

-- Delete test environment (cascades to secrets if any remain)
DELETE FROM environments
WHERE name = 'test-env';

-- Delete test project
DELETE FROM projects
WHERE name = 'Audit Test Project';

-- Verify cleanup logs created
SELECT
  action,
  resource_type,
  created_at
FROM audit_logs
WHERE action LIKE '%.delete'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Delete logs for environment and project

-- ============================================================================
-- PART 12: SECURITY VERIFICATION
-- ============================================================================

-- Verify no plaintext secrets in audit logs
-- This query should return ZERO rows if security is correct
SELECT
  id,
  action,
  metadata
FROM audit_logs
WHERE resource_type = 'secrets'
  AND metadata::text ILIKE '%plaintext%';

-- Expected: 0 rows (no plaintext secrets)

-- Verify encrypted_value structure is logged
SELECT
  action,
  metadata->'new'->'encrypted_value' as encrypted_structure
FROM audit_logs
WHERE resource_type = 'secrets'
  AND action = 'secrets.create'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: Shows JSONB structure with ciphertext, iv, salt, algorithm

-- ============================================================================
-- TEST COMPLETE
-- ============================================================================

-- Final summary
SELECT
  'Test Summary' as report,
  (SELECT COUNT(*) FROM audit_logs) as total_audit_logs,
  (SELECT COUNT(DISTINCT action) FROM audit_logs) as unique_actions,
  (SELECT COUNT(DISTINCT resource_type) FROM audit_logs) as unique_resources,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%') as triggers_installed;

-- Expected:
-- - total_audit_logs > 0
-- - unique_actions > 5 (create, update, delete for different resources)
-- - unique_resources > 3 (secrets, projects, environments, etc.)
-- - triggers_installed = 15

COMMENT ON TABLE audit_logs IS 'Comprehensive audit logging for all critical operations. Triggers automatically log INSERT, UPDATE, DELETE on secrets, projects, environments, organization_members, and organizations tables.';
