"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const work_item_entity_1 = require("../entities/work.item.entity");
const app_error_1 = require("../errors/app.error");
const work_item_workflow_service_1 = require("../services/work-item-workflow.service");
const auditlog_controller_1 = require("../controllers/auditlog.controller");
(0, node_test_1.describe)("work-item workflow transitions", () => {
    (0, node_test_1.test)("allows configured transitions", () => {
        strict_1.default.doesNotThrow(() => (0, work_item_workflow_service_1.validateWorkItemStatusTransition)(work_item_entity_1.WorkItemStatus.BACKLOG, work_item_entity_1.WorkItemStatus.IN_PROGRESS, "TEAMMATE", work_item_workflow_service_1.DEFAULT_WORKFLOW_STATUSES));
    });
    (0, node_test_1.test)("rejects transitions not configured by the workflow", () => {
        strict_1.default.throws(() => (0, work_item_workflow_service_1.validateWorkItemStatusTransition)(work_item_entity_1.WorkItemStatus.BACKLOG, work_item_entity_1.WorkItemStatus.DONE, "ADMIN", work_item_workflow_service_1.DEFAULT_WORKFLOW_STATUSES), (error) => error instanceof app_error_1.AppError &&
            error.code === "INVALID_STATUS_TRANSITION");
    });
    (0, node_test_1.test)("enforces role restrictions on configured target statuses", () => {
        strict_1.default.throws(() => (0, work_item_workflow_service_1.validateWorkItemStatusTransition)(work_item_entity_1.WorkItemStatus.TESTING_QA, work_item_entity_1.WorkItemStatus.DONE, "TEAMMATE", work_item_workflow_service_1.DEFAULT_WORKFLOW_STATUSES), (error) => error instanceof app_error_1.AppError &&
            error.code === "FORBIDDEN");
        strict_1.default.doesNotThrow(() => (0, work_item_workflow_service_1.validateWorkItemStatusTransition)(work_item_entity_1.WorkItemStatus.TESTING_QA, work_item_entity_1.WorkItemStatus.DONE, "MANAGER", work_item_workflow_service_1.DEFAULT_WORKFLOW_STATUSES));
    });
    (0, node_test_1.test)("rejects malformed or incomplete configured workflows", () => {
        strict_1.default.throws(() => (0, work_item_workflow_service_1.validateWorkItemStatusTransition)(work_item_entity_1.WorkItemStatus.BACKLOG, work_item_entity_1.WorkItemStatus.IN_PROGRESS, "ADMIN", [{ name: "Backlog" }]), (error) => error instanceof app_error_1.AppError &&
            error.code === "INVALID_STATUS_TRANSITION");
    });
});
(0, node_test_1.describe)("audit log writes", () => {
    (0, node_test_1.test)("rejects client-authored audit entries", async () => {
        await strict_1.default.rejects((0, auditlog_controller_1.createAuditLog)(), (error) => error instanceof app_error_1.AppError && error.code === "FORBIDDEN");
    });
});
