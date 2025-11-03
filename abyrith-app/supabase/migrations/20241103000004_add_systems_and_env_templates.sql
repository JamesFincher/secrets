-- Add Systems table (subsystems/components within a project)
-- Examples: "Frontend", "Backend API", "Mobile App", "Database"

CREATE TABLE systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Emoji or icon identifier
    color TEXT, -- Hex color for UI distinction
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE INDEX idx_systems_project_id ON systems(project_id);

-- Add .env templates table (stores sample .env files)
CREATE TABLE env_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    system_id UUID REFERENCES systems(id) ON DELETE CASCADE, -- Optional: template can be project-level or system-level
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE, -- Optional: environment-specific template
    name TEXT NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL, -- The actual .env template with placeholders
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_env_templates_project_id ON env_templates(project_id);
CREATE INDEX idx_env_templates_system_id ON env_templates(system_id);
CREATE INDEX idx_env_templates_environment_id ON env_templates(environment_id);

-- Add system_id column to secrets table (optional: for organizing secrets by system)
ALTER TABLE secrets ADD COLUMN system_id UUID REFERENCES systems(id) ON DELETE SET NULL;
CREATE INDEX idx_secrets_system_id ON secrets(system_id);

-- Update trigger for systems
CREATE TRIGGER update_systems_updated_at BEFORE UPDATE ON systems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_env_templates_updated_at BEFORE UPDATE ON env_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for Systems
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view systems"
    ON systems FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = systems.project_id
            AND is_organization_member(projects.organization_id)
        )
    );

CREATE POLICY "Developers can create systems"
    ON systems FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = systems.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

CREATE POLICY "Developers can update systems"
    ON systems FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = systems.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

CREATE POLICY "Admins can delete systems"
    ON systems FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = systems.project_id
            AND has_role(projects.organization_id, 'admin')
        )
    );

-- RLS Policies for env_templates
ALTER TABLE env_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view env templates"
    ON env_templates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = env_templates.project_id
            AND is_organization_member(projects.organization_id)
        )
    );

CREATE POLICY "Developers can create env templates"
    ON env_templates FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = env_templates.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

CREATE POLICY "Developers can update env templates"
    ON env_templates FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = env_templates.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

CREATE POLICY "Developers can delete env templates"
    ON env_templates FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = env_templates.project_id
            AND has_role(projects.organization_id, 'developer')
        )
    );

-- Function to generate .env file from secrets
CREATE OR REPLACE FUNCTION generate_env_file(
    p_project_id UUID,
    p_environment_id UUID,
    p_system_id UUID DEFAULT NULL
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    env_content TEXT := '';
    secret_record RECORD;
BEGIN
    -- Verify user has access
    IF NOT EXISTS (
        SELECT 1 FROM projects
        WHERE id = p_project_id
        AND is_organization_member(organization_id)
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Add header comment
    env_content := '# Generated by Abyrith - ' || NOW() || E'\n';
    env_content := env_content || '# Project: ' || (SELECT name FROM projects WHERE id = p_project_id) || E'\n';
    env_content := env_content || '# Environment: ' || (SELECT name FROM environments WHERE id = p_environment_id) || E'\n';
    IF p_system_id IS NOT NULL THEN
        env_content := env_content || '# System: ' || (SELECT name FROM systems WHERE id = p_system_id) || E'\n';
    END IF;
    env_content := env_content || E'\n';

    -- Add secrets (keys only - values must be decrypted client-side)
    FOR secret_record IN
        SELECT key, description, service_name
        FROM secrets
        WHERE project_id = p_project_id
        AND environment_id = p_environment_id
        AND (p_system_id IS NULL OR system_id = p_system_id)
        ORDER BY key
    LOOP
        IF secret_record.description IS NOT NULL THEN
            env_content := env_content || '# ' || secret_record.description || E'\n';
        END IF;
        IF secret_record.service_name IS NOT NULL THEN
            env_content := env_content || '# Service: ' || secret_record.service_name || E'\n';
        END IF;
        env_content := env_content || secret_record.key || '=<ENCRYPTED>' || E'\n\n';
    END LOOP;

    RETURN env_content;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_env_file(UUID, UUID, UUID) TO authenticated;
