import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  frontendStatusToBackend,
  backendStatusToFrontend,
  toBackendRole,
  normalizeRole,
  escalateWorkItemApi,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from '../src/services/api';
import { canUserAccessProject } from '../src/domain/permissions';
import { classifyAuthError } from '../src/features/auth/AuthView';
import type { TaskStatus, Project } from '../src/types';

describe('Phase 1 Remediation Tests: F-01, F-02, F-03, F-04, F-05, F-12', () => {

  // ==========================================
  // F-01: Status Data Corruption
  // ==========================================
  describe('F-01: Work-Item Status Mapping', () => {
    const statusPairs: Array<[TaskStatus, string]> = [
      ['Backlog', 'BACKLOG'],
      ['In Progress', 'IN_PROGRESS'],
      ['In Review', 'IN_REVIEW'],
      ['Testing / QA', 'TESTING_QA'],
      ['Blocked', 'BLOCKED'],
      ['Done', 'DONE'],
      ['On Hold', 'ON_HOLD'],
    ];

    test('verifies all 7 statuses map correctly from frontend to backend', () => {
      for (const [feStatus, beStatus] of statusPairs) {
        assert.equal(
          frontendStatusToBackend(feStatus),
          beStatus,
          `Frontend status "${feStatus}" should map to backend status "${beStatus}"`
        );
      }
    });

    test('verifies all 7 statuses map correctly from backend to frontend', () => {
      for (const [feStatus, beStatus] of statusPairs) {
        assert.equal(
          backendStatusToFrontend(beStatus),
          feStatus,
          `Backend status "${beStatus}" should map to frontend status "${feStatus}"`
        );
      }
    });

    test('verifies case-insensitive backend status mapping', () => {
      assert.equal(backendStatusToFrontend('testing_qa'), 'Testing / QA');
      assert.equal(backendStatusToFrontend('blocked'), 'Blocked');
      assert.equal(backendStatusToFrontend('on_hold'), 'On Hold');
      assert.equal(backendStatusToFrontend('in_progress'), 'In Progress');
      assert.equal(backendStatusToFrontend('in_review'), 'In Review');
      assert.equal(backendStatusToFrontend('done'), 'Done');
      assert.equal(backendStatusToFrontend('backlog'), 'Backlog');
    });

    test('preserves unknown backend statuses rather than changing them to Backlog', () => {
      assert.equal(backendStatusToFrontend('UNKNOWN_STATUS'), 'UNKNOWN_STATUS');
      assert.equal(backendStatusToFrontend(null), '');
      assert.equal(backendStatusToFrontend(undefined), '');
    });

    test('preserves custom frontend statuses for explicit backend validation', () => {
      assert.equal(frontendStatusToBackend('Custom Status'), 'CUSTOM_STATUS');
      assert.throws(() => frontendStatusToBackend(''), /workflow status is required/i);
    });
  });

  // ==========================================
  // F-02: Organization Member Role Updates
  // ==========================================
  describe('F-02: Organization Role Mapping & Canonical Enums', () => {
    test('maps title-case and frontend roles to canonical uppercase backend enums', () => {
      assert.equal(toBackendRole('Admin'), 'ADMIN');
      assert.equal(toBackendRole('Manager'), 'MANAGER');
      assert.equal(toBackendRole('Teammate'), 'TEAMMATE');
    });

    test('normalizes backend role enums back to frontend Role types', () => {
      assert.equal(normalizeRole('ADMIN'), 'Admin');
      assert.equal(normalizeRole('MANAGER'), 'Manager');
      assert.equal(normalizeRole('LEAD'), 'Manager');
      assert.equal(normalizeRole('TEAMMATE'), 'Teammate');
      assert.equal(normalizeRole('MEMBER'), 'Teammate');
      assert.equal(normalizeRole(undefined), 'Teammate');
    });
  });

  // ==========================================
  // F-03: SLA Escalation HTTP Method
  // ==========================================
  describe('F-03: SLA Escalation PATCH Method', () => {
    test('escalateWorkItemApi uses HTTP PATCH method and correct payload', async () => {
      const originalFetch = globalThis.fetch;
      let interceptedMethod = '';
      let interceptedUrl = '';
      let interceptedBody: any = null;

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        interceptedUrl = String(url);
        interceptedMethod = init?.method || 'GET';
        interceptedBody = init?.body ? JSON.parse(String(init.body)) : null;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Work item escalated' }),
        } as Response;
      }) as typeof fetch;

      try {
        await escalateWorkItemApi('wi-12345', 'SLA deadline exceeded');
        assert.equal(interceptedMethod, 'PATCH', 'Escalation request MUST use PATCH HTTP method');
        assert.ok(interceptedUrl.includes('/api/work-items/wi-12345/escalate'), 'Url must target escalation path');
        assert.deepEqual(interceptedBody, { reason: 'SLA deadline exceeded' });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ==========================================
  // F-04: Secure Signup & Error Classification
  // ==========================================
  describe('F-04: Secure Signup and Error Handling', () => {
    test('classifies duplicate account (409) and validation errors clearly', () => {
      const err409 = { status: 409, message: 'A user with this email address already exists.' };
      assert.equal(
        classifyAuthError(err409),
        'A user with this email address already exists.'
      );

      const errValidation = {
        status: 400,
        message: 'Password must be at least 8 characters long',
      };
      assert.equal(
        classifyAuthError(errValidation),
        'Password must be at least 8 characters long'
      );
    });

    test('classifies 401 unauthorized errors without exposing internal traces', () => {
      const err401 = { status: 401, message: 'Unauthorized' };
      assert.equal(classifyAuthError(err401), 'Invalid email or password.');
    });
  });

  // ==========================================
  // F-05: Organization Admin Project Access
  // ==========================================
  describe('F-05: Organization Admin Project Access (canUserAccessProject)', () => {
    const privateProject: Project = {
      id: 'proj-private-1',
      name: 'Confidential Core Infra',
      projectKey: 'CCI',
      description: 'Private project',
      visibility: 'private',
      ownerId: 'user-owner',
      memberIds: ['user-owner', 'user-member-1'],
      createdAt: '2026-10-27T00:00:00Z',
      updatedAt: '2026-10-27T00:00:00Z',
    };

    const publicProject: Project = {
      id: 'proj-public-1',
      name: 'Open Workspace Docs',
      projectKey: 'OWD',
      description: 'Public project',
      visibility: 'public',
      ownerId: 'user-owner',
      memberIds: ['user-owner'],
      createdAt: '2026-10-27T00:00:00Z',
      updatedAt: '2026-10-27T00:00:00Z',
    };

    test('grants Organization Admin full access to private projects even if not in memberIds', () => {
      const adminCanAccessWithTitleCase = canUserAccessProject(
        privateProject,
        'user-admin-99',
        'Admin'
      );
      assert.equal(adminCanAccessWithTitleCase, true, 'Admin role must be granted access');

      const adminCanAccessWithUppercase = canUserAccessProject(
        privateProject,
        'user-admin-99',
        'ADMIN' as any
      );
      assert.equal(adminCanAccessWithUppercase, true, 'ADMIN role must be granted access');
    });

    test('grants project owner access to private project', () => {
      assert.equal(
        canUserAccessProject(privateProject, 'user-owner', 'Teammate'),
        true,
        'Project owner must have access'
      );
    });

    test('grants explicit project member access to private project', () => {
      assert.equal(
        canUserAccessProject(privateProject, 'user-member-1', 'Teammate'),
        true,
        'Project member must have access'
      );
    });

    test('denies non-member non-admin access to private project', () => {
      assert.equal(
        canUserAccessProject(privateProject, 'user-stranger', 'Teammate'),
        false,
        'Non-member Teammate must not access private project'
      );
      assert.equal(
        canUserAccessProject(privateProject, 'user-stranger', 'Manager'),
        false,
        'Non-member Manager must not access private project'
      );
    });

    test('allows all users access to public projects regardless of membership or role', () => {
      assert.equal(
        canUserAccessProject(publicProject, 'user-stranger', 'Teammate'),
        true,
        'Public project must be accessible to anyone'
      );
      assert.equal(
        canUserAccessProject(publicProject, 'user-stranger', undefined),
        true,
        'Public project must be accessible with missing role'
      );
    });

    test('safely rejects null or missing project or userId', () => {
      assert.equal(canUserAccessProject(null, 'user-1'), false);
      assert.equal(canUserAccessProject(privateProject, null), false);
      assert.equal(canUserAccessProject(undefined, undefined), false);
    });
  });

  // ==========================================
  // F-12: Credentials and No Fake Bearer Token
  // ==========================================
  describe('F-12: Request Credentials & No Fake Bearer Token', () => {
    test('never attaches Authorization header with active_session when token is absent', async () => {
      const originalFetch = globalThis.fetch;
      clearAuthToken();
      let attachedHeaders: Record<string, string> = {};
      let usedCredentials = '';

      globalThis.fetch = (async (_url: any, init?: RequestInit) => {
        attachedHeaders = (init?.headers || {}) as Record<string, string>;
        usedCredentials = String(init?.credentials);
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        } as Response;
      }) as typeof fetch;

      try {
        await escalateWorkItemApi('test-item');
        assert.equal(
          attachedHeaders['Authorization'],
          undefined,
          'Authorization header must NOT be attached when no real token is stored'
        );
        assert.notEqual(
          attachedHeaders['Authorization'],
          'Bearer active_session',
          'Must never send fake Bearer active_session'
        );
        assert.equal(
          usedCredentials,
          'include',
          'credentials must be set to "include"'
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('attaches valid Authorization header when real token is present', async () => {
      const originalFetch = globalThis.fetch;
      setAuthToken('real-jwt-token-xyz');
      let attachedHeaders: Record<string, string> = {};

      globalThis.fetch = (async (_url: any, init?: RequestInit) => {
        attachedHeaders = (init?.headers || {}) as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        } as Response;
      }) as typeof fetch;

      try {
        await escalateWorkItemApi('test-item');
        assert.equal(
          attachedHeaders['Authorization'],
          'Bearer real-jwt-token-xyz',
          'Valid token must be sent in Authorization header'
        );
      } finally {
        clearAuthToken();
        globalThis.fetch = originalFetch;
      }
    });
  });
});
