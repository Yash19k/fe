import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

export interface ThemeToggleProps {
  variant?: 'button' | 'segmented';
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({
  variant = 'button',
  className = '',
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // Segmented control variant (e.g. for Settings page)
  if (variant === 'segmented') {
    const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
      { mode: 'light', label: 'Light', icon: Sun },
      { mode: 'dark', label: 'Dark', icon: Moon },
      { mode: 'system', label: 'System', icon: Monitor },
    ];

    return (
      <div
        role="radiogroup"
        aria-label="Theme preference"
        className={`inline-flex items-center p-1 rounded-xl bg-surface-elevated border border-border ${className}`}
      >
        {options.map(({ mode, label, icon: Icon }) => {
          const isSelected = theme === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(mode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'bg-surface text-brand-text border border-brand-border shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover/50'
              }`}
            >
              <Icon size={14} className={isSelected ? 'text-brand-primary' : 'text-text-muted'} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Active icon based on current selection
  const CurrentIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const currentLabel =
    theme === 'system' ? `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})` : theme === 'dark' ? 'Dark' : 'Light';

  const menuOptions: { mode: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
    { mode: 'light', label: 'Light', icon: Sun, desc: 'Clean white surfaces & dark typography' },
    { mode: 'dark', label: 'Dark', icon: Moon, desc: 'Dark navy & vibrant accents' },
    { mode: 'system', label: 'System', icon: Monitor, desc: 'Match operating system appearance' },
  ];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        aria-label={`Current theme: ${currentLabel}. Click to change theme.`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Theme: ${currentLabel}`}
      >
        <CurrentIcon size={17} className="transition-transform duration-200" />
        {showLabel && <span className="text-xs font-medium">{currentLabel}</span>}
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select theme"
          className="absolute right-0 top-full mt-2 w-52 bg-surface rounded-xl shadow-overlay border border-border p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border/60 mb-1">
            Theme Appearance
          </div>

          {menuOptions.map(({ mode, label, icon: Icon, desc }) => {
            const isSelected = theme === mode;
            return (
              <button
                key={mode}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setTheme(mode);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer group ${
                  isSelected
                    ? 'bg-brand-subtle text-brand-text font-semibold border border-brand-border'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-brand-primary text-white shadow-xs'
                        : 'bg-surface-elevated text-text-muted group-hover:text-text-primary'
                    }`}
                  >
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{label}</p>
                    <p className="truncate text-[10px] text-text-muted font-normal">{desc}</p>
                  </div>
                </div>

                {isSelected && <Check size={14} className="text-brand-primary shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
