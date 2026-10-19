import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  icon?: LucideIcon | React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> | null;
  ariaLabel?: string;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  icon: Icon = null,
  title,
  ariaLabel,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 disabled:pointer-events-none rounded-lg select-none cursor-pointer';

  const variants: Record<string, string> = {
    primary:
      'bg-brand-primary text-zinc-950 font-semibold hover:bg-brand-hover active:bg-blue-400 shadow-sm',
    secondary:
      'bg-surface-elevated text-text-primary border border-border hover:bg-surface-hover hover:border-border-strong active:bg-surface-active',
    subtle:
      'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover active:bg-surface-active',
    danger:
      'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 active:bg-rose-500/40',
    ghost:
      'bg-transparent text-text-muted hover:text-text-primary hover:bg-surface-hover',
  };

  const sizes: Record<string, string> = {
    sm: 'h-8 px-2.5 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-sm gap-2',
    lg: 'h-10 px-4 text-sm gap-2',
    icon: 'h-8 w-8 p-0 text-text-secondary hover:text-text-primary',
    'icon-sm': 'h-7 w-7 p-0 text-text-secondary hover:text-text-primary',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      className={`${base} ${variants[variant] || variants.secondary} ${
        sizes[size] || sizes.md
      } ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size.includes('icon') ? 16 : 14} strokeWidth={2} />}
      {children}
    </button>
  );
}
