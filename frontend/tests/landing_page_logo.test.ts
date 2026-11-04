import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const publicDir = path.join(rootDir, 'public');

describe('TaskFlow Pro — Framer Landing Page Logo Integration & Consistency', () => {
  const logoComponentPath = path.join(srcDir, 'landing-page', 'components', 'TaskFlowLogo.tsx');
  const navbarPath = path.join(srcDir, 'landing-page', 'components', 'Navbar.tsx');
  const footerPath = path.join(srcDir, 'landing-page', 'components', 'Footer.tsx');
  const faviconPath = path.join(publicDir, 'favicon.svg');
  const framerHomePath = path.join(rootDir, 'taskflow-react', 'src', 'Home.tsx');

  const logoContent = fs.readFileSync(logoComponentPath, 'utf8');
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');
  const footerContent = fs.readFileSync(footerPath, 'utf8');
  const faviconContent = fs.readFileSync(faviconPath, 'utf8');
  const framerHomeContent = fs.readFileSync(framerHomePath, 'utf8');

  // 1. Correct Framer Logo Source Verification
  describe('1. Exact Logo Identity from Framer Landing Page', () => {
    test('identifies the exact logo SVG symbol paths in the Framer project', () => {
      assert.ok(
        framerHomeContent.includes('d=\\"M4 20C6 11 12 6 23 6H55L51 18H33L25 46C23 55 17 60 8 60L20 20Z\\"'),
        'Framer source must define path 1'
      );
      assert.ok(
        framerHomeContent.includes('d=\\"M48 6H80C78 15 73 20 65 20H54L51 31H70C68 39 63 44 55 44H47L43 60H30L41 22C43 14 48 9 56 6Z\\"'),
        'Framer source must define path 2'
      );
      assert.ok(
        framerHomeContent.includes('d=\\"M48 6H56C54 15 49 20 40 20L42 14C43 10 45 8 48 6Z\\"'),
        'Framer source must define path 3'
      );
      assert.ok(
        framerHomeContent.includes('viewBox=\\"0 0 84 64\\"'),
        'Framer source must specify viewBox 0 0 84 64'
      );
    });

    test('reusable logo component preserves exact Framer icon paths and colors verbatim', () => {
      assert.ok(
        logoContent.includes('viewBox="0 0 84 64"'),
        'Component must preserve 0 0 84 64 viewBox'
      );
      assert.ok(
        logoContent.includes('fill="#126DFB"'),
        'Must preserve #126DFB brand color'
      );
      assert.ok(
        logoContent.includes('fill="#24BDD9"'),
        'Must preserve #24BDD9 brand color'
      );
      assert.ok(
        logoContent.includes('fill="#3848C9"'),
        'Must preserve #3848C9 brand color'
      );
      assert.ok(
        logoContent.includes('d="M4 20C6 11 12 6 23 6H55L51 18H33L25 46C23 55 17 60 8 60L20 20Z"'),
        'Must preserve path 1 vector data'
      );
      assert.ok(
        logoContent.includes('d="M48 6H80C78 15 73 20 65 20H54L51 31H70C68 39 63 44 55 44H47L43 60H30L41 22C43 14 48 9 56 6Z"'),
        'Must preserve path 2 vector data'
      );
      assert.ok(
        logoContent.includes('d="M48 6H56C54 15 49 20 40 20L42 14C43 10 45 8 48 6Z"'),
        'Must preserve path 3 vector data'
      );
    });
  });

  // 2. Desktop Navigation Logo
  describe('2. Desktop Navigation Integration', () => {
    test('renders reusable TaskFlowBrand in desktop navbar with wordmark slot', () => {
      assert.ok(
        navbarContent.includes('import { TaskFlowBrand } from "./TaskFlowLogo"'),
        'Navbar must import reusable TaskFlowBrand component'
      );
      assert.ok(
        navbarContent.includes('<TaskFlowBrand'),
        'Navbar must render TaskFlowBrand component'
      );
      assert.ok(
        navbarContent.includes('variant="nav"'),
        'Navbar must use nav variant'
      );
      assert.ok(
        navbarContent.includes('wordmark={slots[0] ?? "TaskFlow"}'),
        'Navbar must supply slot wordmark'
      );
      assert.ok(
        navbarContent.includes('onClick={handleBrandClick}'),
        'Navbar must hook up smooth-scroll brand click handler'
      );
    });
  });

  // 3. Mobile Navigation Logo
  describe('3. Mobile Navigation Integration', () => {
    test('mobile drawer renders TaskFlowBrand with identical branding', () => {
      assert.ok(
        navbarContent.includes('className="landing-mobile-brand"'),
        'Mobile drawer must provide dedicated brand container'
      );
      // Checks that TaskFlowBrand is invoked for mobile navigation
      const occurrences = (navbarContent.match(/<TaskFlowBrand/g) || []).length;
      assert.equal(
        occurrences,
        2,
        'Navbar must render TaskFlowBrand for both desktop and mobile layouts'
      );
    });
  });

  // 4. Footer Logo
  describe('4. Footer Integration', () => {
    test('renders reusable TaskFlowBrand in footer with dark theme wordmark', () => {
      assert.ok(
        footerContent.includes('import { TaskFlowBrand } from "./TaskFlowLogo"'),
        'Footer must import reusable TaskFlowBrand component'
      );
      assert.ok(
        footerContent.includes('<TaskFlowBrand'),
        'Footer must render TaskFlowBrand component'
      );
      assert.ok(
        footerContent.includes('variant="footer"'),
        'Footer must use footer variant'
      );
      assert.ok(
        footerContent.includes('wordmark={slots[15] ?? "TaskFlow"}'),
        'Footer must supply footer slot wordmark'
      );
    });
  });

  // 5. Standalone Favicon Asset
  describe('5. Favicon Asset Verification', () => {
    test('updates favicon to official Framer flowing TF logo and removes legacy branding', () => {
      assert.doesNotMatch(
        faviconContent,
        /#4f46e5/,
        'Favicon must not contain old purple background'
      );
      assert.doesNotMatch(
        faviconContent,
        />T<\/text>/,
        'Favicon must not contain old letter T text'
      );
      assert.ok(
        faviconContent.includes('viewBox="0 0 84 64"'),
        'Favicon must use official 0 0 84 64 viewBox'
      );
      assert.ok(
        faviconContent.includes('fill="#126DFB"'),
        'Favicon must include #126DFB path'
      );
      assert.ok(
        faviconContent.includes('fill="#24BDD9"'),
        'Favicon must include #24BDD9 path'
      );
      assert.ok(
        faviconContent.includes('fill="#3848C9"'),
        'Favicon must include #3848C9 path'
      );
    });
  });

  // 6. Strict Change Restrictions
  describe('6. Strict Boundaries', () => {
    test('does not alter authenticated application UI files', () => {
      const topbarPath = path.join(srcDir, 'components', 'navigation', 'Topbar.tsx');
      const topbarContent = fs.readFileSync(topbarPath, 'utf8');
      assert.ok(
        topbarContent.includes('export function Topbar({'),
        'Authenticated Topbar must remain untouched'
      );
    });
  });
});
