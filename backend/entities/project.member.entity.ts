import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Project } from "./project.entity";
import { User } from "./user.entity";

export enum ProjectRole {
  ADMIN = "ADMIN",
  LEAD = "LEAD",
  MEMBER = "MEMBER",
}

@Entity("project_members")
@Index("IDX_project_members_user_id", ["userId"])
export class ProjectMember {
  @PrimaryColumn("uuid", { name: "project_id" })
  projectId!: string;

  @PrimaryColumn("uuid", { name: "user_id" })
  userId!: string;

  @Column("uuid", {
    name: "added_by_id",
    nullable: true,
  })
  addedById!: string | null;

  @Column({
    type: "enum",
    enum: ProjectRole,
    enumName: "project_members_role_enum",
    default: ProjectRole.MEMBER,
  })
  role!: ProjectRole;

  @CreateDateColumn({ name: "joined_at", type: "timestamptz" })
  joinedAt!: Date;

  @ManyToOne(() => Project, (project) => project.memberships, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @ManyToOne(() => User, (user) => user.projectMemberships, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "added_by_id" })
  addedBy!: User | null;
}
