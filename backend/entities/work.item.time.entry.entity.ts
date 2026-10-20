import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { WorkItem } from "./work.item.entity";
import { User } from "./user.entity";

@Entity({ name: "work_item_time_entries" })
@Index("IDX_work_item_time_entries_work_item", ["workItemId"])
export class WorkItemTimeEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "work_item_id", type: "uuid" })
  workItemId: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ name: "duration_minutes", type: "integer" })
  durationMinutes: number;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "start_time", type: "timestamptz", default: () => "now()" })
  startTime: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => WorkItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "work_item_id" })
  workItem: WorkItem;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
