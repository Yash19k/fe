import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }> | null;
  title: React.ReactNode;
  description?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/80 bg-surface/50 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-brand-subtle text-brand-primary border border-brand-border/40 shadow-xs flex items-center justify-center mb-3">
          <Icon size={20} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="text-xs text-text-secondary mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
