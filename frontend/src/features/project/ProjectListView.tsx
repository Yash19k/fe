import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { TaskRow } from '../../components/tasks/TaskRow';
import { Button } from '../../components/ui/Button';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  Layers,
} from 'lucide-react';
import type { Task, WorkflowStatus } from '../../types';

interface ProjectListViewProps {
  onOpenCreateTask: () => void;
}

interface TaskGroup {
  id: string;
  name: string;
  color?: string;
  tasks: Task[];
}

const STANDARD_STATUS_ORDER = [
  'Backlog',
  'In Progress',
  'In Review',
  'Testing / QA',
  'Done',
  'Blocked',
  'On Hold',
];

export function ProjectListView({ onOpenCreateTask }: ProjectListViewProps) {
  const { currentProject, projectTasks, createTask, currentWorkflow } = useApp();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [groupBy, setGroupBy] = useState<'status' | 'section' | 'none'>('status');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [inlineGroupId, setInlineGroupId] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');

  // Workflow statuses
  const workflowStatuses: WorkflowStatus[] = useMemo(() => {
    const isStandardWorkflow =
      !currentWorkflow || currentWorkflow.isDefault || currentWorkflow.id === 'wf-1';

    if (isStandardWorkflow) {
      return [
        { id: 'st-backlog', name: 'Backlog', color: '#6B7280' },
        { id: 'st-inprogress', name: 'In Progress', color: '#3B82F6' },
        { id: 'st-inreview', name: 'In Review', color: '#A855F7' },
        { id: 'st-testingqa', name: 'Testing / QA', color: '#06B6D4' },
        { id: 'st-done', name: 'Done', color: '#22C55E' },
        { id: 'st-blocked', name: 'Blocked', color: '#EF4444' },
        { id: 'st-onhold', name: 'On Hold', color: '#F97316' },
      ];
    }
    return currentWorkflow?.statuses || [];
  }, [currentWorkflow]);

  const sections = useMemo(() => {
    return currentProject?.sections || [
      { id: 'sec-1', name: 'Discovery & Plan' },
      { id: 'sec-2', name: 'Execution' },
    ];
  }, [currentProject?.sections]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((t: Task) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (typeFilter !== 'ALL' && (t.type || 'Task') !== typeFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [projectTasks, search, typeFilter, statusFilter, priorityFilter]);

  // Group tasks based on groupBy
  const groups: TaskGroup[] = useMemo(() => {
    if (groupBy === 'status') {
      const result: TaskGroup[] = [];
      const knownStatuses = new Set<string>();

      workflowStatuses.forEach((st) => {
        knownStatuses.add(st.name);
        result.push({
          id: st.name,
          name: st.name,
          color: st.color,
          tasks: filteredTasks.filter((t: Task) => t.status === st.name),
        });
      });

      // Catch any tasks with custom/other status
      const otherTasks = filteredTasks.filter((t: Task) => !knownStatuses.has(t.status));
      if (otherTasks.length > 0) {
        result.push({
          id: 'other',
          name: 'Other',
          color: '#9CA3AF',
          tasks: otherTasks,
        });
      }
      return result;
    }

    if (groupBy === 'section') {
      const result: TaskGroup[] = [];
      const knownSectionIds = new Set<string>();

      sections.forEach((sec) => {
        knownSectionIds.add(sec.id);
        result.push({
          id: sec.id,
          name: sec.name,
          tasks: filteredTasks.filter((t: Task) => t.sectionId === sec.id),
        });
      });

      const unassignedTasks = filteredTasks.filter(
        (t: Task) => !t.sectionId || !knownSectionIds.has(t.sectionId)
      );
      if (unassignedTasks.length > 0) {
        result.push({
          id: 'unassigned-section',
          name: 'No Section',
          tasks: unassignedTasks,
        });
      }
      return result;
    }

    // groupBy === 'none'
    return [
      {
        id: 'all',
        name: 'All Work Items',
        tasks: filteredTasks,
      },
    ];
  }, [groupBy, workflowStatuses, sections, filteredTasks]);

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function handleInlineAddSubmit(groupId: string) {
    if (!inlineTitle.trim() || !currentProject) return;

    if (groupBy === 'status') {
      createTask({
        title: inlineTitle.trim(),
        projectId: currentProject.id,
        type: 'Task',
        status: groupId === 'other' ? 'Backlog' : groupId,
        priority: null,
        assigneeId: null,
        dueDate: '',
        estimateHours: null,
      });
    } else if (groupBy === 'section') {
      createTask({
        title: inlineTitle.trim(),
        projectId: currentProject.id,
        sectionId: groupId === 'unassigned-section' ? undefined : groupId,
        type: 'Task',
        status: 'Backlog',
        priority: null,
        assigneeId: null,
        dueDate: '',
        estimateHours: null,
      });
    } else {
      createTask({
        title: inlineTitle.trim(),
        projectId: currentProject.id,
        type: 'Task',
        status: 'Backlog',
        priority: null,
        assigneeId: null,
        dueDate: '',
        estimateHours: null,
      });
    }

    setInlineTitle('');
    setInlineGroupId(null);
  }

  const hasActiveFilters =
    search || typeFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
      {/* List Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-surface border border-border text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <Button variant="primary" size="sm" icon={Plus} onClick={onOpenCreateTask}>
            Add Work Item
          </Button>

          <div className="relative min-w-[160px]">
            <input
              type="search"
              placeholder="Search in project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-surface-elevated border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>

          {/* Type Filter */}
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
            {STANDARD_STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary focus:outline-none"
            title="Filter by priority"
          >
            <option value="ALL">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Group By Selector */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-border/60">
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <Layers size={12} />
              Group:
            </span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'status' | 'section' | 'none')}
              className="h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-secondary font-medium focus:outline-none"
              title="Group tasks by status or section"
            >
              <option value="status">Status</option>
              <option value="section">Section</option>
              <option value="none">None</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
              }}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-rose-400 px-2 py-1 transition-colors"
            >
              <X size={12} />
              Reset filters
            </button>
          )}
        </div>

        <div className="text-[11px] text-text-muted font-mono">
          Showing {filteredTasks.length} of {projectTasks.length} tasks
        </div>
      </div>

      {/* Grouped Tables */}
      <div className="space-y-4">
        {groups.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.id]);
          const isInlineOpen = inlineGroupId === group.id;

          return (
            <div
              key={group.id}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              {/* Group Header */}
              <div
                onClick={() => toggleGroup(group.id)}
                className="flex items-center justify-between px-4 py-2.5 bg-surface-elevated border-b border-border text-xs font-semibold text-text-primary cursor-pointer hover:bg-surface-hover transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={15} className="text-text-muted" />
                  ) : (
                    <ChevronDown size={15} className="text-text-muted" />
                  )}
                  {group.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                  )}
                  <span>{group.name}</span>
                  <span className="text-[11px] font-normal text-text-muted bg-surface px-1.5 py-0.2 rounded font-mono">
                    {group.tasks.length}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInlineGroupId(group.id);
                  }}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                  title={`Add task in ${group.name}`}
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Task Rows */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <div className="min-w-[860px]">
                    {/* Table Column Headers */}
                    <div className="grid grid-cols-[minmax(280px,1fr)_140px_110px_110px_90px_80px] gap-3 items-center px-4 py-2 border-b border-border/50 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-surface/40 select-none">
                      <div className="flex items-center gap-2">
                        <span className="w-4 shrink-0" />
                        <span>Task Title</span>
                      </div>
                      <span>Assignee</span>
                      <span>Due Date</span>
                      <span className="text-center">Status</span>
                      <span>Priority</span>
                      <span className="text-right">Tags</span>
                    </div>

                    <div className="divide-y divide-border/40">
                      {group.tasks.length === 0 ? (
                        <div className="px-5 py-4 text-center text-xs text-text-muted italic">
                          No work items in this group. Click &quot;+&quot; to add one.
                        </div>
                      ) : (
                        group.tasks.map((t: Task) => <TaskRow key={t.id} task={t} />)
                      )}
                    </div>
                  </div>

                  {/* Inline Task Add row */}
                  {isInlineOpen && (
                    <div className="p-3 border-t border-border bg-surface-elevated/40 flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder={`New work item title in ${group.name}... (Press Enter to save)`}
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineAddSubmit(group.id);
                          if (e.key === 'Escape') setInlineGroupId(null);
                        }}
                        className="flex-1 h-8 rounded-lg bg-surface border border-border px-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleInlineAddSubmit(group.id)}
                      >
                        Add
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setInlineGroupId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
