'use client';

import { useEffect, useRef } from 'react';
import { useAIStore } from '@/lib/stores/ai-store';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { ContextPanel } from './ContextPanel';
import { ChatHistory } from './ChatHistory';

/**
 * Chat Interface Component
 *
 * Main AI chat interface with message list, input, and sidebar
 */
export function ChatInterface() {
  const {
    currentConversation,
    isTyping,
    sendMessage,
    createConversation,
  } = useAIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create initial conversation if none exists
  useEffect(() => {
    if (!currentConversation) {
      createConversation('New Conversation');
    }
  }, [currentConversation, createConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages, isTyping]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  if (!currentConversation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Chat History */}
      <ChatHistory />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Context Panel */}
        <ContextPanel />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Welcome message for new conversations */}
            {currentConversation.messages.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-block p-4 rounded-full bg-primary/10 mb-4">
                  <svg
                    className="w-12 h-12 text-primary"
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
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Welcome to Abyrith AI Assistant
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                  I can help you acquire API keys, manage secrets securely, and provide
                  guidance on best practices. What would you like to do today?
                </p>

                {/* Suggested prompts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  <button
                    onClick={() => handleSendMessage('I need to get an OpenAI API key')}
                    className="p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent transition-all text-left group"
                  >
                    <p className="font-semibold text-sm mb-1 group-hover:text-primary">
                      Get an API key
                    </p>
                    <p className="text-xs text-muted-foreground">
                      I'll guide you through acquiring keys from popular services
                    </p>
                  </button>

                  <button
                    onClick={() => handleSendMessage('What can you help me with?')}
                    className="p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent transition-all text-left group"
                  >
                    <p className="font-semibold text-sm mb-1 group-hover:text-primary">
                      Explore features
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Learn what I can do to help manage your secrets
                    </p>
                  </button>

                  <button
                    onClick={() =>
                      handleSendMessage('How do I organize secrets by environment?')
                    }
                    className="p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent transition-all text-left group"
                  >
                    <p className="font-semibold text-sm mb-1 group-hover:text-primary">
                      Organization tips
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Best practices for organizing secrets across projects
                    </p>
                  </button>

                  <button
                    onClick={() =>
                      handleSendMessage('Tell me about security features')
                    }
                    className="p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent transition-all text-left group"
                  >
                    <p className="font-semibold text-sm mb-1 group-hover:text-primary">
                      Security overview
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Learn about zero-knowledge encryption and security
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Message list */}
            {currentConversation.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start mb-4">
                <TypingIndicator />
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <ChatInput
          onSend={handleSendMessage}
          disabled={isTyping}
          placeholder="Ask me anything about secrets management..."
        />
      </div>
    </div>
  );
}
