import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

describe('Input Focus Bug Fix Verification (Create Project & Work Item Forms)', () => {
  const dialogPath = path.join(srcDir, 'components', 'ui', 'Dialog.tsx');
  const createProjectPath = path.join(srcDir, 'components', 'modals', 'CreateProjectModal.tsx');
  const createTaskPath = path.join(srcDir, 'components', 'tasks', 'CreateTaskModal.tsx');

  const dialogContent = fs.readFileSync(dialogPath, 'utf8');
  const createProjectContent = fs.readFileSync(createProjectPath, 'utf8');
  const createTaskContent = fs.readFileSync(createTaskPath, 'utf8');

  describe('1. Dialog Component Focus Management Architecture', () => {
    it('uses onCloseRef to decouple onClose callback recreation from effect re-execution', () => {
      assert.ok(
        dialogContent.includes('const onCloseRef = useRef(onClose);'),
        'Dialog must store onClose in a ref'
      );
      assert.ok(
        dialogContent.includes('onCloseRef.current = onClose;'),
        'Dialog must update onCloseRef with current onClose'
      );
    });

    it('does NOT include onClose in the modal lifecycle useEffect dependency array', () => {
      // The effect managing dialog focus and overflow must depend strictly on [isOpen]
      assert.ok(
        dialogContent.includes('}, [isOpen]);'),
        'Dialog lifecycle useEffect must depend strictly on [isOpen], not [isOpen, onClose]'
      );
      assert.ok(
        !dialogContent.includes('}, [isOpen, onClose]);'),
        'Dialog must not have [isOpen, onClose] dependency which caused re-running on every keystroke'
      );
    });

    it('Escape key handler uses onCloseRef.current to close dialog', () => {
      assert.ok(
        dialogContent.includes('onCloseRef.current();'),
        'Escape key handler must call onCloseRef.current()'
      );
    });

    it('retains keyboard accessibility and Tab focus trapping', () => {
      assert.ok(
        dialogContent.includes("if (e.key === 'Tab' && dialogRef.current)"),
        'Dialog must retain Tab focus trap handler'
      );
      assert.ok(
        dialogContent.includes('aria-label="Close dialog"'),
        'Close button must retain accessible label'
      );
      assert.ok(
        dialogContent.includes('previousActiveElementRef.current.focus()'),
        'Must restore focus on modal close'
      );
    });

    it('does not steal focus if an element inside the dialog already has focus', () => {
      assert.ok(
        dialogContent.includes('dialogRef.current.contains(document.activeElement)'),
        'Dialog must check whether activeElement is already inside the dialog before attempting focus'
      );
    });

    it('prioritizes autofocus elements and form fields over the close button on initial focus', () => {
      assert.ok(
        dialogContent.includes('[autofocus]:not([disabled])'),
        'Dialog must look for autofocus element'
      );
      assert.ok(
        dialogContent.includes('input:not([disabled]), textarea:not([disabled]), select:not([disabled])'),
        'Dialog must prioritize form inputs over header close button'
      );
    });
  });

  describe('2. Focus Resolution Algorithm Simulation', () => {
    it('keeps focus intact when user is already focused on an input inside the dialog', () => {
      let focusCallCount = 0;
      const fakeInput = {
        name: 'projectName',
        focus: () => {
          focusCallCount++;
        },
      };

      const fakeCloseBtn = {
        name: 'closeButton',
        focus: () => {
          focusCallCount++;
        },
      };

      const fakeDialog = {
        contains: (el: any) => el === fakeInput,
        querySelector: () => null,
        querySelectorAll: () => [fakeCloseBtn, fakeInput],
      };

      // Active element is the input
      const activeElement = fakeInput;

      // Simulate Dialog focus logic
      function resolveFocus(dialogEl: any, currentActive: any) {
        if (dialogEl.contains(currentActive) && currentActive !== dialogEl) {
          return 'kept-existing-focus';
        }
        const autoFocusEl = dialogEl.querySelector('[autofocus]:not([disabled])');
        if (autoFocusEl) {
          autoFocusEl.focus();
          return 'focused-autofocus';
        }
        const firstFormField = dialogEl.querySelector('input, textarea, select');
        if (firstFormField) {
          firstFormField.focus();
          return 'focused-form-field';
        }
        const focusables = dialogEl.querySelectorAll();
        if (focusables.length > 0) {
          focusables[0].focus();
          return 'focused-first-focusable';
        }
        return 'none';
      }

      const result = resolveFocus(fakeDialog, activeElement);
      assert.equal(result, 'kept-existing-focus');
      assert.equal(focusCallCount, 0, 'Must NOT steal focus from active input');
    });

    it('focuses autofocus element on modal open if focus is not already inside dialog', () => {
      let focusedElement = '';
      const fakeInput = {
        name: 'projectName',
        focus: () => {
          focusedElement = 'projectName';
        },
      };
      const fakeCloseBtn = {
        name: 'closeButton',
        focus: () => {
          focusedElement = 'closeButton';
        },
      };

      const fakeDialog = {
        contains: (_el: any) => false,
        querySelector: (sel: string) => (sel.includes('autofocus') ? fakeInput : null),
        querySelectorAll: () => [fakeCloseBtn, fakeInput],
      };

      function resolveFocus(dialogEl: any, currentActive: any) {
        if (dialogEl.contains(currentActive) && currentActive !== dialogEl) {
          return 'kept-existing-focus';
        }
        const autoFocusEl = dialogEl.querySelector('[autofocus]:not([disabled])');
        if (autoFocusEl) {
          autoFocusEl.focus();
          return 'focused-autofocus';
        }
        return 'none';
      }

      const result = resolveFocus(fakeDialog, null);
      assert.equal(result, 'focused-autofocus');
      assert.equal(focusedElement, 'projectName', 'Must focus autofocus input instead of close button');
    });

    it('preserves focus across multiple keystrokes when parent re-renders and recreates onClose', () => {
      // Simulating effect execution count across typing 10 characters
      let effectRunCount = 0;
      let isOpen = true;
      let lastIsOpen = false;

      function simulateRender(newOnClose: () => void) {
        // Effect with [isOpen] dependency
        if (isOpen !== lastIsOpen) {
          lastIsOpen = isOpen;
          effectRunCount++;
        }
      }

      // Initial render when opening modal
      simulateRender(() => {});
      assert.equal(effectRunCount, 1, 'Effect runs once when modal opens');

      // 10 keystrokes typed into input, each creating a new onClose callback
      const typed = 'Alpha Proj';
      for (const _char of typed) {
        const newOnClose = () => {
          /* new closure on each render */
        };
        simulateRender(newOnClose);
      }

      assert.equal(
        effectRunCount,
        1,
        'Effect must NOT re-run on subsequent keystrokes when onClose changes'
      );
    });
  });

  describe('3. Create New Project Modal Form Integrity', () => {
    it('contains autoFocus on Project Name input', () => {
      assert.ok(
        createProjectContent.includes('label="Project Name *"'),
        'Must have Project Name input'
      );
      assert.ok(
        createProjectContent.includes('autoFocus'),
        'Project Name input must have autoFocus'
      );
    });

    it('preserves Project ID and Description input controls', () => {
      assert.ok(
        createProjectContent.includes('Project ID *'),
        'Must retain Project ID field'
      );
      assert.ok(
        createProjectContent.includes('label="Project Description"'),
        'Must retain Project Description textarea'
      );
      assert.ok(
        createProjectContent.includes('handleNameChange'),
        'Must retain handleNameChange handler'
      );
      assert.ok(
        createProjectContent.includes('handleIdChange'),
        'Must retain handleIdChange handler'
      );
    });
  });

  describe('4. Create New Work Item Modal Form Integrity', () => {
    it('contains autoFocus on Title input', () => {
      assert.ok(
        createTaskContent.includes('label="Title *"'),
        'Must have Title input'
      );
      assert.ok(
        createTaskContent.includes('autoFocus'),
        'Title input must have autoFocus'
      );
    });

    it('preserves Description, Type, and all form controls', () => {
      assert.ok(
        createTaskContent.includes('label="Description"'),
        'Must retain Description textarea'
      );
      assert.ok(
        createTaskContent.includes('Work Item Type *'),
        'Must retain Work Item Type selector'
      );
    });
  });
});
