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
  User,
} from '../types';

export const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3000';

export const AUTH_TOKEN_KEY = 'taskflow_auth_token';

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
  } catch {}
  return null;
}

export function setAuthToken(token: string): void {
  memoryToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  } catch {}
}

export function clearAuthToken(): void {
  memoryToken = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {}
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
      return getAuthToken();
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
    ...(token && token !== 'active_session' ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });

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
  user: {
    fullName: string;
    email: string;
    password: string;
  };
  organization: {
    name: string;
  };
}

export interface RegisterOrganizationResponse {
  user: any;
  organization: any;
  token?: string;
  organizationId?: string;
  userId?: string;
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

export async function requestPasswordResetApi(email: string): Promise<{ message: string }> {
  return request<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordApi(payload: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
  const canonicalRole = toBackendRole(role as Role) || role.toUpperCase();
  return request<any>(`/api/organization/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: canonicalRole }),
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

export interface WhiteboardScene {
  elements: readonly Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WhiteboardSummary {
  id: string;
  projectId: string;
  name: string;
  revision: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Whiteboard extends WhiteboardSummary {
  sceneData: WhiteboardScene;
}

export interface WhiteboardRevision {
  id: string;
  whiteboardId: string;
  revisionNumber: number;
  createdById: string | null;
  sceneSnapshot: WhiteboardScene;
  changeSummary: string | null;
  createdAt: string;
}

export async function createWhiteboardApi(projectId: string, name: string): Promise<{ data: Whiteboard }> {
  return request(`/api/projects/${encodeURIComponent(projectId)}/whiteboards`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function listWhiteboardsApi(
  projectId: string,
  page = 1,
  limit = 25
): Promise<{ data: { items: WhiteboardSummary[]; pagination: { page: number; limit: number; total: number; pages: number } } }> {
  return request(`/api/projects/${encodeURIComponent(projectId)}/whiteboards?page=${page}&limit=${limit}`, {
    method: 'GET',
  });
}

export async function getWhiteboardApi(whiteboardId: string): Promise<{ data: Whiteboard }> {
  return request(`/api/whiteboards/${encodeURIComponent(whiteboardId)}`, { method: 'GET' });
}

export async function listWhiteboardRevisionsApi(
  whiteboardId: string,
  page = 1,
  limit = 25
): Promise<{ data: { items: WhiteboardRevision[]; pagination: { page: number; limit: number; total: number; pages: number } } }> {
  return request(`/api/whiteboards/${encodeURIComponent(whiteboardId)}/revisions?page=${page}&limit=${limit}`, {
    method: 'GET',
  });
}

export async function getWhiteboardRevisionApi(
  whiteboardId: string,
  revisionNumber: number
): Promise<{ data: WhiteboardRevision }> {
  return request(`/api/whiteboards/${encodeURIComponent(whiteboardId)}/revisions/${revisionNumber}`, { method: 'GET' });
}

export async function updateWhiteboardApi(
  whiteboardId: string,
  payload: { sceneData: WhiteboardScene; revision: number }
): Promise<{ data: Whiteboard }> {
  return request(`/api/whiteboards/${encodeURIComponent(whiteboardId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function renameWhiteboardApi(whiteboardId: string, name: string): Promise<{ data: WhiteboardSummary }> {
  return request(`/api/whiteboards/${encodeURIComponent(whiteboardId)}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteWhiteboardApi(whiteboardId: string): Promise<{ data: { id: string } }> {
  return request(`/api/whiteboards/${encodeURIComponent(whiteboardId)}`, { method: 'DELETE' });
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
  plannedStartDate?: string | null;
  plannedDurationWorkingDays?: number | null;
  assignees?: Array<{ userId: string; startDate?: string | null; endDate?: string | null }>;
  labelId?: string | null;
  labels?: string[];
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
      credentials: 'include',
      headers: {
        ...(token && token !== 'active_session' ? { Authorization: `Bearer ${token}` } : {}),
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
    method: 'PATCH',
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
  dependencyIdentifier: string
): Promise<any> {
  return request<any>(
    `/api/work-items/${encodeURIComponent(workItemId)}/dependencies/${encodeURIComponent(dependencyIdentifier)}`,
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
  success: boolean;
  data: any[];
  pagination?: AuditPaginationMeta;
}

export async function getProjectAuditLogsApi(
  projectId: string,
  page?: number,
  limit?: number
): Promise<GetProjectAuditLogsResponse> {
  const query = new URLSearchParams();
  if (page !== undefined && page !== null) {
    query.set('page', String(page));
  }
  if (limit !== undefined && limit !== null) {
    query.set('limit', String(limit));
  }
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return request<GetProjectAuditLogsResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/audit-logs${queryString}`,
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
  try {
    return await request<any>('/api/notifications', { method: 'GET' });
  } catch (err: any) {
    console.warn('TaskFlow: Non-blocking notifications fetch failure:', err.message);
    return { success: false, count: 0, data: [] };
  }
}

export async function markNotificationReadApi(notifId: string): Promise<any> {
  try {
    return await request<any>(`/api/notifications/${encodeURIComponent(notifId)}/read`, {
      method: 'PATCH',
    });
  } catch (err: any) {
    console.warn('TaskFlow: Non-blocking mark notification read notice:', err.message);
    return { success: false };
  }
}

export async function markAllNotificationsReadApi(): Promise<any> {
  try {
    return await request<any>('/api/notifications/read-all', { method: 'PATCH' });
  } catch (err: any) {
    console.warn('TaskFlow: Non-blocking mark all notifications read notice:', err.message);
    return { success: false };
  }
}

export async function createNotificationApi(payload: any): Promise<any> {
  return request<any>('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// SLA Settings
export interface OrganizationSlaPolicy {
  id?: string;
  organizationId?: string;
  urgentHours?: number;
  highHours: number;
  mediumHours: number;
  lowHours: number;
  escalateHours: number;
  warningThresholdHours?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function getOrganizationSlaApi(): Promise<{ success: boolean; data: OrganizationSlaPolicy }> {
  return request<{ success: boolean; data: OrganizationSlaPolicy }>('/api/sla', { method: 'GET' });
}

export async function updateOrganizationSlaApi(
  payload: Partial<OrganizationSlaPolicy>
): Promise<{ success: boolean; message: string; data: OrganizationSlaPolicy }> {
  return request<{ success: boolean; message: string; data: OrganizationSlaPolicy }>('/api/sla', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Chat / Messaging
export interface ChatConversationMember {
  userId: string;
  lastReadAt?: string | null;
  user?: {
    id: string;
    fullName?: string | null;
    email: string;
    role?: string;
    status?: string;
    [key: string]: any;
  };
}

export interface ChatParticipant {
  id: string;
  fullName?: string | null;
  email: string;
}

export interface ChatLastMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
}

export interface ChatConversation {
  id: string;
  type: 'DIRECT' | 'CHANNEL' | 'PROJECT';
  name?: string | null;
  projectId?: string | null;
  organizationId?: string | null;
  updatedAt: string;
  createdAt?: string;
  members: ChatConversationMember[];
  otherParticipant?: ChatParticipant | null;
  lastMessage?: ChatLastMessage | null;
  unreadCount?: number;
  lastReadAt?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    fullName?: string | null;
    email: string;
    role?: string;
    [key: string]: any;
  } | null;
}

export async function getChatConversationsApi(): Promise<any> {
  return request<any>('/api/chat/conversations', { method: 'GET' });
}

export async function createChatConversationApi(payload: {
  type: 'DIRECT' | 'CHANNEL' | 'PROJECT';
  name?: string | null;
  projectId?: string | null;
  organizationId?: string;
  participantId?: string;
  memberIds?: string[];
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
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

export function isPersistedWorkItemId(id?: string | null): boolean {
  return isUuid(id);
}

export function toUserFriendlyErrorMessage(
  err: any,
  fallbackMessage: string = 'An error occurred. Please try again.'
): string {
  if (!err) return fallbackMessage;

  const raw = String(err?.message || err?.details?.message || err || '').trim();

  // Check for raw database, SQL, TypeORM, or internal exception patterns
  const isRawDbError =
    /invalid input syntax for type uuid/i.test(raw) ||
    /invalid.*uuid/i.test(raw) ||
    /syntax error at or near/i.test(raw) ||
    /relation ".*" does not exist/i.test(raw) ||
    /column ".*" does not exist/i.test(raw) ||
    /violates foreign key constraint/i.test(raw) ||
    /violates not-null constraint/i.test(raw) ||
    /violates check constraint/i.test(raw) ||
    /duplicate key/i.test(raw) ||
    /deadlock detected/i.test(raw) ||
    /QueryFailedError/i.test(raw) ||
    /TypeORM/i.test(raw) ||
    /SELECT |INSERT |UPDATE |DELETE |FROM |WHERE /i.test(raw) ||
    /node:internal/i.test(raw) ||
    /at (?:async )?[A-Za-z0-9_.]+\s*\(/i.test(raw) ||
    raw === 'Internal Server Error' ||
    raw === 'INTERNAL_SERVER_ERROR';

  if (isRawDbError) {
    if (/uuid/i.test(raw)) {
      return 'The requested identifier is invalid or not yet saved.';
    }
    if (/duplicate key|unique constraint/i.test(raw)) {
      return 'A conflict occurred with an existing record.';
    }
    if (/foreign key/i.test(raw)) {
      return 'The referenced item was not found or is no longer available.';
    }
    return fallbackMessage;
  }

  // Strip technical prefix like "error: " or "Error: "
  const cleaned = raw.replace(/^error:\s*/i, '');
  return cleaned || fallbackMessage;
}

export function frontendStatusToBackend(status: string): string {
  switch (status) {
    case 'In Progress': return 'IN_PROGRESS';
    case 'In Review': return 'IN_REVIEW';
    case 'Testing / QA': return 'TESTING_QA';
    case 'Blocked': return 'BLOCKED';
    case 'Done': return 'DONE';
    case 'On Hold': return 'ON_HOLD';
    case 'Backlog': return 'BACKLOG';
    default: {
      const upper = String(status || '').toUpperCase().replace(/[\s\/-]+/g, '_');
      if (['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING_QA', 'BLOCKED', 'DONE', 'ON_HOLD'].includes(upper)) {
        return upper;
      }
      console.warn(`[TaskFlow API] Unknown task status "${status}", falling back to BACKLOG`);
      return 'BACKLOG';
    }
  }
}

export function backendStatusToFrontend(status?: string | null): TaskStatus {
  switch (status?.toUpperCase()) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'IN_REVIEW': return 'In Review';
    case 'TESTING_QA': return 'Testing / QA';
    case 'BLOCKED': return 'Blocked';
    case 'DONE': return 'Done';
    case 'ON_HOLD': return 'On Hold';
    case 'BACKLOG': return 'Backlog';
    default: {
      if (status) {
        console.warn(`[TaskFlow API] Unrecognized backend status "${status}", falling back to Backlog`);
      }
      return 'Backlog';
    }
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
    case 'MANAGER':
    case 'LEAD': return 'Manager';
    case 'TEAMMATE':
    case 'MEMBER':
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
  switch (role) {
    case 'Admin': return 'ADMIN';
    case 'Manager': return 'LEAD';
    case 'Teammate':
    default:
      return 'MEMBER';
  }
}

export function backendWorkItemToTask(item: any, fallbackProjectId?: string): Task {
  if (!item) return {} as Task;

  const entity = item.workItem || item;
  const assignments = item.assignments || entity.assignments;
  const rawAssignees = item.assignees || entity.assignees;

  let assigneeIds: string[] = [];
  let assignees: User[] = [];

  if (Array.isArray(item.assigneeIds) && item.assigneeIds.length > 0) {
    assigneeIds = item.assigneeIds;
  } else if (Array.isArray(entity.assigneeIds) && entity.assigneeIds.length > 0) {
    assigneeIds = entity.assigneeIds;
  } else if (Array.isArray(assignments) && assignments.length > 0) {
    assigneeIds = assignments
      .map((a: any) => a.userId || a.user?.id || a.id)
      .filter((id: any): id is string => typeof id === 'string' && id.length > 0);
  } else if (Array.isArray(rawAssignees) && rawAssignees.length > 0) {
    assigneeIds = rawAssignees
      .map((a: any) => (typeof a === 'string' ? a : a.userId || a.id))
      .filter((id: any): id is string => typeof id === 'string' && id.length > 0);
  } else if (item.assigneeId || entity.assigneeId) {
    const single = item.assigneeId || entity.assigneeId;
    if (typeof single === 'string' && single.length > 0) assigneeIds = [single];
  }

  if (Array.isArray(assignments) && assignments.length > 0) {
    assignees = assignments
      .map((a: any) => {
        const u = a.user || a;
        if (!u || typeof u !== 'object') return null;
        return {
          id: a.userId || u.id,
          name: u.fullName || u.name || u.email?.split('@')[0] || 'Member',
          email: u.email || '',
          role: normalizeRole(u.role),
          initials: (u.fullName || u.name || u.email || 'M').slice(0, 2).toUpperCase(),
        } as User;
      })
      .filter((u): u is User => Boolean(u && u.id));
  } else if (Array.isArray(rawAssignees) && rawAssignees.length > 0) {
    assignees = rawAssignees
      .map((a: any) => {
        if (!a || typeof a !== 'object') return null;
        const u = a.user || a;
        return {
          id: a.userId || u.id,
          name: u.fullName || u.name || u.email?.split('@')[0] || 'Member',
          email: u.email || '',
          role: normalizeRole(u.role),
          initials: (u.fullName || u.name || u.email || 'M').slice(0, 2).toUpperCase(),
        } as User;
      })
      .filter((u): u is User => Boolean(u && u.id));
  }

  const primaryAssigneeId =
    assigneeIds[0] ||
    item.assigneeId ||
    entity.assigneeId ||
    null;

  let labels: string[] = [];
  const rawLabels = item.labels || entity.labels;
  const singleLabel = item.label || entity.label;

  if (Array.isArray(rawLabels) && rawLabels.length > 0) {
    labels = rawLabels
      .map((l: any) => (typeof l === 'string' ? l : l.name || l.title || l.id))
      .filter((name: any): name is string => typeof name === 'string' && name.length > 0);
  } else if (singleLabel) {
    const labelName = typeof singleLabel === 'string' ? singleLabel : singleLabel.name;
    if (labelName) labels = [labelName];
  }

  const rawDueDate = entity.dueDate || item.dueDate || null;
  const dueDate = (() => {
    if (!rawDueDate) return null;
    if (typeof rawDueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate)) {
      return rawDueDate;
    }
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(rawDueDate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  })();
  const plannedStartDate =
    entity.plannedStartDate || item.plannedStartDate || entity.startDate || item.startDate || null;

  return {
    id: entity.id || item.id,
    projectId: entity.projectId || item.projectId || fallbackProjectId || '',
    sprintId: entity.sprintId ?? item.sprintId ?? null,
    parentId: entity.parentWorkItemId || entity.parentId || item.parentWorkItemId || item.parentId || null,
    type: backendTypeToFrontend(entity.type || item.type),
    title: entity.title || item.title || 'Untitled Task',
    description: entity.description ?? item.description ?? '',
    status: backendStatusToFrontend(entity.status || item.status),
    priority: backendPriorityToFrontend(entity.priority ?? item.priority),
    assigneeId: primaryAssigneeId,
    assigneeIds,
    assignees,
    creatorId: entity.createdById || entity.creatorId || item.createdById || item.creatorId || '',
    startDate: plannedStartDate,
    plannedStartDate,
    dueDate,
    plannedDurationWorkingDays:
      entity.plannedDurationWorkingDays ?? item.plannedDurationWorkingDays ?? null,
    isSchedulePinned: Boolean(entity.isSchedulePinned ?? item.isSchedulePinned),
    startDate: entity.startDate || item.startDate || null,
    dueDate: entity.dueDate || item.dueDate || null,
    estimateHours: (entity.estimateHours ?? item.estimateHours) ? Number(entity.estimateHours ?? item.estimateHours) : null,
    actualHours: Number(entity.actualHours ?? item.actualHours) || 0,
    dependencyIds: Array.isArray(entity.dependencies || item.dependencies)
      ? (entity.dependencies || item.dependencies).map((d: any) => d.dependsOnWorkItemId || d.id || d)
      : [],
    labels,
    subtasks: Array.isArray(entity.subtasks || item.subtasks) ? (entity.subtasks || item.subtasks) : [],
    comments: Array.isArray(entity.comments || item.comments) ? (entity.comments || item.comments) : [],
    timeEntries: Array.isArray(entity.timeEntries || item.timeEntries) ? (entity.timeEntries || item.timeEntries) : [],
    recurrenceRule: entity.recurrenceRule || item.recurrenceRule || { frequency: 'none' },
    sla: entity.sla || item.sla || { isBreached: false, isApproaching: false, isEscalated: false },
    version: entity.version ? Number(entity.version) : 1,
    createdAt: entity.createdAt || item.createdAt || new Date().toISOString(),
    updatedAt: entity.updatedAt || item.updatedAt || new Date().toISOString(),
    attachments: Array.isArray(entity.attachments || item.attachments)
      ? (entity.attachments || item.attachments).map((att: any) => ({
          id: att.id,
          name: att.originalName || att.name || 'attachment',
          size: Number(att.size) || 0,
          type: att.mimeType || att.type || 'application/octet-stream',
          url: att.url || att.storageKey || '',
          blobKey: att.blobKey || att.id,
          uploadedAt: att.createdAt || att.uploadedAt || new Date().toISOString(),
        }))
      : (entity.attachments || item.attachments || []),
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