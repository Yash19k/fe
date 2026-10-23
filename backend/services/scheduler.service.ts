import { Cron } from "croner";

import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import { processDueRecurrences } from "./recurrence.service";
import { refreshSlaStatuses } from "./sla.service";

let slaScheduler: Cron | undefined;
let recurrenceScheduler: Cron | undefined;
let isSlaJobRunning = false;
let isRecurrenceJobRunning = false;

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
        const updatedCount = await AppDataSource.transaction(
          async (manager) => refreshSlaStatuses(manager),
        );

        console.info(
          `[SLA Scheduler] Completed. Updated ${updatedCount} work items.`,
        );
      } finally {
        isSlaJobRunning = false;
      }
    },
  );

  // Generate recurring tasks at 09:00 Asia/Kolkata each day. The recurrence
  // service filters by each rule's nextRunAt, so only eligible tasks are created.
  recurrenceScheduler = new Cron(
    "0 9 * * *",
    {
      name: "recurring-work-item-processor",
      timezone: "Asia/Kolkata",
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
