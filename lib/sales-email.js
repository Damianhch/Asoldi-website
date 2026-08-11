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

function escapeIcsText(value = '') {
  return sanitize(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function escapeIcsParam(value = '') {
  return sanitize(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, ' ')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/:/g, '\\:');
}

function isEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitize(value));
}

function extractFirstName(name = '') {
  const clean = sanitize(name);
  if (!clean) return 'der';
  return clean.split(/\s+/)[0] || 'der';
}

function parseEmailFromHeader(value = '') {
  const raw = sanitize(value);
  if (!raw) return '';
  const bracketMatch = raw.match(/<([^>]+)>/);
  const candidate = sanitize(bracketMatch?.[1] || raw);
  return isEmail(candidate) ? candidate.toLowerCase() : '';
}

function ownerIdToEmail(ownerId = '') {
  const raw = sanitize(ownerId);
  if (!raw) return '';
  if (isEmail(raw)) return raw.toLowerCase();
  const parts = raw.split(':');
  const candidate = sanitize(parts.length > 1 ? parts.slice(1).join(':') : '');
  return isEmail(candidate) ? candidate.toLowerCase() : '';
}

function resolveOrganizerEmail(client, explicitOrganizerEmail = '') {
  const explicit = sanitize(explicitOrganizerEmail);
  if (isEmail(explicit)) return explicit.toLowerCase();
  const fromOwner = ownerIdToEmail(client?.ownerId);
  if (fromOwner) return fromOwner;
  const fromHeader = parseEmailFromHeader(process.env.SMTP_FROM || '');
  if (fromHeader) return fromHeader;
  const fromUser = sanitize(process.env.SMTP_USER || '');
  if (isEmail(fromUser)) return fromUser.toLowerCase();
  return 'kontakt@asoldi.com';
}

function formatMeetingDate(iso) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'Avtales nærmere';
  return new Date(ms).toLocaleString('nb-NO', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function formatIcsDate(iso) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (v) => String(v).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
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

function isRealMeetLink(value = '') {
  const url = sanitize(value);
  if (!/^https:\/\/meet\.google\.com\//i.test(url)) return false;
  if (/asoldi-(sim|email)-test|lookup\/asoldi/i.test(url)) return false;
  return /meet\.google\.com\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/i.test(url);
}

function buildOnlineJoinLine(calendar = {}) {
  const meet = sanitize(calendar?.meetLink);
  if (isRealMeetLink(meet)) return `Møtelenke: ${meet}`;
  const htmlLink = sanitize(calendar?.htmlLink);
  if (htmlLink) return `Kalenderlenke: ${htmlLink}`;
  return 'Møtelenke mangler — kontakt Asoldi hvis du ikke har fått Google Meet-lenke.';
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

function buildInviteUid(client, calendar = {}, organizerEmail = '') {
  const eventId = sanitize(calendar?.eventId);
  if (eventId) return `${eventId}@asoldi-calendar`;
  const baseId = sanitize(client?.id) || 'sales-meeting';
  const when = sanitize(client?.meetingAt).replace(/[^0-9TZ]/g, '') || String(Date.now());
  const host = sanitize(organizerEmail).replace(/[^a-zA-Z0-9.-]/g, '') || 'asoldi.com';
  return `${baseId}-${when}@${host}`;
}

function buildOnlineCalendarInvite(client, calendar = {}, options = {}) {
  if (isInPerson(client)) return null;
  const meetLink = sanitize(calendar?.meetLink);
  // Never attach a calendar invite without a real Meet URL (blocks fake test links).
  if (!isRealMeetLink(meetLink)) return null;
  const attendeeEmail = sanitize(client?.contactEmail).toLowerCase();
  if (!isEmail(attendeeEmail)) return null;
  const startIso = sanitize(client?.meetingAt);
  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) return null;

  const organizerEmail = resolveOrganizerEmail(client, options?.organizerEmail);
  const organizerName = sanitize(options?.organizerName) || 'Asoldi';
  const attendeeName = sanitize(client?.contactPerson) || sanitize(client?.businessName) || attendeeEmail;
  const duration = meetingDurationMinutes(client);
  const endMs = startMs + duration * 60 * 1000;
  const summary = `${sanitize(client?.businessName) || 'Kunde'} · Online møte med Asoldi`;
  const description = [
    'Takk for at du booker møte med oss.',
    `Kontaktperson: ${sanitize(client?.contactPerson) || '—'}`,
    `Bedrift: ${sanitize(client?.businessName) || '—'}`,
    `Varighet: ca. ${duration} minutter`,
    `Google Meet: ${meetLink}`,
    sanitize(calendar?.htmlLink) ? `Kalenderlenke: ${sanitize(calendar.htmlLink)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Asoldi//Sales Meeting Invite//NO',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(buildInviteUid(client, calendar, organizerEmail))}`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART:${formatIcsDate(startIso)}`,
    `DTEND:${formatIcsDate(new Date(endMs).toISOString())}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(meetLink)}`,
    `ORGANIZER;CN=${escapeIcsParam(organizerName)}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsParam(attendeeName)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${attendeeEmail}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    sanitize(calendar?.htmlLink) ? `URL:${escapeIcsText(sanitize(calendar.htmlLink))}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return {
    method: 'REQUEST',
    filename: 'asoldi-online-mote.ics',
    content: `${icsLines.join('\r\n')}\r\n`,
  };
}

function buildInviteTransportPayload(invite = null) {
  if (!invite || !sanitize(invite.content)) return {};
  const method = sanitize(invite.method || 'REQUEST') || 'REQUEST';
  const filename = sanitize(invite.filename || 'asoldi-online-mote.ics') || 'asoldi-online-mote.ics';
  const content = String(invite.content);
  return {
    icalEvent: {
      method,
      content,
    },
    attachments: [
      {
        filename,
        content,
        contentType: `text/calendar; method=${method}; charset=UTF-8`,
        contentDisposition: 'attachment',
      },
    ],
    headers: {
      'Content-Class': 'urn:content-classes:calendarmessage',
    },
  };
}

function reminderHorizon(reminderKind = '24h') {
  return reminderKind === '1h' ? 'om 1 time' : 'om 24 timer';
}

export function buildSalesThankYouEmail(client, calendar = {}, options = {}) {
  const inPerson = isInPerson(client);
  const firstName = extractFirstName(client?.contactPerson);
  const invite = inPerson ? null : buildOnlineCalendarInvite(client, calendar, options);
  const invitePayload = buildInviteTransportPayload(invite);
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
        'Kalenderinvitasjon er lagt ved i denne e-posten.',
        'Trykk Godta/Accept i kalenderen for å bekrefte møtet.',
        'Passer ikke tidspunktet, svar på denne e-posten så finner vi en ny tid.',
        '',
        'Vennlig hilsen,',
        'Asoldi',
      ];

  return {
    subject,
    text: lines.join('\n'),
    html: linesToHtml(lines),
    icalEvent: invitePayload.icalEvent,
    attachments: invitePayload.attachments,
    headers: invitePayload.headers,
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
        'Har du ikke gjort det ennå, kan du godta kalenderinvitasjonen direkte fra e-posten.',
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
