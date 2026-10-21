import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Trash2, ArrowRight, Shield, GripVertical, Info, RotateCcw, Save } from 'lucide-react';
import type { WorkflowStatus, Workflow, Task } from '../../types';
import { saveProjectWorkflowApi } from '../../services/api';

export interface WorkflowBuilderViewProps {
  isEmbedded?: boolean;
}

export function WorkflowBuilderView({ isEmbedded = false }: WorkflowBuilderViewProps) {
  const { currentProject, currentWorkflow, setWorkflows, projectTasks, showToast, currentUser } = useApp();

  // Local draft state for workflow customization
  const [draftStatuses, setDraftStatuses] = useState<WorkflowStatus[]>(() =>
    currentWorkflow?.statuses ? JSON.parse(JSON.stringify(currentWorkflow.statuses)) : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6366F1');
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');

  // Drag-and-drop & keyboard reordering state for Lifecycle Flow Stages
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [grabbedIdx, setGrabbedIdx] = useState<number | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  if (!currentWorkflow) return null;

  const originalStatuses = currentWorkflow.statuses || [];
  const isDirty = JSON.stringify(draftStatuses) !== JSON.stringify(originalStatuses);

  function handleAddStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!newStatusName.trim() || !currentWorkflow) return;

    if (draftStatuses.some((s: WorkflowStatus) => s.name.toLowerCase() === newStatusName.trim().toLowerCase())) {
      showToast('A status with this name already exists in the draft', 'error');
      return;
    }

    const newStatus: WorkflowStatus = {
      id: `st-${Date.now()}`,
      name: newStatusName.trim(),
      category: 'active',
      color: newStatusColor,
      allowedTransitions: draftStatuses.map((s: WorkflowStatus) => s.name),
    };

    setDraftStatuses((prev) => [...prev, newStatus]);
    setNewStatusName('');
    showToast(`Status "${newStatus.name}" added to draft workflow`, 'info');
  }

  function handleDeleteStatus(statusObj: WorkflowStatus) {
    // Check if any existing tasks currently occupy this status (Orphaning prevention per Section 12.3)
    const tasksInStatus = projectTasks.filter((t: Task) => t.status === statusObj.name);
    if (tasksInStatus.length > 0) {
      showToast(
        `Cannot remove "${statusObj.name}": ${tasksInStatus.length} work items in this project currently occupy this status. Reassign them first.`,
        'error'
      );
      return;
    }

    setDraftStatuses((prev) =>
      prev
        .filter((s) => s.id !== statusObj.id)
        .map((s) => ({
          ...s,
          allowedTransitions: (s.allowedTransitions || []).filter((name) => name !== statusObj.name),
        }))
    );
    showToast(`Status "${statusObj.name}" removed from draft`, 'info');
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    if (currentUser.role === 'Teammate') return;
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    if (currentUser.role === 'Teammate') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (currentUser.role === 'Teammate') return;
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...draftStatuses];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(targetIndex, 0, moved);

    setDraftStatuses(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
    setLiveAnnouncement(`Moved stage "${moved.name}" to position ${targetIndex + 1} of ${updated.length}`);
  }

  function handleDragEnd() {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function handleKeyDownHandle(e: React.KeyboardEvent, index: number, status: WorkflowStatus) {
    if (currentUser.role === 'Teammate') return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (grabbedIdx === null) {
        setGrabbedIdx(index);
        setLiveAnnouncement(
          `Grabbed stage "${status.name}" at position ${index + 1} of ${draftStatuses.length}. Use Left/Right arrow keys to move, Space or Enter to drop, Escape to cancel.`
        );
      } else {
        const targetPos = index + 1;
        setGrabbedIdx(null);
        setLiveAnnouncement(`Dropped stage "${status.name}" at position ${targetPos} of ${draftStatuses.length}`);
      }
    } else if (grabbedIdx !== null && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (index > 0) {
        const next = [...draftStatuses];
        const [moved] = next.splice(index, 1);
        next.splice(index - 1, 0, moved);
        setDraftStatuses(next);
        setGrabbedIdx(index - 1);
        setLiveAnnouncement(`Moved "${status.name}" to position ${index} of ${next.length}`);
      }
    } else if (grabbedIdx !== null && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (index < draftStatuses.length - 1) {
        const next = [...draftStatuses];
        const [moved] = next.splice(index, 1);
        next.splice(index + 1, 0, moved);
        setDraftStatuses(next);
        setGrabbedIdx(index + 1);
        setLiveAnnouncement(`Moved "${status.name}" to position ${index + 2} of ${next.length}`);
      }
    } else if (e.key === 'Escape' && grabbedIdx !== null) {
      e.preventDefault();
      setGrabbedIdx(null);
      setLiveAnnouncement(`Reordering cancelled for "${status.name}".`);
    }
  }

  function handleStartRename(status: WorkflowStatus) {
    setEditingStatusId(status.id);
    setEditingStatusName(status.name);
  }

  function handleSaveRename(statusId: string) {
    const trimmed = editingStatusName.trim();
    if (!trimmed) {
      setEditingStatusId(null);
      return;
    }

    const oldStatus = draftStatuses.find((s) => s.id === statusId);
    const oldName = oldStatus?.name;

    if (
      oldName !== trimmed &&
      draftStatuses.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      showToast('Another status with that name already exists', 'error');
      return;
    }

    setDraftStatuses((prev) =>
      prev.map((s) => {
        if (s.id === statusId) {
          return { ...s, name: trimmed };
        }
        // Update transition references if renamed
        if (oldName && s.allowedTransitions?.includes(oldName)) {
          return {
            ...s,
            allowedTransitions: s.allowedTransitions.map((t) => (t === oldName ? trimmed : t)),
          };
        }
        return s;
      })
    );
    setEditingStatusId(null);
  }

  function handleToggleTransition(fromStatusId: string, targetStatusName: string) {
    setDraftStatuses((prev) =>
      prev.map((s) => {
        if (s.id === fromStatusId) {
          const currentAllowed = s.allowedTransitions || [];
          const nextAllowed = currentAllowed.includes(targetStatusName)
            ? currentAllowed.filter((name: string) => name !== targetStatusName)
            : [...currentAllowed, targetStatusName];
          return { ...s, allowedTransitions: nextAllowed };
        }
        return s;
      })
    );
  }

  function handleToggleRoleRestriction(statusId: string, targetName: string) {
    setDraftStatuses((prev) =>
      prev.map((s) => {
        if (s.id === statusId) {
          const currentRestr = s.roleRestrictions || {};
          const hasRestriction = Boolean(currentRestr[targetName] && currentRestr[targetName].length > 0);
          const updated = { ...currentRestr };
          if (!hasRestriction) {
            updated[targetName] = ['Manager', 'Admin'];
          } else {
            delete updated[targetName];
          }
          return { ...s, roleRestrictions: updated };
        }
        return s;
      })
    );
  }

  async function handleSaveWorkflow() {
    if (!currentWorkflow || !currentProject) return;

    if (currentUser.role === 'Teammate') {
      showToast('You do not have permission to modify project workflows', 'error');
      return;
    }

    setIsSaving(true);
    const workflowName =
      currentWorkflow.name && !currentWorkflow.name.endsWith(' Workflow') && !/^[0-9a-fA-F-]{20,}/.test(currentWorkflow.name)
        ? currentWorkflow.name
        : 'TaskFlow Pro — Final Statuses';

    try {
      if (currentProject.id && currentProject.id.includes('-')) {
        const res = await saveProjectWorkflowApi(currentProject.id, {
          name: workflowName,
          stages: draftStatuses,
        });
        if (!res?.success) {
          throw new Error('Failed to save workflow configuration.');
        }
      }

      setWorkflows((prev: Workflow[]) =>
        prev.map((w: Workflow) =>
          w.id === currentWorkflow.id || w.projectId === currentProject.id
            ? { ...w, name: workflowName, statuses: draftStatuses }
            : w
        )
      );
      showToast('Workflow configuration saved and published successfully', 'success');
    } catch (err: any) {
      console.error('TaskFlow: Failed to persist workflow to backend:', err);
      showToast(err?.message || 'Failed to persist workflow to backend. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelChanges() {
    if (currentWorkflow?.statuses) {
      setDraftStatuses(JSON.parse(JSON.stringify(currentWorkflow.statuses)));
    }
    showToast('Workflow changes reverted to saved state', 'info');
  }

  return (
    <div className={isEmbedded ? 'space-y-6' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6'}>
      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <Info size={16} className="shrink-0" />
            <span>
              You have unsaved changes in this workflow configuration. Changes remain drafts until explicitly saved.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleCancelChanges} disabled={isSaving}>
              Cancel Changes
            </Button>
            <Button variant="primary" size="sm" icon={Save} onClick={handleSaveWorkflow} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Workflow'}
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Workflow Settings
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Configure lifecycle stages, transitions, and role restrictions with draft saving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-elevated border border-border">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              Active Workflow:
            </span>
            <span className="text-xs font-bold text-text-primary">
              {currentWorkflow.name || 'TaskFlow Pro — Final Statuses'}
            </span>
          </div>
          {isDirty ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Unsaved Draft
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Active
            </span>
          )}
        </div>
      </div>

      {/* Visual Status Flow Sequence */}
      <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Lifecycle Flow Stages</h3>
            <p className="text-xs text-text-muted">
              Sequential order of project workflow statuses. Drag and drop stages to reorder, or use keyboard controls.
            </p>
          </div>
        </div>

        {/* Accessibility screen-reader live announcement region */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none">
          {draftStatuses.map((st: WorkflowStatus, idx: number) => {
            const hasRestrictions = Object.keys(st.roleRestrictions || {}).length > 0;
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx && draggedIdx !== idx;
            const isGrabbed = grabbedIdx === idx;

            return (
              <React.Fragment key={st.id}>
                <div
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg bg-surface-elevated border flex-shrink-0 group transition-all select-none ${
                    isDragging
                      ? 'opacity-40 scale-95 border-dashed border-brand-primary'
                      : isDragOver
                      ? 'border-brand-primary ring-2 ring-brand-primary/30 shadow-md'
                      : isGrabbed
                      ? 'border-brand-primary ring-2 ring-brand-primary shadow-md'
                      : 'border-border'
                  }`}
                >
                  {/* Drag Handle & Accessible Keyboard Reorder Button */}
                  {currentUser.role !== 'Teammate' && (
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                      onKeyDown={(e) => handleKeyDownHandle(e, idx, st)}
                      className={`p-1 -ml-1 rounded text-text-muted hover:text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary cursor-grab active:cursor-grabbing transition-colors ${
                        isGrabbed ? 'text-brand-primary bg-surface' : ''
                      }`}
                      title="Drag to reorder stage (or press Space to reorder with keyboard)"
                      aria-label={`Reorder ${st.name} stage. Currently position ${idx + 1} of ${draftStatuses.length}. Press Space to grab and arrow keys to move.`}
                      aria-grabbed={isGrabbed}
                    >
                      <GripVertical size={13} className="shrink-0" />
                    </button>
                  )}

                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: st.color }}
                  />

                  {editingStatusId === st.id ? (
                    <input
                      type="text"
                      value={editingStatusName}
                      onChange={(e) => setEditingStatusName(e.target.value)}
                      onBlur={() => handleSaveRename(st.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(st.id);
                        if (e.key === 'Escape') setEditingStatusId(null);
                      }}
                      className="text-xs font-semibold bg-surface border border-brand-primary rounded px-1.5 py-0.5 text-text-primary w-28 focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => currentUser.role !== 'Teammate' && handleStartRename(st)}
                      className={`text-xs font-semibold text-text-primary ${
                        currentUser.role !== 'Teammate'
                          ? 'cursor-pointer hover:text-brand-primary transition-colors'
                          : ''
                      }`}
                      title={currentUser.role !== 'Teammate' ? 'Click to rename' : undefined}
                    >
                      {st.name}
                    </span>
                  )}

                  {hasRestrictions && (
                    <span
                      className="text-[10px] text-amber-400 flex items-center gap-0.5"
                      title="Requires Manager/Admin approval"
                    >
                      <Shield size={11} />
                    </span>
                  )}
                </div>

                {idx < draftStatuses.length - 1 && (
                  <ArrowRight size={14} className="text-text-muted flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* Allowed Transitions Matrix */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Allowed Status Transitions Matrix
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Configure allowed transitions from source statuses to destination statuses.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-muted uppercase">
                <th className="py-2 pr-4">From Status</th>
                {draftStatuses.map((col: WorkflowStatus) => (
                  <th key={col.id} className="py-2 px-2 text-center">
                    {col.name}
                  </th>
                ))}
                {currentUser.role !== 'Teammate' && <th className="py-2 px-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {draftStatuses.map((row: WorkflowStatus) => (
                <tr key={row.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-2.5 pr-4 font-semibold text-text-primary flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                    <span>{row.name}</span>
                  </td>

                  {draftStatuses.map((col: WorkflowStatus) => {
                    const isSelf = row.id === col.id;
                    const isAllowed = row.allowedTransitions?.includes(col.name);
                    const requiresRole = row.roleRestrictions?.[col.name];

                    return (
                      <td key={col.id} className="py-2.5 px-2 text-center">
                        {isSelf ? (
                          <span className="text-text-muted/40 font-mono">—</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              disabled={currentUser.role === 'Teammate'}
                              onChange={() => handleToggleTransition(row.id, col.name)}
                              className="rounded border-border text-brand-primary cursor-pointer disabled:opacity-50"
                              title={isAllowed ? 'Disallow transition' : 'Allow transition'}
                            />
                            {isAllowed && (
                              <button
                                onClick={() => handleToggleRoleRestriction(row.id, col.name)}
                                className={`p-0.5 rounded transition-colors ${
                                  requiresRole
                                    ? 'text-amber-400 bg-amber-500/10'
                                    : 'text-text-muted/40 hover:text-text-muted'
                                }`}
                                title={
                                  requiresRole
                                    ? 'Requires Manager/Admin role (click to remove)'
                                    : 'Require Manager role to perform transition'
                                }
                              >
                                <Shield size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {currentUser.role !== 'Teammate' && (
                    <td className="py-2.5 px-2 text-right">
                      <button
                        onClick={() => handleDeleteStatus(row)}
                        className="text-text-muted hover:text-rose-400 p-1 transition-colors"
                        title="Remove status"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add New Status Form */}
      {currentUser.role !== 'Teammate' && (
        <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Add Stage to Workflow Draft</h3>
          <form onSubmit={handleAddStatus} className="flex flex-wrap items-end gap-3 text-xs">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Stage Name"
                placeholder="e.g. QA Verification"
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Color</label>
              <input
                type="color"
                value={newStatusColor}
                onChange={(e) => setNewStatusColor(e.target.value)}
                className="w-10 h-9 rounded bg-surface border border-border p-1 cursor-pointer"
              />
            </div>
            <Button variant="primary" size="md" type="submit" icon={Plus}>
              Add to Draft
            </Button>
          </form>
        </section>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button
          variant="secondary"
          size="md"
          icon={RotateCcw}
          onClick={handleCancelChanges}
          disabled={!isDirty}
        >
          Cancel Changes
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={Save}
          onClick={handleSaveWorkflow}
          disabled={!isDirty}
        >
          Save Workflow
        </Button>
      </div>
    </div>
  );
}
