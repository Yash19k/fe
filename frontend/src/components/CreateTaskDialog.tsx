import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PRIORITY, teamMembers } from '../data/mockData';

export interface CreateTaskDialogProps {
  onClose: () => void;
  onSubmit: (taskData: any) => void;
}

interface FormState {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  assigneeId: string;
}

export default function CreateTaskDialog({ onClose, onSubmit }: CreateTaskDialogProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Focus management on mount and restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    titleRef.current?.focus();
    return () => {
      if (previousFocusRef.current && typeof (previousFocusRef.current as HTMLElement).focus === 'function') {
        (previousFocusRef.current as HTMLElement).focus();
      }
    };
  }, []);

  // Trap focus and handle Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        trapFocus(e, dialogRef.current);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll while modal is mounted
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Task title is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit({
      ...form,
      id: `task-new-${Date.now()}`,
    });
    onClose();
  }

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="bg-surface rounded-xl shadow-overlay border border-border w-full max-w-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="create-task-title" className="text-base font-semibold text-text-primary">
            Create new task
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-active hover:text-text-primary transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-text-primary mb-1.5">
              Title <span className="text-status-danger">*</span>
            </label>
            <input
              id="task-title"
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter task title"
              className={`w-full h-10 px-3 rounded-lg border text-sm text-text-primary placeholder:text-text-tertiary bg-canvas
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors
                ${errors.title ? 'border-status-danger' : 'border-border'}
              `}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'title-error' : undefined}
            />
            {errors.title && (
              <p id="title-error" className="text-xs text-status-danger mt-1" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-desc" className="block text-sm font-medium text-text-primary mb-1.5">
              Description
            </label>
            <textarea
              id="task-desc"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm text-text-primary placeholder:text-text-tertiary bg-canvas focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none"
            />
          </div>

          {/* Priority & Due Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-text-primary mb-1.5">
                Priority
              </label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border text-sm text-text-primary bg-canvas focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none cursor-pointer"
              >
                <option value={PRIORITY.LOW}>Low</option>
                <option value={PRIORITY.MEDIUM}>Medium</option>
                <option value={PRIORITY.HIGH}>High</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-due" className="block text-sm font-medium text-text-primary mb-1.5">
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border text-sm text-text-primary bg-canvas focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label htmlFor="task-assignee" className="block text-sm font-medium text-text-primary mb-1.5">
              Assignee
            </label>
            <select
              id="task-assignee"
              value={form.assigneeId}
              onChange={(e) => handleChange('assigneeId', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border text-sm text-text-primary bg-canvas focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none cursor-pointer"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-active transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 active:bg-brand-700 transition-colors shadow-sm"
          >
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}

function initialForm(): FormState {
  return {
    title: '',
    description: '',
    priority: PRIORITY.MEDIUM,
    dueDate: '',
    assigneeId: '',
  };
}

function trapFocus(event: KeyboardEvent, container: HTMLDivElement | null) {
  if (!container) return;
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
