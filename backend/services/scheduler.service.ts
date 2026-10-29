import { Cron } from "croner";

import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import { processDueRecurrences } from "./recurrence.service";
import { refreshSlaStatuses } from "./sla.service";
import { createNotificationsBestEffort } from "./notification.service";

let slaScheduler: Cron | undefined;
let recurrenceScheduler: Cron | undefined;
let isSlaJobRunning = false;
let isRecurrenceJobRunning = false;
const schedulerErrorLogIntervalMs = 5 * 60 * 1000;
const schedulerErrorLogs = new Map<
  string,
  { lastLoggedAt: number; suppressedCount: number }
>();

function logSchedulerFailure(schedulerName: string, error: unknown): void {
  const now = Date.now();
  const previous = schedulerErrorLogs.get(schedulerName);

  if (previous && now - previous.lastLoggedAt < schedulerErrorLogIntervalMs) {
    previous.suppressedCount += 1;
    return;
  }

  const suppressedCount = previous?.suppressedCount ?? 0;
  console.error(
    `[${schedulerName}] Job failed${suppressedCount > 0 ? ` (${suppressedCount} repeated failures suppressed)` : ""}:`,
    error,
  );
  schedulerErrorLogs.set(schedulerName, {
    lastLoggedAt: now,
    suppressedCount: 0,
  });
}

export function startScheduler(): void {
  if (!AppDataSource.isInitialized) {
    throw new AppError(
      "Database must be initialized before starting the scheduler",
      500,
    );
  }

  if (slaScheduler || recurrenceScheduler) {
    return;
  }

  // SLA state is refreshed every minute.
  slaScheduler = new Cron(
    "* * * * *",
    {
      name: "sla-status-refresh",
      protect: true,
    },
    async () => {
      if (isSlaJobRunning) return;

      isSlaJobRunning = true;
      try {
        const result = await AppDataSource.transaction(
          async (manager) => refreshSlaStatuses(manager),
        );
        await createNotificationsBestEffort(result.notifications, {
          operation: "sla-refresh",
        });

        console.info(
          `[SLA Scheduler] Completed. Updated ${result.updatedCount} work items.`,
        );
      } catch (error) {
        logSchedulerFailure("SLA Scheduler", error);
      } finally {
        isSlaJobRunning = false;
      }
    },
  );

  // Process recurring tasks automatically every minute whenever nextRunAt <= now.
  recurrenceScheduler = new Cron(
    "* * * * *",
    {
      name: "recurring-work-item-processor",
      protect: true,
    },
    async () => {
      if (isRecurrenceJobRunning) return;

      isRecurrenceJobRunning = true;
      try {
        const processedCount = await processDueRecurrences(25);
        if (processedCount > 0) {
          console.info(
            `[Recurrence Scheduler] Completed. Processed ${processedCount} due recurrences.`,
          );
        }
      } catch (error) {
        logSchedulerFailure("Recurrence Scheduler", error);
      } finally {
        isRecurrenceJobRunning = false;
      }
    },
  );

  console.info("[Scheduler] SLA and recurrence schedulers started.");
}

export function stopScheduler(): void {
  slaScheduler?.stop();
  recurrenceScheduler?.stop();

  slaScheduler = undefined;
  recurrenceScheduler = undefined;

  console.info("[Scheduler] SLA and recurrence schedulers stopped.");
}
