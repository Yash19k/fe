import { EntityManager } from "typeorm";
import { ProjectWorkflow } from "../entities/project.workflow.entity";
import { WorkItemStatus } from "../entities/work.item.entity";
import { AppError } from "../errors/app.error";

type WorkflowStage = {
  id?: string;
  name: string;
  category?: string;
  color?: string;
  allowedTransitions?: unknown;
  roleRestrictions?: unknown;
};

export const DEFAULT_WORKFLOW_NAME = "TaskFlow Pro — Final Statuses";

export const DEFAULT_WORKFLOW_STATUSES: WorkflowStage[] = [
  { id: "st-backlog", name: "Backlog", category: "unstarted", color: "#6B7280", allowedTransitions: ["In Progress"] },
  { id: "st-inprogress", name: "In Progress", category: "active", color: "#3B82F6", allowedTransitions: ["In Review", "Testing / QA", "Blocked", "On Hold"] },
  { id: "st-inreview", name: "In Review", category: "active", color: "#A855F7", allowedTransitions: ["Testing / QA", "In Progress", "Blocked", "On Hold"] },
  { id: "st-testingqa", name: "Testing / QA", category: "active", color: "#06B6D4", allowedTransitions: ["Done", "In Progress", "Blocked", "On Hold"], roleRestrictions: { Done: ["Manager", "Admin"] } },
  { id: "st-blocked", name: "Blocked", category: "impediment", color: "#EF4444", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
  { id: "st-onhold", name: "On Hold", category: "impediment", color: "#F97316", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
  { id: "st-done", name: "Done", category: "completed", color: "#22C55E", allowedTransitions: ["In Progress"] },
];

function normalizeStatus(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isWorkflowStage(value: unknown): value is WorkflowStage {
  return typeof value === "object" && value !== null &&
    "name" in value && typeof value.name === "string";
}

export function validateWorkItemStatusTransition(
  currentStatus: WorkItemStatus,
  nextStatus: WorkItemStatus,
  actorRole: string,
  configuredStages: unknown,
): void {
  if (currentStatus === nextStatus) return;

  const stages = Array.isArray(configuredStages) && configuredStages.every(isWorkflowStage)
    ? configuredStages
    : [];
  const currentStage = stages.find(
    (stage) => normalizeStatus(stage.name) === normalizeStatus(currentStatus),
  );
  const nextStage = stages.find(
    (stage) => normalizeStatus(stage.name) === normalizeStatus(nextStatus),
  );

  if (!currentStage || !nextStage || !Array.isArray(currentStage.allowedTransitions)) {
    throw new AppError(
      "This status transition is not configured for the project workflow.",
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const allowedTransitions = currentStage.allowedTransitions.filter(
    (transition): transition is string => typeof transition === "string",
  );
  const canTransition = allowedTransitions.some(
    (transition) =>
      normalizeStatus(transition) === normalizeStatus(nextStage.name) ||
      (nextStage.id !== undefined &&
        normalizeStatus(transition) === normalizeStatus(nextStage.id)),
  );

  if (!canTransition) {
    throw new AppError(
      "This status transition is not allowed by the project workflow.",
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const restrictions = currentStage.roleRestrictions;
  if (typeof restrictions === "object" && restrictions !== null) {
    const targetRestriction = Object.entries(restrictions).find(
      ([status]) => normalizeStatus(status) === normalizeStatus(nextStage.name),
    )?.[1];
    if (targetRestriction !== undefined) {
      const allowedRoles = Array.isArray(targetRestriction)
        ? targetRestriction.filter((role): role is string => typeof role === "string")
        : [];
      if (!allowedRoles.some((role) => normalizeStatus(role) === normalizeStatus(actorRole))) {
        throw new AppError(
          "Your role is not permitted to move this work item to that status.",
          403,
          "FORBIDDEN",
        );
      }
    }
  }
}

export async function assertWorkItemStatusTransition(
  manager: EntityManager,
  projectId: string,
  currentStatus: WorkItemStatus,
  nextStatus: WorkItemStatus,
  actorRole: string,
): Promise<void> {
  if (currentStatus === nextStatus) return;

  const workflow = await manager.getRepository(ProjectWorkflow).findOne({
    where: { projectId },
    select: { statuses: true },
  });
  validateWorkItemStatusTransition(
    currentStatus,
    nextStatus,
    actorRole,
    workflow ? workflow.statuses : DEFAULT_WORKFLOW_STATUSES,
  );
}
