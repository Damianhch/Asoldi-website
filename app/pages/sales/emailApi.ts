import { API, salesAuthHeaders } from '../Admin/shared';

export type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  subject: string;
  preheader: string;
  html: string;
  grapesProject?: unknown;
  preset?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MergeField = { token: string; label: string; sample?: string };

async function emailRequest(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    ...salesAuthHeaders(),
    ...(init?.headers as Record<string, string> || {}),
  };
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    throw new Error(String((data as { message?: string }).message || `Request failed (${response.status})`));
  }
  return data;
}

export function listEmailTemplates() {
  return emailRequest('/admin/email-templates') as Promise<{ templates: EmailTemplate[]; mergeFields: MergeField[] }>;
}

export function saveEmailTemplate(template: Partial<EmailTemplate>) {
  const id = template.id;
  if (id) {
    return emailRequest(`/admin/email-templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    }) as Promise<{ template: EmailTemplate }>;
  }
  return emailRequest('/admin/email-templates', {
    method: 'POST',
    body: JSON.stringify(template),
  }) as Promise<{ template: EmailTemplate }>;
}

export function importEmailTemplate(payload: { name?: string; subject?: string; preheader?: string; html: string; key?: string }) {
  return emailRequest('/admin/email-templates/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ template: EmailTemplate }>;
}

export function deleteEmailTemplate(id: string) {
  return emailRequest(`/admin/email-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function composeSalesEmail(clientId: string, template: string) {
  return emailRequest(`/admin/sales/${encodeURIComponent(clientId)}/compose-email?template=${encodeURIComponent(template)}`);
}

export function saveEmailDraft(payload: Record<string, unknown>) {
  return emailRequest('/admin/email-drafts', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ draft: { id: string }; previewPc: string; previewPhone: string }>;
}

export function sendComposedEmail(clientId: string, payload: Record<string, unknown>) {
  return emailRequest(`/admin/sales/${encodeURIComponent(clientId)}/send-composed-email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
