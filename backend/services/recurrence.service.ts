import { EntityManager } from "typeorm";

import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import { WorkItem, WorkItemPriority, WorkItemStatus, WorkItemType } from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import {
  MonthlyPattern,
  RecurrenceFrequency,
  WorkItemRecurrence,
} from "../entities/work.item.recurrence.entity";
import { WorkItemOccurrence } from "../entities/work.item.occurrence.entity";
import { OrganizationSla } from "../entities/organization.sla.entity";
import {
  applySlaState,
  calculateSlaDeadline,
  writeSlaAudit,
} from "./sla.service";

export const RECURRENCE_TIME_OF_DAY = "09:00";
export const DEFAULT_RECURRENCE_TIMEZONE = "Asia/Kolkata";

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[] | null;
  monthlyPattern?: MonthlyPattern | null;
  dayOfMonth?: number | null;
  startsOn: string;
  endsOn?: string | null;
  timezone?: string;
  /** When enabled for DAILY recurrence, skip Saturday and Sunday. */
  weekdaysOnly?: boolean;
}

const isValidDateOnly = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const validateRecurrence = (input: RecurrenceInput, workItemType?: WorkItemType): void => {
  if (workItemType === WorkItemType.EPIC) {
    throw new AppError("Recurring work items cannot be EPIC type", 400, "INVALID_RECURRENCE_WORK_ITEM_TYPE");
  }

  if (!Object.values(RecurrenceFrequency).includes(input.frequency)) {
    throw new AppError("Invalid recurrence frequency", 400, "INVALID_RECURRENCE_FREQUENCY");
  }

  const interval = input.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new AppError("Recurrence interval must be a positive integer", 400, "INVALID_RECURRENCE_INTERVAL");
  }

  if (!isValidDateOnly(input.startsOn)) {
    throw new AppError("startsOn must be a valid YYYY-MM-DD date", 400, "INVALID_RECURRENCE_START_DATE");
  }

  if (input.endsOn != null && (!isValidDateOnly(input.endsOn) || input.endsOn < input.startsOn)) {
    throw new AppError("endsOn must be a valid date on or after startsOn", 400, "INVALID_RECURRENCE_END_DATE");
  }

  const timezone = input.timezone ?? DEFAULT_RECURRENCE_TIMEZONE;
  if (timezone !== DEFAULT_RECURRENCE_TIMEZONE) {
    throw new AppError(
      "Recurring work items are scheduled at 09:00 Asia/Kolkata time",
      400,
      "INVALID_RECURRENCE_TIMEZONE",
    );
  }

  if (input.frequency !== RecurrenceFrequency.DAILY && input.weekdaysOnly) {
    throw new AppError("weekdaysOnly is only valid for daily recurrence", 400, "INVALID_RECURRENCE_FIELDS");
  }

  if (input.frequency === RecurrenceFrequency.WEEKLY) {
    const days = input.daysOfWeek;
    if (!Array.isArray(days) || days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || new Set(days).size !== days.length) {
      throw new AppError("Weekly recurrence requires unique daysOfWeek values from 0 to 6", 400, "INVALID_RECURRENCE_DAYS");
    }
    if (input.monthlyPattern != null || input.dayOfMonth != null) {
      throw new AppError("Monthly recurrence fields cannot be used for weekly recurrence", 400, "INVALID_RECURRENCE_FIELDS");
    }
    return;
  }

  if (input.frequency === RecurrenceFrequency.DAILY) {
    if ((input.daysOfWeek != null && input.daysOfWeek.length > 0) || input.monthlyPattern != null || input.dayOfMonth != null) {
      throw new AppError("Daily recurrence cannot contain weekly or monthly fields", 400, "INVALID_RECURRENCE_FIELDS");
    }
    return;
  }

  if (!input.monthlyPattern || !Object.values(MonthlyPattern).includes(input.monthlyPattern)) {
    throw new AppError("Monthly recurrence requires a valid monthlyPattern", 400, "INVALID_MONTHLY_PATTERN");
  }
  if (input.daysOfWeek != null && input.daysOfWeek.length > 0) {
    throw new AppError("daysOfWeek cannot be used for monthly recurrence", 400, "INVALID_RECURRENCE_FIELDS");
  }
  if (input.monthlyPattern === MonthlyPattern.DAY_OF_MONTH) {
    if (!Number.isInteger(input.dayOfMonth) || (input.dayOfMonth as number) < 1 || (input.dayOfMonth as number) > 31) {
      throw new AppError("DAY_OF_MONTH requires dayOfMonth between 1 and 31", 400, "INVALID_DAY_OF_MONTH");
    }
  } else if (input.dayOfMonth != null) {
    throw new AppError("dayOfMonth is only valid with DAY_OF_MONTH", 400, "UNEXPECTED_DAY_OF_MONTH");
  }
};

const toUtcDate = (dateOnly: string): Date => new Date(`${dateOnly}T00:00:00.000Z`);
const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const getDateOnlyInTimezone = (date: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/** Convert a local calendar date at the fixed 09:00 time into its UTC instant. */
export const getRecurrenceRunAt = (
  dateOnly: string,
  timezone: string,
): Date => {
  const [hour, minute] = RECURRENCE_TIME_OF_DAY.split(":").map(Number);
  const date = toUtcDate(dateOnly);
  date.setUTCHours(hour, minute, 0, 0);
  const desiredLocalAsUtc = date.getTime();
  let candidate = desiredLocalAsUtc;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  // Recalculate the offset a couple of times so daylight-saving offsets are handled.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedLocalAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    const difference = desiredLocalAsUtc - representedLocalAsUtc;
    candidate += difference;
    if (difference === 0) break;
  }
  return new Date(candidate);
};

const addDays = (dateOnly: string, days: number): string => {
  const date = toUtcDate(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
};

const isEligibleDate = (rule: WorkItemRecurrence, dateOnly: string): boolean => {
  if (dateOnly < rule.startsOn || (rule.endsOn && dateOnly > rule.endsOn)) return false;

  const date = toUtcDate(dateOnly);
  const start = toUtcDate(rule.startsOn);
  const interval = rule.interval || 1;

  if (rule.frequency === RecurrenceFrequency.DAILY) {
    const dayDifference = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    return dayDifference >= 0 && dayDifference % interval === 0 && !(rule.weekdaysOnly && isWeekend);
  }

  if (rule.frequency === RecurrenceFrequency.WEEKLY) {
    const startWeek = new Date(start);
    startWeek.setUTCDate(startWeek.getUTCDate() - startWeek.getUTCDay());
    const dateWeek = new Date(date);
    dateWeek.setUTCDate(dateWeek.getUTCDate() - dateWeek.getUTCDay());
    const weekDifference = Math.floor((dateWeek.getTime() - startWeek.getTime()) / (7 * 86_400_000));
    return weekDifference >= 0 && weekDifference % interval === 0 && (rule.daysOfWeek ?? []).includes(date.getUTCDay());
  }

  const monthDifference = (date.getUTCFullYear() - start.getUTCFullYear()) * 12 + date.getUTCMonth() - start.getUTCMonth();
  if (monthDifference < 0 || monthDifference % interval !== 0) return false;

  if (rule.monthlyPattern === MonthlyPattern.DAY_OF_MONTH) {
    return date.getUTCDate() === rule.dayOfMonth;
  }
  if (rule.monthlyPattern === MonthlyPattern.FIRST_DAY) {
    return date.getUTCDate() === 1;
  }
  // LAST_FRIDAY: Friday whose next Friday would be in the following month.
  return date.getUTCDay() === 5 && date.getUTCDate() + 7 > new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

export const getNextOccurrenceDate = (rule: WorkItemRecurrence, afterDate: string): string | null => {
  // A bounded search protects the worker from malformed rules or unreasonable dates.
  for (let offset = 1; offset <= 36_600; offset += 1) {
    const candidate = addDays(afterDate, offset);
    if (rule.endsOn && candidate > rule.endsOn) return null;
    if (isEligibleDate(rule, candidate)) return candidate;
  }
  return null;
};

/** Find the first eligible 09:00 occurrence that has not already passed. */
export const getInitialOccurrenceRunAt = (
  rule: WorkItemRecurrence,
  now = new Date(),
): Date | null => {
  const timezone = rule.timezone || DEFAULT_RECURRENCE_TIMEZONE;
  const todayInTimezone = getDateOnlyInTimezone(now, timezone);

  for (let offset = 0; offset <= 36_600; offset += 1) {
    const candidate = addDays(rule.startsOn, offset);
    if (rule.endsOn && candidate > rule.endsOn) return null;

    // The original task already exists. Do not create a duplicate occurrence
    // for today; the first generated instance must be on a future date.
    if (candidate <= todayInTimezone || !isEligibleDate(rule, candidate)) continue;

    const runAt = getRecurrenceRunAt(candidate, timezone);
    if (runAt.getTime() > now.getTime()) return runAt;
  }
  return null;
};

const initializeGeneratedTaskSla = async (manager: EntityManager, task: WorkItem, actorId: string): Promise<void> => {
  // A task without a priority must not receive an SLA deadline or escalation state.
  if (!task.priority) {
    task.slaDeadline = null;
    task.slaStatus = null;
    task.slaDeadlineIsCustom = false;
    task.escalatedAt = null;
    task.escalatedById = null;
    task.escalationReason = null;
    task.slaBreachedAt = null;
    task.slaResolvedAt = null;
    await manager.getRepository(WorkItem).save(task);
    return;
  }

  const policy = await manager.getRepository(OrganizationSla).findOne({
    where: { organizationId: task.organizationId },
  });

  task.slaDeadline = calculateSlaDeadline(task.createdAt, task.priority as WorkItemPriority, policy);
  task.slaDeadlineIsCustom = false;
  applySlaState(task, new Date(), policy);
  await manager.getRepository(WorkItem).save(task);
  await writeSlaAudit(manager, task, actorId, "sla_initialized", "Initialized SLA for recurring work item", null, {
    deadline: task.slaDeadline,
    status: task.slaStatus,
    custom: false,
  });
};

const processOneDueRecurrence = async (): Promise<boolean> => AppDataSource.transaction(async (manager) => {
  const recurrence = await manager.getRepository(WorkItemRecurrence)
    .createQueryBuilder("recurrence")
    .innerJoinAndSelect("recurrence.workItem", "template")
    .where("recurrence.isActive = :active", { active: true })
    .andWhere("recurrence.nextRunAt IS NOT NULL")
    .andWhere("recurrence.nextRunAt <= :now", { now: new Date() })
    .orderBy("recurrence.nextRunAt", "ASC")
    .setLock("pessimistic_write")
    .setOnLocked("skip_locked")
    .getOne();

  if (!recurrence) return false;

  const scheduledFor = getDateOnlyInTimezone(recurrence.nextRunAt as Date, recurrence.timezone || DEFAULT_RECURRENCE_TIMEZONE);
  const template = recurrence.workItem;

  // Existing occurrence means this date has already been processed; still advance the rule.
  const existingOccurrence = await manager.getRepository(WorkItemOccurrence).findOne({
    where: { recurrenceId: recurrence.id, scheduledFor },
    select: { id: true },
  });

  if (!existingOccurrence && (!recurrence.endsOn || scheduledFor <= recurrence.endsOn)) {
    const taskRepository = manager.getRepository(WorkItem);
    const generatedTask = await taskRepository.save(taskRepository.create({
      organizationId: template.organizationId,
      projectId: template.projectId,
      createdById: template.createdById,
      parentWorkItemId: template.parentWorkItemId,
      type: template.type,
      title: template.title,
      description: template.description,
      status: WorkItemStatus.BACKLOG,
      priority: template.priority,
      dueDate: null,
      slaDeadline: null,
      slaStatus: null,
      slaDeadlineIsCustom: false,
      escalatedAt: null,
      escalatedById: null,
      escalationReason: null,
      slaBreachedAt: null,
      slaResolvedAt: null,
      sprintId: null,
    }));

    await initializeGeneratedTaskSla(manager, generatedTask, template.createdById);

    const templateAssignments = await manager.getRepository(WorkItemAssignee).find({
      where: { workItemId: template.id },
    });
    if (templateAssignments.length > 0) {
      await manager.getRepository(WorkItemAssignee).save(templateAssignments.map((assignment) =>
        manager.getRepository(WorkItemAssignee).create({
          workItemId: generatedTask.id,
          userId: assignment.userId,
          assignedById: template.createdById,
          startDate: null,
          estimatedHours: assignment.estimatedHours,
        }),
      ));
    }

    await manager.getRepository(WorkItemOccurrence).save(manager.getRepository(WorkItemOccurrence).create({
      recurrenceId: recurrence.id,
      scheduledFor,
      workItemId: generatedTask.id,
    }));
  }

  const nextDate = getNextOccurrenceDate(recurrence, scheduledFor);
  if (!nextDate || (recurrence.endsOn && nextDate > recurrence.endsOn)) {
    recurrence.isActive = false;
    recurrence.nextRunAt = null;
  } else {
    recurrence.nextRunAt = getRecurrenceRunAt(
      nextDate,
      recurrence.timezone || DEFAULT_RECURRENCE_TIMEZONE,
    );
    recurrence.timeOfDay = RECURRENCE_TIME_OF_DAY;
  }
  await manager.getRepository(WorkItemRecurrence).save(recurrence);
  return true;
});

/** Process due recurring tasks. Call this from the existing Croner scheduler. */
export const processDueRecurrences = async (batchSize = 25): Promise<number> => {
  let processed = 0;
  while (processed < batchSize) {
    const didProcess = await processOneDueRecurrence();
    if (!didProcess) break;
    processed += 1;
  }
  return processed;
};
