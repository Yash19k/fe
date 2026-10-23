import type { Task } from '../types';

/**
 * Normalizes date string or timestamp into a pure YYYY-MM-DD comparison string,
 * avoiding timezone shifting.
 */
export function normalizeDueDate(dueDate?: string | null): string | null {
  if (!dueDate || typeof dueDate !== 'string') return null;
  const trimmed = dueDate.trim();
  if (!trimmed) return null;

  // Direct YYYY-MM-DD pattern
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Determines whether a work item is strictly due on the given calendar date string (YYYY-MM-DD).
 * Per Section 10:
 * - A work item appears ONLY on the date corresponding to its actual due-date field.
 * - Undated tasks never appear on arbitrary calendar dates.
 * - Items are not spanned or duplicated across date ranges.
 */
export function isTaskDueOnCalendarDate(task: Task, targetDateStr: string): boolean {
  if (!task.dueDate) return false;
  const normalized = normalizeDueDate(task.dueDate);
  return normalized === targetDateStr;
}
