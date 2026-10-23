import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, Shield, LogOut } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { NotificationPopover } from './NotificationPopover';
import { Avatar } from '../ui/Avatar';
import { ThemeToggle } from '../ui/ThemeToggle';

export interface TopbarProps {
  onToggleSidebar?: () => void;
  onOpenCreateTask?: () => void;
  onOpenSearch?: () => void;
}

export function Topbar({ onToggleSidebar, onOpenCreateTask: _onOpenCreateTask, onOpenSearch }: TopbarProps) {
  const { currentUser, notifications, navigate, logout } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-13 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 select-none">
      {/* Left section: mobile hamburger & breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover"
          aria-label="Open sidebar"
        >
          <Menu size={19} />
        </button>

        {/* Global Search trigger bar */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2.5 h-8 px-3 rounded-lg bg-canvas border border-border text-xs text-text-muted hover:text-text-primary hover:border-border-strong transition-colors w-40 sm:w-64"
        >
          <Search size={14} className="text-text-muted" />
          <span className="truncate">Search tasks or projects...</span>
          <kbd className="hidden sm:inline-block ml-auto px-1 py-0.2 text-[10px] font-mono text-text-muted bg-surface rounded border border-border">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Active Role indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-surface-elevated border border-border text-xs text-text-secondary"
          title={`Active user role: ${currentUser.role}`}
        >
          <Shield size={12} className="text-brand-primary" />
          <span className="text-[11px] font-medium">{currentUser.role}</span>
        </div>

        {/* Theme Mode Toggle */}
        <ThemeToggle />

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label="Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-primary" />
            )}
          </button>
          <NotificationPopover isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="User menu"
          >
            <Avatar user={currentUser} size="sm" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-overlay border border-border py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-text-primary truncate">
                  {currentUser?.name || 'Workspace User'}
                </p>
                <p className="text-[11px] text-text-muted truncate">{currentUser?.email || ''}</p>
                <span className="inline-block mt-1 text-[10px] font-semibold text-brand-primary uppercase tracking-wider">
                  {currentUser?.role || 'Member'} Access
                </span>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    navigate('/settings');
                    setProfileOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  Workspace Settings
                </button>
              </div>

              <div className="border-t border-border pt-1">
                <button
                  onClick={async () => {
                    setProfileOpen(false);
                    await logout?.();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
