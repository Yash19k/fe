
import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import {
  Notification,
  NotificationType,
} from "../entities/notification.entity";

export interface CreateNotificationInput {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  workItemId?: string | null;
  projectId?: string | null;
  link?: string | null;
  deduplicationKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class NotificationService {
  private readonly notificationRepository =
    AppDataSource.getRepository(Notification);

  async createNotification(
    input: CreateNotificationInput
  ): Promise<Notification> {
    const {
      userId,
      organizationId,
      type,
      title,
      message,
      workItemId = null,
      projectId = null,
      link = null,
      deduplicationKey = null,
      metadata = null,
    } = input;

    if (!userId || !organizationId) {
      throw new AppError(
        "Notification recipient and organization are required",
        400,
        "INVALID_NOTIFICATION_INPUT"
      );
    }

    // Verify that the recipient belongs to the specified organization.
    const recipientExists = await AppDataSource.getRepository("User")
      .createQueryBuilder("user")
      .where("user.id = :userId", { userId })
      .andWhere("user.organizationId = :organizationId", {
        organizationId,
      })
      .getExists();

    if (!recipientExists) {
      throw new AppError(
        "Notification recipient not found in this organization",
        404,
        "NOTIFICATION_RECIPIENT_NOT_FOUND"
      );
    }

    if (deduplicationKey) {
      const existingNotification =
        await this.notificationRepository.findOne({
          where: { userId, organizationId, deduplicationKey },
        });

      if (existingNotification) {
        return existingNotification;
      }
    }

    const notification = this.notificationRepository.create({
      userId,
      organizationId,
      type,
      title,
      message,
      workItemId,
      projectId,
      link,
      deduplicationKey,
      metadata,
      read: false,
      readAt: null,
    });

    return this.notificationRepository.save(notification);
  }
}

export const notificationService = new NotificationService();

export async function createNotificationsBestEffort(
  inputs: CreateNotificationInput[],
  context: {
    operation: string;
    organizationId?: string;
    projectId?: string;
  },
): Promise<void> {
  const results = await Promise.allSettled(
    inputs.map((input) => notificationService.createNotification(input)),
  );
  const failures = results.flatMap((result) =>
    result.status === "rejected"
      ? [
          result.reason instanceof AppError
            ? { name: result.reason.name, code: result.reason.code }
            : {
                name:
                  result.reason instanceof Error
                    ? result.reason.name
                    : "UnknownError",
              },
        ]
      : [],
  );

  if (failures.length > 0) {
    console.error("Best-effort notification delivery failed.", {
      ...context,
      failureCount: failures.length,
      failures,
    });
  }
}
