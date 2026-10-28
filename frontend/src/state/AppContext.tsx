import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContextInstance';
import { loadInitialState, saveStateToStorage, DEFAULT_STANDARD_WORKFLOW, STORAGE_KEYS, emptyUser } from './storage';
import { broadcastEvent, subscribeToBroadcast } from './broadcast';
import { validateNewDependency } from '../domain/dependencyGraph';
import { calculateScheduleImpact, applyScheduleChanges } from '../domain/scheduling';
import { canTransitionStatus, hasPermission, PERMISSIONS, canUserAccessProject } from '../domain/permissions';
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
  TaskAttachment,
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
  uploadWorkItemAttachmentsApi,
  updateWorkItemApi,
  escalateWorkItemApi,
  deleteWorkItemApi,
  getProjectSprintsApi,
  currentUserApi,
  registerOrganizationApi,
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
  undoAuditLogApi,
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
  toBackendProjectRole,
  getAuthToken,
  clearAuthToken,
  isPersistedWorkItemId,
  isUuid,
  toUserFriendlyErrorMessage,
  CreateWorkItemApiInput,
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
  const [isInitializingAuth, setIsInitializingAuth] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(getAuthToken() || localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    }
    return false;
  });

  // Navigation & UI state
  const [activeRoute, setActiveRoute] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return window.location.hash.replace(/^#/, '') || '/';
    }
    return '/';
  });
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const cleanHash = window.location.hash.replace(/^#/, '');
      const match = cleanHash.match(/^\/project\/([^/]+)/);
      if (match && match[1] && match[1] !== 'proj-1') return match[1];
    }
    return '';
  });
  const [projectTab, setProjectTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const cleanHash = window.location.hash.replace(/^#/, '');
      const match = cleanHash.match(/^\/project\/([^/]+)(?:\/([^/]+))?/);
      if (match && match[2]) {
        const rawTab = match[2].split(/[#?]/)[0];
        const hashSection = match[2].includes('#') ? match[2].split('#')[1] : null;
        if (rawTab === 'dashboard') return 'overview';
        if (rawTab === 'workflow') return 'settings#workflow';
        if (rawTab === 'dependencies') return 'settings#dependencies';
        if (rawTab === 'members') return 'settings#members';
        if (rawTab === 'activity') return 'settings#activity';
        if (rawTab === 'settings' && hashSection) return `settings#${hashSection}`;
        return rawTab;
      }
    }
    return 'overview';
  });
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
          if (rawTab === 'dashboard') {
            setProjectTab('overview');
          } else if (rawTab === 'workflow') {
            setProjectTab('settings#workflow');
          } else if (rawTab === 'dependencies') {
            setProjectTab('settings#dependencies');
          } else if (rawTab === 'members') {
            setProjectTab('settings#members');
          } else if (rawTab === 'activity') {
            setProjectTab('settings#activity');
          } else if (rawTab === 'settings' && hashSection) {
            setProjectTab(`settings#${hashSection}`);
          } else {
            setProjectTab(rawTab);
          }
        }
      }
    }

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((route: string) => {
    window.location.hash = route;
    setActiveRoute(route);
  }, []);

  // Sync session/identity only to localStorage
  useEffect(() => saveStateToStorage('CURRENT_USER', currentUser), [currentUser]);
  useEffect(() => saveStateToStorage('COMPANY', currentCompany), [currentCompany]);

  const lastToastRef = useRef<{ message: string; type: ToastType; timestamp: number } | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const now = Date.now();
    if (
      lastToastRef.current &&
      lastToastRef.current.message === message &&
      lastToastRef.current.type === type &&
      now - lastToastRef.current.timestamp < 1000
    ) {
      return;
    }
    lastToastRef.current = { message, type, timestamp: now };
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const lastLoadedProjectIdRef = useRef<string | null>(null);
  const projectFetchSeqRef = useRef<number>(0);
  const [isLoadingProjectData, setIsLoadingProjectData] = useState<boolean>(false);
  const [projectDataError, setProjectDataError] = useState<string | null>(null);

  // Parallelized project asset loader
  const fetchProjectAssets = useCallback(async (projId: string, force: boolean = false) => {
    if (!projId || projId === 'proj-1') return;
    if (!force && lastLoadedProjectIdRef.current === projId) return;

    const currentSeq = ++projectFetchSeqRef.current;
    setIsLoadingProjectData(true);
    setProjectDataError(null);

    try {
      const [itemsRes, sprintsRes, membersRes, labelsRes, wfRes, auditRes] = await Promise.all([
        getProjectWorkItemsApi(projId, 1, 100).catch((err) => ({ error: err })),
        getProjectSprintsApi(projId).catch((err) => ({ error: err })),
        getProjectMembersApi(projId).catch((err) => ({ error: err })),
        getProjectLabelsApi(projId).catch((err) => ({ error: err })),
        getProjectWorkflowApi(projId).catch((err) => ({ error: err })),
        getProjectAuditLogsApi(projId).catch((err) => ({ error: err })),
      ]);

      if (currentSeq !== projectFetchSeqRef.current) {
        return;
      }

      if (itemsRes && 'error' in itemsRes) {
        setProjectDataError((itemsRes as any).error?.message || 'Failed to load project work items');
      }

      if (itemsRes && !('error' in itemsRes) && itemsRes?.data?.workItems && Array.isArray(itemsRes.data.workItems)) {
        const mappedTasks = itemsRes.data.workItems.map((item: any) =>
          backendWorkItemToTask(item, projId)
        );
        setTasks((prev) => {
          const otherTasks = prev.filter((t) => t.projectId !== projId);
          return [...mappedTasks, ...otherTasks];
        });
      }

      if (sprintsRes && !('error' in sprintsRes) && sprintsRes?.data && Array.isArray(sprintsRes.data)) {
        const mappedSprints = sprintsRes.data.map(backendSprintToFrontend);
        setSprints((prev) => {
          const otherSprints = prev.filter((s) => s.projectId !== projId);
          return [...mappedSprints, ...otherSprints];
        });
      }

      if (membersRes && !('error' in membersRes) && membersRes?.data && Array.isArray(membersRes.data)) {
        const memberUserList: User[] = membersRes.data.map((m: any) => ({
          id: m.userId,
          name: m.fullName || m.name || m.email?.split('@')[0] || 'Member',
          fullName: m.fullName || m.name || undefined,
          displayName: m.displayName || m.fullName || m.name || undefined,
          email: m.email || '',
          role: normalizeRole(m.role),
          initials: (m.fullName || m.name || m.email || 'M').slice(0, 2).toUpperCase(),
        }));

        setAllUsers((prev) => {
          const existingIds = new Set(prev.map((u) => u.id));
          const newUsers = memberUserList.filter((u) => !existingIds.has(u.id));
          return [...prev, ...newUsers];
        });

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === projId) {
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

      if (labelsRes && !('error' in labelsRes) && labelsRes?.data && Array.isArray(labelsRes.data)) {
        const mappedLabels: Label[] = labelsRes.data.map((l: any) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          description: l.description,
          projectId: l.projectId,
        }));
        setLabels((prev) => {
          const otherLabels = prev.filter((l) => l.projectId && l.projectId !== projId);
          return [...otherLabels, ...mappedLabels];
        });
      }

      if (wfRes && !('error' in wfRes) && wfRes?.data) {
        const backendWf = wfRes.data;
        const resolvedName =
          backendWf.name &&
          backendWf.name !== 'Custom Engineering Flow' &&
          !backendWf.name.endsWith(' Workflow') &&
          !/^[0-9a-fA-F-]{20,}/.test(backendWf.name)
            ? backendWf.name
            : 'TaskFlow Pro — Final Statuses';

        setWorkflows((prev) => {
          const exists = prev.some((w) => w.projectId === projId || w.id === `wf-${projId}`);
          if (exists) {
            return prev.map((w) => {
              if (w.projectId === projId || w.id === `wf-${projId}`) {
                return {
                  ...w,
                  name: resolvedName,
                  statuses: backendWf.stages || backendWf.statuses || w.statuses,
                };
              }
              return w;
            });
          } else {
            return [
              ...prev,
              {
                id: `wf-${projId}`,
                projectId: projId,
                name: resolvedName,
                statuses: backendWf.stages || backendWf.statuses || DEFAULT_STANDARD_WORKFLOW.statuses,
              },
            ];
          }
        });
      }

      if (auditRes && !('error' in auditRes) && auditRes?.data && Array.isArray(auditRes.data)) {
        const mappedAudit: AuditLogEntry[] = auditRes.data.map((a: any) => {
          const isReversibleAction =
            a.action &&
            !['undone', 'deleted', 'sla_initialized'].includes(a.action.toLowerCase());
          const hasPrev = Boolean(a.previousState || a.previousValue);
          const isAlreadyUndone = Boolean(a.isUndone);
          const canUndoAuthoritative =
            !isAlreadyUndone && hasPrev && isReversibleAction;

          return {
            id: a.id,
            actorId: a.userId || a.actorId,
            actorName: a.actorName || a.userName,
            userEmail: a.userEmail,
            action: a.action,
            entityType: a.entityType || 'task',
            entityId: a.entityId,
            entityTitle: a.entityTitle || null,
            projectId: a.projectId,
            description: a.description || a.details?.description || `${a.action} ${a.entityType}`,
            timestamp: a.timestamp || a.createdAt || a.created_at || new Date().toISOString(),
            previousValue: a.previousState || a.previousValue,
            newValue: a.newState || a.newValue,
            previousState: a.previousState || a.previousValue,
            newState: a.newState || a.newValue,
            canUndo: a.canUndo !== undefined ? Boolean(a.canUndo) || canUndoAuthoritative : canUndoAuthoritative,
            isUndone: isAlreadyUndone,
            undoneAt: a.undoneAt || null,
            reversalLogId: a.reversalLogId || null,
            details: a.details,
          };
        });
        setAuditLog((prev) => {
          const otherAudit = prev.filter((a) => a.projectId && a.projectId !== projId);
          return [...mappedAudit, ...otherAudit];
        });
      }

      lastLoadedProjectIdRef.current = projId;
    } catch (err: any) {
      if (currentSeq === projectFetchSeqRef.current) {
        setProjectDataError(err?.message || 'Failed to load project details');
      }
    } finally {
      if (currentSeq === projectFetchSeqRef.current) {
        setIsLoadingProjectData(false);
      }
    }
  }, []);

  const reloadProjectData = useCallback(async () => {
    if (currentProjectId) {
      await fetchProjectAssets(currentProjectId, true);
    }
  }, [currentProjectId, fetchProjectAssets]);

  // Boot initialization
  useEffect(() => {
    let isCancelled = false;

    async function initBackend() {
      try {
        const token = getAuthToken();
        const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        if (!token && !savedUser) {
          setCurrentUser(emptyUser);
          setCurrentCompany(null);
          if (!isCancelled) {
            setIsInitializingAuth(false);
            setIsLoadingBackend(false);
          }
          return;
        }

        let authRes: any = null;
        try {
          authRes = await currentUserApi();
        } catch (authErr: any) {
          if (authErr?.code === 'SERVER_UNREACHABLE' || authErr?.status === 0) {
            console.warn('TaskFlow: Server unreachable during boot auth verification');
          } else {
            clearAuthToken();
            try {
              localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
              localStorage.removeItem(STORAGE_KEYS.COMPANY);
            } catch {}
          }
          authRes = null;
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

          const [usersRes, projsRes, notifsRes] = await Promise.all([
            getOrganizationUsersApi().catch(() => null),
            getProjectsApi().catch(() => null),
            getUserNotificationsApi().catch(() => null),
          ]);

          if (usersRes?.data && Array.isArray(usersRes.data) && !isCancelled) {
            const mappedUsers: User[] = usersRes.data.map((usr: any) => ({
              id: usr.id,
              name: usr.fullName || usr.name || usr.email.split('@')[0],
              fullName: usr.fullName || usr.name || undefined,
              displayName: usr.displayName || usr.fullName || usr.name || undefined,
              email: usr.email,
              role: normalizeRole(usr.role),
              initials: (usr.fullName || usr.name || usr.email || 'U').slice(0, 2).toUpperCase(),
              companyId: usr.organizationId,
            }));
            setAllUsers(mappedUsers);
          }

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

          let resolvedProjectId = '';
          if (projsRes?.data && Array.isArray(projsRes.data) && !isCancelled) {
            if (projsRes.data.length > 0) {
              const mapped = projsRes.data.map(backendProjectToFrontend);
              setProjects(mapped);

              const cleanHash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
              const match = cleanHash.match(/^\/project\/([^/]+)/);
              const hashProjId = match && match[1] && match[1] !== 'proj-1' ? match[1] : null;

              if (hashProjId && mapped.some((p:Project) => p.id === hashProjId)) {
                resolvedProjectId = hashProjId;
              } else if (currentProjectId && mapped.some((p:Project) => p.id === currentProjectId)) {
                resolvedProjectId = currentProjectId;
              } else {
                resolvedProjectId = mapped[0].id;
              }
              setCurrentProjectId(resolvedProjectId);
            } else {
              setProjects([]);
              setTasks([]);
              setSprints([]);
              setLabels([]);
              setCurrentProjectId('');
            }
          }

          if (resolvedProjectId && !isCancelled) {
            await fetchProjectAssets(resolvedProjectId);
          }
        } else if (!isCancelled) {
          setCurrentUser(emptyUser);
          setCurrentCompany(null);
        }
      } catch (err: any) {
        console.warn('TaskFlow: Backend initialization notice:', err?.message);
      } finally {
        if (!isCancelled) {
          setIsInitializingAuth(false);
          setIsLoadingBackend(false);
        }
      }
    }

    initBackend();
    return () => {
      isCancelled = true;
    };
  }, [fetchProjectAssets]);

  useEffect(() => {
    if (!currentProjectId || isInitializingAuth || !currentUser?.id) return;
    if (currentProjectId === 'proj-1') {
      if (projects.length > 0) {
        setCurrentProjectId(projects[0].id);
      }
      return;
    }

    if (lastLoadedProjectIdRef.current !== currentProjectId) {
      fetchProjectAssets(currentProjectId);
    }
  }, [currentProjectId, isInitializingAuth, currentUser?.id, projects, fetchProjectAssets]);

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

    const taskTitle =
      entityType === 'task'
        ? tasks.find((t) => t.id === entityId)?.title ||
          newValue?.title ||
          previousValue?.title ||
          null
        : null;

    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(5)}`,
      actorId: currentUser?.id || 'system',
      actorName: currentUser?.name || currentUser?.email || 'Unknown user',
      userEmail: currentUser?.email || '',
      entityType,
      entityId,
      entityTitle: taskTitle,
      projectId: resolvedProjectId,
      action,
      description,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
      canUndo: entityType === 'task' ? false : canUndo,
    };
    setAuditLog((prev) => [entry, ...prev]);

    if (entityType !== 'task' && isPersistedWorkItemId(resolvedProjectId)) {
      createAuditLogApi({
        projectId: resolvedProjectId,
    const isPersistedTask = isPersistedWorkItemId(entityId);
    if (isPersistedWorkItemId(resolvedProjectId) && (entityType !== 'task' || isPersistedTask)) {
      createAuditLogApi({
        projectId: resolvedProjectId,
        workItemId: entityType === 'task' && isPersistedTask ? entityId : undefined,
        action,
        entityType,
        entityId,
        description,
        details: { description, previousValue, newValue },
        previousState: previousValue,
        newState: newValue,
      })
        .then((res) => {
          if (res?.data?.id) {
            setAuditLog((prev) =>
              prev.map((log) =>
                log.id === entry.id
                  ? {
                      ...log,
                      id: res.data.id,
                      timestamp: res.data.createdAt || res.data.timestamp || log.timestamp,
                    }
                  : log
              )
            );
          }
        })
        .catch((err) => {
          console.warn('TaskFlow: Backend audit log notice:', err.message);
        });
    }
  }, [currentUser, tasks, currentProjectId]);

  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === currentProjectId) || projects[0] || null;
  }, [projects, currentProjectId]);

  const currentWorkflow = useMemo(() => {
    const fallback = workflows[0] || DEFAULT_STANDARD_WORKFLOW;
    if (!currentProject) {
      return {
        ...fallback,
        name:
          fallback.name && !fallback.name.endsWith(' Workflow') && !/^[0-9a-fA-F-]{20,}/.test(fallback.name)
            ? fallback.name
            : 'TaskFlow Pro — Final Statuses',
      };
    }
    const found =
      workflows.find((w) => w.projectId === currentProject.id || w.id === currentProject.workflowId) || fallback;
    const isGeneric =
      !found.name ||
      found.name === 'Custom Engineering Flow' ||
      found.name.endsWith(' Workflow') ||
      /^[0-9a-fA-F-]{20,}/.test(found.name);

    return {
      ...found,
      name: isGeneric ? 'TaskFlow Pro — Final Statuses' : found.name,
    };
  }, [workflows, currentProject]);

  const projectTasks = useMemo(() => {
    if (!currentProject) return [];
    return tasks.filter((t) => t.projectId === currentProject.id);
  }, [tasks, currentProject]);

  const isTaskAssignedToUser = useCallback((task: Task, userId?: string | null): boolean => {
    if (!userId) return false;
    if (task.assigneeId === userId) return true;
    if (Array.isArray(task.assigneeIds) && task.assigneeIds.includes(userId)) return true;
    if (Array.isArray(task.assignees) && task.assignees.some((a: any) => (a.userId === userId || a.id === userId))) return true;
    return false;
  }, []);

  const myTasks = useMemo(() => {
    if (!currentUser?.id) return [];
    const seen = new Set<string>();
    return tasks.filter((t) => {
      if (seen.has(t.id)) return false;
      if (isTaskAssignedToUser(t, currentUser.id)) {
        seen.add(t.id);
        return true;
      }
      return false;
    });
  }, [tasks, currentUser?.id, isTaskAssignedToUser]);

  const loadCrossProjectTasks = useCallback(async () => {
    if (!currentUser?.id) return;
    const accessibleProjects = projects.filter((p) =>
      canUserAccessProject(p, currentUser.id, currentUser.role) && isPersistedWorkItemId(p.id)
    );

    const promises = accessibleProjects.map(async (project) => {
      try {
        const res = await getProjectWorkItemsApi(project.id, 1, 100);
        if (res?.data?.workItems && Array.isArray(res.data.workItems)) {
          return res.data.workItems.map((item: any) => backendWorkItemToTask(item, project.id));
        }
      } catch (err) {
        console.warn(`Could not fetch tasks for project ${project.id}:`, err);
      }
      return [];
    });

    const results = await Promise.all(promises);
    const newTasks = results.flat();
    if (newTasks.length > 0) {
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const toAdd = newTasks.filter((t) => !existingIds.has(t.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  }, [currentUser?.id, currentUser?.role, projects]);

  const projectSprints = useMemo(() => {
    if (!currentProject) return [];
    return sprints.filter((s) => s.projectId === currentProject.id);
  }, [sprints, currentProject]);

  const projectLabels = useMemo(() => {
    if (!currentProject) return labels;
    return labels.filter((l) => !l.projectId || l.projectId === currentProject.id);
  }, [labels, currentProject]);

  // --- Task Operations ---

  const createTask = useCallback(async (formData: any) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.CREATE_TASK)) {
      showToast('Role does not have permission to create tasks', 'error');
      return { success: false, reason: 'Permission denied' };
    }

    const hierarchyCheck = validateHierarchy(formData, tasks);
    if (!hierarchyCheck.isValid) {
      showToast(hierarchyCheck.error || 'Hierarchy validation failed', 'error');
      return { success: false, reason: hierarchyCheck.error };
    }

    const sanitized = sanitizeWorkItemData(formData);
    const targetProjectId = sanitized.projectId || currentProjectId;
    const targetProject = projects.find((p) => p.id === targetProjectId);
    const isServerProject = Boolean(targetProject && isPersistedWorkItemId(targetProject.id));

    if (!isServerProject) {
      showToast('A persisted backend project is required to create this task', 'error');
      return {
        success: false,
        reason: 'Backend project not found',
      };
    }

    const backendPriority = frontendPriorityToBackend(sanitized.priority);

    // Resolve label for creation if specified
    let targetLabelId: string | null = null;
    if (Array.isArray(sanitized.labels) && sanitized.labels.length > 0) {
      const firstLabelName = sanitized.labels[0];
      const matched = labels.find((l) => l.name === firstLabelName || l.id === firstLabelName);
      targetLabelId = matched?.id || (isUuid(firstLabelName) ? firstLabelName : null);
    } else if (sanitized.labelId && isUuid(sanitized.labelId)) {
      targetLabelId = sanitized.labelId;
    }

    try {
      // 1. Create the work item in backend to obtain the database UUID
      const res = await createWorkItemApi({
        projectId: targetProjectId,
        sprintId: isPersistedWorkItemId(sanitized.sprintId) ? sanitized.sprintId : null,
        parentWorkItemId: isPersistedWorkItemId(sanitized.parentId) ? sanitized.parentId : null,
        labelId: targetLabelId || null,
        labels: targetLabelId ? [targetLabelId] : [],
        type: frontendTypeToBackend(sanitized.type || WORK_ITEM_TYPES.TASK),
        title: sanitized.title.trim(),
        description: sanitized.description || null,
        ...(backendPriority !== null ? { priority: backendPriority } : {}),
        status: frontendStatusToBackend(sanitized.status || 'Backlog'),
        dueDate: sanitized.dueDate || null,
        assignees: (
          Array.isArray(sanitized.assigneeIds)
            ? sanitized.assigneeIds
            : sanitized.assigneeId
              ? [sanitized.assigneeId]
              : []
        )
          .filter((userId: string) => isUuid(userId))
          .map((userId: string) => ({ userId })),
      });

      const serverItem = res?.data || res?.workItem;
      if (!serverItem?.id) {
        throw new Error('Backend did not return the created work item ID');
      }

      const authoritativeTask = backendWorkItemToTask(
        serverItem,
        serverItem.projectId || targetProjectId
      );

      // Commit the server-created task before the modal starts its separate upload step.
      setTasks((prev) => [authoritativeTask, ...prev]);

      if (
        authoritativeTask.parentId &&
        authoritativeTask.type === WORK_ITEM_TYPES.SUBTASK
      ) {
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id !== authoritativeTask.parentId) return task;

            const subEntry = {
              id: authoritativeTask.id,
              title: authoritativeTask.title,
              completed: authoritativeTask.status === 'Done',
              assigneeId: authoritativeTask.assigneeId,
            };

            const existing = (task.subtasks || []).filter(
              (subtask) => subtask.id !== authoritativeTask.id
            );

            return {
              ...task,
              subtasks: [...existing, subEntry],
              version: (task.version || 1) + 1,
              updatedAt: new Date().toISOString(),
            };
          })
        );
      }

      recordAudit(
        'created',
        'task',
        authoritativeTask.id,
        `Created ${authoritativeTask.type} "${authoritativeTask.title}"`,
        null,
        authoritativeTask,
        false,
        authoritativeTask.projectId
      );

      broadcastEvent('TASK_CREATED', authoritativeTask);

      showToast(
        `${authoritativeTask.type} "${authoritativeTask.title}" created`,
        'success'
      );

      return { success: true, task: authoritativeTask };
    } catch (err: any) {
      const reason = toUserFriendlyErrorMessage(err, 'Failed to create task');
      console.warn('TaskFlow: Backend task creation failed:', err?.message || reason);
      showToast(reason, 'error');
      return { success: false, reason };
    }
  }, [
    currentUser,
    currentProjectId,
    projects,
    tasks,
    recordAudit,
    showToast,
    broadcastEvent,
  ]);

  const uploadTaskAttachments = useCallback(async (
    workItemId: string,
    files: File[],
  ): Promise<TaskAttachment[]> => {
    if (!isPersistedWorkItemId(workItemId)) {
      throw new Error('A persisted work item is required to upload attachments');
    }
    if (typeof File === 'undefined' || files.some((file) => !(file instanceof File))) {
      throw new Error('Attachments must be selected files');
    }

    const uploadRes = await uploadWorkItemAttachmentsApi(workItemId, files);
    const uploadedList = uploadRes?.attachments;
    if (
      !Array.isArray(uploadedList) ||
      uploadedList.length !== files.length ||
      uploadedList.some((attachment: any) =>
        typeof attachment.id !== 'string' ||
        typeof (attachment.storageKey || attachment.url) !== 'string'
      )
    ) {
      throw new Error('The server did not return all persisted attachments');
    }

    const persistedAttachments: TaskAttachment[] = uploadedList.map((attachment: any) => ({
      id: attachment.id,
      name: attachment.originalName || attachment.name || 'attachment',
      size: Number(attachment.size) || 0,
      type: attachment.mimeType || attachment.type || 'application/octet-stream',
      url: attachment.url || attachment.storageKey,
      uploadedAt: attachment.createdAt || attachment.uploadedAt || new Date().toISOString(),
    }));

    setTasks((previousTasks) =>
      previousTasks.map((task) => {
        if (task.id !== workItemId) return task;
        const attachmentsById = new Map(
          (task.attachments || []).map((attachment) => [attachment.id, attachment]),
        );
        persistedAttachments.forEach((attachment) =>
          attachmentsById.set(attachment.id, attachment),
        );
        return { ...task, attachments: Array.from(attachmentsById.values()) };
      }),
    );

    return persistedAttachments;
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: any, snapshotVersion: number | null = null): Promise<{ success: boolean; task?: Task; reason?: string }> => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return { success: false, reason: 'Task not found' };

    if (snapshotVersion !== null && (target.version || 1) !== snapshotVersion) {
      setConflictModalData({
        taskId,
        snapshotVersion,
        latestTask: target,
        pendingUpdates: updates,
      });
      return { success: false, reason: 'Version conflict' };
    }

    if (updates.type !== undefined || updates.parentId !== undefined) {
      const candidateData = {
        ...target,
        ...updates,
        id: taskId,
      };
      const hierarchyCheck = validateHierarchy(candidateData, tasks);
      if (!hierarchyCheck.isValid) {
        showToast(hierarchyCheck.error || 'Invalid task hierarchy', 'error');
        return { success: false, reason: hierarchyCheck.error };
      }
    }

    const merged = { ...target, ...updates };
    const sanitized = sanitizeWorkItemData(merged);

    const updated = {
      ...sanitized,
      version: (target.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };

    if (isPersistedWorkItemId(taskId)) {
      const backendUpdates: any = {};
      if (updates.sprintId !== undefined) backendUpdates.sprintId = isPersistedWorkItemId(updates.sprintId) ? updates.sprintId : null;
      if (updates.title !== undefined) backendUpdates.title = updates.title;
      if (updates.description !== undefined) backendUpdates.description = updates.description;
      if (updates.status !== undefined) backendUpdates.status = frontendStatusToBackend(updates.status);
      if (updates.type !== undefined) backendUpdates.type = frontendTypeToBackend(updates.type);
      if (updates.priority !== undefined) backendUpdates.priority = frontendPriorityToBackend(updates.priority);
      if (updates.dueDate !== undefined) backendUpdates.dueDate = updates.dueDate || null;
      if (updates.plannedStartDate !== undefined) backendUpdates.plannedStartDate = updates.plannedStartDate || null;
      if (updates.plannedDurationWorkingDays !== undefined) backendUpdates.plannedDurationWorkingDays = updates.plannedDurationWorkingDays;
      if (updates.isSchedulePinned !== undefined) backendUpdates.isSchedulePinned = updates.isSchedulePinned;
      if (updates.parentId !== undefined) backendUpdates.parentWorkItemId = isPersistedWorkItemId(updates.parentId) ? updates.parentId : null;

      if (updates.parentId !== undefined) backendUpdates.parentWorkItemId = isPersistedWorkItemId(updates.parentId) ? updates.parentId : null;
      
      if (updates.assignees !== undefined) {
        const mapped = Array.isArray(updates.assignees)
          ? updates.assignees
              .map((a: any) => (typeof a === 'string' ? a.trim() : a.userId || a.id))
              .filter((id: any) => typeof id === 'string' && isUuid(id.trim()))
          : [];
        backendUpdates.assigneeIds = mapped;
        backendUpdates.assignees = mapped.map((uid: string) => ({ userId: uid }));
        backendUpdates.assigneeId = mapped[0] || null;
      } else if (updates.assigneeIds !== undefined) {
        const validIds = Array.isArray(updates.assigneeIds)
          ? updates.assigneeIds
              .map((id: any) => (typeof id === 'string' ? id.trim() : ''))
              .filter((id: string) => isUuid(id))
          : [];
        backendUpdates.assigneeIds = validIds;
        backendUpdates.assignees = validIds.map((uid: string) => ({ userId: uid }));
        backendUpdates.assigneeId = validIds[0] || null;
      } else if (updates.assigneeId !== undefined) {
        const validId =
          updates.assigneeId && typeof updates.assigneeId === 'string' && isUuid(updates.assigneeId.trim())
            ? updates.assigneeId.trim()
            : null;
        backendUpdates.assigneeId = validId;
        backendUpdates.assigneeIds = validId ? [validId] : [];
        backendUpdates.assignees = validId ? [{ userId: validId }] : [];
      }

      if (updates.labels !== undefined) {
        if (Array.isArray(updates.labels) && updates.labels.length > 0) {
          const firstLabel = updates.labels[0];
          const matched = labels.find((l) => l.name === firstLabel || l.id === firstLabel);
          const resolvedLabelId = matched?.id || (isUuid(firstLabel) ? firstLabel : null);
          backendUpdates.labelId = resolvedLabelId || null;
          backendUpdates.labels = resolvedLabelId ? [resolvedLabelId] : null;
        } else {
          backendUpdates.labelId = null;
          backendUpdates.labels = null;
        }
      } else if (updates.labelId !== undefined) {
        backendUpdates.labelId = isUuid(updates.labelId) ? updates.labelId : null;
        backendUpdates.labels = backendUpdates.labelId ? [backendUpdates.labelId] : null;
      }

      try {
        let authoritativeTask: Task = updated;
        let authoritativeRescheduledTasks: Task[] = [];
        if (Object.keys(backendUpdates).length > 0) {
          const res = await updateWorkItemApi(taskId, backendUpdates);
          if (res?.data) {
            const serverTask = backendWorkItemToTask(
              res.data,
              res.data.projectId || res.data.workItem?.projectId || currentProjectId,
            );
            authoritativeTask = {
              ...target,
              ...serverTask,
              dependencyIds: target.dependencyIds || [],
              subtasks: target.subtasks,
              comments: target.comments,
              timeEntries: target.timeEntries,
              attachments: target.attachments,
              tags: target.tags,
              estimateHours: target.estimateHours,
              actualHours: target.actualHours,
              sla: res.data.sla || target.sla,
            };
            authoritativeRescheduledTasks = Array.isArray(res.data.rescheduledTasks)
              ? res.data.rescheduledTasks.map((task: any) => {
                  const mapped = backendWorkItemToTask(
                    task,
                    task.projectId || currentProjectId,
                  );
                  const existing = tasks.find((current) => current.id === task.id);
                  if (!existing) return mapped;
                  return {
                    ...existing,
                    startDate: mapped.startDate,
                    plannedStartDate: mapped.plannedStartDate,
                    dueDate: mapped.dueDate,
                    plannedDurationWorkingDays: mapped.plannedDurationWorkingDays,
                    isSchedulePinned: mapped.isSchedulePinned,
                    updatedAt: task.updatedAt || existing.updatedAt,
                  };
                })
              : [];
        if (Object.keys(backendUpdates).length > 0) {
          const res = await updateWorkItemApi(taskId, backendUpdates);
          if (res?.data) {
            authoritativeTask = backendWorkItemToTask(
              res.data,
              res.data.projectId || res.data.workItem?.projectId || currentProjectId
            );
          }
        }

        setTasks((prev) => {
          const serverUpdates = new Map(
            [...authoritativeRescheduledTasks, authoritativeTask].map((task) => [
              task.id,
              task,
            ]),
          );
          let nextList = prev.map((task) =>
            serverUpdates.has(task.id)
              ? { ...task, ...serverUpdates.get(task.id) }
              : task,
          );
          let nextList = prev.map((t) => (t.id === taskId ? { ...t, ...authoritativeTask } : t));

          if (authoritativeTask.type === WORK_ITEM_TYPES.SUBTASK && authoritativeTask.parentId) {
            nextList = nextList.map((t) => {
              if (t.id === authoritativeTask.parentId) {
                const subtasks = (t.subtasks || []).map((s: any) =>
                  s.id === taskId
                    ? { ...s, title: authoritativeTask.title, completed: authoritativeTask.status === 'Done', assigneeId: authoritativeTask.assigneeId }
                    : s
                );
                return { ...t, subtasks };
              }
              return t;
            });
          }

          return nextList;
        });

        recordAudit('updated', 'task', taskId, `Updated ${authoritativeTask.type || 'task'} "${authoritativeTask.title}"`, target, authoritativeTask, true, authoritativeTask.projectId);
        broadcastEvent('TASK_UPDATED', authoritativeTask);
        authoritativeRescheduledTasks.forEach((task) => broadcastEvent('TASK_UPDATED', task));
        showToast(`${authoritativeTask.type || 'Task'} "${authoritativeTask.title}" updated`, 'success');
        return { success: true, task: authoritativeTask };
      } catch (err: any) {
        const friendly = toUserFriendlyErrorMessage(err, 'Unable to save changes. Please try again.');
        console.warn('TaskFlow: Backend task update error:', err?.message || err);
        showToast(friendly, 'error');
        return { success: false, reason: friendly };
      }
    }

    setTasks((prev) => {
      let nextList = prev.map((t) => (t.id === taskId ? updated : t));

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

    recordAudit('updated', 'task', taskId, `Updated ${updated.type || 'task'} "${updated.title}"`, target, updated, true, updated.projectId);
    broadcastEvent('TASK_UPDATED', updated);
    showToast(`${updated.type || 'Task'} "${updated.title}" updated`, 'success');
    return { success: true, task: updated };
  }, [tasks, labels, currentProjectId, recordAudit, showToast, broadcastEvent]);

  const deleteTask = useCallback((taskId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.DELETE_TASK)) {
      showToast(`Permission denied: ${currentUser.role}s cannot delete tasks.`, 'error');
      return false;
    }

    const target = tasks.find((t) => t.id === taskId);
    if (!target) return false;

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

    if (isPersistedWorkItemId(taskId)) {
      deleteWorkItemApi(taskId).catch((err) => {
        console.warn('TaskFlow: Backend task deletion notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, tasks, activeDrawerTaskId, recordAudit, showToast]);

  const changeTaskStatus = useCallback((taskId: string, newStatus: TaskStatus) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return false;

    if (!currentUser) return false;
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

    recordAudit('status_changed', 'task', taskId, `Changed status of "${target.title}" from "${target.status}" to "${newStatus}"`, previousValue, { status: newStatus }, true, target.projectId);
    broadcastEvent('TASK_UPDATED', updated);

    if (nextRecurring) {
      recordAudit('created', 'task', nextRecurring.id, `Generated next recurring occurrence of "${target.title}" for ${nextRecurring.dueDate || nextRecurring.startDate}`, null, nextRecurring, false, target.projectId);
      broadcastEvent('TASK_CREATED', nextRecurring);
      showToast(`Completed "${target.title}". Next occurrence scheduled for ${nextRecurring.dueDate || nextRecurring.startDate}.`, 'success');
    } else {
      showToast(`Status updated to ${newStatus}`, 'success');
    }

    if (isPersistedWorkItemId(taskId)) {
      updateWorkItemApi(taskId, { status: frontendStatusToBackend(newStatus) }).catch((err) => {
        console.warn('TaskFlow: Backend status update notice:', err.message);
      });
    }

    return true;
  }, [tasks, currentUser.role, currentWorkflow, recordAudit, showToast]);

  const requestReschedule = useCallback(async (taskId: string, newDueDate: string) => {
    const impact = calculateScheduleImpact(taskId, newDueDate, tasks);
    if (impact.affectedTasks && impact.affectedTasks.length > 0) {
      setImpactModalData(impact);
      return;
    }
    if (!isPersistedWorkItemId(taskId)) {
      setTasks(applyScheduleChanges(impact, tasks));
      showToast(`Rescheduled to ${newDueDate}`, 'success');
      return;
    }
    await updateTask(taskId, { dueDate: newDueDate });
  }, [tasks, updateTask, showToast]);

  const confirmRescheduleImpact = useCallback(async () => {
    if (!impactModalData) return;
    if (!isPersistedWorkItemId(impactModalData.taskId)) {
      setTasks(applyScheduleChanges(impactModalData, tasks));
      setImpactModalData(null);
      showToast(
        `Reschedule applied to ${impactModalData.affectedTasks.length + 1} local tasks`,
        'success',
      );
      return;
    }
    const result = await updateTask(impactModalData.taskId, {
      dueDate: impactModalData.newDueDate,
    });
    if (result.success) setImpactModalData(null);
  }, [impactModalData, tasks, updateTask, showToast]);
    const updatedTasks = applyScheduleChanges(impact, tasks);
    setTasks(updatedTasks);
    recordAudit('rescheduled', 'task', taskId, `Rescheduled task to ${newDueDate}`, null, { dueDate: newDueDate }, true);
    broadcastEvent('TASKS_BATCH_UPDATED', updatedTasks);

    if (isPersistedWorkItemId(taskId)) {
      try {
        await updateWorkItemApi(taskId, { dueDate: impact.newDueDate || newDueDate });
      } catch (err: any) {
        console.warn('Failed to persist task reschedule to backend:', err?.message);
        showToast('Rescheduled locally, but sync with backend failed', 'warning');
        return;
      }
    }
    showToast(`Rescheduled to ${newDueDate}`, 'success');
  }, [tasks, recordAudit, showToast]);

  const confirmRescheduleImpact = useCallback(async () => {
    if (!impactModalData) return;
    const impact = impactModalData;
    const updatedTasks = applyScheduleChanges(impact, tasks);
    setTasks(updatedTasks);
    recordAudit(
      'rescheduled',
      'task',
      impact.taskId,
      `Rescheduled "${impact.taskTitle}" and cascade-shifted ${impact.affectedTasks.length} dependent tasks`,
      null,
      impact,
      true
    );
    broadcastEvent('TASKS_BATCH_UPDATED', updatedTasks);
    setImpactModalData(null);

    const updatePromises: Promise<any>[] = [];
    if (impact.taskId && isPersistedWorkItemId(impact.taskId)) {
      updatePromises.push(
        updateWorkItemApi(impact.taskId, { dueDate: impact.newDueDate || null })
      );
    }
    for (const aff of impact.affectedTasks) {
      if (isPersistedWorkItemId(aff.taskId)) {
        updatePromises.push(
          updateWorkItemApi(aff.taskId, { dueDate: aff.newDueDate || null })
        );
      }
    }

    if (updatePromises.length > 0) {
      const results = await Promise.allSettled(updatePromises);
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        showToast(`Reschedule applied with ${failedCount} server sync errors`, 'warning');
      } else {
        showToast(`Reschedule applied and synced for ${impact.affectedTasks.length + 1} tasks`, 'success');
      }
    } else {
      showToast(`Reschedule applied to ${impact.affectedTasks.length + 1} tasks`, 'success');
    }
  }, [impactModalData, tasks, recordAudit, showToast]);

  const addDependency = useCallback(async (predecessorId: string, successorId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.MANAGE_DEPENDENCIES)) {
      showToast('Permission denied: Role cannot modify dependencies', 'error');
      return { success: false, reason: 'Permission denied' };
    }

    const validation = validateNewDependency(predecessorId, successorId, tasks);
    if (!validation.isValid) {
      showToast(validation.reason || 'Invalid dependency link', 'error');
      return { success: false, ...validation };
    }

    const pred = tasks.find((t) => t.id === predecessorId);
    const succ = tasks.find((t) => t.id === successorId);
    if (!pred?.dueDate || !succ?.dueDate) {
      const reason = !pred?.dueDate
        ? `Predecessor "${pred?.title || 'Task'}" must have a due date before it can be linked.`
        : `Successor "${succ?.title || 'Task'}" must have a due date before it can be linked.`;
      showToast(reason, 'error');
      return { success: false, reason };
    }

    const successorIsPersisted = isPersistedWorkItemId(successorId);
    const predecessorIsPersisted = isPersistedWorkItemId(predecessorId);
    if (successorIsPersisted !== predecessorIsPersisted) {
      const reason = 'Dependencies can only link tasks persisted in the same project.';
      showToast(reason, 'error');
      return { success: false, reason };
    }

    let response: any = null;
    if (successorIsPersisted && predecessorIsPersisted) {
      try {
        response = await addWorkItemDependencyApi(successorId, predecessorId);
      } catch (error: any) {
        const reason = toUserFriendlyErrorMessage(error, 'Unable to save dependency.');
        showToast(reason, 'error');
        return { success: false, reason };
      }
    }

    const canonicalDependencyIds = Array.isArray(response?.dependencies)
      ? response.dependencies.map((edge: any) => edge.dependsOnWorkItemId)
      : [...(succ.dependencyIds || []), predecessorId];
    const rescheduledTasks: Task[] = Array.isArray(response?.rescheduledTasks)
      ? response.rescheduledTasks.map((task: any) => {
          const mapped = backendWorkItemToTask(
            task,
            task.projectId || succ.projectId,
          );
          const existing = tasks.find((current) => current.id === task.id);
          if (!existing) return mapped;
          return {
            ...existing,
            startDate: mapped.startDate,
            plannedStartDate: mapped.plannedStartDate,
            dueDate: mapped.dueDate,
            plannedDurationWorkingDays: mapped.plannedDurationWorkingDays,
            isSchedulePinned: mapped.isSchedulePinned,
            updatedAt: task.updatedAt || existing.updatedAt,
          };
        })
      : [];
    setTasks((previous) => {
      const changedById = new Map(rescheduledTasks.map((task) => [task.id, task]));
      changedById.set(successorId, {
        ...succ,
        ...changedById.get(successorId),
        dependencyIds: canonicalDependencyIds,
      });
      return previous.map((task) =>
        changedById.has(task.id)
          ? { ...task, ...changedById.get(task.id) }
          : task,
      );
    });

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
    return { success: true };
  }, [currentUser.role, tasks, recordAudit, showToast]);

  const removeDependency = useCallback(async (predecessorId: string, successorId: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.MANAGE_DEPENDENCIES)) {
      showToast('Permission denied: Role cannot modify dependencies', 'error');
      return { success: false, reason: 'Permission denied' };
    }

    const successor = tasks.find((task) => task.id === successorId);
    if (!successor) return { success: false, reason: 'Successor task not found' };

    let remainingDependencyIds: string[] | null = null;
    if (isPersistedWorkItemId(successorId)) {
      try {
        const response = await deleteWorkItemDependencyApi(
          successorId,
          predecessorId,
        );
        if (Array.isArray(response?.dependencies)) {
          remainingDependencyIds = response.dependencies.map(
            (edge: any) => edge.dependsOnWorkItemId,
          );
        }
      } catch (error: any) {
        const reason = toUserFriendlyErrorMessage(error, 'Unable to remove dependency.');
        showToast(reason, 'error');
        return { success: false, reason };
      }
    }

    setTasks((previous) =>
      previous.map((task) =>
        task.id === successorId
          ? {
              ...task,
              dependencyIds:
                remainingDependencyIds ??
                (task.dependencyIds || []).filter(
                  (id: string) => id !== predecessorId,
                ),
            }
          : task,
      ),
    );
    recordAudit('dependency_removed', 'task', successorId, `Removed dependency link from ${predecessorId}`, null, null, true);
    showToast('Dependency removed', 'info');
    return { success: true };
  }, [currentUser.role, tasks, recordAudit, showToast]);

  const addSubtask = useCallback(async (taskId: string, title: string, assigneeId: string | null = null) => {
    const parentTask = tasks.find((t) => t.id === taskId);
    if (!parentTask) return;

    if (!title.trim()) {
      showToast('Subtask title cannot be empty', 'error');
      return;
    }

    let subId = `sub-${Date.now()}-${Math.random().toString(36).substring(5)}`;

    if (isPersistedWorkItemId(taskId) && isPersistedWorkItemId(parentTask.projectId)) {
      try {
        const payload: CreateWorkItemApiInput = {
          projectId: parentTask.projectId,
          parentWorkItemId: taskId,
          type: 'SUBTASK',
          title: title.trim(),
          priority: parentTask.priority ? (parentTask.priority.toUpperCase() as any) : 'MEDIUM',
          status: 'BACKLOG',
          dueDate: parentTask.dueDate || null,
          assignees: (assigneeId || parentTask.assigneeId)
            ? [{ userId: (assigneeId || parentTask.assigneeId)! }]
            : [],
        };
        const res = await createWorkItemApi(payload);
        if (res?.data?.id) {
          subId = res.data.id;
        }
      } catch (err: any) {
        const reason = toUserFriendlyErrorMessage(err, 'Failed to save subtask to server');
        showToast(reason, 'error');
        return;
      }
    }

    const newSubtaskRecord = {
      id: subId,
      type: WORK_ITEM_TYPES.SUBTASK,
      parentId: taskId,
      projectId: parentTask.projectId,
      sectionId: parentTask.sectionId,
      title: title.trim(),
      description: '',
      status: 'Backlog',
      priority: parentTask.priority || 'Medium',
      assigneeId: assigneeId || parentTask.assigneeId,
      creatorId: currentUser?.id || '',
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
      id: subId,
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
    showToast('Subtask created', 'success');
  }, [tasks, currentUser?.id, showToast]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    const subtaskItem = tasks.find((t) => t.id === subtaskId);
    const parentTask = tasks.find((t) => t.id === taskId);
    const isCurrentlyDone = subtaskItem
      ? subtaskItem.status === 'Done'
      : Boolean(parentTask?.subtasks?.find((s) => s.id === subtaskId)?.completed);

    const nextStatus = isCurrentlyDone ? 'Backlog' : 'Done';
    const nextCompleted = !isCurrentlyDone;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => {
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
            s.id === subtaskId ? { ...s, completed: nextCompleted } : s
          );
          return {
            ...t,
            subtasks,
            version: (t.version || 1) + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    if (isPersistedWorkItemId(subtaskId)) {
      try {
        await updateWorkItemApi(subtaskId, {
          status: nextCompleted ? 'DONE' : 'BACKLOG',
        });
      } catch (err: any) {
        // Rollback on failure
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === subtaskId) {
              return {
                ...t,
                status: isCurrentlyDone ? 'Done' : 'Backlog',
                version: (t.version || 1) + 1,
                updatedAt: new Date().toISOString(),
              };
            }
            if (t.id === taskId) {
              const subtasks = (t.subtasks || []).map((s) =>
                s.id === subtaskId ? { ...s, completed: isCurrentlyDone } : s
              );
              return {
                ...t,
                subtasks,
                version: (t.version || 1) + 1,
                updatedAt: new Date().toISOString(),
              };
            }
            return t;
          })
        );
        showToast(toUserFriendlyErrorMessage(err, 'Failed to update subtask status'), 'error');
      }
    }
  }, [tasks, showToast]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    const prevTasksSnapshot = tasks;

    // Optimistic remove
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

    if (isPersistedWorkItemId(subtaskId)) {
      try {
        await deleteWorkItemApi(subtaskId);
        showToast('Subtask deleted', 'info');
      } catch (err: any) {
        // Rollback on failure
        setTasks(prevTasksSnapshot);
        showToast(toUserFriendlyErrorMessage(err, 'Failed to delete subtask'), 'error');
      }
    }
  }, [tasks, showToast]);

  const addComment = useCallback(async (taskId: string, body: string) => {
    if (!body.trim()) {
      showToast('Comment text cannot be empty', 'error');
      return;
    }
    const trimmed = body.trim();

    try {
      let commentId = `c-${Date.now()}`;
      let createdAt = new Date().toISOString();

      if (isPersistedWorkItemId(taskId)) {
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
        userId: currentUser?.id || '',
        authorId: currentUser?.id || '',
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
  }, [currentUser?.id, recordAudit, showToast]);

  const logTimeEntry = useCallback((taskId: string, durationMinutes: number, description: string = '') => {
    const hours = Number((durationMinutes / 60).toFixed(2));
    const entry = {
      id: `te-${Date.now()}`,
      userId: currentUser?.id || '',
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

    if (isPersistedWorkItemId(taskId)) {
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
  }, [currentUser?.id, showToast]);

  const escalateTask = useCallback(async (taskId: string, reason?: string) => {
    if (!hasPermission(currentUser.role, PERMISSIONS.TRIGGER_ESCALATION)) {
      showToast('Only Managers or Admins can escalate tasks', 'error');
      throw new Error('Only Managers or Admins can escalate tasks');
    }
    try {
      if (!isPersistedWorkItemId(taskId)) {
        throw new Error('This task is still being saved. Please try again shortly.');
      }
      const response = await escalateWorkItemApi(taskId, reason);
      const serverItem = response?.data;
      if (!serverItem?.id) {
        throw new Error('The server did not return the escalated work item.');
      }
      const mapped = backendWorkItemToTask(serverItem, serverItem.projectId);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...mapped } : task)));
      broadcastEvent('TASK_UPDATED', mapped);
      showToast(response?.data?.alreadyEscalated ? 'Task is already escalated' : 'Task escalated to Management attention', 'warning');
      return mapped;
    } catch (error: any) {
      showToast(error?.message || 'Unable to escalate task', 'error');
      throw error;
    }
  }, [currentUser.role, showToast]);

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

  const undoAuditEntry = useCallback(async (auditId: string) => {
    const entry = auditLog.find((a) => a.id === auditId);
    if (!entry || !entry.canUndo || entry.isUndone || !entry.previousValue) {
      showToast('This action cannot be undone', 'error');
      return;
    }

    const projectId = entry.projectId || currentProjectId;
    try {
      const res = await undoAuditLogApi(projectId, auditId);
      if (res?.success) {
        if (res.data?.restoredTask) {
          const authoritative = backendWorkItemToTask(res.data.restoredTask, projectId);
          setTasks((prev) =>
            prev.map((t) => (t.id === entry.entityId ? { ...t, ...authoritative } : t))
          );
        }

        setAuditLog((prev) => {
          const updatedTarget = prev.map((a) => {
            if (a.id === auditId) {
              return {
                ...a,
                canUndo: false,
                isUndone: true,
                undoneAt: new Date().toISOString(),
                reversalLogId: res.data?.reversalLog?.id || null,
              };
            }
            return a;
          });

          if (res.data?.reversalLog) {
            const rev = res.data.reversalLog;
            const reversalEntry: AuditLogEntry = {
              id: rev.id,
              actorId: currentUser?.id || 'system',
              actorName: currentUser?.name || 'User',
              userEmail: currentUser?.email || '',
              action: 'undone',
              entityType: rev.entityType || entry.entityType,
              entityId: rev.entityId || entry.entityId,
              entityTitle: entry.entityTitle || null,
              projectId: rev.projectId || projectId,
              description: rev.description || `Undid previous change`,
              timestamp: rev.timestamp || rev.createdAt || new Date().toISOString(),
              previousValue: rev.previousState,
              newValue: rev.newState,
              canUndo: false,
              isUndone: false,
            };
            return [reversalEntry, ...updatedTarget];
          }

          return updatedTarget;
        });

        const taskTitle = entry.entityTitle || 'item';
        showToast(`Reverted change to "${taskTitle}"`, 'success');
      } else {
        showToast(res?.message || 'Failed to undo action', 'error');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to undo action';
      showToast(msg, 'error');
    }
  }, [auditLog, currentProjectId, currentUser, showToast]);

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
      color: projectData.color || '#7465F6',
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
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
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

    if (isPersistedWorkItemId(projectId)) {
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
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
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

    if (isPersistedWorkItemId(projectId)) {
      updateProjectApi(projectId, { name: trimmed }).catch((err) => {
        console.warn('TaskFlow: Backend project rename notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, recordAudit, showToast]);

  const updateProjectVisibility = useCallback((projectId: string, visibility: ProjectVisibility) => {
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
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

    if (isPersistedWorkItemId(projectId)) {
      updateProjectApi(projectId, { visibility: visibility === 'global' ? 'PUBLIC' : 'PRIVATE' }).catch((err) => {
        console.warn('TaskFlow: Backend visibility update notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, recordAudit, showToast]);

  const updateProjectKey = useCallback(async (projectId: string, newKey: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.EDIT_PROJECT_SETTINGS)) {
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
      if (isPersistedWorkItemId(projectId)) {
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
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.DELETE_PROJECT)) {
      showToast('Permission denied: Only Managers and Admins can delete projects', 'error');
      return false;
    }

    const target = projects.find((p) => p.id === projectId);
    if (!target) return false;

    const remainingProjects = projects.filter((p) => p.id !== projectId);
    setProjects(remainingProjects);

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

    setWorkflows((prev) => prev.filter((w) => w.projectId !== projectId));
    setAuditLog((prev) => prev.filter((a) => a.projectId !== projectId && a.entityId !== projectId));

    if (currentProjectId === projectId) {
      if (remainingProjects.length > 0) {
        setCurrentProjectId(remainingProjects[0].id);
      }
    }

    showToast(`Project "${target.name}" and associated data deleted`, 'info');
    navigate('/projects');

    if (isPersistedWorkItemId(projectId)) {
      deleteProjectApi(projectId).catch((err) => {
        console.warn('TaskFlow: Backend project deletion notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, tasks, currentProjectId, navigate, showToast]);

  const addProjectMember = useCallback(async (projectId: string, userId: string, role: Role = 'Teammate', user?: User): Promise<boolean> => {
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return false;

    if ((targetProj.memberIds || []).includes(userId)) {
      showToast('User is already a project member', 'error');
      return false;
    }

    if (user) {
      setAllUsers((prev) => {
        if (prev.some((u) => u.id === user.id)) return prev;
        return [...prev, user];
      });
    }

    if (isPersistedWorkItemId(projectId)) {
      try {
        await addProjectMemberApi(projectId, { memberId: userId, role: toBackendProjectRole(role) });
      } catch (err: any) {
        console.warn('TaskFlow: Backend add member error:', err.message);
        showToast(err.message || 'Failed to add member to project', 'error');
        return false;
      }
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

    const userObj = user || allUsers.find((u) => u.id === userId);
    recordAudit('member_added', 'project', projectId, `Added ${userObj?.name || userId} (${role}) to project`, null, { userId, role }, false, projectId);
    showToast(`Added ${userObj?.name || 'member'} to project`, 'success');
    return true;
  }, [projects, allUsers, recordAudit, showToast]);

  const removeProjectMember = useCallback((projectId: string, userId: string) => {
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.MANAGE_MEMBERS)) {
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

    if (isPersistedWorkItemId(projectId)) {
      removeProjectMemberApi(projectId, userId).catch((err) => {
        console.warn('TaskFlow: Backend remove member notice:', err.message);
      });
    }

    return true;
  }, [currentUser.role, projects, allUsers, recordAudit, showToast]);

  const updateProjectMemberRole = useCallback((projectId: string, userId: string, newRole: Role) => {
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.MANAGE_MEMBERS)) {
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

    if (currentUser?.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: newRole }));
    }

    const userObj = allUsers.find((u) => u.id === userId);
    recordAudit('role_changed', 'project', projectId, `Changed role of ${userObj?.name || userId} to ${newRole}`, null, { userId, role: newRole }, false, projectId);
    showToast(`Role updated to ${newRole}`, 'success');

    if (isPersistedWorkItemId(projectId)) {
      updateProjectMemberRoleApi(projectId, userId, toBackendProjectRole(newRole)).catch((err) => {
        console.warn('TaskFlow: Backend update member role notice:', err.message);
        showToast(err.message || 'Failed to persist member role update', 'error');
      });
    }

    return true;
  }, [currentUser, projects, allUsers, recordAudit, showToast]);

  const markNotificationRead = useCallback((notifId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
    if (isPersistedWorkItemId(notifId)) {
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

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
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

      const [projs, usersRes, notifsRes] = await Promise.all([
        getProjectsApi().catch(() => null),
        getOrganizationUsersApi().catch(() => null),
        getUserNotificationsApi().catch(() => null),
      ]);

      if (usersRes?.data && Array.isArray(usersRes.data)) {
        const mappedUsers: User[] = usersRes.data.map((usr: any) => ({
          id: usr.id,
          name: usr.fullName || usr.name || usr.email.split('@')[0],
          fullName: usr.fullName || usr.name || undefined,
          displayName: usr.displayName || usr.fullName || usr.name || undefined,
          email: usr.email,
          role: normalizeRole(usr.role),
          initials: (usr.fullName || usr.name || usr.email || 'U').slice(0, 2).toUpperCase(),
          companyId: usr.organizationId,
        }));
        setAllUsers(mappedUsers);
      }

      if (notifsRes?.data && Array.isArray(notifsRes.data)) {
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

      let targetProjectId = '';
      if (projs?.data && Array.isArray(projs.data) && projs.data.length > 0) {
        const mapped = projs.data.map(backendProjectToFrontend);
        setProjects(mapped);
        targetProjectId = mapped[0].id;
        setCurrentProjectId(targetProjectId);
      }

      if (targetProjectId) {
        await fetchProjectAssets(targetProjectId, true);
      }

      showToast(`Welcome back, ${u.name}!`, 'success');
      return true;
    }
    return false;
  }, [fetchProjectAssets, showToast]);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => null);
    clearAuthToken();
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.COMPANY);
    } catch {}
    setCurrentUser(emptyUser);
    setCurrentCompany(null);
    setProjects([]);
    setTasks([]);
    setSprints([]);
    setLabels([]);
    setAllUsers([]);
    setAuditLog([]);
    setNotifications([]);
    setCurrentProjectId('');
    lastLoadedProjectIdRef.current = null;
    showToast('Signed out successfully', 'info');
    navigate('/login');
  }, [navigate, showToast]);

  const register = useCallback(async (params: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
  }): Promise<boolean> => {
    const orgName = (params.companyName || `${params.name.trim()}'s Workspace`).trim();
    const res = await registerOrganizationApi({
      user: {
        fullName: params.name.trim(),
        email: params.email.trim(),
        password: params.password,
      },
      organization: {
        name: orgName,
      },
    });

    if (res?.user) {
      const u = res.user;
      const org = res.organization || { id: res.organizationId, name: orgName };
      const mappedUser: User = {
        id: u.id,
        name: u.name || u.fullName || params.name.trim(),
        email: u.email,
        role: normalizeRole(u.role),
        companyId: org?.id,
        companyName: org?.name,
        onboardingCompleted: false,
      };
      const mappedCompany: Company = {
        id: org?.id || res.organizationId || `comp-${u.id}`,
        name: org?.name || orgName,
        createdByUserId: u.id,
        createdAt: new Date().toISOString(),
      };
      setCurrentUser(mappedUser);
      setCurrentCompany(mappedCompany);
      saveStateToStorage('CURRENT_USER', mappedUser);
      saveStateToStorage('COMPANY', mappedCompany);

      getProjectsApi()
        .then((pRes) => {
          if (pRes?.data && Array.isArray(pRes.data)) {
            setProjects(pRes.data.map(backendProjectToFrontend));
          }
        })
        .catch(() => null);

      return true;
    }
    return false;
  }, []);

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
      const existingCompany = currentCompany;
      const newCompany: Company = {
        id: existingCompany?.id || `comp-${Date.now()}`,
        name: trimmed,
        createdByUserId: currentUser?.id || '',
        createdAt: existingCompany?.createdAt || new Date().toISOString(),
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
  }, [currentUser, currentCompany, recordAudit]);

  const finishOnboarding = useCallback(() => {
    setCurrentUser((prev) => {
      const updated: User = {
        ...prev,
        onboardingCompleted: true,
      };
      saveStateToStorage('CURRENT_USER', updated);
      return updated;
    });
  }, []);

  const createSprint = useCallback(async (sprintData: Partial<Sprint> & {
    workItemIds?: string[];
  }) => {
    const targetProjectId = sprintData.projectId || currentProjectId;
    const workItemIds = sprintData.workItemIds || [];

    if (workItemIds.some((id) => !isPersistedWorkItemId(id))) {
      const error = new Error(
        'Only persisted database work items can be added to a sprint.',
      );
      showToast(error.message, 'error');
      throw error;
    }

    try {
      const res = await createSprintApi(targetProjectId, {
        name: (sprintData.name || '').trim(),
        goal: sprintData.goal || null,
        startDate: sprintData.startDate || new Date().toISOString().split('T')[0],
        endDate: sprintData.endDate || new Date().toISOString().split('T')[0],
        workItemIds,
      });
      const responseSprint = res?.data?.sprint || res?.data;
      if (!responseSprint?.id) {
        throw new Error('The server did not return the created sprint.');
      }

      const savedSprint = backendSprintToFrontend({
        ...responseSprint,
        projectId: responseSprint.projectId || targetProjectId,
        workItems: res?.data?.workItems || responseSprint.workItems,
      });
      const returnedWorkItems: Task[] = Array.isArray(res?.data?.workItems)
        ? res.data.workItems.map((item: any) => backendWorkItemToTask(item, targetProjectId))
        : [];

      setSprints((prev) => [savedSprint, ...prev.filter((s) => s.id !== savedSprint.id)]);
      if (returnedWorkItems.length > 0) {
        setTasks((prev) => {
          const returnedById = new Map(returnedWorkItems.map((task) => [task.id, task]));
          const merged = prev.map((task) => returnedById.get(task.id) || (
            savedSprint.workItemIds?.includes(task.id)
              ? { ...task, sprintId: savedSprint.id }
              : task
          ));
          const existingIds = new Set(prev.map((task) => task.id));
          return [...merged, ...returnedWorkItems.filter((task) => !existingIds.has(task.id))];
        });
      } else if (savedSprint.workItemIds?.length) {
        setTasks((prev) =>
          prev.map((task) =>
            savedSprint.workItemIds!.includes(task.id)
              ? { ...task, sprintId: savedSprint.id }
              : task
          )
        );
      }

      recordAudit('created', 'sprint', savedSprint.id, `Created sprint "${savedSprint.name}"`, null, savedSprint, false, targetProjectId);
      showToast(`Sprint "${savedSprint.name}" created`, 'success');
      return { success: true, sprint: savedSprint, workItems: returnedWorkItems };
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to create sprint on server';
      showToast(errMsg, 'error');
      throw err;
    }
  }, [currentProjectId, recordAudit, showToast]);

  const createLabel = useCallback((labelData: Partial<Label>): Label => {
    const targetProjectId = labelData.projectId || currentProjectId || currentProject?.id || '';
    const tempId = `lbl-${Date.now()}`;
    const newLabel: Label = {
      id: tempId,
      name: (labelData.name || '').trim(),
      color: labelData.color || '#3B82F6',
      projectId: targetProjectId,
      description: labelData.description || '',
    };
    setLabels((prev) => [...prev, newLabel]);
    recordAudit('created', 'label', newLabel.id, `Created label "${newLabel.name}"`, null, newLabel, false, targetProjectId);
    showToast(`Label "${newLabel.name}" created`, 'success');

    if (isPersistedWorkItemId(targetProjectId)) {
      createProjectLabelApi(targetProjectId, {
        name: newLabel.name,
        color: newLabel.color,
        description: newLabel.description,
      }).then((res) => {
        const serverLabel = res?.data;
        if (serverLabel?.id) {
          setLabels((prev) => prev.map((l) => (l.id === tempId ? { ...l, id: serverLabel.id } : l)));
        }
      }).catch((err) => {
        console.warn('TaskFlow: Backend label save notice:', err.message);
        setLabels((prev) => prev.filter((l) => l.id !== tempId));
        showToast(err.message || 'Failed to save label to backend', 'error');
      });
    }

    return newLabel;
  }, [currentProjectId, currentProject, recordAudit, showToast]);

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
      const projId = target.projectId || currentProjectId;
      if (isPersistedWorkItemId(projId) && isPersistedWorkItemId(labelId)) {
        deleteProjectLabelApi(projId, labelId).catch((err) => {
          console.warn('TaskFlow: Backend label delete notice:', err.message);
          showToast(err.message || 'Failed to delete label on server', 'error');
        });
      }
    }
    showToast('Label removed', 'info');
  }, [labels, currentProjectId, recordAudit, showToast]);

  const value: AppContextValue = useMemo(() => ({
    currentUser,
    currentCompany,
    register,
    registerUser,
    completeCompanyOnboarding,
    finishOnboarding,
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
    loadCrossProjectTasks,
    createTask,
    uploadTaskAttachments,
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
    allUsers,
    login,
    logout,
    isLoadingBackend,
    isInitializingAuth,
    sprints,
    projectSprints,
    createSprint,
    labels,
    projectLabels,
    createLabel,
    deleteLabel,
    isLoadingProjectData,
    projectDataError,
    reloadProjectData,
  }), [
    currentUser,
    currentCompany,
    register,
    registerUser,
    completeCompanyOnboarding,
    finishOnboarding,
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
    currentProject,
    projectTab,
    workflows,
    currentWorkflow,
    tasks,
    projectTasks,
    myTasks,
    loadCrossProjectTasks,
    createTask,
    uploadTaskAttachments,
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
    searchQuery,
    impactModalData,
    conflictModalData,
    toasts,
    showToast,
    crossTabIndicator,
    allUsers,
    login,
    logout,
    isLoadingBackend,
    isInitializingAuth,
    sprints,
    projectSprints,
    createSprint,
    labels,
    projectLabels,
    createLabel,
    deleteLabel,
    isLoadingProjectData,
    projectDataError,
    reloadProjectData,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}