import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { WorkItemStatus } from "../entities/work.item.entity";
import { AppError } from "../errors/app.error";
import {
  DEFAULT_WORKFLOW_STATUSES,
  validateWorkflowConfiguration,
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

describe("workflow configuration validation", () => {
  test("normalizes names and transition references", () => {
    const stages = validateWorkflowConfiguration([
      { id: "stage-a", name: "  In   Progress ", color: "#12aBcD", allowedTransitions: ["stage-b"] },
      { id: "stage-b", name: "Review", color: "#abcdef", allowedTransitions: ["  in progress "] },
    ]);

    assert.equal(stages[0].name, "In Progress");
    assert.deepEqual(stages[0].allowedTransitions, ["Review"]);
    assert.deepEqual(stages[1].allowedTransitions, ["In Progress"]);
  });

  test("rejects duplicate names regardless of case and whitespace", () => {
    assert.throws(
      () => validateWorkflowConfiguration([
        { id: "stage-a", name: "In Progress", color: "#112233" },
        { id: "stage-b", name: " in   progress ", color: "#445566" },
      ]),
      (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR",
    );
  });

  test("rejects invalid colors and unknown transition targets", () => {
    assert.throws(
      () => validateWorkflowConfiguration([
        { id: "stage-a", name: "Backlog", color: "red", allowedTransitions: [] },
      ]),
      (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR",
    );
    assert.throws(
      () => validateWorkflowConfiguration([
        { id: "stage-a", name: "Backlog", color: "#112233", allowedTransitions: ["Missing"] },
      ]),
      (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR",
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
