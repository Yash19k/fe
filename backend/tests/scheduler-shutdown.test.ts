import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AppDataSource } from "../config/data.source";
import { startScheduler, stopScheduler } from "../services/scheduler.service";

describe("scheduler shutdown", () => {
  test("stops Croner jobs and prevents scheduler restart during shutdown", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      AppDataSource,
      "isInitialized",
    );
    Object.defineProperty(AppDataSource, "isInitialized", {
      configurable: true,
      value: true,
    });

    try {
      startScheduler();
      await stopScheduler();
      assert.throws(
        () => startScheduler(),
        /Scheduler is stopping and cannot be restarted/,
      );
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(
          AppDataSource,
          "isInitialized",
          originalDescriptor,
        );
      } else {
        Reflect.deleteProperty(AppDataSource, "isInitialized");
      }
    }
  });
});
