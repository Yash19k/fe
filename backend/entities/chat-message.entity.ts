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
import { ChatConversation } from "./chat-conversation.entity";
import { User } from "./user.entity";

@Entity("chat_messages")
@Index("IDX_chat_messages_conversation_created", ["conversationId", "createdAt"])
export class ChatMessage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "conversation_id", type: "uuid" })
  conversationId!: string;

  @Column({ name: "sender_id", type: "uuid" })
  senderId!: string;

  @Column({ type: "varchar", length: 4000 })
  content!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({ name: "edited_at", type: "timestamptz", nullable: true })
  editedAt!: Date | null;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => ChatConversation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversation_id" })
  conversation!: ChatConversation;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sender_id" })
  sender!: User;
}
