/**
 * useAiChat Hook - Example Usage
 *
 * This file demonstrates how to use the useAiChat hook in various scenarios.
 * Use these examples as templates for your components.
 */

import { useState } from 'react';
import { useAiChat } from './use-ai-chat';
import { useAIStore } from '@/lib/stores/ai-store';
import { ErrorMessage } from '@/components/ai/ErrorMessage';
import { StreamingIndicator } from '@/components/ai/StreamingIndicator';

/**
 * Example 1: Basic Chat Component
 */
export function BasicChatExample() {
  const { currentConversation } = useAIStore();

  const { sendMessage, isLoading, isStreaming, error, retry } = useAiChat({
    conversationId: currentConversation?.id || 'temp',
    streaming: true,
  });

  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorMessage error={error} onRetry={retry} />}

      {isStreaming && <StreamingIndicator state="streaming" />}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={isLoading}
        placeholder="Type a message..."
      />

      <button onClick={handleSend} disabled={isLoading || !input.trim()}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}

/**
 * Example 2: Guided Acquisition Flow
 */
export function GuidedAcquisitionExample() {
  const {
    acquisition,
    startAcquisition,
    nextStep,
    setAcquisitionSteps,
  } = useAIStore();

  const { sendMessage, isLoading, error, retry } = useAiChat({
    conversationId: 'acquisition-flow',
    streaming: true,
    projectContext: {
      projectId: acquisition.selectedService?.id,
    },
    onResponseReceived: (response) => {
      // Parse AI response for acquisition steps
      const steps = parseAcquisitionSteps(response);
      setAcquisitionSteps(steps);
      nextStep();
    },
  });

  const startFlow = async (serviceName: string) => {
    startAcquisition({ name: serviceName, id: 'svc-123' } as any);

    await sendMessage(
      `I need to get an API key for ${serviceName}. Please provide step-by-step instructions on how to acquire it, including any prerequisites.`
    );
  };

  return (
    <div>
      {!acquisition.isActive ? (
        <button onClick={() => startFlow('OpenAI')}>
          Start OpenAI Key Acquisition
        </button>
      ) : (
        <div>
          <h2>Step {acquisition.currentStep + 1} of 5</h2>
          {isLoading && <StreamingIndicator state="thinking" />}
          {error && <ErrorMessage error={error} onRetry={retry} />}
          {/* Display acquisition steps */}
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Context-Aware Chat
 */
export function ContextAwareChatExample() {
  const {
    contextProjectId,
    contextEnvironmentId,
    currentConversation,
  } = useAIStore();

  const { sendMessage, isLoading, error } = useAiChat({
    conversationId: currentConversation?.id || 'temp',
    projectContext: {
      projectId: contextProjectId || undefined,
      environmentId: contextEnvironmentId || undefined,
    },
    onMessageSent: (message) => {
      console.log('Message sent with context:', {
        message,
        projectId: contextProjectId,
        environmentId: contextEnvironmentId,
      });
    },
  });

  const askContextQuestion = async () => {
    // AI will know which project/environment the user is in
    await sendMessage(
      'What secrets do I have in this environment?'
    );
  };

  return (
    <div>
      {contextProjectId && (
        <p>Current Project: {contextProjectId}</p>
      )}
      <button onClick={askContextQuestion} disabled={isLoading}>
        Ask About Current Environment
      </button>
      {error && <ErrorMessage error={error} />}
    </div>
  );
}

/**
 * Example 4: Non-Streaming Chat (Simpler)
 */
export function NonStreamingChatExample() {
  const { currentConversation } = useAIStore();

  const { sendMessage, isLoading, error, retry } = useAiChat({
    conversationId: currentConversation?.id || 'temp',
    streaming: false, // Disable streaming
  });

  const [input, setInput] = useState('');

  const handleSend = async () => {
    await sendMessage(input);
    setInput('');
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <ErrorMessage error={error} onRetry={retry} />}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isLoading}
      />
      <button onClick={handleSend} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}

/**
 * Example 5: With Custom Error Handling
 */
export function CustomErrorHandlingExample() {
  const { currentConversation } = useAIStore();
  const [customError, setCustomError] = useState<string | null>(null);

  const { sendMessage, isLoading, error } = useAiChat({
    conversationId: currentConversation?.id || 'temp',
    onError: (err) => {
      // Custom error handling
      if (err.code === 'RATE_LIMIT_EXCEEDED') {
        setCustomError('Please wait a moment before sending another message.');
      } else if (err.code === 'NETWORK_ERROR') {
        setCustomError('Connection lost. Please check your internet.');
      } else {
        setCustomError(err.message);
      }
    },
  });

  return (
    <div>
      {customError && (
        <div className="error-banner">
          {customError}
          <button onClick={() => setCustomError(null)}>Dismiss</button>
        </div>
      )}
      {/* Rest of component */}
    </div>
  );
}

/**
 * Example 6: Cancel Streaming
 */
export function CancellableStreamExample() {
  const { currentConversation } = useAIStore();

  const { sendMessage, isStreaming, cancel } = useAiChat({
    conversationId: currentConversation?.id || 'temp',
  });

  const askLongQuestion = async () => {
    await sendMessage(
      'Explain in detail how zero-knowledge encryption works...'
    );
  };

  return (
    <div>
      <button onClick={askLongQuestion}>
        Ask Long Question
      </button>

      {isStreaming && (
        <div>
          <StreamingIndicator state="streaming" />
          <button onClick={cancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/**
 * Helper: Parse acquisition steps from AI response
 */
function parseAcquisitionSteps(response: string) {
  // Parse markdown list or numbered steps
  const lines = response.split('\n');
  const steps = lines
    .filter(line => /^\d+\./.test(line) || /^-/.test(line))
    .map((line, index) => ({
      id: `step-${index}`,
      stepNumber: index + 1,
      title: line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''),
      description: '',
      completed: false,
    }));

  return steps;
}

/**
 * Example 7: Multiple Conversations
 */
export function MultipleConversationsExample() {
  const [activeConvId, setActiveConvId] = useState<string>('conv-1');

  const { sendMessage: sendToConv1 } = useAiChat({
    conversationId: 'conv-1',
  });

  const { sendMessage: sendToConv2 } = useAiChat({
    conversationId: 'conv-2',
  });

  return (
    <div>
      <button onClick={() => setActiveConvId('conv-1')}>
        Conversation 1
      </button>
      <button onClick={() => setActiveConvId('conv-2')}>
        Conversation 2
      </button>

      {activeConvId === 'conv-1' ? (
        <div>
          <button onClick={() => sendToConv1('Hello from conv 1')}>
            Send to Conv 1
          </button>
        </div>
      ) : (
        <div>
          <button onClick={() => sendToConv2('Hello from conv 2')}>
            Send to Conv 2
          </button>
        </div>
      )}
    </div>
  );
}
