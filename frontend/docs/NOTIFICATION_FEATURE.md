# Notifications

## Overview

Notifications inform a signed-in user about work-item and project activity. The backend stores notifications per user and organization; the frontend loads them into application state and displays them in the navigation bell popover.

## Notification data

The backend `notifications` table stores:

| Field | Description |
|---|---|
| `id` | Notification UUID |
| `userId`, `organizationId` | Recipient and organization scope |
| `type` | Event category |
| `title`, `message` | Text shown to the recipient |
| `read`, `readAt` | Read state and time it was marked read |
| `workItemId`, `projectId` | Optional related work item and project |
| `link` | Optional destination path |
| `metadata` | Optional event-specific JSON data |
| `createdAt` | Creation time |

Defined types are `TASK_ASSIGNED`, `TASK_UPDATED`, `TASK_COMPLETED`, `TASK_OVERDUE`, `TASK_MENTIONED`, `SLA_ESCALATED`, `RECURRING_TASK_CREATED`, `RECURRING_TASK_FAILED`, and `PROJECT_MEMBER_ADDED`.

The notification service verifies that a recipient belongs to the supplied organization. It can also use a `deduplicationKey` to avoid creating a duplicate for the same recipient and organization. Batch notification delivery is best-effort: failures are logged without failing the parent operation.

## Current notification sources

Examples of events that create notifications include:

- A work item is assigned to another user.
- An SLA breach escalates a work item.
- A user is added to a project.

The notification type list describes supported categories; it does not mean every type currently has an event producer.

## API

All routes are mounted at `/api/notifications` and require authentication. Read and list operations are scoped to the authenticated user's ID and organization.

| Method and path | Behavior |
|---|---|
| `GET /api/notifications?page=1&limit=20` | Returns the signed-in user's notifications, newest first, along with pagination metadata and an unread count. `limit` defaults to 20 and is capped at 100. |
| `GET /api/notifications/unread-count` | Returns the user's total unread count. |
| `PATCH /api/notifications/:id/read` | Marks one of the user's notifications as read. |
| `PATCH /api/notifications/read-all` | Marks all of the user's unread notifications as read and returns the number updated. |

The list response has this shape:

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": [],
  "pagination": {},
  "unreadCount": 0
}
```

An unauthenticated request returns an authorization error. Marking a notification that does not belong to the current user or organization returns `NOTIFICATION_NOT_FOUND`.

## Frontend behavior

- After authentication, the app requests the notification list and stores the returned records in application state.
- The navigation popover shows the loaded notifications, unread styling, title, message, and creation date.
- Selecting an item marks it read locally and sends a request to persist the change. “Mark all read” updates local state and calls the corresponding API.
- The list request currently uses the API default page and limit; the frontend does not expose pagination or poll for new notifications.

## Current integration notes

- The backend routes do not currently expose a `POST /api/notifications` endpoint. The frontend API module contains a `createNotificationApi` helper, but it does not correspond to a registered backend route; notifications are created internally by backend services.
- Backend records use `workItemId`, `projectId`, and `link`. Frontend hydration currently maps `link` to `actionUrl`, while the popover's click handler checks `targetTaskId` and `targetProjectId`. As a result, a hydrated backend notification is marked read when selected, but its related task or project is not opened by that handler unless those frontend target fields are supplied elsewhere.

## Relevant implementation

- Backend entity and categories: `backend/entities/notification.entity.ts`
- Backend creation and delivery: `backend/services/notification.service.ts`
- Backend routes: `backend/routes/notification.routes.ts`
- Backend API handlers: `backend/controllers/notification.controller.ts`
- Frontend API calls: `frontend/src/services/api.ts`
- Frontend hydration and read actions: `frontend/src/state/AppContext.tsx`
- Frontend popover: `frontend/src/components/navigation/NotificationPopover.tsx`
