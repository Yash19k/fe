import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { TaskCard } from '../../components/tasks/TaskCard';
import { Plus } from 'lucide-react';
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

          return (
            <div
              key={status.id || status.name}
              onDragOver={(e) => handleDragOver(e, status.name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status.name)}
              className={`w-72 sm:w-80 flex flex-col rounded-xl bg-surface/70 border transition-colors max-h-[calc(100vh-185px)] ${
                isOver
                  ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/40'
                  : 'border-border'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/80 bg-surface-elevated/70 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    {status.name}
                  </h3>
                  <span className="text-[11px] font-mono text-text-muted bg-surface px-1.5 py-0.2 rounded">
                    {colTasks.length}
                  </span>
                </div>

                <button
                  onClick={onOpenCreateTask}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                  title={`Add task to ${status.name}`}
                >
                  <Plus size={14} />
                </button>
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
          );
        })}
      </div>
    </div>
  );
}
