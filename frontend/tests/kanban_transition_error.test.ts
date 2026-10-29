import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restoreTaskPosition } from '../src/features/project/kanban/boardState';

describe('Kanban workflow transition failures', () => {
  test('rolls back the moved card and position without replacing unrelated board state', () => {
    const original = [
      { id: 'first', columnId: 'backlog', title: 'First' },
      { id: 'moving', columnId: 'backlog', title: 'Moving' },
      { id: 'other', columnId: 'review', title: 'Other' },
    ];
    const afterRejectedMove = [
      { ...original[0], title: 'Updated independently' },
      { ...original[2] },
      { ...original[1], columnId: 'done' },
    ];

    const restored = restoreTaskPosition(afterRejectedMove, original, 'moving');

    assert.deepEqual(restored.map((task) => task.id), ['first', 'moving', 'other']);
    assert.equal(restored[1].columnId, 'backlog');
    assert.equal(restored[0].title, 'Updated independently');
    assert.equal(restored[2].columnId, 'review');
  });

  test('keeps task mutation errors separate from the page-level data-loading error', () => {
    const component = readFileSync(
      new URL('../src/features/project/kanban/TaskFlowKanbanPage.tsx', import.meta.url),
      'utf8',
    );

    assert.match(component, /await changeTaskStatus\(change\.taskId, targetStatus\.name\)/);
    assert.match(component, /if \(!success\) \{\s*setTasks\(\(current\) => restoreTaskPosition/);
    assert.match(component, /error=\{currentWorkflowError \|\| projectDataError\}/);
    assert.doesNotMatch(component, /setError\(/);
    assert.doesNotMatch(component, /error=\{error\s*\|\|/);
    assert.match(component, /if \(pendingMoves\.current\.has\(change\.taskId\)\) return/);
    assert.match(component, /pendingMoves\.current\.delete\(change\.taskId\)/);
  });

  test('relies on the status mutation for one rejection toast and confirms success before commit', () => {
    const component = readFileSync(
      new URL('../src/features/project/kanban/TaskFlowKanbanPage.tsx', import.meta.url),
      'utf8',
    );
    const context = readFileSync(
      new URL('../src/state/AppContext.tsx', import.meta.url),
      'utf8',
    );
    const commit = component.slice(component.indexOf('const commit = useCallback'), component.indexOf('const handleMove'));
    const statusMutation = context.slice(
      context.indexOf('const changeTaskStatus = useCallback'),
      context.indexOf('const requestReschedule = useCallback'),
    );
    const backendUpdate = statusMutation.indexOf('await updateWorkItemApi');
    const localCommit = statusMutation.indexOf('setTasks((prev) =>');

    assert.ok(backendUpdate >= 0 && backendUpdate < localCommit);
    assert.match(statusMutation, /showToast\(reason, 'error'\);\s*return false/);
    assert.match(statusMutation, /showToast\(transitionCheck\.reason[^;]+;\s*return false/);
    assert.match(commit, /if \(!success\) \{\s*setTasks\(\(current\) => restoreTaskPosition/);
    assert.doesNotMatch(commit, /if \(!success\) \{[^}]*showToast/s);
  });

  test('preserves the existing data-loading error and retry UI', () => {
    const component = readFileSync(
      new URL('../src/features/project/kanban/TaskFlowKanbanPage.tsx', import.meta.url),
      'utf8',
    );

    assert.match(component, /error=\{currentWorkflowError \|\| projectDataError\}/);
    assert.match(component, /onRetry=\{reloadProjectData\}/);
  });
});
