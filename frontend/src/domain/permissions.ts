/**
 * Shared Role-Based Access Control (RBAC) Permissions Model.
 * Roles: 'Admin' | 'Manager' | 'Teammate'
 */

import { Role, Workflow } from '../types';

export const ROLES = {
  ADMIN: 'Admin' as const,
  MANAGER: 'Manager' as const,
  TEAMMATE: 'Teammate' as const,
};

export const PERMISSIONS = {
  CREATE_PROJECT: 'create_project',
  DELETE_PROJECT: 'delete_project',
  EDIT_PROJECT_SETTINGS: 'edit_project_settings',
  MANAGE_WORKFLOW: 'manage_workflow',
  MANAGE_MEMBERS: 'manage_members',
  CREATE_TASK: 'create_task',
  DELETE_TASK: 'delete_task',
  EDIT_TASK_DATES: 'edit_task_dates',
  EDIT_TASK_ALL: 'edit_task_all',
  UPDATE_TASK_STATUS: 'update_task_status',
  ADD_COMMENT: 'add_comment',
  TRACK_TIME: 'track_time',
  MANAGE_DEPENDENCIES: 'manage_dependencies',
  TRIGGER_ESCALATION: 'trigger_escalation',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS_MATRIX: Record<Role, Set<string>> = {
  [ROLES.ADMIN]: new Set(Object.values(PERMISSIONS)),
  [ROLES.MANAGER]: new Set([
    PERMISSIONS.CREATE_PROJECT,
    PERMISSIONS.EDIT_PROJECT_SETTINGS,
    PERMISSIONS.MANAGE_WORKFLOW,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.DELETE_TASK,
    PERMISSIONS.EDIT_TASK_DATES,
    PERMISSIONS.EDIT_TASK_ALL,
    PERMISSIONS.UPDATE_TASK_STATUS,
    PERMISSIONS.ADD_COMMENT,
    PERMISSIONS.TRACK_TIME,
    PERMISSIONS.MANAGE_DEPENDENCIES,
    PERMISSIONS.TRIGGER_ESCALATION,
  ]),
  [ROLES.TEAMMATE]: new Set([
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.UPDATE_TASK_STATUS,
    PERMISSIONS.ADD_COMMENT,
    PERMISSIONS.TRACK_TIME,
  ]),
};

export function hasPermission(role: Role, permission: Permission | string): boolean {
  const allowed = ROLE_PERMISSIONS_MATRIX[role];
  return allowed ? allowed.has(permission) : false;
}

/**
 * Checks whether a user has access to a project based on visibility (Global vs Private).
 * Global projects: all users in current workspace can view.
 * Private projects: only the owner and explicitly added memberIds can view.
 */
export function canUserAccessProject(project?: any | null, userId?: string | null): boolean {
  if (!project) return false;
  if (project.visibility !== 'private') return true;
  if (!userId) return false;
  if (project.ownerId === userId) return true;
  return Array.isArray(project.memberIds) && project.memberIds.includes(userId);
}

export interface TransitionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks whether user can transition a task from oldStatus to newStatus
 * based on role and project workflow permissions.
 */
export function canTransitionStatus(
  role: Role,
  fromStatus: string,
  toStatus: string,
  workflow?: Workflow | null
): TransitionCheckResult {
  if (role === ROLES.ADMIN) return { allowed: true };

  // Check if status exists in workflow
  if (!workflow || !workflow.statuses) return { allowed: true };

  const currentStatusObj = workflow.statuses.find((s) => s.name === fromStatus);
  if (!currentStatusObj) return { allowed: true };

  // Check if target is in allowed transitions
  if (currentStatusObj.allowedTransitions && currentStatusObj.allowedTransitions.length > 0) {
    if (!currentStatusObj.allowedTransitions.includes(toStatus)) {
      return {
        allowed: false,
        reason: `Workflow rule prevents direct transition from "${fromStatus}" to "${toStatus}".`,
      };
    }
  }

  // Check role transition restrictions if defined
  if (currentStatusObj.roleRestrictions && currentStatusObj.roleRestrictions[toStatus]) {
    const allowedRoles = currentStatusObj.roleRestrictions[toStatus];
    if (!allowedRoles.includes(role)) {
      return {
        allowed: false,
        reason: `Role restriction: Only ${allowedRoles.join('/')} can move tasks into "${toStatus}".`,
      };
    }
  }

  // Default teammate restriction: Teammates cannot move directly into Done without review or testing
  if (
    role === ROLES.TEAMMATE &&
    toStatus === 'Done' &&
    (fromStatus === 'To Do' || fromStatus === 'Backlog' || fromStatus === 'In Progress')
  ) {
    return {
      allowed: false,
      reason: 'Teammates must submit tasks for "In Review" or "Testing / QA" before marking "Done".',
    };
  }

  return { allowed: true };
}
