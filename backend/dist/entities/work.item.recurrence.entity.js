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
exports.WorkItemRecurrence = exports.MonthlyPattern = exports.RecurrenceFrequency = void 0;
const typeorm_1 = require("typeorm");
const work_item_entity_1 = require("./work.item.entity");
var RecurrenceFrequency;
(function (RecurrenceFrequency) {
    RecurrenceFrequency["DAILY"] = "DAILY";
    RecurrenceFrequency["WEEKLY"] = "WEEKLY";
    RecurrenceFrequency["MONTHLY"] = "MONTHLY";
})(RecurrenceFrequency || (exports.RecurrenceFrequency = RecurrenceFrequency = {}));
var MonthlyPattern;
(function (MonthlyPattern) {
    MonthlyPattern["DAY_OF_MONTH"] = "DAY_OF_MONTH";
    MonthlyPattern["FIRST_DAY"] = "FIRST_DAY";
    MonthlyPattern["LAST_FRIDAY"] = "LAST_FRIDAY";
})(MonthlyPattern || (exports.MonthlyPattern = MonthlyPattern = {}));
let WorkItemRecurrence = class WorkItemRecurrence {
};
exports.WorkItemRecurrence = WorkItemRecurrence;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], WorkItemRecurrence.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => work_item_entity_1.WorkItem, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "work_item_id" }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemRecurrence.prototype, "workItem", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: RecurrenceFrequency,
    }),
    __metadata("design:type", String)
], WorkItemRecurrence.prototype, "frequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 1 }),
    __metadata("design:type", Number)
], WorkItemRecurrence.prototype, "interval", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "days_of_week",
        type: "smallint",
        array: true,
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItemRecurrence.prototype, "daysOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "monthly_pattern",
        type: "enum",
        enum: MonthlyPattern,
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItemRecurrence.prototype, "monthlyPattern", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "day_of_month",
        type: "smallint",
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItemRecurrence.prototype, "dayOfMonth", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "starts_on", type: "date" }),
    __metadata("design:type", String)
], WorkItemRecurrence.prototype, "startsOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "ends_on", type: "date", nullable: true }),
    __metadata("design:type", Object)
], WorkItemRecurrence.prototype, "endsOn", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "next_run_at",
        type: "timestamptz",
        nullable: true,
    }),
    __metadata("design:type", Object)
], WorkItemRecurrence.prototype, "nextRunAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, default: "Asia/Kolkata" }),
    __metadata("design:type", String)
], WorkItemRecurrence.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "time_of_day", type: "varchar", length: 5, default: "09:00" }),
    __metadata("design:type", String)
], WorkItemRecurrence.prototype, "timeOfDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "weekdays_only", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], WorkItemRecurrence.prototype, "weekdaysOnly", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_active", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], WorkItemRecurrence.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItemRecurrence.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItemRecurrence.prototype, "updatedAt", void 0);
exports.WorkItemRecurrence = WorkItemRecurrence = __decorate([
    (0, typeorm_1.Entity)("work_item_recurrences"),
    (0, typeorm_1.Check)("CHK_recurrence_interval_positive", `"interval" > 0`),
    (0, typeorm_1.Index)("IDX_recurrence_next_run", ["isActive", "nextRunAt"])
], WorkItemRecurrence);
