'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getGitHubConnection, getLinkedRepositories } from '@/lib/api/github';
import { Github, ExternalLink, Link as LinkIcon } from 'lucide-react';

export function GitHubQuickAccess() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [linkedRepoCount, setLinkedRepoCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGitHubStatus();
  }, []);

  async function loadGitHubStatus() {
    try {
      const [connection, linkedRepos] = await Promise.all([
        getGitHubConnection(),
        getLinkedRepositories().catch(() => []),
      ]);

      setIsConnected(!!connection);
      setLinkedRepoCount(linkedRepos.length);
    } catch (error) {
      console.error('Failed to load GitHub status:', error);
      setIsConnected(false);
      setLinkedRepoCount(0);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return null; // Don't show card while loading
  }

  return (
    <Card className="p-4 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => router.push('/dashboard/github')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Github className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              GitHub Integration
              {isConnected && (
                <Badge variant="default" className="text-xs">
                  Connected
                </Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isConnected
                ? linkedRepoCount > 0
                  ? `${linkedRepoCount} ${linkedRepoCount === 1 ? 'repository' : 'repositories'} linked`
                  : 'No repositories linked yet'
                : 'Connect to sync repositories'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push('/dashboard/github');
          }}
          className="gap-2"
        >
          {isConnected ? (
            <>
              <ExternalLink className="w-4 h-4" />
              Manage
            </>
          ) : (
            <>
              <LinkIcon className="w-4 h-4" />
              Connect
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
