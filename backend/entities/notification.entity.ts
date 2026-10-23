
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Organization } from "./organization.entity";

export enum NotificationType {
  TASK_ASSIGNED = "TASK_ASSIGNED",
  TASK_UPDATED = "TASK_UPDATED",
  TASK_COMPLETED = "TASK_COMPLETED",
  TASK_OVERDUE = "TASK_OVERDUE",
  TASK_MENTIONED = "TASK_MENTIONED",
  SLA_ESCALATED = "SLA_ESCALATED",
  RECURRING_TASK_CREATED = "RECURRING_TASK_CREATED",
  RECURRING_TASK_FAILED = "RECURRING_TASK_FAILED",
  PROJECT_MEMBER_ADDED = "PROJECT_MEMBER_ADDED",
}

@Entity({ name: "notifications" })
@Index("IDX_notifications_user", ["userId", "read", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({
    type: "enum",
    enum: NotificationType,
    enumName: "notifications_type_enum",
  })
  type: NotificationType;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "boolean", default: false })
  read: boolean;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt: Date | null;

  @Column({ name: "work_item_id", type: "uuid", nullable: true })
  workItemId: string | null;

  @Column({ name: "project_id", type: "uuid", nullable: true })
  projectId: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  link: string | null;

  @Column({
    name: "deduplication_key",
    type: "varchar",
    length: 255,
    nullable: true,
    unique: true,
  })
  deduplicationKey: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization: Organization;
}
