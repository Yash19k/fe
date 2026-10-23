"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveOrganizationSlug1792060000000 = void 0;
class RemoveOrganizationSlug1792060000000 {
    constructor() {
        this.name = "RemoveOrganizationSlug1792060000000";
    }
    async up(queryRunner) {
        const hasSlug = await queryRunner.hasColumn("organizations", "slug");
        if (!hasSlug) {
            return;
        }
        await queryRunner.dropColumn("organizations", "slug");
    }
    async down(queryRunner) {
        const hasSlug = await queryRunner.hasColumn("organizations", "slug");
        if (hasSlug) {
            return;
        }
        await queryRunner.query(`ALTER TABLE "organizations" ADD "slug" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug")`);
    }
}
exports.RemoveOrganizationSlug1792060000000 = RemoveOrganizationSlug1792060000000;
