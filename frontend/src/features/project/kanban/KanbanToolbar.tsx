import { Plus } from 'lucide-react';
import type { KanbanView } from './KanbanBoard';

interface KanbanToolbarProps {
  title: string;
  projectKey?: string;
  doneCount: number;
  totalCount: number;
  view: KanbanView;
  onViewChange: (view: KanbanView) => void;
  onOpenCreateTask?: () => void;
  readOnly?: boolean;
}

const VIEWS: Array<{ id: KanbanView; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'swimlanes', label: 'Swimlanes' },
];

export function KanbanToolbar({
  title,
  projectKey,
  doneCount,
  totalCount,
  view,
  onViewChange,
  onOpenCreateTask,
  readOnly = false,
}: KanbanToolbarProps) {
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <header className="kb-bar">
      <div className="kb-title">
        <h2>{title}</h2>
        {projectKey && <span className="kb-keychip">{projectKey}</span>}
      </div>

      <div className="kb-toolbar-right">
        <div className="kb-meter" aria-live="polite">
          <span>
            {doneCount} of {totalCount} done
          </span>
          <span
            className="kb-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Completed tasks"
          >
            <span className="kb-fill" style={{ width: `${percent}%` }} />
          </span>
        </div>

        <div className="kb-toggle" role="group" aria-label="Board view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => onViewChange(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        {onOpenCreateTask && !readOnly && (
          <button
            type="button"
            onClick={onOpenCreateTask}
            className="kb-btn-new-task"
            title="Create new task"
          >
            <Plus size={14} />
            <span>New task</span>
          </button>
        )}
      </div>
    </header>
  );
}
