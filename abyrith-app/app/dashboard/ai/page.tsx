'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { ChatInterface } from '@/components/ai/ChatInterface';

/**
 * AI Assistant Page
 *
 * Full-screen AI chat interface for secrets management assistance
 */
export default function AIAssistantPage() {
  const router = useRouter();
  const { user, preferences, isAuthenticated, hasMasterPassword } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin');
    } else if (!preferences) {
      router.push('/auth/setup-master-password');
    } else if (!hasMasterPassword) {
      router.push('/auth/unlock');
    }
  }, [isAuthenticated, preferences, hasMasterPassword, router]);

  if (!user || !preferences || !hasMasterPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <ChatInterface />;
}
