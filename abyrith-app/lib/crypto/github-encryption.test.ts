/**
 * Unit Tests for GitHub Token Encryption
 *
 * Tests the envelope encryption implementation for GitHub OAuth tokens.
 * Ensures zero-knowledge architecture is maintained with client-side encryption.
 *
 * Test Coverage:
 * - Token encryption produces valid structure
 * - Token decryption reverses encryption
 * - Round-trip encrypt/decrypt preserves original value
 * - Invalid password throws error
 * - Token format validation
 * - Memory clearing (best effort)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  encryptGitHubToken,
  decryptGitHubToken,
  validateGitHubTokenFormat,
  clearTokenFromMemory,
  type EncryptedGitHubToken,
} from './github-encryption';

// Mock crypto API for Node.js environment
// In browser tests, this would use the native Web Crypto API
const mockCrypto = () => {
  if (typeof crypto === 'undefined') {
    // @ts-ignore
    global.crypto = require('crypto').webcrypto;
  }
};

describe('GitHub Token Encryption', () => {
  beforeEach(() => {
    mockCrypto();
  });

  const testToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz1234';
  const masterPassword = 'SecureMasterPassword123!';
  const kekSalt = 'dGVzdHNhbHQxMjM0NTY3ODkwYWJjZGVmZ2hpams='; // base64 encoded 32 bytes

  describe('encryptGitHubToken', () => {
    it('should encrypt token and return valid structure', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Verify all required fields are present
      expect(encrypted).toHaveProperty('encrypted_github_token');
      expect(encrypted).toHaveProperty('token_nonce');
      expect(encrypted).toHaveProperty('token_dek');
      expect(encrypted).toHaveProperty('dek_nonce');
      expect(encrypted).toHaveProperty('token_auth_tag');

      // Verify all fields are base64 encoded strings
      expect(typeof encrypted.encrypted_github_token).toBe('string');
      expect(typeof encrypted.token_nonce).toBe('string');
      expect(typeof encrypted.token_dek).toBe('string');
      expect(typeof encrypted.dek_nonce).toBe('string');
      expect(typeof encrypted.token_auth_tag).toBe('string');

      // Verify none are empty
      expect(encrypted.encrypted_github_token.length).toBeGreaterThan(0);
      expect(encrypted.token_nonce.length).toBeGreaterThan(0);
      expect(encrypted.token_dek.length).toBeGreaterThan(0);
      expect(encrypted.dek_nonce.length).toBeGreaterThan(0);
      expect(encrypted.token_auth_tag.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext for same token (unique nonces)', async () => {
      const encrypted1 = await encryptGitHubToken(testToken, masterPassword, kekSalt);
      const encrypted2 = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Different nonces = different ciphertext (even for same plaintext)
      expect(encrypted1.token_nonce).not.toBe(encrypted2.token_nonce);
      expect(encrypted1.encrypted_github_token).not.toBe(encrypted2.encrypted_github_token);
    });

    it('should not include plaintext token in encrypted output', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Verify plaintext is not in any field
      expect(encrypted.encrypted_github_token).not.toContain(testToken);
      expect(encrypted.token_dek).not.toContain(testToken);

      // Verify plaintext is not in base64-decoded values either
      const decodedCiphertext = Buffer.from(encrypted.encrypted_github_token, 'base64').toString();
      expect(decodedCiphertext).not.toContain(testToken);
    });

    it('should create nonces of correct length (12 bytes = 16 chars base64)', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // 12 bytes = 16 characters in base64 (with padding)
      expect(encrypted.token_nonce.length).toBe(16);
      expect(encrypted.dek_nonce.length).toBe(16);
    });

    it('should create auth tag of correct length (16 bytes = ~22 chars base64)', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // 16 bytes = 22-24 characters in base64 (with padding)
      expect(encrypted.token_auth_tag.length).toBeGreaterThanOrEqual(22);
      expect(encrypted.token_auth_tag.length).toBeLessThanOrEqual(24);
    });

    it('should handle tokens of various lengths', async () => {
      const shortToken = 'ghp_short1234567890abcdefghijklmnopqrstuv';
      const longToken = 'github_pat_' + 'a'.repeat(200);

      const encryptedShort = await encryptGitHubToken(shortToken, masterPassword, kekSalt);
      const encryptedLong = await encryptGitHubToken(longToken, masterPassword, kekSalt);

      expect(encryptedShort.encrypted_github_token).toBeDefined();
      expect(encryptedLong.encrypted_github_token).toBeDefined();

      // Longer token = longer ciphertext
      expect(encryptedLong.encrypted_github_token.length).toBeGreaterThan(
        encryptedShort.encrypted_github_token.length
      );
    });
  });

  describe('decryptGitHubToken', () => {
    it('should decrypt token back to original plaintext', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);
      const decrypted = await decryptGitHubToken(encrypted, masterPassword, kekSalt);

      expect(decrypted).toBe(testToken);
    });

    it('should throw error with wrong password', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);
      const wrongPassword = 'WrongPassword123!';

      await expect(
        decryptGitHubToken(encrypted, wrongPassword, kekSalt)
      ).rejects.toThrow(/decryption failed/i);
    });

    it('should throw error with wrong KEK salt', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);
      const wrongSalt = 'ZGlmZmVyZW50c2FsdDEyMzQ1Njc4OTBhYmNkZWY=';

      await expect(
        decryptGitHubToken(encrypted, masterPassword, wrongSalt)
      ).rejects.toThrow(/decryption failed/i);
    });

    it('should throw error with corrupted ciphertext', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Corrupt the ciphertext
      const corrupted: EncryptedGitHubToken = {
        ...encrypted,
        encrypted_github_token: 'YWJjZGVmZ2hpams=', // random garbage
      };

      await expect(
        decryptGitHubToken(corrupted, masterPassword, kekSalt)
      ).rejects.toThrow(/decryption failed/i);
    });

    it('should throw error with corrupted auth tag', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Corrupt the auth tag
      const corrupted: EncryptedGitHubToken = {
        ...encrypted,
        token_auth_tag: 'YWJjZGVmZ2hpams=',
      };

      await expect(
        decryptGitHubToken(corrupted, masterPassword, kekSalt)
      ).rejects.toThrow(/decryption failed/i);
    });

    it('should throw error with corrupted DEK', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Corrupt the encrypted DEK
      const corrupted: EncryptedGitHubToken = {
        ...encrypted,
        token_dek: 'YWJjZGVmZ2hpams=',
      };

      await expect(
        decryptGitHubToken(corrupted, masterPassword, kekSalt)
      ).rejects.toThrow(/decryption failed/i);
    });

    it('should handle tokens with special characters', async () => {
      const specialToken = 'ghp_test+/=ABC123xyz!@#$%^&*()';
      const encrypted = await encryptGitHubToken(specialToken, masterPassword, kekSalt);
      const decrypted = await decryptGitHubToken(encrypted, masterPassword, kekSalt);

      expect(decrypted).toBe(specialToken);
    });
  });

  describe('Round-trip encryption/decryption', () => {
    it('should preserve token through encrypt -> decrypt cycle', async () => {
      const originalToken = testToken;

      const encrypted = await encryptGitHubToken(originalToken, masterPassword, kekSalt);
      const decrypted = await decryptGitHubToken(encrypted, masterPassword, kekSalt);

      expect(decrypted).toBe(originalToken);
    });

    it('should work with multiple different tokens', async () => {
      const tokens = [
        'ghp_1234567890abcdefghijklmnopqrstuvwxyz1234',
        'gho_abcdefghijklmnopqrstuvwxyz1234567890abcd',
        'github_pat_' + 'x'.repeat(82),
      ];

      for (const token of tokens) {
        const encrypted = await encryptGitHubToken(token, masterPassword, kekSalt);
        const decrypted = await decryptGitHubToken(encrypted, masterPassword, kekSalt);
        expect(decrypted).toBe(token);
      }
    });

    it('should work with different master passwords', async () => {
      const passwords = ['Password1!', 'VerySecure123!@#', 'L0ng3rP@ssw0rd!'];

      for (const password of passwords) {
        const encrypted = await encryptGitHubToken(testToken, password, kekSalt);
        const decrypted = await decryptGitHubToken(encrypted, password, kekSalt);
        expect(decrypted).toBe(testToken);
      }
    });
  });

  describe('validateGitHubTokenFormat', () => {
    it('should validate correct GitHub token formats', () => {
      const validTokens = [
        'ghp_1234567890abcdefghijklmnopqrstuvwxyz1234',
        'gho_abcdefghijklmnopqrstuvwxyz1234567890abcd',
        'ghs_servertoken1234567890abcdefghijklmnopqr',
        'ghu_usertoken1234567890abcdefghijklmnopqrst',
        'github_pat_' + 'a'.repeat(82),
      ];

      validTokens.forEach((token) => {
        expect(validateGitHubTokenFormat(token)).toBe(true);
      });
    });

    it('should reject invalid token formats', () => {
      const invalidTokens = [
        'invalid_token',
        'ghp_short', // too short
        'random123456789',
        '',
        'Bearer ghp_1234567890abcdefghijklmnopqrstuvwxyz1234', // with prefix
      ];

      invalidTokens.forEach((token) => {
        expect(validateGitHubTokenFormat(token)).toBe(false);
      });
    });

    it('should require minimum length', () => {
      const tooShort = 'ghp_short';
      expect(validateGitHubTokenFormat(tooShort)).toBe(false);

      const justRight = 'ghp_' + 'a'.repeat(36); // 40 chars total
      expect(validateGitHubTokenFormat(justRight)).toBe(true);
    });

    it('should require valid prefix', () => {
      const noPrefixButLong = 'a'.repeat(50);
      expect(validateGitHubTokenFormat(noPrefixButLong)).toBe(false);

      const wrongPrefix = 'xxx_' + 'a'.repeat(40);
      expect(validateGitHubTokenFormat(wrongPrefix)).toBe(false);
    });
  });

  describe('clearTokenFromMemory', () => {
    it('should attempt to clear token string from memory', () => {
      let token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz1234';

      // This is best-effort in JavaScript
      // We can't truly verify memory was cleared, but we can call it without errors
      expect(() => clearTokenFromMemory(token)).not.toThrow();
    });

    it('should handle empty strings', () => {
      let token = '';
      expect(() => clearTokenFromMemory(token)).not.toThrow();
    });
  });

  describe('Security properties', () => {
    it('should use unique nonces for each encryption', async () => {
      const encrypted1 = await encryptGitHubToken(testToken, masterPassword, kekSalt);
      const encrypted2 = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Token nonces must be unique
      expect(encrypted1.token_nonce).not.toBe(encrypted2.token_nonce);

      // DEK nonces must be unique
      expect(encrypted1.dek_nonce).not.toBe(encrypted2.dek_nonce);
    });

    it('should produce different ciphertext with same plaintext', async () => {
      const encrypted1 = await encryptGitHubToken(testToken, masterPassword, kekSalt);
      const encrypted2 = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Ciphertext must be different (semantic security)
      expect(encrypted1.encrypted_github_token).not.toBe(encrypted2.encrypted_github_token);
    });

    it('should not allow decryption without correct password', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      const wrongPasswords = ['wrong', 'WrongPassword', 'SecureMasterPassword123', ''];

      for (const wrongPassword of wrongPasswords) {
        await expect(
          decryptGitHubToken(encrypted, wrongPassword, kekSalt)
        ).rejects.toThrow();
      }
    });

    it('should detect tampering via auth tag', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      // Tamper with ciphertext (flip one bit)
      const tamperedCiphertext = encrypted.encrypted_github_token.slice(0, -1) + 'X';
      const tampered: EncryptedGitHubToken = {
        ...encrypted,
        encrypted_github_token: tamperedCiphertext,
      };

      await expect(
        decryptGitHubToken(tampered, masterPassword, kekSalt)
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should encrypt within reasonable time (< 500ms)', async () => {
      const startTime = Date.now();
      await encryptGitHubToken(testToken, masterPassword, kekSalt);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should decrypt within reasonable time (< 500ms)', async () => {
      const encrypted = await encryptGitHubToken(testToken, masterPassword, kekSalt);

      const startTime = Date.now();
      await decryptGitHubToken(encrypted, masterPassword, kekSalt);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle batch encryption efficiently', async () => {
      const tokens = Array(10).fill(testToken);

      const startTime = Date.now();
      await Promise.all(
        tokens.map((token) => encryptGitHubToken(token, masterPassword, kekSalt))
      );
      const duration = Date.now() - startTime;

      // 10 encryptions should take < 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'github_pat_' + 'a'.repeat(500);
      const encrypted = await encryptGitHubToken(longToken, masterPassword, kekSalt);
      const decrypted = await decryptGitHubToken(encrypted, masterPassword, kekSalt);

      expect(decrypted).toBe(longToken);
    });

    it('should handle tokens with unicode characters', async () => {
      const unicodeToken = 'ghp_test_🔐_token_😀_' + 'a'.repeat(30);
      const encrypted = await encryptGitHubToken(unicodeToken, masterPassword, kekSalt);
      const decrypted = await decryptGitHubToken(encrypted, masterPassword, kekSalt);

      expect(decrypted).toBe(unicodeToken);
    });

    it('should handle empty master password (weak but valid)', async () => {
      const weakPassword = '';
      const encrypted = await encryptGitHubToken(testToken, weakPassword, kekSalt);
      const decrypted = await decryptGitHubToken(encrypted, weakPassword, kekSalt);

      expect(decrypted).toBe(testToken);
    });

    it('should reject invalid base64 in encrypted data', async () => {
      const invalidBase64: EncryptedGitHubToken = {
        encrypted_github_token: 'not-valid-base64!!!',
        token_nonce: 'YWJjZGVmZ2hpams=',
        token_dek: 'YWJjZGVmZ2hpams=',
        dek_nonce: 'YWJjZGVmZ2hpams=',
        token_auth_tag: 'YWJjZGVmZ2hpams=',
      };

      await expect(
        decryptGitHubToken(invalidBase64, masterPassword, kekSalt)
      ).rejects.toThrow();
    });
  });
});
