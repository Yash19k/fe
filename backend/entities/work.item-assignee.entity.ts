import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

import { User } from "./user.entity";
import { WorkItem } from "./work.item.entity";

@Entity({ name: "work_item_assignees" })
@Index("IDX_work_item_assignees_user_id", ["userId"])
export class WorkItemAssignee {
  @PrimaryColumn({ name: "work_item_id", type: "uuid" })
  workItemId: string;

  @PrimaryColumn({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({
    name: "assigned_by_id",
    type: "uuid",
    nullable: true,
  })
  assignedById: string | null;

  @CreateDateColumn({
    name: "assigned_at",
    type: "timestamptz",
  })
  assignedAt: Date;

  @ManyToOne(
    () => WorkItem,
    (workItem) => workItem.assignments,
    {
      nullable: false,
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "work_item_id" })
  workItem: WorkItem;

  @ManyToOne(
    () => User,
    (user) => user.workItemAssignments,
    {
      nullable: false,
      onDelete: "RESTRICT",
    },
  )
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "assigned_by_id" })
  assignedBy: User | null;
  @Column({
  name: "start_date",
  type: "date",
  nullable: true,
})
startDate!: string | null;

@Column({
  name: "estimated_hours",
  type: "numeric",
  precision: 8,
  scale: 2,
  nullable: true,
})
estimatedHours!: string | null;
}