import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
  Unique,
  Check,
} from "typeorm";
import { Organization } from "./organization.entity";
import { User } from "./user.entity";
import { WorkItem } from "./work.item.entity";
import { ProjectMember } from "./project.member.entity";
import { Sprint } from "./sprint.entities";
import { ProjectLabel } from "./project.label.entity";

export enum ProjectVisibility {
  PRIVATE = "PRIVATE",
  PUBLIC = "PUBLIC",
}

@Entity({ name: "projects" })
@Unique("UQ_projects_organization_key", ["organizationId", "key"])
@Index("IDX_projects_organization_id", ["organizationId"])
@Index("IDX_projects_created_by_id", ["createdById"])
@Check(
  "CHK_projects_date_order",
  `"start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"`,
)
export class Project {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @Column({ type: "varchar", length: 150 })
  name!: string;

  @Column({ type: "varchar", length: 20 })
  key!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "start_date", type: "date", nullable: true })
  startDate!: string | null;

  @Column({ name: "end_date", type: "date", nullable: true })
  endDate!: string | null;

  @Column({ name: "created_by_id", type: "uuid" })
  createdById!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({
    type: "enum",
    enum: ProjectVisibility,
    enumName: "projects_visibility_enum",
    default: ProjectVisibility.PRIVATE,
  })
  visibility!: ProjectVisibility;

  @ManyToOne(() => Organization, (organization) => organization.projects, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;

  @ManyToOne(() => User, (user) => user.createdProjects, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;

  @OneToMany(() => WorkItem, (workItem) => workItem.project)
  workItems!: WorkItem[];

  @OneToMany(() => ProjectMember, (membership) => membership.project)
  memberships!: ProjectMember[];

  @OneToMany(() => Sprint, (sprint) => sprint.project)
  sprints!: Sprint[];

  @OneToMany(() => ProjectLabel, (label) => label.project)
  labels!: ProjectLabel[];

  @OneToOne("ProjectWorkflow", "project")
  workflow: any;
}
