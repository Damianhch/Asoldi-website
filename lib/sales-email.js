function sanitize(value = '') {
  return String(value ?? '').trim();
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractFirstName(name = '') {
  const clean = sanitize(name);
  if (!clean) return 'der';
  return clean.split(/\s+/)[0] || 'der';
}

function formatMeetingDate(iso) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'Avtales nærmere';
  return new Date(ms).toLocaleString('nb-NO', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function isInPerson(client) {
  return sanitize(client?.meetingMode) === 'in-person';
}

function meetingDurationMinutes(client) {
  const value = Number(client?.meetingDurationMinutes || 0);
  if (Number.isFinite(value) && value > 0) return Math.round(value);
  return 30;
}

function buildMapsUrl(client) {
  if (!isInPerson(client)) return '';
  const query = sanitize(client?.meetingPlace);
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildMeetingCoreLines(client) {
  return [
    `Tid: ${formatMeetingDate(client?.meetingAt)}`,
    `Varighet: ca. ${meetingDurationMinutes(client)} minutter`,
  ];
}

function buildOnlineJoinLine(calendar = {}) {
  const meet = sanitize(calendar?.meetLink);
  if (meet) return `Møtelenke: ${meet}`;
  const htmlLink = sanitize(calendar?.htmlLink);
  if (htmlLink) return `Kalenderlenke: ${htmlLink}`;
  return 'Møtelenke sendes i kalenderinvitasjonen.';
}

function buildInPersonAddressLines(client) {
  const lines = [`Adresse: ${sanitize(client?.meetingPlace) || 'Avtales nærmere'}`];
  const mapsUrl = buildMapsUrl(client);
  if (mapsUrl) lines.push(`Kart: ${mapsUrl}`);
  return lines;
}

function linesToHtml(lines = []) {
  const html = lines.map((line) => escapeHtml(line)).join('\n').replace(/\n/g, '<br/>');
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">${html}</div>`;
}

function reminderHorizon(reminderKind = '24h') {
  return reminderKind === '1h' ? 'om 1 time' : 'om 24 timer';
}

export function buildSalesThankYouEmail(client, calendar = {}) {
  const inPerson = isInPerson(client);
  const firstName = extractFirstName(client?.contactPerson);
  const subject = inPerson
    ? `Takk for at du booker møte med oss - fysisk møte${client?.businessName ? ` · ${client.businessName}` : ''}`
    : `Takk for at du booker møte med oss - online møte${client?.businessName ? ` · ${client.businessName}` : ''}`;

  const lines = inPerson
    ? [
        'Takk for at du booker møte med oss',
        '',
        `Hei ${firstName},`,
        '',
        'Da gleder vi oss til å møtes for å gå gjennom mål og neste steg sammen.',
        '',
        ...buildMeetingCoreLines(client),
        ...buildInPersonAddressLines(client),
        '',
        `Da kommer vi til ${sanitize(client?.meetingPlace) || 'avtalt adresse'}.`,
        'Passer ikke tidspunktet, svar på denne e-posten så finner vi en ny tid.',
        '',
        'Vennlig hilsen,',
        'Asoldi',
      ]
    : [
        'Takk for at du booker møte med oss',
        '',
        `Hei ${firstName},`,
        '',
        'Da gleder vi oss til å møtes for å planlegge neste steg sammen.',
        '',
        ...buildMeetingCoreLines(client),
        buildOnlineJoinLine(calendar),
        '',
        'Du mottar kalenderinvitasjon fra Google Calendar i egen e-post.',
        'Passer ikke tidspunktet, svar på denne e-posten så finner vi en ny tid.',
        '',
        'Vennlig hilsen,',
        'Asoldi',
      ];

  return {
    subject,
    text: lines.join('\n'),
    html: linesToHtml(lines),
  };
}

export function buildSalesReminderEmail(client, calendar = {}, reminderKind = '24h') {
  const inPerson = isInPerson(client);
  const firstName = extractFirstName(client?.contactPerson);
  const horizon = reminderHorizon(reminderKind);
  const subject = inPerson
    ? `Påminnelse: Fysisk møte med Asoldi ${horizon}`
    : `Påminnelse: Online møte med Asoldi ${horizon}`;

  const lines = inPerson
    ? [
        `Hei ${firstName},`,
        '',
        `Kort påminnelse: møtet vårt starter ${horizon}.`,
        '',
        ...buildMeetingCoreLines(client),
        ...buildInPersonAddressLines(client),
        '',
        `Vi sees på ${sanitize(client?.meetingPlace) || 'avtalt adresse'}. Gi beskjed hvis du vil flytte møtet.`,
        '',
        'Vennlig hilsen,',
        'Asoldi',
      ]
    : [
        `Hei ${firstName},`,
        '',
        `Kort påminnelse: online-møtet vårt starter ${horizon}.`,
        '',
        ...buildMeetingCoreLines(client),
        buildOnlineJoinLine(calendar),
        '',
        'Gi beskjed hvis du vil flytte møtet.',
        '',
        'Vennlig hilsen,',
        'Asoldi',
      ];

  return {
    subject,
    text: lines.join('\n'),
    html: linesToHtml(lines),
  };
}
