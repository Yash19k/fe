import React from 'react';
import {
  Star,
  LayoutGrid,
  ListFilter,
  Kanban,
  GitCommit,
  BarChart3,
  CalendarDays,
  Workflow,
  Network,
  Lock,
  Globe,
  LucideIcon,
  Settings,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { AvatarGroup } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface ProjectHeaderProps {
  onOpenCreateTask?: () => void;
  onOpenCreateSprint?: () => void;
}

export function ProjectHeader({ onOpenCreateTask, onOpenCreateSprint }: ProjectHeaderProps) {
  const {
    currentProject,
    projectTab,
    setProjectTab,
    allUsers,
    navigate,
  } = useApp();

  if (!currentProject) return null;

  const projectMembers = allUsers.filter((u) =>
    (currentProject.memberIds || []).includes(u.id)
  );

  // Primary project navigation sections:
  // Members and Activity & Audit are moved into Project Settings
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: ListFilter },
    { id: 'board', label: 'Board', icon: Kanban },
    { id: 'timeline', label: 'Timeline', icon: GitCommit },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'dependencies', label: 'Dependencies', icon: Network },
    { id: 'workflow', label: 'Workflow', icon: Workflow },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  function handleTabClick(tabId: string) {
    if (!currentProject) return;
    setProjectTab(tabId);
    navigate(`/project/${currentProject.id}/${tabId}`);
  }

  function handleManageMembersClick() {
    if (!currentProject) return;
    setProjectTab('members');
    navigate(`/project/${currentProject.id}/members`);
  }

  return (
    <div className="bg-surface border-b border-border flex-shrink-0 select-none">
      {/* Top row: Project Title, Key, Visibility, Status, Members, Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-3.5 pb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs"
            style={{ backgroundColor: currentProject.color }}
          >
            {currentProject.name.substring(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-text-primary truncate">
                {currentProject.name}
              </h1>

              {/* Project ID / Key Badge */}
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-secondary font-semibold">
                {currentProject.projectKey || currentProject.id.toUpperCase()}
              </span>

              {/* Visibility Badge */}
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                  currentProject.visibility === 'private'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-surface text-text-muted border-border'
                }`}
                title={
                  currentProject.visibility === 'private'
                    ? 'Private project: Visible only to owner and members'
                    : 'Global project: Visible to company workspace'
                }
              >
                {currentProject.visibility === 'private' ? (
                  <>
                    <Lock size={10} />
                    <span>Private</span>
                  </>
                ) : (
                  <>
                    <Globe size={10} />
                    <span>Global</span>
                  </>
                )}
              </span>

              {/* Status Badge */}
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                  currentProject.status === 'On Track'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {currentProject.status}
              </span>

              <button
                className="text-text-muted hover:text-amber-400 transition-colors p-0.5 rounded"
                title="Star project"
                aria-label="Star project"
              >
                <Star size={14} />
              </button>
            </div>
            <p className="text-xs text-text-muted truncate max-w-md hidden sm:block mt-0.5">
              {currentProject.description}
            </p>
          </div>
        </div>

        {/* Right side: Member avatars & prominent Add Work Item / Add Sprint buttons */}
        <div className="flex items-center gap-3">
          {/* Member avatars button: opens Project Settings -> Members in ONE click */}
          <button
            onClick={handleManageMembersClick}
            className="flex items-center gap-1.5 px-2 py-1 -m-1 rounded-lg hover:bg-surface-elevated border border-transparent hover:border-border transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
            title="Manage project members (Settings → Members)"
            aria-label="Manage project members"
          >
            <AvatarGroup users={projectMembers} max={4} />
            <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary hidden sm:inline ml-0.5">
              Members
            </span>
          </button>

          {/* Prominent Header Actions: Add Work Item and Add Sprint side-by-side */}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={onOpenCreateTask}
              className="font-medium h-7 px-2.5 text-xs shadow-xs"
              title="Add Work Item to this project"
            >
              <span>Add Work Item</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={Sparkles}
              onClick={onOpenCreateSprint}
              className="font-medium h-7 px-2.5 text-xs border-border bg-surface-elevated hover:bg-surface hover:border-border-strong text-text-primary"
              title="Create a new sprint"
            >
              <span>Add Sprint</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Horizontal Tab Navigation */}
      <nav className="flex items-center gap-1 px-4 sm:px-6 overflow-x-auto scrollbar-none border-t border-border/50">
        {tabs.map((tab) => {
          const isActive =
            projectTab === tab.id ||
            (tab.id === 'settings' && (projectTab === 'members' || projectTab === 'activity'));
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-2 py-2 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-brand-primary text-text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-strong'
              }`}
            >
              <Icon size={14} strokeWidth={isActive ? 2 : 1.75} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
