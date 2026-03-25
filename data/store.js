import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const USERS_PATH = join(DATA_DIR, 'users.json');
const ADMIN_PATH = join(DATA_DIR, 'admin.json');

const SALT_ROUNDS = 12;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
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
  writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
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
  writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2), 'utf8');
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
  writeAdmin({ username, passwordHash: hash });
}

export async function verifyAdmin(username, password) {
  const admin = readAdmin();
  if (!admin || admin.username !== username) return false;
  return verifyPassword(password, admin.passwordHash);
}

export async function getAllUsers() {
  return readUsers();
}

export async function getUserById(id) {
  const users = readUsers();
  return users.find((u) => u.id === id) || null;
}

export async function getUserByUsername(username) {
  const users = readUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

const DEFAULT_ROLE = 'none';
const ROLES = ['employee', 'client', 'none'];

function normalizeRole(r) {
  return ROLES.includes(r) ? r : DEFAULT_ROLE;
}

export async function createUser(username, password, role = DEFAULT_ROLE) {
  const users = readUsers();
  const existing = await getUserByUsername(username);
  if (existing) return { ok: false, error: 'Username already exists' };
  const id = String(Date.now());
  const passwordHash = await hashPassword(password);
  const userRole = normalizeRole(role);
  users.push({ id, username, passwordHash, createdAt: new Date().toISOString(), role: userRole });
  writeUsers(users);
  return { ok: true, user: { id, username, createdAt: users[users.length - 1].createdAt, role: userRole } };
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

export async function verifyEmployee(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return { ok: false };
  const valid = await verifyPassword(password, user.passwordHash);
  const role = normalizeRole(user.role);
  if (!valid || role !== 'employee') return { ok: false };
  return { ok: true, user: { id: user.id, username: user.username, role } };
}

/** Seed employee users for ansatt login if they don't exist. Username = email, password = FirstNamePassword. */
const EMPLOYEE_SEED = [
  { username: 'jonatanhetland@gmail.com', password: 'JonatanPassword' },
  { username: 'zo.sliwinska@gmail.com', password: 'ZofiaPassword' },
  { username: 'bjorn.skalle@sogn.no', password: 'BjørnPassword' },
  { username: 'helenedortheaselle@gmail.com', password: 'HelenePassword' },
  { username: 'daracha777@gmail.com', password: 'DamianPassword' },
];

export async function ensureEmployeeUsers() {
  for (const { username, password } of EMPLOYEE_SEED) {
    const existing = await getUserByUsername(username);
    if (!existing) {
      await createUser(username, password, 'employee');
    } else {
      if (normalizeRole(existing.role) !== 'employee') {
        await updateUserRole(existing.id, 'employee');
      }
    }
  }
}
