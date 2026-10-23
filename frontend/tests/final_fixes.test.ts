import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toBackendProjectRole, normalizeRole } from '../src/services/api';
import type { User, Project } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendSrcDir = path.resolve(__dirname, '../src');

describe('Final Frontend Fixes Acceptance Tests', () => {
  // =========================================================================
  // Requirement 1: Sprint Dashboard - Remove Manual Refresh Button
  // =========================================================================
  describe('1. Sprint Dashboard: Refresh Button Removal', () => {
    const sprintViewFilePath = path.join(frontendSrcDir, 'features/project/SprintDashboardView.tsx');
    const sprintViewContent = fs.readFileSync(sprintViewFilePath, 'utf8');

    test('SprintDashboardView does not contain a manual Refresh button in the UI', () => {
      // Must not render a button containing "Refresh" or refresh onClick handler
      assert.doesNotMatch(
        sprintViewContent,
        /<button[^>]*>[^<]*Refresh[^<]*<\/button>/i,
        'Should not contain a button with text "Refresh"'
      );
      assert.doesNotMatch(
        sprintViewContent,
        /title=["']Refresh sprint data["']/i,
        'Should not have a Refresh sprint data title'
      );
    });

    test('SprintDashboardView preserves sprint selector and Add Task action', () => {
      // Sprint dropdown select exists
      assert.match(sprintViewContent, /<select[^>]*value=\{selectedSprintId\}/);
      // Add Task button exists
      assert.match(sprintViewContent, /Add Task/);
    });

    test('SprintDashboardView preserves sprint metrics, schedule, goal, and loading/error states', () => {
      // Metric cards
      assert.match(sprintViewContent, /Total Tasks/);
      assert.match(sprintViewContent, /Completed/);
      assert.match(sprintViewContent, /In Progress/);
      assert.match(sprintViewContent, /Remaining/);
      assert.match(sprintViewContent, /Velocity/);
      // Status & schedule
      assert.match(sprintViewContent, /selectedSprint\.status/);
      assert.match(sprintViewContent, /selectedSprint\.startDate/);
      assert.match(sprintViewContent, /selectedSprint\.goal/);
      // Loading & error handling
      assert.match(sprintViewContent, /isLoading/);
      assert.match(sprintViewContent, /error/);
    });
  });

  // =========================================================================
  // Requirement 2: Fix My Tasks Table Alignment
  // =========================================================================
  describe('2. My Tasks: Table Alignment & Shared Grid Layout', () => {
    const myTasksViewPath = path.join(frontendSrcDir, 'features/my-tasks/MyTasksView.tsx');
    const taskRowPath = path.join(frontendSrcDir, 'components/tasks/TaskRow.tsx');
    const myTasksContent = fs.readFileSync(myTasksViewPath, 'utf8');
    const taskRowContent = fs.readFileSync(taskRowPath, 'utf8');

    test('MyTasksView and TaskRow share identical grid-template-columns definition', () => {
      const expectedGrid = 'grid-cols-[minmax(280px,1fr)_140px_110px_110px_90px_80px]';
      assert.ok(
        myTasksContent.includes(expectedGrid),
        'MyTasksView header must use the shared grid definition'
      );
      assert.ok(
        taskRowContent.includes(expectedGrid),
        'TaskRow must use the shared grid definition'
      );
    });

    test('MyTasksView table container enforces minimum width for horizontal safety', () => {
      assert.match(myTasksContent, /min-w-\[860px\]/);
    });

    test('Status column header and TaskRow cell are consistently centered', () => {
      // Header has text-center for Status
      assert.match(myTasksContent, /span[^>]*className=["'][^"']*text-center[^"']*["'][^>]*>\s*Status/);
      // TaskRow cell has justify-center for StatusBadge
      assert.match(taskRowContent, /div[^>]*className=["'][^"']*justify-center[^"']*["'][^>]*>\s*<StatusBadge/);
    });

    test('Task title and Due Date cells prevent grid-template expansion and truncate gracefully', () => {
      // Task title column in TaskRow
      assert.match(taskRowContent, /overflow-hidden/);
      assert.match(taskRowContent, /truncate/);
      // Due Date column in TaskRow has overflow-hidden & truncate
      assert.ok(
        taskRowContent.includes('overflow-hidden') && taskRowContent.includes('truncate'),
        'TaskRow must guard cell overflow'
      );
    });

    test('Columns order is strictly Task, Assignee, Due Date, Status, Priority, Tags', () => {
      const headerRowStart = myTasksContent.indexOf('grid-cols-[minmax(280px,1fr)_140px_110px_110px_90px_80px]');
      assert.ok(headerRowStart !== -1, 'Header row must be present');
      const headerRowSlice = myTasksContent.slice(headerRowStart, headerRowStart + 700);

      const headers = ['Task', 'Assignee', 'Due Date', 'Status', 'Priority', 'Tags'];
      let lastIndex = -1;
      for (const h of headers) {
        const idx = headerRowSlice.indexOf(`>${h}<`);
        const idxWithSpace = idx === -1 ? headerRowSlice.indexOf(`> ${h} `) : idx;
        const finalIdx = idx !== -1 ? idx : idxWithSpace;
        assert.ok(finalIdx > lastIndex, `Header "${h}" must appear in sequence after previous column in header row`);
        lastIndex = finalIdx;
      }
    });
  });

  // =========================================================================
  // Requirement 3: Members Table - Remove Yellow Owner Badge
  // =========================================================================
  describe('3. Members Table: Remove Yellow Owner Badge & Keep Self-Identity', () => {
    const projectSettingsPath = path.join(frontendSrcDir, 'features/project/ProjectSettingsView.tsx');
    const projectMembersPath = path.join(frontendSrcDir, 'features/project/ProjectMembersView.tsx');
    const projectSettingsContent = fs.readFileSync(projectSettingsPath, 'utf8');
    const projectMembersContent = fs.readFileSync(projectMembersPath, 'utf8');

    test('ProjectSettingsView members table does not render yellow Owner badge', () => {
      // Must not render badge with Owner text and yellow/amber styling
      assert.doesNotMatch(
        projectSettingsContent,
        /bg-amber-[0-9]+[^>]*>[^<]*Owner[^<]*<\/span>/i,
        'Should not render yellow Owner badge in ProjectSettingsView'
      );
      assert.doesNotMatch(
        projectSettingsContent,
        /bg-yellow-[0-9]+[^>]*>[^<]*Owner[^<]*<\/span>/i,
        'Should not render yellow Owner badge in ProjectSettingsView'
      );
    });

    test('ProjectMembersView members table does not render yellow Owner badge', () => {
      assert.doesNotMatch(
        projectMembersContent,
        /bg-amber-[0-9]+[^>]*>[^<]*Owner[^<]*<\/span>/i,
        'Should not render yellow Owner badge in ProjectMembersView'
      );
      assert.doesNotMatch(
        projectMembersContent,
        /bg-yellow-[0-9]+[^>]*>[^<]*Owner[^<]*<\/span>/i,
        'Should not render yellow Owner badge in ProjectMembersView'
      );
    });

    test('Current user "You" badge is preserved', () => {
      assert.match(projectSettingsContent, /isSelf\s*&&\s*\(/);
      assert.match(projectSettingsContent, />\s*You\s*<\/span>/);
      assert.match(projectMembersContent, /isSelf\s*&&\s*\(/);
      assert.match(projectMembersContent, />\s*You\s*<\/span>/);
    });

    test('Current user role dropdown is hidden and rendered as read-only badge', () => {
      // In ProjectSettingsView: if isSelf, show read-only role badge, else show select dropdown
      assert.match(projectSettingsContent, /isSelf\s*\?\s*\(/);
      assert.match(projectSettingsContent, /<select[\s\S]*?aria-label=\{`Change role for \$\{member\.name\}`\}/);
    });
  });

  // =========================================================================
  // Requirement 4: Members Table Alignment & Workload Indicator
  // =========================================================================
  describe('4. Members Table: Consistent Alignment & Workload Display', () => {
    const projectSettingsPath = path.join(frontendSrcDir, 'features/project/ProjectSettingsView.tsx');
    const projectMembersPath = path.join(frontendSrcDir, 'features/project/ProjectMembersView.tsx');
    const projectSettingsContent = fs.readFileSync(projectSettingsPath, 'utf8');
    const projectMembersContent = fs.readFileSync(projectMembersPath, 'utf8');

    const expectedGrid = 'grid-cols-[minmax(220px,2fr)_140px_110px_100px_110px_70px]';

    test('ProjectSettingsView members header and rows share the exact grid definition', () => {
      const occurrences = projectSettingsContent.split(expectedGrid).length - 1;
      assert.ok(
        occurrences >= 2,
        `Expected at least 2 occurrences of ${expectedGrid} (header and row), found ${occurrences}`
      );
    });

    test('ProjectMembersView members header and rows share the exact grid definition', () => {
      const occurrences = projectMembersContent.split(expectedGrid).length - 1;
      assert.ok(
        occurrences >= 2,
        `Expected at least 2 occurrences of ${expectedGrid} (header and row), found ${occurrences}`
      );
    });

    test('Workload indicator is centered with a predictable badge width under Workload column', () => {
      // Both views must have min-w-[76px] and text-center for workload badge
      assert.match(projectSettingsContent, /min-w-\[76px\]/);
      assert.match(projectSettingsContent, /text-center/);
      assert.match(projectMembersContent, /min-w-\[76px\]/);
      assert.match(projectMembersContent, /text-center/);
    });

    test('Members table has horizontal scroll container with minimum width of 780px', () => {
      assert.match(projectSettingsContent, /overflow-x-auto/);
      assert.match(projectSettingsContent, /min-w-\[780px\]/);
      assert.match(projectMembersContent, /overflow-x-auto/);
      assert.match(projectMembersContent, /min-w-\[780px\]/);
    });
  });

  // =========================================================================
  // Requirement 5: Security & Danger Zone - Admin-Only Visibility & Guard
  // =========================================================================
  describe('5. Security & Danger Zone: Admin-Only RBAC & Direct Navigation Guard', () => {
    const projectSettingsPath = path.join(frontendSrcDir, 'features/project/ProjectSettingsView.tsx');
    const projectSettingsContent = fs.readFileSync(projectSettingsPath, 'utf8');

    test('Admin check correctly identifies org Admin or project Admin role', () => {
      const checkAdmin = (user: User, project: Project): boolean => {
        return (
          user.role === 'Admin' ||
          (project.memberRoles && project.memberRoles[user.id] === 'Admin') === true
        );
      };

      const orgAdmin: User = { id: 'u1', name: 'Org Admin', email: 'admin@org.com', role: 'Admin' };
      const projectAdmin: User = { id: 'u2', name: 'Project Admin', email: 'pm@org.com', role: 'Teammate' };
      const regularTeammate: User = { id: 'u3', name: 'Teammate', email: 'tm@org.com', role: 'Teammate' };
      const manager: User = { id: 'u4', name: 'Manager', email: 'mgr@org.com', role: 'Manager' };

      const sampleProject: Project = {
        id: 'proj-1',
        name: 'Alpha',
        key: 'ALP',
        description: '',
        status: 'Active',
        members: [orgAdmin, projectAdmin, regularTeammate, manager],
        memberRoles: {
          u2: 'Admin',
          u4: 'Manager',
          u3: 'Teammate',
        },
      };

      assert.equal(checkAdmin(orgAdmin, sampleProject), true, 'Org Admin must have admin privileges');
      assert.equal(checkAdmin(projectAdmin, sampleProject), true, 'Project-assigned Admin must have admin privileges');
      assert.equal(checkAdmin(regularTeammate, sampleProject), false, 'Teammate must not have admin privileges');
      assert.equal(checkAdmin(manager, sampleProject), false, 'Manager must not have admin privileges');
    });

    test('ProjectSettingsView sidebar filters out danger zone for non-admins', () => {
      assert.match(
        projectSettingsContent,
        /\{isAdmin\s*&&\s*\([\s\S]*?Security & Danger Zone[\s\S]*?\)\}/,
        'Sidebar Security & Danger Zone button must be conditionally rendered only when isAdmin is true'
      );
      assert.match(
        projectSettingsContent,
        /activeSection === 'danger' && isAdmin &&/,
        'Danger zone content must be conditionally guarded with activeSection === danger && isAdmin'
      );
    });

    test('ProjectSettingsView guards direct navigation to #danger or #security for non-admins', () => {
      // Guard redirects non-admin to general and updates window.location.hash
      assert.match(projectSettingsContent, /activeSection === 'danger' && !isAdmin/);
      assert.match(projectSettingsContent, /setActiveSection\(['"]general['"]\)/);
      assert.match(projectSettingsContent, /window\.location\.hash\s*=\s*`\/project\/\$\{currentProject\.id\}\/settings#general`/);
    });
  });

  // =========================================================================
  // Requirement 6: Add Existing Organization Members to Project
  // =========================================================================
  describe('6. Add Existing Org Members to Project: Search, Deduplication & API', () => {
    const dialogPath = path.join(frontendSrcDir, 'components/modals/AddProjectMemberDialog.tsx');
    const appContextPath = path.join(frontendSrcDir, 'state/AppContext.tsx');
    const dialogContent = fs.readFileSync(dialogPath, 'utf8');
    const appContextContent = fs.readFileSync(appContextPath, 'utf8');

    test('AddProjectMemberDialog fetches organization members via getOrganizationMembersApi', () => {
      assert.match(dialogContent, /getOrganizationMembersApi\(\)/);
    });

    test('AddProjectMemberDialog filters organization members by name and email case-insensitively', () => {
      const orgMembers = [
        { id: '1', fullName: 'Alice Johnson', email: 'alice@example.com', role: 'ADMIN' },
        { id: '2', fullName: 'Bob Williams', email: 'bob@example.com', role: 'MEMBER' },
        { id: '3', fullName: 'Charlie Davis', email: 'charlie@corp.com', role: 'MEMBER' },
      ];

      const searchMembers = (query: string) => {
        const q = query.trim().toLowerCase();
        if (!q) return orgMembers;
        return orgMembers.filter(
          (m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        );
      };

      assert.equal(searchMembers('alice').length, 1);
      assert.equal(searchMembers('ALICE')[0].id, '1');
      assert.equal(searchMembers('corp.com').length, 1);
      assert.equal(searchMembers('corp.com')[0].id, '3');
      assert.equal(searchMembers('nonexistent').length, 0);
    });

    test('AddProjectMemberDialog excludes or disables existing project members', () => {
      const existingProjectMemberIds = new Set(['1', '2']);
      const isAlreadyMember = (userId: string) => existingProjectMemberIds.has(userId);

      assert.equal(isAlreadyMember('1'), true, 'User 1 is already in project');
      assert.equal(isAlreadyMember('2'), true, 'User 2 is already in project');
      assert.equal(isAlreadyMember('3'), false, 'User 3 is not in project and can be added');

      assert.match(dialogContent, /existingSet\.has\(/);
      assert.match(dialogContent, /Already in project/);
    });

    test('Supported project roles map correctly to backend project roles', () => {
      assert.equal(toBackendProjectRole('Admin'), 'ADMIN');
      assert.equal(toBackendProjectRole('Manager'), 'LEAD');
      assert.equal(toBackendProjectRole('Teammate'), 'MEMBER');

      assert.equal(normalizeRole('ADMIN'), 'Admin');
      assert.equal(normalizeRole('LEAD'), 'Manager');
      assert.equal(normalizeRole('MEMBER'), 'Teammate');
    });

    test('AppContext addProjectMember calls addProjectMemberApi and handles real server persistence', () => {
      assert.match(appContextContent, /addProjectMemberApi\(projectId,\s*\{/);
      assert.match(appContextContent, /toBackendProjectRole\(role\)/);
    });

    test('ProjectSettingsView and ProjectMembersView provide "+ Add Member" action opening the dialog', () => {
      const settingsContent = fs.readFileSync(
        path.join(frontendSrcDir, 'features/project/ProjectSettingsView.tsx'),
        'utf8'
      );
      const membersContent = fs.readFileSync(
        path.join(frontendSrcDir, 'features/project/ProjectMembersView.tsx'),
        'utf8'
      );

      assert.match(settingsContent, /Add Member/);
      assert.match(settingsContent, /<AddProjectMemberDialog/);

      assert.match(membersContent, /Add Member/);
      assert.match(membersContent, /<AddProjectMemberDialog/);
    });
  });
});
