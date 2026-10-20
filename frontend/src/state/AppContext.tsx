import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppContext } from '../context/AppContextInstance';
import { loadInitialState, saveStateToStorage, resetAllStorage, fallbackUser } from './storage';
import { broadcastEvent, subscribeToBroadcast } from './broadcast';
import { validateNewDependency } from '../domain/dependencyGraph';
import { calculateScheduleImpact, applyScheduleChanges } from '../domain/scheduling';
import { canTransitionStatus, hasPermission, PERMISSIONS } from '../domain/permissions';
import { validateHierarchy } from '../domain/hierarchy';
import { WORK_ITEM_TYPES, sanitizeWorkItemData } from '../domain/workItems';
import { createNextRecurringTask } from '../domain/recurrence';
import { normalizeProjectId, validateProjectId } from '../domain/projects';
import {
  AppContextValue,
  User,
  Company,
  Project,
  ProjectVisibility,
  Task,
  Workflow,
  Notification,
  AuditLogEntry,
  ToastMessage,
  ToastType,
  Priority,
  TaskStatus,
  Role,
  Sprint,
  SprintStatus,
  Label,
} from '../types';
import {
  createSprintApi,
  getProjectsApi,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  getProjectMembersApi,
  addProjectMemberApi,
  removeProjectMemberApi,
  updateProjectMemberRoleApi,
  getProjectWorkItemsApi,
  createWorkItemApi,
  updateWorkItemApi,
  deleteWorkItemApi,
  getProjectSprintsApi,
  currentUserApi,
  loginApi,
  logoutApi,
  getOrganizationUsersApi,
  getWorkItemCommentsApi,
  addWorkItemCommentApi,
  getWorkItemTimeEntriesApi,
  addWorkItemTimeEntryApi,
  getWorkItemDependenciesApi,
  addWorkItemDependencyApi,
  deleteWorkItemDependencyApi,
  getProjectLabelsApi,
  createProjectLabelApi,
  deleteProjectLabelApi,
  getProjectWorkflowApi,
  saveProjectWorkflowApi,
  getProjectAuditLogsApi,
  createAuditLogApi,
  getUserNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  createNotificationApi,
  backendProjectToFrontend,
  backendWorkItemToTask,
  backendSprintToFrontend,
  frontendStatusToBackend,
  frontendTypeToBackend,
  frontendPriorityToBackend,
  normalizeRole,
  toBackendRole,
} from '../services/api';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(() => loadInitialState(), []);

  const [currentUser, setCurrentUser] = useState<User>(initial.currentUser);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(initial.currentCompany);
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [workflows, setWorkflows] = useState<Workflow[]>(initial.workflows);
  const [notifications, setNotifications] = useState<Notification[]>(initial.notifications);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(initial.auditLog);
  const [sprints, setSprints] = useState<Sprint[]>(initial.sprints || []);
  const [labels, setLabels] = useState<Label[]>(initial.labels || []);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(true);

  // Navigation & UI state
  const [activeRoute, setActiveRoute] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return window.location.hash.replace(/^#/, '') || '/';
    }
    return '/';
  });
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/^\/project\/([^/]+)/);
      if (match && match[1] && match[1] !== 'proj-1') return match[1];
    }
    return '';
  });
  const [projectTab, setProjectTab] = useState<string>('overview'); // overview, list, board, timeline, calendar, dashboard, workflow, dependencies, members, activity, settings
  const [activeDrawerTaskId, setActiveDrawerTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [impactModalData, setImpactModalData] = useState<any>(null);
  const [conflictModalData, setConflictModalData] = useState<any>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [crossTabIndicator, setCrossTabIndicator] = useState<boolean>(false);
  const [pendingSignupPassword, setPendingSignupPassword] = useState<string>('');

  // Hash route synchronization
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace(/^#/, '') || '/';
      setActiveRoute(hash);

      // Parse project route format: /project/:id/:tab
      const match = hash.match(/^\/project\/([^/]+)(?:\/([^/]+))?/);
      if (match) {
        setCurrentProjectId(match[1]);
        if (match[2]) {
          const rawTab = match[2].split(/[#?]/)[0];
          const hashSection = match[2].includes('#') ? match[2].split('#')[1] : null;
          if (rawTab === 'settings' && hashSection === 'members') {
            setProjectTab('members');
          } else {
            setProjectTab(rawTab);
          }
        }
      }
    }

    // Run on initial mount to sync direct links and browser refresh
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((route: string) => {
    window.location.hash = route;
    setActiveRoute(route);
  }, []);

  // Sync session/identity only to localStorage (business data is retrieved from PostgreSQL)
  useEffect(() => saveStateToStorage('CURRENT_USER', currentUser), [currentUser]);
  useEffect(() => saveStateToStorage('COMPANY', currentCompany), [currentCompany]);

  // Toast helper
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Load authenticated backend data on boot
  useEffect(() => {
    let isCancelled = false;

    async function initBackend() {
      try {
        let authRes = await currentUserApi().catch(() => null);
        if (!authRes?.user) {
          // If not currently logged in, auto-login with default admin account to restore session
          const loginRes = await loginApi({ email: 'admin@taskflow.pro', password: 'Password123!' }).catch(() => null);
          if (loginRes?.user) {
            authRes = await currentUserApi().catch(() => null);
          }
        }

        if (authRes?.user && !isCancelled) {
          const u = authRes.user;
          const org = authRes.organization;
          const mappedUser: User = {
            id: u.id,
            name: u.name || u.fullName || 'Workspace Member',
            email: u.email,
            role: normalizeRole(u.role),
            companyId: org?.id,
            companyName: org?.name,
            onboardingCompleted: true,
          };
          setCurrentUser(mappedUser);
          if (org) {
            setCurrentCompany({
              id: org.id,
              name: org.name,
              createdByUserId: org.createdByUserId || u.id,
              createdAt: org.createdAt || new Date().toISOString(),
            });
          }
        }

        // Fetch organization users from backend
        const usersRes = await getOrganizationUsersApi().catch(() => null);
        if (usersRes?.data && Array.isArray(usersRes.data) && !isCancelled) {
          const mappedUsers: User[] = usersRes.data.map((u: any) => ({
            id: u.id,
            name: u.fullName || u.name || u.email.split('@')[0],
            email: u.email,
            role: normalizeRole(u.role),
            initials: (u.fullName || u.email || 'U').slice(0, 2).toUpperCase(),
            companyId: u.organizationId,
          }));
          setAllUsers(mappedUsers);
        }

        // Fetch real projects from backend
        const projsRes = await getProjectsApi().catch(() => null);
        if (projsRes?.data && Array.isArray(projsRes.data) && !isCancelled) {
          if (projsRes.data.length > 0) {
            const mapped = projsRes.data.map(backendProjectToFrontend);
            setProjects(mapped);

            setCurrentProjectId((prev) => {
              const exists = mapped.some((p) => p.id === prev);
              return exists ? prev : mapped[0].id;
            });
          } else {
            // Clean empty workspace
            setProjects([]);
            setTasks([]);
            setSprints([]);
            setLabels([]);
            setCurrentProjectId('');
          }
        }

        // Fetch user notifications
        const notifsRes = await getUserNotificationsApi().catch(() => null);
        if (notifsRes?.data && Array.isArray(notifsRes.data) && !isCancelled) {
          setNotifications(notifsRes.data.map((n: any) => ({
            id: n.id,
            userId: n.userId,
            title: n.title,
            message: n.message,
            description: n.message,
            type: n.type || 'system',
            read: Boolean(n.read),
            createdAt: n.createdAt,
            timestamp: n.createdAt,
            actionUrl: n.link,
          })));
        }
      } catch (err: any) {
        console.warn('TaskFlow: Backend initialization notice:', err?.message);
      } finally {
        if (!isCancelled) setIsLoadingBackend(false);
      }
    }

    initBackend();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch real project details (work items, sprints, members, labels, workflow, audit logs) whenever active project changes
  useEffect(() => {
    if (!currentProjectId) return;
    if (currentProjectId === 'proj-1') {
      if (projects.length > 0) {
        setCurrentProjectId(projects[0].id);
      }
      return;
    }
    let isCancelled = false;

    async function loadProjectData() {
      try {
        // Fetch project work items
        const itemsRes = await getProjectWorkItemsApi(currentProjectId, 1, 100).catch(() => null);
        if (itemsRes?.data?.workItems && Array.isArray(itemsRes.data.workItems) && !isCancelled) {
          const mappedTasks = itemsRes.data.workItems.map((item: any) =>
            backendWorkItemToTask(item, currentProjectId)
          );
          setTasks((prev) => {
            const otherTasks = prev.filter((t) => t.projectId !== currentProjectId);
            return [...mappedTasks, ...otherTasks];
          });
        }

        // Fetch project sprints
        const sprintsRes = await getProjectSprintsApi(currentProjectId).catch(() => null);
        if (sprintsRes?.data && Array.isArray(sprintsRes.data) && !isCancelled) {
          const mappedSprints = sprintsRes.data.map(backendSprintToFrontend);
          setSprints((prev) => {
            const otherSprints = prev.filter((s) => s.projectId !== currentProjectId);
            return [...mappedSprints, ...otherSprints];
          });
        }

        // Fetch project members
        const membersRes = await getProjectMembersApi(currentProjectId).catch(() => null);
        if (membersRes?.data && Array.isArray(membersRes.data) && !isCancelled) {
          const memberUserList: User[] = membersRes.data.map((m: any) => ({
            id: m.userId,
            name: m.name || m.email?.split('@')[0] || 'Member',
            email: m.email || '',
            role: normalizeRole(m.role),
            initials: (m.name || m.email || 'M').slice(0, 2).toUpperCase(),
          }));

          setAllUsers((prev) => {
            const existingIds = new Set(prev.map((u) => u.id));
            const newUsers = memberUserList.filter((u) => !existingIds.has(u.id));
            return [...prev, ...newUsers];
          });

          setProjects((prev) =>
            prev.map((p) => {
              if (p.id === currentProjectId) {
                const memberIds = membersRes.data.map((m: any) => m.userId);
                const memberRoles: Record<string, Role> = {};
                membersRes.data.forEach((m: any) => {
                  memberRoles[m.userId] = normalizeRole(m.role);
                });
                return {
                  ...p,
                  memberIds,
                  memberRoles,
                };
              }
              return p;
            })
          );
        }

        // Fetch project labels
        const labelsRes = await getProjectLabelsApi(currentProjectId).catch(() => null);
        if (labelsRes?.data && Array.isArray(labelsRes.data) && !isCancelled) {
          const mappedLabels: Label[] = labelsRes.data.map((l: any) => ({
            id: l.id,
            name: l.name,
            color: l.color,
            description: l.description,
            projectId: l.projectId,
          }));
          setLabels((prev) => {
            const otherLabels = prev.filter((l) => l.projectId && l.projectId !== currentProjectId);
            return [...otherLabels, ...mappedLabels];
          });
        }

        // Fetch project workflow
        const wfRes = await getProjectWorkflowApi(currentProjectId).catch(() => null);
        if (wfRes?.data && !isCancelled) {
          const backendWf = wfRes.data;
          setWorkflows((prev) => {
            const exists = prev.some((w) => w.projectId === currentProjectId || w.id === `wf-${currentProjectId}`);
            if (exists) {
              return prev.map((w) => {
                if (w.projectId === currentProjectId || w.id === `wf-${currentProjectId}`) {
                  return {
                    ...w,
                    statuses: backendWf.stages || w.statuses,
                  };
                }
                return w;
              });
            } else {
              return [
                ...prev,
                {
                  id: `wf-${currentProjectId}`,
                  projectId: currentProjectId,
                  name: `${currentProjectId} Workflow`,
                  statuses: backendWf.stages || [],
                },
              ];
            }
          });
        }

        // Fetch project audit logs
        const auditRes = await getProjectAuditLogsApi(currentProjectId).catch(() => null);
        if (auditRes?.data && Array.isArray(auditRes.data) && !isCancelled) {
          const mappedAudit: AuditLogEntry[] = auditRes.data.map((a: any) => ({
            id: a.id,
            actorId: a.userId,
            action: a.action,
            entityType: a.entityType || 'task',
            entityId: a.entityId,
            projectId: a.projectId,
            description: a.details?.description || `${a.action} ${a.entityType}`,
            timestamp: a.createdAt,
            details: a.details,
          }));
          setAuditLog((prev) => {
            const otherAudit = prev.filter((a) => a.projectId && a.projectId !== currentProjectId);
            return [...mappedAudit, ...otherAudit];
          });
        }
      } catch (err: any) {
        console.warn('TaskFlow: Project data load notice:', err?.message);
      }
    }

    loadProjectData();
    return () => {
      isCancelled = true;
    };
  }, [currentProjectId]);

  // Multi-tab broadcast subscription
  useEffect(() => {
    const unsubscribe = subscribeToBroadcast((event) => {
      setCrossTabIndicator(true);
      setTimeout(() => setCrossTabIndicator(false), 2000);

      if (event.type === 'TASK_UPDATED') {
        setTasks((prev) => prev.map((t) => (t.id === event.payload.id ? event.payload : t)));
        showToast(`Real-time update: Task "${event.payload.title}" synchronized`, 'info');
      } else if (event.type === 'TASKS_BATCH_UPDATED') {
        setTasks(event.payload);
        showToast('Real-time update: Schedule cascade synchronized across tabs', 'info');
      } else if (event.type === 'TASK_CREATED') {
        setTasks((prev) => [event.payload, ...prev]);
        showToast(`Real-time update: New task "${event.payload.title}" created`, 'info');
      }
    });
    return unsubscribe;
  }, [showToast]);

  const recordAudit = useCallback((
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    previousValue: any = null,
    newValue: any = null,
    canUndo: boolean = false,
    projectId?: string
  ) => {
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      if (entityType === 'task') {
        const t = tasks.find((item) => item.id === entityId);
        resolvedProjectId = t?.projectId || (newValue?.projectId) || (previousValue?.projectId) || currentProjectId;
      } else if (entityType === 'project') {
        resolvedProjectId = entityId;
      } else {
        resolvedProjectId = currentProjectId;
      }
    }

    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(5)}`,
      actorId: currentUser.id,
      entityType,
      entityId,
      projectId: resolvedProjectId,
      action,
      description,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
      canUndo,
    };
    setAuditLog((prev) => [entry, ...prev]);

    if (resolvedProjectId && resolvedProjectId.includes('-')) {
      createAuditLogApi({
        projectId: resolvedProjectId,
        workItemId: entityType === 'task' && entityId.includes('-') ? entityId : undefined,
        action,
        entityType,
        entityId,
        details: { description, previousValue, newValue },
      }).catch((err) => {
        console.warn('TaskFlow: Backend audit log notice:', err.message);
      });
    }
  }, [currentUser.id, tasks, currentProjectId]);

  // Active project
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === currentProjectId) || projects[0] || null;
  }, [projects, currentProjectId]);

  // Active workflow
  const currentWorkflow = useMemo(() => {
    if (!currentProject) return workflows[0];
    return workflows.find((w) => w.projectId === currentProject.id || w.id === currentProject.workflowId) || workflows[0];
  }, [workflows, currentProject]);

  // Tasks for current project
  const projectTasks = useMemo(() => {
    if (!currentProject) return [];
    return tasks.filter((t) => t.projectId === currentProject.id);
  }, [tasks, currentProject]);

  // Tasks assigned to current user
  const myTasks = useMemo(() => {
    return tasks.filter((t) => t.assigneeId === currentUser.id);
  }, [tasks, currentUser.id]);

  // Sprints for current project
  const projectSprints = useMemo(() => {
    if (!currentProject) return [];
    return sprints.filter((s) => s.projectId === currentProject.id);
  }, [sprints, currentProject]);

  // Labels for current project or global
  const projectLabels = useMemo(() => {
    if (!currentProject) return labels;
    return labels.filter((l) => !l.projectId || l.projectId === currentProject.id);
  }, [labels, currentProject]);

  // --- Task Operations ---
  const createTask = useCallback((formData: any) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.CREATE_TASK)) {
      showToast('Role does not have permission to create tasks', 'error');
      return { success: false, reason: 'Permission denied' };
    }

    // Centralized hierarchy validation
    const hierarchyCheck = validateHierarchy(formData, tasks);
    if (!hierarchyCheck.isValid) {
      showToast(hierarchyCheck.error || 'Hierarchy validation failed', 'error');
      return { success: false, reason: hierarchyCheck.error };
    }

    const sanitized = sanitizeWorkItemData(formData);

    const newTask: Task = {
      id: `tf-${Date.now()}`,
      type: sanitized.type || WORK_ITEM_TYPES.TASK,
      parentId: sanitized.parentId || null,
      projectId: sanitized.projectId || currentProjectId,
      sectionId: sanitized.sectionId || currentProject?.sections?.[0]?.id || 'sec-1',
      title: sanitized.title.trim(),
      description: sanitized.description || '',
      status: sanitized.status || 'Backlog',
      priority: sanitized.priority !== undefined ? sanitized.priority : null,
      assigneeId: sanitized.assigneeId || (sanitized.assigneeIds?.[0] ?? null),
      assigneeIds: Array.isArray(sanitized.assigneeIds)
        ? sanitized.assigneeIds
        : (sanitized.assigneeId ? [sanitized.assigneeId] : []),
      labels: Array.isArray(sanitized.labels) ? sanitized.labels : [],
      sprintId: sanitized.sprintId || null,
      creatorId: currentUser.id,
      startDate: sanitized.startDate || null,
      dueDate: sanitized.dueDate || null,
      estimateHours: sanitized.estimateHours !== undefined ? sanitized.estimateHours : null,
      actualHours: 0,
      dependencyIds: sanitized.dependencyIds || [],
      tags: sanitized.tags || [],
      subtasks: [],
      comments: [],
      timeEntries: [],
      attachments: sanitized.attachments || [],
      recurrenceRule: sanitized.recurrenceRule || { frequency: 'none' },
      sla: sanitized.sla || { isBreached: false, isApproaching: false, isEscalated: false },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Type-specific fields
      ...(sanitized.type === WORK_ITEM_TYPES.EPIC ? {
        businessGoal: sanitized.businessGoal || '',
        successCriteria: sanitized.successCriteria || '',
      } : {}),
      ...(sanitized.type === WORK_ITEM_TYPES.STORY ? {
        acceptanceCriteria: sanitized.acceptanceCriteria || '',
      } : {}),
      ...(sanitized.type === WORK_ITEM_TYPES.BUG ? {
        severity: sanitized.severity || 'Medium',
        stepsToReproduce: sanitized.stepsToReproduce || '',
        expectedBehavior: sanitized.expectedBehavior || '',
        actualBehavior: sanitized.actualBehavior || '',
        environment: sanitized.environment || '',
      } : {}),
    };

    setTasks((prev) => {
      let nextList = [newTask, ...prev];
      // If Subtask, sync parent's subtasks array for backwards compatibility
      if (newTask.parentId && newTask.type === WORK_ITEM_TYPES.SUBTASK) {
        nextList = nextList.map((t) => {
          if (t.id === newTask.parentId) {
            const subEntry = {
              id: newTask.id,
              title: newTask.title,
              completed: newTask.status === 'Done',
              assigneeId: newTask.assigneeId,
            };
            const existing = (t.subtasks || []).filter((s) => s.id !== newTask.id);
            return {
              ...t,
              subtasks: [...existing, subEntry],
              version: (t.version || 1) + 1,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });
      }
      return nextList;
    });

    recordAudit('created', 'task', newTask.id, `Created ${newTask.type} "${newTask.title}"`, null, newTask, false, newTask.projectId);
    broadcastEvent('TASK_CREATED', newTask);
    showToast(`${newTask.type} "${newTask.title}" created`, 'success');

    // Async persist to backend API
    const targetProject = projects.find((p) => p.id === newTask.projectId);
    const isServerProject = targetProject && targetProject.id.includes('-');
    if (isServerProject) {
      createWorkItemApi({
        projectId: newTask.projectId,
        parentWorkItemId: newTask.parentId || null,
        type: frontendTypeToBackend(newTask.type),
        title: newTask.title,
        description: newTask.description || null,
        priority: frontendPriorityToBackend(newTask.priority),
        status: frontendStatusToBackend(newTask.status),
        dueDate: newTask.dueDate || null,
        assignees: newTask.assigneeId ? [{ userId: newTask.assigneeId }] : [],
      }).then((res) => {
        const serverItem = res?.data || res?.workItem;
        if (serverItem?.id) {
          setTasks((prev) => prev.map((t) => (t.id === newTask.id ? { ...t, id: serverItem.id } : t)));
        }
      }).catch((err) => {
        console.warn('TaskFlow: Backend task creation notice:', err.message);
      });
    }

    return { success: true, task: newTask };
  }, [currentUser, currentProjectId, currentProject, projects, tasks, recordAudit, showToast]);

  const updateTask = useCallback((taskId: string, updates: any, snapshotVersion: number | null = null) => {
    let validationError = null;
    setTasks((prev) => {
      const target = prev.find((t) => t.id === taskId);
      if (!target) return prev;

      // Version conflict check
      if (snapshotVersion !== null && (target.version || 1) !== snapshotVersion) {
        setConflictModalData({
          taskId,
          snapshotVersion,
          latestTask: target,
          pendingUpdates: updates,
        });
        return prev;
      }

      // Hierarchy validation if type or parentId updated
      if (updates.type !== undefined || updates.parentId !== undefined) {
        const candidateData = {
          ...target,
          ...updates,
          id: taskId,
        };
        const hierarchyCheck = validateHierarchy(candidateData, prev);
        if (!hierarchyCheck.isValid) {
          validationError = hierarchyCheck.error;
          return prev;
        }
      }

      const merged = { ...target, ...updates };
      const sanitized = sanitizeWorkItemData(merged);

      const updated = {
        ...sanitized,
        version: (target.version || 1) + 1,
        updatedAt: new Date().toISOString(),
      };

      recordAudit('updated', 'task', taskId, `Updated ${updated.type || 'task'} "${updated.title}"`, target, updated, true, updated.projectId);
      broadcastEvent('TASK_UPDATED', updated);
      showToast(`${updated.type || 'Task'} "${updated.title}" updated`, 'success');

      let nextList = prev.map((t) => (t.id === taskId ? updated : t));

      // If updated task is a Subtask, sync its parent's embedded subtasks array
      if (updated.type === WORK_ITEM_TYPES.SUBTASK && updated.parentId) {
        nextList = nextList.map((t) => {
          if (t.id === updated.parentId) {
            const subtasks = (t.subtasks || []).map((s: any) =>
              s.id === taskId
                ? { ...s, title: updated.title, completed: updated.status === 'Done', assigneeId: updated.assigneeId }
                : s
            );
            return { ...t, subtasks };
          }
          return t;
        });
      }

      return nextList;
    });

    if (validationError) {
      showToast(validationError, 'error');
      return { success: false, reason: validationError };
    }

    if (typeof taskId === 'string' && taskId.includes('-')) {
      const backendUpdates: any = {};
      if (updates.title !== undefined) backendUpdates.title = updates.title;
      if (updates.description !== undefined) backendUpdates.description = updates.description;
      if (updates.status !== undefined) backendUpdates.status = frontendStatusToBackend(updates.status);
      if (updates.type !== undefined) backendUpdates.type = frontendTypeToBackend(updates.type);
      if (updates.priority !== undefined) backendUpdates.priority = frontendPriorityToBackend(updates.priority);
      if (updates.dueDate !== undefined) backendUpdates.dueDate = updates.dueDate || null;
      if (updates.parentId !== undefined) backendUpdates.parentWorkItemId = updates.parentId || null;

      if (Object.keys(backendUpdates).length > 0) {
        updateWorkItemApi(taskId, backendUpdates).catch((err) => {
          console.warn('TaskFlow: Backend task update notice:', err.message);
        });
      }
    }

    return { success: true };
  }, [recordAudit, showToast]);

  const deleteTask = useCallback((taskId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.DELETE_TASK)) {
      showToast(`Permission denied: ${currentUser.role}s cannot delete tasks.`, 'error');
      return false;
    }

    const target = tasks.find((t) => t.id === taskId);
    if (!target) return false;

    // Remove task, clean up dependencies, and handle parent-child cascades safely
    setTasks((prev) => {
      return prev
        .filter((t) => {
          if (t.id === taskId) return false;
          if (t.parentId === taskId && t.type === WORK_ITEM_TYPES.SUBTASK) return false;
          return true;
        })
        .map((t) => {
          const cleanedDeps = (t.dependencyIds || []).filter((id: string) => id !== taskId);
          let cleanedParentId = t.parentId;
          if (cleanedParentId === taskId) {
            cleanedParentId = null;
          }
          const cleanedSubtasks = (t.subtasks || []).filter((s) => s.id !== taskId);
          return {
            ...t,
            dependencyIds: cleanedDeps,
            parentId: cleanedParentId,
            subtasks: cleanedSubtasks,
          };
        });
    });

    if (activeDrawerTaskId === taskId) {
      setActiveDrawerTaskId(null);
    }

    recordAudit('deleted', 'task', taskId, `Deleted ${target.type || 'task'} "${target.title}"`, target, null, true, target.projectId);
    showToast(`${target.type || 'Task'} "${target.title}" deleted`, 'info');

    if (typeof taskId === 'string' && taskId.includes('-')) {
      deleteWorkItemApi(taskId).catch((err) => {
        console.warn('TaskFlow: Backend task deletion notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, tasks, activeDrawerTaskId, recordAudit, showToast]);

  const changeTaskStatus = useCallback((taskId: string, newStatus: TaskStatus) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return false;

    const transitionCheck = canTransitionStatus(currentUser.role, target.status, newStatus, currentWorkflow);
    if (!transitionCheck.allowed) {
      showToast(transitionCheck.reason || 'Status transition not allowed', 'error');
      return false;
    }

    const previousValue = { status: target.status };
    const updated = {
      ...target,
      status: newStatus,
      version: (target.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };

    const nextRecurring =
      newStatus === 'Done' && target.status !== 'Done'
        ? createNextRecurringTask(target)
        : null;

    setTasks((prev) => {
      let nextList = prev.map((t) => (t.id === taskId ? updated : t));
      if (updated.parentId && updated.type === WORK_ITEM_TYPES.SUBTASK) {
        nextList = nextList.map((t) => {
          if (t.id === updated.parentId) {
            const subtasks = (t.subtasks || []).map((s) =>
              s.id === taskId ? { ...s, completed: newStatus === 'Done' } : s
            );
            return { ...t, subtasks };
          }
          return t;
        });
      }
      if (nextRecurring) {
        nextList = [nextRecurring, ...nextList];
      }
      return nextList;
    });

    recordAudit('status_changed', 'task', taskId, `Changed status of "${target.title}" to ${newStatus}`, previousValue, { status: newStatus }, true, target.projectId);
    broadcastEvent('TASK_UPDATED', updated);

    if (nextRecurring) {
      recordAudit('created', 'task', nextRecurring.id, `Generated next recurring occurrence of "${target.title}" for ${nextRecurring.dueDate || nextRecurring.startDate}`, null, nextRecurring, false, target.projectId);
      broadcastEvent('TASK_CREATED', nextRecurring);
      showToast(`Completed "${target.title}". Next occurrence scheduled for ${nextRecurring.dueDate || nextRecurring.startDate}.`, 'success');
    } else {
      showToast(`Status updated to ${newStatus}`, 'success');
    }

    if (typeof taskId === 'string' && taskId.includes('-')) {
      updateWorkItemApi(taskId, { status: frontendStatusToBackend(newStatus) }).catch((err) => {
        console.warn('TaskFlow: Backend status update notice:', err.message);
      });
    }

    return true;
  }, [tasks, currentUser.role, currentWorkflow, recordAudit, showToast]);

  // Business-day rescheduling with impact preview
  const requestReschedule = useCallback((taskId: string, newDueDate: string) => {
    const impact = calculateScheduleImpact(taskId, newDueDate, tasks);
    if (impact.affectedTasks && impact.affectedTasks.length > 0) {
      // Trigger confirmation modal
      setImpactModalData(impact);
      return;
    }
    // No downstream cascade, apply directly
    const updatedTasks = applyScheduleChanges(impact, tasks);
    setTasks(updatedTasks);
    recordAudit('rescheduled', 'task', taskId, `Rescheduled task to ${newDueDate}`, null, { dueDate: newDueDate }, true);
    broadcastEvent('TASKS_BATCH_UPDATED', updatedTasks);
    showToast(`Rescheduled to ${newDueDate}`, 'success');
  }, [tasks, recordAudit, showToast]);

  const confirmRescheduleImpact = useCallback(() => {
    if (!impactModalData) return;
    const updatedTasks = applyScheduleChanges(impactModalData, tasks);
    setTasks(updatedTasks);
    recordAudit(
      'rescheduled',
      'task',
      impactModalData.taskId,
      `Rescheduled "${impactModalData.taskTitle}" and cascade-shifted ${impactModalData.affectedTasks.length} dependent tasks`,
      null,
      impactModalData,
      true
    );
    broadcastEvent('TASKS_BATCH_UPDATED', updatedTasks);
    setImpactModalData(null);
    showToast(`Reschedule applied to ${impactModalData.affectedTasks.length + 1} tasks`, 'success');
  }, [impactModalData, tasks, recordAudit, showToast]);

  // Dependency Management
  const addDependency = useCallback((predecessorId: string, successorId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.MANAGE_DEPENDENCIES)) {
      showToast('Permission denied: Role cannot modify dependencies', 'error');
      return { success: false, reason: 'Permission denied' };
    }

    const validation = validateNewDependency(predecessorId, successorId, tasks);
    if (!validation.isValid) {
      showToast(validation.reason || 'Invalid dependency link', 'error');
      return { success: false, ...validation };
    }

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === successorId) {
          const currentDeps = t.dependencyIds || [];
          return {
            ...t,
            dependencyIds: [...currentDeps, predecessorId],
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    const pred = tasks.find((t) => t.id === predecessorId);
    const succ = tasks.find((t) => t.id === successorId);
    recordAudit(
      'dependency_added',
      'task',
      successorId,
      `Linked dependency: "${succ?.title}" now depends on "${pred?.title}"`,
      null,
      { predecessorId, successorId },
      true
    );

    showToast(`Dependency linked: ${pred?.title} → ${succ?.title}`, 'success');

    if (successorId && successorId.includes('-') && predecessorId && predecessorId.includes('-')) {
      addWorkItemDependencyApi(successorId, predecessorId).catch((err) => {
        console.warn('TaskFlow: Backend dependency link notice:', err.message);
      });
    }

    return { success: true };
  }, [currentUser.role, tasks, recordAudit, showToast]);

  const removeDependency = useCallback((predecessorId: string, successorId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === successorId) {
          return {
            ...t,
            dependencyIds: (t.dependencyIds || []).filter((id: string) => id !== predecessorId),
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    recordAudit('dependency_removed', 'task', successorId, `Removed dependency link from ${predecessorId}`, null, null, true);
    showToast('Dependency removed', 'info');

    if (successorId && successorId.includes('-') && predecessorId && predecessorId.includes('-')) {
      deleteWorkItemDependencyApi(successorId, predecessorId).catch((err) => {
        console.warn('TaskFlow: Backend dependency remove notice:', err.message);
      });
    }
  }, [recordAudit, showToast]);

  // Subtask operations (Creates and synchronizes first-class Subtask work items)
  const addSubtask = useCallback((taskId: string, title: string, assigneeId: string | null = null) => {
    const parentTask = tasks.find((t) => t.id === taskId);
    if (!parentTask) return;

    const newSubId = `sub-${Date.now()}-${Math.random().toString(36).substring(5)}`;
    const newSubtaskRecord = {
      id: newSubId,
      type: WORK_ITEM_TYPES.SUBTASK,
      parentId: taskId,
      projectId: parentTask.projectId,
      sectionId: parentTask.sectionId,
      title: title.trim(),
      description: '',
      status: 'Backlog',
      priority: parentTask.priority || 'Medium',
      assigneeId: assigneeId || parentTask.assigneeId,
      creatorId: currentUser.id,
      startDate: parentTask.startDate,
      dueDate: parentTask.dueDate,
      estimateHours: 2,
      actualHours: 0,
      dependencyIds: [],
      tags: parentTask.tags || [],
      subtasks: [],
      comments: [],
      timeEntries: [],
      recurrenceRule: { frequency: 'none' },
      sla: { isBreached: false, isApproaching: false, isEscalated: false },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newSubEntry = {
      id: newSubId,
      title: title.trim(),
      completed: false,
      assigneeId: assigneeId || parentTask.assigneeId,
    };

    setTasks((prev) => [
      newSubtaskRecord,
      ...prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: [...(t.subtasks || []), newSubEntry],
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      }),
    ]);
  }, [tasks, currentUser.id]);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) => {
      // Find current completed status
      const subtaskItem = prev.find((t) => t.id === subtaskId);
      const parentTask = prev.find((t) => t.id === taskId);
      const isCurrentlyDone = subtaskItem
        ? subtaskItem.status === 'Done'
        : Boolean(parentTask?.subtasks?.find((s) => s.id === subtaskId)?.completed);

      const nextStatus = isCurrentlyDone ? 'Backlog' : 'Done';

      return prev.map((t) => {
        if (t.id === subtaskId) {
          return {
            ...t,
            status: nextStatus,
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        if (t.id === taskId) {
          const subtasks = (t.subtasks || []).map((s) =>
            s.id === subtaskId ? { ...s, completed: !isCurrentlyDone } : s
          );
          return {
            ...t,
            subtasks,
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      });
    });
  }, []);

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== subtaskId)
        .map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              subtasks: (t.subtasks || []).filter((s) => s.id !== subtaskId),
              version: (t.version || 1) + 1,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        })
    );
  }, []);

  // Comments
  const addComment = useCallback(async (taskId: string, body: string) => {
    if (!body.trim()) {
      showToast('Comment text cannot be empty', 'error');
      return;
    }
    const trimmed = body.trim();

    try {
      let commentId = `c-${Date.now()}`;
      let createdAt = new Date().toISOString();

      if (taskId && taskId.includes('-')) {
        const res = await addWorkItemCommentApi(taskId, trimmed);
        const serverComment = res?.data;
        if (serverComment?.id) {
          commentId = serverComment.id;
          if (serverComment.createdAt) {
            createdAt = serverComment.createdAt;
          }
        }
      }

      const newComment = {
        id: commentId,
        userId: currentUser.id,
        authorId: currentUser.id,
        body: trimmed,
        text: trimmed,
        createdAt,
      };

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, comments: [...(t.comments || []), newComment] } : t))
      );
      recordAudit('comment_added', 'task', taskId, `Added comment on task ${taskId}`, null, newComment, false);
      showToast('Comment posted successfully', 'success');
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to save comment to server';
      showToast(errMsg, 'error');
      throw err;
    }
  }, [currentUser.id, recordAudit, showToast]);

  // Time tracking
  const logTimeEntry = useCallback((taskId: string, durationMinutes: number, description: string = '') => {
    const hours = Number((durationMinutes / 60).toFixed(2));
    const entry = {
      id: `te-${Date.now()}`,
      userId: currentUser.id,
      durationMinutes: Number(durationMinutes),
      hours,
      description: description.trim(),
      note: description.trim(),
      date: new Date().toISOString().split('T')[0],
      startTime: new Date().toISOString(),
    };

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const existing = t.timeEntries || [];
          const actualHours = Number(((existing.reduce((sum, e) => sum + (e.durationMinutes ?? (e.hours ? e.hours * 60 : 0)), 0) + entry.durationMinutes) / 60).toFixed(1));
          return {
            ...t,
            actualHours,
            timeEntries: [...existing, entry],
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    showToast(`Logged ${durationMinutes} minutes`, 'success');

    if (taskId && taskId.includes('-')) {
      addWorkItemTimeEntryApi(taskId, {
        hours,
        durationMinutes,
        note: description.trim(),
        date: entry.date,
      }).then((res) => {
        const serverEntry = res?.data;
        if (serverEntry?.id) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    timeEntries: (t.timeEntries || []).map((te) => (te.id === entry.id ? { ...te, id: serverEntry.id } : te)),
                  }
                : t
            )
          );
        }
      }).catch((err) => {
        console.warn('TaskFlow: Backend time entry save notice:', err.message);
      });
    }
  }, [currentUser.id, showToast]);

  // SLA Escalation
  const escalateTask = useCallback((taskId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.TRIGGER_ESCALATION)) {
      showToast('Only Managers or Admins can escalate tasks', 'error');
      return;
    }
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            sla: {
              ...(t.sla || {}),
              isEscalated: true,
              escalatedAt: new Date().toISOString(),
            },
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    recordAudit('escalated', 'task', taskId, 'Escalated task to management', null, { isEscalated: true }, false);
    showToast('Task escalated to Management attention', 'warning');
  }, [currentUser.role, recordAudit, showToast]);

  // Concurrency Simulator (allows demonstrating conflict resolution modal)
  const simulateExternalTaskEdit = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const simulatedVersion = (t.version || 1) + 1;
          const updated = {
            ...t,
            title: `${t.title} [Updated Remotely]`,
            priority: (t.priority === 'High' ? 'Medium' : 'High') as Priority,
            version: simulatedVersion,
            updatedAt: new Date().toISOString(),
          };
          showToast(`Simulated remote update on task ${taskId} (version ${simulatedVersion})`, 'info');
          return updated;
        }
        return t;
      })
    );
  }, [showToast]);

  // Undo Audit Entry
  const undoAuditEntry = useCallback((auditId: string) => {
    const entry = auditLog.find((a) => a.id === auditId);
    if (!entry || !entry.canUndo || !entry.previousValue) {
      showToast('This action cannot be undone', 'error');
      return;
    }

    if (entry.entityType === 'task') {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === entry.entityId) {
            return {
              ...t,
              ...entry.previousValue,
              version: (t.version || 1) + 1,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        })
      );
      recordAudit('undone', 'task', entry.entityId, `Reverted: ${entry.description}`, null, null, false);
      showToast('Change successfully reverted', 'success');
    }
  }, [auditLog, recordAudit, showToast]);

  // Project Lifecycle & CRUD
  const createProject = useCallback((projectData: any) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.CREATE_PROJECT)) {
      showToast('Permission denied: Only Managers and Admins can create projects', 'error');
      return null;
    }

    const newId = `proj-${Date.now()}`;
    const newProj: Project = {
      id: newId,
      name: projectData.name.trim(),
      projectKey: projectData.projectKey?.trim() || projectData.id || `PRJ-${Date.now().toString().slice(-4)}`,
      description: projectData.description || '',
      visibility: projectData.visibility || 'global',
      status: 'On Track',
      color: projectData.color || '#6B9CFF',
      ownerId: currentUser.id,
      memberIds: [currentUser.id],
      memberRoles: { [currentUser.id]: currentUser.role },
      startDate: projectData.startDate || '',
      dueDate: projectData.dueDate || '',
      workflowId: projectData.workflowId || 'wf-1',
      sections: [
        { id: `sec-${Date.now()}-1`, name: 'Discovery & Plan', order: 1 },
        { id: `sec-${Date.now()}-2`, name: 'Execution', order: 2 },
        { id: `sec-${Date.now()}-3`, name: 'Review & Launch', order: 3 },
      ],
      settings: { slaHighHours: 24, slaMediumHours: 48, allowWeekendWork: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects((prev) => [...prev, newProj]);
    setCurrentProjectId(newProj.id);
    recordAudit('created', 'project', newProj.id, `Created project "${newProj.name}"`, null, newProj, false, newProj.id);
    showToast(`Project "${newProj.name}" created`, 'success');

    // Async persist to backend API
    createProjectApi({
      name: newProj.name,
      key: newProj.projectKey || newProj.id.slice(0, 10).toUpperCase(),
      description: newProj.description || null,
      startDate: newProj.startDate || null,
      endDate: newProj.dueDate || null,
      visibility: newProj.visibility === 'global' ? 'PUBLIC' : 'PRIVATE',
    }).then((res) => {
      const serverProj = res?.project || res?.data;
      if (serverProj?.id) {
        setProjects((prev) =>
          prev.map((p) => (p.id === newId ? { ...p, id: serverProj.id } : p))
        );
        setCurrentProjectId((prev) => (prev === newId ? serverProj.id : prev));
      }
    }).catch((err) => {
      console.warn('TaskFlow: Backend project creation notice:', err.message);
    });

    return newProj;
  }, [currentUser, recordAudit, showToast]);

  const updateProject = useCallback((projectId: string, updates: Partial<Project>) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
      showToast('Permission denied: Only Managers and Admins can edit project settings', 'error');
      return false;
    }

    const target = projects.find((p) => p.id === projectId);
    if (!target) return false;

    const updated = {
      ...target,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    recordAudit('updated', 'project', projectId, `Updated settings for project "${updated.name}"`, target, updated, false, projectId);
    showToast(`Project settings saved`, 'success');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      const backendPayload: any = {};
      if (updates.name) backendPayload.name = updates.name;
      if (updates.description !== undefined) backendPayload.description = updates.description;
      if (updates.visibility) backendPayload.visibility = updates.visibility === 'global' ? 'PUBLIC' : 'PRIVATE';
      if (updates.startDate) backendPayload.startDate = updates.startDate;
      if (updates.dueDate) backendPayload.endDate = updates.dueDate;

      if (Object.keys(backendPayload).length > 0) {
        updateProjectApi(projectId, backendPayload).catch((err) => {
          console.warn('TaskFlow: Backend project update notice:', err.message);
        });
      }
    }

    return true;
  }, [currentUser.role, projects, recordAudit, showToast]);

  const renameProject = useCallback((projectId: string, newName: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
      showToast('Permission denied: Only Managers and Admins can rename projects', 'error');
      return false;
    }

    const trimmed = newName.trim();
    if (!trimmed) {
      showToast('Project name cannot be empty', 'error');
      return false;
    }

    const target = projects.find((p) => p.id === projectId);
    if (!target) return false;

    const previousName = target.name;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, name: trimmed, updatedAt: new Date().toISOString() }
          : p
      )
    );

    recordAudit('renamed', 'project', projectId, `Renamed project from "${previousName}" to "${trimmed}"`, { name: previousName }, { name: trimmed }, false, projectId);
    showToast(`Project renamed to "${trimmed}"`, 'success');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      updateProjectApi(projectId, { name: trimmed }).catch((err) => {
        console.warn('TaskFlow: Backend project rename notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, recordAudit, showToast]);

  const updateProjectVisibility = useCallback((projectId: string, visibility: ProjectVisibility) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
      showToast('Permission denied: Only Managers and Admins can update project settings', 'error');
      return false;
    }

    const target = projects.find((p) => p.id === projectId);
    if (!target) return false;

    const previousVisibility = target.visibility || 'global';
    if (previousVisibility === visibility) return true;

    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, visibility, updatedAt: new Date().toISOString() }
          : p
      )
    );

    recordAudit(
      'updated',
      'project',
      projectId,
      `Changed visibility from "${previousVisibility}" to "${visibility}"`,
      { visibility: previousVisibility },
      { visibility },
      false,
      projectId
    );
    showToast(`Project visibility set to ${visibility === 'private' ? 'Private' : 'Global'}`, 'success');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      updateProjectApi(projectId, { visibility: visibility === 'global' ? 'PUBLIC' : 'PRIVATE' }).catch((err) => {
        console.warn('TaskFlow: Backend visibility update notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, recordAudit, showToast]);

  const updateProjectKey = useCallback(async (projectId: string, newKey: string): Promise<{ success: boolean; error?: string }> => {
    if (!hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
      showToast('Permission denied: Only Managers and Admins can update project identifiers', 'error');
      return { success: false, error: 'Permission denied' };
    }

    const validation = validateProjectId(newKey, projects, projectId);
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid project identifier', 'error');
      return { success: false, error: validation.error };
    }

    const normalized = normalizeProjectId(newKey);
    const target = projects.find((p) => p.id === projectId);
    if (!target) return { success: false, error: 'Project not found' };

    const previousKey = target.projectKey || target.id;
    if (previousKey === normalized) return { success: true };

    try {
      if (typeof projectId === 'string' && projectId.includes('-')) {
        await updateProjectApi(projectId, { key: normalized });
      }

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, projectKey: normalized, updatedAt: new Date().toISOString() }
            : p
        )
      );

      recordAudit(
        'updated',
        'project',
        projectId,
        `Updated project identifier from "${previousKey}" to "${normalized}"`,
        { projectKey: previousKey },
        { projectKey: normalized },
        false,
        projectId
      );
      showToast(`Project identifier updated to "${normalized}"`, 'success');
      return { success: true };
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to update project key on server';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  }, [currentUser.role, projects, recordAudit, showToast]);

  const deleteProject = useCallback((projectId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.DELETE_PROJECT)) {
      showToast('Permission denied: Only Managers and Admins can delete projects', 'error');
      return false;
    }

    const target = projects.find((p) => p.id === projectId);
    if (!target) return false;

    const remainingProjects = projects.filter((p) => p.id !== projectId);
    setProjects(remainingProjects);

    // Cascading clean up tasks belonging to this project
    const deletedTaskIds = new Set(tasks.filter((t) => t.projectId === projectId).map((t) => t.id));
    setTasks((prev) =>
      prev
        .filter((t) => t.projectId !== projectId)
        .map((t) => ({
          ...t,
          dependencyIds: (t.dependencyIds || []).filter((id: string) => !deletedTaskIds.has(id)),
          parentId: t.parentId && deletedTaskIds.has(t.parentId) ? null : t.parentId,
          subtasks: (t.subtasks || []).filter((s) => !deletedTaskIds.has(s.id)),
        }))
    );

    // Remove workflows created specifically for this project
    setWorkflows((prev) => prev.filter((w) => w.projectId !== projectId));

    // Remove audit entries specifically scoped to this project
    setAuditLog((prev) => prev.filter((a) => a.projectId !== projectId && a.entityId !== projectId));

    // Route away safely
    if (currentProjectId === projectId) {
      if (remainingProjects.length > 0) {
        setCurrentProjectId(remainingProjects[0].id);
      }
    }

    showToast(`Project "${target.name}" and associated data deleted`, 'info');
    navigate('/projects');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      deleteProjectApi(projectId).catch((err) => {
        console.warn('TaskFlow: Backend project deletion notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, tasks, currentProjectId, navigate, showToast]);

  // Project Members Management
  const addProjectMember = useCallback((projectId: string, userId: string, role: Role = 'Teammate') => {
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    if ((targetProj.memberIds || []).includes(userId)) {
      showToast('User is already a project member', 'error');
      return;
    }

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const currentMembers = p.memberIds || [];
          return {
            ...p,
            memberIds: [...currentMembers, userId],
            memberRoles: {
              ...(p.memberRoles || {}),
              [userId]: role,
            },
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );

    const userObj = allUsers.find((u) => u.id === userId);
    recordAudit('member_added', 'project', projectId, `Added ${userObj?.name || userId} (${role}) to project`, null, { userId, role }, false, projectId);
    showToast(`Added ${userObj?.name || 'member'} to project`, 'success');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      addProjectMemberApi(projectId, { memberId: userId, role: toBackendRole(role) }).catch((err) => {
        console.warn('TaskFlow: Backend add member notice:', err.message);
      });
    }
  }, [projects, allUsers, recordAudit, showToast]);

  const removeProjectMember = useCallback((projectId: string, userId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.MANAGE_MEMBERS)) {
      showToast('Permission denied: Only Managers and Admins can remove members', 'error');
      return false;
    }

    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return false;

    if (userId === targetProj.ownerId) {
      showToast('Cannot remove project owner. Reassign ownership first.', 'error');
      return false;
    }

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const updatedMemberIds = (p.memberIds || []).filter((id) => id !== userId);
          const updatedRoles = { ...(p.memberRoles || {}) };
          delete updatedRoles[userId];
          return {
            ...p,
            memberIds: updatedMemberIds,
            memberRoles: updatedRoles,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );

    const userObj = allUsers.find((u) => u.id === userId);
    recordAudit('member_removed', 'project', projectId, `Removed ${userObj?.name || userId} from project`, null, { userId }, false, projectId);
    showToast('Member removed from project', 'info');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      removeProjectMemberApi(projectId, userId).catch((err) => {
        console.warn('TaskFlow: Backend remove member notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, allUsers, recordAudit, showToast]);

  const updateProjectMemberRole = useCallback((projectId: string, userId: string, newRole: Role) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.MANAGE_MEMBERS)) {
      showToast('Permission denied: Only Managers and Admins can change member roles', 'error');
      return false;
    }

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            memberRoles: {
              ...(p.memberRoles || {}),
              [userId]: newRole,
            },
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );

    // If updating current user's role, sync currentUser state
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: newRole }));
    }

    const userObj = allUsers.find((u) => u.id === userId);
    recordAudit('role_changed', 'project', projectId, `Changed role of ${userObj?.name || userId} to ${newRole}`, null, { userId, role: newRole }, false, projectId);
    showToast(`Role updated to ${newRole}`, 'success');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      updateProjectMemberRoleApi(projectId, userId, toBackendRole(newRole)).catch((err) => {
        console.warn('TaskFlow: Backend update member role notice:', err.message);
      });
    }

    return true;
  }, [currentUser, projects, allUsers, recordAudit, showToast]);

  // Notifications
  const markNotificationRead = useCallback((notifId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
    if (notifId && notifId.includes('-')) {
      markNotificationReadApi(notifId).catch((err) => {
        console.warn('TaskFlow: Backend mark notification read notice:', err.message);
      });
    }
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsReadApi().catch((err) => {
      console.warn('TaskFlow: Backend mark all notifications read notice:', err.message);
    });
    showToast('All notifications marked as read', 'info');
  }, [showToast]);

  // Authentication & Session helpers
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await loginApi({ email, password });
      if (res?.user) {
        const u = res.user;
        const org = res.organization;
        const mappedUser: User = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: normalizeRole(u.role),
          companyId: org?.id,
          companyName: org?.name,
          onboardingCompleted: true,
        };
        setCurrentUser(mappedUser);
        if (org) {
          setCurrentCompany({
            id: org.id,
            name: org.name,
            createdByUserId: org.createdByUserId || u.id,
            createdAt: org.createdAt || new Date().toISOString(),
          });
        }
        // Fetch projects from backend
        const projs = await getProjectsApi().catch(() => null);
        if (projs?.data && Array.isArray(projs.data) && projs.data.length > 0) {
          const mapped = projs.data.map(backendProjectToFrontend);
          setProjects(mapped);
          setCurrentProjectId(mapped[0].id);
        }
        showToast(`Welcome back, ${u.name}!`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
      return false;
    }
  }, [showToast]);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => null);
    setCurrentUser(fallbackUser);
    showToast('Signed out successfully', 'info');
    navigate('/login');
  }, [navigate, showToast]);

  // Role Switcher (Simulated user selector for prototype testing)
  const switchUser = useCallback(async (userIdOrRole: string) => {
    const roleEmailMap: Record<string, string> = {
      Admin: 'admin@taskflow.pro',
      Manager: 'manager@taskflow.pro',
      Teammate: 'teammate@taskflow.pro',
    };

    let targetRole: Role | undefined;
    if (userIdOrRole === 'user-1' || userIdOrRole.toLowerCase() === 'admin') targetRole = 'Admin';
    else if (userIdOrRole === 'user-2' || userIdOrRole.toLowerCase() === 'manager') targetRole = 'Manager';
    else if (userIdOrRole === 'user-3' || userIdOrRole.toLowerCase() === 'teammate') targetRole = 'Teammate';

    if (targetRole) {
      const email = roleEmailMap[targetRole];
      try {
        await loginApi({ email, password: 'Password123!' });
        const authRes = await currentUserApi();
        if (authRes?.user) {
          const u = authRes.user;
          const org = authRes.organization;
          const mappedUser: User = {
            id: u.id,
            name: u.fullName || u.name || targetRole,
            email: u.email,
            role: normalizeRole(u.role),
            companyId: org?.id,
            companyName: org?.name,
            onboardingCompleted: true,
          };
          setCurrentUser(mappedUser);
          showToast(`Switched active role to ${mappedUser.role} (${mappedUser.name})`, 'info');
          return;
        }
      } catch (err: any) {
        console.warn('TaskFlow: switchUser backend login notice:', err?.message);
      }
    }

    const target = allUsers.find((u) => u.id === userIdOrRole || u.role.toLowerCase() === userIdOrRole.toLowerCase());
    if (target) {
      setCurrentUser(target);
      showToast(`Switched active role to ${target.role} (${target.name})`, 'info');
    }
  }, [allUsers, showToast]);

  const registerUser = useCallback((userData: { name: string; email: string }): User => {
    const initials = userData.name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'TF';

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: userData.name.trim(),
      email: userData.email.trim(),
      role: 'Admin',
      initials,
      avatarColor: '#4F46E5',
      title: 'Workspace Owner & Admin',
      onboardingCompleted: false,
    };

    setCurrentUser(newUser);
    saveStateToStorage('CURRENT_USER', newUser);
    return newUser;
  }, []);

  const completeCompanyOnboarding = useCallback((companyName: string, markComplete = true): boolean => {
    const trimmed = companyName.trim();
    if (!trimmed) return false;

    try {
      const newCompany: Company = {
        id: `comp-${Date.now()}`,
        name: trimmed,
        createdByUserId: currentUser.id,
        createdAt: new Date().toISOString(),
      };

      const updatedUser: User = {
        ...currentUser,
        companyId: newCompany.id,
        companyName: newCompany.name,
        onboardingCompleted: markComplete,
      };

      setCurrentCompany(newCompany);
      setCurrentUser(updatedUser);
      saveStateToStorage('COMPANY', newCompany);
      saveStateToStorage('CURRENT_USER', updatedUser);
      recordAudit('CREATE', 'Company', newCompany.id, `Created workspace company "${trimmed}"`, null, newCompany, false);
      return true;
    } catch (err) {
      console.error('TaskFlow: Failed to complete company setup:', err);
      return false;
    }
  }, [currentUser, recordAudit]);

  const finishOnboarding = useCallback(() => {
    setCurrentUser((prev) => {
      const updated = {
        ...prev,
        onboardingCompleted: true,
      };
      saveStateToStorage('CURRENT_USER', updated);
      return updated;
    });
  }, []);

  // Sprint operations
  const createSprint = useCallback(async (sprintData: Partial<Sprint>) => {
    const targetProjectId = sprintData.projectId || currentProjectId;
    const newSprint: Sprint = {
      id: `sprint-${Date.now()}`,
      projectId: targetProjectId,
      name: (sprintData.name || '').trim(),
      goal: sprintData.goal || null,
      startDate: sprintData.startDate || new Date().toISOString().split('T')[0],
      endDate: sprintData.endDate || new Date().toISOString().split('T')[0],
      status: (sprintData.status || 'PLANNED') as SprintStatus,
      workItemIds: sprintData.workItemIds || [],
      createdById: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await createSprintApi(targetProjectId, {
        name: newSprint.name,
        goal: newSprint.goal,
        startDate: newSprint.startDate,
        endDate: newSprint.endDate,
      });
      const serverSprintId = res?.data?.sprint?.id || res?.data?.id;
      if (serverSprintId) {
        newSprint.id = serverSprintId;
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to create sprint on server';
      showToast(errMsg, 'error');
      throw err;
    }

    setSprints((prev) => [newSprint, ...prev]);

    if (newSprint.workItemIds && newSprint.workItemIds.length > 0) {
      setTasks((prev) =>
        prev.map((t) =>
          newSprint.workItemIds!.includes(t.id) ? { ...t, sprintId: newSprint.id } : t
        )
      );
    }

    recordAudit('created', 'sprint', newSprint.id, `Created sprint "${newSprint.name}"`, null, newSprint, false, targetProjectId);
    showToast(`Sprint "${newSprint.name}" created`, 'success');
    return { success: true, sprint: newSprint };
  }, [currentProjectId, currentUser.id, recordAudit, showToast]);

  // Label operations
  const createLabel = useCallback((labelData: Partial<Label>): Label => {
    const targetProjectId = labelData.projectId || currentProjectId;
    const newLabel: Label = {
      id: `lbl-${Date.now()}`,
      name: (labelData.name || '').trim(),
      color: labelData.color || '#3B82F6',
      projectId: targetProjectId,
      description: labelData.description || '',
    };
    setLabels((prev) => [...prev, newLabel]);
    recordAudit('created', 'label', newLabel.id, `Created label "${newLabel.name}"`, null, newLabel, false, targetProjectId);
    showToast(`Label "${newLabel.name}" created`, 'success');

    if (targetProjectId && targetProjectId.includes('-')) {
      createProjectLabelApi(targetProjectId, {
        name: newLabel.name,
        color: newLabel.color,
        description: newLabel.description,
      }).then((res) => {
        const serverLabel = res?.data;
        if (serverLabel?.id) {
          setLabels((prev) => prev.map((l) => (l.id === newLabel.id ? { ...l, id: serverLabel.id } : l)));
        }
      }).catch((err) => {
        console.warn('TaskFlow: Backend label save notice:', err.message);
      });
    }

    return newLabel;
  }, [currentProjectId, recordAudit, showToast]);

  const deleteLabel = useCallback((labelId: string) => {
    const target = labels.find((l) => l.id === labelId);
    setLabels((prev) => prev.filter((l) => l.id !== labelId));
    setTasks((prev) =>
      prev.map((t) =>
        t.labels ? { ...t, labels: t.labels.filter((id) => id !== labelId && id !== target?.name) } : t
      )
    );
    if (target) {
      recordAudit('deleted', 'label', labelId, `Deleted label "${target.name}"`, target, null, false, target.projectId);
      if (target.projectId && target.projectId.includes('-') && labelId.includes('-')) {
        deleteProjectLabelApi(target.projectId, labelId).catch((err) => {
          console.warn('TaskFlow: Backend label delete notice:', err.message);
        });
      }
    }
    showToast('Label removed', 'info');
  }, [labels, recordAudit, showToast]);

  // Refresh Workspace State from Database
  const resetDemoState = useCallback(() => {
    setIsLoadingBackend(true);
    currentUserApi()
      .then((authRes) => {
        if (authRes?.user) {
          getProjectsApi().then((projsRes) => {
            if (projsRes?.data && Array.isArray(projsRes.data)) {
              const mapped = projsRes.data.map(backendProjectToFrontend);
              setProjects(mapped);
              if (mapped.length > 0) {
                setCurrentProjectId(mapped[0].id);
              }
            }
          });
        }
      })
      .finally(() => {
        setIsLoadingBackend(false);
        showToast('Workspace refreshed from database', 'info');
      });
  }, [showToast]);

  const value: AppContextValue = {
    currentUser,
    currentCompany,
    registerUser,
    completeCompanyOnboarding,
    finishOnboarding,
    switchUser,
    projects,
    createProject,
    updateProject,
    renameProject,
    updateProjectVisibility,
    updateProjectKey,
    deleteProject,
    addProjectMember,
    removeProjectMember,
    updateProjectMemberRole,
    currentProjectId,
    setCurrentProjectId,
    currentProject,
    projectTab,
    setProjectTab,
    workflows,
    currentWorkflow,
    setWorkflows,
    tasks,
    projectTasks,
    myTasks,
    createTask,
    updateTask,
    deleteTask,
    changeTaskStatus,
    requestReschedule,
    confirmRescheduleImpact,
    addDependency,
    removeDependency,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    pendingSignupPassword,
    setPendingSignupPassword,
    logTimeEntry,
    escalateTask,
    simulateExternalTaskEdit,
    auditLog,
    undoAuditEntry,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    activeRoute,
    navigate,
    activeDrawerTaskId,
    setActiveDrawerTaskId,
    openTaskDrawer: setActiveDrawerTaskId,
    closeTaskDrawer: () => setActiveDrawerTaskId(null),
    searchQuery,
    setSearchQuery,
    impactModalData,
    setImpactModalData,
    conflictModalData,
    setConflictModalData,
    toasts,
    showToast,
    crossTabIndicator,
    resetDemoState,
    allUsers,
    login,
    logout,
    isLoadingBackend,
    sprints,
    projectSprints,
    createSprint,
    labels,
    projectLabels,
    createLabel,
    deleteLabel,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
