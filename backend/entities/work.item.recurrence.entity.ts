
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from "typeorm";

import { WorkItem } from "./work.item.entity";

export enum RecurrenceFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export enum MonthlyPattern {
  DAY_OF_MONTH = "DAY_OF_MONTH",
  FIRST_DAY = "FIRST_DAY",
  LAST_FRIDAY = "LAST_FRIDAY",
}

@Entity("work_item_recurrences")
@Check("CHK_recurrence_interval_positive", `"interval" > 0`)
@Index("IDX_recurrence_next_run", ["isActive", "nextRunAt"])
export class WorkItemRecurrence {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // The original task whose details are used to generate future tasks.
  // One original work item can have at most one recurrence rule.
  @OneToOne(() => WorkItem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "work_item_id" })
  workItem: WorkItem;

  @Column({
    type: "enum",
    enum: RecurrenceFrequency,
  })
  frequency: RecurrenceFrequency;

  // Daily: every N days; weekly: every N weeks;
  // monthly: every N months.
  @Column({ type: "int", default: 1 })
  interval: number;

  // PostgreSQL day numbers: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  // Used when weekly recurrence supports selected weekdays.
  @Column({
    name: "days_of_week",
    type: "smallint",
    array: true,
    nullable: true,
  })
  daysOfWeek: number[] | null;

  @Column({
    name: "monthly_pattern",
    type: "enum",
    enum: MonthlyPattern,
    nullable: true,
  })
  monthlyPattern: MonthlyPattern | null;

  // Used when monthlyPattern is DAY_OF_MONTH (1-31).
  @Column({
    name: "day_of_month",
    type: "smallint",
    nullable: true,
  })
  dayOfMonth: number | null;

  // First date on which an occurrence can be generated.
  @Column({ name: "starts_on", type: "date" })
  startsOn: string;

  // Last eligible recurrence date; null means no configured end date.
  @Column({ name: "ends_on", type: "date", nullable: true })
  endsOn: string | null;

  // Next scheduled execution time, stored with its time zone offset.
  @Column({
    name: "next_run_at",
    type: "timestamptz",
    nullable: true,
  })
  nextRunAt: Date | null;

  @Column({ type: "varchar", length: 100, default: "Asia/Kolkata" })
  timezone: string;

  // Kept in the schema for compatibility; recurring tasks always run at 09:00.
  @Column({ name: "time_of_day", type: "varchar", length: 5, default: "09:00" })
  timeOfDay: string;

  // For DAILY recurrence, skip Saturday and Sunday when true.
  @Column({ name: "weekdays_only", type: "boolean", default: false })
  weekdaysOnly: boolean;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
