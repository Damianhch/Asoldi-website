import { readFileSync, existsSync } from 'fs';
import bcrypt from 'bcryptjs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const USERS_PATH = getDataFilePath('users.json');
const ADMIN_PATH = getDataFilePath('admin.json');

const SALT_ROUNDS = 12;

function ensureDataDir() {
  ensurePersistentDataDir();
}

function readUsers() {
  ensureDataDir();
  if (!existsSync(USERS_PATH)) return [];
  try {
    return JSON.parse(readFileSync(USERS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureDataDir();
  writeDataJson(USERS_PATH, users);
}

function readAdmin() {
  ensureDataDir();
  if (!existsSync(ADMIN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeAdmin(admin) {
  ensureDataDir();
  writeDataJson(ADMIN_PATH, admin);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function getAdmin() {
  return readAdmin();
}

export async function setAdminCredentials(username, password) {
  const hash = await hashPassword(password);
  // Keep the sender profile (name / fromEmail / phone) — only the credentials change here.
  const current = readAdmin() || {};
  writeAdmin({ ...current, username, passwordHash: hash });
}

export async function verifyAdmin(username, password) {
  const admin = readAdmin();
  if (!admin || admin.username !== username) return false;
  return verifyPassword(password, admin.passwordHash);
}

export async function getAllUsers() {
  return migrateEmployeeProducts(seedKnownPhones(readUsers()));
}

/**
 * Phone numbers that must exist on the live install even though the data dir is never part of a deploy.
 * Seeded once (only when the user has no number yet); later edits in admin → Users win.
 */
const SEED_PHONES = {
  'alexander@asoldi.com': '+4792331098',
};

function seedKnownPhones(users) {
  let changed = false;
  for (const user of users) {
    const seeded = SEED_PHONES[String(user?.username || '').trim().toLowerCase()];
    if (seeded && !normalizePhone(user.phone)) {
      user.phone = seeded;
      changed = true;
    }
  }
  if (changed) writeUsers(users);
  return users;
}

/** Digits with a leading "+"; bare 8-digit Norwegian numbers get +47. '' when nothing usable is left. */
export function normalizePhone(value = '') {
  let digits = String(value ?? '').trim().replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  const plus = digits.startsWith('+');
  digits = digits.replace(/\D/g, '');
  if (!digits) return '';
  if (!plus && digits.length === 8) return `+47${digits}`;
  if (digits.length < 6 || digits.length > 15) return '';
  return `+${digits}`;
}

export async function getUserById(id) {
  const users = seedKnownPhones(readUsers());
  return users.find((u) => u.id === id) || null;
}

export async function getUserByUsername(username) {
  const users = seedKnownPhones(readUsers());
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

const DEFAULT_ROLE = 'none';
const ROLES = ['employee', 'client', 'sales', 'developer', 'none'];
const DEFAULT_EMPLOYEE_PRODUCT = 'asoldi';
const EMPLOYEE_PRODUCTS = ['asoldi', 'ssu'];

function normalizeRole(r) {
  return ROLES.includes(r) ? r : DEFAULT_ROLE;
}

function normalizeEmployeeProduct(user) {
  if (normalizeRole(user.role) !== 'employee') return undefined;
  return EMPLOYEE_PRODUCTS.includes(user.employeeProduct) ? user.employeeProduct : DEFAULT_EMPLOYEE_PRODUCT;
}

function migrateEmployeeProducts(users) {
  let changed = false;
  for (const user of users) {
    if (user.role === 'employee' && !EMPLOYEE_PRODUCTS.includes(user.employeeProduct)) {
      user.employeeProduct = DEFAULT_EMPLOYEE_PRODUCT;
      changed = true;
    }
  }
  if (changed) writeUsers(users);
  return users;
}

export function toPublicUser(u) {
  const role = normalizeRole(u.role);
  const publicUser = {
    id: u.id,
    username: u.username,
    createdAt: u.createdAt,
    role,
    name: String(u.name || '').trim(),
    fromEmail: String(u.fromEmail || '').trim().toLowerCase(),
    phone: normalizePhone(u.phone),
  };
  if (role === 'employee') {
    publicUser.employeeProduct = normalizeEmployeeProduct(u);
  }
  return publicUser;
}

export async function createUser(username, password, role = DEFAULT_ROLE, extra = {}) {
  const users = readUsers();
  const existing = await getUserByUsername(username);
  if (existing) return { ok: false, error: 'Username already exists' };
  const id = String(Date.now());
  const passwordHash = await hashPassword(password);
  const userRole = normalizeRole(role);
  const name = String(extra.name || '').trim();
  const fromEmail = String(extra.fromEmail || '').trim().toLowerCase();
  const phone = normalizePhone(extra.phone);
  users.push({
    id,
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
    role: userRole,
    ...(name ? { name } : {}),
    ...(fromEmail ? { fromEmail } : {}),
    ...(phone ? { phone } : {}),
  });
  writeUsers(users);
  return { ok: true, user: toPublicUser(users[users.length - 1]) };
}

export async function updateUserProfile(id, patch = {}) {
  const users = readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return { ok: false, error: 'User not found' };
  if (patch.name !== undefined) users[i].name = String(patch.name || '').trim();
  if (patch.fromEmail !== undefined) users[i].fromEmail = String(patch.fromEmail || '').trim().toLowerCase();
  if (patch.phone !== undefined) users[i].phone = normalizePhone(patch.phone);
  writeUsers(users);
  return { ok: true, user: toPublicUser(users[i]) };
}

export function publicAdminSender(admin = {}) {
  return {
    name: String(admin?.name || '').trim(),
    fromEmail: String(admin?.fromEmail || '').trim().toLowerCase(),
    phone: normalizePhone(admin?.phone),
    username: String(admin?.username || '').trim(),
  };
}

export async function getAdminSender() {
  return publicAdminSender(readAdmin() || {});
}

export async function updateAdminSender(patch = {}) {
  const admin = readAdmin() || {};
  if (patch.name !== undefined) admin.name = String(patch.name || '').trim();
  if (patch.fromEmail !== undefined) admin.fromEmail = String(patch.fromEmail || '').trim().toLowerCase();
  if (patch.phone !== undefined) admin.phone = normalizePhone(patch.phone);
  writeAdmin(admin);
  return publicAdminSender(admin);
}

export async function updateUserPassword(id, newPassword) {
  const users = readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return { ok: false, error: 'User not found' };
  users[i].passwordHash = await hashPassword(newPassword);
  writeUsers(users);
  return { ok: true };
}

export async function updateUserUsername(id, newUsername) {
  const users = readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return { ok: false, error: 'User not found' };
  const existing = users.find((u) => u.username.toLowerCase() === newUsername.toLowerCase() && u.id !== id);
  if (existing) return { ok: false, error: 'Username already exists' };
  users[i].username = newUsername;
  writeUsers(users);
  return { ok: true };
}

export async function updateUserRole(id, role) {
  const users = readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return { ok: false, error: 'User not found' };
  users[i].role = normalizeRole(role);
  if (users[i].role === 'employee') {
    if (!EMPLOYEE_PRODUCTS.includes(users[i].employeeProduct)) {
      users[i].employeeProduct = DEFAULT_EMPLOYEE_PRODUCT;
    }
  } else {
    delete users[i].employeeProduct;
  }
  writeUsers(users);
  return { ok: true };
}

export async function updateUserEmployeeProduct(id, product) {
  if (!EMPLOYEE_PRODUCTS.includes(product)) {
    return { ok: false, error: 'Invalid employee product' };
  }
  const users = readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return { ok: false, error: 'User not found' };
  if (normalizeRole(users[i].role) !== 'employee') {
    return { ok: false, error: 'User is not an employee' };
  }
  users[i].employeeProduct = product;
  writeUsers(users);
  return { ok: true };
}

export async function deleteUser(id) {
  const users = readUsers();
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) return { ok: false, error: 'User not found' };
  writeUsers(filtered);
  return { ok: true };
}

export async function deactivateUserKeepingData(id, reason = 'self-service-deactivation') {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return { ok: false, error: 'User not found' };
  const existing = users[index] || {};
  users[index] = {
    ...existing,
    role: 'none',
    deactivatedAt: existing.deactivatedAt || new Date().toISOString(),
    deactivatedReason: String(reason || 'self-service-deactivation'),
    previousRole: existing.previousRole || existing.role || 'none',
  };
  writeUsers(users);
  return { ok: true };
}

export async function verifyEmployee(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return { ok: false };
  const valid = await verifyPassword(password, user.passwordHash);
  const role = normalizeRole(user.role);
  if (!valid || role !== 'employee') return { ok: false };
  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role,
      employeeProduct: normalizeEmployeeProduct(user),
    },
  };
}

export async function verifyStaff(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return { ok: false };
  const valid = await verifyPassword(password, user.passwordHash);
  const role = normalizeRole(user.role);
  if (!valid || (role !== 'employee' && role !== 'sales' && role !== 'developer')) return { ok: false };
  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role,
      employeeProduct: role === 'employee' ? normalizeEmployeeProduct(user) : undefined,
    },
  };
}

export async function verifyClient(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return { ok: false };
  const valid = await verifyPassword(password, user.passwordHash);
  const role = normalizeRole(user.role);
  if (!valid || role !== 'client') return { ok: false };
  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role,
    },
  };
}

