'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { initGitHubOAuth } from '@/lib/api/github';
import { useToast } from '@/hooks/use-toast';
import { Github } from 'lucide-react';

interface GitHubConnectButtonProps {
  onConnect?: () => void;
}

export function GitHubConnectButton({ onConnect }: GitHubConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  async function handleConnect() {
    try {
      setIsConnecting(true);

      // Get the redirect URI (current origin + callback path)
      const redirectUri = `${window.location.origin}/dashboard/github/callback`;

      // Initialize OAuth flow
      const { oauth_url, state } = await initGitHubOAuth(redirectUri);

      // Store state in sessionStorage for verification
      sessionStorage.setItem('github_oauth_state', state);

      // Redirect to GitHub OAuth page
      window.location.href = oauth_url;

      onConnect?.();
    } catch (error) {
      console.error('Failed to initialize GitHub OAuth:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to connect to GitHub',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      size="lg"
      className="gap-2"
    >
      <Github className="w-5 h-5" />
      {isConnecting ? 'Connecting...' : 'Connect GitHub'}
    </Button>
  );
}
