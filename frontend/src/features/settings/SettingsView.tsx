import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Shield, RotateCcw, Check } from 'lucide-react';

export function SettingsView() {
  const { currentUser, resetDemoState, showToast } = useApp();

  const [slaHigh, setSlaHigh] = useState<number | string>(24);
  const [slaMedium, setSlaMedium] = useState<number | string>(48);
  const [slaLow, setSlaLow] = useState<number | string>(96);
  const [warningThreshold, setWarningThreshold] = useState<number | string>(8);

  function handleSaveSlaSettings(e: React.FormEvent) {
    e.preventDefault();
    showToast('SLA threshold policy updated', 'success');
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-text-primary tracking-tight">
          Workspace & Profile Settings
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Manage prototype preferences, SLA policy parameters, and demo data reset.
        </p>
      </div>

      {/* User Profile Summary */}
      <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Current User Profile</h3>
        <div className="flex items-center gap-4">
          <Avatar user={currentUser} size="lg" />
          <div>
            <p className="text-sm font-bold text-text-primary">{currentUser.name}</p>
            <p className="text-xs text-text-muted">{currentUser.email}</p>
            <span className="inline-block mt-1 text-[11px] font-semibold text-brand-primary uppercase tracking-wider">
              {currentUser.role} Role
            </span>
          </div>
        </div>
      </section>

      {/* SLA Policy Thresholds Form */}
      <section className="p-5 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-brand-primary" />
          <h3 className="text-sm font-semibold text-text-primary">
            SLA Policy Resolution Thresholds (Hours)
          </h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Configure maximum allowable resolution time before tasks trigger manager escalation alerts.
        </p>

        <form onSubmit={handleSaveSlaSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <Input
            label="High Priority SLA (Hours)"
            type="number"
            min="1"
            value={slaHigh}
            onChange={(e) => setSlaHigh(e.target.value)}
          />
          <Input
            label="Medium Priority SLA (Hours)"
            type="number"
            min="1"
            value={slaMedium}
            onChange={(e) => setSlaMedium(e.target.value)}
          />
          <Input
            label="Low Priority SLA (Hours)"
            type="number"
            min="1"
            value={slaLow}
            onChange={(e) => setSlaLow(e.target.value)}
          />
          <Input
            label="Breach Warning Lead Time (Hours)"
            type="number"
            min="1"
            value={warningThreshold}
            onChange={(e) => setWarningThreshold(e.target.value)}
          />

          <div className="sm:col-span-2 flex justify-end">
            <Button variant="primary" size="sm" type="submit" icon={Check}>
              Save SLA Settings
            </Button>
          </div>
        </form>
      </section>

      {/* Prototype Reset Demo State */}
      <section className="p-5 rounded-xl bg-surface border border-rose-500/30 space-y-3">
        <h3 className="text-sm font-semibold text-rose-300">Reset Prototype Demo Data</h3>
        <p className="text-xs text-text-muted leading-relaxed">
          Clears local browser storage and reloads the pristine seed datasets (TaskFlow Pro, AgriSmart AI, and GeoVision AI with all original tasks, dependencies, and audit history).
        </p>
        <Button variant="danger" size="sm" icon={RotateCcw} onClick={resetDemoState}>
          Reset to Factory Seed State
        </Button>
      </section>
    </div>
  );
}
