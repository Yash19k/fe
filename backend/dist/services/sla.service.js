"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLA_AT_RISK_RATIO = exports.SLA_POLICY_HOURS = void 0;
exports.getSlaHours = getSlaHours;
exports.calculateSlaDeadline = calculateSlaDeadline;
exports.calculateSlaStatus = calculateSlaStatus;
exports.getSlaSnapshot = getSlaSnapshot;
exports.clearSlaState = clearSlaState;
exports.applySlaState = applySlaState;
exports.ensureSlaData = ensureSlaData;
exports.writeSlaAudit = writeSlaAudit;
exports.refreshSlaStatuses = refreshSlaStatuses;
const audit_log_entity_1 = require("../entities/audit.log.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const organization_sla_entity_1 = require("../entities/organization.sla.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const notification_entity_1 = require("../entities/notification.entity");
exports.SLA_POLICY_HOURS = {
    [work_item_entity_1.WorkItemPriority.URGENT]: 4,
    [work_item_entity_1.WorkItemPriority.HIGH]: 8,
    [work_item_entity_1.WorkItemPriority.MEDIUM]: 24,
    [work_item_entity_1.WorkItemPriority.LOW]: 72,
};
exports.SLA_AT_RISK_RATIO = 0.2;
const resolvedStatuses = new Set([work_item_entity_1.WorkItemStatus.DONE]);
function getSlaHours(priority, policy) {
    if (policy) {
        switch (priority) {
            case work_item_entity_1.WorkItemPriority.URGENT:
                return policy.urgentHours ?? 4;
            case work_item_entity_1.WorkItemPriority.HIGH:
                return policy.highHours ?? 8;
            case work_item_entity_1.WorkItemPriority.MEDIUM:
                return policy.mediumHours ?? 24;
            case work_item_entity_1.WorkItemPriority.LOW:
                return policy.lowHours ?? 72;
        }
    }
    return exports.SLA_POLICY_HOURS[priority] ?? exports.SLA_POLICY_HOURS[work_item_entity_1.WorkItemPriority.MEDIUM];
}
function calculateSlaDeadline(createdAt, priority, policy) {
    return new Date(createdAt.getTime() + getSlaHours(priority, policy) * 60 * 60 * 1000);
}
function calculateSlaStatus(workItem, now = new Date(), policy) {
    // A work item without a priority does not participate in the SLA workflow.
    if (!workItem.priority)
        return work_item_entity_1.SlaStatus.ON_TRACK;
    if (resolvedStatuses.has(workItem.status))
        return work_item_entity_1.SlaStatus.RESOLVED;
    if (workItem.escalatedAt || workItem.slaStatus === work_item_entity_1.SlaStatus.ESCALATED) {
        return work_item_entity_1.SlaStatus.ESCALATED;
    }
    if (!workItem.slaDeadline)
        return work_item_entity_1.SlaStatus.ON_TRACK;
    if (now >= workItem.slaDeadline)
        return work_item_entity_1.SlaStatus.BREACHED;
    const remaining = workItem.slaDeadline.getTime() - now.getTime();
    const riskHours = policy?.escalateHours ??
        getSlaHours(workItem.priority, policy) * exports.SLA_AT_RISK_RATIO;
    const riskMs = riskHours * 3600000;
    return remaining <= riskMs ? work_item_entity_1.SlaStatus.AT_RISK : work_item_entity_1.SlaStatus.ON_TRACK;
}
function getSlaSnapshot(workItem, now = new Date()) {
    if (!workItem.priority) {
        return {
            status: work_item_entity_1.SlaStatus.ON_TRACK,
            deadline: null,
            remainingHours: null,
            overdueHours: null,
            isEscalated: false,
            escalatedAt: null,
            escalationReason: null,
            breachedAt: null,
            resolvedAt: null,
        };
    }
    const status = calculateSlaStatus(workItem, now);
    const remainingHours = workItem.slaDeadline
        ? (workItem.slaDeadline.getTime() - now.getTime()) / 3600000
        : null;
    return {
        status,
        deadline: workItem.slaDeadline,
        remainingHours: remainingHours === null ? null : Math.max(0, remainingHours),
        overdueHours: remainingHours !== null && remainingHours < 0 ? Math.abs(remainingHours) : null,
        isEscalated: Boolean(workItem.escalatedAt),
        escalatedAt: workItem.escalatedAt,
        escalationReason: workItem.escalationReason,
        breachedAt: workItem.slaBreachedAt,
        resolvedAt: workItem.slaResolvedAt,
    };
}
function clearSlaState(workItem) {
    workItem.slaDeadline = null;
    workItem.slaDeadlineIsCustom = false;
    workItem.slaStatus = null;
    workItem.escalatedAt = null;
    workItem.escalatedById = null;
    workItem.escalationReason = null;
    workItem.slaBreachedAt = null;
    workItem.slaResolvedAt = null;
}
function applySlaState(workItem, now = new Date(), policy) {
    if (!workItem.priority) {
        clearSlaState(workItem);
        // ON_TRACK is the service's non-null return value; the persisted SLA status
        // remains null because this work item has no SLA.
        return work_item_entity_1.SlaStatus.ON_TRACK;
    }
    const nextStatus = calculateSlaStatus(workItem, now, policy);
    if (nextStatus === work_item_entity_1.SlaStatus.BREACHED && !workItem.slaBreachedAt) {
        workItem.slaBreachedAt = now;
    }
    if (nextStatus === work_item_entity_1.SlaStatus.RESOLVED && !workItem.slaResolvedAt) {
        workItem.slaResolvedAt = now;
    }
    workItem.slaStatus = nextStatus;
    return nextStatus;
}
async function ensureSlaData(workItem, manager) {
    if (!workItem.priority) {
        clearSlaState(workItem);
        return manager.getRepository(work_item_entity_1.WorkItem).save(workItem);
    }
    const policy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
        where: { organizationId: workItem.organizationId },
    });
    if (!workItem.slaDeadline) {
        workItem.slaDeadline = calculateSlaDeadline(workItem.createdAt, workItem.priority, policy);
        workItem.slaDeadlineIsCustom = false;
    }
    applySlaState(workItem, new Date(), policy);
    return manager.getRepository(work_item_entity_1.WorkItem).save(workItem);
}
async function writeSlaAudit(manager, workItem, userId, action, description, previousState, newState) {
    await manager.getRepository(audit_log_entity_1.AuditLog).save(manager.getRepository(audit_log_entity_1.AuditLog).create({
        organizationId: workItem.organizationId,
        projectId: workItem.projectId,
        userId,
        action,
        entityType: "work_item",
        entityId: workItem.id,
        description,
        previousState,
        newState,
    }));
}
async function refreshSlaStatuses(manager) {
    const now = new Date();
    const priorityRiskHours = `
    CASE
      WHEN workItem.priority = 'URGENT' THEN 0.8
      WHEN workItem.priority = 'HIGH' THEN 1.6
      WHEN workItem.priority = 'MEDIUM' THEN 4.8
      WHEN workItem.priority = 'LOW' THEN 14.4
      ELSE 0
    END
  `;
    const candidates = await manager
        .getRepository(work_item_entity_1.WorkItem)
        .createQueryBuilder("workItem")
        .where("workItem.status != :done", { done: work_item_entity_1.WorkItemStatus.DONE })
        .andWhere(`(
        (
          workItem.priority IS NULL
          AND (
            workItem.slaDeadline IS NOT NULL
            OR workItem.slaDeadlineIsCustom = true
            OR workItem.slaStatus IS NOT NULL
            OR workItem.escalatedAt IS NOT NULL
            OR workItem.escalatedById IS NOT NULL
            OR workItem.escalationReason IS NOT NULL
            OR workItem.slaBreachedAt IS NOT NULL
            OR workItem.slaResolvedAt IS NOT NULL
          )
        )
        OR (
          workItem.priority IS NOT NULL
          AND (
            workItem.slaDeadline IS NULL
            OR workItem.slaStatus IS NULL
            OR (
              workItem.slaDeadline <= :now
              AND workItem.escalatedAt IS NULL
              AND workItem.slaResolvedAt IS NULL
            )
            OR (
              workItem.slaDeadline > :now
              AND workItem.slaStatus IS DISTINCT FROM :atRisk
              AND workItem.escalatedAt IS NULL
              AND workItem.slaResolvedAt IS NULL
              AND workItem.slaDeadline <= :now + (
                COALESCE(
                  (
                    SELECT policy.escalate_hours
                    FROM organization_sla policy
                    WHERE policy.organization_id = workItem.organization_id
                  ),
                  ${priorityRiskHours}
                ) * INTERVAL '1 hour'
              )
            )
            OR workItem.updatedAt < (
              SELECT policy.updated_at
              FROM organization_sla policy
              WHERE policy.organization_id = workItem.organization_id
            )
          )
        )
      )`, { now, atRisk: work_item_entity_1.SlaStatus.AT_RISK })
        .orderBy("COALESCE(workItem.slaDeadline, workItem.createdAt)", "ASC")
        .addOrderBy("workItem.id", "ASC")
        .take(500)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();
    const orgPolicies = new Map();
    const notifications = [];
    let changed = 0;
    for (const item of candidates) {
        const previous = item.slaStatus;
        if (!item.priority) {
            const hadSlaState = Boolean(item.slaDeadline ||
                item.slaDeadlineIsCustom ||
                item.slaStatus ||
                item.escalatedAt ||
                item.escalatedById ||
                item.escalationReason ||
                item.slaBreachedAt ||
                item.slaResolvedAt);
            if (hadSlaState) {
                clearSlaState(item);
                item.updatedAt = now;
                await manager.getRepository(work_item_entity_1.WorkItem).save(item);
                changed += 1;
            }
            continue;
        }
        let policy = orgPolicies.get(item.organizationId);
        if (policy === undefined) {
            policy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
                where: { organizationId: item.organizationId },
            });
            orgPolicies.set(item.organizationId, policy);
        }
        if (!item.slaDeadline) {
            item.slaDeadline = calculateSlaDeadline(item.createdAt, item.priority, policy);
            item.slaDeadlineIsCustom = false;
        }
        // Automated SLA escalation:
        // If resolution deadline has passed, and item has not been escalated yet, and escalation was not previously resolved
        if (now >= item.slaDeadline &&
            !item.escalatedAt &&
            item.slaStatus !== work_item_entity_1.SlaStatus.ESCALATED &&
            !item.slaResolvedAt) {
            if (!item.slaBreachedAt) {
                item.slaBreachedAt = now;
            }
            item.slaStatus = work_item_entity_1.SlaStatus.ESCALATED;
            item.escalatedAt = now;
            item.escalatedById = null;
            item.escalationReason =
                "Automated SLA escalation: task breached resolution deadline";
            item.updatedAt = now;
            await manager.getRepository(work_item_entity_1.WorkItem).save(item);
            await writeSlaAudit(manager, item, item.createdById, "escalated", "Work item automatically escalated due to SLA deadline breach", { status: previous }, {
                status: item.slaStatus,
                escalatedAt: item.escalatedAt,
                reason: item.escalationReason,
            });
            const assignments = await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
                where: { workItemId: item.id },
                select: { userId: true },
            });
            const recipients = new Set([
                ...assignments.map((assignment) => assignment.userId),
                item.createdById,
            ]);
            for (const userId of recipients) {
                notifications.push({
                    userId,
                    organizationId: item.organizationId,
                    type: notification_entity_1.NotificationType.SLA_ESCALATED,
                    title: "SLA escalation",
                    message: `"${item.title}" has been automatically escalated because of SLA breach.`,
                    workItemId: item.id,
                    projectId: item.projectId,
                    link: `/tasks/${item.id}`,
                    metadata: {
                        reason: item.escalationReason,
                        escalatedAt: item.escalatedAt?.toISOString() ?? null,
                    },
                });
            }
            changed += 1;
            continue;
        }
        const next = applySlaState(item, now, policy);
        if (previous !== next) {
            item.updatedAt = now;
            await manager.getRepository(work_item_entity_1.WorkItem).save(item);
            if (next === work_item_entity_1.SlaStatus.BREACHED && previous !== work_item_entity_1.SlaStatus.BREACHED) {
                await writeSlaAudit(manager, item, item.createdById, "sla_breached", "Work item SLA breached during scheduled refresh", { status: previous }, {
                    status: next,
                    breachedAt: item.slaBreachedAt,
                    deadline: item.slaDeadline,
                });
            }
            changed += 1;
        }
    }
    return { updatedCount: changed, notifications };
}
