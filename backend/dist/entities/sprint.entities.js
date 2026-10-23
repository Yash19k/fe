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
exports.Sprint = exports.SprintStatus = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("./project.entity");
const user_entity_1 = require("./user.entity");
const work_item_entity_1 = require("./work.item.entity");
var SprintStatus;
(function (SprintStatus) {
    SprintStatus["PLANNED"] = "PLANNED";
    SprintStatus["ACTIVE"] = "ACTIVE";
    SprintStatus["COMPLETED"] = "COMPLETED";
    SprintStatus["CANCELLED"] = "CANCELLED";
})(SprintStatus || (exports.SprintStatus = SprintStatus = {}));
let Sprint = class Sprint {
};
exports.Sprint = Sprint;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Sprint.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid" }),
    __metadata("design:type", String)
], Sprint.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "created_by_id", type: "uuid" }),
    __metadata("design:type", String)
], Sprint.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Sprint.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Sprint.prototype, "goal", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "start_date", type: "date" }),
    __metadata("design:type", String)
], Sprint.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "end_date", type: "date" }),
    __metadata("design:type", String)
], Sprint.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: SprintStatus,
        enumName: "sprints_status_enum",
        default: SprintStatus.PLANNED,
    }),
    __metadata("design:type", String)
], Sprint.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: "created_at",
        type: "timestamptz",
    }),
    __metadata("design:type", Date)
], Sprint.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: "updated_at",
        type: "timestamptz",
    }),
    __metadata("design:type", Date)
], Sprint.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => project_entity_1.Project, (project) => project.sprints, {
        nullable: false,
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "project_id" }),
    __metadata("design:type", project_entity_1.Project)
], Sprint.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.createdSprints, {
        nullable: false,
        onDelete: "RESTRICT",
    }),
    (0, typeorm_1.JoinColumn)({ name: "created_by_id" }),
    __metadata("design:type", user_entity_1.User)
], Sprint.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => work_item_entity_1.WorkItem, (workItem) => workItem.sprint),
    __metadata("design:type", Array)
], Sprint.prototype, "workItems", void 0);
exports.Sprint = Sprint = __decorate([
    (0, typeorm_1.Entity)({ name: "sprints" }),
    (0, typeorm_1.Index)("IDX_sprints_project_id", ["projectId"]),
    (0, typeorm_1.Index)("IDX_sprints_created_by_id", ["createdById"]),
    (0, typeorm_1.Index)("IDX_sprints_project_status", ["projectId", "status"]),
    (0, typeorm_1.Check)("CHK_sprints_valid_dates", '"end_date" >= "start_date"')
], Sprint);
