import React from 'react';
import { useApp } from '../../hooks/useApp';
import { Button } from '../../components/ui/Button';
import { Home, ArrowLeft, Compass } from 'lucide-react';

export function NotFoundView() {
  const { navigate } = useApp();

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  };

  return (
    <div
      id="not-found-page"
      className="flex-1 min-h-[75vh] flex flex-col items-center justify-center p-6 text-center bg-canvas"
    >
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Visual Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-brand-primary shadow-xs">
          <Compass size={32} className="text-brand-primary" />
        </div>

        {/* 404 Heading & Title */}
        <div className="space-y-2">
          <div className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-text-primary/90">
            404
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
            The page you are looking for doesn&apos;t exist, has been moved, or the link is invalid. Please check the URL or return to your workspace.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            id="not-found-home-btn"
            variant="primary"
            size="md"
            icon={Home}
            onClick={() => navigate('/')}
            className="w-full sm:w-auto min-w-[150px]"
          >
            Go to Workspace
          </Button>

          <Button
            id="not-found-back-btn"
            variant="secondary"
            size="md"
            icon={ArrowLeft}
            onClick={handleGoBack}
            className="w-full sm:w-auto min-w-[120px]"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
