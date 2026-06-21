function sanitize(value = '') {
  return String(value ?? '').trim();
}

function formatMeetingDate(iso) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'TBD';
  return new Date(ms).toLocaleString('nb-NO', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function buildMapsUrl(client) {
  if (sanitize(client?.meetingMode) !== 'in-person') return '';
  const query = sanitize(client?.meetingPlace);
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildBaseLines(client, calendar = {}) {
  const mode = sanitize(client?.meetingMode) === 'in-person' ? 'In person' : 'Online';
  const mapsUrl = buildMapsUrl(client);
  return [
    `Business: ${sanitize(client?.businessName) || '—'}`,
    `Contact person: ${sanitize(client?.contactPerson) || '—'}`,
    `Meeting type: ${mode}`,
    `Meeting time: ${formatMeetingDate(client?.meetingAt)}`,
    `Duration: ${Number(client?.meetingDurationMinutes || 0)} minutes`,
    mode === 'In person'
      ? `Meeting place: ${sanitize(client?.meetingPlace) || '—'}`
      : 'Meeting place: Online (Google Meet)',
    mapsUrl ? `Google Maps: ${mapsUrl}` : '',
    calendar?.htmlLink ? `Calendar event: ${calendar.htmlLink}` : '',
    mode === 'Online' && calendar?.meetLink ? `Google Meet: ${calendar.meetLink}` : '',
  ].filter(Boolean);
}

function buildInfoSnippet() {
  return [
    'About Asoldi:',
    '- We help businesses launch and refine high-converting websites.',
    '- We combine design, development, and sales process support in one workflow.',
    '- We prepare your website handover and launch steps after onboarding.',
  ].join('\n');
}

export function buildSalesThankYouEmail(client, calendar = {}) {
  const isOnline = sanitize(client?.meetingMode) !== 'in-person';
  const subject = isOnline
    ? `Welcome to your online meeting${client?.businessName ? ` · ${client.businessName}` : ''}`
    : `Welcome to your in-person meeting${client?.businessName ? ` · ${client.businessName}` : ''}`;
  const introLines = isOnline
    ? [
        'Thanks for booking an online meeting with us.',
        'Use the Google Meet link below to join at the scheduled time.',
      ]
    : [
        'Thanks for booking an in-person meeting with us.',
        'Please use the meeting place details below when you arrive.',
      ];
  const lines = [
    `Hi ${sanitize(client?.contactPerson) || 'there'},`,
    '',
    ...introLines,
    '',
    ...buildBaseLines(client, calendar),
    '',
    buildInfoSnippet(),
    '',
    'Best regards,',
    'Asoldi Team',
  ];

  const html = lines
    .join('\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  return { subject, text: lines.join('\n'), html: `<div style="font-family:Arial,sans-serif;line-height:1.5">${html}</div>` };
}

export function buildSalesReminderEmail(client, calendar = {}, reminderKind = '24h') {
  const horizon = reminderKind === '1h' ? '1 hour' : '24 hours';
  const subject = `Reminder: Your meeting is in ${horizon}`;
  const lines = [
    `Hi ${sanitize(client?.contactPerson) || 'there'},`,
    '',
    `This is a reminder that your meeting with Asoldi starts in ${horizon}.`,
    '',
    ...buildBaseLines(client, calendar),
    '',
    'If you need to reschedule, please reply to this email as soon as possible.',
    '',
    'Best regards,',
    'Asoldi Team',
  ];

  const html = lines
    .join('\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return { subject, text: lines.join('\n'), html: `<div style="font-family:Arial,sans-serif;line-height:1.5">${html}</div>` };
}
