import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data.source";
import {
  Project,
  ProjectVisibility,
} from "../entities/project.entity";
import { User } from "../entities/user.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { AppError } from "../errors/app.error";

export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const {
    name,
    key,
    description,
    startDate,
    endDate,
    visibility,
  } = req.body;

  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const result = await AppDataSource.transaction(async (manager) => {
    const userRepository = manager.getRepository(User);
    const projectRepository = manager.getRepository(Project);
    const memberRepository = manager.getRepository(ProjectMember);

    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new AppError("Authenticated user not found.", 401, "USER_NOT_FOUND");
    }

    if (!user.organizationId) {
      throw new AppError("You are not associated with an organization.", 403, "ORGANIZATION_NOT_FOUND");
    }

    const normalizedKey = key.toUpperCase();

    const existingProject = await projectRepository.findOne({
      where: { organizationId: user.organizationId, key: normalizedKey },
      select: { id: true },
    });

    if (existingProject) {
      throw new AppError("This project key is already used in your organization.", 409, "PROJECT_KEY_CONFLICT");
    }

    const project = await projectRepository.save(projectRepository.create({
      name,
      key: normalizedKey,
      description: description?.trim() || null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      visibility: visibility ?? ProjectVisibility.PRIVATE,
      organizationId: user.organizationId,
      createdById: user.id,
    }));

    await memberRepository.save(memberRepository.create({
      projectId: project.id,
      userId: user.id,
      addedById: user.id,
      role: ProjectRole.ADMIN,
    }));

    return project;
  });

  res.status(201).json({
    success: true,
    message: "Project created successfully.",
    project: result,
    data: result,
  });
}


export const viewProjects = 
  async (req: Request, res: Response) => {
    // 1. Get the authenticated user's ID.
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError(
        "Authentication required",
        401,
        "UNAUTHORIZED"
      );
    }

    const userRepository = AppDataSource.getRepository(User);

const user = await userRepository.findOne({
  where: { id: userId },
  select: {
    id: true,
    organizationId: true,
  },
});


    if (!user) {
      throw new AppError(
        "User not found",
        404,
        "USER_NOT_FOUND"
      );
    }

    const projectRepository = AppDataSource.getRepository(Project);

    const projects = await projectRepository
      .createQueryBuilder("project")
      .leftJoin(
        "project.memberships",
        "accessMembership",
        "accessMembership.userId = :userId",
        { userId: user.id }
      )
      .leftJoinAndSelect("project.memberships", "membership")
      .where("project.organizationId = :organizationId", {
        organizationId: user.organizationId,
      })
      .andWhere(
        `(
          project.visibility = :publicVisibility
          OR accessMembership.userId = :userId
        )`,
        {
          publicVisibility: ProjectVisibility.PUBLIC,
          userId: user.id,
        }
      )
      .orderBy("project.createdAt", "DESC")
      .getMany();

    res.status(200).json({
      success: true,
      message: "Projects retrieved successfully",
      count: projects.length,
      data: projects,
    });
  }

export const viewProject = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const projectId = req.params.projectId;

  if (!userId || typeof projectId !== "string") {
    throw new AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true, role: true },
  });

  if (!user || !user.organizationId) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id: projectId, organizationId: user.organizationId },
  });

  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  if (project.visibility === ProjectVisibility.PRIVATE && user.role !== "ADMIN") {
    const membership = await AppDataSource.getRepository(ProjectMember).findOne({
      where: { projectId, userId: user.id },
      select: { projectId: true, userId: true },
    });

    if (!membership) {
      throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
  }

  res.status(200).json({
    success: true,
    message: "Project retrieved successfully.",
    project,
    data: project,
  });
};

export const updateProject = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const projectId = req.params.projectId;

  if (!userId || typeof projectId !== "string") {
    throw new AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true, role: true },
  });

  if (!user || !user.organizationId) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  const projectRepo = AppDataSource.getRepository(Project);
  const project = await projectRepo.findOne({
    where: { id: projectId, organizationId: user.organizationId },
  });

  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  const { name, key, description, startDate, endDate, visibility } = req.body;
  if (name !== undefined) project.name = name.trim();
  if (key !== undefined) project.key = key.trim().toUpperCase();
  if (description !== undefined) project.description = description ? description.trim() : null;
  if (startDate !== undefined) project.startDate = startDate || null;
  if (endDate !== undefined) project.endDate = endDate || null;
  if (visibility !== undefined) project.visibility = visibility;

  const saved = await projectRepo.save(project);
  res.status(200).json({
    success: true,
    message: "Project updated successfully.",
    project: saved,
    data: saved,
  });
};

export const deleteProject = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const projectId = req.params.projectId;

  if (!userId || typeof projectId !== "string") {
    throw new AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true, role: true },
  });

  if (!user || !user.organizationId) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  const projectRepo = AppDataSource.getRepository(Project);
  const project = await projectRepo.findOne({
    where: { id: projectId, organizationId: user.organizationId },
  });

  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  await projectRepo.remove(project);
  res.status(200).json({
    success: true,
    message: "Project deleted successfully.",
    data: { id: projectId },
  });
};

export const getProjectMembers = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const projectId = req.params.projectId;

  if (!userId || typeof projectId !== "string") {
    throw new AppError("Invalid project request.", 400, "INVALID_PROJECT_ID");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });

  if (!user || !user.organizationId) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  const memberRepo = AppDataSource.getRepository(ProjectMember);
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

export const addProjectMember = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const projectId = String(req.params.projectId);
  const { memberId, email, role = ProjectRole.MEMBER } = req.body;

  if (!userId || !projectId) {
    throw new AppError("Invalid request.", 400, "INVALID_REQUEST");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });

  if (!user || !user.organizationId) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const userRepo = AppDataSource.getRepository(User);
  let targetUser: User | null = null;
  if (memberId) {
    targetUser = await userRepo.findOne({ where: { id: String(memberId), organizationId: user.organizationId } });
  } else if (email) {
    targetUser = await userRepo.findOne({ where: { email: String(email).toLowerCase().trim(), organizationId: user.organizationId } });
  }

  if (!targetUser) {
    throw new AppError("User not found in your organization.", 404, "USER_NOT_FOUND");
  }

  const memberRepo = AppDataSource.getRepository(ProjectMember);
  let member = await memberRepo.findOne({ where: { projectId, userId: targetUser.id } });
  if (member) {
    member.role = role as ProjectRole;
    await memberRepo.save(member);
  } else {
    member = await memberRepo.save(memberRepo.create({
      projectId,
      userId: targetUser.id,
      addedById: user.id,
      role: role as ProjectRole,
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

export const removeProjectMember = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const projectId = String(req.params.projectId);
  const memberId = String(req.params.memberId);

  if (!userId || !projectId || !memberId) {
    throw new AppError("Invalid request.", 400, "INVALID_REQUEST");
  }

  const memberRepo = AppDataSource.getRepository(ProjectMember);
  const member = await memberRepo.findOne({ where: { projectId, userId: memberId } });
  if (!member) {
    throw new AppError("Member not found in project.", 404, "MEMBER_NOT_FOUND");
  }

  await memberRepo.remove(member);
  res.status(200).json({
    success: true,
    data: { projectId, userId: memberId },
  });
};

export const updateProjectMemberRole = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const projectId = String(req.params.projectId);
  const memberId = String(req.params.memberId);
  const { role } = req.body;

  if (!userId || !projectId || !memberId || !role) {
    throw new AppError("Invalid request.", 400, "INVALID_REQUEST");
  }

  const memberRepo = AppDataSource.getRepository(ProjectMember);
  const member = await memberRepo.findOne({ where: { projectId, userId: memberId } });
  if (!member) {
    throw new AppError("Member not found in project.", 404, "MEMBER_NOT_FOUND");
  }

  member.role = role as ProjectRole;
  const saved = await memberRepo.save(member);

  res.status(200).json({
    success: true,
    data: saved,
  });
};


