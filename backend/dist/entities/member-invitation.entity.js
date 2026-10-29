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
exports.MemberInvitation = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("./organization.entity");
const user_entity_1 = require("./user.entity");
let MemberInvitation = class MemberInvitation {
};
exports.MemberInvitation = MemberInvitation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], MemberInvitation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "uuid" }),
    __metadata("design:type", String)
], MemberInvitation.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid" }),
    __metadata("design:type", String)
], MemberInvitation.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], MemberInvitation.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: user_entity_1.UserRole,
        enumName: "users_role_enum",
    }),
    __metadata("design:type", String)
], MemberInvitation.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "token_hash", type: "varchar", length: 64 }),
    __metadata("design:type", String)
], MemberInvitation.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "expires_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], MemberInvitation.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], MemberInvitation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "consumed_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], MemberInvitation.prototype, "consumedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "revoked_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], MemberInvitation.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_entity_1.User)
], MemberInvitation.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "organization_id" }),
    __metadata("design:type", organization_entity_1.Organization)
], MemberInvitation.prototype, "organization", void 0);
exports.MemberInvitation = MemberInvitation = __decorate([
    (0, typeorm_1.Entity)({ name: "member_invitations" }),
    (0, typeorm_1.Index)("UQ_member_invitations_token_hash", ["tokenHash"], { unique: true }),
    (0, typeorm_1.Index)("IDX_member_invitations_user_id", ["userId"]),
    (0, typeorm_1.Index)("UQ_member_invitations_one_outstanding_per_user", ["userId"], {
        unique: true,
        where: '"consumed_at" IS NULL AND "revoked_at" IS NULL',
    }),
    (0, typeorm_1.Check)("CHK_member_invitations_consumed_or_revoked", '"consumed_at" IS NULL OR "revoked_at" IS NULL')
], MemberInvitation);
