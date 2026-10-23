import React, { useState, useRef, useEffect } from 'react';
import { Tag, Check, Search, ChevronDown, X } from 'lucide-react';
import type { Label } from '../../types';

export interface LabelPickerProps {
  availableLabels: Label[];
  selectedLabels: string[];
  onToggleLabel: (labelName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function LabelPicker({
  availableLabels,
  selectedLabels,
  onToggleLabel,
  disabled = false,
  placeholder = '+ Add / edit labels...',
}: LabelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && availableLabels.length > 3) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, availableLabels.length]);

  const filteredLabels = availableLabels.filter((lbl) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      lbl.name.toLowerCase().includes(term) ||
      (lbl.description && lbl.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="relative w-full space-y-2" ref={containerRef}>
      {/* Trigger & Search Bar */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full min-h-[36px] flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs text-left transition-colors cursor-pointer select-none ${
          isOpen
            ? 'bg-surface-elevated border-brand-primary ring-1 ring-brand-primary/30 text-text-primary'
            : 'bg-surface hover:bg-surface-hover border-border text-text-secondary hover:text-text-primary'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag size={13} className="text-text-muted shrink-0" />
          <span className="truncate">
            {selectedLabels.length === 0
              ? placeholder
              : `${selectedLabels.length} label${selectedLabels.length > 1 ? 's' : ''} selected`}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-text-muted transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Selected Chips Area */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {selectedLabels.map((lbl) => {
            const labelDef = availableLabels.find((l) => l.name === lbl);
            const color = labelDef?.color || '#3B82F6';
            return (
              <span
                key={lbl}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: `${color}20`,
                  borderColor: `${color}60`,
                  borderWidth: 1,
                  color,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate max-w-[150px]">{lbl}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLabel(lbl);
                    }}
                    className="hover:opacity-75 focus:outline-none cursor-pointer text-text-muted hover:text-text-primary -mr-1 p-0.5"
                    title={`Remove label ${lbl}`}
                    aria-label={`Remove label ${lbl}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Usable, Wider Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 left-0 top-full mt-1.5 w-full min-w-[280px] sm:min-w-[320px] max-w-sm bg-surface-elevated border border-border rounded-xl shadow-overlay p-2 space-y-1.5 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search box if multiple labels */}
          {availableLabels.length > 3 && (
            <div className="relative pb-1 border-b border-border/60">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search or filter labels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-7 pl-7 pr-2 rounded-md bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <Search size={12} className="absolute left-2 top-2.5 text-text-muted" />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
            {availableLabels.length === 0 ? (
              <div className="p-3 text-center text-text-muted text-[11px] italic">
                No labels configured in project settings yet.
              </div>
            ) : filteredLabels.length === 0 ? (
              <div className="p-3 text-center text-text-muted text-[11px] italic">
                No labels match &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredLabels.map((lbl) => {
                const isSelected = selectedLabels.includes(lbl.name);
                const color = lbl.color || '#3B82F6';

                return (
                  <button
                    key={lbl.id || lbl.name}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onToggleLabel(lbl.name)}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-brand-primary/10 text-text-primary font-medium'
                        : 'hover:bg-surface hover:text-text-primary text-text-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-text-primary">{lbl.name}</p>
                        {lbl.description && (
                          <p className="truncate text-[10px] text-text-muted">{lbl.description}</p>
                        )}
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-brand-primary border-brand-primary text-white'
                          : 'border-border bg-surface'
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
