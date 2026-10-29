import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

describe('TaskFlow Pro — Chat UI Refinement & Sidebar Consolidation Tests', () => {
  const chatViewPath = path.join(srcDir, 'features', 'chat', 'ChatView.tsx');
  const chatViewContent = fs.readFileSync(chatViewPath, 'utf8');

  const sidebarPath = path.join(srcDir, 'components', 'navigation', 'WorkspaceSidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  const appPath = path.join(srcDir, 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  // =========================================================================
  // ISSUE 1: Chat Header Contact Name Resolution
  // =========================================================================
  describe('Issue 1: Contact Name Resolution & Chat Header', () => {
    test('does not use email addresses as primary contact names', () => {
      // Must contain email detection helper
      assert.ok(
        chatViewContent.includes('isEmailString') || chatViewContent.includes('isEmail'),
        'Must validate candidate names to prevent displaying raw emails as headings'
      );
    });

    test('derives display name from real profile fields in preferred order', () => {
      // Must check displayName, fullName, firstName/lastName, or name
      assert.ok(
        chatViewContent.includes('displayName') && chatViewContent.includes('fullName'),
        'Must check displayName and fullName from user profile data'
      );
    });

    test('does not fabricate names or map "a@gmail.com" to single letter "A"', () => {
      assert.doesNotMatch(
        chatViewContent,
        /candidateEmail\.split\('@'\)\[0\]\.charAt\(0\)\.toUpperCase\(\)/,
        'Must not map email handle to single letter initial as person name'
      );
    });

    test('uses sensible neutral fallback when no human name exists in profile', () => {
      assert.ok(
        chatViewContent.includes("'Teammate'"),
        'Must provide neutral fallback "Teammate" when no name is provided'
      );
    });

    test('preserves email address as secondary information in header and conversation list', () => {
      assert.ok(
        chatViewContent.includes('selectedParticipant.email'),
        'Active header must render email address as secondary subtitle'
      );
      assert.ok(
        chatViewContent.includes('participant.email'),
        'Conversation list items must render email address as secondary text when appropriate'
      );
    });
  });

  // =========================================================================
  // ISSUE 2: Sidebar Consolidation
  // =========================================================================
  describe('Issue 2: Single Collapsible Navigation Sidebar', () => {
    test('removes the second separate GlobalRail navigation rail from App.tsx', () => {
      assert.doesNotMatch(
        appContent,
        /<GlobalRail/i,
        'App.tsx must not render a separate GlobalRail navigation region'
      );
    });

    test('renders one single collapsible WorkspaceSidebar in App.tsx', () => {
      assert.match(
        appContent,
        /<WorkspaceSidebar/i,
        'App.tsx must render the consolidated WorkspaceSidebar'
      );
    });

    test('WorkspaceSidebar supports expanded state with icons and labels', () => {
      assert.ok(
        sidebarContent.includes('Workspace Home') &&
        sidebarContent.includes('My Tasks') &&
        sidebarContent.includes('Projects') &&
        sidebarContent.includes('Chat') &&
        sidebarContent.includes('Settings'),
        'Expanded sidebar must display all primary navigation labels'
      );
    });

    test('WorkspaceSidebar supports collapsed state with centered icons only', () => {
      assert.ok(
        sidebarContent.includes('isCollapsed ?') || sidebarContent.includes('isCollapsed'),
        'Must contain conditional rendering for collapsed icon-only state'
      );
      assert.ok(
        sidebarContent.includes('w-14') || sidebarContent.includes('lg:w-14'),
        'Collapsed state must use compact 56px (w-14) width'
      );
    });

    test('includes smooth collapse/expand transition (180-250ms)', () => {
      assert.match(
        sidebarContent,
        /duration-200|duration-180|duration-250/,
        'Sidebar transition must be within 180-250ms'
      );
    });

    test('provides collapse/expand toggle controls with accessible labels', () => {
      assert.ok(
        sidebarContent.includes('Collapse navigation menu') &&
        sidebarContent.includes('Expand navigation menu'),
        'Sidebar must include accessible collapse and expand controls'
      );
    });
  });

  // =========================================================================
  // ISSUE 3: Chat Message Avatars & Bubble Presentation
  // =========================================================================
  describe('Issue 3: Chat Message Design with Avatars', () => {
    test('renders sender avatar for received messages on the left', () => {
      assert.ok(
        chatViewContent.includes('!isMe') && chatViewContent.includes('senderInitials'),
        'Received messages must display sender avatar on the left'
      );
    });

    test('renders user avatar for sent messages on the right', () => {
      assert.ok(
        chatViewContent.includes('isMe') && chatViewContent.includes('justify-end'),
        'Sent messages must be aligned right with current user avatar'
      );
    });

    test('message bubbles adapt dynamically to content width', () => {
      assert.ok(
        chatViewContent.includes('w-fit') || chatViewContent.includes('max-w-['),
        'Message bubbles must adapt to content rather than spanning entire width for short text'
      );
      assert.ok(
        chatViewContent.includes('break-words') && chatViewContent.includes('whitespace-pre-wrap'),
        'Message text must properly wrap and preserve whitespace'
      );
    });

    test('preserves timestamps associated with messages', () => {
      assert.ok(
        chatViewContent.includes('formatMessageTimestamp(message.createdAt)'),
        'Timestamps must be preserved and formatted cleanly'
      );
    });
  });

  // =========================================================================
  // ISSUE 4: Auto-Resizing Message Input
  // =========================================================================
  describe('Issue 4: Auto-Resizing Multiline Composer', () => {
    test('uses multiline textarea instead of single-line text input', () => {
      assert.ok(
        chatViewContent.includes('<textarea'),
        'Composer must use textarea for multiline auto-resizing'
      );
      assert.doesNotMatch(
        chatViewContent,
        /<input[^>]+type="text"[^>]+value={draft}/,
        'Composer must not use single-line text input for message drafting'
      );
    });

    test('implements auto-resizing height calculation based on scrollHeight', () => {
      assert.ok(
        chatViewContent.includes('adjustTextareaHeight') || chatViewContent.includes('scrollHeight'),
        'Must dynamically adjust textarea height based on scrollHeight'
      );
    });

    test('clamps textarea expansion to reasonable maximum height with internal scroll', () => {
      assert.ok(
        chatViewContent.includes('maxHeight') || chatViewContent.includes('max-h-['),
        'Must clamp textarea expansion to maximum height'
      );
    });

    test('preserves keyboard submission on Enter and newline on Shift+Enter', () => {
      assert.ok(
        chatViewContent.includes("e.key === 'Enter'") && chatViewContent.includes('!e.shiftKey'),
        'Must send on Enter without Shift, and allow multiline with Shift+Enter'
      );
    });
  });

  // =========================================================================
  // ISSUE 5: Emoji, File, and Media Controls
  // =========================================================================
  describe('Issue 5: Emoji, File, and Media Controls', () => {
    test('renders emoji, attach file, and attach media buttons in composer', () => {
      assert.ok(
        chatViewContent.includes('title="Emoji"') || chatViewContent.includes('aria-label="Emoji"'),
        'Must render Emoji button'
      );
      assert.ok(
        chatViewContent.includes('title="Attach file"') || chatViewContent.includes('aria-label="Attach file"'),
        'Must render Attach File button'
      );
      assert.ok(
        chatViewContent.includes('title="Attach media"') || chatViewContent.includes('aria-label="Attach media"'),
        'Must render Attach Media button'
      );
    });

    test('provides functional emoji picker inserting emoji at cursor position', () => {
      assert.ok(
        chatViewContent.includes('EMOJI_PALETTE') || chatViewContent.includes('showEmojiPicker'),
        'Must provide emoji picker palette'
      );
      assert.ok(
        chatViewContent.includes('handleEmojiSelect'),
        'Must have handler to insert selected emoji'
      );
    });

    test('displays pending attachment preview with removal button', () => {
      assert.ok(
        chatViewContent.includes('pendingAttachment') && chatViewContent.includes('removeAttachment'),
        'Must support draft attachment preview and removal'
      );
    });

    test('documents missing backend attachment APIs in BACKEND_TEAM_HANDOFF.md', () => {
      const handoffPath = path.resolve(__dirname, '../../BACKEND_TEAM_HANDOFF.md');
      assert.ok(fs.existsSync(handoffPath), 'BACKEND_TEAM_HANDOFF.md must exist in root');
      const handoffContent = fs.readFileSync(handoffPath, 'utf8');
      assert.ok(
        handoffContent.includes('Issue 3: Chat Message File and Media Attachment API & Storage Missing'),
        'Must document missing backend chat attachment capability'
      );
      assert.ok(
        handoffContent.includes('chat_messages'),
        'Must reference existing chat_messages table constraints'
      );
    });
  });
});
