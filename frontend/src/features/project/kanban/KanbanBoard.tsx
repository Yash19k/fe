import { useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanToolbar } from './KanbanToolbar';
import { KanbanColumn, KanbanColumnHeader } from './KanbanColumn';
import { KanbanAvatar, KanbanCardView } from './KanbanCard';
import './kanban.css';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type KanbanPriority = 'high' | 'medium' | 'low';
export type KanbanLabelTone = 'blue' | 'green' | 'amber' | 'rose' | 'violet';
export type KanbanView = 'status' | 'swimlanes';

export interface KanbanLabel {
  name: string;
  tone: KanbanLabelTone;
}

export interface KanbanAssignee {
  id: string;
  name: string;
  initials: string;
  /** Any CSS color, used as the avatar background. */
  color: string;
}

export interface KanbanTask {
  id: string;
  /** Short identifier shown on the card, e.g. "BIL-104". */
  key: string;
  title: string;
  /** Must match a `KanbanColumnDef.id`. */
  columnId: string;
  priority: KanbanPriority;
  labels: KanbanLabel[];
  /** The first assignee is the owner used for swimlanes. */
  assignees: KanbanAssignee[];
  /** Already formatted for display, e.g. "Nov 3". */
  dueDate?: string;
  overdue?: boolean;
  subtasksDone?: number;
  subtasksTotal?: number;
}

export interface KanbanColumnDef {
  id: string;
  name: string;
  /** Any CSS color for the status dot. */
  color: string;
}

export interface TaskMoveEvent {
  taskId: string;
  fromColumnId: string;
  toColumnId: string;
  /** Index of the task inside the destination list after the drop. */
  toIndex: number;
  /**
   * Task ids of the destination list in their new order. In the swimlane view
   * the list is scoped to one owner's lane.
   */
  orderedIds: string[];
}

export interface TaskReorderEvent {
  taskId: string;
  columnId: string;
  fromIndex: number;
  toIndex: number;
  orderedIds: string[];
}

export interface KanbanBoardProps {
  tasks: KanbanTask[];
  columns: KanbanColumnDef[];
  /**
   * Called once per drop that changes a task's column. Update your state
   * synchronously here (optimistic update), then persist, and roll back if the
   * request fails. The board renders whatever `tasks` you pass in.
   */
  onTaskMove: (event: TaskMoveEvent) => void | Promise<void>;
  /** Called when a task is reordered inside its own column. Falls back to `onTaskMove` when omitted. */
  onTaskReorder?: (event: TaskReorderEvent) => void | Promise<void>;
  onTaskClick?: (task: KanbanTask) => void;
  onOpenCreateTask?: () => void;
  title?: string;
  projectKey?: string;
  /** Configured workflow column whose tasks count as complete in the progress meter. */
  doneColumnId?: string;
  defaultView?: KanbanView;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Disables dragging, for users without permission to edit tasks. */
  readOnly?: boolean;
}

/* ------------------------------------------------------------------ */
/* Container model                                                     */
/* ------------------------------------------------------------------ */

interface Container {
  id: string;
  columnId: string;
  laneId: string | null;
}

interface Lane {
  id: string;
  name: string;
  assignee?: KanbanAssignee;
}

type Items = Record<string, string[]>;

const SEP = '::';
const UNASSIGNED = '__unassigned__';

function laneIdOf(task: KanbanTask): string {
  return task.assignees[0]?.id ?? UNASSIGNED;
}

function buildModel(tasks: KanbanTask[], columns: KanbanColumnDef[], view: KanbanView) {
  const lanes: Lane[] = [];
  if (view === 'swimlanes') {
    const seen = new Set<string>();
    for (const task of tasks) {
      const id = laneIdOf(task);
      if (id === UNASSIGNED || seen.has(id)) continue;
      seen.add(id);
      const assignee = task.assignees[0];
      lanes.push({ id, name: assignee?.name ?? 'Assigned', assignee });
    }
    if (tasks.some((t) => laneIdOf(t) === UNASSIGNED)) {
      lanes.push({ id: UNASSIGNED, name: 'Unassigned', assignee: undefined });
    }
  }

  const containers: Container[] =
    view === 'status'
      ? columns.map((c) => ({ id: c.id, columnId: c.id, laneId: null }))
      : lanes.flatMap((l) =>
          columns.map((c) => ({ id: `${l.id}${SEP}${c.id}`, columnId: c.id, laneId: l.id })),
        );

  const items: Items = {};
  for (const c of containers) items[c.id] = [];
  for (const task of tasks) {
    const id = view === 'status' ? task.columnId : `${laneIdOf(task)}${SEP}${task.columnId}`;
    if (items[id]) {
      items[id].push(task.id);
    } else {
      // Fallback if task carries unknown column/lane
      items[id] = [task.id];
    }
  }
  return { lanes, containers, items };
}

function findContainer(items: Items, id: string): string | undefined {
  if (id in items) return id;
  return Object.keys(items).find((key) => items[key]?.includes(id));
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function KanbanBoard({
  tasks,
  columns,
  onTaskMove,
  onTaskReorder,
  onTaskClick,
  onOpenCreateTask,
  title = 'Board',
  projectKey,
  doneColumnId,
  defaultView = 'status',
  isLoading = false,
  error = null,
  onRetry,
  readOnly = false,
}: KanbanBoardProps) {
  const [view, setView] = useState<KanbanView>(defaultView);
  // While a drag is in progress the live order lives here; otherwise derived from model.
  const [dragItems, setDragItems] = useState<Items | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragStart = useRef<{ containerId: string; index: number } | null>(null);

  const model = useMemo(() => buildModel(tasks, columns, view), [tasks, columns, view]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const containerById = useMemo(
    () => new Map(model.containers.map((c) => [c.id, c])),
    [model.containers],
  );
  const items = dragItems ?? model.items;

  const countByColumn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of model.containers) {
      counts.set(c.columnId, (counts.get(c.columnId) ?? 0) + (items[c.id]?.length ?? 0));
    }
    return counts;
  }, [model.containers, items]);

  const doneCount = doneColumnId
    ? tasks.filter((t) => t.columnId === doneColumnId).length
    : 0;
  const activeTask = activeId ? tasksById.get(activeId) : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const gridStyle = { '--kb-cols': columns.length } as CSSProperties;

  function handleDragStart(event: DragStartEvent) {
    if (readOnly) return;
    const id = String(event.active.id);
    const containerId = findContainer(model.items, id);
    if (!containerId) return;
    dragStart.current = { containerId, index: model.items[containerId].indexOf(id) };
    setActiveId(id);
    setDragItems(model.items);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (readOnly || !over) return;
    const id = String(active.id);
    const overId = String(over.id);

    setDragItems((prev) => {
      const working = prev ?? model.items;
      const from = findContainer(working, id);
      const to = findContainer(working, overId);
      if (!from || !to || from === to) return prev;

      // In swimlanes a task keeps its owner, so it can only change column inside its own lane.
      const fromContainer = containerById.get(from);
      const toContainer = containerById.get(to);
      if (fromContainer?.laneId !== toContainer?.laneId) return prev;

      const target = working[to] ?? [];
      let index: number;
      if (overId in working) {
        index = target.length;
      } else {
        const translated = active.rect.current.translated;
        const below = !!translated && translated.top > over.rect.top + over.rect.height / 2;
        const overIndex = target.indexOf(overId);
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
      }

      return {
        ...working,
        [from]: working[from].filter((taskId) => taskId !== id),
        [to]: [...target.slice(0, index), id, ...target.slice(index)],
      };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (readOnly) return;
    const id = String(active.id);
    const start = dragStart.current;
    const working = dragItems ?? model.items;
    dragStart.current = null;
    setActiveId(null);
    setDragItems(null);
    if (!start) return;

    let finalItems = working;
    const container = findContainer(working, id);
    if (over && container) {
      const overId = String(over.id);
      if (findContainer(working, overId) === container) {
        const list = working[container];
        const from = list.indexOf(id);
        const to = overId in working ? list.length - 1 : list.indexOf(overId);
        if (to >= 0 && from >= 0 && from !== to) {
          finalItems = { ...working, [container]: arrayMove(list, from, to) };
        }
      }
    }

    const endContainer = findContainer(finalItems, id);
    if (!endContainer) return;
    const endIndex = finalItems[endContainer].indexOf(id);
    if (endContainer === start.containerId && endIndex === start.index) return;

    const fromColumnId = containerById.get(start.containerId)?.columnId;
    const toColumnId = containerById.get(endContainer)?.columnId;
    if (!fromColumnId || !toColumnId) return;
    const orderedIds = finalItems[endContainer];

    if (fromColumnId === toColumnId && onTaskReorder) {
      void onTaskReorder({
        taskId: id,
        columnId: toColumnId,
        fromIndex: start.index,
        toIndex: endIndex,
        orderedIds,
      });
    } else {
      void onTaskMove({ taskId: id, fromColumnId, toColumnId, toIndex: endIndex, orderedIds });
    }
  }

  function handleDragCancel() {
    dragStart.current = null;
    setActiveId(null);
    setDragItems(null);
  }

  function renderBody() {
    if (error) {
      return (
        <div className="kb-state" role="alert">
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="kb-btn" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="kb-scroll" aria-busy="true">
          <div className="kb-grid" style={gridStyle}>
            {columns.map((c) => (
              <div className="kb-col" key={c.id}>
                <KanbanColumnHeader column={c} count={0} />
                <div className="kb-zone">
                  <div className="kb-skeleton" />
                  <div className="kb-skeleton" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (columns.length === 0) {
      return (
        <div className="kb-state" role="status">
          No workflow statuses are configured for this project.
        </div>
      );
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="kb-scroll">
          {view === 'status' ? (
            <div className="kb-grid" style={gridStyle}>
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  containerId={column.id}
                  taskIds={items[column.id] ?? []}
                  tasksById={tasksById}
                  count={countByColumn.get(column.id) ?? 0}
                  showHeader
                  readOnly={readOnly}
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          ) : (
            <div className="kb-lanes">
              <div className="kb-grid kb-colnames" style={gridStyle}>
                {columns.map((column) => (
                  <KanbanColumnHeader
                    key={column.id}
                    column={column}
                    count={countByColumn.get(column.id) ?? 0}
                  />
                ))}
              </div>
              {model.lanes.length === 0 && <p className="kb-empty">No tasks yet</p>}
              {model.lanes.map((lane) => {
                const laneCount = columns.reduce(
                  (sum, c) => sum + (items[`${lane.id}${SEP}${c.id}`]?.length ?? 0),
                  0,
                );
                return (
                  <section className="kb-lane" key={lane.id} aria-label={`${lane.name} lane`}>
                    <div className="kb-lanehead">
                      {lane.assignee ? (
                        <KanbanAvatar assignee={lane.assignee} size={20} />
                      ) : (
                        <span className="kb-av kb-av--unassigned">?</span>
                      )}
                      <span>{lane.name}</span>
                      <span className="kb-count">{laneCount}</span>
                    </div>
                    <div className="kb-grid" style={gridStyle}>
                      {columns.map((column) => {
                        const containerId = `${lane.id}${SEP}${column.id}`;
                        return (
                          <KanbanColumn
                            key={containerId}
                            column={column}
                            containerId={containerId}
                            taskIds={items[containerId] ?? []}
                            tasksById={tasksById}
                            count={items[containerId]?.length ?? 0}
                            readOnly={readOnly}
                            onTaskClick={onTaskClick}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeTask ? <KanbanCardView task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    );
  }

  return (
    <section className="kb" aria-label={`${title} board`}>
      <KanbanToolbar
        title={title}
        projectKey={projectKey}
        doneCount={doneCount}
        totalCount={tasks.length}
        view={view}
        onViewChange={setView}
        onOpenCreateTask={onOpenCreateTask}
        readOnly={readOnly}
      />
      {renderBody()}
      <p className="kb-hint">
        Drag a card to reorder it or move it to another column. Esc cancels a drag. In Swimlanes, rows group tasks by owner.
      </p>
    </section>
  );
}
