import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Project } from "./project.entity";
import { OrganizationSla } from "./organization.sla.entity";

@Entity({ name: "organizations" })
@Index("IDX_organizations_created_by_user_id", ["createdByUserId"])
export class Organization {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ name: "created_by_user_id", type: "uuid", nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Project, (project) => project.organization)
  projects: Project[];

  @OneToOne(() => OrganizationSla, (sla) => sla.organization)
  slaPolicy: OrganizationSla;

  @ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id" })
  createdBy: User | null;
}