import React, { useState } from 'react';
import { AlertCircle, Layers } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { useApp } from '../../hooks/useApp';
import { acceptInvitationApi } from '../../services/api';

function captureInvitationToken(): string {
  const hashQuery = window.location.hash.split('?')[1] || '';
  const token = new URLSearchParams(hashQuery).get('token') || '';
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}#/accept-invitation`,
  );
  return token;
}

export function InvitationAcceptanceView() {
  const { navigate } = useApp();
  const [token] = useState(captureInvitationToken);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('This invitation link is invalid or incomplete. Ask your administrator to send a new invitation.');
      return;
    }
    if (!fullName.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      setError('Password must be at least 8 characters and no more than 72 UTF-8 bytes.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptInvitationApi(token, { fullName: fullName.trim(), password });
      setAccepted(true);
      setPassword('');
      setConfirmPassword('');
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to accept this invitation. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-overlay space-y-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary mx-auto">
            <Layers size={22} strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            {accepted ? 'Invitation accepted' : 'Accept your TaskFlow invitation'}
          </h1>
          <p className="text-xs text-text-muted">
            {accepted
              ? 'Your account is ready. Sign in with your email and new password to continue.'
              : 'Set your name and permanent password to join your organization.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {accepted ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Continue to Sign In
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
            <Input
              label="Create Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              type="submit"
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? 'Accepting Invitation...' : 'Accept Invitation'}
            </Button>
          </form>
        )}

        {!accepted && (
          <div className="text-center text-xs text-text-muted">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-brand-primary hover:underline font-semibold"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
