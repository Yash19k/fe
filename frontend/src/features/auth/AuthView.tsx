import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { Layers, Eye, EyeOff, AlertCircle } from 'lucide-react';

export interface AuthViewProps {
  isSignup?: boolean;
}

export function AuthView({ isSignup = false }: AuthViewProps) {
  const { registerUser, navigate, showToast, login, setPendingSignupPassword } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (isSignup && !name.trim()) errs.name = 'Full name is required';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid email is required';
    if (!password || password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (isSignup && password !== confirmPassword) errs.confirm = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    if (isSignup) {
      setPendingSignupPassword?.(password);
      registerUser({ name, email });
      showToast('Account created! Please set up your company workspace.', 'success');
      navigate('/onboarding/company');
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
          if (
            err?.code === 'INVALID_CREDENTIALS' ||
            err?.status === 401 ||
            err?.message?.toLowerCase().includes('invalid email or password')
          ) {
            setAuthError('Invalid email or password.');
          } else if (
            err?.code === 'SERVER_UNREACHABLE' ||
            err?.status === 0 ||
            err?.message?.toLowerCase().includes('unable to reach') ||
            err?.message?.toLowerCase().includes('failed to fetch') ||
            err?.message?.toLowerCase().includes('network')
          ) {
            setAuthError('Unable to connect. Please check your internet connection and try again.');
          } else {
            setAuthError('Something went wrong. Please try again later.');
          }
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
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-overlay space-y-6">
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
            <Input
              label="Full Name"
              placeholder="e.g. Yash Kshatriya"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                if (authError) setAuthError(null);
              }}
              error={errors.name}
            />
          )}

          <Input
            label="Work Email"
            type="email"
            placeholder="name@taskflow.pro"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              if (authError) setAuthError(null);
            }}
            error={errors.email}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <label>Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-text-muted hover:text-text-primary flex items-center gap-1 text-[11px]"
              >
                {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                if (authError) setAuthError(null);
              }}
              error={errors.password}
            />
          </div>

          {isSignup && (
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
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
