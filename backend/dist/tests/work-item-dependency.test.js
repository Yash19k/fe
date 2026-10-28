"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const work_item_dependency_service_1 = require("../services/work-item-dependency.service");
const work_item_validations_1 = require("../validations/work.item.validations");
const work_item_entity_1 = require("../entities/work.item.entity");
function scheduledTask(id, startDate, duration, dueDate, status = work_item_entity_1.WorkItemStatus.BACKLOG, isSchedulePinned = false) {
    return {
        id,
        title: id,
        status,
        plannedStartDate: startDate,
        plannedDurationWorkingDays: duration,
        dueDate: dueDate ? (0, work_item_dependency_service_1.dateToProjectTimestamp)(dueDate) : null,
        isSchedulePinned,
    };
}
(0, node_test_1.default)("Finish-to-Start working-day calculations skip weekends", () => {
    strict_1.default.equal((0, work_item_dependency_service_1.addWorkingDays)("2026-10-30", 1), "2026-11-02");
    strict_1.default.equal((0, work_item_dependency_service_1.addWorkingDays)("2026-10-30", 2), "2026-11-03");
    strict_1.default.equal((0, work_item_dependency_service_1.calculatePlannedFinish)("2026-10-30", 2), "2026-11-02");
});
(0, node_test_1.default)("multiple predecessors constrain a successor by the latest finish", () => {
    strict_1.default.equal((0, work_item_dependency_service_1.getEarliestAllowedStart)(["2026-11-02", "2026-11-06"]), "2026-11-09");
});
(0, node_test_1.default)("successor cascades preserve duration through multiple levels", () => {
    const tasks = [
        scheduledTask("A", null, null, "2026-10-30"),
        scheduledTask("B", "2026-10-30", 2, "2026-11-02"),
        scheduledTask("C", "2026-11-03", 1, "2026-11-03"),
    ];
    const updates = (0, work_item_dependency_service_1.calculateScheduleReflow)(tasks, [
        { id: "ab", workItemId: "B", dependsOnWorkItemId: "A" },
        { id: "bc", workItemId: "C", dependsOnWorkItemId: "B" },
    ], ["A"]);
    strict_1.default.deepEqual(updates.map((task) => [
        task.id,
        task.plannedStartDate,
        (0, work_item_dependency_service_1.getProjectDate)(task.dueDate),
        task.plannedDurationWorkingDays,
    ]), [
        ["B", "2026-11-02", "2026-11-03", 2],
        ["C", "2026-11-04", "2026-11-04", 1],
    ]);
    strict_1.default.equal(tasks[1].plannedStartDate, "2026-10-30");
});
(0, node_test_1.default)("multiple predecessor constraints move a successor to the latest allowed start", () => {
    const tasks = [
        scheduledTask("A", null, null, "2026-11-02"),
        scheduledTask("D", null, null, "2026-11-06"),
        scheduledTask("B", "2026-11-03", 2, "2026-11-04"),
    ];
    const updates = (0, work_item_dependency_service_1.calculateScheduleReflow)(tasks, [
        { id: "ab", workItemId: "B", dependsOnWorkItemId: "A" },
        { id: "db", workItemId: "B", dependsOnWorkItemId: "D" },
    ], ["D"]);
    strict_1.default.equal(updates[0].plannedStartDate, "2026-11-09");
    strict_1.default.equal((0, work_item_dependency_service_1.getProjectDate)(updates[0].dueDate), "2026-11-10");
});
(0, node_test_1.default)("completed and pinned successors reject a required schedule move", () => {
    for (const successor of [
        scheduledTask("B", "2026-10-30", 1, "2026-10-30", work_item_entity_1.WorkItemStatus.DONE),
        scheduledTask("B", "2026-10-30", 1, "2026-10-30", work_item_entity_1.WorkItemStatus.BACKLOG, true),
    ]) {
        strict_1.default.throws(() => (0, work_item_dependency_service_1.calculateScheduleReflow)([scheduledTask("A", null, null, "2026-10-30"), successor], [{ id: "ab", workItemId: "B", dependsOnWorkItemId: "A" }], ["A"]), (error) => error.code === "DEPENDENCY_SCHEDULE_CONFLICT");
    }
});
(0, node_test_1.default)("schedule timestamps preserve the project calendar date", () => {
    const timestamp = (0, work_item_dependency_service_1.dateToProjectTimestamp)("2026-11-02");
    strict_1.default.equal((0, work_item_dependency_service_1.getProjectDate)(timestamp), "2026-11-02");
});
(0, node_test_1.default)("dependency cycle detection returns direct and indirect closed paths", () => {
    const workItemIds = ["A", "B", "C", "D"];
    const edges = [
        { id: "1", workItemId: "C", dependsOnWorkItemId: "B" },
        { id: "2", workItemId: "D", dependsOnWorkItemId: "C" },
    ];
    strict_1.default.deepEqual((0, work_item_dependency_service_1.findDependencyCyclePath)("A", "B", workItemIds, edges), null);
    strict_1.default.deepEqual((0, work_item_dependency_service_1.findDependencyCyclePath)("A", "B", workItemIds, [...edges, { id: "3", workItemId: "A", dependsOnWorkItemId: "B" }]), ["A", "B", "A"]);
    strict_1.default.deepEqual((0, work_item_dependency_service_1.findDependencyCyclePath)("A", "B", ["A", "B", "C"], [
        ...edges.slice(0, 1),
        { id: "3", workItemId: "A", dependsOnWorkItemId: "C" },
    ]), ["A", "B", "C", "A"]);
});
(0, node_test_1.default)("dependency endpoints without due dates receive a stable error", () => {
    for (const title of ["Predecessor", "Successor"]) {
        strict_1.default.throws(() => (0, work_item_dependency_service_1.requireDependencyDueDate)({ title, dueDate: null }), (error) => error.code === "DEPENDENCY_DUE_DATE_REQUIRED" &&
            error.message.includes(title));
    }
});
(0, node_test_1.default)("ordinary work-item creation remains valid without a due date", () => {
    const result = work_item_validations_1.createWorkItemSchema.validate({
        projectId: "2f1e9140-6a1e-4e1f-93af-4a56b08f0201",
        type: "TASK",
        title: "Unscheduled task",
    });
    strict_1.default.equal(result.error, undefined);
    strict_1.default.equal(result.value.dueDate, undefined);
});
