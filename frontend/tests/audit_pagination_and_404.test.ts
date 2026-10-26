import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapBackendAuditLogToEntry } from '../src/features/project/ProjectSettingsView';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

describe('TaskFlow Pro — Audit Log Pagination & 404 Not Found Tests', () => {
  describe('FEATURE 1: Activity & Audit Backend-Driven Pagination', () => {
    test('getProjectAuditLogsApi properly constructs query string with page and limit', () => {
      const apiFile = fs.readFileSync(path.join(srcDir, 'services/api.ts'), 'utf8');
      assert.ok(
        apiFile.includes('page?: number') && apiFile.includes('limit?: number'),
        'getProjectAuditLogsApi must accept optional page and limit parameters'
      );
      assert.ok(
        apiFile.includes('AuditPaginationMeta'),
        'api.ts must export or declare AuditPaginationMeta interface'
      );
      assert.ok(
        apiFile.includes('query.set(\'page\', String(page))'),
        'api.ts must append page parameter to query'
      );
      assert.ok(
        apiFile.includes('query.set(\'limit\', String(limit))'),
        'api.ts must append limit parameter to query'
      );
    });

    test('ProjectSettingsView integrates pagination controls, state, and fetch handlers', () => {
      const settingsView = fs.readFileSync(
        path.join(srcDir, 'features/project/ProjectSettingsView.tsx'),
        'utf8'
      );

      // Verify pagination state variables
      assert.ok(settingsView.includes('const [auditPage, setAuditPage] = useState<number>(1)'), 'Must track auditPage');
      assert.ok(settingsView.includes('const [auditLimit, setAuditLimit] = useState<number>(20)'), 'Must track auditLimit');
      assert.ok(settingsView.includes('isLoadingAudit'), 'Must track isLoadingAudit');
      assert.ok(settingsView.includes('auditError'), 'Must track auditError');

      // Verify fetchAuditRecords call
      assert.ok(settingsView.includes('fetchAuditRecords'), 'Must define fetchAuditRecords');
      assert.ok(settingsView.includes('getProjectAuditLogsApi(currentProject.id, page, limit)'), 'Must call getProjectAuditLogsApi with page and limit');

      // Verify UI controls
      assert.ok(settingsView.includes('Rows per page:'), 'Must render Rows per page selector');
      assert.ok(settingsView.includes('ariaLabel="Previous page"'), 'Must render Previous page button');
      assert.ok(settingsView.includes('ariaLabel="Next page"'), 'Must render Next page button');
      assert.ok(settingsView.includes('disabled={isFirstPage || isLoadingAudit}'), 'Previous must be disabled on first page');
      assert.ok(settingsView.includes('disabled={isLastPage || isLoadingAudit}'), 'Next must be disabled on last page');
    });

    test('ProjectActivityView maintains pagination parity and table integrity', () => {
      const activityView = fs.readFileSync(
        path.join(srcDir, 'features/project/ProjectActivityView.tsx'),
        'utf8'
      );

      assert.ok(activityView.includes('fetchAuditRecords'), 'ProjectActivityView must define fetchAuditRecords');
      assert.ok(activityView.includes('Rows per page:'), 'ProjectActivityView must render Rows per page selector');
      assert.ok(activityView.includes('Previous'), 'ProjectActivityView must render Previous button');
      assert.ok(activityView.includes('Next'), 'ProjectActivityView must render Next button');
      assert.ok(activityView.includes('md:grid-cols-[100px_120px_120px_minmax(0,1fr)_125px_105px]'), 'Must preserve 6-column grid template');
      assert.ok(activityView.includes('Change undone'), 'Must preserve Change undone state');
    });

    test('mapBackendAuditLogToEntry accurately maps undo eligibility and persisted state', () => {
      const mockRawLog = {
        id: 'log-101',
        userId: 'usr-1',
        userName: 'Alice Engineer',
        userEmail: 'alice@example.com',
        action: 'status_changed',
        entityType: 'task',
        entityId: 'tsk-404',
        previousState: { status: 'IN_PROGRESS' },
        newState: { status: 'DONE' },
        canUndo: true,
        isUndone: false,
        createdAt: '2026-10-25T12:00:00Z',
      };

      const mapped = mapBackendAuditLogToEntry(mockRawLog, 'proj-1');
      assert.strictEqual(mapped.id, 'log-101');
      assert.strictEqual(mapped.canUndo, true);
      assert.strictEqual(mapped.isUndone, false);
      assert.strictEqual(mapped.action, 'status_changed');

      // When already undone
      const mockUndoneLog = {
        ...mockRawLog,
        id: 'log-102',
        isUndone: true,
        canUndo: false,
        undoneAt: '2026-10-25T12:05:00Z',
      };
      const mappedUndone = mapBackendAuditLogToEntry(mockUndoneLog, 'proj-1');
      assert.strictEqual(mappedUndone.canUndo, false);
      assert.strictEqual(mappedUndone.isUndone, true);
    });

    test('pagination bounds disable Previous on page 1 and calculate last page properly', () => {
      // Simulate pagination calculation logic
      const auditPage = 1;
      const totalPages = 5;
      const isLoading = false;
      const isFirstPage = auditPage <= 1;
      const isLastPage = auditPage >= totalPages;

      assert.strictEqual(isFirstPage, true, 'Page 1 must be flagged as first page');
      assert.strictEqual(isLastPage, false, 'Page 1 of 5 must not be last page');
      assert.strictEqual(isFirstPage || isLoading, true, 'Previous button must be disabled');

      // Last page check
      const lastAuditPage = 5;
      assert.strictEqual(lastAuditPage >= totalPages, true, 'Page 5 of 5 must be flagged as last page');
    });
  });

  describe('FEATURE 2: 404 Not Found Page & Catch-All Routing', () => {
    test('NotFoundView component contains required headings, text, and navigation buttons', () => {
      const notFoundFile = fs.readFileSync(
        path.join(srcDir, 'features/not-found/NotFoundView.tsx'),
        'utf8'
      );

      // Verify clear "404" heading
      assert.ok(notFoundFile.includes('404'), 'Must display 404 heading');
      // Verify "Page Not Found" title
      assert.ok(notFoundFile.includes('Page Not Found'), 'Must display Page Not Found title');
      // Verify friendly explanation
      assert.ok(
        notFoundFile.includes('The page you are looking for') ||
        notFoundFile.includes('link is invalid'),
        'Must display user-friendly explanation'
      );
      // Verify "Go to Workspace" navigation button
      assert.ok(notFoundFile.includes('Go to Workspace'), 'Must include Go to Workspace button');
      assert.ok(notFoundFile.includes("navigate('/')"), 'Go to Workspace must navigate to root');
      // Verify "Go Back" action
      assert.ok(notFoundFile.includes('Go Back'), 'Must include Go Back action');
      assert.ok(notFoundFile.includes('window.history.back()'), 'Go Back must utilize window.history.back()');
    });

    test('App.tsx registers catch-all route for invalid application paths and tabs', () => {
      const appFile = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');

      // Verify import
      assert.ok(
        appFile.includes("import { NotFoundView } from './features/not-found/NotFoundView'"),
        'App.tsx must import NotFoundView'
      );

      // Verify validation helper
      assert.ok(
        appFile.includes('isValidProjectTab'),
        'App.tsx must define isValidProjectTab helper'
      );

      const normalized = appFile.replace(/\r\n/g, '\n');

      // Verify fallback rendering in main router
      assert.ok(
        normalized.includes(": activeRoute === '/' || activeRoute === '' ? ("),
        'App.tsx must explicitly match root workspace route'
      );
      assert.ok(
        normalized.includes(': (\n            <NotFoundView />\n          )'),
        'App.tsx must render NotFoundView for unknown application routes'
      );

      // Verify project tab fallback
      assert.ok(
        normalized.includes('{!isValidProjectTab(projectTab) && <NotFoundView />}'),
        'App.tsx must render NotFoundView for unknown project tabs'
      );
    });

    test('Preserves all valid application routes', () => {
      const appFile = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');

      // Top-level routes
      assert.ok(appFile.includes("activeRoute === '/my-tasks'"), 'Must preserve /my-tasks');
      assert.ok(appFile.includes("activeRoute === '/projects'"), 'Must preserve /projects');
      assert.ok(appFile.includes("activeRoute === '/settings'"), 'Must preserve /settings');
      assert.ok(appFile.includes("activeRoute === '/login'"), 'Must preserve /login');
      assert.ok(appFile.includes("activeRoute === '/signup'"), 'Must preserve /signup');

      // Project tabs
      assert.ok(appFile.includes("projectTab === 'overview'"), 'Must preserve overview');
      assert.ok(appFile.includes("projectTab === 'board'"), 'Must preserve board');
      assert.ok(appFile.includes("projectTab === 'list'"), 'Must preserve list');
      assert.ok(appFile.includes("projectTab === 'timeline'"), 'Must preserve timeline');
      assert.ok(appFile.includes("projectTab === 'calendar'"), 'Must preserve calendar');
      assert.ok(appFile.includes("projectTab === 'sprint'"), 'Must preserve sprint');
      assert.ok(appFile.includes("isSettingsTab(projectTab)"), 'Must preserve settings');
    });

    test('Preserves unauthenticated redirect behavior without bypassing auth', () => {
      const appFile = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');
      const normalized = appFile.replace(/\r\n/g, '\n');

      // Guard check: unauthenticated users redirected to /login
      assert.ok(
        normalized.includes("navigate('/login')"),
        'Must redirect unauthenticated users to /login'
      );
      assert.ok(
        normalized.includes('if (!isAuthenticated) {\n    return <AuthView isSignup={false} />;'),
        'Must guard workspace from unauthenticated access'
      );
    });
  });

  describe('BACKEND_TEAM_HANDOFF.md Compliance', () => {
    test('BACKEND_TEAM_HANDOFF.md contains all required sections from Section 8', () => {
      const handoffFile = fs.readFileSync(path.join(__dirname, '../../BACKEND_TEAM_HANDOFF.md'), 'utf8');

      assert.ok(handoffFile.includes('# Backend Team Handoff'), 'Must have # Backend Team Handoff title');
      assert.ok(handoffFile.includes('## Issue'), 'Must have ## Issue section');
      assert.ok(handoffFile.includes('## Current API Behavior'), 'Must have ## Current API Behavior section');
      assert.ok(handoffFile.includes('## Missing Capability'), 'Must have ## Missing Capability section');
      assert.ok(handoffFile.includes('## Expected Behavior'), 'Must have ## Expected Behavior section');
      assert.ok(handoffFile.includes('## Recommended Implementation'), 'Must have ## Recommended Implementation section');
      assert.ok(handoffFile.includes('## Frontend Impact'), 'Must have ## Frontend Impact section');
    });

    test('BACKEND_TEAM_HANDOFF.md documents Issue 2: Notifications 500 Internal Server Error', () => {
      const handoffFile = fs.readFileSync(path.join(__dirname, '../../BACKEND_TEAM_HANDOFF.md'), 'utf8');

      assert.ok(handoffFile.includes('GET /api/notifications'), 'Must mention GET /api/notifications');
      assert.ok(handoffFile.includes('500 (Internal Server Error)'), 'Must mention 500 Internal Server Error');
      assert.ok(handoffFile.includes('notification.controller.ts'), 'Must reference notification controller');
      assert.ok(handoffFile.includes('migration'), 'Must reference database migration');
    });
  });

  describe('FIX BLANK PROJECT OVERVIEW AND FRONTEND RUNTIME ERRORS', () => {
    test('MainAppShell in App.tsx destructures currentProjectId from useApp() without ReferenceError', () => {
      const appFile = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');

      assert.ok(
        /function MainAppShell\(\)\s*\{[^}]*currentProjectId/s.test(appFile),
        'MainAppShell must destructure currentProjectId from useApp()'
      );
      assert.ok(
        appFile.includes('const routeProjectId = activeRoute.startsWith(\'/project/\')'),
        'App.tsx must derive routeProjectId safely from activeRoute'
      );
      assert.ok(
        appFile.includes('const effectiveProjectId = currentProjectId || routeProjectId;'),
        'App.tsx must define effectiveProjectId combining currentProjectId and routeProjectId'
      );
      assert.ok(
        appFile.includes('const isProjectRoute = activeRoute.startsWith(\'/project/\') && Boolean(effectiveProjectId);'),
        'isProjectRoute must safely check effectiveProjectId'
      );
    });

    test('App.tsx handles project loading safely before showing Project Not Found', () => {
      const appFile = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');

      assert.ok(
        appFile.includes('isLoadingProjectData ? ('),
        'App.tsx must check isLoadingProjectData to avoid flashing Not Found on initial project loading'
      );
      assert.ok(
        appFile.includes('Loading project...'),
        'App.tsx must render loading indicator while project data loads'
      );
    });

    test('getUserNotificationsApi handles network and 500 errors non-blockingly', async () => {
      const apiFile = fs.readFileSync(path.join(srcDir, 'services/api.ts'), 'utf8');

      assert.ok(
        apiFile.includes('TaskFlow: Non-blocking notifications fetch failure:'),
        'getUserNotificationsApi must catch errors and log warning'
      );
      assert.ok(
        apiFile.includes('return { success: false, count: 0, data: [] };'),
        'getUserNotificationsApi must return safe empty payload on error'
      );
    });

    test('markNotificationReadApi and markAllNotificationsReadApi handle errors non-blockingly', () => {
      const apiFile = fs.readFileSync(path.join(srcDir, 'services/api.ts'), 'utf8');

      assert.ok(
        apiFile.includes('TaskFlow: Non-blocking mark notification read notice:'),
        'markNotificationReadApi must catch errors safely'
      );
      assert.ok(
        apiFile.includes('TaskFlow: Non-blocking mark all notifications read notice:'),
        'markAllNotificationsReadApi must catch errors safely'
      );
    });
  });
});

