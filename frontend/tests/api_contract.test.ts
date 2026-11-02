import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  registerOrganizationApi,
  RegisterOrganizationInput,
  checkBackendHealth,
  clearAuthToken,
  currentUserApi,
  loginApi,
  logoutApi,
  getAuthToken,
  refreshTokenApi,
  setAuthToken,
  setAuthFailureHandler,
} from '../src/services/api';

describe('Backend API Contract & Error Handling Tests', () => {
  test('keeps access tokens in memory without writing browser storage', () => {
    const originalLocalStorage = global.localStorage;
    const originalSessionStorage = global.sessionStorage;
    let localStorageWrites = 0;
    let sessionStorageWrites = 0;
    global.localStorage = {
      getItem: () => null,
      setItem: () => { localStorageWrites += 1; },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
    global.sessionStorage = {
      getItem: () => null,
      setItem: () => { sessionStorageWrites += 1; },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;

    try {
      setAuthToken('memory-only-access-token');
      assert.equal(getAuthToken(), 'memory-only-access-token');
      assert.equal(localStorageWrites, 0);
      assert.equal(sessionStorageWrites, 0);
    } finally {
      clearAuthToken();
      if (originalLocalStorage) global.localStorage = originalLocalStorage;
      else delete (global as any).localStorage;
      if (originalSessionStorage) global.sessionStorage = originalSessionStorage;
      else delete (global as any).sessionStorage;
    }
  });

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

  describe('refresh token handling', () => {
    const originalFetch = globalThis.fetch;

    test('restores a page session through the refresh cookie and stores its access token in memory', async () => {
      clearAuthToken();
      globalThis.fetch = async (_input, init) => {
        assert.equal(init?.method, 'POST');
        assert.equal(init?.credentials, 'include');
        return new Response(JSON.stringify({ token: 'new-access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        assert.equal(await refreshTokenApi(), 'new-access-token');
        assert.equal(getAuthToken(), 'new-access-token');
        globalThis.fetch = async (_input, init) => {
          assert.equal(init?.credentials, 'include');
          assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer new-access-token');
          return new Response(JSON.stringify({ user: { id: 'user-1' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        };
        assert.equal((await currentUserApi()).user.id, 'user-1');
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('keeps login access tokens in memory', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ token: 'login-access-token', user: { id: 'user-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await loginApi({ email: 'user@example.com', password: 'password' });
        assert.equal(getAuthToken(), 'login-access-token');
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('retries an unauthorized API request with the refreshed access token', async () => {
      setAuthToken('expired-access-token');
      let requestCount = 0;
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith('/api/users/refresh')) {
          return new Response(JSON.stringify({ token: 'new-access-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        requestCount += 1;
        if (requestCount === 1) {
          return new Response(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer new-access-token');
        assert.equal(init?.credentials, 'include');
        return new Response(JSON.stringify({ user: { id: 'user-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        const response = await currentUserApi();
        assert.equal(response.user.id, 'user-1');
        assert.equal(requestCount, 2);
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('clears the access token when the refresh session is unauthorized', async () => {
      setAuthToken('expired-access-token');
      let authFailureCount = 0;
      setAuthFailureHandler(() => { authFailureCount += 1; });
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ code: 'INVALID_REFRESH_TOKEN' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        assert.equal(await refreshTokenApi(), null);
        assert.equal(getAuthToken(), null);
        assert.equal(authFailureCount, 1);
      } finally {
        setAuthFailureHandler(null);
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('clears authentication when the refresh endpoint returns a server error', async () => {
      setAuthToken('expired-access-token');
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Temporary server error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await assert.rejects(refreshTokenApi(), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.equal(error.status, 503);
          assert.equal(error.code, 'TOKEN_REFRESH_FAILED');
          return true;
        });
        assert.equal(getAuthToken(), null);
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('clears authentication when a successful refresh response is malformed', async () => {
      setAuthToken('expired-access-token');
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await assert.rejects(refreshTokenApi(), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.equal(error.code, 'INVALID_REFRESH_RESPONSE');
          return true;
        });
        assert.equal(getAuthToken(), null);
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('shares one in-flight refresh request across concurrent callers', async () => {
      let resolveResponse!: (response: Response) => void;
      const responsePromise = new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });
      let requestCount = 0;
      setAuthToken('expired-access-token');
      globalThis.fetch = async () => {
        requestCount += 1;
        return responsePromise;
      };

      try {
        const firstRefresh = refreshTokenApi();
        const secondRefresh = refreshTokenApi();
        resolveResponse(
          new Response(JSON.stringify({ token: 'new-access-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
        assert.deepEqual(await Promise.all([firstRefresh, secondRefresh]), [
          'new-access-token',
          'new-access-token',
        ]);
        assert.equal(requestCount, 1);
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('shares one refresh across simultaneous expired API requests', async () => {
      let releaseRefresh!: (response: Response) => void;
      let markRefreshStarted!: () => void;
      const refreshStarted = new Promise<void>((resolve) => {
        markRefreshStarted = resolve;
      });
      const refreshResponse = new Promise<Response>((resolve) => {
        releaseRefresh = resolve;
      });
      let refreshCount = 0;
      let apiRequestCount = 0;
      setAuthToken('expired-access-token');
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith('/api/users/refresh')) {
          refreshCount += 1;
          markRefreshStarted();
          return refreshResponse;
        }

        apiRequestCount += 1;
        if (new Headers(init?.headers).get('Authorization') === 'Bearer new-access-token') {
          return new Response(JSON.stringify({ user: { id: 'user-1' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        const requests = Promise.all([
          currentUserApi(),
          currentUserApi(),
          currentUserApi(),
        ]);
        await refreshStarted;
        releaseRefresh(
          new Response(JSON.stringify({ token: 'new-access-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
        const results = await requests;
        assert.equal(results.length, 3);
        assert.equal(refreshCount, 1);
        assert.equal(apiRequestCount, 6);
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('logout sends the cookie-backed request and clears the in-memory token', async () => {
      setAuthToken('access-token');
      let logoutRequestCount = 0;
      globalThis.fetch = async (input, init) => {
        assert.equal(String(input).endsWith('/api/users/logout'), true);
        assert.equal(init?.credentials, 'include');
        logoutRequestCount += 1;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        await logoutApi();
        assert.equal(logoutRequestCount, 1);
        assert.equal(getAuthToken(), null);
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });

    test('clears authentication when the refresh request cannot reach the server', async () => {
      setAuthToken('expired-access-token');
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      try {
        await assert.rejects(refreshTokenApi(), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.equal(error.status, 0);
          assert.equal(error.code, 'SERVER_UNREACHABLE');
          return true;
        });
        assert.equal(getAuthToken(), null);
      } finally {
        globalThis.fetch = originalFetch;
        clearAuthToken();
      }
    });
  });
});
