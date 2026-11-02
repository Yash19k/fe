import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Request } from "express";

import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import { Project, ProjectVisibility } from "../entities/project.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { UserRole, UserStatus } from "../entities/user.entity";
import {
  authorizeProjectPermission,
  authorizeWorkItemCreationForActor,
  hasProjectPermission,
} from "../middleware/project.permission";
import {
  Actor,
  CreateWorkItemInput,
  createWorkItemOrchestration,
} from "../services/work-item.service";
import { WorkItemType } from "../entities/work.item.entity";

const projectId = "project-1";
const organizationId = "organization-1";
const userId = "user-1";

function createProject(): Project {
  return Object.assign(new Project(), {
    id: projectId,
    organizationId,
    visibility: ProjectVisibility.PUBLIC,
  });
}

function createMembership(role: ProjectRole): ProjectMember {
  return Object.assign(new ProjectMember(), {
    projectId,
    userId,
    role,
  });
}

describe("work-item project authorization", () => {
  test("requires project membership even for public projects and organization admins", async (t) => {
    const project = createProject();
    t.mock.method(
      AppDataSource,
      "getRepository",
      ((entity: unknown) => ({
        findOne: async () => entity === Project ? project : null,
      })) as never,
    );

    for (const role of [UserRole.TEAMMATE, UserRole.ADMIN]) {
      await assert.rejects(
        authorizeProjectPermission(
          {
            user: { id: userId, organizationId, role },
            params: {},
            query: {},
            body: { projectId },
          } as Request,
          "task:create",
        ),
        (error: unknown) =>
          error instanceof AppError &&
          error.statusCode === 403 &&
          error.code === "PROJECT_MEMBERSHIP_REQUIRED",
      );
    }
  });

  test("rejects projects outside the authenticated user's organization", async (t) => {
    t.mock.method(
      AppDataSource,
      "getRepository",
      (() => ({ findOne: async () => null })) as never,
    );

    await assert.rejects(
      authorizeWorkItemCreationForActor(
        { id: userId, organizationId },
        projectId,
      ),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 404 &&
        error.code === "PROJECT_NOT_FOUND",
    );
  });

  test("retains work-item creation permission for all project roles", async (t) => {
    assert.equal(hasProjectPermission(ProjectRole.ADMIN, "task:create"), true);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "task:create"), true);
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "task:create"), true);

    const project = createProject();
    let membershipRole = ProjectRole.MEMBER;
    t.mock.method(
      AppDataSource,
      "getRepository",
      ((entity: unknown) => ({
        findOne: async () =>
          entity === Project ? project : createMembership(membershipRole),
      })) as never,
    );

    for (const role of Object.values(ProjectRole)) {
      membershipRole = role;
      await authorizeWorkItemCreationForActor(
        { id: userId, organizationId },
        projectId,
      );
    }
  });

  test("enforces membership in the creation service, not only the HTTP route", async (t) => {
    const project = createProject();
    const manager = {
      getRepository: (entity: unknown) => ({
        findOne: async () => entity === Project ? project : null,
      }),
    };
    t.mock.method(
      AppDataSource,
      "transaction",
      (async (operation: (transactionManager: never) => Promise<unknown>) =>
        operation(manager as never)) as never,
    );

    const actor: Actor = {
      id: userId,
      organizationId,
      status: UserStatus.ACTIVE,
      role: "TEAMMATE",
    };
    const input: CreateWorkItemInput = {
      projectId,
      type: WorkItemType.TASK,
      title: "Test task",
    };

    await assert.rejects(
      createWorkItemOrchestration(actor, input),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 403 &&
        error.code === "PROJECT_MEMBERSHIP_REQUIRED",
    );
  });
});
