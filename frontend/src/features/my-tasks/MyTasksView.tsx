import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { TaskRow } from '../../components/tasks/TaskRow';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Search,
  X,
  CheckSquare,
} from 'lucide-react';
import { Task } from '../../types';

export function MyTasksView() {
  const { currentUser, myTasks, projects, loadCrossProjectTasks } = useApp();

  React.useEffect(() => {
    loadCrossProjectTasks?.();
  }, [loadCrossProjectTasks]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('dueDate'); // dueDate, priority, status, title
  const [groupBy, setGroupBy] = useState('status'); // none, status, priority

  // Filtered tasks - deduplicated by ID to prevent any parent/child double rendering
  const filteredTasks = useMemo(() => {
    const seen = new Set<string>();
    return myTasks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);

      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !t.description?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (typeFilter !== 'ALL' && (t.type || 'Task') !== typeFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
      return true;
    });
  }, [myTasks, search, typeFilter, statusFilter, priorityFilter, projectFilter]);

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    const list = [...filteredTasks];
    list.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sortBy === 'priority') {
        const pMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        const scoreB = b.priority ? (pMap[b.priority] || 0) : 0;
        const scoreA = a.priority ? (pMap[a.priority] || 0) : 0;
        return scoreB - scoreA;
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
    return list;
  }, [filteredTasks, sortBy]);

  // Grouped tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return [{ title: 'All Tasks', items: sortedTasks }];
    }

    if (groupBy === 'status') {
      const groups: Record<string, Task[]> = {};
      sortedTasks.forEach((t) => {
        if (!groups[t.status]) groups[t.status] = [];
        groups[t.status].push(t);
      });
      return Object.entries(groups).map(([st, items]) => ({
        title: st,
        items,
      }));
    }

    if (groupBy === 'priority') {
      const groups: Record<string, Task[]> = { Urgent: [], High: [], Medium: [], Low: [], 'No priority': [] };
      sortedTasks.forEach((t) => {
        const key = t.priority || 'No priority';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
      return Object.entries(groups)
        .filter((entry) => entry[1].length > 0)
        .map(([pr, items]) => ({
          title: pr === 'No priority' ? 'No Priority' : `${pr} Priority`,
          items,
        }));
    }

    return [{ title: 'All Tasks', items: sortedTasks }];
  }, [sortedTasks, groupBy]);

  const hasActiveFilters =
    search || typeFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || projectFilter !== 'ALL';

  function resetFilters() {
    setSearch('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setProjectFilter('ALL');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">My Tasks</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Work items assigned to {currentUser.name} across all active projects.
          </p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Grouping, Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[180px]">
            <input
              type="search"
              placeholder="Filter tasks by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-surface-elevated border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>

          {/* Work Item Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
            title="Filter by work item type"
          >
            <option value="ALL">All Types</option>
            <option value="Epic">Epic</option>
            <option value="Story">Story</option>
            <option value="Task">Task</option>
            <option value="Subtask">Subtask</option>
            <option value="Bug">Bug</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
            title="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="Backlog">Backlog</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
            <option value="Testing / QA">Testing / QA</option>
            <option value="Blocked">Blocked</option>
            <option value="On Hold">On Hold</option>
            <option value="Done">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-rose-400 px-2 py-1 transition-colors"
            >
              <X size={12} />
              Reset filters
            </button>
          )}
        </div>

        {/* Sorting & Grouping Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-text-muted">Group:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
            >
              <option value="status">Status</option>
              <option value="priority">Priority</option>
              <option value="none">None</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-text-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grouped Task Tables */}
      {sortedTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks match your filter criteria"
          description={
            hasActiveFilters
              ? 'Try resetting your active filters to see all assigned tasks.'
              : 'You have no assigned tasks right now.'
          }
          actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
          onAction={hasActiveFilters ? resetFilters : undefined}
        />
      ) : (
        <div className="space-y-4">
          {groupedTasks.map((group) => (
            <section
              key={group.title}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-elevated text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <span>
                  {group.title} ({group.items.length})
                </span>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[860px]">
                  {/* Header row matching TaskRow 6-column grid */}
                  <div className="grid grid-cols-[minmax(280px,1fr)_140px_110px_110px_90px_80px] items-center gap-3 px-4 py-2 border-b border-border/40 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-surface/50 select-none">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 shrink-0" />
                      <span>Task</span>
                    </div>
                    <span>Assignee</span>
                    <span>Due Date</span>
                    <span className="text-center">Status</span>
                    <span>Priority</span>
                    <span className="text-right">Tags</span>
                  </div>

                  <div className="divide-y divide-border/40">
                    {group.items.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
