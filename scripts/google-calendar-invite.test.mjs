import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventSummary,
  buildGoogleCalendarInvitationSubject,
  buildMeetingAttendees,
  calendarInviteLeadMs,
  firefliesNotetakerEmail,
} from '../lib/google-calendar.js';

const client = {
  businessName: 'Test Bakeri',
  contactPerson: 'Damian',
  contactEmail: 'daracha777@gmail.com',
  meetingMode: 'online',
  meetingAt: '2026-09-21T08:00:00.000Z',
};

test('silent calendar creates do not include the guest', () => {
  assert.deepEqual(buildMeetingAttendees(client, { includeAttendees: false }), []);
});

test('invite send includes the guest as needsAction', () => {
  const attendees = buildMeetingAttendees(client, { includeAttendees: true });
  assert.equal(attendees.length, 1);
  assert.equal(attendees[0].email, 'daracha777@gmail.com');
  assert.equal(attendees[0].responseStatus, 'needsAction');
});

test('Fireflies is added only when the sales meeting asks for it', () => {
  const plain = buildMeetingAttendees(client, { includeAttendees: true, includeFireflies: false });
  assert.equal(plain.some((entry) => entry.email.endsWith('@fireflies.ai')), false);
  const withBot = buildMeetingAttendees(client, { includeAttendees: true, includeFireflies: true });
  assert.equal(withBot.length, 2);
  assert.equal(withBot[1].email, firefliesNotetakerEmail());
  const botOnly = buildMeetingAttendees(client, { includeAttendees: false, includeFireflies: true });
  assert.equal(botOnly.length, 1);
  assert.equal(botOnly[0].email, firefliesNotetakerEmail());
});

test('Google invitation subject matches Gmail’s invite prefix', () => {
  const summary = buildEventSummary(client);
  const subject = buildGoogleCalendarInvitationSubject(client, 'Europe/Oslo');
  assert.match(summary, /Online møte/);
  assert.match(subject, /^Invitasjon: Asoldi · Online møte · Test Bakeri @ /);
});

test('calendar invite lead defaults to 8s and can be disabled', () => {
  const previous = process.env.CALENDAR_INVITE_LEAD_MS;
  delete process.env.CALENDAR_INVITE_LEAD_MS;
  assert.equal(calendarInviteLeadMs(), 8000);
  process.env.CALENDAR_INVITE_LEAD_MS = '0';
  assert.equal(calendarInviteLeadMs(), 0);
  if (previous == null) delete process.env.CALENDAR_INVITE_LEAD_MS;
  else process.env.CALENDAR_INVITE_LEAD_MS = previous;
});
