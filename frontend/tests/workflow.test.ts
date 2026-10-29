import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findWorkflowStatus,
  getStatusCounts,
  getWorkflowColumns,
  getWorkflowForProject,
  getStatusNameForTask,
  isWorkflowStatusComplete,
} from '../src/domain/workflow';
import type { Task, Workflow } from '../src/types';

const stages = [
  { id: 's-backlog', name: 'Backlog', category: 'unstarted', color: '#667085' },
  { id: 's-progress', name: 'In Progress', category: 'active', color: '#3B82F6' },
  { id: 's-review', name: 'In Review', category: 'active', color: '#A855F7' },
  { id: 's-qa', name: 'Testing / QA', category: 'active', color: '#06B6D4' },
  { id: 's-blocked', name: 'Blocked', category: 'impediment', color: '#EF4444' },
  { id: 's-hold', name: 'On Hold', category: 'impediment', color: '#F97316' },
  { id: 's-done', name: 'Done', category: 'completed', color: '#22C55E' },
];

const task = (status: string): Pick<Task, 'status'> => ({ status });

describe('backend-driven workflow helpers', () => {
  test('keeps every configured board column in backend order', () => {
    const workflow: Workflow = {
      id: 'workflow-project-a',
      projectId: 'project-a',
      name: 'Project A workflow',
      statuses: stages,
    };

    assert.deepEqual(
      getWorkflowColumns(workflow, []).map((column) => column.name),
      stages.map((stage) => stage.name),
    );
    assert.equal(getWorkflowColumns(workflow, []).length, 7);
  });

  test('reflects newly added statuses and reordered backend configuration', () => {
    const workflow: Workflow = {
      id: 'workflow-project-a',
      name: 'Project A workflow',
      statuses: [...stages, { id: 's-release', name: 'Ready for Release', category: 'active' }],
    };
    const reordered = { ...workflow, statuses: [...workflow.statuses].reverse() };

    assert.equal(getWorkflowColumns(workflow, []).at(-1)?.name, 'Ready for Release');
    assert.deepEqual(
      getWorkflowColumns(reordered, []).map((column) => column.id),
      reordered.statuses.map((stage) => stage.id),
    );
  });

  test('resolves workflow data independently for each project', () => {
    const workflows: Workflow[] = [
      { id: 'a', projectId: 'project-a', name: 'A', statuses: [stages[0]] },
      { id: 'b', projectId: 'project-b', name: 'B', statuses: [stages[6]] },
    ];

    assert.equal(getWorkflowForProject(workflows, 'project-a')?.statuses[0].name, 'Backlog');
    assert.equal(getWorkflowForProject(workflows, 'project-b')?.statuses[0].name, 'Done');
  });

  test('matches canonical task status identifiers to custom display names', () => {
    const workflow: Workflow = {
      id: 'custom',
      name: 'Custom workflow',
      statuses: [{ id: 'release-stage', name: 'Ready for Release', category: 'active' }],
    };

    assert.equal(findWorkflowStatus(workflow, 'READY_FOR_RELEASE')?.id, 'release-stage');
    assert.equal(getStatusNameForTask(workflow, task('READY_FOR_RELEASE')), 'Ready for Release');
  });

  test('keeps configured empty columns and counts tasks by status identifier', () => {
    const workflow: Workflow = {
      id: 'workflow',
      name: 'Workflow',
      statuses: [stages[0], stages[1]],
    };
    const counts = getStatusCounts(workflow, [task('IN_PROGRESS')]);

    assert.deepEqual(counts.map(({ name, count }) => [name, count]), [
      ['Backlog', 0],
      ['In Progress', 1],
    ]);
  });

  test('retains tasks in a separate legacy column without rewriting their statuses', () => {
    const workflow: Workflow = {
      id: 'workflow',
      name: 'Workflow',
      statuses: [stages[0]],
    };
    const columns = getWorkflowColumns(workflow, [task('REMOVED_STATUS')]);

    assert.equal(columns[1].id, 'legacy:REMOVED_STATUS');
    assert.equal(columns[1].name, 'REMOVED_STATUS (not in workflow)');
  });

  test('uses configured completion metadata instead of a display label', () => {
    const workflow: Workflow = {
      id: 'workflow',
      name: 'Workflow',
      statuses: [
        { id: 'one', name: 'Done', category: 'active' },
        { id: 'two', name: 'Finished', category: 'completed' },
      ],
    };

    assert.equal(isWorkflowStatusComplete(workflow, 'Done'), false);
    assert.equal(isWorkflowStatusComplete(workflow, 'Finished'), true);
  });
});
