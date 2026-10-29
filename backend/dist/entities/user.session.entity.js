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
exports.UserSession = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let UserSession = class UserSession {
};
exports.UserSession = UserSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], UserSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "uuid" }),
    __metadata("design:type", String)
], UserSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.sessions, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_entity_1.User)
], UserSession.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "token_hash",
        type: "varchar",
        length: 64,
        unique: true,
    }),
    __metadata("design:type", String)
], UserSession.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "expires_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserSession.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "revoked_at",
        type: "timestamptz",
        nullable: true,
    }),
    __metadata("design:type", Object)
], UserSession.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "last_used_at",
        type: "timestamptz",
        nullable: true,
    }),
    __metadata("design:type", Object)
], UserSession.prototype, "lastUsedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: "created_at",
        type: "timestamptz",
    }),
    __metadata("design:type", Date)
], UserSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: "updated_at",
        type: "timestamptz",
    }),
    __metadata("design:type", Date)
], UserSession.prototype, "updatedAt", void 0);
exports.UserSession = UserSession = __decorate([
    (0, typeorm_1.Entity)("user_sessions"),
    (0, typeorm_1.Index)("IDX_user_sessions_user_id", ["userId"]),
    (0, typeorm_1.Index)("IDX_user_sessions_expires_at", ["expiresAt"])
], UserSession);
