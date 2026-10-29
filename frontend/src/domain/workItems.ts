/**
 * Domain constants, types, and data sanitization for Work Items in TaskFlow Pro.
 * Exactly 5 unified types: Epic, Story, Task, Subtask, Bug.
 */

import { WorkItemType, BugSeverity, Task } from '../types';

export const WORK_ITEM_TYPES = {
  EPIC: 'Epic' as const,
  STORY: 'Story' as const,
  TASK: 'Task' as const,
  SUBTASK: 'Subtask' as const,
  BUG: 'Bug' as const,
};

export const WORK_ITEM_TYPE_LIST: WorkItemType[] = [
  WORK_ITEM_TYPES.EPIC,
  WORK_ITEM_TYPES.STORY,
  WORK_ITEM_TYPES.TASK,
  WORK_ITEM_TYPES.SUBTASK,
  WORK_ITEM_TYPES.BUG,
];

export const BUG_SEVERITIES: BugSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

export const DEFAULT_WORK_ITEM_TYPE: WorkItemType = WORK_ITEM_TYPES.TASK;

export function getWorkItemVersion(task: Pick<Task, 'version'>): number | undefined {
  const { version } = task;
  return typeof version === 'number' && Number.isInteger(version) && version >= 1
    ? version
    : undefined;
}

/**
 * Strips stale type-specific properties when creating or editing a work item.
 * Ensures fields belonging to another type are never persisted accidentally.
 */
export function sanitizeWorkItemData<T extends Record<string, any>>(data: T): T {
  const type: WorkItemType = data.type || DEFAULT_WORK_ITEM_TYPE;
  const sanitized: Record<string, any> = { ...data, type };

  // Common fields are always retained:
  // id, type, title, description, projectId, sectionId, status, priority,
  // assigneeId, creatorId, startDate, dueDate, estimateHours, actualHours,
  // tags, comments, timeEntries, dependencyIds, recurrenceRule, sla, version, etc.

  // 1. Hierarchy parent normalization
  if (type === WORK_ITEM_TYPES.EPIC) {
    sanitized.parentId = null;
  } else if (!sanitized.parentId) {
    sanitized.parentId = null;
  }

  // Common defaults normalization (handles empty strings as null)
  if (!sanitized.priority || sanitized.priority === 'No priority' || sanitized.priority === 'none') {
    sanitized.priority = null;
  }
  if (!sanitized.assigneeId) {
    sanitized.assigneeId = null;
  }
  if (!sanitized.startDate) {
    sanitized.startDate = null;
  }
  if (!sanitized.dueDate) {
    sanitized.dueDate = null;
  }
  if (sanitized.estimateHours === '' || sanitized.estimateHours === undefined || sanitized.estimateHours === null) {
    sanitized.estimateHours = null;
  } else {
    sanitized.estimateHours = Number(sanitized.estimateHours);
  }
  sanitized.attachments = Array.isArray(data.attachments) ? data.attachments : [];

  // 2. Epic-specific fields
  if (type === WORK_ITEM_TYPES.EPIC) {
    sanitized.businessGoal = data.businessGoal?.trim() || '';
    sanitized.successCriteria = data.successCriteria?.trim() || '';
  } else {
    delete sanitized.businessGoal;
    delete sanitized.successCriteria;
  }

  // 3. Story-specific fields
  if (type === WORK_ITEM_TYPES.STORY) {
    sanitized.acceptanceCriteria = data.acceptanceCriteria?.trim() || '';
  } else {
    delete sanitized.acceptanceCriteria;
  }

  // 4. Bug-specific fields
  if (type === WORK_ITEM_TYPES.BUG) {
    sanitized.severity = BUG_SEVERITIES.includes(data.severity as BugSeverity)
      ? data.severity
      : 'Medium';
    sanitized.stepsToReproduce = data.stepsToReproduce?.trim() || '';
    sanitized.expectedBehavior = data.expectedBehavior?.trim() || '';
    sanitized.actualBehavior = data.actualBehavior?.trim() || '';
    sanitized.environment = data.environment?.trim() || '';
  } else {
    delete sanitized.severity;
    delete sanitized.stepsToReproduce;
    delete sanitized.expectedBehavior;
    delete sanitized.actualBehavior;
    delete sanitized.environment;
  }

  return sanitized as T;
}
