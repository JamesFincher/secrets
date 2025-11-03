-- Add KEK salt field to user_preferences for encryption key caching
-- This migration fixes the missing kek_salt field identified in the audit

-- Add kek_salt column to store the salt used for KEK derivation
-- This allows the KEK salt to be cached in memory for better performance
-- and consistent encryption/decryption across the user's session
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS kek_salt TEXT;

-- Add comment explaining the field's purpose
COMMENT ON COLUMN user_preferences.kek_salt IS 'Base64-encoded salt for KEK (Key Encryption Key) derivation from master password. Used in envelope encryption for encrypting/decrypting DEKs (Data Encryption Keys). Same salt as master_password_verification.salt for consistency.';

-- Note: No default value as this will be populated from master_password_verification.salt
-- when the user sets up their master password or verifies it for the first time
