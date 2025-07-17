// client/src/services/authService.js
const API = '/api/auth';

export async function register(data) {
  const res = await fetch(`${API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function login(data) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function logout() {
  await fetch(`${API}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchProfile() {
  const res = await fetch('/api/auth/profile', {
    credentials: 'include'
  });
  if (res.status === 401) {
    const err = new Error('Nieautoryzowany');
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error('Błąd pobierania profilu');
  return res.json();
}
