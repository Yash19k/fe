import React, { useState, useEffect, useRef } from 'react';
import { Search, FolderKanban, CheckSquare, User, ArrowRight, X } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { StatusBadge, PriorityBadge, WorkItemTypeBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { canUserAccessProject } from '../../domain/permissions';
import {
  findWorkflowStatus,
  getStatusNameForTask,
  getWorkflowForProject,
} from '../../domain/workflow';

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const { tasks, projects, workflows, allUsers, currentUser, openTaskDrawer, navigate } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keydown: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accessibleProjects = projects.filter((p) => canUserAccessProject(p, currentUser?.id, currentUser?.role));
  const accessibleProjectIds = new Set(accessibleProjects.map((p) => p.id));
  const accessibleTasks = tasks.filter((t) => accessibleProjectIds.has(t.projectId));

  const q = query.trim().toLowerCase();

  const matchingTasks = q
    ? accessibleTasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          (t.type && t.type.toLowerCase().includes(q)) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      )
    : accessibleTasks.slice(0, 4);

  const matchingProjects = q
    ? accessibleProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          (p.projectKey || '').toLowerCase().includes(q)
      )
    : accessibleProjects.slice(0, 3);

  const matchingUsers = q
    ? allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      )
    : [];

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-surface rounded-xl border border-border shadow-overlay overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[80vh]">
        {/* Search header */}
        <div className="flex items-center px-4 h-13 border-b border-border bg-surface-elevated">
          <Search size={18} className="text-text-muted mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, members, or tags... (Esc to close)"
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-text-muted hover:text-text-primary rounded mr-1"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Projects */}
          {matchingProjects.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                <FolderKanban size={13} />
                <span>Projects</span>
              </div>
              <div className="space-y-1">
                {matchingProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onClose();
                      navigate(`/project/${p.id}/overview`);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm font-medium text-text-primary truncate">
                        {p.name}
                      </span>
                      {p.projectKey && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-text-muted shrink-0">
                          {p.projectKey}
                        </span>
                      )}
                      <span className="text-xs text-text-muted truncate hidden sm:inline">
                        — {p.description}
                      </span>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {matchingTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                <CheckSquare size={13} />
                <span>Work Items</span>
              </div>
              <div className="space-y-1">
                {matchingTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      onClose();
                      openTaskDrawer(t.id);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-hover cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <WorkItemTypeBadge type={t.type} size="sm" />
                      <StatusBadge
                        status={t.status}
                        label={getStatusNameForTask(getWorkflowForProject(workflows, t.projectId), t)}
                        color={findWorkflowStatus(getWorkflowForProject(workflows, t.projectId), t.status)?.color}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-text-primary truncate">
                        {t.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PriorityBadge priority={t.priority} size="sm" />
                      <ArrowRight
                        size={14}
                        className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {matchingUsers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                <User size={13} />
                <span>Team Members</span>
              </div>
              <div className="space-y-1">
                {matchingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar user={u} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{u.name}</p>
                        <p className="text-xs text-text-muted">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-text-muted bg-surface-active px-2 py-0.5 rounded">
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingTasks.length === 0 && matchingProjects.length === 0 && matchingUsers.length === 0 && (
            <div className="py-8 text-center text-text-muted text-sm">
              No matching tasks or projects found for &quot;{query}&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
