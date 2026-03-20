import express from 'express';
import { createHmac, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import * as store from './data/store.js';
import * as hub from './data/hub.js';
import * as resetTokens from './data/reset-tokens.js';
import * as emailLib from './lib/email.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = join(__dirname, 'dist');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production';

function signToken(payload) {
  const data = JSON.stringify(payload);
  const sig = createHmac('sha256', ADMIN_SECRET).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

function verifyToken(token) {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString());
    const expect = createHmac('sha256', ADMIN_SECRET).update(raw.data).digest('hex');
    if (expect !== raw.sig) return null;
    return JSON.parse(raw.data);
  } catch {
    return null;
  }
}

async function ensureAdminExists() {
  const admin = await store.getAdmin();
  if (admin) return;
  const username = process.env.ADMIN_USERNAME || 'asoldi.com';
  const password = process.env.ADMIN_PASSWORD || 'D@mi@N102020';
  await store.setAdminCredentials(username, password);
  console.log('Default admin created (username:', username, '). Set ADMIN_USERNAME/ADMIN_PASSWORD/ADMIN_SECRET in production.');
}

// --- API (must be before static)
app.use(express.json());

// Rate limit forgot-password (5 per IP per 15 min)
const forgotPasswordAttempts = new Map();
function rateLimitForgotPassword(ip) {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const entries = forgotPasswordAttempts.get(ip) || [];
  const recent = entries.filter((t) => now - t < window);
  if (recent.length >= 5) return false;
  recent.push(now);
  forgotPasswordAttempts.set(ip, recent);
  return true;
}

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const valid = await store.verifyAdmin(username, password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = signToken({ role: 'admin', username, at: Date.now() });
  res.json({ token });
});

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.admin = payload;
  next();
}

app.get('/api/admin/users', adminAuth, async (_req, res) => {
  const users = await store.getAllUsers();
  res.json(users.map((u) => ({
    id: u.id,
    username: u.username,
    createdAt: u.createdAt,
    role: u.role === 'employee' || u.role === 'client' ? u.role : 'none',
  })));
});

app.post('/api/admin/users', adminAuth, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const result = await store.createUser(username, password, role || 'none');
  if (!result.ok) {
    return res.status(400).json({ message: result.error });
  }
  res.status(201).json(result.user);
});

app.put('/api/admin/users/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body || {};
  if (username !== undefined) {
    const result = await store.updateUserUsername(id, username);
    if (!result.ok) return res.status(400).json({ message: result.error });
  }
  if (password !== undefined && password !== '') {
    const result = await store.updateUserPassword(id, password);
    if (!result.ok) return res.status(400).json({ message: result.error });
  }
  if (role !== undefined && ['employee', 'client', 'none'].includes(role)) {
    const result = await store.updateUserRole(id, role);
    if (!result.ok) return res.status(400).json({ message: result.error });
  }
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  const result = await store.deleteUser(req.params.id);
  if (!result.ok) return res.status(404).json({ message: result.error });
  res.json({ ok: true });
});

app.post('/api/admin/change-password', adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password required' });
  }
  const valid = await store.verifyAdmin(req.admin.username, currentPassword);
  if (!valid) return res.status(401).json({ message: 'Current password is wrong' });
  const admin = await store.getAdmin();
  if (!admin) return res.status(500).json({ message: 'Admin not found' });
  await store.setAdminCredentials(admin.username, newPassword);
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const result = await store.verifyEmployee(username, password);
  if (!result.ok) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  const token = signToken({ role: 'employee', userId: result.user.id, at: Date.now() });
  res.json({ token, user: { id: result.user.id, username: result.user.username, role: result.user.role } });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!rateLimitForgotPassword(ip)) {
    return res.status(429).json({ message: 'For mange forespørsler. Prøv igjen om 15 minutter.' });
  }
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ message: 'E-post kreves' });
  }
  const user = await store.getUserByUsername(username.trim());
  if (!user || user.role !== 'employee') {
    return res.json({ ok: true, message: 'Hvis e-posten finnes, vil du motta en lenke for å tilbakestille passordet.' });
  }
  if (!emailLib.canSendEmail()) {
    return res.status(503).json({ message: 'E-post er ikke konfigurert. Kontakt administrator.' });
  }
  const token = randomBytes(32).toString('base64url');
  resetTokens.saveResetToken(token, user.id, user.username);
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/login/reset-password?token=${token}`;
  try {
    await emailLib.sendEmail({
      to: user.username,
      subject: 'Tilbakestill passord – Asoldi',
      text: `Hei,\n\nDu ba om å tilbakestille passordet ditt. Klikk på lenken under for å velge et nytt passord:\n\n${resetUrl}\n\nLenken utløper om 1 time.\n\nHvis du ikke ba om dette, kan du ignorere denne e-posten.\n\nMed vennlig hilsen,\nAsoldi`,
      html: `<p>Hei,</p><p>Du ba om å tilbakestille passordet ditt. Klikk på lenken under for å velge et nytt passord:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Lenken utløper om 1 time.</p><p>Hvis du ikke ba om dette, kan du ignorere denne e-posten.</p><p>Med vennlig hilsen,<br>Asoldi</p>`,
    });
  } catch (err) {
    console.error('Forgot password email error:', err);
    return res.status(500).json({ message: 'Kunne ikke sende e-post. Prøv igjen senere.' });
  }
  res.json({ ok: true, message: 'Hvis e-posten finnes, vil du motta en lenke for å tilbakestille passordet.' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token og nytt passord kreves' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Passordet må være minst 8 tegn' });
  }
  const entry = resetTokens.consumeResetToken(token);
  if (!entry) {
    return res.status(400).json({ message: 'Lenken er ugyldig eller utløpt. Be om en ny.' });
  }
  const result = await store.updateUserPassword(entry.userId, newPassword);
  if (!result.ok) {
    return res.status(500).json({ message: 'Kunne ikke oppdatere passord.' });
  }
  res.json({ ok: true, message: 'Passordet er tilbakestilt. Du kan nå logge inn.' });
});

function employeeAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'employee') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.employee = payload;
  next();
}

app.get('/api/auth/me', employeeAuth, async (req, res) => {
  const user = await store.getUserById(req.employee.userId);
  if (!user) return res.status(401).json({ message: 'User not found' });
  if (user.role !== 'employee') {
    return res.status(403).json({ message: 'Access denied. Employee role required.' });
  }
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

// --- Hub API (public: site config for client CMS)
app.get('/api/hub/site-config', (req, res) => {
  const siteKey = req.query.site_key;
  const domain = req.query.domain;
  if (siteKey) {
    const config = hub.getSiteConfig(siteKey, false);
    if (!config) return res.status(404).json({ message: 'Site not found' });
    return res.json({ features: config.features, name: config.name, id: config.id });
  }
  if (domain) {
    const config = hub.getSiteConfig(domain, true);
    if (!config) return res.status(404).json({ message: 'Site not found' });
    return res.json({ features: config.features, name: config.name, id: config.id });
  }
  return res.status(400).json({ message: 'Provide site_key or domain' });
});

// --- CMS config (for client CMS on this server: lookup by env CMS_SITE_KEY or by Host)
app.get('/api/cms/config', (req, res) => {
  const siteKey = process.env.CMS_SITE_KEY;
  if (siteKey) {
    const config = hub.getSiteConfig(siteKey, false);
    if (config) return res.json({ features: config.features, name: config.name, id: config.id });
  }
  const host = (req.get('host') || '').split(':')[0];
  const config = hub.getSiteConfig(host, true);
  if (config) return res.json({ features: config.features, name: config.name, id: config.id });
  res.json({ features: { users: true, analytics: false, ecommerce: false }, name: 'Site' });
});

// --- Super-admin: hub sites CRUD (admin only)
app.get('/api/hub/sites', adminAuth, (_req, res) => {
  res.json(hub.getAllSites());
});

app.post('/api/hub/sites', adminAuth, (req, res) => {
  const { name, domain } = req.body || {};
  const site = hub.createSite({ name: name || 'New site', domain: domain || '' });
  res.status(201).json(site);
});

app.put('/api/hub/sites/:id', adminAuth, (req, res) => {
  const result = hub.updateSite(req.params.id, req.body || {});
  if (!result.ok) return res.status(404).json({ message: result.error });
  res.json(result.site);
});

app.delete('/api/hub/sites/:id', adminAuth, (req, res) => {
  const result = hub.deleteSite(req.params.id);
  if (!result.ok) return res.status(404).json({ message: result.error });
  res.json({ ok: true });
});

// --- Booking (skip Calendly: send email to daracha777@gmail.com)
app.post('/api/booking', async (req, res) => {
  const { name, email, phone, company, service, message } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ message: 'Navn og e-post kreves' });
  }
  if (!emailLib.canSendEmail()) {
    return res.status(503).json({ message: 'E-post er ikke konfigurert.' });
  }
  const when = new Date().toLocaleString('nb-NO', { dateStyle: 'full', timeStyle: 'short' });
  const body = `Ny henvendelse fra nettsiden (brukeren valgte å hoppe over Calendly-booking).

Hvem:
- Navn: ${name}
- E-post: ${email}
- Telefon: ${phone || 'Ikke oppgitt'}
- Bedrift: ${company || 'Ikke oppgitt'}

Når: ${when}
Hvor: Nettsiden (booking-siden, skip Calendly)
Tjeneste: ${service || 'Ikke oppgitt'}

Melding:
${message || '(Ingen melding)'}`;
  try {
    await emailLib.sendEmail({
      to: 'daracha777@gmail.com',
      subject: `[Asoldi] Ny henvendelse: ${name} – ${company || 'Ingen bedrift'}`,
      text: body,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    });
  } catch (err) {
    console.error('Booking email error:', err);
    return res.status(500).json({ message: 'Kunne ikke sende henvendelsen. Prøv igjen.' });
  }
  res.json({ ok: true });
});

// --- Static and SPA
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.match(/\.(tsx?|jsx)$/)) return res.status(404).send('Not found');
  next();
});

app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(500).send('index.html not found');
});

function ensureHubDefaultSite() {
  const sites = hub.getAllSites();
  if (sites.length > 0) return;
  hub.createSite({ name: 'Mong Sushi', domain: 'mongsushi.no' });
  console.log('Hub: seeded default site Mong Sushi (mongsushi.no). Copy its site key and set CMS_SITE_KEY on the client.');
}

async function ensureData() {
  await ensureAdminExists();
  await store.ensureEmployeeUsers();
  ensureHubDefaultSite();
}

ensureData().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error('Failed to init admin:', err);
  process.exit(1);
});
