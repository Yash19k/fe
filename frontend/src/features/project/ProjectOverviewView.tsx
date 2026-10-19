import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Avatar, AvatarGroup } from '../../components/ui/Avatar';
import { TaskRow } from '../../components/tasks/TaskRow';
import { calculateCriticalPath } from '../../domain/criticalPath';
import { isTaskBlocked } from '../../domain/dependencyGraph';
import { getRelativeDateLabel } from '../../domain/businessDays';
import {
  Calendar,
  Ban,
  Shield,
  ArrowRight,
  GitCommit,
} from 'lucide-react';
import type { Task, AuditLogEntry, User } from '../../types';

export function ProjectOverviewView() {
  const { currentProject, projectTasks, allUsers, auditLog, setProjectTab, navigate } = useApp();

  // Call Hooks unconditionally at top of component
  const cpmAnalysis = useMemo(() => {
    return calculateCriticalPath(projectTasks || []);
  }, [projectTasks]);

  if (!currentProject) return null;

  const owner = allUsers.find((u: User) => u.id === currentProject.ownerId);
  const members = allUsers.filter((u: User) => (currentProject.memberIds || []).includes(u.id));

  // Compute stats (excluding subtasks to prevent double-counting parent & child deliverables)
  const deliverableTasks = projectTasks.filter((t: Task) => t.type !== 'Subtask');
  const totalDeliverables = deliverableTasks.length > 0 ? deliverableTasks.length : projectTasks.length;
  const completedDeliverables = (deliverableTasks.length > 0 ? deliverableTasks : projectTasks).filter(
    (t: Task) => t.status === 'Done'
  ).length;
  const overdueTasks = projectTasks.filter(
    (t: Task) => t.status !== 'Done' && getRelativeDateLabel(t.dueDate).isOverdue
  );
  const blockedTasks = projectTasks.filter(
    (t: Task) => t.status !== 'Done' && isTaskBlocked(t, projectTasks)
  );
  const completionPct =
    totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0;

  // Project activity
  const projectActivity = auditLog
    .filter((a: AuditLogEntry) => a.entityId === currentProject.id || projectTasks.some((t: Task) => t.id === a.entityId))
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Overview Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status & Health */}
        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
          <span className="text-xs text-text-muted">Project Health</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                currentProject.status === 'On Track'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {currentProject.status}
            </span>
            <span className="text-xs text-text-muted">Target: {currentProject.dueDate}</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {overdueTasks.length === 0
              ? 'All milestones are currently on schedule.'
              : `${overdueTasks.length} task(s) currently past due date.`}
          </p>
        </div>

        {/* Progress % */}
        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
          <span className="text-xs text-text-muted">Sprint Completion</span>
          <p className="text-2xl font-bold font-mono text-text-primary">
            {completionPct}%
          </p>
          <div className="w-full h-1.5 bg-surface-active rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${completionPct}%`, backgroundColor: currentProject.color }}
            />
          </div>
          <span className="text-[11px] text-text-muted block">
            {completedDeliverables} of {totalDeliverables} deliverables closed
          </span>
        </div>

        {/* Critical Path Duration */}
        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
          <span className="text-xs text-text-muted">Critical Path (CPM)</span>
          <div className="flex items-center gap-2">
            <GitCommit size={16} className="text-brand-primary" />
            <p className="text-lg font-bold font-mono text-text-primary">
              {cpmAnalysis.totalProjectDurationDays} business days
            </p>
          </div>
          <span className="text-[11px] text-text-muted block">
            {cpmAnalysis.criticalTasks.length} tasks on critical chain
          </span>
        </div>

        {/* Project Lead & Team */}
        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
          <span className="text-xs text-text-muted">Delivery Lead & Team</span>
          <div className="flex items-center gap-2">
            <Avatar user={owner} size="sm" showName />
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border">
            <span>Team Members</span>
            <button
              onClick={() => {
                setProjectTab('members');
                navigate(`/project/${currentProject.id}/members`);
              }}
              className="flex items-center gap-1.5 p-1 -m-1 rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
              title="View project members"
              aria-label="View project members"
            >
              <AvatarGroup users={members} max={3} />
              <span className="text-[11px] text-text-muted group-hover:text-text-primary transition-colors">
                ({members.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Description, Blockers & Milestones, Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Project Summary */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Project Charter & Architecture Scope
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {currentProject.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted pt-2 border-t border-border/60">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                Started: {currentProject.startDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                Deadline: {currentProject.dueDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Shield size={13} />
                High SLA: {currentProject.settings?.slaHighHours || 24}h
              </span>
            </div>
          </section>

          {/* Key Blockers Section */}
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-elevated">
              <div className="flex items-center gap-2">
                <Ban size={15} className="text-rose-400" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Identified Blockers ({blockedTasks.length})
                </h3>
              </div>
              <span className="text-xs text-text-muted">
                Tasks waiting on incomplete predecessors
              </span>
            </div>

            {blockedTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">
                No active blockers. Work is flowing smoothly across dependencies.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {blockedTasks.map((t: Task) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            )}
          </section>

          {/* Critical Path Preview */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCommit size={15} className="text-brand-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Critical Path Milestones
                </h3>
              </div>
              <button
                onClick={() => setProjectTab('dependencies')}
                className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1"
              >
                Inspect CPM Engine
                <ArrowRight size={13} />
              </button>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              These tasks form the longest path of sequential dependencies. Any delay in these
              tasks will directly shift the project finish date.
            </p>

            <div className="p-3 rounded-lg bg-surface-elevated border border-border text-xs font-mono text-text-secondary flex items-center gap-2 flex-wrap">
              {cpmAnalysis.criticalChain.length > 0 ? (
                cpmAnalysis.criticalChain.map((title: string, idx: number) => (
                  <React.Fragment key={title}>
                    <span className="text-text-primary font-medium">{title}</span>
                    {idx < cpmAnalysis.criticalChain.length - 1 && (
                      <span className="text-brand-primary font-bold">→</span>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <span className="text-text-muted">Single task or disconnected graph</span>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="space-y-6">
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Recent Project Events</h3>
              <button
                onClick={() => setProjectTab('activity')}
                className="text-xs text-brand-primary hover:text-brand-hover"
              >
                Full Audit Log
              </button>
            </div>

            <div className="p-3 divide-y divide-border/60">
              {projectActivity.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">
                  No recorded events yet.
                </p>
              ) : (
                projectActivity.map((log: AuditLogEntry) => (
                  <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                    <p className="font-medium text-text-primary leading-tight">
                      {log.description}
                    </p>
                    <span className="text-[10px] text-text-muted block mt-1">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
