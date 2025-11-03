'use client';

import { useState } from 'react';
import { useProjectStore } from '@/lib/stores/project-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateSystemDialogProps {
  projectId: string;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['🖥️', '⚙️', '📱', '🗄️', '🌐', '🔌', '📡', '🎨', '🔧', '📊', '🚀', '💾'];
const COLOR_OPTIONS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#10b981', // green
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#ef4444', // red
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export function CreateSystemDialog({ projectId, onClose }: CreateSystemDialogProps) {
  const { createSystem } = useProjectStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('System name is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await createSystem(
        projectId,
        name.trim(),
        description.trim() || undefined,
        selectedIcon || undefined,
        selectedColor
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create system');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Create System</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Add a new subsystem or component to organize your secrets
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              System Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Frontend, Backend API, Mobile App"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this system do?"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Icon Picker */}
          <div className="space-y-2">
            <Label>Icon (Optional)</Label>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedIcon(emoji === selectedIcon ? null : emoji)}
                  className={`
                    w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl
                    transition-all hover:scale-110
                    ${
                      emoji === selectedIcon
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }
                  `}
                  disabled={isSubmitting}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`
                    w-12 h-12 rounded-lg border-2 transition-all hover:scale-110
                    ${
                      color === selectedColor
                        ? 'border-foreground ring-2 ring-offset-2 ring-foreground/20'
                        : 'border-border'
                    }
                  `}
                  style={{ backgroundColor: color }}
                  disabled={isSubmitting}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: selectedColor }}
                >
                  {selectedIcon || (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-semibold">{name || 'System Name'}</div>
                  {description && (
                    <div className="text-sm text-muted-foreground">{description}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create System'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
