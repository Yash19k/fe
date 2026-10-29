import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EntityManager } from "typeorm";
import { AppError } from "../errors/app.error";
import { User } from "../entities/user.entity";
import { validateAssignees } from "../services/work-item.service";

function createManager(isProjectMember: boolean) {
  let writeCount = 0;
  const manager = {
    getRepository: (target: unknown) => ({
      find: async () =>
        target === User
          ? [{ id: "user-1" }]
          : isProjectMember
            ? [{ userId: "user-1" }]
            : [],
      create: (value: unknown) => {
        writeCount += 1;
        return value;
      },
      save: async (value: unknown) => {
        writeCount += 1;
        return value;
      },
    }),
  } as unknown as EntityManager;

  return {
    manager,
    getWriteCount: () => writeCount,
  };
}

describe("work item assignee project membership", () => {
  test("rejects a valid organization user who is not a project member without writes", async () => {
    const { manager, getWriteCount } = createManager(false);

    await assert.rejects(
      validateAssignees(
        [{ userId: "user-1" }],
        "project-1",
        "organization-1",
        manager,
      ),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_ASSIGNEE",
    );

    assert.equal(getWriteCount(), 0);
  });

  test("accepts an existing project member without changing memberships", async () => {
    const { manager, getWriteCount } = createManager(true);

    await validateAssignees(
      [{ userId: "user-1" }],
      "project-1",
      "organization-1",
      manager,
    );
    assert.equal(getWriteCount(), 0);
    assert.equal(getWriteCount(), 0);
  });
});
