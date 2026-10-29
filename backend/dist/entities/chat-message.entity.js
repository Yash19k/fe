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
exports.ChatMessage = void 0;
const typeorm_1 = require("typeorm");
const chat_conversation_entity_1 = require("./chat-conversation.entity");
const user_entity_1 = require("./user.entity");
let ChatMessage = class ChatMessage {
};
exports.ChatMessage = ChatMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ChatMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "conversation_id", type: "uuid" }),
    __metadata("design:type", String)
], ChatMessage.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "sender_id", type: "uuid" }),
    __metadata("design:type", String)
], ChatMessage.prototype, "senderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 4000 }),
    __metadata("design:type", String)
], ChatMessage.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ChatMessage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ChatMessage.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "edited_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], ChatMessage.prototype, "editedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "deleted_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], ChatMessage.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => chat_conversation_entity_1.ChatConversation, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "conversation_id" }),
    __metadata("design:type", chat_conversation_entity_1.ChatConversation)
], ChatMessage.prototype, "conversation", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "sender_id" }),
    __metadata("design:type", user_entity_1.User)
], ChatMessage.prototype, "sender", void 0);
exports.ChatMessage = ChatMessage = __decorate([
    (0, typeorm_1.Entity)("chat_messages"),
    (0, typeorm_1.Index)("IDX_chat_messages_conversation_created", ["conversationId", "createdAt"])
], ChatMessage);
