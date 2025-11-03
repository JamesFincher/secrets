'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAIStore } from '@/lib/stores/ai-store';

/**
 * Chat History Component
 *
 * Sidebar showing past conversations with search and create new
 */
export function ChatHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    conversations,
    currentConversation,
    createConversation,
    setCurrentConversation,
    deleteConversation,
  } = useAIStore();

  const handleNewConversation = () => {
    createConversation();
    setIsOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversation(id);
    setIsOpen(false);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteConversation(id);
    }
  };

  return (
    <>
      {/* Toggle button (mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-20 left-4 z-20 p-2 rounded-lg bg-background border shadow-lg hover:bg-accent transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 w-64 bg-background border-r flex flex-col z-40 transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <Button onClick={handleNewConversation} className="w-full" size="sm">
            New Conversation
          </Button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-muted-foreground">
                No conversations yet. Start chatting to create your first conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors group relative ${
                    currentConversation?.id === conversation.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conversation.title}
                      </p>
                      <p className="text-xs opacity-70 mt-1">
                        {conversation.messages.length} messages
                      </p>
                      <p className="text-xs opacity-60 mt-0.5">
                        {formatDate(conversation.updatedAt)}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                    >
                      <svg
                        className="w-4 h-4 text-destructive"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Project context indicator */}
                  {conversation.projectId && (
                    <div className="mt-2 text-xs opacity-70 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <span>Project context</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t text-xs text-muted-foreground">
          <p>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Format date for display in conversation list
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
