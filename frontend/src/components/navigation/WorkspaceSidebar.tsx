import React from 'react';
import {
  CheckSquare,
  LayoutDashboard,
  FolderKanban,
  MessageCircle,
  Settings,
  Plus,
  ChevronRight,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  X,
  LucideIcon,
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { canUserAccessProject } from '../../domain/permissions';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
  badge?: number;
}

export interface WorkspaceSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  onOpenCreateProject?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function WorkspaceSidebar({
  isOpen,
  onClose,
  onOpenCreateProject,
  isCollapsed = false,
  onToggleCollapse,
}: WorkspaceSidebarProps) {
  const {
    projects,
    currentProjectId,
    currentCompany,
    currentUser,
    activeRoute,
    myTasks,
    navigate,
  } = useApp();

  const visibleProjects = projects.filter((proj) => canUserAccessProject(proj, currentUser.id));

  const navItems: NavItem[] = [
    { id: 'home', label: 'Workspace Home', icon: LayoutDashboard, route: '/' },
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

  const currentTab =
    activeRoute === '/' || activeRoute === ''
      ? 'home'
      : activeRoute.startsWith('/my-tasks')
        ? 'my-tasks'
        : activeRoute.startsWith('/projects') || activeRoute.startsWith('/project/')
          ? 'projects'
          : activeRoute.startsWith('/chat')
            ? 'chat'
            : activeRoute.startsWith('/settings')
              ? 'settings'
              : '';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Single Coordinated Collapsible Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full bg-sidebar-bg border-r border-border/80 flex flex-col flex-shrink-0 select-none overflow-hidden transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'w-14 lg:w-14' : 'w-60 lg:w-60'}`}
        aria-label="Global Application Navigation"
      >
        {/* ========================================================= */}
        {/* HEADER / IDENTITY AREA (Height: h-14)                     */}
        {/* ========================================================= */}
        <div className="h-14 px-4 border-b border-border flex items-center justify-between flex-shrink-0">
          {isCollapsed ? (
            /* Collapsed Brand Icon */
            <div className="w-full flex items-center justify-center">
              <button
                onClick={() => {
                  navigate('/');
                  onClose?.();
                }}
                className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center font-bold text-xs text-white shadow-xs hover:bg-brand-primary/90 transition-colors"
                title="TaskFlow Pro Home"
                aria-label="TaskFlow Pro Home"
              >
                TF
              </button>
            </div>
          ) : (
            /* Expanded Brand & Company Label */
            <div className="flex items-center justify-between w-full min-w-0">
              <div
                onClick={() => {
                  navigate('/');
                  onClose?.();
                }}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                title="TaskFlow Pro Workspace"
              >
                <div className="w-6 h-6 rounded-md bg-brand-primary flex items-center justify-center font-bold text-xs text-white shadow-xs flex-shrink-0">
                  TF
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-text-primary tracking-tight block truncate">
                    {currentCompany?.name || 'TaskFlow Workspace'}
                  </span>
                </div>
              </div>

              {/* Desktop Collapse Button */}
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="hidden lg:flex p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors ml-1"
                  title="Collapse navigation menu"
                  aria-label="Collapse navigation menu"
                >
                  <PanelLeftClose size={16} />
                </button>
              )}

              {/* Mobile Drawer Close Button */}
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors ml-1"
                title="Close navigation"
                aria-label="Close navigation"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* PRIMARY NAVIGATION ITEMS                                   */}
        {/* ========================================================= */}
        {isCollapsed ? (
          /* COLLAPSED STATE: Centered Icons Only */
          <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-1.5 pt-3">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.route);
                    onClose?.();
                  }}
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
                  {isActive && (
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-brand-primary rounded-r" />
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          /* EXPANDED STATE: Icons and Text Labels Together */
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Primary Navigation Links */}
            <nav className="px-3 py-3 space-y-1 flex-shrink-0">
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(item.route);
                      onClose?.();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors group ${
                      isActive
                        ? 'bg-brand-subtle text-brand-text font-semibold border border-brand-primary/30 shadow-xs'
                        : 'text-text-secondary hover:text-text-primary hover:bg-sidebar-hover'
                    }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={16}
                        strokeWidth={isActive ? 2.2 : 1.8}
                        className={
                          isActive
                            ? 'text-brand-primary'
                            : 'text-text-muted group-hover:text-text-primary'
                        }
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge != null && item.badge > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-brand-primary text-white font-bold text-[10px] flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Projects Hierarchy Section */}
            <div className="flex-1 px-3 py-2 border-t border-border/70 overflow-y-auto space-y-1">
              <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                <span>Projects ({visibleProjects.length})</span>
                {currentUser.role !== 'Teammate' && (
                  <button
                    onClick={onOpenCreateProject}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                    title="Create project"
                    aria-label="Create project"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-0.5">
                {visibleProjects.length === 0 ? (
                  <p className="px-2 py-2 text-[11px] text-text-muted italic">No projects yet</p>
                ) : (
                  visibleProjects.map((proj) => {
                    const isSelected =
                      activeRoute.startsWith(`/project/${proj.id}`) ||
                      (activeRoute.startsWith('/project') && currentProjectId === proj.id);

                    return (
                      <button
                        key={proj.id}
                        onClick={() => {
                          navigate(`/project/${proj.id}/overview`);
                          onClose?.();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors group ${
                          isSelected
                            ? 'bg-brand-subtle text-brand-text font-medium border border-brand-primary/30 shadow-xs'
                            : 'text-text-secondary hover:text-text-primary hover:bg-sidebar-hover'
                        }`}
                        title={proj.name}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span
                            className="w-2.5 h-2.5 rounded-xs flex-shrink-0"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span className="truncate text-left">{proj.name}</span>
                          {proj.visibility === 'private' && (
                            <Lock size={10} className="text-amber-400/80 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                              proj.status === 'On Track'
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-amber-400 bg-amber-500/10'
                            }`}
                          >
                            {proj.status === 'On Track' ? 'Track' : 'Risk'}
                          </span>
                          <ChevronRight
                            size={12}
                            className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* BOTTOM CONTROLS (Expand toggle when collapsed)            */}
        {/* ========================================================= */}
        {isCollapsed && onToggleCollapse && (
          <div className="flex flex-col items-center w-full px-1.5 pb-3 pt-2 border-t border-border/80 flex-shrink-0">
            <button
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors"
              title="Expand navigation menu"
              aria-label="Expand navigation menu"
            >
              <PanelLeftOpen size={18} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
