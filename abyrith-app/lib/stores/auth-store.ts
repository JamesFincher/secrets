/**
 * Authentication Store
 *
 * Global state management for user authentication and session.
 * Uses Zustand for state management.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/api/supabase';
import {
  generateVerificationValue,
  verifyPassword,
  type EncryptedVerification,
} from '@/lib/crypto/envelope-encryption';

interface UserPreferences {
  masterPasswordVerification: EncryptedVerification;
  theme: string;
  notificationsEnabled: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  masterPassword: string | null; // Stored in memory only (never persisted)
  kekSalt: string | null; // KEK salt cached in memory for envelope encryption
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setMasterPassword: (password: string) => void;
  clearMasterPassword: () => void;
  setPreferences: (preferences: UserPreferences | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  getKEKSalt: () => string | null; // Get cached KEK salt for envelope encryption

  // Auth operations
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setupMasterPassword: (masterPassword: string) => Promise<void>;
  verifyMasterPassword: (masterPassword: string) => Promise<boolean>;
  loadUserPreferences: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      masterPassword: null,
      kekSalt: null,
      preferences: null,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setMasterPassword: (password) => set({ masterPassword: password }),
      clearMasterPassword: () => set({ masterPassword: null, kekSalt: null }),
      setPreferences: (preferences) => set({ preferences }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      getKEKSalt: () => get().kekSalt,

      /**
       * Sign in with email and password
       */
      signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          set({
            user: data.user,
            session: data.session,
            isLoading: false,
          });

          // Load user preferences after successful sign in
          await get().loadUserPreferences();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      /**
       * Sign up with email and password
       */
      signUp: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) throw error;

          set({
            user: data.user,
            session: data.session,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      /**
       * Sign out current user
       */
      signOut: async () => {
        set({ isLoading: true, error: null });

        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;

          set({
            user: null,
            session: null,
            masterPassword: null,
            kekSalt: null,
            preferences: null,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      /**
       * Set up master password for zero-knowledge encryption
       * This must be called after signup/signin for new users
       */
      setupMasterPassword: async (masterPassword: string) => {
        set({ isLoading: true, error: null });

        try {
          const user = get().user;
          if (!user) throw new Error('No user logged in');

          // Generate verification value (encrypted test data)
          const verification = await generateVerificationValue(masterPassword);

          // Save to database with KEK salt for caching
          const { error } = await (supabase
            .from('user_preferences') as any)
            .upsert({
              user_id: user.id,
              master_password_verification: verification,
              kek_salt: verification.salt, // Cache KEK salt for envelope encryption
              theme: 'system',
              notifications_enabled: true,
            });

          if (error) throw error;

          // Update state with master password and KEK salt cached
          set({
            masterPassword,
            kekSalt: verification.salt, // Cache KEK salt in memory
            preferences: {
              masterPasswordVerification: verification,
              theme: 'system',
              notificationsEnabled: true,
            },
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to setup master password';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      /**
       * Verify master password against stored verification value
       * Also caches KEK salt in memory for envelope encryption
       */
      verifyMasterPassword: async (masterPassword: string) => {
        const preferences = get().preferences;
        if (!preferences) {
          throw new Error('No user preferences found');
        }

        const isValid = await verifyPassword(
          preferences.masterPasswordVerification,
          masterPassword
        );

        if (isValid) {
          // Cache KEK salt from verification for envelope encryption
          const kekSalt = preferences.masterPasswordVerification.salt;
          set({ masterPassword, kekSalt });
        }

        return isValid;
      },

      /**
       * Load user preferences from database
       */
      loadUserPreferences: async () => {
        const user = get().user;
        if (!user) return;

        try {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error) {
            // User doesn't have preferences yet (new user)
            if (error.code === 'PGRST116') {
              set({ preferences: null });
              return;
            }
            throw error;
          }

          set({
            preferences: {
              masterPasswordVerification: (data as any).master_password_verification as EncryptedVerification,
              theme: (data as any).theme,
              notificationsEnabled: (data as any).notifications_enabled,
            },
            // Load KEK salt from database if available, otherwise use salt from verification
            kekSalt: (data as any).kek_salt || ((data as any).master_password_verification as EncryptedVerification).salt,
          });
        } catch (error) {
          console.error('Failed to load user preferences:', error);
        }
      },
    }),
    {
      name: 'abyrith-auth',
      version: 1, // Increment this to invalidate cache after DB reset
      // Only persist user and session, never the master password
      partialize: (state) => ({
        user: state.user,
        session: state.session,
      }),
    }
  )
);

/**
 * Initialize auth state listener
 * Call this once in your app root
 */
export function initAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    const store = useAuthStore.getState();

    if (event === 'SIGNED_IN' && session) {
      store.setUser(session.user);
      store.setSession(session);
      store.loadUserPreferences();
    } else if (event === 'SIGNED_OUT') {
      store.setUser(null);
      store.setSession(null);
      store.clearMasterPassword(); // Also clears kekSalt
      store.setPreferences(null);
    } else if (event === 'TOKEN_REFRESHED' && session) {
      store.setSession(session);
    }
  });
}
