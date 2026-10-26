import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Organization } from "./organization.entity";

@Entity({ name: "organization_sla" })
@Index("IDX_organization_sla_org", ["organizationId"], { unique: true })
export class OrganizationSla {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organization_id", type: "uuid", unique: true })
  organizationId: string;

  @Column({ name: "urgent_hours", type: "int", default: 4 })
  urgentHours: number;

  @Column({ name: "high_hours", type: "int", default: 8 })
  highHours: number;

  @Column({ name: "medium_hours", type: "int", default: 24 })
  mediumHours: number;

  @Column({ name: "low_hours", type: "int", default: 72 })
  lowHours: number;

  @Column({ name: "escalate_hours", type: "int", default: 8 })
  escalateHours: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @OneToOne(() => Organization, (organization) => organization.slaPolicy, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organization_id" })
  organization: Organization;
}
