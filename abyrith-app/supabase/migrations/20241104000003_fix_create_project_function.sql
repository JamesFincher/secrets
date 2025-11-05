-- Fix create_project_with_environments function to bypass RLS
-- The function already validates permissions internally, so it's safe to bypass RLS

DROP FUNCTION IF EXISTS create_project_with_environments(UUID, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION create_project_with_environments(
  p_organization_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_created_by UUID
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  name TEXT,
  description TEXT,
  created_by UUID,
  archived BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_project projects%ROWTYPE;
BEGIN
  -- Verify the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the user_id matches the authenticated user
  IF auth.uid() != p_created_by THEN
    RAISE EXCEPTION 'User ID mismatch';
  END IF;

  -- Verify user is a member of the organization with at least developer role
  IF NOT has_role(p_organization_id, 'developer') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Temporarily disable RLS for this transaction since we've already validated permissions
  SET LOCAL row_security = off;

  -- Insert the project
  INSERT INTO projects (organization_id, name, description, created_by)
  VALUES (p_organization_id, p_name, p_description, p_created_by)
  RETURNING * INTO new_project;

  -- Create default environments
  INSERT INTO environments (project_id, name, slug, sort_order)
  VALUES
    (new_project.id, 'Development', 'development', 0),
    (new_project.id, 'Staging', 'staging', 1),
    (new_project.id, 'Production', 'production', 2);

  -- Re-enable RLS (will automatically revert at end of transaction anyway)
  SET LOCAL row_security = on;

  -- Return the project
  RETURN QUERY SELECT
    new_project.id,
    new_project.organization_id,
    new_project.name,
    new_project.description,
    new_project.created_by,
    new_project.archived,
    new_project.created_at,
    new_project.updated_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_project_with_environments(UUID, TEXT, TEXT, UUID) TO authenticated;
