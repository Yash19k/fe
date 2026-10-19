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
exports.WorkItemTimeEntry = void 0;
const typeorm_1 = require("typeorm");
const work_item_entity_1 = require("./work.item.entity");
const user_entity_1 = require("./user.entity");
let WorkItemTimeEntry = class WorkItemTimeEntry {
};
exports.WorkItemTimeEntry = WorkItemTimeEntry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], WorkItemTimeEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "work_item_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemTimeEntry.prototype, "workItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemTimeEntry.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "duration_minutes", type: "integer" }),
    __metadata("design:type", Number)
], WorkItemTimeEntry.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], WorkItemTimeEntry.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "start_time", type: "timestamptz", default: () => "now()" }),
    __metadata("design:type", Date)
], WorkItemTimeEntry.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItemTimeEntry.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_item_entity_1.WorkItem, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "work_item_id" }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemTimeEntry.prototype, "workItem", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_entity_1.User)
], WorkItemTimeEntry.prototype, "user", void 0);
exports.WorkItemTimeEntry = WorkItemTimeEntry = __decorate([
    (0, typeorm_1.Entity)({ name: "work_item_time_entries" }),
    (0, typeorm_1.Index)("IDX_work_item_time_entries_work_item", ["workItemId"])
], WorkItemTimeEntry);
