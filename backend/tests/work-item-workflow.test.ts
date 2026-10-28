import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { WorkItemStatus } from "../entities/work.item.entity";
import { AppError } from "../errors/app.error";
import {
  DEFAULT_WORKFLOW_STATUSES,
  validateWorkItemStatusTransition,
} from "../services/work-item-workflow.service";
import { createAuditLog } from "../controllers/auditlog.controller";

describe("work-item workflow transitions", () => {
  test("allows configured transitions", () => {
    assert.doesNotThrow(() =>
      validateWorkItemStatusTransition(
        WorkItemStatus.BACKLOG,
        WorkItemStatus.IN_PROGRESS,
        "TEAMMATE",
        DEFAULT_WORKFLOW_STATUSES,
      ),
    );
  });

  test("rejects transitions not configured by the workflow", () => {
    assert.throws(
      () =>
        validateWorkItemStatusTransition(
          WorkItemStatus.BACKLOG,
          WorkItemStatus.DONE,
          "ADMIN",
          DEFAULT_WORKFLOW_STATUSES,
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "INVALID_STATUS_TRANSITION",
    );
  });

  test("enforces role restrictions on configured target statuses", () => {
    assert.throws(
      () =>
        validateWorkItemStatusTransition(
          WorkItemStatus.TESTING_QA,
          WorkItemStatus.DONE,
          "TEAMMATE",
          DEFAULT_WORKFLOW_STATUSES,
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "FORBIDDEN",
    );

    assert.doesNotThrow(() =>
      validateWorkItemStatusTransition(
        WorkItemStatus.TESTING_QA,
        WorkItemStatus.DONE,
        "MANAGER",
        DEFAULT_WORKFLOW_STATUSES,
      ),
    );
  });

  test("rejects malformed or incomplete configured workflows", () => {
    assert.throws(
      () =>
        validateWorkItemStatusTransition(
          WorkItemStatus.BACKLOG,
          WorkItemStatus.IN_PROGRESS,
          "ADMIN",
          [{ name: "Backlog" }],
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "INVALID_STATUS_TRANSITION",
    );
  });
});

describe("audit log writes", () => {
  test("rejects client-authored audit entries", async () => {
    await assert.rejects(
      createAuditLog(),
      (error: unknown) =>
        error instanceof AppError && error.code === "FORBIDDEN",
    );
  });
});
