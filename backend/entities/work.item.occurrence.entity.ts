
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from "typeorm";

import { WorkItem, WorkItemPriority } from "./work.item.entity";
import { WorkItemRecurrence } from "./work.item.recurrence.entity";


@Entity("work_item_occurrences")
@Unique("UQ_occurrence_recurrence_date", ["recurrenceId", "scheduledFor"])
@Index("IDX_occurrence_recurrence", ["recurrenceId"])
export class WorkItemOccurrence {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "recurrence_id", type: "uuid" })
  recurrenceId: string;

  @ManyToOne(() => WorkItemRecurrence, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "recurrence_id" })
  recurrence: WorkItemRecurrence;

  // The intended calendar date for this occurrence.
  @Column({ name: "scheduled_for", type: "date" })
  scheduledFor: string;

  // The actual task generated for this occurrence.
  // Each generated work item can belong to at most one occurrence.
  @Column({ name: "work_item_id", type: "uuid", unique: true })
  workItemId: string;

  @OneToOne(() => WorkItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "work_item_id" })
  workItem: WorkItem;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
