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
  SprintStatus,
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
    ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: 'Bearer active_session' }),
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !options._retry) {
      options._retry = true;
      const newToken = await executeTokenRefresh();

      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, { ...options, headers });
        if (!retryResponse.ok) {
          const errData = await retryResponse.json().catch(() => ({}));
          throw new ApiError(
            errData.message || `HTTP ${retryResponse.status}`,
            retryResponse.status,
            errData.code,
            errData
          );
        }
        return retryResponse.json();
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new ApiError(
        errData.message || `HTTP ${response.status}`,
        response.status,
        errData.code,
        errData
      );
    }

    return response.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err?.message || 'Network request failed', 0, 'SERVER_UNREACHABLE');
  }
}

// Health Check
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await request<{ status: string }>('/health', { method: 'GET' });
    return res?.status === 'ok' || res?.status === 'UP';
  } catch {
    return false;
  }
}

// Auth & Users
export interface RegisterOrganizationInput {
  organizationName: string;
  adminName: string;
  email: string;
  password?: string;
}

export interface RegisterOrganizationResponse {
  user: any;
  organization: any;
  token?: string;
}

export async function registerOrganizationApi(
  payload: RegisterOrganizationInput
): Promise<RegisterOrganizationResponse> {
  const res = await request<RegisterOrganizationResponse>('/api/users/register', {
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
  password?: string;
}

export interface LoginResponse {
  user: any;
  organization: any;
  token?: string;
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

export async function currentUserApi(): Promise<any> {
  return request<any>('/api/users/me', { method: 'GET' });
}

export async function refreshTokenApi(): Promise<any> {
  return executeTokenRefresh();
}

export async function logoutApi(): Promise<any> {
  try {
    return await request<any>('/api/users/logout', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
}

export interface InviteMemberApiInput {
  email: string;
  role?: string;
}

export async function inviteOrganizationMembersApi(
  invitations: InviteMemberApiInput[]
): Promise<any> {
  return request<any>('/api/users/invite', {
    method: 'POST',
    body: JSON.stringify({ invitations }),
  });
}

export async function acceptInvitationApi(token: string, payload: any): Promise<any> {
  return request<any>(`/api/users/accept-invitation?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getOrganizationUsersApi(): Promise<any> {
  return request<any>('/api/users', { method: 'GET' });
}

export async function getOrganizationMembersApi(): Promise<any> {
  return request<any>('/api/organization/members', { method: 'GET' });
}

export async function addOrganizationMemberApi(payload: any): Promise<any> {
  return request<any>('/api/organization/members', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrganizationMemberRoleApi(
  memberId: string,
  role: string
): Promise<any> {
  return request<any>(`/api/organization/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removeOrganizationMemberApi(memberId: string): Promise<any> {
  return request<any>(`/api/organization/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

// Projects & Members
export interface CreateProjectApiInput {
  name: string;
  key?: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  visibility?: 'PUBLIC' | 'PRIVATE';
}

export async function getProjectsApi(): Promise<any> {
  return request<any>('/api/projects', { method: 'GET' });
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

export async function getProjectMembersApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'GET',
  });
}

export async function addProjectMemberApi(
  projectId: string,
  member: { memberId: string; role?: string }
): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'POST',
    body: JSON.stringify(member),
  });
}

export async function removeProjectMemberApi(projectId: string, userId: string): Promise<any> {
  return request<any>(
    `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
}

export async function updateProjectMemberRoleApi(
  projectId: string,
  userId: string,
  role: string
): Promise<any> {
  return request<any>(
    `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }
  );
}

// Work Items
export interface CreateWorkItemApiInput {
  projectId: string;
  sprintId?: string | null;
  parentWorkItemId?: string | null;
  type: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  status?: string;
  dueDate?: string | null;
  assignees?: Array<{ userId: string; startDate?: string | null; endDate?: string | null }>;
}

export async function getProjectWorkItemsApi(
  projectId: string,
  page = 1,
  limit = 100,
  type?: string
): Promise<any> {
  let url = `/api/work-items/project/${encodeURIComponent(projectId)}?page=${page}&limit=${limit}`;
  if (type) {
    url += `&type=${encodeURIComponent(type)}`;
  }
  return request<any>(url, { method: 'GET' });
}

export async function createWorkItemApi(payload: CreateWorkItemApiInput): Promise<any> {
  return request<any>('/api/work-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Uploads attachment files for a specific work item using multipart FormData.
 */
export async function uploadWorkItemAttachmentsApi(
  workItemId: string,
  files: File[]
): Promise<any> {
  const token = getAuthToken();
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('attachments', file);
  });

  const response = await fetch(
    `${API_BASE_URL.replace(/\/+$/, '')}/api/work-items/${encodeURIComponent(workItemId)}/attachments`,
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: 'Bearer active_session' }),
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || `Attachment upload failed with status ${response.status}`,
      response.status,
      errorData.code,
      errorData
    );
  }

  return response.json();
}

export async function updateWorkItemApi(workItemId: string, updates: any): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function escalateWorkItemApi(workItemId: string, reason?: string): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/escalate`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function deleteWorkItemApi(workItemId: string): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}`, {
    method: 'DELETE',
  });
}

// Sprints
export interface CreateSprintApiInput {
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  workItemIds?: string[];
}

export async function getProjectSprintsApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/sprints`, {
    method: 'GET',
  });
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

// Dashboards
export async function getProjectDashboardApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/dashboard`, {
    method: 'GET',
  });
}

export async function getPersonalDashboardApi(): Promise<any> {
  return request<any>('/api/dashboard/personal', { method: 'GET' });
}

// Comments, Time Entries & Dependencies
export async function getWorkItemCommentsApi(workItemId: string): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/comments`, {
    method: 'GET',
  });
}

export async function addWorkItemCommentApi(workItemId: string, text: string): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function getWorkItemTimeEntriesApi(workItemId: string): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/time-entries`, {
    method: 'GET',
  });
}

export async function addWorkItemTimeEntryApi(
  workItemId: string,
  entry: { hours: number; durationMinutes?: number; note?: string; date?: string }
): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/time-entries`, {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function getWorkItemDependenciesApi(workItemId: string): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/dependencies`, {
    method: 'GET',
  });
}

export async function addWorkItemDependencyApi(
  workItemId: string,
  dependsOnWorkItemId: string
): Promise<any> {
  return request<any>(`/api/work-items/${encodeURIComponent(workItemId)}/dependencies`, {
    method: 'POST',
    body: JSON.stringify({ dependsOnWorkItemId }),
  });
}

export async function deleteWorkItemDependencyApi(
  workItemId: string,
  dependsOnWorkItemId: string
): Promise<any> {
  return request<any>(
    `/api/work-items/${encodeURIComponent(workItemId)}/dependencies/${encodeURIComponent(dependsOnWorkItemId)}`,
    { method: 'DELETE' }
  );
}

// Labels & Workflow
export async function getProjectLabelsApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/labels`, {
    method: 'GET',
  });
}

export async function createProjectLabelApi(projectId: string, payload: any): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/labels`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectLabelApi(projectId: string, labelId: string): Promise<any> {
  return request<any>(
    `/api/projects/${encodeURIComponent(projectId)}/labels/${encodeURIComponent(labelId)}`,
    { method: 'DELETE' }
  );
}

export async function getProjectWorkflowApi(projectId: string): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/workflow`, {
    method: 'GET',
  });
}

export async function saveProjectWorkflowApi(projectId: string, payload: any): Promise<any> {
  return request<any>(`/api/projects/${encodeURIComponent(projectId)}/workflow`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Audit Logs
export interface AuditPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GetProjectAuditLogsResponse {
  data: any[];
  meta?: AuditPaginationMeta;
}

export async function getProjectAuditLogsApi(
  projectId: string
): Promise<GetProjectAuditLogsResponse> {
  return request<GetProjectAuditLogsResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/audit-logs`,
    { method: 'GET' }
  );
}

export async function createAuditLogApi(payload: any): Promise<any> {
  return request<any>('/api/projects/audit-logs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function undoAuditLogApi(projectId: string, auditId: string): Promise<any> {
  return request<any>(
    `/api/projects/${encodeURIComponent(projectId)}/audit-logs/${encodeURIComponent(auditId)}/undo`,
    { method: 'POST' }
  );
}

// Notifications
export async function getUserNotificationsApi(): Promise<any> {
  return request<any>('/api/notifications', { method: 'GET' });
}

export async function markNotificationReadApi(notifId: string): Promise<any> {
  return request<any>(`/api/notifications/${encodeURIComponent(notifId)}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsReadApi(): Promise<any> {
  return request<any>('/api/notifications/read-all', { method: 'PATCH' });
}

export async function createNotificationApi(payload: any): Promise<any> {
  return request<any>('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Chat / Messaging
export interface ChatConversation {
  id: string;
  type: 'DIRECT' | 'CHANNEL' | 'PROJECT';
  name?: string;
  projectId?: string;
  updatedAt: string;
  members: Array<{ userId: string; user?: any }>;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: any;
}

export async function getChatConversationsApi(): Promise<any> {
  return request<any>('/api/chat/conversations', { method: 'GET' });
}

export async function createChatConversationApi(payload: {
  type: 'DIRECT' | 'CHANNEL' | 'PROJECT';
  name?: string;
  projectId?: string;
  recipientUserIds?: string[];
}): Promise<any> {
  return request<any>('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getChatMessagesApi(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<any> {
  let url = `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`;
  if (before) url += `&before=${encodeURIComponent(before)}`;
  return request<any>(url, { method: 'GET' });
}

// Helpers & Converters
export function isPersistedWorkItemId(id?: string | null): boolean {
  if (!id) return false;
  return !id.startsWith('tf-') && !id.startsWith('sub-') && !id.startsWith('att-');
}

export function frontendStatusToBackend(status: string): string {
  switch (status) {
    case 'In Progress': return 'IN_PROGRESS';
    case 'In Review': return 'IN_REVIEW';
    case 'Done': return 'DONE';
    case 'Backlog':
    default:
      return 'BACKLOG';
  }
}

export function backendStatusToFrontend(status?: string | null): TaskStatus {
  switch (status?.toUpperCase()) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'IN_REVIEW': return 'In Review';
    case 'DONE': return 'Done';
    case 'BACKLOG':
    default:
      return 'Backlog';
  }
}

export function frontendTypeToBackend(type: WorkItemType | string): string {
  switch (type) {
    case 'Epic': return 'EPIC';
    case 'Story': return 'STORY';
    case 'Bug': return 'BUG';
    case 'Subtask': return 'SUBTASK';
    case 'Task':
    default:
      return 'TASK';
  }
}

export function backendTypeToFrontend(type?: string | null): WorkItemType {
  switch (type?.toUpperCase()) {
    case 'EPIC': return 'Epic';
    case 'STORY': return 'Story';
    case 'BUG': return 'Bug';
    case 'SUBTASK': return 'Subtask';
    case 'TASK':
    default:
      return 'Task';
  }
}

export function backendPriorityToFrontend(priority?: string | null): Priority {
  switch (priority?.toUpperCase()) {
    case 'HIGH':
    case 'URGENT': return 'High';
    case 'LOW': return 'Low';
    case 'MEDIUM':
    default:
      return 'Medium';
  }
}

export function frontendPriorityToBackend(priority?: Priority | string | null): string | null {
  if (!priority) return null;
  const upper = String(priority).toUpperCase();
  if (['HIGH', 'MEDIUM', 'LOW', 'URGENT'].includes(upper)) {
    return upper;
  }
  return null;
}

export function normalizeRole(backendRole?: string | null): Role {
  switch (backendRole?.toUpperCase()) {
    case 'ADMIN': return 'Admin';
    case 'MANAGER': return 'Manager';
   
    case 'TEAMMATE':
    default:
      return 'Teammate';
  }
}

export function toBackendRole(role?: Role | string | null): string {
  switch (role) {
    case 'Admin': return 'ADMIN';
    case 'Manager': return 'MANAGER';
    case 'Guest': return 'GUEST';
    case 'Teammate':
    default:
      return 'TEAMMATE';
  }
}

export function toBackendProjectRole(role?: Role | string | null): string {
  return toBackendRole(role);
}

export function backendWorkItemToTask(item: any, fallbackProjectId?: string): Task {
  return {
    id: item.id,
    projectId: item.projectId || fallbackProjectId || '',
    sprintId: item.sprintId || null,
    parentId: item.parentWorkItemId || item.parentId || null,
    type: backendTypeToFrontend(item.type),
    title: item.title || 'Untitled Task',
    description: item.description || '',
    status: backendStatusToFrontend(item.status),
    priority: backendPriorityToFrontend(item.priority),
    assigneeId: item.assignees?.[0]?.userId || item.assigneeId || null,
    assigneeIds: item.assignees ? item.assignees.map((a: any) => a.userId) : [],
    creatorId: item.creatorId || '',
    startDate: item.startDate || null,
    dueDate: item.dueDate || null,
    estimateHours: item.estimateHours ? Number(item.estimateHours) : null,
    actualHours: item.actualHours ? Number(item.actualHours) : 0,
    dependencyIds: Array.isArray(item.dependencies)
      ? item.dependencies.map((d: any) => d.dependsOnWorkItemId || d.id)
      : [],
    labels: Array.isArray(item.labels) ? item.labels.map((l: any) => l.name || l) : [],
    subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
    comments: Array.isArray(item.comments) ? item.comments : [],
    timeEntries: Array.isArray(item.timeEntries) ? item.timeEntries : [],
    recurrenceRule: item.recurrenceRule || { frequency: 'none' },
    sla: item.sla || { isBreached: false, isApproaching: false, isEscalated: false },
    version: item.version ? Number(item.version) : 1,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    attachments: Array.isArray(item.attachments)
      ? item.attachments.map((att: any) => ({
          id: att.id,
          name: att.originalName || att.name || 'attachment',
          size: Number(att.size) || 0,
          type: att.mimeType || att.type || 'application/octet-stream',
          url: att.url || att.storageKey || '',
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
    name: proj.name || 'Untitled Project',
    projectKey: proj.key || proj.projectKey || proj.id.slice(0, 8).toUpperCase(),
    description: proj.description || '',
    visibility: proj.visibility === 'PUBLIC' ? 'global' : 'private',
    status: 'On Track',
    color: proj.color || '#7465F6',
    ownerId: proj.ownerId || memberIds[0] || '',
    memberIds,
    memberRoles,
    startDate: proj.startDate || '',
    dueDate: proj.endDate || proj.dueDate || '',
    workflowId: proj.workflowId || `wf-${proj.id}`,
    sections: proj.sections || [
      { id: `sec-${proj.id}-1`, name: 'Discovery & Plan', order: 1 },
      { id: `sec-${proj.id}-2`, name: 'Execution', order: 2 },
      { id: `sec-${proj.id}-3`, name: 'Review & Launch', order: 3 },
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
    goal: sprint.goal || '',
    status: (sprint.status || 'Planned').toUpperCase() as SprintStatus,
    startDate: sprint.startDate || '',
    endDate: sprint.endDate || '',
    workItemIds: Array.isArray(sprint.workItems)
      ? sprint.workItems.map((w: any) => w.id || w)
      : Array.isArray(sprint.workItemIds)
        ? sprint.workItemIds
        : [],
    createdAt: sprint.createdAt || new Date().toISOString(),
    updatedAt: sprint.updatedAt || new Date().toISOString(),
  };
}