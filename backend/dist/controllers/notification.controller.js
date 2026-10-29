"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllNotificationsRead = exports.markNotificationRead = exports.getUnreadNotificationCount = exports.getUserNotifications = void 0;
const data_source_1 = require("../config/data.source");
const app_error_1 = require("../errors/app.error");
const notification_entity_1 = require("../entities/notification.entity");
const pagination_1 = require("../utils/pagination");
// GET /api/notifications
const getUserNotifications = async (req, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    const pageValue = Number.parseInt(String(req.query.page ?? "1"), 10);
    const limitValue = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
    const limit = Number.isFinite(limitValue) && limitValue > 0
        ? Math.min(limitValue, 100)
        : 20;
    const { skip, take } = (0, pagination_1.getPagination)({ page, limit });
    const notificationRepository = data_source_1.AppDataSource.getRepository(notification_entity_1.Notification);
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
    const pagination = (0, pagination_1.getPaginationMeta)({ page, limit, total });
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
exports.getUserNotifications = getUserNotifications;
// GET /api/notifications/unread-count
const getUnreadNotificationCount = async (req, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    const unreadCount = await data_source_1.AppDataSource.getRepository(notification_entity_1.Notification).count({
        where: { userId, organizationId, read: false },
    });
    res.status(200).json({
        success: true,
        message: "Unread notification count retrieved successfully",
        data: { unreadCount },
    });
};
exports.getUnreadNotificationCount = getUnreadNotificationCount;
// PATCH /api/notifications/:id/read
const markNotificationRead = async (req, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const id = req.params.id;
    if (typeof id !== "string" || !id.trim()) {
        throw new app_error_1.AppError("Invalid notification ID", 400, "INVALID_NOTIFICATION_ID");
    }
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    const notificationRepository = data_source_1.AppDataSource.getRepository(notification_entity_1.Notification);
    const result = await notificationRepository
        .createQueryBuilder()
        .update(notification_entity_1.Notification)
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
            throw new app_error_1.AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
        }
    }
    res.status(200).json({
        success: true,
        message: "Notification marked as read",
    });
};
exports.markNotificationRead = markNotificationRead;
// PATCH /api/notifications/read-all
const markAllNotificationsRead = async (req, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    const result = await data_source_1.AppDataSource.getRepository(notification_entity_1.Notification)
        .createQueryBuilder()
        .update(notification_entity_1.Notification)
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
exports.markAllNotificationsRead = markAllNotificationsRead;
