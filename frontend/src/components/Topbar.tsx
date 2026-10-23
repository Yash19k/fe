import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Plus } from 'lucide-react';
import { SidebarToggle } from './Sidebar';

export interface TopbarProps {
  user: { name: string; [key: string]: any };
  onCreateTask?: () => void;
  onToggleSidebar?: () => void;
  onSearch?: (value: string) => void;
}

export default function Topbar({ user, onCreateTask, onToggleSidebar, onSearch }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const greeting = getGreeting();

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  // Close popovers on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch?.(value);
  }

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          <SidebarToggle onClick={onToggleSidebar} />
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-lg font-semibold text-text-primary truncate">
              {greeting}, {user.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-text-secondary truncate">
              Here&apos;s what&apos;s happening with your work today.
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            {searchOpen ? (
              <div className="flex items-center">
                <input
                  ref={searchRef}
                  type="search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search tasks..."
                  className="w-48 sm:w-64 h-9 pl-9 pr-3 rounded-lg border border-border bg-canvas text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  aria-label="Search tasks"
                  onBlur={() => {
                    if (!searchQuery) setSearchOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      setSearchOpen(false);
                      onSearch?.('');
                    }
                  }}
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              </div>
            ) : (
              <button
                className="p-2 rounded-lg text-text-secondary hover:bg-surface-active hover:text-text-primary transition-colors"
                onClick={() => setSearchOpen(true)}
                aria-label="Search tasks"
              >
                <Search size={18} />
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              className="relative p-2 rounded-lg text-text-secondary hover:bg-surface-active hover:text-text-primary transition-colors"
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              aria-haspopup="true"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-danger rounded-full" />
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-surface rounded-xl shadow-overlay border border-border z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <NotifItem
                    title="Task overdue"
                    desc="Fix dashboard responsive layout is past due"
                    time="2 hours ago"
                    unread
                  />
                  <NotifItem
                    title="New comment"
                    desc="Maithil commented on Project Setup"
                    time="1 hour ago"
                    unread
                  />
                  <NotifItem
                    title="Task completed"
                    desc="Diya marked Dashboard UI as done"
                    time="34 min ago"
                  />
                </div>
                <div className="px-4 py-2.5 border-t border-border">
                  <button className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Create Task */}
          <button
            onClick={onCreateTask}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 active:bg-brand-700 transition-colors shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Create task</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function NotifItem({
  title,
  desc,
  time,
  unread,
}: {
  title: string;
  desc: string;
  time: string;
  unread?: boolean;
}) {
  return (
    <div className={`px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer ${unread ? 'bg-brand-50/50' : ''}`}>
      <div className="flex items-start gap-2">
        {unread && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
        <div className={unread ? '' : 'pl-4'}>
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
          <p className="text-xs text-text-tertiary mt-1">{time}</p>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
