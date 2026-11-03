import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { updateOrganizationMemberRole } from "../controllers/organization.controller";
import { updateOrganizationSla } from "../controllers/sla.controller";
import { AppError } from "../errors/app.error";
import { Project } from "../entities/project.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { UserRole } from "../entities/user.entity";
import {
  checkPermission,
  hasOrganizationPermission,
} from "../middleware/check.permissions";
import { isLoggedIn } from "../middleware/is.loggedin";
import {
  authorizeProjectPermission,
  hasProjectPermission,
} from "../middleware/project.permission";

const organizationId = "organization-1";
const projectId = "project-1";
const userId = "user-1";

function createRequest(
  role: UserRole,
  params: Record<string, string> = {},
): Request {
  return {
    user: { id: userId, organizationId, role },
    params,
    body: {},
    query: {},
  } as Request;
}

describe("organization permission matrix", () => {
  test("keeps organization-only actions separate from project permissions", () => {
    assert.equal(hasOrganizationPermission(UserRole.ADMIN, "user:manage"), true);
    assert.equal(hasOrganizationPermission(UserRole.ADMIN, "role:manage"), true);
    assert.equal(hasOrganizationPermission(UserRole.ADMIN, "sla:manage"), true);
    assert.equal(hasOrganizationPermission(UserRole.MANAGER, "project:create"), true);
    assert.equal(hasOrganizationPermission(UserRole.MANAGER, "sla:manage"), false);
    assert.equal(hasOrganizationPermission(UserRole.MANAGER, "user:manage"), false);
    assert.equal(hasOrganizationPermission(UserRole.TEAMMATE, "project:read"), true);
    assert.equal(hasOrganizationPermission(UserRole.TEAMMATE, "project:create"), false);
    assert.equal(hasOrganizationPermission(UserRole.TEAMMATE, "role:manage"), false);
  });

  test("organization SLA updates are administrator-only", async (t) => {
    let repositoryCalls = 0;
    const policy = {
      id: "sla-1",
      organizationId,
      urgentHours: 4,
      highHours: 8,
      mediumHours: 24,
      lowHours: 72,
      escalateHours: 8,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    t.mock.method(
      AppDataSource,
      "getRepository",
      (() => {
        repositoryCalls += 1;
        return {
          findOne: async () => policy,
          save: async (value: typeof policy) => value,
        };
      }) as never,
    );

    for (const role of [UserRole.MANAGER, UserRole.TEAMMATE]) {
      await assert.rejects(
        updateOrganizationSla(createRequest(role), {} as Response),
        (error: unknown) =>
          error instanceof AppError &&
          error.statusCode === 403 &&
          error.code === "FORBIDDEN",
      );
    }
    assert.equal(repositoryCalls, 0);

    const response = {
      json(body: unknown) {
        return body;
      },
    } as Response;
    await updateOrganizationSla(createRequest(UserRole.ADMIN), response);
    assert.equal(repositoryCalls, 1);
  });

  test("organization managers and teammates cannot change organization roles", async () => {
    for (const role of [UserRole.MANAGER, UserRole.TEAMMATE]) {
      await assert.rejects(
        updateOrganizationMemberRole(
          createRequest(role, { userId: "target-user" }),
          {} as Response,
        ),
        (error: unknown) =>
          error instanceof AppError &&
          error.statusCode === 403 &&
          error.code === "ADMIN_REQUIRED",
      );
    }
  });

  test("rejects missing authentication and invalid organization roles", async () => {
    const permission = checkPermission("sla:manage");

    await new Promise<void>((resolve, reject) => {
      permission(
        { user: undefined } as Request,
        {} as Response,
        (error?: unknown) => {
          if (error) reject(error);
          else resolve();
        },
      );
    }).then(
      () => assert.fail("Expected unauthenticated request to be rejected."),
      (error: unknown) =>
        assert.ok(error instanceof AppError && error.statusCode === 401),
    );

    await new Promise<void>((resolve, reject) => {
      permission(
        { user: { id: userId, role: "INVALID" } } as never,
        {} as Response,
        (error?: unknown) => {
          if (error) reject(error);
          else resolve();
        },
      );
    }).then(
      () => assert.fail("Expected invalid role to be rejected."),
      (error: unknown) =>
        assert.ok(error instanceof AppError && error.statusCode === 403),
    );
  });

  test("rejects missing and malformed authentication tokens", async () => {
    for (const request of [
      { headers: {}, cookies: {} },
      { headers: { authorization: "Bearer invalid-token" }, cookies: {} },
    ]) {
      let receivedError: unknown;
      await isLoggedIn(
        request as Request,
        {} as Response,
        (error?: unknown) => {
          receivedError = error;
        },
      );
      assert.ok(receivedError instanceof AppError);
      assert.equal(receivedError.statusCode, 401);
    }
  });
});

describe("cross-level organization and project roles", () => {
  test("organization managers do not inherit project permissions", async (t) => {
    t.mock.method(
      AppDataSource,
      "getRepository",
      ((entity: unknown) => {
        if (entity === Project) {
          return {
            findOne: async () => ({ id: projectId, organizationId }),
          };
        }
        return {
          findOne: async () => ({
            projectId,
            userId,
            role: ProjectRole.MEMBER,
          }),
        };
      }) as never,
    );

    for (const action of [
      "task:delete",
      "sprint:create",
      "sprint:delete",
    ] as const) {
      await assert.rejects(
        authorizeProjectPermission(
          createRequest(UserRole.MANAGER, { projectId }),
          action,
        ),
        (error: unknown) =>
          error instanceof AppError &&
          error.statusCode === 403 &&
          error.code === "PROJECT_PERMISSION_DENIED",
      );
    }
  });

  test("organization teammates with Project MEMBER cannot delete tasks or manage sprints", async (t) => {
    t.mock.method(
      AppDataSource,
      "getRepository",
      ((entity: unknown) => {
        if (entity === Project) {
          return {
            findOne: async () => ({ id: projectId, organizationId }),
          };
        }
        return {
          findOne: async () => ({
            projectId,
            userId,
            role: ProjectRole.MEMBER,
          }),
        };
      }) as never,
    );

    for (const action of [
      "task:delete",
      "sprint:create",
      "sprint:delete",
    ] as const) {
      await assert.rejects(
        authorizeProjectPermission(
          createRequest(UserRole.TEAMMATE, { projectId }),
          action,
        ),
        (error: unknown) =>
          error instanceof AppError &&
          error.statusCode === 403 &&
          error.code === "PROJECT_PERMISSION_DENIED",
      );
    }
  });

  test("organization teammates use their project ADMIN role only within that project", async (t) => {
    t.mock.method(
      AppDataSource,
      "getRepository",
      ((entity: unknown) => {
        if (entity === Project) {
          return {
            findOne: async () => ({ id: projectId, organizationId }),
          };
        }
        return {
          findOne: async () => ({
            projectId,
            userId,
            role: ProjectRole.ADMIN,
          }),
        };
      }) as never,
    );

    await authorizeProjectPermission(
      createRequest(UserRole.TEAMMATE, { projectId }),
      "task:delete",
    );
    await authorizeProjectPermission(
      createRequest(UserRole.TEAMMATE, { projectId }),
      "sprint:create",
    );

    assert.equal(
      hasOrganizationPermission(UserRole.TEAMMATE, "role:manage"),
      false,
    );
    assert.equal(hasProjectPermission(ProjectRole.ADMIN, "member:remove"), true);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "member:remove"), false);
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "member:remove"), false);
  });

  test("project MEMBER and LEAD do not inherit higher project-role actions", () => {
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "task:create"), true);
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "task:assign"), true);
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "task:delete"), false);
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "sprint:create"), false);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "project:delete"), false);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "member:remove"), false);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "member:add"), true);
  });

  test("project LEAD cannot assign project ADMIN", async (t) => {
    t.mock.method(
      AppDataSource,
      "getRepository",
      ((entity: unknown) => {
        if (entity === Project) {
          return {
            findOne: async () => ({ id: projectId, organizationId }),
          };
        }
        return {
          findOne: async () => ({
            projectId,
            userId,
            role: ProjectRole.LEAD,
          }),
        };
      }) as never,
    );
    const request = createRequest(UserRole.MANAGER, { projectId });
    request.body = { role: ProjectRole.ADMIN };

    await assert.rejects(
      authorizeProjectPermission(request, "member:role:update"),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 403 &&
        error.code === "PROJECT_ADMIN_REQUIRED",
    );
  });
});
