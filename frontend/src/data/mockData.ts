/**
 * Mock data for the TaskFlow Pro dashboard.
 * Structured to be easily replaceable with API responses.
 * All IDs are stable for use as React keys.
 */

export interface MockUser {
  id: string;
  name: string;
  initials: string;
  role?: string;
  avatarColor: string;
}

export const currentUser: MockUser = {
  id: 'user-1',
  name: 'Yash Kshatriya',
  initials: 'YK',
  role: 'Manager',
  avatarColor: '#4f46e5',
};

export interface MetricItem {
  id: string;
  label: string;
  value: number;
  detail: string;
  urgent?: boolean;
  positive?: boolean;
}

export const metrics: MetricItem[] = [
  {
    id: 'metric-tasks',
    label: 'My Tasks',
    value: 24,
    detail: '8 due this week',
  },
  {
    id: 'metric-due-soon',
    label: 'Due Soon',
    value: 8,
    detail: 'Next 7 days',
  },
  {
    id: 'metric-overdue',
    label: 'Overdue',
    value: 3,
    detail: 'Needs attention',
    urgent: true,
  },
  {
    id: 'metric-completed',
    label: 'Completed',
    value: 42,
    detail: 'This month',
    positive: true,
  },
];

export function getComputedMetrics(taskList: any[]): MetricItem[] {
  const addedCount = Math.max(0, taskList.length - 5);
  return metrics.map((m) => {
    if (m.id === 'metric-tasks') {
      return { ...m, value: 24 + addedCount };
    }
    return m;
  });
}

export const PRIORITY = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
} as const;

export const STATUS = {
  BACKLOG: 'Backlog',
  TODO: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  TESTING_QA: 'Testing / QA',
  BLOCKED: 'Blocked',
  ON_HOLD: 'On Hold',
  DONE: 'Done',
} as const;

export const teamMembers: MockUser[] = [
  { id: 'user-1', name: 'Yash Kshatriya', initials: 'YK', avatarColor: '#4f46e5' },
  { id: 'user-2', name: 'Rohan Mehta', initials: 'RM', avatarColor: '#0891b2' },
  { id: 'user-3', name: 'Diya Sharma', initials: 'DS', avatarColor: '#7c3aed' },
  { id: 'user-4', name: 'Maithil Patel', initials: 'MP', avatarColor: '#059669' },
  { id: 'user-5', name: 'Jatin Kumar', initials: 'JK', avatarColor: '#d97706' },
];

export interface MockTask {
  id: string;
  title: string;
  project: string;
  priority: string;
  status: string;
  dueDate: string;
  assignee: MockUser;
}

export const tasks: MockTask[] = [
  {
    id: 'task-1',
    title: 'Implement authentication API',
    project: 'TaskFlow Pro',
    priority: PRIORITY.HIGH,
    status: STATUS.IN_PROGRESS,
    dueDate: '2026-10-10',
    assignee: teamMembers[1],
  },
  {
    id: 'task-2',
    title: 'Design project member management',
    project: 'TaskFlow Pro',
    priority: PRIORITY.MEDIUM,
    status: STATUS.IN_REVIEW,
    dueDate: '2026-10-11',
    assignee: teamMembers[2],
  },
  {
    id: 'task-3',
    title: 'Fix dashboard responsive layout',
    project: 'TaskFlow Pro',
    priority: PRIORITY.HIGH,
    status: STATUS.BLOCKED,
    dueDate: '2026-10-12',
    assignee: teamMembers[0],
  },
  {
    id: 'task-4',
    title: 'Create notification system',
    project: 'TaskFlow Pro',
    priority: PRIORITY.MEDIUM,
    status: STATUS.TODO,
    dueDate: '2026-10-14',
    assignee: teamMembers[4],
  },
  {
    id: 'task-5',
    title: 'Prepare API integration tests',
    project: 'TaskFlow Pro',
    priority: PRIORITY.LOW,
    status: STATUS.IN_PROGRESS,
    dueDate: '2026-10-15',
    assignee: teamMembers[3],
  },
];

export interface MockProject {
  id: string;
  name: string;
  description: string;
  progress: number;
  activeTasks: number;
  members: number;
  deadline: string;
  color: string;
}

export const projects: MockProject[] = [
  {
    id: 'proj-1',
    name: 'TaskFlow Pro',
    description: 'Smart team task management system',
    progress: 68,
    activeTasks: 12,
    members: 8,
    deadline: '2026-10-30',
    color: '#4f46e5',
  },
  {
    id: 'proj-2',
    name: 'AgriSmart AI',
    description: 'AI-powered crop disease detection',
    progress: 82,
    activeTasks: 6,
    members: 6,
    deadline: '2026-11-05',
    color: '#059669',
  },
  {
    id: 'proj-3',
    name: 'GeoVision AI',
    description: 'Geospatial site readiness platform',
    progress: 54,
    activeTasks: 18,
    members: 5,
    deadline: '2026-11-18',
    color: '#0891b2',
  },
];

export interface MockRecentActivity {
  id: string;
  user: MockUser;
  action: string;
  target: string;
  detail: string;
  time: string;
}

export const recentActivity: MockRecentActivity[] = [
  {
    id: 'act-1',
    user: teamMembers[1],
    action: 'moved',
    target: 'Authentication API',
    detail: 'to In Review',
    time: '12 min ago',
  },
  {
    id: 'act-2',
    user: teamMembers[2],
    action: 'completed',
    target: 'Dashboard UI',
    detail: '',
    time: '34 min ago',
  },
  {
    id: 'act-3',
    user: teamMembers[3],
    action: 'added a comment to',
    target: 'Project Setup',
    detail: '',
    time: '1 hr ago',
  },
  {
    id: 'act-4',
    user: teamMembers[4],
    action: 'was assigned to',
    target: 'Database Schema',
    detail: '',
    time: '2 hr ago',
  },
  {
    id: 'act-5',
    user: teamMembers[0],
    action: 'created',
    target: 'Sprint Planning',
    detail: '',
    time: '3 hr ago',
  },
];

export interface DueDateStatus {
  text: string;
  isOverdue: boolean;
  isDueSoon?: boolean;
}

/**
 * Helper: Format a date string relative to today.
 * Returns "Today", "Tomorrow", "Overdue", or formatted date.
 */
export function formatDueDate(dateStr: string): DueDateStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `Overdue (${formatShortDate(due)})`, isOverdue: true };
  if (diffDays === 0) return { text: 'Today', isOverdue: false, isDueSoon: true };
  if (diffDays === 1) return { text: 'Tomorrow', isOverdue: false, isDueSoon: true };
  if (diffDays <= 7) return { text: formatShortDate(due), isOverdue: false, isDueSoon: true };
  return { text: formatShortDate(due), isOverdue: false, isDueSoon: false };
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDeadline(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
