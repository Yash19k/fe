import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

describe('TaskFlow Pro — Authentication Pages Visual Improvements', () => {
  const authViewPath = path.join(srcDir, 'features', 'auth', 'AuthView.tsx');
  const inputComponentPath = path.join(srcDir, 'components', 'ui', 'Input.tsx');
  const logoComponentPath = path.join(srcDir, 'landing-page', 'components', 'TaskFlowLogo.tsx');

  const authViewContent = fs.readFileSync(authViewPath, 'utf8');
  const inputContent = fs.readFileSync(inputComponentPath, 'utf8');
  const logoContent = fs.readFileSync(logoComponentPath, 'utf8');

  // =========================================================================
  // 1. Official Logo Replacement & Positioning
  // =========================================================================
  describe('1. Official TaskFlow Pro Logo Integration', () => {
    test('replaces the small purple layers icon with TaskFlowLogoIcon in AuthView', () => {
      // Must not import or render Layers from lucide-react in brand section
      assert.ok(
        !authViewContent.includes('<Layers'),
        'Must remove old Layers icon from AuthView'
      );
      assert.ok(
        !authViewContent.includes("import { Layers"),
        'Must remove Layers from lucide-react import in AuthView'
      );

      // Must import official TaskFlowLogoIcon from landing-page logo component
      assert.ok(
        authViewContent.includes("import { TaskFlowLogoIcon } from '../../landing-page/components/TaskFlowLogo';"),
        'Must import TaskFlowLogoIcon from landing-page component'
      );

      // Must render TaskFlowLogoIcon
      assert.ok(
        authViewContent.includes('<TaskFlowLogoIcon'),
        'Must render TaskFlowLogoIcon component'
      );
    });

    test('centers the logo horizontally directly above the authentication headings', () => {
      // Brand container must be centered
      assert.ok(
        authViewContent.includes('className="text-center space-y-2">') ||
        authViewContent.includes('className="text-center space-y-3">') ||
        authViewContent.includes('className="text-center'),
        'Brand container must center contents'
      );

      // Logo container must be horizontally centered
      assert.ok(
        authViewContent.includes('items-center justify-center mx-auto'),
        'Logo container must be centered horizontally via mx-auto flex'
      );

      // Logo must precede heading in DOM order
      const logoIndex = authViewContent.indexOf('<TaskFlowLogoIcon');
      const headingIndex = authViewContent.indexOf('isSignup ? \'Create your TaskFlow account\' : \'Sign in to TaskFlow Pro\'');
      assert.ok(logoIndex > 0, 'Logo must be present');
      assert.ok(headingIndex > logoIndex, 'Logo must be positioned directly above the heading');

      // Do NOT position logo in top-left corner
      assert.ok(
        !authViewContent.includes('absolute top-') || !authViewContent.includes('absolute top-4 left-4'),
        'Must not place logo in top-left corner'
      );
    });

    test('preserves official logo proportions, colors, and viewBox', () => {
      // TaskFlowLogoIcon in landing-page component must define official Framer paths and colors
      assert.ok(logoContent.includes('viewBox="0 0 84 64"'), 'Must preserve 0 0 84 64 viewBox');
      assert.ok(logoContent.includes('fill="#126DFB"'), 'Must include #126DFB path');
      assert.ok(logoContent.includes('fill="#24BDD9"'), 'Must include #24BDD9 path');
      assert.ok(logoContent.includes('fill="#3848C9"'), 'Must include #3848C9 path');

      // Logo in AuthView must preserve aspect ratio without distortion
      assert.ok(
        authViewContent.includes('preserveAspectRatio="xMidYMid meet"'),
        'Must set preserveAspectRatio="xMidYMid meet" to prevent distortion'
      );

      // Appropriate balanced dimensions
      assert.ok(
        authViewContent.includes("width: '42px', height: '32px'") ||
        authViewContent.includes('w-11') ||
        authViewContent.includes('w-[42px]'),
        'Must use balanced dimensions matching 84:64 proportions'
      );
    });
  });

  // =========================================================================
  // 2. Remove Input Borders and Box Shadows
  // =========================================================================
  describe('2. Borderless & Shadowless Input Fields', () => {
    test('Input component supports borderless variant with transparent border and no box shadows', () => {
      // InputProps interface has variant
      assert.ok(
        inputContent.includes("variant?: 'default' | 'borderless';"),
        'InputProps must define optional variant'
      );

      // Default value is 'default'
      assert.ok(
        inputContent.includes("variant = 'default'"),
        'variant must default to "default"'
      );

      // Borderless input removes visible borders
      assert.ok(
        inputContent.includes("'border border-transparent hover:border-transparent focus:border-transparent'"),
        'Borderless inputs must use transparent borders to eliminate visible outlines'
      );

      // Borderless input removes box shadows and glow rings
      assert.ok(
        inputContent.includes("focus:ring-0 focus:shadow-none"),
        'Borderless inputs must disable focus ring and box shadow'
      );
      assert.ok(
        inputContent.includes("shadow-none"),
        'Borderless inputs must have shadow-none'
      );
    });

    test('preserves subtle focus background transition and keyboard accessibility indicator', () => {
      // Subtle background color transition on focus
      assert.ok(
        inputContent.includes("bg-canvas/50 hover:bg-canvas/70 focus:bg-canvas"),
        'Must provide subtle background-color change on hover and focus'
      );

      // Keyboard accessibility focus-visible ring
      assert.ok(
        inputContent.includes("focus-visible:ring-1 focus-visible:ring-brand-primary/50"),
        'Must preserve keyboard focus-visible accessibility ring'
      );
    });

    test('applies borderless styling to all required inputs in Login and Signup', () => {
      // Must configure inputs with variant="borderless"
      const borderlessMatches = authViewContent.match(/variant="borderless"/g);
      assert.equal(
        borderlessMatches?.length,
        5,
        'All 5 authentication inputs (Full Name, Company, Email, Password, Confirm Password) must use variant="borderless"'
      );

      // Verify each individual input field has borderless styling
      assert.ok(
        authViewContent.includes('label="Full Name"') &&
        authViewContent.includes('label="Company / Workspace Name"') &&
        authViewContent.includes('label="Work Email"') &&
        authViewContent.includes('label="Password"') &&
        authViewContent.includes('label="Confirm Password"'),
        'All 5 input labels must be present'
      );
    });

    test('preserves input dimensions, padding, rightElement toggles, and card shadow', () => {
      // Input height remains h-9
      assert.ok(inputContent.includes('h-9'), 'Input height h-9 preserved');

      // Password visibility toggle button preserved in AuthView
      assert.ok(
        authViewContent.includes('setShowPassword(!showPassword)'),
        'Password visibility toggle handler preserved'
      );
      assert.ok(
        authViewContent.includes('<EyeOff') && authViewContent.includes('<Eye'),
        'Password visibility icons preserved'
      );

      // Auth card styling preserved: shadow-overlay, border, rounded-2xl
      assert.ok(
        authViewContent.includes('shadow-overlay'),
        'Auth card shadow-overlay must be preserved'
      );
      assert.ok(
        authViewContent.includes('border border-border-subtle'),
        'Auth card border must be preserved'
      );
      assert.ok(
        authViewContent.includes('bg-surface rounded-2xl'),
        'Auth card background and rounded corners must be preserved'
      );
    });
  });

  // =========================================================================
  // 3. Preservation of Authentication Logic & Other Forms
  // =========================================================================
  describe('3. Component Isolation & Unaltered Application Forms', () => {
    test('non-auth forms retain standard bordered styling by default', () => {
      assert.ok(
        inputContent.includes("'border border-border hover:border-border-strong'"),
        'Standard inputs still receive default border and hover border'
      );
      assert.ok(
        inputContent.includes("'focus:ring-1 focus:ring-brand-primary focus:border-brand-primary'"),
        'Standard inputs still receive default focus ring and border highlight'
      );
    });

    test('preserves all authentication form buttons, links, and validation logic', () => {
      assert.ok(authViewContent.includes('classifyAuthError'), 'classifyAuthError preserved');
      assert.ok(authViewContent.includes('handleAuthSubmit'), 'handleAuthSubmit preserved');
      assert.ok(authViewContent.includes('handleSwitchMode'), 'handleSwitchMode preserved');
      assert.ok(authViewContent.includes('#/forgot-password'), 'Forgot password link preserved');
      assert.ok(authViewContent.includes('<ThemeToggle />'), 'Theme toggle preserved');
      assert.ok(authViewContent.includes('Sign in to TaskFlow Pro'), 'Login heading preserved');
      assert.ok(authViewContent.includes('Create your TaskFlow account'), 'Signup heading preserved');
    });
  });
});

