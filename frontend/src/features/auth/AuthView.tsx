import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Layers, Shield, Eye, EyeOff } from 'lucide-react';

export interface AuthViewProps {
  isSignup?: boolean;
}

export function AuthView({ isSignup = false }: AuthViewProps) {
  const { switchUser, registerUser, navigate, showToast, login } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@taskflow.pro');
  const [password, setPassword] = useState('Password123!');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

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
      sessionStorage.setItem('pending_signup_password', password);
      registerUser({ name, email });
      showToast('Account created! Please set up your company workspace.', 'success');
      navigate('/onboarding/company');
    } else {
      if (login) {
        const ok = await login(email, password);
        if (ok) {
          navigate('/');
        }
      } else {
        showToast('Welcome back!', 'success');
        navigate('/');
      }
    }
  }

  async function handleQuickDemoLogin(userId: string) {
    const roleEmailMap: Record<string, string> = {
      'user-1': 'admin@taskflow.pro',
      'user-2': 'manager@taskflow.pro',
      'user-3': 'teammate@taskflow.pro',
    };
    const demoEmail = roleEmailMap[userId];
    if (demoEmail && login) {
      const ok = await login(demoEmail, 'Password123!');
      if (ok) {
        navigate('/');
        return;
      }
    }
    switchUser(userId);
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
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
              : 'Enter your credentials or choose a quick demo role'}
          </p>
        </div>

        {/* Quick Demo Access Buttons */}
        <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            <span>Prototype Quick Login</span>
            <Shield size={12} className="text-brand-primary" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('user-1')}
              className="py-1.5 px-2 text-xs rounded bg-surface hover:bg-surface-hover text-text-primary border border-border font-medium transition-colors"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('user-2')}
              className="py-1.5 px-2 text-xs rounded bg-surface hover:bg-surface-hover text-text-primary border border-border font-medium transition-colors"
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('user-3')}
              className="py-1.5 px-2 text-xs rounded bg-surface hover:bg-surface-hover text-text-primary border border-border font-medium transition-colors"
            >
              Teammate
            </button>
          </div>
        </div>

        {/* Standard Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {isSignup && (
            <Input
              label="Full Name"
              placeholder="e.g. Yash Kshatriya"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
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
              }}
              error={errors.confirm}
            />
          )}

          <Button variant="primary" size="lg" className="w-full mt-2" type="submit">
            {isSignup ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        {/* Toggle between Login and Signup */}
        <div className="text-center text-xs text-text-muted">
          {isSignup ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
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
                onClick={() => navigate('/signup')}
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
