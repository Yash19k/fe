import { Cron } from "croner";

import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import { processDueRecurrences } from "./recurrence.service";
import { refreshSlaStatuses } from "./sla.service";
import { createNotificationsBestEffort } from "./notification.service";

let slaScheduler: Cron | undefined;
let recurrenceScheduler: Cron | undefined;
let activeSlaJob: Promise<void> | undefined;
let activeRecurrenceJob: Promise<void> | undefined;
let isSchedulerStopping = false;
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
    `[${schedulerName}] Job failed${suppressedCount > 0 ? ` (${suppressedCount} repeated failures suppressed)` : ""}.`,
    { name: error instanceof Error ? error.name : "UnknownError" },
  );
  schedulerErrorLogs.set(schedulerName, {
    lastLoggedAt: now,
    suppressedCount: 0,
  });
}

export function startScheduler(): void {
  if (isSchedulerStopping) {
    throw new AppError("Scheduler is stopping and cannot be restarted", 503);
  }

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
    () => {
      if (isSchedulerStopping || activeSlaJob) return;

      const job = (async () => {
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
        }
      })();
      activeSlaJob = job;
      void job.then(() => {
        if (activeSlaJob === job) activeSlaJob = undefined;
      });
      return job;
    },
  );

  // Process recurring tasks automatically every minute whenever nextRunAt <= now.
  recurrenceScheduler = new Cron(
    "* * * * *",
    {
      name: "recurring-work-item-processor",
      protect: true,
    },
    () => {
      if (isSchedulerStopping || activeRecurrenceJob) return;

      const job = (async () => {
        try {
          const processedCount = await processDueRecurrences(25);
          if (processedCount > 0) {
            console.info(
              `[Recurrence Scheduler] Completed. Processed ${processedCount} due recurrences.`,
            );
          }
        } catch (error) {
          logSchedulerFailure("Recurrence Scheduler", error);
        }
      })();
      activeRecurrenceJob = job;
      void job.then(() => {
        if (activeRecurrenceJob === job) activeRecurrenceJob = undefined;
      });
      return job;
    },
  );

  console.info("[Scheduler] SLA and recurrence schedulers started.");
}

export async function stopScheduler(): Promise<void> {
  isSchedulerStopping = true;

  const stopFailures: string[] = [];
  try {
    slaScheduler?.stop();
  } catch (error) {
    logSchedulerFailure("SLA scheduler shutdown", error);
    stopFailures.push("SLA");
  }
  try {
    recurrenceScheduler?.stop();
  } catch (error) {
    logSchedulerFailure("Recurrence scheduler shutdown", error);
    stopFailures.push("recurrence");
  }
  slaScheduler = undefined;
  recurrenceScheduler = undefined;

  await Promise.all(
    [activeSlaJob, activeRecurrenceJob].filter(
      (job): job is Promise<void> => job !== undefined,
    ),
  );

  if (stopFailures.length > 0) {
    throw new Error(
      `Unable to stop ${stopFailures.join(" and ")} scheduler job(s).`,
    );
  }

  console.info("[Scheduler] SLA and recurrence schedulers stopped.");
}
