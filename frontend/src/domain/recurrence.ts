/**
 * Recurring Tasks Engine.
 * Formats recurrence rules into natural language,
 * and computes future occurrences for previews.
 */

import { addBusinessDays, formatLocalDate, parseLocalDate } from './businessDays';
import { RecurrenceConfig, Task } from '../types';

export interface RecurrenceRule {
  frequency?: string;
  interval?: number;
  daysOfWeek?: number[];
  endCondition?: string;
  occurrences?: number;
  weekdaysOnly?: boolean;
  endDate?: string;
  startsOn?: string;
  dayOfMonth?: number;
  customUnit?: string;
  [key: string]: any;
}

export interface RecurrenceOccurrence {
  occurrenceNumber: number;
  date: string;
}

export function buildBackendRecurrence(
  frequency: string,
  interval: number,
  weekdaysOnly: boolean,
  startsOn: string,
): RecurrenceConfig | undefined {
  if (frequency === 'none') return undefined;
  const intervalValue =
    frequency === 'weekly_monday' ||
    frequency === 'monthly_first_day' ||
    frequency === 'monthly_last_friday'
      ? 1
      : interval;

  const recurrence: RecurrenceConfig = {
    frequency:
      frequency === 'daily' ? 'DAILY' :
      frequency === 'weekly' || frequency === 'weekly_monday' ? 'WEEKLY' :
      'MONTHLY',
    interval: intervalValue,
    startsOn,
    timezone: 'Asia/Kolkata',
  };

  if (frequency === 'daily') {
    recurrence.weekdaysOnly = weekdaysOnly;
  } else if (frequency === 'weekly_monday') {
    recurrence.daysOfWeek = [1];
  } else if (frequency === 'weekly') {
    recurrence.daysOfWeek = [new Date(`${startsOn}T00:00:00.000Z`).getUTCDay()];
  } else if (frequency === 'monthly_first_day') {
    recurrence.monthlyPattern = 'FIRST_DAY';
  } else if (frequency === 'monthly_last_friday') {
    recurrence.monthlyPattern = 'LAST_FRIDAY';
  } else {
    recurrence.monthlyPattern = 'DAY_OF_MONTH';
    recurrence.dayOfMonth = Number(startsOn.slice(8, 10));
  }

  return recurrence;
}

export function backendRecurrenceToRule(recurrence: RecurrenceConfig): RecurrenceRule {
  let frequency: string;

  if (recurrence.frequency === 'DAILY') {
    frequency = 'daily';
  } else if (recurrence.frequency === 'WEEKLY') {
    frequency = recurrence.daysOfWeek?.length === 1 && recurrence.daysOfWeek[0] === 1
      ? 'weekly_monday'
      : 'weekly';
  } else if (recurrence.monthlyPattern === 'FIRST_DAY') {
    frequency = 'monthly_first_day';
  } else if (recurrence.monthlyPattern === 'LAST_FRIDAY') {
    frequency = 'monthly_last_friday';
  } else {
    frequency = 'monthly';
  }

  return {
    frequency,
    interval: recurrence.interval || 1,
    ...(recurrence.frequency === 'DAILY'
      ? { weekdaysOnly: Boolean(recurrence.weekdaysOnly) }
      : {}),
    ...(recurrence.frequency === 'WEEKLY'
      ? { daysOfWeek: recurrence.daysOfWeek || [] }
      : {}),
    ...(recurrence.frequency === 'MONTHLY' && recurrence.dayOfMonth != null
      ? { dayOfMonth: recurrence.dayOfMonth }
      : {}),
    ...(recurrence.startsOn ? { startsOn: recurrence.startsOn } : {}),
    ...(recurrence.endsOn
      ? { endCondition: 'on_date', endDate: recurrence.endsOn }
      : {}),
  };
}

/**
 * Returns a human-readable description of a recurrence rule.
 */
export function formatRecurrenceRule(rule?: RecurrenceRule | null): string {
  if (!rule || !rule.frequency || rule.frequency === 'none') {
    return 'Does not repeat';
  }

  const { frequency, interval = 1, endCondition = 'never', occurrences = 5 } = rule;

  let desc = '';

  if (frequency === 'weekly_monday') {
    desc = 'Repeats weekly on Monday';
  } else if (frequency === 'monthly_first_day') {
    desc = 'Repeats monthly on the 1st day';
  } else if (frequency === 'monthly_last_friday') {
    desc = 'Repeats monthly on the last Friday';
  } else if (frequency === 'daily') {
    if (interval === 1) {
      desc = rule.weekdaysOnly ? 'Repeats every weekday' : 'Repeats daily';
    } else {
      desc = `Repeats every ${interval} days`;
    }
  } else if (frequency === 'weekly') {
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const days = rule.daysOfWeek || [];
    if (days.length > 0) {
      const selectedDays = days.map((day) => weekdayNames[day]).join(', ');
      desc = `Repeats every ${interval === 1 ? '' : `${interval} `}week${interval === 1 ? '' : 's'} on ${selectedDays}`;
    } else if (interval === 1) {
      desc = 'Repeats weekly';
    } else {
      desc = `Repeats every ${interval} weeks`;
    }
  } else if (frequency === 'monthly') {
    if (rule.dayOfMonth) {
      desc = `Repeats every ${interval === 1 ? '' : `${interval} `}month${interval === 1 ? '' : 's'} on day ${rule.dayOfMonth}`;
    } else if (interval === 1) {
      desc = 'Repeats monthly on the same day';
    } else {
      desc = `Repeats every ${interval} months`;
    }
  } else if (frequency === 'custom') {
    desc = `Repeats every ${interval} ${rule.customUnit || 'days'}`;
  } else {
    desc = `Repeats (${frequency})`;
  }

  if (endCondition === 'after') {
    desc += ` (ends after ${occurrences} occurrences)`;
  } else if (endCondition === 'on_date' && rule.endDate) {
    desc += ` (until ${rule.endDate})`;
  }

  return desc;
}

/**
 * Computes the last Friday of a given year and month (0-indexed).
 */
export function getLastFridayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const day = lastDay.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  const offset = (day - 5 + 7) % 7;
  const lastFridayDate = lastDay.getDate() - offset;
  return new Date(year, month, lastFridayDate);
}

/**
 * Computes the next occurrence date string strictly after baseDateStr according to the rule.
 */
export function computeNextOccurrenceDate(baseDateStr: string, rule: RecurrenceRule): string {
  const currentDate = parseLocalDate(baseDateStr);
  const freq = rule.frequency;

  if (freq === 'weekly_monday') {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1); // Advance at least 1 day
    const day = next.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const daysUntilMonday = (1 - day + 7) % 7;
    next.setDate(next.getDate() + daysUntilMonday);
    return formatLocalDate(next);
  }

  if (freq === 'monthly_first_day') {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    // Next 1st of month
    const next = new Date(y, m + 1, 1);
    return formatLocalDate(next);
  }

  if (freq === 'monthly_last_friday') {
    let targetYear = currentDate.getFullYear();
    let targetMonth = currentDate.getMonth();
    const thisMonthLastFriday = getLastFridayOfMonth(targetYear, targetMonth);
    const thisMonthLastFridayStr = formatLocalDate(thisMonthLastFriday);

    if (baseDateStr >= thisMonthLastFridayStr) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }
    const nextLastFriday = getLastFridayOfMonth(targetYear, targetMonth);
    return formatLocalDate(nextLastFriday);
  }

  if (freq === 'daily') {
    if (rule.weekdaysOnly) {
      return addBusinessDays(baseDateStr, rule.interval || 1);
    }
    const next = new Date(currentDate);
    next.setDate(next.getDate() + (rule.interval || 1));
    return formatLocalDate(next);
  }

  if (freq === 'weekly') {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7 * (rule.interval || 1));
    return formatLocalDate(next);
  }

  if (freq === 'monthly') {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + (rule.interval || 1));
    return formatLocalDate(next);
  }

  // fallback
  const next = new Date(currentDate);
  next.setDate(next.getDate() + (rule.interval || 1));
  return formatLocalDate(next);
}

/**
 * Bounded generator for next preview occurrences (default count = 5)
 */
export function generateNextOccurrences(task: Task, count: number = 5): RecurrenceOccurrence[] {
  const rule = task.recurrenceRule || (task.recurrence as RecurrenceRule);
  if (!rule || !rule.frequency || rule.frequency === 'none') return [];

  let currentBaseStr = task.dueDate || task.startDate || formatLocalDate(new Date());
  const occurrences: RecurrenceOccurrence[] = [];

  for (let i = 1; i <= count; i++) {
    const nextDateStr = computeNextOccurrenceDate(currentBaseStr, rule);
    occurrences.push({
      occurrenceNumber: i,
      date: nextDateStr,
    });
    currentBaseStr = nextDateStr;
  }

  return occurrences;
}

/**
 * Evaluates whether a task relates to targetDateStr and returns its contextual label.
 * Returns null if task has no relation to targetDateStr.
 */
export function getTaskDateContext(task: Task, targetDateStr: string): string | null {
  const hasStart = Boolean(task.startDate);
  const hasDue = Boolean(task.dueDate);

  if (hasStart && hasDue) {
    if (task.startDate === targetDateStr && task.dueDate === targetDateStr) {
      return 'Starts & Due today';
    }
    if (task.startDate === targetDateStr) {
      return 'Starts today';
    }
    if (task.dueDate === targetDateStr) {
      return 'Due today';
    }
    if (task.startDate! < targetDateStr && targetDateStr < task.dueDate!) {
      return 'In progress across this date';
    }
  } else if (hasDue && task.dueDate === targetDateStr) {
    return 'Due today';
  } else if (hasStart && task.startDate === targetDateStr) {
    return 'Starts today';
  }

  // Check generated preview occurrences if recurring
  const rule = task.recurrenceRule || (task.recurrence as RecurrenceRule);
  if (rule && rule.frequency && rule.frequency !== 'none') {
    const occurrences = generateNextOccurrences(task, 8);
    if (occurrences.some((occ) => occ.date === targetDateStr)) {
      return 'Recurring occurrence';
    }
  }

  return null;
}
