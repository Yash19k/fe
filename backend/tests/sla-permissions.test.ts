import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  hasProjectPermission,
  ProjectAction,
} from "../middleware/project.permission";
import { ProjectRole } from "../entities/project.member.entity";

describe("SLA project permissions", () => {
  test("allows management actions for project administrators and leads", () => {
    for (const role of [ProjectRole.ADMIN, ProjectRole.LEAD]) {
      for (const action of [
        "sla:view",
        "sla:manage",
        "sla:resolve",
        "sla:audit",
      ] as ProjectAction[]) {
        assert.equal(hasProjectPermission(role, action), true);
      }
    }
  });

  test("allows members to view SLA data but not change it", () => {
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "sla:view"), true);
    for (const action of [
      "sla:manage",
      "sla:resolve",
      "sla:audit",
    ] as ProjectAction[]) {
      assert.equal(hasProjectPermission(ProjectRole.MEMBER, action), false);
    }
  });
});
