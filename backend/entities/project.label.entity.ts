import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { Project } from "./project.entity";

@Entity({ name: "project_labels" })
@Unique("UQ_project_labels_project_name", ["projectId", "name"])
@Index("IDX_project_labels_project", ["projectId"])
export class ProjectLabel {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id", type: "uuid" })
  projectId: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "varchar", length: 30, default: "#3B82F6" })
  color: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project: Project;
}
