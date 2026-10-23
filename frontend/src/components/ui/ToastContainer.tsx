import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useApp } from '../../hooks/useApp';

export function ToastContainer() {
  const { toasts } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border shadow-lg text-xs font-medium transition-all duration-200 bg-surface-elevated ${
              isSuccess
                ? 'border-emerald-500/40 text-emerald-300'
                : isError
                  ? 'border-rose-500/40 text-rose-300'
                  : isWarning
                    ? 'border-amber-500/40 text-amber-300'
                    : 'border-border text-text-primary'
            }`}
          >
            {isSuccess && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
            {isError && <XCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />}
            {isWarning && <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />}
            {!isSuccess && !isError && !isWarning && <Info size={16} className="text-brand-primary flex-shrink-0 mt-0.5" />}
            <span className="flex-1 leading-snug">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
