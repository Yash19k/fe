import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Search, Plus, Check, RefreshCw, AlertTriangle, Shield } from 'lucide-react';
import { getOrganizationMembersApi, normalizeRole } from '../../services/api';
import type { User, Role } from '../../types';

export interface AddProjectMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingMemberIds: string[];
  onAddMember: (projectId: string, userId: string, role: Role, user: User) => Promise<boolean> | boolean | any;
  onMemberAdded?: () => void;
}

export function AddProjectMemberDialog({
  isOpen,
  onClose,
  projectId,
  existingMemberIds,
  onAddMember,
  onMemberAdded,
}: AddProjectMemberDialogProps) {
  const [orgMembers, setOrgMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('Teammate');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch organization members when dialog opens
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedUser(null);
      setSelectedRole('Teammate');
      setSubmitError(null);
      return;
    }

    let isMounted = true;
    async function loadMembers() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await getOrganizationMembersApi();
        if (!isMounted) return;
        if (res?.data && Array.isArray(res.data)) {
          const mapped: User[] = res.data.map((u: any) => ({
            id: u.id,
            name: u.name || u.fullName || u.email?.split('@')[0] || 'User',
            email: u.email || '',
            role: normalizeRole(u.role),
            initials: (u.name || u.fullName || u.email || 'U').slice(0, 2).toUpperCase(),
          }));
          setOrgMembers(mapped);
        } else {
          setOrgMembers([]);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setFetchError(err?.message || 'Failed to retrieve organization members from server.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadMembers();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return orgMembers;
    const q = search.toLowerCase();
    return orgMembers.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [orgMembers, search]);

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || isSubmitting) return;

    if (existingSet.has(selectedUser.id)) {
      setSubmitError('This user is already a member of this project.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const success = await onAddMember(projectId, selectedUser.id, selectedRole, selectedUser);
      if (success) {
        onClose();
        if (onMemberAdded) onMemberAdded();
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'An unexpected error occurred while adding member.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add Member to Project"
      description="Select an existing person from your organization to collaborate on this project."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="search"
            placeholder="Search organization members by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isLoading || isSubmitting}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-elevated border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            autoFocus
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-text-muted">
            <RefreshCw size={20} className="animate-spin text-brand-primary mb-2" />
            Loading organization directory...
          </div>
        )}

        {/* Error State */}
        {fetchError && !isLoading && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-rose-200">Unable to load members</p>
              <p className="mt-0.5 text-rose-300/90">{fetchError}</p>
            </div>
          </div>
        )}

        {/* Member Directory List */}
        {!isLoading && !fetchError && (
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Select Member ({filteredMembers.length})
            </label>
            <div className="max-h-56 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border bg-surface-elevated/40">
              {filteredMembers.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted italic">
                  {search.trim()
                    ? 'No organization members match your search.'
                    : 'No members found in this organization.'}
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isAlreadyMember = existingSet.has(member.id);
                  const isSelected = selectedUser?.id === member.id;

                  return (
                    <div
                      key={member.id}
                      onClick={() => {
                        if (!isAlreadyMember && !isSubmitting) {
                          setSelectedUser(member);
                          setSubmitError(null);
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 transition-colors select-none ${
                        isAlreadyMember
                          ? 'opacity-50 cursor-not-allowed bg-surface/30'
                          : isSelected
                            ? 'bg-brand-primary/10 border-l-2 border-brand-primary cursor-pointer'
                            : 'hover:bg-surface-hover/70 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar user={member} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">
                            {member.name}
                          </p>
                          <p className="text-[11px] text-text-muted truncate">{member.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isAlreadyMember ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                            Already in project
                          </span>
                        ) : isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                            {member.role}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Project Role Assignment (when user selected) */}
        {selectedUser && (
          <div className="p-3 rounded-lg bg-surface border border-brand-primary/30 space-y-2 animate-in fade-in duration-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Shield size={13} className="text-brand-primary" />
                Assign Project Role for {selectedUser.name}
              </span>
              <span className="text-[11px] text-text-muted font-mono">{selectedUser.email}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {(['Teammate', 'Manager', 'Admin'] as Role[]).map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                    selectedRole === role
                      ? 'bg-brand-primary text-white border-brand-primary shadow-xs'
                      : 'bg-surface-elevated text-text-secondary border-border hover:border-border-strong'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-text-muted leading-tight pt-0.5">
              {selectedRole === 'Admin'
                ? 'Full project access: settings, members, workflow, deletion.'
                : selectedRole === 'Manager'
                  ? 'Operational access: task creation/editing, sprints, team management.'
                  : 'Contributor access: assigned tasks, comments, time logging.'}
            </p>
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
            {submitError}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            icon={Plus}
            disabled={!selectedUser || isSubmitting}
          >
            {isSubmitting ? 'Adding Member...' : 'Add to Project'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
