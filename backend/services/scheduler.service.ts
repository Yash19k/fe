
import { Cron } from "croner";
import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import { refreshSlaStatuses } from "./sla.service";

let slaScheduler: Cron | undefined;
let isSlaJobRunning = false;

export function startScheduler(): void {
  if (!AppDataSource.isInitialized) {
    throw new AppError(
      "Database must be initialized before starting the scheduler",
      500,
    );
  }

  if (slaScheduler) {
    return;
  }

  slaScheduler = new Cron(
    "* * * * *",
    {
      name: "sla-status-refresh",
      protect: true,
    },
    async () => {
      if (isSlaJobRunning) {
        return;
      }

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

  console.info("[Scheduler] SLA scheduler started.");
}

export function stopScheduler(): void {
  slaScheduler?.stop();
  slaScheduler = undefined;

  console.info("[Scheduler] SLA scheduler stopped.")
}