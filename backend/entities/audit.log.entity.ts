import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Organization } from "./organization.entity";
import { Project } from "./project.entity";
import { User } from "./user.entity";

@Entity({ name: "audit_logs" })
@Index("IDX_audit_logs_project", ["projectId", "createdAt"])
@Index("IDX_audit_logs_org", ["organizationId", "createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({ name: "project_id", type: "uuid", nullable: true })
  projectId: string | null;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "varchar", length: 50 })
  action: string;

  @Column({ name: "entity_type", type: "varchar", length: 50 })
  entityType: string;

  @Column({ name: "entity_id", type: "varchar", length: 100 })
  entityId: string;

  @Column({ type: "text" })
  description: string;

  @Column({ name: "previous_state", type: "jsonb", nullable: true })
  previousState: any;

  @Column({ name: "new_state", type: "jsonb", nullable: true })
  newState: any;

  @Column({ name: "is_undone", type: "boolean", default: false })
  isUndone: boolean;

  @Column({ name: "undone_at", type: "timestamptz", nullable: true })
  undoneAt: Date | null;

  @Column({ name: "undone_by_id", type: "uuid", nullable: true })
  undoneById: string | null;

  @Column({ name: "reversal_log_id", type: "uuid", nullable: true })
  reversalLogId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization: Organization;

  @ManyToOne(() => Project, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "project_id" })
  project: Project | null;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
