import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { WorkItemTypeBadge, StatusBadge } from '../../components/ui/Badge';
import type { Task } from '../../types';

interface ProjectCalendarViewProps {
  onOpenCreateTask: (dateStr?: string) => void;
}

interface CalendarDay {
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  dateStr: string;
}

import { isTaskDueOnCalendarDate } from '../../domain/calendar';

export function ProjectCalendarView({ onOpenCreateTask }: ProjectCalendarViewProps) {
  const { projectTasks, openTaskDrawer, allUsers } = useApp();

  const [today] = useState(() => new Date());
  const [currentYear, setCurrentYear] = useState(() => today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => today.getMonth()); // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  function handlePrev() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNext() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  // Generate Month Grid Days
  const calendarDays = useMemo(() => {
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Previous month info
    const prevMonthDate = new Date(currentYear, currentMonth, 0);
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth() + 1; // 1-indexed
    const daysInPrevMonth = prevMonthDate.getDate();

    const days: CalendarDay[] = [];

    // Preceding month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const monthStr = String(prevMonthNum).padStart(2, '0');
      const dayStr = String(dayNum).padStart(2, '0');
      days.push({
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false,
        dateStr: `${prevMonthYear}-${monthStr}-${dayStr}`,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayFormatted = String(d).padStart(2, '0');
      const monthFormatted = String(currentMonth + 1).padStart(2, '0');
      const dateStr = `${currentYear}-${monthFormatted}-${dayFormatted}`;
      const isToday =
        currentYear === todayYear &&
        currentMonth === todayMonth &&
        d === todayDate;

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        dateStr,
      });
    }

    // Trailing padding days to fill grid cleanly
    const remaining = (7 - (days.length % 7)) % 7;
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonthYear = nextMonthDate.getFullYear();
    const nextMonthNum = nextMonthDate.getMonth() + 1; // 1-indexed

    for (let j = 1; j <= remaining; j++) {
      const monthStr = String(nextMonthNum).padStart(2, '0');
      const dayStr = String(j).padStart(2, '0');
      days.push({
        dayNumber: j,
        isCurrentMonth: false,
        isToday: false,
        dateStr: `${nextMonthYear}-${monthStr}-${dayStr}`,
      });
    }

    return days;
  }, [currentYear, currentMonth, today]);

  // Formatted date string for Day Details dialog heading
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDateStr]);

  // Tasks due strictly on the selected date
  const selectedDayTasks = useMemo(() => {
    if (!selectedDateStr) return [];
    return projectTasks.filter((t: Task) => isTaskDueOnCalendarDate(t, selectedDateStr));
  }, [projectTasks, selectedDateStr]);

  return (
    <div className="flex flex-col h-full bg-surface select-none">
      {/* Calendar Header Controls */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-elevated text-xs flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h3 className="text-sm font-bold text-text-primary">
            {monthNames[currentMonth]} {currentYear}
          </h3>

          <Button variant="secondary" size="sm" onClick={handleToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" icon={Plus} onClick={() => onOpenCreateTask()}>
            Create Task
          </Button>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-elevated/70 text-[11px] font-semibold text-text-muted uppercase tracking-wider text-center py-2 flex-shrink-0">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/60 overflow-y-auto">
        {calendarDays.map((cell) => {
          // Tasks strictly due on this specific calendar date
          const dayTasks = projectTasks.filter((t: Task) =>
            isTaskDueOnCalendarDate(t, cell.dateStr)
          );

          return (
            <div
              key={cell.dateStr}
              onClick={() => setSelectedDateStr(cell.dateStr)}
              className={`min-h-[105px] p-1.5 flex flex-col transition-colors cursor-pointer hover:bg-surface-elevated/50 ${
                cell.isCurrentMonth ? 'bg-surface' : 'bg-surface-elevated/30 opacity-60'
              } ${
                cell.isToday
                  ? 'bg-brand-primary/5 ring-1 ring-inset ring-brand-primary/30'
                  : ''
              } ${selectedDateStr === cell.dateStr ? 'ring-2 ring-brand-primary/60' : ''}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1 pointer-events-none">
                <span
                  className={`text-xs font-mono font-medium ${
                    cell.isToday
                      ? 'w-5 h-5 rounded-full bg-brand-primary text-zinc-950 font-bold flex items-center justify-center'
                      : cell.isCurrentMonth
                        ? 'text-text-primary'
                        : 'text-text-muted'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-text-muted font-mono font-medium">
                    {dayTasks.length} {dayTasks.length === 1 ? 'due' : 'due'}
                  </span>
                )}
              </div>

              {/* Task Chips inside day */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {dayTasks.slice(0, 3).map((task: Task) => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openTaskDrawer(task.id);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate cursor-pointer transition-colors border flex items-center gap-1 ${
                      task.status === 'Done'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : task.priority === 'High'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                          : 'bg-surface-elevated border-border text-text-primary hover:border-brand-primary'
                    }`}
                    title={`${task.type || 'Task'}: ${task.title} (Due: ${task.dueDate})`}
                  >
                    <WorkItemTypeBadge type={task.type} size="sm" showLabel={false} />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-brand-primary block font-medium">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Focused Day Details Dialog */}
      <Dialog
        isOpen={Boolean(selectedDateStr)}
        onClose={() => setSelectedDateStr(null)}
        title={
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-brand-primary" />
            <span className="text-base font-bold text-text-primary">
              {selectedDateFormatted}
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-elevated border border-border text-text-secondary">
              {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'task due' : 'tasks due'}
            </span>
          </div>
        }
        description="Work items with their actual due date on this day."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {/* Quick Action Toolbar */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs text-text-muted">
              Showing work items specifically scheduled with a due date on this day.
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                const targetDate = selectedDateStr;
                setSelectedDateStr(null);
                if (targetDate) onOpenCreateTask(targetDate);
              }}
            >
              Add task for this date
            </Button>
          </div>

          {/* Tasks List or Empty State */}
          {selectedDayTasks.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No work items due on this date"
              description="There are no project tasks with a due date on this day. Undated tasks are not placed on arbitrary calendar dates."
              actionLabel="Add task for this date"
              onAction={() => {
                const targetDate = selectedDateStr;
                setSelectedDateStr(null);
                if (targetDate) onOpenCreateTask(targetDate);
              }}
            />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDayTasks.map((task) => {
                const assignedUsers = (task.assigneeIds && task.assigneeIds.length > 0)
                  ? allUsers.filter((u) => task.assigneeIds?.includes(u.id))
                  : allUsers.filter((u) => u.id === task.assigneeId);

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setSelectedDateStr(null);
                      openTaskDrawer(task.id);
                    }}
                    className="p-3 rounded-xl bg-surface-elevated border border-border hover:border-brand-primary/50 cursor-pointer transition-all space-y-2 group shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <WorkItemTypeBadge type={task.type} size="sm" />
                        <span className="text-xs font-semibold text-text-primary group-hover:text-brand-primary transition-colors truncate">
                          {task.title}
                        </span>
                      </div>

                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 border bg-rose-500/10 text-rose-300 border-rose-500/20">
                        Due this date
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={task.status} size="sm" />
                        {task.priority && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              task.priority === 'High'
                                ? 'text-rose-400 bg-rose-500/10'
                                : task.priority === 'Medium'
                                  ? 'text-amber-400 bg-amber-500/10'
                                  : 'text-text-muted bg-surface'
                            }`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {assignedUsers.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {assignedUsers.slice(0, 3).map((u) => (
                                <Avatar key={u.id} user={u} size="xs" />
                              ))}
                            </div>
                            <span className="text-[11px] text-text-secondary truncate max-w-[120px]">
                              {assignedUsers.map((u) => u.name).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
