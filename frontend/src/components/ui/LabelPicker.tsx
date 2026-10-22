import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Tag, Plus, Check, X, Search, ChevronDown } from 'lucide-react';
import type { Label } from '../../types';

export interface LabelPickerProps {
  availableLabels: Label[];
  selectedLabels: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function LabelPicker({
  availableLabels = [],
  selectedLabels = [],
  onChange,
  disabled = false,
  label = 'Labels',
  placeholder = 'Select labels...',
  className = '',
}: LabelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
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
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredLabels = useMemo(() => {
    if (!searchQuery.trim()) return availableLabels;
    const q = searchQuery.toLowerCase().trim();
    return availableLabels.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
    );
  }, [availableLabels, searchQuery]);

  function handleToggleLabel(labelName: string) {
    if (disabled) return;
    if (selectedLabels.includes(labelName)) {
      onChange(selectedLabels.filter((l) => l !== labelName));
    } else {
      onChange([...selectedLabels, labelName]);
    }
  }

  function handleRemoveLabel(e: React.MouseEvent, labelName: string) {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedLabels.filter((l) => l !== labelName));
  }

  function handleClearAll(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  }

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}

      {/* Trigger & Selected Pills Display */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full min-h-[38px] p-1.5 rounded-lg border transition-colors flex flex-wrap items-center gap-1.5 cursor-pointer bg-surface ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-border'
            : isOpen
              ? 'border-brand-primary ring-1 ring-brand-primary'
              : 'border-border hover:border-brand-primary/50'
        }`}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        {selectedLabels.length === 0 ? (
          <div className="flex items-center justify-between w-full px-2 py-0.5 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Tag size={13} className="text-text-muted shrink-0" />
              <span>{placeholder}</span>
            </span>
            <ChevronDown size={14} className="text-text-muted shrink-0" />
          </div>
        ) : (
          <>
            {selectedLabels.map((name) => {
              const labelDef = availableLabels.find(
                (l) => l.name.toLowerCase() === name.toLowerCase() || l.id === name
              );
              const color = labelDef?.color || '#3B82F6';
              const displayName = labelDef?.name || name;

              return (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${color}25`,
                    borderColor: color,
                    borderWidth: 1,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span style={{ color }}>{displayName}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveLabel(e, name)}
                      className="hover:opacity-80 text-text-muted ml-0.5 p-0.5 cursor-pointer rounded-full"
                      title={`Remove ${displayName}`}
                      aria-label={`Remove ${displayName}`}
                    >
                      <X size={11} />
                    </button>
                  )}
                </span>
              );
            })}

            <div className="ml-auto flex items-center gap-1 px-1">
              {selectedLabels.length > 1 && !disabled && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] text-text-muted hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-surface-elevated cursor-pointer"
                  title="Clear all labels"
                >
                  Clear
                </button>
              )}
              <ChevronDown
                size={14}
                className={`text-text-muted transition-transform shrink-0 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </>
        )}
      </div>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className="relative z-50"
          style={{ width: '100%' }}
        >
          <div className="absolute left-0 top-1 w-full min-w-[280px] max-w-md rounded-xl border border-border bg-surface-elevated shadow-xl overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Labels Options List */}
            <div
              className="max-h-60 overflow-y-auto divide-y divide-border/40 py-1"
              role="listbox"
              aria-multiselectable="true"
            >
              {filteredLabels.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted italic">
                  {availableLabels.length === 0
                    ? 'No labels defined for this project. Create labels in Project Settings.'
                    : 'No matching labels found.'}
                </div>
              ) : (
                filteredLabels.map((lbl) => {
                  const isSelected = selectedLabels.some(
                    (s) => s.toLowerCase() === lbl.name.toLowerCase() || s === lbl.id
                  );
                  return (
                    <div
                      key={lbl.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLabel(lbl.name);
                      }}
                      className={`flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-brand-primary/10 text-brand-primary font-medium'
                          : 'text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {/* Checkbox indicator */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-brand-primary border-brand-primary text-white'
                              : 'border-border bg-surface text-transparent'
                          }`}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>

                        {/* Color swatch dot */}
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: lbl.color || '#3B82F6' }}
                        />

                        {/* Label name & description */}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{lbl.name}</p>
                          {lbl.description && (
                            <p className="text-[10px] text-text-muted truncate">
                              {lbl.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] font-semibold text-brand-primary shrink-0">
                          Selected
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with counter & done button */}
            <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted bg-surface/50">
              <span>
                {selectedLabels.length} {selectedLabels.length === 1 ? 'label' : 'labels'} selected
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 rounded bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition-colors cursor-pointer text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
