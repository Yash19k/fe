"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWhiteboard = createWhiteboard;
exports.listWhiteboards = listWhiteboards;
exports.getWhiteboard = getWhiteboard;
exports.updateWhiteboard = updateWhiteboard;
exports.listWhiteboardRevisions = listWhiteboardRevisions;
exports.getWhiteboardRevision = getWhiteboardRevision;
exports.renameWhiteboard = renameWhiteboard;
exports.deleteWhiteboard = deleteWhiteboard;
const data_source_1 = require("../config/data.source");
const project_entity_1 = require("../entities/project.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const user_entity_1 = require("../entities/user.entity");
const whiteboard_entity_1 = require("../entities/whiteboard.entity");
const whiteboard_revision_entity_1 = require("../entities/whiteboard.revision.entity");
const app_error_1 = require("../errors/app.error");
function cloneScene(sceneData) {
    return JSON.parse(JSON.stringify(sceneData));
}
const REVISION_RETENTION_COUNT = 100;
async function assertAccess(projectId, userId, organizationId, write) {
    if (!organizationId) {
        throw new app_error_1.AppError("User is not associated with an organization.", 403, "ORGANIZATION_NOT_FOUND");
    }
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project).findOne({
        where: { id: projectId, organizationId },
    });
    if (!project)
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, role: true },
    });
    if (user?.role === user_entity_1.UserRole.ADMIN)
        return project;
    const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({
        where: { projectId, userId },
    });
    if (!membership && (write || project.visibility !== "PUBLIC")) {
        throw new app_error_1.AppError("You are not a member of this project.", 403, "PROJECT_MEMBERSHIP_REQUIRED");
    }
    if (write && membership?.role === project_member_entity_1.ProjectRole.MEMBER) {
        throw new app_error_1.AppError("You do not have permission to modify whiteboards.", 403, "PROJECT_PERMISSION_DENIED");
    }
    return project;
}
function publicWhiteboard(whiteboard, includeScene = false) {
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
async function createWhiteboard(projectId, userId, organizationId, name) {
    const project = await assertAccess(projectId, userId, organizationId, true);
    const whiteboard = data_source_1.AppDataSource.getRepository(whiteboard_entity_1.Whiteboard).create({
        projectId,
        organizationId: project.organizationId,
        createdById: userId,
        name,
        sceneData: { elements: [], appState: {}, files: {} },
        revision: 1,
    });
    const saved = await data_source_1.AppDataSource.transaction(async (manager) => {
        const created = await manager.getRepository(whiteboard_entity_1.Whiteboard).save(whiteboard);
        await manager.getRepository(whiteboard_revision_entity_1.WhiteboardRevision).save({
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
async function listWhiteboards(projectId, userId, organizationId, page, limit) {
    await assertAccess(projectId, userId, organizationId, false);
    const repo = data_source_1.AppDataSource.getRepository(whiteboard_entity_1.Whiteboard);
    const [rows, total] = await repo.findAndCount({
        where: { projectId, organizationId },
        order: { updatedAt: "DESC" },
        skip: (page - 1) * limit,
        take: limit,
    });
    return { items: rows.map((row) => publicWhiteboard(row)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function getAuthorizedWhiteboard(whiteboardId, userId, organizationId, write) {
    const whiteboard = await data_source_1.AppDataSource.getRepository(whiteboard_entity_1.Whiteboard).findOne({
        where: { id: whiteboardId, organizationId },
    });
    if (!whiteboard)
        throw new app_error_1.AppError("Whiteboard not found.", 404, "WHITEBOARD_NOT_FOUND");
    await assertAccess(whiteboard.projectId, userId, organizationId, write);
    return whiteboard;
}
async function getWhiteboard(id, userId, organizationId) {
    return publicWhiteboard(await getAuthorizedWhiteboard(id, userId, organizationId, false), true);
}
async function updateWhiteboard(id, userId, organizationId, sceneData, revision) {
    const whiteboard = await getAuthorizedWhiteboard(id, userId, organizationId, true);
    if (whiteboard.revision !== revision) {
        throw new app_error_1.AppError("Whiteboard has changed since it was loaded.", 409, "WHITEBOARD_REVISION_CONFLICT");
    }
    const nextRevision = revision + 1;
    const saved = await data_source_1.AppDataSource.transaction(async (manager) => {
        const result = await manager
            .getRepository(whiteboard_entity_1.Whiteboard)
            .createQueryBuilder()
            .update(whiteboard_entity_1.Whiteboard)
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
            throw new app_error_1.AppError("Whiteboard has changed since it was loaded.", 409, "WHITEBOARD_REVISION_CONFLICT");
        }
        await manager.getRepository(whiteboard_revision_entity_1.WhiteboardRevision).save({
            whiteboardId: id,
            revisionNumber: nextRevision,
            createdById: userId,
            sceneSnapshot: cloneScene(sceneData),
            changeSummary: "Scene update",
        });
        await manager
            .getRepository(whiteboard_revision_entity_1.WhiteboardRevision)
            .createQueryBuilder()
            .delete()
            .where("whiteboard_id = :whiteboardId", { whiteboardId: id })
            .andWhere("revision_number <= (SELECT MAX(revision_number) - :retention FROM whiteboard_revisions WHERE whiteboard_id = :whiteboardId)", { retention: REVISION_RETENTION_COUNT, whiteboardId: id })
            .execute();
        return manager.getRepository(whiteboard_entity_1.Whiteboard).findOneByOrFail({ id });
    });
    return publicWhiteboard(saved, true);
}
async function listWhiteboardRevisions(id, userId, organizationId, page, limit) {
    await getAuthorizedWhiteboard(id, userId, organizationId, false);
    const [items, total] = await data_source_1.AppDataSource.getRepository(whiteboard_revision_entity_1.WhiteboardRevision).findAndCount({
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
async function getWhiteboardRevision(id, revisionNumber, userId, organizationId) {
    await getAuthorizedWhiteboard(id, userId, organizationId, false);
    const revision = await data_source_1.AppDataSource.getRepository(whiteboard_revision_entity_1.WhiteboardRevision).findOne({
        where: { whiteboardId: id, revisionNumber },
    });
    if (!revision)
        throw new app_error_1.AppError("Whiteboard revision not found.", 404, "WHITEBOARD_REVISION_NOT_FOUND");
    return revision;
}
async function renameWhiteboard(id, userId, organizationId, name) {
    const whiteboard = await getAuthorizedWhiteboard(id, userId, organizationId, true);
    whiteboard.name = name;
    return publicWhiteboard(await data_source_1.AppDataSource.getRepository(whiteboard_entity_1.Whiteboard).save(whiteboard));
}
async function deleteWhiteboard(id, userId, organizationId) {
    const whiteboard = await getAuthorizedWhiteboard(id, userId, organizationId, true);
    await data_source_1.AppDataSource.getRepository(whiteboard_entity_1.Whiteboard).remove(whiteboard);
}
