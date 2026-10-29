import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  BaseEntity,
} from "typeorm";

import { Organization } from "./organization.entity";
import { Project } from "./project.entity";
import { WorkItem } from "./work.item.entity";
import { WorkItemAssignee } from "./work.item-assignee.entity";
import { ProjectMember } from "./project.member.entity";
import { UserSession } from "./user.session.entity";
import { Sprint } from "./sprint.entities";
import { PasswordResetToken } from "./password-reset-token.entity";

export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  TEAMMATE = "TEAMMATE",
}

export enum UserStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}

@Entity({ name: "users" })
@Index("IDX_users_organization_id", ["organizationId"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organization_id", type: "uuid", nullable: true })
  organizationId: string | null;

  @Column({ name: "full_name", type: "varchar", length: 100, nullable: true })
  fullName: string | null;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;
  @Column({
    name: "invite_token_hash",
    type: "varchar",
    nullable: true,
  })
  inviteTokenHash: string | null;
  @Column({
    name: "invite_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  inviteExpiresAt: Date | null;

  @Column({
    type: "enum",
    enum: UserRole,
    enumName: "users_role_enum",
    default: UserRole.ADMIN,
  })
  role: UserRole;

  @Column({
    type: "enum",
    enum: UserStatus,
    enumName: "users_status_enum",
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @ManyToOne(() => Organization, (organization) => organization.users, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "organization_id" })
  organization: Organization;

  @OneToMany(() => Project, (project) => project.createdBy)
  createdProjects: Project[];

  @OneToMany(() => WorkItem, (workItem) => workItem.createdBy)
  createdWorkItems: WorkItem[];

  @OneToMany(() => WorkItemAssignee, (assignment) => assignment.user)
  workItemAssignments: WorkItemAssignee[];
  @OneToMany(() => ProjectMember, (membership) => membership.user)
  projectMemberships!: ProjectMember[];
  @OneToMany(() => UserSession, (session) => session.user)
  sessions!: UserSession[];
  @OneToMany(() => Sprint, (sprint) => sprint.createdBy)
  createdSprints: Sprint[];

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens!: PasswordResetToken[];
}
