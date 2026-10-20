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
exports.WorkItemAssignee = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const work_item_entity_1 = require("./work.item.entity");
let WorkItemAssignee = class WorkItemAssignee {
};
exports.WorkItemAssignee = WorkItemAssignee;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: "work_item_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemAssignee.prototype, "workItemId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: "user_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemAssignee.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "assigned_by_id",
        type: "uuid",
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItemAssignee.prototype, "assignedById", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: "assigned_at",
        type: "timestamptz",
    }),
    __metadata("design:type", Date)
], WorkItemAssignee.prototype, "assignedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_item_entity_1.WorkItem, (workItem) => workItem.assignments, {
        nullable: false,
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "work_item_id" }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemAssignee.prototype, "workItem", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.workItemAssignments, {
        nullable: false,
        onDelete: "RESTRICT",
    }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_entity_1.User)
], WorkItemAssignee.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    (0, typeorm_1.JoinColumn)({ name: "assigned_by_id" }),
    __metadata("design:type", Object)
], WorkItemAssignee.prototype, "assignedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "start_date",
        type: "date",
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItemAssignee.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "estimated_hours",
        type: "numeric",
        precision: 8,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItemAssignee.prototype, "estimatedHours", void 0);
exports.WorkItemAssignee = WorkItemAssignee = __decorate([
    (0, typeorm_1.Entity)({ name: "work_item_assignees" }),
    (0, typeorm_1.Index)("IDX_work_item_assignees_user_id", ["userId"])
], WorkItemAssignee);
