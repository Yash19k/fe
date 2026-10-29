import assert from "node:assert/strict";
import test from "node:test";
import {
  SlaStatus,
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
} from "../entities/work.item.entity";
import { OrganizationSla } from "../entities/organization.sla.entity";
import {
  applySlaState,
  calculateSlaDeadline,
  calculateSlaStatus,
} from "../services/sla.service";

test("work items without priority have no active SLA state, including stale escalations", () => {
  const workItem = Object.assign(new WorkItem(), {
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    status: WorkItemStatus.IN_PROGRESS,
    priority: null,
    slaDeadline: new Date("2026-10-20T01:00:00.000Z"),
    slaDeadlineIsCustom: true,
    slaStatus: SlaStatus.ESCALATED,
    escalatedAt: new Date("2026-10-20T02:00:00.000Z"),
    escalatedById: "user-1",
    escalationReason: "Stale escalation",
    slaBreachedAt: new Date("2026-10-20T01:00:00.000Z"),
    slaResolvedAt: null,
  });

  assert.equal(applySlaState(workItem), SlaStatus.ON_TRACK);
  assert.equal(calculateSlaStatus(workItem), SlaStatus.ON_TRACK);
  assert.equal(workItem.slaDeadline, null);
  assert.equal(workItem.slaStatus, null);
  assert.equal(workItem.slaDeadlineIsCustom, false);
  assert.equal(workItem.escalatedAt, null);
  assert.equal(workItem.escalatedById, null);
  assert.equal(workItem.escalationReason, null);
  assert.equal(workItem.slaBreachedAt, null);
});

test("eligible priorities use the existing SLA policy and deadline calculation", () => {
  const createdAt = new Date("2026-10-20T00:00:00.000Z");
  const workItem = Object.assign(new WorkItem(), {
    createdAt,
    status: WorkItemStatus.IN_PROGRESS,
    priority: WorkItemPriority.URGENT,
    slaDeadline: calculateSlaDeadline(createdAt, WorkItemPriority.URGENT),
    slaStatus: null,
    escalatedAt: null,
  });

  assert.equal(workItem.slaDeadline.toISOString(), "2026-10-20T04:00:00.000Z");
  assert.equal(
    calculateSlaStatus(workItem, new Date("2026-10-20T00:30:00.000Z")),
    SlaStatus.ON_TRACK,
  );
});

test("custom organization SLA hours are preserved for eligible priorities", () => {
  const createdAt = new Date("2026-10-20T00:00:00.000Z");
  const policy = Object.assign(new OrganizationSla(), { urgentHours: 2 });

  assert.equal(
    calculateSlaDeadline(createdAt, WorkItemPriority.URGENT, policy).toISOString(),
    "2026-10-20T02:00:00.000Z",
  );
});
