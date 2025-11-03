'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/lib/stores/project-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/dashboard/breadcrumb';
import { CreateSystemDialog } from '@/components/systems/create-system-dialog';
import { EditSystemDialog } from '@/components/systems/edit-system-dialog';
import type { Tables } from '@/lib/api/supabase';

type System = Tables<'systems'>;

export default function SystemsPage() {
  const { currentProject, systems, loadSystems } = useProjectStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSystem, setEditingSystem] = useState<System | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadSystems(currentProject.id);
    }
  }, [currentProject, loadSystems]);

  if (!currentProject) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Project Selected</h2>
          <p className="text-muted-foreground">
            Please select a project to manage systems.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Systems</h1>
          <p className="text-muted-foreground">
            Organize secrets by subsystem or component
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add System
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">{systems.length}</div>
              <div className="text-sm text-muted-foreground">Total Systems</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Assigned Secrets</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">.env Templates</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Systems Grid */}
      {systems.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No Systems Yet</h3>
            <p className="text-muted-foreground mb-6">
              Systems help you organize secrets by subsystem or component. For example: Frontend, Backend API, Mobile App, Database.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              Create Your First System
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systems.map((system) => (
            <Card key={system.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {system.icon ? (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: system.color || '#3b82f6' }}
                    >
                      {system.icon}
                    </div>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: system.color || '#3b82f6' }}
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                        />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{system.name}</h3>
                    {system.description && (
                      <p className="text-sm text-muted-foreground">{system.description}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  <span>0 secrets</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>0 templates</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  View Secrets
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSystem(system)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create System Dialog */}
      {showCreateDialog && currentProject && (
        <CreateSystemDialog
          projectId={currentProject.id}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {/* Edit System Dialog */}
      {editingSystem && (
        <EditSystemDialog
          system={editingSystem}
          onClose={() => setEditingSystem(null)}
        />
      )}
    </div>
  );
}
