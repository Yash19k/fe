import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableKanbanCard } from './KanbanCard';
import type { KanbanColumnDef, KanbanTask } from './KanbanBoard';

interface KanbanColumnHeaderProps {
  column: KanbanColumnDef;
  count: number;
}

export function KanbanColumnHeader({ column, count }: KanbanColumnHeaderProps) {
  return (
    <div className="kb-colhead">
      <span className="kb-dot" style={{ background: column.color }} aria-hidden="true" />
      <span>{column.name}</span>
      <span className="kb-count">{count}</span>
    </div>
  );
}

interface KanbanColumnProps {
  column: KanbanColumnDef;
  /** Unique id of this sortable list (the column id, or "lane::column" in swimlanes). */
  containerId: string;
  taskIds: string[];
  tasksById: ReadonlyMap<string, KanbanTask>;
  count: number;
  showHeader?: boolean;
  readOnly?: boolean;
  onTaskClick?: (task: KanbanTask) => void;
}

export function KanbanColumn({
  column,
  containerId,
  taskIds,
  tasksById,
  count,
  showHeader = false,
  readOnly = false,
  onTaskClick,
}: KanbanColumnProps) {
  // The zone is a droppable too, so empty columns and the space below the last card accept drops.
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div className="kb-col">
      {showHeader && <KanbanColumnHeader column={column} count={count} />}
      <div
        ref={setNodeRef}
        className="kb-zone"
        data-over={isOver ? 'true' : undefined}
        role="group"
        aria-label={`${column.name} tasks`}
      >
        <SortableContext id={containerId} items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map((id) => {
            const task = tasksById.get(id);
            return task ? (
              <SortableKanbanCard key={id} task={task} disabled={readOnly} onClick={onTaskClick} />
            ) : null;
          })}
        </SortableContext>
        {taskIds.length === 0 && <div className="kb-empty">No tasks</div>}
      </div>
    </div>
  );
}
