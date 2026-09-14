import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from '../data/storage-path.js';
import {
  EMPTY_EMAIL_HTML,
  EMAIL_MERGE_FIELDS,
  buildSalesCalendarInvite,
  buildSalesReminderEmail,
  buildSalesThankYouEmail,
  getSalesEmailPreviewClient,
  htmlToPlainText,
  resolveSalesEmailAssetBase,
  rewriteSalesEmailAssetsToHosted,
  salesEmailMergeMap,
} from './sales-email.js';
import { applyMerge, ensureSignerMergeTags, stripMarketingUnsubscribe, stripRetiredEmailPhrases } from './email-merge.js';

const TEMPLATES_PATH = getDataFilePath('email-templates.json');
const DRAFTS_PATH = getDataFilePath('email-drafts.json');
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = 'tpl') {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function readJson(path, fallback) {
  ensurePersistentDataDir();
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeTemplate(raw = {}) {
  const createdAt = sanitizeText(raw.createdAt) || nowIso();
  return {
    id: sanitizeText(raw.id) || makeId(),
    key: sanitizeText(raw.key),
    name: sanitizeText(raw.name) || 'Uten navn',
    subject: sanitizeText(raw.subject),
    preheader: sanitizeText(raw.preheader),
    html: stripMarketingUnsubscribe(stripRetiredEmailPhrases(ensureSignerMergeTags(String(raw.html || '')))),
    grapesProject: raw.grapesProject && typeof raw.grapesProject === 'object' ? raw.grapesProject : null,
    preset: Boolean(raw.preset),
    createdAt,
    updatedAt: sanitizeText(raw.updatedAt) || createdAt,
  };
}

function asoldiPresetHtml(builder) {
  const client = getSalesEmailPreviewClient();
  return builder(client, client.calendar || {}, {
    mergeTags: true,
    assetBase: '/email/sales',
    previewVariant: 'desktop',
  });
}

function asoldiPresets() {
  const thankYou = asoldiPresetHtml(buildSalesThankYouEmail);
  const reminder24 = asoldiPresetHtml((client, calendar, options) => (
    buildSalesReminderEmail(client, calendar, '24h', options)
  ));
  const reminder1h = asoldiPresetHtml((client, calendar, options) => (
    buildSalesReminderEmail(client, calendar, '1h', options)
  ));
  return [
    {
      key: 'thank-you',
      name: 'Velkomst / møtebekreftelse',
      subject: thankYou.subject,
      preheader: 'Vi har satt av tid til {{businessName}} — Meet-lenken er her.',
      html: thankYou.html,
      preset: true,
    },
    {
      key: 'reminder-24h',
      name: 'Påminnelse 24 timer',
      subject: reminder24.subject,
      preheader: 'Møtet starter om 24 timer.',
      html: reminder24.html,
      preset: true,
    },
    {
      key: 'reminder-1h',
      name: 'Påminnelse 1 time',
      subject: reminder1h.subject,
      preheader: 'Møtet starter om 1 time.',
      html: reminder1h.html,
      preset: true,
    },
  ].map((row) => normalizeTemplate({ ...row, id: `preset-${row.key}` }));
}

function readTemplates() {
  const stored = readJson(TEMPLATES_PATH, null);
  const list = Array.isArray(stored) ? stored.map(normalizeTemplate) : [];
  const keys = new Set(list.map((row) => row.key).filter(Boolean));
  let changed = !Array.isArray(stored);
  for (const preset of asoldiPresets()) {
    if (!keys.has(preset.key)) {
      list.push(preset);
      changed = true;
      continue;
    }
    const index = list.findIndex((row) => row.key === preset.key);
    if (index === -1) continue;
    const existing = list[index];
    if (existing.preset && !existing.grapesProject && (
      existing.html !== preset.html
      || existing.subject !== preset.subject
      || existing.preheader !== preset.preheader
    )) {
      list[index] = {
        ...existing,
        html: preset.html,
        subject: preset.subject,
        preheader: preset.preheader,
        updatedAt: nowIso(),
      };
      changed = true;
    }
  }
  if (changed) writeDataJson(TEMPLATES_PATH, list);
  return list;
}

function writeTemplates(list) {
  writeDataJson(TEMPLATES_PATH, list.map(normalizeTemplate));
}

export function listEmailTemplates() {
  return readTemplates().sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

export function getEmailTemplateById(id) {
  const target = sanitizeText(id);
  return readTemplates().find((row) => row.id === target || row.key === target) || null;
}

export function saveEmailTemplate(input = {}) {
  const list = readTemplates();
  const incoming = normalizeTemplate({
    ...input,
    id: sanitizeText(input.id) || makeId(),
    updatedAt: nowIso(),
  });
  if (!incoming.name) return { ok: false, error: 'Name is required' };
  if (!incoming.html) incoming.html = EMPTY_EMAIL_HTML;
  const index = list.findIndex((row) => row.id === incoming.id);
  if (index === -1) {
    incoming.createdAt = nowIso();
    list.push(incoming);
  } else {
    incoming.createdAt = list[index].createdAt;
    incoming.preset = list[index].preset || incoming.preset;
    list[index] = incoming;
  }
  writeTemplates(list);
  return { ok: true, template: incoming };
}

export function importEmailTemplate({ name, subject, preheader, html, grapesProject, key } = {}) {
  const cleanedHtml = String(html || '').trim();
  if (!cleanedHtml) return { ok: false, error: 'HTML is required' };
  return saveEmailTemplate({
    key,
    name: name || 'Importert mal',
    subject: subject || '',
    preheader: preheader || '',
    html: cleanedHtml,
    grapesProject: grapesProject || null,
    preset: false,
  });
}

export function deleteEmailTemplate(id) {
  const list = readTemplates();
  const next = list.filter((row) => row.id !== id && row.key !== id);
  if (next.length === list.length) return { ok: false, error: 'Template not found' };
  writeTemplates(next);
  return { ok: true };
}

function readDrafts() {
  const now = Date.now();
  const rows = (readJson(DRAFTS_PATH, []) || []).filter((row) => {
    const created = Date.parse(row?.createdAt || 0);
    return Number.isFinite(created) && now - created < DRAFT_TTL_MS;
  });
  return rows;
}

function writeDrafts(rows) {
  writeDataJson(DRAFTS_PATH, rows);
}

export function saveEmailDraft(input = {}) {
  const drafts = readDrafts();
  const draft = {
    id: sanitizeText(input.id) || makeId('draft'),
    clientId: sanitizeText(input.clientId),
    templateId: sanitizeText(input.templateId),
    templateKey: sanitizeText(input.templateKey),
    to: sanitizeText(input.to),
    subject: sanitizeText(input.subject),
    preheader: sanitizeText(input.preheader),
    html: String(input.html || ''),
    createdAt: nowIso(),
  };
  const index = drafts.findIndex((row) => row.id === draft.id);
  if (index === -1) drafts.push(draft);
  else drafts[index] = draft;
  writeDrafts(drafts);
  return draft;
}

export function getEmailDraft(id) {
  const target = sanitizeText(id);
  return readDrafts().find((row) => row.id === target) || null;
}

function generatedEmail(client, templateKey, sender = {}) {
  const calendar = client?.calendar || {};
  const options = { embed: false, assetBase: resolveSalesEmailAssetBase(), sender };
  if (templateKey === 'reminder-1h') return buildSalesReminderEmail(client, calendar, '1h', options);
  if (templateKey === 'reminder-24h' || templateKey === 'reminder') {
    return buildSalesReminderEmail(client, calendar, '24h', options);
  }
  return buildSalesThankYouEmail(client, calendar, options);
}

export function mergeFieldsMeta() {
  return EMAIL_MERGE_FIELDS;
}

export function composeEmailForClient(client, templateKey = 'thank-you', composed = null, options = {}) {
  const key = sanitizeText(templateKey) || 'thank-you';
  const sender = options.sender || {};
  const generated = generatedEmail(client, key, sender);
  const template = getEmailTemplateById(key);
  const values = salesEmailMergeMap(client, client?.calendar || {}, sender);
  const htmlRaw = stripMarketingUnsubscribe(stripRetiredEmailPhrases(ensureSignerMergeTags(String(composed?.html || template?.html || generated.html || ''))));
  const subjectRaw = String(composed?.subject || template?.subject || generated.subject || '');
  const preheaderRaw = String(composed?.preheader || template?.preheader || '');
  const html = applyMerge(htmlRaw, values, { escapeHtml: true });
  const subject = applyMerge(subjectRaw, values, { escapeHtml: false });
  const preheader = applyMerge(preheaderRaw, values, { escapeHtml: false });
  const withPreheader = preheader && !html.includes('display:none')
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>${html}`
    : html;
  const hostedHtml = rewriteSalesEmailAssetsToHosted(withPreheader);
  const invite = options.attachInvite === true
    ? buildSalesCalendarInvite(client, client?.calendar || {}, { organizerEmail: sender.fromEmail })
    : null;
  return {
    template,
    generated,
    merged: {
      subject,
      preheader,
      html,
    },
    message: {
      ...generated,
      from: sender.from || generated.from,
      replyTo: sender.replyTo || generated.replyTo,
      subject,
      html: hostedHtml,
      text: htmlToPlainText(html),
      attachments: [],
      icalEvent: invite || undefined,
    },
    mergeFields: EMAIL_MERGE_FIELDS,
    values,
  };
}

