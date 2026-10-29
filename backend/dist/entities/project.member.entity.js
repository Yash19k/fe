"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectMember = exports.ProjectRole = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("./project.entity");
const user_entity_1 = require("./user.entity");
var ProjectRole;
(function (ProjectRole) {
    ProjectRole["ADMIN"] = "ADMIN";
    ProjectRole["LEAD"] = "LEAD";
    ProjectRole["MEMBER"] = "MEMBER";
})(ProjectRole || (exports.ProjectRole = ProjectRole = {}));
let ProjectMember = class ProjectMember {
};
exports.ProjectMember = ProjectMember;
__decorate([
    (0, typeorm_1.PrimaryColumn)("uuid", { name: "project_id" }),
    __metadata("design:type", String)
], ProjectMember.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)("uuid", { name: "user_id" }),
    __metadata("design:type", String)
], ProjectMember.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", {
        name: "added_by_id",
        nullable: true,
    }),
    __metadata("design:type", Object)
], ProjectMember.prototype, "addedById", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ProjectRole,
        enumName: "project_members_role_enum",
        default: ProjectRole.MEMBER,
    }),
    __metadata("design:type", String)
], ProjectMember.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "joined_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ProjectMember.prototype, "joinedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => project_entity_1.Project, (project) => project.memberships, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "project_id" }),
    __metadata("design:type", project_entity_1.Project)
], ProjectMember.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.projectMemberships, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_entity_1.User)
], ProjectMember.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    (0, typeorm_1.JoinColumn)({ name: "added_by_id" }),
    __metadata("design:type", Object)
], ProjectMember.prototype, "addedBy", void 0);
exports.ProjectMember = ProjectMember = __decorate([
    (0, typeorm_1.Entity)("project_members"),
    (0, typeorm_1.Index)("IDX_project_members_user_id", ["userId"])
], ProjectMember);
