import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
} from "typeorm";

import { Project } from "./project.entity";
import { User } from "./user.entity";
import { WorkItemAssignee } from "./work.item-assignee.entity";
import { Sprint } from "./sprint.entities";
import { WorkItemAttachment } from "./work.item.attachment.entity";
import { ProjectLabel } from "./project.label.entity";


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

export enum SlaStatus {
  ON_TRACK = "ON_TRACK",
  AT_RISK = "AT_RISK",
  BREACHED = "BREACHED",
  ESCALATED = "ESCALATED",
  RESOLVED = "RESOLVED",
}

@Entity({ name: "work_items" })
@Index("IDX_work_items_organization_id", ["organizationId"])
@Index("IDX_work_items_project_id", ["projectId"])
@Index("IDX_work_items_created_by_id", ["createdById"])
@Index("IDX_work_items_parent_id", ["parentWorkItemId"])
@Index("IDX_work_items_project_status", ["projectId", "status"])
@Index("IDX_work_items_project_type", ["projectId", "type"])
@Index("IDX_work_items_sla_deadline_status", ["slaDeadline", "slaStatus"])
@Check(
  "CHK_work_items_planned_duration_positive",
  `"planned_duration_working_days" IS NULL OR "planned_duration_working_days" > 0`,
)
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

  @Column({ name: "business_goal", type: "text", nullable: true })
  businessGoal: string | null;

  @Column({ name: "success_criteria", type: "text", nullable: true })
  successCriteria: string | null;

  @Column({ name: "acceptance_criteria", type: "text", nullable: true })
  acceptanceCriteria: string | null;

  @Column({ name: "bug_severity", type: "varchar", length: 20, nullable: true })
  severity: string | null;

  @Column({ name: "steps_to_reproduce", type: "text", nullable: true })
  stepsToReproduce: string | null;

  @Column({ name: "expected_behavior", type: "text", nullable: true })
  expectedBehavior: string | null;

  @Column({ name: "actual_behavior", type: "text", nullable: true })
  actualBehavior: string | null;

  @Column({ name: "environment", type: "text", nullable: true })
  environment: string | null;

  @Column({
    name: "estimated_hours",
    type: "numeric",
    precision: 8,
    scale: 2,
    nullable: true,
  })
  estimatedHours: string | null;

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
  nullable: true,
})
priority: WorkItemPriority | null;

  @Column({
    name: "due_date",
    type: "timestamptz",
    nullable: true,
  })
  dueDate: Date | null;

  @Column({ name: "planned_start_date", type: "date", nullable: true })
  plannedStartDate: string | null;

  @Column({
    name: "planned_duration_working_days",
    type: "integer",
    nullable: true,
  })
  plannedDurationWorkingDays: number | null;

  @Column({ name: "is_schedule_pinned", type: "boolean", default: false })
  isSchedulePinned: boolean;

  @Column({
    name: "sla_deadline",
    type: "timestamptz",
    nullable: true,
  })
  slaDeadline: Date | null;

  @Column({
    name: "sla_status",
    type: "enum",
    enum: SlaStatus,
    enumName: "work_items_sla_status_enum",
    nullable: true,
  })
  slaStatus: SlaStatus | null;

  @Column({ name: "sla_deadline_is_custom", type: "boolean", default: false })
  slaDeadlineIsCustom: boolean;

  @Column({ name: "escalated_at", type: "timestamptz", nullable: true })
  escalatedAt: Date | null;

  @Column({ name: "escalated_by_id", type: "uuid", nullable: true })
  escalatedById: string | null;

  @Column({ name: "escalation_reason", type: "text", nullable: true })
  escalationReason: string | null;

  @Column({ name: "sla_breached_at", type: "timestamptz", nullable: true })
  slaBreachedAt: Date | null;

  @Column({ name: "sla_resolved_at", type: "timestamptz", nullable: true })
  slaResolvedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @VersionColumn({ type: "integer", default: 1 })
  version: number;

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

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "escalated_by_id" })
  escalatedBy: User | null;


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

  @Column({
    name: "label_id",
    type: "uuid",
    nullable: true,
  })
  labelId: string | null;

  @ManyToOne(() => ProjectLabel, (projectLabel) => projectLabel.workItems, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "label_id" })
  label: ProjectLabel | null;

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