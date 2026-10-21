/**
 * Core Type Definitions for TaskFlow Pro.
 * Preserves exact runtime values, storage contracts, and property names.
 */

export type Role = 'Admin' | 'Manager' | 'Teammate';

export interface Company {
  id: string;
  name: string;
  createdByUserId: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  role: Role;
  avatar?: string;
  color?: string;
  initials?: string;
  avatarColor?: string;
  title?: string;
  companyId?: string;
  companyName?: string;
  onboardingCompleted?: boolean;
}

export type WorkItemType = 'Epic' | 'Story' | 'Task' | 'Subtask' | 'Bug';

export type DefaultTaskStatus =
  | 'Backlog'
  | 'In Progress'
  | 'In Review'
  | 'Testing / QA'
  | 'Blocked'
  | 'On Hold'
  | 'Done';

export type TaskStatus = DefaultTaskStatus | string;

export type Priority = 'Low' | 'Medium' | 'High';

export type BugSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface EmbeddedSubtask {
  id: string;
  title: string;
  completed: boolean;
  assigneeId?: string | null;
}

export interface TaskComment {
  id: string;
  userId?: string;
  authorId?: string;
  text?: string;
  body?: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  hours?: number;
  durationMinutes?: number;
  date?: string;
  startTime?: string;
  note?: string;
  description?: string;
}

export interface RecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | string;
  interval: number;
  endType?: 'never' | 'after' | 'on_date' | string;
  endCount?: number;
  endDate?: string;
}

export interface SlaInfo {
  isBreached: boolean;
  isApproaching: boolean;
  isEscalated: boolean;
  hoursRemaining?: number;
  thresholdHours?: number;
  elapsedHours?: number;
  badgeClass?: string;
  label?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  blobKey?: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  sectionId?: string;
  type: WorkItemType;
  status: TaskStatus;
  priority?: Priority | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
  assignees?: User[];
  labels?: string[];
  sprintId?: string | null;
  creatorId?: string;
  parentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  estimateHours?: number | null;
  actualHours?: number;
  tags?: string[];
  order?: number;
  dependencies?: string[];
  subtasks?: EmbeddedSubtask[];
  comments?: TaskComment[];
  timeEntries?: TimeEntry[];
  recurrence?: RecurrenceConfig | null;
  slaStatus?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  attachments?: TaskAttachment[];

  // Epic specific fields
  businessGoal?: string;
  successCriteria?: string;

  // Story specific fields
  acceptanceCriteria?: string;

  // Bug specific fields
  severity?: BugSeverity;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  environment?: string;

  [key: string]: any;
}

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  workItemIds?: string[];
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  projectId?: string;
  description?: string;
}

export interface WorkflowStatus {
  id: string;
  name: TaskStatus;
  category?: 'backlog' | 'active' | 'done' | string;
  color: string;
  allowedTransitions?: string[];
  roleRestrictions?: Record<string, string[]>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  statuses: WorkflowStatus[];
  [key: string]: any;
}

export interface ProjectSection {
  id: string;
  name: string;
  order?: number;
}

export interface ProjectSettings {
  slaHighHours?: number;
  slaMediumHours?: number;
  slaLowHours?: number;
  autoSchedule?: boolean;
  workingDaysOnly?: boolean;
  [key: string]: any;
}

export type ProjectVisibility = 'global' | 'private';

export interface Project {
  id: string;
  name: string;
  projectKey?: string;
  description?: string;
  color: string;
  ownerId: string;
  memberIds: string[];
  memberRoles?: Record<string, Role>;
  visibility?: ProjectVisibility;
  status: 'On Track' | 'At Risk' | 'Delayed' | string;
  startDate?: string;
  dueDate?: string;
  workflowId?: string;
  workflow?: Workflow;
  sections?: ProjectSection[];
  settings?: ProjectSettings;
  [key: string]: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message?: string;
  description?: string;
  type: 'mention' | 'assignment' | 'sla' | 'system' | string;
  read: boolean;
  timestamp?: string;
  createdAt?: string;
  targetTaskId?: string;
  targetProjectId?: string;
  actionUrl?: string;
  [key: string]: any;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  actorId?: string;
  actorName?: string;
  userEmail?: string;
  action: string;
  entityType: 'task' | 'project' | 'workflow' | string;
  entityId: string;
  entityTitle?: string | null;
  projectId?: string;
  description: string;
  timestamp: string;
  previousState?: any;
  newState?: any;
  previousValue?: any;
  newValue?: any;
  canUndo?: boolean;
  isUndone?: boolean;
  undoneAt?: string | null;
  reversalLogId?: string | null;
  [key: string]: any;
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  type?: ToastType;
}

export interface AppContextValue {
  currentUser: User;
  currentCompany: Company | null;
  registerUser: (userData: { name: string; email: string }) => User;
  completeCompanyOnboarding: (companyName: string, markComplete?: boolean) => boolean;
  finishOnboarding: () => void;
  projects: Project[];
  createProject: (projectData: Partial<Project>) => Project | null;
  updateProject: (projectId: string, updates: Partial<Project>) => boolean;
  renameProject: (projectId: string, name: string) => boolean;
  updateProjectVisibility: (projectId: string, visibility: ProjectVisibility) => boolean;
  updateProjectKey: (projectId: string, key: string) => Promise<{ success: boolean; error?: string }>;
  deleteProject: (projectId: string) => boolean;
  addProjectMember: (projectId: string, userId: string, role?: Role) => void;
  removeProjectMember: (projectId: string, userId: string) => boolean;
  updateProjectMemberRole: (projectId: string, userId: string, role: Role) => boolean;
  currentProjectId: string;
  setCurrentProjectId: (id: string | ((prev: string) => string)) => void;
  currentProject?: Project;
  projectTab: string;
  setProjectTab: (tab: string) => void;
  workflows: Workflow[];
  currentWorkflow?: Workflow;
  setWorkflows: (workflows: Workflow[] | ((prev: Workflow[]) => Workflow[])) => void;
  tasks: Task[];
  projectTasks: Task[];
  myTasks: Task[];
  createTask: (taskData: any) => { success: boolean; task?: Task; reason?: string };
  updateTask: (taskId: string, updates: any, snapshotVersion?: any) => { success: boolean; reason?: string };
  deleteTask: (taskId: string) => void;
  changeTaskStatus: (taskId: string, newStatus: string) => boolean;
  requestReschedule: (taskId: string, newDueDate: string) => void;
  confirmRescheduleImpact: () => void;
  addDependency: (predecessorId: string, successorId: string) => any;
  removeDependency: (predecessorId: string, successorId: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  addComment: (taskId: string, text: string) => Promise<void>;
  pendingSignupPassword?: string;
  setPendingSignupPassword?: (pwd: string) => void;
  logTimeEntry: (taskId: string, hours: number, note?: string) => void;
  escalateTask: (taskId: string) => void;
  simulateExternalTaskEdit: (taskId: string) => void;
  auditLog: AuditLogEntry[];
  undoAuditEntry: (entryId: string) => void;
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  activeRoute: string;
  navigate: (route: string) => void;
  activeDrawerTaskId: string | null;
  setActiveDrawerTaskId: (id: string | null) => void;
  openTaskDrawer: (id: string | null) => void;
  closeTaskDrawer: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  impactModalData: any;
  setImpactModalData: (data: any) => void;
  conflictModalData: any;
  setConflictModalData: (data: any) => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  crossTabIndicator: boolean;
  allUsers: User[];
  sprints: Sprint[];
  projectSprints: Sprint[];
  createSprint: (sprintData: Partial<Sprint>) => Promise<{ success: boolean; sprint?: Sprint; reason?: string }>;
  labels: Label[];
  projectLabels: Label[];
  createLabel: (labelData: Partial<Label>) => Label;
  deleteLabel: (labelId: string) => void;
  login?: (email: string, password: string) => Promise<boolean>;
  logout?: () => Promise<void>;
  isLoadingBackend?: boolean;
  [key: string]: any;
}
