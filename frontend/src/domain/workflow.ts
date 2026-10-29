import type { Task, Workflow, WorkflowStatus } from '../types';

export function normalizeWorkflowStatus(value?: string | null): string {
  return (value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function findWorkflowStatus(
  workflow: Workflow | null | undefined,
  status?: string | null,
): WorkflowStatus | undefined {
  const normalized = normalizeWorkflowStatus(status);
  if (!workflow || !normalized) return undefined;
  return workflow.statuses.find(
    (stage) =>
      normalizeWorkflowStatus(stage.name) === normalized ||
      normalizeWorkflowStatus(stage.id) === normalized,
  );
}

export function getInitialWorkflowStatus(
  workflow: Workflow | null | undefined,
): WorkflowStatus | undefined {
  if (!workflow?.statuses.length) return undefined;
  return (
    workflow.statuses.find((stage) =>
      ['backlog', 'unstarted'].includes(normalizeWorkflowStatus(stage.category)),
    ) || workflow.statuses[0]
  );
}

export function getCompletedWorkflowStatus(
  workflow: Workflow | null | undefined,
): WorkflowStatus | undefined {
  return workflow?.statuses.find((stage) =>
    ['done', 'completed', 'complete'].includes(
      normalizeWorkflowStatus(stage.category),
    ),
  );
}

export function isWorkflowStatusComplete(
  workflow: Workflow | null | undefined,
  status?: string | null,
): boolean {
  const stage = findWorkflowStatus(workflow, status);
  return Boolean(
    stage &&
      ['done', 'completed', 'complete'].includes(
        normalizeWorkflowStatus(stage.category),
      ),
  );
}

export function isWorkflowStatusActive(
  workflow: Workflow | null | undefined,
  status?: string | null,
): boolean {
  return normalizeWorkflowStatus(findWorkflowStatus(workflow, status)?.category) === 'active';
}

export function isWorkflowStatusUnstarted(
  workflow: Workflow | null | undefined,
  status?: string | null,
): boolean {
  const category = normalizeWorkflowStatus(findWorkflowStatus(workflow, status)?.category);
  return category === 'backlog' || category === 'unstarted';
}

export function getWorkflowForProject(
  workflows: Workflow[],
  projectId?: string | null,
): Workflow | undefined {
  if (!projectId) return undefined;
  return workflows.find((workflow) => workflow.projectId === projectId);
}

export function getStatusNameForTask(
  workflow: Workflow | null | undefined,
  task: Pick<Task, 'status'>,
): string {
  return findWorkflowStatus(workflow, task.status)?.name || task.status;
}

export interface WorkflowColumn {
  id: string;
  name: string;
  color: string;
}

export function getWorkflowColumns(
  workflow: Workflow | null | undefined,
  tasks: Pick<Task, 'status'>[],
): WorkflowColumn[] {
  const configured = (workflow?.statuses || []).map((status) => ({
    id: status.id,
    name: status.name,
    color: status.color || '#737987',
  }));
  const legacyStatuses = Array.from(
    new Set(tasks.filter((task) => !findWorkflowStatus(workflow, task.status)).map((task) => task.status)),
  );
  return [
    ...configured,
    ...legacyStatuses.map((status) => ({
      id: `legacy:${status}`,
      name: `${status || 'Unknown status'} (not in workflow)`,
      color: '#737987',
    })),
  ];
}

export function getStatusCounts(
  workflow: Workflow | null | undefined,
  tasks: Pick<Task, 'status'>[],
): Array<WorkflowStatus & { count: number }> {
  return (workflow?.statuses || []).map((stage) => ({
    ...stage,
    count: tasks.filter((task) => findWorkflowStatus(workflow, task.status)?.id === stage.id).length,
  }));
}
