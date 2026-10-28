import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input, Textarea, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { useApp } from '../../hooks/useApp';
import { Globe, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { ProjectVisibility } from '../../types';
import {
  generateSuggestedProjectId,
  validateProjectId,
  validateProjectDates,
  normalizeProjectId,
} from '../../domain/projects';
import { toDateInputValue } from '../../utils/dateUtils';

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const { createProject, projects, workflows, navigate } = useApp();

  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(() => generateSuggestedProjectId('', projects));
  const [isIdManuallyEdited, setIsIdManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [visibility, setVisibility] = useState<ProjectVisibility>('global');
  const [color, setColor] = useState('#7465F6');
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id || 'wf-1');

  // Form errors
  const [nameError, setNameError] = useState('');
  const [idError, setIdError] = useState('');
  const [dateError, setDateError] = useState('');

  const colors = [
    { label: 'Purple', hex: '#7465F6' },
    { label: 'Cyan', hex: '#35D5F2' },
    { label: 'Emerald', hex: '#36C98F' },
    { label: 'Amber', hex: '#F2BA55' },
    { label: 'Rose', hex: '#F07187' },
    { label: 'Indigo', hex: '#6366F1' },
  ];

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setName(val);
    if (nameError) setNameError('');

    if (!isIdManuallyEdited) {
      const suggested = generateSuggestedProjectId(val, projects);
      setProjectId(suggested);
      if (idError) setIdError('');
    }
  }

  function handleIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = normalizeProjectId(e.target.value);
    setProjectId(val);
    setIsIdManuallyEdited(true);

    const validation = validateProjectId(val, projects);
    if (!validation.isValid) {
      setIdError(validation.error!);
    } else {
      setIdError('');
    }
  }

  function handleRegenerateId() {
    const suggested = generateSuggestedProjectId(name || 'PROJECT', projects);
    setProjectId(suggested);
    setIsIdManuallyEdited(false);
    setIdError('');
  }

  function handleStartDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setStartDate(val);
    const dateValidation = validateProjectDates(val, dueDate);
    if (!dateValidation.isValid) {
      setDateError(dateValidation.error!);
    } else {
      setDateError('');
    }
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setDueDate(val);
    const dateValidation = validateProjectDates(startDate, val);
    if (!dateValidation.isValid) {
      setDateError(dateValidation.error!);
    } else {
      setDateError('');
    }
  }

  function resetForm() {
    setName('');
    setProjectId('');
    setIsIdManuallyEdited(false);
    setDescription('');
    setStartDate('');
    setDueDate('');
    setVisibility('global');
    setColor('#7465F6');
    setWorkflowId(workflows[0]?.id || 'wf-1');
    setNameError('');
    setIdError('');
    setDateError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let hasErrors = false;

    if (!name.trim()) {
      setNameError('Project name is required');
      hasErrors = true;
    }

    const idValidation = validateProjectId(projectId, projects);
    if (!idValidation.isValid) {
      setIdError(idValidation.error!);
      hasErrors = true;
    }

    const dateValidation = validateProjectDates(startDate, dueDate);
    if (!dateValidation.isValid) {
      setDateError(dateValidation.error!);
      hasErrors = true;
    }

    if (hasErrors) return;

    const normalizedKey = normalizeProjectId(projectId);

    const newProj = createProject({
      name: name.trim(),
      projectKey: normalizedKey,
      description: description.trim(),
      startDate: startDate || '',
      dueDate: dueDate || '',
      visibility,
      color,
      workflowId,
    });

    if (newProj) {
      resetForm();
      onClose();
      navigate(`/project/${newProj.id}/overview`);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Create New Project"
      description="Start a workspace project with custom workflow, team members, and milestones."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Project Name */}
        <Input
          label="Project Name *"
          placeholder="e.g. Mobile App Redesign"
          value={name}
          onChange={handleNameChange}
          error={nameError}
          autoFocus
        />

        {/* Project ID (Visible, editable, auto-suggested, unique) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-text-secondary">
              Project ID *
            </label>
            <button
              type="button"
              onClick={handleRegenerateId}
              className="text-[11px] text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles size={11} />
              <span>Generate unique ID</span>
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={projectId}
              onChange={handleIdChange}
              placeholder="e.g. MOBILE-APP"
              className={`w-full h-9 rounded-lg bg-surface border px-3 text-xs font-mono font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 ${
                idError
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-border focus:ring-brand-primary'
              }`}
            />
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            Automatically suggested; must be unique. You can edit it.
          </p>
          {idError && (
            <div className="flex items-center gap-1 text-[11px] text-rose-400 mt-1">
              <AlertCircle size={12} />
              <span>{idError}</span>
            </div>
          )}
        </div>

        {/* Project Description */}
        <Textarea
          label="Project Description"
          placeholder="What is the objective or deliverable of this project?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        {/* Start Date & Target Delivery Date (Default to blank!) */}
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date (Optional)"
              type="date"
              value={toDateInputValue(startDate)}
              onChange={handleStartDateChange}
            />
            <Input
              label="Target Delivery Date (Optional)"
              type="date"
              value={toDateInputValue(dueDate)}
              onChange={handleDueDateChange}
            />
          </div>
          {dateError && (
            <div className="flex items-center gap-1 text-[11px] text-rose-400 mt-1.5">
              <AlertCircle size={12} />
              <span>{dateError}</span>
            </div>
          )}
        </div>

        {/* Visibility: Global vs Private */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Project Visibility *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
              className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-2.5 ${
                visibility === 'global'
                  ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary/30'
                  : 'bg-surface border-border hover:bg-surface-hover'
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="global"
                checked={visibility === 'global'}
                onChange={() => setVisibility('global')}
                className="mt-0.5 text-brand-primary"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-text-primary">
                  <Globe size={13} className="text-brand-primary" />
                  <span>Global</span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                  Everyone in this company can view this project.
                </p>
              </div>
            </label>

            <label
              className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-2.5 ${
                visibility === 'private'
                  ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary/30'
                  : 'bg-surface border-border hover:bg-surface-hover'
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                className="mt-0.5 text-brand-primary"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-text-primary">
                  <Lock size={13} className="text-amber-400" />
                  <span>Private</span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                  Only project members and the project owner can view this project.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Workflow Template */}
        <Select
          label="Workflow Template"
          value={workflowId}
          onChange={(e) => setWorkflowId(e.target.value)}
        >
          {workflows.map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name} ({wf.statuses.length} stages)
            </option>
          ))}
        </Select>

        {/* Accent Color */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Color Accent
          </label>
          <div className="flex items-center gap-2">
            {colors.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.hex)}
                className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                  color === c.hex ? 'scale-110 border-white' : 'border-transparent opacity-80'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit">
            Create Project
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
