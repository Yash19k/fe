/**
 * LocalStorage Persistence Layer for TaskFlow Pro.
 * Provides safe serialization for session identity and non-destructive schema migration.
 */


import {
  User,
  Project,
  Task,
  Workflow,
  Notification,
  AuditLogEntry,
  Company,
  Sprint,
  Label,
} from '../types';

export const STORAGE_KEYS = {
  CURRENT_USER: 'taskflow_current_user_v2',
  PROJECTS: 'taskflow_projects_v2',
  TASKS: 'taskflow_tasks_v2',
  WORKFLOWS: 'taskflow_workflows_v2',
  NOTIFICATIONS: 'taskflow_notifications_v2',
  AUDIT_LOG: 'taskflow_audit_log_v2',
  COMPANY: 'taskflow_company_v2',
  SPRINTS: 'taskflow_sprints_v2',
  LABELS: 'taskflow_labels_v2',
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

/**
 * Migrates tasks from localStorage safely:
 * - Normalizes missing `type` to 'Task'
 * - Maps legacy 'To Do' status to 'Backlog'
 * - Migrates embedded subtasks into first-class work items idempotently
 * - Preserves existing user IDs, data, time entries, comments, etc.
 */
export function migrateTasks(rawTasks: any[]): Task[] {
  if (!Array.isArray(rawTasks)) return [];

  const migratedTasks: Task[] = [];
  const existingIds = new Set(rawTasks.map((t) => t?.id));
  const subtasksToElevate: Task[] = [];

  for (const t of rawTasks) {
    if (!t || typeof t !== 'object') continue;

    // 1. Normalize type
    const normalizedType = t.type || 'Task';

    // 2. Map legacy 'To Do' status to 'Backlog'
    const normalizedStatus = t.status === 'To Do' ? 'Backlog' : (t.status || '');

    // 3. Parent ID normalization
    const parentId = normalizedType === 'Epic' ? null : (t.parentId || null);

    // 4. Elevate embedded subtasks to first-class records if not already in tasks
    if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
      for (const sub of t.subtasks) {
        if (sub && sub.id && !existingIds.has(sub.id)) {
          existingIds.add(sub.id);
          subtasksToElevate.push({
            id: sub.id,
            type: 'Subtask',
            parentId: t.id,
            projectId: t.projectId || '',
            sectionId: t.sectionId || 'sec-1',
            title: sub.title || 'Untitled Subtask',
            description: '',
            status: sub.completed ? 'Done' : 'Backlog',
            priority: t.priority || 'Medium',
            assigneeId: sub.assigneeId || t.assigneeId,
            creatorId: t.creatorId || '',
            startDate: t.startDate || null,
            dueDate: t.dueDate || null,
            estimatedHours: 2,
            estimateHours: 2,
            actualHours: sub.completed ? 2 : 0,
            dependencyIds: [],
            tags: t.tags || [],
            comments: [],
            timeEntries: [],
            recurrenceRule: { frequency: 'none' },
            sla: { isBreached: false, isApproaching: false, isEscalated: false },
            version: 1,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          } as Task);
        }
      }
    }

    migratedTasks.push({
      ...t,
      type: normalizedType,
      status: normalizedStatus,
      parentId,
      subtasks: t.subtasks || [],
    });
  }

  return [...migratedTasks, ...subtasksToElevate];
}

export function migrateProjects(rawProjects: any[]): Project[] {
  if (!Array.isArray(rawProjects)) return [];

  return rawProjects.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const defaultKey = (p.id || 'PRJ')
      .toUpperCase()
      .replace(/^PROJ-/, 'PRJ-');

    return {
      ...p,
      visibility: p.visibility || 'global',
      projectKey: p.projectKey || defaultKey,
      memberIds: Array.isArray(p.memberIds) ? p.memberIds : (p.ownerId ? [p.ownerId] : []),
    };
  });
}

export const emptyUser: User = {
  id: '',
  name: '',
  email: '',
  role: 'Teammate',
  initials: '',
  onboardingCompleted: false,
};

export interface InitialAppState {
  currentUser: User;
  currentCompany: Company | null;
  projects: Project[];
  tasks: Task[];
  workflows: Workflow[];
  notifications: Notification[];
  auditLog: AuditLogEntry[];
  sprints: Sprint[];
  labels: Label[];
}

export function loadInitialState(): InitialAppState {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const savedCompany = localStorage.getItem(STORAGE_KEYS.COMPANY);

    // Clean up any legacy business records previously mirrored to localStorage
    const businessKeys = [
      STORAGE_KEYS.PROJECTS,
      STORAGE_KEYS.TASKS,
      STORAGE_KEYS.WORKFLOWS,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.AUDIT_LOG,
      STORAGE_KEYS.SPRINTS,
      STORAGE_KEYS.LABELS,
    ];
    for (const bk of businessKeys) {
      if (localStorage.getItem(bk)) {
        localStorage.removeItem(bk);
      }
    }

    let initialUser: User = emptyUser;
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.email) {
          initialUser = {
            ...parsed,
            onboardingCompleted: parsed.onboardingCompleted ?? true,
          };
        } else {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    }

    let initialCompany: Company | null = null;
    if (savedCompany && initialUser.id) {
      try {
        initialCompany = JSON.parse(savedCompany);
      } catch {
        localStorage.removeItem(STORAGE_KEYS.COMPANY);
      }
    }

    return {
      currentUser: initialUser,
      currentCompany: initialCompany,
      projects: [],
      tasks: [],
      workflows: [],
      notifications: [],
      auditLog: [],
      sprints: [],
      labels: [],
    };
  } catch (err) {
    console.warn('TaskFlow: Error loading initial storage:', err);
    return {
      currentUser: emptyUser,
      currentCompany: null,
      projects: [],
      tasks: [],
      workflows: [],
      notifications: [],
      auditLog: [],
      sprints: [],
      labels: [],
    };
  }
}

export function saveStateToStorage(key: StorageKeyName, data: any): void {
  // Only persist UI/session preferences, NOT persistent business records
  if (key !== 'CURRENT_USER' && key !== 'COMPANY') {
    return;
  }
  try {
    const storageKey = STORAGE_KEYS[key];
    if (!storageKey) return;

    if (data === null || data === undefined || (key === 'CURRENT_USER' && (!data?.id || !data?.email))) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
  } catch (err) {
    console.warn(`TaskFlow: Failed to save ${key} to localStorage:`, err);
  }
}
