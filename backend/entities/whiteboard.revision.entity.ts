import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";
import { Whiteboard } from "./whiteboard.entity";

@Entity("whiteboard_revisions")
@Unique("UQ_whiteboard_revisions_whiteboard_revision", ["whiteboardId", "revisionNumber"])
@Index("IDX_whiteboard_revisions_whiteboard_revision", ["whiteboardId", "revisionNumber"])
export class WhiteboardRevision {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "whiteboard_id", type: "uuid" })
  whiteboardId!: string;

  @Column({ name: "revision_number", type: "integer" })
  revisionNumber!: number;

  @Column({ name: "created_by_id", type: "uuid", nullable: true })
  createdById!: string | null;

  @Column({ name: "scene_snapshot", type: "jsonb" })
  sceneSnapshot!: Record<string, unknown>;

  @Column({ name: "change_summary", type: "varchar", length: 255, nullable: true })
  changeSummary!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => Whiteboard, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "whiteboard_id" })
  whiteboard!: Whiteboard;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User | null;
}
