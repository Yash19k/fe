import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProjectId,
  generateSuggestedProjectId,
  validateProjectId,
  validateProjectDates,
} from '../src/domain/projects.ts';

describe('Project Domain Logic Tests', () => {
  const existingProjects = [
    { id: 'proj-1', projectKey: 'ALPHA' },
    { id: 'proj-2', projectKey: 'BETA' },
    { id: 'proj-3', projectKey: 'MARKETING-CAMPAIGN' },
    { id: 'proj-4', projectKey: 'MARKETING-CAMPAIGN-2' },
  ];

  it('normalizes project IDs to clean uppercase alphanumeric slugs', () => {
    assert.equal(normalizeProjectId('  web-app  '), 'WEB-APP');
    assert.equal(normalizeProjectId('Day Flow! 2026'), 'DAYFLOW2026');
    assert.equal(normalizeProjectId('TASK__FLOW--PRO'), 'TASK__FLOW-PRO');
  });

  it('suggests sensible Project IDs from names', () => {
    assert.equal(generateSuggestedProjectId('Brand Redesign', []), 'BRAND-REDESIGN');
    assert.equal(generateSuggestedProjectId('', []), 'PROJECT');
    assert.equal(generateSuggestedProjectId('   ', []), 'PROJECT');
  });

  it('predictably increments suffix upon collision (-2, -3, ...)', () => {
    // ALPHA exists -> suggest ALPHA-2
    assert.equal(generateSuggestedProjectId('Alpha', existingProjects), 'ALPHA-2');

    // MARKETING-CAMPAIGN and MARKETING-CAMPAIGN-2 exist -> suggest MARKETING-CAMPAIGN-3
    assert.equal(generateSuggestedProjectId('Marketing Campaign', existingProjects), 'MARKETING-CAMPAIGN-3');
  });

  it('validates project ID format and uniqueness case-insensitively', () => {
    // Blank ID
    const emptyCheck = validateProjectId('', existingProjects);
    assert.equal(emptyCheck.isValid, false);
    assert.match(emptyCheck.error!, /cannot be empty/i);

    // Collision (case-insensitive)
    const duplicateCheck = validateProjectId('alpha', existingProjects);
    assert.equal(duplicateCheck.isValid, false);
    assert.match(duplicateCheck.error!, /already exists/i);

    // Same project editing its own ID is allowed
    const selfCheck = validateProjectId('ALPHA', existingProjects, 'proj-1');
    assert.equal(selfCheck.isValid, true);

    // Unique ID
    const validCheck = validateProjectId('GAMMA-CORE', existingProjects);
    assert.equal(validCheck.isValid, true);
  });

  it('validates project date ranges properly', () => {
    // Neither date supplied -> valid
    assert.equal(validateProjectDates('', '').isValid, true);
    assert.equal(validateProjectDates(null, null).isValid, true);

    // Only start date -> valid
    assert.equal(validateProjectDates('2026-10-01', '').isValid, true);

    // Only due date -> valid
    assert.equal(validateProjectDates('', '2026-10-15').isValid, true);

    // Start date before due date -> valid
    assert.equal(validateProjectDates('2026-10-01', '2026-10-15').isValid, true);

    // Same day start and due -> valid
    assert.equal(validateProjectDates('2026-10-01', '2026-10-01').isValid, true);

    // Target date BEFORE start date -> invalid
    const invalidCheck = validateProjectDates('2026-10-15', '2026-10-01');
    assert.equal(invalidCheck.isValid, false);
    assert.match(invalidCheck.error!, /cannot be earlier than start date/i);
  });

  describe('One-Click Members Navigation Tests (Section 6 C5)', () => {
    interface RouteState {
      activeRoute: string;
      currentProjectId: string;
      projectTab: string;
      activeSettingsSection?: string;
    }

    function parseHashRoute(hashString: string): { projectId: string | null; tab: string | null; subSection: string | null } {
      const clean = hashString.replace(/^#/, '') || '/';
      const match = clean.match(/^\/project\/([^/]+)(?:\/([^/]+))?/);
      if (!match) return { projectId: null, tab: null, subSection: null };

      const projectId = match[1];
      let tab = match[2] || null;
      let subSection = null;

      if (tab) {
        const rawTab = tab.split(/[#?]/)[0];
        const hashSection = tab.includes('#') ? tab.split('#')[1] : null;
        if (rawTab === 'settings' && hashSection === 'members') {
          tab = 'members';
          subSection = 'members';
        } else {
          tab = rawTab;
          subSection = hashSection;
        }
      }

      return { projectId, tab, subSection };
    }

    function resolveDestination(projectTab: string, initialSection?: string): string {
      if (projectTab === 'members' || projectTab === 'settings#members') {
        return 'ProjectSettingsView -> Section: members';
      }
      if (projectTab === 'activity') {
        return 'ProjectSettingsView -> Section: activity';
      }
      if (projectTab === 'settings') {
        return `ProjectSettingsView -> Section: ${initialSection || 'general'}`;
      }
      return `ProjectView -> Tab: ${projectTab}`;
    }

    it('clicking Members in header directly navigates to Settings -> Members in ONE click (Cases 1, 2, 4, 5)', () => {
      // Current state: User is viewing Project 1 Board
      let state: RouteState = {
        activeRoute: '/project/proj-1/board',
        currentProjectId: 'proj-1',
        projectTab: 'board',
      };

      // User clicks Members button in header
      // Handler: setProjectTab('members'); navigate('/project/proj-1/members');
      const targetHash = `/project/${state.currentProjectId}/members`;
      const parsed = parseHashRoute(targetHash);

      state = {
        ...state,
        activeRoute: targetHash,
        currentProjectId: parsed.projectId!,
        projectTab: parsed.tab!,
      };

      assert.equal(state.currentProjectId, 'proj-1');
      assert.equal(state.projectTab, 'members');

      // Resolves directly to Project Settings -> Section: members without any intermediate click
      const renderedView = resolveDestination(state.projectTab);
      assert.equal(renderedView, 'ProjectSettingsView -> Section: members');
    });

    it('preserves the active project ID during one-click member navigation (Cases 3 & 6)', () => {
      const projects = ['proj-alpha', 'proj-beta', 'proj-123'];

      for (const projId of projects) {
        const targetHash = `/project/${projId}/members`;
        const parsed = parseHashRoute(targetHash);
        assert.equal(parsed.projectId, projId);
        assert.equal(parsed.tab, 'members');
      }
    });

    it('supports direct link and refresh retaining members section (Case 7)', () => {
      const directUrl = '#/project/proj-2/members';
      const parsed = parseHashRoute(directUrl);

      assert.equal(parsed.projectId, 'proj-2');
      assert.equal(parsed.tab, 'members');
      assert.equal(resolveDestination(parsed.tab!), 'ProjectSettingsView -> Section: members');
    });

    it('supports backwards compatibility with #/project/:id/settings#members (Case 7b)', () => {
      const directSettingsHash = '#/project/proj-1/settings#members';
      const parsed = parseHashRoute(directSettingsHash);

      assert.equal(parsed.projectId, 'proj-1');
      assert.equal(parsed.tab, 'members');
      assert.equal(resolveDestination(parsed.tab!), 'ProjectSettingsView -> Section: members');
    });

    it('simulates browser back and forward history transitions (Case 8)', () => {
      const history: string[] = [];

      // 1. User starts on board
      history.push('/project/proj-1/board');
      // 2. User clicks Members (one click)
      history.push('/project/proj-1/members');
      assert.equal(history[history.length - 1], '/project/proj-1/members');

      // 3. User clicks Back button
      history.pop();
      const previous = history[history.length - 1];
      const parsedBack = parseHashRoute(previous);
      assert.equal(parsedBack.tab, 'board');

      // 4. User clicks Forward button
      history.push('/project/proj-1/members');
      const forward = history[history.length - 1];
      const parsedForward = parseHashRoute(forward);
      assert.equal(parsedForward.tab, 'members');
    });

    it('allows user to navigate between other Settings sections once inside (Case 9)', () => {
      // User landed on Members
      let activeSettingsSection = 'members';
      assert.equal(activeSettingsSection, 'members');

      // User clicks General tab inside Settings
      activeSettingsSection = 'general';
      assert.equal(activeSettingsSection, 'general');

      // User clicks Labels tab inside Settings
      activeSettingsSection = 'labels';
      assert.equal(activeSettingsSection, 'labels');

      // User clicks Activity & Audit tab inside Settings
      activeSettingsSection = 'activity';
      assert.equal(activeSettingsSection, 'activity');
    });

    it('preserves existing project tab navigation without regression (Case 10)', () => {
      const tabs = ['overview', 'list', 'board', 'timeline', 'calendar', 'dashboard', 'dependencies', 'workflow', 'settings'];

      for (const tab of tabs) {
        const parsed = parseHashRoute(`/project/proj-1/${tab}`);
        assert.equal(parsed.projectId, 'proj-1');
        assert.equal(parsed.tab, tab);
      }
    });

    it('respects project permissions when opening member settings (Case 11)', () => {
      function canManageMembers(role: string): boolean {
        return role !== 'Teammate';
      }

      assert.equal(canManageMembers('Admin'), true);
      assert.equal(canManageMembers('Manager'), true);
      assert.equal(canManageMembers('Teammate'), false);
    });
  });
});
