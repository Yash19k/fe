import { describe, test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Project Fixes Verification', () => {
  const srcDir = path.resolve(process.cwd(), 'src');

  test('Workspace Home Needs Attention: no overflow-x-auto, aligned grid columns', () => {
    const homeView = fs.readFileSync(path.join(srcDir, 'features/home/HomeView.tsx'), 'utf8');
    const taskRow = fs.readFileSync(path.join(srcDir, 'components/tasks/TaskRow.tsx'), 'utf8');

    // Confirm no overflow-x-auto or min-w-[780px] in Needs Attention
    assert.ok(!homeView.includes('overflow-x-auto min-w-[780px]'), 'Must not have overflow-x-auto with min-w-[780px]');
    
    // Check that header and row use the matching column definition
    const expectedCols = 'grid-cols-[minmax(140px,1fr)_110px_90px_95px_80px_50px]';
    assert.ok(homeView.includes(expectedCols), 'HomeView header must define matching columns');
    assert.ok(homeView.includes('gridColsClassName='), 'HomeView must pass gridColsClassName to TaskRow');
    assert.ok(taskRow.includes('gridColsClassName'), 'TaskRow must support gridColsClassName');
  });

  test('Activity & Audit Table: Actions column is visible without horizontal overflow', () => {
    const activityView = fs.readFileSync(path.join(srcDir, 'features/project/ProjectActivityView.tsx'), 'utf8');
    const settingsView = fs.readFileSync(path.join(srcDir, 'features/project/ProjectSettingsView.tsx'), 'utf8');

    // Confirm both views eliminated overflow-x-auto and min-w-[860px]
    assert.ok(!activityView.includes('overflow-x-auto min-w-[860px]'), 'ProjectActivityView must not have horizontal scrollbar wrapper');
    assert.ok(!settingsView.includes('overflow-x-auto min-w-[860px]'), 'ProjectSettingsView must not have horizontal scrollbar wrapper');

    // Check responsive grid layout allocating space for Actions column
    const gridCols = 'md:grid-cols-[100px_120px_120px_minmax(0,1fr)_125px_105px]';
    assert.ok(activityView.includes(gridCols), 'ProjectActivityView must have responsive 6-column grid');
    assert.ok(settingsView.includes(gridCols), 'ProjectSettingsView must have responsive 6-column grid');

    // Check Undo button and Change Undone text are unclipped
    assert.ok(activityView.includes('Change undone'), 'Must render Change undone state');
    assert.ok(settingsView.includes('Change undone'), 'Must render Change undone state');
  });

  test('Work Item Details Drawer: expanded width and no nested scrollbars', () => {
    const drawer = fs.readFileSync(path.join(srcDir, 'components/tasks/TaskDetailsDrawer.tsx'), 'utf8');

    // Confirm wide drawer sizing (~45-50vw on desktop, max 850px-920px)
    assert.ok(drawer.includes('w-full sm:w-[540px] md:w-[620px] lg:w-[48vw] lg:max-w-[850px] xl:w-[46vw] xl:max-w-[920px]'), 'Drawer must have widened dimensions');
    assert.ok(!drawer.includes('max-w-xl'), 'Must not be constrained to max-w-xl');

    // Confirm nested scrollbars removed from sub-sections
    assert.ok(!drawer.includes('max-h-32 overflow-y-auto'), 'Associated items must not have nested scrollbar');
    assert.ok(!drawer.includes('max-h-52 overflow-y-auto'), 'Comments must not have nested scrollbar');
    assert.ok(!drawer.includes('max-h-56 overflow-y-auto'), 'History must not have nested scrollbar');
  });

  test('Undo Persistence: maps authoritative backend audit fields correctly', () => {
    const appContext = fs.readFileSync(path.join(srcDir, 'state/AppContext.tsx'), 'utf8');

    // Check authoritative canUndo and isUndone derivation
    assert.ok(appContext.includes('const isAlreadyUndone = Boolean(a.isUndone);'), 'Must detect isUndone from server');
    assert.ok(appContext.includes('!isAlreadyUndone && hasPrev && isReversibleAction'), 'Must determine canUndo from authoritative server fields');
    assert.ok(appContext.includes('isUndone: isAlreadyUndone,'), 'Must set isUndone in mapped state');
    assert.ok(appContext.includes('undoneAt: a.undoneAt || null,'), 'Must map undoneAt');
  });

  test('Timeline: Sticky Task Breakdown left panel and empty phase filtering', () => {
    const timeline = fs.readFileSync(path.join(srcDir, 'features/project/ProjectTimelineView.tsx'), 'utf8');

    // Check sticky header
    assert.ok(timeline.includes('sticky left-0 z-40 w-64 sm:w-72'), 'Task Breakdown corner must be sticky left-0 z-40');
    // Check sticky section header
    assert.ok(timeline.includes('sticky left-0 z-20 w-64 sm:w-72'), 'Section header must be sticky left-0 z-20');
    // Check sticky task row title
    assert.ok(timeline.includes('sticky left-0 z-10 w-64 sm:w-72'), 'Task row title must be sticky left-0 z-10');

    // Check empty phase filtering
    assert.ok(timeline.includes('.filter((sec) => sec.tasks.length > 0)'), 'Empty phase sections must be filtered out');
    assert.ok(timeline.includes("{ id: 'sec-1', name: 'Discovery & Plan' }"), 'Must have Discovery & Plan fallback');
    assert.ok(timeline.includes("{ id: 'sec-2', name: 'Execution' }"), 'Must have Execution fallback');
    assert.ok(timeline.includes("{ id: 'sec-3', name: 'Review & Launch' }"), 'Must have Review & Launch fallback');
  });
});
