"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const work_item_validations_1 = require("../validations/work.item.validations");
const work_item_entity_1 = require("../entities/work.item.entity");
const validWorkItem = {
    projectId: "047fe1e7-7f4b-44ce-8e1f-d24a7f5d8f31",
    type: work_item_entity_1.WorkItemType.TASK,
    title: "Task without priority",
};
(0, node_test_1.describe)("work item priority validation", () => {
    (0, node_test_1.test)("accepts a work item with no priority and does not supply a default", () => {
        const result = work_item_validations_1.createWorkItemSchema.validate(validWorkItem);
        strict_1.default.equal(result.error, undefined);
        strict_1.default.equal(result.value.priority, undefined);
    });
    (0, node_test_1.test)("accepts an explicitly empty priority", () => {
        const result = work_item_validations_1.createWorkItemSchema.validate({
            ...validWorkItem,
            priority: null,
        });
        strict_1.default.equal(result.error, undefined);
        strict_1.default.equal(result.value.priority, null);
    });
    (0, node_test_1.test)("accepts only one label for the single-label persistence contract", () => {
        const oneLabel = "1b65ef76-4f4a-4daf-a1e9-ae8a51a58fd6";
        const twoLabels = [
            oneLabel,
            "2875dc65-2d50-41b1-bb88-6c8c42b457bb",
        ];
        strict_1.default.equal(work_item_validations_1.createWorkItemSchema.validate({ ...validWorkItem, labels: [oneLabel] })
            .error, undefined);
        strict_1.default.ok(work_item_validations_1.createWorkItemSchema.validate({ ...validWorkItem, labels: twoLabels })
            .error);
        strict_1.default.ok(work_item_validations_1.updateWorkItemSchema.validate({ labels: twoLabels }).error);
        strict_1.default.ok(work_item_validations_1.createWorkItemSchema.validate({
            ...validWorkItem,
            labelId: oneLabel,
            labels: ["2875dc65-2d50-41b1-bb88-6c8c42b457bb"],
        }).error);
    });
});
