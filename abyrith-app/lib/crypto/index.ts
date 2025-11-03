/**
 * Crypto Library Exports
 *
 * Zero-knowledge encryption utilities for Abyrith
 */

// Envelope encryption (recommended for secrets)
export {
  encryptSecret,
  decryptSecret,
  generateVerificationValue,
  verifyPassword,
  validatePasswordStrength,
  estimateKeyDerivationTime,
  type EnvelopeEncryptedSecret,
  type EncryptedVerification,
} from './envelope-encryption';

// Legacy single-layer encryption (deprecated, use only for verification)
export {
  encrypt,
  decrypt,
  deriveKey,
  type EncryptedData,
} from './encryption';
