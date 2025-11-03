'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AcquisitionStep } from '@/lib/stores/ai-store';

interface StepViewerProps {
  steps: AcquisitionStep[];
  onStepComplete: (stepId: string) => void;
  onAskHelp?: (stepId: string) => void;
}

/**
 * Step Viewer Component
 *
 * Displays AI-generated acquisition steps with checkboxes
 * Users can mark steps complete and expand for details
 */
export function StepViewer({ steps, onStepComplete, onAskHelp }: StepViewerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleExpanded = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const allCompleted = steps.every((step) => step.completed);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Acquisition Steps</h3>
          <p className="text-sm text-muted-foreground">
            Follow these steps to get your API key
          </p>
        </div>
        {allCompleted && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-semibold">All steps complete!</span>
          </div>
        )}
      </div>

      {/* Steps list */}
      <div className="space-y-3">
        {steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            isExpanded={expandedSteps.has(step.id)}
            onToggleExpanded={() => toggleExpanded(step.id)}
            onComplete={() => onStepComplete(step.id)}
            onAskHelp={onAskHelp ? () => onAskHelp(step.id) : undefined}
          />
        ))}
      </div>

      {/* Progress indicator */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm text-muted-foreground">
            {steps.filter((s) => s.completed).length} of {steps.length} complete
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-300"
            style={{
              width: `${(steps.filter((s) => s.completed).length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Step Card Component
 */
function StepCard({
  step,
  isExpanded,
  onToggleExpanded,
  onComplete,
  onAskHelp,
}: {
  step: AcquisitionStep;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onComplete: () => void;
  onAskHelp?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border transition-all ${
        step.completed
          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
          : 'bg-card hover:border-primary/50'
      }`}
    >
      {/* Main step row */}
      <div className="p-4 flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onComplete}
          disabled={step.completed}
          className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-all ${
            step.completed
              ? 'bg-green-500 border-green-500'
              : 'border-muted-foreground hover:border-primary'
          }`}
        >
          {step.completed && (
            <svg
              className="w-full h-full text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  Step {step.stepNumber}
                </span>
                <h4
                  className={`font-medium ${
                    step.completed ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {step.title}
                </h4>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {step.description}
              </p>
            </div>

            {/* Expand button */}
            {(step.details || step.screenshotUrl) && (
              <button
                onClick={onToggleExpanded}
                className="flex-shrink-0 p-1 hover:bg-muted rounded transition-colors"
              >
                <svg
                  className={`h-5 w-5 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Ask for help button */}
          {onAskHelp && !step.completed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAskHelp}
              className="mt-2 h-7 text-xs"
            >
              <svg
                className="h-3 w-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              Ask AI for help
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (step.details || step.screenshotUrl) && (
        <div className="px-4 pb-4 pt-0 border-t">
          {step.details && (
            <div className="mt-3 p-3 rounded bg-muted/50">
              <p className="text-sm whitespace-pre-line">{step.details}</p>
            </div>
          )}
          {step.screenshotUrl && (
            <div className="mt-3">
              <img
                src={step.screenshotUrl}
                alt={`Screenshot for ${step.title}`}
                className="rounded border max-w-full h-auto"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
