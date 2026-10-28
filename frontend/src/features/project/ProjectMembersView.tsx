import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Plus, Trash2, Search, ShieldAlert } from 'lucide-react';
import { AddProjectMemberDialog } from '../../components/modals/AddProjectMemberDialog';
import type { User, Task, Role } from '../../types';

export function ProjectMembersView() {
  const {
    currentProject,
    allUsers,
    projectTasks,
    currentUser,
    addProjectMember,
    removeProjectMember,
    updateProjectMemberRole,
    showToast,
  } = useApp();

  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('Teammate');
  const [memberToRemove, setMemberToRemove] = useState<User | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const currentMemberIds = useMemo(
    () => currentProject?.memberIds || [],
    [currentProject?.memberIds]
  );
  const members = useMemo(
    () => allUsers.filter((u: User) => currentMemberIds.includes(u.id)),
    [allUsers, currentMemberIds]
  );
  const nonMembers = useMemo(
    () => allUsers.filter((u: User) => !currentMemberIds.includes(u.id)),
    [allUsers, currentMemberIds]
  );

  // Filtered members for table search
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (currentProject?.memberRoles?.[m.id] || m.role).toLowerCase().includes(q)
    );
  }, [members, memberSearch, currentProject?.memberRoles]);

  if (!currentProject) return null;

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !currentProject) return;

    if (currentMemberIds.includes(selectedUserId)) {
      showToast('User is already a member of this project', 'error');
      return;
    }

    addProjectMember(currentProject.id, selectedUserId, selectedRole);
    setSelectedUserId('');
    setSelectedRole('Teammate');
  }

  function handleRoleChange(userId: string, newRole: Role) {
    if (!currentProject) return;
    updateProjectMemberRole(currentProject.id, userId, newRole);
  }

  function handleConfirmRemove() {
    if (!memberToRemove || !currentProject) return;
    removeProjectMember(currentProject.id, memberToRemove.id);
    setMemberToRemove(null);
  }

  const canManageMembers = currentUser.role !== 'Teammate';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Project Members & Workload Distribution
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Team roster, project-level roles, and active task capacity.
          </p>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative w-full max-w-xs">
          <input
            type="search"
            placeholder="Filter project members..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>

        <div className="flex items-center gap-3">
          <div className="text-text-muted text-[11px] font-mono">
            {members.length} {members.length === 1 ? 'member' : 'members'} in project
          </div>

          {canManageMembers && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setAddMemberModalOpen(true)}
            >
              Add Member
            </Button>
          )}
        </div>
      </div>

      {/* Members Table */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            <div className="grid grid-cols-[minmax(220px,2fr)_140px_110px_100px_110px_70px] gap-3 px-5 py-2.5 border-b border-border bg-surface-elevated text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
              <span>Member</span>
              <span>Project Role</span>
              <span>Assigned Tasks</span>
              <span>Completed</span>
              <span>Workload</span>
              <span className="text-right">Actions</span>
            </div>

        <div className="divide-y divide-border/60">
          {filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted italic">
              {members.length === 0
                ? 'No members currently in this project.'
                : 'No members match the search query.'}
            </div>
          ) : (
            filteredMembers.map((member: User) => {
              const memberTasks = projectTasks.filter((t: Task) => {
                if (t.assigneeId === member.id) return true;
                if (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(member.id)) return true;
                if (Array.isArray(t.assignees) && t.assignees.some((a: any) => a.id === member.id || a.userId === member.id)) return true;
                return false;
              });
              const doneTasks = memberTasks.filter((t: Task) => t.status === 'Done');
              const activeCount = memberTasks.length - doneTasks.length;
              const isOwner = member.id === currentProject.ownerId;
              const isSelf = Boolean(
                currentUser?.id &&
                (member.id === currentUser.id ||
                 (member.email && currentUser.email && member.email.toLowerCase() === currentUser.email.toLowerCase()))
              );
              const effectiveRole =
                currentProject.memberRoles?.[member.id] || member.role || 'Teammate';

              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[minmax(220px,2fr)_140px_110px_100px_110px_70px] gap-3 items-center px-5 py-3 hover:bg-surface-hover/70 transition-colors text-xs"
                >
                  {/* Member Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={member} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-text-primary truncate">{member.name}</p>
                        {isSelf && (
                          <span
                            className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.2 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/25 shrink-0"
                            title="Currently logged-in user"
                          >
                            You
                          </span>
                        )}

                      </div>
                      <p className="text-[11px] text-text-muted truncate">{member.email}</p>
                    </div>
                  </div>

                  {/* Role Selector or Display */}
                  <div>
                    {isSelf ? (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-active border border-border text-text-secondary select-none">
                        {effectiveRole}
                      </span>
                    ) : canManageMembers ? (
                      <select
                        value={effectiveRole}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                        className="h-7 rounded-md bg-surface-elevated border border-border px-2 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
                        title="Change member role in project"
                        aria-label={`Change role for ${member.name}`}
                      >
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Teammate">Teammate</option>
                      </select>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-active border border-border text-text-secondary">
                        {effectiveRole}
                      </span>
                    )}
                  </div>

                  {/* Assigned */}
                  <div className="font-mono text-text-primary truncate">
                    {memberTasks.length} {memberTasks.length === 1 ? 'task' : 'tasks'}
                  </div>

                  {/* Completed */}
                  <div className="font-mono text-emerald-500 dark:text-emerald-400 truncate">
                    {doneTasks.length} closed
                  </div>

                  {/* Workload Status */}
                  <div className="flex items-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-[76px] text-[10px] font-medium px-2 py-0.5 rounded ${
                        activeCount > 4
                          ? 'bg-rose-500/15 text-rose-300'
                          : activeCount > 2
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {activeCount > 4 ? 'High Load' : activeCount > 2 ? 'Normal' : 'Available'}
                    </span>
                  </div>

                  {/* Remove Action */}
                  <div className="flex justify-end">
                    {canManageMembers && !isSelf && (
                      <button
                        onClick={() => setMemberToRemove(member)}
                        disabled={isOwner}
                        className={`p-1.5 rounded transition-colors ${
                          isOwner
                            ? 'text-text-muted/40 cursor-not-allowed'
                            : 'text-text-muted hover:text-rose-400 hover:bg-surface-elevated'
                        }`}
                        title={
                          isOwner
                            ? 'Project owner cannot be removed'
                            : `Remove ${member.name} from project`
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
          </div>
        </div>
      </section>

      {/* Add Member to Project Dialog */}
      {addMemberModalOpen && currentProject && (
        <AddProjectMemberDialog
          isOpen={addMemberModalOpen}
          onClose={() => setAddMemberModalOpen(false)}
          projectId={currentProject.id}
          existingMemberIds={currentMemberIds}
          onAddMember={addProjectMember}
        />
      )}

      {/* Accessible Confirmation Dialog for Removing Member */}
      <Dialog
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        title="Remove Member from Project"
        description="Confirm member removal"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div className="text-xs text-text-secondary space-y-1">
              <p>
                Are you sure you want to remove{' '}
                <span className="font-semibold text-text-primary">{memberToRemove?.name}</span> from{' '}
                <span className="font-semibold text-text-primary">{currentProject.name}</span>?
              </p>
              <p className="text-[11px] text-text-muted">
                Their assigned tasks in this project will remain intact. Their global user account will
                not be deleted. If this is a private project, they will lose access immediately.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmRemove}>
              Remove Member
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
