'use client';

import { useState } from 'react';
import { useProjectStore } from '@/lib/stores/project-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Tables } from '@/lib/api/supabase';

type System = Tables<'systems'>;

interface EditSystemDialogProps {
  system: System;
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

export function EditSystemDialog({ system, onClose }: EditSystemDialogProps) {
  const { updateSystem, deleteSystem } = useProjectStore();
  const [name, setName] = useState(system.name);
  const [description, setDescription] = useState(system.description || '');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(system.icon);
  const [selectedColor, setSelectedColor] = useState(system.color || COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('System name is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await updateSystem(system.id, {
        name: name.trim(),
        description: description.trim() || null,
        icon: selectedIcon,
        color: selectedColor,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update system');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      await deleteSystem(system.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete system');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Edit System</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Update system details or delete it
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

          {/* Delete Confirmation */}
          {showDeleteConfirm ? (
            <div className="border-2 border-destructive rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-destructive mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-destructive">Delete System?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will remove the system. Secrets assigned to this system will become unassigned.
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete System'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting}
            >
              Delete System
            </Button>
          )}

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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
