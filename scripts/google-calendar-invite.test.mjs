import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventSummary,
  buildGoogleCalendarInvitationSubject,
  buildMeetingAttendees,
  calendarInviteLeadMs,
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
