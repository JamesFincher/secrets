/**
 * Cache Debugging Utilities
 *
 * Utilities to help debug and clear localStorage cache issues
 */

/**
 * Clear all Abyrith localStorage data
 * Useful after database resets or when experiencing auth issues
 */
export function clearAbyrithCache() {
  if (typeof window === 'undefined') return;

  // Clear auth store
  localStorage.removeItem('abyrith-auth');

  // Log for debugging
  console.log('✅ Abyrith cache cleared. Please refresh the page.');
}

/**
 * Check current cache state
 * Returns debug information about cached data
 */
export function debugCacheState() {
  if (typeof window === 'undefined') {
    return { error: 'Not in browser environment' };
  }

  const authCache = localStorage.getItem('abyrith-auth');

  return {
    hasAuthCache: !!authCache,
    authCache: authCache ? JSON.parse(authCache) : null,
    cacheKeys: Object.keys(localStorage).filter(k => k.startsWith('abyrith')),
  };
}

/**
 * Add to window for easy console access
 * Usage: window.clearAbyrithCache()
 */
if (typeof window !== 'undefined') {
  (window as any).clearAbyrithCache = clearAbyrithCache;
  (window as any).debugAbyrithCache = debugCacheState;
}
