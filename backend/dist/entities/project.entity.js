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
exports.Project = exports.ProjectVisibility = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("./organization.entity");
const user_entity_1 = require("./user.entity");
const work_item_entity_1 = require("./work.item.entity");
const project_member_entity_1 = require("./project.member.entity");
const sprint_entities_1 = require("./sprint.entities");
const project_label_entity_1 = require("./project.label.entity");
var ProjectVisibility;
(function (ProjectVisibility) {
    ProjectVisibility["PRIVATE"] = "PRIVATE";
    ProjectVisibility["PUBLIC"] = "PUBLIC";
})(ProjectVisibility || (exports.ProjectVisibility = ProjectVisibility = {}));
let Project = class Project {
};
exports.Project = Project;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Project.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid" }),
    __metadata("design:type", String)
], Project.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150 }),
    __metadata("design:type", String)
], Project.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], Project.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Project.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "start_date", type: "date", nullable: true }),
    __metadata("design:type", Object)
], Project.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "end_date", type: "date", nullable: true }),
    __metadata("design:type", Object)
], Project.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "created_by_id", type: "uuid" }),
    __metadata("design:type", String)
], Project.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Project.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Project.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ProjectVisibility,
        enumName: "projects_visibility_enum",
        default: ProjectVisibility.PRIVATE,
    }),
    __metadata("design:type", String)
], Project.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, (organization) => organization.projects, {
        nullable: false,
        onDelete: "RESTRICT",
    }),
    (0, typeorm_1.JoinColumn)({ name: "organization_id" }),
    __metadata("design:type", organization_entity_1.Organization)
], Project.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.createdProjects, {
        nullable: false,
        onDelete: "RESTRICT",
    }),
    (0, typeorm_1.JoinColumn)({ name: "created_by_id" }),
    __metadata("design:type", user_entity_1.User)
], Project.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_item_entity_1.WorkItem, (workItem) => workItem.project),
    __metadata("design:type", Array)
], Project.prototype, "workItems", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => project_member_entity_1.ProjectMember, (membership) => membership.project),
    __metadata("design:type", Array)
], Project.prototype, "memberships", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => sprint_entities_1.Sprint, (sprint) => sprint.project),
    __metadata("design:type", Array)
], Project.prototype, "sprints", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => project_label_entity_1.ProjectLabel, (label) => label.project),
    __metadata("design:type", Array)
], Project.prototype, "labels", void 0);
__decorate([
    (0, typeorm_1.OneToOne)("ProjectWorkflow", "project"),
    __metadata("design:type", Object)
], Project.prototype, "workflow", void 0);
exports.Project = Project = __decorate([
    (0, typeorm_1.Entity)({ name: "projects" }),
    (0, typeorm_1.Unique)("UQ_projects_organization_key", ["organizationId", "key"]),
    (0, typeorm_1.Index)("IDX_projects_organization_id", ["organizationId"]),
    (0, typeorm_1.Index)("IDX_projects_created_by_id", ["createdById"]),
    (0, typeorm_1.Check)("CHK_projects_date_order", `"start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"`)
], Project);
