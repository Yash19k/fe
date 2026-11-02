import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Layers } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { requestPasswordResetApi, resetPasswordApi } from '../../services/api';

interface PasswordRecoveryViewProps {
  mode: 'forgot' | 'reset';
}

export function PasswordRecoveryView({ mode }: PasswordRecoveryViewProps) {
  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const emailInputRef = useRef<HTMLInputElement>(null);
  const submissionLock = useRef(false);

  const isForgotMode = mode === 'forgot';
  const token = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token') || '';
  const emailKey = email.trim().toLowerCase();
  const cooldownUntil = cooldowns[emailKey];
  const remainingSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : 0;
  const isCooldownActive = remainingSeconds > 0;
  const hasActiveCooldown = Object.values(cooldowns).some((expiresAt) => expiresAt > now);

  useEffect(() => {
    if (!hasActiveCooldown) return;

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveCooldown]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const submittedEmailKey = email.trim().toLowerCase();
    if (isForgotMode) {
      if (!email.trim()) {
        setError('Enter your account email address.');
        return;
      }
      if (!emailInputRef.current?.validity.valid) {
        setError('Enter a valid email address.');
        return;
      }
      if (cooldowns[submittedEmailKey] > Date.now() || submissionLock.current) {
        return;
      }
    } else if (submissionLock.current) {
      return;
    }

    if (!isForgotMode) {
      if (!token) {
        setError('This password reset link is invalid or incomplete. Request a new link.');
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
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    try {
      if (isForgotMode) {
        const response = await requestPasswordResetApi(email.trim());
        const acceptedAt = Date.now();
        setCooldowns((current) => ({
          ...current,
          [submittedEmailKey]: acceptedAt + 30_000,
        }));
        setNow(acceptedAt);
        if (emailInputRef.current?.value.trim().toLowerCase() === submittedEmailKey) {
          setSuccess(response.message);
        }
      } else {
        const response = await resetPasswordApi({
          token,
          newPassword: password,
          confirmPassword,
        });
        setSuccess(response.message);
      }
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to complete your request. Please try again.',
      );
    } finally {
      submissionLock.current = false;
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
            {isForgotMode ? 'Forgot your password?' : 'Reset your password'}
          </h1>
          <p className="text-xs text-text-muted">
            {isForgotMode
              ? 'Enter your email and we will send password reset instructions if an account exists.'
              : 'Choose a new password for your TaskFlow account.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div role="status" className="p-3 rounded-xl bg-status-success-bg border border-status-success-border text-status-success-text text-xs">
              {success}
            </div>
          )}

          {isForgotMode ? (
            <Input
              label="Work Email"
              type="email"
              autoComplete="email"
              placeholder="name@taskflow.pro"
              ref={emailInputRef}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setIsEmailValid(event.currentTarget.validity.valid);
                setError(null);
                setSuccess(null);
              }}
              required
            />
          ) : (
            <>
              <Input
                label="New Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Input
                label="Confirm New Password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            type="submit"
            disabled={isSubmitting || (isForgotMode && (!isEmailValid || isCooldownActive))}
          >
            {isSubmitting
              ? 'Please wait...'
              : isForgotMode
                ? cooldownUntil
                  ? 'Resend Instructions'
                  : 'Send Reset Instructions'
                : 'Reset Password'}
          </Button>
          {isForgotMode && isCooldownActive && (
            <p role="status" aria-live="polite" className="text-center text-xs text-text-muted">
              Resend available in 00:{String(remainingSeconds).padStart(2, '0')}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
