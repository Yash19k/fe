import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTaskSla } from '../src/domain/sla';
import type { Task } from '../src/types';

const task = (sla: Task['sla']): Task => ({
  id: 'task-1',
  title: 'SLA test',
  projectId: 'project-1',
  type: 'Task',
  status: 'In Progress',
  priority: 'High',
  sla,
});

describe('server-backed SLA presentation', () => {
  test('shows an on-track task with remaining time', () => {
    const result = evaluateTaskSla(task({
      status: 'ON_TRACK',
      deadline: '2026-10-22T12:00:00.000Z',
      remainingHours: 3.2,
      isBreached: false,
      isApproaching: false,
      isEscalated: false,
    }));
    assert.equal(result.isBreached, false);
    assert.equal(result.isApproaching, false);
    assert.equal(result.remainingHours, 3.2);
  });

  test('distinguishes at-risk, breached, escalated, and resolved states', () => {
    for (const [status, expected] of [
      ['AT_RISK', { approaching: true, breached: false, escalated: false }],
      ['BREACHED', { approaching: false, breached: true, escalated: false }],
      ['ESCALATED', { approaching: false, breached: false, escalated: true }],
      ['RESOLVED', { approaching: false, breached: false, escalated: false }],
    ] as const) {
      const result = evaluateTaskSla(task({
        status,
        isBreached: expected.breached,
        isApproaching: expected.approaching,
        isEscalated: expected.escalated,
      }));
      assert.equal(result.isApproaching, expected.approaching);
      assert.equal(result.isBreached, expected.breached);
      assert.equal(result.isEscalated, expected.escalated);
    }
  });

  test('legacy tasks still receive a deterministic local fallback', () => {
    const result = evaluateTaskSla({
      ...task(undefined),
      createdAt: '2026-10-20T00:00:00.000Z',
    });
    assert.equal(typeof result.remainingHours, 'number');
    assert.equal(result.isEscalated, false);
  });
});
