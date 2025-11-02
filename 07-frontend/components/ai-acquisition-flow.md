---
Document: AI Acquisition Flow Components - Component Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 07-frontend/frontend-architecture.md, 07-frontend/ai/ai-chat-interface.md, 08-features/ai-assistant/ai-assistant-overview.md, TECH-STACK.md
---

# AI Acquisition Flow Components

## Overview

The AI Acquisition Flow Components are the visual and interactive elements that guide users through the step-by-step process of acquiring API keys from external services. This is Abyrith's key differentiator - transforming confusing "add your API key" instructions into AI-powered, beginner-friendly guided flows with progress tracking, screenshots, and help at every step.

**Purpose:** Define the component architecture, interfaces, interactions, and visual design for the guided acquisition flow system that enables users of all skill levels to successfully obtain API keys.

**Scope:** This document covers all components involved in displaying, navigating, and completing guided acquisition flows within the AI chat interface. It includes the master wizard component, individual step displays, progress indicators, service comparisons, cost estimators, and suggested prompt bars.

**Status:** Draft - Phase 6 documentation (per DOCUMENTATION-ROADMAP.md)

---

## Table of Contents

1. [Component Architecture](#component-architecture)
2. [Component Details](#component-details)
3. [Component Interfaces](#component-interfaces)
4. [User Interaction Flows](#user-interaction-flows)
5. [State Management](#state-management)
6. [AI Integration](#ai-integration)
7. [Visual Design Specifications](#visual-design-specifications)
8. [Accessibility](#accessibility)
9. [Mobile Responsiveness](#mobile-responsiveness)
10. [Error Handling](#error-handling)
11. [Loading States](#loading-states)
12. [Success States](#success-states)
13. [Integration Points](#integration-points)
14. [Code Examples](#code-examples)
15. [Dependencies](#dependencies)
16. [References](#references)
17. [Change Log](#change-log)

---

## Component Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│              AssistantMessage (Chat Bubble)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │      GuidedAcquisitionFlow (Master Component)          │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │     AcquisitionFlowHeader                        │ │ │
│  │  │  - Service name, icon                            │ │ │
│  │  │  - Progress indicator (3/7 steps)                │ │ │
│  │  │  - Estimated time remaining                      │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │     AcquisitionStepCard (Current Step)           │ │ │
│  │  │  ┌────────────────────────────────────────────┐ │ │ │
│  │  │  │  Step number badge                         │ │ │ │
│  │  │  │  Step title                                │ │ │ │
│  │  │  │  Instructions (markdown)                   │ │ │ │
│  │  │  │  Screenshot (if available)                 │ │ │ │
│  │  │  │  Checkpoints checklist                     │ │ │ │
│  │  │  │  "Get Help" button                         │ │ │ │
│  │  │  │  "Mark Complete" button                    │ │ │ │
│  │  │  └────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │     AcquisitionNavigationButtons                 │ │ │
│  │  │  - Previous Step button                          │ │ │
│  │  │  - Next Step button                              │ │ │
│  │  │  - Step dots indicator                           │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │     ServiceComparisonTable (Optional)            │ │ │
│  │  │  - Feature comparison matrix                     │ │ │
│  │  │  - Pricing tiers                                 │ │ │
│  │  │  - "Choose this service" buttons                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │     CostEstimator (Optional)                     │ │ │
│  │  │  - Usage slider                                  │ │ │
│  │  │  - Estimated monthly cost                        │ │ │
│  │  │  - Free tier indicator                           │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│           SuggestedPromptsBar (Separate Component)           │
│  "I don't understand"  │  "What's billing?"  │  "Skip to..."│
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**1. GuidedAcquisitionFlow (Master Wizard)**
- Orchestrates the entire flow
- Manages current step state
- Tracks completion progress
- Handles navigation between steps
- Saves state to backend
- Interfaces with AI assistant for help requests

**2. AcquisitionFlowHeader**
- Displays service information
- Shows overall progress
- Estimates time remaining
- Provides context to user

**3. AcquisitionStepCard**
- Displays current step instructions
- Renders markdown content
- Shows screenshots
- Manages step-specific state (checkpoints)
- Triggers help requests
- Marks step as complete

**4. AcquisitionProgressBar**
- Visual progress indicator
- Shows completed/current/remaining steps
- Clickable step navigation

**5. AcquisitionNavigationButtons**
- Previous/Next navigation
- Step dot indicator
- Keyboard navigation support

**6. ServiceComparisonTable**
- Compares multiple service options
- Shows feature matrix
- Displays pricing
- Allows service selection

**7. CostEstimator**
- Estimates monthly costs
- Accepts usage inputs
- Shows free tier eligibility
- Compares pricing tiers

**8. SuggestedPromptsBar**
- Quick-action prompts
- Context-aware suggestions
- Inline help triggers

---

## Component Details

### Component 1: GuidedAcquisitionFlow

**Purpose:** Master component that orchestrates the entire guided acquisition experience.

**Props Interface:**
```typescript
interface GuidedAcquisitionFlowProps {
  flowId: string;                          // Unique flow instance ID
  serviceName: string;                     // Service name (e.g., "OpenAI", "Stripe")
  flow: AcquisitionFlow;                   // Complete flow data
  projectId?: string;                      // Target project for saving key
  environment?: 'development' | 'staging' | 'production';
  onComplete?: (secretId: string) => void; // Called when key is saved
  onCancel?: () => void;                   // Called if user abandons flow
  conversationId: string;                  // For AI context
}

interface AcquisitionFlow {
  serviceName: string;
  serviceDescription: string;
  serviceLogo?: string;                    // URL to service logo
  estimatedTime: string;                   // "10 minutes", "30 minutes"
  difficulty: 'easy' | 'medium' | 'hard';
  requirements: string[];                  // ["Email", "Credit card", "Phone"]
  pricing: {
    freeTier: string | null;
    paidTiers: PricingTier[];
  };
  steps: AcquisitionStep[];
  warnings: string[];                      // ["Requires credit card even for free tier"]
  tips: string[];                          // ["Use a password manager"]
  createdAt?: string;
  lastValidated?: string;
  successRate?: number;                    // % of users who complete
}

interface AcquisitionStep {
  stepNumber: number;
  title: string;
  instructions: string;                    // Markdown formatted
  screenshot?: string;                     // URL or base64
  checkpoints: string[];                   // ["You received verification email"]
  estimatedDuration: string;               // "2 minutes"
  commonIssues: CommonIssue[];
  videoUrl?: string;                       // Optional video tutorial
  externalUrl?: string;                    // Link to service's page
}

interface CommonIssue {
  problem: string;
  solution: string;
}

interface PricingTier {
  name: string;
  price: string;
  features: string[];
  limits: string[];
}
```

**State Management:**
```typescript
interface FlowState {
  currentStepIndex: number;
  completedSteps: Set<number>;
  checkpointStates: Map<number, Map<string, boolean>>; // step -> checkpoint -> checked
  startedAt: Date;
  lastActiveAt: Date;
  isPaused: boolean;
  needsHelp: boolean;
  selectedServiceAlternative?: string;     // If comparing services
}
```

**Key Methods:**
```typescript
class GuidedAcquisitionFlow {
  // Navigation
  nextStep(): void;
  previousStep(): void;
  goToStep(stepIndex: number): void;

  // Step management
  markStepComplete(stepIndex: number): void;
  markCheckpoint(stepIndex: number, checkpointText: string, checked: boolean): void;

  // Help & support
  requestHelp(stepIndex: number, question: string): void;
  reportIssue(stepIndex: number, issue: string): void;

  // Completion
  completeFlow(apiKey: string): Promise<void>;
  saveProgress(): Promise<void>;
  resumeFlow(flowId: string): Promise<void>;
  abandonFlow(): void;

  // Analytics
  trackStepView(stepIndex: number): void;
  trackStepCompletion(stepIndex: number, duration: number): void;
}
```

**Implementation:**
```typescript
// components/ai/GuidedAcquisitionFlow.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AcquisitionFlowHeader } from './AcquisitionFlowHeader';
import { AcquisitionStepCard } from './AcquisitionStepCard';
import { AcquisitionNavigationButtons } from './AcquisitionNavigationButtons';
import { useAcquisitionFlowState } from '@/lib/hooks/useAcquisitionFlowState';
import { useAiAssistant } from '@/lib/hooks/useAiAssistant';

export function GuidedAcquisitionFlow({
  flowId,
  serviceName,
  flow,
  projectId,
  environment = 'development',
  onComplete,
  onCancel,
  conversationId
}: GuidedAcquisitionFlowProps) {
  // State management
  const {
    currentStepIndex,
    completedSteps,
    checkpointStates,
    markStepComplete,
    markCheckpoint,
    nextStep,
    previousStep,
    goToStep,
    saveProgress
  } = useAcquisitionFlowState(flowId, flow);

  const { sendMessage } = useAiAssistant(conversationId);

  // Track time
  const [startTime] = useState(Date.now());
  const [stepStartTime, setStepStartTime] = useState(Date.now());

  // Current step
  const currentStep = flow.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === flow.steps.length - 1;

  // Auto-save progress every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveProgress();
    }, 30000);

    return () => clearInterval(interval);
  }, [saveProgress]);

  // Track step view
  useEffect(() => {
    setStepStartTime(Date.now());
    // Analytics: track step view
  }, [currentStepIndex]);

  // Handle help request
  const handleHelpRequest = useCallback((question: string) => {
    sendMessage(
      `I need help with step ${currentStep.stepNumber} (${currentStep.title}) in the ${serviceName} flow. ${question}`
    );
  }, [currentStep, serviceName, sendMessage]);

  // Handle step completion
  const handleStepComplete = useCallback(() => {
    const duration = Date.now() - stepStartTime;
    markStepComplete(currentStepIndex);

    // Analytics: track completion time
    // trackStepCompletion(currentStepIndex, duration);

    // Auto-advance if not last step
    if (!isLastStep) {
      setTimeout(() => nextStep(), 500);
    }
  }, [currentStepIndex, isLastStep, stepStartTime, markStepComplete, nextStep]);

  // Handle final completion
  const handleFlowComplete = useCallback(async (apiKey: string) => {
    // Save the API key to Abyrith
    if (onComplete) {
      onComplete(apiKey);
    }

    // Send success message to AI
    sendMessage(
      `I've successfully completed the ${serviceName} API key acquisition! The key has been saved.`
    );
  }, [serviceName, onComplete, sendMessage]);

  return (
    <div className="acquisition-flow w-full max-w-3xl mx-auto">
      {/* Header with progress */}
      <AcquisitionFlowHeader
        serviceName={serviceName}
        serviceLogo={flow.serviceLogo}
        currentStep={currentStepIndex + 1}
        totalSteps={flow.steps.length}
        completedSteps={completedSteps.size}
        estimatedTimeRemaining={calculateTimeRemaining(
          currentStepIndex,
          flow.steps,
          startTime
        )}
        difficulty={flow.difficulty}
      />

      {/* Current step card */}
      <div className="mt-6">
        <AcquisitionStepCard
          step={currentStep}
          stepIndex={currentStepIndex}
          isComplete={completedSteps.has(currentStepIndex)}
          checkpointStates={checkpointStates.get(currentStepIndex) || new Map()}
          onCheckpointToggle={(checkpoint, checked) =>
            markCheckpoint(currentStepIndex, checkpoint, checked)
          }
          onHelpRequest={handleHelpRequest}
          onMarkComplete={handleStepComplete}
        />
      </div>

      {/* Navigation buttons */}
      <AcquisitionNavigationButtons
        currentStep={currentStepIndex}
        totalSteps={flow.steps.length}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canGoNext={completedSteps.has(currentStepIndex)}
        onPrevious={previousStep}
        onNext={nextStep}
        onGoToStep={goToStep}
        completedSteps={completedSteps}
      />

      {/* Final step: Save API key */}
      {isLastStep && completedSteps.has(currentStepIndex) && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
            🎉 Almost Done!
          </h3>
          <p className="text-sm text-green-800 dark:text-green-200 mb-4">
            Paste your {serviceName} API key below to save it securely in Abyrith.
          </p>
          <SaveSecretForm
            serviceName={serviceName}
            projectId={projectId}
            environment={environment}
            onSave={handleFlowComplete}
          />
        </div>
      )}
    </div>
  );
}

// Helper function
function calculateTimeRemaining(
  currentStepIndex: number,
  steps: AcquisitionStep[],
  startTime: number
): string {
  const remainingSteps = steps.slice(currentStepIndex + 1);
  const totalMinutes = remainingSteps.reduce((sum, step) => {
    const match = step.estimatedDuration.match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) : 2);
  }, 0);

  if (totalMinutes < 1) return 'Less than 1 minute';
  if (totalMinutes === 1) return '1 minute';
  return `${totalMinutes} minutes`;
}
```

---

### Component 2: AcquisitionFlowHeader

**Purpose:** Display service information, progress, and estimated time at the top of the flow.

**Props Interface:**
```typescript
interface AcquisitionFlowHeaderProps {
  serviceName: string;
  serviceLogo?: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  estimatedTimeRemaining: string;
  difficulty: 'easy' | 'medium' | 'hard';
}
```

**Implementation:**
```typescript
// components/ai/AcquisitionFlowHeader.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle2 } from 'lucide-react';

export function AcquisitionFlowHeader({
  serviceName,
  serviceLogo,
  currentStep,
  totalSteps,
  completedSteps,
  estimatedTimeRemaining,
  difficulty
}: AcquisitionFlowHeaderProps) {
  const progressPercent = (completedSteps / totalSteps) * 100;

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };

  return (
    <div className="acquisition-header bg-card rounded-lg border p-4 shadow-sm">
      {/* Service info row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {serviceLogo && (
            <img
              src={serviceLogo}
              alt={`${serviceName} logo`}
              className="w-10 h-10 rounded object-contain"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold">{serviceName} Setup</h2>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </p>
          </div>
        </div>

        <Badge className={difficultyColors[difficulty]}>
          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span>{completedSteps} of {totalSteps} steps complete</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{estimatedTimeRemaining} remaining</span>
          </div>
        </div>

        <Progress value={progressPercent} className="h-2" />
      </div>
    </div>
  );
}
```

**Visual Design:**
- **Layout:** Horizontal card with service logo on left, badges on right
- **Progress bar:** Full-width below, showing completion percentage
- **Colors:** Uses semantic colors from Tailwind (green for easy, yellow for medium, red for hard)
- **Responsive:** Stacks vertically on mobile

---

### Component 3: AcquisitionStepCard

**Purpose:** Display current step instructions, screenshots, checkpoints, and action buttons.

**Props Interface:**
```typescript
interface AcquisitionStepCardProps {
  step: AcquisitionStep;
  stepIndex: number;
  isComplete: boolean;
  checkpointStates: Map<string, boolean>;
  onCheckpointToggle: (checkpoint: string, checked: boolean) => void;
  onHelpRequest: (question: string) => void;
  onMarkComplete: () => void;
}
```

**Implementation:**
```typescript
// components/ai/AcquisitionStepCard.tsx
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ZoomIn
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function AcquisitionStepCard({
  step,
  stepIndex,
  isComplete,
  checkpointStates,
  onCheckpointToggle,
  onHelpRequest,
  onMarkComplete
}: AcquisitionStepCardProps) {
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);

  const allCheckpointsComplete = step.checkpoints.every(
    checkpoint => checkpointStates.get(checkpoint) === true
  );

  return (
    <Card className="step-card p-6">
      {/* Step number badge */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center font-bold
            ${isComplete
              ? 'bg-green-500 text-white'
              : 'bg-primary text-primary-foreground'
            }
          `}>
            {isComplete ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <span>{step.stepNumber}</span>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
          <p className="text-sm text-muted-foreground">
            Estimated time: {step.estimatedDuration}
          </p>
        </div>
      </div>

      {/* Instructions (markdown) */}
      <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
        <ReactMarkdown
          components={{
            a: ({ node, children, ...props }) => (
              <a
                {...props}
                className="text-primary hover:underline inline-flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
                <ExternalLink className="h-3 w-3" />
              </a>
            ),
          }}
        >
          {step.instructions}
        </ReactMarkdown>
      </div>

      {/* Screenshot */}
      {step.screenshot && (
        <div className="mb-6">
          <Dialog open={imageZoomOpen} onOpenChange={setImageZoomOpen}>
            <DialogTrigger asChild>
              <button className="relative group cursor-zoom-in">
                <img
                  src={step.screenshot}
                  alt={`Step ${step.stepNumber} screenshot`}
                  className="rounded-lg border shadow-sm w-full"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <ZoomIn className="h-8 w-8 text-white" />
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Step {step.stepNumber}: {step.title}</DialogTitle>
              </DialogHeader>
              <img
                src={step.screenshot}
                alt={`Step ${step.stepNumber} screenshot`}
                className="w-full rounded-lg"
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Checkpoints */}
      {step.checkpoints.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Verify you've completed:
          </h4>
          <div className="space-y-2">
            {step.checkpoints.map((checkpoint, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Checkbox
                  id={`checkpoint-${stepIndex}-${idx}`}
                  checked={checkpointStates.get(checkpoint) || false}
                  onCheckedChange={(checked) =>
                    onCheckpointToggle(checkpoint, checked as boolean)
                  }
                  className="mt-0.5"
                />
                <label
                  htmlFor={`checkpoint-${stepIndex}-${idx}`}
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  {checkpoint}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common issues */}
      {step.commonIssues.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4" />
            Common Issues
          </h4>
          <div className="space-y-3">
            {step.commonIssues.map((issue, idx) => (
              <div key={idx} className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {issue.problem}
                </p>
                <p className="text-amber-800 dark:text-amber-200 mt-1">
                  {issue.solution}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onMarkComplete}
          disabled={isComplete || (step.checkpoints.length > 0 && !allCheckpointsComplete)}
          className="flex-1"
          size="lg"
        >
          {isComplete ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Completed
            </>
          ) : (
            'Mark as Complete'
          )}
        </Button>

        <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="lg">
              <HelpCircle className="mr-2 h-4 w-4" />
              Get Help
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>What do you need help with?</DialogTitle>
            </DialogHeader>
            <HelpRequestForm
              step={step}
              onSubmit={(question) => {
                onHelpRequest(question);
                setHelpDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
```

**Visual Design:**
- **Layout:** Card with step badge on left, content below
- **Typography:** Clear hierarchy (title H3, instructions prose, checkpoints small)
- **Interactive elements:** Checkboxes, buttons, clickable screenshot
- **Status indicators:** Color-coded complete/incomplete states
- **Responsive:** Full-width on mobile, max-width on desktop

---

### Component 4: AcquisitionProgressBar

**Purpose:** Visual indicator of progress through the flow with clickable steps.

**Props Interface:**
```typescript
interface AcquisitionProgressBarProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  onStepClick?: (stepIndex: number) => void;
  stepLabels?: string[];  // Optional short labels for each step
}
```

**Implementation:**
```typescript
// components/ai/AcquisitionProgressBar.tsx
'use client';

import { CheckCircle2, Circle } from 'lucide-react';

export function AcquisitionProgressBar({
  currentStep,
  totalSteps,
  completedSteps,
  onStepClick,
  stepLabels
}: AcquisitionProgressBarProps) {
  return (
    <div className="progress-bar-container">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i;
          const isComplete = completedSteps.has(stepNumber);
          const isCurrent = stepNumber === currentStep;
          const isClickable = onStepClick && (isComplete || stepNumber < currentStep);

          return (
            <div key={i} className="flex items-center flex-1">
              {/* Step circle */}
              <button
                onClick={() => isClickable && onStepClick?.(stepNumber)}
                disabled={!isClickable}
                className={`
                  relative flex items-center justify-center w-8 h-8 rounded-full
                  transition-all duration-200
                  ${isComplete
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
                  }
                  ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                `}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                {stepLabels && stepLabels[i] && (
                  <span className="absolute -bottom-6 text-xs whitespace-nowrap">
                    {stepLabels[i]}
                  </span>
                )}
              </button>

              {/* Connector line */}
              {i < totalSteps - 1 && (
                <div className={`
                  flex-1 h-0.5 mx-2
                  ${completedSteps.has(stepNumber + 1) || stepNumber < currentStep
                    ? 'bg-green-500'
                    : 'bg-muted'
                  }
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Visual Design:**
- **Layout:** Horizontal line with circles for each step
- **Colors:** Green for complete, primary for current, muted for incomplete
- **Interactive:** Clickable completed steps for navigation
- **Animation:** Smooth transitions, hover scale effect
- **Responsive:** Adjusts spacing on mobile

---

### Component 5: ServiceComparisonTable

**Purpose:** Compare multiple service options when AI suggests alternatives.

**Props Interface:**
```typescript
interface ServiceComparisonTableProps {
  services: ServiceComparison[];
  recommendedServiceId: string;
  onSelectService: (serviceId: string) => void;
}

interface ServiceComparison {
  id: string;
  name: string;
  logo?: string;
  description: string;
  pricing: {
    freeTier?: string;
    startingPrice?: string;
  };
  features: string[];
  pros: string[];
  cons: string[];
  bestFor: string;
}
```

**Implementation:**
```typescript
// components/ai/ServiceComparisonTable.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, X, Star } from 'lucide-react';

export function ServiceComparisonTable({
  services,
  recommendedServiceId,
  onSelectService
}: ServiceComparisonTableProps) {
  return (
    <div className="comparison-table space-y-4">
      <h3 className="text-lg font-semibold mb-4">Service Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => {
          const isRecommended = service.id === recommendedServiceId;

          return (
            <Card
              key={service.id}
              className={`p-6 relative ${
                isRecommended ? 'border-primary border-2' : ''
              }`}
            >
              {isRecommended && (
                <Badge className="absolute -top-3 left-4 bg-primary">
                  <Star className="h-3 w-3 mr-1" />
                  Recommended
                </Badge>
              )}

              {/* Service header */}
              <div className="flex items-center gap-3 mb-4">
                {service.logo && (
                  <img
                    src={service.logo}
                    alt={service.name}
                    className="w-10 h-10 rounded"
                  />
                )}
                <div>
                  <h4 className="font-semibold">{service.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {service.pricing.startingPrice || 'Free tier available'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-4">
                {service.description}
              </p>

              {/* Best for */}
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Best for:</span> {service.bestFor}
                </p>
              </div>

              {/* Pros */}
              <div className="mb-3">
                <p className="text-sm font-medium mb-2">Pros:</p>
                <ul className="space-y-1">
                  {service.pros.map((pro, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cons */}
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Cons:</p>
                <ul className="space-y-1">
                  {service.cons.map((con, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <X className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Select button */}
              <Button
                onClick={() => onSelectService(service.id)}
                className="w-full"
                variant={isRecommended ? 'default' : 'outline'}
              >
                Choose {service.name}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**Visual Design:**
- **Layout:** Grid of cards (responsive columns)
- **Highlighting:** Recommended service has primary border and badge
- **Icons:** Check for pros, X for cons
- **CTA:** Clear "Choose" button for each service
- **Responsive:** 1 column on mobile, 2-3 on desktop

---

### Component 6: CostEstimator

**Purpose:** Help users estimate monthly costs based on expected usage.

**Props Interface:**
```typescript
interface CostEstimatorProps {
  serviceName: string;
  pricingTiers: PricingTier[];
  usageUnit: string;              // "requests", "users", "emails"
  onEstimateCalculated?: (estimate: CostEstimate) => void;
}

interface CostEstimate {
  selectedTier: string;
  estimatedUsage: number;
  monthlyCost: number;
  isInFreeTier: boolean;
  breakdown: {
    unit: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}
```

**Implementation:**
```typescript
// components/ai/CostEstimator.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp } from 'lucide-react';

export function CostEstimator({
  serviceName,
  pricingTiers,
  usageUnit,
  onEstimateCalculated
}: CostEstimatorProps) {
  const [usage, setUsage] = useState(1000);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);

  useEffect(() => {
    // Calculate cost based on usage
    const calculated = calculateCost(usage, pricingTiers, usageUnit);
    setEstimate(calculated);
    onEstimateCalculated?.(calculated);
  }, [usage, pricingTiers, usageUnit, onEstimateCalculated]);

  if (!estimate) return null;

  return (
    <Card className="cost-estimator p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Cost Estimator</h3>
      </div>

      {/* Usage slider */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium">
            Expected Monthly {usageUnit}
          </label>
          <span className="text-sm font-bold">
            {usage.toLocaleString()}
          </span>
        </div>
        <Slider
          value={[usage]}
          onValueChange={([value]) => setUsage(value)}
          min={0}
          max={100000}
          step={100}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>50k</span>
          <span>100k+</span>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="mb-6 p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Estimated Monthly Cost</span>
          {estimate.isInFreeTier && (
            <Badge className="bg-green-500">Free Tier</Badge>
          )}
        </div>
        <p className="text-3xl font-bold">
          ${estimate.monthlyCost.toFixed(2)}
          <span className="text-base text-muted-foreground font-normal">/month</span>
        </p>
      </div>

      {/* Breakdown details */}
      <div className="space-y-2">
        <p className="text-sm font-medium mb-2">Cost Breakdown:</p>
        {estimate.breakdown.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {item.quantity.toLocaleString()} {item.unit}
            </span>
            <span className="font-medium">
              ${item.subtotal.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Tier recommendation */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm flex items-start gap-2">
          <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Recommended tier:</strong> {estimate.selectedTier}
          </span>
        </p>
      </div>
    </Card>
  );
}

// Helper function
function calculateCost(
  usage: number,
  tiers: PricingTier[],
  usageUnit: string
): CostEstimate {
  // Simplified cost calculation logic
  // In reality, this would parse pricing tiers and calculate based on usage

  const freeTier = tiers.find(t => t.name.toLowerCase().includes('free'));
  const isInFreeTier = freeTier && usage <= 1000; // Example threshold

  return {
    selectedTier: isInFreeTier ? 'Free' : 'Pay-as-you-go',
    estimatedUsage: usage,
    monthlyCost: isInFreeTier ? 0 : usage * 0.002, // Example pricing
    isInFreeTier: !!isInFreeTier,
    breakdown: [
      {
        unit: usageUnit,
        quantity: usage,
        unitPrice: 0.002,
        subtotal: usage * 0.002
      }
    ]
  };
}
```

**Visual Design:**
- **Layout:** Card with slider, large cost display, breakdown
- **Colors:** Green for free tier, blue for recommendations
- **Interactive:** Slider updates cost in real-time
- **Typography:** Large bold cost, small breakdown details
- **Responsive:** Full-width on all screens

---

## Component Interfaces

### Type Definitions

**Complete TypeScript interfaces for all acquisition flow components:**

```typescript
// types/acquisition-flow.ts

// ============================================================================
// Core Flow Types
// ============================================================================

export interface AcquisitionFlow {
  id: string;
  serviceName: string;
  serviceDescription: string;
  serviceLogo?: string;
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  requirements: string[];
  pricing: FlowPricing;
  steps: AcquisitionStep[];
  warnings: string[];
  tips: string[];
  metadata: FlowMetadata;
}

export interface FlowPricing {
  freeTier: string | null;
  paidTiers: PricingTier[];
}

export interface PricingTier {
  name: string;
  price: string;
  features: string[];
  limits: string[];
}

export interface FlowMetadata {
  createdAt: string;
  createdBy: 'ai' | 'manual';
  lastValidated: string;
  successRate: number;         // 0-100
  totalAttempts: number;
  successfulCompletions: number;
  averageCompletionTime: number; // minutes
}

export interface AcquisitionStep {
  stepNumber: number;
  title: string;
  instructions: string;         // Markdown
  screenshot?: string;
  videoUrl?: string;
  externalUrl?: string;
  checkpoints: string[];
  estimatedDuration: string;
  commonIssues: CommonIssue[];
  helpContext?: string;         // Additional context for AI help
}

export interface CommonIssue {
  problem: string;
  solution: string;
  frequency?: number;           // How often this occurs (1-5)
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface GuidedAcquisitionFlowProps {
  flowId: string;
  serviceName: string;
  flow: AcquisitionFlow;
  projectId?: string;
  environment?: Environment;
  onComplete?: (secretId: string) => void;
  onCancel?: () => void;
  onProgress?: (progress: FlowProgress) => void;
  conversationId: string;
}

export interface AcquisitionFlowHeaderProps {
  serviceName: string;
  serviceLogo?: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  estimatedTimeRemaining: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AcquisitionStepCardProps {
  step: AcquisitionStep;
  stepIndex: number;
  isComplete: boolean;
  checkpointStates: Map<string, boolean>;
  onCheckpointToggle: (checkpoint: string, checked: boolean) => void;
  onHelpRequest: (question: string) => void;
  onMarkComplete: () => void;
}

export interface AcquisitionProgressBarProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  onStepClick?: (stepIndex: number) => void;
  stepLabels?: string[];
}

export interface AcquisitionNavigationButtonsProps {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onGoToStep: (stepIndex: number) => void;
  completedSteps: Set<number>;
}

export interface ServiceComparisonTableProps {
  services: ServiceComparison[];
  recommendedServiceId: string;
  onSelectService: (serviceId: string) => void;
}

export interface ServiceComparison {
  id: string;
  name: string;
  logo?: string;
  description: string;
  pricing: {
    freeTier?: string;
    startingPrice?: string;
  };
  features: string[];
  pros: string[];
  cons: string[];
  bestFor: string;
}

export interface CostEstimatorProps {
  serviceName: string;
  pricingTiers: PricingTier[];
  usageUnit: string;
  defaultUsage?: number;
  onEstimateCalculated?: (estimate: CostEstimate) => void;
}

export interface CostEstimate {
  selectedTier: string;
  estimatedUsage: number;
  monthlyCost: number;
  isInFreeTier: boolean;
  breakdown: CostBreakdownItem[];
}

export interface CostBreakdownItem {
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SuggestedPromptsBarProps {
  prompts: SuggestedPrompt[];
  onPromptClick: (prompt: string) => void;
  context?: PromptContext;
}

export interface SuggestedPrompt {
  text: string;
  category: 'help' | 'action' | 'navigation' | 'comparison';
  icon?: string;
}

export interface PromptContext {
  currentStep?: number;
  serviceName?: string;
  hasAlternatives?: boolean;
}

// ============================================================================
// State Types
// ============================================================================

export interface FlowState {
  flowId: string;
  currentStepIndex: number;
  completedSteps: Set<number>;
  checkpointStates: Map<number, Map<string, boolean>>;
  startedAt: Date;
  lastActiveAt: Date;
  isPaused: boolean;
  needsHelp: boolean;
  helpRequests: HelpRequest[];
  selectedServiceAlternative?: string;
}

export interface HelpRequest {
  stepIndex: number;
  question: string;
  timestamp: Date;
  resolved: boolean;
}

export interface FlowProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  percentComplete: number;
  timeElapsed: number;        // milliseconds
  estimatedTimeRemaining: number; // milliseconds
}

// ============================================================================
// Utility Types
// ============================================================================

export type Environment = 'development' | 'staging' | 'production';

export type FlowDifficulty = 'easy' | 'medium' | 'hard';

export type FlowStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'abandoned';
```

---

## User Interaction Flows

### Flow 1: Starting a New Acquisition Flow

**Trigger:** AI generates an acquisition flow and displays it in chat.

**Steps:**

1. **User asks AI:** "I need an OpenAI API key"
2. **AI responds:** Generates `AcquisitionFlow` object via backend
3. **Frontend renders:** `GuidedAcquisitionFlow` component appears in chat message
4. **User sees:**
   - Service header (OpenAI logo, difficulty badge)
   - Progress bar (Step 1 of 5)
   - First step card with instructions
   - "Get Help" and "Mark Complete" buttons
5. **User reads instructions** and follows them externally
6. **User checks checkpoints** as they complete each one
7. **User clicks "Mark Complete"**
8. **System responds:**
   - Step 1 marked complete (green checkmark)
   - Progress bar updates (1 of 5 complete)
   - Auto-advances to Step 2 after 500ms
   - State saved to backend

**Interaction Pattern:**
```typescript
// User marks step complete
handleStepComplete() {
  markStepComplete(currentStepIndex);  // Update local state
  saveProgress();                       // Persist to backend
  setTimeout(() => nextStep(), 500);    // Auto-advance after brief delay
}
```

---

### Flow 2: Requesting Help During a Step

**Trigger:** User is stuck on a step and clicks "Get Help"

**Steps:**

1. **User clicks "Get Help"** on Step 3
2. **Dialog opens** with help form
3. **User types question:** "What does 'billing information' mean?"
4. **User submits** help request
5. **System responds:**
   - Dialog closes
   - Help request sent to AI via `sendMessage()`
   - AI receives context: current step, question, flow data
   - AI responds in chat below the flow component
6. **User reads AI response** and continues
7. **Optional:** User marks help as resolved

**Interaction Pattern:**
```typescript
// User requests help
handleHelpRequest(question: string) {
  const context = {
    serviceName,
    stepNumber: currentStep.stepNumber,
    stepTitle: currentStep.title,
    question
  };

  sendMessage(
    `I need help with step ${context.stepNumber} (${context.stepTitle}) ` +
    `in the ${context.serviceName} flow. ${question}`
  );

  trackEvent('acquisition_help_requested', context);
}
```

---

### Flow 3: Completing the Flow and Saving API Key

**Trigger:** User completes final step

**Steps:**

1. **User completes Step 5** (final step)
2. **System shows success banner:** "Almost Done! 🎉"
3. **Save Secret Form appears:**
   - Input field for API key (password type)
   - Project selector (pre-filled from context)
   - Environment selector (pre-filled)
   - Tags input (optional)
   - "Save Securely" button
4. **User pastes API key** from service
5. **User clicks "Save Securely"**
6. **System responds:**
   - Client-side encryption of key
   - API call to save secret
   - Success confirmation
   - Confetti animation (optional)
   - AI congratulates user
7. **Onboarding complete**

**Interaction Pattern:**
```typescript
// User completes flow and saves key
async handleFlowComplete(apiKey: string) {
  // Encrypt API key client-side
  const masterKey = await getMasterKey();
  const encryptedValue = await encrypt(apiKey, masterKey);

  // Save to Abyrith
  const { data: secret } = await createSecret({
    name: `${serviceName} API Key`,
    encrypted_value: encryptedValue,
    service_name: serviceName,
    project_id: projectId,
    environment,
    tags: ['api-key', serviceName.toLowerCase()]
  });

  // Notify AI
  sendMessage(
    `Success! I've saved my ${serviceName} API key to Abyrith.`
  );

  // Callback
  onComplete?.(secret.id);

  // Analytics
  trackEvent('acquisition_completed', {
    serviceName,
    duration: Date.now() - startTime,
    helpRequests: helpRequests.length
  });
}
```

---

## State Management

### Zustand Store for Flow State

```typescript
// lib/stores/acquisitionFlowStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AcquisitionFlowStore {
  // Active flows
  activeFlows: Map<string, FlowState>;

  // Current flow
  currentFlowId: string | null;

  // Actions
  startFlow: (flowId: string, flow: AcquisitionFlow) => void;
  resumeFlow: (flowId: string) => void;
  pauseFlow: (flowId: string) => void;
  abandonFlow: (flowId: string) => void;

  // Step management
  goToStep: (flowId: string, stepIndex: number) => void;
  nextStep: (flowId: string) => void;
  previousStep: (flowId: string) => void;
  markStepComplete: (flowId: string, stepIndex: number) => void;

  // Checkpoints
  markCheckpoint: (
    flowId: string,
    stepIndex: number,
    checkpoint: string,
    checked: boolean
  ) => void;

  // Help
  requestHelp: (
    flowId: string,
    stepIndex: number,
    question: string
  ) => void;
}

export const useAcquisitionFlowStore = create<AcquisitionFlowStore>()(
  persist(
    (set, get) => ({
      activeFlows: new Map(),
      currentFlowId: null,

      startFlow: (flowId, flow) => {
        const state: FlowState = {
          flowId,
          currentStepIndex: 0,
          completedSteps: new Set(),
          checkpointStates: new Map(),
          startedAt: new Date(),
          lastActiveAt: new Date(),
          isPaused: false,
          needsHelp: false,
          helpRequests: [],
        };

        set((s) => ({
          activeFlows: new Map(s.activeFlows).set(flowId, state),
          currentFlowId: flowId
        }));
      },

      markStepComplete: (flowId, stepIndex) => {
        set((s) => {
          const flows = new Map(s.activeFlows);
          const flow = flows.get(flowId);
          if (!flow) return s;

          flow.completedSteps.add(stepIndex);
          flow.lastActiveAt = new Date();
          flows.set(flowId, flow);

          return { activeFlows: flows };
        });
      },

      markCheckpoint: (flowId, stepIndex, checkpoint, checked) => {
        set((s) => {
          const flows = new Map(s.activeFlows);
          const flow = flows.get(flowId);
          if (!flow) return s;

          if (!flow.checkpointStates.has(stepIndex)) {
            flow.checkpointStates.set(stepIndex, new Map());
          }

          flow.checkpointStates.get(stepIndex)!.set(checkpoint, checked);
          flow.lastActiveAt = new Date();
          flows.set(flowId, flow);

          return { activeFlows: flows };
        });
      },

      // ... other actions
    }),
    {
      name: 'acquisition-flow-storage',
      partialize: (state) => ({
        // Persist active flows
        activeFlows: Array.from(state.activeFlows.entries())
      }),
    }
  )
);
```

### Custom Hook for Flow State

```typescript
// lib/hooks/useAcquisitionFlowState.ts
import { useCallback, useEffect } from 'react';
import { useAcquisitionFlowStore } from '@/lib/stores/acquisitionFlowStore';
import { saveFlowProgress } from '@/lib/api/acquisition-flows';

export function useAcquisitionFlowState(
  flowId: string,
  flow: AcquisitionFlow
) {
  const store = useAcquisitionFlowStore();
  const flowState = store.activeFlows.get(flowId);

  // Initialize flow if not exists
  useEffect(() => {
    if (!flowState) {
      store.startFlow(flowId, flow);
    }
  }, [flowId, flow, flowState, store]);

  // Auto-save progress every 30 seconds
  const saveProgress = useCallback(async () => {
    if (!flowState) return;

    await saveFlowProgress(flowId, {
      currentStepIndex: flowState.currentStepIndex,
      completedSteps: Array.from(flowState.completedSteps),
      checkpointStates: serializeCheckpoints(flowState.checkpointStates)
    });
  }, [flowId, flowState]);

  // Return state and actions
  return {
    currentStepIndex: flowState?.currentStepIndex ?? 0,
    completedSteps: flowState?.completedSteps ?? new Set(),
    checkpointStates: flowState?.checkpointStates ?? new Map(),

    // Actions
    markStepComplete: (stepIndex: number) =>
      store.markStepComplete(flowId, stepIndex),

    markCheckpoint: (stepIndex: number, checkpoint: string, checked: boolean) =>
      store.markCheckpoint(flowId, stepIndex, checkpoint, checked),

    nextStep: () => store.nextStep(flowId),
    previousStep: () => store.previousStep(flowId),
    goToStep: (stepIndex: number) => store.goToStep(flowId, stepIndex),

    saveProgress
  };
}

function serializeCheckpoints(checkpoints: Map<number, Map<string, boolean>>) {
  const serialized: Record<number, Record<string, boolean>> = {};

  checkpoints.forEach((stepMap, stepIndex) => {
    serialized[stepIndex] = {};
    stepMap.forEach((checked, checkpoint) => {
      serialized[stepIndex][checkpoint] = checked;
    });
  });

  return serialized;
}
```

---

## AI Integration

### Receiving Flow Data from AI

**Backend generates flow, frontend receives it:**

```typescript
// Backend (Cloudflare Worker)
// When AI generates a flow, it's sent in the message metadata
interface AiChatResponse {
  messageId: string;
  role: 'assistant';
  content: string;
  metadata?: {
    type: 'acquisition_flow';
    flowId: string;
    flow: AcquisitionFlow;
  };
}

// Frontend receives flow
useEffect(() => {
  if (message.metadata?.type === 'acquisition_flow') {
    const { flowId, flow } = message.metadata;

    // Render flow component
    setActiveFlow({ flowId, flow });
  }
}, [message]);
```

### Sending Help Requests to AI

**User clicks "Get Help", AI receives context:**

```typescript
// Frontend sends help request
function requestHelp(question: string) {
  const context = {
    flowId,
    serviceName: flow.serviceName,
    currentStep: flow.steps[currentStepIndex],
    question
  };

  // AI receives full context
  sendMessage(
    `[Help Request for ${context.serviceName} - Step ${context.currentStep.stepNumber}]\n\n` +
    `Question: ${question}\n\n` +
    `Step context: ${context.currentStep.title}\n` +
    `Instructions: ${context.currentStep.instructions.substring(0, 200)}...`
  );
}
```

### AI Provides Inline Suggestions

**AI monitors flow progress and suggests improvements:**

```typescript
// Backend detects user is stuck (hasn't progressed in 5 minutes)
if (Date.now() - flowState.lastActiveAt > 5 * 60 * 1000) {
  // AI proactively offers help
  sendAiMessage({
    content: "I notice you've been on this step for a while. Would you like some help?",
    actions: [
      { type: 'help', label: 'Yes, please help' },
      { type: 'dismiss', label: 'No, I'm okay' }
    ]
  });
}
```

---

## Visual Design Specifications

### Colors

**Light Mode:**
```css
--flow-background: hsl(0, 0%, 100%);          /* White card background */
--flow-border: hsl(214, 32%, 91%);            /* Light gray border */
--step-complete: hsl(142, 76%, 36%);          /* Green for complete */
--step-current: hsl(221, 83%, 53%);           /* Blue for current */
--step-incomplete: hsl(210, 40%, 96%);        /* Light gray for incomplete */
--warning-bg: hsl(48, 96%, 89%);              /* Amber for warnings */
--help-bg: hsl(212, 100%, 97%);               /* Blue for help sections */
```

**Dark Mode:**
```css
--flow-background: hsl(222, 47%, 11%);        /* Dark card background */
--flow-border: hsl(217, 33%, 17%);            /* Dark gray border */
--step-complete: hsl(142, 76%, 36%);          /* Green (same) */
--step-current: hsl(221, 83%, 53%);           /* Blue (same) */
--step-incomplete: hsl(217, 33%, 17%);        /* Dark gray */
--warning-bg: hsl(48, 96%, 12%);              /* Dark amber */
--help-bg: hsl(212, 100%, 12%);               /* Dark blue */
```

### Typography

**Font Families:**
```css
--font-sans: 'Inter', system-ui, sans-serif;   /* Body text */
--font-mono: 'JetBrains Mono', monospace;      /* Code blocks */
```

**Font Sizes:**
```css
--text-xs: 0.75rem;    /* 12px - Captions, badges */
--text-sm: 0.875rem;   /* 14px - Body text, checkpoints */
--text-base: 1rem;     /* 16px - Instructions */
--text-lg: 1.125rem;   /* 18px - Step titles */
--text-xl: 1.25rem;    /* 20px - Service name */
--text-2xl: 1.5rem;    /* 24px - Headings */
--text-3xl: 1.875rem;  /* 30px - Cost displays */
```

**Line Heights:**
```css
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

### Spacing

**Consistent spacing scale (Tailwind defaults):**
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
```

**Component-specific spacing:**
- Card padding: `p-6` (24px)
- Section spacing: `space-y-4` (16px between sections)
- Button gap: `gap-2` (8px between icon and text)

### Borders & Shadows

**Borders:**
```css
border: 1px solid var(--flow-border);
border-radius: 0.5rem;  /* 8px - Standard cards */
border-radius: 0.75rem; /* 12px - Step cards */
border-radius: 9999px;  /* Full - Step circles, badges */
```

**Shadows:**
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
```

### Icons

**Icon Library:** Lucide React

**Common Icons:**
- CheckCircle2 - Step complete
- Circle - Step incomplete
- Clock - Time estimates
- HelpCircle - Help button
- AlertCircle - Warnings
- ExternalLink - External links
- ZoomIn - Image zoom
- TrendingUp - Cost estimates
- DollarSign - Pricing

**Icon Sizes:**
```css
h-3 w-3  /* 12px - Inline with text */
h-4 w-4  /* 16px - Buttons, badges */
h-5 w-5  /* 20px - Headers */
h-6 w-6  /* 24px - Large actions */
```

---

## Accessibility

### Keyboard Navigation

**Supported shortcuts:**
```typescript
// Global flow shortcuts
'ArrowRight' | 'n' => Next step (if allowed)
'ArrowLeft' | 'p'  => Previous step
'h'                => Open help dialog
'Enter'            => Mark current step complete (when valid)
'Escape'           => Close dialogs

// Step navigation
'1' - '9'          => Jump to step number (if unlocked)

// Checkpoint management
'Space'            => Toggle focused checkbox
'Tab'              => Navigate between checkpoints
```

**Implementation:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't intercept when user is typing
    if (e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'n':
        if (canGoNext) {
          e.preventDefault();
          nextStep();
        }
        break;

      case 'ArrowLeft':
      case 'p':
        if (!isFirstStep) {
          e.preventDefault();
          previousStep();
        }
        break;

      case 'h':
        e.preventDefault();
        setHelpDialogOpen(true);
        break;

      case 'Enter':
        if (allCheckpointsComplete && !isComplete) {
          e.preventDefault();
          markStepComplete();
        }
        break;
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [canGoNext, isFirstStep, allCheckpointsComplete, isComplete]);
```

### Screen Reader Support

**ARIA Labels:**
```typescript
// Flow header
<div role="region" aria-label="API key acquisition flow">
  <h2 id="flow-heading">{serviceName} Setup</h2>
  <div aria-describedby="flow-progress">
    Step {currentStep} of {totalSteps}
  </div>
</div>

// Progress bar
<div
  role="progressbar"
  aria-valuenow={progressPercent}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Flow progress"
>
  <Progress value={progressPercent} />
</div>

// Step card
<article
  role="article"
  aria-labelledby={`step-${stepNumber}-title`}
  aria-describedby={`step-${stepNumber}-instructions`}
>
  <h3 id={`step-${stepNumber}-title`}>{step.title}</h3>
  <div id={`step-${stepNumber}-instructions`}>
    {/* Instructions */}
  </div>
</article>

// Checkpoints
<div role="group" aria-label="Step verification checkpoints">
  {checkpoints.map((checkpoint, idx) => (
    <div role="checkbox" aria-checked={isChecked}>
      <Checkbox
        aria-label={checkpoint}
        checked={isChecked}
      />
      <label>{checkpoint}</label>
    </div>
  ))}
</div>

// Help button
<Button
  onClick={openHelpDialog}
  aria-label="Get help with this step"
  aria-haspopup="dialog"
>
  <HelpCircle aria-hidden="true" />
  Get Help
</Button>
```

**Live Regions:**
```typescript
// Announce step changes
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {statusMessage}
</div>

// Example status messages
setStatusMessage(`Moved to step ${stepNumber}: ${step.title}`);
setStatusMessage(`Step ${stepNumber} marked complete`);
setStatusMessage(`Help requested for step ${stepNumber}`);
```

### Focus Management

**Focus order:**
1. Step card heading
2. Instructions link (if external URL exists)
3. Screenshot (if zoomable)
4. Checkpoints (sequential)
5. Help button
6. Mark Complete button
7. Previous/Next navigation buttons

**Focus trap in dialogs:**
```typescript
// Help dialog
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Get Help</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        aria-label="Describe what you need help with"
        autoFocus
      />
      <Button type="submit">Send</Button>
    </form>
  </DialogContent>
</Dialog>

// Auto-focus on dialog open
useEffect(() => {
  if (helpDialogOpen && textareaRef.current) {
    textareaRef.current.focus();
  }
}, [helpDialogOpen]);
```

### Color Contrast

**WCAG AA Compliance:**
- Text on background: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- Interactive elements: 3:1 minimum

**Tested combinations:**
```css
/* Pass WCAG AA */
--text-primary: hsl(222, 47%, 11%);     /* Dark text */
--text-background: hsl(0, 0%, 100%);    /* White background */
/* Contrast ratio: 15.8:1 */

/* Pass WCAG AA */
--button-primary: hsl(221, 83%, 53%);   /* Blue button */
--button-text: hsl(0, 0%, 100%);        /* White text */
/* Contrast ratio: 4.9:1 */

/* Pass WCAG AA Large Text */
--badge-text: hsl(142, 76%, 36%);       /* Green text */
--badge-bg: hsl(143, 85%, 96%);         /* Light green bg */
/* Contrast ratio: 3.2:1 */
```

---

## Mobile Responsiveness

### Breakpoints

**Tailwind defaults:**
```css
sm: 640px   /* Small devices (landscape phones) */
md: 768px   /* Medium devices (tablets) */
lg: 1024px  /* Large devices (desktops) */
xl: 1280px  /* Extra large devices */
```

### Mobile-Specific Adjustments

**Component: GuidedAcquisitionFlow**
```typescript
// Desktop (md+): Max width 3xl, centered
// Mobile: Full width with padding
<div className="w-full max-w-3xl mx-auto px-4 md:px-0">
  {/* Flow content */}
</div>
```

**Component: AcquisitionFlowHeader**
```typescript
// Desktop: Horizontal layout
// Mobile: Vertical stack
<div className="flex flex-col md:flex-row items-start md:items-center gap-3">
  <div className="flex items-center gap-3">
    {/* Service info */}
  </div>
  <Badge>{difficulty}</Badge>
</div>

// Progress text
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
  <span className="text-sm">
    {completedSteps} of {totalSteps} complete
  </span>
  <span className="text-sm">
    {timeRemaining} remaining
  </span>
</div>
```

**Component: AcquisitionStepCard**
```typescript
// Desktop: Side-by-side checkboxes and labels
// Mobile: Stacked checkboxes (more tappable)
<div className="space-y-2 md:space-y-1">
  {checkpoints.map((checkpoint) => (
    <div className="flex items-start gap-2 py-2 md:py-1">
      <Checkbox className="mt-1" />
      <label className="text-sm leading-relaxed">
        {checkpoint}
      </label>
    </div>
  ))}
</div>

// Buttons: Full width on mobile
<div className="flex flex-col sm:flex-row gap-3">
  <Button className="flex-1">
    Mark Complete
  </Button>
  <Button variant="outline" className="sm:w-auto">
    Get Help
  </Button>
</div>
```

**Component: ServiceComparisonTable**
```typescript
// Desktop: 3 columns
// Tablet: 2 columns
// Mobile: 1 column
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {services.map((service) => (
    <ServiceCard key={service.id} service={service} />
  ))}
</div>
```

**Component: CostEstimator**
```typescript
// Slider: Full width on all screens (responsive by nature)
// Cost display: Adjust font size
<p className="text-2xl md:text-3xl font-bold">
  ${cost.toFixed(2)}
  <span className="text-base md:text-lg">/month</span>
</p>
```

### Touch Targets

**Minimum size: 44px x 44px (iOS/Android guideline)**

```typescript
// Checkboxes: Increase touch area
<Checkbox className="h-5 w-5 touch-manipulation" />

// Buttons: Sufficient height
<Button size="lg" className="min-h-[44px] touch-manipulation">
  Mark Complete
</Button>

// Step circles: Tappable
<button className="w-10 h-10 md:w-8 md:h-8 touch-manipulation">
  {stepNumber}
</button>
```

### Gesture Support

**Swipe navigation (optional enhancement):**
```typescript
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => {
    if (canGoNext) nextStep();
  },
  onSwipedRight: () => {
    if (!isFirstStep) previousStep();
  },
  preventDefaultTouchmoveEvent: true,
  trackMouse: false
});

<div {...handlers} className="flow-container">
  {/* Flow content */}
</div>
```

---

## Error Handling

### Error Types

**1. Flow Loading Errors**

**Scenario:** Failed to load acquisition flow from backend

```typescript
// Error state
interface FlowError {
  type: 'load_error' | 'generation_error' | 'save_error';
  message: string;
  retryable: boolean;
}

// Component display
{error && (
  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
    <div className="flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-semibold text-red-900 dark:text-red-100">
          Unable to Load Flow
        </h4>
        <p className="text-sm text-red-800 dark:text-red-200 mt-1">
          {error.message}
        </p>
        {error.retryable && (
          <Button
            onClick={retryLoadFlow}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            Try Again
          </Button>
        )}
      </div>
    </div>
  </div>
)}
```

**2. Step Validation Errors**

**Scenario:** User tries to proceed without completing required checkpoints

```typescript
// Validation logic
const canMarkComplete = step.checkpoints.every(
  checkpoint => checkpointStates.get(checkpoint) === true
);

// Button state
<Button
  onClick={handleMarkComplete}
  disabled={!canMarkComplete}
  className="flex-1"
>
  {!canMarkComplete && (
    <Tooltip>
      <TooltipTrigger>
        <AlertCircle className="h-4 w-4 mr-2" />
      </TooltipTrigger>
      <TooltipContent>
        Complete all checkpoints before proceeding
      </TooltipContent>
    </Tooltip>
  )}
  Mark Complete
</Button>

// Error message
{showValidationError && (
  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded">
    <p className="text-sm text-amber-800 dark:text-amber-200">
      Please verify all checkpoints before marking this step complete.
    </p>
  </div>
)}
```

**3. Help Request Errors**

**Scenario:** Failed to send help request to AI

```typescript
async function handleHelpRequest(question: string) {
  setHelpLoading(true);
  setHelpError(null);

  try {
    await sendMessage(question);
    setHelpDialogOpen(false);
    toast.success('Help request sent to AI assistant');
  } catch (error) {
    setHelpError(
      'Unable to send help request. Please try again or ask your question directly in chat.'
    );
  } finally {
    setHelpLoading(false);
  }
}

// Error display in dialog
{helpError && (
  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
    <p className="text-sm text-red-800 dark:text-red-200">
      {helpError}
    </p>
  </div>
)}
```

**4. Save Progress Errors**

**Scenario:** Failed to save flow progress to backend

```typescript
async function saveProgress() {
  try {
    await saveFlowProgress(flowId, flowState);
  } catch (error) {
    console.error('Failed to save flow progress:', error);

    // Don't block user, just notify
    toast.error(
      'Progress auto-save failed. Your progress is still saved locally.',
      { duration: 3000 }
    );
  }
}
```

**5. Screenshot Loading Errors**

**Scenario:** Screenshot image fails to load

```typescript
<img
  src={step.screenshot}
  alt={`Step ${step.stepNumber} screenshot`}
  onError={(e) => {
    e.currentTarget.src = '/images/placeholder-screenshot.png';
    e.currentTarget.onerror = null; // Prevent infinite loop
  }}
  className="rounded-lg border"
/>

// Alternative: Show message
{screenshotError && (
  <div className="p-4 bg-muted rounded-lg border border-dashed">
    <p className="text-sm text-muted-foreground text-center">
      Screenshot unavailable. Please refer to the written instructions.
    </p>
  </div>
)}
```

---

## Loading States

### Initial Flow Loading

```typescript
// While flow is being generated by AI
{isLoadingFlow && (
  <div className="flow-loading p-8 flex flex-col items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
    <p className="text-sm text-muted-foreground text-center">
      AI is generating your {serviceName} acquisition guide...
    </p>
    <p className="text-xs text-muted-foreground mt-2">
      This usually takes 5-10 seconds
    </p>
  </div>
)}
```

### Step Transition Loading

```typescript
// Brief loading when transitioning between steps
{isTransitioning && (
  <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
    <div className="bg-card p-4 rounded-lg shadow-lg">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  </div>
)}
```

### Screenshot Loading

```typescript
// Skeleton while screenshot loads
<div className="relative">
  {!screenshotLoaded && (
    <div className="absolute inset-0 bg-muted animate-pulse rounded-lg" />
  )}
  <img
    src={step.screenshot}
    alt={`Step ${step.stepNumber} screenshot`}
    onLoad={() => setScreenshotLoaded(true)}
    className={`rounded-lg border transition-opacity duration-300 ${
      screenshotLoaded ? 'opacity-100' : 'opacity-0'
    }`}
  />
</div>
```

### Save Secret Loading

```typescript
// While saving API key
<Button
  onClick={handleSave}
  disabled={isSaving}
  className="w-full"
>
  {isSaving ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Encrypting and saving...
    </>
  ) : (
    <>
      <Lock className="mr-2 h-4 w-4" />
      Save Securely
    </>
  )}
</Button>
```

---

## Success States

### Step Completion Success

```typescript
// Visual feedback when step is marked complete
{justCompleted && (
  <div className="absolute inset-0 bg-green-500/10 rounded-lg flex items-center justify-center">
    <div className="bg-card p-6 rounded-lg shadow-lg border-2 border-green-500 animate-in zoom-in duration-200">
      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
      <p className="font-semibold text-center">Step Complete!</p>
    </div>
  </div>
)}

// Smooth transition after 500ms
useEffect(() => {
  if (justCompleted) {
    const timer = setTimeout(() => {
      setJustCompleted(false);
      nextStep();
    }, 500);
    return () => clearTimeout(timer);
  }
}, [justCompleted]);
```

### Flow Completion Success

```typescript
// Celebration when entire flow is complete
{isFlowComplete && (
  <div className="success-banner p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-500 rounded-lg">
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-white" />
        </div>
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
          🎉 Congratulations!
        </h3>
        <p className="text-sm text-green-800 dark:text-green-200 mb-4">
          You've successfully completed the {serviceName} API key acquisition.
          Your key has been securely saved to Abyrith with zero-knowledge encryption.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-green-500 text-white">
            Time taken: {completionTime}
          </Badge>
          <Badge className="bg-green-500 text-white">
            Steps completed: {flow.steps.length}
          </Badge>
        </div>
      </div>
    </div>
  </div>
)}

// Confetti animation (optional)
{isFlowComplete && (
  <Confetti
    width={window.innerWidth}
    height={window.innerHeight}
    recycle={false}
    numberOfPieces={200}
    gravity={0.3}
  />
)}
```

### Help Request Sent Success

```typescript
// Toast notification
toast.success(
  'Help request sent! The AI will respond in chat.',
  {
    icon: <HelpCircle className="h-4 w-4" />,
    duration: 3000
  }
);

// Dialog closes automatically
setHelpDialogOpen(false);
```

---

## Integration Points

### With AI Chat Interface

**Flow is rendered inside AssistantMessage:**

```typescript
// components/ai/AssistantMessage.tsx
export function AssistantMessage({ message }: { message: Message }) {
  // Check if message contains acquisition flow
  const hasFlow = message.metadata?.type === 'acquisition_flow';

  return (
    <div className="assistant-message">
      {/* Regular markdown content */}
      <ReactMarkdown>{message.content}</ReactMarkdown>

      {/* Acquisition flow (if present) */}
      {hasFlow && (
        <div className="mt-4">
          <GuidedAcquisitionFlow
            flowId={message.metadata.flowId}
            serviceName={message.metadata.serviceName}
            flow={message.metadata.flow}
            conversationId={message.conversation_id}
            onComplete={(secretId) => {
              // Notify AI of success
              sendMessage(`Successfully saved ${message.metadata.serviceName} key!`);
            }}
          />
        </div>
      )}
    </div>
  );
}
```

### With Secrets API

**Saving API key after flow completion:**

```typescript
// lib/api/secrets.ts
import { useCreateSecret } from './secrets';
import { encrypt } from '@/lib/crypto/encryption';
import { getMasterKey } from '@/lib/crypto/keyStorage';

async function saveAcquiredKey(
  serviceName: string,
  apiKey: string,
  projectId: string,
  environment: Environment
) {
  // Encrypt client-side
  const masterKey = await getMasterKey();
  if (!masterKey) {
    throw new Error('Master key not available');
  }

  const encryptedValue = await encrypt(apiKey, masterKey);

  // Create secret
  const { mutate: createSecret } = useCreateSecret();

  return new Promise((resolve, reject) => {
    createSecret(
      {
        name: `${serviceName} API Key`,
        encrypted_value: encryptedValue,
        service_name: serviceName,
        project_id: projectId,
        environment,
        tags: ['api-key', 'acquired-via-ai', serviceName.toLowerCase()],
        metadata: {
          acquired_via: 'guided_flow',
          flow_completed_at: new Date().toISOString()
        }
      },
      {
        onSuccess: (data) => resolve(data.id),
        onError: (error) => reject(error)
      }
    );
  });
}
```

### With Conversation Management

**Saving flow progress to conversation context:**

```typescript
// Backend: Save flow state to conversation
async function saveFlowProgress(
  conversationId: string,
  flowId: string,
  progress: FlowProgress
) {
  await supabase
    .from('conversation_messages')
    .update({
      metadata: {
        type: 'acquisition_flow',
        flowId,
        progress,
        lastUpdated: new Date().toISOString()
      }
    })
    .eq('id', flowId);
}

// Resume flow from conversation
async function resumeFlowFromConversation(conversationId: string) {
  const { data } = await supabase
    .from('conversation_messages')
    .select('metadata')
    .eq('conversation_id', conversationId)
    .eq('metadata->type', 'acquisition_flow')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.metadata) {
    return {
      flowId: data.metadata.flowId,
      flow: data.metadata.flow,
      progress: data.metadata.progress
    };
  }

  return null;
}
```

---

## Code Examples

### Complete Example: SaveSecretForm Component

```typescript
// components/ai/SaveSecretForm.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useCreateSecret } from '@/lib/api/secrets';
import { encrypt } from '@/lib/crypto/encryption';
import { getMasterKey } from '@/lib/crypto/keyStorage';
import { toast } from 'sonner';

interface SaveSecretFormProps {
  serviceName: string;
  projectId?: string;
  environment?: Environment;
  onSave: (secretId: string) => void;
}

export function SaveSecretForm({
  serviceName,
  projectId,
  environment = 'development',
  onSave
}: SaveSecretFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState(`${serviceName} API Key`);
  const [selectedEnv, setSelectedEnv] = useState<Environment>(environment);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { mutate: createSecret } = useCreateSecret();

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your API key');
      return;
    }

    setIsSaving(true);

    try {
      // Get master key
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available. Please unlock your vault.');
      }

      // Encrypt API key
      const encryptedValue = await encrypt(apiKey, masterKey);

      // Save to Abyrith
      createSecret(
        {
          name,
          encrypted_value: encryptedValue,
          service_name: serviceName,
          project_id: projectId,
          environment: selectedEnv,
          tags: ['api-key', 'acquired-via-ai', serviceName.toLowerCase()],
          metadata: {
            acquired_via: 'guided_flow',
            acquired_at: new Date().toISOString()
          }
        },
        {
          onSuccess: (data) => {
            setIsSaved(true);
            toast.success('API key saved securely!');
            onSave(data.id);
          },
          onError: (error) => {
            console.error('Failed to save secret:', error);
            toast.error('Failed to save API key. Please try again.');
          }
        }
      );
    } catch (error) {
      console.error('Encryption error:', error);
      toast.error('Failed to encrypt API key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isSaved) {
    return (
      <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-500 flex flex-col items-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
        <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">
          Saved Successfully!
        </h3>
        <p className="text-sm text-green-800 dark:text-green-200 text-center">
          Your {serviceName} API key has been encrypted and stored securely.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="space-y-4"
    >
      {/* Name */}
      <div>
        <Label htmlFor="secret-name">Secret Name</Label>
        <Input
          id="secret-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${serviceName} API Key`}
          className="mt-1"
        />
      </div>

      {/* API Key */}
      <div>
        <Label htmlFor="api-key">API Key</Label>
        <div className="relative mt-1">
          <Input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key here"
            className="pr-10"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Environment */}
      <div>
        <Label htmlFor="environment">Environment</Label>
        <Select value={selectedEnv} onValueChange={setSelectedEnv}>
          <SelectTrigger id="environment" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Security notice */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Your API key will be encrypted client-side before being saved.
            Only you can decrypt it with your master password.
          </p>
        </div>
      </div>

      {/* Save button */}
      <Button
        type="submit"
        disabled={isSaving || !apiKey.trim()}
        className="w-full"
        size="lg"
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Encrypting and saving...
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Save Securely
          </>
        )}
      </Button>
    </form>
  );
}
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `07-frontend/frontend-architecture.md` - Frontend architecture (VERIFIED)
- [x] `07-frontend/ai/ai-chat-interface.md` - Chat interface structure (VERIFIED)
- [x] `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant features (VERIFIED)
- [x] `TECH-STACK.md` - React, Next.js, Tailwind, shadcn/ui (VERIFIED)
- [ ] `05-api/endpoints/secrets-endpoints.md` - Secrets API (NEEDS VERIFICATION)
- [ ] `04-database/schemas/acquisition-flows-schema.md` - Flow persistence schema (NEEDS CREATION)

**External Services:**
- Claude API - Generates acquisition flows
- FireCrawl API - Scrapes service documentation
- Supabase - Stores flow progress and secrets

### Component Dependencies

**shadcn/ui Components Used:**
- Badge
- Button
- Card
- Checkbox
- Dialog
- Input
- Label
- Progress
- Select
- Slider
- Tooltip

**Third-party Libraries:**
- react-markdown - Markdown rendering
- lucide-react - Icons
- sonner - Toast notifications
- zustand - State management
- react-confetti (optional) - Celebration animation

---

## References

### Internal Documentation
- `07-frontend/frontend-architecture.md` - Frontend architecture patterns
- `07-frontend/ai/ai-chat-interface.md` - Chat UI structure
- `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant feature spec
- `08-features/ai-assistant/guided-acquisition.md` - Acquisition flow logic (if exists)
- `TECH-STACK.md` - Technology specifications
- `GLOSSARY.md` - Term definitions

### External Resources
- [React Hook Form](https://react-hook-form.com/) - Form handling patterns
- [shadcn/ui Documentation](https://ui.shadcn.com) - Component usage
- [Lucide Icons](https://lucide.dev) - Icon library
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility standards
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design) - Breakpoint patterns

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial comprehensive component documentation for guided acquisition flow |

---

## Notes

### Future Enhancements
- **Video tutorials:** Embed video walkthroughs for complex steps
- **Interactive demos:** Sandbox environment to practice API calls
- **Voice guidance:** Text-to-speech for instructions
- **Multi-language support:** Translate flows to user's preferred language
- **Gamification:** Badges and achievements for completing flows
- **Flow sharing:** Share custom flows with team members
- **Flow templates:** User-created templates for internal services

### Known Limitations
- Screenshots may become outdated as services update their UI (mitigated by AI regeneration)
- Flow generation depends on FireCrawl availability
- Complex signup flows (requiring SMS/2FA) can't be automated
- Some services have geographic restrictions not easily detectable

### Performance Considerations
- Large screenshots may impact load time (consider lazy loading)
- Flow state persistence could be optimized with IndexedDB
- Consider pagination for services with 10+ steps
- Virtual scrolling for long instruction blocks

### Accessibility Improvements
- Add keyboard shortcut documentation page
- Implement focus visible styles consistently
- Test with multiple screen readers (NVDA, JAWS, VoiceOver)
- Add high contrast mode support

### Next Review Date
2025-11-30 (review after initial implementation and user testing)
