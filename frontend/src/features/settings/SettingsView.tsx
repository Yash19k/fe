import React, { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import {
  Shield,
  Check,
  Users,
  UserPlus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Mail,
  User as UserIcon,
  Palette,
} from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import {
  getOrganizationMembersApi,
  addOrganizationMemberApi,
  updateOrganizationMemberRoleApi,
  removeOrganizationMemberApi,
} from '../../services/api';

export function SettingsView() {
  const { currentUser, showToast, currentCompany } = useApp();

  const [slaHigh, setSlaHigh] = useState<number | string>(24);
  const [slaMedium, setSlaMedium] = useState<number | string>(48);
  const [slaLow, setSlaLow] = useState<number | string>(96);
  const [warningThreshold, setWarningThreshold] = useState<number | string>(8);

  // Organization Member Management State
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Add Member State
  const [isAddingMember, setIsAddingMember] = useState<boolean>(false);
  const [addFullName, setAddFullName] = useState<string>('');
  const [addEmail, setAddEmail] = useState<string>('');
  const [addRole, setAddRole] = useState<string>('Teammate');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Remove Member Modal State
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  // Role Update State
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const canManageOrgMembers = currentUser?.role === 'Admin';

  const loadOrgMembers = async () => {
    if (!canManageOrgMembers) return;
    setIsLoadingMembers(true);
    setMembersError(null);
    try {
      const res = await getOrganizationMembersApi();
      if (res?.data && Array.isArray(res.data)) {
        setMembers(res.data);
      }
    } catch (err: any) {
      setMembersError(err?.message || 'Failed to load organization members');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (canManageOrgMembers) {
      loadOrgMembers();
    }
  }, [canManageOrgMembers]);

  function handleSaveSlaSettings(e: React.FormEvent) {
    e.preventDefault();
    showToast('SLA threshold policy updated successfully', 'success');
  }

  async function handleAddMemberSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = addEmail.trim().toLowerCase();
    const fullName = addFullName.trim();

    if (!email || !email.includes('@')) {
      setAddError('A valid email address is required.');
      return;
    }

    setAddError(null);
    setIsSubmittingAdd(true);

    try {
      const res = await addOrganizationMemberApi({
        email,
        fullName: fullName || undefined,
        role: addRole,
      });

      showToast(res?.message || `Member ${email} added to organization`, 'success');
      setAddEmail('');
      setAddFullName('');
      setAddRole('Teammate');
      setIsAddingMember(false);
      await loadOrgMembers();
    } catch (err: any) {
      const msg = err?.message || 'Failed to add member to organization';
      setAddError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmittingAdd(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingRoleId(userId);
    try {
      const res = await updateOrganizationMemberRoleApi(userId, newRole);
      showToast(res?.message || 'Member role updated successfully', 'success');
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to update member role';
      showToast(msg, 'error');
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function handleConfirmRemoveMember() {
    if (!memberToRemove) return;
    setIsRemoving(true);
    try {
      const res = await removeOrganizationMemberApi(memberToRemove.id);
      showToast(res?.message || `Member ${memberToRemove.name || memberToRemove.email} removed from organization`, 'success');
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      setMemberToRemove(null);
    } catch (err: any) {
      const msg = err?.message || 'Failed to remove member';
      showToast(msg, 'error');
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-text-primary tracking-tight">
          Organization & Profile Settings
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Workspace administration for <span className="font-semibold text-text-secondary">{currentCompany?.name || 'TaskFlow'}</span> · Member access, roles, and SLA policies
        </p>
      </div>

      {/* User Profile Summary */}
      <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Current User Profile</h3>
        <div className="flex items-center gap-4">
          <Avatar user={currentUser} size="lg" />
          <div>
            <p className="text-sm font-bold text-text-primary">{currentUser.name}</p>
            <p className="text-xs text-text-muted">{currentUser.email}</p>
            <span className="inline-block mt-1 text-[11px] font-semibold text-brand-primary uppercase tracking-wider">
              {currentUser.role} Role
            </span>
          </div>
        </div>
      </section>

      {/* Theme & Appearance Preferences */}
      <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-brand-primary" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Theme & Appearance</h3>
            <p className="text-xs text-text-muted">
              Choose your interface theme. System mode automatically adapts to your operating system preference.
            </p>
          </div>
        </div>

        <ThemeToggle variant="segmented" />
      </section>

      {/* Organization Members Management (Admins Only) */}
      {canManageOrgMembers && (
        <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand-primary" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  Organization Member Management
                </h3>
                <p className="text-xs text-text-muted">
                  Manage team membership and assign roles. Any eligible member can be promoted to Manager.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={loadOrgMembers}
                disabled={isLoadingMembers}
                className="h-8 text-xs"
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={UserPlus}
                onClick={() => setIsAddingMember((prev) => !prev)}
                className="h-8 text-xs font-medium"
              >
                {isAddingMember ? 'Cancel' : 'Add Member'}
              </Button>
            </div>
          </div>

          {/* Add Member Drawer / Inline Form */}
          {isAddingMember && (
            <form
              onSubmit={handleAddMemberSubmit}
              className="p-4 rounded-xl bg-surface-elevated border border-brand-primary/30 space-y-3 text-xs"
            >
              <div className="flex items-center gap-2 text-brand-primary font-semibold">
                <UserPlus size={14} />
                <span>Add / Invite Organization Member</span>
              </div>

              {addError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-text-muted mb-1 font-medium">Full Name (Optional)</label>
                  <Input
                    placeholder="e.g. Jordan Smith"
                    value={addFullName}
                    onChange={(e) => setAddFullName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-text-muted mb-1 font-medium">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-text-muted mb-1 font-medium">Organization Role</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="w-full h-9 rounded-lg bg-surface border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    <option value="Teammate">Teammate (Standard Contributor)</option>
                    <option value="Manager">Manager (Project & Sprint Lead)</option>
                    <option value="Admin">Admin (Workspace Administrator)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setIsAddingMember(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSubmittingAdd}
                  icon={Check}
                >
                  {isSubmittingAdd ? 'Adding...' : 'Confirm Add Member'}
                </Button>
              </div>
            </form>
          )}

          {membersError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
              <span>{membersError}</span>
              <button onClick={loadOrgMembers} className="underline font-semibold cursor-pointer">
                Retry
              </button>
            </div>
          )}

          {/* Members Table */}
          {isLoadingMembers ? (
            <div className="py-8 text-center text-xs text-text-muted">
              <RefreshCw size={16} className="animate-spin mx-auto mb-2 text-brand-primary" />
              Loading organization roster...
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center italic">
              No organization members found.
            </p>
          ) : (
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {members.map((m) => {
                const isSelf = m.id === currentUser.id;
                const isUpdating = updatingRoleId === m.id;

                return (
                  <div
                    key={m.id}
                    className="p-3.5 bg-surface hover:bg-surface-elevated/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center font-bold text-xs text-brand-primary shrink-0">
                        {(m.name || m.email || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-text-primary truncate">
                            {m.name || m.fullName || m.email.split('@')[0]}
                          </p>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-primary/10 text-brand-primary font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-text-muted text-[11px] truncate flex items-center gap-1">
                          <Mail size={11} />
                          <span>{m.email}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Role Selector with "All users can be managers" support */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-muted text-[11px]">Role:</span>
                        <select
                          value={m.role}
                          disabled={isSelf || isUpdating}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          className="h-7 rounded-lg bg-surface-elevated border border-border px-2 text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-60 cursor-pointer"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Teammate">Teammate</option>
                        </select>
                      </div>

                      {/* Remove Member Button */}
                      {!isSelf && (
                        <button
                          onClick={() => setMemberToRemove(m)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove from organization"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SLA Policy Thresholds Form */}
      <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-brand-primary" />
          <h3 className="text-sm font-semibold text-text-primary">
            SLA Policy Resolution Thresholds (Hours)
          </h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Configure maximum allowable resolution time before tasks trigger manager escalation alerts.
        </p>

        <form onSubmit={handleSaveSlaSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <Input
            label="High Priority SLA (Hours)"
            type="number"
            min="1"
            value={slaHigh}
            onChange={(e) => setSlaHigh(e.target.value)}
          />
          <Input
            label="Medium Priority SLA (Hours)"
            type="number"
            min="1"
            value={slaMedium}
            onChange={(e) => setSlaMedium(e.target.value)}
          />
          <Input
            label="Low Priority SLA (Hours)"
            type="number"
            min="1"
            value={slaLow}
            onChange={(e) => setSlaLow(e.target.value)}
          />
          <Input
            label="Breach Warning Lead Time (Hours)"
            type="number"
            min="1"
            value={warningThreshold}
            onChange={(e) => setWarningThreshold(e.target.value)}
          />

          <div className="sm:col-span-2 flex justify-end">
            <Button variant="primary" size="sm" type="submit" icon={Check}>
              Save SLA Settings
            </Button>
          </div>
        </form>
      </section>

      {/* Remove Member Confirmation Dialog */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl bg-surface border border-border p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-sm font-bold text-text-primary">Remove Member from Organization</h3>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-text-primary">
                {memberToRemove.name || memberToRemove.email}
              </span>{' '}
              from <span className="font-semibold text-text-primary">{currentCompany?.name || 'this organization'}</span>?
              They will be unassigned from all organization projects. Their global user account will not be deleted.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMemberToRemove(null)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={handleConfirmRemoveMember}
                disabled={isRemoving}
              >
                {isRemoving ? 'Removing...' : 'Confirm Removal'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
