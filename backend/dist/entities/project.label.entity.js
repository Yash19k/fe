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
exports.ProjectLabel = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("./project.entity");
const work_item_entity_1 = require("./work.item.entity");
let ProjectLabel = class ProjectLabel {
};
exports.ProjectLabel = ProjectLabel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ProjectLabel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid" }),
    __metadata("design:type", String)
], ProjectLabel.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], ProjectLabel.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 30, default: "#3B82F6" }),
    __metadata("design:type", String)
], ProjectLabel.prototype, "color", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], ProjectLabel.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ProjectLabel.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => project_entity_1.Project, (project) => project.labels, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "project_id" }),
    __metadata("design:type", project_entity_1.Project)
], ProjectLabel.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_item_entity_1.WorkItem, (workItem) => workItem.label),
    __metadata("design:type", Array)
], ProjectLabel.prototype, "workItems", void 0);
exports.ProjectLabel = ProjectLabel = __decorate([
    (0, typeorm_1.Entity)({ name: "project_labels" }),
    (0, typeorm_1.Unique)("UQ_project_labels_project_name", ["projectId", "name"]),
    (0, typeorm_1.Index)("IDX_project_labels_project", ["projectId"])
], ProjectLabel);
