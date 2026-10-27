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
exports.Whiteboard = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("./project.entity");
const user_entity_1 = require("./user.entity");
let Whiteboard = class Whiteboard {
};
exports.Whiteboard = Whiteboard;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Whiteboard.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid" }),
    __metadata("design:type", String)
], Whiteboard.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid" }),
    __metadata("design:type", String)
], Whiteboard.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "created_by_id", type: "uuid" }),
    __metadata("design:type", String)
], Whiteboard.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150 }),
    __metadata("design:type", String)
], Whiteboard.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "scene_data", type: "jsonb", default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], Whiteboard.prototype, "sceneData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", default: 1 }),
    __metadata("design:type", Number)
], Whiteboard.prototype, "revision", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Whiteboard.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Whiteboard.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => project_entity_1.Project, { onDelete: "CASCADE", nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: "project_id" }),
    __metadata("design:type", project_entity_1.Project)
], Whiteboard.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "RESTRICT", nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: "created_by_id" }),
    __metadata("design:type", user_entity_1.User)
], Whiteboard.prototype, "createdBy", void 0);
exports.Whiteboard = Whiteboard = __decorate([
    (0, typeorm_1.Entity)("whiteboards"),
    (0, typeorm_1.Index)("IDX_whiteboards_project_id", ["projectId"])
], Whiteboard);
