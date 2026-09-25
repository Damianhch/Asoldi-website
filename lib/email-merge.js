const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function escapeMergeValue(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripRetiredEmailPhrases(html = '') {
  return String(html || '').replace(/\s*Se den her:\s*<a\b[^>]*>[\s\S]*?<\/a>/gi, '');
}

export function stripMarketingUnsubscribe(html = '') {
  return String(html || '')
    .replace(/<p[^>]*>\s*<a\b[^>]*href=['"][^'"]*\/email\/avmeld[^'"]*['"][^>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '')
    .replace(/<a\b[^>]*href=['"][^'"]*\/email\/avmeld[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi, '');
}

export function ensureSignerMergeTags(html = '') {
  return String(html || '').replace(/Mvh\s+Damian(\s+fra)?/gi, 'Mvh {{signerName}}$1');
}

const HIDDEN_DIV_RE = /<div\b[^>]*style=(["'])[^"']*display\s*:\s*none[^"']*\1[^>]*>[\s\S]*?<\/div>\s*/gi;

function hiddenPreviewText(inner = '') {
  return String(inner)
    .replace(/<[^>]+>/g, '')
    .replace(/&zwnj;|&#847;|&nbsp;|&#160;|\u00a0|\u200c/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inbox/notification snippet: exactly one hidden preheader, then invisible padding so
 * Gmail does not also pull the heading and first paragraph into the notification.
 */
export function injectEmailPreheader(html = '', preheader = '') {
  const text = String(preheader || '').replace(/\s+/g, ' ').trim();
  let body = String(html || '');
  body = body.replace(HIDDEN_DIV_RE, (full) => {
    const inner = full.replace(/^<div\b[^>]*>/i, '').replace(/<\/div>\s*$/i, '');
    const preview = hiddenPreviewText(inner);
    if (!preview) return '';
    if (text && (preview === text || preview.startsWith(text) || text.startsWith(preview))) return '';
    return full;
  });
  if (!text) return body;
  const pad = '&zwnj;&nbsp;'.repeat(45);
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;" aria-hidden="true">${escapeMergeValue(text)}${pad}</div>\n${body}`;
}

export function applyMerge(template = '', values = {}, { escapeHtml = true } = {}) {
  return String(template || '').replace(TOKEN_RE, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return `{{${key}}}`;
    const raw = values[key] == null ? '' : String(values[key]);
    return escapeHtml ? escapeMergeValue(raw) : raw;
  });
}

export function applyMergeAll(fields = {}, values = {}, { escapeHtml = true } = {}) {
  const next = {};
  for (const [key, value] of Object.entries(fields || {})) {
    next[key] = typeof value === 'string' ? applyMerge(value, values, { escapeHtml: key === 'html' ? false : escapeHtml }) : value;
  }
  if (typeof fields.html === 'string') {
    next.html = applyMerge(fields.html, values, { escapeHtml: false });
  }
  return next;
}
