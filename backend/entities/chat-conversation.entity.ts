import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ChatConversationMember } from "./chat-conversation-member.entity";

export enum ChatConversationType {
  DIRECT = "DIRECT",
  GROUP = "GROUP",
  PROJECT = "PROJECT",
}

@Entity("chat_conversations")
@Index("IDX_chat_conversations_organization_id", ["organizationId"])
export class ChatConversation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @Column({ name: "project_id", type: "uuid", nullable: true })
  projectId!: string | null;

  @Column({ name: "direct_pair_key", type: "varchar", length: 73, nullable: true })
  directPairKey!: string | null;

  @Column({
    type: "enum",
    enum: ChatConversationType,
    enumName: "chat_conversations_type_enum",
  })
  type!: ChatConversationType;

  @Column({ type: "varchar", length: 150, nullable: true })
  name!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({ name: "last_message_at", type: "timestamptz", nullable: true })
  lastMessageAt!: Date | null;

  @OneToMany(() => ChatConversationMember, (member) => member.conversation)
  members!: ChatConversationMember[];
}
