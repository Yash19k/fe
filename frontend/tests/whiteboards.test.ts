import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

describe('Whiteboards Functionality Verification Tests', () => {
  const whiteboardsViewPath = path.join(srcDir, 'features', 'project', 'WhiteboardsView.tsx');
  const whiteboardEditorViewPath = path.join(srcDir, 'features', 'project', 'WhiteboardEditorView.tsx');

  const whiteboardsViewContent = fs.readFileSync(whiteboardsViewPath, 'utf8');
  const whiteboardEditorViewContent = fs.readFileSync(whiteboardEditorViewPath, 'utf8');

  describe('1. Requirement: Replace Native Browser Alerts/Prompts with In-App Dialogs', () => {
    it('does not contain window.confirm, window.prompt, or window.alert in WhiteboardsView', () => {
      assert.ok(
        !whiteboardsViewContent.includes('window.confirm'),
        'WhiteboardsView must not use window.confirm'
      );
      assert.ok(
        !whiteboardsViewContent.includes('window.prompt'),
        'WhiteboardsView must not use window.prompt'
      );
      assert.ok(
        !whiteboardsViewContent.includes('window.alert'),
        'WhiteboardsView must not use window.alert'
      );
    });

    it('does not contain window.confirm, window.prompt, or window.alert in WhiteboardEditorView', () => {
      assert.ok(
        !whiteboardEditorViewContent.includes('window.confirm'),
        'WhiteboardEditorView must not use window.confirm'
      );
      assert.ok(
        !whiteboardEditorViewContent.includes('window.prompt'),
        'WhiteboardEditorView must not use window.prompt'
      );
      assert.ok(
        !whiteboardEditorViewContent.includes('window.alert'),
        'WhiteboardEditorView must not use window.alert'
      );
    });

    it('implements in-app Delete Confirmation Dialog in WhiteboardsView', () => {
      assert.ok(
        whiteboardsViewContent.includes('<Dialog') &&
          whiteboardsViewContent.includes('title="Delete Whiteboard"'),
        'WhiteboardsView must render in-app Dialog with title "Delete Whiteboard"'
      );
      assert.ok(
        whiteboardsViewContent.includes('description="This action cannot be undone."'),
        'Delete dialog must explain action cannot be undone'
      );
      assert.ok(
        whiteboardsViewContent.includes('variant="danger"'),
        'Delete dialog must use visually distinct destructive action for Delete'
      );
      assert.ok(
        whiteboardsViewContent.includes('disabled={deleting}'),
        'Delete dialog must disable actions while deletion is pending'
      );
      assert.ok(
        whiteboardsViewContent.includes('deleteWhiteboardApi'),
        'Must call deleteWhiteboardApi on confirmed deletion'
      );
    });

    it('implements in-app Rename Dialog in WhiteboardsView', () => {
      assert.ok(
        whiteboardsViewContent.includes('<Dialog') &&
          whiteboardsViewContent.includes('title="Rename Whiteboard"'),
        'WhiteboardsView must render in-app Dialog with title "Rename Whiteboard"'
      );
      assert.ok(
        whiteboardsViewContent.includes('renameWhiteboardApi'),
        'Must invoke renameWhiteboardApi to persist updated name'
      );
      assert.ok(
        whiteboardsViewContent.includes('disabled={renaming}'),
        'Rename dialog must prevent duplicate submissions while saving'
      );
      assert.ok(
        whiteboardsViewContent.includes('!renameName.trim()'),
        'Must reject empty or whitespace-only names'
      );
    });

    it('implements in-app Delete Dialog in WhiteboardEditorView header', () => {
      assert.ok(
        whiteboardEditorViewContent.includes('<Dialog') &&
          whiteboardEditorViewContent.includes('title="Delete Whiteboard"'),
        'WhiteboardEditorView must render in-app Dialog for deletion'
      );
      assert.ok(
        whiteboardEditorViewContent.includes('deleteWhiteboardApi'),
        'Must call deleteWhiteboardApi on confirmed deletion in editor'
      );
    });
  });

  describe('2. Requirement: Improve Whiteboards Page UI', () => {
    it('provides clear visual hierarchy with Back to project, title, and description', () => {
      assert.ok(
        whiteboardsViewContent.includes('Back to project'),
        'Must include Back to project navigation link'
      );
      assert.ok(
        whiteboardsViewContent.includes('<h2 className="text-xl font-bold text-text-primary tracking-tight">Whiteboards</h2>'),
        'Must render prominent Whiteboards heading'
      );
    });

    it('provides responsive creation controls with accessible input and submit button', () => {
      assert.ok(
        whiteboardsViewContent.includes('ref={nameInputRef}'),
        'Input must attach nameInputRef'
      );
      assert.ok(
        whiteboardsViewContent.includes('aria-label="New whiteboard name"'),
        'Input must have descriptive aria-label'
      );
      assert.ok(
        whiteboardsViewContent.includes('disabled={creating}'),
        'Creation controls must disable during submission to prevent duplicates'
      );
      assert.ok(
        whiteboardsViewContent.includes('maxLength={150}'),
        'Input must retain maxLength limit'
      );
    });

    it('renders whiteboard cards with structured layout, icons, timestamps, and balanced actions', () => {
      assert.ok(
        whiteboardsViewContent.includes('grid gap-4 sm:grid-cols-2 lg:grid-cols-3'),
        'Cards must render in responsive grid'
      );
      assert.ok(
        whiteboardsViewContent.includes('Updated'),
        'Cards must display readable last updated information'
      );
      assert.ok(
        whiteboardsViewContent.includes('title="Rename whiteboard"') &&
          whiteboardsViewContent.includes('title="Delete whiteboard"'),
        'Cards must have accessible actions for Open, Rename, and Delete'
      );
    });
  });

  describe('3. Requirement: Make Empty State Clickable', () => {
    it('renders enhanced empty state when no whiteboards exist', () => {
      assert.ok(
        whiteboardsViewContent.includes('No whiteboards yet'),
        'Empty state must display "No whiteboards yet" heading'
      );
      assert.ok(
        whiteboardsViewContent.includes('Create your first whiteboard'),
        'Empty state must include "Create your first whiteboard" action'
      );
    });

    it('central empty-state container is interactive and focuses the creation input', () => {
      assert.ok(
        whiteboardsViewContent.includes('role="button"'),
        'Empty state card must have role="button"'
      );
      assert.ok(
        whiteboardsViewContent.includes('tabIndex={0}'),
        'Empty state card must be keyboard-focusable with tabIndex={0}'
      );
      assert.ok(
        whiteboardsViewContent.includes('onClick={handleStartCreate}'),
        'Clicking empty state must trigger handleStartCreate'
      );
      assert.ok(
        whiteboardsViewContent.includes('nameInputRef.current.focus()'),
        'handleStartCreate must focus the name input'
      );
    });

    it('prevents duplicate action triggers from nested button', () => {
      assert.ok(
        whiteboardsViewContent.includes('e.stopPropagation()'),
        'Nested button click must stop propagation to prevent duplicate handlers'
      );
    });
  });

  describe('4. Requirement: Fullscreen Mode for Whiteboard Canvas', () => {
    it('adds fullscreen toggle button to WhiteboardEditorView header', () => {
      assert.ok(
        whiteboardEditorViewContent.includes('Maximize2') &&
          whiteboardEditorViewContent.includes('Minimize2'),
        'Must import and use Maximize2 and Minimize2 icons'
      );
      assert.ok(
        whiteboardEditorViewContent.includes('title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}'),
        'Fullscreen toggle must have dynamic title describing current action'
      );
      assert.ok(
        whiteboardEditorViewContent.includes('ariaLabel={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}'),
        'Fullscreen toggle must have dynamic aria-label'
      );
      assert.ok(
        whiteboardEditorViewContent.includes('onClick={() => void toggleFullscreen()}'),
        'Button must trigger toggleFullscreen'
      );
    });

    it('supports native browser Fullscreen API with graceful fallback', () => {
      assert.ok(
        whiteboardEditorViewContent.includes('requestFullscreen'),
        'toggleFullscreen must call requestFullscreen'
      );
      assert.ok(
        whiteboardEditorViewContent.includes('exitFullscreen'),
        'toggleFullscreen must call exitFullscreen when active'
      );
      assert.ok(
        whiteboardEditorViewContent.includes('isFallbackFullscreen'),
        'Must provide fallback fullscreen for environments where Fullscreen API is blocked'
      );
    });

    it('synchronizes state with browser fullscreenchange events', () => {
      assert.ok(
        whiteboardEditorViewContent.includes('addEventListener("fullscreenchange"'),
        'Must listen to fullscreenchange event on document'
      );
    });

    it('supports Escape key dismissal for fallback fullscreen', () => {
      assert.ok(
        whiteboardEditorViewContent.includes("e.key === \"Escape\""),
        'Must handle Escape key for fallback fullscreen dismissal'
      );
    });

    it('invokes Excalidraw refresh on fullscreen toggle to prevent clipping and blank canvas', () => {
      assert.ok(
        whiteboardEditorViewContent.includes('editorApi.current.refresh()'),
        'Must call editorApi.current.refresh() on fullscreen change'
      );
    });

    it('exits fullscreen cleanly when navigating back or unmounting', () => {
      assert.ok(
        whiteboardEditorViewContent.includes('handleBack'),
        'Must have handleBack that exits fullscreen when navigating away'
      );
    });
  });
});
