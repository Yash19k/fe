import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

describe('TaskFlow Pro — Targeted UI Fixes Verification', () => {
  // 1. Timeline — Remove Discovery & Plan
  describe('1. Timeline: Remove Discovery & Plan grouping header while preserving items', () => {
    const timelinePath = path.join(srcDir, 'features', 'project', 'ProjectTimelineView.tsx');
    const content = fs.readFileSync(timelinePath, 'utf8');

    test('omits the section label header when section is Discovery & Plan', () => {
      assert.ok(
        content.includes("const isDiscoveryAndPlan = sec.name.trim().toLowerCase() === 'discovery & plan';"),
        'Must detect Discovery & Plan section'
      );
      assert.ok(
        content.includes('!isDiscoveryAndPlan && ('),
        'Section header row must be conditionally rendered only when not Discovery & Plan'
      );
    });

    test('preserves work items under Discovery & Plan in the timeline work-item area', () => {
      // sec.tasks are mapped regardless of isDiscoveryAndPlan
      assert.ok(
        content.includes('{sec.tasks.map((task: Task) => {'),
        'Must render task rows for all sections including Discovery & Plan'
      );
      assert.ok(
        content.includes("formatShortDate(task.dueDate)"),
        'Must preserve task bar date formatting'
      );
    });

    test('preserves sticky left columns and date grid row layout', () => {
      assert.ok(content.includes('sticky left-0 z-40 w-64 sm:w-72'), 'Task Breakdown corner must be sticky');
      assert.ok(content.includes('sticky left-0 z-10 w-64 sm:w-72'), 'Task row titles must be sticky');
    });
  });

  // 2. Board View — Collapsible Status Columns
  describe('2. Board View: Collapsible Status Columns (Jira Reference)', () => {
    const boardPath = path.join(srcDir, 'features', 'project', 'ProjectBoardView.tsx');
    const content = fs.readFileSync(boardPath, 'utf8');

    test('manages independent collapsed state per status column', () => {
      assert.ok(
        content.includes('const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});'),
        'Must use independent state mapping for collapsed columns'
      );
      assert.ok(
        content.includes('function toggleColumnCollapse(statusKey: string)'),
        'Must have toggle function for column collapse'
      );
    });

    test('renders narrow vertical strip with expand button, opposite orientation status name, and count below', () => {
      assert.ok(content.includes('w-12 min-w-[48px]'), 'Collapsed column must be a narrow strip');
      assert.ok(content.includes("writingMode: 'vertical-rl'"), 'Collapsed status label must use vertical writing mode');
      assert.ok(!content.includes('rotate-180'), 'Status label must rotate 180 deg relative to previous inverted orientation');
      assert.ok(content.includes('ChevronsRight'), 'Must have expand icon control');
      assert.ok(content.includes('aria-label={`Expand ${status.name} column`}'), 'Must have accessible label for expand button');
    });

    test('arranges collapsed elements in vertical order with count badge below status text', () => {
      const collapsedStart = content.indexOf('w-12 min-w-[48px] h-full');
      const collapsedEnd = content.indexOf('w-72 sm:w-80 min-w-[288px]', collapsedStart);
      const collapsedBlock = content.slice(collapsedStart, collapsedEnd);

      const expandIdx = collapsedBlock.indexOf('ChevronsRight');
      const dotIdx = collapsedBlock.indexOf('style={{ backgroundColor: status.color }}');
      const textIdx = collapsedBlock.indexOf("writingMode: 'vertical-rl'");
      const countIdx = collapsedBlock.indexOf('{colTasks.length}');

      assert.ok(expandIdx < dotIdx, 'Expand control must appear before status indicator');
      assert.ok(dotIdx < textIdx, 'Status indicator must appear before status text');
      assert.ok(textIdx < countIdx, 'Status text must appear before work-item count badge');
      assert.ok(collapsedBlock.includes('border border-border text-center shadow-xs'), 'Count badge must have subtle border and centered text');
    });

    test('applies smooth collapse/expand transition respecting prefers-reduced-motion', () => {
      assert.ok(
        content.includes('transition-[width,min-width,max-width] duration-250 ease-in-out'),
        'Must use smooth width transition with ~200-300ms duration and easing'
      );
      assert.ok(
        content.includes('motion-reduce:transition-none'),
        'Must respect prefers-reduced-motion'
      );
    });

    test('renders collapse button in expanded header and preserves card dropzone', () => {
      assert.ok(content.includes('ChevronsLeft'), 'Must have collapse icon control in expanded header');
      assert.ok(content.includes('aria-label={`Collapse ${status.name} column`}'), 'Must have accessible label for collapse button');
      assert.ok(content.includes('colTasks.map((task: Task) => ('), 'Must render cards when expanded');
    });
  });

  // 3. List View — Column Alignment
  describe('3. List View: Table Column Alignment & Shared Layout', () => {
    const listPath = path.join(srcDir, 'features', 'project', 'ProjectListView.tsx');
    const taskRowPath = path.join(srcDir, 'components', 'tasks', 'TaskRow.tsx');
    const listContent = fs.readFileSync(listPath, 'utf8');
    const taskRowContent = fs.readFileSync(taskRowPath, 'utf8');

    const expectedGrid = 'grid-cols-[minmax(280px,1fr)_140px_110px_110px_90px_80px]';

    test('header and row share identical grid template and gap-3 spacing', () => {
      assert.ok(listContent.includes(expectedGrid), 'List view header must use standard 6-column grid');
      assert.ok(taskRowContent.includes(expectedGrid), 'TaskRow must use standard 6-column grid');
      assert.ok(listContent.includes('gap-3'), 'List header must use gap-3');
      assert.ok(taskRowContent.includes('gap-3'), 'TaskRow must use gap-3');
    });

    test('status column header and StatusBadge cell are aligned and centered', () => {
      assert.ok(
        listContent.includes('<span className="text-center">Status</span>'),
        'Status header must be centered in its column'
      );
      assert.ok(
        taskRowContent.includes('justify-center') && taskRowContent.includes('<StatusBadge'),
        'TaskRow StatusBadge must be centered in its column'
      );
    });

    test('due date handles empty values gracefully with consistent placeholder', () => {
      assert.ok(
        taskRowContent.includes("<span className=\"text-[11px] text-text-muted/40 font-mono\">-</span>"),
        'Empty due date must render consistent placeholder'
      );
    });
  });

  // 4. Sprint Delivery Progress Bar
  describe('4. Sprint: Delivery Progress Bar Accurate Calculation & Visual Width', () => {
    const sprintPath = path.join(srcDir, 'features', 'project', 'SprintDashboardView.tsx');
    const content = fs.readFileSync(sprintPath, 'utf8');

    test('calculates completion percentage strictly from completed work items', () => {
      assert.ok(
        content.includes('isWorkflowStatusComplete(currentWorkflow, task.status)'),
        'Completed tasks must follow the configured workflow completion category'
      );
      assert.ok(
        content.includes('total > 0 ? Math.round((completed / total) * 100) : 0'),
        'Completion percentage must be completed/total * 100 rounded'
      );
    });

    test('visual bar width matches completionPercentage strictly without inProgress distortion', () => {
      assert.ok(
        content.includes('width: `${Math.min(100, Math.max(0, metrics.completionPercentage))}%`'),
        'Bar width must match completion percentage clamped between 0 and 100'
      );
      assert.ok(
        !content.includes('title={`In Progress: ${metrics.inProgress}`}'),
        'Progress bar must not display inProgress segment filling the completion bar'
      );
    });
  });

  // 5. Remove Top-Left Sync Button
  describe('5. Sidebar: Remove Top-Left Sync Button while preserving sync logic', () => {
    const sidebarPath = path.join(srcDir, 'components', 'navigation', 'WorkspaceSidebar.tsx');
    const broadcastPath = path.join(srcDir, 'state', 'broadcast.ts');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    const broadcastContent = fs.readFileSync(broadcastPath, 'utf8');

    test('removes visible sync button from top-left sidebar header', () => {
      assert.doesNotMatch(
        sidebarContent,
        /<span[^>]*>\s*Sync\s*<\/span>/,
        'Sidebar must not contain visible Sync text button'
      );
      assert.doesNotMatch(
        sidebarContent,
        /title="Real-time multi-tab synchronization"/,
        'Sidebar must not contain sync pill'
      );
    });

    test('preserves workspace name and TF logo in header with clean layout', () => {
      assert.ok(sidebarContent.includes('TF'), 'Must keep TF logo icon');
      assert.ok(sidebarContent.includes('currentCompany?.name'), 'Must keep workspace brand name');
      assert.ok(sidebarContent.includes('h-14 px-4 border-b border-border'), 'Header container must preserve height and border');
    });

    test('preserves underlying cross-tab synchronization mechanism', () => {
      assert.ok(broadcastContent.includes('taskflow_pro_sync_channel'), 'Broadcast channel must remain active');
    });
  });

  // 6. Board Card Move-to Dropdown Removal
  describe('6. Board View: Remove Move-to Dropdown from Board Cards', () => {
    const taskCardPath = path.join(srcDir, 'components', 'tasks', 'TaskCard.tsx');
    const content = fs.readFileSync(taskCardPath, 'utf8');

    test('completely removes the Move to dropdown from card layout', () => {
      assert.doesNotMatch(content, /Move to:/i, 'Board card must not contain Move to dropdown or label');
      assert.doesNotMatch(content, /role="listbox"/i, 'Board card must not render listbox dropdown');
      assert.doesNotMatch(content, /<select/i, 'Board card must not render select element');
    });

    test('preserves work-item card metadata, drag-and-drop, and drawer opening', () => {
      assert.ok(content.includes('openTaskDrawer(task.id)'), 'Must preserve click to open task drawer');
      assert.ok(content.includes('onDragStart={(e) => onDragStart(e, task.id)}'), 'Must preserve drag-and-drop');
      assert.ok(content.includes('<WorkItemTypeBadge'), 'Must preserve work item type badge');
      assert.ok(content.includes('<PriorityBadge'), 'Must preserve priority badge');
      assert.ok(content.includes('<SlaBadge'), 'Must preserve SLA badge');
      assert.ok(content.includes('<Avatar'), 'Must preserve assignee avatar');
    });
  });

  // 7. Project Settings — Remove Asterisk from Project Name
  describe('7. Project Settings: Remove Asterisk from Project Name in General Information', () => {
    const settingsPath = path.join(srcDir, 'features', 'project', 'ProjectSettingsView.tsx');
    const content = fs.readFileSync(settingsPath, 'utf8');

    test('renders Project Name without asterisk in General Information', () => {
      assert.ok(
        content.includes('label="Project Name"'),
        'Project Name label must not have an asterisk'
      );
      assert.doesNotMatch(
        content,
        /label="Project Name \*"/,
        'Project Name label must not contain asterisk'
      );
    });

    test('preserves project name validation and saving logic', () => {
      assert.ok(
        content.includes("setGeneralError('Project name cannot be empty');"),
        'Must preserve empty name validation'
      );
      assert.ok(
        content.includes('updateProject(currentProject.id,'),
        'Must preserve project update call'
      );
    });
  });
});
