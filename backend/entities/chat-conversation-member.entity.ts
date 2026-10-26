import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";
import { ChatConversation } from "./chat-conversation.entity";

@Entity("chat_conversation_members")
@Index("UQ_chat_conversation_member", ["conversationId", "userId"], {
  unique: true,
})
@Index("IDX_chat_conversation_members_user_id", ["userId"])
export class ChatConversationMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "conversation_id", type: "uuid" })
  conversationId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @CreateDateColumn({ name: "joined_at", type: "timestamptz" })
  joinedAt!: Date;

  @Column({ name: "last_read_at", type: "timestamptz", nullable: true })
  lastReadAt!: Date | null;

  @ManyToOne(() => ChatConversation, (conversation) => conversation.members, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation!: ChatConversation;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
