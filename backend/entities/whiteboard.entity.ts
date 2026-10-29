import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "./project.entity";
import { User } from "./user.entity";

@Entity("whiteboards")
@Index("IDX_whiteboards_project_id", ["projectId"])
export class Whiteboard {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "project_id", type: "uuid" })
  projectId!: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @Column({ name: "created_by_id", type: "uuid" })
  createdById!: string;

  @Column({ type: "varchar", length: 150 })
  name!: string;

  @Column({ name: "scene_data", type: "jsonb", default: () => "'{}'::jsonb" })
  sceneData!: Record<string, unknown>;

  @Column({ type: "integer", default: 1 })
  revision!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => Project, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;
}
