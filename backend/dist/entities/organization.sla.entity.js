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
exports.OrganizationSla = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("./organization.entity");
let OrganizationSla = class OrganizationSla {
};
exports.OrganizationSla = OrganizationSla;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], OrganizationSla.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "organization_id", type: "uuid", unique: true }),
    __metadata("design:type", String)
], OrganizationSla.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "urgent_hours", type: "int", default: 4 }),
    __metadata("design:type", Number)
], OrganizationSla.prototype, "urgentHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "high_hours", type: "int", default: 8 }),
    __metadata("design:type", Number)
], OrganizationSla.prototype, "highHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "medium_hours", type: "int", default: 24 }),
    __metadata("design:type", Number)
], OrganizationSla.prototype, "mediumHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "low_hours", type: "int", default: 72 }),
    __metadata("design:type", Number)
], OrganizationSla.prototype, "lowHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "escalate_hours", type: "int", default: 8 }),
    __metadata("design:type", Number)
], OrganizationSla.prototype, "escalateHours", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], OrganizationSla.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], OrganizationSla.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => organization_entity_1.Organization, (organization) => organization.slaPolicy, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "organization_id" }),
    __metadata("design:type", organization_entity_1.Organization)
], OrganizationSla.prototype, "organization", void 0);
exports.OrganizationSla = OrganizationSla = __decorate([
    (0, typeorm_1.Entity)({ name: "organization_sla" }),
    (0, typeorm_1.Index)("IDX_organization_sla_org", ["organizationId"], { unique: true })
], OrganizationSla);
