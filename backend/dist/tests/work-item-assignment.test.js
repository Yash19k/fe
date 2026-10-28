"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const app_error_1 = require("../errors/app.error");
const user_entity_1 = require("../entities/user.entity");
const work_item_service_1 = require("../services/work-item.service");
function createManager(isProjectMember) {
    let writeCount = 0;
    const manager = {
        getRepository: (target) => ({
            find: async () => target === user_entity_1.User
                ? [{ id: "user-1" }]
                : isProjectMember
                    ? [{ userId: "user-1" }]
                    : [],
            create: (value) => {
                writeCount += 1;
                return value;
            },
            save: async (value) => {
                writeCount += 1;
                return value;
            },
        }),
    };
    return {
        manager,
        getWriteCount: () => writeCount,
    };
}
(0, node_test_1.describe)("work item assignee project membership", () => {
    (0, node_test_1.test)("rejects a valid organization user who is not a project member without writes", async () => {
        const { manager, getWriteCount } = createManager(false);
        await strict_1.default.rejects((0, work_item_service_1.validateAssignees)([{ userId: "user-1" }], "project-1", "organization-1", manager), (error) => error instanceof app_error_1.AppError && error.code === "INVALID_ASSIGNEE");
        strict_1.default.equal(getWriteCount(), 0);
    });
    (0, node_test_1.test)("accepts an existing project member without changing memberships", async () => {
        const { manager, getWriteCount } = createManager(true);
        await (0, work_item_service_1.validateAssignees)([{ userId: "user-1" }], "project-1", "organization-1", manager);
        strict_1.default.equal(getWriteCount(), 0);
        strict_1.default.equal(getWriteCount(), 0);
    });
});
