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
exports.User = exports.UserStatus = exports.UserRole = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("./organization.entity");
const project_entity_1 = require("./project.entity");
const work_item_entity_1 = require("./work.item.entity");
const work_item_assignee_entity_1 = require("./work.item-assignee.entity");
const project_member_entity_1 = require("./project.member.entity");
const user_session_entity_1 = require("./user.session.entity");
const sprint_entities_1 = require("./sprint.entities");
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["TEAMMATE"] = "TEAMMATE";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["PENDING"] = "PENDING";
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["DISABLED"] = "DISABLED";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
let User = class User {
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "full_name", type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "password_hash",
        type: "varchar",
        length: 255,
        nullable: true,
    }),
    __metadata("design:type", Object)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "invite_token_hash",
        type: "varchar",
        nullable: true,
    }),
    __metadata("design:type", Object)
], User.prototype, "inviteTokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "invite_expires_at",
        type: "timestamptz",
        nullable: true,
    }),
    __metadata("design:type", Object)
], User.prototype, "inviteExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: UserRole,
        enumName: "users_role_enum",
        default: UserRole.ADMIN,
    }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: UserStatus,
        enumName: "users_status_enum",
        default: UserStatus.PENDING,
    }),
    __metadata("design:type", String)
], User.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, (organization) => organization.users, {
        nullable: true,
        onDelete: "RESTRICT",
    }),
    (0, typeorm_1.JoinColumn)({ name: "organization_id" }),
    __metadata("design:type", organization_entity_1.Organization)
], User.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => project_entity_1.Project, (project) => project.createdBy),
    __metadata("design:type", Array)
], User.prototype, "createdProjects", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_item_entity_1.WorkItem, (workItem) => workItem.createdBy),
    __metadata("design:type", Array)
], User.prototype, "createdWorkItems", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_item_assignee_entity_1.WorkItemAssignee, (assignment) => assignment.user),
    __metadata("design:type", Array)
], User.prototype, "workItemAssignments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => project_member_entity_1.ProjectMember, (membership) => membership.user),
    __metadata("design:type", Array)
], User.prototype, "projectMemberships", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_session_entity_1.UserSession, (session) => session.user),
    __metadata("design:type", Array)
], User.prototype, "sessions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => sprint_entities_1.Sprint, (sprint) => sprint.createdBy),
    __metadata("design:type", Array)
], User.prototype, "createdSprints", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)({ name: "users" }),
    (0, typeorm_1.Index)("IDX_users_organization_id", ["organizationId"])
], User);
