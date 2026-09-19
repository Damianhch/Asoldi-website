const HOUR_MS = 60 * 60 * 1000;

export const SALES_GOAL_KEYS_ASOLDI = ['meetingHeld', 'offerSent', 'contractSigned'];
export const SALES_GOAL_KEYS_SSU = ['meetingHeld', 'offerSent', 'contractSigned', 'paymentReceived'];

export const GOAL_LABELS = {
  meetingHeld: 'Møtet hatt',
  offerSent: 'Sett tilbud',
  contractSigned: 'Kontrakt signert',
  paymentReceived: 'Betaling mottatt',
  domainConnected: 'Domene koblet',
  live: 'Live',
};

export const PRESET_LABELS = {
  meeting: 'Møte',
  sms24h: 'SMS 24h',
  call2h: 'Call 2h',
  sendOffer: 'Send tilbud',
  checkIn: 'Oppsjekk',
  custom: 'Custom',
};

export const GOAL_PRESETS = {
  meetingHeld: ['sms24h', 'call2h', 'custom'],
  offerSent: ['sendOffer', 'checkIn', 'custom'],
  contractSigned: ['custom'],
  paymentReceived: ['custom'],
};

const RELATIVE_HOURS_BY_PRESET = {
  meeting: 0,
  sms24h: 24,
  call2h: 2,
};

const PRESET_KEYS = new Set(['meeting', 'sms24h', 'call2h', 'sendOffer', 'checkIn', 'custom']);
const GOAL_KEYS = new Set([...SALES_GOAL_KEYS_SSU]);

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function parseMs(value = '') {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function toIso(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString();
}

function makeActionId(prefix = 'na') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isSsuSalesProduct(product = '') {
  return String(product || '').trim().toLowerCase() === 'ssu';
}

export function getSalesGoalKeys(product = '') {
  return isSsuSalesProduct(product) ? [...SALES_GOAL_KEYS_SSU] : [...SALES_GOAL_KEYS_ASOLDI];
}

export function formatGoalLabel(key = '') {
  return GOAL_LABELS[key] || key;
}

export function formatPresetLabel(key = '') {
  return PRESET_LABELS[key] || key;
}

export function relativeHoursForPreset(presetKey = '') {
  return Object.prototype.hasOwnProperty.call(RELATIVE_HOURS_BY_PRESET, presetKey)
    ? RELATIVE_HOURS_BY_PRESET[presetKey]
    : null;
}

export function suggestedDueAtForPreset(presetKey, client, nowMs = Date.now()) {
  const meetingMs = parseMs(client?.meetingAt);
  if (presetKey === 'sms24h' && meetingMs != null) return toIso(meetingMs - 24 * HOUR_MS);
  if (presetKey === 'call2h' && meetingMs != null) return toIso(meetingMs - 2 * HOUR_MS);
  if (presetKey === 'meeting' && meetingMs != null) return toIso(meetingMs);
  if (presetKey === 'sendOffer') return toIso(nowMs + HOUR_MS);
  return '';
}

export function presetNeedsMeeting(presetKey = '') {
  return presetKey === 'sms24h' || presetKey === 'call2h';
}

export function normalizeNextAction(raw = {}, fallbackGoalKey = 'meetingHeld') {
  const input = raw && typeof raw === 'object' ? raw : {};
  const presetKey = PRESET_KEYS.has(sanitizeText(input.presetKey)) ? sanitizeText(input.presetKey) : 'custom';
  const goalKey = GOAL_KEYS.has(sanitizeText(input.goalKey)) ? sanitizeText(input.goalKey) : fallbackGoalKey;
  const hasRelative = Object.prototype.hasOwnProperty.call(input, 'relativeToMeetingHours');
  const relativeRaw = input.relativeToMeetingHours;
  const relativeToMeetingHours = !hasRelative
    ? relativeHoursForPreset(presetKey)
    : relativeRaw === null || relativeRaw === ''
      ? null
      : Number.isFinite(Number(relativeRaw))
        ? Number(relativeRaw)
        : null;
  return {
    id: sanitizeText(input.id) || makeActionId(),
    goalKey,
    presetKey,
    name: sanitizeText(input.name) || formatPresetLabel(presetKey),
    dueAt: sanitizeText(input.dueAt),
    doneAt: sanitizeText(input.doneAt),
    createdAt: sanitizeText(input.createdAt) || new Date().toISOString(),
    relativeToMeetingHours: relativeToMeetingHours == null ? null : relativeToMeetingHours,
    addToCalendar: Object.prototype.hasOwnProperty.call(input, 'addToCalendar')
      ? Boolean(input.addToCalendar)
      : presetKey === 'meeting',
    calendarEventId: sanitizeText(input.calendarEventId),
  };
}

export function normalizeNextActions(value = []) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeNextAction(entry)).filter((entry) => entry.id);
}

export function applyRelativeDueAts(actions = [], meetingAt = '') {
  const meetingMs = parseMs(meetingAt);
  return (Array.isArray(actions) ? actions : []).map((action) => {
    if (action?.doneAt) return action;
    if (action?.relativeToMeetingHours == null || meetingMs == null) return action;
    return {
      ...action,
      dueAt: toIso(meetingMs - Number(action.relativeToMeetingHours) * HOUR_MS),
    };
  });
}

export function ensureMeetingNextAction(actions = [], client = {}) {
  const list = Array.isArray(actions) ? [...actions] : [];
  const meetingId = `na-meeting-${sanitizeText(client.id) || 'client'}`;
  const hasSchedule = Boolean(client.agreedTime && client.meetingAt);
  const meetingHeld = Boolean(client.progression?.meetingHeld);
  const existingIndex = list.findIndex((entry) => entry.presetKey === 'meeting');

  if (!hasSchedule) {
    if (existingIndex === -1) return list;
    if (list[existingIndex].doneAt) return list;
    return list.filter((_, index) => index !== existingIndex);
  }

  if (existingIndex === -1) {
    if (meetingHeld) return list;
    list.unshift({
      id: meetingId,
      goalKey: 'meetingHeld',
      presetKey: 'meeting',
      name: PRESET_LABELS.meeting,
      dueAt: client.meetingAt,
      doneAt: '',
      createdAt: new Date().toISOString(),
      relativeToMeetingHours: 0,
      addToCalendar: true,
      calendarEventId: '',
    });
    return list;
  }

  const existing = list[existingIndex];
  list[existingIndex] = {
    ...existing,
    dueAt: client.meetingAt,
    relativeToMeetingHours: 0,
    addToCalendar: existing.addToCalendar !== false,
    doneAt: meetingHeld && !existing.doneAt ? new Date().toISOString() : existing.doneAt,
  };
  return list;
}

export function decorateNextActions(client = {}) {
  const normalized = normalizeNextActions(client.nextActions);
  const withMeeting = ensureMeetingNextAction(normalized, client);
  return applyRelativeDueAts(withMeeting, client.meetingAt);
}

export function getCurrentGoalKey(client = {}) {
  const keys = getSalesGoalKeys(client.product);
  return keys.find((key) => !client.progression?.[key]) || '';
}

export function getVisibleGoalKeys(client = {}) {
  const keys = getSalesGoalKeys(client.product);
  const current = getCurrentGoalKey(client);
  const visible = [];
  for (const key of keys) {
    if (client.progression?.[key] || key === current) visible.push(key);
    if (key === current) break;
  }
  return visible;
}

export function getRemainingGoalCount(client = {}) {
  const keys = getSalesGoalKeys(client.product);
  const visible = new Set(getVisibleGoalKeys(client));
  return keys.filter((key) => !visible.has(key)).length;
}

export function getGoalActions(client = {}, goalKey = '') {
  return decorateNextActions(client).filter((action) => action.goalKey === goalKey);
}

export function getActiveNextAction(client = {}) {
  const currentGoal = getCurrentGoalKey(client);
  const open = decorateNextActions(client)
    .filter((action) => !action.doneAt && (!currentGoal || action.goalKey === currentGoal))
    .filter((action) => parseMs(action.dueAt) != null)
    .sort((a, b) => parseMs(a.dueAt) - parseMs(b.dueAt));
  return open[0] || null;
}

export function getClientNextActionMs(client = {}) {
  const action = getActiveNextAction(client);
  return parseMs(action?.dueAt);
}

export function clientHasStartedSalesFlow(client = {}) {
  return Boolean(
    client.progression?.meetingHeld
    || client.progression?.offerSent
    || client.progression?.contractSigned
    || client.progression?.paymentReceived
    || (client.agreedTime && client.meetingAt)
  );
}

export function tilbudWasSent(client = {}) {
  if (client?.progression?.offerSent) return true;
  return decorateNextActions(client).some((action) => action.presetKey === 'sendOffer' && action.doneAt);
}

export function defaultAddToCalendar(presetKey = '', client = {}) {
  if (presetKey === 'meeting') return true;
  if (presetKey === 'checkIn' && tilbudWasSent(client)) return true;
  return false;
}

export const RECENT_OVERDUE_MS = 48 * HOUR_MS;

export function classifyNextActionBucket(client = {}, nowMs = Date.now()) {
  const ms = getClientNextActionMs(client);
  if (ms == null) {
    return clientHasStartedSalesFlow(client) ? 'recentPastDue' : 'noNextAction';
  }
  if (ms >= nowMs) return 'upcoming';
  if (nowMs - ms <= RECENT_OVERDUE_MS) return 'recentPastDue';
  return 'pastDue';
}

export function groupSalesClientsByNextAction(clients = [], nowMs = Date.now()) {
  const upcoming = [];
  const recentPastDue = [];
  const pastDue = [];
  const noNextAction = [];
  for (const client of clients) {
    const bucket = classifyNextActionBucket(client, nowMs);
    if (bucket === 'upcoming') upcoming.push(client);
    else if (bucket === 'recentPastDue') recentPastDue.push(client);
    else if (bucket === 'pastDue') pastDue.push(client);
    else noNextAction.push(client);
  }
  const byMs = (client) => getClientNextActionMs(client) || 0;
  upcoming.sort((a, b) => byMs(a) - byMs(b));
  recentPastDue.sort((a, b) => byMs(a) - byMs(b));
  pastDue.sort((a, b) => byMs(a) - byMs(b));
  noNextAction.sort((a, b) =>
    String(a.businessName || '').localeCompare(String(b.businessName || ''), 'nb-NO', { sensitivity: 'base' })
  );
  return { recentPastDue, upcoming, pastDue, noNextAction };
}

export function inferMeetingHeld(input = {}) {
  const value = input && typeof input === 'object' ? input : {};
  if (Object.prototype.hasOwnProperty.call(value, 'meetingHeld')) {
    return Boolean(value.meetingHeld);
  }
  return Boolean(
    value.offerSent
    || value.contractSigned
    || value.checkIn1
    || value.checkIn2
    || value.paymentReceived
  );
}

export function salesProgressBlockedReason(client, key, { fastTrack = false } = {}) {
  const mapped = key === 'step0AgreeMeetingTime' ? 'meetingHeld' : key;
  if (mapped === 'offerSent' && !client?.progression?.meetingHeld) {
    return 'Marker møtet hatt først.';
  }
  if (mapped === 'contractSigned') {
    if (fastTrack) return '';
    if (!client?.progression?.meetingHeld) return 'Marker møtet hatt først.';
    if (!client?.progression?.offerSent) return 'Marker sett tilbud først, eller hopp til kontrakt.';
  }
  if (mapped === 'paymentReceived' && !client?.progression?.contractSigned) {
    return 'Marker kontrakt signert først.';
  }
  return '';
}

export function salesProgressUncheckReason(client, key) {
  const mapped = key === 'step0AgreeMeetingTime' ? 'meetingHeld' : key;
  const keys = getSalesGoalKeys(client?.product);
  const index = keys.indexOf(mapped);
  if (index === -1) return '';
  const laterDone = keys.slice(index + 1).filter((entry) => client?.progression?.[entry]);
  if (laterDone.length) {
    return `Angre ${formatGoalLabel(laterDone[0])} først.`;
  }
  return '';
}

function completeActionsForGoals(actions, goalKeys, doneAt) {
  const goals = new Set(goalKeys);
  return (Array.isArray(actions) ? actions : []).map((action) => {
    if (!goals.has(action.goalKey) || action.doneAt) return action;
    return { ...action, doneAt };
  });
}

export function applyProgressionChange(client, key, value, { fastTrack = false } = {}, nowMs = Date.now()) {
  const mappedKey = key === 'step0AgreeMeetingTime' ? 'meetingHeld' : key;
  const writable = [
    'meetingHeld',
    'offerSent',
    'checkIn1',
    'checkIn2',
    'contractSigned',
    'paymentReceived',
    'domainConnected',
    'live',
  ];
  if (!writable.includes(mappedKey)) {
    return { error: 'Ugyldig steg.' };
  }
  if (value) {
    const blocked = salesProgressBlockedReason(client, mappedKey, { fastTrack });
    if (blocked) return { error: blocked };
  } else {
    const blocked = salesProgressUncheckReason(client, mappedKey);
    if (blocked) return { error: blocked };
  }

  const progression = { ...(client.progression || {}) };
  progression[mappedKey] = Boolean(value);
  if (fastTrack && mappedKey === 'contractSigned' && value) {
    progression.meetingHeld = true;
    progression.offerSent = true;
    progression.contractSigned = true;
  }
  progression.step0AgreeMeetingTime = Boolean(progression.meetingHeld);

  const nowIso = toIso(nowMs);
  const goalsToComplete = [];
  if (value && mappedKey === 'meetingHeld') goalsToComplete.push('meetingHeld');
  if (value && mappedKey === 'offerSent') goalsToComplete.push('offerSent');
  if (value && mappedKey === 'contractSigned') goalsToComplete.push('contractSigned');
  if (value && mappedKey === 'paymentReceived') goalsToComplete.push('paymentReceived');
  if (fastTrack && mappedKey === 'contractSigned' && value) {
    goalsToComplete.push('meetingHeld', 'offerSent', 'contractSigned');
  }

  const nextActions = decorateNextActions({
    ...client,
    progression,
    nextActions: completeActionsForGoals(decorateNextActions(client), goalsToComplete, nowIso),
  });

  return { progression, nextActions };
}

function dueMatchesSuggested(dueAt, suggestedAt) {
  const dueMs = parseMs(dueAt);
  const suggestedMs = parseMs(suggestedAt);
  if (dueMs == null || suggestedMs == null) return false;
  return Math.abs(dueMs - suggestedMs) < 60 * 1000;
}

export function applyNextActionMutation(client, patch = {}, nowMs = Date.now()) {
  const op = sanitizeText(patch.op || patch.action || 'create').toLowerCase();
  const currentGoal = getCurrentGoalKey(client);
  let actions = decorateNextActions(client);
  const extra = {};

  if (op === 'create') {
    const goalKey = sanitizeText(patch.goalKey) || currentGoal;
    if (!goalKey || goalKey !== currentGoal) {
      return { error: 'Neste handling kan bare settes på aktivt mål.' };
    }
    const presetKey = PRESET_KEYS.has(sanitizeText(patch.presetKey)) ? sanitizeText(patch.presetKey) : 'custom';
    if (!(GOAL_PRESETS[goalKey] || []).includes(presetKey)) {
      return { error: 'Denne handlingen hører ikke til dette målet.' };
    }
    if (presetNeedsMeeting(presetKey) && !(client.agreedTime && client.meetingAt)) {
      return { error: 'Sett avtalt møtetid før SMS 24h / Call 2h.' };
    }
    const name = sanitizeText(patch.name);
    const dueAt = sanitizeText(patch.dueAt);
    if (!name) return { error: 'Navn på neste handling er påkrevd.' };
    if (!parseMs(dueAt)) return { error: 'Tid for neste handling er påkrevd.' };
    const suggested = suggestedDueAtForPreset(presetKey, client, nowMs);
    const relativeDefault = relativeHoursForPreset(presetKey);
    const keepRelative = relativeDefault != null && dueMatchesSuggested(dueAt, suggested);
    const addToCalendar = Object.prototype.hasOwnProperty.call(patch, 'addToCalendar')
      ? Boolean(patch.addToCalendar)
      : defaultAddToCalendar(presetKey, client);
    actions.push(normalizeNextAction({
      id: makeActionId(),
      goalKey,
      presetKey,
      name,
      dueAt,
      createdAt: toIso(nowMs),
      relativeToMeetingHours: keepRelative ? relativeDefault : null,
      addToCalendar,
    }));
  } else if (op === 'update') {
    const actionId = sanitizeText(patch.id || patch.actionId);
    const index = actions.findIndex((entry) => entry.id === actionId);
    if (index === -1) return { error: 'Handlingen finnes ikke.' };
    const current = actions[index];
    const name = Object.prototype.hasOwnProperty.call(patch, 'name') ? sanitizeText(patch.name) : current.name;
    const dueAt = Object.prototype.hasOwnProperty.call(patch, 'dueAt') ? sanitizeText(patch.dueAt) : current.dueAt;
    if (!name) return { error: 'Navn på neste handling er påkrevd.' };
    if (!parseMs(dueAt)) return { error: 'Tid for neste handling er påkrevd.' };
    const dueChanged = dueAt !== current.dueAt;
    const addToCalendar = Object.prototype.hasOwnProperty.call(patch, 'addToCalendar')
      ? Boolean(patch.addToCalendar)
      : Boolean(current.addToCalendar);
    actions[index] = {
      ...current,
      name,
      dueAt,
      addToCalendar: current.presetKey === 'meeting' ? true : addToCalendar,
      relativeToMeetingHours: dueChanged ? null : current.relativeToMeetingHours,
    };
    if (current.presetKey === 'meeting' && dueChanged) {
      extra.agreedTime = true;
      extra.meetingAt = dueAt;
      actions[index].relativeToMeetingHours = 0;
    }
  } else if (op === 'complete' || op === 'uncomplete') {
    const actionId = sanitizeText(patch.id || patch.actionId);
    const index = actions.findIndex((entry) => entry.id === actionId);
    if (index === -1) return { error: 'Handlingen finnes ikke.' };
    const done = op === 'uncomplete'
      ? false
      : (Object.prototype.hasOwnProperty.call(patch, 'done') ? Boolean(patch.done) : true);
    actions[index] = {
      ...actions[index],
      doneAt: done ? (sanitizeText(patch.doneAt) || toIso(nowMs)) : '',
    };
  } else if (op === 'delete') {
    const actionId = sanitizeText(patch.id || patch.actionId);
    const current = actions.find((entry) => entry.id === actionId);
    if (!current) return { error: 'Handlingen finnes ikke.' };
    if (current.presetKey === 'meeting') {
      return { error: 'Møtetiden endres i redigering av kunden, ikke slettes her.' };
    }
    actions = actions.filter((entry) => entry.id !== actionId);
  } else {
    return { error: 'Ugyldig handling.' };
  }

  const nextClient = {
    ...client,
    ...extra,
    nextActions: actions,
  };
  return {
    nextActions: decorateNextActions(nextClient),
    ...extra,
  };
}
