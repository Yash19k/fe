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
exports.WorkItemAttachment = exports.AttachmentType = void 0;
const typeorm_1 = require("typeorm");
const work_item_entity_1 = require("./work.item.entity");
const user_entity_1 = require("./user.entity");
var AttachmentType;
(function (AttachmentType) {
    AttachmentType["IMAGE"] = "IMAGE";
    AttachmentType["VIDEO"] = "VIDEO";
    AttachmentType["DOCUMENT"] = "DOCUMENT";
    AttachmentType["OTHER"] = "OTHER";
})(AttachmentType || (exports.AttachmentType = AttachmentType = {}));
let WorkItemAttachment = class WorkItemAttachment {
};
exports.WorkItemAttachment = WorkItemAttachment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", name: "work_item_id" }),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "workItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_item_entity_1.WorkItem, (workItem) => workItem.attachments, { onDelete: "CASCADE", nullable: false }),
    __metadata("design:type", work_item_entity_1.WorkItem)
], WorkItemAttachment.prototype, "workItem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", name: "uploaded_by_id" }),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "uploadedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false }),
    __metadata("design:type", user_entity_1.User)
], WorkItemAttachment.prototype, "uploadedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "originalName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: AttachmentType,
    }),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150 }),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint" }),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "size", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", unique: true }),
    __metadata("design:type", String)
], WorkItemAttachment.prototype, "storageKey", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WorkItemAttachment.prototype, "createdAt", void 0);
exports.WorkItemAttachment = WorkItemAttachment = __decorate([
    (0, typeorm_1.Entity)("work_item_attachments"),
    (0, typeorm_1.Index)(["workItemId", "createdAt"])
], WorkItemAttachment);
