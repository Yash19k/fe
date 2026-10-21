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
} from "typeorm";

import { Project } from "./project.entity";
import { User } from "./user.entity";
import { WorkItemAssignee } from "./work.item-assignee.entity";
import { Sprint } from "./sprint.entities";
import { WorkItemAttachment } from "./work.item.attachment.entity";


export enum WorkItemType {
  EPIC = "EPIC",
  STORY = "STORY",
  TASK = "TASK",
  SUBTASK = "SUBTASK",
  BUG = "BUG",
}

export enum WorkItemStatus {
  BACKLOG = "BACKLOG",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  TESTING_QA = "TESTING_QA",
  BLOCKED = "BLOCKED",
  ON_HOLD = "ON_HOLD",
  DONE = "DONE",
}


export enum WorkItemPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

@Entity({ name: "work_items" })
@Index("IDX_work_items_organization_id", ["organizationId"])
@Index("IDX_work_items_project_id", ["projectId"])
@Index("IDX_work_items_created_by_id", ["createdById"])
@Index("IDX_work_items_parent_id", ["parentWorkItemId"])
@Index("IDX_work_items_project_status", ["projectId", "status"])
@Index("IDX_work_items_project_type", ["projectId", "type"])
export class WorkItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({ name: "project_id", type: "uuid" })
  projectId: string;

  @Column({ name: "created_by_id", type: "uuid" })
  createdById: string;

  @Column({
    name: "parent_work_item_id",
    type: "uuid",
    nullable: true,
  })
  parentWorkItemId: string | null;

  @Column({
    type: "enum",
    enum: WorkItemType,
    enumName: "work_items_type_enum",
  })
  type: WorkItemType;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

 @Column({
  type: "enum",
  enum: WorkItemStatus,
  enumName: "work_items_status_enum",
  default: WorkItemStatus.BACKLOG,
})
status: WorkItemStatus;

  @Column({
    type: "enum",
    enum: WorkItemPriority,
    enumName: "work_items_priority_enum",
    default: WorkItemPriority.MEDIUM,
  })
  priority: WorkItemPriority;

  @Column({
    name: "due_date",
    type: "timestamptz",
    nullable: true,
  })
  dueDate: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @ManyToOne(() => Project, (project) => project.workItems, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @ManyToOne(() => User, (user) => user.createdWorkItems, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "created_by_id" })
  createdBy: User;


  @ManyToOne(() => WorkItem, (workItem) => workItem.children, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "parent_work_item_id" })
  parentWorkItem: WorkItem | null;

  @OneToMany(() => WorkItem, (workItem) => workItem.parentWorkItem)
  children: WorkItem[];

  @OneToMany(
    () => WorkItemAssignee,
    (assignment) => assignment.workItem,
  )
  assignments: WorkItemAssignee[];
  @Column({
  name: "sprint_id",
  type: "uuid",
  nullable: true,
})
sprintId: string | null;

@ManyToOne(
  () => Sprint,
  (sprint) => sprint.workItems,
  {
    nullable: true,
    onDelete: "SET NULL",
  },
)
@JoinColumn({ name: "sprint_id" })
sprint: Sprint | null;

  @OneToMany(
    () => WorkItemAttachment,
    (attachment) => attachment.workItem,
  )
  attachments: WorkItemAttachment[];

  @OneToMany("WorkItemComment", "workItem")
  comments: any[];

  @OneToMany("WorkItemTimeEntry", "workItem")
  timeEntries: any[];

  @OneToMany("WorkItemDependency", "workItem")
  dependencies: any[];
}