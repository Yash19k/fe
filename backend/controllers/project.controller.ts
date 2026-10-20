import { Request, Response } from "express";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/data.source";
import {
  Project,
  ProjectVisibility,
} from "../entities/project.entity";
import { User, UserRole } from "../entities/user.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { AppError } from "../errors/app.error";

type Actor = {
  id: string;
  organizationId: string;
  role: UserRole;
};

const getActor = async (req: Request): Promise<Actor> => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true, role: true },
  });

  if (!user) {
    throw new AppError("Authenticated user not found.", 401, "USER_NOT_FOUND");
  }

  if (!user.organizationId) {
    throw new AppError(
      "User is not associated with an organization.",
      403,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
  };
};

const getProject = async (
  projectId: string,
  organizationId: string,
  manager = AppDataSource.manager,
): Promise<Project> => {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId, organizationId },
  });

  if (!project) {
    // Deliberately avoid revealing whether another organization's project exists.
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  return project;
};

const ensureNotLastProjectAdmin = async (
  manager: EntityManager,
  projectId: string,
  member: ProjectMember,
): Promise<void> => {
  if (member.role !== ProjectRole.ADMIN) return;

  const count = await manager.getRepository(ProjectMember).count({
    where: { projectId, role: ProjectRole.ADMIN },
  });

  if (count <= 1) {
    throw new AppError(
      "A project must have at least one project administrator.",
      409,
      "LAST_PROJECT_ADMIN",
    );
  }
};

export const createProject = async (req: Request, res: Response) => {
  const actor = await getActor(req);
  const { name, key, description, startDate, endDate, visibility } = req.body;

  const project = await AppDataSource.transaction(async (manager) => {
    const projectRepo = manager.getRepository(Project);
    const userRepo = manager.getRepository(User);
    const memberRepo = manager.getRepository(ProjectMember);

    // Re-read the user inside the transaction to use the current organization.
    const user = await userRepo.findOne({
      where: { id: actor.id },
      select: { id: true, organizationId: true },
    });

    if (!user?.organizationId) {
      throw new AppError(
        "User is not associated with an organization.",
        403,
        "ORGANIZATION_NOT_FOUND",
      );
    }

    const normalizedKey = String(key).trim().toUpperCase();
    const existing = await projectRepo.findOne({
      where: { organizationId: user.organizationId, key: normalizedKey },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(
        "This project key is already used in your organization.",
        409,
        "PROJECT_KEY_CONFLICT",
      );
    }

    const savedProject = await projectRepo.save(
      projectRepo.create({
        name: String(name).trim(),
        key: normalizedKey,
        description: description?.trim() || null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        visibility: visibility ?? ProjectVisibility.PRIVATE,
        organizationId: user.organizationId,
        createdById: user.id,
      }),
    );

    await memberRepo.save(
      memberRepo.create({
        projectId: savedProject.id,
        userId: user.id,
        addedById: user.id,
        role: ProjectRole.ADMIN,
      }),
    );

    return savedProject;
  });

  res.status(201).json({
    success: true,
    message: "Project created successfully.",
    data: project,
  });
};

export const viewProjects = async (req: Request, res: Response) => {
  const actor = await getActor(req);

  const query = AppDataSource.getRepository(Project)
    .createQueryBuilder("project")
    .leftJoin(
      "project.memberships",
      "currentMembership",
      "currentMembership.userId = :userId",
      { userId: actor.id },
    )
    .where("project.organizationId = :organizationId", {
      organizationId: actor.organizationId,
    })
    .andWhere(
      `(
        project.visibility = :publicVisibility
        OR :isOrganizationAdmin = true
        OR currentMembership.userId = :userId
      )`,
      {
        publicVisibility: ProjectVisibility.PUBLIC,
        isOrganizationAdmin: actor.role === UserRole.ADMIN,
        userId: actor.id,
      },
    )
    .orderBy("project.createdAt", "DESC");

  const projects = await query.getMany();

  res.status(200).json({
    success: true,
    message: "Projects retrieved successfully.",
    count: projects.length,
    data: projects,
  });
};

export const viewProject = async (req: Request, res: Response) => {
  const actor = await getActor(req);
  const project = await getProject(
    String(req.params.projectId),
    actor.organizationId,
  );


  res.status(200).json({
    success: true,
    message: "Project retrieved successfully.",
    data: project,
  });
};

export const updateProject = async (req: Request, res: Response) => {
  const actor = await getActor(req);
  const projectId = String(req.params.projectId);
  const { name, key, description, startDate, endDate, visibility } = req.body;

  const saved = await AppDataSource.transaction(async (manager) => {
    const project = await getProject(projectId, actor.organizationId, manager);

    if (name !== undefined) project.name = name.trim();

    if (key !== undefined) {
      const normalizedKey = key.trim().toUpperCase();
      const duplicate = await manager.getRepository(Project).findOne({
        where: {
          organizationId: actor.organizationId,
          key: normalizedKey,
        },
        select: { id: true },
      });

      if (duplicate && duplicate.id !== project.id) {
        throw new AppError(
          "This project key is already used in your organization.",
          409,
          "PROJECT_KEY_CONFLICT",
        );
      }

      project.key = normalizedKey;
    }

    if (description !== undefined) {
      project.description = description ? description.trim() : null;
    }
    if (startDate !== undefined) project.startDate = startDate || null;
    if (endDate !== undefined) project.endDate = endDate || null;
    if (visibility !== undefined) project.visibility = visibility;

    if (
      project.startDate &&
      project.endDate &&
      project.endDate < project.startDate
    ) {
      throw new AppError(
        "endDate must be on or after startDate.",
        400,
        "INVALID_PROJECT_DATE_RANGE",
      );
    }

    return manager.getRepository(Project).save(project);
  });

  res.status(200).json({
    success: true,
    message: "Project updated successfully.",
    data: saved,
  });
};

export const deleteProject = async (req: Request, res: Response) => {
  const actor = await getActor(req);
  const projectId = String(req.params.projectId);

  await AppDataSource.transaction(async (manager) => {
    const project = await getProject(projectId, actor.organizationId, manager);

    // FK/cascade behavior must match the product's retention policy.
    await manager.getRepository(Project).remove(project);
  });

  res.status(200).json({
    success: true,
    message: "Project deleted successfully.",
    data: { id: projectId },
  });
};

export const getProjectMembers = async (req: Request, res: Response) => {
  const actor = await getActor(req);
  const project = await getProject(
    String(req.params.projectId),
    actor.organizationId,
  );


  const members = await AppDataSource.getRepository(ProjectMember).find({
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

export const addProjectMember = async (req: Request, res: Response) => {
  const actor = await getActor(req);
  const projectId = String(req.params.projectId);
  const { memberId, email, role = ProjectRole.MEMBER } = req.body;

  const result = await AppDataSource.transaction(async (manager) => {
    const project = await getProject(projectId, actor.organizationId, manager);

    const userRepo = manager.getRepository(User);
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
      throw new AppError(
        "User not found in your organization.",
        404,
        "USER_NOT_FOUND",
      );
    }

    const memberRepo = manager.getRepository(ProjectMember);
    const existing = await memberRepo.findOne({
      where: { projectId: project.id, userId: targetUser.id },
    });

    if (existing) {
      throw new AppError(
        "This user is already a member of the project.",
        409,
        "PROJECT_MEMBER_EXISTS",
      );
    }

    const membership = await memberRepo.save(
      memberRepo.create({
        projectId: project.id,
        userId: targetUser.id,
        addedById: actor.id,
        role: role as ProjectRole,
      }),
    );

    return {
      userId: targetUser.id,
      name: targetUser.fullName,
      email: targetUser.email,
      role: membership.role,
      joinedAt: membership.joinedAt,
    };
  });

  res.status(201).json({
    success: true,
    message: "Project member added successfully.",
    data: result,
  });
};

export const removeProjectMember = async (req: Request, res: Response) => {
  const actor = await getActor(req);
  const projectId = String(req.params.projectId);
  const memberId = String(req.params.memberId);

  await AppDataSource.transaction(async (manager) => {
    const project = await getProject(projectId, actor.organizationId, manager);

    if (memberId === actor.id && actor.role !== UserRole.ADMIN) {
      throw new AppError(
        "You cannot remove yourself from the project using this endpoint.",
        403,
        "FORBIDDEN",
      );
    }

    const memberRepo = manager.getRepository(ProjectMember);
    const member = await memberRepo.findOne({
      where: { projectId: project.id, userId: memberId },
    });

    if (!member) {
      throw new AppError(
        "Member not found in project.",
        404,
        "MEMBER_NOT_FOUND",
      );
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

export const updateProjectMemberRole = async (
  req: Request,
  res: Response,
) => {
  const actor = await getActor(req);
  const projectId = String(req.params.projectId);
  const memberId = String(req.params.memberId);
  const { role } = req.body;

  const result = await AppDataSource.transaction(async (manager) => {
    const project = await getProject(projectId, actor.organizationId, manager);

    const memberRepo = manager.getRepository(ProjectMember);
    const member = await memberRepo.findOne({
      where: { projectId: project.id, userId: memberId },
    });

    if (!member) {
      throw new AppError(
        "Member not found in project.",
        404,
        "MEMBER_NOT_FOUND",
      );
    }

    if (member.role === ProjectRole.ADMIN && role !== ProjectRole.ADMIN) {
      await ensureNotLastProjectAdmin(manager, project.id, member);
    }

    member.role = role as ProjectRole;
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
