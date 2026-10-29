import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Organization } from "./organization.entity";
import { User, UserRole } from "./user.entity";

@Entity({ name: "member_invitations" })
@Index("UQ_member_invitations_token_hash", ["tokenHash"], { unique: true })
@Index("IDX_member_invitations_user_id", ["userId"])
@Index("UQ_member_invitations_one_outstanding_per_user", ["userId"], {
  unique: true,
  where: '"consumed_at" IS NULL AND "revoked_at" IS NULL',
})
@Check(
  "CHK_member_invitations_consumed_or_revoked",
  '"consumed_at" IS NULL OR "revoked_at" IS NULL',
)
export class MemberInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ name: "organization_id", type: "uuid" })
  organizationId: string;

  @Column({ type: "varchar", length: 255 })
  email: string;

  @Column({
    type: "enum",
    enum: UserRole,
    enumName: "users_role_enum",
  })
  role: UserRole;

  @Column({ name: "token_hash", type: "varchar", length: 64 })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @Column({ name: "consumed_at", type: "timestamptz", nullable: true })
  consumedAt: Date | null;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization: Organization;
}
