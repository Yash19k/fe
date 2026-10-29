import { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { ProjectLabel } from "../entities/project.label.entity";
import { ProjectWorkflow } from "../entities/project.workflow.entity";
import { Project } from "../entities/project.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { UserRole } from "../entities/user.entity";
import { AppError } from "../errors/app.error";

/**
 * Validates that the project exists in the user's organization and
 * verifies user permissions for project-level settings operations.
 */
async function assertProjectSettingsAccess(
  projectId: string,
  req: Request,
  requiresWrite = false,
): Promise<Project> {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;

  if (!userId || !organizationId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id: projectId, organizationId },
  });

  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  // Organization admins have full access
  if (req.user?.role === UserRole.ADMIN) {
    return project;
  }

  // Check project membership
  const membership = await AppDataSource.getRepository(ProjectMember).findOne({
    where: { projectId, userId },
  });

  if (!membership) {
    // If public project and read-only, allow
    if (!requiresWrite && project.visibility === "PUBLIC") {
      return project;
    }
    throw new AppError(
      "You are not a member of this project.",
      403,
      "FORBIDDEN",
    );
  }

  if (requiresWrite && membership.role === ProjectRole.MEMBER) {
    throw new AppError(
      "You do not have permission to modify project settings.",
      403,
      "FORBIDDEN",
    );
  }

  return project;
}

// ==========================================
// Labels
// ==========================================

export async function getProjectLabels(req: Request, res: Response) {
  const projectId = String(req.params.projectId);

  await assertProjectSettingsAccess(projectId, req, false);

  const labels = await AppDataSource.getRepository(ProjectLabel).find({
    where: { projectId },
    order: { name: "ASC" },
  });

  return res.json({
    success: true,
    data: labels,
  });
}

export async function createProjectLabel(req: Request, res: Response) {
  const projectId = String(req.params.projectId);
  const { name, color, description } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new AppError("Label name is required.", 400, "VALIDATION_ERROR");
  }

  await assertProjectSettingsAccess(projectId, req, true);

  const repo = AppDataSource.getRepository(ProjectLabel);
  const existing = await repo.findOne({
    where: { projectId, name: name.trim() },
  });

  if (existing) {
    return res.status(200).json({ success: true, data: existing });
  }

  const label = await repo.save(
    repo.create({
      projectId,
      name: name.trim(),
      color: color ? String(color).trim() : "#3B82F6",
      description: description ? String(description).trim() : null,
    }),
  );

  return res.status(201).json({ success: true, data: label });
}

export async function deleteProjectLabel(req: Request, res: Response) {
  const projectId = String(req.params.projectId);
  const labelId = String(req.params.labelId);

  await assertProjectSettingsAccess(projectId, req, true);

  await AppDataSource.getRepository(ProjectLabel).delete({
    id: labelId,
    projectId,
  });

  return res.json({ success: true });
}

// ==========================================
// Workflows
// ==========================================

export const DEFAULT_WORKFLOW_NAME = "TaskFlow Pro — Final Statuses";

export const DEFAULT_WORKFLOW_STATUSES = [
  { id: "st-backlog", name: "Backlog", category: "unstarted", color: "#6B7280", allowedTransitions: ["In Progress"] },
  { id: "st-inprogress", name: "In Progress", category: "active", color: "#3B82F6", allowedTransitions: ["In Review", "Testing / QA", "Blocked", "On Hold"] },
  { id: "st-inreview", name: "In Review", category: "active", color: "#A855F7", allowedTransitions: ["Testing / QA", "In Progress", "Blocked", "On Hold"] },
  { id: "st-testingqa", name: "Testing / QA", category: "active", color: "#06B6D4", allowedTransitions: ["Done", "In Progress", "Blocked", "On Hold"], roleRestrictions: { Done: ["Manager", "Admin"] } },
  { id: "st-blocked", name: "Blocked", category: "impediment", color: "#EF4444", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
  { id: "st-onhold", name: "On Hold", category: "impediment", color: "#F97316", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
  { id: "st-done", name: "Done", category: "completed", color: "#22C55E", allowedTransitions: ["In Progress"] },
];

export async function getProjectWorkflow(req: Request, res: Response) {
  const projectId = String(req.params.projectId);

  await assertProjectSettingsAccess(projectId, req, false);

  const workflow = await AppDataSource.getRepository(ProjectWorkflow).findOne({
    where: { projectId },
  });

  if (!workflow) {
    return res.json({
      success: true,
      data: {
        id: `default-${projectId}`,
        projectId,
        name: DEFAULT_WORKFLOW_NAME,
        statuses: DEFAULT_WORKFLOW_STATUSES,
        stages: DEFAULT_WORKFLOW_STATUSES,
        isDefault: true,
      },
    });
  }

  // Normalize legacy generic or raw UUID workflow names
  const isGenericName =
    !workflow.name ||
    workflow.name === "Custom Engineering Flow" ||
    workflow.name.endsWith(" Workflow") ||
    /^[0-9a-fA-F-]{20,}/.test(workflow.name);

  const resolvedName = isGenericName ? DEFAULT_WORKFLOW_NAME : workflow.name;

  return res.json({
    success: true,
    data: {
      ...workflow,
      name: resolvedName,
      stages: workflow.statuses,
    },
  });
}

export async function saveProjectWorkflow(req: Request, res: Response) {
  const projectId = String(req.params.projectId);
  const stages = req.body.stages || req.body.statuses;
  const rawName = req.body.name ? String(req.body.name).trim() : "";
  const name =
    rawName && rawName !== "Custom Engineering Flow" && !rawName.endsWith(" Workflow")
      ? rawName
      : DEFAULT_WORKFLOW_NAME;

  if (!stages || !Array.isArray(stages) || stages.length === 0) {
    throw new AppError(
      "Workflow stages or statuses array is required and must not be empty.",
      400,
      "VALIDATION_ERROR",
    );
  }

  await assertProjectSettingsAccess(projectId, req, true);

  const repo = AppDataSource.getRepository(ProjectWorkflow);
  let workflow = await repo.findOne({ where: { projectId } });

  if (workflow) {
    workflow.name = name;
    workflow.statuses = stages;
    const saved = await repo.save(workflow);
    return res.json({
      success: true,
      data: {
        id: saved.id,
        projectId: saved.projectId,
        name: saved.name,
        statuses: saved.statuses,
        stages: saved.statuses,
        updatedAt: saved.updatedAt,
      },
    });
  } else {
    const created = repo.create({
      projectId,
      name,
      statuses: stages,
    });
    const saved = await repo.save(created);
    return res.json({
      success: true,
      data: {
        id: saved.id,
        projectId: saved.projectId,
        name: saved.name,
        statuses: saved.statuses,
        stages: saved.statuses,
        createdAt: saved.createdAt,
      },
    });
  }
}
