import React from 'react';
import { Users, ListTodo, Calendar } from 'lucide-react';
import { formatDeadline } from '../data/mockData';

export interface MyProjectItem {
  id: string | number;
  name: string;
  description?: string;
  color?: string;
  progress: number;
  activeTasks: number;
  members: number;
  deadline: string;
}

export interface MyProjectsProps {
  projects: MyProjectItem[];
}

export default function MyProjects({ projects }: MyProjectsProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-text-primary">My Projects</h2>
        <p className="text-sm text-text-secondary mt-0.5">Projects you&apos;re currently working on.</p>
      </div>
      <div className="space-y-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: MyProjectItem }) {
  return (
    <div
      tabIndex={0}
      className="bg-surface rounded-xl border border-border p-4 hover:border-border hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-500 transition-shadow duration-100 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: project.color || '#6B9CFF' }}
          aria-hidden="true"
        >
          {project.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{project.name}</h3>
          <p className="text-xs text-text-secondary mt-0.5 truncate">{project.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-text-secondary">Progress</span>
          <span className="text-xs font-semibold text-text-primary">{project.progress}%</span>
        </div>
        <div
          className="w-full h-1.5 bg-surface-active rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={project.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${project.name} progress: ${project.progress}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${project.progress}%`,
              backgroundColor: project.color || '#6B9CFF',
            }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <ListTodo size={13} className="text-text-tertiary" />
          {project.activeTasks} tasks
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={13} className="text-text-tertiary" />
          {project.members}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar size={13} className="text-text-tertiary" />
          {formatDeadline(project.deadline)}
        </span>
      </div>
    </div>
  );
}
