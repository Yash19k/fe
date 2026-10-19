/**
 * LocalStorage Persistence Layer for TaskFlow Pro.
 * Provides safe serialization, fallbacks to realistic seed data,
 * non-destructive schema migration, and a complete Reset Demo Data capability.
 */


import {
  User,
  Project,
  Task,
  Workflow,
  WorkflowStatus,
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
    const normalizedStatus = t.status === 'To Do' ? 'Backlog' : (t.status || 'Backlog');

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

export const DEFAULT_STANDARD_WORKFLOW: Workflow = {
  id: 'wf-1',
  name: 'Standard Engineering Flow',
  statuses: [
    { id: 'st-backlog', name: 'Backlog', category: 'unstarted', color: '#6B7280', allowedTransitions: ['In Progress'] },
    { id: 'st-inprogress', name: 'In Progress', category: 'active', color: '#3B82F6', allowedTransitions: ['In Review', 'Blocked', 'On Hold'] },
    { id: 'st-inreview', name: 'In Review', category: 'active', color: '#A855F7', allowedTransitions: ['Testing / QA', 'In Progress', 'Blocked', 'On Hold'] },
    { id: 'st-testingqa', name: 'Testing / QA', category: 'active', color: '#06B6D4', allowedTransitions: ['Done', 'In Progress', 'Blocked', 'On Hold'], roleRestrictions: { Done: ['Manager', 'Admin'] } },
    { id: 'st-done', name: 'Done', category: 'completed', color: '#22C55E', allowedTransitions: ['In Progress'] },
    { id: 'st-blocked', name: 'Blocked', category: 'impediment', color: '#EF4444', allowedTransitions: ['Backlog', 'In Progress', 'In Review', 'Testing / QA'] },
    { id: 'st-onhold', name: 'On Hold', category: 'impediment', color: '#F97316', allowedTransitions: ['Backlog', 'In Progress', 'In Review', 'Testing / QA'] },
  ],
};

/**
 * Migrates workflows from localStorage safely:
 * - Maps legacy 'To Do' status to 'Backlog'
 * - Ensures the 7 approved default statuses are present in default workflow wf-1 in exact required order
 * - Preserves custom workflows and user statuses
 */
export function migrateWorkflows(rawWorkflows: any[]): Workflow[] {
  if (!Array.isArray(rawWorkflows)) return [DEFAULT_STANDARD_WORKFLOW];

  return rawWorkflows.map((wf) => {
    if (!wf || !Array.isArray(wf.statuses)) return wf;

    let updatedStatuses: WorkflowStatus[] = wf.statuses.map((st: any) => {
      if (st.name === 'To Do') {
        return {
          ...st,
          id: st.id === 'st-todo' ? 'st-backlog' : st.id,
          name: 'Backlog',
          allowedTransitions: (st.allowedTransitions || []).map((t: string) => (t === 'To Do' ? 'Backlog' : t)),
        };
      }
      return {
        ...st,
        allowedTransitions: (st.allowedTransitions || []).map((t: string) => (t === 'To Do' ? 'Backlog' : t)),
      };
    });

    if (wf.id === 'wf-1') {
      const statusNames = new Set(updatedStatuses.map((s) => s.name));
      const approvedSeven: WorkflowStatus[] = [
        { id: 'st-backlog', name: 'Backlog', category: 'unstarted', color: '#6B7280', allowedTransitions: ['In Progress'] },
        { id: 'st-inprogress', name: 'In Progress', category: 'active', color: '#3B82F6', allowedTransitions: ['In Review', 'Blocked', 'On Hold'] },
        { id: 'st-inreview', name: 'In Review', category: 'active', color: '#A855F7', allowedTransitions: ['Testing / QA', 'In Progress', 'Blocked', 'On Hold'] },
        { id: 'st-testingqa', name: 'Testing / QA', category: 'active', color: '#06B6D4', allowedTransitions: ['Done', 'In Progress', 'Blocked', 'On Hold'], roleRestrictions: { Done: ['Manager', 'Admin'] } },
        { id: 'st-done', name: 'Done', category: 'completed', color: '#22C55E', allowedTransitions: ['In Progress'] },
        { id: 'st-blocked', name: 'Blocked', category: 'impediment', color: '#EF4444', allowedTransitions: ['Backlog', 'In Progress', 'In Review', 'Testing / QA'] },
        { id: 'st-onhold', name: 'On Hold', category: 'impediment', color: '#F97316', allowedTransitions: ['Backlog', 'In Progress', 'In Review', 'Testing / QA'] },
      ];

      for (const st of approvedSeven) {
        if (!statusNames.has(st.name)) {
          updatedStatuses.push(st);
          statusNames.add(st.name);
        }
      }

      updatedStatuses = updatedStatuses.map((s) => {
        const defaultMatch = approvedSeven.find((d) => d.name === s.name);
        if (defaultMatch) {
          const merged = Array.from(new Set([...(s.allowedTransitions || []), ...(defaultMatch.allowedTransitions || [])]));
          return {
            ...s,
            allowedTransitions: merged.filter((m) => m !== 'To Do'),
            color: defaultMatch.color,
          };
        }
        return s;
      });

      // Sort according to exact standard default order
      const standardOrder = [
        'Backlog',
        'In Progress',
        'In Review',
        'Testing / QA',
        'Done',
        'Blocked',
        'On Hold',
      ];
      updatedStatuses.sort((a, b) => {
        const idxA = standardOrder.indexOf(a.name);
        const idxB = standardOrder.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    return {
      ...wf,
      statuses: updatedStatuses,
    };
  });
}

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
  const fallbackUser: User = {
    id: '',
    name: 'Workspace Member',
    email: 'admin@taskflow.pro',
    role: 'Admin',
    initials: 'AD',
    avatarColor: '#4F46E5',
    onboardingCompleted: true,
  };

  try {
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const savedCompany = localStorage.getItem(STORAGE_KEYS.COMPANY);
    const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    const savedWorkflows = localStorage.getItem(STORAGE_KEYS.WORKFLOWS);
    const savedNotifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const savedAuditLog = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
    const savedSprints = localStorage.getItem(STORAGE_KEYS.SPRINTS);
    const savedLabels = localStorage.getItem(STORAGE_KEYS.LABELS);

    const initialProjects = savedProjects ? JSON.parse(savedProjects) : [];
    const initialTasks = savedTasks ? JSON.parse(savedTasks) : [];
    const initialWorkflows = savedWorkflows ? JSON.parse(savedWorkflows) : [DEFAULT_STANDARD_WORKFLOW];
    const initialSprints = savedSprints ? JSON.parse(savedSprints) : [];
    const initialLabels = savedLabels ? JSON.parse(savedLabels) : [];

    let initialUser: User = savedUser ? JSON.parse(savedUser) : fallbackUser;
    if (initialUser && initialUser.onboardingCompleted === undefined) {
      initialUser = {
        ...initialUser,
        onboardingCompleted: true,
      };
    }

    const initialCompany: Company | null = savedCompany ? JSON.parse(savedCompany) : null;

    return {
      currentUser: initialUser,
      currentCompany: initialCompany,
      projects: migrateProjects(initialProjects),
      tasks: migrateTasks(initialTasks),
      workflows: migrateWorkflows(initialWorkflows),
      notifications: savedNotifications ? JSON.parse(savedNotifications) : [],
      auditLog: savedAuditLog ? JSON.parse(savedAuditLog) : [],
      sprints: initialSprints,
      labels: initialLabels,
    };
  } catch (err) {
    console.warn('TaskFlow: Error loading localStorage:', err);
    return {
      currentUser: fallbackUser,
      currentCompany: null,
      projects: [],
      tasks: [],
      workflows: [DEFAULT_STANDARD_WORKFLOW],
      notifications: [],
      auditLog: [],
      sprints: [],
      labels: [],
    };
  }
}

export function saveStateToStorage(key: StorageKeyName, data: any): void {
  try {
    const storageKey = STORAGE_KEYS[key];
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
  } catch (err) {
    console.warn(`TaskFlow: Failed to save ${key} to localStorage:`, err);
  }
}

export function resetAllStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('TaskFlow: Failed to clear storage:', err);
  }
}
