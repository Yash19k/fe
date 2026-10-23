"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixInvitationUserFields1792059000000 = void 0;
class FixInvitationUserFields1792059000000 {
    constructor() {
        this.name = "FixInvitationUserFields1792059000000";
    }
    async up(queryRunner) {
        const hasCamelTokenHash = await queryRunner.hasColumn("users", "inviteTokenHash");
        const hasSnakeTokenHash = await queryRunner.hasColumn("users", "invite_token_hash");
        const hasCamelExpiresAt = await queryRunner.hasColumn("users", "inviteExpiresAt");
        const hasSnakeExpiresAt = await queryRunner.hasColumn("users", "invite_expires_at");
        if (hasCamelTokenHash && !hasSnakeTokenHash) {
            await queryRunner.renameColumn("users", "inviteTokenHash", "invite_token_hash");
        }
        if (hasCamelExpiresAt && !hasSnakeExpiresAt) {
            await queryRunner.renameColumn("users", "inviteExpiresAt", "invite_expires_at");
        }
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`UPDATE "users" SET "full_name" = "email" WHERE "full_name" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL`);
        const hasSnakeTokenHash = await queryRunner.hasColumn("users", "invite_token_hash");
        const hasCamelTokenHash = await queryRunner.hasColumn("users", "inviteTokenHash");
        const hasSnakeExpiresAt = await queryRunner.hasColumn("users", "invite_expires_at");
        const hasCamelExpiresAt = await queryRunner.hasColumn("users", "inviteExpiresAt");
        if (hasSnakeTokenHash && !hasCamelTokenHash) {
            await queryRunner.renameColumn("users", "invite_token_hash", "inviteTokenHash");
        }
        if (hasSnakeExpiresAt && !hasCamelExpiresAt) {
            await queryRunner.renameColumn("users", "invite_expires_at", "inviteExpiresAt");
        }
    }
}
exports.FixInvitationUserFields1792059000000 = FixInvitationUserFields1792059000000;
