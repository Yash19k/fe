export const PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export const STATUS = {
  TODO: 'Todo',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  BLOCKED: 'Blocked',
  DONE: 'Done',
} as const;

export const teamMembers: Array<{ id: string; name: string }> = [];

export function formatDeadline(value: string): string {
  if (!value) return 'No deadline';
  return formatDate(value);
}

export function formatDueDate(value: string): { text: string; isOverdue: boolean; isDueSoon: boolean } {
  if (!value) return { text: 'No due date', isOverdue: false, isDueSoon: false };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { text: value, isOverdue: false, isDueSoon: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return {
    text: formatDate(value),
    isOverdue: daysUntil < 0,
    isDueSoon: daysUntil >= 0 && daysUntil <= 2,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
