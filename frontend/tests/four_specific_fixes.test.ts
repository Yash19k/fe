import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  backendWorkItemToTask,
  backendPriorityToFrontend,
  frontendPriorityToBackend,
} from '../src/services/api';
import { classifyAuthError } from '../src/features/auth/AuthView';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ----------------------------------------------------
// 1. Priority Dropdown Tests
// ----------------------------------------------------
test('1. Priority dropdown in CreateTaskModal does NOT contain Urgent, preserves others', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'tasks', 'CreateTaskModal.tsx');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Find the Priority select block
  const prioritySelectMatch = content.match(/<Select\s+label="Priority"[\s\S]*?<\/Select>/);
  assert.ok(prioritySelectMatch, 'Priority Select component must exist in CreateTaskModal');
  const selectSnippet = prioritySelectMatch[0];

  // Urgent option must NOT be in this dropdown
  assert.ok(!selectSnippet.includes('value="Urgent"'), 'Urgent option must be removed from Priority dropdown');
  assert.ok(!selectSnippet.includes('>Urgent<'), 'Urgent text must be removed from Priority dropdown');

  // Remaining options must exist
  assert.ok(selectSnippet.includes('value=""') && selectSnippet.includes('>No priority<'), 'No priority option must exist');
  assert.ok(selectSnippet.includes('value="High"') && selectSnippet.includes('>High<'), 'High option must exist');
  assert.ok(selectSnippet.includes('value="Medium"') && selectSnippet.includes('>Medium<'), 'Medium option must exist');
  assert.ok(selectSnippet.includes('value="Low"') && selectSnippet.includes('>Low<'), 'Low option must exist');

  // Verify default state is empty ("No priority")
  assert.ok(content.includes("const [priority, setPriority] = useState<Priority | ''>('');"), 'Default priority must be empty ("No priority")');

  // Verify backend priority enums/mappings still support Urgent for existing tasks
  assert.equal(backendPriorityToFrontend('URGENT'), 'Urgent', 'Backend URGENT priority mapping to frontend must be preserved');
  assert.equal(frontendPriorityToBackend('Urgent'), 'URGENT', 'Frontend Urgent priority mapping to backend must be preserved');
});

// ----------------------------------------------------
// 2. List View Tags Tests
// ----------------------------------------------------
test('2. backendWorkItemToTask correctly maps tags and labels from backend responses', () => {
  // Test item with label object
  const itemWithLabelObj = {
    id: 'task-1',
    title: 'Task 1',
    label: { id: 'lbl-1', name: 'Security', color: '#ff0000' },
  };
  const mapped1 = backendWorkItemToTask(itemWithLabelObj, 'proj-1');
  assert.deepEqual(mapped1.labels, ['Security']);
  assert.deepEqual(mapped1.tags, ['Security']);

  // Test item with labels array of objects
  const itemWithLabelsArr = {
    id: 'task-2',
    title: 'Task 2',
    labels: [
      { id: 'lbl-1', name: 'Design' },
      { id: 'lbl-2', name: 'Frontend' },
    ],
  };
  const mapped2 = backendWorkItemToTask(itemWithLabelsArr, 'proj-1');
  assert.deepEqual(mapped2.labels, ['Design', 'Frontend']);
  assert.deepEqual(mapped2.tags, ['Design', 'Frontend']);

  // Test item with labelId only
  const itemWithLabelId = {
    id: 'task-3',
    title: 'Task 3',
    labelId: 'lbl-uuid-123',
  };
  const mapped3 = backendWorkItemToTask(itemWithLabelId, 'proj-1');
  assert.deepEqual(mapped3.labels, ['lbl-uuid-123']);
  assert.deepEqual(mapped3.tags, ['lbl-uuid-123']);

  // Test item with tags property
  const itemWithTags = {
    id: 'task-4',
    title: 'Task 4',
    tags: ['DevOps', 'Infra'],
  };
  const mapped4 = backendWorkItemToTask(itemWithTags, 'proj-1');
  assert.deepEqual(mapped4.tags, ['DevOps', 'Infra']);

  // Test item with neither tags nor labels
  const itemEmpty = {
    id: 'task-5',
    title: 'Task 5',
  };
  const mapped5 = backendWorkItemToTask(itemEmpty, 'proj-1');
  assert.deepEqual(mapped5.labels, []);
  assert.deepEqual(mapped5.tags, []);
});

test('2. TaskRow correctly resolves tags/labels and handles empty and multiple tags', () => {
  const rowPath = path.join(rootDir, 'src', 'components', 'tasks', 'TaskRow.tsx');
  const content = fs.readFileSync(rowPath, 'utf8');

  // Verify it reads both tags and labels
  assert.ok(content.includes('task.tags') && content.includes('task.labels'), 'TaskRow must inspect both task.tags and task.labels');

  // Verify resolution against available labels
  assert.ok(content.includes('projectLabels') || content.includes('labels'), 'TaskRow must use projectLabels or labels from useApp');

  // Verify multiple tag handling (+N indicator)
  assert.ok(content.includes('+{itemTags.length - 1}'), 'TaskRow must display +N count indicator for multiple tags');

  // Verify empty state dash
  assert.ok(content.includes('>-<'), 'TaskRow must retain "-" dash empty state for work items without tags');
});

// ----------------------------------------------------
// 3. Signup Email Validation Duplicate Error Tests
// ----------------------------------------------------
test('3. AuthView suppresses duplicate invalid email error in top-level banner while keeping inline error', () => {
  const authPath = path.join(rootDir, 'src', 'features', 'auth', 'AuthView.tsx');
  const content = fs.readFileSync(authPath, 'utf8');

  // Verify classifyAuthError produces the expected user-friendly message
  const errMessage = classifyAuthError({ message: 'user.email must be a valid email' });
  assert.equal(errMessage, 'Please enter a valid email address.');

  // In catch block: when isEmailError is true, authError is suppressed (null)
  assert.ok(
    content.includes('if (isEmailError)') && content.includes('setAuthError(null);'),
    'AuthView must set authError to null when an invalid email error occurs',
  );

  // In catch block: inline email error is set
  assert.ok(
    content.includes("setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address.' }));"),
    'AuthView must set field-level errors.email for invalid email',
  );

  // In JSX: banner is guarded so "Please enter a valid email address." never renders in top-level banner
  assert.ok(
    content.includes("authError !== 'Please enter a valid email address.'"),
    'Top-level banner must not render duplicate "Please enter a valid email address."',
  );

  // Other error conditions still display in top-level banner
  assert.ok(
    content.includes('setAuthError(friendlyMessage);'),
    'Distinct non-email errors must still set authError for banner display',
  );
});

// ----------------------------------------------------
// 4. Timeline CPM Label Removal Tests
// ----------------------------------------------------
test('4. ProjectTimelineView removes row-level CPM labels while preserving Critical Path toggle and logic', () => {
  const timelinePath = path.join(rootDir, 'src', 'features', 'project', 'ProjectTimelineView.tsx');
  const content = fs.readFileSync(timelinePath, 'utf8');

  // Check row rendering inside sec.tasks.map
  const rowMatch = content.match(/\{sec\.tasks\.map\(\(task: Task\) => \{([\s\S]*?)\}\)\}/);
  assert.ok(rowMatch, 'Task rows map must exist in ProjectTimelineView');
  const taskRowContent = rowMatch[1];

  // Confirm row-level CPM label is gone
  assert.ok(!taskRowContent.includes('>CPM<'), 'Row-level CPM label must not be rendered beside task title');

  // Confirm Critical Path (CPM) toggle in toolbar is preserved
  assert.ok(content.includes('Critical Path (CPM)'), 'Critical Path (CPM) toggle in toolbar must be preserved');
  assert.ok(content.includes('highlightCriticalPath'), 'highlightCriticalPath state must be preserved');

  // Confirm critical path calculation is preserved
  assert.ok(content.includes('calculateCriticalPath'), 'Critical path algorithm calculation must be preserved');
});
