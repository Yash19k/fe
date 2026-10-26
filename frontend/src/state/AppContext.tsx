import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContextInstance';
import { loadInitialState, saveStateToStorage, DEFAULT_STANDARD_WORKFLOW, STORAGE_KEYS, emptyUser } from './storage';
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
  escalateWorkItemApi,
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

  // Parallelized project asset loader: work items, sprints, members, labels, workflow, and audit logs
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

      // Guard against stale responses when switching projects rapidly
      if (currentSeq !== projectFetchSeqRef.current) {
        return;
      }

      if (itemsRes && 'error' in itemsRes) {
        setProjectDataError((itemsRes as any).error?.message || 'Failed to load project work items');
      }

      // 1. Project work items / tasks
      if (itemsRes && !('error' in itemsRes) && itemsRes?.data?.workItems && Array.isArray(itemsRes.data.workItems)) {
        const mappedTasks = itemsRes.data.workItems.map((item: any) =>
          backendWorkItemToTask(item, projId)
        );
        setTasks((prev) => {
          const otherTasks = prev.filter((t) => t.projectId !== projId);
          return [...mappedTasks, ...otherTasks];
        });
      }

      // 2. Project sprints
      if (sprintsRes && !('error' in sprintsRes) && sprintsRes?.data && Array.isArray(sprintsRes.data)) {
        const mappedSprints = sprintsRes.data.map(backendSprintToFrontend);
        setSprints((prev) => {
          const otherSprints = prev.filter((s) => s.projectId !== projId);
          return [...mappedSprints, ...otherSprints];
        });
      }

      // 3. Project members
      if (membersRes && !('error' in membersRes) && membersRes?.data && Array.isArray(membersRes.data)) {
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

      // 4. Project labels
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

      // 5. Project workflow
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

      // 6. Project audit logs
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

  // Load authenticated backend data on boot with strict sequencing and parallel resource loading
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
          // If server is unreachable, do not clear local tokens so recovery is possible
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

          // Fetch organization users, projects, and notifications in parallel
          const [usersRes, projsRes, notifsRes] = await Promise.all([
            getOrganizationUsersApi().catch(() => null),
            getProjectsApi().catch(() => null),
            getUserNotificationsApi().catch(() => null),
          ]);

          if (usersRes?.data && Array.isArray(usersRes.data) && !isCancelled) {
            const mappedUsers: User[] = usersRes.data.map((usr: any) => ({
              id: usr.id,
              name: usr.fullName || usr.name || usr.email.split('@')[0],
              email: usr.email,
              role: normalizeRole(usr.role),
              initials: (usr.fullName || usr.email || 'U').slice(0, 2).toUpperCase(),
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

              if (hashProjId && mapped.some((p) => p.id === hashProjId)) {
                resolvedProjectId = hashProjId;
              } else if (currentProjectId && mapped.some((p) => p.id === currentProjectId)) {
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

          // Await active project assets so data is present before rendering the workspace
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

  // Fetch project details whenever active project changes and user is authenticated
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
      canUndo,
    };
    setAuditLog((prev) => [entry, ...prev]);

    const isTempId = typeof entityId === 'string' && entityId.startsWith('tf-');
    if (resolvedProjectId && resolvedProjectId.includes('-') && !isTempId) {
      createAuditLogApi({
        projectId: resolvedProjectId,
        workItemId: entityType === 'task' ? entityId : undefined,
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

  // Active project
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === currentProjectId) || projects[0] || null;
  }, [projects, currentProjectId]);

  // Active workflow
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

  // Tasks for current project
  const projectTasks = useMemo(() => {
    if (!currentProject) return [];
    return tasks.filter((t) => t.projectId === currentProject.id);
  }, [tasks, currentProject]);

  // Tasks assigned to current user
  const myTasks = useMemo(() => {
    if (!currentUser?.id) return [];
    return tasks.filter((t) => t.assigneeId === currentUser.id);
  }, [tasks, currentUser?.id]);

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
      creatorId: currentUser?.id || '',
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
        sprintId: isPersistedWorkItemId(newTask.sprintId)
          ? newTask.sprintId
          : null,
        parentWorkItemId: isPersistedWorkItemId(newTask.parentId)
          ? newTask.parentId
          : null,
        type: frontendTypeToBackend(newTask.type),
        title: newTask.title,
        description: newTask.description || null,
        priority: frontendPriorityToBackend(newTask.priority),
        status: frontendStatusToBackend(newTask.status),
        dueDate: newTask.dueDate || null,
        assignees: (newTask.assigneeIds || []).map((userId) => ({ userId })),
      }).then((res) => {
        const serverItem = res?.data || res?.workItem;
        if (serverItem?.id) {
          const authoritativeTask = backendWorkItemToTask(serverItem, serverItem.projectId || newTask.projectId);
          setTasks((prev) => prev.map((t) => {
            const task = t.id === newTask.id ? { ...t, ...authoritativeTask } : t;
            return {
              ...task,
              parentId: task.parentId === newTask.id ? authoritativeTask.id : task.parentId,
              dependencyIds: (task.dependencyIds || []).map((id: string) =>
                id === newTask.id ? authoritativeTask.id : id
              ),
              subtasks: (task.subtasks || []).map((subtask) =>
                subtask.id === newTask.id
                  ? { ...subtask, id: authoritativeTask.id }
                  : subtask
              ),
            };
          }));
          setSprints((prev) => prev.map((sprint) => ({
            ...sprint,
            workItemIds: (sprint.workItemIds || []).map((id) =>
              id === newTask.id ? authoritativeTask.id : id
            ),
          })));
          setActiveDrawerTaskId((activeId) =>
            activeId === newTask.id ? authoritativeTask.id : activeId
          );
          if (authoritativeTask.projectId && authoritativeTask.projectId.includes('-')) {
            createAuditLogApi({
              projectId: authoritativeTask.projectId,
              workItemId: serverItem.id,
              action: 'created',
              entityType: 'task',
              entityId: serverItem.id,
              description: `Created ${authoritativeTask.type || 'Task'} "${authoritativeTask.title}"`,
              previousState: null,
              newState: authoritativeTask,
            }).catch(() => null);
          }
        }
      }).catch((err) => {
        setTasks((prev) => prev.filter((task) => task.id !== newTask.id));
        console.warn('TaskFlow: Backend task creation notice:', err.message);
        showToast(`Failed to persist task: ${err.message}`, 'error');
      });
    }

    return { success: true, task: newTask };
  }, [currentUser, currentProjectId, currentProject, projects, tasks, recordAudit, showToast]);

  const updateTask = useCallback((taskId: string, updates: any, snapshotVersion: number | null = null) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return { success: false, reason: 'Task not found' };

    // Version conflict check
    if (snapshotVersion !== null && (target.version || 1) !== snapshotVersion) {
      setConflictModalData({
        taskId,
        snapshotVersion,
        latestTask: target,
        pendingUpdates: updates,
      });
      return { success: false, reason: 'Version conflict' };
    }

    // Hierarchy validation if type or parentId updated
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

    setTasks((prev) => {
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

    recordAudit('updated', 'task', taskId, `Updated ${updated.type || 'task'} "${updated.title}"`, target, updated, true, updated.projectId);
    broadcastEvent('TASK_UPDATED', updated);
    showToast(`${updated.type || 'Task'} "${updated.title}" updated`, 'success');

    if (isPersistedWorkItemId(taskId)) {
      const backendUpdates: any = {};
      if (updates.sprintId !== undefined) backendUpdates.sprintId = updates.sprintId || null;
      if (updates.title !== undefined) backendUpdates.title = updates.title;
      if (updates.description !== undefined) backendUpdates.description = updates.description;
      if (updates.status !== undefined) backendUpdates.status = frontendStatusToBackend(updates.status);
      if (updates.type !== undefined) backendUpdates.type = frontendTypeToBackend(updates.type);
      if (updates.priority !== undefined) backendUpdates.priority = frontendPriorityToBackend(updates.priority);
      if (updates.dueDate !== undefined) backendUpdates.dueDate = updates.dueDate || null;
      if (updates.parentId !== undefined) backendUpdates.parentWorkItemId = updates.parentId || null;
      if (updates.assignees !== undefined) {
        const mapped = Array.isArray(updates.assignees)
          ? updates.assignees
              .map((a: any) => (typeof a === 'string' ? a : a.userId || a.id))
              .filter((id: any) => typeof id === 'string' && id.trim().length > 0)
          : [];
        backendUpdates.assigneeIds = mapped;
        backendUpdates.assignees = mapped.map((uid: string) => ({ userId: uid }));
        backendUpdates.assigneeId = mapped[0] || null;
      } else if (updates.assigneeIds !== undefined) {
        const validIds = Array.isArray(updates.assigneeIds)
          ? updates.assigneeIds.filter((id: any) => typeof id === 'string' && id.trim().length > 0)
          : [];
        backendUpdates.assigneeIds = validIds;
        backendUpdates.assignees = validIds.map((uid: string) => ({ userId: uid }));
        backendUpdates.assigneeId = validIds[0] || null;
      } else if (updates.assigneeId !== undefined) {
        const validId =
          updates.assigneeId && typeof updates.assigneeId === 'string' && updates.assigneeId.trim().length > 0
            ? updates.assigneeId.trim()
            : null;
        backendUpdates.assigneeId = validId;
        backendUpdates.assigneeIds = validId ? [validId] : [];
        backendUpdates.assignees = validId ? [{ userId: validId }] : [];
      }

      if (Object.keys(backendUpdates).length > 0) {
        updateWorkItemApi(taskId, backendUpdates)
          .then((res) => {
            if (res?.data) {
              const authoritativeTask = backendWorkItemToTask(
                res.data,
                res.data.projectId || currentProjectId
              );
              setTasks((currentTasks) =>
                currentTasks.map((t) =>
                  t.id === taskId ? { ...t, ...authoritativeTask } : t
                )
              );
            }
          })
          .catch((err) => {
            console.warn('TaskFlow: Backend task update notice:', err.message);
            showToast(`Failed to persist changes: ${err.message}`, 'error');
          });
      }
    }

    return { success: true };
  }, [tasks, recordAudit, showToast, currentProjectId]);

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

    if (isPersistedWorkItemId(successorId) && isPersistedWorkItemId(predecessorId)) {
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

    if (isPersistedWorkItemId(successorId) && isPersistedWorkItemId(predecessorId)) {
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

  // Time tracking
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

  // SLA Escalation
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

  // Undo Audit Entry (Persisted authoritative backend operation)
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
        // 1. If backend restored the task, update task state authoritatively
        if (res.data?.restoredTask) {
          const authoritative = backendWorkItemToTask(res.data.restoredTask, projectId);
          setTasks((prev) =>
            prev.map((t) => (t.id === entry.entityId ? { ...t, ...authoritative } : t))
          );
        }

        // 2. Update audit log state authoritatively
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

          // Prepend reversal log if provided
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

    if (typeof projectId === 'string' && projectId.includes('-')) {
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

    if (typeof projectId === 'string' && projectId.includes('-')) {
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
    if (!currentUser || !hasPermission(currentUser.role, PERMISSIONS.DELETE_PROJECT)) {
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

    if (typeof projectId === 'string' && projectId.includes('-')) {
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

    if (typeof projectId === 'string' && projectId.includes('-')) {
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

    // If updating current user's role, sync currentUser state
    if (currentUser?.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: newRole }));
    }

    const userObj = allUsers.find((u) => u.id === userId);
    recordAudit('role_changed', 'project', projectId, `Changed role of ${userObj?.name || userId} to ${newRole}`, null, { userId, role: newRole }, false, projectId);
    showToast(`Role updated to ${newRole}`, 'success');

    if (typeof projectId === 'string' && projectId.includes('-')) {
      updateProjectMemberRoleApi(projectId, userId, toBackendProjectRole(newRole)).catch((err) => {
        console.warn('TaskFlow: Backend update member role notice:', err.message);
        showToast(err.message || 'Failed to persist member role update', 'error');
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

      // Fetch projects, organization users, and notifications in parallel
      const [projs, usersRes, notifsRes] = await Promise.all([
        getProjectsApi().catch(() => null),
        getOrganizationUsersApi().catch(() => null),
        getUserNotificationsApi().catch(() => null),
      ]);

      if (usersRes?.data && Array.isArray(usersRes.data)) {
        const mappedUsers: User[] = usersRes.data.map((usr: any) => ({
          id: usr.id,
          name: usr.fullName || usr.name || usr.email.split('@')[0],
          email: usr.email,
          role: normalizeRole(usr.role),
          initials: (usr.fullName || usr.email || 'U').slice(0, 2).toUpperCase(),
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
    } catch {
      // storage cleanup fallback
    }
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
        createdByUserId: currentUser?.id || '',
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
      const updated: User = {
        ...prev,
        onboardingCompleted: true,
      };
      saveStateToStorage('CURRENT_USER', updated);
      return updated;
    });
  }, []);

  // Sprint operations
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

  // Label operations
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

    if (targetProjectId && targetProjectId.includes('-')) {
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
      if (projId && !labelId.startsWith('lbl-')) {
        deleteProjectLabelApi(projId, labelId).catch((err) => {
          console.warn('TaskFlow: Backend label delete notice:', err.message);
          showToast(err.message || 'Failed to delete label on server', 'error');
        });
      }
    }
    showToast('Label removed', 'info');
  }, [labels, currentProjectId, recordAudit, showToast]);

  const value: AppContextValue = {
    currentUser,
    currentCompany,
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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
