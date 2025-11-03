-- Row Level Security (RLS) Policies
-- Based on 03-security/rbac/rls-policies.md
--
-- Security Model:
-- - Users can only access data within their organizations
-- - Roles determine what actions users can perform
-- - All tables enforce multi-tenancy through RLS

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

--
-- HELPER FUNCTION: Check if user is member of organization
--
CREATE OR REPLACE FUNCTION is_organization_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM organization_members
        WHERE organization_id = org_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--
-- HELPER FUNCTION: Get user's role in organization
--
CREATE OR REPLACE FUNCTION get_user_role(org_id UUID)
RETURNS user_role AS $$
DECLARE
    user_role_value user_role;
BEGIN
    SELECT role INTO user_role_value
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid();

    RETURN user_role_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--
-- HELPER FUNCTION: Check if user has minimum role
--
CREATE OR REPLACE FUNCTION has_role(org_id UUID, required_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_value user_role;
    role_hierarchy INTEGER;
    required_hierarchy INTEGER;
BEGIN
    user_role_value := get_user_role(org_id);

    -- Role hierarchy: owner > admin > developer > read_only
    role_hierarchy := CASE user_role_value
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'developer' THEN 2
        WHEN 'read_only' THEN 1
        ELSE 0
    END;

    required_hierarchy := CASE required_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'developer' THEN 2
        WHEN 'read_only' THEN 1
        ELSE 0
    END;

    RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--
-- ORGANIZATIONS POLICIES
--

-- Users can view organizations they are members of
CREATE POLICY "Users can view their organizations"
    ON organizations FOR SELECT
    USING (is_organization_member(id));

-- Users can create new organizations (become owner)
CREATE POLICY "Users can create organizations"
    ON organizations FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Only owners can update organizations
CREATE POLICY "Owners can update their organizations"
    ON organizations FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Only owners can delete organizations
CREATE POLICY "Owners can delete their organizations"
    ON organizations FOR DELETE
    USING (owner_id = auth.uid());

--
-- ORGANIZATION_MEMBERS POLICIES
--

-- Members can view other members in their organizations
CREATE POLICY "Members can view organization members"
    ON organization_members FOR SELECT
    USING (is_organization_member(organization_id));

-- Admins and owners can invite new members
CREATE POLICY "Admins can invite members"
    ON organization_members FOR INSERT
    WITH CHECK (
        has_role(organization_id, 'admin')
        AND role != 'owner' -- Can't create new owners
    );

-- Admins and owners can update member roles (except owner role)
CREATE POLICY "Admins can update member roles"
    ON organization_members FOR UPDATE
    USING (has_role(organization_id, 'admin'))
    WITH CHECK (
        has_role(organization_id, 'admin')
        AND role != 'owner' -- Can't promote to owner
    );

-- Admins and owners can remove members
CREATE POLICY "Admins can remove members"
    ON organization_members FOR DELETE
    USING (
        has_role(organization_id, 'admin')
        AND user_id != (SELECT owner_id FROM organizations WHERE id = organization_id)
    );

--
-- PROJECTS POLICIES
--

-- Members can view projects in their organizations
CREATE POLICY "Members can view projects"
    ON projects FOR SELECT
    USING (is_organization_member(organization_id));

-- Developers and above can create projects
CREATE POLICY "Developers can create projects"
    ON projects FOR INSERT
    WITH CHECK (has_role(organization_id, 'developer'));

-- Developers and above can update projects
CREATE POLICY "Developers can update projects"
    ON projects FOR UPDATE
    USING (has_role(organization_id, 'developer'))
    WITH CHECK (has_role(organization_id, 'developer'));

-- Admins and above can delete projects
CREATE POLICY "Admins can delete projects"
    ON projects FOR DELETE
    USING (has_role(organization_id, 'admin'));

--
-- ENVIRONMENTS POLICIES
--

-- Members can view environments in their organization's projects
CREATE POLICY "Members can view environments"
    ON environments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = environments.project_id
            AND is_organization_member(projects.organization_id)
        )
    );

-- Developers and above can create environments
CREATE POLICY "Developers can create environments"
    ON environments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = environments.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

-- Developers and above can update environments
CREATE POLICY "Developers can update environments"
    ON environments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = environments.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

-- Admins and above can delete environments
CREATE POLICY "Admins can delete environments"
    ON environments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = environments.project_id
            AND has_role(projects.organization_id, 'admin')
        )
    );

--
-- SECRETS POLICIES
--

-- Members can view secrets in their organization's projects
CREATE POLICY "Members can view secrets"
    ON secrets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = secrets.project_id
            AND is_organization_member(projects.organization_id)
        )
    );

-- Developers and above can create secrets
CREATE POLICY "Developers can create secrets"
    ON secrets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = secrets.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

-- Developers and above can update secrets
CREATE POLICY "Developers can update secrets"
    ON secrets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = secrets.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

-- Developers and above can delete secrets
CREATE POLICY "Developers can delete secrets"
    ON secrets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = secrets.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

--
-- USER_PREFERENCES POLICIES
--

-- Users can only access their own preferences
CREATE POLICY "Users can view their own preferences"
    ON user_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own preferences"
    ON user_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
    ON user_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences"
    ON user_preferences FOR DELETE
    USING (user_id = auth.uid());

--
-- AUDIT_LOGS POLICIES
--

-- Members can view audit logs for their organizations
CREATE POLICY "Members can view audit logs"
    ON audit_logs FOR SELECT
    USING (is_organization_member(organization_id));

-- System can insert audit logs (enforced by triggers/functions)
CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- Audit logs are immutable (no updates or deletes)

--
-- CONVERSATIONS POLICIES
--

-- Users can view their own conversations
CREATE POLICY "Users can view their conversations"
    ON conversations FOR SELECT
    USING (user_id = auth.uid() AND is_organization_member(organization_id));

CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (user_id = auth.uid() AND is_organization_member(organization_id));

CREATE POLICY "Users can update their conversations"
    ON conversations FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their conversations"
    ON conversations FOR DELETE
    USING (user_id = auth.uid());

--
-- MESSAGES POLICIES
--

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Messages are immutable after creation
