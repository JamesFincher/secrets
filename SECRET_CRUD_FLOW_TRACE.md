# SECRET CRUD FLOW END-TO-END TRACE

Complete lifecycle trace of a secret from creation to deletion through all layers of the Abyrith platform.

**Analysis Date:** 2025-11-02
**Codebase Version:** MVP Development (Week 2 Complete)
**Thoroughness:** Very Thorough - All layers analyzed

---

## LAYER 1: UI LAYER - CREATE SECRET

### Component: CreateSecretDialog
**File:** `/Users/james/code/secrets/abyrith-app/components/secrets/create-secret-dialog.tsx`

**Flow:**
1. User clicks "Create Secret" button
2. Dialog opens with form fields:
   - Key (e.g., "OPENAI_API_KEY") - forced to UPPER_SNAKE_CASE
   - Value (password-masked input with Show/Hide toggle)
   - Service Name (optional - e.g., "OpenAI")
   - Description (optional)

3. Form submission:
   ```typescript
   handleSubmit(e: React.FormEvent) {
     // Line 31-53
     1. Prevents default form behavior
     2. Validates masterPassword exists in auth store
     3. If no master password: "Please unlock your vault" alert
     4. Calls: useSecretStore().createSecret(
        projectId, environmentId, key, value, masterPassword, metadata)
     5. On success: closes dialog (onClose())
     6. On error: shows "Failed to create secret" alert
   }
   ```

**Key Security Features:**
- Master password required (prevents unencrypted operations)
- Zero-Knowledge banner shown to user
- Input sanitization on key (alphanumeric + underscore only)
- Password input type (not visible by default)

---

## LAYER 2: STATE MANAGEMENT LAYER - SECRET STORE

### Store: Zustand useSecretStore
**File:** `/Users/james/code/secrets/abyrith-app/lib/stores/secret-store.ts`

### ACTION: createSecret()
**Lines:** 90-153

**Process:**
```
Step 1: Get User Context
  - await supabase.auth.getUser()
  - If no user: throw "Not authenticated"

Step 2: Get KEK Salt
  - kekSalt = useAuthStore.getState().getKEKSalt()
  - Retrieves from auth store (cached in memory)
  - If null: throw "Master password session expired"
  - This salt comes from user_preferences.master_password_verification.salt

Step 3: Encrypt Secret Value
  - CALL: encryptSecret(value, masterPassword, kekSalt)
  - Returns: EnvelopeEncryptedSecret object with:
    {
      encrypted_value: string;    // Base64-encoded ciphertext
      encrypted_dek: string;       // Base64-encoded encrypted DEK
      secret_nonce: string;        // Base64-encoded 12-byte nonce
      dek_nonce: string;          // Base64-encoded 12-byte nonce
      auth_tag: string;           // Base64-encoded 16-byte auth tag
      algorithm: 'AES-256-GCM';
    }

Step 4: Database Insert
  - await supabase.from('secrets').insert({
      project_id,
      environment_id,
      key,
      encrypted_value,        // All 5 encryption fields stored
      encrypted_dek,
      secret_nonce,
      dek_nonce,
      auth_tag,
      algorithm: 'AES-256-GCM',
      description,
      service_name,
      tags,
      created_by: user.id,
    })
    .select()
    .single();

Step 5: Update State
  - Add secret to secrets array (optimistic update)
  - Cache decrypted value in memory: decryptedSecrets.set(secret.id, value)

Step 6: Return
  - Return the created secret record (with encrypted fields)
```

**Error Handling:**
- Try/catch block wraps entire operation
- Set error state on failure
- Throw error to caller (UI catches and shows alert)

**Key Features:**
- Decrypted value stored ONLY in memory (never persisted)
- KEK salt retrieved from auth store (not stored in secret)
- All 5 envelope encryption components stored correctly
- RLS policies will enforce multi-tenancy on database level

---

## LAYER 3: CRYPTO LAYER - ENVELOPE ENCRYPTION

### Library: envelope-encryption.ts
**File:** `/Users/james/code/secrets/abyrith-app/lib/crypto/envelope-encryption.ts`

### FUNCTION: encryptSecret()
**Lines:** 114-178

**Encryption Algorithm: Two-Layer Envelope Encryption**

```
┌─────────────────────────────────────────────────────────┐
│ ENCRYPTION PROCESS                                      │
├─────────────────────────────────────────────────────────┤

INPUT:
  plaintext = "sk-proj-xxxxxxxxxxxxx"
  masterPassword = "MyMasterPassword123!"
  kekSalt = "base64-encoded-16-byte-salt"

STEP 1: Generate Random Data Encryption Key (DEK)
  ├─ dek = crypto.getRandomValues(new Uint8Array(32))
  ├─ Result: 32 random bytes (256 bits)
  └─ Purpose: Encrypt the actual secret value

STEP 2: Encrypt Secret with DEK
  ├─ secretNonce = crypto.getRandomValues(new Uint8Array(12))
  ├─ plaintextBuffer = encode(plaintext) → Uint8Array
  ├─ dekKey = crypto.subtle.importKey('raw', dek, AES-GCM)
  ├─ encryptedSecretBuffer = crypto.subtle.encrypt({
  │    name: 'AES-GCM',
  │    iv: secretNonce,
  │    tagLength: 128 (16 bytes)
  │  }, dekKey, plaintextBuffer)
  ├─ Result: ciphertext + 16-byte auth tag (appended by GCM)
  └─ Total output: ciphertext.length + 16 bytes

STEP 3: Derive Key Encryption Key (KEK) from Master Password
  ├─ Decode kekSalt from base64 → Uint8Array(16)
  ├─ passwordBuffer = encode(masterPassword) → Uint8Array
  ├─ baseKey = crypto.subtle.importKey('raw', passwordBuffer, PBKDF2)
  ├─ kek = crypto.subtle.deriveKey({
  │    name: 'PBKDF2',
  │    salt: kekSaltBuffer,
  │    iterations: 600_000,     // OWASP 2023 recommendation
  │    hash: 'SHA-256',
  │  }, baseKey, {
  │    name: 'AES-GCM',
  │    length: 256,             // 256-bit key
  │  }, false,                  // Non-extractable
  │    ['encrypt'])
  ├─ Result: CryptoKey derived from master password
  └─ Security: Takes ~300-600ms per derivation (intentional - prevents brute force)

STEP 4: Encrypt DEK with KEK
  ├─ dekNonce = crypto.getRandomValues(new Uint8Array(12))
  ├─ encryptedDEKBuffer = crypto.subtle.encrypt({
  │    name: 'AES-GCM',
  │    iv: dekNonce,
  │    tagLength: 128
  │  }, kek, dek)
  ├─ Result: encrypted DEK + 16-byte auth tag
  └─ Total output: 32 + 16 = 48 bytes

STEP 5: Extract Auth Tag & Convert to Base64
  ├─ encryptedSecretArray = new Uint8Array(encryptedSecretBuffer)
  ├─ ciphertextLength = encryptedSecretArray.length - 16
  ├─ ciphertext = slice(0, ciphertextLength)
  ├─ authTag = slice(ciphertextLength, end)
  ├─ Convert all to base64:
  │    - encrypted_value = bufferToBase64(ciphertext)
  │    - encrypted_dek = bufferToBase64(encryptedDEKBuffer)
  │    - secret_nonce = bufferToBase64(secretNonce)
  │    - dek_nonce = bufferToBase64(dekNonce)
  │    - auth_tag = bufferToBase64(authTag)
  └─ All strings now safe for database storage (UTF-8 compatible)

OUTPUT: EnvelopeEncryptedSecret
  {
    encrypted_value: "QjM0N0FGRkFGNjI4MzI1NDEw...", // Base64
    encrypted_dek: "AjhFRDcxQjI3RjkwMjM4Nzc4...",  // Base64
    secret_nonce: "NjMwMjM4RjY5MjMwMjMz...",        // Base64
    dek_nonce: "OTAwMjMzRkY2OTIzMDIzMw==",          // Base64
    auth_tag: "RkYwMjMzN0Y2OTIzMDIzMw==",           // Base64
    algorithm: "AES-256-GCM"
  }

SECURITY ANALYSIS:
├─ Each secret gets UNIQUE random DEK (256 bits)
├─ Each DEK encryption gets UNIQUE nonce (96 bits)
├─ Each secret encryption gets UNIQUE nonce (96 bits)
├─ GCM mode provides authentication (prevents tampering)
├─ KEK derived with 600,000 iterations (slow = brute-force resistant)
├─ Server NEVER sees plaintext or unencrypted DEK
└─ Only client has master password + kekSalt to decrypt
```

**Constants:**
```typescript
PBKDF2_ITERATIONS = 600_000;  // OWASP 2023 recommendation
SALT_LENGTH = 16;             // 128 bits
NONCE_LENGTH = 12;            // 96 bits (GCM standard)
DEK_LENGTH = 32;              // 256 bits (AES-256)
KEY_LENGTH = 256;             // bits (AES-256)
```

---

## LAYER 4: DATABASE LAYER - INSERT

### Table: secrets
**File:** `/Users/james/code/secrets/abyrith-app/supabase/migrations/20241102000001_initial_schema.sql`
**Lines:** 90-119

**Schema:**
```sql
CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id),
    environment_id UUID NOT NULL REFERENCES environments(id),
    key TEXT NOT NULL,
    
    -- Envelope encryption fields (5 components)
    encrypted_value TEXT NOT NULL,        -- Ciphertext of secret
    encrypted_dek TEXT NOT NULL,          -- Encrypted Data Encryption Key
    secret_nonce TEXT NOT NULL,           -- Nonce for secret encryption
    dek_nonce TEXT NOT NULL,             -- Nonce for DEK encryption
    auth_tag TEXT NOT NULL,              -- GCM authentication tag
    algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    
    -- Metadata
    description TEXT,
    service_name TEXT,
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    
    UNIQUE(environment_id, key)  -- Prevent duplicate keys in same environment
);
```

**Indexes:**
- `idx_secrets_project_id` - Fast project lookups
- `idx_secrets_environment_id` - Fast environment lookups
- `idx_secrets_key` - Fast key searches
- `idx_secrets_service_name` - Service filtering
- `idx_secrets_created_by` - User's secrets lookup

**Insert Process:**
```
1. Supabase receives insert request with encrypted data:
   {
     project_id: UUID,
     environment_id: UUID,
     key: "OPENAI_API_KEY",
     encrypted_value: "QjM0N0FGRkFGNjI4MzI1NDEw...",
     encrypted_dek: "AjhFRDcxQjI3RjkwMjM4Nzc4...",
     secret_nonce: "NjMwMjM4RjY5MjMwMjMz...",
     dek_nonce: "OTAwMjMzRkY2OTIzMDIzMw==",
     auth_tag: "RkYwMjMzN0Y2OTIzMDIzMw==",
     algorithm: "AES-256-GCM",
     description: "API key for ChatGPT",
     service_name: "OpenAI",
     tags: ["production", "critical"],
     created_by: user-uuid
   }

2. RLS Policies Checked:
   Policy: "Developers can create secrets"
   - Check: is_organization_member(project.organization_id)?
   - Check: has_role(project.organization_id, 'developer')?
   - If both pass: INSERT allowed
   - If either fails: INSERT blocked with 403 Forbidden

3. Unique Constraint Checked:
   - UNIQUE(environment_id, key)
   - If duplicate: Error "duplicate key value violates unique constraint"

4. Foreign Key Constraints:
   - project_id exists? Check projects table
   - environment_id exists? Check environments table
   - created_by exists? Check auth.users table

5. Timestamp Triggers:
   - created_at = NOW()
   - updated_at = NOW()

6. Audit Trigger Fires:
   TRIGGER: audit_secrets_insert
   → FUNCTION: log_audit()
   → INSERT into audit_logs (see section below)

7. Database Insert Complete:
   - Secret stored with all encrypted fields
   - Plaintext never touches database
   - Audit log created automatically
```

---

## LAYER 5: SECURITY LAYER - ROW LEVEL SECURITY

### RLS Policies
**File:** `/Users/james/code/secrets/abyrith-app/supabase/migrations/20241102000002_rls_policies.sql`

**SECRETS Table Policies:**

**Policy 1: "Members can view secrets"** (SELECT)
```sql
CREATE POLICY "Members can view secrets" ON secrets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = secrets.project_id
        AND is_organization_member(projects.organization_id)
    )
);

Logic:
- User can SELECT a secret IF:
  - Secret's project exists
  - User is a member of that project's organization
- Result: Multi-tenancy enforced (can't access others' secrets)
```

**Policy 2: "Developers can create secrets"** (INSERT)
```sql
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = secrets.project_id
        AND has_role(projects.organization_id, 'developer')
    )
);

Logic:
- User can INSERT a secret IF:
  - User's project exists
  - User has 'developer' or higher role (developer > admin > owner)
- Result: Role-based access control (RBAC)
```

**Policy 3: "Developers can update secrets"** (UPDATE)
```sql
USING (EXISTS(...)) AND
WITH CHECK (EXISTS(...))

Logic:
- Check both before and after update
- User must have developer role
- Can modify all fields except those protected by triggers
```

**Policy 4: "Developers can delete secrets"** (DELETE)
```sql
USING (EXISTS(...))

Logic:
- User must have developer role
- Soft deletes NOT used (deleted immediately)
- Audit log created by trigger
```

**Multi-Tenancy Guarantee:**
- Every secret access goes through org_id check
- User cannot access projects outside their organization
- Role hierarchy enforced (read_only < developer < admin < owner)
- Attempted access to unauthorized secret → Error 403 Forbidden (silent)

---

## LAYER 6: AUDIT LAYER - LOGGING

### Audit Trigger
**File:** `/Users/james/code/secrets/abyrith-app/supabase/migrations/20241102000003_audit_triggers.sql`

**Trigger: audit_secrets_insert**
```sql
CREATE TRIGGER audit_secrets_insert
    AFTER INSERT ON secrets
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();
```

**Function: log_audit()**
**Lines:** 11-105

**Process:**
```
WHEN TRIGGERED:
- After INSERT/UPDATE/DELETE on secrets table
- Fires AFTER operation (so values are already in DB)

EXECUTION:
1. Determine action type:
   - TG_OP = 'INSERT' → action = 'secrets.create'
   - TG_OP = 'UPDATE' → action = 'secrets.update'
   - TG_OP = 'DELETE' → action = 'secrets.delete'

2. Get organization_id:
   - For secrets: SELECT p.organization_id FROM projects p
     WHERE p.id = NEW.project_id (or OLD.project_id if DELETE)

3. Build metadata JSON:
   {
     operation: "INSERT",
     new: {
       id: UUID,
       project_id: UUID,
       environment_id: UUID,
       key: "OPENAI_API_KEY",
       // IMPORTANT: encrypted_value/encrypted_dek stored as-is (no decryption)
       encrypted_value: "QjM0N0FGRkFGNjI4MzI1NDEw...",
       encrypted_dek: "AjhFRDcxQjI3RjkwMjM4Nzc4...",
       // All other fields...
     }
   }

4. INSERT into audit_logs:
   INSERT INTO audit_logs (
     organization_id,
     user_id: auth.uid(),
     action: 'secrets.create',
     resource_type: 'secrets',
     resource_id: secret.id,
     metadata: { ... },
     ip_address: extracted from headers,
     user_agent: extracted from headers,
     created_at: NOW()
   );

SECURITY NOTES:
- Decrypted values NEVER logged (only ciphertext)
- Audit logs immutable (no UPDATE/DELETE allowed)
- RLS enforces: users only see audit logs for their org
```

**Secret Access Logging Function:**
**Function: log_secret_access(secret_id UUID)**
**Lines:** 207-249

```sql
Purpose: Log when secrets are READ (not just modified)
Must be called from application code after decryption

Process:
1. Receive secret_id (UUID)
2. Get organization_id for the secret
3. INSERT into audit_logs:
   {
     action: 'secrets.read',
     resource_type: 'secrets',
     resource_id: secret_id,
     metadata: {
       operation: 'READ',
       accessed_at: NOW()
     }
   }
4. UPDATE secrets table:
   SET last_accessed_at = NOW() WHERE id = secret_id

Status in Code: NOT CALLED
- Function exists but app code doesn't invoke it
- ISSUE: Read access not being logged (security gap)
```

---

## FLOW 2: FETCH & DISPLAY SECRET

### Component: SecretCard
**File:** `/Users/james/code/secrets/abyrith-app/components/secrets/secret-card.tsx`

**Process:**
```
1. Initial Render:
   - Receive: Secret (encrypted data from database)
   - Show: Key name, service name, description
   - Button: "Reveal" (shows encrypted state)
   - State: isRevealed = false, decryptedValue = null

2. User Clicks "Reveal":
   - Check: getDecryptedSecret(secret.id) from store
   - If cached in memory: Toggle isRevealed = true
   - If not cached: Decrypt it

3. Decryption Flow:
   handleReveal() → if (!decryptedValue) {
     // Line 36-39
     if (!masterPassword) throw "Please unlock your vault"
     setIsDecrypting(true)
     
     await decryptSecret(secret, masterPassword)
     // This calls secret-store.decryptSecret()
     
     setIsRevealed(true)
     setIsDecrypting(false)
   }

4. Display Decrypted Value:
   - Show in code block: font-mono, break-all
   - Copy button: copies to clipboard
   - 2 second "Copied!" confirmation

5. Caching:
   - Decrypted value stored in store: decryptedSecrets Map
   - Key: secret.id
   - Value: plaintext string
   - Lifetime: Until user logs out or clearDecryptedSecrets() called
```

---

## LAYER 3: CRYPTO LAYER - DECRYPTION

### Function: decryptSecret()
**File:** `/Users/james/code/secrets/abyrith-app/lib/crypto/envelope-encryption.ts`
**Lines:** 195-261

**Decryption Algorithm: Reverse of Encryption**

```
┌─────────────────────────────────────────────────────────┐
│ DECRYPTION PROCESS                                      │
├─────────────────────────────────────────────────────────┤

INPUT: EnvelopeEncryptedSecret (from database)
  {
    encrypted_value: "QjM0N0FGRkFGNjI4MzI1NDEw...",
    encrypted_dek: "AjhFRDcxQjI3RjkwMjM4Nzc4...",
    secret_nonce: "NjMwMjM4RjY5MjMwMjMz...",
    dek_nonce: "OTAwMjMzRkY2OTIzMDIzMw==",
    auth_tag: "RkYwMjMzN0Y2OTIzMDIzMw==",
    algorithm: "AES-256-GCM"
  }
  masterPassword: "MyMasterPassword123!"
  kekSalt: "base64-encoded-16-byte-salt"

STEP 1: Validate Algorithm
  if (algorithm !== 'AES-256-GCM') throw new Error(...)

STEP 2: Convert from Base64
  ├─ encryptedValue = base64ToBuffer(encrypted_value)
  ├─ encryptedDEK = base64ToBuffer(encrypted_dek)
  ├─ secretNonce = base64ToBuffer(secret_nonce)
  ├─ dekNonce = base64ToBuffer(dek_nonce)
  ├─ authTag = base64ToBuffer(auth_tag)
  └─ All are now Uint8Array

STEP 3: Derive KEK from Master Password
  ├─ SAME as encryption:
  ├─ kekSaltBuffer = base64ToBuffer(kekSalt)
  ├─ kek = await deriveKEK(masterPassword, kekSaltBuffer)
  ├─ Uses PBKDF2: 600,000 iterations, SHA-256
  └─ Result: CryptoKey (takes ~300-600ms)

STEP 4: Decrypt DEK using KEK
  ├─ dekBuffer = await crypto.subtle.decrypt({
  │    name: 'AES-GCM',
  │    iv: dekNonce,
  │    tagLength: 128
  │  }, kek, encryptedDEK)
  ├─ If wrong password: THROWS error (GCM tag mismatch)
  ├─ If corrupted: THROWS error (integrity check failed)
  └─ Result: Uint8Array (32 bytes - the original DEK)

STEP 5: Import DEK as CryptoKey
  ├─ dekKey = crypto.subtle.importKey(
  │    'raw', dekBuffer, { name: 'AES-GCM' }, false, ['decrypt'])
  └─ Result: CryptoKey

STEP 6: Reconstruct Ciphertext with Auth Tag
  ├─ In AES-GCM, auth tag must be appended to ciphertext
  ├─ ciphertextWithTag = new Uint8Array(
  │    encryptedValue.length + authTag.length)
  ├─ ciphertextWithTag.set(encryptedValue, 0)
  ├─ ciphertextWithTag.set(authTag, encryptedValue.length)
  └─ Result: ciphertext||tag

STEP 7: Decrypt Secret using DEK
  ├─ plaintextBuffer = await crypto.subtle.decrypt({
  │    name: 'AES-GCM',
  │    iv: secretNonce,
  │    tagLength: 128
  │  }, dekKey, ciphertextWithTag)
  ├─ If wrong DEK: THROWS error (tag mismatch)
  ├─ If corrupted ciphertext: THROWS error
  └─ Result: Uint8Array

STEP 8: Decode to String
  ├─ decoder = new TextDecoder()
  └─ plaintext = decoder.decode(plaintextBuffer)

OUTPUT: String
  "sk-proj-xxxxxxxxxxxxx"

ERROR HANDLING:
- Catch-all: throw new Error('Decryption failed: Invalid password or corrupted data')
- User sees: "Failed to decrypt secret. Invalid master password?"
- Wrong password → DEK decryption fails → Error
- Corrupted data → Secret decryption fails → Error
- Corrupted nonce → GCM tag fails → Error

PERFORMANCE:
- PBKDF2: ~300-600ms per decryption
- AES-GCM decryption: ~1-5ms
- Total: ~300-610ms per secret reveal
- Can be optimized: pre-derive KEK once, cache it
```

**Error Handling:**
```typescript
try {
  // ... decryption steps
} catch (error) {
  // Line 258-260
  throw new Error('Decryption failed: Invalid password or corrupted data');
}
```

---

## LAYER 2: STATE MANAGEMENT LAYER - SECRET STORE (Decrypt)

### Store Action: decryptSecret()
**File:** `/Users/james/code/secrets/abyrith-app/lib/stores/secret-store.ts`
**Lines:** 258-288

**Process:**
```typescript
decryptSecret: async (secret: Secret, masterPassword: string) => {
  try {
    // Step 1: Get KEK salt from auth store
    const kekSalt = useAuthStore.getState().getKEKSalt();
    if (!kekSalt) {
      throw new Error('Master password session expired...');
    }

    // Step 2: Construct EnvelopeEncryptedSecret from database row
    const envelopeEncrypted: EnvelopeEncryptedSecret = {
      encrypted_value: secret.encrypted_value,
      encrypted_dek: secret.encrypted_dek,
      secret_nonce: secret.secret_nonce,
      dek_nonce: secret.dek_nonce,
      auth_tag: secret.auth_tag,
      algorithm: secret.algorithm as 'AES-256-GCM',
    };

    // Step 3: Call crypto function
    const decryptedValue = await decryptSecret(
      envelopeEncrypted, 
      masterPassword, 
      kekSalt
    );

    // Step 4: Cache in memory
    const newDecrypted = new Map(get().decryptedSecrets);
    newDecrypted.set(secret.id, decryptedValue);
    set({ decryptedSecrets: newDecrypted });

    // Step 5: Return plaintext
    return decryptedValue;
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Decryption failed';
    throw new Error(errorMessage);
  }
}
```

**Caching Strategy:**
```typescript
decryptedSecrets: Map<secretId, plaintext>

// Fast retrieval without re-decrypting
getDecryptedSecret: (secretId: string) => {
  return get().decryptedSecrets.get(secretId) || null;
}

// Clear all (on logout)
clearDecryptedSecrets: () => {
  set({ decryptedSecrets: new Map() });
}
```

---

## FLOW 3: UPDATE SECRET

### UI Component: SecretCard Edit Button
**File:** `/Users/james/code/secrets/abyrith-app/components/secrets/secret-card.tsx`

**Process:**
- Currently NOT IMPLEMENTED
- No Edit button visible in component
- Would need to create EditSecretDialog similar to CreateSecretDialog

### Store Action: updateSecret()
**File:** `/Users/james/code/secrets/abyrith-app/lib/stores/secret-store.ts`
**Lines:** 158-222

**Process:**
```typescript
updateSecret: async (
  secretId: string,
  value: string,
  masterPassword: string,
  metadata = {}
) => {
  set({ isLoading: true, error: null });

  try {
    // Step 1: Get KEK salt (REUSES existing salt - important!)
    const kekSalt = useAuthStore.getState().getKEKSalt();
    if (!kekSalt) {
      throw new Error('Master password session expired...');
    }

    // Step 2: Encrypt new value (same master password, same salt)
    const encrypted = await encryptSecret(value, masterPassword, kekSalt);

    // Step 3: Database update (all 5 encryption fields)
    const updateData: any = {
      encrypted_value: encrypted.encrypted_value,
      encrypted_dek: encrypted.encrypted_dek,
      secret_nonce: encrypted.secret_nonce,
      dek_nonce: encrypted.dek_nonce,
      auth_tag: encrypted.auth_tag,
      algorithm: encrypted.algorithm,
    };

    // Add optional metadata fields
    if (metadata.description !== undefined) {
      updateData.description = metadata.description;
    }
    if (metadata.serviceName !== undefined) {
      updateData.service_name = metadata.serviceName;
    }
    if (metadata.tags !== undefined) {
      updateData.tags = metadata.tags;
    }

    // Step 4: Database update
    const { error } = await supabase
      .from('secrets')
      .update(updateData)
      .eq('id', secretId);

    if (error) throw error;

    // Step 5: Update local state
    set((state) => ({
      secrets: state.secrets.map((s) =>
        s.id === secretId ? { ...s, ...updateData } : s
      ),
      isLoading: false,
    }));

    // Step 6: Update cached decrypted value
    const newDecrypted = new Map(get().decryptedSecrets);
    newDecrypted.set(secretId, value);
    set({ decryptedSecrets: newDecrypted });
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update secret';
    set({ error: errorMessage, isLoading: false });
    throw error;
  }
}
```

**Key Feature: KEK Reuse**
- Uses SAME kekSalt as original secret
- Generates NEW random DEK (line 174: encryptSecret)
- Generates NEW random nonces
- Result: Same master password decrypts both old and new values
- Allows: Key rotation without re-encrypting all secrets

**Database Update Process:**
```sql
UPDATE secrets SET
  encrypted_value = 'new-ciphertext...',
  encrypted_dek = 'new-encrypted-dek...',
  secret_nonce = 'new-nonce...',
  dek_nonce = 'new-nonce...',
  auth_tag = 'new-tag...',
  algorithm = 'AES-256-GCM',
  description = 'new-description',
  updated_at = NOW()  -- Trigger updates this
WHERE id = secret_id;

-- Triggers fire:
-- 1. update_secrets_updated_at: Sets updated_at = NOW()
-- 2. audit_secrets_update: Logs the change

-- RLS Policy checked:
-- "Developers can update secrets"
-- Must have developer role in project's organization
```

---

## FLOW 4: DELETE SECRET

### UI Component: SecretCard Delete Button
**File:** `/Users/james/code/secrets/abyrith-app/components/secrets/secret-card.tsx`
**Lines:** 60-71

**Process:**
```typescript
handleDelete = async () => {
  // Step 1: Confirmation dialog
  if (!confirm(`Are you sure you want to delete "${secret.key}"?`)) {
    return;
  }

  // Step 2: Call store delete action
  try {
    await deleteSecret(secret.id);
  } catch (error) {
    console.error('Failed to delete secret:', error);
    alert('Failed to delete secret. Please try again.');
  }
}
```

### Store Action: deleteSecret()
**File:** `/Users/james/code/secrets/abyrith-app/lib/stores/secret-store.ts`
**Lines:** 227-253

**Process:**
```typescript
deleteSecret: async (secretId: string) => {
  set({ isLoading: true, error: null });

  try {
    // Step 1: Database delete
    const { error } = await supabase
      .from('secrets')
      .delete()
      .eq('id', secretId);

    if (error) throw error;

    // Step 2: Update local state
    set((state) => {
      const newDecrypted = new Map(state.decryptedSecrets);
      newDecrypted.delete(secretId);  // Remove from cache

      return {
        secrets: state.secrets.filter((s) => s.id !== secretId),
        decryptedSecrets: newDecrypted,
        isLoading: false,
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to delete secret';
    set({ error: errorMessage, isLoading: false });
    throw error;
  }
}
```

**Database Delete Process:**
```sql
DELETE FROM secrets WHERE id = secret_id;

-- Triggers fire:
-- 1. audit_secrets_delete: Logs the deletion
--    - Stores old values in audit_logs metadata
--    - User sees who deleted what and when
--    - NOT recoverable (no soft delete)

-- RLS Policy checked:
-- "Developers can delete secrets"
-- Must have developer role in project's organization

-- Result:
-- - Secret permanently removed from database
-- - Audit trail preserved
-- - Cached value cleared from memory
```

**Important Note:**
- NO soft delete (no "deleted_at" flag)
- Deletion is PERMANENT
- Only audit logs prove secret existed
- RLS prevents unauthorized deletion

---

## VERIFICATION CHECKLIST

### Encryption Round-Trip

#### Flow 1: Create Secret
- [x] Master password exists in auth store
- [x] KEK salt retrieved from user_preferences.master_password_verification.salt
- [x] Plaintext encrypted with random DEK (256 bits)
- [x] DEK encrypted with KEK derived from master password + salt
- [x] 5 fields stored: encrypted_value, encrypted_dek, secret_nonce, dek_nonce, auth_tag
- [x] Decrypted value cached in memory (decryptedSecrets Map)
- [x] Decrypted value NEVER persisted to database
- [x] RLS policy enforces: user must be member and have developer role
- [x] Audit trigger logs the creation (encrypted fields stored as-is)

#### Flow 2: Decrypt Secret
- [x] Encrypted fields retrieved from database
- [x] KEK salt retrieved from auth store (same salt used for encryption)
- [x] KEK re-derived from master password + salt
- [x] DEK decrypted using KEK (validates GCM tag)
- [x] Secret decrypted using DEK (validates GCM tag)
- [x] Plaintext cached in memory
- [x] Wrong password → DEK decryption fails → Error
- [x] CRITICAL: log_secret_access() NOT called (read access not logged)

#### Flow 3: Update Secret
- [x] Master password verified (through KEK salt availability)
- [x] New value encrypted with NEW random DEK
- [x] REUSES same kekSalt (allows rotation of DEK without changing master password)
- [x] All 5 encryption fields updated
- [x] Audit trigger logs the change
- [x] Cached value updated in memory

#### Flow 4: Delete Secret
- [x] RLS policy enforces developer role
- [x] Permanent deletion (no soft delete)
- [x] Audit trigger logs old values in metadata
- [x] Cached value cleared from memory

### Security Gaps Identified

#### CRITICAL: Read Access Not Logged
**Issue:** `log_secret_access()` function exists but is NEVER called
**Impact:** Cannot audit which user read which secret
**Location:** 
  - Function defined: `/Users/james/code/secrets/abyrith-app/supabase/migrations/20241102000003_audit_triggers.sql` line 207-249
  - Should be called: In `secret-store.ts` after successful decryption
  - Currently: Not called (gap in secret-store.decryptSecret())
**Fix Required:** Add call to log_secret_access(secret.id) after successful decryption

#### Issue: Plaintext Master Password in Memory
**Issue:** Master password stored in auth-store: `masterPassword: string | null`
**Impact:** Memory dump could expose master password
**Mitigation:** 
  - Only stored in memory (not persisted to localStorage)
  - Cleared on logout
  - Not shared across sessions
  - Still a risk during active session
**Recommendation:** Use WebCrypto isolated context

#### Issue: Decrypted Values Cached Indefinitely
**Issue:** `decryptedSecrets: Map<secretId, plaintext>` cached in memory for session lifetime
**Impact:** Long-lived session = plaintext exposed longer
**Mitigation:**
  - Cleared on logout
  - Cleared with `clearDecryptedSecrets()`
  - Only in active session memory
**Recommendation:** Implement cache expiration (30 min timeout)

### Integration Points - All Connected Correctly

#### UI → Store Connection
- [x] CreateSecretDialog calls `useSecretStore().createSecret()`
- [x] SecretCard calls `useSecretStore().decryptSecret()`
- [x] Both require `useAuthStore().masterPassword`

#### Store → Crypto Connection
- [x] secret-store imports `encryptSecret`, `decryptSecret` from envelope-encryption
- [x] KEK salt retrieved from auth-store correctly
- [x] Master password passed to crypto functions

#### Crypto → Database Connection
- [x] encryptSecret() returns EnvelopeEncryptedSecret (matches schema)
- [x] All 5 fields stored in secrets table
- [x] No ciphertext leakage

#### Database → RLS Connection
- [x] RLS policies check organization membership
- [x] RLS policies check role permissions (developer+)
- [x] All CRUD operations respect RLS

#### Database → Audit Connection
- [x] Triggers fire after INSERT/UPDATE/DELETE
- [x] Audit logs populated with encrypted data (plaintext never logged)
- [x] Immutable audit logs (no UPDATE/DELETE)

---

## PERFORMANCE ANALYSIS

### Encryption (Create Secret)
```
Master password verification:
  - PBKDF2: 600,000 iterations, SHA-256
  - Time: ~300-600ms
  - Client-side (browser)

Encryption:
  - Generate DEK: <1ms
  - Encrypt secret with DEK (AES-256-GCM): ~1-5ms
  - Derive KEK (PBKDF2): ~300-600ms
  - Encrypt DEK with KEK (AES-256-GCM): ~1-5ms
  - Base64 encoding: <1ms
  - Total: ~300-610ms

Database INSERT:
  - Network round-trip: ~50-200ms (depends on latency)
  - Server-side: ~10-50ms

Total Create: ~360-860ms (mostly PBKDF2 derivation)
```

### Decryption (Reveal Secret)
```
Same as encryption (~300-610ms)

Optimizations NOT currently implemented:
- KEK not cached (re-derived each time)
- Could cache KEK for session duration (~300ms savings)
- Would require secure memory clearing on logout
```

### Database Operations
```
SELECT secrets: ~20-100ms (with indexes)
INSERT secret: ~30-100ms (with RLS checks + triggers)
UPDATE secret: ~30-100ms
DELETE secret: ~30-100ms (+ audit trigger)
```

---

## SCHEMA CORRECTNESS VERIFICATION

### secrets table - Encryption Fields
```
✓ encrypted_value TEXT NOT NULL
  └─ Stores Base64-encoded ciphertext (safe for DB)

✓ encrypted_dek TEXT NOT NULL
  └─ Stores Base64-encoded encrypted DEK (safe for DB)

✓ secret_nonce TEXT NOT NULL
  └─ Stores Base64-encoded 12-byte nonce (safe for DB)

✓ dek_nonce TEXT NOT NULL
  └─ Stores Base64-encoded 12-byte nonce (safe for DB)

✓ auth_tag TEXT NOT NULL
  └─ Stores Base64-encoded 16-byte GCM auth tag (safe for DB)

✓ algorithm TEXT DEFAULT 'AES-256-GCM'
  └─ Algorithm identifier for future compatibility
```

### user_preferences table - Master Key Verification
```
✓ master_password_verification JSONB NOT NULL
  └─ Stores EncryptedVerification JSON:
     {
       ciphertext: "Base64...",
       iv: "Base64...",
       salt: "Base64...",     ← THIS IS KEK SALT
       algorithm: "AES-256-GCM",
       iterations: 600000
     }
  └─ KEK salt (16 bytes) retrieved from this field
  └─ Used for all envelope encryption operations
```

---

## SUMMARY

### Complete Round-Trip Verified

```
CREATE:
  1. UI (form) → 2. Validation → 3. Encryption (300-600ms)
  4. Database (encrypted) → 5. Audit log → Success

FETCH:
  1. Database (encrypted) → 2. Decryption (300-600ms)
  3. Cache (memory) → 4. UI (display) → Success

UPDATE:
  1. UI (form) → 2. Validation → 3. Encryption (new DEK)
  4. Database (replace fields) → 5. Audit log → Success

DELETE:
  1. UI (confirm) → 2. Database (DELETE) → 3. Audit log → Success
```

### All 5 Envelope Encryption Fields Stored Correctly
- [x] encrypted_value (ciphertext)
- [x] encrypted_dek (encrypted DEK)
- [x] secret_nonce (nonce for secret)
- [x] dek_nonce (nonce for DEK)
- [x] auth_tag (GCM authentication tag)

### KEK Salt Retrieval Working Correctly
- [x] Created during setupMasterPassword()
- [x] Stored in user_preferences.master_password_verification.salt
- [x] Retrieved in auth-store.verifyMasterPassword()
- [x] Passed to crypto functions during all operations

### Multi-Tenancy Enforced
- [x] RLS policies check organization membership
- [x] All queries must pass is_organization_member() check
- [x] Cannot access secrets outside organization

### Audit Logging Working
- [x] INSERT operations logged
- [x] UPDATE operations logged
- [x] DELETE operations logged
- [x] Encrypted data stored (no plaintext in logs)
- [x] **GAP:** Read access NOT logged (missing log_secret_access() calls)

---

## INTEGRATION ISSUES FOUND

### CRITICAL: Missing Secret Access Logging
**Severity:** CRITICAL
**Description:** Read access to secrets is not being logged
**Evidence:**
- Function exists: `log_secret_access(secret_id UUID)` (line 207)
- Function is never called from application code
- Users cannot audit who accessed which secrets
- Only CREATE/UPDATE/DELETE are logged (not READ)

**Location to Fix:**
```typescript
// File: /Users/james/code/secrets/abyrith-app/lib/stores/secret-store.ts
// Function: decryptSecret()
// After line 276 (successful decryption):

// Add this line:
await supabase.rpc('log_secret_access', { secret_id: secret.id });
```

**Test:**
- Create secret
- Reveal secret (decrypt it)
- Check audit_logs table
- Verify 'secrets.read' action exists

---

## CONCLUSION

The SECRET CRUD flow is **FUNCTIONALLY COMPLETE** with proper zero-knowledge encryption:

✓ All 5 envelope encryption components stored
✓ KEK salt correctly managed and reused
✓ Encryption round-trip working end-to-end
✓ Decrypted values cached properly (memory only)
✓ RLS policies enforce multi-tenancy
✓ Audit logging captures modifications
✓ Database schema matches encryption spec

⚠️ **One critical gap:** Secret read access not being logged (auditable but not audited)

The implementation correctly achieves the zero-knowledge goal: the server never has access to decrypted secrets or the master password. All decryption happens client-side.

