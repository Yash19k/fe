import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkItemSchema,
  updateWorkItemSchema,
} from "../validations/work.item.validations";
import { WorkItemType } from "../entities/work.item.entity";

const validWorkItem = {
  projectId: "047fe1e7-7f4b-44ce-8e1f-d24a7f5d8f31",
  type: WorkItemType.TASK,
  title: "Task without priority",
};

describe("work item priority validation", () => {
  test("accepts a work item with no priority and does not supply a default", () => {
    const result = createWorkItemSchema.validate(validWorkItem);

    assert.equal(result.error, undefined);
    assert.equal(result.value.priority, undefined);
  });

  test("accepts an explicitly empty priority", () => {
    const result = createWorkItemSchema.validate({
      ...validWorkItem,
      priority: null,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.value.priority, null);
  });

  test("accepts only one label for the single-label persistence contract", () => {
    const oneLabel = "1b65ef76-4f4a-4daf-a1e9-ae8a51a58fd6";
    const twoLabels = [
      oneLabel,
      "2875dc65-2d50-41b1-bb88-6c8c42b457bb",
    ];

    assert.equal(
      createWorkItemSchema.validate({ ...validWorkItem, labels: [oneLabel] })
        .error,
      undefined,
    );
    assert.ok(
      createWorkItemSchema.validate({ ...validWorkItem, labels: twoLabels })
        .error,
    );
    assert.ok(updateWorkItemSchema.validate({ labels: twoLabels }).error);
    assert.ok(
      createWorkItemSchema.validate({
        ...validWorkItem,
        labelId: oneLabel,
        labels: ["2875dc65-2d50-41b1-bb88-6c8c42b457bb"],
      }).error,
    );
  });
});
