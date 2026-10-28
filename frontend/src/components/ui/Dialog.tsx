import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  zIndex?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-md',
  zIndex,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save previously focused element to restore when dialog closes
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    // Focus first focusable element inside dialog, or the container
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 50);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableNodes = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusableNodes.length === 0) {
          e.preventDefault();
          return;
        }

        const firstNode = focusableNodes[0];
        const lastNode = focusableNodes[focusableNodes.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstNode || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastNode.focus();
          }
        } else {
          if (document.activeElement === lastNode || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstNode.focus();
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`modal-backdrop ${zIndex || ''}`}
      style={zIndex ? { zIndex: 70 } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${maxWidth} bg-surface rounded-xl border border-border shadow-overlay overflow-hidden animate-in fade-in zoom-in-95 duration-150 outline-none`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 id="dialog-title" className="text-base font-semibold text-text-primary">
              {title}
            </h2>
            {description && (
              <p id="dialog-description" className="text-xs text-text-secondary mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
