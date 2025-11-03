-- Fix RLS policy for organization_members to allow owner self-registration
-- This solves the chicken-and-egg problem where the first member (owner) can't be added

-- Drop the existing policy that prevents owner creation
DROP POLICY IF EXISTS "Admins can invite members" ON organization_members;

-- Create a new policy that allows users to add themselves as owner when creating an org
CREATE POLICY "Users can add themselves as owner when creating organization"
    ON organization_members FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND role = 'owner'
        AND EXISTS (
            SELECT 1 FROM organizations
            WHERE id = organization_id
            AND owner_id = auth.uid()
        )
    );

-- Admins can invite non-owner members
CREATE POLICY "Admins can invite non-owner members"
    ON organization_members FOR INSERT
    WITH CHECK (
        has_role(organization_id, 'admin')
        AND role != 'owner' -- Can't create additional owners
        AND user_id != auth.uid() -- Can't add yourself (use owner policy for that)
    );
