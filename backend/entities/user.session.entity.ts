
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

import { User } from "./user.entity";

@Entity("user_sessions")
@Index("IDX_user_sessions_user_id", ["userId"])
@Index("IDX_user_sessions_expires_at", ["expiresAt"])
export class UserSession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, (user) => user.sessions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    name: "token_hash",
    type: "varchar",
    length: 64,
    unique: true,
  })
  tokenHash!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({
    name: "revoked_at",
    type: "timestamptz",
    nullable: true,
  })
  revokedAt!: Date | null;

  @Column({
    name: "last_used_at",
    type: "timestamptz",
    nullable: true,
  })
  lastUsedAt!: Date | null;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamptz",
  })
  updatedAt!: Date;
}
