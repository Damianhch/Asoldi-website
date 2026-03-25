import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir } from './storage-path.js';

const EMPLOYEES_PATH = getDataFilePath('employees-dashboard.json');

function ensureDataDir() {
  ensurePersistentDataDir();
}

function readEmployeesFile() {
  ensureDataDir();
  if (!existsSync(EMPLOYEES_PATH)) {
    return { workers: [], lastWordPressSync: null, lastMyPhonerSync: null, lastLucaSync: null };
  }
  try {
    const parsed = JSON.parse(readFileSync(EMPLOYEES_PATH, 'utf8'));
    return {
      workers: Array.isArray(parsed.workers) ? parsed.workers : [],
      lastWordPressSync: parsed.lastWordPressSync || null,
      lastMyPhonerSync: parsed.lastMyPhonerSync || null,
      lastLucaSync: parsed.lastLucaSync || null,
    };
  } catch {
    return { workers: [], lastWordPressSync: null, lastMyPhonerSync: null, lastLucaSync: null };
  }
}

function writeEmployeesFile(data) {
  ensureDataDir();
  writeFileSync(EMPLOYEES_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

export const DEFAULT_CHECKLIST = {
  contractSent: false,
  contractSigned: false,
  oneWeekMeeting: false,
  monthlyReview: false,
  systemAccessGranted: false,
  personalDetailsReceived: false,
};

function normalizeChecklist(checklist = {}) {
  return {
    ...DEFAULT_CHECKLIST,
    ...checklist,
  };
}

function normalizePaymentInfo(paymentInfo = {}) {
  return {
    hourlyRate: Number(paymentInfo.hourlyRate || 0),
    commissionPerMeeting: Number(paymentInfo.commissionPerMeeting || 0),
    totalOwed: Number(paymentInfo.totalOwed || 0),
    lastPaymentDate: paymentInfo.lastPaymentDate || '',
    nextPayday: paymentInfo.nextPayday || getNextPayday(),
    paymentMethod: paymentInfo.paymentMethod || 'bank',
    bankAccount: paymentInfo.bankAccount || '',
  };
}

function normalizeMyphonerStats(stats = {}) {
  return {
    totalCalls: Number(stats.totalCalls || 0),
    meetingsBooked: Number(stats.meetingsBooked || 0),
    hoursCalled: Number(stats.hoursCalled || 0),
    conversionRate: Number(stats.conversionRate || 0),
    lastSyncDate: stats.lastSyncDate || '',
  };
}

function normalizeNotes(notes = []) {
  return Array.isArray(notes) ? notes : [];
}

function normalizeWorker(worker) {
  const createdAt = worker.createdAt || nowIso();
  return {
    id: worker.id || String(Date.now()),
    name: worker.name || worker.email || 'Unnamed worker',
    email: (worker.email || '').toLowerCase(),
    role: worker.role || 'caller',
    status: worker.status || 'active',
    startDate: worker.startDate || createdAt.slice(0, 10),
    avatarUrl: worker.avatarUrl || '',
    contractUrl: worker.contractUrl || '',
    wordpressId: worker.wordpressId ?? null,
    wordpressCreatedAt: worker.wordpressCreatedAt || '',
    checklist: normalizeChecklist(worker.checklist),
    myphonerStats: normalizeMyphonerStats(worker.myphonerStats),
    paymentInfo: normalizePaymentInfo(worker.paymentInfo),
    notes: normalizeNotes(worker.notes),
    createdAt,
    updatedAt: worker.updatedAt || createdAt,
  };
}

function readState() {
  const state = readEmployeesFile();
  state.workers = state.workers.map(normalizeWorker);
  return state;
}

function writeState(state) {
  writeEmployeesFile({
    ...state,
    workers: state.workers.map(normalizeWorker),
  });
}

export function getEmployeesState() {
  return readState();
}

export function getWorkers() {
  return readState().workers;
}

export function setWorkers(workers) {
  const state = readState();
  state.workers = workers.map(normalizeWorker);
  writeState(state);
  return state.workers;
}

export function getWorkerById(id) {
  return getWorkers().find((worker) => worker.id === id) || null;
}

export function getWorkerByEmail(email) {
  const normalized = String(email || '').toLowerCase();
  return getWorkers().find((worker) => worker.email === normalized) || null;
}

export function createWorker(workerInput) {
  const state = readState();
  const worker = normalizeWorker({
    ...workerInput,
    id: workerInput.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  state.workers.push(worker);
  writeState(state);
  return worker;
}

export function updateWorker(id, updates) {
  const state = readState();
  const index = state.workers.findIndex((worker) => worker.id === id);
  if (index === -1) return null;
  const current = state.workers[index];
  const updated = normalizeWorker({
    ...current,
    ...updates,
    checklist: updates.checklist ? { ...current.checklist, ...updates.checklist } : current.checklist,
    myphonerStats: updates.myphonerStats ? { ...current.myphonerStats, ...updates.myphonerStats } : current.myphonerStats,
    paymentInfo: updates.paymentInfo ? { ...current.paymentInfo, ...updates.paymentInfo } : current.paymentInfo,
    notes: updates.notes || current.notes,
    updatedAt: nowIso(),
  });
  state.workers[index] = updated;
  writeState(state);
  return updated;
}

export function deleteWorker(id) {
  const state = readState();
  const nextWorkers = state.workers.filter((worker) => worker.id !== id);
  if (nextWorkers.length === state.workers.length) return false;
  state.workers = nextWorkers;
  writeState(state);
  return true;
}

export function upsertWorkerByEmail(workerInput) {
  const existing = getWorkerByEmail(workerInput.email);
  if (existing) {
    return updateWorker(existing.id, {
      ...workerInput,
      email: existing.email,
      checklist: existing.checklist,
      notes: existing.notes,
      paymentInfo: existing.paymentInfo,
      myphonerStats: existing.myphonerStats,
    });
  }
  return createWorker({
    ...workerInput,
    role: workerInput.role || 'caller',
    status: workerInput.status || 'active',
    checklist: { ...DEFAULT_CHECKLIST },
    notes: [],
    myphonerStats: { meetingsBooked: 0, totalCalls: 0, hoursCalled: 0, conversionRate: 0, lastSyncDate: '' },
    paymentInfo: {
      hourlyRate: 0,
      commissionPerMeeting: 0,
      totalOwed: 0,
      nextPayday: getNextPayday(),
      paymentMethod: 'bank',
      bankAccount: '',
      lastPaymentDate: '',
    },
  });
}

export function addNote(workerId, content, createdBy = 'admin') {
  const worker = getWorkerById(workerId);
  if (!worker) return null;
  const note = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    createdAt: nowIso(),
    createdBy,
  };
  return updateWorker(workerId, { notes: [...worker.notes, note] });
}

export function updateChecklistItem(workerId, key, value) {
  const worker = getWorkerById(workerId);
  if (!worker || !(key in worker.checklist)) return null;
  return updateWorker(workerId, {
    checklist: {
      ...worker.checklist,
      [key]: !!value,
    },
  });
}

export function updatePaymentInfo(workerId, paymentInfo) {
  const worker = getWorkerById(workerId);
  if (!worker) return null;
  return updateWorker(workerId, {
    paymentInfo: {
      ...worker.paymentInfo,
      ...paymentInfo,
    },
  });
}

export function updateMyphonerStats(workerId, stats) {
  const worker = getWorkerById(workerId);
  if (!worker) return null;
  const mergedStats = {
    ...worker.myphonerStats,
    ...stats,
    lastSyncDate: stats.lastSyncDate || nowIso().slice(0, 10),
  };
  const meetingsBooked = Number(mergedStats.meetingsBooked || 0);
  const hourlyRate = Number(worker.paymentInfo?.hourlyRate || 0);
  const commissionPerMeeting = Number(worker.paymentInfo?.commissionPerMeeting || 0);
  const hoursCalled = Number(mergedStats.hoursCalled || 0);
  const totalOwed = (hoursCalled * hourlyRate) + (meetingsBooked * commissionPerMeeting);
  return updateWorker(workerId, {
    myphonerStats: mergedStats,
    paymentInfo: {
      ...worker.paymentInfo,
      totalOwed,
    },
  });
}

export function markSync(type, meta = {}) {
  const state = readState();
  const stamp = { at: nowIso(), ...meta };
  if (type === 'wordpress') state.lastWordPressSync = stamp;
  if (type === 'myphoner') state.lastMyPhonerSync = stamp;
  if (type === 'luca') state.lastLucaSync = stamp;
  writeState(state);
  return stamp;
}

export function getSyncState() {
  const state = readState();
  return {
    lastWordPressSync: state.lastWordPressSync,
    lastMyPhonerSync: state.lastMyPhonerSync,
    lastLucaSync: state.lastLucaSync,
  };
}

export function getDashboardStats() {
  const workers = getWorkers();
  const activeWorkers = workers.filter((worker) => worker.status === 'active');
  const pendingOnboarding = workers.filter((worker) => worker.status === 'onboarding').length;
  const totalMeetingsThisMonth = workers.reduce((sum, worker) => sum + Number(worker.myphonerStats?.meetingsBooked || 0), 0);
  const totalHoursThisMonth = workers.reduce((sum, worker) => sum + Number(worker.myphonerStats?.hoursCalled || 0), 0);
  const totalOwedThisMonth = workers.reduce((sum, worker) => sum + Number(worker.paymentInfo?.totalOwed || 0), 0);
  const daysUntilPayday = calculateDaysUntilPayday();
  const isOverdue = workers.some((worker) => isPaymentOverdue(worker.paymentInfo?.lastPaymentDate));

  return {
    totalWorkers: workers.length,
    activeWorkers: activeWorkers.length,
    totalMeetingsThisMonth,
    totalHoursThisMonth,
    totalOwedThisMonth,
    daysUntilPayday,
    isOverdue,
    pendingOnboarding,
  };
}

export function getWorkersNeedingAttention(limit = 5) {
  return getWorkers()
    .filter((worker) => {
      const incomplete = Object.values(worker.checklist).filter((value) => !value).length;
      return worker.status !== 'inactive' && incomplete >= 2;
    })
    .sort((a, b) => {
      const aIncomplete = Object.values(a.checklist).filter((value) => !value).length;
      const bIncomplete = Object.values(b.checklist).filter((value) => !value).length;
      return bIncomplete - aIncomplete;
    })
    .slice(0, limit);
}

export function getTopPerformers(limit = 5) {
  return getWorkers()
    .filter((worker) => worker.status === 'active')
    .sort((a, b) => Number(b.myphonerStats?.meetingsBooked || 0) - Number(a.myphonerStats?.meetingsBooked || 0))
    .slice(0, limit);
}

export function ensureWorkersForUsers(users = []) {
  let created = 0;
  for (const user of users) {
    if (user.role !== 'employee') continue;
    const existing = getWorkerByEmail(user.username);
    if (!existing) {
      createWorker({
        name: user.username.split('@')[0],
        email: user.username,
        status: 'active',
        role: 'caller',
        startDate: (user.createdAt || nowIso()).slice(0, 10),
      });
      created += 1;
    }
  }
  return created;
}

function getNextPayday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
}

function calculateDaysUntilPayday() {
  const now = new Date();
  const nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(0, Math.ceil((nextPayday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function isPaymentOverdue(lastPaymentDate) {
  if (!lastPaymentDate) return new Date().getDate() > 1;
  const lastPayment = new Date(lastPaymentDate);
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return now.getDate() > 1 && lastPayment < firstOfMonth;
}
