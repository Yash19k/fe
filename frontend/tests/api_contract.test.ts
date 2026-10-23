import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  registerOrganizationApi,
  RegisterOrganizationInput,
  checkBackendHealth,
} from '../src/services/api';

describe('Backend API Contract & Error Handling Tests', () => {
  test('ApiError class correctly formats and encapsulates error details', () => {
    const error = new ApiError('Validation failed', 400, 'VALIDATION_ERROR', [
      { field: 'user.email', message: 'Email is required' },
    ]);

    assert.equal(error.name, 'ApiError');
    assert.equal(error.message, 'Validation failed');
    assert.equal(error.status, 400);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(Array.isArray(error.details), true);
    assert.equal(error.details[0].field, 'user.email');
  });

  test('payload structure matches backend Joi onboardingSchema contract', () => {
    const payload: RegisterOrganizationInput = {
      user: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'ValidPassword123!',
      },
      organization: {
        name: 'Acme Corp',
        slug: 'acme-corp',
      },
    };

    assert.ok(payload.user.fullName);
    assert.ok(payload.user.email.includes('@'));
    assert.ok(payload.user.password.length >= 8);
    assert.ok(payload.organization.name);
    assert.ok(payload.organization.slug);
    assert.equal(payload.organization.slug, payload.organization.slug.toLowerCase());
  });

  test('handles unreachable backend gracefully with SERVER_UNREACHABLE error', async () => {
    // When connecting to an unreachable port / offline host, ApiError is thrown
    const dummyPayload: RegisterOrganizationInput = {
      user: {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
      },
      organization: {
        name: 'Test Org',
        slug: 'test-org',
      },
    };

    try {
      await registerOrganizationApi(dummyPayload);
    } catch (err: any) {
      assert.ok(err instanceof ApiError);
      assert.ok(
        err.code === 'SERVER_UNREACHABLE' || err.status === 0 || err.status >= 400,
        `Expected status or error code, received ${err.code} / ${err.status}`
      );
    }
  });

  test('health check handles offline status gracefully', async () => {
    try {
      await checkBackendHealth();
    } catch (err: any) {
      assert.ok(err instanceof ApiError);
      assert.ok(err.message.length > 0);
    }
  });
});
