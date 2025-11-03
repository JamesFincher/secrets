/**
 * Authentication Hooks
 *
 * Custom React hooks for authentication operations
 */

import { useAuthStore } from '@/lib/stores/auth-store';

export function useAuth() {
  const {
    user,
    session,
    masterPassword,
    preferences,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    setupMasterPassword,
    verifyMasterPassword,
  } = useAuthStore();

  const isAuthenticated = !!user && !!session;
  const hasMasterPassword = !!masterPassword;
  const needsMasterPasswordSetup = isAuthenticated && !preferences;

  return {
    // State
    user,
    session,
    masterPassword,
    preferences,
    isLoading,
    error,
    isAuthenticated,
    hasMasterPassword,
    needsMasterPasswordSetup,

    // Actions
    signIn,
    signUp,
    signOut,
    setupMasterPassword,
    verifyMasterPassword,
  };
}

/**
 * Hook to require authentication
 * Redirects to sign in if not authenticated
 */
export function useRequireAuth() {
  const auth = useAuth();

  if (!auth.isAuthenticated && typeof window !== 'undefined') {
    window.location.href = '/auth/signin';
  }

  return auth;
}

/**
 * Hook to require master password
 * Shows master password prompt if not unlocked
 */
export function useRequireMasterPassword() {
  const auth = useRequireAuth();

  return {
    ...auth,
    isUnlocked: auth.hasMasterPassword,
  };
}
