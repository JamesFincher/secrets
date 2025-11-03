/**
 * Envelope Encryption Library
 *
 * Implements two-layer encryption for zero-knowledge architecture:
 * 1. Secret is encrypted with a random Data Encryption Key (DEK)
 * 2. DEK is encrypted with Key Encryption Key (KEK) derived from master password
 *
 * This allows:
 * - Key rotation without re-encrypting all secrets
 * - Better security through defense in depth
 * - Compliance with enterprise encryption standards
 *
 * Based on 03-security/encryption-specification.md
 * Schema: 04-database/schemas/secrets-metadata.md
 */

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation
const SALT_LENGTH = 16; // 128 bits
const NONCE_LENGTH = 12; // 96 bits (GCM standard)
const DEK_LENGTH = 32; // 256 bits (AES-256)
const KEY_LENGTH = 256; // bits

/**
 * Structure for encrypted secret stored in database
 * Maps to database columns in secrets table
 */
export interface EnvelopeEncryptedSecret {
  encrypted_value: string; // Base64-encoded ciphertext of secret
  encrypted_dek: string; // Base64-encoded ciphertext of DEK
  secret_nonce: string; // Base64-encoded 12-byte nonce for secret encryption
  dek_nonce: string; // Base64-encoded 12-byte nonce for DEK encryption
  auth_tag: string; // Base64-encoded 16-byte GCM auth tag
  algorithm: 'AES-256-GCM';
}

/**
 * Structure for master key verification value
 */
export interface EncryptedVerification {
  ciphertext: string;
  iv: string;
  salt: string;
  algorithm: 'AES-256-GCM';
  iterations: number;
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
    false, // Not extractable
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
 * Encrypts plaintext secret using envelope encryption
 *
 * Process:
 * 1. Generate random DEK (Data Encryption Key)
 * 2. Encrypt secret value with DEK
 * 3. Derive KEK (Key Encryption Key) from master password + user's KEK salt
 * 4. Encrypt DEK with KEK
 * 5. Return all components for database storage
 *
 * @param plaintext - Secret value to encrypt
 * @param masterPassword - User's master password
 * @param kekSalt - Salt from user_preferences.master_password_verification (base64)
 * @returns Encrypted secret with all components
 */
export async function encryptSecret(
  plaintext: string,
  masterPassword: string,
  kekSalt: string
): Promise<EnvelopeEncryptedSecret> {
  // Step 1: Generate random DEK
  const dek = generateDEK();

  // Step 2: Encrypt secret with DEK
  const secretNonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext);

  // Import DEK as CryptoKey for AES-GCM
  const dekKey = await crypto.subtle.importKey(
    'raw',
    dek as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encryptedSecretBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: secretNonce as BufferSource,
      tagLength: 128,
    },
    dekKey,
    plaintextBuffer as BufferSource
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

  // Step 5: Extract auth tag from encrypted secret
  // In AES-GCM, the tag is appended to ciphertext
  const encryptedSecretArray = new Uint8Array(encryptedSecretBuffer);
  const ciphertextLength = encryptedSecretArray.length - 16; // Tag is last 16 bytes
  const ciphertext = encryptedSecretArray.slice(0, ciphertextLength);
  const authTag = encryptedSecretArray.slice(ciphertextLength);

  // Convert to base64 for storage
  return {
    encrypted_value: bufferToBase64(ciphertext),
    encrypted_dek: bufferToBase64(encryptedDEKBuffer),
    secret_nonce: bufferToBase64(secretNonce),
    dek_nonce: bufferToBase64(dekNonce),
    auth_tag: bufferToBase64(authTag),
    algorithm: 'AES-256-GCM',
  };
}

/**
 * Decrypts an envelope-encrypted secret
 *
 * Process:
 * 1. Derive KEK from master password + user's KEK salt
 * 2. Decrypt DEK using KEK
 * 3. Decrypt secret value using DEK
 * 4. Return plaintext
 *
 * @param encryptedSecret - Encrypted secret from database
 * @param masterPassword - User's master password
 * @param kekSalt - Salt from user_preferences.master_password_verification (base64)
 * @returns Decrypted plaintext secret
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export async function decryptSecret(
  encryptedSecret: EnvelopeEncryptedSecret,
  masterPassword: string,
  kekSalt: string
): Promise<string> {
  // Validate algorithm
  if (encryptedSecret.algorithm !== 'AES-256-GCM') {
    throw new Error(`Unsupported algorithm: ${encryptedSecret.algorithm}`);
  }

  try {
    // Convert from base64
    const encryptedValue = base64ToBuffer(encryptedSecret.encrypted_value);
    const encryptedDEK = base64ToBuffer(encryptedSecret.encrypted_dek);
    const secretNonce = base64ToBuffer(encryptedSecret.secret_nonce);
    const dekNonce = base64ToBuffer(encryptedSecret.dek_nonce);
    const authTag = base64ToBuffer(encryptedSecret.auth_tag);

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

    // Step 5: Decrypt secret using DEK
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: secretNonce as BufferSource,
        tagLength: 128,
      },
      dekKey,
      ciphertextWithTag as BufferSource
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch (error) {
    throw new Error('Decryption failed: Invalid password or corrupted data');
  }
}

/**
 * Generates an encrypted verification value to verify master password
 * This is simpler than envelope encryption (single-layer)
 *
 * @param masterPassword - User's master password
 * @returns Encrypted verification data
 */
export async function generateVerificationValue(
  masterPassword: string
): Promise<EncryptedVerification> {
  const verificationPlaintext = 'abyrith-verification-v1';

  // Use simpler encryption for verification (not envelope)
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

  const kek = await deriveKEK(masterPassword, salt);

  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(verificationPlaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
    },
    kek,
    plaintextBuffer as BufferSource
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    algorithm: 'AES-256-GCM',
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Verifies that a password is correct by attempting to decrypt verification value
 *
 * @param encryptedVerification - Encrypted verification data
 * @param password - Password to verify
 * @returns true if password is correct
 */
export async function verifyPassword(
  encryptedVerification: EncryptedVerification,
  password: string
): Promise<boolean> {
  try {
    const ciphertext = base64ToBuffer(encryptedVerification.ciphertext);
    const iv = base64ToBuffer(encryptedVerification.iv);
    const salt = base64ToBuffer(encryptedVerification.salt);

    const kek = await deriveKEK(password, salt);

    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        tagLength: 128,
      },
      kek,
      ciphertext as BufferSource
    );

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(plaintextBuffer);

    return plaintext === 'abyrith-verification-v1';
  } catch {
    return false;
  }
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

/**
 * Validates master password strength
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @param password - Password to validate
 * @returns Object with validation result and error messages
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Estimates the time required for PBKDF2 key derivation
 * Useful for showing loading indicators during encryption/decryption
 *
 * @returns Estimated time in milliseconds (typically 300-600ms)
 */
export async function estimateKeyDerivationTime(): Promise<number> {
  const testPassword = 'test-password-for-timing';
  const testSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const startTime = performance.now();
  await deriveKEK(testPassword, testSalt);
  const endTime = performance.now();

  return endTime - startTime;
}
