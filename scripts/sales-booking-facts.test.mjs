import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBookingFromLead, salesBookingFacts } from '../lib/sales-booking-facts.js';

test('booking facts fall back to the call agent, winner time, meeting day, and list', () => {
  const facts = salesBookingFacts({
    createdAt: '2026-09-01T10:00:00.000Z',
    meetingAt: '2026-09-16T12:00:00.000Z',
    myphoner: {
      leadId: '99',
      listName: 'Oslo restauranter',
      latestCallUserEmail: 'kari@asoldi.com',
      lastWinnerWebhookAt: '2026-09-10T08:00:00.000Z',
    },
  });
  assert.equal(facts.booker, 'kari@asoldi.com');
  assert.equal(facts.bookedAt, '2026-09-10T08:00:00.000Z');
  assert.equal(facts.meetingFor, '2026-09-16T12:00:00.000Z');
  assert.equal(facts.listName, 'Oslo restauranter');
});

test('stored booker name wins over the call email', () => {
  const facts = salesBookingFacts({
    myphoner: {
      bookedByName: 'Kari',
      bookedByEmail: 'kari@asoldi.com',
      latestCallUserEmail: 'other@asoldi.com',
    },
  });
  assert.equal(facts.booker, 'Kari');
});

test('lead extract prefers the winner agent over a later claim and call', () => {
  const extracted = extractBookingFromLead({
    list_name: 'Bergen',
    list_location: '/api/v2/lists/42',
    claimed_by: 'later@asoldi.com',
    events: [
      {
        kind: 'winner',
        created_at: '2026-09-02T09:00:00.000Z',
        user: { email: 'booker@asoldi.com', first_name: 'Kari', last_name: 'Nord' },
      },
      {
        kind: 'winner',
        created_at: '2026-09-05T09:00:00.000Z',
        user_email: 'second@asoldi.com',
      },
    ],
  }, { user_email: 'call@asoldi.com' });
  assert.equal(extracted.bookedByEmail, 'booker@asoldi.com');
  assert.equal(extracted.bookedByName, 'Kari Nord');
  assert.equal(extracted.bookedAt, '2026-09-02T09:00:00.000Z');
  assert.equal(extracted.listName, 'Bergen');
  assert.equal(extracted.listId, '42');
});

test('lead extract uses claimed_by, then the call, when the winner event has no user', () => {
  const fromClaim = extractBookingFromLead({ claimed_by: 'kari@asoldi.com', last_event: { kind: 'winner' } });
  assert.equal(fromClaim.bookedByEmail, 'kari@asoldi.com');
  const fromCall = extractBookingFromLead({ last_event: { kind: 'winner', created_at: '2026-09-03T11:30:00.000Z' } }, {
    userEmail: 'call@asoldi.com',
  });
  assert.equal(fromCall.bookedByEmail, 'call@asoldi.com');
  assert.equal(fromCall.bookedAt, '2026-09-03T11:30:00.000Z');
});
