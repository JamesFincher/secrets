/**
 * Secret Management Store
 *
 * Manages secrets with client-side encryption/decryption
 */

import { create } from 'zustand';
import { supabase } from '@/lib/api/supabase';
import {
  encryptSecret,
  decryptSecret,
  type EnvelopeEncryptedSecret,
} from '@/lib/crypto/envelope-encryption';
import { useAuthStore } from './auth-store';
import type { Tables } from '@/lib/api/supabase';
import type { Database } from '@/types/database';

type Secret = Tables<'secrets'>;

interface DecryptedSecret extends Omit<Secret, 'encrypted_value'> {
  value: string; // Decrypted plaintext value
}

interface SecretState {
  secrets: Secret[];
  decryptedSecrets: Map<string, string>; // secretId -> decrypted value
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSecrets: (environmentId: string) => Promise<void>;
  createSecret: (
    projectId: string,
    environmentId: string,
    key: string,
    value: string,
    masterPassword: string,
    metadata?: {
      description?: string;
      serviceName?: string;
      tags?: string[];
    }
  ) => Promise<Secret>;
  updateSecret: (
    secretId: string,
    value: string,
    masterPassword: string,
    metadata?: {
      description?: string;
      serviceName?: string;
      tags?: string[];
    }
  ) => Promise<void>;
  deleteSecret: (secretId: string) => Promise<void>;
  decryptSecret: (secret: Secret, masterPassword: string) => Promise<string>;
  getDecryptedSecret: (secretId: string) => string | null;
  clearDecryptedSecrets: () => void;
}

export const useSecretStore = create<SecretState>((set, get) => ({
  secrets: [],
  decryptedSecrets: new Map(),
  isLoading: false,
  error: null,

  /**
   * Load all secrets for an environment
   */
  loadSecrets: async (environmentId: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('secrets')
        .select('*')
        .eq('environment_id', environmentId)
        .order('key', { ascending: true });

      if (error) throw error;

      set({ secrets: data || [], isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load secrets';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Create a new encrypted secret
   */
  createSecret: async (
    projectId: string,
    environmentId: string,
    key: string,
    value: string,
    masterPassword: string,
    metadata = {}
  ) => {
    set({ isLoading: true, error: null });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get KEK salt from auth store
      const kekSalt = useAuthStore.getState().getKEKSalt();
      if (!kekSalt) {
        throw new Error('Master password session expired. Please verify your master password.');
      }

      // Encrypt the secret value using envelope encryption
      const encrypted = await encryptSecret(value, masterPassword, kekSalt);

      const { data: secret, error } = await (supabase
        .from('secrets') as any)
        .insert({
          project_id: projectId,
          environment_id: environmentId,
          key,
          // Envelope encryption fields
          encrypted_value: encrypted.encrypted_value,
          encrypted_dek: encrypted.encrypted_dek,
          secret_nonce: encrypted.secret_nonce,
          dek_nonce: encrypted.dek_nonce,
          auth_tag: encrypted.auth_tag,
          algorithm: encrypted.algorithm,
          // Metadata fields
          description: metadata.description,
          service_name: metadata.serviceName,
          system_id: metadata.systemId || null,
          tags: metadata.tags || [],
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        secrets: [...state.secrets, secret],
        isLoading: false,
      }));

      // Store decrypted value in memory
      const newDecrypted = new Map(get().decryptedSecrets);
      newDecrypted.set(secret.id, value);
      set({ decryptedSecrets: newDecrypted });

      return secret;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create secret';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Update an existing secret
   */
  updateSecret: async (
    secretId: string,
    value: string,
    masterPassword: string,
    metadata = {}
  ) => {
    set({ isLoading: true, error: null });

    try {
      // Get KEK salt from auth store
      const kekSalt = useAuthStore.getState().getKEKSalt();
      if (!kekSalt) {
        throw new Error('Master password session expired. Please verify your master password.');
      }

      // Encrypt the new value using envelope encryption
      const encrypted = await encryptSecret(value, masterPassword, kekSalt);

      const updateData: Database['public']['Tables']['secrets']['Update'] = {
        // Envelope encryption fields
        encrypted_value: encrypted.encrypted_value,
        encrypted_dek: encrypted.encrypted_dek,
        secret_nonce: encrypted.secret_nonce,
        dek_nonce: encrypted.dek_nonce,
        auth_tag: encrypted.auth_tag,
        algorithm: encrypted.algorithm,
      };

      if (metadata.description !== undefined) {
        updateData.description = metadata.description;
      }
      if (metadata.serviceName !== undefined) {
        updateData.service_name = metadata.serviceName;
      }
      if (metadata.tags !== undefined) {
        updateData.tags = metadata.tags;
      }

      const { error } = await supabase
        .from('secrets')
        .update(updateData as never)
        .eq('id', secretId);

      if (error) throw error;

      // Update local state
      set((state) => ({
        secrets: state.secrets.map((s) =>
          s.id === secretId
            ? { ...s, ...updateData }
            : s
        ),
        isLoading: false,
      }));

      // Update decrypted value in memory
      const newDecrypted = new Map(get().decryptedSecrets);
      newDecrypted.set(secretId, value);
      set({ decryptedSecrets: newDecrypted });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update secret';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Delete a secret
   */
  deleteSecret: async (secretId: string) => {
    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase
        .from('secrets')
        .delete()
        .eq('id', secretId);

      if (error) throw error;

      set((state) => {
        const newDecrypted = new Map(state.decryptedSecrets);
        newDecrypted.delete(secretId);

        return {
          secrets: state.secrets.filter((s) => s.id !== secretId),
          decryptedSecrets: newDecrypted,
          isLoading: false,
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete secret';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Decrypt a secret value
   */
  decryptSecret: async (secret: Secret, masterPassword: string) => {
    try {
      // Get KEK salt from auth store
      const kekSalt = useAuthStore.getState().getKEKSalt();
      if (!kekSalt) {
        throw new Error('Master password session expired. Please verify your master password.');
      }

      // Construct envelope encrypted secret from database fields
      const envelopeEncrypted: EnvelopeEncryptedSecret = {
        encrypted_value: secret.encrypted_value,
        encrypted_dek: secret.encrypted_dek,
        secret_nonce: secret.secret_nonce,
        dek_nonce: secret.dek_nonce,
        auth_tag: secret.auth_tag,
        algorithm: secret.algorithm as 'AES-256-GCM',
      };

      const decryptedValue = await decryptSecret(envelopeEncrypted, masterPassword, kekSalt);

      // Store in memory for quick access
      const newDecrypted = new Map(get().decryptedSecrets);
      newDecrypted.set(secret.id, decryptedValue);
      set({ decryptedSecrets: newDecrypted });

      return decryptedValue;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Decryption failed';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get a decrypted secret from memory
   */
  getDecryptedSecret: (secretId: string) => {
    return get().decryptedSecrets.get(secretId) || null;
  },

  /**
   * Clear all decrypted secrets from memory
   */
  clearDecryptedSecrets: () => {
    set({ decryptedSecrets: new Map() });
  },
}));
