import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkItemSchema,
  updateWorkItemSchema,
  workItemDependencyBodySchema,
  workItemDependencyVersionBodySchema,
} from "../validations/work.item.validations";
import {
  WorkItemPriority,
  WorkItemType,
} from "../entities/work.item.entity";

const projectId = "047fe1e7-7f4b-44ce-8e1f-d24a7f5d8f31";

describe("work item dependency version validation", () => {
  test("requires a current version for dependency mutations", () => {
    assert.equal(
      workItemDependencyBodySchema.validate({
        dependsOnWorkItemId: projectId,
        version: 1,
      }).error,
      undefined,
    );
    assert.ok(
      workItemDependencyBodySchema.validate({
        dependsOnWorkItemId: projectId,
      }).error,
    );
    assert.ok(workItemDependencyVersionBodySchema.validate({ version: 1 }).error === undefined);
    assert.ok(workItemDependencyVersionBodySchema.validate({ version: 0 }).error);
  });
});

describe("work item update validation", () => {
  test("allows priority to be omitted or explicitly cleared", () => {
    assert.equal(
      updateWorkItemSchema.validate({ version: 1, title: "Updated" }).error,
      undefined,
    );
    assert.equal(
      updateWorkItemSchema.validate({
        version: 1,
        priority: null,
      }).error,
      undefined,
    );
    assert.ok(
      updateWorkItemSchema.validate({
        version: 1,
        priority: "UNKNOWN" as WorkItemPriority,
      }).error,
    );
  });

  test("requires a version on updates", () => {
    assert.ok(updateWorkItemSchema.validate({ title: "Updated" }).error);
    assert.ok(updateWorkItemSchema.validate({ version: 0, title: "Updated" }).error);
  });

  test("accepts valid details and estimate values including zero", () => {
    const result = updateWorkItemSchema.validate({
      version: 1,
      estimatedHours: 0,
      acceptanceCriteria: "Must preserve all existing fields",
    });

    assert.equal(result.error, undefined);
    assert.equal(result.value.estimatedHours, 0);
  });

  test("rejects due dates that are not later than the planned start date", () => {
    const base = {
      projectId,
      type: WorkItemType.TASK,
      title: "Scheduled item",
      plannedStartDate: "2026-10-29",
      plannedDurationWorkingDays: 1,
    };

    const equalDateError = createWorkItemSchema.validate({
      ...base,
      dueDate: "2026-10-29",
    }).error;
    assert.ok(equalDateError);
    assert.match(equalDateError.message, /greater than/i);
    assert.ok(
      createWorkItemSchema.validate({
        ...base,
        dueDate: "2026-10-28",
      }).error,
    );
    assert.equal(
      createWorkItemSchema.validate({
        ...base,
        dueDate: "2026-10-30",
      }).error,
      undefined,
    );
  });

  test("allows either date to be omitted and preserves optional priority", () => {
    const result = createWorkItemSchema.validate({
      projectId,
      type: WorkItemType.SUBTASK,
      title: "Standalone date fields",
      plannedStartDate: "2026-10-29",
    });

    assert.equal(result.error, undefined);
    assert.equal(result.value.priority, undefined);
  });

  test("compares timestamp dates in the project timezone", () => {
    const base = {
      projectId,
      type: WorkItemType.TASK,
      title: "Timezone-aware date range",
    };

    assert.equal(
      createWorkItemSchema.validate({
        ...base,
        plannedStartDate: "2026-10-30",
        dueDate: "2026-10-30T18:30:00.000Z",
      }).error,
      undefined,
    );
    assert.ok(
      createWorkItemSchema.validate({
        ...base,
        plannedStartDate: "2026-10-31",
        dueDate: "2026-10-30T18:30:00.000Z",
      }).error,
    );
  });
});
