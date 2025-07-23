// client/src/services/authService.js
const API_BASE_URL = 'https://blind-tennis-server.onrender.com';
const AUTH_API = `${API_BASE_URL}/api/auth`;

export async function register(data) {
  const res = await fetch(`${AUTH_API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || 'Rejestracja nieudana.');
  }
  return res.json();
}

export async function login(data) {
  const res = await fetch(`${AUTH_API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    const error = new Error(errorData.message || 'Logowanie nieudane.');
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function logout() {
  await fetch(`${AUTH_API}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchProfile() {
  const res = await fetch(`${AUTH_API}/profile`, {
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