import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanAssignee, KanbanPriority, KanbanTask } from './KanbanBoard';

const PRIORITY: Record<KanbanPriority, { label: string; color: string }> = {
  high: { label: 'High', color: 'var(--kb-p-high)' },
  medium: { label: 'Medium', color: 'var(--kb-p-med)' },
  low: { label: 'Low', color: 'var(--kb-p-low)' },
};

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function SubtaskIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3" />
      <path d="M5.2 8.2l2 2 3.6-4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2.5" />
      <path d="M2 6.8h12M5.5 1.8v2.4M10.5 1.8v2.4" />
    </svg>
  );
}

interface KanbanAvatarProps {
  assignee: KanbanAssignee;
  size?: number;
}

export function KanbanAvatar({ assignee, size = 22 }: KanbanAvatarProps) {
  return (
    <span
      className="kb-av"
      style={{ background: assignee.color, width: size, height: size }}
      title={assignee.name}
      aria-label={assignee.name}
    >
      {assignee.initials}
    </span>
  );
}

interface KanbanCardViewProps extends HTMLAttributes<HTMLDivElement> {
  task: KanbanTask;
  /** The slot left behind in the list while the card is being dragged. */
  isPlaceholder?: boolean;
  /** The copy that follows the pointer inside DragOverlay. */
  isOverlay?: boolean;
}

/** Pure presentation. Used by the sortable card and by the drag overlay. */
export const KanbanCardView = forwardRef<HTMLDivElement, KanbanCardViewProps>(
  function KanbanCardView(
    { task, isPlaceholder = false, isOverlay = false, className, ...rest },
    ref,
  ) {
    const priority = PRIORITY[task.priority] ?? PRIORITY.low;
    const hasSubtasks = (task.subtasksTotal ?? 0) > 0;

    return (
      <article
        ref={ref}
        className={cx(
          'kb-card',
          isPlaceholder && 'kb-card--placeholder',
          isOverlay && 'kb-card--overlay',
          className,
        )}
        tabIndex={isOverlay ? -1 : 0}
        aria-label={`${task.key} ${task.title}`}
        {...rest}
      >
        <div className="kb-card-top">
          <span className="kb-key">{task.key}</span>
          <span className="kb-prio">
            <i style={{ background: priority.color }} aria-hidden="true" />
            {priority.label}
          </span>
        </div>

        <h3 className="kb-card-title">{task.title}</h3>

        {task.labels && task.labels.length > 0 && (
          <div className="kb-labels">
            {task.labels.map((label, idx) => (
              <span key={`${label.name}-${idx}`} className={`kb-label kb-label--${label.tone}`}>
                {label.name}
              </span>
            ))}
          </div>
        )}

        <div className="kb-card-foot">
          <div className="kb-meta">
            {hasSubtasks && (
              <span title="Subtasks done">
                <SubtaskIcon />
                {task.subtasksDone ?? 0}/{task.subtasksTotal}
              </span>
            )}
            {task.dueDate && (
              <span className={task.overdue ? 'kb-overdue' : undefined} title="Due date">
                <CalendarIcon />
                {task.dueDate}
              </span>
            )}
          </div>
          <div className="kb-avs">
            {task.assignees.map((a) => (
              <KanbanAvatar key={a.id} assignee={a} />
            ))}
          </div>
        </div>
      </article>
    );
  },
);

interface SortableKanbanCardProps {
  task: KanbanTask;
  disabled?: boolean;
  onClick?: (task: KanbanTask) => void;
}

export function SortableKanbanCard({ task, disabled = false, onClick }: SortableKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  });

  // `transform` and `transition` are what make neighbouring cards slide out of the way.
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <KanbanCardView
      ref={setNodeRef}
      style={style}
      task={task}
      isPlaceholder={isDragging}
      onClick={onClick ? () => onClick(task) : undefined}
      {...attributes}
      {...listeners}
    />
  );
}
