/**
 * AI Assistant Store
 *
 * Manages AI chat state, conversations, and message history
 */

import { create } from 'zustand';
import { supabase } from '@/lib/api/supabase';
import type { ServiceInfo } from '@/lib/services/service-detection';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    context?: {
      projectId?: string;
      environmentId?: string;
      secretId?: string;
    };
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  projectId?: string;
  environmentId?: string;
}

export interface AcquisitionStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  completed: boolean;
  details?: string; // Expandable details
  screenshotUrl?: string;
}

export interface AcquisitionState {
  isActive: boolean;
  currentStep: number; // 0-4 (Service, Docs, Steps, Validate, Save)
  selectedService: ServiceInfo | null;
  documentation: string | null;
  scrapedAt: string | null;
  steps: AcquisitionStep[];
  acquiredKey: string | null;
  keyMetadata: {
    keyName?: string; // e.g., "OPENAI_API_KEY"
    description?: string;
    tags?: string[];
  };
  progress: {
    [stepIndex: number]: boolean;
  };
}

interface AIState {
  // Current conversation
  currentConversation: Conversation | null;
  conversations: Conversation[];

  // UI state
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;

  // Context
  contextProjectId: string | null;
  contextEnvironmentId: string | null;

  // Guided Acquisition state
  acquisition: AcquisitionState;

  // Conversation Actions
  createConversation: (title?: string) => Conversation;
  setCurrentConversation: (conversationId: string) => void;
  loadConversations: () => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;

  setTyping: (isTyping: boolean) => void;
  setContext: (projectId: string | null, environmentId: string | null) => void;

  clearCurrentConversation: () => void;
  deleteConversation: (conversationId: string) => void;

  // Guided Acquisition Actions
  startAcquisition: (service: ServiceInfo) => void;
  cancelAcquisition: () => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  setDocumentation: (markdown: string, scrapedAt: string) => void;
  setAcquisitionSteps: (steps: AcquisitionStep[]) => void;
  completeAcquisitionStep: (stepId: string) => void;
  setAcquiredKey: (key: string, metadata?: Partial<AcquisitionState['keyMetadata']>) => void;
  resetAcquisition: () => void;
}

const initialAcquisitionState: AcquisitionState = {
  isActive: false,
  currentStep: 0,
  selectedService: null,
  documentation: null,
  scrapedAt: null,
  steps: [],
  acquiredKey: null,
  keyMetadata: {},
  progress: {},
};

export const useAIStore = create<AIState>((set, get) => ({
  currentConversation: null,
  conversations: [],
  isTyping: false,
  isLoading: false,
  error: null,
  contextProjectId: null,
  contextEnvironmentId: null,
  acquisition: initialAcquisitionState,

  /**
   * Create a new conversation
   */
  createConversation: (title = 'New Conversation') => {
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      projectId: get().contextProjectId || undefined,
      environmentId: get().contextEnvironmentId || undefined,
    };

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversation: conversation,
    }));

    return conversation;
  },

  /**
   * Set the current conversation
   */
  setCurrentConversation: (conversationId: string) => {
    const conversation = get().conversations.find((c) => c.id === conversationId);
    if (conversation) {
      set({ currentConversation: conversation });
    }
  },

  /**
   * Load conversation history from backend
   */
  loadConversations: async () => {
    set({ isLoading: true, error: null });

    try {
      const { listConversations } = await import('@/lib/api/ai');
      const apiConversations = await listConversations();

      // Convert API response to store format
      const storeConversations: Conversation[] = apiConversations.map((conv) => ({
        id: conv.id,
        title: conv.title,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: [], // Messages loaded separately when conversation is selected
        projectId: conv.projectId,
        environmentId: conv.environmentId,
      }));

      set({ conversations: storeConversations, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load conversations';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Send a message using real Claude API (via Workers)
   * Note: For better control, use the useAiChat hook instead
   */
  sendMessage: async (content: string) => {
    const { currentConversation, addMessage, setTyping, contextProjectId, contextEnvironmentId } = get();

    if (!currentConversation) {
      set({ error: 'No active conversation' });
      return;
    }

    // Add user message
    addMessage({
      role: 'user',
      content,
      metadata: {
        context: {
          projectId: contextProjectId || undefined,
          environmentId: contextEnvironmentId || undefined,
        },
      },
    });

    // Show typing indicator
    setTyping(true);

    try {
      const { streamMessage } = await import('@/lib/api/ai');

      let fullContent = '';

      // Send message with streaming
      await streamMessage(
        {
          message: content,
          conversationId: currentConversation.id,
          projectContext: {
            projectId: contextProjectId || undefined,
            environmentId: contextEnvironmentId || undefined,
          },
        },
        // onChunk
        (chunk: string) => {
          fullContent += chunk;

          // Update message in real-time as chunks arrive
          // Note: This is a simplified version - in production you'd want to
          // track the message ID and update it specifically
          addMessage({
            role: 'assistant',
            content: fullContent,
            metadata: {
              model: 'claude-3-5-sonnet-20241022',
            },
          });
        },
        // onComplete
        (response) => {
          setTyping(false);
        },
        // onError
        (error) => {
          const errorMessage = error.message || 'Failed to send message';
          set({ error: errorMessage });
          setTyping(false);
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      set({ error: errorMessage });
      setTyping(false);
    }
  },

  /**
   * Add a message to the current conversation
   */
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => {
    const { currentConversation } = get();

    if (!currentConversation) {
      set({ error: 'No active conversation' });
      return;
    }

    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    const updatedConversation: Conversation = {
      ...currentConversation,
      messages: [...currentConversation.messages, newMessage],
      updatedAt: new Date(),
    };

    // Update title based on first user message
    if (currentConversation.messages.length === 0 && message.role === 'user') {
      updatedConversation.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
    }

    set((state) => ({
      currentConversation: updatedConversation,
      conversations: state.conversations.map((c) =>
        c.id === currentConversation.id ? updatedConversation : c
      ),
    }));
  },

  /**
   * Set typing indicator
   */
  setTyping: (isTyping: boolean) => {
    set({ isTyping });
  },

  /**
   * Set current context (project/environment)
   */
  setContext: (projectId: string | null, environmentId: string | null) => {
    set({ contextProjectId: projectId, contextEnvironmentId: environmentId });
  },

  /**
   * Clear current conversation
   */
  clearCurrentConversation: () => {
    set({ currentConversation: null });
  },

  /**
   * Delete a conversation
   */
  deleteConversation: (conversationId: string) => {
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== conversationId);
      const currentConversation =
        state.currentConversation?.id === conversationId
          ? null
          : state.currentConversation;

      return { conversations, currentConversation };
    });
  },

  /**
   * Start guided acquisition flow
   */
  startAcquisition: (service: ServiceInfo) => {
    set({
      acquisition: {
        ...initialAcquisitionState,
        isActive: true,
        currentStep: 0,
        selectedService: service,
        keyMetadata: {
          keyName: `${service.name.toUpperCase().replace(/\s+/g, '_')}_API_KEY`,
        },
      },
    });
  },

  /**
   * Cancel acquisition flow
   */
  cancelAcquisition: () => {
    set({ acquisition: initialAcquisitionState });
  },

  /**
   * Go to next step
   */
  nextStep: () => {
    set((state) => {
      const currentStep = state.acquisition.currentStep;
      const nextStep = Math.min(4, currentStep + 1);
      return {
        acquisition: {
          ...state.acquisition,
          currentStep: nextStep,
          progress: {
            ...state.acquisition.progress,
            [currentStep]: true,
          },
        },
      };
    });
  },

  /**
   * Go to previous step
   */
  previousStep: () => {
    set((state) => ({
      acquisition: {
        ...state.acquisition,
        currentStep: Math.max(0, state.acquisition.currentStep - 1),
      },
    }));
  },

  /**
   * Go to specific step
   */
  goToStep: (step: number) => {
    set((state) => ({
      acquisition: {
        ...state.acquisition,
        currentStep: Math.max(0, Math.min(4, step)),
      },
    }));
  },

  /**
   * Set scraped documentation
   */
  setDocumentation: (markdown: string, scrapedAt: string) => {
    set((state) => ({
      acquisition: {
        ...state.acquisition,
        documentation: markdown,
        scrapedAt,
      },
    }));
  },

  /**
   * Set acquisition steps
   */
  setAcquisitionSteps: (steps: AcquisitionStep[]) => {
    set((state) => ({
      acquisition: {
        ...state.acquisition,
        steps,
      },
    }));
  },

  /**
   * Mark a step as complete
   */
  completeAcquisitionStep: (stepId: string) => {
    set((state) => ({
      acquisition: {
        ...state.acquisition,
        steps: state.acquisition.steps.map((step) =>
          step.id === stepId ? { ...step, completed: true } : step
        ),
      },
    }));
  },

  /**
   * Set acquired API key
   */
  setAcquiredKey: (key: string, metadata = {}) => {
    set((state) => ({
      acquisition: {
        ...state.acquisition,
        acquiredKey: key,
        keyMetadata: {
          ...state.acquisition.keyMetadata,
          ...metadata,
        },
      },
    }));
  },

  /**
   * Reset acquisition state
   */
  resetAcquisition: () => {
    set({ acquisition: initialAcquisitionState });
  },
}));
