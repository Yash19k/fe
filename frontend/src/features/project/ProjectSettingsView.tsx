import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Input, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Avatar } from '../../components/ui/Avatar';
import { hasPermission, PERMISSIONS } from '../../domain/permissions';
import { validateProjectId, normalizeProjectId } from '../../domain/projects';
import {
  Settings,
  ShieldAlert,
  AlertTriangle,
  Trash2,
  Save,
  RotateCcw,
  Users,
  Copy,
  Check,
  Tag,
  History,
  Pencil,
  Plus,
  Search,
  Crown,
  Activity,
  AlertCircle,
} from 'lucide-react';
import type { User, ProjectVisibility, Role, Label, AuditLogEntry, Task } from '../../types';

export type SettingsSection = 'general' | 'members' | 'labels' | 'activity';

interface ProjectSettingsViewProps {
  initialSection?: SettingsSection;
}

export function ProjectSettingsView({ initialSection = 'general' }: ProjectSettingsViewProps) {
  const {
    currentProject,
    currentUser,
    allUsers,
    projects,
    updateProject,
    updateProjectKey,
    deleteProject,
    addProjectMember,
    removeProjectMember,
    updateProjectMemberRole,
    projectLabels,
    createLabel,
    deleteLabel,
    projectTasks,
    auditLog,
    undoAuditEntry,
    showToast,
  } = useApp();

  // Active section inside Settings
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    if (initialSection) return initialSection;
    if (typeof window !== 'undefined' && (window.location.hash.includes('#members') || window.location.hash.endsWith('/members'))) {
      return 'members';
    }
    if (typeof window !== 'undefined' && (window.location.hash.includes('#activity') || window.location.hash.endsWith('/activity'))) {
      return 'activity';
    }
    if (typeof window !== 'undefined' && window.location.hash.includes('#labels')) {
      return 'labels';
    }
    return 'general';
  });

  // Sync active section if initialSection prop changes
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Listen for hash changes to sync internal section
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash;
      if (hash.includes('#members') || hash.endsWith('/members')) setActiveSection('members');
      else if (hash.includes('#activity') || hash.endsWith('/activity')) setActiveSection('activity');
      else if (hash.includes('#labels')) setActiveSection('labels');
      else if (hash.includes('#general')) setActiveSection('general');
    }
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // ==========================================
  // GENERAL SETTINGS DRAFT STATE (Feature 12)
  // ==========================================
  const [draftName, setDraftName] = useState(currentProject?.name || '');
  const [draftDescription, setDraftDescription] = useState(currentProject?.description || '');
  const [draftVisibility, setDraftVisibility] = useState<ProjectVisibility>(
    currentProject?.visibility || 'global'
  );
  const [draftStartDate, setDraftStartDate] = useState(currentProject?.startDate || '');
  const [draftDueDate, setDraftDueDate] = useState(currentProject?.dueDate || '');

  const isGeneralDirty = useMemo(() => {
    if (!currentProject) return false;
    return (
      draftName !== (currentProject.name || '') ||
      draftDescription !== (currentProject.description || '') ||
      draftVisibility !== (currentProject.visibility || 'global') ||
      draftStartDate !== (currentProject.startDate || '') ||
      draftDueDate !== (currentProject.dueDate || '')
    );
  }, [currentProject, draftName, draftDescription, draftVisibility, draftStartDate, draftDueDate]);

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Key editing state
  const [copiedKey, setCopiedKey] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [projectKeyInput, setProjectKeyInput] = useState(
    currentProject?.projectKey || currentProject?.id.toUpperCase() || ''
  );
  const [keyError, setKeyError] = useState('');

  // Delete Project Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // ==========================================
  // MEMBERS SECTION STATE (Feature 6 & 14)
  // ==========================================
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAddRole, setSelectedAddRole] = useState<Role>('Teammate');
  const [memberSearch, setMemberSearch] = useState('');

  // Role Change Confirmation Dialog State
  const [roleChangeModalOpen, setRoleChangeModalOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    user: User;
    currentRole: Role;
    proposedRole: Role;
  } | null>(null);

  // Remove Member Dialog State
  const [memberToRemove, setMemberToRemove] = useState<User | null>(null);

  // ==========================================
  // LABELS SECTION STATE (Feature 8)
  // ==========================================
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#3B82F6');
  const [labelDescription, setLabelDescription] = useState('');
  const [labelError, setLabelError] = useState('');
  const [labelToDelete, setLabelToDelete] = useState<Label | null>(null);

  // ==========================================
  // ACTIVITY & AUDIT SECTION STATE (Feature 13)
  // ==========================================
  const [auditFilter, setAuditFilter] = useState('');

  // Pre-calculate member lists and filtered members hook unconditionally at top level
  const currentMemberIds = currentProject?.memberIds || [];
  const projectMembers = allUsers.filter((u: User) => currentMemberIds.includes(u.id));
  const nonMembers = allUsers.filter((u: User) => !currentMemberIds.includes(u.id));

  const filteredMembers = useMemo(() => {
    if (!currentProject) return [];
    if (!memberSearch.trim()) return projectMembers;
    const q = memberSearch.toLowerCase();
    return projectMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (currentProject.memberRoles?.[m.id] || m.role).toLowerCase().includes(q)
    );
  }, [projectMembers, memberSearch, currentProject]);

  const projectAuditLog = useMemo(() => {
    if (!currentProject) return [];
    const projectTaskIds = new Set(projectTasks.map((t: Task) => t.id));

    return auditLog.filter((log: AuditLogEntry) => {
      const matchesScope =
        log.projectId === currentProject.id ||
        (log.entityType === 'project' && log.entityId === currentProject.id) ||
        (log.entityType === 'task' && projectTaskIds.has(log.entityId));

      if (!matchesScope) return false;
      if (!auditFilter.trim()) return true;

      const q = auditFilter.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q)
      );
    });
  }, [currentProject, projectTasks, auditLog, auditFilter]);

  if (!currentProject) return null;

  const canEdit = hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS);
  const canDelete = hasPermission(currentUser.role, PERMISSIONS.DELETE_PROJECT);
  const canManageMembers = currentUser.role !== 'Teammate';

  // --- GENERAL HANDLERS ---
  function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !currentProject) return;

    const trimmed = draftName.trim();
    if (!trimmed) {
      setGeneralError('Project name cannot be empty');
      return;
    }
    if (draftStartDate && draftDueDate && draftDueDate < draftStartDate) {
      setGeneralError('Project due date must be on or after the start date');
      return;
    }

    setGeneralError(null);
    setIsSavingGeneral(true);

    const success = updateProject(currentProject.id, {
      name: trimmed,
      description: draftDescription.trim(),
      visibility: draftVisibility,
      startDate: draftStartDate || '',
      dueDate: draftDueDate || '',
    });

    setIsSavingGeneral(false);
    if (!success) {
      setGeneralError('Failed to save project settings. Please try again.');
    }
  }

  function handleCancelGeneral() {
    if (!currentProject) return;
    setDraftName(currentProject.name || '');
    setDraftDescription(currentProject.description || '');
    setDraftVisibility(currentProject.visibility || 'global');
    setDraftStartDate(currentProject.startDate || '');
    setDraftDueDate(currentProject.dueDate || '');
    setGeneralError(null);
  }

  function handleCopyKey() {
    const key = currentProject?.projectKey || currentProject?.id || '';
    navigator.clipboard?.writeText(key);
    setCopiedKey(true);
    showToast('Project Key copied to clipboard', 'info');
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function handleStartEditKey() {
    setProjectKeyInput(currentProject?.projectKey || currentProject?.id.toUpperCase() || '');
    setKeyError('');
    setIsEditingKey(true);
  }

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProject || !canEdit) return;

    const val = projectKeyInput.trim();
    const validation = validateProjectId(val, projects, currentProject.id);
    if (!validation.isValid) {
      setKeyError(validation.error || 'Invalid project identifier');
      return;
    }

    const res = updateProjectKey(currentProject.id, val);
    if (res.success) {
      setIsEditingKey(false);
      setKeyError('');
    } else if (res.error) {
      setKeyError(res.error);
    }
  }

  function handleConfirmDelete(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!currentProject || !canDelete || deleteConfirmText.trim() !== 'DELETE') return;
    deleteProject(currentProject.id);
    setDeleteModalOpen(false);
  }

  // --- MEMBERS HANDLERS ---
  function handleAddMemberSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !currentProject) return;

    addProjectMember(currentProject.id, selectedUserId, selectedAddRole);
    setSelectedUserId('');
    setSelectedAddRole('Teammate');
  }

  function handleInitiateRoleChange(user: User, currentRole: Role, proposedRole: Role) {
    if (currentRole === proposedRole) return;
    setPendingRoleChange({ user, currentRole, proposedRole });
    setRoleChangeModalOpen(true);
  }

  function handleConfirmRoleChange() {
    if (!pendingRoleChange || !currentProject) return;
    updateProjectMemberRole(
      currentProject.id,
      pendingRoleChange.user.id,
      pendingRoleChange.proposedRole
    );
    setRoleChangeModalOpen(false);
    setPendingRoleChange(null);
  }

  function handleCancelRoleChange() {
    setRoleChangeModalOpen(false);
    setPendingRoleChange(null);
  }

  function handleConfirmRemoveMember() {
    if (!memberToRemove || !currentProject) return;
    removeProjectMember(currentProject.id, memberToRemove.id);
    setMemberToRemove(null);
  }

  // --- LABELS HANDLERS ---
  function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = labelName.trim();
    if (!trimmed) {
      setLabelError('Label name is required');
      return;
    }
    if (projectLabels.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) {
      setLabelError('A label with this name already exists');
      return;
    }

    createLabel({
      name: trimmed,
      color: labelColor,
      description: labelDescription.trim(),
      projectId: currentProject?.id,
    });

    setLabelName('');
    setLabelDescription('');
    setLabelError('');
  }

  function handleConfirmDeleteLabel() {
    if (!labelToDelete) return;
    deleteLabel(labelToDelete.id);
    setLabelToDelete(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header with Project Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0"
            style={{ backgroundColor: currentProject.color }}
          >
            <Settings size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                Project Settings
              </h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-elevated border border-border text-text-secondary font-semibold">
                {currentProject.name}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Manage project metadata, team roles, labels, and audit trails in one place.
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-elevated border border-border text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('general')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'general'
                ? 'bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Settings size={13} />
            <span>General</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('members')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'members'
                ? 'bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Users size={13} />
            <span>Members ({projectMembers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('labels')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'labels'
                ? 'bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Tag size={13} />
            <span>Labels ({projectLabels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('activity')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'activity'
                ? 'bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <History size={13} />
            <span>Activity & Audit</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. GENERAL SETTINGS SECTION                          */}
      {/* ==================================================== */}
      {activeSection === 'general' && (
        <div className="space-y-6">
          {/* Unsaved Changes Banner */}
          {isGeneralDirty && (
            <div className="p-3.5 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-between gap-3 text-xs text-brand-primary">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-semibold text-text-primary">
                  You have unsaved changes in project general settings.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  icon={RotateCcw}
                  onClick={handleCancelGeneral}
                >
                  Discard
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="button"
                  icon={Save}
                  onClick={handleSaveGeneral}
                  disabled={isSavingGeneral}
                >
                  {isSavingGeneral ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          {generalError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2"
            >
              <AlertCircle size={15} className="text-rose-400 mt-0.5 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Form */}
          <section className="bg-surface rounded-xl border border-border p-6 space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-sm font-semibold text-text-primary">General Information</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Basic project metadata, display properties, and timeline boundaries.
              </p>
            </div>

            <form onSubmit={handleSaveGeneral} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Project Name */}
                <div>
                  <Input
                    label="Project Name *"
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value);
                      if (generalError) setGeneralError(null);
                    }}
                    disabled={!canEdit}
                  />
                </div>

                {/* Project Key */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Project Key / Slug
                  </label>
                  {isEditingKey ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={projectKeyInput}
                        onChange={(e) => {
                          const formatted = normalizeProjectId(e.target.value);
                          setProjectKeyInput(formatted);
                          if (keyError) setKeyError('');
                        }}
                        placeholder="e.g. ALPHA"
                        className="font-mono text-xs uppercase px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary flex-1"
                        autoFocus
                      />
                      <Button variant="primary" size="sm" type="button" onClick={handleSaveKey}>
                        Save Key
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setIsEditingKey(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between h-9 px-3 rounded-lg bg-surface-elevated border border-border">
                      <span className="font-mono text-xs font-semibold text-text-primary">
                        {currentProject.projectKey || currentProject.id.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={handleStartEditKey}
                            className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                            title="Edit Project Key"
                            aria-label="Edit Project Key"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Copy Key"
                          aria-label="Copy Key"
                        >
                          {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {keyError && <p className="text-[11px] text-rose-400 mt-1">{keyError}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <Textarea
                  label="Description"
                  placeholder="Outline the core scope, deliverables, and team objectives for this project."
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                />
              </div>

              {/* Dates & Visibility */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label htmlFor="settings-start-date" className="block text-xs font-medium text-text-secondary mb-1">
                    Start Date
                  </label>
                  <input
                    id="settings-start-date"
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    disabled={!canEdit}
                    className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label htmlFor="settings-due-date" className="block text-xs font-medium text-text-secondary mb-1">
                    Target Completion / Due Date
                  </label>
                  <input
                    id="settings-due-date"
                    type="date"
                    value={draftDueDate}
                    onChange={(e) => setDraftDueDate(e.target.value)}
                    disabled={!canEdit}
                    className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Access Visibility
                  </label>
                  <select
                    value={draftVisibility}
                    onChange={(e) => setDraftVisibility(e.target.value as ProjectVisibility)}
                    disabled={!canEdit}
                    className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
                  >
                    <option value="global">Global (All Workspace Users)</option>
                    <option value="private">Private (Restricted to Members)</option>
                  </select>
                </div>
              </div>

              {/* Save / Cancel Action Bar */}
              {canEdit && (
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
                  <Button
                    variant="secondary"
                    size="md"
                    type="button"
                    icon={RotateCcw}
                    onClick={handleCancelGeneral}
                    disabled={!isGeneralDirty || isSavingGeneral}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    icon={Save}
                    disabled={!isGeneralDirty || isSavingGeneral}
                  >
                    {isSavingGeneral ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </form>
          </section>

          {/* Danger Zone: Delete Project with typed confirmation */}
          <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
            <div className="border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert size={18} />
                <h2 className="text-sm font-bold tracking-tight text-rose-300">
                  Danger Zone
                </h2>
              </div>
              <p className="text-xs text-rose-300/80 mt-1">
                Destructive actions that cannot be undone. Please proceed with caution.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-rose-200">
                  Delete Project
                </h3>
                <p className="text-xs text-rose-300/80 leading-relaxed max-w-lg">
                  Permanently removes &quot;{currentProject.name}&quot;, including all tasks,
                  sprints, dependencies, sections, and attachments.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                disabled={!canDelete}
                onClick={() => setDeleteModalOpen(true)}
                className="shrink-0"
              >
                Delete Project
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. MEMBERS & ROLES SECTION (Feature 6 & 14)          */}
      {/* ==================================================== */}
      {activeSection === 'members' && (
        <div className="space-y-6">
          {/* Add Member Bar */}
          {canManageMembers && nonMembers.length > 0 && (
            <form
              onSubmit={handleAddMemberSubmit}
              className="p-4 rounded-xl bg-surface border border-border flex flex-wrap items-end gap-3 text-xs"
            >
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Add Member to Project
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-3 text-xs text-text-primary focus:outline-none"
                >
                  <option value="">Select an available user...</option>
                  {nonMembers.map((u: User) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-36">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Project Role
                </label>
                <select
                  value={selectedAddRole}
                  onChange={(e) => setSelectedAddRole(e.target.value as Role)}
                  className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-3 text-xs text-text-primary focus:outline-none cursor-pointer"
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Teammate">Teammate</option>
                </select>
              </div>

              <Button
                variant="primary"
                size="md"
                type="submit"
                icon={Plus}
                disabled={!selectedUserId}
              >
                Add Member
              </Button>
            </form>
          )}

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="relative w-full max-w-xs">
              <input
                type="search"
                placeholder="Filter members by name or email..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>

            <div className="text-text-muted text-[11px] font-mono">
              {projectMembers.length} {projectMembers.length === 1 ? 'member' : 'members'} in project
            </div>
          </div>

          {/* Members Table */}
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[2fr_140px_110px_110px_110px_50px] gap-3 px-5 py-2.5 border-b border-border bg-surface-elevated text-[11px] font-semibold text-text-muted uppercase tracking-wider">
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
                  {projectMembers.length === 0
                    ? 'No members currently in this project.'
                    : 'No members match the search query.'}
                </div>
              ) : (
                filteredMembers.map((member: User) => {
                  const memberTasks = projectTasks.filter(
                    (t: Task) => t.assigneeId === member.id || t.assigneeIds?.includes(member.id)
                  );
                  const doneTasks = memberTasks.filter((t: Task) => t.status === 'Done');
                  const activeCount = memberTasks.length - doneTasks.length;
                  const isOwner = member.id === currentProject.ownerId;
                  const currentRole =
                    currentProject.memberRoles?.[member.id] || member.role || 'Teammate';

                  return (
                    <div
                      key={member.id}
                      className="grid grid-cols-1 md:grid-cols-[2fr_140px_110px_110px_110px_50px] gap-3 items-center px-5 py-3.5 hover:bg-surface-hover/70 transition-colors text-xs"
                    >
                      {/* Member Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar user={member} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-text-primary truncate">{member.name}</p>
                            {isOwner && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 shrink-0"
                                title="Project Owner"
                              >
                                <Crown size={10} />
                                Owner
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted truncate">{member.email}</p>
                        </div>
                      </div>

                      {/* Role Selector with Confirmation Trigger (Feature 6) */}
                      <div>
                        {canManageMembers ? (
                          <select
                            value={currentRole}
                            onChange={(e) =>
                              handleInitiateRoleChange(member, currentRole, e.target.value as Role)
                            }
                            className="h-7 rounded-md bg-surface-elevated border border-border px-2 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
                            title="Change member role in project (requires confirmation)"
                          >
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Teammate">Teammate</option>
                          </select>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-active border border-border text-text-secondary">
                            {currentRole}
                          </span>
                        )}
                      </div>

                      {/* Assigned Tasks */}
                      <div className="font-mono text-text-primary">
                        {memberTasks.length} tasks
                      </div>

                      {/* Completed Tasks */}
                      <div className="font-mono text-emerald-400">
                        {doneTasks.length} closed
                      </div>

                      {/* Workload Status */}
                      <div>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded ${
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

                      {/* Actions */}
                      <div className="text-right">
                        {canManageMembers && !isOwner && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="text-text-muted hover:text-rose-400 p-1 rounded hover:bg-surface-elevated transition-colors cursor-pointer"
                            title="Remove member from project"
                            aria-label={`Remove ${member.name} from project`}
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
          </section>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. LABELS MANAGEMENT SECTION (Feature 8)             */}
      {/* ==================================================== */}
      {activeSection === 'labels' && (
        <div className="space-y-6">
          {/* Create Label Form */}
          <section className="bg-surface rounded-xl border border-border p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Tag size={16} />
                <span>Create New Label</span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Add descriptive tags to categorize and filter work items in this project.
              </p>
            </div>

            {labelError && (
              <p className="text-xs text-rose-400 font-medium">{labelError}</p>
            )}

            <form onSubmit={handleCreateLabel} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    label="Label Name *"
                    placeholder="e.g. Design, Performance, Infrastructure"
                    value={labelName}
                    onChange={(e) => {
                      setLabelName(e.target.value);
                      if (labelError) setLabelError('');
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Label Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={labelColor}
                      onChange={(e) => setLabelColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-surface border border-border p-1 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={labelColor}
                      onChange={(e) => setLabelColor(e.target.value)}
                      className="h-9 rounded-lg bg-surface-elevated border border-border px-2 text-xs font-mono text-text-primary w-24"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Input
                  label="Description (Optional)"
                  placeholder="Short note describing when to apply this label"
                  value={labelDescription}
                  onChange={(e) => setLabelDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button variant="primary" size="md" type="submit" icon={Plus} disabled={!labelName.trim()}>
                  Create Label
                </Button>
              </div>
            </form>
          </section>

          {/* Existing Labels List */}
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Available Labels ({projectLabels.length})
              </h3>
              <span className="text-[11px] text-text-muted">
                Applied across backlog, board, and list views
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {projectLabels.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted italic">
                  No labels configured for this project yet. Use the form above to create one.
                </div>
              ) : (
                projectLabels.map((lbl: Label) => {
                  const tasksWithLabel = projectTasks.filter(
                    (t: Task) => t.labels?.includes(lbl.id) || t.labels?.includes(lbl.name)
                  );

                  return (
                    <div
                      key={lbl.id}
                      className="flex items-center justify-between p-4 hover:bg-surface-hover/70 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-xs"
                          style={{ backgroundColor: lbl.color }}
                        >
                          {lbl.name}
                        </span>
                        <div className="min-w-0">
                          <p className="text-text-muted text-[11px] truncate">
                            {lbl.description || 'No description provided'}
                          </p>
                          <span className="text-[10px] text-text-muted font-mono">
                            {tasksWithLabel.length} {tasksWithLabel.length === 1 ? 'task' : 'tasks'} using this label
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLabelToDelete(lbl)}
                        className="text-text-muted hover:text-rose-400 p-1.5 rounded hover:bg-surface-elevated transition-colors cursor-pointer"
                        title="Delete label"
                        aria-label={`Delete label ${lbl.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. ACTIVITY & AUDIT SECTION (Feature 13 & 18)        */}
      {/* ==================================================== */}
      {activeSection === 'activity' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Project Activity & Audit Trail
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Full chronological ledger of work item mutations, schedule shifts, and membership changes.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="search"
                placeholder="Search audit trail..."
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>
          </div>

          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[130px_110px_1fr_160px_90px] gap-3 px-5 py-2.5 border-b border-border bg-surface-elevated text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              <span>Action</span>
              <span>Entity</span>
              <span>Description</span>
              <span>Timestamp</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-border/60">
              {projectAuditLog.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted space-y-2">
                  <Activity size={24} className="mx-auto text-text-muted/60" />
                  <p className="font-medium text-text-secondary">No activity recorded for this project yet</p>
                  <p className="text-[11px]">Mutations, task updates, and membership actions in this project will appear here.</p>
                </div>
              ) : (
                projectAuditLog.map((log: AuditLogEntry) => (
                  <div
                    key={log.id}
                    className="grid grid-cols-1 md:grid-cols-[130px_110px_1fr_160px_90px] gap-3 items-center px-5 py-3 hover:bg-surface-hover/70 transition-colors text-xs"
                  >
                    <div>
                      <span className="font-mono text-[10px] uppercase text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                        {log.action}
                      </span>
                    </div>

                    <div className="text-text-muted capitalize">
                      {log.entityType} ({log.entityId})
                    </div>

                    <div className="font-medium text-text-primary truncate">
                      {log.description}
                    </div>

                    <div className="text-[11px] text-text-muted font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>

                    <div className="flex justify-end">
                      {log.canUndo && currentUser.role !== 'Teammate' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={RotateCcw}
                          onClick={() => undoAuditEntry(log.id)}
                          title="Undo mutation"
                        >
                          Undo
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* ==================================================== */}
      {/* ROLE CHANGE CONFIRMATION MODAL (Feature 6)           */}
      {/* ==================================================== */}
      {pendingRoleChange && (
        <Dialog
          isOpen={roleChangeModalOpen}
          onClose={handleCancelRoleChange}
          title="Confirm Role Change"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-elevated border border-border">
              <Avatar user={pendingRoleChange.user} size="lg" />
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-bold text-text-primary truncate">
                  {pendingRoleChange.user.name}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {pendingRoleChange.user.email}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
                    Current: {pendingRoleChange.currentRole}
                  </span>
                  <span>&rarr;</span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-brand-primary/20 border border-brand-primary/40 text-brand-primary">
                    Proposed: {pendingRoleChange.proposedRole}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <p className="font-semibold text-amber-200">
                Permission Implications:
              </p>
              <p className="leading-relaxed">
                {pendingRoleChange.proposedRole === 'Admin'
                  ? 'Admins have full operational control over the project, access settings, member roles, and deletion rights.'
                  : pendingRoleChange.proposedRole === 'Manager'
                    ? 'Managers can create/edit/delete tasks, create sprints, manage team members, and approve workflow transitions.'
                    : 'Teammates can view project assets, update tasks assigned to them, and post comments.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={handleCancelRoleChange}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={handleConfirmRoleChange}
              >
                Confirm Role Change
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Remove Member Confirmation Dialog */}
      {memberToRemove && (
        <Dialog
          isOpen={Boolean(memberToRemove)}
          onClose={() => setMemberToRemove(null)}
          title="Remove Member from Project"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to remove <strong className="text-text-primary">{memberToRemove.name}</strong> from this project?
              Their assigned tasks will remain in the project but will become unassigned.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMemberToRemove(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRemoveMember}
              >
                Remove Member
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Label Confirmation Dialog */}
      {labelToDelete && (
        <Dialog
          isOpen={Boolean(labelToDelete)}
          onClose={() => setLabelToDelete(null)}
          title="Delete Label"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to delete the label <strong className="text-text-primary">&quot;{labelToDelete.name}&quot;</strong>?
              It will be unlinked from all work items currently tagged with it.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLabelToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDeleteLabel}
              >
                Delete Label
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmText('');
        }}
        title="Delete Project Confirmation"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmDelete} className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-400" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-200">
                Are you sure you want to delete &quot;{currentProject.name}&quot;?
              </p>
              <p className="text-[11px] text-rose-300/90 leading-relaxed">
                This will immediately remove the project, its tasks, sections, and associated data.
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">
              To confirm deletion, type <span className="font-mono font-bold text-rose-400">DELETE</span> below:
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="font-mono text-xs"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              type="submit"
              icon={Trash2}
              disabled={deleteConfirmText.trim() !== 'DELETE'}
            >
              Delete Project
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
