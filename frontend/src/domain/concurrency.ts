/**
 * Concurrency Conflict Detection Engine.
 * Detects whether a task was modified by another simulated session/tab
 * while the user was actively editing it in a form/drawer.
 */

import { Task } from '../types';

export interface DifferingField {
  field: string;
  original: any;
  latest: any;
}

export interface ConflictResult {
  hasConflict: boolean;
  snapshotVersion?: number;
  latestVersion?: number;
  differingFields?: DifferingField[];
  latestTask?: Task;
}

export function detectConflict(
  initialSnapshot: Task | null | undefined,
  currentTask: Task | null | undefined
): ConflictResult {
  if (!initialSnapshot || !currentTask) return { hasConflict: false };

  // If versions differ or updatedAt is newer than initial snapshot
  const versionDiffers = (currentTask.version || 1) !== (initialSnapshot.version || 1);
  const timestampDiffers =
    Boolean(
      currentTask.updatedAt &&
      initialSnapshot.updatedAt &&
      new Date(currentTask.updatedAt).getTime() > new Date(initialSnapshot.updatedAt).getTime()
    );

  if (versionDiffers || timestampDiffers) {
    // Find differing fields
    const differingFields: DifferingField[] = [];
    const fieldsToCheck: (keyof Task)[] = ['title', 'status', 'priority', 'dueDate', 'assigneeId', 'description'];

    fieldsToCheck.forEach((f) => {
      if (initialSnapshot[f] !== currentTask[f]) {
        differingFields.push({
          field: String(f),
          original: initialSnapshot[f],
          latest: currentTask[f],
        });
      }
    });

    return {
      hasConflict: true,
      snapshotVersion: initialSnapshot.version || 1,
      latestVersion: currentTask.version || 1,
      differingFields,
      latestTask: currentTask,
    };
  }

  return { hasConflict: false };
}
