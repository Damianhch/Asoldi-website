import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNextActionMutation,
  applyProgressionChange,
  classifyNextActionBucket,
  decorateNextActions,
  defaultAddToCalendar,
  getActiveNextAction,
  getClientNextActionMs,
  getCurrentGoalKey,
  getRemainingGoalCount,
  getVisibleGoalKeys,
  groupSalesClientsByNextAction,
  inferMeetingHeld,
  salesProgressBlockedReason,
  suggestedDueAtForPreset,
} from '../lib/sales-next-actions.js';

const HOUR_MS = 60 * 60 * 1000;
const MEETING_AT = '2026-09-20T14:00:00.000Z';

function client(overrides = {}) {
  return {
    id: 'c1',
    product: 'asoldi',
    businessName: 'Test AS',
    agreedTime: true,
    meetingAt: MEETING_AT,
    progression: {
      meetingHeld: false,
      offerSent: false,
      contractSigned: false,
      paymentReceived: false,
    },
    nextActions: [],
    ...overrides,
    progression: {
      meetingHeld: false,
      offerSent: false,
      contractSigned: false,
      paymentReceived: false,
      ...(overrides.progression || {}),
    },
  };
}

test('booking a meeting does not mark møtet hatt', () => {
  assert.equal(inferMeetingHeld({}), false);
  const decorated = decorateNextActions(client());
  assert.equal(decorated.some((action) => action.presetKey === 'meeting' && !action.doneAt), true);
  assert.equal(getCurrentGoalKey(client()), 'meetingHeld');
});

test('møtet hatt is inferred only after later goals already happened', () => {
  assert.equal(inferMeetingHeld({ offerSent: true }), true);
  assert.equal(inferMeetingHeld({ meetingHeld: false, offerSent: true }), false);
});

test('SMS 24h and Call 2h sit exactly before the meeting', () => {
  const row = client();
  const sms = suggestedDueAtForPreset('sms24h', row);
  const call = suggestedDueAtForPreset('call2h', row);
  assert.equal(Date.parse(sms), Date.parse(MEETING_AT) - 24 * HOUR_MS);
  assert.equal(Date.parse(call), Date.parse(MEETING_AT) - 2 * HOUR_MS);
});

test('send tilbud defaults to one hour from now', () => {
  const now = Date.parse('2026-09-17T10:00:00.000Z');
  const due = suggestedDueAtForPreset('sendOffer', client(), now);
  assert.equal(Date.parse(due), now + HOUR_MS);
});

test('creating SMS 24h keeps it tied to meeting time until edited', () => {
  const created = applyNextActionMutation(client(), {
    op: 'create',
    goalKey: 'meetingHeld',
    presetKey: 'sms24h',
    name: 'SMS 24h',
    dueAt: suggestedDueAtForPreset('sms24h', client()),
  });
  assert.equal(created.error, undefined);
  const sms = created.nextActions.find((action) => action.presetKey === 'sms24h');
  assert.equal(sms.relativeToMeetingHours, 24);
  const movedMeeting = decorateNextActions({
    ...client({ meetingAt: '2026-09-21T14:00:00.000Z' }),
    nextActions: created.nextActions,
  });
  const movedSms = movedMeeting.find((action) => action.presetKey === 'sms24h');
  assert.equal(Date.parse(movedSms.dueAt), Date.parse('2026-09-21T14:00:00.000Z') - 24 * HOUR_MS);
});

test('editing a sub-step time stops following the meeting', () => {
  const created = applyNextActionMutation(client(), {
    op: 'create',
    goalKey: 'meetingHeld',
    presetKey: 'sms24h',
    name: 'SMS 24h',
    dueAt: suggestedDueAtForPreset('sms24h', client()),
  });
  const sms = created.nextActions.find((action) => action.presetKey === 'sms24h');
  const customDue = '2026-09-18T09:00:00.000Z';
  const updated = applyNextActionMutation(
    { ...client(), nextActions: created.nextActions },
    { op: 'update', id: sms.id, name: sms.name, dueAt: customDue }
  );
  const after = updated.nextActions.find((action) => action.id === sms.id);
  assert.equal(after.relativeToMeetingHours, null);
  assert.equal(after.dueAt, customDue);
});

test('next action ranks the client, not raw meeting time', () => {
  const withSms = applyNextActionMutation(client(), {
    op: 'create',
    goalKey: 'meetingHeld',
    presetKey: 'sms24h',
    name: 'SMS 24h',
    dueAt: suggestedDueAtForPreset('sms24h', client()),
  });
  const ranked = { ...client(), nextActions: withSms.nextActions };
  const active = getActiveNextAction(ranked);
  assert.equal(active.presetKey, 'sms24h');
  assert.equal(getClientNextActionMs(ranked), Date.parse(MEETING_AT) - 24 * HOUR_MS);
});

test('recent overdue stays above upcoming for 48 hours, then drops to past due', () => {
  const now = Date.parse('2026-09-17T12:00:00.000Z');
  const upcomingClient = client({
    id: 'up',
    businessName: 'Upcoming',
    meetingAt: '2026-09-18T12:00:00.000Z',
  });
  const recentClient = client({
    id: 'recent',
    businessName: 'Recent overdue',
    meetingAt: '2026-09-17T10:00:00.000Z',
  });
  const overdueClient = client({
    id: 'late',
    businessName: 'Overdue',
    meetingAt: '2026-09-14T12:00:00.000Z',
  });
  const unsetClient = client({
    id: 'none',
    businessName: 'No date',
    agreedTime: false,
    meetingAt: '',
  });
  const grouped = groupSalesClientsByNextAction(
    [unsetClient, overdueClient, recentClient, upcomingClient].map((row) => ({ ...row, nextActions: decorateNextActions(row) })),
    now
  );
  assert.deepEqual(grouped.recentPastDue.map((row) => row.id), ['recent']);
  assert.deepEqual(grouped.upcoming.map((row) => row.id), ['up']);
  assert.deepEqual(grouped.pastDue.map((row) => row.id), ['late']);
  assert.deepEqual(grouped.noNextAction.map((row) => row.id), ['none']);
  assert.equal(classifyNextActionBucket(unsetClient, now), 'noNextAction');
});

test('meeting and offer follow-up reminders default onto Google Calendar', () => {
  assert.equal(defaultAddToCalendar('meeting', client()), true);
  assert.equal(defaultAddToCalendar('sms24h', client()), false);
  assert.equal(defaultAddToCalendar('checkIn', client()), false);
  assert.equal(defaultAddToCalendar('checkIn', client({ progression: { offerSent: true } })), true);
  const afterMeeting = client({ progression: { meetingHeld: true } });
  const checkIn = applyNextActionMutation(afterMeeting, {
    op: 'create',
    goalKey: 'offerSent',
    presetKey: 'checkIn',
    name: 'Oppsjekk',
    dueAt: '2026-09-18T10:00:00.000Z',
    addToCalendar: true,
  });
  assert.equal(checkIn.error, undefined);
  const created = checkIn.nextActions.find((action) => action.presetKey === 'checkIn');
  assert.equal(created.addToCalendar, true);
});

test('future goals stay hidden until the current checkpoint is done', () => {
  const row = client();
  assert.deepEqual(getVisibleGoalKeys(row), ['meetingHeld']);
  assert.equal(getRemainingGoalCount(row), 2);
  const held = applyProgressionChange(row, 'meetingHeld', true);
  const after = { ...row, progression: held.progression, nextActions: held.nextActions };
  assert.deepEqual(getVisibleGoalKeys(after), ['meetingHeld', 'offerSent']);
  assert.equal(getCurrentGoalKey(after), 'offerSent');
  assert.equal(getRemainingGoalCount(after), 1);
});

test('offer and contract cannot skip møtet hatt without fast track', () => {
  const row = client();
  assert.match(salesProgressBlockedReason(row, 'offerSent'), /møtet hatt/i);
  assert.match(salesProgressBlockedReason(row, 'contractSigned'), /møtet hatt/i);
  assert.equal(salesProgressBlockedReason(row, 'contractSigned', { fastTrack: true }), '');
});

test('fast track marks later goals done and opens contract', () => {
  const row = client();
  const result = applyProgressionChange(row, 'contractSigned', true, { fastTrack: true });
  assert.equal(result.error, undefined);
  assert.equal(result.progression.meetingHeld, true);
  assert.equal(result.progression.offerSent, true);
  assert.equal(result.progression.contractSigned, true);
  assert.equal(getCurrentGoalKey({ ...row, progression: result.progression }), '');
});

test('creating a next action requires name, time, and confirm payload', () => {
  const missingName = applyNextActionMutation(client(), {
    op: 'create',
    goalKey: 'meetingHeld',
    presetKey: 'custom',
    name: '',
    dueAt: '2026-09-18T10:00:00.000Z',
  });
  assert.match(missingName.error, /Navn/);
  const missingTime = applyNextActionMutation(client(), {
    op: 'create',
    goalKey: 'meetingHeld',
    presetKey: 'custom',
    name: 'Ring igjen',
    dueAt: '',
  });
  assert.match(missingTime.error, /Tid/);
});

test('oppsjekk 1/2 are not current sales goals', () => {
  const row = client({
    progression: { meetingHeld: true, offerSent: false },
  });
  assert.ok(!getVisibleGoalKeys(row).includes('checkIn1'));
  assert.equal(getCurrentGoalKey(row), 'offerSent');
});
