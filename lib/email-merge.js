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
