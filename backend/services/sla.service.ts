import { EntityManager } from "typeorm";
import { AuditLog } from "../entities/audit.log.entity";
import {
  SlaStatus,
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
} from "../entities/work.item.entity";

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

export function getSlaHours(priority: WorkItemPriority): number {
  return SLA_POLICY_HOURS[priority] ?? SLA_POLICY_HOURS[WorkItemPriority.MEDIUM];
}

export function calculateSlaDeadline(
  createdAt: Date,
  priority: WorkItemPriority,
): Date {
  return new Date(createdAt.getTime() + getSlaHours(priority) * 60 * 60 * 1000);
}

export function calculateSlaStatus(
  workItem: Pick<
    WorkItem,
    "status" | "priority" | "slaDeadline" | "escalatedAt" | "slaStatus" | "createdAt"
  >,
  now = new Date(),
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
  const total = Math.max(1, workItem.slaDeadline.getTime() - workItem.createdAt.getTime());
  return remaining <= total * SLA_AT_RISK_RATIO
    ? SlaStatus.AT_RISK
    : SlaStatus.ON_TRACK;
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
    overdueHours: remainingHours !== null && remainingHours < 0 ? Math.abs(remainingHours) : null,
    isEscalated: Boolean(workItem.escalatedAt),
    escalatedAt: workItem.escalatedAt,
    escalationReason: workItem.escalationReason,
    breachedAt: workItem.slaBreachedAt,
    resolvedAt: workItem.slaResolvedAt,
  };
}

function clearSlaState(workItem: WorkItem): void {
  workItem.slaDeadline = null;
  workItem.slaDeadlineIsCustom = false;
  workItem.slaStatus = null;
  workItem.escalatedAt = null;
  workItem.escalatedById = null;
  workItem.escalationReason = null;
  workItem.slaBreachedAt = null;
  workItem.slaResolvedAt = null;
}

export function applySlaState(workItem: WorkItem, now = new Date()): SlaStatus {
  if (!workItem.priority) {
    clearSlaState(workItem);
    // ON_TRACK is the service's non-null return value; the persisted SLA status
    // remains null because this work item has no SLA.
    return SlaStatus.ON_TRACK;
  }

  const nextStatus = calculateSlaStatus(workItem, now);
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

  if (!workItem.slaDeadline) {
    workItem.slaDeadline = calculateSlaDeadline(workItem.createdAt, workItem.priority);
    workItem.slaDeadlineIsCustom = false;
  }
  applySlaState(workItem);
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

export async function refreshSlaStatuses(manager: EntityManager): Promise<number> {
  const candidates = await manager
    .getRepository(WorkItem)
    .createQueryBuilder("workItem")
    .where("workItem.status != :done", { done: WorkItemStatus.DONE })
    .take(500)
    .setLock("pessimistic_write")
    .getMany();

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
        item.slaResolvedAt
      );

      if (hadSlaState) {
        clearSlaState(item);
        await manager.getRepository(WorkItem).save(item);
        changed += 1;
      }
      continue;
    }

    if (!item.slaDeadline) {
      item.slaDeadline = calculateSlaDeadline(item.createdAt, item.priority);
      item.slaDeadlineIsCustom = false;
    }

    const next = applySlaState(item);

    if (previous !== next) {
      await manager.getRepository(WorkItem).save(item);

      if (next === SlaStatus.BREACHED && previous !== SlaStatus.BREACHED) {
        await writeSlaAudit(
          manager,
          item,
          item.createdById,
          "sla_breached",
          "Work item SLA breached during scheduled refresh",
          { status: previous },
          { status: next, breachedAt: item.slaBreachedAt, deadline: item.slaDeadline },
        );
      }

      changed += 1;
    }
  }

  return changed;
}
