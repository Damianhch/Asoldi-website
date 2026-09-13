const CLIENT_ROLES = new Set(['client']);
const STAFF_ROLES = new Set(['employee', 'sales', 'developer']);

export function normalizeAccountRole(role = '') {
  return String(role || '').trim().toLowerCase();
}

export function canIssuePasswordReset(role = '') {
  const normalized = normalizeAccountRole(role);
  return CLIENT_ROLES.has(normalized) || STAFF_ROLES.has(normalized);
}

export function isClientResetRole(role = '') {
  return CLIENT_ROLES.has(normalizeAccountRole(role));
}

export function passwordResetPathForRole(role = '') {
  const normalized = normalizeAccountRole(role);
  if (CLIENT_ROLES.has(normalized)) return '/login/kunde/reset-password';
  if (STAFF_ROLES.has(normalized)) return '/login/reset-password';
  return null;
}

export function buildPasswordResetEmail({ role, resetUrl }) {
  const url = String(resetUrl || '');
  const client = isClientResetRole(role);
  const subject = client
    ? 'Tilbakestill passord – Asoldi Kundeportal'
    : 'Tilbakestill passord – Asoldi';
  const where = client ? 'i kundeportalen' : '';
  const text = [
    'Hei,',
    '',
    `Du ba om å tilbakestille passordet ditt${where ? ` ${where}` : ''}. Klikk på lenken under for å velge et nytt passord:`,
    '',
    url,
    '',
    'Lenken utløper om 1 time.',
    '',
    'Hvis du ikke ba om dette, kan du ignorere denne e-posten.',
    '',
    'Med vennlig hilsen,',
    'Asoldi',
  ].join('\n');
  const html = [
    '<p>Hei,</p>',
    `<p>Du ba om å tilbakestille passordet ditt${where ? ` ${where}` : ''}. Klikk på lenken under for å velge et nytt passord:</p>`,
    `<p><a href="${url}">${url}</a></p>`,
    '<p>Lenken utløper om 1 time.</p>',
    '<p>Hvis du ikke ba om dette, kan du ignorere denne e-posten.</p>',
    '<p>Med vennlig hilsen,<br>Asoldi</p>',
  ].join('');
  return { subject, text, html };
}
