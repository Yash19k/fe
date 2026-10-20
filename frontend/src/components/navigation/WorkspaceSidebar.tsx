import React from 'react';
import {
  CheckSquare,
  LayoutDashboard,
  Plus,
  Radio,
  ChevronRight,
  Shield,
  Lock,
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';

export interface WorkspaceSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  onOpenCreateProject?: () => void;
}

export function WorkspaceSidebar({ isOpen, onClose, onOpenCreateProject }: WorkspaceSidebarProps) {
  const {
    projects,
    currentProjectId,
    currentCompany,
    currentUser,
    switchUser,
    activeRoute,
    navigate,
    crossTabIndicator,
  } = useApp();

  const visibleProjects = projects.filter(
    (proj) => proj.ownerId === currentUser.id || proj.memberIds?.includes(currentUser.id),
  );

  const isHome = activeRoute === '/' || activeRoute === '';
  const isMyTasks = activeRoute.startsWith('/my-tasks');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-full w-60 bg-sidebar-bg border-r border-border flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Brand / Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-brand-primary flex items-center justify-center font-bold text-xs text-zinc-950">
              TF
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-text-primary tracking-tight block truncate">
                {currentCompany?.name || 'TaskFlow Workspace'}
              </span>
            </div>
          </div>

          {/* Cross-tab real-time sync pill */}
          <div
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all duration-300 ${
              crossTabIndicator
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 animate-pulse'
                : 'text-text-muted bg-surface/40'
            }`}
            title="Real-time multi-tab synchronization"
          >
            <Radio size={10} className={crossTabIndicator ? 'text-emerald-400' : 'text-text-muted'} />
            <span className="hidden sm:inline">Sync</span>
          </div>
        </div>

        {/* Primary Workspace Links */}
        <div className="px-3 py-3 space-y-1">
          <button
            onClick={() => {
              navigate('/');
              onClose?.();
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              isHome
                ? 'bg-surface-active text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <LayoutDashboard size={15} />
            <span>Workspace Home</span>
          </button>

          <button
            onClick={() => {
              navigate('/my-tasks');
              onClose?.();
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              isMyTasks
                ? 'bg-surface-active text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <CheckSquare size={15} />
            <span>My Tasks</span>
          </button>
        </div>

        {/* Projects Section */}
        <div className="flex-1 px-3 py-2 overflow-y-auto space-y-1">
          <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            <span>Projects ({visibleProjects.length})</span>
            {currentUser.role !== 'Teammate' && (
              <button
                onClick={onOpenCreateProject}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                title="Create project"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {visibleProjects.map((proj) => {
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
                      ? 'bg-surface-active text-text-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
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
            })}
          </div>
        </div>

        {/* Role Demo Quick Switcher Banner */}
        <div className="p-3 border-t border-border bg-surface-elevated/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider flex items-center gap-1">
              <Shield size={11} className="text-brand-primary" />
              Role Demo Mode
            </span>
            <span className="text-[10px] text-text-muted">RBAC</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => switchUser('user-1')}
              className={`px-1.5 py-1 text-[11px] rounded font-medium transition-colors text-center ${
                currentUser.role === 'Admin'
                  ? 'bg-brand-primary text-zinc-950 font-bold'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => switchUser('user-2')}
              className={`px-1.5 py-1 text-[11px] rounded font-medium transition-colors text-center ${
                currentUser.role === 'Manager'
                  ? 'bg-brand-primary text-zinc-950 font-bold'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              }`}
            >
              Manager
            </button>
            <button
              onClick={() => switchUser('user-3')}
              className={`px-1.5 py-1 text-[11px] rounded font-medium transition-colors text-center ${
                currentUser.role === 'Teammate'
                  ? 'bg-brand-primary text-zinc-950 font-bold'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              }`}
            >
              Teammate
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
