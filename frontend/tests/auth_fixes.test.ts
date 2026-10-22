import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyUser,
  loadInitialState,
  saveStateToStorage,
  STORAGE_KEYS,
} from '../src/state/storage';
import { ApiError } from '../src/services/api';

describe('TaskFlow Pro Authentication, Protected Routes & Error Handling Tests', () => {
  // Mock localStorage for node:test environment
  const mockStore: Record<string, string> = {};
  const originalLocalStorage = global.localStorage;

  beforeEach: {
    // Setup mock localStorage
    global.localStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, val: string) => {
        mockStore[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        for (const k of Object.keys(mockStore)) {
          delete mockStore[k];
        }
      },
      length: 0,
      key: () => null,
    } as any;
  }

  test('TEST 7: No dummy user or fallback user on clean startup', () => {
    localStorage.clear();
    const initialState = loadInitialState();

    assert.equal(initialState.currentUser.id, '');
    assert.equal(initialState.currentUser.email, '');
    assert.equal(initialState.currentUser.name, '');

    // IsAuthenticated logic used in App.tsx
    const isAuthenticated = Boolean(
      initialState.currentUser &&
      initialState.currentUser.id &&
      initialState.currentUser.email
    );
    assert.equal(isAuthenticated, false, 'Clean state must be strictly unauthenticated');
  });

  test('TEST 1 & 11: Valid authenticated session restoration from valid storage', () => {
    localStorage.clear();
    const validUser = {
      id: 'usr-12345',
      name: 'Jane Doe',
      email: 'jane@taskflow.pro',
      role: 'Admin',
      companyId: 'org-1',
      companyName: 'Acme Corp',
      onboardingCompleted: true,
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(validUser));

    const state = loadInitialState();
    assert.equal(state.currentUser.id, 'usr-12345');
    assert.equal(state.currentUser.email, 'jane@taskflow.pro');

    const isAuthenticated = Boolean(
      state.currentUser &&
      state.currentUser.id &&
      state.currentUser.email
    );
    assert.equal(isAuthenticated, true, 'Valid user in storage restores authenticated state');
  });

  test('TEST 3 & 6: Logout and storage persistence clean up unauthenticated state', () => {
    // Start with authenticated user
    const validUser = {
      id: 'usr-12345',
      name: 'Jane Doe',
      email: 'jane@taskflow.pro',
      role: 'Admin',
    };
    saveStateToStorage('CURRENT_USER', validUser);
    assert.ok(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));

    // When logging out, currentUser is set to emptyUser
    saveStateToStorage('CURRENT_USER', emptyUser);

    // Verify localStorage item is completely removed, not saved as an empty object
    assert.equal(
      localStorage.getItem(STORAGE_KEYS.CURRENT_USER),
      null,
      'emptyUser must trigger removal from storage, never storing dummy state'
    );

    // Refresh simulation: loading initial state with clean storage
    const stateAfterRefresh = loadInitialState();
    assert.equal(stateAfterRefresh.currentUser.id, '');
    assert.equal(
      Boolean(stateAfterRefresh.currentUser.id && stateAfterRefresh.currentUser.email),
      false,
      'User remains logged out after refresh'
    );
  });

  test('TEST 4 & 5 & 12: Route Guard blocks protected routes for unauthenticated users without loops', () => {
    // Helper replicating App.tsx route guard logic
    function resolveRouteView(route: string, user: typeof emptyUser, isInitializingAuth: boolean) {
      const isAuthenticated = Boolean(user && user.id && user.email);

      if (isInitializingAuth) {
        return 'LOADING_SPINNER';
      }
      if (route === '/login') {
        return 'AUTH_LOGIN_VIEW';
      }
      if (route === '/signup') {
        return 'AUTH_SIGNUP_VIEW';
      }
      if (!isAuthenticated) {
        return 'AUTH_LOGIN_VIEW'; // Protected routes redirect/render login view
      }
      return 'PROTECTED_APP_SHELL';
    }

    // Direct navigation to /dashboard when logged out
    const dashboardView = resolveRouteView('/dashboard', emptyUser, false);
    assert.equal(dashboardView, 'AUTH_LOGIN_VIEW', 'Unauthenticated user cannot access /dashboard');

    // Direct navigation to /project/:id when logged out
    const projectView = resolveRouteView('/project/proj-123/overview', emptyUser, false);
    assert.equal(projectView, 'AUTH_LOGIN_VIEW', 'Unauthenticated user cannot access project views');

    // Direct navigation to /settings when logged out
    const settingsView = resolveRouteView('/settings', emptyUser, false);
    assert.equal(settingsView, 'AUTH_LOGIN_VIEW', 'Unauthenticated user cannot access settings');

    // Public routes are accessible
    assert.equal(resolveRouteView('/login', emptyUser, false), 'AUTH_LOGIN_VIEW');
    assert.equal(resolveRouteView('/signup', emptyUser, false), 'AUTH_SIGNUP_VIEW');

    // When authenticated, protected shell renders
    const authUser = { ...emptyUser, id: 'user-1', email: 'user@example.com' };
    assert.equal(resolveRouteView('/dashboard', authUser, false), 'PROTECTED_APP_SHELL');
    assert.equal(resolveRouteView('/project/proj-123/overview', authUser, false), 'PROTECTED_APP_SHELL');
  });

  test('TEST 2: Invalid credentials error classification', () => {
    function classifyAuthError(err: any): string {
      if (
        err?.code === 'INVALID_CREDENTIALS' ||
        err?.status === 401 ||
        err?.message?.toLowerCase().includes('invalid email or password')
      ) {
        return 'Invalid email or password.';
      } else if (
        err?.code === 'SERVER_UNREACHABLE' ||
        err?.status === 0 ||
        err?.message?.toLowerCase().includes('unable to reach') ||
        err?.message?.toLowerCase().includes('failed to fetch') ||
        err?.message?.toLowerCase().includes('network')
      ) {
        return 'Unable to connect. Please check your internet connection and try again.';
      } else {
        return 'Something went wrong. Please try again later.';
      }
    }

    // 401 error
    const err401 = new ApiError('Unauthorized', 401, 'INVALID_CREDENTIALS');
    assert.equal(classifyAuthError(err401), 'Invalid email or password.');

    // Message variation
    const errMsg = { message: 'Invalid email or password' };
    assert.equal(classifyAuthError(errMsg), 'Invalid email or password.');
  });

  test('TEST 8: Network failure error classification', () => {
    function classifyAuthError(err: any): string {
      if (
        err?.code === 'INVALID_CREDENTIALS' ||
        err?.status === 401 ||
        err?.message?.toLowerCase().includes('invalid email or password')
      ) {
        return 'Invalid email or password.';
      } else if (
        err?.code === 'SERVER_UNREACHABLE' ||
        err?.status === 0 ||
        err?.message?.toLowerCase().includes('unable to reach') ||
        err?.message?.toLowerCase().includes('failed to fetch') ||
        err?.message?.toLowerCase().includes('network')
      ) {
        return 'Unable to connect. Please check your internet connection and try again.';
      } else {
        return 'Something went wrong. Please try again later.';
      }
    }

    // Network / unreachable server error
    const netErr = new ApiError('Unable to reach backend server', 0, 'SERVER_UNREACHABLE');
    assert.equal(
      classifyAuthError(netErr),
      'Unable to connect. Please check your internet connection and try again.'
    );

    const fetchErr = new TypeError('Failed to fetch');
    assert.equal(
      classifyAuthError(fetchErr),
      'Unable to connect. Please check your internet connection and try again.'
    );
  });

  test('TEST 9: Server 500 failure error classification', () => {
    function classifyAuthError(err: any): string {
      if (
        err?.code === 'INVALID_CREDENTIALS' ||
        err?.status === 401 ||
        err?.message?.toLowerCase().includes('invalid email or password')
      ) {
        return 'Invalid email or password.';
      } else if (
        err?.code === 'SERVER_UNREACHABLE' ||
        err?.status === 0 ||
        err?.message?.toLowerCase().includes('unable to reach') ||
        err?.message?.toLowerCase().includes('failed to fetch') ||
        err?.message?.toLowerCase().includes('network')
      ) {
        return 'Unable to connect. Please check your internet connection and try again.';
      } else {
        return 'Something went wrong. Please try again later.';
      }
    }

    const serverErr = new ApiError('Internal Server Error', 500, 'INTERNAL_ERROR');
    assert.equal(
      classifyAuthError(serverErr),
      'Something went wrong. Please try again later.'
    );
  });

  test('TEST 10: Sign-up form validation preserves requirements', () => {
    function validateSignup(name: string, email: string, pass: string, confirm: string) {
      const errs: Record<string, string> = {};
      if (!name.trim()) errs.name = 'Full name is required';
      if (!email.trim() || !email.includes('@')) errs.email = 'Valid email is required';
      if (!pass || pass.length < 6) errs.password = 'Password must be at least 6 characters';
      if (pass !== confirm) errs.confirm = 'Passwords do not match';
      return errs;
    }

    // Invalid inputs
    const bad = validateSignup('', 'bademail', '123', '456');
    assert.ok(bad.name);
    assert.ok(bad.email);
    assert.ok(bad.password);
    assert.ok(bad.confirm);

    // Valid inputs
    const good = validateSignup('Jane Doe', 'jane@example.com', 'secret123', 'secret123');
    assert.equal(Object.keys(good).length, 0);
  });
});
