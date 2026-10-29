import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { Layers, Eye, EyeOff, AlertCircle } from 'lucide-react';

export function classifyAuthError(err: any): string {
  const isNetwork =
    err?.code === 'SERVER_UNREACHABLE' ||
    err?.status === 0 ||
    err?.message?.toLowerCase().includes('unable to reach') ||
    err?.message?.toLowerCase().includes('failed to fetch') ||
    err?.message?.toLowerCase().includes('networkerror') ||
    (err?.name === 'TypeError' && err?.message?.toLowerCase().includes('fetch'));

  if (isNetwork) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Unable to connect. Please check your internet connection and try again.';
    }
    return 'Unable to connect to the TaskFlow server. Please make sure the backend server is running and try again.';
  }

  if (
    err?.code === 'INVALID_CREDENTIALS' ||
    err?.status === 401 ||
    err?.message?.toLowerCase().includes('invalid email or password') ||
    err?.message?.toLowerCase().includes('invalid credentials')
  ) {
    return 'Invalid email or password.';
  }

  if (
    err?.message &&
    typeof err.message === 'string' &&
    !err.message.startsWith('Request failed with status') &&
    err?.status !== 500
  ) {
    return err.message.replace(/^password:\s*/i, '');
  }

  if (err?.status && err.status >= 500) {
    return 'Internal Server Error';
  }

  return (
    (err?.message ? String(err.message).replace(/^password:\s*/i, '') : null) ||
    'Authentication failed. Please check your credentials.'
  );
}

export interface AuthViewProps {
  isSignup?: boolean;
}

export function AuthView({ isSignup = false }: AuthViewProps) {
  const { register, registerUser, navigate, showToast, login } = useApp();

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const errs: Record<string, string> = {};

    if (isSignup && !name.trim()) errs.name = 'Full name is required';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid email is required';
    if (!password || password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (isSignup && password !== confirmPassword) errs.confirm = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    if (isSignup) {
      setIsSubmitting(true);
      setAuthError(null);
      try {
        if (register) {
          const ok = await register({
            name: name.trim(),
            email: email.trim(),
            password,
            companyName: companyName.trim() || undefined,
          });
          if (ok) {
            showToast('Account created! Welcome to your company workspace.', 'success');
            navigate('/onboarding/company');
          } else {
            setAuthError('Registration could not be completed. Please try again.');
          }
        } else {
          registerUser({ name, email });
          showToast('Account created! Please set up your company workspace.', 'success');
          navigate('/onboarding/company');
        }
      } catch (err: any) {
        setAuthError(classifyAuthError(err));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (login) {
        setIsSubmitting(true);
        setAuthError(null);
        try {
          const ok = await login(email, password);
          if (ok) {
            navigate('/');
          } else {
            setAuthError('Invalid email or password.');
          }
        } catch (err: any) {
          setAuthError(classifyAuthError(err));
        } finally {
          setIsSubmitting(false);
        }
      } else {
        showToast('Welcome back!', 'success');
        navigate('/');
      }
    }
  }

  function handleSwitchMode(targetRoute: string) {
    setAuthError(null);
    setErrors({});
    navigate(targetRoute);
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-overlay space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary mx-auto">
            <Layers size={22} strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            {isSignup ? 'Create your TaskFlow account' : 'Sign in to TaskFlow Pro'}
          </h1>
          <p className="text-xs text-text-muted">
            {isSignup
              ? 'Join your engineering team workspace'
              : 'Enter your credentials to continue'}
          </p>
        </div>

        {/* Standard Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs flex items-center gap-2 animate-in fade-in duration-150"
            >
              <AlertCircle size={15} className="shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {isSignup && (
            <>
              <Input
                label="Full Name"
                placeholder="e.g. Yash Kshatriya"
                value={name}
                focusVariant="subtle"
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                  if (authError) setAuthError(null);
                }}
                error={errors.name}
              />
              <Input
                label="Company / Workspace Name"
                placeholder="e.g. Acme Corp"
                value={companyName}
                focusVariant="subtle"
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (errors.company) setErrors((prev) => ({ ...prev, company: '' }));
                  if (authError) setAuthError(null);
                }}
                error={errors.company}
              />
            </>
          )}

          <Input
            label="Work Email"
            type="email"
            placeholder="name@taskflow.pro"
            value={email}
            focusVariant="subtle"
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              if (authError) setAuthError(null);
            }}
            error={errors.email}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            focusVariant="subtle"
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
              if (authError) setAuthError(null);
            }}
            error={errors.password}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="text-text-muted hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded p-1 transition-colors flex items-center justify-center cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
                <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
              </button>
            }
          />

          {!isSignup && (
            <div className="-mt-2 text-right">
              <a
                href="#/forgot-password"
                className="inline-block text-xs font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 rounded-sm"
              >
                Forgot password?
              </a>
            </div>
          )}

          {isSignup && (
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              focusVariant="subtle"
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: '' }));
                if (authError) setAuthError(null);
              }}
              error={errors.confirm}
            />
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full mt-2"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isSignup
                ? 'Creating Account...'
                : 'Signing In...'
              : isSignup
                ? 'Create Account'
                : 'Sign In'}
          </Button>
        </form>

        {/* Toggle between Login and Signup */}
        <div className="text-center text-xs text-text-muted">
          {isSignup ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('/login')}
                className="text-brand-primary hover:underline font-semibold"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('/signup')}
                className="text-brand-primary hover:underline font-semibold"
              >
                Create Account
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
