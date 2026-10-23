
import { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";
import { Notification } from "../entities/notification.entity";
import {
  getPagination,
  getPaginationMeta,
} from "../utils/pagination";

// GET /api/notifications
export const getUserNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;

  if (!userId || !organizationId) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  const pageValue = Number.parseInt(String(req.query.page ?? "1"), 10);
  const limitValue = Number.parseInt(String(req.query.limit ?? "20"), 10);

  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit =
    Number.isFinite(limitValue) && limitValue > 0
      ? Math.min(limitValue, 100)
      : 20;

  const { skip, take } = getPagination({ page, limit });

  const notificationRepository = AppDataSource.getRepository(Notification);

  const [notifications, total] = await notificationRepository.findAndCount({
    where: { userId, organizationId },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      read: true,
      readAt: true,
      workItemId: true,
      projectId: true,
      link: true,
      metadata: true,
      createdAt: true,
    },
    order: { createdAt: "DESC" },
    skip,
    take,
  });

  const pagination = getPaginationMeta({ page, limit, total });

  const unreadCount = await notificationRepository.count({
    where: { userId, organizationId, read: false },
  });

  res.status(200).json({
    success: true,
    message: "Notifications retrieved successfully",
    data: notifications,
    pagination,
    unreadCount,
  });
};

// GET /api/notifications/unread-count
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;

  if (!userId || !organizationId) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  const unreadCount = await AppDataSource.getRepository(Notification).count({
    where: { userId, organizationId, read: false },
  });

  res.status(200).json({
    success: true,
    message: "Unread notification count retrieved successfully",
    data: { unreadCount },
  });
};

// PATCH /api/notifications/:id/read
export const markNotificationRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;
  const id = req.params.id;

if (typeof id !== "string" || !id.trim()) {
  throw new AppError(
    "Invalid notification ID",
    400,
    "INVALID_NOTIFICATION_ID"
  );
}

  if (!userId || !organizationId) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  const notificationRepository = AppDataSource.getRepository(Notification);

  const result = await notificationRepository
    .createQueryBuilder()
    .update(Notification)
    .set({
      read: true,
      readAt: () => "CURRENT_TIMESTAMP",
    })
    .where("id = :id", { id })
    .andWhere("user_id = :userId", { userId })
    .andWhere("organization_id = :organizationId", { organizationId })
    .andWhere('"read" = :read', { read: false })
    .execute();

  if (result.affected === 0) {
    const existingNotification = await notificationRepository.findOne({
      where: { id, userId, organizationId },
      select: { id: true },
    });

    if (!existingNotification) {
      throw new AppError(
        "Notification not found",
        404,
        "NOTIFICATION_NOT_FOUND"
      );
    }
  }

  res.status(200).json({
    success: true,
    message: "Notification marked as read",
  });
};

// PATCH /api/notifications/read-all
export const markAllNotificationsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;

  if (!userId || !organizationId) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  const result = await AppDataSource.getRepository(Notification)
    .createQueryBuilder()
    .update(Notification)
    .set({
      read: true,
      readAt: () => "CURRENT_TIMESTAMP",
    })
    .where("user_id = :userId", { userId })
    .andWhere("organization_id = :organizationId", { organizationId })
    .andWhere('"read" = :read', { read: false })
    .execute();

  res.status(200).json({
    success: true,
    message: "All notifications marked as read",
    data: {
      updatedCount: result.affected ?? 0,
    },
  });
};
