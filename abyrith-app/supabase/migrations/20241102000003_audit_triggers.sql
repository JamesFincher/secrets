-- Audit Logging Triggers
-- Automatically logs all CRUD operations on critical tables
-- Based on 04-database/schemas/audit-logs.md
--
-- Security Note: Never log decrypted secret values, only metadata

--
-- AUDIT LOGGING FUNCTION
-- Generic function to log INSERT, UPDATE, DELETE operations
--
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    old_data JSONB;
    new_data JSONB;
    action_type TEXT;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := TG_TABLE_NAME || '.create';
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := TG_TABLE_NAME || '.update';
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        action_type := TG_TABLE_NAME || '.delete';
        old_data := to_jsonb(OLD);
    END IF;

    -- Get organization_id based on table
    IF TG_TABLE_NAME = 'organizations' THEN
        org_id := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'organization_members' THEN
        org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    ELSIF TG_TABLE_NAME = 'projects' THEN
        org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    ELSIF TG_TABLE_NAME = 'environments' THEN
        -- Get org_id via project
        SELECT p.organization_id INTO org_id
        FROM projects p
        WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);
    ELSIF TG_TABLE_NAME = 'secrets' THEN
        -- Get org_id via project
        SELECT p.organization_id INTO org_id
        FROM projects p
        WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);
    END IF;

    -- Insert audit log
    INSERT INTO audit_logs (
        organization_id,
        user_id,
        action,
        resource_type,
        resource_id,
        metadata,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        org_id,
        auth.uid(),
        action_type,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object(
            'operation', TG_OP,
            'old', CASE
                WHEN TG_OP = 'DELETE' THEN old_data
                WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
                    'changed_fields', (
                        SELECT jsonb_object_agg(key, value)
                        FROM jsonb_each(old_data)
                        WHERE old_data->key IS DISTINCT FROM new_data->key
                    )
                )
                ELSE NULL
            END,
            'new', CASE
                WHEN TG_OP = 'INSERT' THEN new_data
                WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
                    'changed_fields', (
                        SELECT jsonb_object_agg(key, value)
                        FROM jsonb_each(new_data)
                        WHERE old_data->key IS DISTINCT FROM new_data->key
                    )
                )
                ELSE NULL
            END
        ),
        current_setting('request.headers', true)::json->>'x-forwarded-for',
        current_setting('request.headers', true)::json->>'user-agent',
        NOW()
    );

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--
-- SECRETS TABLE TRIGGERS
-- Track all secret CRUD operations
--
CREATE TRIGGER audit_secrets_insert
    AFTER INSERT ON secrets
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_secrets_update
    AFTER UPDATE ON secrets
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_secrets_delete
    AFTER DELETE ON secrets
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

--
-- PROJECTS TABLE TRIGGERS
-- Track project lifecycle
--
CREATE TRIGGER audit_projects_insert
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_projects_update
    AFTER UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_projects_delete
    AFTER DELETE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

--
-- ENVIRONMENTS TABLE TRIGGERS
-- Track environment changes
--
CREATE TRIGGER audit_environments_insert
    AFTER INSERT ON environments
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_environments_update
    AFTER UPDATE ON environments
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_environments_delete
    AFTER DELETE ON environments
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

--
-- ORGANIZATION_MEMBERS TABLE TRIGGERS
-- Track team membership changes (security-critical)
--
CREATE TRIGGER audit_members_insert
    AFTER INSERT ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_members_update
    AFTER UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_members_delete
    AFTER DELETE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

--
-- ORGANIZATIONS TABLE TRIGGERS
-- Track organization changes
--
CREATE TRIGGER audit_organizations_insert
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_organizations_update
    AFTER UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_organizations_delete
    AFTER DELETE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

--
-- SECRET ACCESS LOGGING FUNCTION
-- Logs when secrets are READ (not just modified)
-- Call this from application code when secrets are decrypted
--
CREATE OR REPLACE FUNCTION log_secret_access(secret_id UUID)
RETURNS void AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Get organization_id for the secret
    SELECT p.organization_id INTO org_id
    FROM secrets s
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = secret_id;

    -- Log the access
    INSERT INTO audit_logs (
        organization_id,
        user_id,
        action,
        resource_type,
        resource_id,
        metadata,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        org_id,
        auth.uid(),
        'secrets.read',
        'secrets',
        secret_id,
        jsonb_build_object(
            'operation', 'READ',
            'accessed_at', NOW()
        ),
        current_setting('request.headers', true)::json->>'x-forwarded-for',
        current_setting('request.headers', true)::json->>'user-agent',
        NOW()
    );

    -- Update last_accessed_at on the secret
    UPDATE secrets
    SET last_accessed_at = NOW()
    WHERE id = secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--
-- GRANT EXECUTE PERMISSIONS
-- Allow authenticated users to call logging functions
--
GRANT EXECUTE ON FUNCTION log_secret_access(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION log_audit() IS 'Automatically logs INSERT, UPDATE, DELETE operations to audit_logs table. Never logs decrypted secret values.';
COMMENT ON FUNCTION log_secret_access(UUID) IS 'Logs when a secret is accessed/read. Must be called from application code after decryption.';
