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
exports.ChatConversation = exports.ChatConversationType = void 0;
const typeorm_1 = require("typeorm");
const chat_conversation_member_entity_1 = require("./chat-conversation-member.entity");
var ChatConversationType;
(function (ChatConversationType) {
    ChatConversationType["DIRECT"] = "DIRECT";
    ChatConversationType["GROUP"] = "GROUP";
    ChatConversationType["PROJECT"] = "PROJECT";
})(ChatConversationType || (exports.ChatConversationType = ChatConversationType = {}));
let ChatConversation = class ChatConversation {
};
exports.ChatConversation = ChatConversation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ChatConversation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid" }),
    __metadata("design:type", String)
], ChatConversation.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "project_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], ChatConversation.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "direct_pair_key", type: "varchar", length: 73, nullable: true }),
    __metadata("design:type", Object)
], ChatConversation.prototype, "directPairKey", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ChatConversationType,
        enumName: "chat_conversations_type_enum",
    }),
    __metadata("design:type", String)
], ChatConversation.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150, nullable: true }),
    __metadata("design:type", Object)
], ChatConversation.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ChatConversation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ChatConversation.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_message_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], ChatConversation.prototype, "lastMessageAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => chat_conversation_member_entity_1.ChatConversationMember, (member) => member.conversation),
    __metadata("design:type", Array)
], ChatConversation.prototype, "members", void 0);
exports.ChatConversation = ChatConversation = __decorate([
    (0, typeorm_1.Entity)("chat_conversations"),
    (0, typeorm_1.Index)("IDX_chat_conversations_organization_id", ["organizationId"])
], ChatConversation);
