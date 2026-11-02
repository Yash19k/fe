import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  backendRecurrenceToRule,
  buildBackendRecurrence,
} from '../src/domain/recurrence';
import {
  backendWorkItemToTask,
  createWorkItemApi,
} from '../src/services/api';

describe('Backend recurrence integration', () => {
  test('builds the backend DTO for supported recurrence choices', () => {
    assert.deepEqual(
      buildBackendRecurrence('daily', 2, true, '2026-11-02'),
      {
        frequency: 'DAILY',
        interval: 2,
        startsOn: '2026-11-02',
        timezone: 'Asia/Kolkata',
        weekdaysOnly: true,
      },
    );
    assert.deepEqual(
      buildBackendRecurrence('weekly_monday', 1, false, '2026-11-06'),
      {
        frequency: 'WEEKLY',
        interval: 1,
        startsOn: '2026-11-06',
        timezone: 'Asia/Kolkata',
        daysOfWeek: [1],
      },
    );
    assert.deepEqual(
      buildBackendRecurrence('weekly', 2, false, '2026-11-02'),
      {
        frequency: 'WEEKLY',
        interval: 2,
        startsOn: '2026-11-02',
        timezone: 'Asia/Kolkata',
        daysOfWeek: [1],
      },
    );
    assert.deepEqual(
      buildBackendRecurrence('monthly', 1, false, '2026-11-15'),
      {
        frequency: 'MONTHLY',
        interval: 1,
        startsOn: '2026-11-15',
        timezone: 'Asia/Kolkata',
        monthlyPattern: 'DAY_OF_MONTH',
        dayOfMonth: 15,
      },
    );
    assert.deepEqual(
      buildBackendRecurrence('monthly_first_day', 1, false, '2026-11-15'),
      {
        frequency: 'MONTHLY',
        interval: 1,
        startsOn: '2026-11-15',
        timezone: 'Asia/Kolkata',
        monthlyPattern: 'FIRST_DAY',
      },
    );
    assert.deepEqual(
      buildBackendRecurrence('monthly_last_friday', 1, false, '2026-11-15'),
      {
        frequency: 'MONTHLY',
        interval: 1,
        startsOn: '2026-11-15',
        timezone: 'Asia/Kolkata',
        monthlyPattern: 'LAST_FRIDAY',
      },
    );
    assert.equal(buildBackendRecurrence('none', 1, false, '2026-11-02'), undefined);
  });

  test('POSTs recurrence in the actual work-item request body and omits it for one-time tasks', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; method?: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method,
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ success: true, data: { id: 'work-item-1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const base = {
        projectId: 'project-1',
        type: 'TASK',
        title: 'Recurring task',
      };
      const frequencies = [
        ['daily', '2026-11-02'],
        ['weekly_monday', '2026-11-06'],
        ['monthly', '2026-11-15'],
        ['monthly_first_day', '2026-11-15'],
        ['monthly_last_friday', '2026-11-15'],
      ] as const;

      for (const [frequency, startsOn] of frequencies) {
        const recurrence = buildBackendRecurrence(frequency, 1, false, startsOn);
        assert.ok(recurrence);
        await createWorkItemApi({ ...base, recurrence });
      }
      await createWorkItemApi(base);

      assert.equal(requests.length, 6);
      for (const request of requests) {
        assert.equal(request.method, 'POST');
        assert.ok(request.url.endsWith('/api/work-items'));
        assert.equal(request.body.title, 'Recurring task');
        assert.equal('recurrenceRule' in request.body, false);
      }
      assert.deepEqual(requests[0].body.recurrence, {
        frequency: 'DAILY',
        interval: 1,
        startsOn: '2026-11-02',
        timezone: 'Asia/Kolkata',
        weekdaysOnly: false,
      });
      assert.deepEqual(requests[1].body.recurrence, {
        frequency: 'WEEKLY',
        interval: 1,
        startsOn: '2026-11-06',
        timezone: 'Asia/Kolkata',
        daysOfWeek: [1],
      });
      assert.deepEqual(requests[2].body.recurrence, {
        frequency: 'MONTHLY',
        interval: 1,
        startsOn: '2026-11-15',
        timezone: 'Asia/Kolkata',
        monthlyPattern: 'DAY_OF_MONTH',
        dayOfMonth: 15,
      });
      assert.deepEqual(requests[3].body.recurrence, {
        frequency: 'MONTHLY',
        interval: 1,
        startsOn: '2026-11-15',
        timezone: 'Asia/Kolkata',
        monthlyPattern: 'FIRST_DAY',
      });
      assert.deepEqual(requests[4].body.recurrence, {
        frequency: 'MONTHLY',
        interval: 1,
        startsOn: '2026-11-15',
        timezone: 'Asia/Kolkata',
        monthlyPattern: 'LAST_FRIDAY',
      });
      assert.equal('recurrence' in requests[5].body, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('maps returned recurrence data and preserves unknown retrieval state', () => {
    const recurringTask = backendWorkItemToTask({
      id: 'work-item-1',
      projectId: 'project-1',
      type: 'TASK',
      title: 'Weekly task',
      status: 'BACKLOG',
      recurrence: {
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [1],
        startsOn: '2026-11-02',
        endsOn: null,
        timezone: 'Asia/Kolkata',
        weekdaysOnly: false,
      },
    });
    assert.equal(recurringTask.recurrenceRule.frequency, 'weekly_monday');
    assert.deepEqual(recurringTask.recurrenceRule.daysOfWeek, [1]);
    assert.deepEqual(
      backendRecurrenceToRule({
        frequency: 'MONTHLY',
        interval: 1,
        monthlyPattern: 'DAY_OF_MONTH',
        dayOfMonth: 15,
        startsOn: '2026-11-15',
      }),
      {
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 15,
        startsOn: '2026-11-15',
      },
    );

    const unavailableTask = backendWorkItemToTask({
      id: 'work-item-2',
      projectId: 'project-1',
      type: 'TASK',
      title: 'Unknown recurrence',
      status: 'BACKLOG',
    });
    assert.equal(unavailableTask.recurrence, undefined);
    assert.equal(unavailableTask.recurrenceRule, undefined);

    const oneTimeTask = backendWorkItemToTask({
      id: 'work-item-3',
      projectId: 'project-1',
      type: 'TASK',
      title: 'One-time task',
      status: 'BACKLOG',
      recurrence: null,
    });
    assert.equal(oneTimeTask.recurrence, null);
    assert.equal(oneTimeTask.recurrenceRule.frequency, 'none');
  });
});
