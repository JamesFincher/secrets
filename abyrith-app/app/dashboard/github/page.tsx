'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getGitHubConnection } from '@/lib/api/github';
import { GitHubConnectionStatus } from '@/components/github/github-connection-status';
import { GitHubConnectButton } from '@/components/github/github-connect-button';
import { GitHubRepositoryBrowser } from '@/components/github/github-repository-browser';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Github, Database, History, Settings } from 'lucide-react';

export default function GitHubPage() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    try {
      setIsLoading(true);
      const connection = await getGitHubConnection();
      setIsConnected(!!connection);
    } catch (error) {
      console.error('Failed to check GitHub connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Please sign in to access GitHub integration</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Github className="w-8 h-8" />
              GitHub Integration
            </h1>
            <p className="text-muted-foreground mt-1">
              Connect your GitHub repositories and sync secrets
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card className="p-8 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Checking connection status...</p>
            </div>
          </Card>
        )}

        {/* Not Connected State */}
        {!isLoading && !isConnected && (
          <Card className="p-8">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Github className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Connect Your GitHub Account</h2>
                <p className="text-muted-foreground">
                  Link your GitHub repositories to automatically detect and import secrets from
                  your code. We use zero-knowledge encryption to keep your tokens secure.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div className="p-4 border rounded-lg">
                    <Database className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold mb-1">Auto-detect Secrets</h3>
                    <p className="text-sm text-muted-foreground">
                      Scan .env files, GitHub Actions, and config files
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <Github className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold mb-1">Sync Repositories</h3>
                    <p className="text-sm text-muted-foreground">
                      Link repos to projects and keep secrets in sync
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <Settings className="w-6 h-6 text-primary mb-2" />
                    <h3 className="font-semibold mb-1">Zero-Knowledge</h3>
                    <p className="text-sm text-muted-foreground">
                      Tokens encrypted with your master password
                    </p>
                  </div>
                </div>
                <GitHubConnectButton onConnect={checkConnection} />
              </div>
            </div>
          </Card>
        )}

        {/* Connected State */}
        {!isLoading && isConnected && (
          <>
            <GitHubConnectionStatus onDisconnect={checkConnection} />

            <Tabs defaultValue="repositories" className="space-y-4">
              <TabsList>
                <TabsTrigger value="repositories" className="gap-2">
                  <Github className="w-4 h-4" />
                  Repositories
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  Sync History
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="repositories" className="space-y-4">
                <GitHubRepositoryBrowser />
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card className="p-8 text-center">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sync History</h3>
                  <p className="text-muted-foreground">
                    View sync history for your linked repositories (coming soon)
                  </p>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card className="p-8 text-center">
                  <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">GitHub Settings</h3>
                  <p className="text-muted-foreground">
                    Configure sync settings and preferences (coming soon)
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
