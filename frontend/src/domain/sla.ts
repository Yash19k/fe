/**
 * SLA Policy & Escalation Engine.
 *
 * Distinguishes between:
 * 1. Overdue: Task past its calendar dueDate.
 * 2. SLA Warning / Approaching: Task within configured breach risk window (e.g., < 24h to target).
 * 3. SLA Breached: Task exceeding the project's SLA resolution threshold hours.
 * 4. Escalated: Flagged for Manager/Admin review due to critical block or breach.
 */

import { Task } from '../types';

export interface SlaPolicy {
  highPriorityHours: number;
  mediumPriorityHours: number;
  lowPriorityHours: number;
  warningThresholdHours: number;
}

export const DEFAULT_SLA_POLICY: SlaPolicy = {
  highPriorityHours: 24, // 24 hours to resolve
  mediumPriorityHours: 48,
  lowPriorityHours: 96,
  warningThresholdHours: 8, // Warn when less than 8h remaining
};

export interface TaskSlaEvaluation {
  status?: string;
  badgeText?: string;
  isBreached: boolean;
  isApproaching: boolean;
  isEscalated: boolean;
  elapsedHours?: number;
  remainingHours?: number;
  thresholdHours?: number;
  label?: string;
  badgeClass?: string;
}

export function evaluateTaskSla(task: Task, policy: SlaPolicy = DEFAULT_SLA_POLICY): TaskSlaEvaluation {
  if (task.status === 'Done') {
    return {
      status: 'resolved',
      badgeText: 'SLA Met',
      isBreached: false,
      isApproaching: false,
      isEscalated: false,
    };
  }

  const priorityThreshold =
    task.priority === 'High'
      ? policy.highPriorityHours
      : task.priority === 'Medium'
        ? policy.mediumPriorityHours
        : policy.lowPriorityHours;

  const now = new Date();
  const createdDate = task.createdAt ? new Date(task.createdAt) : new Date(Date.now() - 36 * 3600 * 1000);
  const elapsedHours = Math.max(0, Math.round((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)));
  const remainingHours = priorityThreshold - elapsedHours;

  const isBreached = elapsedHours > priorityThreshold || Boolean(task.sla && task.sla.isBreached);
  const isApproaching = !isBreached && remainingHours <= policy.warningThresholdHours;
  const isEscalated = Boolean(task.sla?.isEscalated);

  let label = 'Healthy';
  let badgeClass = 'text-status-success bg-status-success/10 border-status-success/20';

  if (isEscalated) {
    label = 'Escalated to Manager';
    badgeClass = 'text-status-danger bg-status-danger/15 border-status-danger/30';
  } else if (isBreached) {
    label = `SLA Breached (+${Math.abs(remainingHours)}h)`;
    badgeClass = 'text-status-danger bg-status-danger/15 border-status-danger/30';
  } else if (isApproaching) {
    label = `SLA Risk (${remainingHours}h left)`;
    badgeClass = 'text-status-warning bg-status-warning/15 border-status-warning/30';
  }

  return {
    isBreached,
    isApproaching,
    isEscalated,
    elapsedHours,
    remainingHours,
    thresholdHours: priorityThreshold,
    label,
    badgeClass,
  };
}
