"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetainRecentWhiteboardRevisions1793110000000 = void 0;
class RetainRecentWhiteboardRevisions1793110000000 {
    constructor() {
        this.name = "RetainRecentWhiteboardRevisions1793110000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DELETE FROM "whiteboard_revisions" revision
      WHERE revision."revision_number" <= (
        SELECT MAX(older."revision_number") - 99
        FROM "whiteboard_revisions" older
        WHERE older."whiteboard_id" = revision."whiteboard_id"
      )
    `);
    }
    async down() {
        // Revision snapshots removed by the retention policy cannot be restored.
    }
}
exports.RetainRecentWhiteboardRevisions1793110000000 = RetainRecentWhiteboardRevisions1793110000000;
