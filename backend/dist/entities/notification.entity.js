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
exports.Notification = exports.NotificationType = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const organization_entity_1 = require("./organization.entity");
var NotificationType;
(function (NotificationType) {
    NotificationType["TASK_ASSIGNED"] = "TASK_ASSIGNED";
    NotificationType["TASK_UPDATED"] = "TASK_UPDATED";
    NotificationType["TASK_COMPLETED"] = "TASK_COMPLETED";
    NotificationType["TASK_OVERDUE"] = "TASK_OVERDUE";
    NotificationType["TASK_MENTIONED"] = "TASK_MENTIONED";
    NotificationType["SLA_ESCALATED"] = "SLA_ESCALATED";
    NotificationType["RECURRING_TASK_CREATED"] = "RECURRING_TASK_CREATED";
    NotificationType["RECURRING_TASK_FAILED"] = "RECURRING_TASK_FAILED";
    NotificationType["PROJECT_MEMBER_ADDED"] = "PROJECT_MEMBER_ADDED";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
let Notification = class Notification {
};
exports.Notification = Notification;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Notification.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "uuid" }),
    __metadata("design:type", String)
], Notification.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid" }),
    __metadata("design:type", String)
], Notification.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: NotificationType,
        enumName: "notifications_type_enum",
    }),
    __metadata("design:type", String)
], Notification.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], Notification.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Notification.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Notification.prototype, "read", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "read_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "readAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "work_item_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "workItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "link", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "deduplication_key",
        type: "varchar",
        length: 255,
        nullable: true,
        unique: true,
    }),
    __metadata("design:type", Object)
], Notification.prototype, "deduplicationKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Notification.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_entity_1.User)
], Notification.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "organization_id" }),
    __metadata("design:type", organization_entity_1.Organization)
], Notification.prototype, "organization", void 0);
exports.Notification = Notification = __decorate([
    (0, typeorm_1.Entity)({ name: "notifications" }),
    (0, typeorm_1.Index)("IDX_notifications_user", ["userId", "read", "createdAt"])
], Notification);
