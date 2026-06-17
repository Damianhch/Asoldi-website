export const CLIENT_TOKEN_KEY = 'clientToken';

export function getClientToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CLIENT_TOKEN_KEY) || '';
}

export function setClientToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLIENT_TOKEN_KEY, token);
}

export function clearClientToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CLIENT_TOKEN_KEY);
}

export function clientAuthHeaders(extra: Record<string, string> = {}) {
  const token = getClientToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function requestClientApi<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
    ...clientAuthHeaders(),
  };
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path, {
    ...init,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return data as T;
}
