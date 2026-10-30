"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
exports.assertRequiredEntityMetadata = assertRequiredEntityMetadata;
require("reflect-metadata");
const fs_1 = require("fs");
const path_1 = require("path");
const typeorm_1 = require("typeorm");
const config_1 = require("./config");
const audit_log_entity_1 = require("../entities/audit.log.entity");
const chat_conversation_member_entity_1 = require("../entities/chat-conversation-member.entity");
const chat_conversation_entity_1 = require("../entities/chat-conversation.entity");
const chat_message_entity_1 = require("../entities/chat-message.entity");
const member_invitation_entity_1 = require("../entities/member-invitation.entity");
const notification_entity_1 = require("../entities/notification.entity");
const organization_entity_1 = require("../entities/organization.entity");
const organization_sla_entity_1 = require("../entities/organization.sla.entity");
const password_reset_token_entity_1 = require("../entities/password-reset-token.entity");
const project_entity_1 = require("../entities/project.entity");
const project_label_entity_1 = require("../entities/project.label.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const project_workflow_entity_1 = require("../entities/project.workflow.entity");
const sprint_entities_1 = require("../entities/sprint.entities");
const user_entity_1 = require("../entities/user.entity");
const user_session_entity_1 = require("../entities/user.session.entity");
const whiteboard_entity_1 = require("../entities/whiteboard.entity");
const whiteboard_revision_entity_1 = require("../entities/whiteboard.revision.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const work_item_attachment_entity_1 = require("../entities/work.item.attachment.entity");
const work_item_comment_entity_1 = require("../entities/work.item.comment.entity");
const work_item_dependency_entity_1 = require("../entities/work.item.dependency.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_occurrence_entity_1 = require("../entities/work.item.occurrence.entity");
const work_item_recurrence_entity_1 = require("../entities/work.item.recurrence.entity");
const work_item_time_entry_entity_1 = require("../entities/work.item.time.entry.entity");
const registeredEntities = [
    audit_log_entity_1.AuditLog,
    chat_conversation_member_entity_1.ChatConversationMember,
    chat_conversation_entity_1.ChatConversation,
    chat_message_entity_1.ChatMessage,
    member_invitation_entity_1.MemberInvitation,
    notification_entity_1.Notification,
    organization_entity_1.Organization,
    organization_sla_entity_1.OrganizationSla,
    password_reset_token_entity_1.PasswordResetToken,
    project_entity_1.Project,
    project_label_entity_1.ProjectLabel,
    project_member_entity_1.ProjectMember,
    project_workflow_entity_1.ProjectWorkflow,
    sprint_entities_1.Sprint,
    user_entity_1.User,
    user_session_entity_1.UserSession,
    whiteboard_entity_1.Whiteboard,
    whiteboard_revision_entity_1.WhiteboardRevision,
    work_item_assignee_entity_1.WorkItemAssignee,
    work_item_attachment_entity_1.WorkItemAttachment,
    work_item_comment_entity_1.WorkItemComment,
    work_item_dependency_entity_1.WorkItemDependency,
    work_item_entity_1.WorkItem,
    work_item_occurrence_entity_1.WorkItemOccurrence,
    work_item_recurrence_entity_1.WorkItemRecurrence,
    work_item_time_entry_entity_1.WorkItemTimeEntry,
];
const migrationsDir = (0, path_1.join)(__dirname, "../migrations");
const migrationFiles = (0, fs_1.existsSync)(migrationsDir)
    ? (0, fs_1.readdirSync)(migrationsDir)
        .filter((file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts"))
        .sort()
    : [];
const loadedMigrations = [];
for (const file of migrationFiles) {
    const migrationModule = require((0, path_1.join)(migrationsDir, file));
    for (const exportedItem of Object.values(migrationModule)) {
        if (typeof exportedItem === "function") {
            loadedMigrations.push(exportedItem);
        }
    }
}
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: config_1.config.database.host,
    port: config_1.config.database.port,
    username: config_1.config.database.username,
    password: (config_1.config.database.password),
    database: config_1.config.database.name,
    entities: registeredEntities,
    migrations: loadedMigrations.length > 0
        ? loadedMigrations
        : [
            (0, path_1.join)(__dirname, "../migrations/**/*{.ts,.js}").replace(/\\/g, "/"),
        ],
    synchronize: config_1.config.database.synchronize,
    logging: config_1.config.database.logging,
});
function assertRequiredEntityMetadata() {
    const requiredEntities = [user_entity_1.User, work_item_entity_1.WorkItem, work_item_recurrence_entity_1.WorkItemRecurrence, member_invitation_entity_1.MemberInvitation];
    const missingEntities = requiredEntities.filter((entity) => !exports.AppDataSource.hasMetadata(entity));
    if (missingEntities.length > 0) {
        throw new Error(`Missing TypeORM metadata: ${missingEntities.map((entity) => entity.name).join(", ")}`);
    }
}
