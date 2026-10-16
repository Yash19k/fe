import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import {
  Layers,
  AlertCircle,
  Loader2,
  UserPlus,
  Trash2,
  Plus,
  ArrowRight,
  Info,
} from 'lucide-react';
import { registerOrganizationApi, inviteOrganizationMembersApi } from '../../services/api';
import type { Role } from '../../types';

interface InviteRow {
  id: string;
  email: string;
  role: Role;
  error?: string;
}

export function CompanySetupView() {
  const { currentUser, finishOnboarding, navigate, showToast, login } = useApp();

  // Multi-step state: 'company' -> 'invitations'
  const [step, setStep] = useState<'company' | 'invitations'>(() => {
    return currentUser?.companyName || currentUser?.companyId ? 'invitations' : 'company';
  });

  // Step 1: Company form state
  const [companyName, setCompanyName] = useState(currentUser?.companyName || '');
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  // Step 2: Invitations state
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([
    { id: 'inv-1', email: '', role: 'Teammate' },
  ]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [isSubmittingInvites, setIsSubmittingInvites] = useState(false);

  function validateCompanyName(value: string): string | null {
    if (!value) return 'Company name is required.';
    const trimmed = value.trim();
    if (trimmed.length === 0) return 'Please enter a valid company name.';
    if (trimmed.length < 2) return 'Company name must be at least 2 characters.';
    if (trimmed.length > 100) return 'Company name must be 100 characters or fewer.';
    return null;
  }

  function handleCompanyChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCompanyName(e.target.value);
    if (companyError) setCompanyError(null);
    if (apiError) setApiError(null);
  }

  async function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingCompany) return;

    const validationErr = validateCompanyName(companyName);
    if (validationErr) {
      setCompanyError(validationErr);
      return;
    }

    setIsSubmittingCompany(true);
    setApiError(null);

    const trimmed = companyName.trim();
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'workspace';

    // The backend creates the organization and its owner in one transaction.
    try {
      const pendingPassword =
        sessionStorage.getItem('pending_signup_password') || 'Password123!';

      await registerOrganizationApi({
        user: {
          fullName: currentUser.name || 'Workspace Admin',
          email: currentUser.email,
          password: pendingPassword,
        },
        organization: {
          name: trimmed,
          slug,
        },
      });

      // Hydrate the app with the persisted backend user instead of the temporary local user.
      const loggedIn = await login(
        currentUser.email,
        pendingPassword,
      );
      if (!loggedIn) {
        throw new Error('Account was created, but the new session could not be started.');
      }
    } catch (err: any) {
      setIsSubmittingCompany(false);
      setApiError(err?.message || 'Unable to create the account in the backend.');
      return;
    }

    setIsSubmittingCompany(false);

    // Keep the organization ID returned by the backend; only advance locally.
    setStep('invitations');
    showToast(`Company "${trimmed}" registered. Invite your team or skip to continue.`, 'success');
  }

  function handleAddInviteRow() {
    setInviteRows((prev) => [
      ...prev,
      { id: `inv-${Date.now()}-${prev.length + 1}`, email: '', role: 'Teammate' },
    ]);
  }

  function handleRemoveInviteRow(id: string) {
    setInviteRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.length > 0
        ? filtered
        : [{ id: `inv-${Date.now()}`, email: '', role: 'Teammate' }];
    });
  }

  function handleInviteRowChange(id: string, field: 'email' | 'role', value: string) {
    setInviteRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value, error: undefined } : r))
    );
    if (inviteError) setInviteError(null);
    if (inviteNotice) setInviteNotice(null);
  }

  function validateInvitations(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasErrors = false;
    const seenEmails = new Set<string>();

    const updated = inviteRows.map((row) => {
      const emailTrimmed = row.email.trim();
      if (!emailTrimmed) {
        return row; // Empty rows are ignored unless all are empty on submit
      }

      if (!emailRegex.test(emailTrimmed)) {
        hasErrors = true;
        return { ...row, error: 'Invalid email address format' };
      }

      if (emailTrimmed.toLowerCase() === currentUser.email.toLowerCase()) {
        hasErrors = true;
        return { ...row, error: 'Cannot invite your own account email' };
      }

      if (seenEmails.has(emailTrimmed.toLowerCase())) {
        hasErrors = true;
        return { ...row, error: 'Duplicate email in this invitation list' };
      }

      seenEmails.add(emailTrimmed.toLowerCase());
      return { ...row, error: undefined };
    });

    setInviteRows(updated);
    return !hasErrors;
  }

  async function handleSendInvitations(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingInvites) return;

    // Filter to rows with content
    const filledRows = inviteRows.filter((r) => r.email.trim().length > 0);
    if (filledRows.length === 0) {
      setInviteError('Please enter at least one teammate email address or click "Skip for now".');
      return;
    }

    if (!validateInvitations()) {
      return;
    }

    setIsSubmittingInvites(true);
    setInviteNotice(null);

    // The backend creates pending user rows before attempting email delivery.
    try {
      await inviteOrganizationMembersApi(
        filledRows.map((r) => ({
          email: r.email.trim().toLowerCase(),
          role: r.role.toUpperCase(),
        }))
      );
    } catch (err: any) {
      setIsSubmittingInvites(false);
      setInviteError(err?.message || 'Unable to save invitations to the backend.');
      return;
    }

    finishOnboarding();
    setIsSubmittingInvites(false);
    showToast(`Workspace ready with ${filledRows.length} team member invitation${filledRows.length > 1 ? 's' : ''} staged.`, 'success');
    navigate('/');
  }

  function handleSkipInvitations() {
    finishOnboarding();
    showToast(`Welcome to ${companyName.trim() || currentUser?.companyName || 'your workspace'}!`, 'success');
    navigate('/');
  }

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-overlay space-y-6">
        {/* Step Indicator Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary mx-auto shadow-xs">
            {step === 'company' ? <Layers size={22} strokeWidth={2.2} /> : <UserPlus size={22} strokeWidth={2.2} />}
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-text-muted">
            <span className={step === 'company' ? 'text-brand-primary font-bold' : ''}>1. Workspace</span>
            <span>&bull;</span>
            <span className={step === 'invitations' ? 'text-brand-primary font-bold' : ''}>2. Team Setup</span>
          </div>

          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            {step === 'company' ? "What's your company name?" : 'Invite your team'}
          </h1>
          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
            {step === 'company'
              ? 'Give your workspace a name so your team can organize projects and collaborate in one place.'
              : 'Bring your teammates into your workspace now, or invite them later.'}
          </p>
        </div>

        {/* STEP 1: Company Setup Form */}
        {step === 'company' && (
          <>
            {apiError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2"
              >
                <AlertCircle size={15} className="text-rose-400 mt-0.5 flex-shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            <form onSubmit={handleCompanySubmit} noValidate className="space-y-4">
              <div>
                <Input
                  id="company-name"
                  label="Company name *"
                  placeholder="e.g. Acme Corporation or Dayflow Labs"
                  value={companyName}
                  onChange={handleCompanyChange}
                  error={companyError || undefined}
                  autoFocus
                  disabled={isSubmittingCompany}
                  maxLength={100}
                  aria-required="true"
                  aria-invalid={Boolean(companyError)}
                  aria-describedby={companyError ? 'company-name-error' : undefined}
                />
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full mt-2"
                type="submit"
                disabled={isSubmittingCompany || !companyName.trim()}
              >
                {isSubmittingCompany ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Creating workspace...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Continue to Team Setup</span>
                    <ArrowRight size={16} />
                  </span>
                )}
              </Button>
            </form>
          </>
        )}

        {/* STEP 2: Optional Team Invitations */}
        {step === 'invitations' && (
          <div className="space-y-5">
            {inviteError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2"
              >
                <AlertCircle size={15} className="text-rose-400 mt-0.5 flex-shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {inviteNotice && (
              <div
                role="status"
                className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2"
              >
                <Info size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <span>{inviteNotice}</span>
              </div>
            )}

            <form onSubmit={handleSendInvitations} className="space-y-3.5">
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {inviteRows.map((row, index) => (
                  <div key={row.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <input
                          type="email"
                          placeholder="colleague@company.com"
                          value={row.email}
                          onChange={(e) => handleInviteRowChange(row.id, 'email', e.target.value)}
                          disabled={isSubmittingInvites}
                          className={`w-full h-9 rounded-lg bg-surface-elevated border px-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary ${
                            row.error ? 'border-rose-500/80 focus:ring-rose-500' : 'border-border'
                          }`}
                          aria-label={`Teammate ${index + 1} Email`}
                        />
                      </div>

                      <div className="w-32 shrink-0">
                        <select
                          value={row.role}
                          onChange={(e) => handleInviteRowChange(row.id, 'role', e.target.value)}
                          disabled={isSubmittingInvites}
                          className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
                          aria-label={`Teammate ${index + 1} Role`}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Teammate">Teammate</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveInviteRow(row.id)}
                        disabled={isSubmittingInvites || inviteRows.length === 1}
                        className={`p-2 rounded-lg text-text-muted hover:text-rose-400 hover:bg-surface-elevated transition-colors ${
                          inviteRows.length === 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        title="Remove row"
                        aria-label="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {row.error && <p className="text-[11px] text-rose-400 font-medium pl-1">{row.error}</p>}
                  </div>
                ))}
              </div>

              {/* Add another member button */}
              <button
                type="button"
                onClick={handleAddInviteRow}
                disabled={isSubmittingInvites || inviteRows.length >= 10}
                className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:text-brand-primary/80 font-medium transition-colors cursor-pointer py-1"
              >
                <Plus size={14} />
                <span>Add another member</span>
              </button>

              {/* Actions: Invite Members & Skip for now */}
              <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center gap-2.5">
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  className="w-full sm:flex-1"
                  disabled={isSubmittingInvites}
                >
                  {isSubmittingInvites ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" />
                      Sending invites...
                    </span>
                  ) : (
                    'Invite Members'
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="md"
                  type="button"
                  className="w-full sm:w-auto text-text-muted hover:text-text-primary"
                  onClick={handleSkipInvitations}
                  disabled={isSubmittingInvites}
                >
                  Skip for now
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
