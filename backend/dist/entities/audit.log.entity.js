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
exports.AuditLog = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("./organization.entity");
const project_entity_1 = require("./project.entity");
const user_entity_1 = require("./user.entity");
let AuditLog = class AuditLog {
};
exports.AuditLog = AuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], AuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid" }),
    __metadata("design:type", String)
], AuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "uuid" }),
    __metadata("design:type", String)
], AuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], AuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "entity_type", type: "varchar", length: 50 }),
    __metadata("design:type", String)
], AuditLog.prototype, "entityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "entity_id", type: "varchar", length: 100 }),
    __metadata("design:type", String)
], AuditLog.prototype, "entityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], AuditLog.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "previous_state", type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "previousState", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "new_state", type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "newState", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_undone", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], AuditLog.prototype, "isUndone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "undone_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "undoneAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "undone_by_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "undoneById", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "reversal_log_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "reversalLogId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], AuditLog.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "organization_id" }),
    __metadata("design:type", organization_entity_1.Organization)
], AuditLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => project_entity_1.Project, { onDelete: "CASCADE", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "project_id" }),
    __metadata("design:type", Object)
], AuditLog.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_entity_1.User)
], AuditLog.prototype, "user", void 0);
exports.AuditLog = AuditLog = __decorate([
    (0, typeorm_1.Entity)({ name: "audit_logs" }),
    (0, typeorm_1.Index)("IDX_audit_logs_project", ["projectId", "createdAt"]),
    (0, typeorm_1.Index)("IDX_audit_logs_org", ["organizationId", "createdAt"])
], AuditLog);
