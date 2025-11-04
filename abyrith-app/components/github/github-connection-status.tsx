'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getGitHubConnection, disconnectGitHub, type GitHubConnection } from '@/lib/api/github';
import { useToast } from '@/hooks/use-toast';
import { Github, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface GitHubConnectionStatusProps {
  onDisconnect?: () => void;
}

export function GitHubConnectionStatus({ onDisconnect }: GitHubConnectionStatusProps) {
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConnection();
  }, []);

  async function loadConnection() {
    try {
      setIsLoading(true);
      const conn = await getGitHubConnection();
      setConnection(conn);
    } catch (error) {
      console.error('Failed to load GitHub connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to load GitHub connection status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect GitHub? This will unlink all repositories.')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      await disconnectGitHub();
      setConnection(null);
      toast({
        title: 'GitHub Disconnected',
        description: 'Your GitHub account has been disconnected',
      });
      onDisconnect?.();
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect GitHub',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-32 animate-pulse" />
            <div className="h-3 bg-muted rounded w-48 animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  if (!connection) {
    return null;
  }

  const isExpired = connection.token_expires_at
    ? new Date(connection.token_expires_at) < new Date()
    : false;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Github className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">GitHub Connected</h3>
              {isExpired ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Token Expired
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1 bg-green-500">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Account:</span> {connection.github_username}
              </p>
              {connection.github_email && (
                <p>
                  <span className="font-medium">Email:</span> {connection.github_email}
                </p>
              )}
              <p>
                <span className="font-medium">Connected:</span>{' '}
                {new Date(connection.connected_at).toLocaleDateString()}
              </p>
              {connection.last_used_at && (
                <p>
                  <span className="font-medium">Last used:</span>{' '}
                  {new Date(connection.last_used_at).toLocaleDateString()}
                </p>
              )}
              <p>
                <span className="font-medium">Scopes:</span>{' '}
                {connection.token_scope.join(', ')}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="gap-2"
        >
          <XCircle className="w-4 h-4" />
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </Button>
      </div>

      {isExpired && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">
            Your GitHub token has expired. Please disconnect and reconnect to refresh your access.
          </p>
        </div>
      )}
    </Card>
  );
}
