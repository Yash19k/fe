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
exports.ProjectWorkflow = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("./project.entity");
let ProjectWorkflow = class ProjectWorkflow {
};
exports.ProjectWorkflow = ProjectWorkflow;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ProjectWorkflow.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid" }),
    __metadata("design:type", String)
], ProjectWorkflow.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150 }),
    __metadata("design:type", String)
], ProjectWorkflow.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], ProjectWorkflow.prototype, "statuses", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ProjectWorkflow.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ProjectWorkflow.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => project_entity_1.Project, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "project_id" }),
    __metadata("design:type", project_entity_1.Project)
], ProjectWorkflow.prototype, "project", void 0);
exports.ProjectWorkflow = ProjectWorkflow = __decorate([
    (0, typeorm_1.Entity)({ name: "project_workflows" }),
    (0, typeorm_1.Unique)("UQ_project_workflows_project", ["projectId"])
], ProjectWorkflow);
