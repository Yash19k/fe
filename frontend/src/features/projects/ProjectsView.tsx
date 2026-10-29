import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Button } from '../../components/ui/Button';
import { AvatarGroup } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  FolderKanban,
  Plus,
  Search,
  ArrowRight,
  Calendar,
  Lock,
  Globe,
} from 'lucide-react';
import { getWorkflowForProject, isWorkflowStatusComplete } from '../../domain/workflow';
import { formatDisplayDate } from '../../utils/dateUtils';

export interface ProjectsViewProps {
  onOpenCreateProject?: () => void;
}

export function ProjectsView({ onOpenCreateProject }: ProjectsViewProps) {
  const { projects, tasks, workflows, allUsers, navigate, currentUser } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.description || '').toLowerCase().includes(q) &&
          !(p.projectKey || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, search, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">Workspace Projects</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Active portfolios, milestones, team members, and overall completion tracking.
          </p>
        </div>
        {currentUser.role !== 'Teammate' && (
          <Button variant="primary" size="sm" icon={Plus} onClick={onOpenCreateProject}>
            New Project
          </Button>
        )}
      </div>

      {/* Control Bar: Search and Status Filter */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <input
              type="search"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-surface-elevated border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
        >
          <option value="ALL">All Project Statuses</option>
          <option value="On Track">On Track</option>
          <option value="At Risk">At Risk</option>
          <option value="Off Track">Off Track</option>
        </select>
      </div>

      {/* Projects Table */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects match search criteria"
          description="Try modifying your search or filters to see all workspace projects."
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {/* Header Row */}
          <div className="hidden md:grid md:grid-cols-[2fr_100px_140px_100px_120px_40px] gap-3 px-5 py-2.5 border-b border-border bg-surface-elevated text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            <span>Project Details</span>
            <span>Status</span>
            <span>Task Progress</span>
            <span>Target Date</span>
            <span>Team</span>
            <span />
          </div>

          <div className="divide-y divide-border/60">
            {filteredProjects.map((proj) => {
              const projTasks = tasks.filter((t) => t.projectId === proj.id);
              const workflow =
                getWorkflowForProject(workflows, proj.id) || proj.workflow;
              const doneCount = projTasks.filter((task) =>
                isWorkflowStatusComplete(workflow, task.status),
              ).length;
              const pct =
                projTasks.length > 0 ? Math.round((doneCount / projTasks.length) * 100) : 0;
              const members = allUsers.filter((u) => (proj.memberIds || []).includes(u.id));

              return (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/project/${proj.id}/overview`)}
                  className="grid grid-cols-1 md:grid-cols-[2fr_100px_140px_100px_120px_40px] gap-3 items-center px-5 py-3.5 hover:bg-surface-hover/80 transition-colors cursor-pointer group text-xs"
                >
                  {/* Name and Description */}
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-xs flex-shrink-0"
                        style={{ backgroundColor: proj.color }}
                      />
                      <span className="font-semibold text-text-primary text-sm truncate">
                        {proj.name}
                      </span>
                      {proj.projectKey && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-elevated border border-border text-text-muted shrink-0">
                          {proj.projectKey}
                        </span>
                      )}
                      {proj.visibility === 'private' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300 shrink-0">
                          <Lock size={10} />
                          Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded bg-surface border border-border text-text-muted shrink-0">
                          <Globe size={10} />
                          Global
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5 ml-5">
                      {proj.description || 'No description provided'}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                        proj.status === 'On Track'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {proj.status}
                    </span>
                  </div>

                  {/* Task Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span>
                        {doneCount}/{projTasks.length} tasks
                      </span>
                      <span className="font-mono font-medium">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-active rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: proj.color }}
                      />
                    </div>
                  </div>

                  {/* Target Delivery Date */}
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <Calendar size={13} className="text-text-muted" />
                    <span>{formatDisplayDate(proj.dueDate)}</span>
                  </div>

                  {/* Members */}
                  <div>
                    <AvatarGroup users={members} max={3} />
                  </div>

                  {/* Arrow */}
                  <div className="hidden md:flex justify-end">
                    <ArrowRight
                      size={14}
                      className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
