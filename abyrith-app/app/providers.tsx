'use client';

/**
 * App Providers
 *
 * Wraps the app with necessary providers (React Query, Auth, etc.)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { initAuthListener } from '@/lib/stores/auth-store';
import { Toaster } from '@/components/ui/toaster';
import '@/lib/utils/cache-debug'; // Load cache debugging utilities

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Initialize auth listener
    initAuthListener();
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
