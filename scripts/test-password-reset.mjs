import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPasswordResetEmail,
  canIssuePasswordReset,
  passwordResetPathForRole,
} from '../lib/password-reset.js';

test('password reset is issued for clients, employees, sales and developers', () => {
  assert.equal(canIssuePasswordReset('client'), true);
  assert.equal(canIssuePasswordReset('employee'), true);
  assert.equal(canIssuePasswordReset('sales'), true);
  assert.equal(canIssuePasswordReset('developer'), true);
  assert.equal(canIssuePasswordReset('none'), false);
  assert.equal(canIssuePasswordReset('admin'), false);
});

test('clients land on the customer reset page, staff on the employee reset page', () => {
  assert.equal(passwordResetPathForRole('client'), '/login/kunde/reset-password');
  assert.equal(passwordResetPathForRole('employee'), '/login/reset-password');
  assert.equal(passwordResetPathForRole('sales'), '/login/reset-password');
  assert.equal(passwordResetPathForRole('developer'), '/login/reset-password');
  assert.equal(passwordResetPathForRole('none'), null);
});

test('reset mail includes the working reset URL', () => {
  const clientMail = buildPasswordResetEmail({
    role: 'client',
    resetUrl: 'https://asoldi.com/login/kunde/reset-password?token=abc',
  });
  assert.match(clientMail.subject, /Kundeportal/);
  assert.match(clientMail.text, /kundeportalen/);
  assert.match(clientMail.html, /login\/kunde\/reset-password\?token=abc/);

  const staffMail = buildPasswordResetEmail({
    role: 'employee',
    resetUrl: 'https://asoldi.com/login/reset-password?token=xyz',
  });
  assert.equal(staffMail.subject, 'Tilbakestill passord – Asoldi');
  assert.match(staffMail.html, /login\/reset-password\?token=xyz/);
  assert.doesNotMatch(staffMail.text, /kundeportalen/);
});
