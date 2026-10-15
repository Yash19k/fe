/**
 * Centralized API Integration Service for TaskFlow Pro.
 * Strictly communicates with actual backend endpoints without mocked responses or fake data.
 */

export const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string | undefined) ??
  (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

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

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = API_BASE_URL ? `${API_BASE_URL.replace(/\/+$/, '')}${cleanEndpoint}` : cleanEndpoint;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
      let errorMessage =
        data?.message ||
        (Array.isArray(data?.errors)
          ? data.errors.map((e: any) => e.message || e).join(', ')
          : null) ||
        `Request failed with status ${res.status}`;

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

/**
 * Check backend health status (GET /)
 */
export async function checkBackendHealth(): Promise<{ success: boolean; message: string }> {
  const endpoint = API_BASE_URL ? '/' : '/api-health';
  return request<{ success: boolean; message: string }>(endpoint);
}

/**
 * Register organization and owner user (POST /api/users/)
 */
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
}

export async function registerOrganizationApi(
  payload: RegisterOrganizationInput
): Promise<RegisterOrganizationResponse> {
  return request<RegisterOrganizationResponse>('/api/users/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Create a sprint in a project (POST /projects/:projectId/sprints)
 */
export interface CreateSprintApiInput {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  workItems?: Array<{
    type: string;
    title: string;
    description?: string | null;
    priority?: string;
    status?: string;
    dueDate?: string | null;
    parentWorkItemId?: string | null;
    assigneeIds?: string[];
  }>;
}

export async function createSprintApi(
  projectId: string,
  payload: CreateSprintApiInput
): Promise<any> {
  return request<any>(`/projects/${encodeURIComponent(projectId)}/sprints`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Create a work item (POST /)
 */
export async function createWorkItemApi(payload: any): Promise<any> {
  return request<any>('/api/work-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get project work items (GET /project/:projectId)
 */
export async function getProjectWorkItemsApi(
  projectId: string,
  page = 1,
  limit = 50
): Promise<any> {
  return request<any>(
    `/api/work-items/project/${encodeURIComponent(projectId)}?page=${page}&limit=${limit}`,
    {
      method: 'GET',
    }
  );
}
