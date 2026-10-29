import React, { useState, useMemo, useRef } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input, Textarea, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { useApp } from '../../hooks/useApp';
import {
  WORK_ITEM_TYPES,
  WORK_ITEM_TYPE_LIST,
  BUG_SEVERITIES,
} from '../../domain/workItems';
import { getEligibleParents } from '../../domain/hierarchy';
import { formatRecurrenceRule } from '../../domain/recurrence';
import { WorkItemType, Priority, BugSeverity, TaskAttachment } from '../../types';
import { TaskAttachments } from './TaskAttachments';
import { LabelPicker } from '../ui/LabelPicker';
import { toDateInputValue } from '../../utils/dateUtils';
import { Repeat } from 'lucide-react';

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDueDate?: string;
  initialStartDate?: string;
  initialSprintId?: string;
}

function formatDateInputValue(value?: string): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
}

export function CreateTaskModal({
  isOpen,
  onClose,
  initialDueDate,
  initialStartDate,
  initialSprintId,
}: CreateTaskModalProps) {
  const {
    createTask,
    uploadTaskAttachments,
    currentProject,
    allUsers,
    currentWorkflow,
    tasks,
    projectLabels,
  } = useApp();

  // Core Common Fields - default to unassigned, no priority, empty dates and hours
  const [type, setType] = useState<WorkItemType>(WORK_ITEM_TYPES.TASK);
  const [parentId, setParentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sectionId, setSectionId] = useState(currentProject?.sections?.[0]?.id || 'sec-1');
  const [status, setStatus] = useState('Backlog');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [assigneeId, setAssigneeId] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(formatDateInputValue(initialStartDate));
  const [dueDate, setDueDate] = useState(formatDateInputValue(initialDueDate));
  const [estimateHours, setEstimateHours] = useState<number | string>('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentPickerKey, setAttachmentPickerKey] = useState(0);
  const [createdWorkItemId, setCreatedWorkItemId] = useState<string | null>(null);

  // Recurrence configuration
  const [recFrequency, setRecFrequency] = useState('none');
  const [recInterval, setRecInterval] = useState<number | string>(1);
  const [recWeekdaysOnly, setRecWeekdaysOnly] = useState(false);

  // Form submission & loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      if (initialDueDate !== undefined) setDueDate(formatDateInputValue(initialDueDate));
      if (initialStartDate !== undefined) setStartDate(formatDateInputValue(initialStartDate));
    }
  }

  // Epic-specific fields
  const [businessGoal, setBusinessGoal] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');

  // Story-specific fields
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');

  // Bug-specific fields
  const [severity, setSeverity] = useState<BugSeverity>('Medium');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [environment, setEnvironment] = useState('');

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // Compute eligible parent items for the selected type
  const eligibleParents = useMemo(() => {
    return getEligibleParents(type, null, tasks, currentProject?.id);
  }, [type, tasks, currentProject?.id]);

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newType = e.target.value as WorkItemType;
    setType(newType);
    setParentId(''); // reset parent when type changes to prevent stale mismatch
    setErrors({});
  }

  function handleToggleAssignee(userId: string) {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function handleToggleLabel(labelName: string) {
    setSelectedLabels((prev) =>
      prev.includes(labelName) ? prev.filter((l) => l !== labelName) : [...prev, labelName]
    );
  }

  function validateForm() {
    const errs: Record<string, string> = {};
    if (!title.trim()) {
      errs.title = 'Title is required';
    }

    if (type === WORK_ITEM_TYPES.SUBTASK) {
      if (!parentId) {
        errs.parentId = 'A parent work item (Story, Task, or Bug) is required for Subtasks.';
      }
    }

    if (type === WORK_ITEM_BUG_CHECK(type)) {
      if (!severity) {
        errs.severity = 'Severity is required for Bugs.';
      }
      if (!stepsToReproduce.trim()) {
        errs.stepsToReproduce = 'Steps to reproduce are required for Bugs.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function WORK_ITEM_BUG_CHECK(itemType: WorkItemType) {
    return itemType === WORK_ITEM_TYPES.BUG ? WORK_ITEM_TYPES.BUG : '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current) return;
    if (!validateForm()) return;

    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    let workItemCreated = Boolean(createdWorkItemId);
    try {
      if (
        attachments.length !== attachmentFiles.length ||
        attachmentFiles.some((file) => !(file instanceof File))
      ) {
        throw new Error('One or more selected files are no longer available. Remove and reselect them.');
      }

      const allAssignees = selectedAssigneeIds.length > 0
        ? selectedAssigneeIds
        : assigneeId
          ? [assigneeId]
          : [];

      const payload: Record<string, any> = {
        type,
        parentId: parentId || null,
        title: title.trim(),
        description,
        projectId: currentProject?.id,
        sectionId,
        status,
        priority: priority || null,
        assigneeId: allAssignees[0] || null,
        assigneeIds: allAssignees,
        labels: selectedLabels,
        startDate: startDate || null,
        dueDate: dueDate || null,
        sprintId: initialSprintId || null,
        estimateHours: estimateHours !== '' ? Number(estimateHours) : null,
        // Metadata only: never send temporary blob: preview URLs as persisted attachment URLs.
        attachments: attachments.map(({ id, name, size, type, uploadedAt }) => ({
          id, name, size, type, uploadedAt,
        })),
        recurrenceRule:
          recFrequency !== 'none'
            ? {
                frequency: recFrequency,
                interval: Number(recInterval) || 1,
                weekdaysOnly: recWeekdaysOnly,
                endCondition: 'never',
              }
            : { frequency: 'none' },
      };

      if (type === WORK_ITEM_TYPES.EPIC) {
        payload.businessGoal = businessGoal;
        payload.successCriteria = successCriteria;
      } else if (type === WORK_ITEM_TYPES.STORY) {
        payload.acceptanceCriteria = acceptanceCriteria;
      } else if (type === WORK_ITEM_TYPES.BUG) {
        payload.severity = severity;
        payload.stepsToReproduce = stepsToReproduce;
        payload.expectedBehavior = expectedBehavior;
        payload.actualBehavior = actualBehavior;
        payload.environment = environment;
      }

      let workItemId = createdWorkItemId;
      if (!workItemId) {
        const res = await createTask(payload);
        if (!res?.success) {
          setErrors((prev) => ({
            ...prev,
            general: res?.reason || 'The work item could not be created.',
          }));
          return;
        }

        if (attachmentFiles.length === 0) {
          resetForm();
          onClose();
          return;
        }

        workItemId = res.task?.id || null;
        if (!workItemId) {
          throw new Error('The work item was created but its ID was not returned.');
        }
        workItemCreated = true;
        setCreatedWorkItemId(workItemId);
      }

      if (attachmentFiles.length === 0) {
        resetForm();
        onClose();
        return;
      }

      await uploadTaskAttachments(workItemId, attachmentFiles);
      resetForm();
      onClose();
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        general: workItemCreated
          ? `The work item has already been created. Retry to upload its attachments. ${err?.message || ''}`.trim()
          : err?.message || 'An unexpected error occurred while creating the work item.',
      }));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setType(WORK_ITEM_TYPES.TASK);
    setParentId('');
    setTitle('');
    setDescription('');
    setStatus('Backlog');
    setPriority('');
    setAssigneeId('');
    setSelectedAssigneeIds([]);
    setSelectedLabels([]);
    setStartDate(formatDateInputValue(initialStartDate));
    setDueDate(formatDateInputValue(initialDueDate));
    setRecFrequency('none');
    setRecInterval(1);
    setRecWeekdaysOnly(false);
    setEstimateHours('');
    setAttachments([]);
    setAttachmentFiles([]);
    setAttachmentPickerKey((key) => key + 1);
    setCreatedWorkItemId(null);
    setBusinessGoal('');
    setSuccessCriteria('');
    setAcceptanceCriteria('');
    setSeverity('Medium');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setActualBehavior('');
    setEnvironment('');
    setErrors({});
    setIsSubmitting(false);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) {
          resetForm();
          onClose();
        }
      }}
      title="Create New Work Item"
      description={`Creating item in ${currentProject?.name || 'Project'}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {errors.general}
          </div>
        )}
        {createdWorkItemId && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            This work item already exists. Retrying will upload attachments only.
          </div>
        )}

        {/* Work Item Type Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Work Item Type *"
            value={type}
            onChange={handleTypeChange}
            disabled={isSubmitting}
          >
            {WORK_ITEM_TYPE_LIST.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          {/* Type-Aware Parent Selector */}
          {type !== WORK_ITEM_TYPES.EPIC && (
            <Select
              label={
                type === WORK_ITEM_TYPES.SUBTASK
                  ? 'Parent Work Item *'
                  : 'Parent Epic (Optional)'
              }
              value={parentId}
              onChange={(e) => {
                setParentId(e.target.value);
                if (errors.parentId) setErrors((prev) => ({ ...prev, parentId: '' }));
              }}
              error={errors.parentId}
              disabled={isSubmitting}
            >
              <option value="">
                {type === WORK_ITEM_TYPES.SUBTASK
                  ? '-- Select Parent (Story, Task, or Bug) --'
                  : '-- None (Standalone) --'}
              </option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.type || 'Task'}] {p.title}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Title */}
        <Input
          label="Title *"
          placeholder="What needs to be accomplished?"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
          }}
          error={errors.title}
          disabled={isSubmitting}
          autoFocus
        />

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="Add context, specifications, background..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
          rows={2}
        />

        {/* --- TYPE-SPECIFIC DYNAMIC FIELDS --- */}

        {/* 1. Epic Fields */}
        {type === WORK_ITEM_TYPES.EPIC && (
          <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border space-y-3">
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Epic Specifications
            </h4>
            <Input
              label="Business Goal"
              placeholder="Strategic outcome or business value..."
              value={businessGoal}
              onChange={(e) => setBusinessGoal(e.target.value)}
              disabled={isSubmitting}
            />
            <Textarea
              label="Success Criteria"
              placeholder="Measurable KPIs or acceptance definition..."
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              disabled={isSubmitting}
              rows={2}
            />
          </div>
        )}

        {/* 2. Story Fields */}
        {type === WORK_ITEM_TYPES.STORY && (
          <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border space-y-3">
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Story Acceptance
            </h4>
            <Textarea
              label="Acceptance Criteria"
              placeholder="Given... When... Then... criteria"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              disabled={isSubmitting}
              rows={2}
            />
          </div>
        )}

        {/* 3. Bug Fields */}
        {type === WORK_ITEM_TYPES.BUG && (
          <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border space-y-3">
            <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              Bug Report Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Severity *"
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value as BugSeverity);
                  if (errors.severity) setErrors((prev) => ({ ...prev, severity: '' }));
                }}
                error={errors.severity}
                disabled={isSubmitting}
              >
                {BUG_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input
                label="Environment"
                placeholder="e.g. Chrome 129, macOS 15, Staging"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <Textarea
              label="Steps to Reproduce *"
              placeholder="1. Go to...\n2. Click on...\n3. Observe error..."
              value={stepsToReproduce}
              onChange={(e) => {
                setStepsToReproduce(e.target.value);
                if (errors.stepsToReproduce) setErrors((prev) => ({ ...prev, stepsToReproduce: '' }));
              }}
              rows={3}
              error={errors.stepsToReproduce}
              disabled={isSubmitting}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Textarea
                label="Expected Behavior"
                placeholder="What should have occurred..."
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                disabled={isSubmitting}
                rows={2}
              />
              <Textarea
                label="Actual Behavior"
                placeholder="What unexpectedly happened..."
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                disabled={isSubmitting}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Primary / Additional Assignee Picker */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Assignees (Multiple Supported)
          </label>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleToggleAssignee(e.target.value);
            }}
            disabled={isSubmitting}
            className="w-full h-9 rounded-lg bg-surface border border-border px-2 text-xs text-text-primary focus:outline-none disabled:opacity-50"
          >
            <option value="">+ Add or remove assignee...</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {selectedAssigneeIds.includes(u.id) ? '✓ ' : ''}
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* Selected Assignees Chips */}
        {selectedAssigneeIds.length > 0 && (
          <div className="p-2.5 rounded-lg bg-surface-elevated border border-border flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-text-muted mr-1 font-medium">Assigned:</span>
            {selectedAssigneeIds.map((uid) => {
              const userObj = allUsers.find((u) => u.id === uid);
              return (
                <span
                  key={uid}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-xs font-medium"
                >
                  <span>{userObj?.name || uid}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAssignee(uid)}
                    disabled={isSubmitting}
                    className="hover:text-rose-400 ml-0.5 disabled:opacity-50"
                    title="Remove assignee"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Labels Selector */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Labels
          </label>
          <LabelPicker
            availableLabels={projectLabels}
            selectedLabels={selectedLabels}
            onToggleLabel={handleToggleLabel}
            placeholder="+ Browse and select labels..."
          />
        </div>

        {/* Status, Priority, Start Date, Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Select
            label="Initial Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={isSubmitting}
          >
            {currentWorkflow?.statuses?.map((st) => (
              <option key={st.id} value={st.name}>
                {st.name}
              </option>
            )) || <option value="Backlog">Backlog</option>}
          </Select>

          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority | '')}
            disabled={isSubmitting}
          >
            <option value="">No priority</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </Select>

          <Input
            label="Start Date"
            type="date"
            value={toDateInputValue(startDate)}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isSubmitting}
          />

          <Input
            label="Due Date"
            type="date"
            value={toDateInputValue(dueDate)}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Recurrence Configuration */}
        <div className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border space-y-3">
          <div className="flex items-center gap-2">
            <Repeat size={14} className="text-brand-primary" />
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Recurrence Schedule
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Frequency"
              value={recFrequency}
              onChange={(e) => setRecFrequency(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="none">Does not repeat (One-time)</option>
              <option value="daily">Daily</option>
              <option value="weekly_monday">Weekly on Monday</option>
              <option value="weekly">Weekly</option>
              <option value="monthly_first_day">Monthly on the 1st day</option>
              <option value="monthly_last_friday">Monthly on the last Friday</option>
              <option value="monthly">Monthly (same day of month)</option>
            </Select>

            {(recFrequency === 'daily' || recFrequency === 'weekly' || recFrequency === 'monthly') && !recWeekdaysOnly && (
              <Input
                label={`Repeat Interval (${recFrequency === 'daily' ? 'days' : recFrequency === 'weekly' ? 'weeks' : 'months'})`}
                type="number"
                min="1"
                max="30"
                value={recInterval}
                onChange={(e) => setRecInterval(e.target.value)}
                disabled={isSubmitting}
              />
            )}
          </div>

          {recFrequency === 'daily' && (
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={recWeekdaysOnly}
                onChange={(e) => setRecWeekdaysOnly(e.target.checked)}
                disabled={isSubmitting}
                className="w-3.5 h-3.5 rounded border-border text-brand-primary"
              />
              <span>Weekdays only (skip Saturday & Sunday)</span>
            </label>
          )}

          {recFrequency !== 'none' && (
            <div className="p-2.5 rounded-lg bg-surface border border-border/80 flex items-center justify-between text-xs">
              <span className="text-text-muted">Rule:</span>
              <span className="font-semibold text-brand-primary">
                {formatRecurrenceRule({
                  frequency: recFrequency,
                  interval: Number(recInterval) || 1,
                  weekdaysOnly: recWeekdaysOnly,
                })}
              </span>
            </div>
          )}
        </div>

        <div>
          <Input
            label="Estimated Working Hours"
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g. 4 (optional)"
            value={estimateHours}
            onChange={(e) => setEstimateHours(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Image and Video Attachments */}
        <TaskAttachments
          key={attachmentPickerKey}
          attachments={attachments}
          onChange={setAttachments}
          onFilesChange={setAttachmentFiles}
          disabled={isSubmitting}
        />

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? createdWorkItemId ? 'Uploading...' : 'Creating...'
              : createdWorkItemId ? 'Retry Attachment Upload' : `Create ${type}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}