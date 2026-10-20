"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireProjectPermission = void 0;
const data_source_1 = require("../config/data.source");
const project_entity_1 = require("../entities/project.entity");
const user_entity_1 = require("../entities/user.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const app_error_1 = require("../errors/app.error");
const permissions = {
    [project_member_entity_1.ProjectRole.ADMIN]: [
        "project:view",
        "project:update",
        "project:delete",
        "member:add",
        "member:remove",
        "member:role:update",
        "task:create",
        "task:read",
        "task:assign",
        "task:update",
        "task:delete",
        "sprint:view",
        "sprint:create",
        "sprint:update",
        "sprint:delete",
    ],
    [project_member_entity_1.ProjectRole.LEAD]: [
        "project:view",
        "project:update",
        "member:add",
        "member:role:update",
        "task:create",
        "task:read",
        "task:assign",
        "task:update",
        "task:delete",
        "sprint:view",
        "sprint:create",
        "sprint:update",
        "sprint:delete",
    ],
    [project_member_entity_1.ProjectRole.MEMBER]: [
        "project:view",
        "task:create",
        "task:read",
        "task:assign",
        "task:update",
        "sprint:view",
    ],
};
const requireProjectPermission = (action) => {
    return async (req, _res, next) => {
        const userId = req.user?.id;
        let projectId = Array.isArray(req.params.projectId)
            ? req.params.projectId[0]
            : req.params.projectId;
        if (!projectId && req.body && req.body.projectId) {
            projectId = req.body.projectId;
        }
        if (!projectId && req.query && typeof req.query.projectId === 'string') {
            projectId = req.query.projectId;
        }
        if (!projectId && req.params.workItemId) {
            const workItem = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
                where: { id: String(req.params.workItemId) },
                select: { projectId: true },
            });
            if (workItem) {
                projectId = workItem.projectId;
            }
        }
        if (!userId) {
            throw new app_error_1.AppError("Authentication required.", 401, "UNAUTHORIZED");
        }
        if (!projectId) {
            throw new app_error_1.AppError("Project ID is required.", 400, "PROJECT_ID_REQUIRED");
        }
        const userRepo = data_source_1.AppDataSource.getRepository(user_entity_1.User);
        const user = await userRepo.findOne({
            where: { id: userId },
            select: {
                id: true,
                organizationId: true,
                role: true,
            },
        });
        if (!user) {
            throw new app_error_1.AppError("Authenticated user not found.", 401, "USER_NOT_FOUND");
        }
        if (!user.organizationId) {
            throw new app_error_1.AppError("User is not associated with an organization.", 403, "ORGANIZATION_NOT_FOUND");
        }
        const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project).findOne({
            where: {
                id: projectId,
                organizationId: user.organizationId,
            },
            select: {
                id: true,
                organizationId: true,
                visibility: true,
            },
        });
        if (!project) {
            throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
        }
        const membership = await data_source_1.AppDataSource
            .getRepository(project_member_entity_1.ProjectMember)
            .findOne({
            where: {
                projectId: project.id,
                userId: user.id,
            },
        });
        // Organization ADMINs have full management over projects in their organization
        if (user.role === user_entity_1.UserRole.ADMIN) {
            next();
            return;
        }
        // Public projects may be viewed without membership.
        if ((action === "project:view" || action === "task:read") &&
            project.visibility === "PUBLIC" &&
            !membership) {
            next();
            return;
        }
        if (!membership) {
            throw new app_error_1.AppError("You are not a member of this project.", 403, "PROJECT_MEMBERSHIP_REQUIRED");
        }
        if (!permissions[membership.role]?.includes(action)) {
            throw new app_error_1.AppError("You do not have permission to perform this action.", 403, "PROJECT_PERMISSION_DENIED");
        }
        // Only project ADMIN can promote someone to project ADMIN.
        if (action === "member:role:update" &&
            req.body?.role === project_member_entity_1.ProjectRole.ADMIN &&
            membership.role !== project_member_entity_1.ProjectRole.ADMIN) {
            throw new app_error_1.AppError("Only a project administrator can assign the administrator role.", 403, "PROJECT_ADMIN_REQUIRED");
        }
        next();
    };
};
exports.requireProjectPermission = requireProjectPermission;
