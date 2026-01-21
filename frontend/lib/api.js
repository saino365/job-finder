import { API_BASE_URL } from '../config';

export async function apiGet(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jf_token');
}

export async function apiAuth(path, { method = 'POST', body } = {}) {
  const token = getToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`API Error: ${method} ${path}`, { status: res.status, body: errorText });
    throw new Error(errorText || `${method} ${path} failed: ${res.status}`);
  }
  return res.json();
}
