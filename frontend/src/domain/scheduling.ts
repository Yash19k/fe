/**
 * Business-Day Scheduling Engine & Delay Propagation.
 * Enforces Finish-to-Start (FS) dependency constraint:
 * Successor work cannot begin before its predecessor has finished.
 * If a predecessor is delayed, affected downstream tasks are pushed forward
 * skipping weekends, preserving task durations.
 */

import {
  addBusinessDays,
  diffBusinessDays,
  snapToBusinessDay,
} from './businessDays';
import { buildAdjacencyList } from './dependencyGraph';
import { Task } from '../types';

export interface AffectedTaskSchedule {
  taskId: string;
  title: string;
  oldStartDate?: string | null;
  oldDueDate?: string | null;
  newStartDate: string;
  newDueDate: string;
  shiftDays: number;
}

export interface ScheduleImpactReport {
  taskId?: string;
  taskTitle?: string;
  oldDueDate?: string | null;
  newDueDate?: string;
  shiftBusinessDays?: number;
  affectedTasks: AffectedTaskSchedule[];
  currentProjectEnd?: string | null;
  newProjectEnd?: string | null;
  projectExtended?: boolean;
  canApply?: boolean;
  error?: string;
}

/**
 * Calculates impact preview of rescheduling a task to a new due date.
 * Does NOT mutate state. Returns preview analysis for confirmation modal.
 */
export function calculateScheduleImpact(
  taskId: string,
  newDueDateStr: string,
  tasks: Task[]
): ScheduleImpactReport {
  const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));
  const targetTask = taskMap.get(taskId);

  if (!targetTask) {
    return { error: 'Task not found', affectedTasks: [] };
  }

  // Current project latest due date
  const currentProjectEnd = tasks.reduce<string | null>((latest, t) => {
    if (!t.dueDate) return latest;
    return !latest || t.dueDate > latest ? t.dueDate : latest;
  }, null);

  const cleanNewDueDate = snapToBusinessDay(newDueDateStr);
  const oldDueDate = targetTask.dueDate;

  // Calculate shift in business days for the primary task
  const shiftBusinessDays = diffBusinessDays(oldDueDate, cleanNewDueDate) - 1;

  // Updated simulation map
  const simulatedMap = new Map<string, Task>(tasks.map((t) => [t.id, { ...t }]));
  const targetSim = simulatedMap.get(taskId)!;

  // Maintain primary task duration if start date exists
  if (targetTask.startDate && targetTask.dueDate) {
    const durationDays = diffBusinessDays(targetTask.startDate, targetTask.dueDate);
    // If target due date moved, adjust start date or keep start date and extend
    // Standard rule: if start date is after new due date, shift start date back
    if (targetSim.startDate && targetSim.startDate > cleanNewDueDate) {
      targetSim.startDate = addBusinessDays(cleanNewDueDate, -Math.max(1, durationDays - 1));
    }
  }
  targetSim.dueDate = cleanNewDueDate;

  const { forwardAdj } = buildAdjacencyList(tasks);
  const queue = [taskId];
  const affectedMap = new Map<string, AffectedTaskSchedule>(); // id -> { task, oldStart, oldDue, newStart, newDue, shiftDays }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentSim = simulatedMap.get(currentId)!;
    const successors = forwardAdj.get(currentId) || new Set();

    for (const succId of successors) {
      const succ = simulatedMap.get(succId);
      if (!succ) continue;

      // Finish-to-Start constraint: successor cannot start before predecessor due date + 1 business day
      const earliestAllowedStart = snapToBusinessDay(addBusinessDays(currentSim.dueDate || '', 1));

      // Check if successor needs to move
      const currentSuccStart = succ.startDate || succ.dueDate;
      if (currentSuccStart && currentSuccStart < earliestAllowedStart) {
        const oldStart = succ.startDate;
        const oldDue = succ.dueDate;

        // Calculate original duration in business days
        const originalDuration = oldStart && oldDue
          ? Math.max(1, diffBusinessDays(oldStart, oldDue))
          : 1;

        const newStart = earliestAllowedStart;
        const newDue = addBusinessDays(newStart, originalDuration - 1);

        // Update simulation
        succ.startDate = newStart;
        succ.dueDate = newDue;

        affectedMap.set(succId, {
          taskId: succId,
          title: succ.title,
          oldStartDate: oldStart,
          oldDueDate: oldDue,
          newStartDate: newStart,
          newDueDate: newDue,
          shiftDays: diffBusinessDays(oldDue, newDue) - 1,
        });

        // Queue downstream successors
        if (!queue.includes(succId)) {
          queue.push(succId);
        }
      }
    }
  }

  // Compute new project completion date
  let newProjectEnd = currentProjectEnd;
  for (const t of simulatedMap.values()) {
    if (t.dueDate && (!newProjectEnd || t.dueDate > newProjectEnd)) {
      newProjectEnd = t.dueDate;
    }
  }

  const affectedList = Array.from(affectedMap.values());

  return {
    taskId,
    taskTitle: targetTask.title,
    oldDueDate,
    newDueDate: cleanNewDueDate,
    shiftBusinessDays,
    affectedTasks: affectedList,
    currentProjectEnd,
    newProjectEnd,
    projectExtended: Boolean(currentProjectEnd && newProjectEnd && newProjectEnd > currentProjectEnd),
    canApply: true,
  };
}

/**
 * Applies impact preview changes to the task list.
 */
export function applyScheduleChanges(impactReport: ScheduleImpactReport, allTasks: Task[]): Task[] {
  if (!impactReport || !impactReport.canApply) return allTasks;

  const affectedMap = new Map(impactReport.affectedTasks.map((a) => [a.taskId, a]));

  return allTasks.map((t) => {
    if (t.id === impactReport.taskId) {
      return {
        ...t,
        dueDate: impactReport.newDueDate,
        updatedAt: new Date().toISOString(),
        version: (t.version || 1) + 1,
      };
    }

    if (affectedMap.has(t.id)) {
      const aff = affectedMap.get(t.id)!;
      return {
        ...t,
        startDate: aff.newStartDate,
        dueDate: aff.newDueDate,
        updatedAt: new Date().toISOString(),
        version: (t.version || 1) + 1,
      };
    }

    return t;
  });
}
