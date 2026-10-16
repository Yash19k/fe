"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProjectMemberRole = exports.removeProjectMember = exports.addProjectMember = exports.getProjectMembers = exports.deleteProject = exports.updateProject = exports.viewProject = exports.viewProjects = exports.createProject = void 0;
const data_source_1 = require("../config/data.source");
const project_entity_1 = require("../entities/project.entity");
const user_entity_1 = require("../entities/user.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const app_error_1 = require("../errors/app.error");
const createProject = async (req, res, next) => {
    const { name, key, description, startDate, endDate, visibility, } = req.body;
    const userId = req.user?.id;
    if (!userId) {
        throw new app_error_1.AppError("Authentication required.", 401, "UNAUTHORIZED");
    }
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(user_entity_1.User);
        const projectRepository = manager.getRepository(project_entity_1.Project);
        const memberRepository = manager.getRepository(project_member_entity_1.ProjectMember);
        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new app_error_1.AppError("Authenticated user not found.", 401, "USER_NOT_FOUND");
        }
        if (!user.organizationId) {
            throw new app_error_1.AppError("You are not associated with an organization.", 403, "ORGANIZATION_NOT_FOUND");
        }
        const normalizedKey = key.toUpperCase();
        const existingProject = await projectRepository.findOne({
            where: { organizationId: user.organizationId, key: normalizedKey },
            select: { id: true },
        });
        if (existingProject) {
            throw new app_error_1.AppError("This project key is already used in your organization.", 409, "PROJECT_KEY_CONFLICT");
        }
        const project = await projectRepository.save(projectRepository.create({
            name,
            key: normalizedKey,
            description: description?.trim() || null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            visibility: visibility ?? project_entity_1.ProjectVisibility.PRIVATE,
            organizationId: user.organizationId,
            createdById: user.id,
        }));
        await memberRepository.save(memberRepository.create({
            projectId: project.id,
            userId: user.id,
            addedById: user.id,
            role: project_member_entity_1.ProjectRole.ADMIN,
        }));
        return project;
    });
    res.status(201).json({
        success: true,
        message: "Project created successfully.",
        project: result,
        data: result,
    });
};
exports.createProject = createProject;
const viewProjects = async (req, res) => {
    // 1. Get the authenticated user's ID.
    const userId = req.user?.id;
    if (!userId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
    const user = await userRepository.findOne({
        where: { id: userId },
        select: {
            id: true,
            organizationId: true,
        },
    });
    if (!user) {
        throw new app_error_1.AppError("User not found", 404, "USER_NOT_FOUND");
    }
    const projectRepository = data_source_1.AppDataSource.getRepository(project_entity_1.Project);
    const projects = await projectRepository
        .createQueryBuilder("project")
        .leftJoin("project.memberships", "accessMembership", "accessMembership.userId = :userId", { userId: user.id })
        .leftJoinAndSelect("project.memberships", "membership")
        .where("project.organizationId = :organizationId", {
        organizationId: user.organizationId,
    })
        .andWhere(`(
          project.visibility = :publicVisibility
          OR accessMembership.userId = :userId
        )`, {
        publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
        userId: user.id,
    })
        .orderBy("project.createdAt", "DESC")
        .getMany();
    res.status(200).json({
        success: true,
        message: "Projects retrieved successfully",
        count: projects.length,
        data: projects,
    });
};
exports.viewProjects = viewProjects;
const viewProject = async (req, res) => {
    const userId = req.user?.id;
    const projectId = req.params.projectId;
    if (!userId || typeof projectId !== "string") {
        throw new app_error_1.AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true, role: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project).findOne({
        where: { id: projectId, organizationId: user.organizationId },
    });
    if (!project) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    if (project.visibility === project_entity_1.ProjectVisibility.PRIVATE && user.role !== "ADMIN") {
        const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({
            where: { projectId, userId: user.id },
            select: { projectId: true, userId: true },
        });
        if (!membership) {
            throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
        }
    }
    res.status(200).json({
        success: true,
        message: "Project retrieved successfully.",
        project,
        data: project,
    });
};
exports.viewProject = viewProject;
const updateProject = async (req, res) => {
    const userId = req.user?.id;
    const projectId = req.params.projectId;
    if (!userId || typeof projectId !== "string") {
        throw new app_error_1.AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true, role: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    const projectRepo = data_source_1.AppDataSource.getRepository(project_entity_1.Project);
    const project = await projectRepo.findOne({
        where: { id: projectId, organizationId: user.organizationId },
    });
    if (!project) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    const { name, key, description, startDate, endDate, visibility } = req.body;
    if (name !== undefined)
        project.name = name.trim();
    if (key !== undefined)
        project.key = key.trim().toUpperCase();
    if (description !== undefined)
        project.description = description ? description.trim() : null;
    if (startDate !== undefined)
        project.startDate = startDate || null;
    if (endDate !== undefined)
        project.endDate = endDate || null;
    if (visibility !== undefined)
        project.visibility = visibility;
    const saved = await projectRepo.save(project);
    res.status(200).json({
        success: true,
        message: "Project updated successfully.",
        project: saved,
        data: saved,
    });
};
exports.updateProject = updateProject;
const deleteProject = async (req, res) => {
    const userId = req.user?.id;
    const projectId = req.params.projectId;
    if (!userId || typeof projectId !== "string") {
        throw new app_error_1.AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true, role: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    const projectRepo = data_source_1.AppDataSource.getRepository(project_entity_1.Project);
    const project = await projectRepo.findOne({
        where: { id: projectId, organizationId: user.organizationId },
    });
    if (!project) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    await projectRepo.remove(project);
    res.status(200).json({
        success: true,
        message: "Project deleted successfully.",
        data: { id: projectId },
    });
};
exports.deleteProject = deleteProject;
const getProjectMembers = async (req, res) => {
    const userId = req.user?.id;
    const projectId = req.params.projectId;
    if (!userId || typeof projectId !== "string") {
        throw new app_error_1.AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    const memberRepo = data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember);
    const members = await memberRepo.find({
        where: { projectId },
        relations: { user: true },
        order: { joinedAt: "ASC" },
    });
    res.status(200).json({
        success: true,
        data: members.map((m) => ({
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt,
            name: m.user?.fullName,
            email: m.user?.email,
        })),
    });
};
exports.getProjectMembers = getProjectMembers;
const addProjectMember = async (req, res) => {
    const userId = req.user?.id;
    const projectId = String(req.params.projectId);
    const { memberId, email, role = project_member_entity_1.ProjectRole.MEMBER } = req.body;
    if (!userId || !projectId) {
        throw new app_error_1.AppError("Invalid request.", 400, "INVALID_REQUEST");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const userRepo = data_source_1.AppDataSource.getRepository(user_entity_1.User);
    let targetUser = null;
    if (memberId) {
        targetUser = await userRepo.findOne({ where: { id: String(memberId), organizationId: user.organizationId } });
    }
    else if (email) {
        targetUser = await userRepo.findOne({ where: { email: String(email).toLowerCase().trim(), organizationId: user.organizationId } });
    }
    if (!targetUser) {
        throw new app_error_1.AppError("User not found in your organization.", 404, "USER_NOT_FOUND");
    }
    const memberRepo = data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember);
    let member = await memberRepo.findOne({ where: { projectId, userId: targetUser.id } });
    if (member) {
        member.role = role;
        await memberRepo.save(member);
    }
    else {
        member = await memberRepo.save(memberRepo.create({
            projectId,
            userId: targetUser.id,
            addedById: user.id,
            role: role,
        }));
    }
    res.status(201).json({
        success: true,
        data: {
            userId: targetUser.id,
            name: targetUser.fullName,
            email: targetUser.email,
            role: member.role,
        },
    });
};
exports.addProjectMember = addProjectMember;
const removeProjectMember = async (req, res) => {
    const userId = req.user?.id;
    const projectId = String(req.params.projectId);
    const memberId = String(req.params.memberId);
    if (!userId || !projectId || !memberId) {
        throw new app_error_1.AppError("Invalid request.", 400, "INVALID_REQUEST");
    }
    const memberRepo = data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember);
    const member = await memberRepo.findOne({ where: { projectId, userId: memberId } });
    if (!member) {
        throw new app_error_1.AppError("Member not found in project.", 404, "MEMBER_NOT_FOUND");
    }
    await memberRepo.remove(member);
    res.status(200).json({
        success: true,
        data: { projectId, userId: memberId },
    });
};
exports.removeProjectMember = removeProjectMember;
const updateProjectMemberRole = async (req, res) => {
    const userId = req.user?.id;
    const projectId = String(req.params.projectId);
    const memberId = String(req.params.memberId);
    const { role } = req.body;
    if (!userId || !projectId || !memberId || !role) {
        throw new app_error_1.AppError("Invalid request.", 400, "INVALID_REQUEST");
    }
    const memberRepo = data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember);
    const member = await memberRepo.findOne({ where: { projectId, userId: memberId } });
    if (!member) {
        throw new app_error_1.AppError("Member not found in project.", 404, "MEMBER_NOT_FOUND");
    }
    member.role = role;
    const saved = await memberRepo.save(member);
    res.status(200).json({
        success: true,
        data: saved,
    });
};
exports.updateProjectMemberRole = updateProjectMemberRole;
