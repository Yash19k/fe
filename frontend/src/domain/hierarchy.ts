/**
 * Hierarchy & Parent-Child Domain Rules for Work Items.
 *
 * Rules:
 * - Epic: Must not have a parent (parentId: null).
 * - Story: Standalone or belong to an Epic.
 * - Task: Standalone or belong to an Epic.
 * - Bug: Standalone or belong to an Epic.
 * - Subtask: MUST belong to a Story, Task, or Bug.
 * - A Subtask cannot have another Subtask as its parent.
 * - A Subtask cannot contain child work items.
 * - An item cannot be its own parent.
 * - Circular parent relationships are strictly rejected.
 */

import { WORK_ITEM_TYPES } from './workItems';
import { Task, WorkItemType } from '../types';

/**
 * Checks whether candidateAncestorId is already an ancestor of candidateDescendantId.
 */
export function isDescendantOf(
  candidateDescendantId: string | null | undefined,
  candidateAncestorId: string | null | undefined,
  allTasks: Task[]
): boolean {
  if (!candidateDescendantId || !candidateAncestorId) return false;
  if (candidateDescendantId === candidateAncestorId) return true;

  const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));
  let current = taskMap.get(candidateDescendantId);
  const visited = new Set<string>();

  while (current && current.parentId) {
    if (visited.has(current.id)) break; // cycle guard
    visited.add(current.id);

    if (current.parentId === candidateAncestorId) {
      return true;
    }
    current = taskMap.get(current.parentId);
  }

  return false;
}

/**
 * Returns the list of eligible parent work items for a given work-item type.
 */
export function getEligibleParents(
  type: WorkItemType | string,
  currentItemId: string | null | undefined,
  allTasks: Task[],
  projectId?: string
): Task[] {
  if (!type || type === WORK_ITEM_TYPES.EPIC) {
    return [];
  }

  // Filter tasks belonging to the current project
  const projectTasks = allTasks.filter(
    (t) => (t.projectId === projectId || !projectId) && t.id !== currentItemId
  );

  if (type === WORK_ITEM_TYPES.SUBTASK) {
    // Subtasks can belong to Story, Task, or Bug
    return projectTasks.filter((t) => {
      const isEligibleType = (
        [WORK_ITEM_TYPES.STORY, WORK_ITEM_TYPES.TASK, WORK_ITEM_TYPES.BUG] as WorkItemType[]
      ).includes(t.type || WORK_ITEM_TYPES.TASK);

      if (!isEligibleType) return false;

      // Prevent circular parenting if editing an existing item
      if (currentItemId && isDescendantOf(t.id, currentItemId, allTasks)) {
        return false;
      }

      return true;
    });
  }

  if (
    type === WORK_ITEM_TYPES.STORY ||
    type === WORK_ITEM_TYPES.TASK ||
    type === WORK_ITEM_TYPES.BUG
  ) {
    // Stories, Tasks, and Bugs can optionally belong to an Epic
    return projectTasks.filter((t) => {
      if (t.type !== WORK_ITEM_TYPES.EPIC) return false;

      // Prevent circular parenting if editing
      if (currentItemId && isDescendantOf(t.id, currentItemId, allTasks)) {
        return false;
      }

      return true;
    });
  }

  return [];
}

export interface HierarchyValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates hierarchy rules for a work item before saving.
 */
export function validateHierarchy(
  itemData: Partial<Task>,
  allTasks: Task[] = []
): HierarchyValidationResult {
  const type = itemData.type || WORK_ITEM_TYPES.TASK;
  const parentId = itemData.parentId || null;
  const currentId = itemData.id;

  // 1. Epic cannot have a parent
  if (type === WORK_ITEM_TYPES.EPIC) {
    if (parentId) {
      return {
        isValid: false,
        error: 'An Epic cannot have a parent work item.',
      };
    }
    return { isValid: true };
  }

  // 2. Subtask MUST have a parent
  if (type === WORK_ITEM_TYPES.SUBTASK) {
    if (!parentId) {
      return {
        isValid: false,
        error: 'A Subtask must have a parent work item (Story, Task, or Bug).',
      };
    }
  }

  // If no parent is assigned for Story/Task/Bug, it is valid (standalone)
  if (!parentId) {
    return { isValid: true };
  }

  // 3. Self-parenting check
  if (currentId && currentId === parentId) {
    return {
      isValid: false,
      error: 'A work item cannot be its own parent.',
    };
  }

  const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));
  const parentTask = taskMap.get(parentId);

  if (!parentTask) {
    return {
      isValid: false,
      error: 'Selected parent work item does not exist.',
    };
  }

  const parentType = parentTask.type || WORK_ITEM_TYPES.TASK;

  // 4. Subtask parent rules
  if (type === WORK_ITEM_TYPES.SUBTASK) {
    if (parentType === WORK_ITEM_TYPES.SUBTASK) {
      return {
        isValid: false,
        error: 'A Subtask cannot have another Subtask as its parent.',
      };
    }
    if (parentType === WORK_ITEM_TYPES.EPIC) {
      return {
        isValid: false,
        error: 'A Subtask cannot belong directly to an Epic. It must belong to a Story, Task, or Bug.',
      };
    }
  }

  // 5. Story, Task, Bug parent rules
  if (
    type === WORK_ITEM_TYPES.STORY ||
    type === WORK_ITEM_TYPES.TASK ||
    type === WORK_ITEM_TYPES.BUG
  ) {
    if (parentType !== WORK_ITEM_TYPES.EPIC) {
      return {
        isValid: false,
        error: `${type}s can only have an Epic as their parent work item.`,
      };
    }
  }

  // 6. Subtask cannot contain child work items
  if (currentId) {
    const existingChildren = allTasks.filter((t) => t.parentId === currentId);
    if (type === WORK_ITEM_TYPES.SUBTASK && existingChildren.length > 0) {
      return {
        isValid: false,
        error: 'A Subtask cannot contain child work items.',
      };
    }
  }

  // 7. Circular parent hierarchy detection
  if (currentId) {
    if (isDescendantOf(parentId, currentId, allTasks)) {
      return {
        isValid: false,
        error: 'Circular parent relationship detected: an item cannot be parented to its own child or descendant.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Returns direct children of a given work item.
 */
export function getChildWorkItems(parentId: string | null | undefined, allTasks: Task[]): Task[] {
  if (!parentId || !allTasks) return [];
  return allTasks.filter((t) => t.parentId === parentId);
}
