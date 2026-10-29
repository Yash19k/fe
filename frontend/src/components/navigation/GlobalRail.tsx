import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Settings,
  Layers,
  MessageCircle,
  LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
  badge?: number;
}

export interface GlobalRailProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function GlobalRail({ isCollapsed = false, onToggleCollapse }: GlobalRailProps) {
  const { activeRoute, navigate, myTasks } = useApp();

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, route: '/' },
    {
      id: 'my-tasks',
      label: 'My Tasks',
      icon: CheckSquare,
      route: '/my-tasks',
      badge: myTasks.filter((t) => t.status !== 'Done').length,
    },
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: '/projects' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, route: '/chat' },
    { id: 'settings', label: 'Settings', icon: Settings, route: '/settings' },
  ];

  const currentTab = activeRoute.startsWith('/my-tasks')
    ? 'my-tasks'
    : activeRoute.startsWith('/projects') || activeRoute.startsWith('/project/')
      ? 'projects'
      : activeRoute.startsWith('/settings')
        ? 'settings'
        : activeRoute.startsWith('/chat')
          ? 'chat'
        : 'home';

  return (
    <aside
      className="hidden md:flex flex-col items-center justify-between w-14 bg-sidebar-bg border-r border-border/80 flex-shrink-0 z-40 select-none transition-colors"
      aria-label="Global Navigation Rail"
    >
      <div className="flex flex-col items-center w-full">
        {/* Brand Icon Header - Aligned vertically with WorkspaceSidebar header (h-14) */}
        <div className="h-14 w-full flex items-center justify-center border-b border-border/80 flex-shrink-0">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary hover:bg-brand-primary/25 transition-colors shadow-xs"
            title="TaskFlow Pro"
            aria-label="TaskFlow Pro Home"
          >
            <Layers size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Rail Items */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-1.5 pt-3">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.route)}
                className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors group ${
                  isActive
                    ? 'bg-brand-subtle text-brand-text border border-brand-primary/35 shadow-xs'
                    : 'text-text-muted hover:text-text-primary hover:bg-sidebar-hover'
                }`}
                title={item.label}
                aria-label={item.label}
              >
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.75} />
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brand-primary text-white font-bold text-[9px] flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-brand-primary rounded-r" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Rail Controls: Secondary Menu Collapse / Expand Button */}
      {onToggleCollapse && (
        <div className="flex flex-col items-center w-full px-1.5 pb-3">
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors"
            title={isCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
            aria-label={isCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={18} strokeWidth={1.8} />
            ) : (
              <PanelLeftClose size={18} strokeWidth={1.8} />
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
