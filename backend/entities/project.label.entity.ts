import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from "typeorm";

import { Project } from "./project.entity";
import { WorkItem } from "./work.item.entity";

@Entity("project_labels")
@Unique("UQ_project_labels_project_name", ["projectId", "name"])
@Index("IDX_project_labels_project_id", ["projectId"])
export class ProjectLabel {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id", type: "uuid" })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ type: "varchar", length: 50 })
  name: string;

  @Column({ type: "varchar", length: 7 })
  color: string; // Example: #3B82F6

  @Column({ type: "text", nullable: true })
  description: string | null;

  @OneToMany(() => WorkItem, (workItem) => workItem.label)
  workItems: WorkItem[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}