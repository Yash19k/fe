"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
exports.createNotificationsBestEffort = createNotificationsBestEffort;
const data_source_1 = require("../config/data.source");
const app_error_1 = require("../errors/app.error");
const notification_entity_1 = require("../entities/notification.entity");
class NotificationService {
    constructor() {
        this.notificationRepository = data_source_1.AppDataSource.getRepository(notification_entity_1.Notification);
    }
    async createNotification(input) {
        const { userId, organizationId, type, title, message, workItemId = null, projectId = null, link = null, deduplicationKey = null, metadata = null, } = input;
        if (!userId || !organizationId) {
            throw new app_error_1.AppError("Notification recipient and organization are required", 400, "INVALID_NOTIFICATION_INPUT");
        }
        // Verify that the recipient belongs to the specified organization.
        const recipientExists = await data_source_1.AppDataSource.getRepository("User")
            .createQueryBuilder("user")
            .where("user.id = :userId", { userId })
            .andWhere("user.organizationId = :organizationId", {
            organizationId,
        })
            .getExists();
        if (!recipientExists) {
            throw new app_error_1.AppError("Notification recipient not found in this organization", 404, "NOTIFICATION_RECIPIENT_NOT_FOUND");
        }
        if (deduplicationKey) {
            const existingNotification = await this.notificationRepository.findOne({
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
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
async function createNotificationsBestEffort(inputs, context) {
    const results = await Promise.allSettled(inputs.map((input) => exports.notificationService.createNotification(input)));
    const failures = results.flatMap((result) => result.status === "rejected"
        ? [
            result.reason instanceof app_error_1.AppError
                ? { name: result.reason.name, code: result.reason.code }
                : {
                    name: result.reason instanceof Error
                        ? result.reason.name
                        : "UnknownError",
                },
        ]
        : []);
    if (failures.length > 0) {
        console.error("Best-effort notification delivery failed.", {
            ...context,
            failureCount: failures.length,
            failures,
        });
    }
}
