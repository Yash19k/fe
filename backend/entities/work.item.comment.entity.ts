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

@Entity({ name: "work_item_comments" })
@Index("IDX_work_item_comments_work_item", ["workItemId"])
export class WorkItemComment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "work_item_id", type: "uuid" })
  workItemId: string;

  @Column({ name: "author_id", type: "uuid" })
  authorId: string;

  @Column({ type: "text" })
  body: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => WorkItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "work_item_id" })
  workItem: WorkItem;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "author_id" })
  author: User;
}
