# ENCRYPTION ARCHITECTURE DIAGRAM

## Two-Layer Envelope Encryption Flow

```
CREATE SECRET FLOW
==================

User Input: "sk-proj-xxxxx", Master Password: "MyMasterPassword123!"
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 1: UI Validation (CreateSecretDialog)         │
├─────────────────────────────────────────────────────┤
│ - Check: Master password exists in auth store       │
│ - Check: User authenticated                         │
│ - Sanitize input (key → UPPER_SNAKE_CASE)          │
│ - Trigger: useSecretStore.createSecret()           │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 2: State Management (Zustand)                 │
├─────────────────────────────────────────────────────┤
│ 1. Get KEK Salt from auth store                     │
│    └─ From: user_preferences.master_password_      │
│       verification.salt (cached in memory)          │
│                                                     │
│ 2. Call: encryptSecret(value, password, salt)      │
│    └─ Triggers crypto layer                        │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 3: Crypto (Web Crypto API)                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ STEP 1: Generate Random DEK (32 bytes)              │
│   dek = crypto.getRandomValues(new Uint8Array(32)) │
│                                                     │
│ STEP 2: Encrypt Secret with DEK                     │
│   ┌─ Generate nonce (12 bytes)                      │
│   ├─ Algorithm: AES-256-GCM                         │
│   ├─ Input: "sk-proj-xxxxx"                         │
│   └─ Output: ciphertext + auth_tag (appended)       │
│      encrypted_value = Base64(ciphertext)           │
│      auth_tag = Base64(tag)                         │
│      secret_nonce = Base64(nonce)                   │
│                                                     │
│ STEP 3: Derive KEK from Master Password             │
│   ┌─ Input: masterPassword + kekSalt                │
│   ├─ Algorithm: PBKDF2                              │
│   ├─ Iterations: 600,000 (OWASP 2023)               │
│   ├─ Hash: SHA-256                                  │
│   ├─ Time: ~300-600ms (intentional delay)           │
│   └─ Output: CryptoKey (256-bit)                    │
│                                                     │
│ STEP 4: Encrypt DEK with KEK                        │
│   ┌─ Generate nonce (12 bytes)                      │
│   ├─ Algorithm: AES-256-GCM                         │
│   ├─ Input: dek (32 bytes)                          │
│   └─ Output: encrypted_dek + auth_tag               │
│      encrypted_dek = Base64(encrypted)              │
│      dek_nonce = Base64(nonce)                      │
│                                                     │
│ OUTPUT: EnvelopeEncryptedSecret                     │
│ {                                                   │
│   encrypted_value: "QjM0N0FGRkFG...",              │
│   encrypted_dek: "AjhFRDcxQjI3...",               │
│   secret_nonce: "NjMwMjM4RjY5...",                │
│   dek_nonce: "OTAwMjMzRkY2...",                    │
│   auth_tag: "RkYwMjMzN0Y2...",                     │
│   algorithm: "AES-256-GCM"                          │
│ }                                                   │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 4: Database (Supabase PostgreSQL)             │
├─────────────────────────────────────────────────────┤
│ INSERT INTO secrets (                               │
│   id, project_id, environment_id, key,              │
│   encrypted_value,        ← Ciphertext              │
│   encrypted_dek,          ← Encrypted DEK           │
│   secret_nonce,           ← Nonce for secret        │
│   dek_nonce,             ← Nonce for DEK            │
│   auth_tag,              ← GCM auth tag             │
│   algorithm,             ← 'AES-256-GCM'            │
│   description, service_name, tags,                  │
│   created_by, created_at, updated_at, ...           │
│ ) VALUES (...)                                      │
│                                                     │
│ RLS Policy Checked:                                 │
│   "Developers can create secrets"                   │
│   ├─ is_organization_member(org_id)? YES            │
│   ├─ has_role(org_id, 'developer')? YES             │
│   └─ INSERT ALLOWED                                 │
│                                                     │
│ Unique Constraint Checked:                          │
│   UNIQUE(environment_id, key)? PASS                 │
│                                                     │
│ Foreign Keys Checked:                               │
│   - project_id exists? YES                          │
│   - environment_id exists? YES                      │
│   - created_by exists? YES                          │
│                                                     │
│ Triggers Fire:                                      │
│   1. update_secrets_updated_at                      │
│   2. audit_secrets_insert                           │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 5: Audit Logging (Database Triggers)          │
├─────────────────────────────────────────────────────┤
│ INSERT INTO audit_logs (                            │
│   organization_id,                                  │
│   user_id: auth.uid(),                              │
│   action: 'secrets.create',                         │
│   resource_type: 'secrets',                         │
│   resource_id: secret.id,                           │
│   metadata: {                                       │
│     operation: 'INSERT',                            │
│     new: { ...encrypted_data }  ← No plaintext     │
│   },                                                │
│   ip_address, user_agent, created_at                │
│ ) VALUES (...)                                      │
│                                                     │
│ IMPORTANT: No plaintext logged, only encrypted      │
│ data and metadata                                   │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 6: State Management (Update Cache)            │
├─────────────────────────────────────────────────────┤
│ - Update secrets array in Zustand store             │
│ - Cache decrypted value in memory:                  │
│   decryptedSecrets.set(secret.id, plaintext)        │
│                                                     │
│ IMPORTANT: Plaintext ONLY in memory                 │
│            NEVER persisted to database              │
│            CLEARED on logout                        │
└─────────────────────────────────────────────────────┘
    |
    v
SECRET CREATED SUCCESSFULLY
    - Encrypted in database
    - Cached plaintext in memory
    - Audit logged (encrypted form)
```

---

## Decryption Flow

```
DECRYPT SECRET FLOW
===================

User clicks "Reveal" on SecretCard
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 1: UI Trigger (SecretCard Component)          │
├─────────────────────────────────────────────────────┤
│ - Check: Is plaintext cached in memory?             │
│   ├─ YES: Just toggle visibility                    │
│   └─ NO: Trigger decryption                         │
│                                                     │
│ - Check: Master password exists?                    │
│   └─ NO: Show "Please unlock your vault"            │
│                                                     │
│ - Call: useSecretStore.decryptSecret(secret)        │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 2: State Management (Zustand)                 │
├─────────────────────────────────────────────────────┤
│ 1. Get KEK salt from auth store                     │
│    └─ MUST be same salt used during encryption      │
│                                                     │
│ 2. Reconstruct EnvelopeEncryptedSecret from DB row  │
│    ├─ encrypted_value (Base64 → Uint8Array)         │
│    ├─ encrypted_dek (Base64 → Uint8Array)           │
│    ├─ secret_nonce (Base64 → Uint8Array)            │
│    ├─ dek_nonce (Base64 → Uint8Array)               │
│    ├─ auth_tag (Base64 → Uint8Array)                │
│    └─ algorithm: 'AES-256-GCM'                      │
│                                                     │
│ 3. Call: decryptSecret(encrypted, password, salt)   │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 3: Crypto (Web Crypto API)                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ STEP 1: Validate Algorithm                          │
│   if (algorithm !== 'AES-256-GCM') throw Error      │
│                                                     │
│ STEP 2: Derive KEK from Master Password             │
│   ┌─ Input: masterPassword + kekSalt (SAME as before)
│   ├─ Algorithm: PBKDF2                              │
│   ├─ Iterations: 600,000                            │
│   ├─ Hash: SHA-256                                  │
│   ├─ Time: ~300-600ms                               │
│   └─ Output: CryptoKey                              │
│                                                     │
│ STEP 3: Decrypt DEK using KEK                       │
│   ┌─ Algorithm: AES-256-GCM                         │
│   ├─ iv: dek_nonce                                  │
│   ├─ ciphertext: encrypted_dek                      │
│   ├─ tagLength: 128 (16 bytes)                      │
│   ├─ If wrong password:                             │
│   │    GCM tag validation fails → ERROR             │
│   └─ Output: dek (32 bytes)                         │
│                                                     │
│ STEP 4: Import DEK as CryptoKey                     │
│   └─ Ready for secret decryption                    │
│                                                     │
│ STEP 5: Reconstruct Ciphertext with Auth Tag        │
│   ┌─ GCM format: ciphertext || auth_tag             │
│   ├─ Build: new Uint8Array(c_len + tag_len)         │
│   └─ Copy: ciphertext at offset 0                   │
│            auth_tag at offset c_len                 │
│                                                     │
│ STEP 6: Decrypt Secret using DEK                    │
│   ┌─ Algorithm: AES-256-GCM                         │
│   ├─ iv: secret_nonce                               │
│   ├─ ciphertext: encrypted_value || auth_tag        │
│   ├─ tagLength: 128                                 │
│   ├─ If corrupted data:                             │
│   │    GCM tag validation fails → ERROR             │
│   └─ Output: plaintextBuffer (Uint8Array)           │
│                                                     │
│ STEP 7: Decode to String                            │
│   └─ plaintext = new TextDecoder().decode(buffer)   │
│      Result: "sk-proj-xxxxx"                        │
│                                                     │
│ OUTPUT: String (plaintext secret)                   │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 2b: State Management (Update Cache)           │
├─────────────────────────────────────────────────────┤
│ - Cache plaintext in memory:                        │
│   decryptedSecrets.set(secret.id, plaintext)        │
│                                                     │
│ - Return plaintext to component                     │
└─────────────────────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────────────────────┐
│ LAYER 1b: UI Display (SecretCard Component)         │
├─────────────────────────────────────────────────────┤
│ - isRevealed = true                                 │
│ - Display plaintext in code block                   │
│ - Show "Copy" button (copies to clipboard)          │
│ - Show "Hide" button (hides value)                  │
└─────────────────────────────────────────────────────┘
    |
    v
SECRET DISPLAYED IN UI
    - Plaintext shown to user
    - Cached for fast re-reveal
    - Can copy to clipboard
    - Can click Hide to clear display (not cache)
```

---

## Key Management Architecture

```
MASTER PASSWORD → KEK SALT
==========================

During Setup (First Time):
  1. User enters master password: "MyPassword123!"
  2. Generate random salt (16 bytes)
  3. Create verification value (encrypt "abyrith-verification-v1")
  4. Store in user_preferences.master_password_verification:
     {
       salt: "base64-encoded-16-byte-salt",      ← KEK SALT
       ciphertext: "encrypted-verification",
       iv: "nonce",
       algorithm: "AES-256-GCM",
       iterations: 600000
     }

During Unlock (Every Session):
  1. User enters master password
  2. Verify password using stored verification value
  3. Extract salt from verification value
  4. Cache salt in auth store: kekSalt = verification.salt
  5. Now ready to encrypt/decrypt secrets

Encryption Use:
  plaintext secret --┐
                    ├─→ [AES-256-GCM with random DEK]
  random DEK ────────┘
                    ├─→ encrypted_value
                    └─→ encrypted_dek (encrypted with KEK)

  KEK comes from:
    KEK = PBKDF2(
      password: masterPassword,
      salt: kekSalt,           ← From user_preferences
      iterations: 600_000,
      hash: SHA-256
    )

Key Rotation Without Re-encryption:
  - Change master password? Generate NEW salt
  - Old secrets still encrypted with OLD salt
  - User can decrypt with password + old salt
  - New secrets encrypted with NEW salt
  - Gradual migration possible

Multi-Device:
  - Each device needs master password
  - Salt stored in user_preferences
  - Each device derives same KEK from same (password + salt)
  - All encrypted secrets readable from all devices
```

---

## Data Flow Diagram

```
┌──────────────┐
│  Plaintext   │
│  "sk-proj-"  │
└──────┬───────┘
       │
       │ + Master Password
       │ + KEK Salt
       ▼
┌──────────────────────────────┐
│  Crypto Layer                │
│  (Web Crypto API)            │
│  ┌────────────────────────┐  │
│  │ 1. Generate random DEK │  │
│  │ 2. Encrypt secret      │  │
│  │ 3. Derive KEK          │  │
│  │ 4. Encrypt DEK         │  │
│  │ 5. Return 5 components │  │
│  └────────────────────────┘  │
└──────────────────────┬────────┘
                       │
                       ▼
┌──────────────────────────────────┐
│  5 Base64-Encoded Components      │
│                                  │
│ encrypted_value                  │
│ encrypted_dek                    │
│ secret_nonce                     │
│ dek_nonce                        │
│ auth_tag                         │
│ algorithm: 'AES-256-GCM'         │
└──────────────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Database INSERT      │
        │ /UPDATE              │
        │                      │
        │ secrets table        │
        │                      │
        │ [Encrypted Stored]   │
        └──────────────────────┘
                   │
                   ├─→ ┌──────────────────┐
                   │   │ Audit Log        │
                   │   │ [Encrypted Data] │
                   │   └──────────────────┘
                   │
                   └─→ ┌──────────────────┐
                       │ RLS Policy Check │
                       │ [Organization]   │
                       │ [Role Check]     │
                       └──────────────────┘


REVERSE FOR DECRYPTION:

┌──────────────────────────────────┐
│ Database SELECT                  │
│ (Encrypted Components)           │
│                                  │
│ encrypted_value                  │
│ encrypted_dek                    │
│ secret_nonce                     │
│ dek_nonce                        │
│ auth_tag                         │
│ algorithm                        │
└──────────────────┬───────────────┘
                   │
                   │ + Master Password
                   │ + KEK Salt
                   ▼
        ┌──────────────────────┐
        │ Crypto Decryption    │
        │ (Web Crypto API)     │
        │                      │
        │ 1. Derive KEK        │
        │ 2. Decrypt DEK       │
        │ 3. Decrypt secret    │
        │ 4. Validate GCM tags │
        │ 5. Return plaintext  │
        └──────────────────┬───┘
                           │
                           ▼
                ┌──────────────────┐
                │ Plaintext Secret │
                │ [Memory Cache]   │
                │ [Not Persisted]  │
                └──────────────────┘
```

---

## Security Guarantees

```
ZERO-KNOWLEDGE ARCHITECTURE
============================

What Server CAN see:
  ✓ Encrypted secret (ciphertext)
  ✓ Encrypted DEK
  ✓ Nonces (reusable safely)
  ✓ Algorithm identifier
  ✓ User ID (who created it)
  ✓ Service name, description
  ✓ Timestamps

What Server CANNOT see:
  ✗ Plaintext secret value
  ✗ Data Encryption Key (DEK)
  ✗ Key Encryption Key (KEK)
  ✗ Master password
  ✗ KEK salt (stored but needed for decryption)

What Only Client CAN do:
  ✓ Decrypt secrets (has master password)
  ✓ Derive KEK (has password + salt)
  ✓ Encrypt/decrypt with confidence

What Attacker Cannot do:
  ✗ Decrypt secrets without master password
  ✗ Brute-force: 600,000 PBKDF2 iterations = ~300-600ms per attempt
  ✗ Re-use encryption key: Each DEK is random
  ✗ Tamper with ciphertext: GCM auth tag detects it
  ✗ Decrypt with database alone: No plaintext, no keys

What Ensures Integrity:
  ✓ AES-256-GCM authentication tags
  ✓ Two different nonces per secret
  ✓ Each secret encrypted with unique DEK
  ✓ PBKDF2 prevents dictionary attacks
```

---

## Summary

The two-layer envelope encryption provides:

1. **Separation of Concerns**: DEK separates data encryption from key encryption
2. **Key Rotation**: New DEK per secret, no re-encryption of all data
3. **Defense in Depth**: Two encryption layers, each with unique random components
4. **Performance**: Client-side encryption/decryption (server never touches plaintext)
5. **Compliance**: Meets enterprise zero-knowledge requirements
6. **Auditability**: Tracks who accessed what (when logging implemented)

All operations:
  - Use OWASP-recommended PBKDF2 iterations (600,000)
  - Use cryptographically secure random for DEK and nonces
  - Use AES-256-GCM for authenticated encryption
  - Verify auth tags on every decrypt operation
  - Never persist plaintext to database
  - Never expose master password to server
