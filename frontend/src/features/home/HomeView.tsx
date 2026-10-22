import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { TaskRow } from '../../components/tasks/TaskRow';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Ban,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { getRelativeDateLabel } from '../../domain/businessDays';
import { isTaskBlocked } from '../../domain/dependencyGraph';
import { evaluateTaskSla } from '../../domain/sla';
import { canUserAccessProject } from '../../domain/permissions';
import { getPersonalDashboardApi, backendWorkItemToTask } from '../../services/api';

export function HomeView() {
  const { currentUser, tasks, projects, auditLog, navigate, openTaskDrawer } = useApp();

  const [personalData, setPersonalData] = useState<{
    metrics: {
      total: number;
      completed: number;
      active: number;
      overdue: number;
      dueSoon: number;
      blocked: number;
    };
    attentionTasks: any[];
    userTasks: any[];
  } | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const fetchPersonalDashboard = async () => {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const res = await getPersonalDashboardApi();
      if (res?.data) {
        setPersonalData(res.data);
      }
    } catch (err: any) {
      setDashboardError(err?.message || 'Failed to retrieve personal dashboard metrics');
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    fetchPersonalDashboard();
  }, [currentUser?.id, tasks.length]);

  const accessibleProjects = useMemo(() => {
    return projects.filter((p) => canUserAccessProject(p, currentUser.id));
  }, [projects, currentUser.id]);

  // Tasks assigned to current user
  const userTasks = useMemo(() => {
    return tasks.filter((t) => t.assigneeId === currentUser.id);
  }, [tasks, currentUser.id]);

  // Personal metrics from backend or local fallback
  const personalMetrics = useMemo(() => {
    if (personalData?.metrics) {
      return personalData.metrics;
    }
    const total = userTasks.length;
    const completed = userTasks.filter((t) => t.status === 'Done').length;
    const active = userTasks.filter((t) => t.status !== 'Done');
    const overdue = active.filter((t) => getRelativeDateLabel(t.dueDate).isOverdue).length;
    const dueSoon = active.filter((t) => getRelativeDateLabel(t.dueDate).isDueSoon).length;
    const blocked = active.filter((t) => isTaskBlocked(t, tasks)).length;

    return { total, completed, active: total - completed, overdue, dueSoon, blocked };
  }, [personalData, userTasks, tasks]);

  // Tasks requiring immediate attention (Overdue, Due Soon, or Blocked)
  const attentionTasks = useMemo(() => {
    if (personalData?.attentionTasks && Array.isArray(personalData.attentionTasks)) {
      return personalData.attentionTasks.map((item: any) =>
        backendWorkItemToTask(item, item.projectId)
      );
    }
    return userTasks
      .filter((t) => {
        if (t.status === 'Done') return false;
        const date = getRelativeDateLabel(t.dueDate);
        const blocked = isTaskBlocked(t, tasks);
        const sla = evaluateTaskSla(t);
        return date.isOverdue || date.isDueSoon || blocked || sla.isBreached || sla.isApproaching;
      })
      .slice(0, 6);
  }, [personalData, userTasks, tasks]);

  // SLA Warnings across all projects
  const atRiskTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status === 'Done') return false;
        const sla = evaluateTaskSla(t);
        return sla.isBreached || sla.isApproaching || sla.isEscalated;
      })
      .slice(0, 4);
  }, [tasks]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Subtle workspace context header - Anti-AI-slop: No giant greeting banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Personal Workspace Overview
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Active session: <span className="text-text-secondary font-medium">{currentUser.name}</span> ({currentUser.role}) · Focus queue and critical milestones
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={fetchPersonalDashboard}
            disabled={isLoadingDashboard}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors cursor-pointer"
            title="Refresh personal metrics from server"
          >
            <RefreshCw size={12} className={isLoadingDashboard ? 'animate-spin' : ''} />
            <span>{isLoadingDashboard ? 'Refreshing...' : 'Refresh Overview'}</span>
          </button>
        </div>
      </div>

      {dashboardError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
          <span>Notice: {dashboardError}</span>
          <button onClick={fetchPersonalDashboard} className="font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>My Active Tasks</span>
            <CheckSquare size={14} className="text-brand-primary" />
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {personalMetrics.total - personalMetrics.completed}
          </p>
          <span className="text-[11px] text-text-muted">
            {personalMetrics.completed} completed
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Due Soon (≤5d)</span>
            <Clock size={14} className="text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {personalMetrics.dueSoon}
          </p>
          <span className="text-[11px] text-amber-400/90 font-medium">Upcoming deadlines</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Overdue Work</span>
            <AlertTriangle size={14} className="text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-1">
            {personalMetrics.overdue}
          </p>
          <span className="text-[11px] text-rose-400/90 font-medium">Action required</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Blocked Work</span>
            <Ban size={14} className="text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {personalMetrics.blocked}
          </p>
          <span className="text-[11px] text-text-muted">Predecessors incomplete</span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Completed</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {personalMetrics.completed}
          </p>
          <span className="text-[11px] text-emerald-400/90 font-medium">Sprint progress</span>
        </div>
      </div>

      {/* Main Grid: Attention List + Sidebar widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Attention Queue */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-elevated">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Needs Attention (Personal Queue)
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Overdue tasks, approaching milestones, and blocked dependencies.
                </p>
              </div>
              <button
                onClick={() => navigate('/my-tasks')}
                className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1 font-medium"
              >
                View all ({userTasks.length})
                <ArrowRight size={13} />
              </button>
            </div>

            {attentionTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All caught up!"
                description="No personal tasks require urgent attention right now."
                className="border-0 rounded-none py-10"
              />
            ) : (
              <div className="divide-y divide-border/60">
                {attentionTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            )}
          </section>

          {/* Active Projects Overview Cards */}
          <section className="bg-surface rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Active Projects & Milestones
              </h3>
              <button
                onClick={() => navigate('/projects')}
                className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1 font-medium"
              >
                All Projects
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {accessibleProjects.map((p) => {
                const projTasks = tasks.filter((t) => t.projectId === p.id);
                const deliverableTasks = projTasks.filter((t) => t.type !== 'Subtask');
                const deliverableTotal = deliverableTasks.length > 0 ? deliverableTasks.length : projTasks.length;
                const doneCount = (deliverableTasks.length > 0 ? deliverableTasks : projTasks).filter(
                  (t) => t.status === 'Done'
                ).length;
                const pct =
                  deliverableTotal > 0 ? Math.round((doneCount / deliverableTotal) * 100) : 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/project/${p.id}/overview`)}
                    className="p-3.5 rounded-lg bg-surface-elevated border border-border hover:border-border-strong hover:bg-surface-hover cursor-pointer transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-xs"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {p.name}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                          p.status === 'On Track'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-amber-400 bg-amber-500/10'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>Progress</span>
                        <span className="font-mono font-medium text-text-secondary">
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: p.color }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-text-muted pt-1 border-t border-border/50">
                      <span>{projTasks.length} tasks</span>
                      <span>Due {p.dueDate}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: SLA Alerts & Recent Activity Feed */}
        <div className="space-y-6">
          {/* SLA Alerts Widget */}
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <ShieldAlert size={15} className="text-rose-400" />
                <span>SLA Risk & Escalation Feed</span>
              </div>
              <span className="text-[10px] text-text-muted">Policy Monitor</span>
            </div>

            <div className="p-3 space-y-2">
              {atRiskTasks.length === 0 ? (
                <p className="text-xs text-text-muted py-2 text-center">
                  All tasks are currently within healthy SLA thresholds.
                </p>
              ) : (
                atRiskTasks.map((t) => {
                  const sla = evaluateTaskSla(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => openTaskDrawer(t.id)}
                      className="p-2.5 rounded-lg bg-surface-elevated border border-border hover:bg-surface-hover cursor-pointer transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-text-primary truncate pr-2">
                          {t.title}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${sla.badgeClass}`}>
                          {sla.isEscalated ? 'Escalated' : sla.isBreached ? 'Breached' : 'At Risk'}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        {sla.label} · Threshold: {sla.thresholdHours}h
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Recent Workspace Activity Feed */}
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <Activity size={15} className="text-brand-primary" />
                <span>Recent Audit Activity</span>
              </div>
            </div>

            <div className="p-3 divide-y divide-border/60 max-h-80 overflow-y-auto">
              {auditLog.slice(0, 6).map((log) => (
                <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                  <p className="font-medium text-text-primary leading-tight">
                    {log.description}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted mt-1">
                    <span className="uppercase font-mono">{log.action}</span>
                    <span>·</span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
