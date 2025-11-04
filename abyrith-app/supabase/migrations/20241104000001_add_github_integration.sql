-- GitHub Integration Schema
-- Based on 04-database/schemas/github-connections.md
-- Implements GitHub repository syncing with zero-knowledge encryption

--
-- GITHUB_CONNECTIONS TABLE
-- Stores encrypted GitHub OAuth tokens with envelope encryption
--
CREATE TABLE github_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Encrypted GitHub token (client-side encrypted with user's master key)
    -- Uses same envelope encryption pattern as secrets table
    encrypted_github_token TEXT NOT NULL,        -- Base64-encoded encrypted token
    token_nonce TEXT NOT NULL,                   -- Base64-encoded 12-byte nonce
    token_dek TEXT NOT NULL,                     -- Base64-encoded encrypted DEK
    dek_nonce TEXT NOT NULL,                     -- Base64-encoded 12-byte nonce for DEK
    token_auth_tag TEXT NOT NULL,                -- Base64-encoded 16-byte auth tag

    -- GitHub user info (plaintext, not sensitive)
    github_user_id BIGINT,
    github_username TEXT,
    github_email TEXT,

    -- Token metadata
    token_scope TEXT[],                          -- e.g., ['repo', 'read:org']
    token_expires_at TIMESTAMPTZ,

    -- Timestamps
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, user_id)
);

-- Indexes for github_connections
CREATE INDEX idx_github_connections_org ON github_connections(organization_id);
CREATE INDEX idx_github_connections_user ON github_connections(user_id);
CREATE INDEX idx_github_connections_expires ON github_connections(token_expires_at)
    WHERE token_expires_at IS NOT NULL;

--
-- GITHUB_LINKED_REPOS TABLE
-- Links GitHub repositories to Abyrith Projects
--
CREATE TABLE github_linked_repos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    github_connection_id UUID NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,

    -- GitHub repo identification
    github_repo_id BIGINT NOT NULL,              -- GitHub's numeric repo ID
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    repo_url TEXT NOT NULL,

    -- Abyrith identifier stored in repo (.abyrith file)
    abyrith_project_uuid UUID NOT NULL UNIQUE,   -- UUID written to .abyrith marker file

    -- Sync configuration
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sync_sources JSONB DEFAULT '{"env_files": true, "github_actions": true, "dependencies": true}'::jsonb,

    -- Metadata
    default_environment_id UUID REFERENCES environments(id),  -- Where to import secrets

    -- Timestamps
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(github_repo_id, organization_id),
    UNIQUE(project_id, github_repo_id)
);

-- Indexes for github_linked_repos
CREATE INDEX idx_github_linked_repos_org ON github_linked_repos(organization_id);
CREATE INDEX idx_github_linked_repos_project ON github_linked_repos(project_id);
CREATE INDEX idx_github_linked_repos_connection ON github_linked_repos(github_connection_id);
CREATE INDEX idx_github_linked_repos_repo_id ON github_linked_repos(github_repo_id);
CREATE INDEX idx_github_linked_repos_uuid ON github_linked_repos(abyrith_project_uuid);

--
-- GITHUB_SYNC_LOGS TABLE
-- Audit trail for all GitHub sync operations
--
CREATE TABLE github_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    github_linked_repo_id UUID NOT NULL REFERENCES github_linked_repos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Sync details
    sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
    sync_status TEXT NOT NULL CHECK (sync_status IN ('success', 'partial', 'failed')),

    -- Results
    secrets_imported INTEGER NOT NULL DEFAULT 0,
    secrets_skipped INTEGER NOT NULL DEFAULT 0,
    secrets_failed INTEGER NOT NULL DEFAULT 0,

    -- Data
    imported_files TEXT[],                       -- e.g., ['.env.production', 'package.json']
    error_message TEXT,
    sync_metadata JSONB DEFAULT '{}'::jsonb,     -- Additional context

    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for github_sync_logs
CREATE INDEX idx_github_sync_logs_org ON github_sync_logs(organization_id);
CREATE INDEX idx_github_sync_logs_repo ON github_sync_logs(github_linked_repo_id);
CREATE INDEX idx_github_sync_logs_user ON github_sync_logs(user_id);
CREATE INDEX idx_github_sync_logs_created ON github_sync_logs(created_at DESC);
CREATE INDEX idx_github_sync_logs_status ON github_sync_logs(sync_status);

--
-- GITHUB_IMPORTED_SECRETS TABLE
-- Tracks which secrets originated from GitHub sync
--
CREATE TABLE github_imported_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
    github_linked_repo_id UUID NOT NULL REFERENCES github_linked_repos(id) ON DELETE CASCADE,

    -- Import metadata
    source_file TEXT,                            -- e.g., '.env.production'
    source_type TEXT NOT NULL CHECK (source_type IN ('env_file', 'github_actions', 'config_file', 'dependency')),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,

    -- Sync tracking
    github_key_name TEXT,                        -- Original key name in GitHub
    sync_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- If true, re-sync updates this secret

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(secret_id)                            -- Each secret can only be imported from one source
);

-- Indexes for github_imported_secrets
CREATE INDEX idx_github_imported_secrets_org ON github_imported_secrets(organization_id);
CREATE INDEX idx_github_imported_secrets_secret ON github_imported_secrets(secret_id);
CREATE INDEX idx_github_imported_secrets_repo ON github_imported_secrets(github_linked_repo_id);
CREATE INDEX idx_github_imported_secrets_source_type ON github_imported_secrets(source_type);

--
-- UPDATED_AT TRIGGERS
-- Automatically update updated_at timestamps
--
CREATE TRIGGER update_github_connections_updated_at
    BEFORE UPDATE ON github_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_linked_repos_updated_at
    BEFORE UPDATE ON github_linked_repos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_imported_secrets_updated_at
    BEFORE UPDATE ON github_imported_secrets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

--
-- ROW-LEVEL SECURITY POLICIES
-- Enforce organization-level isolation
--
ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_linked_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_imported_secrets ENABLE ROW LEVEL SECURITY;

-- github_connections: Users can only access connections in their organization
CREATE POLICY github_connections_org_isolation ON github_connections
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- github_linked_repos: Users can only access repos in their organization
CREATE POLICY github_linked_repos_org_isolation ON github_linked_repos
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- github_sync_logs: Users can only access logs in their organization
CREATE POLICY github_sync_logs_org_isolation ON github_sync_logs
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- github_imported_secrets: Users can only access imported secrets in their organization
CREATE POLICY github_imported_secrets_org_isolation ON github_imported_secrets
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

--
-- AUDIT LOG TRIGGERS
-- Automatically log GitHub operations for compliance
--
CREATE OR REPLACE FUNCTION log_github_connection_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            metadata
        ) VALUES (
            NEW.organization_id,
            NEW.user_id,
            'github.connected',
            'github_connection',
            NEW.id,
            jsonb_build_object(
                'github_username', NEW.github_username,
                'github_user_id', NEW.github_user_id,
                'token_scope', NEW.token_scope
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            metadata
        ) VALUES (
            OLD.organization_id,
            OLD.user_id,
            'github.disconnected',
            'github_connection',
            OLD.id,
            jsonb_build_object(
                'github_username', OLD.github_username
            )
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_github_connection_changes
    AFTER INSERT OR DELETE ON github_connections
    FOR EACH ROW EXECUTE FUNCTION log_github_connection_changes();

CREATE OR REPLACE FUNCTION log_github_repo_link_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            metadata
        ) VALUES (
            NEW.organization_id,
            auth.uid(),
            'github.repo_linked',
            'github_linked_repo',
            NEW.id,
            jsonb_build_object(
                'repo_owner', NEW.repo_owner,
                'repo_name', NEW.repo_name,
                'repo_url', NEW.repo_url,
                'project_id', NEW.project_id
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            metadata
        ) VALUES (
            OLD.organization_id,
            auth.uid(),
            'github.repo_unlinked',
            'github_linked_repo',
            OLD.id,
            jsonb_build_object(
                'repo_owner', OLD.repo_owner,
                'repo_name', OLD.repo_name
            )
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_github_repo_link_changes
    AFTER INSERT OR DELETE ON github_linked_repos
    FOR EACH ROW EXECUTE FUNCTION log_github_repo_link_changes();

-- Comment on tables for documentation
COMMENT ON TABLE github_connections IS 'Stores encrypted GitHub OAuth tokens for repository integration';
COMMENT ON TABLE github_linked_repos IS 'Links GitHub repositories to Abyrith projects for secret syncing';
COMMENT ON TABLE github_sync_logs IS 'Audit trail for all GitHub sync operations';
COMMENT ON TABLE github_imported_secrets IS 'Tracks provenance of secrets imported from GitHub repositories';

-- Comment on encryption columns
COMMENT ON COLUMN github_connections.encrypted_github_token IS 'Client-side encrypted GitHub OAuth token using envelope encryption';
COMMENT ON COLUMN github_connections.token_dek IS 'Data Encryption Key encrypted with user master key';
COMMENT ON COLUMN github_linked_repos.abyrith_project_uuid IS 'Anonymous UUID written to .abyrith marker file in repository';
