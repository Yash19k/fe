/**
 * Shared Role-Based Access Control (RBAC) Permissions Model.
 * Roles: 'Admin' | 'Manager' | 'Teammate'
 */

import { Role, Workflow } from '../types';
import { findWorkflowStatus, normalizeWorkflowStatus } from './workflow';

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

export function normalizeRole(role?: Role | string | null): Role {
  if (!role) return ROLES.TEAMMATE;
  switch (String(role).toUpperCase()) {
    case 'ADMIN':
      return ROLES.ADMIN;
    case 'MANAGER':
    case 'LEAD':
      return ROLES.MANAGER;
    case 'TEAMMATE':
    case 'MEMBER':
    default:
      return ROLES.TEAMMATE;
  }
}

export function hasPermission(role: Role | string, permission: Permission | string): boolean {
  const normalized = normalizeRole(role);
  const allowed = ROLE_PERMISSIONS_MATRIX[normalized];
  return allowed ? allowed.has(permission) : false;
}

/**
 * Checks whether a user has access to a project based on visibility (Global vs Private).
 * Global projects: all users in current workspace can view.
 * Private projects: only the owner and explicitly added memberIds can view.
 */
export function canUserAccessProject(
  project?: any | null,
  userId?: string | null,
  userRole?: Role | string | null
): boolean {
  if (!project) return false;
  const normalizedRole = userRole ? String(userRole).toUpperCase() : null;
  if (normalizedRole === 'ADMIN') return true;
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
  role: Role | string,
  fromStatus: string,
  toStatus: string,
  workflow?: Workflow | null
): TransitionCheckResult {
  const normalizedRole = normalizeRole(role);
  if (!workflow) {
    return { allowed: false, reason: 'Project workflow configuration is not available.' };
  }

  const currentStatusObj = findWorkflowStatus(workflow, fromStatus);
  const targetStatusObj = findWorkflowStatus(workflow, toStatus);
  if (!currentStatusObj || !targetStatusObj) {
    return {
      allowed: false,
      reason: 'This status is not present in the project workflow.',
    };
  }

  const allowedTransitions = currentStatusObj.allowedTransitions || [];
  const targetIdentifiers = new Set([
    normalizeWorkflowStatus(targetStatusObj.name),
    normalizeWorkflowStatus(targetStatusObj.id),
  ]);
  if (
    !allowedTransitions.some((transition) =>
      targetIdentifiers.has(normalizeWorkflowStatus(transition)),
    )
  ) {
    return {
      allowed: false,
      reason: `Workflow rule prevents direct transition from "${currentStatusObj.name}" to "${targetStatusObj.name}".`,
    };
  }

  if (normalizedRole !== ROLES.ADMIN && currentStatusObj.roleRestrictions) {
    const targetRestriction = Object.entries(currentStatusObj.roleRestrictions).find(
      ([target]) => targetIdentifiers.has(normalizeWorkflowStatus(target)),
    )?.[1];
    if (targetRestriction && !targetRestriction.some((allowedRole) =>
      normalizeRole(allowedRole) === normalizedRole,
    )) {
      return {
        allowed: false,
        reason: `Role restriction: Only ${targetRestriction.join('/')} can move tasks into "${targetStatusObj.name}".`,
      };
    }
  }

  return { allowed: true };
}
