import { EntityManager } from "typeorm";
import { AuditLog } from "../entities/audit.log.entity";
import {
  SlaStatus,
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
} from "../entities/work.item.entity";
import { OrganizationSla } from "../entities/organization.sla.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import type { CreateNotificationInput } from "./notification.service";
import { NotificationType } from "../entities/notification.entity";

export const SLA_POLICY_HOURS: Record<WorkItemPriority, number> = {
  [WorkItemPriority.URGENT]: 4,
  [WorkItemPriority.HIGH]: 8,
  [WorkItemPriority.MEDIUM]: 24,
  [WorkItemPriority.LOW]: 72,
};

export const SLA_AT_RISK_RATIO = 0.2;

const resolvedStatuses = new Set([WorkItemStatus.DONE]);

export interface SlaSnapshot {
  status: SlaStatus;
  deadline: Date | null;
  remainingHours: number | null;
  overdueHours: number | null;
  isEscalated: boolean;
  escalatedAt: Date | null;
  escalationReason: string | null;
  breachedAt: Date | null;
  resolvedAt: Date | null;
}

export function getSlaHours(
  priority: WorkItemPriority,
  policy?: OrganizationSla | null,
): number {
  if (policy) {
    switch (priority) {
      case WorkItemPriority.URGENT:
        return policy.urgentHours ?? 4;
      case WorkItemPriority.HIGH:
        return policy.highHours ?? 8;
      case WorkItemPriority.MEDIUM:
        return policy.mediumHours ?? 24;
      case WorkItemPriority.LOW:
        return policy.lowHours ?? 72;
    }
  }
  return SLA_POLICY_HOURS[priority] ?? SLA_POLICY_HOURS[WorkItemPriority.MEDIUM];
}

export function calculateSlaDeadline(
  createdAt: Date,
  priority: WorkItemPriority,
  policy?: OrganizationSla | null,
): Date {
  return new Date(
    createdAt.getTime() + getSlaHours(priority, policy) * 60 * 60 * 1000,
  );
}

export function calculateSlaStatus(
  workItem: Pick<
    WorkItem,
    "status" | "priority" | "slaDeadline" | "escalatedAt" | "slaStatus" | "createdAt"
  >,
  now = new Date(),
  policy?: OrganizationSla | null,
): SlaStatus {
  // A work item without a priority does not participate in the SLA workflow.
  if (!workItem.priority) return SlaStatus.ON_TRACK;
  if (resolvedStatuses.has(workItem.status)) return SlaStatus.RESOLVED;
  if (workItem.escalatedAt || workItem.slaStatus === SlaStatus.ESCALATED) {
    return SlaStatus.ESCALATED;
  }
  if (!workItem.slaDeadline) return SlaStatus.ON_TRACK;
  if (now >= workItem.slaDeadline) return SlaStatus.BREACHED;
  const remaining = workItem.slaDeadline.getTime() - now.getTime();
  const riskHours =
    policy?.escalateHours ??
    getSlaHours(workItem.priority, policy) * SLA_AT_RISK_RATIO;
  const riskMs = riskHours * 3600000;
  return remaining <= riskMs ? SlaStatus.AT_RISK : SlaStatus.ON_TRACK;
}

export function getSlaSnapshot(workItem: WorkItem, now = new Date()): SlaSnapshot {
  if (!workItem.priority) {
    return {
      status: SlaStatus.ON_TRACK,
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
    overdueHours:
      remainingHours !== null && remainingHours < 0 ? Math.abs(remainingHours) : null,
    isEscalated: Boolean(workItem.escalatedAt),
    escalatedAt: workItem.escalatedAt,
    escalationReason: workItem.escalationReason,
    breachedAt: workItem.slaBreachedAt,
    resolvedAt: workItem.slaResolvedAt,
  };
}

export function clearSlaState(workItem: WorkItem): void {
  workItem.slaDeadline = null;
  workItem.slaDeadlineIsCustom = false;
  workItem.slaStatus = null;
  workItem.escalatedAt = null;
  workItem.escalatedById = null;
  workItem.escalationReason = null;
  workItem.slaBreachedAt = null;
  workItem.slaResolvedAt = null;
}

export function applySlaState(
  workItem: WorkItem,
  now = new Date(),
  policy?: OrganizationSla | null,
): SlaStatus {
  if (!workItem.priority) {
    clearSlaState(workItem);
    // ON_TRACK is the service's non-null return value; the persisted SLA status
    // remains null because this work item has no SLA.
    return SlaStatus.ON_TRACK;
  }

  const nextStatus = calculateSlaStatus(workItem, now, policy);
  if (nextStatus === SlaStatus.BREACHED && !workItem.slaBreachedAt) {
    workItem.slaBreachedAt = now;
  }
  if (nextStatus === SlaStatus.RESOLVED && !workItem.slaResolvedAt) {
    workItem.slaResolvedAt = now;
  }
  workItem.slaStatus = nextStatus;
  return nextStatus;
}

export async function ensureSlaData(
  workItem: WorkItem,
  manager: EntityManager,
): Promise<WorkItem> {
  if (!workItem.priority) {
    clearSlaState(workItem);
    return manager.getRepository(WorkItem).save(workItem);
  }

  const policy = await manager.getRepository(OrganizationSla).findOne({
    where: { organizationId: workItem.organizationId },
  });

  if (!workItem.slaDeadline) {
    workItem.slaDeadline = calculateSlaDeadline(
      workItem.createdAt,
      workItem.priority,
      policy,
    );
    workItem.slaDeadlineIsCustom = false;
  }
  applySlaState(workItem, new Date(), policy);
  return manager.getRepository(WorkItem).save(workItem);
}

export async function writeSlaAudit(
  manager: EntityManager,
  workItem: WorkItem,
  userId: string,
  action: string,
  description: string,
  previousState: unknown,
  newState: unknown,
): Promise<void> {
  await manager.getRepository(AuditLog).save(
    manager.getRepository(AuditLog).create({
      organizationId: workItem.organizationId,
      projectId: workItem.projectId,
      userId,
      action,
      entityType: "work_item",
      entityId: workItem.id,
      description,
      previousState,
      newState,
    }),
  );
}

export async function refreshSlaStatuses(
  manager: EntityManager,
): Promise<{ updatedCount: number; notifications: CreateNotificationInput[] }> {
  const now = new Date();
  const priorityRiskHours = `
    CASE
      WHEN "workItem"."priority" = 'URGENT' THEN 0.8
      WHEN "workItem"."priority" = 'HIGH' THEN 1.6
      WHEN "workItem"."priority" = 'MEDIUM' THEN 4.8
      WHEN "workItem"."priority" = 'LOW' THEN 14.4
      ELSE 0
    END
  `;
  // Select items that are unfinished, prioritized by items requiring immediate attention or oldest updated
  const candidates = await manager
    .getRepository(WorkItem)
    .createQueryBuilder("workItem")
    .where("workItem.status != :done", { done: WorkItemStatus.DONE })
    .andWhere(
      `(
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
                    WHERE policy.organization_id = "workItem"."organization_id"
                  ),
                  ${priorityRiskHours}
                ) * INTERVAL '1 hour'
              )
            )
            OR workItem.updatedAt < (
              SELECT policy.updated_at
              FROM organization_sla policy
              WHERE policy.organization_id = "workItem"."organization_id"
            )
          )
        )
      )`,
      { now, atRisk: SlaStatus.AT_RISK },
    )
    .orderBy("COALESCE(workItem.slaDeadline, workItem.createdAt)", "ASC")
    .addOrderBy("COALESCE(workItem.updatedAt, workItem.createdAt)", "ASC")
    .addOrderBy("workItem.id", "ASC")
    .take(500)
    .setLock("pessimistic_write")
    .setOnLocked("skip_locked")
    .getMany();

  const orgPolicies = new Map<string, OrganizationSla | null>();
  const notifications: CreateNotificationInput[] = [];
  let changed = 0;

  for (const item of candidates) {
    const previous = item.slaStatus;

    if (!item.priority) {
      const hadSlaState = Boolean(
        item.slaDeadline ||
          item.slaDeadlineIsCustom ||
          item.slaStatus ||
          item.escalatedAt ||
          item.escalatedById ||
          item.escalationReason ||
          item.slaBreachedAt ||
          item.slaResolvedAt,
      );

      if (hadSlaState) {
        clearSlaState(item);
        item.updatedAt = now;
        await manager.getRepository(WorkItem).save(item);
        changed += 1;
      }
      continue;
    }

    let policy = orgPolicies.get(item.organizationId);
    if (policy === undefined) {
      policy = await manager.getRepository(OrganizationSla).findOne({
        where: { organizationId: item.organizationId },
      });
      orgPolicies.set(item.organizationId, policy);
    }

    if (!item.slaDeadline) {
      item.slaDeadline = calculateSlaDeadline(
        item.createdAt,
        item.priority,
        policy,
      );
      item.slaDeadlineIsCustom = false;
    }

    // Automated SLA escalation:
    // If resolution deadline has passed, and item has not been escalated yet, and escalation was not previously resolved
    if (
      now >= item.slaDeadline &&
      !item.escalatedAt &&
      item.slaStatus !== SlaStatus.ESCALATED &&
      !item.slaResolvedAt
    ) {
      if (!item.slaBreachedAt) {
        item.slaBreachedAt = now;
      }
      item.slaStatus = SlaStatus.ESCALATED;
      item.escalatedAt = now;
      item.escalatedById = null;
      item.escalationReason =
        "Automated SLA escalation: task breached resolution deadline";
      item.updatedAt = now;

      await manager.getRepository(WorkItem).save(item);

      await writeSlaAudit(
        manager,
        item,
        item.createdById,
        "escalated",
        "Work item automatically escalated due to SLA deadline breach",
        { status: previous },
        {
          status: item.slaStatus,
          escalatedAt: item.escalatedAt,
          reason: item.escalationReason,
        },
      );

      const assignments = await manager.getRepository(WorkItemAssignee).find({
        where: { workItemId: item.id },
        select: { userId: true },
      });
      const recipients = new Set<string>([
        ...assignments.map((assignment) => assignment.userId),
        item.createdById,
      ]);

      for (const userId of recipients) {
        notifications.push({
          userId,
          organizationId: item.organizationId,
          type: NotificationType.SLA_ESCALATED,
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
      await manager.getRepository(WorkItem).save(item);

      if (next === SlaStatus.BREACHED && previous !== SlaStatus.BREACHED) {
        await writeSlaAudit(
          manager,
          item,
          item.createdById,
          "sla_breached",
          "Work item SLA breached during scheduled refresh",
          { status: previous },
          {
            status: next,
            breachedAt: item.slaBreachedAt,
            deadline: item.slaDeadline,
          },
        );
      }

      changed += 1;
    }
  }

  return { updatedCount: changed, notifications };
}
