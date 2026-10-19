import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Repeat,
  Network,
  MessageSquare,
  Shield,
  Zap,
  Plus,
  ArrowUpRight,
  Save,
  RotateCcw,
  Tag,
  Users,
  AlertCircle,
  History,
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { StatusBadge, SlaBadge, WorkItemTypeBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { Dialog } from '../ui/Dialog';
import { evaluateTaskSla } from '../../domain/sla';
import { formatRecurrenceRule, generateNextOccurrences } from '../../domain/recurrence';
import { isTaskBlocked, getBlockingTasks, getPredecessorTasks, getSuccessorTasks } from '../../domain/dependencyGraph';
import { WORK_ITEM_TYPES, WORK_ITEM_TYPE_LIST, BUG_SEVERITIES } from '../../domain/workItems';
import { getEligibleParents, getChildWorkItems } from '../../domain/hierarchy';
import { Task, WorkItemType, Priority, BugSeverity } from '../../types';
import { TaskAttachments } from './TaskAttachments';

interface TaskDetailsContentProps {
  task: Task;
  onClose: () => void;
}

function TaskDetailsContent({ task, onClose }: TaskDetailsContentProps) {
  const {
    tasks,
    updateTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    logTimeEntry,
    addDependency,
    removeDependency,
    escalateTask,
    simulateExternalTaskEdit,
    allUsers,
    currentWorkflow,
    currentUser,
    openTaskDrawer,
    projectLabels,
    auditLog,
    showToast,
  } = useApp();

  const [snapshotVersion] = useState<number>(task.version || 1);
  const [activeTab, setActiveTab] = useState<string>(
    task.type === WORK_ITEM_TYPES.SUBTASK ? 'dependencies' : 'subtasks'
  );

  // Quick inputs
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedPredId, setSelectedPredId] = useState('');

  // Live timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Recurrence state
  const [recFrequency, setRecFrequency] = useState<string>(task.recurrenceRule?.frequency || 'none');
  const [recInterval, setRecInterval] = useState<number | string>(task.recurrenceRule?.interval || 1);
  const [recWeekdaysOnly, setRecWeekdaysOnly] = useState<boolean>(Boolean(task.recurrenceRule?.weekdaysOnly));

  // --- DRAFT STATE FOR EXPLICIT SAVE & CANCEL (Section 15) ---
  const initialDraft = useMemo(() => ({
    title: task.title || '',
    description: task.description || '',
    type: (task.type || WORK_ITEM_TYPES.TASK) as WorkItemType,
    status: task.status || 'Backlog',
    priority: (task.priority || '') as Priority | '',
    assigneeId: task.assigneeId || '',
    assigneeIds: (task.assigneeIds && task.assigneeIds.length > 0)
      ? [...task.assigneeIds]
      : (task.assigneeId ? [task.assigneeId] : []),
    labels: task.labels ? [...task.labels] : [],
    dueDate: task.dueDate || '',
    estimateHours: task.estimateHours !== null && task.estimateHours !== undefined ? task.estimateHours : '',
    parentId: task.parentId || '',
    businessGoal: task.businessGoal || '',
    successCriteria: task.successCriteria || '',
    acceptanceCriteria: task.acceptanceCriteria || '',
    severity: (task.severity || 'Medium') as BugSeverity,
    stepsToReproduce: task.stepsToReproduce || '',
    expectedBehavior: task.expectedBehavior || '',
    actualBehavior: task.actualBehavior || '',
    environment: task.environment || '',
  }), [task]);

  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);


  // Determine dirty state
  const isDirty = useMemo(() => {
    return (
      draft.title !== initialDraft.title ||
      draft.description !== initialDraft.description ||
      draft.type !== initialDraft.type ||
      draft.status !== initialDraft.status ||
      draft.priority !== initialDraft.priority ||
      draft.dueDate !== initialDraft.dueDate ||
      String(draft.estimateHours) !== String(initialDraft.estimateHours) ||
      draft.parentId !== initialDraft.parentId ||
      JSON.stringify(draft.assigneeIds) !== JSON.stringify(initialDraft.assigneeIds) ||
      JSON.stringify(draft.labels) !== JSON.stringify(initialDraft.labels) ||
      draft.businessGoal !== initialDraft.businessGoal ||
      draft.successCriteria !== initialDraft.successCriteria ||
      draft.acceptanceCriteria !== initialDraft.acceptanceCriteria ||
      draft.severity !== initialDraft.severity ||
      draft.stepsToReproduce !== initialDraft.stepsToReproduce ||
      draft.expectedBehavior !== initialDraft.expectedBehavior ||
      draft.actualBehavior !== initialDraft.actualBehavior ||
      draft.environment !== initialDraft.environment
    );
  }, [draft, initialDraft]);

  // Live timer tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const currentType = draft.type;
  const slaInfo = evaluateTaskSla(task);
  const isBlocked = isTaskBlocked(task, tasks);
  const blockingTasks = getBlockingTasks(task, tasks);
  const predecessors = getPredecessorTasks(task, tasks);
  const successors = getSuccessorTasks(task, tasks);

  // Parent work item reference
  const parentWorkItem = draft.parentId ? tasks.find((t) => t.id === draft.parentId) : null;
  const eligibleParents = getEligibleParents(currentType, task.id, tasks, task.projectId);
  const childWorkItems = getChildWorkItems(task.id, tasks);

  // Subtasks list
  const childSubtasks = tasks.filter((t) => t.parentId === task.id && t.type === WORK_ITEM_TYPES.SUBTASK);
  const subtasksList = childSubtasks.length > 0 ? childSubtasks : (task.subtasks || []);
  const completedSubtasks = subtasksList.filter((s: any) => s.status === 'Done' || s.completed).length;
  const subtaskProgress =
    subtasksList.length > 0 ? Math.round((completedSubtasks / subtasksList.length) * 100) : 0;

  // Task-Specific History (Section 16: strictly for this task)
  const taskHistory = useMemo(() => {
    return auditLog.filter(
      (entry) => entry.entityType === 'task' && entry.entityId === task.id
    );
  }, [auditLog, task.id]);

  function handleToggleAssignee(userId: string) {
    setDraft((prev) => {
      const next = prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId];
      return { ...prev, assigneeIds: next, assigneeId: next[0] || '' };
    });
  }

  function handleToggleLabel(labelName: string) {
    setDraft((prev) => ({
      ...prev,
      labels: prev.labels.includes(labelName)
        ? prev.labels.filter((l) => l !== labelName)
        : [...prev.labels, labelName],
    }));
  }

  function handleSaveChanges() {
    if (!draft.title.trim()) {
      showToast('Work item title is required', 'error');
      return;
    }

    if (draft.type === WORK_ITEM_TYPES.SUBTASK && !draft.parentId) {
      showToast('A parent work item is required for Subtasks', 'error');
      return;
    }

    if (draft.type === WORK_ITEM_TYPES.BUG) {
      if (!draft.severity) {
        showToast('Severity is required for Bugs', 'error');
        return;
      }
      if (!draft.stepsToReproduce.trim()) {
        showToast('Steps to reproduce are required for Bugs', 'error');
        return;
      }
    }

    setIsSaving(true);
    try {
      const allAssignees = draft.assigneeIds.length > 0
        ? draft.assigneeIds
        : draft.assigneeId
          ? [draft.assigneeId]
          : [];

      const updates: Partial<Task> = {
        title: draft.title.trim(),
        description: draft.description,
        type: draft.type,
        status: draft.status,
        priority: draft.priority ? (draft.priority as any) : null,
        assigneeId: allAssignees[0] || null,
        assigneeIds: allAssignees,
        labels: draft.labels,
        dueDate: draft.dueDate || null,
        estimateHours: draft.estimateHours !== '' ? Number(draft.estimateHours) : null,
        parentId: draft.parentId || null,
        businessGoal: draft.businessGoal,
        successCriteria: draft.successCriteria,
        acceptanceCriteria: draft.acceptanceCriteria,
        severity: draft.severity,
        stepsToReproduce: draft.stepsToReproduce,
        expectedBehavior: draft.expectedBehavior,
        actualBehavior: draft.actualBehavior,
        environment: draft.environment,
      };

      updateTask(task.id, updates, snapshotVersion);
      showToast('Work item changes saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save work item changes', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelChanges() {
    setDraft(initialDraft);
    showToast('Unsaved changes discarded', 'info');
  }

  function handleAttemptClose() {
    if (isDirty) {
      setConfirmCloseOpen(true);
    } else {
      onClose();
    }
  }

  function handleAddSubtaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  }

  function handleAddCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    addComment(task.id, newCommentText.trim());
    setNewCommentText('');
  }

  function handleAddDependencyLink() {
    if (!selectedPredId) return;
    addDependency(selectedPredId, task.id);
    setSelectedPredId('');
  }

  function handleStopTimer() {
    setIsTimerRunning(false);
    if (timerSeconds >= 10) {
      const minutes = Math.max(1, Math.round(timerSeconds / 60));
      logTimeEntry(task.id, minutes, 'Live working session');
    }
    setTimerSeconds(0);
  }

  function handleSaveRecurrence() {
    const rule = {
      frequency: recFrequency,
      interval: Number(recInterval) || 1,
      weekdaysOnly: recWeekdaysOnly,
      endCondition: 'never',
    };
    updateTask(task.id, { recurrenceRule: rule }, snapshotVersion);
  }

  return (
    <div className="w-full max-w-xl bg-surface border-l border-border h-full shadow-overlay flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-elevated flex-shrink-0">
        <div className="flex items-center gap-2">
          <WorkItemTypeBadge type={currentType} size="sm" />
          <span className="text-xs font-mono text-text-muted">{task.id}</span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-secondary font-medium">v{task.version || 1}</span>
          {isBlocked && (
            <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded">
              Blocked
            </span>
          )}
          <SlaBadge slaInfo={slaInfo} />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => simulateExternalTaskEdit(task.id)}
            className="p-1.5 rounded-lg text-text-muted hover:text-amber-400 hover:bg-surface-hover transition-colors"
            title="Simulate remote edit (tests conflict collision modal)"
          >
            <Zap size={15} />
          </button>

          {currentUser.role !== 'Teammate' && (
            <button
              onClick={() => deleteTask(task.id)}
              className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-surface-hover transition-colors"
              title="Delete task"
            >
              <Trash2 size={15} />
            </button>
          )}

          <button
            onClick={handleAttemptClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Unsaved Draft Banner */}
      {isDirty && (
        <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
            <span>Unsaved draft changes. Click &apos;Save Changes&apos; below to apply.</span>
          </div>
          <button
            onClick={handleCancelChanges}
            className="text-[11px] text-amber-200 underline hover:text-amber-100"
          >
            Revert
          </button>
        </div>
      )}

      {/* Blocked banner if predecessors are incomplete */}
      {isBlocked && (
        <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-xs text-rose-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
            <span>
              Task is blocked by {blockingTasks.length} incomplete predecessor(s):{' '}
              <strong>{blockingTasks.map((b) => b.title).join(', ')}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Title Input */}
        <div>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full text-base sm:text-lg font-bold text-text-primary bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-brand-primary rounded px-1 py-0.5"
            placeholder="Work item title..."
          />
        </div>

        {/* Parent Work Item Context (if Subtask or child) */}
        {parentWorkItem && (
          <div className="p-2.5 rounded-lg bg-surface-elevated/70 border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-text-muted">Parent:</span>
              <WorkItemTypeBadge type={parentWorkItem.type || 'Task'} size="sm" showLabel={false} />
              <button
                onClick={() => openTaskDrawer(parentWorkItem.id)}
                className="font-semibold text-text-primary hover:text-brand-primary truncate max-w-xs text-left flex items-center gap-1 group"
              >
                <span>{parentWorkItem.title}</span>
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
            <StatusBadge status={parentWorkItem.status} size="sm" />
          </div>
        )}

        {/* Attribute Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-surface-elevated border border-border text-xs">
          {/* Work Item Type Selector */}
          <div>
            <label className="text-[11px] text-text-muted block mb-1">Type</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value as WorkItemType }))}
              className="w-full h-7 rounded bg-surface border border-border px-1.5 text-xs text-text-primary focus:outline-none"
            >
              {WORK_ITEM_TYPE_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] text-text-muted block mb-1">Status</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full h-7 rounded bg-surface border border-border px-1.5 text-xs text-text-primary focus:outline-none"
            >
              {currentWorkflow?.statuses?.map((st) => (
                <option key={st.id} value={st.name}>
                  {st.name}
                </option>
              )) || <option value={draft.status}>{draft.status}</option>}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] text-text-muted block mb-1">Priority</label>
            <select
              value={draft.priority}
              onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as Priority | '' }))}
              className="w-full h-7 rounded bg-surface border border-border px-1.5 text-xs text-text-primary focus:outline-none"
            >
              <option value="">No priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-[11px] text-text-muted block mb-1">Due Date</label>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="w-full h-7 rounded bg-surface border border-border px-1 text-xs text-text-primary focus:outline-none"
            />
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="text-[11px] text-text-muted block mb-1">Est. Hours</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={draft.estimateHours}
              onChange={(e) => setDraft((prev) => ({ ...prev, estimateHours: e.target.value }))}
              placeholder="e.g. 4"
              className="w-full h-7 rounded bg-surface border border-border px-1 text-xs text-text-primary focus:outline-none"
            />
          </div>

          {/* Parent Item Selector (where applicable) */}
          {currentType !== WORK_ITEM_TYPES.EPIC && (
            <div>
              <label className="text-[11px] text-text-muted block mb-1">
                {currentType === WORK_ITEM_TYPES.SUBTASK ? 'Parent (Required)' : 'Parent Epic'}
              </label>
              <select
                value={draft.parentId}
                onChange={(e) => setDraft((prev) => ({ ...prev, parentId: e.target.value }))}
                className="w-full h-7 rounded bg-surface border border-border px-1 text-xs text-text-primary focus:outline-none truncate"
              >
                {currentType !== WORK_ITEM_TYPES.SUBTASK && (
                  <option value="">None (Standalone)</option>
                )}
                {eligibleParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.type || 'Task'}] {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* --- MULTIPLE ASSIGNEES SELECTOR (Section 14) --- */}
        <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-text-primary flex items-center gap-1.5">
              <Users size={14} className="text-brand-primary" />
              <span>Assignees (Multiple Supported)</span>
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleToggleAssignee(e.target.value);
              }}
              className="h-6 rounded bg-surface border border-border px-1 text-[11px] text-text-secondary focus:outline-none"
            >
              <option value="">+ Add / toggle member...</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {draft.assigneeIds.includes(u.id) ? '✓ ' : ''}{u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {draft.assigneeIds.length === 0 ? (
            <p className="text-text-muted italic text-[11px]">No assignees selected (Unassigned).</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {draft.assigneeIds.map((uid) => {
                const u = allUsers.find((user) => user.id === uid);
                return (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface border border-border text-xs text-text-primary shadow-xs"
                  >
                    {u && <Avatar user={u} size="xs" />}
                    <span>{u?.name || uid}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAssignee(uid)}
                      className="text-text-muted hover:text-rose-400 ml-0.5"
                      title="Remove assignee"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* --- LABELS SELECTOR (Section 13) --- */}
        <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-text-primary flex items-center gap-1.5">
              <Tag size={14} className="text-brand-primary" />
              <span>Labels</span>
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleToggleLabel(e.target.value);
              }}
              className="h-6 rounded bg-surface border border-border px-1 text-[11px] text-text-secondary focus:outline-none"
            >
              <option value="">+ Add label...</option>
              {projectLabels.map((l) => (
                <option
                  key={l.id}
                  value={l.name}
                  disabled={draft.labels.includes(l.name)}
                >
                  {draft.labels.includes(l.name) ? '✓ ' : ''}{l.name}
                </option>
              ))}
            </select>
          </div>

          {draft.labels.length === 0 ? (
            <p className="text-text-muted italic text-[11px]">No labels assigned to this work item.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {draft.labels.map((lbl) => {
                const labelDef = projectLabels.find((l) => l.name === lbl);
                const color = labelDef?.color || '#3B82F6';
                return (
                  <span
                    key={lbl}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${color}25`, borderColor: color, borderWidth: 1 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span style={{ color }}>{lbl}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleLabel(lbl)}
                      className="hover:opacity-75 text-text-muted ml-0.5"
                      title="Remove label"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* --- TYPE-SPECIFIC FIELDS --- */}

        {/* 1. Epic Fields */}
        {currentType === WORK_ITEM_TYPES.EPIC && (
          <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border space-y-3 text-xs">
            <h4 className="font-semibold text-text-primary uppercase tracking-wider text-[11px]">
              Epic Specifications
            </h4>
            <div>
              <label className="text-text-muted block mb-1">Business Goal</label>
              <input
                type="text"
                value={draft.businessGoal}
                onChange={(e) => setDraft((prev) => ({ ...prev, businessGoal: e.target.value }))}
                placeholder="Strategic goal or business value..."
                className="w-full rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Success Criteria</label>
              <textarea
                value={draft.successCriteria}
                onChange={(e) => setDraft((prev) => ({ ...prev, successCriteria: e.target.value }))}
                rows={2}
                placeholder="Measurable outcomes..."
                className="w-full rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            {childWorkItems.length > 0 && (
              <div className="pt-2 border-t border-border">
                <span className="text-[11px] text-text-muted block mb-1.5 font-medium">
                  Associated Work Items ({childWorkItems.length})
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {childWorkItems.map((child) => (
                    <div
                      key={child.id}
                      onClick={() => openTaskDrawer(child.id)}
                      className="flex items-center justify-between p-1.5 rounded bg-surface hover:bg-surface-hover cursor-pointer border border-border text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <WorkItemTypeBadge type={child.type} size="sm" showLabel={false} />
                        <span className="truncate">{child.title}</span>
                      </div>
                      <StatusBadge status={child.status} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Story Fields */}
        {currentType === WORK_ITEM_TYPES.STORY && (
          <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border space-y-2 text-xs">
            <h4 className="font-semibold text-text-primary uppercase tracking-wider text-[11px]">
              Acceptance Criteria
            </h4>
            <textarea
              value={draft.acceptanceCriteria}
              onChange={(e) => setDraft((prev) => ({ ...prev, acceptanceCriteria: e.target.value }))}
              rows={2}
              placeholder="Given... When... Then... criteria"
              className="w-full rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        )}

        {/* 3. Bug Fields */}
        {currentType === WORK_ITEM_TYPES.BUG && (
          <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border space-y-3 text-xs">
            <h4 className="font-semibold text-rose-400 uppercase tracking-wider text-[11px]">
              Bug Diagnosis
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted block mb-1">Severity</label>
                <select
                  value={draft.severity}
                  onChange={(e) => setDraft((prev) => ({ ...prev, severity: e.target.value as BugSeverity }))}
                  className="w-full h-8 rounded-lg bg-surface border border-border px-2 text-xs text-text-primary focus:outline-none"
                >
                  {BUG_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-text-muted block mb-1">Environment</label>
                <input
                  type="text"
                  value={draft.environment}
                  onChange={(e) => setDraft((prev) => ({ ...prev, environment: e.target.value }))}
                  placeholder="e.g. Chrome, Windows"
                  className="w-full h-8 rounded-lg bg-surface border border-border px-2 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-text-muted block mb-1">Steps to Reproduce</label>
              <textarea
                value={draft.stepsToReproduce}
                onChange={(e) => setDraft((prev) => ({ ...prev, stepsToReproduce: e.target.value }))}
                rows={2}
                placeholder="Step-by-step reproduction instructions..."
                className="w-full rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted block mb-1">Expected Behavior</label>
                <textarea
                  value={draft.expectedBehavior}
                  onChange={(e) => setDraft((prev) => ({ ...prev, expectedBehavior: e.target.value }))}
                  rows={2}
                  placeholder="What was expected..."
                  className="w-full rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-text-muted block mb-1">Actual Behavior</label>
                <textarea
                  value={draft.actualBehavior}
                  onChange={(e) => setDraft((prev) => ({ ...prev, actualBehavior: e.target.value }))}
                  rows={2}
                  placeholder="What unexpectedly happened..."
                  className="w-full rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Description
          </label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            placeholder="Add details, specifications, background..."
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        {/* Media Attachments */}
        <TaskAttachments
          attachments={task.attachments || []}
          onChange={(newAtts) => updateTask(task.id, { attachments: newAtts }, snapshotVersion)}
        />

        {/* SLA & Escalation section */}
        <div className="p-3 rounded-lg border bg-surface-elevated/40 border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Shield size={16} className={slaInfo.isBreached ? 'text-rose-400' : 'text-brand-primary'} />
            <div>
              <p className="font-semibold text-text-primary">SLA Policy Status</p>
              <p className="text-[11px] text-text-muted">
                {slaInfo.label} · Target resolution threshold: {slaInfo.thresholdHours}h
              </p>
            </div>
          </div>

          {!slaInfo.isEscalated && currentUser.role !== 'Teammate' && (
            <Button
              variant="danger"
              size="sm"
              icon={ShieldAlert}
              onClick={() => escalateTask(task.id)}
            >
              Escalate
            </Button>
          )}
        </div>

        {/* Tabbed Secondary Sections */}
        <div>
          <div className="flex items-center gap-1 border-b border-border pb-1">
            {[
              ...(currentType !== WORK_ITEM_TYPES.SUBTASK
                ? [{ id: 'subtasks', label: `Subtasks (${completedSubtasks}/${subtasksList.length})`, icon: CheckCircle2 }]
                : []),
              { id: 'dependencies', label: `Dependencies (${predecessors.length + successors.length})`, icon: Network },
              { id: 'time', label: `Time (${task.actualHours}/${task.estimateHours}h)`, icon: Clock },
              { id: 'recurrence', label: 'Recurrence', icon: Repeat },
              { id: 'comments', label: `Comments (${task.comments?.length || 0})`, icon: MessageSquare },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === t.id
                      ? 'bg-surface-active text-text-primary font-semibold'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  <Icon size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Subtasks Tab */}
          {activeTab === 'subtasks' && currentType !== WORK_ITEM_TYPES.SUBTASK && (
            <div className="pt-3 space-y-3">
              {subtasksList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                    <span>Progress</span>
                    <span className="font-medium">{subtaskProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-active rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {subtasksList.map((sub: any) => {
                  const isDone = sub.status === 'Done' || sub.completed;
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated border border-border text-xs group"
                    >
                      <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleSubtask(task.id, sub.id)}
                          className="w-3.5 h-3.5 rounded border-border text-brand-primary focus:ring-0 bg-surface"
                        />
                        <span
                          className={`truncate ${
                            isDone ? 'line-through text-text-muted' : 'text-text-primary'
                          }`}
                        >
                          {sub.title}
                        </span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openTaskDrawer(sub.id)}
                          className="text-text-muted hover:text-text-primary p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Open subtask details"
                        >
                          <ArrowUpRight size={13} />
                        </button>
                        <button
                          onClick={() => deleteSubtask(task.id, sub.id)}
                          className="text-text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddSubtaskSubmit} className="flex items-center gap-2">
                <Input
                  placeholder="Add a new subtask..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button variant="secondary" size="sm" type="submit" icon={Plus}>
                  Add
                </Button>
              </form>
            </div>
          )}

          {/* Dependencies Tab */}
          {activeTab === 'dependencies' && (
            <div className="pt-3 space-y-4 text-xs">
              <div>
                <h4 className="font-semibold text-text-secondary mb-2 uppercase text-[10px] tracking-wider">
                  Predecessors (Must finish before this work item)
                </h4>
                {predecessors.length === 0 ? (
                  <p className="text-text-muted italic">No predecessor requirements.</p>
                ) : (
                  <div className="space-y-1.5">
                    {predecessors.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated border border-border"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <WorkItemTypeBadge type={p.type} size="sm" showLabel={false} />
                          <StatusBadge status={p.status} size="sm" />
                          <span className="font-medium text-text-primary truncate">
                            {p.title}
                          </span>
                        </div>
                        <button
                          onClick={() => removeDependency(p.id, task.id)}
                          className="text-text-muted hover:text-rose-400 p-1"
                          title="Remove dependency"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-text-secondary mb-2 uppercase text-[10px] tracking-wider">
                  Successors (Blocked until this item finishes)
                </h4>
                {successors.length === 0 ? (
                  <p className="text-text-muted italic">No successor items depend on this.</p>
                ) : (
                  <div className="space-y-1.5">
                    {successors.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated border border-border"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <WorkItemTypeBadge type={s.type} size="sm" showLabel={false} />
                          <StatusBadge status={s.status} size="sm" />
                          <span className="font-medium text-text-primary truncate">
                            {s.title}
                          </span>
                        </div>
                        <button
                          onClick={() => removeDependency(task.id, s.id)}
                          className="text-text-muted hover:text-rose-400 p-1"
                          title="Remove dependency"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Predecessor selector */}
              {currentUser.role !== 'Teammate' && (
                <div className="pt-2 border-t border-border flex items-center gap-2">
                  <select
                    value={selectedPredId}
                    onChange={(e) => setSelectedPredId(e.target.value)}
                    className="flex-1 h-8 rounded-lg bg-surface border border-border px-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="">-- Add Predecessor Work Item --</option>
                    {tasks
                      .filter((t) => t.id !== task.id && !predecessors.some((p) => p.id === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          [{t.type || 'Task'}] {t.title}
                        </option>
                      ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!selectedPredId}
                    onClick={handleAddDependencyLink}
                  >
                    Link
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Time Tracking Tab */}
          {activeTab === 'time' && (
            <div className="pt-3 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border">
                <div>
                  <span className="text-text-muted text-[11px] block">Tracked vs Estimated</span>
                  <p className="text-sm font-bold text-text-primary">
                    {task.actualHours || 0}h / {task.estimateHours || 0}h
                  </p>
                </div>
                <div>
                  {isTimerRunning ? (
                    <Button variant="danger" size="sm" onClick={handleStopTimer}>
                      Stop ({Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')})
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setIsTimerRunning(true)}>
                      Start Timer
                    </Button>
                  )}
                </div>
              </div>

              {/* Logged Sessions */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-text-muted block font-medium">Logged Sessions</span>
                {(task.timeEntries || []).length === 0 ? (
                  <p className="text-text-muted italic">No time logs recorded yet.</p>
                ) : (
                  (task.timeEntries || []).map((te) => (
                    <div
                      key={te.id}
                      className="flex items-center justify-between p-2 rounded bg-surface-elevated border border-border text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-brand-primary" />
                        <span className="text-text-secondary">{te.note || 'Logged work'}</span>
                      </div>
                      <span className="font-mono text-text-primary">{te.durationMinutes}m</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Recurrence Tab */}
          {activeTab === 'recurrence' && (
            <div className="pt-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-muted block mb-1">Frequency</label>
                  <select
                    value={recFrequency}
                    onChange={(e) => setRecFrequency(e.target.value)}
                    className="w-full h-8 rounded-lg bg-surface border border-border px-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="none">One-time (Does not repeat)</option>
                    <option value="daily">Daily</option>
                    <option value="weekly_monday">Weekly on Monday</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly_first_day">Monthly on the 1st</option>
                    <option value="monthly_last_friday">Monthly on last Friday</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="text-text-muted block mb-1">Interval</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={recInterval}
                    onChange={(e) => setRecInterval(e.target.value)}
                    disabled={recFrequency === 'weekly_monday' || recFrequency === 'monthly_first_day' || recFrequency === 'monthly_last_friday'}
                    className="w-full h-8 rounded-lg bg-surface border border-border px-2 text-xs text-text-primary focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {recFrequency !== 'none' && (
                <div className="space-y-2.5">
                  {recFrequency === 'daily' && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={recWeekdaysOnly}
                        onChange={(e) => setRecWeekdaysOnly(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-border text-brand-primary"
                      />
                      <span>Weekdays only (skip Saturday & Sunday)</span>
                    </label>
                  )}

                  <div className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1">
                    <span className="text-[11px] text-text-muted block">Schedule Summary</span>
                    <p className="text-xs font-semibold text-brand-primary">
                      {formatRecurrenceRule({ frequency: recFrequency, interval: Number(recInterval), weekdaysOnly: recWeekdaysOnly })}
                    </p>
                  </div>

                  {/* Future Occurrences Preview */}
                  {task.dueDate && (
                    <div className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1.5">
                      <span className="text-[11px] text-text-muted block">Upcoming Projected Occurrences</span>
                      <div className="space-y-1">
                        {generateNextOccurrences(
                          {
                            ...task,
                            recurrenceRule: {
                              frequency: recFrequency,
                              interval: Number(recInterval),
                              weekdaysOnly: recWeekdaysOnly,
                            },
                          },
                          3
                        ).map((occ) => (
                          <div key={occ.occurrenceNumber} className="flex items-center justify-between text-[11px] text-text-secondary">
                            <span>Occurrence #{occ.occurrenceNumber}</span>
                            <span className="font-mono font-medium text-text-primary">{occ.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button variant="primary" size="sm" onClick={handleSaveRecurrence}>
                Save Recurrence
              </Button>
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="pt-3 space-y-3 text-xs">
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {(task.comments || []).length === 0 ? (
                  <p className="text-text-muted italic py-2">No comments posted yet.</p>
                ) : (
                  (task.comments || []).map((c) => {
                    const authorId = c.authorId || c.userId;
                    const author = allUsers.find((u) => u.id === authorId);
                    return (
                      <div key={c.id} className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-text-primary">{author?.name || 'User'}</span>
                          <span className="text-[10px] text-text-muted font-mono">
                            {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-text-secondary">{c.body || c.text}</p>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleAddCommentSubmit} className="space-y-2 pt-2 border-t border-border">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="w-full rounded-lg bg-surface border border-border p-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
                <div className="flex justify-end">
                  <Button variant="primary" size="sm" type="submit">
                    Post Comment
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* --- TASK-SPECIFIC HISTORY & ACTIVITY (Section 16) --- */}
        <div className="pt-5 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <History size={14} className="text-brand-primary" />
              <span>Activity & History</span>
            </h4>
            <span className="text-[10px] text-text-muted font-mono bg-surface-elevated px-2 py-0.5 rounded border border-border">
              {taskHistory.length} {taskHistory.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          <p className="text-[11px] text-text-muted">
            Chronological audit log events recorded specifically for this work item:
          </p>

          {taskHistory.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border text-center text-xs text-text-muted">
              No recorded history for this work item yet. Changes made and saved will appear here.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {taskHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-surface-elevated border border-border text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-text-muted text-[11px]">
                    <span className="font-semibold text-text-primary">
                      {item.userName || 'System'}
                    </span>
                    <span className="font-mono text-[10px]">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-text-secondary">{item.description}</p>
                  <span className="inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                    {item.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- DRAWER STICKY FOOTER: SAVE CHANGES & CANCEL (Section 15) --- */}
      <div className="px-5 py-3 border-t border-border bg-surface-elevated flex items-center justify-between gap-3 flex-shrink-0">
        <div className="text-xs">
          {isDirty ? (
            <span className="text-amber-400 font-medium flex items-center gap-1.5">
              <AlertCircle size={14} /> Unsaved modifications
            </span>
          ) : (
            <span className="text-text-muted">All changes saved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RotateCcw}
            disabled={!isDirty || isSaving}
            onClick={handleCancelChanges}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Save}
            disabled={!isDirty || isSaving}
            onClick={handleSaveChanges}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Discard Confirmation Dialog */}
      <Dialog
        isOpen={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        title="Discard unsaved changes?"
        description="You have unsaved changes to this work item. Discarding will revert all draft edits to the saved state."
        maxWidth="max-w-md"
      >
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button variant="secondary" size="sm" onClick={() => setConfirmCloseOpen(false)}>
            Keep Editing
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setConfirmCloseOpen(false);
              onClose();
            }}
          >
            Discard & Close
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function TaskDetailsDrawer() {
  const { activeDrawerTaskId, closeTaskDrawer, tasks } = useApp();

  const task = tasks.find((t) => t.id === activeDrawerTaskId);

  if (!task) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeTaskDrawer();
      }}
    >
      <TaskDetailsContent key={task.id} task={task} onClose={closeTaskDrawer} />
    </div>
  );
}
