import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatAuditFieldLabel,
  formatAuditFieldValue,
} from '../src/components/activity/AuditEventDetailsDialog.tsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

describe('TaskFlow Pro Targeted UI Fixes: Date, Role Labels, and Audit Event Details', () => {
  it('1. Work Item: Deadline displays date only without time portion', () => {
    const taskDetailsDrawerPath = path.join(srcDir, 'components', 'tasks', 'TaskDetailsDrawer.tsx');
    const content = fs.readFileSync(taskDetailsDrawerPath, 'utf8');

    // Verify slaDeadline.toLocaleDateString() is used instead of toLocaleString()
    assert.ok(
      content.includes('slaDeadline.toLocaleDateString()'),
      'Deadline must use toLocaleDateString() to display date only'
    );
    assert.ok(
      !content.includes('slaDeadline.toLocaleString()'),
      'Deadline must not include time via toLocaleString()'
    );

    // Verify escalatedAt also uses toLocaleDateString()
    assert.ok(
      content.includes('new Date(task.sla.escalatedAt).toLocaleDateString()'),
      'Escalated date must use toLocaleDateString()'
    );

    // Verify a sample date formatting
    const sampleDate = new Date('2026-10-30T23:36:13.000Z');
    const formatted = sampleDate.toLocaleDateString();
    assert.ok(!formatted.includes('PM') && !formatted.includes('AM') && !formatted.includes(':'));
  });

  it('2. Organization Member Management: Dropdown displays concise role names without suffixes', () => {
    const settingsPath = path.join(srcDir, 'features', 'settings', 'SettingsView.tsx');
    const content = fs.readFileSync(settingsPath, 'utf8');

    // Verify exact concise options exist
    assert.ok(content.includes('<option value="Teammate">Teammate</option>'));
    assert.ok(content.includes('<option value="Manager">Manager</option>'));
    assert.ok(content.includes('<option value="Admin">Admin</option>'));

    // Verify explanatory suffixes in parentheses are removed
    assert.ok(!content.includes('Teammate (Standard Contributor)'));
    assert.ok(!content.includes('Manager (Project & Sprint Lead)'));
    assert.ok(!content.includes('Admin (Workspace Administrator)'));
  });

  it('3. Audit Event Details: Technical event ID is removed from modal display', () => {
    const auditDialogPath = path.join(srcDir, 'components', 'activity', 'AuditEventDetailsDialog.tsx');
    const content = fs.readFileSync(auditDialogPath, 'utf8');

    // Verify "ID: {log.id}" is removed
    assert.ok(!content.includes('ID: {log.id}'));
    assert.ok(!content.includes('log.id'));
  });

  it('4. Audit Event Details: Human-readable field labels', () => {
    assert.equal(formatAuditFieldLabel('title'), 'Title');
    assert.equal(formatAuditFieldLabel('type'), 'Type');
    assert.equal(formatAuditFieldLabel('status'), 'Status');
    assert.equal(formatAuditFieldLabel('dueDate'), 'Due Date');
    assert.equal(formatAuditFieldLabel('startDate'), 'Start Date');
    assert.equal(formatAuditFieldLabel('priority'), 'Priority');
    assert.equal(formatAuditFieldLabel('severity'), 'Severity');
    assert.equal(formatAuditFieldLabel('description'), 'Description');
    assert.equal(formatAuditFieldLabel('customField'), 'Custom Field');
    assert.equal(formatAuditFieldLabel('is_completed'), 'Is Completed');
  });

  it('5. Audit Event Details: Known enum values converted to readable labels', () => {
    assert.equal(formatAuditFieldValue('type', 'SUBTASK'), 'Subtask');
    assert.equal(formatAuditFieldValue('type', 'TASK'), 'Task');
    assert.equal(formatAuditFieldValue('status', 'IN_PROGRESS'), 'In Progress');
    assert.equal(formatAuditFieldValue('status', 'BACKLOG'), 'Backlog');
    assert.equal(formatAuditFieldValue('status', 'TESTING_QA'), 'Testing / QA');
    assert.equal(formatAuditFieldValue('priority', 'MEDIUM'), 'Medium');
    assert.equal(formatAuditFieldValue('priority', 'HIGH'), 'High');
    assert.equal(formatAuditFieldValue('role', 'ADMIN'), 'Admin');
    assert.equal(formatAuditFieldValue('role', 'MANAGER'), 'Manager');
    assert.equal(formatAuditFieldValue('role', 'TEAMMATE'), 'Teammate');
  });

  it('6. Audit Event Details: Null, empty, and boolean values handled gracefully', () => {
    assert.equal(formatAuditFieldValue('dueDate', null), 'Not set');
    assert.equal(formatAuditFieldValue('labelId', null), 'Not set');
    assert.equal(formatAuditFieldValue('description', ''), 'Not set');
    assert.equal(formatAuditFieldValue('description', undefined), 'Not set');
    assert.equal(formatAuditFieldValue('isBlocked', true), 'Yes');
    assert.equal(formatAuditFieldValue('isBlocked', false), 'No');
  });

  it('7. Audit Event Details: Formats the illustrative example payload accurately', () => {
    const rawPayload = {
      type: 'SUBTASK',
      title: 'newww',
      status: 'IN_PROGRESS',
      dueDate: null,
      labelId: null,
      priority: 'MEDIUM',
    };

    const formattedFields = Object.entries(rawPayload).map(([k, v]) => ({
      label: formatAuditFieldLabel(k),
      value: formatAuditFieldValue(k, v),
    }));

    assert.deepEqual(formattedFields, [
      { label: 'Type', value: 'Subtask' },
      { label: 'Title', value: 'newww' },
      { label: 'Status', value: 'In Progress' },
      { label: 'Due Date', value: 'Not set' },
      { label: 'Label', value: 'Not set' },
      { label: 'Priority', value: 'Medium' },
    ]);
  });
});
