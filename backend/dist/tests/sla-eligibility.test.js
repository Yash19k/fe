"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const work_item_entity_1 = require("../entities/work.item.entity");
const organization_sla_entity_1 = require("../entities/organization.sla.entity");
const sla_service_1 = require("../services/sla.service");
(0, node_test_1.default)("work items without priority have no active SLA state, including stale escalations", () => {
    const workItem = Object.assign(new work_item_entity_1.WorkItem(), {
        createdAt: new Date("2026-10-20T00:00:00.000Z"),
        status: work_item_entity_1.WorkItemStatus.IN_PROGRESS,
        priority: null,
        slaDeadline: new Date("2026-10-20T01:00:00.000Z"),
        slaDeadlineIsCustom: true,
        slaStatus: work_item_entity_1.SlaStatus.ESCALATED,
        escalatedAt: new Date("2026-10-20T02:00:00.000Z"),
        escalatedById: "user-1",
        escalationReason: "Stale escalation",
        slaBreachedAt: new Date("2026-10-20T01:00:00.000Z"),
        slaResolvedAt: null,
    });
    strict_1.default.equal((0, sla_service_1.applySlaState)(workItem), work_item_entity_1.SlaStatus.ON_TRACK);
    strict_1.default.equal((0, sla_service_1.calculateSlaStatus)(workItem), work_item_entity_1.SlaStatus.ON_TRACK);
    strict_1.default.equal(workItem.slaDeadline, null);
    strict_1.default.equal(workItem.slaStatus, null);
    strict_1.default.equal(workItem.slaDeadlineIsCustom, false);
    strict_1.default.equal(workItem.escalatedAt, null);
    strict_1.default.equal(workItem.escalatedById, null);
    strict_1.default.equal(workItem.escalationReason, null);
    strict_1.default.equal(workItem.slaBreachedAt, null);
});
(0, node_test_1.default)("eligible priorities use the existing SLA policy and deadline calculation", () => {
    const createdAt = new Date("2026-10-20T00:00:00.000Z");
    const workItem = Object.assign(new work_item_entity_1.WorkItem(), {
        createdAt,
        status: work_item_entity_1.WorkItemStatus.IN_PROGRESS,
        priority: work_item_entity_1.WorkItemPriority.URGENT,
        slaDeadline: (0, sla_service_1.calculateSlaDeadline)(createdAt, work_item_entity_1.WorkItemPriority.URGENT),
        slaStatus: null,
        escalatedAt: null,
    });
    strict_1.default.equal(workItem.slaDeadline.toISOString(), "2026-10-20T04:00:00.000Z");
    strict_1.default.equal((0, sla_service_1.calculateSlaStatus)(workItem, new Date("2026-10-20T00:30:00.000Z")), work_item_entity_1.SlaStatus.ON_TRACK);
});
(0, node_test_1.default)("custom organization SLA hours are preserved for eligible priorities", () => {
    const createdAt = new Date("2026-10-20T00:00:00.000Z");
    const policy = Object.assign(new organization_sla_entity_1.OrganizationSla(), { urgentHours: 2 });
    strict_1.default.equal((0, sla_service_1.calculateSlaDeadline)(createdAt, work_item_entity_1.WorkItemPriority.URGENT, policy).toISOString(), "2026-10-20T02:00:00.000Z");
});
