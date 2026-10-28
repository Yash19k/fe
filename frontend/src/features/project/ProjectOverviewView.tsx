import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Avatar, AvatarGroup, resolveTaskAssignees } from '../../components/ui/Avatar';
import { TaskRow } from '../../components/tasks/TaskRow';
import { WorkItemTypeBadge } from '../../components/ui/Badge';
import { calculateCriticalPath } from '../../domain/criticalPath';
import { isTaskBlocked } from '../../domain/dependencyGraph';
import { getRelativeDateLabel } from '../../domain/businessDays';
import { WORK_ITEM_TYPES } from '../../domain/workItems';
import { getProjectDashboardApi, backendTypeToFrontend } from '../../services/api';
import {
  getAuditActor,
  getAuditEntityInfo,
  formatAuditTimestamp,
} from './ProjectSettingsView';
import {
  Calendar,
  Ban,
  Shield,
  ArrowRight,
  GitCommit,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Zap,
  Users,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { Task, AuditLogEntry, User, WorkItemType, WorkflowStatus } from '../../types';

export function ProjectOverviewView() {
  const {
    currentProject,
    projectTasks,
    allUsers,
    auditLog,
    currentWorkflow,
    setProjectTab,
    navigate,
    sprints,
  } = useApp();

  const [backendDashboard, setBackendDashboard] = useState<any>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(false);

  // Fetch project dashboard metrics from backend
  useEffect(() => {
    setBackendDashboard(null);
    if (!currentProject?.id) return;
    let isCancelled = false;
    setIsLoadingDashboard(true);

    getProjectDashboardApi(currentProject.id)
      .then((res) => {
        if (!isCancelled && res?.data) {
          setBackendDashboard(res.data);
        }
      })
      .catch((err) => {
        console.warn('TaskFlow: Failed to load project dashboard summary:', err.message);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingDashboard(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentProject?.id]);

  // Critical path method (CPM) analysis
  const cpmAnalysis = useMemo(() => {
    return calculateCriticalPath(projectTasks || []);
  }, [projectTasks]);

  // Project owner / lead and assigned members
  const owner = useMemo(() => {
    if (!currentProject) return undefined;
    return allUsers.find((u: User) => u.id === currentProject.ownerId);
  }, [currentProject, allUsers]);

  const members = useMemo(() => {
    if (!currentProject) return [];
    return allUsers.filter((u: User) => (currentProject.memberIds || []).includes(u.id));
  }, [currentProject, allUsers]);

  // Accurate project deliverables calculation (excluding subtasks to prevent double counting)
  const deliverableTasks = useMemo(() => {
    return projectTasks.filter((t: Task) => t.type !== WORK_ITEM_TYPES.SUBTASK);
  }, [projectTasks]);

  const totalDeliverables = deliverableTasks.length > 0 ? deliverableTasks.length : projectTasks.length;
  const completedDeliverables = (deliverableTasks.length > 0 ? deliverableTasks : projectTasks).filter(
    (t: Task) => t.status === 'Done'
  ).length;

  const totalTasksCount = projectTasks.length;
  const completedTasksCount = projectTasks.filter((t: Task) => t.status === 'Done').length;
  const inProgressTasksCount = projectTasks.filter(
    (t: Task) => t.status !== 'Done' && t.status !== 'Backlog'
  ).length;

  const overdueTasks = useMemo(() => {
    return projectTasks.filter(
      (t: Task) => t.status !== 'Done' && getRelativeDateLabel(t.dueDate).isOverdue
    );
  }, [projectTasks]);

  const blockedTasks = useMemo(() => {
    return projectTasks.filter(
      (t: Task) => t.status !== 'Done' && isTaskBlocked(t, projectTasks)
    );
  }, [projectTasks]);

  const completionPct =
    totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0;

  // Work-Item Types Breakdown
  // Work-Item Types Breakdown - Grouped summary calculated from canonical project work items
  const tasksByType = useMemo<Array<{ type: WorkItemType; count: number }>>(() => {
    const counts: Record<WorkItemType, number> = {
      [WORK_ITEM_TYPES.EPIC]: 0,
      [WORK_ITEM_TYPES.STORY]: 0,
      [WORK_ITEM_TYPES.TASK]: 0,
      [WORK_ITEM_TYPES.SUBTASK]: 0,
      [WORK_ITEM_TYPES.BUG]: 0,
    };

    if (projectTasks && projectTasks.length > 0) {
      projectTasks.forEach((t: Task) => {
        const canonical = backendTypeToFrontend(t.type);
        counts[canonical] = (counts[canonical] || 0) + 1;
      });
    } else if (Array.isArray(backendDashboard?.workItemTypes) && backendDashboard.workItemTypes.length > 0) {
      backendDashboard.workItemTypes.forEach((item: any) => {
        const canonical = backendTypeToFrontend(item.type);
        counts[canonical] = (counts[canonical] || 0) + (Number(item.count) || 0);
      });
    }

    return [
      { type: WORK_ITEM_TYPES.EPIC, count: counts[WORK_ITEM_TYPES.EPIC] },
      { type: WORK_ITEM_TYPES.STORY, count: counts[WORK_ITEM_TYPES.STORY] },
      { type: WORK_ITEM_TYPES.TASK, count: counts[WORK_ITEM_TYPES.TASK] },
      { type: WORK_ITEM_TYPES.SUBTASK, count: counts[WORK_ITEM_TYPES.SUBTASK] },
      { type: WORK_ITEM_TYPES.BUG, count: counts[WORK_ITEM_TYPES.BUG] },
    ];
  }, [backendDashboard, projectTasks]);

  // Section B: Task Status Distribution across actual workflow configuration
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    projectTasks.forEach((t: Task) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });

    const defaultStatuses: WorkflowStatus[] = [
      { id: 'st-backlog', name: 'Backlog', category: 'unstarted', color: '#6B7280' },
      { id: 'st-inprogress', name: 'In Progress', category: 'active', color: '#3B82F6' },
      { id: 'st-inreview', name: 'In Review', category: 'active', color: '#A855F7' },
      { id: 'st-testingqa', name: 'Testing / QA', category: 'active', color: '#06B6D4' },
      { id: 'st-blocked', name: 'Blocked', category: 'impediment', color: '#EF4444' },
      { id: 'st-onhold', name: 'On Hold', category: 'impediment', color: '#F97316' },
      { id: 'st-done', name: 'Done', category: 'completed', color: '#22C55E' },
    ];

    const configuredStatuses = currentWorkflow?.statuses && currentWorkflow.statuses.length > 0
      ? currentWorkflow.statuses
      : defaultStatuses;

    return configuredStatuses.map((st) => {
      const count = counts[st.name] || 0;
      const pct = totalTasksCount > 0 ? Math.round((count / totalTasksCount) * 100) : 0;
      return {
        id: st.id,
        name: st.name,
        color: st.color || '#94A3B8',
        count,
        pct,
      };
    });
  }, [projectTasks, currentWorkflow, totalTasksCount]);

  // Section C: Workload by Assignee
  const tasksByAssignee = useMemo(() => {
    const counts: Record<string, { count: number; user?: User }> = {};
    let unassignedCount = 0;

    projectTasks.forEach((t: Task) => {
      const assignees = resolveTaskAssignees(t, allUsers);
      if (assignees.length === 0) {
        unassignedCount++;
      } else {
        assignees.forEach((u) => {
          const key = u.id;
          if (!counts[key]) {
            counts[key] = { count: 0, user: u };
          }
          counts[key].count++;
        });
      }
    });

    const list = Object.values(counts).map((item) => ({
      name: item.user ? item.user.name : 'Unknown User',
      user: item.user,
      count: item.count,
    }));

    if (unassignedCount > 0) {
      list.push({
        name: 'Unassigned',
        user: undefined,
        count: unassignedCount,
      });
    }

    list.sort((a, b) => b.count - a.count);
    return list;
  }, [projectTasks, allUsers]);

  const maxAssigneeCount = useMemo(() => {
    return Math.max(1, ...tasksByAssignee.map((a) => a.count));
  }, [tasksByAssignee]);

  // Section D: Recent Project Events / Activity
  const projectActivity = useMemo(() => {
    if (!currentProject) return [];
    const projectTaskIds = new Set(projectTasks.map((t: Task) => t.id));

    return auditLog
      .filter((log: AuditLogEntry) => {
        return (
          log.projectId === currentProject.id ||
          (log.entityType === 'project' && log.entityId === currentProject.id) ||
          (log.entityType === 'task' && (projectTaskIds.has(log.entityId) || log.projectId === currentProject.id))
        );
      })
      .slice(0, 5);
  }, [currentProject, projectTasks, auditLog]);

  // Section E: Project Sprint Summary
  const activeSprint = useMemo(() => {
    if (!currentProject) return null;
    const projectSprints = sprints.filter((s) => s.projectId === currentProject.id);
    return projectSprints.find((s) => s.status === 'ACTIVE') || projectSprints[0] || null;
  }, [currentProject, sprints]);

  if (!currentProject) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ==================================================== */}
      {/* SECTION A: PROJECT IDENTITY & COMPACT METRIC SUMMARY */}
      {/* ==================================================== */}
      <div className="space-y-4">
        {/* Compact KPI Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Tracked Work Items */}
          <div className="p-4 rounded-xl bg-surface border border-border">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Total Tracked Items</span>
              <ListTodo size={16} className="text-brand-primary" />
            </div>
            <p className="text-2xl font-bold font-mono text-text-primary mt-1">
              {totalTasksCount}
            </p>
            <span className="text-[11px] text-text-muted">
              {deliverableTasks.length} deliverables in scope
            </span>
          </div>

          {/* Card 2: Completed Deliverables */}
          <div className="p-4 rounded-xl bg-surface border border-border">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Completed Items</span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {completedTasksCount}
            </p>
            <span className="text-[11px] text-text-muted">
              {completionPct}% of deliverables ({completedDeliverables}/{totalDeliverables})
            </span>
          </div>

          {/* Card 3: Active / In Progress */}
          <div className="p-4 rounded-xl bg-surface border border-border">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Active Work</span>
              <Clock size={16} className="text-brand-primary" />
            </div>
            <p className="text-2xl font-bold font-mono text-text-primary mt-1">
              {inProgressTasksCount}
            </p>
            <span className="text-[11px] text-text-muted">
              Active across workflow stages
            </span>
          </div>

          {/* Card 4: Overdue Items */}
          <div className="p-4 rounded-xl bg-surface border border-border">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Overdue Items</span>
              <AlertTriangle
                size={16}
                className={overdueTasks.length > 0 ? 'text-rose-400' : 'text-text-muted'}
              />
            </div>
            <p
              className={`text-2xl font-bold font-mono mt-1 ${
                overdueTasks.length > 0 ? 'text-rose-400' : 'text-text-primary'
              }`}
            >
              {overdueTasks.length}
            </p>
            <span
              className={`text-[11px] ${
                overdueTasks.length > 0 ? 'text-rose-400/90' : 'text-text-muted'
              }`}
            >
              {overdueTasks.length === 0 ? 'All milestones on schedule' : 'Needs schedule recovery'}
            </span>
          </div>
        </div>

        {/* Deliverables Progress & Work Item Type Breakdown */}
        <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary">Deliverable Completion Pace</span>
              <span className="font-mono text-text-muted">({completionPct}%)</span>
            </div>
            <span className="text-[11px] text-text-muted">
              {completedDeliverables} of {totalDeliverables} milestone deliverables closed
            </span>
          </div>

          <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${completionPct}%`,
                backgroundColor: currentProject.color || '#3B82F6',
              }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Work Item Types
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {tasksByType.map(({ type, count }) => (
                <div
                  key={type}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-surface-elevated border border-border text-xs"
                >
                  <WorkItemTypeBadge type={type} size="sm" />
                  <span className="font-mono font-medium text-text-primary text-[11px]">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SECTION B & C: TASK STATUS & TEAM WORKLOAD           */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section B: Dynamic Workflow Status Distribution */}
        <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Tasks by Workflow Status</h3>
              <p className="text-xs text-text-muted">
                Configured pipeline: <strong className="text-text-primary">{currentWorkflow?.name || 'TaskFlow Pro — Final Statuses'}</strong>
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted">{totalTasksCount} total</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {statusDistribution.map((st) => (
              <div key={st.id} className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-text-secondary">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                    <span className="font-medium text-text-primary">{st.name}</span>
                  </div>
                  <span className="font-mono text-text-secondary text-[11px]">
                    {st.count} ({st.pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${st.pct}%`, backgroundColor: st.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section C: Team Workload & Delivery Lead */}
        <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Team & Workload</h3>
              <p className="text-xs text-text-muted">Task volume distributed across assignees</p>
            </div>
            <button
              onClick={() => {
                setProjectTab('settings#members');
                navigate(`/project/${currentProject.id}/settings#members`);
              }}
              className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Team</span>
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Delivery Lead Card */}
          <div className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-text-muted">Delivery Lead:</span>
              <Avatar user={owner} size="sm" showName />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Project Members:</span>
              <AvatarGroup users={members} max={4} />
              <span className="text-xs font-mono text-text-muted">({members.length})</span>
            </div>
          </div>

          {/* Workload Distribution Bars */}
          <div className="space-y-2.5 pt-1">
            {tasksByAssignee.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No tasks tracked yet.</p>
            ) : (
              tasksByAssignee.map((item) => {
                const pct = Math.round((item.count / maxAssigneeCount) * 100);
                return (
                  <div key={item.name} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-text-secondary">
                      <div className="flex items-center gap-2">
                        {item.user ? (
                          <Avatar user={item.user} size="xs" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-surface-hover flex items-center justify-center text-[10px] text-text-muted font-bold">
                            ?
                          </div>
                        )}
                        <span className="font-medium text-text-primary">{item.name}</span>
                      </div>
                      <span className="font-mono text-text-secondary text-[11px] font-medium">
                        {item.count} task{item.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-cyan rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ==================================================== */}
      {/* SECTION D & E: ACTIVITY & PROJECT PLANNING           */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Planning, CPM, and Blockers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section E: Project Planning & Schedule Boundaries */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Project Schedule & Planning
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                  currentProject.status === 'On Track'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {currentProject.status}
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              {currentProject.description || 'No project description provided.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted pt-2 border-t border-border/60">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-text-muted" />
                Started: {currentProject.startDate || 'Unspecified'}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-text-muted" />
                Target Due Date: {currentProject.dueDate || 'Unspecified'}
              </span>
              <span className="flex items-center gap-1.5">
                <Shield size={13} className="text-text-muted" />
                High SLA: {currentProject.settings?.slaHighHours || 24}h
              </span>
            </div>
          </section>

          {/* Critical Path Method (CPM) Summary */}
          <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCommit size={15} className="text-brand-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Critical Path Milestones (CPM)
                </h3>
              </div>
              <button
                onClick={() => {
                  setProjectTab('settings#dependencies');
                  navigate(`/project/${currentProject.id}/settings#dependencies`);
                }}
                className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Dependencies</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Duration: <strong className="text-text-primary font-mono">{cpmAnalysis.totalProjectDurationDays} business days</strong></span>
              <span>Critical Chain: <strong className="text-text-primary font-mono">{cpmAnalysis.criticalTasks.length} tasks</strong></span>
            </div>

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
                <span className="text-text-muted font-sans">
                  No sequential dependencies configured yet.
                </span>
              )}
            </div>
          </section>

          {/* Identified Blockers Section (Modest empty state when none) */}
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-elevated">
              <div className="flex items-center gap-2">
                <Ban size={15} className={blockedTasks.length > 0 ? 'text-rose-400' : 'text-text-muted'} />
                <h3 className="text-sm font-semibold text-text-primary">
                  Identified Blockers ({blockedTasks.length})
                </h3>
              </div>
              <span className="text-xs text-text-muted">
                Tasks waiting on incomplete predecessors
              </span>
            </div>

            {blockedTasks.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted">
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
        </div>

        {/* Right Column: Section D: Recent Project Events & Sprint Pace */}
        <div className="space-y-6">
          {/* Active Sprint Summary Widget */}
          {activeSprint && (
            <section className="p-4 rounded-xl bg-surface border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={15} className="text-amber-400" />
                  <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                    Current Sprint
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setProjectTab('sprint');
                    navigate(`/project/${currentProject.id}/sprint`);
                  }}
                  className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1 cursor-pointer"
                >
                  <span>Sprint View</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <div>
                <p className="text-sm font-bold text-text-primary">{activeSprint.name}</p>
                <p className="text-xs text-text-muted mt-0.5 font-mono">
                  {activeSprint.startDate} → {activeSprint.endDate}
                </p>
              </div>

              {activeSprint.goal && (
                <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated p-2.5 rounded-lg border border-border">
                  &ldquo;{activeSprint.goal}&rdquo;
                </p>
              )}
            </section>
          )}

          {/* Section D: Recent Project Events */}
          <section className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Recent Project Events</h3>
              <button
                onClick={() => {
                  setProjectTab('settings#activity');
                  navigate(`/project/${currentProject.id}/settings#activity`);
                }}
                className="text-xs text-brand-primary hover:text-brand-hover cursor-pointer"
              >
                Full Activity Log
              </button>
            </div>

            <div className="p-3 divide-y divide-border/60">
              {projectActivity.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">
                  No recorded events yet for this project.
                </p>
              ) : (
                projectActivity.map((log: AuditLogEntry) => {
                  const actor = getAuditActor(log, allUsers);
                  const entity = getAuditEntityInfo(log, projectTasks, currentProject.name);
                  const formattedTime = formatAuditTimestamp(log.timestamp);

                  return (
                    <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-text-primary truncate">
                          {actor.name}
                        </span>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {formattedTime}
                        </span>
                      </div>
                      <p className="text-text-secondary leading-tight">
                        {log.description}
                      </p>
                      <div className="text-[10px] text-text-muted font-mono truncate">
                        {entity.label}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
