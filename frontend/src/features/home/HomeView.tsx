const metricFields = [
  { label: 'My Active Tasks', tone: 'text-brand-primary' },
  { label: 'Due Soon (≤5d)', tone: 'text-amber-400' },
  { label: 'Overdue Work', tone: 'text-rose-400' },
  { label: 'Blocked Work', tone: 'text-rose-400' },
  { label: 'Completed', tone: 'text-emerald-400' },
];

export function HomeView() {
  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary tracking-tight">
              Personal Workspace Overview
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Workspace data will appear here when available.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {metricFields.map((field) => (
            <div key={field.label} className="p-3.5 rounded-xl bg-surface border border-border min-h-24">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{field.label}</span>
                <span className={`w-2 h-2 rounded-full ${field.tone} bg-current`} />
              </div>
              <div className="h-8 mt-1" />
              <div className="h-3 w-20 rounded bg-surface-elevated" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-surface rounded-xl border border-border overflow-hidden min-h-56">
            <div className="px-5 py-3.5 border-b border-border bg-surface-elevated">
              <h3 className="text-sm font-semibold text-text-primary">Needs Attention (Personal Queue)</h3>
              <p className="text-xs text-text-muted mt-0.5">Overdue tasks, approaching milestones, and blocked dependencies.</p>
            </div>
          </section>

          <div className="space-y-6">
            <section className="bg-surface rounded-xl border border-border overflow-hidden min-h-40">
              <div className="px-4 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text-primary">SLA Risk &amp; Escalation Feed</h3>
                <span className="text-[10px] text-text-muted">Policy Monitor</span>
              </div>
            </section>

            <section className="bg-surface rounded-xl border border-border overflow-hidden min-h-40">
              <div className="px-4 py-3 border-b border-border bg-surface-elevated">
                <h3 className="text-xs font-semibold text-text-primary">Recent Audit Activity</h3>
              </div>
            </section>
          </div>
        </div>

        <section className="bg-surface rounded-xl border border-border p-5 min-h-36">
          <h3 className="text-sm font-semibold text-text-primary">Active Projects &amp; Milestones</h3>
        </section>
      </div>
    );
}
