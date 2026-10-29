import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDisplayDate, parseDateValue, toDateInputValue } from '../src/utils/dateUtils';
import { formatShortDate, getRelativeDateLabel } from '../src/domain/businessDays';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

describe('Safe date display', () => {
  it('formats valid date-only values without shifting their calendar day', () => {
    const parsed = parseDateValue('2026-10-29');
    assert.ok(parsed);
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 9);
    assert.equal(parsed.getDate(), 29);
    assert.equal(
      formatDisplayDate('2026-10-29'),
      new Date(2026, 9, 29).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    );
  });

  it('preserves date-only values in a timezone west of UTC', () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = 'America/Los_Angeles';
      const parsed = parseDateValue('2026-10-29');
      assert.ok(parsed);
      assert.equal(parsed.getFullYear(), 2026);
      assert.equal(parsed.getMonth(), 9);
      assert.equal(parsed.getDate(), 29);
      assert.ok(formatDisplayDate('2026-10-29').includes('29'));
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  });

  it('formats timestamps using the existing local timezone convention', () => {
    const timestamp = '2026-10-29T23:30:00.000Z';
    const expected = new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    assert.equal(formatDisplayDate(timestamp), expected);
  });

  it('uses the fallback for absent and invalid values', () => {
    for (const value of [null, undefined, '', '   ']) {
      assert.equal(formatDisplayDate(value), '-');
    }
    assert.equal(formatDisplayDate('not-a-date'), '-');
    assert.equal(formatDisplayDate('2026-02-31'), '-');
    assert.equal(formatDisplayDate('2026-02-31T12:00:00Z'), '-');
    assert.equal(formatShortDate('not-a-date'), '-');
    assert.equal(toDateInputValue('2026-02-31'), '');
    assert.equal(toDateInputValue('2026-02-31T12:00:00Z'), '');
  });

  it('retains explicit fallbacks and formats valid numeric timestamps', () => {
    assert.equal(formatDisplayDate(null, 'TBD'), 'TBD');
    assert.equal(
      formatDisplayDate(0),
      new Date(0).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    );
  });

  it('does not classify missing or malformed task dates as overdue or due soon', () => {
    for (const value of [undefined, null, '', 'not-a-date', '2026-02-31']) {
      assert.deepEqual(getRelativeDateLabel(value), {
        label: '-',
        isOverdue: false,
        isDueSoon: false,
      });
    }
  });

  it('keeps task-date displays wired through the shared safe formatter', () => {
    const taskRow = fs.readFileSync(path.join(srcDir, 'components', 'tasks', 'TaskRow.tsx'), 'utf8');
    const taskCard = fs.readFileSync(path.join(srcDir, 'components', 'tasks', 'TaskCard.tsx'), 'utf8');
    const home = fs.readFileSync(path.join(srcDir, 'features', 'home', 'HomeView.tsx'), 'utf8');
    const myTasks = fs.readFileSync(path.join(srcDir, 'features', 'my-tasks', 'MyTasksView.tsx'), 'utf8');
    const projectList = fs.readFileSync(path.join(srcDir, 'features', 'project', 'ProjectListView.tsx'), 'utf8');

    assert.ok(taskRow.includes('getRelativeDateLabel(task.dueDate)'));
    assert.ok(taskCard.includes('getRelativeDateLabel(task.dueDate)'));
    assert.ok(home.includes('<TaskRow'));
    assert.ok(myTasks.includes('<TaskRow'));
    assert.ok(projectList.includes('<TaskRow'));
  });
});
