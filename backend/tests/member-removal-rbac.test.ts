import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import type { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { removeOrganizationMember } from "../controllers/organization.controller";
import { removeProjectMember } from "../controllers/project.controller";
import { AppError } from "../errors/app.error";
import { Organization } from "../entities/organization.entity";
import { Project } from "../entities/project.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { User, UserRole, UserStatus } from "../entities/user.entity";
import { UserSession } from "../entities/user.session.entity";
import { AddOrganizationCreator1793600000000 } from "../migrations/1793600000000-AddOrganizationCreator";
import {
  authorizeProjectPermission,
  hasProjectPermission,
} from "../middleware/project.permission";

const organizationId = "organization-1";
const projectId = "project-1";
const actorId = "actor-1";
const targetId = "target-1";

interface TestResponse extends Response {
  statusCode: number;
  body?: unknown;
}

function createRequest(
  user: { id: string; organizationId: string; role: UserRole },
  params: Record<string, string>,
): Request {
  return {
    user,
    params,
    body: {},
    query: {},
  } as Request;
}

function createResponse(): TestResponse {
  const response = { statusCode: 0, body: undefined } as TestResponse;
  response.status = (code: number) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body: unknown) => {
    response.body = body;
    return response;
  };
  return response;
}

function createProjectRemovalHarness(options?: {
  actorRole?: UserRole;
  actorProjectRole?: ProjectRole;
  targetProjectRole?: ProjectRole;
  projectCreatorId?: string;
  targetIsMember?: boolean;
  projectOrganizationId?: string;
}) {
  const actorRole = options?.actorRole ?? UserRole.MANAGER;
  const project: Project = Object.assign(new Project(), {
    id: projectId,
    organizationId: options?.projectOrganizationId ?? organizationId,
    createdById: options?.projectCreatorId ?? "creator-1",
  });
  const members: ProjectMember[] = [];

  if (options?.actorProjectRole) {
    members.push(Object.assign(new ProjectMember(), {
      projectId,
      userId: actorId,
      role: options.actorProjectRole,
    }));
  }
  if (options?.targetIsMember !== false) {
    members.push(Object.assign(new ProjectMember(), {
      projectId,
      userId: targetId,
      role: options?.targetProjectRole ?? ProjectRole.MEMBER,
    }));
  }

  const manager = {
    getRepository(entity: unknown) {
      if (entity === Project) {
        return {
          findOne: async ({ where }: { where: { id: string; organizationId: string } }) =>
            where.id === projectId && where.organizationId === project.organizationId
              ? project
              : null,
        };
      }
      if (entity === ProjectMember) {
        return {
          findOne: async ({ where }: { where: { projectId: string; userId: string } }) =>
            members.find(
              (member) =>
                member.projectId === where.projectId &&
                member.userId === where.userId,
            ) ?? null,
          count: async ({ where }: { where: { projectId: string; role: ProjectRole } }) =>
            members.filter(
              (member) =>
                member.projectId === where.projectId &&
                member.role === where.role,
            ).length,
          remove: async (member: ProjectMember) => {
            const index = members.indexOf(member);
            if (index >= 0) members.splice(index, 1);
            return member;
          },
        };
      }
      throw new Error(`Unexpected repository: ${String(entity)}`);
    },
  };

  return {
    manager,
    project,
    members,
    actorRole,
  };
}

function mockProjectRemoval(
  t: TestContext,
  harness: ReturnType<typeof createProjectRemovalHarness>,
): void {
  t.mock.method(
    AppDataSource,
    "getRepository",
    ((entity: unknown) => {
      if (entity === User) {
        return {
          findOne: async () => ({
            id: actorId,
            organizationId,
            role: harness.actorRole,
          }),
        };
      }
      throw new Error(`Unexpected repository: ${String(entity)}`);
    }) as never,
  );
  t.mock.method(
    AppDataSource,
    "transaction",
    (async (callback: (manager: never) => Promise<unknown>) =>
      callback(harness.manager as never)) as never,
  );
}

test("organization creator migration adds, backfills, and reverses the owner field", async () => {
  const statements: string[] = [];
  const migration = new AddOrganizationCreator1793600000000();
  const queryRunner = {
    query: async (sql: string) => {
      statements.push(sql);
      return [];
    },
  };

  await migration.up(queryRunner as never);
  assert.equal(statements.length, 4);
  assert.match(statements[0], /ADD COLUMN "created_by_user_id" uuid/);
  assert.match(statements[1], /ORDER BY "users"\."created_at" ASC/);
  assert.match(statements[2], /CREATE INDEX "IDX_organizations_created_by_user_id"/);
  assert.match(statements[3], /REFERENCES "users"\("id"\)/);

  statements.length = 0;
  await migration.down(queryRunner as never);
  assert.equal(statements.length, 3);
  assert.match(statements[0], /DROP CONSTRAINT "FK_organizations_created_by_user_id"/);
  assert.match(statements[2], /DROP COLUMN "created_by_user_id"/);
});

describe("organization member removal RBAC", () => {
  async function runOrganizationRemoval(
    t: TestContext,
    options: {
      actorId?: string;
      actorRole?: UserRole;
      target?: Partial<User> | null;
      creatorId?: string | null;
      activeAdminCount?: number;
    },
  ) {
    const userRepository = AppDataSource.getRepository(User);
    const target = options.target === null
      ? null
      : Object.assign(new User(), {
          id: targetId,
          organizationId,
          role: UserRole.TEAMMATE,
          status: UserStatus.ACTIVE,
          ...options.target,
        });
    t.mock.method(userRepository, "findOne", (async () => target) as never);
    t.mock.method(
      userRepository,
      "count",
      (async () => options.activeAdminCount ?? 2) as never,
    );

    const organizationRepository = AppDataSource.getRepository(Organization);
    t.mock.method(
      organizationRepository,
      "findOne",
      (async () => ({
        id: organizationId,
        createdByUserId: options.creatorId ?? "creator-1",
      })) as never,
    );

    const manager = {
      find: async () => [],
      createQueryBuilder: () => {
        const builder = {
          delete: () => builder,
          from: () => builder,
          where: () => builder,
          execute: async () => ({ affected: 0 }),
        };
        return builder;
      },
      getRepository: (entity: unknown) => {
        if (entity === UserSession) {
          return { delete: async () => ({ affected: 0 }) };
        }
        throw new Error(`Unexpected repository: ${String(entity)}`);
      },
      save: async (_entity: unknown, value: unknown) => value,
    };
    t.mock.method(
      AppDataSource,
      "transaction",
      (async (callback: (manager: never) => Promise<unknown>) =>
        callback(manager as never)) as never,
    );

    const response = createResponse();
    const request = createRequest(
      {
        id: options.actorId ?? actorId,
        organizationId,
        role: options.actorRole ?? UserRole.ADMIN,
      },
      { userId: targetId },
    );
    return {
      request,
      response,
      target,
      remove: () => removeOrganizationMember(request, response),
    };
  }

  test("blocks removal of the organization creator", async (t) => {
    const { remove } = await runOrganizationRemoval(t, {
      creatorId: targetId,
      target: { role: UserRole.ADMIN },
    });

    await assert.rejects(
      remove(),
      (error: unknown) =>
        error instanceof AppError && error.code === "CANNOT_REMOVE_OWNER",
    );
  });

  test("allows removing another organization admin when protections permit", async (t) => {
    const { remove, response } = await runOrganizationRemoval(t, {
      creatorId: "creator-1",
      target: { role: UserRole.ADMIN },
      activeAdminCount: 2,
    });

    await remove();
    assert.equal(response.statusCode, 0);
    assert.equal((response.body as { success: boolean }).success, true);
  });

  test("blocks organization self-removal and removal by non-admin roles", async (t) => {
    const self = await runOrganizationRemoval(t, { actorId: targetId });
    await assert.rejects(
      self.remove(),
      (error: unknown) =>
        error instanceof AppError && error.code === "CANNOT_REMOVE_SELF",
    );

    const manager = await runOrganizationRemoval(t, {
      actorRole: UserRole.MANAGER,
    });
    await assert.rejects(
      manager.remove(),
      (error: unknown) =>
        error instanceof AppError && error.code === "ADMIN_REQUIRED",
    );
  });

  test("preserves last-active-admin and cross-organization protections", async (t) => {
    const lastAdmin = await runOrganizationRemoval(t, {
      target: { role: UserRole.ADMIN },
      activeAdminCount: 1,
    });
    await assert.rejects(
      lastAdmin.remove(),
      (error: unknown) =>
        error instanceof AppError && error.code === "LAST_ADMIN_PROTECTED",
    );

    const foreignMember = await runOrganizationRemoval(t, { target: null });
    await assert.rejects(
      foreignMember.remove(),
      (error: unknown) =>
        error instanceof AppError && error.code === "MEMBER_NOT_FOUND",
    );
  });
});

describe("project member removal RBAC", () => {
  test("blocks creator removal for project admins and organization admins", async (t) => {
    for (const actorRole of [UserRole.MANAGER, UserRole.ADMIN]) {
      const harness = createProjectRemovalHarness({
        actorRole,
        actorProjectRole:
          actorRole === UserRole.MANAGER ? ProjectRole.ADMIN : ProjectRole.MEMBER,
        projectCreatorId: targetId,
      });
      mockProjectRemoval(t, harness);

      await assert.rejects(
        removeProjectMember(
          createRequest(
            { id: actorId, organizationId, role: actorRole },
            { projectId, memberId: targetId },
          ),
          createResponse(),
        ),
        (error: unknown) =>
          error instanceof AppError &&
          error.code === "CANNOT_REMOVE_PROJECT_CREATOR",
      );
    }
  });

  test("blocks self-removal for project admins and organization admins", async (t) => {
    for (const actorRole of [UserRole.MANAGER, UserRole.ADMIN]) {
      const harness = createProjectRemovalHarness({
        actorRole,
        actorProjectRole:
          actorRole === UserRole.MANAGER ? ProjectRole.ADMIN : ProjectRole.ADMIN,
      });
      mockProjectRemoval(t, harness);

      await assert.rejects(
        removeProjectMember(
          createRequest(
            { id: actorId, organizationId, role: actorRole },
            { projectId, memberId: actorId },
          ),
          createResponse(),
        ),
        (error: unknown) =>
          error instanceof AppError && error.code === "FORBIDDEN",
      );
    }
  });

  test("allows project admins to remove leads and members", async (t) => {
    for (const targetProjectRole of [ProjectRole.LEAD, ProjectRole.MEMBER]) {
      const harness = createProjectRemovalHarness({
        actorRole: UserRole.MANAGER,
        actorProjectRole: ProjectRole.ADMIN,
        targetProjectRole,
      });
      mockProjectRemoval(t, harness);
      const response = createResponse();

      await removeProjectMember(
        createRequest(
          { id: actorId, organizationId, role: UserRole.MANAGER },
          { projectId, memberId: targetId },
        ),
        response,
      );
      assert.equal(response.statusCode, 200);
      assert.equal(harness.members.some((member) => member.userId === targetId), false);
    }
  });

  test("preserves last-project-admin and cross-project/organization protections", async (t) => {
    const lastAdminHarness = createProjectRemovalHarness({
      actorRole: UserRole.ADMIN,
      targetProjectRole: ProjectRole.ADMIN,
      targetIsMember: true,
    });
    mockProjectRemoval(t, lastAdminHarness);
    await assert.rejects(
      removeProjectMember(
        createRequest(
          { id: actorId, organizationId, role: UserRole.ADMIN },
          { projectId, memberId: targetId },
        ),
        createResponse(),
      ),
      (error: unknown) =>
        error instanceof AppError && error.code === "LAST_PROJECT_ADMIN",
    );

    const foreignProjectHarness = createProjectRemovalHarness({
      actorRole: UserRole.ADMIN,
      projectOrganizationId: "another-organization",
    });
    mockProjectRemoval(t, foreignProjectHarness);
    await assert.rejects(
      removeProjectMember(
        createRequest(
          { id: actorId, organizationId, role: UserRole.ADMIN },
          { projectId, memberId: targetId },
        ),
        createResponse(),
      ),
      (error: unknown) =>
        error instanceof AppError && error.code === "PROJECT_NOT_FOUND",
    );

    const foreignMemberHarness = createProjectRemovalHarness({
      actorRole: UserRole.ADMIN,
      targetIsMember: false,
    });
    mockProjectRemoval(t, foreignMemberHarness);
    await assert.rejects(
      removeProjectMember(
        createRequest(
          { id: actorId, organizationId, role: UserRole.ADMIN },
          { projectId, memberId: targetId },
        ),
        createResponse(),
      ),
      (error: unknown) =>
        error instanceof AppError && error.code === "MEMBER_NOT_FOUND",
    );
  });

  test("retains the effective permission matrix and organization-admin override", () => {
    assert.equal(hasProjectPermission(ProjectRole.ADMIN, "member:remove"), true);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "member:remove"), false);
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "member:remove"), false);
  });

  test("authorizes organization admins without project membership and denies LEAD/MEMBER", async (t) => {
    let actorRole = UserRole.ADMIN;
    let projectRole: ProjectRole | null = null;
    const project = Object.assign(new Project(), {
      id: projectId,
      organizationId,
    });
    t.mock.method(
      AppDataSource,
      "getRepository",
      ((entity: unknown) => {
        if (entity === Project) {
          return { findOne: async () => project };
        }
        if (entity === ProjectMember) {
          return {
            findOne: async () =>
              projectRole
                ? Object.assign(new ProjectMember(), {
                    projectId,
                    userId: actorId,
                    role: projectRole,
                  })
                : null,
          };
        }
        throw new Error(`Unexpected repository: ${String(entity)}`);
      }) as never,
    );

    await authorizeProjectPermission(
      createRequest(
        { id: actorId, organizationId, role: actorRole },
        { projectId },
      ),
      "member:remove",
    );

    actorRole = UserRole.MANAGER;
    projectRole = ProjectRole.ADMIN;
    await authorizeProjectPermission(
      createRequest(
        { id: actorId, organizationId, role: actorRole },
        { projectId },
      ),
      "member:remove",
    );

    for (const role of [ProjectRole.LEAD, ProjectRole.MEMBER]) {
      projectRole = role;
      await assert.rejects(
        authorizeProjectPermission(
          createRequest(
            { id: actorId, organizationId, role: UserRole.MANAGER },
            { projectId },
          ),
          "member:remove",
        ),
        (error: unknown) =>
          error instanceof AppError &&
          error.code === "PROJECT_PERMISSION_DENIED",
      );
    }
  });
});
