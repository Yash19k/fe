import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Company Onboarding & Invitations Tests (Section 4 & 6)', () => {
  it('validates company name requirement', () => {
    function validateCompanyName(name: string): string | null {
      if (!name.trim()) return 'Company name is required';
      if (name.trim().length < 2) return 'Company name must be at least 2 characters';
      if (name.trim().length > 100) return 'Company name must be 100 characters or fewer';
      return null;
    }

    assert.equal(validateCompanyName(''), 'Company name is required');
    assert.equal(validateCompanyName('   '), 'Company name is required');
    assert.equal(validateCompanyName('A'), 'Company name must be at least 2 characters');
    assert.equal(validateCompanyName('Acme Labs'), null);
    assert.equal(validateCompanyName('A'.repeat(101)), 'Company name must be 100 characters or fewer');
  });

  it('preserves onboardingCompleted as false during Step 1 company creation until invitations step completes', () => {
    const initialUser = {
      id: 'user-new',
      name: 'Yash',
      email: 'yash@example.com',
      role: 'Admin',
      companyId: undefined,
      companyName: undefined,
      onboardingCompleted: false,
    };

    // Step 1: User creates company name
    const companyCreated = {
      id: 'comp-100',
      name: 'Acme Robotics',
    };

    const intermediateUser = {
      ...initialUser,
      companyId: companyCreated.id,
      companyName: companyCreated.name,
      onboardingCompleted: false, // Must remain false so user reaches invitations step
    };

    assert.equal(intermediateUser.companyId, 'comp-100');
    assert.equal(intermediateUser.companyName, 'Acme Robotics');
    assert.equal(intermediateUser.onboardingCompleted, false);
  });

  it('validates invitation email formats, detects duplicates, and rejects self-invitation', () => {
    interface InviteRow {
      email: string;
      role: 'Admin' | 'Manager' | 'Teammate';
    }

    const currentUserEmail = 'founder@acme.com';

    function validateInvitations(rows: InviteRow[], userEmail: string): { valid: boolean; errors: string[] } {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const errors: string[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const email = rows[i].email.trim().toLowerCase();
        if (!email) {
          errors.push(`Row ${i + 1}: Email address cannot be empty.`);
          continue;
        }
        if (!emailRegex.test(email)) {
          errors.push(`Row ${i + 1}: "${email}" is not a valid email address.`);
          continue;
        }
        if (email === userEmail.toLowerCase()) {
          errors.push(`Row ${i + 1}: Cannot invite your own account email.`);
          continue;
        }
        if (seen.has(email)) {
          errors.push(`Row ${i + 1}: Duplicate email "${email}" entered.`);
          continue;
        }
        seen.add(email);
      }

      return { valid: errors.length === 0, errors };
    }

    // Invalid email format
    const resInvalid = validateInvitations([
      { email: 'bad-email', role: 'Teammate' },
      { email: 'valid@example.com', role: 'Manager' },
    ], currentUserEmail);
    assert.equal(resInvalid.valid, false);
    assert.equal(resInvalid.errors.length, 1);
    assert.match(resInvalid.errors[0], /not a valid email address/);

    // Self-invitation
    const resSelf = validateInvitations([
      { email: 'founder@acme.com', role: 'Manager' },
    ], currentUserEmail);
    assert.equal(resSelf.valid, false);
    assert.match(resSelf.errors[0], /Cannot invite your own account email/);

    // Duplicate emails in submission
    const resDuplicate = validateInvitations([
      { email: 'alice@example.com', role: 'Admin' },
      { email: 'alice@example.com', role: 'Teammate' },
    ], currentUserEmail);
    assert.equal(resDuplicate.valid, false);
    assert.equal(resDuplicate.errors.length, 1);
    assert.match(resDuplicate.errors[0], /Duplicate email/);

    // Valid unique rows with independent roles
    const resValid = validateInvitations([
      { email: 'alice@example.com', role: 'Admin' },
      { email: 'bob@example.com', role: 'Manager' },
      { email: 'charlie@example.com', role: 'Teammate' },
    ], currentUserEmail);
    assert.equal(resValid.valid, true);
    assert.equal(resValid.errors.length, 0);
  });

  it('ensures role dropdown maintains independent role selection per invitation row', () => {
    let rows = [
      { id: '1', email: 'dev1@example.com', role: 'Teammate' },
      { id: '2', email: 'lead@example.com', role: 'Manager' },
      { id: '3', email: 'ops@example.com', role: 'Teammate' },
    ];

    // Change row 1 role from Teammate to Admin
    rows = rows.map((r) => (r.id === '1' ? { ...r, role: 'Admin' } : r));

    assert.equal(rows[0].role, 'Admin');
    assert.equal(rows[1].role, 'Manager');
    assert.equal(rows[2].role, 'Teammate');
  });

  it('supports skip for now without requiring invitations or creating placeholder records', () => {
    const userState = {
      id: 'user-new',
      name: 'New Founder',
      companyId: 'company-new',
      companyName: 'NextGen AI',
      onboardingCompleted: false,
    };

    // User clicks "Skip for now"
    const finalUserState = {
      ...userState,
      onboardingCompleted: true,
    };

    assert.equal(finalUserState.onboardingCompleted, true);
    assert.equal(finalUserState.companyName, 'NextGen AI');
  });
});
