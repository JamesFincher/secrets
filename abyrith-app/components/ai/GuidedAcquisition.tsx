'use client';

import { useEffect, useState } from 'react';
import { useAIStore, type AcquisitionStep } from '@/lib/stores/ai-store';
import { useProjectStore } from '@/lib/stores/project-store';
import { useSecretStore } from '@/lib/stores/secret-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { detectService } from '@/lib/services/service-detection';
import { ServiceSelector } from './ServiceSelector';
import { DocumentationViewer } from './DocumentationViewer';
import { StepViewer } from './StepViewer';
import { KeyValidator } from './KeyValidator';
import { MasterPasswordPrompt } from '@/components/auth/MasterPasswordPrompt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Guided Acquisition Wizard
 *
 * Multi-step wizard that guides users through acquiring an API key:
 * 1. Service Selection
 * 2. Documentation Scraping
 * 3. Step-by-Step Guide
 * 4. Key Validation
 * 5. Save Secret
 */
export function GuidedAcquisition() {
  const {
    acquisition,
    startAcquisition,
    cancelAcquisition,
    nextStep,
    previousStep,
    setDocumentation,
    setAcquisitionSteps,
    completeAcquisitionStep,
    setAcquiredKey,
    resetAcquisition,
  } = useAIStore();

  const { currentProject, environments } = useProjectStore();
  const { createSecret } = useSecretStore();
  const { masterPassword } = useAuthStore();

  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
  const [showMasterPasswordPrompt, setShowMasterPasswordPrompt] = useState(false);

  // Auto-detect service from project name
  const autoDetectedService = currentProject
    ? detectService(currentProject.name, currentProject.description || undefined)
    : null;

  // Select default environment
  useEffect(() => {
    if (environments.length > 0 && !selectedEnvironmentId) {
      // Default to development environment
      const devEnv = environments.find((e) => e.slug === 'development');
      setSelectedEnvironmentId(devEnv?.id || environments[0].id);
    }
  }, [environments, selectedEnvironmentId]);

  const stepTitles = [
    'Select Service',
    'Review Documentation',
    'Follow Steps',
    'Validate Key',
    'Save Secret',
  ];

  const handleServiceSelect = async (service: typeof acquisition.selectedService) => {
    if (!service) return;
    startAcquisition(service);

    // Auto-advance to documentation step
    setTimeout(() => {
      handleScrapeDocumentation();
    }, 500);
  };

  const handleScrapeDocumentation = async () => {
    if (!acquisition.selectedService) return;

    setIsLoadingDocs(true);
    try {
      // Import AI API functions
      const { scrapeServiceDocumentation } = await import('@/lib/api/ai');

      // Call FireCrawl API via Workers
      const data = await scrapeServiceDocumentation(acquisition.selectedService.slug);
      setDocumentation(data.markdown, data.scrapedAt);

      nextStep();

      // Auto-generate steps
      setTimeout(() => {
        handleGenerateSteps();
      }, 500);
    } catch (error) {
      console.error('Error scraping documentation:', error);
      // Use fallback documentation
      setDocumentation(
        `# ${acquisition.selectedService.name} Documentation\n\nPlease visit ${acquisition.selectedService.docsUrl} for complete documentation.`,
        new Date().toISOString()
      );
      nextStep();
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleGenerateSteps = async () => {
    if (!acquisition.selectedService) return;

    setIsGeneratingSteps(true);
    try {
      // Import AI API functions
      const { generateAcquisitionSteps } = await import('@/lib/api/ai');

      // Call Claude API to generate steps
      const steps = await generateAcquisitionSteps(
        acquisition.selectedService,
        acquisition.documentation || undefined
      );

      setAcquisitionSteps(steps);
      nextStep();
    } catch (error) {
      console.error('Error generating steps:', error);

      // Use fallback mock steps on error
      const mockSteps: AcquisitionStep[] = [
        {
          id: '1',
          stepNumber: 1,
          title: `Visit ${acquisition.selectedService.name} website`,
          description: `Go to ${acquisition.selectedService.apiKeysUrl || acquisition.selectedService.docsUrl}`,
          completed: false,
          details: `Open your browser and navigate to the ${acquisition.selectedService.name} API keys page.`,
        },
        {
          id: '2',
          stepNumber: 2,
          title: 'Sign up or log in',
          description: 'Create an account or log in to your existing account',
          completed: false,
          details: 'You may need to verify your email address after signing up.',
        },
        {
          id: '3',
          stepNumber: 3,
          title: 'Navigate to API keys section',
          description: 'Find the API keys or developer settings in your dashboard',
          completed: false,
        },
        {
          id: '4',
          stepNumber: 4,
          title: 'Create new API key',
          description: 'Click "Create new API key" or similar button',
          completed: false,
          details: 'Some services let you set permissions or scopes for your API key.',
        },
        {
          id: '5',
          stepNumber: 5,
          title: 'Copy your API key',
          description: 'Copy the generated API key (you may only see it once!)',
          completed: false,
          details: 'Store it safely - many services only show the key once for security.',
        },
      ];

      setAcquisitionSteps(mockSteps);
      nextStep();
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  const handleValidKey = (key: string) => {
    setAcquiredKey(key);
    nextStep();
  };

  const handleSaveSecret = async () => {
    if (
      !acquisition.selectedService ||
      !acquisition.acquiredKey ||
      !currentProject ||
      !selectedEnvironmentId
    ) {
      return;
    }

    if (!masterPassword) {
      setShowMasterPasswordPrompt(true);
      return;
    }

    await performSaveSecret(masterPassword);
  };

  const performSaveSecret = async (password: string) => {
    if (
      !acquisition.selectedService ||
      !acquisition.acquiredKey ||
      !currentProject ||
      !selectedEnvironmentId
    ) {
      return;
    }

    setIsSaving(true);
    try {
      await createSecret(
        currentProject.id,
        selectedEnvironmentId,
        acquisition.keyMetadata.keyName || `${acquisition.selectedService.slug.toUpperCase()}_API_KEY`,
        acquisition.acquiredKey,
        password,
        {
          description: acquisition.keyMetadata.description || `API key for ${acquisition.selectedService.name}`,
          serviceName: acquisition.selectedService.name,
          tags: acquisition.keyMetadata.tags || [acquisition.selectedService.category],
        }
      );

      // Success! Reset and close
      setTimeout(() => {
        resetAcquisition();
      }, 2000);
    } catch (error) {
      console.error('Error saving secret:', error);
      alert('Failed to save API key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMasterPasswordSuccess = async () => {
    const { masterPassword: newMasterPassword } = useAuthStore.getState();
    if (!newMasterPassword) return;
    await performSaveSecret(newMasterPassword);
  };

  if (!acquisition.isActive) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-background border rounded-lg shadow-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Guided API Key Acquisition</h2>
              <p className="text-muted-foreground">
                {acquisition.selectedService
                  ? `Getting ${acquisition.selectedService.name} API key`
                  : 'Select a service to get started'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={cancelAcquisition}>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            {stepTitles.map((title, index) => (
              <div key={index} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                    index < acquisition.currentStep
                      ? 'bg-primary border-primary text-primary-foreground'
                      : index === acquisition.currentStep
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {index < acquisition.currentStep ? (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                {index < stepTitles.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      index < acquisition.currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {stepTitles.map((title, index) => (
              <div
                key={index}
                className={`text-xs ${
                  index === acquisition.currentStep
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {title}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 0: Service Selection */}
          {acquisition.currentStep === 0 && (
            <ServiceSelector
              onSelectService={handleServiceSelect}
              autoDetectedService={autoDetectedService}
            />
          )}

          {/* Step 1: Documentation */}
          {acquisition.currentStep === 1 &&
            acquisition.selectedService &&
            (isLoadingDocs ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg
                  className="animate-spin h-12 w-12 text-primary mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-lg font-semibold">Scraping documentation...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Fetching latest docs from {acquisition.selectedService.name}
                </p>
              </div>
            ) : acquisition.documentation ? (
              <DocumentationViewer
                service={acquisition.selectedService}
                markdown={acquisition.documentation}
                scrapedAt={acquisition.scrapedAt || new Date().toISOString()}
              />
            ) : null)}

          {/* Step 2: Steps */}
          {acquisition.currentStep === 2 &&
            (isGeneratingSteps ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg
                  className="animate-spin h-12 w-12 text-primary mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-lg font-semibold">Generating acquisition steps...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  AI is creating personalized instructions for you
                </p>
              </div>
            ) : (
              <StepViewer
                steps={acquisition.steps}
                onStepComplete={completeAcquisitionStep}
              />
            ))}

          {/* Step 3: Validate */}
          {acquisition.currentStep === 3 && acquisition.selectedService && (
            <KeyValidator
              service={acquisition.selectedService}
              onValidKey={handleValidKey}
              initialKey={acquisition.acquiredKey || ''}
            />
          )}

          {/* Step 4: Save */}
          {acquisition.currentStep === 4 && acquisition.selectedService && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Save Your API Key</h3>
                <p className="text-sm text-muted-foreground">
                  Configure how to store your {acquisition.selectedService.name} API key
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    value={acquisition.keyMetadata.keyName || ''}
                    onChange={(e) =>
                      setAcquiredKey(acquisition.acquiredKey || '', {
                        keyName: e.target.value,
                      })
                    }
                    placeholder="e.g., OPENAI_API_KEY"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={acquisition.keyMetadata.description || ''}
                    onChange={(e) =>
                      setAcquiredKey(acquisition.acquiredKey || '', {
                        description: e.target.value,
                      })
                    }
                    placeholder={`API key for ${acquisition.selectedService.name}`}
                  />
                </div>

                <div>
                  <Label htmlFor="environment">Environment</Label>
                  <select
                    id="environment"
                    value={selectedEnvironmentId}
                    onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold text-green-700 dark:text-green-400">
                      Ready to save!
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Your API key will be encrypted with AES-256-GCM and stored securely.
                      Only you can decrypt it with your master password.
                    </p>
                  </div>
                </div>
              </div>

              {isSaving && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
                  <div className="flex items-center gap-3">
                    <svg
                      className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                      Encrypting and saving your API key...
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={previousStep}
            disabled={acquisition.currentStep === 0 || isLoadingDocs || isGeneratingSteps}
          >
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Button>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={cancelAcquisition}>
              Cancel
            </Button>

            {acquisition.currentStep < 4 && (
              <Button
                onClick={nextStep}
                disabled={
                  !acquisition.selectedService ||
                  isLoadingDocs ||
                  isGeneratingSteps ||
                  (acquisition.currentStep === 3 && !acquisition.acquiredKey)
                }
              >
                Next
                <svg
                  className="h-4 w-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            )}

            {acquisition.currentStep === 4 && (
              <Button onClick={handleSaveSecret} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save & Finish'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <MasterPasswordPrompt
        open={showMasterPasswordPrompt}
        onOpenChange={setShowMasterPasswordPrompt}
        onSuccess={handleMasterPasswordSuccess}
      />
    </div>
  );
}
