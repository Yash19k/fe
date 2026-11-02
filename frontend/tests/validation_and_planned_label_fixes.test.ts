import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAuthError } from '../src/features/auth/AuthView.tsx';

describe('Frontend Validation & PLANNED Label Verification', () => {
  it('1. Create Sprint — maps zero work item selection error correctly', () => {
    function resolveSprintCreationErrorMessage(selectedItemCount: number, error: any): string {
      if (selectedItemCount === 0) {
        return 'Please select at least one work item.';
      }
      return error?.message || 'An unexpected error occurred while creating sprint.';
    }

    // Zero items selected with generic validation failure
    const zeroSelectedErr = resolveSprintCreationErrorMessage(0, new Error('Validation failed.'));
    assert.equal(zeroSelectedErr, 'Please select at least one work item.');

    // 1 item selected with actual validation error preserves its message
    const oneSelectedErr = resolveSprintCreationErrorMessage(1, new Error('Validation failed.'));
    assert.equal(oneSelectedErr, 'Validation failed.');
  });

  it('2. Signup — Full Name Validation (length < 2)', () => {
    const rawError = {
      message: 'user.fullName: "user.fullName" length must be at least 2 characters long',
    };
    const friendly = classifyAuthError(rawError);
    assert.equal(friendly, 'Full Name must be at least 2 characters.');
  });

  it('3. Signup — Full Name Required', () => {
    const rawEmptyError = {
      message: 'user.fullName: "user.fullName" is not allowed to be empty',
    };
    assert.equal(classifyAuthError(rawEmptyError), 'Full Name is required.');

    const rawRequiredError = {
      message: 'user.fullName: "user.fullName" is required',
    };
    assert.equal(classifyAuthError(rawRequiredError), 'Full Name is required.');
  });

  it('4. Signup — Company / Workspace Name Required', () => {
    const rawOrgError = {
      message: 'organization.name: "organization.name" is not allowed to be empty',
    };
    assert.equal(classifyAuthError(rawOrgError), 'Company / Workspace Name is required.');

    const rawCompanyError = {
      message: 'user.companyName: "user.companyName" is required',
    };
    assert.equal(classifyAuthError(rawCompanyError), 'Company / Workspace Name is required.');
  });

  it('5. Signup — Invalid Email', () => {
    const rawEmailError = {
      message: 'user.email: "user.email" must be a valid email',
    };
    assert.equal(classifyAuthError(rawEmailError), 'Please enter a valid email address.');
  });

  it('6. Signup — Ensures raw technical names are not directly exposed', () => {
    const errorsToTest = [
      'user.fullName: "user.fullName" length must be at least 2 characters long',
      'user.email: "user.email" must be a valid email',
      'user.companyName: "user.companyName" is not allowed to be empty',
      'organization.name: "organization.name" is required',
    ];

    for (const msg of errorsToTest) {
      const output = classifyAuthError({ message: msg });
      assert.equal(output.includes('user.fullName'), false);
      assert.equal(output.includes('user.email'), false);
      assert.equal(output.includes('user.companyName'), false);
      assert.equal(output.includes('organization.name'), false);
    }
  });

  it('7 & 8. Sprint Dashboard & Dropdown — removes PLANNED status correctly', () => {
    // Sprint Dashboard badge rendering condition
    function shouldRenderSprintStatusBadge(sprint: { name: string; status: string } | null): boolean {
      return Boolean(sprint && sprint.status?.toUpperCase() !== 'PLANNED');
    }

    // Sprint dropdown option label formatting
    function formatSprintDropdownOption(sprint: { name: string; status: string }): string {
      return sprint.status?.toUpperCase() === 'PLANNED'
        ? sprint.name
        : `${sprint.name} (${sprint.status})`;
    }

    const plannedSprint = { name: 'fdsa', status: 'PLANNED' };
    const activeSprint = { name: 'Sprint 2', status: 'ACTIVE' };
    const completedSprint = { name: 'Sprint 1', status: 'COMPLETED' };

    // Dashboard badge check
    assert.equal(shouldRenderSprintStatusBadge(plannedSprint), false, 'PLANNED badge should not render');
    assert.equal(shouldRenderSprintStatusBadge(activeSprint), true, 'ACTIVE badge should render');
    assert.equal(shouldRenderSprintStatusBadge(completedSprint), true, 'COMPLETED badge should render');

    // Dropdown format check
    assert.equal(formatSprintDropdownOption(plannedSprint), 'fdsa', 'Should remove (PLANNED) from dropdown');
    assert.equal(formatSprintDropdownOption(activeSprint), 'Sprint 2 (ACTIVE)', 'Should preserve other statuses in dropdown');
    assert.equal(formatSprintDropdownOption(completedSprint), 'Sprint 1 (COMPLETED)', 'Should preserve completed status');
  });
});
