import { AppDataSource } from "../config/data.source";
import { Project } from "../entities/project.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { User, UserRole } from "../entities/user.entity";
import { Whiteboard } from "../entities/whiteboard.entity";
import { WhiteboardRevision } from "../entities/whiteboard.revision.entity";
import { AppError } from "../errors/app.error";

export interface WhiteboardScene {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  [key: string]: unknown;
}

function cloneScene(sceneData: WhiteboardScene): Record<string, unknown> {
  return JSON.parse(JSON.stringify(sceneData)) as Record<string, unknown>;
}

const REVISION_RETENTION_COUNT = 100;

async function assertAccess(
  projectId: string,
  userId: string,
  organizationId: string | undefined,
  write: boolean,
): Promise<Project> {
  if (!organizationId) {
    throw new AppError("User is not associated with an organization.", 403, "ORGANIZATION_NOT_FOUND");
  }
  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id: projectId, organizationId },
  });
  if (!project) throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (user?.role === UserRole.ADMIN) return project;

  const membership = await AppDataSource.getRepository(ProjectMember).findOne({
    where: { projectId, userId },
  });
  if (!membership && (write || project.visibility !== "PUBLIC")) {
    throw new AppError("You are not a member of this project.", 403, "PROJECT_MEMBERSHIP_REQUIRED");
  }
  if (write && membership?.role === ProjectRole.MEMBER) {
    throw new AppError("You do not have permission to modify whiteboards.", 403, "PROJECT_PERMISSION_DENIED");
  }
  return project;
}

function publicWhiteboard(whiteboard: Whiteboard, includeScene = false) {
  return {
    id: whiteboard.id,
    projectId: whiteboard.projectId,
    name: whiteboard.name,
    revision: whiteboard.revision,
    createdById: whiteboard.createdById,
    createdAt: whiteboard.createdAt,
    updatedAt: whiteboard.updatedAt,
    ...(includeScene ? { sceneData: whiteboard.sceneData } : {}),
  };
}

export async function createWhiteboard(
  projectId: string,
  userId: string,
  organizationId: string | undefined,
  name: string,
) {
  const project = await assertAccess(projectId, userId, organizationId, true);
  const whiteboard = AppDataSource.getRepository(Whiteboard).create({
    projectId,
    organizationId: project.organizationId,
    createdById: userId,
    name,
    sceneData: { elements: [], appState: {}, files: {} },
    revision: 1,
  });
  const saved = await AppDataSource.transaction(async (manager) => {
    const created = await manager.getRepository(Whiteboard).save(whiteboard);
    await manager.getRepository(WhiteboardRevision).save({
      whiteboardId: created.id,
      revisionNumber: created.revision,
      createdById: userId,
      sceneSnapshot: created.sceneData,
      changeSummary: "Initial whiteboard snapshot",
    });
    return created;
  });
  return publicWhiteboard(saved, true);
}

export async function listWhiteboards(
  projectId: string,
  userId: string,
  organizationId: string | undefined,
  page: number,
  limit: number,
) {
  await assertAccess(projectId, userId, organizationId, false);
  const repo = AppDataSource.getRepository(Whiteboard);
  const [rows, total] = await repo.findAndCount({
    where: { projectId, organizationId },
    order: { updatedAt: "DESC" },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { items: rows.map((row) => publicWhiteboard(row)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getAuthorizedWhiteboard(
  whiteboardId: string,
  userId: string,
  organizationId: string | undefined,
  write: boolean,
) {
  const whiteboard = await AppDataSource.getRepository(Whiteboard).findOne({
    where: { id: whiteboardId, organizationId },
  });
  if (!whiteboard) throw new AppError("Whiteboard not found.", 404, "WHITEBOARD_NOT_FOUND");
  await assertAccess(whiteboard.projectId, userId, organizationId, write);
  return whiteboard;
}

export async function getWhiteboard(id: string, userId: string, organizationId: string | undefined) {
  return publicWhiteboard(await getAuthorizedWhiteboard(id, userId, organizationId, false), true);
}

export async function updateWhiteboard(
  id: string,
  userId: string,
  organizationId: string | undefined,
  sceneData: WhiteboardScene,
  revision: number,
) {
  const whiteboard = await getAuthorizedWhiteboard(id, userId, organizationId, true);
  if (whiteboard.revision !== revision) {
    throw new AppError("Whiteboard has changed since it was loaded.", 409, "WHITEBOARD_REVISION_CONFLICT");
  }
  const nextRevision = revision + 1;
  const saved = await AppDataSource.transaction(async (manager) => {
    const result = await manager
      .getRepository(Whiteboard)
      .createQueryBuilder()
      .update(Whiteboard)
      .set({
        sceneData: () => "CAST(:sceneData AS jsonb)",
        revision: nextRevision,
      })
      .where("id = :id AND organization_id = :organizationId AND revision = :revision", {
        id,
        organizationId,
        revision,
      })
      .setParameter("sceneData", JSON.stringify(cloneScene(sceneData)))
      .execute();

    if (result.affected !== 1) {
      throw new AppError("Whiteboard has changed since it was loaded.", 409, "WHITEBOARD_REVISION_CONFLICT");
    }

    await manager.getRepository(WhiteboardRevision).save({
      whiteboardId: id,
      revisionNumber: nextRevision,
      createdById: userId,
      sceneSnapshot: cloneScene(sceneData),
      changeSummary: "Scene update",
    });
    await manager
      .getRepository(WhiteboardRevision)
      .createQueryBuilder()
      .delete()
      .where("whiteboard_id = :whiteboardId", { whiteboardId: id })
      .andWhere(
        "revision_number <= (SELECT MAX(revision_number) - :retention FROM whiteboard_revisions WHERE whiteboard_id = :whiteboardId)",
        { retention: REVISION_RETENTION_COUNT, whiteboardId: id },
      )
      .execute();

    return manager.getRepository(Whiteboard).findOneByOrFail({ id });
  });
  return publicWhiteboard(saved, true);
}

export async function listWhiteboardRevisions(
  id: string,
  userId: string,
  organizationId: string | undefined,
  page: number,
  limit: number,
) {
  await getAuthorizedWhiteboard(id, userId, organizationId, false);
  const [items, total] = await AppDataSource.getRepository(WhiteboardRevision).findAndCount({
    where: { whiteboardId: id },
    order: { revisionNumber: "DESC" },
    skip: (page - 1) * limit,
    take: limit,
  });
  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getWhiteboardRevision(
  id: string,
  revisionNumber: number,
  userId: string,
  organizationId: string | undefined,
) {
  await getAuthorizedWhiteboard(id, userId, organizationId, false);
  const revision = await AppDataSource.getRepository(WhiteboardRevision).findOne({
    where: { whiteboardId: id, revisionNumber },
  });
  if (!revision) throw new AppError("Whiteboard revision not found.", 404, "WHITEBOARD_REVISION_NOT_FOUND");
  return revision;
}

export async function renameWhiteboard(id: string, userId: string, organizationId: string | undefined, name: string) {
  const whiteboard = await getAuthorizedWhiteboard(id, userId, organizationId, true);
  whiteboard.name = name;
  return publicWhiteboard(await AppDataSource.getRepository(Whiteboard).save(whiteboard));
}

export async function deleteWhiteboard(id: string, userId: string, organizationId: string | undefined) {
  const whiteboard = await getAuthorizedWhiteboard(id, userId, organizationId, true);
  await AppDataSource.getRepository(Whiteboard).remove(whiteboard);
}
