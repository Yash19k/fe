
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
  Check,
} from "typeorm";

import { Project } from "./project.entity";
import { User } from "./user.entity";
import { WorkItem } from "./work.item.entity";

export enum SprintStatus {
  PLANNED = "PLANNED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

@Entity({ name: "sprints" })
@Index("IDX_sprints_project_id", ["projectId"])
@Index("IDX_sprints_created_by_id", ["createdById"])
@Index("IDX_sprints_project_status", ["projectId", "status"])
@Check(
  "CHK_sprints_valid_dates",
  '"end_date" >= "start_date"',
)
export class Sprint {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id", type: "uuid" })
  projectId: string;

  @Column({ name: "created_by_id", type: "uuid" })
  createdById: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "text", nullable: true })
  goal: string | null;

  @Column({ name: "start_date", type: "date" })
  startDate: string;

  @Column({ name: "end_date", type: "date" })
  endDate: string;

  @Column({
    type: "enum",
    enum: SprintStatus,
    enumName: "sprints_status_enum",
    default: SprintStatus.PLANNED,
  })
  status: SprintStatus;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamptz",
  })
  updatedAt: Date;

  // A sprint belongs to one project.
  @ManyToOne(
    () => Project,
    (project) => project.sprints,
    {
      nullable: false,
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "project_id" })
  project: Project;

  // Records the user who created the sprint.
  @ManyToOne(
    () => User,
    (user) => user.createdSprints,
    {
      nullable: false,
      onDelete: "RESTRICT",
    },
  )
  @JoinColumn({ name: "created_by_id" })
  createdBy: User;

  // A sprint contains zero or more work items.
  @OneToMany(
    () => WorkItem,
    (workItem) => workItem.sprint,
  )
  workItems: WorkItem[];
}
