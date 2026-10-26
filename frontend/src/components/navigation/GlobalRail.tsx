import React from 'react';
import { LayoutDashboard, CheckSquare, FolderKanban, Settings, Layers, MessageCircle, LucideIcon } from 'lucide-react';
import { useApp } from '../../hooks/useApp';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
  badge?: number;
}

export function GlobalRail() {
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
      className="hidden md:flex flex-col items-center justify-between w-14 bg-rail-bg border-r border-border py-3 flex-shrink-0 z-40 select-none"
      aria-label="Global Navigation Rail"
    >
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Brand Icon */}
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary hover:bg-brand-primary/25 transition-colors"
          title="TaskFlow Pro"
        >
          <Layers size={20} strokeWidth={2.2} />
        </button>

        <div className="w-8 h-px bg-border my-1" />

        {/* Rail Items */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-1">
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
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
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
    </aside>
  );
}
