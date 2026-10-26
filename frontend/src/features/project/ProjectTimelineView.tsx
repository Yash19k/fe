import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { calculateCriticalPath } from '../../domain/criticalPath';
import { parseLocalDate, formatShortDate } from '../../domain/businessDays';
import {
  GitCommit,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { WorkItemTypeBadge } from '../../components/ui/Badge';
import type { Task } from '../../types';

interface TimelineDate {
  dayNumber: number;
  dateStr: string;
  dayName: string;
  isWeekend: boolean;
  isToday: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function ProjectTimelineView() {
  const { currentProject, projectTasks, openTaskDrawer } = useApp();

  const [today] = useState(() => new Date());
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth()); // 0-indexed
  const [highlightCriticalPath, setHighlightCriticalPath] = useState(true);
  const [zoomScale, setZoomScale] = useState(38); // pixel width per day (28px to 54px)
  const containerRef = useRef<HTMLDivElement>(null);

  // Critical path analysis
  const cpm = useMemo(() => calculateCriticalPath(projectTasks), [projectTasks]);

  // Compute timeline days for the selected viewYear and viewMonth
  const { timelineDates, daysInMonth, isViewingCurrentMonth, todayDayNumber } = useMemo(() => {
    const isCurrent = viewYear === today.getFullYear() && viewMonth === today.getMonth();
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();

    const dates: TimelineDate[] = [];
    for (let d = 1; d <= count; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(viewMonth + 1).padStart(2, '0');
      const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
      const dateObj = new Date(viewYear, viewMonth, d);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const isToday = isCurrent && d === today.getDate();

      dates.push({
        dayNumber: d,
        dateStr,
        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'narrow' }),
        isWeekend,
        isToday,
      });
    }

    return {
      timelineDates: dates,
      daysInMonth: count,
      isViewingCurrentMonth: isCurrent,
      todayDayNumber: today.getDate(),
    };
  }, [viewYear, viewMonth, today]);

  // Scroll to today on initial mount if viewing current month
  useEffect(() => {
    if (isViewingCurrentMonth && containerRef.current) {
      const todayLeft = (todayDayNumber - 1) * zoomScale;
      containerRef.current.scrollTo({
        left: Math.max(0, todayLeft - 220),
        behavior: 'auto',
      });
    }
  }, [isViewingCurrentMonth, todayDayNumber, zoomScale]);

  function handlePrev() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNext() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setTimeout(() => {
      if (containerRef.current) {
        const todayLeft = (today.getDate() - 1) * zoomScale;
        containerRef.current.scrollTo({
          left: Math.max(0, todayLeft - 220),
          behavior: 'smooth',
        });
      }
    }, 50);
  }

  const sections = useMemo(() => {
    return (
      currentProject?.sections || [
        { id: 'sec-1', name: 'Discovery & Plan' },
        { id: 'sec-2', name: 'Execution' },
        { id: 'sec-3', name: 'Review & Launch' },
      ]
    );
  }, [currentProject?.sections]);

  const visibleSections = useMemo(() => {
    const knownSectionIds = new Set(sections.map((s) => s.id));
    const firstSectionId = sections[0]?.id || 'sec-1';

    return sections
      .map((sec) => {
        const secTasks = projectTasks.filter((t: Task) => {
          if (t.sectionId && knownSectionIds.has(t.sectionId)) {
            return t.sectionId === sec.id;
          }
          return sec.id === firstSectionId;
        });

        return {
          ...sec,
          tasks: secTasks,
        };
      })
      .filter((sec) => sec.tasks.length > 0);
  }, [sections, projectTasks]);

  function getBarCoordinates(task: Task) {
    // Respect tasks with blank dates: do not invent dates
    if (!task.startDate && !task.dueDate) {
      return null;
    }

    const startStr = task.startDate || task.dueDate!;
    const dueStr = task.dueDate || task.startDate!;

    const startD = parseLocalDate(startStr);
    const dueD = parseLocalDate(dueStr);

    const monthStart = new Date(viewYear, viewMonth, 1);
    const monthEnd = new Date(viewYear, viewMonth, daysInMonth);

    // If the task does not overlap the visible month at all, return null
    if (dueD < monthStart || startD > monthEnd) {
      return null;
    }

    // Clamp into the visible month
    const startDay = startD < monthStart ? 1 : startD.getDate();
    const dueDay = dueD > monthEnd ? daysInMonth : dueD.getDate();

    const left = (startDay - 1) * zoomScale;
    const width = Math.max(zoomScale, (dueDay - startDay + 1) * zoomScale);

    return { left, width, startDay, dueDay };
  }

  return (
    <div className="flex flex-col h-full bg-surface select-none">
      {/* Timeline Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-border bg-surface-elevated text-xs flex-shrink-0">
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

          <span className="font-bold text-text-primary text-sm">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>

          <Button variant="secondary" size="sm" onClick={handleToday}>
            Today
          </Button>

          <span className="text-text-muted">·</span>

          <label className="flex items-center gap-2 cursor-pointer text-text-secondary hover:text-text-primary transition-colors">
            <input
              type="checkbox"
              checked={highlightCriticalPath}
              onChange={(e) => setHighlightCriticalPath(e.target.checked)}
              className="rounded border-border text-brand-primary"
            />
            <span className="flex items-center gap-1 font-medium">
              <GitCommit size={14} className="text-rose-400" />
              Critical Path (CPM)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-text-muted text-[11px]">Zoom:</span>
          <button
            onClick={() => setZoomScale((z) => Math.max(28, z - 6))}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={() => setZoomScale((z) => Math.min(54, z + 6))}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      {/* Gantt Matrix Container */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="min-w-max flex flex-col">
          {/* Header Row: Month / Days */}
          <div className="sticky top-0 z-30 flex bg-surface-elevated border-b border-border">
            {/* Left title column header */}
            <div className="sticky left-0 z-40 w-64 sm:w-72 px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider border-r border-border flex-shrink-0 bg-surface-elevated shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
              Task Breakdown
            </div>

            {/* Days columns */}
            <div className="flex">
              {timelineDates.map((d) => (
                <div
                  key={d.dayNumber}
                  style={{ width: `${zoomScale}px` }}
                  className={`flex flex-col items-center justify-center py-1 text-[11px] border-r border-border/40 ${
                    d.isToday
                      ? 'bg-brand-primary/20 text-brand-primary font-bold ring-1 ring-inset ring-brand-primary/40'
                      : d.isWeekend
                        ? 'bg-surface/50 text-text-muted'
                        : 'text-text-secondary'
                  }`}
                >
                  <span className="text-[9px] uppercase font-mono">{d.dayName}</span>
                  <span className="font-mono">{d.dayNumber}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Body: Sections & Task Bars */}
          <div className="divide-y divide-border/60">
            {visibleSections.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No work items found in this project.
              </div>
            ) : (
              visibleSections.map((sec) => {
                const isDiscoveryAndPlan = sec.name.trim().toLowerCase() === 'discovery & plan';

                return (
                  <div key={sec.id} className="relative">
                    {/* Section Label Header (Omitted for Discovery & Plan per presentation requirements) */}
                    {!isDiscoveryAndPlan && (
                      <div className="flex items-center h-8 bg-surface-active/40 border-b border-border/40">
                        <div className="sticky left-0 z-20 w-64 sm:w-72 px-4 text-xs font-bold text-text-primary uppercase tracking-wider truncate border-r border-border flex-shrink-0 bg-surface-elevated/95 backdrop-blur-xs shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                          {sec.name} ({sec.tasks.length})
                        </div>
                        {/* Background grid lines for section */}
                        <div className="flex h-full">
                          {timelineDates.map((d) => (
                            <div
                              key={d.dayNumber}
                              style={{ width: `${zoomScale}px` }}
                              className={`h-full border-r border-border/20 ${
                                d.isToday
                                  ? 'bg-brand-primary/10'
                                  : d.isWeekend
                                    ? 'bg-surface-active/10'
                                    : ''
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Task Rows */}
                  {sec.tasks.map((task: Task) => {
                    const isCritical = cpm.criticalTaskIds.has(task.id);
                    const coords = getBarCoordinates(task);

                    return (
                      <div
                        key={task.id}
                        className="flex items-center h-10 border-b border-border/30 hover:bg-surface-hover/50 transition-colors group relative"
                      >
                        {/* Task Title Left Column */}
                        <div
                          onClick={() => openTaskDrawer(task.id)}
                          className="sticky left-0 z-10 w-64 sm:w-72 px-3 text-xs font-medium text-text-primary truncate border-r border-border flex-shrink-0 cursor-pointer bg-surface group-hover:bg-surface-hover/90 transition-colors group-hover:text-brand-primary flex items-center justify-between gap-1.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                          title={task.title}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <WorkItemTypeBadge type={task.type} size="sm" showLabel={false} />
                            <span className="truncate">{task.title}</span>
                          </div>
                          {isCritical && highlightCriticalPath && (
                            <span className="text-[10px] text-rose-400 font-bold ml-1 flex-shrink-0">
                              CPM
                            </span>
                          )}
                        </div>

                        {/* Timeline Date Grid Row with Task Bar */}
                        <div className="relative flex h-full items-center">
                          {/* Background cell dividers */}
                          {timelineDates.map((d) => (
                            <div
                              key={d.dayNumber}
                              style={{ width: `${zoomScale}px` }}
                              className={`h-full border-r border-border/20 ${
                                d.isToday
                                  ? 'bg-brand-primary/10 border-r-brand-primary/40'
                                  : d.isWeekend
                                    ? 'bg-surface/30'
                                    : ''
                              }`}
                            />
                          ))}

                          {/* Rendered Gantt Bar (only if dates are present and in range) */}
                          {coords && (
                            <div
                              onClick={() => openTaskDrawer(task.id)}
                              style={{
                                left: `${coords.left}px`,
                                width: `${coords.width}px`,
                              }}
                              className={`absolute top-1.5 bottom-1.5 rounded-md px-2.5 flex items-center justify-between text-xs font-semibold cursor-pointer shadow-xs transition-transform hover:scale-[1.01] overflow-hidden ${
                                highlightCriticalPath && isCritical
                                  ? 'bg-status-danger-bg border border-status-danger-border text-status-danger-text'
                                  : task.status === 'Done'
                                    ? 'bg-status-success-bg border border-status-success-border text-status-success-text'
                                    : task.status === 'In Progress'
                                      ? 'bg-brand-subtle border border-brand-border text-brand-text'
                                      : 'bg-surface-elevated border border-border-strong text-text-secondary'
                              }`}
                              title={`${task.title} (${task.startDate || 'No start'} to ${task.dueDate || 'No due'})`}
                            >
                              <span className="truncate text-[11px]">{task.title}</span>
                              <span className="text-[10px] font-mono opacity-80 flex-shrink-0 ml-1">
                                {task.dueDate ? formatShortDate(task.dueDate) : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
