/**
 * Dependency Graph Engine.
 * Implements real DFS graph cycle detection, path reconstruction,
 * and blocker status determination.
 *
 * Convention:
 * If Task B depends on Task A:
 * - A is the Predecessor.
 * - B is the Successor.
 * - Directed Edge: A → B (Work flows from A to B).
 * - B cannot proceed until A reaches a completed status in its project workflow.
 */

import type { Task, Workflow } from '../types';
import { getWorkflowForProject, isWorkflowStatusComplete } from './workflow';

export interface AdjacencyList {
  forwardAdj: Map<string, Set<string>>;
  reverseAdj: Map<string, Set<string>>;
}

/**
 * Builds adjacency list from tasks.
 * forwardAdj: predecessorId -> Set of successorIds (A -> [B, ...])
 * reverseAdj: successorId -> Set of predecessorIds (B -> [A, ...])
 */
export function buildAdjacencyList(tasks: Task[]): AdjacencyList {
  const forwardAdj = new Map<string, Set<string>>(); // from -> [to] (predecessor -> successors)
  const reverseAdj = new Map<string, Set<string>>(); // to -> [from] (successor -> predecessors)

  tasks.forEach((t) => {
    forwardAdj.set(t.id, new Set());
    reverseAdj.set(t.id, new Set());
  });

  tasks.forEach((task) => {
    const predecessors = (task.dependencyIds || task.dependencies || []) as string[];
    predecessors.forEach((predId) => {
      if (forwardAdj.has(predId)) {
        forwardAdj.get(predId)!.add(task.id);
      }
      if (reverseAdj.has(task.id)) {
        reverseAdj.get(task.id)!.add(predId);
      }
    });
  });

  return { forwardAdj, reverseAdj };
}

/**
 * Finds a path from `fromId` to `toId` in the directed graph using DFS.
 * Returns array of node IDs if path exists, or null.
 */
export function findPath(
  fromId: string,
  toId: string,
  forwardAdj: Map<string, Set<string>>,
  visited: Set<string> = new Set(),
  currentPath: string[] = []
): string[] | null {
  if (fromId === toId) {
    return [...currentPath, fromId];
  }

  visited.add(fromId);
  currentPath.push(fromId);

  const neighbors = forwardAdj.get(fromId) || new Set();
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      const result = findPath(neighbor, toId, forwardAdj, visited, currentPath);
      if (result) return result;
    }
  }

  currentPath.pop();
  return null;
}

export interface DependencyValidationResult {
  isValid: boolean;
  reason?: string;
  isCycle?: boolean;
  cyclePathIds?: string[];
}

/**
 * Validates whether adding a dependency (predecessorId -> successorId) is legal.
 * Checks:
 * 1. Existence of both tasks
 * 2. Self-dependency (A -> A)
 * 3. Duplicate dependency
 * 4. Cycle detection via DFS path from successor to predecessor
 */
export function validateNewDependency(
  predecessorId: string,
  successorId: string,
  tasks: Task[]
): DependencyValidationResult {
  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));

  const predTask = taskMap.get(predecessorId);
  const succTask = taskMap.get(successorId);

  if (!predTask || !succTask) {
    return {
      isValid: false,
      reason: 'Both tasks must exist in the project.',
    };
  }

  if (predecessorId === successorId) {
    return {
      isValid: false,
      reason: `Self-dependency error: "${succTask.title}" cannot depend on itself.`,
    };
  }

  const existingPredecessors = (succTask.dependencyIds || succTask.dependencies || []) as string[];
  if (existingPredecessors.includes(predecessorId)) {
    return {
      isValid: false,
      reason: `Duplicate dependency: "${succTask.title}" already depends on "${predTask.title}".`,
    };
  }

  // To check if adding predId -> succId creates a cycle:
  // Check if succId can ALREADY reach predId in forward graph!
  const { forwardAdj } = buildAdjacencyList(tasks);
  const cyclePathIds = findPath(successorId, predecessorId, forwardAdj);

  if (cyclePathIds) {
    // There is an existing path from succ to pred!
    // Adding pred -> succ would close the loop.
    const fullCycleIds = [...cyclePathIds, successorId];
    const fullCycleTitles = fullCycleIds.map((id) => taskMap.get(id)?.title || id);

    return {
      isValid: false,
      isCycle: true,
      cyclePathIds: fullCycleIds,
      reason: `Circular dependency detected: ${fullCycleTitles.join(' → ')}`,
    };
  }

  return { isValid: true };
}

/**
 * Checks whether a task is currently blocked by incomplete predecessors.
 */
function isTaskComplete(task: Task, workflows?: Workflow | Workflow[]): boolean {
  const workflow = Array.isArray(workflows)
    ? getWorkflowForProject(workflows, task.projectId)
    : workflows;
  return isWorkflowStatusComplete(workflow, task.status);
}

export function isTaskBlocked(
  task: Task,
  allTasks: Task[],
  workflows?: Workflow | Workflow[],
): boolean {
  const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));
  const predIds = (task.dependencyIds || task.dependencies || []) as string[];
  if (predIds.length === 0) return false;

  return predIds.some((pId) => {
    const pred = taskMap.get(pId);
    return pred && !isTaskComplete(pred, workflows);
  });
}

/**
 * Returns the list of uncompleted predecessor tasks blocking this task.
 */
export function getBlockingTasks(
  task: Task,
  allTasks: Task[],
  workflows?: Workflow | Workflow[],
): Task[] {
  const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));
  const predIds = (task.dependencyIds || task.dependencies || []) as string[];
  return predIds
    .map((pId) => taskMap.get(pId))
    .filter((p): p is Task => Boolean(p && !isTaskComplete(p, workflows)));
}

/**
 * Returns all direct predecessor tasks for a task.
 */
export function getPredecessorTasks(task: Task, allTasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));
  return ((task.dependencyIds || task.dependencies || []) as string[])
    .map((id) => taskMap.get(id))
    .filter((t): t is Task => Boolean(t));
}

/**
 * Returns all direct successor tasks that depend on this task.
 */
export function getSuccessorTasks(task: Task, allTasks: Task[]): Task[] {
  return allTasks.filter((t) =>
    ((t.dependencyIds || t.dependencies || []) as string[]).includes(task.id)
  );
}
