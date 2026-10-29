import assert from "node:assert/strict";
import test from "node:test";
import {
  addWorkingDays,
  calculatePlannedFinish,
  calculateScheduleReflow,
  dateToProjectTimestamp,
  findDependencyCyclePath,
  getEarliestAllowedStart,
  getProjectDate,
  requireDependencyDueDate,
  type ScheduleTask,
} from "../services/work-item-dependency.service";
import { createWorkItemSchema } from "../validations/work.item.validations";
import { WorkItemStatus } from "../entities/work.item.entity";

function scheduledTask(
  id: string,
  startDate: string | null,
  duration: number | null,
  dueDate: string | null,
  status = WorkItemStatus.BACKLOG,
  isSchedulePinned = false,
): ScheduleTask {
  return {
    id,
    title: id,
    status,
    plannedStartDate: startDate,
    plannedDurationWorkingDays: duration,
    dueDate: dueDate ? dateToProjectTimestamp(dueDate) : null,
    isSchedulePinned,
  };
}

test("Finish-to-Start working-day calculations skip weekends", () => {
  assert.equal(addWorkingDays("2026-10-30", 1), "2026-11-02");
  assert.equal(addWorkingDays("2026-10-30", 2), "2026-11-03");
  assert.equal(calculatePlannedFinish("2026-10-30", 2), "2026-11-02");
});

test("multiple predecessors constrain a successor by the latest finish", () => {
  assert.equal(
    getEarliestAllowedStart(["2026-11-02", "2026-11-06"]),
    "2026-11-09",
  );
});

test("successor cascades preserve duration through multiple levels", () => {
  const tasks = [
    scheduledTask("A", null, null, "2026-10-30"),
    scheduledTask("B", "2026-10-30", 2, "2026-11-02"),
    scheduledTask("C", "2026-11-03", 1, "2026-11-03"),
  ];
  const updates = calculateScheduleReflow(tasks, [
    { id: "ab", workItemId: "B", dependsOnWorkItemId: "A" },
    { id: "bc", workItemId: "C", dependsOnWorkItemId: "B" },
  ], ["A"]);

  assert.deepEqual(
    updates.map((task) => [
      task.id,
      task.plannedStartDate,
      getProjectDate(task.dueDate!),
      task.plannedDurationWorkingDays,
    ]),
    [
      ["B", "2026-11-02", "2026-11-03", 2],
      ["C", "2026-11-04", "2026-11-04", 1],
    ],
  );
  assert.equal(tasks[1].plannedStartDate, "2026-10-30");
});

test("multiple predecessor constraints move a successor to the latest allowed start", () => {
  const tasks = [
    scheduledTask("A", null, null, "2026-11-02"),
    scheduledTask("D", null, null, "2026-11-06"),
    scheduledTask("B", "2026-11-03", 2, "2026-11-04"),
  ];
  const updates = calculateScheduleReflow(tasks, [
    { id: "ab", workItemId: "B", dependsOnWorkItemId: "A" },
    { id: "db", workItemId: "B", dependsOnWorkItemId: "D" },
  ], ["D"]);

  assert.equal(updates[0].plannedStartDate, "2026-11-09");
  assert.equal(getProjectDate(updates[0].dueDate!), "2026-11-10");
});

test("completed and pinned successors reject a required schedule move", () => {
  for (const successor of [
    scheduledTask("B", "2026-10-30", 1, "2026-10-30", WorkItemStatus.DONE),
    scheduledTask("B", "2026-10-30", 1, "2026-10-30", WorkItemStatus.BACKLOG, true),
  ]) {
    assert.throws(
      () => calculateScheduleReflow(
        [scheduledTask("A", null, null, "2026-10-30"), successor],
        [{ id: "ab", workItemId: "B", dependsOnWorkItemId: "A" }],
        ["A"],
      ),
      (error: any) => error.code === "DEPENDENCY_SCHEDULE_CONFLICT",
    );
  }
});

test("schedule timestamps preserve the project calendar date", () => {
  const timestamp = dateToProjectTimestamp("2026-11-02");
  assert.equal(getProjectDate(timestamp), "2026-11-02");
});

test("dependency cycle detection returns direct and indirect closed paths", () => {
  const workItemIds = ["A", "B", "C", "D"];
  const edges = [
    { id: "1", workItemId: "C", dependsOnWorkItemId: "B" },
    { id: "2", workItemId: "D", dependsOnWorkItemId: "C" },
  ];

  assert.deepEqual(
    findDependencyCyclePath("A", "B", workItemIds, edges),
    null,
  );
  assert.deepEqual(
    findDependencyCyclePath(
      "A",
      "B",
      workItemIds,
      [...edges, { id: "3", workItemId: "A", dependsOnWorkItemId: "B" }],
    ),
    ["A", "B", "A"],
  );
  assert.deepEqual(
    findDependencyCyclePath("A", "B", ["A", "B", "C"], [
      ...edges.slice(0, 1),
      { id: "3", workItemId: "A", dependsOnWorkItemId: "C" },
    ]),
    ["A", "B", "C", "A"],
  );
});

test("dependency endpoints without due dates receive a stable error", () => {
  for (const title of ["Predecessor", "Successor"]) {
    assert.throws(
      () => requireDependencyDueDate({ title, dueDate: null }),
      (error: any) =>
        error.code === "DEPENDENCY_DUE_DATE_REQUIRED" &&
        error.message.includes(title),
    );
  }
});

test("ordinary work-item creation remains valid without a due date", () => {
  const result = createWorkItemSchema.validate({
    projectId: "2f1e9140-6a1e-4e1f-93af-4a56b08f0201",
    type: "TASK",
    title: "Unscheduled task",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.dueDate, undefined);
});
