'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useProjectStore } from '@/lib/stores/project-store';
import { useSecretStore } from '@/lib/stores/secret-store';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { CreateSecretDialog } from '@/components/secrets/create-secret-dialog';
import { SecretCard } from '@/components/secrets/secret-card';
import { Breadcrumb } from '@/components/dashboard/breadcrumb';

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    organizations,
    currentOrganization,
    projects,
    currentProject,
    environments,
    systems,
    isLoading,
    loadOrganizations,
    createOrganization,
    setCurrentProject,
    loadSystems,
  } = useProjectStore();
  const { secrets, loadSecrets } = useSecretStore();

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateSecret, setShowCreateSecret] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadOrganizations(user.id);
    }
  }, [user, loadOrganizations]);

  useEffect(() => {
    // Auto-create organization for new users
    // Only try to create if we've finished loading and there are truly no orgs
    if (user && !isLoading && organizations.length === 0 && !currentOrganization && !orgError) {
      createOrganization(`${user.email}'s Workspace`, user.id).catch((error) => {
        console.error('Failed to create organization:', error);
        // Only show error if it's not a duplicate slug error (org already exists)
        if (error?.code !== '23505') {
          setOrgError(error instanceof Error ? error.message : 'Failed to create workspace');
        } else {
          // Org exists, just reload to get it
          loadOrganizations(user.id);
        }
      });
    }
  }, [user, isLoading, organizations, currentOrganization, createOrganization, orgError, loadOrganizations]);

  useEffect(() => {
    if (currentProject) {
      loadSystems(currentProject.id);
      setSelectedSystemId(null); // Reset system selection when project changes
    }
  }, [currentProject, loadSystems]);

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
  const selectedSystem = systems.find((s) => s.id === selectedSystemId);

  // Filter secrets by selected system
  const filteredSecrets = selectedSystemId
    ? secrets.filter((s) => s.system_id === selectedSystemId)
    : secrets;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Breadcrumb
              currentSystem={selectedSystem ? { id: selectedSystem.id, name: selectedSystem.name } : undefined}
              currentEnvironment={selectedEnvironment ? { id: selectedEnvironment.id, name: selectedEnvironment.name } : undefined}
            />
          </div>

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

          {/* Systems Filter */}
          {currentProject && systems.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Filter by System</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSystemId(null)}
                  className="text-xs"
                >
                  Clear Filter
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedSystemId(null)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    selectedSystemId === null
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  All Systems
                </button>
                {systems.map((system) => (
                  <button
                    key={system.id}
                    onClick={() => setSelectedSystemId(system.id)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors flex items-center gap-2 ${
                      selectedSystemId === system.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {system.icon && <span>{system.icon}</span>}
                    <span>{system.name}</span>
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

              {filteredSecrets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    {selectedSystemId
                      ? 'No secrets found for this system in this environment.'
                      : 'No secrets in this environment yet.'}
                  </p>
                  <Button onClick={() => setShowCreateSecret(true)}>
                    Add Secret
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSecrets.map((secret) => (
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
