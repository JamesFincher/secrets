-- Create a database function to handle organization creation
-- This bypasses RLS issues by using SECURITY DEFINER

CREATE OR REPLACE FUNCTION create_organization_with_member(
  org_name TEXT,
  org_slug TEXT,
  user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  owner_id UUID,
  settings JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_org organizations%ROWTYPE;
BEGIN
  -- Verify the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the user_id matches the authenticated user
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'User ID mismatch';
  END IF;

  -- Insert the organization
  INSERT INTO organizations (name, slug, owner_id)
  VALUES (org_name, org_slug, user_id)
  RETURNING * INTO new_org;

  -- Insert the organization member (owner)
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org.id, user_id, 'owner');

  -- Return the organization
  RETURN QUERY SELECT
    new_org.id,
    new_org.name,
    new_org.slug,
    new_org.owner_id,
    new_org.settings,
    new_org.created_at,
    new_org.updated_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_with_member(TEXT, TEXT, UUID) TO authenticated;
