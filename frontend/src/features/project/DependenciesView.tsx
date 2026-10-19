import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { calculateCriticalPath } from '../../domain/criticalPath';
import {
  validateNewDependency,
} from '../../domain/dependencyGraph';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Trash2, AlertTriangle, GitCommit } from 'lucide-react';
import { Task } from '../../types';

interface DependencyLink {
  id: string;
  predecessor: Task;
  successor: Task;
}

export function DependenciesView() {
  const { projectTasks, addDependency, removeDependency, openTaskDrawer, showToast, currentUser } = useApp();

  const [fromTaskId, setFromTaskId] = useState('');
  const [toTaskId, setToTaskId] = useState('');
  const [cycleAlert, setCycleAlert] = useState<{ reason?: string; cyclePathIds?: string[] } | null>(null);

  // Compute CPM
  const cpm = useMemo(() => calculateCriticalPath(projectTasks), [projectTasks]);

  function handleAddDependencyLink() {
    if (!fromTaskId || !toTaskId) return;
    setCycleAlert(null);

    const validation = validateNewDependency(fromTaskId, toTaskId, projectTasks);
    if (!validation.isValid) {
      if (validation.isCycle) {
        setCycleAlert({
          reason: validation.reason,
          cyclePathIds: validation.cyclePathIds,
        });
      }
      showToast(validation.reason || 'Invalid dependency', 'error');
      return;
    }

    addDependency(fromTaskId, toTaskId);
    setFromTaskId('');
    setToTaskId('');
  }

  // Flatten all dependency links for table view
  const allLinks = useMemo(() => {
    const list: DependencyLink[] = [];
    projectTasks.forEach((succ) => {
      (succ.dependencyIds || []).forEach((predId: string) => {
        const pred = projectTasks.find((t) => t.id === predId);
        if (pred) {
          list.push({
            id: `${pred.id}->${succ.id}`,
            predecessor: pred,
            successor: succ,
          });
        }
      });
    });
    return list;
  }, [projectTasks]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Dependency Graph Engine & Critical Path (CPM)
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Finish-to-Start dependency management with DFS cycle detection and float calculations.
          </p>
        </div>
      </div>

      {/* Cycle Detection Interactive Banner */}
      {cycleAlert && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
            <AlertTriangle size={18} className="text-rose-400 flex-shrink-0" />
            <span>Cycle Prevention Triggered</span>
          </div>
          <p className="leading-relaxed">{cycleAlert.reason}</p>
          <p className="text-[11px] text-rose-300/80">
            Rule: A circular dependency would deadlock project scheduling because no task in the loop could legally complete first.
          </p>
        </div>
      )}

      {/* Critical Path Method (CPM) Card */}
      <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommit size={16} className="text-brand-primary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Critical Path Analysis (Zero Total Float)
            </h3>
          </div>
          <span className="text-xs font-mono text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
            Total Project Duration: {cpm.totalProjectDurationDays} business days
          </span>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          The critical path represents the minimum duration needed to complete the project based on topological sort and forward/backward passes.
        </p>

        <div className="space-y-1.5 pt-2">
          {cpm.criticalTasks.map((t, idx) => (
            <div
              key={t.id}
              onClick={() => openTaskDrawer(t.id)}
              className="p-2.5 rounded-lg bg-surface-elevated border border-border hover:border-brand-primary cursor-pointer flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-full bg-rose-500/15 text-rose-400 font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-text-primary truncate">{t.title}</span>
              </div>
              <div className="flex items-center gap-2 text-text-muted flex-shrink-0">
                <span className="font-mono">{t.startDate} → {t.dueDate}</span>
                <span className="text-rose-400 font-semibold text-[11px]">Slack = 0d</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add Dependency Relationship Form (Test Lab) */}
      {currentUser.role !== 'Teammate' && (
        <section className="p-5 rounded-xl bg-surface border border-border space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Link Predecessor & Successor (DFS Protected)
          </h3>
          <p className="text-xs text-text-muted">
            Select a predecessor (Task A) and successor (Task B). The engine runs a graph search to prevent circular loops.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end pt-1">
            <div className="sm:col-span-2">
              <label className="text-xs text-text-muted block mb-1">Predecessor (Task A - Must finish first)</label>
              <select
                value={fromTaskId}
                onChange={(e) => setFromTaskId(e.target.value)}
                className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-3 text-xs text-text-primary focus:outline-none"
              >
                <option value="">Select predecessor task...</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-text-muted block mb-1">Successor (Task B - Depends on Task A)</label>
              <select
                value={toTaskId}
                onChange={(e) => setToTaskId(e.target.value)}
                className="w-full h-9 rounded-lg bg-surface-elevated border border-border px-3 text-xs text-text-primary focus:outline-none"
              >
                <option value="">Select successor task...</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                disabled={!fromTaskId || !toTaskId}
                onClick={handleAddDependencyLink}
              >
                Add Link
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Active Dependencies Table */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Active Project Dependency Edges ({allLinks.length})
          </h3>
        </div>

        <div className="divide-y divide-border/60">
          {allLinks.length === 0 ? (
            <p className="p-6 text-center text-xs text-text-muted italic">
              No dependencies linked yet.
            </p>
          ) : (
            allLinks.map((link) => (
              <div
                key={link.id}
                className="p-3.5 hover:bg-surface-hover/60 transition-colors flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div
                    onClick={() => openTaskDrawer(link.predecessor.id)}
                    className="font-medium text-text-primary hover:text-brand-primary cursor-pointer truncate max-w-xs"
                  >
                    {link.predecessor.title}
                  </div>
                  <span className="text-brand-primary font-bold">→</span>
                  <div
                    onClick={() => openTaskDrawer(link.successor.id)}
                    className="font-medium text-text-primary hover:text-brand-primary cursor-pointer truncate max-w-xs"
                  >
                    {link.successor.title}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={link.predecessor.status} size="sm" />
                  {currentUser.role !== 'Teammate' && (
                    <button
                      onClick={() =>
                        removeDependency(link.predecessor.id, link.successor.id)
                      }
                      className="text-text-muted hover:text-rose-400 p-1"
                      title="Remove dependency"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
