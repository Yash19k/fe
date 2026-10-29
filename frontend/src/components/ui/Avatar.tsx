import React from 'react';
import { User, Task } from '../../types';

export interface AvatarProps {
  user?: Partial<User> | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  className?: string;
}

export function Avatar({ user, size = 'md', showName = false, className = '' }: AvatarProps) {
  const sizeClasses: Record<string, string> = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-6 h-6 text-[11px]',
    md: 'w-7 h-7 text-xs',
    lg: 'w-9 h-9 text-sm',
    xl: 'w-11 h-11 text-base',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  if (!user) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div
          className={`${selectedSize} rounded-full bg-surface-active border border-border flex items-center justify-center text-[10px] text-text-muted flex-shrink-0 select-none`}
          title="Unassigned"
          aria-label="Unassigned"
        >
          ?
        </div>
        {showName && <span className="text-xs text-text-muted">Unassigned</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div
        className={`${selectedSize} rounded-full flex items-center justify-center font-medium text-white flex-shrink-0 border border-white/10 ring-2 ring-surface select-none`}
        style={{ backgroundColor: user.avatarColor || user.color || '#4F46E5' }}
        title={`${user.name || 'User'}${user.role ? ` (${user.role})` : ''}`}
        aria-label={user.name || 'User'}
      >
        {user.initials || (user.name || user.fullName || 'U').substring(0, 2).toUpperCase()}
      </div>
      {showName && (
        <span className="text-xs text-text-primary font-medium truncate max-w-[120px]">
          {user.name || user.fullName || 'User'}
        </span>
      )}
    </div>
  );
}

export interface AvatarGroupProps {
  users?: Partial<User>[];
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarGroup({ users = [], max = 3, size = 'xs', className = '' }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  const sizeClasses: Record<string, string> = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-7 h-7 text-xs',
    lg: 'w-9 h-9 text-sm',
  };

  const badgeSize = sizeClasses[size] || sizeClasses.xs;

  return (
    <div className={`flex items-center -space-x-1.5 overflow-hidden ${className}`}>
      {visible.map((u, idx) => (
        <Avatar key={u.id || u.name || idx} user={u} size={size} />
      ))}
      {remaining > 0 && (
        <div
          className={`${badgeSize} rounded-full bg-surface-elevated border border-border flex items-center justify-center font-semibold text-text-secondary ring-2 ring-surface z-10 flex-shrink-0 select-none`}
          title={`+${remaining} more`}
          aria-label={`${remaining} additional assignees`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

/**
 * Resolves all assigned users for a work item from task metadata and existing allUsers directory.
 * Preserves the original assignment order without duplicates or fake data.
 */
export function resolveTaskAssignees(task: Task, allUsers: User[] = []): User[] {
  const result: User[] = [];
  const seenIds = new Set<string>();

  const addUser = (u?: Partial<User> | null, fallbackId?: string) => {
    if (!u && !fallbackId) return;
    const id = u?.id || fallbackId;
    if (id && seenIds.has(id)) return;
    if (id) seenIds.add(id);

    // Prefer fully resolved profile from allUsers
    const matched = id ? allUsers.find((user) => user.id === id) : null;
    if (matched) {
      result.push(matched);
      return;
    }

    // Fall back to existing task user object
    if (u && (u.id || u.name || u.fullName)) {
      result.push({
        id: u.id || fallbackId || '',
        name: u.name || u.fullName || u.email?.split('@')[0] || 'User',
        email: u.email || '',
        role: u.role || 'Teammate',
        initials: u.initials || (u.name || u.fullName || u.email || 'U').slice(0, 2).toUpperCase(),
        avatarColor: u.avatarColor || u.color || '#4F46E5',
        ...u,
      } as User);
      return;
    }

    if (fallbackId) {
      result.push({
        id: fallbackId,
        name: 'User',
        email: '',
        role: 'Teammate',
        initials: 'U',
        avatarColor: '#4F46E5',
      } as User);
    }
  };

  // 1. If task has assigneeIds array
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
    for (const uid of task.assigneeIds) {
      if (typeof uid === 'string' && uid.trim().length > 0) {
        const fromAssignees = task.assignees?.find((a) => a.id === uid);
        addUser(fromAssignees, uid);
      }
    }
  }

  // 2. If task has assignees array
  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    for (const a of task.assignees) {
      addUser(a, a.id);
    }
  }

  // 3. Fall back to single assigneeId if no assignees array populated
  if (result.length === 0 && task.assigneeId) {
    addUser(null, task.assigneeId);
  }

  return result;
}

/**
 * Formats a descriptive tooltip / accessible label for assigned users.
 * Example: "Assigned to Yash, Alice, and Bob"
 */
export function formatAssigneesTooltip(users: Partial<User>[]): string {
  const names = users.map((u) => u.name || u.fullName || 'User').filter(Boolean);
  if (names.length === 0) return 'Unassigned';
  if (names.length === 1) return `Assigned to ${names[0]}`;
  if (names.length === 2) return `Assigned to ${names[0]} and ${names[1]}`;
  return `Assigned to ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export interface TaskAssigneesProps {
  task: Task;
  allUsers?: User[];
  size?: 'xs' | 'sm' | 'md';
  max?: number;
  showNameForSingle?: boolean;
  className?: string;
}

/**
 * TaskAssignees component handles zero, single, and multiple assignees consistently.
 * - 0 assignees: unassigned indicator.
 * - 1 assignee: avatar (+ name if showNameForSingle is true).
 * - 2+ assignees: overlapping compact avatar group + dynamic '+N' overflow indicator.
 * - Accessible tooltip with all assignee names.
 */
export function TaskAssignees({
  task,
  allUsers = [],
  size = 'xs',
  max = 3,
  showNameForSingle = false,
  className = '',
}: TaskAssigneesProps) {
  const assignees = resolveTaskAssignees(task, allUsers);

  if (assignees.length === 0) {
    return (
      <div className={`flex items-center min-w-0 ${className}`} title="Unassigned">
        <Avatar user={null} size={size} showName={showNameForSingle} />
      </div>
    );
  }

  if (assignees.length === 1) {
    const single = assignees[0];
    const tooltip = `Assigned to ${single.name || 'User'}`;
    return (
      <div className={`flex items-center min-w-0 ${className}`} title={tooltip} aria-label={tooltip}>
        <Avatar user={single} size={size} showName={showNameForSingle} />
      </div>
    );
  }

  const tooltip = formatAssigneesTooltip(assignees);

  return (
    <div
      className={`flex items-center min-w-0 ${className}`}
      title={tooltip}
      aria-label={tooltip}
      tabIndex={0}
    >
      <AvatarGroup users={assignees} max={max} size={size} />
    </div>
  );
}
