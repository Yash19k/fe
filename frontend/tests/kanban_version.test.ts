import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { backendWorkItemToTask, updateWorkItemApi } from '../src/services/api';
import { getWorkItemVersion } from '../src/domain/workItems';

describe('Kanban work-item version handling', () => {
  test('maps the backend version and does not fabricate one when missing', () => {
    const task = backendWorkItemToTask({
      workItem: {
        id: 'work-item-1',
        projectId: 'project-1',
        type: 'TASK',
        title: 'Review release',
        status: 'BACKLOG',
        version: 12,
      },
    });

    assert.equal(task.version, 12);
    assert.equal(getWorkItemVersion(task), 12);

    const missingVersion = backendWorkItemToTask({
      workItem: {
        id: 'work-item-2',
        projectId: 'project-1',
        type: 'TASK',
        title: 'Missing version',
        status: 'BACKLOG',
      },
    });
    assert.equal(missingVersion.version, undefined);
    assert.equal(getWorkItemVersion(missingVersion), undefined);
  });

  test('serializes the current version in the existing update request body', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody: Record<string, unknown> | undefined;

    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        success: true,
        data: { workItem: { version: 13 } },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const response = await updateWorkItemApi('work-item-1', {
        version: 12,
        status: 'IN_PROGRESS',
      });
      assert.deepEqual(requestBody, { version: 12, status: 'IN_PROGRESS' });
      assert.equal(backendWorkItemToTask(response.data).version, 13);
      assert.equal(getWorkItemVersion(backendWorkItemToTask(response.data)), 13);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
