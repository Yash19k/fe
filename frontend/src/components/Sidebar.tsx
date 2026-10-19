import React, { useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Settings,
  ChevronDown,
  Menu,
  X,
  LucideIcon,
} from 'lucide-react';

interface NavItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

const navItems: NavItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: true },
  { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
];

const secondaryItems: NavItemDef[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

export interface SidebarProps {
  user: { name: string; role: string; initials?: string; avatarColor?: string };
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60 bg-sidebar-bg flex flex-col
          transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-white font-semibold text-base tracking-tight">TaskFlow Pro</span>
          </div>
          <button
            className="lg:hidden text-sidebar-text hover:text-white p-1 rounded"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="mb-2 px-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-sidebar-text-muted">
              Menu
            </span>
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors duration-100
                ${item.active
                  ? 'bg-sidebar-active-bg text-white'
                  : 'text-sidebar-text hover:bg-sidebar-hover-bg hover:text-white'
                }
              `}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.icon size={18} strokeWidth={item.active ? 2 : 1.5} />
              {item.label}
            </button>
          ))}

          <div className="mt-6 mb-2 px-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-sidebar-text-muted">
              General
            </span>
          </div>
          {secondaryItems.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-text hover:bg-sidebar-hover-bg hover:text-white transition-colors duration-100"
            >
              <item.icon size={18} strokeWidth={1.5} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Profile area */}
        <div className="px-3 pb-4 flex-shrink-0 relative">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-hover-bg transition-colors duration-100"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-expanded={profileOpen}
            aria-haspopup="true"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: user.avatarColor || '#4F46E5' }}
            >
              {user.initials || user.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-sidebar-text-muted truncate">{user.role}</p>
            </div>
            <ChevronDown
              size={14}
              className={`text-sidebar-text-muted transition-transform duration-150 ${profileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-white rounded-lg shadow-overlay border border-border py-1 z-10">
              <button className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors">
                Profile
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors">
                Preferences
              </button>
              <div className="border-t border-border my-1" />
              <button className="w-full text-left px-3 py-2 text-sm text-status-danger hover:bg-surface-hover transition-colors">
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="lg:hidden p-2 rounded-lg text-text-secondary hover:bg-surface-active transition-colors"
      onClick={onClick}
      aria-label="Open navigation"
    >
      <Menu size={20} />
    </button>
  );
}
