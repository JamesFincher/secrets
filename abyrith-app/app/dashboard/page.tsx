'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useProjectStore } from '@/lib/stores/project-store';
import { useSecretStore } from '@/lib/stores/secret-store';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { CreateSecretDialog } from '@/components/secrets/create-secret-dialog';
import { SecretCard } from '@/components/secrets/secret-card';

export default function DashboardPage() {
  const { user } = useAuth();
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
    if (user) {
      loadOrganizations(user.id);
    }
  }, [user, loadOrganizations]);

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

  const selectedEnvironment = environments.find((e) => e.id === selectedEnvironmentId);

  return (
    <div className="min-h-screen p-8">
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
