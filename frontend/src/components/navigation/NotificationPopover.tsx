import React from 'react';
import { Bell, Check, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { Notification } from '../../types';

export interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPopover({ isOpen, onClose }: NotificationPopoverProps) {
  const { notifications, markNotificationRead, markAllNotificationsRead, openTaskDrawer, navigate } = useApp();

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleItemClick(notif: Notification) {
    markNotificationRead(notif.id);
    if (notif.targetTaskId) {
      openTaskDrawer(notif.targetTaskId);
    } else if (notif.targetProjectId) {
      navigate(`/project/${notif.targetProjectId}/overview`);
    }
    onClose();
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface rounded-xl shadow-overlay border border-border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-text-primary" />
          <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[11px] font-medium bg-brand-primary/20 text-brand-primary px-1.5 py-0.2 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <Check size={13} />
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            No notifications right now.
          </div>
        ) : (
          notifications.map((n) => {
            const isSla = n.type === 'sla_escalation';
            const isReview = n.type === 'review_requested';

            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`p-3.5 hover:bg-surface-hover cursor-pointer transition-colors flex items-start gap-3 ${
                  !n.read ? 'bg-brand-primary/5' : ''
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSla
                      ? 'bg-rose-500/15 text-rose-400'
                      : isReview
                        ? 'bg-purple-500/15 text-purple-300'
                        : 'bg-surface-active text-text-secondary'
                  }`}
                >
                  {isSla ? (
                    <ShieldAlert size={14} />
                  ) : isReview ? (
                    <Clock size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`text-xs font-medium truncate ${
                        !n.read ? 'text-text-primary font-semibold' : 'text-text-secondary'
                      }`}
                    >
                      {n.title}
                    </p>
                    <span className="text-[10px] text-text-muted flex-shrink-0">
                      {n.createdAt || n.timestamp
                        ? new Date(n.createdAt || n.timestamp || '').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                    {n.description || n.message}
                  </p>
                </div>

                {!n.read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0 mt-2" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
