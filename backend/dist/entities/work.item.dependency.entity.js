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
exports.WorkItemDependency = void 0;
const typeorm_1 = require("typeorm");
const work_item_entity_1 = require("./work.item.entity");
let WorkItemDependency = class WorkItemDependency {
};
exports.WorkItemDependency = WorkItemDependency;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], WorkItemDependency.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "work_item_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemDependency.prototype, "workItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "depends_on_work_item_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemDependency.prototype, "dependsOnWorkItemId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItemDependency.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_item_entity_1.WorkItem, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "work_item_id" }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemDependency.prototype, "workItem", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_item_entity_1.WorkItem, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "depends_on_work_item_id" }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemDependency.prototype, "dependsOnWorkItem", void 0);
exports.WorkItemDependency = WorkItemDependency = __decorate([
    (0, typeorm_1.Entity)({ name: "work_item_dependencies" }),
    (0, typeorm_1.Unique)("UQ_work_item_dependencies", ["workItemId", "dependsOnWorkItemId"])
], WorkItemDependency);
