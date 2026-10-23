import React from 'react';

export interface MetricItem {
  id: string | number;
  label: string;
  value: string | number;
  detail?: string;
  urgent?: boolean;
  positive?: boolean;
}

export interface MetricsOverviewProps {
  metrics: MetricItem[];
}

export default function MetricsOverview({ metrics }: MetricsOverviewProps) {
  return (
    <section aria-label="Task summary metrics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-surface rounded-xl border border-border px-4 py-3.5 sm:px-5 sm:py-4"
          >
            <p className="text-sm text-text-secondary font-medium">{metric.label}</p>
            <p
              className={`text-2xl sm:text-3xl font-bold mt-1 tracking-tight ${
                metric.urgent
                  ? 'text-status-danger'
                  : metric.positive
                    ? 'text-status-success'
                    : 'text-text-primary'
              }`}
            >
              {metric.value}
            </p>
            <p className="text-xs text-text-tertiary mt-1">{metric.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
