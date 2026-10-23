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
exports.WorkItemOccurrence = void 0;
const typeorm_1 = require("typeorm");
const work_item_entity_1 = require("./work.item.entity");
const work_item_recurrence_entity_1 = require("./work.item.recurrence.entity");
let WorkItemOccurrence = class WorkItemOccurrence {
};
exports.WorkItemOccurrence = WorkItemOccurrence;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], WorkItemOccurrence.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "recurrence_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemOccurrence.prototype, "recurrenceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_item_recurrence_entity_1.WorkItemRecurrence, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "recurrence_id" }),
    __metadata("design:type", work_item_recurrence_entity_1.WorkItemRecurrence)
], WorkItemOccurrence.prototype, "recurrence", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "scheduled_for", type: "date" }),
    __metadata("design:type", String)
], WorkItemOccurrence.prototype, "scheduledFor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "work_item_id", type: "uuid", unique: true }),
    __metadata("design:type", String)
], WorkItemOccurrence.prototype, "workItemId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => work_item_entity_1.WorkItem, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "work_item_id" }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemOccurrence.prototype, "workItem", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItemOccurrence.prototype, "createdAt", void 0);
exports.WorkItemOccurrence = WorkItemOccurrence = __decorate([
    (0, typeorm_1.Entity)("work_item_occurrences"),
    (0, typeorm_1.Unique)("UQ_occurrence_recurrence_date", ["recurrenceId", "scheduledFor"]),
    (0, typeorm_1.Index)("IDX_occurrence_recurrence", ["recurrenceId"])
], WorkItemOccurrence);
