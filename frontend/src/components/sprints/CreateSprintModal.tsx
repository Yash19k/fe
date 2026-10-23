import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import { useApp } from '../../hooks/useApp';
import { isPersistedWorkItemId } from '../../services/api';
import { WorkItemTypeBadge, StatusBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import {
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Task } from '../../types';

export interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSprintModal({ isOpen, onClose }: CreateSprintModalProps) {
  const { currentProject, projectTasks, allUsers, createSprint } = useApp();

  // Form State
  const [sprintName, setSprintName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected existing work items
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [taskSearch, setTaskSearch] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSprintName('');
    setGoal('');
    setStartDate('');
    setEndDate('');
    setSelectedTaskIds(new Set());
    setTaskSearch('');
    setErrors({});
    setServerError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  function handleClose() {
    resetForm();
    onClose();
  }

  // Eligible Backlog Tasks for current project (not already assigned to active sprint or in backlog)
  const eligibleTasks = useMemo(() => {
    return projectTasks.filter((t: Task) => {
      return t.status === 'Backlog' && !t.sprintId && isPersistedWorkItemId(t.id);
    });
  }, [projectTasks]);

  // Filtered tasks by search term
  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return eligibleTasks;
    const q = taskSearch.toLowerCase();
    return eligibleTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.type && t.type.toLowerCase().includes(q))
    );
  }, [eligibleTasks, taskSearch]);

  function handleToggleTask(taskId: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!sprintName.trim()) {
      errs.name = 'Sprint name is required';
    } else if (sprintName.trim().length < 3) {
      errs.name = 'Sprint name must be at least 3 characters';
    }

    if (!startDate) {
      errs.startDate = 'Start date is required';
    }

    if (!endDate) {
      errs.endDate = 'End date is required';
    } else if (startDate && endDate < startDate) {
      errs.endDate = 'End date must be on or after start date';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const workItemIds = Array.from(selectedTaskIds);
      if (workItemIds.some((id) => !isPersistedWorkItemId(id))) {
        throw new Error('Only persisted database work items can be added to a sprint.');
      }

      const res = await createSprint({
        projectId: currentProject?.id,
        name: sprintName.trim(),
        goal: goal.trim() || null,
        startDate,
        endDate,
        status: 'PLANNED',
        workItemIds,
      });

      if (res.success) {
        handleClose();
      } else {
        setServerError(res.reason || 'Failed to create sprint. Please try again.');
      }
    } catch (err: any) {
      setServerError(err.message || 'An unexpected error occurred while creating sprint.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Sprint"
      description="Define the sprint and choose the work to include."
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2"
          >
            <AlertCircle size={15} className="text-rose-400 mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Sprint Name */}
        <div>
          <Input
            id="sprint-name"
            label="Sprint Name *"
            placeholder="e.g. Sprint 14 - Performance & Auth"
            value={sprintName}
            onChange={(e) => {
              setSprintName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            error={errors.name}
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        {/* Sprint Goal */}
        <div>
          <Textarea
            id="sprint-goal"
            label="Sprint Goal"
            placeholder="What is the primary objective or deliverable of this sprint?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            disabled={isSubmitting}
            helperText="Optional high-level focus to align the development team."
          />
        </div>

        {/* Start Date & End Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sprint-start" className="block text-xs font-medium text-text-secondary mb-1">
              Start Date *
            </label>
            <input
              id="sprint-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: '' }));
              }}
              disabled={isSubmitting}
              className={`w-full h-9 rounded-lg bg-surface border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary ${
                errors.startDate ? 'border-rose-500' : 'border-border'
              }`}
            />
            {errors.startDate && <p className="text-[11px] text-rose-400 mt-1">{errors.startDate}</p>}
          </div>

          <div>
            <label htmlFor="sprint-end" className="block text-xs font-medium text-text-secondary mb-1">
              End Date *
            </label>
            <input
              id="sprint-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: '' }));
              }}
              disabled={isSubmitting}
              className={`w-full h-9 rounded-lg bg-surface border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary ${
                errors.endDate ? 'border-rose-500' : 'border-border'
              }`}
            />
            {errors.endDate && <p className="text-[11px] text-rose-400 mt-1">{errors.endDate}</p>}
          </div>
        </div>

        {/* SECTION 1: Select Existing Work Items */}
        <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
            <div>
              <h3 className="text-xs font-semibold text-text-primary">
                Select existing work items
              </h3>
              <p className="text-[11px] text-text-muted">
                Choose tasks already in the project backlog.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                {selectedTaskIds.size} selected
              </span>
              {filteredTasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] text-text-muted hover:text-text-primary underline cursor-pointer"
                >
                  {selectedTaskIds.size === filteredTasks.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
          </div>

          {/* Search box for backlog tasks */}
          <div className="relative">
            <input
              type="search"
              placeholder="Filter backlog work items..."
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>

          {/* Tasks list */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-border/40">
            {filteredTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-muted italic">
                {eligibleTasks.length === 0
                  ? 'No unassigned backlog items found in this project.'
                  : 'No work items match your filter.'}
              </div>
            ) : (
              filteredTasks.map((t) => {
                const isSelected = selectedTaskIds.has(t.id);
                const assignee = allUsers.find((u) => u.id === t.assigneeId);

                return (
                  <label
                    key={t.id}
                    className={`flex items-center justify-between gap-3 p-2 rounded-lg transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-brand-primary/10 border border-brand-primary/30'
                        : 'hover:bg-surface border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleTask(t.id)}
                        className="rounded border-border text-brand-primary cursor-pointer shrink-0"
                      />
                      <WorkItemTypeBadge type={t.type} size="sm" showLabel={false} />
                      <div className="min-w-0">
                        <span className="font-medium text-text-primary truncate block">
                          {t.title}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted">
                          <span className="font-mono text-text-secondary">{t.id}</span>
                          <span>&bull;</span>
                          <span>{t.priority || 'No Priority'}</span>
                          {t.dueDate && (
                            <>
                              <span>&bull;</span>
                              <span>Due {t.dueDate}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {assignee ? (
                        <Avatar user={assignee} size="xs" />
                      ) : (
                        <span className="text-[10px] text-text-muted">Unassigned</span>
                      )}
                      <StatusBadge status={t.status} size="sm" />
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={isSubmitting || !sprintName.trim()}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                Creating Sprint...
              </span>
            ) : (
              'Create Sprint'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
