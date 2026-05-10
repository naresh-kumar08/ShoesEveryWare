const API_BASE = '/api';
const TOKEN_KEY = 'token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export function authHeaders() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch(path, { method = 'GET', body, headers = {}, isMultipart = false } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: isMultipart ? headers : { 'Content-Type': 'application/json', ...headers },
    body: isMultipart ? body : body != null ? JSON.stringify(body) : undefined
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function requireAuth(returnUrl = '/index.html') {
  const me = await tryGetMe();
  if (!me) {
    const url = new URL('/login.html', window.location.origin);
    url.searchParams.set('returnUrl', window.location.pathname + window.location.search);
    window.location.href = url.toString();
    return null;
  }
  return me;
}

export async function tryGetMe() {
  try {
    const token = getToken();
    if (!token) return null;
    const data = await apiFetch('/auth/me', { method: 'GET', headers: authHeaders() });
    return data.user;
  } catch {
    return null;
  }
}

export function logout() {
  setToken(null);
  window.location.href = '/index.html';
}

