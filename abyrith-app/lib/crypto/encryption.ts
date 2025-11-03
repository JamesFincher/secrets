/**
 * Zero-Knowledge Encryption Library
 *
 * Implementation of AES-256-GCM client-side encryption with PBKDF2 key derivation.
 * Based on 03-security/encryption-specification.md
 *
 * Security Parameters:
 * - Algorithm: AES-256-GCM
 * - Key Derivation: PBKDF2 with SHA-256
 * - Iterations: 600,000 (OWASP 2023 recommendation)
 * - Salt: 16 bytes (128 bits) random
 * - IV/Nonce: 12 bytes (96 bits) random per encryption
 * - Tag Length: 128 bits for authentication
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const KEY_LENGTH = 256; // bits

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  salt: string; // Base64 encoded
  algorithm: 'AES-256-GCM';
  iterations: number;
}

/**
 * Derives an encryption key from a master password using PBKDF2
 *
 * @param password - User's master password
 * @param salt - Salt for key derivation (16 bytes)
 * @returns CryptoKey suitable for AES-GCM encryption
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
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

  return derivedKey;
}

/**
 * Encrypts plaintext data using the master password
 *
 * @param plaintext - Data to encrypt
 * @param masterPassword - User's master password
 * @returns Encrypted data with metadata
 */
export async function encrypt(
  plaintext: string,
  masterPassword: string
): Promise<EncryptedData> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive encryption key from password
  const key = await deriveKey(masterPassword, salt);

  // Encode plaintext
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext);

  // Encrypt
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128, // Authentication tag length in bits
    },
    key,
    plaintextBuffer as BufferSource
  );

  // Convert to base64 for storage
  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    algorithm: 'AES-256-GCM',
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Decrypts ciphertext using the master password
 *
 * @param encryptedData - Encrypted data with metadata
 * @param masterPassword - User's master password
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong password or tampered data)
 */
export async function decrypt(
  encryptedData: EncryptedData,
  masterPassword: string
): Promise<string> {
  // Validate algorithm
  if (encryptedData.algorithm !== 'AES-256-GCM') {
    throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
  }

  // Convert from base64
  const ciphertext = base64ToBuffer(encryptedData.ciphertext);
  const iv = base64ToBuffer(encryptedData.iv);
  const salt = base64ToBuffer(encryptedData.salt);

  // Derive the same key using the password and stored salt
  const key = await deriveKey(masterPassword, salt);

  // Decrypt
  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        tagLength: 128,
      },
      key,
      ciphertext as BufferSource
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch (error) {
    // Decryption failure usually means wrong password or tampered data
    throw new Error('Decryption failed: Invalid password or corrupted data');
  }
}

/**
 * Verifies that a password is correct by attempting to decrypt a test value
 *
 * @param encryptedTestValue - Encrypted test data
 * @param password - Password to verify
 * @returns true if password is correct
 */
export async function verifyPassword(
  encryptedTestValue: EncryptedData,
  password: string
): Promise<boolean> {
  try {
    await decrypt(encryptedTestValue, password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a random encryption verification value
 * Used to verify master password without storing the password itself
 *
 * @param masterPassword - User's master password
 * @returns Encrypted verification data
 */
export async function generateVerificationValue(
  masterPassword: string
): Promise<EncryptedData> {
  const verificationPlaintext = 'abyrith-verification';
  return await encrypt(verificationPlaintext, masterPassword);
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
 * @returns Object with validation result and error message
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
  await deriveKey(testPassword, testSalt);
  const endTime = performance.now();

  return endTime - startTime;
}
