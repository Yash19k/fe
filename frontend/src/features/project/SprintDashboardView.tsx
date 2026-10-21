import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { getProjectSprintsApi, backendSprintToFrontend } from '../../services/api';
import { Sprint, Task } from '../../types';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge, WorkItemTypeBadge } from '../../components/ui/Badge';
import {
  Zap,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  ListTodo,
  Layers,
  ChevronDown,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { getRelativeDateLabel } from '../../domain/businessDays';

export interface SprintDashboardViewProps {
  onOpenCreateSprint?: () => void;
}

export function SprintDashboardView({ onOpenCreateSprint }: SprintDashboardViewProps) {
  const { currentProject, projectTasks, allUsers, openTaskDrawer, currentUser } = useApp();

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load sprints from backend for this project with cancellation and unmount protection
  const loadSprints = async (isMountedCheck?: () => boolean) => {
    if (!currentProject?.id) {
      setIsLoading(false);
      setSprints([]);
      setSelectedSprintId('');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await getProjectSprintsApi(currentProject.id);
      if (isMountedCheck && !isMountedCheck()) return;

      if (res?.data && Array.isArray(res.data)) {
        const mapped: Sprint[] = res.data.map(backendSprintToFrontend);
        setSprints(mapped);
        if (mapped.length > 0) {
          // Select ACTIVE sprint if present, otherwise first sprint
          const active = mapped.find((s: Sprint) => s.status === 'ACTIVE');
          setSelectedSprintId((prev) => {
            const exists = mapped.some((s: Sprint) => s.id === prev);
            return exists ? prev : (active ? active.id : mapped[0].id);
          });
        } else {
          setSelectedSprintId('');
        }
      } else {
        setSprints([]);
        setSelectedSprintId('');
      }
    } catch (err: any) {
      if (isMountedCheck && !isMountedCheck()) return;
      setError(err?.message || 'Failed to load project sprints from server');
    } finally {
      if (!isMountedCheck || isMountedCheck()) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    // Clear previous project sprints immediately to prevent stale telemetry display
    setSprints([]);
    setSelectedSprintId('');
    setError(null);

    loadSprints(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [currentProject?.id]);

  const selectedSprint = useMemo(() => {
    return sprints.find((s) => s.id === selectedSprintId) || null;
  }, [sprints, selectedSprintId]);

  // Tasks belonging to this sprint
  const sprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    const idSet = new Set(selectedSprint.workItemIds || []);
    return projectTasks.filter(
      (t: Task) => t.sprintId === selectedSprint.id || idSet.has(t.id)
    );
  }, [selectedSprint, projectTasks]);

  // Sprint Summary Calculations
  const metrics = useMemo(() => {
    const total = sprintTasks.length;
    const completed = sprintTasks.filter((t) => t.status === 'Done').length;
    const inProgress = sprintTasks.filter(
      (t) => t.status === 'In Progress' || t.status === 'In Review' || t.status === 'Testing / QA'
    ).length;
    const remaining = total - completed;
    const overdue = sprintTasks.filter(
      (t) => t.status !== 'Done' && getRelativeDateLabel(t.dueDate).isOverdue
    ).length;
    const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      remaining,
      overdue,
      completionPercentage,
    };
  }, [sprintTasks]);

  // Distribution by Status
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    sprintTasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [sprintTasks]);

  // Workload by Member
  const memberWorkload = useMemo(() => {
    const memberMap: Record<
      string,
      { total: number; completed: number; inProgress: number; tasks: Task[] }
    > = {};

    sprintTasks.forEach((t) => {
      const assigneeKey = t.assigneeId || 'unassigned';
      if (!memberMap[assigneeKey]) {
        memberMap[assigneeKey] = { total: 0, completed: 0, inProgress: 0, tasks: [] };
      }
      memberMap[assigneeKey].total += 1;
      if (t.status === 'Done') {
        memberMap[assigneeKey].completed += 1;
      } else {
        memberMap[assigneeKey].inProgress += 1;
      }
      memberMap[assigneeKey].tasks.push(t);
    });

    return memberMap;
  }, [sprintTasks]);

  const canCreateSprint = currentUser?.role !== 'Teammate';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <RefreshCw size={24} className="text-brand-primary animate-spin mb-3" />
        <p className="text-xs text-text-muted">Loading sprint telemetry and task distribution...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 rounded-xl bg-surface border border-rose-500/30 text-center space-y-4">
        <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Sprint Telemetry Error</h3>
          <p className="text-xs text-rose-300/90 mt-1">{error}</p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { loadSprints(); }}>
          Retry Loading Sprints
        </Button>
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-xl bg-surface border border-border text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-brand-primary shadow-xs">
          <Zap size={22} />
        </div>
        <div>
          <h3 className="text-base font-bold text-text-primary">No Sprints Configured</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            This project does not have any sprints planned yet. Create a sprint to organize work items into time-boxed iterations.
          </p>
        </div>
        {canCreateSprint && onOpenCreateSprint && (
          <Button variant="primary" size="sm" icon={Plus} onClick={onOpenCreateSprint}>
            Create First Sprint
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sprint Header & Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">
                Sprint Iteration
              </span>
              {selectedSprint && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    selectedSprint.status === 'ACTIVE'
                      ? 'bg-status-success-bg text-status-success-text border border-status-success-border'
                      : selectedSprint.status === 'COMPLETED'
                      ? 'bg-surface-elevated text-text-muted border border-border'
                      : 'bg-status-info-bg text-status-info-text border border-status-info-border'
                  }`}
                >
                  {selectedSprint.status}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">
              {selectedSprint?.name || 'Sprint Dashboard'}
            </h2>
          </div>
        </div>

        {/* Sprint Picker and Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 rounded-lg bg-surface-elevated border border-border text-xs font-medium text-text-primary hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
            >
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => { loadSprints(); }}
            className="h-8"
            title="Refresh sprint metrics from database"
          >
            Refresh
          </Button>

          {canCreateSprint && onOpenCreateSprint && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={onOpenCreateSprint}
              className="h-8 font-medium"
            >
              Add Sprint
            </Button>
          )}
        </div>
      </div>

      {selectedSprint && (
        <>
          {/* Sprint Date Range & Goal Notice */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted px-1">
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-brand-primary" />
              <span>
                Schedule: <span className="text-text-primary font-medium">{selectedSprint.startDate}</span> to{' '}
                <span className="text-text-primary font-medium">{selectedSprint.endDate}</span>
              </span>
            </div>
            {selectedSprint.goal && (
              <p className="italic text-text-secondary">
                Goal: &quot;{selectedSprint.goal}&quot;
              </p>
            )}
          </div>

          {/* KPI Metrics Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Total Tasks</span>
                <ListTodo size={14} className="text-brand-primary" />
              </div>
              <p className="text-2xl font-bold font-mono text-text-primary mt-1">{metrics.total}</p>
              <span className="text-[11px] text-text-muted">In scope</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Completed</span>
                <CheckCircle2 size={14} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{metrics.completed}</p>
              <span className="text-[11px] text-text-muted">{metrics.completionPercentage}% complete</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>In Progress</span>
                <Clock size={14} className="text-blue-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-blue-400 mt-1">{metrics.inProgress}</p>
              <span className="text-[11px] text-text-muted">Active iterations</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Remaining</span>
                <Layers size={14} className="text-amber-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-text-primary mt-1">{metrics.remaining}</p>
              <span className="text-[11px] text-text-muted">To be done</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Overdue</span>
                <AlertTriangle size={14} className="text-rose-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-rose-400 mt-1">{metrics.overdue}</p>
              <span className="text-[11px] text-rose-400/80">Late deliverables</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Velocity</span>
                <Zap size={14} className="text-brand-primary" />
              </div>
              <p className="text-2xl font-bold font-mono text-brand-primary mt-1">
                {metrics.completed} / {metrics.total}
              </p>
              <span className="text-[11px] text-text-muted">Items resolved</span>
            </div>
          </div>

          {/* Progress Bar & Status Distribution */}
          <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-text-primary">Sprint Delivery Progress</span>
              <span className="font-mono font-bold text-brand-primary text-sm">
                {metrics.completionPercentage}%
              </span>
            </div>

            {/* Visual Multi-Color Progress Bar */}
            <div className="w-full h-3 rounded-full bg-surface-elevated overflow-hidden flex border border-border">
              {metrics.total > 0 ? (
                <>
                  <div
                    style={{ width: `${(metrics.completed / metrics.total) * 100}%` }}
                    className="bg-emerald-500 transition-all duration-300"
                    title={`Completed: ${metrics.completed}`}
                  />
                  <div
                    style={{ width: `${(metrics.inProgress / metrics.total) * 100}%` }}
                    className="bg-brand-primary transition-all duration-300"
                    title={`In Progress: ${metrics.inProgress}`}
                  />
                  <div
                    style={{
                      width: `${
                        ((metrics.total - metrics.completed - metrics.inProgress) / metrics.total) * 100
                      }%`,
                    }}
                    className="bg-surface-elevated transition-all duration-300"
                    title={`Backlog/Planned: ${metrics.total - metrics.completed - metrics.inProgress}`}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-surface-elevated" />
              )}
            </div>

            {/* Status Legend Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              {statusDistribution.map(({ status, count }) => (
                <div
                  key={status}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-elevated border border-border"
                >
                  <StatusBadge status={status} size="sm" />
                  <span className="font-mono font-semibold text-text-primary">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Workload by Assigned Member */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-brand-primary" />
                  <h3 className="text-sm font-bold text-text-primary">Workload by Member</h3>
                </div>
                <span className="text-xs text-text-muted font-mono">
                  {Object.keys(memberWorkload).length} assignees
                </span>
              </div>

              {Object.keys(memberWorkload).length === 0 ? (
                <p className="text-xs text-text-muted italic py-4 text-center">
                  No work items assigned to this sprint yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(memberWorkload).map(([assigneeId, data]) => {
                    const user = allUsers.find((u) => u.id === assigneeId);
                    const isUnassigned = assigneeId === 'unassigned';
                    const name = isUnassigned ? 'Unassigned' : user?.name || user?.email || 'Team Member';
                    const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

                    return (
                      <div
                        key={assigneeId}
                        className="p-3 rounded-lg bg-surface-elevated border border-border space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {isUnassigned ? (
                              <div className="w-6 h-6 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-[10px] text-text-muted font-bold">
                                ?
                              </div>
                            ) : (
                              <Avatar user={user} size="sm" />
                            )}
                            <span className="font-semibold text-text-primary">{name}</span>
                          </div>
                          <span className="font-mono text-text-secondary">
                            {data.completed}/{data.total} completed ({pct}%)
                          </span>
                        </div>

                        {/* Member progress bar */}
                        <div className="w-full h-1.5 rounded-full bg-surface-elevated border border-border/40 overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-brand-primary transition-all duration-200"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sprint Task Breakdown List */}
            <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ListTodo size={16} className="text-brand-primary" />
                  <h3 className="text-sm font-bold text-text-primary">Sprint Work Items</h3>
                </div>
                <span className="text-xs text-text-muted font-mono">
                  {sprintTasks.length} items
                </span>
              </div>

              {sprintTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted italic">
                  No tasks attached to this sprint iteration.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {sprintTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openTaskDrawer(t.id)}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <WorkItemTypeBadge type={t.type} size="sm" showLabel={false} />
                        <span className="font-medium text-text-primary truncate">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={t.status} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
