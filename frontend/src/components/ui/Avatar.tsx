import React from 'react';
import { User } from '../../types';

export interface AvatarProps {
  user?: Partial<User> | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
}

export function Avatar({ user, size = 'md', showName = false }: AvatarProps) {
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-surface-active border border-border flex items-center justify-center text-[10px] text-text-muted">
          ?
        </div>
        {showName && <span className="text-xs text-text-muted">Unassigned</span>}
      </div>
    );
  }

  const sizeClasses: Record<string, string> = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-6 h-6 text-[11px]',
    md: 'w-7 h-7 text-xs',
    lg: 'w-9 h-9 text-sm',
    xl: 'w-11 h-11 text-base',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${selectedSize} rounded-full flex items-center justify-center font-medium text-white flex-shrink-0 border border-white/10`}
        style={{ backgroundColor: user.avatarColor || '#4F46E5' }}
        title={`${user.name || 'User'} (${user.role || 'Member'})`}
        aria-label={user.name || 'User'}
      >
        {user.initials || user.name?.substring(0, 2).toUpperCase() || 'U'}
      </div>
      {showName && (
        <span className="text-xs text-text-primary font-medium truncate max-w-[120px]">
          {user.name}
        </span>
      )}
    </div>
  );
}

export interface AvatarGroupProps {
  users?: Partial<User>[];
  max?: number;
}

export function AvatarGroup({ users = [], max = 4 }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center -space-x-1.5 overflow-hidden">
      {visible.map((u, idx) => (
        <Avatar key={u.id || u.name || idx} user={u} size="sm" />
      ))}
      {remaining > 0 && (
        <div className="w-6 h-6 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-[10px] font-medium text-text-secondary z-10">
          +{remaining}
        </div>
      )}
    </div>
  );
}
