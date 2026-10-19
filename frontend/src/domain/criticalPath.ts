/**
 * Critical Path Method (CPM) Engine.
 *
 * Mathematical Foundations:
 * 1. Directed Acyclic Graph (DAG) of project tasks with Finish-to-Start (FS) links.
 * 2. Task Duration (D) derived from business days between startDate and dueDate (min 1 day).
 * 3. Forward Pass:
 *    - Early Start (ES) = max(EF of all predecessors) [0 for starting tasks]
 *    - Early Finish (EF) = ES + Duration
 * 4. Backward Pass:
 *    - Late Finish (LF) = min(LS of all successors) [Project End for terminal tasks]
 *    - Late Start (LS) = LF - Duration
 * 5. Total Float (Slack) = LS - ES = LF - EF
 * 6. Critical Path: The sequence of tasks with Zero Slack (Total Float == 0).
 *    Any delay in these tasks directly delays the overall project completion date.
 */

import { diffBusinessDays } from './businessDays';
import { buildAdjacencyList } from './dependencyGraph';
import { Task } from '../types';

export interface TaskCpmAnalysis {
  taskId: string;
  title: string;
  durationDays: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slackDays: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  criticalTaskIds: Set<string>;
  criticalTasks: Task[];
  totalProjectDurationDays: number;
  tasksAnalysis: Record<string, TaskCpmAnalysis>;
  criticalChain: string[];
}

export function calculateCriticalPath(tasks: Task[]): CriticalPathResult {
  if (!tasks || tasks.length === 0) {
    return {
      criticalTaskIds: new Set(),
      criticalTasks: [],
      totalProjectDurationDays: 0,
      tasksAnalysis: {},
      criticalChain: [],
    };
  }

  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const { forwardAdj, reverseAdj } = buildAdjacencyList(tasks);

  // 1. Calculate duration for each task in business days
  const durations = new Map<string, number>();
  tasks.forEach((t) => {
    let dur = 1;
    if (t.startDate && t.dueDate) {
      dur = Math.max(1, diffBusinessDays(t.startDate, t.dueDate));
    } else if (t.estimatedHours || t.estimateHours) {
      const hours = (t.estimatedHours || t.estimateHours) as number;
      dur = Math.max(1, Math.ceil(hours / 8));
    }
    durations.set(t.id, dur);
  });

  // 2. Topological Sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  tasks.forEach((t) => inDegree.set(t.id, (reverseAdj.get(t.id) || new Set()).size));

  const queue: string[] = [];
  tasks.forEach((t) => {
    if (inDegree.get(t.id) === 0) {
      queue.push(t.id);
    }
  });

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    topoOrder.push(id);

    const successors = forwardAdj.get(id) || new Set();
    for (const succId of successors) {
      const remaining = (inDegree.get(succId) || 1) - 1;
      inDegree.set(succId, remaining);
      if (remaining === 0) {
        queue.push(succId);
      }
    }
  }

  // Fallback if cycles or disconnected: append unvisited
  if (topoOrder.length < tasks.length) {
    tasks.forEach((t) => {
      if (!topoOrder.includes(t.id)) topoOrder.push(t.id);
    });
  }

  // 3. Forward Pass: Calculate ES and EF
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  topoOrder.forEach((id) => {
    const preds = reverseAdj.get(id) || new Set();
    let es = 0;
    preds.forEach((predId) => {
      const predEf = earlyFinish.get(predId) || 0;
      if (predEf > es) es = predEf;
    });

    const dur = durations.get(id) || 1;
    const ef = es + dur;

    earlyStart.set(id, es);
    earlyFinish.set(id, ef);
  });

  // Max EF is total planned project duration
  let maxProjectDuration = 0;
  tasks.forEach((t) => {
    const ef = earlyFinish.get(t.id) || 0;
    if (ef > maxProjectDuration) maxProjectDuration = ef;
  });

  // 4. Backward Pass: Calculate LF and LS
  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();

  // Reverse topological order
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    const succs = forwardAdj.get(id) || new Set();
    let lf = maxProjectDuration;

    if (succs.size > 0) {
      lf = Infinity;
      succs.forEach((succId) => {
        const succLs = lateStart.get(succId);
        if (succLs !== undefined && succLs < lf) {
          lf = succLs;
        }
      });
      if (lf === Infinity) lf = maxProjectDuration;
    }

    const dur = durations.get(id) || 1;
    const ls = lf - dur;

    lateFinish.set(id, lf);
    lateStart.set(id, ls);
  }

  // 5. Total Float (Slack) & Critical Path Identification
  const criticalTaskIds = new Set<string>();
  const tasksAnalysis: Record<string, TaskCpmAnalysis> = {};

  tasks.forEach((t) => {
    const es = earlyStart.get(t.id) || 0;
    const ef = earlyFinish.get(t.id) || 0;
    const ls = lateStart.get(t.id) || 0;
    const lf = lateFinish.get(t.id) || 0;
    const dur = durations.get(t.id) || 1;
    const slack = ls - es; // Slack == 0 => Critical

    const isCritical = slack === 0 && dur > 0;
    if (isCritical) {
      criticalTaskIds.add(t.id);
    }

    tasksAnalysis[t.id] = {
      taskId: t.id,
      title: t.title,
      durationDays: dur,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      slackDays: slack,
      isCritical,
    };
  });

  // Build the critical chain sequence
  const criticalTasks = topoOrder
    .filter((id) => criticalTaskIds.has(id))
    .map((id) => taskMap.get(id))
    .filter((t): t is Task => Boolean(t));

  return {
    criticalTaskIds,
    criticalTasks,
    totalProjectDurationDays: maxProjectDuration,
    tasksAnalysis,
    criticalChain: criticalTasks.map((t) => t.title),
  };
}
