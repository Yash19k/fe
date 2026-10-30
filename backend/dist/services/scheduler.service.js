"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
exports.stopScheduler = stopScheduler;
const croner_1 = require("croner");
const data_source_1 = require("../config/data.source");
const app_error_1 = require("../errors/app.error");
const recurrence_service_1 = require("./recurrence.service");
const sla_service_1 = require("./sla.service");
const notification_service_1 = require("./notification.service");
let slaScheduler;
let recurrenceScheduler;
let isSlaJobRunning = false;
let isRecurrenceJobRunning = false;
const schedulerErrorLogIntervalMs = 5 * 60 * 1000;
const schedulerErrorLogs = new Map();
function logSchedulerFailure(schedulerName, error) {
    const now = Date.now();
    const previous = schedulerErrorLogs.get(schedulerName);
    if (previous && now - previous.lastLoggedAt < schedulerErrorLogIntervalMs) {
        previous.suppressedCount += 1;
        return;
    }
    const suppressedCount = previous?.suppressedCount ?? 0;
    console.error(`[${schedulerName}] Job failed${suppressedCount > 0 ? ` (${suppressedCount} repeated failures suppressed)` : ""}:`, error);
    schedulerErrorLogs.set(schedulerName, {
        lastLoggedAt: now,
        suppressedCount: 0,
    });
}
function startScheduler() {
    if (!data_source_1.AppDataSource.isInitialized) {
        throw new app_error_1.AppError("Database must be initialized before starting the scheduler", 500);
    }
    if (slaScheduler || recurrenceScheduler) {
        return;
    }
    // SLA state is refreshed every minute.
    slaScheduler = new croner_1.Cron("* * * * *", {
        name: "sla-status-refresh",
        protect: true,
    }, async () => {
        if (isSlaJobRunning)
            return;
        isSlaJobRunning = true;
        try {
            const result = await data_source_1.AppDataSource.transaction(async (manager) => (0, sla_service_1.refreshSlaStatuses)(manager));
            await (0, notification_service_1.createNotificationsBestEffort)(result.notifications, {
                operation: "sla-refresh",
            });
            console.info(`[SLA Scheduler] Completed. Updated ${result.updatedCount} work items.`);
        }
        catch (error) {
            logSchedulerFailure("SLA Scheduler", error);
        }
        finally {
            isSlaJobRunning = false;
        }
    });
    // Process recurring tasks automatically every minute whenever nextRunAt <= now.
    recurrenceScheduler = new croner_1.Cron("* * * * *", {
        name: "recurring-work-item-processor",
        protect: true,
    }, async () => {
        if (isRecurrenceJobRunning)
            return;
        isRecurrenceJobRunning = true;
        try {
            const processedCount = await (0, recurrence_service_1.processDueRecurrences)(25);
            if (processedCount > 0) {
                console.info(`[Recurrence Scheduler] Completed. Processed ${processedCount} due recurrences.`);
            }
        }
        catch (error) {
            logSchedulerFailure("Recurrence Scheduler", error);
        }
        finally {
            isRecurrenceJobRunning = false;
        }
    });
    console.info("[Scheduler] SLA and recurrence schedulers started.");
}
function stopScheduler() {
    slaScheduler?.stop();
    recurrenceScheduler?.stop();
    slaScheduler = undefined;
    recurrenceScheduler = undefined;
    console.info("[Scheduler] SLA and recurrence schedulers stopped.");
}
