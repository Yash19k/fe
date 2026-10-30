
import "reflect-metadata";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { DataSource } from "typeorm";
import { config } from "./config";
import { AuditLog } from "../entities/audit.log.entity";
import { ChatConversationMember } from "../entities/chat-conversation-member.entity";
import { ChatConversation } from "../entities/chat-conversation.entity";
import { ChatMessage } from "../entities/chat-message.entity";
import { MemberInvitation } from "../entities/member-invitation.entity";
import { Notification } from "../entities/notification.entity";
import { Organization } from "../entities/organization.entity";
import { OrganizationSla } from "../entities/organization.sla.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { Project } from "../entities/project.entity";
import { ProjectLabel } from "../entities/project.label.entity";
import { ProjectMember } from "../entities/project.member.entity";
import { ProjectWorkflow } from "../entities/project.workflow.entity";
import { Sprint } from "../entities/sprint.entities";
import { User } from "../entities/user.entity";
import { UserSession } from "../entities/user.session.entity";
import { Whiteboard } from "../entities/whiteboard.entity";
import { WhiteboardRevision } from "../entities/whiteboard.revision.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { WorkItemAttachment } from "../entities/work.item.attachment.entity";
import { WorkItemComment } from "../entities/work.item.comment.entity";
import { WorkItemDependency } from "../entities/work.item.dependency.entity";
import { WorkItem } from "../entities/work.item.entity";
import { WorkItemOccurrence } from "../entities/work.item.occurrence.entity";
import { WorkItemRecurrence } from "../entities/work.item.recurrence.entity";
import { WorkItemTimeEntry } from "../entities/work.item.time.entry.entity";

const registeredEntities = [
  AuditLog,
  ChatConversationMember,
  ChatConversation,
  ChatMessage,
  MemberInvitation,
  Notification,
  Organization,
  OrganizationSla,
  PasswordResetToken,
  Project,
  ProjectLabel,
  ProjectMember,
  ProjectWorkflow,
  Sprint,
  User,
  UserSession,
  Whiteboard,
  WhiteboardRevision,
  WorkItemAssignee,
  WorkItemAttachment,
  WorkItemComment,
  WorkItemDependency,
  WorkItem,
  WorkItemOccurrence,
  WorkItemRecurrence,
  WorkItemTimeEntry,
];

const migrationsDir = join(__dirname, "../migrations");
const migrationFiles = existsSync(migrationsDir)
  ? readdirSync(migrationsDir)
      .filter((file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts"))
      .sort()
  : [];

const loadedMigrations: any[] = [];
for (const file of migrationFiles) {
  const migrationModule = require(join(migrationsDir, file));
  for (const exportedItem of Object.values(migrationModule)) {
    if (typeof exportedItem === "function") {
      loadedMigrations.push(exportedItem);
    }
  }
}

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: (config.database.password),
  database: config.database.name,

  entities: registeredEntities,

  migrations: loadedMigrations.length > 0
    ? loadedMigrations
    : [
        join(__dirname, "../migrations/**/*{.ts,.js}").replace(/\\/g, "/"),
      ],

  synchronize: config.database.synchronize,
  logging: config.database.logging,
});

export function assertRequiredEntityMetadata(): void {
  const requiredEntities = [User, WorkItem, WorkItemRecurrence, MemberInvitation];
  const missingEntities = requiredEntities.filter(
    (entity) => !AppDataSource.hasMetadata(entity),
  );

  if (missingEntities.length > 0) {
    throw new Error(
      `Missing TypeORM metadata: ${missingEntities.map((entity) => entity.name).join(", ")}`,
    );
  }
}
