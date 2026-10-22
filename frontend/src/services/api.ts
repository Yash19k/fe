/**
 * Centralized API Integration Service for TaskFlow Pro.
 * Strictly communicates with actual backend endpoints without mocked responses or fake data.
 */

import type {
  Task,
  TaskStatus,
  WorkItemType,
  Priority,
  Project,
  Sprint,
  Role,
} from '../types';

export const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3000';

export const AUTH_TOKEN_KEY = 'taskflow_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/users/refresh`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        clearAuthToken();
        return null;
      }

      const data = await res.json().catch(() => null);
      if (data?.token && typeof data.token === 'string') {
        setAuthToken(data.token);
        return data.token;
      }
      return getAuthToken() || 'active_session';
    } catch {
      clearAuthToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Support HTTP cookie JWT authentication
    });

    let data: any = null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => '');
      data = text ? { message: text } : null;
    }

    if (!res.ok) {
      // If 401 Unauthorized, attempt transparent token refresh once
      if (
        res.status === 401 &&
        !options._retry &&
        !endpoint.includes('/users/login') &&
        !endpoint.includes('/users/refresh') &&
        !endpoint.includes('/users/logout')
      ) {
        const refreshedToken = await executeTokenRefresh();
        if (refreshedToken) {
          return request<T>(endpoint, {
            ...options,
            _retry: true,
          });
        }
      }

      let errorMessage = data?.message || data?.error;
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        const details = data.errors
          .map((e: any) => {
            if (typeof e === 'object' && e !== null) {
              return e.message ? `${e.field ? e.field + ': ' : ''}${e.message}` : JSON.stringify(e);
            }
            return String(e);
          })
          .join(', ');
        errorMessage = errorMessage ? `${errorMessage}: ${details}` : details;
      }
      if (!errorMessage) {
        errorMessage = `Request failed with status ${res.status}`;
      }

      throw new ApiError(errorMessage, res.status, data?.code, data?.errors);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Handle Network / Connection errors (e.g. backend server not running)
    const isNetworkError =
      err?.name === 'TypeError' ||
      err?.message?.includes('fetch') ||
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError');

    if (isNetworkError) {
      throw new ApiError(
        `Unable to reach backend server at ${API_BASE_URL}. Ensure the backend service is running.`,
        0,
        'SERVER_UNREACHABLE'
      );
    }

    throw new ApiError(err?.message || 'Unexpected network error occurred', 500);
  }
}

// ==========================================
// Health & Diagnostic
// ==========================================

export async function checkBackendHealth(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/');
}

// ==========================================
// Authentication & Users
// ==========================================

export interface RegisterOrganizationInput {
  user: {
    fullName: string;
    email: string;
    password: string;
  };
  organization: {
    name: string;
    slug: string;
  };
}

export interface RegisterOrganizationResponse {
  organizationId: string;
  userId: string;
  token?: string;
  user?: any;
  organization?: any;
}

export async function registerOrganizationApi(
  payload: RegisterOrganizationInput
): Promise<RegisterOrganizationResponse> {
  const res = await request<RegisterOrganizationResponse>('/api/users/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res?.token) {
    setAuthToken(res.token);
  }
  return res;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string;
    companyName: string;
    onboardingCompleted: boolean;
  };
  organization: {
    id: string;
    name: string;
    createdByUserId: string;
    createdAt: string;
  };
}

export async function loginApi(payload: LoginInput): Promise<LoginResponse> {
  const res = await request<LoginResponse>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res?.token) {
    setAuthToken(res.token);
  }
  return res;
}

export async function currentUserApi(): Promise<{ user: any; organization: any }> {
  return request<{ user: any; organization: any }>('/api/users/me', {
    method: 'GET',
  });
}

export async function refreshTokenApi(): Promise<{ success: boolean; message?: string; token?: string }> {
  return request<{ success: boolean; message?: string; token?: string }>('/api/users/refresh', {
    method: 'POST',
  });
}

export async function logoutApi(): Promise<{ success: boolean }> {
  try {
    return await request<{ success: boolean }>('/api/users/logout', {
      method: 'POST',
    });
  } finally {
    clearAuthToken();
  }
}

// ==========================================
// Organization Invitations
// ==========================================

export interface InviteMemberApiInput {
  email: string;
  role: string;
}

export async function inviteOrganizationMembersApi(
  members: InviteMemberApiInput[]
): Promise<any> {
  return request<any>('/api/organizations/members/invite', {
    method: 'POST',
    body: JSON.stringify(members),
  });
}

export async function acceptInvitationApi(payload: {
  token: string;
  password?: string;
  fullName?: string;
}): Promise<any> {
  return request<any>('/api/organizations/accept', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ==========================================
// Projects
// ==========================================

export interface CreateProjectApiInput {
  name: string;
  key: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  visibility?: 'PUBLIC' | 'PRIVATE';
}

export async function getProjectsApi(): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>('/api/projects', {
    method: 'GET',
  });
}

export async function getProjectApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'GET',
  });
}

export async function createProjectApi(payload: CreateProjectApiInput): Promise<any> {
  return request<any>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProjectApi(projectId: string, updates: any): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteProjectApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

// ==========================================
// Project Members
// ==========================================

export async function getProjectMembersApi(projectId: string): Promise<{ success: boolean; data: any[] }> {
  return request<{ success: boolean; data: any[] }>(`/api/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'GET',
  });
}

export async function addProjectMemberApi(
  projectId: string,
  payload: { memberId?: string; email?: string; role?: string }
): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeProjectMemberApi(projectId: string, memberId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

export async function updateProjectMemberRoleApi(
  projectId: string,
  memberId: string,
  role: string
): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

// ==========================================
// Work Items (Tasks)
// ==========================================

export interface CreateWorkItemApiInput {
  projectId: string;
  sprintId?: string | null;
  parentWorkItemId?: string | null;
  type: string;
  title: string;
  description?: string | null;
  priority?: string;
  status?: string;
  dueDate?: string | null;
  assignees?: Array<{ userId: string; startDate?: string | null; estimatedHours?: number | null }>;
  recurrence?: any;
}

export async function getProjectWorkItemsApi(
  projectId: string,
  page = 1,
  limit = 100,
  status?: string,
  type?: string
): Promise<any> {
  let url = `/api/work-items/project/${encodeURIComponent(projectId)}?page=${page}&limit=${limit}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;
  if (type) url += `&type=${encodeURIComponent(type)}`;

  return request<any>(url, {
    method: 'GET',
  });
}

export async function createWorkItemApi(payload: CreateWorkItemApiInput): Promise<any> {
  return request<any>('/api/work-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateWorkItemApi(workItemId: string, updates: any): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function escalateWorkItemApi(
  workItemId: string,
  reason?: string,
): Promise<any> {
  const payload = reason?.trim() ? { reason: reason.trim() } : {};
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/escalate`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkItemApi(workItemId: string): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}`, {
    method: 'DELETE',
  });
}

// ==========================================
// Sprints
// ==========================================

export interface CreateSprintApiInput {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  workItemIds?: string[];
}

const DATABASE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedWorkItemId(value: unknown): value is string {
  return typeof value === 'string' && DATABASE_UUID.test(value);
}

export async function createSprintApi(
  projectId: string,
  payload: CreateSprintApiInput
): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/sprints`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProjectSprintsApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/sprints`, {
    method: 'GET',
  });
}

// ==========================================
// Dashboard
// ==========================================

export async function getProjectDashboardApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/dashboard`, {
    method: 'GET',
  });
}

export async function getPersonalDashboardApi(): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>('/api/dashboard/personal', {
    method: 'GET',
  });
}

// ==========================================
// Organization Users & Member Management
// ==========================================

export async function getOrganizationUsersApi(): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>('/api/users', {
    method: 'GET',
  });
}

export async function getOrganizationMembersApi(): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>('/api/organizations/members', {
    method: 'GET',
  });
}

export async function addOrganizationMemberApi(payload: {
  members: {
    email: string;
    role?: "ADMIN" | "MANAGER" | "TEAMMATE";
  }[];
}): Promise<{ success: boolean; data: any; message?: string }> {
  return request<{ success: boolean; data: any; message?: string }>(
    "/api/organizations/members",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateOrganizationMemberRoleApi(
  userId: string,
  role: string
): Promise<{ success: boolean; data: any; message?: string }> {
  return request<{ success: boolean; data: any; message?: string }>(
    `/api/organizations/members/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }
  );
}

export async function removeOrganizationMemberApi(
  userId: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    `/api/organizations/members/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    }
  );
}

// ==========================================
// Work Item Comments
// ==========================================

export async function getWorkItemCommentsApi(workItemId: string): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>(
    `/api/work-items/${encodeURIComponent(workItemId)}/comments`,
    { method: 'GET' }
  );
}

export async function addWorkItemCommentApi(
  workItemId: string,
  content: string
): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>(
    `/api/work-items/${encodeURIComponent(workItemId)}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
}

// ==========================================
// Work Item Time Tracking
// ==========================================

export async function getWorkItemTimeEntriesApi(workItemId: string): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>(
    `/api/work-items/${encodeURIComponent(workItemId)}/time-entries`,
    { method: 'GET' }
  );
}

export async function addWorkItemTimeEntryApi(
  workItemId: string,
  payload: { hours?: number; durationMinutes?: number; note?: string; date?: string }
): Promise<{ success: boolean; data: any }> {
  const hours = payload.hours !== undefined ? payload.hours : (payload.durationMinutes ? payload.durationMinutes / 60 : 1);
  return request<{ success: boolean; data: any }>(
    `/api/work-items/${encodeURIComponent(workItemId)}/time-entries`,
    {
      method: 'POST',
      body: JSON.stringify({
        hours: Number(hours),
        note: payload.note || '',
        date: payload.date || new Date().toISOString().split('T')[0],
      }),
    }
  );
}

// ==========================================
// Work Item Dependencies
// ==========================================

export async function getWorkItemDependenciesApi(workItemId: string): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>(
    `/api/work-items/${encodeURIComponent(workItemId)}/dependencies`,
    { method: 'GET' }
  );
}

export async function addWorkItemDependencyApi(
  workItemId: string,
  dependsOnWorkItemId: string
): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>(
    `/api/work-items/${encodeURIComponent(workItemId)}/dependencies`,
    {
      method: 'POST',
      body: JSON.stringify({ dependsOnWorkItemId }),
    }
  );
}

export async function deleteWorkItemDependencyApi(
  workItemId: string,
  dependsOnWorkItemId: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    `/api/work-items/${encodeURIComponent(workItemId)}/dependencies/${encodeURIComponent(dependsOnWorkItemId)}`,
    { method: 'DELETE' }
  );
}

// ==========================================
// Project Labels
// ==========================================

export async function getProjectLabelsApi(projectId: string): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/labels`,
    { method: 'GET' }
  );
}

export async function createProjectLabelApi(
  projectId: string,
  payload: { name: string; color?: string; description?: string }
): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>(
    `/api/projects/${encodeURIComponent(projectId)}/labels`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteProjectLabelApi(
  projectId: string,
  labelId: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    `/api/projects/${encodeURIComponent(projectId)}/labels/${encodeURIComponent(labelId)}`,
    { method: 'DELETE' }
  );
}

// ==========================================
// Project Workflow
// ==========================================

export async function getProjectWorkflowApi(projectId: string): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>(
    `/api/projects/${encodeURIComponent(projectId)}/workflow`,
    { method: 'GET' }
  );
}

export async function saveProjectWorkflowApi(
  projectId: string,
  payload: { name?: string; stages?: any[]; statuses?: any[]; transitions?: any; rules?: any }
): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>(
    `/api/projects/${encodeURIComponent(projectId)}/workflow`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

// ==========================================
// Audit Logs
// ==========================================

export async function getProjectAuditLogsApi(projectId: string): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/audit-logs`,
    { method: 'GET' }
  );
}

export async function createAuditLogApi(payload: {
  projectId?: string;
  workItemId?: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
  previousState?: any;
  newState?: any;
  details?: any;
}): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>('/api/projects/audit-logs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function undoAuditLogApi(
  projectId: string,
  logId: string
): Promise<{
  success: boolean;
  message: string;
  data: {
    undoneLogId: string;
    reversalLog: any;
    restoredTask?: any;
  };
}> {
  return request(`/api/projects/${encodeURIComponent(projectId)}/audit-logs/${encodeURIComponent(logId)}/undo`, {
    method: 'POST',
  });
}

// ==========================================
// Notifications
// ==========================================

export async function getUserNotificationsApi(): Promise<{ success: boolean; count: number; data: any[] }> {
  return request<{ success: boolean; count: number; data: any[] }>('/api/notifications', {
    method: 'GET',
  });
}

export async function markNotificationReadApi(notificationId: string): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: 'PATCH' }
  );
}

export async function markAllNotificationsReadApi(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/api/notifications/read-all', {
    method: 'PATCH',
  });
}

export async function createNotificationApi(payload: {
  userId?: string;
  title: string;
  message: string;
  type?: string;
  link?: string;
}): Promise<{ success: boolean; data: any }> {
  return request<{ success: boolean; data: any }>('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ==========================================
// Domain Transformation Helpers
// ==========================================

export function backendStatusToFrontend(backendStatus: string | null | undefined): TaskStatus {
  switch (backendStatus?.toUpperCase()) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'IN_REVIEW': return 'In Review';
    case 'TESTING_QA': return 'Testing / QA';
    case 'BLOCKED': return 'Blocked';
    case 'ON_HOLD': return 'On Hold';
    case 'DONE': return 'Done';
    case 'BACKLOG':
    default:
      return 'Backlog';
  }
}

export function frontendStatusToBackend(frontendStatus: string | null | undefined): string {
  switch (frontendStatus) {
    case 'In Progress': return 'IN_PROGRESS';
    case 'In Review': return 'IN_REVIEW';
    case 'Testing / QA': return 'TESTING_QA';
    case 'Blocked': return 'BLOCKED';
    case 'On Hold': return 'ON_HOLD';
    case 'Done': return 'DONE';
    case 'Backlog':
    default:
      return 'BACKLOG';
  }
}

export function backendTypeToFrontend(backendType: string | null | undefined): WorkItemType {
  switch (backendType?.toUpperCase()) {
    case 'EPIC': return 'Epic';
    case 'STORY': return 'Story';
    case 'SUBTASK': return 'Subtask';
    case 'BUG': return 'Bug';
    case 'TASK':
    default:
      return 'Task';
  }
}

export function frontendTypeToBackend(frontendType: string | null | undefined): string {
  switch (frontendType?.toLowerCase()) {
    case 'epic': return 'EPIC';
    case 'story': return 'STORY';
    case 'subtask': return 'SUBTASK';
    case 'bug': return 'BUG';
    case 'task':
    default:
      return 'TASK';
  }
}

export function backendPriorityToFrontend(priority: string | null | undefined): Priority {
  switch (priority?.toUpperCase()) {
    case 'HIGH':
    case 'URGENT': return 'High';
    case 'LOW': return 'Low';
    case 'MEDIUM':
    default:
      return 'Medium';
  }
}

export function frontendPriorityToBackend(priority: Priority | null | undefined): string {
  switch (priority) {
    case 'High': return 'HIGH';
    case 'Low': return 'LOW';
    case 'Medium':
    default:
      return 'MEDIUM';
  }
}

export function normalizeRole(backendRole: string | null | undefined): Role {
  if (!backendRole) return 'Teammate';
  const upper = backendRole.toUpperCase();
  if (upper === 'ADMIN') return 'Admin';
  if (upper === 'MANAGER' || upper === 'LEAD') return 'Manager';
  return 'Teammate';
}

export function toBackendRole(frontendRole: Role | string | null | undefined): string {
  if (frontendRole === 'Admin') return 'ADMIN';
  if (frontendRole === 'Manager') return 'MANAGER';
  return 'TEAMMATE';
}

export function backendWorkItemToTask(item: any, currentProjectId: string): Task {
  const status = backendStatusToFrontend(item.status);
  const type = backendTypeToFrontend(item.type);
  const priority = backendPriorityToFrontend(item.priority);
  const dueDate = item.dueDate
    ? (typeof item.dueDate === 'string'
        ? item.dueDate.split('T')[0]
        : new Date(item.dueDate).toISOString().split('T')[0])
    : null;

  const assigneeId =
    item.assigneeId ||
    (Array.isArray(item.assignments) && item.assignments[0]?.userId) ||
    (Array.isArray(item.assignees) && item.assignees[0]?.userId) ||
    null;

  const assigneeIds = Array.isArray(item.assignments)
    ? item.assignments.map((a: any) => a.userId)
    : (Array.isArray(item.assignees)
        ? item.assignees.map((a: any) => a.userId)
        : (item.assigneeIds || (assigneeId ? [assigneeId] : [])));

  let assignees: any[] = [];
  if (Array.isArray(item.assignees) && item.assignees.length > 0) {
    assignees = item.assignees.map((u: any) => ({
      id: u.id || u.userId,
      name: u.fullName || u.name || u.email || 'User',
      fullName: u.fullName || u.name || u.email || 'User',
      email: u.email || '',
      role: u.role || 'Teammate',
    }));
  } else if (Array.isArray(item.assignments) && item.assignments.length > 0) {
    assignees = item.assignments
      .map((a: any) => {
        const u = a.user;
        if (!u) return null;
        return {
          id: u.id,
          name: u.fullName || u.name || u.email || 'User',
          fullName: u.fullName || u.name || u.email || 'User',
          email: u.email || '',
          role: u.role || 'Teammate',
        };
      })
      .filter(Boolean);
  }

  return {
    id: item.id,
    projectId: item.projectId || currentProjectId,
    parentId: item.parentWorkItemId || null,
    title: item.title,
    description: item.description || '',
    type,
    status,
    priority,
    dueDate,
    slaStatus: item.sla?.status || item.slaStatus || null,
    sla: item.sla
      ? {
          ...item.sla,
          deadline: item.sla.deadline || item.slaDeadline || null,
          isBreached: item.sla.status === 'BREACHED' || Boolean(item.sla.breachedAt),
          isApproaching: item.sla.status === 'AT_RISK',
          isEscalated: Boolean(item.sla.isEscalated || item.escalatedAt),
          hoursRemaining: item.sla.remainingHours ?? null,
        }
      : item.slaDeadline
        ? {
            status: item.slaStatus,
            deadline: item.slaDeadline,
            isBreached: item.slaStatus === 'BREACHED',
            isApproaching: item.slaStatus === 'AT_RISK',
            isEscalated: Boolean(item.escalatedAt),
            hoursRemaining: null,
          }
        : undefined,
    startDate: item.startDate || null,
    assigneeId,
    assigneeIds,
    assignees,
    sprintId: item.sprintId || null,
    creatorId: item.createdById || item.creatorId,
    labels: Array.isArray(item.labels)
      ? item.labels.map((l: any) => (typeof l === 'string' ? l : l.name || l.id))
      : [],
    dependencies: Array.isArray(item.dependencies)
      ? item.dependencies.map((d: any) => d.dependsOnWorkItemId || d.id || d)
      : (Array.isArray(item.dependencyIds) ? item.dependencyIds : []),
    dependencyIds: Array.isArray(item.dependencies)
      ? item.dependencies.map((d: any) => d.dependsOnWorkItemId || d.id || d)
      : (Array.isArray(item.dependencyIds) ? item.dependencyIds : []),
    subtasks: Array.isArray(item.children)
      ? item.children.map((c: any) => ({
          id: c.id,
          title: c.title,
          completed: c.status === 'DONE' || c.status === 'Done',
          assigneeId: c.assigneeId || null,
        }))
      : (item.subtasks || []),
    comments: Array.isArray(item.comments)
      ? item.comments.map((c: any) => ({
          id: c.id,
          userId: c.authorId || c.userId,
          authorId: c.authorId || c.userId,
          text: c.body || c.content || c.text || '',
          body: c.body || c.content || c.text || '',
          createdAt: c.createdAt || new Date().toISOString(),
        }))
      : (item.comments || []),
    timeEntries: Array.isArray(item.timeEntries)
      ? item.timeEntries.map((te: any) => ({
          id: te.id,
          userId: te.userId,
          hours: te.hours !== undefined ? Number(te.hours) : (te.durationMinutes ? te.durationMinutes / 60 : 0),
          durationMinutes: te.durationMinutes !== undefined ? te.durationMinutes : (te.hours ? Math.round(Number(te.hours) * 60) : 0),
          date: te.date,
          startTime: te.date || te.createdAt,
          note: te.note || te.description || '',
          description: te.note || te.description || '',
        }))
      : (item.timeEntries || []),
    recurrenceRule: item.recurrence
      ? {
          frequency: item.recurrence.frequency?.toLowerCase() || 'none',
          interval: item.recurrence.interval || 1,
          startsOn: item.recurrence.startsOn,
          endsOn: item.recurrence.endsOn,
        }
      : { frequency: 'none' },
    version: item.version || 1,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    attachments: Array.isArray(item.attachments)
      ? item.attachments.map((att: any) => ({
          id: att.id,
          name: att.originalName || att.name || 'attachment',
          size: Number(att.size) || 0,
          type: att.mimeType || att.type || 'application/octet-stream',
          url: att.url || (att.storageKey ? `/api/attachments/${att.id}/file` : ''),
          blobKey: att.blobKey || att.id,
          uploadedAt: att.createdAt || att.uploadedAt || new Date().toISOString(),
        }))
      : (item.attachments || []),
  };
}

export function backendProjectToFrontend(proj: any): Project {
  const memberIds: string[] = [];
  const memberRoles: Record<string, Role> = {};

  if (Array.isArray(proj.memberships)) {
    for (const m of proj.memberships) {
      if (m.userId) {
        memberIds.push(m.userId);
        memberRoles[m.userId] = normalizeRole(m.role);
      }
    }
  }

  return {
    id: proj.id,
    name: proj.name,
    projectKey: proj.key || proj.projectKey || (typeof proj.id === 'string' ? proj.id.slice(0, 8).toUpperCase() : 'PRJ'),
    description: proj.description || '',
    color: proj.color || '#4F46E5',
    ownerId: proj.createdById || proj.ownerId || '',
    memberIds: memberIds.length > 0 ? memberIds : [proj.createdById || 'user-1'],
    memberRoles,
    visibility: proj.visibility?.toLowerCase() === 'public' ? 'global' : 'private',
    status: proj.status || 'On Track',
    startDate: proj.startDate || '',
    dueDate: proj.endDate || proj.dueDate || '',
    sections: proj.sections || [
      { id: 'sec-1', name: 'Discovery & Plan', order: 1 },
      { id: 'sec-2', name: 'Execution', order: 2 },
      { id: 'sec-3', name: 'Review & Launch', order: 3 },
    ],
    settings: proj.settings || { slaHighHours: 24, slaMediumHours: 48, allowWeekendWork: false },
    createdAt: proj.createdAt || new Date().toISOString(),
    updatedAt: proj.updatedAt || new Date().toISOString(),
  };
}

export function backendSprintToFrontend(sprint: any): Sprint {
  return {
    id: sprint.id,
    projectId: sprint.projectId,
    name: sprint.name,
    goal: sprint.goal || null,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprint.status,
    workItemIds: Array.isArray(sprint.workItems)
      ? sprint.workItems.map((w: any) => w.id)
      : (sprint.workItemIds || []),
    createdById: sprint.createdById,
    createdAt: sprint.createdAt || new Date().toISOString(),
    updatedAt: sprint.updatedAt || new Date().toISOString(),
  };
}
