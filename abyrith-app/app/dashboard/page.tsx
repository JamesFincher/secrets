'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { useProjectStore } from '@/lib/stores/project-store';
import { useSecretStore } from '@/lib/stores/secret-store';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { CreateSecretDialog } from '@/components/secrets/create-secret-dialog';
import { SecretCard } from '@/components/secrets/secret-card';

export default function DashboardPage() {
  const router = useRouter();
  const { user, preferences, isAuthenticated, hasMasterPassword, signOut } = useAuth();
  const {
    organizations,
    currentOrganization,
    projects,
    currentProject,
    environments,
    isLoading,
    loadOrganizations,
    createOrganization,
    setCurrentProject,
  } = useProjectStore();
  const { secrets, loadSecrets } = useSecretStore();

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateSecret, setShowCreateSecret] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin');
    } else if (!preferences) {
      router.push('/auth/setup-master-password');
    } else if (!hasMasterPassword) {
      router.push('/auth/unlock');
    }
  }, [isAuthenticated, preferences, hasMasterPassword, router]);

  useEffect(() => {
    if (user && isAuthenticated) {
      loadOrganizations(user.id);
    }
  }, [user, isAuthenticated, loadOrganizations]);

  useEffect(() => {
    // Auto-create organization for new users
    if (user && organizations.length === 0 && !currentOrganization) {
      createOrganization(`${user.email}'s Workspace`, user.id).catch((error) => {
        console.error('Failed to create organization:', error);
        setOrgError(error instanceof Error ? error.message : 'Failed to create workspace');
      });
    }
  }, [user, organizations, currentOrganization, createOrganization]);

  useEffect(() => {
    if (environments.length > 0 && !selectedEnvironmentId) {
      setSelectedEnvironmentId(environments[0].id);
    }
  }, [environments]);

  useEffect(() => {
    if (selectedEnvironmentId) {
      loadSecrets(selectedEnvironmentId);
    }
  }, [selectedEnvironmentId, loadSecrets]);

  if (!user || !preferences || !hasMasterPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const selectedEnvironment = environments.find((e) => e.id === selectedEnvironmentId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Abyrith</h1>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/ai">
              <Button variant="outline" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                AI Assistant
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Organization Error */}
          {orgError && (
            <div className="mb-4 bg-destructive/15 text-destructive px-4 py-3 rounded-md">
              <p className="font-semibold">Workspace Setup Failed</p>
              <p className="text-sm mt-1">{orgError}</p>
              <p className="text-sm mt-2">Try refreshing the page or contact support if the issue persists.</p>
            </div>
          )}

          {/* Project Selector */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Projects</h2>
              <Button
                onClick={() => setShowCreateProject(true)}
                disabled={!currentOrganization || isLoading}
              >
                {isLoading ? 'Loading...' : 'Create Project'}
              </Button>
            </div>

            {isLoading && !currentOrganization ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">
                  Setting up your workspace...
                </p>
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No projects yet. Create your first project to start managing secrets.
                </p>
                <Button
                  onClick={() => setShowCreateProject(true)}
                  disabled={!currentOrganization || isLoading}
                >
                  {isLoading ? 'Loading...' : 'Create Your First Project'}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setCurrentProject(project)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      currentProject?.id === project.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Environment Tabs */}
          {currentProject && environments.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3">Environment</h3>
              <div className="flex gap-2 border-b">
                {environments.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => setSelectedEnvironmentId(env.id)}
                    className={`px-4 py-2 border-b-2 transition-colors ${
                      selectedEnvironmentId === env.id
                        ? 'border-primary text-primary font-semibold'
                        : 'border-transparent hover:border-muted-foreground text-muted-foreground'
                    }`}
                  >
                    {env.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Secrets List */}
          {currentProject && selectedEnvironment && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  Secrets in {selectedEnvironment.name}
                </h3>
                <Button
                  onClick={() => setShowCreateSecret(true)}
                >
                  Add Secret
                </Button>
              </div>

              {secrets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    No secrets in this environment yet.
                  </p>
                  <Button onClick={() => setShowCreateSecret(true)}>
                    Add Your First Secret
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {secrets.map((secret) => (
                    <SecretCard key={secret.id} secret={secret} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No Project Selected */}
          {!currentProject && projects.length > 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                Select a project above to view and manage secrets.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showCreateProject && currentOrganization && (
        <CreateProjectDialog
          organizationId={currentOrganization.id}
          onClose={() => setShowCreateProject(false)}
        />
      )}

      {showCreateSecret && currentProject && selectedEnvironmentId && (
        <CreateSecretDialog
          projectId={currentProject.id}
          environmentId={selectedEnvironmentId}
          onClose={() => setShowCreateSecret(false)}
        />
      )}
    </div>
  );
}
