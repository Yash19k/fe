import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { AuditLog } from "../entities/audit.log.entity";
import {
  Project,
  ProjectVisibility,
} from "../entities/project.entity";
import { ProjectMember } from "../entities/project.member.entity";
import {
  WorkItem,
  WorkItemStatus,
} from "../entities/work.item.entity";
import { WorkItemDependency } from "../entities/work.item.dependency.entity";
import { AppError } from "../errors/app.error";

interface DependencyActor {
  id: string;
  organizationId: string;
  role: string;
}

export const DEFAULT_PROJECT_TIMEZONE = "Asia/Kolkata";

type ScheduleEdge = Pick<
  WorkItemDependency,
  "id" | "workItemId" | "dependsOnWorkItemId"
>;

export interface ScheduleTask {
  id: string;
  title: string;
  status: WorkItemStatus;
  dueDate: Date | null;
  plannedStartDate: string | null;
  plannedDurationWorkingDays: number | null;
  isSchedulePinned: boolean;
}

function dateParts(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("A valid calendar date is required.", 400, "INVALID_SCHEDULE_DATE");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError("A valid calendar date is required.", 400, "INVALID_SCHEDULE_DATE");
  }
  return date;
}

export function getProjectDate(
  value: Date | string,
  timezone = DEFAULT_PROJECT_TIMEZONE,
): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    parseDateOnly(value);
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("A valid schedule date is required.", 400, "INVALID_SCHEDULE_DATE");
  }
  return dateParts(date, timezone);
}

function isWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function addWorkingDays(dateString: string, days: number): string {
  const date = parseDateOnly(dateString);
  let remaining = Math.abs(days);
  const direction = days < 0 ? -1 : 1;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (isWorkingDay(date)) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

export function assertWorkingDate(dateString: string): void {
  if (!isWorkingDay(parseDateOnly(dateString))) {
    throw new AppError(
      "Scheduled dates must fall on a Monday through Friday.",
      400,
      "INVALID_SCHEDULE_DATE",
    );
  }
}

export function calculatePlannedFinish(
  plannedStartDate: string,
  durationWorkingDays: number,
): string {
  if (!Number.isInteger(durationWorkingDays) || durationWorkingDays < 1) {
    throw new AppError(
      "Planned duration must be a positive whole number of working days.",
      400,
      "INVALID_SCHEDULE_DATA",
    );
  }
  assertWorkingDate(plannedStartDate);
  return addWorkingDays(plannedStartDate, durationWorkingDays - 1);
}

export function getEarliestAllowedStart(
  predecessorFinishDates: string[],
): string {
  if (predecessorFinishDates.length === 0) {
    throw new AppError(
      "At least one predecessor finish date is required.",
      400,
      "INVALID_DEPENDENCY",
    );
  }
  return predecessorFinishDates
    .map((finishDate) => addWorkingDays(finishDate, 1))
    .reduce((latest, candidate) => candidate > latest ? candidate : latest);
}

function snapToWorkingDay(dateString: string): string {
  let current = dateString;
  while (!isWorkingDay(parseDateOnly(current))) {
    current = addWorkingDays(current, 1);
  }
  return current;
}

export function dateToProjectTimestamp(
  dateString: string,
  timezone = DEFAULT_PROJECT_TIMEZONE,
): Date {
  const target = parseDateOnly(dateString);
  const targetUtc = target.getTime();
  let candidate = targetUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const formatted = dateParts(new Date(candidate), timezone);
    const represented = parseDateOnly(formatted).getTime();
    const difference = targetUtc - represented;
    if (difference === 0) break;
    candidate += difference;
  }

  return new Date(candidate);
}

export function requireDependencyDueDate(
  workItem: Pick<WorkItem, "title" | "dueDate">,
): string {
  if (!workItem.dueDate) {
    throw new AppError(
      `Work item "${workItem.title}" must have a due date before it can participate in a dependency.`,
      400,
      "DEPENDENCY_DUE_DATE_REQUIRED",
    );
  }
  return getProjectDate(workItem.dueDate);
}

function assertDueDate(workItem: Pick<WorkItem, "title" | "dueDate">): string {
  return requireDependencyDueDate(workItem);
}

function makeError(message: string, code: string): AppError {
  return new AppError(message, 409, code);
}

async function assertDependencyProjectAccess(
  manager: EntityManager,
  projectId: string,
  actor: DependencyActor,
): Promise<void> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId, organizationId: actor.organizationId },
    select: { id: true, visibility: true },
  });
  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }
  if (actor.role === "ADMIN" || project.visibility === ProjectVisibility.PUBLIC) {
    return;
  }
  const membership = await manager.getRepository(ProjectMember).exists({
    where: { projectId, userId: actor.id },
  });
  if (!membership) {
    throw new AppError(
      "You do not have access to this project.",
      403,
      "PROJECT_ACCESS_DENIED",
    );
  }
}

async function lockProject(
  manager: EntityManager,
  projectId: string,
  organizationId: string,
): Promise<WorkItem[]> {
  const project = await manager
    .getRepository(Project)
    .createQueryBuilder("project")
    .where("project.id = :projectId", { projectId })
    .andWhere("project.organizationId = :organizationId", { organizationId })
    .setLock("pessimistic_write")
    .getOne();

  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  return manager
    .getRepository(WorkItem)
    .createQueryBuilder("workItem")
    .where("workItem.projectId = :projectId", { projectId })
    .andWhere("workItem.organizationId = :organizationId", { organizationId })
    .orderBy("workItem.id", "ASC")
    .setLock("pessimistic_write")
    .getMany();
}

export async function lockProjectSchedule(
  manager: EntityManager,
  projectId: string,
  organizationId: string,
): Promise<void> {
  await lockProject(manager, projectId, organizationId);
}

function getAdjacency(
  edges: ScheduleEdge[],
  workItemIds: Set<string>,
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const id of workItemIds) adjacency.set(id, new Set());
  for (const edge of edges) {
    if (!workItemIds.has(edge.workItemId) || !workItemIds.has(edge.dependsOnWorkItemId)) {
      continue;
    }
    adjacency.get(edge.dependsOnWorkItemId)!.add(edge.workItemId);
  }
  return adjacency;
}

function findPath(
  start: string,
  target: string,
  adjacency: Map<string, Set<string>>,
): string[] | null {
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (current: string): boolean => {
    if (current === target) {
      path.push(current);
      return true;
    }
    if (visited.has(current)) return false;
    visited.add(current);
    path.push(current);
    for (const next of Array.from(adjacency.get(current) ?? []).sort()) {
      if (visit(next)) return true;
    }
    path.pop();
    return false;
  };

  return visit(start) ? path : null;
}

export function findDependencyCyclePath(
  predecessorId: string,
  successorId: string,
  workItemIds: Iterable<string>,
  edges: ScheduleEdge[],
): string[] | null {
  const adjacency = getAdjacency(edges, new Set(workItemIds));
  const path = findPath(successorId, predecessorId, adjacency);
  return path ? [predecessorId, ...path] : null;
}

function findExistingCycle(
  workItemIds: Iterable<string>,
  edges: ScheduleEdge[],
): string[] | null {
  const adjacency = getAdjacency(edges, new Set(workItemIds));
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  const visit = (current: string): string[] | null => {
    state.set(current, 1);
    stack.push(current);
    for (const next of Array.from(adjacency.get(current) ?? []).sort()) {
      if (state.get(next) === 1) {
        return [...stack.slice(stack.indexOf(next)), next];
      }
      if (!state.has(next)) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(current, 2);
    return null;
  };

  for (const id of Array.from(adjacency.keys()).sort()) {
    if (!state.has(id)) {
      const cycle = visit(id);
      if (cycle) return cycle;
    }
  }
  return null;
}

function downstreamInTopologicalOrder(
  rootIds: string[],
  adjacency: Map<string, Set<string>>,
  reverse: Map<string, Set<string>>,
): string[] {
  const affected = new Set<string>();
  const queue = [...rootIds].sort();
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!affected.has(next)) {
        affected.add(next);
        queue.push(next);
      }
    }
  }

  const indegree = new Map<string, number>();
  for (const id of affected) {
    const incoming = Array.from(reverse.get(id) ?? []).filter(
      (predecessor) => affected.has(predecessor),
    );
    indegree.set(id, incoming.length);
  }

  const ready = Array.from(affected)
    .filter((id) => indegree.get(id) === 0)
    .sort();
  const result: string[] = [];
  while (ready.length) {
    const current = ready.shift()!;
    result.push(current);
    for (const next of Array.from(adjacency.get(current) ?? []).sort()) {
      if (!affected.has(next)) continue;
      const nextIndegree = indegree.get(next)! - 1;
      indegree.set(next, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  if (result.length !== affected.size) {
    throw makeError("The project dependency graph already contains a cycle.", "DEPENDENCY_CYCLE");
  }
  return result;
}

function getIncomingEdges(
  taskId: string,
  edges: ScheduleEdge[],
): ScheduleEdge[] {
  return edges.filter((edge) => edge.workItemId === taskId);
}

function requireScheduleInputs(workItem: ScheduleTask): {
  startDate: string;
  duration: number;
  dueDate: string;
} {
  const dueDate = assertDueDate(workItem);
  if (
    !workItem.plannedStartDate ||
    !Number.isInteger(workItem.plannedDurationWorkingDays) ||
    !workItem.plannedDurationWorkingDays ||
    workItem.plannedDurationWorkingDays < 1
  ) {
    throw makeError(
      `Work item "${workItem.title}" needs a planned start date and positive working-day duration before it can be rescheduled.`,
      "DEPENDENCY_SCHEDULE_DATA_REQUIRED",
    );
  }
  const expectedFinish = calculatePlannedFinish(
    workItem.plannedStartDate,
    workItem.plannedDurationWorkingDays,
  );
  if (expectedFinish !== dueDate) {
    throw makeError(
      `Work item "${workItem.title}" has inconsistent planned dates and duration.`,
      "DEPENDENCY_SCHEDULE_CONFLICT",
    );
  }
  return {
    startDate: workItem.plannedStartDate,
    duration: workItem.plannedDurationWorkingDays,
    dueDate,
  };
}

function validateDependencyEndpoints(
  predecessor: WorkItem,
  successor: WorkItem,
): void {
  assertDueDate(predecessor);
  assertDueDate(successor);
}

async function loadEdges(
  manager: EntityManager,
  projectWorkItems: WorkItem[],
): Promise<ScheduleEdge[]> {
  const ids = projectWorkItems.map((item) => item.id);
  if (ids.length === 0) return [];
  return manager.getRepository(WorkItemDependency).find({
    where: [
      { workItemId: In(ids) },
      { dependsOnWorkItemId: In(ids) },
    ],
    order: { id: "ASC" },
  });
}

function validateProjectEdges(
  workItems: WorkItem[],
  edges: ScheduleEdge[],
): void {
  const byId = new Map(workItems.map((item) => [item.id, item]));
  for (const edge of edges) {
    const successor = byId.get(edge.workItemId);
    const predecessor = byId.get(edge.dependsOnWorkItemId);
    if (!successor || !predecessor) {
      throw makeError(
        "The project contains a dependency that crosses project boundaries.",
        "INVALID_DEPENDENCY",
      );
    }
    validateDependencyEndpoints(predecessor, successor);
  }
}

export function calculateScheduleReflow(
  workItems: ScheduleTask[],
  edges: ScheduleEdge[],
  roots: string[],
): ScheduleTask[] {
  const byId = new Map(
    workItems.map((item) => [item.id, { ...item }]),
  );
  const ids = new Set(byId.keys());
  const adjacency = getAdjacency(edges, ids);
  const reverse = new Map<string, Set<string>>();
  for (const id of ids) reverse.set(id, new Set());
  for (const edge of edges) {
    if (!ids.has(edge.workItemId) || !ids.has(edge.dependsOnWorkItemId)) continue;
    reverse.get(edge.workItemId)!.add(edge.dependsOnWorkItemId);
  }

  const changed: ScheduleTask[] = [];
  for (const taskId of downstreamInTopologicalOrder(roots, adjacency, reverse)) {
    const successor = byId.get(taskId)!;
    const predecessors = getIncomingEdges(taskId, edges)
      .map((edge) => byId.get(edge.dependsOnWorkItemId))
      .filter((item): item is WorkItem => Boolean(item));
    if (!predecessors.length) continue;

    const earliestStart = getEarliestAllowedStart(
      predecessors.map((predecessor) => assertDueDate(predecessor)),
    );
    const schedule = requireScheduleInputs(successor);
    if (schedule.startDate >= earliestStart) continue;

    if (
      successor.status === WorkItemStatus.DONE ||
      successor.isSchedulePinned
    ) {
      throw makeError(
        `Cannot move "${successor.title}" because it is completed or schedule-pinned.`,
        "DEPENDENCY_SCHEDULE_CONFLICT",
      );
    }

    successor.plannedStartDate = snapToWorkingDay(earliestStart);
    successor.dueDate = dateToProjectTimestamp(
      calculatePlannedFinish(successor.plannedStartDate, schedule.duration),
    );
    changed.push(successor);
  }

  return changed;
}

async function reflowSuccessors(
  manager: EntityManager,
  workItems: WorkItem[],
  edges: ScheduleEdge[],
  roots: string[],
  actor: DependencyActor,
): Promise<WorkItem[]> {
  const workItemsById = new Map(workItems.map((item) => [item.id, item]));
  const scheduleUpdates = calculateScheduleReflow(workItems, edges, roots);
  const changed: WorkItem[] = [];

  for (const schedule of scheduleUpdates) {
    const workItem = workItemsById.get(schedule.id)!;
    const previousStartDate = workItem.plannedStartDate;
    const previousDueDate = workItem.dueDate;
    workItem.plannedStartDate = schedule.plannedStartDate;
    workItem.dueDate = schedule.dueDate;
    const saved = await manager.getRepository(WorkItem).save(workItem);
    await manager.getRepository(AuditLog).save(
      manager.getRepository(AuditLog).create({
        organizationId: saved.organizationId,
        projectId: saved.projectId,
        userId: actor.id,
        action: "schedule_reflow",
        entityType: "task",
        entityId: saved.id,
        description: `Automatically rescheduled "${saved.title}" to satisfy dependency constraints`,
        previousState: {
          plannedStartDate: previousStartDate,
          dueDate: previousDueDate?.toISOString() ?? null,
        },
        newState: {
          plannedStartDate: saved.plannedStartDate,
          dueDate: saved.dueDate?.toISOString() ?? null,
        },
        trustedForUndo: false,
      }),
    );
    changed.push(saved);
  }

  return changed;
}

async function writeDependencyAudit(
  manager: EntityManager,
  actor: DependencyActor,
  workItem: WorkItem,
  action: "dependency_added" | "dependency_removed",
  dependency: ScheduleEdge,
  changed: WorkItem[],
): Promise<void> {
  const auditRepository = manager.getRepository(AuditLog);
  await auditRepository.save(
    auditRepository.create({
      organizationId: workItem.organizationId,
      projectId: workItem.projectId,
      userId: actor.id,
      action,
      entityType: "task",
      entityId: workItem.id,
      description:
        action === "dependency_added"
          ? `Added a dependency to "${workItem.title}"`
          : `Removed a dependency from "${workItem.title}"`,
      previousState: action === "dependency_removed" ? dependency : null,
      newState: {
        dependency: action === "dependency_added" ? dependency : null,
        rescheduledWorkItems: changed.map((item) => ({
          id: item.id,
          plannedStartDate: item.plannedStartDate,
          dueDate: item.dueDate,
        })),
      },
      trustedForUndo: false,
    }),
  );
}

export async function addWorkItemDependency(
  actor: DependencyActor,
  successorId: string,
  predecessorId: string,
) {
  return AppDataSource.transaction(async (manager) => {
    const successorReference = await manager.getRepository(WorkItem).findOne({
      where: { id: successorId, organizationId: actor.organizationId },
      select: { id: true, projectId: true },
    });
    if (!successorReference) {
      throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }

    await assertDependencyProjectAccess(
      manager,
      successorReference.projectId,
      actor,
    );
    const projectWorkItems = await lockProject(
      manager,
      successorReference.projectId,
      actor.organizationId,
    );
    const byId = new Map(projectWorkItems.map((item) => [item.id, item]));
    const successor = byId.get(successorId);
    const predecessor = byId.get(predecessorId);
    if (!successor || !predecessor) {
      throw new AppError(
        "Both dependency work items must exist in the same project and organization.",
        400,
        "INVALID_DEPENDENCY",
      );
    }
    if (successorId === predecessorId) {
      throw new AppError(
        "A work item cannot depend on itself.",
        400,
        "INVALID_DEPENDENCY",
      );
    }

    validateDependencyEndpoints(predecessor, successor);
    const edges = await loadEdges(manager, projectWorkItems);
    validateProjectEdges(projectWorkItems, edges);
    const existingCycle = findExistingCycle(byId.keys(), edges);
    if (existingCycle) {
      const readablePath = existingCycle
        .map((id) => byId.get(id)?.title ?? id)
        .join(" → ");
      throw new AppError(
        `The project dependency graph already contains a cycle: ${readablePath}`,
        409,
        "DEPENDENCY_CYCLE",
      );
    }
    if (
      edges.some(
        (edge) =>
          edge.workItemId === successorId &&
          edge.dependsOnWorkItemId === predecessorId,
      )
    ) {
      throw new AppError(
        "This dependency already exists.",
        409,
        "DEPENDENCY_EXISTS",
      );
    }

    const cycle = findDependencyCyclePath(
      predecessorId,
      successorId,
      byId.keys(),
      edges,
    );
    if (cycle) {
      const readablePath = cycle
        .map((id) => byId.get(id)?.title ?? id)
        .join(" → ");
      throw new AppError(
        `Adding this dependency would create a cycle: ${readablePath}`,
        409,
        "DEPENDENCY_CYCLE",
      );
    }

    const dependencyRepository = manager.getRepository(WorkItemDependency);
    const dependency = await dependencyRepository.save(
      dependencyRepository.create({
        workItemId: successorId,
        dependsOnWorkItemId: predecessorId,
      }),
    );
    const nextEdges = [...edges, dependency];
    const rescheduledTasks = await reflowSuccessors(
      manager,
      projectWorkItems,
      nextEdges,
      [predecessorId],
      actor,
    );
    await writeDependencyAudit(
      manager,
      actor,
      successor,
      "dependency_added",
      dependency,
      rescheduledTasks,
    );

    return {
      dependency,
      dependencies: nextEdges.filter((edge) => edge.workItemId === successorId),
      rescheduledTasks,
    };
  });
}

export async function removeWorkItemDependency(
  actor: DependencyActor,
  successorId: string,
  dependencyIdentifier: string,
) {
  return AppDataSource.transaction(async (manager) => {
    const successorReference = await manager.getRepository(WorkItem).findOne({
      where: { id: successorId, organizationId: actor.organizationId },
      select: { id: true, projectId: true },
    });
    if (!successorReference) {
      throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    await assertDependencyProjectAccess(
      manager,
      successorReference.projectId,
      actor,
    );
    const projectWorkItems = await lockProject(
      manager,
      successorReference.projectId,
      actor.organizationId,
    );
    const successor = projectWorkItems.find((item) => item.id === successorId);
    if (!successor) {
      throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    const edges = await loadEdges(manager, projectWorkItems);
    const dependency = edges.find(
      (edge) =>
        edge.workItemId === successorId &&
        (edge.id === dependencyIdentifier ||
          edge.dependsOnWorkItemId === dependencyIdentifier),
    );
    if (!dependency) {
      throw new AppError("Dependency not found.", 404, "DEPENDENCY_NOT_FOUND");
    }

    await manager.getRepository(WorkItemDependency).delete({ id: dependency.id });
    await writeDependencyAudit(
      manager,
      actor,
      successor,
      "dependency_removed",
      dependency,
      [],
    );

    return {
      dependency,
      dependencies: edges.filter(
        (edge) => edge.workItemId === successorId && edge.id !== dependency.id,
      ),
      rescheduledTasks: [],
    };
  });
}

export async function rescheduleAfterTaskEdit(
  manager: EntityManager,
  actor: DependencyActor,
  workItem: WorkItem,
): Promise<WorkItem[]> {
  const projectWorkItems = await lockProject(
    manager,
    workItem.projectId,
    actor.organizationId,
  );
  const byId = new Map(projectWorkItems.map((item) => [item.id, item]));
  const task = byId.get(workItem.id);
  if (!task) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }
  const edges = await loadEdges(manager, projectWorkItems);
  validateProjectEdges(projectWorkItems, edges);
  const relatedEdges = edges.filter(
    (edge) =>
      edge.workItemId === task.id || edge.dependsOnWorkItemId === task.id,
  );

  if (task.dueDate === null && relatedEdges.length > 0) {
    throw new AppError(
      "A work item participating in dependencies must have a due date.",
      400,
      "DEPENDENCY_DUE_DATE_REQUIRED",
    );
  }
  if (relatedEdges.length === 0) return [];

  const ownPredecessors = getIncomingEdges(task.id, edges).map((edge) =>
    byId.get(edge.dependsOnWorkItemId),
  ).filter((item): item is WorkItem => Boolean(item));
  if (ownPredecessors.length > 0) {
    const schedule = requireScheduleInputs(task);
    const earliestStart = getEarliestAllowedStart(
      ownPredecessors.map((predecessor) => assertDueDate(predecessor)),
    );
    if (schedule.startDate < earliestStart) {
      throw makeError(
        `The updated schedule for "${task.title}" conflicts with its predecessor constraints.`,
        "DEPENDENCY_SCHEDULE_CONFLICT",
      );
    }
  }

  const changed = await reflowSuccessors(
    manager,
    projectWorkItems,
    edges,
    [task.id],
    actor,
  );
  return changed;
}

export function updateTaskScheduleFields(
  workItem: WorkItem,
  input: {
    dueDate?: Date | string | null;
    plannedStartDate?: string | null;
    plannedDurationWorkingDays?: number | null;
    isSchedulePinned?: boolean;
  },
  hasDependencies: boolean,
  requiresPlannedSchedule: boolean,
): void {
  const startChanged = input.plannedStartDate !== undefined;
  const durationChanged = input.plannedDurationWorkingDays !== undefined;
  const dueDateChanged = input.dueDate !== undefined;

  if (startChanged) workItem.plannedStartDate = input.plannedStartDate ?? null;
  if (durationChanged) {
    workItem.plannedDurationWorkingDays =
      input.plannedDurationWorkingDays ?? null;
  }
  if (input.isSchedulePinned !== undefined) {
    workItem.isSchedulePinned = input.isSchedulePinned;
  }

  if (startChanged || durationChanged) {
    if (
      workItem.plannedStartDate &&
      workItem.plannedDurationWorkingDays
    ) {
      assertWorkingDate(workItem.plannedStartDate);
      const finish = calculatePlannedFinish(
        workItem.plannedStartDate,
        workItem.plannedDurationWorkingDays,
      );
      if (
        dueDateChanged &&
        input.dueDate != null &&
        getProjectDate(input.dueDate) !== finish
      ) {
        throw new AppError(
          "Due date must match the planned start date and working-day duration.",
          400,
          "INVALID_SCHEDULE_DATA",
        );
      }
      workItem.dueDate = dateToProjectTimestamp(finish);
    } else if (dueDateChanged) {
      if (input.dueDate == null) {
        workItem.dueDate = null;
        if (!hasDependencies) {
          workItem.plannedStartDate = null;
          workItem.plannedDurationWorkingDays = null;
        }
      } else {
        const finish = getProjectDate(input.dueDate);
        assertWorkingDate(finish);
        workItem.dueDate =
          input.dueDate instanceof Date
            ? input.dueDate
            : dateToProjectTimestamp(finish);
      }
    } else if (requiresPlannedSchedule) {
      throw new AppError(
        "Dependent work items require both a planned start date and a positive working-day duration.",
        409,
        "DEPENDENCY_SCHEDULE_DATA_REQUIRED",
      );
    }
  } else if (dueDateChanged) {
    if (input.dueDate == null) {
      if (hasDependencies) {
        throw new AppError(
          "A work item participating in dependencies must have a due date.",
          400,
          "DEPENDENCY_DUE_DATE_REQUIRED",
        );
      }
      workItem.dueDate = null;
      workItem.plannedStartDate = null;
      workItem.plannedDurationWorkingDays = null;
    } else {
      const finish = getProjectDate(input.dueDate);
      if (!isWorkingDay(parseDateOnly(finish))) {
        throw new AppError(
          "A scheduled finish date must be a working day.",
          400,
          "INVALID_SCHEDULE_DATE",
        );
      }
      if (workItem.plannedStartDate && workItem.plannedDurationWorkingDays) {
        workItem.plannedStartDate = addWorkingDays(
          finish,
          -(workItem.plannedDurationWorkingDays - 1),
        );
      }
      workItem.dueDate =
        input.dueDate instanceof Date
          ? input.dueDate
          : dateToProjectTimestamp(finish);
    }
  }

  if (hasDependencies && !workItem.dueDate) {
    throw new AppError(
      "A work item participating in dependencies must have a due date.",
      400,
      "DEPENDENCY_DUE_DATE_REQUIRED",
    );
  }
  if (
    requiresPlannedSchedule &&
    (!workItem.plannedStartDate || !workItem.plannedDurationWorkingDays)
  ) {
    throw new AppError(
      "A dependent work item requires a planned start date and positive working-day duration.",
      409,
      "DEPENDENCY_SCHEDULE_DATA_REQUIRED",
    );
  }
}

export async function getWorkItemDependencyState(
  manager: EntityManager,
  workItemId: string,
): Promise<{ hasDependencies: boolean; requiresPlannedSchedule: boolean }> {
  const dependencies = await manager.getRepository(WorkItemDependency).find({
    where: [
      { workItemId },
      { dependsOnWorkItemId: workItemId },
    ],
    select: { workItemId: true },
  });
  return {
    hasDependencies: dependencies.length > 0,
    requiresPlannedSchedule: dependencies.some(
      (dependency) => dependency.workItemId === workItemId,
    ),
  };
}
