'use client';

import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/lib/stores/project-store';
import { useAIStore } from '@/lib/stores/ai-store';

/**
 * Context Panel Component
 *
 * Shows current project/environment context for AI conversations
 */
export function ContextPanel() {
  const { currentProject, environments } = useProjectStore();
  const { contextProjectId, contextEnvironmentId, setContext } = useAIStore();

  // Find context project and environment
  const contextProject = currentProject?.id === contextProjectId ? currentProject : null;
  const contextEnvironment = environments.find((e) => e.id === contextEnvironmentId);

  const handleSetContext = () => {
    if (currentProject) {
      const firstEnv = environments[0];
      setContext(currentProject.id, firstEnv?.id || null);
    }
  };

  const handleClearContext = () => {
    setContext(null, null);
  };

  return (
    <div className="border-b bg-muted/30 px-4 py-3">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {contextProject ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Context:</span>
                  <span className="font-semibold">{contextProject.name}</span>
                  {contextEnvironment && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {contextEnvironment.name}
                      </span>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearContext}
                  className="h-7 text-xs"
                >
                  Clear
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  No context set - AI will provide general guidance
                </span>
                {currentProject && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetContext}
                    className="h-7 text-xs"
                  >
                    Set to {currentProject.name}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Context info tooltip */}
          <div className="ml-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden md:inline">
                Context helps AI understand which project you're working on
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions when context is set */}
        {contextProject && (
          <div className="mt-2 flex gap-2">
            <button
              className="text-xs px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              onClick={() => {
                // TODO: Trigger AI suggestion for this action
                console.log('Quick action: Add secret');
              }}
            >
              Add secret
            </button>
            <button
              className="text-xs px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              onClick={() => {
                console.log('Quick action: View secrets');
              }}
            >
              View secrets
            </button>
            <button
              className="text-xs px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              onClick={() => {
                console.log('Quick action: Security audit');
              }}
            >
              Security audit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
