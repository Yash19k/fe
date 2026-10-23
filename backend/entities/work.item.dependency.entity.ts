import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { WorkItem } from "./work.item.entity";

@Entity({ name: "work_item_dependencies" })
@Unique("UQ_work_item_dependencies", ["workItemId", "dependsOnWorkItemId"])
export class WorkItemDependency {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "work_item_id", type: "uuid" })
  workItemId: string;

  @Column({ name: "depends_on_work_item_id", type: "uuid" })
  dependsOnWorkItemId: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => WorkItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "work_item_id" })
  workItem: WorkItem;

  @ManyToOne(() => WorkItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "depends_on_work_item_id" })
  dependsOnWorkItem: WorkItem;
}
