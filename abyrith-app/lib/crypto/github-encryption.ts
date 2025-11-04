/**
 * GitHub Token Encryption Library
 *
 * Implements envelope encryption for GitHub OAuth tokens using the same
 * security model as secrets encryption. This ensures zero-knowledge
 * architecture where server cannot decrypt GitHub tokens.
 *
 * Based on:
 * - 03-security/integrations-security.md
 * - 04-database/schemas/github-connections.md
 * - lib/crypto/envelope-encryption.ts (same pattern)
 */

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation
const NONCE_LENGTH = 12; // 96 bits (GCM standard)
const DEK_LENGTH = 32; // 256 bits (AES-256)
const KEY_LENGTH = 256; // bits

/**
 * Structure for encrypted GitHub token stored in database
 * Maps to database columns in github_connections table
 */
export interface EncryptedGitHubToken {
  encrypted_github_token: string; // Base64-encoded ciphertext of token
  token_nonce: string; // Base64-encoded 12-byte nonce for token encryption
  token_dek: string; // Base64-encoded encrypted Data Encryption Key
  dek_nonce: string; // Base64-encoded 12-byte nonce for DEK encryption
  token_auth_tag: string; // Base64-encoded 16-byte GCM auth tag
}

/**
 * Derives a Key Encryption Key (KEK) from master password using PBKDF2
 *
 * @param password - User's master password
 * @param salt - Salt for key derivation (16 bytes)
 * @returns CryptoKey suitable for AES-GCM encryption
 */
async function deriveKEK(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive KEK using PBKDF2
  const kek = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    false, // Not extractable (security best practice)
    ['encrypt', 'decrypt']
  );

  return kek;
}

/**
 * Generates a random Data Encryption Key (DEK)
 *
 * @returns Random 256-bit key as Uint8Array
 */
function generateDEK(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(DEK_LENGTH));
}

/**
 * Encrypts GitHub OAuth token using envelope encryption
 *
 * Process:
 * 1. Generate random DEK (Data Encryption Key)
 * 2. Encrypt GitHub token with DEK
 * 3. Derive KEK (Key Encryption Key) from master password + user's KEK salt
 * 4. Encrypt DEK with KEK
 * 5. Return all components for database storage
 *
 * Security: Server never sees plaintext token. Client-side encryption only.
 *
 * @param githubToken - GitHub OAuth access token (plaintext)
 * @param masterPassword - User's master password
 * @param kekSalt - Salt from user_preferences.master_password_verification (base64)
 * @returns Encrypted token with all components for database storage
 */
export async function encryptGitHubToken(
  githubToken: string,
  masterPassword: string,
  kekSalt: string
): Promise<EncryptedGitHubToken> {
  // Step 1: Generate random DEK
  const dek = generateDEK();

  // Step 2: Encrypt GitHub token with DEK
  const tokenNonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const encoder = new TextEncoder();
  const tokenBuffer = encoder.encode(githubToken);

  // Import DEK as CryptoKey for AES-GCM
  const dekKey = await crypto.subtle.importKey(
    'raw',
    dek as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encryptedTokenBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: tokenNonce as BufferSource,
      tagLength: 128,
    },
    dekKey,
    tokenBuffer as BufferSource
  );

  // Step 3: Derive KEK from master password using user's KEK salt
  const kekSaltBuffer = base64ToBuffer(kekSalt);
  const kek = await deriveKEK(masterPassword, kekSaltBuffer);

  // Step 4: Encrypt DEK with KEK
  const dekNonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const encryptedDEKBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: dekNonce as BufferSource,
      tagLength: 128,
    },
    kek,
    dek as BufferSource
  );

  // Step 5: Extract auth tag from encrypted token
  // In AES-GCM, the tag is appended to ciphertext (last 16 bytes)
  const encryptedTokenArray = new Uint8Array(encryptedTokenBuffer);
  const ciphertextLength = encryptedTokenArray.length - 16;
  const ciphertext = encryptedTokenArray.slice(0, ciphertextLength);
  const authTag = encryptedTokenArray.slice(ciphertextLength);

  // Convert to base64 for storage
  return {
    encrypted_github_token: bufferToBase64(ciphertext),
    token_dek: bufferToBase64(encryptedDEKBuffer),
    token_nonce: bufferToBase64(tokenNonce),
    dek_nonce: bufferToBase64(dekNonce),
    token_auth_tag: bufferToBase64(authTag),
  };
}

/**
 * Decrypts an envelope-encrypted GitHub token
 *
 * Process:
 * 1. Derive KEK from master password + user's KEK salt
 * 2. Decrypt DEK using KEK
 * 3. Decrypt GitHub token using DEK
 * 4. Return plaintext token
 *
 * Security: Decryption happens client-side only. Server never sees plaintext.
 *
 * @param encryptedToken - Encrypted token from database (github_connections table)
 * @param masterPassword - User's master password
 * @param kekSalt - Salt from user_preferences.master_password_verification (base64)
 * @returns Decrypted plaintext GitHub OAuth token
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export async function decryptGitHubToken(
  encryptedToken: EncryptedGitHubToken,
  masterPassword: string,
  kekSalt: string
): Promise<string> {
  try {
    // Convert from base64
    const encryptedValue = base64ToBuffer(
      encryptedToken.encrypted_github_token
    );
    const encryptedDEK = base64ToBuffer(encryptedToken.token_dek);
    const tokenNonce = base64ToBuffer(encryptedToken.token_nonce);
    const dekNonce = base64ToBuffer(encryptedToken.dek_nonce);
    const authTag = base64ToBuffer(encryptedToken.token_auth_tag);

    // Step 1: Derive KEK from master password using user's KEK salt
    const kekSaltBuffer = base64ToBuffer(kekSalt);
    const kek = await deriveKEK(masterPassword, kekSaltBuffer);

    // Step 2: Decrypt DEK using KEK
    const dekBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: dekNonce as BufferSource,
        tagLength: 128,
      },
      kek,
      encryptedDEK as BufferSource
    );

    // Step 3: Import DEK as CryptoKey
    const dekKey = await crypto.subtle.importKey(
      'raw',
      dekBuffer as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Step 4: Reconstruct ciphertext with auth tag
    const ciphertextWithTag = new Uint8Array(
      encryptedValue.length + authTag.length
    );
    ciphertextWithTag.set(encryptedValue, 0);
    ciphertextWithTag.set(authTag, encryptedValue.length);

    // Step 5: Decrypt token using DEK
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: tokenNonce as BufferSource,
        tagLength: 128,
      },
      dekKey,
      ciphertextWithTag as BufferSource
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch (error) {
    throw new Error(
      'GitHub token decryption failed: Invalid password or corrupted data'
    );
  }
}

/**
 * Securely clears a decrypted token from memory
 *
 * This is a best-effort approach since JavaScript doesn't provide
 * guaranteed memory clearing, but it helps reduce the window of exposure.
 *
 * @param token - Token string to clear
 */
export function clearTokenFromMemory(token: string): void {
  // Overwrite string characters (best effort in JS)
  // @ts-ignore - Modifying string (normally immutable)
  for (let i = 0; i < token.length; i++) {
    // @ts-ignore
    token[i] = '\0';
  }

  // Trigger garbage collection hint (if available)
  if (global.gc) {
    global.gc();
  }
}

/**
 * Validates GitHub OAuth token format
 *
 * GitHub personal access tokens start with:
 * - "ghp_" for personal access tokens
 * - "gho_" for OAuth access tokens
 * - "ghs_" for server tokens
 * - "ghu_" for user-to-server tokens
 *
 * @param token - Token to validate
 * @returns true if token format is valid
 */
export function validateGitHubTokenFormat(token: string): boolean {
  // GitHub tokens are typically 40+ characters
  if (token.length < 40) {
    return false;
  }

  // Check for known prefixes
  const validPrefixes = ['ghp_', 'gho_', 'ghs_', 'ghu_', 'github_pat_'];
  const hasValidPrefix = validPrefixes.some((prefix) =>
    token.startsWith(prefix)
  );

  return hasValidPrefix;
}

// Utility functions for base64 encoding/decoding
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
