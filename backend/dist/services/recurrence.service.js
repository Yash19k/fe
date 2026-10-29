"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDueRecurrences = exports.getInitialOccurrenceRunAt = exports.getNextOccurrenceDate = exports.getRecurrenceRunAt = exports.validateRecurrence = exports.DEFAULT_RECURRENCE_TIMEZONE = exports.RECURRENCE_TIME_OF_DAY = void 0;
const data_source_1 = require("../config/data.source");
const app_error_1 = require("../errors/app.error");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const work_item_recurrence_entity_1 = require("../entities/work.item.recurrence.entity");
const work_item_occurrence_entity_1 = require("../entities/work.item.occurrence.entity");
const organization_sla_entity_1 = require("../entities/organization.sla.entity");
const sla_service_1 = require("./sla.service");
exports.RECURRENCE_TIME_OF_DAY = "09:00";
exports.DEFAULT_RECURRENCE_TIMEZONE = "Asia/Kolkata";
const isValidDateOnly = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validateRecurrence = (input, workItemType) => {
    if (workItemType === work_item_entity_1.WorkItemType.EPIC) {
        throw new app_error_1.AppError("Recurring work items cannot be EPIC type", 400, "INVALID_RECURRENCE_WORK_ITEM_TYPE");
    }
    if (!Object.values(work_item_recurrence_entity_1.RecurrenceFrequency).includes(input.frequency)) {
        throw new app_error_1.AppError("Invalid recurrence frequency", 400, "INVALID_RECURRENCE_FREQUENCY");
    }
    const interval = input.interval ?? 1;
    if (!Number.isInteger(interval) || interval < 1) {
        throw new app_error_1.AppError("Recurrence interval must be a positive integer", 400, "INVALID_RECURRENCE_INTERVAL");
    }
    if (!isValidDateOnly(input.startsOn)) {
        throw new app_error_1.AppError("startsOn must be a valid YYYY-MM-DD date", 400, "INVALID_RECURRENCE_START_DATE");
    }
    if (input.endsOn != null && (!isValidDateOnly(input.endsOn) || input.endsOn < input.startsOn)) {
        throw new app_error_1.AppError("endsOn must be a valid date on or after startsOn", 400, "INVALID_RECURRENCE_END_DATE");
    }
    const timezone = input.timezone ?? exports.DEFAULT_RECURRENCE_TIMEZONE;
    if (timezone !== exports.DEFAULT_RECURRENCE_TIMEZONE) {
        throw new app_error_1.AppError("Recurring work items are scheduled at 09:00 Asia/Kolkata time", 400, "INVALID_RECURRENCE_TIMEZONE");
    }
    if (input.frequency !== work_item_recurrence_entity_1.RecurrenceFrequency.DAILY && input.weekdaysOnly) {
        throw new app_error_1.AppError("weekdaysOnly is only valid for daily recurrence", 400, "INVALID_RECURRENCE_FIELDS");
    }
    if (input.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.WEEKLY) {
        const days = input.daysOfWeek;
        if (!Array.isArray(days) || days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || new Set(days).size !== days.length) {
            throw new app_error_1.AppError("Weekly recurrence requires unique daysOfWeek values from 0 to 6", 400, "INVALID_RECURRENCE_DAYS");
        }
        if (input.monthlyPattern != null || input.dayOfMonth != null) {
            throw new app_error_1.AppError("Monthly recurrence fields cannot be used for weekly recurrence", 400, "INVALID_RECURRENCE_FIELDS");
        }
        return;
    }
    if (input.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.DAILY) {
        if ((input.daysOfWeek != null && input.daysOfWeek.length > 0) || input.monthlyPattern != null || input.dayOfMonth != null) {
            throw new app_error_1.AppError("Daily recurrence cannot contain weekly or monthly fields", 400, "INVALID_RECURRENCE_FIELDS");
        }
        return;
    }
    if (!input.monthlyPattern || !Object.values(work_item_recurrence_entity_1.MonthlyPattern).includes(input.monthlyPattern)) {
        throw new app_error_1.AppError("Monthly recurrence requires a valid monthlyPattern", 400, "INVALID_MONTHLY_PATTERN");
    }
    if (input.daysOfWeek != null && input.daysOfWeek.length > 0) {
        throw new app_error_1.AppError("daysOfWeek cannot be used for monthly recurrence", 400, "INVALID_RECURRENCE_FIELDS");
    }
    if (input.monthlyPattern === work_item_recurrence_entity_1.MonthlyPattern.DAY_OF_MONTH) {
        if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
            throw new app_error_1.AppError("DAY_OF_MONTH requires dayOfMonth between 1 and 31", 400, "INVALID_DAY_OF_MONTH");
        }
    }
    else if (input.dayOfMonth != null) {
        throw new app_error_1.AppError("dayOfMonth is only valid with DAY_OF_MONTH", 400, "UNEXPECTED_DAY_OF_MONTH");
    }
};
exports.validateRecurrence = validateRecurrence;
const toUtcDate = (dateOnly) => new Date(`${dateOnly}T00:00:00.000Z`);
const toDateOnly = (date) => date.toISOString().slice(0, 10);
const getDateOnlyInTimezone = (date, timezone) => {
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
const getRecurrenceRunAt = (dateOnly, timezone) => {
    const [hour, minute] = exports.RECURRENCE_TIME_OF_DAY.split(":").map(Number);
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
        const representedLocalAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
        const difference = desiredLocalAsUtc - representedLocalAsUtc;
        candidate += difference;
        if (difference === 0)
            break;
    }
    return new Date(candidate);
};
exports.getRecurrenceRunAt = getRecurrenceRunAt;
const addDays = (dateOnly, days) => {
    const date = toUtcDate(dateOnly);
    date.setUTCDate(date.getUTCDate() + days);
    return toDateOnly(date);
};
const isEligibleDate = (rule, dateOnly) => {
    if (dateOnly < rule.startsOn || (rule.endsOn && dateOnly > rule.endsOn))
        return false;
    const date = toUtcDate(dateOnly);
    const start = toUtcDate(rule.startsOn);
    const interval = rule.interval || 1;
    if (rule.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.DAILY) {
        const dayDifference = Math.floor((date.getTime() - start.getTime()) / 86400000);
        const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
        return dayDifference >= 0 && dayDifference % interval === 0 && !(rule.weekdaysOnly && isWeekend);
    }
    if (rule.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.WEEKLY) {
        const startWeek = new Date(start);
        startWeek.setUTCDate(startWeek.getUTCDate() - startWeek.getUTCDay());
        const dateWeek = new Date(date);
        dateWeek.setUTCDate(dateWeek.getUTCDate() - dateWeek.getUTCDay());
        const weekDifference = Math.floor((dateWeek.getTime() - startWeek.getTime()) / (7 * 86400000));
        return weekDifference >= 0 && weekDifference % interval === 0 && (rule.daysOfWeek ?? []).includes(date.getUTCDay());
    }
    const monthDifference = (date.getUTCFullYear() - start.getUTCFullYear()) * 12 + date.getUTCMonth() - start.getUTCMonth();
    if (monthDifference < 0 || monthDifference % interval !== 0)
        return false;
    if (rule.monthlyPattern === work_item_recurrence_entity_1.MonthlyPattern.DAY_OF_MONTH) {
        return date.getUTCDate() === rule.dayOfMonth;
    }
    if (rule.monthlyPattern === work_item_recurrence_entity_1.MonthlyPattern.FIRST_DAY) {
        return date.getUTCDate() === 1;
    }
    // LAST_FRIDAY: Friday whose next Friday would be in the following month.
    return date.getUTCDay() === 5 && date.getUTCDate() + 7 > new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};
const getNextOccurrenceDate = (rule, afterDate) => {
    // A bounded search protects the worker from malformed rules or unreasonable dates.
    for (let offset = 1; offset <= 36600; offset += 1) {
        const candidate = addDays(afterDate, offset);
        if (rule.endsOn && candidate > rule.endsOn)
            return null;
        if (isEligibleDate(rule, candidate))
            return candidate;
    }
    return null;
};
exports.getNextOccurrenceDate = getNextOccurrenceDate;
/** Find the first eligible 09:00 occurrence that has not already passed. */
const getInitialOccurrenceRunAt = (rule, now = new Date()) => {
    const timezone = rule.timezone || exports.DEFAULT_RECURRENCE_TIMEZONE;
    const todayInTimezone = getDateOnlyInTimezone(now, timezone);
    for (let offset = 0; offset <= 36600; offset += 1) {
        const candidate = addDays(rule.startsOn, offset);
        if (rule.endsOn && candidate > rule.endsOn)
            return null;
        // The original task already exists. Do not create a duplicate occurrence
        // for today; the first generated instance must be on a future date.
        if (candidate <= todayInTimezone || !isEligibleDate(rule, candidate))
            continue;
        const runAt = (0, exports.getRecurrenceRunAt)(candidate, timezone);
        if (runAt.getTime() > now.getTime())
            return runAt;
    }
    return null;
};
exports.getInitialOccurrenceRunAt = getInitialOccurrenceRunAt;
const initializeGeneratedTaskSla = async (manager, task, actorId) => {
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
        await manager.getRepository(work_item_entity_1.WorkItem).save(task);
        return;
    }
    const policy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
        where: { organizationId: task.organizationId },
    });
    task.slaDeadline = (0, sla_service_1.calculateSlaDeadline)(task.createdAt, task.priority, policy);
    task.slaDeadlineIsCustom = false;
    (0, sla_service_1.applySlaState)(task, new Date(), policy);
    await manager.getRepository(work_item_entity_1.WorkItem).save(task);
    await (0, sla_service_1.writeSlaAudit)(manager, task, actorId, "sla_initialized", "Initialized SLA for recurring work item", null, {
        deadline: task.slaDeadline,
        status: task.slaStatus,
        custom: false,
    });
};
const processOneDueRecurrence = async () => data_source_1.AppDataSource.transaction(async (manager) => {
    const recurrence = await manager.getRepository(work_item_recurrence_entity_1.WorkItemRecurrence)
        .createQueryBuilder("recurrence")
        .innerJoinAndSelect("recurrence.workItem", "template")
        .where("recurrence.isActive = :active", { active: true })
        .andWhere("recurrence.nextRunAt IS NOT NULL")
        .andWhere("recurrence.nextRunAt <= :now", { now: new Date() })
        .orderBy("recurrence.nextRunAt", "ASC")
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getOne();
    if (!recurrence)
        return false;
    const scheduledFor = getDateOnlyInTimezone(recurrence.nextRunAt, recurrence.timezone || exports.DEFAULT_RECURRENCE_TIMEZONE);
    const template = recurrence.workItem;
    // Existing occurrence means this date has already been processed; still advance the rule.
    const existingOccurrence = await manager.getRepository(work_item_occurrence_entity_1.WorkItemOccurrence).findOne({
        where: { recurrenceId: recurrence.id, scheduledFor },
        select: { id: true },
    });
    if (!existingOccurrence && (!recurrence.endsOn || scheduledFor <= recurrence.endsOn)) {
        const taskRepository = manager.getRepository(work_item_entity_1.WorkItem);
        const generatedTask = await taskRepository.save(taskRepository.create({
            organizationId: template.organizationId,
            projectId: template.projectId,
            createdById: template.createdById,
            parentWorkItemId: template.parentWorkItemId,
            type: template.type,
            title: template.title,
            description: template.description,
            status: work_item_entity_1.WorkItemStatus.BACKLOG,
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
        const templateAssignments = await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
            where: { workItemId: template.id },
        });
        if (templateAssignments.length > 0) {
            await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).save(templateAssignments.map((assignment) => manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).create({
                workItemId: generatedTask.id,
                userId: assignment.userId,
                assignedById: template.createdById,
                startDate: null,
                estimatedHours: assignment.estimatedHours,
            })));
        }
        await manager.getRepository(work_item_occurrence_entity_1.WorkItemOccurrence).save(manager.getRepository(work_item_occurrence_entity_1.WorkItemOccurrence).create({
            recurrenceId: recurrence.id,
            scheduledFor,
            workItemId: generatedTask.id,
        }));
    }
    const nextDate = (0, exports.getNextOccurrenceDate)(recurrence, scheduledFor);
    if (!nextDate || (recurrence.endsOn && nextDate > recurrence.endsOn)) {
        recurrence.isActive = false;
        recurrence.nextRunAt = null;
    }
    else {
        recurrence.nextRunAt = (0, exports.getRecurrenceRunAt)(nextDate, recurrence.timezone || exports.DEFAULT_RECURRENCE_TIMEZONE);
        recurrence.timeOfDay = exports.RECURRENCE_TIME_OF_DAY;
    }
    await manager.getRepository(work_item_recurrence_entity_1.WorkItemRecurrence).save(recurrence);
    return true;
});
/** Process due recurring tasks. Call this from the existing Croner scheduler. */
const processDueRecurrences = async (batchSize = 25) => {
    let processed = 0;
    while (processed < batchSize) {
        const didProcess = await processOneDueRecurrence();
        if (!didProcess)
            break;
        processed += 1;
    }
    return processed;
};
exports.processDueRecurrences = processDueRecurrences;
