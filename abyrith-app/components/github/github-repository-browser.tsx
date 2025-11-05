'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  listGitHubRepositories,
  getLinkedRepositories,
  linkGitHubRepository,
  unlinkGitHubRepository,
  type GitHubRepository,
  type LinkedRepository,
} from '@/lib/api/github';
import { useAuth } from '@/lib/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Github,
  Search,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  Lock,
  Globe,
  RefreshCw,
} from 'lucide-react';

export function GitHubRepositoryBrowser() {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [linkedRepos, setLinkedRepos] = useState<LinkedRepository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const { masterPassword, preferences } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [page]);

  async function loadData(password?: string, prefs?: any) {
    const pwd = password || masterPassword;
    const userPrefs = prefs || preferences;

    if (!pwd || !userPrefs) {
      // Need password - show prompt
      setIsLoading(false);
      setNeedsPassword(true);
      return;
    }

    try {
      setIsLoading(true);
      setNeedsPassword(false);

      // Load repositories and linked repos in parallel
      const kekSalt = userPrefs.masterPasswordVerification.salt;
      const [reposData, linkedData] = await Promise.all([
        listGitHubRepositories(pwd, kekSalt, page, 30),
        getLinkedRepositories(),
      ]);

      // Mark repos as linked
      const reposWithLinkStatus = reposData.repos.map((repo) => ({
        ...repo,
        linked: linkedData.some((linked) => linked.github_repo_id === repo.id),
      }));

      setRepositories(reposWithLinkStatus);
      setLinkedRepos(linkedData);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load repositories',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLinkRepository(repo: GitHubRepository) {
    if (!masterPassword || !preferences) {
      toast({
        title: 'Master Password Required',
        description: 'Please unlock your vault to link repositories',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLinking(repo.id);
      const kekSalt = preferences.masterPasswordVerification.salt;

      // For now, create a new project for each repo
      // TODO: Add UI to select existing project or create new
      await linkGitHubRepository(
        repo.id,
        repo.owner,
        repo.name,
        repo.url,
        'create_project',
        repo.name,
        null,
        null,
        false,
        masterPassword,
        kekSalt
      );

      toast({
        title: 'Repository Linked',
        description: `${repo.full_name} has been linked to a new project`,
      });

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Failed to link repository:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to link repository',
        variant: 'destructive',
      });
    } finally {
      setIsLinking(null);
    }
  }

  async function handleUnlinkRepository(repoId: string) {
    if (!masterPassword || !preferences) {
      toast({
        title: 'Master Password Required',
        description: 'Please unlock your vault to unlink repositories',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Are you sure you want to unlink this repository?')) {
      return;
    }

    try {
      const kekSalt = preferences.masterPasswordVerification.salt;
      await unlinkGitHubRepository(repoId, masterPassword, kekSalt);

      toast({
        title: 'Repository Unlinked',
        description: 'Repository has been unlinked from the project',
      });

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Failed to unlink repository:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unlink repository',
        variant: 'destructive',
      });
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsVerifying(true);

    try {
      // Import auth hook to get verifyMasterPassword function
      const { useAuthStore } = await import('@/lib/stores/auth-store');
      const authStore = useAuthStore.getState();

      // Use the auth store's verifyMasterPassword which stores the password
      const isValid = await authStore.verifyMasterPassword(passwordInput);

      if (!isValid) {
        toast({
          title: 'Incorrect Password',
          description: 'The master password you entered is incorrect',
          variant: 'destructive',
        });
        setIsVerifying(false);
        return;
      }

      // Load repositories with verified password
      // After verifyMasterPassword succeeds, masterPassword is now in the auth store
      await loadData(passwordInput, authStore.preferences);
      setPasswordInput('');
    } catch (error) {
      console.error('Password verification error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to verify password',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  }

  const filteredRepos = repositories.filter((repo) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      repo.full_name.toLowerCase().includes(query) ||
      repo.description?.toLowerCase().includes(query) ||
      repo.language?.toLowerCase().includes(query)
    );
  });

  // Show password prompt if needed
  if (needsPassword) {
    return (
      <Card className="p-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Master Password Required</h2>
            <p className="text-muted-foreground">
              Enter your master password to decrypt your GitHub token and access repositories
            </p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your master password"
                required
                autoFocus
                disabled={isVerifying}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isVerifying}>
              {isVerifying ? 'Verifying...' : 'Unlock'}
            </Button>
          </form>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-10 h-10 rounded bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-48 animate-pulse" />
                <div className="h-3 bg-muted rounded w-64 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Linked Repositories Section */}
      {linkedRepos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Linked Repositories</h3>
          <div className="space-y-2">
            {linkedRepos.map((linked) => (
              <Card key={linked.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Github className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{linked.repo_owner}/{linked.repo_name}</h4>
                        <Badge variant="default" className="gap-1">
                          <LinkIcon className="w-3 h-3" />
                          Linked
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Project ID: {linked.abyrith_project_uuid}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(linked.repo_url, '_blank')}
                      className="gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlinkRepository(linked.id)}
                      className="gap-2"
                    >
                      <Unlink className="w-4 h-4" />
                      Unlink
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Repositories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            All Repositories ({filteredRepos.length})
          </h3>
          <Button variant="ghost" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {filteredRepos.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? `No repositories match "${searchQuery}"` : 'No repositories found'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredRepos.map((repo) => (
              <Card key={repo.id} className="p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {repo.private ? (
                        <Lock className="w-5 h-5 text-primary" />
                      ) : (
                        <Globe className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium truncate">{repo.full_name}</h4>
                        {repo.private && (
                          <Badge variant="secondary" className="text-xs">
                            Private
                          </Badge>
                        )}
                        {repo.language && (
                          <Badge variant="outline" className="text-xs">
                            {repo.language}
                          </Badge>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {repo.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(repo.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(repo.url, '_blank')}
                      className="gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    {repo.linked ? (
                      <Badge variant="default" className="gap-1">
                        <LinkIcon className="w-3 h-3" />
                        Linked
                      </Badge>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleLinkRepository(repo)}
                        disabled={isLinking === repo.id}
                        className="gap-2"
                      >
                        <LinkIcon className="w-4 h-4" />
                        {isLinking === repo.id ? 'Linking...' : 'Link'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {repositories.length >= 30 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={repositories.length < 30}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
