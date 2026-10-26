import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { TaskCard } from '../../components/tasks/TaskCard';
import { Plus, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Task, WorkflowStatus, TaskStatus } from '../../types';

interface ProjectBoardViewProps {
  onOpenCreateTask: () => void;
}

const STANDARD_STATUS_ORDER: TaskStatus[] = [
  'Backlog',
  'In Progress',
  'In Review',
  'Testing / QA',
  'Done',
  'Blocked',
  'On Hold',
];

const DEFAULT_STANDARD_STATUSES: WorkflowStatus[] = [
  { id: 'st-backlog', name: 'Backlog', color: '#6B7280' },
  { id: 'st-inprogress', name: 'In Progress', color: '#3B82F6' },
  { id: 'st-inreview', name: 'In Review', color: '#A855F7' },
  { id: 'st-testingqa', name: 'Testing / QA', color: '#06B6D4' },
  { id: 'st-done', name: 'Done', color: '#22C55E' },
  { id: 'st-blocked', name: 'Blocked', color: '#EF4444' },
  { id: 'st-onhold', name: 'On Hold', color: '#F97316' },
];

export function ProjectBoardView({ onOpenCreateTask }: ProjectBoardViewProps) {
  const { currentWorkflow, projectTasks, changeTaskStatus } = useApp();

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});

  function toggleColumnCollapse(statusKey: string) {
    setCollapsedColumns((prev) => ({
      ...prev,
      [statusKey]: !prev[statusKey],
    }));
  }

  const statuses: WorkflowStatus[] = useMemo(() => {
    const isStandardWorkflow =
      !currentWorkflow || currentWorkflow.isDefault || currentWorkflow.id === 'wf-1';

    if (isStandardWorkflow) {
      const existingStatuses = currentWorkflow?.statuses || [];
      const statusMap = new Map<string, WorkflowStatus>();
      DEFAULT_STANDARD_STATUSES.forEach((s) => statusMap.set(s.name, s));
      existingStatuses.forEach((s) => {
        if (s && s.name) statusMap.set(s.name, s);
      });

      return STANDARD_STATUS_ORDER.map((name) => statusMap.get(name)).filter((s): s is WorkflowStatus => Boolean(s));
    }

    // Preserve custom workflows
    return currentWorkflow?.statuses && currentWorkflow.statuses.length > 0
      ? currentWorkflow.statuses
      : DEFAULT_STANDARD_STATUSES;
  }, [currentWorkflow]);

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  }

  function handleDragOver(e: React.DragEvent, statusName: string) {
    e.preventDefault();
    if (dragOverColumn !== statusName) {
      setDragOverColumn(statusName);
    }
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(e: React.DragEvent, targetStatusName: string) {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      changeTaskStatus(taskId, targetStatusName);
    }
    setDraggedTaskId(null);
  }

  return (
    <div className="h-full overflow-x-auto p-4 sm:p-6 select-none">
      <div className="flex items-start gap-4 min-w-max pb-6">
        {statuses.map((status) => {
          const colTasks = projectTasks.filter((t: Task) => t.status === status.name);
          const isOver = dragOverColumn === status.name;
          const statusKey = status.id || status.name;
          const isCollapsed = Boolean(collapsedColumns[statusKey]);

          return (
            <div
              key={statusKey}
              onDragOver={(e) => handleDragOver(e, status.name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status.name)}
              onClick={isCollapsed ? () => toggleColumnCollapse(statusKey) : undefined}
              className={`flex flex-col rounded-xl border select-none transition-[width,min-width,max-width] duration-250 ease-in-out motion-reduce:transition-none max-h-[calc(100vh-185px)] overflow-hidden shrink-0 ${
                isCollapsed
                  ? 'w-12 min-w-[48px] max-w-[48px] bg-surface/70 cursor-pointer group hover:bg-surface-elevated/80'
                  : 'w-72 sm:w-80 min-w-[288px] sm:min-w-[320px] max-w-[288px] sm:max-w-[320px] bg-surface/70'
              } ${
                isOver
                  ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/40'
                  : 'border-border hover:border-border-strong'
              }`}
              title={isCollapsed ? `Click to expand ${status.name}` : undefined}
              aria-label={
                isCollapsed
                  ? `${status.name} column, ${colTasks.length} tasks, collapsed`
                  : undefined
              }
            >
              {isCollapsed ? (
                <div className="w-12 min-w-[48px] h-full flex flex-col items-center py-3 select-none">
                  {/* 1. Existing expand control */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleColumnCollapse(statusKey);
                    }}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors mb-2 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    title={`Expand ${status.name}`}
                    aria-label={`Expand ${status.name} column`}
                  >
                    <ChevronsRight size={15} />
                  </button>

                  {/* 2. Existing status indicator */}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mb-3 shadow-xs"
                    style={{ backgroundColor: status.color }}
                  />

                  {/* 3. Vertically oriented status name */}
                  <div className="flex-1 flex items-center justify-center overflow-hidden py-2">
                    <span
                      style={{ writingMode: 'vertical-rl' }}
                      className="text-xs font-bold text-text-secondary group-hover:text-text-primary uppercase tracking-wider whitespace-nowrap transition-colors"
                    >
                      {status.name}
                    </span>
                  </div>

                  {/* 4. Work-item count positioned below the status name inside a subtle badge */}
                  <div className="mt-2 shrink-0">
                    <span className="text-[11px] font-mono font-medium text-text-secondary bg-surface-elevated/80 px-2 py-0.5 rounded border border-border text-center shadow-xs">
                      {colTasks.length}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-72 sm:w-80 min-w-[288px] sm:min-w-[320px] flex flex-col h-full overflow-hidden">
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/80 bg-surface-elevated/70 rounded-t-xl shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider truncate">
                        {status.name}
                      </h3>
                      <span className="text-[11px] font-mono text-text-muted bg-surface px-1.5 py-0.2 rounded border border-border/40">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={onOpenCreateTask}
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                        title={`Add task to ${status.name}`}
                        aria-label={`Add task to ${status.name}`}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleColumnCollapse(statusKey)}
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                        title={`Collapse ${status.name} column`}
                        aria-label={`Collapse ${status.name} column`}
                      >
                        <ChevronsLeft size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Column Cards Dropzone */}
                  <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 min-h-[140px]">
                    {colTasks.length === 0 ? (
                      <div className="h-28 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-xs text-text-muted italic">
                        Drop tasks here
                      </div>
                    ) : (
                      colTasks.map((task: Task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onDragStart={handleDragStart}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
