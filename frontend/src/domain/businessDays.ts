/**
 * Business-day scheduling utilities.
 * Handles date arithmetic skipping weekends (Saturday and Sunday).
 * Avoids timezone drift by working strictly with YYYY-MM-DD strings and local dates.
 */

import { parseDateValue } from '../utils/dateUtils';

export function parseLocalDate(dateStr?: string | Date | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWeekend(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Snap date to next business day if it falls on a weekend
 */
export function snapToBusinessDay(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  while (isWeekend(d)) {
    d.setDate(d.getDate() + 1);
  }
  return formatLocalDate(d);
}

/**
 * Adds business days to a date string (skipping Sat & Sun).
 * If days > 0, moves forward. If days < 0, moves backward.
 */
export function addBusinessDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  let remaining = Math.abs(days);
  const step = days >= 0 ? 1 : -1;

  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (!isWeekend(d)) {
      remaining--;
    }
  }

  return formatLocalDate(d);
}

/**
 * Calculates number of business days between start and end (inclusive of start, up to end).
 */
export function diffBusinessDays(startStr?: string | null, endStr?: string | null): number {
  if (!startStr || !endStr) return 0;
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  if (start > end) return -diffBusinessDays(endStr, startStr);

  let count = 0;
  const curr = new Date(start);
  while (curr <= end) {
    if (!isWeekend(curr)) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
  }
  return count;
}

export function formatShortDate(dateStr?: string | null): string {
  const d = parseDateValue(dateStr);
  if (!d) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDate(dateStr?: string | null): string {
  const d = parseDateValue(dateStr);
  if (!d) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface RelativeDateLabel {
  label: string;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export function getRelativeDateLabel(dateStr?: string | null): RelativeDateLabel {
  const target = parseDateValue(dateStr);
  if (!target) return { label: '-', isOverdue: false, isDueSoon: false };
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d overdue (${formatShortDate(dateStr)})`,
      isOverdue: true,
      isDueSoon: false,
    };
  }
  if (diffDays === 0) {
    return { label: `Today (${formatShortDate(dateStr)})`, isOverdue: false, isDueSoon: true };
  }
  if (diffDays === 1) {
    return { label: `Tomorrow (${formatShortDate(dateStr)})`, isOverdue: false, isDueSoon: true };
  }
  if (diffDays <= 5) {
    return { label: `${diffDays}d left (${formatShortDate(dateStr)})`, isOverdue: false, isDueSoon: true };
  }
  return { label: formatShortDate(dateStr), isOverdue: false, isDueSoon: false };
}
