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
exports.WorkItemComment = void 0;
const typeorm_1 = require("typeorm");
const work_item_entity_1 = require("./work.item.entity");
const user_entity_1 = require("./user.entity");
let WorkItemComment = class WorkItemComment {
};
exports.WorkItemComment = WorkItemComment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], WorkItemComment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "work_item_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemComment.prototype, "workItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "author_id", type: "uuid" }),
    __metadata("design:type", String)
], WorkItemComment.prototype, "authorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], WorkItemComment.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], WorkItemComment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_item_entity_1.WorkItem, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "work_item_id" }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemComment.prototype, "workItem", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "author_id" }),
    __metadata("design:type", user_entity_1.User)
], WorkItemComment.prototype, "author", void 0);
exports.WorkItemComment = WorkItemComment = __decorate([
    (0, typeorm_1.Entity)({ name: "work_item_comments" }),
    (0, typeorm_1.Index)("IDX_work_item_comments_work_item", ["workItemId"])
], WorkItemComment);
