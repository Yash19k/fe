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
exports.WorkItem = exports.WorkItemPriority = exports.WorkItemStatus = exports.WorkItemType = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("./project.entity");
const user_entity_1 = require("./user.entity");
const work_item_assignee_entity_1 = require("./work.item-assignee.entity");
const sprint_entities_1 = require("./sprint.entities");
const work_item_attachment_entity_1 = require("./work.item.attachment.entity");
var WorkItemType;
(function (WorkItemType) {
    WorkItemType["EPIC"] = "EPIC";
    WorkItemType["STORY"] = "STORY";
    WorkItemType["TASK"] = "TASK";
    WorkItemType["SUBTASK"] = "SUBTASK";
    WorkItemType["BUG"] = "BUG";
})(WorkItemType || (exports.WorkItemType = WorkItemType = {}));
var WorkItemStatus;
(function (WorkItemStatus) {
    WorkItemStatus["BACKLOG"] = "BACKLOG";
    WorkItemStatus["IN_PROGRESS"] = "IN_PROGRESS";
    WorkItemStatus["IN_REVIEW"] = "IN_REVIEW";
    WorkItemStatus["TESTING_QA"] = "TESTING_QA";
    WorkItemStatus["BLOCKED"] = "BLOCKED";
    WorkItemStatus["ON_HOLD"] = "ON_HOLD";
    WorkItemStatus["DONE"] = "DONE";
})(WorkItemStatus || (exports.WorkItemStatus = WorkItemStatus = {}));
var WorkItemPriority;
(function (WorkItemPriority) {
    WorkItemPriority["LOW"] = "LOW";
    WorkItemPriority["MEDIUM"] = "MEDIUM";
    WorkItemPriority["HIGH"] = "HIGH";
    WorkItemPriority["URGENT"] = "URGENT";
})(WorkItemPriority || (exports.WorkItemPriority = WorkItemPriority = {}));
let WorkItem = class WorkItem {
};
exports.WorkItem = WorkItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], WorkItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItem.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItem.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "created_by_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItem.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "parent_work_item_id",
        type: "uuid",
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItem.prototype, "parentWorkItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: WorkItemType,
        enumName: "work_items_type_enum",
    }),
    __metadata("design:type", String)
], WorkItem.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], WorkItem.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], WorkItem.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: WorkItemStatus,
        enumName: "work_items_status_enum",
        default: WorkItemStatus.BACKLOG,
    }),
    __metadata("design:type", String)
], WorkItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: WorkItemPriority,
        enumName: "work_items_priority_enum",
        default: WorkItemPriority.MEDIUM,
    }),
    __metadata("design:type", String)
], WorkItem.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "due_date",
        type: "timestamptz",
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItem.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItem.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => project_entity_1.Project, (project) => project.workItems, {
        nullable: false,
        onDelete: "RESTRICT",
    }),
    (0, typeorm_1.JoinColumn)({ name: "project_id" }),
    __metadata("design:type", project_entity_1.Project)
], WorkItem.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.createdWorkItems, {
        nullable: false,
        onDelete: "RESTRICT",
    }),
    (0, typeorm_1.JoinColumn)({ name: "created_by_id" }),
    __metadata("design:type", user_entity_1.User)
], WorkItem.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => WorkItem, (workItem) => workItem.children, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    (0, typeorm_1.JoinColumn)({ name: "parent_work_item_id" }),
    __metadata("design:type", Object)
], WorkItem.prototype, "parentWorkItem", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => WorkItem, (workItem) => workItem.parentWorkItem),
    __metadata("design:type", Array)
], WorkItem.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_item_assignee_entity_1.WorkItemAssignee, (assignment) => assignment.workItem),
    __metadata("design:type", Array)
], WorkItem.prototype, "assignments", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "sprint_id",
        type: "uuid",
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItem.prototype, "sprintId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => sprint_entities_1.Sprint, (sprint) => sprint.workItems, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    (0, typeorm_1.JoinColumn)({ name: "sprint_id" }),
    __metadata("design:type", Object)
], WorkItem.prototype, "sprint", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_item_attachment_entity_1.WorkItemAttachment, (attachment) => attachment.workItem),
    __metadata("design:type", Array)
], WorkItem.prototype, "attachments", void 0);
exports.WorkItem = WorkItem = __decorate([
    (0, typeorm_1.Entity)({ name: "work_items" }),
    (0, typeorm_1.Index)("IDX_work_items_organization_id", ["organizationId"]),
    (0, typeorm_1.Index)("IDX_work_items_project_id", ["projectId"]),
    (0, typeorm_1.Index)("IDX_work_items_created_by_id", ["createdById"]),
    (0, typeorm_1.Index)("IDX_work_items_parent_id", ["parentWorkItemId"]),
    (0, typeorm_1.Index)("IDX_work_items_project_status", ["projectId", "status"]),
    (0, typeorm_1.Index)("IDX_work_items_project_type", ["projectId", "type"])
], WorkItem);
