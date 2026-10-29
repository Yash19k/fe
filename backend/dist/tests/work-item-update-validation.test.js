"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const work_item_validations_1 = require("../validations/work.item.validations");
const work_item_entity_1 = require("../entities/work.item.entity");
const projectId = "047fe1e7-7f4b-44ce-8e1f-d24a7f5d8f31";
(0, node_test_1.describe)("work item dependency version validation", () => {
    (0, node_test_1.test)("requires a current version for dependency mutations", () => {
        strict_1.default.equal(work_item_validations_1.workItemDependencyBodySchema.validate({
            dependsOnWorkItemId: projectId,
            version: 1,
        }).error, undefined);
        strict_1.default.ok(work_item_validations_1.workItemDependencyBodySchema.validate({
            dependsOnWorkItemId: projectId,
        }).error);
        strict_1.default.ok(work_item_validations_1.workItemDependencyVersionBodySchema.validate({ version: 1 }).error === undefined);
        strict_1.default.ok(work_item_validations_1.workItemDependencyVersionBodySchema.validate({ version: 0 }).error);
    });
});
(0, node_test_1.describe)("work item update validation", () => {
    (0, node_test_1.test)("allows priority to be omitted or explicitly cleared", () => {
        strict_1.default.equal(work_item_validations_1.updateWorkItemSchema.validate({ version: 1, title: "Updated" }).error, undefined);
        strict_1.default.equal(work_item_validations_1.updateWorkItemSchema.validate({
            version: 1,
            priority: null,
        }).error, undefined);
        strict_1.default.ok(work_item_validations_1.updateWorkItemSchema.validate({
            version: 1,
            priority: "UNKNOWN",
        }).error);
    });
    (0, node_test_1.test)("requires a version on updates", () => {
        strict_1.default.ok(work_item_validations_1.updateWorkItemSchema.validate({ title: "Updated" }).error);
        strict_1.default.ok(work_item_validations_1.updateWorkItemSchema.validate({ version: 0, title: "Updated" }).error);
    });
    (0, node_test_1.test)("accepts valid details and estimate values including zero", () => {
        const result = work_item_validations_1.updateWorkItemSchema.validate({
            version: 1,
            estimatedHours: 0,
            acceptanceCriteria: "Must preserve all existing fields",
        });
        strict_1.default.equal(result.error, undefined);
        strict_1.default.equal(result.value.estimatedHours, 0);
    });
    (0, node_test_1.test)("rejects due dates that are not later than the planned start date", () => {
        const base = {
            projectId,
            type: work_item_entity_1.WorkItemType.TASK,
            title: "Scheduled item",
            plannedStartDate: "2026-10-29",
            plannedDurationWorkingDays: 1,
        };
        const equalDateError = work_item_validations_1.createWorkItemSchema.validate({
            ...base,
            dueDate: "2026-10-29",
        }).error;
        strict_1.default.ok(equalDateError);
        strict_1.default.match(equalDateError.message, /greater than/i);
        strict_1.default.ok(work_item_validations_1.createWorkItemSchema.validate({
            ...base,
            dueDate: "2026-10-28",
        }).error);
        strict_1.default.equal(work_item_validations_1.createWorkItemSchema.validate({
            ...base,
            dueDate: "2026-10-30",
        }).error, undefined);
    });
    (0, node_test_1.test)("allows either date to be omitted and preserves optional priority", () => {
        const result = work_item_validations_1.createWorkItemSchema.validate({
            projectId,
            type: work_item_entity_1.WorkItemType.SUBTASK,
            title: "Standalone date fields",
            plannedStartDate: "2026-10-29",
        });
        strict_1.default.equal(result.error, undefined);
        strict_1.default.equal(result.value.priority, undefined);
    });
    (0, node_test_1.test)("compares timestamp dates in the project timezone", () => {
        const base = {
            projectId,
            type: work_item_entity_1.WorkItemType.TASK,
            title: "Timezone-aware date range",
        };
        strict_1.default.equal(work_item_validations_1.createWorkItemSchema.validate({
            ...base,
            plannedStartDate: "2026-10-30",
            dueDate: "2026-10-30T18:30:00.000Z",
        }).error, undefined);
        strict_1.default.ok(work_item_validations_1.createWorkItemSchema.validate({
            ...base,
            plannedStartDate: "2026-10-31",
            dueDate: "2026-10-30T18:30:00.000Z",
        }).error);
    });
});
