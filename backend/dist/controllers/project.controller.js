"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProjectMemberRole = exports.removeProjectMember = exports.addProjectMember = exports.getProjectMembers = exports.deleteProject = exports.updateProject = exports.viewProject = exports.viewProjects = exports.createProject = void 0;
const data_source_1 = require("../config/data.source");
const project_entity_1 = require("../entities/project.entity");
const user_entity_1 = require("../entities/user.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const app_error_1 = require("../errors/app.error");
const notification_entity_1 = require("../entities/notification.entity");
const notification_service_1 = require("../services/notification.service");
const getActor = async (req) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new app_error_1.AppError("Authentication required.", 401, "UNAUTHORIZED");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true, role: true },
    });
    if (!user) {
        throw new app_error_1.AppError("Authenticated user not found.", 401, "USER_NOT_FOUND");
    }
    if (!user.organizationId) {
        throw new app_error_1.AppError("User is not associated with an organization.", 403, "ORGANIZATION_NOT_FOUND");
    }
    return {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
    };
};
const getProject = async (projectId, organizationId, manager = data_source_1.AppDataSource.manager) => {
    const project = await manager.getRepository(project_entity_1.Project).findOne({
        where: { id: projectId, organizationId },
    });
    if (!project) {
        // Deliberately avoid revealing whether another organization's project exists.
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    return project;
};
const ensureNotLastProjectAdmin = async (manager, projectId, member) => {
    if (member.role !== project_member_entity_1.ProjectRole.ADMIN)
        return;
    const count = await manager.getRepository(project_member_entity_1.ProjectMember).count({
        where: { projectId, role: project_member_entity_1.ProjectRole.ADMIN },
    });
    if (count <= 1) {
        throw new app_error_1.AppError("A project must have at least one project administrator.", 409, "LAST_PROJECT_ADMIN");
    }
};
const createProject = async (req, res) => {
    const actor = await getActor(req);
    const { name, key, description, startDate, endDate, visibility } = req.body;
    const project = await data_source_1.AppDataSource.transaction(async (manager) => {
        const projectRepo = manager.getRepository(project_entity_1.Project);
        const userRepo = manager.getRepository(user_entity_1.User);
        const memberRepo = manager.getRepository(project_member_entity_1.ProjectMember);
        // Re-read the user inside the transaction to use the current organization.
        const user = await userRepo.findOne({
            where: { id: actor.id },
            select: { id: true, organizationId: true },
        });
        if (!user?.organizationId) {
            throw new app_error_1.AppError("User is not associated with an organization.", 403, "ORGANIZATION_NOT_FOUND");
        }
        const normalizedKey = String(key).trim().toUpperCase();
        const existing = await projectRepo.findOne({
            where: { organizationId: user.organizationId, key: normalizedKey },
            select: { id: true },
        });
        if (existing) {
            throw new app_error_1.AppError("This project key is already used in your organization.", 409, "PROJECT_KEY_CONFLICT");
        }
        const savedProject = await projectRepo.save(projectRepo.create({
            name: String(name).trim(),
            key: normalizedKey,
            description: description?.trim() || null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            visibility: visibility ?? project_entity_1.ProjectVisibility.PRIVATE,
            organizationId: user.organizationId,
            createdById: user.id,
        }));
        await memberRepo.save(memberRepo.create({
            projectId: savedProject.id,
            userId: user.id,
            addedById: user.id,
            role: project_member_entity_1.ProjectRole.ADMIN,
        }));
        return savedProject;
    });
    res.status(201).json({
        success: true,
        message: "Project created successfully.",
        data: project,
    });
};
exports.createProject = createProject;
const viewProjects = async (req, res) => {
    const actor = await getActor(req);
    const query = data_source_1.AppDataSource.getRepository(project_entity_1.Project)
        .createQueryBuilder("project")
        .leftJoin("project.memberships", "currentMembership", "currentMembership.userId = :userId", { userId: actor.id })
        .where("project.organizationId = :organizationId", {
        organizationId: actor.organizationId,
    })
        .andWhere(`(
        project.visibility = :publicVisibility
        OR :isOrganizationAdmin = true
        OR currentMembership.userId = :userId
      )`, {
        publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
        isOrganizationAdmin: actor.role === user_entity_1.UserRole.ADMIN,
        userId: actor.id,
    })
        .orderBy("project.createdAt", "DESC");
    const projects = await query.getMany();
    res.status(200).json({
        success: true,
        message: "Projects retrieved successfully.",
        count: projects.length,
        data: projects,
    });
};
exports.viewProjects = viewProjects;
const viewProject = async (req, res) => {
    const actor = await getActor(req);
    const project = await getProject(String(req.params.projectId), actor.organizationId);
    res.status(200).json({
        success: true,
        message: "Project retrieved successfully.",
        data: project,
    });
};
exports.viewProject = viewProject;
const updateProject = async (req, res) => {
    const actor = await getActor(req);
    const projectId = String(req.params.projectId);
    const { name, key, description, startDate, endDate, visibility } = req.body;
    const saved = await data_source_1.AppDataSource.transaction(async (manager) => {
        const project = await getProject(projectId, actor.organizationId, manager);
        if (name !== undefined)
            project.name = name.trim();
        if (key !== undefined) {
            const normalizedKey = key.trim().toUpperCase();
            const duplicate = await manager.getRepository(project_entity_1.Project).findOne({
                where: {
                    organizationId: actor.organizationId,
                    key: normalizedKey,
                },
                select: { id: true },
            });
            if (duplicate && duplicate.id !== project.id) {
                throw new app_error_1.AppError("This project key is already used in your organization.", 409, "PROJECT_KEY_CONFLICT");
            }
            project.key = normalizedKey;
        }
        if (description !== undefined) {
            project.description = description ? description.trim() : null;
        }
        if (startDate !== undefined)
            project.startDate = startDate || null;
        if (endDate !== undefined)
            project.endDate = endDate || null;
        if (visibility !== undefined)
            project.visibility = visibility;
        if (project.startDate &&
            project.endDate &&
            project.endDate < project.startDate) {
            throw new app_error_1.AppError("endDate must be on or after startDate.", 400, "INVALID_PROJECT_DATE_RANGE");
        }
        return manager.getRepository(project_entity_1.Project).save(project);
    });
    res.status(200).json({
        success: true,
        message: "Project updated successfully.",
        data: saved,
    });
};
exports.updateProject = updateProject;
const deleteProject = async (req, res) => {
    const actor = await getActor(req);
    const projectId = String(req.params.projectId);
    await data_source_1.AppDataSource.transaction(async (manager) => {
        const project = await getProject(projectId, actor.organizationId, manager);
        // FK/cascade behavior must match the product's retention policy.
        await manager.getRepository(project_entity_1.Project).remove(project);
    });
    res.status(200).json({
        success: true,
        message: "Project deleted successfully.",
        data: { id: projectId },
    });
};
exports.deleteProject = deleteProject;
const getProjectMembers = async (req, res) => {
    const actor = await getActor(req);
    const project = await getProject(String(req.params.projectId), actor.organizationId);
    const members = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).find({
        where: { projectId: project.id },
        relations: { user: true },
        order: { joinedAt: "ASC" },
    });
    res.status(200).json({
        success: true,
        data: members.map((membership) => ({
            userId: membership.userId,
            role: membership.role,
            joinedAt: membership.joinedAt,
            name: membership.user?.fullName,
            email: membership.user?.email,
        })),
    });
};
exports.getProjectMembers = getProjectMembers;
const addProjectMember = async (req, res) => {
    const actor = await getActor(req);
    const projectId = String(req.params.projectId);
    const { memberId, email, role = project_member_entity_1.ProjectRole.MEMBER } = req.body;
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const project = await getProject(projectId, actor.organizationId, manager);
        const userRepo = manager.getRepository(user_entity_1.User);
        const targetUser = memberId
            ? await userRepo.findOne({
                where: { id: memberId, organizationId: actor.organizationId },
            })
            : await userRepo.findOne({
                where: {
                    email: String(email).trim().toLowerCase(),
                    organizationId: actor.organizationId,
                },
            });
        if (!targetUser) {
            throw new app_error_1.AppError("User not found in your organization.", 404, "USER_NOT_FOUND");
        }
        const memberRepo = manager.getRepository(project_member_entity_1.ProjectMember);
        const existing = await memberRepo.findOne({
            where: { projectId: project.id, userId: targetUser.id },
        });
        if (existing) {
            throw new app_error_1.AppError("This user is already a member of the project.", 409, "PROJECT_MEMBER_EXISTS");
        }
        if (role === project_member_entity_1.ProjectRole.ADMIN && actor.role !== user_entity_1.UserRole.ADMIN) {
            const actorMembership = await memberRepo.findOne({
                where: { projectId: project.id, userId: actor.id },
            });
            if (!actorMembership || actorMembership.role !== project_member_entity_1.ProjectRole.ADMIN) {
                throw new app_error_1.AppError("Only a project administrator can assign the project administrator role.", 403, "PROJECT_ADMIN_REQUIRED");
            }
        }
        const membership = await memberRepo.save(memberRepo.create({
            projectId: project.id,
            userId: targetUser.id,
            addedById: actor.id,
            role: role,
        }));
        return {
            userId: targetUser.id,
            name: targetUser.fullName,
            email: targetUser.email,
            role: membership.role,
            joinedAt: membership.joinedAt,
            projectName: project.name,
            projectKey: project.key,
        };
    });
    if (result.userId !== actor.id) {
        await notification_service_1.notificationService.createNotification({
            userId: result.userId,
            organizationId: actor.organizationId,
            type: notification_entity_1.NotificationType.PROJECT_MEMBER_ADDED,
            title: "Added to a project",
            message: `You have been added to "${result.projectName}" (${result.projectKey}) with the ${result.role} role.`,
            projectId,
            link: `/projects/${projectId}`,
            metadata: {
                addedByUserId: actor.id,
                role: result.role,
            },
        });
    }
    res.status(201).json({
        success: true,
        message: "Project member added successfully.",
        data: result,
    });
};
exports.addProjectMember = addProjectMember;
const removeProjectMember = async (req, res) => {
    const actor = await getActor(req);
    const projectId = String(req.params.projectId);
    const memberId = String(req.params.memberId);
    await data_source_1.AppDataSource.transaction(async (manager) => {
        const project = await getProject(projectId, actor.organizationId, manager);
        if (memberId === actor.id && actor.role !== user_entity_1.UserRole.ADMIN) {
            throw new app_error_1.AppError("You cannot remove yourself from the project using this endpoint.", 403, "FORBIDDEN");
        }
        const memberRepo = manager.getRepository(project_member_entity_1.ProjectMember);
        const member = await memberRepo.findOne({
            where: { projectId: project.id, userId: memberId },
        });
        if (!member) {
            throw new app_error_1.AppError("Member not found in project.", 404, "MEMBER_NOT_FOUND");
        }
        await ensureNotLastProjectAdmin(manager, project.id, member);
        await memberRepo.remove(member);
    });
    res.status(200).json({
        success: true,
        message: "Project member removed successfully.",
        data: { projectId, userId: memberId },
    });
};
exports.removeProjectMember = removeProjectMember;
const updateProjectMemberRole = async (req, res) => {
    const actor = await getActor(req);
    const projectId = String(req.params.projectId);
    const memberId = String(req.params.memberId);
    const { role } = req.body;
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const project = await getProject(projectId, actor.organizationId, manager);
        const memberRepo = manager.getRepository(project_member_entity_1.ProjectMember);
        const member = await memberRepo.findOne({
            where: { projectId: project.id, userId: memberId },
        });
        if (!member) {
            throw new app_error_1.AppError("Member not found in project.", 404, "MEMBER_NOT_FOUND");
        }
        if (member.role === project_member_entity_1.ProjectRole.ADMIN && role !== project_member_entity_1.ProjectRole.ADMIN) {
            await ensureNotLastProjectAdmin(manager, project.id, member);
        }
        if (role === project_member_entity_1.ProjectRole.ADMIN && actor.role !== user_entity_1.UserRole.ADMIN) {
            const actorMembership = await memberRepo.findOne({
                where: { projectId: project.id, userId: actor.id },
            });
            if (!actorMembership || actorMembership.role !== project_member_entity_1.ProjectRole.ADMIN) {
                throw new app_error_1.AppError("Only a project administrator can assign the project administrator role.", 403, "PROJECT_ADMIN_REQUIRED");
            }
        }
        member.role = role;
        const saved = await memberRepo.save(member);
        return {
            userId: saved.userId,
            projectId: saved.projectId,
            role: saved.role,
            joinedAt: saved.joinedAt,
        };
    });
    res.status(200).json({
        success: true,
        message: "Project member role updated successfully.",
        data: result,
    });
};
exports.updateProjectMemberRole = updateProjectMemberRole;
