"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddCloudinaryMetadataToWorkItemAttachments1793010000000 = void 0;
class AddCloudinaryMetadataToWorkItemAttachments1793010000000 {
    constructor() {
        this.name = "AddCloudinaryMetadataToWorkItemAttachments1793010000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "work_item_attachments"
      ADD COLUMN "public_id" character varying(255),
      ADD COLUMN "resource_type" character varying(20)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "work_item_attachments"
      DROP COLUMN "resource_type",
      DROP COLUMN "public_id"
    `);
    }
}
exports.AddCloudinaryMetadataToWorkItemAttachments1793010000000 = AddCloudinaryMetadataToWorkItemAttachments1793010000000;
