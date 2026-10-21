import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from "typeorm";

import { WorkItem } from "./work.item.entity";
import { User } from "./user.entity";

export enum AttachmentType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT",
  OTHER = "OTHER",
}

@Entity("work_item_attachments")
@Index(["workItemId", "createdAt"])
export class WorkItemAttachment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "work_item_id" })
  workItemId: string;

  @ManyToOne(
    () => WorkItem,
    (workItem) => workItem.attachments,
    { onDelete: "CASCADE", nullable: false }
  )
  workItem: WorkItem;

  @Column({ type: "uuid", name: "uploaded_by_id" })
  uploadedById: string;

  @ManyToOne(() => User, { nullable: false })
  uploadedBy: User;

  @Column({ type: "varchar", length: 255 })
  originalName: string;

  @Column({
    type: "enum",
    enum: AttachmentType,
  })
  type: AttachmentType;

  @Column({ type: "varchar", length: 150 })
  mimeType: string;

  @Column({ type: "bigint" })
  size: string;

  @Column({ type: "text", unique: true })
  storageKey: string;

  @CreateDateColumn()
  createdAt: Date;
}