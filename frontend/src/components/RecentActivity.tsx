import React from 'react';

export interface ActivityItem {
  id: string | number;
  user: {
    name: string;
    initials: string;
    avatarColor?: string;
  };
  action: string;
  target: string;
  detail?: string;
  time: string;
}

export interface RecentActivityProps {
  activities: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-text-primary">Recent Activity</h2>
      </div>
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {activities.map((act, i) => (
          <div
            key={act.id}
            className={`flex items-start gap-3 px-4 py-3 ${
              i !== activities.length - 1 ? 'border-b border-border-light' : ''
            }`}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0 mt-0.5"
              style={{ backgroundColor: act.user.avatarColor }}
              aria-hidden="true"
            >
              {act.user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-secondary leading-snug">
                <span className="font-medium text-text-primary">{act.user.name.split(' ')[0]}</span>
                {' '}{act.action}{' '}
                <span className="font-medium text-text-primary">{act.target}</span>
                {act.detail && <span> {act.detail}</span>}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">{act.time}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
