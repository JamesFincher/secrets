-- Make GitHub token encryption fields nullable
-- This allows creating a connection record before client-side encryption
-- Flow: 1) Worker creates record, 2) Client encrypts token, 3) Client updates record

ALTER TABLE github_connections
    ALTER COLUMN encrypted_github_token DROP NOT NULL,
    ALTER COLUMN token_nonce DROP NOT NULL,
    ALTER COLUMN token_dek DROP NOT NULL,
    ALTER COLUMN dek_nonce DROP NOT NULL,
    ALTER COLUMN token_auth_tag DROP NOT NULL;

-- Add a check to ensure either all encryption fields are NULL or all are NOT NULL
-- This prevents partial encryption state
ALTER TABLE github_connections
    ADD CONSTRAINT github_connections_encryption_complete CHECK (
        (encrypted_github_token IS NULL
         AND token_nonce IS NULL
         AND token_dek IS NULL
         AND dek_nonce IS NULL
         AND token_auth_tag IS NULL)
        OR
        (encrypted_github_token IS NOT NULL
         AND token_nonce IS NOT NULL
         AND token_dek IS NOT NULL
         AND dek_nonce IS NOT NULL
         AND token_auth_tag IS NOT NULL)
    );

COMMENT ON CONSTRAINT github_connections_encryption_complete ON github_connections
    IS 'Ensures encryption fields are either all NULL (pre-encryption) or all present (post-encryption)';
